#!/usr/bin/env bash
# lint-lint-scripts-anchored.sh — every lint gate must resolve its own root.
# Run: bash scripts/lint-lint-scripts-anchored.sh
#
# Exit code: 0 = pass, 1 = violations found.
#
# The invariant: a `lint-*.sh` gate must not depend on the caller's working
# directory. It resolves its own location first and cd's to the tree it guards:
#
#   SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
#   cd "$SCRIPT_DIR/.."
#
# Why this gate exists: the guards are written as
# `VIOLATIONS=$(grep -rn ... src/ 2>/dev/null || true)`. When the relative path
# does not exist under the caller's cwd, grep matches nothing, the `|| true`
# swallows the failure, and the script prints PASS. A gate that greps the wrong
# directory does not fail — it congratulates you.
#
# That is not hypothetical. CI (`working-directory: .`) and `npm run lint:full`
# (`cd .. && bash frontend/scripts/...`) both invoke the frontend gates from the
# REPO root, while their targets were written relative to `frontend/`. Six of
# them — cast-unknown, llm-content, color-contrast among them — were silent
# no-ops in CI for as long as they had existed. `as unknown as T` would have
# sailed through the type-safety gate untouched.
#
# Checked for every scripts/lint-*.sh and frontend/scripts/lint-*.sh.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# Fixed strings, not regexes — the idiom is full of $( ) [ ] . which ERE would
# reinterpret (and did, on the first draft of this gate: every script "failed").
ANCHOR_VAR='SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"'
ANCHOR_CD='cd "$SCRIPT_DIR/.."'

FAIL=0
CHECKED=0

for script in scripts/lint-*.sh frontend/scripts/lint-*.sh; do
  [ -f "$script" ] || continue
  # This gate is itself anchored, but it guards the others — skip self so the
  # message list stays about the scripts under review.
  [ "$script" = "scripts/lint-lint-scripts-anchored.sh" ] && continue
  CHECKED=$((CHECKED + 1))

  if ! grep -qF "$ANCHOR_VAR" "$script" || ! grep -qF "$ANCHOR_CD" "$script"; then
    echo "MISSING ANCHOR: $script"
    FAIL=1
    continue
  fi

  # A later unconditional `cd` would undo the anchor. Directory changes inside
  # command substitution (the anchor idiom itself) run in a subshell and are
  # harmless, so only top-level `cd` lines count.
  EXTRA_CD=$(grep -nE '^[[:space:]]*cd ' "$script" | grep -vF "$ANCHOR_CD" || true)
  if [ -n "$EXTRA_CD" ]; then
    echo "ANCHOR OVERRIDDEN by a later cd in $script:"
    echo "$EXTRA_CD"
    FAIL=1
  fi
done

if [ "$FAIL" -ne 0 ]; then
  echo ""
  echo "Every lint gate must anchor itself, or it silently passes when invoked"
  echo "from a directory where its grep targets do not exist. Add, right after"
  echo "\`set -euo pipefail\`:"
  echo ""
  echo '  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"'
  echo '  cd "$SCRIPT_DIR/.."'
  echo ""
  echo "and write the grep targets relative to that root (src/ for frontend"
  echo "gates, backend/ or content/ for repo-root gates)."
  exit 1
fi

echo "PASS: all $CHECKED lint gates anchor their own root."
exit 0
