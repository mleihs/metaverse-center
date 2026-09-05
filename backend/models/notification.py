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


#: Every column of `notification_preferences` a reader has to select, derived
#: from the model above rather than typed out again.
#:
#: Two call sites used to spell the list by hand, and they had drifted:
#: `cycle_notification_service._resolve_recipients` gates each recipient with
#: `prefs.get(notification_type, True)` — which LOOKS generic, but a column
#: missing from its `.select(...)` reads as the default `True`. A preference
#: added anywhere else would therefore be silently ignored exactly where it
#: matters, and nothing would say so. `deadline_reminder` was in that state the
#: hour it was created.
#:
#: `backend/tests/unit/test_notification_preference_columns.py` holds both call
#: sites to this constant.
NOTIFICATION_PREFERENCE_COLUMNS: tuple[str, ...] = tuple(NotificationPreferencesUpdate.model_fields)

#: The boolean switches alone — the ones `notification_type` may name.
NOTIFICATION_TOGGLE_COLUMNS: tuple[str, ...] = tuple(
    name for name, field in NotificationPreferencesUpdate.model_fields.items() if field.annotation is bool
)
