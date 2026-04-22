"""Rule-based resonance detection for journal constellations (AD-2).

No LLM calls, no DB access. Pure functions operating on the
``thematic_tags`` that every fragment carries from the generation
prompt. Four rules match the concept's four resonance types:

    archetype       same archetype slug on both fragments
    emotional       >= 2 overlapping valence tags
    temporal        created within 72h of each other AND share >= 1 tag
    contradiction   cross-fragment antonym pair (e.g. victory/defeat)

Priority when multiple rules match the same pair:
    contradiction > archetype > emotional > temporal.

Contradiction is rarest+richest (negative overlap), so it wins over
the positive-overlap rules; temporal is the weakest signal (tags
plus co-occurrence) and tie-breaks last.

The detector is pure: the constellation service is responsible for
loading fragments and passing them in. That keeps the rules unit-
testable without any DB fixtures and avoids coupling the detector
to the fragment storage backend.
"""

from __future__ import annotations

from collections.abc import Iterator, Sequence
from dataclasses import dataclass
from datetime import timedelta
from enum import StrEnum

from backend.models.journal import FragmentResponse, ResonancePair


class ResonanceType(StrEnum):
    ARCHETYPE = "archetype"
    EMOTIONAL = "emotional"
    TEMPORAL = "temporal"
    CONTRADICTION = "contradiction"


# Dungeon archetype slugs that carry semantic weight when they appear
# in thematic_tags. Matches the output of ``hooks._archetype_to_slug``
# so the tag produced by the Imprint hook's context flows naturally
# into the LLM prompt and back out in the fragment's tags.
#
# Drift risk: adding an archetype requires adding its slug here. A
# mismatch produces a false-negative archetype match, never a false
# positive — tests can't catch future drift, so this set is documented
# explicitly.
ARCHETYPE_TAGS: frozenset[str] = frozenset(
    {
        "shadow",
        "tower",
        "devouring_mother",
        "entropy",
        "prometheus",
        "deluge",
        "awakening",
        "overthrow",
    }
)

# Valence/emotional vocabulary the LLM prompts hint at (system prompts
# include example tags like 'trauer', 'ruhe', 'wachen'). The set covers
# the concept's DE+EN vocabulary pragmatically; unrecognised valence
# words simply fall into the temporal bucket via the non-valence
# fallback — not a correctness problem, just a missed emotional match.
VALENCE_TAGS: frozenset[str] = frozenset(
    {
        # English
        "grief",
        "joy",
        "fear",
        "anger",
        "shame",
        "longing",
        "peace",
        "awe",
        "disgust",
        "wonder",
        "hope",
        "loss",
        "despair",
        "relief",
        # German
        "trauer",
        "freude",
        "furcht",
        "zorn",
        "scham",
        "sehnsucht",
        "ruhe",
        "ehrfurcht",
        "ekel",
        "staunen",
        "hoffnung",
        "verlust",
        "verzweiflung",
        "erleichterung",
    }
)

# Contradiction antonym pairs. Symmetric — ``(a, b)`` matches whether
# ``a`` sits in fragment_1 and ``b`` in fragment_2 or vice versa. Mixed
# DE/EN is intentional since both LLM-authored branches emit their
# own vocabulary and fragments may cross language within a constellation.
_CONTRADICTION_PAIRS: tuple[tuple[str, str], ...] = (
    ("victory", "defeat"),
    ("sieg", "niederlage"),
    ("hesitation", "decisiveness"),
    ("zoegern", "entschlossenheit"),
    ("mercy", "cruelty"),
    ("gnade", "grausamkeit"),
    ("hope", "despair"),
    ("hoffnung", "verzweiflung"),
    # NOTE: the English light/shadow pair is omitted. "shadow" doubles
    # as the slug for The Shadow archetype (see ARCHETYPE_TAGS), so
    # admitting it here collides with rule 1 and silently masks every
    # legitimate archetype match whose companion fragment carries
    # "light". The German pair ``(licht, schatten)`` stays because
    # "schatten" is never an archetype slug.
    ("licht", "schatten"),
    ("silence", "voice"),
    ("stille", "stimme"),
    ("retreat", "advance"),
    ("rueckzug", "vorstoss"),
    ("order", "chaos"),
    ("ordnung", "chaos"),
)

_TEMPORAL_WINDOW = timedelta(hours=72)
_EMOTIONAL_MIN_OVERLAP = 2

# Priority assigned per resonance type for the "which match wins"
# decision. Higher wins. Mapping sits at module level so callers can
# introspect the ordering without reimplementing it.
_PRIORITY: dict[ResonanceType, int] = {
    ResonanceType.CONTRADICTION: 3,
    ResonanceType.ARCHETYPE: 2,
    ResonanceType.EMOTIONAL: 1,
    ResonanceType.TEMPORAL: 0,
}


