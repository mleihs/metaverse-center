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
        return response
