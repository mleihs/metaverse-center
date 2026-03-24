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

from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# Approximate cost per 1M tokens (USD) by model prefix.
# Source: OpenRouter pricing page. Updated 2026-03-23.
# Used for estimated_cost_usd — not for billing, just visibility.
MODEL_COST_PER_1M_TOKENS: dict[str, float] = {
    "anthropic/claude-sonnet-4": 3.00,
    "anthropic/claude-opus-4": 15.00,
    "anthropic/claude-haiku-4": 0.80,
    "deepseek/deepseek-chat": 0.14,
    "deepseek/deepseek-r1": 0.55,
    "google/gemini-2.0-flash": 0.10,
    "google/gemini-2.5-pro": 1.25,
    "meta-llama/llama-3.3-70b": 0.30,
}

# Approximate cost per image generation (USD) by model.
IMAGE_COST_PER_CALL: dict[str, float] = {
    "black-forest-labs/flux-1.1-pro": 0.040,
    "black-forest-labs/flux-dev": 0.025,
    "black-forest-labs/flux-schnell": 0.003,
}


def _estimate_cost(provider: str, model: str, total_tokens: int) -> float:
    """Estimate USD cost from token count and model pricing."""
    if provider == "replicate":
        return IMAGE_COST_PER_CALL.get(model, 0.025)

    # OpenRouter: find best matching model prefix
    for prefix, cost in MODEL_COST_PER_1M_TOKENS.items():
        if model.startswith(prefix):
            return (total_tokens / 1_000_000) * cost

    # Unknown model: conservative estimate
    return (total_tokens / 1_000_000) * 1.00


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
        """
        try:
            u = usage or {}
            total_tokens = u.get("total_tokens", 0)
            estimated_cost = _estimate_cost(provider, model, total_tokens)

            await admin_supabase.table("ai_usage_log").insert({
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
            }).execute()

        except Exception:  # noqa: BLE001 — fire-and-forget, must never propagate
            logger.debug("AI usage log insert failed (non-blocking)", exc_info=True)

    @staticmethod
    async def get_platform_stats(
        admin_supabase: Client,
        days: int = 30,
    ) -> dict:
        """Get aggregated AI usage stats via ``get_ai_usage_stats`` PG function (migration 152)."""
        resp = await admin_supabase.rpc(
            "get_ai_usage_stats", {"p_days": days}
        ).execute()
        return resp.data
