"""Bind the loot-effect declaration to the code that is supposed to honour it.

`backend/services/dungeon_loot_contracts.py` says which loot effect takes hold
where. A declaration nobody checks is how the original defect happened in the
first place — `simulation_modifier` was "supported" from migration 174 onward,
in an overload nothing ever called — so these tests read the actual consumers
(the migration's SQL, the Python applier's AST) instead of trusting the prose.

Each scanning test carries a self-test: if the scan finds *nothing at all*, the
test fails rather than passing vacuously. Four measurements went green while
pointing at the wrong thing during the Forge run of the same week; a scan that
cannot fail is not a measurement.
"""

from __future__ import annotations

import ast
import re
from pathlib import Path

import pytest

from backend.models.combat import AgentCombatState
from backend.models.resonance_dungeon import DungeonInstance, RoomNode
from backend.services.dungeon.dungeon_run_buffs import (
    MAX_STRESS_RESIST,
    apply_run_buff,
    consume_stress_resist,
    rest_heal_multiplier,
)
from backend.services.dungeon_loot_contracts import (
    BUFF_SHAPES,
    LOOT_EFFECT_CONTRACTS,
    OPEN_BUFF_KEYS,
    WIRED_BUFF_KEYS,
)

_REPO = Path(__file__).resolve().parents[3]
_MIGRATION = _REPO / "supabase/migrations/20260831000000_289_dungeon_loot_effects_reach_the_running_path.sql"
_APPLIER = _REPO / "backend/services/dungeon/dungeon_run_buffs.py"


def _sql_effect_types() -> set[str]:
    """Effect types the running 3-arg RPC branches on, read from the migration."""
    sql = _MIGRATION.read_text(encoding="utf-8")
    found: set[str] = set()
    for match in re.finditer(r"v_effect_type\s*=\s*'([a-z_]+)'", sql):
        found.add(match.group(1))
    for match in re.finditer(r"v_effect_type\s+IN\s*\(([^)]*)\)", sql):
        found.update(re.findall(r"'([a-z_]+)'", match.group(1)))
    return found


def _applier_param_reads() -> set[str]:
    """Parameter names `apply_run_buff` actually reads out of effect_params."""
    tree = ast.parse(_APPLIER.read_text(encoding="utf-8"))
    fn = next(
        node
        for node in ast.walk(tree)
        if isinstance(node, ast.FunctionDef) and node.name == "apply_run_buff"
    )
    names: set[str] = set()
    for node in ast.walk(fn):
        # effect_params.get("<name>") — the only way this function reads a param
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr == "get"
            and isinstance(node.func.value, ast.Name)
            and node.func.value.id == "effect_params"
            and node.args
            and isinstance(node.args[0], ast.Constant)
        ):
            names.add(node.args[0].value)
    return names


class TestScannersActuallyFindSomething:
    """The self-test. A green scan that reads nothing proves nothing."""

    def test_migration_file_exists(self):
        assert _MIGRATION.is_file(), f"Migration nicht gefunden: {_MIGRATION}"

    def test_sql_scan_is_not_empty(self):
        found = _sql_effect_types()
        assert len(found) >= 8, f"SQL-Scan fand nur {found} — Muster stimmt nicht mehr"

    def test_ast_scan_is_not_empty(self):
        found = _applier_param_reads()
        assert found, "AST-Scan fand keinen einzigen Parameterzugriff — Muster stimmt nicht"


