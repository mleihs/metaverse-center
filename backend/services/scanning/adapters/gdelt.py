"""GDELT DOC 2.0 API adapter — UNSTRUCTURED (full LLM classification)."""

from __future__ import annotations

import logging
from datetime import datetime

import httpx

from backend.services.scanning.base_adapter import ScanResult, SourceAdapter
from backend.services.scanning.registry import register_adapter

logger = logging.getLogger(__name__)

GDELT_API_URL = "https://api.gdeltproject.org/api/v2/doc/doc"
TIMEOUT = 20

# Category-specific keyword queries
GDELT_CATEGORY_QUERIES = {
    "economic_crisis": '"financial crisis" OR "market crash" OR "bank collapse" OR "currency crisis" OR recession',
    "military_conflict": '"armed conflict" OR "military operation" OR invasion OR "territorial dispute" OR airstrike',
    "pandemic": 'pandemic OR epidemic OR outbreak OR "public health emergency"',
    "natural_disaster": 'earthquake OR tsunami OR hurricane OR "volcanic eruption" OR flood',
    "political_upheaval": 'revolution OR coup OR "mass protest" OR "regime change" OR uprising',
    "tech_breakthrough": '"artificial intelligence" OR "quantum computing" OR "space launch" OR "scientific breakthrough"',
    "cultural_shift": '"social movement" OR "civil rights" OR "cultural revolution" OR "generational change"',
    "environmental_disaster": '"oil spill" OR deforestation OR "extinction event" OR "climate tipping point" OR "pollution crisis"',
}


@register_adapter
class GDELTAdapter(SourceAdapter):
    name = "gdelt"
    display_name = "GDELT Project"
    categories = [
        "economic_crisis", "military_conflict", "pandemic",
        "natural_disaster", "political_upheaval", "tech_breakthrough",
        "cultural_shift", "environmental_disaster",
    ]
    is_structured = False
    requires_api_key = False
    default_interval = 21600  # 6 hours

    async def fetch(self, since: datetime | None = None) -> list[ScanResult]:
        results: list[ScanResult] = []
        seen_urls: set[str] = set()

        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            for _category, query in GDELT_CATEGORY_QUERIES.items():
                try:
                    params = {
                        "query": query,
                        "mode": "artlist",
                        "format": "json",
                        "maxrecords": "10",
                        "timespan": "6h",
                        "sort": "datedesc",
                    }
                    resp = await client.get(GDELT_API_URL, params=params)
                    if resp.status_code != 200:
                        continue

                    data = resp.json()
                    articles = data.get("articles", [])

                    for article in articles:
                        url = article.get("url", "")
                        if url in seen_urls:
                            continue
                        seen_urls.add(url)

                        title = article.get("title", "")
                        if not title:
                            continue

                        results.append(ScanResult(
                            source_id=f"gdelt_{url}",
                            source_name=self.name,
                            title=title,
                            url=url,
                            description=None,  # GDELT artlist doesn't include descriptions
                            raw_data={
                                "domain": article.get("domain"),
                                "language": article.get("language"),
                                "seendate": article.get("seendate"),
                                "socialimage": article.get("socialimage"),
                            },
                            source_category=None,  # LLM classifies
                            magnitude=None,
                            is_structured=False,
                        ))
                except Exception:
                    logger.warning("GDELT query failed for category", exc_info=True)

        return results
