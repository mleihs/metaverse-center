"""Unit tests for InvitationService — CRUD operations and logging verification."""

import logging
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from backend.services.invitation_service import InvitationService
from backend.tests.conftest import make_chain_mock

# ── Helpers ────────────────────────────────────────────────────

SIM_ID = uuid4()
USER_ID = uuid4()
INVITER_ID = uuid4()


# ── Tests ─────────────────────────────────────────────────────


class TestInvitationCreate:
    @pytest.mark.asyncio
    async def test_create_invitation_logs_info(self, caplog):
        """Successful creation should log INFO with simulation_id and invited_role."""
        sb = MagicMock()
        inv_row = {"id": str(uuid4()), "simulation_id": str(SIM_ID), "invited_role": "editor"}
        chain = make_chain_mock(execute_data=[inv_row])
        sb.table.return_value = chain

        with caplog.at_level(logging.INFO, logger="backend.services.invitation_service"):
            result = await InvitationService.create_invitation(
                sb,
                SIM_ID,
                INVITER_ID,
                invited_role="editor",
            )

        assert result == inv_row
        info_records = [r for r in caplog.records if r.levelno == logging.INFO and "created" in r.message.lower()]
        assert len(info_records) >= 1
        record = info_records[0]
        assert record.simulation_id == str(SIM_ID)
        assert record.invited_role == "editor"


class TestInvitationAccept:
    @pytest.mark.asyncio
    async def test_accept_invitation_logs_info(self, caplog):
        """Successful acceptance should log INFO with simulation_id and user_id."""
        sb = MagicMock()

        inv_data = {
            "id": str(uuid4()),
            "simulation_id": str(SIM_ID),
            "invited_role": "viewer",
            "invited_by_id": str(INVITER_ID),
            "expires_at": "2099-12-31T00:00:00+00:00",
        }
        member_row = {"id": str(uuid4()), "simulation_id": str(SIM_ID), "user_id": str(USER_ID)}

        # Invitation fetch chain
        inv_chain = make_chain_mock(execute_data=[inv_data])
        # Member insert chain
        member_chain = make_chain_mock(execute_data=[member_row])
        # Invitation update chain
        update_chain = make_chain_mock(execute_data=[inv_data])

        call_count = {"simulation_invitations": 0, "simulation_members": 0}

        def table_router(name):
            if name == "simulation_invitations":
                call_count["simulation_invitations"] += 1
                if call_count["simulation_invitations"] == 1:
                    return inv_chain
                return update_chain
            if name == "simulation_members":
                return member_chain
            return make_chain_mock()

        sb.table.side_effect = table_router

        with caplog.at_level(logging.INFO, logger="backend.services.invitation_service"):
            result = await InvitationService.accept_invitation(sb, "test-token", USER_ID)

        assert result == member_row
        info_records = [r for r in caplog.records if r.levelno == logging.INFO and "accepted" in r.message.lower()]
        assert len(info_records) >= 1
        record = info_records[0]
        assert record.simulation_id == str(SIM_ID)
        assert record.user_id == str(USER_ID)


class TestInvitationExpired:
    @pytest.mark.asyncio
    async def test_expired_invitation_logs_info(self, caplog):
        """Expired invitation should log INFO with simulation_id before raising 410."""
        sb = MagicMock()

        inv_data = {
            "id": str(uuid4()),
            "simulation_id": str(SIM_ID),
            "invited_role": "viewer",
            "invited_by_id": str(INVITER_ID),
            "expires_at": "2020-01-01T00:00:00+00:00",  # Already expired
        }

        inv_chain = make_chain_mock(execute_data=[inv_data])
        sb.table.return_value = inv_chain

        with caplog.at_level(logging.INFO, logger="backend.services.invitation_service"):
            with pytest.raises(HTTPException) as exc_info:
                await InvitationService.accept_invitation(sb, "expired-token", USER_ID)
            assert exc_info.value.status_code == 410

        info_records = [r for r in caplog.records if r.levelno == logging.INFO and "expired" in r.message.lower()]
        assert len(info_records) >= 1
        assert info_records[0].simulation_id == str(SIM_ID)
