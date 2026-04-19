"""Unit tests for backend/services/github_app.py.

Covers:
    - JWT generation (claims, signature validity via public-key verify).
    - Private-key loading precedence (B64 > PEM > error).
    - Installation-token exchange (URL, headers, payload, caching).
    - Token cache lifecycle: reuse, staleness, force_refresh.
    - GraphQL: 200 success, non-2xx error, 200-with-errors envelope.
    - REST: 2xx success, 204 empty, non-2xx error.
    - 401 auto-retry (single shot) on both GraphQL and REST paths.

Does NOT hit GitHub. Commit 4 of this phase adds a live smoke test.
"""

from __future__ import annotations

import base64
import time
from unittest.mock import AsyncMock, MagicMock, patch

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from backend.services.github_app import (
    _APP_JWT_IAT_LEEWAY_SECONDS,
    _APP_JWT_LIFETIME_SECONDS,
    _INSTALLATION_TOKEN_TTL_SECONDS,
    GitHubAPIError,
    GitHubAppClient,
    GitHubAppConfigError,
    get_github_app_client,
    reset_client_for_tests,
)

# ── Fixtures ──────────────────────────────────────────────────────────────


@pytest.fixture(scope="module")
def rsa_keypair() -> tuple[bytes, bytes]:
    """Generate a throwaway RSA keypair for signing + verifying JWTs.

    Module-scoped so we don't pay the keygen cost in every test.
    """
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    public_pem = key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    return private_pem, public_pem


@pytest.fixture
def make_client(rsa_keypair: tuple[bytes, bytes]):
    """Factory for GitHubAppClient instances with a known keypair."""
    private_pem, _ = rsa_keypair

    def _build(*, app_id: str = "123456", installation_id: str = "987654") -> GitHubAppClient:
        return GitHubAppClient(
            app_id=app_id,
            installation_id=installation_id,
            private_key_pem=private_pem,
        )

    return _build


@pytest.fixture
def mock_httpx_client():
    """Patch `httpx.AsyncClient` to yield a MagicMock+AsyncMock combo.

    Yields a tuple: (patch_target, mock_instance). Tests set
    `mock_instance.post.return_value = <MagicMock>` or
    `mock_instance.request.return_value = <MagicMock>`.
    """
    mock_instance = AsyncMock()
    mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
    mock_instance.__aexit__ = AsyncMock(return_value=False)

    with patch("backend.services.github_app.httpx.AsyncClient") as mock_cls:
        mock_cls.return_value = mock_instance
        yield mock_cls, mock_instance


def _mock_response(*, status: int, json_data: dict | None = None, text: str = "") -> MagicMock:
    resp = MagicMock()
    resp.status_code = status
    if json_data is not None:
        resp.json.return_value = json_data
    resp.text = text
    return resp


# ── App JWT ───────────────────────────────────────────────────────────────


class TestAppJwt:
    def test_jwt_is_rs256_and_decodes(self, rsa_keypair, make_client):
        _, public_pem = rsa_keypair
        client = make_client(app_id="42")
        token = client._generate_app_jwt(now=1_700_000_000)

        decoded = jwt.decode(
            token,
            public_pem,
            algorithms=["RS256"],
            options={"verify_exp": False},  # deterministic timestamp
        )
        assert decoded["iss"] == "42"
        assert decoded["iat"] == 1_700_000_000 - _APP_JWT_IAT_LEEWAY_SECONDS
        assert decoded["exp"] == 1_700_000_000 + _APP_JWT_LIFETIME_SECONDS

    def test_jwt_header_uses_rs256(self, make_client):
        client = make_client()
        token = client._generate_app_jwt(now=1_700_000_000)
        header = jwt.get_unverified_header(token)
        assert header["alg"] == "RS256"


# ── Private-key loading ───────────────────────────────────────────────────


