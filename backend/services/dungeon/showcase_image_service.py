"""Dungeon Showcase — Background image generation per archetype.

Each archetype uses a specific AI image model and an art-historically
informed prompt refined through deep research into each model's prompt
engineering best practices. See:
  - docs/research/dungeon-visual-art-direction-research.md (art direction)
  - docs/research/ai-image-prompt-engineering-research.md (prompt engineering)

Multi-model strategy (quality-first, cost is secondary):
  Shadow     → FLUX.2 Max  (darkness is hardest to get right)
  Tower      → FLUX.2 Max  (intentional geometric impossibility needs consistency)
  Mother     → FLUX.2 Max  (organic material precision, subsurface scattering)
  Entropy    → FLUX.2 Max  (mixed media texture, dual pristine/decayed)
  Prometheus → FLUX.2 Max  (single-source chiaroscuro, forge material physics)
  Deluge     → Gemini 3 Pro (water refraction physics reasoning)
  Awakening  → GPT-5 Image (abstract/conceptual, metaphysical composition)
  Overthrow  → GPT-5 Image (text rendering, political signage, distorted portraiture)

Prompt rules (from research):
  FLUX.2: Subject first. 50-80 words. NO quality tags. NO "in the style of X"
          → describe TECHNIQUE instead. HEX colors with object association.
          Hard shadows, not soft. Describe light geometry, not effects.
  GPT-5:  Specific painting names >> artist names. 50-80 word structured prompts.
          Frame political content as art-historical reference.
  Gemini:  Natural language. Physics descriptions. No keyword soup.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from backend.services.external.openrouter import OpenRouterService
from backend.utils.image import AVIF_QUALITY, convert_to_avif
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ArchetypeVisual:
    """Image generation config for a single archetype."""

    archetype_id: str
    model: str
    aspect_ratio: str
    image_size: str
    prompt: str


# ── Art direction per archetype ──────────────────────────────────────────────
#
# Prompt construction follows verified research:
# - FLUX.2: Subject → Action → Style → Context. Word order = priority.
#   Technique descriptions over artist names. HEX with object association.
# - GPT-5: Background/Scene → Subject → Key Details → Constraints.
#   Specific painting titles outperform artist names.
# - Gemini: Natural language, physics-first descriptions.

ARCHETYPE_VISUALS: dict[str, ArchetypeVisual] = {
    "shadow": ArchetypeVisual(
        archetype_id="shadow",
        model="black-forest-labs/flux.2-max",
        aspect_ratio="16:9",
        image_size="2K",
        prompt=(
            "Vast subterranean void, single burning brazier casting hard directional "
            "amber light across rough obsidian walls. Tenebristic oil painting with "
            "thick impasto brushstrokes, visible canvas texture. Dramatic chiaroscuro, "
            "crushed black shadows dominating the composition. Twisted organic columns "
            "recede into stygian darkness beyond the light's reach. Pools of black "
            "water on stone floor reflect nothing. Color #E8A020 for flame, "
            "color #0A0414 for deepest void. Empty deserted chamber. "
            "Hard shadows, zero ambient fill, 1:20 contrast ratio."
        ),
    ),
    "tower": ArchetypeVisual(
        archetype_id="tower",
        model="black-forest-labs/flux.2-max",
        aspect_ratio="16:9",
        image_size="2K",
        prompt=(
            "Infinite recursive interior of impossible architecture, extreme vertical "
            "perspective looking upward through massive stone arches and staircases "
            "that lead both up and down simultaneously. Etching and conte crayon "
            "rendering style with deep cross-hatched shadows. Bridges span impossible "
            "chasms between brutalist concrete columns. Angles subtly wrong — load-bearing "
            "walls lean imperceptibly. Thin vertical lines of pale data stream down walls. "
            "Color #4A8AB5 for steel-blue highlights, color #0A1218 for deep shadow. "
            "Institutional not gothic, functioning not ruined. Hard directional light "
            "from unseen source. Deserted, no figures."
        ),
    ),
    "mother": ArchetypeVisual(
        archetype_id="mother",
        model="black-forest-labs/flux.2-max",
        aspect_ratio="16:9",
        image_size="2K",
        prompt=(
            "Corridor of living tissue, translucent membranes pulsing with warm inner "
            "radiance. Precise biological illustration with Art Nouveau decorative "
            "sensibility, wet organic surfaces catching light. Bioluminescent nodules "
            "emit soft amber glow, color #FF8C00. Visible veins carry luminescent "
            "fluid through membrane walls, subsurface scattering reveals internal "
            "structures. Tendrils and botanical nodules grow from ceiling with "
            "scientific precision. Warm humid atmosphere, color #021210 for deep "
            "background. Watercolor-meets-oil texture. The space is welcoming, "
            "not threatening — a womb, not a machine."
        ),
    ),
    "entropy": ArchetypeVisual(
        archetype_id="entropy",
        model="black-forest-labs/flux.2-max",
        aspect_ratio="16:9",
        image_size="2K",
        prompt=(
            "Grand hall dissolving into sameness, thick impasto surface with heavy "
            "palette knife marks and embedded geological texture. Marble columns "
            "gradually losing definition, surfaces smoothing into undifferentiated "
            "grey. One side partially intact chandelier, other side same chandelier "
            "reduced to vague form. Golden light filtering through shattered skylights "
            "illuminates suspended dust frozen in still air. Patina of decades on "
            "every surface. Mixed media — scorched earth pigment, lead grey, cracked "
            "lacquer. Color #CC7722 for ochre warmth, color #8B7355 for weathered "
            "stone, color #4A3728 for rust. Nature reclaiming, melancholy beauty. "
            "Not destruction — equalization."
        ),
    ),
    "prometheus": ArchetypeVisual(
        archetype_id="prometheus",
        model="black-forest-labs/flux.2-max",
        aspect_ratio="16:9",
        image_size="2K",
        prompt=(
            "Vast alchemist workshop carved into volcanic rock, single forge fire as "
            "sole light source. Tenebristic oil painting, warm golden undertones, "
            "dramatic candlelight composition where darkness dominates. Incandescent "
            "molten metal in crucible, color #FFD700 at center, color #FF6B00 at "
            "edges. Crystalline components and half-finished constructs on obsidian "
            "workbenches. Sparks frozen mid-flight. Thick oil paint brushstrokes, "
            "visible canvas grain. Color temperature 3200K warmth. Smoke hangs in "
            "visible layers. Zero ambient fill, hard shadows. Deep volcanic black "
            "background, color #1A0800. Tools arranged with loving precision — "
            "this is craft, not magic."
        ),
    ),
    "deluge": ArchetypeVisual(
        archetype_id="deluge",
        model="google/gemini-3-pro-image-preview",
        aspect_ratio="16:9",
        image_size="2K",
        prompt=(
            "A drowned civilization seen from the waterline, the composition split "
            "horizontally where water meets air. Above the surface: storm clouds and "
            "desperate amber emergency lighting reflecting on dark water. Below the "
            "surface: haunting subaquatic beauty — marble Art Deco columns and "
            "shattered domes submerged in clear jade-green water. Caustic light "
            "patterns ripple across submerged walls where waves concentrate and "
            "focus light into bright lines. Light passes through translucent wave "
            "crests. Air bubbles stream upward. Kelp trails from ornate cornices. "
            "Painterly atmospheric brushwork above water, photographic clarity "
            "with accurate water refraction below. The water is beautiful even as "
            "it drowns the world. Deep teal and jade-grey palette with storm amber."
        ),
    ),
    "awakening": ArchetypeVisual(
        archetype_id="awakening",
        model="openai/gpt-5-image",
        aspect_ratio="16:9",
        image_size="2K",
        prompt=(
            "A surreal liminal interior reminiscent of de Chirico's 'Mystery and "
            "Melancholy of a Street' — elongated impossible shadows cast by unseen "
            "objects, empty arcaded architecture with conflicting vanishing points. "
            "The space is simultaneously a library, a desert plain, and a neuronal "
            "network. Recursive doorways recede into distance, each subtly different "
            "like the same memory recalled imperfectly. The light has no source — "
            "the space itself is luminous, as in Magritte's 'Empire of Light' where "
            "a nighttime street exists under a bright daylit sky. Translucent "
            "geometric solids float at mid-height like crystallized thoughts. "
            "Ethereal lavender and deep midnight blue palette with silver-white "
            "accents. Hypnagogic — the moment between sleep and waking. "
            "Calm. Familiar but wrong. Rendered in layered oil glazes."
        ),
    ),
    "overthrow": ArchetypeVisual(
        archetype_id="overthrow",
        model="openai/gpt-5-image",
        aspect_ratio="16:9",
        image_size="2K",
        prompt=(
            "A monumental mirror palace in mid-collapse, rendered as a 1920s Russian "
            "Constructivist composition crossed with thick expressionist oil painting. "
            "Grand hall where every mirror reflection shows a different version of "
            "the same throne room — some intact, some burning, some empty. Shattered "
            "thrones and toppled statues of forgotten leaders. Torn crimson banners "
            "hang from vaulted ceiling lost in smoke. Official documents scatter "
            "through air. Bold geometric typography partially visible on walls — "
            "weathered posters with fragments torn away, overlapping proclamations. "
            "Diagonal composition at 30 degrees. Lightning through broken stained "
            "glass casts fractured colored light. Blood red, storm grey, bruised "
            "gold, deep shadow black. Aggressive thick brushwork. Political vertigo."
        ),
    ),
    # ── Detail page variants ────────────────────────────────────────────────
    #
    # Additional images for archetype detail pages (/archetypes/:id).
    # Named {archetype}-{variant} to distinguish from the hero image.
    "overthrow-depth": ArchetypeVisual(
        archetype_id="overthrow-depth",
        model="openai/gpt-5-image",
        aspect_ratio="16:9",
        image_size="2K",
        prompt=(
            "A narrow corridor deep inside a mirror palace, reminiscent of "
            "El Lissitzky's 'Beat the Whites with the Red Wedge' but rendered "
            "as claustrophobic architecture. Opposing mirrors create infinite "
            "recursion — each reflection wearing different political insignia. "
            "Torn propaganda posters layer upon each other on stone walls, "
            "contradictory decrees in Gothic and Cyrillic script, partially "
            "redacted. A single chair sits beneath a bare bulb — Koestler's "
            "interrogation chamber. Cracked marble floor reflects crimson "
            "overhead light. Paranoid atmosphere. Color #d4364b for all red "
            "elements, deep charcoal blacks. Thick expressionist impasto, "
            "visible brushstrokes. Diagonal shadows at 45 degrees."
        ),
    ),
    "overthrow-whispers": ArchetypeVisual(
        archetype_id="overthrow-whispers",
        model="openai/gpt-5-image",
        aspect_ratio="16:9",
        image_size="2K",
        prompt=(
            "A long marble corridor in a mirror palace, painted in the style "
            "of Vilhelm Hammershøi — muted, desaturated, profoundly still. "
            "Identical doors on both sides, each slightly ajar. Official notices "
            "pinned to walls in neat rows, the text too small to read. A single "
            "figure at the far end, back turned, walking away. The mirrors reflect "
            "the corridor faithfully but one reflection shows a door that is "
            "closed in reality. Subdued color #d4364b only in the wax seal on "
            "one notice. Grey stone, cold daylight from unseen windows, dust "
            "in the air. Oil painting, restrained palette, quiet menace."
        ),
    ),
    "overthrow-revolution": ArchetypeVisual(
        archetype_id="overthrow-revolution",
        model="openai/gpt-5-image",
        aspect_ratio="16:9",
        image_size="2K",
        prompt=(
            "A grand assembly hall in ruins, painted in the violent style of "
            "Anselm Kiefer — scorched surfaces, layered materials, monumental "
            "scale. Faction banners torn and overlapping on the walls, three "
            "different insignia competing for the same space. An overturned "
            "podium. Scattered documents form a carpet on the floor. In the "
            "center, an empty chair — the seat of power, vacated mid-sentence. "
            "Smoke and red light #d4364b pouring through shattered windows. "
            "Charcoal and ash mixed into thick paint. The architecture crumbles "
            "but the propaganda remains intact. Heavy impasto, burnt umber, "
            "blood red, lead white. Political vertigo made landscape."
        ),
    ),
    "overthrow-boss": ArchetypeVisual(
        archetype_id="overthrow-boss",
        model="openai/gpt-5-image",
        aspect_ratio="16:9",
        image_size="2K",
        prompt=(
            "A throne room at the heart of a shattered mirror palace, "
            "inspired by Francis Bacon's 'Study after Velázquez's Portrait "
            "of Pope Innocent X' — a figure on a throne, distorted, screaming "
            "or smiling (impossible to tell), viewed through fractured glass. "
            "The throne is surrounded by broken mirrors that each reflect the "
            "same figure in a different state: one regal, one bestial, one "
            "serpentine. Milton's Satan in three phases. The floor is covered "
            "in scattered official seals and torn documents. Crimson light "
            "descends from a single point above — authoritarian spotlight. "
            "The mirrors multiply the figure into infinite pretenders. "
            "Blood red #d4364b, papal purple, bone white, void black. "
            "Expressionist oil paint, violent brushwork, Bacon's smeared flesh."
        ),
    ),
    # ── Entropy detail variants ────────────────────────────────────────────
    "entropy-depth": ArchetypeVisual(
        archetype_id="entropy-depth",
        model="black-forest-labs/flux.2-max",
        aspect_ratio="16:9",
        image_size="2K",
        prompt=(
            "Interior of a vast antiquarian library, shelves stretching into "
            "grey distance, painted in thick impasto oil with palette knife marks. "
            "Every object on every shelf approaches the same muted tone — books, "
            "instruments, globes, all weathered to uniform patina. Amber light "
            "from a cracked skylight casts a single warm shaft through suspended "
            "dust particles. Color #CC7722 for the last ochre warmth in the light "
            "beam, color #8B8B8B for the equalized surfaces surrounding it. "
            "Cracked lacquer, geological pigment texture, visible canvas weave. "
            "Profound stillness. Museum of forgotten distinctions."
        ),
    ),
    "entropy-whispers": ArchetypeVisual(
        archetype_id="entropy-whispers",
        model="black-forest-labs/flux.2-max",
        aspect_ratio="16:9",
        image_size="2K",
        prompt=(
            "Interior of a grand hall where all surfaces converge toward the "
            "same muted tone, painted in muted Hammershøi palette with heavy "
            "impasto texture. Identical archways recede into grey distance, each "
            "progressively less defined than the last. A single instrument panel "
            "on the wall, dials pointing to identical readings. Dust hangs "
            "motionless in shafts of amber light from unseen source. The floor "
            "is the same material as the walls. Color #8B7355 for weathered "
            "surfaces, color #4A3728 for remaining shadow. Everything approaches "
            "room temperature. Stillness as subject. Equalization as atmosphere."
        ),
    ),
    "entropy-revolution": ArchetypeVisual(
        archetype_id="entropy-revolution",
        model="black-forest-labs/flux.2-max",
        aspect_ratio="16:9",
        image_size="2K",
        prompt=(
            "A deep chamber where dissolution is advanced, thick mixed-media "
            "surface with embedded geological texture and cracked varnish. "
            "Shapes barely distinguishable from background — columns, arches, "
            "furniture all averaging into the same grey mass. A mirror on the "
            "wall reflects nothing distinct, its surface the same shade as the "
            "room. One last patch of color — amber ochre #CC7722 — clinging to "
            "a corner where a chandelier once hung. The rest is equalized: "
            "color #6B6B6B uniform, color #4A4A4A for what remains of shadow. "
            "Beckett's Lessness made architecture. Serene, terminal, beautiful."
        ),
    ),
    "entropy-boss": ArchetypeVisual(
        archetype_id="entropy-boss",
        model="black-forest-labs/flux.2-max",
        aspect_ratio="16:9",
        image_size="2K",
        prompt=(
            "A guardian figure whose armor has merged with the walls of a vast "
            "decaying hall, thick impasto oil painting with palette knife marks "
            "and embedded mineral pigment. The figure stands sentinel, arms "
            "raised in protection of an absence. Armor plates dissolve into "
            "stone, stone dissolves into floor, floor dissolves into shadow. "
            "The figure is indistinguishable from its post. Overhead, a crack "
            "admits a single shaft of dying amber light — color #CC7722. "
            "Everything else is the color of equalization: lead grey #7A7A7A, "
            "rust #4A3728, void #1A1A1A. Monumental. Empty. The last distinction."
        ),
    ),
}


async def generate_showcase_image(
    openrouter: OpenRouterService,
    archetype_id: str,
) -> bytes:
    """Generate a showcase background image for the given archetype.

    Uses the archetype's assigned model, prompt, and art direction.
    Returns raw image bytes (PNG/JPEG) ready for AVIF conversion.

    Raises:
        ValueError: If archetype_id is not recognized.
        OpenRouterError: On API failures.
    """
    visual = ARCHETYPE_VISUALS.get(archetype_id)
    if not visual:
        valid = ", ".join(sorted(ARCHETYPE_VISUALS))
        raise ValueError(f"Unknown archetype '{archetype_id}'. Valid: {valid}")

    logger.info(
        "Generating showcase image",
        extra={
            "archetype": archetype_id,
            "model": visual.model,
            "aspect": visual.aspect_ratio,
        },
    )

    image_bytes = await openrouter.generate_image(
        model=visual.model,
        prompt=visual.prompt,
        aspect_ratio=visual.aspect_ratio,
        image_size=visual.image_size,
    )

    logger.info(
        "Showcase image generated",
        extra={
            "archetype": archetype_id,
            "model": visual.model,
            "bytes": len(image_bytes),
            "usage": openrouter.last_usage,
        },
    )
    return image_bytes


async def generate_and_upload_showcase(
    admin_supabase: Client,
    archetype_id: str,
) -> dict:
    """Generate a showcase image, convert to AVIF, and upload to Storage.

    Full pipeline: AI generation → AVIF dual-resolution → Supabase Storage.
    Returns metadata dict with URLs, model info, and byte sizes.

    Raises:
        ValueError: If archetype_id is not recognized.
    """
    visual = ARCHETYPE_VISUALS[archetype_id]
    openrouter = OpenRouterService()
    raw_bytes = await generate_showcase_image(openrouter, archetype_id)

    # Convert to AVIF (full + display thumbnail at 1920px)
    full_avif = convert_to_avif(raw_bytes, max_dimension=None, quality=AVIF_QUALITY)
    thumb_avif = convert_to_avif(raw_bytes, max_dimension=1920, quality=AVIF_QUALITY)

    # Upload to simulation.assets/showcase/
    base_path = f"showcase/dungeon-{archetype_id}.avif"
    full_path = f"showcase/dungeon-{archetype_id}.full.avif"

    await admin_supabase.storage.from_("simulation.assets").upload(
        full_path, full_avif, {"content-type": "image/avif", "upsert": "true"},
    )
    await admin_supabase.storage.from_("simulation.assets").upload(
        base_path, thumb_avif, {"content-type": "image/avif", "upsert": "true"},
    )

    public_url = admin_supabase.storage.from_("simulation.assets").get_public_url(base_path)

    logger.info(
        "Showcase image uploaded",
        extra={
            "archetype": archetype_id,
            "model": visual.model,
            "full_path": full_path,
            "thumb_path": base_path,
            "raw_bytes": len(raw_bytes),
        },
    )

    return {
        "archetype": archetype_id,
        "model": visual.model,
        "url": public_url,
        "full_path": full_path,
        "thumb_path": base_path,
        "bytes": len(raw_bytes),
        "usage": openrouter.last_usage,
    }
