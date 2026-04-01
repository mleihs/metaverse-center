"""Integration tests for the Resonance Dungeons REST router + public endpoints.

12 authenticated endpoints under /api/v1/dungeons:
  GET /available, POST /runs, GET /runs/{id}, GET /runs/{id}/state,
  POST /runs/{id}/move, POST /runs/{id}/action, POST /runs/{id}/combat/submit,
  POST /runs/{id}/scout, POST /runs/{id}/rest, POST /runs/{id}/retreat,
  GET /runs/{id}/events, GET /history

2 public endpoints under /api/v1/public:
  GET /simulations/{id}/dungeons/history
  GET /dungeons/runs/{id}

Test categories per endpoint:
  - Auth: unauthenticated → 401 (where applicable)
  - Validation: malformed body → 422
  - Happy path: correct response shape
  - Error: not found → 404
"""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend.dependencies import (
    get_admin_supabase,
    get_anon_supabase,
    get_current_user,
    get_supabase,
)
from backend.models.common import CurrentUser
from backend.tests.conftest import MOCK_USER_EMAIL, MOCK_USER_ID, make_async_supabase_mock, make_chain_mock

# ── Fixtures ──────────────────────────────────────────────────────────────

SIM_ID = uuid4()
RUN_ID = uuid4()
AGENT_ID_1 = uuid4()
AGENT_ID_2 = uuid4()
NOW = datetime.now(UTC).isoformat()


@pytest.fixture()
def client():
    """TestClient with all auth/db dependencies overridden.

    The user Supabase mock returns [{"member_role": "editor"}] by default
    so that require_simulation_member() checks pass naturally.
    """
    mock_user = CurrentUser(id=MOCK_USER_ID, email=MOCK_USER_EMAIL, access_token="mock")
    # Default data: membership check returns editor role
    mock_sb = make_async_supabase_mock(execute_data=[{"member_role": "editor"}])
    mock_admin = make_async_supabase_mock()
    mock_anon = make_async_supabase_mock()

    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_supabase] = lambda: mock_sb
    app.dependency_overrides[get_admin_supabase] = lambda: mock_admin
    app.dependency_overrides[get_anon_supabase] = lambda: mock_anon

    yield TestClient(app)

    app.dependency_overrides.clear()


@pytest.fixture()
def anon_client():
    """TestClient with only anon supabase overridden (no auth)."""
    mock_anon = make_async_supabase_mock()
    app.dependency_overrides[get_anon_supabase] = lambda: mock_anon
    # Need to clear current_user so auth is not available
    app.dependency_overrides.pop(get_current_user, None)

    yield TestClient(app), mock_anon

    app.dependency_overrides.clear()


@pytest.fixture()
def unauth_client():
    """TestClient with NO dependency overrides — tests natural 401."""
    app.dependency_overrides.clear()
    yield TestClient(app)
    app.dependency_overrides.clear()


def _make_member_supabase(execute_data=None):
    """Supabase mock whose first .table() call returns membership data
    and subsequent calls return the provided execute_data.

    This handles the pattern where require_simulation_member queries
    simulation_members first, then the endpoint queries another table.
    """
    mock_sb = MagicMock()
    # Return membership data for the first chain, then custom data for the next
    member_chain = make_chain_mock(execute_data=[{"member_role": "editor"}])
    data_chain = make_chain_mock(execute_data=execute_data)
    mock_sb.table.side_effect = lambda name: member_chain if name == "simulation_members" else data_chain
    mock_sb.rpc.return_value = data_chain
    return mock_sb


def _run_row(run_id=None, sim_id=None, status="exploring"):
    return {
        "id": str(run_id or RUN_ID),
        "simulation_id": str(sim_id or SIM_ID),
        "resonance_id": None,
        "archetype": "The Shadow",
        "resonance_signature": "shadow_conflict",
        "party_agent_ids": [str(AGENT_ID_1), str(AGENT_ID_2)],
        "party_player_ids": [str(MOCK_USER_ID)],
        "difficulty": 3,
        "depth_target": 5,
        "current_depth": 1,
        "rooms_cleared": 2,
        "rooms_total": 8,
        "status": status,
        "outcome": None,
        "completed_at": None,
        "created_at": NOW,
    }


# ── GET /dungeons/available ──────────────────────────────────────────────


