#!/bin/bash
# lint-role-vocabulary.sh — Server, Typ und Beschriftung müssen dieselben
# Rollen kennen.
#
# Run: bash scripts/lint-role-vocabulary.sh
# Exit code: 0 = pass, 1 = Verstoss gefunden.
#
# ── WARUM ES DIESES TOR GIBT ────────────────────────────────────────────────
#
# Am 01.09.2026 standen auf Produktion zwei Mitgliedschaften mit
# `member_role = 'architect'`. Die Rangfolge des Servers kennt dieses Wort
# nicht:
#
#     ROLE_HIERARCHY = {"viewer": 0, "editor": 1, "admin": 2, "owner": 3}
#     required_level = ROLE_HIERARCHY.get(required_role, 0)
#     actual_level   = ROLE_HIERARCHY.get(member["member_role"], 0)
#
# `.get(..., 0)` ist fail-closed, also entstand kein Loch — aber ein
# `architect` ist damit still ein `viewer`. Beide Zeilen gehören dem
# Plattform-Admin, und `is_platform_admin()` umgeht jede Rollenprüfung. Der
# Fehler war deshalb UNSICHTBAR: die Tür öffnet sich nur für die, die ohnehin
# schon drinnen sind. Bekäme eine Nutzerin ohne Admin-Recht dieselbe Rolle,
# wäre sie ohne jede Meldung nur Betrachterin — und die Oberfläche schriebe
# „Architect" daneben.
#
# ── WAS DIESES TOR HÄLT UND WAS NICHT ───────────────────────────────────────
#
# Gehalten wird die Übereinstimmung der drei VOKABULARE im Code:
#
#   1. `ROLE_HIERARCHY`  in backend/dependencies.py   — die Wahrheit der Rechte
#   2. `SimulationRole`  in frontend/src/types/index.ts
#   3. `memberRoleLabel` in frontend/src/utils/enum-labels.ts
#
# (1) und (2) müssen GLEICH sein: es ist dasselbe Vokabular, einmal in Python
# und einmal in TypeScript. (3) muss eine OBERMENGE sein — die Anzeige muss
# auch ein Wort benennen können, das nur in den Daten steht, sonst zeigt sie
# eine Lücke.
#
# NICHT gehalten wird der Datenbestand. Dass `simulation_members.member_role`
# keine CHECK-Bedingung trägt und deshalb jedes Wort annimmt, ist ein eigener
# Befund; die Reparatur dafür ist die Bedingung selbst, nicht ein Skript.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

PY_FILE="backend/dependencies.py"
TS_TYPE="frontend/src/types/index.ts"
TS_LABEL="frontend/src/utils/enum-labels.ts"

for f in "$PY_FILE" "$TS_TYPE" "$TS_LABEL"; do
  if [ ! -f "$f" ]; then
    echo "FAIL: $f fehlt — das Tor misst sonst eine leere Menge und besteht aus dem falschen Grund."
    exit 1
  fi
done

# 1) Die Rangfolge des Servers.
HIER=$(sed -n '/^ROLE_HIERARCHY/,/^}/p' "$PY_FILE" | grep -oE '"[a-z_]+":' | tr -d '":' | sort)

# 2) Die Vereinigung im Frontend-Typ.
TYPE=$(sed -n "s/^export type SimulationRole = \(.*\);/\1/p" "$TS_TYPE" \
       | grep -oE "'[a-z_]+'" | tr -d "'" | sort)

# 3) Die Zweige der Beschriftungsfunktion.
LABEL=$(sed -n '/^export function memberRoleLabel/,/^}/p' "$TS_LABEL" \
        | grep -oE "case '[a-z_]+':" | grep -oE "'[a-z_]+'" | tr -d "'" | sort)

fail=0

if [ -z "$HIER" ] || [ -z "$TYPE" ] || [ -z "$LABEL" ]; then
  echo "FAIL: eine der drei Listen wurde leer gelesen — das Muster passt nicht mehr."
  printf '  ROLE_HIERARCHY : %s\n' "$(echo "$HIER" | tr '\n' ' ')"
  printf '  SimulationRole : %s\n' "$(echo "$TYPE" | tr '\n' ' ')"
  printf '  memberRoleLabel: %s\n' "$(echo "$LABEL" | tr '\n' ' ')"
  exit 1
fi

DIFF=$(comm -3 <(echo "$HIER") <(echo "$TYPE") || true)
if [ -n "$DIFF" ]; then
  echo "FAIL: ROLE_HIERARCHY ($PY_FILE) und SimulationRole ($TS_TYPE) kennen nicht dieselben Rollen."
  echo "  nur im Server / nur im Typ:"
  echo "$DIFF" | sed 's/^/    /'
  fail=1
fi

MISSING=$(comm -23 <(echo "$HIER") <(echo "$LABEL") || true)
if [ -n "$MISSING" ]; then
  echo "FAIL: memberRoleLabel ($TS_LABEL) benennt nicht jede Rolle, die Rechte trägt."
  echo "  ohne Beschriftung:"
  echo "$MISSING" | sed 's/^/    /'
  fail=1
fi

if [ "$fail" -ne 0 ]; then
  exit 1
fi

echo "PASS: Rollenvokabular stimmt überein ($(echo "$HIER" | wc -l | tr -d ' ') Rollen mit Rechten, $(echo "$LABEL" | wc -l | tr -d ' ') beschriftet)."
