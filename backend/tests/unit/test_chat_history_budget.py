"""Der Verlauf wird gemessen, nicht geschätzt.

``_max_history_messages`` teilt ein Tokenbudget durch eine feste Schätzung von
250 Token je Nachricht. Das ist eine Vermutung über Text, der beim Kürzen
längst vorliegt — und sie kennt die Sprache nicht.

GEMESSEN AM 02.09.2026, 419 parallele Textpaare aus der Produktion, tokenisiert
mit ``tiktoken``:

                    o200k_base    cl100k_base
    Englisch          4,61           4,42       Zeichen je Token
    Deutsch           4,01           3,37
    Token DE / EN     1,26×          1,44×

Deutsch braucht für DENSELBEN Inhalt 26–44 % mehr Token — nicht wegen der
Textlänge (nur +9,4 % Zeichen), sondern weil Komposita und Umlaute in mehr
Stücke zerfallen.

Diese Prüfungen binden die Konstanten an diese Messung und die Kürzung an ihre
Richtung: von hinten, weil das Ende eines Gesprächs es trägt.
"""

from __future__ import annotations

import pytest

from backend.services.chat_ai_service import (
    _CHARS_PER_TOKEN,
    _CHARS_PER_TOKEN_DEFAULT,
    _MIN_MESSAGES,
    _history_token_budget,
    _trim_history_to_budget,
)


def _msg(text: str) -> dict:
    return {"content": text, "sender_role": "user"}


class TestDieKonstantenStimmenMitDerMessung:
    """Ein Wert, der nicht gemessen wurde, ist eine Meinung."""

    def test_deutsch_ist_teurer_als_englisch(self) -> None:
        """Die Kernaussage der Messung, in einer Zeile."""
        assert _CHARS_PER_TOKEN["de"] < _CHARS_PER_TOKEN["en"], (
            "Deutsch braucht mehr Token je Zeichen — die Werte sagen das Gegenteil."
        )

    @pytest.mark.parametrize(
        ("locale", "untergrenze", "obergrenze"),
        [
            # cl100k (pessimistisch) … o200k (günstig). Der gesetzte Wert muss
            # in dieser Spanne liegen und darf sie nicht nach oben verlassen —
            # unterschätzte Token sind die teure Richtung.
            ("de", 3.3, 4.1),
            ("en", 4.3, 4.7),
        ],
    )
    def test_werte_liegen_in_der_gemessenen_spanne(self, locale: str, untergrenze: float, obergrenze: float) -> None:
        wert = _CHARS_PER_TOKEN[locale]
        assert untergrenze <= wert <= obergrenze, (
            f"{locale}: {wert} liegt außerhalb der am 02.09.2026 gemessenen Spanne {untergrenze}–{obergrenze}."
        )

    def test_die_pessimistische_kodierung_wurde_genommen(self) -> None:
        """Fail-closed: näher an cl100k als an o200k.

        Die günstigere Annahme (o200k: 4,01 / 4,61) würde mehr Verlauf
        mitschicken, als ein Claude-Fenster für Deutsch fasst.
        """
        assert _CHARS_PER_TOKEN["de"] <= 3.7, "Deutsch zu großzügig geschätzt."
        assert _CHARS_PER_TOKEN["en"] <= 4.5, "Englisch zu großzügig geschätzt."

    def test_unbekannte_sprache_bekommt_die_teurere_annahme(self) -> None:
        assert _CHARS_PER_TOKEN_DEFAULT <= min(_CHARS_PER_TOKEN.values())


