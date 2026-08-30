"""One-click unsubscribe: tokens, headers, and the GET/POST asymmetry.

Handoff P0.3 and P0.4. Gmail and Yahoo have required one-click unsubscription
from bulk senders since 2024 (RFC 8058); the platform had none — the footer's
only link pointed at a route that does not exist.

The sharpest thing to guard here is not the crypto but the VERB. Corporate mail
security (Safe Links, Proofpoint, Barracuda) pre-fetches every link in an
incoming message. A ``GET`` that unsubscribed on sight would silently remove
readers who never touched the mail, and the symptom would look exactly like a
preference bug.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from backend.services.email_service import EmailService
from backend.services.email_templates import html_to_text
from backend.utils.unsubscribe_tokens import mint_token, unsubscribe_url, verify_token

USER_ID = str(uuid4())


class TestTokens:
    def test_round_trip(self):
        token = mint_token(USER_ID, "cycle_resolved")
        assert token is not None
        assert verify_token(token) == (USER_ID, "cycle_resolved")

    def test_a_tampered_payload_is_rejected(self):
        token = mint_token(USER_ID, "cycle_resolved")
        payload, _, signature = token.partition(".")
        forged = mint_token(str(uuid4()), "all").partition(".")[0]
        assert verify_token(f"{forged}.{signature}") is None

    def test_a_tampered_signature_is_rejected(self):
        token = mint_token(USER_ID, "all")
        assert verify_token(token[:-1] + ("a" if token[-1] != "a" else "b")) is None

    def test_garbage_is_rejected_without_raising(self):
        for junk in ("", ".", "abc", "abc.def", "a.b.c"):
            assert verify_token(junk) is None

    def test_an_unknown_category_cannot_be_minted(self):
        """The category becomes a column name downstream — it may not be free text."""
        with pytest.raises(ValueError, match="Unknown unsubscribe category"):
            mint_token(USER_ID, "everything_forever")

    def test_the_token_names_one_category_not_all_of_them(self):
        """A reader done with cycle briefings may still want the closing report."""
        assert verify_token(mint_token(USER_ID, "cycle_resolved"))[1] == "cycle_resolved"
        assert verify_token(mint_token(USER_ID, "all"))[1] == "all"

    def test_url_points_at_the_api(self):
        url = unsubscribe_url(USER_ID, "phase_changed")
        assert "/api/v1/unsubscribe?token=" in url


class TestHeaders:
    @pytest.mark.asyncio
    async def test_bulk_mail_carries_both_rfc_8058_headers(self):
        """One header alone is inert: ``List-Unsubscribe-Post`` is what promotes
        the link to the client's own button."""
        with (
            patch("backend.services.email_service.settings") as mock_settings,
            patch.object(EmailService, "_send_via_resend", new=AsyncMock(return_value=True)) as send,
        ):
            mock_settings.resend_api_key = "re_test"
            await EmailService.send(
                "to@example.com", "Subject", "<p>Hi</p>",
                unsubscribe_url="https://metaverse.center/api/v1/unsubscribe?token=t",
            )

        headers = send.await_args.kwargs["extra_headers"]
        assert headers["List-Unsubscribe"] == "<https://metaverse.center/api/v1/unsubscribe?token=t>"
        assert headers["List-Unsubscribe-Post"] == "List-Unsubscribe=One-Click"

    @pytest.mark.asyncio
    async def test_transactional_mail_carries_no_opt_out(self):
        """A clearance decision or a password reset is not bulk mail."""
        with (
            patch("backend.services.email_service.settings") as mock_settings,
            patch.object(EmailService, "_send_via_resend", new=AsyncMock(return_value=True)) as send,
        ):
            mock_settings.resend_api_key = "re_test"
            await EmailService.send("to@example.com", "Subject", "<p>Hi</p>")

        assert send.await_args.kwargs["extra_headers"] == {}

    @pytest.mark.asyncio
    async def test_a_text_part_is_always_produced(self):
        with (
            patch("backend.services.email_service.settings") as mock_settings,
            patch.object(EmailService, "_send_via_resend", new=AsyncMock(return_value=True)) as send,
        ):
            mock_settings.resend_api_key = "re_test"
            await EmailService.send("to@example.com", "Subject", "<p>Hello <b>there</b></p>")

        assert send.await_args.kwargs["text_body"] == "Hello there"


class TestHtmlToText:
    def test_style_blocks_do_not_leak_into_the_body(self):
        """A text part that opens with a wall of CSS reads as spam to the filter
        and to the human."""
        text = html_to_text("<html><head><style>body { color: red; }</style></head><body><p>Hi</p></body></html>")
        assert "color: red" not in text
        assert text == "Hi"

    def test_links_carry_their_target(self):
        text = html_to_text('<p>Go <a href="https://example.com/x">here</a></p>')
        assert text == "Go here (https://example.com/x)"

    def test_a_self_describing_link_is_not_printed_twice(self):
        text = html_to_text('<a href="https://example.com">https://example.com</a>')
        assert text == "https://example.com"

    def test_hidden_content_is_skipped(self):
        text = html_to_text('<div style="display:none;max-height:0;">preheader</div><p>Body</p>')
        assert "preheader" not in text
        assert text == "Body"

    def test_table_rows_become_lines(self):
        text = html_to_text("<table><tr><td>Rank</td></tr><tr><td>2 of 4</td></tr></table>")
        assert text.splitlines() == ["Rank", "2 of 4"]

    def test_entities_are_decoded(self):
        assert html_to_text("<p>Impressum &amp; Datenschutz</p>") == "Impressum & Datenschutz"


class TestEndpointVerbs:
    """The GET must not mutate — link scanners fetch it."""

    @pytest.mark.asyncio
    async def test_get_redirects_and_writes_nothing(self):
        from backend.routers.unsubscribe import unsubscribe_landing

        with patch("backend.routers.unsubscribe.get_admin_supabase_client", new=AsyncMock()) as admin:
            response = await unsubscribe_landing(token="whatever")

        assert response.status_code == 303
        assert "/unsubscribe?token=whatever" in response.headers["location"]
        admin.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_post_switches_the_named_category_off(self):
        from backend.routers.unsubscribe import one_click_unsubscribe

        token = mint_token(USER_ID, "cycle_resolved")
        table = MagicMock()
        for method in ("select", "eq", "update", "insert", "maybe_single"):
            setattr(table, method, MagicMock(return_value=table))
        table.execute = AsyncMock(return_value=MagicMock(data={"user_id": USER_ID}))
        admin = MagicMock()
        admin.table = MagicMock(return_value=table)

        with (
            patch("backend.routers.unsubscribe.get_admin_supabase_client", new=AsyncMock(return_value=admin)),
            patch("backend.routers.unsubscribe.AuditService.log_action", new=AsyncMock()) as audit,
        ):
            response = await one_click_unsubscribe(token=token)

        assert response.status_code == 200
        table.update.assert_called_once_with({"cycle_resolved": False})
        audit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_an_invalid_token_changes_nothing(self):
        from fastapi import HTTPException

        from backend.routers.unsubscribe import one_click_unsubscribe

        with patch("backend.routers.unsubscribe.get_admin_supabase_client", new=AsyncMock()) as admin:
            with pytest.raises(HTTPException) as exc:
                await one_click_unsubscribe(token="not-a-real-token")

        assert exc.value.status_code == 400
        admin.assert_not_awaited()
