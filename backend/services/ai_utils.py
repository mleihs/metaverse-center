"""Shared AI model utilities for OpenRouter-backed services."""

from __future__ import annotations

import asyncio
import functools
import logging
import time
from typing import Any
from uuid import UUID

import sentry_sdk
from fastapi import HTTPException
from pydantic_ai import Agent
from pydantic_ai.exceptions import ModelAPIError, ModelHTTPError, UnexpectedModelBehavior
from pydantic_ai.models.openrouter import OpenRouterModel
from pydantic_ai.providers.openrouter import OpenRouterProvider

from backend.config import settings
from backend.services.ai_usage_service import AIUsageService
from backend.services.budget_enforcement_service import (
    BudgetEnforcementService,
    BudgetExceededError,
)
from backend.services.platform_model_config import (
    get_platform_max_tokens,
    get_platform_model,
    get_platform_reasoning,
    get_platform_timeout,
)
from backend.utils.errors import (
    bad_gateway,
    gateway_timeout,
    payment_required,
    service_unavailable,
    too_many_requests,
)
from backend.utils.supabase_admin_cache import get_admin_supabase_client
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# ── Budgets, timeouts and models per purpose ─────────────────────────
#
# All three used to live here as two dicts keyed by the `run_ai` purpose, while
# the MODEL came from a third mapping keyed by the string passed to
# `create_forge_agent` — which defaulted to "forge" and therefore disagreed with
# the purpose at 8 of 9 call sites. They are now one declaration in
# `backend/services/ai_purposes.py`, read through `platform_model_config` so an
# operator can override a single purpose from Admin > Models without a redeploy.
#
# Two defects the move made visible, both fixed in the declaration:
#   * `style_refine`, `templates` and `ops_forecast` had NO budget and NO
#     timeout — production logged `timeout=None max_tokens=None`.
#   * `ascii_art` had both and makes no model call at all (pyfiglet + Pillow).
#
# See findings 11, 13, 15 in docs/analysis/forge-prod-run-2026-08-30.md.


# ── What a model call can actually fail with ─────────────────────────
#
# Listing these by hand at a call site has been wrong at every call site that
# tried, so they live here and nowhere else.
#
# `ModelAPIError` is the one that was missing everywhere, and it is the one that
# matters most: pydantic-ai raises it for a TIMEOUT and for a connection failure
# (openai.APITimeoutError -> APIConnectionError -> re-raised as ModelAPIError).
# It is also the PARENT of `ModelHTTPError`, so `except ModelHTTPError` does not
# catch it. Measured with a real call at `timeout=0.001`: the exception that
# reaches the caller is `pydantic_ai.exceptions.ModelAPIError`, whose MRO is
# (ModelAPIError, AgentRunError, RuntimeError, Exception) -- caught by none of
# `httpx.HTTPError`, `KeyError`, `TypeError`, `ValueError`, `ModelHTTPError` or
# `UnexpectedModelBehavior`. Before this constant existed the name appeared zero
# times in the backend, while `PYDANTIC_AI_TIMEOUTS` set eleven budgets and the
# comment above them claimed a firing timeout was "caught by existing except
# blocks". It never was. See finding 33.
MODEL_CALL_ERRORS: tuple[type[Exception], ...] = (
    ModelAPIError,  # timeouts, connection failures, AND every ModelHTTPError
    UnexpectedModelBehavior,  # output validation retries exhausted
)


def ai_error_to_http(exc: ModelAPIError) -> HTTPException:
    """Map a Pydantic AI model error to an actionable user-facing HTTPException.

    Takes `ModelAPIError`, not `ModelHTTPError`: a timeout and a connection
    failure arrive as the parent class and carry no status code at all, and
    reading `.status_code` off one raises `AttributeError` inside the handler
    that was supposed to produce a clean message.
    """
    code = getattr(exc, "status_code", None)
    if code is None:
        # A timeout or a connection failure. 504 says "upstream did not answer
        # in time", which is what happened, and keeps it out of the 5xx bucket
        # that means "this service is broken".
        return gateway_timeout(
            "The AI model did not answer in time. Please try again.",
        )
    if code == 402:
        return payment_required(
            "AI credit balance insufficient. Please top up your OpenRouter account or add a BYOK key.",
        )
    if code == 429:
        return too_many_requests("AI rate limit reached. Please wait a moment and try again.")
    if code == 503:
        return service_unavailable("AI model temporarily unavailable. Please try again shortly.")
    return bad_gateway(f"AI service error (HTTP {code}). Please try again.")


