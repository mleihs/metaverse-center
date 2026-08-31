"""Response models for the admin email preview (Handoff P3.27)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class EmailPreviewIndexEntry(BaseModel):
    """One previewable mail template.

    The two boolean fields are not decoration. They are the facts an admin needs
    in order to judge a footer at a glance:

    * ``unsubscribable`` — a security or account mail must NOT offer to
      unsubscribe. Seeing it in the index means one does not have to open every
      mail to check.
    * ``accountless_recipient`` — the reader may have no account yet
      (invitations) or no longer have one (deletion confirmation). Such a footer
      must not link to account settings.
    """

    key: str = Field(..., description="URL segment of the preview route")
    label: str = Field(..., description="Human-readable name")
    locales: list[str] = Field(..., description="Languages this template renders in")
    unsubscribable: bool = Field(..., description="May carry a List-Unsubscribe header")
    accountless_recipient: bool = Field(..., description="Recipient may have no account")
    subject_de: str
    subject_en: str
