"""Tests for Substrate Scanner pipeline stages.

Covers:
1. pre_filter — keyword reject/boost for scan results
2. deduplicator — title similarity (Jaccard), keyword extraction
3. classifier — JSON extraction from LLM output, significance→magnitude mapping
4. registry — adapter registration and lookup
"""

from __future__ import annotations

import pytest

from backend.services.scanning.base_adapter import ScanResult

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_result(
    title: str,
    source_name: str = "test",
    source_id: str | None = None,
    source_category: str | None = None,
    magnitude: float | None = None,
    is_structured: bool = False,
) -> ScanResult:
    return ScanResult(
        source_id=source_id or f"id_{title[:10]}",
        source_name=source_name,
        title=title,
        source_category=source_category,
        magnitude=magnitude,
        is_structured=is_structured,
    )


# ---------------------------------------------------------------------------
# Pre-filter
# ---------------------------------------------------------------------------

class TestPreFilter:
    """Unit tests for keyword-based pre-filter."""

    def test_rejects_celebrity_gossip(self):
        from backend.services.scanning.pre_filter import pre_filter

        results = [_make_result("Kim Kardashian spotted at fashion week")]
        assert pre_filter(results) == []

    def test_rejects_sports(self):
        from backend.services.scanning.pre_filter import pre_filter

        results = [_make_result("Champions League quarter-finals draw")]
        assert pre_filter(results) == []

    def test_keeps_earthquake_headline(self):
        from backend.services.scanning.pre_filter import pre_filter

        results = [_make_result("Massive earthquake strikes central Turkey")]
        filtered = pre_filter(results)
        assert len(filtered) == 1
        assert filtered[0].title == "Massive earthquake strikes central Turkey"

    def test_keeps_generic_news(self):
        from backend.services.scanning.pre_filter import pre_filter

        results = [_make_result("New trade agreement signed between nations")]
        filtered = pre_filter(results)
        assert len(filtered) == 1

    def test_structured_always_pass(self):
        from backend.services.scanning.pre_filter import pre_filter

        # Even a celebrity headline passes if structured
        results = [_make_result(
            "Celebrity gossip roundup",
            is_structured=True,
            source_category="natural_disaster",
        )]
        filtered = pre_filter(results)
        assert len(filtered) == 1

    def test_reject_takes_priority_for_unstructured(self):
        from backend.services.scanning.pre_filter import pre_filter

        results = [_make_result("Movie review: war documentary")]
        filtered = pre_filter(results)
        # "movie review" is in reject patterns
        assert len(filtered) == 0

    def test_empty_list(self):
        from backend.services.scanning.pre_filter import pre_filter

        assert pre_filter([]) == []

    def test_mixed_batch(self):
        from backend.services.scanning.pre_filter import pre_filter

        results = [
            _make_result("Celebrity dating rumors"),  # reject
            _make_result("Tsunami warning issued for Pacific coast"),  # keep
            _make_result("Premier League results"),  # reject
            _make_result("Military conflict escalates in border region"),  # keep
            _make_result(
                "M 6.5 Earthquake",
                is_structured=True,
                source_category="natural_disaster",
            ),  # structured: keep
        ]
        filtered = pre_filter(results)
        assert len(filtered) == 3
        titles = {r.title for r in filtered}
        assert "Tsunami warning issued for Pacific coast" in titles
        assert "Military conflict escalates in border region" in titles
        assert "M 6.5 Earthquake" in titles


# ---------------------------------------------------------------------------
# Deduplicator — title similarity (pure functions, no DB)
# ---------------------------------------------------------------------------

class TestTitleSimilarity:
    """Tests for Jaccard title similarity helpers."""

    def test_identical_titles(self):
        from backend.services.scanning.deduplicator import _title_similarity

        assert _title_similarity(
            "Major earthquake strikes Turkey",
            "Major earthquake strikes Turkey",
        ) == 1.0

    def test_completely_different(self):
        from backend.services.scanning.deduplicator import _title_similarity

        sim = _title_similarity(
            "Earthquake strikes Turkey",
            "New vaccine approved by regulators",
        )
        assert sim < 0.2

    def test_similar_but_rephrased(self):
        from backend.services.scanning.deduplicator import _title_similarity

        sim = _title_similarity(
            "M 7.2 earthquake strikes central Turkey killing hundreds",
            "Turkey earthquake kills hundreds magnitude 7.2 central region",
        )
        assert sim >= 0.4  # Shares core keywords despite different phrasing

    def test_empty_title(self):
        from backend.services.scanning.deduplicator import _title_similarity

        assert _title_similarity("", "Something") == 0.0
        assert _title_similarity("Something", "") == 0.0

    def test_stop_words_ignored(self):
        from backend.services.scanning.deduplicator import _title_keywords

        keywords = _title_keywords("The earthquake was very devastating")
        assert "the" not in keywords
        assert "was" not in keywords
        assert "very" not in keywords
        assert "earthquake" in keywords
        assert "devastating" in keywords

    def test_threshold_boundary(self):
        from backend.services.scanning.deduplicator import _title_similarity

        # Same core keywords, different phrasing
        sim = _title_similarity(
            "Hurricane devastates Florida coastal areas",
            "Florida hurricane devastates coastal communities",
        )
        # Should be near or above threshold (both share hurricane, devastates, florida, coastal)
        assert sim > 0.5


# ---------------------------------------------------------------------------
# Classifier — JSON extraction
# ---------------------------------------------------------------------------

