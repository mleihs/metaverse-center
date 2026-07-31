"""Regression tests for deep-audit P1-3 (JWT verification hardening).

Pins three properties of ``_decode_jwt`` / ``Settings``:

1. The verification path is chosen by environment, not by the token's own
   ``alg`` header — in production a crafted HS256 token must never reach the
   shared-secret branch, however well it is signed.
2. The JWKS path only accepts asymmetric algorithms.
3. Development/test boots refuse an empty ``supabase_jwt_secret`` — an empty
   secret would make every HMAC check verify against ``""``.
"""

import time
from unittest.mock import patch
from uuid import uuid4

import jwt as pyjwt
import pytest
from pydantic import ValidationError

from backend import dependencies as deps
from backend.config import Settings, settings


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
