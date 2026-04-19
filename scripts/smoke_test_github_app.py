"""Live smoke test for the GitHub App client (A1.7 Phase 1 Commit 4/4).

Runs against the real GitHub API to verify that:
    1. Environment variables are set correctly (app id, installation id,
       private key).
    2. App-JWT signing works and produces a token that exchanges for an
       installation token.
    3. REST + GraphQL calls against the configured repository succeed.
    4. (Optional) createCommitOnBranch produces a GitHub-Verified commit.

Run with:
    .venv/bin/python scripts/smoke_test_github_app.py [--with-write]

By default the write test is OFF — it creates a throwaway branch and a
trivial commit, then deletes the branch. Pass `--with-write` to include
it. This is the one path that cannot be validated from unit tests
because the "Verified" badge is produced by GitHub's signing
infrastructure and only appears on App-installation-authored commits.

The script reads configuration from environment. If you have a local
.env file with the GITHUB_APP_* vars (as set up during A1.7 Phase 1),
source it before running or let python-dotenv auto-load:
    set -a && source .env && set +a && .venv/bin/python scripts/...
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import os
import sys
from pathlib import Path


def _load_env_file() -> None:
    """Best-effort load of .env, similar to FastAPI's dev-mode convention.

    We don't import python-dotenv at module scope to keep the import
    fast when env is already populated (e.g. in Railway).
    """
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if not env_path.exists():
        return
    try:
        from dotenv import load_dotenv  # type: ignore[import-not-found]

        load_dotenv(env_path, override=False)
    except ImportError:
        # Fall back to a minimal hand-rolled parser that tolerates the
        # project's .env quirks (SMTP_FROM has `<>` chars that the shell
        # treats as redirects when sourced).
        for raw_line in env_path.read_text().splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())


_load_env_file()


# Import AFTER env is loaded — the service constructor inspects env at
# instantiation time.
from backend.services.github_app import (  # noqa: E402
    GitHubAPIError,
    GitHubAppClient,
    GitHubAppConfigError,
)


def _ok(msg: str) -> None:
    print(f"  \033[32m✓\033[0m {msg}")


def _fail(msg: str) -> None:
    print(f"  \033[31m✗\033[0m {msg}")


def _info(msg: str) -> None:
    print(f"  \033[36m→\033[0m {msg}")


def _section(title: str) -> None:
    print(f"\n\033[1m{title}\033[0m")


async def _check_read_path(client: GitHubAppClient, owner: str, repo: str) -> None:
    """Token exchange + REST + GraphQL round-trip, read-only."""
    _section("1. Installation-token exchange")
    token = await client.get_installation_token()
    _ok(f"Token acquired: {token[:12]}… ({len(token)} chars)")

    _section(f"2. REST: /repos/{owner}/{repo}")
    repo_data = await client.rest("GET", f"/repos/{owner}/{repo}")
    _ok(f"Repo full_name = {repo_data.get('full_name')}")
    _info(f"default_branch = {repo_data.get('default_branch')}")
    _info(f"private = {repo_data.get('private')}")
    if repo_data.get("full_name") != f"{owner}/{repo}":
        raise AssertionError(
            f"Unexpected repo full_name: {repo_data.get('full_name')}",
        )

    _section("3. GraphQL: viewer + rateLimit")
    gql_data = await client.graphql(
        """
        query {
            viewer {
                login
            }
            rateLimit {
                remaining
                resetAt
                limit
            }
        }
        """
    )
    viewer = gql_data["data"]["viewer"]["login"]
    rate = gql_data["data"]["rateLimit"]
    _ok(f"viewer.login = {viewer}")
    _info(
        f"rateLimit: {rate['remaining']}/{rate['limit']} "
        f"remaining (resets at {rate['resetAt']})",
    )


async def _check_write_path(client: GitHubAppClient, owner: str, repo: str) -> None:
    """Create a throwaway branch + commit via createCommitOnBranch, verify
    the Verified badge, then delete the branch.

    Uses a smoke-test file at `.github/smoke-tests/<timestamp>.txt`
    that wouldn't conflict with any real content.
    """
    import time

    ts = int(time.time())
    branch_name = f"smoke-test/github-app-{ts}"
    file_path = f".github/smoke-tests/{ts}.txt"
    file_content = f"GitHub App smoke test — written at unix {ts}.\n"

    _section(f"4. Write-path smoke: create branch {branch_name}")

    # Step 1: fetch main's latest commit SHA (needed as base for new branch).
    main_ref = await client.rest("GET", f"/repos/{owner}/{repo}/git/ref/heads/main")
    base_sha = main_ref["object"]["sha"]
    _info(f"main @ {base_sha[:10]}")

    # Step 2: create the branch.
    await client.rest(
        "POST",
        f"/repos/{owner}/{repo}/git/refs",
        json_body={
            "ref": f"refs/heads/{branch_name}",
            "sha": base_sha,
        },
    )
    _ok(f"Branch {branch_name} created")

    # Step 3: createCommitOnBranch — THE call that produces a Verified commit.
    # Uses `repositoryNameWithOwner` rather than node ID so we skip a query.
    b64_content = base64.b64encode(file_content.encode("utf-8")).decode("ascii")
    mutation = """
    mutation($input: CreateCommitOnBranchInput!) {
        createCommitOnBranch(input: $input) {
            commit {
                url
                oid
                signature {
                    isValid
                    state
                    wasSignedByGitHub
                }
            }
        }
    }
    """
    variables = {
        "input": {
            "branch": {
                "repositoryNameWithOwner": f"{owner}/{repo}",
                "branchName": branch_name,
            },
            "message": {
                "headline": f"smoke: github-app verification ({ts})",
            },
            "fileChanges": {
                "additions": [
                    {"path": file_path, "contents": b64_content},
                ],
            },
            "expectedHeadOid": base_sha,
        },
    }
    commit_result = await client.graphql(mutation, variables=variables)
    commit = commit_result["data"]["createCommitOnBranch"]["commit"]
    _ok(f"Commit created: {commit['oid'][:10]}")
    _info(f"URL: {commit['url']}")

    sig = commit.get("signature") or {}
    _section("5. Verified badge check")
    if sig.get("isValid") and sig.get("wasSignedByGitHub"):
        _ok(f"Signature isValid = True, state = {sig.get('state')}")
    else:
        _fail(f"Signature did NOT get the Verified badge: {sig}")
        raise AssertionError("Verified badge missing on App-authored commit.")

    # Step 6: clean up the branch.
    _section("6. Cleanup: delete branch")
    await client.rest(
        "DELETE",
        f"/repos/{owner}/{repo}/git/refs/heads/{branch_name}",
    )
    _ok(f"Branch {branch_name} deleted")
    _info(
        f"Note: commit {commit['oid'][:10]} is now orphaned; GitHub will "
        "garbage-collect it eventually. The smoke-test file never landed "
        "on main.",
    )


async def _main(with_write: bool) -> int:
    owner = os.environ.get("GITHUB_REPO_OWNER")
    repo = os.environ.get("GITHUB_REPO_NAME")
    if not owner or not repo:
        print("ERROR: GITHUB_REPO_OWNER and GITHUB_REPO_NAME must be set.")
        return 2

    print(f"Smoke test target: \033[1m{owner}/{repo}\033[0m")
    print(f"Write-path test:   {'ENABLED' if with_write else 'skipped'}")

    try:
        client = GitHubAppClient()
    except GitHubAppConfigError as exc:
        print(f"\033[31mConfig error:\033[0m {exc}")
        return 2

    try:
        await _check_read_path(client, owner, repo)
        if with_write:
            await _check_write_path(client, owner, repo)
    except GitHubAPIError as exc:
        print(f"\n\033[31mGitHub API failure:\033[0m {exc}")
        return 1
    except AssertionError as exc:
        print(f"\n\033[31mAssertion failure:\033[0m {exc}")
        return 1

    print("\n\033[1;32mAll smoke checks passed.\033[0m")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Live smoke test for the GitHub App client.",
    )
    parser.add_argument(
        "--with-write",
        action="store_true",
        help="Also exercise createCommitOnBranch + verified-badge check. "
        "Creates and deletes a throwaway branch; never touches main.",
    )
    args = parser.parse_args()
    sys.exit(asyncio.run(_main(with_write=args.with_write)))