@dataclass(frozen=True)
class ResonanceMatch:
    """A detected resonance.

    ``evidence_tags`` is the concrete vocabulary that triggered the
    match. The UI uses it to label connection lines ("both carry
    grief"); the Insight-generation LLM prompt uses it to keep the
    output specific rather than generic.
    """

    resonance_type: ResonanceType
    evidence_tags: tuple[str, ...]


def _normalize_tags(fragment: FragmentResponse) -> frozenset[str]:
    return frozenset(t.lower() for t in fragment.thematic_tags if isinstance(t, str) and t)


def detect_pair(a: FragmentResponse, b: FragmentResponse) -> ResonanceMatch | None:
    """Return the highest-priority resonance between two fragments, or None."""
    a_tags = _normalize_tags(a)
    b_tags = _normalize_tags(b)
    if not a_tags or not b_tags:
        return None

    # Contradiction — cross-fragment antonym.
    for left, right in _CONTRADICTION_PAIRS:
        if (left in a_tags and right in b_tags) or (right in a_tags and left in b_tags):
            return ResonanceMatch(
                resonance_type=ResonanceType.CONTRADICTION,
                evidence_tags=(left, right),
            )

    # Archetype — same archetype slug on both.
    shared_archetypes = (a_tags & b_tags) & ARCHETYPE_TAGS
    if shared_archetypes:
        return ResonanceMatch(
            resonance_type=ResonanceType.ARCHETYPE,
            evidence_tags=tuple(sorted(shared_archetypes)),
        )

    # Emotional — overlap ≥ 2 within the valence vocabulary.
    shared_valence = (a_tags & b_tags) & VALENCE_TAGS
    if len(shared_valence) >= _EMOTIONAL_MIN_OVERLAP:
        return ResonanceMatch(
            resonance_type=ResonanceType.EMOTIONAL,
            evidence_tags=tuple(sorted(shared_valence)),
        )

    # Temporal — within 72h AND share ≥ 1 tag that isn't already
    # covered by the valence / archetype rules (those rules fell
    # through, so any shared tag here is truly "other").
    if abs((a.created_at - b.created_at).total_seconds()) <= _TEMPORAL_WINDOW.total_seconds():
        shared_other = (a_tags & b_tags) - VALENCE_TAGS - ARCHETYPE_TAGS
        if shared_other:
            return ResonanceMatch(
                resonance_type=ResonanceType.TEMPORAL,
                evidence_tags=tuple(sorted(shared_other)),
            )

    return None


def _iter_pair_matches(
    fragments: Sequence[FragmentResponse],
) -> Iterator[tuple[int, int, ResonanceMatch]]:
    """Yield ``(i, j, match)`` for every matching pair in upper-
    triangle (``i < j``) order.

    Shared helper for ``detect_all_pairs`` (needs the full list) and
    ``detect_constellation`` (aggregates into one winner). Keeps the
    O(n²) loop + priority rules in one place.
    """
    if len(fragments) < 2:
        return
    for i in range(len(fragments)):
        for j in range(i + 1, len(fragments)):
            match = detect_pair(fragments[i], fragments[j])
            if match is not None:
                yield i, j, match


def detect_all_pairs(
    fragments: Sequence[FragmentResponse],
) -> list[ResonancePair]:
    """Return every pair-level resonance match in the composition.

    Unlike ``detect_constellation`` (which picks the one aggregate
    winner), this returns one entry per matching unordered pair so the
    UI can draw a connection line between each resonant pair. Each
    pair is emitted exactly once — index ``i<j`` indexing avoids both
    duplicates and self-pairs.

    Pure function; no DB access. O(n²) bounded by the AD-3 cap of 12
    fragments = 66 comparisons worst case.
    """
    return [
        ResonancePair(
            fragment_a_id=fragments[i].id,
            fragment_b_id=fragments[j].id,
            resonance_type=str(match.resonance_type),
            evidence_tags=list(match.evidence_tags),
        )
        for i, j, match in _iter_pair_matches(fragments)
    ]


def detect_constellation(
    fragments: Sequence[FragmentResponse],
) -> ResonanceMatch | None:
    """Determine the dominant resonance for a composed constellation.

    Considers every pair (O(n²), bounded by the 12-fragment AD-3 cap).
    The highest-priority resonance type any pair produced wins;
    ``evidence_tags`` aggregates the vocabulary across all qualifying
    pairs of that type, deduplicated + sorted.

    Returns ``None`` for a solo or empty constellation, or when no
    pair matched any rule.
    """
    best_type: ResonanceType | None = None
    best_priority = -1
    accumulated: set[str] = set()

    for _i, _j, match in _iter_pair_matches(fragments):
        pri = _PRIORITY[match.resonance_type]
        if pri > best_priority:
            best_priority = pri
            best_type = match.resonance_type
            accumulated = set(match.evidence_tags)
        elif pri == best_priority and match.resonance_type == best_type:
            accumulated.update(match.evidence_tags)

    if best_type is None:
        return None
    return ResonanceMatch(
        resonance_type=best_type,
        evidence_tags=tuple(sorted(accumulated)),
    )
