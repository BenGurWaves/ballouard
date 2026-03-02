"""
Agent 3 — Design Preview Agent
Generates blurred preview mockups of redesigned websites.

Pipeline:
  1. Take a screenshot of the lead's current website
  2. Use LLM to analyze the current site and generate a design brief
  3. Generate an HTML mockup of the redesigned site
  4. Render the mockup to an image via Playwright
  5. Apply a gaussian blur to create the "teaser" preview
  6. Save both full and blurred versions
"""

from __future__ import annotations

import os
from pathlib import Path

import structlog
from sqlalchemy import select

from agents.base import BaseAgent
from models.lead import Lead, LeadStatus
from models.deal import Deal, DealStage
from services.website_auditor import take_screenshot
from config.settings import settings

PREVIEW_DIR = Path("previews")
FULL_DIR = PREVIEW_DIR / "full"
BLURRED_DIR = PREVIEW_DIR / "blurred"


class DesignPreviewAgent(BaseAgent):
    name = "design_preview"

    async def run(self, lead_id: str | None = None) -> dict:
        """Generate previews for qualified leads or a specific lead."""
        stats = {"generated": 0, "errors": 0}

        if lead_id:
            result = await self.db.execute(select(Lead).where(Lead.id == lead_id))
            leads = [result.scalar_one()]
        else:
            result = await self.db.execute(
                select(Lead).where(
                    Lead.status.in_([LeadStatus.QUALIFIED, LeadStatus.CONTACTED])
                ).limit(10)
            )
            leads = list(result.scalars().all())

        for lead in leads:
            try:
                await self._generate_preview(lead)
                stats["generated"] += 1
            except Exception as exc:
                self.log.error("preview_failed", lead=lead.business_name, error=str(exc))
                stats["errors"] += 1

        await self.db.commit()
        self.log.info("previews_complete", **stats)
        return stats

    async def _generate_preview(self, lead: Lead) -> None:
        """Generate both blurred preview and full mockup for a lead."""
        FULL_DIR.mkdir(parents=True, exist_ok=True)
        BLURRED_DIR.mkdir(parents=True, exist_ok=True)

        # Step 1: Screenshot the current site
        self.log.info("screenshot_current", lead=lead.business_name, url=lead.website_url)
        current_screenshot = await take_screenshot(lead.website_url, f"current_{lead.id}")

        # Step 2: Generate a design brief using LLM
        design_brief = await self._generate_design_brief(lead)

        # Step 3: Generate HTML mockup using LLM
        mockup_html = await self._generate_mockup_html(lead, design_brief)

        # Save mockup HTML
        mockup_path = FULL_DIR / f"mockup_{lead.id}.html"
        mockup_path.write_text(mockup_html, encoding="utf-8")

        # Step 4: Render mockup to image
        full_screenshot = await self._render_html_to_image(
            str(mockup_path), f"full_{lead.id}"
        )

        # Step 5: Create blurred version
        if full_screenshot:
            blurred_path = await self._blur_image(full_screenshot, lead.id)
        else:
            blurred_path = None

        # Step 6: Create or update deal with preview URLs
        deal = Deal(
            lead_id=lead.id,
            stage=DealStage.PREVIEW_SENT,
            preview_url=str(blurred_path) if blurred_path else None,
            demo_url=str(mockup_path),
        )
        self.db.add(deal)

        self.log.info(
            "preview_generated",
            lead=lead.business_name,
            full=str(mockup_path),
            blurred=str(blurred_path),
        )

    async def _generate_design_brief(self, lead: Lead) -> str:
        """Use LLM to analyze the current site and create a design brief."""
        audit_info = ""
        if lead.audit:
            audit_info = f"""
Current site audit:
- Performance: {lead.audit.performance_score}/100
- Mobile friendly: {lead.audit.is_mobile_friendly}
- SSL: {lead.audit.has_ssl}
- Load time: {lead.audit.load_time_ms}ms
"""

        return await self.think(
            system="""You are an expert web designer specializing in modern websites for local service businesses.
Generate a concise design brief for a website redesign. Focus on:
- Modern, clean layout with clear CTAs
- Mobile-first responsive design
- Trust signals (reviews, certifications, before/after photos)
- Clear service areas and contact information
- Fast, lightweight design""",
            user_message=f"""Create a design brief for redesigning the website of:
Business: {lead.business_name}
Type: {lead.business_type}
Location: {lead.city}, {lead.state}
Current URL: {lead.website_url}
{audit_info}

Output a brief covering: color scheme, layout structure, key sections, and primary CTA.""",
            model=settings.design_model,
        )

    async def _generate_mockup_html(self, lead: Lead, design_brief: str) -> str:
        """Use LLM to generate a complete HTML/CSS mockup."""
        return await self.think(
            system="""You are an expert frontend developer. Generate a complete, self-contained HTML page with inline CSS.
Requirements:
- Modern design with a professional color scheme
- Fully responsive (mobile-first)
- Use system fonts (no external dependencies)
- Include realistic placeholder content for this specific business
- Hero section with strong CTA
- Services section
- Trust/testimonials section
- Contact section with phone and address
- Clean footer
- No JavaScript needed — this is a static preview
Output ONLY the HTML code, nothing else.""",
            user_message=f"""Generate a complete HTML mockup for:
Business: {lead.business_name}
Type: {lead.business_type}
Location: {lead.city}, {lead.state}
Phone: {lead.phone or 'N/A'}

Design Brief:
{design_brief}

Generate realistic, industry-specific content. Make it look like a real, polished website.""",
            model=settings.design_model,
            max_tokens=8192,
        )

    async def _render_html_to_image(self, html_path: str, output_name: str) -> str | None:
        """Render an HTML file to a PNG screenshot using Playwright."""
        try:
            from playwright.async_api import async_playwright
        except ImportError:
            self.log.warning("playwright_not_installed", msg="Skipping render")
            return None

        filepath = FULL_DIR / f"{output_name}.png"

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page(viewport={"width": 1280, "height": 900})
            try:
                await page.goto(f"file://{os.path.abspath(html_path)}", wait_until="networkidle")
                await page.screenshot(path=str(filepath), full_page=True)
            finally:
                await browser.close()

        return str(filepath)

    async def _blur_image(self, image_path: str, lead_id: str) -> str | None:
        """Apply gaussian blur to create a teaser preview."""
        try:
            from PIL import Image, ImageFilter
        except ImportError:
            self.log.warning("pillow_not_installed", msg="Skipping blur")
            return None

        output_path = BLURRED_DIR / f"blurred_{lead_id}.png"
        img = Image.open(image_path)

        # Heavy blur — enough to see the layout but not read text
        blurred = img.filter(ImageFilter.GaussianBlur(radius=12))

        # Crop to just the top portion (above-the-fold teaser)
        width, height = blurred.size
        crop_height = min(height, int(width * 0.75))  # 4:3 aspect ratio
        blurred = blurred.crop((0, 0, width, crop_height))

        blurred.save(str(output_path), quality=85)
        return str(output_path)
