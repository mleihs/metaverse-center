"""Unit tests for ScoringService — 5-dimension scoring, normalization, compositing."""

from __future__ import annotations

import logging
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

from backend.services.scoring_service import ScoringService

# ── Helpers ────────────────────────────────────────────────────

EPOCH_ID = uuid4()
SIM_ID_A = str(uuid4())
SIM_ID_B = str(uuid4())
SIM_ID_C = str(uuid4())


def _make_chain(**kwargs):
    """Create a mock Supabase query chain."""
    c = MagicMock()
    c.select.return_value = c
    c.eq.return_value = c
    c.in_.return_value = c
    c.or_.return_value = c
    c.single.return_value = c
    c.maybe_single.return_value = c
    c.limit.return_value = c
    c.order.return_value = c
    c.insert.return_value = c
    c.update.return_value = c
    c.upsert.return_value = c
    c.range.return_value = c
    c.is_.return_value = c
    for k, v in kwargs.items():
        setattr(c, k, v)
    return c


# ── Stability Scoring ──────────────────────────────────────────


class TestComputeStability:
    @pytest.mark.asyncio
    async def test_base_stability_from_zone_data(self):
        """Stability = avg(zone_stability) * 100 with no penalties."""
        sb = MagicMock()

        mv_chain = _make_chain()
        mv_chain.execute.return_value = MagicMock(
            data=[{"stability": 0.8}, {"stability": 0.6}]
        )

        events_chain = _make_chain()
        events_chain.execute.return_value = MagicMock(data=[], count=0)

        missions_chain = _make_chain()
        missions_chain.execute.return_value = MagicMock(data=[])

        def table_router(name):
            if name == "mv_zone_stability":
                return mv_chain
            if name == "events":
                return events_chain
            if name == "operative_missions":
                return missions_chain
            return _make_chain()

        sb.table.side_effect = table_router

        result = await ScoringService._compute_stability(sb, EPOCH_ID, SIM_ID_A)

        # avg(0.8, 0.6) * 100 = 70.0
        assert result == 70.0

    @pytest.mark.asyncio
    async def test_stability_penalized_by_propaganda(self):
        """Each propaganda event reduces stability by 3."""
        sb = MagicMock()

        mv_chain = _make_chain()
        mv_chain.execute.return_value = MagicMock(
            data=[{"stability": 1.0}]
        )

        events_chain = _make_chain()
        events_chain.execute.return_value = MagicMock(data=[], count=4)

        missions_chain = _make_chain()
        missions_chain.execute.return_value = MagicMock(data=[])

        def table_router(name):
            if name == "mv_zone_stability":
                return mv_chain
            if name == "events":
                return events_chain
            if name == "operative_missions":
                return missions_chain
            return _make_chain()

        sb.table.side_effect = table_router

        result = await ScoringService._compute_stability(sb, EPOCH_ID, SIM_ID_A)

        # 100.0 - 4*3 = 88.0
        assert result == 88.0

    @pytest.mark.asyncio
    async def test_stability_penalized_by_saboteur_and_assassin(self):
        """Saboteur=-6, Assassin=-5 per successful inbound mission."""
        sb = MagicMock()

        mv_chain = _make_chain()
        mv_chain.execute.return_value = MagicMock(
            data=[{"stability": 1.0}]
        )

        events_chain = _make_chain()
        events_chain.execute.return_value = MagicMock(data=[], count=0)

        missions_chain = _make_chain()
        missions_chain.execute.return_value = MagicMock(
            data=[
                {"operative_type": "saboteur"},
                {"operative_type": "saboteur"},
                {"operative_type": "assassin"},
            ]
        )

        def table_router(name):
            if name == "mv_zone_stability":
                return mv_chain
            if name == "events":
                return events_chain
            if name == "operative_missions":
                return missions_chain
            return _make_chain()

        sb.table.side_effect = table_router

        result = await ScoringService._compute_stability(sb, EPOCH_ID, SIM_ID_A)

        # 100.0 - 0 - 2*6 - 1*5 = 100 - 12 - 5 = 83.0
        assert result == 83.0

    @pytest.mark.asyncio
    async def test_stability_floors_at_zero(self):
        """Stability cannot go negative."""
        sb = MagicMock()

        mv_chain = _make_chain()
        mv_chain.execute.return_value = MagicMock(
            data=[{"stability": 0.1}]
        )

        events_chain = _make_chain()
        events_chain.execute.return_value = MagicMock(data=[], count=20)

        missions_chain = _make_chain()
        missions_chain.execute.return_value = MagicMock(
            data=[{"operative_type": "saboteur"}] * 10
        )

        def table_router(name):
            if name == "mv_zone_stability":
                return mv_chain
            if name == "events":
                return events_chain
            if name == "operative_missions":
                return missions_chain
            return _make_chain()

        sb.table.side_effect = table_router

        result = await ScoringService._compute_stability(sb, EPOCH_ID, SIM_ID_A)

        assert result == 0.0

    @pytest.mark.asyncio
    async def test_stability_defaults_to_50_when_no_zones(self):
        """When no zone stability data exists, use 50.0 base."""
        sb = MagicMock()

        mv_chain = _make_chain()
        mv_chain.execute.return_value = MagicMock(data=[])

        events_chain = _make_chain()
        events_chain.execute.return_value = MagicMock(data=[], count=0)

        missions_chain = _make_chain()
        missions_chain.execute.return_value = MagicMock(data=[])

        def table_router(name):
            if name == "mv_zone_stability":
                return mv_chain
            if name == "events":
                return events_chain
            if name == "operative_missions":
                return missions_chain
            return _make_chain()

        sb.table.side_effect = table_router

        result = await ScoringService._compute_stability(sb, EPOCH_ID, SIM_ID_A)

        assert result == 50.0


