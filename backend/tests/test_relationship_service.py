"""Tests for RelationshipService — agent relationship CRUD operations."""

from unittest.mock import MagicMock
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

from backend.services.relationship_service import RelationshipService

SIM_ID = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
AGENT_A = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
AGENT_B = UUID("cccccccc-cccc-cccc-cccc-cccccccccccc")
REL_ID = UUID("dddddddd-dddd-dddd-dddd-dddddddddddd")


def _mock_supabase(data=None, count=None):
    """Build a mock Supabase client with a fluent query builder."""
    mock = MagicMock()
    response = MagicMock()
    response.data = data
    response.count = count

    # Fluent chaining: every method returns the builder, execute() returns response
    builder = MagicMock()
    builder.select.return_value = builder
    builder.insert.return_value = builder
    builder.update.return_value = builder
    builder.delete.return_value = builder
    builder.eq.return_value = builder
    builder.order.return_value = builder
    builder.range.return_value = builder
    builder.limit.return_value = builder
    builder.is_.return_value = builder
    builder.execute.return_value = response

    mock.table.return_value = builder
    return mock, builder, response


# ── list_for_agent ─────────────────────────────────────────────────────

class TestListForAgent:
    @pytest.mark.asyncio
    async def test_returns_both_directions(self):
        """Returns relationships where agent is source OR target."""
        source_rows = [{"id": str(uuid4()), "source_agent_id": str(AGENT_A)}]
        target_rows = [{"id": str(uuid4()), "target_agent_id": str(AGENT_A)}]

        mock = MagicMock()
        builders = []

        def make_builder(data):
            b = MagicMock()
            b.select.return_value = b
            b.eq.return_value = b
            b.order.return_value = b
            r = MagicMock()
            r.data = data
            b.execute.return_value = r
            return b

        b1 = make_builder(source_rows)
        b2 = make_builder(target_rows)
        builders = [b1, b2]
        mock.table.side_effect = lambda _: builders.pop(0)

        result = await RelationshipService.list_for_agent(mock, SIM_ID, AGENT_A)
        assert len(result) == 2
        assert result[0] == source_rows[0]
        assert result[1] == target_rows[0]

    @pytest.mark.asyncio
    async def test_returns_empty_when_no_relationships(self):
        """Returns empty list when agent has no relationships."""
        mock = MagicMock()

        def make_builder():
            b = MagicMock()
            b.select.return_value = b
            b.eq.return_value = b
            b.order.return_value = b
            r = MagicMock()
            r.data = []
            b.execute.return_value = r
            return b

        builders = [make_builder(), make_builder()]
        mock.table.side_effect = lambda _: builders.pop(0)

        result = await RelationshipService.list_for_agent(mock, SIM_ID, AGENT_A)
        assert result == []

    @pytest.mark.asyncio
    async def test_handles_none_data(self):
        """Handles None response data gracefully."""
        mock = MagicMock()

        def make_builder():
            b = MagicMock()
            b.select.return_value = b
            b.eq.return_value = b
            b.order.return_value = b
            r = MagicMock()
            r.data = None
            b.execute.return_value = r
            return b

        builders = [make_builder(), make_builder()]
        mock.table.side_effect = lambda _: builders.pop(0)

        result = await RelationshipService.list_for_agent(mock, SIM_ID, AGENT_A)
        assert result == []


# ── list_for_simulation ────────────────────────────────────────────────

class TestListForSimulation:
    @pytest.mark.asyncio
    async def test_returns_data_and_total(self):
        rows = [
            {"id": str(uuid4()), "intensity": 8},
            {"id": str(uuid4()), "intensity": 5},
        ]
        mock, builder, response = _mock_supabase(data=rows, count=10)

        data, total = await RelationshipService.list_for_simulation(
            mock, SIM_ID, limit=25, offset=0,
        )
        assert data == rows
        assert total == 10

    @pytest.mark.asyncio
    async def test_pagination_params_passed(self):
        mock, builder, response = _mock_supabase(data=[], count=0)

        await RelationshipService.list_for_simulation(
            mock, SIM_ID, limit=50, offset=10,
        )
        builder.range.assert_called_once_with(10, 59)

    @pytest.mark.asyncio
    async def test_total_fallback_when_count_is_none(self):
        rows = [{"id": "1"}, {"id": "2"}]
        mock, builder, response = _mock_supabase(data=rows, count=None)

        _, total = await RelationshipService.list_for_simulation(mock, SIM_ID)
        assert total == 2


# ── create_relationship ───────────────────────────────────────────────

class TestCreateRelationship:
    @pytest.mark.asyncio
    async def test_creates_relationship_successfully(self):
        created = {
            "id": str(REL_ID),
            "simulation_id": str(SIM_ID),
            "source_agent_id": str(AGENT_A),
            "target_agent_id": str(AGENT_B),
            "relationship_type": "ally",
            "intensity": 7,
        }
        mock, builder, response = _mock_supabase(data=[created])

        result = await RelationshipService.create_relationship(
            mock, SIM_ID, AGENT_A,
            {"target_agent_id": str(AGENT_B), "relationship_type": "ally", "intensity": 7},
        )
        assert result["id"] == str(REL_ID)
        builder.insert.assert_called_once()

    @pytest.mark.asyncio
    async def test_raises_on_empty_response(self):
        mock, builder, response = _mock_supabase(data=[])

        with pytest.raises(HTTPException) as exc:
            await RelationshipService.create_relationship(
                mock, SIM_ID, AGENT_A,
                {"target_agent_id": str(AGENT_B), "relationship_type": "ally"},
            )
        assert exc.value.status_code == 400


# ── update_relationship ───────────────────────────────────────────────

class TestUpdateRelationship:
    @pytest.mark.asyncio
    async def test_updates_successfully(self):
        updated = {"id": str(REL_ID), "intensity": 9}
        mock, builder, response = _mock_supabase(data=[updated])

        result = await RelationshipService.update_relationship(
            mock, SIM_ID, REL_ID, {"intensity": 9},
        )
        assert result["intensity"] == 9
        builder.update.assert_called_once()

    @pytest.mark.asyncio
    async def test_raises_on_empty_data(self):
        mock, _, _ = _mock_supabase()

        with pytest.raises(HTTPException) as exc:
            await RelationshipService.update_relationship(mock, SIM_ID, REL_ID, {})
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_raises_not_found(self):
        mock, builder, response = _mock_supabase(data=[])

        with pytest.raises(HTTPException) as exc:
            await RelationshipService.update_relationship(
                mock, SIM_ID, REL_ID, {"intensity": 5},
            )
        assert exc.value.status_code == 404


# ── delete_relationship ───────────────────────────────────────────────

class TestDeleteRelationship:
    @pytest.mark.asyncio
    async def test_delegates_to_hard_delete(self):
        deleted = {"id": str(REL_ID)}
        mock, builder, response = _mock_supabase(data=[deleted])

        result = await RelationshipService.delete_relationship(mock, SIM_ID, REL_ID)
        assert result["id"] == str(REL_ID)
        builder.delete.assert_called_once()

    @pytest.mark.asyncio
    async def test_raises_not_found(self):
        mock, builder, response = _mock_supabase(data=[])

        with pytest.raises(HTTPException) as exc:
            await RelationshipService.delete_relationship(mock, SIM_ID, REL_ID)
        assert exc.value.status_code == 404
