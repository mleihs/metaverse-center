"""Ein Fluester-Aufruf, der in keiner Kostenauswertung erscheint.

BEFUND (04.09.2026): `WhisperService._generate_llm` rief `openrouter.generate`
auf und buchte danach NICHTS. `ai_usage_log` kannte den Zweck `bond_whisper`
nur aus der Deklaration in `ai_purposes.py`, nie aus einer Zeile. Der Betrag
lief mit, die Buchung nicht — jede Auswertung, die nach den Kosten der
Bindungen fragte, bekam null zurück und keinen Hinweis darauf, dass die Null
falsch war.

Das ist die gefährlichere Sorte Fehler: eine fehlende Zeile fällt nicht aus,
sie beantwortet eine Frage einfach falsch.

Gebucht wird DIREKT nach dem Aufruf und nicht nach der Auswertung. Eine
unparsbare Antwort ist bezahlt wie eine brauchbare, und ein Buch, das nur die
gelungenen Fälle kennt, ist genau der Fehler, den Migration 352 für
`ai_usage_log` behoben hat. Ein Wiederholversuch ist deshalb ZWEI Zeilen — es
waren zwei Aufrufe.
"""

from __future__ import annotations

import ast
import pathlib

QUELLE = pathlib.Path(__file__).resolve().parents[2] / "services/bond/whisper_service.py"


def _funktion(name: str) -> ast.AST:
    baum = ast.parse(QUELLE.read_text(encoding="utf-8"))
    for knoten in ast.walk(baum):
        if isinstance(knoten, ast.AsyncFunctionDef | ast.FunctionDef) and knoten.name == name:
            return knoten
    raise AssertionError(f"{name} steht nicht mehr in whisper_service.py")


def _rufe(knoten: ast.AST, endung: str) -> list[ast.Call]:
    return [n for n in ast.walk(knoten) if isinstance(n, ast.Call) and ast.unparse(n.func).endswith(endung)]


class TestJederAufrufWirdGebucht:
    def test_neben_jedem_generate_steht_eine_buchung(self):
        fn = _funktion("_generate_llm")
        generate = _rufe(fn, "openrouter.generate")
        buchungen = _rufe(fn, "AIUsageService.log")
        assert generate, "der Modellaufruf steht nicht mehr da – die Pruefung misst nichts"
        assert len(buchungen) >= len(generate), (
            f"{len(generate)} Modellaufruf(e), aber nur {len(buchungen)} Buchung(en). "
            "Ein Aufruf ohne Buchung erscheint in keiner Kostenauswertung."
        )

    def test_die_buchung_steht_vor_der_auswertung(self):
        """Sonst faellt sie bei jeder unparsbaren Antwort aus – und genau die
        sind bezahlt, ohne etwas zu liefern."""
        fn = _funktion("_generate_llm")
        buchung = _rufe(fn, "AIUsageService.log")[0]
        auswertung = _rufe(fn, "_parse_json_response")
        assert auswertung, "die Auswertung steht nicht mehr da"
        assert buchung.lineno < auswertung[0].lineno, (
            "gebucht wird erst nach dem Parsen – eine unparsbare Antwort waere dann bezahlt und ungebucht"
        )

    def test_der_zweck_ist_bond_whisper(self):
        fn = _funktion("_generate_llm")
        buchung = _rufe(fn, "AIUsageService.log")[0]
        zwecke = [
            ast.literal_eval(kw.value)
            for kw in buchung.keywords
            if kw.arg == "purpose" and isinstance(kw.value, ast.Constant)
        ]
        assert zwecke == ["bond_whisper"], (
            "der gebuchte Zweck muss der sein, unter dem das Modell aufgeloest wurde – "
            "sonst zeigt die Auswertung die Kosten unter einem fremden Namen"
        )

    def test_gebucht_wird_mit_dem_admin_client(self):
        """`ai_usage_log` hat keine Nutzer-RLS; ein Nutzer-Client schriebe
        nichts und meldete es auch nicht."""
        fn = _funktion("_generate_llm")
        buchung = _rufe(fn, "AIUsageService.log")[0]
        assert buchung.args, "die Buchung bekommt keinen Client"
        assert "admin" in ast.unparse(buchung.args[0]).lower()
