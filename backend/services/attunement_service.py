"""Attunement Service — substrate harmonics (long-term strategic player system).

Players choose up to 2 resonance signatures to attune to.
Attunement deepens each tick, eventually producing positive events.
"""

from __future__ import annotations

import json
import logging
import random
from uuid import UUID, uuid4

from backend.models.resonance import RESONANCE_SIGNATURES
from backend.services.heartbeat_entry_builder import make_heartbeat_entry
from backend.services.platform_config_service import PlatformConfigService
from backend.utils.errors import bad_request, conflict, not_found, server_error
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# Positive event templates by signature
POSITIVE_EVENTS = {
    "economic_tremor": [
        ("Market Boom in {zone}", "Trade agreements flourish, prices stabilize."),
        ("Trade Windfall in {zone}", "Unexpected commerce surge brings prosperity."),
    ],
    "conflict_wave": [
        ("Peace Accord in {zone}", "Warring factions reach a diplomatic breakthrough."),
        ("Diplomatic Breakthrough in {zone}", "Negotiations succeed against all odds."),
    ],
    "elemental_surge": [
        ("Geological Discovery in {zone}", "Beneficial mineral deposits revealed by seismic activity."),
        ("Fertile Aftermath in {zone}", "Rich soil from volcanic activity enables growth."),
    ],
    "biological_tide": [
        ("Medical Breakthrough in {zone}", "Crisis research yields unexpected cures."),
        ("Immune Adaptation in {zone}", "Population develops natural resistance."),
    ],
    "authority_fracture": [
        ("Democratic Reform in {zone}", "Power vacuum filled by fair governance."),
        ("Civic Renaissance in {zone}", "Communities self-organize into resilient structures."),
    ],
    "innovation_spark": [
        ("Technology Dividend in {zone}", "Disruptive tech creates new opportunities."),
        ("Innovation Harvest in {zone}", "R&D investment pays off spectacularly."),
    ],
    "consciousness_drift": [
        ("Cultural Awakening in {zone}", "Collective consciousness shift brings clarity."),
        ("Philosophical Harmony in {zone}", "Society finds new meaning and purpose."),
    ],
    "decay_bloom": [
        ("Ecological Recovery in {zone}", "Nature reclaims and heals damaged land."),
        ("Green Renaissance in {zone}", "Environmental crisis catalyzes sustainable practices."),
    ],
}

_DEFAULT_MAX_ATTUNEMENTS = 2
_DEFAULT_SWITCHING_COOLDOWN_TICKS = 3
_DEFAULT_POSITIVE_EVENT_PROBABILITY = 0.20


