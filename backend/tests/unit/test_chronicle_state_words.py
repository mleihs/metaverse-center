"""Bind the German chronicle vocabulary to the identifiers it has to cover.

Der deutsche Chroniktext ist kein übersetzter, sondern ein zweiter von Hand
geschriebener Text. Das macht diese Fehlerart lautlos: bleibt in einem
deutschen Satz ein englischer Statusname stehen, fällt nichts aus. Der Satz
ist grammatisch heil — „'Der Aschermarkt' wechselte zu resolving." — und nur
halb gelesen. Kein Test, kein Linter und kein Sentry-Ereignis meldet ihn.

Gemessen am 31.08.2026 per AST über die 17 `make_heartbeat_entry`-Aufrufe der
`HeartbeatService`: VIER deutsche Erzähltexte interpolierten einen englischen
Bezeichner. Der Prüfbericht der Systemprüfung führte genau EINEN davon
(`{direction}`). Die drei anderen standen direkt neben Stellen, an denen
derselbe Autor das Paar `pressure_msg`/`druck_msg` schon von Hand gebildet
hatte — die Form war bekannt, sie wurde nur nicht durchgehalten.

Dieses Tor prüft drei Seiten gegeneinander:

1. jeder `events.event_status`-Wert der Migration hat ein deutsches Wort;
2. jeder Beziehungsereignis-Typ, den `agent_opinion_service` schreibt, auch;
3. die vier bekannten Zustandsvariablen erscheinen in KEINEM deutschen
   Erzähltext mehr nackt, sondern nur durch `state_word_de` hindurch.

Nach J3: jede Suche meldet, wie viele Stellen sie geprüft hat, und wird rot,
wenn sie nichts findet — ein Scan, der ins Leere zeigt, ist sonst grün.
"""

from __future__ import annotations

import ast
import re
from pathlib import Path

from backend.services.heartbeat_entry_builder import _STATE_WORDS_DE, state_word_de

_ROOT = Path(__file__).resolve().parents[3]
_BACKEND = _ROOT / "backend"
_HEARTBEAT = _BACKEND / "services" / "heartbeat_service.py"
_OPINION = _BACKEND / "services" / "agent_opinion_service.py"

# `narrative_de` ist das SECHSTE Stellungsargument von `make_heartbeat_entry`.
# Die Position wird unten geprüft, damit eine Signaturänderung dieses Tor laut
# zerbricht statt es stumm auf das falsche Argument zu richten (die Lehre aus
# `test_heartbeat_entry_types.py`, wo genau das einmal passiert ist).
_NARRATIVE_DE_ARG_INDEX = 5

# Variablen, die einen Bezeichner tragen — keine Zahl, keine ID, keinen
# Eigennamen. Nur diese dürfen im deutschen Satz nicht nackt stehen.
_STATE_VARIABLES = frozenset({"direction", "old_status", "new_status", "evt_type", "status"})


def _german_narrative_nodes() -> list[tuple[int, ast.expr]]:
    """(Zeile, AST-Knoten) je `narrative_de` an einem make_heartbeat_entry-Aufruf."""
    tree = ast.parse(_HEARTBEAT.read_text(encoding="utf-8"))
    found: list[tuple[int, ast.expr]] = []
    for node in ast.walk(tree):
        if not (isinstance(node, ast.Call) and getattr(node.func, "id", None) == "make_heartbeat_entry"):
            continue
        assert len(node.args) > _NARRATIVE_DE_ARG_INDEX, (
            f"make_heartbeat_entry in Zeile {node.lineno} hat nur {len(node.args)} "
            "Stellungsargumente — die Signatur hat sich geändert, dieses Tor zeigt "
            "auf das falsche Argument."
        )
        found.append((node.lineno, node.args[_NARRATIVE_DE_ARG_INDEX]))
    return found


def test_the_scan_itself_finds_call_sites() -> None:
    """Ohne diesen Fall wäre jeder Befund unten grün, wenn der Scan nichts findet."""
    sites = _german_narrative_nodes()
    assert len(sites) >= 15, f"nur {len(sites)} make_heartbeat_entry-Aufrufe gefunden — der Scan zeigt ins Leere"


