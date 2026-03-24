"""Async AT Protocol client for Bluesky social publishing.

Follows the same hardened httpx pattern as instagram.py, guardian.py, etc.
Implements SocialPlatformClient protocol.

AT Protocol publishing is synchronous (no container polling unlike Instagram):
  1. createSession / refreshSession — authentication
  2. uploadBlob — binary POST for images (< 1MB)
  3. createRecord — publish post (app.bsky.feed.post)
"""

from __future__ import annotations

import asyncio
import io
import logging
import re
import time
from dataclasses import dataclass
from datetime import UTC, datetime

import httpx
import sentry_sdk

from backend.services.social.types import AdaptedContent, PublishResult, UploadedMedia

logger = logging.getLogger(__name__)

# --- Defaults ---
TIMEOUT_API = 30.0
TIMEOUT_BLOB = 60.0
MAX_RETRIES = 3
BACKOFF_BASE = 1.0  # seconds — exponential: 1s, 2s, 4s
BLOB_MAX_BYTES = 1_000_000  # 1 MB Bluesky limit
BLOB_RECOMPRESS_THRESHOLD = 950_000  # Recompress JPEG if > 950 KB
GRAPHEME_LIMIT = 300


# ── Exception Hierarchy ───────────────────────────────────────────────


class BlueskyAPIError(Exception):
    """Error from Bluesky AT Protocol API."""

    def __init__(
        self,
        message: str,
        status_code: int | None = None,
        error_name: str | None = None,
    ):
        super().__init__(message)
        self.status_code = status_code
        self.error_name = error_name


class BlueskyAuthError(BlueskyAPIError):
    """401: session expired or bad credentials."""


class BlueskyRateLimitError(BlueskyAPIError):
    """429: rate limit exceeded."""


class BlueskyBlobTooLargeError(BlueskyAPIError):
    """413: image exceeds 1 MB limit."""


# ── Session Data ──────────────────────────────────────────────────────


@dataclass
class _BlueskySession:
    did: str
    access_jwt: str
    refresh_jwt: str
    created_at: float  # monotonic time


# ── Service ───────────────────────────────────────────────────────────


