"""Ein Test darf ein Plattform-Tor umlegen. Er darf es nicht liegen lassen.

DER BEFUND (31.08.2026)
-----------------------
`test_travel_economy.py` stellt das Fun-Kern-Tor in JEDEM `finally` auf
**`False`** — nicht auf den Wert, den es vorfand (Zeilen 385, 498, 525, 588,
604, 631, 657, 707). `test_travel_sondierung.py` importiert denselben Helfer und
schliesst es an drei weiteren Stellen (480, 625, 765), ohne es je
zurückzustellen. Beide behandeln „Tor zu" als Ruhezustand.

Das ist keine Vermutung, sondern am Quelltext ablesbar — und sequenziell
gemessen, ohne einen zweiten Lauf daneben:

    ohne Fixture   Tor vorher true  →  466 grün  →  Tor nachher FALSE
    mit  Fixture   Tor vorher true  →  465 grün  →  Tor nachher true

Die Integrationsmappe läuft gegen eine ECHTE Datenbank. Was ein Lauf dort
hinterlässt, findet der nächste vor — auch der nächste am nächsten Tag. Deshalb
fiel `test_travel_sondierung.py` irgendwann schon „allein" durch, und deshalb
verdächtigt man dann die falsche Änderung.

WARUM DIESER TEST DIE VORRICHTUNG PRÜFT UND NICHT DEN ZUSTAND
--------------------------------------------------------------
„Das Tor steht auf dem richtigen Wert" wäre die schwächere Zusicherung: sie
bestünde auch, wenn zufällig niemand es angefasst hat. Geprüft wird deshalb die
EIGENSCHAFT der Fixture — dass sie automatisch greift, dass sie modulweit greift
(das ist die Grenze, an der der Schaden zwischen Dateien übertritt), und dass sie
den vorgefundenen Wert LIEST, statt einen angenommenen Ruhezustand zu setzen.

Der letzte Punkt ist der wichtigste: genau dieser Fehler steckt eine Ebene tiefer
in den Tests, die die Fixture repariert. Eine Fixture, die am Ende `False`
schriebe, wäre derselbe Fehler mit besseren Manieren.
"""

from __future__ import annotations

import ast
from pathlib import Path

_CONFTEST = Path(__file__).resolve().parents[1] / "integration" / "conftest.py"
_FIXTURE = "restore_platform_gates"


def _fixture_node() -> ast.FunctionDef:
    tree = ast.parse(_CONFTEST.read_text(encoding="utf-8"), filename=str(_CONFTEST))
    for node in tree.body:
        if isinstance(node, ast.FunctionDef) and node.name == _FIXTURE:
            return node
    raise AssertionError(
        f"{_FIXTURE} fehlt in {_CONFTEST.name}. Ohne sie lässt die erste Testdatei, "
        "die ein Tor schliesst, es für alle folgenden geschlossen."
    )


def _fixture_decorator(node: ast.FunctionDef) -> ast.Call:
    for dec in node.decorator_list:
        if isinstance(dec, ast.Call) and ast.unparse(dec.func).endswith("fixture"):
            return dec
    raise AssertionError(f"{_FIXTURE} ist nicht als pytest-Fixture ausgezeichnet")


def test_the_fixture_exists():
    assert _fixture_node() is not None


def test_it_applies_without_being_asked():
    """`autouse` ist der Kern: eine Fixture, die angefordert werden muss, wird
    von der Datei vergessen, die sie am nötigsten hätte."""
    kwargs = {k.arg: k.value for k in _fixture_decorator(_fixture_node()).keywords}
    assert "autouse" in kwargs, f"{_FIXTURE} ist nicht autouse"
    assert getattr(kwargs["autouse"], "value", False) is True


def test_it_spans_a_whole_file():
    """Modulweit, weil das die Grenze ist, an der der Schaden übertritt:
    innerhalb einer Datei setzen die Tests das Tor selbst, zwischen Dateien tut
    es niemand. Funktionsweit wäre zwei Abfragen je Test — rund neunhundert."""
    kwargs = {k.arg: k.value for k in _fixture_decorator(_fixture_node()).keywords}
    assert getattr(kwargs.get("scope"), "value", None) == "module", f"{_FIXTURE} muss modulweit greifen"


def test_it_reads_the_value_before_it_writes_one():
    """Die Zusicherung, an der alles hängt.

    Eine Fixture, die am Ende einen ANGENOMMENEN Ruhezustand schriebe, wäre
    derselbe Fehler wie der, den sie repariert — nur eine Ebene höher. Geprüft
    wird deshalb, dass vor dem `yield` gelesen und danach genau das
    Gelesene geschrieben wird.
    """
    quelle = ast.unparse(_fixture_node())
    # NICHT am ersten `yield` teilen: die Fixture hat einen frühen Ausstieg für
    # den Fall ohne Datenbank, und der liegt vor dem Lesen. Diese Prüfung ist
    # beim ersten Lauf genau darüber gestolpert — die Zusicherung war zu naiv,
    # nicht die Fixture. Die tragfähige Frage ist die Reihenfolge von Lesen und
    # Schreiben, nicht ihre Lage zu einem beliebigen `yield`.
    assert "select" in quelle, f"{_FIXTURE} liest den Wert nicht"
    assert "upsert" in quelle, f"{_FIXTURE} schreibt nichts zurück"
    assert quelle.index("select") < quelle.index("upsert"), f"{_FIXTURE} schreibt, bevor es gelesen hat"
    # Der geschriebene Wert muss aus dem Gelesenen stammen — keine Konstante.
    # Genau das ist der Fehler, den die Fixture repariert, eine Ebene tiefer:
    # `_set_gate(admin_client, False)` im `finally` ist auch ein Rücksetzer, nur
    # eben auf einen angenommenen statt auf den vorgefundenen Wert.
    schreibstelle = quelle[quelle.index("upsert") :]
    assert "value" in schreibstelle and "False" not in schreibstelle, (
        f"{_FIXTURE} schreibt einen festen Wert zurück statt des gelesenen."
    )


def test_the_leaking_gate_is_covered():
    """Das Tor, an dem der Befund hängt, muss in der Liste stehen — sonst wäre
    die Fixture eine Vorrichtung ohne Gegenstand."""
    quelle = _CONFTEST.read_text(encoding="utf-8")
    assert "drift_fun_core_enabled" in quelle, (
        "Das Fun-Kern-Tor steht nicht in _MUTABLE_PLATFORM_GATES — es ist aber "
        "genau das, welches test_travel_economy.py und test_travel_sondierung.py "
        "geschlossen zurücklassen."
    )
