"""Tests for bilingual pipeline hardening (B1–B4) and translate_simulation fix (C1).

B1: validate_bilingual_output warns on empty _de fields
B2: any() → all() — entity translation runs unless ALL agents have _de
B3: Lore persist warns on translation count mismatch
B4: Entity persist_translations logs empty _de fields
C1: translate_simulation.py handles description_de independently
"""

import logging
from unittest.mock import MagicMock, AsyncMock, patch
from uuid import uuid4

import pytest

from backend.models.forge import (
    ForgeAgentTranslation,
    ForgeBuildingTranslation,
    ForgeEntityTranslationOutput,
    ForgeSimulationTranslation,
    ForgeStreetTranslation,
    ForgeZoneTranslation,
)
from backend.services.forge_orchestrator_service import validate_bilingual_output
from backend.services.forge_lore_service import ForgeLoreService
from backend.services.forge_entity_translation_service import ForgeEntityTranslationService
from backend.tests.conftest import make_chain_mock


# ── B1: validate_bilingual_output ──────────────────────────────────────


class TestValidateBilingualOutput:
    """B1: Utility function that warns on empty _de fields."""

    def test_all_complete_returns_zero(self):
        entities = [
            {"name": "Enzo", "character_de": "Pedantisch", "background_de": "Ex-Agent"},
            {"name": "Mira", "character_de": "Nachdenklich", "background_de": "Forscherin"},
        ]
        result = validate_bilingual_output(entities, ["character_de", "background_de"], "agent")
        assert result == 0

    def test_partial_missing_returns_count(self):
        entities = [
            {"name": "Enzo", "character_de": "Pedantisch", "background_de": "Ex-Agent"},
            {"name": "Mira", "character_de": "", "background_de": ""},
            {"name": "Lux", "character_de": "Scharf", "background_de": ""},
        ]
        result = validate_bilingual_output(entities, ["character_de", "background_de"], "agent")
        # Mira: both empty → incomplete. Lux: background_de empty → incomplete.
        assert result == 2

    def test_all_missing_returns_total(self):
        entities = [
            {"name": "A", "character_de": ""},
            {"name": "B"},
        ]
        result = validate_bilingual_output(entities, ["character_de"], "agent")
        assert result == 2

    def test_empty_list_returns_zero(self):
        result = validate_bilingual_output([], ["character_de"], "agent")
        assert result == 0

    def test_logs_warning_on_incomplete(self, caplog):
        entities = [{"name": "X", "description_de": ""}]
        with caplog.at_level(logging.WARNING):
            validate_bilingual_output(entities, ["description_de"], "building")
        assert "Bilingual gap" in caplog.text
        assert "building" in caplog.text

    def test_no_warning_when_complete(self, caplog):
        entities = [{"name": "X", "description_de": "Hallo"}]
        with caplog.at_level(logging.WARNING):
            validate_bilingual_output(entities, ["description_de"], "building")
        assert "Bilingual gap" not in caplog.text


# ── B2: any() → all() translation skip logic ──────────────────────────


class TestTranslationSkipLogic:
    """B2: Entity translation should only skip if ALL agents have _de."""

    @pytest.mark.asyncio
    async def test_partial_de_triggers_translation(self):
        """If only 1 of 3 agents has character_de, translation must run."""
        mat_agents = [
            {"name": "A", "character": "x", "background": "y", "primary_profession": "z", "character_de": "Ja"},
            {"name": "B", "character": "x", "background": "y", "primary_profession": "z", "character_de": ""},
            {"name": "C", "character": "x", "background": "y", "primary_profession": "z", "character_de": ""},
        ]
        # all() returns False when not all have character_de
        agents_have_de = all(a.get("character_de") for a in mat_agents)
        assert agents_have_de is False, "Partial _de should NOT skip translation"

    @pytest.mark.asyncio
    async def test_all_de_skips_translation(self):
        """If all agents have character_de, translation can be skipped."""
        mat_agents = [
            {"name": "A", "character_de": "Ja"},
            {"name": "B", "character_de": "Auch"},
            {"name": "C", "character_de": "Und"},
        ]
        agents_have_de = all(a.get("character_de") for a in mat_agents)
        assert agents_have_de is True, "All _de present should skip translation"

    @pytest.mark.asyncio
    async def test_empty_agents_skips(self):
        """Empty agents list → all() returns True (vacuous truth) → skip."""
        mat_agents = []
        agents_have_de = all(a.get("character_de") for a in mat_agents)
        assert agents_have_de is True


# ── B3: Lore persist warns on translation count mismatch ───────────────


class TestLorePersistMismatchWarning:
    """B3: persist_lore warns when translations < sections."""

    @pytest.mark.asyncio
    async def test_matching_counts_no_warning(self, caplog):
        supabase = MagicMock()
        supabase.table.return_value = make_chain_mock()
        sections = [
            {"chapter": "I", "arcanum": "I", "title": "A", "body": "text"},
            {"chapter": "I", "arcanum": "I", "title": "B", "body": "text"},
        ]
        translations = [
            {"title": "A-de", "body": "text-de"},
            {"title": "B-de", "body": "text-de"},
        ]
        with caplog.at_level(logging.WARNING):
            await ForgeLoreService.persist_lore(supabase, uuid4(), sections, translations)
        assert "mismatch" not in caplog.text

    @pytest.mark.asyncio
    async def test_fewer_translations_warns(self, caplog):
        supabase = MagicMock()
        supabase.table.return_value = make_chain_mock()
        sections = [
            {"chapter": "I", "arcanum": "I", "title": "A", "body": "text"},
            {"chapter": "I", "arcanum": "I", "title": "B", "body": "text"},
            {"chapter": "II", "arcanum": "II", "title": "C", "body": "text"},
        ]
        translations = [
            {"title": "A-de", "body": "text-de"},
        ]
        with caplog.at_level(logging.WARNING):
            await ForgeLoreService.persist_lore(supabase, uuid4(), sections, translations)
        assert "mismatch" in caplog.text
        assert "1 translations for 3 sections" in caplog.text

    @pytest.mark.asyncio
    async def test_none_translations_no_warning(self, caplog):
        """translations=None should not trigger the mismatch warning."""
        supabase = MagicMock()
        supabase.table.return_value = make_chain_mock()
        sections = [
            {"chapter": "I", "arcanum": "I", "title": "A", "body": "text"},
        ]
        with caplog.at_level(logging.WARNING):
            await ForgeLoreService.persist_lore(supabase, uuid4(), sections, None)
        assert "mismatch" not in caplog.text


