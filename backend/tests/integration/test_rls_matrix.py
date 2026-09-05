"""Real-database RLS matrix for core tables + SECURITY DEFINER RPC surface.

P1-8 of the 2026-07-12 deep audit: the file formerly named test_rls_policies.py
(now test_dependency_gates.py) mocks the database entirely — it verifies the
FastAPI dependency layer, not one row of actual RLS. Real anon-RLS checks
existed only for DRIFT tables, so a bad policy migration on the core tables
passed CI green. This suite closes that gap in the DRIFT style: raw PostgREST
requests with the anon key, real user-JWT clients for owner-scoping, and the
service_role client only for seeding/teardown.

Matrix under test:
- Public-first reads: ``simulations``, ``agents``, ``substrate_resonances``,
  ``game_epochs`` are anon-readable (browsing must never 403).
- Protected reads: ``platform_settings`` (service_role only — API keys live
  here) and ``journal_fragments`` (owner-scoped) must not leak to anon;
  fragments are invisible even to OTHER authenticated users.
- Anon writes: every core table refuses an anon INSERT — asserted by status
  code AND by the marker row's absence afterwards (immune to 400-vs-403
  ambiguity).
- SECDEF RPC surface: system-class functions (``fn_apply_map_geometry``,
  ``fn_apply_zone_adjacencies``, ``fn_auto_draft_participants``,
  ``fn_compute_cycle_scores``) are callable by neither anon nor authenticated
  (ADR-006); the self-validating ``fn_update_user_byok_keys`` rejects a
  cross-user call from a real user JWT.

Requires a live Supabase instance; skipped automatically when unavailable.
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

import httpx
import pytest
from postgrest.exceptions import APIError

from backend.config import settings
from backend.tests.integration.conftest import requires_supabase

pytestmark = [requires_supabase]

_ANON_HEADERS = {
    "apikey": settings.supabase_anon_key,
    "Authorization": f"Bearer {settings.supabase_anon_key}",
}


def _anon_get(table: str, params: dict) -> httpx.Response:
    return httpx.get(
        f"{settings.supabase_url}/rest/v1/{table}",
        params=params,
        headers=_ANON_HEADERS,
        timeout=5.0,
    )


def _anon_post(table: str, payload: dict) -> httpx.Response:
    return httpx.post(
        f"{settings.supabase_url}/rest/v1/{table}",
        json=payload,
        headers={**_ANON_HEADERS, "Prefer": "return=representation"},
        timeout=5.0,
    )


@pytest.fixture()
def public_world(admin_client):
    """A throwaway simulation + agent, visible to the public per architecture."""
    sim_id, agent_id = str(uuid4()), str(uuid4())
    marker = f"rls-matrix-{sim_id[:8]}"
    admin_client.table("simulations").insert(
        # status='active': the anon SELECT policies expose only active,
        # non-deleted simulations (and their entities)
        {"id": sim_id, "name": f"RLS Matrix {marker}", "slug": marker, "status": "active"}
    ).execute()
    admin_client.table("agents").insert(
        {
            "id": agent_id,
            "simulation_id": sim_id,
            "name": f"Agent {marker}",
            "slug": f"agent-{marker}",
        }
    ).execute()
    yield {"sim_id": sim_id, "agent_id": agent_id}
    admin_client.table("agents").delete().eq("id", agent_id).execute()
    admin_client.table("simulations").delete().eq("id", sim_id).execute()


class TestAnonReadMatrix:
    """Public-first: browsing must work without a JWT — protected tables must not."""

    def test_anon_reads_simulation_and_agent(self, public_world):
        for table, row_id in (
            ("simulations", public_world["sim_id"]),
            ("agents", public_world["agent_id"]),
        ):
            resp = _anon_get(table, {"id": f"eq.{row_id}", "select": "id"})
            assert resp.status_code == 200, f"{table}: {resp.status_code} {resp.text}"
            assert any(r["id"] == row_id for r in resp.json()), (
                f"anon cannot read public {table} row — public-first architecture broken"
            )

    def test_anon_reads_resonance_and_epoch(self, admin_client):
        res_id, epoch_id = str(uuid4()), str(uuid4())
        admin_client.table("substrate_resonances").insert(
            {
                "id": res_id,
                "source_category": "economic_crisis",
                "title": f"rls-matrix-{res_id[:8]}",
                "impacts_at": datetime.now(UTC).isoformat(),
            }
        ).execute()
        admin_client.table("game_epochs").insert({"id": epoch_id, "name": f"rls-matrix-{epoch_id[:8]}"}).execute()
        try:
            for table, row_id in (
                ("substrate_resonances", res_id),
                ("game_epochs", epoch_id),
            ):
                resp = _anon_get(table, {"id": f"eq.{row_id}", "select": "id"})
                assert resp.status_code == 200, f"{table}: {resp.status_code} {resp.text}"
                assert any(r["id"] == row_id for r in resp.json()), f"anon cannot read public {table} row"
        finally:
            admin_client.table("substrate_resonances").delete().eq("id", res_id).execute()
            admin_client.table("game_epochs").delete().eq("id", epoch_id).execute()

    def test_anon_cannot_read_platform_settings(self, admin_client):
        """platform_settings carries API keys — a leak here is a P0."""
        marker_key = f"rls_matrix_probe_{uuid4().hex[:12]}"
        admin_client.table("platform_settings").insert(
            {"setting_key": marker_key, "setting_value": "secret-probe"}
        ).execute()
        try:
            resp = _anon_get("platform_settings", {"setting_key": f"eq.{marker_key}", "select": "setting_key"})
            leaked = resp.status_code == 200 and len(resp.json()) > 0
            assert not leaked, f"anon can read platform_settings: {resp.text}"
        finally:
            admin_client.table("platform_settings").delete().eq("setting_key", marker_key).execute()


@pytest.fixture()
def owned_fragment(admin_client, test_user_ids):
    """A journal fragment owned by test user 0."""
    frag_id = str(uuid4())
    admin_client.table("journal_fragments").insert(
        {
            "id": frag_id,
            "user_id": str(test_user_ids[0]),
            "fragment_type": "imprint",
            "source_type": "simulation",
            "content_de": "RLS-Matrix-Sonde",
            "content_en": "RLS matrix probe",
        }
    ).execute()
    yield frag_id
    admin_client.table("journal_fragments").delete().eq("id", frag_id).execute()


class TestOwnerScopedJournal:
    """journal_fragments: owner sees it; anon and OTHER users do not."""

    def test_anon_cannot_read_fragment(self, owned_fragment):
        resp = _anon_get("journal_fragments", {"id": f"eq.{owned_fragment}", "select": "id"})
        leaked = resp.status_code == 200 and len(resp.json()) > 0
        assert not leaked, f"anon can read journal_fragments: {resp.text}"

    def test_owner_sees_fragment_other_user_does_not(self, owned_fragment, user_clients):
        owner, other = user_clients[0], user_clients[1]
        owner_rows = owner.table("journal_fragments").select("id").eq("id", owned_fragment).execute().data
        assert owner_rows, "owner cannot read their own journal fragment"
        try:
            other_rows = other.table("journal_fragments").select("id").eq("id", owned_fragment).execute().data
        except APIError:
            other_rows = []
        assert not other_rows, "a foreign user can read someone else's journal fragment"

    def test_authenticated_cannot_read_platform_settings(self, user_clients):
        try:
            rows = user_clients[0].table("platform_settings").select("setting_key").limit(1).execute().data
        except APIError:
            rows = []
        assert not rows, "an authenticated user can read platform_settings"


class TestAnonWriteMatrix:
    """Every anon INSERT on a core table must be refused — and leave no row."""

    @pytest.mark.parametrize(
        ("table", "payload_factory", "marker_col"),
        [
            ("simulations", lambda m: {"name": m, "slug": m}, "slug"),
            ("platform_settings", lambda m: {"setting_key": m, "setting_value": "x"}, "setting_key"),
            (
                "substrate_resonances",
                lambda m: {
                    "source_category": "economic_crisis",
                    "title": m,
                    "impacts_at": datetime.now(UTC).isoformat(),
                },
                "title",
            ),
            ("game_epochs", lambda m: {"name": m}, "name"),
        ],
    )
    def test_anon_insert_refused(self, admin_client, table, payload_factory, marker_col):
        marker = f"rls-matrix-write-{uuid4().hex[:12]}"
        resp = _anon_post(table, payload_factory(marker))
        assert resp.status_code >= 400, f"anon INSERT into {table} accepted: {resp.text}"
        rows = admin_client.table(table).select(marker_col).eq(marker_col, marker).execute().data
        if rows:  # belt & braces: never leave the row behind
            admin_client.table(table).delete().eq(marker_col, marker).execute()
        assert not rows, f"anon INSERT into {table} persisted a row despite {resp.status_code}"

    def test_anon_insert_agent_refused(self, admin_client, public_world):
        marker = f"rls-matrix-write-{uuid4().hex[:12]}"
        resp = _anon_post(
            "agents",
            {"simulation_id": public_world["sim_id"], "name": marker, "slug": marker},
        )
        assert resp.status_code >= 400, f"anon INSERT into agents accepted: {resp.text}"
        rows = admin_client.table("agents").select("id").eq("slug", marker).execute().data
        if rows:
            admin_client.table("agents").delete().eq("slug", marker).execute()
        assert not rows, "anon INSERT into agents persisted a row"

    def test_anon_insert_journal_fragment_refused(self, admin_client, test_user_ids):
        marker = f"RLS matrix write probe {uuid4().hex[:12]}"
        resp = _anon_post(
            "journal_fragments",
            {
                "user_id": str(test_user_ids[0]),
                "fragment_type": "imprint",
                "source_type": "simulation",
                "content_de": marker,
                "content_en": marker,
            },
        )
        assert resp.status_code >= 400, f"anon INSERT into journal_fragments accepted: {resp.text}"
        rows = admin_client.table("journal_fragments").select("id").eq("content_en", marker).execute().data
        if rows:
            admin_client.table("journal_fragments").delete().eq("content_en", marker).execute()
        assert not rows, "anon INSERT into journal_fragments persisted a row"


class TestSecdefRpcSurface:
    """System-class SECURITY DEFINER RPCs are service_role-only (ADR-006).

    Implements what test_auth_boundaries.py carried as a skipif(True) stub
    since migration 128: the RPC-permission tests that 'will be implemented
    when running against real Supabase'. CI runs real Supabase.
    """

    SYSTEM_RPCS = (
        ("fn_apply_map_geometry", {"p_simulation_id": str(uuid4()), "p_seed": "x", "p_geometry": {}}),
        ("fn_apply_zone_adjacencies", {"p_simulation_id": str(uuid4()), "p_pairs": []}),
        ("fn_auto_draft_participants", {"p_epoch_id": str(uuid4())}),
        ("fn_compute_cycle_scores", {"p_epoch_id": str(uuid4()), "p_cycle": 1}),
    )

    @pytest.mark.parametrize(("fn", "args"), SYSTEM_RPCS, ids=[f[0] for f in SYSTEM_RPCS])
    def test_anon_cannot_call_system_rpc(self, fn, args):
        resp = httpx.post(
            f"{settings.supabase_url}/rest/v1/rpc/{fn}",
            json=args,
            headers=_ANON_HEADERS,
            timeout=5.0,
        )
        assert resp.status_code in (401, 403, 404), f"anon reached {fn}: {resp.status_code} {resp.text}"

    @pytest.mark.parametrize(("fn", "args"), SYSTEM_RPCS, ids=[f[0] for f in SYSTEM_RPCS])
    def test_authenticated_cannot_call_system_rpc(self, user_clients, fn, args):
        with pytest.raises(APIError):
            user_clients[0].rpc(fn, args).execute()

    def test_byok_rpc_rejects_cross_user_call(self, user_clients, test_user_ids):
        """fn_update_user_byok_keys self-validates: auth.uid() must equal p_user_id."""
        with pytest.raises(APIError):
            user_clients[0].rpc(
                "fn_update_user_byok_keys",
                {"p_user_id": str(test_user_ids[1]), "p_clear_openrouter": True},
            ).execute()
