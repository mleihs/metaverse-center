#!/usr/bin/env bash
# Bindet jede Zustands-Leiter in nutzersichtbarem Text an ihre Quelle.
#
# WARUM ES DIESES TOR GIBT
# Die Hilfe, der Bau-Editor und die Spezifikation nannten jahrelang
# „Good x1.0, Moderate x0.75, Poor x0.5, Ruined x0.2". Drei Fehler in einem
# Satz: `excellent` fehlte, `good` wiegt 0,85 und nicht 1,0 — und `Moderate`
# ist ueberhaupt keine Sprosse. Der Satz wurde einmal in der Hilfe korrigiert
# und stand danach weiter im Bau-Editor und in der Spezifikation, weil niemand
# gefragt hat, WO ER SONST NOCH STEHT.
#
# Kein Tor konnte das sehen: `lint-help-numbers-measured.sh` prueft Zahlen
# gegen gezaehlte Bestaende, nicht Sprossennamen gegen eine Taxonomie.
#
# WAS ES PRUEFT
# Jede Stelle im nutzersichtbaren Text, die eine Sprosse mit Gewicht nennt
# (`<sprosse> x<gewicht>`), muss mit dem Saatgut in Migration 031
# uebereinstimmen — Name existiert, Gewicht stimmt.
#
# Eine Welt darf eigene Sprossen setzen (Migration 311). Das Tor prueft die
# UEBLICHE Leiter, die der Text als solche benennt, nicht den Weltbestand.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

SAAT="$(grep -rl "building_condition: set game_weight" supabase/migrations/ | head -1)"
[ -n "$SAAT" ] || { echo "FAIL: Saatgut-Migration fuer building_condition nicht gefunden."; exit 1; }

# Sprosse<TAB>Gewicht aus dem CASE-Block der Saat-Migration (bash 3.2: kein declare -A)
LEITER="$(sed -n "/building_condition: set game_weight/,/WHERE taxonomy_type = 'building_condition'/p" "$SAAT" \
          | grep -oE "WHEN '[a-z]+'[[:space:]]*THEN [0-9.]+" \
          | sed -E "s/WHEN '([a-z]+)'[[:space:]]*THEN ([0-9.]+)/\1 \2/")"

SPROSSEN=$(echo "$LEITER" | grep -c .)
[ "$SPROSSEN" -ge 5 ] || { echo "FAIL: nur $SPROSSEN Sprossen gelesen — das Tor misst nichts."; exit 1; }

DOPPELT="$(echo "$LEITER" | awk '{print $1}' | sort | uniq -d)"
[ -z "$DOPPELT" ] || { echo "FAIL: Sprosse(n) doppelt gelesen ($DOPPELT) — der sed-Bereich greift ueber den CASE-Block hinaus."; exit 1; }

gewicht_von() { echo "$LEITER" | awk -v s="$1" '$1==s {print $2; found=1} END{if(!found) print ""}'; }
norm() { awk -v n="$1" 'BEGIN{printf "%.2f", n+0}'; }

BEFUNDE=0
GEPRUEFT=0
while IFS=: read -r datei zeile rest; do
  [ -z "$rest" ] && continue
  while read -r treffer; do
    spr="$(echo "$treffer" | sed -E 's/^([A-Za-z]+)[[:space:]]*[x×].*/\1/' | tr '[:upper:]' '[:lower:]')"
    gew="$(echo "$treffer" | sed -E 's/^[A-Za-z]+[[:space:]]*[x×]([0-9.,]+).*/\1/' | tr ',' '.')"
    case "$spr" in excellent|good|fair|poor|ruined|moderate|thriving|operational|preserved|functional|makeshift) ;; *) continue ;; esac
    GEPRUEFT=$((GEPRUEFT+1))
    soll="$(gewicht_von "$spr")"
    if [ -z "$soll" ]; then
      echo "FAIL: $datei:$zeile — '$spr' ist keine Sprosse der Leiter (Saat: $SAAT)"
      BEFUNDE=$((BEFUNDE+1))
    elif [ "$(norm "$gew")" != "$(norm "$soll")" ]; then
      echo "FAIL: $datei:$zeile — '$spr x$gew', die Saat sagt $soll"
      BEFUNDE=$((BEFUNDE+1))
    fi
  done < <(echo "$rest" | grep -oE "[A-Za-z]+[[:space:]]*[x×][0-9]+[.,][0-9]+")
done < <(grep -rn --include='*.ts' --include='*.md' -iE "staffing effectiveness|Wirksamkeit der Besetzung" \
           frontend/src/ docs/ 2>/dev/null | grep -v node_modules)

if [ "$GEPRUEFT" -eq 0 ]; then
  echo "FAIL: keine einzige Sprossen-Angabe gefunden — das Tor misst am falschen Ort."
  exit 1
fi
if [ "$BEFUNDE" -gt 0 ]; then
  echo "FAIL: $BEFUNDE falsche Sprossen-Angabe(n)."
  exit 1
fi
echo "PASS: alle $GEPRUEFT Sprossen-Angaben stimmen mit der Saat-Leiter ($SPROSSEN Sprossen)."
