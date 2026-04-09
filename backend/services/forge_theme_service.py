"""Service for AI-generated simulation themes."""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

import httpx
import sentry_sdk
import structlog
from pydantic_ai import Agent

from backend.config import settings
from backend.models.forge import ForgeThemeOutput
from backend.services.ai_utils import get_openrouter_model, run_ai
from backend.services.platform_model_config import get_platform_model
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

THEME_ARCHITECT_PROMPT = (
    "You are a Visual Identity Architect at the Bureau of Impossible Geography. "
    "Your task is to design a complete, cohesive visual theme for a simulation shard. "
    "The theme must reflect the world's philosophical anchor, atmosphere, and geography.\n\n"
    "RULES:\n"
    "- All color values must be valid hex codes (#xxxxxx).\n"
    "- Dark themes: background should be dark (#0a-#1a range), text should be light.\n"
    "- Light themes: background should be light (#e0-#ff range), text should be dark.\n"
    "- Ensure sufficient contrast between text and background (WCAG AA).\n"
    "- color_primary should be the dominant brand color, distinctive and memorable.\n"
    "- color_danger must always be a red variant, color_success a green variant.\n"
    "- Font families must be real Google Fonts or system fonts wrapped in proper CSS syntax.\n"
    "- Choose heading fonts that match the world's character (brutalist → Oswald, "
    "literary → Playfair Display, tech → JetBrains Mono, organic → Lora).\n"
    "- shadow_style options: 'offset' (hard shadow), 'blur' (soft shadow), 'glow' (neon), 'none'.\n"
    "- hover_effect options: 'translate' (shift on hover), 'scale' (grow), 'glow' (luminous).\n"
    "- card_frame_texture: 'none', 'filigree', 'circuits', 'scanlines', 'rivets', 'illumination'.\n"
    "- card_frame_nameplate: 'terminal', 'banner', 'readout', 'plate', 'cartouche'.\n"
    "- card_frame_corners: 'none', 'tentacles', 'brackets', 'crosshairs', 'bolts', 'floral'.\n"
    "- card_frame_foil: 'holographic', 'aquatic', 'phosphor', 'patina', 'gilded'.\n"
    "- animation_speed: '0.7' (fast) to '2.0' (slow). Match the world's tempo.\n"
    "- animation_easing: valid CSS easing (ease, ease-in-out, cubic-bezier(...), steps(...)).\n\n"
    "IMAGE STYLE PROMPTS:\n"
    "You must also generate 4 image style prompts that will be appended to AI image generation "
    "prompts (Replicate Flux). These control the visual style of all generated images for this world.\n"
    "- image_style_prompt_portrait: Style for character portraits. Describe lighting, medium, mood, "
    "color grading. E.g. 'daguerreotype photograph, sepia toned, formal Victorian studio lighting' "
    "or 'neon-lit cyberpunk portrait, rain streaks, chromatic aberration, moody'.\n"
    "- image_style_prompt_building: Style for architecture images. Describe photography style, "
    "weather, atmosphere. E.g. 'brutalist photography, overcast concrete, stark monochrome' "
    "or 'fantasy illustration, overgrown with vines, golden hour warm light'.\n"
    "- image_style_prompt_banner: Style for the world's establishing shot (16:9 cinematic). "
    "Describe the epic landscape style. E.g. 'matte painting, volumetric god rays, mythic scale' "
    "or 'drone photography, fog rolling through valley, cinematic color grade'.\n"
    "- image_style_prompt_lore: Style for narrative/story illustrations. Describe illustration "
    "technique. E.g. 'etching, cross-hatched, parchment texture, archival' or "
    "'concept art, moody environmental, desaturated palette'.\n"
    "These prompts should be consistent with the color palette and mood you designed above. "
    "They should evoke the same world.\n\n"
    "- Create something UNIQUE. Do not copy existing presets. Be bold and distinctive.\n"
    "- The theme should feel like it belongs to this specific world and no other."
)


