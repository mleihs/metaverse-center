"""Every difficulty factor must have a reader — bound to the code, not to prose.

`DIFFICULTY_MULTIPLIERS` declares five values per level. Until 2026-08-31
exactly ONE had a consumer. The other four looked like a difficulty model and
were decoration, which is how `calculate_ambient_stress` came to carry its own
inline difficulty term beside a `stress_mult` column nothing read (Befund D13).

`difficulty_contract.py` names each factor and the function that reads it. These
tests hold that declaration to the actual source in both directions, by AST —
a contract nobody checks is how the situation arose in the first place.
"""

from __future__ import annotations

import ast
from functools import cache
from pathlib import Path

import pytest

from backend.services.dungeon.difficulty_contract import DIFFICULTY_FACTORS
from backend.services.dungeon.dungeon_archetypes import DIFFICULTY_MULTIPLIERS

_ROOT = Path(__file__).resolve().parents[3]


@cache
def _keys_read_in(path: str, function: str) -> frozenset[str]:
    """String subscripts used inside one function — `diff_mult["enemy_power"]`.

    Reads the function by name, so moving it inside its file is fine and
    deleting it is not.
    """
    tree = ast.parse((_ROOT / path).read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) and node.name == function:
            return frozenset(
                inner.slice.value
                for inner in ast.walk(node)
                if isinstance(inner, ast.Subscript)
                and isinstance(inner.slice, ast.Constant)
                and isinstance(inner.slice.value, str)
            )
    return frozenset()


class TestTheScanReadsSomething:
    """A scan that finds nothing agrees with every declaration."""

    @pytest.mark.parametrize("factor", sorted(DIFFICULTY_FACTORS))
    def test_the_consumer_function_exists(self, factor):
        contract = DIFFICULTY_FACTORS[factor]
        assert (_ROOT / contract.reads_in).is_file(), f"{contract.reads_in} fehlt"
        keys = _keys_read_in(contract.reads_in, contract.consumer)
        assert keys, (
            f"{contract.consumer} in {contract.reads_in} wurde nicht gefunden oder "
            f"liest keinen einzigen Schlüssel — der Scan zeigt ins Leere"
        )

    def test_a_known_key_is_seen(self):
        """`enemy_condition` was the one factor that always had a reader."""
        contract = DIFFICULTY_FACTORS["enemy_condition"]
        assert "enemy_condition" in _keys_read_in(contract.reads_in, contract.consumer)


class TestDeclarationMatchesTheTable:
    def test_every_column_is_declared(self):
        undeclared = sorted(set(DIFFICULTY_MULTIPLIERS[1]) - set(DIFFICULTY_FACTORS))
        assert not undeclared, (
            f"Spalten ohne Vertrag: {undeclared}. Eine Spalte ohne erklärten "
            f"Leser ist genau der Zustand, den dieser Vertrag beendet hat."
        )

    def test_every_declaration_is_a_column(self):
        stray = sorted(set(DIFFICULTY_FACTORS) - set(DIFFICULTY_MULTIPLIERS[1]))
        assert not stray, f"Vertrag für Spalten, die es nicht gibt: {stray}"

    def test_every_level_carries_every_column(self):
        for level, row in DIFFICULTY_MULTIPLIERS.items():
            missing = sorted(set(DIFFICULTY_FACTORS) - set(row))
            assert not missing, f"Stufe {level} fehlt: {missing}"


class TestEveryFactorIsActuallyRead:
    @pytest.mark.parametrize("factor", sorted(DIFFICULTY_FACTORS))
    def test_the_named_consumer_reads_it(self, factor):
        contract = DIFFICULTY_FACTORS[factor]
        keys = _keys_read_in(contract.reads_in, contract.consumer)
        assert factor in keys, (
            f"'{factor}': der Vertrag nennt {contract.consumer} "
            f"({contract.reads_in}) als Leser, dort wird der Schlüssel aber nicht "
            f"gelesen. Genau so wurden vier von fünf Faktoren zur Dekoration."
        )

    @pytest.mark.parametrize("factor", sorted(DIFFICULTY_FACTORS))
    def test_the_reason_is_written_down(self, factor):
        assert DIFFICULTY_FACTORS[factor].why_here.strip(), (
            f"'{factor}' hat keine Begründung — dann ist die Zuordnung zum Kanal eine Meinung und kein Beschluss"
        )


class TestTheColumnsAreAScale:
    """A difficulty level must differ from its neighbours, or it is not a choice."""

    @pytest.mark.parametrize("factor", ["enemy_power", "enemy_condition", "stress_mult", "loot_quality"])
    def test_values_never_fall_with_difficulty(self, factor):
        values = [DIFFICULTY_MULTIPLIERS[level][factor] for level in sorted(DIFFICULTY_MULTIPLIERS)]
        assert values == sorted(values), f"{factor} fällt: {values}"

    def test_enemy_condition_has_no_flat_step(self):
        """Levels 1 and 2 both carried 1.0 — choosing 2 changed nothing."""
        values = [DIFFICULTY_MULTIPLIERS[level]["enemy_condition"] for level in sorted(DIFFICULTY_MULTIPLIERS)]
        assert len(set(values)) == len(values), f"Zwei Stufen mit gleichem enemy_condition: {values}"

    def test_the_hardest_level_is_meaningfully_harder(self):
        """Measured with scripts/simulate_dungeon_combat.py: the old top value
        of 1.8 produced the same two-round, zero-damage fight as level 1."""
        assert DIFFICULTY_MULTIPLIERS[5]["enemy_condition"] >= 2.5


class TestTheHarnessExists:
    """The numbers above are only defensible while they can be re-derived."""

    def test_the_simulation_script_is_there(self):
        script = _ROOT / "scripts/simulate_dungeon_combat.py"
        assert script.is_file()
        source = script.read_text(encoding="utf-8")
        assert "resolve_combat_round" in source, (
            "Die Simulation muss die ECHTE Engine fahren — eine, die die Regeln "
            "nachbaut, beantwortet eine Frage über sich selbst"
        )
