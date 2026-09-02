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
    counted_list,
)

# The long-form fields carry a floor now (finding 7), so a fixture that used to
# read "Meticulous and paranoid." no longer stands in for one. These two build a
# value that clears the floor without pretending to be prose worth reading.
LONG = "Ein Satz, der lang genug ist, um den Boden zu erreichen. " * 6
SHORT_PROSE = "Ein Satz, der den kleineren Boden erreicht, ohne mehr zu behaupten."


def _agent(**overrides) -> dict:
    """A complete, valid ForgeAgentDraft payload; override one field per test."""
    data = {
        "name": "Enzo",
        "gender": "male",
        "system": "central",
        "primary_profession": "clockmaker",
        "primary_profession_de": "Uhrmacher",
        "character": LONG,
        "character_de": LONG,
        "background": LONG,
        "background_de": LONG,
    }
    data.update(overrides)
    return data


def _building(**overrides) -> dict:
    """A complete, valid ForgeBuildingDraft payload."""
    data = {
        "name": "The Watchmaker's Loft",
        "building_type": "workshop",
        "building_type_de": "Werkstatt",
        "description": LONG,
        "description_de": LONG,
        "building_condition_de": "gut",
    }
    data.update(overrides)
    return data


def _anchor(**overrides) -> dict:
    """A complete, valid PhilosophicalAnchor payload."""
    data = {
        "title": "The Weight of Clocks",
        "title_de": "Das Gewicht der Uhren",
        "literary_influence": "Borges, Ficciones",
        "literary_influence_de": "Borges, Fiktionen",
        "core_question": "What happens when time commodifies itself?",
        "core_question_de": "Was passiert, wenn Zeit sich selbst vermarktet?",
        "bleed_signature_suggestion": "fading ink on wet parchment",
        "description": SHORT_PROSE,
        "description_de": SHORT_PROSE,
    }
    data.update(overrides)
    return data


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

    def test_carries_no_key_material(self):
        """The wallet must not be able to serialise a key outward.

        It used to declare ``encrypted_openrouter_key`` /
        ``encrypted_replicate_key`` (finding 9). Since migration 333 the keys
        live in ``user_api_keys``, service_role only, and the wallet has no
        field that could carry one.
        """
        now = datetime.now(tz=UTC)
        w = UserWallet(user_id=uuid4(), forge_tokens=3, is_architect=True, created_at=now, updated_at=now)
        assert "encrypted_openrouter_key" not in w.model_dump()
        assert "encrypted_replicate_key" not in w.model_dump()


class TestPhilosophicalAnchor:
    def test_valid(self):
        anchor = PhilosophicalAnchor(**_anchor())
        assert anchor.title == "The Weight of Clocks"

    def test_missing_field_raises(self):
        with pytest.raises(ValidationError):
            PhilosophicalAnchor(title="Missing fields")

    def test_empty_de_field_raises(self):
        with pytest.raises(ValidationError):
            PhilosophicalAnchor(**_anchor(title_de=""))

    @pytest.mark.parametrize(
        "field",
        ["title", "title_de", "literary_influence", "core_question", "bleed_signature_suggestion", "description"],
    )
    def test_placeholder_is_refused(self, field):
        """The measured failure case: a model returning "..." in every field."""
        with pytest.raises(ValidationError):
            PhilosophicalAnchor(**_anchor(**{field: "..."}))


class TestForgeAgentDraft:
    def test_valid(self):
        agent = ForgeAgentDraft(**_agent())
        assert agent.name == "Enzo"

    def test_missing_de_field_raises(self):
        payload = _agent()
        del payload["primary_profession_de"]
        del payload["character_de"]
        del payload["background_de"]
        with pytest.raises(ValidationError):
            ForgeAgentDraft(**payload)

    def test_empty_de_field_raises(self):
        with pytest.raises(ValidationError):
            ForgeAgentDraft(**_agent(primary_profession_de=""))

    @pytest.mark.parametrize("field", ["character", "character_de", "background", "background_de"])
    def test_long_form_floor_refuses_a_stub(self, field):
        """A one-line answer where 200-300 words were asked for is not an answer.

        The floor sits at half the shortest value the Forge has written on
        production (452 characters for `background`), so this sentence is
        categorically shorter than anything real.
        """
        with pytest.raises(ValidationError):
            ForgeAgentDraft(**_agent(**{field: "Meticulous and paranoid."}))

    def test_the_hollow_object_is_refused(self):
        """The measured case from finding 7: every field literally "...".

        It used to validate clean -- three dots satisfy `min_length=1`.
        """
        hollow = dict.fromkeys(_agent(), "...")
        with pytest.raises(ValidationError):
            ForgeAgentDraft(**hollow)

    def test_every_field_names_its_language(self):
        """Finding 12: the English side used to be unnamed, so the model guessed."""
        for name, field in ForgeAgentDraft.model_fields.items():
            described = (field.description or "").lower()
            assert described, f"{name} carries no description at all"
            assert "english" in described or "german" in described or "world's own language" in described, (
                f"{name} does not name a language: {field.description!r}"
            )


