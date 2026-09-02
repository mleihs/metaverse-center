#!/usr/bin/env bash
# Zahlen in der Hilfe müssen aus der Sache stammen, die sie beschreiben.
#
# Befund H3 der Systemprüfung, am 31.08.2026 nachgemessen. Die Hilfe stand
# seit Monaten neben der Wirklichkeit, und zwar an fünf Stellen gleichzeitig:
#
#   „30 Befehle"        → COMMAND_REGISTRY hat 32
#   „12 Themen"         → TOPICS hat 16 (vier Systeme verschwiegen,
#                         darunter Terminal und Dungeons)
#   „6 Schulen"         → combat_abilities kennt 7 (universal fehlte)
#   „bis zu 4 Agenten"  → min_length=2, ein Agent wird ABGELEHNT
#   „nach 50 Befehlen"  → CLEARANCE_THRESHOLDS hat für Stufe 4 gar keinen
#                         Eintrag; sie kommt allein aus dem Epochenmodus
#
# Dazu vier Befehle, die die Hilfe namentlich erklärte und die es nicht gibt
# (`deploy`, `ally`, `broadcast`, `encrypt`).
#
# WARUM EIN TOR UND NICHT NUR EINE KORREKTUR: keine dieser Zahlen war je
# falsch. Jede war einmal richtig und ist danach in der Sache gewachsen,
# während der Satz stehen blieb. Eine Korrektur ohne Tor ist deshalb nur eine
# Verabredung mit der Zukunft — und die ist fünfmal gebrochen worden.
#
# Der Weg dagegen ist NICHT, jede Zahl abzuleiten (manche Sätze lesen sich mit
# einer eingesetzten Zahl schlechter), sondern die abgeleiteten wie die
# geschriebenen gegen die QUELLE zu prüfen.
#
# Eine Formfalle beim Bau, weil sie sich wiederholen wird: das Register
# schreibt den Schlüssel auf eine EIGENE Zeile (`[` \n `'look',`). Ein
# JavaScript-Ausdruck mit `\s` überbrückt den Zeilenumbruch und fand alle 32;
# grep ist zeilenweise und fand null. Das Tor meldete das als Fehler statt als
# PASS — genau dafür steht die Untergrenze weiter unten.
#
# J3b beachtet: der Prüfbereich wird von Kommentaren bereinigt, BEVOR gesucht
# wird. Dieser Kopfkommentar nennt genau die Zeichenketten, die das Tor
# verbietet — ohne Bereinigung würde das Tor sich selbst finden.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

fail=0
checked=0

note() { echo "  $1"; }
bad()  { echo "FAIL: $1" >&2; fail=1; }

# ── Kommentare aus einer TS-Datei entfernen (J3b) ───────────────────────────
strip_comments() {
  # Blockkommentare, dann Zeilenkommentare. sed reicht: die Hilfe-Dateien
  # tragen keine Zeichenketten mit '//' oder '/*' (geprüft beim Bau).
  perl -0pe 's{/\*.*?\*/}{}gs' "$1" | sed -e 's://.*::'
}

# ── 1. Terminalbefehle: Register vs. behauptete Zahl ────────────────────────
REG="src/utils/terminal-commands.ts"
[[ -f "$REG" ]] || { bad "$REG nicht gefunden — ist das Register umgezogen?"; }

if [[ -f "$REG" ]]; then
  n_cmds=$(sed -n '/export const COMMAND_REGISTRY/,$p' "$REG" \
    | grep -cE "^    '[a-z_]+',\$")
  if (( n_cmds < 10 )); then
    bad "nur $n_cmds Befehle im Register gelesen — der Ausdruck zeigt ins Leere, nicht das Register ist leer"
  else
    checked=$((checked + 1))
    note "COMMAND_REGISTRY: $n_cmds Befehle"
    for f in src/components/how-to-play/htp-topic-data.ts src/components/how-to-play/htp-content-features.ts; do
      [[ -f "$f" ]] || continue
      if hit=$(strip_comments "$f" | grep -nE "[0-9]+ (commands )?across [0-9]+ tiers" | grep -vE "\b$n_cmds\b"); then
        bad "$f nennt eine andere Befehlszahl als die gemessenen $n_cmds:"
        echo "$hit" >&2
      fi
    done
  fi
fi