class TestEveryDeclaredEffectHasAConsumer:
    def test_sql_effects_are_declared(self):
        for effect_type in _sql_effect_types():
            assert effect_type in LOOT_EFFECT_CONTRACTS, (
                f"Die Migration behandelt '{effect_type}', der Vertrag kennt ihn nicht"
            )

    def test_declared_sql_effects_are_in_the_migration(self):
        sql_types = _sql_effect_types()
        for name, contract in LOOT_EFFECT_CONTRACTS.items():
            if "SQL" not in contract.consumer:
                continue
            assert name in sql_types, (
                f"Der Vertrag sagt, '{name}' werde in SQL angewandt — "
                f"die laufende Funktion verzweigt aber nicht darauf"
            )

    def test_the_two_restored_branches_are_present(self):
        """The whole point of migration 289: these existed only in a dead overload."""
        sql_types = _sql_effect_types()
        assert "simulation_modifier" in sql_types
        assert "personality_modifier" in sql_types

    def test_unknown_types_are_no_longer_silent(self):
        """The ELSE branch must name the type, not merely count.

        Checking that "'effect_type', v_effect_type" appears *somewhere* in the
        migration is not enough — it appears five times, once per skip reason.
        The claim is about THIS branch, so the assertion reads THIS branch.
        """
        sql = _MIGRATION.read_text(encoding="utf-8")
        assert "unknown_effect_type" in sql, "Der ELSE-Zweig fehlt"

        # The jsonb object the ELSE branch builds: from the last bare `ELSE`
        # of the type chain up to the `unknown_effect_type` reason.
        start = sql.rindex("\n        ELSE\n")
        end = sql.index("unknown_effect_type", start)
        else_branch = sql[start:end]

        assert "'effect_type', v_effect_type" in else_branch, (
            "Der ELSE-Zweig zählt hoch, nennt aber den Typ nicht — "
            "dann sagt die Warnung nicht, WAS verfallen ist"
        )
        assert "v_skipped" in else_branch, (
            "Der ELSE-Zweig schreibt nicht nach `skipped` — dann bleibt der "
            "Verlust so unsichtbar wie vorher"
        )


class TestBuffShapesMatchTheApplier:
    def test_wired_shapes_are_read_by_the_applier(self):
        reads = _applier_param_reads()
        for key in WIRED_BUFF_KEYS:
            assert key in reads, (
                f"'{key}' gilt als verdrahtet, apply_run_buff liest ihn aber nicht"
            )

    def test_open_shapes_are_not_read(self):
        reads = _applier_param_reads()
        for key in OPEN_BUFF_KEYS:
            assert key not in reads, (
                f"'{key}' gilt als offen, wird aber gelesen — "
                f"dann gehört er nach WIRED (Vertrag anpassen)"
            )

    def test_every_shape_is_classified(self):
        assert WIRED_BUFF_KEYS | OPEN_BUFF_KEYS == set(BUFF_SHAPES)
        assert not (WIRED_BUFF_KEYS & OPEN_BUFF_KEYS)

    def test_open_shapes_carry_a_reason(self):
        for key in OPEN_BUFF_KEYS:
            assert BUFF_SHAPES[key].reason.strip(), (
                f"'{key}' ist offen ohne Begründung — dann ist es kein Beschluss, "
                f"sondern ein Versäumnis"
            )


# ── Verhalten des Anwenders ────────────────────────────────────────────────


def _instance() -> DungeonInstance:
    agent = AgentCombatState(
        agent_id=__import__("uuid").uuid4(),
        agent_name="A",
        stress=0,
        condition="operational",
        aptitudes={"guardian": 3},
        personality={"openness": 0.5},
        resilience=0.5,
    )
    rooms = [
        RoomNode(index=i, depth=i, room_type="combat", connections=[], loot_tier=1)
        for i in range(3)
    ]
    return DungeonInstance(
        run_id=__import__("uuid").uuid4(),
        simulation_id=__import__("uuid").uuid4(),
        archetype="The Tower",
        signature="conflict_wave",
        difficulty=3,
        rooms=rooms,
        party=[agent],
    )


