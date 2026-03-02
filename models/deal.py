"""Deal / sales pipeline model."""

from __future__ import annotations

import enum

from sqlalchemy import String, Float, Enum, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base, UUIDMixin, TimestampMixin


class DealStage(str, enum.Enum):
    PROPOSAL = "proposal"
    PREVIEW_SENT = "preview_sent"
    DEMO_SENT = "demo_sent"
    NEGOTIATION = "negotiation"
    INVOICE_SENT = "invoice_sent"
    PAID = "paid"
    CLOSED_WON = "closed_won"
    CLOSED_LOST = "closed_lost"


class Deal(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "deals"

    lead_id: Mapped[str] = mapped_column(ForeignKey("leads.id"))
    stage: Mapped[DealStage] = mapped_column(Enum(DealStage), default=DealStage.PROPOSAL)

    # Pricing
    package_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    price_cents: Mapped[int | None] = mapped_column(nullable=True)  # in cents
    currency: Mapped[str] = mapped_column(String(3), default="USD")

    # Stripe
    stripe_invoice_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    stripe_payment_intent_id: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # Preview / demo
    preview_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    demo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
