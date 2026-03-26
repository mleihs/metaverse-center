"""Service for AI-generated ASCII art terminal boot sequences.

Generates a hybrid boot art: pyfiglet title banner (reliable) + AI-generated
thematic scene illustration (creative). Stored in simulation_settings as
category='design', key='terminal_boot_art'.

Architecture: follows forge_lore_service.py pattern (static methods,
create_forge_agent, run_ai, centralized error handling).
"""

from __future__ import annotations

import logging
from typing import Any

import pyfiglet

from backend.services.ai_utils import create_forge_agent, run_ai

logger = logging.getLogger(__name__)

# ── Constants ────────────────────────────────────────────────────────────────

MAX_ART_WIDTH = 60
MAX_ART_LINES = 20
MAX_SCENE_LINES = 12

# ── System Prompt ────────────────────────────────────────────────────────────

ASCII_ARTIST_PROMPT = (
    "You are an ASCII artist creating monospace terminal art for the "
    "Bureau of Impossible Geography. You produce atmospheric SCENES using "
    "ONLY printable ASCII characters (codes 32-126).\n\n"
    "STRICT RULES:\n"
    "- Maximum width: {width} characters per line\n"
    "- Maximum height: {height} lines\n"
    "- Use these characters: / \\ | _ - = + * . : ; ' \" ~ ^ # @ % & ( ) [ ] < >\n"
    "- NO Unicode, NO emoji, NO tabs, NO control characters\n"
    "- Pad every line with trailing spaces to EXACTLY {width} characters\n"
    "- Create a SCENE or SYMBOL, not text banners or lettering\n"
    "- Draw landscapes, cityscapes, architecture, machines, symbols, or abstract patterns\n"
    "- The art should evoke the world's atmosphere: its materials, weather, architecture\n"
    "- Output ONLY the ASCII art lines. No explanation, no markdown, no code fences\n"
    "- Each line must be EXACTLY {width} characters wide (pad with spaces if needed)\n"
)

# ── Preferred figlet fonts (tried in order, first that fits wins) ────────────

PREFERRED_FONTS = ["small", "standard", "mini", "digital"]


# ── Service ──────────────────────────────────────────────────────────────────


