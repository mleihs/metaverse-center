"""Admin CRUD + publish endpoints for content drafts (A1.7 Phase 2/4 step 3).

All endpoints gated by `require_platform_admin()`. Drafts are platform-level
(not per-simulation), so audit-log entries always carry `simulation_id=None`.

Endpoints:
    GET    /api/v1/admin/content-drafts                 — list (paginated, filtered)
    GET    /api/v1/admin/content-drafts/{draft_id}      — single
    POST   /api/v1/admin/content-drafts                 — create
    PATCH  /api/v1/admin/content-drafts/{draft_id}      — update working content (version-aware)
    DELETE /api/v1/admin/content-drafts/{draft_id}      — abandon (decision C: state-gated)
    POST   /api/v1/admin/content-drafts/publish         — batch publish via GitHub App

Decision C (DELETE semantics, "die sauberste Lösung"):
    - draft / conflict → abandon (transition to 'abandoned')
    - published → 409 (revert via PR close or wait for webhook)
    - merged → 409 (terminal, cannot delete)
    - abandoned → 409 (already abandoned)
    Hard-delete remains a service-only operation (`ContentDraftsService.hard_delete`)
    accessible via direct SQL/console only — no route exposes it.
"""

from __future__ import annotations

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request

from backend.dependencies import (
    get_effective_supabase,
    require_platform_admin,
)
from backend.middleware.rate_limit import (
    RATE_LIMIT_ADMIN_MUTATION,
    RATE_LIMIT_EXTERNAL_API,
    RATE_LIMIT_STANDARD,
    limiter,
)
from backend.models.common import (
    CurrentUser,
    DeleteResponse,
    PaginatedResponse,
    SuccessResponse,
)
from backend.models.content_drafts import (
    BatchPublishRequest,
    BatchPublishResult,
    ConflictPreview,
    ContentDraft,
    ContentDraftCreate,
    ContentDraftStatus,
    ContentDraftSummary,
    ContentDraftUpdate,
    ResolveConflictRequest,
    SweepOrphansRequest,
    SweepOrphansResult,
)
from backend.services.audit_service import AuditService
from backend.services.content_drafts_service import ContentDraftsService
from backend.services.content_packs.conflict_service import (
    ContentPacksConflictService,
)
from backend.services.content_packs.orphan_sweeper import sweep_orphan_branches
from backend.services.content_packs.publish import (
    ContentPacksPublishService,
    get_github_repo_config,
)
from backend.services.github_app import get_github_app_client
from backend.utils.errors import conflict
from backend.utils.responses import paginated
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/admin/content-drafts",
    tags=["Admin / Content Drafts"],
)

# Statuses for which DELETE is allowed. The state machine in migration 226
# also enforces this at the DB level, but the route surfaces a friendly 409
# instead of the raw trigger error.
_DELETABLE_STATUSES = frozenset(
    {ContentDraftStatus.DRAFT, ContentDraftStatus.CONFLICT}
)


# ── Read ──────────────────────────────────────────────────────────────────


