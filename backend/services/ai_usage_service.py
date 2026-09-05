"""AI Usage tracking service -- fire-and-forget logging of LLM/image generation calls.

Inserts into ``ai_usage_log`` (migration 150) after each AI operation.
Failures are logged but never propagate -- usage tracking must not
block the primary operation.

Usage::

    await AIUsageService.log(
        admin_supabase, simulation_id=sim_id, user_id=user_id,
        provider="openrouter", model="deepseek/deepseek-chat",
        purpose="chat", usage=openrouter.last_usage,
    )
"""

from __future__ import annotations

import logging
from uuid import UUID

import sentry_sdk

from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# Cost per 1M tokens (USD) as (input, output), by model prefix.
# Source: OpenRouter /api/v1/models. Verified 2026-08-29.
# Used for estimated_cost_usd — not for billing, just visibility.
#
# It used to be ONE number per model, applied to `total_tokens`. That is wrong
# by construction: output costs two to four times input almost everywhere, and
# reasoning models (the whole DeepSeek V4 line) spend most of their tokens on
# output. A blended rate cannot represent that.
#
# Worse, none of the models actually in production appeared in the old table at
# all — every call fell through to the $1.00/M "conservative estimate". For
# deepseek-v4-flash-0731 that overstates the true cost by roughly fifteen times,
# which makes the Admin > AI Usage figures fiction rather than an estimate.
#
# Longest prefix wins, so a pinned snapshot is priced as itself rather than
# inheriting the alias it starts with (`…v4-flash-0731` is NOT `…v4-flash`).
MODEL_COST_PER_1M_TOKENS: dict[str, tuple[float, float]] = {
    # DeepSeek — the tier this project actually runs on
    "deepseek/deepseek-v4-flash-0731": (0.04, 0.09),
    "deepseek/deepseek-v4-flash": (0.08, 0.17),
    "deepseek/deepseek-v4-pro-0813": (0.66, 1.98),
    "deepseek/deepseek-v4-pro": (0.57, 1.14),
    "deepseek/deepseek-v3.2": (0.27, 0.40),
    "deepseek/deepseek-chat-v3-0324": (0.25, 1.00),
    "deepseek/deepseek-r1-0528": (0.50, 2.15),
    "deepseek/deepseek-chat-v3.1": (0.55, 1.65),
    "deepseek/deepseek-chat": (0.26, 1.03),
    # Fallback tier
    "google/gemini-2.5-flash-lite": (0.10, 0.40),
    "google/gemini-2.5-pro": (1.25, 10.00),
    # Anthropic — used by ops forecasting, and available for per-simulation config
    "anthropic/claude-haiku-4.5": (1.00, 5.00),
    "anthropic/claude-sonnet-4.6": (3.00, 15.00),
    "anthropic/claude-opus-4.5": (5.00, 25.00),
}

# Approximate cost per image generation (USD) by model.
#
# ZWEI ABRECHNUNGSARTEN, NICHT EINE
#
# Die offiziellen Modelle von Black Forest Labs haben einen Festpreis je Bild;
# die Zahlen unten stammen von ihren Modellkarten. Ein GEMEINSCHAFTSMODELL
# rechnet Replicate anders ab, naemlich nach GPU-Sekunde — der Preis eines
# Bildes haengt dort an Schrittzahl, Aufloesung und Hardware und ist keine
# Konstante.
#
# Bis zum 05.09.2026 stand hier nur die Flux-Reihe, und der Rueckfallwert war
# `0.031` — der Preis von `flux-2-pro`. Damit buchte die ganze
# Erwachsenenspur (`proteus`, `juggernaut`) den Preis eines Modells, das sie
# nie aufruft. Das faellt niemandem auf: die Zahl ist plausibel, sie steht in
# jeder Auswertung, und `duration_ms` ist bei Bildern `0`, also gibt es auch
# keine Sekunden, an denen man es nachrechnen koennte.
#
# Die SDXL-Werte unten sind DEUTLICH niedriger und trotzdem noch grosszuegig
# gerechnet: eine Erzeugung mit 30-35 Schritten auf der von Replicate
# gewaehlten Hardware liegt in der Groessenordnung von Zehntelcent. Sie
# ueberschaetzen also eher, was die richtige Richtung ist — ein zu billig
# gebuchtes Modell verschwindet in der Auswertung.
# ZWEI SCHREIBWEISEN DERSELBEN MARKE
#
# Die Familientabelle kennt `flux-2` UND `flux.2` als Marke (siehe `_FLUX2`),
# weil beide Schreibweisen vorkommen. Diese Tabelle kannte nur den Bindestrich.
# Ein bestehender Test rief ausgerechnet `black-forest-labs/flux.2-pro` auf und
# bestand — nicht, weil der Preis gefunden wurde, sondern weil der
# Rueckfallwert damals ZUFAELLIG derselbe Preis war (`0.031`). Zwei Fehler, die
# einander verdeckt haben; aufgefallen ist es erst, als der Rueckfallwert sich
# aenderte.
IMAGE_COST_PER_CALL: dict[str, float] = {
    # Festpreis je Bild, Modellkarte des Anbieters.
    "black-forest-labs/flux-2-pro": 0.031,
    "black-forest-labs/flux.2-pro": 0.031,
    "black-forest-labs/flux-2-max": 0.073,
    "black-forest-labs/flux.2-max": 0.073,
    "black-forest-labs/flux-1.1-pro": 0.040,
    "black-forest-labs/flux-dev": 0.025,
    "black-forest-labs/flux-schnell": 0.003,
    # Gemeinschaftsmodelle, nach GPU-Sekunde abgerechnet — Schaetzung.
    "datacte/proteus-v0.2": 0.004,
    "asiryan/proteus-v0.2": 0.004,
    "asiryan/juggernaut-xl-v7": 0.005,
}


