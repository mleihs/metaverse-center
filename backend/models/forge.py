"""Pydantic models for the Simulation Forge drafting process."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

ForgePhase = Literal["astrolabe", "drafting", "darkroom", "ignition", "completed", "failed"]
ForgeStatus = Literal["draft", "processing", "completed", "failed"]


# ── Generation Config ──────────────────────────────────────────────────


class ForgeGenerationConfig(BaseModel):
    """User-chosen entity counts and quality settings for world generation."""
    agent_count: int = Field(default=6, ge=3, le=12)
    building_count: int = Field(default=7, ge=3, le=12)
    zone_count: int = Field(default=5, ge=3, le=8)
    street_count: int = Field(default=5, ge=3, le=8)
    deep_research: bool = Field(
        default=True,
        description=(
            "Run a dedicated LLM research step before lore generation. "
            "Produces concept-lore-quality output grounded in real literary, "
            "philosophical, and architectural traditions. Costs ~$0.002 extra."
        ),
    )


# ── Lore Models ────────────────────────────────────────────────────────


class ForgeLoreSection(BaseModel):
    """A single lore section for a simulation."""
    chapter: str
    arcanum: str
    title: str
    epigraph: str = ""
    body: str
    image_slug: str | None = None
    image_caption: str | None = None


class ForgeLoreOutput(BaseModel):
    """AI-generated lore for a simulation."""
    sections: list[ForgeLoreSection]


class ForgeLoreTranslatedSection(BaseModel):
    """Translated fields for a single lore section."""
    title: str
    epigraph: str = ""
    body: str
    image_caption: str | None = None


class ForgeLoreTranslatedOutput(BaseModel):
    """AI-translated lore sections (DE)."""
    sections: list[ForgeLoreTranslatedSection]


# ── Theme Models ───────────────────────────────────────────────────────


class ForgeThemeOutput(BaseModel):
    """AI-generated theme with all ~40 design settings."""

    # Colors (21)
    color_primary: str = Field(description="Primary brand color (hex)")
    color_primary_hover: str = Field(description="Primary hover state")
    color_primary_active: str = Field(description="Primary active/pressed state")
    color_secondary: str = Field(description="Secondary accent color")
    color_accent: str = Field(description="Tertiary highlight color")
    color_background: str = Field(description="Page background")
    color_surface: str = Field(description="Card/panel surface")
    color_surface_sunken: str = Field(description="Recessed surface areas")
    color_surface_header: str = Field(description="Header/nav surface")
    color_text: str = Field(description="Primary text color")
    color_text_secondary: str = Field(description="Secondary text color")
    color_text_muted: str = Field(description="Muted/disabled text")
    color_border: str = Field(description="Primary border color")
    color_border_light: str = Field(description="Subtle border color")
    color_danger: str = Field(description="Error/danger color")
    color_success: str = Field(description="Success color")
    color_primary_bg: str = Field(description="Primary tinted background")
    color_info_bg: str = Field(description="Info tinted background")
    color_danger_bg: str = Field(description="Danger tinted background")
    color_success_bg: str = Field(description="Success tinted background")
    color_warning_bg: str = Field(description="Warning tinted background")

    # Typography (7)
    font_heading: str = Field(description="Heading font family CSS value")
    font_body: str = Field(description="Body font family CSS value")
    font_mono: str = Field(description="Monospace font family CSS value")
    font_base_size: str = Field(default="16px", description="Base font size")
    heading_weight: str = Field(description="Heading font weight (100-900)")
    heading_transform: str = Field(description="Heading text-transform: uppercase|none|capitalize")
    heading_tracking: str = Field(description="Heading letter-spacing CSS value")

    # Character (7)
    border_radius: str = Field(description="Border radius in px (e.g. '0', '6px', '12px')")
    border_width: str = Field(description="Primary border width (e.g. '3px')")
    border_width_default: str = Field(default="2px", description="Default border width")
    shadow_style: Literal["offset", "blur", "glow", "none"] = Field(description="Shadow rendering style")
    shadow_color: str = Field(description="Shadow color (hex)")
    hover_effect: Literal["translate", "scale", "glow"] = Field(description="Element hover effect")
    text_inverse: str = Field(default="#ffffff", description="Inverse text for dark-on-light")

    # Animation (2)
    animation_speed: str = Field(default="1", description="Animation speed multiplier (0.7-2.0)")
    animation_easing: str = Field(description="CSS easing function")

    # Card frame (4)
    card_frame_texture: Literal[
        "none", "filigree", "circuits", "scanlines", "rivets", "illumination"
    ] = Field(description="Card background texture overlay")
    card_frame_nameplate: Literal[
        "terminal", "banner", "readout", "plate", "cartouche"
    ] = Field(description="Card name label style")
    card_frame_corners: Literal[
        "none", "tentacles", "brackets", "crosshairs", "bolts", "floral"
    ] = Field(description="Card corner decoration motif")
    card_frame_foil: Literal[
        "holographic", "aquatic", "phosphor", "patina", "gilded"
    ] = Field(description="Card holographic foil style")

    # Image style prompts (4) — appended to Replicate prompts for world-consistent imagery
    image_style_prompt_portrait: str = Field(
        description="Visual style suffix for agent portrait generation. "
        "Describe the photographic/artistic style, lighting, mood, and medium "
        "that matches this world's aesthetic. E.g. 'oil painting, chiaroscuro lighting, "
        "muted earth tones' or 'cyberpunk neon photograph, rain-slicked, high contrast'.",
    )
    image_style_prompt_building: str = Field(
        description="Visual style suffix for building/architecture images. "
        "Describe the architectural photography style and atmosphere. "
        "E.g. 'brutalist concrete photography, overcast sky, stark shadows' "
        "or 'watercolor illustration, overgrown ruins, warm golden light'.",
    )
    image_style_prompt_banner: str = Field(
        description="Visual style suffix for the simulation's banner image (16:9 landscape). "
        "Describe the cinematic style for the world's establishing shot. "
        "E.g. 'epic matte painting, volumetric fog, dramatic scale' "
        "or 'aerial photograph, twilight, city lights emerging'.",
    )
    image_style_prompt_lore: str = Field(
        description="Visual style suffix for lore/story illustration images. "
        "Describe the illustration style for atmospheric narrative scenes. "
        "E.g. 'engraving illustration, cross-hatching, sepia tones' "
        "or 'concept art, moody palette, environmental storytelling'.",
    )


# ── Draft Models ───────────────────────────────────────────────────────


class ForgeDraftBase(BaseModel):
    """Base fields for a Forge Draft."""
    seed_prompt: str | None = None
    current_phase: ForgePhase = "astrolabe"
    philosophical_anchor: dict[str, Any] = Field(default_factory=dict)
    research_context: dict[str, Any] = Field(default_factory=dict)
    taxonomies: dict[str, Any] = Field(default_factory=dict)
    geography: dict[str, Any] = Field(default_factory=dict)
    agents: list[dict[str, Any]] = Field(default_factory=list)
    buildings: list[dict[str, Any]] = Field(default_factory=list)
    ai_settings: dict[str, Any] = Field(default_factory=dict)
    generation_config: dict[str, Any] = Field(default_factory=dict)
    theme_config: dict[str, Any] = Field(default_factory=dict)
    status: ForgeStatus = "draft"


class ForgeDraftCreate(BaseModel):
    """Schema for creating a new draft."""
    seed_prompt: str = Field(min_length=3, max_length=500)


class ForgeDraftUpdate(BaseModel):
    """Schema for updating a draft state."""
    current_phase: ForgePhase | None = None
    philosophical_anchor: dict[str, Any] | None = None
    research_context: dict[str, Any] | None = None
    taxonomies: dict[str, Any] | None = None
    geography: dict[str, Any] | None = None
    agents: list[dict[str, Any]] | None = None
    buildings: list[dict[str, Any]] | None = None
    ai_settings: dict[str, Any] | None = None
    generation_config: dict[str, Any] | None = None
    theme_config: dict[str, Any] | None = None
    status: ForgeStatus | None = None
    error_log: str | None = None


class ForgeDraft(ForgeDraftBase):
    """Full draft record from database."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    error_log: str | None = None
    created_at: datetime
    updated_at: datetime