class AttunementService:
    """CRUD + tick-resolution for substrate attunements."""

    # ── CRUD ────────────────────────────────────────────────────

    @classmethod
    async def set_attunement(
        cls,
        supabase: Client,
        sim_id: UUID,
        signature: str,
        user_id: UUID,
    ) -> dict:
        """Set a resonance signature attunement (max 2 per sim)."""
        if signature not in RESONANCE_SIGNATURES:
            raise bad_request(f"Invalid resonance signature '{signature}'.")

        # Load max attunements from config via PlatformConfigService
        att_config = await PlatformConfigService.get_multiple(
            supabase,
            {
                "max_attunements": _DEFAULT_MAX_ATTUNEMENTS,
                "switching_cooldown_ticks": _DEFAULT_SWITCHING_COOLDOWN_TICKS,
            },
            prefix="heartbeat_",
        )
        max_attunements = att_config["max_attunements"]
        cooldown_ticks = att_config["switching_cooldown_ticks"]

        # Check current attunement count
        _resp = await (
            supabase.table("substrate_attunements")
            .select("id, resonance_signature")
            .eq("simulation_id", str(sim_id))
            .execute()
        )
        existing = _resp.data or []

        if len(existing) >= max_attunements:
            raise bad_request(f"Maximum {max_attunements} attunements per simulation. Remove one first.")

        # Check if already attuned to this signature
        if any(a["resonance_signature"] == signature for a in existing):
            raise conflict(f"Already attuned to '{signature}'.")

        response = await (
            supabase.table("substrate_attunements")
            .insert(
                {
                    "simulation_id": str(sim_id),
                    "resonance_signature": signature,
                    "depth": 0.0,
                    "ticks_exposed": 0,
                    "switching_cooldown_ticks": cooldown_ticks,
                    "created_by_id": str(user_id),
                }
            )
            .execute()
        )

        if not response.data:
            raise server_error("Failed to create attunement.")

        logger.info(
            "Attunement set: %s for sim %s",
            signature,
            sim_id,
            extra={"simulation_id": str(sim_id), "signature": signature},
        )
        return response.data[0]

    @classmethod
    async def remove_attunement(
        cls,
        supabase: Client,
        sim_id: UUID,
        signature: str,
    ) -> dict:
        """Remove an attunement."""
        response = await (
            supabase.table("substrate_attunements")
            .delete()
            .eq("simulation_id", str(sim_id))
            .eq("resonance_signature", signature)
            .execute()
        )
        if not response.data:
            raise not_found(detail=f"Attunement to '{signature}' not found.")
        logger.info(
            "Attunement removed: %s for sim %s",
            signature,
            sim_id,
            extra={"simulation_id": str(sim_id), "signature": signature},
        )
        return response.data[0]

    @classmethod
    async def list_attunements(
        cls,
        supabase: Client,
        sim_id: UUID,
    ) -> list[dict]:
        """List all attunements for a simulation."""
        response = await (
            supabase.table("substrate_attunements")
            .select("*")
            .eq("simulation_id", str(sim_id))
            .order("created_at")
            .execute()
        )
        return response.data or []

    # ── Tick Resolution (Phase 6) ───────────────────────────────

    @classmethod
    async def deepen_at_tick(
        cls,
        admin: Client,
        sim_id: UUID,
        tick_number: int,
        heartbeat_id: UUID,
        config: dict,
    ) -> list[dict]:
        """Deepen attunements each tick via batch RPC. Called from HeartbeatService Phase 6."""
        entries: list[dict] = []
        growth_rate = config.get("attunement_growth_rate", 0.05)
        passive_rate = config.get("attunement_passive_growth_rate", 0.01)

        # Single RPC call handles cooldown, event checks, and depth updates
        result = await admin.rpc(
            "fn_deepen_attunements_batch",
            {
                "p_sim_id": str(sim_id),
                "p_growth_rate": growth_rate,
                "p_passive_rate": passive_rate,
            },
        ).execute()

        changes = result.data or []
        if isinstance(changes, str):
            changes = json.loads(changes)

        if not changes:
            return entries

        for change in changes:
            signature = change["signature"]
            old_depth = float(change["old_depth"])
            new_depth = float(change["new_depth"])
            threshold = float(change["threshold"])
            just_harmonized = change.get("just_harmonized", False)
            harmonized = change.get("harmonized", False)

            entries.append(
                make_heartbeat_entry(
                    heartbeat_id,
                    sim_id,
                    tick_number,
                    "attunement_deepen",
                    (
                        f"'{signature}' attunement deepened "
                        f"({old_depth:.2f} -> {new_depth:.2f}). "
                        + (
                            "HARMONIZED — positive events possible!"
                            if just_harmonized
                            else f"Threshold at {threshold:.2f}."
                        )
                    ),
                    (
                        f"'{signature}' Abstimmung vertieft "
                        f"({old_depth:.2f} -> {new_depth:.2f}). "
                        + (
                            "HARMONISIERT — positive Ereignisse moeglich!"
                            if just_harmonized
                            else f"Schwelle bei {threshold:.2f}."
                        )
                    ),
                    severity="positive" if just_harmonized else "info",
                    metadata={
                        "signature": signature,
                        "old_depth": old_depth,
                        "new_depth": new_depth,
                        "threshold": threshold,
                        "harmonized": harmonized,
                    },
                )
            )

            # Check for positive event generation (requires randomness — stays in Python)
            if harmonized:
                pos_prob = config.get("positive_event_probability", _DEFAULT_POSITIVE_EVENT_PROBABILITY)
                if random.random() < pos_prob:  # noqa: S311 — game mechanic, not crypto
                    pos_entry = await cls._spawn_positive_event(
                        admin,
                        sim_id,
                        signature,
                        tick_number,
                        heartbeat_id,
                    )
                    if pos_entry:
                        entries.append(pos_entry)

        return entries

    @classmethod
    async def _spawn_positive_event(
        cls,
        admin: Client,
        sim_id: UUID,
        signature: str,
        tick_number: int,
        heartbeat_id: UUID,
    ) -> dict | None:
        """Spawn a positive event from attunement harmony."""
        templates = POSITIVE_EVENTS.get(signature, [])
        if not templates:
            return None

        # Get a random zone name
        _resp = await admin.table("zones").select("name").eq("simulation_id", str(sim_id)).limit(10).execute()
        zones = _resp.data or []
        zone_name = random.choice(zones)["name"] if zones else "the districts"  # noqa: S311

        title_template, desc_template = random.choice(templates)  # noqa: S311
        title = title_template.format(zone=zone_name)
        description = desc_template

        # Create positive event
        event_id = uuid4()
        await (
            admin.table("events")
            .insert(
                {
                    "id": str(event_id),
                    "simulation_id": str(sim_id),
                    "title": title,
                    "description": description,
                    "event_type": "positive",
                    "event_status": "active",
                    "impact_level": 3,  # Low positive impact
                    "heartbeat_pressure": -0.1,  # Negative pressure = healing
                    "tags": ["resonance", signature, "positive", "attunement"],
                    "external_refs": {
                        "source": "attunement_harmony",
                        "signature": signature,
                        "tick": tick_number,
                    },
                    "data_source": "heartbeat",
                }
            )
            .execute()
        )

        logger.info(
            "Positive event spawned from attunement: %s (%s)",
            title,
            signature,
            extra={"simulation_id": str(sim_id), "event_id": str(event_id)},
        )

        return make_heartbeat_entry(
            heartbeat_id,
            sim_id,
            tick_number,
            "positive_event",
            f"ATTUNEMENT HARVEST: '{title}' spawned from {signature} harmony.",
            f"ABSTIMMUNGSERNTE: '{title}' aus {signature}-Harmonie entstanden.",
            severity="positive",
            metadata={
                "event_id": str(event_id),
                "signature": signature,
                "title": title,
            },
        )
