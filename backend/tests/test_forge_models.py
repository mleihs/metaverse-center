"""Tests for Simulation Forge Pydantic models."""

from datetime import UTC, datetime
from uuid import uuid4

import pytest
from pydantic import ValidationError

from backend.models.forge import (
    ForgeAgentDraft,
    ForgeBuildingDraft,
    ForgeDraft,
    ForgeDraftCreate,
    ForgeDraftUpdate,
    ForgeGeographyDraft,
    PhilosophicalAnchor,
    UpdateBYOKRequest,
    UserWallet,
)


class TestForgeDraftCreate:
    def test_valid(self):
        obj = ForgeDraftCreate(seed_prompt="Memory of a broken clock")
        assert obj.seed_prompt == "Memory of a broken clock"

    def test_missing_prompt_raises(self):
        with pytest.raises(ValidationError):
            ForgeDraftCreate()


class TestForgeDraftUpdate:
    def test_all_none_by_default(self):
        obj = ForgeDraftUpdate()
        dumped = obj.model_dump(exclude_unset=True)
        assert dumped == {}

    def test_partial_update(self):
        obj = ForgeDraftUpdate(current_phase="drafting", status="processing")
        dumped = obj.model_dump(exclude_unset=True)
        assert dumped == {"current_phase": "drafting", "status": "processing"}

    def test_research_context_field(self):
        obj = ForgeDraftUpdate(research_context={"raw_data": "test"})
        assert obj.research_context == {"raw_data": "test"}

    def test_invalid_phase_raises(self):
        with pytest.raises(ValidationError):
            ForgeDraftUpdate(current_phase="invalid_phase")

    def test_invalid_status_raises(self):
        with pytest.raises(ValidationError):
            ForgeDraftUpdate(status="banana")


class TestForgeDraft:
    def test_from_dict(self):
        now = datetime.now(tz=UTC)
        uid = uuid4()
        draft = ForgeDraft(
            id=uid,
            user_id=uuid4(),
            seed_prompt="test",
            created_at=now,
            updated_at=now,
        )
        assert draft.id == uid
        assert draft.current_phase == "astrolabe"
        assert draft.status == "draft"
        assert draft.research_context == {}

    def test_from_attributes(self):
        """model_config from_attributes should work."""
        assert ForgeDraft.model_config["from_attributes"] is True


class TestUserWallet:
    def test_from_attributes(self):
        assert UserWallet.model_config["from_attributes"] is True

    def test_defaults(self):
        now = datetime.now(tz=UTC)
        w = UserWallet(user_id=uuid4(), forge_tokens=3, is_architect=True, created_at=now, updated_at=now)
        assert w.encrypted_openrouter_key is None
        assert w.encrypted_replicate_key is None


class TestPhilosophicalAnchor:
    def test_valid(self):
        anchor = PhilosophicalAnchor(
            title="The Weight of Clocks",
            title_de="Das Gewicht der Uhren",
            literary_influence="Borges",
            literary_influence_de="Borges",
            core_question="What happens when time commodifies itself?",
            core_question_de="Was passiert, wenn Zeit sich selbst vermarktet?",
            bleed_signature_suggestion="temporal_entropy",
            description="A world where time is currency.",
            description_de="Eine Welt, in der Zeit Währung ist.",
        )
        assert anchor.title == "The Weight of Clocks"

    def test_missing_field_raises(self):
        with pytest.raises(ValidationError):
            PhilosophicalAnchor(title="Missing fields")

    def test_empty_de_field_raises(self):
        with pytest.raises(ValidationError):
            PhilosophicalAnchor(
                title="Test",
                title_de="",
                literary_influence="Borges",
                literary_influence_de="Borges",
                core_question="Q?",
                core_question_de="F?",
                bleed_signature_suggestion="sig",
                description="Desc.",
                description_de="Beschr.",
            )


class TestForgeAgentDraft:
    def test_valid(self):
        agent = ForgeAgentDraft(
            name="Enzo",
            gender="male",
            system="central",
            primary_profession="clockmaker",
            primary_profession_de="Uhrmacher",
            character="Meticulous and paranoid.",
            character_de="Akribisch und paranoid.",
            background="Former bureau agent.",
            background_de="Ehemaliger Büroagent.",
        )
        assert agent.name == "Enzo"

    def test_missing_de_field_raises(self):
        with pytest.raises(ValidationError):
            ForgeAgentDraft(
                name="Enzo",
                gender="male",
                system="central",
                primary_profession="clockmaker",
                character="Meticulous.",
                background="Former agent.",
            )

    def test_empty_de_field_raises(self):
        with pytest.raises(ValidationError):
            ForgeAgentDraft(
                name="Enzo",
                gender="male",
                system="central",
                primary_profession="clockmaker",
                primary_profession_de="",
                character="Meticulous.",
                character_de="Akribisch.",
                background="Former agent.",
                background_de="Ehemaliger Agent.",
            )


class TestForgeBuildingDraft:
    def test_defaults(self):
        building = ForgeBuildingDraft(
            name="The Watchmaker's Loft",
            building_type="workshop",
            building_type_de="Werkstatt",
            description="Gears everywhere.",
            description_de="Überall Zahnräder.",
            building_condition_de="gut",
        )
        assert building.building_condition == "good"

    def test_missing_de_field_raises(self):
        with pytest.raises(ValidationError):
            ForgeBuildingDraft(
                name="Loft",
                building_type="workshop",
                description="Gears.",
            )


class TestForgeGeographyDraft:
    def test_valid(self):
        geo = ForgeGeographyDraft(
            city_name="Chronopolis",
            zones=[{
                "name": "District 1",
                "zone_type": "commercial",
                "zone_type_de": "Gewerbe",
                "description": "Trade hub",
                "description_de": "Handelszentrum",
                "characteristics": ["bustling", "neon-lit"],
            }],
            streets=[{
                "name": "Main St",
                "zone_name": "District 1",
                "street_type": "main",
                "street_type_de": "Hauptstraße",
            }],
        )
        assert geo.city_name == "Chronopolis"
        assert len(geo.zones) == 1
        assert geo.zones[0].characteristics == ["bustling", "neon-lit"]


class TestUpdateBYOKRequest:
    def test_empty_valid(self):
        req = UpdateBYOKRequest()
        assert req.openrouter_key is None
        assert req.replicate_key is None

    def test_with_keys(self):
        req = UpdateBYOKRequest(openrouter_key="sk-or-v1-test", replicate_key="r8_test")
        assert req.openrouter_key == "sk-or-v1-test"
