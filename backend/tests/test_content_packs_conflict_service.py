"""Unit tests for conflict_service (A1.7 Phase 5).

Mock-based — no real GitHub, no real DB. Focus on:
    - orchestration (fetch main → run merge → return preview)
    - 404-on-main handled as empty theirs
    - wrong-status drafts raise 409
    - invalid YAML on main raises 400
    - env-var guard
"""

from __future__ import annotations

import base64
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

from backend.models.content_drafts import ContentDraft, ContentDraftStatus
from backend.services.content_packs.conflict_service import (
    ContentPacksConflictService,
)
from backend.services.github_app import GitHubAPIError


def _draft(
    *,
    draft_id: UUID | None = None,
    status: ContentDraftStatus = ContentDraftStatus.CONFLICT,
    base: dict | None = None,
    working: dict | None = None,
    version: int = 3,
) -> ContentDraft:
    # Use `is None` (not `or`) so callers can pass `{}` without silently
    # getting the default — empty dicts are a valid merge input
    # (new-resource case: admin creates the first version of a pack file).
    if base is None:
        base = {"banter": [{"id": "a", "text_de": "x"}]}
    if working is None:
        working = {"banter": [{"id": "a", "text_de": "x-ours"}]}
    now = datetime.now(UTC)
    return ContentDraft(
        id=draft_id or uuid4(),
        author_id=uuid4(),
        pack_slug="shadow",
        resource_path="banter",
        base_sha="abc123",
        base_content=base,
        working_content=working,
        status=status,
        version=version,
        expected_head_oid="old_sha",
        commit_sha="old_commit",
        pr_number=7,
        pr_url="https://example.com/pr/7",
        created_at=now,
        updated_at=now,
        published_at=now,
        merged_at=None,
    )


def _b64_yaml(text: str) -> str:
    return base64.b64encode(text.encode("utf-8")).decode("ascii")


def _github_client_mock(
    *,
    default_branch: str = "main",
    head_sha: str = "deadbeef1234",
    content_response: dict | Exception | None = None,
) -> MagicMock:
    """Wire a GitHubAppClient mock whose .rest() returns scripted responses.

    REST calls in order of invocation from generate_preview:
        1. GET /repos/{owner}/{repo}                    → {default_branch}
        2. GET /repos/.../git/ref/heads/{default_branch} → {object: {sha}}
        3. GET /repos/.../contents/{path}?ref={ref}      → {content: b64} OR raises
    """
    client = MagicMock()
    repo_info = {"default_branch": default_branch}
    ref_info = {"object": {"sha": head_sha}}
    # Default to empty-file response (admin adding a new resource)
    effective_content = {} if content_response is None else content_response

    async def _rest(method: str, path: str, **kwargs):
        if path.endswith("/repos/velg/velg"):
            return repo_info
        if "/git/ref/heads/" in path:
            return ref_info
        if "/contents/" in path:
            if isinstance(effective_content, Exception):
                raise effective_content
            return effective_content
        raise AssertionError(f"Unexpected REST call: {method} {path}")

    client.rest = AsyncMock(side_effect=_rest)
    return client


@pytest.fixture(autouse=True)
def _env(monkeypatch):
    monkeypatch.setenv("GITHUB_REPO_OWNER", "velg")
    monkeypatch.setenv("GITHUB_REPO_NAME", "velg")


@pytest.fixture
def supabase():
    return MagicMock()


# ── Happy path ────────────────────────────────────────────────────────────


async def test_generate_preview_success_with_conflict(supabase):
    draft = _draft()
    # Main's YAML differs from ours → MODIFY_MODIFY conflict.
    theirs_yaml = "banter:\n  - id: a\n    text_de: x-theirs\n"
    client = _github_client_mock(content_response={"content": _b64_yaml(theirs_yaml)})

    with patch(
        "backend.services.content_packs.conflict_service.ContentDraftsService.get",
        new=AsyncMock(return_value=draft),
    ):
        preview = await ContentPacksConflictService.generate_preview(
            supabase, draft_id=draft.id, github_client=client,
        )

    assert preview.draft_id == draft.id
    assert preview.version == 3
    assert preview.main_base_sha == "deadbeef1234"
    assert preview.theirs == {"banter": [{"id": "a", "text_de": "x-theirs"}]}
    assert preview.merged == {"banter": [{"id": "a", "text_de": "x-ours"}]}
    assert len(preview.conflicts) == 1
    assert preview.conflicts[0].kind == "modify_modify"
    assert preview.conflicts[0].path == ".banter[id=a]"


