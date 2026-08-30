"""Three admin-only views must not be readable by `anon`.

Found while working E13 ("set `security_invoker` on `available_dungeons`"). The
measurement said something different from the finding: **not one of the 11 views
in `public` declares `security_invoker`**, so every one of them runs as its
owner and the base tables' RLS never applies.

For most that is harmless — the Public-First policies grant `anon` the same
access anyway. For three it is not:

  token_economy_stats  → total revenue in cents, tokens in circulation, buyers
  v_instagram_queue    → the full queue including UNPUBLISHED posts and
  v_bluesky_queue        `unlock_code`, the Cipher ARG code per post

All three are read in operation only through the service-role client behind
`require_platform_admin()`, so revoking anon/authenticated cannot reach a
caller. Migration 294 revokes the grant AND sets `security_invoker` — the first
is the effect, the second is depth in case someone re-grants later.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

_MIGRATION = (
    Path(__file__).resolve().parents[3]
    / "supabase/migrations/20260831050000_294_admin_views_are_not_public.sql"
)

_PROTECTED = ("token_economy_stats", "v_instagram_queue", "v_bluesky_queue")

#: Views that stay public on purpose — their base tables grant `anon` the same
#: access by policy. Touching them would be a behaviour change on public read
#: surfaces, not the closing of a gap.
_PUBLIC = (
    "active_agents", "active_buildings", "active_events", "active_resonances",
    "available_dungeons", "conversation_summaries", "map_simulations",
    "simulation_dashboard",
)


@pytest.fixture(scope="module")
def sql() -> str:
    assert _MIGRATION.is_file(), f"Migration nicht gefunden: {_MIGRATION}"
    text = _MIGRATION.read_text(encoding="utf-8")
    assert len(text) > 500, "Migration verdächtig kurz — liest der Test die richtige Datei?"
    return text


def _statements(sql: str) -> str:
    """Only the executable part — the header explains the finding and names
    every view, including the ones that must stay untouched.

    Runs of spaces collapse to one: the statements are column-aligned for
    readability, and an assertion should hold the migration to what it DOES,
    not to how it lines up.
    """
    return re.sub(r"[ \t]+", " ", sql[sql.index("BEGIN;") :])


class TestTheGapIsClosed:
    @pytest.mark.parametrize("view", _PROTECTED)
    def test_grant_is_revoked(self, sql, view):
        body = _statements(sql)
        assert f"REVOKE SELECT ON public.{view}" in body, f"{view} behält den Grant"
        line = next(ln for ln in body.splitlines() if f"REVOKE SELECT ON public.{view}" in ln)
        assert "anon" in line and "authenticated" in line, (
            f"{view}: beide Rollen müssen entzogen werden, nicht nur eine"
        )

    @pytest.mark.parametrize("view", _PROTECTED)
    def test_security_invoker_is_set(self, sql, view):
        assert f"ALTER VIEW public.{view} SET (security_invoker = on)" in _statements(sql)

    def test_service_role_is_not_revoked(self, sql):
        """The backend reads all three through the service-role client."""
        assert "service_role" not in _statements(sql), (
            "Die Migration entzieht service_role etwas — dann bricht die Admin-Oberfläche"
        )


class TestThePublicViewsAreUntouched:
    @pytest.mark.parametrize("view", _PUBLIC)
    def test_no_statement_touches_it(self, sql, view):
        body = _statements(sql)
        assert f"REVOKE SELECT ON public.{view}" not in body
        assert f"ALTER VIEW public.{view}" not in body
