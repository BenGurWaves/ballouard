"""
Agent 4 — Sales Agent
Handles the closing pipeline: detects replies, sends demos, generates invoices.

Pipeline:
  1. Monitor for incoming email replies (via webhook or polling)
  2. Classify reply intent using LLM (interested, not interested, question)
  3. If positive → send full demo email
  4. If they want to proceed → create Stripe invoice
  5. On payment confirmed → move lead to IN_BUILD, trigger Web Design Agent
"""

from __future__ import annotations

from sqlalchemy import select

from agents.base import BaseAgent
from models.lead import Lead, LeadStatus
from models.deal import Deal, DealStage
from models.message import Message, MessageChannel
from services.email_sender import send_email
from services.payments import create_invoice
from templates.emails import (
    DEMO_SUBJECT_LINES,
    DEMO_EMAIL_PLAIN,
    DEMO_EMAIL_HTML,
    CAN_SPAM_FOOTER,
)
from config.settings import settings
import random


# Default pricing packages (cents)
PACKAGES = {
    "starter": {"name": "Starter", "price_cents": 99_700, "description": "5-page custom website with hosting"},
    "professional": {"name": "Professional", "price_cents": 199_700, "description": "Multi-page site with blog, SEO, and 60 days support"},
    "premium": {"name": "Premium", "price_cents": 349_700, "description": "Full custom build, blog, booking system, and 90 days support"},
}