async def test_generate_preview_resource_not_on_main_treats_as_empty(supabase):
    draft = _draft(
        base={},
        working={"banter": [{"id": "a", "text_de": "new-resource"}]},
    )
    # Main returns 404 (admin is adding a brand-new resource).
    err = GitHubAPIError(404, "Not Found", "/repos/velg/velg/contents/...")
    client = _github_client_mock(content_response=err)

    with patch(
        "backend.services.content_packs.conflict_service.ContentDraftsService.get",
        new=AsyncMock(return_value=draft),
    ):
        preview = await ContentPacksConflictService.generate_preview(
            supabase, draft_id=draft.id, github_client=client,
        )

    assert preview.theirs == {}  # 404 → empty dict
    assert preview.conflicts == []  # no conflict: ours-only add
    assert preview.merged == {"banter": [{"id": "a", "text_de": "new-resource"}]}


# ── Error paths ───────────────────────────────────────────────────────────


async def test_generate_preview_non_conflict_status_raises_409(supabase):
    draft = _draft(status=ContentDraftStatus.DRAFT)
    client = _github_client_mock()

    with patch(
        "backend.services.content_packs.conflict_service.ContentDraftsService.get",
        new=AsyncMock(return_value=draft),
    ):
        with pytest.raises(HTTPException) as exc_info:
            await ContentPacksConflictService.generate_preview(
                supabase, draft_id=draft.id, github_client=client,
            )
    assert exc_info.value.status_code == 409
    assert "'draft'" in exc_info.value.detail  # current status surfaced


async def test_generate_preview_missing_env_raises_400(supabase, monkeypatch):
    monkeypatch.delenv("GITHUB_REPO_OWNER", raising=False)
    draft = _draft()
    client = _github_client_mock()

    with patch(
        "backend.services.content_packs.conflict_service.ContentDraftsService.get",
        new=AsyncMock(return_value=draft),
    ):
        with pytest.raises(HTTPException) as exc_info:
            await ContentPacksConflictService.generate_preview(
                supabase, draft_id=draft.id, github_client=client,
            )
    assert exc_info.value.status_code == 400
    assert "GITHUB_REPO_OWNER" in exc_info.value.detail


async def test_generate_preview_non_404_github_error_raises_502(supabase):
    draft = _draft()
    err = GitHubAPIError(500, "Internal Error", "/contents/...")
    client = _github_client_mock(content_response=err)

    with patch(
        "backend.services.content_packs.conflict_service.ContentDraftsService.get",
        new=AsyncMock(return_value=draft),
    ):
        with pytest.raises(HTTPException) as exc_info:
            await ContentPacksConflictService.generate_preview(
                supabase, draft_id=draft.id, github_client=client,
            )
    assert exc_info.value.status_code == 502


async def test_generate_preview_invalid_yaml_on_main_raises_400(supabase):
    draft = _draft()
    # Not-a-mapping content on main (a plain list).
    bad_yaml = "- just\n- a\n- list\n"
    client = _github_client_mock(content_response={"content": _b64_yaml(bad_yaml)})

    with patch(
        "backend.services.content_packs.conflict_service.ContentDraftsService.get",
        new=AsyncMock(return_value=draft),
    ):
        with pytest.raises(HTTPException) as exc_info:
            await ContentPacksConflictService.generate_preview(
                supabase, draft_id=draft.id, github_client=client,
            )
    assert exc_info.value.status_code == 400
    assert "not a mapping" in exc_info.value.detail


async def test_generate_preview_unparseable_yaml_on_main_raises_400(supabase):
    draft = _draft()
    # Bad YAML syntax (unclosed quote).
    bad_yaml = 'banter:\n  - id: a\n    text: "unclosed\n'
    client = _github_client_mock(content_response={"content": _b64_yaml(bad_yaml)})

    with patch(
        "backend.services.content_packs.conflict_service.ContentDraftsService.get",
        new=AsyncMock(return_value=draft),
    ):
        with pytest.raises(HTTPException) as exc_info:
            await ContentPacksConflictService.generate_preview(
                supabase, draft_id=draft.id, github_client=client,
            )
    assert exc_info.value.status_code == 400
    assert "failed to parse" in exc_info.value.detail


async def test_generate_preview_empty_file_on_main_treats_as_empty_dict(supabase):
    draft = _draft(
        base={},
        working={"banter": [{"id": "a", "text_de": "x"}]},
    )
    # Main's file exists but is empty (YAML parses to None).
    client = _github_client_mock(content_response={"content": _b64_yaml("")})

    with patch(
        "backend.services.content_packs.conflict_service.ContentDraftsService.get",
        new=AsyncMock(return_value=draft),
    ):
        preview = await ContentPacksConflictService.generate_preview(
            supabase, draft_id=draft.id, github_client=client,
        )
    assert preview.theirs == {}
    assert preview.merged == {"banter": [{"id": "a", "text_de": "x"}]}
    assert preview.conflicts == []
