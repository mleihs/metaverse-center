"""Anchor Service — collaborative cross-simulation anchoring.

Simulation owners connected by embassies pool stability to reduce
resonance impact for all participants.
"""

from __future__ import annotations

import json
import logging
from uuid import UUID

from backend.services.heartbeat_entry_builder import make_heartbeat_entry
from backend.utils.errors import bad_request, conflict, not_found, server_error
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


class AnchorService:
    """CRUD + tick-resolution for collaborative anchors."""

    # ── CRUD ────────────────────────────────────────────────────

    @classmethod
    async def create_anchor(
        cls,
        supabase: Client,
        resonance_id: UUID,
        resonance_signature: str,
        sim_id: UUID,
        user_id: UUID,
        name: str,
    ) -> dict:
        """Create a collaborative anchor for a resonance."""
        # Validate resonance exists
        _resp = await (
            supabase.table("substrate_resonances").select("id, status").eq("id", str(resonance_id)).limit(1).execute()
        )
        resonance = _resp.data
        if not resonance:
            raise not_found(detail="Resonance not found.")

        # Check embassy connections exist
        _resp = await (
            supabase.table("embassies")
            .select("id")
            .or_(
                f"simulation_a_id.eq.{sim_id},simulation_b_id.eq.{sim_id}",
            )
            .eq("status", "active")
            .limit(1)
            .execute()
        )
        embassies = _resp.data
        if not embassies:
            raise bad_request("Anchoring requires at least one active embassy connection.")

        # Get simulation's current tick
        _resp = await (
            supabase.table("simulations").select("last_heartbeat_tick").eq("id", str(sim_id)).limit(1).execute()
        )
        sim = _resp.data
        current_tick = (sim[0].get("last_heartbeat_tick") or 0) if sim else 0

        response = await (
            supabase.table("collaborative_anchors")
            .insert(
                {
                    "name": name,
                    "resonance_id": str(resonance_id),
                    "resonance_signature": resonance_signature,
                    "anchor_simulation_ids": [str(sim_id)],
                    "strength": 0.0,
                    "status": "forming",
                    "formed_at_tick": current_tick,
                    "created_by_simulation_id": str(sim_id),
                    "created_by_user_id": str(user_id),
                }
            )
            .execute()
        )

        if not response.data:
            raise server_error("Failed to create anchor.")

        logger.info(
            "Anchor created: '%s' for resonance %s by sim %s",
            name,
            resonance_id,
            sim_id,
            extra={
                "anchor_id": response.data[0]["id"],
                "resonance_id": str(resonance_id),
                "simulation_id": str(sim_id),
            },
        )
        return response.data[0]

    @staticmethod
    def _rpc_payload(result: object) -> dict:
        """Collapse a jsonb-returning RPC result into a plain dict."""
        data = getattr(result, "data", result)
        if isinstance(data, str):
            data = json.loads(data)
        if isinstance(data, list):
            data = data[0] if data else None
        if not isinstance(data, dict):
            raise server_error("Unexpected anchor RPC result shape.")
        return data

    @classmethod
    async def join_anchor(
        cls,
        admin: Client,
        anchor_id: UUID,
        sim_id: UUID,
        user_id: UUID,
    ) -> dict:
        """Join an existing anchor via the atomic ``fn_anchor_join`` RPC.

        The dedup-append and the status guard run in ONE statement
        (migration 271), so concurrent joins cannot lose participants
        (ADR-007). Service-role client required: the RPC's write rides on
        the service_role RLS policy; the router validates the editor role
        before calling in.
        """
        result = await admin.rpc(
            "fn_anchor_join",
            {"p_anchor_id": str(anchor_id), "p_sim_id": str(sim_id)},
        ).execute()
        payload = cls._rpc_payload(result)

        outcome = payload.get("outcome")
        if outcome in ("not_found", "not_accepting"):
            raise not_found(detail="Anchor not found or no longer accepting participants.")
        if outcome == "already_member":
            raise conflict("Simulation already participating in this anchor.")
        if outcome != "joined" or not payload.get("anchor"):
            raise server_error("Failed to join anchor.")

        logger.info(
            "Simulation %s joined anchor %s",
            sim_id,
            anchor_id,
            extra={"simulation_id": str(sim_id), "anchor_id": str(anchor_id)},
        )
        return payload["anchor"]

    @classmethod
    async def leave_anchor(
        cls,
        admin: Client,
        anchor_id: UUID,
        sim_id: UUID,
    ) -> dict:
        """Leave an anchor via the atomic ``fn_anchor_leave`` RPC.

        Removal and the dissolve-on-last-participant decision happen in
        ONE statement (migration 271) — a leave racing a join can no
        longer wrongly dissolve or resurrect the anchor (ADR-007).
        """
        result = await admin.rpc(
            "fn_anchor_leave",
            {"p_anchor_id": str(anchor_id), "p_sim_id": str(sim_id)},
        ).execute()
        payload = cls._rpc_payload(result)

        outcome = payload.get("outcome")
        if outcome == "not_found":
            raise not_found(detail="Anchor not found.")
        if outcome == "not_member":
            raise bad_request("Simulation not participating in this anchor.")
        if outcome != "left" or not payload.get("anchor"):
            raise server_error("Failed to leave anchor.")

        return payload["anchor"]

    @classmethod
    async def list_anchors(
        cls,
        supabase: Client,
        status_filter: str | None = None,
        sim_id: UUID | None = None,
        limit: int = 50,
        offset: int = 0,
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
        response = await query.execute()
        return extract_list(response), response.count or 0

    # ── Tick Resolution (Phase 7) ───────────────────────────────

    @classmethod
    async def strengthen_at_tick(
        cls,
        admin: Client,
        sim_id: UUID,
        tick_number: int,
        heartbeat_id: UUID,
        config: dict,
    ) -> list[dict]:
        """Strengthen anchors this simulation participates in via batch RPC. Phase 7."""
        entries: list[dict] = []

        # Single RPC call handles all anchor updates
        result = await admin.rpc(
            "fn_strengthen_anchors_batch",
            {
                "p_sim_id": str(sim_id),
                "p_growth_per_sim": config.get("anchor_growth_per_sim", 0.03),
                "p_protection_cap": config.get("anchor_protection_cap", 0.70),
            },
        ).execute()

        changes = extract_list(result)
        if isinstance(changes, str):
            changes = json.loads(changes)

        for change in changes:
            anchor_id = change["anchor_id"]
            anchor_name = change["anchor_name"]
            old_strength = float(change["old_strength"])
            new_strength = float(change["new_strength"])
            protection = float(change["protection"])
            participant_count = int(change["participant_count"])

            entries.append(
                make_heartbeat_entry(
                    heartbeat_id,
                    sim_id,
                    tick_number,
                    "anchor_strengthen",
                    (
                        f"Anchor '{anchor_name}' strengthened "
                        f"({old_strength:.2f} -> {new_strength:.2f}). "
                        f"{participant_count} shard(s) participating. "
                        f"Protection factor: {protection:.2f}."
                    ),
                    (
                        f"Anker '{anchor_name}' verstaerkt "
                        f"({old_strength:.2f} -> {new_strength:.2f}). "
                        f"{participant_count} Scherbe(n) beteiligt. "
                        f"Schutzfaktor: {protection:.2f}."
                    ),
                    severity="positive" if new_strength > old_strength else "info",
                    metadata={
                        "anchor_id": anchor_id,
                        "old_strength": old_strength,
                        "new_strength": new_strength,
                        "protection": protection,
                        "participant_count": participant_count,
                    },
                )
            )

        return entries

    # ── Protection Calculation ──────────────────────────────────

    @classmethod
    async def get_protection_factor(
        cls,
        admin: Client,
        sim_id: UUID,
    ) -> float:
        """Calculate total anchor protection for a simulation."""
        _resp = await (
            admin.table("collaborative_anchors")
            .select("strength, anchor_simulation_ids")
            .in_("status", ["active", "reinforcing"])
            .contains("anchor_simulation_ids", [str(sim_id)])
            .execute()
        )
        anchors = extract_list(_resp)

        total_protection = 0.0
        for anchor in anchors:
            participants = len(anchor.get("anchor_simulation_ids") or [])
            strength = float(anchor.get("strength", 0))
            protection = min(0.70, strength * (participants / 5))  # Static cap for query helper
            total_protection = min(0.70, total_protection + protection)

        return round(total_protection, 4)
