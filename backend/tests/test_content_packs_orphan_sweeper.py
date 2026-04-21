"""Unit tests for backend/services/content_packs/orphan_sweeper.py.

Mocks `GitHubAppClient.rest`. Covers:
    - Empty ref list → zero classifications, no side-effects.
    - PR open → keep (even if commit is ancient).
    - PR merged → delete (GC).
    - PR closed not merged → delete.
    - No PR + commit older than threshold → delete.
    - No PR + commit within threshold → keep (possible in-flight publish).
    - dry_run=True never issues DELETE.
    - dry_run=False issues DELETE for every 'delete' classification.
    - Delete failure per branch captured in `error`; other branches still
      classified + deleted.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import AsyncMock

import pytest

from backend.services.content_packs.orphan_sweeper import (
    DEFAULT_MIN_AGE_DAYS,
    _age_days,
    sweep_orphan_branches,
)
from backend.services.github_app import GitHubAPIError

# ── Test fixtures + helpers ───────────────────────────────────────────────

_OWNER = "mleihs"
_REPO = "velgarien-rebuild"
_NOW = datetime(2026, 4, 21, 12, 0, 0, tzinfo=UTC)


def _iso(dt: datetime) -> str:
    """Format a datetime as the ISO-8601 string GitHub returns."""
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def _ref(branch: str, sha: str = "a" * 40) -> dict[str, Any]:
    return {
        "ref": f"refs/heads/{branch}",
        "object": {"sha": sha, "type": "commit"},
    }


def _pr(
    *,
    number: int = 1,
    state: str,
    merged_at: str | None = None,
    created_at: datetime | None = None,
) -> dict[str, Any]:
    return {
        "number": number,
        "state": state,
        "merged_at": merged_at,
        "created_at": _iso(created_at or (_NOW - timedelta(days=1))),
    }


def _commit(committed_at: datetime) -> dict[str, Any]:
    return {
        "commit": {
            "committer": {"date": _iso(committed_at)},
        },
    }


def _mock_client(
    *,
    refs: list[dict[str, Any]],
    pr_by_branch: dict[str, list[dict[str, Any]]] | None = None,
    commits_by_sha: dict[str, dict[str, Any]] | None = None,
    delete_failures: set[str] | None = None,
) -> AsyncMock:
    """Build a GitHubAppClient mock whose `rest()` routes by path.

    Each `rest` invocation is dispatched to the appropriate mock payload so
    tests can set up the full sweep scenario declaratively.
    """
    pr_by_branch = pr_by_branch or {}
    commits_by_sha = commits_by_sha or {}
    delete_failures = delete_failures or set()
    delete_calls: list[str] = []

    async def fake_rest(method: str, path: str, **_: Any) -> Any:
        if method == "GET" and "/git/matching-refs/heads/" in path:
            return refs
        if method == "GET" and "/pulls?head=" in path:
            # Path: /repos/{owner}/{repo}/pulls?head={owner}:{branch}&state=all
            branch = path.split("head=")[1].split("&")[0].split(":", 1)[1]
            return pr_by_branch.get(branch, [])
        if method == "GET" and "/commits/" in path:
            sha = path.rsplit("/", 1)[-1]
            return commits_by_sha[sha]
        if method == "DELETE" and "/git/refs/heads/" in path:
            branch = path.split("/git/refs/heads/", 1)[1]
            delete_calls.append(branch)
            if branch in delete_failures:
                raise GitHubAPIError(422, "Reference does not exist", path)
            return {}
        raise AssertionError(f"Unexpected rest call: {method} {path}")

    client = AsyncMock()
    client.rest = AsyncMock(side_effect=fake_rest)
    client.delete_calls = delete_calls  # type: ignore[attr-defined]
    return client


# ── Tests ─────────────────────────────────────────────────────────────────


class TestAgeDays:
    def test_parses_zulu_iso(self) -> None:
        age = _age_days("2026-04-14T12:00:00Z", _NOW)
        assert age == 7.0

    def test_parses_offset_iso(self) -> None:
        age = _age_days("2026-04-20T12:00:00+00:00", _NOW)
        assert age == 1.0


class TestEmptyRefList:
    @pytest.mark.asyncio
    async def test_no_refs_returns_empty_result(self) -> None:
        client = _mock_client(refs=[])
        result = await sweep_orphan_branches(client, _OWNER, _REPO, dry_run=True)
        assert result.total_found == 0
        assert result.kept_count == 0
        assert result.deleted_count == 0
        assert result.branches == []


class TestSingleBranchClassification:
    @pytest.mark.asyncio
    async def test_open_pr_is_kept(self) -> None:
        branch = "content/drafts-batch-20260414-000000-deadbeef"
        client = _mock_client(
            refs=[_ref(branch)],
            pr_by_branch={branch: [_pr(number=42, state="open")]},
        )
        result = await sweep_orphan_branches(
            client, _OWNER, _REPO, dry_run=True, now=_NOW,
        )
        assert result.total_found == 1
        assert result.kept_count == 1
        assert result.deleted_count == 0
        c = result.branches[0]
        assert c.status == "keep"
        assert c.pr_number == 42
        assert c.pr_state == "open"
        assert "active review" in c.reason

    @pytest.mark.asyncio
    async def test_merged_pr_is_classified_delete(self) -> None:
        branch = "content/drafts-batch-20260401-120000-feedface"
        client = _mock_client(
            refs=[_ref(branch)],
            pr_by_branch={
                branch: [
                    _pr(
                        number=17,
                        state="closed",
                        merged_at=_iso(_NOW - timedelta(days=5)),
                    )
                ]
            },
        )
        result = await sweep_orphan_branches(
            client, _OWNER, _REPO, dry_run=True, now=_NOW,
        )
        c = result.branches[0]
        assert c.status == "delete"
        assert c.pr_state == "merged"
        assert "GC" in c.reason

    @pytest.mark.asyncio
    async def test_closed_not_merged_pr_is_classified_delete(self) -> None:
        branch = "content/drafts-batch-20260410-080000-abad1dea"
        client = _mock_client(
            refs=[_ref(branch)],
            pr_by_branch={
                branch: [_pr(number=9, state="closed", merged_at=None)]
            },
        )
        result = await sweep_orphan_branches(
            client, _OWNER, _REPO, dry_run=True, now=_NOW,
        )
        c = result.branches[0]
        assert c.status == "delete"
        assert c.pr_state == "closed"
        assert "closed without merge" in c.reason

    @pytest.mark.asyncio
    async def test_no_pr_old_commit_is_classified_delete(self) -> None:
        branch = "content/drafts-batch-20260401-000000-cafebabe"
        sha = "b" * 40
        client = _mock_client(
            refs=[_ref(branch, sha=sha)],
            commits_by_sha={sha: _commit(_NOW - timedelta(days=10))},
        )
        result = await sweep_orphan_branches(
            client, _OWNER, _REPO, dry_run=True, now=_NOW,
        )
        c = result.branches[0]
        assert c.status == "delete"
        assert c.pr_number is None
        assert c.age_days == pytest.approx(10.0)
        assert "failed publish" in c.reason

    @pytest.mark.asyncio
    async def test_no_pr_young_commit_is_kept(self) -> None:
        branch = "content/drafts-batch-20260421-115000-12345678"
        sha = "c" * 40
        client = _mock_client(
            refs=[_ref(branch, sha=sha)],
            commits_by_sha={sha: _commit(_NOW - timedelta(hours=2))},
        )
        result = await sweep_orphan_branches(
            client, _OWNER, _REPO, dry_run=True, now=_NOW,
        )
        c = result.branches[0]
        assert c.status == "keep"
        assert c.pr_number is None
        assert c.age_days < 1.0
        assert "in-flight" in c.reason

    @pytest.mark.asyncio
    async def test_min_age_days_is_configurable(self) -> None:
        branch = "content/drafts-batch-20260418-000000-11223344"
        sha = "d" * 40
        # 3 days old; default threshold 7d would keep, but with threshold=1d
        # we expect delete.
        client = _mock_client(
            refs=[_ref(branch, sha=sha)],
            commits_by_sha={sha: _commit(_NOW - timedelta(days=3))},
        )
        result = await sweep_orphan_branches(
            client, _OWNER, _REPO, dry_run=True, min_age_days=1.0, now=_NOW,
        )
        assert result.branches[0].status == "delete"


class TestDryRunVsRealDelete:
    @pytest.mark.asyncio
    async def test_dry_run_never_calls_delete(self) -> None:
        branch = "content/drafts-batch-20260401-000000-deadbeef"
        client = _mock_client(
            refs=[_ref(branch)],
            pr_by_branch={
                branch: [_pr(number=1, state="closed", merged_at=None)]
            },
        )
        result = await sweep_orphan_branches(
            client, _OWNER, _REPO, dry_run=True, now=_NOW,
        )
        assert result.deleted_count == 0
        assert not result.branches[0].deleted
        assert client.delete_calls == []  # type: ignore[attr-defined]

    @pytest.mark.asyncio
    async def test_real_run_deletes_each_orphan(self) -> None:
        branches = [
            "content/drafts-batch-20260401-000000-aaaaaaaa",
            "content/drafts-batch-20260402-000000-bbbbbbbb",
        ]
        client = _mock_client(
            refs=[_ref(b) for b in branches],
            pr_by_branch={
                branches[0]: [_pr(number=1, state="closed", merged_at=None)],
                branches[1]: [
                    _pr(
                        number=2,
                        state="closed",
                        merged_at=_iso(_NOW - timedelta(days=1)),
                    )
                ],
            },
        )
        result = await sweep_orphan_branches(
            client, _OWNER, _REPO, dry_run=False, now=_NOW,
        )
        assert result.deleted_count == 2
        assert result.error_count == 0
        assert set(client.delete_calls) == set(branches)  # type: ignore[attr-defined]

    @pytest.mark.asyncio
    async def test_delete_failure_is_captured_per_branch(self) -> None:
        branches = [
            "content/drafts-batch-20260401-000000-ffffffff",
            "content/drafts-batch-20260402-000000-eeeeeeee",
        ]
        client = _mock_client(
            refs=[_ref(b) for b in branches],
            pr_by_branch={
                branches[0]: [_pr(number=1, state="closed", merged_at=None)],
                branches[1]: [_pr(number=2, state="closed", merged_at=None)],
            },
            delete_failures={branches[0]},
        )
        result = await sweep_orphan_branches(
            client, _OWNER, _REPO, dry_run=False, now=_NOW,
        )
        # Both classified delete; one succeeded, one failed.
        assert result.total_found == 2
        assert result.deleted_count == 1
        assert result.error_count == 1
        by_name = {c.name: c for c in result.branches}
        assert by_name[branches[0]].deleted is False
        assert by_name[branches[0]].error is not None
        assert "422" in by_name[branches[0]].error
        assert by_name[branches[1]].deleted is True
        assert by_name[branches[1]].error is None


class TestMixedBatch:
    @pytest.mark.asyncio
    async def test_mixed_batch_counts_correctly(self) -> None:
        open_branch = "content/drafts-batch-20260420-000000-aaaaaaaa"
        merged_branch = "content/drafts-batch-20260410-000000-bbbbbbbb"
        closed_branch = "content/drafts-batch-20260405-000000-cccccccc"
        orphan_branch = "content/drafts-batch-20260401-000000-dddddddd"
        fresh_branch = "content/drafts-batch-20260421-115500-eeeeeeee"

        refs = [
            _ref(open_branch, sha="1" * 40),
            _ref(merged_branch, sha="2" * 40),
            _ref(closed_branch, sha="3" * 40),
            _ref(orphan_branch, sha="4" * 40),
            _ref(fresh_branch, sha="5" * 40),
        ]
        client = _mock_client(
            refs=refs,
            pr_by_branch={
                open_branch: [_pr(number=1, state="open")],
                merged_branch: [
                    _pr(
                        number=2,
                        state="closed",
                        merged_at=_iso(_NOW - timedelta(days=1)),
                    )
                ],
                closed_branch: [
                    _pr(number=3, state="closed", merged_at=None)
                ],
            },
            commits_by_sha={
                "4" * 40: _commit(_NOW - timedelta(days=20)),
                "5" * 40: _commit(_NOW - timedelta(minutes=5)),
            },
        )
        result = await sweep_orphan_branches(
            client, _OWNER, _REPO, dry_run=True, now=_NOW,
        )
        assert result.total_found == 5
        assert result.kept_count == 2  # open, fresh
        assert result.deleted_count == 0  # dry-run
        # Verify per-branch status:
        by_name = {c.name: c.status for c in result.branches}
        assert by_name[open_branch] == "keep"
        assert by_name[merged_branch] == "delete"
        assert by_name[closed_branch] == "delete"
        assert by_name[orphan_branch] == "delete"
        assert by_name[fresh_branch] == "keep"


class TestDefaultsConstant:
    def test_default_min_age_days_is_seven(self) -> None:
        # Guard against silent drift: the docstring + admin UI copy refer
        # to 7 days. Any change must be intentional + documented.
        assert DEFAULT_MIN_AGE_DAYS == 7.0
