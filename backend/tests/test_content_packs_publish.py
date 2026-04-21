"""Unit tests for backend/services/content_packs/publish.py.

Mocks supabase + GitHubAppClient. Covers:
    - happy path: 2 drafts → branch + commit + PR + bulk-published
    - input guards: empty draft_ids, missing env, missing draft, wrong status
    - YAML rendering: deterministic, Unicode preserved, block style
    - file path builder: rejects sub-resource notation
    - branch naming: timestamp + random suffix unique
    - drift detection: createCommitOnBranch errors map to mark_conflict_bulk
    - commit message: 1-draft vs N-draft headlines
"""

from __future__ import annotations

import base64
from datetime import UTC, datetime
from typing import Any
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID, uuid4

import pytest
import yaml
from fastapi import HTTPException, status

from backend.models.content_drafts import (
    BatchPublishResult,
    ContentDraftStatus,
)
from backend.services.content_packs.publish import (
    ContentPacksPublishService,
    _is_drift_error,
    _make_branch_name,
    _make_commit_message,
    build_file_path,
    render_yaml,
)
from backend.services.github_app import GitHubAPIError

# ── Test helpers ──────────────────────────────────────────────────────────


def _draft_row(
    *,
    draft_id: UUID | None = None,
    pack_slug: str = "shadow",
    resource_path: str = "banter",
    status: ContentDraftStatus = ContentDraftStatus.DRAFT,
    working_content: dict | None = None,
    pr_number: int | None = None,
) -> dict[str, Any]:
    """Construct a content_drafts row dict for mock responses."""
    now = datetime.now(UTC).isoformat()
    return {
        "id": str(draft_id or uuid4()),
        "author_id": str(uuid4()),
        "pack_slug": pack_slug,
        "resource_path": resource_path,
        "base_sha": None,
        "base_content": {"schema_version": 1, "banter": []},
        "working_content": working_content
        or {
            "schema_version": 1,
            "banter": [
                {
                    "id": "sb_01",
                    "trigger": "room_entered",
                    "text_de": "Etwas Neues",
                }
            ],
        },
        "status": status.value,
        "version": 1,
        "expected_head_oid": None,
        "commit_sha": None,
        "pr_number": pr_number,
        "pr_url": None,
        "created_at": now,
        "updated_at": now,
        "published_at": None,
        "merged_at": None,
    }


def _exec_result(*, data: list[dict] | None) -> MagicMock:
    result = MagicMock()
    result.data = data or []
    result.count = None
    return result


def _mock_supabase(execute_results: list[MagicMock]) -> MagicMock:
    """Builder-style supabase mock with all needed chain methods."""
    mock = MagicMock()
    chain = MagicMock()
    for method in (
        "select", "insert", "update", "delete",
        "eq", "in_", "is_", "order", "range", "limit",
    ):
        getattr(chain, method).return_value = chain
    chain.execute = AsyncMock(side_effect=execute_results)
    mock.table.return_value = chain
    return mock


def _mock_github_client(
    *,
    default_branch: str = "main",
    head_oid: str = "abc123headoid",
    commit_oid: str = "def456commit",
    pr_number: int = 42,
    pr_url: str = "https://github.com/mleihs/metaverse-center/pull/42",
    migrations_listing: list | None = None,
    rest_side_effects: list | None = None,
    graphql_side_effects: list | None = None,
) -> MagicMock:
    """Mock GitHubAppClient with rest() + graphql() coroutines.

    Default behavior (Phase 2.5 REST sequence):
      1. GET /repos/.../<repo>              → {"default_branch": <name>}
      2. GET /repos/.../git/ref/heads/X     → {"object": {"sha": <head_oid>}}
      3. GET /repos/.../contents/supabase/migrations?ref=X → migrations listing
      4. POST /repos/.../git/refs           → {"ref": ..., "object": {...}}
      5. POST /repos/.../pulls              → {"number": ..., "html_url": ...}

    GraphQL:
      - createCommitOnBranch mutation → {"data": {...commit.oid ...}}

    Override via `migrations_listing` (just the listing), or by passing a full
    `rest_side_effects` list to inject arbitrary mid-flow behavior.
    """
    client = MagicMock()
    if migrations_listing is None:
        migrations_listing = [
            {"type": "file", "name": "20260419100000_222_dungeon_content.sql"},
            {"type": "file", "name": "20260419300000_224_content_drafts.sql"},
            {"type": "file", "name": "20260419310000_225_invariants.sql"},
            {"type": "file", "name": "20260419400000_226_trigger.sql"},
        ]
    if rest_side_effects is None:
        # Dict-returning endpoints in publish order: repo metadata → ref
        # SHA → create branch → open PR. The `/contents/` list now routes
        # through `rest_list` (see `migrations_listing` below).
        rest_side_effects = [
            {"default_branch": default_branch},
            {"object": {"sha": head_oid}},
            {"ref": f"refs/heads/{default_branch}", "object": {"sha": head_oid}},
            {"number": pr_number, "html_url": pr_url},
        ]
    if graphql_side_effects is None:
        graphql_side_effects = [
            {
                "data": {
                    "createCommitOnBranch": {
                        "commit": {"oid": commit_oid, "url": "..."}
                    }
                }
            }
        ]
    client.rest = AsyncMock(side_effect=rest_side_effects)
    client.rest_list = AsyncMock(side_effect=[migrations_listing])
    client.graphql = AsyncMock(side_effect=graphql_side_effects)
    return client


