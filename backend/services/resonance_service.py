"""Service for substrate resonance CRUD and impact processing."""

from __future__ import annotations

import hashlib
import logging
import random
from datetime import UTC, datetime
from uuid import UUID

import httpx
import sentry_sdk
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.dependencies import get_admin_supabase
from backend.models.resonance import (
    ARCHETYPE_DESCRIPTIONS,
    SECONDARY_EVENT_TYPE_MAP,
)
from backend.services.anchor_service import AnchorService
from backend.services.attunement_service import AttunementService
from backend.services.base_service import BaseService, serialize_for_json
from backend.services.event_service import EventService
from backend.services.external_service_resolver import ExternalServiceResolver
from backend.services.generation_service import GenerationService
from backend.services.social_story_service import SocialStoryService
from backend.utils.errors import bad_request, not_found, server_error
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

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
        """List resonances (platform-level, no simulation_id).

        Includes per-resonance impact_count to avoid N+1 queries on the frontend.
        """
        table = cls._read_table(include_deleted)
        query = supabase.table(table).select("*, resonance_impacts(count)", count="exact")

        if status_filter:
            query = query.eq("status", status_filter)
        if signature:
            query = query.eq("resonance_signature", signature)
        if search:
            query = query.ilike("title", f"%{search}%")

        query = query.order("detected_at", desc=True)
        query = query.range(offset, offset + limit - 1)
        response = await query.execute()
        total = response.count if response.count is not None else len(extract_list(response))
        results = extract_list(response)
        for r in results:
            r["magnitude_class"] = cls._classify_magnitude(float(r.get("magnitude") or 0))
            # Extract impact count from the embedded relation and flatten
            impacts_data = r.pop("resonance_impacts", [])
            if isinstance(impacts_data, list) and impacts_data:
                r["impact_count"] = impacts_data[0].get("count", 0)
            else:
                r["impact_count"] = 0
        return results, total

    @classmethod
    async def get(
        cls,
        supabase: Client,
        resonance_id: UUID,
    ) -> dict:
        """Get a single resonance by ID."""
        response = await supabase.table(cls.view_name).select("*").eq("id", str(resonance_id)).limit(1).execute()
        if not response.data:
            raise not_found(detail="Resonance not found.")
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
        insert_data = serialize_for_json(
            {
                **data,
                "created_by_id": str(user_id),
            }
        )
        response = await supabase.table(cls.table_name).insert(insert_data).execute()
        if not response.data:
            raise server_error("Failed to create resonance.")
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
        response = await supabase.table(cls.table_name).update(update_data).eq("id", str(resonance_id)).execute()
        if not response.data:
            raise not_found(detail="Resonance not found.")
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
                admin_sb = await get_admin_supabase()
                await SocialStoryService.create_subsiding_story(admin_sb, resonance_id)
            except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
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
        response = await (
            supabase.table(cls.table_name).update({"deleted_at": None}).eq("id", str(resonance_id)).execute()
        )
        if not response.data:
            raise not_found(detail="Resonance not found.")
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
        response = await (
            supabase.table("resonance_impacts")
            .select("*, simulations(name, slug)")
            .eq("resonance_id", str(resonance_id))
            .order("created_at", desc=True)
            .execute()
        )
        # Flatten simulation name/slug into each impact record
        for impact in extract_list(response):
            sim = impact.pop("simulations", None)
            impact["simulation_name"] = sim["name"] if sim else None
            impact["simulation_slug"] = sim.get("slug") if sim else None
            impact["magnitude_class"] = cls._classify_magnitude(
                float(impact.get("effective_magnitude") or impact.get("magnitude") or 0)
            )
        return extract_list(response)

    # Valid status transitions for resonances
    _VALID_IMPACT_TRANSITIONS = {"detected", "impacting"}

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

        1. Validate resonance state and signature
        2. Transition resonance to 'impacting'
        3. For each target simulation, compute susceptibility
        4. Create resonance_impact records (effective_magnitude computed by DB trigger)
        5. Spawn 2-3 events per simulation based on event_type_map
        6. Optionally generate AI narratives for each event
        """
        # Get resonance
        resonance = await cls.get(supabase, resonance_id)

        # Validate resonance can be impacted
        current_status = resonance.get("status")
        if current_status not in cls._VALID_IMPACT_TRANSITIONS:
            raise bad_request(
                f"Cannot process impact: resonance status is '{current_status}', "
                f"must be one of {sorted(cls._VALID_IMPACT_TRANSITIONS)}.",
            )

        # Validate signature exists (trigger should have populated it)
        signature = resonance.get("resonance_signature")
        if not signature:
            raise bad_request(
                "Resonance has no signature — the derive trigger may not have fired. Check source_category is valid.",
            )

        # Transition to impacting
        if current_status == "detected":
            await cls.update_status(supabase, resonance_id, "impacting")

        # Get target simulations
        if simulation_ids:
            sim_query = await (
                supabase.table("simulations")
                .select("id, name, slug, description")
                .in_("id", [str(sid) for sid in simulation_ids])
                .eq("status", "active")
                .execute()
            )
        else:
            sim_query = await (
                supabase.table("simulations")
                .select("id, name, slug, description")
                .eq("status", "active")
                .eq("simulation_type", "template")
                .execute()
            )
        simulations = extract_list(sim_query)

        if not simulations:
            logger.warning(
                "No active simulations found for resonance %s impact",
                resonance_id,
            )
            return []

        logger.info(
            "Processing resonance %s (%s / %s) across %d simulations",
            resonance_id,
            signature,
            resonance.get("archetype", "?"),
            len(simulations),
        )

        impacts: list[dict] = []
        failed_count = 0

        for sim in simulations:
            sim_id = sim["id"]
            sim_name = sim.get("name", sim_id)
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
            except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
                failed_count += 1
                logger.exception(
                    "Failed to process resonance impact for simulation %s (%s)",
                    sim_name,
                    sim_id,
                )
                with sentry_sdk.push_scope() as scope:
                    scope.set_tag("resonance_phase", "process_impact")
                    scope.set_context(
                        "resonance",
                        {
                            "resonance_id": str(resonance_id),
                            "simulation_id": str(sim_id),
                            "simulation_name": sim_name,
                            "signature": signature,
                        },
                    )
                    sentry_sdk.capture_exception(exc)
                # Record failed impact with reason
                reason = f"{type(exc).__name__}: {exc!s}"[:500]
                fail_data = serialize_for_json(
                    {
                        "resonance_id": str(resonance_id),
                        "simulation_id": str(sim_id),
                        "susceptibility": 1.0,
                        "effective_magnitude": 0,
                        "status": "failed",
                        "failure_reason": reason,
                    }
                )
                try:
                    resp = await (
                        supabase.table("resonance_impacts")
                        .upsert(fail_data, on_conflict="resonance_id,simulation_id")
                        .execute()
                    )
                    if resp.data:
                        impacts.append(resp.data[0])
                except (PostgrestAPIError, httpx.HTTPError):
                    logger.exception("Failed to record failure for simulation %s", sim_id)

        if failed_count:
            logger.warning(
                "Resonance %s impact: %d/%d simulations failed",
                resonance_id,
                failed_count,
                len(simulations),
            )

        # ── Generate Instagram Stories for this resonance ──
        # Stories use service_role (admin) client because social_stories RLS
        # restricts writes to platform admins; the scheduler also needs access.
        try:
            admin_sb = await get_admin_supabase()
            stories = await SocialStoryService.create_resonance_stories(
                admin_sb,
                resonance_id,
                impacts,
            )
            if stories:
                logger.info(
                    "Created %d resonance stories for %s",
                    len(stories),
                    resonance_id,
                )
        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
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
        """Process resonance impact for a single simulation.

        Hardened against: empty event types, None magnitudes, partial spawn
        failures, missing heartbeat tables, and AI generation unavailability.
        """
        sim_id = simulation["id"]
        sim_name = simulation.get("name", sim_id)
        resonance_id = resonance["id"]

        logger.info(
            "Processing impact for simulation %s (%s), signature=%s",
            sim_name,
            sim_id,
            signature,
        )

        # ── 1. Susceptibility (adaptive — uses resonance_memory) ──
        try:
            susc_resp = await supabase.rpc(
                "fn_get_adaptive_susceptibility",
                {"p_simulation_id": sim_id, "p_signature": signature},
            ).execute()
            susceptibility = float(susc_resp.data) if susc_resp.data is not None else 1.0
        except (PostgrestAPIError, TypeError, ValueError):
            # Fall back to static susceptibility if adaptive RPC not available
            try:
                susc_resp = await supabase.rpc(
                    "fn_get_resonance_susceptibility",
                    {"p_simulation_id": sim_id, "p_signature": signature},
                ).execute()
                susceptibility = float(susc_resp.data) if susc_resp.data is not None else 1.0
            except (TypeError, ValueError):
                susceptibility = 1.0
            logger.info(
                "Adaptive susceptibility unavailable for sim %s, using static %.2f",
                sim_id,
                susceptibility,
            )

        # ── 2. Event types ──
        try:
            types_resp = await supabase.rpc(
                "fn_get_resonance_event_types",
                {"p_simulation_id": sim_id, "p_signature": signature},
            ).execute()
            event_types = types_resp.data if types_resp.data else []
        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError):
            logger.warning(
                "Event type lookup failed for sim %s, using fallback",
                sim_id,
                exc_info=True,
            )
            event_types = []

        # Fallback: unknown signature or missing config → generic event types
        if not event_types:
            event_types = ["crisis", "social", "intrigue"]
            logger.warning(
                "No event types mapped for signature %r in simulation %s (%s), using fallback %s",
                signature,
                sim_name,
                sim_id,
                event_types,
            )

        # ── 3. Create/upsert impact record ──
        impact_data = serialize_for_json(
            {
                "resonance_id": str(resonance_id),
                "simulation_id": str(sim_id),
                "susceptibility": susceptibility,
                "effective_magnitude": 0,  # overwritten by DB trigger
                "status": "generating",
                "failure_reason": None,  # clear previous failure if re-processing
            }
        )
        impact_resp = await (
            supabase.table("resonance_impacts").upsert(impact_data, on_conflict="resonance_id,simulation_id").execute()
        )
        if not impact_resp.data:
            raise server_error(f"Failed to create impact record for simulation {sim_name}")
        impact = impact_resp.data[0]

        # Guard against None effective_magnitude (trigger didn't fire)
        raw_mag = impact.get("effective_magnitude")
        if raw_mag is None:
            logger.warning(
                "effective_magnitude is NULL for impact %s — trigger may not have fired. "
                "Falling back to resonance magnitude * susceptibility.",
                impact["id"],
            )
            base_mag = float(resonance.get("magnitude") or 0.5)
            effective_mag = round(base_mag * susceptibility, 4)
        else:
            effective_mag = float(raw_mag)

        # ── 4. Heartbeat modifiers (attunement + anchor) ──
        had_attunement = False
        had_anchor_protection = False
        try:
            attunements = await AttunementService.list_attunements(supabase, UUID(sim_id))
            for att in attunements:
                if att.get("resonance_signature") == signature:
                    depth = float(att.get("depth", 0))
                    if depth > 0:
                        had_attunement = True
                    reduction = depth * 0.3
                    effective_mag = round(max(0, effective_mag - reduction), 4)
                    logger.info(
                        "Attunement reduced magnitude by %.4f for %s (depth %.2f)",
                        reduction,
                        sim_name,
                        depth,
                    )

            protection = await AnchorService.get_protection_factor(supabase, UUID(sim_id))
            if protection > 0:
                had_anchor_protection = True
                effective_mag = round(effective_mag * (1.0 - protection), 4)
                logger.info(
                    "Anchor protection reduced magnitude by %.1f%% for %s",
                    protection * 100,
                    sim_name,
                )
        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
            logger.info(
                "Heartbeat modifiers unavailable for sim %s (tables may not exist yet)",
                sim_id,
            )

        # ── 5. Skip low-impact simulations ──
        if effective_mag < 0.05:
            logger.info(
                "Skipping low-impact simulation %s (effective_mag=%.4f)",
                sim_name,
                effective_mag,
            )
            await cls._update_impact_status(supabase, impact["id"], "skipped")
            return impact

        # ── 6. Resolve AI generation service ──
        gen_service: GenerationService | None = None
        if generate_narratives:
            try:
                resolver = ExternalServiceResolver(supabase, UUID(sim_id))
                ai_config = await resolver.get_ai_provider_config()
                gen_service = GenerationService(supabase, UUID(sim_id), ai_config.openrouter_api_key)
            except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
                logger.warning(
                    "AI generation unavailable for %s (%s), using template titles",
                    sim_name,
                    sim_id,
                    exc_info=True,
                )

        # ── 7. Spawn events (weighted random selection) ──
        selected_types = cls._select_event_types(event_types, signature, resonance_id)
        spawned_ids: list[str] = []
        spawned_events: list[dict] = []
        spawn_errors: list[str] = []

        for event_type in selected_types:
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
            except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
                error_msg = f"{event_type}: {type(exc).__name__}: {exc!s}"[:200]
                spawn_errors.append(error_msg)
                logger.exception(
                    "Failed to spawn %s event for %s (%s)",
                    event_type,
                    sim_name,
                    sim_id,
                )
                with sentry_sdk.push_scope() as scope:
                    scope.set_tag("resonance_phase", "spawn_event")
                    scope.set_context(
                        "resonance",
                        {
                            "resonance_id": str(resonance_id),
                            "simulation_id": str(sim_id),
                            "event_type": event_type,
                            "effective_magnitude": effective_mag,
                        },
                    )
                    sentry_sdk.capture_exception(exc)

        # ── 8. Determine final status ──
        total_attempted = len(event_types[:3])
        if spawned_ids and spawn_errors:
            final_status = "partial"
            errors_joined = "; ".join(spawn_errors)
            failure_reason = (f"{len(spawned_ids)}/{total_attempted} events spawned. Errors: {errors_joined}")[:500]
        elif spawned_ids:
            final_status = "completed"
            failure_reason = None
        else:
            final_status = "failed"
            if spawn_errors:
                errors_joined = "; ".join(spawn_errors)
                failure_reason = (f"All {total_attempted} event spawns failed: {errors_joined}")[:500]
            else:
                failure_reason = "No events could be spawned (unknown error)"

        # ── 9. Update impact record ──
        update_data = serialize_for_json(
            {
                "spawned_event_ids": spawned_ids,
                "status": final_status,
                "failure_reason": failure_reason,
                "effective_magnitude": effective_mag,  # persist heartbeat-adjusted value
            }
        )
        update_resp = await (
            supabase.table("resonance_impacts").update(update_data).eq("id", str(impact["id"])).execute()
        )

        if final_status == "failed":
            logger.error(
                "Impact FAILED for %s (%s): %s",
                sim_name,
                sim_id,
                failure_reason,
            )
        elif final_status == "partial":
            logger.warning(
                "Impact PARTIAL for %s (%s): %s",
                sim_name,
                sim_id,
                failure_reason,
            )
        else:
            logger.info(
                "Impact completed for %s: %d events spawned (mag=%.4f)",
                sim_name,
                len(spawned_ids),
                effective_mag,
            )

        # ── 10. Post-processing (non-fatal) ──
        if spawned_ids:
            try:
                await EventService._post_event_mutation(supabase, UUID(sim_id))
            except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
                logger.warning(
                    "Post-mutation pipeline failed for %s (%s)",
                    sim_name,
                    sim_id,
                    exc_info=True,
                )

        if generate_reactions and gen_service and spawned_events:
            for event in spawned_events:
                try:
                    await EventService.generate_reactions(
                        supabase,
                        UUID(sim_id),
                        event,
                        gen_service,
                    )
                except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
                    logger.warning(
                        "Auto-reaction generation failed for event %s in %s",
                        event["id"],
                        sim_name,
                        exc_info=True,
                    )

        # ── 11. Compound Archetype bonus events ──
        try:
            compound_resp = await supabase.rpc(
                "fn_detect_compound_archetypes",
                {"p_simulation_id": sim_id},
            ).execute()
            compounds = compound_resp.data if compound_resp.data else []
            for compound in compounds:
                compound_types = compound.get("event_types", [])
                # Spawn 1 compound event (not 3 — it's a bonus, not a replacement)
                if compound_types and gen_service:
                    compound_type = compound_types[0]
                    try:
                        compound_event = await cls._spawn_resonance_event(
                            supabase,
                            simulation=simulation,
                            resonance=resonance,
                            event_type=compound_type,
                            effective_magnitude=float(compound.get("combined_magnitude", effective_mag)),
                            user_id=user_id,
                            gen_service=gen_service,
                        )
                        spawned_ids.append(compound_event["id"])
                        logger.info(
                            "Spawned compound archetype event: %s (%s) in %s",
                            compound["compound_name"],
                            compound_type,
                            sim_name,
                        )
                    except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
                        logger.warning(
                            "Compound event spawn failed for %s in %s",
                            compound.get("compound_name", "?"),
                            sim_name,
                            exc_info=True,
                        )
        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
            logger.debug("Compound archetype detection unavailable (non-fatal)")

        # ── 12. Record resonance memory for adaptive susceptibility ──
        was_mitigated = had_attunement or had_anchor_protection
        try:
            await supabase.table("resonance_memory").insert({
                "simulation_id": sim_id,
                "resonance_signature": signature,
                "effective_magnitude": effective_mag,
                "was_mitigated": was_mitigated,
            }).execute()
        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
            logger.debug("Resonance memory recording failed (non-fatal)")

        return update_resp.data[0] if update_resp.data else impact

    @classmethod
    def _select_event_types(
        cls,
        primary_types: list[str],
        signature: str,
        resonance_id: str,
        count: int = 3,
    ) -> list[str]:
        """Select event types using weighted random from primary + secondary pools.

        Primary types (from simulation config) get weight 3.
        Secondary types (from SECONDARY_EVENT_TYPE_MAP) get weight 1.
        Selection is deterministic per resonance_id for reproducibility.
        """
        secondary = SECONDARY_EVENT_TYPE_MAP.get(signature, [])
        # Build weighted pool: primary × 3, secondary × 1
        pool: list[str] = []
        weights: list[int] = []
        seen: set[str] = set()
        for t in primary_types:
            if t not in seen:
                pool.append(t)
                weights.append(3)
                seen.add(t)
        for t in secondary:
            if t not in seen:
                pool.append(t)
                weights.append(1)
                seen.add(t)

        if not pool:
            return ["crisis", "social", "intrigue"][:count]

        # Deterministic seed from resonance_id for reproducibility (not crypto)
        seed = int(hashlib.sha256(str(resonance_id).encode()).hexdigest()[:8], 16)
        rng = random.Random(seed)  # noqa: S311 — intentional deterministic seeding

        selected: list[str] = []
        remaining_pool = list(pool)
        remaining_weights = list(weights)
        for _ in range(min(count, len(remaining_pool))):
            choices = rng.choices(remaining_pool, weights=remaining_weights, k=1)
            choice = choices[0]
            selected.append(choice)
            idx = remaining_pool.index(choice)
            remaining_pool.pop(idx)
            remaining_weights.pop(idx)

        return selected

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
                except (httpx.HTTPError, KeyError, TypeError, ValueError):
                    logger.warning(
                        "German translation failed for resonance event, EN only",
                        exc_info=True,
                    )
            except (httpx.HTTPError, KeyError, TypeError, ValueError):
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
            supabase,
            sim_id,
            user_id,
            event_data,
        )

        logger.info(
            "Spawned resonance event: %s (type=%s, impact=%d) in %s",
            event["id"],
            event_type,
            impact_level,
            simulation.get("name", sim_id),
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
        await supabase.table("resonance_impacts").update({"status": new_status}).eq("id", impact_id).execute()
