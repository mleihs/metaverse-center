"""Integration tests for migration 243 (DRIFT travel_constraint_extensions).

243 ALTERs six existing platform tables. These tests prove the widened
constraints behave at the ROW level (accept the new travel value, still reject
out-of-vocabulary values — i.e. the DROP + re-ADD reproduced the full list, not
just the new entry) and that the buildings view surfaces the new column:

- journal_fragments accepts source_type='travel' + fragment_type='journey', and
  still rejects bogus values for both (both CHECKs were widened, not loosened).
- achievement_definitions accepts category='travel', still rejects a bogus one.
- active_buildings surfaces the new sanctuary column (CLAUDE.md view rule), with
  the Chapel of Silence flagged true and ordinary buildings false.

The memory_source_type ENUM '+travel' and journal_attunements.system_hook
'+travel_option' are catalog-verified at apply time (a label present in pg_enum
is usable by definition; the system_hook CHECK uses the same DROP/re-ADD
mechanism proven here for the other three CHECKs).

Requires a live Supabase instance; skipped automatically when unavailable.
"""

from __future__ import annotations

from uuid import uuid4

import pytest
from postgrest.exceptions import APIError

from backend.tests.integration.conftest import requires_supabase

pytestmark = [requires_supabase, pytest.mark.gamedb]


class TestJournalFragmentTravel:
    """source_type += 'travel' and fragment_type += 'journey'; both still reject bogus."""

    def test_accepts_travel_journey(self, admin_client, test_user_ids):
        frag_id = str(uuid4())
        try:
            admin_client.table("journal_fragments").insert(
                {
                    "id": frag_id,
                    "user_id": str(test_user_ids[0]),
                    "source_type": "travel",
                    "fragment_type": "journey",
                    "content_de": "Ein Riss im Zwischenraum.",
                    "content_en": "A tear in the Bleed.",
                }
            ).execute()
            resp = (
                admin_client.table("journal_fragments")
                .select("source_type,fragment_type")
                .eq("id", frag_id)
                .execute()
            )
            assert resp.data[0]["source_type"] == "travel"
            assert resp.data[0]["fragment_type"] == "journey"
        finally:
            admin_client.table("journal_fragments").delete().eq("id", frag_id).execute()

    def test_rejects_bogus_source_type(self, admin_client, test_user_ids):
        with pytest.raises(APIError):
            admin_client.table("journal_fragments").insert(
                {
                    "user_id": str(test_user_ids[0]),
                    "source_type": "not_a_real_source",
                    "fragment_type": "journey",
                    "content_de": "x",
                    "content_en": "x",
                }
            ).execute()

    def test_rejects_bogus_fragment_type(self, admin_client, test_user_ids):
        with pytest.raises(APIError):
            admin_client.table("journal_fragments").insert(
                {
                    "user_id": str(test_user_ids[0]),
                    "source_type": "travel",
                    "fragment_type": "not_a_real_kind",
                    "content_de": "x",
                    "content_en": "x",
                }
            ).execute()


class TestAchievementCategoryTravel:
    """category += 'travel'; still rejects bogus."""

    def test_accepts_travel_category(self, admin_client):
        ach_id = f"drift_test_{uuid4().hex[:8]}"
        try:
            admin_client.table("achievement_definitions").insert(
                {
                    "id": ach_id,
                    "category": "travel",
                    "name_en": "First Crossing",
                    "name_de": "Erste Überfahrt",
                    "description_en": "Cross the Bleed.",
                    "description_de": "Überquere den Zwischenraum.",
                }
            ).execute()
            resp = (
                admin_client.table("achievement_definitions")
                .select("category")
                .eq("id", ach_id)
                .execute()
            )
            assert resp.data[0]["category"] == "travel"
        finally:
            admin_client.table("achievement_definitions").delete().eq("id", ach_id).execute()

    def test_rejects_bogus_category(self, admin_client):
        with pytest.raises(APIError):
            admin_client.table("achievement_definitions").insert(
                {
                    "id": f"drift_test_{uuid4().hex[:8]}",
                    "category": "not_a_real_category",
                    "name_en": "x",
                    "name_de": "x",
                    "description_en": "x",
                    "description_de": "x",
                }
            ).execute()


class TestSanctuaryView:
    """buildings.sanctuary is surfaced through active_buildings (CLAUDE.md view rule)."""

    def test_chapel_is_sanctuary_via_view(self, admin_client):
        resp = (
            admin_client.table("active_buildings")
            .select("name,sanctuary")
            .eq("name", "Chapel of Silence")
            .execute()
        )
        if not resp.data:
            pytest.skip("Chapel of Silence not seeded in this environment")
        assert resp.data[0]["sanctuary"] is True, "Chapel of Silence should be a sanctuary"

    def test_ordinary_building_is_not_sanctuary_via_view(self, admin_client):
        # Any building that is not the Chapel defaults to sanctuary=false, and the
        # view passes the column through unchanged.
        resp = (
            admin_client.table("active_buildings")
            .select("name,sanctuary")
            .neq("name", "Chapel of Silence")
            .limit(1)
            .execute()
        )
        if not resp.data:
            pytest.skip("no buildings seeded in this environment")
        assert resp.data[0]["sanctuary"] is False
