#!/usr/bin/env bash
# lint-no-shared-style-copy.sh — a shared style module must be imported, not retyped.
#
# Run: bash frontend/scripts/lint-no-shared-style-copy.sh
#
# Exit code: 0 = pass, 1 = violations found.
#
# WHAT IS REJECTED
#   A run of 12 consecutive normalised lines that contains at least one CSS
#   selector and stands verbatim in both a `*-styles.ts` module and a component
#   that never names that module.
#
# WHY
#   This repo states its rules beautifully and binds them unevenly. The
#   accent-bar sweep built `shared/marker-styles.ts` with a long argument for why
#   status must not be a coloured bar, and the commit that claimed to apply it
#   copied the treatment into three files by hand instead of importing it — so
#   the module ended the day with zero importers while its content stood
#   verbatim in three components. `ClearanceQueue` carried a 63-line hand-copy of
#   `admin-shared-styles.ts`, edge bar included. Writing the module had felt like
#   enforcing it.
#
# WHY THOSE THRESHOLDS
#   Measured over the whole frontend, 2026-08-30:
#     window 8, no selector required   -> 57 pairs, mostly noise
#     window 12, selector required     ->  4 pairs, all four real
#   The selector requirement is what separates "two files set the same four
#   properties" from "someone re-typed a rule". All four were fixed; the gate
#   holds at one recorded exception.
#
# WHAT TO DO ON A HIT
#   Import the module and delete the local copy. If the shared rule is almost
#   right, change the SHARED module — that is what it is for. If it is genuinely
#   a different thing wearing the same class name, rename your class.
#
# The detection lives in lint-shared-style-copy.py: it needs content-addressed
# windows over normalised lines, which is a parsing job rather than a grep job.

set -euo pipefail

# Anchor to the frontend root: CI and `npm run lint:full` invoke this from the
# REPO root while a developer runs it from `frontend/`. Resolve SCRIPT_DIR
# BEFORE any cd — BASH_SOURCE may be relative. Enforced by
# scripts/lint-lint-scripts-anchored.sh.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

if [ ! -d "src" ]; then
  echo "ERROR: src/ not found from $(pwd) — the gate would check nothing." >&2
  exit 1
fi

PY="${PYTHON:-python3}"
exec "$PY" "$SCRIPT_DIR/lint-shared-style-copy.py"