@router.get("")
@limiter.limit(RATE_LIMIT_STANDARD)
async def list_content_drafts(
    request: Request,
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    author_id: Annotated[
        UUID | None,
        Query(description="Filter to a specific author. Omit for all drafts."),
    ] = None,
    status: Annotated[
        list[ContentDraftStatus] | None,
        Query(description="Repeat to filter by multiple statuses (e.g. ?status=draft&status=conflict)."),
    ] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PaginatedResponse[ContentDraftSummary]:
    """List content drafts (admin-only)."""
    drafts, total = await ContentDraftsService.list_drafts(
        supabase,
        author_id=author_id,
        status_filter=status,
        limit=limit,
        offset=offset,
    )
    return paginated(drafts, total, limit, offset)


# Placed before `/{draft_id}` so FastAPI does not attempt to parse
# "open-for-resource" as a UUID.
@router.get("/open-for-resource")
@limiter.limit(RATE_LIMIT_STANDARD)
async def list_open_drafts_for_resource(
    request: Request,
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
    pack_slug: Annotated[
        str,
        Query(
            min_length=1,
            max_length=128,
            pattern=r"^[a-z][a-z0-9_]{0,127}$",
            description="Pack identifier (same regex as ContentDraftCreate).",
        ),
    ],
    resource_path: Annotated[
        str,
        Query(
            min_length=1,
            max_length=512,
            pattern=r"^[a-zA-Z0-9_./\[\]]{1,512}$",
            description="Addressable path within the pack (same regex as ContentDraftCreate).",
        ),
    ],
) -> SuccessResponse[list[ContentDraftSummary]]:
    """Open drafts (draft|conflict) on a given resource.

    Used at editor-open time to warn the admin if another session has an open
    draft on the same resource. Returns `[]` when no other open drafts exist.
    """
    drafts = await ContentDraftsService.list_open_for_resource(
        supabase,
        pack_slug=pack_slug,
        resource_path=resource_path,
    )
    return SuccessResponse(data=drafts)


@router.get("/by-pr/{pr_number}")
@limiter.limit(RATE_LIMIT_STANDARD)
async def list_drafts_by_pr(
    request: Request,
    pr_number: int,
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[list[ContentDraft]]:
    """All drafts attached to a given PR.

    Used by the admin UI to render drafts sharing a batch-publish PR as a
    grouped row.
    """
    drafts = await ContentDraftsService.list_by_pr_number(
        supabase,
        pr_number=pr_number,
    )
    return SuccessResponse(data=drafts)


@router.get("/{draft_id}")
@limiter.limit(RATE_LIMIT_STANDARD)
async def get_content_draft(
    request: Request,
    draft_id: UUID,
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[ContentDraft]:
    """Fetch a single draft (full row, including base_content + working_content)."""
    draft = await ContentDraftsService.get(supabase, draft_id)
    return SuccessResponse(data=draft)


# ── Mutate ────────────────────────────────────────────────────────────────


@router.post("", status_code=201)
@limiter.limit(RATE_LIMIT_ADMIN_MUTATION)
async def create_content_draft(
    request: Request,
    body: ContentDraftCreate,
    user: Annotated[CurrentUser, Depends(require_platform_admin())],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[ContentDraft]:
    """Open a new draft on a resource."""
    draft = await ContentDraftsService.create(
        supabase, author_id=user.id, payload=body,
    )
    await AuditService.safe_log(
        supabase,
        None,  # platform-level — no simulation
        user.id,
        "content_drafts",
        draft.id,
        "create",
        details={
            "pack_slug": draft.pack_slug,
            "resource_path": draft.resource_path,
        },
    )
    return SuccessResponse(data=draft)


@router.patch("/{draft_id}")
@limiter.limit(RATE_LIMIT_ADMIN_MUTATION)
async def update_content_draft(
    request: Request,
    draft_id: UUID,
    body: ContentDraftUpdate,
    user: Annotated[CurrentUser, Depends(require_platform_admin())],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[ContentDraft]:
    """Save working_content. Optimistic-concurrency: pass current `version`."""
    draft = await ContentDraftsService.update_working(
        supabase,
        draft_id=draft_id,
        working_content=body.working_content,
        expected_version=body.version,
    )
    await AuditService.safe_log(
        supabase,
        None,
        user.id,
        "content_drafts",
        draft_id,
        "update",
        details={"version": draft.version},
    )
    return SuccessResponse(data=draft)


@router.delete("/{draft_id}")
@limiter.limit(RATE_LIMIT_ADMIN_MUTATION)
async def delete_content_draft(
    request: Request,
    draft_id: UUID,
    user: Annotated[CurrentUser, Depends(require_platform_admin())],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[DeleteResponse]:
    """Abandon a draft (decision C: state-gated, no hard delete from API).

    - draft / conflict → 'abandoned'
    - published → 409 (close the PR or wait for webhook revert first)
    - merged / abandoned → 409 (terminal)
    """
    current = await ContentDraftsService.get(supabase, draft_id)
    if current.status not in _DELETABLE_STATUSES:
        raise conflict(
            f"Cannot delete draft in status '{current.status.value}'. "
            f"Only 'draft' or 'conflict' drafts can be abandoned via this endpoint. "
            f"For published drafts, close the PR (webhook reverts to draft) or wait for merge.",
        )
    await ContentDraftsService.abandon(supabase, draft_id=draft_id)
    await AuditService.safe_log(
        supabase,
        None,
        user.id,
        "content_drafts",
        draft_id,
        "abandon",
        details={"prior_status": current.status.value},
    )
    return SuccessResponse(data=DeleteResponse(deleted=True, id=str(draft_id)))


# ── Conflict resolution (Phase 5) ─────────────────────────────────────────


@router.get("/{draft_id}/conflict-preview")
@limiter.limit(RATE_LIMIT_EXTERNAL_API)
async def get_conflict_preview(
    request: Request,
    draft_id: UUID,
    _user: Annotated[CurrentUser, Depends(require_platform_admin())],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[ConflictPreview]:
    """3-way merge preview for a conflict-status draft.

    Fetches the current main-branch YAML for the draft's resource and runs
    the semantic merge against base / working / main. Response includes all
    three trees (for the 3-column UI), an auto-merged `merged` tree (default
    resolution applied), and the list of admin-gated conflicts.

    Rate-limited as `EXTERNAL_API` because each call hits GitHub Contents API.
    """
    preview = await ContentPacksConflictService.generate_preview(
        supabase, draft_id=draft_id,
    )
    return SuccessResponse(data=preview)


@router.post("/{draft_id}/resolve")
@limiter.limit(RATE_LIMIT_ADMIN_MUTATION)
async def resolve_conflict(
    request: Request,
    draft_id: UUID,
    body: ResolveConflictRequest,
    user: Annotated[CurrentUser, Depends(require_platform_admin())],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[ContentDraft]:
    """Accept admin-approved merged content. Transitions conflict → draft.

    Writes `merged_working_content` as the draft's new working_content,
    bumps `version`, and clears publish-era metadata. After this, the draft
    is back in normal edit mode — the admin can continue editing or
    re-publish immediately.

    Optimistic-concurrency: `version` must match the DB row's current version
    (last seen during preview). Mismatch → 409, admin refreshes + retries.
    """
    draft = await ContentDraftsService.resolve_conflict(
        supabase,
        draft_id=draft_id,
        merged_working_content=body.merged_working_content,
        expected_version=body.version,
    )
    await AuditService.safe_log(
        supabase,
        None,
        user.id,
        "content_drafts",
        draft_id,
        "resolve_conflict",
        details={
            "version": draft.version,
            "acknowledged_conflict_paths": body.acknowledged_conflict_paths,
        },
    )
    return SuccessResponse(data=draft)


# ── Publish ───────────────────────────────────────────────────────────────


@router.post("/publish")
@limiter.limit(RATE_LIMIT_EXTERNAL_API)
async def publish_content_drafts(
    request: Request,
    body: BatchPublishRequest,
    user: Annotated[CurrentUser, Depends(require_platform_admin())],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[BatchPublishResult]:
    """Batch-publish N drafts as a single PR (decision B: one PR per batch).

    Hits GitHub via the App: createCommitOnBranch + open PR. Drafts must be
    in 'draft' status; mismatches surface 409. Default-branch drift surfaces
    409 + auto-marks all drafts in the batch as 'conflict'. See
    `backend/services/content_packs/publish.py` for the full pipeline.
    """
    result = await ContentPacksPublishService.publish_batch(
        supabase,
        draft_ids=body.draft_ids,
        commit_message=body.commit_message,
    )
    await AuditService.safe_log(
        supabase,
        None,
        user.id,
        "content_drafts",
        None,  # batch op — no single entity_id
        "publish",
        details={
            "draft_ids": [str(d) for d in body.draft_ids],
            "draft_count": result.draft_count,
            "pr_number": result.pr_number,
            "pr_url": result.pr_url,
            "commit_sha": result.commit_sha,
            "branch_name": result.branch_name,
        },
    )
    return SuccessResponse(data=result)


# ── Orphan-branch sweep (Phase 7) ─────────────────────────────────────────


@router.post("/sweep-orphans")
@limiter.limit(RATE_LIMIT_EXTERNAL_API)
async def sweep_orphan_branches_endpoint(
    request: Request,
    body: SweepOrphansRequest,
    user: Annotated[CurrentUser, Depends(require_platform_admin())],
    supabase: Annotated[Client, Depends(get_effective_supabase)],
) -> SuccessResponse[SweepOrphansResult]:
    """Garbage-collect abandoned `content/drafts-batch-*` branches on the repo.

    Classifies every matching branch (PR state + commit age) and, when
    `dry_run=False`, deletes the orphans. Always returns the full
    classification so the admin UI can render a preview before committing.

    Audit-logged even on dry-run — the intent (admin triggered the sweep) is
    what we care about; the DB record of what was classified is in the
    response, not the audit row.

    Rate-limited as EXTERNAL_API: a sweep with N branches performs roughly
    2N GitHub REST calls (list + PR lookup per branch, + optional delete).
    """
    owner, repo = get_github_repo_config()
    client = get_github_app_client()
    result = await sweep_orphan_branches(
        client,
        owner,
        repo,
        min_age_days=body.min_age_days,
        dry_run=body.dry_run,
    )
    await AuditService.safe_log(
        supabase,
        None,
        user.id,
        "content_drafts",
        None,  # batch op — no entity_id
        "sweep_orphans",
        details={
            "dry_run": body.dry_run,
            "min_age_days": body.min_age_days,
            "total_found": result.total_found,
            "deleted_count": result.deleted_count,
            "error_count": result.error_count,
        },
    )
    return SuccessResponse(data=result)
