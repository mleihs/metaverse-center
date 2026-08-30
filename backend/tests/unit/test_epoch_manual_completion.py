"""Ending an epoch by hand must hand out the same awards as ending it by clock.

E10 of the 2026-08-30 system review. ``trg_ach_epoch_score`` (trigger from
migration 190, body rewritten in 194) fires ``AFTER INSERT ON epoch_scores`` and
bails out unless ``game_epochs.status`` already reads 'completed'. The automatic
path satisfies that ordering by accident — ``fn_advance_epoch_cycle`` flips the
status and ``resolve_cycle_full`` scores afterwards. ``advance_phase`` flipped
the status and never scored at all, so a creator who closed their epoch by hand
robbed every player of ``master_strategist`` and ``undefeated``.

The test therefore asserts the ORDER, not merely that scoring happens: a score
row written before the status flip is as silent as no row at all.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from backend.services.epoch_lifecycle_service import EpochLifecycleService

EPOCH_ID = uuid4()
CREATOR_ID = uuid4()


def _chain(**overrides):
    c = MagicMock()
    for method in ("select", "eq", "in_", "update", "insert", "single", "maybe_single", "order", "limit"):
        setattr(c, method, MagicMock(return_value=c))
    for k, v in overrides.items():
        setattr(c, k, v)
    return c


class _Harness:
    def __init__(self, *, status: str, next_status: str, current_cycle: int = 5, epoch_type: str = "standard"):
        self.epoch = {
            "id": str(EPOCH_ID),
            "status": status,
            "current_cycle": current_cycle,
            "epoch_type": epoch_type,
            "created_by_id": str(CREATOR_ID),
        }
        self.next_status = next_status
        self.order: list[str] = []

    async def run(self):
        async def _status_write(*args, **kwargs):
            self.order.append("status_completed")
            return MagicMock(data=[{**self.epoch, "status": self.next_status}])

        async def _scored(*args, **kwargs):
            self.order.append("scoring")
            return []

        async def _closing_mail(*args, **kwargs):
            self.order.append("closing_mail")
            return 0

        epochs_chain = _chain(execute=AsyncMock(side_effect=_status_write))
        sb = MagicMock()
        sb.table = MagicMock(return_value=epochs_chain)
        sb.rpc = MagicMock(return_value=_chain(execute=AsyncMock(return_value=MagicMock(data=None))))

        with patch("backend.services.epoch_service.EpochService.get", new=AsyncMock(return_value=self.epoch)), \
             patch("backend.services.epoch_lifecycle_service.BattleLogService") as battle, \
             patch("backend.services.epoch_lifecycle_service.GameInstanceService") as instances, \
             patch("backend.services.scoring_service.ScoringService") as scoring, \
             patch("backend.services.cycle_notification_service.CycleNotificationService") as notif, \
             patch("backend.services.epoch_lifecycle_service.sentry_sdk"):

            battle.log_phase_change = AsyncMock()
            instances.archive_instances = AsyncMock()
            scoring.compute_cycle_scores = AsyncMock(side_effect=_scored)
            notif.send_epoch_completed_notifications = AsyncMock(side_effect=_closing_mail)
            notif.send_phase_change_notifications = AsyncMock(return_value=0)

            await EpochLifecycleService.advance_phase(sb, EPOCH_ID, sb)

            self.scoring = scoring
            self.notif = notif
            return self


class TestManualCompletionScores:
    @pytest.mark.asyncio
    async def test_final_cycle_is_scored(self):
        harness = await _Harness(status="reckoning", next_status="completed", current_cycle=5).run()

        harness.scoring.compute_cycle_scores.assert_awaited_once()
        assert harness.scoring.compute_cycle_scores.await_args.args[2] == 5, (
            "the cycle players were acting in when the epoch was called off"
        )

    @pytest.mark.asyncio
    async def test_scoring_happens_after_the_status_flip(self):
        """The trigger reads the epoch status — a score row written first is mute."""
        harness = await _Harness(status="reckoning", next_status="completed").run()

        assert harness.order.index("status_completed") < harness.order.index("scoring")

    @pytest.mark.asyncio
    async def test_scoring_precedes_the_closing_mail(self):
        """The winner named in the mail must be the winner the scores produced."""
        harness = await _Harness(status="reckoning", next_status="completed").run()

        harness.notif.send_epoch_completed_notifications.assert_awaited_once()
        assert harness.order == ["status_completed", "scoring", "closing_mail"]

    @pytest.mark.asyncio
    async def test_intermediate_phase_changes_do_not_score(self):
        """Only the transition INTO 'completed' closes the books."""
        harness = await _Harness(status="foundation", next_status="competition").run()

        harness.scoring.compute_cycle_scores.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_a_failing_scoring_still_completes_the_epoch(self):
        """The phase change is the user's action; the award is a consequence."""
        harness = _Harness(status="reckoning", next_status="completed")

        async def _status_write(*args, **kwargs):
            harness.order.append("status_completed")
            return MagicMock(data=[{**harness.epoch, "status": "completed"}])

        epochs_chain = _chain(execute=AsyncMock(side_effect=_status_write))
        sb = MagicMock()
        sb.table = MagicMock(return_value=epochs_chain)
        sb.rpc = MagicMock(return_value=_chain(execute=AsyncMock(return_value=MagicMock(data=None))))

        with patch("backend.services.epoch_service.EpochService.get", new=AsyncMock(return_value=harness.epoch)), \
             patch("backend.services.epoch_lifecycle_service.BattleLogService") as battle, \
             patch("backend.services.epoch_lifecycle_service.GameInstanceService") as instances, \
             patch("backend.services.scoring_service.ScoringService") as scoring, \
             patch("backend.services.cycle_notification_service.CycleNotificationService") as notif, \
             patch("backend.services.epoch_lifecycle_service.sentry_sdk"):

            battle.log_phase_change = AsyncMock()
            instances.archive_instances = AsyncMock()
            scoring.compute_cycle_scores = AsyncMock(side_effect=ValueError("scoring RPC blew up"))
            notif.send_epoch_completed_notifications = AsyncMock(return_value=0)

            result = await EpochLifecycleService.advance_phase(sb, EPOCH_ID, sb)

        assert result["status"] == "completed"
