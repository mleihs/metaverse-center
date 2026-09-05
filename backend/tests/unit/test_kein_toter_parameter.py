"""Ein Parameter, der angenommen und fallengelassen wird.

── WOHER DIESES TOR KOMMT ────────────────────────────────────────────────────

Am 05.09.2026 gemessen: `ChatAIService._fire_and_forget_digest` nahm seit
Migration 373 ein `participants` entgegen — BEIDE Gruppenpfade gaben es mit —
und reichte es nicht an `ensure_digests` weiter. Ohne Besetzung ist dort
`fehlende_episoden` leer, die Vorlage `chat_character_episode` wird nie
aufgeloest, und die Ich-Schicht des zweischichtigen Gedaechtnisses schreibt
keine Zeile.

Am groessten Faden auf Produktion nachgezaehlt:

    geteiltes Protokoll    14 von 14
    Ich-Erinnerung          0 von 42

Der Dienst zitiert selbst, was diese Schicht wert ist: die Ablation misst
60,9 statt 73,3 ohne sie, und die Verweigerungsgenauigkeit faellt von 81 auf
47. Ein Jahr Arbeit an zwei Migrationen, eine Vorlage in zwei Sprachen auf
Produktion — und die Zeile, die alles verbindet, fehlte.

⚠ **Ein toter Parameter ist schlimmer als ein fehlender.** Ein fehlender ist
ein `TypeError` beim ersten Aufruf. Ein toter sieht an der Aufrufstelle
richtig aus, laesst sich in Tests mitgeben, taucht in der Signatur auf, wird
dokumentiert — und tut nichts. Es gibt keine Fehlermeldung, die ihn meldet.

── WARUM EIN TEST UND KEINE RUFF-REGEL ───────────────────────────────────────

Ruff kennt `ARG` (unbenutzte Argumente), aber diese Regelgruppe ist im Projekt
nicht ausgewaehlt, und sie einzuschalten waere ueber den ganzen Baum laut:
Schnittstellen-Konformitaet, ueberschriebene Methoden und Rueckruf-Signaturen
nehmen mit Absicht Parameter entgegen, die sie nicht brauchen.

Gemessen ueber die vier Dateien unten waren es **drei** Fundstellen, und ALLE
drei waren echte Befunde. Ein Tor, das an dieser Stelle leise ist, ist genau
deshalb eines: es laeuft dort, wo ein Parameter etwas WEITERGEBEN soll.

── WAS ES NICHT PRUEFT ───────────────────────────────────────────────────────

Ob der Parameter richtig BENUTZT wird. Ein `participants=None` haette es
bestanden. Es prueft nur, dass er im Rumpf ueberhaupt vorkommt — die
billigste Frage, die diese Fehlerklasse gefangen haette.
"""

from __future__ import annotations

import ast
import pathlib

import pytest

#: Die Dateien unter diesem Tor.
#:
#: Bewusst eine Liste und kein Baumdurchlauf. Das Tor gehoert dorthin, wo
#: Werte durch mehrere Schichten gereicht werden — Chat, Gedaechtnis,
#: Fortsetzung. Ein Tor ueber den ganzen Baum waere laut und wuerde dann
#: abgeschaltet, und ein abgeschaltetes Tor ist keines.
GEPRUEFTE_DATEIEN = (
    "backend/services/chat_ai_service.py",
    "backend/services/agent_memory_service.py",
    "backend/services/chat/conversation_digest_service.py",
    "backend/services/chat/continuation_service.py",
    "backend/services/chat/focalization_service.py",
    "backend/services/chat/speaker_selection.py",
    "backend/services/chat/names.py",
)

#: Namen, die ein Rumpf nicht nennen MUSS.
#:
#: `self` und `cls` sind Bindeglieder, keine Werte. Alles mit Unterstrich
#: davor ist die uebliche Ansage „ich nehme das entgegen und brauche es
#: nicht" — wer so schreibt, hat es entschieden statt vergessen.
ERLAUBT = frozenset({"self", "cls"})


