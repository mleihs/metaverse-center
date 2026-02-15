"""Integration tests verifying all routers are registered and endpoints respond."""

import pytest
from fastapi.testclient import TestClient

from backend.app import app


@pytest.fixture()
def client():
    return TestClient(app)


class TestHealthEndpoint:
    def test_health_returns_ok(self, client: TestClient):
        response = client.get("/api/v1/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"


class TestRouteRegistration:
    """Verify all expected router prefixes are registered in the app."""

    EXPECTED_PREFIXES = [
        "/api/v1/simulations",
        "/api/v1/users",
    ]

    EXPECTED_SIMULATION_SCOPED = [
        "agents",
        "buildings",
        "events",
        "locations",
        "taxonomies",
        "settings",
        "chat",
        "members",
        "campaigns",
    ]

    def test_all_routes_registered(self, client: TestClient):
        """Check that the app has routes for all expected prefixes."""
        routes = [route.path for route in app.routes]
        route_str = "\n".join(routes)

        for prefix in self.EXPECTED_PREFIXES:
            matching = [r for r in routes if r.startswith(prefix)]
            assert len(matching) > 0, (
                f"No routes found with prefix '{prefix}'. Available routes:\n{route_str}"
            )

    def test_simulation_scoped_routes_registered(self, client: TestClient):
        """Check that simulation-scoped entity routes exist."""
        routes = [route.path for route in app.routes]

        for entity in self.EXPECTED_SIMULATION_SCOPED:
            matching = [r for r in routes if entity in r]
            assert len(matching) > 0, f"No routes found for entity '{entity}'"

    def test_total_route_count(self, client: TestClient):
        """Ensure we have a substantial number of routes (70+)."""
        routes = [route.path for route in app.routes]
        # Filter out docs/openapi routes
        api_routes = [r for r in routes if r.startswith("/api/")]
        assert len(api_routes) >= 70, (
            f"Expected 70+ API routes, got {len(api_routes)}"
        )


class TestUnauthenticatedAccess:
    """Verify that protected endpoints reject unauthenticated requests."""

    PROTECTED_ENDPOINTS = [
        ("GET", "/api/v1/users/me"),
        ("GET", "/api/v1/simulations"),
    ]

    @pytest.mark.parametrize("method,path", PROTECTED_ENDPOINTS)
    def test_returns_error(self, client: TestClient, method: str, path: str):
        response = client.request(method, path)
        # FastAPI returns 422 when auth header is missing (validation error),
        # or 401/403 when the auth header is present but invalid.
        assert response.status_code in (401, 403, 422), (
            f"{method} {path} returned {response.status_code}"
        )


class TestSwaggerDocs:
    def test_docs_accessible(self, client: TestClient):
        response = client.get("/api/docs")
        assert response.status_code == 200

    def test_openapi_json(self, client: TestClient):
        response = client.get("/openapi.json")
        assert response.status_code == 200
        data = response.json()
        assert "paths" in data
        # Should have many paths
        assert len(data["paths"]) >= 40
