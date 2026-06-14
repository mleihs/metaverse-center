"""Integration tests for migration 242 (DRIFT travel_effects).

Verifies the effect-landing-table invariants the EffectResolver depends on:

- ``zone_modifiers.source`` CHECK is a provenance lock — only 'travel_quest'
  rows may exist (this is not the platform's general zone-modifier store).
- ``agent_travel_effects`` FKs: agent_id is enforced; source_quest_instance_id is
  SET NULL, so an effect OUTLIVES the quest instance that granted it (the resolver
  contract — effects persist past their originating quest).
- ``agent_travel_effects.effect_key`` is open (no DB CHECK) — the granted-modifier
  vocabulary is pack-owned, validated in pack CI, never duplicated as a DB CHECK.
- ``travel_dressing_cache`` cache_key PK upserts idempotently (a cache hit returns
  one row, never duplicates).
- RLS: agent_travel_effects + zone_modifiers are sim-public read (world state);
  travel_dressing_cache is backend-only (anon reads return empty even with a row).

Requires a live Supabase instance; skipped automatically when unavailable.
"""

from __future__ import annotations

from uuid import uuid4

import httpx
import pytest
from postgrest.exceptions import APIError

from backend.config import settings
from backend.tests.integration.conftest import requires_supabase
from backend.tests.integration.game_constants import SIM_VELGARIEN, ZONE_ALTSTADT

pytestmark = [requires_supabase, pytest.mark.gamedb]

_FAR_FUTURE = "2099-01-01T00:00:00+00:00"


def _a_velgarien_agent(admin_client) -> str:
    """A real agent id in the Velgarien template sim (FK-positive tests need one)."""
    resp = (
        admin_client.table("agents")
        .select("id")
        .eq("simulation_id", str(SIM_VELGARIEN))
        .limit(1)
        .execute()
    )
    if not resp.data:
        pytest.skip("no seeded agent in Velgarien template sim")
    return resp.data[0]["id"]


class TestZoneModifierSourceLock:
    """source CHECK ('travel_quest') is a provenance lock."""

    def test_rejects_foreign_source(self, admin_client):
        with pytest.raises(APIError):
            admin_client.table("zone_modifiers").insert(
                {
                    "zone_id": str(ZONE_ALTSTADT),
                    "modifier_key": "patrol_density_up",
                    "expires_at": _FAR_FUTURE,
                    "source": "dungeon_loot",  # not travel_quest → rejected
                }
            ).execute()

    def test_accepts_travel_quest(self, admin_client):
        mod_id = str(uuid4())
        try:
            admin_client.table("zone_modifiers").insert(
                {
                    "id": mod_id,
                    "zone_id": str(ZONE_ALTSTADT),
                    "modifier_key": "patrol_density_up",
                    "expires_at": _FAR_FUTURE,
                    "source": "travel_quest",
                }
            ).execute()
            resp = admin_client.table("zone_modifiers").select("source").eq("id", mod_id).execute()
            assert resp.data[0]["source"] == "travel_quest"
        finally:
            admin_client.table("zone_modifiers").delete().eq("id", mod_id).execute()


