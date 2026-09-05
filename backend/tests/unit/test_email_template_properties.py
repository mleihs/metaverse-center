"""Eigenschaften, die JEDE Mailvorlage erfüllen muss (Handoff P3.28).

Nicht: „sieht die Zyklusmail richtig aus". Sondern: was für alle elf Vorlagen
gilt, in beiden Sprachen, und was bricht, sobald jemand eine zwölfte hinzufügt
und die halbe Sorgfalt vergisst.

Der Unterschied ist wichtig. Ein Test je Vorlage prüft die Vorlagen, die es
gibt. Ein Test über das REGISTER prüft auch die, die es morgen gibt — und genau
dort ist der Fehler bisher entstanden: vier der elf Vorlagen (`welcome`,
`account_deleted`, `simulation_invitation`, `deadline_reminder`) standen in
keinem Testversandskript und ließen sich ohne echten Versand gar nicht ansehen.

DIE GEPRÜFTEN EIGENSCHAFTEN
---------------------------
1. **Jede Vorlage rendert**, in beiden Sprachen, ohne Ausnahme.
2. **Preheader vorhanden** — die verborgene Zeile, die jeder Mailclient neben
   dem Betreff zeigt. Fehlt sie, füllt der Client sie mit dem ersten sichtbaren
   Text, und das ist meistens „Ansicht im Browser".
3. **Klartextteil vorhanden und brauchbar** — nicht bloß da, sondern länger als
   ein Rest und ohne Markup-Reste.
4. **`List-Unsubscribe` in beide Richtungen.** Eine Werbe- oder Berichtsmail
   ohne Abmeldung landet im Spam; eine Sicherheitsmail MIT Abmeldung ist eine
   Falle („melde dich von Kontowarnungen ab"). Beides ist ein Fehler, und ein
   Test, der nur die Anwesenheit prüft, findet nur den einen.
5. **Kontrast jeder Akzentfarbe** gegen den Mailhintergrund, WCAG AA.
6. **Keine `@keyframes`** — Mailclients unterstützen sie nicht, und was nicht
   läuft, verschiebt im besten Fall nur das Layout.
7. **Kein Kontolink in einer Mail an einen kontolosen Empfänger.** Drei
   Vorlagen gehen an Leser, die (noch) kein Konto haben oder keines mehr:
   die beiden Einladungen und die Löschbestätigung.
"""

from __future__ import annotations

import re

import pytest

from backend.services.email_fixtures import FIXTURES, FIXTURES_BY_KEY
from backend.services.email_templates import (
    _AMBER,
    _BG,
    _CONTRAST_FLOOR,
    _SIM_EMAIL_COLORS,
    contrast_ratio,
    get_sim_accent,
    html_to_text,
)

LOCALES = ("de", "en")
CASES = [(fixture.key, locale) for fixture in FIXTURES for locale in LOCALES]
IDS = [f"{key}-{locale}" for key, locale in CASES]


@pytest.fixture(scope="module")
def rendered() -> dict[tuple[str, str], str]:
    """Render every template once, in both languages."""
    return {(key, locale): FIXTURES_BY_KEY[key].render(locale) for key, locale in CASES}


class TestTheRegisterIsComplete:
    """A property test is worth its salt only if it covers everything."""

    def test_every_render_function_has_a_fixture(self) -> None:
        import backend.services.email_templates as templates

        renderers = {
            name for name in dir(templates) if name.startswith("render_") and callable(getattr(templates, name))
        }
        # Each fixture names its renderer through the closure; compare on the
        # source of the lambda rather than guessing from the key, so a renamed
        # key cannot quietly drop a template out of the suite.
        import inspect

        covered = set()
        for fixture in FIXTURES:
            source = inspect.getsource(fixture.render)
            covered |= {name for name in renderers if name in source}

        missing = sorted(renderers - covered)
        assert not missing, (
            "Diese Mailvorlagen haben kein Fixture und werden von keiner "
            "Eigenschaft geprüft. Genau so sind vier Vorlagen entstanden, die "
            "sich ohne echten Versand nicht ansehen ließen:\n  " + "\n  ".join(missing)
        )

    def test_the_fixture_keys_are_unique_and_url_safe(self) -> None:
        keys = [fixture.key for fixture in FIXTURES]
        assert len(keys) == len(set(keys))
        for key in keys:
            assert re.fullmatch(r"[a-z0-9-]+", key), key

    def test_there_are_enough_of_them(self) -> None:
        """A floor, so an empty register cannot pass every test below."""
        assert len(FIXTURES) >= 11, f"nur {len(FIXTURES)} Fixtures — das Register ist unvollständig"


