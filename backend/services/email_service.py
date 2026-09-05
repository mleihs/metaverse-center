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
from dataclasses import dataclass
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx
import sentry_sdk
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.config import settings
from backend.services.email_templates import html_to_text
from backend.utils.supabase_admin_cache import get_admin_supabase_client


@dataclass(frozen=True, slots=True)
class MailRecord:
    """What to write into ``email_log`` about one send.

    Grouped into an object rather than five more keyword arguments, because it
    travels together and is filed together. ``template`` is required: an
    unlabelled row answers "did anything go out" but not "did the SITREP go
    out", and the second question is the one people ask.
    """

    template: str
    user_id: str | None = None
    epoch_id: str | None = None
    simulation_id: str | None = None
    cycle_number: int | None = None


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

    @staticmethod
    async def _send_via_resend(
        to: str,
        subject: str,
        html_body: str,
        *,
        text_body: str | None = None,
        extra_headers: dict[str, str] | None = None,
    ) -> bool:
        """Send an email via the Resend HTTP API.

        Resend signs DKIM with ``d=metaverse.center`` (DMARC-aligned). The trusted, fixed
        API endpoint means SSRF protection (safe_fetch) does not apply here.
        """
        payload: dict = {
            "from": settings.smtp_from,
            "to": [to],
            "subject": subject,
            "html": html_body,
        }
        if text_body:
            payload["text"] = text_body
        if extra_headers:
            payload["headers"] = extra_headers
        headers = {"Authorization": f"Bearer {settings.resend_api_key}"}

        try:
            async with httpx.AsyncClient(timeout=RESEND_TIMEOUT_SECONDS) as client:
                resp = await client.post(RESEND_API_URL, json=payload, headers=headers)
        except (httpx.HTTPError, OSError) as exc:
            logger.exception("Resend connection error", extra={"recipient": to})
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("service", "EmailService")
                scope.set_tag("transport", "resend")
                sentry_sdk.capture_exception(exc)
            return False

        if 200 <= resp.status_code < 300:
            # A 2xx means Resend accepted the message — the send succeeded. The body is
            # normally {"id": "..."}, but parse defensively: a non-JSON/empty 2xx body (a
            # 204, or a proxy/gateway hiccup) must not raise out of the `-> bool` contract.
            # Observe the anomaly via Sentry, default the id to empty, still report success.
            try:
                message_id = resp.json().get("id", "")
            except ValueError:
                message_id = ""
                logger.warning("Resend returned a 2xx with a non-JSON body", extra={"recipient": to})
                with sentry_sdk.push_scope() as scope:
                    scope.set_tag("service", "EmailService")
                    scope.set_tag("transport", "resend")
                    sentry_sdk.capture_message("Resend 2xx response body was not valid JSON")
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
        with sentry_sdk.push_scope() as scope:
            scope.set_tag("service", "EmailService")
            scope.set_tag("transport", "resend")
            scope.set_context("resend", {"status_code": resp.status_code})
            sentry_sdk.capture_message(f"Resend API rejected email (status {resp.status_code})", level="error")
        return False

    @staticmethod
    def _send_sync(
        to: str,
        subject: str,
        html_body: str,
        *,
        text_body: str | None = None,
        extra_headers: dict[str, str] | None = None,
    ) -> bool:
        """Synchronous SMTP SSL send (fallback transport).

        The prossl gateway signs ``d=prossl.de`` (not DMARC-aligned with metaverse.center),
        so mail delivered this way may be spam-foldered by strict receivers.
        """
        msg = MIMEMultipart("alternative")
        msg["From"] = settings.smtp_from
        msg["To"] = to
        msg["Subject"] = subject
        for name, value in (extra_headers or {}).items():
            msg[name] = value
        # Order matters: `multipart/alternative` is read in ASCENDING preference,
        # so the plain part goes first and the HTML part last. Reversed, a client
        # that honours the ordering shows the text version to everyone.
        # Until now there was only one part — the subtype promised an
        # alternative that was never attached.
        if text_body:
            msg.attach(MIMEText(text_body, "plain", "utf-8"))
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        try:
            with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=30) as server:
                server.login(settings.smtp_user, settings.smtp_password)
                server.sendmail(settings.smtp_from, [to], msg.as_string())
            logger.info("Email sent via SMTP", extra={"recipient": to, "subject_preview": subject[:60]})
            return True
        except smtplib.SMTPException as exc:
            logger.exception("SMTP error sending email", extra={"recipient": to})
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("service", "EmailService")
                scope.set_tag("transport", "smtp")
                sentry_sdk.capture_exception(exc)
            return False
        except (TimeoutError, OSError) as exc:
            logger.exception("Email connection error", extra={"recipient": to})
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("service", "EmailService")
                scope.set_tag("transport", "smtp")
                sentry_sdk.capture_exception(exc)
            return False

    @staticmethod
    async def _record(
        to: str,
        subject: str,
        record: MailRecord | None,
        *,
        transport: str,
        ok: bool,
        message_id: str | None = None,
        error: str | None = None,
    ) -> None:
        """Write one row to ``email_log``. Never raises.

        Resend is send-only: there is no list to look at there, and the backend
        kept nothing but a log line, which rotates. "I did not get the mail" was
        therefore not hard to answer but IMPOSSIBLE to answer — there was no
        place the answer could have been (migration 291).

        Failures are recorded too: a send that failed IS the answer, not the
        absence of one.

        A failure to record must never cost the send that already happened, so
        everything here is swallowed into a warning.
        """
        try:
            admin = await get_admin_supabase_client()
            await (
                admin.table("email_log")
                .insert(
                    {
                        "recipient_email": to,
                        "recipient_user_id": record.user_id if record else None,
                        "template": record.template if record else "unspecified",
                        "subject": subject[:200],
                        "epoch_id": record.epoch_id if record else None,
                        "simulation_id": record.simulation_id if record else None,
                        "cycle_number": record.cycle_number if record else None,
                        "transport": transport,
                        "message_id": message_id,
                        "ok": ok,
                        "error": (error or None) and error[:500],
                    }
                )
                .execute()
            )
        except (PostgrestAPIError, httpx.HTTPError, OSError, KeyError, TypeError, ValueError):
            logger.warning("Could not write email_log row", extra={"recipient": to}, exc_info=True)
            sentry_sdk.capture_exception()

    @classmethod
    async def send(
        cls,
        to: str,
        subject: str,
        html_body: str,
        *,
        text_body: str | None = None,
        unsubscribe_url: str | None = None,
        record: MailRecord | None = None,
    ) -> bool:
        """Send an email asynchronously.

        Prefers the Resend API (DMARC-aligned, lands in the inbox); falls back to SMTP SSL
        only when Resend is not configured. Returns True on success, False on failure or
        when no transport is configured.

        ``text_body`` defaults to a plain-text rendering of ``html_body``. Both
        transports previously sent HTML only, which costs deliverability with
        every major filter and leaves plain-text readers with an empty message.

        ``unsubscribe_url`` adds the RFC 8058 headers. Gmail and Yahoo have
        required one-click unsubscription from bulk senders since 2024; the pair
        must be sent together, since ``List-Unsubscribe-Post`` is what promotes
        the header from "a link somewhere" to the client's own button.
        Transactional mail (a password reset, a clearance decision) passes no
        URL and gets no header — it is not bulk mail and must not be opt-outable.
        """
        if text_body is None:
            text_body = html_to_text(html_body)

        extra_headers: dict[str, str] = {}
        if unsubscribe_url:
            extra_headers["List-Unsubscribe"] = f"<{unsubscribe_url}>"
            extra_headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"

        if cls._resend_configured():
            ok = await cls._send_via_resend(to, subject, html_body, text_body=text_body, extra_headers=extra_headers)
            await cls._record(to, subject, record, transport="resend", ok=ok)
            return ok

        if cls._smtp_configured():
            ok = await asyncio.to_thread(
                cls._send_sync,
                to,
                subject,
                html_body,
                text_body=text_body,
                extra_headers=extra_headers,
            )
            await cls._record(to, subject, record, transport="smtp", ok=ok)
            return ok

        logger.warning("No email transport configured, skipping email", extra={"recipient": to})
        await cls._record(to, subject, record, transport="none", ok=False, error="no transport configured")
        return False
