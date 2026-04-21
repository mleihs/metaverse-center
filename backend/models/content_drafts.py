"""Pydantic models for the content-draft workflow (A1.7).

Drafts are admin-only. Each draft represents one in-progress edit to a YAML
content pack under `content/`. At publish time, N drafts are batched into a
single `createCommitOnBranch` GraphQL mutation that opens a PR against main.

See:
  - supabase/migrations/..._224_content_drafts_and_webhooks.sql
  - backend/services/content_drafts_service.py (commit 3 of this phase)
  - backend/services/content_packs/publish.py (Phase 2 batch publish)
  - docs/concepts/a1-7-ui-research-findings.md §2 (concurrency model)
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

# Maximum drafts per batch publish. The createCommitOnBranch GraphQL mutation
# accepts arbitrary file changes, but we cap to keep PR review surfaces sane
# and to bound rate-limit cost (each batch is one mutation regardless of N).
MAX_BATCH_PUBLISH_SIZE = 25


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


class ResolveConflictRequest(BaseModel):
    """Admin-provided resolution for a conflict draft (A1.7 Phase 5).

    `merged_working_content` is the admin-approved merge output — either
    the auto-merged tree as-is, or with per-entry take-ours/take-theirs
    decisions applied. `version` is optimistic-concurrency guard (same
    pattern as `ContentDraftUpdate`). `acknowledged_conflict_paths` is a
    list of path strings the admin explicitly resolved — recorded verbatim
    in the audit log so post-hoc review can see which entries the admin
    touched.
    """

    merged_working_content: dict[str, Any]
    version: int = Field(..., ge=1)
    acknowledged_conflict_paths: list[str] = Field(
        default_factory=list,
        description="Paths (e.g. '.banter[id=sb_01]') the admin explicitly resolved.",
    )


# ── Response / projection models ──────────────────────────────────────────


class ContentDraft(BaseModel):
    """Full projection of a content_drafts row.

    Returned from CRUD endpoints. `base_content` and `working_content` may
    be large (multi-KB JSONB); callers that need only metadata should use
    `ContentDraftSummary` instead.
    """

    id: UUID
    author_id: UUID
    # Mirrors `ContentDraftSummary.author_email` to keep the frontend's
    # `ContentDraft extends ContentDraftSummary` type contract honest.
    # Not populated on get/update/resolve paths (those return straight from
    # the DB row without the extra RPC roundtrip) — always null on the wire
    # unless a future flow explicitly enriches.
    author_email: str | None = None

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

    `author_email` is populated by `list_drafts` via a batched
    `get_user_emails_batch` RPC (migration 044). Nullable because (a) the
    email may not resolve for deleted users, and (b) sibling endpoints
    like `list_open_for_resource` leave it unset — the field is intended
    for the drafts-list display where "who authored this?" matters.
    """

    id: UUID
    author_id: UUID
    author_email: str | None = None
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


# ── Batch publish ─────────────────────────────────────────────────────────


class BatchPublishRequest(BaseModel):
    """Admin batch-publish input.

    `draft_ids` is bounded by `MAX_BATCH_PUBLISH_SIZE`; non-empty enforces
    that the caller actually selected something to publish.

    `commit_message` overrides the auto-derived headline when set; otherwise
    publish.py derives a sensible default from the draft list.
    """

    draft_ids: list[UUID] = Field(
        ...,
        min_length=1,
        max_length=MAX_BATCH_PUBLISH_SIZE,
        description="Drafts to include in this PR. All must currently be in 'draft' status.",
    )
    commit_message: str | None = Field(
        default=None,
        max_length=72,
        description="Optional commit headline override (Git convention: ≤72 chars).",
    )


class EntryConflictDTO(BaseModel):
    """Wire shape for one merge conflict.

    Mirrors `backend.services.content_packs.merge_service.EntryConflict` —
    kept as a separate class to keep the pure merge module free of API-layer
    concerns (and to give the frontend a stable schema even if the merge
    module's internals shift).
    """

    path: str
    kind: str
    base: Any | None = None
    ours: Any | None = None
    theirs: Any | None = None


