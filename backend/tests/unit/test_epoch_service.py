"""Unit tests for EpochService — lifecycle, participants, bots, RP management."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

from backend.services.epoch_service import DEFAULT_CONFIG, OPERATIVE_RP_COSTS, EpochService

# ── Helpers ────────────────────────────────────────────────────

EPOCH_ID = uuid4()
USER_ID = uuid4()
SIM_ID = uuid4()
SIM_ID_2 = uuid4()
BOT_ID = uuid4()
TEAM_ID = uuid4()


def _make_chain(**overrides):
    """Create a mock Supabase query chain."""
    c = MagicMock()
    c.select.return_value = c
    c.eq.return_value = c
    c.in_.return_value = c
    c.single.return_value = c
    c.maybe_single.return_value = c
    c.limit.return_value = c
    c.order.return_value = c
    c.insert.return_value = c
    c.update.return_value = c
    c.delete.return_value = c
    c.range.return_value = c
    c.is_.return_value = c
    c.neq.return_value = c
    c.upsert.return_value = c
    # Default execute to AsyncMock so await works on fallback chains
    c.execute = AsyncMock(return_value=MagicMock(data=[], count=0))
    for k, v in overrides.items():
        setattr(c, k, v)
    return c


# ── Epoch CRUD ─────────────────────────────────────────────────


class TestEpochCreate:
    @pytest.mark.asyncio
    async def test_creates_epoch_with_default_config(self):
        sb = MagicMock()
        chain = _make_chain()
        epoch_data = {
            "id": str(EPOCH_ID),
            "name": "Test Epoch",
            "status": "lobby",
            "config": DEFAULT_CONFIG,
            "created_by_id": str(USER_ID),
        }
        chain.execute = AsyncMock(return_value=MagicMock(data=[epoch_data]))
        sb.table.return_value = chain

        result = await EpochService.create(sb, USER_ID, "Test Epoch")

        assert result["name"] == "Test Epoch"
        assert result["status"] == "lobby"
        insert_call = chain.insert.call_args[0][0]
        assert insert_call["created_by_id"] == str(USER_ID)

    @pytest.mark.asyncio
    async def test_creates_epoch_with_custom_config(self):
        sb = MagicMock()
        chain = _make_chain()
        epoch_data = {"id": str(EPOCH_ID), "name": "Custom", "status": "lobby", "config": {}}
        chain.execute = AsyncMock(return_value=MagicMock(data=[epoch_data]))
        sb.table.return_value = chain

        custom_config = {"duration_days": 7, "rp_per_cycle": 15}
        await EpochService.create(sb, USER_ID, "Custom", config=custom_config)

        insert_call = chain.insert.call_args[0][0]
        assert insert_call["config"]["duration_days"] == 7
        assert insert_call["config"]["rp_per_cycle"] == 15

    @pytest.mark.asyncio
    async def test_raises_on_failed_insert(self):
        sb = MagicMock()
        chain = _make_chain()
        chain.execute = AsyncMock(return_value=MagicMock(data=None))
        sb.table.return_value = chain

        with pytest.raises(HTTPException) as exc:
            await EpochService.create(sb, USER_ID, "Fail")
        assert exc.value.status_code == 500


# ── Epoch Get ──────────────────────────────────────────────────


class TestEpochGet:
    @pytest.mark.asyncio
    async def test_returns_epoch_data(self):
        sb = MagicMock()
        chain = _make_chain()
        epoch_data = {"id": str(EPOCH_ID), "status": "competition", "name": "My Epoch"}
        chain.execute = AsyncMock(return_value=MagicMock(data=epoch_data))
        sb.table.return_value = chain

        result = await EpochService.get(sb, EPOCH_ID)

        assert result["name"] == "My Epoch"

    @pytest.mark.asyncio
    async def test_raises_404_when_not_found(self):
        sb = MagicMock()
        chain = _make_chain()
        chain.execute = AsyncMock(return_value=MagicMock(data=None))
        sb.table.return_value = chain

        with pytest.raises(HTTPException) as exc:
            await EpochService.get(sb, EPOCH_ID)
        assert exc.value.status_code == 404


# ── Epoch Update ───────────────────────────────────────────────


class TestEpochUpdate:
    @pytest.mark.asyncio
    async def test_allows_update_in_lobby(self):
        sb = MagicMock()
        chain = _make_chain()
        epoch_data = {"id": str(EPOCH_ID), "status": "lobby", "name": "Updated"}
        # First call: get epoch; Second call: update
        chain.execute = AsyncMock(side_effect=[
            MagicMock(data={"id": str(EPOCH_ID), "status": "lobby"}),
            MagicMock(data=[epoch_data]),
        ])
        sb.table.return_value = chain

        result = await EpochService.update(sb, EPOCH_ID, {"name": "Updated"})

        assert result["name"] == "Updated"

    @pytest.mark.asyncio
    async def test_rejects_update_in_competition(self):
        sb = MagicMock()
        chain = _make_chain()
        chain.execute = AsyncMock(return_value=MagicMock(
            data={"id": str(EPOCH_ID), "status": "competition"}
        ))
        sb.table.return_value = chain

        with pytest.raises(HTTPException) as exc:
            await EpochService.update(sb, EPOCH_ID, {"name": "Fail"})
        assert exc.value.status_code == 400
        assert "lobby" in exc.value.detail.lower()


# ── Lifecycle Transitions ──────────────────────────────────────


class TestLifecycleTransitions:
    @pytest.mark.asyncio
    @patch("backend.services.epoch_lifecycle_service.BattleLogService.log_phase_change", new_callable=AsyncMock)
    async def test_advance_foundation_to_competition(self, _mock_log):
        sb = MagicMock()
        chain = _make_chain()
        chain.execute = AsyncMock(side_effect=[
            MagicMock(data={"id": str(EPOCH_ID), "status": "foundation", "config": {}}),
            MagicMock(data=[{"id": str(EPOCH_ID), "status": "competition"}]),
        ])
        sb.table.return_value = chain

        await EpochService.advance_phase(sb, EPOCH_ID)

        update_call = chain.update.call_args[0][0]
        assert update_call["status"] == "competition"

    @pytest.mark.asyncio
    @patch("backend.services.epoch_lifecycle_service.BattleLogService.log_phase_change", new_callable=AsyncMock)
    async def test_advance_competition_to_reckoning(self, _mock_log):
        sb = MagicMock()
        chain = _make_chain()
        chain.execute = AsyncMock(side_effect=[
            MagicMock(data={"id": str(EPOCH_ID), "status": "competition", "config": {}}),
            MagicMock(data=[{"id": str(EPOCH_ID), "status": "reckoning"}]),
        ])
        sb.table.return_value = chain

        await EpochService.advance_phase(sb, EPOCH_ID)

        update_call = chain.update.call_args[0][0]
        assert update_call["status"] == "reckoning"

    @pytest.mark.asyncio
    @patch("backend.services.epoch_lifecycle_service.BattleLogService.log_phase_change", new_callable=AsyncMock)
    @patch("backend.services.epoch_lifecycle_service.GameInstanceService")
    async def test_advance_reckoning_to_completed_archives_instances(self, mock_gis, _mock_log):
        mock_gis.archive_instances = AsyncMock()

        sb = MagicMock()
        admin_sb = MagicMock()
        chain = _make_chain()
        chain.execute = AsyncMock(side_effect=[
            MagicMock(data={"id": str(EPOCH_ID), "status": "reckoning", "config": {}}),
            MagicMock(data=[{"id": str(EPOCH_ID), "status": "completed"}]),
        ])
        sb.table.return_value = chain

        await EpochService.advance_phase(sb, EPOCH_ID, admin_supabase=admin_sb)

        mock_gis.archive_instances.assert_called_once()

    @pytest.mark.asyncio
    async def test_cannot_advance_from_lobby(self):
        sb = MagicMock()
        chain = _make_chain()
        chain.execute = AsyncMock(return_value=MagicMock(
            data={"id": str(EPOCH_ID), "status": "lobby", "config": {}}
        ))
        sb.table.return_value = chain

        with pytest.raises(HTTPException) as exc:
            await EpochService.advance_phase(sb, EPOCH_ID)
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_cannot_advance_from_completed(self):
        sb = MagicMock()
        chain = _make_chain()
        chain.execute = AsyncMock(return_value=MagicMock(
            data={"id": str(EPOCH_ID), "status": "completed", "config": {}}
        ))
        sb.table.return_value = chain

        with pytest.raises(HTTPException) as exc:
            await EpochService.advance_phase(sb, EPOCH_ID)
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_cannot_advance_from_cancelled(self):
        sb = MagicMock()
        chain = _make_chain()
        chain.execute = AsyncMock(return_value=MagicMock(
            data={"id": str(EPOCH_ID), "status": "cancelled", "config": {}}
        ))
        sb.table.return_value = chain

        with pytest.raises(HTTPException) as exc:
            await EpochService.advance_phase(sb, EPOCH_ID)
        assert exc.value.status_code == 400


# ── Cancel ─────────────────────────────────────────────────────


class TestCancelEpoch:
    @pytest.mark.asyncio
    @patch("backend.services.epoch_lifecycle_service.BattleLogService.log_phase_change", new_callable=AsyncMock)
    async def test_cancel_lobby_epoch(self, _mock_log):
        sb = MagicMock()
        chain = _make_chain()
        chain.execute = AsyncMock(side_effect=[
            MagicMock(data={"id": str(EPOCH_ID), "status": "lobby"}),
            MagicMock(data=[{"id": str(EPOCH_ID), "status": "cancelled"}]),
        ])
        sb.table.return_value = chain

        await EpochService.cancel_epoch(sb, EPOCH_ID)

        update_call = chain.update.call_args[0][0]
        assert update_call["status"] == "cancelled"

    @pytest.mark.asyncio
    @patch("backend.services.epoch_lifecycle_service.BattleLogService.log_phase_change", new_callable=AsyncMock)
    @patch("backend.services.epoch_lifecycle_service.GameInstanceService")
    async def test_cancel_active_epoch_deletes_instances(self, mock_gis, _mock_log):
        mock_gis.delete_instances = AsyncMock()

        sb = MagicMock()
        admin_sb = MagicMock()
        chain = _make_chain()
        chain.execute = AsyncMock(side_effect=[
            MagicMock(data={"id": str(EPOCH_ID), "status": "competition"}),
            MagicMock(data=[{"id": str(EPOCH_ID), "status": "cancelled"}]),
        ])
        sb.table.return_value = chain

        await EpochService.cancel_epoch(sb, EPOCH_ID, admin_supabase=admin_sb)

        mock_gis.delete_instances.assert_called_once()

    @pytest.mark.asyncio
    async def test_cannot_cancel_completed_epoch(self):
        sb = MagicMock()
        chain = _make_chain()
        chain.execute = AsyncMock(return_value=MagicMock(
            data={"id": str(EPOCH_ID), "status": "completed"}
        ))
        sb.table.return_value = chain

        with pytest.raises(HTTPException) as exc:
            await EpochService.cancel_epoch(sb, EPOCH_ID)
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_cannot_cancel_already_cancelled_epoch(self):
        sb = MagicMock()
        chain = _make_chain()
        chain.execute = AsyncMock(return_value=MagicMock(
            data={"id": str(EPOCH_ID), "status": "cancelled"}
        ))
        sb.table.return_value = chain

        with pytest.raises(HTTPException) as exc:
            await EpochService.cancel_epoch(sb, EPOCH_ID)
        assert exc.value.status_code == 400


# ── Participants ───────────────────────────────────────────────


class TestParticipants:
    @pytest.mark.asyncio
    async def test_join_epoch_in_lobby(self):
        sb = MagicMock()

        # get epoch (lobby)
        epoch_chain = _make_chain()
        epoch_chain.execute = AsyncMock(return_value=MagicMock(
            data={"id": str(EPOCH_ID), "status": "lobby"}
        ))

        # check simulation is template
        sim_chain = _make_chain()
        sim_chain.execute = AsyncMock(return_value=MagicMock(
            data=[{"simulation_type": "template"}]
        ))

        # check not already joined (sim check + user check)
        existing_chain = _make_chain()
        existing_chain.execute = AsyncMock(return_value=MagicMock(data=[]))

        # insert participant
        insert_chain = _make_chain()
        participant = {
            "id": str(uuid4()),
            "epoch_id": str(EPOCH_ID),
            "simulation_id": str(SIM_ID),
        }
        insert_chain.execute = AsyncMock(return_value=MagicMock(data=[participant]))

        call_counts: dict[str, int] = {}

        def table_router(name):
            call_counts[name] = call_counts.get(name, 0) + 1
            if name == "game_epochs":
                return epoch_chain
            if name == "simulations":
                return sim_chain
            if name == "epoch_participants":
                count = call_counts[name]
                if count <= 2:
                    return existing_chain  # sim check + user check
                return insert_chain  # insert
            return _make_chain()

        sb.table.side_effect = table_router

        result = await EpochService.join_epoch(sb, EPOCH_ID, SIM_ID, USER_ID)

        assert result["epoch_id"] == str(EPOCH_ID)

    @pytest.mark.asyncio
    async def test_join_rejects_non_template_simulation(self):
        """Cannot join with a game instance or archived simulation."""
        sb = MagicMock()

        epoch_chain = _make_chain()
        epoch_chain.execute = AsyncMock(return_value=MagicMock(
            data={"id": str(EPOCH_ID), "status": "lobby"}
        ))

        sim_chain = _make_chain()
        sim_chain.execute = AsyncMock(return_value=MagicMock(
            data=[{"simulation_type": "game_instance"}]
        ))

        call_counts: dict[str, int] = {}

        def table_router(name):
            call_counts[name] = call_counts.get(name, 0) + 1
            if name == "game_epochs":
                return epoch_chain
            if name == "simulations":
                return sim_chain
            return _make_chain()

        sb.table.side_effect = table_router

        with pytest.raises(HTTPException) as exc:
            await EpochService.join_epoch(sb, EPOCH_ID, SIM_ID, USER_ID)
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_join_rejects_non_lobby_epoch(self):
        sb = MagicMock()

        epoch_chain = _make_chain()
        epoch_chain.execute = AsyncMock(return_value=MagicMock(
            data={"id": str(EPOCH_ID), "status": "competition"}
        ))

        sb.table.side_effect = lambda name: epoch_chain if name == "game_epochs" else _make_chain()

        with pytest.raises(HTTPException) as exc:
            await EpochService.join_epoch(sb, EPOCH_ID, SIM_ID, USER_ID)
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_join_rejects_duplicate_simulation(self):
        sb = MagicMock()

        epoch_chain = _make_chain()
        epoch_chain.execute = AsyncMock(return_value=MagicMock(
            data={"id": str(EPOCH_ID), "status": "lobby"}
        ))

        sim_chain = _make_chain()
        sim_chain.execute = AsyncMock(return_value=MagicMock(
            data=[{"simulation_type": "template"}]
        ))

        existing_chain = _make_chain()
        existing_chain.execute = AsyncMock(return_value=MagicMock(
            data=[{"id": str(uuid4())}]
        ))

        call_counts: dict[str, int] = {}

        def table_router(name):
            call_counts[name] = call_counts.get(name, 0) + 1
            if name == "game_epochs":
                return epoch_chain
            if name == "simulations":
                return sim_chain
            if name == "epoch_participants":
                return existing_chain
            return _make_chain()

        sb.table.side_effect = table_router

        with pytest.raises(HTTPException) as exc:
            await EpochService.join_epoch(sb, EPOCH_ID, SIM_ID, USER_ID)
        assert exc.value.status_code == 409

    @pytest.mark.asyncio
    async def test_join_rejects_duplicate_user(self):
        """Same user cannot join the same epoch with a different simulation."""
        sb = MagicMock()

        epoch_chain = _make_chain()
        epoch_chain.execute = AsyncMock(return_value=MagicMock(
            data={"id": str(EPOCH_ID), "status": "lobby"}
        ))

        sim_chain = _make_chain()
        sim_chain.execute = AsyncMock(return_value=MagicMock(
            data=[{"simulation_type": "template"}]
        ))

        # sim not already in epoch
        sim_existing_chain = _make_chain()
        sim_existing_chain.execute = AsyncMock(return_value=MagicMock(data=[]))

        # user already in epoch
        user_existing_chain = _make_chain()
        user_existing_chain.execute = AsyncMock(return_value=MagicMock(
            data=[{"id": str(uuid4())}]
        ))

        call_counts: dict[str, int] = {}

        def table_router(name):
            call_counts[name] = call_counts.get(name, 0) + 1
            if name == "game_epochs":
                return epoch_chain
            if name == "simulations":
                return sim_chain
            if name == "epoch_participants":
                count = call_counts[name]
                if count == 1:
                    return sim_existing_chain  # sim check passes
                return user_existing_chain  # user check fails
            return _make_chain()

        sb.table.side_effect = table_router

        with pytest.raises(HTTPException) as exc:
            await EpochService.join_epoch(sb, EPOCH_ID, SIM_ID, USER_ID)
        assert exc.value.status_code == 409

    @pytest.mark.asyncio
    async def test_leave_epoch_in_lobby(self):
        sb = MagicMock()
        chain = _make_chain()
        chain.execute = AsyncMock(side_effect=[
            MagicMock(data={"id": str(EPOCH_ID), "status": "lobby"}),
            MagicMock(data=[]),  # delete
        ])
        sb.table.return_value = chain

        # Should not raise
        await EpochService.leave_epoch(sb, EPOCH_ID, SIM_ID)

    @pytest.mark.asyncio
    async def test_leave_rejects_non_lobby(self):
        sb = MagicMock()
        chain = _make_chain()
        chain.execute = AsyncMock(return_value=MagicMock(
            data={"id": str(EPOCH_ID), "status": "competition"}
        ))
        sb.table.return_value = chain

        with pytest.raises(HTTPException) as exc:
            await EpochService.leave_epoch(sb, EPOCH_ID, SIM_ID)
        assert exc.value.status_code == 400


# ── Bot Participants ───────────────────────────────────────────


class TestBotParticipants:
    @pytest.mark.asyncio
    async def test_add_bot_in_lobby(self):
        sb = MagicMock()

        epoch_chain = _make_chain()
        epoch_chain.execute = AsyncMock(return_value=MagicMock(
            data={"id": str(EPOCH_ID), "status": "lobby"}
        ))

        bot_chain = _make_chain()
        bot_chain.execute = AsyncMock(return_value=MagicMock(
            data={"id": str(BOT_ID), "name": "TestBot", "personality": "sentinel"}
        ))

        existing_chain = _make_chain()
        existing_chain.execute = AsyncMock(return_value=MagicMock(data=[]))

        insert_chain = _make_chain()
        insert_chain.execute = AsyncMock(return_value=MagicMock(
            data=[{
                "id": str(uuid4()),
                "epoch_id": str(EPOCH_ID),
                "simulation_id": str(SIM_ID),
                "is_bot": True,
                "bot_player_id": str(BOT_ID),
            }]
        ))

        call_counts: dict[str, int] = {}

        def table_router(name):
            call_counts[name] = call_counts.get(name, 0) + 1
            if name == "game_epochs":
                return epoch_chain
            if name == "bot_players":
                return bot_chain
            if name == "epoch_participants":
                count = call_counts[name]
                if count == 1:
                    return existing_chain
                return insert_chain
            return _make_chain()

        sb.table.side_effect = table_router

        result = await EpochService.add_bot(sb, EPOCH_ID, SIM_ID, BOT_ID)

        assert result["is_bot"] is True
        assert result["bot_player_id"] == str(BOT_ID)

    @pytest.mark.asyncio
    async def test_add_bot_rejects_non_lobby(self):
        sb = MagicMock()
        chain = _make_chain()
        chain.execute = AsyncMock(return_value=MagicMock(
            data={"id": str(EPOCH_ID), "status": "competition"}
        ))
        sb.table.return_value = chain

        with pytest.raises(HTTPException) as exc:
            await EpochService.add_bot(sb, EPOCH_ID, SIM_ID, BOT_ID)
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_add_bot_rejects_missing_bot(self):
        sb = MagicMock()

        epoch_chain = _make_chain()
        epoch_chain.execute = AsyncMock(return_value=MagicMock(
            data={"id": str(EPOCH_ID), "status": "lobby"}
        ))

        bot_chain = _make_chain()
        bot_chain.execute = AsyncMock(return_value=MagicMock(data=None))

        def table_router(name):
            if name == "game_epochs":
                return epoch_chain
            if name == "bot_players":
                return bot_chain
            return _make_chain()

        sb.table.side_effect = table_router

        with pytest.raises(HTTPException) as exc:
            await EpochService.add_bot(sb, EPOCH_ID, SIM_ID, BOT_ID)
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_add_bot_rejects_duplicate_simulation(self):
        sb = MagicMock()

        epoch_chain = _make_chain()
        epoch_chain.execute = AsyncMock(return_value=MagicMock(
            data={"id": str(EPOCH_ID), "status": "lobby"}
        ))

        bot_chain = _make_chain()
        bot_chain.execute = AsyncMock(return_value=MagicMock(
            data={"id": str(BOT_ID), "name": "Bot", "personality": "sentinel"}
        ))

        existing_chain = _make_chain()
        existing_chain.execute = AsyncMock(return_value=MagicMock(
            data=[{"id": str(uuid4())}]
        ))

        def table_router(name):
            if name == "game_epochs":
                return epoch_chain
            if name == "bot_players":
                return bot_chain
            if name == "epoch_participants":
                return existing_chain
            return _make_chain()

        sb.table.side_effect = table_router

        with pytest.raises(HTTPException) as exc:
            await EpochService.add_bot(sb, EPOCH_ID, SIM_ID, BOT_ID)
        assert exc.value.status_code == 409

    @pytest.mark.asyncio
    async def test_remove_bot_in_lobby(self):
        participant_id = uuid4()
        sb = MagicMock()

        epoch_chain = _make_chain()
        epoch_chain.execute = AsyncMock(return_value=MagicMock(
            data={"id": str(EPOCH_ID), "status": "lobby"}
        ))

        p_chain = _make_chain()
        p_chain.execute = AsyncMock(return_value=MagicMock(
            data={"id": str(participant_id), "is_bot": True}
        ))

        delete_chain = _make_chain()
        delete_chain.execute = AsyncMock(return_value=MagicMock(data=[]))

        call_counts: dict[str, int] = {}

        def table_router(name):
            call_counts[name] = call_counts.get(name, 0) + 1
            if name == "game_epochs":
                return epoch_chain
            if name == "epoch_participants":
                count = call_counts[name]
                if count == 1:
                    return p_chain  # select
                return delete_chain  # delete
            return _make_chain()

        sb.table.side_effect = table_router

        await EpochService.remove_bot(sb, EPOCH_ID, participant_id)

    @pytest.mark.asyncio
    async def test_remove_bot_rejects_non_bot_participant(self):
        participant_id = uuid4()
        sb = MagicMock()

        epoch_chain = _make_chain()
        epoch_chain.execute = AsyncMock(return_value=MagicMock(
            data={"id": str(EPOCH_ID), "status": "lobby"}
        ))

        p_chain = _make_chain()
        p_chain.execute = AsyncMock(return_value=MagicMock(
            data={"id": str(participant_id), "is_bot": False}
        ))

        def table_router(name):
            if name == "game_epochs":
                return epoch_chain
            if name == "epoch_participants":
                return p_chain
            return _make_chain()

        sb.table.side_effect = table_router

        with pytest.raises(HTTPException) as exc:
            await EpochService.remove_bot(sb, EPOCH_ID, participant_id)
        assert exc.value.status_code == 400
        assert "not a bot" in exc.value.detail.lower()


# ── RP Management ──────────────────────────────────────────────


class TestRPManagement:
    # grant_rp_batch and resolve_cycle tests moved to integration tests
    # (backend/tests/integration/test_cycle_resolution.py) which run against
    # real Supabase with real RPCs. Only mock-stable spend_rp edge cases remain.

    @pytest.mark.asyncio
    async def test_spend_rp_success(self):
        sb = MagicMock()
        chain = _make_chain()
        # select: current_rp=20
        # update: success
        chain.execute = AsyncMock(side_effect=[
            MagicMock(data={"id": "p1", "current_rp": 20}),
            MagicMock(data=[{"id": "p1", "current_rp": 15}]),
        ])
        sb.table.return_value = chain

        result = await EpochService.spend_rp(sb, EPOCH_ID, SIM_ID, 5)

        assert result == 15

    @pytest.mark.asyncio
    async def test_spend_rp_insufficient_balance(self):
        sb = MagicMock()
        chain = _make_chain()
        chain.execute = AsyncMock(return_value=MagicMock(
            data={"id": "p1", "current_rp": 3}
        ))
        sb.table.return_value = chain

        with pytest.raises(HTTPException) as exc:
            await EpochService.spend_rp(sb, EPOCH_ID, SIM_ID, 5)
        assert exc.value.status_code == 400
        assert "insufficient" in exc.value.detail.lower()

    @pytest.mark.asyncio
    async def test_spend_rp_not_a_participant(self):
        sb = MagicMock()
        chain = _make_chain()
        chain.execute = AsyncMock(return_value=MagicMock(data=None))
        sb.table.return_value = chain

        with pytest.raises(HTTPException) as exc:
            await EpochService.spend_rp(sb, EPOCH_ID, SIM_ID, 5)
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_spend_rp_optimistic_lock_conflict(self):
        sb = MagicMock()
        chain = _make_chain()
        chain.execute = AsyncMock(side_effect=[
            MagicMock(data={"id": "p1", "current_rp": 20}),
            MagicMock(data=[]),  # optimistic lock failed (empty update response)
        ])
        sb.table.return_value = chain

        with pytest.raises(HTTPException) as exc:
            await EpochService.spend_rp(sb, EPOCH_ID, SIM_ID, 5)
        assert exc.value.status_code == 409
        assert "concurrently" in exc.value.detail.lower()


# ── Resolve Cycle ──────────────────────────────────────────────


class TestResolveCycle:
    # test_resolve_increments_cycle and test_resolve_foundation_grants_bonus_rp
    # moved to integration tests (backend/tests/integration/test_cycle_resolution.py).

    @pytest.mark.asyncio
    async def test_resolve_rejects_lobby_phase(self):
        sb = MagicMock()
        chain = _make_chain()
        chain.execute = AsyncMock(return_value=MagicMock(
            data={"id": str(EPOCH_ID), "status": "lobby", "config": {}, "current_cycle": 1}
        ))
        sb.table.return_value = chain

        with pytest.raises(HTTPException) as exc:
            await EpochService.resolve_cycle(sb, EPOCH_ID)
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_resolve_rejects_completed_phase(self):
        sb = MagicMock()
        chain = _make_chain()
        chain.execute = AsyncMock(return_value=MagicMock(
            data={"id": str(EPOCH_ID), "status": "completed", "config": {}, "current_cycle": 10}
        ))
        sb.table.return_value = chain

        with pytest.raises(HTTPException) as exc:
            await EpochService.resolve_cycle(sb, EPOCH_ID)
        assert exc.value.status_code == 400



# ── Operative RP Costs ─────────────────────────────────────────


class TestOperativeRPCosts:
    def test_spy_costs_3(self):
        assert OPERATIVE_RP_COSTS["spy"] == 3

    def test_guardian_costs_4(self):
        assert OPERATIVE_RP_COSTS["guardian"] == 4

    def test_saboteur_costs_5(self):
        assert OPERATIVE_RP_COSTS["saboteur"] == 5

    def test_propagandist_costs_4(self):
        assert OPERATIVE_RP_COSTS["propagandist"] == 4

    def test_assassin_costs_7(self):
        assert OPERATIVE_RP_COSTS["assassin"] == 7

    def test_infiltrator_costs_5(self):
        assert OPERATIVE_RP_COSTS["infiltrator"] == 5


# ── Default Config ─────────────────────────────────────────────


class TestDefaultConfig:
    def test_default_rp_per_cycle(self):
        assert DEFAULT_CONFIG["rp_per_cycle"] == 12

    def test_default_rp_cap(self):
        assert DEFAULT_CONFIG["rp_cap"] == 40

    def test_default_duration_days(self):
        assert DEFAULT_CONFIG["duration_days"] == 14

    def test_default_max_team_size(self):
        assert DEFAULT_CONFIG["max_team_size"] == 3

    def test_default_allow_betrayal(self):
        assert DEFAULT_CONFIG["allow_betrayal"] is True
