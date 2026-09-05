"""Tests for ChatAIService — prompt variables, event context, and template resolution."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from backend.services.chat_ai_service import ChatAIService
from backend.services.prompt_service import HARDCODED_FALLBACKS, PromptSource, ResolvedPrompt

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
        source=PromptSource.PLATFORM_LOCALE,
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

        event_refs = [
            {
                "event_id": "evt-1",
                "events": {
                    "title": "Big Event",
                    "event_type": "political",
                    "impact_level": 8,
                    "occurred_at": "2026-01-01",
                    "description": long_description,
                },
            }
        ]

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
        event_refs = [
            {
                "event_id": "evt-1",
                "events": {
                    "title": "Rebellion",
                    "event_type": "political",
                    "impact_level": 9,
                    "occurred_at": "2026-01-15",
                    "description": "A rebellion broke out.",
                },
            }
        ]
        reactions = [
            {
                "event_id": "evt-1",
                "agent_id": "agent-1",
                "agent_name": "Captain Ava",
                "reaction_text": "This changes everything!",
                "emotion": "shock",
            }
        ]

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


# ---------------------------------------------------------------------------
# _build_generation_context — the persona half of a chat template (finding 25)
# ---------------------------------------------------------------------------


def _resolved_with_persona(content: str, persona: str | None) -> ResolvedPrompt:
    """A chat template carrying both halves, as phase A.6 writes them."""
    return ResolvedPrompt(
        template_type="chat_system_prompt",
        locale="en",
        prompt_content=content,
        system_prompt=persona,
        variables=[],
        default_model=None,
        temperature=0.7,
        max_tokens=1024,
        negative_prompt=None,
        source=PromptSource.SIMULATION_LOCALE,
    )


class TestChatPersonaIsUsed:
    """Phase A.6 authors a per-world persona; chat used to discard it.

    Measured on production 2026-08-30: four simulations carry a
    ``chat_system_prompt`` row whose ``system_prompt`` runs 269-407 characters
    ("You roleplay characters from {simulation_name}, where the state is a
    living body and legibility its breath"). ``_build_generation_context`` built
    its system message from ``prompt_content`` alone, so all four were written,
    stored and dropped. Both platform rows carry no persona, which is why this
    composition changes nothing for the other 37 worlds.
    """

    @pytest.mark.asyncio
    async def test_the_authored_persona_reaches_the_model(self, chat_service):
        template = _resolved_with_persona("Speak as {agent_name}.", "You roleplay clerks of {simulation_name}.")
        with patch.object(chat_service, "_build_mood_context", AsyncMock(return_value="")):
            messages = await chat_service._build_generation_context(
                agent={"id": str(uuid4()), "name": "Registrar"},
                simulation={"name": "Atrament"},
                locale="en",
                prompt_template=template,
                history_messages=[],
            )
        system = messages[0]["content"]
        assert "You roleplay clerks of" in system, "the persona must reach the model"
        assert "Speak as" in system, "the per-agent body must still be there"
        assert system.index("You roleplay clerks of") < system.index("Speak as"), (
            "persona first, concrete instructions after — whatever comes last carries the "
            "most weight, and the platform frame rides at the end of the body"
        )

    @pytest.mark.asyncio
    async def test_the_persona_is_variable_substituted_not_pasted(self, chat_service):
        """A literal `{simulation_name}` reaching the model is the defect
        `fill_system_prompt` exists for — one of the four production rows uses it."""
        template = _resolved_with_persona("Body.", "You roleplay characters from {simulation_name}.")
        with patch.object(chat_service, "_build_mood_context", AsyncMock(return_value="")):
            messages = await chat_service._build_generation_context(
                agent={"id": str(uuid4()), "name": "Registrar"},
                simulation={"name": "Atrament"},
                locale="en",
                prompt_template=template,
                history_messages=[],
            )
        system = messages[0]["content"]
        assert "{simulation_name}" not in system
        assert "Atrament" in system

    @pytest.mark.asyncio
    async def test_a_template_without_a_persona_is_unchanged(self, chat_service):
        """The platform rows carry none; those 37 worlds must see no difference."""
        template = _resolved_with_persona("Speak as {agent_name}.", None)
        with patch.object(chat_service, "_build_mood_context", AsyncMock(return_value="")):
            messages = await chat_service._build_generation_context(
                agent={"id": str(uuid4()), "name": "Registrar"},
                simulation={"name": "Atrament"},
                locale="en",
                prompt_template=template,
                history_messages=[],
            )
        system = messages[0]["content"]
        assert system.startswith("Speak as"), "no persona means no leading blank lines either"


class TestDieBesetzungErreichtDieVerdichtung:
    """Die Ich-Schicht des zweischichtigen Gedaechtnisses (Migration 373)
    entsteht nur, wenn `ensure_digests` weiss, WER im Faden steht.

    ⚠ Am 05.09.2026 gemessen: `_fire_and_forget_digest` nahm `participants`
    entgegen — beide Gruppenpfade gaben es mit — und reichte es nicht weiter.
    Ohne Besetzung ist `fehlende_episoden` leer, die Vorlage
    `chat_character_episode` wird nie aufgeloest, und die Schicht schreibt
    keine Zeile. Am groessten Faden auf Produktion: geteiltes Protokoll
    14 von 14, Ich-Erinnerung **0 von 42**.

    `test_kein_toter_parameter.py` faengt die KLASSE; dieser Test haelt das
    VERHALTEN fest. Beides, weil ein Formtor eine richtige Weitergabe an die
    falsche Stelle nicht sieht.
    """

    @staticmethod
    async def _lauf(participants):
        from unittest.mock import ANY

        dienst = MagicMock()
        dienst.ensure_digests = AsyncMock(return_value=0)
        svc = ChatAIService(MagicMock(), uuid4(), openrouter_api_key="x")
        with (
            patch("backend.services.chat_ai_service.ConversationDigestService", return_value=dienst),
            patch("backend.services.chat_ai_service.get_admin_supabase", AsyncMock(return_value=MagicMock())),
        ):
            svc._fire_and_forget_digest(uuid4(), ["Marie Morgenrot"], "de", participants=participants)
            # Die Aufgabe laeuft im Hintergrund; einmal die Schleife abgeben.
            await asyncio.sleep(0)
            await asyncio.sleep(0)
        assert dienst.ensure_digests.await_count == 1, ANY
        return dienst.ensure_digests.await_args.kwargs

    async def test_die_besetzung_wird_weitergereicht(self):
        agenten = [{"id": str(uuid4()), "name": "Marie Morgenrot"}]
        kwargs = await self._lauf(agenten)
        assert kwargs["participants"] == agenten

    async def test_ohne_besetzung_bleibt_es_leer(self):
        """Die Gegenprobe: der Einzelchat gibt keine mit, und das ist richtig —
        eine Figur allein braucht keine Abgrenzung gegen andere. Ohne diesen
        Test pruefte der obige nur, dass irgendein Wert ankommt."""
        kwargs = await self._lauf(None)
        assert kwargs["participants"] is None
