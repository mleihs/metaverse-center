"""Unit tests for the Agent Autonomy system (The Living World).

Tests: PersonalityExtractionService, AgentNeedsService, AgentMoodService,
AgentOpinionService, AgentActivityService utility logic.

All DB-mutating methods delegate to PostgreSQL RPC functions, so we mock
supabase.rpc() and verify correct arguments. Activity selection (Utility AI
+ Boltzmann) is pure computation and tested without mocks.
"""

from __future__ import annotations

import math
from unittest.mock import MagicMock
from uuid import UUID

import pytest

from backend.services.agent_activity_service import (
    ACTIVITY_BASE_SCORES,
    AgentActivityService,
)
from backend.services.agent_mood_service import (
    STACKING_CAPS,
    STRESS_BREAKDOWN_THRESHOLD,
    AgentMoodService,
)
from backend.services.agent_needs_service import (
    ACTIVITY_NEED_FULFILLMENT,
    NEED_TYPES,
    AgentNeedsService,
)
from backend.services.agent_opinion_service import (
    OPINION_PRESETS,
    AgentOpinionService,
)
from backend.services.personality_extraction_service import (
    PersonalityExtractionService,
)

# ── Test Constants ───────────────────────────────────────────────────────────

SIM_ID = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
AGENT_A = UUID("11111111-1111-1111-1111-111111111111")
AGENT_B = UUID("22222222-2222-2222-2222-222222222222")
ZONE_A = UUID("33333333-3333-3333-3333-333333333333")


# ── Mock Helpers ─────────────────────────────────────────────────────────────


def _mock_supabase(data=None, count=None, rpc_data=None):
    """Build a mock Supabase client with fluent query builder + RPC support."""
    mock = MagicMock()
    response = MagicMock()
    response.data = data
    response.count = count

    builder = MagicMock()
    for method in (
        "select", "eq", "in_", "lt", "gt", "gte", "lte", "or_", "order",
        "limit", "single", "maybe_single", "is_", "not_",
        "range", "insert", "update", "delete", "upsert",
    ):
        getattr(builder, method).return_value = builder
    builder.execute.return_value = response

    mock.table.return_value = builder

    # RPC mock
    rpc_response = MagicMock()
    rpc_response.data = rpc_data
    rpc_builder = MagicMock()
    rpc_builder.execute.return_value = rpc_response
    mock.rpc.return_value = rpc_builder

    return mock, builder, response


# ═══════════════════════════════════════════════════════════════════════
# PersonalityExtractionService
# ═══════════════════════════════════════════════════════════════════════


class TestPersonalityParsing:
    """Test personality profile parsing and validation."""

    def test_valid_profile_parsing(self):
        content = '{"openness": 0.8, "conscientiousness": 0.3, "extraversion": 0.6, "agreeableness": 0.7, "neuroticism": 0.2, "dominant_traits": ["curious", "bold"], "values": ["freedom"], "fears": ["stagnation"], "social_style": "gregarious"}'
        result = PersonalityExtractionService._parse_profile(content)

        assert result["openness"] == 0.8
        assert result["conscientiousness"] == 0.3
        assert result["extraversion"] == 0.6
        assert result["agreeableness"] == 0.7
        assert result["neuroticism"] == 0.2
        assert result["dominant_traits"] == ["curious", "bold"]
        assert result["social_style"] == "gregarious"

    def test_clamped_values(self):
        content = '{"openness": 1.5, "conscientiousness": -0.3, "extraversion": 0.5, "agreeableness": 0.5, "neuroticism": 0.5}'
        result = PersonalityExtractionService._parse_profile(content)

        assert result["openness"] == 1.0  # Clamped
        assert result["conscientiousness"] == 0.0  # Clamped

    def test_invalid_json_returns_defaults(self):
        result = PersonalityExtractionService._parse_profile("not json at all")
        assert result["openness"] == 0.5
        assert result["social_style"] == "reserved"
        assert result["dominant_traits"] == []

    def test_invalid_social_style_defaults_to_reserved(self):
        content = '{"openness": 0.5, "conscientiousness": 0.5, "extraversion": 0.5, "agreeableness": 0.5, "neuroticism": 0.5, "social_style": "INVALID"}'
        result = PersonalityExtractionService._parse_profile(content)
        assert result["social_style"] == "reserved"

    def test_default_profile(self):
        result = PersonalityExtractionService._default_profile()
        assert result["openness"] == 0.5
        assert result["neuroticism"] == 0.5
        assert result["dominant_traits"] == []


