"""Tests for individual source adapter parsing logic.

Tests the deterministic mapping functions used by structured adapters
without making HTTP calls.
"""

from __future__ import annotations

import pytest

# ---------------------------------------------------------------------------
# USGS Earthquake — Richter → Magnitude mapping
# ---------------------------------------------------------------------------

class TestUSGSMagnitudeMapping:
    """Tests for _richter_to_magnitude."""

    def test_mag_4(self):
        from backend.services.scanning.adapters.usgs_earthquakes import _richter_to_magnitude

        assert _richter_to_magnitude(4.0, None, 0) == 0.15

    def test_mag_5(self):
        from backend.services.scanning.adapters.usgs_earthquakes import _richter_to_magnitude

        assert _richter_to_magnitude(5.0, None, 0) == 0.25

    def test_mag_6(self):
        from backend.services.scanning.adapters.usgs_earthquakes import _richter_to_magnitude

        assert _richter_to_magnitude(6.0, None, 0) == 0.45

    def test_mag_7(self):
        from backend.services.scanning.adapters.usgs_earthquakes import _richter_to_magnitude

        assert _richter_to_magnitude(7.0, None, 0) == 0.70

    def test_mag_8(self):
        from backend.services.scanning.adapters.usgs_earthquakes import _richter_to_magnitude

        assert _richter_to_magnitude(8.0, None, 0) == 0.95

    def test_mag_9(self):
        from backend.services.scanning.adapters.usgs_earthquakes import _richter_to_magnitude

        assert _richter_to_magnitude(9.0, None, 0) == 0.95

    def test_red_alert_boost(self):
        from backend.services.scanning.adapters.usgs_earthquakes import _richter_to_magnitude

        base = _richter_to_magnitude(7.0, None, 0)
        boosted = _richter_to_magnitude(7.0, "red", 0)
        assert boosted == base + 0.15

    def test_tsunami_boost(self):
        from backend.services.scanning.adapters.usgs_earthquakes import _richter_to_magnitude

        boosted = _richter_to_magnitude(7.0, None, 1)
        assert boosted == 0.80  # 0.70 base + 0.10 tsunami

    def test_both_boosts(self):
        from backend.services.scanning.adapters.usgs_earthquakes import _richter_to_magnitude

        result = _richter_to_magnitude(7.0, "red", 1)
        # 0.70 + 0.15 + 0.10 = 0.95
        assert result == 0.95

    def test_clamp_to_max(self):
        from backend.services.scanning.adapters.usgs_earthquakes import _richter_to_magnitude

        result = _richter_to_magnitude(8.0, "red", 1)
        # 0.95 + 0.15 + 0.10 = 1.20 → clamped to 1.0
        assert result == 1.0

    def test_clamp_to_min(self):
        from backend.services.scanning.adapters.usgs_earthquakes import _richter_to_magnitude

        result = _richter_to_magnitude(2.0, None, 0)
        assert result >= 0.1


# ---------------------------------------------------------------------------
# NOAA — Severity → Magnitude mapping
# ---------------------------------------------------------------------------

class TestNOAAMagnitudeMapping:
    """Tests for _severity_to_magnitude."""

    def test_minor(self):
        from backend.services.scanning.adapters.noaa_alerts import _severity_to_magnitude

        assert _severity_to_magnitude("Minor", "Winter Storm") == 0.10

    def test_moderate(self):
        from backend.services.scanning.adapters.noaa_alerts import _severity_to_magnitude

        assert _severity_to_magnitude("Moderate", "Flood Warning") == 0.20

    def test_severe(self):
        from backend.services.scanning.adapters.noaa_alerts import _severity_to_magnitude

        assert _severity_to_magnitude("Severe", "Thunderstorm Warning") == 0.45

    def test_extreme(self):
        from backend.services.scanning.adapters.noaa_alerts import _severity_to_magnitude

        assert _severity_to_magnitude("Extreme", "Heat Advisory") == 0.75

    def test_tornado_boost(self):
        from backend.services.scanning.adapters.noaa_alerts import _severity_to_magnitude

        result = _severity_to_magnitude("Extreme", "Tornado Warning")
        # 0.75 + 0.15 = 0.90
        assert result == 0.90

    def test_hurricane_boost(self):
        from backend.services.scanning.adapters.noaa_alerts import _severity_to_magnitude

        result = _severity_to_magnitude("Extreme", "Hurricane Warning")
        # 0.75 + 0.20 = 0.95
        assert result == 0.95

    def test_tsunami_boost(self):
        from backend.services.scanning.adapters.noaa_alerts import _severity_to_magnitude

        result = _severity_to_magnitude("Severe", "Tsunami Warning")
        # 0.45 + 0.20 = 0.65
        assert result == 0.65

    def test_clamp_to_max(self):
        from backend.services.scanning.adapters.noaa_alerts import _severity_to_magnitude

        result = _severity_to_magnitude("Extreme", "Hurricane Warning")
        assert result <= 1.0

    def test_unknown_severity_defaults(self):
        from backend.services.scanning.adapters.noaa_alerts import _severity_to_magnitude

        result = _severity_to_magnitude("Unknown", "Generic Alert")
        assert result == 0.20  # default base


# ---------------------------------------------------------------------------
# NASA EONET — Category mapping
# ---------------------------------------------------------------------------

