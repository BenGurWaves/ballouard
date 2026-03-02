"""Centralized configuration loaded from environment variables."""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # LLM
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    default_model: str = "claude-sonnet-4-6"
    design_model: str = "claude-opus-4-6"

    # Lead Research
    google_maps_api_key: str = ""
    google_pagespeed_api_key: str = ""
    serpapi_key: str = ""

    # Email
    sendgrid_api_key: str = ""
    sendgrid_from_email: str = "hello@youragency.com"
    sendgrid_from_name: str = "Your Agency"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    instantly_api_key: str = ""

    # Payments
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_id: str = ""

    # Messaging
    whatsapp_phone_number_id: str = ""
    whatsapp_access_token: str = ""
    whatsapp_verify_token: str = ""
    telegram_bot_token: str = ""
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_phone_number: str = ""

    # Web Design / Deployment
    vercel_token: str = ""
    vercel_team_id: str = ""
    github_token: str = ""
    github_org: str = ""

    # Database
    database_url: str = "sqlite+aiosqlite:///./agency.db"

    # General
    agency_name: str = "YourAgencyName"
    agency_domain: str = "youragency.com"
    log_level: str = "INFO"


settings = Settings()