# ── Influence Scoring ──────────────────────────────────────────


class TestComputeInfluence:
    @pytest.mark.asyncio
    async def test_influence_from_successful_missions(self):
        """propagandist=5, spy=2, infiltrator=3 per successful outbound mission."""
        sb = MagicMock()

        missions_chain = _make_chain()
        missions_chain.execute.return_value = MagicMock(
            data=[
                {"operative_type": "propagandist"},
                {"operative_type": "propagandist"},
                {"operative_type": "spy"},
                {"operative_type": "infiltrator"},
            ]
        )

        echo_chain = _make_chain()
        echo_chain.execute.return_value = MagicMock(data=[])

        def table_router(name):
            if name == "operative_missions":
                return missions_chain
            if name == "event_echoes":
                return echo_chain
            return _make_chain()

        sb.table.side_effect = table_router

        result = await ScoringService._compute_influence(sb, EPOCH_ID, SIM_ID_A)

        # 2*5 + 1*2 + 1*3 = 15
        assert result == 15.0

    @pytest.mark.asyncio
    async def test_influence_includes_echo_strength(self):
        """Echo strength from bleed system adds to influence."""
        sb = MagicMock()

        missions_chain = _make_chain()
        missions_chain.execute.return_value = MagicMock(data=[])

        echo_chain = _make_chain()
        echo_chain.execute.return_value = MagicMock(
            data=[
                {"echo_strength": 3},
                {"echo_strength": 5},
            ]
        )

        def table_router(name):
            if name == "operative_missions":
                return missions_chain
            if name == "event_echoes":
                return echo_chain
            return _make_chain()

        sb.table.side_effect = table_router

        result = await ScoringService._compute_influence(sb, EPOCH_ID, SIM_ID_A)

        assert result == 8.0

    @pytest.mark.asyncio
    async def test_influence_zero_with_no_missions_or_echoes(self):
        sb = MagicMock()

        missions_chain = _make_chain()
        missions_chain.execute.return_value = MagicMock(data=[])

        echo_chain = _make_chain()
        echo_chain.execute.return_value = MagicMock(data=[])

        def table_router(name):
            if name == "operative_missions":
                return missions_chain
            if name == "event_echoes":
                return echo_chain
            return _make_chain()

        sb.table.side_effect = table_router

        result = await ScoringService._compute_influence(sb, EPOCH_ID, SIM_ID_A)

        assert result == 0.0


# ── Sovereignty Scoring ────────────────────────────────────────