class BlueskyService:
    """AT Protocol client for Bluesky. Hardened: retry, backoff, circuit breaker."""

    def __init__(self, handle: str, app_password: str, pds_url: str = "https://bsky.social"):
        self._handle = handle
        self._app_password = app_password
        self._base_url = pds_url.rstrip("/")
        self._session: _BlueskySession | None = None

    # ── Session Management ────────────────────────────────────────────

    async def ensure_session(self) -> None:
        """Create or refresh session. Retries once on transient failure."""
        if self._session:
            # Proactive refresh: sessions last ~2h on bsky.social
            elapsed = time.monotonic() - self._session.created_at
            if elapsed < 3600:  # < 1h — still fresh
                return
            # Try refresh
            try:
                await self._refresh_session()
                return
            except BlueskyAuthError:
                logger.info("Bluesky session refresh failed, creating new session")
                self._session = None

        await self._create_session()

    async def _create_session(self) -> None:
        """Authenticate via com.atproto.server.createSession."""
        try:
            data = await self._xrpc_post(
                "com.atproto.server.createSession",
                json_body={"identifier": self._handle, "password": self._app_password},
                auth=False,
            )
        except BlueskyAPIError as exc:
            logger.error("Bluesky authentication failed", extra={
                "handle": self._handle,
                "pds_url": self._base_url,
                "error": str(exc)[:200],
            })
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("bluesky_phase", "auth")
                scope.set_tag("action_required", "check_credentials")
                scope.set_context("bluesky", {
                    "handle": self._handle,
                    "pds_url": self._base_url,
                })
                sentry_sdk.capture_exception(exc)
            raise

        self._session = _BlueskySession(
            did=data["did"],
            access_jwt=data["accessJwt"],
            refresh_jwt=data["refreshJwt"],
            created_at=time.monotonic(),
        )
        logger.info("Bluesky session created", extra={
            "did": data["did"],
            "handle": data.get("handle", self._handle),
            "pds_url": self._base_url,
        })

    async def _refresh_session(self) -> None:
        """Refresh session via com.atproto.server.refreshSession."""
        if not self._session:
            raise BlueskyAuthError("No session to refresh")

        old_refresh = self._session.refresh_jwt
        async with httpx.AsyncClient(timeout=TIMEOUT_API) as client:
            resp = await client.post(
                f"{self._base_url}/xrpc/com.atproto.server.refreshSession",
                headers={"Authorization": f"Bearer {old_refresh}"},
            )
        self._check_response(resp)
        data = resp.json()

        self._session = _BlueskySession(
            did=data["did"],
            access_jwt=data["accessJwt"],
            refresh_jwt=data["refreshJwt"],
            created_at=time.monotonic(),
        )
        logger.debug("Bluesky session refreshed", extra={"did": data["did"]})

    # ── Publishing ────────────────────────────────────────────────────

    async def publish_post(
        self, content: AdaptedContent, media: list[UploadedMedia],
    ) -> PublishResult:
        """Create a post via com.atproto.repo.createRecord (app.bsky.feed.post).

        Synchronous — no polling needed (unlike Instagram containers).
        """
        await self.ensure_session()
        if not self._session:
            raise BlueskyAuthError("No active session")

        # Build post record
        post_text = content.caption
        record: dict = {
            "$type": "app.bsky.feed.post",
            "text": post_text,
            "createdAt": datetime.now(UTC).isoformat(),
        }

        # Facets (rich text — hashtags, links)
        facets = content.facets or self.build_facets(post_text)
        if facets:
            record["facets"] = facets

        # Embed images (max 4)
        if media:
            images = []
            for m in media[:4]:
                img: dict = {"alt": content.alt_text or "", "image": m.ref}
                images.append(img)
            record["embed"] = {
                "$type": "app.bsky.embed.images",
                "images": images,
            }

        t0 = time.monotonic()
        data = await self._xrpc_post(
            "com.atproto.repo.createRecord",
            json_body={
                "repo": self._session.did,
                "collection": "app.bsky.feed.post",
                "record": record,
            },
        )

        uri = data.get("uri", "")
        cid = data.get("cid", "")
        elapsed_ms = int((time.monotonic() - t0) * 1000)

        logger.info("Published Bluesky post", extra={
            "bsky_uri": uri,
            "bsky_cid": cid,
            "text_length": len(post_text),
            "media_count": len(media),
            "elapsed_ms": elapsed_ms,
        })

        # Build permalink from URI: at://did:plc:xxx/app.bsky.feed.post/rkey
        permalink = None
        if uri:
            parts = uri.replace("at://", "").split("/")
            if len(parts) >= 3:
                # Use handle for human-readable URL
                permalink = f"https://bsky.app/profile/{self._handle}/post/{parts[-1]}"

        return PublishResult(
            platform="bluesky",
            platform_post_id=uri,
            permalink=permalink,
            cid=cid or None,
        )

    async def upload_media(self, data: bytes, mime_type: str = "image/jpeg") -> UploadedMedia:
        """Upload blob via com.atproto.repo.uploadBlob.

        Pre-validates size, recompresses JPEG if > 950 KB.
        """
        await self.ensure_session()

        original_size = len(data)

        # Recompress if needed
        if original_size > BLOB_RECOMPRESS_THRESHOLD and mime_type == "image/jpeg":
            data = self._recompress_jpeg(data, quality=80)
            logger.info("Recompressed JPEG for Bluesky upload", extra={
                "original_bytes": original_size,
                "compressed_bytes": len(data),
                "quality": 80,
            })

        if len(data) > BLOB_MAX_BYTES:
            raise BlueskyBlobTooLargeError(
                f"Blob size {len(data)} bytes exceeds {BLOB_MAX_BYTES} byte limit",
                status_code=413,
            )

        t0 = time.monotonic()
        resp_data = await self._xrpc_post(
            "com.atproto.repo.uploadBlob",
            data=data,
            content_type=mime_type,
        )
        elapsed_ms = int((time.monotonic() - t0) * 1000)

        blob = resp_data.get("blob", {})
        logger.info("Uploaded Bluesky blob", extra={
            "blob_size": len(data),
            "mime_type": mime_type,
            "elapsed_ms": elapsed_ms,
            "blob_ref": str(blob.get("ref", {}).get("$link", ""))[:16] + "…",
        })

        return UploadedMedia(
            ref=blob,
            mime_type=mime_type,
            size_bytes=len(data),
        )

    async def get_post_metrics(self, post_uri: str) -> dict:
        """Fetch engagement metrics via app.bsky.feed.getPosts."""
        await self.ensure_session()

        data = await self._xrpc_get(
            "app.bsky.feed.getPosts",
            params={"uris": post_uri},
        )

        posts = data.get("posts", [])
        if not posts:
            return {"likes": 0, "reposts": 0, "replies": 0, "quotes": 0}

        post = posts[0]
        return {
            "likes": post.get("likeCount", 0),
            "reposts": post.get("repostCount", 0),
            "replies": post.get("replyCount", 0),
            "quotes": post.get("quoteCount", 0),
        }

    async def validate_credentials(self) -> bool:
        """Attempt session creation, return True/False. For admin status check."""
        try:
            await self._create_session()
            return True
        except BlueskyAPIError:
            return False

    async def delete_post(self, post_uri: str) -> None:
        """Delete a post via com.atproto.repo.deleteRecord. For error recovery."""
        await self.ensure_session()
        if not self._session:
            raise BlueskyAuthError("No active session")

        # Parse URI: at://did:plc:xxx/collection/rkey
        parts = post_uri.replace("at://", "").split("/")
        if len(parts) < 3:
            raise BlueskyAPIError(f"Invalid AT URI: {post_uri}")

        repo = parts[0]
        collection = "/".join(parts[1:-1])
        rkey = parts[-1]

        await self._xrpc_post(
            "com.atproto.repo.deleteRecord",
            json_body={
                "repo": repo,
                "collection": collection,
                "rkey": rkey,
            },
        )
        logger.info("Deleted Bluesky post", extra={"bsky_uri": post_uri})

    # ── Facet Construction ────────────────────────────────────────────

    @staticmethod
    def build_facets(text: str) -> list[dict]:
        """Scan for #hashtag and https:// patterns, compute UTF-8 byte offsets.

        Returns AT Protocol facet array for rich text rendering.
        """
        encoded = text.encode("utf-8")
        facets: list[dict] = []

        # Hashtags: #word (letters, digits, underscores)
        for match in re.finditer(r"#(\w+)", text):
            tag_text = match.group(0)
            tag_value = match.group(1)
            # Find byte position
            prefix = text[: match.start()].encode("utf-8")
            tag_bytes = tag_text.encode("utf-8")
            byte_start = len(prefix)
            byte_end = byte_start + len(tag_bytes)

            if byte_end <= len(encoded):
                facets.append({
                    "index": {"byteStart": byte_start, "byteEnd": byte_end},
                    "features": [{
                        "$type": "app.bsky.richtext.facet#tag",
                        "tag": tag_value,
                    }],
                })

        # URLs: https://...
        for match in re.finditer(r"https?://\S+", text):
            url_text = match.group(0)
            prefix = text[: match.start()].encode("utf-8")
            url_bytes = url_text.encode("utf-8")
            byte_start = len(prefix)
            byte_end = byte_start + len(url_bytes)

            if byte_end <= len(encoded):
                facets.append({
                    "index": {"byteStart": byte_start, "byteEnd": byte_end},
                    "features": [{
                        "$type": "app.bsky.richtext.facet#link",
                        "uri": url_text,
                    }],
                })

        return facets

    # ── Internal HTTP ─────────────────────────────────────────────────

    async def _xrpc_get(
        self,
        method: str,
        params: dict | None = None,
    ) -> dict:
        """XRPC GET with retry and auth."""
        url = f"{self._base_url}/xrpc/{method}"
        headers = self._auth_headers()

        for attempt in range(MAX_RETRIES):
            try:
                async with httpx.AsyncClient(timeout=TIMEOUT_API) as client:
                    resp = await client.get(url, params=params, headers=headers)

                if resp.status_code in (429, 500, 502, 503) and attempt < MAX_RETRIES - 1:
                    wait = BACKOFF_BASE * (2 ** attempt)
                    logger.warning("Bluesky API retrying", extra={
                        "method": method,
                        "status": resp.status_code,
                        "attempt": attempt + 1,
                        "wait_s": wait,
                    })
                    await asyncio.sleep(wait)
                    continue

                self._check_response(resp)
                return resp.json()

            except (httpx.ConnectError, httpx.ConnectTimeout) as exc:
                if attempt < MAX_RETRIES - 1:
                    wait = BACKOFF_BASE * (2 ** attempt)
                    logger.warning("Bluesky connection error, retrying", extra={
                        "method": method,
                        "attempt": attempt + 1,
                        "wait_s": wait,
                        "error": str(exc)[:100],
                    })
                    await asyncio.sleep(wait)
                    continue
                raise BlueskyAPIError(f"Connection failed after {MAX_RETRIES} attempts: {exc}") from exc

        # Should not reach here, but safety net
        raise BlueskyAPIError(f"XRPC GET {method} failed after {MAX_RETRIES} retries")

    async def _xrpc_post(
        self,
        method: str,
        *,
        json_body: dict | None = None,
        data: bytes | None = None,
        content_type: str | None = None,
        auth: bool = True,
    ) -> dict:
        """XRPC POST with retry and auth. Supports JSON and binary body."""
        url = f"{self._base_url}/xrpc/{method}"
        headers = self._auth_headers() if auth else {}
        timeout = TIMEOUT_BLOB if data is not None else TIMEOUT_API

        for attempt in range(MAX_RETRIES):
            try:
                async with httpx.AsyncClient(timeout=timeout) as client:
                    if data is not None:
                        headers["Content-Type"] = content_type or "application/octet-stream"
                        resp = await client.post(url, content=data, headers=headers)
                    else:
                        resp = await client.post(url, json=json_body, headers=headers)

                if resp.status_code in (429, 500, 502, 503) and attempt < MAX_RETRIES - 1:
                    wait = BACKOFF_BASE * (2 ** attempt)
                    logger.warning("Bluesky API retrying", extra={
                        "method": method,
                        "status": resp.status_code,
                        "attempt": attempt + 1,
                        "wait_s": wait,
                    })
                    await asyncio.sleep(wait)
                    continue

                self._check_response(resp)
                return resp.json()

            except (httpx.ConnectError, httpx.ConnectTimeout) as exc:
                if attempt < MAX_RETRIES - 1:
                    wait = BACKOFF_BASE * (2 ** attempt)
                    logger.warning("Bluesky connection error, retrying", extra={
                        "method": method,
                        "attempt": attempt + 1,
                        "wait_s": wait,
                        "error": str(exc)[:100],
                    })
                    await asyncio.sleep(wait)
                    continue
                raise BlueskyAPIError(f"Connection failed after {MAX_RETRIES} attempts: {exc}") from exc

        raise BlueskyAPIError(f"XRPC POST {method} failed after {MAX_RETRIES} retries")

    def _auth_headers(self) -> dict[str, str]:
        """Build Authorization header from current session."""
        if not self._session:
            return {}
        return {"Authorization": f"Bearer {self._session.access_jwt}"}

    @staticmethod
    def _check_response(resp: httpx.Response) -> None:
        """Check AT Protocol response for errors and raise typed exceptions."""
        if 200 <= resp.status_code < 300:
            return

        # Parse error body
        try:
            body = resp.json()
        except (ValueError, KeyError):
            body = {}

        error_name = body.get("error", "")
        error_message = body.get("message", resp.text[:500])

        # Log every error with full context
        logger.error("Bluesky XRPC error", extra={
            "http_status": resp.status_code,
            "error_name": error_name,
            "error_message": error_message[:300],
            "request_url": str(resp.request.url).split("?")[0] if resp.request else "",
            "request_method": str(resp.request.method) if resp.request else "",
            "response_body": resp.text[:500],
        })

        # 401 — auth failure
        if resp.status_code == 401 or error_name in ("AuthenticationRequired", "InvalidToken", "ExpiredToken"):
            raise BlueskyAuthError(
                f"Authentication failed: {error_message}",
                status_code=resp.status_code,
                error_name=error_name,
            )

        # 429 — rate limit
        if resp.status_code == 429 or error_name == "RateLimitExceeded":
            raise BlueskyRateLimitError(
                f"Rate limit exceeded: {error_message}",
                status_code=resp.status_code,
                error_name=error_name,
            )

        # 413 — blob too large
        if resp.status_code == 413 or error_name == "BlobTooLarge":
            raise BlueskyBlobTooLargeError(
                f"Blob too large: {error_message}",
                status_code=resp.status_code,
                error_name=error_name,
            )

        # Generic error
        api_exc = BlueskyAPIError(
            f"Bluesky API error ({resp.status_code}): {error_message}",
            status_code=resp.status_code,
            error_name=error_name,
        )
        with sentry_sdk.push_scope() as scope:
            scope.set_tag("bluesky_phase", "api_response")
            scope.set_context("bluesky", {
                "error_name": error_name,
                "message": error_message[:500],
                "status_code": resp.status_code,
            })
            sentry_sdk.capture_exception(api_exc)
        raise api_exc

    @staticmethod
    def _recompress_jpeg(data: bytes, quality: int = 80) -> bytes:
        """Recompress JPEG at lower quality to fit under Bluesky's 1 MB limit."""
        from PIL import Image

        img = Image.open(io.BytesIO(data))
        if img.mode == "RGBA":
            img = img.convert("RGB")
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=quality, optimize=True)
        return buf.getvalue()
