#!/usr/bin/env bash
#
# lint-seed-carries-migration-effects.sh — a migration that fixes a platform
# prompt template must also be back-ported into the seed.
#
# Run locally:  PGHOST=127.0.0.1 PGPORT=54322 bash scripts/lint-seed-carries-migration-effects.sh
# Exit code: 0 = pass, 1 = a migration's effect is missing from the seed.
#
# THE TRAP THIS GUARDS
# --------------------
# `supabase/config.toml` seeds the database AFTER migrations during a db reset,
# and every INSERT in `supabase/seed/006_prompt_templates.sql` is
# `ON CONFLICT DO NOTHING`. On a fresh database the table is therefore EMPTY
# while the migrations run: every
#
#     UPDATE prompt_templates … WHERE simulation_id IS NULL
#
# matches zero rows and is silently discarded, and what the seed writes
# afterwards is all there is. `UPDATE 0` is not an error, so nothing says a word.
#
# That is not hypothetical. Migration 027 rewrote the four building templates in
# February — a 30-word cap, "never flowery prose", max_tokens 400 -> 200/150 —
# because long descriptions were overwhelming the image style prompt. Measured in
# the real order it reports `4x UPDATE 0`. **Every database created from this repo
# since February got the fassung that migration diagnosed as harmful**, while
# production, which was migrated in place, got the fix. Six months, no signal.
# It surfaced only when a transactional dry run of migration 281 against real
# production counted 6 of 18 statements as no-ops and someone asked why.
#
# WHY A DB-STATE CHECK AND NOT A TEXT COMPARISON
# ----------------------------------------------
# The same reason `lint-no-secdef-public-grant.sh` gives for grants: only the
# state after everything has been applied is authoritative. Migrations compose --
# one sets `prompt_content`, a later one appends to it with `||` behind an
# idempotency guard, a third rewrites it again. Comparing literal SQL text
# against literal seed text would have to re-implement that composition, and
# would be wrong the first time someone writes an append.
#
# THE INVARIANT, INSTEAD
# ----------------------
#   Replaying every platform-template UPDATE from every migration, in migration
#   order, against the database as a fresh reset leaves it, must change no VALUE.
#
# If a value comes out different, the seed does not carry that migration's
# effect, and the next fresh database will silently lose it. The replay runs
# inside a transaction and rolls back, so it never writes.
#
# It compares VALUES, not affected-row counts, and the difference matters. The
# first draft of this gate counted rows and reported ten violations that were not
# violations: `UPDATE t SET x = 'a' WHERE id = 1` reports one affected row even
# when x is already 'a', so every unguarded migration statement looked like a
# gap. A gate that fires on correct input gets switched off, and then it misses
# the real case too.
#
# Runs in the CI `test-backend` job, after migrations and seeds have been applied
# via psql — the same slot, and the same connection defaults, as the SECDEF guard.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-54322}"
PGUSER="${PGUSER:-postgres}"
PGDATABASE="${PGDATABASE:-postgres}"
export PGHOST PGPORT PGUSER PGDATABASE
export PGPASSWORD="${PGPASSWORD:-postgres}"

if ! command -v psql >/dev/null 2>&1; then
  echo "SKIP: psql not available — this gate needs the migrated + seeded database."
  exit 0
fi

GENERATED="$(mktemp)"
trap 'rm -f "$GENERATED"' EXIT

# Extract every platform-template UPDATE from the migrations and re-emit it with
# a row counter. Statements are separated on ";\n": a semicolon inside a prompt's
# prose is followed by a space, never by a newline, and a chunk that is split
# wrongly fails loudly at psql rather than passing quietly.
python3 - "$GENERATED" <<'PY'
import pathlib
import re
import sys

out = pathlib.Path(sys.argv[1])
migrations = sorted(pathlib.Path("supabase/migrations").glob("*.sql"))

COLUMNS = ("prompt_content", "system_prompt", "max_tokens", "temperature")

lines = [
    "BEGIN;",
    "CREATE TEMP TABLE _before ON COMMIT DROP AS",
    "  SELECT template_type, locale, " + ", ".join(COLUMNS),
    "    FROM public.prompt_templates WHERE simulation_id IS NULL;",
]
found = 0
for path in migrations:
    body = path.read_text()
    for chunk in body.split(";\n"):
        # Drop leading comment lines so the statement keyword is the first token.
        statement = "\n".join(
            line for line in chunk.splitlines() if not line.lstrip().startswith("--")
        ).strip()
        if not statement.upper().startswith("UPDATE"):
            continue
        if "prompt_templates" not in statement:
            continue
        if not re.search(r"simulation_id\s+IS\s+NULL", statement, re.IGNORECASE):
            continue
        found += 1
        lines.append(statement + ";")

diffs = " OR ".join(f"b.{c} IS DISTINCT FROM a.{c}" for c in COLUMNS)
labels = ", ".join(f"CASE WHEN b.{c} IS DISTINCT FROM a.{c} THEN '{c}' END" for c in COLUMNS)
lines += [
    "SELECT b.template_type || '/' || b.locale,",
    f"       concat_ws(', ', {labels})",
    "  FROM _before b",
    "  JOIN public.prompt_templates a",
    "    ON a.simulation_id IS NULL AND a.template_type = b.template_type AND a.locale = b.locale",
    f" WHERE {diffs}",
    " ORDER BY 1;",
    "ROLLBACK;",
]
out.write_text("\n".join(lines) + "\n")
print(f"[seed-gap] replaying {found} platform-template UPDATE(s) from {len(migrations)} migrations", file=sys.stderr)
PY

RESULT="$(psql -v ON_ERROR_STOP=1 -qAt -f "$GENERATED")"

if [[ -z "$RESULT" ]]; then
  echo "PASS: the seed carries every platform prompt_templates migration (replaying them changes no value)."
  exit 0
fi

echo "FAIL: replaying the migrations changes a platform prompt template the seed already wrote."
echo ""
echo "  template_type/locale | columns that would change"
echo "$RESULT" | while IFS='|' read -r target cols; do
  printf "  %-30s %s\n" "$target" "$cols"
done
echo ""
echo "That means a fresh database will NOT have this migration's effect: the seed"
echo "runs after the migrations, its INSERTs are ON CONFLICT DO NOTHING, and the"
echo "table was empty when the migration ran."
echo ""
echo "Fix: back-port the migration's resulting text into"
echo "supabase/seed/006_prompt_templates.sql. That file is the final state, not a"
echo "starting point — see its header."
exit 1
