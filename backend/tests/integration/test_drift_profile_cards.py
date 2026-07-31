"""Integration tests for DRIFT Fun-Kern Welle 1, Schritt 1.2 — the service layer that
carries the economy to the HUD.

Two things ship here, and both were invisible in P0:

* **The Bureau account** (`DriftService.get_profile`) — Siegel, VP, the rank and how far
  the next rung is. The interesting logic is not the read but the PREDICATES: a rank with
  no configured exam must never be dangled as a fillable bar, and `exam_ready` must be the
  complete promotion condition (VP *and* fee *and* not already held), so the button is
  never offered on a click that could only 400.

* **The effect cards** (`DriftService._build_effect_cards`) — P0 collapsed the hospitality
  gate's verdict into a count ("3 Wirkungen", DriftView.ts:477). The card names the target,
  links the receipt event, and — for a filtered effect — carries the gate's real reason.
  The receipt link is resolved from `events.metadata.quest_instance_id`, which the gate
  already stamps, so nothing about the gate-closed RPC response had to change for it.

Requires a live Supabase instance; skipped automatically when unavailable.
"""

from __future__ import annotations

from uuid import uuid4

import pytest

from backend.models.drift import QuestEffectsResponse, TravelRunResponse
from backend.services.drift_service import DriftService
from backend.tests.integration.conftest import requires_supabase

pytestmark = [requires_supabase, pytest.mark.gamedb, pytest.mark.asyncio]


def _seed_profile(admin_client, user_id, anchor_sim, **overrides) -> None:
    admin_client.table("traveler_profiles").upsert(
        {
            "user_id": str(user_id),
            "anchor_simulation_id": str(anchor_sim),
            "vp": 0,
            "siegel": 0,
            "clearance_rank": "aspirant",
            "zerfaserung_count": 0,
            **overrides,
        },
        on_conflict="user_id",
    ).execute()


def _drop_profile(admin_client, user_id) -> None:
    admin_client.table("traveler_profiles").delete().eq("user_id", str(user_id)).execute()


@pytest.fixture()
def anchor_sim(admin_client) -> str:
    """Any active simulation — the profile's FK target."""
    rows = admin_client.table("simulations").select("id").eq("status", "active").limit(1).execute()
    if not rows.data:
        pytest.skip("no active simulation to anchor a traveller to")
    return rows.data[0]["id"]


