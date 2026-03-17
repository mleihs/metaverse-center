"""Anchor Service — collaborative cross-simulation anchoring.

Simulation owners connected by embassies pool stability to reduce
resonance impact for all participants.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from uuid import UUID, uuid4

from fastapi import HTTPException, status

from supabase import Client

logger = logging.getLogger(__name__)


class AnchorService:
    """CRUD + tick-resolution for collaborative anchors."""

    # ── CRUD ────────────────────────────────────────────────────

    @classmethod
    async def create_anchor(
        cls, supabase: Client,
        resonance_id: UUID, resonance_signature: str,
        sim_id: UUID, user_id: UUID,
        name: str,
    ) -> dict:
        """Create a collaborative anchor for a resonance."""
        # Validate resonance exists
        resonance = (
            supabase.table("substrate_resonances")
            .select("id, status")
            .eq("id", str(resonance_id))
            .limit(1)
            .execute()
        ).data
        if not resonance:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resonance not found.",
            )

        # Check embassy connections exist
        embassies = (
            supabase.table("embassies")
            .select("id")
            .or_(
                f"simulation_a_id.eq.{sim_id},simulation_b_id.eq.{sim_id}",
            )
            .eq("status", "active")
            .limit(1)
            .execute()
        ).data
        if not embassies:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Anchoring requires at least one active embassy connection.",
            )

        # Get simulation's current tick
        sim = (
            supabase.table("simulations")
            .select("last_heartbeat_tick")
            .eq("id", str(sim_id))
            .limit(1)
            .execute()
        ).data
        current_tick = (sim[0].get("last_heartbeat_tick") or 0) if sim else 0

        response = (
            supabase.table("collaborative_anchors")
            .insert({
                "name": name,
                "resonance_id": str(resonance_id),
                "resonance_signature": resonance_signature,
                "anchor_simulation_ids": [str(sim_id)],
                "strength": 0.0,
                "status": "forming",
                "formed_at_tick": current_tick,
                "created_by_simulation_id": str(sim_id),
                "created_by_user_id": str(user_id),
            })
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create anchor.",
            )

        logger.info(
            "Anchor created: '%s' for resonance %s by sim %s",
            name, resonance_id, sim_id,
            extra={
                "anchor_id": response.data[0]["id"],
                "resonance_id": str(resonance_id),
                "simulation_id": str(sim_id),
            },
        )
        return response.data[0]

    @classmethod
    async def join_anchor(
        cls, supabase: Client,
        anchor_id: UUID, sim_id: UUID, user_id: UUID,
    ) -> dict:
        """Join an existing anchor."""
        anchor = (
            supabase.table("collaborative_anchors")
            .select("*")
            .eq("id", str(anchor_id))
            .in_("status", ["forming", "active"])
            .limit(1)
            .execute()
        ).data
        if not anchor:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Anchor not found or no longer accepting participants.",
            )

        anchor = anchor[0]
        sim_ids = anchor.get("anchor_simulation_ids") or []
        if str(sim_id) in sim_ids:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Simulation already participating in this anchor.",
            )

        # Add simulation
        sim_ids.append(str(sim_id))
        response = (
            supabase.table("collaborative_anchors")
            .update({
                "anchor_simulation_ids": sim_ids,
                "updated_at": datetime.now(UTC).isoformat(),
            })
            .eq("id", str(anchor_id))
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to join anchor.",
            )

        logger.info(
            "Simulation %s joined anchor %s", sim_id, anchor_id,
            extra={"simulation_id": str(sim_id), "anchor_id": str(anchor_id)},
        )
        return response.data[0]

    @classmethod
    async def leave_anchor(
        cls, supabase: Client,
        anchor_id: UUID, sim_id: UUID,
    ) -> dict:
        """Leave an anchor."""
        anchor = (
            supabase.table("collaborative_anchors")
            .select("*")
            .eq("id", str(anchor_id))
            .limit(1)
            .execute()
        ).data
        if not anchor:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Anchor not found.",
            )

        anchor = anchor[0]
        sim_ids = anchor.get("anchor_simulation_ids") or []
        if str(sim_id) not in sim_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Simulation not participating in this anchor.",
            )

        sim_ids.remove(str(sim_id))
        update_data: dict = {
            "anchor_simulation_ids": sim_ids,
            "updated_at": datetime.now(UTC).isoformat(),
        }
        if not sim_ids:
            update_data["status"] = "dissolved"

        response = (
            supabase.table("collaborative_anchors")
            .update(update_data)
            .eq("id", str(anchor_id))
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to leave anchor.",
            )

        return response.data[0]

    @classmethod
    async def list_anchors(
        cls, supabase: Client,
        status_filter: str | None = None,
        sim_id: UUID | None = None,
        limit: int = 50, offset: int = 0,
    ) -> tuple[list[dict], int]:
        """List collaborative anchors, optionally filtered."""
        query = (
            supabase.table("collaborative_anchors")
            .select("*", count="exact")
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
        )
        if status_filter:
            query = query.eq("status", status_filter)
        if sim_id:
            query = query.contains("anchor_simulation_ids", [str(sim_id)])
        response = query.execute()
        return response.data or [], response.count or 0

    # ── Tick Resolution (Phase 7) ───────────────────────────────

    @classmethod
    async def strengthen_at_tick(
        cls, admin: Client, sim_id: UUID,
        tick_number: int, heartbeat_id: UUID,
        config: dict,
    ) -> list[dict]:
        """Strengthen anchors this simulation participates in. Phase 7."""
        entries: list[dict] = []
        growth_per_sim = config.get("anchor_growth_per_sim", 0.03)

        # Get active anchors this simulation participates in
        anchors = (
            admin.table("collaborative_anchors")
            .select("*")
            .in_("status", ["forming", "active", "reinforcing"])
            .contains("anchor_simulation_ids", [str(sim_id)])
            .execute()
        ).data or []

        if not anchors:
            return entries

        for anchor in anchors:
            anchor_id = anchor["id"]
            participants = anchor.get("anchor_simulation_ids") or []
            participant_count = len(participants)
            strength = float(anchor.get("strength", 0))
            ticks_active = (anchor.get("ticks_active") or 0) + 1

            # Grow strength
            growth = round(growth_per_sim * participant_count, 4)
            new_strength = round(min(1.0, strength + growth), 4)

            # Status transitions
            new_status = anchor["status"]
            if new_status == "forming" and ticks_active >= 2:
                new_status = "active"
            elif new_status == "active" and new_strength > 0.5:
                new_status = "reinforcing"

            admin.table("collaborative_anchors").update({
                "strength": new_strength,
                "ticks_active": ticks_active,
                "status": new_status,
                "updated_at": datetime.now(UTC).isoformat(),
            }).eq("id", anchor_id).execute()

            # Compute protection factor
            cap = config.get("anchor_protection_cap", 0.70)
            protection = round(min(cap, new_strength * (participant_count / 5)), 4)

            entries.append({
                "id": str(uuid4()),
                "heartbeat_id": str(heartbeat_id),
                "simulation_id": str(sim_id),
                "tick_number": tick_number,
                "entry_type": "anchor_strengthen",
                "narrative_en": (
                    f"Anchor '{anchor['name']}' strengthened "
                    f"({strength:.2f} -> {new_strength:.2f}). "
                    f"{participant_count} shard(s) participating. "
                    f"Protection factor: {protection:.2f}."
                ),
                "narrative_de": (
                    f"Anker '{anchor['name']}' verstaerkt "
                    f"({strength:.2f} -> {new_strength:.2f}). "
                    f"{participant_count} Scherbe(n) beteiligt. "
                    f"Schutzfaktor: {protection:.2f}."
                ),
                "metadata": {
                    "anchor_id": anchor_id, "old_strength": strength,
                    "new_strength": new_strength, "protection": protection,
                    "participant_count": participant_count,
                },
                "severity": "positive" if new_strength > strength else "info",
            })

        return entries

    # ── Protection Calculation ──────────────────────────────────

    @classmethod
    async def get_protection_factor(
        cls, admin: Client, sim_id: UUID,
    ) -> float:
        """Calculate total anchor protection for a simulation."""
        anchors = (
            admin.table("collaborative_anchors")
            .select("strength, anchor_simulation_ids")
            .in_("status", ["active", "reinforcing"])
            .contains("anchor_simulation_ids", [str(sim_id)])
            .execute()
        ).data or []

        total_protection = 0.0
        for anchor in anchors:
            participants = len(anchor.get("anchor_simulation_ids") or [])
            strength = float(anchor.get("strength", 0))
            protection = min(0.70, strength * (participants / 5))  # Static cap for query helper
            total_protection = min(0.70, total_protection + protection)

        return round(total_protection, 4)
