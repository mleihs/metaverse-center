"""Unit tests for SEO entity content builders."""

import json
from unittest.mock import MagicMock

from backend.middleware.seo_content import (
    _esc,
    _safe_jsonld,
    _truncate,
)
from backend.seo.registry import build_view_content


class TestHelpers:
    def test_esc_html(self):
        assert _esc("<script>alert('xss')</script>") == "&lt;script&gt;alert('xss')&lt;/script&gt;"

    def test_esc_none(self):
        assert _esc(None) == ""

    def test_truncate_short(self):
        assert _truncate("hello", 10) == "hello"

    def test_truncate_long(self):
        assert _truncate("hello world", 5) == "hello..."

    def test_safe_jsonld_escapes_angle_brackets(self):
        result = _safe_jsonld({"name": "<script>"})
        assert "\\u003cscript\\u003e" in result
        assert "<script>" not in result


class TestBuildViewContent:
    def _mock_client(self, table_data: dict[str, list[dict]]) -> MagicMock:
        """Create a mock Supabase client with table data."""
        client = MagicMock()

        def table_side_effect(table_name: str):
            mock_table = MagicMock()
            data = table_data.get(table_name, [])
            # Chain select().eq().is_().limit().execute() etc.
            mock_chain = MagicMock()
            mock_chain.execute.return_value = MagicMock(data=data)
            mock_chain.limit.return_value = mock_chain
            mock_chain.order.return_value = mock_chain
            mock_chain.eq.return_value = mock_chain
            mock_chain.is_.return_value = mock_chain
            mock_table.select.return_value = mock_chain
            return mock_table

        client.table.side_effect = table_side_effect
        return client

    def test_agents_produces_articles(self):
        client = self._mock_client({
            "agents": [
                {"name": "Ada", "character": "A brilliant inventor", "primary_profession": "Engineer"},
                {"name": "Bob", "character": "A wandering bard", "primary_profession": "Musician"},
            ],
        })
        html, jsonld = build_view_content(client, "sim-1", "TestSim", "test-sim", "agents")
        assert "<article>" in html
        assert "Ada" in html
        assert "Engineer" in html
        assert "Bob" in html
        parsed = json.loads(jsonld)
        assert parsed["@type"] == "ItemList"
        assert parsed["numberOfItems"] == 2

    def test_buildings_produces_articles(self):
        client = self._mock_client({
            "buildings": [
                {"name": "Tower", "description": "A tall structure", "building_type": "residential"},
            ],
        })
        html, jsonld = build_view_content(client, "sim-1", "TestSim", "test-sim", "buildings")
        assert "<article>" in html
        assert "Tower" in html
        assert "residential" in html
        parsed = json.loads(jsonld)
        assert parsed["@type"] == "ItemList"
        assert parsed["numberOfItems"] == 1

    def test_lore_produces_creative_work(self):
        client = self._mock_client({
            "simulations": [
                {"description": "A dark fantasy world", "banner_url": "https://example.com/banner.jpg"},
            ],
        })
        html, jsonld = build_view_content(client, "sim-1", "TestSim", "test-sim", "lore")
        assert "A dark fantasy world" in html
        parsed = json.loads(jsonld)
        assert parsed["@type"] == "CreativeWork"
        assert parsed["image"] == "https://example.com/banner.jpg"

    def test_chronicle_produces_article(self):
        client = self._mock_client({
            "chronicles": [
                {
                    "title": "The Great War",
                    "headline": "Armies clash",
                    "content": "Long story...",
                    "edition_number": 1,
                    "published_at": "2026-01-01T00:00:00Z",
                },
            ],
        })
        html, jsonld = build_view_content(client, "sim-1", "TestSim", "test-sim", "chronicle")
        assert "<article>" in html
        assert "The Great War" in html
        parsed = json.loads(jsonld)
        assert parsed["@type"] == "Article"
        assert parsed["datePublished"] == "2026-01-01T00:00:00Z"

    def test_chronicle_empty(self):
        client = self._mock_client({"chronicles": []})
        html, jsonld = build_view_content(client, "sim-1", "TestSim", "test-sim", "chronicle")
        assert "No editions published yet" in html
        assert jsonld == ""

    def test_locations_produces_zones_and_streets(self):
        client = self._mock_client({
            "zones": [{"name": "Market District", "description": "Bustling trade area"}],
            "city_streets": [{"name": "Baker Street"}],
        })
        html, jsonld = build_view_content(client, "sim-1", "TestSim", "test-sim", "locations")
        assert "Market District" in html
        assert "Baker Street" in html
        parsed = json.loads(jsonld)
        assert parsed["@type"] == "ItemList"
        assert parsed["numberOfItems"] == 2

    def test_events_produces_articles(self):
        client = self._mock_client({
            "events": [
                {"title": "Festival", "description": "A grand celebration", "event_type": "social"},
            ],
        })
        html, jsonld = build_view_content(client, "sim-1", "TestSim", "test-sim", "events")
        assert "<article>" in html
        assert "Festival" in html
        parsed = json.loads(jsonld)
        assert parsed["@type"] == "ItemList"

    def test_events_empty_graceful(self):
        client = self._mock_client({"events": []})
        html, jsonld = build_view_content(client, "sim-1", "TestSim", "test-sim", "events")
        assert "Live events" in html
        parsed = json.loads(jsonld)
        assert parsed["numberOfItems"] == 0

    def test_social_produces_webpage(self):
        client = self._mock_client({})
        html, jsonld = build_view_content(client, "sim-1", "TestSim", "test-sim", "social")
        assert "TestSim" in html
        assert "Social Trends" in html
        parsed = json.loads(jsonld)
        assert parsed["@type"] == "WebPage"
        assert parsed["url"] == "https://metaverse.center/simulations/test-sim/social"

    def test_broadsheet_produces_article(self):
        client = self._mock_client({
            "simulation_broadsheets": [
                {
                    "title": "The Bleed Times",
                    "subtitle": "Chronicles of the Fracture",
                    "edition_number": 5,
                    "published_at": "2026-04-14T00:00:00Z",
                    "articles": [
                        {"headline": "Zone collapse", "content": "The old quarter has fallen"},
                    ],
                    "editorial_voice": "alarmed",
                },
            ],
        })
        html, jsonld = build_view_content(client, "sim-1", "TestSim", "test-sim", "broadsheet")
        assert "The Bleed Times" in html
        assert "Edition 5" in html
        assert "Zone collapse" in html
        parsed = json.loads(jsonld)
        assert parsed["@type"] == "Article"
        assert parsed["datePublished"] == "2026-04-14T00:00:00Z"
        assert parsed["url"] == "https://metaverse.center/simulations/test-sim/broadsheet"

    def test_broadsheet_empty(self):
        client = self._mock_client({"simulation_broadsheets": []})
        html, jsonld = build_view_content(client, "sim-1", "TestSim", "test-sim", "broadsheet")
        assert "No editions published yet" in html
        assert jsonld == ""

    def test_unsupported_view_returns_empty(self):
        client = self._mock_client({})
        html, jsonld = build_view_content(client, "sim-1", "TestSim", "test-sim", "settings")
        assert html == ""
        assert jsonld == ""

    def test_escaped_content(self):
        client = self._mock_client({
            "agents": [
                {"name": "<script>alert(1)</script>", "character": "test", "primary_profession": "test"},
            ],
        })
        html, _ = build_view_content(client, "sim-1", "TestSim", "test-sim", "agents")
        assert "<script>" not in html
        assert "&lt;script&gt;" in html

    def test_exception_returns_empty(self):
        client = MagicMock()
        client.table.side_effect = Exception("DB error")
        html, jsonld = build_view_content(client, "sim-1", "TestSim", "test-sim", "agents")
        assert html == ""
        assert jsonld == ""
