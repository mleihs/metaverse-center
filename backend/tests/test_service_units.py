"""Unit tests for services created/modified during the 2026-04-09 code audit.

Covers:
  4.1  DungeonContentAdminService — generic CRUD with composite PKs
  4.2  ForgeDraftService.get_user_keys — BYOK key decryption
  4.3  SettingsService.list_dungeon_overrides / get_dungeon_override
  4.4  BaseService.get_by_slug — slug-based entity lookup
  4.5  ShowcaseImageService — archetype validation + upload pipeline

All tests are mock-based (no real DB or API calls).
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

import pytest
from fastapi import HTTPException

from backend.services.base_service import BaseService
from backend.services.dungeon.showcase_image_service import (
    ARCHETYPE_VISUALS,
    generate_and_upload_showcase,
    generate_showcase_image,
)
from backend.services.dungeon_content_admin_service import DungeonContentAdminService
from backend.services.forge_draft_service import ForgeDraftService
from backend.services.settings_service import SettingsService

# ── Test constants ──────────────────────────────────────────────────────────

USER_ID = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
SIM_ID = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
SETTING_ID = UUID("cccccccc-cccc-cccc-cccc-cccccccccccc")


# ── Shared mock helper ──────────────────────────────────────────────────────


def _mock_supabase(execute_data=None, execute_count=None):
    """Build a mock Supabase client with a fluent query builder chain.

    Every chainable method returns the same builder, .execute() returns
    a MagicMock with .data and .count attributes.
    """
    mock = MagicMock()
    chain = MagicMock()
    result = MagicMock()
    result.data = execute_data if execute_data is not None else []
    result.count = (
        execute_count
        if execute_count is not None
        else (len(result.data) if isinstance(result.data, list) else 0)
    )
    chain.execute = AsyncMock(return_value=result)
    for method in (
        "select", "eq", "neq", "insert", "update", "delete", "upsert",
        "limit", "single", "maybe_single", "order", "range", "filter",
        "in_", "is_", "not_", "or_", "ilike",
    ):
        getattr(chain, method).return_value = chain
    mock.table.return_value = chain
    mock.rpc.return_value = chain
    # Storage mock for ShowcaseImageService
    storage_bucket = MagicMock()
    storage_bucket.upload = AsyncMock()
    storage_bucket.get_public_url.return_value = "https://cdn.example.com/showcase/dungeon-shadow.avif"
    mock.storage.from_.return_value = storage_bucket
    return mock, chain


# ═══════════════════════════════════════════════════════════════════════════
# 4.1  DungeonContentAdminService
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.integration
class TestDungeonContentAdminListContent:
    """list_content — archetype filter, pagination, search."""

    @pytest.mark.asyncio
    async def test_list_content_with_archetype_filter(self):
        """Verify .eq("archetype", ...) is called when archetype is provided."""
        rows = [{"id": "enemy-1", "archetype": "shadow"}]
        mock_sb, chain = _mock_supabase(execute_data=rows, execute_count=1)

        data, total = await DungeonContentAdminService.list_content(
            mock_sb, "enemies", archetype="shadow",
        )

        assert data == rows
        assert total == 1
        chain.eq.assert_any_call("archetype", "shadow")

    @pytest.mark.asyncio
    async def test_list_content_pagination_offset(self):
        """page=3, per_page=25 should produce offset=50, range(50,74)."""
        mock_sb, chain = _mock_supabase(execute_data=[], execute_count=0)

        await DungeonContentAdminService.list_content(
            mock_sb, "enemies", page=3, per_page=25,
        )

        chain.range.assert_called_once_with(50, 74)

    @pytest.mark.asyncio
    async def test_list_content_default_pagination(self):
        """Default page=1, per_page=100 should produce range(0,99)."""
        mock_sb, chain = _mock_supabase(execute_data=[], execute_count=0)

        await DungeonContentAdminService.list_content(mock_sb, "enemies")

        chain.range.assert_called_once_with(0, 99)

    @pytest.mark.asyncio
    async def test_list_content_with_search(self):
        """Search triggers .or_() with ilike filter string."""
        mock_sb, chain = _mock_supabase(execute_data=[], execute_count=0)

        await DungeonContentAdminService.list_content(
            mock_sb, "enemies", search="dragon",
        )

        chain.or_.assert_called_once()
        filter_str = chain.or_.call_args[0][0]
        assert "dragon" in filter_str
        assert "ilike" in filter_str


@pytest.mark.integration
class TestDungeonContentAdminGetItem:
    """get_item — simple PK, composite PK, invalid composite ID."""

    @pytest.mark.asyncio
    async def test_get_item_simple_pk(self):
        """Simple PK content type uses a single .eq() call."""
        row = {"id": "enemy-1", "name_en": "Shadow Fiend"}
        mock_sb, chain = _mock_supabase(execute_data=row)

        result = await DungeonContentAdminService.get_item(mock_sb, "enemies", "enemy-1")

        assert result == row
        # 'enemies' has PK 'id' → single .eq("id", "enemy-1")
        chain.eq.assert_called_once_with("id", "enemy-1")

    @pytest.mark.asyncio
    async def test_get_item_composite_pk(self):
        """Composite PK ('choices') parses 'enc-1::choice-1' into two .eq() calls."""
        row = {"encounter_id": "enc-1", "id": "choice-1", "label_en": "Attack"}
        mock_sb, chain = _mock_supabase(execute_data=row)

        result = await DungeonContentAdminService.get_item(
            mock_sb, "choices", "enc-1::choice-1",
        )

        assert result == row
        # choices PK = ("encounter_id", "id")
        eq_calls = [call.args for call in chain.eq.call_args_list]
        assert ("encounter_id", "enc-1") in eq_calls
        assert ("id", "choice-1") in eq_calls

    @pytest.mark.asyncio
    async def test_get_item_composite_pk_anchors(self):
        """Anchors have PK ('archetype', 'id') — verify correct columns."""
        row = {"archetype": "shadow", "id": "anchor-1"}
        mock_sb, chain = _mock_supabase(execute_data=row)

        result = await DungeonContentAdminService.get_item(
            mock_sb, "anchors", "shadow::anchor-1",
        )

        assert result == row
        eq_calls = [call.args for call in chain.eq.call_args_list]
        assert ("archetype", "shadow") in eq_calls
        assert ("id", "anchor-1") in eq_calls

    @pytest.mark.asyncio
    async def test_get_item_invalid_composite_id(self):
        """Non-composite ID for a composite-PK type raises HTTPException(400)."""
        mock_sb, _ = _mock_supabase()

        with pytest.raises(HTTPException) as exc_info:
            await DungeonContentAdminService.get_item(mock_sb, "choices", "no-separator")
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_get_item_not_found_raises_404(self):
        """Missing item raises HTTPException(404)."""
        mock_sb, _ = _mock_supabase(execute_data=None)

        with pytest.raises(HTTPException) as exc_info:
            await DungeonContentAdminService.get_item(mock_sb, "enemies", "nonexistent")
        assert exc_info.value.status_code == 404


@pytest.mark.integration
class TestDungeonContentAdminUpdateItem:
    """update_item — strips timestamps, composite PK routing."""

    @pytest.mark.asyncio
    async def test_update_strips_system_columns(self):
        """created_at and updated_at should be stripped from the update payload."""
        row = {"id": "enemy-1", "name_en": "Updated Name"}
        mock_sb, chain = _mock_supabase(execute_data=[row])

        result = await DungeonContentAdminService.update_item(
            mock_sb, "enemies", "enemy-1",
            {"name_en": "Updated Name", "created_at": "2026-01-01", "updated_at": "2026-01-01"},
        )

        assert result == row
        # Verify the .update() call received data WITHOUT created_at/updated_at
        update_call_data = chain.update.call_args[0][0]
        assert "created_at" not in update_call_data
        assert "updated_at" not in update_call_data
        assert update_call_data["name_en"] == "Updated Name"

    @pytest.mark.asyncio
    async def test_update_item_not_found_raises_404(self):
        """Empty response after update raises HTTPException(404)."""
        mock_sb, _ = _mock_supabase(execute_data=[])

        with pytest.raises(HTTPException) as exc_info:
            await DungeonContentAdminService.update_item(
                mock_sb, "enemies", "nonexistent", {"name_en": "X"},
            )
        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_update_item_composite_pk(self):
        """Update with composite PK produces two .eq() calls."""
        row = {"encounter_id": "enc-1", "id": "choice-1", "label_en": "Flee"}
        mock_sb, chain = _mock_supabase(execute_data=[row])

        await DungeonContentAdminService.update_item(
            mock_sb, "choices", "enc-1::choice-1", {"label_en": "Flee"},
        )

        eq_calls = [call.args for call in chain.eq.call_args_list]
        assert ("encounter_id", "enc-1") in eq_calls
        assert ("id", "choice-1") in eq_calls


@pytest.mark.integration
class TestDungeonContentAdminCreateItem:
    """create_item — strips system columns, returns created row."""

    @pytest.mark.asyncio
    async def test_create_strips_system_columns(self):
        """created_at and updated_at should be stripped from the insert payload."""
        row = {"id": "new-enemy", "name_en": "New Boss"}
        mock_sb, chain = _mock_supabase(execute_data=[row])

        result = await DungeonContentAdminService.create_item(
            mock_sb, "enemies",
            {"name_en": "New Boss", "created_at": "2026-01-01", "updated_at": "2026-01-01"},
        )

        assert result == row
        insert_call_data = chain.insert.call_args[0][0]
        assert "created_at" not in insert_call_data
        assert "updated_at" not in insert_call_data

    @pytest.mark.asyncio
    async def test_create_item_failure_raises_500(self):
        """Empty response after insert raises HTTPException(500)."""
        mock_sb, _ = _mock_supabase(execute_data=[])

        with pytest.raises(HTTPException) as exc_info:
            await DungeonContentAdminService.create_item(
                mock_sb, "enemies", {"name_en": "Doomed"},
            )
        assert exc_info.value.status_code == 500


@pytest.mark.integration
class TestDungeonContentAdminDeleteItem:
    """delete_item — simple PK, composite PK, not found."""

    @pytest.mark.asyncio
    async def test_delete_item_simple_pk(self):
        """Successful delete returns {deleted: True, id: ...}."""
        mock_sb, chain = _mock_supabase(execute_data=[{"id": "enemy-1"}])

        result = await DungeonContentAdminService.delete_item(mock_sb, "enemies", "enemy-1")

        assert result == {"deleted": True, "id": "enemy-1"}
        chain.eq.assert_called_once_with("id", "enemy-1")

    @pytest.mark.asyncio
    async def test_delete_item_composite_pk(self):
        """Delete with composite PK produces two .eq() calls."""
        mock_sb, chain = _mock_supabase(execute_data=[{"encounter_id": "enc-1", "id": "c-1"}])

        result = await DungeonContentAdminService.delete_item(
            mock_sb, "choices", "enc-1::c-1",
        )

        assert result["deleted"] is True
        eq_calls = [call.args for call in chain.eq.call_args_list]
        assert ("encounter_id", "enc-1") in eq_calls
        assert ("id", "c-1") in eq_calls

    @pytest.mark.asyncio
    async def test_delete_item_not_found_raises_404(self):
        """Missing item during delete raises HTTPException(404)."""
        mock_sb, _ = _mock_supabase(execute_data=[])

        with pytest.raises(HTTPException) as exc_info:
            await DungeonContentAdminService.delete_item(mock_sb, "enemies", "ghost")
        assert exc_info.value.status_code == 404


# ═══════════════════════════════════════════════════════════════════════════
# 4.2  ForgeDraftService.get_user_keys
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.integration
class TestForgeDraftServiceGetUserKeys:
    """get_user_keys — BYOK key retrieval and decryption."""

    @pytest.mark.asyncio
    @patch("backend.services.forge_draft_service.decrypt")
    async def test_both_keys_present(self, mock_decrypt):
        """User with both encrypted keys gets both decrypted."""
        mock_decrypt.side_effect = lambda ct: f"decrypted-{ct}"
        mock_sb, _ = _mock_supabase(execute_data={
            "encrypted_openrouter_key": "enc-or-key",
            "encrypted_replicate_key": "enc-rep-key",
        })

        or_key, rep_key = await ForgeDraftService.get_user_keys(mock_sb, USER_ID)

        assert or_key == "decrypted-enc-or-key"
        assert rep_key == "decrypted-enc-rep-key"
        assert mock_decrypt.call_count == 2

    @pytest.mark.asyncio
    @patch("backend.services.forge_draft_service.decrypt")
    async def test_only_openrouter_key(self, mock_decrypt):
        """User with only openrouter key returns (key, None)."""
        mock_decrypt.return_value = "decrypted-or"
        mock_sb, _ = _mock_supabase(execute_data={
            "encrypted_openrouter_key": "enc-or",
            "encrypted_replicate_key": None,
        })

        or_key, rep_key = await ForgeDraftService.get_user_keys(mock_sb, USER_ID)

        assert or_key == "decrypted-or"
        assert rep_key is None

    @pytest.mark.asyncio
    @patch("backend.services.forge_draft_service.decrypt")
    async def test_no_keys_set(self, mock_decrypt):
        """User with no encrypted keys returns (None, None)."""
        mock_sb, _ = _mock_supabase(execute_data={
            "encrypted_openrouter_key": None,
            "encrypted_replicate_key": None,
        })

        or_key, rep_key = await ForgeDraftService.get_user_keys(mock_sb, USER_ID)

        assert or_key is None
        assert rep_key is None
        mock_decrypt.assert_not_called()

    @pytest.mark.asyncio
    @patch("backend.services.forge_draft_service.decrypt")
    async def test_no_wallet_row(self, mock_decrypt):
        """User without a wallet row (maybe_single returns None) returns (None, None)."""
        mock_sb, _ = _mock_supabase(execute_data=None)

        or_key, rep_key = await ForgeDraftService.get_user_keys(mock_sb, USER_ID)

        assert or_key is None
        assert rep_key is None
        mock_decrypt.assert_not_called()


# ═══════════════════════════════════════════════════════════════════════════
# 4.3  SettingsService.list_dungeon_overrides / get_dungeon_override
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.integration
class TestSettingsServiceListDungeonOverrides:
    """list_dungeon_overrides — template simulations + override configs."""

    @pytest.mark.asyncio
    async def test_returns_all_templates_with_overrides(self):
        """Each template simulation gets mode/archetypes from its override config."""
        sim_data = [
            {"id": "sim-1", "name": "Sim A", "slug": "sim-a"},
            {"id": "sim-2", "name": "Sim B", "slug": "sim-b"},
        ]
        override_data = [
            {
                "simulation_id": "sim-1",
                "setting_value": {"mode": "curated", "archetypes": ["shadow", "tower"]},
            },
        ]

        # Two sequential queries: simulations, then simulation_settings
        mock_sb = MagicMock()
        sim_chain = MagicMock()
        override_chain = MagicMock()

        # Configure sim_chain
        sim_result = MagicMock()
        sim_result.data = sim_data
        for m in ("select", "eq", "is_", "order"):
            getattr(sim_chain, m).return_value = sim_chain
        sim_chain.execute = AsyncMock(return_value=sim_result)

        # Configure override_chain
        override_result = MagicMock()
        override_result.data = override_data
        for m in ("select", "eq"):
            getattr(override_chain, m).return_value = override_chain
        override_chain.execute = AsyncMock(return_value=override_result)

        # Route .table() calls to the right chain
        call_count = {"n": 0}
        original_chains = [sim_chain, override_chain]

        def table_side_effect(table_name):
            idx = call_count["n"]
            call_count["n"] += 1
            return original_chains[idx]

        mock_sb.table.side_effect = table_side_effect

        result = await SettingsService.list_dungeon_overrides(mock_sb)

        assert len(result) == 2
        # sim-1 has an override
        assert result[0]["id"] == "sim-1"
        assert result[0]["mode"] == "curated"
        assert result[0]["archetypes"] == ["shadow", "tower"]
        # sim-2 has no override → defaults
        assert result[1]["id"] == "sim-2"
        assert result[1]["mode"] == "off"
        assert result[1]["archetypes"] == []


@pytest.mark.integration
class TestSettingsServiceGetDungeonOverride:
    """get_dungeon_override — single simulation override lookup."""

    @pytest.mark.asyncio
    async def test_simulation_without_override(self):
        """Simulation with no dungeon_override row returns mode='off', archetypes=[]."""
        mock_sb, _ = _mock_supabase(execute_data=None)

        result = await SettingsService.get_dungeon_override(mock_sb, SIM_ID)

        assert result == {"mode": "off", "archetypes": []}

    @pytest.mark.asyncio
    async def test_simulation_with_override(self):
        """Simulation with a dungeon_override returns the stored config."""
        mock_sb, _ = _mock_supabase(execute_data={
            "setting_value": {"mode": "curated", "archetypes": ["entropy", "deluge"]},
        })

        result = await SettingsService.get_dungeon_override(mock_sb, SIM_ID)

        assert result["mode"] == "curated"
        assert result["archetypes"] == ["entropy", "deluge"]


# ═══════════════════════════════════════════════════════════════════════════
# 4.4  BaseService.get_by_slug
# ═══════════════════════════════════════════════════════════════════════════


class _TestEntityService(BaseService):
    """Concrete subclass of BaseService for testing get_by_slug."""

    table_name = "test_entities"
    view_name = "active_test_entities"


@pytest.mark.integration
class TestBaseServiceGetBySlug:
    """get_by_slug — slug-based lookup against _read_table (view)."""

    @pytest.mark.asyncio
    async def test_slug_found(self):
        """Existing slug returns the entity dict."""
        row = {"id": "entity-1", "slug": "my-entity", "name": "My Entity"}
        mock_sb, chain = _mock_supabase(execute_data=[row])

        result = await _TestEntityService.get_by_slug(mock_sb, SIM_ID, "my-entity")

        assert result == row
        # Should query the view (active_test_entities), not the raw table
        mock_sb.table.assert_called_once_with("active_test_entities")
        chain.eq.assert_any_call("simulation_id", str(SIM_ID))
        chain.eq.assert_any_call("slug", "my-entity")

    @pytest.mark.asyncio
    async def test_slug_not_found_raises_404(self):
        """Missing slug raises HTTPException(404)."""
        mock_sb, _ = _mock_supabase(execute_data=[])

        with pytest.raises(HTTPException) as exc_info:
            await _TestEntityService.get_by_slug(mock_sb, SIM_ID, "nonexistent")
        assert exc_info.value.status_code == 404
        assert "nonexistent" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_slug_found_with_none_data(self):
        """Response with data=None raises HTTPException(404)."""
        mock_sb, _ = _mock_supabase(execute_data=None)

        with pytest.raises(HTTPException) as exc_info:
            await _TestEntityService.get_by_slug(mock_sb, SIM_ID, "ghost")
        assert exc_info.value.status_code == 404


# ═══════════════════════════════════════════════════════════════════════════
# 4.5  ShowcaseImageService
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.integration
class TestShowcaseImageServiceValidation:
    """generate_showcase_image / generate_and_upload_showcase — archetype validation."""

    @pytest.mark.asyncio
    async def test_invalid_archetype_raises_value_error(self):
        """Unknown archetype raises ValueError before any API call."""
        mock_openrouter = MagicMock()
        mock_openrouter.generate_image = AsyncMock()

        with pytest.raises(ValueError, match="Unknown archetype 'nonexistent'"):
            await generate_showcase_image(mock_openrouter, "nonexistent")

        # No API call should have been made
        mock_openrouter.generate_image.assert_not_called()

    @pytest.mark.asyncio
    async def test_valid_archetype_calls_api(self):
        """Valid archetype triggers generate_image with correct model and prompt."""
        mock_openrouter = MagicMock()
        mock_openrouter.generate_image = AsyncMock(return_value=b"\x89PNG-fake-data")
        mock_openrouter.last_usage = {"model": "test", "prompt_tokens": 10}

        result = await generate_showcase_image(mock_openrouter, "shadow")

        assert result == b"\x89PNG-fake-data"
        mock_openrouter.generate_image.assert_called_once()
        call_kwargs = mock_openrouter.generate_image.call_args[1]
        assert call_kwargs["model"] == ARCHETYPE_VISUALS["shadow"].model
        assert call_kwargs["prompt"] == ARCHETYPE_VISUALS["shadow"].prompt
        assert call_kwargs["aspect_ratio"] == "16:9"

    @pytest.mark.asyncio
    async def test_all_base_archetypes_have_visuals(self):
        """Verify the 8 core archetypes are all present in ARCHETYPE_VISUALS."""
        core_archetypes = {
            "shadow", "tower", "mother", "entropy",
            "prometheus", "deluge", "awakening", "overthrow",
        }
        for arch in core_archetypes:
            assert arch in ARCHETYPE_VISUALS, f"Missing archetype visual: {arch}"


@pytest.mark.integration
class TestShowcaseImageServiceUpload:
    """generate_and_upload_showcase — full pipeline with mocked externals."""

    @pytest.mark.asyncio
    @patch("backend.services.dungeon.showcase_image_service.convert_to_avif")
    @patch("backend.services.dungeon.showcase_image_service.OpenRouterService")
    async def test_returns_correct_metadata(self, mock_or_cls, mock_convert):
        """Successful pipeline returns metadata dict with expected keys."""
        # Mock OpenRouterService instance
        mock_openrouter = MagicMock()
        mock_openrouter.generate_image = AsyncMock(return_value=b"\x89PNG-raw-bytes")
        mock_openrouter.last_usage = {"model": "flux.2-max", "prompt_tokens": 50}
        mock_or_cls.return_value = mock_openrouter

        # Mock AVIF conversion
        mock_convert.side_effect = [b"full-avif-bytes", b"thumb-avif-bytes"]

        mock_sb, _ = _mock_supabase()

        result = await generate_and_upload_showcase(mock_sb, "shadow")

        assert result["archetype"] == "shadow"
        assert result["model"] == ARCHETYPE_VISUALS["shadow"].model
        assert result["url"] == "https://cdn.example.com/showcase/dungeon-shadow.avif"
        assert result["full_path"] == "showcase/dungeon-shadow.full.avif"
        assert result["thumb_path"] == "showcase/dungeon-shadow.avif"
        assert result["bytes"] == len(b"\x89PNG-raw-bytes")
        assert result["usage"] == mock_openrouter.last_usage

    @pytest.mark.asyncio
    async def test_invalid_archetype_raises_before_api(self):
        """generate_and_upload_showcase with invalid archetype raises KeyError."""
        mock_sb, _ = _mock_supabase()

        # generate_and_upload_showcase uses dict key access ARCHETYPE_VISUALS[archetype_id]
        # which raises KeyError for unknown archetypes
        with pytest.raises(KeyError):
            await generate_and_upload_showcase(mock_sb, "nonexistent")
