"""The floor under a cycle — `EpochConfig.min_cycle_minutes`.

`cycle_deadline_at` caps how LONG a cycle may run. Nothing capped how SHORT it
may be: with `activity_gated` (the default for every epoch created since
2026-08-29) four quick ready-clicks resolve a cycle in seconds, and an
"8-hour cycle" becomes whatever the fastest four players agree on.

The floor does not BLOCK resolution — a cycle nobody can end would be worse
than one that ends early. When everyone is ready before the floor, the deadline
is pulled forward to the earliest legal moment and the existing deadline
machinery ends it there.

These tests pin the decision function, which is where every edge case lives.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from backend.models.epoch import DEFAULT_EPOCH_CONFIG, EpochConfig
from backend.services.epoch_chat_service import EpochChatService

earliest = EpochChatService._earliest_resolve_at


def _row(started_minutes_ago: float | None) -> dict:
    if started_minutes_ago is None:
        return {}
    started = datetime.now(UTC) - timedelta(minutes=started_minutes_ago)
    return {"cycle_started_at": started.isoformat()}


class TestCycleFloor:
    def test_off_by_default_so_existing_epochs_are_unchanged(self):
        assert DEFAULT_EPOCH_CONFIG["min_cycle_minutes"] == 0
        assert earliest(_row(0), dict(DEFAULT_EPOCH_CONFIG)) is None

    def test_holds_a_cycle_that_is_younger_than_the_floor(self):
        at = earliest(_row(2), {"min_cycle_minutes": 30})
        assert at is not None
        assert at > datetime.now(UTC)

    def test_lets_a_cycle_go_once_the_floor_has_elapsed(self):
        assert earliest(_row(31), {"min_cycle_minutes": 30}) is None

    def test_a_floor_it_cannot_compute_never_stalls_a_cycle(self):
        """An absent or malformed start must read as "no floor", not as "wait"."""
        assert earliest({}, {"min_cycle_minutes": 30}) is None
        assert earliest({"cycle_started_at": None}, {"min_cycle_minutes": 30}) is None
        assert earliest({"cycle_started_at": "not a timestamp"}, {"min_cycle_minutes": 30}) is None

    def test_naive_timestamps_are_read_as_utc(self):
        naive = (datetime.now(UTC) - timedelta(minutes=1)).replace(tzinfo=None)
        at = earliest({"cycle_started_at": naive.isoformat()}, {"min_cycle_minutes": 30})
        assert at is not None

    def test_the_bounds_match_the_model(self):
        assert EpochConfig(min_cycle_minutes=0).min_cycle_minutes == 0
        assert EpochConfig(min_cycle_minutes=1440).min_cycle_minutes == 1440
