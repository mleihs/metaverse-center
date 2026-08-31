"""Eine misslungene Auswertung hinterlässt eine Spur (Punkt 3 der Systemprüfung).

BEFUND (gemessen 31.08.2026)
----------------------------
`GenerationService._parse_or_repair_json` hatte **null Aufrufer**. Alle elf
JSON-Auswertungen des Dienstes riefen `_parse_json_content` unmittelbar und
gaben bei `None` auf — und zwar STILL: keine der elf Stellen protokollierte
etwas. Was dann geschah:

    generate_social_media_sentiment   Stimmung „neutral", Zuversicht 0,0
    extract_memory_observations       null Beobachtungen
    reflect_on_memories               null Reflexionen
    generate_chronicle_entry          erfundener Titel, ROHTEXT als Inhalt
    generate_resonance_event          Titel aus Archetyp + Ereignistyp
    generate_agent_full / _partial    der Agent behält stillschweigend das Alte

Das Modell war jedes Mal bezahlt, die Antwort verworfen, und niemand erfuhr
davon.

🔑 **Deshalb liess sich die Frage, ob sich eine LLM-Reparatur lohnt, gar nicht
beantworten: es gab keine Zahl.** Die Kostenentscheidung hing an einer
Häufigkeit, die niemand erhob. Der entscheidungsfreie Teil war also nicht das
Verdrahten, sondern das MESSEN.

Und beim Aufrichten der Rückgabeannotation fiel eine zweite Sache auf:
`_parse_json_content` gibt zurück, was `json.loads` liefert — bei einer
Antwort, die mit `[` beginnt, eine LISTE. Die Annotation lautete `dict | None`.
Zehn der elf Aufrufer lesen anschliessend `parsed.get(...)`; genau die
Antwort, die man von einem Modell erwarten muss, das die Form verfehlt, hätte
dort einen `AttributeError` erzeugt.

WAS DIESE DATEI PRÜFT
---------------------
Dass keine Auswertungsstelle am Beobachter vorbeigeht, dass das Etikett den
Namen der aufrufenden Methode trägt (ein Sentry-Etikett, das überall gleich
heisst, misst nichts), und dass der Riegel vor der Reparatur fail-closed ist.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[2]
SERVICE = BACKEND / "services" / "generation_service.py"
SETTINGS = BACKEND / "utils" / "settings.py"

# Die beiden Einstiege, die beobachten. Alles andere umgeht die Messung.
OBSERVING = {"_parse_json_object", "_parse_json_payload"}


@pytest.fixture(scope="module")
def tree() -> ast.Module:
    return ast.parse(SERVICE.read_text(encoding="utf-8"))


def _without_docstring(fn: ast.FunctionDef | ast.AsyncFunctionDef) -> str:
    """Der Körper ohne den erklärenden Docstring.

    Notwendig, weil die Docstrings dieses Dienstes den Befund benennen, den sie
    beheben — und ein Textscan, der das mitliest, findet seine eigene
    Begründung. Ein Tor, das Text durchsucht, muss vorher sagen, was für es
    Text IST.
    """
    body = list(fn.body)
    if body and isinstance(body[0], ast.Expr) and isinstance(body[0].value, ast.Constant):
        body = body[1:]
    return "\n".join(ast.unparse(stmt) for stmt in body)


def _calls(tree: ast.Module, name: str) -> list[tuple[int, str, ast.Call]]:
    """(Zeile, umgebende Methode, Aufruf) für jeden Aufruf von ``name``."""
    found: list[tuple[int, str, ast.Call]] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef):
            continue
        for sub in ast.walk(node):
            if isinstance(sub, ast.Call) and isinstance(sub.func, ast.Attribute) and sub.func.attr == name:
                found.append((sub.lineno, node.name, sub))
    return found


class TestTheGateItself:
    def test_the_scan_finds_the_parse_sites_at_all(self, tree: ast.Module) -> None:
        """Ein Scan, der nichts findet, besteht jede „steht nicht drin"-Prüfung."""
        total = sum(len(_calls(tree, n)) for n in OBSERVING)
        assert total >= 11, f"nur {total} Auswertungsstellen gefunden — der Scan misst nicht mehr"


class TestNoSiteBypassesTheObserver:
    def test_parse_json_content_has_only_the_two_entry_points_as_callers(self, tree: ast.Module) -> None:
        umgeher = [
            (ln, fn) for ln, fn, _ in _calls(tree, "_parse_json_content") if fn not in OBSERVING and fn != "__init__"
        ]
        assert not umgeher, (
            "Diese Stellen rufen `_parse_json_content` unmittelbar und gehen "
            "damit am Beobachter vorbei — ein Misserfolg dort erzeugt wieder "
            f"keine Zahl: {umgeher}"
        )

    def test_every_site_names_itself(self, tree: ast.Module) -> None:
        """Das Etikett muss die aufrufende Methode nennen.

        Ohne das trüge jede Sentry-Nachricht denselben Namen, und man wüsste
        zwar, DASS etwas misslingt, aber nicht wo — also wieder nicht genug für
        die Kostenentscheidung.
        """
        for name in OBSERVING:
            for ln, fn, call in _calls(tree, name):
                quelle = next((kw for kw in call.keywords if kw.arg == "source"), None)
                assert quelle is not None, f"Zeile {ln} in {fn}: `source=` fehlt"
                if fn.startswith("_"):
                    # Interne Weiterreichung: `_parse_or_repair_json` gibt das
                    # Etikett seines eigenen Aufrufers durch, dort steht also
                    # ein Name und kein Literal. Geprüft werden die elf
                    # Erzeugungsstellen.
                    continue
                assert isinstance(quelle.value, ast.Constant), (
                    f"Zeile {ln} in {fn}: `source=` ist kein Literal — ein zur "
                    "Laufzeit gebautes Etikett lässt sich hier nicht prüfen"
                )
                assert quelle.value.value == fn, (
                    f"Zeile {ln}: `source=\"{quelle.value.value}\"` steht in `{fn}` — "
                    "das Etikett zeigt auf die falsche Stelle"
                )


