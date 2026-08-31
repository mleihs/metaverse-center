"""Die Zustandsleiter der Bauten steht an einer Stelle (D10-8).

BEFUND
------
`fn_degrade_building` kannte die Kette `good → moderate → poor → ruined`. Der
Zustand eines Baus ist aber kein Aufzählungstyp, sondern ein Wert aus der
Taxonomie der jeweiligen WELT (`simulation_taxonomies`, Typ
`building_condition`).

Auf Prod gemessen (31.08.2026, 305 Taxonomiezeilen über 25 Welten,
324 Bauten):

* `moderate` kommt in **null** dieser 305 Zeilen vor. Jeder Verfall eines
  `good`-Baus schrieb also einen Wert, den die Welt nicht führt — ohne Label,
  ohne deutsche Entsprechung, in der Oberfläche ein roher Bezeichner.
* Alle 25 Welten benennen die drei obersten Sprossen identisch:
  `excellent → good → fair`. Die Kette begann bei `good` und ließ damit jeden
  Bau auf `excellent` oder `fair` unberührt — und `fair` ist mit 78 Bauten der
  zweithäufigste Zustand überhaupt.
* Reichweite vorher **209 von 324**, nachher **297 von 324**.

Und der Grund, warum das elf Monate unsichtbar blieb: ein Bau mit einem
unbekannten Zustand bekam `reason = 'already_at_bottom'` — eine Begründung, die
nicht zutraf. Ein Bau auf `excellent` galt als „bereits am Boden".

Die Leiter stand außerdem ZWEIMAL da: absteigend in `fn_degrade_building`,
aufsteigend in `fn_apply_dungeon_loot`. Zwei Kopien einer Reihenfolge sind zwei
Gelegenheiten, sie unterschiedlich zu ändern — genau deshalb trug die eine
`moderate` und die andere suchte danach.

WAS DIESE DATEI NICHT PRÜFT
---------------------------
Ob die 23 Bauten mit weltspezifischen Zuständen verfallen sollten. Sie über
`sort_order` in die Leiter zu hängen wäre naheliegend und falsch: **sechs der
25 Welten haben eine Leiter, die auf Sprosse 4 und 5 wieder aufwärts geht**
(`excellent → good → fair → restored → illuminated`). Ein Verfall entlang
`sort_order` würde dort einen Bau verbessern. Das ist ein Befund an der
Schmiede und eine Entscheidung des Nutzers.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[2]
REPO = BACKEND.parent
MIGRATION = REPO / "supabase/migrations/20260831125000_303_building_condition_ladder_has_one_place.sql"

# Die gemessene gemeinsame Kernleiter aller 25 Prod-Welten (sort_order 1..5).
LADDER = ("excellent", "good", "fair", "poor", "ruined")


@pytest.fixture(scope="module")
def sql() -> str:
    assert MIGRATION.is_file(), f"Migration nicht gefunden: {MIGRATION}"
    return MIGRATION.read_text(encoding="utf-8")


def _code_only(text: str) -> str:
    """SQL ohne Kommentare.

    Der Kopfkommentar der Migration nennt `moderate` absichtlich, um den Befund
    zu erklären. Ein Textscan, der das mitliest, findet seine eigene Begründung
    und bleibt grün (J3b). Ein Tor, das Text durchsucht, muss vorher sagen, was
    für es Text IST.
    """
    return re.sub(r"--[^\n]*", "", text)


class TestTheGateItself:
    def test_the_migration_is_readable_and_large_enough(self, sql: str) -> None:
        assert len(sql) > 20_000, "die Beutefunktion fehlt — der Körper wurde nicht mitgeschrieben"
        assert "fn_building_condition_step" in sql
        assert "fn_degrade_building" in sql
        assert "fn_apply_dungeon_loot" in sql

    def test_the_comment_stripper_actually_strips(self, sql: str) -> None:
        """Ohne diese Zusicherung wäre die Prüfung unten wertlos."""
        assert "moderate" in sql, "der Kopfkommentar soll den Befund erklären"
        assert "-- " in sql
        stripped = _code_only(sql)
        assert len(stripped) < len(sql)


def _function_bodies(sql: str) -> str:
    """Nur die drei Funktionskörper, ohne Kommentare und ohne Abnahmeblock.

    Der Abnahmeblock der Migration MUSS `moderate` nennen — er ist das Tor, das
    den Wert verbietet, und ein Tor muss sagen, was es verbietet. Eine Suche
    über die ganze Datei fände also die Prüfung selbst und schlüge fehl,
    obwohl alles stimmt. Dieselbe Falle wie der Erklärkommentar, nur eine Ebene
    höher: nicht die Begründung, sondern die PRÜFUNG sieht für einen Textscan
    aus wie der Defekt.
    """
    code = _code_only(sql)
    bodies: list[str] = []
    for marker in (
        "CREATE OR REPLACE FUNCTION fn_building_condition_step",
        "CREATE OR REPLACE FUNCTION fn_degrade_building",
        "CREATE OR REPLACE FUNCTION public.fn_apply_dungeon_loot",
    ):
        start = code.index(marker)
        end = code.index("$$;", start) if "$$;" in code[start:] else len(code)
        if "$function$" in code[start : start + 400]:
            end = code.index("$function$", code.index("$function$", start) + 1)
        bodies.append(code[start:end])
    return "\n".join(bodies)


class TestTheRungThatNeverExisted:
    def test_moderate_is_gone_from_the_function_bodies(self, sql: str) -> None:
        assert "moderate" not in _function_bodies(sql), (
            "Die Sprosse `moderate` steht noch in einem der drei Funktionskörper. "
            "Keine der 25 Welt-Taxonomien kennt sie; sie zu schreiben heißt, "
            "einen Zustand zu erzeugen, für den es kein Label gibt."
        )

    def test_the_acceptance_block_still_names_it(self, sql: str) -> None:
        """Gegenprobe: das Tor in der Migration muss den Wert nennen dürfen."""
        code = _code_only(sql)
        guard = code[code.index("DO $$", code.index("fn_apply_dungeon_loot(uuid, uuid, jsonb) TO service_role")) :]
        assert "moderate" in guard, (
            "der Abnahmeblock verbietet den Wert nicht mehr — dann ist die "
            "Prüfung oben die einzige, und sie gilt nur für diese eine Datei"
        )

    def test_the_ladder_names_the_measured_rungs(self, sql: str) -> None:
        code = _code_only(sql)
        start = code.index("CREATE OR REPLACE FUNCTION fn_building_condition_step")
        body = code[start : code.index("$$;", start)]
        for rung in LADDER:
            assert f"'{rung}'" in body, f"Sprosse {rung} fehlt in der Leiter"


class TestTheLadderLivesInOnePlace:
    def test_degrade_does_not_carry_its_own_chain(self, sql: str) -> None:
        code = _code_only(sql)
        start = code.index("CREATE OR REPLACE FUNCTION fn_degrade_building")
        body = code[start : code.index("$$;", start)]
        assert "fn_building_condition_step" in body, "der Verfall muss die gemeinsame Leiter benutzen"
        assert "WHEN 'good'" not in body, "der Verfall trägt wieder eine eigene Kette"

    def test_the_loot_repair_does_not_carry_its_own_chain(self, sql: str) -> None:
        code = _code_only(sql)
        start = code.index("CREATE OR REPLACE FUNCTION public.fn_apply_dungeon_loot")
        body = code[start:]
        assert "fn_building_condition_step(v_new_cond, -1)" in body, (
            "die Beute-Reparatur muss die gemeinsame Leiter benutzen"
        )
        assert "WHEN 'ruined'   THEN 'poor'" not in body, (
            "die Beute-Reparatur trägt wieder eine eigene Kette"
        )


class TestTheReasonTellsTheTruth:
    """`already_at_bottom` für einen Bau auf `excellent` war eine Falschaussage."""

    def test_the_two_cases_are_distinguished(self, sql: str) -> None:
        code = _code_only(sql)
        start = code.index("CREATE OR REPLACE FUNCTION fn_degrade_building")
        body = code[start : code.index("$$;", start)]
        assert "condition_off_ladder" in body
        assert "already_at_bottom" in body
        assert "v_old = 'ruined'" in body, (
            "die Unterscheidung muss am Ende der Leiter hängen, nicht an etwas anderem"
        )

    def test_the_acceptance_block_exercises_both(self, sql: str) -> None:
        code = _code_only(sql)
        block = code[code.index("DO $$", code.index("GRANT EXECUTE ON FUNCTION fn_apply_dungeon_loot")) :]
        assert "fn_building_condition_step('good', 1)" in block
        assert "fn_building_condition_step('anomalous', 1)" in block, (
            "ein Wert NEBEN der Leiter muss in der Abnahme vorkommen — sonst "
            "prüft sie nur den Fall, der schon vorher ging"
        )


class TestThePythonSideCountsWhatItSkips:
    def test_event_service_counts_off_ladder_buildings(self) -> None:
        """Ein übersprungener Bau wird gezählt, nicht stillschweigend übergangen."""
        source = (BACKEND / "services" / "event_service.py").read_text(encoding="utf-8")
        start = source.index("Crisis event degraded")
        block = source[source.rindex("degraded = 0", 0, start) : start + 900]
        assert 'outcome.get("reason") == "condition_off_ladder"' in block
        assert "off_ladder += 1" in block
        assert "buildings_off_ladder" in block

    def test_the_callers_only_read_fields_that_still_exist(self) -> None:
        """`reason` ist neu; `changed` und old/new dürfen sich nicht verschoben haben."""
        for name in ("event_service.py", "operative_mission_service.py"):
            source = (BACKEND / "services" / name).read_text(encoding="utf-8")
            if "fn_degrade_building" not in source:
                continue
            assert '"changed"' in source or ".get(\"changed\")" in source