def get_openrouter_model(
    api_key: str | None = None,
    *,
    model_id: str,
) -> OpenRouterModel:
    """Return a Pydantic AI model configured for OpenRouter.

    Parameters
    ----------
    api_key:
        Optional user-provided BYOK key. Falls back to the platform key.
    model_id:
        OpenRouter model identifier. REQUIRED, and keyword-only.

        It used to default to ``"anthropic/claude-sonnet-4-6"`` — an id the
        catalogue never had (it spells it ``claude-sonnet-4.6``, with a dot), so
        any caller that had relied on the default would have failed outright.
        Every caller already passes this explicitly; making it required means a
        model can only be chosen through the configured chain
        (``get_platform_model`` -> platform_settings -> Admin > Models), never by
        a literal that quietly rots.

    It returns ``OpenRouterModel``, not the generic ``OpenAIChatModel`` pointed
    at OpenRouter's base URL. Both speak the same wire protocol, but only the
    native class carries ``OpenRouterModelSettings`` -- and with it
    ``openrouter_reasoning``, the one lever that decides whether a thinking
    model spends ``max_tokens`` on thought or on the answer (see
    ``REASONING_DEFAULTS``). Routing that through ``extra_body`` on the generic
    class is a dead end: the OpenAI-derived models overwrite colliding keys
    they build themselves.
    """
    provider = OpenRouterProvider(api_key=api_key or settings.openrouter_api_key)
    return OpenRouterModel(
        model_id,
        provider=provider,
    )


_RATE_LIMIT_BACKOFFS = (5, 10)  # seconds to wait on 429 before retry


async def _record_usage(
    result: Any,
    *,
    purpose: str,
    model_id: str,
    elapsed_s: float,
    admin_supabase: Client | None,
    simulation_id: UUID | None,
    user_id: UUID | None,
    key_source: str,
) -> None:
    """Write one ``ai_usage_log`` row for a completed model call.

    **Finding 34.** Every ``run_ai`` call site passed ``admin_supabase`` so that
    ``BudgetEnforcementService.pre_check`` could weigh the call against
    ``ai_budget`` — and nothing ever wrote the other half. ``pre_check`` reads
    ``get_budget_states``, which aggregates ``ai_usage_log``; ``AIUsageService``
    was called from exactly four places (chat, generation, forge images, and
    nothing else). Measured by AST on 2026-08-30, the intersection of the 13
    purposes passed to ``run_ai`` with the purposes ever passed to
    ``AIUsageService.log`` was **empty**, and production agreed: 603 ledger rows,
    293 of them OpenRouter, **0** for any ``run_ai`` purpose, $10.5311 recorded
    in total.

    So the entire Forge text pipeline — the most expensive thing the platform
    does — was pre-checked against a number that was structurally always zero. A
    per-purpose cap on ``chunk`` could not trip, and the global cap under-counted
    by everything the Forge spent on text. (``ai_budget`` on production even
    carries a ``purpose:forge`` row: a scope key no call site passes, so it could
    not have matched even with a fed ledger.)

    Logging belongs here rather than at the call sites: this is the one place
    that already knows the purpose, the elapsed time, the budget context and
    which model actually answered — including after a fallback, where the model
    is not the one the caller built.

    ``AIUsageService.log`` never raises; the client is a process-wide singleton,
    so the added cost is one insert. ``key_source`` is not knowable from here —
    the agent has already been constructed and ``run_ai`` cannot see whether the
    key behind it was a BYOK key — so the caller that resolved the key passes it
    in via :func:`key_source_for`. Until 2026-09-02 no caller did, and
    production showed the consequence exactly: 604 of 604 ledger rows read
    ``platform``, including every call a user had paid for out of their own
    account.
    """
    try:
        usage = result.usage()
        input_tokens = int(getattr(usage, "input_tokens", 0) or 0)
        output_tokens = int(getattr(usage, "output_tokens", 0) or 0)
    except Exception:  # noqa: BLE001 — usage accounting must never fail a served call
        logger.debug("Could not read usage from AI result", exc_info=True, extra={"purpose": purpose})
        return

    client = admin_supabase
    if client is None:
        # `ops_forecast` is budget-exempt by design (AD-6) and passes no client.
        # Exempt from the budget is not the same as absent from the ledger.
        client = await get_admin_supabase_client()

    await AIUsageService.log(
        client,
        simulation_id=simulation_id,
        user_id=user_id,
        provider="openrouter",
        model=model_id,
        purpose=purpose,
        usage={
            "prompt_tokens": input_tokens,
            "completion_tokens": output_tokens,
            "total_tokens": input_tokens + output_tokens,
            "duration_ms": int(elapsed_s * 1000),
        },
        key_source=key_source,
    )