class TestEveryTemplateRenders:
    @pytest.mark.parametrize(("key", "locale"), CASES, ids=IDS)
    def test_it_produces_html(self, rendered, key: str, locale: str) -> None:
        html = rendered[(key, locale)]
        assert len(html) > 1000, f"{key}/{locale} ist verdächtig kurz: {len(html)} Zeichen"
        assert "<table" in html, "Produktion setzt auf <table role=presentation>, nicht auf Flex"

    @pytest.mark.parametrize(("key", "locale"), CASES, ids=IDS)
    def test_no_unrendered_placeholder_survives(self, rendered, key: str, locale: str) -> None:
        """A leftover `{name}` in a mail is a defect nobody sees until it ships."""
        html = rendered[(key, locale)]
        leftovers = re.findall(r"\{[a-z_]{3,}\}", html)
        assert not leftovers, f"{key}/{locale} trägt ungefüllte Platzhalter: {sorted(set(leftovers))}"


class TestPreheader:
    """The hidden line every mail client shows next to the subject."""

    @pytest.mark.parametrize(("key", "locale"), CASES, ids=IDS)
    def test_a_preheader_is_present(self, rendered, key: str, locale: str) -> None:
        html = rendered[(key, locale)]
        # The shell hides it with display:none + max-height:0; either marker is
        # enough to locate the element, both are asserted so a partial change
        # does not silently unhide it.
        assert "display:none" in html.replace(" ", ""), f"{key}/{locale} hat keinen verborgenen Vorschautext"
        assert "max-height:0" in html.replace(" ", ""), f"{key}/{locale}: Vorschautext nicht sauber verborgen"


class TestPlainTextPart:
    @pytest.mark.parametrize(("key", "locale"), CASES, ids=IDS)
    def test_the_text_alternative_is_usable(self, rendered, key: str, locale: str) -> None:
        text = html_to_text(rendered[(key, locale)])
        assert len(text) > 200, f"{key}/{locale}: Klartextteil nur {len(text)} Zeichen"
        for residue in ("<td", "<table", "&nbsp;", "style="):
            assert residue not in text, f"{key}/{locale}: Markup-Rest im Klartext: {residue}"

    @pytest.mark.parametrize(("key", "locale"), CASES, ids=IDS)
    def test_the_call_to_action_survives_into_the_text(self, rendered, key: str, locale: str) -> None:
        """A plain-text reader must still be able to reach the link.

        The admin notification is the one exception: it goes to the operators
        and carries an admin-panel URL that is a bare host, not a token link.
        """
        html = rendered[(key, locale)]
        if "http" not in html:
            pytest.skip("Vorlage ohne Verweis")
        text = html_to_text(html)
        assert "http" in text, f"{key}/{locale}: kein Verweis im Klartextteil"


class TestUnsubscribeBothWays:
    """Presence AND absence. A test for only one of them finds only one defect."""

    @pytest.mark.parametrize(("key", "locale"), CASES, ids=IDS)
    def test_unsubscribable_mails_offer_it(self, rendered, key: str, locale: str) -> None:
        fixture = FIXTURES_BY_KEY[key]
        if not fixture.unsubscribable:
            pytest.skip("Sicherheits- oder Kontomail")
        html = rendered[(key, locale)]
        assert "unsubscribe" in html.lower(), (
            f"{key}/{locale} ist abbestellbar, bietet es aber nicht an — "
            "eine Berichtsmail ohne Abmeldung landet im Spam"
        )

    @pytest.mark.parametrize(("key", "locale"), CASES, ids=IDS)
    def test_security_mails_do_not_offer_it(self, rendered, key: str, locale: str) -> None:
        fixture = FIXTURES_BY_KEY[key]
        if fixture.unsubscribable:
            pytest.skip("normale Mail")
        html = rendered[(key, locale)]
        assert "unsubscribe?token" not in html.lower(), (
            f"{key}/{locale} bietet eine Abmeldung an, obwohl es eine Sicherheits- "
            'oder Kontomail ist. „Melde dich von Kontowarnungen ab" ist keine Wahl, '
            "die man anbieten darf."
        )


