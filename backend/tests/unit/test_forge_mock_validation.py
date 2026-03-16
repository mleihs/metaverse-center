"""Structural tests: mock data must pass through Pydantic model validation.

These tests guarantee that forge_mock_service fixtures can never drift
out of sync with the model constraints they are consumed by.
If a model field becomes required or gains a validator, these tests
will catch mock data that violates it.
"""

from backend.services import forge_mock_service as mock


class TestMockAnchorsValidation:
    """mock_anchors output must satisfy PhilosophicalAnchor constraints."""

    def test_returns_three_anchors(self):
        anchors = mock.mock_anchors("test-seed")
        assert len(anchors) == 3

    def test_all_de_fields_populated(self):
        for anchor in mock.mock_anchors("test-seed"):
            assert anchor["title_de"], f"title_de empty for {anchor['title']}"
            assert anchor["literary_influence_de"]
            assert anchor["core_question_de"]
            assert anchor["description_de"]

    def test_different_seeds_produce_valid_output(self):
        for seed in ["alpha", "beta", "gamma", "δ"]:
            anchors = mock.mock_anchors(seed)
            assert len(anchors) == 3
            for a in anchors:
                assert a["title_de"]


class TestMockAgentsValidation:
    """mock_agents output must satisfy ForgeAgentDraft constraints."""

    def test_returns_requested_count(self):
        agents = mock.mock_agents("test-seed", count=4)
        assert len(agents) == 4

    def test_all_de_fields_populated(self):
        for agent in mock.mock_agents("test-seed", count=6):
            assert agent["primary_profession_de"], f"primary_profession_de empty for {agent['name']}"
            assert agent["character_de"], f"character_de empty for {agent['name']}"
            assert agent["background_de"], f"background_de empty for {agent['name']}"


class TestMockBuildingsValidation:
    """mock_buildings output must satisfy ForgeBuildingDraft constraints."""

    def test_returns_requested_count(self):
        buildings = mock.mock_buildings("test-seed", count=5)
        assert len(buildings) == 5

    def test_all_de_fields_populated(self):
        for b in mock.mock_buildings("test-seed", count=7):
            assert b["building_type_de"], f"building_type_de empty for {b['name']}"
            assert b["description_de"], f"description_de empty for {b['name']}"
            assert b["building_condition_de"], f"building_condition_de empty for {b['name']}"


class TestMockGeographyValidation:
    """mock_geography output must satisfy ForgeGeographyDraft constraints."""

    def test_has_zones_and_streets(self):
        geo = mock.mock_geography("test-seed")
        assert len(geo["zones"]) > 0
        assert len(geo["streets"]) > 0

    def test_zone_de_fields_populated(self):
        for zone in mock.mock_geography("test-seed")["zones"]:
            assert zone["zone_type_de"], f"zone_type_de empty for {zone['name']}"
            assert zone["description_de"], f"description_de empty for {zone['name']}"

    def test_street_de_fields_populated(self):
        for street in mock.mock_geography("test-seed")["streets"]:
            assert street["street_type_de"], f"street_type_de empty for {street['name']}"


class TestMockRecruitsValidation:
    """mock_recruits output must satisfy ForgeAgentDraft constraints."""

    def test_returns_three_recruits(self):
        recruits = mock.mock_recruits("test-sim")
        assert len(recruits) == 3

    def test_all_de_fields_populated(self):
        for r in mock.mock_recruits("test-sim"):
            assert r["primary_profession_de"], f"primary_profession_de empty for {r['name']}"
            assert r["character_de"], f"character_de empty for {r['name']}"
            assert r["background_de"], f"background_de empty for {r['name']}"

    def test_with_existing_agent_names(self):
        """Recruits should validate even when referencing existing agents."""
        recruits = mock.mock_recruits(
            "test-sim",
            existing_agent_names=["Vesper Caine", "Enzo Kral", "Mira Solenne"],
        )
        assert len(recruits) == 3
        for r in recruits:
            assert r["character_de"]
            assert r["background_de"]