class TestClassifierJsonExtraction:
    """Tests for _parse_json_from_text."""

    def test_plain_json(self):
        from backend.services.scanning.classifier import _parse_json_from_text

        result = _parse_json_from_text(
            '[{"index": 0, "category": "pandemic", "significance": 7, "reason": "test"}]'
        )
        assert isinstance(result, list)
        assert result[0]["category"] == "pandemic"

    def test_markdown_fenced_json(self):
        from backend.services.scanning.classifier import _parse_json_from_text

        result = _parse_json_from_text(
            '```json\n[{"index": 0, "category": "natural_disaster", "significance": 9}]\n```'
        )
        assert isinstance(result, list)
        assert result[0]["category"] == "natural_disaster"

    def test_json_with_surrounding_text(self):
        from backend.services.scanning.classifier import _parse_json_from_text

        result = _parse_json_from_text(
            'Here are the results:\n[{"index": 0, "category": "military_conflict", "significance": 6}]\nDone.'
        )
        assert isinstance(result, list)
        assert result[0]["category"] == "military_conflict"

    def test_invalid_json_returns_none(self):
        from backend.services.scanning.classifier import _parse_json_from_text

        assert _parse_json_from_text("not json at all") is None

    def test_empty_string(self):
        from backend.services.scanning.classifier import _parse_json_from_text

        assert _parse_json_from_text("") is None

    def test_code_fence_without_json_label(self):
        from backend.services.scanning.classifier import _parse_json_from_text

        result = _parse_json_from_text(
            '```\n[{"index": 0, "category": "tech_breakthrough", "significance": 5}]\n```'
        )
        assert isinstance(result, list)
        assert result[0]["significance"] == 5


class TestSignificanceMapping:
    """Tests for significance → magnitude mapping."""

    def test_all_significance_levels(self):
        from backend.services.scanning.classifier import _SIGNIFICANCE_TO_MAGNITUDE

        assert _SIGNIFICANCE_TO_MAGNITUDE[1] == 0.10
        assert _SIGNIFICANCE_TO_MAGNITUDE[5] == 0.50
        assert _SIGNIFICANCE_TO_MAGNITUDE[10] == 1.00

    def test_mapping_completeness(self):
        from backend.services.scanning.classifier import _SIGNIFICANCE_TO_MAGNITUDE

        assert set(_SIGNIFICANCE_TO_MAGNITUDE.keys()) == set(range(1, 11))

    def test_valid_categories(self):
        from backend.services.scanning.classifier import VALID_CATEGORIES

        expected = {
            "economic_crisis", "military_conflict", "pandemic",
            "natural_disaster", "political_upheaval", "tech_breakthrough",
            "cultural_shift", "environmental_disaster",
        }
        assert VALID_CATEGORIES == expected


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

class TestRegistry:
    """Tests for adapter registry."""

    def test_all_adapters_registered(self):
        # Import triggers registration
        import backend.services.scanning.adapters  # noqa: F401
        from backend.services.scanning.registry import get_adapter_names

        names = get_adapter_names()
        expected = {
            "usgs_earthquakes", "noaa_alerts", "nasa_eonet", "gdacs",
            "disease_sh", "who_outbreaks", "guardian", "newsapi",
            "gdelt", "hackernews",
        }
        assert set(names) == expected

    def test_get_adapter_returns_instance(self):
        import backend.services.scanning.adapters  # noqa: F401
        from backend.services.scanning.registry import get_adapter

        adapter = get_adapter("usgs_earthquakes")
        assert adapter.name == "usgs_earthquakes"
        assert adapter.is_structured is True
        assert adapter.requires_api_key is False

    def test_get_unknown_adapter_raises(self):
        from backend.services.scanning.registry import get_adapter

        with pytest.raises(KeyError, match="Unknown adapter"):
            get_adapter("nonexistent_source")

    def test_adapter_info_structure(self):
        import backend.services.scanning.adapters  # noqa: F401
        from backend.services.scanning.registry import get_adapter_info

        info = get_adapter_info()
        assert len(info) == 10

        for entry in info:
            assert "name" in entry
            assert "display_name" in entry
            assert "categories" in entry
            assert "is_structured" in entry
            assert "requires_api_key" in entry
            assert "default_interval" in entry
            assert isinstance(entry["categories"], list)
            assert isinstance(entry["default_interval"], int)

    def test_structured_adapters_identified(self):
        import backend.services.scanning.adapters  # noqa: F401
        from backend.services.scanning.registry import get_adapter_info

        info = get_adapter_info()
        structured = {e["name"] for e in info if e["is_structured"]}
        expected_structured = {"usgs_earthquakes", "noaa_alerts", "nasa_eonet", "gdacs", "disease_sh"}
        assert structured == expected_structured

    def test_api_key_adapters(self):
        import backend.services.scanning.adapters  # noqa: F401
        from backend.services.scanning.registry import get_adapter_info

        info = get_adapter_info()
        needs_key = {e["name"] for e in info if e["requires_api_key"]}
        assert "guardian" in needs_key
        assert "newsapi" in needs_key
        assert "usgs_earthquakes" not in needs_key


# ---------------------------------------------------------------------------
# ScanResult dataclass
# ---------------------------------------------------------------------------

class TestScanResult:
    """Tests for ScanResult dataclass."""

    def test_defaults(self):
        r = ScanResult(source_id="abc", source_name="test", title="Test Event")
        assert r.url is None
        assert r.description is None
        assert r.source_category is None
        assert r.magnitude is None
        assert r.is_structured is False
        assert r.raw_data == {}

    def test_structured_result(self):
        r = ScanResult(
            source_id="eq123",
            source_name="usgs_earthquakes",
            title="M 7.2 - Turkey",
            source_category="natural_disaster",
            magnitude=0.85,
            is_structured=True,
        )
        assert r.is_structured is True
        assert r.source_category == "natural_disaster"
        assert r.magnitude == 0.85
