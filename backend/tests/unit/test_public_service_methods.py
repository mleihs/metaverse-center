"""Tests for public query methods added to services in Phase 5C."""

from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from backend.services.chat_service import ChatService
from backend.services.simulation_service import SimulationService
from backend.services.taxonomy_service import TaxonomyService
from backend.tests.conftest import make_chain_mock

SIM_ID = uuid4()
CONV_ID = uuid4()


# ── SimulationService.get_platform_stats ──────────────────────


class TestGetPlatformStats:
    @pytest.mark.asyncio
    async def test_returns_counts(self):
        sb = MagicMock()
        sim_chain = make_chain_mock(execute_count=5)
        epoch_chain = make_chain_mock(execute_count=2)
        resonance_chain = make_chain_mock(execute_count=12)

        call_idx = {"n": 0}

        def table_router(name):
            call_idx["n"] += 1
            if name == "simulations":
                return sim_chain
            if name == "game_epochs":
                return epoch_chain
            if name == "substrate_resonances":
                return resonance_chain
            return make_chain_mock()

        sb.table.side_effect = table_router

        result = await SimulationService.get_platform_stats(sb)

        assert result["simulation_count"] == 5
        assert result["active_epoch_count"] == 2
        assert result["resonance_count"] == 12

    @pytest.mark.asyncio
    async def test_returns_zeros_when_counts_are_none(self):
        sb = MagicMock()
        chain = make_chain_mock(execute_count=None)
        sb.table.return_value = chain

        result = await SimulationService.get_platform_stats(sb)

        assert result["simulation_count"] == 0
        assert result["active_epoch_count"] == 0
        assert result["resonance_count"] == 0


# ── SimulationService.list_active_public ──────────────────────


class TestListActivePublic:
    @pytest.mark.asyncio
    async def test_returns_data_and_total(self):
        sb = MagicMock()
        rows = [{"id": str(uuid4()), "name": "Sim A"}]
        chain = make_chain_mock(execute_data=rows, execute_count=1)
        sb.table.return_value = chain

        data, total = await SimulationService.list_active_public(sb, limit=10, offset=0)

        assert data == rows
        assert total == 1

    @pytest.mark.asyncio
    async def test_empty_result(self):
        sb = MagicMock()
        chain = make_chain_mock(execute_data=[], execute_count=0)
        sb.table.return_value = chain

        data, total = await SimulationService.list_active_public(sb)

        assert data == []
        assert total == 0


# ── SimulationService.get_by_slug ─────────────────────────────


class TestGetBySlug:
    @pytest.mark.asyncio
    async def test_returns_simulation_when_found(self):
        sb = MagicMock()
        sim = {"id": str(SIM_ID), "slug": "test-sim", "status": "active"}
        chain = make_chain_mock(execute_data=[sim])
        sb.table.return_value = chain

        result = await SimulationService.get_by_slug(sb, "test-sim")

        assert result == sim

    @pytest.mark.asyncio
    async def test_returns_none_when_not_found(self):
        sb = MagicMock()
        chain = make_chain_mock(execute_data=[])
        sb.table.return_value = chain

        result = await SimulationService.get_by_slug(sb, "nonexistent")

        assert result is None


# ── SimulationService.get_active_by_id ────────────────────────


class TestGetActiveById:
    @pytest.mark.asyncio
    async def test_returns_simulation_when_found(self):
        sb = MagicMock()
        sim = {"id": str(SIM_ID), "status": "active"}
        chain = make_chain_mock(execute_data=[sim])
        sb.table.return_value = chain

        result = await SimulationService.get_active_by_id(sb, SIM_ID)

        assert result == sim

    @pytest.mark.asyncio
    async def test_returns_none_when_not_found(self):
        sb = MagicMock()
        chain = make_chain_mock(execute_data=[])
        sb.table.return_value = chain

        result = await SimulationService.get_active_by_id(sb, uuid4())

        assert result is None


# ── SimulationService.enrich_with_counts ──────────────────────


