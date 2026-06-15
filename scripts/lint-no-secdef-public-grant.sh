#!/usr/bin/env bash
#
# ADR-006 recurrence guard — no SECURITY DEFINER function may be anon-callable
# outside the known-safe allowlist.
#
# PostgREST exposes every EXECUTE-granted function at /rest/v1/rpc/<fn>. A
# SECURITY DEFINER function runs as its owner, so an anon-EXECUTEable one lets
# anyone holding the public anon key bypass the FastAPI Depends() role gate
# (the incident-147 / migrations 257-258 class). This guard fails CI if a new
# migration leaves such a function reachable by anon.
#
# WHY a DB-STATE check (not a SQL text scan, and not ALTER DEFAULT PRIVILEGES):
#   * Grants span migrations — a function defined in migration N may be revoked
#     in migration M; only the post-migration grant state is authoritative.
#   * Supabase grants EXECUTE *directly* to anon/authenticated on new public
#     functions via pg_default_acl (for BOTH the `postgres` and the managed
#     `supabase_admin` roles), so `ALTER DEFAULT PRIVILEGES ... REVOKE EXECUTE
#     ... FROM PUBLIC` does NOT prevent the exposure (verified 2026-06-15:
#     a fresh function was still anon-executable after that ALTER). Revoking
#     from those roles instead is fragile (prod `postgres` is not superuser and
#     cannot ALTER supabase_admin's defaults; Supabase platform ops may revert
#     it; and it would force an explicit GRANT on every legitimate new RPC).
#   The reliable signal is the actual grant state after all migrations apply.
#
# Runs in the CI `test-backend` job (after migrations are applied via psql),
# where psql + the local Supabase DB are available. Connection comes from the
# standard PG* env vars; defaults match the CI / local-supabase Postgres.
#
# Run locally:  PGHOST=127.0.0.1 PGPORT=54322 bash scripts/lint-no-secdef-public-grant.sh
set -euo pipefail

PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-54322}"
PGUSER="${PGUSER:-postgres}"
PGDATABASE="${PGDATABASE:-postgres}"
export PGPASSWORD="${PGPASSWORD:-postgres}"

# Known-safe anon-callable SECURITY DEFINER functions. Extend ONLY with a
# proven justification (a genuine public read, or a function that self-validates
# the caller via auth.uid()).
#   get_bleed_status            — the one genuine public.py anon read (DRIFT spectator HUD)
#   is_platform_admin           — RLS helper, referenced by 100+ policies
#   user_has_simulation_access  — RLS helper
#   user_has_simulation_role    — RLS helper
#   user_simulation_role        — RLS helper
ALLOWLIST="get_bleed_status,is_platform_admin,user_has_simulation_access,user_has_simulation_role,user_simulation_role"

if ! command -v psql >/dev/null 2>&1; then
  echo "SKIP: psql not found — this guard needs a Postgres client + the migrated DB (CI test-backend job)." >&2
  exit 0
fi

bad=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -tAX <<SQL
SELECT string_agg(
         p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
         E'\n' ORDER BY p.proname)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef
  AND pg_get_function_result(p.oid) <> 'trigger'
  AND has_function_privilege('anon', p.oid, 'EXECUTE')
  AND p.proname <> ALL (string_to_array('${ALLOWLIST}', ','));
SQL
)

if [[ -n "$bad" ]]; then
  {
    echo "FAIL: SECURITY DEFINER function(s) anon-callable outside the ADR-006 allowlist:"
    echo "$bad" | sed 's/^/  - /'
    echo ""
    echo "These are reachable by anyone with the public anon key, bypassing the"
    echo "FastAPI role gate. Fix in a migration (see 257/258):"
    echo "  REVOKE ALL ON FUNCTION public.<fn>(<sig>) FROM PUBLIC, anon[, authenticated];"
    echo "  GRANT EXECUTE ON FUNCTION public.<fn>(<sig>) TO service_role[, authenticated];"
    echo "If the function is genuinely public + safe (a true public read, or it"
    echo "self-validates the caller via auth.uid()), add its name to ALLOWLIST in"
    echo "scripts/lint-no-secdef-public-grant.sh with a one-line justification."
  } >&2
  exit 1
fi

echo "OK: no SECURITY DEFINER function is anon-callable outside the ADR-006 allowlist."
echo "    allowlist: ${ALLOWLIST}"
