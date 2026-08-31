"""What each difficulty factor does, and where. One declaration, three readers.

`DIFFICULTY_MULTIPLIERS` in `dungeon_archetypes.py` declares five values per
level. Until the Systemprüfung of 2026-08-31 exactly ONE of them had a reader:
`enemy_condition`, in `dungeon_combat.spawn_enemies`. `enemy_power`,
`stress_mult` and `loot_quality` were consulted nowhere at all (Befund D13).

Worse than three unused numbers: the table was not the source of truth it
looked like. `calculate_ambient_stress` carried its OWN difficulty formula
(`8 + 3*depth + 5*difficulty`) beside a `stress_mult` column that nothing read.
A table declared as the difficulty model and consulted for one of five values
invites every author to add another inline formula — which is what happened.

## Why each factor lives where it lives

The channels have very different resolution, and that decided the assignment:

  enemy_condition → enemy hit points.       Enemy tracks run 1..12 steps.
  enemy_power     → the enemy's attack power BEFORE the >= 7 damage threshold.
  stress_mult     → stress damage and ambient stress.  Range 10..150 per hit.
  loot_quality    → the chance of a tier upgrade in `roll_loot`.
  depth           → how deep the generated dungeon goes.

`enemy_power` deliberately does NOT introduce a finer damage curve. Measured
with `scripts/simulate_dungeon_combat.py` over 480 fights per level: **49 % of
all fights at difficulty 1 end without a single enemy hit landing**, 37 % even
at difficulty 5, median length two to three rounds. A party of four deletes the
median encounter (3 condition steps) before it can act. Widening agent damage —
the obvious reading of "Schaden ist ein Bool" (Befund D14) — would shorten
fights that are already too short and make the problem worse.

What helps when hits are rare is that the rare hit hurts. Scaling
`attack_power` moves enemies across the existing >= 7 threshold instead of
inventing a second formula: 4 of 42 enemies deal two steps at difficulty 1,
19 of 42 at difficulty 5.

## Eine bekannte zweite Wahrheit, die hier NICHT stillschweigend bleibt

`calculate_ambient_stress(depth, difficulty)` in `combat/stress_system.py`
trägt einen eigenen Schwierigkeitsterm (`8 + 3*depth + 5*difficulty`) neben
`stress_mult`. Sie auf die Tabelle umzustellen würde den Umgebungsstress SENKEN
(bei Tiefe 5: heute 28..48, über die Tabelle 18..34) — und die Messung sagt,
dass die Gruppe ohnehin fast nichts abbekommt. Eine Senkung wäre die falsche
Richtung, also bleibt die Formel und die Abweichung steht hier, statt als
stiller Widerspruch zwischen zwei Zahlenquellen weiterzuleben.

## Adding a factor

Add it here with its consumer, then wire it. Without an entry the AST test in
`backend/tests/unit/test_difficulty_contract.py` fails, and so does a factor
that is declared here and read nowhere — in both directions.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class DifficultyFactor:
    """One column of `DIFFICULTY_MULTIPLIERS` and the function that reads it."""

    name: str
    consumer: str
    reads_in: str
    why_here: str


DIFFICULTY_FACTORS: dict[str, DifficultyFactor] = {
    "enemy_condition": DifficultyFactor(
        name="enemy_condition",
        consumer="spawn_enemies",
        reads_in="backend/services/dungeon/dungeon_combat.py",
        why_here="Gegner-Trefferpunkte. Der einzige Faktor, der schon immer gelesen wurde.",
    ),
    "enemy_power": DifficultyFactor(
        name="enemy_power",
        consumer="spawn_enemies",
        reads_in="backend/services/dungeon/dungeon_combat.py",
        why_here=(
            "Skaliert die Angriffsstärke, bevor die bestehende Schwelle >= 7 "
            "greift. Keine zweite Formel: gemessen enden 49 % der Kämpfe ohne "
            "einen einzigen Gegnertreffer, also muss der seltene Treffer "
            "wehtun — nicht der häufige."
        ),
    ),
    "stress_mult": DifficultyFactor(
        name="stress_mult",
        consumer="spawn_enemies",
        reads_in="backend/services/dungeon/dungeon_combat.py",
        why_here=(
            "Skaliert `stress_attack_power` beim Spawn, nicht beim Treffer. "
            "Stress ist der Kanal mit Auflösung (10..150 je Treffer) und der "
            "einzige, der auch dann ankommt, wenn kein Zustandsschaden fällt. "
            "Beim Spawn, weil der Wert zur Begegnung gehört und ein Checkpoint "
            "ihn tragen muss — dieselbe Begründung wie bei `enemy_power`."
        ),
    ),
    "loot_quality": DifficultyFactor(
        name="loot_quality",
        consumer="roll_loot",
        reads_in="backend/services/dungeon/dungeon_loot.py",
        why_here=(
            "Wahrscheinlichkeit einer Stufenanhebung — dieselbe Mechanik, die "
            "die Archetypen schon für ihre eigenen Boni benutzen."
        ),
    ),
    "depth": DifficultyFactor(
        name="depth",
        consumer="get_depth_for_difficulty",
        reads_in="backend/services/dungeon/dungeon_archetypes.py",
        why_here="Tiefe des erzeugten Dungeons.",
    ),
}
