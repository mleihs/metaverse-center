"""Service layer for taxonomy operations."""

import logging
from uuid import UUID

from backend.services.base_service import BaseService
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


class TaxonomyService(BaseService):
    """Service for simulation taxonomy values."""

    table_name = "simulation_taxonomies"
    view_name = None
    supports_created_by = False

    @classmethod
    async def list_taxonomies(
        cls,
        supabase: Client,
        simulation_id: UUID,
        taxonomy_type: str | None = None,
        active_only: bool = True,
    ) -> list[dict]:
        """List all taxonomy values, optionally filtered by type.

        Custom implementation: unique ordering (taxonomy_type, sort_order)
        and boolean is_active filter not expressible via BaseService.list().
        """
        query = (
            supabase.table("simulation_taxonomies")
            .select("*")
            .eq("simulation_id", str(simulation_id))
            .order("taxonomy_type")
            .order("sort_order")
        )

        if taxonomy_type:
            query = query.eq("taxonomy_type", taxonomy_type)
        if active_only:
            query = query.eq("is_active", True)

        response = await query.execute()
        return await cls._attach_rungs(supabase, simulation_id, extract_list(response))

    @classmethod
    async def list_taxonomies_paginated(
        cls,
        supabase: Client,
        simulation_id: UUID,
        *,
        taxonomy_type: str | None = None,
        limit: int = 500,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """List taxonomies with pagination (public)."""
        filters = {}
        if taxonomy_type:
            filters["taxonomy_type"] = taxonomy_type
        rows, total = await cls.list(
            supabase,
            simulation_id,
            filters=filters,
            order_by="taxonomy_type",
            limit=limit,
            offset=offset,
        )
        return await cls._attach_rungs(supabase, simulation_id, rows), total

    @classmethod
    async def _attach_rungs(
        cls,
        supabase: Client,
        simulation_id: UUID,
        rows: list[dict],
    ) -> list[dict]:
        """Trage zu jedem Zustandswort seine Sprosse auf der Leiter DIESER Welt ein.

        Warum aus der Datenbank und nicht hier gerechnet
        ------------------------------------------------
        Die Vorrangregel — erst die eigene ``metadata.rung`` einer Welt, dann die
        Sprossenkarte der Plattform — steht in ``fn_building_condition_ladder``.
        Sie hier nachzubilden wäre die dritte Fassung derselben Regel; genau
        diese Form hat an einem Tag dreimal etwas kaputt gemacht (zwei Prompt-
        Vokabulare, zwei Pin-Blöcke, eine Funktion mit zwei Bedeutungen). Python
        macht deshalb nur den Abgleich über den Wert, keine Ordnung.

        Ein Fehlschlag ist kein Fehler dieser Antwort. Bleibt die Leiter aus,
        trägt jede Zeile ``rung = None`` — „steht auf keiner Sprosse" ist die
        wahre Aussage über einen unbekannten Zustand, und die Oberfläche lässt
        den Edelstein dann weg, statt eine Position zu behaupten.
        """
        if not any(r.get("taxonomy_type") == "building_condition" for r in rows):
            return rows

        rungs: dict[str, int] = {}
        try:
            response = await supabase.rpc(
                "fn_building_condition_ladder",
                {"p_simulation_id": str(simulation_id)},
            ).execute()
            for entry in extract_list(response):
                value, rung = entry.get("value"), entry.get("rung")
                if value is not None and rung is not None:
                    rungs[value] = int(rung)
        except Exception:
            logger.exception(
                "Zustandsleiter nicht lesbar, Sprossen bleiben leer (simulation_id=%s)",
                simulation_id,
            )
            return rows

        for row in rows:
            if row.get("taxonomy_type") == "building_condition":
                row["rung"] = rungs.get(row.get("value"))
        return rows

    @classmethod
    async def deactivate_taxonomy(
        cls,
        supabase: Client,
        simulation_id: UUID,
        taxonomy_id: UUID,
    ) -> dict:
        """Soft-delete a taxonomy by setting is_active=False."""
        return await cls.update(supabase, simulation_id, taxonomy_id, {"is_active": False})
