#!/bin/bash
# lint-migration-order.sh — Der Zeitstempel einer Migration ist ihr Primärschlüssel,
# und die Nummer daneben muss dieselbe Reihenfolge erzählen.
#
# Run: bash scripts/lint-migration-order.sh
# Exit code: 0 = pass, 1 = Verstoss gefunden.
#
# ── WARUM ES DIESES TOR GIBT ────────────────────────────────────────────────
#
# `CLAIMS.md` enthielt genau diese Prüfung. Als SATZ:
#
#     „Migrationen: den ZEITSTEMPEL abstimmen, nicht die Nummer. Zwei
#      Migrationen mit sorgfältig abgestimmten Nummern trugen heute denselben
#      Zeitstempel, und `version` ist der Primärschlüssel. Prüfung:
#      `ls supabase/migrations | sed 's/_.*//' | sort | uniq -d` muss leer sein."
#
# Der Satz wurde am 31.08.2026 geschrieben. Am selben Tag, wenige Stunden
# später, kollidierten wieder zwei Dateien auf `20260901040000` — zwei
# Sitzungen, beide mit Nummer 322. Eine Regel, die aufgeschrieben ist statt
# geprüft, gilt nur für die Fälle, an die jemand gedacht hat.
#
# ── WAS EINE KOLLISION ANRICHTET ────────────────────────────────────────────
#
# `supabase_migrations.schema_migrations.version` ist der Primärschlüssel. Zwei
# Dateien mit demselben Zeitstempel konkurrieren um EINE Zeile; die zweite wird
# beim Anwenden stillschweigend übergangen.
#
# Der beobachtete Fall war schlimmer als „läuft nicht": beide Wirkungen WAREN
# auf Prod (von Hand angewendet), aber nur eine stand im Ledger. Damit sah alles
# richtig aus, und der nächste Migrationslauf hätte die unsichtbare Datei
# übersprungen — auf einer frischen Datenbank wäre sie nie gelaufen.
#
# ── UND WARUM AUCH DIE REIHENFOLGE DER NUMMERN GEPRÜFT WIRD ─────────────────
#
# Postgres ordnet nach dem Zeitstempel; die Nummer ist nur eine Beschriftung.
# Gedacht wird aber in Nummern — „nächste freie Nummer 324", „324 baut auf 322
# auf". Sinkt die Nummer, während der Zeitstempel steigt, ist dieses Denken
# falsch, ohne dass irgendetwas rot wird: wer dann eine 296 schreibt in der
# Annahme, sie laufe vor 297, irrt sich still.
#
# Gemessen am 31.08.2026 über 313 Migrationen: drei solche Umkehrungen, zwei
# davon aus der Mehr-Sitzungs-Phase desselben Tages. Der Hinweis ist also nicht
# historisch, sondern lebendig.
#
# ── WAS ZU TUN IST, WENN DIESES TOR ROT WIRD ────────────────────────────────
#
#   1. Höchsten vorhandenen Zeitstempel lesen.
#   2. Einen SPÄTEREN wählen — nicht nur eine höhere Nummer.
#   3. Die Nummer entsprechend höher wählen, damit beide dasselbe erzählen.
#
# Ist die Migration schon auf Prod angewendet: Datei umbenennen UND die
# Ledger-Zeile unter dem neuen Zeitstempel nachtragen, sonst läuft sie auf einer
# frischen Datenbank doppelt.

# Kein `set -e`: dieses Tor sammelt ALLE Verstoesse, statt beim ersten
# stehenzubleiben. `grep` ohne Treffer gibt 1 zurueck, und das ist hier ein
# gueltiges Ergebnis, kein Abbruchgrund.
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

DIR="supabase/migrations"
[ -d "$DIR" ] || { echo "FAIL: $DIR nicht gefunden"; exit 1; }

# Historische Schuld, benannt statt versteckt. Beide Paare tragen VERSCHIEDENE
# Zeitstempel und sind deshalb harmlos für den Primärschlüssel — sie stehen hier,
# weil eine doppelte Nummer einen Menschen trotzdem in die Irre führt.
ALLOWED_DUP_NUMBERS="038 187"
# Umkehrungen, die vor diesem Tor entstanden sind. Jede Zeile: der Zeitstempel
# der Datei, deren Nummer unter die ihrer Vorgängerin fällt.
ALLOWED_INVERSIONS="20260306082644 20260831080000 20260831100000"

