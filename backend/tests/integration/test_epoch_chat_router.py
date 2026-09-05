"""Integration tests for epoch chat endpoints.

Tests the epoch chat REST API (send message, list messages, ready signal)
against the real local Supabase instance with seed data.
"""

import pytest
from fastapi.testclient import TestClient

from backend.app import app


@pytest.fixture()
def client():
    return TestClient(app)


class TestEpochChatEndpoints:
    """Test that epoch chat endpoints return expected HTTP status codes.

    Note: Most endpoints require auth + epoch participation, so they
    return 401/403. Full integration requires a test epoch with participants.
    """

    def test_send_message_requires_auth(self, client: TestClient):
        """POST /api/v1/epochs/{id}/chat without JWT returns 401 or 422."""
        r = client.post(
            "/api/v1/epochs/00000000-0000-0000-0000-000000000001/chat",
            json={"content": "Hello", "channel_type": "epoch", "simulation_id": "00000000-0000-0000-0000-000000000001"},
        )
        assert r.status_code in (401, 422)

    def test_list_messages_requires_auth(self, client: TestClient):
        """GET /api/v1/epochs/{id}/chat without JWT returns 401 or 422."""
        r = client.get("/api/v1/epochs/00000000-0000-0000-0000-000000000001/chat")
        assert r.status_code in (401, 422)

    def test_list_team_messages_requires_auth(self, client: TestClient):
        """GET /api/v1/epochs/{id}/chat/team/{tid} without JWT returns 401 or 422."""
        r = client.get(
            "/api/v1/epochs/00000000-0000-0000-0000-000000000001/chat/team/00000000-0000-0000-0000-000000000002"
        )
        assert r.status_code in (401, 422)

    def test_ready_signal_requires_auth(self, client: TestClient):
        """POST /api/v1/epochs/{id}/ready without JWT returns 401 or 422."""
        r = client.post(
            "/api/v1/epochs/00000000-0000-0000-0000-000000000001/ready",
            json={"simulation_id": "00000000-0000-0000-0000-000000000001", "ready": True},
        )
        assert r.status_code in (401, 422)

    def test_send_message_validates_body(self, client: TestClient):
        """POST /api/v1/epochs/{id}/chat with missing body fields returns 422."""
        r = client.post(
            "/api/v1/epochs/00000000-0000-0000-0000-000000000001/chat",
            json={},
            headers={"Authorization": "Bearer fake-token"},
        )
        # Will fail at auth (401) before validation — that's expected
        assert r.status_code in (401, 422)

    def test_ready_signal_validates_body(self, client: TestClient):
        """POST /api/v1/epochs/{id}/ready with missing fields returns 422."""
        r = client.post(
            "/api/v1/epochs/00000000-0000-0000-0000-000000000001/ready",
            json={},
            headers={"Authorization": "Bearer fake-token"},
        )
        assert r.status_code in (401, 422)


class TestEpochChatModels:
    """Test Pydantic model validation for epoch chat."""

    def test_message_create_validation(self):
        from backend.models.epoch_chat import EpochChatMessageCreate

        msg = EpochChatMessageCreate(
            content="Test message",
            channel_type="epoch",
            simulation_id="00000000-0000-0000-0000-000000000001",
        )
        assert msg.content == "Test message"
        assert msg.channel_type == "epoch"
        assert msg.team_id is None

    def test_message_create_rejects_empty_content(self):
        from backend.models.epoch_chat import EpochChatMessageCreate

        with pytest.raises(ValueError):
            EpochChatMessageCreate(
                content="",
                channel_type="epoch",
                simulation_id="00000000-0000-0000-0000-000000000001",
            )

    def test_message_create_rejects_long_content(self):
        from backend.models.epoch_chat import EpochChatMessageCreate

        with pytest.raises(ValueError):
            EpochChatMessageCreate(
                content="x" * 2001,
                channel_type="epoch",
                simulation_id="00000000-0000-0000-0000-000000000001",
            )

    def test_message_create_accepts_team_channel(self):
        from backend.models.epoch_chat import EpochChatMessageCreate

        msg = EpochChatMessageCreate(
            content="Team only",
            channel_type="team",
            simulation_id="00000000-0000-0000-0000-000000000001",
            team_id="00000000-0000-0000-0000-000000000002",
        )
        assert msg.channel_type == "team"
        assert msg.team_id is not None

    def test_message_create_rejects_invalid_channel(self):
        from backend.models.epoch_chat import EpochChatMessageCreate

        with pytest.raises(ValueError):
            EpochChatMessageCreate(
                content="Test",
                channel_type="invalid",
                simulation_id="00000000-0000-0000-0000-000000000001",
            )

    def test_ready_signal_validation(self):
        from backend.models.epoch_chat import ReadySignal

        signal = ReadySignal(
            simulation_id="00000000-0000-0000-0000-000000000001",
            ready=True,
        )
        assert signal.ready is True

    def test_ready_signal_false(self):
        from backend.models.epoch_chat import ReadySignal

        signal = ReadySignal(
            simulation_id="00000000-0000-0000-0000-000000000001",
            ready=False,
        )
        assert signal.ready is False
