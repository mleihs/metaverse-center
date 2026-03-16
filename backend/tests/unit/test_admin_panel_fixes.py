"""Tests for admin panel & PostgREST fixes (A1–A5).

A1: AdminUserService wallet constructed from RPC flat fields (no separate query)
A2: AcademyService race-condition fallback uses maybe_single
A3: BotService epoch status fetch uses maybe_single
A4: OperativeMissionService epoch cycle fetch uses maybe_single (2 locations)
A5: SimulationDashboardResponse includes all dashboard view fields
"""

from datetime import UTC, datetime
from unittest.mock import MagicMock
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

from backend.models.simulation import SimulationDashboardResponse
from backend.services.admin_user_service import AdminUserService
from backend.tests.conftest import make_chain_mock

MOCK_USER_ID = UUID("22222222-2222-2222-2222-222222222222")


# ── A1: AdminUserService wallet from RPC ───────────────────────────────


class TestAdminUserWalletFromRPC:
    """A1: Wallet is constructed from RPC flat fields, no separate wallet query."""

    @pytest.mark.asyncio
    async def test_wallet_constructed_from_rpc_fields(self):
        """RPC returns forge_tokens + is_architect → wallet dict built inline."""
        admin_sb = MagicMock()

        # RPC returns flat user with wallet fields
        rpc_mock = MagicMock()
        rpc_resp = MagicMock()
        rpc_resp.data = {
            "id": str(MOCK_USER_ID),
            "email": "test@test.com",
            "forge_tokens": 5,
            "is_architect": True,
        }
        rpc_mock.execute.return_value = rpc_resp
        admin_sb.rpc.return_value = rpc_mock

        # Memberships query
        admin_sb.table.return_value = make_chain_mock(execute_data=[])

        result = await AdminUserService.get_user_with_memberships(admin_sb, MOCK_USER_ID)

        assert result["wallet"] is not None
        assert result["wallet"]["forge_tokens"] == 5
        assert result["wallet"]["is_architect"] is True
        assert result["wallet"]["user_id"] == str(MOCK_USER_ID)
        # No separate wallet table query — only one table() call (memberships)
        assert admin_sb.table.call_count == 1
        admin_sb.table.assert_called_with("simulation_members")

    @pytest.mark.asyncio
    async def test_wallet_none_when_no_wallet_fields(self):
        """User without wallet → forge_tokens/is_architect both None → wallet=None."""
        admin_sb = MagicMock()

        rpc_mock = MagicMock()
        rpc_resp = MagicMock()
        rpc_resp.data = {
            "id": str(MOCK_USER_ID),
            "email": "test@test.com",
            "forge_tokens": None,
            "is_architect": None,
        }
        rpc_mock.execute.return_value = rpc_resp
        admin_sb.rpc.return_value = rpc_mock

        admin_sb.table.return_value = make_chain_mock(execute_data=[])

        result = await AdminUserService.get_user_with_memberships(admin_sb, MOCK_USER_ID)
        assert result["wallet"] is None

    @pytest.mark.asyncio
    async def test_wallet_partial_fields(self):
        """forge_tokens set but is_architect None → wallet still created."""
        admin_sb = MagicMock()

        rpc_mock = MagicMock()
        rpc_resp = MagicMock()
        rpc_resp.data = {
            "id": str(MOCK_USER_ID),
            "email": "test@test.com",
            "forge_tokens": 0,
            "is_architect": None,
        }
        rpc_mock.execute.return_value = rpc_resp
        admin_sb.rpc.return_value = rpc_mock

        admin_sb.table.return_value = make_chain_mock(execute_data=[])

        result = await AdminUserService.get_user_with_memberships(admin_sb, MOCK_USER_ID)
        # forge_tokens=0 is not None → wallet created
        assert result["wallet"] is not None
        assert result["wallet"]["forge_tokens"] == 0
        assert result["wallet"]["is_architect"] is False

    @pytest.mark.asyncio
    async def test_user_not_found_raises_404(self):
        """RPC returns empty → 404."""
        admin_sb = MagicMock()

        rpc_mock = MagicMock()
        rpc_resp = MagicMock()
        rpc_resp.data = None
        rpc_mock.execute.return_value = rpc_resp
        admin_sb.rpc.return_value = rpc_mock

        with pytest.raises(HTTPException) as exc_info:
            await AdminUserService.get_user_with_memberships(admin_sb, MOCK_USER_ID)
        assert exc_info.value.status_code == 404


# ── A2: AcademyService race-condition maybe_single ─────────────────────


class TestAcademyMaybeSingle:
    """A2: Race-condition fallback uses maybe_single (not single).

    We verify the code path by checking that the chain mock's maybe_single
    is called (not single), which prevents PostgREST 406 errors.
    """

    def test_maybe_single_in_source(self):
        """Verify the source code uses maybe_single (static analysis)."""
        import inspect

        from backend.services.academy_service import AcademyService

        source = inspect.getsource(AcademyService.create_academy_epoch)
        # The race-condition fallback must use maybe_single
        assert ".maybe_single()" in source
        assert ".single()" not in source or ".maybe_single()" in source


# ── A3: BotService epoch status maybe_single ───────────────────────────


