#!/usr/bin/env bash
#
# The shared Supabase chain mock must know every builder method the production
# code chains onto a query.
#
# Why this is a gate and not a comment: MagicMock invents any attribute it is
# asked for. A method missing from CHAIN_METHODS therefore does not raise — it
# returns a *different* mock, the chain silently forks, and the test either dies
# on `await` with a TypeError naming neither the method nor the query, or keeps
# asserting against a builder the service never touched. Both readings cost
# more to diagnose than this check costs to run.
#
# Found 2026-08-29: the list named 17 methods while the code called 26. Ten
# filters (gte, lte, contains, filter, offset, neq, like, overlaps, match,
# ilike) were absent, and every test that would have exercised one of them was
# a step away from lying.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

CONFTEST="backend/tests/conftest.py"
SOURCES=(backend/services backend/routers backend/utils)

# Every postgrest-py builder method that returns a builder. Terminators
# (.execute, .csv, .explain) are deliberately absent: they end the chain.
KNOWN='select|insert|update|upsert|delete|eq|neq|gt|gte|lt|lte|like|ilike|is_|in_|contains|contained_by|range|overlaps|text_search|match|not_|or_|filter|order|limit|offset|single|maybe_single|on_conflict'

declared=$(
  python3 - "$CONFTEST" <<'PY'
import ast, sys
tree = ast.parse(open(sys.argv[1], encoding="utf-8").read())
for node in tree.body:
    if isinstance(node, ast.Assign) and any(
        isinstance(t, ast.Name) and t.id == "CHAIN_METHODS" for t in node.targets
    ):
        print("\n".join(sorted(e.value for e in node.value.elts)))
        break
else:
    sys.exit("CHAIN_METHODS not found in " + sys.argv[1])
PY
)

used=$(
  grep -rhoE "\.($KNOWN)\(" --include='*.py' "${SOURCES[@]}" \
    | sed -E 's/^\.(.*)\($/\1/' \
    | sort -u
)

missing=$(comm -23 <(echo "$used") <(echo "$declared"))

if [ -n "$missing" ]; then
  echo "FAIL: CHAIN_METHODS in $CONFTEST does not cover every builder method the code calls."
  echo
  echo "  Missing:"
  echo "$missing" | sed 's/^/    ./;s/$/()/'
  echo
  echo "  Add them to the tuple. A test whose mock lacks one does not fail loudly —"
  echo "  it forks the chain and asserts against a builder nothing ever touched."
  exit 1
fi

echo "PASS: chain mock covers all $(echo "$used" | wc -l | tr -d ' ') postgrest builder methods in use."
