#!/usr/bin/env bash
# lint-no-em-dash-in-content.sh — der Geviertstrich gehoert nicht in Text,
# den ein Mensch (oder ein Modell) zu lesen bekommt.
# Run: bash scripts/lint-no-em-dash-in-content.sh
#
# Exit code: 0 = pass, 1 = violations found.
#
# Die Projektregel stand bisher nur fuer `msg()` im Frontend, und
# `frontend/scripts/lint-llm-content.sh` haelt genau diese Seite. Die andere
# Seite hatte kein Tor: 1 253 Geviertstriche standen im Backend, in den
# Saat-Dateien und in den Inhaltspaketen des Verlieses — davon allein 806 in
# `ambient_weather_templates.py`, also in Text, den das Spiel woertlich anzeigt.
#
# Geprueft werden drei Orte, und zwar jeweils NUR dort, wo der Strich einen
# Leser erreicht:
#
#   1. backend/**/*.py  — String-LITERALE (Docstrings, Kommentare und die
#      Testsuite bleiben aussen vor: die sind an Entwickler adressiert).
#   2. content/**/*.yaml — Datenzeilen (YAML-Kommentare bleiben aussen vor).
#   3. supabase/seed/*.sql — Datenzeilen (SQL-Kommentare bleiben aussen vor).
#
# Migrationen sind bewusst NICHT dabei: dort steht der Strich in der
# Begruendung, und die ist an den naechsten Entwickler gerichtet. Wo eine
# Migration Inhalt einspielt, ist die Quelle (Saat bzw. Paket) hier gedeckt.
#
# Warum ueberhaupt: ein Prompt mit Geviertstrichen bringt dem Modell den
# Geviertstrich bei, und dessen Ausgabe ist wieder Text fuer einen Leser. Die
# Quelle zu bereinigen und den Bestand nicht, reicht nicht — siehe Migration
# 351, die dieselbe Saeuberung auf der bestehenden Datenbank nachholt.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

PY="backend/.venv/bin/python"
[ -x "$PY" ] || PY="python3"

# Der Tokenizer zerlegt f-Strings erst ab 3.12 in FSTRING_MIDDLE. Auf einem
# aelteren Interpreter faende dieses Tor KEINEN einzigen f-String und meldete
# trotzdem PASS — also genau die Sorte gruener Lauf, die nichts gemessen hat.
# Lieber laut abbrechen als leise schwaecher werden.
if ! "$PY" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 12) else 1)'; then
  echo "ERROR: $PY ist $("$PY" -c 'import sys; print("%d.%d" % sys.version_info[:2])') —"
  echo "       dieses Tor braucht 3.12+, sonst entgeht ihm jeder f-String."
  exit 1
fi

VIOLATIONS=0

# ── 1. Python-String-Literale ────────────────────────────────────────────────
# Ueber den Tokenizer, nicht ueber grep: nur so bleiben Kommentar und Docstring
# sauber draussen. Ab 3.12 zerlegt der Tokenizer f-Strings in FSTRING_MIDDLE —
# ohne das entgeht dem Tor jeder f-String (so blieben beim ersten Lauf 94
# Stellen unentdeckt, darunter der Seitentitel in `seo_content.py`).
PY_HITS="$("$PY" - <<'PYEOF'
import ast, io, os, sys, tokenize

def docstring_starts(src):
    out = set()
    for n in ast.walk(ast.parse(src)):
        if isinstance(n, (ast.Module, ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            b = n.body
            if b and isinstance(b[0], ast.Expr) and isinstance(b[0].value, ast.Constant) \
               and isinstance(b[0].value.value, str):
                out.add((b[0].value.lineno, b[0].value.col_offset))
    return out

KINDS = (tokenize.STRING, getattr(tokenize, 'FSTRING_MIDDLE', -1))
for root, dirs, files in os.walk('backend'):
    dirs[:] = [d for d in dirs if d not in ('.venv', 'tests', '__pycache__')]
    for fn in files:
        if not fn.endswith('.py'):
            continue
        p = os.path.join(root, fn)
        src = open(p, encoding='utf-8').read()
        if '—' not in src:
            continue
        try:
            docs = docstring_starts(src)
            toks = list(tokenize.generate_tokens(io.StringIO(src).readline))
        except Exception as exc:      # unparsable file is its own bug, not ours
            print(f'{p}:0: konnte nicht gelesen werden ({exc})')
            continue
        for tok in toks:
            if tok.type in KINDS and '—' in tok.string and tok.start not in docs:
                print(f'{p}:{tok.start[0]}: {tok.string.strip()[:90]}')
PYEOF
)"

if [ -n "$PY_HITS" ]; then
  echo "ERROR: Geviertstrich (U+2014) in Python-String-Literalen."
  echo "       Text, den ein Leser oder ein Modell bekommt, fuehrt U+2013: –"
  echo ""
  echo "$PY_HITS"
  echo ""
  VIOLATIONS=$((VIOLATIONS + $(echo "$PY_HITS" | wc -l)))
fi

# ── 2. Inhaltspakete (YAML-Datenzeilen) ──────────────────────────────────────
YAML_HITS="$(grep -rn $'—' content --include='*.yaml' 2>/dev/null \
  | grep -vE '^[^:]+:[0-9]+:[[:space:]]*#' || true)"

if [ -n "$YAML_HITS" ]; then
  echo "ERROR: Geviertstrich (U+2014) in Paket-Daten unter content/."
  echo "       Diese Zeilen werden dem Spieler woertlich angezeigt."
  echo ""
  echo "$YAML_HITS"
  echo ""
  VIOLATIONS=$((VIOLATIONS + $(echo "$YAML_HITS" | wc -l)))
fi

# ── 3. Saat (SQL-Datenzeilen) ────────────────────────────────────────────────
SEED_HITS="$(grep -rn $'—' supabase/seed --include='*.sql' 2>/dev/null \
  | grep -vE '^[^:]+:[0-9]+:[[:space:]]*--' || true)"

if [ -n "$SEED_HITS" ]; then
  echo "ERROR: Geviertstrich (U+2014) in Saat-Daten unter supabase/seed/."
  echo "       Wer hier etwas aendert, denkt an den Bestand: die bereits"
  echo "       ausgesaeten Zeilen erreicht nur eine Migration (Vorbild: 351)."
  echo ""
  echo "$SEED_HITS"
  echo ""
  VIOLATIONS=$((VIOLATIONS + $(echo "$SEED_HITS" | wc -l)))
fi

# ── Ergebnis ─────────────────────────────────────────────────────────────────
if [ "$VIOLATIONS" -gt 0 ]; then
  echo "FAIL: $VIOLATIONS Geviertstrich(e) in Text, der einen Leser erreicht."
  exit 1
fi

echo "PASS: kein Geviertstrich in Backend-Strings, Paketen oder Saat."
exit 0
