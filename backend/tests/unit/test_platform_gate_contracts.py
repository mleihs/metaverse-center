"""Ein Schalter, den niemand aufzählt, wird nie umgelegt.

``journal_enabled`` steht seit P5 im Code und hat auf Prod bis heute keine
Zeile. ``scheduled_ai_spend_enabled`` ebenso, seit dem Tag, an dem es gebaut
wurde. Beide Male fehlte nichts am Code: die Lesestelle war da, die Vorgabe war
da, das Verhalten war richtig. Was fehlte, war eine Stelle, an der jemand
sehen konnte, DASS es den Schalter gibt.

Deshalb bindet dieser Test ``services/platform_gate_contracts`` an die
Wirklichkeit, in beide Richtungen:

* Jede ``*_enabled``-Zeichenkette, die der Rücken überhaupt kennt, muss
  entweder ein erklärtes Plattform-Tor sein **oder** in ``_NOT_A_PLATFORM_GATE``
  stehen, mit Begründung. Ein neuer Schlüssel kann sich damit nicht mehr
  hineinschleichen — er erzwingt eine Entscheidung.
* Jedes erklärte Tor muss in der Datei vorkommen, die es als ``reader`` nennt.
  Ohne diese Richtung wäre ``reader`` ein Kommentar; so ist es eine Zusage.

Der Scan wird gemessen, nicht geglaubt: der erste Test prüft, dass er
überhaupt etwas findet. W4 hat einen Tag an das Gegenteil verloren — ein grünes
Tor, das am falschen Argument suchte und null Befunde als Erfolg meldete.
"""

from __future__ import annotations

import ast
import re
from pathlib import Path

import pytest

from backend.services.platform_gate_contracts import (
    GATE_GROUPS,
    PLATFORM_GATES,
    gate_keys,
)

_REPO = Path(__file__).resolve().parents[3]
_BACKEND = _REPO / "backend"

#: ``*_enabled``-Schlüssel, die der Rücken liest, die aber NICHT der Plattform
#: gehören. Jeder Eintrag ist gemessen (31.08.2026), nicht vermutet — die
#: Begründung nennt die Tabelle, aus der er tatsächlich kommt.
_NOT_A_PLATFORM_GATE: dict[str, str] = {
    # simulation_settings — gehören einer Welt, Oberfläche sind die Panels
    # unter frontend/src/components/settings/.
    "agent_autonomy_enabled": "simulation_settings, category 'heartbeat'",
    "weather_enabled": "simulation_settings, category 'heartbeat'",
    "bonds_enabled": "simulation_settings, category 'bonds'",
    "bleed_enabled": "simulation_settings",
    # Integrationseinstellungen je Welt. Der Rückfall auf die Plattform gilt
    # dem API-Schlüssel, nicht dem Tor (external_service_resolver).
    "guardian_enabled": "simulation_settings, category 'integration'",
    "newsapi_enabled": "simulation_settings, category 'integration'",
    "facebook_enabled": "simulation_settings, category 'integration'",
    # Epochenkonfiguration, kein Plattformschalter.
    "afk_penalty_enabled": "epoch config (epochs.config jsonb)",
    # Lokale Felder eines zusammengesetzten Konfig-Dicts, kein eigener
    # Einstellungsschlüssel — die Namen entstehen erst im Dict.
    "posting_enabled": "lokaler dict-Schlüssel (instagram/bluesky config)",
    "config_enabled": "lokale Variable",
    "global_enabled": "lokale Variable",
    "effects_enabled": "lokale Variable (game_mechanics)",
    "system_bypass_enabled": "lokale Variable (forge BYOK)",
}

_ENABLED_LITERAL = re.compile(r"^[a-z][a-z0-9_]*_enabled$")


#: Verzeichnisse, die dem Werk nicht gehören. ``backend/.venv`` existiert
#: tatsächlich und trägt botocore, pygments und pip — ohne diese Sperre meldete
#: der Scan 26 fremde Treffer wie ``payload_signing_enabled`` als unentschieden.
_NOT_OURS = frozenset({".venv", "venv", "site-packages", "node_modules", "__pycache__", "tests"})


