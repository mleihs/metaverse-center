"""A simulation invitation that nobody was told about.

Finding E3. ``InvitationService.create_invitation`` stored an address and a
token and returned. There was no ``EmailService`` import anywhere near it, so
the invited person was never written to: the invitation existed only as a row,
and the inviter had no way to notice that it had gone nowhere.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from backend.services.invitation_service import InvitationService

SIM_ID = uuid4()
USER_ID = uuid4()


def _client(sim_name: str = "Velgarien") -> MagicMock:
    chain = MagicMock()
    for method in ("select", "eq", "insert", "maybe_single", "limit"):
        setattr(chain, method, MagicMock(return_value=chain))
    chain.execute = AsyncMock(
        side_effect=[
            MagicMock(
                data=[
                    {
                        "id": "inv-1",
                        "simulation_id": str(SIM_ID),
                        "invited_email": "invitee@test.com",
                        "invite_token": "tok",
                        "invited_role": "editor",
                        "expires_at": "2026-09-06T12:00:00Z",
                    }
                ]
            ),
            MagicMock(data={"name": sim_name}),
        ]
    )
    sb = MagicMock()
    sb.table = MagicMock(return_value=chain)
    return sb


class TestInvitationIsDelivered:
    @pytest.mark.asyncio
    async def test_an_email_goes_out(self):
        with patch(
            "backend.services.invitation_service.EmailService.send", new=AsyncMock(return_value=True)
        ) as send:
            result = await InvitationService.create_invitation(
                _client(), SIM_ID, USER_ID,
                invited_email="invitee@test.com", invited_role="editor",
                inviter_label="owner@test.com", email_locale="de",
            )

        assert result["email_sent"] is True
        recipient, subject, html = send.await_args.args
        assert recipient == "invitee@test.com"
        assert "Velgarien" in subject
        assert "owner@test.com" in subject
        # The token must be in the link, or the mail is decoration.
        assert "/invitations/tok" in html

    @pytest.mark.asyncio
    async def test_a_link_only_invitation_writes_to_nobody(self):
        """No address was given; there is no one to write to. Not a failure."""
        chain = MagicMock()
        for method in ("select", "eq", "insert", "maybe_single", "limit"):
            setattr(chain, method, MagicMock(return_value=chain))
        chain.execute = AsyncMock(
            return_value=MagicMock(
                data=[{"id": "inv-1", "simulation_id": str(SIM_ID), "invited_email": None,
                       "invite_token": "tok", "invited_role": "viewer"}]
            )
        )
        sb = MagicMock()
        sb.table = MagicMock(return_value=chain)

        with patch(
            "backend.services.invitation_service.EmailService.send", new=AsyncMock(return_value=True)
        ) as send:
            result = await InvitationService.create_invitation(sb, SIM_ID, USER_ID)

        assert result["email_sent"] is False
        send.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_a_failed_send_does_not_undo_the_invitation(self):
        """The row is the deliverable; the inviter can still copy the link."""
        with (
            patch(
                "backend.services.invitation_service.EmailService.send",
                new=AsyncMock(side_effect=OSError("smtp down")),
            ),
            patch("backend.services.invitation_service.sentry_sdk"),
        ):
            result = await InvitationService.create_invitation(
                _client(), SIM_ID, USER_ID, invited_email="invitee@test.com"
            )

        assert result["id"] == "inv-1"
        assert result["email_sent"] is False

    @pytest.mark.asyncio
    async def test_it_carries_no_unsubscribe_link(self):
        """Someone entered this person's name by hand - there is no list to leave."""
        with patch(
            "backend.services.invitation_service.EmailService.send", new=AsyncMock(return_value=True)
        ) as send:
            await InvitationService.create_invitation(
                _client(), SIM_ID, USER_ID, invited_email="invitee@test.com"
            )

        # Gemeint war immer der LINK, nicht das Wort. Seit P3.28 trägt die
        # Einladungsfußzeile den Satz „Es gibt nichts abzubestellen: Wenn du
        # nichts tust, hörst du nichts weiter von uns." — der nennt das Wort
        # und ist genau der Grund, warum keine Abmeldung nötig ist. Eine
        # Zusicherung auf das Wort hätte diesen Satz verboten und damit die
        # Erklärung, die den Leser beruhigt.
        html = send.await_args.args[2]
        assert "/unsubscribe?token=" not in html, "die Einladung trägt einen Abmeldelink"
        assert "/settings/notifications" not in html, (
            "die Einladung verweist auf Kontoeinstellungen; der Eingeladene hat "
            "vielleicht gar kein Konto"
        )
        assert send.await_args.kwargs.get("unsubscribe_url") is None
