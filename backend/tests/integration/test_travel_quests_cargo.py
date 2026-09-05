"""Integration tests for migration 241 (DRIFT travel_quests_cargo).

Verifies the quest/cargo-layer invariants the travel engine and RPCs depend on:

- ``travel_quest_templates`` ``family`` CHECK admits exactly the 6 Depeschen
  families; ``template_key`` is UNIQUE (the pack-reseed conflict target).
- The **soft-ref decision** (migration header): ``travel_quest_instances`` carries
  ``template_key TEXT`` with NO foreign key, so a TRUNCATE-style template reseed
  (simulated here by deleting the template) never cascades into live instances.
- ``entity_refs`` / ``travel_cargo.twists`` array-shape guards reject non-arrays
  (the KPI-1 ledger and the closed twist catalog are jsonb arrays).
- ``travel_cargo`` ``family`` (7 cargo families) and ``vector`` (7 bleed vectors)
  CHECKs reject out-of-vocabulary values; ``counterpart_cargo_id`` self-reference
  (verschränkt pairing) resolves.
- ``traveler_scars`` partial unique blocks two *active* rows of the same scar_key
  per user, but allows re-acquisition after shedding.
- ``route_purchases`` PK(route_id, buyer_user_id) is the per-buyer-once guarantee;
  ``published_routes.price`` CHECK bounds scrip to 5–50.
- RLS: quest templates and published_routes are PUBLIC read; cargo/instances are
  owner-only (anon reads return empty even when a row exists).

Requires a live Supabase instance; skipped automatically when unavailable.
"""

from __future__ import annotations

from uuid import uuid4

import httpx
import pytest
from postgrest.exceptions import APIError

from backend.config import settings
from backend.tests.integration.conftest import requires_supabase
from backend.tests.integration.game_constants import SIM_VELGARIEN

pytestmark = [requires_supabase, pytest.mark.gamedb]


class TestQuestTemplateFamily:
    """family CHECK = the 6 Depeschen families; template_key is UNIQUE."""

    def test_family_check_rejects_unknown(self, admin_client):
        with pytest.raises(APIError):
            admin_client.table("travel_quest_templates").insert(
                {"template_key": f"tpl-{uuid4()}", "family": "smuggle", "pack_slug": "test"}
            ).execute()

    def test_six_families_accepted_and_key_unique(self, admin_client):
        key = f"tpl-{uuid4()}"
        try:
            for fam in ("deliver", "fetch", "survey", "investigate", "escort", "introduce"):
                admin_client.table("travel_quest_templates").insert(
                    {"template_key": f"{key}-{fam}", "family": fam, "pack_slug": "test"}
                ).execute()
            # template_key UNIQUE — re-inserting the same key collides.
            with pytest.raises(APIError):
                admin_client.table("travel_quest_templates").insert(
                    {"template_key": f"{key}-deliver", "family": "fetch", "pack_slug": "test"}
                ).execute()
        finally:
            admin_client.table("travel_quest_templates").delete().like("template_key", f"{key}%").execute()


