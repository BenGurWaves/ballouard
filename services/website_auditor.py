"""Website auditing — PageSpeed Insights + Playwright screenshot + heuristic scoring."""

from __future__ import annotations

import asyncio
import os
from pathlib import Path

import httpx
import structlog

from config.settings import settings

log = structlog.get_logger()

PAGESPEED_URL = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
SCREENSHOT_DIR = Path("screenshots")


async def run_pagespeed_audit(url: str) -> dict:
    """
    Run Google PageSpeed Insights on a URL.
    Returns category scores and key metrics.
    """
    params = {
        "url": url,
        "key": settings.google_pagespeed_api_key,
        "strategy": "mobile",
        "category": ["performance", "accessibility", "best-practices", "seo"],
    }

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.get(PAGESPEED_URL, params=params)
        resp.raise_for_status()
        data = resp.json()

    categories = data.get("lighthouseResult", {}).get("categories", {})
    audits = data.get("lighthouseResult", {}).get("audits", {})

    scores = {
        "performance": _score(categories.get("performance")),
        "accessibility": _score(categories.get("accessibility")),
        "seo": _score(categories.get("seo")),
        "best_practices": _score(categories.get("best-practices")),
    }

    # Extract key metrics
    metrics = {
        "first_contentful_paint_ms": _audit_ms(audits, "first-contentful-paint"),
        "speed_index_ms": _audit_ms(audits, "speed-index"),
        "largest_contentful_paint_ms": _audit_ms(audits, "largest-contentful-paint"),
        "total_blocking_time_ms": _audit_ms(audits, "total-blocking-time"),
        "cumulative_layout_shift": _audit_val(audits, "cumulative-layout-shift"),
        "is_mobile_friendly": _is_mobile_friendly(audits),
        "has_ssl": url.startswith("https"),
    }

    log.info("audit.pagespeed", url=url, scores=scores)
    return {"scores": scores, "metrics": metrics, "raw": data}


def _score(category: dict | None) -> float | None:
    if category is None:
        return None
    return round((category.get("score") or 0) * 100, 1)


def _audit_ms(audits: dict, key: str) -> int | None:
    audit = audits.get(key, {})
    val = audit.get("numericValue")
    return int(val) if val is not None else None


def _audit_val(audits: dict, key: str) -> float | None:
    audit = audits.get(key, {})
    return audit.get("numericValue")


def _is_mobile_friendly(audits: dict) -> bool:
    viewport = audits.get("viewport", {})
    return viewport.get("score", 0) == 1


async def take_screenshot(url: str, output_name: str) -> str | None:
    """
    Take a full-page screenshot using Playwright.
    Returns the file path or None if Playwright isn't available.
    """
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        log.warning("audit.screenshot", msg="Playwright not installed, skipping screenshot")
        return None

    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
    filepath = SCREENSHOT_DIR / f"{output_name}.png"

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 900})
        try:
            await page.goto(url, wait_until="networkidle", timeout=30_000)
            await page.screenshot(path=str(filepath), full_page=True)
            log.info("audit.screenshot", url=url, path=str(filepath))
        except Exception as exc:
            log.error("audit.screenshot_failed", url=url, error=str(exc))
            filepath = None
        finally:
            await browser.close()

    return str(filepath) if filepath else None


def compute_badness_score(scores: dict, metrics: dict) -> float:
    """
    Compute a 0-100 'badness' score. Higher = worse website = better lead.

    Weights:
      - Performance: 25%
      - Mobile-friendliness: 25%
      - Design heuristics (speed, CLS): 20%
      - SEO: 15%
      - SSL: 15%
    """
    perf = 100 - (scores.get("performance") or 50)
    mobile = 0 if metrics.get("is_mobile_friendly") else 100
    ssl = 0 if metrics.get("has_ssl") else 100
    seo = 100 - (scores.get("seo") or 50)

    # Speed penalty — anything over 5s FCP is bad
    fcp = metrics.get("first_contentful_paint_ms") or 3000
    speed_penalty = min(100, (fcp / 8000) * 100)

    badness = (
        perf * 0.25
        + mobile * 0.25
        + speed_penalty * 0.20
        + seo * 0.15
        + ssl * 0.15
    )
    return round(min(100, max(0, badness)), 1)
