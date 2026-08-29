from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

_GA_DOMAINS = (
    "https://*.google-analytics.com "
    "https://*.analytics.google.com "
    "https://*.googletagmanager.com"
)
_CSP = "; ".join([
    "default-src 'self'",
    f"script-src 'self' {_GA_DOMAINS} https://static.cloudflareinsights.com",
    f"connect-src 'self' https://*.supabase.co wss://*.supabase.co {_GA_DOMAINS}",
    f"img-src 'self' https://*.supabase.co {_GA_DOMAINS} data:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "frame-ancestors 'none'",
])


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Adds security headers to all responses."""

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = _CSP

        # Immutable caching for content-hashed static assets.
        # Vite adds content hashes to filenames (e.g., index-fXYAEj1v.js),
        # so a 1-year cache is safe — new deploys produce new filenames.
        #
        # ONLY for a response that actually carries the asset. The reasoning
        # above holds for 200s and inverts for everything else: a 404 on this
        # path is the most transient answer the server gives, because the file
        # appears the moment the deploy finishes.
        #
        # Marking one immutable poisoned production for a year. During a rolling
        # deploy a browser asked the retiring container for a filename only the
        # incoming one had; it answered 404, and this header told the CDN to
        # keep that answer until 2027. Cached under the `Origin` variant —
        # CORSMiddleware sets `Vary: Origin`, and Vite emits every module script
        # with `crossorigin`, so every browser sends that header and every
        # browser got the dead copy. The site rendered black in Chrome and
        # Brave alike while the container beside it served the same file with a
        # 200. Measured: `cf-cache-status: HIT`, `age: 664`,
        # `cache-control: public, max-age=31536000, immutable` on a 404.
        if request.url.path.startswith("/assets/") and response.status_code < 400:
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        elif request.url.path.startswith("/assets/"):
            # A miss here is a deploy in flight, not a fact about the URL.
            response.headers["Cache-Control"] = "no-store"

        return response
