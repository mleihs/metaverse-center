"""Signed one-click unsubscribe tokens.

Gmail and Yahoo have required one-click unsubscription from bulk senders since
2024 (RFC 8058). The link in the footer therefore has to work **without a
login** — which means the mail itself has to carry proof of who it was for.

Design notes worth keeping:

* **Key.** There is no dedicated signing secret in the environment, and
  ``supabase_jwt_secret`` is only guaranteed to be set in development and test
  (production verifies ES256 through JWKS). The key is therefore *derived* from
  the service-role key with a domain-separation label, so it is stable, present
  wherever the backend runs, and cannot be replayed against anything else that
  uses the same secret. Rotating the service-role key invalidates every
  outstanding unsubscribe link — acceptable, and the footer's manage-link
  remains as the fallback path.
* **No expiry.** A mail can be opened a year after it was sent, and an
  unsubscribe link that has quietly gone stale is worse than none: the reader
  clicks, nothing happens, and the next stop is the spam button. The token
  carries the issue time for forensics, not as a deadline.
* **Constant-time compare.** ``hmac.compare_digest``, not ``==``.
* **Category, not "everything".** A reader who is done with cycle briefings is
  not necessarily done with the epoch's closing report. The token names exactly
  the kind of mail it came from; ``all`` exists for the explicit link.
"""

from __future__ import annotations

import base64
import hmac
import json
import logging
import time
from hashlib import sha256

from backend.config import settings

logger = logging.getLogger(__name__)

_LABEL = b"metaverse.center/email-unsubscribe/v1"

# The notification-preference columns a token may switch off, plus the
# catch-all. Mirrors `notification_preferences` (migration 044).
UNSUBSCRIBE_CATEGORIES = frozenset({"cycle_resolved", "phase_changed", "epoch_completed", "all"})


def _signing_key() -> bytes | None:
    """Derive the token key, or ``None`` when no secret is available."""
    secret = settings.supabase_service_role_key or settings.supabase_jwt_secret
    if not secret:
        return None
    return hmac.new(secret.encode("utf-8"), _LABEL, sha256).digest()


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def mint_token(user_id: str, category: str) -> str | None:
    """Return a signed token, or ``None`` when signing is not possible.

    Returning ``None`` rather than raising is deliberate: a missing secret must
    degrade the footer to its manage-link, never cost the recipient their mail.
    """
    if category not in UNSUBSCRIBE_CATEGORIES:
        raise ValueError(f"Unknown unsubscribe category: {category!r}")

    key = _signing_key()
    if key is None:
        logger.warning("No secret available to sign unsubscribe tokens — link omitted")
        return None

    payload = _b64(json.dumps({"u": user_id, "c": category, "t": int(time.time())}).encode("utf-8"))
    signature = _b64(hmac.new(key, payload.encode("ascii"), sha256).digest())
    return f"{payload}.{signature}"


def verify_token(token: str) -> tuple[str, str] | None:
    """Return ``(user_id, category)`` for a valid token, else ``None``."""
    key = _signing_key()
    if key is None:
        return None

    payload, _, signature = token.partition(".")
    if not payload or not signature:
        return None

    expected = _b64(hmac.new(key, payload.encode("ascii"), sha256).digest())
    if not hmac.compare_digest(expected, signature):
        return None

    try:
        data = json.loads(_unb64(payload))
    except (ValueError, TypeError):
        return None

    user_id = data.get("u")
    category = data.get("c")
    if not isinstance(user_id, str) or category not in UNSUBSCRIBE_CATEGORIES:
        return None
    return user_id, category


def unsubscribe_url(user_id: str, category: str) -> str | None:
    """Public URL a recipient can follow to leave one kind of mail."""
    token = mint_token(user_id, category)
    if token is None:
        return None
    return f"{settings.site_url}/api/v1/unsubscribe?token={token}"
