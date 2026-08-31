"""Pydantic models for notification preferences."""

from pydantic import BaseModel, Field


class NotificationPreferencesUpdate(BaseModel):
    """Request body for updating notification preferences."""

    cycle_resolved: bool = Field(True, description="Email when a cycle resolves")
    phase_changed: bool = Field(True, description="Email when epoch phase changes")
    epoch_completed: bool = Field(True, description="Email when epoch completes")
    deadline_reminder: bool = Field(
        True,
        description=(
            "Email 2h before a cycle resolves while orders are still open. "
            "Defaults on: a warning you have to switch on warns nobody, and the "
            "penalty it warns about (RP loss, then an AI taking your seat) used "
            "to arrive with no notice at all."
        ),
    )
    email_locale: str = Field("en", description="Locale for email content", pattern="^(en|de)$")


class NotificationPreferencesResponse(BaseModel):
    """Response model for notification preferences."""

    cycle_resolved: bool
    phase_changed: bool
    epoch_completed: bool
    deadline_reminder: bool
    email_locale: str
