"""Die gemeinsame Befehlszeile der Saat-Generatoren.

BEFUND
------
`generate_migration.py` (Dungeon) und `generate_drift_migration.py` (Drift)
trugen ihr `main` doppelt: **36 von 50 Zeilen zeichengleich**, dazu
`_print_counts` wörtlich in beiden. Unterschiedlich waren genau vier Dinge —
die Beschreibung, der Hilfetext für `--root`, und welche zwei Funktionen laden
und erzeugen.

Zwei Kopien einer Befehlszeile sind zwei Gelegenheiten, sie unterschiedlich zu
ändern. `--no-truncate` steht heute zufällig in beiden; die nächste Fahne stünde
es womöglich nicht, und das fiele erst auf, wenn jemand sie im falschen
Generator sucht. Dieselbe Bauart wie die doppelte Zustandsleiter vor Migration
303, nur an einem Werkzeug statt an einer Regel.

WARUM EIN EIGENES MODUL
-----------------------
Nicht in `seed_emit`: das erzeugt SQL und weiss nichts von Argumenten. Nicht in
einem der beiden Generatoren: dann importierte der Dungeon-Generator
Drift-Code oder umgekehrt, und die Trennung, die der Modulkopf von
`generate_drift_migration` ausdrücklich begründet („no cross-domain coupling"),
wäre dahin. Beide hängen jetzt an einem Dritten, das keine Domäne kennt.
"""

from __future__ import annotations

import argparse
import sys
from collections.abc import Callable
from pathlib import Path

__all__ = ["print_counts", "run_seed_cli"]

# (SQL, Zeilenzahl je Tabelle) — was ein Generator liefert.
SeedBuilder = Callable[[Path | None, bool], tuple[str, dict[str, int]]]


def print_counts(counts: dict[str, int]) -> None:
    """Die Zeilenzahl je Tabelle, plus Summe."""
    for table, n in counts.items():
        print(f"  {table:<30} {n:>5}")
    print(f"  {'TOTAL':<30} {sum(counts.values()):>5}")


def run_seed_cli(
    argv: list[str] | None,
    *,
    description: str,
    root_help: str,
    build: SeedBuilder,
) -> int:
    """Argumente lesen, den Generator laufen lassen, das Ergebnis ablegen.

    ``build(root, truncate)`` ist das Einzige, was die Generatoren
    unterscheidet: es lädt seine Packungen und erzeugt sein SQL. Alles davor
    und danach ist für beide dasselbe.

    Die drei Ausgabewege schliessen einander aus (argparse erzwingt das), und
    ohne Angabe zählt der Aufruf nur — ein Generator, der ohne Ziel schreibt,
    hätte schon einmal die falsche Datei überschrieben.
    """
    parser = argparse.ArgumentParser(description=description)
    parser.add_argument("--root", type=Path, default=None, help=root_help)

    output_mode = parser.add_mutually_exclusive_group()
    output_mode.add_argument("--output", type=Path, default=None, help="Write generated SQL to this file.")
    output_mode.add_argument("--stdout", action="store_true", help="Write generated SQL to stdout.")
    output_mode.add_argument("--dry-run", action="store_true", help="Load packs and count rows, but emit no SQL.")

    parser.add_argument(
        "--no-truncate",
        action="store_true",
        help="Skip the TRUNCATE prefix (additive migration, ID-stability required).",
    )
    args = parser.parse_args(argv)

    sql, counts = build(args.root, not args.no_truncate)

    if args.dry_run or (not args.output and not args.stdout):
        print_counts(counts)
        return 0

    if args.stdout:
        sys.stdout.write(sql)
        return 0

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(sql, encoding="utf-8")
    print_counts(counts)
    print(f"Wrote {sum(counts.values())} rows to {args.output}")
    return 0
