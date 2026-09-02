"""Tests for platform_model_config — cached model configuration from platform_settings."""

from unittest.mock import MagicMock, patch

import pytest

from backend.services import platform_model_config
from backend.services.platform_model_config import (
    HARDCODED_DEFAULTS,
    REASONING_DEFAULTS,
    get_platform_model,
    get_platform_reasoning,
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


def _patch_env(environment: str):
    """Patch settings.environment for model resolution tests."""
    return patch("backend.config.settings.environment", environment)


# ── get_platform_model (sync, memory-only) ──────────────────────────────


class TestGetPlatformModel:
    """Tests for get_platform_model() — sync reads from memory cache."""

    def test_returns_hardcoded_default_when_cache_empty_production(self):
        with _patch_env("production"):
            assert get_platform_model("forge") == HARDCODED_DEFAULTS["model_forge"]
            assert get_platform_model("research") == HARDCODED_DEFAULTS["model_research"]
            assert get_platform_model("fallback") == HARDCODED_DEFAULTS["model_fallback"]
            assert get_platform_model("default") == HARDCODED_DEFAULTS["model_default"]

    def test_returns_dev_defaults_in_development(self):
        with _patch_env("development"):
            assert get_platform_model("forge") == HARDCODED_DEFAULTS["model_forge_dev"]
            assert get_platform_model("research") == HARDCODED_DEFAULTS["model_research_dev"]
            assert get_platform_model("fallback") == HARDCODED_DEFAULTS["model_fallback_dev"]
            assert get_platform_model("default") == HARDCODED_DEFAULTS["model_default_dev"]

    def test_unknown_purpose_maps_to_model_default(self):
        with _patch_env("production"):
            result = get_platform_model("agent_description")
            assert result == HARDCODED_DEFAULTS["model_default"]

    def test_returns_cached_value_after_load_production(self):
        platform_model_config._cache = {
            "model_forge": "test/custom-forge-model",
            "model_research": "test/custom-research-model",
        }
        with _patch_env("production"):
            assert get_platform_model("forge") == "test/custom-forge-model"
            assert get_platform_model("research") == "test/custom-research-model"
            # Uncached keys still fall back to hardcoded defaults
            assert get_platform_model("fallback") == HARDCODED_DEFAULTS["model_fallback"]

    def test_dev_cache_overrides_dev_defaults(self):
        platform_model_config._cache = {
            "model_forge_dev": "test/custom-dev-forge",
        }
        with _patch_env("development"):
            assert get_platform_model("forge") == "test/custom-dev-forge"

    def test_dev_falls_back_to_hardcoded_dev_default(self):
        # Only production key in cache, no dev key in cache
        platform_model_config._cache = {
            "model_forge": "test/prod-forge",
        }
        with _patch_env("development"):
            # Dev key exists in HARDCODED_DEFAULTS, so it should use the hardcoded dev default
            assert get_platform_model("forge") == HARDCODED_DEFAULTS["model_forge_dev"]

    def test_production_ignores_dev_keys(self):
        platform_model_config._cache = {
            "model_forge": "test/prod-forge",
            "model_forge_dev": "test/dev-forge",
        }
        with _patch_env("production"):
            assert get_platform_model("forge") == "test/prod-forge"


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

        with _patch_env("production"):
            assert get_platform_model("forge") == "deepseek/deepseek-v3.2"
            assert get_platform_model("default") == "google/gemini-2.5-pro-preview"
            # Unset keys fall back to hardcoded defaults
            assert get_platform_model("research") == HARDCODED_DEFAULTS["model_research"]

    @pytest.mark.asyncio
    async def test_loads_dev_keys_from_db(self):
        rows = [
            {"setting_key": "model_forge_dev", "setting_value": '"test/dev-forge-from-db"'},
        ]
        client = _mock_admin_supabase(rows)
        await platform_model_config.ensure_loaded(client)

        with _patch_env("development"):
            assert get_platform_model("forge") == "test/dev-forge-from-db"

    @pytest.mark.asyncio
    async def test_strips_surrounding_quotes_from_json_values(self):
        rows = [
            {"setting_key": "model_forge", "setting_value": '"anthropic/claude-sonnet-4-6"'},
        ]
        client = _mock_admin_supabase(rows)
        await platform_model_config.ensure_loaded(client)

        with _patch_env("production"):
            assert get_platform_model("forge") == "anthropic/claude-sonnet-4-6"

    @pytest.mark.asyncio
    async def test_ignores_non_model_keys(self):
        rows = [
            {"setting_key": "cache_map_data_ttl", "setting_value": "15"},
            {"setting_key": "model_default", "setting_value": '"test/model"'},
        ]
        client = _mock_admin_supabase(rows)
        await platform_model_config.ensure_loaded(client)

        with _patch_env("production"):
            assert get_platform_model("default") == "test/model"

    @pytest.mark.asyncio
    async def test_handles_db_failure_gracefully(self):
        client = MagicMock()
        client.table.side_effect = Exception("DB down")
        await platform_model_config.ensure_loaded(client)

        with _patch_env("production"):
            # Should still return hardcoded defaults
            assert get_platform_model("forge") == HARDCODED_DEFAULTS["model_forge"]

    @pytest.mark.asyncio
    async def test_skips_reload_when_cache_is_fresh(self):
        rows = [
            {"setting_key": "model_forge", "setting_value": '"test/first-load"'},
        ]
        client = _mock_admin_supabase(rows)
        await platform_model_config.ensure_loaded(client)

        with _patch_env("production"):
            assert get_platform_model("forge") == "test/first-load"

        # Calling again without invalidation should not re-query (cache is fresh)
        rows_new = [
            {"setting_key": "model_forge", "setting_value": '"test/second-load"'},
        ]
        client2 = _mock_admin_supabase(rows_new)
        await platform_model_config.ensure_loaded(client2)

        with _patch_env("production"):
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

        with _patch_env("production"):
            assert get_platform_model("forge") == "test/loaded-model"

        invalidate()

        with _patch_env("production"):
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

        with _patch_env("production"):
            assert get_platform_model("forge") == "test/second"


# ── Purpose-to-key mapping ──────────────────────────────────────────────


class TestPurposeMapping:
    def test_forge_maps_to_model_forge(self):
        platform_model_config._cache = {"model_forge": "x/forge"}
        with _patch_env("production"):
            assert get_platform_model("forge") == "x/forge"

    def test_research_maps_to_model_research(self):
        platform_model_config._cache = {"model_research": "x/research"}
        with _patch_env("production"):
            assert get_platform_model("research") == "x/research"

    def test_fallback_maps_to_model_fallback(self):
        platform_model_config._cache = {"model_fallback": "x/fallback"}
        with _patch_env("production"):
            assert get_platform_model("fallback") == "x/fallback"

    def test_any_other_purpose_maps_to_model_default(self):
        platform_model_config._cache = {"model_default": "x/default"}
        with _patch_env("production"):
            for purpose in ("agent_description", "chat_response", "event_generation", "anything"):
                assert get_platform_model(purpose) == "x/default"


# ── Reasoning effort per purpose ────────────────────────────────────────


class TestGetPlatformReasoning:
    """`reasoning_<purpose>` decides how much of max_tokens reaches the answer.

    OpenRouter spends reasoning tokens from inside `max_tokens` and bills them
    as output, so a wrong value here is not a preference — it is the difference
    between a complete entity and a 502. See migration 279.
    """

    def test_off_suppresses_thinking(self):
        platform_model_config._cache = {"reasoning_entity": "off"}
        assert get_platform_reasoning("entity") == {"enabled": False}

    def test_auto_sends_nothing(self):
        """`auto` must be None, not `{}` — an empty dict is still a payload."""
        platform_model_config._cache = {"reasoning_entity": "auto"}
        assert get_platform_reasoning("entity") is None

    @pytest.mark.parametrize("level", ["minimal", "low", "medium", "high", "xhigh"])
    def test_named_levels_pass_through_as_effort(self, level):
        platform_model_config._cache = {"reasoning_lore": level}
        assert get_platform_reasoning("lore") == {"effort": level}

    def test_value_is_case_insensitive(self):
        platform_model_config._cache = {"reasoning_entity": "OFF"}
        assert get_platform_reasoning("entity") == {"enabled": False}

    def test_unknown_value_degrades_to_model_default(self):
        """A typo must not break the call — it falls back to today's behaviour."""
        platform_model_config._cache = {"reasoning_entity": "aggressive"}
        assert get_platform_reasoning("entity") is None

    def test_cold_cache_uses_the_shipped_default(self):
        platform_model_config._cache = {}
        assert get_platform_reasoning("entity") == {"enabled": False}
        assert get_platform_reasoning("anchors") is None

    def test_unconfigured_purpose_leaves_the_model_alone(self):
        """`theme`, `translation`, ... carry no key and must send nothing."""
        platform_model_config._cache = {}
        assert get_platform_reasoning("theme") is None

    def test_db_value_overrides_the_shipped_default(self):
        """The whole point of the setting: admin edit beats code."""
        assert REASONING_DEFAULTS["reasoning_entity"] == "off"
        platform_model_config._cache = {"reasoning_entity": "high"}
        assert get_platform_reasoning("entity") == {"effort": "high"}


# ── Tiers are the keys of HARDCODED_DEFAULTS, not a copy of them ────────


class TestTierResolution:
    """The trapdoor that swallowed `classify` on 2026-09-02.

    `get_platform_model` used to compare the purpose against a hand-written
    tuple of tier names that sat beside a dict already holding exactly the same
    knowledge. When `model_classify` was added to the dict and not to the tuple,
    the scanner asked for `classify`, silently received `model_default` — a
    thinking model — and classified nothing. Rule 3 does not raise; a missing
    tier just becomes the default.

    So the tuple is gone and the dict answers. This test is what keeps it gone.
    """

    def test_every_model_key_resolves_to_itself(self):
        with _patch_env("production"):
            for key in HARDCODED_DEFAULTS:
                if key.endswith("_dev"):
                    continue
                tier = key.removeprefix("model_")
                platform_model_config._cache = {key: f"x/{tier}"}
                assert get_platform_model(tier) == f"x/{tier}", (
                    f"tier {tier!r} does not resolve to {key!r} — it fell through "
                    "to model_default, which is the 2026-09-02 defect"
                )

    def test_dispatch_resolves_to_model_dispatch(self):
        platform_model_config._cache = {"model_dispatch": "x/dispatch"}
        with _patch_env("production"):
            assert get_platform_model("dispatch") == "x/dispatch"

    def test_dispatch_default_does_not_think(self):
        """Not a style preference — a thinking model spends 219-620 tokens of
        the same budget before the first word, and the dispatch budget is 640.
        The two non-thinking DeepSeek models are `deepseek-chat` and
        `deepseek-chat-v3-0324` (measured 2026-09-02)."""
        assert HARDCODED_DEFAULTS["model_dispatch"] in (
            "deepseek/deepseek-chat",
            "deepseek/deepseek-chat-v3-0324",
        )
