"""Unit tests for MemberService — CRUD operations and logging verification."""

import logging
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from backend.services.member_service import LastOwnerError, MemberService
from backend.tests.conftest import make_chain_mock

# ── Helpers ────────────────────────────────────────────────────

SIM_ID = uuid4()
USER_ID = uuid4()
MEMBER_ID = uuid4()


def _mock_supabase(insert_data=None, update_data=None, delete_data=None):
    """Create a mock Supabase client with configurable responses."""
    sb = MagicMock()
    chain = make_chain_mock(execute_data=insert_data or update_data or delete_data)
    sb.table.return_value = chain
    return sb


# ── Tests ─────────────────────────────────────────────────────


class TestMemberServiceAdd:
    @pytest.mark.asyncio
    async def test_add_success_logs_info(self, caplog):
        """Successful add should log INFO with user_id, simulation_id, and role."""
        member_row = {
            "id": str(MEMBER_ID),
            "user_id": str(USER_ID),
            "simulation_id": str(SIM_ID),
            "member_role": "editor",
        }
        sb = _mock_supabase(insert_data=[member_row])

        with caplog.at_level(logging.INFO, logger="backend.services.member_service"):
            result = await MemberService.add(sb, SIM_ID, USER_ID, "editor", USER_ID)

        assert result == member_row
        info_records = [r for r in caplog.records if r.levelno == logging.INFO and "added" in r.message.lower()]
        assert len(info_records) >= 1
        record = info_records[0]
        assert record.user_id == str(USER_ID)
        assert record.simulation_id == str(SIM_ID)
        assert record.role == "editor"

    @pytest.mark.asyncio
    async def test_add_failure_raises_500(self):
        """Empty response on add should raise HTTPException 500."""
        sb = _mock_supabase(insert_data=None)

        with pytest.raises(HTTPException) as exc_info:
            await MemberService.add(sb, SIM_ID, USER_ID, "viewer", USER_ID)
        assert exc_info.value.status_code == 500


class TestMemberServiceChangeRole:
    @pytest.mark.asyncio
    async def test_change_role_logs_info(self, caplog):
        """Successful role change should log INFO with member_id, simulation_id, new_role."""
        member_row = {
            "id": str(MEMBER_ID),
            "simulation_id": str(SIM_ID),
            "member_role": "owner",
        }
        sb = _mock_supabase(update_data=[member_row])

        with caplog.at_level(logging.INFO, logger="backend.services.member_service"):
            result = await MemberService.change_role(sb, SIM_ID, MEMBER_ID, "owner")

        assert result == member_row
        info_records = [r for r in caplog.records if r.levelno == logging.INFO and "role changed" in r.message.lower()]
        assert len(info_records) >= 1
        record = info_records[0]
        assert record.member_id == str(MEMBER_ID)
        assert record.new_role == "owner"

    @pytest.mark.asyncio
    async def test_change_role_last_owner_logs_warning(self, caplog):
        """DB trigger error for last owner should log WARNING and raise LastOwnerError."""
        sb = MagicMock()
        chain = MagicMock()
        chain.update.return_value = chain
        chain.eq.return_value = chain
        chain.execute = AsyncMock(side_effect=Exception("cannot remove last owner"))
        sb.table.return_value = chain

        with caplog.at_level(logging.WARNING, logger="backend.services.member_service"):
            with pytest.raises(LastOwnerError):
                await MemberService.change_role(sb, SIM_ID, MEMBER_ID, "editor")

        warning_records = [r for r in caplog.records if r.levelno == logging.WARNING]
        assert len(warning_records) >= 1
        assert warning_records[0].member_id == str(MEMBER_ID)


class TestMemberServiceRemove:
    @pytest.mark.asyncio
    async def test_remove_last_owner_logs_warning(self, caplog):
        """DB trigger error on removal should log WARNING and raise LastOwnerError."""
        sb = MagicMock()
        chain = MagicMock()
        chain.delete.return_value = chain
        chain.eq.return_value = chain
        chain.execute = AsyncMock(side_effect=Exception("cannot remove last owner"))
        sb.table.return_value = chain

        with caplog.at_level(logging.WARNING, logger="backend.services.member_service"):
            with pytest.raises(LastOwnerError):
                await MemberService.remove(sb, SIM_ID, MEMBER_ID)

        warning_records = [r for r in caplog.records if r.levelno == logging.WARNING]
        assert len(warning_records) >= 1
        assert warning_records[0].member_id == str(MEMBER_ID)
