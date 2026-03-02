"""Stripe payment handling — invoice creation and webhook processing."""

from __future__ import annotations

import stripe
import structlog

from config.settings import settings

log = structlog.get_logger()


def _init_stripe() -> None:
    stripe.api_key = settings.stripe_secret_key


async def create_invoice(
    customer_email: str,
    customer_name: str,
    amount_cents: int,
    description: str,
    currency: str = "usd",
) -> dict:
    """
    Create and send a Stripe invoice.
    Returns {"invoice_id": ..., "hosted_url": ..., "status": ...}
    """
    _init_stripe()

    # Find or create customer
    customers = stripe.Customer.list(email=customer_email, limit=1)
    if customers.data:
        customer = customers.data[0]
    else:
        customer = stripe.Customer.create(
            email=customer_email,
            name=customer_name,
        )

    # Create invoice
    invoice = stripe.Invoice.create(
        customer=customer.id,
        collection_method="send_invoice",
        days_until_due=7,
        auto_advance=True,
    )

    # Add line item
    stripe.InvoiceItem.create(
        customer=customer.id,
        invoice=invoice.id,
        amount=amount_cents,
        currency=currency,
        description=description,
    )

    # Finalize and send
    invoice = stripe.Invoice.finalize_invoice(invoice.id)
    stripe.Invoice.send_invoice(invoice.id)

    log.info(
        "payments.invoice_sent",
        invoice_id=invoice.id,
        customer=customer_email,
        amount=amount_cents,
    )

    return {
        "invoice_id": invoice.id,
        "hosted_url": invoice.hosted_invoice_url,
        "status": invoice.status,
    }


def verify_webhook(payload: bytes, sig_header: str) -> dict:
    """Verify and parse a Stripe webhook event."""
    _init_stripe()
    event = stripe.Webhook.construct_event(
        payload, sig_header, settings.stripe_webhook_secret
    )
    return {
        "type": event.type,
        "data": event.data.object,
    }
