"""Unit tests for EmailService — transport selection, Resend API, and SMTP fallback."""

import logging
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from backend.services.email_service import RESEND_TIMEOUT_SECONDS, EmailService


def _mock_response(*, status: int, json_data: dict | None = None, text: str = "") -> MagicMock:
    resp = MagicMock()
    resp.status_code = status
    if json_data is not None:
        resp.json.return_value = json_data
    resp.text = text
    return resp


@pytest.fixture
def mock_httpx_client():
    """Patch `httpx.AsyncClient` in email_service to a MagicMock+AsyncMock combo.

    Yields `(mock_cls, mock_instance)`. Tests set `mock_instance.post.return_value`/
    `.side_effect`, and can assert constructor kwargs (e.g. timeout) via `mock_cls`.
    """
    mock_instance = AsyncMock()
    mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
    mock_instance.__aexit__ = AsyncMock(return_value=False)

    with patch("backend.services.email_service.httpx.AsyncClient") as mock_cls:
        mock_cls.return_value = mock_instance
        yield mock_cls, mock_instance


class TestEmailServiceConfig:
    def test_resend_configured_reflects_api_key(self):
        with patch("backend.services.email_service.settings") as mock_settings:
            mock_settings.resend_api_key = ""
            assert EmailService._resend_configured() is False
            mock_settings.resend_api_key = "re_test"
            assert EmailService._resend_configured() is True

    def test_smtp_configured_false_when_empty(self):
        with patch("backend.services.email_service.settings") as mock_settings:
            mock_settings.smtp_host = ""
            mock_settings.smtp_user = ""
            mock_settings.smtp_password = ""
            assert EmailService._smtp_configured() is False

    def test_smtp_configured_false_when_partial(self):
        with patch("backend.services.email_service.settings") as mock_settings:
            mock_settings.smtp_host = "mail.example.com"
            mock_settings.smtp_user = ""
            mock_settings.smtp_password = "pass"
            assert EmailService._smtp_configured() is False

    def test_smtp_configured_true_when_complete(self):
        with patch("backend.services.email_service.settings") as mock_settings:
            mock_settings.smtp_host = "mail.example.com"
            mock_settings.smtp_user = "user"
            mock_settings.smtp_password = "pass"
            assert EmailService._smtp_configured() is True


