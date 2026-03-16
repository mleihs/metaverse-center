"""Service for evolving classified dossier sections when simulation changes."""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from uuid import UUID

from pydantic_ai import Agent

from backend.models.translation import TranslationContext
from backend.services.ai_utils import get_openrouter_model, run_ai
from backend.services.platform_model_config import get_platform_model
from backend.services.translation_service import TranslationService
from supabase import Client

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
            resp = (
                admin_supabase.table("simulation_lore")
                .select("id, body, body_de, evolution_count")
                .eq("simulation_id", str(simulation_id))
                .eq("chapter", "CLASSIFIED")
                .eq("arcanum", arcanum)
                .maybe_single()
                .execute()
            )
            if not resp.data:
                logger.warning(
                    "No %s section found for evolution",
                    arcanum,
                    extra={"simulation_id": str(simulation_id)},
                )
                return False

            section = resp.data
            evolution_count = section.get("evolution_count", 0) or 0

            # 2. Check budget (first 3 free, then uses regen budget)
            if evolution_count >= 3:
                # Check if feature purchase has remaining regen budget
                purchase_resp = (
                    admin_supabase.table("feature_purchases")
                    .select("regen_budget_remaining")
                    .eq("simulation_id", str(simulation_id))
                    .eq("feature_type", "classified_dossier")
                    .eq("status", "completed")
                    .order("created_at", desc=True)
                    .limit(1)
                    .maybe_single()
                    .execute()
                )
                if not purchase_resp.data:
                    return False
                remaining = purchase_resp.data.get("regen_budget_remaining", 0) or 0
                if remaining <= 0:
                    logger.info("Dossier evolution budget exhausted", extra={
                        "simulation_id": str(simulation_id), "arcanum": arcanum,
                    })
                    return False

            # 3. Get simulation name + theme for translation context
            sim_resp = (
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

            model = get_openrouter_model(
                openrouter_key,
                model_id=get_platform_model("forge"),
            )
            agent = Agent(model, system_prompt="You are the Bureau's Senior Classified Analyst.")
            result = await run_ai(agent, prompt, "dossier_evolution")
            addendum = result.output if isinstance(result.output, str) else str(result.output)

            # 5. Append to existing body
            separator = "\n\n─── BUREAU ADDENDUM ───\n\n"
            updated_body = section["body"] + separator + addendum

            # 5b. Translate addendum and append to body_de
            updated_body_de = section.get("body_de") or ""
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
                    addendum, context=context, openrouter_key=openrouter_key,
                )
                separator_de = "\n\n─── BUREAU-NACHTRAG ───\n\n"
                updated_body_de = updated_body_de + separator_de + addendum_de
            except Exception:
                logger.exception("Dossier addendum translation failed, English only")
                # Fallback: append English so body_de doesn't fall behind
                updated_body_de = updated_body_de + separator + addendum

            now = datetime.now(UTC).isoformat()
            log_entry = {
                "trigger": trigger,
                "entity": entity_name,
                "timestamp": now,
                "words_added": len(addendum.split()),
            }

            # Fetch current evolution_log
            log_resp = (
                admin_supabase.table("simulation_lore")
                .select("evolution_log")
                .eq("id", section["id"])
                .single()
                .execute()
            )
            current_log = log_resp.data.get("evolution_log") or []
            if isinstance(current_log, str):
                current_log = json.loads(current_log)
            current_log.append(log_entry)

            # Update section
            admin_supabase.table("simulation_lore").update({
                "body": updated_body,
                "body_de": updated_body_de,
                "evolved_at": now,
                "evolution_count": evolution_count + 1,
                "evolution_log": current_log,
            }).eq("id", section["id"]).execute()

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

        except Exception:
            logger.exception("Dossier evolution failed")
            return False
