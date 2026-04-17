"""Unit tests for SEO middleware (crawler detection, HTML enrichment, escaping)."""

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from backend.middleware.seo import (
    _escape,
    _inject_entity_content,
    _replace_meta,
    enrich_html_for_crawler,
    is_crawler,
)


class TestIsCrawler:
    def test_googlebot(self):
        assert is_crawler("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)") is True

    def test_bingbot(self):
        assert is_crawler("Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)") is True

    def test_twitterbot(self):
        assert is_crawler("Twitterbot/1.0") is True

    def test_facebook(self):
        assert is_crawler("facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)") is True

    def test_linkedinbot(self):
        assert is_crawler("LinkedInBot/1.0 (compatible; Mozilla/5.0)") is True

    def test_slackbot(self):
        assert is_crawler("Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)") is True

    def test_discordbot(self):
        assert is_crawler("Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)") is True

    def test_whatsapp(self):
        assert is_crawler("WhatsApp/2.21.23.23 A") is True

    def test_telegrambot(self):
        assert is_crawler("TelegramBot (like TwitterBot)") is True

    def test_applebot(self):
        assert is_crawler("Mozilla/5.0 (Applebot/0.1; +http://www.apple.com/go/applebot)") is True

    def test_normal_chrome(self):
        assert is_crawler("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0 Safari/537.36") is False

    def test_normal_firefox(self):
        assert is_crawler("Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0") is False

    def test_empty_string(self):
        assert is_crawler("") is False

    def test_case_insensitive(self):
        assert is_crawler("googlebot") is True
        assert is_crawler("GOOGLEBOT") is True


class TestEscape:
    def test_ampersand(self):
        assert _escape("a & b") == "a &amp; b"

    def test_quotes(self):
        assert _escape('say "hello"') == "say &quot;hello&quot;"

    def test_angle_brackets(self):
        assert _escape("<script>") == "&lt;script&gt;"

    def test_clean_string(self):
        assert _escape("Hello World") == "Hello World"

    def test_combined(self):
        assert _escape('<a href="x&y">') == "&lt;a href=&quot;x&amp;y&quot;&gt;"


class TestReplaceMeta:
    def test_replaces_name_meta(self):
        html = '<meta name="description" content="old">'
        result = _replace_meta(html, "name", "description", "new")
        assert result == '<meta name="description" content="new">'

    def test_replaces_property_meta(self):
        html = '<meta property="og:title" content="old title">'
        result = _replace_meta(html, "property", "og:title", "new title")
        assert result == '<meta property="og:title" content="new title">'

    def test_no_match_unchanged(self):
        html = '<meta name="other" content="value">'
        result = _replace_meta(html, "name", "description", "new")
        assert result == html


