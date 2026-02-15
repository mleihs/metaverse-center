"""Pydantic models for simulation settings."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

# Encryption is handled at the application level via setting_key convention.
# Keys in ENCRYPTED_SETTING_KEYS are stored encrypted and masked in responses.
ENCRYPTED_SETTING_KEYS = frozenset({
    "api_key",
    "secret_key",
    "access_token",
    "encryption_key",
    "webhook_secret",
})


class SettingCreate(BaseModel):
    """Schema for creating/upserting a setting."""

    category: str = Field(..., min_length=1, max_length=50)
    setting_key: str = Field(..., min_length=1, max_length=100)
    setting_value: dict | str | int | float | bool | list


class SettingUpdate(BaseModel):
    """Schema for updating a setting value."""

    setting_value: dict | str | int | float | bool | list


class SettingResponse(BaseModel):
    """Full setting response."""

    id: UUID
    simulation_id: UUID
    category: str
    setting_key: str
    setting_value: dict | str | int | float | bool | list | None = None
    updated_by_id: UUID | None = None
    created_at: datetime
    updated_at: datetime
