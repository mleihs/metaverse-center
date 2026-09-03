#!/usr/bin/env bash
# Ein Grund ohne seine Tinte ist die Art Fehler, die niemand sieht.
#
# `velg-avatar` faerbt die Plakette mit `--_ground` und die Initiale mit
# `--_ink`. Wer nur den Grund umfaerbt, laesst die Tinte auf der Farbe der
# SEITE stehen — und die passt zur Seite, nicht zur Plakette. Genau so stand
# die Nutzer-Initiale in Velgarien schwarz auf schwarz (gemessen 2,06 : 1),
# weil `.avatar--user velg-avatar` nur `--color-surface-sunken` setzte.
#
# Das Tor ist absichtlich eng: es sieht NUR in Regeln nach, deren Selektor
# `velg-avatar` nennt. Ein Bauteil, das dasselbe Token an sich selbst setzt,
# geht es nichts an.
set -uo pipefail

# Der Anker in der Form, die `scripts/lint-lint-scripts-anchored.sh` verlangt:
# `$0` kann relativ sein und zeigt nach einem cd ins Leere, `BASH_SOURCE` wird
# VOR dem Wechsel aufgeloest. Ohne das greift ein Tor je nach Aufrufort ins
# Nichts — und meldet dann PASS, statt zu scheitern.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

files=$(find src -name '*.ts' -type f)

hits=$(awk '
  /velg-avatar[^;{]*\{[[:space:]]*$/ { inrule = 1; next }
  inrule && /^[[:space:]]*\}/        { inrule = 0; next }
  inrule && /--color-surface-sunken[[:space:]]*:/ { print FILENAME ":" FNR ": " $0 }
  inrule && /--color-text-quiet[[:space:]]*:/     { print FILENAME ":" FNR ": " $0 }
' $files)

if [ -n "$hits" ]; then
  echo "ERROR: eine velg-avatar-Regel setzt eine Haelfte des Paares."
  echo "$hits"
  echo
  echo "Die Plakette hat ein eigenes Paar. Setze beides:"
  echo "  --avatar-ground: var(--color-primary);"
  echo "  --avatar-ink:    var(--color-text-inverse);"
  echo
  echo "--color-surface-sunken / --color-text-quiet sind die Rollen der SEITE."
  echo "Auf einer umgefaerbten Plakette sagen sie nichts ueber deren Grund."
  exit 1
fi
echo "PASS: keine halb gesetzte Avatar-Paarung."
