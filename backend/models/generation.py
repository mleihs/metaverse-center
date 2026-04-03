"""Pydantic models for AI generation endpoints."""

from uuid import UUID

from pydantic import BaseModel, Field

# --- Request models ---


class GenerateAgentRequest(BaseModel):
    """Request to generate an agent description."""

    name: str = Field(..., min_length=1, max_length=255, description="Display name of the agent to generate.")
    system: str = Field("", description="Agent's system/faction affiliation within the simulation.")
    gender: str = Field("", description="Agent's gender (used for pronoun selection in generated text).")
    locale: str = Field("de", description="Target language for the generated description (ISO 639-1).")


class GenerateBuildingRequest(BaseModel):
    """Request to generate a building description."""

    building_type: str = Field(
        ..., min_length=1, description="Taxonomy building type (e.g. 'residential', 'military')."
    )
    name: str | None = Field(None, description="Optional building name; unnamed buildings get a generic description.")
    style: str | None = Field(None, description="Architectural style (e.g. 'brutalist', 'gothic', 'industrial').")
    condition: str | None = Field(None, description="Current building condition (e.g. 'good', 'damaged', 'ruins').")
    locale: str = Field("de", description="Target language for the generated description (ISO 639-1).")


class GeneratePortraitRequest(BaseModel):
    """Request to generate a portrait description."""

    agent_id: UUID = Field(..., description="UUID of the agent whose portrait to describe.")
    agent_name: str = Field(..., min_length=1, description="Display name of the agent (used in the prompt).")
    agent_data: dict | None = Field(
        None, description="Optional agent metadata (appearance, background) for the prompt."
    )


class GenerateEventRequest(BaseModel):
    """Request to generate an event."""

    event_type: str = Field(
        ..., min_length=1, description="Taxonomy event type (e.g. 'political', 'social', 'military')."
    )
    locale: str = Field("de", description="Target language for the generated event (ISO 639-1).")


class GenerateRelationshipsRequest(BaseModel):
    """Request to generate agent relationships."""

    agent_id: UUID = Field(..., description="UUID of the focal agent to generate relationships for.")
    locale: str = Field("de", description="Target language for relationship descriptions (ISO 639-1).")


class GenerateImageRequest(BaseModel):
    """Request to generate an image for an entity."""

    entity_type: str = Field(
        ..., pattern="^(agent|building|banner)$", description="Entity kind: 'agent', 'building', or 'banner'."
    )
    entity_id: UUID = Field(..., description="UUID of the entity to generate an image for.")
    entity_name: str = Field(..., min_length=1, description="Display name of the entity (used in the image prompt).")
    extra: dict | None = Field(None, description="Additional entity metadata passed to the image generation pipeline.")


class GenerateLoreImageRequest(BaseModel):
    """Request to generate a lore section image."""

    section_title: str = Field(..., min_length=1, description="Title of the lore section.")
    section_body: str = Field(..., description="Body text of the lore section (truncated for prompt).")
    image_slug: str = Field(..., min_length=1, description="Slug for the output file path.")
    sim_slug: str = Field(..., min_length=1, description="Simulation slug for the storage path.")
    image_caption: str | None = Field(None, description="Visual scene description for direct use as image prompt.")


# --- Response models ---


class PortraitDescriptionResponse(BaseModel):
    """AI-generated portrait description for image generation."""

    description: str


class ImageGenerationResponse(BaseModel):
    """URL of an AI-generated image (portraits, banners, lore, buildings)."""

    image_url: str
