"""Conflict-preview + resolve flow for content drafts (A1.7 Phase 5).

Companion to `publish.py`. Runs the 3-way merge preview for drafts in
'conflict' status and handles the state transition back to 'draft' after
the admin accepts the merged content.

Flow:

    1. Admin's draft gets marked 'conflict' by publish.py on OID drift.
    2. Admin opens the editor; it loads the draft and detects status='conflict'.
    3. Frontend requests GET /admin/content-drafts/{id}/conflict-preview.
       - This service fetches the current main-branch YAML for the draft's
         resource_path via GitHub Contents API.
       - Runs `merge_content(base, ours, theirs)` against the draft's
         base_content / working_content / freshly-fetched main content.
       - Returns {base, ours, theirs, merged, conflicts, auto_resolved_count,
         main_base_sha}.
    4. Admin inspects the 3-column UI, flips take-ours/take-theirs per entry
       if desired, and submits.
    5. Frontend calls POST /admin/content-drafts/{id}/resolve with
       {merged_working_content, version, acknowledged_conflict_paths}.
    6. `ContentDraftsService.resolve_conflict()` transitions conflict→draft
       and writes the merged content as the new working_content. `base_sha`
       is updated to the main HEAD captured in step 3, so the NEXT publish
       compares against the correct fresh baseline.

Why two endpoints (preview + resolve) instead of one:
    A single endpoint that did "fetch + merge + apply" would have to accept
    the admin's per-entry choices as a body parameter, or force-apply
    default-to-ours every time. Splitting lets the UI compute the preview
    once, render 3 columns, and let the admin iterate in-memory before
    committing — mirroring the standard Git rerere UX.

Failure modes:
    - Resource missing on main (admin added a NEW pack file, not-yet-merged):
      contents API returns 404 → treated as `theirs={}` (empty). Merge then
      surfaces base-only or ours-only keys as adds. No special casing
      needed beyond the 404-catch below.
    - GitHub unreachable: GitHubAPIError bubbles up as 502 Bad Gateway via
      existing HTTPException handling.
    - Draft not in 'conflict' status: 409 Conflict with explicit message.
"""

from __future__ import annotations

import base64
import logging
import os
from uuid import UUID

import yaml
from pydantic import ValidationError

from backend.models.content_drafts import (
    ConflictPreview,
    ContentDraft,
    ContentDraftStatus,
    EntryConflictDTO,
)
from backend.services.content_drafts_service import ContentDraftsService
from backend.services.content_packs.merge_service import (
    MergeResult,
    merge_content,
)
from backend.services.content_packs.publish import (
    build_file_path,
    discover_default_head,
)
from backend.services.github_app import (
    GitHubAPIError,
    GitHubAppClient,
    get_github_app_client,
)
from backend.utils.errors import bad_gateway, bad_request, conflict
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)


class ContentPacksConflictService:
    """Conflict-preview orchestration.

    Classmethod-style to match the rest of the content-draft layer. The
    `resolve` step lives on `ContentDraftsService` because it's a state
    transition on a DB row — no GitHub interaction — so it belongs with the
    other status-transition methods.
    """

    @classmethod
    async def generate_preview(
        cls,
        supabase: Client,
        *,
        draft_id: UUID,
        github_client: GitHubAppClient | None = None,
    ) -> ConflictPreview:
        """Build a 3-way merge preview for a conflict-status draft.

        Fetches the current main-branch YAML for the draft's resource and
        runs the merge. Returns the full preview payload for the admin UI.

        Raises:
            HTTPException 400: GITHUB_REPO_OWNER / GITHUB_REPO_NAME missing,
                or fetched YAML fails to parse / isn't a mapping.
            HTTPException 404: draft not found.
            HTTPException 409: draft is not in 'conflict' status.
            HTTPException 502: underlying GitHub call failed (non-404, non-2xx).
        """
        draft = await ContentDraftsService.get(supabase, draft_id)
        if draft.status != ContentDraftStatus.CONFLICT:
            raise conflict(
                f"Draft is in status '{draft.status.value}' — conflict "
                f"preview is only available for drafts in 'conflict' status.",
            )

        client = github_client or get_github_app_client()
        owner = os.environ.get("GITHUB_REPO_OWNER")
        repo = os.environ.get("GITHUB_REPO_NAME")
        if not owner or not repo:
            raise bad_request(
                "GITHUB_REPO_OWNER / GITHUB_REPO_NAME must be configured.",
            )

        default_branch, head_sha = await discover_default_head(
            client, owner, repo,
        )
        theirs = await _fetch_main_content(
            client,
            owner=owner,
            repo=repo,
            ref=default_branch,
            pack_slug=draft.pack_slug,
            resource_path=draft.resource_path,
        )

        result = merge_content(
            base=draft.base_content,
            ours=draft.working_content,
            theirs=theirs,
        )

        logger.info(
            "Conflict preview for draft %s: %d conflicts, %d auto-resolved",
            draft_id, len(result.conflicts), result.auto_resolved_count,
        )
        return _to_preview(draft, result, theirs, head_sha)


