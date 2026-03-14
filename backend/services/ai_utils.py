"""Shared AI model utilities for OpenRouter-backed services."""

from __future__ import annotations

import functools
import logging

import sentry_sdk
from fastapi import HTTPException, status
from pydantic_ai import Agent
from pydantic_ai.exceptions import ModelHTTPError
from pydantic_ai.models.openai import OpenAIModel
from pydantic_ai.providers.openai import OpenAIProvider

from backend.config import settings
from backend.services.platform_model_config import get_platform_model

logger = logging.getLogger(__name__)

# ── Centralized max_tokens budgets for all Pydantic AI agent calls ───
# Prevents the default 65536 from exhausting OpenRouter credits.
PYDANTIC_AI_MAX_TOKENS: dict[str, int] = {
    "research": 2048,      # ~3 sections of citations
    "anchors": 2048,       # 3 compact structured objects
    "chunk": 8192,         # geography/agents/buildings structured output
    "lore": 8192,          # 5-7 section lore scroll
    "lore_translation": 8192,  # mirrors lore output
    "dossier": 16384,      # ~9000 words across 6 sections
    "theme": 2048,         # flat structured object ~30 fields
    "translation": 4096,   # entity translation batch
    "dossier_evolution": 1024,  # short 100-250 word addenda
}


def ai_error_to_http(exc: ModelHTTPError) -> HTTPException:
    """Map Pydantic AI HTTP errors to actionable user-facing HTTPExceptions."""
    code = exc.status_code
    if code == 402:
        return HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="AI credit balance insufficient. Please top up your OpenRouter account or add a BYOK key.",
        )
    if code == 429:
        return HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="AI rate limit reached. Please wait a moment and try again.",
        )
    if code == 503:
        return HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI model temporarily unavailable. Please try again shortly.",
        )
    return HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=f"AI service error (HTTP {code}). Please try again.",
    )


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


def safe_background(func):
    """Wrap an async background task with error logging + Sentry capture.

    Starlette's BackgroundTask has zero exception handling — any uncaught
    error propagates silently. This decorator ensures every background task
    failure is logged and reported.
    """
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        task_name = func.__qualname__
        try:
            await func(*args, **kwargs)
        except Exception:
            logger.exception("Background task failed: %s", task_name)
            sentry_sdk.capture_exception()
    return wrapper


def create_forge_agent(
    system_prompt: str,
    api_key: str | None = None,
    purpose: str = "forge",
    retries: int = 3,
) -> Agent:
    """Create a Pydantic AI Agent configured for OpenRouter with sensible defaults.

    Centralizes the repeated Agent creation pattern across forge services.
    All agents get retries=3 by default (up from pydantic-ai's default of 1).
    """
    return Agent(
        get_openrouter_model(api_key, model_id=get_platform_model(purpose)),
        system_prompt=system_prompt,
        retries=retries,
    )
