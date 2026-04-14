"""Service for consumable feature purchases (Darkroom, Dossier, Recruitment, Chronicle)."""

from __future__ import annotations

import logging
from uuid import UUID

import httpx
from fastapi import HTTPException, status
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.utils.db import maybe_single_data
from backend.utils.errors import bad_request, server_error
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# Token costs per feature type
TOKEN_COSTS: dict[str, int] = {
    "darkroom_pass": 1,
    "classified_dossier": 2,
    "recruitment": 1,
    "chronicle_export": 1,
}


class ForgeFeatureService:
    """Manages consumable feature purchases via atomic PostgreSQL RPCs."""

    @staticmethod
    async def purchase_feature(
        supabase: Client,
        user_id: UUID,
        simulation_id: UUID,
        feature_type: str,
        config: dict | None = None,
    ) -> str:
        """Atomic token deduction + feature purchase record.

        Calls ``fn_purchase_feature`` RPC (migration 104) which handles:
        - Admin / BYOK bypass checks
        - Token balance validation and deduction
        - Purchase record creation

        Returns the purchase UUID as string.
        """
        cost = TOKEN_COSTS.get(feature_type)
        if cost is None:
            raise bad_request(f"Unknown feature type: {feature_type}")

        try:
            resp = await supabase.rpc(
                "fn_purchase_feature",
                {
                    "p_user_id": str(user_id),
                    "p_simulation_id": str(simulation_id),
                    "p_feature_type": feature_type,
                    "p_token_cost": cost,
                    "p_config": config or {},
                },
            ).execute()
        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
            error_msg = str(exc).lower()
            if "insufficient tokens" in error_msg:
                raise HTTPException(
                    status_code=status.HTTP_402_PAYMENT_REQUIRED,
                    detail=str(exc),
                ) from exc
            raise server_error(f"Feature purchase failed: {exc}") from exc

        purchase_id = resp.data
        logger.info(
            "Feature purchased",
            extra={
                "user_id": str(user_id),
                "simulation_id": str(simulation_id),
                "feature_type": feature_type,
                "purchase_id": str(purchase_id),
            },
        )
        return str(purchase_id)

    @staticmethod
    async def complete_feature(
        supabase: Client,
        purchase_id: str,
        result: dict | None = None,
    ) -> None:
        """Mark feature as completed with optional result data."""
        update = {"status": "completed", "completed_at": "now()"}
        if result:
            update["result"] = result  # type: ignore[assignment]
        await supabase.table("feature_purchases").update(update).eq("id", purchase_id).execute()

    @staticmethod
    async def fail_feature(
        supabase: Client,
        purchase_id: str,
        error: str,
    ) -> None:
        """Mark feature as failed and trigger token refund via RPC."""
        try:
            await supabase.rpc("fn_refund_feature", {"p_purchase_id": purchase_id}).execute()
        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
            logger.exception(
                "Refund failed for purchase %s",
                purchase_id,
            )
        # Also store error in result
        await (
            supabase.table("feature_purchases")
            .update(
                {
                    "result": {"error": error},
                }
            )
            .eq("id", purchase_id)
            .execute()
        )

    @staticmethod
    async def get_purchase(supabase: Client, purchase_id: str) -> dict | None:
        """Fetch a single feature purchase by ID."""
        return await maybe_single_data(
            supabase.table("feature_purchases").select("*").eq("id", purchase_id).maybe_single()
        )

    @staticmethod
    async def list_purchases(
        supabase: Client,
        simulation_id: UUID,
        user_id: UUID | None = None,
        feature_type: str | None = None,
    ) -> list[dict]:
        """List feature purchases for a simulation."""
        query = (
            supabase.table("feature_purchases")
            .select("*")
            .eq("simulation_id", str(simulation_id))
            .order("created_at", desc=True)
        )
        if user_id:
            query = query.eq("user_id", str(user_id))
        if feature_type:
            query = query.eq("feature_type", feature_type)
        resp = await query.execute()
        return extract_list(resp)

    @staticmethod
    async def get_active_darkroom(
        supabase: Client,
        simulation_id: UUID,
        user_id: UUID,
    ) -> dict | None:
        """Get the active (completed) Darkroom pass for a simulation, if any."""
        return await maybe_single_data(
            supabase.table("feature_purchases")
            .select("*")
            .eq("simulation_id", str(simulation_id))
            .eq("user_id", str(user_id))
            .eq("feature_type", "darkroom_pass")
            .eq("status", "completed")
            .order("created_at", desc=True)
            .limit(1)
            .maybe_single()
        )

    @staticmethod
    async def use_darkroom_regen(
        supabase: Client,
        purchase_id: str,
    ) -> int:
        """Decrement darkroom regen budget. Returns remaining count."""
        try:
            resp = await supabase.rpc(
                "fn_darkroom_use_regen",
                {
                    "p_purchase_id": purchase_id,
                },
            ).execute()
            return resp.data
        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
            raise bad_request(f"Darkroom regen failed: {exc}") from exc
