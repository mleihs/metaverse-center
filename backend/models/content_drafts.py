"""Pydantic models for the content-draft workflow (A1.7).

Drafts are admin-only. Each draft represents one in-progress edit to a YAML
content pack under `content/`. At publish time, N drafts are batched into a
single `createCommitOnBranch` GraphQL mutation that opens a PR against main.

See:
  - supabase/migrations/..._224_content_drafts_and_webhooks.sql
  - backend/services/content_drafts_service.py (commit 3 of this phase)
  - docs/concepts/a1-7-ui-research-findings.md §2 (concurrency model)
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class ContentDraftStatus(StrEnum):
    """Lifecycle states of a content draft.

    Transitions:
        draft ──save──> draft                (version-bump, working_content updated)
        draft ──conflict-detected──> conflict
        conflict ──merged-in-py──> draft     (after 3-way merge resolves)
        draft ──publish──> published         (PR opened, awaiting merge)
        published ──webhook-merged──> merged (PR merged on main)
        draft ──admin-discard──> abandoned
    """

    DRAFT = "draft"
    CONFLICT = "conflict"
    PUBLISHED = "published"
    MERGED = "merged"
    ABANDONED = "abandoned"


# ── Request models ────────────────────────────────────────────────────────


class ContentDraftCreate(BaseModel):
    """Open a new draft on a resource.

    `base_content` is the snapshot of the resource's current state (captured
    by the admin UI when the editor opens). The backend records it verbatim
    as the merge base for later 3-way merges.

    `pack_slug` and `resource_path` are validated with tight regexes + a
    path-traversal guard: these values are later composed into YAML file
    paths (`content/dungeon/{pack_slug}/{resource_path}.yaml`) by the
    publish flow, so defense-in-depth is warranted even though admins
    are trusted.
    """

    pack_slug: str = Field(
        ...,
        min_length=1,
        max_length=128,
        pattern=r"^[a-z][a-z0-9_]{0,127}$",
        description=(
            "Lowercase pack identifier. Must start with a letter; allows "
            "letters, digits, and underscores."
        ),
    )
    resource_path: str = Field(
        ...,
        min_length=1,
        max_length=512,
        pattern=r"^[a-zA-Z0-9_./\[\]]{1,512}$",
        description=(
            "Addressable path within the pack (e.g. `banter[ab_01]`). "
            "Must not contain `..` or start with `/`."
        ),
    )
    base_content: dict[str, Any]
    working_content: dict[str, Any]
    base_sha: str | None = Field(
        default=None,
        description="Main-branch SHA at draft-open time. Populated once GitHub "
        "integration goes live; nullable for local-dev paths.",
    )

    @field_validator("resource_path")
    @classmethod
    def _reject_path_traversal(cls, v: str) -> str:
        if ".." in v:
            raise ValueError("resource_path must not contain '..'")
        if v.startswith("/"):
            raise ValueError("resource_path must not start with '/'")
        return v


class ContentDraftUpdate(BaseModel):
    """Save progress on an existing draft.

    `version` carries the last-seen DB version; if it no longer matches the
    current row, the service raises 409 Conflict. The UI then refetches and
    presents the diff to the user.
    """

    working_content: dict[str, Any]
    version: int = Field(..., ge=1)


# ── Response / projection models ──────────────────────────────────────────


class ContentDraft(BaseModel):
    """Full projection of a content_drafts row.

    Returned from CRUD endpoints. `base_content` and `working_content` may
    be large (multi-KB JSONB); callers that need only metadata should use
    `ContentDraftSummary` instead.
    """

    id: UUID
    author_id: UUID

    pack_slug: str
    resource_path: str

    base_sha: str | None
    base_content: dict[str, Any]
    working_content: dict[str, Any]

    status: ContentDraftStatus
    version: int

    expected_head_oid: str | None
    commit_sha: str | None
    pr_number: int | None
    pr_url: str | None

    created_at: datetime
    updated_at: datetime
    published_at: datetime | None
    merged_at: datetime | None


class ContentDraftSummary(BaseModel):
    """Slim projection for list views ("My Drafts" panel).

    Excludes `base_content` and `working_content` JSONB blobs to keep the
    list-response payload tight.
    """

    id: UUID
    author_id: UUID
    pack_slug: str
    resource_path: str
    status: ContentDraftStatus
    version: int
    pr_number: int | None
    pr_url: str | None
    created_at: datetime
    updated_at: datetime
    published_at: datetime | None
    merged_at: datetime | None


# ── Internal models (not exposed via API) ─────────────────────────────────


class GithubWebhookEvent(BaseModel):
    """In-memory representation of a row in github_webhook_events.

    Not exposed via any API surface — webhook handler uses this shape
    internally for ingestion bookkeeping.
    """

    id: UUID
    delivery_id: str
    event_type: str
    action: str | None
    payload: dict[str, Any]
    received_at: datetime
    processed_at: datetime | None
    processing_result: str | None
    error_message: str | None
