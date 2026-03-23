"""Tests for ForgeDraftService."""

from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

import pytest
from fastapi import HTTPException

from backend.models.forge import ForgeDraftCreate, ForgeDraftUpdate
from backend.services.forge_draft_service import ForgeDraftService

USER_ID = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
DRAFT_ID = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")


def _mock_supabase(data=None, count=None):
    """Build a mock Supabase client with a fluent query builder."""
    mock = MagicMock()
    response = MagicMock()
    response.data = data
    response.count = count

    builder = MagicMock()
    builder.select.return_value = builder
    builder.insert.return_value = builder
    builder.update.return_value = builder
    builder.delete.return_value = builder
    builder.eq.return_value = builder
    builder.order.return_value = builder
    builder.range.return_value = builder
    builder.single.return_value = builder
    builder.execute = AsyncMock(return_value=response)

    mock.table.return_value = builder
    return mock, builder


class TestListDrafts:
    @pytest.mark.asyncio
    async def test_returns_data_and_count(self):
        rows = [{"id": str(DRAFT_ID), "status": "draft"}]
        mock, _ = _mock_supabase(data=rows, count=1)

        data, total = await ForgeDraftService.list_drafts(mock, USER_ID, limit=10, offset=0)
        assert data == rows
        assert total == 1

    @pytest.mark.asyncio
    async def test_empty_returns_empty(self):
        mock, _ = _mock_supabase(data=None, count=0)

        data, total = await ForgeDraftService.list_drafts(mock, USER_ID)
        assert data == []
        assert total == 0


class TestGetDraft:
    @pytest.mark.asyncio
    async def test_found(self):
        row = {"id": str(DRAFT_ID), "user_id": str(USER_ID)}
        mock, _ = _mock_supabase(data=row)

        result = await ForgeDraftService.get_draft(mock, USER_ID, DRAFT_ID)
        assert result == row

    @pytest.mark.asyncio
    async def test_not_found_raises(self):
        mock, _ = _mock_supabase(data=None)

        with pytest.raises(HTTPException) as exc_info:
            await ForgeDraftService.get_draft(mock, USER_ID, DRAFT_ID)
        assert exc_info.value.status_code == 404


class TestCreateDraft:
    @pytest.mark.asyncio
    async def test_creates_and_returns(self):
        row = {"id": str(DRAFT_ID), "user_id": str(USER_ID), "status": "draft"}
        mock, _ = _mock_supabase(data=[row])

        result = await ForgeDraftService.create_draft(
            mock, USER_ID, ForgeDraftCreate(seed_prompt="Test seed")
        )
        assert result["id"] == str(DRAFT_ID)

    @pytest.mark.asyncio
    async def test_insert_failure_raises(self):
        mock, _ = _mock_supabase(data=None)

        with pytest.raises(HTTPException) as exc_info:
            await ForgeDraftService.create_draft(
                mock, USER_ID, ForgeDraftCreate(seed_prompt="Test")
            )
        assert exc_info.value.status_code == 500


class TestUpdateDraft:
    @pytest.mark.asyncio
    async def test_updates_and_returns(self):
        row = {"id": str(DRAFT_ID), "current_phase": "drafting"}
        mock, _ = _mock_supabase(data=[row])

        result = await ForgeDraftService.update_draft(
            mock, USER_ID, DRAFT_ID, ForgeDraftUpdate(current_phase="drafting")
        )
        assert result["current_phase"] == "drafting"

    @pytest.mark.asyncio
    async def test_noop_update_returns_existing(self):
        """Empty update should fetch and return the existing draft."""
        row = {"id": str(DRAFT_ID)}
        mock, builder = _mock_supabase(data=row)

        result = await ForgeDraftService.update_draft(
            mock, USER_ID, DRAFT_ID, ForgeDraftUpdate()
        )
        assert result == row


class TestDeleteDraft:
    @pytest.mark.asyncio
    async def test_deletes(self):
        row = {"id": str(DRAFT_ID)}
        mock, _ = _mock_supabase(data=[row])

        result = await ForgeDraftService.delete_draft(mock, USER_ID, DRAFT_ID)
        assert result["id"] == str(DRAFT_ID)

    @pytest.mark.asyncio
    async def test_not_found_raises(self):
        mock, _ = _mock_supabase(data=None)

        with pytest.raises(HTTPException) as exc_info:
            await ForgeDraftService.delete_draft(mock, USER_ID, DRAFT_ID)
        assert exc_info.value.status_code == 404
