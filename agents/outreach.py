"""
Agent 2 — Outreach Agent
Sends personalized cold emails to qualified leads using a 3-step cadence.

Pipeline:
  1. Pull qualified leads from the DB
  2. Generate personalized issue list using LLM (based on audit data)
  3. Send Email 1 (blurred preview + issues)
  4. After 3 days → Email 2 (follow-up)
  5. After 7 more days → Email 3 (breakup)
  6. Monitor for replies → trigger demo send

Compliance:
  - CAN-SPAM: physical address, unsubscribe, honest subject
  - Max 50 emails/day (warm-up period)
  - Minimum 3 days between touches
"""

from __future__ import annotations

import random
from datetime import datetime, timezone, timedelta

from sqlalchemy import select

from agents.base import BaseAgent
from models.lead import Lead, LeadStatus
from models.message import Message, MessageChannel
from services.email_sender import send_email
from templates.emails import (
    INITIAL_SUBJECT_LINES,
    INITIAL_EMAIL_PLAIN,
    INITIAL_EMAIL_HTML,
    FOLLOWUP_SUBJECT_LINES,
    FOLLOWUP_EMAIL_PLAIN,
    FOLLOWUP_EMAIL_HTML,
    BREAKUP_SUBJECT_LINES,
    BREAKUP_EMAIL_PLAIN,
    BREAKUP_EMAIL_HTML,
    CAN_SPAM_FOOTER,
    format_issues_list,
    format_issues_html,
)
from config.settings import settings

# Sending limits during warmup
DAILY_SEND_LIMIT = 50
DAYS_BETWEEN_EMAILS = 3
BREAKUP_DELAY_DAYS = 7


