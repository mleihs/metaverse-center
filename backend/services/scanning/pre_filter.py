"""Pre-filter: keyword-based reject/boost for scan results (zero LLM cost)."""

from __future__ import annotations

import re

from backend.services.scanning.base_adapter import ScanResult

# Headlines containing these → REJECT before LLM (no cost)
REJECT_PATTERNS: set[str] = {
    "recipe", "cookbook", "celebrity", "gossip", "kardashian",
    "premier league", "champions league", "world cup qualifier",
    "box office", "movie review", "album review", "fashion week",
    "reality tv", "horoscope", "crossword", "lottery", "dating",
    "sports score", "transfer window", "fantasy football",
}

# Headlines containing these → KEEP (always pass to classifier)
BOOST_PATTERNS: set[str] = {
    "war", "conflict", "invasion", "ceasefire", "airstrike",
    "earthquake", "tsunami", "hurricane", "typhoon", "cyclone",
    "pandemic", "outbreak", "epidemic", "quarantine",
    "crash", "collapse", "crisis", "recession", "default",
    "revolution", "coup", "uprising", "martial law", "sanctions",
    "breakthrough", "discovery", "launch", "quantum", "fusion",
    "climate", "extinction", "deforestation", "oil spill",
    "flood", "wildfire", "famine", "drought", "volcano",
}

# Pre-compiled regex for efficiency
_REJECT_RE = re.compile(
    "|".join(re.escape(p) for p in REJECT_PATTERNS),
    re.IGNORECASE,
)
_BOOST_RE = re.compile(
    "|".join(re.escape(p) for p in BOOST_PATTERNS),
    re.IGNORECASE,
)


def pre_filter(results: list[ScanResult]) -> list[ScanResult]:
    """Filter scan results using keyword reject/boost.

    - Structured results always pass through (already classified).
    - Unstructured results: reject if title matches REJECT, keep if BOOST, otherwise keep.
    """
    filtered: list[ScanResult] = []
    for result in results:
        # Structured sources skip pre-filter — they're already classified
        if result.is_structured:
            filtered.append(result)
            continue

        title_lower = result.title.lower()

        # Reject if matches reject patterns
        if _REJECT_RE.search(title_lower):
            continue

        # Keep everything else (boost patterns just confirm importance)
        filtered.append(result)

    return filtered
