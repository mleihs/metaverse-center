#!/usr/bin/env bash
# Jeder dollar-gequotete Block in einer Migration muss mit `;` enden.
#
# ── WARUM ───────────────────────────────────────────────────────────────────
#
# `psql -f datei.sql` liest Anweisungen bis zum Semikolon. Fehlt es hinter der
# schliessenden Dollar-Marke einer Funktion, hoert psql NICHT auf — es liest
# weiter und zieht die naechste Anweisung in dieselbe hinein. Der Fehler
# erscheint dann an einer Stelle, die mit der Ursache nichts zu tun hat:
#
#     psql:…319_….sql:479: ERROR:  syntax error at or near "DO"
#     LINE 313: DO $$
#
# Zeile 479 ist das Ende des DO-Blocks, „LINE 313" ist die 313. Zeile DER
# ANWEISUNG — und 458 − 146 + 1 = 313 zeigt auf Dateizeile 146, wo die
# unbeendete Funktion beginnt. Die Rechnung muss man erst machen; der
# Fehlertext fuehrt in die Irre.
#
# Gefunden am 02.09.2026 in Migration 319 (`$function$` ohne `;`, Zeile 448).
# Die Migration lag seit dem 01.09. im Baum und war auf Prod angewandt — dort
# ueber einen Weg, der Anweisungen anders trennt. **Von psql ist sie nie
# ausgefuehrt worden**, weil die Migrationskette seit dem 31.08. vorher abbrach.
# Ein kaputtes Semikolon, einen Tag unsichtbar, weil das Messgeraet nicht bis
# dorthin kam.
#
# ── WAS ES PRUEFT ───────────────────────────────────────────────────────────
#
# Nur die eine Form, und die dafuer sicher: eine Zeile, die NUR aus einer
# schliessenden Dollar-Marke besteht (`$$` oder `$function$`), muss von einem
# `;` gefolgt sein — auf derselben Zeile oder als naechste bedeutsame Zeile.
# Ausgenommen sind die Fortsetzungen, die zu einer Funktionsdefinition gehoeren
# (`LANGUAGE …`, `SECURITY …`, `SET …`, `STABLE`, `IMMUTABLE`, `VOLATILE`).
#
# Bewusst ENG, und das ist zweimal teuer erkauft:
#
#   Versuch 1 — jede Endmarke ohne folgendes `;`:   46 731 Treffer.
#               `$$ LANGUAGE plpgsql;` galt als unbeendet, und `$1`-Parameter-
#               platzhalter wurden als Quote-Marken mitgezaehlt.
#   Versuch 2 — jede korrekt gepaarte Endmarke:     zehntausende Treffer.
#               Die Inhalts-Saatmigrationen benutzen dollar-gequotete
#               ZEICHENKETTEN als Werte (`$DQ$…$DQ$`, `$JB$…$JB$` in INSERTs).
#               Die stehen mitten in einer Anweisung und haben dort auch nichts
#               zu suchen, was mit einem Semikolon endet.
#
# Ein Tor, das alles meldet, meldet nichts. Diese Fassung sieht nur, was
# konventionell ein BLOCK-Ende ist: eine Marke allein auf ihrer Zeile. Das sind
# 3 von 123 Stellen im Bestand — und genau die eine, die gebrochen war, ist
# darunter. Die uebrigen 120 schreiben `$$ LANGUAGE plpgsql;` und tragen ihr
# Semikolon von Bauart wegen.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

python3 <<'PY'
import re, pathlib, sys

FORTSETZUNG = re.compile(r'^(LANGUAGE|SECURITY|SET|STABLE|IMMUTABLE|VOLATILE|AS|COST|ROWS|PARALLEL)\b', re.I)
befund = []
gezaehlt = 0

for p in sorted(pathlib.Path("supabase/migrations").glob("*.sql")):
    lines = p.read_text(encoding="utf-8").splitlines()
    for i, l in enumerate(lines):
        if not re.fullmatch(r"\$\w*\$", l.strip()):
            continue
        gezaehlt += 1
        j = i + 1
        while j < len(lines) and (not lines[j].strip() or lines[j].lstrip().startswith("--")):
            j += 1
        nxt = lines[j].strip() if j < len(lines) else ""
        if not nxt.startswith(";") and not FORTSETZUNG.match(nxt):
            befund.append((p.name, i + 1, nxt[:50]))

if befund:
    print("FAIL: dollar-gequoteter Block ohne abschliessendes Semikolon.\n")
    for name, zeile, nxt in befund:
        print(f"  supabase/migrations/{name}:{zeile}")
        print(f"      naechste Anweisung: {nxt!r}")
    print()
    print("psql liest bis zum Semikolon. Ohne eines zieht es die naechste")
    print("Anweisung mit hinein und meldet den Fehler an einer Stelle, die mit")
    print("der Ursache nichts zu tun hat. Ein `;` hinter die Endmarke.")
    sys.exit(1)

print(f"PASS: {gezaehlt} dollar-gequotete Bloecke, alle abgeschlossen.")
PY