fail=0

# ── ① Doppelte Zeitstempel: der Primärschlüssel. Immer tödlich. ─────────────
dups=$(ls "$DIR" | grep -oE '^[0-9]{14}' | sort | uniq -d)
if [ -n "$dups" ]; then
  echo "FAIL: zwei Migrationen teilen sich einen Zeitstempel — das ist der Primärschlüssel."
  for t in $dups; do
    echo "  $t:"
    ls "$DIR" | grep "^$t" | sed 's/^/    /'
  done
  echo "  Eine davon umbenennen: SPÄTERER Zeitstempel, höhere Nummer."
  echo "  Ist sie schon auf Prod: auch die Ledger-Zeile unter dem neuen Zeitstempel nachtragen."
  fail=1
fi

# ── ② Doppelte Nummern: verwirren Menschen, nicht Postgres. ─────────────────
#
# EIN Muster für Erkennung UND Anzeige. Die erste Fassung dieses Tors benutzte
# zwei — die Erkennung ohne den Unterstrich nach der Nummer, die Anzeige mit —
# und meldete daraufhin `027` als Duplikat von `027b`, wobei sie nur EINE Datei
# zeigte. Zwei Muster für dieselbe Sache ist genau der Fehler, gegen den dieses
# Tor steht; er hat es beim ersten Lauf selbst getroffen.
#
# `027b`, `065c`, `186b`, `266a` sind KEINE Duplikate, sondern absichtliche
# Teilschritte. Der Buchstabe gehört zur Beschriftung.
dupn=$(ls "$DIR" | grep -oE '^[0-9]{14}_[0-9]{3}[a-z]?_' | sed -E 's/^[0-9]{14}_([0-9]{3}[a-z]?)_$/\1/' | sort | uniq -d)
for n in $dupn; do
  case " $ALLOWED_DUP_NUMBERS " in
    *" $n "*) continue ;;
  esac
  echo "FAIL: Nummer $n ist doppelt vergeben:"
  ls "$DIR" | grep -E "^[0-9]{14}_${n}_" | sed 's/^/    /'
  fail=1
done

# ── ③ Nummer und Zeitstempel müssen dieselbe Reihenfolge erzählen. ─────────
# Verglichen werden die drei Ziffern; der Buchstabe eines Teilschritts zählt
# nicht als Rückschritt (`027` → `027b` steigt).
prev_num=""
prev_name=""
while read -r name; do
  num=$(echo "$name" | cut -d_ -f2 | tr -cd '0-9')
  ts=$(echo "$name" | cut -d_ -f1)
  if [ -n "$prev_num" ] && [ "$((10#$num))" -lt "$((10#$prev_num))" ]; then
    case " $ALLOWED_INVERSIONS " in
      *" $ts "*) : ;;
      *)
        echo "FAIL: die Nummer sinkt, während der Zeitstempel steigt:"
        echo "    $prev_name"
        echo "    $name   ← läuft SPÄTER, heisst aber niedriger"
        fail=1
        ;;
    esac
  fi
  prev_num="$num"
  prev_name="$name"
done < <(ls "$DIR" | grep -E '^[0-9]{14}_[0-9]{3}[a-z]?_' | sort)

# Frühe Dateien tragen gar keine Nummer (`20260215000001_foundation.sql`) und
# sind von ② und ③ ausgenommen; ① prüft sie mit, denn ihr Zeitstempel ist
# genauso ein Primärschlüssel.
total=$(ls "$DIR" | grep -cE '^[0-9]{14}_[0-9]{3}[a-z]?_')
# Ein Tor, das nichts findet, weil es nichts SIEHT, besteht aus dem falschen
# Grund — das ist heute mehrfach passiert. Also die Sichtbarkeit selbst prüfen.
if [ "$total" -lt 100 ]; then
  echo "FAIL: nur $total Migrationen erkannt — das Namensmuster stimmt nicht mehr."
  exit 1
fi

if [ "$fail" -eq 0 ]; then
  echo "PASS: $total Migrationen, Zeitstempel eindeutig, Nummern erzählen dieselbe Reihenfolge."
fi
exit "$fail"