class TestEnrichHtmlForCrawler:
    @pytest.fixture(autouse=True)
    def _reset_cache(self):
        """Reset the module-level caches between tests."""
        import backend.middleware.seo as seo_module
        seo_module._index_html_cache = None
        seo_module._sim_meta_cache.clear()
        seo_module._anon_client = None
        yield
        seo_module._index_html_cache = None
        seo_module._sim_meta_cache.clear()
        seo_module._anon_client = None

    @pytest.mark.anyio
    async def test_returns_none_for_non_simulation_paths(self):
        result = await enrich_html_for_crawler(Path("/fake"), "/dashboard")
        assert result is None

    @pytest.mark.anyio
    async def test_returns_none_for_root(self):
        result = await enrich_html_for_crawler(Path("/fake"), "/")
        assert result is None

    @pytest.mark.anyio
    async def test_returns_none_for_login(self):
        result = await enrich_html_for_crawler(Path("/fake"), "/login")
        assert result is None

    @pytest.mark.anyio
    async def test_returns_none_for_missing_index(self, tmp_path):
        result = await enrich_html_for_crawler(
            tmp_path / "nonexistent.html",
            "/simulations/10000000-0000-0000-0000-000000000001/agents",
        )
        assert result is None

    @pytest.mark.anyio
    async def test_enriches_simulation_page(self, tmp_path):
        index = tmp_path / "index.html"
        index.write_text(
            '<html><head>'
            '<title>metaverse.center — a worldbuilding framework</title>'
            '<meta name="description" content="default desc">'
            '<meta property="og:title" content="default">'
            '<meta property="og:description" content="default">'
            '<meta property="og:url" content="https://metaverse.center/">'
            '<meta name="twitter:title" content="default">'
            '<meta name="twitter:description" content="default">'
            '<link rel="canonical" href="https://metaverse.center/">'
            '</head></html>'
        )

        mock_response = MagicMock()
        mock_response.data = [{"name": "Test Sim", "description": "A test simulation", "banner_url": ""}]

        with patch("backend.middleware.seo.create_client") as mock_create:
            mock_client = MagicMock()
            mock_create.return_value = mock_client
            mock_client.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = mock_response

            result = await enrich_html_for_crawler(
                index,
                "/simulations/10000000-0000-0000-0000-000000000001/agents",
            )

        assert result is not None
        assert "<title>Agents — Test Sim | metaverse.center</title>" in result
        assert 'content="A test simulation"' in result
        assert "simulations/10000000-0000-0000-0000-000000000001/agents" in result

    @pytest.mark.anyio
    async def test_escapes_xss_in_simulation_name(self, tmp_path):
        index = tmp_path / "index.html"
        index.write_text(
            '<html><head>'
            '<title>default</title>'
            '<meta name="description" content="default">'
            '<meta property="og:title" content="default">'
            '<meta property="og:description" content="default">'
            '<meta property="og:url" content="https://metaverse.center/">'
            '<meta name="twitter:title" content="default">'
            '<meta name="twitter:description" content="default">'
            '<link rel="canonical" href="https://metaverse.center/">'
            '</head></html>'
        )

        mock_response = MagicMock()
        mock_response.data = [{"name": '<script>alert("xss")</script>', "description": "", "banner_url": ""}]

        with patch("backend.middleware.seo.create_client") as mock_create:
            mock_client = MagicMock()
            mock_create.return_value = mock_client
            mock_client.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = mock_response

            result = await enrich_html_for_crawler(
                index,
                "/simulations/10000000-0000-0000-0000-000000000001/agents",
            )

        assert result is not None
        assert "<script>" not in result
        assert "&lt;script&gt;" in result

    @pytest.mark.anyio
    async def test_returns_none_when_simulation_not_found(self, tmp_path):
        index = tmp_path / "index.html"
        index.write_text("<html><head><title>x</title></head></html>")

        mock_response = MagicMock()
        mock_response.data = []

        with patch("backend.middleware.seo.create_client") as mock_create:
            mock_client = MagicMock()
            mock_create.return_value = mock_client
            mock_client.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = mock_response

            result = await enrich_html_for_crawler(
                index,
                "/simulations/ffffffff-ffff-ffff-ffff-ffffffffffff/agents",
            )

        assert result is None

    @pytest.mark.anyio
    async def test_enriches_with_entity_content(self, tmp_path):
        """Verify entity content div and JSON-LD are injected for crawler responses."""
        index = tmp_path / "index.html"
        index.write_text(
            '<html><head>'
            '<title>metaverse.center</title>'
            '<meta name="description" content="default">'
            '<meta property="og:title" content="default">'
            '<meta property="og:description" content="default">'
            '<meta property="og:url" content="https://metaverse.center/">'
            '<meta name="twitter:title" content="default">'
            '<meta name="twitter:description" content="default">'
            '<link rel="canonical" href="https://metaverse.center/">'
            '</head><body><velg-app></velg-app></body></html>'
        )

        sim_response = MagicMock()
        sim_response.data = [{
            "id": "10000000-0000-0000-0000-000000000001",
            "slug": "test-sim",
            "name": "Test Sim",
            "description": "A test simulation",
            "banner_url": "",
        }]

        with patch("backend.middleware.seo.create_client") as mock_create, \
             patch("backend.middleware.seo.build_view_content") as mock_build:
            mock_client = MagicMock()
            mock_create.return_value = mock_client
            mock_client.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = sim_response
            mock_build.return_value = (
                '<article><h3>Ada</h3></article>',
                '{"@type":"CollectionPage"}',
            )

            result = await enrich_html_for_crawler(
                index,
                "/simulations/10000000-0000-0000-0000-000000000001/agents",
            )

        assert result is not None
        assert 'id="seo-content"' in result
        assert "Ada" in result
        assert "CollectionPage" in result

    @pytest.mark.anyio
    async def test_entity_content_view_jsonld_type(self, tmp_path):
        """Verify JSON-LD @type varies by view."""
        index = tmp_path / "index.html"
        index.write_text(
            '<html><head>'
            '<title>x</title>'
            '<meta name="description" content="d">'
            '<meta property="og:title" content="d">'
            '<meta property="og:description" content="d">'
            '<meta property="og:url" content="u">'
            '<meta name="twitter:title" content="d">'
            '<meta name="twitter:description" content="d">'
            '<link rel="canonical" href="u">'
            '</head><body></body></html>'
        )

        sim_response = MagicMock()
        sim_response.data = [{
            "id": "10000000-0000-0000-0000-000000000001",
            "slug": "sim",
            "name": "Sim",
            "description": "",
            "banner_url": "",
        }]

        with patch("backend.middleware.seo.create_client") as mock_create, \
             patch("backend.middleware.seo.build_view_content") as mock_build:
            mock_client = MagicMock()
            mock_create.return_value = mock_client
            mock_client.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = sim_response
            mock_build.return_value = ("<p>lore</p>", '{"@type":"CreativeWork"}')

            result = await enrich_html_for_crawler(
                index,
                "/simulations/10000000-0000-0000-0000-000000000001/lore",
            )

        assert result is not None
        assert "CreativeWork" in result