def _python_files() -> list[Path]:
    return [p for p in _BACKEND.rglob("*.py") if not _NOT_OURS & set(p.parts)]


def _enabled_literals() -> dict[str, set[str]]:
    """Jede ``*_enabled``-Zeichenkette im Rücken → die Dateien, die sie nennen."""
    found: dict[str, set[str]] = {}
    for path in _python_files():
        try:
            tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        except SyntaxError:  # pragma: no cover - defekte Datei ist ein anderer Fehler
            continue
        for node in ast.walk(tree):
            if isinstance(node, ast.Constant) and isinstance(node.value, str):
                if _ENABLED_LITERAL.match(node.value):
                    found.setdefault(node.value, set()).add(str(path.relative_to(_REPO)))
    return found


def test_the_scan_finds_something():
    """Ein Scan, der nichts meldet, muss laut scheitern, nicht still bestehen."""
    literals = _enabled_literals()
    assert len(literals) >= 20, (
        f"Der AST-Scan fand nur {len(literals)} '*_enabled'-Zeichenketten im Rücken. "
        "Am 31.08.2026 waren es 32. Das Messgerät ist kaputt, nicht der Bestand."
    )


def test_every_enabled_literal_is_decided():
    """Kein ``*_enabled``-Name darf unentschieden im Rücken liegen."""
    declared = gate_keys()
    undecided = {
        key: sorted(files)
        for key, files in _enabled_literals().items()
        if key not in declared and key not in _NOT_A_PLATFORM_GATE
    }
    assert not undecided, (
        "Diese '*_enabled'-Schlüssel sind weder als Plattform-Tor erklärt noch "
        "in _NOT_A_PLATFORM_GATE ausgenommen. Entscheide je Schlüssel: gehört er "
        "der Plattform (→ PLATFORM_GATES, mit einem Satz was er anschaltet und "
        "was sein Fehlen kostet), oder einer Welt/einer Epoche (→ Ausnahme, mit "
        f"der gemessenen Tabelle als Begründung)? {undecided}"
    )


def test_no_stale_exclusion():
    """Eine Ausnahme für einen Namen, den niemand mehr nennt, ist Ballast."""
    literals = _enabled_literals()
    stale = sorted(key for key in _NOT_A_PLATFORM_GATE if key not in literals)
    assert not stale, (
        f"Diese Ausnahmen nennen Schlüssel, die der Rücken nicht mehr kennt: {stale}. "
        "Ausnahme entfernen."
    )


def test_no_key_is_both_gate_and_exclusion():
    """Ein Schlüssel gehört genau einer Seite."""
    overlap = sorted(gate_keys() & set(_NOT_A_PLATFORM_GATE))
    assert not overlap, f"Gleichzeitig Tor und Ausnahme: {overlap}"


@pytest.mark.parametrize("gate", PLATFORM_GATES, ids=lambda g: g.key)
def test_gate_reader_actually_reads_it(gate):
    """``reader`` ist eine Zusage: die Datei muss den Schlüssel nennen.

    Der Suchraum ist bewusst Text und nicht AST — vier DRIFT-Tore werden
    ausschließlich in SQL gelesen (die Fun-Kern-RPCs prüfen sie in der
    Transaktion, Migration 264), und ein AST-Test hätte genau die vier
    übersehen und für unbenutzt erklärt.
    """
    path = _REPO / gate.reader
    assert path.exists(), f"{gate.key}: reader-Datei fehlt — {gate.reader}"
    assert gate.key in path.read_text(encoding="utf-8"), (
        f"{gate.key} steht nicht in {gate.reader}. Entweder ist die Lesestelle "
        "umgezogen (reader anpassen) oder das Tor wird nicht mehr gelesen "
        "(Erklärung entfernen)."
    )


