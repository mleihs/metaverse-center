"""Centralized SSRF-safe HTTP fetch utility.

All external URL fetches MUST go through this module to prevent Server-Side
Request Forgery (SSRF) attacks.  Replaces inline SSRF checks in
``StyleReferenceService.fetch_from_url()`` (migration-era) and adds
DNS-rebinding protection.

Usage::

    from backend.utils.safe_fetch import safe_download, validate_url

    # Validate only (raises ValueError)
    validate_url("https://example.com/image.png")

    # Download with SSRF protection
    data, content_type = await safe_download(
        "https://example.com/image.png",
        allowed_content_types={"image/png", "image/jpeg"},
    )
"""

from __future__ import annotations

import ipaddress
import logging
import socket
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

_ALLOWED_SCHEMES = frozenset({"http", "https"})


def validate_url(url: str) -> None:
    """Validate a URL for SSRF safety.

    Checks:
    - Scheme must be http or https
    - Hostname must be present
    - If hostname is a raw IP: must not be private, loopback, reserved, or link-local
    - If hostname is a domain: resolved IPs must not be private/internal (DNS-rebinding protection)

    Raises:
        ValueError: If the URL fails any validation check.
    """
    parsed = urlparse(url)

    if not parsed.scheme or parsed.scheme not in _ALLOWED_SCHEMES:
        raise ValueError(f"Only HTTP/HTTPS URLs are allowed, got: {parsed.scheme!r}")

    hostname = parsed.hostname
    if not hostname:
        raise ValueError("Invalid URL: no hostname")

    # Check if hostname is a raw IP address
    try:
        ip = ipaddress.ip_address(hostname)
        _check_ip(ip, hostname)
        return
    except ValueError as exc:
        if "not allowed" in str(exc):
            raise
        # Not a raw IP — it's a domain name, resolve it below

    # DNS-rebinding protection: resolve hostname and check all IPs
    try:
        addrinfo = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise ValueError(f"Cannot resolve hostname: {hostname}") from exc

    if not addrinfo:
        raise ValueError(f"No addresses found for hostname: {hostname}")

    for _family, _type, _proto, _canonname, sockaddr in addrinfo:
        ip_str = sockaddr[0]
        try:
            ip = ipaddress.ip_address(ip_str)
            _check_ip(ip, hostname)
        except ValueError as exc:
            if "not allowed" in str(exc):
                raise


def _check_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address, context: str) -> None:
    """Reject private, loopback, reserved, and link-local addresses."""
    if ip.is_private or ip.is_loopback or ip.is_reserved or ip.is_link_local:
        raise ValueError(
            f"URLs pointing to private/internal addresses are not allowed "
            f"({context} resolves to {ip})"
        )


async def safe_fetch(
    url: str,
    *,
    method: str = "GET",
    timeout: float = 30.0,
    follow_redirects: bool = True,
    **kwargs: object,
) -> httpx.Response:
    """Make an SSRF-safe HTTP request.

    Validates the URL before making the request.

    Args:
        url: The URL to fetch.
        method: HTTP method (default GET).
        timeout: Request timeout in seconds.
        follow_redirects: Whether to follow redirects.
        **kwargs: Passed to httpx.AsyncClient.request().

    Returns:
        httpx.Response object.

    Raises:
        ValueError: If URL validation fails.
        httpx.HTTPStatusError: If response status is 4xx/5xx.
    """
    validate_url(url)

    async with httpx.AsyncClient(
        follow_redirects=follow_redirects,
        timeout=timeout,
    ) as client:
        response = await client.request(method, url, **kwargs)
        response.raise_for_status()

    return response


async def safe_download(
    url: str,
    *,
    timeout: float = 30.0,
    max_size: int = 10 * 1024 * 1024,
    allowed_content_types: set[str] | None = None,
) -> tuple[bytes, str]:
    """Download content from a URL with SSRF protection.

    Args:
        url: The URL to download.
        timeout: Request timeout in seconds.
        max_size: Maximum download size in bytes (default 10 MB).
        allowed_content_types: If set, reject responses with other content types.

    Returns:
        Tuple of (content_bytes, content_type).

    Raises:
        ValueError: If URL validation, content type, or size check fails.
        httpx.HTTPStatusError: If response status is 4xx/5xx.
    """
    response = await safe_fetch(url, timeout=timeout)

    content_type = response.headers.get("content-type", "").split(";")[0].strip()

    if allowed_content_types and content_type not in allowed_content_types:
        raise ValueError(f"URL returned unsupported content type: {content_type}")

    data = response.content
    if len(data) > max_size:
        raise ValueError(
            f"Downloaded file too large: {len(data)} bytes "
            f"(max {max_size // (1024 * 1024)} MB)"
        )

    return data, content_type
