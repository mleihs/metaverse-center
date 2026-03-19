"""Shared abstractions for multi-channel social publishing.

All social platform API clients implement the SocialPlatformClient protocol.
This keeps platform-specific code isolated behind a common interface and
makes adding new platforms (TikTok, etc.) trivial.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol, runtime_checkable


@dataclass(frozen=True)
class PublishResult:
    """Returned by every platform after a successful publish."""

    platform: str  # "instagram" | "bluesky"
    platform_post_id: str  # ig_media_id or at-uri
    permalink: str | None = None
    cid: str | None = None  # Content hash (Bluesky CID)


@dataclass(frozen=True)
class UploadedMedia:
    """Platform-specific media reference (blob ref, URL, etc.)."""

    ref: dict  # platform-specific (blob ref for Bluesky, URL for Instagram)
    mime_type: str = "image/jpeg"
    size_bytes: int = 0


@dataclass
class AdaptedContent:
    """Platform-adapted content ready to publish."""

    caption: str
    hashtags: list[str] = field(default_factory=list)
    alt_text: str | None = None
    facets: list[dict] | None = None  # Bluesky rich text facets (byte offsets)
    link_url: str | None = None  # Appended link (Bluesky short captions)


@runtime_checkable
class SocialPlatformClient(Protocol):
    """Every social platform API client implements this."""

    async def publish_post(
        self, content: AdaptedContent, media: list[UploadedMedia],
    ) -> PublishResult: ...

    async def upload_media(
        self, data: bytes, mime_type: str,
    ) -> UploadedMedia: ...

    async def get_post_metrics(
        self, platform_post_id: str,
    ) -> dict: ...

    async def validate_credentials(self) -> bool: ...
