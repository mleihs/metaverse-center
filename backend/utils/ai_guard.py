"""Map AI-generation failures to HTTP responses, in one place.

Extracted from ``routers/generation.py``, where it guarded eight endpoints
while the two other surfaces that call a model from a router — the War Room
SITREP and, historically, the epoch invitation lore — had no guard at all and
returned a bare 500 when OpenRouter was unreachable (finding E13).

A 500 tells the client the request was wrong. A model outage is not the
client's fault and is worth retrying in a minute, which is what 503 says.
"""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from uuid import UUID

import sentry_sdk
from fastapi import HTTPException, status

from backend.services.external.openrouter import OpenRouterError

logger = logging.getLogger(__name__)


@asynccontextmanager
async def ai_generation_guard(
    endpoint: str,
    *,
    simulation_id: UUID | str | None = None,
    fail_detail: str,
    context: dict | None = None,
) -> AsyncIterator[None]:
    """Map AI-generation failures to HTTP responses with tagged Sentry context.

    Wraps an AI-generation endpoint body so the OpenRouter-unavailable and
    generic-failure paths live in one place instead of being copy-pasted into
    every endpoint:

    - ``OpenRouterError`` -> 503 (transient AI outage; cause suppressed).
    - any other exception -> 500 with ``fail_detail`` (cause chained).
    - ``HTTPException`` raised inside the block (e.g. a 404 from a prior lookup)
      propagates unchanged.

    ``OpenRouterError`` is the BASE class the client raises for an API error, a
    failed connection and for exhausted retries; catching only its subclasses
    would miss exactly the common cases.

    ``simulation_id`` is optional: an epoch spans several simulations, so the
    War Room has none to name. Pass whatever identifies the scope in
    ``context`` instead.
    """
    scope_context = {**({"simulation_id": str(simulation_id)} if simulation_id else {}), **(context or {})}
    try:
        yield
    except HTTPException:
        raise
    except OpenRouterError as e:
        logger.warning(
            "AI service unavailable",
            extra={"endpoint": endpoint, "error": str(e), **scope_context},
        )
        with sentry_sdk.push_scope() as scope:
            scope.set_tag("generation_endpoint", endpoint)
            scope.set_context("generation", scope_context)
            sentry_sdk.capture_exception(e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service temporarily unavailable.",
        ) from None
    except Exception as e:
        logger.exception("AI generation failed", extra={"endpoint": endpoint, **scope_context})
        with sentry_sdk.push_scope() as scope:
            scope.set_tag("generation_endpoint", endpoint)
            scope.set_context("generation", scope_context)
            sentry_sdk.capture_exception(e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=fail_detail,
        ) from e