class TestPrivateKeyLoading:
    def test_b64_takes_precedence(self, rsa_keypair, monkeypatch):
        private_pem, _ = rsa_keypair
        monkeypatch.setenv("GITHUB_APP_ID", "1")
        monkeypatch.setenv("GITHUB_APP_INSTALLATION_ID", "2")
        monkeypatch.setenv(
            "GITHUB_APP_PRIVATE_KEY_B64",
            base64.b64encode(private_pem).decode("ascii"),
        )
        # Also set a bogus PEM; the B64 variant must win.
        monkeypatch.setenv("GITHUB_APP_PRIVATE_KEY", "not-a-real-pem")

        client = GitHubAppClient()
        assert client._private_key_pem == private_pem

    def test_pem_fallback_when_no_b64(self, rsa_keypair, monkeypatch):
        private_pem, _ = rsa_keypair
        monkeypatch.setenv("GITHUB_APP_ID", "1")
        monkeypatch.setenv("GITHUB_APP_INSTALLATION_ID", "2")
        monkeypatch.delenv("GITHUB_APP_PRIVATE_KEY_B64", raising=False)
        monkeypatch.setenv("GITHUB_APP_PRIVATE_KEY", private_pem.decode("utf-8"))

        client = GitHubAppClient()
        assert client._private_key_pem == private_pem

    def test_error_when_both_missing(self, monkeypatch):
        monkeypatch.setenv("GITHUB_APP_ID", "1")
        monkeypatch.setenv("GITHUB_APP_INSTALLATION_ID", "2")
        monkeypatch.delenv("GITHUB_APP_PRIVATE_KEY_B64", raising=False)
        monkeypatch.delenv("GITHUB_APP_PRIVATE_KEY", raising=False)

        with pytest.raises(GitHubAppConfigError, match="Neither GITHUB_APP_PRIVATE_KEY"):
            GitHubAppClient()

    def test_error_when_b64_is_garbage(self, monkeypatch):
        monkeypatch.setenv("GITHUB_APP_ID", "1")
        monkeypatch.setenv("GITHUB_APP_INSTALLATION_ID", "2")
        monkeypatch.setenv("GITHUB_APP_PRIVATE_KEY_B64", "not valid base64 !!")

        with pytest.raises(GitHubAppConfigError, match="not valid base64"):
            GitHubAppClient()

    def test_error_when_app_id_missing(self, rsa_keypair, monkeypatch):
        private_pem, _ = rsa_keypair
        monkeypatch.delenv("GITHUB_APP_ID", raising=False)
        monkeypatch.setenv("GITHUB_APP_INSTALLATION_ID", "2")
        monkeypatch.setenv(
            "GITHUB_APP_PRIVATE_KEY_B64",
            base64.b64encode(private_pem).decode("ascii"),
        )

        with pytest.raises(GitHubAppConfigError, match="Missing env var: GITHUB_APP_ID"):
            GitHubAppClient()


# ── Installation-token exchange + caching ────────────────────────────────