class TestEntityMetaOverride:
    """When a URL carries an entity slug/UUID, the detail builder's EntityMeta
    must override the simulation-level title / description / og:image / og:type."""

    @pytest.fixture(autouse=True)
    def _reset_cache(self):
        import backend.middleware.seo as seo_module
        seo_module._index_html_cache = None
        seo_module._sim_meta_cache.clear()
        seo_module._entity_cache.clear()
        seo_module._anon_client = None
        yield
        seo_module._index_html_cache = None
        seo_module._sim_meta_cache.clear()
        seo_module._entity_cache.clear()
        seo_module._anon_client = None

    @pytest.mark.anyio
    async def test_agent_detail_overrides_title_and_description(self, tmp_path):
        from backend.seo.models import EntityDetailResult, EntityMeta

        index = tmp_path / "index.html"
        index.write_text(
            '<html><head>'
            '<title>default</title>'
            '<meta name="description" content="default">'
            '<meta property="og:title" content="default">'
            '<meta property="og:description" content="default">'
            '<meta property="og:url" content="default">'
            '<meta property="og:type" content="website">'
            '<meta property="og:image" content="default">'
            '<meta property="og:image:alt" content="default">'
            '<meta name="twitter:title" content="default">'
            '<meta name="twitter:description" content="default">'
            '<meta name="twitter:image" content="default">'
            '<meta name="twitter:image:alt" content="default">'
            '<link rel="canonical" href="default">'
            '</head><body></body></html>'
        )

        sim_response = MagicMock()
        sim_response.data = [{
            "id": "10000000-0000-0000-0000-000000000001",
            "slug": "station-null",
            "name": "Station Null",
            "description": "An orbital outpost.",
            "banner_url": "https://example.com/banner.jpg",
        }]

        entity_detail = EntityDetailResult(
            html="<h2>Alice Smith</h2>",
            jsonld='{"@type":"Person"}',
            meta=EntityMeta(
                title="Alice Smith — Station Null | metaverse.center",
                description="A brilliant inventor driven by cosmic curiosity.",
                og_image="https://example.com/alice.jpg",
                og_image_alt="Alice Smith — portrait",
                og_type="profile",
            ),
        )

        with patch("backend.middleware.seo.create_client") as mock_create, \
             patch("backend.middleware.seo.build_entity_detail_content") as mock_detail:
            mock_client = MagicMock()
            mock_create.return_value = mock_client
            mock_client.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = sim_response
            mock_detail.return_value = entity_detail

            result = await enrich_html_for_crawler(
                index,
                "/simulations/station-null/agents/alice-smith",
            )

        assert result is not None
        assert "<title>Alice Smith — Station Null | metaverse.center</title>" in result
        assert 'content="A brilliant inventor driven by cosmic curiosity."' in result
        assert 'content="https://example.com/alice.jpg"' in result
        assert 'content="Alice Smith — portrait"' in result
        assert '<meta property="og:type" content="profile"' in result
        # Entity content + JSON-LD are also injected
        assert "Alice Smith" in result
        assert '"@type":"Person"' in result

    @pytest.mark.anyio
    async def test_list_view_uses_sim_level_meta(self, tmp_path):
        """Without an entity slug, the URL is a list view — sim-level meta stays."""
        index = tmp_path / "index.html"
        index.write_text(
            '<html><head>'
            '<title>default</title>'
            '<meta name="description" content="default">'
            '<meta property="og:title" content="default">'
            '<meta property="og:description" content="default">'
            '<meta property="og:url" content="default">'
            '<meta property="og:type" content="website">'
            '<meta property="og:image" content="default">'
            '<meta name="twitter:title" content="default">'
            '<meta name="twitter:description" content="default">'
            '<meta name="twitter:image" content="default">'
            '<link rel="canonical" href="default">'
            '</head><body></body></html>'
        )

        sim_response = MagicMock()
        sim_response.data = [{
            "id": "10000000-0000-0000-0000-000000000001",
            "slug": "station-null",
            "name": "Station Null",
            "description": "An orbital outpost.",
            "banner_url": "",
        }]

        with patch("backend.middleware.seo.create_client") as mock_create, \
             patch("backend.middleware.seo.build_view_content") as mock_view:
            mock_client = MagicMock()
            mock_create.return_value = mock_client
            mock_client.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = sim_response
            mock_view.return_value = ("<article>list</article>", '{"@type":"ItemList"}')

            result = await enrich_html_for_crawler(
                index,
                "/simulations/station-null/agents",
            )

        assert result is not None
        assert "<title>Agents — Station Null | metaverse.center</title>" in result
        # og:type remains 'website' (no entity override)
        assert '<meta property="og:type" content="website"' in result


