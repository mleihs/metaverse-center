"""GitHub App client for the A1.7 content-publishing workflow.

Responsibilities:
    - Generate short-lived app JWTs (RS256) from the installed private key.
    - Exchange app JWTs for installation tokens and cache them in-process
      with a safety-margin TTL (GitHub issues 1h tokens; we refresh at 55m).
    - Dispatch GraphQL + REST calls with single-shot 401 auto-retry.

Everything flows over HTTPS to api.github.com. No local clone, no
subprocess git, no filesystem state — fits Railway ephemeral FS.

Installation-token-issued commits from an App carry GitHub's green
"Verified" badge, which PATs and OAuth user tokens do not. This is the
primary reason the App pattern is preferred over PAT for the publish
path.

Env vars (read lazily on first instantiation — NOT at import time, so
test suites can patch):
    GITHUB_APP_ID                  — numeric, string-typed.
    GITHUB_APP_INSTALLATION_ID     — numeric, string-typed.
    GITHUB_APP_PRIVATE_KEY_B64     — preferred: base64-encoded PEM.
    GITHUB_APP_PRIVATE_KEY         — fallback: raw PEM (with literal
                                     newlines; works in dev, less
                                     robust on Railway).

See docs/concepts/a1-7-ui-research-findings.md §1 for the architecture
decision (stateless App + GraphQL) and §7.2 of the post-A1-research
resume memory for the "Verified" badge caveat.
"""

from __future__ import annotations

import asyncio
import base64
import logging
import os
import time
from dataclasses import dataclass
from typing import Any

import httpx
import jwt

logger = logging.getLogger(__name__)

# Installation tokens expire after 1h; refresh at the 55-minute mark
# to leave a comfortable retry buffer for in-flight calls.
INSTALLATION_TOKEN_TTL_SECONDS = 55 * 60

# Safety margin when reading the cached expiry: if the token has < 30s
# left, treat it as already expired to avoid handing out a token that
# dies mid-request.
TOKEN_STALE_THRESHOLD_SECONDS = 30

# App JWT lifetime (GitHub's spec maximum is 10 minutes).
APP_JWT_LIFETIME_SECONDS = 600

# Leeway on `iat` to absorb modest clock skew between this host and
# GitHub's auth servers. 60s is the common convention.
APP_JWT_IAT_LEEWAY_SECONDS = 60

_GITHUB_API_BASE = "https://api.github.com"

_COMMON_HEADERS = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}


@dataclass(slots=True)
class _CachedToken:
    value: str
    expires_at_monotonic: float


class GitHubAppError(RuntimeError):
    """Base exception for GitHub App failures."""


class GitHubAppConfigError(GitHubAppError):
    """Raised when required env vars are missing or malformed."""


class GitHubAPIError(GitHubAppError):
    """Raised on non-2xx responses from GitHub's API.

    Carries status, body, and url so callers can decide whether to
    surface the error to the admin UI or swallow + retry via a queue.
    """

    def __init__(self, status: int, body: str, url: str) -> None:
        self.status = status
        self.body = body
        self.url = url
        super().__init__(f"GitHub API {status} on {url}: {body[:500]}")


