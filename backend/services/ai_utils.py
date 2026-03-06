"""Shared AI model utilities for OpenRouter-backed services."""

from __future__ import annotations

from pydantic_ai.models.openai import OpenAIModel
from pydantic_ai.providers.openai import OpenAIProvider

from backend.config import settings


def get_openrouter_model(api_key: str | None = None) -> OpenAIModel:
    """Return a Pydantic AI model configured for OpenRouter.

    Parameters
    ----------
    api_key:
        Optional user-provided BYOK key. Falls back to the platform key.
    """
    provider = OpenAIProvider(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key or settings.openrouter_api_key,
    )
    return OpenAIModel(
        "anthropic/claude-3.5-sonnet",
        provider=provider,
    )
