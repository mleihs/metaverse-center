"""Which cycle the post reports, and when it is posted.

Regression cover for two defects the 2026-08-30 system review measured (E1, E6):

* **E1** — since ``202e350c`` scores, mission log, alliance tension and the
  journal signature are filed under the *resolved* cycle, while
  ``send_cycle_notifications`` kept being handed the freshly incremented one.
  Every query in ``_build_player_briefing`` is keyed on that number, so the
  briefing asked for a cycle that had no rows yet: "RANK #0 / 0", no dimension
  bars, no mission results. Nothing failed, nothing was logged — the mail simply
  described an empty cycle.
* **E6** — the phase transition happens inside ``fn_advance_epoch_cycle``, i.e.
  before this pipeline computes the cycle's scores. The completion mail was sent
  from that transition, so it named a winner derived from the second-to-last
  cycle and could contradict the results page.

Both are about ORDER and NUMBERING, not about failure handling, which is why no
existing test caught them: every call succeeded.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from backend.services.cycle_resolution_service import CycleResolutionService

EPOCH_ID = uuid4()


def _mock_chain(**overrides):
    c = MagicMock()
    for method in ("select", "eq", "in_", "neq", "lte", "or_", "single",
                   "maybe_single", "limit", "order", "insert", "update", "delete"):
        setattr(c, method, MagicMock(return_value=c))
    for k, v in overrides.items():
        setattr(c, k, v)
    return c


def _mock_supabase(table_map=None, rpc_map=None):
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


class _Pipeline:
    """Runs ``resolve_cycle_full`` with every collaborator patched out.

    ``resolve_cycle`` is patched to report the state AFTER the advance: the epoch
    row it returns carries ``current_cycle`` = the new cycle, exactly as
    ``fn_advance_epoch_cycle`` leaves it.
    """

    def __init__(self, *, new_cycle: int = 8, participants: list[dict] | None = None):
        self.new_cycle = new_cycle
        self.participants = participants if participants is not None else []
        self.order: list[str] = []

    async def run(self):
        async def _advance(*args, **kwargs):
            self.order.append("advance")
            return {"config": {"cycle_hours": 8}, "current_cycle": self.new_cycle}

        resolve_cycle = AsyncMock(side_effect=_advance)

        with patch("backend.services.alliance_service.AllianceService") as alliance, \
             patch("backend.services.operative_service.OperativeService") as operative, \
             patch("backend.services.scoring_service.ScoringService") as scoring, \
             patch("backend.services.bot_service.BotService") as bot, \
             patch("backend.services.cycle_notification_service.CycleNotificationService") as notif, \
             patch("backend.services.cycle_resolution_service.BattleLogService") as battle, \
             patch("backend.services.cycle_resolution_service.enqueue_epoch_signature", new=AsyncMock()), \
             patch.object(CycleResolutionService, "resolve_cycle", new=resolve_cycle), \
             patch("backend.services.cycle_resolution_service.sentry_sdk"):

            battle.log_phase_change = AsyncMock()
            alliance.deduct_upkeep = AsyncMock(return_value=[])
            alliance.expire_proposals = AsyncMock(return_value=0)
            alliance.compute_tension = AsyncMock(return_value=[])
            alliance.clear_dissolved_team_ids = AsyncMock()
            operative.resolve_pending_missions = AsyncMock(return_value=[])
            bot.execute_bot_cycle = AsyncMock()

            async def _scored(*args, **kwargs):
                self.order.append("scoring")

            async def _briefing(*args, **kwargs):
                self.order.append("cycle_mail")
                return 1

            async def _completed(*args, **kwargs):
                self.order.append("completed_mail")
                return 1

            async def _phase(*args, **kwargs):
                self.order.append("phase_mail")
                return 1

            async def _snapshot_read(*args, **kwargs):
                self.order.append("snapshot")
                return MagicMock(data=self.participants)

            scoring.compute_cycle_scores = AsyncMock(side_effect=_scored)
            notif.send_cycle_notifications = AsyncMock(side_effect=_briefing)
            notif.send_epoch_completed_notifications = AsyncMock(side_effect=_completed)
            notif.send_phase_change_notifications = AsyncMock(side_effect=_phase)

            sb = _mock_supabase(
                table_map={
                    "game_epochs": _mock_chain(
                        execute=AsyncMock(return_value=MagicMock(data={"config": {}, "status": "competition"}))
                    ),
                    "epoch_participants": _mock_chain(execute=AsyncMock(side_effect=_snapshot_read)),
                },
            )

            await CycleResolutionService.resolve_cycle_full(sb, EPOCH_ID, sb)

            self.resolve_cycle = resolve_cycle
            self.scoring = scoring
            self.notif = notif
            return self


class TestBriefingReportsTheResolvedCycle:
    @pytest.mark.asyncio
    async def test_mail_is_sent_for_the_cycle_that_just_ended(self):
        """E1: ``current_cycle`` is 8 after the advance — the mail reports 7."""
        pipeline = await _Pipeline(new_cycle=8).run()

        call = pipeline.notif.send_cycle_notifications.await_args
        assert call.args[2] == 7, "briefing must report the resolved cycle, not the new one"

    @pytest.mark.asyncio
    async def test_scores_and_briefing_agree_on_the_cycle(self):
        """The number the mail asks for is the number the scores were filed under.

        The two used to drift apart silently: scoring wrote cycle 7, the mail read
        cycle 8, and an empty result set is indistinguishable from a bad cycle.
        """
        pipeline = await _Pipeline(new_cycle=8).run()

        scored_cycle = pipeline.scoring.compute_cycle_scores.await_args.args[2]
        mailed_cycle = pipeline.notif.send_cycle_notifications.await_args.args[2]
        assert scored_cycle == mailed_cycle == 7


class TestParticipationIsCapturedBeforeTheFlagsAreCleared:
    @pytest.mark.asyncio
    async def test_snapshot_is_taken_before_the_advance(self):
        """``fn_advance_epoch_cycle`` resets ``has_acted_this_cycle`` (migration 263).

        Read afterwards the briefing would always print "0 of N acted"; the count
        therefore has to be taken before ``resolve_cycle`` runs.
        """
        pipeline = await _Pipeline(
            new_cycle=4,
            participants=[
                {"has_acted_this_cycle": True, "is_bot": False},
                {"has_acted_this_cycle": False, "is_bot": False},
                {"has_acted_this_cycle": True, "is_bot": True},
            ],
        ).run()

        participation = pipeline.notif.send_cycle_notifications.await_args.kwargs["participation"]
        assert participation == {"acted": 1, "total": 2}, "bots must not count towards participation"

        # The number alone would still be green if the read happened after the
        # advance and the mock simply never cleared the flags. Assert the order.
        assert pipeline.order.index("snapshot") < pipeline.order.index("advance")

    @pytest.mark.asyncio
    async def test_a_failing_snapshot_does_not_abort_the_resolution(self):
        """The count decorates a briefing — it must never cost a resolved cycle."""
        with patch.object(
            CycleResolutionService, "_snapshot_participation",
            new=AsyncMock(return_value={"acted": 0, "total": 0}),
        ):
            pipeline = await _Pipeline(new_cycle=3).run()

        assert pipeline.notif.send_cycle_notifications.await_count == 1


class TestCompletionMailWaitsForTheScores:
    @pytest.mark.asyncio
    async def test_completed_mail_is_sent_after_scoring(self):
        """E6: the winner named in the mail must be the winner on the results page."""

        async def _resolve(cls_supabase, epoch_id, admin_supabase=None, *, deferred_notifications=None):
            # Mimic fn_advance_epoch_cycle transitioning the epoch to 'completed'
            # inside the same call that advances the cycle.
            await CycleResolutionService._apply_phase_transition(
                _mock_supabase(), epoch_id, 6, "reckoning", "completed",
                admin_supabase=_mock_supabase(),
                deferred_notifications=deferred_notifications,
            )
            return {"config": {}, "current_cycle": 6}

        with patch("backend.services.alliance_service.AllianceService") as alliance, \
             patch("backend.services.operative_service.OperativeService") as operative, \
             patch("backend.services.scoring_service.ScoringService") as scoring, \
             patch("backend.services.bot_service.BotService") as bot, \
             patch("backend.services.cycle_notification_service.CycleNotificationService") as notif, \
             patch("backend.services.cycle_resolution_service.BattleLogService") as battle, \
             patch("backend.services.cycle_resolution_service.GameInstanceService") as instances, \
             patch("backend.services.cycle_resolution_service.enqueue_epoch_signature", new=AsyncMock()), \
             patch.object(CycleResolutionService, "resolve_cycle", new=AsyncMock(side_effect=_resolve)), \
             patch("backend.services.cycle_resolution_service.sentry_sdk"):

            battle.log_phase_change = AsyncMock()
            instances.archive_instances = AsyncMock()

            alliance.deduct_upkeep = AsyncMock(return_value=[])
            alliance.expire_proposals = AsyncMock(return_value=0)
            alliance.compute_tension = AsyncMock(return_value=[])
            alliance.clear_dissolved_team_ids = AsyncMock()
            operative.resolve_pending_missions = AsyncMock(return_value=[])
            bot.execute_bot_cycle = AsyncMock()

            order: list[str] = []

            async def _scored(*args, **kwargs):
                order.append("scoring")

            async def _completed(*args, **kwargs):
                order.append("completed_mail")
                return 1

            scoring.compute_cycle_scores = AsyncMock(side_effect=_scored)
            notif.send_cycle_notifications = AsyncMock(return_value=1)
            notif.send_epoch_completed_notifications = AsyncMock(side_effect=_completed)

            sb = _mock_supabase(
                table_map={
                    "game_epochs": _mock_chain(
                        execute=AsyncMock(return_value=MagicMock(data={"config": {}, "status": "completed"}))
                    ),
                },
            )

            await CycleResolutionService.resolve_cycle_full(sb, EPOCH_ID, sb)

        assert order == ["scoring", "completed_mail"], (
            "the completion mail must not be sent from inside the phase transition"
        )

    @pytest.mark.asyncio
    async def test_direct_resolve_cycle_still_sends_immediately(self):
        """Callers that do not defer keep the old behaviour — no silent mail loss."""
        sent: list[str] = []

        with patch("backend.services.cycle_notification_service.CycleNotificationService") as notif, \
             patch("backend.services.cycle_resolution_service.BattleLogService") as battle, \
             patch("backend.services.cycle_resolution_service.GameInstanceService") as instances:

            battle.log_phase_change = AsyncMock()
            instances.archive_instances = AsyncMock()

            async def _phase(*args, **kwargs):
                sent.append("phase_mail")
                return 1

            notif.send_phase_change_notifications = AsyncMock(side_effect=_phase)

            await CycleResolutionService._apply_phase_transition(
                _mock_supabase(), EPOCH_ID, 3, "foundation", "competition",
            )

        assert sent == ["phase_mail"]
