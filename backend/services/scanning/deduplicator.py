"""Deduplication logic for scan results against existing log and resonances."""

from __future__ import annotations

import logging
import re
from datetime import UTC, datetime, timedelta

import httpx
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.services.scanning.base_adapter import ScanResult
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

# Title similarity threshold (intersection / union of keyword sets)
_SIMILARITY_THRESHOLD = 0.70

# Words to ignore in title similarity comparison
_STOP_WORDS = frozenset(
    {
        "the",
        "a",
        "an",
        "is",
        "in",
        "on",
        "at",
        "to",
        "of",
        "for",
        "and",
        "or",
        "but",
        "with",
        "from",
        "by",
        "as",
        "it",
        "its",
        "has",
        "have",
        "had",
        "are",
        "was",
        "were",
        "be",
        "been",
        "being",
        "this",
        "that",
        "these",
        "those",
        "will",
        "would",
        "could",
        "should",
        "may",
        "might",
        "can",
        "do",
        "does",
        "did",
        "not",
        "no",
        "so",
        "if",
        "then",
        "than",
        "more",
        "most",
        "very",
        "just",
        "also",
        "now",
        "new",
        "says",
        "said",
    }
)

_WORD_RE = re.compile(r"[a-z0-9]+")


def _title_keywords(title: str) -> set[str]:
    """Extract meaningful keywords from a title."""
    words = set(_WORD_RE.findall(title.lower()))
    return words - _STOP_WORDS


def _title_similarity(a: str, b: str) -> float:
    """Compute Jaccard similarity between two titles' keyword sets."""
    ka = _title_keywords(a)
    kb = _title_keywords(b)
    if not ka or not kb:
        return 0.0
    intersection = ka & kb
    union = ka | kb
    return len(intersection) / len(union)


def _social_volume_of(result: ScanResult) -> int:
    """Zustimmung im Netz aus einem Rohdatensatz, oder 0.

    Nur Bluesky fuehrt heute solche Zahlen (`likes`, `reposts`). Die Namen
    stehen in `adapters/bluesky_social.py`; wer eine zweite Sozialquelle
    anschliesst, ergaenzt sie HIER und nirgends sonst.
    """
    raw = result.raw_data or {}
    try:
        return int(raw.get("likes") or 0) + int(raw.get("reposts") or 0)
    except (TypeError, ValueError):
        return 0


def _carries_better(candidate: ScanResult, current: ScanResult) -> bool:
    """Darf `candidate` den bisherigen Traeger `current` abloesen?

    Die Reihenfolge ist bedeutungstragend und beantwortet drei Fragen in
    absteigender Wichtigkeit:

    1. **Ist es ueberhaupt eine eigene Zeile wert?** Eine belegende Quelle
       (Bluesky) loest NIE eine nicht-belegende ab. Das ist die Regel des
       Bauplans, hier durchgesetzt statt beschrieben.
    2. **Ist es gemessen oder erzaehlt?** Ein strukturiertes Signal (USGS, NOAA)
       traegt Zahlen und braucht kein Modell; es schlaegt eine Meldung.
    3. **Wie stark?** Erst danach entscheidet die Magnitude — und zum Zeitpunkt
       der Buendelung ist sie bei allem Unstrukturierten noch `None`, weil die
       Klassifikation SPAETER laeuft. Sie entscheidet also fast nur zwischen
       zwei Messdiensten.
    """
    if candidate.is_supporting != current.is_supporting:
        return current.is_supporting
    if candidate.is_structured != current.is_structured:
        return candidate.is_structured
    return (candidate.magnitude or 0) > (current.magnitude or 0)


def bundle_within_batch(results: list[ScanResult]) -> list[ScanResult]:
    """Aehnliche Titel zu EINER Geschichte buendeln, statt sie wegzuwerfen.

    ── WAS SICH GEAENDERT HAT UND WARUM ────────────────────────────────────────

    Diese Funktion hiess `deduplicate_within_batch` und tat zweierlei anders:

    1. Sie verglich **nur innerhalb derselben Quelle**
       (`if existing.source_name != result.source_name: continue`). Ein
       Guardian-Artikel und ein Bluesky-Beitrag ueber dasselbe Beben wurden
       deshalb NIE zusammengefuehrt — beide wurden eigene Kandidaten. Genau das
       verbietet der Bauplan: „eine Sozialquelle wird nie eine eigene Zeile".
    2. Sie WARF die Duplikate weg. Damit ging die Auskunft verloren, die den
       Wert einer Geschichte ausmacht: dass drei Quellen sie melden und
       zweihundert Menschen darauf reagiert haben.

    Jetzt wird ueber Quellgrenzen hinweg gebuendelt, der Traeger nach
    `_carries_better` bestimmt, und die uebrigen bleiben als `sources[]` und als
    aufsummiertes `social_volume` am Traeger haengen.

    🔑 Eine Entduplizierung, die wegwirft, verliert eine Aussage. Eine, die
    buendelt, gewinnt eine.
    """
    if not results:
        return []

    kept: list[ScanResult] = []
    for result in results:
        merged_into: ScanResult | None = None
        for i, existing in enumerate(kept):
            if _title_similarity(result.title, existing.title) <= _SIMILARITY_THRESHOLD:
                continue
            if _carries_better(result, existing):
                # Der neue traegt besser: er uebernimmt die Buendelung des alten.
                result.sources = existing.sources
                result.social_volume = existing.social_volume
                kept[i] = result
                # Der ALTE Traeger steht bereits in der geerbten Buendelung —
                # eingetragen wurde er, als er selbst angelegt wurde. Was fehlt,
                # ist der NEUE: er hat sich noch nie als Quelle registriert.
                #
                # ⚠ Hier stand zuerst `_add_source(result, existing)`, und das
                # war doppelt falsch: der alte wurde ein zweites Mal gezaehlt
                # und der neue gar nicht. Ein Test mit drei Quellen hat es
                # gefangen — mit zweien haette es plausibel ausgesehen.
                _add_source(result, result)
                merged_into = result
            else:
                _add_source(existing, result)
                merged_into = existing
            break

        if merged_into is None:
            _add_source(result, result)
            kept.append(result)

    bundled = len(results) - len(kept)
    if bundled:
        logger.info("Story bundling: %d of %d results folded into others", bundled, len(results))
    return kept


