"""Agent needs management service.

Manages the 5 core needs (social, purpose, safety, comfort, stimulation)
that drive agent activity selection via Utility AI. Needs decay each
heartbeat tick and are fulfilled by activities.

All mutations delegate to PostgreSQL functions (migration 145, 146)
for atomicity. No fetch-compute-update patterns in Python.

Inspired by The Sims needs system with per-agent decay rates derived
from Big Five personality profiles.

PostgreSQL functions used:
- ``fn_decay_agent_needs`` (migration 145) — bulk decay with per-agent rates
- ``fn_fulfill_agent_need`` (migration 146) — atomic single-need fulfillment
"""

from __future__ import annotations

import logging
from uuid import UUID

import httpx
import sentry_sdk
import structlog
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.utils.db import maybe_single_data
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# Need types and their fulfillment sources
NEED_TYPES = ("social", "purpose", "safety", "comfort", "stimulation")

# Which activities fulfill which needs (activity_type → need_type → amount)
ACTIVITY_NEED_FULFILLMENT: dict[str, dict[str, float]] = {
    "socialize": {"social": 15.0},
    "seek_comfort": {"comfort": 20.0, "social": 5.0},
    "collaborate": {"social": 8.0, "purpose": 10.0},
    "work": {"purpose": 15.0},
    "maintain": {"purpose": 8.0, "comfort": 5.0},
    "create": {"purpose": 12.0, "stimulation": 10.0},
    "rest": {"comfort": 15.0, "safety": 5.0},
    "explore": {"stimulation": 18.0},
    "investigate": {"stimulation": 12.0, "purpose": 5.0},
    "reflect": {"comfort": 5.0, "stimulation": 3.0},
    "celebrate": {"social": 12.0, "stimulation": 10.0, "comfort": 5.0},
    "mourn": {"social": 5.0},
    "avoid": {},
    "confront": {},
}


# ── Unerfüllte Bedürfnisse werden zu Stimmung ────────────────────────────
#
# Bis zum 31.08.2026 fielen die Bedürfnisse und niemand fühlte es:
# `fn_decay_agent_needs` senkte fünf Zahlen je Tick, und KEIN Dienst und keine
# Funktion machte daraus je ein Moodlet. Das war die Ursache hinter N5 — es gab
# genau eine Quelle negativer Stimmung (`resonance_pressure`, Stärke −1, eine
# Zeile je Agent), die Laune konnte −1 nicht unterschreiten, also blieben drei
# von sechs sozialen Interaktionen, der Stressaufbau und mit ihm vier von fünf
# Ereignis-Auslösern unerreichbar. Um unglücklich zu werden, musste ein Agent
# beleidigt werden; um zu beleidigen, musste er unglücklich sein.
#
# WOHER DIE ZAHLEN KOMMEN
# -----------------------
# Aus `scripts/measure_mood_reachability.py`, gegen die echten Prod-Stände
# gerechnet — nicht aus dem Kopf (Lehre J7). Auf den Daten vom 31.08.2026:
#
#     unter 30 → −3, gestuft je 10   schlechteste Laune −13   0 von 258 unter −20
#     unter 35 → −3, gestuft je 10   schlechteste Laune −16   0
#     unter 40 → −2, gestuft je 10   schlechteste Laune −15   0
#     unter 40 → −3, gestuft je 10   schlechteste Laune −22   2   ← gewählt
#
# **Jede sanftere Regel lässt alle vier Tore geschlossen**, das wäre N5 noch
# einmal. Die gewählte ist die SCHWÄCHSTE, die überhaupt etwas bewirkt: zwei
# von 258 Agenten sind damit heute unglücklich genug, dass Stress zu wachsen
# beginnt und `insult` wählbar wird.
#
# WARUM DAS NICHT DAVONLÄUFT
# --------------------------
# `AgentActivityService._compute_need_bonus` gibt einer Tätigkeit bis zu +30
# Nutzen, wenn sie ein niedriges Bedürfnis deckt. Ein Agent mit `social = 0`
# zieht mit voller Kraft zum Geselligsein — es gibt eine Gegenkopplung. Die
# gemessene Nettobewegung ist deshalb eine Gleichgewichtsrate über die
# Bevölkerung (social −0,45/Tick, stimulation −0,61/Tick, der Rest erholt
# sich), keine Bahn eines Agenten im freien Fall.
#
# WER DIESE ZAHLEN ÄNDERT, MISST VORHER
# -------------------------------------
#     .venv/bin/python scripts/measure_mood_reachability.py --ticks 0
#
# Der zugehörige Test prüft die EIGENSCHAFTEN dieser Tabelle (jede Stärke
# negativ, jede Schwelle im Wertebereich, kein Moodlet über dem CHECK), nicht
# die Zahlen selbst — sonst würde jede gemessene Nachjustierung zur
# Teständerung und eine Momentaufnahme sähe aus wie eine Spezifikation.
NEED_MOODLETS: dict[str, dict] = {
    "social": {
        "threshold": 40,
        "strength": -3,
        "step": 10,
        "emotion": "loneliness",
        "moodlet_type": "unmet_social",
        "description": "Niemand hat mit ihm gesprochen.",
    },
    "purpose": {
        "threshold": 40,
        "strength": -3,
        "step": 10,
        "emotion": "aimlessness",
        "moodlet_type": "unmet_purpose",
        "description": "Es gab nichts zu tun, was zählte.",
    },
    "safety": {
        "threshold": 40,
        "strength": -3,
        "step": 10,
        "emotion": "unease",
        "moodlet_type": "unmet_safety",
        "description": "Die Zone fühlt sich nicht sicher an.",
    },
    "comfort": {
        "threshold": 40,
        "strength": -3,
        "step": 10,
        "emotion": "discomfort",
        "moodlet_type": "unmet_comfort",
        "description": "Keine Ruhe, kein Ort zum Bleiben.",
    },
    "stimulation": {
        "threshold": 40,
        "strength": -3,
        "step": 10,
        "emotion": "boredom",
        "moodlet_type": "unmet_stimulation",
        "description": "Alles war wie gestern.",
    },
}


