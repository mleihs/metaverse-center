"""Service for managing Simulation Forge drafts."""

from __future__ import annotations

import logging
import secrets
import time
from datetime import UTC, datetime, timedelta
from typing import Literal
from uuid import UUID

import httpx
import sentry_sdk
from fastapi import HTTPException, status
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.models.forge import BYOKRecheckResult, ForgeDraftCreate, ForgeDraftUpdate, TestBYOKResult
from backend.utils.db import maybe_single_data
from backend.utils.encryption import current_key_version, decrypt, encrypt
from backend.utils.errors import not_found, server_error
from backend.utils.responses import extract_list
from backend.utils.settings import upsert_platform_setting
from backend.utils.supabase_admin_cache import get_admin_supabase_client
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

#: Keys inside `philosophical_anchor` that the Astrolabe owns and a client
#: update must never drop. See ForgeDraftService.update_draft.
_SERVER_OWNED_ANCHOR_KEYS = frozenset({"scans", "seed"})


# ── Domain Exceptions ────────────────────────────────────────────────
# Services raise these; routers catch and translate to HTTP status codes.
# Keeps business logic free of FastAPI/HTTP coupling.


class WalletNotFoundError(Exception):
    """Raised when the BYOK key RPC could not reach a wallet row.

    Since migration 330 depositing a key CREATES the wallet row when there is
    none — a key belongs to the person, not to the Forge — so this is a
    defensive path, no longer the ordinary answer for a non-architect.
    """

    def __init__(self, detail: str = "Unable to store the API key. Please try again."):
        self.detail = detail
        super().__init__(detail)


class DuplicateRequestError(Exception):
    """Raised when an account already has an open access request."""

    def __init__(self, detail: str = "There is already an open request for this account."):
        self.detail = detail
        super().__init__(detail)


class InvalidProviderError(Exception):
    """Raised when an unknown BYOK provider is specified."""

    def __init__(self, provider: str):
        self.detail = f"Unknown provider: {provider}. Use 'openrouter' or 'replicate'."
        super().__init__(self.detail)


class WalletUnavailableError(Exception):
    """Raised when the wallet RPC fails (database/network issue)."""

    def __init__(self, detail: str = "Unable to retrieve wallet data. Please try again later."):
        self.detail = detail
        super().__init__(detail)


