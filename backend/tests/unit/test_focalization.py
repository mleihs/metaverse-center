"""Wer sieht, ist nicht wer spricht.

Genette trennt zwei Fragen: **wer sieht** (Fokalisierung) und **wer spricht**
(Stimme). Unser Fehler ist der Sprung von INTERNER auf NULL-Fokalisierung —
eine Figur hört auf, eine Person zu sein, und wird zum Autor des Abschnitts.

Diese Datei hält drei Dinge fest, und das zweite ist das wichtigere:

1. Was die Heuristik FANGEN muss — Kollektiv, fremdes Inneres.
2. Was sie NICHT bestrafen darf. Das ist die Hälfte, an der ein Messgerät
   dieser Art scheitert: bestraft es die dritte Person über sich selbst oder
   die Wahrnehmung einer anderen Figur, treibt es die Prosa in Monologe und
   ist schlimmer als keines.
3. Dass sie sich zu ihrem Nichtwissen bekennt statt zu raten.

Der Prüfstand ist nicht erfunden: die drei Züge unten sind sinngemäß die vom
04.09.2026, 15:07 UTC, an denen der Fehler zum ersten Mal benannt wurde.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from backend.services.chat.focalization_service import FocalizationService as F

BESETZUNG = ["Marie Morgenrot", "Suse Sonnenblum", "Benno Blattgold"]


def _messen(text: str, sprecher: str = "Marie Morgenrot"):
    return F.measure(text, speaker=sprecher, others=[n for n in BESETZUNG if n != sprecher])


class TestWasSieFangenMuss:
    """Beides ist Allwissenheit im Wortsinn — eine Figur kann das nicht
    wahrnehmen."""

    def test_ein_kollektiv_aller_beteiligten(self):
        """Der echte Fall: alle drei Züge begannen so."""
        r = _messen("*Die drei Frauen verharren einen Herzschlag lang in der Stille.*")
        assert r.verdict == "zero"
        assert r.evidence["kollektiv"] == "drei"

    def test_alle_drei_als_wendung(self):
        assert _messen("*Alle drei atmen zugleich aus.*").verdict == "zero"

    def test_ein_fremdes_inneres_als_tatsache(self):
        r = _messen("*Suse spuert die Kaelte des Bodens.*")
        assert r.verdict == "zero"
        assert "Suse" in r.evidence["fremdes_inneres"][0]

    def test_fremdes_wissen(self):
        assert _messen("*Benno weiss, dass die Akte gefaelscht ist.*").verdict == "zero"

    def test_auch_mit_einschub_dazwischen(self):
        """„Suse, die Haende im Schoss, weiss" — der Einschub darf die Suche
        nicht abschneiden."""
        assert _messen("*Suse, die Haende im Schoss, weiss es laengst.*").verdict == "zero"


class TestWasSieNICHTBestrafenDarf:
    """Die Haelfte, an der ein Messgeraet dieser Art scheitert."""

    def test_dritte_person_ueber_sich_selbst(self):
        """Handlungsprosa in der dritten Person mit Namen ist im Rollenspiel
        die uebliche Konvention — nicht der Fehler. Der Fehler ist der
        GELTUNGSBEREICH, nicht das Register.

        Diese Unterscheidung hat am 04.09. eine falsche Prompt-Aenderung
        gekostet: die erste Fassung verlangte die Ich-Form und haette damit
        einen gesunden Zug verboten."""
        assert _messen("*Marie hebt die Hand und legt die Akte auf den Tisch.*").verdict != "zero"

    def test_wahrnehmung_einer_anderen(self):
        """„scheint", „wirkt" sind genau die Formen, die eine Figur benutzen
        SOLL. Sie zu bestrafen triebe die Prosa in Monologe."""
        assert _messen("*Suse scheint zu zoegern. Ich sehe, wie ihre Hand innehaelt.*").verdict != "zero"

    def test_eine_andere_zeigt_etwas_koerperlich(self):
        """„Suse zittert" ist Beobachtung von aussen, „Suse fuerchtet" nicht."""
        assert _messen("*Suse zittert, kaum sichtbar.*").verdict != "zero"

    def test_eine_zahl_ohne_kollektivbezug(self):
        """Ohne die Bindung an einen Artikel waere jede Zahl im Text ein
        Fehlalarm."""
        assert _messen("*Ich mache drei Schritte auf die Tuer zu.*").verdict != "zero"

    def test_eine_falsche_zahl_ist_kein_kollektiv(self):
        """„die zwei Wachen" in einer Dreierrunde meint nicht die Runde."""
        assert _messen("*Die zwei Wachen am Tor sehen weg.*").verdict != "zero"

    def test_ein_name_in_einem_laengeren_wort(self):
        """Wortgrenzen: „Marie" darf nicht in „Marienkaefer" treffen."""
        r = _messen("*Ein Marienkaefer sitzt auf dem Akteneinband.*", sprecher="Suse Sonnenblum")
        assert r.verdict != "zero"