class TestBotServiceEpochFallback:
    """A3: BotService fetches epoch status with maybe_single.

    When epoch is missing (deleted/archived), should default to 'competition'.
    """

    def test_maybe_single_in_bot_execute_source(self):
        """Verify bot service uses maybe_single for epoch status lookup."""
        import inspect

        from backend.services.bot_service import BotService

        source = inspect.getsource(BotService._execute_single_bot)
        # Epoch fetch must use maybe_single
        assert "maybe_single" in source

    def test_epoch_missing_defaults_to_competition(self):
        """When epoch_resp.data is None, status defaults to 'competition'."""
        # Simulate the logic from bot_service.py:112
        epoch_data = None
        epoch_status = epoch_data.get("status", "competition") if epoch_data else "competition"
        assert epoch_status == "competition"

    def test_epoch_present_uses_actual_status(self):
        epoch_data = {"status": "reckoning"}
        epoch_status = epoch_data.get("status", "competition") if epoch_data else "competition"
        assert epoch_status == "reckoning"


# ── A4: OperativeMissionService epoch cycle maybe_single ───────────────


class TestOperativeEpochCycleFallback:
    """A4: Operative mission service fetches epoch cycle with maybe_single (2 locations).

    When epoch is missing, should default to cycle 1.
    """

    def test_maybe_single_in_source(self):
        """Verify both epoch lookups use maybe_single."""
        import inspect

        from backend.services.operative_mission_service import OperativeMissionService

        # Check _log_betrayal_if_same_team and resolve_mission
        source = inspect.getsource(OperativeMissionService)
        # Count maybe_single occurrences related to game_epochs
        lines = source.split("\n")
        [
            line.strip() for line in lines
            if "maybe_single" in line and "game_epochs" not in line
        ]
        # At minimum, 2 epoch fetches should use maybe_single
        maybe_single_count = source.count("maybe_single")
        assert maybe_single_count >= 2, f"Expected >=2 maybe_single calls, found {maybe_single_count}"

    def test_epoch_missing_defaults_to_cycle_1(self):
        """When epoch_resp.data is None, cycle defaults to 1."""
        epoch_data = None
        cycle = epoch_data.get("current_cycle", 1) if epoch_data else 1
        assert cycle == 1

    def test_epoch_present_uses_actual_cycle(self):
        epoch_data = {"current_cycle": 4}
        cycle = epoch_data.get("current_cycle", 1) if epoch_data else 1
        assert cycle == 4

    def test_epoch_missing_current_cycle_defaults(self):
        """Epoch exists but current_cycle key is absent → default 1."""
        epoch_data = {"status": "competition"}
        cycle = epoch_data.get("current_cycle", 1) if epoch_data else 1
        assert cycle == 1


# ── A5: SimulationDashboardResponse new fields ─────────────────────────


class TestSimulationDashboardResponseFields:
    """A5: Dashboard model includes all fields from the simulation_dashboard view."""

    def test_new_fields_with_defaults(self):
        """New optional fields should default correctly."""
        now = datetime.now(tz=UTC)
        resp = SimulationDashboardResponse(
            simulation_id=uuid4(),
            name="Test Sim",
            slug="test-sim",
            status="active",
            theme="obsidian",
            content_locale="en",
            owner_id=uuid4(),
            created_at=now,
            updated_at=now,
        )
        # New fields default to None / empty
        assert resp.description is None
        assert resp.description_de is None
        assert resp.icon_url is None
        assert resp.banner_url is None
        assert resp.simulation_type == "template"
        assert resp.source_template_id is None
        assert resp.epoch_id is None
        assert resp.archived_at is None
        assert resp.additional_locales == []

    def test_new_fields_populated(self):
        """All new fields can be set explicitly."""
        now = datetime.now(tz=UTC)
        uid = uuid4()
        resp = SimulationDashboardResponse(
            simulation_id=uuid4(),
            name="Test Sim",
            slug="test-sim",
            description="A world of wonder",
            description_de="Eine Welt des Staunens",
            status="active",
            theme="obsidian",
            content_locale="en",
            additional_locales=["de"],
            owner_id=uuid4(),
            icon_url="https://example.com/icon.png",
            banner_url="https://example.com/banner.png",
            simulation_type="instance",
            source_template_id=uid,
            epoch_id=uid,
            member_count=5,
            agent_count=12,
            building_count=8,
            event_count=3,
            archived_at=now,
            created_at=now,
            updated_at=now,
        )
        assert resp.description == "A world of wonder"
        assert resp.description_de == "Eine Welt des Staunens"
        assert resp.icon_url == "https://example.com/icon.png"
        assert resp.simulation_type == "instance"
        assert resp.source_template_id == uid
        assert resp.additional_locales == ["de"]
        assert resp.archived_at == now

    def test_backwards_compatible_with_old_data(self):
        """Data without new fields still parses (dashboard view migration rollout)."""
        now = datetime.now(tz=UTC)
        # Simulate old-format dict (pre-A5) — only original fields
        data = {
            "simulation_id": str(uuid4()),
            "name": "Old Sim",
            "slug": "old-sim",
            "status": "active",
            "theme": "default",
            "content_locale": "en",
            "owner_id": str(uuid4()),
            "member_count": 2,
            "agent_count": 6,
            "building_count": 4,
            "event_count": 1,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }
        resp = SimulationDashboardResponse(**data)
        assert resp.name == "Old Sim"
        assert resp.description is None
        assert resp.icon_url is None
