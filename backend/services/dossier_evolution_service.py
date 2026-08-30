"""Service for evolving classified dossier sections when simulation changes."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from uuid import UUID

import httpx
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.models.translation import TranslationContext
from backend.services.ai_utils import (
    MODEL_CALL_ERRORS,
    create_forge_agent,
    run_ai,
)
from backend.services.translation_service import TranslationService
from backend.utils.db import maybe_single_data
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

EVOLUTION_PROMPTS = {
    "BETA": (
        "You are the Bureau's Senior Classified Analyst. A new agent has been recruited "
        "to shard '{sim_name}'. Write a classified addendum (~200 words) for this agent:\n\n"
        "AGENT: {entity_name}\n"
        "PROFESSION: {entity_detail}\n\n"
        "Use the following format:\n"
        "=== AGENT: {entity_name} ===\n"
        "RISK ASSESSMENT: [LOW/MODERATE/HIGH/CRITICAL]\n"
        "HIDDEN MOTIVATION: [1-2 sentences]\n"
        "SURVEILLANCE NOTES: [2-3 paragraphs]\n"
        "CROSS-REFERENCES: [other relevant names]\n"
        "BUREAU ANNOTATION: [1 sentence, dry humor]\n"
        "=== END AGENT ===\n\n"
        "Maintain the Bureau's institutional tone. Reference existing simulation context."
    ),
    "GAMMA": (
        "You are the Bureau's Senior Classified Analyst. A new structure has been "
        "constructed in shard '{sim_name}'. Write a geographic anomaly note (~150 words):\n\n"
        "BUILDING: {entity_name}\n"
        "TYPE: {entity_detail}\n\n"
        "Describe spatial irregularities, impossible geometry, or cartographic anomalies "
        "associated with this structure. Bureau tone, clinical precision."
    ),
    "DELTA": (
        "You are the Bureau's Senior Classified Analyst. A resonance event has affected "
        "shard '{sim_name}'. Write a bleed signature update (~200 words):\n\n"
        "EVENT: {entity_name}\n"
        "DETAILS: {entity_detail}\n\n"
        "Describe how the resonance event manifests as reality leakage. "
        "Include sensory manifestations and containment protocol updates."
    ),
    "ZETA": (
        "You are the Bureau's Senior Classified Analyst. Update the Bureau's official "
        "recommendation for shard '{sim_name}' (~100 words):\n\n"
        "TRIGGER: {entity_name}\n"
        "CONTEXT: {entity_detail}\n\n"
        "Revise threat level assessment. Maintain institutional language with dry humor."
    ),
}


class DossierEvolutionService:
    """Generates addenda for existing dossier sections when simulation changes."""

    @staticmethod
    async def evolve_section(
        admin_supabase: Client,
        simulation_id: UUID,
        arcanum: str,
        trigger: str,
        entity_name: str,
        entity_detail: str = "",
        openrouter_key: str | None = None,
    ) -> bool:
        """Append AI-generated content to an existing dossier section.

        Args:
            admin_supabase: Service-role Supabase client.
            simulation_id: Target simulation.
            arcanum: Which section to evolve (BETA, GAMMA, DELTA, ZETA).
            trigger: What caused the evolution (e.g. 'agent_recruited').
            entity_name: Name of the new entity/event.
            entity_detail: Additional context (profession, type, etc.).
            openrouter_key: Optional BYOK key.

        Returns True if evolution succeeded.
        """
        try:
            # 1. Get existing section
            section = await maybe_single_data(
                admin_supabase.table("simulation_lore")
                .select("id, body, body_de, evolution_count")
                .eq("simulation_id", str(simulation_id))
                .eq("chapter", "CLASSIFIED")
                .eq("arcanum", arcanum)
                .maybe_single()
            )
            if not section:
                logger.warning(
                    "No %s section found for evolution",
                    arcanum,
                    extra={"simulation_id": str(simulation_id)},
                )
                return False
            evolution_count = section.get("evolution_count", 0) or 0

            # 2. Check budget (first 3 free, then uses regen budget)
            if evolution_count >= 3:
                # Check if feature purchase has remaining regen budget
                purchase_data = await maybe_single_data(
                    admin_supabase.table("feature_purchases")
                    .select("regen_budget_remaining")
                    .eq("simulation_id", str(simulation_id))
                    .eq("feature_type", "classified_dossier")
                    .eq("status", "completed")
                    .order("created_at", desc=True)
                    .limit(1)
                    .maybe_single()
                )
                if not purchase_data:
                    return False
                remaining = purchase_data.get("regen_budget_remaining", 0) or 0
                if remaining <= 0:
                    logger.info(
                        "Dossier evolution budget exhausted",
                        extra={
                            "simulation_id": str(simulation_id),
                            "arcanum": arcanum,
                        },
                    )
                    return False

            # 3. Get simulation name + theme for translation context
            sim_resp = await (
                admin_supabase.table("simulations")
                .select("name, description")
                .eq("id", str(simulation_id))
                .single()
                .execute()
            )
            sim_name = sim_resp.data.get("name", "Unknown")
            sim_theme = sim_resp.data.get("description", "")

            # 4. Generate addendum
            prompt_template = EVOLUTION_PROMPTS.get(arcanum)
            if not prompt_template:
                logger.warning("No evolution prompt for arcanum %s", arcanum)
                return False

            prompt = prompt_template.format(
                sim_name=sim_name,
                entity_name=entity_name,
                entity_detail=entity_detail,
            )

            agent = create_forge_agent(
                "You are the Bureau's Senior Classified Analyst.",
                api_key=openrouter_key,
                purpose="dossier_evolution",
            )
            # Bureau Ops Deferral A.2 — simulation_id is in scope; thread it
            # so per-sim budgets can throttle runaway evolution storms. user_id
            # is not in scope (this runs from a post-trigger flow, not a user
            # request), so only the global / purpose / simulation axes apply.
            result = await run_ai(
                agent,
                prompt,
                "dossier_evolution",
                admin_supabase=admin_supabase,
                simulation_id=simulation_id,
            )
            addendum = result.output if isinstance(result.output, str) else str(result.output)

            # 5. Build the English addendum + separator. The concatenation onto
            # the live body happens server-side in fn_record_dossier_evolution
            # (migration 262), not here, so concurrent evolutions can't clobber.
            separator = "\n\n─── BUREAU ADDENDUM ───\n\n"

            # 5b. Translate the addendum for body_de. Default to the English
            # fallback (so body_de never falls behind) and override the separator
            # + text only on a successful translation.
            body_de_separator = separator
            addendum_de = addendum
            try:
                context = TranslationContext(
                    simulation_name=sim_name,
                    simulation_theme=sim_theme,
                    entity_type="classified_dossier",
                    entity_name=entity_name,
                    additional_context=(
                        f"Bureau classified intelligence addendum for ARCANUM section {arcanum}. "
                        f"Formal institutional tone, clinical precision. "
                        f"Triggered by: {trigger}."
                    ),
                )
                addendum_de = await TranslationService.translate_text(
                    addendum,
                    context=context,
                    openrouter_key=openrouter_key,
                )
                body_de_separator = "\n\n─── BUREAU-NACHTRAG ───\n\n"
            except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
                logger.exception("Dossier addendum translation failed, English only")

            log_entry = {
                "trigger": trigger,
                "entity": entity_name,
                "timestamp": datetime.now(UTC).isoformat(),
                "words_added": len(addendum.split()),
            }

            # Atomic evolution: body/body_de concatenation, evolution_count
            # increment, and evolution_log append all happen server-side on the
            # live row in one statement (fn_record_dossier_evolution, migration
            # 262) -- no stale read-modify-write, no lost concurrent evolution.
            await admin_supabase.rpc(
                "fn_record_dossier_evolution",
                {
                    "p_section_id": section["id"],
                    "p_body_separator": separator,
                    "p_addendum": addendum,
                    "p_body_de_separator": body_de_separator,
                    "p_addendum_de": addendum_de,
                    "p_log_entry": log_entry,
                },
            ).execute()

            logger.info(
                "Dossier section evolved",
                extra={
                    "simulation_id": str(simulation_id),
                    "arcanum": arcanum,
                    "trigger": trigger,
                    "entity": entity_name,
                },
            )
            return True

        except (*MODEL_CALL_ERRORS, PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
            logger.exception("Dossier evolution failed")
            return False
