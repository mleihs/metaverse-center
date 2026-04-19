"""Tests for backend/routers/webhooks.py — GitHub webhook receiver.

Covers:
    - HMAC verification: valid / invalid / missing / malformed / no-secret
    - Required headers: X-GitHub-Delivery, X-GitHub-Event
    - Body parsing: JSON-decode error path
    - Idempotency dedup: duplicate delivery_id short-circuits to 200
    - Event dispatch: pull_request closed (merged + unmerged), reopened,
      other actions, non-pull_request events, no-matching-drafts
    - Always-200 invariant after dedup: processing exceptions return 200
      with `processing_result='error'` recorded

Uses TestClient + dependency_overrides for the FastAPI plumbing; mocks the
admin supabase chain to exercise INSERT / SELECT / UPDATE sequences in
order.
"""

from __future__ import annotations

import hashlib
import hmac
import json
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.app import app
from backend.dependencies import get_admin_supabase
from backend.models.content_drafts import ContentDraftStatus
from backend.routers.webhooks import (
    _PROCESSING_RESULT_ERROR,
    _PROCESSING_RESULT_IGNORED,
    _PROCESSING_RESULT_SUCCESS,
    _verify_signature,
)

# ── Test helpers ──────────────────────────────────────────────────────────


def _compute_signature(body: bytes, secret: str) -> str:
    """Build the X-Hub-Signature-256 header value GitHub would send."""
    sig = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return f"sha256={sig}"


def _draft_row(
    *,
    draft_id: UUID | None = None,
    pack_slug: str = "shadow",
    resource_path: str = "banter",
    status: ContentDraftStatus = ContentDraftStatus.PUBLISHED,
    pr_number: int = 42,
) -> dict:
    """Plausible content_drafts row for mock SELECT responses."""
    now = datetime.now(UTC).isoformat()
    return {
        "id": str(draft_id or uuid4()),
        "author_id": str(uuid4()),
        "pack_slug": pack_slug,
        "resource_path": resource_path,
        "base_sha": None,
        "base_content": {},
        "working_content": {},
        "status": status.value,
        "version": 1,
        "expected_head_oid": "abc",
        "commit_sha": "def",
        "pr_number": pr_number,
        "pr_url": f"https://github.com/x/y/pull/{pr_number}",
        "created_at": now,
        "updated_at": now,
        "published_at": now,
        "merged_at": None,
    }


def _exec_result(*, data: list | None = None) -> MagicMock:
    result = MagicMock()
    result.data = data or []
    result.count = None
    return result


def _mock_admin_supabase(execute_results: list[MagicMock]) -> MagicMock:
    """Same builder pattern as test_content_drafts_service._mock_supabase."""
    mock = MagicMock()
    chain = MagicMock()
    for method in (
        "select", "insert", "update", "delete",
        "eq", "in_", "is_", "order", "range", "limit",
    ):
        getattr(chain, method).return_value = chain
    chain.execute = AsyncMock(side_effect=execute_results)
    mock.table.return_value = chain
    return mock


def _make_unique_violation() -> PostgrestAPIError:
    return PostgrestAPIError(
        {"code": "23505", "message": "duplicate key value violates unique constraint"}
    )


@pytest.fixture()
def client():
    return TestClient(app)


@pytest.fixture()
def webhook_secret(monkeypatch):
    secret = "test-secret-1234567890abcdef"
    monkeypatch.setenv("GITHUB_WEBHOOK_SECRET", secret)
    return secret


def _override_admin_supabase(supabase: MagicMock) -> None:
    app.dependency_overrides[get_admin_supabase] = lambda: supabase


def _clear_overrides() -> None:
    app.dependency_overrides.clear()


def _pr_payload(
    *,
    action: str = "closed",
    pr_number: int = 42,
    merged: bool = True,
) -> dict:
    return {
        "action": action,
        "pull_request": {
            "number": pr_number,
            "merged": merged,
            "html_url": f"https://github.com/x/y/pull/{pr_number}",
        },
        "repository": {"full_name": "x/y"},
    }


# ── _verify_signature (pure) ──────────────────────────────────────────────


class TestVerifySignature:
    def test_valid_signature(self, monkeypatch):
        monkeypatch.setenv("GITHUB_WEBHOOK_SECRET", "s")
        body = b"hello world"
        sig = _compute_signature(body, "s")
        assert _verify_signature(body, sig) is True

    def test_invalid_signature(self, monkeypatch):
        monkeypatch.setenv("GITHUB_WEBHOOK_SECRET", "s")
        body = b"hello world"
        wrong = "sha256=" + "0" * 64
        assert _verify_signature(body, wrong) is False

    def test_missing_secret_fails_closed(self, monkeypatch):
        monkeypatch.delenv("GITHUB_WEBHOOK_SECRET", raising=False)
        body = b"x"
        sig = _compute_signature(body, "anything")
        # Even a "correct" signature against the assumed secret fails when
        # the env var is missing — fail-closed prevents accidental acceptance.
        assert _verify_signature(body, sig) is False

    def test_missing_header(self, monkeypatch):
        monkeypatch.setenv("GITHUB_WEBHOOK_SECRET", "s")
        assert _verify_signature(b"x", None) is False

    def test_malformed_header_no_prefix(self, monkeypatch):
        monkeypatch.setenv("GITHUB_WEBHOOK_SECRET", "s")
        bare_hex = hmac.new(b"s", b"x", hashlib.sha256).hexdigest()
        # Header missing the `sha256=` prefix → reject.
        assert _verify_signature(b"x", bare_hex) is False


