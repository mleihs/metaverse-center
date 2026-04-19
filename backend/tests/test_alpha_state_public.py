"""Tests for the public alpha-state endpoint (routers/public.py).

Covers the Bureau-Dispatch first-contact modal config exposed at
GET /api/v1/public/alpha-state. Anonymous access, narrow DTO projection.
"""

from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend.dependencies import get_admin_supabase


def _mock_supabase_with_settings(rows: list[dict]) -> MagicMock:
    """Minimal Supabase mock that returns the given rows for platform_settings."""
    mock = MagicMock()
    result = MagicMock()
    result.data = rows

    chain = MagicMock()
    chain.select.return_value = chain
    chain.in_.return_value = chain
    chain.execute = AsyncMock(return_value=result)

    mock.table.return_value = chain
    return mock


@pytest.fixture()
def client():
    return TestClient(app)


class TestAlphaStatePublic:
    def test_returns_enabled_modal(self, client: TestClient):
        supabase = _mock_supabase_with_settings(
            [
                {"setting_key": "alpha_first_contact_modal_enabled", "setting_value": "true"},
                {"setting_key": "alpha_first_contact_modal_version", "setting_value": "2026-04-19"},
            ]
        )
        app.dependency_overrides[get_admin_supabase] = lambda: supabase
        try:
            r = client.get("/api/v1/public/alpha-state")
            assert r.status_code == 200
            body = r.json()
            assert body["success"] is True
            assert body["data"]["first_contact"]["enabled"] is True
            assert body["data"]["first_contact"]["version"] == "2026-04-19"
        finally:
            app.dependency_overrides.clear()

    def test_returns_disabled_modal(self, client: TestClient):
        supabase = _mock_supabase_with_settings(
            [
                {"setting_key": "alpha_first_contact_modal_enabled", "setting_value": "false"},
                {"setting_key": "alpha_first_contact_modal_version", "setting_value": "2026-04-19"},
            ]
        )
        app.dependency_overrides[get_admin_supabase] = lambda: supabase
        try:
            r = client.get("/api/v1/public/alpha-state")
            assert r.status_code == 200
            body = r.json()
            assert body["data"]["first_contact"]["enabled"] is False
        finally:
            app.dependency_overrides.clear()

    def test_missing_rows_degrade_to_disabled(self, client: TestClient):
        """Fresh DB without seed rows must not crash — enabled=False, version=''."""
        supabase = _mock_supabase_with_settings([])
        app.dependency_overrides[get_admin_supabase] = lambda: supabase
        try:
            r = client.get("/api/v1/public/alpha-state")
            assert r.status_code == 200
            body = r.json()
            assert body["data"]["first_contact"]["enabled"] is False
            assert body["data"]["first_contact"]["version"] == ""
        finally:
            app.dependency_overrides.clear()

    def test_requires_no_auth(self, client: TestClient):
        """Endpoint is anonymous — no Authorization header required."""
        supabase = _mock_supabase_with_settings(
            [
                {"setting_key": "alpha_first_contact_modal_enabled", "setting_value": "true"},
                {"setting_key": "alpha_first_contact_modal_version", "setting_value": "2026-04-19"},
            ]
        )
        app.dependency_overrides[get_admin_supabase] = lambda: supabase
        try:
            r = client.get("/api/v1/public/alpha-state")
            assert r.status_code == 200
        finally:
            app.dependency_overrides.clear()
