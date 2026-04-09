"""Async Facebook Graph API client."""

from __future__ import annotations

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

TIMEOUT_SECONDS = 20


class FacebookError(Exception):
    """Error from Facebook Graph API."""


class FacebookService:
    """Async client for Facebook Graph API."""

    def __init__(self, access_token: str, api_version: str = "v23.0"):
        self.access_token = access_token
        self.base_url = f"https://graph.facebook.com/{api_version}"

    async def get_page_feed(
        self,
        page_id: str,
        *,
        limit: int = 25,
    ) -> list[dict[str, Any]]:
        """Fetch posts from a Facebook page feed."""
        params = {
            "access_token": self.access_token,
            "fields": "id,message,created_time,from,attachments,reactions.summary(true)",
            "limit": min(limit, 100),
        }

        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
            resp = await client.get(
                f"{self.base_url}/{page_id}/feed",
                params=params,
            )
            self._check_response(resp)
            data = resp.json()

        return [self._normalize_post(p, page_id) for p in data.get("data", [])]

    async def get_post_comments(
        self,
        post_id: str,
        *,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """Fetch comments for a post."""
        params = {
            "access_token": self.access_token,
            "fields": "id,message,created_time,from",
            "limit": min(limit, 100),
        }

        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
            resp = await client.get(
                f"{self.base_url}/{post_id}/comments",
                params=params,
            )
            self._check_response(resp)
            data = resp.json()

        return [self._normalize_comment(c) for c in data.get("data", [])]

    def _check_response(self, resp: httpx.Response) -> None:
        """Check Facebook API response for errors."""
        if resp.status_code == 400:
            error = resp.json().get("error", {})
            raise FacebookError(f"Facebook API error: {error.get('message', resp.text[:200])}")
        if resp.status_code != 200:
            raise FacebookError(f"Facebook API error {resp.status_code}: {resp.text[:200]}")

    @staticmethod
    def _normalize_post(post: dict[str, Any], page_id: str) -> dict[str, Any]:
        """Convert Facebook post to social_media_posts row format."""
        from_data = post.get("from", {})
        attachments = post.get("attachments", {}).get("data", [])
        reactions = post.get("reactions", {}).get("summary", {})

        return {
            "platform": "facebook",
            "platform_id": post.get("id", ""),
            "page_id": page_id,
            "author": from_data.get("name"),
            "message": post.get("message"),
            "source_created_at": post.get("created_time"),
            "attachments": attachments,
            "reactions": {"total_count": reactions.get("total_count", 0)},
        }

    @staticmethod
    def _normalize_comment(comment: dict[str, Any]) -> dict[str, Any]:
        """Convert Facebook comment to social_media_comments row format."""
        from_data = comment.get("from", {})

        return {
            "platform_id": comment.get("id", ""),
            "author": from_data.get("name", ""),
            "message": comment.get("message", ""),
            "source_created_at": comment.get("created_time"),
        }