class UserWallet(BaseModel):
    """User wallet/quota information."""
    model_config = ConfigDict(from_attributes=True)

    user_id: UUID
    forge_tokens: int
    is_architect: bool
    encrypted_openrouter_key: str | None = None
    encrypted_replicate_key: str | None = None
    created_at: datetime
    updated_at: datetime


class UpdateBYOKRequest(BaseModel):
    """Schema for users to securely update their BYOK keys."""
    openrouter_key: str | None = None
    replicate_key: str | None = None


class PhilosophicalAnchor(BaseModel):
    """A proposed thematic anchor for a simulation."""
    title: str
    literary_influence: str
    core_question: str
    bleed_signature_suggestion: str
    description: str


class ForgeAgentDraft(BaseModel):
    """Draft of an agent entity."""
    name: str
    gender: str
    system: str
    primary_profession: str
    character: str = Field(
        description=(
            "Personality portrait in 200-300 words. Include temperament, mannerisms, "
            "contradictions, one memorable quirk, and a brief physical impression "
            "(build, distinguishing feature, typical clothing) to aid later portrait generation."
        ),
    )
    background: str = Field(
        description=(
            "Backstory in 200-300 words. Include origin, formative event, current motivation, "
            "and a secret or unresolved tension."
        ),
    )


class ForgeBuildingDraft(BaseModel):
    """Draft of a building entity."""
    name: str
    building_type: str
    description: str = Field(
        description=(
            "Atmospheric description in 150-250 words. Include architectural style, "
            "dominant materials (stone, iron, glass, wood), sensory details (sounds, smells, light), "
            "and what makes this place remarkable or unsettling. "
            "These details will feed into image generation."
        ),
    )
    building_condition: str = Field(
        default="good",
        description=(
            "Physical condition: pristine, good, fair, poor, or ruined. "
            "Vary across buildings in the set. "
            "A 'ruined' building shows structural damage; 'poor' shows neglect and decay."
        ),
    )


