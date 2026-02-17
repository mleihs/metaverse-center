"""Tests for BaseService — supports_created_by flag and create() behavior."""

from __future__ import annotations

from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from backend.services.base_service import BaseService

# ---------------------------------------------------------------------------
# Concrete subclasses for testing
# ---------------------------------------------------------------------------


class _ServiceWithCreatedBy(BaseService):
    """Simulates AgentService — table HAS created_by_id."""

    table_name = "agents"
    view_name = "active_agents"
    # supports_created_by defaults to True


class _ServiceWithoutCreatedBy(BaseService):
    """Simulates EventService/BuildingService — table has NO created_by_id."""

    table_name = "events"
    view_name = "active_events"
    supports_created_by = False


def _mock_supabase(return_data: list[dict] | None = None):
    """Create a mock Supabase client with chained .table().insert().execute()."""
    mock = MagicMock()
    response = MagicMock()
    response.data = return_data

    mock.table.return_value.insert.return_value.execute.return_value = response
    return mock


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestSupportsCreatedByFlag:
    """Verify the supports_created_by class attribute works correctly."""

    def test_default_is_true(self):
        assert BaseService.supports_created_by is True

    def test_agent_service_has_created_by(self):
        assert _ServiceWithCreatedBy.supports_created_by is True

    def test_event_service_no_created_by(self):
        assert _ServiceWithoutCreatedBy.supports_created_by is False


class TestBaseServiceCreate:
    """Tests for BaseService.create() with and without created_by_id support."""

    async def test_adds_created_by_when_supported(self):
        """When supports_created_by=True, insert_data should include created_by_id."""
        sim_id = uuid4()
        user_id = uuid4()
        row = {"id": str(uuid4()), "name": "Agent X", "simulation_id": str(sim_id), "created_by_id": str(user_id)}
        mock_sb = _mock_supabase(return_data=[row])

        result = await _ServiceWithCreatedBy.create(
            mock_sb, sim_id, user_id, {"name": "Agent X"},
        )

        # Verify insert was called with created_by_id
        insert_call = mock_sb.table.return_value.insert
        insert_data = insert_call.call_args[0][0]
        assert "created_by_id" in insert_data
        assert insert_data["created_by_id"] == str(user_id)
        assert result == row

    async def test_skips_created_by_when_not_supported(self):
        """When supports_created_by=False, insert_data must NOT include created_by_id."""
        sim_id = uuid4()
        user_id = uuid4()
        row = {"id": str(uuid4()), "title": "Event X", "simulation_id": str(sim_id)}
        mock_sb = _mock_supabase(return_data=[row])

        result = await _ServiceWithoutCreatedBy.create(
            mock_sb, sim_id, user_id, {"title": "Event X"},
        )

        # Verify insert was called WITHOUT created_by_id
        insert_call = mock_sb.table.return_value.insert
        insert_data = insert_call.call_args[0][0]
        assert "created_by_id" not in insert_data
        assert insert_data["simulation_id"] == str(sim_id)
        assert result == row

    async def test_does_not_overwrite_explicit_created_by(self):
        """If data already contains created_by_id, it should not be overwritten."""
        sim_id = uuid4()
        user_id = uuid4()
        explicit_id = uuid4()
        row = {"id": str(uuid4()), "simulation_id": str(sim_id), "created_by_id": str(explicit_id)}
        mock_sb = _mock_supabase(return_data=[row])

        await _ServiceWithCreatedBy.create(
            mock_sb, sim_id, user_id, {"name": "X", "created_by_id": str(explicit_id)},
        )

        insert_data = mock_sb.table.return_value.insert.call_args[0][0]
        assert insert_data["created_by_id"] == str(explicit_id)

    async def test_always_sets_simulation_id(self):
        """simulation_id is always added regardless of supports_created_by."""
        sim_id = uuid4()
        user_id = uuid4()
        row = {"id": str(uuid4()), "simulation_id": str(sim_id)}
        mock_sb = _mock_supabase(return_data=[row])

        await _ServiceWithoutCreatedBy.create(
            mock_sb, sim_id, user_id, {"title": "Test"},
        )

        insert_data = mock_sb.table.return_value.insert.call_args[0][0]
        assert insert_data["simulation_id"] == str(sim_id)

    async def test_raises_on_empty_response(self):
        """Should raise HTTPException 500 when Supabase returns no data."""
        mock_sb = _mock_supabase(return_data=None)

        with pytest.raises(HTTPException) as exc_info:
            await _ServiceWithCreatedBy.create(
                mock_sb, uuid4(), uuid4(), {"name": "Fail"},
            )
        assert exc_info.value.status_code == 500


class TestActualServiceFlags:
    """Verify that the real service subclasses have correct flags."""

    def test_event_service(self):
        from backend.services.event_service import EventService

        assert EventService.supports_created_by is False

    def test_building_service(self):
        from backend.services.building_service import BuildingService

        assert BuildingService.supports_created_by is False

    def test_agent_service(self):
        from backend.services.agent_service import AgentService

        assert AgentService.supports_created_by is True
