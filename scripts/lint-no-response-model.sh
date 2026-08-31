#!/bin/bash
# lint-no-response-model.sh — Der Rückgabetyp ist die einzige Quelle der
# Antwortform. `response_model=` wäre eine zweite.
#
# Run: bash scripts/lint-no-response-model.sh
# Exit code: 0 = pass, 1 = Verstoss gefunden.
#
# ── WAS GESCHÜTZT WIRD ──────────────────────────────────────────────────────
#
# CLAUDE.md: „Return type annotation is the single source of truth (no
# `response_model=` parameter)." Der Pydantic-Refactor hat das über 468
# Endpunkte, 46 Router und 45 Modelle durchgezogen.
#
# Warum es zählt: FastAPI nimmt `response_model=`, WENN es dasteht, und sonst
# die Annotation. Stehen beide da und meinen Verschiedenes, gewinnt der
# Parameter — und die Annotation, die jeder Leser für die Wahrheit hält, ist
# dann eine Behauptung. Das ist die teuerste Form: nicht falsch, sondern
# unwirksam, und im Diff sieht sie richtig aus.
#
# ── DIE ZWEI AUSNAHMEN, BEIDE ECHT ──────────────────────────────────────────
#
#   backend/app.py                 serve_spa      FileResponse | HTMLResponse |
#                                                 JSONResponse | RedirectResponse
#   backend/routers/email_preview  preview_email  HTMLResponse | PlainTextResponse
#
# Beide geben eine Vereinigung von Response-KLASSEN zurück, von denen keine ein
# Pydantic-Modell ist; FastAPI kann daraus kein Schema bauen und braucht das
# ausdrückliche `None`.
#
# ⚠ CLAUDE.md nennt an dieser Stelle nur EINE Ausnahme („Sole benign exception:
# the SPA catch-all"). Gemessen am 31.08.2026 sind es zwei — `email_preview.py`
# ist im März dazugekommen und trägt ihre Begründung im eigenen Docstring, aber
# die Regel oben wurde nicht nachgezogen. Genau deshalb steht die Liste ab jetzt
# HIER: eine Aufzählung in Prosa altert, eine im Tor wird rot.

set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

ALLOWED="backend/app.py backend/routers/email_preview.py"

# ⚠ `backend/.venv/` ist ein ZWEITES venv im Baum (neben `.venv/` an der Wurzel).
# Ohne diesen Ausschluss meldet das Tor FastAPI selbst — 22 Treffer in
# `site-packages`, alle korrekt und keiner unserer. Ein Suchfenster, das
# Fremdcode einschliesst, misst nicht das Projekt.
hits=$(grep -rn "response_model=" backend --include='*.py' \
       | grep -vE "/(\.venv|venv|site-packages|node_modules)/" \
       | grep -v "/tests/" \
       | grep -vE "^\s*#|:\s*#" \
       | grep -E "response_model=" || true)

fail=0
found=0
while IFS= read -r line; do
  [ -z "$line" ] && continue
  file="${line%%:*}"
  # Kommentare und Dokumentation nennen den Parameter, ohne ihn zu benutzen.
  text="${line#*:*:}"
  case "$text" in
    *"#"*"response_model="*) continue ;;
  esac
  echo "$text" | grep -qE '^\s*(\*|--|#)' && continue
  echo "$text" | grep -qE '`response_model=' && continue
  found=$((found + 1))
  case " $ALLOWED " in
    *" $file "*) continue ;;
  esac
  echo "FAIL: $line"
  fail=1
done <<< "$hits"

if [ "$fail" -eq 1 ]; then
  echo
  echo "Der Rückgabetyp ist die einzige Quelle der Antwortform:"
  echo "    async def foo(...) -> SuccessResponse[Bar]:"
  echo "Stehen Parameter und Annotation beide da, gewinnt der Parameter — und die"
  echo "Annotation wird zu einer Behauptung, die im Diff richtig aussieht."
  echo "Erlaubt sind nur Endpunkte, die eine Vereinigung von Response-KLASSEN"
  echo "zurückgeben (kein Pydantic-Modell): $ALLOWED"
  exit 1
fi

# Ein Tor, das nichts sieht, besteht aus dem falschen Grund: die zwei bekannten
# Stellen MÜSSEN gefunden werden, sonst greift der grep ins Leere.
if [ "$found" -lt 2 ]; then
  echo "FAIL: nur $found Vorkommen erkannt, erwartet mindestens die 2 bekannten."
  echo "      Das Suchmuster stimmt nicht mehr — das Tor misst nichts."
  exit 1
fi

echo "PASS: response_model= steht nur an den 2 begründeten Stellen ($found Vorkommen geprüft)."
exit 0
