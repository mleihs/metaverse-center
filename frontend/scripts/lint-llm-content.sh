#!/usr/bin/env bash
# lint-llm-content.sh — Catches LLM-generated text artifacts in source code.
# Run after changes to user-facing strings. CI will reject violations.
#
# Checks:
#   1. Em dashes (U+2014) in msg() strings — should be en dashes (U+2013)
#   2. Common LLM-ism words in msg() strings
#
# Exit 0 = clean, Exit 1 = violations found.

set -euo pipefail
cd "$(dirname "$0")/.."

VIOLATIONS=0
SRC_DIR="src"

# ── 1. Em dashes in msg() strings ────────────────────────────────────

EM_DASH=$'\xe2\x80\x94'  # U+2014

# Search .ts files for an em dash inside msg() / template literals / aria
# labels. Matches all three ways it can be written in source:
#   - the literal UTF-8 byte  —
#   - the — escape       (lit-localize resolves this to a literal em dash
#                              in de.xlf, so the byte-only check used to miss
#                              every escape-written one — see commit history)
#   - the \u{2014} ES6 escape
EM_HITS=$(grep -rn -e "$EM_DASH" -e '\\u2014' -e '\\u{2014}' "$SRC_DIR" --include='*.ts' \
  --exclude-dir='locales' \
  | grep -v '// ' \
  | grep -v ' \* ' \
  | grep -v '\.css' \
  | grep -v 'node_modules' \
  | grep "msg\|html\`\|aria-label\|title=" \
  || true)

if [ -n "$EM_HITS" ]; then
  echo "ERROR: Em dashes (U+2014 — literal or \\u2014 escape) found in user-facing strings."
  echo "       Use en dashes (U+2013) instead: –"
  echo ""
  echo "$EM_HITS"
  echo ""
  VIOLATIONS=$((VIOLATIONS + $(echo "$EM_HITS" | wc -l)))
fi

# ── 2. LLM-ism words in msg() strings ────────────────────────────────

# Only flag these inside msg('...') calls — not in comments or code
LLM_PATTERNS=(
  "tapestry"
  "delve"
  "unleash"
  "seamlessly"
  "holistic"
  "multifaceted"
  "game-changer"
  "cutting-edge"
  "bustling"
)

for WORD in "${LLM_PATTERNS[@]}"; do
  HITS=$(grep -rn -i "$WORD" "$SRC_DIR" --include='*.ts' \
    --exclude-dir='locales' \
    | grep "msg(" \
    || true)
  if [ -n "$HITS" ]; then
    echo "WARNING: LLM-ism '$WORD' found in msg() string:"
    echo "$HITS"
    echo ""
    VIOLATIONS=$((VIOLATIONS + $(echo "$HITS" | wc -l)))
  fi
done

# ── 3. Em dashes in XLIFF translations ────────────────────────────────

XLIFF_HITS=$(grep -c "$EM_DASH" "$SRC_DIR/locales/xliff/de.xlf" 2>/dev/null || true)
XLIFF_HITS=${XLIFF_HITS:-0}
if [ "$XLIFF_HITS" -gt 0 ]; then
  echo "ERROR: $XLIFF_HITS em dashes found in de.xlf translation file."
  echo "       Run: sed -i '' 's/—/–/g' src/locales/xliff/de.xlf"
  echo ""
  VIOLATIONS=$((VIOLATIONS + XLIFF_HITS))
fi

# ── Result ────────────────────────────────────────────────────────────

if [ "$VIOLATIONS" -gt 0 ]; then
  echo "FAIL: $VIOLATIONS LLM content violations found."
  exit 1
else
  echo "PASS: No LLM content violations found."
  exit 0
fi
