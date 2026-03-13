"""Tests for platform_model_config — cached model configuration from platform_settings."""

from unittest.mock import MagicMock

import pytest

from backend.services import platform_model_config
from backend.services.platform_model_config import (
    HARDCODED_DEFAULTS,
    get_platform_model,
    invalidate,
)
from backend.tests.conftest import make_chain_mock


# ── Fixtures ────────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def _reset_cache():
    """Ensure clean cache state between tests."""
    invalidate()
    yield
    invalidate()


def _mock_admin_supabase(rows: list[dict]) -> MagicMock:
    """Create a mock admin supabase client that returns model settings rows.

    Extends make_chain_mock with .like() support (used by _load_all).
    """
    client = MagicMock()
    chain = make_chain_mock(execute_data=rows)
    # Add .like() to the chain — not in the default make_chain_mock
    chain.like.return_value = chain
    client.table.return_value = chain
    return client


# ── get_platform_model (sync, memory-only) ──────────────────────────────


class TestGetPlatformModel:
    """Tests for get_platform_model() — sync reads from memory cache."""

    def test_returns_hardcoded_default_when_cache_empty(self):
        assert get_platform_model("forge") == HARDCODED_DEFAULTS["model_forge"]
        assert get_platform_model("research") == HARDCODED_DEFAULTS["model_research"]
        assert get_platform_model("fallback") == HARDCODED_DEFAULTS["model_fallback"]
        assert get_platform_model("default") == HARDCODED_DEFAULTS["model_default"]

    def test_unknown_purpose_maps_to_model_default(self):
        result = get_platform_model("agent_description")
        assert result == HARDCODED_DEFAULTS["model_default"]

    def test_returns_cached_value_after_load(self):
        # Simulate a loaded cache
        platform_model_config._cache = {
            "model_forge": "test/custom-forge-model",
            "model_research": "test/custom-research-model",
        }
        assert get_platform_model("forge") == "test/custom-forge-model"
        assert get_platform_model("research") == "test/custom-research-model"
        # Uncached keys still fall back to hardcoded defaults
        assert get_platform_model("fallback") == HARDCODED_DEFAULTS["model_fallback"]


# ── ensure_loaded (async, DB query) ─────────────────────────────────────


class TestEnsureLoaded:
    @pytest.mark.asyncio
    async def test_loads_model_settings_from_db(self):
        rows = [
            {"setting_key": "model_forge", "setting_value": '"deepseek/deepseek-v3.2"'},
            {"setting_key": "model_default", "setting_value": '"google/gemini-2.5-pro-preview"'},
        ]
        client = _mock_admin_supabase(rows)
        await platform_model_config.ensure_loaded(client)

        assert get_platform_model("forge") == "deepseek/deepseek-v3.2"
        assert get_platform_model("default") == "google/gemini-2.5-pro-preview"
        # Unset keys fall back to hardcoded defaults
        assert get_platform_model("research") == HARDCODED_DEFAULTS["model_research"]

    @pytest.mark.asyncio
    async def test_strips_surrounding_quotes_from_json_values(self):
        rows = [
            {"setting_key": "model_forge", "setting_value": '"anthropic/claude-sonnet-4-6"'},
        ]
        client = _mock_admin_supabase(rows)
        await platform_model_config.ensure_loaded(client)

        assert get_platform_model("forge") == "anthropic/claude-sonnet-4-6"

    @pytest.mark.asyncio
    async def test_ignores_non_model_keys(self):
        rows = [
            {"setting_key": "cache_map_data_ttl", "setting_value": "15"},
            {"setting_key": "model_default", "setting_value": '"test/model"'},
        ]
        client = _mock_admin_supabase(rows)
        await platform_model_config.ensure_loaded(client)

        assert get_platform_model("default") == "test/model"

    @pytest.mark.asyncio
    async def test_handles_db_failure_gracefully(self):
        client = MagicMock()
        client.table.side_effect = Exception("DB down")
        await platform_model_config.ensure_loaded(client)

        # Should still return hardcoded defaults
        assert get_platform_model("forge") == HARDCODED_DEFAULTS["model_forge"]

    @pytest.mark.asyncio
    async def test_skips_reload_when_cache_is_fresh(self):
        rows = [
            {"setting_key": "model_forge", "setting_value": '"test/first-load"'},
        ]
        client = _mock_admin_supabase(rows)
        await platform_model_config.ensure_loaded(client)
        assert get_platform_model("forge") == "test/first-load"

        # Calling again without invalidation should not re-query (cache is fresh)
        rows_new = [
            {"setting_key": "model_forge", "setting_value": '"test/second-load"'},
        ]
        client2 = _mock_admin_supabase(rows_new)
        await platform_model_config.ensure_loaded(client2)
        # Still returns first value because TTL hasn't expired
        assert get_platform_model("forge") == "test/first-load"


# ── invalidate ───────────────────────────────────────────────────────────


class TestInvalidate:
    @pytest.mark.asyncio
    async def test_invalidate_clears_cache(self):
        rows = [
            {"setting_key": "model_forge", "setting_value": '"test/loaded-model"'},
        ]
        client = _mock_admin_supabase(rows)
        await platform_model_config.ensure_loaded(client)
        assert get_platform_model("forge") == "test/loaded-model"

        invalidate()
        # After invalidation, should return hardcoded default
        assert get_platform_model("forge") == HARDCODED_DEFAULTS["model_forge"]

    @pytest.mark.asyncio
    async def test_invalidate_allows_reload(self):
        rows = [
            {"setting_key": "model_forge", "setting_value": '"test/first"'},
        ]
        client = _mock_admin_supabase(rows)
        await platform_model_config.ensure_loaded(client)

        invalidate()

        rows_new = [
            {"setting_key": "model_forge", "setting_value": '"test/second"'},
        ]
        client2 = _mock_admin_supabase(rows_new)
        await platform_model_config.ensure_loaded(client2)
        assert get_platform_model("forge") == "test/second"


# ── Purpose-to-key mapping ──────────────────────────────────────────────


class TestPurposeMapping:
    def test_forge_maps_to_model_forge(self):
        platform_model_config._cache = {"model_forge": "x/forge"}
        assert get_platform_model("forge") == "x/forge"

    def test_research_maps_to_model_research(self):
        platform_model_config._cache = {"model_research": "x/research"}
        assert get_platform_model("research") == "x/research"

    def test_fallback_maps_to_model_fallback(self):
        platform_model_config._cache = {"model_fallback": "x/fallback"}
        assert get_platform_model("fallback") == "x/fallback"

    def test_any_other_purpose_maps_to_model_default(self):
        platform_model_config._cache = {"model_default": "x/default"}
        for purpose in ("agent_description", "chat_response", "event_generation", "anything"):
            assert get_platform_model(purpose) == "x/default"
