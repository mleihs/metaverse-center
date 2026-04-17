#!/bin/bash
# lint-no-pushstate.sh — Reject direct `window.history.pushState(` calls.
# Run: bash frontend/scripts/lint-no-pushstate.sh
#
# Exit code: 0 = pass, 1 = violations found.
#
# Why: The audit verified 2026-04-17 (docs/analysis/architecture-cleanliness-
# verification-2026-04-17.md, finding F2) found three competing navigation
# patterns in 20 files. The canonical seam is `frontend/src/utils/navigation.ts`
# with two functions:
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

# Match actual function calls: `window.history.pushState(` — the opening
# paren discriminates real calls from comments/docstrings that happen to
# mention `pushState`.
RESULT=$(grep -rnE 'window\.history\.pushState\s*\(' \
  --include='*.ts' \
  "$SRC_DIR" 2>/dev/null | \
  grep -v '^frontend/src/utils/navigation\.ts:' || true)

if [ -n "$RESULT" ]; then
  echo "ERROR: Direct window.history.pushState() outside the navigation helper:"
  echo "$RESULT"
  echo ""
  echo "Use frontend/src/utils/navigation.ts instead:"
  echo "  - navigate(path)   — for route changes (router re-evaluates)."
  echo "  - updateUrl(path)  — for in-view deep-links (panel open/close)."
  echo ""
  VIOLATIONS=1
fi

if [ "$VIOLATIONS" -eq 0 ]; then
  echo "PASS: No direct window.history.pushState() calls outside the navigation helper."
fi

exit $VIOLATIONS
