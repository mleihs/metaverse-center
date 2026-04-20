"""Batch publish flow for content drafts (A1.7 Phase 2 + 2.5).

Lifts N drafts from the DB → renders each as a YAML pack file + an
auto-generated dungeon_content_seed migration → opens a single PR via
the GitHub App. One PR per batch (decision B), even for N=1.

Pipeline:
    1. Fetch drafts by ID; reject if any is not in 'draft' status (409).
    2. Reject batches with duplicate (pack_slug, resource_path) (400).
    3. Discover repo's default branch + its current HEAD SHA.
    4. Build overlay from drafts + load_packs_with_overlay + generate_sql
       to produce the derived content-seed migration (Phase 2.5). Pydantic
       validation errors surface as 400 before any GitHub side-effect.
    5. Discover next migration sequence number via GitHub REST
       `/contents/supabase/migrations` on the default branch.
    6. Build YAML file paths + serialize each draft's working_content,
       plus the auto-generated migration file.
       (Runs BEFORE branch creation so invalid input can never leave
       an orphan branch on the repo.)
    7. Create a working branch off the default branch via REST.
    8. Single createCommitOnBranch GraphQL mutation with all file changes
       (N YAMLs + 1 migration). expectedHeadOid prevents drift; on
       mismatch we mark all drafts as conflict and surface 409 to admin.
    9. REST POST /repos/.../pulls opens a PR from the new branch to default.
   10. mark_published_bulk records pr_number/pr_url/commit_sha on all
       drafts in one atomic UPDATE.

Failure modes:
    - Draft not found / wrong status / duplicate resource: 4xx, no
      GitHub side-effects.
    - Pack schema error (draft or on-disk): 400 with field errors, no
      GitHub side-effects.
    - Default-branch drift: GitHub returns expectedHeadOid mismatch →
      mark_conflict_bulk on all drafts → 409 to admin.
    - GitHub call fails after the working branch was created: drafts stay
      in 'draft' (sane state); orphan branch remains on the repo. Admin
      can retry publish; orphan-branch cleanup is a separate concern
      (Phase 5+).

Phase 2.5: auto-generated migration (Option A, atomic publish)
    The commit includes both the YAML change AND a regenerated
    `{timestamp}_{NNN}_dungeon_content_seed_auto.sql` migration that
    TRUNCATE+re-inserts all content-table rows from the overlay'd pack
    tree. When the PR merges, CI applies the migration → DB reflects
    the YAML → runtime cache refreshes on next `load_all_content`.

    Deploy-lag caveat: publish.py reads the on-disk YAML pack tree to
    compute the migration. Between "another content-adjacent PR merges"
    (T0) and "Railway redeploy completes with new disk state" (T1, ~5min),
    a concurrent publish regenerates from stale disk and the resulting
    migration may revert T0's changes. Human PR review catches this
    (the revert-diff is visible); Phase 5+ will move disk-reads to a
    GitHub-API fetch from default-branch HEAD to eliminate the race.

Phase 2 limitations:
    - working_content is treated as the FULL contents of a YAML pack file.
      `pack_slug` must be an archetype slug (e.g. 'shadow', 'awakening');
      `resource_path` must be a plain pack-kind name (e.g. 'banter') with
      no brackets, slashes, or .yaml suffix. The bracket notation allowed
      by the model regex is reserved for sub-resource editing in Phase 5.
    - YAML comment preservation is NOT supported (JSONB round-trip is
      lossy). Phase 5 will use ruamel.yaml for comment-preserving merges.
"""

from __future__ import annotations

import base64
import logging
import os
import re
from datetime import UTC, datetime
from uuid import UUID, uuid4

import yaml
from pydantic import ValidationError

from backend.models.content_drafts import (
    BatchPublishResult,
    ContentDraft,
    ContentDraftStatus,
    ContentDraftSummary,
)
from backend.services.content_drafts_service import ContentDraftsService
from backend.services.content_packs.generate_migration import generate_sql
from backend.services.content_packs.loader import (
    OverlayMap,
    load_packs_with_overlay,
)
from backend.services.github_app import (
    GitHubAPIError,
    GitHubAppClient,
    get_github_app_client,
)
from backend.utils.errors import bad_request, conflict, not_found
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# Phase 2 publish-time constraint on resource_path: simple lowercase identifier
# only (no brackets, slashes, dots, suffix). Sub-resource notation (Phase 5+)
# would relax this to JSON-pointer-like paths.
_PHASE2_RESOURCE_PATH_RE = re.compile(r"^[a-z][a-z0-9_]*$")