def _stub_migration_sql(monkeypatch) -> None:
    """Replace _generate_migration_sql with a stub returning inert SQL.

    Unit tests for publish_batch orchestration don't exercise real packs;
    the end-to-end test in TestMigrationAttachment covers real generation.
    """
    from backend.services.content_packs import publish as _pub
    monkeypatch.setattr(
        _pub, "_generate_migration_sql", lambda drafts: "-- stub migration\n",
    )


# ── Pure helpers ──────────────────────────────────────────────────────────


class TestBuildFilePath:
    def test_well_formed_pair(self):
        path = build_file_path("shadow", "banter")
        assert path == "content/dungeon/archetypes/shadow/banter.yaml"

    def test_archetype_with_underscores(self):
        path = build_file_path("agent_bonds", "encounters")
        assert path == "content/dungeon/archetypes/agent_bonds/encounters.yaml"

    @pytest.mark.parametrize(
        "school",
        ["assassin", "guardian", "infiltrator", "propagandist", "saboteur", "spy", "universal"],
    )
    def test_abilities_slug_routes_to_flat_dir(self, school):
        """pack_slug="abilities" skips the archetype sub-directory.

        The abilities namespace is flat — one YAML per school, no nesting.
        `build_file_path` must collapse `(abilities, <school>)` to
        `content/dungeon/abilities/<school>.yaml`, not `archetypes/abilities/<school>.yaml`.
        """
        path = build_file_path("abilities", school)
        assert path == f"content/dungeon/abilities/{school}.yaml"

    def test_abilities_rejects_bracket_notation(self):
        """Phase-2 resource_path regex applies equally to abilities packs.

        The regex gate is on resource_path (not on pack_slug), so bracket
        sub-resource notation is rejected whether or not the slug is the
        abilities sentinel. Ensures the ability publish flow can't bypass
        the Phase-2 guard via a flat-dir path.
        """
        with pytest.raises(HTTPException) as exc_info:
            build_file_path("abilities", "spy[strike_01]")
        assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.parametrize(
        "bad_resource_path",
        [
            "banter[ab_01]",        # bracket sub-resource notation
            "banter.yaml",          # caller pre-suffixed
            "encounters/sub",       # slash
            "Banter",               # uppercase
            "banter-1",             # hyphen
            "1banter",              # leading digit
            "banter.choices",       # dotted path
            "",                     # empty
        ],
    )
    def test_rejects_phase5_or_invalid_resource_path(self, bad_resource_path):
        with pytest.raises(HTTPException) as exc_info:
            build_file_path("shadow", bad_resource_path)
        assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST


class TestRenderYaml:
    def test_block_style_unicode_trailing_newline(self):
        content = {
            "schema_version": 1,
            "banter": [
                {"id": "sb_01", "text_de": "Schöne Grüße »ohne« ASCII"}
            ],
        }
        rendered = render_yaml(content)
        assert rendered.endswith("\n")
        # Block style preserved (no flow-style brackets at top level).
        assert "{" not in rendered.splitlines()[0]
        # Unicode preserved (no \uXXXX escaping).
        assert "Schöne Grüße »ohne« ASCII" in rendered
        # Round-trip: parsed YAML matches input.
        assert yaml.safe_load(rendered) == content

    def test_key_order_preserved(self):
        content = {"zebra": 1, "apple": 2, "mango": 3}
        rendered = render_yaml(content)
        # safe_dump with sort_keys=False emits keys in insertion order.
        keys_in_order = [
            line.split(":")[0].strip()
            for line in rendered.splitlines()
            if line and not line.startswith(" ")
        ]
        assert keys_in_order == ["zebra", "apple", "mango"]


