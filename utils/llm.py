"""Unified LLM interface — wraps Anthropic Claude for all agent calls."""

from __future__ import annotations

import anthropic
import structlog

from config.settings import settings

log = structlog.get_logger()

_client: anthropic.AsyncAnthropic | None = None


def get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _client


async def chat(
    system: str,
    messages: list[dict],
    model: str | None = None,
    max_tokens: int = 4096,
    temperature: float = 0.3,
) -> str:
    """Send a chat completion request and return the assistant text."""
    client = get_client()
    model = model or settings.default_model

    log.debug("llm.chat", model=model, system_len=len(system), msg_count=len(messages))

    response = await client.messages.create(
        model=model,
        max_tokens=max_tokens,
        temperature=temperature,
        system=system,
        messages=messages,
    )
    return response.content[0].text


async def chat_with_tools(
    system: str,
    messages: list[dict],
    tools: list[dict],
    model: str | None = None,
    max_tokens: int = 4096,
) -> anthropic.types.Message:
    """Send a chat request with tool use and return the full response."""
    client = get_client()
    model = model or settings.default_model

    response = await client.messages.create(
        model=model,
        max_tokens=max_tokens,
        system=system,
        messages=messages,
        tools=tools,
    )
    return response