# Pack file layout under the repo. Aligns with backend/services/content_packs/
# loader.py DEFAULT_PACK_ROOT and the existing on-disk archetype tree.
_PACK_FILE_TEMPLATE = "content/dungeon/archetypes/{pack_slug}/{resource_path}.yaml"

# YAML serialization defaults — block style, key order preserved,
# Unicode preserved (German prose uses Umlauts and quotes), generous width
# to keep most lines unwrapped.
_YAML_DUMP_KWARGS: dict[str, object] = {
    "default_flow_style": False,
    "sort_keys": False,
    "allow_unicode": True,
    "width": 120,
    "indent": 2,
}

# GraphQL mutation: takes a CreateCommitOnBranchInput and returns the new
# commit's OID + URL. The mutation runs against an existing branch and
# rejects on expectedHeadOid mismatch — that's our drift detection.
_CREATE_COMMIT_MUTATION = """
mutation CreateCommit($input: CreateCommitOnBranchInput!) {
  createCommitOnBranch(input: $input) {
    commit {
      oid
      url
    }
  }
}
""".strip()

# Substrings GitHub uses in expectedHeadOid-mismatch errors. Both forms have
# been observed in the wild; keep the matcher tolerant.
_DRIFT_ERROR_MARKERS = (
    "expected head oid",
    "branch was modified",
    "is not a fast forward",
)

# Phase 2.5 auto-generated migration layout. We append ONE new migration
# per publish batch; the filename encodes a sortable timestamp + a
# zero-padded sequence number consistent with the existing migrations tree.
_MIGRATIONS_DIR = "supabase/migrations"
_MIGRATION_SEQUENCE_RE = re.compile(r"^\d{14}_(\d{3})_")
_MIGRATION_NAME_SUFFIX = "dungeon_content_seed_auto.sql"


