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


# ═══════════════════════════════════════════════════════════════════════════
# Die Fallen
# ═══════════════════════════════════════════════════════════════════════════
#
# WOHER DIESER ABSCHNITT KOMMT. Ein zweiter Agent hat am 05.09.2026 die Frage
# gestellt, an der die ganze Sitzung haengt:
#
#     Stellt der Detektor die Lage HER, in der Allwissenheit entstehen kann,
#     oder wartet er darauf?
#
# Er wartete. Die Handmessungen vom 05.09. haben die Lage hergestellt und
# 0 % gemessen — aber sie standen in keinem automatisierten Lauf. Eine
# 0-%-Quote misst dann irgendwann wieder nur, dass niemand gefragt hat.
#
# Dieselbe Lehre kam an einem Tag in drei Kleidern: der Nebenlaeufigkeitstest
# des Peers, dieser Detektor und die Sternchen-Gegenprobe — jedes Mal meldete
# eine Pruefung Erfolg, die ihre eigene Bedingung nie hergestellt hatte.
# Deshalb steht unten nicht nur der Korpus, sondern auch ein Test AUF den
# Korpus: ein Fallenkorpus ohne Fallen besteht sonst muehelos.
#
# Drei Schichten, ehrlich getrennt (Plan vom 05.09.):
#   (a) hier     — der Detektor gegen erfundene Ausgaben mit bekanntem Urteil
#   (b) Prompt   — `test_prompt_unter_falle.py`: steht die Abwehr wirklich da?
#   (c) Modell   — bleibt Handmessung, Protokoll im Handoff. Ein Modellaufruf
#                  in der Suite waere teuer und wackelig.

#: Eine Falle: Text, erwartetes Urteil, erwarteter Belegschluessel, Begruendung.
#:
#: Alle Texte sind ERFUNDEN. Die Besetzung ist die abgesprochene
#: Testbesetzung — echter Gespraechswortlaut gehoert nicht in dieses Repo
#: (`scripts/lint-no-chat-content.sh`).
FALLENKORPUS: tuple[tuple[str, str, str | None, str], ...] = (
    # ── Was anschlagen MUSS ──────────────────────────────────────────────
    (
        "*Die drei Frauen wechseln einen Blick, ohne dass ein Wort faellt.*",
        "zero",
        "kollektiv",
        "Kollektiv der ganzen Runde",
    ),
    (
        "*Alle drei senken zugleich den Blick.*",
        "zero",
        "kollektiv",
        "Kollektiv als feste Wendung",
    ),
    (
        "*Suse weiss laengst, was in der Akte steht.*",
        "zero",
        "fremdes_inneres",
        "fremdes Wissen als Tatsache",
    ),
    (
        "*Benno, den Hut noch in der Hand, fuerchtet die Frage.*",
        "zero",
        "fremdes_inneres",
        "fremdes Inneres ueber einen Einschub hinweg",
    ),
    (
        "*Suse und Benno treten an den Tisch.*",
        "zero",
        "mehrere_fremde_ohne_ich",
        "zwei Fremde nebeneinander, kein Wahrnehmender im Satz",
    ),
    (
        "*Zwischen Marie und Benno liegt die Akte unberuehrt.*",
        "zero",
        "mehrere_fremde_ohne_ich",
        "der Sprecher zaehlt mit: Blick von aussen auf sich selbst",
    ),
    (
        "*Ich warte an der Tuer. Suse und Benno mustern einander.*",
        "zero",
        "mehrere_fremde_ohne_ich",
        "satzweise: ein Ich im Nachbarsatz rettet den Satz nicht",
    ),
    # ── Die Gegenprobe: was NICHT anschlagen darf ────────────────────────
    (
        "„Suse, wo ist Benno?“",
        "internal",
        "nur_rede",
        "reine Anrede in woertlicher Rede — nennt zwei, erzaehlt nichts",
    ),
    (
        "»Suse, wo ist Benno?«",
        "internal",
        "nur_rede",
        "dieselbe Anrede in Guillemets",
    ),
    (
        "„Ich frage Suse, sobald Benno geht.”",
        "internal",
        "nur_rede",
        "gemischtes Paar, und der Satz ist ganz Rede",
    ),
    (
        "*Marie legt die Akte auf den Tisch.*",
        "internal",
        "kein_fremder_handelnder",
        "dritte Person ueber sich selbst ist Konvention, nicht Fehler",
    ),
    (
        "*Ich sehe, wie Suse und Benno einander mustern.*",
        "internal",
        "erste_person",
        "Wahrnehmung zweier anderer, mit Wahrnehmendem im Satz",
    ),
    (
        "*Suse scheint zu zoegern.* „Bleib, wo du bist.“ *Ich atme aus.*",
        "internal",
        "erste_person",
        "Anschein statt Inneres, dazu Rede und ein Ich",
    ),
    (
        "*Suse zittert, kaum sichtbar.* „Dir ist kalt.“ *Ich reiche ihr den Mantel.*",
        "internal",
        "erste_person",
        "koerperliche Beobachtung ist erlaubt",
    ),
    (
        "*Ich mache drei Schritte auf die Tuer zu.*",
        "internal",
        "erste_person",
        "eine Zahl ohne Artikel ist kein Kollektiv",
    ),
    (
        "*Die zwei Wachen am Tor sehen weg.*",
        "internal",
        "kein_fremder_handelnder",
        "falsche Zahl in einer Dreierrunde meint nicht die Runde",
    ),
    # ── Was der Detektor ehrlich nicht entscheidet ───────────────────────
    (
        "*Suse legt die Akte hin. Der Stempel fehlt.*",
        "unclear",
        None,
        "eine andere handelt, kein Inneres, kein Ich — nicht entscheidbar",
    ),
)


