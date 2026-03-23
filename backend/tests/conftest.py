from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend.dependencies import get_current_user
from backend.models.common import CurrentUser

MOCK_USER_ID = UUID("11111111-1111-1111-1111-111111111111")
MOCK_USER_EMAIL = "test@velgarien.dev"


@pytest.fixture()
def test_app():
    """FastAPI TestClient instance."""
    return TestClient(app)


@pytest.fixture()
def mock_user_token() -> str:
    """A fake JWT token string for testing."""
    return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature"


def make_chain_mock(execute_data=None, execute_count=None):
    """Reusable Supabase query chain mock.

    Usage: chain = make_chain_mock(execute_data=[...])
    Supports: .select(), .eq(), .in_(), .lt(), .gt(), .or_(), .order(),
              .limit(), .single(), .maybe_single(), .is_(), .not_(),
              .range(), .insert(), .update(), .delete(), .upsert()
    """
    c = MagicMock()
    for method in (
        "select", "eq", "in_", "lt", "gt", "or_", "order",
        "limit", "single", "maybe_single", "is_", "not_",
        "range", "insert", "update", "delete", "upsert",
    ):
        getattr(c, method).return_value = c
    resp = MagicMock()
    resp.data = execute_data
    resp.count = execute_count
    c.execute = AsyncMock(return_value=resp)
    return c


@pytest.fixture()
def mock_current_user():
    """Patch get_current_user to return a mock user without JWT validation."""
    user = CurrentUser(
        id=MOCK_USER_ID,
        email=MOCK_USER_EMAIL,
        access_token="mock-access-token",
    )

    app.dependency_overrides[get_current_user] = lambda: user
    yield user
    app.dependency_overrides.pop(get_current_user, None)
