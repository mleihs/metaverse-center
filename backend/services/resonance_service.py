"""Service for substrate resonance CRUD and impact processing."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status

from backend.models.resonance import ARCHETYPE_DESCRIPTIONS
from backend.services.base_service import BaseService, serialize_for_json
from backend.services.event_service import EventService
from backend.services.external_service_resolver import ExternalServiceResolver
from backend.services.generation_service import GenerationService
from backend.services.social_story_service import SocialStoryService
from supabase import Client

logger = logging.getLogger(__name__)


class ResonanceService(BaseService):
    """Platform-level resonance CRUD + per-simulation impact processing."""

    table_name = "substrate_resonances"
    view_name = "active_resonances"
    supports_created_by = True

    # ── CRUD overrides ───────────────────────────────────────────────────

    @classmethod
    async def list(
        cls,
        supabase: Client,
        *,
        status_filter: str | None = None,
        signature: str | None = None,
        search: str | None = None,
        limit: int = 25,
        offset: int = 0,
        include_deleted: bool = False,
    ) -> tuple[list[dict], int]:
        """List resonances (platform-level, no simulation_id)."""
        table = cls._read_table(include_deleted)
        query = supabase.table(table).select("*", count="exact")

        if status_filter:
            query = query.eq("status", status_filter)
        if signature:
            query = query.eq("resonance_signature", signature)
        if search:
            query = query.ilike("title", f"%{search}%")

        query = query.order("detected_at", desc=True)
        query = query.range(offset, offset + limit - 1)
        response = query.execute()
        total = response.count if response.count is not None else len(response.data or [])
        results = response.data or []
        for r in results:
            r["magnitude_class"] = cls._classify_magnitude(float(r.get("magnitude") or 0))
        return results, total

    @classmethod
    async def get(
        cls,
        supabase: Client,
        resonance_id: UUID,
    ) -> dict:
        """Get a single resonance by ID."""
        response = (
            supabase.table(cls.view_name)
            .select("*")
            .eq("id", str(resonance_id))
            .limit(1)
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resonance not found.",
            )
        result = response.data[0]
        result["magnitude_class"] = cls._classify_magnitude(float(result.get("magnitude") or 0))
        return result

    @classmethod
    async def create(
        cls,
        supabase: Client,
        user_id: UUID,
        data: dict,
    ) -> dict:
        """Create a resonance. Postgres trigger derives signature/archetype/event_types."""
        insert_data = serialize_for_json({
            **data,
            "created_by_id": str(user_id),
        })
        response = (
            supabase.table(cls.table_name)
            .insert(insert_data)
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create resonance.",
            )
        return response.data[0]

    @classmethod
    async def update(
        cls,
        supabase: Client,
        resonance_id: UUID,
        data: dict,
    ) -> dict:
        """Update a resonance."""
        update_data = serialize_for_json(data)
        response = (
            supabase.table(cls.table_name)
            .update(update_data)
            .eq("id", str(resonance_id))
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resonance not found.",
            )
        return response.data[0]

    @classmethod
    async def update_status(
        cls,
        supabase: Client,
        resonance_id: UUID,
        new_status: str,
    ) -> dict:
        """Transition resonance status.

        When transitioning to 'subsiding', creates the final resolution Story.
        """
        result = await cls.update(supabase, resonance_id, {"status": new_status})

        # Hook: create subsiding story when resonance starts resolving
        if new_status == "subsiding":
            try:
                from backend.dependencies import get_admin_supabase
                admin_sb = await get_admin_supabase()
                await SocialStoryService.create_subsiding_story(admin_sb, resonance_id)
            except Exception:
                logger.warning(
                    "Subsiding story creation failed (non-fatal)",
                    exc_info=True,
                )

        return result

    @classmethod
    async def soft_delete(
        cls,
        supabase: Client,
        resonance_id: UUID,
    ) -> dict:
        """Soft-delete a resonance."""
        return await cls.update(supabase, resonance_id, {"deleted_at": datetime.now(UTC).isoformat()})

    @classmethod
    async def restore(
        cls,
        supabase: Client,
        resonance_id: UUID,
    ) -> dict:
        """Restore a soft-deleted resonance."""
        response = (
            supabase.table(cls.table_name)
            .update({"deleted_at": None})
            .eq("id", str(resonance_id))
            .execute()
        )
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resonance not found.",
            )
        return response.data[0]

    # ── Impact Processing ────────────────────────────────────────────────

    @staticmethod
    def _classify_magnitude(magnitude: float) -> str:
        """Classify magnitude into low/medium/high."""
        if magnitude <= 0.4:
            return "low"
        if magnitude <= 0.7:
            return "medium"
        return "high"

    @classmethod
    async def list_impacts(
        cls,
        supabase: Client,
        resonance_id: UUID,
    ) -> list[dict]:
        """List all impacts for a resonance, including simulation names/slugs."""
        response = (
            supabase.table("resonance_impacts")
            .select("*, simulations(name, slug)")
            .eq("resonance_id", str(resonance_id))
            .order("created_at", desc=True)
            .execute()
        )
        # Flatten simulation name/slug into each impact record
        for impact in response.data or []:
            sim = impact.pop("simulations", None)
            impact["simulation_name"] = sim["name"] if sim else None
            impact["simulation_slug"] = sim.get("slug") if sim else None
            impact["magnitude_class"] = cls._classify_magnitude(
                float(impact.get("effective_magnitude") or impact.get("magnitude") or 0)
            )
        return response.data or []

    @classmethod
    async def process_impact(
        cls,
        supabase: Client,
        resonance_id: UUID,
        user_id: UUID,
        *,
        simulation_ids: list[UUID] | None = None,
        generate_narratives: bool = True,
        generate_reactions: bool = True,
        locale: str = "de",
    ) -> list[dict]:
        """Process resonance impact across simulations.

        1. Transition resonance to 'impacting'
        2. For each target simulation, compute susceptibility
        3. Create resonance_impact records (effective_magnitude computed by DB trigger)
        4. Spawn 2-3 events per simulation based on event_type_map
        5. Optionally generate AI narratives for each event
        """
        # Get resonance
        resonance = await cls.get(supabase, resonance_id)

        # Transition to impacting
        if resonance["status"] == "detected":
            await cls.update_status(supabase, resonance_id, "impacting")

        # Get target simulations
        if simulation_ids:
            sim_query = (
                supabase.table("simulations")
                .select("id, name, slug, description")
                .in_("id", [str(sid) for sid in simulation_ids])
                .eq("status", "active")
                .execute()
            )
        else:
            sim_query = (
                supabase.table("simulations")
                .select("id, name, slug, description")
                .eq("status", "active")
                .eq("simulation_type", "template")
                .execute()
            )
        simulations = sim_query.data or []

        if not simulations:
            logger.warning("No active simulations found for resonance impact")
            return []

        signature = resonance["resonance_signature"]
        impacts: list[dict] = []

        for sim in simulations:
            sim_id = sim["id"]
            try:
                impact = await cls._process_simulation_impact(
                    supabase,
                    resonance=resonance,
                    simulation=sim,
                    signature=signature,
                    user_id=user_id,
                    generate_narratives=generate_narratives,
                    generate_reactions=generate_reactions,
                    locale=locale,
                )
                impacts.append(impact)
            except Exception:
                logger.exception(
                    "Failed to process resonance impact for simulation %s", sim_id,
                )
                # Record failed impact
                fail_data = serialize_for_json({
                    "resonance_id": str(resonance_id),
                    "simulation_id": str(sim_id),
                    "susceptibility": 1.0,
                    "effective_magnitude": 0,
                    "status": "failed",
                })
                try:
                    resp = (
                        supabase.table("resonance_impacts")
                        .upsert(fail_data, on_conflict="resonance_id,simulation_id")
                        .execute()
                    )
                    if resp.data:
                        impacts.append(resp.data[0])
                except Exception:
                    logger.exception("Failed to record failure for simulation %s", sim_id)

        # ── Generate Instagram Stories for this resonance ──
        # Stories use service_role (admin) client because social_stories RLS
        # restricts writes to platform admins; the scheduler also needs access.
        try:
            from backend.dependencies import get_admin_supabase
            admin_sb = await get_admin_supabase()
            stories = await SocialStoryService.create_resonance_stories(
                admin_sb, resonance_id, impacts,
            )
            if stories:
                logger.info(
                    "Created %d resonance stories for %s",
                    len(stories), resonance_id,
                )
        except Exception:
            logger.warning(
                "Resonance story creation failed (non-fatal)",
                exc_info=True,
            )

        return impacts

    @classmethod
    async def _process_simulation_impact(
        cls,
        supabase: Client,
        *,
        resonance: dict,
        simulation: dict,
        signature: str,
        user_id: UUID,
        generate_narratives: bool,
        generate_reactions: bool,
        locale: str,
    ) -> dict:
        """Process resonance impact for a single simulation."""
        sim_id = simulation["id"]
        resonance_id = resonance["id"]

        # Get susceptibility via Postgres fn_get_resonance_susceptibility (migration 076)
        susc_resp = supabase.rpc(
            "fn_get_resonance_susceptibility",
            {"p_simulation_id": sim_id, "p_signature": signature},
        ).execute()
        susceptibility = float(susc_resp.data) if susc_resp.data is not None else 1.0

        # Get event types via Postgres fn_get_resonance_event_types (migration 076)
        types_resp = supabase.rpc(
            "fn_get_resonance_event_types",
            {"p_simulation_id": sim_id, "p_signature": signature},
        ).execute()
        event_types = types_resp.data if types_resp.data else []

        # Create impact record (effective_magnitude computed by DB trigger)
        impact_data = serialize_for_json({
            "resonance_id": str(resonance_id),
            "simulation_id": str(sim_id),
            "susceptibility": susceptibility,
            "effective_magnitude": 0,  # will be overwritten by trigger
            "status": "generating",
        })
        impact_resp = (
            supabase.table("resonance_impacts")
            .upsert(impact_data, on_conflict="resonance_id,simulation_id")
            .execute()
        )
        if not impact_resp.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create impact for simulation {sim_id}",
            )
        impact = impact_resp.data[0]
        effective_mag = float(impact["effective_magnitude"])

        # ── Heartbeat integration: attunement & anchor modifiers ──
        try:
            from backend.services.anchor_service import AnchorService
            from backend.services.attunement_service import AttunementService

            # Attunement susceptibility reduction
            attunements = await AttunementService.list_attunements(supabase, UUID(sim_id))
            for att in attunements:
                if att.get("resonance_signature") == signature:
                    depth = float(att.get("depth", 0))
                    reduction = depth * 0.3
                    effective_mag = round(max(0, effective_mag - reduction), 4)
                    logger.debug(
                        "Attunement reduced magnitude by %.4f for sim %s (depth %.2f)",
                        reduction, sim_id, depth,
                    )

            # Anchor protection reduction
            protection = await AnchorService.get_protection_factor(supabase, UUID(sim_id))
            if protection > 0:
                effective_mag = round(effective_mag * (1.0 - protection), 4)
                logger.debug(
                    "Anchor protection reduced magnitude by %.2f%% for sim %s",
                    protection * 100, sim_id,
                )
        except Exception:
            logger.debug("Heartbeat modifiers unavailable (tables may not exist yet)")

        # Skip low-impact simulations
        if effective_mag < 0.05:
            await cls._update_impact_status(supabase, impact["id"], "skipped")
            return impact

        # Spawn events (2-3 per simulation based on event_type_map)
        spawned_ids: list[str] = []
        gen_service: GenerationService | None = None

        if generate_narratives:
            try:
                resolver = ExternalServiceResolver(supabase, UUID(sim_id))
                ai_config = await resolver.get_ai_provider_config()
                gen_service = GenerationService(supabase, UUID(sim_id), ai_config.openrouter_api_key)
            except Exception:
                logger.warning(
                    "AI generation unavailable for simulation %s, using template titles",
                    sim_id,
                    exc_info=True,
                )

        spawned_events: list[dict] = []
        for event_type in event_types[:3]:
            try:
                event = await cls._spawn_resonance_event(
                    supabase,
                    simulation=simulation,
                    resonance=resonance,
                    event_type=event_type,
                    effective_magnitude=effective_mag,
                    user_id=user_id,
                    gen_service=gen_service,
                )
                spawned_ids.append(event["id"])
                spawned_events.append(event)
            except Exception:
                logger.exception(
                    "Failed to spawn %s event for simulation %s",
                    event_type, sim_id,
                )

        # Update impact with spawned event IDs
        update_data = serialize_for_json({
            "spawned_event_ids": spawned_ids,
            "status": "completed" if spawned_ids else "failed",
        })
        update_resp = (
            supabase.table("resonance_impacts")
            .update(update_data)
            .eq("id", str(impact["id"]))
            .execute()
        )

        # Trigger post-event-mutation pipeline for this simulation
        if spawned_ids:
            try:
                await EventService._post_event_mutation(supabase, UUID(sim_id))
            except Exception:
                logger.warning(
                    "Post-mutation pipeline failed for simulation %s", sim_id,
                    exc_info=True,
                )

        # Auto-generate agent reactions for spawned events
        if generate_reactions and gen_service and spawned_events:
            for event in spawned_events:
                try:
                    await EventService.generate_reactions(
                        supabase, UUID(sim_id), event, gen_service,
                    )
                    logger.info(
                        "Auto-generated reactions for resonance event %s",
                        event["id"],
                    )
                except Exception:
                    logger.warning(
                        "Auto-reaction generation failed for event %s",
                        event["id"],
                        exc_info=True,
                    )

        return update_resp.data[0] if update_resp.data else impact

    @classmethod
    async def _spawn_resonance_event(
        cls,
        supabase: Client,
        *,
        simulation: dict,
        resonance: dict,
        event_type: str,
        effective_magnitude: float,
        user_id: UUID,
        gen_service: GenerationService | None,
    ) -> dict:
        """Spawn a single event from resonance impact.

        Generates English content first (title, description), then a German
        translation (title_de, description_de) — same pattern as agents/buildings.
        """
        archetype = resonance["archetype"]
        impact_level = min(10, max(1, round(effective_magnitude * 10)))

        # Generate title and description via AI or fallback template
        title: str
        description: str | None
        title_de: str | None = None
        description_de: str | None = None

        if gen_service:
            try:
                # 1. Generate English version
                generated_en = await gen_service.generate_resonance_event(
                    archetype_name=archetype,
                    archetype_description=ARCHETYPE_DESCRIPTIONS.get(archetype, ""),
                    resonance_title=resonance["title"],
                    resonance_description=resonance.get("description", ""),
                    event_type=event_type,
                    magnitude=effective_magnitude,
                    locale="en",
                )
                title = generated_en.get("title", f"{archetype} — {event_type}")
                description = generated_en.get("description")
                if generated_en.get("impact_level"):
                    impact_level = min(10, max(1, int(generated_en["impact_level"])))

                # 2. Generate German translation
                try:
                    generated_de = await gen_service.generate_resonance_event(
                        archetype_name=archetype,
                        archetype_description=ARCHETYPE_DESCRIPTIONS.get(archetype, ""),
                        resonance_title=resonance["title"],
                        resonance_description=resonance.get("description", ""),
                        event_type=event_type,
                        magnitude=effective_magnitude,
                        locale="de",
                    )
                    title_de = generated_de.get("title")
                    description_de = generated_de.get("description")
                except Exception:
                    logger.warning(
                        "German translation failed for resonance event, EN only",
                        exc_info=True,
                    )
            except Exception:
                logger.warning(
                    "AI generation failed for resonance event, using template",
                    exc_info=True,
                )
                title = f"{archetype} — {event_type.replace('_', ' ').title()}"
                description = resonance.get("description")
        else:
            title = f"{archetype} — {event_type.replace('_', ' ').title()}"
            description = resonance.get("description")

        event_data = {
            "title": title,
            "event_type": event_type,
            "description": description,
            "data_source": "resonance",
            "impact_level": impact_level,
            "event_status": "active",
            "tags": ["resonance", resonance["resonance_signature"], archetype.lower().replace(" ", "_")],
            "external_refs": {
                "resonance_id": str(resonance["id"]),
                "resonance_signature": resonance["resonance_signature"],
                "archetype": archetype,
            },
        }
        if title_de:
            event_data["title_de"] = title_de
        if description_de:
            event_data["description_de"] = description_de

        sim_id = UUID(simulation["id"])
        event = await EventService.create(
            supabase, sim_id, user_id, event_data,
        )

        logger.info(
            "Spawned resonance event: %s (type=%s, impact=%d) in %s",
            event["id"], event_type, impact_level, simulation.get("name", sim_id),
        )
        return event

    # ── Helpers ───────────────────────────────────────────────────────────

    @staticmethod
    async def _update_impact_status(
        supabase: Client,
        impact_id: str,
        new_status: str,
    ) -> None:
        """Update a resonance impact status."""
        supabase.table("resonance_impacts").update(
            {"status": new_status}
        ).eq("id", impact_id).execute()
