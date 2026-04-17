"""Tests for agent bond service — lifecycle, depth progression, templates."""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from backend.services.bond.bond_service import (
    OBSERVATION_PERIOD_DAYS,
    _DEFAULT_RECOGNITION_THRESHOLD as RECOGNITION_THRESHOLD,
    BondService,
)
from backend.services.bond.whisper_template_service import WhisperTemplateService
from backend.tests.conftest import make_chain_mock

# ── Helpers ────────────────────────────────────────────────────────────────

MOCK_USER = uuid4()
MOCK_AGENT = uuid4()
MOCK_SIM = uuid4()
MOCK_BOND = uuid4()


def _make_bond_chain(execute_data=None, execute_count=None):
    """Chain mock extended with .gte()/.lte()/.neq() used by bond queries."""
    c = make_chain_mock(execute_data=execute_data, execute_count=execute_count)
    for method in ("gte", "lte", "neq"):
        getattr(c, method).return_value = c
    return c


def _mock_supabase(
    *,
    table_data=None,
    table_count=None,
    rpc_data=None,
):
    """Build a Supabase mock with separate table/rpc chains."""
    sb = MagicMock()

    table_chain = _make_bond_chain(execute_data=table_data, execute_count=table_count)
    sb.table.return_value = table_chain

    rpc_chain = make_chain_mock(execute_data=rpc_data)
    sb.rpc.return_value = rpc_chain

    return sb


# ── Track Attention ────────────────────────────────────────────────────────


class TestTrackAttention:
    async def test_returns_bond_from_rpc(self):
        bond_row = {"id": str(MOCK_BOND), "attention_score": 3, "status": "forming"}
        sb = _mock_supabase(rpc_data=[bond_row])

        result = await BondService.track_attention(sb, MOCK_USER, MOCK_AGENT, MOCK_SIM)

        assert result["id"] == str(MOCK_BOND)
        sb.rpc.assert_called_once_with(
            "fn_increment_attention",
            {
                "p_user_id": str(MOCK_USER),
                "p_agent_id": str(MOCK_AGENT),
                "p_simulation_id": str(MOCK_SIM),
            },
        )

    async def test_raises_not_found_on_empty_response(self):
        sb = _mock_supabase(rpc_data=[])

        with pytest.raises(HTTPException) as exc_info:
            await BondService.track_attention(sb, MOCK_USER, MOCK_AGENT, MOCK_SIM)
        assert exc_info.value.status_code == 404

    async def test_translates_agent_not_in_sim_error(self):
        sb = MagicMock()
        rpc_chain = MagicMock()
        rpc_chain.execute = AsyncMock(
            side_effect=Exception("Agent does not belong to simulation"),
        )
        sb.rpc.return_value = rpc_chain

        with pytest.raises(HTTPException) as exc_info:
            await BondService.track_attention(sb, MOCK_USER, MOCK_AGENT, MOCK_SIM)
        assert exc_info.value.status_code == 400
        assert "does not belong" in exc_info.value.detail


# ── Recognition Candidates ─────────────────────────────────────────────────


class TestRecognitionCandidates:
    async def test_returns_candidates_with_agent_enrichment(self):
        sb = _mock_supabase(table_data=[
            {
                "agent_id": str(MOCK_AGENT),
                "attention_score": 12,
                "simulation_id": str(MOCK_SIM),
                "agents": {"name": "Maren", "portrait_image_url": "https://example.com/maren.jpg"},
            },
        ])

        result = await BondService.get_recognition_candidates(sb, MOCK_USER, MOCK_SIM)

        assert len(result) == 1
        assert result[0]["agent_name"] == "Maren"
        assert result[0]["attention_score"] == 12

    async def test_returns_empty_when_no_candidates(self):
        sb = _mock_supabase(table_data=[])

        result = await BondService.get_recognition_candidates(sb, MOCK_USER, MOCK_SIM)
        assert result == []


# ── Form Bond ──────────────────────────────────────────────────────────────


