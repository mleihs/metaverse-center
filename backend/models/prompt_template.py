"""Pydantic models for prompt templates."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class PromptTemplateCreate(BaseModel):
    """Schema for creating a prompt template."""

    template_type: str = Field(..., min_length=1, max_length=50)
    prompt_category: str = Field(..., min_length=1, max_length=50)
    locale: str = "en"
    template_name: str = Field(..., min_length=1, max_length=255)
    prompt_content: str = Field(..., min_length=1)
    system_prompt: str | None = None
    variables: list[dict] = Field(default_factory=list)
    description: str | None = None
    default_model: str | None = None
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(default=1024, ge=1, le=32000)
    negative_prompt: str | None = None
    is_system_default: bool = False
    version: int = 1
    parent_template_id: UUID | None = None


class PromptTemplateUpdate(BaseModel):
    """Schema for updating a prompt template."""

    template_name: str | None = Field(default=None, min_length=1, max_length=255)
    prompt_content: str | None = None
    system_prompt: str | None = None
    variables: list[dict] | None = None
    description: str | None = None
    default_model: str | None = None
    temperature: float | None = Field(default=None, ge=0.0, le=2.0)
    max_tokens: int | None = Field(default=None, ge=1, le=32000)
    negative_prompt: str | None = None
    is_active: bool | None = None


class PromptTemplateResponse(BaseModel):
    """Full prompt template response."""

    id: UUID
    simulation_id: UUID | None = None
    template_type: str
    prompt_category: str
    locale: str
    template_name: str
    prompt_content: str
    system_prompt: str | None = None
    variables: list[dict] = Field(default_factory=list)
    description: str | None = None
    default_model: str | None = None
    temperature: float = 0.7
    max_tokens: int = 1024
    negative_prompt: str | None = None
    is_system_default: bool = False
    is_active: bool = True
    version: int = 1
    parent_template_id: UUID | None = None
    created_by_id: UUID | None = None
    created_at: datetime
    updated_at: datetime
