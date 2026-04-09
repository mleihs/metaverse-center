"""Shared constants, types, and utility functions for dungeon sub-services.

Extracted from dungeon_engine_service.py to avoid circular imports between
DungeonCheckpointService, DungeonCombatService, DungeonMovementService,
and DungeonDistributionService.

All dungeon sub-services import from here rather than from each other or
from the engine facade.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any
from uuid import UUID

import sentry_sdk
from postgrest.exceptions import APIError as PostgrestAPIError

from supabase import AsyncClient as Client

if TYPE_CHECKING:
    from backend.models.resonance_dungeon import DungeonInstance

logger = logging.getLogger(__name__)


# ── Constants ──────────────────────────────────────────────────────────────

MAX_CONCURRENT_PER_SIM = 1
INSTANCE_TTL_SECONDS = 1800  # 30 min inactive → auto-cleanup
COMBAT_PLANNING_TIMEOUT_MS = 45_000
DISTRIBUTION_TIMEOUT_MS = 300_000  # 5 min for loot distribution
CLIENT_TIMER_BUFFER_MS = 3_000  # Client timer is shorter than server timer
_RPC_MAX_ATTEMPTS = 2

# Effect types that auto-apply without player choice:
# stress_heal → all operational agents, event/arc_modifier → simulation-wide, dungeon_buff → runtime
AUTO_APPLY_EFFECT_TYPES = frozenset({"stress_heal", "event_modifier", "arc_modifier", "dungeon_buff"})

# ── Archetype Fallback Spawns ──────────────────────────────────────────────
# Used when no encounter template matches (shouldn't happen, but safety net).

FALLBACK_SPAWNS: dict[str, dict[str, str]] = {
    "The Shadow": {
        "boss": "shadow_remnant_spawn",
        "default": "shadow_whispers_spawn",
        "rest_ambush": "shadow_rest_ambush_spawn",
    },
    "The Tower": {
        "boss": "tower_collapse_spawn",
        "default": "tower_tremor_spawn",
        "rest_ambush": "tower_rest_ambush_spawn",
    },
    "The Devouring Mother": {
        "boss": "mother_living_altar_spawn",
        "default": "mother_weaver_drift_spawn",
        "rest_ambush": "mother_rest_ambush_spawn",
    },
    "The Prometheus": {
        "boss": "prometheus_prototype_boss_spawn",
        "default": "prometheus_workshop_patrol_spawn",
        "rest_ambush": "prometheus_rest_ambush_spawn",
    },
    "The Deluge": {
        "boss": "deluge_warden_spawn",
        "default": "deluge_trickle_spawn",
        "rest_ambush": "deluge_rest_ambush_spawn",
    },
    "The Entropy": {
        "boss": "entropy_warden_spawn",
        "default": "entropy_drift_spawn",
        "rest_ambush": "entropy_rest_ambush_spawn",
    },
    "The Awakening": {
        "boss": "awakening_sentinel_spawn",
        "default": "awakening_echo_drift_spawn",
        "rest_ambush": "awakening_rest_ambush_spawn",
    },
}


# ── Utility Functions ──────────────────────────────────────────────────────


def log_extra(instance: DungeonInstance, **kwargs: Any) -> dict[str, Any]:
    """Build structured log extra dict from a dungeon instance.

    Standard fields (always included): run_id, sim_id, archetype, difficulty.
    Additional fields passed via kwargs (e.g. phase, rooms_cleared, outcome).
    Consumed by structlog ExtraAdder → JSON output in production.
    """
    return {
        "run_id": str(instance.run_id),
        "sim_id": str(instance.simulation_id),
        "archetype": instance.archetype,
        "difficulty": instance.difficulty,
        **kwargs,
    }


async def rpc_with_retry(
    admin_supabase: Client,
    rpc_name: str,
    params: dict,
    *,
    run_id: UUID,
    context: str,
) -> Any:
    """Execute a Postgres RPC with one immediate retry on transient failure.

    All dungeon finalization RPCs are idempotent (status updates, CAS loot),
    so retrying is safe. Logs + Sentry on final failure, then re-raises.
    """
    last_exc: Exception | None = None
    for attempt in range(_RPC_MAX_ATTEMPTS):
        try:
            return await admin_supabase.rpc(rpc_name, params).execute()
        except PostgrestAPIError as exc:
            last_exc = exc
            if attempt < _RPC_MAX_ATTEMPTS - 1:
                logger.warning(
                    "RPC failed, retrying",
                    extra={
                        "run_id": str(run_id),
                        "rpc": rpc_name,
                        "attempt": attempt + 1,
                        "max_attempts": _RPC_MAX_ATTEMPTS,
                    },
                )
                continue
            logger.exception(
                "RPC failed after all attempts",
                extra={
                    "run_id": str(run_id),
                    "rpc": rpc_name,
                    "context": context,
                    "attempts": _RPC_MAX_ATTEMPTS,
                },
            )
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("service", "dungeon_engine")
                scope.set_tag("run_id", str(run_id))
                scope.set_tag("rpc", rpc_name)
                scope.set_tag("context", context)
                sentry_sdk.capture_exception(exc)
            raise
    raise last_exc  # type: ignore[misc]  # unreachable, satisfies type checker


async def award_secret_badge(
    admin_supabase: Client,
    instance: DungeonInstance,
    achievement_id: str,
    extra_context: dict[str, Any] | None = None,
) -> None:
    """Best-effort award of a secret achievement badge during a dungeon run.

    Calls fn_award_achievement RPC for each human player in the run.
    Non-critical: swallows all exceptions to avoid breaking the dungeon flow.
    The RPC itself is idempotent (ON CONFLICT DO NOTHING).
    """
    context = {
        "archetype": instance.archetype,
        "run_id": str(instance.run_id),
        "simulation_id": str(instance.simulation_id),
        **(extra_context or {}),
    }
    for player_id in instance.player_ids:
        try:
            await admin_supabase.rpc(
                "fn_award_achievement",
                {
                    "p_user_id": str(player_id),
                    "p_achievement_id": achievement_id,
                    "p_context": context,
                },
            ).execute()
        except Exception:
            logger.warning(
                "Secret badge award failed (non-critical)",
                extra={
                    "run_id": str(instance.run_id),
                    "achievement_id": achievement_id,
                    "player_id": str(player_id),
                },
            )
