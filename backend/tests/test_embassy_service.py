"""Tests for EmbassyService — cross-simulation building link operations."""

from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

import pytest
from fastapi import HTTPException

from backend.services.embassy_service import EmbassyService

SIM_ID = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
SIM_B = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02")
BUILDING_A = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
BUILDING_B = UUID("cccccccc-cccc-cccc-cccc-cccccccccccc")
EMBASSY_ID = UUID("dddddddd-dddd-dddd-dddd-dddddddddddd")


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
    builder.or_.return_value = builder
    builder.order.return_value = builder
    builder.range.return_value = builder
    builder.limit.return_value = builder
    builder.single.return_value = builder
    builder.execute = AsyncMock(return_value=response)

    mock.table.return_value = builder
    return mock, builder, response


MOCK_EMBASSY = {
    "id": str(EMBASSY_ID),
    "building_a_id": str(BUILDING_A),
    "simulation_a_id": str(SIM_ID),
    "building_b_id": str(BUILDING_B),
    "simulation_b_id": str(SIM_B),
    "status": "proposed",
    "connection_type": "embassy",
    "description": "Trade route",
    "bleed_vector": "commerce",
    "event_propagation": True,
    "created_at": "2026-01-01T00:00:00Z",
    "updated_at": "2026-01-01T00:00:00Z",
}


# ── list_for_simulation ───────────────────────────────────────────────


class TestListForSimulation:
    @pytest.mark.asyncio
    async def test_returns_data_and_total(self):
        rows = [MOCK_EMBASSY, {**MOCK_EMBASSY, "id": "other-id"}]
        mock, builder, response = _mock_supabase(data=rows, count=5)

        data, total = await EmbassyService.list_for_simulation(
            mock, SIM_ID, limit=25, offset=0,
        )
        assert data == rows
        assert total == 5

    @pytest.mark.asyncio
    async def test_pagination_params_passed(self):
        mock, builder, response = _mock_supabase(data=[], count=0)

        await EmbassyService.list_for_simulation(
            mock, SIM_ID, limit=50, offset=10,
        )
        builder.range.assert_called_once_with(10, 59)

    @pytest.mark.asyncio
    async def test_total_fallback_when_count_is_none(self):
        rows = [MOCK_EMBASSY]
        mock, builder, response = _mock_supabase(data=rows, count=None)

        _, total = await EmbassyService.list_for_simulation(mock, SIM_ID)
        assert total == 1

    @pytest.mark.asyncio
    async def test_status_filter_applied(self):
        mock, builder, response = _mock_supabase(data=[], count=0)

        await EmbassyService.list_for_simulation(
            mock, SIM_ID, status_filter="active",
        )
        builder.eq.assert_called_with("status", "active")

    @pytest.mark.asyncio
    async def test_empty_data_returns_empty_list(self):
        mock, builder, response = _mock_supabase(data=None, count=0)

        data, total = await EmbassyService.list_for_simulation(mock, SIM_ID)
        assert data == []


# ── list_for_building ─────────────────────────────────────────────────


class TestListForBuilding:
    @pytest.mark.asyncio
    async def test_returns_embassies(self):
        rows = [MOCK_EMBASSY]
        mock, builder, response = _mock_supabase(data=rows)

        result = await EmbassyService.list_for_building(mock, BUILDING_A)
        assert result == rows
        builder.or_.assert_called_once()

    @pytest.mark.asyncio
    async def test_returns_empty_when_no_embassies(self):
        mock, builder, response = _mock_supabase(data=None)

        result = await EmbassyService.list_for_building(mock, BUILDING_A)
        assert result == []


# ── get ───────────────────────────────────────────────────────────────


class TestGet:
    @pytest.mark.asyncio
    async def test_returns_embassy(self):
        mock, builder, response = _mock_supabase(data=MOCK_EMBASSY)

        result = await EmbassyService.get(mock, EMBASSY_ID)
        assert result == MOCK_EMBASSY
        builder.eq.assert_called_with("id", str(EMBASSY_ID))

    @pytest.mark.asyncio
    async def test_not_found_raises_404(self):
        mock, builder, response = _mock_supabase(data=None)

        with pytest.raises(HTTPException) as exc:
            await EmbassyService.get(mock, EMBASSY_ID)
        assert exc.value.status_code == 404
        assert "not found" in exc.value.detail.lower()


# ── get_for_building ──────────────────────────────────────────────────


