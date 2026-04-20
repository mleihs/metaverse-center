"""Tests for backend/routers/admin_drafts.py.

Mock-based — no real DB or GitHub. Covers:
    - list (pagination, status filter, author filter)
    - get single (success, 404)
    - create (success + audit)
    - update working (version match, version mismatch → 409)
    - delete = abandon (state-gated per decision C)
    - publish (calls publish_batch + audit)
"""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend.dependencies import (
    PLATFORM_ADMIN_EMAILS,
    get_admin_supabase,
    get_current_user,
    get_effective_supabase,
)
from backend.models.common import CurrentUser
from backend.models.content_drafts import (
    BatchPublishResult,
    ConflictPreview,
    ContentDraft,
    ContentDraftStatus,
    ContentDraftSummary,
    EntryConflictDTO,
)

# ── Test helpers ──────────────────────────────────────────────────────────


ADMIN_EMAIL = "test-admin-drafts@velgarien.dev"
ADMIN_ID = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")


def _admin_user() -> CurrentUser:
    return CurrentUser(id=ADMIN_ID, email=ADMIN_EMAIL, access_token="t")


def _draft_row(
    *,
    draft_id: UUID | None = None,
    pack_slug: str = "shadow",
    resource_path: str = "banter",
    status: ContentDraftStatus = ContentDraftStatus.DRAFT,
    version: int = 1,
    pr_number: int | None = None,
) -> dict:
    now = datetime.now(UTC).isoformat()
    return {
        "id": str(draft_id or uuid4()),
        "author_id": str(ADMIN_ID),
        "pack_slug": pack_slug,
        "resource_path": resource_path,
        "base_sha": None,
        "base_content": {"schema_version": 1, "banter": []},
        "working_content": {
            "schema_version": 1,
            "banter": [{"id": "sb_01", "text_de": "Test"}],
        },
        "status": status.value,
        "version": version,
        "expected_head_oid": None,
        "commit_sha": None,
        "pr_number": pr_number,
        "pr_url": None,
        "created_at": now,
        "updated_at": now,
        "published_at": None,
        "merged_at": None,
    }


def _summary_row(**kwargs) -> dict:
    full = _draft_row(**kwargs)
    keep = {
        "id", "author_id", "pack_slug", "resource_path", "status", "version",
        "pr_number", "pr_url", "created_at", "updated_at",
        "published_at", "merged_at",
    }
    return {k: v for k, v in full.items() if k in keep}


def _exec_result(*, data: list | None = None, count: int | None = None) -> MagicMock:
    result = MagicMock()
    result.data = data or []
    result.count = count
    return result


def _mock_supabase(execute_results: list[MagicMock]) -> MagicMock:
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


def _override_admin(supabase: MagicMock) -> None:
    """Override deps so endpoints see an admin user + the given supabase."""
    PLATFORM_ADMIN_EMAILS.add(ADMIN_EMAIL)
    user = _admin_user()
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_effective_supabase] = lambda: supabase
    # require_platform_admin also pulls get_admin_supabase for the cache check.
    app.dependency_overrides[get_admin_supabase] = lambda: supabase


@pytest.fixture()
def client():
    return TestClient(app)


@pytest.fixture(autouse=True)
def _cleanup():
    yield
    app.dependency_overrides.clear()
    PLATFORM_ADMIN_EMAILS.discard(ADMIN_EMAIL)


# ── List ──────────────────────────────────────────────────────────────────


