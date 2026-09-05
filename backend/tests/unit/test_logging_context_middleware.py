"""Unit tests for LoggingContextMiddleware — JWT extraction, request IDs, log output."""

import base64
import json
import logging

from starlette.testclient import TestClient

from backend.middleware.logging_context import LoggingContextMiddleware

# ── _extract_user_id tests ───────────────────────────────


class TestExtractUserId:
    """Tests for the static _extract_user_id helper."""

    def _make_request(self, headers=None):
        """Create a minimal mock request with headers."""
        from unittest.mock import MagicMock

        request = MagicMock()
        request.headers = headers or {}
        return request

    def _encode_jwt_payload(self, payload: dict) -> str:
        """Create a fake JWT with the given payload (no signature verification)."""
        header = base64.urlsafe_b64encode(json.dumps({"alg": "HS256"}).encode()).decode().rstrip("=")
        body = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
        return f"{header}.{body}.fake-signature"

    def test_valid_jwt_extracts_user_id(self):
        token = self._encode_jwt_payload({"sub": "user-123", "email": "test@example.com"})
        request = self._make_request({"authorization": f"Bearer {token}"})
        result = LoggingContextMiddleware._extract_user_id(request)
        assert result == "user-123"

    def test_no_auth_header_returns_none(self):
        request = self._make_request({})
        result = LoggingContextMiddleware._extract_user_id(request)
        assert result is None

    def test_malformed_jwt_returns_none(self):
        request = self._make_request({"authorization": "Bearer garbage.not-valid"})
        result = LoggingContextMiddleware._extract_user_id(request)
        assert result is None

    def test_missing_sub_claim_returns_none(self):
        token = self._encode_jwt_payload({"email": "test@example.com"})
        request = self._make_request({"authorization": f"Bearer {token}"})
        result = LoggingContextMiddleware._extract_user_id(request)
        assert result is None

    def test_non_bearer_scheme_returns_none(self):
        request = self._make_request({"authorization": "Basic dXNlcjpwYXNz"})
        result = LoggingContextMiddleware._extract_user_id(request)
        assert result is None


# ── dispatch tests (via Starlette TestClient) ────────────


def _create_test_app():
    """Create a minimal Starlette app with the middleware for testing."""
    from starlette.applications import Starlette
    from starlette.responses import JSONResponse
    from starlette.routing import Route

    async def health(request):
        return JSONResponse({"status": "ok"})

    app = Starlette(routes=[Route("/health", health)])
    app.add_middleware(LoggingContextMiddleware)
    return app


class TestDispatch:
    def test_generates_request_id_when_not_provided(self):
        """Response should include x-request-id even if client didn't send one."""
        app = _create_test_app()
        client = TestClient(app)
        response = client.get("/health")
        assert response.status_code == 200
        assert "x-request-id" in response.headers
        assert len(response.headers["x-request-id"]) > 0

    def test_uses_provided_request_id(self):
        """If client sends x-request-id, response should echo it back."""
        app = _create_test_app()
        client = TestClient(app)
        response = client.get("/health", headers={"x-request-id": "abc123"})
        assert response.headers["x-request-id"] == "abc123"

    def test_logs_request_completed(self, caplog):
        """'Request completed' should be logged at INFO with status_code and duration_ms."""
        app = _create_test_app()
        client = TestClient(app)

        with caplog.at_level(logging.INFO, logger="backend.middleware.logging_context"):
            client.get("/health")

        completed_records = [r for r in caplog.records if "Request completed" in r.getMessage()]
        assert len(completed_records) >= 1
        record = completed_records[0]
        assert record.status_code == 200
        assert hasattr(record, "duration_ms")
        assert record.duration_ms >= 0