class TestEnrichWithCounts:
    def test_enriches_simulations_with_counts(self):
        sb = MagicMock()
        sid = str(uuid4())
        simulations = [{"id": sid, "name": "Sim A"}]

        counts_row = {
            "simulation_id": sid,
            "agent_count": 5,
            "building_count": 3,
            "event_count": 10,
            "member_count": 2,
        }
        chain = make_chain_mock(execute_data=[counts_row])
        sb.table.return_value = chain

        SimulationService.enrich_with_counts(sb, simulations)

        assert simulations[0]["agent_count"] == 5
        assert simulations[0]["building_count"] == 3
        assert simulations[0]["event_count"] == 10
        assert simulations[0]["member_count"] == 2

    def test_defaults_to_zero_when_no_counts(self):
        sb = MagicMock()
        sid = str(uuid4())
        simulations = [{"id": sid, "name": "Sim B"}]

        chain = make_chain_mock(execute_data=[])
        sb.table.return_value = chain

        SimulationService.enrich_with_counts(sb, simulations)

        assert simulations[0]["agent_count"] == 0
        assert simulations[0]["building_count"] == 0
        assert simulations[0]["event_count"] == 0
        assert simulations[0]["member_count"] == 0

    def test_noop_on_empty_list(self):
        sb = MagicMock()

        SimulationService.enrich_with_counts(sb, [])

        sb.table.assert_not_called()


# ── ChatService.list_conversations_public ─────────────────────


class TestListConversationsPublic:
    @pytest.mark.asyncio
    async def test_returns_conversations(self):
        sb = MagicMock()
        rows = [{"id": str(CONV_ID), "title": "Chat 1"}]
        chain = make_chain_mock(execute_data=rows)
        sb.table.return_value = chain

        result = await ChatService.list_conversations_public(sb, SIM_ID)

        assert result == rows

    @pytest.mark.asyncio
    async def test_returns_empty_list_when_none(self):
        sb = MagicMock()
        chain = make_chain_mock(execute_data=None)
        sb.table.return_value = chain

        result = await ChatService.list_conversations_public(sb, SIM_ID)

        assert result == []


# ── ChatService.list_messages_public ──────────────────────────


class TestListMessagesPublic:
    @pytest.mark.asyncio
    async def test_returns_messages_and_total(self):
        sb = MagicMock()
        msgs = [{"id": "m1", "content": "Hello"}]
        chain = make_chain_mock(execute_data=msgs, execute_count=1)
        sb.table.return_value = chain

        data, total = await ChatService.list_messages_public(sb, CONV_ID, limit=50, offset=0)

        assert data == msgs
        assert total == 1

    @pytest.mark.asyncio
    async def test_empty_conversation(self):
        sb = MagicMock()
        chain = make_chain_mock(execute_data=[], execute_count=0)
        sb.table.return_value = chain

        data, total = await ChatService.list_messages_public(sb, CONV_ID)

        assert data == []
        assert total == 0


# ── TaxonomyService.list_taxonomies_paginated ─────────────────


class TestListTaxonomiesPaginated:
    @pytest.mark.asyncio
    async def test_returns_all_types(self):
        sb = MagicMock()
        rows = [{"id": "t1", "taxonomy_type": "faction"}, {"id": "t2", "taxonomy_type": "trait"}]
        chain = make_chain_mock(execute_data=rows, execute_count=2)
        sb.table.return_value = chain

        data, total = await TaxonomyService.list_taxonomies_paginated(sb, SIM_ID)

        assert data == rows
        assert total == 2

    @pytest.mark.asyncio
    async def test_filters_by_type(self):
        sb = MagicMock()
        rows = [{"id": "t1", "taxonomy_type": "faction"}]
        chain = make_chain_mock(execute_data=rows, execute_count=1)
        sb.table.return_value = chain

        data, total = await TaxonomyService.list_taxonomies_paginated(
            sb, SIM_ID, taxonomy_type="faction"
        )

        assert data == rows
        assert total == 1
        # Verify the taxonomy_type filter was applied
        chain.eq.assert_called()

    @pytest.mark.asyncio
    async def test_empty_result(self):
        sb = MagicMock()
        chain = make_chain_mock(execute_data=[], execute_count=0)
        sb.table.return_value = chain

        data, total = await TaxonomyService.list_taxonomies_paginated(sb, SIM_ID)

        assert data == []
        assert total == 0
