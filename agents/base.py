"""Base agent class — shared scaffolding for all agents."""

from __future__ import annotations

import abc

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from utils.llm import chat


class BaseAgent(abc.ABC):
    """Every agent gets a name, a logger, and access to the LLM."""

    name: str = "base"

    def __init__(self, session: AsyncSession) -> None:
        self.db = session
        self.log = structlog.get_logger().bind(agent=self.name)

    async def think(self, system: str, user_message: str, **kwargs) -> str:
        """Send a prompt to Claude and return the response text."""
        return await chat(
            system=system,
            messages=[{"role": "user", "content": user_message}],
            **kwargs,
        )

    @abc.abstractmethod
    async def run(self, **kwargs) -> dict:
        """Execute the agent's primary task. Must be implemented by subclasses."""
        ...