class ForgeZoneDraft(BaseModel):
    """Draft of a single zone/district."""
    name: str
    zone_type: str = Field(description="Zone classification (e.g. residential, industrial, cultural, commercial, government, military, slum, entertainment).")
    description: str = Field(description="1-2 sentence atmospheric description of the zone's character and purpose.")
    characteristics: list[str] = Field(description="2-4 evocative tags capturing the zone's essence (e.g. 'perpetual twilight', 'echoing walls', 'overgrown machinery').")


class ForgeStreetDraft(BaseModel):
    """Draft of a single named street."""
    name: str
    zone_name: str = Field(description="Name of the zone this street belongs to.")
    street_type: str = Field(description="Street classification (e.g. alley, boulevard, lane, avenue, road, street, stairway).")
    description: str = Field(default="", description="Optional 1-sentence atmospheric detail about this street.")


class ForgeGeographyDraft(BaseModel):
    """Draft of city geography."""
    city_name: str
    zones: list[ForgeZoneDraft]
    streets: list[ForgeStreetDraft]


# ── Entity Translation Models ─────────────────────────────────────────


class ForgeAgentTranslation(BaseModel):
    """German translations for a single agent."""
    name: str  # used as key to match, not translated
    character_de: str = ""
    background_de: str = ""
    primary_profession_de: str = ""


class ForgeBuildingTranslation(BaseModel):
    """German translations for a single building."""
    name: str
    description_de: str = ""
    building_type_de: str = ""
    building_condition_de: str = ""


class ForgeZoneTranslation(BaseModel):
    """German translations for a single zone."""
    name: str
    description_de: str = ""
    zone_type_de: str = ""


class ForgeStreetTranslation(BaseModel):
    """German translations for a single street."""
    name: str
    street_type_de: str = ""


class ForgeSimulationTranslation(BaseModel):
    """German translation for the simulation description."""
    description_de: str = ""


class ForgeEntityTranslationOutput(BaseModel):
    """Complete entity translation batch for a simulation."""
    agents: list[ForgeAgentTranslation]
    buildings: list[ForgeBuildingTranslation]
    zones: list[ForgeZoneTranslation]
    streets: list[ForgeStreetTranslation]
    simulation: ForgeSimulationTranslation
