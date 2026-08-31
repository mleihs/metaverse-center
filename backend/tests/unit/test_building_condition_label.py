"""Die Beschriftung folgt dem Zustand (Migration 309).

BEFUND
------
Beim Prüfen, WER das Bauzustands-Vokabular eigentlich liest, kam heraus: die
Oberfläche liest es nicht. `t(b, 'building_condition')`
(`frontend/src/utils/locale-fields.ts`) nimmt die Spalte
`buildings.building_condition_de` und fällt, wenn sie leer ist, auf das
ENGLISCHE Feld zurück. Die Taxonomie speist nur das Auswahlmenü im
Bearbeiten-Dialog.

Gemessen auf Prod (31.08.2026, 324 Bauten):

* **216 Bauten haben keine deutsche Beschriftung** — 182 davon auf `good`, über
  27 Simulationen. In der deutschen Oberfläche steht bei ihnen das rohe
  englische Wort.
* 27 weitere tragen eine, die von der ihrer Welt abweicht: `fair` erscheint als
  mittelmässig, befriedigend, mässig, akzeptabel, ordentlich, angemessen,
  brauchbar und „in Ordnung" — acht Wörter für einen Wert, teils innerhalb
  derselben Welt.
* **Der Verfall macht es schlimmer.** `fn_degrade_building` schreibt
  `building_condition` und lässt `building_condition_de` stehen: ein Bau, der
  von `fair` auf `poor` verfällt, behält die Beschriftung des VORIGEN Zustands.
  Migration 303 hat die Reichweite des Verfalls von 209 auf 297 Bauten erhöht —
  der Fehler ist seitdem lauter.

URSACHE
-------
`building_condition` ist kein Freitext, sondern ein Wert aus einem
kontrollierten Vokabular. Seine Übersetzung gehört zum VOKABULAR, einmal, nicht
an jede Zeile. Dieselbe Bauart wie die doppelte Leiter in Migration 303 — dort
stand eine Reihenfolge zweimal da, hier eine Beschriftung.

WARUM EIN AUSLÖSER
------------------
Zwei Zeilen in `fn_degrade_building` und `fn_apply_dungeon_loot` hätten die
beiden Schreiber gedeckt, die ICH GEFUNDEN habe. Ein Auslöser deckt auch die,
die ich nicht gefunden habe, und jeden künftigen. Eine Zweitschrift synchron zu
halten ist Integrität, und Integrität gehört nach SQL.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[2]
REPO = BACKEND.parent
MIGRATION = REPO / "supabase/migrations/20260831180000_309_the_label_follows_the_condition.sql"


@pytest.fixture(scope="module")
def sql() -> str:
    assert MIGRATION.is_file(), f"Migration nicht gefunden: {MIGRATION}"
    return MIGRATION.read_text(encoding="utf-8")


def _code_only(text: str) -> str:
    """SQL ohne Kommentare — der Kopf nennt jeden Wert, um den es geht."""
    return re.sub(r"--[^\n]*", "", text)


class TestTheGateItself:
    def test_the_comment_stripper_actually_strips(self, sql: str) -> None:
        assert "mittelmässig" in sql or "mittelmäßig" in sql, "der Kopf soll den Befund erklären"
        assert len(_code_only(sql)) < len(sql)


class TestTheLabelHasOneSource:
    def test_the_lookup_function_exists_and_is_ordered(self, sql: str) -> None:
        code = _code_only(sql)
        assert "CREATE OR REPLACE FUNCTION fn_building_condition_de" in code
        start = code.index("CREATE OR REPLACE FUNCTION fn_building_condition_de")
        body = code[start : code.index("$$;", start)]
        # Erst die Welt, dann die Plattform, dann der rohe Wert.
        i_welt = body.index("simulation_taxonomies")
        i_platt = body.index("fn_building_condition_label")
        i_roh = body.rindex("p_value")
        assert i_welt < i_platt < i_roh, (
            "die Reihenfolge der Quellen ist vertauscht — eine Welt muss ihr "
            "eigenes Wort behalten dürfen"
        )

    def test_the_backfill_reads_that_function_and_not_a_table_of_its_own(self, sql: str) -> None:
        code = _code_only(sql)
        start = code.index("UPDATE buildings b")
        block = code[start : code.index(";", start)]
        assert "fn_building_condition_de" in block
        for erfunden in ("'Befriedigend'", "'Schlecht'", "'Ruine'"):
            assert erfunden not in block, f"der Nachtrag schreibt {erfunden} selbst hin"


class TestTheGuardIsATriggerNotTwoPatches:
    def test_a_trigger_is_installed_on_buildings(self, sql: str) -> None:
        code = _code_only(sql)
        assert "CREATE TRIGGER trg_building_condition_label" in code
        assert "BEFORE INSERT OR UPDATE OF building_condition" in code
        assert "ON buildings" in code
        assert "FOR EACH ROW" in code

    def test_the_migration_does_not_patch_the_two_callers_instead(self, sql: str) -> None:
        code = _code_only(sql)
        assert "CREATE OR REPLACE FUNCTION fn_degrade_building" not in code, (
            "die Reparatur sitzt wieder bei EINEM gefundenen Schreiber statt an "
            "der Tabelle — dann bleibt jeder ungefundene Schreiber ungedeckt"
        )
        assert "fn_apply_dungeon_loot" not in code

    def test_an_explicit_label_survives(self, sql: str) -> None:
        code = _code_only(sql)
        start = code.index("CREATE OR REPLACE FUNCTION fn_sync_building_condition_label")
        body = code[start : code.index("$$;", start)]
        assert "IS NOT DISTINCT FROM OLD.building_condition_de" in body, (
            "ohne diese Bedingung überschreibt der Wächter eine ausdrücklich "
            "gesetzte Beschriftung — der Bearbeiten-Dialog kann das"
        )


class TestTheAcceptanceMeasuresEffectNotExistence:
    """Ein Auslöser, der nie feuert, sieht bei jeder Textprüfung aus wie einer,
    der wirkt. Die Abnahme muss ihn laufen lassen."""

    def test_the_acceptance_performs_a_real_decay(self, sql: str) -> None:
        code = _code_only(sql)
        block = code[code.index("DO $$") :]
        assert "UPDATE buildings SET building_condition = fn_building_condition_step" in block, (
            "die Abnahme prüft nur, dass der Auslöser EXISTIERT"
        )
        assert "Von Hand gesetzt" in block, "die Gegenprobe fehlt"

    def test_the_probe_reverts_even_when_it_fails(self, sql: str) -> None:
        code = _code_only(sql)
        block = code[code.index("DO $$") :]
        assert "EXCEPTION WHEN OTHERS THEN" in block, (
            "ohne Untertransaktion bliebe bei einem Fehlschlag ein verfallener "
            "Bau stehen"
        )

    def test_the_acceptance_demands_zero_of_each_measured_defect(self, sql: str) -> None:
        code = _code_only(sql)
        block = code[code.index("DO $$") :]
        for forderung in (
            "kein Bauzustands-Vokabular",
            "ausserhalb ihres Vokabulars",
            "ohne deutsche Beschriftung",
            "weichen von der Beschriftung ihrer Welt ab",
            "mehr als eine Schreibweise",
        ):
            assert forderung in block, f"die Abnahme verlangt nicht: {forderung}"


class TestTheDerivationDoesNotInvent:
    def test_the_german_comes_from_the_world_itself(self, sql: str) -> None:
        code = _code_only(sql)
        assert "haeufigstes_deutsch" in code
        start = code.index("haeufigstes_deutsch AS (")
        block = code[start : code.index("eigene_werte AS (")]
        assert "b.building_condition_de" in block, "die Beschriftung kommt nicht aus der Welt"
        assert "row_number() OVER" in block and "count(*) DESC" in block, "die häufigste wird nicht gewählt"
        assert "btrim(b.building_condition_de)\n           ) AS rang" in block or "ORDER BY count(*) DESC" in block, (
            "ohne bestimmten Gleichstandsbruch hängt das Ergebnis an der Zeilenreihenfolge"
        )

    def test_only_worlds_without_a_vocabulary_are_touched(self, sql: str) -> None:
        code = _code_only(sql)
        assert "ohne_vokabular AS (" in code
        start = code.index("ohne_vokabular AS (")
        block = code[start : code.index("haeufigstes_deutsch AS (")]
        assert "NOT EXISTS" in block, "die Ableitung greift auch in Welten, die schon ein Vokabular haben"

    def test_the_closure_rule_is_word_for_word_the_one_from_308(self, sql: str) -> None:
        """Sonst existierte die Regel in zwei Fassungen — genau der Bauplan,
        den 303 und 309 beide beheben."""
        code = _code_only(sql)
        acht = _code_only(
            (REPO / "supabase/migrations/20260831170000_308_a_world_must_be_able_to_name_its_own_decay.sql").read_text(
                encoding="utf-8"
            )
        )

        def _closure(text: str) -> str:
            start = text.index("WITH welt AS (")
            return re.sub(r"\s+", " ", text[start : text.index("NOT EXISTS", start)]).strip()

        assert _closure(code) == _closure(acht), "die Abschlussregel steht in zwei verschiedenen Fassungen da"


class TestTheRightsAreRevokedTwice:
    @pytest.mark.parametrize(
        "signature", ("fn_building_condition_de(UUID, TEXT)", "fn_sync_building_condition_label()")
    )
    def test_both_revokes_are_present(self, sql: str, signature: str) -> None:
        code = _code_only(sql)
        assert f"ON FUNCTION {signature} FROM PUBLIC" in code, f"{signature}: PUBLIC-Widerruf fehlt"
        assert f"ON FUNCTION {signature} FROM anon, authenticated" in code, f"{signature}: anon-Widerruf fehlt"

    def test_the_acceptance_measures_them(self, sql: str) -> None:
        code = _code_only(sql)
        block = code[code.index("DO $$") :]
        assert "has_function_privilege('anon', 'fn_building_condition_de(uuid,text)'" in block
