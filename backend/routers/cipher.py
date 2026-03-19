"""Cipher ARG system — public redemption + admin management endpoints.

Public endpoints:
  POST /api/v1/public/bureau/dispatch  — Redeem a cipher code (no auth required)

Admin endpoints:
  GET  /api/v1/admin/instagram/ciphers           — Cipher redemption stats
  POST /api/v1/admin/instagram/{post_id}/cipher   — Set cipher for a post
"""

import logging
from uuid import UUID

import sentry_sdk
from fastapi import APIRouter, Depends, HTTPException, Request, status

from backend.dependencies import get_admin_supabase, get_current_user, require_platform_admin
from backend.middleware.rate_limit import RATE_LIMIT_ADMIN_MUTATION, limiter
from backend.models.cipher import (
    CipherRedeemRequest,
    CipherRedemptionResponse,
    CipherSetRequest,
    CipherStatsResponse,
)
from backend.models.common import CurrentUser, SuccessResponse
from backend.services.cipher_service import CipherService
from supabase import Client

logger = logging.getLogger(__name__)


# ── Public Router ────────────────────────────────────────────────────────

public_router = APIRouter(
    prefix="/api/v1/public/bureau",
    tags=["Bureau"],
)


@public_router.post("/dispatch", response_model=CipherRedemptionResponse)
@limiter.limit("10/minute")
async def redeem_cipher(
    request: Request,
    body: CipherRedeemRequest,
    admin_supabase: Client = Depends(get_admin_supabase),
) -> CipherRedemptionResponse:
    """Redeem a cipher code from an Instagram dispatch.

    No authentication required, but authenticated users get
    their redemption linked to their account.
    """
    # Extract user ID if authenticated (optional — anonymous is fine)
    user_id: UUID | None = None
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        try:
            user = await get_current_user(auth_header)
            user_id = user.id
        except Exception:  # noqa: S110
            pass

    # Hash IP for rate limiting (never store raw IPs)
    client_ip = request.client.host if request.client else "unknown"
    ip_hash = CipherService.hash_ip(client_ip)

    logger.info("Cipher redemption attempt", extra={
        "user_id": str(user_id) if user_id else "anonymous",
        "action": "redeem_cipher",
    })

    try:
        result = await CipherService.redeem_code(
            admin_supabase,
            code=body.code,
            user_id=user_id,
            ip_hash=ip_hash,
        )
        return result
    except Exception as exc:
        logger.exception("Cipher redemption failed", extra={
            "user_id": str(user_id) if user_id else "anonymous",
        })
        with sentry_sdk.push_scope() as scope:
            scope.set_tag("instagram_phase", "cipher_redeem_endpoint")
            sentry_sdk.capture_exception(exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Cipher redemption failed. Please try again.",
        ) from exc


# ── Admin Router ─────────────────────────────────────────────────────────

admin_router = APIRouter(
    prefix="/api/v1/admin/instagram",
    tags=["Instagram"],
)


@admin_router.get("/ciphers", response_model=SuccessResponse[CipherStatsResponse])
async def list_cipher_stats(
    _user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Get cipher redemption statistics."""
    stats = await CipherService.get_redemption_stats(admin_supabase)
    return {"success": True, "data": stats}


@admin_router.post(
    "/{post_id}/cipher",
    response_model=SuccessResponse[dict],
)
@limiter.limit(RATE_LIMIT_ADMIN_MUTATION)
async def set_cipher_for_post(
    request: Request,
    post_id: UUID,
    body: CipherSetRequest,
    user: CurrentUser = Depends(require_platform_admin()),
    admin_supabase: Client = Depends(get_admin_supabase),
) -> dict:
    """Set or override the cipher code for an Instagram post."""
    logger.info("Instagram admin action", extra={
        "action": "set_cipher",
        "post_id": str(post_id),
        "user_id": str(user.id),
        "difficulty": body.difficulty,
    })

    # Verify post exists
    post = await CipherService.get_instagram_post(admin_supabase, post_id)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Instagram post not found.",
        )

    # Update unlock code
    await CipherService.update_post_unlock_code(
        admin_supabase, post_id, body.unlock_code.upper(),
    )

    return {
        "success": True,
        "data": {
            "post_id": str(post_id),
            "unlock_code": body.unlock_code.upper(),
            "difficulty": body.difficulty,
        },
    }