class OutreachAgent(BaseAgent):
    name = "outreach"

    async def run(
        self,
        daily_limit: int = DAILY_SEND_LIMIT,
    ) -> dict:
        stats = {"initial_sent": 0, "followups_sent": 0, "breakups_sent": 0, "errors": 0}
        sent_today = 0

        # 1. Send initial emails to qualified leads that haven't been contacted
        qualified = await self._get_leads_by_status(LeadStatus.QUALIFIED)
        for lead in qualified:
            if sent_today >= daily_limit:
                break
            try:
                await self._send_initial(lead)
                stats["initial_sent"] += 1
                sent_today += 1
            except Exception as exc:
                self.log.error("initial_send_failed", lead=lead.business_name, error=str(exc))
                stats["errors"] += 1

        # 2. Send follow-ups to leads contacted 3+ days ago with no reply
        contacted = await self._get_leads_by_status(LeadStatus.CONTACTED)
        for lead in contacted:
            if sent_today >= daily_limit:
                break
            if not self._ready_for_followup(lead, DAYS_BETWEEN_EMAILS):
                continue
            try:
                await self._send_followup(lead)
                stats["followups_sent"] += 1
                sent_today += 1
            except Exception as exc:
                self.log.error("followup_failed", lead=lead.business_name, error=str(exc))
                stats["errors"] += 1

        # 3. Send breakup emails to leads followed up 7+ days ago
        for lead in contacted:
            if sent_today >= daily_limit:
                break
            if lead.outreach_count < 2:
                continue
            if not self._ready_for_followup(lead, BREAKUP_DELAY_DAYS):
                continue
            try:
                await self._send_breakup(lead)
                stats["breakups_sent"] += 1
                sent_today += 1
            except Exception as exc:
                self.log.error("breakup_failed", lead=lead.business_name, error=str(exc))
                stats["errors"] += 1

        await self.db.commit()
        self.log.info("outreach_complete", **stats)
        return stats

    async def _send_initial(self, lead: Lead) -> None:
        """Send the first cold email with blurred preview."""
        issues = await self._generate_issues(lead)
        first_name = self._get_first_name(lead)

        ctx = {
            "first_name": first_name,
            "business_name": lead.business_name,
            "business_type": lead.business_type,
            "city": lead.city or "your area",
            "preview_link": f"https://{settings.agency_domain}/preview/{lead.id}",
            "issues_list": format_issues_list(issues),
            "issues_html": format_issues_html(issues),
            "sender_name": settings.sendgrid_from_name,
            "agency_name": settings.agency_name,
            "unsubscribe_line": CAN_SPAM_FOOTER.format(
                agency_name=settings.agency_name,
                agency_address="123 Agency St, Suite 100, Austin TX 78701",
            ),
        }

        subject = random.choice(INITIAL_SUBJECT_LINES).format(**ctx)
        plain = INITIAL_EMAIL_PLAIN.format(**ctx)
        html = INITIAL_EMAIL_HTML.format(**ctx)

        await send_email(lead.email, subject, html, plain)

        # Log the message
        msg = Message(
            lead_id=lead.id,
            channel=MessageChannel.EMAIL,
            direction="outbound",
            subject=subject,
            body=plain,
            recipient=lead.email,
            agent_name=self.name,
            template_name="initial_cold_email",
        )
        self.db.add(msg)

        lead.status = LeadStatus.CONTACTED
        lead.outreach_count += 1
        lead.last_outreach_at = datetime.now(timezone.utc).isoformat()

        self.log.info("initial_sent", lead=lead.business_name, email=lead.email)

    async def _send_followup(self, lead: Lead) -> None:
        """Send follow-up email."""
        first_name = self._get_first_name(lead)
        ctx = {
            "first_name": first_name,
            "business_name": lead.business_name,
            "preview_link": f"https://{settings.agency_domain}/preview/{lead.id}",
            "sender_name": settings.sendgrid_from_name,
            "unsubscribe_line": CAN_SPAM_FOOTER.format(
                agency_name=settings.agency_name,
                agency_address="123 Agency St, Suite 100, Austin TX 78701",
            ),
        }

        subject = random.choice(FOLLOWUP_SUBJECT_LINES).format(**ctx)
        plain = FOLLOWUP_EMAIL_PLAIN.format(**ctx)
        html = FOLLOWUP_EMAIL_HTML.format(**ctx)

        await send_email(lead.email, subject, html, plain)

        msg = Message(
            lead_id=lead.id,
            channel=MessageChannel.EMAIL,
            direction="outbound",
            subject=subject,
            body=plain,
            recipient=lead.email,
            agent_name=self.name,
            template_name="followup_email",
        )
        self.db.add(msg)

        lead.outreach_count += 1
        lead.last_outreach_at = datetime.now(timezone.utc).isoformat()

    async def _send_breakup(self, lead: Lead) -> None:
        """Send final breakup email."""
        first_name = self._get_first_name(lead)
        ctx = {
            "first_name": first_name,
            "business_name": lead.business_name,
            "sender_name": settings.sendgrid_from_name,
            "unsubscribe_line": CAN_SPAM_FOOTER.format(
                agency_name=settings.agency_name,
                agency_address="123 Agency St, Suite 100, Austin TX 78701",
            ),
        }

        subject = random.choice(BREAKUP_SUBJECT_LINES).format(**ctx)
        plain = BREAKUP_EMAIL_PLAIN.format(**ctx)
        html = BREAKUP_EMAIL_HTML.format(**ctx)

        await send_email(lead.email, subject, html, plain)

        msg = Message(
            lead_id=lead.id,
            channel=MessageChannel.EMAIL,
            direction="outbound",
            subject=subject,
            body=plain,
            recipient=lead.email,
            agent_name=self.name,
            template_name="breakup_email",
        )
        self.db.add(msg)

        lead.outreach_count += 1
        lead.last_outreach_at = datetime.now(timezone.utc).isoformat()

        # Mark as lost if they never replied after breakup
        lead.status = LeadStatus.LOST

    async def _generate_issues(self, lead: Lead) -> list[str]:
        """Use LLM to generate personalized issue descriptions from audit data."""
        audit = lead.audit
        if not audit:
            return ["Your site could load faster on mobile", "The design feels a bit dated"]

        prompt = f"""Based on this website audit for a {lead.business_type} business called "{lead.business_name}":
- Performance score: {audit.performance_score}/100
- Mobile-friendly: {audit.is_mobile_friendly}
- Has SSL: {audit.has_ssl}
- Load time: {audit.load_time_ms}ms
- SEO score: {audit.seo_score}/100

Generate exactly 3 short, specific, non-technical issue descriptions that a business owner would understand.
Each should be one sentence, conversational, and focused on lost revenue or missed customers.
Return just the 3 issues, one per line, no bullets or numbers."""

        response = await self.think(
            system="You are a web design consultant writing personalized website feedback for small business owners. Be direct, specific, and focus on business impact.",
            user_message=prompt,
        )
        issues = [line.strip() for line in response.strip().split("\n") if line.strip()]
        return issues[:3]

    async def _get_leads_by_status(self, status: LeadStatus) -> list[Lead]:
        result = await self.db.execute(
            select(Lead).where(Lead.status == status).limit(100)
        )
        return list(result.scalars().all())

    @staticmethod
    def _get_first_name(lead: Lead) -> str:
        if lead.contact_name:
            return lead.contact_name.split()[0]
        return "there"

    @staticmethod
    def _ready_for_followup(lead: Lead, min_days: int) -> bool:
        if not lead.last_outreach_at:
            return False
        last = datetime.fromisoformat(lead.last_outreach_at)
        return datetime.now(timezone.utc) - last >= timedelta(days=min_days)