class GitHubAppClient:
    """Stateless GitHub App client with installation-token caching.

    Instantiate once per process. The cache is instance-local; multiple
    clients (e.g. across uvicorn workers) each maintain their own.
    """

    def __init__(
        self,
        *,
        app_id: str | None = None,
        installation_id: str | None = None,
        private_key_pem: bytes | None = None,
    ) -> None:
        self._app_id = app_id or self._require_env("GITHUB_APP_ID")
        self._installation_id = installation_id or self._require_env(
            "GITHUB_APP_INSTALLATION_ID",
        )
        self._private_key_pem = private_key_pem or self._load_private_key()
        self._cached_token: _CachedToken | None = None
        self._token_lock = asyncio.Lock()
        # Persistent HTTP client — created lazily on first use so that
        # instantiation in a sync context (e.g. test fixture) does not
        # require a running event loop. Closed from the FastAPI lifespan
        # shutdown hook via `close_github_app_client()` below.
        self._http: httpx.AsyncClient | None = None

    async def _get_http(self) -> httpx.AsyncClient:
        """Return the shared httpx client, instantiating on first use.

        All API calls share one client so TCP+TLS handshakes are amortized
        (publish flow makes 3-5 GraphQL calls per batch; without pooling
        each one would open a fresh connection to api.github.com).

        Per-call timeouts are passed at the `.request()` / `.post()` site,
        which overrides the client-level default — this keeps the existing
        10s token-exchange and 15s/30s REST/GraphQL budgets intact.
        """
        if self._http is None:
            self._http = httpx.AsyncClient()
        return self._http

    async def aclose(self) -> None:
        """Close the persistent httpx client.

        Idempotent. Called from the FastAPI lifespan shutdown hook; tests
        may also call it explicitly.
        """
        if self._http is not None:
            await self._http.aclose()
            self._http = None

    # ── Config helpers ────────────────────────────────────────────────

    @staticmethod
    def _require_env(name: str) -> str:
        value = os.environ.get(name)
        if not value:
            raise GitHubAppConfigError(f"Missing env var: {name}")
        return value

    @staticmethod
    def _load_private_key() -> bytes:
        """Load the PEM private key from env, preferring the B64 variant.

        Railway strips literal newlines from multi-line env vars on some
        paths; GITHUB_APP_PRIVATE_KEY_B64 sidesteps that.
        """
        b64 = os.environ.get("GITHUB_APP_PRIVATE_KEY_B64")
        if b64:
            try:
                return base64.b64decode(b64, validate=True)
            except ValueError as exc:
                raise GitHubAppConfigError(
                    "GITHUB_APP_PRIVATE_KEY_B64 is not valid base64",
                ) from exc

        pem = os.environ.get("GITHUB_APP_PRIVATE_KEY")
        if pem:
            return pem.encode("utf-8")

        raise GitHubAppConfigError(
            "Neither GITHUB_APP_PRIVATE_KEY_B64 nor GITHUB_APP_PRIVATE_KEY is set",
        )

    # ── App JWT (used only to fetch installation tokens) ──────────────

    def _generate_app_jwt(self, *, now: int | None = None) -> str:
        """Sign a short-lived RS256 JWT with the app's private key.

        Used once per installation-token refresh. The JWT is NOT used
        for general API calls — GitHub requires exchanging it for an
        installation token first.
        """
        now_ts = now if now is not None else int(time.time())
        payload = {
            "iat": now_ts - APP_JWT_IAT_LEEWAY_SECONDS,
            "exp": now_ts + APP_JWT_LIFETIME_SECONDS,
            "iss": self._app_id,
        }
        return jwt.encode(payload, self._private_key_pem, algorithm="RS256")

    # ── Installation token cache ──────────────────────────────────────

    async def get_installation_token(self, *, force_refresh: bool = False) -> str:
        """Return a valid installation token, refreshing on demand.

        The token is cached in-process. Pass `force_refresh=True` to
        bypass the cache — used by the 401-retry path after a token
        unexpectedly expires mid-flight.
        """
        async with self._token_lock:
            now = time.monotonic()
            if (
                not force_refresh
                and self._cached_token is not None
                and self._cached_token.expires_at_monotonic
                > now + TOKEN_STALE_THRESHOLD_SECONDS
            ):
                return self._cached_token.value

            app_jwt = self._generate_app_jwt()
            url = (
                f"{_GITHUB_API_BASE}/app/installations/"
                f"{self._installation_id}/access_tokens"
            )
            client = await self._get_http()
            resp = await client.post(
                url,
                headers={
                    **_COMMON_HEADERS,
                    "Authorization": f"Bearer {app_jwt}",
                },
                timeout=httpx.Timeout(10.0),
            )

            if resp.status_code != 201:
                raise GitHubAPIError(resp.status_code, resp.text, url)

            data = resp.json()
            token = data["token"]
            self._cached_token = _CachedToken(
                value=token,
                expires_at_monotonic=now + INSTALLATION_TOKEN_TTL_SECONDS,
            )
            logger.info(
                "Refreshed GitHub App installation token (installation=%s, github_expires_at=%s)",
                self._installation_id,
                data.get("expires_at"),
            )
            return token

    # ── Call dispatch (shared path for GraphQL + REST) ────────────────

    async def _request(
        self,
        *,
        method: str,
        url: str,
        json_body: dict[str, Any] | None,
        timeout_seconds: float,
    ) -> httpx.Response:
        """Send a request with installation-token auth + single 401 retry.

        Keeps graphql() and rest() DRY. On 401, refreshes the token and
        retries once. Any non-2xx result on the second attempt raises
        GitHubAPIError.
        """
        last_response: httpx.Response | None = None
        for attempt in range(2):
            token = await self.get_installation_token(
                force_refresh=(attempt == 1),
            )
            client = await self._get_http()
            resp = await client.request(
                method,
                url,
                json=json_body,
                headers={
                    **_COMMON_HEADERS,
                    "Authorization": f"Bearer {token}",
                },
                timeout=httpx.Timeout(timeout_seconds),
            )
            last_response = resp
            if resp.status_code == 401 and attempt == 0:
                logger.warning(
                    "GitHub API returned 401; refreshing token and retrying (url=%s)",
                    url,
                )
                continue
            return resp

        # Not reachable — the loop returns on attempt 1 or continues to
        # attempt 2 which always returns. Keep the check for mypy /
        # defense-in-depth.
        assert last_response is not None  # noqa: S101
        return last_response

    async def graphql(
        self,
        query: str,
        variables: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """POST a GraphQL query. Returns the parsed JSON `data` envelope.

        GraphQL can return HTTP 200 with an application-level `errors`
        array; this method surfaces those as GitHubAPIError(200, ...)
        so callers don't need to branch on the response shape.
        """
        url = f"{_GITHUB_API_BASE}/graphql"
        resp = await self._request(
            method="POST",
            url=url,
            json_body={"query": query, "variables": variables or {}},
            timeout_seconds=30.0,
        )
        if resp.status_code != 200:
            raise GitHubAPIError(resp.status_code, resp.text, url)

        data = resp.json()
        if "errors" in data:
            logger.error("GitHub GraphQL returned errors: %s", data["errors"])
            raise GitHubAPIError(200, str(data["errors"]), url)
        return data

    async def rest(
        self,
        method: str,
        path: str,
        *,
        json_body: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """REST API helper. `path` starts with `/` (e.g. `/repos/owner/name`).

        Returns parsed JSON on 2xx; empty dict on 204. Raises
        GitHubAPIError on non-2xx.
        """
        url = f"{_GITHUB_API_BASE}{path}"
        resp = await self._request(
            method=method,
            url=url,
            json_body=json_body,
            timeout_seconds=15.0,
        )
        if not (200 <= resp.status_code < 300):
            raise GitHubAPIError(resp.status_code, resp.text, url)
        if resp.status_code == 204:
            return {}
        return resp.json()


# ── Process-level singleton ──────────────────────────────────────────

_client: GitHubAppClient | None = None


def get_github_app_client() -> GitHubAppClient:
    """Return the process-wide GitHubAppClient, instantiating on first use.

    Lazy to avoid requiring env vars at module import (e.g. in test
    collection runs that don't touch the GitHub code path).
    """
    global _client
    if _client is None:
        _client = GitHubAppClient()
    return _client


async def close_github_app_client() -> None:
    """Close the module-level singleton's persistent httpx connection.

    Called from the FastAPI lifespan shutdown hook. Safe to call when the
    singleton is uninitialized (no-op).
    """
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


def reset_client_for_tests() -> None:
    """Clear the module-level singleton. Test-only helper.

    Does NOT await `aclose()` — tests use AsyncMock-patched httpx, so the
    underlying client was never opened. For real-code cleanup use
    `close_github_app_client()` from the lifespan hook instead.
    """
    global _client
    _client = None


def check_env_config() -> list[str]:
    """Return a list of missing required GITHUB_APP_* env vars.

    Used by the FastAPI lifespan startup hook to log a loud-but-non-fatal
    warning if the publish path is effectively unavailable. Empty list =
    config is complete; any entries = publishing will fail at runtime.
    """
    missing: list[str] = []
    for var in ("GITHUB_APP_ID", "GITHUB_APP_INSTALLATION_ID"):
        if not os.environ.get(var):
            missing.append(var)
    if not (
        os.environ.get("GITHUB_APP_PRIVATE_KEY_B64")
        or os.environ.get("GITHUB_APP_PRIVATE_KEY")
    ):
        missing.append("GITHUB_APP_PRIVATE_KEY_B64 (or GITHUB_APP_PRIVATE_KEY)")
    return missing