class TestTheObserverActuallyObserves:
    def test_it_logs_and_reports(self, tree: ast.Module) -> None:
        beobachter = next(
            n
            for n in ast.walk(tree)
            if isinstance(n, ast.FunctionDef | ast.AsyncFunctionDef) and n.name == "_observe_json_failure"
        )
        code = ast.unparse(beobachter)
        assert "logger.warning" in code, "kein Protokolleintrag"
        assert "capture_message" in code, "keine Meldung an Sentry"
        assert "set_tag('json_parse_source'" in code, "ohne Etikett ist die Meldung nicht auswertbar"
        assert "[:500]" in code, "der Ausschnitt ist nicht begrenzt — eine Modellantwort kann sehr lang sein"

    def test_a_list_where_an_object_was_expected_counts_as_a_failure(self, tree: ast.Module) -> None:
        objekt = next(
            n
            for n in ast.walk(tree)
            if isinstance(n, ast.FunctionDef | ast.AsyncFunctionDef) and n.name == "_parse_json_object"
        )
        code = ast.unparse(objekt)
        assert "isinstance(parsed, dict)" in code
        assert "not_an_object" in code, (
            "eine Liste kommt stillschweigend durch — und der Aufrufer liest "
            "danach `.get(...)` darauf"
        )

    def test_the_annotation_no_longer_lies(self, tree: ast.Module) -> None:
        fn = next(
            n
            for n in ast.walk(tree)
            if isinstance(n, ast.FunctionDef | ast.AsyncFunctionDef) and n.name == "_parse_json_content"
        )
        assert fn.returns is not None
        assert ast.unparse(fn.returns) == "dict | list | None", (
            "die Annotation ist wieder enger als die Wirklichkeit — ein "
            "Rückgabetyp, der weniger zulässt als die Funktion liefert, ist ein "
            "Cast ohne Schlüsselwort"
        )


class TestTheRepairIsReachableAndClosed:
    def test_it_is_gated(self, tree: ast.Module) -> None:
        fn = next(
            n
            for n in ast.walk(tree)
            if isinstance(n, ast.FunctionDef | ast.AsyncFunctionDef) and n.name == "_parse_or_repair_json"
        )
        code = _without_docstring(fn)
        assert "json_repair_allowed" in code, "die Reparatur läuft ohne Riegel"
        i_riegel = code.index("json_repair_allowed")
        i_aufruf = code.index("repair_json_output")
        assert i_riegel < i_aufruf, "der Riegel steht hinter dem bezahlten Aufruf"

    def test_the_docstring_still_explains_the_finding(self, tree: ast.Module) -> None:
        """Gegenprobe zur Prüfung darüber.

        Der Docstring MUSS `repair_json_output` nennen dürfen — er erklärt, dass
        die Funktion nie lief. Ein Scan über den ganzen Körper fände diese
        Erklärung vor dem Riegel und schlüge fehl, obwohl alles stimmt.
        """
        fn = next(
            n
            for n in ast.walk(tree)
            if isinstance(n, ast.FunctionDef | ast.AsyncFunctionDef) and n.name == "_parse_or_repair_json"
        )
        assert "repair_json_output" in ast.get_docstring(fn, clean=False)
        assert "repair_json_output" not in _without_docstring(fn).split("json_repair_allowed")[0]

    def test_the_gate_is_fail_closed(self) -> None:
        quelle = SETTINGS.read_text(encoding="utf-8")
        fn = next(
            n
            for n in ast.walk(ast.parse(quelle))
            if isinstance(n, ast.FunctionDef | ast.AsyncFunctionDef) and n.name == "json_repair_allowed"
        )
        code = ast.unparse(fn)
        assert "parse_setting_bool" in code, (
            "ohne den Positivabgleich aus F32 öffnete eine jsonb-Null den Riegel"
        )
        assert "True" not in code.split("return")[-1], "der Ausfallweg ist offen statt geschlossen"

    def test_the_key_is_seeded_by_a_migration(self) -> None:
        """Ein falsch geschriebener Schlüsselname sieht zur Laufzeit aus wie ein
        nicht gesetzter (D10-3). Nur gegen die Migrationen ist der Unterschied
        sichtbar."""
        migrations = (BACKEND.parent / "supabase" / "migrations").glob("*.sql")
        assert any("json_repair_enabled" in m.read_text(encoding="utf-8") for m in migrations), (
            "der Schlüssel json_repair_enabled steht in keiner Migration"
        )
