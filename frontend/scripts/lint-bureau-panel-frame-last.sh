#!/bin/bash
# lint-bureau-panel-frame-last.sh — Enforce the cascade-order invariant for
# `bureauPanelFrameStyles` from `frontend/src/components/shared/bureau-panel-styles.ts`.
#
# Run: bash frontend/scripts/lint-bureau-panel-frame-last.sh
#
# Exit code: 0 = pass, 1 = violations found.
#
# Why this gate exists:
#   The shared `bureauPanelFrameStyles` module sets `background:` on `:host`
#   via a full shorthand. Every ops panel also declares its own
#   `:host { background: var(--color-surface-raised) }` rule. Two `:host`
#   declarations at identical specificity (0,1,0): the LAST in source order
#   wins the cascade. `static styles = [css`...`, bureauPanelFrameStyles]`
#   guarantees the shared rule is applied last — the frame paints.
#
#   If someone reorders the array so `bureauPanelFrameStyles` is first:
#     * no lint error (both orders type-check identically)
#     * no runtime error (both orders compose into valid CSS)
#     * BUT the frame silently DISAPPEARS — the panel's own background
#       overrides the shared one, and the 4 corner brackets + scanline
#       overlay never render.
#
#   This gate enforces the invariant by regex: if a file imports
#   `bureauPanelFrameStyles`, the LAST non-import mention must be followed
#   (within 3 lines) by `];` — i.e. it must be the last array element.
#
# See `frontend/src/components/shared/bureau-panel-styles.ts` for the
# docstring that documents this contract in code.

set -euo pipefail

# Anchor all paths to the frontend root. CI and `npm run lint:full` invoke this
# script from the REPO root while a developer runs it from `frontend/`; a
# relative target that is right for one is silently empty for the other, and the
# `2>/dev/null || true` guards turn that into a green no-op pass. Resolve
# SCRIPT_DIR BEFORE the cd — BASH_SOURCE may be relative and would die with the
# old cwd. Enforced by scripts/lint-lint-scripts-anchored.sh.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

VIOLATIONS=0
CHECKED=0
FILES=$(grep -rl 'bureauPanelFrameStyles' src --include='*.ts' 2>/dev/null \
          | grep -v '/bureau-panel-styles\.ts$' \
          || true)

if [ -z "$FILES" ]; then
  echo "PASS: no files import bureauPanelFrameStyles (gate is vacuously satisfied)."
  exit 0
fi

while IFS= read -r FILE; do
  [ -z "$FILE" ] && continue
  CHECKED=$((CHECKED + 1))

  # Find the last line that mentions the identifier and is NOT an `import` line.
  # This targets the array-usage reference (e.g. `    bureauPanelFrameStyles,`).
  USAGE_LINE=$(grep -n 'bureauPanelFrameStyles' "$FILE" \
                 | grep -v 'import' \
                 | tail -1 \
                 | cut -d: -f1 || true)

  if [ -z "$USAGE_LINE" ]; then
    echo "FAIL: $FILE — imports bureauPanelFrameStyles but never uses it."
    VIOLATIONS=$((VIOLATIONS + 1))
    continue
  fi

  # Peek the next 3 lines for a line that is effectively `];` (allowing
  # leading whitespace and optional trailing comma on the closing).
  NEXT_START=$((USAGE_LINE + 1))
  NEXT_END=$((USAGE_LINE + 3))
  NEXT_BLOCK=$(sed -n "${NEXT_START},${NEXT_END}p" "$FILE")

  if ! printf '%s\n' "$NEXT_BLOCK" | grep -qE '^\s*\];'; then
    echo "FAIL: $FILE:${USAGE_LINE} — bureauPanelFrameStyles is NOT the last"
    echo "      element in static styles = [...]. Next 3 lines after the usage:"
    printf '%s\n' "$NEXT_BLOCK" | sed 's/^/        /'
    echo "      Fix: move 'bureauPanelFrameStyles,' to be the LAST entry,"
    echo "      immediately before the closing '];' of the static styles array."
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
done <<< "$FILES"

if [ $VIOLATIONS -gt 0 ]; then
  echo ""
  echo "bureauPanelFrameStyles MUST be the last element in static styles = [...]"
  echo "because the shared :host { background: ... } rule needs to override each"
  echo "panel's own :host background. Reversing the order silently kills the"
  echo "Bureau-Dispatch frame."
  echo ""
  echo "See frontend/src/components/shared/bureau-panel-styles.ts for the"
  echo "cascade-order contract documentation."
  exit 1
fi

echo "PASS: bureauPanelFrameStyles is the last element in every importing file (${CHECKED} checked)."
