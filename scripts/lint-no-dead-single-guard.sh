#!/bin/bash
# lint-no-dead-single-guard.sh — Reject a `.single()` query followed by a guard
# that `.single()` can never reach.
#
# Run: bash scripts/lint-no-dead-single-guard.sh
# Exit code: 0 = pass, 1 = violations found.
#
# The pattern this rejects:
#
#     response = await (
#         supabase.table("t").select("*").eq("id", x)
#         .single()
#         .execute()
#     )
#     if not response.data:
#         raise not_found(...)
#
# It reads as a null check and is dead code. postgrest-py's `.single()` asks
# PostgREST for exactly one row, and on zero rows PostgREST answers
# PGRST116 ("Cannot coerce the result to a single JSON object") — which
# postgrest-py raises as `APIError`. Execution never reaches the guard, so the
# clean 404 the author wrote is replaced by an unhandled 500.
#
# Six of these shipped before this gate existed: a deleted Forge draft, a
# missing epoch, an agent from another simulation, a bot that had left the
# lobby — every one of them a 500 where the code said 404, and one of them
# (bot_service) tearing down a whole bot turn instead of skipping one player.
#
# The fix is the helper the repo already documents in CLAUDE.md:
#
#     data = await maybe_single_data(
#         supabase.table("t").select("*").eq("id", x).maybe_single()
#     )
#     if not data:
#         raise not_found(...)
#
# `maybe_single_data` (backend/utils/db.py) collapses the 0-row case into
# `None`, which is what the guard was written for.

set -euo pipefail

# Anchor to the repo root so CI and a developer shell agree on the target.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

RESULT=$(python3 - <<'PY'
import re
import pathlib

# `.single()` / `.execute()` on their own lines, then a falsy check on the
# result of that same await — the shape that cannot run.
PATTERN = re.compile(
    r"\.single\(\)\s*\n\s*\.execute\(\)\s*\n\s*\)\s*\n\s*if not (\w+)(?:\.data)?\b"
)

violations = []
for path in sorted(pathlib.Path("backend").rglob("*.py")):
    if "tests" in path.parts:
        continue
    source = path.read_text(encoding="utf-8")
    for match in PATTERN.finditer(source):
        line = source[: match.start()].count("\n") + 1
        violations.append(f"{path}:{line}: guard on `{match.group(1)}` after .single()")

print("\n".join(violations))
PY
)

if [ -n "$RESULT" ]; then
  echo "ERROR: .single() followed by a guard it can never reach."
  echo "       .single() raises PGRST116 on 0 rows, so the check below is dead"
  echo "       code and a missing row becomes a 500 instead of the intended 404."
  echo "       Use maybe_single_data(... .maybe_single()) from backend/utils/db.py."
  echo ""
  echo "$RESULT"
  echo ""
  exit 1
fi

echo "PASS: no .single() query is followed by a guard it cannot reach."
