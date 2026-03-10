"""Shared AI model utilities for OpenRouter-backed services."""

from __future__ import annotations

from pydantic_ai.models.openai import OpenAIModel
from pydantic_ai.providers.openai import OpenAIProvider

from backend.config import settings


def get_openrouter_model(
    api_key: str | None = None,
    model_id: str = "anthropic/claude-3.5-sonnet",
) -> OpenAIModel:
    """Return a Pydantic AI model configured for OpenRouter.

    Parameters
    ----------
    api_key:
        Optional user-provided BYOK key. Falls back to the platform key.
    model_id:
        OpenRouter model identifier. Defaults to Claude 3.5 Sonnet.
    """
    provider = OpenAIProvider(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key or settings.openrouter_api_key,
    )
    return OpenAIModel(
        model_id,
        provider=provider,
    )


# Cheap but effective model for research tasks (~$0.10/M input, $0.40/M output).
# Research costs ~$0.0005 per call vs ~$0.02 for Claude 3.5 Sonnet.
RESEARCH_MODEL = "google/gemini-2.0-flash-001"
