"""Eine Welt muss den Verfall benennen können, den sie erlaubt (Migration 308).

BEFUND
------
Migration 303 hat die Zustandsleiter der Bauten an eine Stelle gelegt und einen
Punkt ausdrücklich offengelassen: sechs von 25 Welten führen ein Vokabular,
dessen `sort_order` auf Sprosse 4 und 5 wieder aufwärts läuft
(`excellent → good → fair → restored → illuminated`).

Nachgemessen auf Prod (31.08.2026) ist daran dreierlei anders:

* **`sort_order` ist keine Leiter.** Einzige Verbraucher sind
  `TaxonomyService.list_taxonomies` (ordnet danach) und `WorldSettingsPanel`
  (sortiert danach) — reine Anzeigereihenfolge. Keine Stelle im Werk liest sie
  als Schweregrad. Eine „aufwärts laufende Leiter" ist deshalb keine falsche
  Reihenfolge, sondern eine Reihenfolge, die nie eine war. Migration 308 ordnet
  folglich nichts um.
* **Die Herkunft ist nicht die Schmiede.** Die Vokabulare stehen handgeschrieben
  in den Welt-Migrationen 043 und 140; die fünf Klone erbten sie. Von der
  Schmiede stammt keine einzige Taxonomiezeile (alle 26 Entwürfe tragen
  `taxonomies = {}`).
* **Der Defekt trifft sieben Simulationen, nicht sechs.** Gemessen fehlt
  `cite-des-dames` (und ihren fünf Ablegern) `poor` UND `ruined`,
  `conventional-memory` fehlt `ruined`. Verfällt dort ein Bau, trägt er einen
  Wert, den seine eigene Welt nicht beschriften kann — dieselbe Klasse wie
  `moderate` vor Migration 303.

Und eine Zahl gehört geradegerückt, die 303 lose geführt hat: „25 Welten" sind
keine 25 Ursprungswelten. Von 36 nicht gelöschten Simulationen sind 16
Ursprungswelten und 20 Epochenableger; 25 tragen ein Bauzustands-Vokabular
(6 Ursprungswelten + 19 Ableger). Die sieben mit Lücke sind zwei
Ursprungswelten und fünf Ableger derselben Welt. Der schwerere Fall steht
daneben und bekommt eine eigene Migration: **elf Simulationen, zehn davon
Ursprungswelten, haben gar kein Bauzustands-Vokabular.**

DIE REGEL
---------
Abgeschlossenheit unter dem Verfall: von der BESTEN Kernsprosse, die eine Welt
selbst führt, muss jede tiefere Sprosse ebenfalls in ihrem Vokabular stehen.
Nicht mehr (eine Welt, die bei `fair` beginnt, bekommt kein `excellent` dazu),
nicht weniger (jeden erreichbaren Zustand muss die Welt benennen können).

WAS DIESE DATEI PRÜFT
---------------------
Die Migration als Text — dass die Leiter genau einmal aufgezählt wird, dass der
Nachtrag nur einfügt, dass die Regel „von der besten Sprosse abwärts" und nicht
„alle fünf" lautet, dass beide Rechte-Widerrufe dastehen und dass die Schmiede
die Regel künftig selbst hält. Die Wirkung auf die Daten prüft der Abnahmeblock
der Migration gegen den echten Bestand; er ist hier nur daraufhin geprüft, dass
er existiert und das Richtige verlangt.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[2]
REPO = BACKEND.parent
MIGRATION = REPO / "supabase/migrations/20260831170000_308_a_world_must_be_able_to_name_its_own_decay.sql"
MIGRATION_303 = REPO / "supabase/migrations/20260831125000_303_building_condition_ladder_has_one_place.sql"

# Die auf Prod gemessene gemeinsame Kernleiter aller 25 Welten.
LADDER = ("excellent", "good", "fair", "poor", "ruined")


@pytest.fixture(scope="module")
def sql() -> str:
    assert MIGRATION.is_file(), f"Migration nicht gefunden: {MIGRATION}"
    return MIGRATION.read_text(encoding="utf-8")


def _code_only(text: str) -> str:
    """SQL ohne Kommentare.

    Der Kopfkommentar erklärt den Befund und nennt dabei jeden Wert, um den es
    geht. Ein Textscan über die ganze Datei fände seine eigene Begründung und
    bliebe grün — dieselbe Falle wie bei Migration 303 (J3b).
    """
    return re.sub(r"--[^\n]*", "", text)


def _body(code: str, marker: str) -> str:
    """Ein Funktionskörper vom Marker bis zum schließenden Dollar-Quote."""
    start = code.index(marker)
    tail = code[start:]
    quote = "$function$" if "$function$" in tail[:400] else "$$"
    first = tail.index(quote)
    return tail[: tail.index(quote, first + len(quote)) + len(quote)]


class TestTheGateItself:
    """Erst messen, ob das Messgerät misst — drei eigene Fehlmessungen an einem
    Nachmittag hatten alle dieselbe Form: ein Muster, das auch auf die Prüfung
    passte."""

    def test_the_migration_is_readable_and_carries_the_whole_rpc(self, sql: str) -> None:
        assert len(sql) > 20_000, "der Körper von fn_materialize_shard fehlt"
        assert "fn_building_condition_ladder" in sql
        assert "fn_materialize_shard" in sql

    def test_the_comment_stripper_actually_strips(self, sql: str) -> None:
        assert "restored" in sql, "der Kopfkommentar soll den Befund erklären"
        stripped = _code_only(sql)
        assert len(stripped) < len(sql)

    def test_the_body_extractor_stops_at_the_function(self, sql: str) -> None:
        body = _body(_code_only(sql), "CREATE OR REPLACE FUNCTION fn_building_condition_ladder")
        assert body.count("CREATE OR REPLACE FUNCTION") == 1, "der Auszug greift über die Funktion hinaus"


class TestTheLadderIsEnumeratedExactlyOnce:
    """Migration 303 hat zwei Kopien der Leiter zu einer gemacht. 308 zieht sie
    eine Ebene höher, damit auch die Abgeschlossenheitsprüfung dieselbe benutzt
    — sonst wären es wieder zwei."""

    def test_the_ladder_function_names_all_five_rungs(self, sql: str) -> None:
        body = _body(_code_only(sql), "CREATE OR REPLACE FUNCTION fn_building_condition_ladder")
        for rung in LADDER:
            assert f"'{rung}'" in body, f"Sprosse {rung} fehlt in der Leiter"

    def test_the_step_no_longer_enumerates_them(self, sql: str) -> None:
        body = _body(_code_only(sql), "CREATE OR REPLACE FUNCTION fn_building_condition_step")
        assert "fn_building_condition_ladder()" in body, "der Schritt muss die Leiter lesen"
        for rung in LADDER:
            assert f"'{rung}'" not in body, (
                f"der Schritt zählt die Sprosse {rung} wieder selbst auf — "
                "damit stünde die Leiter erneut an zwei Stellen"
            )

    def test_the_backfill_does_not_enumerate_them_either(self, sql: str) -> None:
        code = _code_only(sql)
        start = code.index("INSERT INTO simulation_taxonomies")
        block = code[start : code.index(";", code.index("NOT EXISTS", start))]
        assert "fn_building_condition_ladder()" in block
        for rung in LADDER:
            assert f"'{rung}'" not in block, f"der Nachtrag zählt {rung} selbst auf"

    def test_it_is_the_same_ladder_as_migration_303(self, sql: str) -> None:
        """Bindet die beiden Migrationen aneinander: 308 darf die Leiter nicht
        stillschweigend anders besetzen als die, die 303 eingeführt hat."""
        alt = _code_only(MIGRATION_303.read_text(encoding="utf-8"))
        alt_body = _body(alt, "CREATE OR REPLACE FUNCTION fn_building_condition_step")
        neu = _body(_code_only(sql), "CREATE OR REPLACE FUNCTION fn_building_condition_ladder")
        for rung in LADDER:
            assert f"'{rung}'" in alt_body and f"'{rung}'" in neu


class TestTheBackfillOnlyAdds:
    def test_no_update_and_no_delete_on_taxonomies(self, sql: str) -> None:
        code = _code_only(sql)
        assert "UPDATE simulation_taxonomies" not in code, (
            "eine bestehende Beschriftung darf nicht überschrieben werden — eine "
            "Welt benennt ihre Zustände in ihren eigenen Worten"
        )
        assert "DELETE FROM simulation_taxonomies" not in code
        assert "UPDATE public.simulation_taxonomies" not in code

    def test_the_insert_skips_what_is_already_there(self, sql: str) -> None:
        code = _code_only(sql)
        start = code.index("INSERT INTO simulation_taxonomies")
        block = code[start : code.index(";", code.index("NOT EXISTS", start))]
        assert "NOT EXISTS" in block, "ohne das wäre der zweite Lauf ein Doppeleintrag"
        assert "t.value = l.value" in block


class TestTheRuleIsClosureNotCompleteness:
    """„Alle fünf Sprossen" wäre die naheliegende Regel und wäre falsch: sie
    erfände einer Welt, die bei `fair` beginnt, ein `excellent` dazu."""

    def test_the_rule_starts_at_the_best_rung_the_world_has(self, sql: str) -> None:
        code = _code_only(sql)
        start = code.index("INSERT INTO simulation_taxonomies")
        block = code[start : code.index(";", code.index("NOT EXISTS", start))]
        assert "beste_sprosse" in block
        assert "l.rung >= " in block, (
            "ohne die Untergrenze verlangt die Migration alle fünf Sprossen von "
            "jeder Welt — das wäre Vollständigkeit, nicht Abgeschlossenheit"
        )

    def test_the_same_rule_stands_in_the_forge(self, sql: str) -> None:
        body = _body(_code_only(sql), "CREATE OR REPLACE FUNCTION public.fn_materialize_shard")
        assert "fn_building_condition_ladder()" in body, "die Schmiede hält die Regel nicht"
        assert "l.rung >= " in body, "die Schmiede verlangt Vollständigkeit statt Abgeschlossenheit"
        assert "min(k.rung)" in body

    def test_the_acceptance_block_demands_zero_gaps(self, sql: str) -> None:
        code = _code_only(sql)
        block = code[code.index("DO $$") :]
        assert "koennen ihren eigenen Verfall nicht benennen" in block, (
            "der Abnahmeblock prüft die Abgeschlossenheit nicht — dann misst die Migration nur ihren eigenen Text"
        )
        assert "min(k.rung)" in block


class TestTheForgeKeepsWhatItDerived:
    """Beim Hinsehen im selben Schritt gefunden: `sort_order` stand nicht in der
    Einfügeliste, also bekam jede Zeile die Vorgabe 0."""

    def test_step_eight_writes_sort_order(self, sql: str) -> None:
        body = _body(_code_only(sql), "CREATE OR REPLACE FUNCTION public.fn_materialize_shard")
        start = body.index("INSERT INTO public.simulation_taxonomies")
        insert = body[start : body.index(";", start)]
        assert "sort_order" in insert.split("SELECT")[0], "die Spalte fehlt weiterhin in der Einfügeliste"
        assert "WITH ORDINALITY" in insert, "ohne sie gäbe es keine Position zum Schreiben"


class TestTheRightsAreRevokedTwice:
    """Migration 307 hat gelernt, dass `FROM PUBLIC` die direkte Zuteilung an
    `anon` nicht wegnimmt. Der erste Probelauf von 308 hat die Umkehrung
    gelehrt: `FROM anon` allein lässt die PUBLIC-Zuteilung stehen, die
    PostgreSQL jeder neuen Funktion selbst gibt. Eine NEUE Funktion braucht
    beide Widerrufe."""

    NEW_FUNCTIONS = ("fn_building_condition_ladder()", "fn_building_condition_label(TEXT)")

    @pytest.mark.parametrize("signature", NEW_FUNCTIONS)
    def test_both_revokes_are_present(self, sql: str, signature: str) -> None:
        code = _code_only(sql)
        assert f"ON FUNCTION {signature} FROM PUBLIC" in code, (
            f"{signature}: der Widerruf von PostgreSQLs eigener PUBLIC-Vorgabe fehlt"
        )
        assert f"ON FUNCTION {signature} FROM anon, authenticated" in code, (
            f"{signature}: der Widerruf von Supabases pg_default_acl-Zuteilung fehlt"
        )

    def test_the_acceptance_block_measures_them(self, sql: str) -> None:
        code = _code_only(sql)
        block = code[code.index("DO $$") :]
        for signature in ("fn_building_condition_ladder()", "fn_building_condition_label(text)"):
            assert f"has_function_privilege('anon', '{signature}'" in block, (
                f"{signature}: die Rechte werden angenommen statt gemessen"
            )

    def test_the_security_definer_rpc_stays_closed(self, sql: str) -> None:
        code = _code_only(sql)
        block = code[code.index("DO $$") :]
        assert "fn_materialize_shard" in block
        assert "SECURITY DEFINER" in code
        assert "has_function_privilege('anon', 'fn_materialize_shard(uuid)', 'EXECUTE')" in block, (
            "fn_materialize_shard ist SECURITY DEFINER — ein anon-Recht daran wäre "
            "eine echte Rechteausweitung (ADR-006), nicht nur eine offene Tür"
        )
