"""Message log — tracks all communications across channels."""

from __future__ import annotations

import enum

from sqlalchemy import String, Text, Enum, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base, UUIDMixin, TimestampMixin


class MessageChannel(str, enum.Enum):
    EMAIL = "email"
    WHATSAPP = "whatsapp"
    TELEGRAM = "telegram"
    SMS = "sms"


class Message(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "messages"

    lead_id: Mapped[str] = mapped_column(ForeignKey("leads.id"))
    channel: Mapped[MessageChannel] = mapped_column(Enum(MessageChannel))
    direction: Mapped[str] = mapped_column(String(10))  # "outbound" or "inbound"

    subject: Mapped[str | None] = mapped_column(String(500), nullable=True)
    body: Mapped[str] = mapped_column(Text)
    recipient: Mapped[str | None] = mapped_column(String(300), nullable=True)
    sender: Mapped[str | None] = mapped_column(String(300), nullable=True)

    # Tracking
    opened: Mapped[bool] = mapped_column(Boolean, default=False)
    clicked: Mapped[bool] = mapped_column(Boolean, default=False)
    replied: Mapped[bool] = mapped_column(Boolean, default=False)

    # Which agent sent this
    agent_name: Mapped[str | None] = mapped_column(String(50), nullable=True)
    template_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
