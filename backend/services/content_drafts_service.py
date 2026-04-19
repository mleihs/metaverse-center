"""CRUD service for the content_drafts table (A1.7).

Drafts are admin-only. All routes that reach this service must gate on
`require_platform_admin()` in their dependency chain, and use
`get_effective_supabase` so RLS is enforced (platform_admins are auto-
elevated to service_role).

Optimistic-concurrency model:
    - Each write to `working_content` goes via `update_working()`, which
      passes the last-seen `version` as a predicate. If another admin
      session wrote to the same draft in the meantime, the update
      affects 0 rows and we raise 409 Conflict.
    - At publish time a separate GitHub-side OID check guards against
      main-branch drift (handled in a later phase).

See `docs/concepts/a1-7-ui-research-findings.md` §2 for the full design.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from backend.models.content_drafts import (
    ContentDraft,
    ContentDraftCreate,
    ContentDraftStatus,
    ContentDraftSummary,
)
from backend.utils.errors import conflict, forbidden, not_found
from backend.utils.responses import extract_list, extract_one
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

_TABLE = "content_drafts"

# Columns returned for list/summary views — deliberately excludes
# `base_content` and `working_content` JSONB blobs so "My Drafts"
# pagination stays cheap.
_SUMMARY_COLUMNS = (
    "id,author_id,pack_slug,resource_path,status,version,"
    "pr_number,pr_url,created_at,updated_at,published_at,merged_at"
)


class ContentDraftsService:
    """Admin-only CRUD for content drafts.

    Methods are classmethod-style to match the project convention
    (see PlatformSettingsService). Service instantiation is not useful
    here — all state lives in the DB row.
    """

    # ── Create ────────────────────────────────────────────────────────

    @classmethod
    async def create(
        cls,
        supabase: Client,
        *,
        author_id: UUID,
        payload: ContentDraftCreate,
    ) -> ContentDraft:
        """Open a new draft on a resource."""
        row = {
            "author_id": str(author_id),
            "pack_slug": payload.pack_slug,
            "resource_path": payload.resource_path,
            "base_content": payload.base_content,
            "working_content": payload.working_content,
            "base_sha": payload.base_sha,
        }
        response = await supabase.table(_TABLE).insert(row).execute()
        if not response.data:
            # Empty response with no exception = RLS denied the insert
            # (caller is not a platform admin).
            logger.warning(
                "content_drafts insert rejected by RLS (author_id=%s, pack=%s, path=%s)",
                author_id,
                payload.pack_slug,
                payload.resource_path,
            )
            raise forbidden("Not authorized to create content drafts.")
        return ContentDraft.model_validate(response.data[0])

    # ── Read ──────────────────────────────────────────────────────────

    @classmethod
    async def get(cls, supabase: Client, draft_id: UUID) -> ContentDraft:
        """Fetch a single draft by ID, including both JSONB blobs."""
        response = await (
            supabase.table(_TABLE)
            .select("*")
            .eq("id", str(draft_id))
            .limit(1)
            .execute()
        )
        data = extract_one(response)
        if not data:
            raise not_found(_TABLE, draft_id)
        return ContentDraft.model_validate(data)

    @classmethod
    async def list_by_author(
        cls,
        supabase: Client,
        *,
        author_id: UUID,
        status_filter: list[ContentDraftStatus] | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[ContentDraftSummary], int]:
        """List drafts for a single author (most recent first).

        Returns (drafts, total_count). The default `status_filter` is
        None = all statuses; callers typically filter to
        [DRAFT, CONFLICT] for the "in-progress" view.
        """
        query = (
            supabase.table(_TABLE)
            .select(_SUMMARY_COLUMNS, count="exact")
            .eq("author_id", str(author_id))
            .order("updated_at", desc=True)
        )
        if status_filter:
            query = query.in_("status", [s.value for s in status_filter])
        query = query.range(offset, offset + limit - 1)
        response = await query.execute()

        rows = extract_list(response)
        total = response.count if response.count is not None else len(rows)
        summaries = [ContentDraftSummary.model_validate(r) for r in rows]
        return summaries, total

    @classmethod
    async def list_open_for_resource(
        cls,
        supabase: Client,
        *,
        pack_slug: str,
        resource_path: str,
    ) -> list[ContentDraftSummary]:
        """Find all open drafts (draft|conflict) on a given resource.

        Used at draft-open time to warn "another admin is editing this"
        and later for presence tracking.
        """
        response = await (
            supabase.table(_TABLE)
            .select(_SUMMARY_COLUMNS)
            .eq("pack_slug", pack_slug)
            .eq("resource_path", resource_path)
            .in_(
                "status",
                [
                    ContentDraftStatus.DRAFT.value,
                    ContentDraftStatus.CONFLICT.value,
                ],
            )
            .execute()
        )
        return [
            ContentDraftSummary.model_validate(r) for r in extract_list(response)
        ]

    # ── Update — working content (with optimistic lock) ───────────────

    @classmethod
    async def update_working(
        cls,
        supabase: Client,
        *,
        draft_id: UUID,
        working_content: dict[str, Any],
        expected_version: int,
    ) -> ContentDraft:
        """Save progress with an optimistic-concurrency version check.

        Increments `version` on success. If the DB's current version no
        longer matches `expected_version`, raises 409 Conflict (the UI
        then refetches and presents a diff).
        """
        new_version = expected_version + 1
        response = await (
            supabase.table(_TABLE)
            .update(
                {
                    "working_content": working_content,
                    "version": new_version,
                }
            )
            .eq("id", str(draft_id))
            .eq("version", expected_version)
            .execute()
        )
        if not response.data:
            await cls._raise_conflict_or_not_found(supabase, draft_id)
        return ContentDraft.model_validate(response.data[0])

    # ── Update — status transitions (no version guard) ────────────────
    # These are triggered by single server-side paths (publish workflow,
    # webhook handler), so concurrent admin writes cannot race them.

    @classmethod
    async def mark_published(
        cls,
        supabase: Client,
        *,
        draft_id: UUID,
        expected_head_oid: str,
        commit_sha: str,
        pr_number: int,
        pr_url: str,
    ) -> ContentDraft:
        """Transition draft → published after the GraphQL commit lands.

        Idempotent on `published_at IS NULL`: a repeat call on an already-
        published draft preserves the original timestamp + GitHub metadata
        and returns the existing row.
        """
        return await cls._apply_idempotent_status_update(
            supabase,
            draft_id=draft_id,
            updates={
                "status": ContentDraftStatus.PUBLISHED.value,
                "expected_head_oid": expected_head_oid,
                "commit_sha": commit_sha,
                "pr_number": pr_number,
                "pr_url": pr_url,
                "published_at": datetime.now(UTC).isoformat(),
            },
            gate_column="published_at",
        )

    @classmethod
    async def mark_merged(
        cls,
        supabase: Client,
        *,
        draft_id: UUID,
    ) -> ContentDraft:
        """Transition draft → merged on PR-close webhook.

        Idempotent on `merged_at IS NULL`: GitHub retries webhook deliveries
        on timeout (up to 3×); the second delivery is a no-op and preserves
        the first merged_at timestamp.
        """
        return await cls._apply_idempotent_status_update(
            supabase,
            draft_id=draft_id,
            updates={
                "status": ContentDraftStatus.MERGED.value,
                "merged_at": datetime.now(UTC).isoformat(),
            },
            gate_column="merged_at",
        )

    @classmethod
    async def mark_conflict(
        cls,
        supabase: Client,
        *,
        draft_id: UUID,
    ) -> ContentDraft:
        """Flag draft as conflict (main-branch base drift detected)."""
        return await cls._apply_status_update(
            supabase,
            draft_id=draft_id,
            updates={"status": ContentDraftStatus.CONFLICT.value},
        )

    # ── Bulk transitions (used by batch-publish + webhook handler) ────

    @classmethod
    async def mark_published_bulk(
        cls,
        supabase: Client,
        *,
        draft_ids: list[UUID],
        expected_head_oid: str,
        commit_sha: str,
        pr_number: int,
        pr_url: str,
    ) -> list[ContentDraft]:
        """Atomically mark N drafts as published — all share one PR.

        Single SQL UPDATE = atomic. Idempotent on `published_at IS NULL`:
        a re-call (e.g. publish retry after partial network failure) leaves
        already-published rows untouched and returns the full set as it
        currently stands in the DB.

        All drafts in `draft_ids` must currently be in 'draft' status. The
        caller (publish flow) gates on that before calling — this method
        does not re-validate.
        """
        if not draft_ids:
            return []
        ids = [str(d) for d in draft_ids]
        now = datetime.now(UTC).isoformat()
        await (
            supabase.table(_TABLE)
            .update(
                {
                    "status": ContentDraftStatus.PUBLISHED.value,
                    "expected_head_oid": expected_head_oid,
                    "commit_sha": commit_sha,
                    "pr_number": pr_number,
                    "pr_url": pr_url,
                    "published_at": now,
                }
            )
            .in_("id", ids)
            .is_("published_at", "null")
            .execute()
        )
        # Re-fetch to return a consistent view (idempotent re-calls leave
        # already-published rows alone; the SELECT picks them up unchanged).
        full = await (
            supabase.table(_TABLE).select("*").in_("id", ids).execute()
        )
        return [ContentDraft.model_validate(r) for r in extract_list(full)]

    @classmethod
    async def mark_conflict_bulk(
        cls,
        supabase: Client,
        *,
        draft_ids: list[UUID],
    ) -> list[ContentDraft]:
        """Flag N drafts as conflict in one UPDATE (e.g. on batch drift)."""
        if not draft_ids:
            return []
        ids = [str(d) for d in draft_ids]
        await (
            supabase.table(_TABLE)
            .update({"status": ContentDraftStatus.CONFLICT.value})
            .in_("id", ids)
            .execute()
        )
        full = await (
            supabase.table(_TABLE).select("*").in_("id", ids).execute()
        )
        return [ContentDraft.model_validate(r) for r in extract_list(full)]

    @classmethod
    async def revert_to_draft_bulk(
        cls,
        supabase: Client,
        *,
        draft_ids: list[UUID],
    ) -> list[ContentDraft]:
        """Revert N published drafts back to 'draft' on PR-closed-without-merge.

        Decision A: when a PR is closed without merging, the admin's work is
        not wasted — the drafts return to 'draft' so the admin can re-publish
        (possibly after edits). This method is idempotent: rows already in
        'draft' (or any non-'published' state) are left untouched.

        Resets: status, published_at, expected_head_oid, commit_sha, pr_number,
        pr_url. Keeps: base_content, working_content, version (admin can
        continue editing).
        """
        if not draft_ids:
            return []
        ids = [str(d) for d in draft_ids]
        await (
            supabase.table(_TABLE)
            .update(
                {
                    "status": ContentDraftStatus.DRAFT.value,
                    "published_at": None,
                    "expected_head_oid": None,
                    "commit_sha": None,
                    "pr_number": None,
                    "pr_url": None,
                }
            )
            .in_("id", ids)
            .eq("status", ContentDraftStatus.PUBLISHED.value)
            .execute()
        )
        full = await (
            supabase.table(_TABLE).select("*").in_("id", ids).execute()
        )
        return [ContentDraft.model_validate(r) for r in extract_list(full)]

    @classmethod
    async def list_by_pr_number(
        cls,
        supabase: Client,
        *,
        pr_number: int,
    ) -> list[ContentDraft]:
        """Find all drafts attached to a given PR.

        Used by the GitHub webhook handler to map `pull_request.{merged|closed}`
        events back to the batch of drafts they represent. Index
        `idx_content_drafts_pr_number` (partial: WHERE pr_number IS NOT NULL)
        serves this lookup.
        """
        response = await (
            supabase.table(_TABLE)
            .select("*")
            .eq("pr_number", pr_number)
            .execute()
        )
        return [ContentDraft.model_validate(r) for r in extract_list(response)]

    @classmethod
    async def abandon(
        cls,
        supabase: Client,
        *,
        draft_id: UUID,
    ) -> ContentDraft:
        """Soft-abandon. Draft remains in DB for audit."""
        return await cls._apply_status_update(
            supabase,
            draft_id=draft_id,
            updates={"status": ContentDraftStatus.ABANDONED.value},
        )

    # ── Delete ────────────────────────────────────────────────────────

    @classmethod
    async def hard_delete(
        cls,
        supabase: Client,
        *,
        draft_id: UUID,
    ) -> None:
        """Permanent delete. Prefer `abandon()` unless PII/GDPR demands removal."""
        response = await (
            supabase.table(_TABLE).delete().eq("id", str(draft_id)).execute()
        )
        if not response.data:
            raise not_found(_TABLE, draft_id)

    # ── Internal ──────────────────────────────────────────────────────

    @classmethod
    async def _apply_status_update(
        cls,
        supabase: Client,
        *,
        draft_id: UUID,
        updates: dict[str, Any],
    ) -> ContentDraft:
        """Apply a status-transition update and return the fresh row."""
        response = await (
            supabase.table(_TABLE)
            .update(updates)
            .eq("id", str(draft_id))
            .execute()
        )
        if not response.data:
            raise not_found(_TABLE, draft_id)
        return ContentDraft.model_validate(response.data[0])

    @classmethod
    async def _apply_idempotent_status_update(
        cls,
        supabase: Client,
        *,
        draft_id: UUID,
        updates: dict[str, Any],
        gate_column: str,
    ) -> ContentDraft:
        """Apply a status update guarded on `<gate_column> IS NULL`.

        If the UPDATE affects 0 rows, the draft is either already past this
        transition (idempotent re-delivery) or doesn't exist. Falls back to
        `get()` to disambiguate: returns the existing (already-transitioned)
        row if present, raises 404 otherwise.

        Used by `mark_published` and `mark_merged` — both of which can be
        invoked multiple times for the same draft (publish retries, webhook
        re-deliveries) and must not clobber the original timestamp.
        """
        response = await (
            supabase.table(_TABLE)
            .update(updates)
            .eq("id", str(draft_id))
            .is_(gate_column, "null")
            .execute()
        )
        if response.data:
            return ContentDraft.model_validate(response.data[0])
        # Gate predicate failed (already past) OR row missing.
        # `get()` distinguishes them: returns the existing row or raises 404.
        return await cls.get(supabase, draft_id)

    @classmethod
    async def _raise_conflict_or_not_found(
        cls,
        supabase: Client,
        draft_id: UUID,
    ) -> None:
        """Disambiguate "doesn't exist" from "version mismatch" on failed update."""
        response = await (
            supabase.table(_TABLE)
            .select("id")
            .eq("id", str(draft_id))
            .limit(1)
            .execute()
        )
        if extract_one(response):
            logger.warning(
                "Content-draft optimistic-lock conflict (id=%s)",
                draft_id,
            )
            raise conflict(
                "Draft was modified by another session. Please refresh and retry.",
            )
        raise not_found(_TABLE, draft_id)
