"""Lead and website audit models."""

from __future__ import annotations

import enum

from sqlalchemy import String, Text, Float, Integer, Boolean, Enum, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base, UUIDMixin, TimestampMixin


class LeadStatus(str, enum.Enum):
    DISCOVERED = "discovered"          # Found via search
    AUDITED = "audited"                # Website has been scored
    QUALIFIED = "qualified"            # Score meets threshold — ready for outreach
    CONTACTED = "contacted"            # First email sent
    REPLIED = "replied"                # Lead replied
    PREVIEW_SENT = "preview_sent"      # Blurred preview sent
    DEMO_SENT = "demo_sent"            # Full demo sent
    INTERESTED = "interested"          # Wants to proceed
    INVOICE_SENT = "invoice_sent"      # Stripe invoice sent
    PAID = "paid"                      # Payment received
    IN_BUILD = "in_build"              # Website being built
    DELIVERED = "delivered"            # Website handed over
    LOST = "lost"                      # Lead went cold or declined


class Lead(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "leads"

    # Business info
    business_name: Mapped[str] = mapped_column(String(300))
    business_type: Mapped[str] = mapped_column(String(100))  # e.g. "plumber", "roofer"
    website_url: Mapped[str] = mapped_column(String(500))
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    email: Mapped[str | None] = mapped_column(String(300), nullable=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    state: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Contact person
    contact_name: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # Pipeline
    status: Mapped[LeadStatus] = mapped_column(
        Enum(LeadStatus), default=LeadStatus.DISCOVERED
    )
    score: Mapped[float | None] = mapped_column(Float, nullable=True)  # 0-100 quality score
    outreach_count: Mapped[int] = mapped_column(Integer, default=0)
    last_outreach_at: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Preferred channel
    preferred_channel: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Relationships
    audit: Mapped[WebsiteAudit | None] = relationship(back_populates="lead", uselist=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class WebsiteAudit(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "website_audits"

    lead_id: Mapped[str] = mapped_column(ForeignKey("leads.id"))

    # PageSpeed / Lighthouse scores (0-100)
    performance_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    accessibility_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    seo_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    best_practices_score: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Specific issues
    is_mobile_friendly: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    has_ssl: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    load_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    broken_links_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    has_modern_design: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    uses_outdated_tech: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    # Raw data
    raw_lighthouse: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    screenshot_path: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Computed overall "badness" score (higher = worse website = better lead)
    badness_score: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Relationship
    lead: Mapped[Lead] = relationship(back_populates="audit")
