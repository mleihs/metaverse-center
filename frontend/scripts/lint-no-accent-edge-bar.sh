#!/usr/bin/env bash
# lint-no-accent-edge-bar.sh — a coloured bar down one edge of a box is the one
# gesture that makes an interface read as machine-assembled. It is not part of
# this platform's vocabulary.
# Run: bash frontend/scripts/lint-no-accent-edge-bar.sh
#
# Exit code: 0 = pass, 1 = violations found.
#
# WHAT IS REJECTED — the device, in BOTH shapes it is built in
#   1. A `border-left` of 2px or more in a STATUS or ACCENT colour.
#   2. An absolutely positioned ::before/::after pinned to an edge, <=6px in one
#      axis and 100%/calc in the other, painted in a status or accent colour.
#
#   Shape 2 is not a footnote. It looks identical on screen, it is the ONLY one
#   that can carry a gradient — so it is the shape an author is pushed towards —
#   and while this gate knew only shape 1 it reported PASS while an amber bar sat
#   in `admin-shared-styles.ts`, i.e. on every admin tab in the platform.
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
#   - A pseudo-element bar that declares a NAMED animation. A sweep line and a
#     progress bar are the same geometry doing a different job: they say
#     "working", not "this is a card of kind X", and they are recognisable
#     because they move. That is a property of the rule, not a filename, which
#     is why it needs no allowlist entry.
#
# NOTE ON COVERAGE: both CSS-rule shapes are now checked. One build form is
# still not machine-checkable here: an inline
# `style="border-left: 3px solid ${x}"` in a template, found by hand during the
# sweep (SimulationsDashboard, .dossier-card). Look for that one by eye when
# reviewing a new component.

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
  echo "ERROR: coloured edge bar (border-left >=2px, or a pinned pseudo-element):"
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

echo "PASS: no coloured edge bars (border-left >= 2px, or pinned pseudo-element)."
exit 0
