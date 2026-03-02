"""Multi-channel messaging — WhatsApp, Telegram, SMS."""

from __future__ import annotations

import httpx
import structlog

from config.settings import settings

log = structlog.get_logger()


# ──────────────────────────────────────────────
# WhatsApp Business Cloud API
# ──────────────────────────────────────────────

async def send_whatsapp(to_phone: str, message: str) -> dict:
    """Send a WhatsApp message via Meta's Cloud API."""
    url = f"https://graph.facebook.com/v19.0/{settings.whatsapp_phone_number_id}/messages"
    headers = {
        "Authorization": f"Bearer {settings.whatsapp_access_token}",
        "Content-Type": "application/json",
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": to_phone,
        "type": "text",
        "text": {"body": message},
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, json=payload, headers=headers)

    if resp.status_code == 200:
        log.info("messaging.whatsapp_sent", to=to_phone)
        return {"status": "sent", "channel": "whatsapp"}
    else:
        log.error("messaging.whatsapp_error", status=resp.status_code, body=resp.text)
        raise RuntimeError(f"WhatsApp error: {resp.text}")


# ──────────────────────────────────────────────
# Telegram Bot API
# ──────────────────────────────────────────────

async def send_telegram(chat_id: str, message: str) -> dict:
    """Send a Telegram message."""
    url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": message,
        "parse_mode": "Markdown",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, json=payload)

    if resp.status_code == 200:
        log.info("messaging.telegram_sent", chat_id=chat_id)
        return {"status": "sent", "channel": "telegram"}
    else:
        log.error("messaging.telegram_error", status=resp.status_code, body=resp.text)
        raise RuntimeError(f"Telegram error: {resp.text}")


# ──────────────────────────────────────────────
# Unified send
# ──────────────────────────────────────────────

async def send_message(channel: str, recipient: str, message: str) -> dict:
    """Route a message through the appropriate channel."""
    if channel == "whatsapp":
        return await send_whatsapp(recipient, message)
    elif channel == "telegram":
        return await send_telegram(recipient, message)
    elif channel == "email":
        from services.email_sender import send_email
        return await send_email(recipient, "Update from your web agency", f"<p>{message}</p>")
    else:
        raise ValueError(f"Unknown channel: {channel}")
