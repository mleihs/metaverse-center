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

from backend.config import settings
from backend.services.email_service import EmailService, MailRecord
from backend.services.email_templates import (
    continuation_subject,
    render_continuation,
    render_welcome,
    welcome_subject,
)
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

#: Der EIGENE Riegel für die Post aus Wortwechseln (Migration 363).
#:
#: Getrennt von `lifecycle_mail_enabled`, und das ist keine Umständlichkeit:
#: wer die Begrüssungspost anschaltet, hat damit nicht entschieden, dass
#: Agentengespräche in fremde Postfächer gehen. Zwei Entscheidungen, zwei
#: Schalter — und der zweite kann fallen, ohne die Begrüssung mitzunehmen.
_SETTING_CONTINUATION = "continuation_mail_enabled"

#: Mindestabstand zweier Sofortpost-Sendungen an denselben Menschen. Null:
#: „sofort" heisst sofort. Der Deckel liegt woanders — es entsteht nur ein
#: Flüstern je Wortwechsel, und ein Wortwechsel je Faden und Takt.
_CONTINUATION_IMMEDIATE_GAP = timedelta(0)

#: Mindestabstand der Wochenpost. Sechs Tage und nicht sieben: der Lauf
#: startet nur montags, und ein Abstand von genau sieben Tagen fiele bei jeder
#: Verschiebung um Minuten (Neustart, Sommerzeit) auf die nächste Woche.
_CONTINUATION_DIGEST_GAP = timedelta(days=6)

#: An welchem Wochentag die Wochenpost geht. Montag: die Woche liegt vorn,
#: nicht hinten.
_CONTINUATION_DIGEST_WEEKDAY = 0


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
    return {str(row["recipient_user_id"]) for row in extract_list(resp) if row.get("recipient_user_id")}


async def _last_sent_at(admin: Client, template: str, user_ids: list[str]) -> dict[str, datetime]:
    """Wann dieser Vorlage zuletzt an jeden dieser Menschen ging.

    Das WIEDERKEHRENDE Geschwister von :func:`already_mailed`. Beide lesen
    `email_log`, beide sind über den Vorlagennamen geschlüsselt — der
    Unterschied ist die Frage:

    * ``already_mailed`` fragt „überhaupt schon einmal?". Richtig für eine
      Begrüssung: die gibt es genau einmal je Konto.
    * ``_last_sent_at`` fragt „zuletzt wann?". Richtig für alles
      Wiederkehrende. Mit ``already_mailed`` ginge eine Wochenpost genau
      EINMAL hinaus und danach nie wieder — ein Fehler, der sich nur als
      Schweigen zeigt und deshalb monatelang unbemerkt bleiben kann.

    Der Rückgabewert ist zugleich die UNTERGRENZE des nächsten Laufs: was seit
    der letzten Post entstanden ist, gehört in die nächste. Wer noch keine
    bekommen hat, hat keinen Eintrag — und für den greift
    :data:`_BACKLOG_HORIZON`, damit der erste Lauf nicht das Archiv grüsst.

    Nur GELUNGENE Sendungen zählen (``ok = true``). Ein Fehlschlag ist im Log
    sichtbar und eine Sache für einen Menschen; als Untergrenze genommen,
    verschlänge er stillschweigend alles, was er hätte tragen sollen.
    """
    if not user_ids:
        return {}
    resp = await (
        admin.table("email_log")
        .select("recipient_user_id, created_at")
        .eq("template", template)
        .eq("ok", True)
        .in_("recipient_user_id", user_ids)
        .order("created_at", desc=True)
        .execute()
    )
    letzte: dict[str, datetime] = {}
    for row in extract_list(resp):
        uid = str(row.get("recipient_user_id") or "")
        if uid and uid not in letzte and row.get("created_at"):
            letzte[uid] = datetime.fromisoformat(row["created_at"])
    return letzte


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


