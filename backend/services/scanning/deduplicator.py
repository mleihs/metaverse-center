"""Deduplication logic for scan results against existing log and resonances."""

from __future__ import annotations

import logging
import re
from datetime import UTC, datetime, timedelta

import httpx
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.services.scanning.base_adapter import ScanResult
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


def deduplicate_within_batch(results: list[ScanResult]) -> list[ScanResult]:
    """Remove near-duplicate titles within a single batch.

    Keeps the highest-magnitude result when titles are >70% similar.
    This prevents e.g. 10 "High Wind Warning NWS Billings MT" entries.
    """
    if not results:
        return []

    kept: list[ScanResult] = []
    for result in results:
        is_dup = False
        for i, existing in enumerate(kept):
            if existing.source_name != result.source_name:
                continue
            if _title_similarity(result.title, existing.title) > _SIMILARITY_THRESHOLD:
                # Keep the one with higher magnitude
                if (result.magnitude or 0) > (existing.magnitude or 0):
                    kept[i] = result
                is_dup = True
                break
        if not is_dup:
            kept.append(result)

    removed = len(results) - len(kept)
    if removed:
        logger.info("Intra-batch dedup: removed %d/%d near-duplicate titles", removed, len(results))
    return kept


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
            for row in resp.data or []:
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
            recent_titles[cat] = [r["title"] for r in resp.data or []]
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
        count = len(resp.data or [])
        if count:
            logger.info("Cleaned up %d old scan log entries", count)
        return count
    except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError):
        logger.exception("Failed to clean up old scan logs")
        return 0