class TestMakeBranchName:
    def test_format_and_uniqueness(self):
        a = _make_branch_name()
        b = _make_branch_name()
        assert a != b
        # Format: content/drafts-batch-YYYYMMDD-HHMMSS-XXXXXXXX
        assert a.startswith("content/drafts-batch-")
        suffix = a.removeprefix("content/drafts-batch-")
        ts_part, _, hex_part = suffix.rpartition("-")
        assert len(hex_part) == 8
        assert all(c in "0123456789abcdef" for c in hex_part)
        # Timestamp portion parses.
        datetime.strptime(ts_part, "%Y%m%d-%H%M%S")  # noqa: DTZ007


class TestMakeCommitMessage:
    def test_single_draft_headline(self):
        draft = MagicMock()
        draft.pack_slug = "shadow"
        draft.resource_path = "banter"
        draft.id = uuid4()
        headline, body = _make_commit_message([draft], None)
        assert headline == "content(shadow): update banter"
        assert "shadow/banter.yaml" in body

    def test_multi_draft_headline(self):
        drafts = []
        for slug in ("shadow", "tower", "deluge"):
            d = MagicMock()
            d.pack_slug = slug
            d.resource_path = "banter"
            d.id = uuid4()
            drafts.append(d)
        headline, body = _make_commit_message(drafts, None)
        assert headline == "content: publish 3 drafts"
        assert body.count("\n- ") == 3

    def test_custom_headline_overrides(self):
        d = MagicMock()
        d.pack_slug = "shadow"
        d.resource_path = "banter"
        d.id = uuid4()
        headline, body = _make_commit_message([d], "fix: typo in shadow banter")
        assert headline == "fix: typo in shadow banter"
        # Body still derived from drafts.
        assert "shadow/banter.yaml" in body


class TestIsDriftError:
    @pytest.mark.parametrize(
        "body",
        [
            "expected head oid did not match",
            "Branch was modified during commit",
            "Update is not a fast forward",
            "EXPECTED HEAD OID mismatch",  # case-insensitive
        ],
    )
    def test_recognizes_drift_markers(self, body):
        exc = GitHubAPIError(200, body, "https://api.github.com/graphql")
        assert _is_drift_error(exc) is True

    def test_rejects_unrelated_errors(self):
        exc = GitHubAPIError(403, "rate limit exceeded", "https://...")
        assert _is_drift_error(exc) is False


# ── publish_batch ─────────────────────────────────────────────────────────