class TestComputeSovereignty:
    @pytest.mark.asyncio
    async def test_sovereignty_baseline_100(self):
        """No attacks → sovereignty = 100."""
        sb = MagicMock()

        inbound_chain = _make_chain()
        inbound_chain.execute.return_value = MagicMock(data=[])

        guardian_chain = _make_chain()
        guardian_chain.execute.return_value = MagicMock(data=[])

        call_count = {"operative_missions": 0}

        def table_router(name):
            if name == "operative_missions":
                call_count["operative_missions"] += 1
                if call_count["operative_missions"] == 1:
                    return inbound_chain  # inbound missions
                return guardian_chain  # guardian count
            return _make_chain()

        sb.table.side_effect = table_router

        result = await ScoringService._compute_sovereignty(sb, EPOCH_ID, SIM_ID_A)

        assert result == 100.0

    @pytest.mark.asyncio
    async def test_sovereignty_penalized_by_successful_inbound(self):
        """Each successful inbound spy costs -2, saboteur -8, assassin -12."""
        sb = MagicMock()

        inbound_chain = _make_chain()
        inbound_chain.execute.return_value = MagicMock(
            data=[
                {"operative_type": "spy", "status": "success"},
                {"operative_type": "saboteur", "status": "success"},
                {"operative_type": "assassin", "status": "success"},
            ]
        )

        guardian_chain = _make_chain()
        guardian_chain.execute.return_value = MagicMock(data=[])

        call_count = {"operative_missions": 0}

        def table_router(name):
            if name == "operative_missions":
                call_count["operative_missions"] += 1
                if call_count["operative_missions"] == 1:
                    return inbound_chain
                return guardian_chain
            return _make_chain()

        sb.table.side_effect = table_router

        result = await ScoringService._compute_sovereignty(sb, EPOCH_ID, SIM_ID_A)

        # 100 - 2 - 8 - 12 = 78
        assert result == 78.0

    @pytest.mark.asyncio
    async def test_sovereignty_bonus_from_detected_missions(self):
        """+3 per detected inbound mission."""
        sb = MagicMock()

        inbound_chain = _make_chain()
        inbound_chain.execute.return_value = MagicMock(
            data=[
                {"operative_type": "spy", "status": "detected"},
                {"operative_type": "saboteur", "status": "detected"},
            ]
        )

        guardian_chain = _make_chain()
        guardian_chain.execute.return_value = MagicMock(data=[])

        call_count = {"operative_missions": 0}

        def table_router(name):
            if name == "operative_missions":
                call_count["operative_missions"] += 1
                if call_count["operative_missions"] == 1:
                    return inbound_chain
                return guardian_chain
            return _make_chain()

        sb.table.side_effect = table_router

        result = await ScoringService._compute_sovereignty(sb, EPOCH_ID, SIM_ID_A)

        # 100 + 2*3 = 106, clamped to 100
        assert result == 100.0

    @pytest.mark.asyncio
    async def test_sovereignty_bonus_from_guardians(self):
        """+4 per active guardian."""
        sb = MagicMock()

        inbound_chain = _make_chain()
        inbound_chain.execute.return_value = MagicMock(data=[])

        guardian_chain = _make_chain()
        guardian_chain.execute.return_value = MagicMock(
            data=[{"id": "g1"}, {"id": "g2"}, {"id": "g3"}]
        )

        call_count = {"operative_missions": 0}

        def table_router(name):
            if name == "operative_missions":
                call_count["operative_missions"] += 1
                if call_count["operative_missions"] == 1:
                    return inbound_chain
                return guardian_chain
            return _make_chain()

        sb.table.side_effect = table_router

        result = await ScoringService._compute_sovereignty(sb, EPOCH_ID, SIM_ID_A)

        # 100 + 3*4 = 112, clamped to 100
        assert result == 100.0

    @pytest.mark.asyncio
    async def test_sovereignty_clamped_to_zero(self):
        """Sovereignty cannot go negative."""
        sb = MagicMock()

        inbound_chain = _make_chain()
        inbound_chain.execute.return_value = MagicMock(
            data=[{"operative_type": "assassin", "status": "success"}] * 10
        )

        guardian_chain = _make_chain()
        guardian_chain.execute.return_value = MagicMock(data=[])

        call_count = {"operative_missions": 0}

        def table_router(name):
            if name == "operative_missions":
                call_count["operative_missions"] += 1
                if call_count["operative_missions"] == 1:
                    return inbound_chain
                return guardian_chain
            return _make_chain()

        sb.table.side_effect = table_router

        result = await ScoringService._compute_sovereignty(sb, EPOCH_ID, SIM_ID_A)

        # 100 - 10*12 = -20 → clamped to 0
        assert result == 0.0