class AgentNeedsService:
    """Manages agent need levels — decay and fulfillment.

    All write operations use PostgreSQL functions for atomicity.
    """

    @classmethod
    async def decay_all(
        cls,
        supabase: Client,
        simulation_id: UUID,
        rate_multiplier: float = 1.0,
    ) -> int:
        """Decay all agent needs in a simulation via ``fn_decay_agent_needs`` (migration 145).

        Returns count of agents updated.
        """
        structlog.contextvars.bind_contextvars(
            simulation_id=str(simulation_id),
            phase="needs_decay",
        )

        result = await supabase.rpc(
            "fn_decay_agent_needs",
            {
                "p_simulation_id": str(simulation_id),
                "p_rate_multiplier": rate_multiplier,
            },
        ).execute()

        updated = result.data if isinstance(result.data, int) else 0
        logger.info("Needs decayed", extra={"agents_updated": updated, "rate": rate_multiplier})
        return updated

    @classmethod
    async def apply_need_moodlets(
        cls,
        supabase: Client,
        simulation_id: UUID,
    ) -> int:
        """Ein Moodlet je unerfülltem Bedürfnis (Migration 306).

        Läuft im Tick unmittelbar NACH dem Zerfall und VOR der
        Stimmungsrechnung, damit ein Bedürfnis, das in diesem Tick unter die
        Schwelle gefallen ist, in derselben Runde gefühlt wird. Stünde es
        danach, hinkte die Stimmung dem Bedürfnis um einen Tick hinterher —
        vier Stunden, in denen die Welt etwas anderes anzeigt als sie ist.

        Ersetzend, nicht anhäufend: die Funktion löscht die vorherigen
        Bedürfnis-Moodlets dieser Welt, bevor sie neue setzt. Anders wäre es
        genau das ungedeckelte Stapeln, das D10-5 beseitigt hat.

        Ein Fehlschlag kostet die Stimmungsanpassung dieses Ticks, nicht den
        Tick: die Welt tickt weiter, sie fühlt in dieser Runde nur nichts.
        """
        structlog.contextvars.bind_contextvars(
            simulation_id=str(simulation_id),
            phase="need_moodlets",
        )
        try:
            result = await supabase.rpc(
                "fn_apply_need_moodlets",
                {
                    "p_simulation_id": str(simulation_id),
                    "p_rules": NEED_MOODLETS,
                },
            ).execute()
        except (PostgrestAPIError, httpx.HTTPError) as exc:
            logger.warning(
                "Need moodlets could not be applied; mood is unchanged this tick",
                extra={"simulation_id": str(simulation_id)},
                exc_info=True,
            )
            sentry_sdk.capture_exception(exc)
            return 0

        created = result.data if isinstance(result.data, int) else 0
        logger.info("Need moodlets applied", extra={"moodlets": created})
        return created

    @classmethod
    async def fulfill_need(
        cls,
        supabase: Client,
        agent_id: UUID,
        need_type: str,
        amount: float,
    ) -> float:
        """Atomically fulfill a specific need via ``fn_fulfill_agent_need`` (migration 146).

        Returns the new need value after fulfillment.
        """
        if need_type not in NEED_TYPES:
            logger.warning("Invalid need type", extra={"need_type": need_type})
            return 0.0

        result = await supabase.rpc(
            "fn_fulfill_agent_need",
            {
                "p_agent_id": str(agent_id),
                "p_need_type": need_type,
                "p_amount": amount,
            },
        ).execute()

        return float(result.data) if result.data is not None else 0.0

    @classmethod
    async def fulfill_from_activity(
        cls,
        supabase: Client,
        agent_id: UUID,
        activity_type: str,
    ) -> dict[str, float]:
        """Fulfill needs based on completed activity via atomic PG calls.

        Uses ``fn_fulfill_agent_need`` (migration 146) for each need type.
        Returns dict of fulfilled amounts.
        """
        fulfillments = ACTIVITY_NEED_FULFILLMENT.get(activity_type, {})
        if not fulfillments:
            return {}

        fulfilled: dict[str, float] = {}
        for need_type, amount in fulfillments.items():
            new_val = await cls.fulfill_need(supabase, agent_id, need_type, amount)
            if new_val > 0:
                fulfilled[need_type] = round(amount, 1)

        return fulfilled

    @classmethod
    async def get_lowest_need(
        cls,
        supabase: Client,
        agent_id: UUID,
    ) -> tuple[str, float]:
        """Get the most urgent (lowest) need for an agent. Read-only."""
        needs = await maybe_single_data(
            supabase.table("agent_needs")
            .select("social, purpose, safety, comfort, stimulation")
            .eq("agent_id", str(agent_id))
            .maybe_single()
        )
        if not needs:
            return "social", 60.0
        lowest_type = min(NEED_TYPES, key=lambda n: needs.get(n, 100))
        return lowest_type, needs.get(lowest_type, 60.0)

    @classmethod
    async def get_all_needs(
        cls,
        supabase: Client,
        simulation_id: UUID,
    ) -> list[dict]:
        """Get needs for all agents in a simulation. Read-only."""
        result = await (
            supabase.table("agent_needs")
            .select("*, agents!agent_needs_agent_id_fkey(id, name)")
            .eq("simulation_id", str(simulation_id))
            .execute()
        )
        return extract_list(result)

    @classmethod
    async def get_agent_needs(
        cls,
        supabase: Client,
        agent_id: UUID,
        simulation_id: UUID,
    ) -> dict | None:
        """Get need levels for a single agent."""
        return await maybe_single_data(
            supabase.table("agent_needs")
            .select("*")
            .eq("agent_id", str(agent_id))
            .eq("simulation_id", str(simulation_id))
            .maybe_single()
        )

    @classmethod
    async def apply_zone_modifiers(
        cls,
        supabase: Client,
        simulation_id: UUID,
        zone_stability_map: dict[UUID, float],
    ) -> int:
        """Modify safety needs based on zone stability via bulk PG function.

        Delegates to ``fn_apply_zone_need_modifiers`` (migration 162) which
        performs a single UPDATE for all agents, eliminating N individual RPCs.
        Returns the number of agents updated.
        """
        if not zone_stability_map:
            return 0

        # Convert UUID keys to string for JSONB
        stability_jsonb = {str(k): v for k, v in zone_stability_map.items()}

        try:
            result = await supabase.rpc(
                "fn_apply_zone_need_modifiers",
                {
                    "p_simulation_id": str(simulation_id),
                    "p_zone_stability": stability_jsonb,
                },
            ).execute()
            updated = result.data if isinstance(result.data, int) else 0
            if updated > 0:
                logger.info(
                    "Zone need modifiers applied",
                    extra={"simulation_id": str(simulation_id), "agents_updated": updated},
                )
            return updated
        except (PostgrestAPIError, httpx.HTTPError) as exc:
            logger.warning("Failed to apply zone need modifiers")
            sentry_sdk.capture_exception(exc)
            return 0
