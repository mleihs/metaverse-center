#!/bin/bash
# lint-no-backtick-in-css.sh — A backtick inside a css`…` block silently ends
# the template literal, and the whole styles block is then parsed as JavaScript.
# Run: bash frontend/scripts/lint-no-backtick-in-css.sh
#
# Exit code: 0 = pass, 1 = violations found.
#
# See frontend/scripts/lint-backtick-in-css.mjs for the rule and the incident
# that produced it. This wrapper exists to anchor the working directory the way
# every other gate does.

set -euo pipefail

# Anchor all paths to the frontend root — CI and `npm run lint:full` invoke this
# from the REPO root, a developer from `frontend/`. Resolve SCRIPT_DIR BEFORE
# the cd. Enforced by scripts/lint-lint-scripts-anchored.sh.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

node "$SCRIPT_DIR/lint-backtick-in-css.mjs"
