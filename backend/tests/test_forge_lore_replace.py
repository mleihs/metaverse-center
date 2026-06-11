"""Unit tests for the B1b extractions: ForgeLoreService.replace_for_simulation
and ForgeDraftService.get_latest_completed_source.

replace_for_simulation guards the destructive lore delete — the empty-guard
test pins the invariant that a failed/empty generation can never wipe a
simulation's existing lore.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from backend.services.forge_draft_service import ForgeDraftService
from backend.services.forge_lore_service import ForgeLoreService

_SIM_ID = uuid4()
_SECTIONS = [
    {"chapter": "I", "arcanum": "wheel", "title": "Origins", "body": "…"},
]


def _admin_with_chain(rows: list[dict]) -> tuple[MagicMock, MagicMock]:
    admin = MagicMock()
    chain = MagicMock()
    for method in ("select", "eq", "order", "limit", "delete", "insert"):
        getattr(chain, method).return_value = chain
    chain.execute = AsyncMock(return_value=MagicMock(data=rows))
    admin.table.return_value = chain
    return admin, chain


@pytest.mark.asyncio
async def test_replace_rejects_empty_sections_without_touching_db() -> None:
    admin, chain = _admin_with_chain([])
    with pytest.raises(ValueError, match="non-empty"):
        await ForgeLoreService.replace_for_simulation(admin, _SIM_ID, [])
    chain.delete.assert_not_called()


@pytest.mark.asyncio
async def test_replace_deletes_then_persists() -> None:
    admin, chain = _admin_with_chain([])
    with patch(
        "backend.services.forge_lore_service.ForgeLoreService.persist_lore",
        new_callable=AsyncMock,
    ) as persist:
        await ForgeLoreService.replace_for_simulation(admin, _SIM_ID, _SECTIONS, None)

    admin.table.assert_called_once_with("simulation_lore")
    chain.delete.assert_called_once()
    chain.eq.assert_called_once_with("simulation_id", str(_SIM_ID))
    persist.assert_awaited_once_with(admin, _SIM_ID, _SECTIONS, None)


@pytest.mark.asyncio
async def test_get_latest_completed_source_returns_first_row() -> None:
    rows = [{"seed_prompt": "newest"}, {"seed_prompt": "older"}]
    admin, chain = _admin_with_chain(rows)
    result = await ForgeDraftService.get_latest_completed_source(admin)
    assert result == {"seed_prompt": "newest"}
    chain.eq.assert_called_once_with("status", "completed")
    chain.order.assert_called_once_with("updated_at", desc=True)
    chain.limit.assert_called_once_with(1)


@pytest.mark.asyncio
async def test_get_latest_completed_source_returns_none_when_no_drafts() -> None:
    admin, _chain = _admin_with_chain([])
    assert await ForgeDraftService.get_latest_completed_source(admin) is None
