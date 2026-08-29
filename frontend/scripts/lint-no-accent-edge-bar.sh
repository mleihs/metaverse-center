#!/usr/bin/env bash
# lint-no-accent-edge-bar.sh — a coloured bar down one edge of a box is the one
# gesture that makes an interface read as machine-assembled. It is not part of
# this platform's vocabulary.
# Run: bash frontend/scripts/lint-no-accent-edge-bar.sh
#
# Exit code: 0 = pass, 1 = violations found.
#
# WHAT IS REJECTED
#   A `border-left` of 2px or more in a STATUS or ACCENT colour.
#
# WHY
#   The bar had spread to 110 declarations across 66 files. It carried four
#   different jobs at once — identity, status, emphasis, grouping — and every
#   card wore the same slab regardless of which. Worse, it was almost always
#   REDUNDANT: the box was already tinted in the same colour, or its label was,
#   or an icon beside it was. See docs/guides/design-tokens.md § Auszeichnung.
#
# WHAT TO USE INSTEAD (components/shared/marker-styles.ts)
#   identity/category  -> markerCornerStyles, .marker-corners  (corner brackets)
#   status/severity    -> markerStatusStyles, .status-mark     (the WORD is coloured)
#   emphasis           -> the existing --shadow-* tokens
#   grouping/quote     -> markerQuoteStyles, .marker-quote     (NEUTRAL hairline)
#   a box that already has a border -> colour the WHOLE border, not one edge
#
# WHAT IS DELIBERATELY ALLOWED
#   - 1px in any colour: a quote rule is typography, and predates the web.
#   - Any width in a NEUTRAL colour (--color-border and friends, transparent).
#   - Selection markers on list rows (.foo--active, --selected, --current,
#     :hover, :focus-visible). A coloured edge on the active row of a nav list
#     is a position indicator, not decoration, and says something the box says
#     nowhere else.
#   - A panel's own edge against the page (a fixed drawer's seam).
#     Add such a case to ALLOWLIST in lint-accent-edge-bar.py with a reason.
#
# NOTE ON COVERAGE: this gate catches the CSS-rule form. Two other build forms
# exist and are NOT machine-checkable here — an inline
# `style="border-left: 3px solid ${x}"` in a template, and a narrow absolutely
# positioned ::before/::after painted in an accent colour. Both were found by
# hand during the sweep (SimulationsDashboard, .dossier-card). If you are
# reviewing a new component, look for those two by eye.

set -euo pipefail

# Anchor to the frontend root: CI and `npm run lint:full` invoke this from the
# REPO root while a developer runs it from `frontend/`. A relative target that
# is right for one is silently empty for the other, and that is exactly how six
# gates in this repo passed while checking nothing (see
# scripts/lint-lint-scripts-anchored.sh, which enforces this preamble).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# The detection lives in the Python companion: the rule needs to know WHICH CSS
# RULE a hit belongs to (a selection marker on an active row is allowed, the same
# declaration on a card is not), and walking back to the nearest selector is a
# parsing job. A first bash version did it with a sed window plus a grep for the
# last line ending in `{` and silently failed to filter two of eighteen hits.
FILTERED=$(python3 "$SCRIPT_DIR/lint-accent-edge-bar.py" || true)

if [ -n "$FILTERED" ]; then
  echo "ERROR: coloured edge bar (>=2px accent border-left):"
  echo ""
  echo "$FILTERED"
  echo ""
  echo "A coloured bar down one edge is not part of this platform's vocabulary."
  echo "Use components/shared/marker-styles.ts instead:"
  echo "  identity  -> .marker-corners   (corner brackets in the accent colour)"
  echo "  status    -> .status-mark      (the WORD carries the colour)"
  echo "  emphasis  -> --shadow-* tokens"
  echo "  grouping  -> .marker-quote     (NEUTRAL 1px hairline)"
  echo "  bordered box -> colour the WHOLE border, not one edge"
  echo ""
  echo "First check whether the colour is already said elsewhere on the same box"
  echo "(tinted background, coloured label, icon). Most of the 110 removed during"
  echo "the sweep were pure duplication and needed no replacement at all."
  echo ""
  echo "See docs/guides/design-tokens.md and CLAUDE.md 'Frontend Rules'."
  exit 1
fi

echo "PASS: no coloured edge bars (accent border-left >= 2px)."
exit 0
