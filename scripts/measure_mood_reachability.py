#!/usr/bin/env python
"""Kann die Welt überhaupt unglücklich werden? Und ab welcher Regel?

WOZU DAS SKRIPT
---------------
Befund N5: vier von fünf Auslösern autonomer Ereignisse sind unerreichbar, und
sie sind es aus EINEM Grund — es gibt genau eine Quelle negativer Stimmung
(``resonance_pressure``, Stärke −1, gedeckelt auf eine Zeile je Agent). Die
Laune kann −1 nicht unterschreiten, also wird nie beleidigt, also fällt keine
Meinung unter 0, also erhöht ``fn_update_stress_levels`` (Tor bei
``mood_score < -20``) nie den Stress.

Der naheliegende Weg — Bedürfnisse erzeugen Moodlets — verlangt zwei Zahlen je
Bedürfnis: ab welchem Stand, und wie stark. **Diese Zahlen sollen nicht
geraten werden.** Lehre J7: Balance-Zahlen gehören in ein Messskript, nicht in
eine Gleichheitszusicherung, sonst sieht eine Momentaufnahme aus wie eine
Spezifikation.

WAS ES TUT
----------
Es liest die ECHTEN Bedürfnisstände (nur lesend), fährt sie über N Ticks weiter
und rechnet für ein Raster von Kandidatenregeln aus, welche Laune daraus folgt
und welche Tore sich damit öffnen:

    mood < −20   →  fn_update_stress_levels beginnt, Stress aufzubauen
    mood < −20   →  `insult` wird wählbar
    mood < −30   →  `seek_comfort_interaction` wird wählbar
    mood < −40   →  `confrontation` wird wählbar

Die Netto-Zehrung je Tick ist ein PARAMETER, kein gemessener Wert: wie viel ein
Agent je Tick zurückgewinnt, hängt an seinen Tätigkeiten, und das ist selbst
eine Regelgröße. Statt eine Zahl zu erfinden, fächert das Skript sie auf und
zeigt, wie empfindlich das Ergebnis darauf reagiert.

⚠ WELCHE SPALTE MAN LESEN DARF
------------------------------
**Nur die Spalte „0 Ticks" ist eine Messung.** Sie rechnet mit den ECHTEN
Bedürfnisständen von Prod und sagt: so viele Agenten wären unter dieser Regel
heute unglücklich.

Die Spalten darüber hinaus sind eine lineare Fortschreibung, und sie
**überzeichnen**. Grund: `AgentActivityService._compute_need_bonus` gibt einer
Tätigkeit bis zu **+30 Nutzen**, wenn sie ein niedriges Bedürfnis deckt
(`(60 - stand) / 2`). Ein Agent mit `social = 0` zieht also mit voller Kraft
zum Geselligsein — das System hat eine Gegenkopplung, die dieses Skript nicht
nachbildet.

Die gemessenen −0,45 und −0,61 je Tick sind deshalb eine
GLEICHGEWICHTSRATE über eine Bevölkerung, in der die meisten Agenten satt
sind, keine Bahn eines einzelnen Agenten im freien Fall. Wer die
120-Tick-Spalte als Vorhersage liest, liest ein Modell, nicht die Welt.

Das ist dieselbe Falle wie [[measure-then-read-the-thing]]: eine Rate ist keine
Bahn.

WAS ES NICHT TUT
----------------
Es schreibt nichts, weder auf Prod noch sonstwo, und es wählt keine Zahl. Es
legt die Wahl auf den Tisch.

    .venv/bin/python scripts/measure_mood_reachability.py
    .venv/bin/python scripts/measure_mood_reachability.py --ticks 30 --net-decay 0 1 2
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from dataclasses import dataclass

PROJECT = "bffjoupddfjaljqrwqck"

NEED_TYPES = ("social", "purpose", "safety", "comfort", "stimulation")

# Die eine negative Quelle, die es heute gibt. Sie bleibt in jeder Rechnung
# stehen, damit die Zahlen mit dem Bestand vergleichbar sind.
RESONANCE_PRESSURE = -1

# ── Die gemessene Bedürfnisdeckung ────────────────────────────────────────
#
# Der erste Entwurf dieses Skripts hatte hier einen frei gewählten Parameter
# („Netto-Zehrung"), und das machte es unbrauchbar: bei 0 bis 2 fielen alle
# Bedürfnisse auf 0, und JEDE Kandidatenregel endete nach 30 Ticks mit 258 von
# 258 Agenten im Zusammenbruch. Das Skript maß eine Welt, in der niemand etwas
# tut — und konnte die Regeln deshalb auf der Achse, um die es geht, gar nicht
# unterscheiden.
#
# Es gibt die Zahl aber. Gemessen auf Prod, Fenster 7 Tage (31.08.2026):
#
#   4 572 Tätigkeiten · 258 Agenten · 563 Welt-Ticks über 36 Welten
#   → 1,13 Tätigkeiten je Agent und Tick
#
# Durch ACTIVITY_NEED_FULFILLMENT gerechnet ergibt das die Deckung je Bedürfnis
# und Tick, und daraus die NETTOBEWEGUNG gegen die Zerfallsrate:
#
#   social       Deckung 4,55  Zehrung 5,0  → −0,45  fällt langsam
#   stimulation  Deckung 3,39  Zehrung 4,0  → −0,61  fällt langsam
#   purpose      Deckung 4,21  Zehrung 3,0  → +1,21  erholt sich
#   comfort      Deckung 6,08  Zehrung 2,0  → +4,08  erholt sich
#   safety       Deckung 2,03  Zehrung 2,0  →  0,00  steht
#
# Die Welt ist also NICHT im freien Fall: zwei von fünf Bedürfnissen sinken,
# und langsam. Das deckt sich mit dem Bestand — `social` reicht von 0 bis 97
# (einzelne Agenten sind verhungert), `stimulation` von 28 bis 76, während
# `purpose` bei mindestens 58 und `comfort` bei mindestens 52 steht.
#
# Aus einer erfundenen Zahl ist damit eine gemessene geworden. Wer sie
# nachrechnen will: `--fulfilment` überschreibt sie.
MEASURED_FULFILMENT: dict[str, float] = {
    "social": 4.55,
    "purpose": 4.21,
    "safety": 2.03,
    "comfort": 6.08,
    "stimulation": 3.39,
}

# Die Tore, um die es geht. Quelle jeweils daneben, damit niemand sie hier
# nachpflegen muss, ohne die Stelle zu kennen.
GATES: tuple[tuple[str, int, str], ...] = (
    ("Stress baut sich auf", -20, "fn_update_stress_levels"),
    ("insult wählbar", -20, "SOCIAL_INTERACTIONS['insult'].mood_range"),
    ("seek_comfort wählbar", -30, "SOCIAL_INTERACTIONS['seek_comfort_interaction']"),
    ("confrontation wählbar", -40, "SOCIAL_INTERACTIONS['confrontation']"),
)


@dataclass(frozen=True)
class Rule:
    """Eine Kandidatenregel: ab welchem Stand, wie stark, wie viele Stufen."""

    threshold: int
    strength: int
    #: Ob ein Bedürfnis mehrere Moodlets erzeugen kann (eine Stufe je
    #: angefangene `step`-Spanne unter der Schwelle) oder höchstens eines.
    step: int | None = None
    #: Untergrenze für den GESAMTEN Beitrag der Bedürfnis-Moodlets. Ohne sie
    #: läuft jede abgestufte Regel davon: die Bedürfnisse fallen weiter, die
    #: Stufen wachsen mit, und nach 30 Ticks steht die ganze Welt im
    #: Zusammenbruch. Die Grenze ist das, was die Regel überhaupt erst
    #: brauchbar macht — nicht eine Vorsichtsmaßnahme obendrauf.
    floor: int | None = None

    def moodlets_for(self, level: float) -> int:
        if level >= self.threshold:
            return 0
        if self.step is None:
            return 1
        return 1 + int((self.threshold - level) // self.step)

    def label(self) -> str:
        gestuft = f", Stufe je {self.step}" if self.step else ""
        boden = f", Boden {self.floor}" if self.floor is not None else ""
        return f"unter {self.threshold} → {self.strength}{gestuft}{boden}"


def _token() -> str:
    for line in open(".env", encoding="utf-8"):
        if line.startswith("SUPABASE_MCP_TOKEN="):
            return line.split("=", 1)[1].strip().strip('"')
    raise SystemExit("kein SUPABASE_MCP_TOKEN in .env")


def _query(sql: str) -> list[dict]:
    proc = subprocess.run(
        [
            "curl", "-sS", "-X", "POST",
            f"https://api.supabase.com/v1/projects/{PROJECT}/database/query",
            "-H", f"Authorization: Bearer {_token()}",
            "-H", "Content-Type: application/json",
            "--data", "@-",
        ],
        input=json.dumps({"query": sql}),
        capture_output=True,
        text=True,
        check=True,
    )
    payload = json.loads(proc.stdout)
    if isinstance(payload, dict):
        raise SystemExit(f"SQL-Fehler: {payload.get('message')}")
    return payload


def load_needs() -> list[dict]:
    """Die echten Bedürfnisstände, nur lesend."""
    rows = _query(
        "select agent_id::text, social, purpose, safety, comfort, stimulation, "
        "social_decay, purpose_decay, safety_decay, comfort_decay, stimulation_decay "
        "from agent_needs"
    )
    if not rows:
        raise SystemExit("agent_needs ist leer — ohne Bestand misst das Skript nichts")
    return rows


def project(row: dict, ticks: int, share: float) -> dict[str, float]:
    """Die fünf Bedürfnisse nach `ticks` Ticks.

    ``share`` skaliert die GEMESSENE Deckung: 1,0 heißt „so tätig wie heute",
    0,5 „halb so tätig", 0,0 „niemand tut etwas" (die pessimistische Schranke).
    Ein Anteil ist ehrlicher als eine erfundene Zehrung, weil er die Frage
    stellt, die man beantworten kann: was, wenn die Welt weniger handelt als
    heute?
    """
    out: dict[str, float] = {}
    for need in NEED_TYPES:
        zehrung = float(row.get(f"{need}_decay") or 0.0)
        netto = zehrung - MEASURED_FULFILMENT.get(need, 0.0) * share
        out[need] = max(0.0, min(100.0, float(row[need]) - netto * ticks))
    return out


def mood_for(levels: dict[str, float], rule: Rule) -> int:
    """Die Laune, die aus diesen Bedürfnisständen unter dieser Regel folgt."""
    beitrag = sum(rule.moodlets_for(levels[need]) * rule.strength for need in NEED_TYPES)
    if rule.floor is not None:
        beitrag = max(beitrag, rule.floor)
    return RESONANCE_PRESSURE + beitrag


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ticks", type=int, nargs="+", default=[0, 10, 30])
    parser.add_argument("--share", type=float, nargs="+", default=[1.0, 0.75, 0.5, 0.0],
                        help="Anteil der gemessenen Deckung: 1,0 = so tätig wie heute")
    parser.add_argument(
        "--rules",
        type=str,
        default="40:-3:10:-24,40:-3:10:-32,40:-3:10:-45,40:-4:10:-32,30:-3:10:-32",
        help="Kommaliste `schwelle:stärke[:stufe[:boden]]`",
    )
    args = parser.parse_args()

    rules = []
    for spec in args.rules.split(","):
        parts = spec.split(":")
        rules.append(
            Rule(
                int(parts[0]),
                int(parts[1]),
                int(parts[2]) if len(parts) > 2 and parts[2] else None,
                int(parts[3]) if len(parts) > 3 and parts[3] else None,
            )
        )

    rows = load_needs()
    print(f"{len(rows)} Agenten aus agent_needs gelesen (nur lesend, nichts geschrieben)\n")

    # Der Ausgangszustand, damit die Zahlen einen Bezug haben.
    heute = _query(
        "select min(mood_score) as min, max(mood_score) as max, "
        "count(*) filter (where mood_score < -20) as unter20 from agent_mood"
    )[0]
    print(
        f"Ist-Zustand: Laune {heute['min']} bis {heute['max']}, "
        f"{heute['unter20']} von {len(rows)} Agenten unter −20\n"
    )

    for rule in rules:
        print(f"── Regel: {rule.label()} ──")
        header = f"{'Tätigkeit':>14} │ " + " │ ".join(f"{t:>3} Ticks" for t in args.ticks)
        print(header)
        print("─" * len(header))
        for net in args.share:
            cells = []
            for ticks in args.ticks:
                moods = [mood_for(project(row, ticks, net), rule) for row in rows]
                worst = min(moods)
                below20 = sum(1 for m in moods if m < -20)
                cells.append(f"{worst:>4} │{below20:>4}")
            print(f"{net:>13.0%}  │ " + " │ ".join(cells))
        print("   Zellen: schlechteste Laune │ Agenten unter −20\n")

    print("Die Tore, um die es geht:")
    for name, gate, source in GATES:
        print(f"  {name:<24} mood < {gate:>4}   ({source})")
    print(
        "\nDas Skript wählt keine Zahl. Eine Regel taugt, wenn sie unter der\n"
        "REALISTISCHEN Netto-Zehrung Tore öffnet und unter der pessimistischen\n"
        "nicht die halbe Welt in den Zusammenbruch schickt."
    )
    return 0


if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    sys.exit(main())
