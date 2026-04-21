"""Unit tests for backend/services/content_packs/orphan_sweeper_scheduler.py.

Covers:
    - _parse_positive_float: bare/quoted/invalid/non-positive.
    - _parse_last_run_at: bare ISO, quoted ISO, Z-suffix, None, 'null',
      naive timestamp, invalid.
    - _is_due: first-run fires, within-interval defers, past-interval fires,
      clock-skew defers.
    - _load_config: reads all four settings, falls back to defaults on
      missing keys, keeps defaults when platform_settings fetch raises.
    - _process_tick: skips when not due, runs + persists when due,
      reports Sentry on error_count>0, skips gracefully when
      GITHUB_REPO_* env vars are unset.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from backend.models.content_drafts import (
    OrphanBranchClassification,
    SweepOrphansResult,
)
from backend.services.content_packs import orphan_sweeper_scheduler as ss
from backend.services.content_packs.orphan_sweeper import DEFAULT_MIN_AGE_DAYS
from backend.services.content_packs.orphan_sweeper_scheduler import (
    OrphanSweeperScheduler,
    _is_due,
    _parse_last_run_at,
    _parse_positive_float,
)

# ── Constants ────────────────────────────────────────────────────────────

_NOW = datetime(2026, 4, 21, 12, 0, 0, tzinfo=UTC)


def _classification(name: str, *, status: str, deleted: bool = False, error: str | None = None) -> OrphanBranchClassification:
    return OrphanBranchClassification(
        name=name,
        sha="a" * 40,
        age_days=1.0,
        pr_number=None,
        pr_state=None,
        status=status,
        reason="test",
        deleted=deleted,
        error=error,
    )


def _result(*, branches: list[OrphanBranchClassification], dry_run: bool = False) -> SweepOrphansResult:
    return SweepOrphansResult(
        dry_run=dry_run,
        total_found=len(branches),
        kept_count=sum(1 for b in branches if b.status == "keep"),
        deleted_count=sum(1 for b in branches if b.deleted),
        error_count=sum(1 for b in branches if b.error is not None),
        branches=branches,
    )


def _admin_mock_with_update() -> tuple[MagicMock, AsyncMock]:
    """Return (admin, execute_mock). admin.table('...').update(...).eq(...).execute()."""
    admin = MagicMock()
    chain = MagicMock()
    chain.update.return_value = chain
    chain.eq.return_value = chain
    execute = AsyncMock(return_value=MagicMock(data=None))
    chain.execute = execute
    admin.table.return_value = chain
    return admin, execute


# ── _parse_positive_float ────────────────────────────────────────────────


class TestParsePositiveFloat:
    def test_bare_float(self) -> None:
        assert _parse_positive_float(7.0, 999.0) == 7.0

    def test_quoted_string(self) -> None:
        assert _parse_positive_float('"7.5"', 999.0) == 7.5

    def test_int(self) -> None:
        assert _parse_positive_float(14, 999.0) == 14.0

    def test_invalid_string_returns_default(self) -> None:
        assert _parse_positive_float("not-a-number", 42.0) == 42.0

    def test_none_returns_default(self) -> None:
        assert _parse_positive_float(None, 42.0) == 42.0

    def test_zero_returns_default(self) -> None:
        # Zero would cause an always-fire loop; reject it.
        assert _parse_positive_float(0.0, 42.0) == 42.0

    def test_negative_returns_default(self) -> None:
        assert _parse_positive_float(-3.0, 42.0) == 42.0


# ── _parse_last_run_at ───────────────────────────────────────────────────


class TestParseLastRunAt:
    def test_none_returns_none(self) -> None:
        assert _parse_last_run_at(None) is None

    def test_quoted_iso_with_z(self) -> None:
        dt = _parse_last_run_at('"2026-04-21T12:00:00Z"')
        assert dt == _NOW

    def test_quoted_iso_with_offset(self) -> None:
        dt = _parse_last_run_at('"2026-04-21T12:00:00+00:00"')
        assert dt == _NOW

    def test_bare_iso(self) -> None:
        dt = _parse_last_run_at("2026-04-21T12:00:00+00:00")
        assert dt == _NOW

    def test_literal_null_string(self) -> None:
        # Some postgrest paths serialize JSON null as the string 'null'.
        assert _parse_last_run_at("null") is None

    def test_empty_string(self) -> None:
        assert _parse_last_run_at('""') is None

    def test_naive_gets_utc_tz(self) -> None:
        # Defensive: a naive timestamp shouldn't crash comparisons.
        dt = _parse_last_run_at("2026-04-21T12:00:00")
        assert dt == _NOW

    def test_invalid_returns_none(self) -> None:
        assert _parse_last_run_at("yesterday") is None


# ── _is_due ──────────────────────────────────────────────────────────────


class TestIsDue:
    def test_first_run_always_fires(self) -> None:
        assert _is_due(now=_NOW, last_run_at=None, interval_days=7.0) is True

    def test_within_interval_defers(self) -> None:
        recent = _NOW - timedelta(days=3)
        assert _is_due(now=_NOW, last_run_at=recent, interval_days=7.0) is False

    def test_exactly_at_interval_fires(self) -> None:
        boundary = _NOW - timedelta(days=7)
        assert _is_due(now=_NOW, last_run_at=boundary, interval_days=7.0) is True

    def test_past_interval_fires(self) -> None:
        old = _NOW - timedelta(days=14)
        assert _is_due(now=_NOW, last_run_at=old, interval_days=7.0) is True

    def test_clock_skew_defers(self) -> None:
        # Future-dated last_run_at (VM clock reset) should not repeat-fire
        # until wall-time catches up.
        future = _NOW + timedelta(hours=1)
        assert _is_due(now=_NOW, last_run_at=future, interval_days=7.0) is False


# ── _load_config ─────────────────────────────────────────────────────────


class TestLoadConfig:
    @pytest.mark.asyncio
    async def test_reads_all_four_settings(self) -> None:
        admin = MagicMock()
        raw = {
            "orphan_sweeper_enabled": "true",
            "orphan_sweeper_interval_days": 5.0,
            "orphan_sweeper_min_age_days": 20.0,
            "orphan_sweeper_last_run_at": '"2026-04-15T00:00:00Z"',
        }
        with patch.object(ss, "load_platform_settings", AsyncMock(return_value=raw)):
            config = await OrphanSweeperScheduler._load_config(admin)
        assert config["enabled"] is True
        assert config["interval_days"] == 5.0
        assert config["min_age_days"] == 20.0
        assert config["last_run_at"] == datetime(2026, 4, 15, tzinfo=UTC)

    @pytest.mark.asyncio
    async def test_missing_keys_use_defaults(self) -> None:
        admin = MagicMock()
        with patch.object(ss, "load_platform_settings", AsyncMock(return_value={})):
            config = await OrphanSweeperScheduler._load_config(admin)
        assert config["enabled"] is False
        assert config["interval_days"] == 7.0
        assert config["min_age_days"] == DEFAULT_MIN_AGE_DAYS
        assert config["last_run_at"] is None
        assert config["interval"] == ss._CHECK_INTERVAL_SECONDS

    @pytest.mark.asyncio
    async def test_fetch_error_falls_back_to_defaults(self) -> None:
        admin = MagicMock()
        with patch.object(
            ss, "load_platform_settings", AsyncMock(side_effect=KeyError("boom")),
        ):
            config = await OrphanSweeperScheduler._load_config(admin)
        # Defaults preserved despite the raised error.
        assert config["enabled"] is False
        assert config["interval_days"] == 7.0


# ── _process_tick ────────────────────────────────────────────────────────


class TestProcessTick:
    @pytest.mark.asyncio
    async def test_not_due_is_a_noop(self) -> None:
        admin, execute = _admin_mock_with_update()
        config = {
            "interval_days": 7.0,
            "min_age_days": 14.0,
            "last_run_at": _NOW - timedelta(days=1),
        }
        sweep = AsyncMock()
        get_client = MagicMock()
        with patch.object(ss, "sweep_orphan_branches", sweep), \
             patch.object(ss, "get_github_app_client", get_client), \
             patch.object(ss, "get_github_repo_config", MagicMock(return_value=("o", "r"))):
            await OrphanSweeperScheduler._process_tick(admin, config)
        sweep.assert_not_called()
        get_client.assert_not_called()
        execute.assert_not_called()

    @pytest.mark.asyncio
    async def test_due_runs_sweep_and_persists_timestamp(self) -> None:
        admin, execute = _admin_mock_with_update()
        config = {
            "interval_days": 7.0,
            "min_age_days": 14.0,
            "last_run_at": _NOW - timedelta(days=8),
        }
        result = _result(branches=[
            _classification("content/drafts-batch-aaa", status="delete", deleted=True),
            _classification("content/drafts-batch-bbb", status="keep"),
        ])
        sweep = AsyncMock(return_value=result)
        with patch.object(ss, "sweep_orphan_branches", sweep), \
             patch.object(ss, "get_github_app_client", MagicMock()), \
             patch.object(ss, "get_github_repo_config", MagicMock(return_value=("o", "r"))):
            await OrphanSweeperScheduler._process_tick(admin, config)
        # Sweep ran with dry_run=False + our min_age_days.
        kwargs = sweep.await_args.kwargs
        assert kwargs["dry_run"] is False
        assert kwargs["min_age_days"] == 14.0
        # last_run_at was persisted (admin.update was executed).
        execute.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_first_run_fires_and_persists(self) -> None:
        admin, execute = _admin_mock_with_update()
        config = {
            "interval_days": 7.0,
            "min_age_days": 14.0,
            "last_run_at": None,
        }
        result = _result(branches=[])
        sweep = AsyncMock(return_value=result)
        with patch.object(ss, "sweep_orphan_branches", sweep), \
             patch.object(ss, "get_github_app_client", MagicMock()), \
             patch.object(ss, "get_github_repo_config", MagicMock(return_value=("o", "r"))):
            await OrphanSweeperScheduler._process_tick(admin, config)
        sweep.assert_awaited_once()
        execute.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_github_env_missing_skips_gracefully(self) -> None:
        admin, execute = _admin_mock_with_update()
        config = {
            "interval_days": 7.0,
            "min_age_days": 14.0,
            "last_run_at": None,
        }
        sweep = AsyncMock()
        with patch.object(ss, "sweep_orphan_branches", sweep), \
             patch.object(ss, "get_github_app_client", MagicMock()), \
             patch.object(
                 ss,
                 "get_github_repo_config",
                 MagicMock(side_effect=HTTPException(status_code=400, detail="missing env")),
             ):
            await OrphanSweeperScheduler._process_tick(admin, config)
        # Nothing ran; last_run_at NOT advanced so next tick retries.
        sweep.assert_not_called()
        execute.assert_not_called()

    @pytest.mark.asyncio
    async def test_error_count_pushes_sentry_message(self) -> None:
        admin, execute = _admin_mock_with_update()
        config = {
            "interval_days": 7.0,
            "min_age_days": 14.0,
            "last_run_at": None,
        }
        result = _result(branches=[
            _classification("content/drafts-batch-aaa", status="delete", error="422: already gone"),
            _classification("content/drafts-batch-bbb", status="delete", deleted=True),
        ])
        sweep = AsyncMock(return_value=result)
        capture = MagicMock()
        with patch.object(ss, "sweep_orphan_branches", sweep), \
             patch.object(ss, "get_github_app_client", MagicMock()), \
             patch.object(ss, "get_github_repo_config", MagicMock(return_value=("o", "r"))), \
             patch.object(ss.sentry_sdk, "capture_message", capture):
            await OrphanSweeperScheduler._process_tick(admin, config)
        # Still persists last_run_at — partial failure doesn't block the clock.
        execute.assert_awaited_once()
        # Sentry got paged with the summary.
        capture.assert_called_once()
        msg, *_ = capture.call_args.args
        assert "1 delete failure" in msg

    @pytest.mark.asyncio
    async def test_report_runs_before_persist(self) -> None:
        """Report-then-persist ordering preserves observability when
        platform_settings updates fail — without it, a persist error
        swallows the sweep summary and admins only see a vague loop-error
        Sentry page with no context on what the sweep did.
        """
        admin = MagicMock()
        # Persist call raises — we want to verify the report still happened.
        chain = MagicMock()
        chain.update.return_value = chain
        chain.eq.return_value = chain
        chain.execute = AsyncMock(side_effect=RuntimeError("db down"))
        admin.table.return_value = chain

        config = {
            "interval_days": 7.0,
            "min_age_days": 14.0,
            "last_run_at": None,
        }
        result = _result(branches=[
            _classification("x", status="delete", deleted=True),
        ])
        sweep = AsyncMock(return_value=result)
        info_log = MagicMock()
        with patch.object(ss, "sweep_orphan_branches", sweep), \
             patch.object(ss, "get_github_app_client", MagicMock()), \
             patch.object(ss, "get_github_repo_config", MagicMock(return_value=("o", "r"))), \
             patch.object(ss.logger, "info", info_log):
            with pytest.raises(RuntimeError):
                await OrphanSweeperScheduler._process_tick(admin, config)
        # Despite the persist failure, the result summary was logged.
        # Two info calls total: "starting" + "complete".
        messages = [call.args[0] for call in info_log.call_args_list]
        assert any("complete" in m for m in messages), (
            f"Expected 'complete' log before persist failure; got {messages}"
        )

    @pytest.mark.asyncio
    async def test_no_errors_does_not_call_sentry(self) -> None:
        admin, _ = _admin_mock_with_update()
        config = {
            "interval_days": 7.0,
            "min_age_days": 14.0,
            "last_run_at": None,
        }
        result = _result(branches=[_classification("x", status="keep")])
        sweep = AsyncMock(return_value=result)
        capture = MagicMock()
        with patch.object(ss, "sweep_orphan_branches", sweep), \
             patch.object(ss, "get_github_app_client", MagicMock()), \
             patch.object(ss, "get_github_repo_config", MagicMock(return_value=("o", "r"))), \
             patch.object(ss.sentry_sdk, "capture_message", capture):
            await OrphanSweeperScheduler._process_tick(admin, config)
        capture.assert_not_called()


# ── _persist_last_run_at ─────────────────────────────────────────────────


class TestPersistLastRunAt:
    @pytest.mark.asyncio
    async def test_writes_iso_string_with_outer_quotes(self) -> None:
        admin = MagicMock()
        chain = MagicMock()
        chain.update.return_value = chain
        chain.eq.return_value = chain
        chain.execute = AsyncMock(return_value=MagicMock(data=None))
        admin.table.return_value = chain

        await ss._persist_last_run_at(admin, _NOW)

        admin.table.assert_called_once_with("platform_settings")
        update_args = chain.update.call_args.args[0]
        assert update_args == {"setting_value": '"2026-04-21T12:00:00+00:00"'}
        chain.eq.assert_called_once_with("setting_key", "orphan_sweeper_last_run_at")
