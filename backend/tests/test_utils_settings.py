"""Tests for backend.utils.settings — platform_settings read/write helpers."""

from __future__ import annotations

from unittest.mock import MagicMock
from uuid import UUID

import pytest

from backend.tests.conftest import make_chain_mock
from backend.utils.settings import (
    decrypt_setting,
    parse_setting_bool,
    upsert_platform_setting,
)

# ── parse_setting_bool ──────────────────────────────────────────────────


class TestParseSettingBool:
    """Fail-closed positive-match contract — the helper returns True only
    for explicitly truth-carrying values, so a missing row / jsonb null /
    typo never silently activates a flag-style setting (e.g. the
    ``*_enabled`` family that gates schedulers)."""

    @pytest.mark.parametrize(
        ("raw", "expected"),
        [
            # Canonical true (case-insensitive, outer quotes stripped).
            ("true", True),
            ("True", True),
            ("TRUE", True),
            ("1", True),
            ('"true"', True),
            ("yes", True),
            ("YES", True),
            ("on", True),
            # Canonical false (positive-match means anything NOT in the
            # true set is false — these pass through as ordinary mismatches).
            ("false", False),
            ("False", False),
            ("0", False),
            ("no", False),
            ('""', False),
            ("", False),
        ],
    )
    def test_parses_string_values(self, raw: str, expected: bool):
        assert parse_setting_bool(raw) is expected

    @pytest.mark.parametrize(
        ("raw", "expected"),
        [
            (True, True),
            (False, False),
            (1, True),
            (0, False),
            (2, False),    # non-canonical int → False (fail-closed)
            (-1, False),
            (1.0, False),  # float stringifies to "1.0", not "1" → False
            (0.0, False),
        ],
    )
    def test_parses_numeric_values(self, raw: object, expected: bool):
        assert parse_setting_bool(raw) is expected

    @pytest.mark.parametrize(
        "raw",
        [
            None,          # jsonb null / missing row — the F32 bug
            "null",        # literal "null" string (postgrest sometimes)
            "None",        # Python-repr leaking through str()
            "enabled",     # unknown string — fail-closed tightening
            "on-standby",  # typo / custom value
            "foo",         # unrecognised
            object(),      # unexpected type
        ],
    )
    def test_non_canonical_fails_closed(self, raw: object):
        """Unknown / unexpected values return False. This locks the
        fail-closed contract that prevents a typo or a jsonb-null
        round-trip from silently enabling a gated scheduler."""
        assert parse_setting_bool(raw) is False


# ── decrypt_setting ─────────────────────────────────────────────────────


class TestDecryptSetting:
    def test_passes_plaintext_through(self):
        assert decrypt_setting("plain-text-value") == "plain-text-value"

    def test_strips_surrounding_quotes_on_plaintext(self):
        assert decrypt_setting('"quoted"') == "quoted"

    def test_empty_returns_empty(self):
        assert decrypt_setting("") == ""


# ── upsert_platform_setting ─────────────────────────────────────────────


class TestUpsertPlatformSetting:
    """Verifies the helper's call shape — upsert(on_conflict="setting_key")
    with the write payload assembled from the key/value/updated_by_id args.
    The helper wraps the postgrest chain that every scheduler used to
    hand-roll; these tests lock its exact semantics so a careless refactor
    cannot re-introduce the silent-no-op `.update().eq()` pattern.
    """

    @pytest.mark.asyncio
    async def test_writes_setting_value_only_when_user_id_absent(self):
        chain = make_chain_mock(execute_data=None)
        admin = MagicMock()
        admin.table.return_value = chain

        await upsert_platform_setting(admin, "example_key", "some-value")

        admin.table.assert_called_once_with("platform_settings")
        chain.upsert.assert_called_once_with(
            {"setting_key": "example_key", "setting_value": "some-value"},
            on_conflict="setting_key",
        )
        chain.execute.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_includes_updated_by_id_when_provided(self):
        chain = make_chain_mock(execute_data=None)
        admin = MagicMock()
        admin.table.return_value = chain
        admin_id = UUID("11111111-2222-3333-4444-555555555555")

        await upsert_platform_setting(
            admin, "byok_bypass_enabled", True, updated_by_id=admin_id,
        )

        chain.upsert.assert_called_once_with(
            {
                "setting_key": "byok_bypass_enabled",
                "setting_value": True,
                "updated_by_id": str(admin_id),
            },
            on_conflict="setting_key",
        )

    @pytest.mark.asyncio
    async def test_passes_value_verbatim_without_encoding(self):
        """The helper must not second-guess jsonb encoding. Callers like
        InstagramScheduler pre-encode with ``json.dumps(False)`` and expect
        the literal string to land in the row."""
        chain = make_chain_mock(execute_data=None)
        admin = MagicMock()
        admin.table.return_value = chain

        await upsert_platform_setting(admin, "flag", "false")

        payload = chain.upsert.call_args.args[0]
        assert payload["setting_value"] == "false"

    @pytest.mark.asyncio
    async def test_accepts_string_updated_by_id(self):
        chain = make_chain_mock(execute_data=None)
        admin = MagicMock()
        admin.table.return_value = chain

        await upsert_platform_setting(
            admin, "k", "v", updated_by_id="already-stringified",
        )

        payload = chain.upsert.call_args.args[0]
        assert payload["updated_by_id"] == "already-stringified"

    @pytest.mark.asyncio
    async def test_uses_on_conflict_setting_key(self):
        """The table has UNIQUE(setting_key); the helper must target that
        constraint so ON CONFLICT UPDATE fires instead of raising on the
        duplicate insert path."""
        chain = make_chain_mock(execute_data=None)
        admin = MagicMock()
        admin.table.return_value = chain

        await upsert_platform_setting(admin, "k", "v")

        _, kwargs = chain.upsert.call_args
        assert kwargs == {"on_conflict": "setting_key"}
