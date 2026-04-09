"""Integration tests for the Chat router endpoints (routers/chat.py).

Covers auth gates, role-based access (viewer vs editor), conversation CRUD,
message sending, ownership verification, reactions, agent management, event
references, rename/archive/delete, and SSE streaming role gates.
"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

import backend.routers.chat as chat_module
from backend.app import app
from backend.dependencies import (
    get_admin_supabase,
    get_current_user,
    get_effective_supabase,
    get_supabase,
)
from backend.models.common import CurrentUser
from backend.tests.conftest import MOCK_USER_EMAIL, MOCK_USER_ID

SIM_ID = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
CONV_ID = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
MSG_ID = UUID("cccccccc-cccc-cccc-cccc-cccccccccccc")
AGENT_ID = UUID("dddddddd-dddd-dddd-dddd-dddddddddddd")
EVENT_ID = UUID("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee")
OTHER_USER_ID = UUID("ffffffff-ffff-ffff-ffff-ffffffffffff")

BASE_URL = f"/api/v1/simulations/{SIM_ID}/chat"

MOCK_CONVERSATION = {
    "id": str(CONV_ID),
    "simulation_id": str(SIM_ID),
    "user_id": str(MOCK_USER_ID),
    "agent_id": str(AGENT_ID),
    "title": "Test Conversation",
    "status": "active",
    "message_count": 0,
    "last_message_at": None,
    "created_at": "2026-01-01T00:00:00Z",
    "updated_at": "2026-01-01T00:00:00Z",
    "locale": "de",
    "agents": [],
    "event_references": [],
}

MOCK_MESSAGE = {
    "id": str(MSG_ID),
    "conversation_id": str(CONV_ID),
    "sender_role": "user",
    "content": "Hello agent",
    "metadata": None,
    "created_at": "2026-01-01T00:00:00Z",
    "agent_id": None,
    "agent": None,
    "model_used": None,
    "token_count": None,
    "generation_ms": None,
    "locale": None,
    "reactions": [],
}

MOCK_EVENT_REF = {
    "id": str(EVENT_ID),
    "event_id": str(EVENT_ID),
    "event_title": "Big Event",
    "event_type": "crisis",
    "event_description": "Something happened",
    "occurred_at": "2026-01-01T00:00:00Z",
    "impact_level": 8,
    "referenced_at": "2026-01-01T00:00:00Z",
}


# ── Helper: mock supabase with role dispatch ─────────────────────────


def _make_chainable(data=None):
    """Create a chainable Supabase query builder mock."""
    b = MagicMock()
    for method in (
        "select", "eq", "in_", "lt", "gt", "or_", "order",
        "limit", "single", "maybe_single", "is_", "not_",
        "range", "insert", "update", "delete", "upsert",
    ):
        getattr(b, method).return_value = b
    resp = MagicMock()
    resp.data = data
    b.execute = AsyncMock(return_value=resp)
    return b


def _mock_supabase():
    """Plain supabase mock with a default empty chain."""
    mock = MagicMock()
    mock.table.return_value = _make_chainable([])
    mock.rpc.return_value = _make_chainable([])
    return mock


def _mock_supabase_with_role(role: str | None) -> MagicMock:
    """Create a mock Supabase that passes role checks via simulation_members dispatch."""
    mock = _mock_supabase()
    member_chain = _make_chainable([{"member_role": role}] if role else [])
    default_chain = _make_chainable([])

    def _dispatch(table_name):
        return member_chain if table_name == "simulation_members" else default_chain

    mock.table = MagicMock(side_effect=_dispatch)
    return mock


def _setup_auth(role: str | None) -> MagicMock:
    """Wire up dependency overrides for a given role. Returns the mock supabase."""
    user = CurrentUser(id=MOCK_USER_ID, email=MOCK_USER_EMAIL, access_token="mock-token")
    mock_sb = _mock_supabase_with_role(role)
    mock_admin_sb = _mock_supabase()
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_supabase] = lambda: mock_sb
    app.dependency_overrides[get_effective_supabase] = lambda: mock_sb
    app.dependency_overrides[get_admin_supabase] = lambda: mock_admin_sb
    return mock_sb


# ── Fixtures ─────────────────────────────────────────────────────────


@pytest.fixture()
def editor_client():
    """TestClient authenticated as an editor."""
    _setup_auth("editor")
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture()
def viewer_client():
    """TestClient authenticated as a viewer."""
    _setup_auth("viewer")
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture()
def admin_client():
    """TestClient authenticated as an admin (passes both viewer and editor gates)."""
    _setup_auth("admin")
    yield TestClient(app)
    app.dependency_overrides.clear()


# ═════════════════════════════════════════════════════════════════════
# Auth Gate Tests
# ═════════════════════════════════════════════════════════════════════


@pytest.mark.integration
class TestChatAuthGate:
    """Unauthenticated requests and insufficient-role requests are rejected."""

    def test_no_auth_get_conversations(self):
        """GET /conversations without auth returns 401 or 422."""
        app.dependency_overrides.clear()
        raw_client = TestClient(app)
        resp = raw_client.get(f"{BASE_URL}/conversations")
        assert resp.status_code in (401, 422)

    def test_no_auth_post_conversations(self):
        """POST /conversations without auth returns 401 or 422."""
        app.dependency_overrides.clear()
        raw_client = TestClient(app)
        resp = raw_client.post(
            f"{BASE_URL}/conversations",
            json={"agent_ids": [str(AGENT_ID)]},
        )
        assert resp.status_code in (401, 422)

    def test_viewer_cannot_create_conversation(self, viewer_client):
        """Viewer role cannot POST /conversations (requires editor)."""
        resp = viewer_client.post(
            f"{BASE_URL}/conversations",
            json={"agent_ids": [str(AGENT_ID)]},
        )
        assert resp.status_code == 403

    def test_viewer_cannot_send_message(self, viewer_client):
        """Viewer role cannot POST messages (requires editor)."""
        resp = viewer_client.post(
            f"{BASE_URL}/conversations/{CONV_ID}/messages",
            json={"content": "Hello", "sender_role": "user"},
        )
        assert resp.status_code == 403

    def test_viewer_cannot_stream_message(self, viewer_client):
        """Viewer role cannot POST to the stream endpoint (requires editor)."""
        resp = viewer_client.post(
            f"{BASE_URL}/conversations/{CONV_ID}/messages/stream",
            json={"content": "Hello", "sender_role": "user"},
        )
        assert resp.status_code == 403

    def test_viewer_cannot_regenerate(self, viewer_client):
        """Viewer role cannot POST to regenerate (requires editor)."""
        resp = viewer_client.post(
            f"{BASE_URL}/conversations/{CONV_ID}/regenerate",
        )
        assert resp.status_code == 403

    def test_viewer_cannot_add_agent(self, viewer_client):
        """Viewer role cannot POST agents (requires editor)."""
        resp = viewer_client.post(
            f"{BASE_URL}/conversations/{CONV_ID}/agents",
            json={"agent_id": str(AGENT_ID)},
        )
        assert resp.status_code == 403

    def test_viewer_cannot_remove_agent(self, viewer_client):
        """Viewer role cannot DELETE agents (requires editor)."""
        resp = viewer_client.delete(
            f"{BASE_URL}/conversations/{CONV_ID}/agents/{AGENT_ID}",
        )
        assert resp.status_code == 403

    def test_viewer_cannot_toggle_reaction(self, viewer_client):
        """Viewer role cannot POST reactions (requires editor)."""
        resp = viewer_client.post(
            f"{BASE_URL}/conversations/{CONV_ID}/messages/{MSG_ID}/reactions",
            json={"emoji": "thumbsup"},
        )
        assert resp.status_code == 403

    def test_viewer_cannot_rename_conversation(self, viewer_client):
        """Viewer role cannot PUT title (requires editor)."""
        resp = viewer_client.put(
            f"{BASE_URL}/conversations/{CONV_ID}/title",
            json={"title": "New Title"},
        )
        assert resp.status_code == 403

    def test_viewer_cannot_archive_conversation(self, viewer_client):
        """Viewer role cannot PATCH archive (requires editor)."""
        resp = viewer_client.patch(
            f"{BASE_URL}/conversations/{CONV_ID}",
        )
        assert resp.status_code == 403

    def test_viewer_cannot_delete_conversation(self, viewer_client):
        """Viewer role cannot DELETE conversation (requires editor)."""
        resp = viewer_client.delete(
            f"{BASE_URL}/conversations/{CONV_ID}",
        )
        assert resp.status_code == 403

    def test_viewer_cannot_add_event_reference(self, viewer_client):
        """Viewer role cannot POST event references (requires editor)."""
        resp = viewer_client.post(
            f"{BASE_URL}/conversations/{CONV_ID}/events",
            json={"event_id": str(EVENT_ID)},
        )
        assert resp.status_code == 403

    def test_viewer_cannot_remove_event_reference(self, viewer_client):
        """Viewer role cannot DELETE event references (requires editor)."""
        resp = viewer_client.delete(
            f"{BASE_URL}/conversations/{CONV_ID}/events/{EVENT_ID}",
        )
        assert resp.status_code == 403


# ═════════════════════════════════════════════════════════════════════
# Conversation CRUD Tests
# ═════════════════════════════════════════════════════════════════════


@pytest.mark.integration
class TestChatConversations:
    """List and create conversation endpoints."""

    @patch.object(chat_module._service, "list_conversations", new_callable=AsyncMock)
    def test_list_conversations_as_viewer(self, mock_list, viewer_client):
        """GET /conversations with viewer role returns 200."""
        mock_list.return_value = [MOCK_CONVERSATION]

        resp = viewer_client.get(f"{BASE_URL}/conversations")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert len(body["data"]) == 1
        assert body["data"][0]["title"] == "Test Conversation"
        mock_list.assert_called_once()

    @patch.object(chat_module._service, "list_conversations", new_callable=AsyncMock)
    def test_list_conversations_empty(self, mock_list, viewer_client):
        """GET /conversations returns empty list when no conversations exist."""
        mock_list.return_value = []

        resp = viewer_client.get(f"{BASE_URL}/conversations")
        assert resp.status_code == 200
        assert resp.json()["data"] == []

    @patch.object(chat_module._service, "create_conversation", new_callable=AsyncMock)
    def test_create_conversation_as_editor(self, mock_create, editor_client):
        """POST /conversations with editor role returns 201."""
        mock_create.return_value = MOCK_CONVERSATION

        resp = editor_client.post(
            f"{BASE_URL}/conversations",
            json={"agent_ids": [str(AGENT_ID)], "title": "Test Conversation"},
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["title"] == "Test Conversation"
        mock_create.assert_called_once()

    @patch.object(chat_module._service, "create_conversation", new_callable=AsyncMock)
    def test_create_conversation_without_title(self, mock_create, editor_client):
        """POST /conversations without title still succeeds (title is optional)."""
        mock_create.return_value = {**MOCK_CONVERSATION, "title": None}

        resp = editor_client.post(
            f"{BASE_URL}/conversations",
            json={"agent_ids": [str(AGENT_ID)]},
        )
        assert resp.status_code == 201
        assert resp.json()["data"]["title"] is None

    def test_create_conversation_empty_agents_rejected(self, editor_client):
        """POST /conversations with empty agent_ids returns 422."""
        resp = editor_client.post(
            f"{BASE_URL}/conversations",
            json={"agent_ids": []},
        )
        assert resp.status_code == 422


# ═════════════════════════════════════════════════════════════════════
# Message Tests
# ═════════════════════════════════════════════════════════════════════


@pytest.mark.integration
class TestChatMessages:
    """Send and retrieve messages."""

    @patch.object(chat_module._service, "send_message", new_callable=AsyncMock)
    @patch.object(chat_module._service, "verify_ownership", new_callable=AsyncMock)
    def test_send_message_without_ai(self, mock_verify, mock_send, editor_client):
        """POST /messages with generate_response=false returns only user message."""
        mock_verify.return_value = None
        mock_send.return_value = MOCK_MESSAGE

        resp = editor_client.post(
            f"{BASE_URL}/conversations/{CONV_ID}/messages",
            json={
                "content": "Hello agent",
                "sender_role": "user",
                "generate_response": False,
            },
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["success"] is True
        assert len(body["data"]) == 1
        assert body["data"][0]["content"] == "Hello agent"
        mock_verify.assert_called_once()
        mock_send.assert_called_once()

    @patch.object(chat_module._service, "generate_ai_response", new_callable=AsyncMock)
    @patch.object(chat_module._service, "send_message", new_callable=AsyncMock)
    @patch.object(chat_module._service, "verify_ownership", new_callable=AsyncMock)
    def test_send_message_with_ai_response(self, mock_verify, mock_send, mock_ai, editor_client):
        """POST /messages with generate_response=true returns user + AI messages."""
        mock_verify.return_value = None
        mock_send.return_value = MOCK_MESSAGE

        ai_message = {
            **MOCK_MESSAGE,
            "id": "11111111-1111-1111-1111-111111111111",
            "sender_role": "assistant",
            "content": "I am an AI agent.",
            "agent_id": str(AGENT_ID),
        }
        mock_ai.return_value = [MOCK_MESSAGE, ai_message]

        resp = editor_client.post(
            f"{BASE_URL}/conversations/{CONV_ID}/messages",
            json={
                "content": "Hello agent",
                "sender_role": "user",
                "generate_response": True,
            },
        )
        assert resp.status_code == 201
        body = resp.json()
        assert len(body["data"]) == 2
        assert body["data"][1]["sender_role"] == "assistant"
        mock_ai.assert_called_once()

    @patch.object(chat_module._service, "get_messages", new_callable=AsyncMock)
    @patch.object(chat_module._service, "verify_ownership", new_callable=AsyncMock)
    def test_get_messages_as_viewer(self, mock_verify, mock_get, viewer_client):
        """GET /messages with viewer role returns 200."""
        mock_verify.return_value = None
        mock_get.return_value = [MOCK_MESSAGE]

        resp = viewer_client.get(f"{BASE_URL}/conversations/{CONV_ID}/messages")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert len(body["data"]) == 1
        mock_verify.assert_called_once()

    @patch.object(chat_module._service, "get_messages", new_callable=AsyncMock)
    @patch.object(chat_module._service, "verify_ownership", new_callable=AsyncMock)
    def test_get_messages_with_pagination(self, mock_verify, mock_get, viewer_client):
        """GET /messages respects limit and before query params."""
        mock_verify.return_value = None
        mock_get.return_value = []

        resp = viewer_client.get(
            f"{BASE_URL}/conversations/{CONV_ID}/messages?limit=10&before=2026-01-01T00:00:00Z",
        )
        assert resp.status_code == 200
        mock_get.assert_called_once()
        call_kwargs = mock_get.call_args.kwargs
        assert call_kwargs["limit"] == 10
        assert call_kwargs["before"] == "2026-01-01T00:00:00Z"

    def test_send_message_empty_content_rejected(self, editor_client):
        """POST /messages with empty content returns 422."""
        resp = editor_client.post(
            f"{BASE_URL}/conversations/{CONV_ID}/messages",
            json={"content": "", "sender_role": "user"},
        )
        assert resp.status_code == 422


# ═════════════════════════════════════════════════════════════════════
# Ownership Verification Tests
# ═════════════════════════════════════════════════════════════════════


@pytest.mark.integration
class TestChatOwnership:
    """verify_ownership raises 403 when user does not own the conversation."""

    @patch.object(chat_module._service, "verify_ownership", new_callable=AsyncMock)
    def test_ownership_failure_returns_403_on_get_messages(self, mock_verify, viewer_client):
        """GET /messages returns 403 when verify_ownership raises."""
        mock_verify.side_effect = HTTPException(status_code=403, detail="Not your conversation.")

        resp = viewer_client.get(f"{BASE_URL}/conversations/{CONV_ID}/messages")
        assert resp.status_code == 403

    @patch.object(chat_module._service, "verify_ownership", new_callable=AsyncMock)
    def test_ownership_failure_returns_403_on_send_message(self, mock_verify, editor_client):
        """POST /messages returns 403 when verify_ownership raises."""
        mock_verify.side_effect = HTTPException(status_code=403, detail="Not your conversation.")

        resp = editor_client.post(
            f"{BASE_URL}/conversations/{CONV_ID}/messages",
            json={"content": "Hello", "sender_role": "user"},
        )
        assert resp.status_code == 403

    @patch.object(chat_module._service, "verify_ownership", new_callable=AsyncMock)
    def test_ownership_failure_returns_403_on_add_agent(self, mock_verify, editor_client):
        """POST /agents returns 403 when verify_ownership raises."""
        mock_verify.side_effect = HTTPException(status_code=403, detail="Not your conversation.")

        resp = editor_client.post(
            f"{BASE_URL}/conversations/{CONV_ID}/agents",
            json={"agent_id": str(AGENT_ID)},
        )
        assert resp.status_code == 403

    @patch.object(chat_module._service, "verify_ownership", new_callable=AsyncMock)
    def test_ownership_failure_returns_403_on_starters(self, mock_verify, viewer_client):
        """GET /starters returns 403 when verify_ownership raises."""
        mock_verify.side_effect = HTTPException(status_code=403, detail="Not your conversation.")

        resp = viewer_client.get(f"{BASE_URL}/conversations/{CONV_ID}/starters")
        assert resp.status_code == 403

    @patch.object(chat_module._service, "verify_ownership", new_callable=AsyncMock)
    def test_ownership_failure_returns_403_on_rename(self, mock_verify, editor_client):
        """PUT /title returns 403 when verify_ownership raises."""
        mock_verify.side_effect = HTTPException(status_code=403, detail="Not your conversation.")

        resp = editor_client.put(
            f"{BASE_URL}/conversations/{CONV_ID}/title",
            json={"title": "New Title"},
        )
        assert resp.status_code == 403

    @patch.object(chat_module._service, "verify_ownership", new_callable=AsyncMock)
    def test_ownership_failure_returns_403_on_delete(self, mock_verify, editor_client):
        """DELETE /conversations returns 403 when verify_ownership raises."""
        mock_verify.side_effect = HTTPException(status_code=403, detail="Not your conversation.")

        resp = editor_client.delete(f"{BASE_URL}/conversations/{CONV_ID}")
        assert resp.status_code == 403


# ═════════════════════════════════════════════════════════════════════
# Reaction Tests
# ═════════════════════════════════════════════════════════════════════


@pytest.mark.integration
class TestChatReactions:
    """Toggle and get reactions on messages."""

    @patch.object(chat_module._service, "toggle_reaction", new_callable=AsyncMock)
    @patch.object(chat_module._service, "verify_ownership", new_callable=AsyncMock)
    def test_toggle_reaction_add(self, mock_verify, mock_toggle, editor_client):
        """POST /reactions with editor role adds a reaction."""
        mock_verify.return_value = None
        mock_toggle.return_value = "added"

        resp = editor_client.post(
            f"{BASE_URL}/conversations/{CONV_ID}/messages/{MSG_ID}/reactions",
            json={"emoji": "thumbsup"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["action"] == "added"
        assert body["data"]["emoji"] == "thumbsup"
        assert body["data"]["message_id"] == str(MSG_ID)

    @patch.object(chat_module._service, "toggle_reaction", new_callable=AsyncMock)
    @patch.object(chat_module._service, "verify_ownership", new_callable=AsyncMock)
    def test_toggle_reaction_remove(self, mock_verify, mock_toggle, editor_client):
        """POST /reactions when already reacted removes the reaction."""
        mock_verify.return_value = None
        mock_toggle.return_value = "removed"

        resp = editor_client.post(
            f"{BASE_URL}/conversations/{CONV_ID}/messages/{MSG_ID}/reactions",
            json={"emoji": "thumbsup"},
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["action"] == "removed"

    @patch.object(chat_module._service, "get_reactions", new_callable=AsyncMock)
    @patch.object(chat_module._service, "verify_ownership", new_callable=AsyncMock)
    def test_get_reactions_as_viewer(self, mock_verify, mock_get, viewer_client):
        """GET /reactions with viewer role returns aggregated reactions."""
        mock_verify.return_value = None
        mock_get.return_value = {
            str(MSG_ID): [
                {"emoji": "thumbsup", "count": 3, "reacted_by_me": True},
            ],
        }

        resp = viewer_client.get(
            f"{BASE_URL}/conversations/{CONV_ID}/messages/{MSG_ID}/reactions",
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert len(body["data"]) == 1
        assert body["data"][0]["emoji"] == "thumbsup"
        assert body["data"][0]["count"] == 3

    @patch.object(chat_module._service, "get_reactions", new_callable=AsyncMock)
    @patch.object(chat_module._service, "verify_ownership", new_callable=AsyncMock)
    def test_get_reactions_empty(self, mock_verify, mock_get, viewer_client):
        """GET /reactions returns empty list for a message with no reactions."""
        mock_verify.return_value = None
        mock_get.return_value = {}

        resp = viewer_client.get(
            f"{BASE_URL}/conversations/{CONV_ID}/messages/{MSG_ID}/reactions",
        )
        assert resp.status_code == 200
        assert resp.json()["data"] == []


# ═════════════════════════════════════════════════════════════════════
# Agent Management Tests
# ═════════════════════════════════════════════════════════════════════


@pytest.mark.integration
class TestChatAgentManagement:
    """Add and remove agents from conversations."""

    @patch.object(chat_module._service, "add_agent", new_callable=AsyncMock)
    @patch.object(chat_module._service, "verify_ownership", new_callable=AsyncMock)
    def test_add_agent(self, mock_verify, mock_add, editor_client):
        """POST /agents with editor role adds an agent."""
        mock_verify.return_value = None
        mock_add.return_value = {"conversation_id": str(CONV_ID), "agent_id": str(AGENT_ID)}

        resp = editor_client.post(
            f"{BASE_URL}/conversations/{CONV_ID}/agents",
            json={"agent_id": str(AGENT_ID)},
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["agent_id"] == str(AGENT_ID)
        mock_add.assert_called_once()

    @patch.object(chat_module._service, "remove_agent", new_callable=AsyncMock)
    @patch.object(chat_module._service, "verify_ownership", new_callable=AsyncMock)
    def test_remove_agent(self, mock_verify, mock_remove, editor_client):
        """DELETE /agents/{agent_id} with editor role removes an agent."""
        mock_verify.return_value = None
        mock_remove.return_value = None

        resp = editor_client.delete(
            f"{BASE_URL}/conversations/{CONV_ID}/agents/{AGENT_ID}",
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["removed"] is True
        mock_remove.assert_called_once()


# ═════════════════════════════════════════════════════════════════════
# Event Reference Tests
# ═════════════════════════════════════════════════════════════════════


@pytest.mark.integration
class TestChatEventReferences:
    """Add, list, and remove event references."""

    @patch.object(chat_module._service, "get_event_references", new_callable=AsyncMock)
    @patch.object(chat_module._service, "verify_ownership", new_callable=AsyncMock)
    def test_get_event_references(self, mock_verify, mock_get, viewer_client):
        """GET /events with viewer role returns event references."""
        mock_verify.return_value = None
        mock_get.return_value = [MOCK_EVENT_REF]

        resp = viewer_client.get(f"{BASE_URL}/conversations/{CONV_ID}/events")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert len(body["data"]) == 1
        assert body["data"][0]["event_title"] == "Big Event"

    @patch.object(chat_module._service, "add_event_reference", new_callable=AsyncMock)
    @patch.object(chat_module._service, "verify_ownership", new_callable=AsyncMock)
    def test_add_event_reference(self, mock_verify, mock_add, editor_client):
        """POST /events with editor role adds an event reference."""
        mock_verify.return_value = None
        mock_add.return_value = MOCK_EVENT_REF

        resp = editor_client.post(
            f"{BASE_URL}/conversations/{CONV_ID}/events",
            json={"event_id": str(EVENT_ID)},
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["event_id"] == str(EVENT_ID)
        mock_add.assert_called_once()

    @patch.object(chat_module._service, "remove_event_reference", new_callable=AsyncMock)
    @patch.object(chat_module._service, "verify_ownership", new_callable=AsyncMock)
    def test_remove_event_reference(self, mock_verify, mock_remove, editor_client):
        """DELETE /events/{event_id} with editor role removes reference."""
        mock_verify.return_value = None
        mock_remove.return_value = None

        resp = editor_client.delete(
            f"{BASE_URL}/conversations/{CONV_ID}/events/{EVENT_ID}",
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["removed"] is True
        mock_remove.assert_called_once()


# ═════════════════════════════════════════════════════════════════════
# Conversation Starters Tests
# ═════════════════════════════════════════════════════════════════════


@pytest.mark.integration
class TestChatStarters:
    """Conversation starters endpoint."""

    @patch.object(chat_module._service, "get_conversation_starters", new_callable=AsyncMock)
    @patch.object(chat_module._service, "verify_ownership", new_callable=AsyncMock)
    def test_get_starters_as_viewer(self, mock_verify, mock_starters, viewer_client):
        """GET /starters with viewer role returns starter suggestions."""
        mock_verify.return_value = None
        mock_starters.return_value = [
            "Was denkst du über die aktuelle Lage?",
            "Erzähl mir von deiner Vergangenheit.",
            "Wie siehst du die Zukunft?",
        ]

        resp = viewer_client.get(f"{BASE_URL}/conversations/{CONV_ID}/starters")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert len(body["data"]) == 3

    @patch.object(chat_module._service, "get_conversation_starters", new_callable=AsyncMock)
    @patch.object(chat_module._service, "verify_ownership", new_callable=AsyncMock)
    def test_get_starters_with_locale(self, mock_verify, mock_starters, viewer_client):
        """GET /starters?locale=en passes locale to service."""
        mock_verify.return_value = None
        mock_starters.return_value = ["Tell me about yourself."]

        resp = viewer_client.get(f"{BASE_URL}/conversations/{CONV_ID}/starters?locale=en")
        assert resp.status_code == 200
        # Verify locale was passed through
        call_args = mock_starters.call_args
        assert call_args[0][3] == "en" or call_args.kwargs.get("locale") == "en"

    def test_get_starters_invalid_locale_rejected(self, viewer_client):
        """GET /starters?locale=fr returns 422 (only de|en allowed)."""
        resp = viewer_client.get(f"{BASE_URL}/conversations/{CONV_ID}/starters?locale=fr")
        assert resp.status_code == 422


# ═════════════════════════════════════════════════════════════════════
# Rename / Archive / Delete Tests
# ═════════════════════════════════════════════════════════════════════


@pytest.mark.integration
class TestChatConversationLifecycle:
    """Rename, archive, and delete conversations."""

    @patch.object(chat_module._service, "rename_conversation", new_callable=AsyncMock)
    @patch.object(chat_module._service, "verify_ownership", new_callable=AsyncMock)
    def test_rename_conversation(self, mock_verify, mock_rename, editor_client):
        """PUT /title with editor role renames the conversation."""
        mock_verify.return_value = None
        renamed = {**MOCK_CONVERSATION, "title": "Renamed Conversation"}
        mock_rename.return_value = renamed

        resp = editor_client.put(
            f"{BASE_URL}/conversations/{CONV_ID}/title",
            json={"title": "Renamed Conversation"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["title"] == "Renamed Conversation"
        mock_rename.assert_called_once()

    def test_rename_conversation_empty_title_rejected(self, editor_client):
        """PUT /title with empty title returns 422."""
        resp = editor_client.put(
            f"{BASE_URL}/conversations/{CONV_ID}/title",
            json={"title": ""},
        )
        assert resp.status_code == 422

    @patch.object(chat_module._service, "archive_conversation", new_callable=AsyncMock)
    @patch.object(chat_module._service, "verify_ownership", new_callable=AsyncMock)
    def test_archive_conversation(self, mock_verify, mock_archive, editor_client):
        """PATCH /conversations/{id} with editor role archives the conversation."""
        mock_verify.return_value = None
        archived = {**MOCK_CONVERSATION, "status": "archived"}
        mock_archive.return_value = archived

        resp = editor_client.patch(f"{BASE_URL}/conversations/{CONV_ID}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["status"] == "archived"
        mock_archive.assert_called_once()

    @patch.object(chat_module._service, "delete_conversation", new_callable=AsyncMock)
    @patch.object(chat_module._service, "verify_ownership", new_callable=AsyncMock)
    def test_delete_conversation(self, mock_verify, mock_delete, editor_client):
        """DELETE /conversations/{id} with editor role deletes the conversation."""
        mock_verify.return_value = None
        mock_delete.return_value = MOCK_CONVERSATION

        resp = editor_client.delete(f"{BASE_URL}/conversations/{CONV_ID}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["id"] == str(CONV_ID)
        mock_delete.assert_called_once()


# ═════════════════════════════════════════════════════════════════════
# SSE Streaming Role Gate Tests
# ═════════════════════════════════════════════════════════════════════


@pytest.mark.integration
class TestChatStreamingRoleGate:
    """SSE streaming endpoints reject viewers at the role gate.

    Full SSE stream testing is not feasible with TestClient, but the
    role-based access control fires before any streaming logic.
    """

    def test_stream_message_rejected_for_viewer(self, viewer_client):
        """POST /messages/stream returns 403 for viewer role."""
        resp = viewer_client.post(
            f"{BASE_URL}/conversations/{CONV_ID}/messages/stream",
            json={"content": "Hello", "sender_role": "user"},
        )
        assert resp.status_code == 403

    def test_regenerate_rejected_for_viewer(self, viewer_client):
        """POST /regenerate returns 403 for viewer role."""
        resp = viewer_client.post(
            f"{BASE_URL}/conversations/{CONV_ID}/regenerate",
        )
        assert resp.status_code == 403

    @patch.object(chat_module._service, "stream_ai_response", new_callable=AsyncMock)
    @patch.object(chat_module._service, "send_message", new_callable=AsyncMock)
    @patch.object(chat_module._service, "verify_ownership", new_callable=AsyncMock)
    def test_stream_message_passes_role_gate_for_editor(
        self, mock_verify, mock_send, mock_stream, editor_client,
    ):
        """POST /messages/stream returns 200 for editor role (SSE response)."""
        mock_verify.return_value = None
        mock_send.return_value = MOCK_MESSAGE

        async def _empty_stream(*args, **kwargs):
            return
            yield  # noqa: RET504 — makes this an async generator

        mock_stream.side_effect = _empty_stream

        resp = editor_client.post(
            f"{BASE_URL}/conversations/{CONV_ID}/messages/stream",
            json={"content": "Hello", "sender_role": "user"},
        )
        assert resp.status_code == 200
        mock_verify.assert_called_once()
        mock_send.assert_called_once()

    @patch.object(chat_module._service, "stream_regenerate", new_callable=AsyncMock)
    @patch.object(chat_module._service, "verify_ownership", new_callable=AsyncMock)
    def test_regenerate_passes_role_gate_for_editor(
        self, mock_verify, mock_stream, editor_client,
    ):
        """POST /regenerate returns 200 for editor role (SSE response)."""
        mock_verify.return_value = None

        async def _empty_stream(*args, **kwargs):
            return
            yield  # noqa: RET504 — makes this an async generator

        mock_stream.side_effect = _empty_stream

        resp = editor_client.post(
            f"{BASE_URL}/conversations/{CONV_ID}/regenerate",
        )
        assert resp.status_code == 200
        mock_verify.assert_called_once()
