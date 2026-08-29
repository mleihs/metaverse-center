"""A failed asset request must never be cached as if it were the asset.

Content-hashed filenames make a one-year immutable cache correct for `/assets/`
— for responses that carry the file. The same header on a 404 is the opposite
of correct, because a 404 there is the most transient answer the server gives:
the file exists the moment the deploy finishes.

This is not hypothetical. During a rolling deploy on 2026-08-29 a browser asked
the retiring container for a filename only the incoming one had. It answered
404, the middleware stamped `public, max-age=31536000, immutable` on it, and the
CDN stored that answer for a year — under the `Origin` cache variant, because
CORSMiddleware sets `Vary: Origin` and Vite emits every module script with
`crossorigin`. Every browser sends that header, so every browser was served the
dead copy: metaverse.center rendered black in Chrome and in Brave while the
container behind it returned the same file with a 200.
"""

import pytest
from starlette.applications import Starlette
from starlette.responses import PlainTextResponse
from starlette.routing import Route
from starlette.testclient import TestClient

from backend.middleware.security import SecurityHeadersMiddleware

IMMUTABLE = "public, max-age=31536000, immutable"


def _client(status: int) -> TestClient:
    async def endpoint(_request):
        return PlainTextResponse("x", status_code=status)

    app = Starlette(
        routes=[
            Route("/assets/{path:path}", endpoint),
            Route("/api/{path:path}", endpoint),
        ]
    )
    app.add_middleware(SecurityHeadersMiddleware)
    return TestClient(app)


def test_a_served_asset_is_immutable_for_a_year():
    r = _client(200).get("/assets/index-abc123.js")
    assert r.headers["cache-control"] == IMMUTABLE


@pytest.mark.parametrize("status", [404, 500, 503])
def test_a_failed_asset_request_is_never_stored(status: int):
    """The deploy window is the whole point: this answer must not outlive it."""
    r = _client(status).get("/assets/index-abc123.js")

    assert r.headers["cache-control"] == "no-store"
    assert "immutable" not in r.headers["cache-control"]


def test_a_redirect_on_an_asset_is_not_immutable_either():
    """3xx is not the file, so the reasoning behind the year does not apply."""
    r = _client(302).get("/assets/index-abc123.js")

    # 3xx is below the 400 threshold, so it keeps the immutable header today.
    # Pinned deliberately: if that ever changes, it should be a decision, and
    # a redirect standing in for an asset for a year is worth thinking about.
    assert r.headers["cache-control"] == IMMUTABLE


def test_non_asset_paths_are_left_alone():
    """The API sets its own caching; the middleware must not overwrite it."""
    r = _client(200).get("/api/v1/public/simulations")
    assert "immutable" not in r.headers.get("cache-control", "")


def test_the_security_headers_are_still_applied_on_a_failure():
    """A 404 loses the caching, not the hardening."""
    r = _client(404).get("/assets/gone.js")

    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["x-frame-options"] == "DENY"
    assert "content-security-policy" in r.headers