class TestListDrafts:
    def test_returns_paginated(self, client):
        rows = [_summary_row(), _summary_row()]
        # 1 SELECT (list_drafts), 0 audit (no mutation).
        supabase = _mock_supabase([_exec_result(data=rows, count=2)])
        _override_admin(supabase)

        r = client.get("/api/v1/admin/content-drafts?limit=10&offset=0")
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert len(body["data"]) == 2
        assert body["meta"]["total"] == 2
        assert body["meta"]["limit"] == 10

    def test_filter_by_status(self, client):
        rows = [_summary_row(status=ContentDraftStatus.DRAFT)]
        supabase = _mock_supabase([_exec_result(data=rows, count=1)])
        _override_admin(supabase)

        r = client.get("/api/v1/admin/content-drafts?status=draft&status=conflict")
        assert r.status_code == 200
        chain = supabase.table.return_value
        # Service forwards status_filter to in_('status', [...]).
        in_calls = chain.in_.call_args_list
        assert any(
            c.args[0] == "status" and set(c.args[1]) == {"draft", "conflict"}
            for c in in_calls
        ), f"Expected in_('status', ['draft','conflict']) in {in_calls}"

    def test_filter_by_author(self, client):
        author = uuid4()
        rows = [_summary_row()]
        supabase = _mock_supabase([_exec_result(data=rows, count=1)])
        _override_admin(supabase)

        r = client.get(f"/api/v1/admin/content-drafts?author_id={author}")
        assert r.status_code == 200
        chain = supabase.table.return_value
        eq_calls = chain.eq.call_args_list
        assert any(
            c.args == ("author_id", str(author)) for c in eq_calls
        ), f"Expected eq('author_id', '{author}') in {eq_calls}"


# ── List by PR ────────────────────────────────────────────────────────────


class TestListByPr:
    def test_returns_full_drafts(self, client):
        d1, d2 = uuid4(), uuid4()
        rows = [
            _draft_row(draft_id=d1, pr_number=42),
            _draft_row(draft_id=d2, pr_number=42),
        ]
        supabase = _mock_supabase([_exec_result(data=rows)])
        _override_admin(supabase)

        r = client.get("/api/v1/admin/content-drafts/by-pr/42")
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert len(body["data"]) == 2
        # Full rows include JSONB blobs (matches service return type).
        assert body["data"][0]["working_content"]
        assert body["data"][0]["base_content"]
        # Service was queried with eq("pr_number", 42).
        chain = supabase.table.return_value
        assert any(
            c.args == ("pr_number", 42) for c in chain.eq.call_args_list
        ), f"Expected eq('pr_number', 42) in {chain.eq.call_args_list}"

    def test_empty_when_no_matches(self, client):
        supabase = _mock_supabase([_exec_result(data=[])])
        _override_admin(supabase)

        r = client.get("/api/v1/admin/content-drafts/by-pr/9999")
        assert r.status_code == 200
        assert r.json()["data"] == []

    def test_non_integer_pr_returns_422(self, client):
        supabase = _mock_supabase([])
        _override_admin(supabase)

        r = client.get("/api/v1/admin/content-drafts/by-pr/not-a-number")
        assert r.status_code == 422


# ── List open for resource ────────────────────────────────────────────────


class TestListOpenForResource:
    def test_returns_summaries(self, client):
        rows = [_summary_row(pack_slug="shadow", resource_path="banter")]
        supabase = _mock_supabase([_exec_result(data=rows)])
        _override_admin(supabase)

        r = client.get(
            "/api/v1/admin/content-drafts/open-for-resource"
            "?pack_slug=shadow&resource_path=banter"
        )
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert len(body["data"]) == 1
        assert body["data"][0]["pack_slug"] == "shadow"
        # Summary projection — no JSONB blobs.
        assert "working_content" not in body["data"][0]
        assert "base_content" not in body["data"][0]
        # Service filtered to open states via in_('status', ['draft','conflict']).
        chain = supabase.table.return_value
        in_calls = chain.in_.call_args_list
        assert any(
            c.args[0] == "status" and set(c.args[1]) == {"draft", "conflict"}
            for c in in_calls
        ), f"Expected in_('status', ['draft','conflict']) in {in_calls}"

    def test_empty_when_no_open_drafts(self, client):
        supabase = _mock_supabase([_exec_result(data=[])])
        _override_admin(supabase)

        r = client.get(
            "/api/v1/admin/content-drafts/open-for-resource"
            "?pack_slug=shadow&resource_path=banter"
        )
        assert r.status_code == 200
        assert r.json()["data"] == []

    def test_missing_query_params_returns_422(self, client):
        supabase = _mock_supabase([])
        _override_admin(supabase)

        r = client.get("/api/v1/admin/content-drafts/open-for-resource")
        assert r.status_code == 422

    def test_invalid_pack_slug_returns_422(self, client):
        """pack_slug query param enforces same regex as ContentDraftCreate."""
        supabase = _mock_supabase([])
        _override_admin(supabase)

        r = client.get(
            "/api/v1/admin/content-drafts/open-for-resource"
            "?pack_slug=Bad-Slug&resource_path=banter"
        )
        assert r.status_code == 422

    def test_path_traversal_pack_slug_rejected(self, client):
        """Defense in depth: query regex matches ContentDraftCreate's guard."""
        supabase = _mock_supabase([])
        _override_admin(supabase)

        r = client.get(
            "/api/v1/admin/content-drafts/open-for-resource"
            "?pack_slug=../secret&resource_path=banter"
        )
        assert r.status_code == 422


