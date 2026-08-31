"""The trigger, without which the reminder is a template nobody sends.

Handoff P2.17. The mail exists since the previous commit; this is the sweep that
decides who gets it and when. What it must get right:

  * only players who have NOT filed, and never bots
  * once per player and cycle — a warning sent twice is noise, and noise is
    unsubscribed from
  * only what actually happens in THIS epoch: measured on production, not one of
    the seven has `afk_penalty_enabled` set, so threatening an RP loss would
    threaten something that does not occur
  * a failing reminder must never stop the resolution sweep in the same tick
"""

from __future__ import annotations

import ast
import inspect
import textwrap
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

import pytest

from backend.services.epoch_cycle_scheduler import EpochCycleScheduler


def _epoch(**overrides) -> dict:
    epoch = {
        "id": "11111111-1111-1111-1111-111111111111",
        "name": "The Gaslit Reach",
        "current_cycle": 3,
        "config": {},
        "cycle_deadline_at": (datetime.now(UTC) + timedelta(hours=2)).isoformat(),
    }
    epoch.update(overrides)
    return epoch


class _Table:
    """Minimal stand-in for the supabase query chain, one table at a time."""

    def __init__(self, rows):
        self._rows = rows

    def select(self, *_a, **_k):
        return self

    def eq(self, *_a, **_k):
        return self

    def gt(self, *_a, **_k):
        return self

    def lte(self, *_a, **_k):
        return self

    def in_(self, *_a, **_k):
        return self

    @property
    def not_(self):
        return self

    def is_(self, *_a, **_k):
        return self

    async def execute(self):
        return type("R", (), {"data": self._rows})()


def _admin(*, participants, already_sent):
    tables = {
        "epoch_participants": _Table(participants),
        "email_log": _Table(already_sent),
    }
    return type("A", (), {"table": staticmethod(lambda name: tables[name])})()


async def _run(epoch, participants, recipients, already_sent=()):
    sent: list[dict] = []

    async def _send(to, subject, html, **kwargs):
        sent.append({"to": to, "subject": subject, "html": html, **kwargs})
        return True

    with (
        patch(
            "backend.services.epoch_cycle_scheduler.CycleNotificationService.recipients_for",
            AsyncMock(return_value=list(recipients)),
        ),
        patch("backend.services.epoch_cycle_scheduler.EmailService.send", _send),
    ):
        await EpochCycleScheduler._remind_open_orders(
            _admin(participants=participants, already_sent=list(already_sent)),
            epoch,
            now=datetime.now(UTC),
        )
    return sent


_ALICE = {
    "user_id": "aaa", "email": "a@example.com",
    "simulation_id": "sim-a", "email_locale": "de",
}
_BOB = {
    "user_id": "bbb", "email": "b@example.com",
    "simulation_id": "sim-b", "email_locale": "en",
}