class ContentPacksPublishService:
    """Batch-publish content drafts via the GitHub App.

    Classmethod-style to match the rest of the content-draft layer
    (see ContentDraftsService). All inputs come through arguments — no
    instance state, no module-level cache.
    """

    @classmethod
    async def publish_batch(
        cls,
        supabase: Client,
        *,
        draft_ids: list[UUID],
        github_client: GitHubAppClient | None = None,
        commit_message: str | None = None,
    ) -> BatchPublishResult:
        """Publish N drafts as a single PR.

        Args:
            supabase: Effective client (service_role for platform admins).
            draft_ids: Drafts to include. Caller validates length bounds via
                the BatchPublishRequest model — this method only checks
                non-empty.
            github_client: Injected for testability; defaults to the process
                singleton (`get_github_app_client()`).
            commit_message: Optional headline override (≤72 chars by model
                validation). When None, headline derives from the draft list.

        Reads `GITHUB_REPO_OWNER` + `GITHUB_REPO_NAME` from the environment.

        Raises:
            HTTPException 400: empty `draft_ids`, env vars missing, a draft's
                resource_path uses sub-resource notation (Phase 5+), the
                batch contains duplicate (pack_slug, resource_path) pairs,
                or pack schema validation fails for any YAML content.
            HTTPException 404: a draft_id doesn't exist.
            HTTPException 409: some drafts are not in 'draft' status, OR
                default-branch drift detected at commit time.
            GitHubAPIError: an underlying GitHub API call failed.
        """
        if not draft_ids:
            raise bad_request("draft_ids must be non-empty.")

        client = github_client or get_github_app_client()
        owner, repo = get_github_repo_config()

        drafts = await cls._fetch_publishable_drafts(supabase, draft_ids)
        _validate_no_duplicate_resources(drafts)
        default_branch, head_oid = await cls._discover_default_head(
            client, owner, repo,
        )
        # Build ALL file changes BEFORE the branch — keeps any failure
        # (invalid path, schema error, migration-number lookup) from
        # leaving an orphan branch on the repo.
        # Order matters for admin-friendly error messages:
        #   1. yaml_changes first → surfaces Phase-2 path-regex violations
        #      (bracket / slash / dotted notation) with the actionable
        #      "Phase 5+ sub-resource" message rather than a generic
        #      "unknown pack kind" from the overlay loader.
        #   2. migration SQL gen → Pydantic-validates the overlay; bad
        #      draft content bubbles up as 400 with field errors.
        #   3. migration-number lookup → last local dependency, one REST
        #      call to read the default-branch migrations tree.
        yaml_changes = [_build_file_change(d) for d in drafts]
        migration_sql = _generate_migration_sql(drafts)
        next_migration_num = await cls._discover_next_migration_number(
            client, owner, repo, default_branch,
        )
        migration_change = _build_migration_file_change(
            next_migration_num, migration_sql,
        )
        file_changes = [*yaml_changes, migration_change]
        branch_name = _make_branch_name()
        logger.info(
            "Publishing %d draft(s) + migration %s as branch %s (head=%s)",
            len(drafts), migration_change[0], branch_name, head_oid[:8],
        )

        await cls._create_branch(client, owner, repo, branch_name, head_oid)

        try:
            commit_data = await cls._create_commit(
                client,
                owner=owner,
                repo=repo,
                branch_name=branch_name,
                head_oid=head_oid,
                file_changes=file_changes,
                drafts=drafts,
                custom_headline=commit_message,
                migration_path=migration_change[0],
            )
        except GitHubAPIError as exc:
            if _is_drift_error(exc):
                logger.warning(
                    "Default-branch drift on publish; marking %d drafts as conflict",
                    len(drafts),
                )
                await ContentDraftsService.mark_conflict_bulk(
                    supabase, draft_ids=draft_ids,
                )
                raise conflict(
                    "Default branch moved during publish — drafts marked as "
                    "conflict. Refresh and resolve before retrying.",
                ) from exc
            raise

        commit_sha: str = commit_data["oid"]

        pr_data = await cls._open_pull_request(
            client,
            owner=owner,
            repo=repo,
            branch_name=branch_name,
            base_branch=default_branch,
            drafts=drafts,
            custom_headline=commit_message,
            migration_path=migration_change[0],
        )

        published_drafts = await ContentDraftsService.mark_published_bulk(
            supabase,
            draft_ids=draft_ids,
            expected_head_oid=head_oid,
            commit_sha=commit_sha,
            pr_number=pr_data["number"],
            pr_url=pr_data["html_url"],
        )

        return BatchPublishResult(
            commit_sha=commit_sha,
            pr_number=pr_data["number"],
            pr_url=pr_data["html_url"],
            branch_name=branch_name,
            draft_count=len(published_drafts),
            drafts=[
                ContentDraftSummary.model_validate(d.model_dump())
                for d in published_drafts
            ],
        )

    # ── Internals ─────────────────────────────────────────────────────

    @classmethod
    async def _fetch_publishable_drafts(
        cls,
        supabase: Client,
        draft_ids: list[UUID],
    ) -> list[ContentDraft]:
        """Load drafts via the service and assert all are publishable.

        Returns drafts in the same order as `draft_ids` (callers rely on
        order for deterministic commit-message construction).

        Raises:
            HTTPException 404: any requested ID is missing.
            HTTPException 409: any draft is not in 'draft' status.
        """
        rows = await ContentDraftsService.list_by_ids(
            supabase, draft_ids=draft_ids,
        )
        by_id = {d.id: d for d in rows}

        missing = [d for d in draft_ids if d not in by_id]
        if missing:
            raise not_found(
                "ContentDraft",
                missing[0],
                context=f"({len(missing)} of {len(draft_ids)} draft IDs not found)",
            )

        drafts = [by_id[d] for d in draft_ids]
        not_publishable = [
            d for d in drafts if d.status != ContentDraftStatus.DRAFT
        ]
        if not_publishable:
            statuses = ", ".join(
                f"{d.id}={d.status.value}" for d in not_publishable
            )
            raise conflict(
                f"All drafts must be in 'draft' status to publish. "
                f"Not publishable: {statuses}",
            )
        return drafts

    @classmethod
    async def _discover_default_head(
        cls,
        client: GitHubAppClient,
        owner: str,
        repo: str,
    ) -> tuple[str, str]:
        """Proxy to the module-level helper; kept as a classmethod so existing
        test patches on ContentPacksPublishService._discover_default_head
        continue to work without change.
        """
        return await discover_default_head(client, owner, repo)

    @classmethod
    async def _create_branch(
        cls,
        client: GitHubAppClient,
        owner: str,
        repo: str,
        branch_name: str,
        sha: str,
    ) -> None:
        """Create `refs/heads/{branch_name}` pointing at `sha`.

        REST: POST /repos/.../git/refs. Returns 201 on success. We pass
        through GitHubAPIError so callers see the underlying status.
        """
        await client.rest(
            "POST",
            f"/repos/{owner}/{repo}/git/refs",
            json_body={"ref": f"refs/heads/{branch_name}", "sha": sha},
        )

    @classmethod
    async def _create_commit(
        cls,
        client: GitHubAppClient,
        *,
        owner: str,
        repo: str,
        branch_name: str,
        head_oid: str,
        file_changes: list[tuple[str, str]],
        drafts: list[ContentDraft],
        custom_headline: str | None,
        migration_path: str | None = None,
    ) -> dict:
        """Run createCommitOnBranch with all draft file changes."""
        headline, body = _make_commit_message(
            drafts, custom_headline, migration_path=migration_path,
        )
        variables = {
            "input": {
                "branch": {
                    "repositoryNameWithOwner": f"{owner}/{repo}",
                    "branchName": branch_name,
                },
                "expectedHeadOid": head_oid,
                "fileChanges": {
                    "additions": [
                        {"path": path, "contents": contents_b64}
                        for path, contents_b64 in file_changes
                    ],
                },
                "message": {"headline": headline, "body": body},
            }
        }
        result = await client.graphql(_CREATE_COMMIT_MUTATION, variables)
        return result["data"]["createCommitOnBranch"]["commit"]

    @classmethod
    async def _open_pull_request(
        cls,
        client: GitHubAppClient,
        *,
        owner: str,
        repo: str,
        branch_name: str,
        base_branch: str,
        drafts: list[ContentDraft],
        custom_headline: str | None,
        migration_path: str | None = None,
    ) -> dict:
        """REST: POST /repos/.../pulls. Returns the PR data dict.

        PR title + body reuse the commit-message helper — same content
        because the publish unit IS the commit (one batch, one commit, one PR).
        """
        title, body = _make_commit_message(
            drafts, custom_headline, migration_path=migration_path,
        )
        return await client.rest(
            "POST",
            f"/repos/{owner}/{repo}/pulls",
            json_body={
                "title": title,
                "head": branch_name,
                "base": base_branch,
                "body": body,
            },
        )

    @classmethod
    async def _discover_next_migration_number(
        cls,
        client: GitHubAppClient,
        owner: str,
        repo: str,
        ref: str,
    ) -> int:
        """Return max `NNN` sequence across `supabase/migrations/` on `ref`, plus 1.

        Reads the directory listing via the REST Contents API. Migration
        filenames follow `{YYYYMMDDHHMMSS}_{NNN}_*.sql`; we parse `NNN`
        (zero-padded 3-digit) and pick max + 1. Non-matching filenames
        are ignored (defensive against future naming drift).

        Contents API is not paginated for small directories (< ~1000
        entries); current migrations count is ~226 so we don't chunk.
        """
        items = await client.rest(
            "GET",
            f"/repos/{owner}/{repo}/contents/{_MIGRATIONS_DIR}?ref={ref}",
        )
        max_n = 0
        for item in items:
            if item.get("type") != "file":
                continue
            match = _MIGRATION_SEQUENCE_RE.match(item.get("name", ""))
            if match:
                n = int(match.group(1))
                max_n = max(max_n, n)
        return max_n + 1


