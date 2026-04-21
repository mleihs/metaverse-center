"""Orphan-branch sweeper for the content-draft publish workflow (A1.7 Phase 7).

Garbage-collects `content/drafts-batch-{ts}-{uuid}` branches left behind by:
  - Publish failures after branch creation (orphan with no PR).
  - Closed-not-merged PRs (GitHub does not auto-delete those branches).
  - Merged PRs when the repo does not have "delete branch on merge" enabled.

Strategy:
    1. List all refs under `refs/heads/content/drafts-batch-` via GitHub's
       `matching-refs/heads/{prefix}` REST endpoint (empty list when no match).
    2. For each ref, find the associated PR (head=`{owner}:{branch}`, state=all)
       and classify:
         - PR open → KEEP (active review).
         - PR merged → DELETE (should have been auto-deleted; GC).
         - PR closed (not merged) → DELETE (abandoned draft).
         - No PR, commit age > `min_age_days` → DELETE (failed publish).
         - No PR, commit age ≤ `min_age_days` → KEEP (may be in-flight publish).
    3. When `dry_run=False`, DELETE every 'delete' classification via
       `DELETE /repos/{owner}/{repo}/git/refs/heads/{branch}`.

Safety:
    - Strict prefix match: only refs whose names start with
      `content/drafts-batch-` are touched. The `matching-refs` endpoint
      enforces this server-side and the sweep never lists other refs.
    - Minimum age threshold for PR-less branches (default 7 days) prevents
      deleting a branch that the publish flow has created but not yet
      attached to a PR. Even under network retry, the publish flow opens
      the PR within seconds.
    - Per-branch errors are collected; one delete failure does not stop
      the sweep or affect other branches' classifications.
    - Dry-run default at the API surface (see `SweepOrphansRequest`).

Called by:
    - Admin endpoint: `POST /api/v1/admin/content-drafts/sweep-orphans`.
    - (Phase 7b, deferred) a scheduled task is possible but not yet wired;
      keeping this sync-only avoids the "silent cron deletes branches the
      admin didn't expect" surprise.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

from backend.models.content_drafts import (
    OrphanBranchClassification,
    SweepOrphansResult,
)
from backend.services.github_app import GitHubAPIError, GitHubAppClient

logger = logging.getLogger(__name__)

# Must match `publish._make_branch_name()` prefix exactly. Any drift here
# will silently leak orphans through the sweep.
_ORPHAN_BRANCH_PREFIX = "content/drafts-batch-"

# Default minimum age (days) for deleting a PR-less branch. Generous by
# design: publish opens the PR within seconds of creating the branch, so
# anything older than two weeks with no PR is a failed publish. The wider
# window absorbs Railway redeploy outages that can stretch a retry loop.
DEFAULT_MIN_AGE_DAYS = 14.0


async def sweep_orphan_branches(
    client: GitHubAppClient,
    owner: str,
    repo: str,
    *,
    min_age_days: float = DEFAULT_MIN_AGE_DAYS,
    dry_run: bool = True,
    now: datetime | None = None,
) -> SweepOrphansResult:
    """Find orphan draft-batch branches and optionally delete them.

    Args:
        client: Installation-scoped GitHub App client.
        owner, repo: Repo coordinates (read from env in the admin endpoint).
        min_age_days: Minimum commit age before a PR-less branch is eligible
            for deletion. Branches with an associated PR are classified on
            PR state and are not subject to the age threshold.
        dry_run: When True, classify every branch but do not issue the
            DELETE calls. The returned `branches[].deleted` will all be
            False in that case.
        now: Reference point for age calculation (test seam). Defaults to
            the current UTC time.

    Returns:
        `SweepOrphansResult` with per-branch classification + run totals.
    """
    now_dt = now or datetime.now(UTC)
    refs = await _list_draft_batch_refs(client, owner, repo)

    classified: list[OrphanBranchClassification] = []
    for ref in refs:
        branch_name = ref["ref"].removeprefix("refs/heads/")
        sha = ref["object"]["sha"]
        classified.append(
            await _classify_branch(
                client,
                owner,
                repo,
                branch_name=branch_name,
                sha=sha,
                min_age_days=min_age_days,
                now=now_dt,
            )
        )

    if not dry_run:
        for c in classified:
            if c.status != "delete":
                continue
            try:
                await _delete_branch(client, owner, repo, c.name)
                c.deleted = True
                logger.info(
                    "Orphan-sweeper deleted branch %s (reason=%s, age=%.1fd)",
                    c.name, c.reason, c.age_days,
                )
            except GitHubAPIError as exc:
                # Log the full GitHub body for incident triage; keep the
                # admin-visible `error` short so the UI table row stays
                # readable. 200 chars covers the common error shapes.
                c.error = f"{exc.status}: {exc.body[:200]}"
                logger.warning(
                    "Orphan-sweeper failed to delete %s (status=%d): %s",
                    c.name, exc.status, exc.body,
                )

    return SweepOrphansResult(
        dry_run=dry_run,
        total_found=len(classified),
        kept_count=sum(1 for c in classified if c.status == "keep"),
        deleted_count=sum(1 for c in classified if c.deleted),
        error_count=sum(1 for c in classified if c.error is not None),
        branches=classified,
    )


# ── Internal helpers ──────────────────────────────────────────────────────


async def _list_draft_batch_refs(
    client: GitHubAppClient, owner: str, repo: str,
) -> list[dict[str, Any]]:
    """Return all refs whose name starts with the draft-batch prefix.

    Uses the `/git/matching-refs/heads/{prefix}` endpoint which returns an
    empty list (not a 404) when no refs match — no error handling needed
    for the zero-matches path.
    """
    return await client.rest_list(
        "GET",
        f"/repos/{owner}/{repo}/git/matching-refs/heads/{_ORPHAN_BRANCH_PREFIX}",
    )


async def _classify_branch(
    client: GitHubAppClient,
    owner: str,
    repo: str,
    *,
    branch_name: str,
    sha: str,
    min_age_days: float,
    now: datetime,
) -> OrphanBranchClassification:
    """Classify one branch based on associated PR state + commit age.

    One REST call to `/pulls?head={owner}:{branch}&state=all` resolves the
    PR state. When no PR exists, a second call to `/commits/{sha}` provides
    the commit date for the age comparison. Branches with an associated PR
    skip the second call.
    """
    pr = await _find_associated_pr(client, owner, repo, branch_name)

    if pr is not None:
        pr_age = _age_days(pr["created_at"], now)
        pr_number = int(pr["number"])
        if pr["state"] == "open":
            return OrphanBranchClassification(
                name=branch_name, sha=sha, age_days=pr_age,
                pr_number=pr_number, pr_state="open",
                status="keep",
                reason="PR open (active review)",
            )
        merged = bool(pr.get("merged_at"))
        return OrphanBranchClassification(
            name=branch_name, sha=sha, age_days=pr_age,
            pr_number=pr_number,
            pr_state="merged" if merged else "closed",
            status="delete",
            reason=(
                "PR merged — GC (GitHub auto-delete disabled or skipped)"
                if merged
                else "PR closed without merge"
            ),
        )

    commit = await client.rest(
        "GET", f"/repos/{owner}/{repo}/commits/{sha}",
    )
    committed_at = commit["commit"]["committer"]["date"]
    age = _age_days(committed_at, now)
    if age > min_age_days:
        return OrphanBranchClassification(
            name=branch_name, sha=sha, age_days=age,
            pr_number=None, pr_state=None,
            status="delete",
            reason=(
                f"No PR; commit age {age:.1f}d exceeds {min_age_days:.1f}d "
                f"threshold (failed publish after branch creation)"
            ),
        )
    return OrphanBranchClassification(
        name=branch_name, sha=sha, age_days=age,
        pr_number=None, pr_state=None,
        status="keep",
        reason=(
            f"No PR; commit age {age:.1f}d within {min_age_days:.1f}d "
            f"threshold (may be an in-flight publish)"
        ),
    )


async def _find_associated_pr(
    client: GitHubAppClient,
    owner: str,
    repo: str,
    branch_name: str,
) -> dict[str, Any] | None:
    """Return the most-recently-created PR with this branch as head, or None.

    In practice there's at most one PR per draft-batch branch, but GitHub's
    API allows multiple and returns a list — we take the newest so a
    repeated publish (e.g. after admin retry) still classifies correctly.
    """
    prs = await client.rest_list(
        "GET",
        f"/repos/{owner}/{repo}/pulls?head={owner}:{branch_name}&state=all",
    )
    if not prs:
        return None
    return max(prs, key=lambda p: p["created_at"])


async def _delete_branch(
    client: GitHubAppClient, owner: str, repo: str, branch_name: str,
) -> None:
    """DELETE `/git/refs/heads/{branch}`. 204 on success; 422 if already gone."""
    await client.rest(
        "DELETE",
        f"/repos/{owner}/{repo}/git/refs/heads/{branch_name}",
    )


def _age_days(iso_ts: str, now: datetime) -> float:
    """Parse a GitHub ISO-8601 timestamp and return the age in days (float)."""
    dt = datetime.fromisoformat(iso_ts.replace("Z", "+00:00"))
    return (now - dt).total_seconds() / 86400.0
