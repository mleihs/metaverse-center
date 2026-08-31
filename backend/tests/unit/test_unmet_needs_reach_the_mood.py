"""Unerfüllte Bedürfnisse werden zu Stimmung (N5, Migration 306).

Bis zum 31.08.2026 fielen die Bedürfnisse und niemand fühlte es.
`fn_decay_agent_needs` senkte fünf Zahlen je Tick, und KEIN Dienst und keine
Funktion machte daraus je ein Moodlet — gemessen: null.

Das war die Ursache hinter N5, und es waren nicht vier Befunde, sondern einer:

    EINE Quelle negativer Stimmung (resonance_pressure, −1, eine Zeile je Agent)
      → die Laune kann −1 nicht unterschreiten
      → insult (−20), seek_comfort (−30), confrontation (−40) nie wählbar
      → keine negativen Meinungen → relationship_threshold (±60) tot
      → kein Stressaufbau (Tor bei mood < −20) → stress_breakdown (800) tot

**Um unglücklich zu werden, musste ein Agent beleidigt werden; um zu
beleidigen, musste er unglücklich sein.**

WAS DIESE DATEI PRÜFT — UND WAS AUSDRÜCKLICH NICHT
--------------------------------------------------
Geprüft werden die EIGENSCHAFTEN der Regeltabelle und die Verdrahtung, nicht
die Balance-Zahlen. Eine Zusicherung wie ``threshold == 40`` würde jede
gemessene Nachjustierung zur Teständerung machen und eine Momentaufnahme wie
eine Spezifikation aussehen lassen (Lehre J7). Die Zahlen stammen aus
``scripts/measure_mood_reachability.py``; wer sie ändert, misst vorher.

Geprüft wird stattdessen: jede Stärke ist negativ (eine positive würde ein
unerfülltes Bedürfnis zu einer Belohnung machen), jede Schwelle liegt im
Wertebereich der Bedürfnisse, kein Moodlet kann den CHECK von
``agent_moodlets.strength`` verletzen, die Regel gilt für ALLE fünf
Bedürfnisse, und der Aufruf steht im Tick zwischen Zerfall und
Stimmungsrechnung — nicht dahinter.
"""

from __future__ import annotations

import ast
import inspect
import re
from pathlib import Path

import pytest

from backend.services.agent_needs_service import NEED_MOODLETS, NEED_TYPES, AgentNeedsService

BACKEND = Path(__file__).resolve().parents[2]
REPO = BACKEND.parent
MIGRATION = REPO / "supabase/migrations/20260831150000_306_unmet_needs_reach_the_mood.sql"

#: Der CHECK auf agent_moodlets.strength, gemessen auf Prod.
STRENGTH_FLOOR = -20
#: Der Wertebereich der Bedürfnisse.
NEED_MIN, NEED_MAX = 0, 100


class TestTheRuleCoversEveryNeed:
    def test_all_five_needs_have_a_rule(self) -> None:
        assert set(NEED_MOODLETS) == set(NEED_TYPES), (
            "Ein Bedürfnis ohne Regel fällt weiter, ohne dass es jemand fühlt — "
            f"fehlt: {sorted(set(NEED_TYPES) - set(NEED_MOODLETS))}"
        )

    def test_every_rule_is_complete(self) -> None:
        for need, rule in NEED_MOODLETS.items():
            for field in ("threshold", "strength", "step", "emotion", "moodlet_type"):
                assert field in rule, f"{need}: {field} fehlt"


class TestTheRulesProperties:
    """Eigenschaften, nicht Zahlen (J7)."""

    @pytest.mark.parametrize("need", sorted(NEED_MOODLETS))
    def test_the_strength_is_negative(self, need: str) -> None:
        assert NEED_MOODLETS[need]["strength"] < 0, (
            f"{need}: eine positive Stärke machte ein unerfülltes Bedürfnis zur Belohnung"
        )

    @pytest.mark.parametrize("need", sorted(NEED_MOODLETS))
    def test_the_threshold_is_inside_the_range(self, need: str) -> None:
        threshold = NEED_MOODLETS[need]["threshold"]
        assert NEED_MIN < threshold <= NEED_MAX, (
            f"{need}: eine Schwelle bei {threshold} ist entweder nie oder immer erreicht — "
            "genau der Fehler, den N5 beschreibt"
        )

    @pytest.mark.parametrize("need", sorted(NEED_MOODLETS))
    def test_the_step_is_positive(self, need: str) -> None:
        assert NEED_MOODLETS[need]["step"] > 0, f"{need}: eine Stufe von 0 teilt durch null"

    @pytest.mark.parametrize("need", sorted(NEED_MOODLETS))
    def test_no_reachable_level_can_violate_the_check(self, need: str) -> None:
        """Der schlimmste Fall ist ein Bedürfnis bei 0 — auch der muss passen."""
        rule = NEED_MOODLETS[need]
        steps = 1 + (rule["threshold"] - NEED_MIN) // rule["step"]
        worst = rule["strength"] * steps
        assert worst >= STRENGTH_FLOOR, (
            f"{need}: bei Stand 0 ergäbe die Regel {worst}, der CHECK auf "
            f"agent_moodlets.strength lässt aber nur bis {STRENGTH_FLOOR} zu. "
            "Die Migration klemmt es zwar ab, aber dann ist die Regel nicht mehr "
            "die, die hier steht."
        )

    def test_the_rule_can_actually_open_a_gate(self) -> None:
        """Die Regel muss stark genug sein, um überhaupt etwas zu bewirken.

        Das ist die Prüfung, die N5 selbst gebraucht hätte. Wären alle fünf
        Bedürfnisse am Boden, muss die Summe unter −20 kommen — sonst bliebe
        `fn_update_stress_levels` (Tor bei mood < −20) auch weiterhin
        unerreichbar, und die ganze Mechanik wäre wieder eine Tür ohne Schloss.
        """
        total = 0
        for rule in NEED_MOODLETS.values():
            steps = 1 + (rule["threshold"] - NEED_MIN) // rule["step"]
            total += max(STRENGTH_FLOOR, rule["strength"] * steps)
        assert total < -20, (
            f"Alle fünf Bedürfnisse am Boden ergäben {total}. Das Stress-Tor liegt "
            "bei −20 — mit dieser Regel bliebe es geschlossen, und N5 wäre nicht "
            "behoben, sondern nur teurer geworden."
        )