class TestFormBond:
    def _forming_bond(self, **overrides):
        old_enough = (datetime.now(UTC) - timedelta(days=OBSERVATION_PERIOD_DAYS + 1)).isoformat()
        return {
            "id": str(MOCK_BOND),
            "user_id": str(MOCK_USER),
            "agent_id": str(MOCK_AGENT),
            "simulation_id": str(MOCK_SIM),
            "status": "forming",
            "attention_score": RECOGNITION_THRESHOLD + 1,
            "created_at": old_enough,
            "agents": {"name": "Maren", "portrait_image_url": None},
            **overrides,
        }

    async def test_rejects_below_threshold(self):
        bond = self._forming_bond(attention_score=RECOGNITION_THRESHOLD - 1)
        sb = _mock_supabase()
        # maybe_single returns the bond
        sb.table.return_value.execute = AsyncMock(
            return_value=MagicMock(data=bond),
        )

        with pytest.raises(HTTPException) as exc_info:
            await BondService.form_bond(sb, MOCK_USER, MOCK_AGENT, MOCK_SIM)
        assert exc_info.value.status_code == 400
        assert "threshold" in exc_info.value.detail

    async def test_rejects_too_young_bond(self):
        too_young = datetime.now(UTC).isoformat()
        bond = self._forming_bond(created_at=too_young)
        sb = _mock_supabase()
        sb.table.return_value.execute = AsyncMock(
            return_value=MagicMock(data=bond),
        )

        with pytest.raises(HTTPException) as exc_info:
            await BondService.form_bond(sb, MOCK_USER, MOCK_AGENT, MOCK_SIM)
        assert exc_info.value.status_code == 400
        assert "days old" in exc_info.value.detail


# ── Mark Whisper Read ──────────────────────────────────────────────────────


class TestMarkWhisperRead:
    async def test_returns_whisper_on_success(self):
        whisper = {"id": str(uuid4()), "bond_id": str(MOCK_BOND), "read_at": "2026-01-01"}
        sb = MagicMock()
        chain = _make_bond_chain()
        sb.table.return_value = chain
        # First call: update (void), second call: maybe_single refetch
        chain.execute = AsyncMock(side_effect=[
            MagicMock(data=[]),        # update (we ignore the result)
            MagicMock(data=whisper),   # maybe_single refetch
        ])

        result = await BondService.mark_whisper_read(sb, MOCK_USER, MOCK_BOND, uuid4())
        assert result["id"] == whisper["id"]

    async def test_returns_existing_if_already_read(self):
        """When update returns empty (already read), fetch and return existing."""
        whisper_id = uuid4()
        existing = {"id": str(whisper_id), "bond_id": str(MOCK_BOND), "read_at": "2026-01-01"}

        sb = MagicMock()
        chain = make_chain_mock(execute_data=[])
        sb.table.return_value = chain

        # First call (update) returns empty, second (select) returns existing
        chain.execute = AsyncMock(side_effect=[
            MagicMock(data=[]),       # update returns empty
            MagicMock(data=existing),  # maybe_single returns existing
        ])

        result = await BondService.mark_whisper_read(sb, MOCK_USER, MOCK_BOND, whisper_id)
        assert result["id"] == str(whisper_id)

    async def test_raises_not_found_if_whisper_missing(self):
        sb = MagicMock()
        chain = make_chain_mock(execute_data=[])
        sb.table.return_value = chain
        chain.execute = AsyncMock(side_effect=[
            MagicMock(data=[]),    # update empty
            MagicMock(data=None),  # maybe_single empty
        ])

        with pytest.raises(HTTPException) as exc_info:
            await BondService.mark_whisper_read(sb, MOCK_USER, MOCK_BOND, uuid4())
        assert exc_info.value.status_code == 404


# ── Depth Progression ──────────────────────────────────────────────────────


class TestDepthProgression:
    async def test_returns_none_when_bond_not_active(self):
        sb = _mock_supabase()
        sb.table.return_value.execute = AsyncMock(
            return_value=MagicMock(data=None),
        )

        result = await BondService.check_depth_progression(sb, MOCK_BOND)
        assert result is None

    async def test_returns_none_when_already_max_depth(self):
        sb = _mock_supabase()
        sb.table.return_value.execute = AsyncMock(
            return_value=MagicMock(data={"depth": 5, "status": "active"}),
        )

        result = await BondService.check_depth_progression(sb, MOCK_BOND)
        assert result is None

    async def test_returns_none_when_time_gate_not_met(self):
        too_recent = datetime.now(UTC).isoformat()
        bond = {
            "id": str(MOCK_BOND), "depth": 1, "status": "active",
            "formed_at": too_recent,
        }
        sb = _mock_supabase()
        sb.table.return_value.execute = AsyncMock(
            return_value=MagicMock(data=bond),
        )

        result = await BondService.check_depth_progression(sb, MOCK_BOND)
        assert result is None


# ── Enter Strain ───────────────────────────────────────────────────────────


class TestEnterStrain:
    async def test_raises_when_not_active(self):
        sb = _mock_supabase(table_data=[])

        with pytest.raises(HTTPException) as exc_info:
            await BondService.enter_strain(sb, MOCK_BOND, "neglect")
        assert exc_info.value.status_code == 404


# ── Farewell ───────────────────────────────────────────────────────────────


class TestFarewell:
    async def test_raises_when_already_farewelled(self):
        sb = _mock_supabase(table_data=[])

        with pytest.raises(HTTPException) as exc_info:
            await BondService.farewell(sb, MOCK_BOND)
        assert exc_info.value.status_code == 404
        assert "farewelled" in exc_info.value.detail


