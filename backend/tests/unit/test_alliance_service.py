"""Unit tests for AllianceService — proposals, voting, upkeep, tension, dissolution."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

from backend.services.alliance_service import AllianceService

# ── Helpers ────────────────────────────────────────────────────

EPOCH_ID = uuid4()
TEAM_ID = uuid4()
PROPOSER_SIM_ID = uuid4()
VOTER_SIM_ID = uuid4()
TARGET_SIM_ID = uuid4()
INVITER_SIM_ID = uuid4()
PROPOSAL_ID = uuid4()
PARTICIPANT_ID = uuid4()

EPOCH_DATA_COMPETITION = {
    "id": str(EPOCH_ID),
    "status": "competition",
    "current_cycle": 5,
    "config": {},
}

EPOCH_DATA_RECKONING = {
    "id": str(EPOCH_ID),
    "status": "reckoning",
    "current_cycle": 10,
    "config": {},
}


def _make_chain(execute_data=None, execute_count=None):
    """Create a mock Supabase query chain with all common methods."""
    c = MagicMock()
    for method in (
        "select", "eq", "in_", "is_", "not_", "order", "limit",
        "single", "maybe_single", "insert", "update", "delete", "upsert",
    ):
        getattr(c, method).return_value = c
    # Support `not_.is_(...)` attribute chaining (not_ is accessed as property)
    c.not_ = c
    resp = MagicMock()
    resp.data = execute_data
    resp.count = execute_count
    c.execute.return_value = resp
    return c


def _make_sb(table_map=None, rpc_data=None):
    """Create a mock Supabase client with table routing and optional RPC."""
    sb = MagicMock()
    table_map = table_map or {}

    def _table(name):
        return table_map.get(name, _make_chain())

    sb.table.side_effect = _table

    if rpc_data is not None:
        rpc_chain = _make_chain(execute_data=rpc_data)
        sb.rpc.return_value = rpc_chain

    return sb


# ── TestCreateProposal ─────────────────────────────────────────


class TestCreateProposal:
    """Tests for AllianceService.create_proposal."""

    @pytest.mark.asyncio
    @patch("backend.services.alliance_service.BattleLogService")
    async def test_rejects_in_reckoning_phase(self, mock_bls):
        """Proposals must be rejected when epoch is in reckoning phase."""
        sb = MagicMock()

        with patch(
            "backend.services.epoch_service.EpochService.get",
            new_callable=AsyncMock,
            return_value=EPOCH_DATA_RECKONING,
        ):
            with pytest.raises(HTTPException) as exc:
                await AllianceService.create_proposal(
                    sb, EPOCH_ID, TEAM_ID, PROPOSER_SIM_ID,
                )
            assert exc.value.status_code == 400
            assert "reckoning" in exc.value.detail.lower()

    @pytest.mark.asyncio
    @patch("backend.services.alliance_service.BattleLogService")
    async def test_rejects_if_proposer_not_participant(self, mock_bls):
        """Proposer must be an epoch participant."""
        participants_chain = _make_chain(execute_data=None)

        sb = _make_sb(table_map={"epoch_participants": participants_chain})

        with patch(
            "backend.services.epoch_service.EpochService.get",
            new_callable=AsyncMock,
            return_value=EPOCH_DATA_COMPETITION,
        ):
            with pytest.raises(HTTPException) as exc:
                await AllianceService.create_proposal(
                    sb, EPOCH_ID, TEAM_ID, PROPOSER_SIM_ID,
                )
            assert exc.value.status_code == 404
            assert "not a participant" in exc.value.detail.lower()

    @pytest.mark.asyncio
    @patch("backend.services.alliance_service.BattleLogService")
    async def test_rejects_if_proposer_already_has_team(self, mock_bls):
        """Proposer must be unaligned (no team_id)."""
        participants_chain = _make_chain(execute_data={
            "id": str(PARTICIPANT_ID),
            "team_id": str(uuid4()),  # already on a team
        })

        sb = _make_sb(table_map={"epoch_participants": participants_chain})

        with patch(
            "backend.services.epoch_service.EpochService.get",
            new_callable=AsyncMock,
            return_value=EPOCH_DATA_COMPETITION,
        ):
            with pytest.raises(HTTPException) as exc:
                await AllianceService.create_proposal(
                    sb, EPOCH_ID, TEAM_ID, PROPOSER_SIM_ID,
                )
            assert exc.value.status_code == 400
            assert "leave" in exc.value.detail.lower()

    @pytest.mark.asyncio
    @patch("backend.services.alliance_service.BattleLogService")
    async def test_rejects_if_team_not_found(self, mock_bls):
        """Team must exist and not be dissolved."""
        participants_chain = _make_chain(execute_data={
            "id": str(PARTICIPANT_ID),
            "team_id": None,
        })
        teams_chain = _make_chain(execute_data=None)

        call_count = {"epoch_participants": 0}

        def table_router(name):
            if name == "epoch_participants":
                call_count["epoch_participants"] += 1
                if call_count["epoch_participants"] == 1:
                    return participants_chain
                return _make_chain()
            if name == "epoch_teams":
                return teams_chain
            return _make_chain()

        sb = MagicMock()
        sb.table.side_effect = table_router

        with patch(
            "backend.services.epoch_service.EpochService.get",
            new_callable=AsyncMock,
            return_value=EPOCH_DATA_COMPETITION,
        ):
            with pytest.raises(HTTPException) as exc:
                await AllianceService.create_proposal(
                    sb, EPOCH_ID, TEAM_ID, PROPOSER_SIM_ID,
                )
            assert exc.value.status_code == 404
            assert "not found" in exc.value.detail.lower()

    @pytest.mark.asyncio
    @patch("backend.services.alliance_service.BattleLogService")
    async def test_rejects_if_team_full(self, mock_bls):
        """Team at max_team_size must reject new proposals."""
        participants_proposer = _make_chain(execute_data={
            "id": str(PARTICIPANT_ID),
            "team_id": None,
        })
        teams_chain = _make_chain(execute_data={
            "id": str(TEAM_ID),
            "name": "TestTeam",
            "epoch_id": str(EPOCH_ID),
        })
        # Default max_team_size is 3, so 3 members = full
        members_chain = _make_chain(execute_data=[
            {"id": str(uuid4())},
            {"id": str(uuid4())},
            {"id": str(uuid4())},
        ])

        participant_call = {"n": 0}

        def table_router(name):
            if name == "epoch_participants":
                participant_call["n"] += 1
                if participant_call["n"] == 1:
                    return participants_proposer
                return members_chain
            if name == "epoch_teams":
                return teams_chain
            return _make_chain()

        sb = MagicMock()
        sb.table.side_effect = table_router

        with patch(
            "backend.services.epoch_service.EpochService.get",
            new_callable=AsyncMock,
            return_value=EPOCH_DATA_COMPETITION,
        ):
            with pytest.raises(HTTPException) as exc:
                await AllianceService.create_proposal(
                    sb, EPOCH_ID, TEAM_ID, PROPOSER_SIM_ID,
                )
            assert exc.value.status_code == 400
            assert "full" in exc.value.detail.lower()

    @pytest.mark.asyncio
    @patch("backend.services.alliance_service.BattleLogService")
    async def test_auto_accepts_solo_team(self, mock_bls):
        """Solo team (1 member) auto-accepts: status='accepted', team_id updated."""
        mock_bls.log_alliance_proposal_resolved = AsyncMock()

        proposal_record = {
            "id": str(PROPOSAL_ID),
            "epoch_id": str(EPOCH_ID),
            "team_id": str(TEAM_ID),
            "proposer_simulation_id": str(PROPOSER_SIM_ID),
            "status": "accepted",
        }

        participants_proposer = _make_chain(execute_data={
            "id": str(PARTICIPANT_ID),
            "team_id": None,
        })
        teams_chain = _make_chain(execute_data={
            "id": str(TEAM_ID),
            "name": "SoloTeam",
            "epoch_id": str(EPOCH_ID),
        })
        # 1 member = solo team
        members_chain = _make_chain(execute_data=[{"id": str(uuid4())}])
        # update chain for setting team_id on participant
        update_chain = _make_chain(execute_data=[{"id": str(PARTICIPANT_ID)}])
        # insert proposal chain
        insert_chain = _make_chain(execute_data=[proposal_record])

        participant_call = {"n": 0}

        def table_router(name):
            if name == "epoch_participants":
                participant_call["n"] += 1
                if participant_call["n"] == 1:
                    return participants_proposer  # proposer lookup
                if participant_call["n"] == 2:
                    return members_chain  # member count
                return update_chain  # update team_id
            if name == "epoch_teams":
                return teams_chain
            if name == "epoch_alliance_proposals":
                return insert_chain
            return _make_chain()

        sb = MagicMock()
        sb.table.side_effect = table_router

        with patch(
            "backend.services.epoch_service.EpochService.get",
            new_callable=AsyncMock,
            return_value=EPOCH_DATA_COMPETITION,
        ):
            result = await AllianceService.create_proposal(
                sb, EPOCH_ID, TEAM_ID, PROPOSER_SIM_ID,
            )

        assert result["status"] == "accepted"
        mock_bls.log_alliance_proposal_resolved.assert_awaited_once_with(
            sb, EPOCH_ID, 5, PROPOSER_SIM_ID, "SoloTeam", "accepted",
        )

    @pytest.mark.asyncio
    @patch("backend.services.alliance_service.BattleLogService")
    async def test_creates_pending_proposal(self, mock_bls):
        """Multi-member team creates a pending proposal requiring votes."""
        mock_bls.log_alliance_proposal = AsyncMock()

        proposal_record = {
            "id": str(PROPOSAL_ID),
            "epoch_id": str(EPOCH_ID),
            "team_id": str(TEAM_ID),
            "proposer_simulation_id": str(PROPOSER_SIM_ID),
            "status": "pending",
            "expires_at_cycle": 7,
        }

        participants_proposer = _make_chain(execute_data={
            "id": str(PARTICIPANT_ID),
            "team_id": None,
        })
        teams_chain = _make_chain(execute_data={
            "id": str(TEAM_ID),
            "name": "MultiTeam",
            "epoch_id": str(EPOCH_ID),
        })
        # 2 members = needs vote
        members_chain = _make_chain(execute_data=[
            {"id": str(uuid4())},
            {"id": str(uuid4())},
        ])
        insert_chain = _make_chain(execute_data=[proposal_record])

        participant_call = {"n": 0}

        def table_router(name):
            if name == "epoch_participants":
                participant_call["n"] += 1
                if participant_call["n"] == 1:
                    return participants_proposer
                return members_chain
            if name == "epoch_teams":
                return teams_chain
            if name == "epoch_alliance_proposals":
                return insert_chain
            return _make_chain()

        sb = MagicMock()
        sb.table.side_effect = table_router

        with patch(
            "backend.services.epoch_service.EpochService.get",
            new_callable=AsyncMock,
            return_value=EPOCH_DATA_COMPETITION,
        ):
            result = await AllianceService.create_proposal(
                sb, EPOCH_ID, TEAM_ID, PROPOSER_SIM_ID,
            )

        assert result["status"] == "pending"
        assert result["expires_at_cycle"] == 7
        mock_bls.log_alliance_proposal.assert_awaited_once_with(
            sb, EPOCH_ID, 5, PROPOSER_SIM_ID, "MultiTeam",
        )


# ── TestInviteToTeam ──────────────────────────────────────────


class TestInviteToTeam:
    """Tests for AllianceService.invite_to_team."""

    @pytest.mark.asyncio
    @patch("backend.services.alliance_service.BattleLogService")
    async def test_rejects_if_inviter_not_on_team(self, mock_bls):
        """Inviter must be a member of the target team."""
        inviter_chain = _make_chain(execute_data={
            "id": str(PARTICIPANT_ID),
            "team_id": str(uuid4()),  # different team
        })

        sb = _make_sb(table_map={"epoch_participants": inviter_chain})

        with pytest.raises(HTTPException) as exc:
            await AllianceService.invite_to_team(
                sb, EPOCH_ID, TEAM_ID, INVITER_SIM_ID, TARGET_SIM_ID,
            )
        assert exc.value.status_code == 403
        assert "member of this team" in exc.value.detail.lower()

    @pytest.mark.asyncio
    @patch("backend.services.alliance_service.BattleLogService")
    async def test_delegates_to_create_proposal(self, mock_bls):
        """After inviter validation, delegates to create_proposal with target as proposer."""
        inviter_chain = _make_chain(execute_data={
            "id": str(PARTICIPANT_ID),
            "team_id": str(TEAM_ID),
        })

        sb = _make_sb(table_map={"epoch_participants": inviter_chain})

        expected_result = {"id": str(PROPOSAL_ID), "status": "pending"}

        with patch.object(
            AllianceService, "create_proposal",
            new_callable=AsyncMock,
            return_value=expected_result,
        ) as mock_create:
            result = await AllianceService.invite_to_team(
                sb, EPOCH_ID, TEAM_ID, INVITER_SIM_ID, TARGET_SIM_ID,
            )

        assert result == expected_result
        mock_create.assert_awaited_once_with(
            sb, EPOCH_ID, TEAM_ID, TARGET_SIM_ID,
        )


# ── TestVoteOnProposal ────────────────────────────────────────


class TestVoteOnProposal:
    """Tests for AllianceService.vote_on_proposal."""

    @pytest.mark.asyncio
    @patch("backend.services.alliance_service.BattleLogService")
    async def test_rejects_if_proposal_not_found(self, mock_bls):
        """Non-existent proposal raises 404."""
        proposal_chain = _make_chain(execute_data=None)
        sb = _make_sb(table_map={"epoch_alliance_proposals": proposal_chain})

        with pytest.raises(HTTPException) as exc:
            await AllianceService.vote_on_proposal(
                sb, PROPOSAL_ID, VOTER_SIM_ID, "accept",
            )
        assert exc.value.status_code == 404
        assert "not found" in exc.value.detail.lower()

    @pytest.mark.asyncio
    @patch("backend.services.alliance_service.BattleLogService")
    async def test_rejects_if_proposal_already_resolved(self, mock_bls):
        """Already accepted/rejected proposal raises 400."""
        proposal_chain = _make_chain(execute_data={
            "id": str(PROPOSAL_ID),
            "epoch_id": str(EPOCH_ID),
            "team_id": str(TEAM_ID),
            "proposer_simulation_id": str(PROPOSER_SIM_ID),
            "status": "accepted",
        })

        sb = _make_sb(table_map={"epoch_alliance_proposals": proposal_chain})

        with pytest.raises(HTTPException) as exc:
            await AllianceService.vote_on_proposal(
                sb, PROPOSAL_ID, VOTER_SIM_ID, "accept",
            )
        assert exc.value.status_code == 400
        assert "already accepted" in exc.value.detail.lower()

    @pytest.mark.asyncio
    @patch("backend.services.alliance_service.BattleLogService")
    async def test_rejects_if_voter_not_team_member(self, mock_bls):
        """Voter must be a member of the proposal's target team."""
        proposal_data = {
            "id": str(PROPOSAL_ID),
            "epoch_id": str(EPOCH_ID),
            "team_id": str(TEAM_ID),
            "proposer_simulation_id": str(PROPOSER_SIM_ID),
            "status": "pending",
        }
        proposal_chain = _make_chain(execute_data=proposal_data)
        voter_chain = _make_chain(execute_data={
            "id": str(PARTICIPANT_ID),
            "team_id": str(uuid4()),  # different team
        })

        def table_router(name):
            if name == "epoch_alliance_proposals":
                return proposal_chain
            if name == "epoch_participants":
                return voter_chain
            return _make_chain()

        sb = MagicMock()
        sb.table.side_effect = table_router

        with pytest.raises(HTTPException) as exc:
            await AllianceService.vote_on_proposal(
                sb, PROPOSAL_ID, VOTER_SIM_ID, "accept",
            )
        assert exc.value.status_code == 403
        assert "team members" in exc.value.detail.lower()

    @pytest.mark.asyncio
    @patch("backend.services.alliance_service.BattleLogService")
    async def test_casts_vote_successfully(self, mock_bls):
        """Valid vote is inserted and returned; no resolution log if still pending."""
        proposal_data = {
            "id": str(PROPOSAL_ID),
            "epoch_id": str(EPOCH_ID),
            "team_id": str(TEAM_ID),
            "proposer_simulation_id": str(PROPOSER_SIM_ID),
            "status": "pending",
            "epoch_teams": {"name": "VoteTeam"},
        }
        voter_data = {
            "id": str(PARTICIPANT_ID),
            "team_id": str(TEAM_ID),
        }
        vote_record = {
            "id": str(uuid4()),
            "proposal_id": str(PROPOSAL_ID),
            "voter_simulation_id": str(VOTER_SIM_ID),
            "vote": "accept",
        }
        # After vote, proposal is still pending (not resolved by trigger)
        updated_proposal_data = {"status": "pending"}

        proposal_call = {"n": 0}

        def table_router(name):
            if name == "epoch_alliance_proposals":
                proposal_call["n"] += 1
                if proposal_call["n"] == 1:
                    return _make_chain(execute_data=proposal_data)  # initial fetch
                return _make_chain(execute_data=updated_proposal_data)  # post-vote check
            if name == "epoch_participants":
                return _make_chain(execute_data=voter_data)
            if name == "epoch_alliance_votes":
                return _make_chain(execute_data=[vote_record])
            return _make_chain()

        sb = MagicMock()
        sb.table.side_effect = table_router

        result = await AllianceService.vote_on_proposal(
            sb, PROPOSAL_ID, VOTER_SIM_ID, "accept",
        )

        assert result["vote"] == "accept"
        # BattleLogService.log_alliance_proposal_resolved should NOT be called
        mock_bls.log_alliance_proposal_resolved.assert_not_called()

    @pytest.mark.asyncio
    @patch("backend.services.alliance_service.BattleLogService")
    async def test_logs_resolution_on_accept(self, mock_bls):
        """When trigger resolves proposal to 'accepted', log the resolution."""
        mock_bls.log_alliance_proposal_resolved = AsyncMock()

        proposal_data = {
            "id": str(PROPOSAL_ID),
            "epoch_id": str(EPOCH_ID),
            "team_id": str(TEAM_ID),
            "proposer_simulation_id": str(PROPOSER_SIM_ID),
            "status": "pending",
            "epoch_teams": {"name": "ResolvedTeam"},
        }
        voter_data = {
            "id": str(PARTICIPANT_ID),
            "team_id": str(TEAM_ID),
        }
        vote_record = {
            "id": str(uuid4()),
            "proposal_id": str(PROPOSAL_ID),
            "voter_simulation_id": str(VOTER_SIM_ID),
            "vote": "accept",
        }
        # After vote, the DB trigger resolved it to "accepted"
        updated_proposal_data = {"status": "accepted"}

        proposal_call = {"n": 0}

        def table_router(name):
            if name == "epoch_alliance_proposals":
                proposal_call["n"] += 1
                if proposal_call["n"] == 1:
                    return _make_chain(execute_data=proposal_data)
                return _make_chain(execute_data=updated_proposal_data)
            if name == "epoch_participants":
                return _make_chain(execute_data=voter_data)
            if name == "epoch_alliance_votes":
                return _make_chain(execute_data=[vote_record])
            return _make_chain()

        sb = MagicMock()
        sb.table.side_effect = table_router

        with patch(
            "backend.services.epoch_service.EpochService.get",
            new_callable=AsyncMock,
            return_value=EPOCH_DATA_COMPETITION,
        ):
            result = await AllianceService.vote_on_proposal(
                sb, PROPOSAL_ID, VOTER_SIM_ID, "accept",
            )

        assert result["vote"] == "accept"
        mock_bls.log_alliance_proposal_resolved.assert_awaited_once_with(
            sb,
            UUID(str(EPOCH_ID)),
            5,
            UUID(str(PROPOSER_SIM_ID)),
            "ResolvedTeam",
            "accepted",
        )


