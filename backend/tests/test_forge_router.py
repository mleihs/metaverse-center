"""Integration tests for the Forge router endpoints."""

from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend.dependencies import get_admin_supabase, get_current_user, get_supabase
from backend.models.common import CurrentUser

MOCK_USER_ID = uuid4()
MOCK_ADMIN_EMAIL = "admin@velgarien.dev"
DRAFT_ID = uuid4()


def _mock_user(email: str = "test@velgarien.dev") -> CurrentUser:
    return CurrentUser(id=MOCK_USER_ID, email=email, access_token="mock")


def _mock_supabase():
    mock = MagicMock()
    builder = MagicMock()
    response = MagicMock()
    response.data = []
    response.count = 0

    builder.select.return_value = builder
    builder.insert.return_value = builder
    builder.update.return_value = builder
    builder.delete.return_value = builder
    builder.eq.return_value = builder
    builder.in_.return_value = builder
    builder.lt.return_value = builder
    builder.order.return_value = builder
    builder.range.return_value = builder
    builder.single.return_value = builder
    builder.execute.return_value = response

    mock.table.return_value = builder
    return mock


@pytest.fixture()
def client():
    """Client with architect permissions (admin email bypasses wallet check)."""
    user = _mock_user(email=MOCK_ADMIN_EMAIL)
    mock_sb = _mock_supabase()
    admin_sb = _mock_supabase()

    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_supabase] = lambda: mock_sb
    app.dependency_overrides[get_admin_supabase] = lambda: admin_sb

    yield TestClient(app), mock_sb

    app.dependency_overrides.clear()


class TestListDrafts:
    def test_returns_paginated(self, client):
        test_client, _ = client
        resp = test_client.get("/api/v1/forge/drafts")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["meta"]["total"] == 0


class TestCreateDraft:
    def test_create(self, client):
        test_client, mock_sb = client
        # Return a draft row on insert
        insert_resp = MagicMock()
        insert_resp.data = [{"id": str(DRAFT_ID), "user_id": str(MOCK_USER_ID), "status": "draft"}]
        mock_sb.table.return_value.insert.return_value.execute.return_value = insert_resp

        resp = test_client.post("/api/v1/forge/drafts", json={"seed_prompt": "test"})
        assert resp.status_code == 200
        assert resp.json()["success"] is True


class TestGetWallet:
    def test_get_wallet(self, client):
        test_client, _ = client
        resp = test_client.get("/api/v1/forge/wallet")
        assert resp.status_code == 200


class TestAdminStats:
    def test_stats_returns_data(self, client):
        test_client, _ = client
        resp = test_client.get("/api/v1/forge/admin/stats")
        assert resp.status_code == 200
        body = resp.json()
        assert "active_drafts" in body["data"]
        assert "total_tokens" in body["data"]
        assert "total_materialized" in body["data"]


class TestAdminPurge:
    def test_purge(self, client):
        test_client, _ = client
        resp = test_client.delete("/api/v1/forge/admin/purge?days=30")
        assert resp.status_code == 200
        assert resp.json()["success"] is True
