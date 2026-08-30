"""An invitation must survive a model outage.

E12 of the 2026-08-30 system review. ``create_and_send`` generated the epoch's
invitation lore FIRST — a model round-trip on the first invitation of every
epoch — and did so without any handler. A model outage therefore produced a 500
for the whole request: no invitation row, no token, no mail, and nothing to
retry from. The invitation is what the user asked for; the lore is decoration.

The same call site was independently measured as one of four
``OpenRouterService.generate*`` calls in the backend with no enclosing ``try``
at all.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from backend.services.epoch_invitation_service import _LORE_FALLBACK, EpochInvitationService
from backend.services.external.openrouter import OpenRouterError

EPOCH_ID = uuid4()
INVITER_ID = uuid4()


def _supabase():
    chain = MagicMock()
    for method in ("select", "eq", "single", "limit", "order", "insert", "update"):
        setattr(chain, method, MagicMock(return_value=chain))
    chain.execute = AsyncMock(return_value=MagicMock(data={"name": "The Convergence Protocol"}))
    sb = MagicMock()
    sb.table = MagicMock(return_value=chain)
    return sb


class TestInvitationSurvivesALoreOutage:
    @pytest.mark.asyncio
    async def test_row_is_written_before_the_model_is_asked(self):
        order: list[str] = []

        async def _create(*args, **kwargs):
            order.append("insert")
            return {"invite_token": "tok", "id": str(uuid4())}

        async def _lore(*args, **kwargs):
            order.append("lore")
            return "Some lore."

        with patch.object(EpochInvitationService, "create_invitation", new=AsyncMock(side_effect=_create)), \
             patch.object(EpochInvitationService, "generate_lore", new=AsyncMock(side_effect=_lore)), \
             patch.object(EpochInvitationService, "send_email", new=AsyncMock(return_value=True)):

            await EpochInvitationService.create_and_send(
                _supabase(), EPOCH_ID, INVITER_ID, "a@test.com", 168, "https://x", "en",
            )

        assert order == ["insert", "lore"]

    @pytest.mark.asyncio
    async def test_a_dead_model_still_produces_an_invitation_and_a_mail(self):
        """``OpenRouterError`` is the BASE class the client raises for an API error,
        a failed connection and exhausted retries — catching only its subclasses
        would let exactly those through."""
        send = AsyncMock(return_value=True)

        with patch.object(
            EpochInvitationService, "create_invitation",
            new=AsyncMock(return_value={"invite_token": "tok", "id": str(uuid4())}),
        ), patch.object(
            EpochInvitationService, "generate_lore",
            new=AsyncMock(side_effect=OpenRouterError("Connection failed after 3 attempts")),
        ), patch.object(
            EpochInvitationService, "send_email", new=send,
        ), patch("backend.services.epoch_invitation_service.sentry_sdk"):

            invitation = await EpochInvitationService.create_and_send(
                _supabase(), EPOCH_ID, INVITER_ID, "a@test.com", 168, "https://x", "en",
            )

        assert invitation["email_sent"] is True
        assert send.await_args.kwargs["lore_text"] == _LORE_FALLBACK["en"]

    @pytest.mark.asyncio
    async def test_the_fallback_follows_the_invitee_locale(self):
        send = AsyncMock(return_value=True)

        with patch.object(
            EpochInvitationService, "create_invitation",
            new=AsyncMock(return_value={"invite_token": "tok", "id": str(uuid4())}),
        ), patch.object(
            EpochInvitationService, "generate_lore",
            new=AsyncMock(side_effect=OpenRouterError("All retry attempts exhausted")),
        ), patch.object(
            EpochInvitationService, "send_email", new=send,
        ), patch("backend.services.epoch_invitation_service.sentry_sdk"):

            await EpochInvitationService.create_and_send(
                _supabase(), EPOCH_ID, INVITER_ID, "a@test.com", 168, "https://x", "de",
            )

        assert send.await_args.kwargs["lore_text"] == _LORE_FALLBACK["de"]

    @pytest.mark.asyncio
    async def test_regenerate_still_reports_its_failure(self):
        """The admin action must not silently return a stand-in and look successful."""
        with patch.object(
            EpochInvitationService, "generate_lore",
            new=AsyncMock(side_effect=OpenRouterError("boom")),
        ):
            sb = _supabase()
            with pytest.raises(OpenRouterError):
                await EpochInvitationService.regenerate_lore(sb, EPOCH_ID)
