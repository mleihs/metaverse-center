"""Der Epochen-Klon muss die Vorbereitung der Spielenden mitnehmen.

Befund I der Systemprüfung, plus zwei Funde beim Lesen des Prod-Körpers
(`pg_get_functiondef`, 581 Zeilen, am 31.08.2026 gezogen).

Vier Dinge verwarf `clone_simulations_for_epoch` beim Start einer Epoche:

1. **Den Draft.** Die Agentenauswahl lautete `ORDER BY created_at LIMIT 6` —
   die sechs ältesten Agenten der Welt. `epoch_participants.drafted_agent_ids`
   steht in derselben Zeile wie die `simulation_id`, die die Schleife liest,
   und wurde nicht mit ausgewählt. Der Draft ist die einzige Vorbereitungs-
   entscheidung vor einer Epoche, und sie wurde beim Start durch eine
   Sortierung ersetzt. Nichts schlug fehl — die Epoche startete mit sechs
   Agenten, nur nicht mit den gewählten.
2. **Die Eignungen.** `agent_aptitudes` wurde gar nicht geklont; jeder Agent
   startete als ebener Generalist.
3. **Das Innenleben.** Weder `agent_mood` noch `agent_needs` noch eine
   Startzone — genau der Zustand, den Migration 286 beim Schmieden beseitigt
   hat, hier eine Ebene weiter hinten unangetastet.
4. **Den deutschen Welttitel.** `name_de` fehlte in der Spaltenliste, während
   `description_de` direkt daneben mitkam.

Dieses Tor liest die Migration als Text. Es ersetzt den funktionalen Nachweis
nicht — der lief im Wegwerf-Postgres über alle 308 Migrationen und zeigte:
nur die drei gedrafteten Agenten, **in Draftreihenfolge**, mit
`personality_profile`, Eignung 7, Resilienz 0,83 (dem Ursprungswert, nicht der
Vorgabe 0,5) und Startzone; ohne Draft der Rückfall auf `created_at`. Was ein
Text-Tor leistet, ist das andere: es wird rot, wenn jemand die Funktion später
aus einer ALTEN Migration heraus neu schreibt und die vier Punkte dabei
verliert — der wahrscheinlichste Weg zurück.
"""

from __future__ import annotations

import re
from pathlib import Path

_MIGRATION = (
    Path(__file__).resolve().parents[3]
    / "supabase"
    / "migrations"
    / "20260831080000_295_clone_restores_draft_aptitudes_and_inner_life.sql"
)


def _sql_without_comments() -> str:
    """Der Prüfbereich ohne Kommentare (J3b).

    Der Kopfkommentar dieser Migration erklärt den Defekt und nennt dabei
    naturgemäß genau die Zeichenketten, nach denen unten gesucht wird —
    `drafted_agent_ids`, `agent_aptitudes`, `name_de`. Ohne Bereinigung
    bestünde jede Zusicherung schon durch die Erklärung, und das Tor läse
    seine eigene Begründung statt der Sache.
    """
    text = _MIGRATION.read_text(encoding="utf-8")
    return "\n".join(line for line in text.splitlines() if not line.lstrip().startswith("--"))


def test_the_migration_exists_and_has_a_body() -> None:
    """Ohne diesen Fall wäre jede Suche unten grün, wenn die Datei fehlt."""
    assert _MIGRATION.exists(), f"{_MIGRATION.name} fehlt"
    sql = _sql_without_comments()
    assert len(sql) > 10_000, f"nur {len(sql)} Zeichen ohne Kommentare — der Funktionskörper fehlt"
    assert "CREATE FUNCTION public.clone_simulations_for_epoch" in sql


def test_drop_and_create_not_create_or_replace() -> None:
    """`CREATE OR REPLACE` legte bei abweichender Argumentliste eine ÜBERLADUNG an.

    Dann entschiede der Aufrufer per Argumenttyp, welche der beiden Fassungen
    läuft — und die alte bliebe daneben stehen, ohne dass etwas fehlschlägt.
    Gemessen auf Prod: genau eine Überladung, und im Wegwerf-Postgres nach
    zwei Läufen dieser Migration ebenfalls genau eine.
    """
    sql = _sql_without_comments()
    assert "DROP FUNCTION IF EXISTS public.clone_simulations_for_epoch(uuid, uuid, integer)" in sql
    assert "CREATE OR REPLACE FUNCTION public.clone_simulations_for_epoch" not in sql


def test_the_draft_decides_which_agents_are_cloned() -> None:
    sql = _sql_without_comments()
    assert "ep.drafted_agent_ids" in sql, "der Draft wird nicht einmal ausgewählt"
    assert "a.id = ANY(participant.drafted_agent_ids)" in sql, "der Draft filtert die Auswahl nicht"
    assert "array_position(participant.drafted_agent_ids, a.id)" in sql, (
        "ohne array_position wäre die Menge richtig und die REIHENFOLGE fremd — "
        "der erste Zug wäre nicht der erste Agent"
    )


