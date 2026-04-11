"""Tests for backend.services.broadsheet_service — article ranking, voice derivation, statistics.

Covers:
  - _rank_articles: priority ordering, hero limit, empty source, bilingual fields, finishable limit
  - _derive_voice: health threshold mapping
  - _compute_statistics: count extraction
  - BroadsheetGenerateRequest: period validation
"""

from datetime import UTC, datetime

import pytest

from backend.models.broadsheet import BroadsheetGenerateRequest
from backend.services.broadsheet_service import (
    FINISHABLE_LIMIT,
    BroadsheetService,
)

# ── Fixtures ──────────────────────────────────────────────────────────────────


def _make_source(
    events: list | None = None,
    activities: list | None = None,
    resonance_impacts: list | None = None,
) -> dict:
    """Build a minimal source data dict for _rank_articles."""
    return {
        "events": events or [],
        "activities": activities or [],
        "resonance_impacts": resonance_impacts or [],
        "mood_summary": {},
        "gazette_entries": [],
        "health": None,
    }


def _event(title: str, impact: int, **kwargs) -> dict:
    return {"id": f"evt-{title}", "title": title, "impact_level": impact, **kwargs}


def _activity(name: str, significance: int, **kwargs) -> dict:
    return {
        "id": f"act-{name}",
        "agent_name": name,
        "activity_type": "explore",
        "narrative_text": f"{name} explored",
        "significance": significance,
        **kwargs,
    }


def _resonance(title: str, magnitude: float) -> dict:
    return {
        "id": f"res-{title}",
        "resonance_title": title,
        "effective_magnitude": magnitude,
        "narrative_context": f"{title} context",
    }


# ── Article Ranking ───────────────────────────────────────────────────────────


class TestRankArticles:
    """_rank_articles priority ordering and article construction."""

    def test_priority_order(self):
        """High-impact events outrank resonances which outrank activities."""
        source = _make_source(
            events=[_event("War", 9)],
            resonance_impacts=[_resonance("Rift", 0.8)],
            activities=[_activity("Scout", 6)],
        )
        articles = BroadsheetService._rank_articles(source)

        assert len(articles) == 3
        assert articles[0]["source_type"] == "event"  # 9*10=90
        assert articles[1]["source_type"] == "resonance"  # 0.8*80=64
        assert articles[2]["source_type"] == "activity"  # 6*8=48

    def test_single_hero(self):
        """Only one article gets layout_hint='hero', rest demoted to 'column'."""
        source = _make_source(
            events=[_event("A", 9), _event("B", 8)],
        )
        articles = BroadsheetService._rank_articles(source)

        heroes = [a for a in articles if a["layout_hint"] == "hero"]
        assert len(heroes) == 1
        assert heroes[0]["headline"] == "A"  # highest priority keeps hero

    def test_empty_source(self):
        """Empty source data returns empty article list."""
        source = _make_source()
        articles = BroadsheetService._rank_articles(source)
        assert articles == []

    def test_bilingual_fields(self):
        """Event _de fields are mapped to headline_de and content_de."""
        source = _make_source(
            events=[_event("War Begins", 7, title_de="Krieg beginnt", description_de="Beschreibung")],
        )
        articles = BroadsheetService._rank_articles(source)

        assert articles[0]["headline_de"] == "Krieg beginnt"
        assert articles[0]["content_de"] == "Beschreibung"

    def test_finishable_limit(self):
        """_rank_articles itself returns all; compile_edition slices to FINISHABLE_LIMIT."""
        events = [_event(f"E{i}", 10 - i) for i in range(10)]
        source = _make_source(events=events)

        all_articles = BroadsheetService._rank_articles(source)
        assert len(all_articles) == 10

        # compile_edition applies the limit via [:FINISHABLE_LIMIT]
        trimmed = all_articles[:FINISHABLE_LIMIT]
        assert len(trimmed) == 7

    def test_activity_sidebar_layout(self):
        """Activities default to 'sidebar' layout hint."""
        source = _make_source(activities=[_activity("Agent", 5)])
        articles = BroadsheetService._rank_articles(source)
        assert articles[0]["layout_hint"] == "sidebar"

    def test_activity_content_de(self):
        """Activity narrative_text_de is mapped to content_de."""
        source = _make_source(
            activities=[_activity("Agent", 5, narrative_text_de="Deutsch")],
        )
        articles = BroadsheetService._rank_articles(source)
        assert articles[0]["content_de"] == "Deutsch"


# ── Editorial Voice ───────────────────────────────────────────────────────────


class TestDeriveVoice:
    """_derive_voice health-to-tone mapping (Frostpunk moral mirror)."""

    @pytest.mark.parametrize(
        "health_pct,expected",
        [
            (0.10, "alarmed"),    # <25%
            (0.24, "alarmed"),    # boundary
            (0.25, "concerned"),  # 25-50%
            (0.49, "concerned"),  # boundary
            (0.50, "neutral"),    # 50-85%
            (0.85, "neutral"),    # boundary
            (0.86, "optimistic"), # >85%
            (1.00, "optimistic"),
        ],
    )
    def test_thresholds(self, health_pct: float, expected: str):
        assert BroadsheetService._derive_voice({"overall_health": health_pct}) == expected

    def test_none_health(self):
        """None overall_health returns neutral."""
        assert BroadsheetService._derive_voice({}) == "neutral"
        assert BroadsheetService._derive_voice({"overall_health": None}) == "neutral"


# ── Statistics ────────────────────────────────────────────────────────────────


class TestComputeStatistics:
    """_compute_statistics aggregation."""

    def test_counts(self):
        source = _make_source(
            events=[_event("A", 5), _event("B", 3)],
            activities=[_activity("C", 6)],
            resonance_impacts=[_resonance("D", 0.5), _resonance("E", 0.3), _resonance("F", 0.1)],
        )
        stats = BroadsheetService._compute_statistics(source)
        assert stats == {"event_count": 2, "activity_count": 1, "resonance_count": 3}

    def test_empty(self):
        stats = BroadsheetService._compute_statistics(_make_source())
        assert stats == {"event_count": 0, "activity_count": 0, "resonance_count": 0}


# ── Period Validation ─────────────────────────────────────────────────────────


class TestPeriodValidation:
    """BroadsheetGenerateRequest cross-field validation."""

    def test_rejects_inverted(self):
        with pytest.raises(ValueError, match="period_start must be before period_end"):
            BroadsheetGenerateRequest(
                period_start=datetime(2026, 4, 10, tzinfo=UTC),
                period_end=datetime(2026, 4, 1, tzinfo=UTC),
            )

    def test_rejects_equal(self):
        with pytest.raises(ValueError, match="period_start must be before period_end"):
            BroadsheetGenerateRequest(
                period_start=datetime(2026, 4, 10, tzinfo=UTC),
                period_end=datetime(2026, 4, 10, tzinfo=UTC),
            )

    def test_accepts_valid(self):
        req = BroadsheetGenerateRequest(
            period_start=datetime(2026, 4, 1, tzinfo=UTC),
            period_end=datetime(2026, 4, 10, tzinfo=UTC),
        )
        assert req.period_start < req.period_end