class TestApplyRunBuff:
    def test_check_bonus_joins_the_existing_accumulator(self):
        inst = _instance()
        assert apply_run_buff(inst, {"aptitude": "guardian", "check_bonus": 5}) == ["check_bonus"]
        # The key the two skill-check sites already read.
        assert inst.archetype_state["_debris_check_bonuses"]["guardian"] == 5
        apply_run_buff(inst, {"aptitude": "guardian", "check_bonus": 3})
        assert inst.archetype_state["_debris_check_bonuses"]["guardian"] == 8

    def test_stress_resist_takes_the_stronger_not_the_sum(self):
        inst = _instance()
        apply_run_buff(inst, {"stress_resist": 0.1, "duration_rooms": 4})
        apply_run_buff(inst, {"stress_resist": 0.2, "duration_rooms": 2})
        assert inst.archetype_state["_run_stress_resist"] == 0.2
        assert inst.archetype_state["_run_stress_resist_rooms"] == 4

    def test_stress_resist_is_capped(self):
        inst = _instance()
        apply_run_buff(inst, {"stress_resist": 5.0, "duration_rooms": 1})
        assert inst.archetype_state["_run_stress_resist"] == MAX_STRESS_RESIST

    def test_resist_counts_down_and_expires(self):
        inst = _instance()
        apply_run_buff(inst, {"stress_resist": 0.25, "duration_rooms": 2})
        assert consume_stress_resist(inst) == pytest.approx(0.75)
        assert consume_stress_resist(inst) == pytest.approx(0.75)
        # third room: expired, full ambient stress again
        assert consume_stress_resist(inst) == 1.0
        assert "_run_stress_resist" not in inst.archetype_state

    def test_no_resist_is_a_neutral_multiplier(self):
        assert consume_stress_resist(_instance()) == 1.0

    def test_rest_bonus_accumulates(self):
        inst = _instance()
        assert rest_heal_multiplier(inst) == 1.0
        apply_run_buff(inst, {"rest_bonus": 0.25})
        assert rest_heal_multiplier(inst) == pytest.approx(1.25)

    def test_open_shape_applies_nothing(self):
        """A listed design gap must stay a no-op, not a half-effect."""
        inst = _instance()
        assert apply_run_buff(inst, {"aptitude": "spy", "bonus_pct": 5}) == []
        assert inst.archetype_state == {}


# ── Jede Wirkungsart erklärt sich ───────────────────────────────────────────


def test_every_contract_says_what_it_does_in_both_languages() -> None:
    """Ein Vertrag ohne Erklärung ist ein Katalogeintrag ohne Bedeutung.

    Der Beutekatalog der Hilfe liest ``summary_en``/``summary_de`` aus DIESER
    Datei — nicht aus einer eigenen Tabelle im Frontend. Der Grund ist derselbe,
    aus dem das Modul überhaupt existiert: eine zweite Wahrheit über dieselbe
    Mechanik driftet, und zwar unsichtbar. Am 01.09.2026 stand im Hilfesystem
    die Zustandsleiter ``good → moderate → poor → ruined``, die der Code seit
    Migration 303 nicht mehr kennt; ``moderate`` ist auf keiner Leiter eine
    Sprosse.

    Ohne diesen Test wäre eine neue Wirkungsart einfach ohne Satz im Katalog
    gelandet — sichtbar als leere Stelle, aber ohne dass irgendetwas rot wird.
    """
    ohne = [
        name
        for name, vertrag in LOOT_EFFECT_CONTRACTS.items()
        if not vertrag.summary_en.strip() or not vertrag.summary_de.strip()
    ]
    assert not ohne, f"Wirkungsarten ohne Erklärung: {', '.join(sorted(ohne))}"


def test_summaries_are_sentences_not_labels() -> None:
    """Eine Erklärung, die kürzer ist als ihr eigener Schlüssel, erklärt nichts.

    Die Untergrenze ist absichtlich niedrig (40 Zeichen) und trotzdem eine
    Grenze: sie fängt den Fall ab, in dem jemand ``summary_de="Stressheilung"``
    schreibt, um den Test darüber grün zu bekommen. Das wäre der Schlüssel noch
    einmal, nicht seine Bedeutung.
    """
    zu_kurz = {
        name: min(len(v.summary_en), len(v.summary_de))
        for name, v in LOOT_EFFECT_CONTRACTS.items()
        if min(len(v.summary_en), len(v.summary_de)) < 40
    }
    assert not zu_kurz, f"Erklärungen zu kurz, um eine zu sein: {zu_kurz}"