# ── Diplomatic Scoring ─────────────────────────────────────────


class TestComputeDiplomatic:
    @pytest.mark.asyncio
    async def test_diplomatic_from_embassy_effectiveness(self):
        """Base diplomatic score is embassy effectiveness * 10."""
        sb = MagicMock()

        mv_chain = _make_chain()
        mv_chain.execute.return_value = MagicMock(
            data=[{"effectiveness": 0.7}, {"effectiveness": 0.5}]
        )

        embassy_chain = _make_chain()
        embassy_chain.execute.return_value = MagicMock(
            data=[{"id": "e1"}, {"id": "e2"}]
        )

        participant_chain = _make_chain()
        participant_chain.execute.return_value = MagicMock(
            data={"team_id": None, "betrayal_penalty": 0}
        )

        spy_chain = _make_chain()
        spy_chain.execute.return_value = MagicMock(data=[], count=0)

        def table_router(name):
            if name == "mv_embassy_effectiveness":
                return mv_chain
            if name == "embassies":
                return embassy_chain
            if name == "epoch_participants":
                return participant_chain
            if name == "operative_missions":
                return spy_chain
            return _make_chain()

        sb.table.side_effect = table_router

        result = await ScoringService._compute_diplomatic(sb, EPOCH_ID, SIM_ID_A)

        # (0.7 + 0.5) * 10 + 0 spy bonus) * 1.0 alliance * 1.0 betrayal = 12.0
        assert result == 12.0

    @pytest.mark.asyncio
    async def test_diplomatic_alliance_bonus(self):
        """Alliance bonus: * (1 + 0.15 * ally_count)."""
        sb = MagicMock()
        team_id = str(uuid4())

        mv_chain = _make_chain()
        mv_chain.execute.return_value = MagicMock(
            data=[{"effectiveness": 1.0}]
        )

        embassy_chain = _make_chain()
        embassy_chain.execute.return_value = MagicMock(
            data=[{"id": "e1"}]
        )

        participant_chain = _make_chain()
        # First call: own participant with team
        participant_responses = [
            MagicMock(data={"team_id": team_id, "betrayal_penalty": 0}),
            # Second call: allies count
            MagicMock(data=[{"id": "p1"}, {"id": "p2"}, {"id": "p3"}]),  # 3 members = 2 allies
        ]
        participant_chain.execute.side_effect = participant_responses

        spy_chain = _make_chain()
        spy_chain.execute.return_value = MagicMock(data=[], count=0)

        def table_router(name):
            if name == "mv_embassy_effectiveness":
                return mv_chain
            if name == "embassies":
                return embassy_chain
            if name == "epoch_participants":
                return participant_chain
            if name == "operative_missions":
                return spy_chain
            return _make_chain()

        sb.table.side_effect = table_router

        result = await ScoringService._compute_diplomatic(sb, EPOCH_ID, SIM_ID_A)

        # (1.0 * 10 + 0) * (1 + 0.15 * 2) * 1.0 = 10 * 1.30 = 13.0
        assert result == 13.0

    @pytest.mark.asyncio
    async def test_diplomatic_betrayal_penalty(self):
        """Betrayal penalty: * (1 - 0.25) = 0.75."""
        sb = MagicMock()

        mv_chain = _make_chain()
        mv_chain.execute.return_value = MagicMock(
            data=[{"effectiveness": 1.0}]
        )

        embassy_chain = _make_chain()
        embassy_chain.execute.return_value = MagicMock(
            data=[{"id": "e1"}]
        )

        participant_chain = _make_chain()
        participant_chain.execute.return_value = MagicMock(
            data={"team_id": None, "betrayal_penalty": 0.25}
        )

        spy_chain = _make_chain()
        spy_chain.execute.return_value = MagicMock(data=[], count=0)

        def table_router(name):
            if name == "mv_embassy_effectiveness":
                return mv_chain
            if name == "embassies":
                return embassy_chain
            if name == "epoch_participants":
                return participant_chain
            if name == "operative_missions":
                return spy_chain
            return _make_chain()

        sb.table.side_effect = table_router

        result = await ScoringService._compute_diplomatic(sb, EPOCH_ID, SIM_ID_A)

        # (1.0 * 10 + 0) * 1.0 * 0.75 = 7.5
        assert result == 7.5

    @pytest.mark.asyncio
    async def test_diplomatic_spy_bonus(self):
        """+1 per successful outbound spy mission."""
        sb = MagicMock()

        mv_chain = _make_chain()
        mv_chain.execute.return_value = MagicMock(
            data=[{"effectiveness": 1.0}]
        )

        embassy_chain = _make_chain()
        embassy_chain.execute.return_value = MagicMock(
            data=[{"id": "e1"}]
        )

        participant_chain = _make_chain()
        participant_chain.execute.return_value = MagicMock(
            data={"team_id": None, "betrayal_penalty": 0}
        )

        spy_chain = _make_chain()
        spy_chain.execute.return_value = MagicMock(data=[], count=3)

        def table_router(name):
            if name == "mv_embassy_effectiveness":
                return mv_chain
            if name == "embassies":
                return embassy_chain
            if name == "epoch_participants":
                return participant_chain
            if name == "operative_missions":
                return spy_chain
            return _make_chain()

        sb.table.side_effect = table_router

        result = await ScoringService._compute_diplomatic(sb, EPOCH_ID, SIM_ID_A)

        # (1.0 * 10 + 3) * 1.0 * 1.0 = 13.0
        assert result == 13.0


