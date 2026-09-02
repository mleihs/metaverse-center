#!/usr/bin/env bash
# Keine HTML-Entities in den erzeugten Übersetzungen.
#
# `lit-localize build` reicht die XML-Maskierung aus dem XLIFF unverändert in
# den TypeScript-String durch. Im XLIFF ist `&lt;` richtig; im gerenderten Text
# ist es ein Fehler, den nur ein deutschsprachiger Blick auf die Seite findet —
# am 02.09.2026 standen 67 davon in `de.ts` (27 × `&lt;`, 40 × `&gt;`), und in
# der englischen Quelle keine einzige. „salvage &lt;raum_index&gt;" stand so im
# Dungeon-Terminal.
#
# Das Gegenmittel steht in `scripts/decode-locale-entities.mjs` und läuft in
# `npm run i18n:build`. Dieses Tor sorgt dafür, dass ein Bau ohne den Schritt
# nicht unbemerkt eingecheckt wird.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

DIR="src/locales/generated"
[[ -d "$DIR" ]] || { echo "FAIL: $DIR nicht gefunden" >&2; exit 1; }

hits=$(grep -rn '&amp;\|&lt;\|&gt;\|&quot;\|&#39;' "$DIR" 2>/dev/null || true)

if [[ -n "$hits" ]]; then
  count=$(printf '%s\n' "$hits" | wc -l | tr -d ' ')
  echo "FAIL: $count Zeile(n) in $DIR tragen HTML-Entities." >&2
  printf '%s\n' "$hits" | head -10 >&2
  echo "" >&2
  echo "Beheben mit: cd frontend && npm run i18n:build" >&2
  exit 1
fi

files=$(find "$DIR" -name '*.ts' | wc -l | tr -d ' ')
echo "PASS: keine HTML-Entities in den erzeugten Übersetzungen ($files Datei(en))."
