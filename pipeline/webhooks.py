"""
Webhook handlers for inbound events.

In production, these would be mounted on a web framework (FastAPI, Flask).
For now, they're standalone async functions that the orchestrator can call.

Supported webhooks:
  - Stripe: payment confirmations
  - SendGrid: inbound email parsing (replies)
  - WhatsApp: incoming messages
  - Telegram: incoming messages
"""

from __future__ import annotations

import json

import structlog
from sqlalchemy import select

from models.database import async_session
from models.lead import Lead
from agents.sales import SalesAgent
from agents.client_success import ClientSuccessAgent
from services.payments import verify_webhook

log = structlog.get_logger()


async def handle_stripe_webhook(payload: bytes, sig_header: str) -> dict:
    """Process Stripe payment webhook."""
    event = verify_webhook(payload, sig_header)

    if event["type"] == "invoice.paid":
        invoice = event["data"]
        customer_email = invoice.get("customer_email")

        async with async_session() as session:
            result = await session.execute(
                select(Lead).where(Lead.email == customer_email)
            )
            lead = result.scalar_one_or_none()

            if lead:
                sales = SalesAgent(session)
                await sales.handle_payment_received(
                    lead.id,
                    invoice.get("payment_intent", ""),
                )
                log.info("webhook.stripe_paid", lead=lead.business_name)
                return {"status": "processed", "lead_id": lead.id}

    return {"status": "ignored", "event_type": event["type"]}


async def handle_inbound_email(sender_email: str, subject: str, body: str) -> dict:
    """
    Process inbound email reply (via SendGrid Inbound Parse or similar).
    """
    async with async_session() as session:
        result = await session.execute(
            select(Lead).where(Lead.email == sender_email)
        )
        lead = result.scalar_one_or_none()

        if not lead:
            log.warning("webhook.unknown_sender", email=sender_email)
            return {"status": "unknown_sender"}

        sales = SalesAgent(session)
        intent = await sales.process_reply(lead.id, body)

        log.info("webhook.email_reply", lead=lead.business_name, intent=intent)
        return {"status": "processed", "intent": intent, "lead_id": lead.id}


async def handle_whatsapp_message(phone: str, message: str) -> dict:
    """Process incoming WhatsApp message."""
    async with async_session() as session:
        result = await session.execute(
            select(Lead).where(Lead.phone == phone)
        )
        lead = result.scalar_one_or_none()

        if not lead:
            log.warning("webhook.unknown_phone", phone=phone)
            return {"status": "unknown_sender"}

        cs = ClientSuccessAgent(session)
        response = await cs.handle_client_message(lead.id, message, "whatsapp")

        return {"status": "processed", "response": response}


async def handle_telegram_message(chat_id: str, message: str) -> dict:
    """Process incoming Telegram message."""
    async with async_session() as session:
        # Telegram chat IDs would be stored when client provides their Telegram
        # For now, try to match by looking up a lead with this chat_id in notes
        result = await session.execute(
            select(Lead).where(Lead.notes.contains(chat_id))
        )
        lead = result.scalar_one_or_none()

        if not lead:
            log.warning("webhook.unknown_telegram", chat_id=chat_id)
            return {"status": "unknown_sender"}

        cs = ClientSuccessAgent(session)
        response = await cs.handle_client_message(lead.id, message, "telegram")

        return {"status": "processed", "response": response}
