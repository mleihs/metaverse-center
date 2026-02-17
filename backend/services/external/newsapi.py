"""Async NewsAPI client."""

from __future__ import annotations

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

NEWSAPI_BASE_URL = "https://newsapi.org/v2"
TIMEOUT_SECONDS = 15


class NewsAPIError(Exception):
    """Error from NewsAPI."""


class NewsAPIService:
    """Async client for NewsAPI.org."""

    def __init__(self, api_key: str):
        self.api_key = api_key

    async def browse(
        self,
        *,
        country: str = "de",
        category: str | None = None,
        limit: int = 15,
    ) -> list[dict[str, Any]]:
        """Browse top headlines without a search query."""
        params: dict[str, Any] = {
            "apiKey": self.api_key,
            "country": country,
            "pageSize": min(limit, 100),
        }
        if category:
            params["category"] = category

        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
            resp = await client.get(f"{NEWSAPI_BASE_URL}/top-headlines", params=params)

            if resp.status_code == 429:
                raise NewsAPIError("NewsAPI rate limit exceeded.")
            if resp.status_code != 200:
                raise NewsAPIError(
                    f"NewsAPI error {resp.status_code}: {resp.text[:200]}"
                )

            data = resp.json()

        if data.get("status") != "ok":
            raise NewsAPIError(f"NewsAPI returned status: {data.get('status')}")

        articles = data.get("articles", [])
        return [self._normalize(a) for a in articles[:limit]]

    async def search(
        self,
        query: str,
        *,
        sources: str | None = None,
        language: str = "en",
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """Search NewsAPI and return normalized trend data."""
        params: dict[str, Any] = {
            "apiKey": self.api_key,
            "q": query,
            "pageSize": min(limit, 100),
            "language": language,
            "sortBy": "relevancy",
        }
        if sources:
            params["sources"] = sources

        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
            resp = await client.get(f"{NEWSAPI_BASE_URL}/everything", params=params)

            if resp.status_code == 429:
                raise NewsAPIError("NewsAPI rate limit exceeded.")
            if resp.status_code != 200:
                raise NewsAPIError(
                    f"NewsAPI error {resp.status_code}: {resp.text[:200]}"
                )

            data = resp.json()

        if data.get("status") != "ok":
            raise NewsAPIError(f"NewsAPI returned status: {data.get('status')}")

        articles = data.get("articles", [])
        return [self._normalize(a) for a in articles[:limit]]

    @staticmethod
    def _normalize(article: dict[str, Any]) -> dict[str, Any]:
        """Convert NewsAPI article to social_trends row format."""
        return {
            "name": article.get("title", ""),
            "platform": "newsapi",
            "url": article.get("url"),
            "raw_data": {
                "source": article.get("source", {}).get("name"),
                "author": article.get("author"),
                "description": article.get("description"),
                "published_at": article.get("publishedAt"),
                "image_url": article.get("urlToImage"),
            },
        }