class TestBaseCompatibility:
    """Test deterministic compatibility computation."""

    def test_identical_profiles_high_compatibility(self):
        profile = {"openness": 0.8, "conscientiousness": 0.7, "extraversion": 0.6, "agreeableness": 0.5, "neuroticism": 0.4}
        compat = PersonalityExtractionService.compute_base_compatibility(
            profile, profile, str(AGENT_A), str(AGENT_B),
        )
        # Identical profiles → high similarity → positive compatibility
        assert compat > 0

    def test_opposite_profiles_low_compatibility(self):
        profile_a = {"openness": 0.9, "conscientiousness": 0.9, "extraversion": 0.9, "agreeableness": 0.9, "neuroticism": 0.1}
        profile_b = {"openness": 0.1, "conscientiousness": 0.1, "extraversion": 0.1, "agreeableness": 0.1, "neuroticism": 0.9}
        compat = PersonalityExtractionService.compute_base_compatibility(
            profile_a, profile_b, str(AGENT_A), str(AGENT_B),
        )
        assert compat < 0

    def test_deterministic_same_pair(self):
        profile_a = {"openness": 0.7, "conscientiousness": 0.5, "extraversion": 0.6, "agreeableness": 0.4, "neuroticism": 0.3}
        profile_b = {"openness": 0.4, "conscientiousness": 0.8, "extraversion": 0.3, "agreeableness": 0.7, "neuroticism": 0.6}
        c1 = PersonalityExtractionService.compute_base_compatibility(
            profile_a, profile_b, str(AGENT_A), str(AGENT_B),
        )
        c2 = PersonalityExtractionService.compute_base_compatibility(
            profile_a, profile_b, str(AGENT_A), str(AGENT_B),
        )
        assert c1 == c2  # Deterministic

    def test_symmetric_pair_order(self):
        """Hash uses sorted pair → same result regardless of order."""
        profile_a = {"openness": 0.7, "conscientiousness": 0.5, "extraversion": 0.6, "agreeableness": 0.4, "neuroticism": 0.3}
        profile_b = {"openness": 0.4, "conscientiousness": 0.8, "extraversion": 0.3, "agreeableness": 0.7, "neuroticism": 0.6}
        c_ab = PersonalityExtractionService.compute_base_compatibility(
            profile_a, profile_b, str(AGENT_A), str(AGENT_B),
        )
        c_ba = PersonalityExtractionService.compute_base_compatibility(
            profile_b, profile_a, str(AGENT_B), str(AGENT_A),
        )
        assert c_ab == c_ba

    def test_range_clamped(self):
        profile = {"openness": 0.5, "conscientiousness": 0.5, "extraversion": 0.5, "agreeableness": 0.5, "neuroticism": 0.5}
        compat = PersonalityExtractionService.compute_base_compatibility(
            profile, profile, str(AGENT_A), str(AGENT_B),
        )
        assert -0.3 <= compat <= 0.3


# ═══════════════════════════════════════════════════════════════════════
# AgentNeedsService
# ═══════════════════════════════════════════════════════════════════════


class TestNeedsDecay:
    @pytest.mark.asyncio
    async def test_decay_all_calls_rpc(self):
        mock, _, _ = _mock_supabase(rpc_data=6)
        result = await AgentNeedsService.decay_all(mock, SIM_ID, 1.5)
        assert result == 6
        mock.rpc.assert_called_once_with("fn_decay_agent_needs", {
            "p_simulation_id": str(SIM_ID),
            "p_rate_multiplier": 1.5,
        })


class TestNeedsFulfillment:
    @pytest.mark.asyncio
    async def test_fulfill_need_calls_rpc(self):
        mock, _, _ = _mock_supabase(rpc_data=75.0)
        result = await AgentNeedsService.fulfill_need(mock, AGENT_A, "social", 15.0)
        assert result == 75.0
        mock.rpc.assert_called_once_with("fn_fulfill_agent_need", {
            "p_agent_id": str(AGENT_A),
            "p_need_type": "social",
            "p_amount": 15.0,
        })

    @pytest.mark.asyncio
    async def test_invalid_need_type_returns_zero(self):
        mock, _, _ = _mock_supabase()
        result = await AgentNeedsService.fulfill_need(mock, AGENT_A, "invalid", 10.0)
        assert result == 0.0
        mock.rpc.assert_not_called()

    @pytest.mark.asyncio
    async def test_fulfill_from_activity(self):
        mock, _, _ = _mock_supabase(rpc_data=75.0)
        fulfilled = await AgentNeedsService.fulfill_from_activity(mock, AGENT_A, "work")
        assert "purpose" in fulfilled
        # work fulfills purpose=15.0
        assert fulfilled["purpose"] == 15.0

    @pytest.mark.asyncio
    async def test_fulfill_from_unknown_activity(self):
        mock, _, _ = _mock_supabase()
        fulfilled = await AgentNeedsService.fulfill_from_activity(mock, AGENT_A, "unknown_activity")
        assert fulfilled == {}