def _add_source(story: ScanResult, contributor: ScanResult) -> None:
    """Eine Quelle an eine Geschichte haengen — oder ihren Zaehler erhoehen.

    `count` ist die Zahl der BEITRAEGE dieser Quelle, nicht der Quellen: dass
    NOAA dieselbe Warnung dreimal absetzt, ist eine andere Auskunft als dass
    drei verschiedene Dienste sie melden.
    """
    for entry in story.sources:
        if entry.get("name") == contributor.source_name:
            entry["count"] = int(entry.get("count", 1)) + 1
            break
    else:
        story.sources.append({"name": contributor.source_name, "count": 1})
    story.social_volume += _social_volume_of(contributor)


#: Alter Name, damit ein Aufrufer ausserhalb dieses Moduls nicht bricht.
#: Er beschreibt aber nicht mehr, was passiert — deshalb ruft der Scanner den
#: neuen.
deduplicate_within_batch = bundle_within_batch


async def deduplicate(
    admin: Client,
    results: list[ScanResult],
) -> list[ScanResult]:
    """Remove results that already exist in news_scan_log.

    Returns only new (non-duplicate) results.
    """
    if not results:
        return []

    # Batch-check source_id existence
    source_ids = [(r.source_name, r.source_id) for r in results]
    existing: set[tuple[str, str]] = set()

    # Query in batches by source_name
    sources_by_name: dict[str, list[str]] = {}
    for name, sid in source_ids:
        sources_by_name.setdefault(name, []).append(sid)

    for source_name, ids in sources_by_name.items():
        try:
            resp = await (
                admin.table("news_scan_log")
                .select("source_name, source_id")
                .eq("source_name", source_name)
                .in_("source_id", ids)
                .execute()
            )
            for row in extract_list(resp):
                existing.add((row["source_name"], row["source_id"]))
        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
            logger.warning("Failed to check scan log for %s", source_name)

    novel = [r for r in results if (r.source_name, r.source_id) not in existing]
    if len(results) != len(novel):
        logger.info(
            "Dedup: %d/%d results already in scan log",
            len(results) - len(novel),
            len(results),
        )
    return novel


async def deduplicate_against_resonances(
    admin: Client,
    results: list[ScanResult],
) -> list[ScanResult]:
    """Remove results too similar to existing resonances from last 72h."""
    if not results:
        return []

    cutoff = (datetime.now(UTC) - timedelta(hours=72)).isoformat()
    novel: list[ScanResult] = []

    # Collect unique categories from results
    categories = {r.source_category for r in results if r.source_category}

    # Load recent resonance titles by category
    recent_titles: dict[str, list[str]] = {}
    for cat in categories:
        try:
            resp = await (
                admin.table("substrate_resonances")
                .select("title")
                .eq("source_category", cat)
                .gte("created_at", cutoff)
                .is_("deleted_at", "null")
                .execute()
            )
            recent_titles[cat] = [r["title"] for r in extract_list(resp)]
        except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
            logger.warning("Failed to load recent resonances for %s", cat)

    for result in results:
        cat = result.source_category
        if cat and cat in recent_titles:
            is_dup = any(
                _title_similarity(result.title, existing) > _SIMILARITY_THRESHOLD for existing in recent_titles[cat]
            )
            if is_dup:
                logger.debug("Title too similar to existing resonance: %s", result.title[:80])
                continue
        novel.append(result)

    return novel


async def log_results(admin: Client, results: list[ScanResult]) -> None:
    """Record scan results in news_scan_log for future deduplication."""
    if not results:
        return

    rows = [
        {
            "source_id": r.source_id,
            "source_name": r.source_name,
            "title": r.title,
            "url": r.url,
            "classified": r.source_category is not None,
            "source_category": r.source_category,
            "magnitude": float(r.magnitude) if r.magnitude is not None else None,
        }
        for r in results
    ]

    try:
        await (
            admin.table("news_scan_log")
            .upsert(
                rows,
                on_conflict="source_name,source_id",
            )
            .execute()
        )
    except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
        logger.exception("Failed to log %d scan results", len(rows))


async def cleanup_old_logs(admin: Client, days: int = 30) -> int:
    """Delete scan log entries older than N days. Returns count deleted."""
    cutoff = (datetime.now(UTC) - timedelta(days=days)).isoformat()
    try:
        resp = await admin.table("news_scan_log").delete().lt("scanned_at", cutoff).execute()
        count = len(extract_list(resp))
        if count:
            logger.info("Cleaned up %d old scan log entries", count)
        return count
    except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
        logger.exception("Failed to clean up old scan logs")
        return 0