class ForgeThemeService:
    """Generates and applies AI-created visual themes for simulations."""

    @staticmethod
    async def generate_theme(
        seed: str,
        anchor: dict[str, Any],
        geography: dict[str, Any],
        openrouter_key: str | None = None,
    ) -> dict[str, Any]:
        """Generate a complete theme via AI based on the simulation's identity.

        Returns the theme as a dict matching ForgeThemeOutput fields.
        """
        logger.info("Generating theme for seed: %s", seed[:60])

        prompt = (
            f"Design a unique visual theme for this simulation world:\n\n"
            f"SEED: {seed}\n\n"
            f"PHILOSOPHICAL ANCHOR:\n"
            f"  Title: {anchor.get('title', 'Unknown')}\n"
            f"  Core Question: {anchor.get('core_question', '')}\n"
            f"  Description: {anchor.get('description', '')}\n"
            f"  Literary Influence: {anchor.get('literary_influence', '')}\n\n"
            f"GEOGRAPHY:\n"
            f"  City: {geography.get('city_name', 'Unnamed')}\n"
            f"  Zones: {', '.join(z.get('name', '') for z in geography.get('zones', []))}\n\n"
            f"Create a visual identity that captures this world's essence. "
            f"Consider: Is this world dark or light? Industrial or organic? "
            f"Ancient or futuristic? Warm or cold? Chaotic or ordered?"
        )

        agent = Agent(
            get_openrouter_model(openrouter_key, model_id=get_platform_model("forge")),
            system_prompt=THEME_ARCHITECT_PROMPT,
            retries=3,
        )

        result = await run_ai(agent, prompt, "theme", output_type=ForgeThemeOutput)
        theme_data = result.output.model_dump()

        logger.info(
            "Theme generated: primary=%s, shadow=%s, texture=%s",
            theme_data.get("color_primary"),
            theme_data.get("shadow_style"),
            theme_data.get("card_frame_texture"),
        )

        return theme_data

    @staticmethod
    async def apply_theme_settings(
        supabase: Client,
        simulation_id: UUID,
        theme_data: dict[str, Any],
    ) -> None:
        """Write theme_config to simulation_settings as category='design' rows.

        Uses upsert to handle both fresh inserts and updates.
        """
        if not theme_data:
            logger.warning("No theme data to apply for simulation %s", simulation_id)
            return

        # Style prompt keys go to category='ai', everything else to category='design'
        ai_keys = {
            "image_style_prompt_portrait",
            "image_style_prompt_building",
            "image_style_prompt_banner",
            "image_style_prompt_lore",
        }

        rows = [
            {
                "simulation_id": str(simulation_id),
                "setting_key": key,
                "setting_value": value,
                "category": "ai" if key in ai_keys else "design",
            }
            for key, value in theme_data.items()
            if value is not None
        ]

        if not rows:
            return

        logger.info("Applying %d theme settings for simulation %s", len(rows), simulation_id)

        await (
            supabase.table("simulation_settings")
            .upsert(
                rows,
                on_conflict="simulation_id,category,setting_key",
            )
            .execute()
        )

        logger.info("Theme settings applied for simulation %s", simulation_id)

    @staticmethod
    async def refine_style_prompts(
        supabase: Client,
        simulation_id: UUID,
        openrouter_key: str | None = None,
    ) -> None:
        """Refine image style prompts using the simulation's lore as context.

        Called after lore generation (Phase A) and before image generation
        (Phase B). Reads the current style prompts and lore, then asks the
        AI to produce more distinctive, world-specific style prompts that
        capture the simulation's unique atmosphere.
        """
        # Load simulation + lore context
        sim_resp = await (
            supabase.table("simulations").select("name, description").eq("id", str(simulation_id)).single().execute()
        )
        sim = sim_resp.data or {}

        lore_resp = await (
            supabase.table("simulation_lore")
            .select("title, chapter, epigraph, body")
            .eq("simulation_id", str(simulation_id))
            .order("sort_order")
            .limit(5)
            .execute()
        )
        lore_sections = extract_list(lore_resp)
        if not lore_sections:
            logger.debug("No lore found for style refinement, skipping")
            return

        # Load current style prompts
        style_resp = await (
            supabase.table("simulation_settings")
            .select("setting_key, setting_value")
            .eq("simulation_id", str(simulation_id))
            .eq("category", "ai")
            .execute()
        )
        current_styles = {r["setting_key"]: r["setting_value"] for r in extract_list(style_resp)}
        if not current_styles.get("image_style_prompt_portrait"):
            return

        # Build lore digest for context
        lore_digest = "\n".join(
            f"- {s['title']}: {(s.get('epigraph') or '')[:100]} {(s.get('body') or '')[:200]}" for s in lore_sections
        )

        prompt = (
            f'You are refining image style prompts for the world "{sim.get("name", "?")}".\n\n'
            f"WORLD DESCRIPTION: {sim.get('description', '')}\n\n"
            f"LORE EXCERPTS (these define the world's unique atmosphere):\n{lore_digest}\n\n"
            f"CURRENT STYLE PROMPTS (too generic — need to be more distinctive):\n"
            f"- Portrait: {current_styles.get('image_style_prompt_portrait', '')}\n"
            f"- Building: {current_styles.get('image_style_prompt_building', '')}\n"
            f"- Lore: {current_styles.get('image_style_prompt_lore', '')}\n\n"
            f"TASK: Rewrite these 3 style prompts to be MUCH more distinctive and specific "
            f"to this world's unique identity. The prompts are appended to AI image generation "
            f"requests (Replicate Flux). They should:\n"
            f"- Evoke a specific visual medium or technique (NOT generic photography)\n"
            f"- Reference unique elements from the lore (materials, lighting, textures)\n"
            f"- Create a visual language that could ONLY belong to this world\n"
            f"- Be technically precise (describe lens, lighting, medium, color grading)\n\n"
            f"Respond with ONLY the three prompts, one per line, in this format:\n"
            f"PORTRAIT: [prompt]\n"
            f"BUILDING: [prompt]\n"
            f"LORE: [prompt]"
        )

        try:
            model = get_openrouter_model(openrouter_key, model_id=get_platform_model("forge"))
            agent = Agent(model, system_prompt="You are a visual style director. Be specific, bold, distinctive.")
            result = await run_ai(agent, prompt, "style_refine")

            # Parse response
            text = result.output if isinstance(result.output, str) else str(result.output)
            updates: dict[str, str] = {}
            for line in text.strip().split("\n"):
                line = line.strip()
                if line.upper().startswith("PORTRAIT:"):
                    updates["image_style_prompt_portrait"] = line.split(":", 1)[1].strip().strip('"')
                elif line.upper().startswith("BUILDING:"):
                    updates["image_style_prompt_building"] = line.split(":", 1)[1].strip().strip('"')
                elif line.upper().startswith("LORE:"):
                    updates["image_style_prompt_lore"] = line.split(":", 1)[1].strip().strip('"')

            if not updates:
                logger.warning("Style refinement produced no parseable output")
                return

            # Update settings
            rows = [
                {
                    "simulation_id": str(simulation_id),
                    "setting_key": key,
                    "setting_value": value,
                    "category": "ai",
                }
                for key, value in updates.items()
                if value and len(value) > 20  # Reject too-short prompts
            ]
            if rows:
                await (
                    supabase.table("simulation_settings")
                    .upsert(
                        rows,
                        on_conflict="simulation_id,category,setting_key",
                    )
                    .execute()
                )
                logger.info(
                    "Style prompts refined using lore context",
                    extra={
                        "simulation_id": str(simulation_id),
                        "updated_keys": list(updates.keys()),
                    },
                )

        except (httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
            logger.warning("Style prompt refinement AI call failed", exc_info=True)
            sentry_sdk.capture_exception(exc)

    @staticmethod
    async def generate_simulation_templates(
        supabase: Client,
        simulation_id: UUID,
        openrouter_key: str | None = None,
    ) -> None:
        """Generate world-specific prompt templates using lore context.

        Creates simulation-scoped prompt_templates rows for portrait_description,
        building_image_description, chronicle_generation, and chat_system_prompt.
        These override the generic platform defaults with world-specific voice,
        visual language, and narrative conventions drawn from the simulation's lore.
        """
        import json as _json

        # Load simulation + lore context
        sim_resp = await (
            supabase.table("simulations").select("name, description").eq("id", str(simulation_id)).single().execute()
        )
        sim = sim_resp.data or {}
        sim_name = sim.get("name", "Unknown")

        lore_resp = await (
            supabase.table("simulation_lore")
            .select("title, chapter, epigraph, body")
            .eq("simulation_id", str(simulation_id))
            .order("sort_order")
            .limit(5)
            .execute()
        )
        lore_sections = extract_list(lore_resp)
        if not lore_sections:
            logger.debug("No lore for template generation, skipping")
            return

        # Load current style prompts for visual consistency
        style_resp = await (
            supabase.table("simulation_settings")
            .select("setting_key, setting_value")
            .eq("simulation_id", str(simulation_id))
            .eq("category", "ai")
            .execute()
        )
        styles = {r["setting_key"]: r["setting_value"] for r in extract_list(style_resp)}

        lore_digest = "\n".join(
            f"- {s['title']}: {(s.get('epigraph') or '')[:80]} {(s.get('body') or '')[:150]}" for s in lore_sections
        )

        prompt = (
            f'You are creating world-specific AI prompt templates for "{sim_name}".\n\n'
            f"WORLD: {sim.get('description', '')}\n\n"
            f"LORE EXCERPTS:\n{lore_digest}\n\n"
            f"VISUAL STYLE: {styles.get('image_style_prompt_portrait', 'not set')}\n\n"
            f"Generate 4 prompt templates that capture this world's UNIQUE voice, "
            f"visual language, and narrative conventions. Each template must be deeply "
            f"specific to this world — referencing its materials, aesthetics, social "
            f"structures, and atmospheric qualities from the lore.\n\n"
            f"Return valid JSON with exactly these 4 keys:\n"
            f"{{\n"
            f'  "portrait_description": {{\n'
            f'    "system_prompt": "You are a [world-specific] portrait specialist...",\n'
            f'    "prompt_content": "Describe a portrait of {{agent_name}}..."\n'
            f"  }},\n"
            f'  "building_image_description": {{\n'
            f'    "system_prompt": "You are a [world-specific] architectural photographer...",\n'
            f'    "prompt_content": "Describe an image of {{building_name}}..."\n'
            f"  }},\n"
            f'  "chronicle_generation": {{\n'
            f'    "system_prompt": "You are the editor of {sim_name}\'s chronicle...",\n'
            f'    "prompt_content": "Write edition #{{edition_number}}..."\n'
            f"  }},\n"
            f'  "chat_system_prompt": {{\n'
            f'    "system_prompt": "You roleplay characters from {sim_name}...",\n'
            f'    "prompt_content": "You are {{agent_name}}..."\n'
            f"  }}\n"
            f"}}\n\n"
            f"RULES:\n"
            f"- system_prompt: Sets the AI's persona (2-4 sentences, world-specific)\n"
            f"- prompt_content: The user-facing template with {{variable}} placeholders\n"
            f"- portrait_description MUST reference the visual style above\n"
            f"- chronicle MUST capture the world's media/propaganda voice from lore\n"
            f"- chat MUST establish how characters from this world speak and think\n"
            f"- Be BOLD and SPECIFIC — generic templates are useless\n"
            f"- Use template variables: {{agent_name}}, {{agent_character}}, "
            f"{{agent_background}}, {{building_name}}, {{building_type}}, "
            f"{{building_condition}}, {{building_description}}, {{zone_name}}, "
            f"{{simulation_name}}, {{edition_number}}, {{period_start}}, {{period_end}}, "
            f"{{event_summary}}, {{echo_summary}}, {{battle_summary}}, {{reaction_summary}}"
        )

        try:
            model = get_openrouter_model(openrouter_key, model_id=get_platform_model("forge"))
            agent = Agent(
                model,
                system_prompt=(
                    "You are a worldbuilding narrative architect. Generate prompt templates "
                    "as valid JSON. Each template must be deeply specific to the world's "
                    "identity — never generic. Return ONLY the JSON object, no markdown."
                ),
                retries=3,
            )
            result = await run_ai(agent, prompt, "templates")
            text = result.output if isinstance(result.output, str) else str(result.output)

            # Strip markdown code fences if present
            text = text.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()

            templates = _json.loads(text)
            if not isinstance(templates, dict):
                logger.warning("Template generation returned non-dict")
                return

            # Template type → column mappings
            template_meta = {
                "portrait_description": {
                    "prompt_category": "image",
                    "template_name": f"{sim_name} Portrait Description",
                    "temperature": 0.8,
                    "max_tokens": 300,
                },
                "building_image_description": {
                    "prompt_category": "image",
                    "template_name": f"{sim_name} Building Image Description",
                    "temperature": 0.8,
                    "max_tokens": 300,
                },
                "chronicle_generation": {
                    "prompt_category": "generation",
                    "template_name": f"{sim_name} Chronicle",
                    "temperature": 0.9,
                    "max_tokens": 2000,
                },
                "chat_system_prompt": {
                    "prompt_category": "chat",
                    "template_name": f"{sim_name} Chat System Prompt",
                    "temperature": 0.85,
                    "max_tokens": 500,
                },
            }

            rows = []
            for ttype, tdata in templates.items():
                if ttype not in template_meta:
                    continue
                if not isinstance(tdata, dict):
                    continue
                meta = template_meta[ttype]
                rows.append(
                    {
                        "simulation_id": str(simulation_id),
                        "template_type": ttype,
                        "prompt_category": meta["prompt_category"],
                        "locale": "en",
                        "template_name": meta["template_name"],
                        "prompt_content": tdata.get("prompt_content", ""),
                        "system_prompt": tdata.get("system_prompt", ""),
                        "variables": _json.dumps([]),
                        "temperature": meta["temperature"],
                        "max_tokens": meta["max_tokens"],
                        "is_system_default": False,
                    }
                )

            if rows:
                # Delete existing templates for this simulation first
                # (partial unique index doesn't support standard upsert)
                for r in rows:
                    await (
                        supabase.table("prompt_templates")
                        .delete()
                        .eq(
                            "simulation_id",
                            str(simulation_id),
                        )
                        .eq("template_type", r["template_type"])
                        .eq(
                            "locale",
                            "en",
                        )
                        .execute()
                    )
                await supabase.table("prompt_templates").insert(rows).execute()
                logger.info(
                    "Generated %d world-specific prompt templates",
                    len(rows),
                    extra={
                        "simulation_id": str(simulation_id),
                        "template_types": [r["template_type"] for r in rows],
                    },
                )

        except (httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
            logger.warning("Prompt template generation failed", exc_info=True)
            sentry_sdk.capture_exception(exc)

    @staticmethod
    async def generate_variants(
        admin_supabase: Client,
        simulation_id: UUID,
        user_id: UUID,
        purchase_id: str,
    ) -> None:
        """Generate 3 theme variants for an existing simulation (Darkroom feature).

        Stores variants in the feature_purchases result field and marks complete.
        """
        structlog.contextvars.bind_contextvars(simulation_id=str(simulation_id))
        from backend.services.forge_feature_service import ForgeFeatureService

        try:
            # Fetch simulation data for context
            sim_resp = (
                await admin_supabase.table("simulations")
                .select("name, description")
                .eq("id", str(simulation_id))
                .single()
                .execute()
            )
            sim = sim_resp.data

            # Fetch current theme settings
            settings_resp = (
                await admin_supabase.table("simulation_settings")
                .select("setting_key, setting_value")
                .eq("simulation_id", str(simulation_id))
                .eq("category", "design")
                .execute()
            )
            current_theme = {s["setting_key"]: s["setting_value"] for s in (extract_list(settings_resp))}

            # Get user BYOK key
            from backend.utils.encryption import decrypt

            wallet_resp = (
                await admin_supabase.table("user_wallets")
                .select("encrypted_openrouter_key")
                .eq("user_id", str(user_id))
                .maybe_single()
                .execute()
            )
            or_key = None
            if wallet_resp.data and wallet_resp.data.get("encrypted_openrouter_key"):
                or_key = decrypt(wallet_resp.data["encrypted_openrouter_key"])

            variants = []
            if settings.forge_mock_mode:
                for i in range(3):
                    variants.append(
                        {
                            "variant_name": f"Variant {i + 1}",
                            "color_primary": ["#e74c3c", "#3498db", "#2ecc71"][i],
                            "color_background": ["#1a0a0a", "#0a0a1a", "#0a1a0a"][i],
                            "color_surface": ["#1f1111", "#11111f", "#111f11"][i],
                            "color_text": "#e5e5e5",
                            "font_heading": ["Playfair Display", "JetBrains Mono", "Crimson Text"][i],
                            "shadow_style": ["blur", "glow", "offset"][i],
                            "card_frame_texture": ["scanlines", "circuits", "filigree"][i],
                        }
                    )
            else:
                model = get_openrouter_model(or_key, model_id=get_platform_model("forge"))

                for i in range(3):
                    variant_prompt = f"""Generate a COMPLETELY DIFFERENT visual theme variant (#{i + 1}/3)
for the world "{sim["name"]}": {sim.get("description", "")}

Current theme uses: primary={current_theme.get("color_primary", "?")},
background={current_theme.get("color_background", "?")},
font={current_theme.get("font_heading", "?")}

{"Previous variant used: " + variants[-1].get("color_primary", "") if variants else ""}

Create a dramatically different interpretation. Different color palette, different mood,
different typography. Same world, radically different visual identity."""

                    agent = Agent(model, system_prompt=THEME_ARCHITECT_PROMPT)
                    result = await run_ai(agent, variant_prompt, "theme", output_type=ForgeThemeOutput)
                    variant_data = result.output.model_dump()
                    variant_data["variant_name"] = f"Variant {i + 1}"
                    variants.append(variant_data)

            # Store variants in purchase result and mark completed
            await ForgeFeatureService.complete_feature(
                admin_supabase,
                purchase_id,
                result={"variants": variants, "current_theme": current_theme},
            )
            logger.info(
                "Darkroom variants generated",
                extra={"simulation_id": str(simulation_id), "count": len(variants)},
            )

        except (httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
            sentry_sdk.capture_exception(exc)
            logger.exception("Darkroom variant generation failed")
            await ForgeFeatureService.fail_feature(
                admin_supabase,
                purchase_id,
                str(exc),
            )