class TestEmailServiceResend:
    @pytest.mark.asyncio
    async def test_successful_send(self, mock_httpx_client):
        mock_cls, mock_instance = mock_httpx_client
        mock_instance.post.return_value = _mock_response(
            status=200, json_data={"id": "msg-123"}, text='{"id":"msg-123"}'
        )
        with patch("backend.services.email_service.settings") as mock_settings:
            mock_settings.resend_api_key = "re_test"
            mock_settings.smtp_from = "metaverse.center <info@metaverse.center>"

            result = await EmailService._send_via_resend(
                "to@example.com", "Subject", "<p>Hi</p>"
            )

        assert result is True
        # The bounded timeout is load-bearing (it caps the ambiguous-send window).
        assert mock_cls.call_args.kwargs["timeout"] == RESEND_TIMEOUT_SECONDS
        mock_instance.post.assert_called_once()
        call = mock_instance.post.call_args
        assert call.args[0] == "https://api.resend.com/emails"
        assert call.kwargs["json"]["to"] == ["to@example.com"]
        assert call.kwargs["json"]["from"] == "metaverse.center <info@metaverse.center>"
        # Pin the full payload shape: a future `html`→`body` rename or a dropped `subject`
        # would otherwise surface only as a 422 in prod (which, given the deliberate
        # no-fallback design, silently zeroes outbound mail).
        assert call.kwargs["json"]["subject"] == "Subject"
        assert call.kwargs["json"]["html"] == "<p>Hi</p>"
        assert call.kwargs["headers"]["Authorization"] == "Bearer re_test"

    @pytest.mark.asyncio
    @pytest.mark.parametrize("status", [201, 202])
    async def test_2xx_status_codes_route_to_success(self, mock_httpx_client, status):
        """Any 2xx means Resend accepted the message — a future 201/202 must not be
        misreported as a rejection (the old exact `== 200` guard would have)."""
        _, mock_instance = mock_httpx_client
        mock_instance.post.return_value = _mock_response(
            status=status, json_data={"id": "msg-2xx"}, text='{"id":"msg-2xx"}'
        )
        with patch("backend.services.email_service.settings") as mock_settings:
            mock_settings.resend_api_key = "re_test"
            mock_settings.smtp_from = "Test <test@example.com>"

            result = await EmailService._send_via_resend("to@example.com", "S", "<p>x</p>")

        assert result is True

    @pytest.mark.asyncio
    async def test_malformed_200_body_returns_true_and_reports(self, mock_httpx_client):
        """A 200 means Resend accepted the message — an unparseable body must not raise."""
        _, mock_instance = mock_httpx_client
        bad_resp = _mock_response(status=200, text="<html>not json</html>")
        bad_resp.json.side_effect = ValueError("not json")
        mock_instance.post.return_value = bad_resp
        with (
            patch("backend.services.email_service.settings") as mock_settings,
            patch("backend.services.email_service.sentry_sdk.capture_message") as mock_capture,
        ):
            mock_settings.resend_api_key = "re_test"
            mock_settings.smtp_from = "Test <test@example.com>"

            result = await EmailService._send_via_resend("to@example.com", "S", "<p>x</p>")

        assert result is True
        mock_capture.assert_called_once()

    @pytest.mark.asyncio
    async def test_non_200_returns_false_and_reports(self, mock_httpx_client):
        _, mock_instance = mock_httpx_client
        mock_instance.post.return_value = _mock_response(
            status=422,
            text='{"statusCode":422,"message":"domain not verified","name":"validation_error"}',
        )
        with (
            patch("backend.services.email_service.settings") as mock_settings,
            patch("backend.services.email_service.sentry_sdk.capture_message") as mock_capture,
        ):
            mock_settings.resend_api_key = "re_test"
            mock_settings.smtp_from = "Test <test@example.com>"

            result = await EmailService._send_via_resend("to@example.com", "S", "<p>x</p>")

        assert result is False
        mock_capture.assert_called_once()

    @pytest.mark.asyncio
    async def test_http_error_returns_false_and_captures(self, mock_httpx_client):
        _, mock_instance = mock_httpx_client
        mock_instance.post.side_effect = httpx.ConnectError("boom")
        with (
            patch("backend.services.email_service.settings") as mock_settings,
            patch("backend.services.email_service.sentry_sdk.capture_exception") as mock_capture,
        ):
            mock_settings.resend_api_key = "re_test"
            mock_settings.smtp_from = "Test <test@example.com>"

            result = await EmailService._send_via_resend("to@example.com", "S", "<p>x</p>")

        assert result is False
        mock_capture.assert_called_once()


