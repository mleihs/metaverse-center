"""Outbound mail that follows a person's own lifecycle, not the game's.

The game's own post has a home already: `EpochCycleScheduler` writes when a
cycle resolves, a phase changes, a deadline nears. What had no home at all was
mail that follows the READER — signing up, being invited, a week going by.
Registering produced no message of any kind (Handoff P2.21).

Why one scheduler instead of one per message
--------------------------------------------
Three planned sweeps (welcome, the weekly digest, the invitation follow-up)
need the same two guards, and only one of them is obvious:

1. **Idempotency.** `email_log` (migration 291) already answers "did this go
   out"; :func:`already_mailed` is the one way to ask.
2. **A LOWER bound on the window.** This is the one a new sweep forgets. A
   sweep running for the first time sees the entire existing population as
   "new". Without a lower bound the first tick after deploy greets everybody
   who ever registered — and mail cannot be recalled. On the day this was
   written that would have been 10 people who joined months ago.

Putting both in one place means the next sweep cannot omit the second one by
simply not thinking of it. That is the whole argument for the shared home.

Failure containment mirrors the epoch sweep: one sweep's failure is swallowed
per sweep, because a welcome that cannot be sent must never stop the digest in
the same tick.
"""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta

import httpx
import sentry_sdk
from postgrest.exceptions import APIError as PostgrestAPIError

from backend.services.email_service import EmailService, MailRecord
from backend.services.email_templates import render_welcome, welcome_subject
from backend.services.social.scheduler_base import BaseSchedulerMixin
from backend.utils.responses import extract_list
from backend.utils.settings import parse_setting_bool
from supabase import AsyncClient as Client

logger = logging.getLogger(__name__)

#: Five minutes. The finest thing scheduled here is "30 minutes after signing
#: up"; a tighter tick would only add load to arrive at the same minute.
_TICK_SECONDS = 300

#: How far back any lifecycle sweep may look. THE guard of this module.
#:
#: A first run must not mistake the existing population for new arrivals.
#: 24 hours is chosen so that the first tick after any deploy finds nobody who
#: was already there (the newest account on the day this was written was over
#: a month old), while still covering a normal backend restart. The cost of the
#: bound is that a signup missed during an outage longer than a day gets no
#: welcome; the cost of omitting it is a mass mailing that cannot be taken back.
#: That trade is not close.
_BACKLOG_HORIZON = timedelta(hours=24)

#: How long after signing up the welcome goes out. Not instant on purpose: it
#: would race the GoTrue confirmation mail into the same inbox second and the
#: two would compete for the same attention.
_WELCOME_DELAY = timedelta(minutes=30)

_SETTING_ENABLED = "lifecycle_mail_enabled"


async def already_mailed(admin: Client, template: str, user_ids: list[str]) -> set[str]:
    """Return the subset of ``user_ids`` that already has a row for ``template``.

    Reads `email_log`, which records EVERY attempt including failures. That is
    deliberate: a send that failed is an answer, and retrying it every five
    minutes forever would turn one bad address into a permanent loop against
    the mail provider. A failure is visible in the log and is a matter for a
    person, not for the sweep.
    """
    if not user_ids:
        return set()
    resp = await (
        admin.table("email_log")
        .select("recipient_user_id")
        .eq("template", template)
        .in_("recipient_user_id", user_ids)
        .execute()
    )
    return {
        str(row["recipient_user_id"])
        for row in extract_list(resp)
        if row.get("recipient_user_id")
    }


async def _sweep_welcome(admin: Client, now: datetime) -> int:
    """Greet accounts created between the horizon and the welcome delay ago.

    Returns the number of messages that went out.
    """
    newest = now - _WELCOME_DELAY
    oldest = now - _BACKLOG_HORIZON

    resp = await (
        admin.table("user_profiles")
        .select("id, email, created_at")
        .gte("created_at", oldest.isoformat())
        .lte("created_at", newest.isoformat())
        .not_.is_("email", "null")
        .execute()
    )
    candidates = [row for row in extract_list(resp) if row.get("email")]
    if not candidates:
        return 0

    seen = await already_mailed(admin, "welcome", [str(row["id"]) for row in candidates])
    pending = [row for row in candidates if str(row["id"]) not in seen]
    if not pending:
        return 0

    locales = await _locales_for(admin, [str(row["id"]) for row in pending])

    sent = 0
    for row in pending:
        user_id = str(row["id"])
        locale = locales.get(user_id)
        ok = await EmailService.send(
            row["email"],
            welcome_subject(locale),
            render_welcome(email_locale=locale),
            record=MailRecord(template="welcome", user_id=user_id),
        )
        if ok:
            sent += 1
    return sent


async def _locales_for(admin: Client, user_ids: list[str]) -> dict[str, str]:
    """Read each recipient's chosen mail language.

    A missing row means the person never opened the notification settings, not
    that they want English; the renderer's own default decides then, so the key
    is simply absent rather than filled in with a guess here.
    """
    if not user_ids:
        return {}
    resp = await (
        admin.table("notification_preferences")
        .select("user_id, email_locale")
        .in_("user_id", user_ids)
        .execute()
    )
    return {
        str(row["user_id"]): row["email_locale"]
        for row in extract_list(resp)
        if row.get("email_locale")
    }


#: Every sweep in this module, by the `email_log` template it writes.
#: The template name is the key of its own idempotency, so it is named once
#: here and once at the send; a mismatch between the two would make a sweep
#: repeat forever, which is why the module's test asserts they agree.
SWEEPS: dict[str, Callable[[Client, datetime], Awaitable[int]]] = {
    "welcome": _sweep_welcome,
}


class LifecycleMailScheduler(BaseSchedulerMixin):
    """Runs every lifecycle mail sweep on one tick, isolating their failures."""

    _scheduler_name = "lifecycle_mail"

    @classmethod
    async def _load_config(cls, admin: Client) -> dict:
        """Read the kill switch.

        Fail-closed like every other `*_enabled` gate: an absent or malformed
        value leaves the sweeps off. For mail that is the right direction of
        failure — a gate that silently ARMS a mailing is worse than one that
        silently withholds it.
        """
        resp = await (
            admin.table("platform_settings")
            .select("setting_key, setting_value")
            .eq("setting_key", _SETTING_ENABLED)
            .execute()
        )
        rows = extract_list(resp)
        enabled = parse_setting_bool(rows[0]["setting_value"]) if rows else False
        return {"enabled": enabled, "interval": _TICK_SECONDS}

    @classmethod
    async def _process_tick(cls, admin: Client, config: dict) -> None:
        """Run each sweep; a failing one must not cost the others their tick."""
        now = datetime.now(UTC)
        for name, sweep in SWEEPS.items():
            try:
                sent = await sweep(admin, now)
                if sent:
                    logger.info(
                        "Lifecycle mail sweep %s sent %d message(s)",
                        name,
                        sent,
                        extra={"sweep": name, "sent": sent},
                    )
            except (PostgrestAPIError, httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
                logger.exception("Lifecycle mail sweep %s failed", name, extra={"sweep": name})
                with sentry_sdk.push_scope() as scope:
                    scope.set_tag("lifecycle_mail_sweep", name)
                    sentry_sdk.capture_exception(exc)
