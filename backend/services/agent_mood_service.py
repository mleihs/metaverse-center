"""Agent mood and moodlet management service.

Manages the emotional state of agents: moodlets (individual mood influences)
with three decay types (permanent/timed/decaying) and stacking caps, stress
accumulation, and mood score computation.

All mutations delegate to PostgreSQL functions for atomicity.

PostgreSQL functions used:
- ``fn_expire_autonomy_modifiers`` (migration 145) — bulk-delete expired moodlets
- ``fn_decay_moodlet_strengths`` (migration 145) — linear strength decay
- ``fn_recalculate_mood_scores`` (migration 145) — atomic SUM(moodlets) → mood_score
- ``fn_count_moodlet_stacking`` (migration 145) — stacking cap check
- ``fn_update_stress_levels`` (migration 146) — bulk stress update with mood logic
- ``fn_add_agent_stress`` (migration 146) — atomic stress increment
- ``fn_apply_resonance_moodlets`` (migration 161) — A3 resonance→mood bridge

Inspired by Dwarf Fortress stress system, RimWorld moodlets, CK3 modifiers.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from uuid import UUID

import httpx
import sentry_sdk
import structlog
from postgrest.exceptions import APIError as PostgrestAPIError

from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# ── Stacking caps per group (RimWorld pattern) ───────────────────────────────

STACKING_CAPS: dict[str, int] = {
    "crisis_witness": 3,
    "social_positive": 5,
    "social_negative": 5,
    "zone_ambient": 1,
    "building_condition": 1,
    "shared_experience": 10,
    "celebration": 2,
    "loss": 3,
    "community_response": 2,
    # NOTE: resonance_pressure moodlets are managed by fn_apply_resonance_moodlets
    # (atomic delete-and-replace per tick), NOT by add_moodlet(). No cap entry needed.
}

DEFAULT_STACKING_CAP = 5

# ── Stress thresholds ────────────────────────────────────────────────────────

STRESS_BREAKDOWN_THRESHOLD = 800
STRESS_RECOVERY_PER_TICK = 15  # Base recovery when mood is positive
STRESS_GAIN_MULTIPLIER = 1.5  # Negative moodlets add stress * this


class AgentMoodService:
    """Manages agent emotional state -- moodlets, stress, mood score."""

    @classmethod
    async def process_tick(
        cls,
        supabase: Client,
        simulation_id: UUID,
    ) -> dict:
        """Run full mood housekeeping for a simulation tick.

        1. Expire timed/decaying moodlets past their expiry
        2. Decay strength of decaying moodlets
        3. Recalculate mood scores from active moodlets
        4. Update stress levels
        5. Check for stress breakdowns

        Returns summary dict with counts.
        """
        structlog.contextvars.bind_contextvars(
            simulation_id=str(simulation_id),
            phase="mood_housekeeping",
        )

        # Each phase is independently wrapped so a failure in one
        # does not abort the remaining phases (partial progress > no progress).
        expire_data: dict = {}
        decayed = 0
        recalculated = 0
        stress_updates = 0
        breakdowns: list[str] = []

        # 1. Expire old moodlets + opinion modifiers (PostgreSQL atomic)
        try:
            expire_result = await supabase.rpc(
                "fn_expire_autonomy_modifiers",
                {"p_simulation_id": str(simulation_id)},
            ).execute()
            expire_data = expire_result.data or {}
        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
            logger.exception("Mood tick phase 1 (expire) failed")
            sentry_sdk.capture_exception(exc)

        # 2. Decay strength of decaying moodlets (PostgreSQL atomic)
        try:
            decay_result = await supabase.rpc(
                "fn_decay_moodlet_strengths",
                {"p_simulation_id": str(simulation_id)},
            ).execute()
            decayed = decay_result.data if isinstance(decay_result.data, int) else 0
        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
            logger.exception("Mood tick phase 2 (decay) failed")
            sentry_sdk.capture_exception(exc)

        # 3. Recalculate mood scores (PostgreSQL atomic)
        try:
            mood_result = await supabase.rpc(
                "fn_recalculate_mood_scores",
                {"p_simulation_id": str(simulation_id)},
            ).execute()
            recalculated = mood_result.data if isinstance(mood_result.data, int) else 0
        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
            logger.exception("Mood tick phase 3 (recalculate) failed")
            sentry_sdk.capture_exception(exc)

        # 4. Update stress levels based on current mood
        try:
            stress_updates = await cls._update_stress_levels(supabase, simulation_id)
        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
            logger.exception("Mood tick phase 4 (stress) failed")
            sentry_sdk.capture_exception(exc)

        # 5. Check for breakdowns
        try:
            breakdowns = await cls._check_breakdowns(supabase, simulation_id)
        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
            logger.exception("Mood tick phase 5 (breakdowns) failed")
            sentry_sdk.capture_exception(exc)

        summary = {
            "expired_moodlets": expire_data.get("expired_moodlets", 0),
            "expired_op_mods": expire_data.get("expired_op_mods", 0),
            "decayed_moodlets": decayed,
            "recalculated_moods": recalculated,
            "stress_updates": stress_updates,
            "breakdowns": breakdowns,
        }
        logger.info("Mood tick complete", extra=summary)
        return summary

    @classmethod
    async def add_moodlet(
        cls,
        supabase: Client,
        agent_id: UUID,
        simulation_id: UUID,
        *,
        moodlet_type: str,
        emotion: str,
        strength: int,
        source_type: str,
        source_id: UUID | None = None,
        source_description: str | None = None,
        decay_type: str = "timed",
        duration_hours: float = 48.0,
        stacking_group: str | None = None,
    ) -> bool:
        """Add a moodlet to an agent with stacking cap enforcement.

        Delegates to ``fn_add_moodlet_capped`` (migration 162) which
        atomically checks the stacking cap and inserts in one transaction,
        eliminating the TOCTOU race (ADR-007).

        Returns True if moodlet was added, False if stacking cap was hit.
        """
        # Compute expiry
        expires_at = None
        if decay_type in ("timed", "decaying"):
            expires_at = (datetime.now(UTC) + timedelta(hours=duration_hours)).isoformat()

        # Resolve stacking cap from Python constants (passed to PG for atomic check)
        cap = DEFAULT_STACKING_CAP
        if stacking_group:
            cap = STACKING_CAPS.get(stacking_group, DEFAULT_STACKING_CAP)

        try:
            result = await supabase.rpc(
                "fn_add_moodlet_capped",
                {
                    "p_agent_id": str(agent_id),
                    "p_simulation_id": str(simulation_id),
                    "p_moodlet_type": moodlet_type,
                    "p_emotion": emotion,
                    "p_strength": strength,
                    "p_source_type": source_type,
                    "p_source_id": str(source_id) if source_id else None,
                    "p_source_description": source_description,
                    "p_decay_type": decay_type,
                    "p_initial_strength": strength,
                    "p_expires_at": expires_at,
                    "p_stacking_group": stacking_group,
                    "p_stacking_cap": cap,
                },
            ).execute()

            inserted = result.data is True or result.data == "true"
            if not inserted and stacking_group:
                logger.debug(
                    "Stacking cap reached",
                    extra={"group": stacking_group, "cap": cap},
                )
            return inserted

        except (PostgrestAPIError, httpx.HTTPError) as exc:
            logger.warning(
                "Failed to add moodlet",
                extra={"agent_id": str(agent_id), "moodlet_type": moodlet_type},
            )
            sentry_sdk.capture_exception(exc)
            return False

    @classmethod
    async def get_active_moodlets(
        cls,
        supabase: Client,
        agent_id: UUID,
    ) -> list[dict]:
        """Get all active (non-expired) moodlets for an agent."""
        result = await (
            supabase.table("agent_moodlets")
            .select("*")
            .eq("agent_id", str(agent_id))
            .order("created_at", desc=True)
            .execute()
        )
        return result.data or []

    @classmethod
    async def get_agent_mood(
        cls,
        supabase: Client,
        agent_id: UUID,
        simulation_id: UUID,
    ) -> dict | None:
        """Get the current mood record for an agent."""
        result = await (
            supabase.table("agent_mood")
            .select("*")
            .eq("agent_id", str(agent_id))
            .eq("simulation_id", str(simulation_id))
            .maybe_single()
            .execute()
        )
        return result.data if result else None

    @classmethod
    async def list_moodlets(
        cls,
        supabase: Client,
        agent_id: UUID,
        simulation_id: UUID,
    ) -> list[dict]:
        """List all moodlets for an agent in a simulation."""
        result = await (
            supabase.table("agent_moodlets")
            .select("*")
            .eq("agent_id", str(agent_id))
            .eq("simulation_id", str(simulation_id))
            .order("created_at", desc=True)
            .execute()
        )
        return result.data or []

    @classmethod
    async def apply_resonance_moodlets(
        cls,
        supabase: Client,
        simulation_id: UUID,
    ) -> int:
        """Apply resonance-driven moodlets to all agents in a simulation.

        Delegates to ``fn_apply_resonance_moodlets`` (migration 161) which
        atomically replaces stale resonance_pressure moodlets with fresh ones
        based on currently active/subsiding platform resonances.

        Archetype → emotion mapping (strength −2 to +2):
          The Tower     → anxiety (−2)    The Prometheus → hope (+2)
          The Shadow    → anxiety (−2)    The Awakening  → wonder (+1)
          The Devouring Mother → dread (−2) The Overthrow  → unease (−1)
          The Deluge    → fear (−2)       The Entropy    → despair (−2)

        Returns the number of moodlets inserted.
        """
        result = await supabase.rpc(
            "fn_apply_resonance_moodlets",
            {"p_simulation_id": str(simulation_id)},
        ).execute()
        inserted = result.data if isinstance(result.data, int) else 0

        if inserted > 0:
            logger.info(
                "Resonance moodlets applied",
                extra={"simulation_id": str(simulation_id), "inserted": inserted},
            )
        return inserted

    @classmethod
    async def _update_stress_levels(
        cls,
        supabase: Client,
        simulation_id: UUID,
    ) -> int:
        """Bulk-update stress via ``fn_update_stress_levels`` (migration 146).

        Single SQL UPDATE with CASE logic — no Python loop, no race conditions.
        """
        result = await supabase.rpc(
            "fn_update_stress_levels",
            {
                "p_simulation_id": str(simulation_id),
                "p_recovery_per_tick": STRESS_RECOVERY_PER_TICK,
            },
        ).execute()

        return result.data if isinstance(result.data, int) else 0

    @classmethod
    async def _check_breakdowns(
        cls,
        supabase: Client,
        simulation_id: UUID,
    ) -> list[str]:
        """Check for agents at breakdown stress level. Returns list of agent IDs."""
        result = await (
            supabase.table("agent_mood")
            .select("agent_id")
            .eq("simulation_id", str(simulation_id))
            .gte("stress_level", STRESS_BREAKDOWN_THRESHOLD)
            .execute()
        )
        breakdown_agents = [r["agent_id"] for r in (result.data or [])]

        if breakdown_agents:
            logger.warning(
                "Agents at breakdown stress",
                extra={"count": len(breakdown_agents), "simulation_id": str(simulation_id)},
            )
        return breakdown_agents

    @classmethod
    async def _add_stress(
        cls,
        supabase: Client,
        agent_id: UUID,
        amount: float,
    ) -> None:
        """Atomically add stress via ``fn_add_agent_stress`` (migration 146)."""
        await supabase.rpc(
            "fn_add_agent_stress",
            {
                "p_agent_id": str(agent_id),
                "p_amount": amount,
            },
        ).execute()
