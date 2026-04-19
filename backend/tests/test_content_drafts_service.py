"""Unit tests for backend/services/content_drafts_service.py.

Uses a builder-style Supabase mock to exercise the CRUD paths without a
live DB. Covers:
    - create (success, RLS-denied)
    - get (found, not found)
    - list_by_author (no filter, status filter, pagination metadata)
    - list_open_for_resource
    - update_working (success, version mismatch, not found)
    - mark_published / mark_merged / mark_conflict / abandon
    - hard_delete
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException, status

from backend.models.content_drafts import (
    ContentDraft,
    ContentDraftCreate,
    ContentDraftStatus,
    ContentDraftSummary,
)
from backend.services.content_drafts_service import ContentDraftsService

# ── Test helpers ──────────────────────────────────────────────────────────


def _row(
    *,
    draft_id: UUID | None = None,
    author_id: UUID | None = None,
    status: ContentDraftStatus = ContentDraftStatus.DRAFT,
    version: int = 1,
    pack_slug: str = "awakening_banter",
    resource_path: str = "banter[ab_01]",
    base_content: dict | None = None,
    working_content: dict | None = None,
    pr_number: int | None = None,
    pr_url: str | None = None,
) -> dict[str, Any]:
    """Construct a plausible content_drafts row dict for mock responses."""
    now = datetime.now(UTC).isoformat()
    return {
        "id": str(draft_id or uuid4()),
        "author_id": str(author_id or uuid4()),
        "pack_slug": pack_slug,
        "resource_path": resource_path,
        "base_sha": None,
        "base_content": base_content or {"text_de": "Alt"},
        "working_content": working_content or {"text_de": "Neu"},
        "status": status.value,
        "version": version,
        "expected_head_oid": None,
        "commit_sha": None,
        "pr_number": pr_number,
        "pr_url": pr_url,
        "created_at": now,
        "updated_at": now,
        "published_at": None,
        "merged_at": None,
    }


def _summary_row(**kwargs: Any) -> dict[str, Any]:
    """Summary-shaped row (subset of full row)."""
    full = _row(**kwargs)
    keep = {
        "id", "author_id", "pack_slug", "resource_path", "status", "version",
        "pr_number", "pr_url", "created_at", "updated_at",
        "published_at", "merged_at",
    }
    return {k: v for k, v in full.items() if k in keep}


def _mock_supabase(execute_results: list[MagicMock]) -> MagicMock:
    """Build a Supabase mock where `.table(...).<chain>...execute()` returns
    the next result from `execute_results` on each call.

    The chain is `MagicMock` with every known builder method self-returning.
    This covers: select, insert, update, delete, eq, in_, order, range,
    limit, maybe_single.
    """
    mock = MagicMock()
    chain = MagicMock()
    for method in (
        "select", "insert", "update", "delete",
        "eq", "in_", "order", "range", "limit",
    ):
        getattr(chain, method).return_value = chain
    chain.execute = AsyncMock(side_effect=execute_results)
    mock.table.return_value = chain
    return mock


def _exec_result(*, data: list[dict] | None, count: int | None = None) -> MagicMock:
    result = MagicMock()
    result.data = data
    result.count = count
    return result


# ── create ────────────────────────────────────────────────────────────────


class TestCreate:
    async def test_success_returns_validated_draft(self):
        author_id = uuid4()
        row = _row(author_id=author_id, pack_slug="shadow_banter")
        supabase = _mock_supabase([_exec_result(data=[row])])

        payload = ContentDraftCreate(
            pack_slug="shadow_banter",
            resource_path="banter[sh_01]",
            base_content={"text_de": "Alt"},
            working_content={"text_de": "Neu"},
        )
        result = await ContentDraftsService.create(
            supabase, author_id=author_id, payload=payload,
        )
        assert isinstance(result, ContentDraft)
        assert result.pack_slug == "shadow_banter"
        assert result.author_id == UUID(row["author_id"])

    async def test_rls_denied_raises_403(self):
        supabase = _mock_supabase([_exec_result(data=[])])
        payload = ContentDraftCreate(
            pack_slug="x",
            resource_path="y",
            base_content={},
            working_content={},
        )
        with pytest.raises(HTTPException) as exc_info:
            await ContentDraftsService.create(
                supabase, author_id=uuid4(), payload=payload,
            )
        assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN


# ── get ───────────────────────────────────────────────────────────────────


class TestGet:
    async def test_found(self):
        row = _row()
        supabase = _mock_supabase([_exec_result(data=[row])])

        result = await ContentDraftsService.get(supabase, UUID(row["id"]))
        assert result.id == UUID(row["id"])

    async def test_not_found_raises_404(self):
        supabase = _mock_supabase([_exec_result(data=[])])
        with pytest.raises(HTTPException) as exc_info:
            await ContentDraftsService.get(supabase, uuid4())
        assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND


# ── list_by_author ────────────────────────────────────────────────────────


class TestListByAuthor:
    async def test_no_filter_returns_summaries(self):
        author_id = uuid4()
        rows = [
            _summary_row(author_id=author_id, version=1),
            _summary_row(author_id=author_id, version=2),
        ]
        supabase = _mock_supabase([_exec_result(data=rows, count=2)])

        drafts, total = await ContentDraftsService.list_by_author(
            supabase, author_id=author_id,
        )
        assert len(drafts) == 2
        assert total == 2
        assert all(isinstance(d, ContentDraftSummary) for d in drafts)

    async def test_status_filter_builds_in_clause(self):
        author_id = uuid4()
        supabase = _mock_supabase([_exec_result(data=[], count=0)])

        drafts, total = await ContentDraftsService.list_by_author(
            supabase,
            author_id=author_id,
            status_filter=[
                ContentDraftStatus.DRAFT,
                ContentDraftStatus.CONFLICT,
            ],
        )
        # `in_` should have been called with the expanded string values.
        chain = supabase.table.return_value
        in_calls = chain.in_.call_args_list
        assert in_calls  # at least one
        assert in_calls[0].args == ("status", ["draft", "conflict"])
        assert (drafts, total) == ([], 0)

    async def test_count_falls_back_to_len_when_null(self):
        author_id = uuid4()
        rows = [_summary_row(author_id=author_id)]
        # count=None → fallback path inside service.
        supabase = _mock_supabase([_exec_result(data=rows, count=None)])

        drafts, total = await ContentDraftsService.list_by_author(
            supabase, author_id=author_id,
        )
        assert total == 1
        assert len(drafts) == 1


# ── list_open_for_resource ────────────────────────────────────────────────


class TestListOpenForResource:
    async def test_returns_draft_and_conflict_rows(self):
        rows = [
            _summary_row(status=ContentDraftStatus.DRAFT),
            _summary_row(status=ContentDraftStatus.CONFLICT),
        ]
        supabase = _mock_supabase([_exec_result(data=rows)])

        result = await ContentDraftsService.list_open_for_resource(
            supabase,
            pack_slug="awakening_banter",
            resource_path="banter[ab_01]",
        )
        assert len(result) == 2


# ── update_working ────────────────────────────────────────────────────────


class TestUpdateWorking:
    async def test_success_bumps_version(self):
        draft_id = uuid4()
        updated_row = _row(draft_id=draft_id, version=3)
        supabase = _mock_supabase([_exec_result(data=[updated_row])])

        result = await ContentDraftsService.update_working(
            supabase,
            draft_id=draft_id,
            working_content={"text_de": "Neu²"},
            expected_version=2,
        )
        assert result.version == 3
        # Verify the update call used new_version=expected+1 and the
        # correct optimistic-lock eq predicate on `version`.
        chain = supabase.table.return_value
        update_call = chain.update.call_args
        assert update_call.args[0]["version"] == 3
        assert update_call.args[0]["working_content"] == {"text_de": "Neu²"}
        # eq(version, expected_version) must be in the chain
        eq_calls = chain.eq.call_args_list
        assert any(
            c.args == ("version", 2) for c in eq_calls
        ), f"eq(version, 2) not found in {eq_calls}"

    async def test_version_mismatch_raises_409(self):
        draft_id = uuid4()
        # First call (update): 0 rows returned (version mismatch).
        # Second call (disambiguation SELECT): row exists with different version.
        supabase = _mock_supabase(
            [
                _exec_result(data=[]),
                _exec_result(data=[{"id": str(draft_id)}]),
            ]
        )

        with pytest.raises(HTTPException) as exc_info:
            await ContentDraftsService.update_working(
                supabase,
                draft_id=draft_id,
                working_content={},
                expected_version=5,
            )
        assert exc_info.value.status_code == status.HTTP_409_CONFLICT

    async def test_not_found_raises_404_not_409(self):
        draft_id = uuid4()
        # First call (update): 0 rows. Second call (SELECT): also 0 → truly absent.
        supabase = _mock_supabase(
            [_exec_result(data=[]), _exec_result(data=[])]
        )

        with pytest.raises(HTTPException) as exc_info:
            await ContentDraftsService.update_working(
                supabase,
                draft_id=draft_id,
                working_content={},
                expected_version=1,
            )
        assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND


# ── Status transitions ────────────────────────────────────────────────────


class TestStatusTransitions:
    async def test_mark_published_sets_github_metadata(self):
        draft_id = uuid4()
        published_row = _row(
            draft_id=draft_id,
            status=ContentDraftStatus.PUBLISHED,
            pr_number=42,
            pr_url="https://github.com/mleihs/metaverse-center/pull/42",
        )
        supabase = _mock_supabase([_exec_result(data=[published_row])])

        result = await ContentDraftsService.mark_published(
            supabase,
            draft_id=draft_id,
            expected_head_oid="abc123",
            commit_sha="def456",
            pr_number=42,
            pr_url="https://github.com/mleihs/metaverse-center/pull/42",
        )
        assert result.status == ContentDraftStatus.PUBLISHED
        assert result.pr_number == 42

        update_payload = supabase.table.return_value.update.call_args.args[0]
        assert update_payload["status"] == "published"
        assert update_payload["expected_head_oid"] == "abc123"
        assert update_payload["commit_sha"] == "def456"
        assert "published_at" in update_payload  # ISO timestamp present

    async def test_mark_merged_sets_merged_at(self):
        draft_id = uuid4()
        merged_row = _row(draft_id=draft_id, status=ContentDraftStatus.MERGED)
        supabase = _mock_supabase([_exec_result(data=[merged_row])])

        result = await ContentDraftsService.mark_merged(
            supabase, draft_id=draft_id,
        )
        assert result.status == ContentDraftStatus.MERGED

        update_payload = supabase.table.return_value.update.call_args.args[0]
        assert update_payload["status"] == "merged"
        assert "merged_at" in update_payload

    async def test_mark_conflict_only_touches_status(self):
        draft_id = uuid4()
        conflict_row = _row(draft_id=draft_id, status=ContentDraftStatus.CONFLICT)
        supabase = _mock_supabase([_exec_result(data=[conflict_row])])

        result = await ContentDraftsService.mark_conflict(
            supabase, draft_id=draft_id,
        )
        assert result.status == ContentDraftStatus.CONFLICT
        update_payload = supabase.table.return_value.update.call_args.args[0]
        assert update_payload == {"status": "conflict"}

    async def test_abandon_transitions_to_abandoned(self):
        draft_id = uuid4()
        abandoned_row = _row(draft_id=draft_id, status=ContentDraftStatus.ABANDONED)
        supabase = _mock_supabase([_exec_result(data=[abandoned_row])])

        result = await ContentDraftsService.abandon(supabase, draft_id=draft_id)
        assert result.status == ContentDraftStatus.ABANDONED

    async def test_status_transition_on_missing_row_raises_404(self):
        supabase = _mock_supabase([_exec_result(data=[])])
        with pytest.raises(HTTPException) as exc_info:
            await ContentDraftsService.mark_merged(supabase, draft_id=uuid4())
        assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND


# ── hard_delete ───────────────────────────────────────────────────────────


class TestHardDelete:
    async def test_success(self):
        draft_id = uuid4()
        supabase = _mock_supabase([_exec_result(data=[{"id": str(draft_id)}])])
        await ContentDraftsService.hard_delete(supabase, draft_id=draft_id)

    async def test_missing_raises_404(self):
        supabase = _mock_supabase([_exec_result(data=[])])
        with pytest.raises(HTTPException) as exc_info:
            await ContentDraftsService.hard_delete(supabase, draft_id=uuid4())
        assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND
