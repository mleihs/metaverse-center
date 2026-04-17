"""Integration tests for SEO endpoints (robots.txt, sitemap.xml).

Runs against the real local Supabase instance with seed data.
"""

import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend.tests.integration.conftest import requires_supabase

SIM_VELGARIEN_SLUG = "velgarien"


@pytest.fixture()
def client():
    return TestClient(app)


class TestRobotsTxt:
    def test_returns_200(self, client: TestClient):
        r = client.get("/robots.txt")
        assert r.status_code == 200

    def test_content_type_is_text(self, client: TestClient):
        r = client.get("/robots.txt")
        assert "text/plain" in r.headers["content-type"]

    def test_allows_root(self, client: TestClient):
        r = client.get("/robots.txt")
        assert "Allow: /" in r.text

    def test_allows_dashboard(self, client: TestClient):
        r = client.get("/robots.txt")
        assert "Allow: /dashboard" in r.text

    def test_allows_simulations(self, client: TestClient):
        r = client.get("/robots.txt")
        assert "Allow: /simulations/" in r.text

    def test_disallows_login(self, client: TestClient):
        r = client.get("/robots.txt")
        assert "Disallow: /login" in r.text

    def test_disallows_register(self, client: TestClient):
        r = client.get("/robots.txt")
        assert "Disallow: /register" in r.text

    def test_disallows_api(self, client: TestClient):
        r = client.get("/robots.txt")
        assert "Disallow: /api/" in r.text

    def test_contains_sitemap(self, client: TestClient):
        r = client.get("/robots.txt")
        assert "Sitemap: https://metaverse.center/sitemap.xml" in r.text


@requires_supabase
class TestSitemapXml:
    def test_returns_200(self, client: TestClient):
        r = client.get("/sitemap.xml")
        assert r.status_code == 200

    def test_content_type_is_xml(self, client: TestClient):
        r = client.get("/sitemap.xml")
        assert "application/xml" in r.headers["content-type"]

    def test_cache_control_header(self, client: TestClient):
        r = client.get("/sitemap.xml")
        assert r.headers["cache-control"] == "public, max-age=3600"

    def test_contains_xml_declaration(self, client: TestClient):
        r = client.get("/sitemap.xml")
        assert r.text.startswith('<?xml version="1.0" encoding="UTF-8"?>')

    def test_contains_homepage(self, client: TestClient):
        r = client.get("/sitemap.xml")
        assert "<loc>https://metaverse.center/</loc>" in r.text

    def test_contains_dashboard(self, client: TestClient):
        r = client.get("/sitemap.xml")
        assert "<loc>https://metaverse.center/dashboard</loc>" in r.text

    def test_contains_simulation_views(self, client: TestClient):
        r = client.get("/sitemap.xml")
        text = r.text
        # Public views enumerated in backend/seo/registry.py — full set.
        for view in [
            "lore", "agents", "buildings", "events", "locations",
            "chronicle", "broadsheet", "social", "health",
        ]:
            assert f"/simulations/{SIM_VELGARIEN_SLUG}/{view}" in text

    def test_omits_private_views(self, client: TestClient):
        r = client.get("/sitemap.xml")
        text = r.text
        # Private/dashboard-only views must NOT appear in the sitemap.
        for view in ["chat", "settings", "terminal", "bonds", "pulse", "trends"]:
            assert f"/simulations/{SIM_VELGARIEN_SLUG}/{view}" not in text

    def test_contains_archetype_detail_pages(self, client: TestClient):
        r = client.get("/sitemap.xml")
        text = r.text
        # Eight Resonance Dungeon archetype literary detail pages
        for slug in [
            "shadow", "tower", "mother", "entropy",
            "prometheus", "deluge", "awakening", "overthrow",
        ]:
            assert f"https://metaverse.center/archetypes/{slug}" in text

    def test_homepage_has_highest_priority(self, client: TestClient):
        r = client.get("/sitemap.xml")
        # Find the homepage entry — it should have priority 1.0
        idx = r.text.index("https://metaverse.center/</loc>")
        section = r.text[idx : idx + 200]
        assert "<priority>1.0</priority>" in section

    def test_valid_urlset_namespace(self, client: TestClient):
        r = client.get("/sitemap.xml")
        assert 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"' in r.text