# ── Get single ────────────────────────────────────────────────────────────


class TestGetDraft:
    def test_returns_full_draft(self, client):
        d_id = uuid4()
        row = _draft_row(draft_id=d_id)
        supabase = _mock_supabase([_exec_result(data=[row])])
        _override_admin(supabase)

        r = client.get(f"/api/v1/admin/content-drafts/{d_id}")
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert body["data"]["id"] == str(d_id)
        # Full row includes JSONB blobs.
        assert body["data"]["working_content"]
        assert body["data"]["base_content"]

    def test_404_when_missing(self, client):
        supabase = _mock_supabase([_exec_result(data=[])])
        _override_admin(supabase)

        r = client.get(f"/api/v1/admin/content-drafts/{uuid4()}")
        assert r.status_code == 404


# ── Create ────────────────────────────────────────────────────────────────


class TestCreateDraft:
    def test_success_returns_201_and_audits(self, client):
        row = _draft_row()
        # 1 INSERT (service.create), 1 INSERT (audit_log).
        supabase = _mock_supabase(
            [_exec_result(data=[row]), _exec_result(data=[])]
        )
        _override_admin(supabase)

        r = client.post(
            "/api/v1/admin/content-drafts",
            json={
                "pack_slug": "shadow",
                "resource_path": "banter",
                "base_content": {"schema_version": 1, "banter": []},
                "working_content": {
                    "schema_version": 1,
                    "banter": [{"id": "sb_01", "text_de": "Test"}],
                },
            },
        )
        assert r.status_code == 201
        body = r.json()
        assert body["success"] is True
        # Audit fired (last execute call).
        assert supabase.table.return_value.execute.await_count == 2

    def test_pydantic_validation_rejects_bad_slug(self, client):
        supabase = _mock_supabase([])
        _override_admin(supabase)

        r = client.post(
            "/api/v1/admin/content-drafts",
            json={
                "pack_slug": "Bad-Slug",  # uppercase + hyphen → 422
                "resource_path": "banter",
                "base_content": {},
                "working_content": {},
            },
        )
        assert r.status_code == 422


# ── Update ────────────────────────────────────────────────────────────────


class TestUpdateDraft:
    def test_version_match_succeeds(self, client):
        d_id = uuid4()
        updated = _draft_row(draft_id=d_id, version=2)
        # 1 UPDATE (service.update_working), 1 INSERT (audit_log).
        supabase = _mock_supabase(
            [_exec_result(data=[updated]), _exec_result(data=[])]
        )
        _override_admin(supabase)

        r = client.patch(
            f"/api/v1/admin/content-drafts/{d_id}",
            json={
                "working_content": {"schema_version": 1, "banter": []},
                "version": 1,
            },
        )
        assert r.status_code == 200
        assert r.json()["data"]["version"] == 2

    def test_version_mismatch_returns_409(self, client):
        d_id = uuid4()
        # 1 UPDATE returns 0 rows; 2 SELECT disambiguation finds the row.
        supabase = _mock_supabase(
            [
                _exec_result(data=[]),                     # UPDATE
                _exec_result(data=[{"id": str(d_id)}]),    # SELECT
            ]
        )
        _override_admin(supabase)

        r = client.patch(
            f"/api/v1/admin/content-drafts/{d_id}",
            json={
                "working_content": {},
                "version": 99,
            },
        )
        assert r.status_code == 409