class TestWhoGetsIt:
    @pytest.mark.asyncio
    async def test_only_players_who_have_not_filed(self):
        sent = await _run(
            _epoch(),
            participants=[{"user_id": "aaa", "consecutive_afk_cycles": 0}],
            recipients=[_ALICE, _BOB],
        )
        assert [s["to"] for s in sent] == ["a@example.com"], "Bob hatte eingereicht"

    @pytest.mark.asyncio
    async def test_nobody_pending_sends_nothing(self):
        assert await _run(_epoch(), participants=[], recipients=[_ALICE]) == []

    @pytest.mark.asyncio
    async def test_a_player_already_warned_is_skipped(self):
        """Once per player and cycle. A warning sent twice is noise."""
        sent = await _run(
            _epoch(),
            participants=[{"user_id": "aaa", "consecutive_afk_cycles": 0}],
            recipients=[_ALICE],
            already_sent=[{"recipient_user_id": "aaa"}],
        )
        assert sent == []

    @pytest.mark.asyncio
    async def test_it_carries_the_log_label(self):
        """Without `record` the send is invisible to the idempotency lookup —
        and the next tick, thirty seconds later, would send it again."""
        sent = await _run(
            _epoch(),
            participants=[{"user_id": "aaa", "consecutive_afk_cycles": 0}],
            recipients=[_ALICE],
        )
        record = sent[0]["record"]
        assert record.template == "deadline_reminder"
        assert record.user_id == "aaa"
        assert record.cycle_number == 3

    @pytest.mark.asyncio
    async def test_it_offers_one_click_unsubscribe(self):
        sent = await _run(
            _epoch(),
            participants=[{"user_id": "aaa", "consecutive_afk_cycles": 0}],
            recipients=[_ALICE],
        )
        # Diese Zusicherung hielt bis zum 31.08.2026 den DEFEKT fest: sie
        # verlangte `category=deadline_reminder` in der URL — also genau die
        # ungezeichnete Form `{site}/unsubscribe?category=…`, die der Endpunkt
        # gar nicht annimmt (er verlangt ein `token`, min_length 8). Der
        # List-Unsubscribe-Kopf zeigte damit auf eine Adresse, die niemanden
        # abmelden kann, und der Test bestätigte das.
        #
        # Geprüft wird jetzt die Form, die funktioniert: die API-Route und ein
        # gezeichnetes Token. Der Kategoriename steht IM Token, nicht in der
        # Abfrage — deshalb wird er nicht mehr in der URL gesucht.
        url = sent[0]["unsubscribe_url"]
        assert "/api/v1/unsubscribe?token=" in url, url
        from backend.utils.unsubscribe_tokens import verify_token

        verified = verify_token(url.split("token=", 1)[1])
        assert verified is not None, "das Token ist nicht gültig gezeichnet"
        assert verified[1] == "deadline_reminder", verified


class TestItThreatensOnlyWhatTheEpochDoes:
    @pytest.mark.asyncio
    async def test_without_the_penalty_enabled_no_rp_is_threatened(self):
        """The production case: none of the seven epochs has it switched on."""
        sent = await _run(
            _epoch(config={}),
            participants=[{"user_id": "aaa", "consecutive_afk_cycles": 5}],
            recipients=[_ALICE],
        )
        assert "Du verlierst" not in sent[0]["html"]
        assert "ohne deine Befehle gewertet" in sent[0]["html"]

    @pytest.mark.asyncio
    async def test_with_the_penalty_enabled_the_real_number_is_named(self):
        sent = await _run(
            _epoch(config={"afk_penalty_enabled": True, "afk_rp_penalty": 2}),
            participants=[{"user_id": "aaa", "consecutive_afk_cycles": 0}],
            recipients=[_ALICE],
        )
        assert "Du verlierst 2 RP" in sent[0]["html"]

    @pytest.mark.asyncio
    async def test_the_ai_warning_needs_the_next_miss_to_cross_the_threshold(self):
        base = {"afk_penalty_enabled": True, "afk_escalation_threshold": 3}
        far = await _run(
            _epoch(config=base),
            participants=[{"user_id": "aaa", "consecutive_afk_cycles": 0}],
            recipients=[_ALICE],
        )
        near = await _run(
            _epoch(config=base),
            participants=[{"user_id": "aaa", "consecutive_afk_cycles": 2}],
            recipients=[_ALICE],
        )
        assert "an eine KI" not in far[0]["html"], "droht zu früh"
        assert "an eine KI" in near[0]["html"], "droht nicht, obwohl der nächste Zyklus reicht"


class TestTheSweepIsWiredAndCannotBlockResolution:
    def test_the_tick_runs_both_sweeps(self):
        source = textwrap.dedent(
            inspect.getsource(EpochCycleScheduler._process_tick.__func__)
        )
        called = {
            node.func.attr
            for node in ast.walk(ast.parse(source))
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
        }
        assert "_sweep_deadline_reminders" in called, "Die Erinnerung wird nie ausgelöst"
        assert "_sweep_expired_cycles" in called, "Die Auflösung wurde verdrängt"

    def test_a_failing_reminder_is_caught_per_epoch(self):
        """Missing a warning is bad; missing the resolution is worse."""
        source = textwrap.dedent(
            inspect.getsource(EpochCycleScheduler._sweep_deadline_reminders.__func__)
        )
        assert "except" in source and "capture_exception" in source

    def test_the_lead_time_is_named_once(self):
        from backend.services.epoch_cycle_scheduler import _REMINDER_LEAD_HOURS

        assert _REMINDER_LEAD_HOURS == 2
