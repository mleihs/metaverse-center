"""Regression tests for deep-audit P1-3 (JWT verification hardening).

Pins four properties of ``_decode_jwt`` / ``Settings``:

1. The verification path is chosen by environment, not by the token's own
   ``alg`` header — in production a crafted HS256 token must never reach the
   shared-secret branch, however well it is signed.
2. The JWKS path only accepts asymmetric algorithms.
3. Development/test boots refuse an empty ``supabase_jwt_secret`` — an empty
   secret would make every HMAC check verify against ``""``.
4. Development/test accepts both ways a local Supabase legitimately signs.
   The branch used to assume HS256 with the shared secret; the Supabase CLI has
   since moved local projects onto the asymmetric keys production uses, and an
   HS256-only branch rejected every real local session — the backend answered
   401, the client read that as "signed out", and logging in appeared to do
   nothing. Neither local attempt reads the token's ``alg`` header to choose.
"""

import base64
import json
import time
from unittest.mock import patch
from uuid import uuid4

import jwt as pyjwt
import pytest
from pydantic import ValidationError

from backend import dependencies as deps
from backend.config import Settings, settings


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _es256_shaped_token() -> str:
    """A token whose header declares ES256.

    The signature is not real and does not need to be: PyJWT rejects a
    disallowed ``alg`` before it ever verifies the signature, which is exactly
    the point where the shared-secret attempt must hand over to the key set.
    """
    header = _b64(json.dumps({"alg": "ES256", "typ": "JWT", "kid": "local"}).encode())
    payload = _b64(
        json.dumps(
            {
                "sub": str(uuid4()),
                "aud": "authenticated",
                "exp": int(time.time()) + 3600,
            }
        ).encode()
    )
    return f"{header}.{payload}.{_b64(b'not-a-real-signature')}"


def _hs256_token(secret: str) -> str:
    return pyjwt.encode(
        {
            "sub": str(uuid4()),
            "email": "forged@test.dev",
            "aud": "authenticated",
            "exp": int(time.time()) + 3600,
            "iat": int(time.time()),
        },
        secret,
        algorithm="HS256",
    )


def test_production_never_takes_the_shared_secret_path():
    """A validly signed HS256 token must not verify in production.

    Before the fix, the attacker-controlled ``alg`` header selected the
    branch — an HS256 token was compared against the shared secret even in
    production. Now production goes to JWKS unconditionally, where an HS256
    token finds no matching key.
    """
    token = _hs256_token(settings.supabase_jwt_secret)

    with (
        patch.object(deps.settings, "environment", "production"),
        patch.object(
            deps,
            "_get_jwks_client",
            side_effect=pyjwt.PyJWKClientError("no matching key"),
        ),
    ):
        with pytest.raises(pyjwt.InvalidTokenError):
            deps._decode_jwt(token)


def test_development_decodes_hs256_with_shared_secret():
    token = _hs256_token(settings.supabase_jwt_secret)
    payload = deps._decode_jwt(token)
    assert payload["aud"] == "authenticated"


def test_jwks_algorithm_allowlist_is_asymmetric_only():
    assert "HS256" not in deps._JWKS_ALGORITHMS
    assert set(deps._JWKS_ALGORITHMS) <= {"ES256", "RS256"}


def test_boot_refuses_empty_jwt_secret_in_development():
    with pytest.raises(ValidationError, match="supabase_jwt_secret"):
        Settings(supabase_jwt_secret="")


def test_development_falls_through_to_jwks_for_an_asymmetric_token():
    """A local stack signing ES256 must authenticate in development.

    This is the regression that broke local login: the dev branch verified
    HS256 only, so a token from a modern local Supabase — which publishes an
    ES256 key at /auth/v1/.well-known/jwks.json and signs with it — failed
    every request with 401.
    """
    sentinel = {"sub": str(uuid4()), "aud": "authenticated", "email": "es256@test.dev"}

    # An HS256 decode of an ES256 token raises InvalidAlgorithmError; the real
    # signature check belongs to the JWKS path, which is stubbed here.
    with patch.object(deps, "_decode_jwks", return_value=sentinel) as jwks:
        payload = deps._decode_jwt(_es256_shaped_token())

    assert payload is sentinel
    assert jwks.call_count == 1


def test_development_does_not_retry_a_token_the_secret_already_judged():
    """An expired HS256 token is expired, not "no matching key".

    Falling through on every failure would replace an accurate verdict about
    the token with a misleading one about key material — and would send a
    pointless JWKS request for every expired session.
    """
    expired = pyjwt.encode(
        {
            "sub": str(uuid4()),
            "aud": "authenticated",
            "exp": int(time.time()) - 60,
            "iat": int(time.time()) - 120,
        },
        settings.supabase_jwt_secret,
        algorithm="HS256",
    )

    with patch.object(deps, "_decode_jwks") as jwks:
        with pytest.raises(pyjwt.ExpiredSignatureError):
            deps._decode_jwt(expired)

    jwks.assert_not_called()


def test_production_still_ignores_the_shared_secret_entirely():
    """The dev fall-through must not have opened a door in production."""
    token = _hs256_token(settings.supabase_jwt_secret)

    with (
        patch.object(deps.settings, "environment", "production"),
        patch.object(deps, "_decode_hs256") as hs256,
        patch.object(
            deps,
            "_get_jwks_client",
            side_effect=pyjwt.PyJWKClientError("no matching key"),
        ),
    ):
        with pytest.raises(pyjwt.InvalidTokenError):
            deps._decode_jwt(token)

    hs256.assert_not_called()