class TestEmailServiceSendSync:
    @patch("backend.services.email_service.smtplib.SMTP_SSL")
    @patch("backend.services.email_service.settings")
    def test_successful_send(self, mock_settings, mock_smtp_class):
        mock_settings.smtp_host = "mail.example.com"
        mock_settings.smtp_port = 465
        mock_settings.smtp_user = "user"
        mock_settings.smtp_password = "pass"
        mock_settings.smtp_from = "Test <test@example.com>"

        mock_server = MagicMock()
        mock_smtp_class.return_value.__enter__ = MagicMock(return_value=mock_server)
        mock_smtp_class.return_value.__exit__ = MagicMock(return_value=False)

        result = EmailService._send_sync("to@example.com", "Test Subject", "<h1>Hi</h1>")
        assert result is True
        mock_server.login.assert_called_once_with("user", "pass")
        mock_server.sendmail.assert_called_once()

    @patch("backend.services.email_service.smtplib.SMTP_SSL")
    @patch("backend.services.email_service.settings")
    def test_smtp_error_returns_false(self, mock_settings, mock_smtp_class):
        import smtplib

        mock_settings.smtp_host = "mail.example.com"
        mock_settings.smtp_port = 465
        mock_settings.smtp_user = "user"
        mock_settings.smtp_password = "pass"
        mock_settings.smtp_from = "Test <test@example.com>"

        mock_smtp_class.side_effect = smtplib.SMTPException("Auth failed")

        result = EmailService._send_sync("to@example.com", "Test", "<p>Hi</p>")
        assert result is False

    @patch("backend.services.email_service.smtplib.SMTP_SSL")
    @patch("backend.services.email_service.settings")
    def test_timeout_returns_false(self, mock_settings, mock_smtp_class):
        mock_settings.smtp_host = "mail.example.com"
        mock_settings.smtp_port = 465
        mock_settings.smtp_user = "user"
        mock_settings.smtp_password = "pass"
        mock_settings.smtp_from = "Test <test@example.com>"

        mock_smtp_class.side_effect = TimeoutError("Connection timed out")

        result = EmailService._send_sync("to@example.com", "Test", "<p>Hi</p>")
        assert result is False


class TestEmailServiceSendRouting:
    @pytest.mark.asyncio
    async def test_send_prefers_resend_when_configured(self):
        with (
            patch("backend.services.email_service.settings") as mock_settings,
            patch.object(EmailService, "_send_via_resend", new=AsyncMock(return_value=True)) as m,
            patch.object(EmailService, "_send_sync", return_value=True) as m_smtp,
        ):
            mock_settings.resend_api_key = "re_test"
            # SMTP also configured — Resend must still win.
            mock_settings.smtp_host = "mail.example.com"
            mock_settings.smtp_user = "user"
            mock_settings.smtp_password = "pass"

            result = await EmailService.send("to@example.com", "Test", "<p>Hi</p>")

        assert result is True
        m.assert_awaited_once_with(
            "to@example.com", "Test", "<p>Hi</p>", text_body="Hi", extra_headers={}
        )
        m_smtp.assert_not_called()

    @pytest.mark.asyncio
    async def test_send_does_not_fall_back_to_smtp_on_resend_failure(self):
        """Key invariant: a Resend failure returns False and must NOT retry via SMTP."""
        with (
            patch("backend.services.email_service.settings") as mock_settings,
            patch.object(EmailService, "_send_via_resend", new=AsyncMock(return_value=False)),
            patch.object(EmailService, "_send_sync", return_value=True) as m_smtp,
        ):
            mock_settings.resend_api_key = "re_test"
            # SMTP fully configured — must still NOT be used as a runtime fallback.
            mock_settings.smtp_host = "mail.example.com"
            mock_settings.smtp_user = "user"
            mock_settings.smtp_password = "pass"

            result = await EmailService.send("to@example.com", "Test", "<p>Hi</p>")

        assert result is False
        m_smtp.assert_not_called()

    @pytest.mark.asyncio
    async def test_send_falls_back_to_smtp_when_no_resend(self):
        with (
            patch("backend.services.email_service.settings") as mock_settings,
            patch.object(EmailService, "_send_sync", return_value=True) as mock_sync,
        ):
            mock_settings.resend_api_key = ""
            mock_settings.smtp_host = "mail.example.com"
            mock_settings.smtp_user = "user"
            mock_settings.smtp_password = "pass"

            result = await EmailService.send("to@example.com", "Test", "<p>Hi</p>")

        assert result is True
        mock_sync.assert_called_once_with(
            "to@example.com", "Test", "<p>Hi</p>", text_body="Hi", extra_headers={}
        )

    @pytest.mark.asyncio
    async def test_send_returns_false_when_no_transport(self):
        with patch("backend.services.email_service.settings") as mock_settings:
            mock_settings.resend_api_key = ""
            mock_settings.smtp_host = ""
            mock_settings.smtp_user = ""
            mock_settings.smtp_password = ""
            result = await EmailService.send("to@example.com", "Test", "<p>Hi</p>")
            assert result is False