class TestInjectEntityContent:
    @pytest.fixture(autouse=True)
    def _reset_cache(self):
        import backend.middleware.seo as seo_module
        seo_module._entity_cache.clear()
        seo_module._anon_client = None
        yield
        seo_module._entity_cache.clear()
        seo_module._anon_client = None

    def test_injects_seo_content_div(self):
        base_html = "<html><head></head><body><app></app></body></html>"
        with patch("backend.middleware.seo.build_view_content") as mock_build, \
             patch("backend.middleware.seo._get_anon_client"):
            mock_build.return_value = ("<article>Test</article>", "")
            result = _inject_entity_content(base_html, "agents", "id", "Sim", "slug")

        assert 'id="seo-content"' in result
        assert "<article>Test</article>" in result

    def test_injects_jsonld(self):
        base_html = "<html><head></head><body></body></html>"
        with patch("backend.middleware.seo.build_view_content") as mock_build, \
             patch("backend.middleware.seo._get_anon_client"):
            mock_build.return_value = ("", '{"@type":"CollectionPage"}')
            result = _inject_entity_content(base_html, "agents", "id", "Sim", "slug")

        assert "application/ld+json" in result
        assert "CollectionPage" in result

    def test_empty_content_unchanged(self):
        base_html = "<html><head></head><body></body></html>"
        with patch("backend.middleware.seo.build_view_content") as mock_build, \
             patch("backend.middleware.seo._get_anon_client"):
            mock_build.return_value = ("", "")
            result = _inject_entity_content(base_html, "settings", "id", "Sim", "slug")

        assert result == base_html