# ── TestListProposals ─────────────────────────────────────────


class TestListProposals:
    """Tests for AllianceService.list_proposals."""

    @pytest.mark.asyncio
    async def test_returns_enriched_proposals(self):
        """Proposals are enriched with proposer_name and votes fields."""
        raw_proposals = [
            {
                "id": str(PROPOSAL_ID),
                "epoch_id": str(EPOCH_ID),
                "team_id": str(TEAM_ID),
                "status": "pending",
                "simulations": {"name": "AlphaOps"},
                "epoch_alliance_votes": [
                    {"voter_simulation_id": str(VOTER_SIM_ID), "vote": "accept"},
                ],
            },
        ]
        proposals_chain = _make_chain(execute_data=raw_proposals)

        sb = _make_sb(table_map={"epoch_alliance_proposals": proposals_chain})

        result = await AllianceService.list_proposals(sb, EPOCH_ID)

        assert len(result) == 1
        assert result[0]["proposer_name"] == "AlphaOps"
        assert result[0]["votes"] == [
            {"voter_simulation_id": str(VOTER_SIM_ID), "vote": "accept"},
        ]
        # Original keys should be removed
        assert "simulations" not in result[0]
        assert "epoch_alliance_votes" not in result[0]

    @pytest.mark.asyncio
    async def test_filters_by_team_id(self):
        """Passing team_id applies an eq filter on team_id."""
        proposals_chain = _make_chain(execute_data=[])
        sb = _make_sb(table_map={"epoch_alliance_proposals": proposals_chain})

        await AllianceService.list_proposals(sb, EPOCH_ID, team_id=TEAM_ID)

        # Verify eq was called with team_id
        proposals_chain.eq.assert_any_call("team_id", str(TEAM_ID))

    @pytest.mark.asyncio
    async def test_filters_by_status(self):
        """Passing status_filter applies an eq filter on status."""
        proposals_chain = _make_chain(execute_data=[])
        sb = _make_sb(table_map={"epoch_alliance_proposals": proposals_chain})

        await AllianceService.list_proposals(
            sb, EPOCH_ID, status_filter="pending",
        )

        proposals_chain.eq.assert_any_call("status", "pending")


