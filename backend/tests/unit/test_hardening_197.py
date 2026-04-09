"""Unit tests for migration 197 hardening changes.

Tests the removal of use_atomic_game_rpcs dual-path code, pipeline dependency
guards in cycle_resolution_service, and error handling fixes in
operative_mission_service.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.services.cycle_resolution_service import CycleResolutionService
from backend.services.operative_mission_service import OperativeMissionService

# ── Helpers ────────────────────────────────────────────────────────────────

EPOCH_ID = uuid4()
SIM_ID = uuid4()
TARGET_SIM_ID = uuid4()
MISSION_ID = uuid4()


def _mock_chain(**overrides):
    """Create a chainable mock for Supabase table/rpc calls."""
    c = MagicMock()
    for method in ("select", "eq", "in_", "neq", "lte", "or_", "single",
                   "maybe_single", "limit", "order", "insert", "update", "delete"):
        setattr(c, method, MagicMock(return_value=c))
    for k, v in overrides.items():
        setattr(c, k, v)
    return c


def _mock_supabase(table_map=None, rpc_map=None):
    """Create a mock Supabase client with table and rpc routing."""
    sb = MagicMock()

    def _table(name):
        if table_map and name in table_map:
            return table_map[name]
        return _mock_chain(execute=AsyncMock(return_value=MagicMock(data=[])))

    sb.table = MagicMock(side_effect=_table)

    def _rpc(name, params=None):
        if rpc_map and name in rpc_map:
            return rpc_map[name]
        return _mock_chain(execute=AsyncMock(return_value=MagicMock(data=None)))

    sb.rpc = MagicMock(side_effect=_rpc)
    return sb


def _pg_error():
    return PostgrestAPIError({"message": "DB error", "code": "500", "hint": "", "details": ""})


# ═══════════════════════════════════════════════════════════════════════════
# Phase 2: Atomic RPC paths — no more PlatformConfigService dual-path
# ═══════════════════════════════════════════════════════════════════════════


class TestAtomicRPCPaths:
    """Verify dual-path code was removed and only RPCs are called."""

    @pytest.mark.asyncio
    async def test_deploying_transition_calls_rpc(self):
        """deploying → active must use fn_transition_mission_status RPC."""
        mission = {
            "id": str(MISSION_ID),
            "epoch_id": str(EPOCH_ID),
            "operative_type": "spy",
            "status": "deploying",
            "resolves_at": "2099-01-01T00:00:00+00:00",
            "source_simulation_id": str(SIM_ID),
        }

        rpc_chain = _mock_chain(execute=AsyncMock(return_value=MagicMock(data=None)))
        missions_chain = _mock_chain(execute=AsyncMock(return_value=MagicMock(data=[mission])))
        sb = _mock_supabase(
            table_map={"operative_missions": missions_chain},
            rpc_map={"fn_transition_mission_status": rpc_chain},
        )

        await OperativeMissionService.resolve_pending_missions(sb, EPOCH_ID)

        sb.rpc.assert_any_call(
            "fn_transition_mission_status",
            {"p_mission_id": str(MISSION_ID), "p_from_status": "deploying", "p_to_status": "active"},
        )

    @pytest.mark.asyncio
    async def test_grant_rp_calls_rpc_directly(self):
        """grant_rp must call fn_grant_rp_single without PlatformConfigService check."""
        epoch_chain = _mock_chain(
            execute=AsyncMock(return_value=MagicMock(data={"config": {"rp_cap": 40}}))
        )
        rpc_chain = _mock_chain(execute=AsyncMock(return_value=MagicMock(data=25)))
        sb = _mock_supabase(
            table_map={"game_epochs": epoch_chain},
            rpc_map={"fn_grant_rp_single": rpc_chain},
        )

        result = await CycleResolutionService.grant_rp(sb, EPOCH_ID, SIM_ID, 5)

        sb.rpc.assert_called_once_with(
            "fn_grant_rp_single",
            {"p_epoch_id": str(EPOCH_ID), "p_simulation_id": str(SIM_ID), "p_amount": 5, "p_rp_cap": 40},
        )
        assert result == 25

    def test_platform_config_not_imported_in_operative(self):
        """PlatformConfigService must be removed from operative_mission_service."""
        import backend.services.operative_mission_service as mod

        # Check the module's namespace — PlatformConfigService should not exist
        assert "PlatformConfigService" not in dir(mod)

    def test_downgrade_security_not_imported_in_operative(self):
        """_downgrade_security was only used by the Python fallback."""
        import backend.services.operative_mission_service as mod

        assert "_downgrade_security" not in dir(mod)


# ═══════════════════════════════════════════════════════════════════════════
# Phase 3: Pipeline dependency guards
# ═══════════════════════════════════════════════════════════════════════════


class TestPipelineDependencyGuards:
    """Test that cycle resolution skips dependent phases when prerequisites fail."""

    def _make_patched_resolve(self):
        """Create patches for all late-imported services + resolve_cycle in resolve_cycle_full."""
        return {
            "alliance": patch("backend.services.alliance_service.AllianceService"),
            "operative": patch("backend.services.operative_service.OperativeService"),
            "scoring": patch("backend.services.scoring_service.ScoringService"),
            "bot": patch("backend.services.bot_service.BotService"),
            "notification": patch("backend.services.cycle_notification_service.CycleNotificationService"),
            "battle": patch("backend.services.cycle_resolution_service.BattleLogService"),
            "resolve_cycle": patch.object(
                CycleResolutionService, "resolve_cycle",
                new=AsyncMock(return_value={"config": {"cycle_hours": 8}, "current_cycle": 2}),
            ),
        }

    @pytest.mark.asyncio
    async def test_tension_skipped_when_missions_fail(self):
        """PostgrestAPIError in mission resolution → tension must NOT run."""
        patches = self._make_patched_resolve()

        with patches["alliance"] as mock_alliance, \
             patches["operative"] as mock_operative, \
             patches["scoring"] as mock_scoring, \
             patches["bot"] as mock_bot, \
             patches["notification"] as mock_notif, \
             patches["battle"], \
             patches["resolve_cycle"], \
             patch("backend.services.cycle_resolution_service.sentry_sdk"):

            mock_operative.resolve_pending_missions = AsyncMock(side_effect=_pg_error())
            mock_alliance.expire_proposals = AsyncMock(return_value=0)
            mock_alliance.deduct_upkeep = AsyncMock(return_value=[])
            mock_bot.execute_bot_cycle = AsyncMock()
            mock_scoring.compute_cycle_scores = AsyncMock()
            mock_notif.send_cycle_notifications = AsyncMock()

            epoch_chain = _mock_chain(
                execute=AsyncMock(return_value=MagicMock(data={"config": {"rp_per_cycle": 12, "rp_cap": 40}}))
            )
            rpc_chain = _mock_chain(execute=AsyncMock(return_value=MagicMock(data=None)))
            sb = _mock_supabase(
                table_map={
                    "game_epochs": epoch_chain,
                    "epoch_participants": _mock_chain(execute=AsyncMock(return_value=MagicMock(data=[]))),
                },
                rpc_map={
                    "fn_advance_epoch_cycle": _mock_chain(execute=AsyncMock(return_value=MagicMock(data={"new_cycle": 2}))),
                    "fn_expire_fortifications": rpc_chain,
                    "fn_batch_grant_rp": rpc_chain,
                },
            )

            await CycleResolutionService.resolve_cycle_full(sb, EPOCH_ID, sb)

            mock_alliance.compute_tension.assert_not_called()
            mock_alliance.clear_dissolved_team_ids.assert_not_called()

    @pytest.mark.asyncio
    async def test_tension_runs_when_missions_succeed(self):
        """Successful mission resolution → tension MUST run."""
        patches = self._make_patched_resolve()

        with patches["alliance"] as mock_alliance, \
             patches["operative"] as mock_operative, \
             patches["scoring"] as mock_scoring, \
             patches["bot"] as mock_bot, \
             patches["notification"] as mock_notif, \
             patches["battle"], \
             patches["resolve_cycle"]:

            mock_operative.resolve_pending_missions = AsyncMock(return_value=[])
            mock_alliance.expire_proposals = AsyncMock(return_value=0)
            mock_alliance.deduct_upkeep = AsyncMock(return_value=[])
            mock_alliance.compute_tension = AsyncMock(return_value=[])
            mock_alliance.clear_dissolved_team_ids = AsyncMock()
            mock_bot.execute_bot_cycle = AsyncMock()
            mock_scoring.compute_cycle_scores = AsyncMock()
            mock_notif.send_cycle_notifications = AsyncMock()

            epoch_chain = _mock_chain(
                execute=AsyncMock(return_value=MagicMock(data={"config": {"rp_per_cycle": 12, "rp_cap": 40}}))
            )
            rpc_chain = _mock_chain(execute=AsyncMock(return_value=MagicMock(data=None)))
            sb = _mock_supabase(
                table_map={
                    "game_epochs": epoch_chain,
                    "epoch_participants": _mock_chain(execute=AsyncMock(return_value=MagicMock(data=[]))),
                },
                rpc_map={
                    "fn_advance_epoch_cycle": _mock_chain(execute=AsyncMock(return_value=MagicMock(data={"new_cycle": 2}))),
                    "fn_expire_fortifications": rpc_chain,
                    "fn_batch_grant_rp": rpc_chain,
                },
            )

            await CycleResolutionService.resolve_cycle_full(sb, EPOCH_ID, sb)

            mock_alliance.compute_tension.assert_called_once()

    @pytest.mark.asyncio
    async def test_key_error_in_missions_raises(self):
        """KeyError in mission resolution must raise, not be swallowed."""
        patches = self._make_patched_resolve()

        with patches["alliance"] as mock_alliance, \
             patches["operative"] as mock_operative, \
             patches["scoring"], \
             patches["bot"], \
             patches["notification"], \
             patches["battle"], \
             patches["resolve_cycle"], \
             patch("backend.services.cycle_resolution_service.sentry_sdk"):

            mock_operative.resolve_pending_missions = AsyncMock(side_effect=KeyError("x"))
            mock_alliance.expire_proposals = AsyncMock(return_value=0)
            mock_alliance.deduct_upkeep = AsyncMock(return_value=[])

            epoch_chain = _mock_chain(
                execute=AsyncMock(return_value=MagicMock(data={"config": {"rp_per_cycle": 12, "rp_cap": 40}}))
            )
            rpc_chain = _mock_chain(execute=AsyncMock(return_value=MagicMock(data=None)))
            sb = _mock_supabase(
                table_map={
                    "game_epochs": epoch_chain,
                    "epoch_participants": _mock_chain(execute=AsyncMock(return_value=MagicMock(data=[]))),
                },
                rpc_map={
                    "fn_advance_epoch_cycle": _mock_chain(execute=AsyncMock(return_value=MagicMock(data={"new_cycle": 2}))),
                    "fn_expire_fortifications": rpc_chain,
                    "fn_batch_grant_rp": rpc_chain,
                },
            )

            with pytest.raises(KeyError):
                await CycleResolutionService.resolve_cycle_full(sb, EPOCH_ID, sb)


# ═══════════════════════════════════════════════════════════════════════════
# Phase 4: Error handling fixes
# ═══════════════════════════════════════════════════════════════════════════


class TestErrorHandlingFixes:

    @pytest.mark.asyncio
    async def test_counter_intel_handles_per_mission_error(self):
        """counter_intel_sweep continues when one mission update fails."""
        m1 = {"id": str(uuid4()), "operative_type": "spy", "status": "active"}
        m2 = {"id": str(uuid4()), "operative_type": "saboteur", "status": "active"}

        call_count = 0

        async def _execute():
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return MagicMock(data=[m1, m2])  # list query
            if call_count == 2:
                return MagicMock(data=[m1])  # first update OK
            raise _pg_error()  # second update fails

        missions_chain = _mock_chain(execute=AsyncMock(side_effect=_execute))
        sb = _mock_supabase(table_map={"operative_missions": missions_chain})

        with patch("backend.services.operative_mission_service.EpochService") as mock_epoch:
            mock_epoch.get = AsyncMock(return_value={"status": "competition", "current_cycle": 3})
            mock_epoch.spend_rp = AsyncMock()

            detected = await OperativeMissionService.counter_intel_sweep(sb, EPOCH_ID, SIM_ID)

        assert len(detected) == 1
        assert detected[0]["id"] == m1["id"]

    @pytest.mark.asyncio
    async def test_propagandist_event_created_false_on_db_error(self):
        """event_created must be False when insert raises."""
        mission = {
            "id": str(MISSION_ID),
            "epoch_id": str(EPOCH_ID),
            "source_simulation_id": str(SIM_ID),
            "target_simulation_id": str(TARGET_SIM_ID),
            "target_entity_id": None,
        }
        events_chain = _mock_chain(execute=AsyncMock(side_effect=_pg_error()))
        sb = _mock_supabase(table_map={"events": events_chain})

        result = await OperativeMissionService._apply_propagandist_effect(sb, mission)

        assert result["outcome"] == "success"
        assert result["event_created"] is False

    @pytest.mark.asyncio
    async def test_propagandist_event_created_true_on_success(self):
        """event_created must be True when insert succeeds."""
        mission = {
            "id": str(MISSION_ID),
            "epoch_id": str(EPOCH_ID),
            "source_simulation_id": str(SIM_ID),
            "target_simulation_id": str(TARGET_SIM_ID),
            "target_entity_id": None,
        }
        events_chain = _mock_chain(
            execute=AsyncMock(return_value=MagicMock(data=[{"id": str(uuid4())}]))
        )
        sb = _mock_supabase(table_map={"events": events_chain})

        result = await OperativeMissionService._apply_propagandist_effect(sb, mission)

        assert result["outcome"] == "success"
        assert result["event_created"] is True