class TestFarewellAgentBonds:
    async def test_farewells_all_active_bonds(self):
        bonds = [{"id": str(uuid4())}, {"id": str(uuid4())}]
        sb = _mock_supabase(table_data=bonds)

        count = await BondService.farewell_agent_bonds(sb, MOCK_AGENT)
        assert count == 2

    async def test_returns_zero_when_no_bonds(self):
        sb = _mock_supabase(table_data=[])

        count = await BondService.farewell_agent_bonds(sb, MOCK_AGENT)
        assert count == 0


# ── Whisper Template Service ───────────────────────────────────────────────


class TestWhisperTemplateService:
    def test_select_state_template_at_depth_1(self):
        t = WhisperTemplateService.select_template("state", 1)
        assert t is not None
        assert t.whisper_type == "state"
        assert t.min_depth <= 1

    def test_select_reflection_requires_depth_4(self):
        t = WhisperTemplateService.select_template("reflection", 3)
        assert t is None

    def test_select_reflection_at_depth_4(self):
        t = WhisperTemplateService.select_template("reflection", 4)
        assert t is not None
        assert t.whisper_type == "reflection"

    def test_select_question_requires_depth_3(self):
        t = WhisperTemplateService.select_template("question", 2)
        assert t is None

    def test_select_memory_requires_depth_2(self):
        t = WhisperTemplateService.select_template("memory", 1)
        assert t is None

    def test_select_with_mood_filter(self):
        t = WhisperTemplateService.select_template(
            "state", 1, agent_state={"mood_score": -80, "stress_level": 200},
        )
        assert t is not None

    def test_dedup_excludes_recent_tags(self):
        # Get a template and then exclude its tags
        first = WhisperTemplateService.select_template("state", 1)
        assert first is not None
        second = WhisperTemplateService.select_template(
            "state", 1, recent_whisper_tags=list(first.tags),
        )
        # Second should be different (or None if all are excluded, but with 12 templates unlikely)
        if second is not None:
            assert second.tags != first.tags or not first.tags

    def test_fill_template_replaces_slots(self):
        t = WhisperTemplateService.select_template("event", 1)
        assert t is not None
        de, en = WhisperTemplateService.fill_template(t, {
            "zone_name": "Nordviertel",
            "agent_name": "Maren",
            "other_agent": "Lena",
            "building_name": "Alte Schmiede",
            "days_count": "7",
        })
        assert isinstance(de, str) and len(de) > 0
        assert isinstance(en, str) and len(en) > 0

    def test_fill_template_graceful_on_missing_slots(self):
        t = WhisperTemplateService.select_template("event", 1)
        assert t is not None
        de, en = WhisperTemplateService.fill_template(t, {})
        # Should not crash, missing slots get "..."
        assert isinstance(de, str)
        assert isinstance(en, str)

    def test_all_types_have_12_templates(self):
        from backend.services.bond.whisper_template_service import _TEMPLATES_BY_TYPE

        for wtype in ("state", "event", "memory", "question", "reflection"):
            assert len(_TEMPLATES_BY_TYPE[wtype]) == 12, f"{wtype} has {len(_TEMPLATES_BY_TYPE[wtype])} templates, expected 12"

    def test_no_em_dashes_in_templates(self):
        from backend.services.bond.whisper_template_service import _TEMPLATES

        em_dash = "\u2014"
        for i, t in enumerate(_TEMPLATES):
            assert em_dash not in t.content_de, f"Template {i} DE contains em dash"
            assert em_dash not in t.content_en, f"Template {i} EN contains em dash"

    def test_en_dashes_have_spaces(self):
        from backend.services.bond.whisper_template_service import _TEMPLATES

        en_dash = "\u2013"
        for i, t in enumerate(_TEMPLATES):
            for lang, text in [("de", t.content_de), ("en", t.content_en)]:
                pos = text.find(en_dash)
                while pos >= 0:
                    before = text[pos - 1] if pos > 0 else " "
                    after = text[pos + 1] if pos + 1 < len(text) else " "
                    assert before == " " and after == " ", (
                        f"Template {i} ({lang}): en dash without spacing at pos {pos}"
                    )
                    pos = text.find(en_dash, pos + 1)


# ── List Whispers ──────────────────────────────────────────────────────────


class TestListWhispers:
    async def test_raises_not_found_for_wrong_bond(self):
        sb = MagicMock()
        chain = make_chain_mock()
        sb.table.return_value = chain
        # First call: bond existence check → empty (maybe_single returns None)
        # (the bond doesn't exist or RLS hides it)
        chain.execute = AsyncMock(return_value=MagicMock(data=None))

        with pytest.raises(HTTPException) as exc_info:
            await BondService.list_whispers(sb, MOCK_USER, uuid4())
        assert exc_info.value.status_code == 404
