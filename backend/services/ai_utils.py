"""Shared AI model utilities for OpenRouter-backed services."""

from __future__ import annotations

from pydantic_ai.models.openai import OpenAIModel
from pydantic_ai.providers.openai import OpenAIProvider

from backend.config import settings


def get_openrouter_model(
    api_key: str | None = None,
    model_id: str = "anthropic/claude-sonnet-4-6",
) -> OpenAIModel:
    """Return a Pydantic AI model configured for OpenRouter.

    Parameters
    ----------
    api_key:
        Optional user-provided BYOK key. Falls back to the platform key.
    model_id:
        OpenRouter model identifier. Defaults to Claude Sonnet 4.6.
    """
    provider = OpenAIProvider(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key or settings.openrouter_api_key,
    )
    return OpenAIModel(
        model_id,
        provider=provider,
    )


# Kept as a constant for backward compatibility — runtime code should use
# get_platform_model("research") from platform_model_config instead.
RESEARCH_MODEL = "google/gemini-2.0-flash-001"