@pytest.mark.parametrize(
    ("text", "urteil", "beleg", "warum"),
    FALLENKORPUS,
    ids=[w for *_, w in FALLENKORPUS],
)
def test_der_detektor_gegen_das_fallenkorpus(text, urteil, beleg, warum):
    """Jede Falle mit BEKANNTEM Urteil. Das schuetzt das Messgeraet."""
    r = _messen(text)
    assert r.verdict == urteil, f"{warum}: {r.verdict} statt {urteil} — Beleg {r.evidence}"
    if beleg:
        assert beleg in r.evidence, f"{warum}: Beleg {beleg!r} fehlt, da steht {r.evidence}"


class TestDerKorpusStelltSeineBedingungHer:
    """Ein Fallenkorpus ohne Fallen besteht muehelos.

    Genau dieser Fehler ist am 05.09.2026 dreimal aufgetreten — eine Pruefung
    meldete Erfolg, die ihre eigene Bedingung nie hergestellt hatte. Diese
    Klasse ist die Gegenmassnahme: sie prueft den KORPUS, nicht den Detektor.
    Faellt eine Fallenart beim Umbauen heraus, wird hier rot, und nicht erst
    in einem halben Jahr an einer Quote, die keiner mehr zuordnen kann.
    """

    def test_jedes_urteil_kommt_vor(self):
        urteile = {u for _, u, _, _ in FALLENKORPUS}
        assert urteile == {"zero", "internal", "unclear"}

    def test_jeder_anhalt_fuer_allwissenheit_kommt_vor(self):
        """Die drei Wege zu `zero` — faellt einer weg, misst der Korpus ihn nicht."""
        belege = {b for _, u, b, _ in FALLENKORPUS if u == "zero"}
        assert belege == {"kollektiv", "fremdes_inneres", "mehrere_fremde_ohne_ich"}

    def test_die_gegenprobe_ist_nicht_kleiner_als_die_falle(self):
        """Ein Messgeraet scheitert an der zweiten Haelfte, nicht an der ersten.

        Bestraft es die dritte Person ueber sich selbst oder die Wahrnehmung
        einer anderen Figur, treibt es die Prosa in Monologe und ist schlimmer
        als keines. Deshalb muss die Gegenprobe mindestens so gross sein wie
        die Falle.
        """
        fallen = sum(1 for _, u, _, _ in FALLENKORPUS if u == "zero")
        gegen = sum(1 for _, u, _, _ in FALLENKORPUS if u == "internal")
        assert gegen >= fallen, f"{gegen} Gegenproben gegen {fallen} Fallen"

    def test_die_gegenprobe_nennt_wirklich_andere_figuren(self):
        """Sonst besteht sie, weil nichts dasteht, worueber man irren koennte.

        Eine Gegenprobe ohne fremden Namen kann gar nicht falsch-positiv
        werden — sie prueft dann nur, dass ein Text ohne Namen keinen Namen
        enthaelt.
        """
        mit_fremden = [
            t
            for t, u, _, _ in FALLENKORPUS
            if u == "internal" and any(n.split()[0] in t for n in BESETZUNG[1:])
        ]
        assert len(mit_fremden) >= 5, f"nur {len(mit_fremden)} Gegenproben nennen eine andere Figur"

    def test_woertliche_rede_kommt_im_korpus_vor(self):
        """Der Fehler, der alle aelteren Zahlen verzerrt hat, war die Rede.

        Ein Korpus ohne ein einziges Anfuehrungszeichen haette ihn nie
        gefunden — und alle Zahlen dieses Detektors bis zum 05.09.2026 tragen
        ihn.
        """
        mit_rede = [t for t, *_ in FALLENKORPUS if any(z in t for z in "„“”«»\"")]
        assert len(mit_rede) >= 4