class TestNeedsConstants:
    def test_all_need_types_valid(self):
        assert len(NEED_TYPES) == 5
        for t in NEED_TYPES:
            assert isinstance(t, str)

    def test_fulfillment_map_covers_activities(self):
        # Every activity type in the map should have valid need types
        for activity, needs in ACTIVITY_NEED_FULFILLMENT.items():
            for need_type in needs:
                assert need_type in NEED_TYPES, f"{activity} references invalid need {need_type}"


# ═══════════════════════════════════════════════════════════════════════
# AgentMoodService
# ═══════════════════════════════════════════════════════════════════════


class TestMoodProcessTick:
    @pytest.mark.asyncio
    async def test_process_tick_calls_all_rpc_functions(self):
        mock, _, _ = _mock_supabase(rpc_data=0)

        # Override rpc to return different values per call
        call_count = 0
        rpc_returns = [
            {"expired_moodlets": 2, "expired_op_mods": 1},  # fn_expire_autonomy_modifiers
            3,   # fn_decay_moodlet_strengths
            6,   # fn_recalculate_mood_scores
            4,   # fn_update_stress_levels
        ]

        def rpc_side_effect(name, params=None):
            nonlocal call_count
            resp = MagicMock()
            resp.data = rpc_returns[min(call_count, len(rpc_returns) - 1)]
            builder = MagicMock()
            builder.execute.return_value = resp
            call_count += 1
            return builder

        mock.rpc.side_effect = rpc_side_effect

        summary = await AgentMoodService.process_tick(mock, SIM_ID)

        assert summary["expired_moodlets"] == 2
        assert summary["expired_op_mods"] == 1
        assert summary["decayed_moodlets"] == 3
        assert summary["recalculated_moods"] == 6
        assert summary["stress_updates"] == 4


class TestMoodletStacking:
    def test_stacking_caps_defined(self):
        assert "crisis_witness" in STACKING_CAPS
        assert "social_positive" in STACKING_CAPS
        assert all(v > 0 for v in STACKING_CAPS.values())

    def test_breakdown_threshold(self):
        assert STRESS_BREAKDOWN_THRESHOLD == 800


# ═══════════════════════════════════════════════════════════════════════
# AgentOpinionService
# ═══════════════════════════════════════════════════════════════════════


class TestOpinionPresets:
    def test_all_presets_have_required_fields(self):
        required = {"modifier_type", "opinion_change", "decay_type"}
        for name, preset in OPINION_PRESETS.items():
            for field in required:
                assert field in preset, f"Preset '{name}' missing '{field}'"

    def test_opinion_changes_in_range(self):
        for name, preset in OPINION_PRESETS.items():
            change = preset["opinion_change"]
            assert -30 <= change <= 30, f"Preset '{name}' opinion_change {change} out of range"


class TestOpinionInteractionTracking:
    @pytest.mark.asyncio
    async def test_process_tick_calls_recalculate(self):
        mock, _, _ = _mock_supabase(rpc_data=5)

        # Need to handle the threshold check queries too
        mock.table.return_value.select.return_value = mock.table.return_value
        mock.table.return_value.eq.return_value = mock.table.return_value
        mock.table.return_value.gte.return_value = mock.table.return_value
        mock.table.return_value.lte.return_value = mock.table.return_value
        mock.table.return_value.maybe_single.return_value = mock.table.return_value
        resp = MagicMock()
        resp.data = []
        mock.table.return_value.execute.return_value = resp

        summary = await AgentOpinionService.process_tick(mock, SIM_ID)
        assert summary["recalculated"] == 5
        mock.rpc.assert_called_once_with("fn_recalculate_opinion_scores", {
            "p_simulation_id": str(SIM_ID),
        })


# ═══════════════════════════════════════════════════════════════════════
# AgentActivityService — Utility AI + Boltzmann
# ═══════════════════════════════════════════════════════════════════════