class TestAccountlessRecipients:
    """Three mails reach readers who have no account, or no longer have one."""

    @pytest.mark.parametrize(("key", "locale"), CASES, ids=IDS)
    def test_no_settings_link_for_accountless_readers(self, rendered, key: str, locale: str) -> None:
        fixture = FIXTURES_BY_KEY[key]
        if not fixture.accountless_recipient:
            pytest.skip("Empfänger hat ein Konto")
        html = rendered[(key, locale)]
        assert "/settings/notifications" not in html, (
            f"{key}/{locale} verweist auf Kontoeinstellungen. Der Leser dieser Mail "
            "hat vielleicht nie ein Konto gehabt (Einladung) oder keines mehr "
            "(Löschbestätigung) — der Link führt ihn ins Leere."
        )

    def test_the_three_are_the_ones_that_were_measured(self) -> None:
        """Named, so removing the flag from one reads as a decision, not a slip."""
        flagged = {fixture.key for fixture in FIXTURES if fixture.accountless_recipient}
        assert flagged == {"simulation-invitation", "epoch-invitation", "account-deleted"}, flagged


class TestAccentContrast:
    """Every accent colour must be legible on the mail background."""

    @pytest.mark.parametrize("slug", sorted(_SIM_EMAIL_COLORS))
    def test_every_world_accent_clears_wcag_aa(self, slug: str) -> None:
        accent = get_sim_accent(slug)
        ratio = contrast_ratio(accent, _BG)
        assert ratio >= _CONTRAST_FLOOR, f"{slug}: {accent} auf {_BG} = {ratio:.2f}:1, unter {_CONTRAST_FLOOR}:1"

    def test_the_default_accent_clears_it_too(self) -> None:
        assert contrast_ratio(get_sim_accent(None), _BG) >= _CONTRAST_FLOOR
        assert contrast_ratio(_AMBER, _BG) >= _CONTRAST_FLOOR

    def test_the_lift_is_actually_needed_somewhere(self) -> None:
        """Otherwise this whole class passes for the wrong reason.

        Two of the five stored colours were below AA when measured on
        30.08.2026 (`cite-des-dames` at 1.91:1, `the-gaslit-reach` at 3.52:1).
        If no stored colour needs lifting any more, `_ensure_readable` is
        untested by the assertions above and this test says so.
        """
        raw_failures = [
            slug for slug, hex_color in _SIM_EMAIL_COLORS.items() if contrast_ratio(hex_color, _BG) < _CONTRAST_FLOOR
        ]
        assert raw_failures, (
            "Keine gespeicherte Weltfarbe liegt mehr unter AA — dann prüft dieser "
            "Test die Anhebung nicht mehr, sondern nur noch die Tabelle. Entweder "
            "eine Farbe in der Probe belassen oder _ensure_readable gesondert testen."
        )

    def test_the_lift_preserves_the_colour_rather_than_whitening_it(self) -> None:
        """A world keeps its colour; it only stops being invisible."""
        for slug, raw in _SIM_EMAIL_COLORS.items():
            lifted = get_sim_accent(slug)
            if raw.lower() == lifted.lower():
                continue
            assert lifted.lower() != "#ffffff", f"{slug} wurde auf Weiß hochgezogen"


class TestNoAnimation:
    @pytest.mark.parametrize(("key", "locale"), CASES, ids=IDS)
    def test_no_keyframes(self, rendered, key: str, locale: str) -> None:
        html = rendered[(key, locale)]
        assert "@keyframes" not in html, (
            f"{key}/{locale} trägt @keyframes. Mailclients führen sie nicht aus; "
            "im besten Fall bleibt das Layout stehen, im schlechteren verrutscht es."
        )

    @pytest.mark.parametrize(("key", "locale"), CASES, ids=IDS)
    def test_no_external_stylesheet_or_script(self, rendered, key: str, locale: str) -> None:
        html = rendered[(key, locale)].lower()
        assert "<script" not in html, f"{key}/{locale} enthält ein Skript"
        assert "<link" not in html, f"{key}/{locale} lädt ein externes Stylesheet"