def test_no_english_state_identifier_survives_in_a_german_narrative() -> None:
    """Die vier Befunde vom 31.08. — und jeder Rückfall."""
    naked: list[str] = []
    wrapped = 0
    for lineno, node in _german_narrative_nodes():
        if not isinstance(node, ast.JoinedStr):
            continue
        for value in node.values:
            if not isinstance(value, ast.FormattedValue):
                continue
            inner = value.value
            if isinstance(inner, ast.Name) and inner.id in _STATE_VARIABLES:
                naked.append(f"{_HEARTBEAT.name}:{lineno} — {{{inner.id}}} ohne state_word_de")
            elif (
                isinstance(inner, ast.Call)
                and getattr(inner.func, "id", None) == "state_word_de"
                and isinstance(inner.args[0], ast.Name)
                and inner.args[0].id in _STATE_VARIABLES
            ):
                wrapped += 1

    assert wrapped >= 4, (
        f"nur {wrapped} durch state_word_de geführte Zustandsvariablen gefunden — "
        "erwartet werden mindestens die vier Befunde vom 31.08.2026; "
        "findet der Scan sie nicht, prüft er nichts."
    )
    assert not naked, "Englische Bezeichner im deutschen Chroniktext:\n  " + "\n  ".join(naked)


def test_every_event_status_has_a_german_word() -> None:
    """Die fünf Werte des `events.event_status`-CHECK, aus der Migration gelesen."""
    # Zwei Fallen in einem Ausdruck, beide an diesem Tor selbst vorgeführt:
    #
    # (1) Die Migration schreibt `CHECK (event_status IN (...))`, Postgres liest
    #     sie als `event_status = ANY (ARRAY[...])` zurück. Der erste Entwurf
    #     suchte nur die zurückgelesene Form und übersprang sich still — J3c:
    #     ein zu enger Filter liefert ein sauberes, kurzes, falsches Ergebnis,
    #     und ein `skip` sieht aus wie „trifft nicht zu". Darum unten ein
    #     `assert` und kein `skip`.
    # (2) `event_status IN (...)` steht in SECHS weiteren Migrationen — in
    #     ABFRAGEN (`AND event_status IN ('active','escalating')`), nicht in
    #     der Deklaration. Der zweite Entwurf las die letzte Fundstelle und
    #     bekam zwei Werte statt fünf. Die Deklaration erkennt man am `CHECK`,
    #     nicht am Vergleich — deshalb ist `CHECK` Teil des Musters.
    definitions: list[str] = []
    for path in sorted((_ROOT / "supabase" / "migrations").glob("*.sql")):
        text = path.read_text(encoding="utf-8")
        definitions += re.findall(
            r"CHECK\s*\(\s*event_status\s*(?:IN\s*\(|=\s*ANY\s*\(\s*ARRAY\[)([^)\]]+)",
            text,
        )
    assert definitions, (
        "kein event_status-CHECK in den Migrationen gefunden — dieses Tor prüft "
        "dann nichts. Das Muster muss beide Schreibweisen treffen (`IN (...)` in "
        "der Migration, `= ANY (ARRAY[...])` beim Zurücklesen) UND am `CHECK` "
        "verankert sein, damit es keine Abfrage für die Deklaration hält."
    )

    statuses = {v for d in definitions for v in re.findall(r"'([a-z_]+)'", d)}
    assert len(statuses) >= 5, (
        f"nur {len(statuses)} Statuswerte gelesen ({sorted(statuses)}) — der Ausdruck greift zu kurz"
    )
    missing = sorted(s for s in statuses if s not in _STATE_WORDS_DE)
    assert not missing, f"Ereignisstatus ohne deutsches Wort: {missing}"


def test_every_relationship_event_type_has_a_german_word() -> None:
    """Die Typen, die `agent_opinion_service` in `relationship_events` schreibt."""
    tree = ast.parse(_OPINION.read_text(encoding="utf-8"))
    types: set[str] = set()
    for node in ast.walk(tree):
        if not isinstance(node, ast.Dict):
            continue
        for key, value in zip(node.keys, node.values, strict=False):
            if (
                isinstance(key, ast.Constant)
                and key.value == "type"
                and isinstance(value, ast.Constant)
                and isinstance(value.value, str)
                and value.value.startswith("relationship_")
            ):
                types.add(value.value)

    assert types, "keine relationship_*-Typen in agent_opinion_service gefunden — der Scan zeigt ins Leere"
    missing = sorted(t for t in types if t not in _STATE_WORDS_DE)
    assert not missing, f"Beziehungsereignis ohne deutsches Wort: {missing}"


def test_unknown_identifier_stays_visible() -> None:
    """Ein fehlender Eintrag hinterlässt einen sichtbaren Rest, keine Lücke."""
    assert state_word_de("brandneuer_status") == "brandneuer_status"
    assert state_word_de("resolving") == "in Auflösung"