def test_a_world_without_a_draft_still_clones_its_oldest_six() -> None:
    """Der Rückfall darf nicht verloren gehen: Epochen ohne Draftphase, Altbestand."""
    sql = _sql_without_comments()
    assert "participant.drafted_agent_ids IS NULL" in sql
    assert "array_length(participant.drafted_agent_ids, 1) IS NULL" in sql, (
        "ein LEERES Array ist nicht NULL — ohne diese Bedingung klonte eine Welt "
        "mit leerem Draft null Agenten und bekäme sechs Fülleragenten"
    )
    assert "a.created_at" in sql


def test_aptitudes_are_cloned() -> None:
    sql = _sql_without_comments()
    assert "INSERT INTO agent_aptitudes" in sql
    assert "FROM agent_aptitudes WHERE agent_id = old_id" in sql


def test_inner_life_is_created_with_the_source_values_not_the_defaults() -> None:
    """Der heikelste Punkt, und der Grund, warum er nicht trivial ist.

    `fn_initialize_agent_autonomy` trägt zweimal `ON CONFLICT (agent_id) DO
    NOTHING`. Wer die Zeile mit den Signaturvorgaben anlegt, entscheidet damit
    zugleich, dass nie ein anderer Wert hineinkommt — ein späterer Aufruf mit
    echten Werten tut nichts (Befund der Parallelsitzung zu N1, Migration 296).

    Beim Klonen sind die richtigen Werte schon bekannt; sie müssen deshalb
    BEIM ANLEGEN übergeben werden. Ein Aufruf mit nur zwei Argumenten im
    Klonzweig wäre also nicht bloß ungenau, sondern unumkehrbar.
    """
    sql = _sql_without_comments()
    calls = re.findall(r"PERFORM fn_initialize_agent_autonomy\((.*?)\);", sql, re.DOTALL)
    assert len(calls) == 2, (
        f"{len(calls)} Aufrufe von fn_initialize_agent_autonomy — erwartet werden zwei: "
        "einer für geklonte Agenten (mit Ursprungswerten) und einer für die Fülleragenten "
        "(mit Vorgaben, die dort die richtige Antwort sind)."
    )

    cloned, synthetic = calls
    for field in ("resilience", "volatility", "sociability"):
        assert f"m.{field}" in cloned, f"{field} des Ursprungsagenten wird beim Klonen nicht übergeben"
    for field in ("social_decay", "purpose_decay", "safety_decay", "comfort_decay", "stimulation_decay"):
        assert f"n.{field}" in cloned, f"{field} des Ursprungsagenten wird beim Klonen nicht übergeben"
    assert cloned.count("COALESCE") == 8, (
        f"{cloned.count('COALESCE')} COALESCE — jeder der acht Werte braucht einen Rückfall "
        "auf die Signaturvorgabe für Ursprungsagenten ohne Zeile"
    )

    assert "new_id, new_sim_id" in synthetic.replace("\n", " ").strip(), (
        "die Fülleragenten sind erfunden; sie bekommen die Vorgaben — aber sie müssen "
        "sie BEKOMMEN, sonst hat eine Epoche Agenten ohne Stimmung, Bedürfnisse und Zone"
    )


def test_the_german_world_title_travels() -> None:
    sql = _sql_without_comments()
    assert "name, name_de, slug, description, description_de" in sql, (
        "name_de fehlt in der Spaltenliste des Simulations-INSERT"
    )
    assert "sim.name_de" in sql


def test_the_agents_essence_travels() -> None:
    """`personality_profile` — seit Migration 296 nicht mehr durchgehend leer.

    Vorher war das Weglassen folgenlos, weil überall `{}` stand. Ab jetzt
    würfe der Klon aktiv etwas weg.
    """
    sql = _sql_without_comments()
    agent_insert = sql[sql.index("INSERT INTO agents (") : sql.index("agent_id_map := agent_id_map")]
    assert agent_insert.count("personality_profile") == 2, (
        "personality_profile muss in der Spaltenliste UND in der SELECT-Liste stehen; "
        f"gefunden: {agent_insert.count('personality_profile')}"
    )


def test_the_grants_are_restored_and_stay_off_the_public_roles() -> None:
    """DROP FUNCTION nimmt die Grants mit.

    Ohne Wiederherstellung liefe der Epochenstart in ein `permission denied` —
    und zwar erst beim nächsten echten Start, nicht bei der Migration. Und ein
    Grant an `anon`/`authenticated` wäre bei einer SECURITY-DEFINER-Funktion
    ein Loch an der Rollenprüfung vorbei (CLAUDE.md, ADR-006).
    """
    sql = _sql_without_comments()
    assert "GRANT EXECUTE ON FUNCTION public.clone_simulations_for_epoch(uuid, uuid, integer) TO service_role" in sql
    for role in ("anon", "authenticated", "PUBLIC"):
        assert f"REVOKE ALL ON FUNCTION public.clone_simulations_for_epoch(uuid, uuid, integer) FROM {role}" in sql
    assert re.search(r"GRANT\s+EXECUTE[^;]*TO\s+(anon|authenticated)", sql) is None, (
        "SECURITY DEFINER darf nie an anon oder authenticated gehen"
    )
