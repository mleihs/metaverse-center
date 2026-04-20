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
      main-branch drift (handled by content_packs.publish).

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
    async def list_drafts(
        cls,
        supabase: Client,
        *,
        author_id: UUID | None = None,
        status_filter: list[ContentDraftStatus] | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[ContentDraftSummary], int]:
        """List drafts (most recent first), optionally filtered by author.

        Returns (drafts, total_count). When `author_id` is None, returns ALL
        drafts in the system — meant for the platform-admin "All drafts"
        view (RLS already restricts table access to platform admins). Pass
        `author_id` for the "My drafts" view.

        The default `status_filter` is None = all statuses; UI typically
        filters to [DRAFT, CONFLICT] for the "in-progress" tab.
        """
        query = (
            supabase.table(_TABLE)
            .select(_SUMMARY_COLUMNS, count="exact")
            .order("updated_at", desc=True)
        )
        if author_id is not None:
            query = query.eq("author_id", str(author_id))
        if status_filter:
            query = query.in_("status", [s.value for s in status_filter])
        query = query.range(offset, offset + limit - 1)
        response = await query.execute()

        rows = extract_list(response)
        total = response.count if response.count is not None else len(rows)
        await cls._attach_author_emails(supabase, rows)
        summaries = [ContentDraftSummary.model_validate(r) for r in rows]
        return summaries, total

    @classmethod
    async def _attach_author_emails(
        cls, supabase: Client, rows: list[dict[str, Any]],
    ) -> None:
        """Enrich rows with `author_email` via the `get_user_emails_batch` RPC.

        Mutates `rows` in place. Uses the SECURITY DEFINER RPC from migration
        044 rather than a direct `auth.users` join because PostgREST does not
        expose the `auth` schema for embedding. The admin-only caller chain
        uses `get_effective_supabase` which elevates to service_role for
        platform admins — a prerequisite for the RPC's GRANT.

        Silent failure by design: a failed email lookup leaves
        `author_email` unset (null), the drafts list still renders with the
        short-UUID fallback in the UI. Observability goes through
        `captureError` via the caller's own error handling if needed — here
        we just log at warning.
        """
        if not rows:
            return
        author_ids = sorted(
            {r["author_id"] for r in rows if r.get("author_id")}
        )
        if not author_ids:
            return
        try:
            email_resp = await supabase.rpc(
                "get_user_emails_batch", {"user_ids": author_ids},
            ).execute()
            email_map: dict[str, str] = {
                row["id"]: row["email"]
                for row in (extract_list(email_resp) or [])
            }
        except Exception:  # noqa: BLE001 — non-fatal enrichment
            logger.warning(
                "get_user_emails_batch failed for %d author(s); "
                "drafts list will render without email",
                len(author_ids),
                exc_info=True,
            )
            return
        for row in rows:
            row["author_email"] = email_map.get(row.get("author_id"))

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

    @classmethod
    async def list_by_ids(
        cls,
        supabase: Client,
        *,
        draft_ids: list[UUID],
    ) -> list[ContentDraft]:
        """Fetch N drafts by ID. Returns whatever exists; no error on missing.

        Caller decides how to handle missing IDs (publish.py raises 404;
        future bulk-export endpoint may tolerate gaps). Returns full rows
        including JSONB blobs (publish.py needs working_content).
        """
        if not draft_ids:
            return []
        ids = [str(d) for d in draft_ids]
        response = await (
            supabase.table(_TABLE).select("*").in_("id", ids).execute()
        )
        return [ContentDraft.model_validate(r) for r in extract_list(response)]

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

    # ── Update — single-draft status transitions ──────────────────────
    # No version guard: triggered by single server-side paths (publish
    # workflow, webhook handler, admin abandon), which cannot race each
    # other on the same draft.

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

    @classmethod
    async def resolve_conflict(
        cls,
        supabase: Client,
        *,
        draft_id: UUID,
        merged_working_content: dict[str, Any],
        expected_version: int,
    ) -> ContentDraft:
        """Transition conflict → draft with admin-approved merged content (A1.7 Phase 5).

        Writes `merged_working_content` as the new `working_content`, bumps
        `version`, and clears the stale publish metadata (commit_sha,
        pr_number, pr_url, published_at, expected_head_oid).

        The state-machine trigger (migration 226) enforces the conflict→draft
        edge; the `.eq("status", "conflict")` filter here surfaces a clean
        409 if the draft has raced to another state since preview.

        `expected_version` gates the update optimistically: if the draft was
        modified in another session between preview and resolve, the update
        affects 0 rows and we raise 409.

        `base_sha` is deliberately NOT updated here. publish.py re-fetches
        main's HEAD fresh at every publish (see `discover_default_head` in
        publish.py), so `expected_head_oid` is derived per-publish and the
        stored `base_sha` has no effect on drift detection. A future
        field-level merge path might use it as the common-ancestor pin,
        but for MVP we keep the column frozen at its draft-open value.
        """
        new_version = expected_version + 1
        updates: dict[str, Any] = {
            "status": ContentDraftStatus.DRAFT.value,
            "working_content": merged_working_content,
            "version": new_version,
            # Clear the stale publish-era metadata; the admin may re-publish,
            # which starts the GitHub dance from scratch.
            "expected_head_oid": None,
            "commit_sha": None,
            "pr_number": None,
            "pr_url": None,
            "published_at": None,
        }

        response = await (
            supabase.table(_TABLE)
            .update(updates)
            .eq("id", str(draft_id))
            .eq("status", ContentDraftStatus.CONFLICT.value)
            .eq("version", expected_version)
            .execute()
        )
        if not response.data:
            await cls._raise_conflict_or_not_found_detail(supabase, draft_id)
        return ContentDraft.model_validate(response.data[0])

    # ── Update — bulk status transitions ──────────────────────────────
    # Used by batch publish (mark_published_bulk on success, mark_conflict_bulk
    # on drift) and the webhook handler (mark_merged_bulk on PR merge,
    # revert_to_draft_bulk on PR-closed-without-merge per decision A).

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

        Idempotent on `published_at IS NULL`: a re-call (e.g. publish retry
        after partial network failure) leaves already-published rows
        untouched and returns the full set as it currently stands in the DB.

        All drafts in `draft_ids` must currently be in 'draft' status. The
        caller (publish flow) gates on that before calling — this method
        does not re-validate.
        """
        return await cls._bulk_status_update(
            supabase,
            draft_ids=draft_ids,
            updates={
                "status": ContentDraftStatus.PUBLISHED.value,
                "expected_head_oid": expected_head_oid,
                "commit_sha": commit_sha,
                "pr_number": pr_number,
                "pr_url": pr_url,
                "published_at": datetime.now(UTC).isoformat(),
            },
            null_gate_column="published_at",
        )

    @classmethod
    async def mark_merged_bulk(
        cls,
        supabase: Client,
        *,
        draft_ids: list[UUID],
    ) -> list[ContentDraft]:
        """Atomically mark N drafts as merged on PR-merge webhook delivery.

        Idempotent on `merged_at IS NULL`: GitHub retries webhook deliveries
        on timeout; the second delivery leaves already-merged rows untouched
        (preserves original merged_at for audit timing).
        """
        return await cls._bulk_status_update(
            supabase,
            draft_ids=draft_ids,
            updates={
                "status": ContentDraftStatus.MERGED.value,
                "merged_at": datetime.now(UTC).isoformat(),
            },
            null_gate_column="merged_at",
        )

    @classmethod
    async def mark_conflict_bulk(
        cls,
        supabase: Client,
        *,
        draft_ids: list[UUID],
    ) -> list[ContentDraft]:
        """Flag N drafts as conflict in one UPDATE (e.g. on batch drift).

        No idempotency gate: marking conflict is repeatable (the row's
        status is the only thing that changes; no timestamp to clobber).
        """
        return await cls._bulk_status_update(
            supabase,
            draft_ids=draft_ids,
            updates={"status": ContentDraftStatus.CONFLICT.value},
        )

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
        a non-'published' state are left untouched (gated on status='published').

        Resets: status, published_at, expected_head_oid, commit_sha, pr_number,
        pr_url. Keeps: base_content, working_content, version (admin can
        continue editing).
        """
        return await cls._bulk_status_update(
            supabase,
            draft_ids=draft_ids,
            updates={
                "status": ContentDraftStatus.DRAFT.value,
                "published_at": None,
                "expected_head_oid": None,
                "commit_sha": None,
                "pr_number": None,
                "pr_url": None,
            },
            equals_gate=("status", ContentDraftStatus.PUBLISHED.value),
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
    async def _bulk_status_update(
        cls,
        supabase: Client,
        *,
        draft_ids: list[UUID],
        updates: dict[str, Any],
        null_gate_column: str | None = None,
        equals_gate: tuple[str, str] | None = None,
    ) -> list[ContentDraft]:
        """Apply an UPDATE to N drafts; always re-fetch for consistent view.

        Empty `draft_ids` short-circuits to `[]` with no DB call.

        Filters (mutually exclusive — at most one):
          - `null_gate_column='X'` → adds `is_('X', 'null')` for idempotency
            on transitions where the target state is signaled by a non-null
            timestamp (e.g. `published_at`, `merged_at`).
          - `equals_gate=('col', 'value')` → adds `eq('col', 'value')` for
            transitions gated on a current state (e.g. status='published'
            for revert_to_draft_bulk).

        The follow-up SELECT returns ALL drafts in `draft_ids` (gate-filtered
        rows included), so callers see a complete consistent view even when
        some rows fell through the gate (idempotent re-call).
        """
        if not draft_ids:
            return []
        if null_gate_column is not None and equals_gate is not None:
            msg = "_bulk_status_update accepts at most one gate predicate"
            raise ValueError(msg)

        ids = [str(d) for d in draft_ids]
        update_query = supabase.table(_TABLE).update(updates).in_("id", ids)
        if null_gate_column is not None:
            update_query = update_query.is_(null_gate_column, "null")
        elif equals_gate is not None:
            col, val = equals_gate
            update_query = update_query.eq(col, val)
        await update_query.execute()

        full = await (
            supabase.table(_TABLE).select("*").in_("id", ids).execute()
        )
        return [ContentDraft.model_validate(r) for r in extract_list(full)]

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

    @classmethod
    async def _raise_conflict_or_not_found_detail(
        cls,
        supabase: Client,
        draft_id: UUID,
    ) -> None:
        """Like `_raise_conflict_or_not_found`, but also checks status='conflict'.

        Used by `resolve_conflict` which has three possible failure modes
        (missing, status-mismatch, version-mismatch) and benefits from a
        status-specific 409 message.
        """
        response = await (
            supabase.table(_TABLE)
            .select("status, version")
            .eq("id", str(draft_id))
            .limit(1)
            .execute()
        )
        row = extract_one(response)
        if not row:
            raise not_found(_TABLE, draft_id)
        current_status = row.get("status")
        if current_status != ContentDraftStatus.CONFLICT.value:
            logger.warning(
                "Resolve called on draft %s in status %s (expected 'conflict')",
                draft_id, current_status,
            )
            raise conflict(
                f"Draft is in status '{current_status}' — resolve is only "
                f"allowed for drafts in 'conflict' status.",
            )
        logger.warning(
            "Content-draft resolve optimistic-lock conflict (id=%s, db_version=%s)",
            draft_id, row.get("version"),
        )
        raise conflict(
            "Draft was modified by another session. Please refresh the "
            "conflict preview and retry.",
        )
