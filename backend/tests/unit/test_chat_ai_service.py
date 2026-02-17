"""Tests for ChatAIService — prompt variables, event context, and template resolution."""

from __future__ import annotations

from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from backend.services.chat_ai_service import ChatAIService
from backend.services.prompt_service import HARDCODED_FALLBACKS, ResolvedPrompt

# ---------------------------------------------------------------------------
# _build_agent_variables (static, no mocks needed)
# ---------------------------------------------------------------------------


class TestBuildAgentVariables:
    """Tests for ChatAIService._build_agent_variables()."""

    def test_contains_all_eight_keys(self):
        agent = {
            "name": "Agent X",
            "character": "Brave",
            "background": "Warrior background",
            "system": "Monarchy",
            "gender": "female",
            "primary_profession": "Soldier",
        }
        simulation = {"name": "Velgarien"}
        variables = ChatAIService._build_agent_variables(agent, simulation, "de")

        expected_keys = {
            "agent_name",
            "agent_character",
            "agent_background",
            "agent_system",
            "agent_gender",
            "agent_profession",
            "simulation_name",
            "locale_name",
        }
        assert set(variables.keys()) == expected_keys

    def test_missing_fields_default_to_empty(self):
        agent = {"name": "Agent Y"}
        simulation = {}
        variables = ChatAIService._build_agent_variables(agent, simulation, "en")

        assert variables["agent_name"] == "Agent Y"
        assert variables["agent_system"] == ""
        assert variables["agent_gender"] == ""
        assert variables["agent_profession"] == ""
        assert variables["simulation_name"] == ""

    def test_locale_name_resolves(self):
        variables = ChatAIService._build_agent_variables({}, {}, "de")
        assert variables["locale_name"] == "Deutsch"

        variables = ChatAIService._build_agent_variables({}, {}, "en")
        assert variables["locale_name"] == "English"


# ---------------------------------------------------------------------------
# _build_event_context (async, mocks needed for PromptResolver)
# ---------------------------------------------------------------------------


def _make_resolved_prompt(content: str) -> ResolvedPrompt:
    """Create a minimal ResolvedPrompt for testing."""
    return ResolvedPrompt(
        template_type="test",
        locale="en",
        prompt_content=content,
        system_prompt=None,
        variables=[],
        default_model=None,
        temperature=0.7,
        max_tokens=1024,
        negative_prompt=None,
        source="test",
    )


@pytest.fixture()
def chat_service():
    """Create a ChatAIService with mocked dependencies."""
    mock_supabase = MagicMock()
    sim_id = uuid4()
    return ChatAIService(mock_supabase, sim_id, openrouter_api_key="test-key")


class TestBuildEventContext:
    """Tests for ChatAIService._build_event_context()."""

    async def test_empty_event_refs_returns_empty(self, chat_service):
        result = await chat_service._build_event_context([], [], "en")
        assert result == ""

    async def test_full_description_not_truncated(self, chat_service):
        """Event description should NOT be truncated (was [:500] before)."""
        long_description = "A" * 2000  # 2000 chars, well over old 500 limit

        event_refs = [{
            "event_id": "evt-1",
            "events": {
                "title": "Big Event",
                "event_type": "political",
                "impact_level": 8,
                "occurred_at": "2026-01-01",
                "description": long_description,
            },
        }]

        # Mock resolve to return hardcoded fallback templates
        async def mock_resolve(template_type, locale):
            content = HARDCODED_FALLBACKS.get(template_type, "")
            return _make_resolved_prompt(content)

        with patch.object(chat_service._prompt_resolver, "resolve", side_effect=mock_resolve):
            result = await chat_service._build_event_context(event_refs, [], "en")

        # Full description must be present, not truncated
        assert long_description in result
        assert "--- REFERENCED EVENTS ---" in result
        assert "--- END EVENTS ---" in result

    async def test_includes_event_reactions(self, chat_service):
        """Event reactions should be appended after the event block."""
        event_refs = [{
            "event_id": "evt-1",
            "events": {
                "title": "Rebellion",
                "event_type": "political",
                "impact_level": 9,
                "occurred_at": "2026-01-15",
                "description": "A rebellion broke out.",
            },
        }]
        reactions = [{
            "event_id": "evt-1",
            "agent_id": "agent-1",
            "agent_name": "Captain Ava",
            "reaction_text": "This changes everything!",
            "emotion": "shock",
        }]

        async def mock_resolve(template_type, locale):
            content = HARDCODED_FALLBACKS.get(template_type, "")
            return _make_resolved_prompt(content)

        with patch.object(chat_service._prompt_resolver, "resolve", side_effect=mock_resolve):
            result = await chat_service._build_event_context(event_refs, reactions, "en")

        assert "Captain Ava" in result
        assert "This changes everything!" in result
        assert "shock" in result

    async def test_multiple_events(self, chat_service):
        """Multiple events should all appear in context."""
        event_refs = [
            {
                "event_id": "evt-1",
                "events": {
                    "title": "Event Alpha",
                    "event_type": "economic",
                    "impact_level": 5,
                    "occurred_at": "2026-01-01",
                    "description": "First event.",
                },
            },
            {
                "event_id": "evt-2",
                "events": {
                    "title": "Event Beta",
                    "event_type": "military",
                    "impact_level": 10,
                    "occurred_at": "2026-02-01",
                    "description": "Second event.",
                },
            },
        ]

        async def mock_resolve(template_type, locale):
            content = HARDCODED_FALLBACKS.get(template_type, "")
            return _make_resolved_prompt(content)

        with patch.object(chat_service._prompt_resolver, "resolve", side_effect=mock_resolve):
            result = await chat_service._build_event_context(event_refs, [], "en")

        assert "Event Alpha" in result
        assert "Event Beta" in result
        assert "First event." in result
        assert "Second event." in result


# ---------------------------------------------------------------------------
# New prompt template types exist in HARDCODED_FALLBACKS
# ---------------------------------------------------------------------------


class TestHardcodedFallbacks:
    """Verify that new template types are registered as hardcoded fallbacks."""

    @pytest.mark.parametrize(
        "template_type",
        [
            "chat_event_context",
            "chat_event_item",
            "chat_group_instruction",
            "chat_event_reaction",
        ],
    )
    def test_template_type_has_fallback(self, template_type):
        assert template_type in HARDCODED_FALLBACKS
        assert len(HARDCODED_FALLBACKS[template_type]) > 0
