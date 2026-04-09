"""Shared AI model utilities for OpenRouter-backed services."""

from __future__ import annotations

import asyncio
import functools
import logging
import time
from typing import Any

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
    "research": 2048,  # ~3 sections of citations
    "anchors": 3072,  # 3 compact structured objects (bilingual EN+DE)
    "chunk": 12288,  # geography/agents/buildings structured output (bilingual EN+DE)
    "lore": 8192,  # 5-7 section lore scroll
    "lore_translation": 8192,  # mirrors lore output
    "dossier": 16384,  # ~9000 words across 6 sections
    "theme": 2048,  # flat structured object ~30 fields
    "translation": 4096,  # entity translation batch
    "dossier_evolution": 1024,  # short 100-250 word addenda
    "entity": 3072,  # single agent/building (character + background + DE)
    "ascii_art": 1024,  # terminal boot art (monospace scene)
}

# ── Centralized timeout budgets (seconds) ────────────────────────────
# pydantic-ai passes model_settings["timeout"] to the OpenAI SDK's
# create() call, which sets it as an httpx timeout.  When it fires,
# openai.APITimeoutError is raised → caught by existing except blocks.
# Values are 2-3x expected duration to avoid false timeouts.
PYDANTIC_AI_TIMEOUTS: dict[str, int] = {
    "research": 90,
    "anchors": 120,
    "chunk": 180,
    "lore": 180,
    "lore_translation": 180,
    "dossier": 300,
    "theme": 90,
    "translation": 120,
    "dossier_evolution": 60,
    "entity": 120,
    "ascii_art": 60,
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


_RATE_LIMIT_BACKOFFS = (5, 10)  # seconds to wait on 429 before retry


async def run_ai(
    agent: Agent,
    prompt: str,
    purpose: str,
    *,
    output_type: type | None = None,
    model_settings: dict[str, Any] | None = None,
) -> Any:
    """Central wrapper for every agent.run() call.

    Injects timeout + max_tokens from centralized configs, logs before/after
    every call with purpose and elapsed time.

    **Rate-limit hardening** (3 layers):
    1. On upstream 429, backoff-retry on the *same* model (5s, 10s).
    2. If retries exhausted, fall back to the platform fallback model.
    3. Sentry breadcrumbs on every retry/fallback for observability.

    On any other failure, logs with exc_info and re-raises so existing
    error-handling continues to work.
    """
    ms = dict(model_settings) if model_settings else {}
    ms.setdefault("timeout", PYDANTIC_AI_TIMEOUTS.get(purpose))
    ms.setdefault("max_tokens", PYDANTIC_AI_MAX_TOKENS.get(purpose))

    timeout_s = ms.get("timeout")
    max_tokens = ms.get("max_tokens")

    kwargs: dict[str, Any] = {"model_settings": ms}
    if output_type is not None:
        kwargs["output_type"] = output_type

    logger.info("AI call started", extra={"purpose": purpose, "timeout_s": timeout_s, "max_tokens": max_tokens})
    t0 = time.monotonic()

    # ── Layer 1: backoff-retry on same model ────────────────────────
    last_exc: ModelHTTPError | None = None
    for attempt, backoff in enumerate((0, *_RATE_LIMIT_BACKOFFS)):
        if backoff:
            logger.warning(
                "AI rate-limited (429), retrying in %ds (attempt %d/%d)",
                backoff,
                attempt + 1,
                len(_RATE_LIMIT_BACKOFFS) + 1,
                extra={"purpose": purpose},
            )
            sentry_sdk.add_breadcrumb(
                category="ai",
                message=f"429 retry #{attempt} for {purpose}, waiting {backoff}s",
                level="warning",
            )
            await asyncio.sleep(backoff)

        try:
            result = await agent.run(prompt, **kwargs)
            elapsed = time.monotonic() - t0
            logger.info("AI call completed", extra={"purpose": purpose, "elapsed_s": round(elapsed, 1)})
            return result
        except ModelHTTPError as exc:
            if exc.status_code != 429:
                elapsed = time.monotonic() - t0
                logger.error(
                    "AI call failed", extra={"purpose": purpose, "elapsed_s": round(elapsed, 1)}, exc_info=True
                )
                raise
            last_exc = exc
        except Exception:
            elapsed = time.monotonic() - t0
            logger.error("AI call failed", extra={"purpose": purpose, "elapsed_s": round(elapsed, 1)}, exc_info=True)
            raise

    # ── Layer 2: automatic model fallback ───────────────────────────
    fallback_model_id = get_platform_model("fallback")
    logger.warning(
        "AI rate-limited after %d retries, falling back to %s",
        len(_RATE_LIMIT_BACKOFFS) + 1,
        fallback_model_id,
        extra={"purpose": purpose, "fallback_model": fallback_model_id},
    )
    sentry_sdk.add_breadcrumb(
        category="ai",
        message=f"429 fallback for {purpose} → {fallback_model_id}",
        level="warning",
    )

    try:
        fallback_model = get_openrouter_model(model_id=fallback_model_id)
        fallback_agent = Agent(
            fallback_model,
            system_prompt=agent._system_prompts,  # noqa: SLF001
            retries=agent._max_result_retries,  # noqa: SLF001
        )
        result = await fallback_agent.run(prompt, **kwargs)
        elapsed = time.monotonic() - t0
        logger.info(
            "AI call completed (fallback model)",
            extra={"purpose": purpose, "elapsed_s": round(elapsed, 1), "fallback_model": fallback_model_id},
        )
        return result
    except Exception:
        elapsed = time.monotonic() - t0
        logger.error(
            "AI fallback also failed",
            extra={"purpose": purpose, "elapsed_s": round(elapsed, 1), "fallback_model": fallback_model_id},
            exc_info=True,
        )
        sentry_sdk.capture_exception()
        # Re-raise the original 429 error — the caller's ai_error_to_http
        # will convert it to a user-facing 429 response.
        raise last_exc from None  # type: ignore[misc]


def safe_background(func):
    """Wrap an async background task with error logging + Sentry capture.

    Starlette's BackgroundTask has zero exception handling — any uncaught
    error propagates silently. This decorator ensures every background task
    failure is logged and reported.
    """

    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        task_name = func.__qualname__
        logger.info("Background task started: %s", task_name)
        t0 = time.monotonic()
        try:
            await func(*args, **kwargs)
            elapsed = time.monotonic() - t0
            logger.info("Background task completed: %s (%.1fs)", task_name, elapsed)
        except Exception:
            elapsed = time.monotonic() - t0
            logger.exception("Background task FAILED: %s (after %.1fs)", task_name, elapsed)
            sentry_sdk.capture_exception()

    return wrapper


def validate_bilingual_output(
    entities: list,
    de_fields: list[str],
    entity_type: str,
) -> int:
    """Patch empty _de fields with EN fallback. Returns count of patched entities.

    Works with both dicts and Pydantic BaseModel instances.
    """
    incomplete = 0
    for entity in entities:
        patched = False
        is_dict = isinstance(entity, dict)
        for de_field in de_fields:
            en_field = de_field.removesuffix("_de")
            current = entity.get(de_field) if is_dict else getattr(entity, de_field, None)
            if not current:
                value = entity.get(en_field, "") if is_dict else getattr(entity, en_field, "")
                if is_dict:
                    entity[de_field] = value
                else:
                    setattr(entity, de_field, value)
                patched = True
        if patched:
            incomplete += 1
    if incomplete:
        logger.warning(
            "Bilingual gap: %d/%d %s(s) missing _de fields — patched with EN fallback",
            incomplete,
            len(entities),
            entity_type,
            extra={"entity_type": entity_type, "incomplete": incomplete, "total": len(entities)},
        )
    return incomplete


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