class TestProfileLedger:
    """get_profile — the ledger strip's one read."""

    async def test_absent_profile_reads_as_none(self, admin_client, async_admin_client, test_user_ids):
        """Before the first run there IS no account — the strip renders empty rather than
        inventing a zeroed one."""
        user = test_user_ids[3]
        _drop_profile(admin_client, user)
        assert await DriftService.get_profile(async_admin_client, user) is None

    async def test_rank_progress_and_exam_predicate(
        self, admin_client, async_admin_client, test_user_ids, anchor_sim
    ):
        user = test_user_ids[3]
        tuning = (
            admin_client.table("drift_tuning")
            .select("value")
            .eq("setting_key", "clearance_thresholds")
            .execute()
        ).data[0]["value"]
        threshold = int(tuning["feldkartograph"])
        fee = int(
            (
                admin_client.table("drift_tuning")
                .select("value")
                .eq("setting_key", "clearance_exam_fee")
                .execute()
            ).data[0]["value"]["feldkartograph"]
        )
        try:
            # Half the VP, no Siegel → half a bar, no exam.
            _seed_profile(admin_client, user, anchor_sim, vp=threshold // 2, siegel=0)
            p = await DriftService.get_profile(async_admin_client, user)
            assert p is not None
            assert p.next_rank == "feldkartograph"
            assert p.next_rank_vp == threshold
            assert p.next_rank_fee == fee
            assert p.next_rank_progress == pytest.approx(0.5, abs=0.01)
            assert p.exam_ready is False, "VP alone does not make the exam sittable"

            # VP met, fee not → still not ready (the fee is part of the promotion, not a
            # surprise the player discovers by clicking).
            _seed_profile(admin_client, user, anchor_sim, vp=threshold, siegel=fee - 1)
            p = await DriftService.get_profile(async_admin_client, user)
            assert p is not None
            assert p.next_rank_progress == 1.0
            assert p.exam_ready is False

            # Both met → ready.
            _seed_profile(admin_client, user, anchor_sim, vp=threshold, siegel=fee)
            p = await DriftService.get_profile(async_admin_client, user)
            assert p is not None
            assert p.exam_ready is True
        finally:
            _drop_profile(admin_client, user)

    async def test_progress_never_exceeds_full_bar(
        self, admin_client, async_admin_client, test_user_ids, anchor_sim
    ):
        user = test_user_ids[3]
        try:
            _seed_profile(admin_client, user, anchor_sim, vp=100_000, siegel=100_000)
            p = await DriftService.get_profile(async_admin_client, user)
            assert p is not None
            assert p.next_rank_progress == 1.0, "a bar cannot be more than full"
        finally:
            _drop_profile(admin_client, user)

    async def test_rank_without_a_shipped_exam_is_not_dangled(
        self, admin_client, async_admin_client, test_user_ids, anchor_sim
    ):
        """A promoted traveller sees NO next rung while the higher exams do not exist —
        an empty bar toward an unreachable rank would be a lie the UI tells every session."""
        user = test_user_ids[3]
        try:
            _seed_profile(
                admin_client, user, anchor_sim, vp=500, siegel=500, clearance_rank="feldkartograph"
            )
            p = await DriftService.get_profile(async_admin_client, user)
            assert p is not None
            assert p.next_rank is None
            assert p.next_rank_progress == 0.0
            assert p.exam_ready is False
        finally:
            _drop_profile(admin_client, user)


class TestEffectCards:
    """_build_effect_cards — the honest verdict of the hospitality gate."""

    async def test_applied_effects_become_cards_with_named_targets_and_receipts(
        self, admin_client, async_admin_client, anchor_sim
    ):
        """An applied spawn_event card names the world, carries its slug, and links the
        actual event the gate wrote (resolved via metadata.quest_instance_id)."""
        instance_id = uuid4()
        sim = (
            admin_client.table("simulations")
            .select("id, name, slug")
            .eq("id", anchor_sim)
            .execute()
        ).data[0]
        agent = (
            admin_client.table("active_agents")
            .select("id, name")
            .eq("simulation_id", anchor_sim)
            .limit(1)
            .execute()
        ).data
        event = (
            admin_client.table("events")
            .insert({
                "simulation_id": sim["id"],
                "title": "Test-Depesche eingetroffen",
                "event_type": "travel_dispatch",
                "description": "Testbeleg.",
                "impact_level": 1,
                "metadata": {
                    "drift": True,
                    "kind": "spawn_event",
                    "source": "quest",
                    "quest_instance_id": str(instance_id),
                },
            })
            .execute()
        ).data[0]
        try:
            effects = QuestEffectsResponse(
                already_applied=False,
                applied=[
                    {"kind": "emit_fragment", "target": "self"},
                    {
                        "kind": "spawn_event",
                        "target_sim": sim["id"],
                        "hospitality": "standard",
                        "impact_level": 3,
                    },
                ]
                + (
                    [{
                        "kind": "inject_agent_memory",
                        "target_agent": agent[0]["id"],
                        "target_sim": sim["id"],
                        "hospitality": "standard",
                    }]
                    if agent
                    else []
                ),
                skipped=[],
            )
            cards = await DriftService._build_effect_cards(
                async_admin_client, instance_id, effects
            )

            by_kind = {c.kind: c for c in cards}
            assert set(by_kind) >= {"emit_fragment", "spawn_event"}
            assert all(c.status == "applied" for c in cards)

            self_card = by_kind["emit_fragment"]
            assert self_card.target_kind == "self"

            event_card = by_kind["spawn_event"]
            assert event_card.target_kind == "simulation"
            assert event_card.target_label == sim["name"], "the world is NAMED, not counted"
            assert event_card.simulation_slug == sim["slug"]
            assert str(event_card.event_id) == event["id"], (
                "the card links the receipt the gate actually wrote"
            )

            if agent:
                agent_card = by_kind["inject_agent_memory"]
                assert agent_card.target_kind == "agent"
                assert agent_card.target_label == agent[0]["name"]
        finally:
            admin_client.table("events").delete().eq("id", event["id"]).execute()

    async def test_filtered_effect_carries_the_gates_reason_and_no_receipt(
        self, admin_client, async_admin_client, anchor_sim
    ):
        """A world that only admits echoes is exercising its hospitality setting — the card
        says so, in the gate's own words, and links nothing (nothing was written)."""
        sim = (
            admin_client.table("simulations").select("id, name").eq("id", anchor_sim).execute()
        ).data[0]
        effects = QuestEffectsResponse(
            already_applied=False,
            applied=[],
            skipped=[
                {"kind": "spawn_event", "target_sim": sim["id"], "reason": "hospitality_nur_echos"},
                {"kind": "inject_agent_memory", "reason": "no_target_agent"},
            ],
        )
        cards = await DriftService._build_effect_cards(async_admin_client, uuid4(), effects)

        assert len(cards) == 2
        assert all(c.status == "filtered" for c in cards)
        assert all(c.event_id is None for c in cards), "a filtered effect wrote nothing"

        gated = next(c for c in cards if c.kind == "spawn_event")
        assert gated.reason == "hospitality_nur_echos", "the reason is passed through verbatim"
        assert gated.target_label == sim["name"]

        orphan = next(c for c in cards if c.kind == "inject_agent_memory")
        assert orphan.reason == "no_target_agent"
        assert orphan.target_label == "Unbekannter Träger"

    async def test_filtered_card_names_its_target_from_the_instance_slots(
        self, admin_client, async_admin_client, anchor_sim
    ):
        """The hospitality gate's SKIP entries carry only {kind, reason} — the target is
        dropped (migration 255). Without the slots fallback a filtered card reads
        "Unbekanntes Ziel", which is exactly the wrong sentence: the entire point of the card
        is that a NAMED world refused you. (Found in the W1 browser run.)"""
        sim = (
            admin_client.table("simulations").select("id, name, slug").eq("id", anchor_sim).execute()
        ).data[0]
        agent = (
            admin_client.table("active_agents")
            .select("id, name")
            .eq("simulation_id", anchor_sim)
            .limit(1)
            .execute()
        ).data

        effects = QuestEffectsResponse(
            already_applied=False,
            applied=[],
            # Exactly what fn_apply_drift_effects writes: no target on a hospitality skip.
            skipped=[
                {"kind": "spawn_event", "reason": "hospitality_nur_echos"},
                {"kind": "inject_agent_memory", "reason": "hospitality_nur_echos"},
            ],
        )
        slots = {"target_sim": sim["id"], "target_agent": agent[0]["id"] if agent else None}
        cards = await DriftService._build_effect_cards(
            async_admin_client, uuid4(), effects, slots
        )

        event_card = next(c for c in cards if c.kind == "spawn_event")
        assert event_card.target_label == sim["name"], "the refusing world is NAMED"
        assert event_card.simulation_slug == sim["slug"]
        assert event_card.event_id is None, "a refused effect wrote nothing"

        if agent:
            agent_card = next(c for c in cards if c.kind == "inject_agent_memory")
            assert agent_card.target_label == agent[0]["name"]

    async def test_receipt_is_read_from_the_public_events_view(
        self, admin_client, async_admin_client, anchor_sim
    ):
        """The receipt must resolve for a FOREIGN world — which is the only kind a Depesche
        is ever delivered to. `events.events_select` gates the base table on
        user_has_simulation_access, so a traveller (never a member of the target world) got
        an applied card with NO link. The read goes through active_events, the public view
        (the active_agents precedent). (Found in the W1 browser run.)"""
        instance_id = uuid4()
        sim = (admin_client.table("simulations").select("id").eq("id", anchor_sim).execute()).data[0]
        event = (
            admin_client.table("events")
            .insert({
                "simulation_id": sim["id"],
                "title": "Echo aus dem Drift",
                "event_type": "travel_echo",
                "description": "Testbeleg.",
                "impact_level": 1,
                "metadata": {"kind": "emit_echo", "quest_instance_id": str(instance_id)},
            })
            .execute()
        ).data[0]
        try:
            cards = await DriftService._build_effect_cards(
                async_admin_client,
                instance_id,
                QuestEffectsResponse(
                    applied=[{"kind": "emit_echo", "target_sim": sim["id"]}], skipped=[]
                ),
            )
            assert str(cards[0].event_id) == event["id"], (
                "the applied card links the receipt the gate actually wrote"
            )
        finally:
            admin_client.table("events").delete().eq("id", event["id"]).execute()

    async def test_empty_verdict_yields_no_cards(self, async_admin_client):
        cards = await DriftService._build_effect_cards(
            async_admin_client, uuid4(), QuestEffectsResponse(already_applied=True)
        )
        assert cards == []


class TestRunResponseLiftsSignals:
    """The signal blocks reach the HUD as TYPED fields, not as a dict to dig through.

    Every run RPC RETURNS to_jsonb(run), so a scene can only travel inside the
    checkpoint jsonb. The model lifts it (the earnings precedent from W1) — otherwise
    the HUD has to know the checkpoint's internal shape, and the shape becomes an API
    contract nobody wrote down.
    """

    def _row(self, checkpoint: dict) -> dict:
        now = "2026-07-13T00:00:00+00:00"
        return {
            "id": str(uuid4()), "user_id": str(uuid4()), "status": "active",
            "run_version": 3, "kohaerenz": 80, "bandbreite": 6, "dissonanz": 4,
            "frequency": "memory", "scale": "drift", "window_remaining": 7,
            "takt_count": 5, "checkpoint": checkpoint, "event_seq": 5,
            "opened_at": now, "created_at": now, "updated_at": now,
        }

    async def test_pending_signal_is_lifted(self):
        run = TravelRunResponse(**self._row({
            "pending_signal": {
                "template_key": "stoerung_frequenzscherung",
                "signal_class": "stoerung",
                "takt": 5,
                "prose": {"title_de": "Frequenzscherung", "title_en": "Frequency Shear",
                          "body_de": "de", "body_en": "en"},
                "options": [
                    {"key": "durchdruecken", "label_de": "drücken", "label_en": "push",
                     "check": {"vector": "architecture", "difficulty": 7}},
                    {"key": "treiben_lassen", "label_de": "treiben", "label_en": "drift",
                     "cost": {"takt": 1}},
                ],
            }
        }))
        assert run.pending_signal is not None
        assert run.pending_signal.signal_class == "stoerung"
        assert run.pending_signal.prose.title_de == "Frequenzscherung"
        assert run.pending_signal.options[0].check.vector == "architecture"
        assert run.pending_signal.options[1].cost.takt == 1
        assert run.last_signal is None

    async def test_resolved_signal_is_lifted(self):
        run = TravelRunResponse(**self._row({
            "last_signal": {
                "template_key": "stoerung_bandbreitenfrass",
                "signal_class": "stoerung",
                "option_key": "abschirmen",
                "success": True,
                "outcome": {"text_de": "de", "text_en": "en", "deltas": {"bb": 1}},
                "applied": {"bb": 1},
            }
        }))
        assert run.last_signal is not None
        assert run.last_signal.option_key == "abschirmen"
        assert run.last_signal.applied.bb == 1
        assert run.pending_signal is None

    async def test_a_p0_checkpoint_lifts_nothing(self):
        """Gate off ⇒ the fields are simply None. That IS the rollback contract."""
        run = TravelRunResponse(**self._row({"haul": 3, "visited": []}))
        assert run.pending_signal is None
        assert run.last_signal is None
        assert run.earnings is None
