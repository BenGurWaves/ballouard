"""
Agent 1 — Lead Researcher
Finds service businesses with terrible websites in target US markets.

Pipeline:
  1. Search Google Places for service businesses by category + city
  2. Get place details (website, phone, address)
  3. Audit each website (PageSpeed, SSL, mobile, design)
  4. Score and rank leads by "badness" (worse site = better lead)
  5. Extract contact emails from websites
  6. Save qualified leads to the database
"""

from __future__ import annotations

import asyncio
import re
from urllib.parse import urlparse

import httpx
import structlog
from sqlalchemy import select

from agents.base import BaseAgent
from models.lead import Lead, LeadStatus, WebsiteAudit
from services.google_maps import search_businesses, get_place_details
from services.website_auditor import run_pagespeed_audit, take_screenshot, compute_badness_score

# Service categories most likely to have bad websites
DEFAULT_CATEGORIES = [
    "plumber",
    "roofing contractor",
    "hvac contractor",
    "landscaper",
    "electrician",
    "tree service",
    "pest control",
    "fence contractor",
    "concrete contractor",
    "auto repair",
    "carpet cleaning",
    "garage door repair",
    "painter",
    "pressure washing",
    "handyman",
    "cleaning service",
]

# Mid-size US cities — often have more businesses with bad sites than major metros
DEFAULT_CITIES = [
    "Austin TX",
    "Phoenix AZ",
    "Nashville TN",
    "Charlotte NC",
    "San Antonio TX",
    "Jacksonville FL",
    "Columbus OH",
    "Indianapolis IN",
    "Fort Worth TX",
    "Memphis TN",
    "Oklahoma City OK",
    "Louisville KY",
    "Tucson AZ",
    "Raleigh NC",
    "Omaha NE",
    "Boise ID",
]

# Leads with a badness score above this threshold get queued for outreach
QUALIFICATION_THRESHOLD = 55.0


class LeadResearchAgent(BaseAgent):
    name = "lead_researcher"

    async def run(
        self,
        categories: list[str] | None = None,
        cities: list[str] | None = None,
        max_leads_per_query: int = 20,
        qualification_threshold: float = QUALIFICATION_THRESHOLD,
    ) -> dict:
        categories = categories or DEFAULT_CATEGORIES
        cities = cities or DEFAULT_CITIES

        stats = {"searched": 0, "audited": 0, "qualified": 0, "errors": 0}

        for city in cities:
            for category in categories:
                query = f"{category} in {city}"
                self.log.info("researching", query=query)

                try:
                    places = await search_businesses(query)
                except Exception as exc:
                    self.log.error("search_failed", query=query, error=str(exc))
                    stats["errors"] += 1
                    continue

                for place in places[:max_leads_per_query]:
                    stats["searched"] += 1

                    try:
                        lead = await self._process_place(
                            place, category, city, qualification_threshold
                        )
                        if lead:
                            stats["audited"] += 1
                            if lead.status == LeadStatus.QUALIFIED:
                                stats["qualified"] += 1
                    except Exception as exc:
                        self.log.error("place_failed", place=place.get("name"), error=str(exc))
                        stats["errors"] += 1

                # Be polite to APIs
                await asyncio.sleep(1)

        await self.db.commit()
        self.log.info("research_complete", **stats)
        return stats

    async def _process_place(
        self, place: dict, category: str, city: str, threshold: float
    ) -> Lead | None:
        """Process a single place: get details, audit, score, save."""

        # Get website and contact details
        details = await get_place_details(place["place_id"])
        website = details.get("website")
        if not website:
            return None

        # Skip directory/aggregator sites
        if self._is_directory(website):
            return None

        # Check if we already have this lead
        existing = await self.db.execute(
            select(Lead).where(Lead.website_url == website)
        )
        if existing.scalar_one_or_none():
            return None

        # Create lead record
        lead = Lead(
            business_name=details.get("name") or place.get("name", "Unknown"),
            business_type=category,
            website_url=website,
            phone=details.get("phone"),
            address=details.get("address"),
            city=city.split()[-1] if " " in city else city,  # Extract state abbrev
            state=city.split()[-1] if " " in city else None,
        )

        # Try to extract email from website
        email = await self._extract_email(website)
        if email:
            lead.email = email

        # Run website audit
        try:
            audit_result = await run_pagespeed_audit(website)
            scores = audit_result["scores"]
            metrics = audit_result["metrics"]

            badness = compute_badness_score(scores, metrics)

            audit = WebsiteAudit(
                performance_score=scores.get("performance"),
                accessibility_score=scores.get("accessibility"),
                seo_score=scores.get("seo"),
                best_practices_score=scores.get("best_practices"),
                is_mobile_friendly=metrics.get("is_mobile_friendly"),
                has_ssl=metrics.get("has_ssl"),
                load_time_ms=metrics.get("first_contentful_paint_ms"),
                has_modern_design=badness < 40,
                badness_score=badness,
                raw_lighthouse=audit_result.get("raw"),
            )
            lead.audit = audit
            lead.score = badness

            if badness >= threshold and lead.email:
                lead.status = LeadStatus.QUALIFIED
            else:
                lead.status = LeadStatus.AUDITED

        except Exception as exc:
            self.log.warning("audit_failed", url=website, error=str(exc))
            lead.status = LeadStatus.AUDITED

        self.db.add(lead)
        self.log.info(
            "lead_saved",
            name=lead.business_name,
            score=lead.score,
            status=lead.status.value,
            email=lead.email,
        )
        return lead

    async def _extract_email(self, url: str) -> str | None:
        """Scrape the website for contact emails."""
        emails: set[str] = set()
        ignore = {"example.com", "wixpress.com", "googleapis.com", "sentry.io", "wordpress.org"}

        pages_to_check = [url]
        async with httpx.AsyncClient(
            timeout=15,
            follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (compatible; AgencyBot/1.0)"},
        ) as client:
            # Fetch main page
            try:
                resp = await client.get(url)
                html = resp.text

                # Find contact / about page links
                contact_patterns = re.findall(
                    r'href=["\']([^"\']*(?:contact|about|reach|connect)[^"\']*)["\']',
                    html,
                    re.IGNORECASE,
                )
                for path in contact_patterns[:3]:
                    if path.startswith("http"):
                        pages_to_check.append(path)
                    elif path.startswith("/"):
                        base = f"{urlparse(url).scheme}://{urlparse(url).netloc}"
                        pages_to_check.append(f"{base}{path}")
            except Exception:
                return None

            # Scrape all pages for emails
            for page_url in pages_to_check:
                try:
                    resp = await client.get(page_url)
                    found = re.findall(
                        r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}",
                        resp.text,
                    )
                    for email in found:
                        domain = email.split("@")[1].lower()
                        if domain not in ignore and not domain.endswith((".png", ".jpg", ".js")):
                            emails.add(email.lower())

                    # Also check mailto: links
                    mailto_matches = re.findall(r'mailto:([^"\'?\s]+)', resp.text)
                    for m in mailto_matches:
                        emails.add(m.lower())
                except Exception:
                    continue

        return next(iter(emails), None)

    @staticmethod
    def _is_directory(url: str) -> bool:
        """Filter out aggregator/directory sites that aren't the actual business."""
        directory_domains = {
            "yelp.com", "yellowpages.com", "bbb.org", "angieslist.com",
            "homeadvisor.com", "thumbtack.com", "nextdoor.com",
            "facebook.com", "google.com", "mapquest.com",
        }
        domain = urlparse(url).netloc.lower().replace("www.", "")
        return any(d in domain for d in directory_domains)
