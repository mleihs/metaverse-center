"""Response-contract tests for the epoch router.

The project treats a router's return-type annotation as its response model
(``CLAUDE.md``: "Return type annotation is the single source of truth"), which
means FastAPI validates every return value. A service whose shape drifts from
its model therefore does not fail loudly at import time — it returns HTTP 500
at runtime, *after* any write has already committed.

Four endpoints were shipped in exactly that state (see
``docs/analysis/epoch-audit-2026-08-29.md``): pass-cycle, join-team, leave-team
and results-summary all 500'd on every call. join-team and pass-cycle had
already persisted their side effect by the time serialisation failed, so the
player saw "failed" for an action that succeeded.

These tests drive each endpoint through the real app with the service mocked to
return exactly what it returns in production, and assert a 200 plus the fields
the frontend actually reads. Unit-testing the services alone would not have
caught any of them — the defect lives in the seam.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend.dependencies import (
    get_admin_supabase,
    get_current_user,
    get_effective_supabase,
    get_supabase,
)
from backend.models.common import CurrentUser
from backend.tests.conftest import make_async_supabase_mock

USER_ID = uuid4()
EPOCH_ID = uuid4()
SIM_ID = uuid4()
TEAM_ID = uuid4()

# require_epoch_participant() reads this row off the user-scoped client.
PARTICIPANT_ROW = {
    "id": str(uuid4()),
    "simulation_id": str(SIM_ID),
    "user_id": str(USER_ID),
    "current_rp": 10,
}


@pytest.fixture
def client() -> TestClient:
    """App with an authenticated participant and permissive Supabase mocks."""
    user = CurrentUser(id=USER_ID, email="contract@velgarien.dev", access_token="mock-token")
    sb = make_async_supabase_mock()
    sb.table.return_value.execute = AsyncMock(return_value=MagicMock(data=[PARTICIPANT_ROW]))
    admin = make_async_supabase_mock()

    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_effective_supabase] = lambda: sb
    app.dependency_overrides[get_supabase] = lambda: sb
    app.dependency_overrides[get_admin_supabase] = lambda: admin
    try:
        yield TestClient(app, raise_server_exceptions=False)
    finally:
        app.dependency_overrides.clear()


class TestCycleEndpointContracts:
    def test_pass_cycle_serialises(self, client: TestClient):
        """pass-cycle must answer with participant state, not {"passed": true}."""
        service_return = {
            "simulation_id": str(SIM_ID),
            "cycle_ready": False,
            "has_acted_this_cycle": True,
        }
        with patch(
            "backend.services.cycle_resolution_service.CycleResolutionService.pass_cycle",
            new=AsyncMock(return_value=service_return),
        ):
            resp = client.post(f"/api/v1/epochs/{EPOCH_ID}/pass-cycle?simulation_id={SIM_ID}")

        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert data["simulation_id"] == str(SIM_ID)
        assert data["has_acted_this_cycle"] is True

    def test_toggle_ready_keeps_new_cycle(self, client: TestClient):
        """`new_cycle` drives the cycle-advance overlay — it must survive serialisation.

        PassCycleResponse did not declare it, so Pydantic dropped it and
        EpochReadyPanel's `data.new_cycle ?? 0` always animated "Cycle 0".
        """
        service_return = {
            "simulation_id": str(SIM_ID),
            "cycle_ready": True,
            "auto_resolved": True,
            "new_cycle": 7,
        }
        with patch(
            "backend.services.epoch_chat_service.EpochChatService.toggle_ready",
            new=AsyncMock(return_value=service_return),
        ):
            resp = client.post(
                f"/api/v1/epochs/{EPOCH_ID}/ready",
                json={"simulation_id": str(SIM_ID), "ready": True},
            )

        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert data["auto_resolved"] is True
        assert data["new_cycle"] == 7


class TestNullableColumnContracts:
    """Columns that are nullable in the schema must be optional in the model.

    Found on 2026-08-29 while play-testing activity_gated against production:
    ``GET /api/v1/epochs/active`` returned 500 for every caller because one
    academy epoch carries ``created_by_id = NULL`` while ``EpochResponse``
    declared it a required ``UUID``. Same failure class as the four endpoints
    above, but reached through the DATA rather than through a service's return
    shape — which is why an audit of the services did not surface it.

    ``GET /api/v1/epochs`` kept answering 200 only because the frontend always
    passes a status filter that happened to exclude the offending row.
    """

    @staticmethod
    def _epoch_row(**overrides) -> dict:
        row = {
            "id": str(EPOCH_ID),
            "name": "Academy Training",
            "description": None,
            "created_by_id": None,
            "starts_at": None,
            "ends_at": None,
            "current_cycle": 5,
            "status": "competition",
            "config": {},
            "epoch_type": "academy",
            "cycle_started_at": None,
            "cycle_deadline_at": None,
            "created_at": "2026-03-10T09:12:29.757011+00:00",
            "updated_at": "2026-03-10T09:12:29.757011+00:00",
        }
        row.update(overrides)
        return row

    def test_active_epochs_tolerates_null_creator(self, client: TestClient):
        """A system-created epoch has no creator. That must serialise, not 500."""
        with patch(
            "backend.services.epoch_service.EpochService.get_active_epochs",
            new=AsyncMock(return_value=[self._epoch_row()]),
        ):
            resp = client.get("/api/v1/epochs/active")

        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert len(data) == 1
        assert data[0]["created_by_id"] is None

    def test_list_epochs_tolerates_null_creator(self, client: TestClient):
        """The unfiltered list carries the same row and the same model."""
        with patch(
            "backend.services.epoch_service.EpochService.list_epochs",
            new=AsyncMock(return_value=([self._epoch_row()], 1)),
        ):
            resp = client.get("/api/v1/epochs")

        assert resp.status_code == 200, resp.text
        assert resp.json()["data"][0]["created_by_id"] is None


class TestTeamEndpointContracts:
    def test_join_team_serialises(self, client: TestClient):
        """The join had already committed when serialisation used to fail."""
        service_return = {
            "simulation_id": str(SIM_ID),
            "team_id": str(TEAM_ID),
            "action": "join",
        }
        with patch(
            "backend.services.epoch_service.EpochService.join_team",
            new=AsyncMock(return_value=service_return),
        ):
            resp = client.post(f"/api/v1/epochs/{EPOCH_ID}/teams/{TEAM_ID}/join?simulation_id={SIM_ID}")

        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert data["action"] == "join"
        assert data["team_id"] == str(TEAM_ID)

    def test_leave_team_serialises(self, client: TestClient):
        service_return = {"simulation_id": str(SIM_ID), "team_id": None, "action": "leave"}
        with patch(
            "backend.services.epoch_service.EpochService.leave_team",
            new=AsyncMock(return_value=service_return),
        ):
            resp = client.post(f"/api/v1/epochs/{EPOCH_ID}/teams/leave?simulation_id={SIM_ID}")

        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert data["action"] == "leave"
        assert data["team_id"] is None


class TestServiceReturnsMatchTheirModels:
    """The mocked tests above pin the MODEL. These pin the SERVICE.

    A test that mocks the service and asserts a 200 only proves the router and
    the response model agree — it stays green if the service drifts straight
    back to the broken shape. Since service drift is exactly the defect that
    shipped, the contract has to be checked from the other side too: take what
    the service actually returns and validate it against the model the router
    declares.
    """

    @pytest.mark.asyncio
    async def test_pass_cycle_return_validates(self):
        """CycleResolutionService.pass_cycle -> PassCycleResponse.

        Calls the real method; a revert to ``{"passed": True}`` fails here.
        """
        from backend.models.epoch import PassCycleResponse
        from backend.services.cycle_resolution_service import CycleResolutionService

        participant = {
            "simulation_id": str(SIM_ID),
            "cycle_ready": False,
            "has_acted_this_cycle": True,
        }
        sb = make_async_supabase_mock()
        admin = make_async_supabase_mock()
        admin.table.return_value.execute = AsyncMock(return_value=MagicMock(data=participant))

        with (
            patch(
                # pass_cycle imports EpochService lazily inside the function,
                # so the patch target is the source module, not this one.
                "backend.services.epoch_service.EpochService.get",
                new=AsyncMock(return_value={"status": "competition", "current_cycle": 3}),
            ),
            patch.object(CycleResolutionService, "mark_acted", new=AsyncMock(return_value=True)),
            patch(
                "backend.services.cycle_resolution_service.BattleLogService.log_event",
                new=AsyncMock(),
            ),
        ):
            result = await CycleResolutionService.pass_cycle(sb, admin, EPOCH_ID, SIM_ID)

        assert PassCycleResponse.model_validate(result).simulation_id == SIM_ID

    @pytest.mark.asyncio
    async def test_leave_team_return_validates(self):
        """EpochParticipationService.leave_team -> TeamActionResponse.

        Calls the real method; dropping the `action` field fails here.
        """
        from backend.models.epoch import TeamActionResponse
        from backend.services.epoch_participation_service import EpochParticipationService

        admin = make_async_supabase_mock()
        admin.rpc.return_value.execute = AsyncMock(
            return_value=MagicMock(data={"simulation_id": str(SIM_ID), "previous_team_id": str(TEAM_ID)})
        )

        with patch(
            "backend.services.epoch_participation_service.get_admin_supabase_client",
            new=AsyncMock(return_value=admin),
        ):
            result = await EpochParticipationService.leave_team(make_async_supabase_mock(), EPOCH_ID, SIM_ID)

        validated = TeamActionResponse.model_validate(result)
        assert validated.action == "leave"
        assert validated.team_id is None

    @pytest.mark.asyncio
    async def test_results_summary_return_validates(self):
        """ScoringService.get_results_summary -> ResultsSummaryResponse.

        Runs the real method against mocked Supabase calls and validates the
        dict it builds. This is the test that would have caught the shipped
        `score_history` mismatch; the mocked-endpoint test above would not.
        """
        from backend.models.epoch import ResultsSummaryResponse
        from backend.services.scoring_service import ScoringService

        sb = make_async_supabase_mock()
        sb.table.return_value.execute = AsyncMock(return_value=MagicMock(data=[], count=0))
        epoch_row = {
            "id": str(EPOCH_ID),
            "name": "Contract",
            "status": "completed",
            "epoch_type": "competitive",
            "current_cycle": 4,
        }

        with (
            patch(
                "backend.services.scoring_service.EpochService.get",
                new=AsyncMock(return_value=epoch_row),
            ),
            patch.object(ScoringService, "get_final_standings", new=AsyncMock(return_value=[])),
            patch(
                "backend.services.scoring_service.EpochService.list_participants",
                new=AsyncMock(return_value=[{"simulation_id": str(SIM_ID)}]),
            ),
        ):
            result = await ScoringService.get_results_summary(sb, EPOCH_ID, admin_supabase=sb)

        # Must round-trip through the model the router declares.
        validated = ResultsSummaryResponse.model_validate(result)
        assert validated.epoch.status == "completed"
        assert str(SIM_ID) in validated.score_history


class TestResultsSummaryContract:
    def test_results_summary_serialises_keyed_history(self, client: TestClient):
        """`score_history` is keyed by simulation_id, not a flat list.

        The model declared `list[dict]`, so every completed epoch 500'd and the
        results view rendered "No results available" on the failed response.
        """
        service_return = {
            "epoch": {
                "id": str(EPOCH_ID),
                "name": "Contract Epoch",
                "epoch_type": "competitive",
                "status": "completed",
                "current_cycle": 9,
            },
            "standings": [{"rank": 1, "simulation_id": str(SIM_ID)}],
            "participant_stats": [{"simulation_id": str(SIM_ID), "total_operations": 3}],
            "mvp_awards": [],
            "score_history": {str(SIM_ID): [{"cycle_number": 1}, {"cycle_number": 2}]},
        }
        with patch(
            "backend.services.scoring_service.ScoringService.get_results_summary",
            new=AsyncMock(return_value=service_return),
        ):
            resp = client.get(f"/api/v1/epochs/{EPOCH_ID}/results-summary")

        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert data["epoch"]["status"] == "completed"
        assert data["score_history"][str(SIM_ID)][0]["cycle_number"] == 1

    def test_standings_keep_dimension_titles(self, client: TestClient):
        """LeaderboardEntry must declare the *_title fields or they are stripped.

        get_final_standings awards them to the best performer per dimension;
        EpochResultsView reads entry.stability_title and friends.
        """
        entry = {
            "rank": 1,
            "simulation_id": str(SIM_ID),
            "simulation_name": "Velgarien",
            "stability": 91.0,
            "influence": 44.0,
            "sovereignty": 70.0,
            "diplomatic": 60.0,
            "military": 33.0,
            "composite": 68.4,
            "stability_title": "Iron Guardian",
        }
        with patch(
            "backend.services.scoring_service.ScoringService.get_final_standings",
            new=AsyncMock(return_value=[entry]),
        ):
            resp = client.get(f"/api/v1/epochs/{EPOCH_ID}/scores/standings")

        assert resp.status_code == 200, resp.text
        assert resp.json()["data"][0]["stability_title"] == "Iron Guardian"
