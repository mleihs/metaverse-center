"""Hacker News scanner adapter — SEMI-STRUCTURED (score-based filtering, LLM for category)."""

from __future__ import annotations

import logging
from datetime import datetime

import httpx

from backend.services.scanning.base_adapter import ScanResult, SourceAdapter
from backend.services.scanning.registry import register_adapter

logger = logging.getLogger(__name__)

HN_BASE = "https://hacker-news.firebaseio.com/v0"
TIMEOUT = 15
MIN_SCORE = 200
MAX_ITEMS = 30  # Check top 30 stories


@register_adapter
class HackerNewsScannerAdapter(SourceAdapter):
    name = "hackernews"
    display_name = "Hacker News"
    categories = ["tech_breakthrough"]
    is_structured = False  # Score helps, but category needs LLM
    requires_api_key = False
    default_interval = 1800  # 30 minutes

    async def fetch(self, since: datetime | None = None) -> list[ScanResult]:
        results: list[ScanResult] = []

        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            # Get top story IDs
            resp = await client.get(f"{HN_BASE}/topstories.json")
            if resp.status_code != 200:
                logger.warning("HN topstories returned %d", resp.status_code)
                return []

            story_ids = resp.json()[:MAX_ITEMS]

            # Fetch individual stories
            for story_id in story_ids:
                try:
                    item_resp = await client.get(f"{HN_BASE}/item/{story_id}.json")
                    if item_resp.status_code != 200:
                        continue

                    item = item_resp.json()
                    if not item or item.get("type") != "story":
                        continue

                    score = item.get("score", 0)
                    if score < MIN_SCORE:
                        continue

                    title = item.get("title", "")
                    if not title:
                        continue

                    url = item.get("url", f"https://news.ycombinator.com/item?id={story_id}")

                    results.append(ScanResult(
                        source_id=f"hn_{story_id}",
                        source_name=self.name,
                        title=title,
                        url=url,
                        description=f"HN score: {score}, comments: {item.get('descendants', 0)}",
                        raw_data={
                            "id": story_id,
                            "score": score,
                            "descendants": item.get("descendants", 0),
                            "time": item.get("time"),
                            "by": item.get("by"),
                        },
                        source_category=None,  # LLM classifies
                        magnitude=None,
                        is_structured=False,
                    ))
                except (httpx.HTTPError, KeyError, TypeError, ValueError):
                    logger.debug("Failed to fetch HN item %d", story_id)

        return results