async def _sweep_continuation_immediate(admin: Client, now: datetime) -> int:
    """Post über Wortwechsel, deren Faden auf ``immediate`` steht.

    Der Weg vom Flüstern zur Post ist absichtlich EINSEITIG: die Phase
    schreibt Flüstern, dieser Sweep liest sie. Würde die Phase selbst Mail
    versenden, hinge ein Versand an einem Herzschlag-Tick, und ein Fehlschlag
    dort kostete den ganzen Tick.

    Untergrenze: die letzte gelungene Sendung dieser Vorlage an diesen
    Menschen, und beim ersten Mal :data:`_BACKLOG_HORIZON`.
    """
    letzte = await _last_sent_at(admin, "continuation_immediate", await _candidates(admin))
    return await _send_continuation(
        admin,
        now,
        template="continuation_immediate",
        notify="immediate",
        letzte_sendung=letzte,
        erste_untergrenze=now - _BACKLOG_HORIZON,
        mindestabstand=_CONTINUATION_IMMEDIATE_GAP,
    )


async def _sweep_continuation_digest(admin: Client, now: datetime) -> int:
    """Die Wochenpost für Fäden, die auf ``digest`` stehen.

    ⚠ **Der Plan setzt eine Wochenpost voraus, die es nicht gab.** Er sagt für
    ``digest``: „Abschnitt in der Wochenpost". Gemessen: ``SWEEPS`` kannte
    genau einen Eintrag (``welcome``), und der Modulkopf nennt die Wochenpost
    seit jeher als *geplant*. Ohne diesen Sweep wäre ``digest`` — der
    VORGABEWERT der Spalte aus 357 — eine Zustellart, die nichts zustellt.

    Das ist also nicht die Wochenpost mit allem, was einmal hineingehört,
    sondern ihr Gesprächs-Abschnitt, der allein steht, bis der Rest existiert.
    Der Name sagt das (``continuation_digest``, nicht ``weekly``), damit der
    nächste, der die Wochenpost baut, nicht glaubt, sie sei schon da.

    Untergrenze wie bei der Sofortpost: die letzte gelungene Sendung, beim
    ersten Mal :data:`_BACKLOG_HORIZON`. EIN FESTES SIEBEN-TAGE-FENSTER WÄRE
    HIER FALSCH — es verstiesse gegen die Zusage des Moduls, dass kein Lauf
    weiter zurücksieht als der Horizont, und der erste Lauf nach dem Ausrollen
    grüsste eine Woche Archiv.
    """
    letzte = await _last_sent_at(admin, "continuation_digest", await _candidates(admin))
    return await _send_continuation(
        admin,
        now,
        template="continuation_digest",
        notify="digest",
        letzte_sendung=letzte,
        erste_untergrenze=now - _BACKLOG_HORIZON,
        mindestabstand=_CONTINUATION_DIGEST_GAP,
    )


async def _candidates(admin: Client) -> list[str]:
    """Wer überhaupt eine Bindung hat, und damit ein Flüstern bekommen kann.

    Vorgeschaltet, damit :func:`_last_sent_at` nicht über die ganze
    Nutzerschaft fragt. Ohne Bindung entsteht kein Flüstern vom Typ
    ``conversation`` (siehe `ContinuationService._whisper`), also kann auch
    keine Post daraus werden.
    """
    resp = await admin.table("agent_bonds").select("user_id").neq("status", "farewell").execute()
    return sorted({str(row["user_id"]) for row in extract_list(resp) if row.get("user_id")})


