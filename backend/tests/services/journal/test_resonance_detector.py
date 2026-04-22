"""Unit tests for the rule-based resonance detector (P2, AD-2).

Pure functions — no mocks needed. Each rule has a positive, a negative,
and a priority-conflict case. Constellation-level tests verify the
aggregation: pair-wise matches roll up to a single dominant type, with
evidence tags deduplicated across qualifying pairs.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

from backend.models.journal import FragmentResponse
from backend.services.journal.resonance_detector import (
    ResonanceType,
    detect_constellation,
    detect_pair,
)


def _frag(
    tags: list[str],
    *,
    created_at: datetime | None = None,
    fragment_type: str = "imprint",
) -> FragmentResponse:
    """Minimal fragment factory — only the fields the detector reads."""
    return FragmentResponse(
        id=uuid4(),
        user_id=uuid4(),
        simulation_id=uuid4(),
        fragment_type=fragment_type,
        source_type="dungeon",
        source_id=uuid4(),
        content_de="…",
        content_en="…",
        thematic_tags=tags,
        rarity="common",
        created_at=created_at or datetime.now(UTC),
    )


# ── detect_pair: each rule ──────────────────────────────────────────────


def test_pair_archetype_match():
    a = _frag(["shadow", "ritual", "waiting"])
    b = _frag(["shadow", "light", "trauer"])
    m = detect_pair(a, b)
    assert m is not None
    assert m.resonance_type is ResonanceType.ARCHETYPE
    assert m.evidence_tags == ("shadow",)


def test_pair_archetype_no_match_when_different_archetypes():
    a = _frag(["shadow", "grief"])
    b = _frag(["tower", "grief"])
    # Same valence tag but count = 1 (below emotional threshold),
    # different archetypes — should fall through to temporal.
    m = detect_pair(a, b)
    # No shared archetype; shared "grief" is valence (count 1 — below
    # emotional threshold); nothing remains for temporal overlap.
    assert m is None


def test_pair_emotional_match_two_valence_tags():
    a = _frag(["grief", "shame", "rituale"])
    b = _frag(["grief", "shame", "other"])
    m = detect_pair(a, b)
    assert m is not None
    assert m.resonance_type is ResonanceType.EMOTIONAL
    assert set(m.evidence_tags) == {"grief", "shame"}


def test_pair_emotional_below_threshold_falls_through():
    a = _frag(["grief", "ritual"])
    b = _frag(["grief", "ritual"])
    m = detect_pair(a, b)
    # Only 1 valence overlap — below threshold of 2. But "ritual" is
    # neither valence nor archetype, so temporal rule matches (recent
    # timestamps by default).
    assert m is not None
    assert m.resonance_type is ResonanceType.TEMPORAL
    assert "ritual" in m.evidence_tags


def test_pair_temporal_match_with_non_valence_tag():
    now = datetime.now(UTC)
    a = _frag(["embassy", "decree"], created_at=now)
    b = _frag(["embassy", "signal"], created_at=now - timedelta(hours=12))
    m = detect_pair(a, b)
    assert m is not None
    assert m.resonance_type is ResonanceType.TEMPORAL
    assert m.evidence_tags == ("embassy",)


def test_pair_temporal_rejects_when_outside_window():
    now = datetime.now(UTC)
    a = _frag(["embassy", "decree"], created_at=now)
    b = _frag(["embassy", "signal"], created_at=now - timedelta(hours=96))
    m = detect_pair(a, b)
    assert m is None


def test_pair_contradiction_match_cross_fragment():
    a = _frag(["victory", "shadow"])
    b = _frag(["defeat", "tower"])
    m = detect_pair(a, b)
    assert m is not None
    assert m.resonance_type is ResonanceType.CONTRADICTION
    assert set(m.evidence_tags) == {"victory", "defeat"}


def test_pair_contradiction_match_is_symmetric():
    """Tag on a side A or side B — both orientations must match."""
    a = _frag(["defeat"])
    b = _frag(["victory"])
    m = detect_pair(a, b)
    assert m is not None and m.resonance_type is ResonanceType.CONTRADICTION


def test_pair_contradiction_wins_over_archetype():
    """Priority: contradiction > archetype when both would match."""
    a = _frag(["shadow", "victory"])
    b = _frag(["shadow", "defeat"])
    m = detect_pair(a, b)
    assert m is not None
    assert m.resonance_type is ResonanceType.CONTRADICTION


def test_pair_archetype_wins_over_emotional():
    """Priority: archetype > emotional when both would match."""
    a = _frag(["shadow", "grief", "shame"])
    b = _frag(["shadow", "grief", "shame"])
    m = detect_pair(a, b)
    assert m is not None
    assert m.resonance_type is ResonanceType.ARCHETYPE


def test_pair_emotional_wins_over_temporal():
    """Priority: emotional > temporal when both would match."""
    now = datetime.now(UTC)
    a = _frag(["grief", "shame", "ritual"], created_at=now)
    b = _frag(["grief", "shame", "ritual"], created_at=now - timedelta(hours=1))
    m = detect_pair(a, b)
    assert m is not None
    assert m.resonance_type is ResonanceType.EMOTIONAL


def test_pair_empty_tags_returns_none():
    a = _frag([])
    b = _frag(["grief", "shame"])
    assert detect_pair(a, b) is None
    assert detect_pair(b, a) is None


def test_pair_tolerates_non_string_tags():
    """Malformed tags (None, ints) should be filtered silently, not
    raise. LLM JSON output can occasionally drift."""
    a = FragmentResponse(
        id=uuid4(),
        user_id=uuid4(),
        simulation_id=uuid4(),
        fragment_type="imprint",
        source_type="dungeon",
        source_id=uuid4(),
        content_de="…",
        content_en="…",
        thematic_tags=["shadow", "", "grief"],
        rarity="common",
        created_at=datetime.now(UTC),
    )
    b = _frag(["shadow", "ritual"])
    m = detect_pair(a, b)
    assert m is not None
    assert m.resonance_type is ResonanceType.ARCHETYPE


def test_pair_case_insensitive():
    """Tags are normalised to lowercase before matching — LLM output
    capitalisation is not meaningful."""
    a = _frag(["Shadow", "Ritual"])
    b = _frag(["SHADOW", "other"])
    m = detect_pair(a, b)
    assert m is not None
    assert m.resonance_type is ResonanceType.ARCHETYPE


# ── detect_constellation: aggregation ─────────────────────────────────


def test_constellation_empty_returns_none():
    assert detect_constellation([]) is None


def test_constellation_single_fragment_returns_none():
    assert detect_constellation([_frag(["shadow"])]) is None


def test_constellation_picks_highest_priority_across_pairs():
    """Mix of pairs: one contradicts, others archetype. Contradiction
    wins — it's rarer + richer."""
    a = _frag(["shadow", "victory"])
    b = _frag(["shadow", "defeat"])
    c = _frag(["shadow", "ritual"])
    m = detect_constellation([a, b, c])
    assert m is not None
    assert m.resonance_type is ResonanceType.CONTRADICTION


def test_constellation_aggregates_evidence_across_qualifying_pairs():
    """When multiple pairs fire the same (winning) type, their
    evidence tags accumulate deduplicated + sorted."""
    # Three fragments all sharing 'shadow'; pairs (a,b), (a,c), (b,c)
    # all produce archetype matches with evidence_tags=("shadow",).
    a = _frag(["shadow", "grief"])
    b = _frag(["shadow", "peace"])
    c = _frag(["shadow", "fear"])
    m = detect_constellation([a, b, c])
    assert m is not None
    assert m.resonance_type is ResonanceType.ARCHETYPE
    assert m.evidence_tags == ("shadow",)


def test_constellation_returns_none_when_no_pair_matches():
    """Three fragments with zero overlap in any dimension."""
    a = _frag(["aleph"])  # non-valence, non-archetype tag
    b = _frag(["beth"])
    c = _frag(["gimel"])
    # Timestamps default to "now" so temporal window qualifies — but
    # there's no shared tag, so temporal also fails.
    assert detect_constellation([a, b, c]) is None