# ── TestExpireProposals ───────────────────────────────────────


class TestExpireProposals:
    """Tests for AllianceService.expire_proposals."""

    @pytest.mark.asyncio
    async def test_calls_rpc_with_correct_params(self):
        """RPC is called with epoch_id and current_cycle."""
        sb = _make_sb(rpc_data=3)

        await AllianceService.expire_proposals(sb, EPOCH_ID, 5)

        sb.rpc.assert_called_once_with(
            "fn_expire_alliance_proposals",
            {"p_epoch_id": str(EPOCH_ID), "p_current_cycle": 5},
        )

    @pytest.mark.asyncio
    async def test_returns_expired_count(self):
        """Return value is the integer count from the RPC."""
        sb = _make_sb(rpc_data=7)

        result = await AllianceService.expire_proposals(sb, EPOCH_ID, 5)

        assert result == 7

    @pytest.mark.asyncio
    async def test_returns_zero_for_non_int(self):
        """Non-integer RPC response defaults to 0."""
        sb = _make_sb(rpc_data=None)

        result = await AllianceService.expire_proposals(sb, EPOCH_ID, 5)

        assert result == 0


# ── TestDeductUpkeep ──────────────────────────────────────────


class TestDeductUpkeep:
    """Tests for AllianceService.deduct_upkeep."""

    @pytest.mark.asyncio
    @patch("backend.services.alliance_service.BattleLogService")
    async def test_calls_rpc_and_logs_per_team(self, mock_bls):
        """Each team result is logged via BattleLogService.log_alliance_upkeep."""
        mock_bls.log_alliance_upkeep = AsyncMock()

        team_results = [
            {"team_name": "Alpha", "cost_per_member": 2, "member_count": 3},
            {"team_name": "Bravo", "cost_per_member": 3, "member_count": 2},
        ]
        sb = _make_sb(rpc_data=team_results)

        result = await AllianceService.deduct_upkeep(sb, EPOCH_ID, 5)

        assert len(result) == 2
        sb.rpc.assert_called_once_with(
            "fn_deduct_alliance_upkeep",
            {"p_epoch_id": str(EPOCH_ID)},
        )
        assert mock_bls.log_alliance_upkeep.await_count == 2
        mock_bls.log_alliance_upkeep.assert_any_await(
            sb, EPOCH_ID, 5, "Alpha", 2, 3,
        )
        mock_bls.log_alliance_upkeep.assert_any_await(
            sb, EPOCH_ID, 5, "Bravo", 3, 2,
        )

    @pytest.mark.asyncio
    @patch("backend.services.alliance_service.BattleLogService")
    async def test_handles_empty_result(self, mock_bls):
        """Empty RPC result returns empty list and no logging."""
        mock_bls.log_alliance_upkeep = AsyncMock()
        sb = _make_sb(rpc_data=[])

        result = await AllianceService.deduct_upkeep(sb, EPOCH_ID, 5)

        assert result == []
        mock_bls.log_alliance_upkeep.assert_not_awaited()


