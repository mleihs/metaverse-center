"""Unit tests for backend.utils.safe_fetch — SSRF protection.

Covers:
1. validate_url: scheme validation, hostname presence, private/loopback/reserved/link-local IPs
2. validate_url: DNS-rebinding protection (domain resolving to private IP)
3. safe_download: content-type and size enforcement
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from backend.utils.safe_fetch import safe_download, safe_fetch, validate_url


# ── Scheme validation ─────────────────────────────────────────────────


class TestSchemeValidation:
    def test_rejects_ftp(self):
        with pytest.raises(ValueError, match="Only HTTP/HTTPS"):
            validate_url("ftp://example.com/file.png")

    def test_rejects_file(self):
        with pytest.raises(ValueError, match="Only HTTP/HTTPS"):
            validate_url("file:///etc/passwd")

    def test_rejects_empty_scheme(self):
        with pytest.raises(ValueError, match="Only HTTP/HTTPS"):
            validate_url("://example.com")

    def test_accepts_http(self):
        with patch("backend.utils.safe_fetch.socket.getaddrinfo") as mock_dns:
            mock_dns.return_value = [(2, 1, 6, "", ("93.184.216.34", 0))]
            validate_url("http://example.com/img.png")

    def test_accepts_https(self):
        with patch("backend.utils.safe_fetch.socket.getaddrinfo") as mock_dns:
            mock_dns.return_value = [(2, 1, 6, "", ("93.184.216.34", 0))]
            validate_url("https://example.com/img.png")


# ── Hostname validation ───────────────────────────────────────────────


class TestHostnameValidation:
    def test_rejects_missing_hostname(self):
        with pytest.raises(ValueError, match="no hostname"):
            validate_url("https:///path")


# ── IP address validation ─────────────────────────────────────────────


class TestIpValidation:
    def test_rejects_loopback_ipv4(self):
        with pytest.raises(ValueError, match="private/internal"):
            validate_url("http://127.0.0.1/admin")

    def test_rejects_private_10(self):
        with pytest.raises(ValueError, match="private/internal"):
            validate_url("http://10.0.0.1/secret")

    def test_rejects_private_172(self):
        with pytest.raises(ValueError, match="private/internal"):
            validate_url("http://172.16.0.1/internal")

    def test_rejects_private_192(self):
        with pytest.raises(ValueError, match="private/internal"):
            validate_url("http://192.168.1.1/router")

    def test_rejects_link_local_aws_metadata(self):
        with pytest.raises(ValueError, match="private/internal"):
            validate_url("http://169.254.169.254/latest/meta-data/")

    def test_rejects_ipv6_loopback(self):
        with pytest.raises(ValueError, match="private/internal"):
            validate_url("http://[::1]/admin")

    def test_accepts_public_ip(self):
        validate_url("http://93.184.216.34/img.png")

    def test_accepts_cloudflare_dns(self):
        validate_url("https://1.1.1.1/dns-query")


# ── DNS rebinding protection ──────────────────────────────────────────


class TestDnsRebinding:
    @patch("backend.utils.safe_fetch.socket.getaddrinfo")
    def test_rejects_domain_resolving_to_private_ip(self, mock_dns):
        mock_dns.return_value = [(2, 1, 6, "", ("10.0.0.1", 0))]
        with pytest.raises(ValueError, match="private/internal"):
            validate_url("https://evil.attacker.com/payload")

    @patch("backend.utils.safe_fetch.socket.getaddrinfo")
    def test_rejects_domain_resolving_to_loopback(self, mock_dns):
        mock_dns.return_value = [(2, 1, 6, "", ("127.0.0.1", 0))]
        with pytest.raises(ValueError, match="private/internal"):
            validate_url("https://evil.attacker.com/payload")

    @patch("backend.utils.safe_fetch.socket.getaddrinfo")
    def test_rejects_domain_resolving_to_link_local(self, mock_dns):
        mock_dns.return_value = [(2, 1, 6, "", ("169.254.169.254", 0))]
        with pytest.raises(ValueError, match="private/internal"):
            validate_url("https://evil.attacker.com/metadata")

    @patch("backend.utils.safe_fetch.socket.getaddrinfo")
    def test_rejects_if_any_resolved_ip_is_private(self, mock_dns):
        """If domain resolves to both public and private IPs, reject."""
        mock_dns.return_value = [
            (2, 1, 6, "", ("93.184.216.34", 0)),
            (2, 1, 6, "", ("10.0.0.1", 0)),
        ]
        with pytest.raises(ValueError, match="private/internal"):
            validate_url("https://dual-homed.attacker.com/")

    @patch("backend.utils.safe_fetch.socket.getaddrinfo")
    def test_accepts_domain_resolving_to_public_ip(self, mock_dns):
        mock_dns.return_value = [(2, 1, 6, "", ("93.184.216.34", 0))]
        validate_url("https://example.com/image.png")

    @patch("backend.utils.safe_fetch.socket.getaddrinfo")
    def test_rejects_unresolvable_hostname(self, mock_dns):
        import socket

        mock_dns.side_effect = socket.gaierror("Name resolution failed")
        with pytest.raises(ValueError, match="Cannot resolve hostname"):
            validate_url("https://this-does-not-exist.invalid/")


# ── safe_download integration ─────────────────────────────────────────


class TestSafeDownload:
    @pytest.mark.asyncio
    @patch("backend.utils.safe_fetch.validate_url")
    @patch("backend.utils.safe_fetch.httpx.AsyncClient")
    async def test_rejects_wrong_content_type(self, mock_client_cls, _mock_validate):
        mock_response = MagicMock()
        mock_response.headers = {"content-type": "text/html; charset=utf-8"}
        mock_response.content = b"<html>not an image</html>"
        mock_response.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.request = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        with pytest.raises(ValueError, match="unsupported content type"):
            await safe_download(
                "https://example.com/fake.png",
                allowed_content_types={"image/png"},
            )

    @pytest.mark.asyncio
    @patch("backend.utils.safe_fetch.validate_url")
    @patch("backend.utils.safe_fetch.httpx.AsyncClient")
    async def test_rejects_oversized_response(self, mock_client_cls, _mock_validate):
        mock_response = MagicMock()
        mock_response.headers = {"content-type": "image/png"}
        mock_response.content = b"x" * 1001
        mock_response.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.request = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        with pytest.raises(ValueError, match="too large"):
            await safe_download(
                "https://example.com/huge.png",
                max_size=1000,
            )

    @pytest.mark.asyncio
    @patch("backend.utils.safe_fetch.validate_url")
    @patch("backend.utils.safe_fetch.httpx.AsyncClient")
    async def test_successful_download(self, mock_client_cls, _mock_validate):
        mock_response = MagicMock()
        mock_response.headers = {"content-type": "image/png"}
        mock_response.content = b"\x89PNG\r\n"
        mock_response.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.request = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        data, ct = await safe_download(
            "https://example.com/valid.png",
            allowed_content_types={"image/png"},
        )
        assert data == b"\x89PNG\r\n"
        assert ct == "image/png"
