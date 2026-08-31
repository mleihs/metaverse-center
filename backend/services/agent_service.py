"""Service layer for agent operations."""

from __future__ import annotations

import logging
from uuid import UUID

import httpx
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.services.base_service import BaseService
from backend.utils.db import maybe_single_data
from backend.utils.errors import not_found
from backend.utils.responses import extract_list
from backend.utils.search import apply_search_filter
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


class AgentService(BaseService):
    """Agent-specific operations extending BaseService."""

    table_name = "agents"
    view_name = "active_agents"

    @classmethod
    async def list(
        cls,
        supabase: Client,
        simulation_id: UUID,
        *,
        system: str | None = None,
        gender: str | None = None,
        primary_profession: str | None = None,
        search: str | None = None,
        limit: int = 25,
        offset: int = 0,
        include_deleted: bool = False,
    ) -> tuple[list[dict], int]:
        """List agents with optional filters and full-text search."""
        table = cls._read_table(include_deleted)
        query = supabase.table(table).select("*", count="exact").eq("simulation_id", str(simulation_id)).order("name")

        if system:
            query = query.eq("system", system)
        if gender:
            query = query.eq("gender", gender)
        if primary_profession:
            query = query.eq("primary_profession", primary_profession)
        if search:
            query = apply_search_filter(query, search)

        query = query.range(offset, offset + limit - 1)
        response = await query.execute()

        total = response.count if response.count is not None else len(extract_list(response))
        agents = extract_list(response)
        await cls._enrich_ambassador_flag(supabase, simulation_id, agents)
        await cls._enrich_influence(supabase, simulation_id, agents)
        return agents, total

    @classmethod
    async def list_for_reaction(
        cls,
        supabase: Client,
        simulation_id: UUID,
        *,
        agent_ids: list[str] | None = None,
        limit: int = 20,
        select: str = "id, name, character, system",
    ) -> list[dict]:
        """Fetch agents for reaction generation (lightweight select)."""
        query = supabase.table(cls._read_table()).select(select).eq("simulation_id", str(simulation_id))
        if agent_ids:
            query = query.in_("id", agent_ids)
        else:
            query = query.limit(limit)
        return (await query.execute()).data or []

    @classmethod
    async def list_for_relationships(
        cls,
        supabase: Client,
        simulation_id: UUID,
        exclude_agent_id: UUID,
        *,
        limit: int = 20,
    ) -> list[dict]:
        """Fetch other agents in a simulation for relationship generation."""
        response = await (
            supabase.table(cls._read_table())
            .select("id, name, system, character, background")
            .eq("simulation_id", str(simulation_id))
            .neq("id", str(exclude_agent_id))
            .is_("deleted_at", "null")
            .limit(limit)
            .execute()
        )
        return extract_list(response)

    @classmethod
    async def get_reactions(
        cls,
        supabase: Client,
        simulation_id: UUID,
        agent_id: UUID,
    ) -> list[dict]:
        """Get all event reactions for an agent."""
        response = await (
            supabase.table("event_reactions")
            .select("*, events(id, title)")
            .eq("simulation_id", str(simulation_id))
            .eq("agent_id", str(agent_id))
            .order("created_at", desc=True)
            .execute()
        )
        return extract_list(response)

    @classmethod
    async def get_professions(
        cls,
        supabase: Client,
        simulation_id: UUID,
        agent_id: UUID,
    ) -> list[dict]:
        """Get all professions for an agent."""
        response = await (
            supabase.table("agent_professions")
            .select("*")
            .eq("simulation_id", str(simulation_id))
            .eq("agent_id", str(agent_id))
            .order("is_primary", desc=True)
            .execute()
        )
        return extract_list(response)

    @classmethod
    async def get_building_relations(
        cls,
        supabase: Client,
        simulation_id: UUID,
        agent_id: UUID,
    ) -> list[dict]:
        """Get all building relations for an agent."""
        response = await (
            supabase.table("building_agent_relations")
            .select("*, buildings(id, name, building_type)")
            .eq("simulation_id", str(simulation_id))
            .eq("agent_id", str(agent_id))
            .execute()
        )
        return extract_list(response)

    @classmethod
    async def get_by_slug(
        cls,
        supabase: Client,
        simulation_id: UUID,
        slug: str,
        *,
        select: str = "*",
    ) -> dict:
        """Get an agent by slug with ambassador enrichment."""
        agent = await super().get_by_slug(supabase, simulation_id, slug, select=select)
        await cls._enrich_ambassador_flag(supabase, simulation_id, [agent])
        await cls._enrich_influence(supabase, simulation_id, [agent])
        return agent

    @classmethod
    async def get_with_details(
        cls,
        supabase: Client,
        simulation_id: UUID,
        agent_id: UUID,
    ) -> dict:
        """Get an agent with professions, reactions, and building relations.

        Uses a single Supabase query with foreign-key joins to fetch the agent
        and all related data in one round-trip, replacing 4 sequential queries.
        """
        query = (
            supabase.table(cls.table_name)
            .select(
                "*, "
                "agent_professions(*), "
                "event_reactions(*, events(id, title)), "
                "building_agent_relations(*, buildings(id, name, building_type))"
            )
            .eq("simulation_id", str(simulation_id))
            .eq("id", str(agent_id))
            .is_("deleted_at", "null")
            .maybe_single()
        )
        # `.single()` stand hier und macht den Zweig darunter UNERREICHBAR:
        # postgrest wirft bei null Treffern einen APIError, statt `data=None`
        # zurückzugeben — aus einem gemeinten 404 wurde also ein 500. Der
        # Projektwegweiser verlangt ohnehin `maybe_single_data`, weil
        # `.maybe_single().execute()` bei null Treffern das GANZE
        # Antwortobjekt als `None` liefert.
        agent = await maybe_single_data(query)
        if not agent:
            raise not_found(detail=f"agents '{agent_id}' not found in simulation '{simulation_id}'.")

        # Normalize embedded keys to match the original API contract
        agent["professions"] = agent.pop("agent_professions", []) or []
        agent["reactions"] = agent.pop("event_reactions", []) or []
        agent["building_relations"] = agent.pop("building_agent_relations", []) or []

        await cls._enrich_ambassador_flag(supabase, simulation_id, [agent])
        await cls._enrich_influence(supabase, simulation_id, [agent])
        return agent

    @classmethod
    async def _enrich_influence(
        cls,
        supabase: Client,
        simulation_id: UUID,
        agents: list[dict],
    ) -> None:
        """Set ``influence`` from the server's own formula (Migr. 300).

        Until now the number existed only inside `mv_building_readiness`, so the
        frontend recomputed `fn_compute_agent_influence` in the browser — the
        fourth hand-copied formula in this codebase, of which one has already
        drifted (S21). The agent CARD could not compute it at all: it never
        loads relationships.

        One RPC per list, not one per agent. A list of twenty cards would
        otherwise be twenty round trips for a number one STABLE query returns.

        A failure here costs the badge, not the list. Reading an agent must not
        depend on a derived figure being available.
        """
        if not agents:
            return
        ids = [str(a["id"]) for a in agents if a.get("id")]
        if not ids:
            return
        try:
            response = await supabase.rpc(
                "fn_agent_influence_batch",
                {"p_simulation_id": str(simulation_id), "p_agent_ids": ids},
            ).execute()
        except (PostgrestAPIError, httpx.HTTPError):
            logger.warning(
                "Influence enrichment failed; agents keep influence=None",
                extra={"simulation_id": str(simulation_id)},
                exc_info=True,
            )
            # Ausdrücklich setzen statt den Schlüssel wegzulassen: alle drei
            # Lesewege sollen dieselbe Form liefern, ob die Anreicherung nun
            # gelang oder nicht. `None` heißt „nicht gemessen"; eine 0 hieße
            # „gemessen, und zwar null", und darauf zeigt die Karte ein
            # Abzeichen, das niemand belegen kann.
            for agent in agents:
                agent.setdefault("influence", None)
            return

        scores = {
            str(row["agent_id"]): float(row["influence"])
            for row in extract_list(response)
            if row.get("agent_id") is not None and row.get("influence") is not None
        }
        for agent in agents:
            agent["influence"] = scores.get(str(agent.get("id")))

    @classmethod
    async def _enrich_ambassador_flag(
        cls,
        supabase: Client,
        simulation_id: UUID,
        agents: list[dict],
    ) -> None:
        """Set is_ambassador=True from the view that decides it.

        Seit Migration 322 steht die Regel — Kennung zuerst, Name nur
        ersatzweise, gesperrte Botschafter ausgenommen — nur noch in
        ``active_ambassadors``. Diese Methode liest sie und rechnet nichts nach.

        WARUM DAS NICHT NUR AUFRAEUMEN IST
        Vorher stand dieselbe Regel hier und in ``fn_compute_agent_influence``
        ausgeschrieben, und Migration 304 verlangte im eigenen Kopf, dass die
        beiden uebereinstimmen. Sie taten es nicht ganz: SQL prueft
        ``id ODER (id fehlt UND name)``, diese Methode pruefte
        ``id ODER name`` — sie sammelte den Namen also auch aus Botschaften, die
        bereits eine ``agent_id`` tragen. Ein zweiter Agent desselben Namens
        waere hier Botschafter geworden und dort nicht.

        Auf Prod gemessen (31.08.2026), bevor umgestellt wurde: beide Regeln
        finden dieselben **14** Paare, Differenz 0/0. Die Abweichung war also
        latent und nicht aktiv — sie waere beim ersten doppelten Namen
        aufgewacht, lautlos, weil ein Abzeichen zu viel genauso aussieht wie
        eines zu wenig.

        Die Sperrpruefung (``ambassador_blocked_until``) faellt hier weg, weil
        die Sicht sie enthaelt: eine Stelle entscheidet, oder es sind wieder
        zwei. Die Uhr ist damit die der Datenbank statt die des Anwendungs-
        prozesses, was bei zwei Prozessen auf zwei Maschinen die richtigere ist.
        """
        if not agents:
            return

        try:
            response = await (
                supabase.table("active_ambassadors")
                .select("agent_id")
                .eq("simulation_id", str(simulation_id))
                .execute()
            )
        except (PostgrestAPIError, httpx.HTTPError):
            logger.warning("Failed to read active_ambassadors", exc_info=True)
            return

        ambassador_ids = {str(row["agent_id"]) for row in extract_list(response)}
        for agent in agents:
            agent["is_ambassador"] = str(agent.get("id")) in ambassador_ids