# ── Module-level helpers (testable in isolation) ──────────────────────────


def get_github_repo_config() -> tuple[str, str]:
    """Return the configured (owner, repo) pair or raise 400 when unset.

    Single source of truth for the `GITHUB_REPO_OWNER` / `GITHUB_REPO_NAME`
    env-var lookup shared by publish and conflict-preview flows — keeps
    the error message uniform and the lookup testable as a seam.
    """
    owner = os.environ.get("GITHUB_REPO_OWNER")
    repo = os.environ.get("GITHUB_REPO_NAME")
    if not owner or not repo:
        raise bad_request(
            "GITHUB_REPO_OWNER / GITHUB_REPO_NAME must be configured.",
        )
    return owner, repo


async def discover_default_head(
    client: GitHubAppClient, owner: str, repo: str,
) -> tuple[str, str]:
    """Return (default_branch_name, head_sha) for the repo.

    Two REST calls: one to read the repo's default_branch, one to read the
    ref. Both share the App's persistent httpx client (single TCP connection,
    single TLS handshake amortized across the flow). Used by both the
    publish pipeline and the conflict-preview flow.
    """
    repo_info = await client.rest("GET", f"/repos/{owner}/{repo}")
    default_branch = repo_info["default_branch"]
    ref_info = await client.rest(
        "GET", f"/repos/{owner}/{repo}/git/ref/heads/{default_branch}",
    )
    head_oid = ref_info["object"]["sha"]
    return default_branch, head_oid


