#!/bin/bash
# lint-no-appstate-access-reads.sh — Keep API-routing decisions out of appState.
# Run: bash frontend/scripts/lint-no-appstate-access-reads.sh
#
# Exit code: 0 = pass, 1 = violations found.
#
# Rejects reads of `appState.isAuthenticated` or `appState.currentRole` under
# `frontend/src/services/api/`. These are UI-state signals; reading them
# inside the API layer to decide between `/api/v1/*` and `/api/v1/public/*`
# couples transport to route-entry timing and hides the routing contract
# from the call site.
#
# The canonical pattern is:
#   - API services take `mode: 'public' | 'member'` as an explicit parameter.
#   - Callers read `appState.currentSimulationMode.value` (sim-scoped) or
#     inline `isAuthenticated.value ? 'member' : 'public'` (auth-gated)
#     at the callsite and pass the result down.
#
# `appState.accessToken` is still allowed — it is the Authorization header
# source, not a routing decision.
#
# Why: see docs/analysis/architecture-cleanliness-verification-2026-04-17.md
# finding F3, and memory/architecture-welle-1-complete-2026-04-17.md for the
# full remediation plan (W2.1, commits C1–C7).

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
TARGET_DIR="src/services/api"

# Match either `appState.isAuthenticated` or `appState.currentRole`, with any
# trailing property / method / whitespace. Ignore pure documentation lines —
# detected by a leading `*` (JSDoc/comment continuation) or `//`.
FORBIDDEN=$(grep -rnE 'appState\.(isAuthenticated|currentRole)\b' \
  --include='*.ts' \
  "$TARGET_DIR" 2>/dev/null | \
  grep -vE '^[^:]+:[0-9]+:\s*(\*|//)' || true)

if [ -n "$FORBIDDEN" ]; then
  echo "ERROR: API layer reads appState routing signals — forbidden:"
  echo "$FORBIDDEN"
  echo ""
  echo "Move the routing decision to the callsite. Pattern:"
  echo "  - Sim-scoped reads:  apiService.method(simId, appState.currentSimulationMode.value, ...)"
  echo "  - Auth-gated reads:  apiService.method(appState.isAuthenticated.value ? 'member' : 'public', ...)"
  echo ""
  echo "API-service methods should accept 'mode: \"public\" | \"member\"' explicitly and"
  echo "forward it to BaseApiService.getSimulationData(path, mode, params?)."
  VIOLATIONS=1
fi

if [ "$VIOLATIONS" -eq 0 ]; then
  echo "PASS: API layer is free of appState routing-signal reads — mode is explicit at every callsite."
fi

exit $VIOLATIONS
