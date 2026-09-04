"""Ein Beispieldatensatz je Mailvorlage — für Vorschau, Testversand und Tests.

WARUM DAS EINE DATEI IST (Handoff P3.27)
----------------------------------------
Die Beispieldaten lagen in ``scripts/send_test_emails.py``, also an einem Ort,
den nur ein Mensch mit SMTP-Zugang erreicht. Wer eine Vorlage ändert, sieht das
Ergebnis erst nach einem echten Versand an eine echte Adresse — und weil das
umständlich ist, sieht man es meist gar nicht.

Dieselben Daten speisen jetzt drei Verbraucher:

* ``backend/routers/email_preview.py`` — die Admin-Vorschau, ohne Versand
* ``scripts/send_test_emails.py`` — der Versand zur Ansicht im Postfach
* ``backend/tests/unit/test_email_template_properties.py`` — die Eigenschaften,
  die jede Vorlage erfüllen muss

Drei Verbraucher, ein Datensatz. Vorher hätte eine neue Vorlage in einer Datei
auftauchen können, die niemand ausführt; jetzt fällt sie durch den Test auf,
der die Vollständigkeit dieses Registers gegen ``email_templates`` prüft.

WAS EIN FIXTURE ZEIGEN MUSS
---------------------------
Nicht den leichtesten Fall, sondern den, der am ehesten bricht: lange Namen,
gefüllte Listen, gesetzte Sonderfälle. Eine Vorschau, die nur den kurzen Fall
zeigt, ist eine Vorschau auf ein Problem, das man nicht hat.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

from backend.services.email_templates import (
    continuation_subject,
    epoch_invitation_subject,
    render_account_deleted,
    render_clearance_denied,
    render_clearance_granted,
    render_clearance_request_admin_notification,
    render_continuation,
    render_cycle_briefing,
    render_deadline_reminder,
    render_epoch_completed,
    render_epoch_invitation,
    render_phase_change,
    render_simulation_invitation,
    render_welcome,
    simulation_invitation_subject,
)

_INVITE_URL = "https://metaverse.center/epoch/join?token=preview-token"
_CTA_URL = "https://metaverse.center/epoch/command-center"
_UNSUB = "https://metaverse.center/api/v1/unsubscribe?token=preview-token"


@dataclass(frozen=True)
class EmailFixture:
    """One renderable example of a template.

    ``key`` is the URL segment of the preview route and the id in test output.
    ``unsubscribable`` records whether this mail may carry a List-Unsubscribe
    header at all — security and account mails must NOT, and the property test
    asserts both directions rather than only the presence.
    """

    key: str
    label: str
    subject: Callable[[str], str]
    render: Callable[[str], str]
    unsubscribable: bool = True
    #: A mail whose recipient may have no account yet, so its footer must not
    #: link to account settings. Measured by the parallel session, 31.08.2026.
    accountless_recipient: bool = False


def _cycle_briefing_data() -> dict:
    """The richest of the eleven fixtures, and on purpose.

    Every optional block of the cycle briefing is filled: rank gap, alliance,
    spy intel, threats, public events, next-cycle projection. A preview that
    only shows the sparse case is a preview of a problem nobody has — the
    layouts that break are the full ones.
    """
    return {
        "epoch_name": "Operation Crimson Tide",
        "epoch_status": "competition",
        "cycle_number": 3,
        "rank": 2,
        "prev_rank": 3,
        "total_players": 5,
        "composite": 78.4,
        "composite_delta": 5.2,
        "dimensions": [
            {"name": "stability", "value": 82.1, "delta": 3.0},
            {"name": "influence", "value": 71.5, "delta": -2.4},
            {"name": "sovereignty", "value": 88.0, "delta": 8.1},
            {"name": "diplomatic", "value": 65.3, "delta": 4.5},
            {"name": "military", "value": 85.1, "delta": 12.8},
        ],
        "rp_balance": 45,
        "rp_cap": 100,
        "active_ops": 3,
        "resolved_ops": 7,
        "success_ops": 5,
        "detected_ops": 1,
        "guardians": 2,
        "counter_intel": 1,
        "public_events": [
            {"narrative": "Ein Beben ging durch das Marktviertel und warf drei Stände um."},
            {"narrative": "Die Botschafterin von Speranza hielt eine scharfe Rede vor der Großen Versammlung."},
            {"narrative": "Über dem Hafenviertel wurden um Mitternacht fremde Lichter gesehen."},
        ],
        "simulation_name": "Velgarien",
        "command_center_url": _CTA_URL,
        "accent_color": "#ff6b2b",
        "simulation_slug": "velgarien",
        "threats": [
            {"type": "saboteur", "source": "The Gaslit Reach", "target_zone": "Marktviertel", "detected": True},
            {"type": "spy", "source": "Station Null", "target_zone": "Hafenviertel", "detected": False},
        ],
        "spy_intel": [
            {"target_sim": "Speranza", "zone": "Altstadt", "security": "medium", "guardians": 1},
        ],
        "missions": [
            {"type": "spy", "target_sim": "The Gaslit Reach", "success": True, "detected": False},
            {"type": "saboteur", "target_sim": "Station Null", "success": True, "detected": True},
            {"type": "propagandist", "target_sim": "Speranza", "success": False, "detected": False},
        ],
        "rank_gap": {"ahead_name": "Station Null", "ahead_score": 82.1, "gap": 3.7},
        "next_cycle_missions": 2,
        "next_cycle_rp_projection": 55,
        "alliance_name": "Der Nordpakt",
        "ally_names": ["Speranza"],
        "alliance_bonus_active": True,
        "has_threat_data": True,
    }


def _leaderboard() -> list[dict]:
    return [
        {"simulation_id": "sim-1", "simulation_name": "Station Null", "composite": 171.0, "rank": 1},
        {"simulation_id": "sim-2", "simulation_name": "Velgarien", "composite": 148.5, "rank": 2},
        {"simulation_id": "sim-3", "simulation_name": "The Gaslit Reach", "composite": 121.0, "rank": 3},
    ]


FIXTURES: tuple[EmailFixture, ...] = (
    EmailFixture(
        key="simulation-invitation",
        label="Einladung in eine Welt",
        subject=lambda lang: simulation_invitation_subject("Velgarien", "Kartograph Vance", lang),
        render=lambda lang: render_simulation_invitation(
            simulation_name="Velgarien",
            inviter="Kartograph Vance",
            invite_url=_INVITE_URL,
            invited_role="editor",
            expires_at="2026-09-07T12:00:00+00:00",
            email_locale=lang,
        ),
        unsubscribable=False,
        accountless_recipient=True,
    ),
    EmailFixture(
        key="epoch-invitation",
        label="Einladung in eine Epoche",
        subject=lambda lang: epoch_invitation_subject("Operation Crimson Tide", lang),
        render=lambda lang: render_epoch_invitation(
            epoch_name="Operation Crimson Tide",
            lore_text=(
                "Das Substrat zittert. Über die zersprungenen Ebenen des Multiversums hinweg "
                "ist ein neuer Zusammenlauf gemessen worden – ein Knoten von einer Wucht, wie "
                "sie bisher nicht verzeichnet wurde. Das Bureau of Impossible Geography ruft "
                "alle geeigneten Betreiber zusammen."
            ),
            invite_url=_INVITE_URL,
            email_locale=lang,
            accent_color="#ff6b2b",
            cycle_hours=8,
        ),
        unsubscribable=False,
        accountless_recipient=True,
    ),
    EmailFixture(
        key="cycle-briefing",
        label="Zyklus-Lagebericht",
        subject=lambda lang: "Zyklus 3 aufgelöst – Operation Crimson Tide",
        render=lambda lang: render_cycle_briefing(
            data=_cycle_briefing_data(), email_locale=lang, unsubscribe_url=_UNSUB
        ),
    ),
    EmailFixture(
        key="phase-change",
        label="Phasenwechsel",
        subject=lambda lang: "Phasenwechsel – Abrechnung",
        render=lambda lang: render_phase_change(
            epoch_name="Operation Crimson Tide",
            old_phase="competition",
            new_phase="reckoning",
            cycle_count=6,
            command_center_url=_CTA_URL,
            email_locale=lang,
            accent_color="#f59e0b",
            standing_data={"rank": 2, "total": 4, "score": 148.5},
            unsubscribe_url=_UNSUB,
        ),
    ),
    EmailFixture(
        key="deadline-reminder",
        label="Fristerinnerung",
        subject=lambda lang: "Zwei Stunden bis zur Auflösung – Zyklus 3",
        render=lambda lang: render_deadline_reminder(
            email_locale=lang,
            epoch_name="Operation Crimson Tide",
            cycle_number=3,
            hours_remaining=2,
            open_items=["Operative einsetzen", "Bündnisantrag beantworten"],
            done_items=["Zonen befestigt"],
            penalty_rp=2,
            ai_takeover_next=True,
            cta_url=_CTA_URL,
            unsubscribe_url=_UNSUB,
        ),
    ),
    EmailFixture(
        key="epoch-completed",
        label="Epoche abgeschlossen",
        subject=lambda lang: "Operation Crimson Tide ist entschieden",
        render=lambda lang: render_epoch_completed(
            epoch_name="Operation Crimson Tide",
            leaderboard=_leaderboard(),
            player_simulation_id="sim-2",
            cycle_count=6,
            command_center_url=_CTA_URL,
            email_locale=lang,
            accent_color="#f59e0b",
            campaign_stats={"events": 42, "missions": 18},
            unsubscribe_url=_UNSUB,
        ),
    ),
    EmailFixture(
        key="continuation",
        label="Gespräche, die ohne dich weitergingen",
        subject=lambda lang: continuation_subject(2, lang),
        # ZWEI Fäden, nicht einer: die Vorlage baut je Faden einen eigenen
        # Abschnitt, und eine Musterung mit einem einzigen Eintrag zeigt nie,
        # ob zwei aneinandergesetzt noch lesbar sind. Der zweite Auszug trägt
        # bewusst einen Zeilenumbruch — `white-space: pre-wrap` ist genau die
        # Sorte Auszeichnung, die in einem Postfach anders fällt als im
        # Browser.
        render=lambda lang: render_continuation(
            [
                {
                    "title": "Mira Steinfeld",
                    "excerpt": "Waehrend du weg warst, hat Mira Steinfeld mit Elena Voss "
                    "gesprochen.\n\n\u201eDie Akte lag heute morgen schon auf meinem "
                    "Tisch, und niemand will sie dorthin gelegt haben.\u201c",
                    "url": "https://metaverse.center/chat?conversation=7b2e37c3",
                },
                {
                    "title": "Lena Kray",
                    "excerpt": "Waehrend du weg warst, hat Lena Kray mit Mira Steinfeld "
                    "gesprochen.\n\n\u201eIch habe den Stempel nachgesehen. Er stammt aus "
                    "einer Abteilung, die es seit vier Jahren nicht mehr gibt.\u201c",
                    "url": "https://metaverse.center/chat?conversation=91ab44de",
                },
            ],
            email_locale=lang,
        ),
        unsubscribable=False,
    ),
    EmailFixture(
        key="welcome",
        label="Begrüßung",
        subject=lambda lang: "Willkommen im Bureau",
        render=lambda lang: render_welcome(email_locale=lang),
        unsubscribable=False,
    ),
    EmailFixture(
        key="account-deleted",
        label="Konto gelöscht",
        subject=lambda lang: "Dein Konto wurde gelöscht",
        render=lambda lang: render_account_deleted(email_locale=lang, worlds_transferred=2),
        unsubscribable=False,
        accountless_recipient=True,
    ),
    EmailFixture(
        key="clearance-granted",
        label="Freigabe erteilt",
        subject=lambda lang: "Schmiede-Freigabe erteilt",
        render=lambda lang: render_clearance_granted(
            email_locale=lang,
            forge_url="https://metaverse.center/forge",
            admin_notes="Willkommen. Der erste Lauf ist der teuerste.",
            starter_tokens=3,
        ),
        unsubscribable=False,
    ),
    EmailFixture(
        key="clearance-denied",
        label="Freigabe abgelehnt",
        subject=lambda lang: "Schmiede-Freigabe abgelehnt",
        render=lambda lang: render_clearance_denied(
            email_locale=lang,
            admin_notes="Bitte ergänze eine kurze Beschreibung deines Vorhabens.",
        ),
        unsubscribable=False,
    ),
    EmailFixture(
        key="clearance-request-admin",
        label="Freigabeantrag (an die Verwaltung)",
        subject=lambda lang: "Neuer Schmiede-Freigabeantrag",
        render=lambda lang: render_clearance_request_admin_notification(
            user_email="operator@example.org",
            message="Ich möchte eine Welt über die Bibliothek von Alexandria bauen.",
            admin_panel_url="https://metaverse.center/admin",
        ),
        unsubscribable=False,
    ),
)

FIXTURES_BY_KEY: dict[str, EmailFixture] = {fixture.key: fixture for fixture in FIXTURES}


def render_fixture(key: str, locale: str = "de") -> tuple[str, str]:
    """Return ``(subject, html)`` for one fixture, or raise ``KeyError``."""
    fixture = FIXTURES_BY_KEY[key]
    return fixture.subject(locale), fixture.render(locale)