def build_file_path(pack_slug: str, resource_path: str) -> str:
    """Map a (pack_slug, resource_path) pair to a YAML file path in the repo.

    Phase 2 convention: pack_slug = archetype slug, resource_path = pack-kind
    file basename. Sub-resource notation (`'banter[ab_01]'`) is rejected at
    publish time even though the model regex allows it.

    Raises:
        HTTPException 400: resource_path uses sub-resource notation.
    """
    if not _PHASE2_RESOURCE_PATH_RE.match(resource_path):
        raise bad_request(
            f"Phase 2 publish only supports plain pack-kind names "
            f"(e.g. 'banter'). Got: {resource_path!r}. "
            f"Sub-resource publish (bracket / dotted notation) is Phase 5+.",
        )
    return _PACK_FILE_TEMPLATE.format(
        pack_slug=pack_slug, resource_path=resource_path,
    )


def render_yaml(content: dict) -> str:
    """Serialize a draft's working_content as YAML.

    Block style, key order preserved, Unicode preserved, 120-char width.
    Phase 2 limitation: comments are NOT preserved (JSONB round-trip is
    lossy). Phase 5 will use ruamel.yaml for comment-preserving merges.
    """
    rendered = yaml.safe_dump(content, **_YAML_DUMP_KWARGS)
    if not rendered.endswith("\n"):
        rendered += "\n"
    return rendered


def _build_file_change(draft: ContentDraft) -> tuple[str, str]:
    """Build the (path, base64_contents) pair for createCommitOnBranch."""
    path = build_file_path(draft.pack_slug, draft.resource_path)
    yaml_text = render_yaml(draft.working_content)
    contents_b64 = base64.b64encode(yaml_text.encode("utf-8")).decode("ascii")
    return path, contents_b64


def _validate_no_duplicate_resources(drafts: list[ContentDraft]) -> None:
    """Reject batches containing two drafts for the same (slug, path).

    Two drafts targeting the same YAML file in one batch are always a user
    error — the second write would silently clobber the first in the overlay
    map, and the migration would reflect only one of them. Fail loudly at
    the API boundary so the admin sees which drafts conflict.

    Raises:
        HTTPException 400: duplicates found.
    """
    seen: set[tuple[str, str]] = set()
    duplicates: list[tuple[str, str]] = []
    for d in drafts:
        key = (d.pack_slug, d.resource_path)
        if key in seen:
            duplicates.append(key)
        else:
            seen.add(key)
    if duplicates:
        raise bad_request(
            f"Batch contains duplicate (pack_slug, resource_path) entries: "
            f"{duplicates}. Each resource may appear at most once per batch.",
        )


def _build_overlay(drafts: list[ContentDraft]) -> OverlayMap:
    """Map drafts onto an overlay suitable for `load_packs_with_overlay`."""
    return {
        (d.pack_slug, d.resource_path): d.working_content for d in drafts
    }


