"""Mailvorlagen ansehen, ohne eine Mail zu verschicken (Handoff P3.27).

BEFUND
------
Bis hierher gab es genau einen Weg, eine Mailvorlage zu sehen:
``scripts/send_test_emails.py`` an eine echte Adresse schicken und ins Postfach
schauen. Das setzt SMTP-Zugangsdaten, eine Konsole und ein Postfach voraus —
und weil es umständlich ist, geschieht es selten. Vier der elf Vorlagen waren
in diesem Skript überhaupt nicht geführt; sie sind heute entstanden und hätten
sich auf diesem Weg gar nicht ansehen lassen.

Eine Vorlage, die man nur durch Versenden prüfen kann, wird nicht geprüft.

WAS ES GIBT
-----------
``GET /api/v1/admin/emails/preview``            — das Verzeichnis
``GET /api/v1/admin/emails/preview/{template}`` — die gerenderte Mail

Beides nur für Plattform-Administratoren. Die zweite Route liefert bewusst
``text/html`` statt eines ``SuccessResponse``-Rumpfes: Zweck ist, das Ergebnis
im Browser ANZUSEHEN, und ein in JSON verpacktes HTML müsste erst wieder
ausgepackt werden, um genau das zu tun. Das Verzeichnis dagegen ist Daten und
folgt der üblichen Form.

``?locale=de|en`` schaltet die Sprache, ``?part=text`` zeigt statt des HTML die
Klartext-Alternative — denn die ist die zweite Hälfte jeder Mail und wird sonst
nie angesehen. Ein Klartextteil, den niemand liest, verkommt genauso wie eine
Vorlage, die niemand rendert.

HIER WIRD NICHTS VERSCHICKT. Der Router hat keinen Zugriff auf
``EmailService.send`` und keinen Empfänger als Parameter.
"""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import HTMLResponse, PlainTextResponse

from backend.dependencies import require_platform_admin
from backend.models.common import SuccessResponse
from backend.models.email_preview import EmailPreviewIndexEntry
from backend.services.email_fixtures import FIXTURES, FIXTURES_BY_KEY
from backend.services.email_templates import html_to_text
from backend.utils.errors import not_found

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/admin/emails", tags=["admin-email-preview"])

_LOCALES = ("de", "en")


@router.get("/preview")
async def list_email_previews(
    _admin: Annotated[str, Depends(require_platform_admin())],
) -> SuccessResponse[list[EmailPreviewIndexEntry]]:
    """List every previewable template with its properties.

    ``unsubscribable`` and ``accountless_recipient`` are carried into the index
    rather than left in the code, because they are the two facts an admin needs
    before judging a footer: a security mail that offers to unsubscribe is
    wrong, and a footer linking to account settings is wrong for a reader who
    may have no account.
    """
    return SuccessResponse(
        data=[
            EmailPreviewIndexEntry(
                key=fixture.key,
                label=fixture.label,
                locales=list(_LOCALES),
                unsubscribable=fixture.unsubscribable,
                accountless_recipient=fixture.accountless_recipient,
                subject_de=fixture.subject("de"),
                subject_en=fixture.subject("en"),
            )
            for fixture in FIXTURES
        ]
    )


@router.get("/preview/{template}", response_model=None)
async def preview_email(
    template: str,
    _admin: Annotated[str, Depends(require_platform_admin())],
    locale: Annotated[str, Query(pattern="^(de|en)$")] = "de",
    part: Annotated[str, Query(pattern="^(html|text)$")] = "html",
) -> HTMLResponse | PlainTextResponse:
    """Render one template for viewing. Sends nothing.

    ``response_model=None`` is required here and only here: the return type is a
    union of two Response classes, neither of which is a Pydantic model. This is
    the same documented exception the SPA catch-all in ``app.py`` carries.
    """
    fixture = FIXTURES_BY_KEY.get(template)
    if fixture is None:
        raise not_found(detail=f"Unknown email template '{template}'.")

    html = fixture.render(locale)
    if part == "text":
        return PlainTextResponse(html_to_text(html), media_type="text/plain; charset=utf-8")
    return HTMLResponse(html)