class TestForgeBuildingDraft:
    def test_defaults(self):
        building = ForgeBuildingDraft(**_building())
        assert building.building_condition == "good"

    def test_missing_de_field_raises(self):
        with pytest.raises(ValidationError):
            ForgeBuildingDraft(name="Loft", building_type="workshop", description=LONG)

    def test_long_form_floor_refuses_a_stub(self):
        with pytest.raises(ValidationError):
            ForgeBuildingDraft(**_building(description="Gears everywhere."))

    def test_three_letter_values_still_pass(self):
        """The gate was measured before it was trusted.

        A floor of four characters on the short fields would have refused the
        building type 'inn' and the German condition 'gut' -- both three
        characters, exactly the length of the "..." such a floor is meant to
        catch. There is no floor there, and this test says so out loud.
        """
        building = ForgeBuildingDraft(**_building(building_type="inn", building_condition_de="gut"))
        assert building.building_type == "inn"
        assert building.building_condition_de == "gut"


class TestForgeGeographyDraft:
    def test_valid(self):
        geo = ForgeGeographyDraft(
            city_name="Chronopolis",
            zones=[
                {
                    "name": "District 1",
                    "zone_type": "commercial",
                    "zone_type_de": "Gewerbe",
                    "description": SHORT_PROSE,
                    "description_de": SHORT_PROSE,
                    "characteristics": ["bustling", "neon-lit"],
                }
            ],
            streets=[
                {
                    "name": "Main St",
                    "zone_name": "District 1",
                    "street_type": "main",
                    "street_type_de": "Hauptstraße",
                }
            ],
        )
        assert geo.city_name == "Chronopolis"
        assert len(geo.zones) == 1
        assert geo.zones[0].characteristics == ["bustling", "neon-lit"]
        # The street description is genuinely optional and carries no floor:
        # a floor there would turn an omission into a hard failure.
        assert geo.streets[0].description == ""

    def test_zone_description_stub_is_refused(self):
        with pytest.raises(ValidationError):
            ForgeGeographyDraft(
                city_name="Chronopolis",
                zones=[
                    {
                        "name": "District 1",
                        "zone_type": "commercial",
                        "description": "...",
                        "characteristics": ["a"],
                    }
                ],
                streets=[],
            )


class TestCountedList:
    """Finding 10: the count belongs in the type, but not as an exact demand.

    Measured against the real anchor path, six runs per variant: no constraint
    gave three anchors 6/6 times, an exact `Len(3, 3)` gave 5/6 plus one total
    loss billed twice, and a ceiling-with-floor gave 6/6. The ceiling is what
    earns its place; the floor sits where a delivery stops being worth keeping.
    """

    def test_schema_carries_both_bounds(self):
        from pydantic import TypeAdapter

        schema = TypeAdapter(counted_list(PhilosophicalAnchor, 3, minimum=2)).json_schema()
        assert schema["minItems"] == 2
        assert schema["maxItems"] == 3

    def test_short_but_usable_is_accepted(self):
        from pydantic import TypeAdapter

        adapter = TypeAdapter(counted_list(PhilosophicalAnchor, 3, minimum=2))
        assert len(adapter.validate_python([_anchor(), _anchor()])) == 2

    def test_over_delivery_is_refused(self):
        from pydantic import TypeAdapter

        adapter = TypeAdapter(counted_list(PhilosophicalAnchor, 3, minimum=2))
        with pytest.raises(ValidationError):
            adapter.validate_python([_anchor()] * 4)

    def test_worthless_delivery_is_refused(self):
        from pydantic import TypeAdapter

        adapter = TypeAdapter(counted_list(PhilosophicalAnchor, 3, minimum=2))
        with pytest.raises(ValidationError):
            adapter.validate_python([_anchor()])

    def test_a_floor_above_the_ceiling_is_a_programming_error(self):
        with pytest.raises(ValueError, match="minimum"):
            counted_list(PhilosophicalAnchor, 3, minimum=4)


class TestUpdateBYOKRequest:
    def test_empty_valid(self):
        req = UpdateBYOKRequest()
        assert req.openrouter_key is None
        assert req.replicate_key is None

    def test_with_keys(self):
        req = UpdateBYOKRequest(
            openrouter_key="sk-or-v1-0123456789abcdef",
            replicate_key="r8_0123456789abcdef",
        )
        assert req.openrouter_key == "sk-or-v1-0123456789abcdef"

    def test_a_fragment_is_not_a_key(self):
        """There used to be no bound at all (finding 9).

        The floor rejects the fat-fingered fragment before it is stored as if
        it were a key; the ceiling keeps a paste accident or a hostile payload
        out of ``encrypt()`` and out of the database.
        """
        with pytest.raises(ValidationError):
            UpdateBYOKRequest(openrouter_key="sk-")
        with pytest.raises(ValidationError):
            UpdateBYOKRequest(replicate_key="r8_" + "x" * 600)