class TestEmailServiceLogging:
    """Verify logging output for email operations."""

    @pytest.mark.asyncio
    async def test_resend_success_logs_info(self, mock_httpx_client, caplog):
        _, mock_instance = mock_httpx_client
        mock_instance.post.return_value = _mock_response(
            status=200, json_data={"id": "msg-9"}, text='{"id":"msg-9"}'
        )
        with patch("backend.services.email_service.settings") as mock_settings:
            mock_settings.resend_api_key = "re_test"
            mock_settings.smtp_from = "Test <test@example.com>"
            with caplog.at_level(logging.INFO, logger="backend.services.email_service"):
                await EmailService._send_via_resend("to@example.com", "Test Subject", "<h1>Hi</h1>")

        info_records = [r for r in caplog.records if r.levelno == logging.INFO]
        assert len(info_records) >= 1
        record = info_records[0]
        assert record.recipient == "to@example.com"
        assert "subject_preview" in record.__dict__
        # PII check: recipient must not leak into the message string.
        assert "to@example.com" not in record.message

    @patch("backend.services.email_service.smtplib.SMTP_SSL")
    @patch("backend.services.email_service.settings")
    def test_smtp_error_logs_exception(self, mock_settings, mock_smtp_class, caplog):
        import smtplib

        mock_settings.smtp_host = "mail.example.com"
        mock_settings.smtp_port = 465
        mock_settings.smtp_user = "user"
        mock_settings.smtp_password = "pass"
        mock_settings.smtp_from = "Test <test@example.com>"

        mock_smtp_class.side_effect = smtplib.SMTPException("Auth failed")

        with caplog.at_level(logging.ERROR, logger="backend.services.email_service"):
            EmailService._send_sync("to@example.com", "Test", "<p>Hi</p>")

        error_records = [r for r in caplog.records if r.levelno == logging.ERROR]
        assert len(error_records) >= 1
        record = error_records[0]
        # PII check: recipient should be in extra, NOT in the message string
        assert "to@example.com" not in record.message
        assert record.recipient == "to@example.com"

    @pytest.mark.asyncio
    async def test_no_transport_logs_warning(self, caplog):
        with patch("backend.services.email_service.settings") as mock_settings:
            mock_settings.resend_api_key = ""
            mock_settings.smtp_host = ""
            mock_settings.smtp_user = ""
            mock_settings.smtp_password = ""

            with caplog.at_level(logging.WARNING, logger="backend.services.email_service"):
                await EmailService.send("to@example.com", "Test", "<p>Hi</p>")

        warning_records = [r for r in caplog.records if r.levelno == logging.WARNING]
        assert len(warning_records) >= 1
        assert warning_records[0].recipient == "to@example.com"


# ── Send log ──────────────────────────────────────────────────────────────
#
# Finding B15 / handoff item 25. Resend is send-only: there is no list to look
# at there, and the backend kept nothing but a log line, which rotates. "I did
# not get the mail" was therefore not hard to answer but IMPOSSIBLE to answer —
# there was no place the answer could have been (migration 291).