# ── 1b. Freigabeschwellen: CLEARANCE_THRESHOLDS vs. behauptete Zahlen ───────
#
# Der erste Entwurf dieses Tors hielt „unlocks after 10 commands" für eine
# BEFEHLSZAHL und meldete zwei Fehlalarme — das zu weite Fenster aus J3c,
# diesmal in der lauten Richtung. Der Ausweg war nicht, die Sätze
# auszuklammern, sondern die zweite Quelle mitzumessen: dann deckt das Tor
# beide Zahlenarten ab, und der Befund „nach 50 Befehlen" (eine Schwelle, die
# es nie gab) wäre schon hier aufgefallen statt erst bei der Handprüfung.
TSM="src/services/TerminalStateManager.ts"
if [[ -f "$TSM" ]]; then
  thresholds=$(sed -n '/CLEARANCE_THRESHOLDS/,/^};/p' "$TSM" | grep -oE "^  [0-9]+: [0-9]+" | grep -oE "[0-9]+\$")
  n_thresholds=$(wc -l <<< "$thresholds" | tr -d ' ')
  if [[ -z "$thresholds" ]]; then
    bad "keine Freigabeschwellen in $TSM gelesen — der Ausdruck zeigt ins Leere"
  else
    checked=$((checked + 1))
    note "CLEARANCE_THRESHOLDS: $(tr '\n' ' ' <<< "$thresholds")($n_thresholds Stufen)"
    for f in src/components/how-to-play/*.ts; do
      while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        claimed=$(grep -oE "fter ([0-9]+) commands" <<< "$line" | grep -oE "[0-9]+")
        for c in $claimed; do
          if ! grep -qx "$c" <<< "$thresholds"; then
            bad "$f nennt die Freigabeschwelle $c, die es in CLEARANCE_THRESHOLDS nicht gibt:"
            echo "    $line" >&2
          fi
        done
      done < <(strip_comments "$f" | grep -nE "fter [0-9]+ commands")
    done
  fi
fi

# ── 2. Hilfethemen: TOPICS vs. behauptete Zahl ──────────────────────────────
TOPICS_FILE="src/components/how-to-play/htp-topic-data.ts"
if [[ -f "$TOPICS_FILE" ]]; then
  n_topics=$(sed -n '/export const TOPICS/,$p' "$TOPICS_FILE" | grep -cE "^    slug: '")
  if (( n_topics < 5 )); then
    bad "nur $n_topics Themen gelesen — der Ausdruck zeigt ins Leere"
  else
    checked=$((checked + 1))
    note "TOPICS: $n_topics Themen"
    # Eine feste Themenzahl darf nirgends mehr stehen; die Zahl wird zur
    # Laufzeit aus visibleTopics() abgeleitet (DRIFT ist flag-gesteuert,
    # die sichtbare Zahl ist also 15 ODER 16 — eine feste Zahl kann daher
    # gar nicht richtig sein).
    for f in src/components/how-to-play/*.ts; do
      if hit=$(strip_comments "$f" | grep -nE "[0-9]+ topics?( pages?)? covering"); then
        bad "$f schreibt die Themenzahl fest; sie gehört aus visibleTopics() abgeleitet:"
        echo "$hit" >&2
      fi
    done
  fi
fi

# ── 3. Fertigkeitsschulen: YAML-Pakete vs. behauptete Zahl ──────────────────
if [[ -d ../content/dungeon/abilities ]]; then
  n_schools=$(find ../content/dungeon/abilities -name '*.yaml' | wc -l | tr -d ' ')
  if (( n_schools < 2 )); then
    bad "nur $n_schools Schulendateien gefunden — der Pfad zeigt ins Leere"
  else
    checked=$((checked + 1))
    note "Fertigkeitsschulen (content/dungeon/abilities): $n_schools"
    if hit=$(strip_comments "$TOPICS_FILE" | grep -nE "from [0-9]+ schools" | grep -vE "from $n_schools schools"); then
      bad "die Hilfe nennt eine andere Schulenzahl als die $n_schools YAML-Pakete:"
      echo "$hit" >&2
    fi
  fi
fi

# ── 4. Befehle, die die Hilfe namentlich erklärt, muss es geben ─────────────
if [[ -f "$REG" ]] && (( n_cmds >= 10 )); then
  checked=$((checked + 1))
  registry=$(sed -n '/export const COMMAND_REGISTRY/,$p' "$REG" \
    | grep -oE "^    '[a-z_]+',\$" | tr -d " ',")
  # Namentlich erklärt heißt: „wort (Erklärung)" in einer Aufzählung von
  # Terminalbefehlen. Wir prüfen die vier Phantome, die H3 gefunden hat, plus
  # jedes weitere Wort in derselben Form innerhalb der Stufenerzählungen.
  phantoms=""
  for verb in $(strip_comments src/components/how-to-play/htp-content-features.ts \
      | grep -oE "\b[a-z]{3,12} \((AI |intelligence |incoming |counter-|operative |alliance |public |private )" \
      | grep -oE "^[a-z]+" | sort -u); do
    if ! grep -qx "$verb" <<< "$registry"; then
      phantoms="$phantoms $verb"
    fi
  done
  if [[ -n "$phantoms" ]]; then
    bad "die Hilfe erklärt Befehle, die das Register nicht kennt:$phantoms"
  fi
fi

# ── 5. Der Beutebestand: Stücke, Archetypen, Wirkungsarten ─────────────────
#
# Am 01.09.2026 habe ich SELBST drei solche Zahlen in die Hilfe geschrieben —
# „105 pieces across the eight archetypes, in twelve effect types" — also genau
# die Sorte, wegen der dieses Tor existiert. Der Kopf zählt fünf davon auf,
# jede einmal richtig und danach still gewachsen.
#
# Die Quellen liegen in den Inhaltspaketen und im Wirkungsvertrag, nicht in der
# Datenbank: die Pakete sind laut A1.5 die kanonische Autorenquelle, die DB
# bekommt sie über eine erzeugte Migration. Ein Tor, das die DB fragt, würde
# eine Änderung erst NACH dem Deploy bemerken — hier soll sie vorher auffallen.
LOOT_DIR="../content/dungeon/archetypes"
if [[ -d "$LOOT_DIR" ]]; then
  n_arch=$(find "$LOOT_DIR" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')
  n_loot=$(grep -rh "^- id:" "$LOOT_DIR"/*/loot.yaml 2>/dev/null | wc -l | tr -d ' ')
  n_eff=$(grep -cE '^    "[a-z_]+": LootEffectContract' \
    ../backend/services/dungeon_loot_contracts.py 2>/dev/null || echo 0)

  if (( n_arch < 3 || n_loot < 20 || n_eff < 3 )); then
    bad "Beutequellen unlesbar (Archetypen=$n_arch Stücke=$n_loot Wirkungen=$n_eff) — die Ausdrücke zeigen ins Leere, nicht die Pakete sind leer"
  else
    checked=$((checked + 1))
    note "Beute: $n_loot Stücke · $n_arch Archetypen · $n_eff Wirkungsarten"

    # Zahlwörter mitprüfen: der Satz in der Hilfe schreibt „eight" und
    # „twelve" aus, weil er sich mit Ziffern schlechter liest. Ein Tor, das nur
    # Ziffern kennt, hätte genau diesen Satz nicht gesehen.
    wort_fuer() {
      case "$1" in
        6) echo six;; 7) echo seven;; 8) echo eight;; 9) echo nine;; 10) echo ten;;
        11) echo eleven;; 12) echo twelve;; 13) echo thirteen;; 14) echo fourteen;;
        *) echo "__keins__";;
      esac
    }
    w_arch=$(wort_fuer "$n_arch")
    w_eff=$(wort_fuer "$n_eff")

    for f in src/components/how-to-play/*.ts; do
      [[ -f "$f" ]] || continue
      rein=$(strip_comments "$f")

      if hit=$(grep -nE "[0-9]+ pieces exist" <<< "$rein" | grep -vE "\b$n_loot pieces\b"); then
        bad "$f nennt eine andere Stückzahl als die gemessenen $n_loot:"
        echo "$hit" >&2
      fi
      # ⚠ Das Fenster ist ABSICHTLICH eng: „across the N archetypes", nicht
      # jedes „X archetypes". Der erste Entwurf nahm alles und meldete drei
      # Fehlalarme, jeder eine andere Zahl ueber eine andere Sache:
      #
      #   „conflict archetypes"                        kein Zaehlwort
      #   „Three archetypes playable in the terminal"  eine echte Teilmenge (3)
      #   „5 personality archetypes"                   Bot-Persoenlichkeiten
      #
      # Ein Tor, das bei jedem Lauf drei Zeilen meldet, die in Ordnung sind,
      # wird weggeklickt — und dann uebersieht man die vierte, die es nicht
      # ist. Lieber eine Satzform binden, die man kennt, als eine Wortart
      # raten.
      if hit=$(grep -nE "across the [a-z0-9]+ archetypes" <<< "$rein" \
                | grep -viE "across the ($n_arch|$w_arch) archetypes"); then
        bad "$f nennt eine andere Archetypenzahl als die gemessenen $n_arch ($w_arch):"
        echo "$hit" >&2
      fi
      if hit=$(grep -nE "in [a-z]+ effect types" <<< "$rein" | grep -viE "\b($n_eff|$w_eff)\b"); then
        bad "$f nennt eine andere Zahl von Wirkungsarten als die gemessenen $n_eff ($w_eff):"
        echo "$hit" >&2
      fi
    done
  fi
else
  bad "$LOOT_DIR nicht gefunden — sind die Inhaltspakete umgezogen?"
fi

if (( checked == 0 )); then
  echo "FAIL: dieses Tor hat NICHTS geprüft — jede Quelle war unlesbar." >&2
  exit 1
fi

if (( fail )); then
  echo "" >&2
  echo "Die Zahlen der Hilfe stammen aus der Sache, nicht aus dem Gedächtnis." >&2
  echo "Neu messen, dann den Satz ändern — nicht umgekehrt." >&2
  exit 1
fi

echo "PASS: help numbers match their sources ($checked sources measured)."
