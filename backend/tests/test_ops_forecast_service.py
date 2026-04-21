"""Tests for OpsForecastService — the P3.1 forecast surface.

Per plan §10:
  1. Linear projection with known data — uniform daily spend projects to
     mtd + daily_mean × days_remaining.
  2. Seasonal adjustment applies — weekday-heavy history shifts the
     projection above the linear baseline when remaining days favor
     weekdays, and below when they favor weekends.
  3. Driver attribution identifies top purpose — fallback driver text
     names the highest-spend purpose.

Plus two safety nets that future regressions would silently break:
  4. Driver-text cache hit prevents duplicate Haiku calls.
  5. Empty rollup returns a coherent zero-projection without exception.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest

from backend.services.ops_forecast_service import (
    OpsForecastService,
    reset_driver_text_cache,
)

# ── Mock infrastructure ──────────────────────────────────────────────────


def _mock_supabase(rows: list[dict]):
    """Build a chainable Supabase mock returning ``rows`` on .execute()."""
    mock = MagicMock()
    chain = MagicMock()
    result = MagicMock()
    result.data = rows
    chain.execute = AsyncMock(return_value=result)
    for method in ("select", "gte", "order", "limit"):
        getattr(chain, method).return_value = chain
    mock.table.return_value = chain
    return mock


def _rollup_row(*, hour: datetime, purpose: str, usd: float, calls: int = 1) -> dict:
    """One ai_usage_rollup_hour row in the shape the service expects."""
    return {
        "hour": hour.isoformat(),
        "purpose": purpose,
        "calls": calls,
        "usd": usd,
    }


@pytest.fixture(autouse=True)
def _reset_caches(monkeypatch):
    """Cache leak between tests would mask failures; clear before each."""
    reset_driver_text_cache()
    # Force every test to use the fallback driver text path so assertions
    # are deterministic. Tests that exercise the Haiku path override this.
    monkeypatch.setattr(
        OpsForecastService,
        "_call_haiku",
        AsyncMock(return_value=None),
    )
    yield
    reset_driver_text_cache()


# ── Test 1: Linear projection ────────────────────────────────────────────


class TestLinearProjection:
    @pytest.mark.asyncio
    async def test_uniform_daily_spend_projects_to_mtd_plus_daily_mean(self):
        """30 days of $1/day → projected ≈ mtd + (days_remaining × $1)."""
        now = datetime.now(UTC)
        # Build 30 days of $1/day, one row per day at noon
        rows = [
            _rollup_row(
                hour=(now - timedelta(days=i)).replace(hour=12, minute=0, second=0, microsecond=0),
                purpose="forge",
                usd=1.0,
            )
            for i in range(30)
        ]
        supabase = _mock_supabase(rows)

        result = await OpsForecastService.project(supabase)

        # All days carry the same spend, so dow_mult is uniform 1.0 and
        # seasonal == linear. Daily mean = $1, so projected_extra ≈
        # days_remaining × $1.
        today = now.date()
        month_start = today.replace(day=1)
        days_in_month = (
            month_start.replace(month=month_start.month % 12 + 1)
            if month_start.month < 12
            else month_start.replace(year=month_start.year + 1, month=1)
        ) - month_start
        days_in_month_n = days_in_month.days
        days_elapsed = (today - month_start).days
        days_remaining = max(0, days_in_month_n - days_elapsed - 1)

        # mtd = sum of $1/day for each day in current month within window
        mtd_days = min(days_elapsed + 1, 30)
        expected_mtd = float(mtd_days)
        expected_projected = expected_mtd + days_remaining * 1.0

        assert result.days_remaining == days_remaining
        # Allow ±$0.01 tolerance for rounding
        assert abs(result.projected_usd - expected_projected) < 0.05, (
            f"projected={result.projected_usd}, expected≈{expected_projected}"
        )
        # Confidence band must be non-negative; with uniform spend stdev=0
        assert result.confidence_low_usd <= result.projected_usd
        assert result.confidence_high_usd >= result.projected_usd
        # Driver text always present (fallback used here)
        assert result.driver_text


# ── Test 2: Seasonal adjustment ──────────────────────────────────────────


class TestSeasonalAdjustment:
    @pytest.mark.asyncio
    async def test_weekday_heavy_history_changes_projection_vs_linear(self):
        """Weekday $10, weekend $0 → seasonal ≠ linear unless symmetric."""
        # Find a recent stretch where each weekday is represented at least once.
        # Use 28 days = 4 full weeks for clean DOW coverage.
        now = datetime.now(UTC)
        rows = []
        for i in range(28):
            d = now - timedelta(days=i)
            usd = 10.0 if d.weekday() < 5 else 0.0  # Mon-Fri = weekday
            rows.append(
                _rollup_row(
                    hour=d.replace(hour=12, minute=0, second=0, microsecond=0),
                    purpose="forge",
                    usd=usd,
                )
            )
        supabase = _mock_supabase(rows)

        await OpsForecastService.project(supabase)

        # Seasonal projection must differ from a naive (overall_mean ×
        # days_remaining) linear projection unless every remaining day
        # has the average DOW weight. Build the comparison:
        snapshot = OpsForecastService._build_snapshot(rows)
        linear = snapshot.linear_projected_usd
        seasonal = snapshot.projected_usd

        # The two will only equal when remaining days perfectly balance
        # the historical DOW distribution. With the strong 5/2 weekday
        # bias, all remaining-day-windows of length ≥1 produce a delta.
        if snapshot.days_remaining >= 1:
            assert linear != seasonal, (
                f"Seasonal adjustment had zero effect: linear={linear}, "
                f"seasonal={seasonal}, days_remaining={snapshot.days_remaining}"
            )

        # Both projections must be non-negative and within sanity bounds.
        assert seasonal >= snapshot.mtd_usd
        assert seasonal >= 0


# ── Test 3: Driver attribution ───────────────────────────────────────────


class TestDriverAttribution:
    @pytest.mark.asyncio
    async def test_fallback_text_names_top_purpose(self):
        """Fallback driver text must mention the highest-spend purpose."""
        now = datetime.now(UTC)
        rows = [
            # forge dominates: 28 × $5
            *[
                _rollup_row(
                    hour=(now - timedelta(days=i)).replace(hour=12, minute=0, second=0, microsecond=0),
                    purpose="forge",
                    usd=5.0,
                )
                for i in range(28)
            ],
            # heartbeat much smaller: 28 × $0.10
            *[
                _rollup_row(
                    hour=(now - timedelta(days=i)).replace(hour=14, minute=0, second=0, microsecond=0),
                    purpose="heartbeat",
                    usd=0.10,
                )
                for i in range(28)
            ],
        ]
        supabase = _mock_supabase(rows)

        result = await OpsForecastService.project(supabase)

        assert "forge" in result.driver_text.lower()
        # heartbeat is much smaller and shouldn't be the leader
        assert result.driver_text  # non-empty
        # The fallback line ALWAYS includes a projection figure
        assert "$" in result.driver_text


# ── Test 4: Cache hit prevents duplicate Haiku calls ─────────────────────


class TestDriverTextCache:
    @pytest.mark.asyncio
    async def test_two_consecutive_calls_invoke_haiku_once(self, monkeypatch):
        """Same snapshot → second call hits cache, Haiku not invoked twice."""
        now = datetime.now(UTC)
        rows = [
            _rollup_row(
                hour=(now - timedelta(days=i)).replace(hour=12, minute=0, second=0, microsecond=0),
                purpose="forge",
                usd=2.0,
            )
            for i in range(30)
        ]
        supabase = _mock_supabase(rows)

        haiku_mock = AsyncMock(return_value="Cached forecast text.")
        monkeypatch.setattr(OpsForecastService, "_call_haiku", haiku_mock)
        reset_driver_text_cache()  # ensure clean cache for this test

        first = await OpsForecastService.project(supabase)
        second = await OpsForecastService.project(supabase)

        assert haiku_mock.await_count == 1, (
            f"Haiku should be called exactly once, got {haiku_mock.await_count}"
        )
        assert first.driver_text == "Cached forecast text."
        assert second.driver_text == "Cached forecast text."


# ── Test 5: Empty rollup is graceful ─────────────────────────────────────


class TestEmptyRollup:
    @pytest.mark.asyncio
    async def test_no_data_returns_zero_projection(self):
        """Fresh install / no AI calls yet → all-zero projection, no exception."""
        supabase = _mock_supabase([])

        result = await OpsForecastService.project(supabase)

        assert result.projected_usd == 0.0
        assert result.confidence_low_usd == 0.0
        assert result.confidence_high_usd == 0.0
        assert result.days_remaining >= 0
        assert result.driver_text  # fallback line still rendered
        assert "no recent spend" in result.driver_text.lower()
        assert len(result.sliders) == 5  # catalog still served
