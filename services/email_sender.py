"""Email sending via SendGrid or SMTP fallback."""

from __future__ import annotations

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx
import structlog

from config.settings import settings

log = structlog.get_logger()


async def send_email(
    to_email: str,
    subject: str,
    html_body: str,
    plain_body: str | None = None,
    reply_to: str | None = None,
) -> dict:
    """
    Send an email via SendGrid API.
    Falls back to SMTP if SendGrid key is not configured.
    Returns {"status": "sent", "method": "sendgrid"|"smtp"} or raises.
    """
    if settings.sendgrid_api_key:
        return await _send_sendgrid(to_email, subject, html_body, plain_body, reply_to)
    elif settings.smtp_host:
        return _send_smtp(to_email, subject, html_body, plain_body, reply_to)
    else:
        log.error("email.no_provider", msg="Neither SendGrid nor SMTP is configured")
        raise RuntimeError("No email provider configured. Set SENDGRID_API_KEY or SMTP_HOST.")


async def _send_sendgrid(
    to_email: str,
    subject: str,
    html_body: str,
    plain_body: str | None,
    reply_to: str | None,
) -> dict:
    payload: dict = {
        "personalizations": [{"to": [{"email": to_email}]}],
        "from": {
            "email": settings.sendgrid_from_email,
            "name": settings.sendgrid_from_name,
        },
        "subject": subject,
        "content": [],
    }

    if plain_body:
        payload["content"].append({"type": "text/plain", "value": plain_body})
    payload["content"].append({"type": "text/html", "value": html_body})

    if reply_to:
        payload["reply_to"] = {"email": reply_to}

    headers = {
        "Authorization": f"Bearer {settings.sendgrid_api_key}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.sendgrid.com/v3/mail/send",
            json=payload,
            headers=headers,
        )

    if resp.status_code in (200, 201, 202):
        log.info("email.sent", to=to_email, subject=subject, method="sendgrid")
        return {"status": "sent", "method": "sendgrid"}
    else:
        log.error("email.sendgrid_error", status=resp.status_code, body=resp.text)
        raise RuntimeError(f"SendGrid error {resp.status_code}: {resp.text}")


def _send_smtp(
    to_email: str,
    subject: str,
    html_body: str,
    plain_body: str | None,
    reply_to: str | None,
) -> dict:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.sendgrid_from_name} <{settings.sendgrid_from_email}>"
    msg["To"] = to_email
    if reply_to:
        msg["Reply-To"] = reply_to

    if plain_body:
        msg.attach(MIMEText(plain_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
        server.starttls()
        server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(msg)

    log.info("email.sent", to=to_email, subject=subject, method="smtp")
    return {"status": "sent", "method": "smtp"}