def _tote_parameter(quelle: str) -> list[tuple[str, list[str]]]:
    """Funktionen, deren Rumpf einen ihrer Parameter nirgends nennt."""
    baum = ast.parse(quelle)
    funde: list[tuple[str, list[str]]] = []
    for knoten in ast.walk(baum):
        if not isinstance(knoten, ast.FunctionDef | ast.AsyncFunctionDef):
            continue
        args = knoten.args
        namen = [a.arg for a in (*args.posonlyargs, *args.args, *args.kwonlyargs)]
        # Ein Name gilt als benutzt, wenn er als Variable vorkommt, als
        # Attribut, oder als SCHLUESSELWORT eines Aufrufs (`foo(x=x)` — der
        # haeufigste Fall in einem Weiterreicher).
        benutzt = {n.id for n in ast.walk(knoten) if isinstance(n, ast.Name)}
        benutzt |= {n.attr for n in ast.walk(knoten) if isinstance(n, ast.Attribute)}
        benutzt |= {k.arg for n in ast.walk(knoten) if isinstance(n, ast.Call) for k in n.keywords if k.arg}
        tot = [n for n in namen if n not in ERLAUBT and not n.startswith("_") and n not in benutzt]
        if tot:
            funde.append((knoten.name, tot))
    return funde


@pytest.mark.parametrize("pfad", GEPRUEFTE_DATEIEN)
def test_kein_parameter_wird_angenommen_und_fallengelassen(pfad):
    quelle = pathlib.Path(pfad).read_text(encoding="utf-8")
    funde = _tote_parameter(quelle)
    assert not funde, (
        f"{pfad}: "
        + "; ".join(f"{fn} nimmt {', '.join(tot)} entgegen und benutzt es nicht" for fn, tot in funde)
        + ". Ein toter Parameter ist schlimmer als ein fehlender: er sieht an der "
        "Aufrufstelle richtig aus und tut nichts. Entweder weiterreichen oder "
        "streichen — oder mit Unterstrich benennen, wenn er absichtlich ungenutzt bleibt."
    )


class TestDasTorSiehtWirklichEtwas:
    """Ein Tor, das nichts finden KANN, besteht muehelos.

    Genau diese Frage hat den ganzen 05.09. getragen: stellt die Pruefung die
    Lage her, in der der Fehler entstehen kann, oder wartet sie darauf? Hier
    wird sie hergestellt.
    """

    def test_es_faengt_einen_fallengelassenen_parameter(self):
        quelle = "def weiterreichen(a, b):\n    return ziel(a=a)\n"
        assert _tote_parameter(quelle) == [("weiterreichen", ["b"])]

    def test_es_faengt_den_echten_fall_von_damals(self):
        """Nachgebaut: entgegengenommen, dokumentiert, nicht weitergereicht."""
        quelle = (
            "def _fire_and_forget_digest(self, cid, namen, locale, *, participants=None):\n"
            "    return dienst.ensure_digests(cid, participant_names=namen, locale=locale)\n"
        )
        assert _tote_parameter(quelle) == [("_fire_and_forget_digest", ["participants"])]

    def test_ein_weitergereichter_parameter_ist_sauber(self):
        quelle = (
            "def _fire_and_forget_digest(self, cid, namen, locale, *, participants=None):\n"
            "    return dienst.ensure_digests(cid, participant_names=namen, "
            "locale=locale, participants=participants)\n"
        )
        assert _tote_parameter(quelle) == []

    def test_ein_unterstrich_ist_eine_entscheidung(self):
        """`_ungenutzt` heisst „ich habe es gesehen". Das ist etwas anderes
        als vergessen, und ein Tor, das den Unterschied nicht macht, treibt
        zur Umgehung."""
        assert _tote_parameter("def rueckruf(a, _b):\n    return a\n") == []

    def test_self_und_cls_zaehlen_nicht(self):
        assert _tote_parameter("class K:\n    def m(self):\n        return 1\n") == []

    def test_ein_parameter_als_attributname_zaehlt_nicht_als_benutzt(self):
        """Die Gegenprobe zur Grosszuegigkeit: `x` gilt als benutzt, wenn
        irgendwo `.x` steht. Das ist bewusst grosszuegig — lieber ein
        uebersehener Fund als ein Fehlalarm, der das Tor unglaubwuerdig
        macht. Dieser Test haelt fest, DASS es so ist, damit die naechste
        Sitzung es nicht fuer einen Fehler haelt."""
        assert _tote_parameter("def f(wert):\n    return anderes.wert\n") == []
