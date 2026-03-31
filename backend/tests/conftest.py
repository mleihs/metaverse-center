from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend.dependencies import get_current_user
from backend.models.common import CurrentUser
from backend.services import dungeon_content_service as _dcs

MOCK_USER_ID = UUID("11111111-1111-1111-1111-111111111111")
MOCK_USER_EMAIL = "test@velgarien.dev"


def _seed_content_cache() -> None:
    """Populate dungeon content cache from Python data for tests.

    Called once at session start so all tests see content without DB.
    Uses the same Python dicts that are still in the codebase (PR 1 fallback).
    """
    if _dcs._content is not None:
        return  # already seeded

    from backend.services.combat.ability_schools import ALL_ABILITIES, Ability
    from backend.services.dungeon.dungeon_banter import _BANTER_REGISTRIES
    from backend.services.dungeon.dungeon_combat import _ENEMY_REGISTRIES, _SPAWN_REGISTRIES
    from backend.services.dungeon.dungeon_encounters import _ENCOUNTER_REGISTRIES
    from backend.services.dungeon.dungeon_loot import _LOOT_REGISTRIES
    from backend.services.dungeon.dungeon_objektanker import (
        ANCHOR_OBJECTS,
        BAROMETER_TEXTS,
        ENTRANCE_TEXTS,
    )

    # Build encounter index
    encounter_index = {}
    for encounters in _ENCOUNTER_REGISTRIES.values():
        for e in encounters:
            encounter_index[e.id] = e

    # Build entrance text dicts (strip to {text_en, text_de})
    entrance = {
        arch: [{"text_en": t["text_en"], "text_de": t["text_de"]} for t in texts]
        for arch, texts in ENTRANCE_TEXTS.items()
    }

    # Build anchor object dicts (strip to {id, phases})
    anchors = {
        arch: [{"id": obj["id"], "phases": obj.get("phases", {})} for obj in objs]
        for arch, objs in ANCHOR_OBJECTS.items()
    }

    _dcs._content = _dcs._ContentCache(
        banter=dict(_BANTER_REGISTRIES),
        encounters=dict(_ENCOUNTER_REGISTRIES),
        encounter_index=encounter_index,
        enemies=dict(_ENEMY_REGISTRIES),
        spawns=dict(_SPAWN_REGISTRIES),
        loot=dict(_LOOT_REGISTRIES),
        anchors=anchors,
        entrance_texts=entrance,
        barometer_texts=dict(BAROMETER_TEXTS),
        abilities=dict(ALL_ABILITIES),
    )


# Auto-seed before any test collection
_seed_content_cache()


@pytest.fixture()
def test_app():
    """FastAPI TestClient instance."""
    return TestClient(app)


@pytest.fixture()
def mock_user_token() -> str:
    """A fake JWT token string for testing."""
    return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature"


def make_chain_mock(execute_data=None, execute_count=None):
    """Reusable Supabase query chain mock.

    Usage: chain = make_chain_mock(execute_data=[...])
    Supports: .select(), .eq(), .in_(), .lt(), .gt(), .or_(), .order(),
              .limit(), .single(), .maybe_single(), .is_(), .not_(),
              .range(), .insert(), .update(), .delete(), .upsert()
    """
    c = MagicMock()
    for method in (
        "select", "eq", "in_", "lt", "gt", "or_", "order",
        "limit", "single", "maybe_single", "is_", "not_",
        "range", "insert", "update", "delete", "upsert",
    ):
        getattr(c, method).return_value = c
    resp = MagicMock()
    resp.data = execute_data
    resp.count = execute_count
    c.execute = AsyncMock(return_value=resp)
    return c


def make_async_supabase_mock(execute_data=None):
    """Build a full Supabase mock whose .table()/.rpc() chains return AsyncMock.

    Use as dependency override for get_supabase / get_admin_supabase in tests
    that go through the FastAPI app (TestClient) and hit async service code.
    """
    chain = make_chain_mock(execute_data=execute_data)
    mock_sb = MagicMock()
    mock_sb.table.return_value = chain
    mock_sb.rpc.return_value = chain
    return mock_sb


@pytest.fixture()
def mock_current_user():
    """Patch get_current_user to return a mock user without JWT validation."""
    user = CurrentUser(
        id=MOCK_USER_ID,
        email=MOCK_USER_EMAIL,
        access_token="mock-access-token",
    )

    app.dependency_overrides[get_current_user] = lambda: user
    yield user
    app.dependency_overrides.pop(get_current_user, None)
