"""Ein Zaehler, den der Takt schreibt, braucht eine Spalte.

── WOHER DIESES TOR KOMMT ────────────────────────────────────────────────────

`_tick_simulation` sammelt Zahlen in `tick_stats` und schreibt sie am Ende
als `**tick_stats` in `simulation_heartbeats`. Zwei Schluessel hatten dort
keine Spalte:

    memory_reflections    seit Migration 343 (02.09.2026) im Code
    agent_continuations   seit Migration 362 (04.09.2026) im Code

PostgREST antwortet mit PGRST204, die Anweisung scheitert, und mit ihr der
ganze Abschluss des Takts. Gemessen am 05.09.2026, nachdem der Herzschlag
wieder eingeschaltet wurde:

    status = completed   12 082   17.03.2026 .. 02.09.2026
    status = failed          16   05.09.2026  ← ALLE seit dem Einschalten

⚠ Warum es niemand gesehen hat: der Herzschlag war seit dem 02.09. 13:32 UTC
abgeschaltet — also BEVOR der fehlerhafte Code ausgerollt wurde. Ein Fehler,
der nur beim Laufen sichtbar wird, und ein Zeitgeber, der nicht lief.

⚠ Und was dabei NICHT auffaellt: die Phasen laufen alle durch. Ereignisse,
Stimmungen, Autonomie, Verdichtung werden geschrieben, bevor die Anweisung
scheitert. Verloren gehen nur `status`, `summary`, die Depeschen und die
Zaehler. Die Welt tickt, ihr Bericht darueber ist leer — das ist kein
Ausfall, den jemand bemerkt, sondern eine Statistik, die still verarmt.

── DIE BAUART ────────────────────────────────────────────────────────────────

Dieselbe wie `test_heartbeat_entry_types.py` (Eintragstypen gegen den CHECK)
und `test_ai_purposes_migration.py` (Budgets gegen die Migrationszeilen): den
Code gegen die Migrationen halten, nicht gegen eine Datenbank. Ein Tor, das
eine laufende Datenbank braucht, laeuft in CI nicht.
"""

from __future__ import annotations

import pathlib
import re

QUELLE = pathlib.Path("backend/services/heartbeat_service.py")
MIGRATIONEN = pathlib.Path("supabase/migrations")


def _tick_stats_schluessel() -> set[str]:
    """Die Schluessel, die als SPALTE in die Tabelle gehen.

    `tick_stats.pop(...)` holt einige davon vor der Anweisung wieder heraus
    und legt sie in `summary` ab — die brauchen keine Spalte. Das ist die
    Unterscheidung, an der ein naiveres Tor scheitern wuerde: es faende
    `autonomy` und `weather` und verlangte Spalten fuer beide.
    """
    text = QUELLE.read_text(encoding="utf-8")
    gesetzt = set(re.findall(r'tick_stats\["([a-z_]+)"\]\s*=', text))
    entnommen = set(re.findall(r'tick_stats\.pop\("([a-z_]+)"', text))
    return gesetzt - entnommen


def _spalten_aus_migrationen() -> set[str]:
    """Die Spalten, die irgendeine Migration auf der Tabelle anlegt.

    Bewusst grob: `CREATE TABLE` und `ADD COLUMN` reichen, denn es geht um
    „gibt es die Spalte ueberhaupt", nicht um ihren Typ.
    """
    spalten: set[str] = set()
    for datei in MIGRATIONEN.glob("*.sql"):
        text = datei.read_text(encoding="utf-8")
        if "simulation_heartbeats" not in text:
            continue
        for block in re.finditer(r"ALTER TABLE\s+(?:public\.)?simulation_heartbeats(.*?);", text, re.S | re.I):
            spalten.update(re.findall(r"ADD COLUMN\s+(?:IF NOT EXISTS\s+)?([a-z_]+)", block.group(1), re.I))
        for block in re.finditer(
            r"CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(?:public\.)?simulation_heartbeats\s*\((.*?)\n\);",
            text,
            re.S | re.I,
        ):
            for zeile in block.group(1).splitlines():
                treffer = re.match(r"\s*([a-z_]+)\s+[A-Za-z]", zeile)
                if treffer and treffer.group(1).upper() not in {
                    "CONSTRAINT",
                    "PRIMARY",
                    "UNIQUE",
                    "FOREIGN",
                    "CHECK",
                }:
                    spalten.add(treffer.group(1))
    return spalten


def test_jeder_zaehler_des_takts_hat_eine_spalte() -> None:
    """Die Zusage. Ein Zaehler ohne Spalte laesst den GANZEN Abschluss des
    Takts scheitern — nicht nur sich selbst."""
    fehlend = sorted(_tick_stats_schluessel() - _spalten_aus_migrationen())
    assert not fehlend, (
        "`_tick_simulation` schreibt Zaehler, fuer die keine Migration eine Spalte "
        f"anlegt: {', '.join(fehlend)}. PostgREST antwortet mit PGRST204 und der "
        "GANZE Abschluss des Takts scheitert — status, summary, beide Depeschen und "
        "alle uebrigen Zaehler gehen verloren, waehrend die Phasen selbst durchlaufen. "
        "Am 05.09.2026 waren so 16 von 16 Takten als 'failed' verbucht. "
        "Lege die Spalte in einer Migration an."
    )


class TestDasTorSiehtWirklichEtwas:
    """Ein Tor, das nichts finden KANN, besteht muehelos."""

    def test_es_findet_ueberhaupt_zaehler(self):
        schluessel = _tick_stats_schluessel()
        assert len(schluessel) >= 8, f"nur {len(schluessel)} Zaehler gefunden – liest es die Datei?"
        assert "memory_reflections" in schluessel
        assert "agent_continuations" in schluessel

    def test_es_findet_ueberhaupt_spalten(self):
        spalten = _spalten_aus_migrationen()
        assert len(spalten) >= 10, f"nur {len(spalten)} Spalten gefunden – liest es die Migrationen?"
        assert "tick_number" in spalten, "die Spalte aus CREATE TABLE fehlt"
        assert "memory_reflections" in spalten, "die Spalte aus ADD COLUMN fehlt"

    def test_die_herausgenommenen_zaehlen_nicht(self):
        """`autonomy`, `weather` und die anderen `pop`-Schluessel landen in
        `summary` und brauchen keine Spalte. Ein Tor, das sie verlangte,
        forderte Spalten fuer ein jsonb-Feld."""
        schluessel = _tick_stats_schluessel()
        for entnommen in ("autonomy", "weather", "bond_whispers"):
            assert entnommen not in schluessel

    def test_es_faenge_einen_neuen_zaehler_ohne_spalte(self):
        """Der eigentliche Beweis: die Pruefung, an einem erfundenen Fall."""
        erfunden = _tick_stats_schluessel() | {"ein_zaehler_ohne_spalte"}
        assert erfunden - _spalten_aus_migrationen() == {"ein_zaehler_ohne_spalte"}
