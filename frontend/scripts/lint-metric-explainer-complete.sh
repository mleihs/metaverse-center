#!/bin/bash
# lint-metric-explainer-complete.sh — Jede Kennzahl-Erklärung muss alle drei
# Fragen beantworten.
#
# Run: bash frontend/scripts/lint-metric-explainer-complete.sh
# Exit: 0 = pass, 1 = Verstöße.
#
# Warum es dieses Tor gibt:
#   H7 hat neun Kennzahlen erklärt, die vorher nur eine Zahl und eine Farbe
#   trugen. Der Befund war nicht „keine Erklärung", sondern „0 von 9 beantworten
#   ALLE DREI Fragen" — drei hatten eine Blase, die sagte, was die Zahl ist, und
#   verschwieg, was man tun kann. Genau diese halbe Erklärung ist der Zustand,
#   den H7 beseitigt hat, und ein Bauteil mit drei optionalen Eigenschaften
#   erlaubt sie jederzeit wieder. TypeScript kann sie nicht erzwingen: Lit-
#   Eigenschaften haben Standardwerte, ein fehlendes `.action` ist ein leerer
#   String und kein Typfehler.
#
#   Das Tor liest deshalb jede Verwendung von `<velg-metric-explainer` und
#   verlangt `.what`, `.why` UND `.action` im selben Element.
#
# Selbstprüfung: findet der Scan gar keine Verwendung, ist das ein FEHLER und
# kein Erfolg. Ein Tor, das nichts trifft, besteht aus dem falschen Grund — an
# einem Tag im August bestanden vier eigene Messungen grün, weil sie ins Leere
# griffen.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

TAG='velg-metric-explainer'
VIOLATIONS=0
USAGES=0

# Die Definitionsdatei ist ausgenommen: ihr Docstring enthält ein
# Verwendungsbeispiel. Beim ersten Lauf zählte das Tor 11 statt 10 Verwendungen
# und las damit die eigene Erklärung mit — dieselbe Falle, die im August ein
# Dungeon-Tor grün hielt, weil der erklärende Kommentar die gesuchten Wörter
# enthielt. Ein Messgerät darf sich nicht selbst messen.
FILES=$(grep -rl "<$TAG" src --include='*.ts' 2>/dev/null \
          | grep -v '/VelgMetricExplainer\.ts$' \
          | sort || true)

for f in $FILES; do
  # Jede Verwendung erstreckt sich über mehrere Zeilen: vom öffnenden Tag bis
  # zum schließenden `></velg-metric-explainer>`. awk sammelt den Block und
  # prüft ihn als Ganzes — eine zeilenweise Suche würde jede Eigenschaft
  # einzeln finden und nie bemerken, dass sie zu verschiedenen Elementen
  # gehören.
  RESULT=$(awk -v tag="$TAG" -v file="$f" '
    index($0, "<" tag) && !index($0, "</" tag) { inblock=1; block=""; start=NR }
    inblock { block = block $0 "\n" }
    inblock && index($0, "</" tag ">") {
      inblock=0
      count++
      missing=""
      if (block !~ /\.what=/)   missing = missing " .what"
      if (block !~ /\.why=/)    missing = missing " .why"
      if (block !~ /\.action=/) missing = missing " .action"
      if (missing != "") printf "MISS\t%s:%d\t%s\n", file, start, missing
    }
    END { printf "COUNT\t%d\n", count }
  ' "$f")

  while IFS= read -r line; do
    case "$line" in
      MISS*) echo "  ✗ ${line#MISS	}" ; VIOLATIONS=$((VIOLATIONS + 1)) ;;
      COUNT*) USAGES=$((USAGES + ${line#COUNT	})) ;;
    esac
  done <<< "$RESULT"
done

if [ "$USAGES" -eq 0 ]; then
  echo "FAIL: der Scan hat KEINE Verwendung von <$TAG> gefunden."
  echo "      Entweder wurde das Bauteil entfernt, oder das Tor greift ins Leere."
  echo "      Ein Tor ohne Fund besteht nicht, es meldet sich."
  exit 1
fi

if [ "$VIOLATIONS" -gt 0 ]; then
  echo
  echo "FAIL: $VIOLATIONS unvollständige Kennzahl-Erklärung(en) von $USAGES."
  echo "      Eine Kennzahl braucht alle drei: was sie ist, warum sie so steht,"
  echo "      und was man tun kann. Zwei von drei ist der Zustand vor H7."
  exit 1
fi

echo "PASS: alle $USAGES Kennzahl-Erklärungen beantworten Was, Warum und Was-tun."
