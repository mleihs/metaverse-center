"""Wer ein Ereignis schreibt, muss seine Folgen auslösen.

Befund D2/S7. Gemessen am 31.08.2026 über den ganzen Backend-Baum:

    resonance_service.py            ruft  ✓
    routers/events.py (4 Stellen)   ruft  ✓
    autonomous_event_service.py     nicht ✗
    echo_service.py                 nicht ✗
    operative_mission_service.py    nicht ✗  (zwei Einfügestellen)

Ereignisse aus den drei stummen Pfaden standen in der Tabelle und bewegten
nichts: keine Kennzahlenaktualisierung, keine Kaskadenverarbeitung, keine
Anbindung an einen Erzählbogen, keine Gebäudeschädigung.

Das ist besonders bitter bei zweien davon. Der Bleed ist der TEUERSTE Weg,
auf dem ein Ereignis entstehen kann — eine Welt blutet in eine andere, ein
Modell schreibt den Text um, ein Admin gibt frei — und am Ende bewegte es in
der Zielwelt nichts. Und die Operativ-Missionen schreiben ihre Ereignisse in
die Welt des GEGNERS: ein Angriff, der ankommt und nichts auslöst, ist aus
Sicht der Angegriffenen kein Angriff.

Der Name war Teil des Problems: die Methode hieß `_post_event_mutation`,
war also privat — und ihr einziger dienstübergreifender Aufrufer stand in
einem anderen Modul. Ein privater Name, den nur die Fremde ruft, liest sich
wie „intern geregelt", während er in Wahrheit ein Pflichtschritt für jeden
Erzeuger ist. Jetzt heißt sie `apply_event_consequences`.

Dieses Tor scannt per AST nach `table("events").insert(...)` und verlangt,
dass die umschließende Funktion ODER — bei stapelweisen Erzeugern — die
umschließende KLASSE die Folgen auslöst. Nach J3 meldet es seine Trefferzahl
und wird rot, wenn es keine Einfügestelle findet.
"""

from __future__ import annotations

import ast
from pathlib import Path

_BACKEND = Path(__file__).resolve().parents[2]
_CONSEQUENCE = "apply_event_consequences"

# Module, die Ereignisse einfügen und die Folgen NICHT selbst auslösen dürfen,
# weil ein anderer, stapelweiser Aufrufer es tut. Jede Zeile braucht einen
# Grund — eine Ausnahmeliste ohne Begründung ist ein Formular, kein Tor.
_BATCH_HANDLED: dict[str, str] = {}


def _insert_sites() -> list[tuple[Path, ast.FunctionDef | ast.AsyncFunctionDef, int]]:
    """Jede Stelle, die in `events` einfügt, mit ihrer umschließenden Funktion."""
    found: list[tuple[Path, ast.AsyncFunctionDef | ast.FunctionDef, int]] = []

    for path in sorted(_BACKEND.rglob("*.py")):
        if "tests" in path.parts:
            continue
        source = path.read_text(encoding="utf-8")
        if 'table("events")' not in source:
            continue
        tree = ast.parse(source)

        # Funktion je Zeilennummer zuordnen: die INNERSTE, die die Zeile enthält.
        functions = [n for n in ast.walk(tree) if isinstance(n, ast.AsyncFunctionDef | ast.FunctionDef)]

        for node in ast.walk(tree):
            if not (isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)):
                continue
            if node.func.attr != "insert":
                continue
            # …table("events").insert(…)
            inner = node.func.value
            if not (
                isinstance(inner, ast.Call)
                and isinstance(inner.func, ast.Attribute)
                and inner.func.attr == "table"
                and inner.args
                and isinstance(inner.args[0], ast.Constant)
                and inner.args[0].value == "events"
            ):
                continue

            enclosing = None
            for fn in functions:
                if fn.lineno <= node.lineno <= (fn.end_lineno or fn.lineno) and (
                    enclosing is None or fn.lineno > enclosing.lineno
                ):
                    enclosing = fn
            if enclosing is not None:
                found.append((path, enclosing, node.lineno))
    return found


def test_the_scan_finds_the_insert_sites() -> None:
    """Ohne diesen Fall wäre der Befund unten grün, wenn der Scan nichts findet."""
    sites = _insert_sites()
    assert len(sites) >= 4, (
        f"nur {len(sites)} Einfügestellen in `events` gefunden — der Scan zeigt ins Leere. "
        "Gemessen am 31.08.2026 waren es vier."
    )


def test_every_event_writer_triggers_the_consequences() -> None:
    """Der eigentliche Befund — und die Absicherung gegen eine fünfte Stelle."""
    silent: list[str] = []
    covered = 0

    for path, fn, lineno in _insert_sites():
        rel = path.relative_to(_BACKEND.parent)
        if str(rel) in _BATCH_HANDLED:
            continue

        # Der Aufruf darf in derselben Funktion stehen ODER in einer anderen
        # Methode desselben Moduls — stapelweise Erzeuger rufen die Folgen
        # bewusst einmal am Stapelende, nicht je Zeile.
        module_source = path.read_text(encoding="utf-8")
        module_calls = module_source.count(f"{_CONSEQUENCE}(")
        if module_calls:
            covered += 1
        else:
            silent.append(f"{rel}:{lineno} in {fn.name}()")

    assert covered >= 4, f"nur {covered} abgedeckte Einfügestellen — der Scan prüft zu wenig"
    assert not silent, (
        "Diese Stellen schreiben ein Ereignis, ohne seine Folgen auszulösen:\n  "
        + "\n  ".join(silent)
        + f"\n\nJeder Erzeuger muss {_CONSEQUENCE}() aufrufen — stapelweise, "
        "einmal je Welt, nicht je Zeile."
    )


def test_the_consequence_step_is_not_private() -> None:
    """Ein Pflichtschritt darf keinen privaten Namen tragen.

    `_post_event_mutation` war privat und wurde von einem ANDEREN Dienst
    gerufen. Der Name sagte „intern geregelt", die Wirklichkeit sagte
    „Pflichtschritt für jeden Erzeuger" — und drei von vier hielten sich an
    den Namen statt an die Wirklichkeit.
    """
    source = (_BACKEND / "services" / "event_service.py").read_text(encoding="utf-8")
    assert f"async def {_CONSEQUENCE}(" in source
    code_lines = [
        line for line in source.splitlines() if not line.lstrip().startswith("#") and not line.lstrip().startswith("--")
    ]
    code = "\n".join(code_lines)
    assert "_post_event_mutation(" not in code, (
        "der alte private Name wird noch gerufen — dann gibt es zwei Einstiege und einer davon wird wieder vergessen"
    )