class TestItIsWiredIntoTheTick:
    def test_the_call_sits_between_decay_and_mood(self) -> None:
        """Die Reihenfolge ist die Aussage.

        Hinter der Stimmungsphase hinkte die Laune dem Bedürfnis um einen Tick
        hinterher — vier Stunden, in denen die Welt etwas anderes anzeigt als
        sie ist.
        """
        source = (BACKEND / "services" / "heartbeat_service.py").read_text(encoding="utf-8")
        decay = source.index("AgentNeedsService.decay_all(")
        moodlets = source.index("AgentNeedsService.apply_need_moodlets(")
        mood = source.index("AgentMoodService.process_tick(")
        assert decay < moodlets < mood, (
            "Die Bedürfnis-Moodlets müssen NACH dem Zerfall und VOR der "
            "Stimmungsrechnung stehen"
        )

    def test_the_tick_summary_carries_the_count(self) -> None:
        """Eine Phase, die nichts meldet, ist eine Phase, die niemand vermisst."""
        source = (BACKEND / "services" / "heartbeat_service.py").read_text(encoding="utf-8")
        assert '"need_moodlets": need_moodlets' in source

    def test_the_service_passes_the_whole_table(self) -> None:
        source = inspect.getsource(AgentNeedsService.apply_need_moodlets)
        tree = ast.parse(inspect.cleandoc(source))
        rpcs = [
            node.args[0].value
            for node in ast.walk(tree)
            if isinstance(node, ast.Call)
            and getattr(node.func, "attr", None) == "rpc"
            and node.args
            and isinstance(node.args[0], ast.Constant)
        ]
        assert rpcs == ["fn_apply_need_moodlets"], rpcs
        assert "NEED_MOODLETS" in source, "die Regeln müssen als Ganzes hineingereicht werden"

    def test_a_failure_costs_the_mood_not_the_tick(self) -> None:
        source = inspect.getsource(AgentNeedsService.apply_need_moodlets)
        assert "except" in source and "return 0" in source
        assert "capture_exception" in source, "ein stiller Fehlschlag ist keiner (Beobachtbarkeit)"


class TestTheMigration:
    @pytest.fixture(scope="class")
    def sql(self) -> str:
        assert MIGRATION.is_file(), f"Migration nicht gefunden: {MIGRATION}"
        return MIGRATION.read_text(encoding="utf-8")

    def _body(self, sql: str) -> str:
        """Nur der Funktionskörper, ohne Kommentare (J3b).

        Der Kopf nennt die Schwellen und Stärken absichtlich, um den Befund zu
        erklären. Eine dateiweite Suche fände genau diese Erklärung.
        """
        start = sql.index("AS $$")
        return re.sub(r"--[^\n]*", "", sql[start : sql.index("$$;", start)])

    def test_it_replaces_rather_than_accumulates(self, sql: str) -> None:
        body = self._body(sql)
        delete = body.index("DELETE FROM agent_moodlets")
        insert = body.index("INSERT INTO agent_moodlets")
        assert delete < insert, (
            "Erst löschen, dann setzen. Andersherum wäre es das ungedeckelte "
            "Stapeln, das D10-5 gerade beseitigt hat."
        )

    def test_no_balance_number_lives_in_the_sql(self, sql: str) -> None:
        """Die Zahlen gehören nach NEED_MOODLETS, nicht hierher."""
        body = self._body(sql)
        for number in ("40", "-3", "10"):
            assert f"threshold = {number}" not in body
        assert "jsonb_each(p_rules)" in body, "die Regeln müssen von außen kommen"

    def test_it_uses_no_dynamic_sql(self, sql: str) -> None:
        """Fünf Spaltennamen zusammenzusetzen wäre die naheliegende Falle."""
        body = self._body(sql)
        assert "EXECUTE" not in body.upper().replace("EXECUTE FUNCTION", "")
        assert "CROSS JOIN LATERAL (VALUES" in body

    def test_every_need_appears_in_the_unpivot(self, sql: str) -> None:
        body = self._body(sql)
        for need in NEED_TYPES:
            assert f"'{need}'" in body, f"{need} fehlt in der Entpivotierung"

    def test_it_clamps_to_the_check(self, sql: str) -> None:
        body = self._body(sql)
        assert "GREATEST(\n        -20," in body or "GREATEST(-20" in body or "-20," in body

    def test_it_is_not_security_definer(self, sql: str) -> None:
        assert "SECURITY INVOKER" in sql
        assert "SECURITY DEFINER" not in sql
