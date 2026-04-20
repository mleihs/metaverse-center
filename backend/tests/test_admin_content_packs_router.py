"""Tests for backend/routers/admin_content_packs.py (A1.7 Phase 3 Option B).

Uses the REAL on-disk archetype YAML under content/dungeon/archetypes — the
archetypes are always present in the repo, so the list endpoint returns
a known-non-empty manifest and the get endpoint can fetch actual content.
"""

from __future__ import annotations

from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend.dependencies import (
    PLATFORM_ADMIN_EMAILS,
    get_admin_supabase,
    get_current_user,
)
from backend.models.common import CurrentUser

ADMIN_EMAIL = "test-admin-packs@velgarien.dev"
ADMIN_ID = UUID("cccccccc-cccc-cccc-cccc-cccccccccccc")


def _override_admin() -> None:
    PLATFORM_ADMIN_EMAILS.add(ADMIN_EMAIL)
    user = CurrentUser(id=ADMIN_ID, email=ADMIN_EMAIL, access_token="t")
    app.dependency_overrides[get_current_user] = lambda: user
    # require_platform_admin also hits get_admin_supabase for the cache
    # refresh check; stub it out with a harmless mock.
    app.dependency_overrides[get_admin_supabase] = lambda: None


@pytest.fixture()
def client():
    return TestClient(app)


@pytest.fixture(autouse=True)
def _cleanup():
    yield
    app.dependency_overrides.clear()
    PLATFORM_ADMIN_EMAILS.discard(ADMIN_EMAIL)


# ── Manifest ──────────────────────────────────────────────────────────────


class TestListManifest:
    def test_returns_archetype_manifest(self, client):
        _override_admin()
        r = client.get("/api/v1/admin/content-packs")
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        rows = body["data"]
        assert isinstance(rows, list)
        assert len(rows) > 0, "Repo ships 8 archetype packs — manifest can't be empty."

        # Every row has the expected shape. Manifest now spans BOTH archetype
        # packs (content/dungeon/archetypes/<slug>/*.yaml) and ability packs
        # (content/dungeon/abilities/*.yaml) since A1.7 Step 5.
        for row in rows:
            assert set(row.keys()) >= {"pack_slug", "resource_path", "entry_count", "file_path"}
            assert isinstance(row["pack_slug"], str)
            assert isinstance(row["resource_path"], str)
            assert isinstance(row["entry_count"], int)
            assert row["file_path"].startswith(
                ("content/dungeon/archetypes/", "content/dungeon/abilities/"),
            )

        # Shadow/banter is guaranteed to exist (it's the pilot pack); it
        # should carry entries > 0 so the UI can preview counts.
        shadow_banter = [
            r for r in rows if r["pack_slug"] == "shadow" and r["resource_path"] == "banter"
        ]
        assert len(shadow_banter) == 1
        assert shadow_banter[0]["entry_count"] > 0

    def test_results_are_sorted(self, client):
        _override_admin()
        r = client.get("/api/v1/admin/content-packs")
        assert r.status_code == 200
        rows = r.json()["data"]
        keys = [(row["pack_slug"], row["resource_path"]) for row in rows]
        assert keys == sorted(keys)


# ── Get resource ──────────────────────────────────────────────────────────


class TestGetResource:
    def test_returns_parsed_yaml(self, client):
        _override_admin()
        r = client.get("/api/v1/admin/content-packs/shadow/banter")
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        payload = body["data"]
        assert payload["pack_slug"] == "shadow"
        assert payload["resource_path"] == "banter"
        # Shape check: content dict contains at least schema_version + banter.
        assert "schema_version" in payload["content"]
        assert isinstance(payload["content"].get("banter"), list)

    def test_missing_file_returns_404(self, client):
        _override_admin()
        r = client.get("/api/v1/admin/content-packs/shadow/nonexistent_resource")
        assert r.status_code == 404

    def test_invalid_pack_slug_returns_422(self, client):
        _override_admin()
        # Uppercase rejected by regex.
        r = client.get("/api/v1/admin/content-packs/SHADOW/banter")
        assert r.status_code == 422

    def test_path_traversal_rejected_by_regex(self, client):
        _override_admin()
        # Even URL-encoded, ".." triggers regex failure (contains '.').
        r = client.get("/api/v1/admin/content-packs/shadow/..%2Fescape")
        # FastAPI normalizes paths; the regex still rejects.
        assert r.status_code in (404, 422)

    def test_unknown_pack_slug_returns_404(self, client):
        _override_admin()
        r = client.get("/api/v1/admin/content-packs/nonexistent_pack/banter")
        assert r.status_code == 404

    def test_bracket_notation_rejected_for_read(self, client):
        _override_admin()
        # Read is file-scoped; bracket-notation accepted by ContentDraftCreate
        # regex is rejected here (tighter regex on path param).
        r = client.get("/api/v1/admin/content-packs/shadow/banter%5Bab_01%5D")
        assert r.status_code == 422
