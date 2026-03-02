"""Project model — tracks the actual website build."""

from __future__ import annotations

import enum

from sqlalchemy import String, Enum, ForeignKey, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base, UUIDMixin, TimestampMixin


class ProjectStatus(str, enum.Enum):
    QUEUED = "queued"
    DESIGNING = "designing"
    BUILDING = "building"
    REVIEW = "review"
    REVISIONS = "revisions"
    DEPLOYING = "deploying"
    LIVE = "live"


class Project(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "projects"

    deal_id: Mapped[str] = mapped_column(ForeignKey("deals.id"))
    lead_id: Mapped[str] = mapped_column(ForeignKey("leads.id"))

    status: Mapped[ProjectStatus] = mapped_column(
        Enum(ProjectStatus), default=ProjectStatus.QUEUED
    )

    # Specs
    site_type: Mapped[str] = mapped_column(String(50), default="business")  # business, portfolio, etc.
    pages: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # {"home": {...}, "about": {...}}
    design_brief: Mapped[str | None] = mapped_column(Text, nullable=True)
    brand_colors: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    content_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Output
    github_repo: Mapped[str | None] = mapped_column(String(300), nullable=True)
    live_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    vercel_project_id: Mapped[str | None] = mapped_column(String(200), nullable=True)

    revision_count: Mapped[int] = mapped_column(default=0)