class TestGetForBuilding:
    @pytest.mark.asyncio
    async def test_found(self):
        mock, builder, response = _mock_supabase(data=[MOCK_EMBASSY])

        result = await EmbassyService.get_for_building(mock, BUILDING_A)
        assert result == MOCK_EMBASSY

    @pytest.mark.asyncio
    async def test_not_found_returns_none(self):
        mock, builder, response = _mock_supabase(data=[])

        result = await EmbassyService.get_for_building(mock, BUILDING_A)
        assert result is None


# ── create_embassy ────────────────────────────────────────────────────


class TestCreateEmbassy:
    @pytest.mark.asyncio
    async def test_creates_with_sorted_ids(self):
        """Building IDs should be sorted (a < b) to satisfy ordered constraint."""
        # Pass building_b_id < building_a_id to trigger the swap
        big_id = "ffffffff-ffff-ffff-ffff-ffffffffffff"
        small_id = "11111111-1111-1111-1111-111111111111"

        created = {
            **MOCK_EMBASSY,
            "building_a_id": small_id,
            "building_b_id": big_id,
        }

        activated = {**created, "status": "active"}
        mock = MagicMock()

        def make_builder(table_name):
            b = MagicMock()
            b.select.return_value = b
            b.insert.return_value = b
            b.update.return_value = b
            b.eq.return_value = b

            r = MagicMock()
            if table_name == "embassies":
                r.data = [created]
                # .single() path returns dict for cls.get() inside transition_status
                single_r = MagicMock()
                single_r.data = created
                single_b = MagicMock()
                single_b.execute = AsyncMock(return_value=single_r)
                b.single.return_value = single_b
                # update path for transition_status returns activated version
                update_b = MagicMock()
                update_b.eq.return_value = update_b
                update_r = MagicMock()
                update_r.data = [activated]
                update_b.execute = AsyncMock(return_value=update_r)
                b.update.return_value = update_b
            elif table_name == "buildings":
                r.data = {"name": "Test Building"}
                b.single.return_value = b
            else:
                r.data = None
                b.single.return_value = b
            b.execute = AsyncMock(return_value=r)
            return b

        mock.table.side_effect = make_builder

        result = await EmbassyService.create_embassy(
            mock,
            {
                "building_a_id": big_id,
                "simulation_a_id": str(SIM_ID),
                "building_b_id": small_id,
                "simulation_b_id": str(SIM_B),
            },
            created_by_id=UUID("11111111-1111-1111-1111-111111111111"),
        )
        assert result["building_a_id"] == small_id
        assert result["status"] == "active"  # Auto-activated

    @pytest.mark.asyncio
    async def test_same_simulation_rejected(self):
        """Embassy must link buildings in different simulations."""
        mock, builder, response = _mock_supabase(data=[])

        with pytest.raises(HTTPException) as exc:
            await EmbassyService.create_embassy(
                mock,
                {
                    "building_a_id": str(BUILDING_A),
                    "simulation_a_id": str(SIM_ID),
                    "building_b_id": str(BUILDING_B),
                    "simulation_b_id": str(SIM_ID),  # Same simulation
                },
            )
        assert exc.value.status_code == 400
        assert "different simulations" in exc.value.detail.lower()

    @pytest.mark.asyncio
    async def test_raises_on_empty_response(self):
        mock, builder, response = _mock_supabase(data=[])

        with pytest.raises(HTTPException) as exc:
            await EmbassyService.create_embassy(
                mock,
                {
                    "building_a_id": str(BUILDING_A),
                    "simulation_a_id": str(SIM_ID),
                    "building_b_id": str(BUILDING_B),
                    "simulation_b_id": str(SIM_B),
                },
            )
        assert exc.value.status_code == 400


# ── update_embassy ────────────────────────────────────────────────────


class TestUpdateEmbassy:
    @pytest.mark.asyncio
    async def test_updates_successfully(self):
        updated = {**MOCK_EMBASSY, "description": "New description"}
        mock, builder, response = _mock_supabase(data=[updated])

        result = await EmbassyService.update_embassy(
            mock, EMBASSY_ID, {"description": "New description"},
        )
        assert result["description"] == "New description"
        builder.update.assert_called_once()

    @pytest.mark.asyncio
    async def test_no_data_rejected(self):
        mock, builder, response = _mock_supabase()

        with pytest.raises(HTTPException) as exc:
            await EmbassyService.update_embassy(mock, EMBASSY_ID, {})
        assert exc.value.status_code == 400
        assert "no fields" in exc.value.detail.lower()

    @pytest.mark.asyncio
    async def test_not_found(self):
        mock, builder, response = _mock_supabase(data=[])

        with pytest.raises(HTTPException) as exc:
            await EmbassyService.update_embassy(
                mock, EMBASSY_ID, {"description": "Updated"},
            )
        assert exc.value.status_code == 404


