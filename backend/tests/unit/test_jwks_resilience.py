"""Regression tests for the 2026-08-28 platform-wide 503.

What happened: Supabase's ``/auth/v1/.well-known/jwks.json`` stopped responding
(TLS established, no bytes returned) while every other endpoint on the same host
answered in ~100ms. Two properties of our own code turned that into a total
outage of metaverse.center, anonymous visitors included:

1. ``PyJWKClient`` fetches with a BLOCKING ``urllib`` call at PyJWT's default
   30s timeout, and ``get_current_user`` awaited it directly on the event loop.
   One stalled fetch froze the single-worker ASGI process: ``/api/v1/health``
   took 30s, ``/`` took 60s, the container healthcheck failed, and the proxy
   dropped the only backend.
2. ``PyJWKClient`` has no stale-while-error path. Its cache expires after
   ``lifespan`` and the next call *must* fetch; a connection error propagates.
   So an unreachable JWKS endpoint invalidates every authenticated request
   within one cache lifetime, however long the cached keys would still be valid.

These tests pin both fixes plus the timeout budget.
"""

import inspect
import time
from unittest.mock import patch

import jwt as pyjwt
import pytest

from backend import dependencies as deps


@pytest.fixture(autouse=True)
def _reset_client():
    """The JWKS client is a process-wide singleton; don't leak it between tests."""
    original = deps._jwks_client
    deps._jwks_client = None
    yield
    deps._jwks_client = original


JWK_SET = {
    "keys": [
        {
            "kty": "EC",
            "crv": "P-256",
            "kid": "test-key",
            "use": "sig",
            "x": "f83OJ3D2xF1Bg8vub9tLe1gHMzV76e8Tus9uPHvRVEU",
            "y": "x_FEzRu9m36HLN_tue659LNpXW6pCyStikYjKIWI5a0",
        }
    ]
}


def test_stale_key_set_is_served_when_the_endpoint_is_unreachable():
    client = deps._ResilientJWKClient("https://example.test/jwks.json", lifespan=1)

    with patch.object(pyjwt.PyJWKClient, "fetch_data", return_value=JWK_SET):
        assert client.fetch_data() == JWK_SET

    # Endpoint goes dark. The cached set must keep verifying tokens rather than
    # logging every user out because a third party is unreachable.
    with patch.object(
        pyjwt.PyJWKClient,
        "fetch_data",
        side_effect=pyjwt.PyJWKClientConnectionError("read operation timed out"),
    ):
        assert client.fetch_data() == JWK_SET


def test_connection_error_propagates_when_nothing_was_ever_cached():
    """A cold start against a dead endpoint must fail loudly, not invent a key set."""
    client = deps._ResilientJWKClient("https://example.test/jwks.json", lifespan=1)

    with patch.object(
        pyjwt.PyJWKClient,
        "fetch_data",
        side_effect=pyjwt.PyJWKClientConnectionError("read operation timed out"),
    ):
        with pytest.raises(pyjwt.PyJWKClientConnectionError):
            client.fetch_data()


def test_stale_fallback_survives_cache_expiry():
    """The failure mode was TTL-driven: fine for `lifespan` seconds, then dead."""
    client = deps._ResilientJWKClient("https://example.test/jwks.json", lifespan=0.01)

    with patch.object(pyjwt.PyJWKClient, "fetch_data", return_value=JWK_SET):
        client.get_jwk_set()

    time.sleep(0.05)  # cache is now expired -> get_jwk_set() must fetch

    with patch.object(
        pyjwt.PyJWKClient,
        "fetch_data",
        side_effect=pyjwt.PyJWKClientConnectionError("read operation timed out"),
    ):
        jwk_set = client.get_jwk_set()

    assert [k.key_id for k in jwk_set.keys] == ["test-key"]


def test_client_is_built_once_and_keeps_its_cache():
    """The old helper rebuilt the client hourly, discarding the cached key set."""
    with patch.object(deps.settings, "supabase_url", "https://example.test"):
        first = deps._get_jwks_client()
        second = deps._get_jwks_client()
    assert first is second
    assert isinstance(first, deps._ResilientJWKClient)


def test_fetch_timeout_is_inside_a_request_budget():
    """PyJWT's default is 30s — long enough to trip the container healthcheck."""
    with patch.object(deps.settings, "supabase_url", "https://example.test"):
        client = deps._get_jwks_client()
    assert client.timeout == deps._JWKS_TIMEOUT_SECONDS
    assert deps._JWKS_TIMEOUT_SECONDS <= 10


def test_token_verification_does_not_run_on_the_event_loop():
    """get_current_user must offload the blocking JWKS fetch to a worker thread.

    Asserted on the source rather than by timing: a timing test here would be
    flaky, and what actually regressed is the plain `_decode_jwt(token)` call.
    """
    source = inspect.getsource(deps.get_current_user)
    assert "to_thread.run_sync(_decode_jwt" in source, (
        "get_current_user must not call _decode_jwt directly — PyJWKClient "
        "fetches with a blocking urllib call and would stall the event loop."
    )