class TestDieAnfuehrungszeichenSindEineKlasse:
    """Die vollstaendige Kreuztabelle von `_ohne_rede`.

    Gegengelesen und selbst nachgemessen am 05.09.2026: von den neun
    Kombinationen der drei ueblichen Konventionen fielen **fuenf** durch.
    Was hielt, waren genau die drei sauberen Paare plus „…”.

    Gemischte Paare sind kein Stil, sondern ein Ausrutscher — und ein Modell
    rutscht oefter aus, als es sich entscheidet. Deshalb steht hier die ganze
    Tabelle und nicht die vier Faelle, die einmal aufgefallen sind.
    """

    OEFFNER = ("„", "“", '"')
    SCHLIESSER = ("“", "”", '"')

    @pytest.mark.parametrize("auf", OEFFNER)
    @pytest.mark.parametrize("zu", SCHLIESSER)
    def test_jede_kombination_wird_geschnitten(self, auf, zu):
        assert F._ohne_rede(f"{auf}Bleib, wo du bist.{zu}").strip() == ""

    @pytest.mark.parametrize(
        "text",
        [
            "«Bleib, wo du bist.»",
            "»Bleib, wo du bist.«",
        ],
    )
    def test_guillemets_in_beiden_richtungen(self, text):
        """Im Projekt 202 Vorkommen — in den Kampfgespraechen, nicht im Chat.
        Fuer den Chatpfad latent, nicht aktiv; zwei Zeichen im Muster."""
        assert F._ohne_rede(text).strip() == ""

    def test_rede_ueber_einen_zeilenumbruch(self):
        """Gerade Anfuehrungszeichen sind mit ueber 95 000 Vorkommen der
        beherrschende Stil im Projekt, und ein Absatz innerhalb der Rede ist
        normal. Die alte Innenklasse [^"\\n] schloss den Umbruch aus."""
        assert F._ohne_rede('"Bleib.\n\nUnd sieh mich an."').strip() == ""

    def test_zitat_im_zitat(self):
        """Das Zeichen \" war aus der deutschen Innenklasse ausgeschlossen —
        der Zweig fand sein Ende nicht mehr und der ganze Satz blieb stehen.
        In Rollenspielprosa nicht selten."""
        rest = F._ohne_rede('„Er sagte "ja" dazu“, murmelte Suse.')
        assert "murmelte" in rest
        assert "Er sagte" not in rest

    def test_sternchen_bleiben_stehen(self):
        """RICHTIG SO: *…* ist Handlung, keine Rede — und Handlung ist genau
        das, was gemessen werden soll.

        ⚠ Die erste Gegenprobe hierzu war fehlerhaft: sie suchte in der
        Sternchen-Zeile nach einem Wort, das dort nicht vorkam, und meldete
        „geschnitten" fuer jede Zeile ohne dieses Wort. Beim Pruefen einer
        Pruefung zuerst fragen, ob sie ueberhaupt etwas sehen KANN."""
        text = "*Die drei Frauen verharren.*"
        assert F._ohne_rede(text) == text

    def test_eine_reine_anrede_ist_keine_allwissenheit(self):
        """Der belegte Schaden der alten Fassung: »Marie, wo ist Suse?« —
        eine reine Anrede — wurde als `zero` gewertet."""
        r = _messen("»Marie, wo ist Suse?«", sprecher="Benno Blattgold")
        assert r.verdict == "internal"

    def test_die_obergrenze_schuetzt_die_erzaehlung(self):
        """⚠ Der Preis der Klassifizierung, und er zeigt in die schlimmere
        Richtung: ein unpaariges Zeichen frisst ohne Grenze den Rest des
        Zuges, der Zug bestuende nur noch aus Rede und galte als `internal`.
        Eine falsch-positive Allwissenheit faellt beim Nachlesen auf, eine
        verschwundene nicht."""
        erzaehlung = "Ein Satz ohne Rede. " * 30  # weit ueber _REDE_MAX
        text = f'"{erzaehlung}" Die drei Frauen verharren.'
        assert len(erzaehlung) > F._REDE_MAX
        assert "Die drei Frauen" in F._ohne_rede(text)
        assert _messen(text).verdict == "zero"

    def test_unter_der_obergrenze_wird_geschnitten(self):
        """Die Gegenprobe zur Grenze: was hineinpasst, faellt auch weg.
        Ohne sie pruefte der Test oben nur, dass irgendetwas stehenbleibt."""
        rede = "Bleib, wo du bist. " * 5
        assert len(rede) < F._REDE_MAX
        assert F._ohne_rede(f'"{rede}"').strip() == ""
