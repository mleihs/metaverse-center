"""Agent opinion management service.

Manages inter-agent opinions via stacking modifiers with three decay types
(permanent/timed/decaying). Automatically creates or modifies relationships
when opinion thresholds are crossed.

All mutations delegate to PostgreSQL functions for atomicity.

PostgreSQL functions used:
- ``fn_recalculate_opinion_scores`` (migration 145) — atomic score recomputation
- ``fn_count_opinion_modifier_stacking`` (migration 145) — stacking cap check
- ``fn_increment_opinion_interaction`` (migration 146) — atomic counter + timestamp

Inspired by CK3 opinion modifiers, RimWorld social system.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from typing import Final
from uuid import UUID

import httpx
import structlog
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# ── Opinion modifier presets ─────────────────────────────────────────────────

# Triggered automatically by simulation events and social interactions
OPINION_PRESETS: dict[str, dict] = {
    "survived_crisis_together": {
        "modifier_type": "survived_together",
        "opinion_change": 15,
        "decay_type": "decaying",
        "duration_hours": 168,  # 7 days
        "stacking_group": "crisis_bond",
    },
    "zone_cohabitation": {
        "modifier_type": "neighbor",
        "opinion_change": 3,
        "decay_type": "timed",
        "duration_hours": 48,
        "stacking_group": "proximity",
    },
    "profession_rivalry": {
        "modifier_type": "competitor",
        "opinion_change": -5,
        "decay_type": "permanent",
        "stacking_group": "rivalry",
    },
    "good_conversation": {
        "modifier_type": "good_conversation",
        "opinion_change": 8,
        "decay_type": "decaying",
        "duration_hours": 120,
        "stacking_group": "social_positive",
    },
    "argument": {
        "modifier_type": "argument",
        "opinion_change": -12,
        "decay_type": "decaying",
        "duration_hours": 96,
        "stacking_group": "social_negative",
    },
    "insult": {
        "modifier_type": "insulted_me",
        "opinion_change": -15,
        "decay_type": "decaying",
        "duration_hours": 120,
        "stacking_group": "social_negative",
    },
    "shared_experience": {
        "modifier_type": "shared_experience",
        "opinion_change": 5,
        "decay_type": "decaying",
        "duration_hours": 72,
        "stacking_group": "shared_experience",
    },
    "helped_in_need": {
        "modifier_type": "helped_me",
        "opinion_change": 18,
        "decay_type": "decaying",
        "duration_hours": 240,  # 10 days
        "stacking_group": "aid",
    },
    "betrayal": {
        "modifier_type": "betrayed_trust",
        "opinion_change": -25,
        "decay_type": "decaying",
        "duration_hours": 336,  # 14 days
        "stacking_group": "betrayal",
    },
}

# Stacking caps per group
STACKING_CAPS: dict[str, int] = {
    "crisis_bond": 3,
    "proximity": 5,
    "rivalry": 1,
    "social_positive": 5,
    "social_negative": 5,
    "shared_experience": 10,
    "aid": 3,
    "betrayal": 2,
}

DEFAULT_STACKING_CAP = 5

# Relationship thresholds
# Die Ereignistypen, die dieser Dienst meldet — EINE Deklaration.
#
# Sie stand vorher nur als Zeichenkette an der Emissionsstelle. Als D10/S18 die
# beiden Zweige zu einer Schleife zusammenfasste, fand das Chronik-Tor
# (`test_chronicle_state_words.py`) sie nicht mehr und wurde rot, obwohl sich
# an den Typen nichts geändert hatte: es suchte eine CODEFORM statt der Sache.
# Eine Deklaration ist der Ort, an dem beide nachsehen können — dasselbe
# Muster wie `HEARTBEAT_ENTRY_TYPES` im Herzschlag.
RELATIONSHIP_EVENT_TYPES: Final[tuple[str, ...]] = (
    "relationship_breakthrough",
    "relationship_breakdown",
)

RELATIONSHIP_CREATE_THRESHOLD = 60  # Opinion > 60 → auto-create positive relationship
RELATIONSHIP_HOSTILE_THRESHOLD = -60  # Opinion < -60 → auto-create/modify to hostile


class AgentOpinionService:
    """Manages inter-agent opinions via modifier system."""

    @classmethod
    async def process_tick(
        cls,
        supabase: Client,
        simulation_id: UUID,
    ) -> dict:
        """Run opinion recalculation for a simulation tick.

        1. Recalculate opinion scores from base + modifiers (PostgreSQL atomic)
        2. Check relationship thresholds
        3. Update interaction counts

        Returns summary dict.
        """
        structlog.contextvars.bind_contextvars(
            simulation_id=str(simulation_id),
            phase="opinion_recalculation",
        )

        # 1. Recalculate all opinion scores (PostgreSQL atomic)
        recalc_result = await supabase.rpc(
            "fn_recalculate_opinion_scores",
            {
                "p_simulation_id": str(simulation_id),
            },
        ).execute()
        recalculated = recalc_result.data if isinstance(recalc_result.data, int) else 0

        # 2. Check relationship thresholds
        threshold_events = await cls._check_relationship_thresholds(supabase, simulation_id)

        summary = {
            "recalculated": recalculated,
            "relationship_events": threshold_events,
        }
        logger.info("Opinion tick complete", extra=summary)
        return summary

    @classmethod
    async def add_modifier(
        cls,
        supabase: Client,
        agent_id: UUID,
        target_agent_id: UUID,
        simulation_id: UUID,
        preset_name: str,
        *,
        source_event_id: UUID | None = None,
        description: str | None = None,
        override_change: int | None = None,
    ) -> bool:
        """Add an opinion modifier using a preset. Returns True if added, False if capped."""
        preset = OPINION_PRESETS.get(preset_name)
        if not preset:
            logger.warning("Unknown opinion preset", extra={"preset": preset_name})
            return False

        return await cls.add_modifier_raw(
            supabase,
            agent_id=agent_id,
            target_agent_id=target_agent_id,
            simulation_id=simulation_id,
            modifier_type=preset["modifier_type"],
            opinion_change=override_change if override_change is not None else preset["opinion_change"],
            decay_type=preset["decay_type"],
            duration_hours=preset.get("duration_hours"),
            stacking_group=preset.get("stacking_group"),
            source_event_id=source_event_id,
            description=description,
        )

    @classmethod
    async def add_modifier_raw(
        cls,
        supabase: Client,
        *,
        agent_id: UUID,
        target_agent_id: UUID,
        simulation_id: UUID,
        modifier_type: str,
        opinion_change: int,
        decay_type: str = "decaying",
        duration_hours: float | None = None,
        stacking_group: str | None = None,
        source_event_id: UUID | None = None,
        description: str | None = None,
    ) -> bool:
        """Add an opinion modifier with stacking cap enforcement."""
        # Check stacking cap
        if stacking_group:
            cap = STACKING_CAPS.get(stacking_group, DEFAULT_STACKING_CAP)
            count_result = await supabase.rpc(
                "fn_count_opinion_modifier_stacking",
                {
                    "p_agent_id": str(agent_id),
                    "p_target_agent_id": str(target_agent_id),
                    "p_stacking_group": stacking_group,
                },
            ).execute()
            current_count = count_result.data if isinstance(count_result.data, int) else 0

            if current_count >= cap:
                return False

        # Compute expiry
        expires_at = None
        if decay_type in ("timed", "decaying") and duration_hours:
            expires_at = (datetime.now(UTC) + timedelta(hours=duration_hours)).isoformat()

        # Ensure opinion record exists
        await cls._ensure_opinion_record(supabase, agent_id, target_agent_id, simulation_id)

        # Insert modifier
        await (
            supabase.table("agent_opinion_modifiers")
            .insert(
                {
                    "agent_id": str(agent_id),
                    "target_agent_id": str(target_agent_id),
                    "simulation_id": str(simulation_id),
                    "modifier_type": modifier_type,
                    "opinion_change": max(-30, min(30, opinion_change)),
                    "decay_type": decay_type,
                    "initial_value": opinion_change,
                    "expires_at": expires_at,
                    "stacking_group": stacking_group,
                    "source_event_id": str(source_event_id) if source_event_id else None,
                    "description": description,
                }
            )
            .execute()
        )

        # Atomic interaction tracking via fn_increment_opinion_interaction (migration 146)
        await supabase.rpc(
            "fn_increment_opinion_interaction",
            {
                "p_agent_id": str(agent_id),
                "p_target_agent_id": str(target_agent_id),
            },
        ).execute()

        return True

    @classmethod
    async def add_proximity_modifiers(
        cls,
        supabase: Client,
        simulation_id: UUID,
        zone_agent_map: dict[UUID, list[UUID]],
    ) -> int:
        """Add zone cohabitation modifiers for all co-located agent pairs.

        TODO(ADR-007): This O(N²) Python loop makes 4 DB calls per agent pair.
        When integrated into the heartbeat pipeline, replace with a bulk PG function
        ``fn_add_opinion_modifiers_batch`` that checks caps + inserts in one call.
        Currently dormant — no callers exist.
        """
        added = 0
        for _zone_id, agent_ids in zone_agent_map.items():
            for i, agent_a in enumerate(agent_ids):
                for agent_b in agent_ids[i + 1 :]:
                    # Bidirectional
                    for source, target in [(agent_a, agent_b), (agent_b, agent_a)]:
                        if await cls.add_modifier(
                            supabase,
                            source,
                            target,
                            simulation_id,
                            "zone_cohabitation",
                        ):
                            added += 1
        return added

    @classmethod
    async def add_event_modifiers(
        cls,
        supabase: Client,
        simulation_id: UUID,
        event_id: UUID,
        affected_agent_ids: list[UUID],
        impact_level: int,
    ) -> int:
        """Add shared experience modifiers for agents affected by an event.

        TODO(ADR-007): Same O(N²) pattern as add_proximity_modifiers — batch via
        PG function when integrated into a caller. Currently dormant.
        """
        preset = "survived_crisis_together" if impact_level >= 6 else "shared_experience"
        added = 0

        for i, agent_a in enumerate(affected_agent_ids):
            for agent_b in affected_agent_ids[i + 1 :]:
                for source, target in [(agent_a, agent_b), (agent_b, agent_a)]:
                    if await cls.add_modifier(
                        supabase,
                        source,
                        target,
                        simulation_id,
                        preset,
                        source_event_id=event_id,
                    ):
                        added += 1
        return added

    @classmethod
    async def list_opinions(
        cls,
        supabase: Client,
        agent_id: UUID,
        simulation_id: UUID,
    ) -> list[dict]:
        """List all opinions an agent holds, enriched with target agent name/portrait."""
        result = await (
            supabase.table("agent_opinions")
            .select("*, agents!agent_opinions_target_agent_id_fkey(name, portrait_image_url)")
            .eq("agent_id", str(agent_id))
            .eq("simulation_id", str(simulation_id))
            .order("opinion_score", desc=True)
            .execute()
        )
        data = []
        for row in extract_list(result):
            agent_data = row.pop("agents", {}) or {}
            row["target_agent_name"] = agent_data.get("name")
            row["target_agent_portrait"] = agent_data.get("portrait_image_url")
            data.append(row)
        return data

    @classmethod
    async def list_modifiers(
        cls,
        supabase: Client,
        agent_id: UUID,
        simulation_id: UUID,
        target_agent_id: UUID | None = None,
    ) -> list[dict]:
        """List opinion modifiers for an agent, optionally filtered by target."""
        query = (
            supabase.table("agent_opinion_modifiers")
            .select("*")
            .eq("agent_id", str(agent_id))
            .eq("simulation_id", str(simulation_id))
        )
        if target_agent_id:
            query = query.eq("target_agent_id", str(target_agent_id))
        result = await query.order("created_at", desc=True).execute()
        return extract_list(result)

    @classmethod
    async def _ensure_opinion_record(
        cls,
        supabase: Client,
        agent_id: UUID,
        target_agent_id: UUID,
        simulation_id: UUID,
    ) -> None:
        """Create opinion record if it doesn't exist (idempotent)."""
        await (
            supabase.table("agent_opinions")
            .upsert(
                {
                    "agent_id": str(agent_id),
                    "target_agent_id": str(target_agent_id),
                    "simulation_id": str(simulation_id),
                    "base_compatibility": 0.0,
                    "opinion_score": 0,
                },
                on_conflict="agent_id,target_agent_id",
            )
            .execute()
        )

    @classmethod
    async def _check_relationship_thresholds(
        cls,
        supabase: Client,
        simulation_id: UUID,
    ) -> list[dict]:
        """Überschrittene Meinungsschwellen: Beziehung ANLEGEN und melden.

        ── Was hier nicht stimmte (D10/S18) ────────────────────────────────

        Die Konstanten heißen ``RELATIONSHIP_CREATE_THRESHOLD`` („Opinion > 60
        → auto-create positive relationship") und
        ``RELATIONSHIP_HOSTILE_THRESHOLD`` („→ auto-create/modify to hostile").
        Gemessen am 31.08.2026: **im ganzen Backend fügt nichts in
        ``agent_relationships`` ein.** Die Namen versprachen eine Automatik,
        die nie gebaut wurde; die 48 Bestandsbeziehungen auf Prod stammen aus
        der Schmiede.

        Daraus folgten zwei Defekte, die sich gegenseitig verdeckten:

        1. Der Durchbruch-Zweig prüfte ``if not existing`` — eine Entdopplung,
           die NIE greifen konnte, weil nie jemand die Zeile anlegte, deren
           Vorhandensein sie prüft. Dasselbe Paar hätte in jedem Tick erneut
           gemeldet.
        2. Der Bruch-Zweig prüfte gar nichts. Symmetrisch wäre schon vorher
           nötig gewesen; ohne den Insert wäre es nur derselbe Leerlauf in
           zwei Ausführungen.

        Es fiel nicht auf, weil keine Meinung die Schwelle je erreicht: die
        Spanne auf Prod ist 0 … 45 gegen ein Tor von ±60 (Befund N5). Der
        Fehler wartet also auf genau den Tag, an dem die Schwellen gerichtet
        werden — und hätte dann in jedem Tick dieselben Paare gemeldet.

        ── Was jetzt passiert ──────────────────────────────────────────────

        Beide Zweige legen die Beziehung an und melden NUR, wenn sie neu ist.
        Damit ist die Entdopplung zum ersten Mal wirksam, und die
        Konstantennamen sagen die Wahrheit.

        ``is_bidirectional`` bleibt bei der Vorgabe ``true``: eine Meinung ist
        gerichtet, eine Beziehung im Sinne dieser Tabelle nicht — und die
        Gegenrichtung würde beim nächsten Tick ohnehin dieselbe Zeile finden.
        """
        events: list[dict] = []

        for threshold_op, threshold, event_type, rel_type, description in (
            (
                "gte",
                RELATIONSHIP_CREATE_THRESHOLD,
                RELATIONSHIP_EVENT_TYPES[0],
                "trading_partner",
                "Formed from sustained positive opinion.",
            ),
            (
                "lte",
                RELATIONSHIP_HOSTILE_THRESHOLD,
                RELATIONSHIP_EVENT_TYPES[1],
                "rival",
                "Formed from sustained hostile opinion.",
            ),
        ):
            query = (
                supabase.table("agent_opinions")
                .select("agent_id, target_agent_id, opinion_score")
                .eq("simulation_id", str(simulation_id))
            )
            query = (
                query.gte("opinion_score", threshold)
                if threshold_op == "gte"
                else query.lte("opinion_score", threshold)
            )
            result = await query.execute()

            for opinion in extract_list(result):
                # `.limit(1)` und NICHT `.maybe_single()`.
                #
                # Gefragt ist "gibt es schon IRGENDEINE Beziehung zwischen den
                # beiden" — der Typ soll hier bewusst keine Rolle spielen (siehe
                # Docstring: eine Meinung ist gerichtet, eine Beziehung nicht).
                # Der Eindeutigkeitszwang der Tabelle laeuft aber ueber DREI
                # Spalten:
                #
                #     unique_relationship (source_agent_id, target_agent_id,
                #                          relationship_type)
                #
                # Zwei Agenten duerfen also zugleich `trading_partner` UND
                # `rival` sein — genau die beiden Arten, die diese Schleife
                # anlegt. `.maybe_single()` verlangt aber 0 oder 1 Zeile und
                # bricht bei zweien ab. Auf Prod ist das am 02.09.2026
                # eingetreten (ein Paar, zwei Zeilen) und hat die
                # Autonomiephase des Herzschlags fuer eine ganze Welt
                # abgebrochen: Sentry METAVERSE_CENTER-4B, Tick #924, The
                # Chitinous Mandate.
                #
                # Der Fehlertext half dabei nicht: postgrest-py verschluckt in
                # `AsyncMaybeSingleRequestBuilder.execute` JEDEN APIError ausser
                # "0 rows" ohne re-raise und wirft danach das nichtssagende
                # "Missing response". Siehe `backend/utils/db.py`.
                existing = extract_list(
                    await supabase.table("agent_relationships")
                    .select("id")
                    .eq("source_agent_id", opinion["agent_id"])
                    .eq("target_agent_id", opinion["target_agent_id"])
                    .limit(1)
                    .execute()
                )
                if existing:
                    continue

                # Die Beziehung anlegen — das ist, was die Konstante verspricht.
                # Nicht tödlich: schlägt der Insert fehl (Wettlauf mit einem
                # anderen Tick, gelöschter Agent), soll der Tick weiterlaufen.
                # Ohne Zeile wird beim nächsten Tick erneut versucht — das ist
                # der richtige Ausfallweg, denn die Meinung steht ja weiterhin
                # über der Schwelle.
                try:
                    await (
                        supabase.table("agent_relationships")
                        .insert(
                            {
                                "simulation_id": str(simulation_id),
                                "source_agent_id": opinion["agent_id"],
                                "target_agent_id": opinion["target_agent_id"],
                                "relationship_type": rel_type,
                                "description": description,
                                "metadata": {
                                    "created_by": "opinion_threshold",
                                    "opinion_score": opinion["opinion_score"],
                                },
                            }
                        )
                        .execute()
                    )
                except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
                    logger.warning(
                        "Beziehung aus Meinungsschwelle konnte nicht angelegt werden",
                        extra={
                            "simulation_id": str(simulation_id),
                            "agent_id": opinion["agent_id"],
                            "target_agent_id": opinion["target_agent_id"],
                        },
                        exc_info=True,
                    )
                    continue

                events.append(
                    {
                        "type": event_type,
                        "agent_id": opinion["agent_id"],
                        "target_agent_id": opinion["target_agent_id"],
                        "opinion_score": opinion["opinion_score"],
                    }
                )

        if events:
            logger.info(
                "Relationship threshold events detected",
                extra={"count": len(events)},
            )
        return events