# ── Endpoint integration ──────────────────────────────────────────────────


class TestWebhookEndpoint:
    def teardown_method(self):
        _clear_overrides()

    def test_valid_signature_processes_merge(self, client, webhook_secret):
        d_id = uuid4()
        payload = _pr_payload(action="closed", pr_number=42, merged=True)
        body = json.dumps(payload).encode()

        # Supabase chain (in order):
        #   1) INSERT github_webhook_events                       (dedup OK)
        #   2) SELECT content_drafts WHERE pr_number=42          → 1 row
        #   3) UPDATE content_drafts SET merged...                 (bulk)
        #   4) SELECT content_drafts WHERE id IN (...)            (re-fetch)
        #   5) UPDATE github_webhook_events SET processed_at,...
        merged_row = _draft_row(
            draft_id=d_id, status=ContentDraftStatus.MERGED, pr_number=42,
        )
        merged_row["merged_at"] = datetime.now(UTC).isoformat()
        supabase = _mock_admin_supabase(
            [
                _exec_result(data=[]),                      # INSERT
                _exec_result(data=[_draft_row(draft_id=d_id, pr_number=42)]),  # SELECT by pr
                _exec_result(data=[]),                      # UPDATE bulk
                _exec_result(data=[merged_row]),            # SELECT re-fetch
                _exec_result(data=[]),                      # UPDATE event row
            ]
        )
        _override_admin_supabase(supabase)

        r = client.post(
            "/api/v1/webhooks/github",
            content=body,
            headers={
                "X-Hub-Signature-256": _compute_signature(body, webhook_secret),
                "X-GitHub-Delivery": str(uuid4()),
                "X-GitHub-Event": "pull_request",
                "Content-Type": "application/json",
            },
        )
        assert r.status_code == 200
        assert _PROCESSING_RESULT_SUCCESS in r.text

    def test_valid_signature_reverts_on_unmerged_close(self, client, webhook_secret):
        d_id = uuid4()
        payload = _pr_payload(action="closed", pr_number=43, merged=False)
        body = json.dumps(payload).encode()

        reverted_row = _draft_row(
            draft_id=d_id, status=ContentDraftStatus.DRAFT, pr_number=43,
        )
        reverted_row["pr_number"] = None
        reverted_row["pr_url"] = None
        reverted_row["published_at"] = None
        reverted_row["commit_sha"] = None
        reverted_row["expected_head_oid"] = None

        supabase = _mock_admin_supabase(
            [
                _exec_result(data=[]),                                 # INSERT event
                _exec_result(data=[_draft_row(draft_id=d_id, pr_number=43)]),  # SELECT by pr
                _exec_result(data=[]),                                 # UPDATE revert bulk
                _exec_result(data=[reverted_row]),                     # SELECT re-fetch
                _exec_result(data=[]),                                 # UPDATE event row
            ]
        )
        _override_admin_supabase(supabase)

        r = client.post(
            "/api/v1/webhooks/github",
            content=body,
            headers={
                "X-Hub-Signature-256": _compute_signature(body, webhook_secret),
                "X-GitHub-Delivery": str(uuid4()),
                "X-GitHub-Event": "pull_request",
                "Content-Type": "application/json",
            },
        )
        assert r.status_code == 200
        assert _PROCESSING_RESULT_SUCCESS in r.text

    def test_invalid_signature_returns_401(self, client, webhook_secret):
        body = json.dumps(_pr_payload()).encode()
        r = client.post(
            "/api/v1/webhooks/github",
            content=body,
            headers={
                "X-Hub-Signature-256": "sha256=" + "0" * 64,
                "X-GitHub-Delivery": str(uuid4()),
                "X-GitHub-Event": "pull_request",
            },
        )
        assert r.status_code == 401

    def test_missing_signature_returns_401(self, client, webhook_secret):
        body = json.dumps(_pr_payload()).encode()
        r = client.post(
            "/api/v1/webhooks/github",
            content=body,
            headers={
                "X-GitHub-Delivery": str(uuid4()),
                "X-GitHub-Event": "pull_request",
            },
        )
        assert r.status_code == 401

    def test_missing_required_headers_returns_400(self, client, webhook_secret):
        body = b"{}"
        r = client.post(
            "/api/v1/webhooks/github",
            content=body,
            headers={
                "X-Hub-Signature-256": _compute_signature(body, webhook_secret),
                # X-GitHub-Delivery + X-GitHub-Event missing
            },
        )
        assert r.status_code == 400

    def test_invalid_json_returns_400(self, client, webhook_secret):
        body = b"this is not json"
        r = client.post(
            "/api/v1/webhooks/github",
            content=body,
            headers={
                "X-Hub-Signature-256": _compute_signature(body, webhook_secret),
                "X-GitHub-Delivery": str(uuid4()),
                "X-GitHub-Event": "pull_request",
            },
        )
        assert r.status_code == 400

    def test_duplicate_delivery_returns_200_no_processing(self, client, webhook_secret):
        body = json.dumps(_pr_payload()).encode()
        # INSERT raises 23505 → handler returns 200 immediately, no further
        # supabase calls. AsyncMock interprets an Exception in side_effect
        # as "raise this on call".
        supabase = _mock_admin_supabase([_make_unique_violation()])
        _override_admin_supabase(supabase)

        r = client.post(
            "/api/v1/webhooks/github",
            content=body,
            headers={
                "X-Hub-Signature-256": _compute_signature(body, webhook_secret),
                "X-GitHub-Delivery": str(uuid4()),
                "X-GitHub-Event": "pull_request",
            },
        )
        assert r.status_code == 200
        assert "duplicate" in r.text

    def test_non_pull_request_event_ignored(self, client, webhook_secret):
        body = json.dumps({"zen": "Mind your words, they are important."}).encode()
        supabase = _mock_admin_supabase(
            [
                _exec_result(data=[]),  # INSERT
                _exec_result(data=[]),  # UPDATE event row (final)
            ]
        )
        _override_admin_supabase(supabase)

        r = client.post(
            "/api/v1/webhooks/github",
            content=body,
            headers={
                "X-Hub-Signature-256": _compute_signature(body, webhook_secret),
                "X-GitHub-Delivery": str(uuid4()),
                "X-GitHub-Event": "ping",
            },
        )
        assert r.status_code == 200
        assert _PROCESSING_RESULT_IGNORED in r.text

    def test_pull_request_reopened_logs_only(self, client, webhook_secret):
        payload = _pr_payload(action="reopened", pr_number=99, merged=True)
        body = json.dumps(payload).encode()
        supabase = _mock_admin_supabase(
            [
                _exec_result(data=[]),                                  # INSERT
                _exec_result(data=[_draft_row(pr_number=99)]),          # SELECT by pr
                _exec_result(data=[]),                                  # UPDATE event row
            ]
        )
        _override_admin_supabase(supabase)

        r = client.post(
            "/api/v1/webhooks/github",
            content=body,
            headers={
                "X-Hub-Signature-256": _compute_signature(body, webhook_secret),
                "X-GitHub-Delivery": str(uuid4()),
                "X-GitHub-Event": "pull_request",
            },
        )
        assert r.status_code == 200
        assert _PROCESSING_RESULT_IGNORED in r.text

    def test_pull_request_no_attached_drafts_ignored(self, client, webhook_secret):
        payload = _pr_payload(action="closed", pr_number=12345, merged=True)
        body = json.dumps(payload).encode()
        supabase = _mock_admin_supabase(
            [
                _exec_result(data=[]),  # INSERT
                _exec_result(data=[]),  # SELECT by pr → 0 drafts
                _exec_result(data=[]),  # UPDATE event row
            ]
        )
        _override_admin_supabase(supabase)

        r = client.post(
            "/api/v1/webhooks/github",
            content=body,
            headers={
                "X-Hub-Signature-256": _compute_signature(body, webhook_secret),
                "X-GitHub-Delivery": str(uuid4()),
                "X-GitHub-Event": "pull_request",
            },
        )
        assert r.status_code == 200
        assert _PROCESSING_RESULT_IGNORED in r.text

    def test_processing_error_returns_200_records_error(self, client, webhook_secret):
        """Once HMAC + dedup pass, processing errors return 200 — GitHub
        has no dead-letter and 5xx would just multiply retries.
        """
        payload = _pr_payload(action="closed", pr_number=42, merged=True)
        body = json.dumps(payload).encode()

        # INSERT succeeds; SELECT by pr_number RAISES → handler catches.
        supabase = _mock_admin_supabase([])
        chain = supabase.table.return_value
        chain.execute = AsyncMock(
            side_effect=[
                _exec_result(data=[]),                  # INSERT event
                RuntimeError("simulated DB blip"),      # SELECT by pr (boom)
                _exec_result(data=[]),                  # UPDATE event row (always last)
            ]
        )
        _override_admin_supabase(supabase)

        r = client.post(
            "/api/v1/webhooks/github",
            content=body,
            headers={
                "X-Hub-Signature-256": _compute_signature(body, webhook_secret),
                "X-GitHub-Delivery": str(uuid4()),
                "X-GitHub-Event": "pull_request",
            },
        )
        assert r.status_code == 200
        assert _PROCESSING_RESULT_ERROR in r.text