def key_source_for(api_key: str | None) -> str:
    """Name the origin of the key a call ran on, for the cost ledger.

    ``run_ai`` cannot work this out for itself — by the time it sees the agent,
    the key is already inside it — so the caller that chose the key says so.
    One helper rather than a ternary at each site: the answer must be the same
    everywhere, and the same file already learned (finding 11) what happens
    when two facts about one call are spelled out separately at nine call
    sites.

    ``"byok"`` means the request was paid by the caller's own provider account.
    That is not bookkeeping trivia: ``get_budget_states`` weighs the ledger
    against the platform's caps, and money the platform never spent must not
    count against them.
    """
    return "byok" if api_key else "platform"


async def run_ai(
    agent: Agent,
    prompt: str,
    purpose: str,
    *,
    output_type: type | None = None,
    model_settings: dict[str, Any] | None = None,
    # Bureau Ops Deferral A — optional budget-enforcement context.
    # When ``admin_supabase`` is provided, BudgetEnforcementService.pre_check
    # runs before the upstream call and raises BudgetExceededError if a hard
    # block is in effect (global / purpose / simulation / user budgets are
    # all considered). ``simulation_id`` and ``user_id`` narrow the lookup
    # so per-sim and per-user budgets are enforced; callers without that
    # context still benefit from global + purpose enforcement.
    admin_supabase: Client | None = None,
    simulation_id: UUID | None = None,
    user_id: UUID | None = None,
    # Where the OpenRouter key behind ``agent`` came from, for the cost ledger.
    # ``run_ai`` cannot see this itself — the agent is already built by the time
    # it arrives — so a caller that knows it used a simulation or BYOK key says
    # so here. See ``_record_usage``.
    key_source: str = "platform",
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
    # Bureau Ops pre-call budget check (AD-3).
    if admin_supabase is not None:
        await BudgetEnforcementService.pre_check(
            admin_supabase,
            purpose=purpose,
            simulation_id=simulation_id,
            user_id=user_id,
        )

    ms = dict(model_settings) if model_settings else {}
    ms.setdefault("timeout", get_platform_timeout(purpose))
    ms.setdefault("max_tokens", get_platform_max_tokens(purpose))

    # Reasoning tokens are spent from `max_tokens` and billed as output, so the
    # thinking level is not independent of the budget above it — it decides how
    # much of that budget ever reaches the answer. Resolved per purpose from
    # platform_settings (Admin > Models), never hardcoded at the call site.
    reasoning = get_platform_reasoning(purpose)
    if reasoning is not None:
        ms.setdefault("openrouter_reasoning", reasoning)

    timeout_s = ms.get("timeout")
    max_tokens = ms.get("max_tokens")

    kwargs: dict[str, Any] = {"model_settings": ms}
    if output_type is not None:
        kwargs["output_type"] = output_type

    logger.info(
        "AI call started",
        extra={
            "purpose": purpose,
            "timeout_s": timeout_s,
            "max_tokens": max_tokens,
            "reasoning": ms.get("openrouter_reasoning"),
        },
    )
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
            await _record_usage(
                result,
                purpose=purpose,
                model_id=getattr(agent.model, "model_name", "unknown"),
                elapsed_s=elapsed,
                admin_supabase=admin_supabase,
                simulation_id=simulation_id,
                user_id=user_id,
                key_source=key_source,
            )
            return result
        except ModelHTTPError as exc:
            if exc.status_code != 429:
                elapsed = time.monotonic() - t0
                # Credit/quota-exhaustion (402/403) and provider-unavailability (503)
                # are ops signals, not programmer errors — warning level keeps them
                # out of Sentry error budget while still logging.
                log_fn = logger.warning if exc.status_code in (402, 403, 503) else logger.error
                log_fn(
                    "AI call failed",
                    extra={
                        "purpose": purpose,
                        "elapsed_s": round(elapsed, 1),
                        "status_code": exc.status_code,
                    },
                    exc_info=True,
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
        # The fallback model is the one that answered and the one that is
        # billed — logging the caller's model here would misattribute the cost.
        await _record_usage(
            result,
            purpose=purpose,
            model_id=fallback_model_id,
            elapsed_s=elapsed,
            admin_supabase=admin_supabase,
            simulation_id=simulation_id,
            user_id=user_id,
            key_source=key_source,
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

    Bureau Ops Deferral A.2 — ``BudgetExceededError`` is caught explicitly
    BEFORE the generic exception handler so that an admin's deliberate
    budget kill (CUT ALL AI, per-scope kill, per-purpose cap) is NOT
    captured as an error in Sentry. The block is still logged at INFO so
    the event remains searchable, but Sentry's error budget is not
    consumed by expected-and-audited admin actions. This matches the
    graceful-degrade pattern in ``ChatAIService._generate_single_response``
    and ``AutonomousEventService.create_event``.

    Net effect for forge background paths (recruit_agents, generate_variants,
    generate_dossier, evolve_section, …): a budget block still aborts the
    task, the user still sees "feature failed" via the feature_purchases
    result pattern, but the operator does NOT get a Sentry alert for an
    event they themselves triggered.
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
        except BudgetExceededError as exc:
            # Deliberate admin action — info-level, no Sentry capture.
            elapsed = time.monotonic() - t0
            logger.info(
                "Background task skipped (AI budget blocked): %s (after %.1fs) – %s:%s %s $%.4f/$%.4f",
                task_name,
                elapsed,
                exc.scope,
                exc.scope_key,
                exc.period,
                exc.current_usd,
                exc.max_usd,
            )
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
            "Bilingual gap: %d/%d %s(s) missing _de fields – patched with EN fallback",
            incomplete,
            len(entities),
            entity_type,
            extra={"entity_type": entity_type, "incomplete": incomplete, "total": len(entities)},
        )
    return incomplete


def report_delivery_count(
    kind: str,
    requested: int,
    delivered: int,
    **context: Any,
) -> int:
    """Compare what was ordered against what arrived. Returns the shortfall (0 when exact).

    A short list used to be structurally unnoticeable. ``generate_anchors``
    returned ``result.output`` unfiltered, the two chunk paths only checked for
    *empty*, and the recruitment path checked nothing at all -- so the number the
    user configured and the number they received were never compared anywhere, and
    a short delivery cost them a billed call without ever being named. Measured on
    production: of 92 list deliveries stored in ``forge_drafts``, 87 were exact,
    4 short and 1 long.

    This does not raise. ``counted_list`` already refuses a delivery that is
    worthless and lets pydantic-ai retry it once; what remains is a delivery that
    is usable but smaller than ordered, and the right answer to that is to keep it
    and say so. See finding 10.
    """
    shortfall = max(0, requested - delivered)
    if shortfall:
        logger.warning(
            "Short delivery: %d of %d %s(s) returned",
            delivered,
            requested,
            kind,
            extra={"kind": kind, "requested": requested, "delivered": delivered, **context},
        )
        sentry_sdk.add_breadcrumb(
            category="ai",
            message=f"short delivery: {delivered}/{requested} {kind}",
            level="warning",
            data={"kind": kind, "requested": requested, "delivered": delivered, **context},
        )
    elif delivered > requested:
        logger.warning(
            "Over-delivery: %d of %d %s(s) returned",
            delivered,
            requested,
            kind,
            extra={"kind": kind, "requested": requested, "delivered": delivered, **context},
        )
    return shortfall


def create_forge_agent(
    system_prompt: str,
    api_key: str | None = None,
    *,
    purpose: str,
    retries: int = 1,
) -> Agent:
    """Create a Pydantic AI Agent configured for OpenRouter with sensible defaults.

    Centralizes the repeated Agent creation pattern across forge services.
    Retries default to 1 — ``run_ai`` owns the 429 retry/backoff chain above
    and the provider-fallback chain, so pydantic-ai retries=3 would multiply
    up to 12 attempts per logical call. Callers that specifically need more
    inner retries (e.g. transient tool-output validation) can still opt in.

    ``purpose`` is REQUIRED and keyword-only, and it must be the same string the
    matching :func:`run_ai` call passes. It used to default to ``"forge"``, which
    meant the model came from one name and the budget, timeout and thinking level
    from another; at 8 of 9 call sites those two names differed (finding 11). A
    default here cannot be right — there is no such thing as a call whose model
    should be chosen by a different purpose than its budget — so there is none.
    ``backend/tests/unit/test_ai_purposes.py`` checks the agreement by AST.
    """
    return Agent(
        get_openrouter_model(api_key, model_id=get_platform_model(purpose)),
        system_prompt=system_prompt,
        retries=retries,
    )