# ── TestComputeTension ────────────────────────────────────────


class TestComputeTension:
    """Tests for AllianceService.compute_tension."""

    @pytest.mark.asyncio
    @patch("backend.services.alliance_service.BattleLogService")
    async def test_logs_tension_increase(self, mock_bls):
        """Tension increase (new > old) is logged via log_tension_change."""
        mock_bls.log_tension_change = AsyncMock()
        mock_bls.log_tension_dissolution = AsyncMock()

        tension_results = [
            {
                "team_id": str(TEAM_ID),
                "team_name": "TenseTeam",
                "old_tension": 20,
                "new_tension": 40,
                "dissolved": False,
            },
        ]
        sb = _make_sb(rpc_data=tension_results)

        result = await AllianceService.compute_tension(sb, EPOCH_ID, 5)

        assert len(result) == 1
        mock_bls.log_tension_change.assert_awaited_once_with(
            sb, EPOCH_ID, 5, "TenseTeam", 20, 40,
        )
        mock_bls.log_tension_dissolution.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("backend.services.alliance_service.BattleLogService")
    async def test_logs_dissolution_with_affected_members(self, mock_bls):
        """Dissolved team logs dissolution with affected member simulation_ids."""
        mock_bls.log_tension_change = AsyncMock()
        mock_bls.log_tension_dissolution = AsyncMock()

        sim_a = str(uuid4())
        sim_b = str(uuid4())

        tension_results = [
            {
                "team_id": str(TEAM_ID),
                "team_name": "BrokenTeam",
                "old_tension": 80,
                "new_tension": 100,
                "dissolved": True,
            },
        ]

        members_chain = _make_chain(execute_data=[
            {"simulation_id": sim_a},
            {"simulation_id": sim_b},
        ])

        rpc_chain = _make_chain(execute_data=tension_results)

        sb = MagicMock()
        sb.rpc.return_value = rpc_chain
        sb.table.return_value = members_chain

        result = await AllianceService.compute_tension(sb, EPOCH_ID, 5)

        assert len(result) == 1
        # Tension increased so log_tension_change should be called
        mock_bls.log_tension_change.assert_awaited_once_with(
            sb, EPOCH_ID, 5, "BrokenTeam", 80, 100,
        )
        mock_bls.log_tension_dissolution.assert_awaited_once_with(
            sb, EPOCH_ID, 5, "BrokenTeam", [sim_a, sim_b],
        )

    @pytest.mark.asyncio
    @patch("backend.services.alliance_service.BattleLogService")
    async def test_skips_logging_when_tension_unchanged(self, mock_bls):
        """No logging when tension does not increase."""
        mock_bls.log_tension_change = AsyncMock()
        mock_bls.log_tension_dissolution = AsyncMock()

        tension_results = [
            {
                "team_id": str(TEAM_ID),
                "team_name": "StableTeam",
                "old_tension": 30,
                "new_tension": 30,
                "dissolved": False,
            },
        ]
        sb = _make_sb(rpc_data=tension_results)

        result = await AllianceService.compute_tension(sb, EPOCH_ID, 5)

        assert len(result) == 1
        mock_bls.log_tension_change.assert_not_awaited()
        mock_bls.log_tension_dissolution.assert_not_awaited()