class ConflictPreview(BaseModel):
    """Server-computed 3-way merge preview for a conflict draft (A1.7 Phase 5).

    Returned from GET /admin/content-drafts/{id}/conflict-preview. The UI
    uses this to render the 3-column resolve view (base / ours / theirs)
    with per-conflict take-ours/take-theirs affordances.

    `merged` already embeds auto-resolved decisions and default-to-ours/theirs
    for admin-gated conflicts. A naive admin can accept it as-is; an attentive
    admin inspects `conflicts` and flips individual entries via the UI.

    `main_base_sha` is the SHA of main's current HEAD (what `theirs` was
    fetched against). Displayed in the UI header ("upstream now at <sha>")
    so the admin can audit which main revision their merge was reconciled
    against. Not persisted back to the draft on resolve — publish.py
    re-derives the expected-head OID per publish, so the draft's `base_sha`
    column carries no operational weight here.
    """

    draft_id: UUID
    version: int
    base: dict[str, Any]
    ours: dict[str, Any]
    theirs: dict[str, Any]
    merged: dict[str, Any]
    conflicts: list[EntryConflictDTO]
    auto_resolved_count: int
    main_base_sha: str | None = Field(
        default=None,
        description="Current main HEAD SHA (commit) — what `theirs` was fetched against.",
    )


class BatchPublishResult(BaseModel):
    """Outcome of a successful batch publish.

    Returned to the admin UI so it can link to the PR + display landed-state
    for the affected drafts. `drafts` are slim summaries (no JSONB blobs) to
    keep the response payload tight.
    """

    commit_sha: str
    pr_number: int
    pr_url: str
    branch_name: str
    draft_count: int
    drafts: list[ContentDraftSummary]


# ── Orphan-branch sweeper (Phase 7) ───────────────────────────────────────


OrphanStatus = Literal["keep", "delete"]
OrphanPrState = Literal["open", "closed", "merged"]


class SweepOrphansRequest(BaseModel):
    """Admin request body for the orphan-branch sweep endpoint.

    `dry_run` defaults to True so an accidental invocation is safe — the
    admin must explicitly pass False to actually delete branches.
    `min_age_days` guards against racing an in-flight publish that has
    created the branch but not yet opened the PR.
    """

    dry_run: bool = Field(
        default=True,
        description="When True (default), classify only; no branches are deleted.",
    )
    min_age_days: float = Field(
        default=14.0,
        ge=0,
        le=365,
        description="Minimum commit age (days) before a PR-less branch is eligible for deletion.",
    )


class OrphanBranchClassification(BaseModel):
    """Per-branch classification from one sweep run.

    Returned for every branch matching the `content/drafts-batch-` prefix,
    whether kept or deleted. Admin UIs render these as the audit record.
    """

    name: str = Field(description="Branch name (without `refs/heads/` prefix).")
    sha: str = Field(description="Commit SHA at branch tip.")
    age_days: float = Field(description="Age in days (from PR created_at or commit date).")
    pr_number: int | None = Field(default=None)
    pr_state: OrphanPrState | None = Field(
        default=None,
        description="PR state when a PR exists; None when no PR is associated.",
    )
    status: OrphanStatus = Field(description="Classification decision for this branch.")
    reason: str = Field(description="Human-readable explanation for the classification.")
    deleted: bool = Field(
        default=False,
        description="True if the branch was actually deleted this run.",
    )
    error: str | None = Field(
        default=None,
        description="GitHub API error message if deletion failed.",
    )


class SweepOrphansResult(BaseModel):
    """Outcome of one orphan-branch sweep (dry-run or real)."""

    dry_run: bool
    total_found: int
    kept_count: int
    deleted_count: int
    error_count: int
    branches: list[OrphanBranchClassification]


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