def _generate_migration_sql(drafts: list[ContentDraft]) -> str:
    """Render the derived dungeon_content_seed migration for a batch.

    Loads the on-disk pack tree with the draft overlay applied, then runs
    `generate_sql` (TRUNCATE + re-insert) to produce a full-replacement
    migration. Pydantic validation errors (in any pack, overlay or disk)
    surface as HTTP 400 with a short error summary.

    Deploy-lag caveat (see module docstring): on-disk state may lag
    recently-merged content PRs until Railway redeploy completes. The
    resulting migration would then revert T0's changes; human review of
    the PR diff catches this.
    """
    overlay = _build_overlay(drafts)
    try:
        result = load_packs_with_overlay(overlay=overlay)
    except ValidationError as exc:
        errs = "; ".join(
            f"{'.'.join(str(p) for p in err['loc'])}: {err['msg']}"
            for err in exc.errors()[:5]
        )
        remaining = max(0, len(exc.errors()) - 5)
        if remaining:
            errs += f" (+{remaining} more)"
        raise bad_request(f"Pack validation failed: {errs}") from exc
    except ValueError as exc:
        # Raised by loader for unknown slugs / pack kinds in overlay.
        raise bad_request(f"Pack overlay invalid: {exc}") from exc
    sql, _counts = generate_sql(result, truncate=True)
    return sql


def _build_migration_filename(sequence_number: int) -> str:
    """Build the filename for the auto-generated migration.

    Format: `{YYYYMMDDHHMMSS}_{NNN}_dungeon_content_seed_auto.sql`. The
    `_auto` suffix distinguishes publish-generated migrations from
    hand-authored ones in code review.
    """
    ts = datetime.now(UTC).strftime("%Y%m%d%H%M%S")
    return f"{ts}_{sequence_number:03d}_{_MIGRATION_NAME_SUFFIX}"


def _build_migration_file_change(
    sequence_number: int, sql: str,
) -> tuple[str, str]:
    """Build the (path, base64_contents) pair for the migration addition."""
    filename = _build_migration_filename(sequence_number)
    path = f"{_MIGRATIONS_DIR}/{filename}"
    contents_b64 = base64.b64encode(sql.encode("utf-8")).decode("ascii")
    return path, contents_b64


def _make_branch_name() -> str:
    """Generate a unique working-branch name for one publish attempt.

    Format: `content/drafts-batch-{YYYYMMDD-HHMMSS}-{8-char-uuid}`. The
    timestamp aids manual triage in the GitHub UI; the random suffix
    guarantees uniqueness even on rapid same-second re-publishes.
    """
    ts = datetime.now(UTC).strftime("%Y%m%d-%H%M%S")
    short = uuid4().hex[:8]
    return f"content/drafts-batch-{ts}-{short}"


def _make_commit_message(
    drafts: list[ContentDraft],
    custom_headline: str | None,
    *,
    migration_path: str | None = None,
) -> tuple[str, str]:
    """Build (headline, body) for the publish commit (also reused as PR text).

    Headline default:
        - 1 draft:  `content({pack_slug}): update {resource_path}`
        - N drafts: `content: publish {N} drafts`

    Body lists each draft's path + ID for traceability. When
    `migration_path` is set (Phase 2.5 publish flow), the body also
    records the auto-generated migration and notes that it is a derived
    artifact — reviewers should focus on the YAML diff.
    """
    if custom_headline:
        headline = custom_headline
    elif len(drafts) == 1:
        d = drafts[0]
        headline = f"content({d.pack_slug}): update {d.resource_path}"
    else:
        headline = f"content: publish {len(drafts)} drafts"
    body_lines = ["Drafts in this batch:", ""]
    for d in drafts:
        path = _PACK_FILE_TEMPLATE.format(
            pack_slug=d.pack_slug, resource_path=d.resource_path,
        )
        body_lines.append(f"- {path} (draft {d.id})")
    if migration_path:
        body_lines.extend([
            "",
            f"Auto-generated migration: {migration_path}",
            "",
            "The migration file is derived from the YAML changes via "
            "`backend.services.content_packs.generate_migration`. Review "
            "the YAML files only — the migration is regenerated "
            "deterministically and TRUNCATE+re-inserts the full content "
            "seed. Applied by CI on merge.",
        ])
    return headline, "\n".join(body_lines)


def _is_drift_error(exc: GitHubAPIError) -> bool:
    """Detect createCommitOnBranch's expectedHeadOid-mismatch error.

    GitHub surfaces this as a GraphQL error in the response body (HTTP 200
    with `errors` array). Our client wraps that as `GitHubAPIError(200, ...)`.
    Match on substrings since GitHub's exact wording has shifted historically.
    """
    body_lower = (exc.body or "").lower()
    return any(marker in body_lower for marker in _DRIFT_ERROR_MARKERS)
