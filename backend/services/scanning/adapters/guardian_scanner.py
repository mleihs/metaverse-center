"""Guardian News scanner adapter — UNSTRUCTURED (wraps existing GuardianService)."""

from __future__ import annotations

import logging
from datetime import datetime

import httpx

from backend.services.external.guardian import GuardianService
from backend.services.scanning.base_adapter import ScanResult, SourceAdapter
from backend.services.scanning.registry import register_adapter

logger = logging.getLogger(__name__)

# Sections to scan for world events
_SECTIONS = ["world", "environment", "science", "technology", "business"]


@register_adapter
class GuardianScannerAdapter(SourceAdapter):
    name = "guardian"
    display_name = "The Guardian"
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
    api_key_setting = "guardian_api_key"
    default_interval = 21600  # 6 hours

    async def fetch(self, since: datetime | None = None) -> list[ScanResult]:
        if not self._api_key:
            return []

        service = GuardianService(api_key=self._api_key)
        results: list[ScanResult] = []
        seen_urls: set[str] = set()

        for section in _SECTIONS:
            try:
                articles = await service.browse(section=section, limit=10)
                for article in articles:
                    url = article.get("url", "")
                    if url in seen_urls:
                        continue
                    seen_urls.add(url)

                    raw = article.get("raw_data", {})
                    guardian_id = raw.get("id", url)

                    results.append(
                        ScanResult(
                            source_id=f"guardian_{guardian_id}",
                            source_name=self.name,
                            title=article.get("name", ""),
                            url=url,
                            description=raw.get("trail_text") or raw.get("standfirst"),
                            raw_data=raw,
                            source_category=None,  # LLM classifies
                            magnitude=None,
                            is_structured=False,
                        )
                    )
            except (httpx.HTTPError, KeyError, TypeError, ValueError):
                logger.warning("Guardian section %s fetch failed", section, exc_info=True)

        return results
