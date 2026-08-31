"""Eine Welt darf ihre eigenen Sprossen setzen (T3, Migration 311).

BEFUND
------
Migration 303 hat die Zustandsleiter an eine Stelle gelegt und Bauten auf
weltspezifischen Werten ausdrücklich neben ihr stehen lassen. Nachgemessen sind
das **23 Bauten auf zwölf Werten** — `pristine`, `illuminated`, `restored`,
`sealed`, `anomalous`, `thriving`, `obsolete`, `functional`, `preserved`,
`compromised`, `operational`, `restricted`. An ihnen laufen Sabotage und
Krisenereignisse wirkungslos vorbei.

Zwölf Werte einer Sprosse zuzuordnen wären zwölf Aussagen über die Fiktion von
zwölf Welten. Eine Migration darf das nicht erraten. Sie baut deshalb den
MECHANISMUS (`metadata->>'rung'` je Taxonomiezeile) und benutzt ihn für den
einen Wert, dessen Lage unstrittig ist: `pristine`, sechs Bauten in fünf Welten,
Deutsch gemessen (`makellos`, 5 von 6).

🔑 **Und dabei kehrt sich die Regel aus 308 um.** 308 hat die DATEN unter dem
Verfall abgeschlossen: jede erreichbare Sprosse steht im Vokabular. `pristine`
verlängert die Leiter aber nach OBEN — und eine Reparatur von `excellent` würde
in 26 Welten, die `pristine` nicht führen, einen unbenennbaren Wert schreiben.
Ein Datenabschluss nach oben wäre falsch (er erfände 26 Welten ein Wort). Der
richtige Ort ist die OPERATION: ein Schritt, der das Vokabular seiner Welt nicht
verlässt.

ZWEI PROBELÄUFE HABEN DIE ABNAHME BERICHTIGT
--------------------------------------------
Beide Male war nicht der Code falsch, sondern die Annahme über die Daten:

1. The Möbius Academy führt `pristine`, aber **kein `excellent`** — ihre Leiter
   lautet pristine → good → fair → poor → ruined.
2. Und dann: **keine der fünf `pristine`-Welten führt `excellent`.** Migration
   309 hat ihr Vokabular aus ihren eigenen Bauten abgeleitet, und keine hatte je
   einen `excellent`-Bau.

Die Abnahme fragt deshalb nicht nach einer festen Sprosse, sondern nach der, die
die Welt tatsächlich unter `pristine` führt.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[3]
MIGRATION = REPO / "supabase/migrations/20260831200000_311_a_world_may_place_its_own_rungs.sql"

KERN = ("pristine", "excellent", "good", "fair", "poor", "ruined")


@pytest.fixture(scope="module")
def sql() -> str:
    assert MIGRATION.is_file(), f"Migration nicht gefunden: {MIGRATION}"
    return MIGRATION.read_text(encoding="utf-8")


def _code_only(text: str) -> str:
    return re.sub(r"--[^\n]*", "", text)


def _body(code: str, marker: str) -> str:
    start = code.index(marker)
    tail = code[start:]
    quote = "$function$" if "$function$" in tail[:400] else "$$"
    first = tail.index(quote)
    return tail[: tail.index(quote, first + len(quote)) + len(quote)]


class TestTheGateItself:
    def test_the_migration_carries_both_writers(self, sql: str) -> None:
        assert len(sql) > 20_000, "der Körper von fn_apply_dungeon_loot fehlt"
        assert "fn_degrade_building" in sql

    def test_the_comment_stripper_strips(self, sql: str) -> None:
        assert "illuminated" in sql, "der Kopf soll den Befund erklären"
        assert len(_code_only(sql)) < len(sql)


class TestTheCoreLadderGrewATopRung:
    def test_pristine_is_the_new_top(self, sql: str) -> None:
        body = _body(_code_only(sql), "CREATE OR REPLACE FUNCTION fn_building_condition_ladder()")
        rungs = dict(re.findall(r"\('(\w+)',\s*(\d+)\)", body))
        assert set(rungs) == set(KERN), f"die Kernleiter lautet {sorted(rungs)}"
        assert int(rungs["pristine"]) < int(rungs["excellent"]), "pristine steht nicht über excellent"

    def test_the_rungs_are_spaced(self, sql: str) -> None:
        """Ohne Abstand kann keine Welt einen eigenen Wert DAZWISCHEN setzen —
        dann wäre der Mechanismus gebaut und unbenutzbar."""
        body = _body(_code_only(sql), "CREATE OR REPLACE FUNCTION fn_building_condition_ladder()")
        werte = sorted(int(n) for _, n in re.findall(r"\('(\w+)',\s*(\d+)\)", body))
        luecken = [b - a for a, b in zip(werte, werte[1:], strict=False)]
        assert min(luecken) >= 5, f"kleinste Lücke {min(luecken)} — zu eng für eine eigene Sprosse"

    def test_the_step_walks_by_order_not_by_arithmetic(self, sql: str) -> None:
        """`rung + 1` funktioniert nur bei lückenloser Numerierung. Mit Abstand
        muss der Schritt die NÄCHSTE Sprosse nehmen."""
        body = _body(_code_only(sql), "CREATE OR REPLACE FUNCTION fn_building_condition_step(\n  p_condition")
        assert "ORDER BY l.rung" in body
        assert "+ p_direction" not in body, "der Schritt rechnet wieder rung ± 1 — das bricht mit Abstand"

    def test_the_label_knows_pristine(self, sql: str) -> None:
        body = _body(_code_only(sql), "CREATE OR REPLACE FUNCTION fn_building_condition_label")
        assert "'pristine'" in body and "Makellos" in body


class TestAWorldMayPlaceItsOwnRungs:
    def test_the_world_ladder_reads_metadata(self, sql: str) -> None:
        body = _body(_code_only(sql), "CREATE OR REPLACE FUNCTION fn_building_condition_ladder(p_simulation_id")
        assert "metadata ->> 'rung'" in body, "eine Welt kann keinen eigenen Wert setzen"
        assert "simulation_taxonomies" in body
        assert "is_active" in body, "ein abgeschalteter Wert gehört nicht auf die Leiter"

    def test_a_nonnumeric_rung_cannot_break_the_ladder(self, sql: str) -> None:
        body = _body(_code_only(sql), "CREATE OR REPLACE FUNCTION fn_building_condition_ladder(p_simulation_id")
        assert "~ '^-?" in body, (
            "metadata ist Freitext-jsonb; ohne Prüfung reisst ein '::int' auf "
            "einem Wort die ganze Leiter mit"
        )

    def test_the_world_ladder_only_contains_what_the_world_names(self, sql: str) -> None:
        body = _body(_code_only(sql), "CREATE OR REPLACE FUNCTION fn_building_condition_ladder(p_simulation_id")
        for wert in KERN:
            assert f"'{wert}'" not in body, (
                f"die Weltleiter zählt {wert} selbst auf, statt die Kernleiter zu lesen"
            )


class TestNoWriterLeavesItsVocabulary:
    """Die eigentliche Zusicherung: kein Schreiber kann einen Bau in einen
    Zustand bringen, den seine Welt nicht benennen kann — in KEINE Richtung."""

    @pytest.mark.parametrize("funktion", ["fn_degrade_building", "public.fn_apply_dungeon_loot"])
    def test_the_writer_uses_the_world_aware_step(self, sql: str, funktion: str) -> None:
        """Geprüft wird die STELLIGKEIT, nicht ein Argumentname.

        Der erste Lauf dieses Tests suchte `simulation_id` im Argument und war
        rot, obwohl der Aufruf stimmte — die Variable heisst dort `v_sim`. Ein
        Muster, das einen NAMEN verlangt, misst die Schreibweise des Aufrufers
        und nicht die Sache. Die Sache ist: drei Argumente statt zwei.
        """
        body = _body(_code_only(sql), f"CREATE OR REPLACE FUNCTION {funktion}")
        aufrufe = re.findall(r"fn_building_condition_step\(([^)]*)\)", body)
        assert aufrufe, f"{funktion} benutzt die Leiter gar nicht"
        for argumente in aufrufe:
            stellen = len([a for a in argumente.split(",") if a.strip()])
            assert stellen == 3, (
                f"{funktion} ruft den Schritt {stellen}-stellig: "
                f"fn_building_condition_step({argumente}) — die zweistellige "
                "Fassung kennt die Welt nicht und kann ihr Vokabular verlassen"
            )

    def test_the_loot_repair_no_longer_ranks_buildings_itself(self, sql: str) -> None:
        """Die Wahl des beschädigten Baus trug eine DRITTE Kopie der Leiter."""
        body = _body(_code_only(sql), "CREATE OR REPLACE FUNCTION public.fn_apply_dungeon_loot")
        assert "WHEN 'ruined' THEN 0" not in body, "die eigene Rangliste steht wieder da"
        assert "fn_building_condition_ladder(p_simulation_id)" in body

    def test_the_acceptance_checks_both_directions_over_the_whole_stock(self, sql: str) -> None:
        block = _code_only(sql)
        block = block[block.index("DO $$") :]
        assert "fuehren aus dem Vokabular ihrer Welt heraus" in block
        assert "b.building_condition, 1)" in block and "b.building_condition, -1)" in block, (
            "die Abnahme prüft nur eine Richtung"
        )

    def test_the_counter_check_is_a_world_without_pristine(self, sql: str) -> None:
        block = _code_only(sql)
        block = block[block.index("DO $$") :]
        assert "OHNE pristine bekaeme durch Reparatur" in block, (
            "ohne diese Gegenprobe wäre pristine auf der Kernleiter eine "
            "Verschlechterung: 26 Welten könnten einen Wert bekommen, den sie "
            "nicht benennen"
        )


class TestTheReasonStillTellsTheTruth:
    def test_already_at_bottom_means_this_world_s_bottom(self, sql: str) -> None:
        body = _body(_code_only(sql), "CREATE OR REPLACE FUNCTION fn_degrade_building")
        assert "v_old = v_unten" in body, (
            "`already_at_bottom` hängt wieder an einem festen Wert. Eine Welt, "
            "deren unterste Sprosse `obsolete` heisst, bekäme dort fälschlich "
            "`condition_off_ladder`"
        )
        assert "'ruined'" not in body, "der Verfall nennt wieder eine feste Sprosse"
        assert "condition_off_ladder" in body


class TestWhatStaysOpenIsNamed:
    def test_the_acceptance_reports_the_remaining_values(self, sql: str) -> None:
        block = _code_only(sql)
        block = block[block.index("DO $$") :]
        assert "RAISE NOTICE" in block, (
            "die elf übrigen weltspezifischen Werte verschwinden lautlos — "
            "eine offene Liste, die niemand sieht, wird nie abgearbeitet"
        )
        assert "neben jeder Sprosse" in block


class TestTheRightsAreRevokedTwice:
    @pytest.mark.parametrize(
        "signature",
        ["fn_building_condition_ladder(UUID)", "fn_building_condition_step(UUID, TEXT, INTEGER)"],
    )
    def test_both_revokes(self, sql: str, signature: str) -> None:
        code = _code_only(sql)
        assert f"ON FUNCTION {signature} FROM PUBLIC" in code
        assert f"ON FUNCTION {signature} FROM anon, authenticated" in code

    def test_the_acceptance_measures_them(self, sql: str) -> None:
        block = _code_only(sql)
        block = block[block.index("DO $$") :]
        assert "has_function_privilege('anon', 'fn_building_condition_ladder(uuid)'" in block
        assert "has_function_privilege('anon', 'fn_building_condition_step(uuid,text,integer)'" in block
