"""Pydantic models for agent aptitudes."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

OperativeType = Literal[
    "spy", "guardian", "saboteur", "propagandist", "infiltrator", "assassin"
]

OPERATIVE_TYPES: list[str] = [
    "spy", "guardian", "saboteur", "propagandist", "infiltrator", "assassin"
]

APTITUDE_BUDGET = 36
APTITUDE_MIN = 3
APTITUDE_MAX = 9

# The budget spread evenly across all six operative types (36 / 6 = 6). This is
# the ONE baseline for an agent that has no rows in `agent_aptitudes` — a
# neutral, budget-valid generalist. Every reader resolves the missing case
# through here; nobody invents their own number. (Before this constant existed
# the same question had four different answers: the flat 6 in
# AptitudeService.get_aptitude_for_operative, a flat 6 in the frontend's
# GENERALIST_APTITUDES, and a non-budget-valid {spy: 3, guardian: 2} inside
# dungeon run creation — which quietly crippled dungeon combat in every
# simulation the Forge ever generated.)
DEFAULT_APTITUDE_LEVEL = APTITUDE_BUDGET // len(OPERATIVE_TYPES)


class AptitudeSet(BaseModel):
    """Batch aptitude assignment — one level per operative type, budget = 36."""

    spy: int = Field(6, ge=APTITUDE_MIN, le=APTITUDE_MAX)
    guardian: int = Field(6, ge=APTITUDE_MIN, le=APTITUDE_MAX)
    saboteur: int = Field(6, ge=APTITUDE_MIN, le=APTITUDE_MAX)
    propagandist: int = Field(6, ge=APTITUDE_MIN, le=APTITUDE_MAX)
    infiltrator: int = Field(6, ge=APTITUDE_MIN, le=APTITUDE_MAX)
    assassin: int = Field(6, ge=APTITUDE_MIN, le=APTITUDE_MAX)

    @model_validator(mode="after")
    def validate_budget(self) -> "AptitudeSet":
        total = (
            self.spy + self.guardian + self.saboteur
            + self.propagandist + self.infiltrator + self.assassin
        )
        if total != APTITUDE_BUDGET:
            msg = f"Aptitude budget must equal {APTITUDE_BUDGET}, got {total}."
            raise ValueError(msg)
        return self


class AptitudeResponse(BaseModel):
    """One *effective* aptitude value for an agent.

    Rows that exist in `agent_aptitudes` carry their DB identity and
    `is_default=False`. An agent with no assigned aptitudes yields synthetic
    rows at `DEFAULT_APTITUDE_LEVEL`, marked `is_default=True`.

    Synthesizing here rather than at each call site is deliberate: the values a
    client shows and the values combat resolves with are then the same numbers
    from the same place, and a UI can tell an assigned score from a baseline one
    instead of painting a plausible-looking measurement over missing data.
    """

    id: UUID | None = None
    agent_id: UUID
    simulation_id: UUID
    operative_type: str
    aptitude_level: int
    is_default: bool = False
    created_at: datetime | None = None
    updated_at: datetime | None = None


class DraftRequest(BaseModel):
    """Request to lock in a draft roster."""

    agent_ids: list[UUID] = Field(..., min_length=1, max_length=8)