# ── transition_status ─────────────────────────────────────────────────


class TestTransitionStatus:
    @pytest.mark.asyncio
    async def test_proposed_to_active(self):
        """Valid transition: proposed -> active."""
        mock = MagicMock()
        call_count = [0]

        def make_builder(table_name):
            b = MagicMock()
            b.select.return_value = b
            b.eq.return_value = b
            b.single.return_value = b
            b.update.return_value = b

            r = MagicMock()
            nonlocal call_count
            call_count[0] += 1
            if call_count[0] == 1:
                # First call: get() returns the current embassy
                r.data = {**MOCK_EMBASSY, "status": "proposed"}
            else:
                # Second call: update_embassy() returns updated
                r.data = [{**MOCK_EMBASSY, "status": "active"}]
            b.execute = AsyncMock(return_value=r)
            return b

        mock.table.side_effect = make_builder

        result = await EmbassyService.transition_status(mock, EMBASSY_ID, "active")
        assert result["status"] == "active"

    @pytest.mark.asyncio
    async def test_active_to_suspended(self):
        """Valid transition: active -> suspended."""
        mock = MagicMock()
        call_count = [0]

        def make_builder(table_name):
            b = MagicMock()
            b.select.return_value = b
            b.eq.return_value = b
            b.single.return_value = b
            b.update.return_value = b

            r = MagicMock()
            nonlocal call_count
            call_count[0] += 1
            if call_count[0] == 1:
                r.data = {**MOCK_EMBASSY, "status": "active"}
            else:
                r.data = [{**MOCK_EMBASSY, "status": "suspended"}]
            b.execute = AsyncMock(return_value=r)
            return b

        mock.table.side_effect = make_builder

        result = await EmbassyService.transition_status(mock, EMBASSY_ID, "suspended")
        assert result["status"] == "suspended"

    @pytest.mark.asyncio
    async def test_invalid_transition_rejected(self):
        """Invalid transition: proposed -> suspended should fail."""
        mock = MagicMock()

        def make_builder(table_name):
            b = MagicMock()
            b.select.return_value = b
            b.eq.return_value = b
            b.single.return_value = b

            r = MagicMock()
            r.data = {**MOCK_EMBASSY, "status": "proposed"}
            b.execute = AsyncMock(return_value=r)
            return b

        mock.table.side_effect = make_builder

        with pytest.raises(HTTPException) as exc:
            await EmbassyService.transition_status(mock, EMBASSY_ID, "suspended")
        assert exc.value.status_code == 400
        assert "cannot transition" in exc.value.detail.lower()

    @pytest.mark.asyncio
    async def test_dissolved_cannot_transition(self):
        """Dissolved is a terminal state — no transitions allowed."""
        mock = MagicMock()

        def make_builder(table_name):
            b = MagicMock()
            b.select.return_value = b
            b.eq.return_value = b
            b.single.return_value = b

            r = MagicMock()
            r.data = {**MOCK_EMBASSY, "status": "dissolved"}
            b.execute = AsyncMock(return_value=r)
            return b

        mock.table.side_effect = make_builder

        with pytest.raises(HTTPException) as exc:
            await EmbassyService.transition_status(mock, EMBASSY_ID, "active")
        assert exc.value.status_code == 400


# ── list_all_active ───────────────────────────────────────────────────


class TestListAllActive:
    @pytest.mark.asyncio
    async def test_returns_only_active(self):
        active_embassy = {**MOCK_EMBASSY, "status": "active"}
        mock, builder, response = _mock_supabase(data=[active_embassy])

        result = await EmbassyService.list_all_active(mock)
        assert len(result) == 1
        assert result[0]["status"] == "active"
        builder.eq.assert_called_with("status", "active")

    @pytest.mark.asyncio
    async def test_returns_empty_when_none_active(self):
        mock, builder, response = _mock_supabase(data=None)

        result = await EmbassyService.list_all_active(mock)
        assert result == []