class TestEmailLog:
    @staticmethod
    def _admin() -> tuple[MagicMock, MagicMock]:
        table = MagicMock()
        table.insert = MagicMock(return_value=table)
        table.execute = AsyncMock(return_value=MagicMock(data=[{"id": "row"}]))
        admin = MagicMock()
        admin.table = MagicMock(return_value=table)
        return admin, table

    @pytest.mark.asyncio
    async def test_a_successful_send_is_recorded(self):
        from backend.services.email_service import MailRecord

        admin, table = self._admin()
        with (
            patch("backend.services.email_service.settings") as mock_settings,
            patch.object(EmailService, "_send_via_resend", new=AsyncMock(return_value=True)),
            patch(
                "backend.services.email_service.get_admin_supabase_client",
                new=AsyncMock(return_value=admin),
            ),
        ):
            mock_settings.resend_api_key = "re_test"
            await EmailService.send(
                "to@example.com", "Subject", "<p>Hi</p>",
                record=MailRecord(template="cycle_briefing", user_id="u1", epoch_id="e1", cycle_number=7),
            )

        row = table.insert.call_args.args[0]
        assert row["ok"] is True
        assert row["template"] == "cycle_briefing"
        assert row["recipient_user_id"] == "u1"
        assert row["cycle_number"] == 7
        assert row["transport"] == "resend"

    @pytest.mark.asyncio
    async def test_a_failed_send_is_recorded_too(self):
        """The failure IS the answer to "I got nothing", not the absence of one."""
        from backend.services.email_service import MailRecord

        admin, table = self._admin()
        with (
            patch("backend.services.email_service.settings") as mock_settings,
            patch.object(EmailService, "_send_via_resend", new=AsyncMock(return_value=False)),
            patch(
                "backend.services.email_service.get_admin_supabase_client",
                new=AsyncMock(return_value=admin),
            ),
        ):
            mock_settings.resend_api_key = "re_test"
            result = await EmailService.send(
                "to@example.com", "Subject", "<p>Hi</p>", record=MailRecord(template="epoch_invitation")
            )

        assert result is False
        assert table.insert.call_args.args[0]["ok"] is False

    @pytest.mark.asyncio
    async def test_no_transport_is_recorded_as_such(self):
        """Otherwise a misconfigured deployment looks like an empty inbox."""
        from backend.services.email_service import MailRecord

        admin, table = self._admin()
        with (
            patch("backend.services.email_service.settings") as mock_settings,
            patch(
                "backend.services.email_service.get_admin_supabase_client",
                new=AsyncMock(return_value=admin),
            ),
        ):
            mock_settings.resend_api_key = ""
            mock_settings.smtp_host = ""
            await EmailService.send(
                "to@example.com", "Subject", "<p>Hi</p>", record=MailRecord(template="phase_change")
            )

        row = table.insert.call_args.args[0]
        assert row["transport"] == "none"
        assert row["error"] == "no transport configured"

    @pytest.mark.asyncio
    async def test_a_broken_log_does_not_cost_the_send(self):
        """The mail already left. Recording it is bookkeeping, not the deed."""
        from backend.services.email_service import MailRecord

        with (
            patch("backend.services.email_service.settings") as mock_settings,
            patch.object(EmailService, "_send_via_resend", new=AsyncMock(return_value=True)),
            patch(
                "backend.services.email_service.get_admin_supabase_client",
                new=AsyncMock(side_effect=OSError("db down")),
            ),
            patch("backend.services.email_service.sentry_sdk"),
        ):
            mock_settings.resend_api_key = "re_test"
            result = await EmailService.send(
                "to@example.com", "Subject", "<p>Hi</p>", record=MailRecord(template="cycle_briefing")
            )

        assert result is True

    def test_every_send_call_site_labels_its_mail(self):
        """An unlabelled row answers "did anything go out" but not "did the
        SITREP go out", and the second question is the one people ask.

        Measured by AST over the services: every EmailService.send call passes
        a `record=`. A new send that forgets one turns this red.
        """
        import ast
        import pathlib

        root = pathlib.Path(__file__).resolve().parents[2] / "services"
        unlabelled: list[str] = []
        for path in sorted(root.rglob("*.py")):
            tree = ast.parse(path.read_text())
            for node in ast.walk(tree):
                if (
                    isinstance(node, ast.Call)
                    and isinstance(node.func, ast.Attribute)
                    and node.func.attr == "send"
                    and isinstance(node.func.value, ast.Name)
                    and node.func.value.id == "EmailService"
                ):
                    if not any(kw.arg == "record" for kw in node.keywords):
                        unlabelled.append(f"{path.name}:{node.lineno}")

        assert not unlabelled, f"EmailService.send without a record=: {unlabelled}"