class TestDieKuerzungMisstStattZuSchaetzen:
    def test_kurzer_verlauf_bleibt_vollstaendig(self) -> None:
        nachrichten = [_msg("kurz") for _ in range(5)]
        assert _trim_history_to_budget(nachrichten, "claude", "de") == nachrichten

    def test_gekuerzt_wird_vorne_das_ende_bleibt_stehen(self) -> None:
        """Was zuletzt gesagt wurde, trägt das Gespräch.

        Von hinten zu kürzen hieße, den Agenten den Anfang behalten und das
        Ende vergessen zu lassen — genau der Fehler, den `_load_history` am
        31.08. abgelegt hat.
        """
        nachrichten = [_msg(f"{i:04d}" + "x" * 4000) for i in range(60)]
        behalten = _trim_history_to_budget(nachrichten, "unbekanntes-modell", "de")

        assert len(behalten) < len(nachrichten), "nichts gekürzt"
        assert behalten[-1] is nachrichten[-1], "die JÜNGSTE Nachricht fehlt"
        assert behalten == nachrichten[-len(behalten) :], "es wurde nicht am Stück gekürzt"

    def test_deutsch_behaelt_weniger_als_englisch(self) -> None:
        """Der springende Punkt: dieselbe Textmenge, zwei Sprachen.

        Vorher entschied eine feste Zahl je Nachricht und ließ beide Sprachen
        gleich viel behalten — obwohl Deutsch bis zu 44 % mehr Token kostet.
        """
        # ⚠ Die Größe ist gerechnet, nicht geraten. Budget bei unbekanntem
        # Modell: 32 000 × 0,6 − 5 000 = 14 200 Token. Bei 1 200 Zeichen kostet
        # eine Nachricht deutsch 357, englisch 277 Token — das ergibt rund 40
        # gegen 51 behaltene und liegt bei BEIDEN klar über `_MIN_MESSAGES`.
        # Mein erster Entwurf nahm 3 000 Zeichen; da fielen beide Sprachen auf
        # die Untergrenze 20, und der Test verglich zwei Fußböden statt zweier
        # Sprachen.
        nachrichten = [_msg("x" * 1200) for _ in range(80)]
        de = len(_trim_history_to_budget(nachrichten, "unbekanntes-modell", "de"))
        en = len(_trim_history_to_budget(nachrichten, "unbekanntes-modell", "en"))
        assert de > _MIN_MESSAGES and en > _MIN_MESSAGES, (
            f"beide an der Untergrenze ({de}/{en}) — der Test misst nicht die Sprache."
        )
        assert de < en, f"Deutsch behielt {de}, Englisch {en} — die Sprache wirkt nicht."

    def test_die_untergrenze_wird_nie_unterschritten(self) -> None:
        """Ein Agent ohne Verlauf antwortet beziehungslos.

        Selbst wenn eine einzelne Nachricht das ganze Budget sprengt, bleiben
        `_MIN_MESSAGES` stehen — lieber ein zu voller Aufruf als ein Gespräch
        ohne Gedächtnis.
        """
        nachrichten = [_msg("y" * 200_000) for _ in range(30)]
        behalten = _trim_history_to_budget(nachrichten, "unbekanntes-modell", "de")
        assert len(behalten) >= _MIN_MESSAGES

    def test_ein_groesseres_fenster_behaelt_mehr(self) -> None:
        nachrichten = [_msg("z" * 3000) for _ in range(200)]
        klein = len(_trim_history_to_budget(nachrichten, "unbekanntes-modell", "de"))
        gross = len(_trim_history_to_budget(nachrichten, "gemini", "de"))
        assert gross > klein

    def test_leerer_verlauf_bricht_nicht(self) -> None:
        assert _trim_history_to_budget([], "claude", "de") == []

    def test_nachricht_ohne_inhalt_kostet_trotzdem_den_aufschlag(self) -> None:
        """Rolle und Trennzeichen kosten auch bei leerem Text."""
        nachrichten = [{"sender_role": "user"} for _ in range(30)]
        assert _trim_history_to_budget(nachrichten, "claude", "de") == nachrichten


class TestDasBudget:
    def test_unbekanntes_modell_bekommt_das_kleine_fenster(self) -> None:
        assert _history_token_budget("etwas-voellig-neues") < _history_token_budget("claude")

    def test_bekannte_modelle_werden_am_praefix_erkannt(self) -> None:
        assert _history_token_budget("anthropic/claude-opus-5") == _history_token_budget("claude")
