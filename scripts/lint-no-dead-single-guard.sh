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

RESULT=$(python3 - <<'PYEOF'
import re
import pathlib

# ZEILENBASIERT, NICHT ALS EIN REGEX UEBER DIE GANZE KETTE.
#
# Die erste Fassung suchte `.single()` + `.execute()` + `)` + `if not X` mit
# Zeilenumbruechen dazwischen -- also genau die MEHRZEILIGE Schreibweise. Am
# 31.08.2026 gemessen: 27 Ketten stehen einzeilig, und ACHT davon trugen
# denselben toten Waechter. Das Tor meldete sie nie und war PASS.
#
# Ein Muster, das eine FORMATIERUNG beschreibt statt einer BEDEUTUNG, prueft die
# Formatierung. Ueber den Zeilenumbruch entscheidet `ruff format`, nicht der
# Autor -- die Sichtbarkeit des Fehlers hing damit an einer Zeilenlaenge.
SINGLE = re.compile(r"\.single\(\)")
ASSIGN = re.compile(r"^\s*([a-z_][a-z0-9_]*)\s*=\s*await\b")
VENDOR = (".venv", "venv", "site-packages", "node_modules")

violations = []
for path in sorted(pathlib.Path("backend").rglob("*.py")):
    if "tests" in path.parts or any(v in path.parts for v in VENDOR):
        continue
    lines = path.read_text(encoding="utf-8").split("\n")
    for i, line in enumerate(lines):
        if not SINGLE.search(line) or ".maybe_single()" in line:
            continue
        var = None
        for j in range(i, max(-1, i - 6), -1):
            m = ASSIGN.match(lines[j])
            if m:
                var = m.group(1)
                break
        if not var:
            continue
        window = "\n".join(lines[i + 1 : i + 7])
        if re.search(rf"if not {re.escape(var)}(?:\.data)?\b|if {re.escape(var)}(?:\.data)? is None", window):
            violations.append(f"{path}:{i + 1}: guard on `{var}` after .single()")

print("\n".join(violations))
PYEOF
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