class TestListAvailableDungeons:
    def test_happy_path(self, client):
        available = [MagicMock()]
        available[0].model_dump.return_value = {
            "archetype": "The Shadow",
            "signature": "shadow_conflict",
            "resonance_id": str(uuid4()),
            "magnitude": 0.7,
            "susceptibility": 0.6,
            "effective_magnitude": 0.5,
            "suggested_difficulty": 3,
            "suggested_depth": 5,
            "last_run_at": None,
            "available": True,
        }
        with patch(
            "backend.routers.resonance_dungeons.DungeonEngineService.get_available_dungeons",
            new_callable=AsyncMock,
            return_value=available,
        ):
            resp = client.get(f"/api/v1/dungeons/available?simulation_id={SIM_ID}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert len(data["data"]) == 1

    def test_missing_simulation_id(self, client):
        resp = client.get("/api/v1/dungeons/available")
        assert resp.status_code == 422


# ── POST /dungeons/runs ──────────────────────────────────────────────────


class TestCreateRun:
    def test_happy_path(self, client):
        with (
            patch(
                "backend.routers.resonance_dungeons.DungeonEngineService.create_run",
                new_callable=AsyncMock,
                return_value={"run": _run_row(), "state": {}},
            ),
            patch(
                "backend.routers.resonance_dungeons.AuditService.safe_log",
                new_callable=AsyncMock,
            ),
        ):
            resp = client.post(
                f"/api/v1/dungeons/runs?simulation_id={SIM_ID}",
                json={
                    "archetype": "The Shadow",
                    "party_agent_ids": [str(AGENT_ID_1), str(AGENT_ID_2)],
                    "difficulty": 3,
                },
            )
        assert resp.status_code == 201
        assert resp.json()["success"] is True

    def test_party_too_small(self, client):
        resp = client.post(
            f"/api/v1/dungeons/runs?simulation_id={SIM_ID}",
            json={
                "archetype": "The Shadow",
                "party_agent_ids": [str(uuid4())],
                "difficulty": 1,
            },
        )
        assert resp.status_code == 422

    def test_party_too_large(self, client):
        resp = client.post(
            f"/api/v1/dungeons/runs?simulation_id={SIM_ID}",
            json={
                "archetype": "The Shadow",
                "party_agent_ids": [str(uuid4()) for _ in range(5)],
                "difficulty": 1,
            },
        )
        assert resp.status_code == 422

    def test_difficulty_out_of_range(self, client):
        resp = client.post(
            f"/api/v1/dungeons/runs?simulation_id={SIM_ID}",
            json={
                "archetype": "The Shadow",
                "party_agent_ids": [str(uuid4()), str(uuid4())],
                "difficulty": 99,
            },
        )
        assert resp.status_code == 422

    def test_invalid_archetype(self, client):
        resp = client.post(
            f"/api/v1/dungeons/runs?simulation_id={SIM_ID}",
            json={
                "archetype": "The Invalid",
                "party_agent_ids": [str(uuid4()), str(uuid4())],
                "difficulty": 1,
            },
        )
        assert resp.status_code == 422


# ── GET /dungeons/runs/{run_id} ──────────────────────────────────────────


class TestGetRun:
    def test_happy_path(self, client):
        mock_sb = _make_member_supabase(_run_row())
        app.dependency_overrides[get_supabase] = lambda: mock_sb

        resp = client.get(f"/api/v1/dungeons/runs/{RUN_ID}")
        assert resp.status_code == 200
        assert resp.json()["data"]["archetype"] == "The Shadow"

    def test_not_found(self, client):
        mock_sb = _make_member_supabase(None)
        app.dependency_overrides[get_supabase] = lambda: mock_sb

        resp = client.get(f"/api/v1/dungeons/runs/{uuid4()}")
        assert resp.status_code == 404


# ── GET /dungeons/runs/{run_id}/state ────────────────────────────────────


class TestGetRunState:
    def test_happy_path(self, client):
        state = MagicMock()
        state.model_dump.return_value = {
            "run_id": str(RUN_ID),
            "archetype": "The Shadow",
            "signature": "shadow_conflict",
            "difficulty": 3,
            "depth": 1,
            "current_room": 1,
            "rooms": [],
            "party": [],
            "archetype_state": {},
            "combat": None,
            "phase": "exploring",
            "phase_timer": None,
        }
        with patch(
            "backend.routers.resonance_dungeons.DungeonEngineService.get_client_state",
            new_callable=AsyncMock,
            return_value=state,
        ):
            resp = client.get(f"/api/v1/dungeons/runs/{RUN_ID}/state")
        assert resp.status_code == 200
        assert resp.json()["data"]["archetype"] == "The Shadow"

    def test_fallback_to_checkpoint_recovery(self, client):
        """Auto-recovery is now inside get_client_state → _get_instance.
        Test that the endpoint returns 200 when the service recovers successfully."""
        state = MagicMock()
        state.model_dump.return_value = {
            "run_id": str(RUN_ID),
            "archetype": "The Shadow",
            "signature": "s",
            "difficulty": 1,
            "depth": 0,
            "current_room": 0,
            "rooms": [],
            "party": [],
            "archetype_state": {},
            "combat": None,
            "phase": "exploring",
            "phase_timer": None,
        }

        with patch(
            "backend.routers.resonance_dungeons.DungeonEngineService.get_client_state",
            new_callable=AsyncMock,
            return_value=state,
        ):
            resp = client.get(f"/api/v1/dungeons/runs/{RUN_ID}/state")
        assert resp.status_code == 200

    def test_not_active_returns_404(self, client):
        from fastapi import HTTPException

        with patch(
            "backend.routers.resonance_dungeons.DungeonEngineService.get_client_state",
            new_callable=AsyncMock,
            side_effect=HTTPException(404, "not found"),
        ):
            resp = client.get(f"/api/v1/dungeons/runs/{RUN_ID}/state")
        assert resp.status_code == 404


# ── POST /dungeons/runs/{run_id}/move ────────────────────────────────────


class TestMoveToRoom:
    def test_happy_path(self, client):
        with patch(
            "backend.routers.resonance_dungeons.DungeonEngineService.move_to_room",
            new_callable=AsyncMock,
            return_value={"state": {}, "banter": None},
        ):
            resp = client.post(
                f"/api/v1/dungeons/runs/{RUN_ID}/move",
                json={"room_index": 1},
            )
        assert resp.status_code == 200
        assert resp.json()["success"] is True

    def test_negative_room_index(self, client):
        resp = client.post(
            f"/api/v1/dungeons/runs/{RUN_ID}/move",
            json={"room_index": -1},
        )
        assert resp.status_code == 422

    def test_missing_body(self, client):
        resp = client.post(f"/api/v1/dungeons/runs/{RUN_ID}/move")
        assert resp.status_code == 422


# ── POST /dungeons/runs/{run_id}/action ──────────────────────────────────


class TestSubmitAction:
    def test_happy_path(self, client):
        with patch(
            "backend.routers.resonance_dungeons.DungeonEngineService.handle_encounter_choice",
            new_callable=AsyncMock,
            return_value={"result": "success", "state": {}},
        ):
            resp = client.post(
                f"/api/v1/dungeons/runs/{RUN_ID}/action",
                json={"action_type": "encounter_choice", "choice_id": "c1"},
            )
        assert resp.status_code == 200

    def test_invalid_action_type(self, client):
        resp = client.post(
            f"/api/v1/dungeons/runs/{RUN_ID}/action",
            json={"action_type": "invalid"},
        )
        assert resp.status_code == 422


# ── POST /dungeons/runs/{run_id}/combat/submit ───────────────────────────


class TestSubmitCombatActions:
    def test_happy_path(self, client):
        with patch(
            "backend.routers.resonance_dungeons.DungeonEngineService.submit_combat_actions",
            new_callable=AsyncMock,
            return_value={"accepted": True, "waiting_for_players": True},
        ):
            resp = client.post(
                f"/api/v1/dungeons/runs/{RUN_ID}/combat/submit",
                json={"actions": [{"agent_id": str(uuid4()), "ability_id": "spy_observe"}]},
            )
        assert resp.status_code == 200

    def test_empty_actions_accepted(self, client):
        """Empty actions = auto-defend all agents (timer expiry)."""
        resp = client.post(
            f"/api/v1/dungeons/runs/{RUN_ID}/combat/submit",
            json={"actions": []},
        )
        # 400 = "Not in combat planning phase" (mock has no active run)
        # Key: NOT 422 — empty actions pass validation
        assert resp.status_code != 422


# ── POST /dungeons/runs/{run_id}/scout ───────────────────────────────────


class TestScout:
    def test_happy_path(self, client):
        with patch(
            "backend.routers.resonance_dungeons.DungeonEngineService.scout",
            new_callable=AsyncMock,
            return_value={"revealed_rooms": 2, "visibility": 3, "state": {}},
        ):
            resp = client.post(
                f"/api/v1/dungeons/runs/{RUN_ID}/scout",
                json={"agent_id": str(uuid4())},
            )
        assert resp.status_code == 200

    def test_missing_agent_id(self, client):
        resp = client.post(
            f"/api/v1/dungeons/runs/{RUN_ID}/scout",
            json={},
        )
        assert resp.status_code == 422


# ── POST /dungeons/runs/{run_id}/rest ────────────────────────────────────


class TestRest:
    def test_happy_path(self, client):
        with patch(
            "backend.routers.resonance_dungeons.DungeonEngineService.rest",
            new_callable=AsyncMock,
            return_value={"healed": True, "ambushed": False, "state": {}},
        ):
            resp = client.post(
                f"/api/v1/dungeons/runs/{RUN_ID}/rest",
                json={"agent_ids": [str(uuid4())]},
            )
        assert resp.status_code == 200

    def test_empty_agent_ids(self, client):
        resp = client.post(
            f"/api/v1/dungeons/runs/{RUN_ID}/rest",
            json={"agent_ids": []},
        )
        assert resp.status_code == 422


# ── POST /dungeons/runs/{run_id}/retreat ─────────────────────────────────


class TestRetreat:
    def test_happy_path(self, client):
        with (
            patch(
                "backend.routers.resonance_dungeons.DungeonEngineService.retreat",
                new_callable=AsyncMock,
                return_value={"retreated": True, "loot": []},
            ),
            patch(
                "backend.routers.resonance_dungeons.AuditService.safe_log",
                new_callable=AsyncMock,
            ),
        ):
            resp = client.post(f"/api/v1/dungeons/runs/{RUN_ID}/retreat")
        assert resp.status_code == 200
        assert resp.json()["data"]["retreated"] is True


# ── GET /dungeons/runs/{run_id}/events ───────────────────────────────────


class TestListEvents:
    @patch("backend.routers.resonance_dungeons.DungeonQueryService.get_run", new_callable=AsyncMock)
    def test_happy_path(self, mock_get_run, client):
        mock_get_run.return_value = _run_row()
        event = {
            "id": str(uuid4()),
            "run_id": str(RUN_ID),
            "depth": 1,
            "room_index": 2,
            "event_type": "room_entered",
            "narrative_en": "Entered room.",
            "narrative_de": "Raum betreten.",
            "outcome": {},
            "created_at": NOW,
        }
        mock_admin = MagicMock()
        chain = make_chain_mock(execute_data=[event], execute_count=1)
        mock_admin.table.return_value = chain
        app.dependency_overrides[get_admin_supabase] = lambda: mock_admin

        resp = client.get(f"/api/v1/dungeons/runs/{RUN_ID}/events")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert len(body["data"]) == 1
        assert body["meta"]["total"] == 1

    @patch("backend.routers.resonance_dungeons.DungeonQueryService.get_run", new_callable=AsyncMock)
    def test_pagination_params(self, mock_get_run, client):
        mock_get_run.return_value = _run_row()
        mock_admin = MagicMock()
        chain = make_chain_mock(execute_data=[], execute_count=0)
        mock_admin.table.return_value = chain
        app.dependency_overrides[get_admin_supabase] = lambda: mock_admin

        resp = client.get(f"/api/v1/dungeons/runs/{RUN_ID}/events?limit=10&offset=5")
        assert resp.status_code == 200
        assert resp.json()["meta"]["limit"] == 10
        assert resp.json()["meta"]["offset"] == 5

    @patch("backend.routers.resonance_dungeons.DungeonQueryService.get_run", new_callable=AsyncMock)
    def test_non_participant_forbidden(self, mock_get_run, client):
        mock_get_run.return_value = {**_run_row(), "party_player_ids": [str(uuid4())]}
        resp = client.get(f"/api/v1/dungeons/runs/{RUN_ID}/events")
        assert resp.status_code == 403


# ── GET /dungeons/history ────────────────────────────────────────────────


class TestListHistory:
    def test_happy_path(self, client):
        mock_sb_data_chain = make_chain_mock(execute_data=[_run_row(status="completed")], execute_count=1)
        member_chain = make_chain_mock(execute_data=[{"member_role": "editor"}])
        mock_sb = MagicMock()
        mock_sb.table.side_effect = lambda name: member_chain if name == "simulation_members" else mock_sb_data_chain
        app.dependency_overrides[get_supabase] = lambda: mock_sb

        resp = client.get(f"/api/v1/dungeons/history?simulation_id={SIM_ID}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert len(body["data"]) == 1

    def test_missing_simulation_id(self, client):
        resp = client.get("/api/v1/dungeons/history")
        assert resp.status_code == 422

    def test_pagination(self, client):
        mock_sb_data_chain = make_chain_mock(execute_data=[], execute_count=0)
        member_chain = make_chain_mock(execute_data=[{"member_role": "editor"}])
        mock_sb = MagicMock()
        mock_sb.table.side_effect = lambda name: member_chain if name == "simulation_members" else mock_sb_data_chain
        app.dependency_overrides[get_supabase] = lambda: mock_sb

        resp = client.get(f"/api/v1/dungeons/history?simulation_id={SIM_ID}&limit=5&offset=10")
        assert resp.status_code == 200
        assert resp.json()["meta"]["limit"] == 5
        assert resp.json()["meta"]["offset"] == 10


# ── PUBLIC: GET /public/simulations/{id}/dungeons/history ────────────────


class TestPublicDungeonHistory:
    def test_happy_path(self, anon_client):
        tc, mock_anon = anon_client
        chain = make_chain_mock(
            execute_data=[_run_row(status="completed")],
            execute_count=1,
        )
        mock_anon.table.return_value = chain

        resp = tc.get(f"/api/v1/public/simulations/{SIM_ID}/dungeons/history")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert len(body["data"]) == 1

    def test_empty_result(self, anon_client):
        tc, mock_anon = anon_client
        chain = make_chain_mock(execute_data=[], execute_count=0)
        mock_anon.table.return_value = chain

        resp = tc.get(f"/api/v1/public/simulations/{SIM_ID}/dungeons/history")
        assert resp.status_code == 200
        assert resp.json()["data"] == []

    def test_pagination_params(self, anon_client):
        tc, mock_anon = anon_client
        chain = make_chain_mock(execute_data=[], execute_count=0)
        mock_anon.table.return_value = chain

        resp = tc.get(f"/api/v1/public/simulations/{SIM_ID}/dungeons/history?limit=10&offset=5")
        assert resp.status_code == 200
        assert resp.json()["meta"]["limit"] == 10


# ── PUBLIC: GET /public/dungeons/runs/{run_id} ───────────────────────────


class TestPublicDungeonRun:
    def test_happy_path(self, anon_client):
        tc, mock_anon = anon_client
        chain = make_chain_mock(execute_data=_run_row(status="completed"))
        mock_anon.table.return_value = chain

        resp = tc.get(f"/api/v1/public/dungeons/runs/{RUN_ID}")
        assert resp.status_code == 200
        assert resp.json()["data"]["archetype"] == "The Shadow"

    def test_not_found(self, anon_client):
        tc, mock_anon = anon_client
        chain = make_chain_mock(execute_data=None)
        mock_anon.table.return_value = chain

        resp = tc.get(f"/api/v1/public/dungeons/runs/{uuid4()}")
        assert resp.status_code == 404


# ── Validation Edge Cases ────────────────────────────────────────────────


class TestValidationEdgeCases:
    """Cross-endpoint validation patterns."""

    def test_invalid_uuid_in_path(self, client):
        resp = client.get("/api/v1/dungeons/runs/not-a-uuid")
        assert resp.status_code == 422

    def test_invalid_uuid_in_query(self, client):
        resp = client.get("/api/v1/dungeons/available?simulation_id=not-a-uuid")
        assert resp.status_code == 422

    def test_run_create_with_duplicate_agent_ids(self, client):
        """Pydantic allows duplicate UUIDs — validation is in engine service, not model."""
        agent = uuid4()
        with (
            patch(
                "backend.routers.resonance_dungeons.DungeonEngineService.create_run",
                new_callable=AsyncMock,
                return_value={"run": _run_row(), "state": {}},
            ),
            patch(
                "backend.routers.resonance_dungeons.AuditService.safe_log",
                new_callable=AsyncMock,
            ),
        ):
            resp = client.post(
                f"/api/v1/dungeons/runs?simulation_id={SIM_ID}",
                json={
                    "archetype": "The Shadow",
                    "party_agent_ids": [str(agent), str(agent)],
                    "difficulty": 1,
                },
            )
        # Passes Pydantic validation (engine service would catch this)
        assert resp.status_code == 201

    def test_events_limit_bounds(self, client):
        """limit must be 1-200."""
        resp = client.get(f"/api/v1/dungeons/runs/{RUN_ID}/events?limit=0")
        assert resp.status_code == 422

        resp = client.get(f"/api/v1/dungeons/runs/{RUN_ID}/events?limit=201")
        assert resp.status_code == 422

    def test_history_limit_bounds(self, client):
        """limit must be 1-100."""
        resp = client.get(f"/api/v1/dungeons/history?simulation_id={SIM_ID}&limit=0")
        assert resp.status_code == 422

        resp = client.get(f"/api/v1/dungeons/history?simulation_id={SIM_ID}&limit=101")
        assert resp.status_code == 422