class ForgeDraftService:
    """Service layer for forge draft operations."""

    # Forge state machine: current_phase → set of legal next phases.
    # Terminal states ('completed') have no outgoing edges; 'failed' can
    # restart from 'astrolabe'.
    VALID_PHASE_TRANSITIONS: dict[str, set[str]] = {
        "astrolabe": {"drafting"},
        "drafting": {"darkroom", "astrolabe"},
        "darkroom": {"ignition", "drafting"},
        "ignition": {"completed", "failed", "darkroom"},
        "completed": set(),
        "failed": {"astrolabe"},
    }

    @staticmethod
    def validate_draft_update(data: ForgeDraftUpdate, *, current_phase: str = "astrolabe") -> None:
        """Enforce forge draft business rules before persisting.

        Raises ``HTTPException(422)`` when:
        - A client attempts to set *status* to ``'completed'`` directly
          (only the ignition pipeline may do this).
        - A *current_phase* transition violates the forge state machine.
        """
        if data.status == "completed":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Status 'completed' can only be set by the ignition process.",
            )

        if data.current_phase is not None:
            allowed = ForgeDraftService.VALID_PHASE_TRANSITIONS.get(current_phase, set())
            if data.current_phase not in allowed:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"Cannot transition from '{current_phase}' to '{data.current_phase}'.",
                )

    @staticmethod
    async def list_drafts(
        supabase: Client,
        user_id: UUID,
        limit: int = 10,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """List forge drafts for a user."""
        response = await (
            supabase.table("forge_drafts")
            .select("*", count="exact")
            .eq("user_id", str(user_id))
            .order("updated_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return extract_list(response), response.count or 0

    @staticmethod
    async def get_draft(
        supabase: Client,
        user_id: UUID,
        draft_id: UUID,
    ) -> dict:
        """Get a single draft by ID."""
        # maybe_single, not single: `.single()` raises PGRST116 ("Cannot coerce
        # the result to a single JSON object") when nothing matches, so the
        # not_found below was unreachable and a stale draft id — a deleted
        # draft, an old tab — surfaced as a 500 instead of a 404.
        data = await maybe_single_data(
            supabase.table("forge_drafts")
            .select("*")
            .eq("id", str(draft_id))
            .eq("user_id", str(user_id))
            .maybe_single()
        )
        if not data:
            raise not_found("forge_draft", draft_id)
        return data

    @staticmethod
    async def get_latest_completed_source(supabase: Client) -> dict | None:
        """Source data of the most recently completed draft, or None.

        Narrow column set on purpose: callers (lore regeneration) only need
        the generation inputs, not image URLs or status bookkeeping.
        """
        response = await (
            supabase.table("forge_drafts")
            .select("seed_prompt, philosophical_anchor, geography, agents, buildings, research_context")
            .eq("status", "completed")
            .order("updated_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = extract_list(response)
        return rows[0] if rows else None

    @staticmethod
    async def create_draft(
        supabase: Client,
        user_id: UUID,
        data: ForgeDraftCreate,
    ) -> dict:
        """Initialize a new forge draft.

        Note: Architect permission is enforced by the ``require_architect()``
        dependency in the router layer — no duplicate check needed here.
        """
        insert_data = {
            "user_id": str(user_id),
            "seed_prompt": data.seed_prompt,
            "current_phase": "astrolabe",
            "status": "draft",
        }
        response = await supabase.table("forge_drafts").insert(insert_data).execute()
        if not response.data:
            raise server_error("Failed to create forge draft.")
        return response.data[0]

    @staticmethod
    async def update_draft(
        supabase: Client,
        user_id: UUID,
        draft_id: UUID,
        data: ForgeDraftUpdate,
    ) -> dict:
        """Update draft state."""
        update_data = data.model_dump(exclude_unset=True)
        if not update_data:
            return await ForgeDraftService.get_draft(supabase, user_id, draft_id)

        # `philosophical_anchor` is one JSON column with two owners: the client
        # writes `selected`, the Astrolabe writes `options` and the reading
        # budget (`scans` / `seed`). A column update replaces the whole value,
        # so a client that sends only the fields it cares about erases the rest
        # — which is exactly what happened: choosing an anchor dropped the
        # budget and handed the user three fresh readings. The client no longer
        # does that, but the server must not depend on every client getting it
        # right, so the keys it owns are carried across.
        anchor = update_data.get("philosophical_anchor")
        if isinstance(anchor, dict) and not _SERVER_OWNED_ANCHOR_KEYS <= anchor.keys():
            existing = await ForgeDraftService.get_draft(supabase, user_id, draft_id)
            previous = existing.get("philosophical_anchor") or {}
            for key in _SERVER_OWNED_ANCHOR_KEYS - anchor.keys():
                if key in previous:
                    anchor[key] = previous[key]

        response = await (
            supabase.table("forge_drafts")
            .update(update_data)
            .eq("id", str(draft_id))
            .eq("user_id", str(user_id))
            .execute()
        )
        if not response.data:
            raise not_found("forge_draft", draft_id)
        return response.data[0]

    @staticmethod
    async def append_entity(
        supabase: Client,
        user_id: UUID,
        draft_id: UUID,
        entity_type: str,
        entity: dict,
    ) -> dict:
        """Append a single entity to the draft's agent/building array.

        Safe because writes are user-sequential (frontend drives the loop)
        and RLS-gated by ``user_id``.
        """
        draft = await ForgeDraftService.get_draft(supabase, user_id, draft_id)
        current_list = draft.get(entity_type, [])
        current_list.append(entity)
        return await ForgeDraftService.update_draft(
            supabase, user_id, draft_id, ForgeDraftUpdate(**{entity_type: current_list})
        )

    @staticmethod
    async def delete_draft(
        supabase: Client,
        user_id: UUID,
        draft_id: UUID,
    ) -> dict:
        """Permanently delete a forge draft."""
        response = await (
            supabase.table("forge_drafts").delete().eq("id", str(draft_id)).eq("user_id", str(user_id)).execute()
        )
        if not response.data:
            raise not_found("forge_draft", draft_id)
        return response.data[0]

    @staticmethod
    async def get_user_keys(user_id: UUID) -> tuple[str | None, str | None]:
        """Fetch and decrypt a user's personal API keys.

        Returns (openrouter_key, replicate_key) — None where none is stored.

        TAKES NO CLIENT, deliberately. Since migration 333 the ciphertext lives
        in ``user_api_keys``, which carries no policy for ``authenticated`` at
        all: only ``service_role`` can read it. A parameter would let a caller
        hand in the user-scoped client, and RLS would answer with an empty
        result rather than an error — the keys would silently look absent and
        every call would quietly fall back to the platform key. A wrong answer
        that looks like a legitimate one is worse than no parameter, so the
        admin singleton is fetched here and there is nothing to get wrong.

        Three call sites used to do this by hand — this one,
        ``ForgeThemeService.generate_variants`` and
        ``HeartbeatService._resolve_autonomy_key`` — each with its own select
        and its own ``decrypt``. They now all come through here.

        Returns nothing when the platform has withdrawn permission, whether per
        user or platform-wide: the RPC checks ``fn_user_byok_allowed`` before
        it hands anything back, so a revoked account falls back to the project
        key on the very next call.
        """
        admin = await get_admin_supabase_client()
        # `fn_get_user_api_keys` weighs the policy inside the same query that
        # reads the ciphertext (finding 6). A separate check here would be a
        # line to forget at the next call site — and forgetting it is exactly
        # what happened: revoking `byok_allowed` used to close the door in
        # front of a key that went on being used behind it.
        resp = await admin.rpc("fn_get_user_api_keys", {"p_user_id": str(user_id)}).execute()
        by_provider: dict[str, str] = resp.data or {}

        decrypted_or = decrypt(by_provider["openrouter"]) if by_provider.get("openrouter") else None
        decrypted_rep = decrypt(by_provider["replicate"]) if by_provider.get("replicate") else None

        if decrypted_or:
            logger.debug("Using personal OpenRouter key for user %s", user_id)
        if decrypted_rep:
            logger.debug("Using personal Replicate key for user %s", user_id)

        if by_provider:
            await ForgeDraftService._touch_last_used(admin, user_id)

        return decrypted_or, decrypted_rep

    #: How stale ``last_used_at`` may get before it is stamped again. The
    #: question the column answers is "is this key still in use", which needs
    #: hours, not seconds — and a write on every model call would be one extra
    #: round-trip per generated entity.
    _LAST_USED_STALE_AFTER = timedelta(hours=1)

    @staticmethod
    async def _touch_last_used(admin: Client, user_id: UUID) -> None:
        """Stamp ``last_used_at`` when it is stale, in ONE statement.

        Not a fetch-compute-update: the freshness test is part of the filter
        (ADR-007). Failure is swallowed — a bookkeeping timestamp must never
        take down a generation run that already has its key.
        """
        cutoff = (datetime.now(UTC) - ForgeDraftService._LAST_USED_STALE_AFTER).isoformat()
        try:
            await (
                admin.table("user_api_keys")
                .update({"last_used_at": datetime.now(UTC).isoformat()})
                .eq("user_id", str(user_id))
                .or_(f"last_used_at.is.null,last_used_at.lt.{cutoff}")
                .execute()
            )
        except (PostgrestAPIError, httpx.HTTPError) as exc:
            logger.debug("last_used_at stamp failed (non-blocking)", exc_info=exc)

    @staticmethod
    async def check_byok_allowed(supabase: Client, user_id: UUID, *, is_admin: bool = False) -> bool:
        """Check whether a user may use a personal API key (BYOK).

        BYOK is a MODE, not a rule: whoever deposits no key keeps running on
        the platform key. This answers only "may this person deposit and use
        one", which the platform governs on two levels — ``byok_access_policy``
        (``none`` / ``all`` / ``per_user``) and, under ``per_user``, the
        ``byok_allowed`` flag on the wallet row. Both live in
        ``fn_user_byok_allowed``.

        ``is_admin`` is the one thing SQL cannot answer here. The platform
        admin check is the 3-tier Python one (email allowlist → cached DB ids
        → refresh, see ``backend/dependencies.is_platform_admin``); the SQL
        ``is_platform_admin()`` reads ``auth.uid()``, which is NULL on the
        service-role client an admin request carries. Whoever SETS the policy
        must not be locked out by it, so the caller passes the answer in.
        """
        if is_admin:
            return True
        resp = await supabase.rpc("fn_user_byok_allowed", {"p_user_id": str(user_id)}).execute()
        return bool(resp.data)

    @staticmethod
    async def update_user_keys(
        supabase: Client,
        user_id: UUID,
        openrouter_key: str | None,
        replicate_key: str | None,
    ) -> dict:
        """Store the caller's own API keys, one row per provider.

        ``supabase`` MUST be the user-JWT client (``get_supabase``), never the
        effective/admin one. ``fn_set_user_api_key`` (migration 333) takes NO
        user id at all — it writes for ``auth.uid()``, which is the strongest
        form of the self-validating exception in ADR-006 and the one shape in
        which the bug this replaces cannot be written down: a service-role JWT
        carries no ``sub``, so ``auth.uid()`` is NULL and the function refuses
        outright instead of writing somewhere wrong.

        ``user_id`` is kept for the audit trail and for the assertion below; it
        is not sent to the database.
        """
        writes = [
            ("openrouter", openrouter_key),
            ("replicate", replicate_key),
        ]
        written = [provider for provider, value in writes if value]
        if not written:
            return {"message": "No keys updated."}

        version = current_key_version()
        for provider, value in writes:
            if not value:
                continue
            resp = await supabase.rpc(
                "fn_set_user_api_key",
                {
                    "p_provider": provider,
                    "p_encrypted_key": encrypt(value),
                    "p_key_version": version,
                    # Four characters so a card can show WHICH key is on file.
                    # A person with two accounts at one provider could not tell
                    # them apart before, and a key withdrawn at the provider
                    # looked exactly like a working one. Not a secret: nothing
                    # follows from four characters of a ~73-character key.
                    "p_last4": value[-4:],
                },
            ).execute()
            if not (resp.data or {}).get("success"):
                raise WalletNotFoundError()

        logger.info("Stored personal API keys for user %s: %s", user_id, ", ".join(written))
        return {"message": "Keys updated successfully."}

    @staticmethod
    async def clear_user_key(
        supabase: Client,
        user_id: UUID,
        provider: str,
    ) -> dict:
        """Remove one personal API key.

        Deletes the row rather than nulling a column (migration 333). Revoking
        now means the key is gone, not merely unreachable — see finding 6:
        clearing ``byok_allowed`` never removed anything, it only closed the
        door in front of a key that stayed on file and stayed in use.

        ``supabase`` must be the user-JWT client for the same reason as
        ``update_user_keys``.
        """
        if provider not in ("openrouter", "replicate"):
            raise InvalidProviderError(provider)

        resp = await supabase.rpc("fn_clear_user_api_key", {"p_provider": provider}).execute()
        if not (resp.data or {}).get("success"):
            raise WalletNotFoundError()

        logger.info("Removed personal %s key for user %s", provider, user_id)
        return {"message": f"{provider} key removed successfully."}

    @staticmethod
    async def mark_key_verified(supabase: Client, user_id: UUID, provider: str, tested_key: str) -> bool:
        """Stamp ``last_verified_at`` when the key just tested IS the stored one.

        Verification is only worth recording about the key the platform will
        actually use. The test endpoint accepts a raw key that may never have
        been stored — pasting a colleague's key into the field and getting a
        green tick says nothing about this account — so the stored ciphertext
        is decrypted and compared first. ``supabase`` is the user-JWT client:
        ``fn_mark_user_api_key_verified`` stamps for ``auth.uid()``.

        Returns whether a stamp was written. Never raises: a timestamp must not
        turn a successful key test into an error.
        """
        try:
            stored_or, stored_rep = await ForgeDraftService.get_user_keys(user_id)
            stored = stored_or if provider == "openrouter" else stored_rep
            if not stored or not secrets.compare_digest(stored, tested_key):
                return False
            resp = await supabase.rpc("fn_mark_user_api_key_verified", {"p_provider": provider}).execute()
            return bool((resp.data or {}).get("success"))
        except (PostgrestAPIError, httpx.HTTPError, ValueError) as exc:
            logger.debug("Could not stamp last_verified_at", exc_info=exc)
            return False

    @staticmethod
    async def recheck_stored_key(supabase: Client, user_id: UUID, provider: str) -> BYOKRecheckResult:
        """Ask the provider whether the key ON FILE still works.

        ``last_verified_at`` could only ever be stamped by someone typing the
        same key in again (migration 333), which answers the wrong question:
        what matters is whether the STORED key still carries. The server holds
        the plaintext, so it can simply ask — and that is the whole difference
        between "configured" and "works".

        ``supabase`` is the user-JWT client: the stamp goes through
        ``fn_mark_user_api_key_verified``, which writes for ``auth.uid()``.
        """
        if provider not in ("openrouter", "replicate"):
            raise InvalidProviderError(provider)

        or_key, rep_key = await ForgeDraftService.get_user_keys(user_id)
        stored = or_key if provider == "openrouter" else rep_key
        if not stored:
            return BYOKRecheckResult(
                valid=False,
                detail="No key on file for this provider.",
                had_key=False,
            )

        result = await ForgeDraftService.test_provider_key(provider, stored)
        if result.valid:
            await supabase.rpc("fn_mark_user_api_key_verified", {"p_provider": provider}).execute()

        return BYOKRecheckResult(valid=result.valid, detail=result.detail, response_ms=result.response_ms)

    @staticmethod
    async def create_byok_request(supabase: Client, user_id: UUID, reason: str | None) -> dict:
        """File an access request. One open request per account (unique index).

        The policy shipped as ``per_user`` with nobody granted, which made this
        a door without a handle for every account on production: no form, no
        hint, no way to ask. This is the handle.
        """
        try:
            resp = await supabase.table("byok_requests").insert({"user_id": str(user_id), "reason": reason}).execute()
        except PostgrestAPIError as exc:
            # 23505 = unique_violation on idx_byok_requests_one_pending.
            if getattr(exc, "code", None) == "23505":
                raise DuplicateRequestError() from exc
            raise
        rows = extract_list(resp)
        return rows[0] if rows else {}

    @staticmethod
    async def byok_admin_stats(admin_supabase: Client) -> dict:
        """Four numbers the admin needs before deciding anything.

        Deliberately NOT „how many keys are stored" alone. The interesting
        gap is between allowed and actually working: an account that may use
        a personal key and never stored one still runs on the project key, and
        one whose key has not been confirmed for months may already be dead
        without anyone noticing. The last number is the one that is easy to
        misread, so it says whose money it is: these costs sit on USER
        accounts, not on the platform's budget (migration 332 keeps them out
        of the cap for exactly that reason).
        """
        resp = await admin_supabase.rpc("fn_byok_admin_stats", {}).execute()
        return resp.data or {
            "allowed_accounts": 0,
            "with_confirmed_key": 0,
            "stale_keys": 0,
            "stale_after_days": 90,
            "user_paid_usd_30d": 0.0,
            "open_requests": 0,
        }

    @staticmethod
    async def update_byok_stale_days(admin_supabase: Client, days: int, admin_id: UUID) -> dict:
        """How long a stored key may go unconfirmed before it carries a notice."""
        await upsert_platform_setting(admin_supabase, "byok_stale_days", days, updated_by_id=admin_id)
        return {"byok_stale_days": days}

    @staticmethod
    async def list_byok_requests(admin_supabase: Client, status: str = "pending") -> list[dict]:
        """The admin inbox: requests waiting for a decision, oldest first."""
        resp = await (
            admin_supabase.table("byok_requests")
            .select("*")
            .eq("status", status)
            .order("created_at", desc=False)
            .execute()
        )
        return extract_list(resp)

    @staticmethod
    async def resolve_byok_request(
        admin_supabase: Client,
        request_id: UUID,
        *,
        approve: bool,
        reviewer_id: UUID,
        admin_notes: str | None = None,
    ) -> dict:
        """Decide one request — status AND permission in one transaction.

        Split into two writes there would be a state "approved but not
        enabled", which is the shape of half-repair nobody finds afterwards.
        ``fn_resolve_byok_request`` (migration 335) does both or neither.
        """
        resp = await admin_supabase.rpc(
            "fn_resolve_byok_request",
            {
                "p_request_id": str(request_id),
                "p_approve": approve,
                "p_reviewer_id": str(reviewer_id),
                "p_admin_notes": admin_notes,
            },
        ).execute()
        result = resp.data or {}
        if not result.get("success"):
            raise not_found("byok_request", request_id)
        return result

    @staticmethod
    async def test_provider_key(provider: str, key: str) -> TestBYOKResult:
        """Test a BYOK API key against its provider without storing it.

        Makes a lightweight authenticated GET to verify the key:
        - OpenRouter: GET /api/v1/auth/key (returns key metadata on 200)
        - Replicate: GET /v1/account (returns account info on 200)
        """
        provider_urls = {
            "openrouter": "https://openrouter.ai/api/v1/auth/key",
            "replicate": "https://api.replicate.com/v1/account",
        }
        url = provider_urls.get(provider)
        if url is None:
            raise InvalidProviderError(provider)

        start = time.monotonic()
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url, headers={"Authorization": f"Bearer {key}"})
            elapsed_ms = int((time.monotonic() - start) * 1000)

            if resp.status_code == 200:
                return TestBYOKResult(valid=True, detail="Key verified successfully.", response_ms=elapsed_ms)
            if resp.status_code == 401:
                return TestBYOKResult(valid=False, detail="Invalid or expired API key.", response_ms=elapsed_ms)
            if resp.status_code == 403:
                return TestBYOKResult(valid=False, detail="Key lacks required permissions.", response_ms=elapsed_ms)
            return TestBYOKResult(
                valid=False,
                detail=f"Provider returned status {resp.status_code}.",
                response_ms=elapsed_ms,
            )
        except httpx.TimeoutException:
            return TestBYOKResult(valid=False, detail="Provider did not respond within 10 seconds.")
        except httpx.ConnectError:
            return TestBYOKResult(valid=False, detail="Could not connect to provider.")
        except Exception:
            logger.exception("Unexpected error testing BYOK key for provider=%s", provider)
            return TestBYOKResult(valid=False, detail="Unexpected error during key verification.")

    @staticmethod
    async def get_wallet(supabase: Client, user_id: UUID, *, is_admin: bool = False) -> dict:
        """Get the current user's forge wallet (includes account_tier and BYOK status).

        Uses a single composite RPC (fn_get_wallet_summary, migration 108,
        widened in 330) that consolidates the wallet query, BYOK policy checks,
        and platform settings into one DB round-trip.

        ``is_admin`` carries the same override as ``check_byok_allowed``, and
        for the same reason it must be applied HERE rather than only at the
        write endpoint: ``byok_status.byok_allowed`` is what the frontend hides
        the key form behind. An admin who may save a key but is told they may
        not gets a form that never appears — the exact shape of the bug this
        replaces, only inverted.
        """
        _default: dict = {
            "forge_tokens": 0,
            "is_architect": False,
            "account_tier": "observer",
            "byok_status": {
                "has_openrouter_key": False,
                "has_replicate_key": False,
                "byok_allowed": False,
                "byok_bypass": False,
                "system_bypass_enabled": False,
                "effective_bypass": False,
                "access_policy": "per_user",
            },
        }
        try:
            resp = await supabase.rpc("fn_get_wallet_summary", {"p_user_id": str(user_id)}).execute()
            summary = resp.data or _default
            if is_admin and isinstance(summary.get("byok_status"), dict):
                summary["byok_status"]["byok_allowed"] = True
            return summary
        except (PostgrestAPIError, httpx.HTTPError) as exc:
            logger.exception("fn_get_wallet_summary RPC failed")
            sentry_sdk.capture_exception(exc)
            raise WalletUnavailableError() from exc

    @staticmethod
    async def list_bundles(supabase: Client) -> list[dict]:
        """Fetch active token bundles, ordered by sort_order.

        Reads from ``token_bundles`` table (migration 101).
        """
        resp = await (
            supabase.table("token_bundles")
            .select("id, slug, display_name, tokens, price_cents, savings_pct, sort_order")
            .eq("is_active", True)
            .order("sort_order")
            .execute()
        )
        return extract_list(resp)

    @staticmethod
    async def purchase_tokens(supabase: Client, bundle_slug: str) -> dict:
        """Execute mock purchase via ``fn_purchase_tokens`` RPC (migration 101)."""
        resp = await supabase.rpc("fn_purchase_tokens", {"p_bundle_slug": bundle_slug}).execute()
        return resp.data

    @staticmethod
    async def get_purchase_history(
        supabase: Client,
        user_id: UUID,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """Fetch user's token purchase ledger, most recent first."""
        resp = await (
            supabase.table("token_purchases")
            .select("*", count="exact")
            .eq("user_id", str(user_id))
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return extract_list(resp), resp.count or 0

    @staticmethod
    async def get_token_economy_stats(admin_supabase: Client) -> dict:
        """Aggregated token economy stats via ``token_economy_stats`` view (migration 102)."""
        resp = await admin_supabase.table("token_economy_stats").select("*").single().execute()
        return resp.data

    @staticmethod
    async def admin_grant_tokens(
        admin_supabase: Client,
        user_id: UUID,
        tokens: int,
        reason: str | None,
    ) -> dict:
        """Admin token grant via ``fn_admin_grant_tokens`` RPC (migration 102)."""
        resp = await admin_supabase.rpc(
            "fn_admin_grant_tokens",
            {
                "p_user_id": str(user_id),
                "p_tokens": tokens,
                "p_reason": reason,
            },
        ).execute()
        return resp.data

    @staticmethod
    async def admin_list_purchases(
        admin_supabase: Client,
        limit: int = 50,
        offset: int = 0,
        payment_method: str | None = None,
    ) -> tuple[list[dict], int]:
        """Admin: fetch all purchases with bundle slug join, most recent first."""
        query = (
            admin_supabase.table("token_purchases")
            .select("*, token_bundles(slug)", count="exact")
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
        )
        if payment_method:
            query = query.eq("payment_method", payment_method)
        resp = await query.execute()
        return extract_list(resp), resp.count or 0

    @staticmethod
    async def admin_update_bundle(
        admin_supabase: Client,
        bundle_id: UUID,
        updates: dict,
    ) -> dict:
        """Admin: update bundle pricing/availability."""
        resp = await admin_supabase.table("token_bundles").update(updates).eq("id", str(bundle_id)).execute()
        return resp.data[0] if resp.data else {}

    @staticmethod
    async def admin_list_all_bundles(admin_supabase: Client) -> list[dict]:
        """Admin: fetch ALL bundles including inactive. Uses admin client to bypass RLS."""
        resp = await admin_supabase.table("token_bundles").select("*").order("sort_order").execute()
        return extract_list(resp)

    @staticmethod
    async def get_admin_stats(admin_supabase: Client) -> dict:
        """Get global forge statistics (admin only).

        Uses ``token_economy_stats`` view for token aggregation (server-side SUM)
        instead of fetching all wallet rows and summing in Python.
        """
        drafts_resp = await (
            admin_supabase.table("forge_drafts")
            .select("id", count="exact")
            .in_("status", ["draft", "processing"])
            .execute()
        )
        active_drafts = drafts_resp.count or 0

        # Server-side aggregation via the token_economy_stats view (migration 102)
        economy_resp = await (
            admin_supabase.table("token_economy_stats").select("tokens_in_circulation").single().execute()
        )
        total_tokens = int(economy_resp.data.get("tokens_in_circulation", 0)) if economy_resp.data else 0

        materialized_resp = await (
            admin_supabase.table("forge_drafts").select("id", count="exact").eq("status", "completed").execute()
        )
        total_materialized = materialized_resp.count or 0

        return {
            "active_drafts": active_drafts,
            "total_tokens": total_tokens,
            "total_materialized": total_materialized,
        }

    # ── BYOK Settings (Admin) ────────────────────────────────────────────

    @staticmethod
    async def get_byok_system_settings(admin_supabase: Client) -> dict:
        """Get all BYOK-related platform settings (admin only)."""
        resp = await (
            admin_supabase.table("platform_settings")
            .select("setting_key, setting_value")
            .in_("setting_key", ["byok_bypass_enabled", "byok_access_policy"])
            .execute()
        )
        result: dict = {"byok_bypass_enabled": False, "byok_access_policy": "per_user"}
        for row in extract_list(resp):
            if row["setting_key"] == "byok_bypass_enabled":
                val = row.get("setting_value")
                result["byok_bypass_enabled"] = val is True or val == "true"
            elif row["setting_key"] == "byok_access_policy":
                val = row.get("setting_value")
                result["byok_access_policy"] = val if isinstance(val, str) else "per_user"
        return result

    @staticmethod
    async def update_byok_bypass_setting(
        admin_supabase: Client,
        enabled: bool,
        admin_id: UUID,
    ) -> dict:
        """Toggle system-wide BYOK bypass (admin only)."""
        await upsert_platform_setting(
            admin_supabase,
            "byok_bypass_enabled",
            enabled,
            updated_by_id=admin_id,
        )
        return {"byok_bypass_enabled": enabled}

    @staticmethod
    async def update_byok_access_policy(
        admin_supabase: Client,
        policy: str,
        admin_id: UUID,
    ) -> dict:
        """Set global BYOK access policy: 'none', 'all', or 'per_user' (admin only)."""
        await upsert_platform_setting(
            admin_supabase,
            "byok_access_policy",
            policy,
            updated_by_id=admin_id,
        )
        return {"byok_access_policy": policy}

    @staticmethod
    async def _set_wallet_flag(
        admin_supabase: Client,
        target_user_id: UUID,
        column: Literal["byok_bypass", "byok_allowed"],
        enabled: bool,
    ) -> None:
        """Set one per-user BYOK flag, creating the wallet row if absent.

        An UPDATE was the original shape and it was silently unreachable: on
        production only four wallet rows exist, all architects, so granting
        BYOK to anyone else answered 404 — the admin could not open the door
        for the very people the ``per_user`` policy exists for. The wallet row
        is platform-wide metadata about a person (migr. 055), not an architect
        badge: it is created with ``account_tier = 'observer'`` and the
        ``trg_sync_architect_flag`` trigger derives ``is_architect = false``,
        so creating one grants no Forge privilege whatsoever.
        """
        await (
            admin_supabase.table("user_wallets")
            .upsert({"user_id": str(target_user_id), column: enabled}, on_conflict="user_id")
            .execute()
        )

    @staticmethod
    async def update_user_byok_bypass(
        admin_supabase: Client,
        target_user_id: UUID,
        enabled: bool,
    ) -> dict:
        """Toggle per-user BYOK bypass — the token waiver — for one user (admin only)."""
        await ForgeDraftService._set_wallet_flag(admin_supabase, target_user_id, "byok_bypass", enabled)
        return {"user_id": str(target_user_id), "byok_bypass": enabled}

    @staticmethod
    async def update_user_byok_allowed(
        admin_supabase: Client,
        target_user_id: UUID,
        enabled: bool,
    ) -> dict:
        """Grant or revoke BYOK access for a specific user (admin only)."""
        await ForgeDraftService._set_wallet_flag(admin_supabase, target_user_id, "byok_allowed", enabled)
        return {"user_id": str(target_user_id), "byok_allowed": enabled}

    @staticmethod
    async def purge_stale_drafts(admin_supabase: Client, cutoff_iso: str) -> int:
        """Purge stale drafts older than the given cutoff date."""
        response = await (
            admin_supabase.table("forge_drafts")
            .delete()
            .in_("status", ["draft", "failed"])
            .lt("updated_at", cutoff_iso)
            .execute()
        )
        return len(response.data) if response.data else 0