# ── TestClearDissolvedTeamIds ────────────────────────────────


class TestClearDissolvedTeamIds:
    """Tests for AllianceService.clear_dissolved_team_ids."""

    @pytest.mark.asyncio
    async def test_clears_team_ids_for_dissolved_teams(self):
        """Dissolved teams' members get their team_id set to None."""
        dissolved_team_a = str(uuid4())
        dissolved_team_b = str(uuid4())

        teams_chain = _make_chain(execute_data=[
            {"id": dissolved_team_a},
            {"id": dissolved_team_b},
        ])
        update_chain = _make_chain(execute_data=[])


        def table_router(name):
            if name == "epoch_teams":
                return teams_chain
            if name == "epoch_participants":
                return update_chain
            return _make_chain()

        sb = MagicMock()
        sb.table.side_effect = table_router

        await AllianceService.clear_dissolved_team_ids(sb, EPOCH_ID)

        # update should be called for each dissolved team (2 teams)
        # Each call does: .update({team_id: None}).eq(epoch_id).eq(team_id).execute()
        assert update_chain.update.call_count == 2
        update_chain.update.assert_any_call({"team_id": None})

    @pytest.mark.asyncio
    async def test_handles_no_dissolved_teams(self):
        """No dissolved teams means no update calls."""
        teams_chain = _make_chain(execute_data=[])
        update_chain = _make_chain(execute_data=[])

        def table_router(name):
            if name == "epoch_teams":
                return teams_chain
            if name == "epoch_participants":
                return update_chain
            return _make_chain()

        sb = MagicMock()
        sb.table.side_effect = table_router

        await AllianceService.clear_dissolved_team_ids(sb, EPOCH_ID)

        update_chain.update.assert_not_called()


