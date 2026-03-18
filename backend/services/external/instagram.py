"""Async Instagram Graph API client for content publishing.

Follows the same httpx pattern as facebook.py and guardian.py.
Implements the two-step container publishing flow:
  1. Create container (POST /{IG_ID}/media)
  2. Poll container status (GET /{container_id}?fields=status_code)
  3. Publish container (POST /{IG_ID}/media_publish)
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

TIMEOUT_SECONDS = 30
CONTAINER_POLL_INTERVAL = 60  # seconds between status checks
CONTAINER_POLL_MAX_WAIT = 300  # 5 minutes max wait for container processing


class InstagramAPIError(Exception):
    """Error from Instagram Graph API."""

    def __init__(self, message: str, code: int | None = None, subcode: int | None = None):
        super().__init__(message)
        self.code = code
        self.subcode = subcode


class InstagramRateLimitError(InstagramAPIError):
    """Rate limit exceeded (100 posts / 24h rolling window)."""


class InstagramTokenExpiredError(InstagramAPIError):
    """Access token has expired (error code 190)."""


class InstagramContainerError(InstagramAPIError):
    """Container creation or processing failed."""


class InstagramService:
    """Async client for Instagram Graph API content publishing."""

    def __init__(self, access_token: str, ig_user_id: str, api_version: str = "v22.0"):
        self.access_token = access_token
        self.ig_user_id = ig_user_id
        self.base_url = f"https://graph.facebook.com/{api_version}"

    # ── Container Creation ──────────────────────────────────────────────

    async def create_image_container(
        self,
        image_url: str,
        caption: str,
        *,
        alt_text: str | None = None,
    ) -> str:
        """Create a single-image container. Returns container ID."""
        params: dict[str, Any] = {
            "access_token": self.access_token,
            "image_url": image_url,
            "caption": caption,
        }
        if alt_text:
            params["alt_text"] = alt_text

        data = await self._post(f"{self.ig_user_id}/media", params)
        container_id = data.get("id")
        if not container_id:
            raise InstagramContainerError("No container ID in response")
        logger.info("Created image container %s", container_id)
        return container_id

    async def create_carousel_item_container(
        self,
        image_url: str,
        *,
        is_carousel_item: bool = True,
        alt_text: str | None = None,
    ) -> str:
        """Create a child container for a carousel. Returns container ID."""
        params: dict[str, Any] = {
            "access_token": self.access_token,
            "image_url": image_url,
            "is_carousel_item": str(is_carousel_item).lower(),
        }
        if alt_text:
            params["alt_text"] = alt_text

        data = await self._post(f"{self.ig_user_id}/media", params)
        container_id = data.get("id")
        if not container_id:
            raise InstagramContainerError("No carousel item container ID in response")
        logger.info("Created carousel item container %s", container_id)
        return container_id

    async def create_carousel_container(
        self,
        children_ids: list[str],
        caption: str,
    ) -> str:
        """Create a carousel parent container. Returns container ID."""
        params: dict[str, Any] = {
            "access_token": self.access_token,
            "media_type": "CAROUSEL",
            "children": ",".join(children_ids),
            "caption": caption,
        }

        data = await self._post(f"{self.ig_user_id}/media", params)
        container_id = data.get("id")
        if not container_id:
            raise InstagramContainerError("No carousel container ID in response")
        logger.info("Created carousel container %s with %d children", container_id, len(children_ids))
        return container_id

    async def create_story_container(
        self,
        image_url: str,
    ) -> str:
        """Create a Stories container. Returns container ID."""
        params: dict[str, Any] = {
            "access_token": self.access_token,
            "image_url": image_url,
            "media_type": "STORIES",
        }

        data = await self._post(f"{self.ig_user_id}/media", params)
        container_id = data.get("id")
        if not container_id:
            raise InstagramContainerError("No story container ID in response")
        logger.info("Created story container %s", container_id)
        return container_id

    # ── Container Status ────────────────────────────────────────────────

    async def check_container_status(self, container_id: str) -> str:
        """Check container processing status. Returns status_code string.

        Possible values: IN_PROGRESS, FINISHED, ERROR, EXPIRED.
        """
        params = {
            "access_token": self.access_token,
            "fields": "status_code,status",
        }
        data = await self._get(container_id, params)
        return data.get("status_code", "UNKNOWN")

    async def wait_for_container(self, container_id: str) -> str:
        """Poll container status until FINISHED or error. Returns final status."""
        elapsed = 0
        while elapsed < CONTAINER_POLL_MAX_WAIT:
            status_code = await self.check_container_status(container_id)
            logger.debug("Container %s status: %s (elapsed: %ds)", container_id, status_code, elapsed)

            if status_code == "FINISHED":
                return status_code
            if status_code in ("ERROR", "EXPIRED"):
                raise InstagramContainerError(
                    f"Container {container_id} failed with status: {status_code}",
                )

            await asyncio.sleep(CONTAINER_POLL_INTERVAL)
            elapsed += CONTAINER_POLL_INTERVAL

        raise InstagramContainerError(
            f"Container {container_id} timed out after {CONTAINER_POLL_MAX_WAIT}s",
        )

    # ── Publishing ──────────────────────────────────────────────────────

    async def publish_container(self, container_id: str) -> dict[str, Any]:
        """Publish a FINISHED container. Returns {id: media_id}."""
        params = {
            "access_token": self.access_token,
            "creation_id": container_id,
        }
        data = await self._post(f"{self.ig_user_id}/media_publish", params)
        media_id = data.get("id")
        if not media_id:
            raise InstagramContainerError("No media ID in publish response")
        logger.info("Published container %s → media %s", container_id, media_id)
        return data

    async def publish_image(
        self,
        image_url: str,
        caption: str,
        *,
        alt_text: str | None = None,
    ) -> dict[str, Any]:
        """End-to-end: create container → wait → publish. Returns published media data."""
        container_id = await self.create_image_container(
            image_url, caption, alt_text=alt_text,
        )
        await self.wait_for_container(container_id)
        return await self.publish_container(container_id)

    async def publish_carousel(
        self,
        image_urls: list[str],
        caption: str,
        *,
        alt_texts: list[str | None] | None = None,
    ) -> dict[str, Any]:
        """End-to-end carousel: create children → create parent → wait → publish."""
        alt_texts = alt_texts or [None] * len(image_urls)

        # Create child containers
        child_ids = []
        for url, alt in zip(image_urls, alt_texts, strict=True):
            child_id = await self.create_carousel_item_container(url, alt_text=alt)
            child_ids.append(child_id)

        # Create carousel parent
        container_id = await self.create_carousel_container(child_ids, caption)
        await self.wait_for_container(container_id)
        return await self.publish_container(container_id)

    async def publish_story(self, image_url: str) -> dict[str, Any]:
        """End-to-end story: create → wait → publish."""
        container_id = await self.create_story_container(image_url)
        await self.wait_for_container(container_id)
        return await self.publish_container(container_id)

    # ── Insights ────────────────────────────────────────────────────────

    async def get_media_insights(self, media_id: str) -> dict[str, Any]:
        """Fetch engagement metrics for a published media item."""
        params = {
            "access_token": self.access_token,
            "metric": "impressions,reach,likes,comments,saved,shares",
        }
        data = await self._get(f"{media_id}/insights", params)

        # Normalize insights array into a flat dict
        metrics: dict[str, int] = {}
        for item in data.get("data", []):
            name = item.get("name", "")
            values = item.get("values", [{}])
            metrics[name] = values[0].get("value", 0) if values else 0

        return metrics

    async def get_media_permalink(self, media_id: str) -> str | None:
        """Get the permanent link for a published media item."""
        params = {
            "access_token": self.access_token,
            "fields": "permalink",
        }
        data = await self._get(media_id, params)
        return data.get("permalink")

    # ── Rate Limit ──────────────────────────────────────────────────────

    async def check_rate_limit(self) -> dict[str, Any]:
        """Check current content publishing rate limit usage.

        Returns: {config: {quota_total: 100}, quota_usage: N}
        """
        params = {
            "access_token": self.access_token,
            "fields": "config,quota_usage",
        }
        data = await self._get(f"{self.ig_user_id}/content_publishing_limit", params)

        # Parse the nested response
        result_data = data.get("data", [{}])
        if result_data:
            entry = result_data[0]
            config = entry.get("config", {})
            return {
                "quota_usage": entry.get("quota_usage", 0),
                "quota_total": config.get("quota_total", 100),
                "remaining": config.get("quota_total", 100) - entry.get("quota_usage", 0),
            }
        return {"quota_usage": 0, "quota_total": 100, "remaining": 100}

    # ── Token Exchange ──────────────────────────────────────────────────

    @staticmethod
    async def exchange_for_long_lived_token(
        short_lived_token: str,
        app_id: str,
        app_secret: str,
    ) -> dict[str, Any]:
        """Exchange a short-lived token for a long-lived token (60 days)."""
        params = {
            "grant_type": "fb_exchange_token",
            "client_id": app_id,
            "client_secret": app_secret,
            "fb_exchange_token": short_lived_token,
        }
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
            resp = await client.get(
                "https://graph.facebook.com/v22.0/oauth/access_token",
                params=params,
            )
            InstagramService._check_response(resp)
            return resp.json()

    @staticmethod
    async def get_page_token_and_ig_id(
        long_lived_token: str,
    ) -> dict[str, str]:
        """Get page access token and linked Instagram Business Account ID.

        Returns: {page_token: str, ig_user_id: str, page_name: str}
        """
        # Get pages
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
            resp = await client.get(
                "https://graph.facebook.com/v22.0/me/accounts",
                params={
                    "access_token": long_lived_token,
                    "fields": "id,name,access_token,instagram_business_account",
                },
            )
            InstagramService._check_response(resp)
            pages = resp.json().get("data", [])

        if not pages:
            raise InstagramAPIError("No pages found for this token")

        # Find first page with an Instagram business account
        for page in pages:
            ig_account = page.get("instagram_business_account", {})
            ig_id = ig_account.get("id")
            if ig_id:
                return {
                    "page_token": page["access_token"],
                    "ig_user_id": ig_id,
                    "page_name": page.get("name", ""),
                }

        raise InstagramAPIError(
            "No Instagram Business Account linked to any page. "
            "Link an Instagram Business Account to your Facebook Page first.",
        )

    # ── Internal HTTP Helpers ───────────────────────────────────────────

    async def _get(self, endpoint: str, params: dict[str, Any]) -> dict[str, Any]:
        """GET request to Graph API."""
        url = f"{self.base_url}/{endpoint}"
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
            resp = await client.get(url, params=params)
            self._check_response(resp)
            return resp.json()

    async def _post(self, endpoint: str, params: dict[str, Any]) -> dict[str, Any]:
        """POST request to Graph API."""
        url = f"{self.base_url}/{endpoint}"
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
            resp = await client.post(url, data=params)
            self._check_response(resp)
            return resp.json()

    @staticmethod
    def _check_response(resp: httpx.Response) -> None:
        """Check Graph API response for errors and raise typed exceptions."""
        if resp.status_code == 200:
            return

        try:
            body = resp.json()
        except Exception as exc:
            raise InstagramAPIError(
                f"Instagram API error {resp.status_code}: {resp.text[:300]}",
            ) from exc

        error = body.get("error", {})
        code = error.get("code")
        subcode = error.get("error_subcode")
        message = error.get("message", resp.text[:300])

        # Token expired
        if code == 190:
            raise InstagramTokenExpiredError(
                f"Access token expired: {message}", code=code, subcode=subcode,
            )

        # Rate limited
        if code == 4 or resp.status_code == 429:
            raise InstagramRateLimitError(
                f"Rate limit exceeded: {message}", code=code, subcode=subcode,
            )

        # Temporarily blocked (spam detection)
        if code == 368:
            raise InstagramRateLimitError(
                f"Temporarily blocked by Instagram: {message}", code=code, subcode=subcode,
            )

        raise InstagramAPIError(
            f"Instagram API error (code={code}): {message}",
            code=code,
            subcode=subcode,
        )