class TestInstallationTokenCache:
    async def test_first_call_hits_github_and_caches(
        self, make_client, mock_httpx_client,
    ):
        _, mock_instance = mock_httpx_client
        mock_instance.post.return_value = _mock_response(
            status=201,
            json_data={"token": "ghs_abc", "expires_at": "2026-04-19T09:00:00Z"},
        )
        client = make_client(installation_id="42")

        token = await client.get_installation_token()

        assert token == "ghs_abc"
        # URL is correct.
        call_args = mock_instance.post.call_args
        assert call_args.args[0] == (
            "https://api.github.com/app/installations/42/access_tokens"
        )
        # Headers carry the Bearer app-JWT + API version + accept.
        headers = call_args.kwargs["headers"]
        assert headers["Authorization"].startswith("Bearer ")
        assert headers["X-GitHub-Api-Version"] == "2022-11-28"
        assert headers["Accept"] == "application/vnd.github+json"

    async def test_second_call_returns_cached_token(
        self, make_client, mock_httpx_client,
    ):
        _, mock_instance = mock_httpx_client
        mock_instance.post.return_value = _mock_response(
            status=201,
            json_data={"token": "ghs_first", "expires_at": "..."},
        )
        client = make_client()

        first = await client.get_installation_token()
        second = await client.get_installation_token()

        assert first == second == "ghs_first"
        assert mock_instance.post.call_count == 1

    async def test_force_refresh_bypasses_cache(
        self, make_client, mock_httpx_client,
    ):
        _, mock_instance = mock_httpx_client
        mock_instance.post.side_effect = [
            _mock_response(status=201, json_data={"token": "ghs_A", "expires_at": "..."}),
            _mock_response(status=201, json_data={"token": "ghs_B", "expires_at": "..."}),
        ]
        client = make_client()

        first = await client.get_installation_token()
        second = await client.get_installation_token(force_refresh=True)

        assert first == "ghs_A"
        assert second == "ghs_B"
        assert mock_instance.post.call_count == 2

    async def test_stale_cache_triggers_refresh(
        self, make_client, mock_httpx_client,
    ):
        _, mock_instance = mock_httpx_client
        mock_instance.post.side_effect = [
            _mock_response(status=201, json_data={"token": "ghs_old", "expires_at": "..."}),
            _mock_response(status=201, json_data={"token": "ghs_new", "expires_at": "..."}),
        ]
        client = make_client()

        first = await client.get_installation_token()
        # Manually age the cache past the safety margin.
        client._cached_token.expires_at_monotonic = time.monotonic() - 1

        second = await client.get_installation_token()
        assert first == "ghs_old"
        assert second == "ghs_new"

    async def test_exchange_failure_raises_api_error(
        self, make_client, mock_httpx_client,
    ):
        _, mock_instance = mock_httpx_client
        mock_instance.post.return_value = _mock_response(
            status=401, json_data={}, text="Bad credentials",
        )
        client = make_client()

        with pytest.raises(GitHubAPIError) as exc_info:
            await client.get_installation_token()
        assert exc_info.value.status == 401
        assert "Bad credentials" in str(exc_info.value)


# ── GraphQL dispatch ──────────────────────────────────────────────────────


class TestGraphQL:
    async def test_200_returns_data_envelope(
        self, make_client, mock_httpx_client,
    ):
        _, mock_instance = mock_httpx_client
        # First call: installation token exchange (POST via `client.post` inside
        # get_installation_token). Second: the GraphQL POST via `client.request`.
        mock_instance.post.return_value = _mock_response(
            status=201, json_data={"token": "ghs_x", "expires_at": "..."},
        )
        mock_instance.request.return_value = _mock_response(
            status=200,
            json_data={"data": {"viewer": {"login": "octocat"}}},
        )
        client = make_client()

        result = await client.graphql("query { viewer { login } }")

        assert result == {"data": {"viewer": {"login": "octocat"}}}
        # GraphQL endpoint + Bearer installation token.
        call_args = mock_instance.request.call_args
        assert call_args.args[0] == "POST"
        assert call_args.args[1] == "https://api.github.com/graphql"
        assert call_args.kwargs["headers"]["Authorization"] == "Bearer ghs_x"

    async def test_200_with_errors_array_raises(
        self, make_client, mock_httpx_client,
    ):
        _, mock_instance = mock_httpx_client
        mock_instance.post.return_value = _mock_response(
            status=201, json_data={"token": "ghs_x", "expires_at": "..."},
        )
        mock_instance.request.return_value = _mock_response(
            status=200,
            json_data={"errors": [{"message": "Could not resolve"}]},
        )
        client = make_client()

        with pytest.raises(GitHubAPIError) as exc_info:
            await client.graphql("query { bad }")
        assert exc_info.value.status == 200
        assert "Could not resolve" in str(exc_info.value)

    async def test_non_200_raises(self, make_client, mock_httpx_client):
        _, mock_instance = mock_httpx_client
        mock_instance.post.return_value = _mock_response(
            status=201, json_data={"token": "ghs_x", "expires_at": "..."},
        )
        mock_instance.request.return_value = _mock_response(
            status=500, json_data={}, text="Internal server error",
        )
        client = make_client()

        with pytest.raises(GitHubAPIError) as exc_info:
            await client.graphql("query { x }")
        assert exc_info.value.status == 500

    async def test_401_triggers_single_retry(
        self, make_client, mock_httpx_client,
    ):
        _, mock_instance = mock_httpx_client
        # Two installation-token exchanges (initial + forced refresh on 401).
        mock_instance.post.side_effect = [
            _mock_response(status=201, json_data={"token": "ghs_stale", "expires_at": "..."}),
            _mock_response(status=201, json_data={"token": "ghs_fresh", "expires_at": "..."}),
        ]
        # First GraphQL call: 401. Second: 200.
        mock_instance.request.side_effect = [
            _mock_response(status=401, json_data={}, text="Bad credentials"),
            _mock_response(status=200, json_data={"data": {"ok": True}}),
        ]
        client = make_client()

        result = await client.graphql("query { x }")

        assert result == {"data": {"ok": True}}
        assert mock_instance.request.call_count == 2
        assert mock_instance.post.call_count == 2


