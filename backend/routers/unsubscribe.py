"""One-click unsubscribe (RFC 8058) — the only mail endpoint that needs no login.

Two entry points, and the split between them is the whole point:

``POST /api/v1/unsubscribe``
    The target named in ``List-Unsubscribe`` together with
    ``List-Unsubscribe-Post: List-Unsubscribe=One-Click``. Gmail and Yahoo POST
    here when the reader presses their built-in unsubscribe button. It performs
    the change and answers 200 in plain text, as the RFC expects.

``GET /api/v1/unsubscribe``
    What a human clicks in the footer. It performs **nothing**. It redirects to
    the confirmation page, which asks and then POSTs.

    That asymmetry is not pedantry about HTTP verbs. Corporate mail security
    (Microsoft Safe Links, Proofpoint, Barracuda) *pre-fetches* every link in an
    incoming message to scan it. A GET that unsubscribed on sight would silently
    remove readers who never touched the mail, and the effect would look exactly
    like a preference bug.

The write runs on the service-role client: there is no session here, and the
token IS the authorisation. The token names one user and one category and is
signed — see ``backend/utils/unsubscribe_tokens.py``.
"""

import logging
from typing import Annotated

from fastapi import APIRouter, Query
from fastapi.responses import PlainTextResponse, RedirectResponse

from backend.config import settings
from backend.models.common import SuccessResponse
from backend.services.audit_service import AuditService
from backend.utils.db import maybe_single_data
from backend.utils.errors import bad_request
from backend.utils.supabase_admin_cache import get_admin_supabase_client
from backend.utils.unsubscribe_tokens import verify_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/unsubscribe", tags=["unsubscribe"])

# Which preference columns a category switches off. "all" is the explicit
# "stop writing to me" link, not the default for a one-click press.
_CATEGORY_COLUMNS: dict[str, tuple[str, ...]] = {
    "cycle_resolved": ("cycle_resolved",),
    "phase_changed": ("phase_changed",),
    "epoch_completed": ("epoch_completed",),
    "all": ("cycle_resolved", "phase_changed", "epoch_completed"),
}


async def _apply_unsubscribe(token: str) -> dict:
    """Switch off the token's category for the token's user. Idempotent."""
    verified = verify_token(token)
    if verified is None:
        raise bad_request("This unsubscribe link is not valid.")

    user_id, category = verified
    columns = _CATEGORY_COLUMNS[category]

    admin = await get_admin_supabase_client()

    existing = await maybe_single_data(
        admin.table("notification_preferences").select("user_id").eq("user_id", user_id).maybe_single()
    )
    if existing:
        await admin.table("notification_preferences").update(dict.fromkeys(columns, False)).eq(
            "user_id", user_id
        ).execute()
    else:
        # No preference row yet: every notification defaults to on, so the
        # opt-out has to be WRITTEN rather than assumed. An `.update()` on an
        # absent row is a silent no-op — the same trap `upsert_platform_setting`
        # exists to avoid.
        await admin.table("notification_preferences").insert(
            {"user_id": user_id, **dict.fromkeys(columns, False)}
        ).execute()

    # `action` is free text on `audit_log` (measured: no CHECK, 20 distinct
    # verbs in use), so the entry names what happened rather than flattening
    # this into a generic "update".
    await AuditService.log_action(
        admin,
        simulation_id=None,
        user_id=user_id,
        entity_type="notification_preferences",
        entity_id=user_id,
        action="unsubscribe",
        details={"category": category, "source": "email_link"},
    )
    logger.info("Unsubscribed via email link", extra={"user_id": user_id, "category": category})
    return {"category": category}


@router.post("", response_class=PlainTextResponse)
async def one_click_unsubscribe(token: Annotated[str, Query(min_length=8, max_length=2048)]) -> PlainTextResponse:
    """RFC 8058 target. The mail client posts here; no session exists."""
    await _apply_unsubscribe(token)
    return PlainTextResponse("Unsubscribed.", status_code=200)


@router.post("/confirm")
async def confirm_unsubscribe(
    token: Annotated[str, Query(min_length=8, max_length=2048)],
) -> SuccessResponse[dict]:
    """What the confirmation page calls once the reader has pressed the button."""
    return SuccessResponse(data=await _apply_unsubscribe(token))


@router.get("/describe")
async def describe_token(token: Annotated[str, Query(min_length=8, max_length=2048)]) -> SuccessResponse[dict]:
    """Name the category a token would switch off, without switching anything off.

    The confirmation page has to tell the reader what they are about to leave,
    and the token is opaque to the browser. Read-only by construction: no client
    is created here, so a link scanner that follows it changes nothing.
    """
    verified = verify_token(token)
    if verified is None:
        raise bad_request("This unsubscribe link is not valid.")
    return SuccessResponse(data={"category": verified[1]})


@router.get("")
async def unsubscribe_landing(token: Annotated[str, Query(min_length=8, max_length=2048)]) -> RedirectResponse:
    """Send a human to the confirmation page. Changes nothing — see module docstring."""
    return RedirectResponse(url=f"{settings.site_url}/unsubscribe?token={token}", status_code=303)
