#!/bin/bash
# lint-effective-supabase-in-routers.sh — Ein Router, der `get_supabase` nimmt,
# lässt Plattform-Admins durch das Rollentor und dann an der RLS scheitern.
#
# Run: bash scripts/lint-effective-supabase-in-routers.sh
# Exit code: 0 = pass, 1 = Verstoss gefunden.
#
# ── WAS GESCHÜTZT WIRD ──────────────────────────────────────────────────────
#
# CLAUDE.md: „Never use `get_supabase` directly in routers. Use
# `get_effective_supabase` instead — it auto-elevates to service_role for
# platform admins, returns the user-scoped client for everyone else. Without
# this, admins pass `require_role()` but fail on RLS."
#
# Das ist die teure Sorte Fehler, weil sie ASYMMETRISCH auftritt: für den
# Entwickler, der Mitglied der Welt ist, funktioniert alles. Sie erscheint erst
# bei einem Plattform-Admin, der die Welt NICHT als Mitglied führt — er kommt
# durch `require_role()` (das ihn per `is_platform_admin()` durchlässt) und
# fällt dann bei der ersten Abfrage auf die RLS, als 500 statt als 403.
#
# 45 von 59 Routern folgen der Regel; der Rest sind öffentliche oder reine
# Service-Flächen ohne Simulationsdaten.
#
# ── DIE AUSNAHMEN ───────────────────────────────────────────────────────────
#
#   backend/routers/drift.py
#
# Sie ist im Modul-Docstring begründet und in CLAUDE.md ausdrücklich benannt:
# die RLS des DRIFT-Laufzustands benutzt `auth.uid()` ALS IDENTITÄT. Eine
# Auto-Erhöhung auf `service_role` würde dort die Zugehörigkeit eines Laufs
# zerstören, nicht bewahren (Migration 246 §4). Ihre Lesezugriffe und die
# Torprüfung folgen dem normalen Muster.
#
#   backend/routers/forge.py   (seit 02.09.2026, BYOK)
#
# Dieselbe Bauart, anderer Anlass. Die drei Schlüssel-Funktionen aus Migration
# 333 — `fn_set_user_api_key`, `fn_clear_user_api_key`,
# `fn_mark_user_api_key_verified` — nehmen KEINEN Nutzerparameter. Sie benutzen
# `auth.uid()` als Identität und sind genau deshalb `authenticated`-aufrufbar
# (ADR-006, Ausnahme a: eine Funktion, die sich selbst prüft).
#
# `get_effective_supabase` hebt einen Plattform-Admin auf `service_role`, und
# dort ist `auth.uid()` NULL. Der Schlüssel eines Admins landete damit auf
# keiner Zeile — still, denn ein UPDATE über null Zeilen ist ein Erfolg.
#
# ⚠ Der Router nimmt BEIDE Clients: `supabase=Depends(get_effective_supabase)`
# für alles Übrige und `user_supabase=Depends(get_supabase)` NUR für diese drei
# RPC-Aufrufe. Die Ausnahme gilt also der einen Zeile, nicht der Datei — wer
# hier eine weitere `get_supabase`-Abhängigkeit einführt, muss dieselbe Frage
# noch einmal beantworten.
#
# ⚠ Eine Ausnahme, die nur in Prosa steht, ist keine Ausnahme, sondern eine
# Erinnerung. Deshalb steht sie hier — und wenn eine dritte dazukommt, muss
# jemand sie hier eintragen und dabei begründen.

set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

ALLOWED="backend/routers/drift.py backend/routers/forge.py"

fail=0
found=0
while IFS= read -r file; do
  [ -z "$file" ] && continue
  found=$((found + 1))
  case " $ALLOWED " in
    *" $file "*) continue ;;
  esac
  echo "FAIL: $file nimmt Depends(get_supabase)"
  grep -n "Depends(get_supabase)" "$file" | head -3 | sed 's/^/      /'
  fail=1
done <<< "$(grep -rl "Depends(get_supabase)" backend/routers/ 2>/dev/null | grep -vE "/(\.venv|venv|site-packages)/" || true)"

if [ "$fail" -eq 1 ]; then
  echo
  echo "Router benutzen get_effective_supabase. Ohne das kommt ein Plattform-Admin"
  echo "durch require_role() und faellt danach auf die RLS — ein 500 statt eines 403,"
  echo "und nur fuer Leute, die die Welt nicht als Mitglied fuehren."
  echo "Braucht ein Router wirklich den Nutzer-Client, gehoert er in ALLOWED in"
  echo "diesem Tor, MIT Begruendung — so wie drift.py."
  exit 1
fi

# Die Torprüfung selbst prüfen: `get_effective_supabase` muss in den Routern
# tatsächlich vorkommen, sonst hat sich das Muster geändert und dieses Tor
# bewacht einen Namen, den niemand mehr benutzt.
users=$(grep -rl "get_effective_supabase" backend/routers/ 2>/dev/null | wc -l | tr -d ' ')
if [ "$users" -lt 20 ]; then
  echo "FAIL: nur $users Router nennen get_effective_supabase — erwartet >= 20."
  echo "      Entweder hat sich das Muster geaendert, oder dieses Tor sucht falsch."
  exit 1
fi

echo "PASS: $users Router nutzen get_effective_supabase; get_supabase nur in der begruendeten Ausnahme ($found Datei(en) geprueft)."
exit 0
