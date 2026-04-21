"""Unit tests for OpsLedgerService.get_heatmap (P2.6).

Exercises the Python-side aggregation over raw ai_usage_rollup_hour
rows. The MV already groups by (hour, purpose, model, provider,
simulation_id); ``get_heatmap`` rolls those buckets up to a single
dimension, so the tests below verify the sum-by-dimension contract
and the graceful handling of malformed rows.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from backend.services.ops_ledger_service import OpsLedgerService


def _admin_with_rows(rows: list[dict]) -> MagicMock:
    admin = MagicMock()
    chain = MagicMock()
    chain.select.return_value = chain
    chain.gte.return_value = chain
    chain.order.return_value = chain
    chain.execute = AsyncMock(return_value=MagicMock(data=rows))
    admin.table.return_value = chain
    return admin


@pytest.mark.asyncio
async def test_get_heatmap_aggregates_by_dimension_purpose() -> None:
    # Two rows share (hour, purpose) but differ by model. The rollup
    # must sum their calls/tokens/usd into one cell.
    rows = [
        {
            "hour": "2026-04-21T09:00:00+00:00",
            "purpose": "forge",
            "calls": 3,
            "tokens": 1500,
            "usd": 0.12,
        },
        {
            "hour": "2026-04-21T09:00:00+00:00",
            "purpose": "forge",
            "calls": 2,
            "tokens": 800,
            "usd": 0.08,
        },
        {
            "hour": "2026-04-21T10:00:00+00:00",
            "purpose": "chat_memory",
            "calls": 5,
            "tokens": 2500,
            "usd": 0.30,
        },
    ]
    admin = _admin_with_rows(rows)
    cells = await OpsLedgerService.get_heatmap(admin, dimension="purpose", days=7)

    forge_9 = next(c for c in cells if c.key == "forge")
    chat_10 = next(c for c in cells if c.key == "chat_memory")
    assert forge_9.calls == 5
    assert forge_9.tokens == 2300
    assert forge_9.cost_usd == pytest.approx(0.20)
    assert chat_10.calls == 5
    assert chat_10.tokens == 2500
    assert chat_10.cost_usd == pytest.approx(0.30)
    assert len(cells) == 2


@pytest.mark.asyncio
async def test_get_heatmap_skips_rows_with_missing_key_or_hour() -> None:
    rows = [
        {"hour": "", "purpose": "forge", "calls": 1, "tokens": 100, "usd": 0.01},
        {"hour": "2026-04-21T09:00:00+00:00", "purpose": None, "calls": 2, "tokens": 200, "usd": 0.02},
        {"hour": "2026-04-21T10:00:00+00:00", "purpose": "ok", "calls": 3, "tokens": 300, "usd": 0.03},
    ]
    admin = _admin_with_rows(rows)
    cells = await OpsLedgerService.get_heatmap(admin, dimension="purpose")
    assert len(cells) == 1
    assert cells[0].key == "ok"


@pytest.mark.asyncio
async def test_get_heatmap_dimension_flag_selects_source_column() -> None:
    rows = [
        {
            "hour": "2026-04-21T09:00:00+00:00",
            "provider": "openrouter",
            "calls": 4,
            "tokens": 400,
            "usd": 0.04,
        },
    ]
    admin = _admin_with_rows(rows)
    cells = await OpsLedgerService.get_heatmap(admin, dimension="provider")
    admin.table.return_value.select.assert_called_with(
        "hour, provider, calls, tokens, usd",
    )
    assert cells[0].key == "openrouter"
