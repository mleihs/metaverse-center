"""Pydantic models for simulation taxonomies."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class TaxonomyCreate(BaseModel):
    """Schema for creating a taxonomy value."""

    taxonomy_type: str = Field(..., min_length=1, max_length=50)
    value: str = Field(..., min_length=1, max_length=100)
    label: dict = Field(default_factory=dict)
    description: dict | None = None
    sort_order: int = 0
    is_default: bool = False
    metadata: dict | None = None


class TaxonomyUpdate(BaseModel):
    """Schema for updating a taxonomy value."""

    label: dict | None = None
    description: dict | None = None
    sort_order: int | None = None
    is_default: bool | None = None
    is_active: bool | None = None
    metadata: dict | None = None


class TaxonomyResponse(BaseModel):
    """Full taxonomy value response."""

    id: UUID
    simulation_id: UUID
    taxonomy_type: str
    value: str
    label: dict = Field(default_factory=dict)
    description: dict | None = None
    sort_order: int = 0
    is_default: bool = False
    is_active: bool = True
    metadata: dict | None = None
    game_weight: float | None = None
    created_at: datetime

    # Die Sprosse dieses Wortes auf der Verfallsleiter SEINER Welt; klein =
    # besser (pristine 5 … ruined 50). `None` heisst „steht auf keiner Sprosse"
    # — entweder weil die Taxonomie kein `building_condition` ist, oder weil das
    # Wort die Leiter dieser Welt nicht berührt.
    #
    # `None` und NICHT 0 oder 999. Eine fehlende Sprosse ist keine schlechte
    # Sprosse: wer sie zu einer Zahl macht, behauptet eine Position, und die
    # Oberfläche zeichnet daraufhin einen leeren Edelstein, der wie ein Messwert
    # aussieht. Genau dieser Griff (`?? 0`) hat heute zweimal einen Bau auf der
    # HÖCHSTEN Sprosse seiner Welt wie Schutt aussehen lassen.
    #
    # Die Zahl wird nicht in Python gerechnet, sondern aus
    # `fn_building_condition_ladder(simulation_id)` gelesen — dort steht die
    # Vorrangregel (eigene `metadata.rung` vor Sprossenkarte der Plattform)
    # genau einmal.
    rung: int | None = None
