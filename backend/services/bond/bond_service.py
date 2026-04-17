"""Bond service — formation flow, depth progression, strain, farewell.

Manages the lifecycle of player-agent bonds:
  forming (attention tracking) -> active (depth 1-5) -> strained -> farewell

Not a BaseService subclass: bonds are user-scoped (not simulation-CRUD)
with unique access patterns (5-slot limit, forming state, attention RPC).
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from uuid import UUID

from backend.utils.db import maybe_single_data
from backend.utils.errors import bad_request, conflict, not_found
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# ── Constants ──────────────────────────────────────────────────────────────

RECOGNITION_THRESHOLD = 10
OBSERVATION_PERIOD_DAYS = 14
MAX_BONDS_PER_SIMULATION = 5

# Minimum real-time days between depth transitions
DEPTH_MIN_DAYS: dict[int, int] = {2: 7, 3: 14, 4: 21, 5: 28}

# Engagement requirements per depth transition
DEPTH_REQUIREMENTS: dict[int, dict] = {
    2: {"whispers_read": 5},
    3: {"whispers_acted_on": 3},
    4: {"total_memories": 10},
    5: {"reflection_whispers_read": 2},
}

STRAIN_RECOVERY_DAYS = 14

# ── Agent enrichment select ───────────────────────────────────────────────

_BOND_SELECT = "*, agents(name, portrait_image_url)"
_BOND_PUBLIC_SELECT = "id, agent_id, simulation_id, depth, status, formed_at, agents(name, portrait_image_url)"


def _enrich_bond(row: dict) -> dict:
    """Flatten joined agent fields into the bond row."""
    agent = row.pop("agents", None) or {}
    row["agent_name"] = agent.get("name")
    row["agent_portrait_url"] = agent.get("portrait_image_url")
    return row


class BondService:
    """Agent bond lifecycle management."""

    # ── Attention tracking ─────────────────────────────────────────────

    @classmethod
    async def track_attention(
        cls,
        supabase: Client,
        user_id: UUID,
        agent_id: UUID,
        simulation_id: UUID,
    ) -> dict:
        """Increment attention score via atomic RPC.

        Creates a 'forming' bond if none exists. Idempotent for active bonds.
        """
        resp = await supabase.rpc(
            "fn_increment_attention",
            {
                "p_user_id": str(user_id),
                "p_agent_id": str(agent_id),
                "p_simulation_id": str(simulation_id),
            },
        ).execute()

        data = extract_list(resp)
        if not data:
            raise not_found("Agent", agent_id, context="or bond creation failed")
        return data[0]

    # ── Recognition ────────────────────────────────────────────────────

    @classmethod
    async def get_recognition_candidates(
        cls,
        supabase: Client,
        user_id: UUID,
        simulation_id: UUID,
    ) -> list[dict]:
        """Find agents that crossed the attention threshold.

        Returns forming bonds where:
          - attention_score >= RECOGNITION_THRESHOLD
          - created_at is OBSERVATION_PERIOD_DAYS+ days ago
          - status is still 'forming'
        """
        cutoff = (datetime.now(UTC) - timedelta(days=OBSERVATION_PERIOD_DAYS)).isoformat()

        resp = await (
            supabase.table("agent_bonds")
            .select("agent_id, attention_score, simulation_id, agents(name, portrait_image_url)")
            .eq("user_id", str(user_id))
            .eq("simulation_id", str(simulation_id))
            .eq("status", "forming")
            .gte("attention_score", RECOGNITION_THRESHOLD)
            .lte("created_at", cutoff)
            .execute()
        )

        candidates = []
        for row in extract_list(resp):
            agent = row.pop("agents", None) or {}
            candidates.append({
                "agent_id": row["agent_id"],
                "agent_name": agent.get("name", ""),
                "agent_portrait_url": agent.get("portrait_image_url"),
                "attention_score": row["attention_score"],
                "simulation_id": row["simulation_id"],
            })
        return candidates

    # ── Bond formation ─────────────────────────────────────────────────

    @classmethod
    async def form_bond(
        cls,
        supabase: Client,
        user_id: UUID,
        agent_id: UUID,
        simulation_id: UUID,
    ) -> dict:
        """Accept a bond with an agent after recognition.

        Preconditions:
          - A 'forming' bond exists with attention >= threshold
          - User has < MAX_BONDS_PER_SIMULATION active bonds
          - Bond is old enough (observation period met)
        """
        # 1. Verify forming bond exists and meets threshold
        bond = await maybe_single_data(
            supabase.table("agent_bonds")
            .select(_BOND_SELECT)
            .eq("user_id", str(user_id))
            .eq("agent_id", str(agent_id))
            .eq("status", "forming")
            .maybe_single()
        )
        if not bond:
            raise not_found("Bond", context="no forming bond found for this agent")

        if bond["attention_score"] < RECOGNITION_THRESHOLD:
            raise bad_request(
                f"Agent has not reached recognition threshold "
                f"({bond['attention_score']}/{RECOGNITION_THRESHOLD})."
            )

        cutoff = datetime.now(UTC) - timedelta(days=OBSERVATION_PERIOD_DAYS)
        if datetime.fromisoformat(bond["created_at"]) > cutoff:
            raise bad_request(
                f"Bond must be at least {OBSERVATION_PERIOD_DAYS} days old before formation."
            )

        # 2. Transition to active.
        # The fn_bond_lifecycle_guard trigger enforces:
        #   - Status transition validity (forming→active only)
        #   - Slot limit (max 5 active/strained per user+simulation)
        #   - formed_at timestamp auto-set
        # If the trigger rejects, Supabase raises an API error.
        try:
            update_resp = await (
                supabase.table("agent_bonds")
                .update({
                    "status": "active",
                    "depth": 1,
                })
                .eq("id", str(bond["id"]))
                .eq("status", "forming")
                .select(_BOND_SELECT)
                .execute()
            )
        except Exception as exc:
            err_msg = str(exc)
            if "Maximum 5 active bonds" in err_msg:
                raise conflict(
                    f"Maximum {MAX_BONDS_PER_SIMULATION} active bonds "
                    f"per simulation reached."
                ) from exc
            if "Invalid bond status transition" in err_msg:
                raise conflict("Bond was modified concurrently.") from exc
            raise
        updated = extract_list(update_resp)
        if not updated:
            raise conflict("Bond was modified concurrently.")

        # 4. Create milestone memory
        await supabase.table("bond_memories").insert({
            "bond_id": str(bond["id"]),
            "memory_type": "milestone",
            "description": "Bond formed",
            "context": {"formed_at": datetime.now(UTC).isoformat()},
        }).execute()

        return _enrich_bond(updated[0])

    # ── Read operations ────────────────────────────────────────────────

    @classmethod
    async def get_bonds(
        cls,
        supabase: Client,
        user_id: UUID,
        simulation_id: UUID,
    ) -> list[dict]:
        """List all bonds (active, strained, forming) for a user in a simulation."""
        resp = await (
            supabase.table("agent_bonds")
            .select(_BOND_SELECT)
            .eq("user_id", str(user_id))
            .eq("simulation_id", str(simulation_id))
            .order("created_at", desc=True)
            .execute()
        )
        return [_enrich_bond(row) for row in extract_list(resp)]

    @classmethod
    async def get_bond_detail(
        cls,
        supabase: Client,
        user_id: UUID,
        bond_id: UUID,
    ) -> dict:
        """Get full bond detail with recent whispers and agent mood."""
        # Bond with agent enrichment (RLS ensures ownership)
        bond = await maybe_single_data(
            supabase.table("agent_bonds")
            .select(_BOND_SELECT)
            .eq("id", str(bond_id))
            .maybe_single()
        )
        if not bond:
            raise not_found("Bond", bond_id)

        # Verify ownership explicitly (defense in depth beyond RLS)
        if bond["user_id"] != str(user_id):
            raise not_found("Bond", bond_id)

        result = _enrich_bond(bond)

        # Recent whispers (last 10)
        whispers_resp = await (
            supabase.table("bond_whispers")
            .select("*")
            .eq("bond_id", str(bond_id))
            .order("created_at", desc=True)
            .limit(10)
            .execute()
        )
        result["recent_whispers"] = extract_list(whispers_resp)

        # Unread count
        unread_resp = await (
            supabase.table("bond_whispers")
            .select("id", count="exact")
            .eq("bond_id", str(bond_id))
            .is_("read_at", "null")
            .execute()
        )
        result["unread_count"] = unread_resp.count if unread_resp.count is not None else 0

        # Agent mood (from agent_mood table, scoped to simulation for RLS)
        mood = await maybe_single_data(
            supabase.table("agent_mood")
            .select("mood_score, dominant_emotion, stress_level")
            .eq("agent_id", bond["agent_id"])
            .eq("simulation_id", bond["simulation_id"])
            .maybe_single()
        )
        if mood:
            result["agent_mood_score"] = mood.get("mood_score")
            result["agent_dominant_emotion"] = mood.get("dominant_emotion")
            result["agent_stress_level"] = mood.get("stress_level")

        return result

    @classmethod
    async def list_whispers(
        cls,
        supabase: Client,
        user_id: UUID,
        bond_id: UUID,
        *,
        limit: int = 25,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """Get paginated whispers for a bond. RLS enforces ownership."""
        resp = await (
            supabase.table("bond_whispers")
            .select("*", count="exact")
            .eq("bond_id", str(bond_id))
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        total = resp.count if resp.count is not None else 0
        return extract_list(resp), total

    # ── Whisper interactions ───────────────────────────────────────────

    @classmethod
    async def mark_whisper_read(
        cls,
        supabase: Client,
        user_id: UUID,
        bond_id: UUID,
        whisper_id: UUID,
    ) -> dict:
        """Mark a whisper as read. RLS ensures ownership."""
        resp = await (
            supabase.table("bond_whispers")
            .update({"read_at": datetime.now(UTC).isoformat()})
            .eq("id", str(whisper_id))
            .eq("bond_id", str(bond_id))
            .is_("read_at", "null")
            .select("*")
            .execute()
        )
        data = extract_list(resp)
        if not data:
            # Either already read or doesn't exist -- try to fetch it
            existing = await maybe_single_data(
                supabase.table("bond_whispers")
                .select("*")
                .eq("id", str(whisper_id))
                .eq("bond_id", str(bond_id))
                .maybe_single()
            )
            if not existing:
                raise not_found("Whisper", whisper_id)
            return existing
        return data[0]

    @classmethod
    async def mark_whisper_acted(
        cls,
        supabase: Client,
        user_id: UUID,
        bond_id: UUID,
        whisper_id: UUID,
    ) -> dict:
        """Mark a whisper as acted upon. Creates an 'action' memory."""
        resp = await (
            supabase.table("bond_whispers")
            .update({
                "acted_on": True,
            })
            .eq("id", str(whisper_id))
            .eq("bond_id", str(bond_id))
            .select("*")
            .execute()
        )
        data = extract_list(resp)
        if not data:
            raise not_found("Whisper", whisper_id)

        whisper = data[0]

        # Create action memory
        await supabase.table("bond_memories").insert({
            "bond_id": str(bond_id),
            "memory_type": "action",
            "description": f"Player acted on {whisper['whisper_type']} whisper",
            "context": {
                "whisper_id": str(whisper_id),
                "whisper_type": whisper["whisper_type"],
                "acted_at": datetime.now(UTC).isoformat(),
            },
        }).execute()

        return whisper

    # ── Depth progression ──────────────────────────────────────────────

    @classmethod
    async def check_depth_progression(
        cls,
        supabase: Client,
        bond_id: UUID,
    ) -> dict | None:
        """Evaluate if a bond should advance to the next depth.

        Returns updated bond if advanced, None otherwise.
        """
        bond = await maybe_single_data(
            supabase.table("agent_bonds")
            .select("*")
            .eq("id", str(bond_id))
            .eq("status", "active")
            .maybe_single()
        )
        if not bond or bond["depth"] >= 5:
            return None

        current_depth = bond["depth"]
        next_depth = current_depth + 1

        # Check time gate
        min_days = DEPTH_MIN_DAYS[next_depth]
        milestone_field = f"depth_{current_depth}_at" if current_depth > 1 else "formed_at"
        milestone_str = bond.get(milestone_field) or bond.get("formed_at")
        if not milestone_str:
            return None

        milestone_dt = datetime.fromisoformat(milestone_str)
        if datetime.now(UTC) - milestone_dt < timedelta(days=min_days):
            return None

        # Check engagement requirements
        reqs = DEPTH_REQUIREMENTS[next_depth]
        met = await cls._check_engagement(supabase, bond_id, reqs)
        if not met:
            return None

        # Advance depth.
        # The fn_bond_lifecycle_guard trigger enforces:
        #   - Depth monotonicity (can only increase by 1)
        #   - depth_N_at timestamp auto-set
        resp = await (
            supabase.table("agent_bonds")
            .update({"depth": next_depth})
            .eq("id", str(bond_id))
            .select("*")
            .execute()
        )
        updated = extract_list(resp)
        if not updated:
            return None

        # Record milestone memory
        await supabase.table("bond_memories").insert({
            "bond_id": str(bond_id),
            "memory_type": "milestone",
            "description": f"Bond deepened to depth {next_depth}",
            "context": {"depth": next_depth, "advanced_at": datetime.now(UTC).isoformat()},
        }).execute()

        logger.info(
            "Bond depth advanced",
            extra={"bond_id": str(bond_id), "new_depth": next_depth},
        )
        return updated[0]

    @classmethod
    async def _check_engagement(
        cls,
        supabase: Client,
        bond_id: UUID,
        requirements: dict,
    ) -> bool:
        """Check if engagement metrics meet depth advancement requirements."""
        bid = str(bond_id)

        if "whispers_read" in requirements:
            resp = await (
                supabase.table("bond_whispers")
                .select("id", count="exact")
                .eq("bond_id", bid)
                .not_.is_("read_at", "null")
                .execute()
            )
            if (resp.count or 0) < requirements["whispers_read"]:
                return False

        if "whispers_acted_on" in requirements:
            resp = await (
                supabase.table("bond_whispers")
                .select("id", count="exact")
                .eq("bond_id", bid)
                .eq("acted_on", True)
                .execute()
            )
            if (resp.count or 0) < requirements["whispers_acted_on"]:
                return False

        if "total_memories" in requirements:
            resp = await (
                supabase.table("bond_memories")
                .select("id", count="exact")
                .eq("bond_id", bid)
                .execute()
            )
            if (resp.count or 0) < requirements["total_memories"]:
                return False

        if "reflection_whispers_read" in requirements:
            resp = await (
                supabase.table("bond_whispers")
                .select("id", count="exact")
                .eq("bond_id", bid)
                .eq("whisper_type", "reflection")
                .not_.is_("read_at", "null")
                .execute()
            )
            if (resp.count or 0) < requirements["reflection_whispers_read"]:
                return False

        return True

    # ── Strain & recovery ──────────────────────────────────────────────

    @classmethod
    async def enter_strain(
        cls,
        supabase: Client,
        bond_id: UUID,
        reason: str,
    ) -> dict:
        """Transition an active bond to strained status.

        The fn_bond_lifecycle_guard trigger validates the transition.
        """
        resp = await (
            supabase.table("agent_bonds")
            .update({"status": "strained"})
            .eq("id", str(bond_id))
            .eq("status", "active")
            .select("*")
            .execute()
        )
        data = extract_list(resp)
        if not data:
            raise not_found("Bond", bond_id, context="or not in active status")

        await supabase.table("bond_memories").insert({
            "bond_id": str(bond_id),
            "memory_type": "neglect",
            "description": reason,
            "context": {"strained_at": datetime.now(UTC).isoformat()},
        }).execute()

        return data[0]

    @classmethod
    async def recover_from_strain(
        cls,
        supabase: Client,
        bond_id: UUID,
    ) -> dict | None:
        """Check if a strained bond should recover.

        Recovery: 14+ days strained with 3+ acted_on whispers during strain period.
        Uses the latest 'neglect' memory's created_at as the authoritative
        strain start time (not updated_at, which any trigger could change).
        """
        bond = await maybe_single_data(
            supabase.table("agent_bonds")
            .select("*")
            .eq("id", str(bond_id))
            .eq("status", "strained")
            .maybe_single()
        )
        if not bond:
            return None

        # Find the strain start from the latest neglect memory
        neglect = await maybe_single_data(
            supabase.table("bond_memories")
            .select("created_at")
            .eq("bond_id", str(bond_id))
            .eq("memory_type", "neglect")
            .order("created_at", desc=True)
            .limit(1)
            .maybe_single()
        )
        strain_start = (neglect or {}).get("created_at")
        if not strain_start:
            return None

        strain_dt = datetime.fromisoformat(strain_start)
        if datetime.now(UTC) - strain_dt < timedelta(days=STRAIN_RECOVERY_DAYS):
            return None

        # Check acted-on whispers since strain started
        acted_resp = await (
            supabase.table("bond_whispers")
            .select("id", count="exact")
            .eq("bond_id", str(bond_id))
            .eq("acted_on", True)
            .gte("created_at", strain_start)
            .execute()
        )
        if (acted_resp.count or 0) < 3:
            return None

        # Recover
        now = datetime.now(UTC).isoformat()
        resp = await (
            supabase.table("agent_bonds")
            .update({"status": "active", "updated_at": now})
            .eq("id", str(bond_id))
            .select("*")
            .execute()
        )
        recovered = extract_list(resp)
        if not recovered:
            return None

        await supabase.table("bond_memories").insert({
            "bond_id": str(bond_id),
            "memory_type": "milestone",
            "description": "Bond recovered from strain",
            "context": {"recovered_at": now},
        }).execute()

        logger.info("Bond recovered from strain", extra={"bond_id": str(bond_id)})
        return recovered[0]

    # ── Farewell ───────────────────────────────────────────────────────

    @classmethod
    async def farewell(
        cls,
        supabase: Client,
        bond_id: UUID,
    ) -> dict:
        """End a bond permanently (agent deleted or explicit farewell).

        The fn_bond_lifecycle_guard trigger enforces:
          - Status transition validity (active/strained→farewell only)
          - farewell_at timestamp auto-set
        """
        resp = await (
            supabase.table("agent_bonds")
            .update({"status": "farewell"})
            .eq("id", str(bond_id))
            .in_("status", ["active", "strained"])
            .select("*")
            .execute()
        )
        data = extract_list(resp)
        if not data:
            raise not_found("Bond", bond_id, context="or already farewelled")

        await supabase.table("bond_memories").insert({
            "bond_id": str(bond_id),
            "memory_type": "farewell",
            "description": "Bond ended",
            "context": {"farewell_at": datetime.now(UTC).isoformat()},
        }).execute()

        logger.info("Bond farewell", extra={"bond_id": str(bond_id)})
        return data[0]

    # ── Public endpoint ────────────────────────────────────────────────

    @classmethod
    async def get_public_bonds(
        cls,
        supabase: Client,
        simulation_id: UUID,
        *,
        limit: int = 25,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """List bonds for public display (no user-specific data)."""
        resp = await (
            supabase.table("agent_bonds")
            .select(_BOND_PUBLIC_SELECT, count="exact")
            .eq("simulation_id", str(simulation_id))
            .in_("status", ["active", "strained"])
            .order("formed_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        total = resp.count if resp.count is not None else 0
        bonds = [_enrich_bond(row) for row in extract_list(resp)]
        return bonds, total