# Charged when the model is not in the table. Deliberately pessimistic: an
# unknown model should look expensive in the usage view, because an unpriced
# model is a model nobody checked.
_UNKNOWN_COST_PER_1M: tuple[float, float] = (1.00, 3.00)

#: Dasselbe fuer Bilder — und aus demselben Grund pessimistisch.
#:
#: Hier stand `0.031` als nackte Zahl im Rueckgabeausdruck, also der Preis von
#: `flux-2-pro`. Ein unbekanntes Modell bekam damit nicht „teuer, bitte
#: nachsehen", sondern den Preis eines bestimmten anderen Modells — eine Zahl,
#: die richtig aussieht und niemanden zum Nachschlagen bringt. Genau so lief
#: die Erwachsenenspur monatelang unter fremdem Namen durch die Auswertung.
_UNKNOWN_IMAGE_COST: float = 0.05


def _estimate_cost(
    provider: str,
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
) -> float:
    """Estimate USD cost from token counts and model pricing.

    Input and output are priced separately — see MODEL_COST_PER_1M_TOKENS for
    why a single blended rate could not be right.
    """
    if provider == "replicate":
        return IMAGE_COST_PER_CALL.get(model, _UNKNOWN_IMAGE_COST)

    # Longest matching prefix wins: `…v4-flash-0731` must be priced as itself,
    # not as the `…v4-flash` alias it happens to start with. Plain dict order
    # would have priced whichever entry came first.
    best: tuple[float, float] | None = None
    best_len = -1
    for prefix, cost in MODEL_COST_PER_1M_TOKENS.items():
        if model.startswith(prefix) and len(prefix) > best_len:
            best, best_len = cost, len(prefix)

    cost_in, cost_out = best if best is not None else _UNKNOWN_COST_PER_1M
    return (prompt_tokens / 1_000_000) * cost_in + (completion_tokens / 1_000_000) * cost_out


