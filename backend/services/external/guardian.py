"""Async Guardian News API client."""

from __future__ import annotations

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

GUARDIAN_BASE_URL = "https://content.guardianapis.com"
TIMEOUT_SECONDS = 15


class GuardianError(Exception):
    """Error from Guardian API."""


class GuardianService:
    """Async client for The Guardian Open Platform API."""

    def __init__(self, api_key: str):
        self.api_key = api_key

    async def browse(
        self,
        *,
        section: str | None = None,
        limit: int = 15,
    ) -> list[dict[str, Any]]:
        """Browse newest Guardian articles without a search query."""
        params: dict[str, Any] = {
            "api-key": self.api_key,
            "page-size": min(limit, 50),
            "show-fields": "headline,trailText,standfirst,byline,thumbnail",
            "order-by": "newest",
        }
        if section:
            params["section"] = section

        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
            resp = await client.get(f"{GUARDIAN_BASE_URL}/search", params=params)

            if resp.status_code == 429:
                raise GuardianError("Guardian API rate limit exceeded.")
            if resp.status_code != 200:
                raise GuardianError(
                    f"Guardian API error {resp.status_code}: {resp.text[:200]}"
                )

            data = resp.json()

        results = data.get("response", {}).get("results", [])
        return [self._normalize(r) for r in results]

    async def search(
        self,
        query: str,
        *,
        section: str | None = None,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """Search Guardian articles and return normalized trend data."""
        params: dict[str, Any] = {
            "api-key": self.api_key,
            "q": query,
            "page-size": min(limit, 50),
            "show-fields": "headline,trailText,standfirst,byline,thumbnail",
            "order-by": "relevance",
        }
        if section:
            params["section"] = section

        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
            resp = await client.get(f"{GUARDIAN_BASE_URL}/search", params=params)

            if resp.status_code == 429:
                raise GuardianError("Guardian API rate limit exceeded.")
            if resp.status_code != 200:
                raise GuardianError(
                    f"Guardian API error {resp.status_code}: {resp.text[:200]}"
                )

            data = resp.json()

        results = data.get("response", {}).get("results", [])
        return [self._normalize(r) for r in results]

    @staticmethod
    def _normalize(article: dict[str, Any]) -> dict[str, Any]:
        """Convert Guardian article to normalized article format."""
        fields = article.get("fields", {})
        return {
            "name": fields.get("headline", article.get("webTitle", "")),
            "platform": "guardian",
            "url": article.get("webUrl"),
            "raw_data": {
                "id": article.get("id"),
                "section": article.get("sectionId"),
                "byline": fields.get("byline"),
                "trail_text": fields.get("trailText"),
                "standfirst": fields.get("standfirst"),
                "thumbnail": fields.get("thumbnail"),
                "publication_date": article.get("webPublicationDate"),
            },
        }