class SalesAgent(BaseAgent):
    name = "sales"

    async def run(self) -> dict:
        stats = {"demos_sent": 0, "invoices_sent": 0, "payments_confirmed": 0, "errors": 0}

        # Process leads that replied positively — send demo
        replied_leads = await self._get_leads_by_status(LeadStatus.REPLIED)
        for lead in replied_leads:
            try:
                await self._send_demo(lead)
                stats["demos_sent"] += 1
            except Exception as exc:
                self.log.error("demo_send_failed", lead=lead.business_name, error=str(exc))
                stats["errors"] += 1

        # Process leads that want to proceed — send invoice
        interested_leads = await self._get_leads_by_status(LeadStatus.INTERESTED)
        for lead in interested_leads:
            try:
                await self._send_invoice(lead)
                stats["invoices_sent"] += 1
            except Exception as exc:
                self.log.error("invoice_failed", lead=lead.business_name, error=str(exc))
                stats["errors"] += 1

        await self.db.commit()
        self.log.info("sales_run_complete", **stats)
        return stats

    async def process_reply(self, lead_id: str, reply_text: str) -> str:
        """
        Classify an incoming reply and take appropriate action.
        Returns the classification: 'positive', 'negative', 'question', 'unsubscribe'
        """
        intent = await self._classify_reply(reply_text)

        result = await self.db.execute(select(Lead).where(Lead.id == lead_id))
        lead = result.scalar_one()

        if intent == "positive":
            lead.status = LeadStatus.REPLIED
            self.log.info("reply_positive", lead=lead.business_name)
        elif intent == "wants_to_buy":
            lead.status = LeadStatus.INTERESTED
            self.log.info("reply_interested", lead=lead.business_name)
        elif intent == "negative":
            lead.status = LeadStatus.LOST
            self.log.info("reply_negative", lead=lead.business_name)
        elif intent == "unsubscribe":
            lead.status = LeadStatus.LOST
            self.log.info("reply_unsubscribe", lead=lead.business_name)
        elif intent == "question":
            # Route to client success agent for human-like response
            lead.status = LeadStatus.REPLIED
            self.log.info("reply_question", lead=lead.business_name)

        # Log the inbound message
        msg = Message(
            lead_id=lead.id,
            channel=MessageChannel.EMAIL,
            direction="inbound",
            body=reply_text,
            sender=lead.email,
            replied=True,
            agent_name=self.name,
        )
        self.db.add(msg)
        await self.db.commit()

        return intent

    async def handle_payment_received(self, lead_id: str, stripe_payment_intent_id: str) -> None:
        """Called when Stripe webhook confirms payment."""
        result = await self.db.execute(select(Lead).where(Lead.id == lead_id))
        lead = result.scalar_one()

        lead.status = LeadStatus.PAID

        # Update deal
        deal_result = await self.db.execute(
            select(Deal).where(Deal.lead_id == lead_id).order_by(Deal.created_at.desc())
        )
        deal = deal_result.scalar_one_or_none()
        if deal:
            deal.stage = DealStage.PAID
            deal.stripe_payment_intent_id = stripe_payment_intent_id

        await self.db.commit()
        self.log.info("payment_received", lead=lead.business_name)

    async def _send_demo(self, lead: Lead) -> None:
        """Send the full (unblurred) demo to a lead who replied positively."""
        # Get the deal with the demo URL
        deal_result = await self.db.execute(
            select(Deal).where(Deal.lead_id == lead.id).order_by(Deal.created_at.desc())
        )
        deal = deal_result.scalar_one_or_none()
        demo_url = deal.demo_url if deal else f"https://{settings.agency_domain}/demo/{lead.id}"

        first_name = lead.contact_name.split()[0] if lead.contact_name else "there"
        highlights = await self._generate_highlights(lead)

        ctx = {
            "first_name": first_name,
            "business_name": lead.business_name,
            "demo_link": demo_url,
            "highlights_list": "\n".join(f"  • {h}" for h in highlights),
            "highlights_html": "<ul>" + "".join(f"<li>{h}</li>" for h in highlights) + "</ul>",
            "sender_name": settings.sendgrid_from_name,
            "agency_name": settings.agency_name,
            "unsubscribe_line": CAN_SPAM_FOOTER.format(
                agency_name=settings.agency_name,
                agency_address="123 Agency St, Suite 100, Austin TX 78701",
            ),
        }

        subject = random.choice(DEMO_SUBJECT_LINES).format(**ctx)
        plain = DEMO_EMAIL_PLAIN.format(**ctx)
        html = DEMO_EMAIL_HTML.format(**ctx)

        await send_email(lead.email, subject, html, plain)

        lead.status = LeadStatus.DEMO_SENT
        if deal:
            deal.stage = DealStage.DEMO_SENT

        msg = Message(
            lead_id=lead.id,
            channel=MessageChannel.EMAIL,
            direction="outbound",
            subject=subject,
            body=plain,
            recipient=lead.email,
            agent_name=self.name,
            template_name="demo_reveal",
        )
        self.db.add(msg)

    async def _send_invoice(self, lead: Lead, package: str = "professional") -> None:
        """Create and send a Stripe invoice."""
        pkg = PACKAGES.get(package, PACKAGES["professional"])

        invoice = await create_invoice(
            customer_email=lead.email,
            customer_name=lead.contact_name or lead.business_name,
            amount_cents=pkg["price_cents"],
            description=f"{pkg['name']} Website Package — {lead.business_name}",
        )

        # Update deal
        deal_result = await self.db.execute(
            select(Deal).where(Deal.lead_id == lead.id).order_by(Deal.created_at.desc())
        )
        deal = deal_result.scalar_one_or_none()
        if deal:
            deal.stage = DealStage.INVOICE_SENT
            deal.stripe_invoice_id = invoice["invoice_id"]
            deal.package_name = pkg["name"]
            deal.price_cents = pkg["price_cents"]

        lead.status = LeadStatus.INVOICE_SENT

        self.log.info(
            "invoice_sent",
            lead=lead.business_name,
            amount=pkg["price_cents"],
            invoice_url=invoice["hosted_url"],
        )

    async def _classify_reply(self, reply_text: str) -> str:
        """Use LLM to classify the intent of a reply."""
        response = await self.think(
            system="""You classify email replies into exactly one category.
Reply with ONLY the category name, nothing else.

Categories:
- positive: They want to see the full design/demo
- wants_to_buy: They explicitly want to proceed/buy/move forward
- negative: They're not interested
- question: They have a question but haven't decided
- unsubscribe: They want to stop receiving emails""",
            user_message=f"Classify this reply:\n\n{reply_text}",
            temperature=0.0,
        )
        intent = response.strip().lower()
        valid = {"positive", "wants_to_buy", "negative", "question", "unsubscribe"}
        return intent if intent in valid else "question"

    async def _generate_highlights(self, lead: Lead) -> list[str]:
        """Generate personalized design highlights for the demo email."""
        response = await self.think(
            system="You are a web designer presenting a new design to a client. Be specific and enthusiastic.",
            user_message=f"""Generate 4 short highlight bullet points for a redesigned website for:
Business: {lead.business_name}
Type: {lead.business_type}

Focus on specific improvements that would matter to this business owner.
Output just the 4 bullets, one per line, no numbers or dashes.""",
        )
        highlights = [line.strip() for line in response.strip().split("\n") if line.strip()]
        return highlights[:4]

    async def _get_leads_by_status(self, status: LeadStatus) -> list[Lead]:
        result = await self.db.execute(
            select(Lead).where(Lead.status == status).limit(50)
        )
        return list(result.scalars().all())