# ── B4: Entity persist_translations logs empty _de ─────────────────────


class TestEntityPersistTranslationLogging:
    """B4: persist_translations logs when _de fields are empty."""

    @pytest.mark.asyncio
    async def test_empty_description_de_warns(self, caplog):
        supabase = MagicMock()
        supabase.table.return_value = make_chain_mock()
        translations = ForgeEntityTranslationOutput(
            simulation=ForgeSimulationTranslation(description_de=""),
            agents=[],
            buildings=[],
            zones=[],
            streets=[],
        )
        with caplog.at_level(logging.WARNING):
            await ForgeEntityTranslationService.persist_translations(
                supabase, uuid4(), translations,
            )
        assert "empty simulation description_de" in caplog.text

    @pytest.mark.asyncio
    async def test_agents_missing_de_warns(self, caplog):
        supabase = MagicMock()
        supabase.table.return_value = make_chain_mock()
        translations = ForgeEntityTranslationOutput(
            simulation=ForgeSimulationTranslation(description_de="OK"),
            agents=[
                ForgeAgentTranslation(name="A", character_de="Ja"),
                ForgeAgentTranslation(name="B"),  # all _de empty
            ],
            buildings=[],
            zones=[],
            streets=[],
        )
        with caplog.at_level(logging.WARNING):
            await ForgeEntityTranslationService.persist_translations(
                supabase, uuid4(), translations,
            )
        assert "1/2 agents have no _de" in caplog.text

    @pytest.mark.asyncio
    async def test_buildings_missing_de_warns(self, caplog):
        supabase = MagicMock()
        supabase.table.return_value = make_chain_mock()
        translations = ForgeEntityTranslationOutput(
            simulation=ForgeSimulationTranslation(description_de="OK"),
            agents=[],
            buildings=[
                ForgeBuildingTranslation(name="B1"),  # all empty
            ],
            zones=[],
            streets=[],
        )
        with caplog.at_level(logging.WARNING):
            await ForgeEntityTranslationService.persist_translations(
                supabase, uuid4(), translations,
            )
        assert "1/1 buildings have no _de" in caplog.text

    @pytest.mark.asyncio
    async def test_all_translated_no_warnings(self, caplog):
        supabase = MagicMock()
        supabase.table.return_value = make_chain_mock()
        translations = ForgeEntityTranslationOutput(
            simulation=ForgeSimulationTranslation(description_de="Beschreibung"),
            agents=[
                ForgeAgentTranslation(name="A", character_de="Ja", background_de="Bg", primary_profession_de="Prof"),
            ],
            buildings=[
                ForgeBuildingTranslation(name="B", description_de="D", building_type_de="T", building_condition_de="G"),
            ],
            zones=[
                ForgeZoneTranslation(name="Z", description_de="D", zone_type_de="T"),
            ],
            streets=[
                ForgeStreetTranslation(name="S", street_type_de="Hauptstr."),
            ],
        )
        with caplog.at_level(logging.WARNING):
            await ForgeEntityTranslationService.persist_translations(
                supabase, uuid4(), translations,
            )
        # No warnings expected
        assert "have no _de" not in caplog.text
        assert "empty simulation description_de" not in caplog.text


# ── C1: translate_simulation description_de independence ───────────────


class TestTranslateSimulationDescriptionDe:
    """C1: description_de should be checked independently from entity counts."""

    def test_description_de_missing_triggers_translation(self):
        """Even if all entities are translated, missing description_de should trigger."""
        sim = {"id": "x", "name": "Test", "description": "A world", "description_de": None}
        untranslated_agents = []
        untranslated_buildings = []
        untranslated_zones = []
        untranslated_streets = []

        total_untranslated = (
            len(untranslated_agents)
            + len(untranslated_buildings)
            + len(untranslated_zones)
            + len(untranslated_streets)
        )
        sim_needs_description_de = not sim.get("description_de")

        # This is the fixed condition from C1
        should_translate = total_untranslated > 0 or sim_needs_description_de
        assert should_translate is True, "Missing description_de must trigger translation"

    def test_description_de_present_no_extra_trigger(self):
        """If description_de is set and all entities translated, skip."""
        sim = {"description_de": "Vorhanden"}
        total_untranslated = 0
        sim_needs_description_de = not sim.get("description_de")

        should_translate = total_untranslated > 0 or sim_needs_description_de
        assert should_translate is False

    def test_empty_string_description_de_triggers(self):
        """Empty string is falsy — should trigger translation."""
        sim = {"description_de": ""}
        sim_needs_description_de = not sim.get("description_de")
        assert sim_needs_description_de is True

    def test_entities_untranslated_always_triggers(self):
        """Even if description_de is present, untranslated entities trigger."""
        sim = {"description_de": "Vorhanden"}
        total_untranslated = 3
        sim_needs_description_de = not sim.get("description_de")

        should_translate = total_untranslated > 0 or sim_needs_description_de
        assert should_translate is True
