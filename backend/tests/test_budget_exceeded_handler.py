"""Integration test for the global BudgetExceededError → 503 handler (A.1).

Pins the HTTP shape: 503 status, structured error body with scope
breakdown, Retry-After header scaled to the budget period.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.app import budget_exceeded_handler
from backend.services.budget_enforcement_service import BudgetExceededError


def _build_test_app() -> FastAPI:
    """Minimal app that mounts the handler + a route that raises."""
    app = FastAPI()
    app.add_exception_handler(BudgetExceededError, budget_exceeded_handler)

    @app.get("/hour-budget")
    async def hour_budget() -> dict:
        raise BudgetExceededError(
            scope="purpose",
            scope_key="forge",
            period="hour",
            current_usd=2.10,
            max_usd=2.00,
        )

    @app.get("/day-budget")
    async def day_budget() -> dict:
        raise BudgetExceededError(
            scope="global",
            scope_key="global",
            period="day",
            current_usd=51.0,
            max_usd=50.0,
        )

    return app


def test_hour_budget_returns_503_with_60s_retry_after() -> None:
    client = TestClient(_build_test_app(), raise_server_exceptions=False)
    resp = client.get("/hour-budget")
    assert resp.status_code == 503
    assert resp.headers["Retry-After"] == "60"
    body = resp.json()
    assert body["success"] is False
    assert body["error"]["code"] == "BUDGET_EXCEEDED"
    assert body["error"]["details"]["period"] == "hour"
    assert body["error"]["details"]["scope"] == "purpose"
    assert body["error"]["details"]["scope_key"] == "forge"
    assert body["error"]["details"]["current_usd"] == 2.10
    assert body["error"]["details"]["max_usd"] == 2.00


def test_day_budget_returns_503_with_300s_retry_after() -> None:
    client = TestClient(_build_test_app(), raise_server_exceptions=False)
    resp = client.get("/day-budget")
    assert resp.status_code == 503
    assert resp.headers["Retry-After"] == "300"
    body = resp.json()
    assert body["error"]["details"]["period"] == "day"


def test_error_message_contains_operator_hint() -> None:
    client = TestClient(_build_test_app(), raise_server_exceptions=False)
    resp = client.get("/hour-budget")
    body = resp.json()
    # Operator-facing message should name the scope and hint at the fix.
    assert "purpose:forge" in body["error"]["message"]
    assert "admin" in body["error"]["message"].lower()