# ── Military Scoring ───────────────────────────────────────────


class TestComputeMilitary:
    @pytest.mark.asyncio
    async def test_military_from_successful_missions(self):
        """Each mission type has a score value on success."""
        sb = MagicMock()
        chain = _make_chain()
        chain.execute.return_value = MagicMock(
            data=[
                {"operative_type": "spy", "status": "success"},       # +3
                {"operative_type": "saboteur", "status": "success"},  # +5
                {"operative_type": "assassin", "status": "success"},  # +8
            ]
        )
        sb.table.return_value = chain

        result = await ScoringService._compute_military(sb, EPOCH_ID, SIM_ID_A)

        # 3 + 5 + 8 = 16
        assert result == 16.0

    @pytest.mark.asyncio
    async def test_military_detection_penalty(self):
        """Detected missions incur DETECTION_PENALTY (3) each."""
        sb = MagicMock()
        chain = _make_chain()
        chain.execute.return_value = MagicMock(
            data=[
                {"operative_type": "spy", "status": "success"},     # +3
                {"operative_type": "spy", "status": "detected"},    # -3
                {"operative_type": "spy", "status": "detected"},    # -3
            ]
        )
        sb.table.return_value = chain

        result = await ScoringService._compute_military(sb, EPOCH_ID, SIM_ID_A)

        # 3 - 3 - 3 = -3 → clamped to 0
        assert result == 0.0

    @pytest.mark.asyncio
    async def test_military_floored_at_zero(self):
        """Military score cannot go negative."""
        sb = MagicMock()
        chain = _make_chain()
        chain.execute.return_value = MagicMock(
            data=[
                {"operative_type": "spy", "status": "detected"},
                {"operative_type": "spy", "status": "detected"},
            ]
        )
        sb.table.return_value = chain

        result = await ScoringService._compute_military(sb, EPOCH_ID, SIM_ID_A)

        assert result == 0.0

    @pytest.mark.asyncio
    async def test_military_zero_with_no_missions(self):
        sb = MagicMock()
        chain = _make_chain()
        chain.execute.return_value = MagicMock(data=[])
        sb.table.return_value = chain

        result = await ScoringService._compute_military(sb, EPOCH_ID, SIM_ID_A)

        assert result == 0.0

    @pytest.mark.asyncio
    async def test_military_failed_missions_no_penalty(self):
        """Failed (but not detected) missions incur no penalty."""
        sb = MagicMock()
        chain = _make_chain()
        chain.execute.return_value = MagicMock(
            data=[
                {"operative_type": "spy", "status": "success"},  # +3
                {"operative_type": "spy", "status": "failed"},   # 0
            ]
        )
        sb.table.return_value = chain

        result = await ScoringService._compute_military(sb, EPOCH_ID, SIM_ID_A)

        assert result == 3.0