class TestZweiBeteiligteNebeneinanderOhneIch:
    """Der dritte Anhalt, gefunden weil ein echter Zug durch die ersten zwei
    fiel."""

    def test_zwei_andere_als_handelnde(self):
        r = _messen("*Suse und Benno sehen sich an.*")
        assert r.verdict == "zero"
        assert "mehrere_fremde_ohne_ich" in r.evidence

    def test_der_sprecher_zaehlt_mit(self):
        """Der echte Fall. Sie nennt sich selbst neben einer anderen."""
        assert _messen("*Die Eier in Marie und Suse erwachen zum Leben.*").verdict == "zero"

    def test_mit_einem_ich_im_satz_ist_es_wahrnehmung(self):
        """Der ganze Unterschied zwischen Erzaehlung und Wahrnehmung."""
        assert _messen("*Ich sehe, wie Suse und Benno sich ansehen.*").verdict != "zero"

    def test_der_sprecher_allein_bleibt_unangetastet(self):
        """Eine Person ist keine zwei."""
        assert _messen("*Marie hebt die Hand.*").verdict == "internal"

    def test_satzweise_und_nicht_ueber_den_ganzen_text(self):
        """Ein „ich" drei Saetze weiter rettet den Satz nicht, in dem es
        fehlt."""
        assert _messen("*Ich warte. Suse und Benno sehen sich an.*").verdict == "zero"


class TestSieBekenntSichZuIhremNichtwissen:
    def test_erste_person_ist_intern(self):
        r = _messen("*Ich atme aus und lasse die Schultern sinken.*")
        assert r.verdict == "internal"
        assert r.evidence["erste_person"] is True

    def test_niemand_sonst_handelt_ist_intern(self):
        r = _messen("*Marie hebt die Hand.*")
        assert r.verdict == "internal"
        assert r.evidence["kein_fremder_handelnder"] is True

    def test_andere_genannt_ohne_anhalt_ist_unklar(self):
        """„Sie zoegert" kann Wahrnehmung sein oder Anmassung, und der
        Unterschied steht nicht im Wortlaut. Dafuer ist die zweite Stufe da —
        zu raten waere schlimmer als zuzugeben, nichts gesehen zu haben."""
        r = _messen("*Suse legt die Akte hin. Der Stempel fehlt.*")
        assert r.verdict == "unclear"

    def test_leerer_text_ist_unklar(self):
        assert _messen("   ").verdict == "unclear"

    def test_jedes_urteil_traegt_einen_beleg(self):
        """Ein Urteil ohne Beleg ist eine Behauptung. Wer in einem halben Jahr
        nachsieht, warum ein Zug als allwissend zaehlte, hat nur den."""
        for text in (
            "*Die drei Frauen verharren.*",
            "*Ich atme aus.*",
            "*Suse legt die Akte hin.*",
            "   ",
        ):
            assert _messen(text).evidence, f"kein Beleg fuer {text!r}"


class TestDieAuswertungKommtAusSQL:
    """Sie zaehlt nicht selbst zusammen (ADR-007)."""

    async def test_die_quote_wird_aus_der_view_gelesen(self):
        kette = MagicMock()
        for n in ("select", "eq", "limit"):
            getattr(kette, n).return_value = kette
        kette.execute = AsyncMock(return_value=MagicMock(data=[{"gemessen": 219, "allwissend": 18}]))
        klient = MagicMock()
        klient.table.return_value = kette
        ergebnis = await F.rate_for_conversation(klient, uuid4())
        klient.table.assert_called_with("conversation_focalization")
        assert ergebnis["allwissend"] == 18

    def test_der_dienst_zaehlt_nicht_selbst(self):
        """Eine zweite Rechnung in Python waere eine zweite Wahrheit."""
        import inspect

        quelle = inspect.getsource(F)
        assert "conversation_focalization" in quelle
        for verboten in ("sum(", "len([", "Counter("):
            assert verboten not in quelle.split("def rate_for_conversation")[1]


class TestDieMessungAendertNichts:
    async def test_ein_fehler_beim_ablegen_kostet_die_nachricht_nicht(self):
        """Die Nachricht steht schon. Ein fehlender Messwert ist eine Luecke in
        einer Statistik, kein Ausfall im Gespraech."""
        klient = MagicMock()
        klient.table.side_effect = RuntimeError("Datenbank weg")
        await F.record(klient, uuid4(), F.measure("*Ich warte.*", speaker="Marie", others=[]))

    async def test_ein_zweiter_lauf_ersetzt_statt_zu_haeufen(self):
        kette = MagicMock()
        kette.upsert.return_value = kette
        kette.execute = AsyncMock(return_value=MagicMock(data=[{}]))
        klient = MagicMock()
        klient.table.return_value = kette
        await F.record(klient, uuid4(), F.measure("*Ich warte.*", speaker="Marie", others=[]))
        assert kette.upsert.call_args.kwargs["on_conflict"] == "message_id,method"


@pytest.mark.parametrize(
    "text",
    [
        "*Die drei Frauen verharren einen Herzschlag lang in der Stille.*",
        # Der Sprecher nennt SICH SELBST neben einer anderen, in der dritten
        # Person, als zwei gleichrangige Orte desselben Vorgangs. Eine Regel,
        # die nur fremde Namen zaehlt, sieht das nicht — ausser der Sprecherin
        # ist nur EINE andere genannt.
        "*Die Stille dehnt sich, waehrend die Eier in Marie und Suse zum Leben erwachen.*",
        "*Alle drei atmen zugleich aus, ohne es abgesprochen zu haben.*",
    ],
)
def test_die_drei_zuege_vom_vierten_september(text):
    """Der Prüfstand ist nicht erfunden. Sinngemäß die drei Züge von 15:07
    UTC, an denen der Fehler zum ersten Mal benannt wurde — alle drei
    beginnen mit einem Erzählersatz über die ganze Runde."""
    assert _messen(text).verdict == "zero"
