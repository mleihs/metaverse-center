#!/usr/bin/env bash
# Kein API-Client ohne einen einzigen Aufrufer.
#
# Befund G7 der Systemprüfung, nachgemessen am 31.08.2026. Zwei ganze
# Client-Dateien hatten NULL Aufrufer im gesamten Baum:
#
#   SocialMediaApiService.ts   6 von 6 Methoden nie gerufen
#   CampaignsApiService.ts     9 von 9 Methoden nie gerufen
#
# Beide waren durchgängig verdrahtet: richtige Pfade, richtige Verben,
# passende Backend-Routen, Typen im Modell, ein Abschnitt in der Hilfe. Auf
# Prod: 0 Kampagnen, 0 Social-Posts. Die Mechanik war vollständig gebaut und
# von der Oberfläche aus unerreichbar.
#
# WARUM DIESE REGEL UND NICHT „KEINE UNGERUFENE METHODE": von 537 Methoden
# waren 114 ungerufen, und die meisten davon sind Nähte, an denen die Pakete
# D, E und F gerade bauen (`HeartbeatApiService.createResponse` war bis
# vorgestern ungerufen und ist heute die Bureau-Antwort-UI). Ein Tor, das
# jede einzelne verbietet, würde also genau die Arbeit bekämpfen, die der
# Plan verlangt — und binnen einer Woche eine Ausnahmeliste mit hundert
# Einträgen tragen, was kein Tor mehr ist, sondern ein Formular.
#
# Eine Datei dagegen, in der NICHTS gerufen wird, ist etwas anderes als eine
# Naht: sie ist ein Feature, dessen Tür nie gebaut wurde. Genau die Sorte, die
# in jedem Code-Review vollständig aussieht.
#
# Die Regel ist damit scharf, braucht keine Ausnahmeliste und schlägt bei
# genau dem Zustand an, der hier zweimal vorlag.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

API_DIR="src/services/api"
[[ -d "$API_DIR" ]] || { echo "FAIL: $API_DIR nicht gefunden" >&2; exit 1; }

fail=0
checked=0
dead=""

for file in "$API_DIR"/*ApiService.ts; do
  [[ -f "$file" ]] || continue

  # Die exportierte Singleton-Instanz ist die Adresse, unter der Aufrufer den
  # Client ansprechen: `export const fooApi = new FooApiService();`
  instance=$(grep -oE "^export const [a-zA-Z]+ = new " "$file" | awk '{print $3}')
  [[ -n "$instance" ]] || continue

  checked=$((checked + 1))

  # Aufrufer: `instance.methode(` irgendwo AUSSERHALB des API-Verzeichnisses.
  # Innerhalb zählt nicht — ein Client, den nur seine Geschwister rufen, ist
  # für die Oberfläche genauso stumm.
  callers=$(grep -rlE "\b${instance}\.[a-zA-Z_]+" src \
    --include="*.ts" 2>/dev/null | grep -v "^${API_DIR}/" | grep -v "^src/services/api/index.ts$" || true)

  if [[ -z "$callers" ]]; then
    dead="$dead\n  $file (Instanz: $instance)"
    fail=1
  fi
done

if (( checked == 0 )); then
  echo "FAIL: dieses Tor hat NULL Clients geprüft — der Ausdruck für die" >&2
  echo "      Singleton-Instanz findet nichts mehr. Ein Scan, der ins Leere" >&2
  echo "      zeigt, ist sonst grün." >&2
  exit 1
fi

if (( fail )); then
  echo "FAIL: API-Clients ohne einen einzigen Aufrufer:" >&2
  echo -e "$dead" >&2
  echo "" >&2
  echo "Ein Client ohne Aufrufer ist kein toter Code, den man liegen lässt —" >&2
  echo "er ist ein Feature, dessen Tür fehlt. Entweder verdrahten oder löschen." >&2
  exit 1
fi

echo "PASS: every api client has at least one caller ($checked clients checked)."
