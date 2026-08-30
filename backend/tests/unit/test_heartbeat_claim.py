"""A world must not be able to stop quietly.

Velgarien last ticked on 25.03.2026 and nobody noticed for five months. Nothing
crashed: the tick for number 47 ran, wrote its chronicle, and failed only on the
last statement — the update of ``simulations.last_heartbeat_tick``. Every run
since recomputed 47, found the completed row, and returned at ``logger.debug``.
The Möbius Academy stopped the same day from the opposite direction: its row for
tick 39 has been ``processing`` ever since, abandoned by a worker that died, and
nothing ever asked how old a ``processing`` row is allowed to be.

Both are the same defect — a claim that could conflict in more ways than it could
answer. These tests pin the four answers, so a fifth silent branch cannot grow
back: reclaim what failed, catch up to what already completed, take over what was
abandoned, and stand aside only for a worker that is genuinely alive.

The last test covers the reason the five months were silent rather than merely
long: ``asyncio.gather(..., return_exceptions=True)`` returns exceptions instead
of raising them, so a tick that dies outside its own handler is a value nobody
reads unless the caller walks the results.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from unittest.mock import patch
from uuid import UUID, uuid4

import pytest

from backend.services.heartbeat_service import HeartbeatService

INTERVAL = 14400  # 4h, the production tick interval
SIM_ID = UUID("11111111-1111-1111-1111-111111111111")
SIM_NAME = "Velgarien"
TICK = 47


# ── Test double ───────────────────────────────────────────────────────────


class _Result:
    def __init__(self, data: list) -> None:
        self.data = data


class _Query:
    """Records one PostgREST chain and hands it back to the client to answer."""

    def __init__(self, client: _FakeClient, table: str) -> None:
        self.client = client
        self.table_name = table
        self.op: str = ""
        self.payload: dict | None = None
        self.filters: dict = {}

    def upsert(self, payload: dict, **_kwargs) -> _Query:
        self.op, self.payload = "upsert", payload
        return self

    def select(self, _columns: str) -> _Query:
        self.op = "select"
        return self

    def update(self, payload: dict) -> _Query:
        self.op, self.payload = "update", payload
        return self

    def eq(self, key: str, value) -> _Query:
        self.filters[key] = value
        return self

    def limit(self, _n: int) -> _Query:
        return self

    async def execute(self) -> _Result:
        self.client.calls.append(self)
        if self.op == "upsert":
            return _Result([] if self.client.row is not None else [self.payload])
        if self.op == "select":
            return _Result([self.client.row] if self.client.row else [])
        return _Result([self.payload])


class _FakeClient:
    """A heartbeats table holding at most the one row the claim will meet."""

    def __init__(self, row: dict | None) -> None:
        self.row = row
        self.calls: list[_Query] = []

    def table(self, name: str) -> _Query:
        return _Query(self, name)

    def writes(self, table: str) -> list[dict]:
        return [c.payload for c in self.calls if c.op == "update" and c.table_name == table]


def _row(status: str, *, age_seconds: float = 0.0, created_at: object = None) -> dict:
    if created_at is None:
        created_at = (datetime.now(UTC) - timedelta(seconds=age_seconds)).isoformat()
    return {"id": str(uuid4()), "status": status, "created_at": created_at}


async def _claim(row: dict | None) -> tuple[UUID | None, _FakeClient]:
    client = _FakeClient(row)
    with patch("backend.services.heartbeat_service.sentry_sdk"):
        claimed = await HeartbeatService._claim_tick(client, SIM_ID, TICK, SIM_NAME, INTERVAL)
    return claimed, client


# ── The four answers to a conflict ────────────────────────────────────────


@pytest.mark.asyncio
async def test_free_tick_is_claimed_outright():
    """No row for this number: the upsert wins and the tick is ours."""
    claimed, client = await _claim(None)

    assert claimed is not None
    upserts = [c for c in client.calls if c.op == "upsert"]
    assert len(upserts) == 1
    assert upserts[0].payload["tick_number"] == TICK
    assert upserts[0].payload["status"] == "processing"


@pytest.mark.asyncio
async def test_failed_tick_is_reclaimed_under_its_own_id():
    row = _row("failed")

    claimed, client = await _claim(row)

    assert claimed == UUID(row["id"])
    assert client.writes("simulation_heartbeats") == [{"status": "processing", "summary": None}]


@pytest.mark.asyncio
async def test_completed_tick_advances_a_lagging_pointer_and_does_not_tick():
    """The Velgarien case: the tick ran, only the pointer stayed behind."""
    completed_at = datetime.now(UTC) - timedelta(days=158)
    row = _row("completed", created_at=completed_at.isoformat())
    before = datetime.now(UTC)

    claimed, client = await _claim(row)

    assert claimed is None, "the tick already ran — running it again would double its effects"
    writes = client.writes("simulations")
    assert len(writes) == 1
    assert writes[0]["last_heartbeat_tick"] == TICK
    # Dated from the row, not from now: the world lived this tick in March.
    assert datetime.fromisoformat(writes[0]["last_heartbeat_at"]) == completed_at
    # …but it is owed its next tick immediately, so the following run computes 48.
    assert datetime.fromisoformat(writes[0]["next_heartbeat_at"]) >= before
    assert client.writes("simulation_heartbeats") == []


@pytest.mark.asyncio
async def test_orphaned_processing_tick_is_reclaimed_after_two_intervals():
    """The Möbius case: a worker that died holding the row."""
    row = _row("processing", age_seconds=2 * INTERVAL + 60)

    claimed, client = await _claim(row)

    assert claimed == UUID(row["id"])
    assert client.writes("simulation_heartbeats") == [{"status": "processing", "summary": None}]


@pytest.mark.asyncio
async def test_processing_tick_with_unreadable_timestamp_is_reclaimed():
    """A row we cannot date blocks the world either way; a duplicate tick is cheaper."""
    row = _row("processing", created_at="not-a-timestamp")

    claimed, _client = await _claim(row)

    assert claimed == UUID(row["id"])


@pytest.mark.asyncio
async def test_young_processing_tick_is_left_to_its_worker():
    row = _row("processing", age_seconds=30)

    claimed, client = await _claim(row)

    assert claimed is None
    assert client.writes("simulation_heartbeats") == []
    assert client.writes("simulations") == []


@pytest.mark.asyncio
async def test_exactly_at_the_boundary_the_row_is_still_its_workers():
    """Just under two intervals is alive; the reclaim must not creep earlier."""
    row = _row("processing", age_seconds=2 * INTERVAL - 60)

    claimed, _client = await _claim(row)

    assert claimed is None


# ── The two states that are neither ───────────────────────────────────────


@pytest.mark.asyncio
async def test_conflict_with_a_vanished_row_stands_down_without_writing():
    """Deleted between the upsert and the read: nothing to reclaim, nothing to heal."""
    client = _FakeClient(None)
    # A conflict the select cannot explain: force the upsert to report one.
    original = _Query.execute

    async def _execute(self: _Query) -> _Result:
        if self.op == "upsert":
            self.client.calls.append(self)
            return _Result([])
        return await original(self)

    with patch.object(_Query, "execute", _execute), patch("backend.services.heartbeat_service.sentry_sdk"):
        claimed = await HeartbeatService._claim_tick(client, SIM_ID, TICK, SIM_NAME, INTERVAL)

    assert claimed is None
    assert client.writes("simulations") == []
    assert client.writes("simulation_heartbeats") == []


@pytest.mark.asyncio
async def test_unknown_status_stands_down_loudly_instead_of_silently():
    row = _row("skipped")

    claimed, client = await _claim(row)

    assert claimed is None
    assert client.writes("simulations") == []
    assert client.writes("simulation_heartbeats") == []


# ── Why the silence lasted ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_a_tick_that_dies_outside_its_handler_is_reported():
    """``return_exceptions=True`` turns a crash into a value — someone must read it."""
    due = [{"id": str(SIM_ID), "name": SIM_NAME, "slug": "velgarien", "next_heartbeat_at": None}]

    class _DueClient:
        def table(self, _name: str):
            return self

        def select(self, _columns: str):
            return self

        def eq(self, _key, _value):
            return self

        def is_(self, _key, _value):
            return self

        async def execute(self):
            return _Result(due)

    boom = RuntimeError("the claim query returned something impossible")

    async def _raise(*_args, **_kwargs):
        raise boom

    with (
        patch.object(HeartbeatService, "_tick_simulation", _raise),
        patch("backend.services.heartbeat_service.sentry_sdk") as sentry,
    ):
        await HeartbeatService._tick_due_simulations(_DueClient(), INTERVAL)

    sentry.capture_exception.assert_called_once_with(boom)