async def _send_continuation(
    admin: Client,
    now: datetime,
    *,
    template: str,
    notify: str,
    letzte_sendung: dict[str, datetime],
    erste_untergrenze: datetime,
    mindestabstand: timedelta,
) -> int:
    """Der gemeinsame Rumpf beider Wortwechsel-Sweeps.

    Er bekommt die Untergrenze und den Vorlagennamen HEREINGEREICHT, statt sie
    zu kennen: derselbe Name geht in die Abfrage der letzten Sendung UND in
    den Eintrag beim Versand, und wenn er nur an einer Stelle steht, können
    die beiden nicht auseinanderlaufen. Genau das ist der Fehler, gegen den
    `test_every_sweep_writes_the_template_it_is_keyed_by` gebaut ist — hier
    ist er baulich ausgeschlossen statt geprüft.
    """
    if not await _continuation_mail_armed(admin):
        return 0

    aelteste = min([*letzte_sendung.values(), erste_untergrenze], default=erste_untergrenze)
    resp = await (
        admin.table("bond_whispers")
        .select("id, bond_id, content_de, content_en, trigger_context, created_at, agent_bonds(user_id, agents(name))")
        .eq("whisper_type", "conversation")
        .gte("created_at", aelteste.isoformat())
        .order("created_at")
        .execute()
    )

    je_nutzer: dict[str, list[dict]] = {}
    for row in extract_list(resp):
        kontext = row.get("trigger_context") or {}
        if kontext.get("notify") != notify:
            continue
        bond = row.get("agent_bonds") or {}
        if isinstance(bond, list):
            bond = bond[0] if bond else {}
        user_id = str(bond.get("user_id") or "")
        if not user_id:
            continue
        # Je Mensch die EIGENE Untergrenze: was vor seiner letzten Post
        # entstanden ist, hat er schon gelesen.
        grenze = letzte_sendung.get(user_id, erste_untergrenze)
        if datetime.fromisoformat(row["created_at"]) <= grenze:
            continue
        if now - grenze < mindestabstand:
            continue
        row["_agent_name"] = ((bond.get("agents") or {}) or {}).get("name") or "?"
        je_nutzer.setdefault(user_id, []).append(row)

    if not je_nutzer:
        return 0

    adressen = await _emails_for(admin, list(je_nutzer))
    locales = await _locales_for(admin, list(je_nutzer))
    base = settings.site_url.rstrip("/")

    sent = 0
    for user_id, rows in je_nutzer.items():
        adresse = adressen.get(user_id)
        if not adresse:
            continue
        locale = locales.get(user_id)
        items = [
            {
                "title": str(row["_agent_name"]),
                "excerpt": (row["content_de"] if (locale or "en").startswith("de") else row["content_en"]),
                "url": f"{base}/chat?conversation={(row.get('trigger_context') or {}).get('conversation_id', '')}",
            }
            for row in rows
        ]
        ok = await EmailService.send(
            adresse,
            continuation_subject(len(items), locale),
            render_continuation(items, email_locale=locale),
            record=MailRecord(template=template, user_id=user_id),
        )
        if ok:
            sent += 1
    return sent


async def _continuation_mail_armed(admin: Client) -> bool:
    """Der eigene Riegel, fail-closed. Fehlt die Zeile, geht keine Post."""
    resp = await (
        admin.table("platform_settings").select("setting_value").eq("setting_key", _SETTING_CONTINUATION).execute()
    )
    rows = extract_list(resp)
    return parse_setting_bool(rows[0]["setting_value"]) if rows else False


async def _emails_for(admin: Client, user_ids: list[str]) -> dict[str, str]:
    if not user_ids:
        return {}
    resp = await (
        admin.table("user_profiles").select("id, email").in_("id", user_ids).not_.is_("email", "null").execute()
    )
    return {str(row["id"]): row["email"] for row in extract_list(resp) if row.get("email")}


async def _locales_for(admin: Client, user_ids: list[str]) -> dict[str, str]:
    """Read each recipient's chosen mail language.

    A missing row means the person never opened the notification settings, not
    that they want English; the renderer's own default decides then, so the key
    is simply absent rather than filled in with a guess here.
    """
    if not user_ids:
        return {}
    resp = await (
        admin.table("notification_preferences").select("user_id, email_locale").in_("user_id", user_ids).execute()
    )
    return {str(row["user_id"]): row["email_locale"] for row in extract_list(resp) if row.get("email_locale")}


#: Every sweep in this module, by the `email_log` template it writes.
#: The template name is the key of its own idempotency, so it is named once
#: here and once at the send; a mismatch between the two would make a sweep
#: repeat forever, which is why the module's test asserts they agree.
SWEEPS: dict[str, Callable[[Client, datetime], Awaitable[int]]] = {
    "welcome": _sweep_welcome,
    "continuation_immediate": _sweep_continuation_immediate,
    "continuation_digest": _sweep_continuation_digest,
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
