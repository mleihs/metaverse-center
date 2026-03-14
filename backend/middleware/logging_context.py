"""Request context middleware — injects correlation IDs into every log line."""

import base64
import json
import logging
import time
import uuid

import sentry_sdk
import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger(__name__)


class LoggingContextMiddleware(BaseHTTPMiddleware):
    """Binds request_id, method, path, and user_id to structlog contextvars.

    Every log call during the request lifecycle automatically includes
    these fields — no changes needed in service or router code.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        # Prevent stale context from a previous request
        structlog.contextvars.clear_contextvars()

        request_id = request.headers.get("x-request-id") or uuid.uuid4().hex
        user_id = self._extract_user_id(request)

        if user_id:
            sentry_sdk.set_user({"id": user_id})

        structlog.contextvars.bind_contextvars(
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            user_id=user_id,
        )

        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = round((time.perf_counter() - start) * 1000, 1)

        response.headers["x-request-id"] = request_id

        logger.info(
            "Request completed",
            extra={"status_code": response.status_code, "duration_ms": duration_ms},
        )
        return response

    @staticmethod
    def _extract_user_id(request: Request) -> str | None:
        """Best-effort user_id from JWT payload. Decode only, no validation."""
        auth = request.headers.get("authorization", "")
        if not auth.startswith("Bearer "):
            return None
        token = auth[7:]
        try:
            # Decode JWT payload (second segment) without verification
            payload_b64 = token.split(".")[1]
            # Add padding
            payload_b64 += "=" * (-len(payload_b64) % 4)
            payload = json.loads(base64.urlsafe_b64decode(payload_b64))
            return payload.get("sub")
        except Exception:  # noqa: BLE001
            return None