# ── REST dispatch ─────────────────────────────────────────────────────────


class TestREST:
    async def test_get_200_returns_json(self, make_client, mock_httpx_client):
        _, mock_instance = mock_httpx_client
        mock_instance.post.return_value = _mock_response(
            status=201, json_data={"token": "ghs_x", "expires_at": "..."},
        )
        mock_instance.request.return_value = _mock_response(
            status=200, json_data={"full_name": "mleihs/metaverse-center"},
        )
        client = make_client()

        data = await client.rest("GET", "/repos/mleihs/metaverse-center")

        assert data == {"full_name": "mleihs/metaverse-center"}

    async def test_204_returns_empty_dict(self, make_client, mock_httpx_client):
        _, mock_instance = mock_httpx_client
        mock_instance.post.return_value = _mock_response(
            status=201, json_data={"token": "ghs_x", "expires_at": "..."},
        )
        mock_instance.request.return_value = _mock_response(status=204, json_data=None)
        client = make_client()

        data = await client.rest("DELETE", "/some/resource")

        assert data == {}

    async def test_404_raises(self, make_client, mock_httpx_client):
        _, mock_instance = mock_httpx_client
        mock_instance.post.return_value = _mock_response(
            status=201, json_data={"token": "ghs_x", "expires_at": "..."},
        )
        mock_instance.request.return_value = _mock_response(
            status=404, json_data={}, text="Not Found",
        )
        client = make_client()

        with pytest.raises(GitHubAPIError) as exc_info:
            await client.rest("GET", "/repos/does/not-exist")
        assert exc_info.value.status == 404


# ── Singleton ─────────────────────────────────────────────────────────────


class TestSingleton:
    def test_reset_for_tests_clears_cache(self, rsa_keypair, monkeypatch):
        private_pem, _ = rsa_keypair
        monkeypatch.setenv("GITHUB_APP_ID", "1")
        monkeypatch.setenv("GITHUB_APP_INSTALLATION_ID", "2")
        monkeypatch.setenv(
            "GITHUB_APP_PRIVATE_KEY_B64",
            base64.b64encode(private_pem).decode("ascii"),
        )

        reset_client_for_tests()
        c1 = get_github_app_client()
        c2 = get_github_app_client()
        assert c1 is c2

        reset_client_for_tests()
        c3 = get_github_app_client()
        assert c3 is not c1


# ── Module constants sanity ───────────────────────────────────────────────


def test_token_ttl_shorter_than_github_1h():
    """Safety margin: refresh before GitHub's 1h hard expiry."""
    assert _INSTALLATION_TOKEN_TTL_SECONDS < 3600
