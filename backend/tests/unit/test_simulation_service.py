"""Unit tests for SimulationService — CRUD operations and logging verification."""

import logging
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from backend.services.simulation_service import SimulationService
from backend.tests.conftest import make_chain_mock

# ── Helpers ────────────────────────────────────────────────────

SIM_ID = uuid4()
USER_ID = uuid4()


# ── Tests ─────────────────────────────────────────────────────


class TestSimulationServiceCreate:
    @pytest.mark.asyncio
    async def test_create_simulation_logs_info(self, caplog):
        """Successful creation should log INFO with simulation_id, slug, user_id."""
        sb = MagicMock()

        # Slug uniqueness check — no conflict
        slug_chain = make_chain_mock(execute_data=[])
        # Simulation insert
        sim_row = {"id": str(SIM_ID), "name": "TestSim", "slug": "testsim"}
        insert_chain = make_chain_mock(execute_data=[sim_row])
        # Member insert
        member_chain = make_chain_mock(execute_data=[{"id": str(uuid4())}])

        call_count = {"simulations": 0}

        def table_router(name):
            if name == "simulations":
                call_count["simulations"] += 1
                if call_count["simulations"] == 1:
                    return slug_chain  # uniqueness check
                if call_count["simulations"] == 2:
                    return insert_chain  # insert
                return member_chain
            if name == "simulation_members":
                return member_chain
            return make_chain_mock()

        sb.table.side_effect = table_router

        from backend.models.simulation import SimulationCreate

        data = SimulationCreate(name="TestSim")

        with caplog.at_level(logging.INFO, logger="backend.services.simulation_service"):
            result = await SimulationService.create_simulation(sb, USER_ID, data)

        assert result["id"] == str(SIM_ID)
        info_records = [r for r in caplog.records if r.levelno == logging.INFO and "created" in r.message.lower()]
        assert len(info_records) >= 1
        record = info_records[0]
        assert record.simulation_id == str(SIM_ID)
        assert record.slug == "testsim"
        assert record.user_id == str(USER_ID)


class TestSimulationServiceDelete:
    @pytest.mark.asyncio
    async def test_hard_delete_logs_warning(self, caplog):
        """Hard delete should log WARNING with simulation_id, name, slug."""
        sb = MagicMock()

        sim_info = {"id": str(SIM_ID), "name": "Doomed Sim", "slug": "doomed-sim"}
        # Fetch chain (maybe_single)
        fetch_chain = make_chain_mock(execute_data=sim_info)
        # Delete chain
        delete_chain = make_chain_mock(execute_data=[sim_info])

        call_count = {"simulations": 0}

        def table_router(name):
            call_count["simulations"] += 1
            if call_count["simulations"] == 1:
                return fetch_chain
            return delete_chain

        sb.table.side_effect = table_router

        with caplog.at_level(logging.WARNING, logger="backend.services.simulation_service"):
            result = await SimulationService.hard_delete_simulation(sb, SIM_ID)

        assert result == sim_info
        warning_records = [
            r for r in caplog.records if r.levelno == logging.WARNING and "hard-deleted" in r.message.lower()
        ]
        assert len(warning_records) >= 1
        record = warning_records[0]
        assert record.simulation_id == str(SIM_ID)
        assert record.simulation_name == "Doomed Sim"
        assert record.slug == "doomed-sim"

    @pytest.mark.asyncio
    async def test_soft_delete_logs_info(self, caplog):
        """Soft delete should log INFO with simulation_id."""
        sb = MagicMock()
        sim_row = {"id": str(SIM_ID), "deleted_at": "2026-03-01T00:00:00Z"}
        chain = make_chain_mock(execute_data=[sim_row])
        sb.table.return_value = chain

        with caplog.at_level(logging.INFO, logger="backend.services.simulation_service"):
            await SimulationService.delete_simulation(sb, SIM_ID)

        info_records = [r for r in caplog.records if r.levelno == logging.INFO and "soft-deleted" in r.message.lower()]
        assert len(info_records) >= 1
        assert info_records[0].simulation_id == str(SIM_ID)

    @pytest.mark.asyncio
    async def test_restore_logs_info(self, caplog):
        """Restore should log INFO with simulation_id."""
        sb = MagicMock()
        sim_row = {"id": str(SIM_ID), "deleted_at": None, "status": "active"}
        chain = make_chain_mock(execute_data=[sim_row])
        # SimulationService.restore_simulation uses .not_.is_() so we need not_ to return chain
        chain.not_ = chain
        sb.table.return_value = chain

        with caplog.at_level(logging.INFO, logger="backend.services.simulation_service"):
            await SimulationService.restore_simulation(sb, SIM_ID)

        info_records = [r for r in caplog.records if r.levelno == logging.INFO and "restored" in r.message.lower()]
        assert len(info_records) >= 1
        assert info_records[0].simulation_id == str(SIM_ID)
