"""Attunement Service — substrate harmonics (long-term strategic player system).

Players choose up to 2 resonance signatures to attune to.
Attunement deepens each tick, eventually producing positive events.
"""

from __future__ import annotations

import logging
import random
from datetime import UTC, datetime
from uuid import UUID, uuid4

from fastapi import HTTPException, status

from supabase import Client

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
        cls, supabase: Client, sim_id: UUID,
        signature: str, user_id: UUID,
    ) -> dict:
        """Set a resonance signature attunement (max 2 per sim)."""
        from backend.models.resonance import RESONANCE_SIGNATURES
        if signature not in RESONANCE_SIGNATURES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid resonance signature '{signature}'.",
            )

        # Load max attunements from config
        max_attunements = _DEFAULT_MAX_ATTUNEMENTS
        cooldown_ticks = _DEFAULT_SWITCHING_COOLDOWN_TICKS
        try:
            cfg_rows = (
                supabase.table("platform_settings")
                .select("setting_key, setting_value")
                .in_("setting_key", ["heartbeat_max_attunements", "heartbeat_switching_cooldown_ticks"])
                .execute()
            ).data or []
            for r in cfg_rows:
                if r["setting_key"] == "heartbeat_max_attunements":
                    max_attunements = int(r["setting_value"])
                elif r["setting_key"] == "heartbeat_switching_cooldown_ticks":
                    cooldown_ticks = int(r["setting_value"])
        except Exception:
            logger.debug("Attunement config load failed, using defaults")

        # Check current attunement count
        existing = (
            supabase.table("substrate_attunements")
            .select("id, resonance_signature")
            .eq("simulation_id", str(sim_id))
            .execute()
        ).data or []

        if len(existing) >= max_attunements:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Maximum {max_attunements} attunements per simulation. Remove one first.",
            )

        # Check if already attuned to this signature
        if any(a["resonance_signature"] == signature for a in existing):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Already attuned to '{signature}'.",
            )

        response = (
            supabase.table("substrate_attunements")
            .insert({
                "simulation_id": str(sim_id),
                "resonance_signature": signature,
                "depth": 0.0,
                "ticks_exposed": 0,
                "switching_cooldown_ticks": cooldown_ticks,
                "created_by_id": str(user_id),
            })
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create attunement.",
            )

        logger.info(
            "Attunement set: %s for sim %s",
            signature, sim_id,
            extra={"simulation_id": str(sim_id), "signature": signature},
        )
        return response.data[0]

    @classmethod
    async def remove_attunement(
        cls, supabase: Client, sim_id: UUID, signature: str,
    ) -> dict:
        """Remove an attunement."""
        response = (
            supabase.table("substrate_attunements")
            .delete()
            .eq("simulation_id", str(sim_id))
            .eq("resonance_signature", signature)
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Attunement to '{signature}' not found.",
            )
        logger.info(
            "Attunement removed: %s for sim %s",
            signature, sim_id,
            extra={"simulation_id": str(sim_id), "signature": signature},
        )
        return response.data[0]

    @classmethod
    async def list_attunements(
        cls, supabase: Client, sim_id: UUID,
    ) -> list[dict]:
        """List all attunements for a simulation."""
        response = (
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
        cls, admin: Client, sim_id: UUID,
        tick_number: int, heartbeat_id: UUID,
        config: dict,
    ) -> list[dict]:
        """Deepen attunements each tick. Called from HeartbeatService Phase 6."""
        entries: list[dict] = []
        growth_rate = config.get("attunement_growth_rate", 0.05)

        attunements = (
            admin.table("substrate_attunements")
            .select("*")
            .eq("simulation_id", str(sim_id))
            .execute()
        ).data or []

        if not attunements:
            return entries

        for att in attunements:
            att_id = att["id"]
            signature = att["resonance_signature"]
            depth = float(att.get("depth", 0))
            ticks_exposed = (att.get("ticks_exposed") or 0)
            threshold = float(att.get("positive_threshold", 0.5))
            cooldown = att.get("switching_cooldown_ticks") or 0

            # Reduce switching cooldown
            if cooldown > 0:
                admin.table("substrate_attunements").update({
                    "switching_cooldown_ticks": cooldown - 1,
                }).eq("id", att_id).execute()

            # Check if signature has active events (must be exposed to grow)
            active_events = (
                admin.table("events")
                .select("id")
                .eq("simulation_id", str(sim_id))
                .is_("deleted_at", "null")
                .in_("event_status", ["active", "escalating"])
                .contains("tags", [signature])
                .limit(1)
                .execute()
            ).data

            if not active_events:
                continue

            # Deepen
            new_depth = round(min(1.0, depth + growth_rate), 4)
            new_ticks = ticks_exposed + 1

            update_data: dict = {
                "depth": new_depth,
                "ticks_exposed": new_ticks,
                "updated_at": datetime.now(UTC).isoformat(),
            }

            entries.append({
                "id": str(uuid4()),
                "heartbeat_id": str(heartbeat_id),
                "simulation_id": str(sim_id),
                "tick_number": tick_number,
                "entry_type": "attunement_deepen",
                "narrative_en": (
                    f"'{signature}' attunement deepened "
                    f"({depth:.2f} -> {new_depth:.2f}). "
                    + (
                        "HARMONIZED — positive events possible!"
                        if new_depth >= threshold > depth
                        else f"Threshold at {threshold:.2f}."
                    )
                ),
                "narrative_de": (
                    f"'{signature}' Abstimmung vertieft "
                    f"({depth:.2f} -> {new_depth:.2f}). "
                    + (
                        "HARMONISIERT — positive Ereignisse moeglich!"
                        if new_depth >= threshold > depth
                        else f"Schwelle bei {threshold:.2f}."
                    )
                ),
                "metadata": {
                    "signature": signature, "old_depth": depth, "new_depth": new_depth,
                    "threshold": threshold, "harmonized": new_depth >= threshold,
                },
                "severity": "positive" if new_depth >= threshold > depth else "info",
            })

            # Check for positive event generation
            if new_depth >= threshold:
                pos_prob = config.get("positive_event_probability", _DEFAULT_POSITIVE_EVENT_PROBABILITY)
                if random.random() < pos_prob:  # noqa: S311 — game mechanic, not crypto
                    pos_entry = await cls._spawn_positive_event(
                        admin, sim_id, signature, tick_number, heartbeat_id,
                    )
                    if pos_entry:
                        entries.append(pos_entry)
                        update_data["positive_event_generated"] = True

            admin.table("substrate_attunements").update(update_data).eq("id", att_id).execute()

        return entries

    @classmethod
    async def _spawn_positive_event(
        cls, admin: Client, sim_id: UUID,
        signature: str, tick_number: int, heartbeat_id: UUID,
    ) -> dict | None:
        """Spawn a positive event from attunement harmony."""
        templates = POSITIVE_EVENTS.get(signature, [])
        if not templates:
            return None

        # Get a random zone name
        zones = (
            admin.table("zones")
            .select("name")
            .eq("simulation_id", str(sim_id))
            .limit(10)
            .execute()
        ).data or []
        zone_name = random.choice(zones)["name"] if zones else "the districts"  # noqa: S311

        title_template, desc_template = random.choice(templates)  # noqa: S311
        title = title_template.format(zone=zone_name)
        description = desc_template

        # Create positive event
        event_id = uuid4()
        admin.table("events").insert({
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
        }).execute()

        logger.info(
            "Positive event spawned from attunement: %s (%s)",
            title, signature,
            extra={"simulation_id": str(sim_id), "event_id": str(event_id)},
        )

        return {
            "id": str(uuid4()),
            "heartbeat_id": str(heartbeat_id),
            "simulation_id": str(sim_id),
            "tick_number": tick_number,
            "entry_type": "positive_event",
            "narrative_en": (
                f"ATTUNEMENT HARVEST: '{title}' spawned from {signature} harmony."
            ),
            "narrative_de": (
                f"ABSTIMMUNGSERNTE: '{title}' aus {signature}-Harmonie entstanden."
            ),
            "metadata": {
                "event_id": str(event_id), "signature": signature,
                "title": title,
            },
            "severity": "positive",
        }