@pytest.mark.parametrize("gate", PLATFORM_GATES, ids=lambda g: g.key)
def test_gate_is_fully_explained(gate):
    """Jedes Feld trägt Text; ein leeres erklärt nichts."""
    assert gate.group in GATE_GROUPS, f"{gate.key}: unbekannte Gruppe {gate.group!r}"
    assert gate.label.strip(), f"{gate.key}: ohne Beschriftung"
    assert len(gate.turns_on.strip()) >= 20, f"{gate.key}: 'turns_on' zu knapp"
    assert len(gate.absence_costs.strip()) >= 20, f"{gate.key}: 'absence_costs' zu knapp"


def test_gate_keys_are_unique():
    assert len(gate_keys()) == len(PLATFORM_GATES), "Doppelter Torschlüssel"


def test_groups_are_all_used():
    """Eine Gruppe ohne Tor wäre eine leere Überschrift in der Oberfläche."""
    used = {gate.group for gate in PLATFORM_GATES}
    unused = sorted(set(GATE_GROUPS) - used)
    assert not unused, f"Gruppen ohne Tor: {unused}"


# ── Verdrahtung ────────────────────────────────────────────────────────────
#
# Ein Schalter, dessen Umlegen nichts ändert, ist schlimmer als kein Schalter:
# er verspricht eine Wirkung, die es nicht gibt. Auf Prod stehen fünf solche
# Zeilen (``drift_ai_enabled``, ``drift_p1..p4_enabled``) — am 31.08.2026 über
# ``pg_get_functiondef`` auf der laufenden Datenbank gemessen: null Funktionen
# nennen sie, und im Python nennt sie nichts außer der Erklärung selbst.
#
# Der Test unten reicht nicht an die Datenbank; er misst dieselbe Frage an den
# beiden Quellen, die im Werk liegen: Python-Lesestellen und der SQL-Aufruf
# ``drift_gate_enabled('<key>')``. Beides ist eindeutig, weil der Aufruf den
# Schlüssel wörtlich trägt.

_SQL_GATE_CALL = "drift_gate_enabled('{key}')"
_CONTRACT_FILE = "platform_gate_contracts.py"


def _python_readers(key: str) -> set[str]:
    """Python-Dateien, die den Schlüssel nennen — ohne die Erklärung selbst."""
    return {
        path
        for path in _enabled_literals().get(key, set())
        if not path.endswith(_CONTRACT_FILE)
    }


def _sql_readers(key: str) -> set[str]:
    """Migrationen, die den Schlüssel ausführbar prüfen (nicht bloß erwähnen)."""
    call = _SQL_GATE_CALL.format(key=key)
    return {
        str(p.relative_to(_REPO))
        for p in (_REPO / "supabase" / "migrations").glob("*.sql")
        if call in p.read_text(encoding="utf-8")
    }


@pytest.mark.parametrize("gate", PLATFORM_GATES, ids=lambda g: g.key)
def test_wired_gates_are_actually_read(gate):
    """``wired=True`` heißt: irgendetwas fragt diesen Schlüssel wirklich."""
    if not gate.wired:
        pytest.skip("als unverdrahtet erklärt — siehe test_unwired_gates_are_really_dead")
    readers = _python_readers(gate.key) | _sql_readers(gate.key)
    assert readers, (
        f"{gate.key} ist als verdrahtet erklärt, wird aber weder in einer "
        "Python-Datei gelesen noch über drift_gate_enabled('…') geprüft. "
        "Entweder ist die Lesestelle verschwunden (wired=False setzen) oder "
        "sie liest den Schlüssel unter einem anderen Namen."
    )


@pytest.mark.parametrize(
    "gate", [g for g in PLATFORM_GATES if not g.wired], ids=lambda g: g.key,
)
def test_unwired_gates_are_really_dead(gate):
    """``wired=False`` ist eine Behauptung und muss falsifizierbar bleiben.

    Sobald jemand das Tor anschließt, wird dieser Test rot und zwingt dazu,
    ``wired=True`` zu setzen — damit die Oberfläche aufhört, „vorbereitet,
    nicht angeschlossen" zu sagen, während es längst wirkt.
    """
    readers = _python_readers(gate.key) | _sql_readers(gate.key)
    assert not readers, (
        f"{gate.key} ist als unverdrahtet erklärt, wird aber gelesen: "
        f"{sorted(readers)}. wired=True setzen."
    )