class TestPublishBatch:
    async def test_happy_path_two_drafts(self, monkeypatch):
        monkeypatch.setenv("GITHUB_REPO_OWNER", "mleihs")
        monkeypatch.setenv("GITHUB_REPO_NAME", "metaverse-center")
        _stub_migration_sql(monkeypatch)

        d1_id, d2_id = uuid4(), uuid4()
        d1 = _draft_row(draft_id=d1_id, pack_slug="shadow", resource_path="banter")
        d2 = _draft_row(draft_id=d2_id, pack_slug="tower", resource_path="encounters")

        # Supabase calls (in order):
        #   1) _fetch_and_validate_drafts: SELECT
        #   2) mark_published_bulk: UPDATE (no .data needed)
        #   3) mark_published_bulk: SELECT (re-fetch)
        published_d1 = _draft_row(
            draft_id=d1_id, pack_slug="shadow", resource_path="banter",
            status=ContentDraftStatus.PUBLISHED, pr_number=42,
        )
        published_d2 = _draft_row(
            draft_id=d2_id, pack_slug="tower", resource_path="encounters",
            status=ContentDraftStatus.PUBLISHED, pr_number=42,
        )
        supabase = _mock_supabase([
            _exec_result(data=[d1, d2]),
            _exec_result(data=[]),
            _exec_result(data=[published_d1, published_d2]),
        ])

        client = _mock_github_client()
        result = await ContentPacksPublishService.publish_batch(
            supabase, draft_ids=[d1_id, d2_id], github_client=client,
        )
        assert isinstance(result, BatchPublishResult)
        assert result.commit_sha == "def456commit"
        assert result.pr_number == 42
        assert result.draft_count == 2
        assert result.branch_name.startswith("content/drafts-batch-")
        # Verify createCommitOnBranch fileChanges had THREE additions in order:
        # two YAML files + one auto-generated migration.
        graphql_call = client.graphql.call_args
        additions = graphql_call.args[1]["input"]["fileChanges"]["additions"]
        assert len(additions) == 3
        assert additions[0]["path"] == "content/dungeon/archetypes/shadow/banter.yaml"
        assert additions[1]["path"] == "content/dungeon/archetypes/tower/encounters.yaml"
        # Migration file name follows {timestamp}_{NNN}_dungeon_content_seed_auto.sql.
        # Max in default mock listing is 226, so next is 227.
        assert additions[2]["path"].startswith("supabase/migrations/")
        assert additions[2]["path"].endswith("_227_dungeon_content_seed_auto.sql")
        # Migration content is the stub SQL (monkeypatched above).
        decoded_migration = base64.b64decode(additions[2]["contents"]).decode("utf-8")
        assert decoded_migration == "-- stub migration\n"
        # YAML Contents are base64 of YAML bytes.
        decoded_0 = base64.b64decode(additions[0]["contents"]).decode("utf-8")
        assert "schema_version: 1" in decoded_0
        assert "banter:" in decoded_0

    async def test_empty_draft_ids_raises_400(self, monkeypatch):
        monkeypatch.setenv("GITHUB_REPO_OWNER", "x")
        monkeypatch.setenv("GITHUB_REPO_NAME", "y")
        supabase = _mock_supabase([])
        with pytest.raises(HTTPException) as exc_info:
            await ContentPacksPublishService.publish_batch(
                supabase, draft_ids=[], github_client=_mock_github_client(),
            )
        assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST

    async def test_missing_env_vars_raises_400(self, monkeypatch):
        monkeypatch.delenv("GITHUB_REPO_OWNER", raising=False)
        monkeypatch.delenv("GITHUB_REPO_NAME", raising=False)
        supabase = _mock_supabase([])
        with pytest.raises(HTTPException) as exc_info:
            await ContentPacksPublishService.publish_batch(
                supabase,
                draft_ids=[uuid4()],
                github_client=_mock_github_client(),
            )
        assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST

    async def test_missing_draft_raises_404(self, monkeypatch):
        monkeypatch.setenv("GITHUB_REPO_OWNER", "x")
        monkeypatch.setenv("GITHUB_REPO_NAME", "y")
        d_id = uuid4()
        # SELECT returns 0 rows → all draft_ids are "missing".
        supabase = _mock_supabase([_exec_result(data=[])])
        with pytest.raises(HTTPException) as exc_info:
            await ContentPacksPublishService.publish_batch(
                supabase,
                draft_ids=[d_id],
                github_client=_mock_github_client(),
            )
        assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND

    async def test_wrong_status_raises_409(self, monkeypatch):
        monkeypatch.setenv("GITHUB_REPO_OWNER", "x")
        monkeypatch.setenv("GITHUB_REPO_NAME", "y")
        d_id = uuid4()
        already_published = _draft_row(
            draft_id=d_id, status=ContentDraftStatus.PUBLISHED,
        )
        supabase = _mock_supabase([_exec_result(data=[already_published])])
        with pytest.raises(HTTPException) as exc_info:
            await ContentPacksPublishService.publish_batch(
                supabase,
                draft_ids=[d_id],
                github_client=_mock_github_client(),
            )
        assert exc_info.value.status_code == status.HTTP_409_CONFLICT

    async def test_drift_marks_conflict_and_raises_409(self, monkeypatch):
        monkeypatch.setenv("GITHUB_REPO_OWNER", "x")
        monkeypatch.setenv("GITHUB_REPO_NAME", "y")
        _stub_migration_sql(monkeypatch)
        d_id = uuid4()
        draft = _draft_row(draft_id=d_id, pack_slug="shadow", resource_path="banter")
        conflict_row = _draft_row(
            draft_id=d_id, pack_slug="shadow", resource_path="banter",
            status=ContentDraftStatus.CONFLICT,
        )

        # Supabase calls:
        #   1) _fetch_and_validate_drafts: SELECT
        #   2) mark_conflict_bulk: UPDATE
        #   3) mark_conflict_bulk: SELECT re-fetch
        supabase = _mock_supabase([
            _exec_result(data=[draft]),
            _exec_result(data=[]),
            _exec_result(data=[conflict_row]),
        ])

        # GitHub: head + ref + branch creation succeed (migrations listing
        # goes through `rest_list`); createCommitOnBranch raises a drift error.
        drift_exc = GitHubAPIError(
            200, "expected head oid did not match", "https://api.github.com/graphql",
        )
        rest_side = [
            {"default_branch": "main"},
            {"object": {"sha": "headsha"}},
            {"ref": "refs/heads/x", "object": {"sha": "headsha"}},
        ]
        client = _mock_github_client(
            rest_side_effects=rest_side,
            graphql_side_effects=[drift_exc],
        )

        with pytest.raises(HTTPException) as exc_info:
            await ContentPacksPublishService.publish_batch(
                supabase, draft_ids=[d_id], github_client=client,
            )
        assert exc_info.value.status_code == status.HTTP_409_CONFLICT
        # PR creation MUST NOT have been attempted (head + head_oid + branch
        # creation = 3 dict-returning calls; migrations listing is in `rest_list`).
        assert client.rest.call_count == 3
        assert client.rest_list.call_count == 1

    async def test_non_drift_github_error_bubbles(self, monkeypatch):
        monkeypatch.setenv("GITHUB_REPO_OWNER", "x")
        monkeypatch.setenv("GITHUB_REPO_NAME", "y")
        _stub_migration_sql(monkeypatch)
        d_id = uuid4()
        draft = _draft_row(draft_id=d_id, pack_slug="shadow", resource_path="banter")
        supabase = _mock_supabase([_exec_result(data=[draft])])

        rate_limit_exc = GitHubAPIError(
            403, "API rate limit exceeded", "https://api.github.com/graphql",
        )
        rest_side = [
            {"default_branch": "main"},
            {"object": {"sha": "headsha"}},
            {"ref": "refs/heads/x", "object": {"sha": "headsha"}},
        ]
        client = _mock_github_client(
            rest_side_effects=rest_side,
            graphql_side_effects=[rate_limit_exc],
        )
        with pytest.raises(GitHubAPIError):
            await ContentPacksPublishService.publish_batch(
                supabase, draft_ids=[d_id], github_client=client,
            )

    async def test_invalid_resource_path_raises_400_no_branch_created(self, monkeypatch):
        """Sub-resource notation passes the model regex but fails at publish.

        Critical invariant: validation runs BEFORE _create_branch so an
        invalid path can never leave an orphan branch on the repo. We assert
        client.rest.call_count == 2 (only default-branch discovery + ref fetch
        ran; the POST /git/refs branch creation never happened).
        """
        monkeypatch.setenv("GITHUB_REPO_OWNER", "x")
        monkeypatch.setenv("GITHUB_REPO_NAME", "y")
        d_id = uuid4()
        bad_draft = _draft_row(
            draft_id=d_id, pack_slug="shadow", resource_path="banter[sb_01]",
        )
        supabase = _mock_supabase([_exec_result(data=[bad_draft])])
        rest_side = [
            {"default_branch": "main"},
            {"object": {"sha": "headsha"}},
        ]
        client = _mock_github_client(rest_side_effects=rest_side)
        with pytest.raises(HTTPException) as exc_info:
            await ContentPacksPublishService.publish_batch(
                supabase, draft_ids=[d_id], github_client=client,
            )
        assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
        # No branch creation, no commit, no PR.
        # yaml_changes runs first (Phase-2 regex fires) BEFORE migration
        # listing, so only 2 REST calls: default-branch + head-oid.
        assert client.rest.call_count == 2
        assert client.graphql.call_count == 0