# ── Normalization & Composite ──────────────────────────────────


class TestNormalizationAndComposite:
    @pytest.mark.asyncio
    async def test_normalize_single_participant(self):
        """Single participant should get composite of 100 (max in all dimensions)."""
        sb = MagicMock()
        score_id = str(uuid4())

        scores_chain = _make_chain()
        scores_chain.execute.return_value = MagicMock(
            data=[{
                "id": score_id,
                "simulation_id": SIM_ID_A,
                "stability_score": 80.0,
                "influence_score": 10.0,
                "sovereignty_score": 90.0,
                "diplomatic_score": 15.0,
                "military_score": 12.0,
                "composite_score": 0,
            }]
        )

        update_chain = _make_chain()
        update_chain.execute.return_value = MagicMock(data=[{}])

        def table_router(name):
            return scores_chain

        sb.table.side_effect = table_router

        epoch = {"config": {}}
        result = await ScoringService._normalize_and_composite(
            sb, EPOCH_ID, 1, epoch,
        )

        assert len(result) == 1
        # Single participant: all normalized to 100, composite = sum(100*w/100)
        # Default weights: 25+20+20+15+20 = 100
        assert result[0]["composite_score"] == 100.0

    @pytest.mark.asyncio
    async def test_normalize_two_participants(self):
        """Two participants: leader gets 100 in each dimension, follower is proportional."""
        sb = MagicMock()

        scores_data = [
            {
                "id": str(uuid4()),
                "simulation_id": SIM_ID_A,
                "stability_score": 100.0,
                "influence_score": 20.0,
                "sovereignty_score": 100.0,
                "diplomatic_score": 20.0,
                "military_score": 20.0,
                "composite_score": 0,
            },
            {
                "id": str(uuid4()),
                "simulation_id": SIM_ID_B,
                "stability_score": 50.0,
                "influence_score": 10.0,
                "sovereignty_score": 50.0,
                "diplomatic_score": 10.0,
                "military_score": 10.0,
                "composite_score": 0,
            },
        ]

        scores_chain = _make_chain()
        scores_chain.execute.return_value = MagicMock(data=scores_data)

        update_chain = _make_chain()
        update_chain.execute.return_value = MagicMock(data=[{}])

        sb.table.side_effect = lambda name: scores_chain

        epoch = {"config": {}}
        result = await ScoringService._normalize_and_composite(
            sb, EPOCH_ID, 1, epoch,
        )

        assert len(result) == 2
        # Participant A: all at max → composite = 100
        assert result[0]["composite_score"] == 100.0
        # Participant B: all at 50% → composite = 50
        assert result[1]["composite_score"] == 50.0

    @pytest.mark.asyncio
    async def test_normalize_with_custom_weights(self):
        """Custom score weights should affect composite calculation."""
        sb = MagicMock()

        scores_data = [{
            "id": str(uuid4()),
            "simulation_id": SIM_ID_A,
            "stability_score": 100.0,
            "influence_score": 0.0,
            "sovereignty_score": 0.0,
            "diplomatic_score": 0.0,
            "military_score": 0.0,
            "composite_score": 0,
        }]

        scores_chain = _make_chain()
        scores_chain.execute.return_value = MagicMock(data=scores_data)

        update_chain = _make_chain()
        update_chain.execute.return_value = MagicMock(data=[{}])

        sb.table.side_effect = lambda name: scores_chain

        # Heavily weight stability
        epoch = {
            "config": {
                "score_weights": {
                    "stability": 80,
                    "influence": 5,
                    "sovereignty": 5,
                    "diplomatic": 5,
                    "military": 5,
                },
            },
        }
        result = await ScoringService._normalize_and_composite(
            sb, EPOCH_ID, 1, epoch,
        )

        # Stability=100 normalized=100, rest all 0 → composite = 100*80/100 = 80
        assert result[0]["composite_score"] == 80.0


# ── Final Standings ────────────────────────────────────────────


