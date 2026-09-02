"""Die Schleuse — der eine Weg, der eine Welt verlässt.

Der Rest der Schleuse spricht über bestehende Router: der Zufluss über
`social_trends` (browse/transform/integrate), die Sensorlage und die
Kandidatenliste über `news_scanner` (admin-only). Hier steht, was beiden
fehlte — das Melden eines Signals an das Bureau.

SCHREIBWEG UND WARUM ER SO AUSSIEHT: `news_scan_candidates` ist seit Migration
215 zum Schreiben `service_role`-only. Der Architekt ist kein Plattform-Admin,
also kann seine Meldung nicht mit seinem eigenen JWT geschrieben werden. Der
Router prüft deshalb ZUERST die Mitgliedschaft in der Welt
(`require_role("editor")` liest `simulation_id` aus dem Pfad) und schreibt ERST
DANN mit dem Admin-Client — das dokumentierte Muster (ADR-006: die
Autorisierung gehört vor den privilegierten Aufruf, nicht in ihn).
"""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request

from backend.dependencies import (
    get_admin_supabase,
    get_current_user,
    get_effective_supabase,
    require_role,
)
from backend.middleware.rate_limit import RATE_LIMIT_STANDARD, limiter
from backend.models.common import CurrentUser, SuccessResponse
from backend.models.intake import (
    FlaggedSignalResponse,
    FlagSignalRequest,
    IntakeSubscriptionRequest,
    IntakeSubscriptionResponse,
    SignatureFitResponse,
)
from backend.services.audit_service import AuditService
from backend.services.intake_service import IntakeService
from backend.utils.errors import not_found
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/simulations/{simulation_id}/intake",
    tags=["intake"],
)


@router.post("/flag", status_code=201)
@limiter.limit(RATE_LIMIT_STANDARD)
async def flag_signal(
    request: Request,
    simulation_id: UUID,
    body: FlagSignalRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    admin_supabase: Annotated[Client, Depends(get_admin_supabase)],
) -> SuccessResponse[FlaggedSignalResponse]:
    """Ein Signal dem Bureau vorlegen.

    Der Architekt entscheidet damit NICHT, dass alle Welten es trifft — das
    entscheidet das Bureau. Er legt vor. Die Meldung erscheint beim Admin in
    der Quarantäne und beim Architekten unter den freigegebenen Signalen als
    `gemeldet`.
    """
    candidate = await IntakeService.flag_signal(
        admin_supabase,
        simulation_id=simulation_id,
        user_id=user.id,
        title=body.title,
        source_category=body.source_category,
        magnitude=body.magnitude,
        reason=body.reason,
        description=body.description,
        article_url=body.article_url,
        article_platform=body.article_platform,
        article_raw_data=body.article_raw_data,
    )

    await AuditService.safe_log(
        admin_supabase,
        simulation_id,
        user.id,
        "news_scan_candidates",
        candidate["id"],
        "flag",
        details={"source_category": body.source_category, "magnitude": body.magnitude},
    )

    return SuccessResponse(data=FlaggedSignalResponse(**candidate))


@router.get("/fit")
async def signature_fit(
    simulation_id: UUID,
    _user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[list[SignatureFitResponse]]:
    """Wie sehr diese Welt fuer jede Signatur empfaenglich ist (Luecke 3).

    Acht Zeilen, eine je Signatur — nicht eine je Kandidat. Die Passung haengt
    an (Welt, Signatur); zwei Unwetterwarnungen haben dieselbe. Das ist keine
    Vereinfachung, sondern die Aussage: Passung sagt „wie sehr geht diese ART
    von Sache diese Welt an", die Magnitude sagt „wie gross ist DIESE hier".

    `viewer` reicht: die Empfaenglichkeit einer Welt ist eine Eigenschaft der
    Welt, keine Handlung an ihr.
    """
    return SuccessResponse(data=await IntakeService.signature_fit(supabase, simulation_id))


# ── Abonnements (Luecke 6) ───────────────────────────────────────────────────
#
# Ein Abo entscheidet, WAS ohne Nachfrage in den Eingang gehoert und mit welcher
# Linse. Es verwandelt nichts und loest keinen Zeitgeber aus — die Begruendung
# steht in Migration 347.
#
# Alle vier Wege laufen ueber `get_effective_supabase`, also ueber RLS: ein Abo
# gehoert der Welt, und die Regeln der Tabelle sagen bereits, wer lesen und wer
# schreiben darf. Der Admin-Client waere hier eine Umgehung ohne Not — anders
# als bei `/flag`, wo `news_scan_candidates` seit Migration 215 service-role-only
# ist.


@router.get("/subscriptions")
async def list_subscriptions(
    simulation_id: UUID,
    _user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("viewer"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[list[IntakeSubscriptionResponse]]:
    """Die Abonnements dieser Welt."""
    return SuccessResponse(data=await IntakeService.list_subscriptions(supabase, simulation_id))


@router.post("/subscriptions", status_code=201)
@limiter.limit(RATE_LIMIT_STANDARD)
async def create_subscription(
    request: Request,
    simulation_id: UUID,
    body: IntakeSubscriptionRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[IntakeSubscriptionResponse]:
    """Ein Abonnement anlegen."""
    created = await IntakeService.create_subscription(
        supabase,
        simulation_id=simulation_id,
        user_id=user.id,
        data=body.model_dump(exclude_none=False),
    )
    await AuditService.safe_log(
        supabase,
        simulation_id,
        user_id=user.id,
        action="create",
        entity_type="intake_subscription",
        entity_id=created.get("id"),
        details={"label": body.label, "source_category": body.source_category},
    )
    return SuccessResponse(data=created)


@router.patch("/subscriptions/{subscription_id}")
@limiter.limit(RATE_LIMIT_STANDARD)
async def update_subscription(
    request: Request,
    simulation_id: UUID,
    subscription_id: UUID,
    body: IntakeSubscriptionRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[IntakeSubscriptionResponse]:
    """Ein Abonnement aendern — auch das blosse An- und Abschalten."""
    updated = await IntakeService.update_subscription(
        supabase,
        subscription_id=subscription_id,
        simulation_id=simulation_id,
        data=body.model_dump(exclude_none=False),
    )
    if updated is None:
        raise not_found("Subscription", subscription_id)
    await AuditService.safe_log(
        supabase,
        simulation_id,
        user_id=user.id,
        action="update",
        entity_type="intake_subscription",
        entity_id=str(subscription_id),
        details={"is_active": body.is_active},
    )
    return SuccessResponse(data=updated)


@router.delete("/subscriptions/{subscription_id}")
@limiter.limit(RATE_LIMIT_STANDARD)
async def delete_subscription(
    request: Request,
    simulation_id: UUID,
    subscription_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    _role_check: Annotated[str, Depends(require_role("editor"))],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[dict]:
    """Ein Abonnement loeschen."""
    removed = await IntakeService.delete_subscription(
        supabase,
        subscription_id=subscription_id,
        simulation_id=simulation_id,
    )
    if not removed:
        raise not_found("Subscription", subscription_id)
    await AuditService.safe_log(
        supabase,
        simulation_id,
        user_id=user.id,
        action="delete",
        entity_type="intake_subscription",
        entity_id=str(subscription_id),
    )
    return SuccessResponse(data={"deleted": True})