# ── Delete (decision C) ───────────────────────────────────────────────────


class TestDeleteDraft:
    def test_draft_status_can_be_abandoned(self, client):
        d_id = uuid4()
        current = _draft_row(draft_id=d_id, status=ContentDraftStatus.DRAFT)
        abandoned = _draft_row(draft_id=d_id, status=ContentDraftStatus.ABANDONED)
        # 1 SELECT (get), 1 UPDATE (abandon), 1 INSERT (audit).
        supabase = _mock_supabase(
            [
                _exec_result(data=[current]),
                _exec_result(data=[abandoned]),
                _exec_result(data=[]),
            ]
        )
        _override_admin(supabase)

        r = client.delete(f"/api/v1/admin/content-drafts/{d_id}")
        assert r.status_code == 200
        assert r.json()["data"]["deleted"] is True

    def test_conflict_status_can_be_abandoned(self, client):
        d_id = uuid4()
        current = _draft_row(draft_id=d_id, status=ContentDraftStatus.CONFLICT)
        abandoned = _draft_row(draft_id=d_id, status=ContentDraftStatus.ABANDONED)
        supabase = _mock_supabase(
            [
                _exec_result(data=[current]),
                _exec_result(data=[abandoned]),
                _exec_result(data=[]),
            ]
        )
        _override_admin(supabase)

        r = client.delete(f"/api/v1/admin/content-drafts/{d_id}")
        assert r.status_code == 200

    def test_published_returns_409(self, client):
        d_id = uuid4()
        published = _draft_row(draft_id=d_id, status=ContentDraftStatus.PUBLISHED, pr_number=42)
        supabase = _mock_supabase([_exec_result(data=[published])])
        _override_admin(supabase)

        r = client.delete(f"/api/v1/admin/content-drafts/{d_id}")
        assert r.status_code == 409
        assert "published" in r.json()["detail"].lower()

    def test_merged_returns_409(self, client):
        d_id = uuid4()
        merged = _draft_row(draft_id=d_id, status=ContentDraftStatus.MERGED)
        supabase = _mock_supabase([_exec_result(data=[merged])])
        _override_admin(supabase)

        r = client.delete(f"/api/v1/admin/content-drafts/{d_id}")
        assert r.status_code == 409

    def test_abandoned_returns_409(self, client):
        d_id = uuid4()
        ab = _draft_row(draft_id=d_id, status=ContentDraftStatus.ABANDONED)
        supabase = _mock_supabase([_exec_result(data=[ab])])
        _override_admin(supabase)

        r = client.delete(f"/api/v1/admin/content-drafts/{d_id}")
        assert r.status_code == 409


# ── Publish ───────────────────────────────────────────────────────────────


class TestPublishDrafts:
    def test_calls_publish_batch_and_audits(self, client):
        d_id = uuid4()
        # The publish service is patched so we don't hit GitHub. The router's
        # only DB write is the audit_log insert.
        supabase = _mock_supabase([_exec_result(data=[])])
        _override_admin(supabase)

        fake_result = BatchPublishResult(
            commit_sha="commitsha",
            pr_number=42,
            pr_url="https://github.com/x/y/pull/42",
            branch_name="content/drafts-batch-test",
            draft_count=1,
            drafts=[
                ContentDraftSummary.model_validate(_summary_row(draft_id=d_id))
            ],
        )

        with patch(
            "backend.routers.admin_drafts.ContentPacksPublishService.publish_batch",
            new=AsyncMock(return_value=fake_result),
        ) as mock_publish:
            r = client.post(
                "/api/v1/admin/content-drafts/publish",
                json={"draft_ids": [str(d_id)]},
            )
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert body["data"]["pr_number"] == 42
        assert body["data"]["draft_count"] == 1
        # Service was called with the parsed UUIDs.
        call_kwargs = mock_publish.call_args.kwargs
        assert call_kwargs["draft_ids"] == [d_id]

    def test_empty_draft_ids_returns_422(self, client):
        """BatchPublishRequest model enforces min_length=1."""
        supabase = _mock_supabase([])
        _override_admin(supabase)

        r = client.post(
            "/api/v1/admin/content-drafts/publish",
            json={"draft_ids": []},
        )
        assert r.status_code == 422

    def test_too_many_draft_ids_returns_422(self, client):
        """BatchPublishRequest model enforces max_length=25."""
        supabase = _mock_supabase([])
        _override_admin(supabase)

        too_many = [str(uuid4()) for _ in range(26)]
        r = client.post(
            "/api/v1/admin/content-drafts/publish",
            json={"draft_ids": too_many},
        )
        assert r.status_code == 422


