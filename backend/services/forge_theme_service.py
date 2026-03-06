"""Service for AI-generated simulation themes."""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from pydantic_ai import Agent

from backend.models.forge import ForgeThemeOutput
from backend.services.ai_utils import get_openrouter_model
from supabase import Client

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
            get_openrouter_model(openrouter_key),
            system_prompt=THEME_ARCHITECT_PROMPT,
        )

        result = await agent.run(prompt, output_type=ForgeThemeOutput)
        theme_data = result.output.model_dump()

        logger.info("Theme generated: primary=%s, shadow=%s, texture=%s",
                     theme_data.get("color_primary"),
                     theme_data.get("shadow_style"),
                     theme_data.get("card_frame_texture"))

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

        supabase.table("simulation_settings").upsert(
            rows,
            on_conflict="simulation_id,category,setting_key",
        ).execute()

        logger.info("Theme settings applied for simulation %s", simulation_id)