class TestQuestInstanceSoftRef:
    """Instances reference template_key with NO FK — a template reseed never cascades."""

    def test_instance_survives_template_delete(self, admin_client, test_user_ids):
        template_key = f"tpl-softref-{uuid4()}"
        owner = str(test_user_ids[0])
        instance_id = str(uuid4())
        try:
            admin_client.table("travel_quest_templates").insert(
                {"template_key": template_key, "family": "deliver", "pack_slug": "test"}
            ).execute()
            admin_client.table("travel_quest_instances").insert(
                {
                    "id": instance_id,
                    "template_key": template_key,
                    "owner_user_id": owner,
                    "simulation_id": str(SIM_VELGARIEN),
                    "entity_refs": [
                        {"kind": "agent", "id": str(uuid4())},
                        {"kind": "building", "id": str(uuid4())},
                    ],
                }
            ).execute()
            # Simulate a pack reseed: drop the template row entirely.
            admin_client.table("travel_quest_templates").delete().eq("template_key", template_key).execute()
            # The live instance must still exist (no CASCADE, no FK).
            resp = (
                admin_client.table("travel_quest_instances").select("id,template_key").eq("id", instance_id).execute()
            )
            assert len(resp.data) == 1, "instance was wiped by template delete — soft-ref broken"
            assert resp.data[0]["template_key"] == template_key
        finally:
            admin_client.table("travel_quest_instances").delete().eq("id", instance_id).execute()
            admin_client.table("travel_quest_templates").delete().eq("template_key", template_key).execute()

    def test_entity_refs_must_be_array(self, admin_client, test_user_ids):
        owner = str(test_user_ids[1])
        # A jsonb object (not an array) violates the shape guard.
        with pytest.raises(APIError):
            admin_client.table("travel_quest_instances").insert(
                {
                    "template_key": f"tpl-{uuid4()}",
                    "owner_user_id": owner,
                    "simulation_id": str(SIM_VELGARIEN),
                    "entity_refs": {"kind": "agent"},
                }
            ).execute()


class TestCargoVocabularies:
    """Cargo family (7) + vector (7) CHECKs; twists shape; self-ref counterpart."""

    def test_family_check_rejects_unknown(self, admin_client, test_user_ids):
        with pytest.raises(APIError):
            admin_client.table("travel_cargo").insert(
                {"owner_user_id": str(test_user_ids[0]), "family": "munitions", "vector": "commerce"}
            ).execute()

    def test_vector_check_rejects_unknown(self, admin_client, test_user_ids):
        with pytest.raises(APIError):
            admin_client.table("travel_cargo").insert(
                {"owner_user_id": str(test_user_ids[0]), "family": "kontrakte", "vector": "gravity"}
            ).execute()

    def test_twists_must_be_array(self, admin_client, test_user_ids):
        with pytest.raises(APIError):
            admin_client.table("travel_cargo").insert(
                {
                    "owner_user_id": str(test_user_ids[0]),
                    "family": "kontrakte",
                    "vector": "commerce",
                    "twists": {"flag": "gefaelscht"},  # object, not array
                }
            ).execute()

    def test_counterpart_self_reference_resolves(self, admin_client, test_user_ids):
        owner = str(test_user_ids[2])
        a_id = str(uuid4())
        b_id = str(uuid4())
        try:
            admin_client.table("travel_cargo").insert(
                {"id": a_id, "owner_user_id": owner, "family": "idiome", "vector": "language"}
            ).execute()
            # verschränkt: B is paired to A via the self-referential FK.
            admin_client.table("travel_cargo").insert(
                {
                    "id": b_id,
                    "owner_user_id": owner,
                    "family": "idiome",
                    "vector": "language",
                    "twists": ["verschraenkt"],
                    "counterpart_cargo_id": a_id,
                }
            ).execute()
            resp = admin_client.table("travel_cargo").select("counterpart_cargo_id").eq("id", b_id).execute()
            assert resp.data[0]["counterpart_cargo_id"] == a_id
        finally:
            # Delete B first (it points at A); A's FK is SET NULL so order is lenient.
            admin_client.table("travel_cargo").delete().eq("id", b_id).execute()
            admin_client.table("travel_cargo").delete().eq("id", a_id).execute()


class TestScarActiveUnique:
    """uq_traveler_scars_active_key: no two *active* rows of one scar_key per user."""

    def test_no_duplicate_active_but_reacquire_after_shed(self, admin_client, test_user_ids):
        user_id = str(test_user_ids[3])
        scar_key = f"scar-{uuid4()}"
        first_id = str(uuid4())
        try:
            admin_client.table("traveler_scars").insert(
                {"id": first_id, "user_id": user_id, "scar_key": scar_key, "active": True}
            ).execute()
            # A second *active* row of the same scar collides on the partial unique.
            with pytest.raises(APIError):
                admin_client.table("traveler_scars").insert(
                    {"user_id": user_id, "scar_key": scar_key, "active": True}
                ).execute()
            # Shed the first (active → false): the partial index no longer covers it.
            admin_client.table("traveler_scars").update({"active": False}).eq("id", first_id).execute()
            # Re-acquisition of the same scar_key is now allowed.
            admin_client.table("traveler_scars").insert(
                {"user_id": user_id, "scar_key": scar_key, "active": True}
            ).execute()
        finally:
            admin_client.table("traveler_scars").delete().eq("user_id", user_id).eq("scar_key", scar_key).execute()


