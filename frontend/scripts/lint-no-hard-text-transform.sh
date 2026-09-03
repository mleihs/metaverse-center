#!/usr/bin/env bash
# lint-no-hard-text-transform.sh — `text-transform: uppercase` belongs to a
# TOKEN, not to a component. Two roles exist, and a component must name which
# one it is:
#
#   var(--heading-transform)  h1-h6, section titles, display type, names
#   var(--label-transform)    kickers, badges, buttons, tabs, mono meta-lines
#
# Run: bash frontend/scripts/lint-no-hard-text-transform.sh
#
# Exit code: 0 = pass, 1 = violations found.
#
# WHY
#   Both tokens default to `uppercase` in styles/tokens/_typography.css, so on
#   the dark chrome the split is invisible — which is exactly why it has to be
#   guarded by a gate rather than by eye. A skin that lowercases its headings
#   (Atlas: paper, ink, lowercase Bricolage) reads the two roles apart, and a
#   single hard `uppercase` left in a component is a word that shouts in a room
#   where nothing else does.
#
#   The sweep that introduced this rule moved 1396 declarations across 292
#   files. Note the number: the plan that ordered the sweep estimated ~400. A
#   hard-coded value spreads faster than anyone's memory of it, and that is the
#   whole argument for the gate — not the sweep, which is done, but the next
#   200 components, which are not written yet.
#
# WHAT IS DELIBERATELY ALLOWED — the diegetic surfaces
#   The terminal, the dungeon and the Drift are not skinned. They are phosphor
#   on black BY FICTION, they run on PLATFORM_DARK_CONFIG regardless of the
#   user's chosen skin, and their capitals are set dressing rather than
#   typography. Same for the cartographer's map, documented "always dark".
#   These keep hard `uppercase`, and that is a decision, not an omission.
#
# WHAT THIS GATE DOES NOT CHECK
#   Whether the role chosen is the RIGHT one. `.heading { font-size:
#   var(--text-sm) }` is a label wearing a heading's name, and only a reader can
#   see that. The gate asks the narrower question it can answer: is a role named
#   at all.

set -euo pipefail

# Anchor to the frontend root: CI and `npm run lint:full` invoke this from the
# REPO root while a developer runs it from `frontend/`. See
# scripts/lint-lint-scripts-anchored.sh.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

EXCLUDE='src/components/terminal/|src/components/dungeon/|src/components/drift/|src/components/shared/terminal-theme-styles\.ts|src/components/shared/bureau-palette-styles\.ts|src/components/multiverse/CartographerMap\.ts'

SCANNED=$(grep -rlE 'text-transform' src --include='*.ts' --include='*.css' 2>/dev/null \
  | grep -vE "$EXCLUDE" | wc -l | tr -d ' ')

VIOLATIONS=$(grep -rnE 'text-transform:[[:space:]]*uppercase' src \
  --include='*.ts' --include='*.css' 2>/dev/null \
  | grep -vE "$EXCLUDE" || true)

# A gate that finds nothing to look at has not passed, it has abstained. If the
# scan set collapses (a moved directory, a broken anchor), say so and fail —
# that is the failure mode this repo has been bitten by six times.
if [ "$SCANNED" -lt 100 ]; then
  echo "ERROR: only $SCANNED files carry a text-transform declaration at all."
  echo "That is far below the ~290 expected — the scan set has collapsed."
  echo "Check the anchor and the exclude list before trusting a PASS here."
  exit 1
fi

if [ -n "$VIOLATIONS" ]; then
  COUNT=$(printf '%s\n' "$VIOLATIONS" | wc -l | tr -d ' ')
  echo "ERROR: $COUNT hard \`text-transform: uppercase\` outside the diegetic surfaces:"
  echo ""
  echo "$VIOLATIONS"
  echo ""
  echo "Name the role instead:"
  echo "  var(--heading-transform)  h1-h6, section titles, display type, names"
  echo "  var(--label-transform)    kickers, badges, buttons, tabs, mono labels"
  echo ""
  echo "Rule of thumb: font-size <= var(--text-sm), or letter-spacing >= .05em,"
  echo "means label — even when the class is called .title. The size decides,"
  echo "not the name."
  echo ""
  echo "See styles/tokens/_typography.css and CLAUDE.md 'Frontend Rules'."
  exit 1
fi

echo "PASS: no hard text-transform ($SCANNED files scanned; terminal/dungeon/drift keep theirs)."
exit 0