class TestAgentEffectProvenance:
    """agent_id FK enforced; effect outlives its quest (source SET NULL)."""

    def test_agent_fk_enforced(self, admin_client):
        with pytest.raises(APIError):
            admin_client.table("agent_travel_effects").insert(
                {"agent_id": str(uuid4()), "effect_key": "favored_passage"}  # no such agent
            ).execute()

    def test_effect_survives_quest_delete(self, admin_client, test_user_ids):
        agent_id = _a_velgarien_agent(admin_client)
        template_key = f"tpl-fx-{uuid4()}"
        instance_id = str(uuid4())
        effect_id = str(uuid4())
        try:
            admin_client.table("travel_quest_templates").insert(
                {"template_key": template_key, "family": "deliver", "pack_slug": "test"}
            ).execute()
            admin_client.table("travel_quest_instances").insert(
                {
                    "id": instance_id,
                    "template_key": template_key,
                    "owner_user_id": str(test_user_ids[0]),
                    "simulation_id": str(SIM_VELGARIEN),
                }
            ).execute()
            admin_client.table("agent_travel_effects").insert(
                {
                    "id": effect_id,
                    "agent_id": agent_id,
                    "effect_key": "remembers_the_traeger",
                    "source_quest_instance_id": instance_id,
                }
            ).execute()
            # Delete the quest instance — the effect must remain, provenance cleared.
            admin_client.table("travel_quest_instances").delete().eq("id", instance_id).execute()
            resp = (
                admin_client.table("agent_travel_effects")
                .select("id,source_quest_instance_id")
                .eq("id", effect_id)
                .execute()
            )
            assert len(resp.data) == 1, "effect was wiped by quest delete — should SET NULL, not CASCADE"
            assert resp.data[0]["source_quest_instance_id"] is None
        finally:
            admin_client.table("agent_travel_effects").delete().eq("id", effect_id).execute()
            admin_client.table("travel_quest_instances").delete().eq("id", instance_id).execute()
            admin_client.table("travel_quest_templates").delete().eq(
                "template_key", template_key
            ).execute()


class TestDressingCacheUpsert:
    """cache_key PK — a hit returns exactly one row across re-writes."""

    def test_pk_upsert_idempotent(self, admin_client):
        cache_key = f"sha-{uuid4()}"
        try:
            admin_client.table("travel_dressing_cache").insert(
                {"cache_key": cache_key, "prose": {"body": "first"}, "expires_at": _FAR_FUTURE}
            ).execute()
            admin_client.table("travel_dressing_cache").upsert(
                {"cache_key": cache_key, "prose": {"body": "second"}, "expires_at": _FAR_FUTURE},
                on_conflict="cache_key",
            ).execute()
            resp = (
                admin_client.table("travel_dressing_cache")
                .select("prose", count="exact")
                .eq("cache_key", cache_key)
                .execute()
            )
            assert resp.count == 1, f"expected 1 cache row, got {resp.count}"
            assert resp.data[0]["prose"]["body"] == "second"
        finally:
            admin_client.table("travel_dressing_cache").delete().eq("cache_key", cache_key).execute()


class TestEffectsRLS:
    """World-state effects are sim-public read; the dressing cache is backend-only."""

    def _anon_get(self, table: str, col: str, val: str):
        return httpx.get(
            f"{settings.supabase_url}/rest/v1/{table}",
            params={col: f"eq.{val}", "select": col},
            headers={
                "apikey": settings.supabase_anon_key,
                "Authorization": f"Bearer {settings.supabase_anon_key}",
            },
            timeout=5.0,
        )

    def test_anon_reads_public_zone_modifier(self, admin_client):
        mod_id = str(uuid4())
        admin_client.table("zone_modifiers").insert(
            {
                "id": mod_id,
                "zone_id": str(ZONE_ALTSTADT),
                "modifier_key": "test_public_read",
                "expires_at": _FAR_FUTURE,
            }
        ).execute()
        try:
            resp = self._anon_get("zone_modifiers", "id", mod_id)
            assert resp.status_code == 200, resp.text
            assert any(r["id"] == mod_id for r in resp.json()), "anon could not read public zone modifier"
        finally:
            admin_client.table("zone_modifiers").delete().eq("id", mod_id).execute()

    def test_anon_cannot_read_dressing_cache(self, admin_client):
        cache_key = f"sha-secret-{uuid4()}"
        admin_client.table("travel_dressing_cache").insert(
            {"cache_key": cache_key, "prose": {"body": "secret"}, "expires_at": _FAR_FUTURE}
        ).execute()
        try:
            resp = self._anon_get("travel_dressing_cache", "cache_key", cache_key)
            # Backend-only: RLS returns an empty set, never the cached prose.
            assert resp.status_code == 200, resp.text
            assert resp.json() == [], f"anon leaked the backend-only dressing cache: {resp.json()}"
        finally:
            admin_client.table("travel_dressing_cache").delete().eq("cache_key", cache_key).execute()
