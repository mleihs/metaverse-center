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

# Anchor all paths to the repo root, so the gate greps the same tree no matter
# which directory it is invoked from. A relative target that misses turns the
# `|| true` guard into a green no-op pass. Resolve SCRIPT_DIR BEFORE the cd —
# BASH_SOURCE may be relative and would die with the old cwd.
# Enforced by scripts/lint-lint-scripts-anchored.sh.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

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

# ── Zweite Haelfte: die `authenticated`-Flaeche ──────────────────────────────
#
# Die Regel in CLAUDE.md nennt `anon` ODER `authenticated`. Bis zum 05.09.2026
# fragte dieses Tor nur nach `anon` — und in der ungeprueften Haelfte lagen
# drei Funktionen, die eine FREMDE Nutzerkennung entgegennahmen, ohne
# `auth.uid()` dagegen zu pruefen (Migration 387).
#
# 🔑 Eine Regel mit zwei Rollen und ein Tor mit einer: die ungeprueftte Haelfte
# ist die Stelle, an der so etwas jahrelang liegen bleibt.
#
# WARUM HIER KEINE NAMENSLISTE STEHT
#   Fuer `anon` ist die Sperrliste richtig: dort ist JEDER Eintrag eine
#   Entscheidung. Fuer `authenticated` waere sie falsch — 28 Funktionen sind
#   dort legitim aufrufbar, und eine Liste mit 28 Namen pflegt niemand. Sie
#   waere binnen eines Monats veraltet und wuerde dann Erfolg melden, ohne
#   etwas zu bedeuten.
#
#   Gefragt wird deshalb STRUKTURELL: nimmt die Funktion einen Parameter, der
#   eine Nutzerkennung ist, und vergleicht sie `auth.uid()` NICHT dagegen? Das
#   ist genau die Bedingung, unter der die Berechtigungspruefung vollstaendig
#   in die Aufrufstelle wandert — und PostgREST ist eine Aufrufstelle, die sie
#   nicht kennt.
#
#   CLAUDE.md nennt zwei sichere Formen, und beide bestehen diese Frage:
#     (a) `auth.uid()` GEGEN den Parameter geprueft  -> vergleicht, faellt raus
#     (b) gar kein Nutzer-Parameter                  -> nichts zu vergleichen
#
# ⚠ Ein Textmuster ist keine Beweisfuehrung. Ein erster Entwurf fragte nur, ob
# `auth.uid()` IRGENDWO im Rumpf vorkommt — das haette eine Funktion
# durchgelassen, die es liest und trotzdem eine fremde Kennung verarbeitet.
# Deshalb der Vergleich MIT dem Parameter, nicht seine blosse Erwaehnung.
AUTH_ALLOWLIST="fn_update_user_byok_keys"

# ⚠ ZWEI Pruefungen, EIN Ausgang. Der erste Entwurf setzte in der neuen
# Pruefung `FAILED=1` und liess die alte direkt `exit 1` rufen — damit haette
# ein Befund auf der authenticated-Seite das Skript NICHT rot gemacht, solange
# die anon-Seite sauber war. Ein Tor, das seinen eigenen Befund verschluckt,
# ist schlimmer als keins: es meldet OK.
FAILED=0

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

auth_bad=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -tAX <<SQL
SELECT string_agg(
         p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
         E'\n' ORDER BY p.proname)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef
  AND pg_get_function_result(p.oid) <> 'trigger'
  AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
  AND pg_get_function_identity_arguments(p.oid) ~* 'user_id'
  AND NOT (
        pg_get_functiondef(p.oid) ~* 'auth\.uid\(\)\s*(=|<>|IS DISTINCT FROM|IS NOT DISTINCT FROM)\s*p_user_id'
     OR pg_get_functiondef(p.oid) ~* 'p_user_id\s*(=|<>|IS DISTINCT FROM|IS NOT DISTINCT FROM)\s*auth\.uid\(\)'
  )
  AND p.proname <> ALL (string_to_array('${AUTH_ALLOWLIST}', ','));
SQL
)

if [[ -n "$auth_bad" ]]; then
  {
    echo "FAIL: SECURITY DEFINER function(s) take a foreign user id, are"
    echo "      authenticated-callable, and never compare it against auth.uid():"
    echo "$auth_bad" | sed 's/^/  - /'
    echo ""
    echo "Such a function moves the authorization check entirely into the call"
    echo "site — and PostgREST at /rest/v1/rpc/<fn> is a call site that does not"
    echo "know it. Any signed-in user can pass someone else's id."
    echo ""
    echo "Fix: compare auth.uid() against the parameter and RAISE, or drop the"
    echo "parameter and use auth.uid() as the identity, or REVOKE EXECUTE FROM"
    echo "authenticated and call it with the service-role client (migration 387)."
  } >&2
  FAILED=1
fi

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
  FAILED=1
fi

if [[ "$FAILED" -ne 0 ]]; then
  exit 1
fi

echo "OK: no SECURITY DEFINER function is anon-callable outside the ADR-006 allowlist,"
echo "    and none takes a foreign user id without checking auth.uid() against it."
echo "    allowlist: ${ALLOWLIST}"
