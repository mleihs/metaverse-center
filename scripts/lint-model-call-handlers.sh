#!/usr/bin/env bash
# lint-model-call-handlers.sh — thin wrapper so this gate looks like the others
# and is picked up by `lint-lint-scripts-anchored.sh`. The check itself is
# `lint-model-call-handlers.py` next to it, which needs an AST and not a grep;
# its module docstring carries the measurement and the two things it cannot see.
#
# Run: bash scripts/lint-model-call-handlers.sh
# Exit code: 0 = pass, 1 = a handler around a model call cannot catch a model error.
#
# The interpreter is chosen, not assumed. macOS still ships `python3` as 3.9,
# which cannot parse a `match` statement and dies on the first backend file that
# uses one — so the repo venv wins whenever it exists. CI has 3.13 on PATH.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

PY="python3"
if [[ -x ".venv/bin/python" ]]; then
  PY=".venv/bin/python"
fi

exec "$PY" scripts/lint-model-call-handlers.py