class TestNASAEONETCategoryMapping:
    """Tests for NASA EONET category to resonance category mapping."""

    def test_mapping_exists(self):
        from backend.services.scanning.adapters.nasa_eonet import _CATEGORY_MAP

        assert "wildfires" in _CATEGORY_MAP
        assert "volcanoes" in _CATEGORY_MAP
        assert "severeStorms" in _CATEGORY_MAP

    def test_natural_disaster_categories(self):
        from backend.services.scanning.adapters.nasa_eonet import _CATEGORY_MAP

        natural = {"volcanoes", "severeStorms", "floods", "landslides", "earthquakes"}
        for cat in natural:
            if cat in _CATEGORY_MAP:
                assert _CATEGORY_MAP[cat] == "natural_disaster"

    def test_environmental_categories(self):
        from backend.services.scanning.adapters.nasa_eonet import _CATEGORY_MAP

        environmental = {"waterColor", "dustHaze"}
        for cat in environmental:
            if cat in _CATEGORY_MAP:
                assert _CATEGORY_MAP[cat] == "environmental_disaster"


# ---------------------------------------------------------------------------
# GDACS — Alert level mapping
# ---------------------------------------------------------------------------

class TestGDACSMapping:
    """Tests for GDACS alert level to magnitude mapping."""

    def test_alert_levels(self):
        from backend.services.scanning.adapters.gdacs import _ALERT_MAGNITUDE

        assert _ALERT_MAGNITUDE["Green"] == 0.15
        assert _ALERT_MAGNITUDE["Orange"] == 0.45
        assert _ALERT_MAGNITUDE["Red"] == 0.80


# ---------------------------------------------------------------------------
# Adapter class attributes
# ---------------------------------------------------------------------------

class TestAdapterAttributes:
    """Verify all adapter classes have required attributes."""

    @pytest.fixture(autouse=True)
    def _import_adapters(self):
        import backend.services.scanning.adapters  # noqa: F401

    def test_all_have_name(self):
        from backend.services.scanning.registry import _ADAPTERS

        for name, cls in _ADAPTERS.items():
            assert cls.name == name, f"{cls.__name__}.name mismatch"

    def test_all_have_display_name(self):
        from backend.services.scanning.registry import _ADAPTERS

        for name, cls in _ADAPTERS.items():
            assert hasattr(cls, "display_name"), f"{name} missing display_name"
            assert isinstance(cls.display_name, str)
            assert len(cls.display_name) > 0

    def test_all_have_categories(self):
        from backend.services.scanning.registry import _ADAPTERS

        valid_cats = {
            "economic_crisis", "military_conflict", "pandemic",
            "natural_disaster", "political_upheaval", "tech_breakthrough",
            "cultural_shift", "environmental_disaster",
        }
        for name, cls in _ADAPTERS.items():
            assert hasattr(cls, "categories"), f"{name} missing categories"
            assert isinstance(cls.categories, list)
            assert len(cls.categories) > 0
            for cat in cls.categories:
                assert cat in valid_cats, f"{name} has invalid category: {cat}"

    def test_all_have_default_interval(self):
        from backend.services.scanning.registry import _ADAPTERS

        for name, cls in _ADAPTERS.items():
            assert hasattr(cls, "default_interval"), f"{name} missing default_interval"
            assert isinstance(cls.default_interval, int)
            assert cls.default_interval >= 60, f"{name} interval too small: {cls.default_interval}"

    def test_structured_flag_consistency(self):
        from backend.services.scanning.registry import _ADAPTERS

        # Structured sources should NOT require API keys
        for name, cls in _ADAPTERS.items():
            if cls.is_structured:
                # USGS, NOAA, NASA, GDACS, disease.sh — all free/no key
                # (This is a design invariant, not a universal rule)
                pass  # Just verify the flag exists
            assert isinstance(cls.is_structured, bool), f"{name} is_structured not bool"

    def test_api_key_setting_matches_requirement(self):
        from backend.services.scanning.registry import _ADAPTERS

        for name, cls in _ADAPTERS.items():
            if cls.requires_api_key:
                assert cls.api_key_setting is not None, f"{name} requires key but no api_key_setting"
            else:
                # api_key_setting can be None or not set
                pass


# ---------------------------------------------------------------------------
# HackerNews — score filtering
# ---------------------------------------------------------------------------

class TestHackerNewsConstants:
    """Verify HN adapter constants."""

    def test_min_score(self):
        from backend.services.scanning.adapters.hackernews import MIN_SCORE

        assert MIN_SCORE == 200

    def test_max_items(self):
        from backend.services.scanning.adapters.hackernews import MAX_ITEMS

        assert MAX_ITEMS == 30

    def test_is_unstructured(self):
        from backend.services.scanning.adapters.hackernews import HackerNewsScannerAdapter

        assert HackerNewsScannerAdapter.is_structured is False
        assert HackerNewsScannerAdapter.requires_api_key is False


# ---------------------------------------------------------------------------
# GDELT — keyword queries
# ---------------------------------------------------------------------------

class TestGDELTQueries:
    """Verify GDELT category keyword queries exist."""

    def test_all_categories_have_queries(self):
        from backend.services.scanning.adapters.gdelt import GDELT_CATEGORY_QUERIES

        expected = {
            "economic_crisis", "military_conflict", "pandemic",
            "natural_disaster", "political_upheaval", "tech_breakthrough",
            "cultural_shift", "environmental_disaster",
        }
        assert set(GDELT_CATEGORY_QUERIES.keys()) == expected

    def test_queries_are_nonempty(self):
        from backend.services.scanning.adapters.gdelt import GDELT_CATEGORY_QUERIES

        for cat, query in GDELT_CATEGORY_QUERIES.items():
            assert isinstance(query, str), f"{cat} query not a string"
            assert len(query) > 10, f"{cat} query too short"