class TestRoutePurchaseOnce:
    """route_purchases PK is per-buyer-once; published_routes.price is bounded 5–50."""

    def test_price_bounds_and_per_buyer_once(self, admin_client, test_user_ids):
        surveyor = str(test_user_ids[0])
        buyer1 = str(test_user_ids[1])
        buyer2 = str(test_user_ids[2])
        route_id = str(uuid4())
        try:
            # price below the floor is rejected.
            with pytest.raises(APIError):
                admin_client.table("published_routes").insert(
                    {"surveyor_user_id": surveyor, "name": "Too Cheap", "edge_keys": ["e1"], "price": 3}
                ).execute()
            # a valid published route.
            admin_client.table("published_routes").insert(
                {
                    "id": route_id,
                    "surveyor_user_id": surveyor,
                    "name": "Lacewing Loop",
                    "edge_keys": ["e1", "e2"],
                    "price": 10,
                }
            ).execute()
            admin_client.table("route_purchases").insert(
                {"route_id": route_id, "buyer_user_id": buyer1, "price_paid": 10}
            ).execute()
            # Same buyer, same route → PK collision (per-buyer-once).
            with pytest.raises(APIError):
                admin_client.table("route_purchases").insert(
                    {"route_id": route_id, "buyer_user_id": buyer1, "price_paid": 10}
                ).execute()
            # A different buyer is fine.
            admin_client.table("route_purchases").insert(
                {"route_id": route_id, "buyer_user_id": buyer2, "price_paid": 10}
            ).execute()
        finally:
            # CASCADE from published_routes clears route_purchases.
            admin_client.table("published_routes").delete().eq("id", route_id).execute()


class TestPublicVsOwnerRLS:
    """Templates + published_routes are public read; cargo is owner-only."""

    def _anon_get(self, table: str, row_id: str):
        return httpx.get(
            f"{settings.supabase_url}/rest/v1/{table}",
            params={"id": f"eq.{row_id}", "select": "id"},
            headers={
                "apikey": settings.supabase_anon_key,
                "Authorization": f"Bearer {settings.supabase_anon_key}",
            },
            timeout=5.0,
        )

    def test_anon_reads_public_template(self, admin_client):
        template_key = f"tpl-public-{uuid4()}"
        admin_client.table("travel_quest_templates").insert(
            {"template_key": template_key, "family": "survey", "pack_slug": "test"}
        ).execute()
        row = admin_client.table("travel_quest_templates").select("id").eq("template_key", template_key).execute()
        tpl_id = row.data[0]["id"]
        try:
            resp = self._anon_get("travel_quest_templates", tpl_id)
            assert resp.status_code == 200, resp.text
            assert any(r["id"] == tpl_id for r in resp.json()), "anon could not read public template"
        finally:
            admin_client.table("travel_quest_templates").delete().eq("template_key", template_key).execute()

    def test_anon_cannot_read_owner_cargo(self, admin_client, test_user_ids):
        cargo_id = str(uuid4())
        admin_client.table("travel_cargo").insert(
            {
                "id": cargo_id,
                "owner_user_id": str(test_user_ids[0]),
                "family": "blaupausen",
                "vector": "architecture",
            }
        ).execute()
        try:
            resp = self._anon_get("travel_cargo", cargo_id)
            # RLS returns an empty set (200), never the owner's row.
            assert resp.status_code == 200, resp.text
            assert resp.json() == [], f"anon leaked owner-only cargo: {resp.json()}"
        finally:
            admin_client.table("travel_cargo").delete().eq("id", cargo_id).execute()
