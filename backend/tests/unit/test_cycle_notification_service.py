"""Unit tests for CycleNotificationService — recipient resolution and briefing assembly."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from backend.services.cycle_notification_service import CycleNotificationService

# ── Helpers ────────────────────────────────────────────────────

EPOCH_ID = str(uuid4())
SIM_A = str(uuid4())
SIM_B = str(uuid4())
TEMPLATE_A = str(uuid4())
TEMPLATE_B = str(uuid4())
USER_A = str(uuid4())
USER_B = str(uuid4())


def _make_chain(**kwargs):
    """Create a mock Supabase query chain."""
    c = MagicMock()
    c.select.return_value = c
    c.eq.return_value = c
    c.in_.return_value = c
    c.or_.return_value = c
    c.single.return_value = c
    c.maybe_single.return_value = c
    c.limit.return_value = c
    c.order.return_value = c
    c.range.return_value = c
    c.neq.return_value = c
    c.is_.return_value = c
    for k, v in kwargs.items():
        setattr(c, k, v)
    return c


# ── Recipient Resolution ──────────────────────────────────────


class TestResolveRecipients:
    """E7: the post goes to the PLAYER, not to the owner of the world played.

    ``epoch_participants.user_id`` (migration 049) is the participant's identity
    and carries a CHECK that makes it non-null for every human. The old chain
    ignored it and walked ``simulations.source_template_id → simulation_members``
    instead, so the briefings — spy intel included — went to whoever owned the
    template, while the person actually playing received nothing.
    """

    @staticmethod
    def _client(*, participants, emails, prefs=None, templates=None):
        """Assemble a Supabase mock for the recipient chain."""
        admin_sb = MagicMock()

        chains = {
            "epoch_participants": _make_chain(
                execute=AsyncMock(return_value=MagicMock(data=participants))
            ),
            "notification_preferences": _make_chain(
                execute=AsyncMock(return_value=MagicMock(data=prefs or []))
            ),
            "simulations": _make_chain(
                execute=AsyncMock(return_value=MagicMock(data=templates or []))
            ),
        }
        admin_sb.table.side_effect = lambda name: chains.get(name, _make_chain())

        rpc_mock = MagicMock()
        rpc_mock.execute = AsyncMock(return_value=MagicMock(data=emails))
        admin_sb.rpc.return_value = rpc_mock
        admin_sb.chains = chains
        return admin_sb

    @pytest.mark.asyncio
    async def test_the_player_receives_the_post(self):
        admin_sb = self._client(
            participants=[
                {"user_id": USER_A, "simulation_id": SIM_A,
                 "simulations": {"name": "Velgarien (Epoch 15)", "slug": "velgarien-e15",
                                 "source_template_id": TEMPLATE_A}},
            ],
            emails=[{"id": USER_A, "email": "player@test.com"}],
            templates=[{"id": TEMPLATE_A, "slug": "velgarien", "name": "Velgarien"}],
        )

        recipients = await CycleNotificationService._resolve_recipients(
            admin_sb, EPOCH_ID, notification_type="cycle_resolved",
        )

        assert len(recipients) == 1
        assert recipients[0]["email"] == "player@test.com"
        assert recipients[0]["user_id"] == USER_A
        # Accent colour and world name come from the TEMPLATE, not from the
        # game instance, which is named "Velgarien (Epoch 15)".
        assert recipients[0]["simulation_slug"] == "velgarien"
        assert recipients[0]["simulation_name"] == "Velgarien"

    @pytest.mark.asyncio
    async def test_simulation_members_is_never_consulted(self):
        """The owner chain must be gone, not merely outvoted.

        Asserting only on the returned addresses would stay green if the code
        still walked simulation_members and happened to find the same person.
        """
        admin_sb = self._client(
            participants=[
                {"user_id": USER_A, "simulation_id": SIM_A,
                 "simulations": {"name": "Velgarien", "slug": "velgarien",
                                 "source_template_id": TEMPLATE_A}},
            ],
            emails=[{"id": USER_A, "email": "player@test.com"}],
            templates=[{"id": TEMPLATE_A, "slug": "velgarien", "name": "Velgarien"}],
        )

        await CycleNotificationService._resolve_recipients(admin_sb, EPOCH_ID)

        tables = [call.args[0] for call in admin_sb.table.call_args_list]
        assert "simulation_members" not in tables

    @pytest.mark.asyncio
    async def test_bot_participants_are_excluded_at_the_query(self):
        admin_sb = self._client(participants=[], emails=[])

        await CycleNotificationService._resolve_recipients(admin_sb, EPOCH_ID)

        eq_calls = {c.args[0]: c.args[1] for c in admin_sb.chains["epoch_participants"].eq.call_args_list}
        assert eq_calls["is_bot"] is False

    @pytest.mark.asyncio
    async def test_respects_notification_preference_opt_out(self):
        admin_sb = self._client(
            participants=[
                {"user_id": USER_A, "simulation_id": SIM_A,
                 "simulations": {"name": "Velgarien", "slug": "velgarien",
                                 "source_template_id": TEMPLATE_A}},
            ],
            emails=[{"id": USER_A, "email": "player@test.com"}],
            prefs=[{"user_id": USER_A, "cycle_resolved": False, "phase_changed": True,
                    "epoch_completed": True, "email_locale": "en"}],
            templates=[{"id": TEMPLATE_A, "slug": "velgarien", "name": "Velgarien"}],
        )

        optee = await CycleNotificationService._resolve_recipients(
            admin_sb, EPOCH_ID, notification_type="cycle_resolved",
        )
        assert optee == []

        # The same person still gets the mail types they did not opt out of —
        # otherwise the test above would pass on a broken chain that drops
        # everybody.
        still = await CycleNotificationService._resolve_recipients(
            admin_sb, EPOCH_ID, notification_type="epoch_completed",
        )
        assert len(still) == 1
        assert still[0]["email_locale"] == "en"

    @pytest.mark.asyncio
    async def test_participant_without_an_address_is_skipped(self):
        """A deleted account leaves a participant row behind."""
        admin_sb = self._client(
            participants=[
                {"user_id": USER_A, "simulation_id": SIM_A,
                 "simulations": {"name": "A", "slug": "a", "source_template_id": TEMPLATE_A}},
                {"user_id": USER_B, "simulation_id": SIM_B,
                 "simulations": {"name": "B", "slug": "b", "source_template_id": TEMPLATE_B}},
            ],
            emails=[{"id": USER_B, "email": "b@test.com"}],
            templates=[
                {"id": TEMPLATE_A, "slug": "a", "name": "A"},
                {"id": TEMPLATE_B, "slug": "b", "name": "B"},
            ],
        )

        recipients = await CycleNotificationService._resolve_recipients(admin_sb, EPOCH_ID)

        assert [r["user_id"] for r in recipients] == [USER_B]


class TestAcademyDeliveryPolicy:
    """E8/B8: an academy run resolves 18 cycles in an afternoon.

    It stays silent except for the closing report.
    """

    def test_cycle_and_phase_mail_are_suppressed(self):
        academy = {"epoch_type": "academy"}
        assert CycleNotificationService._suppressed_for_epoch(academy, "cycle_resolved")
        assert CycleNotificationService._suppressed_for_epoch(academy, "phase_changed")

    def test_the_closing_report_still_goes_out(self):
        academy = {"epoch_type": "academy"}
        assert not CycleNotificationService._suppressed_for_epoch(academy, "epoch_completed")

    def test_a_normal_epoch_is_never_suppressed(self):
        for kind in ({"epoch_type": "standard"}, {"epoch_type": None}, {}):
            for notification in ("cycle_resolved", "phase_changed", "epoch_completed"):
                assert not CycleNotificationService._suppressed_for_epoch(kind, notification)


    @pytest.mark.asyncio
    async def test_empty_participants_returns_empty(self):
        """No participants → no recipients."""
        admin_sb = MagicMock()

        participants_chain = _make_chain()
        participants_chain.execute = AsyncMock(return_value=MagicMock(data=[]))

        admin_sb.table.return_value = participants_chain

        recipients = await CycleNotificationService._resolve_recipients(
            admin_sb, EPOCH_ID,
        )

        assert recipients == []


# ── Player Briefing Data ──────────────────────────────────────


class TestBuildPlayerBriefing:
    @pytest.mark.asyncio
    async def test_returns_expected_keys(self):
        """Briefing data should contain all expected fields."""
        admin_sb = MagicMock()

        # Current scores
        current_chain = _make_chain()
        current_chain.execute = AsyncMock(return_value=MagicMock(data=[
            {
                "simulation_id": SIM_A,
                "composite_score": 72.3,
                "stability_score": 60.0,
                "influence_score": 45.0,
                "sovereignty_score": 88.0,
                "diplomatic_score": 55.0,
                "military_score": 30.0,
            },
        ]))

        # Previous scores (cycle 0 → no previous)
        prev_chain = _make_chain()
        prev_chain.execute = AsyncMock(return_value=MagicMock(data=[]))

        # Operatives
        ops_chain = _make_chain()
        ops_chain.execute = AsyncMock(return_value=MagicMock(data=[
            {"operative_type": "spy", "status": "active", "target_simulation_id": SIM_B, "resolves_at": None},
            {"operative_type": "guardian", "status": "active", "target_simulation_id": None, "resolves_at": None},
            {"operative_type": "saboteur", "status": "success", "target_simulation_id": SIM_B, "resolves_at": None},
        ]))

        # Target sim names
        names_chain = _make_chain()
        names_chain.execute = AsyncMock(return_value=MagicMock(data=[
            {"id": SIM_B, "name": "The Gaslit Reach"},
        ]))

        # RP + team_id
        rp_chain = _make_chain()
        rp_chain.execute = AsyncMock(return_value=MagicMock(data={"current_rp": 18, "team_id": None}))

        # Threats (B1)
        threat_chain = _make_chain()
        threat_chain.execute = AsyncMock(return_value=MagicMock(data=[]))

        # Spy intel (B2)
        intel_chain = _make_chain()
        intel_chain.execute = AsyncMock(return_value=MagicMock(data=[]))

        # Battle log
        log_chain = _make_chain()
        log_chain.execute = AsyncMock(return_value=MagicMock(data=[
            {"narrative": "An operative was detected.", "event_type": "detection"},
        ]))

        # Participation counts (for _participation_counts query)
        participants_chain = _make_chain()
        participants_chain.execute = AsyncMock(return_value=MagicMock(data=[
            {"has_acted_this_cycle": True, "is_bot": False, "consecutive_afk_cycles": 0, "afk_replaced_by_ai": False},
        ]))

        call_count = {"scores": 0, "operative_missions": 0, "simulations": 0, "battle_log": 0, "epoch_participants": 0}

        def table_side_effect(name):
            if name == "epoch_scores":
                call_count["scores"] += 1
                if call_count["scores"] <= 2:
                    return current_chain
                return prev_chain
            if name == "operative_missions":
                call_count["operative_missions"] += 1
                if call_count["operative_missions"] == 1:
                    return ops_chain
                return threat_chain
            if name == "simulations":
                return names_chain
            if name == "epoch_participants":
                call_count["epoch_participants"] += 1
                if call_count["epoch_participants"] == 1:
                    return rp_chain
                return participants_chain
            if name == "battle_log":
                call_count["battle_log"] += 1
                if call_count["battle_log"] == 1:
                    return intel_chain  # Spy intel
                return log_chain  # Public events
            if name == "epoch_teams":
                return _make_chain()
            return _make_chain()

        admin_sb.table.side_effect = table_side_effect

        briefing = await CycleNotificationService._build_player_briefing(
            admin_sb, EPOCH_ID, SIM_A, 1, "Test Epoch", "competition",
        )

        assert briefing["epoch_name"] == "Test Epoch"
        assert briefing["cycle_number"] == 1
        assert briefing["rank"] == 1
        assert briefing["composite"] == 72.3
        assert len(briefing["dimensions"]) == 5
        assert briefing["active_ops"] == 2  # spy + guardian
        assert briefing["success_ops"] == 1  # saboteur
        assert briefing["guardians"] == 1
        assert briefing["rp_balance"] == 18
        assert len(briefing["public_events"]) == 1

        # New enrichment fields
        assert "threats" in briefing
        assert "spy_intel" in briefing
        assert "missions" in briefing
        assert "rank_gap" in briefing
        assert "alliance_name" in briefing
        assert "next_cycle_missions" in briefing
        assert "next_cycle_rp_projection" in briefing
        assert "accent_color" in briefing

    @pytest.mark.asyncio
    async def test_mission_details_exclude_defensive_ops(self):
        """B7: Guardian/counter_intel ops should not appear in per-mission log."""
        admin_sb = MagicMock()

        current_chain = _make_chain()
        current_chain.execute = AsyncMock(return_value=MagicMock(data=[
            {
                "simulation_id": SIM_A,
                "composite_score": 50.0,
                "stability_score": 50.0,
                "influence_score": 50.0,
                "sovereignty_score": 50.0,
                "diplomatic_score": 50.0,
                "military_score": 50.0,
            },
        ]))

        ops_chain = _make_chain()
        ops_chain.execute = AsyncMock(return_value=MagicMock(data=[
            {"operative_type": "guardian", "status": "active", "target_simulation_id": None, "resolves_at": None},
            {"operative_type": "spy", "status": "success", "target_simulation_id": SIM_B, "resolves_at": None},
        ]))

        names_chain = _make_chain()
        names_chain.execute = AsyncMock(return_value=MagicMock(data=[{"id": SIM_B, "name": "Target"}]))

        rp_chain = _make_chain()
        rp_chain.execute = AsyncMock(return_value=MagicMock(
            data={"current_rp": 10, "team_id": None},
        ))

        participants_chain = _make_chain()
        participants_chain.execute = AsyncMock(return_value=MagicMock(data=[
            {"has_acted_this_cycle": True, "is_bot": False, "consecutive_afk_cycles": 0, "afk_replaced_by_ai": False},
        ]))

        empty_chain = _make_chain()
        empty_chain.execute = AsyncMock(return_value=MagicMock(data=[]))

        call_count = {"operative_missions": 0, "battle_log": 0, "epoch_participants": 0}

        def table_side_effect(name):
            if name == "epoch_scores":
                return current_chain
            if name == "operative_missions":
                call_count["operative_missions"] += 1
                if call_count["operative_missions"] == 1:
                    return ops_chain
                return empty_chain
            if name == "simulations":
                return names_chain
            if name == "epoch_participants":
                call_count["epoch_participants"] += 1
                if call_count["epoch_participants"] == 1:
                    return rp_chain  # single participant (rp + team)
                return participants_chain  # participation counts
            if name == "battle_log":
                call_count["battle_log"] += 1
                return empty_chain
            return _make_chain()

        admin_sb.table.side_effect = table_side_effect

        briefing = await CycleNotificationService._build_player_briefing(
            admin_sb, EPOCH_ID, SIM_A, 1, "Test", "competition",
        )

        # Only spy should appear in missions, not guardian
        assert len(briefing["missions"]) == 1
        assert briefing["missions"][0]["type"] == "spy"


# ── Standing Snapshot ─────────────────────────────────────────


class TestBuildStandingSnapshot:
    @pytest.mark.asyncio
    async def test_returns_standing_data(self):
        """C1: Standing snapshot returns rank and composite."""
        admin_sb = MagicMock()

        scores_chain = _make_chain()
        scores_chain.execute = AsyncMock(return_value=MagicMock(data=[
            {"simulation_id": SIM_A, "composite_score": 80.0},
            {"simulation_id": SIM_B, "composite_score": 60.0},
        ]))

        admin_sb.table.return_value = scores_chain

        result = await CycleNotificationService._build_standing_snapshot(
            admin_sb, EPOCH_ID, SIM_A, scored_cycle=5,
        )

        assert result is not None
        assert result["rank"] == 1
        assert result["total_players"] == 2
        assert result["composite"] == 80.0

    @pytest.mark.asyncio
    async def test_scopes_query_to_a_single_cycle(self):
        """E5: the standing must be ranked within ONE cycle, not across all of them.

        Without the filter the query returned one epoch_scores row per player
        PER CYCLE, so four players over five cycles read as "rank 7 of 20".
        """
        admin_sb = MagicMock()

        scores_chain = _make_chain()
        scores_chain.execute = AsyncMock(return_value=MagicMock(data=[
            {"simulation_id": SIM_A, "composite_score": 80.0},
        ]))
        admin_sb.table.return_value = scores_chain

        await CycleNotificationService._build_standing_snapshot(
            admin_sb, EPOCH_ID, SIM_A, scored_cycle=5,
        )

        eq_calls = {call.args[0]: call.args[1] for call in scores_chain.eq.call_args_list}
        assert eq_calls["cycle_number"] == 5
        assert eq_calls["epoch_id"] == EPOCH_ID

    @pytest.mark.asyncio
    async def test_resolves_the_latest_scored_cycle_when_none_given(self):
        """Called without a cycle, the snapshot asks ScoringService — one source."""
        admin_sb = MagicMock()

        scores_chain = _make_chain()
        scores_chain.execute = AsyncMock(return_value=MagicMock(data=[
            {"simulation_id": SIM_A, "composite_score": 80.0},
        ]))
        admin_sb.table.return_value = scores_chain

        with patch(
            "backend.services.scoring_service.ScoringService.resolve_latest_scored_cycle",
            new_callable=AsyncMock,
        ) as resolve:
            resolve.return_value = 7
            result = await CycleNotificationService._build_standing_snapshot(
                admin_sb, EPOCH_ID, SIM_A,
            )

        resolve.assert_awaited_once()
        assert result is not None
        eq_calls = {call.args[0]: call.args[1] for call in scores_chain.eq.call_args_list}
        assert eq_calls["cycle_number"] == 7

    @pytest.mark.asyncio
    async def test_returns_none_when_no_scores(self):
        admin_sb = MagicMock()

        scores_chain = _make_chain()
        scores_chain.execute = AsyncMock(return_value=MagicMock(data=[]))

        admin_sb.table.return_value = scores_chain

        result = await CycleNotificationService._build_standing_snapshot(
            admin_sb, EPOCH_ID, SIM_A, scored_cycle=5,
        )

        assert result is None


# ── Campaign Stats ────────────────────────────────────────────


class TestBuildCampaignStats:
    @pytest.mark.asyncio
    async def test_computes_stats(self):
        """D1: Campaign stats should compute totals and success rate."""
        admin_sb = MagicMock()

        ops_chain = _make_chain()
        ops_chain.execute = AsyncMock(return_value=MagicMock(data=[
            {"operative_type": "spy", "status": "success"},
            {"operative_type": "spy", "status": "failed"},
            {"operative_type": "saboteur", "status": "success"},
            {"operative_type": "guardian", "status": "active"},
        ]))

        admin_sb.table.return_value = ops_chain

        stats = await CycleNotificationService._build_campaign_stats(
            admin_sb, EPOCH_ID, SIM_A,
        )

        assert stats["total_ops"] == 4
        # 2 successes out of 3 resolved (spy success, spy failed, saboteur success)
        assert abs(stats["success_rate"] - 66.7) < 0.1
        assert stats["by_type"]["spy"] == 2
        assert stats["by_type"]["saboteur"] == 1
        assert stats["by_type"]["guardian"] == 1


# ── Send Methods ──────────────────────────────────────────────


class TestSendCycleNotifications:
    @pytest.mark.asyncio
    async def test_skips_when_smtp_not_configured(self):
        """Should return False when SMTP is not configured."""
        with patch("backend.services.email_service.settings") as mock_settings:
            mock_settings.resend_api_key = ""
            mock_settings.smtp_host = ""
            mock_settings.smtp_user = ""
            mock_settings.smtp_password = ""

            from backend.services.email_service import EmailService

            result = await EmailService.send(
                "test@example.com", "Test Subject", "<p>Test</p>"
            )

            assert result is False

    @pytest.mark.asyncio
    async def test_send_email_via_smtp(self):
        """Should return True when SMTP send succeeds."""
        from backend.services.email_service import EmailService

        with patch.object(EmailService, "_send_sync", return_value=True) as mock_sync:
            with patch("backend.services.email_service.settings") as mock_settings:
                mock_settings.resend_api_key = ""
                mock_settings.smtp_host = "mail.example.com"
                mock_settings.smtp_user = "user"
                mock_settings.smtp_password = "pass"

                result = await EmailService.send(
                    "test@example.com", "Test Subject", "<p>Test</p>"
                )

                assert result is True
                mock_sync.assert_called_once()