# ── TestDissolveTeam ──────────────────────────────────────────


class TestDissolveTeam:
    """Tests for AllianceService.dissolve_team."""

    @pytest.mark.asyncio
    @patch("backend.services.alliance_service.BattleLogService")
    async def test_sets_dissolved_fields_and_clears_members(self, mock_bls):
        """dissolve_team sets dissolved_at/reason, clears member team_ids, logs event."""
        mock_bls.log_event = AsyncMock()

        team_name_chain = _make_chain(execute_data={"name": "DoomedTeam"})
        update_team_chain = _make_chain(execute_data=[])
        update_participants_chain = _make_chain(execute_data=[])

        table_calls = {"epoch_teams": 0, "epoch_participants": 0}

        def table_router(name):
            if name == "epoch_teams":
                table_calls["epoch_teams"] += 1
                if table_calls["epoch_teams"] == 1:
                    return team_name_chain  # get team name
                return update_team_chain  # set dissolved_at
            if name == "epoch_participants":
                return update_participants_chain  # clear team_id
            return _make_chain()

        sb = MagicMock()
        sb.table.side_effect = table_router

        with patch(
            "backend.services.epoch_service.EpochService.get",
            new_callable=AsyncMock,
            return_value=EPOCH_DATA_COMPETITION,
        ):
            await AllianceService.dissolve_team(
                sb, EPOCH_ID, TEAM_ID, "tension_max",
            )

        # Team was updated with dissolved fields
        update_team_chain.update.assert_called_once()
        update_args = update_team_chain.update.call_args[0][0]
        assert "dissolved_at" in update_args
        assert update_args["dissolved_reason"] == "tension_max"

        # Participants had team_id cleared
        update_participants_chain.update.assert_called_once_with({"team_id": None})

        # Battle log event was logged
        mock_bls.log_event.assert_awaited_once()
        call_args = mock_bls.log_event.call_args
        assert call_args[0][0] is sb
        assert call_args[0][1] == EPOCH_ID
        assert call_args[0][2] == 5  # current_cycle from EPOCH_DATA_COMPETITION
        assert call_args[0][3] == "alliance_dissolved"
        assert "DoomedTeam" in call_args[0][4]
        assert call_args[1]["is_public"] is True
        assert call_args[1]["metadata"]["team_name"] == "DoomedTeam"
        assert call_args[1]["metadata"]["reason"] == "tension_max"