# ── Module-level helpers ──────────────────────────────────────────────────


async def _fetch_main_content(
    client: GitHubAppClient,
    *,
    owner: str,
    repo: str,
    ref: str,
    pack_slug: str,
    resource_path: str,
) -> dict:
    """Fetch + decode + parse the YAML file on `ref` for the given resource.

    Returns `{}` when the file doesn't exist on `ref` (e.g. admin is adding
    a brand-new resource and their original publish was the first-ever
    write). Any other non-2xx bubbles as 502.
    """
    file_path = build_file_path(pack_slug, resource_path)
    encoded_path = file_path.replace(" ", "%20")
    try:
        response = await client.rest(
            "GET",
            f"/repos/{owner}/{repo}/contents/{encoded_path}?ref={ref}",
        )
    except GitHubAPIError as exc:
        if exc.status == 404:
            logger.info(
                "Resource %s not on %s@%s — treating as empty (new-resource add)",
                file_path, repo, ref,
            )
            return {}
        raise bad_gateway(
            f"Failed to fetch main-branch content: GitHub returned {exc.status}",
        ) from exc

    # Contents API returns base64 with embedded newlines; strip them.
    raw_b64 = response.get("content", "")
    yaml_bytes = base64.b64decode(raw_b64)
    try:
        parsed = yaml.safe_load(yaml_bytes.decode("utf-8"))
    except (yaml.YAMLError, UnicodeDecodeError) as exc:
        raise bad_request(
            f"Main-branch YAML at {file_path} failed to parse: {exc}",
        ) from exc

    if parsed is None:
        # Empty file on main — admin is first writer to a resource.
        return {}
    if not isinstance(parsed, dict):
        raise bad_request(
            f"Main-branch YAML at {file_path} is not a mapping "
            f"(got {type(parsed).__name__}); merge requires dict at the top level.",
        )
    return parsed


def _to_preview(
    draft: ContentDraft,
    result: MergeResult,
    theirs: dict,
    main_base_sha: str,
) -> ConflictPreview:
    """Assemble the API DTO from merge internals + draft row."""
    try:
        return ConflictPreview(
            draft_id=draft.id,
            version=draft.version,
            base=draft.base_content,
            ours=draft.working_content,
            theirs=theirs,
            merged=result.merged,
            conflicts=[
                EntryConflictDTO(
                    path=c.path,
                    kind=c.kind.value,
                    base=c.base,
                    ours=c.ours,
                    theirs=c.theirs,
                )
                for c in result.conflicts
            ],
            auto_resolved_count=result.auto_resolved_count,
            main_base_sha=main_base_sha,
        )
    except ValidationError as exc:
        # Shouldn't happen — merge_content output is already shape-compatible.
        # Guard for future refactors.
        raise bad_request(
            f"Conflict preview failed to serialize: {exc}",
        ) from exc
