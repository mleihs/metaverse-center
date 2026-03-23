"""Tests for StyleReferenceService — upload, fetch, resolve, delete, list.

Covers:
1. upload_reference validation (content type, file size, entity_type, scope)
2. upload_reference success paths (global + entity)
3. fetch_from_url SSRF protection
4. resolve_reference priority chain (entity > global > None)
5. delete_reference (global + entity)
6. list_references (combined results)
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest

from backend.services.style_reference_service import StyleReferenceService
from backend.tests.conftest import make_chain_mock

MOCK_SIM_ID = UUID("22222222-2222-2222-2222-222222222222")
MOCK_ENTITY_ID = UUID("33333333-3333-3333-3333-333333333333")
FAKE_IMAGE_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100  # minimal PNG-ish header


def _mock_supabase_for_upload():
    """Supabase mock wired for storage + table calls."""
    mock = MagicMock()
    # Storage mock
    mock.storage.from_.return_value.upload = AsyncMock(return_value=None)
    mock.storage.from_.return_value.get_public_url = AsyncMock(
        return_value="https://storage.example.com/style-refs/portrait/test.avif"
    )
    # Table mock (for upsert / update)
    mock.table.return_value = make_chain_mock()
    return mock


# ---------------------------------------------------------------------------
# upload_reference — validation
# ---------------------------------------------------------------------------


class TestUploadReferenceValidation:
    """Validation checks in upload_reference()."""

    async def test_rejects_unsupported_content_type(self):
        mock_sb = _mock_supabase_for_upload()
        with pytest.raises(ValueError, match="Unsupported image type"):
            await StyleReferenceService.upload_reference(
                supabase=mock_sb,
                simulation_id=MOCK_SIM_ID,
                entity_type="portrait",
                scope="global",
                image_data=FAKE_IMAGE_BYTES,
                content_type="text/html",
            )

    async def test_rejects_file_over_10mb(self):
        mock_sb = _mock_supabase_for_upload()
        big_data = b"\x00" * (10 * 1024 * 1024 + 1)
        with pytest.raises(ValueError, match="File too large"):
            await StyleReferenceService.upload_reference(
                supabase=mock_sb,
                simulation_id=MOCK_SIM_ID,
                entity_type="portrait",
                scope="global",
                image_data=big_data,
                content_type="image/png",
            )

    async def test_rejects_invalid_entity_type(self):
        mock_sb = _mock_supabase_for_upload()
        with pytest.raises(ValueError, match="Invalid entity_type"):
            await StyleReferenceService.upload_reference(
                supabase=mock_sb,
                simulation_id=MOCK_SIM_ID,
                entity_type="vehicle",
                scope="global",
                image_data=FAKE_IMAGE_BYTES,
                content_type="image/png",
            )

    async def test_rejects_invalid_scope(self):
        mock_sb = _mock_supabase_for_upload()
        with pytest.raises(ValueError, match="Invalid scope"):
            await StyleReferenceService.upload_reference(
                supabase=mock_sb,
                simulation_id=MOCK_SIM_ID,
                entity_type="portrait",
                scope="zone",
                image_data=FAKE_IMAGE_BYTES,
                content_type="image/png",
            )

    async def test_rejects_entity_scope_without_entity_id(self):
        mock_sb = _mock_supabase_for_upload()
        with pytest.raises(ValueError, match="entity_id is required"):
            await StyleReferenceService.upload_reference(
                supabase=mock_sb,
                simulation_id=MOCK_SIM_ID,
                entity_type="portrait",
                scope="entity",
                image_data=FAKE_IMAGE_BYTES,
                content_type="image/png",
                entity_id=None,
            )


# ---------------------------------------------------------------------------
# upload_reference — success paths
# ---------------------------------------------------------------------------


class TestUploadReferenceSuccess:
    """Successful upload scenarios."""

    @patch("backend.services.style_reference_service._convert_to_avif", return_value=b"avif-bytes")
    async def test_global_upload_persists_settings(self, _mock_convert):
        mock_sb = _mock_supabase_for_upload()
        url = await StyleReferenceService.upload_reference(
            supabase=mock_sb,
            simulation_id=MOCK_SIM_ID,
            entity_type="portrait",
            scope="global",
            image_data=FAKE_IMAGE_BYTES,
            content_type="image/png",
            strength=0.65,
        )

        assert url == "https://storage.example.com/style-refs/portrait/test.avif"
        # Should have called storage upload
        mock_sb.storage.from_.return_value.upload.assert_called_once()
        # Should have called upsert twice (url key + strength key)
        assert mock_sb.table.return_value.upsert.call_count == 2

    @patch("backend.services.style_reference_service._convert_to_avif", return_value=b"avif-bytes")
    async def test_entity_upload_updates_table(self, _mock_convert):
        mock_sb = _mock_supabase_for_upload()
        url = await StyleReferenceService.upload_reference(
            supabase=mock_sb,
            simulation_id=MOCK_SIM_ID,
            entity_type="building",
            scope="entity",
            image_data=FAKE_IMAGE_BYTES,
            content_type="image/jpeg",
            entity_id=MOCK_ENTITY_ID,
        )

        assert url == "https://storage.example.com/style-refs/portrait/test.avif"
        # Should update the buildings table with style_reference_url
        mock_sb.table.assert_any_call("buildings")


# ---------------------------------------------------------------------------
# fetch_from_url — SSRF protection
# ---------------------------------------------------------------------------


class TestFetchFromUrlSsrf:
    """SSRF protection in fetch_from_url()."""

    async def test_rejects_ftp_scheme(self):
        with pytest.raises(ValueError, match="Only HTTP/HTTPS"):
            await StyleReferenceService.fetch_from_url("ftp://evil.com/image.png")

    async def test_rejects_file_scheme(self):
        with pytest.raises(ValueError, match="Only HTTP/HTTPS"):
            await StyleReferenceService.fetch_from_url("file:///etc/passwd")

    async def test_rejects_empty_scheme(self):
        with pytest.raises(ValueError, match="Only HTTP/HTTPS"):
            await StyleReferenceService.fetch_from_url("://no-scheme.com/x.png")

    async def test_rejects_private_ip_192_168(self):
        with pytest.raises(ValueError, match="private/internal"):
            await StyleReferenceService.fetch_from_url("http://192.168.1.1/image.png")

    async def test_rejects_private_ip_10(self):
        with pytest.raises(ValueError, match="private/internal"):
            await StyleReferenceService.fetch_from_url("http://10.0.0.1/image.png")

    async def test_rejects_loopback_ip(self):
        with pytest.raises(ValueError, match="private/internal"):
            await StyleReferenceService.fetch_from_url("http://127.0.0.1/image.png")

    async def test_rejects_link_local_ip(self):
        with pytest.raises(ValueError, match="private/internal"):
            await StyleReferenceService.fetch_from_url("http://169.254.169.254/latest/meta-data/")

    @patch("backend.utils.safe_fetch.socket.getaddrinfo")
    async def test_allows_public_hostname(self, mock_dns):
        """A public hostname should pass SSRF validation (DNS resolves to public IP).

        The actual HTTP request will fail (we don't mock httpx here),
        but we verify it passes URL/IP validation and reaches the network layer.
        """
        import httpx

        # Simulate DNS resolving to a public IP
        mock_dns.return_value = [
            (2, 1, 6, "", ("93.184.216.34", 0)),
        ]
        with pytest.raises((httpx.ConnectError, httpx.ConnectTimeout)):
            await StyleReferenceService.fetch_from_url(
                "https://public-images.example.com/ref.png"
            )


# ---------------------------------------------------------------------------
# resolve_reference — priority chain
# ---------------------------------------------------------------------------


class TestResolveReference:
    """Resolution priority: entity-level > global > None."""

    async def test_returns_entity_level_when_both_exist(self):
        """Entity-level reference takes precedence over global."""
        mock_sb = MagicMock()

        # Entity-level query returns a URL
        entity_chain = make_chain_mock(
            execute_data=[{"style_reference_url": "https://entity.example.com/ref.avif"}],
        )
        # Global query also has data (should not be reached)
        global_chain = make_chain_mock(
            execute_data=[
                {"setting_key": "image_ref_global_portrait", "setting_value": "https://global.example.com/ref.avif"},
                {"setting_key": "image_ref_strength_portrait", "setting_value": "0.60"},
            ],
        )

        call_count = 0

        def table_side_effect(table_name):
            nonlocal call_count
            call_count += 1
            if table_name == "agents":
                return entity_chain
            return global_chain

        mock_sb.table.side_effect = table_side_effect

        result = await StyleReferenceService.resolve_reference(
            mock_sb, MOCK_SIM_ID, "portrait", entity_id=MOCK_ENTITY_ID,
        )

        assert result is not None
        assert result["url"] == "https://entity.example.com/ref.avif"
        assert result["scope"] == "entity"
        assert result["strength"] == 0.75  # entity-level default

    async def test_falls_back_to_global_when_no_entity_ref(self):
        """When entity has no style_reference_url, falls back to global."""
        mock_sb = MagicMock()

        entity_chain = make_chain_mock(
            execute_data=[{"style_reference_url": None}],
        )
        global_chain = make_chain_mock(
            execute_data=[
                {"setting_key": "image_ref_global_portrait", "setting_value": "https://global.example.com/ref.avif"},
                {"setting_key": "image_ref_strength_portrait", "setting_value": "0.60"},
            ],
        )

        def table_side_effect(table_name):
            if table_name == "agents":
                return entity_chain
            return global_chain

        mock_sb.table.side_effect = table_side_effect

        result = await StyleReferenceService.resolve_reference(
            mock_sb, MOCK_SIM_ID, "portrait", entity_id=MOCK_ENTITY_ID,
        )

        assert result is not None
        assert result["url"] == "https://global.example.com/ref.avif"
        assert result["scope"] == "global"
        assert result["strength"] == 0.60

    async def test_returns_none_when_no_references(self):
        """No entity ref and no global ref returns None."""
        mock_sb = MagicMock()
        mock_sb.table.return_value = make_chain_mock(execute_data=[])

        result = await StyleReferenceService.resolve_reference(
            mock_sb, MOCK_SIM_ID, "building",
        )

        assert result is None

    async def test_parses_quoted_setting_values(self):
        """Settings stored as JSON strings ('"value"') are unquoted."""
        mock_sb = MagicMock()
        mock_sb.table.return_value = make_chain_mock(
            execute_data=[
                {"setting_key": "image_ref_global_building", "setting_value": '"https://quoted.example.com/ref.avif"'},
                {"setting_key": "image_ref_strength_building", "setting_value": '"0.80"'},
            ],
        )

        result = await StyleReferenceService.resolve_reference(
            mock_sb, MOCK_SIM_ID, "building",
        )

        assert result is not None
        assert result["url"] == "https://quoted.example.com/ref.avif"
        assert result["strength"] == 0.80

    async def test_invalid_strength_falls_back_to_default(self):
        """Non-numeric strength value falls back to 0.75."""
        mock_sb = MagicMock()
        mock_sb.table.return_value = make_chain_mock(
            execute_data=[
                {"setting_key": "image_ref_global_portrait", "setting_value": "https://example.com/ref.avif"},
                {"setting_key": "image_ref_strength_portrait", "setting_value": "not-a-number"},
            ],
        )

        result = await StyleReferenceService.resolve_reference(
            mock_sb, MOCK_SIM_ID, "portrait",
        )

        assert result is not None
        assert result["strength"] == 0.75


# ---------------------------------------------------------------------------
# delete_reference
# ---------------------------------------------------------------------------


class TestDeleteReference:
    """Tests for delete_reference()."""

    async def test_global_delete_clears_settings(self):
        """Global delete removes both URL and strength setting keys."""
        mock_sb = MagicMock()

        # First call: select to find old URL for storage cleanup
        select_chain = make_chain_mock(
            execute_data=[{"setting_value": "https://storage.example.com/simulation.assets/object/public/sim/ref.avif"}],
        )
        # Second call: delete settings
        delete_chain = make_chain_mock(execute_data=[])

        call_count = 0

        def table_side_effect(table_name):
            nonlocal call_count
            call_count += 1
            if call_count <= 1:
                return select_chain
            return delete_chain

        mock_sb.table.side_effect = table_side_effect
        mock_sb.storage.from_.return_value.remove = AsyncMock(return_value=None)

        await StyleReferenceService.delete_reference(
            mock_sb, MOCK_SIM_ID, "portrait", "global",
        )

        # Should have called table at least twice (select + delete)
        assert mock_sb.table.call_count >= 2

    async def test_entity_delete_clears_column(self):
        """Entity delete sets style_reference_url to None."""
        mock_sb = MagicMock()

        # First call: select to find old URL
        select_chain = make_chain_mock(
            execute_data=[{"style_reference_url": "https://storage.example.com/ref.avif"}],
        )
        # Second call: update to clear
        update_chain = make_chain_mock(execute_data=[])

        call_count = 0

        def table_side_effect(table_name):
            nonlocal call_count
            call_count += 1
            if call_count <= 1:
                return select_chain
            return update_chain

        mock_sb.table.side_effect = table_side_effect
        mock_sb.storage.from_.return_value.remove = AsyncMock(return_value=None)

        await StyleReferenceService.delete_reference(
            mock_sb, MOCK_SIM_ID, "building", "entity",
            entity_id=MOCK_ENTITY_ID,
        )

        # Should have queried and updated the buildings table
        mock_sb.table.assert_any_call("buildings")

    async def test_entity_delete_requires_entity_id(self):
        mock_sb = MagicMock()
        with pytest.raises(ValueError, match="entity_id is required"):
            await StyleReferenceService.delete_reference(
                mock_sb, MOCK_SIM_ID, "portrait", "entity",
                entity_id=None,
            )


# ---------------------------------------------------------------------------
# list_references
# ---------------------------------------------------------------------------


class TestListReferences:
    """Tests for list_references()."""

    async def test_returns_global_and_entity_refs(self):
        """Returns both global and per-entity references."""
        mock_sb = MagicMock()

        agent_id = str(uuid4())

        # The method calls resolve_reference (global), then queries entity table.
        # resolve_reference queries simulation_settings.
        # list_references then queries agents with .not_.is_("style_reference_url", "null").
        # not_ is accessed as an *attribute* (not called), so we need special handling.
        settings_chain = make_chain_mock(
            execute_data=[
                {"setting_key": "image_ref_global_portrait", "setting_value": "https://global.example.com/ref.avif"},
                {"setting_key": "image_ref_strength_portrait", "setting_value": "0.70"},
            ],
        )

        # Build entity chain manually — not_.is_() uses attribute access on not_
        entity_chain = MagicMock()
        entity_resp = MagicMock()
        entity_resp.data = [
            {"id": agent_id, "name": "Agent Alpha", "style_reference_url": "https://entity.example.com/agent.avif"},
        ]
        entity_chain.select.return_value = entity_chain
        entity_chain.eq.return_value = entity_chain
        # .not_ is attribute access, then .is_() is called on it
        entity_chain.not_.is_.return_value = entity_chain
        entity_chain.execute = AsyncMock(return_value=entity_resp)

        def table_side_effect(table_name):
            if table_name == "simulation_settings":
                return settings_chain
            return entity_chain

        mock_sb.table.side_effect = table_side_effect

        results = await StyleReferenceService.list_references(
            mock_sb, MOCK_SIM_ID, "portrait",
        )

        assert len(results) == 2
        # First should be global
        assert results[0]["scope"] == "global"
        assert results[0]["reference_image_url"] == "https://global.example.com/ref.avif"
        assert results[0]["strength"] == 0.70
        # Second should be entity
        assert results[1]["scope"] == "entity"
        assert results[1]["entity_id"] == agent_id
        assert results[1]["entity_name"] == "Agent Alpha"

    async def test_returns_empty_when_none_configured(self):
        """Returns empty list when no references exist."""
        mock_sb = MagicMock()
        chain = make_chain_mock(execute_data=[])
        # .not_ is accessed as attribute (not called), so set it to chain itself
        # to keep the fluent API working through .not_.is_().execute()
        chain.not_ = chain
        mock_sb.table.return_value = chain

        results = await StyleReferenceService.list_references(
            mock_sb, MOCK_SIM_ID, "building",
        )

        assert results == []