class TestPhase25MigrationAttachment:
    """Phase-2.5-specific coverage: auto-generated migration in the commit."""

    async def test_duplicate_resource_rejects_400(self, monkeypatch):
        """Two drafts for the same (slug, path) in a batch → 400 before any GitHub call."""
        monkeypatch.setenv("GITHUB_REPO_OWNER", "x")
        monkeypatch.setenv("GITHUB_REPO_NAME", "y")
        d1_id, d2_id = uuid4(), uuid4()
        # Both drafts target (shadow, banter) — duplicate.
        d1 = _draft_row(draft_id=d1_id, pack_slug="shadow", resource_path="banter")
        d2 = _draft_row(draft_id=d2_id, pack_slug="shadow", resource_path="banter")
        supabase = _mock_supabase([_exec_result(data=[d1, d2])])
        client = _mock_github_client()

        with pytest.raises(HTTPException) as exc_info:
            await ContentPacksPublishService.publish_batch(
                supabase, draft_ids=[d1_id, d2_id], github_client=client,
            )
        assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
        # Duplicate check runs BEFORE any REST call.
        assert client.rest.call_count == 0
        assert client.graphql.call_count == 0

    async def test_pack_schema_error_returns_400_with_field_errors(
        self, monkeypatch,
    ):
        """A draft with invalid working_content fails Pydantic → 400 pre-branch.

        Real _generate_migration_sql runs; the default _draft_row fixture
        produces a BanterPack-invalid payload (missing text_en), so Pydantic
        rejects it. We assert 400 AND that no branch creation happened.
        """
        monkeypatch.setenv("GITHUB_REPO_OWNER", "x")
        monkeypatch.setenv("GITHUB_REPO_NAME", "y")
        d_id = uuid4()
        # Default working_content is BanterPack-invalid (missing text_en).
        draft = _draft_row(draft_id=d_id, pack_slug="shadow", resource_path="banter")
        supabase = _mock_supabase([_exec_result(data=[draft])])
        client = _mock_github_client()

        with pytest.raises(HTTPException) as exc_info:
            await ContentPacksPublishService.publish_batch(
                supabase, draft_ids=[d_id], github_client=client,
            )
        assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
        assert "pack validation" in str(exc_info.value.detail).lower()
        # Migration-gen runs AFTER yaml_changes but BEFORE the listing REST call;
        # so head + head_oid only, no branch creation.
        assert client.rest.call_count == 2
        assert client.graphql.call_count == 0

    async def test_migration_number_increments_from_listing(self, monkeypatch):
        """Migration filename uses max(existing NNN) + 1 from the listing."""
        monkeypatch.setenv("GITHUB_REPO_OWNER", "x")
        monkeypatch.setenv("GITHUB_REPO_NAME", "y")
        _stub_migration_sql(monkeypatch)
        d_id = uuid4()
        draft = _draft_row(draft_id=d_id, pack_slug="shadow", resource_path="banter")
        published = _draft_row(
            draft_id=d_id, pack_slug="shadow", resource_path="banter",
            status=ContentDraftStatus.PUBLISHED, pr_number=42,
        )
        supabase = _mock_supabase([
            _exec_result(data=[draft]),
            _exec_result(data=[]),
            _exec_result(data=[published]),
        ])

        # Listing with max NNN = 311 (unusual filename forms mixed in to
        # verify the parser picks the 3-digit sequence reliably).
        listing = [
            {"type": "file", "name": "20260301000000_101_old.sql"},
            {"type": "file", "name": "20260401000000_311_recent.sql"},
            {"type": "file", "name": "20260402000000_305_back_in_time.sql"},
            {"type": "dir", "name": "subdir_should_be_ignored"},
            {"type": "file", "name": "README.md"},  # no NNN, ignored
        ]
        client = _mock_github_client(migrations_listing=listing)
        await ContentPacksPublishService.publish_batch(
            supabase, draft_ids=[d_id], github_client=client,
        )

        additions = client.graphql.call_args.args[1]["input"]["fileChanges"]["additions"]
        # Last addition is the migration. Expect NNN = max(311) + 1 = 312.
        migration_path = additions[-1]["path"]
        assert migration_path.endswith("_312_dungeon_content_seed_auto.sql")
        assert migration_path.startswith("supabase/migrations/")

    async def test_migration_filename_is_timestamped(self, monkeypatch):
        """Migration filename carries a YYYYMMDDHHMMSS prefix for sortability."""
        monkeypatch.setenv("GITHUB_REPO_OWNER", "x")
        monkeypatch.setenv("GITHUB_REPO_NAME", "y")
        _stub_migration_sql(monkeypatch)
        d_id = uuid4()
        draft = _draft_row(draft_id=d_id, pack_slug="shadow", resource_path="banter")
        published = _draft_row(
            draft_id=d_id, pack_slug="shadow", resource_path="banter",
            status=ContentDraftStatus.PUBLISHED, pr_number=42,
        )
        supabase = _mock_supabase([
            _exec_result(data=[draft]),
            _exec_result(data=[]),
            _exec_result(data=[published]),
        ])
        client = _mock_github_client()
        await ContentPacksPublishService.publish_batch(
            supabase, draft_ids=[d_id], github_client=client,
        )

        additions = client.graphql.call_args.args[1]["input"]["fileChanges"]["additions"]
        migration_path = additions[-1]["path"]
        # Strip the "supabase/migrations/" prefix, then verify the 14-digit
        # timestamp + 3-digit sequence format.
        import re
        basename = migration_path.removeprefix("supabase/migrations/")
        assert re.match(
            r"^\d{14}_\d{3}_dungeon_content_seed_auto\.sql$", basename,
        ), f"unexpected filename format: {basename}"