class ForgeAsciiArtService:
    """Generates terminal boot art for simulation boot sequences."""

    @staticmethod
    def generate_figlet_title(
        name: str,
        max_width: int = MAX_ART_WIDTH,
    ) -> str:
        """Generate a FIGlet title banner that fits within max_width.

        Tries preferred fonts in order, returns the first that fits.
        Falls back to plain centered uppercase text.
        """
        for font_name in PREFERRED_FONTS:
            try:
                fig = pyfiglet.Figlet(font=font_name, width=max_width)
                rendered = fig.renderText(name).rstrip("\n")
                lines = rendered.split("\n")
                if all(len(line) <= max_width for line in lines) and len(lines) <= 8:
                    return rendered
            except pyfiglet.FontNotFound:
                continue
        # Absolute fallback: plain centered text
        return name.upper().center(max_width)

    @staticmethod
    def validate_ascii_art(
        art: str,
        max_width: int = MAX_ART_WIDTH,
        max_lines: int = MAX_ART_LINES,
    ) -> tuple[bool, str]:
        """Validate ASCII art meets terminal constraints.

        Returns (is_valid, reason).
        """
        if not art or not art.strip():
            return False, "Art is empty"

        lines = art.split("\n")
        if len(lines) > max_lines:
            return False, f"Too many lines: {len(lines)} > {max_lines}"

        non_whitespace = sum(1 for line in lines if line.strip())
        if non_whitespace < 3:
            return False, "Art is essentially empty (fewer than 3 non-blank lines)"

        for i, line in enumerate(lines):
            if len(line) > max_width:
                return False, f"Line {i + 1} too wide: {len(line)} > {max_width}"
            for ch in line:
                if ord(ch) > 126 or (ord(ch) < 32 and ch != "\n"):
                    return False, f"Line {i + 1} contains non-ASCII character: U+{ord(ch):04X}"

        return True, "OK"

    @staticmethod
    async def generate_scene(
        seed: str,
        simulation_name: str,
        anchor: dict[str, Any],
        geography: dict[str, Any],
        theme_data: dict[str, Any],
        openrouter_key: str | None = None,
        *,
        max_width: int = MAX_ART_WIDTH,
        max_height: int = MAX_SCENE_LINES,
    ) -> str | None:
        """Generate an AI-created ASCII art scene for the simulation.

        Returns the scene string or None if generation/validation fails.
        Retries once with a stricter prompt on validation failure.
        """
        system = ASCII_ARTIST_PROMPT.format(width=max_width, height=max_height)
        agent = create_forge_agent(system, api_key=openrouter_key, purpose="ascii_art")

        # Build context from simulation data
        anchor_title = anchor.get("title", seed)
        anchor_desc = anchor.get("description", "")
        city_name = ""
        zone_names: list[str] = []
        if geography:
            cities = geography.get("cities", [])
            if cities:
                city_name = cities[0].get("name", "")
                zones = cities[0].get("zones", [])
                zone_names = [z.get("name", "") for z in zones[:5]]

        mood = theme_data.get("shadow_style", "")
        texture = theme_data.get("card_frame_texture", "")

        prompt = (
            f"Create ASCII art ({max_height} lines, {max_width} chars wide) for:\n"
            f"World: {simulation_name}\n"
            f"Theme: {anchor_title}\n"
            f"Description: {anchor_desc[:200]}\n"
            f"City: {city_name}\n"
            f"Zones: {', '.join(zone_names)}\n"
            f"Mood: {mood}\n"
            f"Texture: {texture}\n\n"
            f"Draw a scene that captures this world's atmosphere. "
            f"Think: what would a field operative see on their terminal screen "
            f"when connecting to this sector? Architecture, landscape, symbols. "
            f"Every line must be EXACTLY {max_width} characters."
        )

        for attempt in range(2):
            try:
                result = await run_ai(agent, prompt, "ascii_art", output_type=str)
                scene = result.output if hasattr(result, "output") else str(result.data)

                # Clean: strip markdown code fences if AI wrapped it
                scene = scene.strip()
                if scene.startswith("```"):
                    lines = scene.split("\n")
                    lines = [ln for ln in lines if not ln.startswith("```")]
                    scene = "\n".join(lines)

                # Truncate lines to max_width (LLMs often overshoot)
                cleaned_lines = []
                for line in scene.split("\n")[:max_height]:
                    cleaned_lines.append(line[:max_width].ljust(max_width))
                scene = "\n".join(cleaned_lines)

                valid, reason = ForgeAsciiArtService.validate_ascii_art(
                    scene, max_width, max_height,
                )
                if valid:
                    return scene

                logger.warning(
                    "ASCII art validation failed (attempt %d): %s",
                    attempt + 1,
                    reason,
                )
                # Retry with stricter instructions
                prompt = (
                    f"RETRY: Your previous attempt was invalid ({reason}).\n"
                    f"Generate EXACTLY {max_height} lines of EXACTLY {max_width} characters each.\n"
                    f"Use ONLY ASCII printable characters (space through ~).\n"
                    f"World: {simulation_name} - {anchor_title}\n"
                    f"Draw a simple atmospheric scene. Pad all lines with spaces to {max_width} chars."
                )
            except Exception:
                logger.warning(
                    "ASCII art generation failed (attempt %d)",
                    attempt + 1,
                    exc_info=True,
                )
                break

        return None

    @staticmethod
    async def generate_boot_art(
        seed: str,
        anchor: dict[str, Any],
        geography: dict[str, Any],
        simulation_name: str,
        theme_data: dict[str, Any],
        openrouter_key: str | None = None,
    ) -> str:
        """Generate complete terminal boot art: figlet title + AI scene.

        Always returns a valid string (figlet title as minimum guarantee).
        """
        # Step 1: Generate reliable figlet title
        title = ForgeAsciiArtService.generate_figlet_title(simulation_name)

        # Step 2: Attempt AI scene generation
        scene = await ForgeAsciiArtService.generate_scene(
            seed=seed,
            simulation_name=simulation_name,
            anchor=anchor,
            geography=geography,
            theme_data=theme_data,
            openrouter_key=openrouter_key,
        )

        # Step 3: Combine
        if scene:
            combined = f"{scene}\n\n{title}"
        else:
            combined = title

        # Final validation
        valid, reason = ForgeAsciiArtService.validate_ascii_art(combined)
        if not valid:
            logger.warning("Combined boot art validation failed: %s — using title only", reason)
            return title

        return combined
