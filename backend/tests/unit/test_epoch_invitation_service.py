"""Unit tests for EpochInvitationService — acceptance, revocation, and logging."""

import logging
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

from backend.services.epoch_invitation_service import EpochInvitationService
from backend.tests.conftest import make_chain_mock
from backend.utils.errors import not_found

# ── Helpers ────────────────────────────────────────────────────

EPOCH_ID = uuid4()
USER_ID = uuid4()
INVITATION_ID = uuid4()


# ── Tests ─────────────────────────────────────────────────────


class TestMarkAccepted:
    @pytest.mark.asyncio
    async def test_mark_accepted_logs_info(self, caplog):
        """Successful acceptance should log INFO with epoch_id and user_id."""
        sb = MagicMock()

        inv_data = {
            "id": str(INVITATION_ID),
            "epoch_id": str(EPOCH_ID),
            "status": "pending",
            "expires_at": "2099-12-31T00:00:00+00:00",
        }
        accepted_data = {**inv_data, "status": "accepted", "accepted_by_id": str(USER_ID)}

        # Fetch invitation chain
        fetch_chain = make_chain_mock(execute_data=[inv_data])
        # Update chain
        update_chain = make_chain_mock(execute_data=[accepted_data])

        call_count = {"epoch_invitations": 0}

        def table_router(name):
            call_count["epoch_invitations"] += 1
            if call_count["epoch_invitations"] == 1:
                return fetch_chain
            return update_chain

        sb.table.side_effect = table_router

        with caplog.at_level(logging.INFO, logger="backend.services.epoch_invitation_service"):
            result = await EpochInvitationService.mark_accepted(sb, "test-token", USER_ID)

        assert result["status"] == "accepted"
        info_records = [r for r in caplog.records if r.levelno == logging.INFO and "accepted" in r.message.lower()]
        assert len(info_records) >= 1
        record = info_records[0]
        assert record.epoch_id == str(EPOCH_ID)
        assert record.user_id == str(USER_ID)


class TestRevokeInvitation:
    @pytest.mark.asyncio
    async def test_revoke_invitation_logs_info(self, caplog):
        """Successful revocation should log INFO with invitation_id."""
        sb = MagicMock()
        revoked_data = {"id": str(INVITATION_ID), "status": "revoked"}
        chain = make_chain_mock(execute_data=[revoked_data])
        sb.table.return_value = chain

        with caplog.at_level(logging.INFO, logger="backend.services.epoch_invitation_service"):
            result = await EpochInvitationService.revoke_invitation(sb, INVITATION_ID)

        assert result["status"] == "revoked"
        info_records = [r for r in caplog.records if r.levelno == logging.INFO and "revoked" in r.message.lower()]
        assert len(info_records) >= 1
        assert info_records[0].invitation_id == str(INVITATION_ID)


class TestMarkAcceptedExpired:
    @pytest.mark.asyncio
    async def test_mark_accepted_expired_raises_410(self):
        """Expired invitation should raise HTTPException 410."""
        sb = MagicMock()

        inv_data = {
            "id": str(INVITATION_ID),
            "epoch_id": str(EPOCH_ID),
            "status": "pending",
            "expires_at": "2020-01-01T00:00:00+00:00",  # Already expired
        }

        fetch_chain = make_chain_mock(execute_data=[inv_data])
        sb.table.return_value = fetch_chain

        with pytest.raises(HTTPException) as exc_info:
            await EpochInvitationService.mark_accepted(sb, "expired-token", USER_ID)
        assert exc_info.value.status_code == 410


# ── The accept endpoint ───────────────────────────────────────────────────
#
# Finding E2. `mark_accepted` had existed since the invitation system was built
# and had NO CALLER: no endpoint, and an accept view that navigated to the epoch
# LIST because no epoch id was ever fetched. Every invitation ever sent would
# have stayed `pending`, the token would never be consumed, and the sender would
# never learn who came.


class TestAcceptEndpointExists:
    """The door, not just the room behind it.

    A service method with no route is the same defect as a route with no caller,
    and neither shows up in a test of the service alone — which is exactly why
    this one survived: `mark_accepted` has had unit tests all along.
    """

    def test_the_route_is_registered(self):
        """Asserted against the OpenAPI surface, not ``app.routes``.

        FastAPI groups included routers into opaque ``_IncludedRouter`` entries,
        so walking ``app.routes`` finds no application path at all and a test
        written that way would fail for the wrong reason — or, worse, pass
        vacuously if it only checked that the list was non-empty.
        """
        from backend.app import app

        paths = app.openapi()["paths"]
        assert "/api/v1/epoch-invitations/{token}/accept" in paths
        assert "post" in paths["/api/v1/epoch-invitations/{token}/accept"]

    @pytest.mark.asyncio
    async def test_accepting_returns_the_epoch_to_open(self):
        from backend.routers.epoch_invitations import accept_invitation

        invitation = {"id": "inv-1", "epoch_id": str(uuid4())}
        with (
            patch.object(
                EpochInvitationService, "mark_accepted", new=AsyncMock(return_value=invitation)
            ) as marked,
            patch("backend.routers.epoch_invitations.AuditService.safe_log", new=AsyncMock()) as audit,
        ):
            response = await accept_invitation.__wrapped__(
                request=MagicMock(),
                token="tok",
                user=MagicMock(id=USER_ID),
                admin_supabase=MagicMock(),
            )

        assert response.data == {"epoch_id": invitation["epoch_id"]}
        assert marked.await_args.args[1] == "tok"
        audit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_a_second_acceptance_is_refused(self):
        """`mark_accepted` filters on status='pending', so the token is spent."""
        from backend.routers.epoch_invitations import accept_invitation

        with patch.object(
            EpochInvitationService,
            "mark_accepted",
            new=AsyncMock(side_effect=not_found(detail="Invitation not found or already used.")),
        ):
            with pytest.raises(HTTPException) as exc:
                await accept_invitation.__wrapped__(
                    request=MagicMock(),
                    token="tok",
                    user=MagicMock(id=USER_ID),
                    admin_supabase=MagicMock(),
                )

        assert exc.value.status_code == 404