class TestFinalStandings:
    @pytest.mark.asyncio
    async def test_rejects_non_completed_epoch(self):
        sb = MagicMock()
        chain = _make_chain()
        chain.execute.return_value = MagicMock(
            data={"id": str(EPOCH_ID), "status": "competition", "config": {}}
        )
        sb.table.return_value = chain

        with pytest.raises(HTTPException) as exc:
            await ScoringService.get_final_standings(sb, EPOCH_ID)
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_allows_completed_epoch(self):
        """Completed epoch should not raise."""
        sb = MagicMock()

        epoch_chain = _make_chain()
        epoch_chain.execute.return_value = MagicMock(
            data={"id": str(EPOCH_ID), "status": "completed", "config": {}, "current_cycle": 5}
        )

        scores_chain = _make_chain()
        scores_chain.execute.return_value = MagicMock(data=[])

        def table_router(name):
            if name == "game_epochs":
                return epoch_chain
            return scores_chain

        sb.table.side_effect = table_router

        result = await ScoringService.get_final_standings(sb, EPOCH_ID)
        assert isinstance(result, list)

    @pytest.mark.asyncio
    async def test_allows_cancelled_epoch(self):
        """Cancelled epoch should also be allowed for final standings."""
        sb = MagicMock()

        epoch_chain = _make_chain()
        epoch_chain.execute.return_value = MagicMock(
            data={"id": str(EPOCH_ID), "status": "cancelled", "config": {}, "current_cycle": 3}
        )

        scores_chain = _make_chain()
        scores_chain.execute.return_value = MagicMock(data=[])

        def table_router(name):
            if name == "game_epochs":
                return epoch_chain
            return scores_chain

        sb.table.side_effect = table_router

        result = await ScoringService.get_final_standings(sb, EPOCH_ID)
        assert isinstance(result, list)


# ── Logging Tests ────────────────────────────────────────────


class TestScoringServiceLogging:
    """Verify logging output for scoring operations."""

    @pytest.mark.asyncio
    async def test_compute_logs_start(self, caplog):
        """compute_cycle_scores should log INFO at start with epoch_id and cycle_number."""
        sb = MagicMock()

        # rpc chain for refresh_all_game_metrics
        rpc_chain = MagicMock()
        rpc_chain.execute.return_value = MagicMock()
        sb.rpc.return_value = rpc_chain

        # Mock EpochService.get and list_participants
        with (
            patch(
                "backend.services.scoring_service.EpochService.get",
                new_callable=AsyncMock,
                return_value={"id": str(EPOCH_ID), "status": "competition", "config": {}},
            ),
            patch(
                "backend.services.scoring_service.EpochService.list_participants",
                new_callable=AsyncMock,
                return_value=[],
            ),
            caplog.at_level(logging.INFO, logger="backend.services.scoring_service"),
        ):
            await ScoringService.compute_cycle_scores(sb, EPOCH_ID, 3)

        info_records = [r for r in caplog.records if r.levelno == logging.INFO and "Computing" in r.message]
        assert len(info_records) >= 1
        record = info_records[0]
        assert record.epoch_id == str(EPOCH_ID)
        assert record.cycle_number == 3

    @pytest.mark.asyncio
    async def test_empty_rpc_logs_warning(self, caplog):
        """Scoring RPC returning no data should log WARNING."""
        sb = MagicMock()

        # RPC chain: refresh_all_game_metrics succeeds, scoring RPC returns empty
        def rpc_side_effect(name, *args, **kwargs):
            chain = MagicMock()
            if name == "fn_compute_cycle_scores":
                chain.execute.return_value = MagicMock(data=[])
            else:
                chain.execute.return_value = MagicMock()
            return chain

        sb.rpc.side_effect = rpc_side_effect

        with (
            patch(
                "backend.services.scoring_service.EpochService.get",
                new_callable=AsyncMock,
                return_value={"id": str(EPOCH_ID), "status": "competition", "config": {}},
            ),
            caplog.at_level(logging.WARNING, logger="backend.services.scoring_service"),
        ):
            result = await ScoringService.compute_cycle_scores(sb, EPOCH_ID, 1)

        assert result == []
        warning_records = [r for r in caplog.records if r.levelno == logging.WARNING and "rpc" in r.message.lower()]
        assert len(warning_records) >= 1
