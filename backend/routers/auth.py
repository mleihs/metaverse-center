"""Erneute Anmeldung — Sichtschutz, nicht Zugangsschutz.

Ein Nutzer, der bereits angemeldet ist, weist sein Kontopasswort ein zweites
Mal nach, um verschlossene Gespräche einzusehen. Der Endpunkt sagt nur ja oder
nein; er stellt kein Token aus und merkt sich nichts.

⚠ WARUM DAS EINE HARTE DROSSEL BRAUCHT: die Stelle ist ein PASSWORT-ORAKEL.
Wer ein gültiges Zugangstoken hat (ein liegengelassener Browser, ein
gestohlener Sitzungsschlüssel), könnte hier sonst das zugehörige Passwort
erraten — und das öffnet nicht nur diesen Chat, sondern das Konto. Deshalb
``RATE_LIMIT_EXTERNAL_API`` (5/Minute) und nicht der Standardwert.
"""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status

from backend.dependencies import get_anon_supabase, get_current_user
from backend.middleware.rate_limit import RATE_LIMIT_EXTERNAL_API, limiter
from backend.models.auth import ReauthRequest, ReauthResponse
from backend.models.common import CurrentUser, SuccessResponse
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

#: Wie lange die Oberfläche einen bestandenen Nachweis gelten lässt.
#: 30 Minuten ist die Spanne aus der Spezifikation — lang genug, um mehrere
#: verschlossene Gespräche hintereinander zu lesen, kurz genug, dass ein
#: verlassener Bildschirm sich von selbst wieder schliesst.
REAUTH_VALID_SECONDS = 1800


async def verify_account_password(anon: Client, email: str, password: str) -> bool:
    """Prüft das Kontopasswort. Gibt nur ja/nein zurück.

    Die zurückkommende Sitzung wird VERWORFEN, nicht weitergereicht: der
    Aufrufer ist bereits angemeldet, ein zweites Token hätte hier nichts zu
    suchen und wäre nur ein weiterer Ort, an dem eines liegt.
    """
    try:
        await anon.auth.sign_in_with_password({"email": email, "password": password})
    except Exception:
        # Absichtlich OHNE Kontext geloggt. Die Ausnahme von gotrue trägt die
        # Anmeldedaten im Klartext in ihrer Anfrage-Wiedergabe; ein
        # `logger.exception` hier schriebe das Passwort ins Protokoll.
        logger.info("Reauth abgelehnt")
        return False
    return True


@router.post("/reauth")
@limiter.limit(RATE_LIMIT_EXTERNAL_API)
async def reauth(
    request: Request,
    body: ReauthRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    anon: Annotated[Client, Depends(get_anon_supabase)],
) -> SuccessResponse[ReauthResponse]:
    """Das eigene Kontopasswort erneut nachweisen."""
    if not await verify_account_password(anon, user.email, body.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Password not recognised.",
        )
    return SuccessResponse(data=ReauthResponse(valid_for_seconds=REAUTH_VALID_SECONDS))
