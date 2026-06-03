"""Shared email service — sends HTML emails via the Resend API (primary) or SMTP SSL (fallback).

Resend is the preferred transport: it signs DKIM with ``d=metaverse.center``, which is
DMARC-aligned with the From domain, so mail reaches the inbox instead of the spam folder.
SMTP SSL (prossl) is kept as a configuration-level fallback for when ``RESEND_API_KEY`` is
unset — the prossl gateway signs ``d=prossl.de`` (not aligned), so mail delivered via SMTP
can be spam-foldered by strict receivers. Unsetting ``RESEND_API_KEY`` is therefore a clean
operational rollback lever back to SMTP without a code change.

Transport selection is by *configuration*, not by runtime failure: when Resend is configured,
a Resend send error is captured to Sentry and returns ``False`` — it does NOT silently retry
via the spam-prone SMTP path. That would mask Resend outages and risk a double-send on an
ambiguous timeout (the API may have accepted the message before the client timed out).
"""

import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx
import sentry_sdk

from backend.config import settings

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"
RESEND_TIMEOUT_SECONDS = 15.0


class EmailService:
    """Sends HTML emails via the Resend API (primary) or SMTP SSL (fallback)."""

    @staticmethod
    def _resend_configured() -> bool:
        return bool(settings.resend_api_key)

    @staticmethod
    def _smtp_configured() -> bool:
        return bool(settings.smtp_host and settings.smtp_user and settings.smtp_password)

    @classmethod
    def _is_configured(cls) -> bool:
        """True if at least one transport (Resend or SMTP) is configured."""
        return cls._resend_configured() or cls._smtp_configured()

    @staticmethod
    async def _send_via_resend(to: str, subject: str, html_body: str) -> bool:
        """Send an HTML email via the Resend HTTP API.

        Resend signs DKIM with ``d=metaverse.center`` (DMARC-aligned). The trusted, fixed
        API endpoint means SSRF protection (safe_fetch) does not apply here.
        """
        payload = {
            "from": settings.smtp_from,
            "to": [to],
            "subject": subject,
            "html": html_body,
        }
        headers = {"Authorization": f"Bearer {settings.resend_api_key}"}

        try:
            async with httpx.AsyncClient(timeout=RESEND_TIMEOUT_SECONDS) as client:
                resp = await client.post(RESEND_API_URL, json=payload, headers=headers)
        except (httpx.HTTPError, OSError):
            logger.exception("Resend connection error", extra={"recipient": to})
            sentry_sdk.capture_exception()
            return False

        if resp.status_code == 200:
            # A 200 means Resend accepted the message — the send succeeded. The body is
            # normally {"id": "..."}, but parse defensively: a non-JSON/empty 200 (proxy or
            # gateway hiccup) must not raise out of the `-> bool` contract. Observe the
            # anomaly via Sentry, default the id to empty, and still report success.
            try:
                message_id = resp.json().get("id", "")
            except ValueError:
                message_id = ""
                logger.warning(
                    "Resend returned 200 with a non-JSON body", extra={"recipient": to}
                )
                sentry_sdk.capture_message("Resend 200 response body was not valid JSON")
            logger.info(
                "Email sent via Resend",
                extra={
                    "recipient": to,
                    "subject_preview": subject[:60],
                    "message_id": message_id,
                },
            )
            return True

        # Non-2xx — Resend returns {"statusCode", "message", "name"}. Recipient stays in
        # `extra` (PII out of the message string); the body is truncated to avoid log bloat.
        logger.error(
            "Resend API rejected email",
            extra={
                "recipient": to,
                "status_code": resp.status_code,
                "resend_error": resp.text[:200],
            },
        )
        sentry_sdk.capture_message(
            f"Resend API rejected email (status {resp.status_code})", level="error"
        )
        return False

    @staticmethod
    def _send_sync(to: str, subject: str, html_body: str) -> bool:
        """Synchronous SMTP SSL send (fallback transport).

        The prossl gateway signs ``d=prossl.de`` (not DMARC-aligned with metaverse.center),
        so mail delivered this way may be spam-foldered by strict receivers.
        """
        msg = MIMEMultipart("alternative")
        msg["From"] = settings.smtp_from
        msg["To"] = to
        msg["Subject"] = subject
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        try:
            with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=30) as server:
                server.login(settings.smtp_user, settings.smtp_password)
                server.sendmail(settings.smtp_from, [to], msg.as_string())
            logger.info(
                "Email sent via SMTP", extra={"recipient": to, "subject_preview": subject[:60]}
            )
            return True
        except smtplib.SMTPException:
            logger.exception("SMTP error sending email", extra={"recipient": to})
            sentry_sdk.capture_exception()
            return False
        except (TimeoutError, OSError):
            logger.exception("Email connection error", extra={"recipient": to})
            sentry_sdk.capture_exception()
            return False

    @classmethod
    async def send(cls, to: str, subject: str, html_body: str) -> bool:
        """Send an HTML email asynchronously.

        Prefers the Resend API (DMARC-aligned, lands in the inbox); falls back to SMTP SSL
        only when Resend is not configured. Returns True on success, False on failure or
        when no transport is configured.
        """
        if cls._resend_configured():
            return await cls._send_via_resend(to, subject, html_body)

        if cls._smtp_configured():
            return await asyncio.to_thread(cls._send_sync, to, subject, html_body)

        logger.warning("No email transport configured, skipping email", extra={"recipient": to})
        return False