class AIUsageService:
    """Fire-and-forget AI usage logging."""

    @staticmethod
    async def log(
        admin_supabase: Client,
        *,
        simulation_id: UUID | None = None,
        user_id: UUID | None = None,
        provider: str,
        model: str,
        purpose: str,
        usage: dict | None = None,
        key_source: str = "platform",
        metadata: dict | None = None,
        outcome: str = "ok",
        error_kind: str | None = None,
        error_detail: str | None = None,
    ) -> None:
        """Log an AI usage event. Never raises -- failures are swallowed.

        Args:
            admin_supabase: Service-role client (ai_usage_log has no user RLS).
            simulation_id: Simulation context (nullable for platform-level calls).
            user_id: User who triggered the call (nullable for background tasks).
            provider: 'openrouter' or 'replicate'.
            model: Model identifier (e.g. 'deepseek/deepseek-chat').
            purpose: What the call was for (e.g. 'chat', 'portrait', 'lore').
            usage: Token usage dict from OpenRouterService.last_usage or similar.
            key_source: Where the API key came from ('platform', 'simulation', 'byok', 'env').
            metadata: Additional context (e.g. agent_id, building_id).
            outcome: How the attempt ended -- 'ok', 'http_error', 'timeout',
                'cancelled' or 'failed'. See migration 352: this table is a
                record of ATTEMPTS, not of successes. A failed attempt carries
                zero tokens and zero cost, so every sum stays as it was; only
                counts must say ``outcome = 'ok'`` where they mean answered.
            error_kind: Short cause, for grouping ('HTTP 402', 'TimeoutError').
            error_detail: The provider's message, truncated to 500 characters.
                NEVER the prompt or the response -- the ledger records that and
                how a transmission ended, never what was said.
        """
        try:
            u = usage or {}
            total_tokens = u.get("total_tokens", 0)
            prompt_tokens = u.get("prompt_tokens", 0)
            completion_tokens = u.get("completion_tokens", 0)
            # Some providers report only a total. Attributing all of it to
            # output keeps the estimate on the pessimistic side rather than
            # silently pricing an unknown split as if it were all input.
            if not prompt_tokens and not completion_tokens and total_tokens:
                completion_tokens = total_tokens
            estimated_cost = _estimate_cost(provider, model, prompt_tokens, completion_tokens)

            await (
                admin_supabase.table("ai_usage_log")
                .insert(
                    {
                        "simulation_id": str(simulation_id) if simulation_id else None,
                        "user_id": str(user_id) if user_id else None,
                        "provider": provider,
                        "model": model,
                        "purpose": purpose,
                        "prompt_tokens": u.get("prompt_tokens", 0),
                        "completion_tokens": u.get("completion_tokens", 0),
                        "total_tokens": total_tokens,
                        "duration_ms": u.get("duration_ms", 0),
                        "estimated_cost_usd": estimated_cost,
                        "key_source": key_source,
                        "metadata": metadata or {},
                        "outcome": outcome,
                        "error_kind": error_kind,
                        # Der Riegel steht hier UND als CHECK in Migration 352.
                        # Hier, damit eine lange Anbietermeldung die Buchung
                        # nicht verwirft; dort, damit kein zweiter Schreibweg
                        # daran vorbeikommt.
                        "error_detail": error_detail[:500] if error_detail else None,
                    }
                )
                .execute()
            )

        except Exception as exc:  # noqa: BLE001 — fire-and-forget, must never propagate
            # Nicht mehr `debug`.
            #
            # Am 02.09.2026 gemessen: der Plattformschluessel hat im September
            # 1,33 USD ausgegeben, `ai_usage_log` traegt fuer denselben Zeitraum
            # EINE Zeile ueber 0,000062 USD. Ob Einschuebe scheitern oder ob
            # schlicht nichts erfolgreich lief, war nicht zu unterscheiden --
            # weil ein Scheitern hier auf `debug` landete und der Behaelter mit
            # `DEBUG=false` laeuft. Die Zeile wurde geschrieben und nie gesehen.
            #
            # Ein Kostenbuch, dessen Schreibfehler unsichtbar sind, beantwortet
            # die Frage nicht, fuer die es gebaut wurde ("was kostet Geld"), und
            # es sagt einem das auch nicht. `BudgetEnforcementService.pre_check`
            # wiegt gegen genau diese Tabelle; eine Luecke darin ist eine
            # Obergrenze, die nicht ausloesen kann.
            #
            # Fire-and-forget bleibt es: es wird weiterhin nichts erhoben. Nur
            # ist das Scheitern jetzt zu sehen.
            logger.warning(
                "AI usage log insert failed (non-blocking)",
                extra={"purpose": purpose, "provider": provider, "model": model},
                exc_info=True,
            )
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("service", "AIUsageService")
                scope.set_tag("purpose", purpose)
                scope.set_context("usage_log", {"provider": provider, "model": model})
                sentry_sdk.capture_exception(exc)

    @staticmethod
    async def get_platform_stats(
        admin_supabase: Client,
        days: int = 30,
    ) -> dict:
        """Get aggregated AI usage stats via ``get_ai_usage_stats`` PG function (migration 152)."""
        resp = await admin_supabase.rpc("get_ai_usage_stats", {"p_days": days}).execute()
        return resp.data
