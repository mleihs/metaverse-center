"""The receipt for a deletion — and the order that makes it possible.

Handoff P2.23 / DSGVO Art. 17. Deleting an account sent nothing at all; the
person had no confirmation that it had happened, and no statement of what
survived them.

The whole difficulty is ordering. `admin_delete_user` removes the auth record
too, so the address has to be read BEFORE the RPC — afterwards there is nobody
left to ask. A confirmation gathered afterwards would silently never be sent.
"""

from __future__ import annotations

import ast
import inspect
import textwrap
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from backend.services.admin_user_service import AdminUserService
from backend.services.email_templates import render_account_deleted


class TestTheMailSaysWhatSurvives:
    def test_it_names_the_deletion_as_irreversible(self):
        html = render_account_deleted(email_locale="de")
        assert "nicht rückgängig" in html

    def test_worlds_are_reported_as_transferred_not_deleted(self):
        """`admin_delete_user` hands ownership to the operators. The comfortable
        version of this mail leaves that out; the person has a right to know
        what outlives their account."""
        html = render_account_deleted(email_locale="de", worlds_transferred=3)
        assert "übergegangen" in html
        assert "gelöscht" not in html.split("WAS BLEIBT")[1]

    def test_without_worlds_it_says_so_plainly(self):
        html = render_account_deleted(email_locale="de", worlds_transferred=0)
        assert "keine Welten" in html
        assert "übergegangen" not in html

    def test_there_is_nothing_to_click_but_the_legal_notice(self):
        """A call to action here is the one thing a phishing copy would add."""
        import re

        links = re.findall(r'href="([^"]+)"', render_account_deleted())
        assert links == ["https://metaverse.center/privacy"], links

    def test_it_does_not_link_settings_for_an_account_that_is_gone(self):
        """The shared footer offers "manage all notifications". In this mail
        that is a link to an account that no longer exists."""
        assert "/settings/notifications" not in render_account_deleted()

    def test_it_says_this_kind_of_post_cannot_be_switched_off(self):
        assert "nicht abbestellt werden" in render_account_deleted(email_locale="de")

    @pytest.mark.parametrize("locale", ["de", "en"])
    def test_both_languages_render(self, locale):
        assert len(render_account_deleted(email_locale=locale)) > 1000


class TestTheAddressIsReadBeforeTheAccountIsGone:
    def test_the_contact_is_gathered_before_the_rpc(self):
        """Source order, not behaviour: reading it afterwards returns nothing,
        and the mail would silently never go out."""
        source = textwrap.dedent(inspect.getsource(AdminUserService.delete_user.__func__))
        tree = ast.parse(source)
        calls: list[str] = []
        for node in ast.walk(tree):
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
                if node.func.attr == "_deletion_contact":
                    calls.append(("contact", node.lineno))
                elif node.func.attr == "rpc":
                    calls.append(("rpc", node.lineno))
                elif node.func.attr == "_send_deletion_confirmation":
                    calls.append(("send", node.lineno))
        order = [name for name, _ in sorted(calls, key=lambda pair: pair[1])]
        assert order == ["contact", "rpc", "send"], f"Reihenfolge ist {order}; nach dem RPC gibt es keine Adresse mehr"

    @pytest.mark.asyncio
    async def test_a_failed_deletion_sends_nothing(self):
        """A receipt for something that did not happen is worse than none."""
        from fastapi import HTTPException
        from postgrest.exceptions import APIError as PostgrestAPIError

        sent: list = []

        def _boom(*_a, **_k):
            raise PostgrestAPIError({"message": "nope"})

        supabase = AsyncMock()
        supabase.rpc = _boom
        with (
            patch.object(
                AdminUserService,
                "_deletion_contact",
                AsyncMock(return_value={"email": "a@b.c", "email_locale": "de", "worlds": 0}),
            ),
            patch.object(
                AdminUserService,
                "_send_deletion_confirmation",
                AsyncMock(side_effect=lambda *a, **k: sent.append(a)),
            ),
            pytest.raises(HTTPException),
        ):
            await AdminUserService.delete_user(supabase, uuid4())
        assert sent == []

    @pytest.mark.asyncio
    async def test_no_address_on_file_does_not_break_the_deletion(self):
        """The right to be forgotten outranks the receipt."""
        supabase = AsyncMock()
        supabase.rpc = lambda *a, **k: AsyncMock(execute=AsyncMock(return_value=None))
        with patch.object(AdminUserService, "_deletion_contact", AsyncMock(return_value=None)):
            await AdminUserService._send_deletion_confirmation(supabase, uuid4(), None)
