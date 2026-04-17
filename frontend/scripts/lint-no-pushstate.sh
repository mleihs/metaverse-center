#!/bin/bash
# lint-no-pushstate.sh — Enforce the navigation seam.
# Run: bash frontend/scripts/lint-no-pushstate.sh
#
# Exit code: 0 = pass, 1 = violations found.
#
# Rejects two bypass patterns:
#   1. Direct `window.history.pushState(` — bypasses the helper's URL dedupe.
#   2. Manual `new CustomEvent('navigate', ...)` — duplicates navigate()'s
#      event construction (bubbles/composed/detail), creating drift risk.
#
# Why: The audit verified 2026-04-17 (docs/analysis/architecture-cleanliness-
# verification-2026-04-17.md, finding F2) found three competing navigation
# patterns across the frontend. The canonical seam is
# `frontend/src/utils/navigation.ts` with two functions:
#   - navigate(path) — trigger router re-evaluation (dispatches 'navigate' event).
#   - updateUrl(path) — in-view deep-link (pushState without routing).
#
# Only one file is exempt:
#   - frontend/src/utils/navigation.ts — the helper itself, sole legitimate caller.
#
# Every other call site (including app-shell's router-internal _handleNavigate)
# must route through navigate() or updateUrl().

set -euo pipefail

VIOLATIONS=0
SRC_DIR="frontend/src"

# --- Check 1: Direct pushState() calls ---
# Match actual function calls: `window.history.pushState(` — the opening
# paren discriminates real calls from comments/docstrings that happen to
# mention `pushState`.
PUSHSTATE=$(grep -rnE 'window\.history\.pushState\s*\(' \
  --include='*.ts' \
  "$SRC_DIR" 2>/dev/null | \
  grep -v '^frontend/src/utils/navigation\.ts:' || true)

if [ -n "$PUSHSTATE" ]; then
  echo "ERROR: Direct window.history.pushState() outside the navigation helper:"
  echo "$PUSHSTATE"
  echo ""
  VIOLATIONS=1
fi

# --- Check 2: Manual 'navigate' CustomEvent dispatches ---
# The dispatch pattern `new CustomEvent('navigate', { ... })` duplicates what
# navigate() already encapsulates. Any bespoke construction can drift
# (wrong `bubbles`/`composed`, stale `detail` shape, typos).
EVENT=$(grep -rnE "new CustomEvent\(['\"]navigate['\"]" \
  --include='*.ts' \
  "$SRC_DIR" 2>/dev/null | \
  grep -v '^frontend/src/utils/navigation\.ts:' || true)

if [ -n "$EVENT" ]; then
  echo "ERROR: Manual 'navigate' CustomEvent dispatch outside the navigation helper:"
  echo "$EVENT"
  echo ""
  VIOLATIONS=1
fi

if [ "$VIOLATIONS" -ne 0 ]; then
  echo "Use frontend/src/utils/navigation.ts instead:"
  echo "  - navigate(path)   — for route changes (router re-evaluates)."
  echo "  - updateUrl(path)  — for in-view deep-links (panel open/close)."
else
  echo "PASS: navigation seam intact — no direct pushState or manual 'navigate' CustomEvent dispatches outside the helper."
fi

exit $VIOLATIONS
