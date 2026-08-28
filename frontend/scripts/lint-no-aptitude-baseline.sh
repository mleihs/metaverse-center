#!/bin/bash
# lint-no-aptitude-baseline.sh — The client must never invent aptitude values.
# Run: bash frontend/scripts/lint-no-aptitude-baseline.sh
#
# Exit code: 0 = pass, 1 = violations found.
#
# Rejected pattern: an object literal that assigns numeric levels to the six
# operative types (spy / guardian / saboteur / propagandist / infiltrator /
# assassin) anywhere in `frontend/src/**/*.ts`. That is a client-side copy of a
# baseline the server owns (backend/models/aptitude.py DEFAULT_APTITUDE_LEVEL).
#
# Why this matters: seven such copies existed before this gate. Five call sites
# folded `GET /simulations/{id}/aptitudes` into a Map by hand and three of them
# seeded the accumulator with a literal `6`; `dungeon-formatters.ts` carried a
# GENERALIST_APTITUDES constant on top. In a simulation with no assigned
# aptitudes — every simulation the Forge has ever generated — those copies
# painted "SPY 6 - GRD 6 - SAB 6" onto every card in the dungeon party picker,
# while the composition warning right below read the same (empty) data without a
# fallback and correctly reported that no agent had SPY 4+. The fallback was the
# defect: it made missing data look like a measurement, and hid the real gap.
#
# Correct pattern: fold the API rows with `buildAptitudeIndex()` from
# `src/utils/aptitudes.ts`. The server sends six effective rows per agent, each
# flagged `is_default` when it is the baseline rather than an assigned score;
# the index exposes `levels` (what to display) and `baselineAgentIds` (what to
# label). Surfaces that show levels must show the baseline marker too.
#
# See CLAUDE.md 'Frontend Rules' and docs/plans/graphical-dungeon-remediation-2026-08-28.md B-2.

set -euo pipefail

# Anchor all paths to the frontend root. CI and `npm run lint:full` invoke this
# script from the REPO root while a developer runs it from `frontend/`; a
# relative target that is right for one is silently empty for the other, and the
# `2>/dev/null || true` guards turn that into a green no-op pass. Resolve
# SCRIPT_DIR BEFORE the cd — BASH_SOURCE may be relative and would die with the
# old cwd. Enforced by scripts/lint-lint-scripts-anchored.sh.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# The one module allowed to reason about the shape of an aptitude set — and even
# there only to complete a partial into a full record, never to invent a level.
WHITELIST_REGEX='^src/utils/aptitudes\.ts:'

# Any literal that assigns a NONZERO level to `spy:` and to `guardian:` within a
# few lines of each other is an aptitude-set literal. -A3 keeps it to actual
# adjacency instead of matching two unrelated properties in the same file.
# Zero is exempt: `{spy: 0, guardian: 0, ...}` is an accumulator seed, not a
# claim about any agent's abilities.
VIOLATIONS=$(grep -rnE --include='*.ts' -A3 '\bspy:[[:space:]]*[1-9]' src/ 2>/dev/null \
  | grep -E '\bguardian:[[:space:]]*[1-9]' \
  | sed 's/^\([^-]*\)-\([0-9]*\)-/\1:\2:/' \
  | grep -vE "$WHITELIST_REGEX" || true)

if [ -n "$VIOLATIONS" ]; then
  echo "ERROR: hardcoded aptitude baseline literal(s) in the frontend:"
  echo ""
  echo "$VIOLATIONS"
  echo ""
  echo "The baseline belongs to the server (backend/models/aptitude.py:"
  echo "DEFAULT_APTITUDE_LEVEL). Fold the API rows with buildAptitudeIndex()"
  echo "from src/utils/aptitudes.ts and label baseline values as baseline"
  echo "instead of substituting numbers of your own."
  exit 1
fi

echo "PASS: no client-side aptitude baseline literals."
exit 0