# ── Conflict preview (Phase 5) ────────────────────────────────────────────


class TestConflictPreview:
    def test_calls_service_and_returns_preview(self, client):
        d_id = uuid4()
        supabase = _mock_supabase([])  # service is fully mocked
        _override_admin(supabase)

        fake_preview = ConflictPreview(
            draft_id=d_id,
            version=3,
            base={"banter": [{"id": "a", "text": "x"}]},
            ours={"banter": [{"id": "a", "text": "x-ours"}]},
            theirs={"banter": [{"id": "a", "text": "x-theirs"}]},
            merged={"banter": [{"id": "a", "text": "x-ours"}]},
            conflicts=[
                EntryConflictDTO(
                    path=".banter[id=a]",
                    kind="modify_modify",
                    base={"id": "a", "text": "x"},
                    ours={"id": "a", "text": "x-ours"},
                    theirs={"id": "a", "text": "x-theirs"},
                )
            ],
            auto_resolved_count=0,
            main_base_sha="abcdef1234",
        )

        with patch(
            "backend.routers.admin_drafts.ContentPacksConflictService.generate_preview",
            new=AsyncMock(return_value=fake_preview),
        ) as mock_preview:
            r = client.get(f"/api/v1/admin/content-drafts/{d_id}/conflict-preview")

        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert body["data"]["draft_id"] == str(d_id)
        assert body["data"]["auto_resolved_count"] == 0
        assert len(body["data"]["conflicts"]) == 1
        assert body["data"]["conflicts"][0]["kind"] == "modify_modify"
        assert body["data"]["main_base_sha"] == "abcdef1234"
        call_kwargs = mock_preview.call_args.kwargs
        assert call_kwargs["draft_id"] == d_id

    def test_non_uuid_draft_id_returns_422(self, client):
        supabase = _mock_supabase([])
        _override_admin(supabase)

        r = client.get("/api/v1/admin/content-drafts/not-a-uuid/conflict-preview")
        assert r.status_code == 422


# ── Resolve conflict (Phase 5) ────────────────────────────────────────────