class TestBoltzmannSelection:
    """Test the Boltzmann (softmax) selection algorithm."""

    def test_high_utility_wins_with_low_temperature(self):
        """Low stress → low temperature → best option wins consistently."""
        utilities = {"work": 50.0, "rest": 10.0, "explore": 5.0}
        # Run 100 selections with 0 stress (low temperature)
        selections = [
            AgentActivityService._boltzmann_select(utilities, stress=0)
            for _ in range(100)
        ]
        # Work should dominate (>80% of selections)
        work_count = selections.count("work")
        assert work_count > 70, f"Expected work to dominate, got {work_count}/100"

    def test_high_stress_increases_randomness(self):
        """High stress → high temperature → more options appear."""
        utilities = {"work": 50.0, "rest": 30.0, "explore": 20.0}
        selections = [
            AgentActivityService._boltzmann_select(utilities, stress=900)
            for _ in range(1000)
        ]
        # At high stress, at least 2 different activities should appear
        unique = set(selections)
        assert len(unique) >= 2, f"Expected variety at high stress, got only {unique}"
        # The non-best option should appear at least sometimes
        non_best = sum(1 for s in selections if s != "work")
        assert non_best > 50, f"Expected >50 non-work selections at high stress, got {non_best}"

    def test_empty_utilities_handled(self):
        """Edge case: single option."""
        result = AgentActivityService._boltzmann_select({"rest": 10.0}, stress=0)
        assert result == "rest"


class TestNeedBonus:
    def test_low_need_gives_high_bonus(self):
        """Urgent needs (low value) should boost relevant activities."""
        needs = {"social": 10, "purpose": 80, "safety": 80, "comfort": 80, "stimulation": 80}
        bonus_social = AgentActivityService._compute_need_bonus("socialize", needs)
        bonus_work = AgentActivityService._compute_need_bonus("work", needs)
        assert bonus_social > bonus_work  # Social need is urgent → socialize gets bigger bonus

    def test_satisfied_needs_give_no_bonus(self):
        needs = {"social": 80, "purpose": 80, "safety": 80, "comfort": 80, "stimulation": 80}
        bonus = AgentActivityService._compute_need_bonus("socialize", needs)
        assert bonus == 0


class TestTraitModifier:
    def test_high_extraversion_boosts_socialize(self):
        profile = {"extraversion": 0.9, "agreeableness": 0.5}
        mod = AgentActivityService._compute_trait_modifier("socialize", profile)
        assert mod > 0  # High extraversion → positive modifier

    def test_low_extraversion_penalizes_socialize(self):
        profile = {"extraversion": 0.1, "agreeableness": 0.5}
        mod = AgentActivityService._compute_trait_modifier("socialize", profile)
        assert mod < 0  # Low extraversion → negative modifier


class TestMoodModifier:
    def test_bad_mood_boosts_rest(self):
        mod = AgentActivityService._compute_mood_modifier("rest", -50)
        assert mod > 0

    def test_bad_mood_penalizes_work(self):
        mod = AgentActivityService._compute_mood_modifier("work", -50)
        assert mod < 0

    def test_good_mood_boosts_socialize(self):
        mod = AgentActivityService._compute_mood_modifier("socialize", 50)
        assert mod > 0

    def test_neutral_mood_no_modifier(self):
        mod = AgentActivityService._compute_mood_modifier("work", 0)
        assert mod == 0


class TestInteractionProbability:
    def test_base_probability(self):
        agent_a = {"id": "a", "mood": {"sociability": 0.5}, "needs": {"social": 60}, "opinions": {}}
        agent_b = {"id": "b", "mood": {"sociability": 0.5}, "needs": {"social": 60}, "opinions": {}}
        prob = AgentActivityService._interaction_probability(agent_a, agent_b, rate=1.0)
        assert 0.1 < prob < 0.5

    def test_high_sociability_increases_probability(self):
        agent_a = {"id": "a", "mood": {"sociability": 0.9}, "needs": {"social": 60}, "opinions": {}}
        agent_b = {"id": "b", "mood": {"sociability": 0.9}, "needs": {"social": 60}, "opinions": {}}
        prob = AgentActivityService._interaction_probability(agent_a, agent_b, rate=1.0)
        assert prob > 0.25  # Higher than base

    def test_rate_multiplier_scales(self):
        agent = {"id": "a", "mood": {"sociability": 0.5}, "needs": {"social": 60}, "opinions": {}}
        prob_1x = AgentActivityService._interaction_probability(agent, agent, rate=1.0)
        prob_2x = AgentActivityService._interaction_probability(agent, agent, rate=2.0)
        assert prob_2x > prob_1x


class TestActivityConstants:
    def test_all_base_scores_positive(self):
        for activity, score in ACTIVITY_BASE_SCORES.items():
            assert score > 0, f"{activity} has non-positive base score {score}"
