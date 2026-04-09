"""NewsAPI scanner adapter — UNSTRUCTURED (wraps existing NewsAPIService)."""

from __future__ import annotations

import logging
from datetime import datetime

import httpx

from backend.services.external.newsapi import NewsAPIService
from backend.services.scanning.base_adapter import ScanResult, SourceAdapter
from backend.services.scanning.registry import register_adapter

logger = logging.getLogger(__name__)


@register_adapter
class NewsAPIScannerAdapter(SourceAdapter):
    name = "newsapi"
    display_name = "NewsAPI"
    categories = [
        "economic_crisis",
        "military_conflict",
        "pandemic",
        "natural_disaster",
        "political_upheaval",
        "tech_breakthrough",
        "cultural_shift",
        "environmental_disaster",
    ]
    is_structured = False
    requires_api_key = True
    api_key_setting = "newsapi_api_key"
    default_interval = 21600  # 6 hours

    async def fetch(self, since: datetime | None = None) -> list[ScanResult]:
        if not self._api_key:
            return []

        service = NewsAPIService(api_key=self._api_key)
        results: list[ScanResult] = []
        seen_urls: set[str] = set()

        # Browse top headlines from multiple countries
        for country in ("us", "gb", "de"):
            try:
                articles = await service.browse(country=country, limit=15)
                for article in articles:
                    url = article.get("url", "")
                    if url in seen_urls:
                        continue
                    seen_urls.add(url)

                    raw = article.get("raw_data", {})

                    results.append(
                        ScanResult(
                            source_id=f"newsapi_{url}",
                            source_name=self.name,
                            title=article.get("name", ""),
                            url=url,
                            description=raw.get("description"),
                            raw_data=raw,
                            source_category=None,  # LLM classifies
                            magnitude=None,
                            is_structured=False,
                        )
                    )
            except (httpx.HTTPError, KeyError, TypeError, ValueError):
                logger.warning("NewsAPI country=%s fetch failed", country, exc_info=True)

        return results