class TestResolveConflict:
    def test_transitions_conflict_to_draft_and_audits(self, client):
        d_id = uuid4()
        # DB sequence: (1) UPDATE returns updated row, (2) audit_log INSERT.
        updated_row = _draft_row(
            draft_id=d_id,
            status=ContentDraftStatus.DRAFT,
            version=4,
        )
        updated_row["working_content"] = {
            "banter": [{"id": "a", "text": "merged"}]
        }
        supabase = _mock_supabase(
            [
                _exec_result(data=[updated_row]),  # resolve UPDATE
                _exec_result(data=[]),              # audit insert
            ]
        )
        _override_admin(supabase)

        r = client.post(
            f"/api/v1/admin/content-drafts/{d_id}/resolve",
            json={
                "merged_working_content": {
                    "banter": [{"id": "a", "text": "merged"}]
                },
                "version": 3,
                "acknowledged_conflict_paths": [".banter[id=a]"],
            },
        )
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert body["data"]["status"] == "draft"
        assert body["data"]["version"] == 4

        # Verify the UPDATE was gated on status='conflict' + version=3.
        chain = supabase.table.return_value
        eq_calls = chain.eq.call_args_list
        assert any(c.args == ("status", "conflict") for c in eq_calls)
        assert any(c.args == ("version", 3) for c in eq_calls)

    def test_version_mismatch_returns_409(self, client):
        d_id = uuid4()
        # UPDATE returns empty (gate miss) → service re-reads the row for
        # status disambiguation. We return the row at status='conflict' so
        # the error message specifies version-mismatch, not status-mismatch.
        supabase = _mock_supabase(
            [
                _exec_result(data=[]),             # resolve UPDATE misses
                _exec_result(
                    data=[{"status": "conflict", "version": 7}]
                ),  # re-read
            ]
        )
        _override_admin(supabase)

        r = client.post(
            f"/api/v1/admin/content-drafts/{d_id}/resolve",
            json={
                "merged_working_content": {"banter": []},
                "version": 3,
                "acknowledged_conflict_paths": [],
            },
        )
        assert r.status_code == 409
        assert "modified by another session" in r.json()["detail"].lower()

    def test_status_mismatch_returns_409(self, client):
        d_id = uuid4()
        # Draft raced to 'published' after the admin opened the preview.
        supabase = _mock_supabase(
            [
                _exec_result(data=[]),            # UPDATE misses
                _exec_result(
                    data=[{"status": "published", "version": 7}]
                ),  # re-read
            ]
        )
        _override_admin(supabase)

        r = client.post(
            f"/api/v1/admin/content-drafts/{d_id}/resolve",
            json={
                "merged_working_content": {},
                "version": 7,
                "acknowledged_conflict_paths": [],
            },
        )
        assert r.status_code == 409
        detail = r.json()["detail"].lower()
        assert "'published'" in detail
        assert "only allowed for drafts in 'conflict'" in detail

    def test_draft_not_found_returns_404(self, client):
        d_id = uuid4()
        supabase = _mock_supabase(
            [
                _exec_result(data=[]),  # UPDATE misses
                _exec_result(data=[]),  # re-read finds nothing
            ]
        )
        _override_admin(supabase)

        r = client.post(
            f"/api/v1/admin/content-drafts/{d_id}/resolve",
            json={
                "merged_working_content": {},
                "version": 1,
                "acknowledged_conflict_paths": [],
            },
        )
        assert r.status_code == 404

    def test_empty_acknowledged_paths_is_valid(self, client):
        """Admin may resolve without acknowledging any conflict paths
        (e.g. accepting the auto-merge output as-is)."""
        d_id = uuid4()
        updated_row = _draft_row(
            draft_id=d_id,
            status=ContentDraftStatus.DRAFT,
            version=2,
        )
        supabase = _mock_supabase(
            [
                _exec_result(data=[updated_row]),
                _exec_result(data=[]),
            ]
        )
        _override_admin(supabase)

        r = client.post(
            f"/api/v1/admin/content-drafts/{d_id}/resolve",
            json={
                "merged_working_content": {"banter": []},
                "version": 1,
                # acknowledged_conflict_paths omitted → defaults to []
            },
        )
        assert r.status_code == 200

    def test_version_below_one_returns_422(self, client):
        """Model enforces ge=1 on version."""
        d_id = uuid4()
        supabase = _mock_supabase([])
        _override_admin(supabase)

        r = client.post(
            f"/api/v1/admin/content-drafts/{d_id}/resolve",
            json={
                "merged_working_content": {},
                "version": 0,
                "acknowledged_conflict_paths": [],
            },
        )
        assert r.status_code == 422

    def test_also_captures_draft_model_content(self, client):
        """Response carries the full ContentDraft projection."""
        d_id = uuid4()
        updated_row = _draft_row(
            draft_id=d_id,
            status=ContentDraftStatus.DRAFT,
            version=2,
        )
        supabase = _mock_supabase(
            [
                _exec_result(data=[updated_row]),
                _exec_result(data=[]),
            ]
        )
        _override_admin(supabase)

        r = client.post(
            f"/api/v1/admin/content-drafts/{d_id}/resolve",
            json={
                "merged_working_content": {},
                "version": 1,
                "acknowledged_conflict_paths": [],
            },
        )
        assert r.status_code == 200
        data = r.json()["data"]
        # The response is a full ContentDraft: base_content + working_content
        # both present (both JSONB fields included in the projection).
        assert "base_content" in data
        assert "working_content" in data
        parsed = ContentDraft.model_validate(data)
        assert parsed.id == d_id
        assert parsed.status == ContentDraftStatus.DRAFT
