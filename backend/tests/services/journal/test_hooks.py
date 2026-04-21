"""Unit tests for the journal integration hooks (P1 Stage 2).

Each hook helper wraps ``FragmentService.enqueue_request`` with
source-specific context-building. Tests patch the underlying
``enqueue_request`` so we verify the hook's argument shape without
touching the DB or the LLM. Fire-and-forget semantics mean the hooks
never raise; we assert enqueue was (or was not) called, and on guard
paths we additionally confirm the helper stayed silent.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from backend.services.journal.hooks import (
    _archetype_to_slug,
    _echo_severity_label,
    _pick_epoch_dimension_dominance,
    _tremor_significance_label,
    enqueue_achievement_mark,
    enqueue_bleed_tremor,
    enqueue_dungeon_imprint,
    enqueue_epoch_signature,
    enqueue_simulation_echo,
)

# ── Helper: build a minimal DungeonInstance-like object ────────────────


def _make_instance(
    *,
    archetype: str = "The Shadow",
    depth: int = 3,
    player_ids: list | None = None,
    party_stress: list[int] | None = None,
    run_id=None,
    simulation_id=None,
) -> SimpleNamespace:
    """Build a stand-in DungeonInstance with the attrs the hook reads.

    The hook only touches a narrow attribute surface; a ``SimpleNamespace``
    is lighter than materialising a full Pydantic instance and avoids
    pulling the combat model graph into every test.
    """
    return SimpleNamespace(
        archetype=archetype,
        depth=depth,
        player_ids=player_ids if player_ids is not None else [uuid4()],
        party=[SimpleNamespace(stress=s) for s in (party_stress or [120, 340])],
        run_id=run_id or uuid4(),
        simulation_id=simulation_id or uuid4(),
    )


# ── _archetype_to_slug ─────────────────────────────────────────────────


def test_archetype_slug_strips_the_prefix():
    assert _archetype_to_slug("The Shadow") == "shadow"
    assert _archetype_to_slug("The Tower") == "tower"


def test_archetype_slug_multiword():
    assert _archetype_to_slug("The Devouring Mother") == "devouring_mother"


# ── Dungeon → Imprint ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_dungeon_imprint_enqueues_on_victory():
    admin = MagicMock()
    player_id = uuid4()
    sim_id = uuid4()
    run_id = uuid4()
    instance = _make_instance(
        archetype="The Shadow",
        depth=4,
        player_ids=[player_id],
        party_stress=[120, 580],
        run_id=run_id,
        simulation_id=sim_id,
    )

    with patch(
        "backend.services.journal.hooks.FragmentService.enqueue_request",
        new=AsyncMock(),
    ) as enqueue:
        await enqueue_dungeon_imprint(admin, instance, outcome="victory")

        enqueue.assert_called_once()
        kwargs = enqueue.call_args.kwargs
        assert kwargs["source_type"] == "dungeon"
        assert kwargs["fragment_type"] == "imprint"
        assert str(kwargs["user_id"]) == str(player_id)
        assert str(kwargs["simulation_id"]) == str(sim_id)
        assert str(kwargs["source_id"]) == str(run_id)
        ctx = kwargs["context"]
        assert ctx["archetype_slug"] == "shadow"
        assert ctx["archetype_name_en"] == "The Shadow"
        assert ctx["outcome"] == "victory"
        assert ctx["depth_reached"] == 4
        assert ctx["stress_final"] == 580  # peak of [120, 580]


@pytest.mark.asyncio
async def test_dungeon_imprint_fires_per_player_in_multiplayer():
    """Multi-player runs deposit one fragment per player (mirrors the
    badge-award pattern in ``dungeon_achievements._award``)."""
    admin = MagicMock()
    p1, p2 = uuid4(), uuid4()
    instance = _make_instance(player_ids=[p1, p2])

    with patch(
        "backend.services.journal.hooks.FragmentService.enqueue_request",
        new=AsyncMock(),
    ) as enqueue:
        await enqueue_dungeon_imprint(admin, instance, outcome="victory")
        assert enqueue.call_count == 2
        user_ids = {str(call.kwargs["user_id"]) for call in enqueue.call_args_list}
        assert user_ids == {str(p1), str(p2)}


@pytest.mark.asyncio
async def test_dungeon_imprint_noop_when_player_ids_empty():
    """Solo runs without a registered player (e.g. admin-debug instances)
    should not enqueue — there is no recipient for the fragment."""
    admin = MagicMock()
    instance = _make_instance(player_ids=[])

    with patch(
        "backend.services.journal.hooks.FragmentService.enqueue_request",
        new=AsyncMock(),
    ) as enqueue:
        await enqueue_dungeon_imprint(admin, instance, outcome="defeat")
        enqueue.assert_not_called()


@pytest.mark.asyncio
async def test_dungeon_imprint_propagates_outcome_literal():
    """The prompt template branches on outcome (victory/defeat/retreat) —
    the hook must pass the caller's outcome through verbatim."""
    admin = MagicMock()
    instance = _make_instance()

    with patch(
        "backend.services.journal.hooks.FragmentService.enqueue_request",
        new=AsyncMock(),
    ) as enqueue:
        await enqueue_dungeon_imprint(admin, instance, outcome="retreat")
        assert enqueue.call_args.kwargs["context"]["outcome"] == "retreat"


@pytest.mark.asyncio
async def test_dungeon_imprint_omits_stress_when_party_empty():
    """A wipe at room 0 with zero operational agents can have an empty
    party — the context should still build, just without stress_final."""
    admin = MagicMock()
    instance = _make_instance()
    instance.party = []

    with patch(
        "backend.services.journal.hooks.FragmentService.enqueue_request",
        new=AsyncMock(),
    ) as enqueue:
        await enqueue_dungeon_imprint(admin, instance, outcome="defeat")
        enqueue.assert_called_once()
        ctx = enqueue.call_args.kwargs["context"]
        assert "stress_final" not in ctx
        assert ctx["outcome"] == "defeat"


# ── _pick_epoch_dimension_dominance ────────────────────────────────────


def test_epoch_dominance_picks_max_column():
    row = {
        "stability_score": 10,
        "influence_score": 45,
        "sovereignty_score": 30,
        "diplomatic_score": 20,
        "military_score": 5,
    }
    assert _pick_epoch_dimension_dominance(row) == "influence"


def test_epoch_dominance_ties_break_by_column_order():
    row = {
        "stability_score": 50,
        "influence_score": 50,
        "sovereignty_score": 0,
        "diplomatic_score": 0,
        "military_score": 0,
    }
    # Strictly-greater comparison → first-in-column-order wins
    assert _pick_epoch_dimension_dominance(row) == "stability"


def test_epoch_dominance_empty_row_returns_uncertain():
    assert _pick_epoch_dimension_dominance({}) == "uncertain"


def test_epoch_dominance_handles_non_numeric():
    """Non-numeric score values coerce to 0 rather than crashing."""
    row = {"stability_score": "garbled", "influence_score": 42}
    assert _pick_epoch_dimension_dominance(row) == "influence"


# ── Epoch → Signature ──────────────────────────────────────────────────


def _fake_admin_for_epoch(
    *,
    participants: list[dict] | None = None,
    participants_err: Exception | None = None,
    scores: list[dict] | None = None,
    scores_err: Exception | None = None,
):
    """Build a minimal admin-client double that only answers the two
    queries the epoch hook makes (epoch_participants + epoch_scores).

    The hook's postgrest-builder chain is straightforward: a final
    ``.execute()`` returns an object with a ``.data`` attribute. We mock
    the terminal execute result per table."""

    class _Resp:
        def __init__(self, data):
            self.data = data
            self.count = None

    class _Chain:
        def __init__(self, resp_or_err):
            self._resp_or_err = resp_or_err

        def select(self, *_a, **_kw):
            return self

        def eq(self, *_a, **_kw):
            return self

        async def execute(self):
            if isinstance(self._resp_or_err, Exception):
                raise self._resp_or_err
            return self._resp_or_err

    def table(name: str):
        if name == "epoch_participants":
            return _Chain(
                participants_err
                if participants_err
                else _Resp(participants or [])
            )
        if name == "epoch_scores":
            return _Chain(scores_err if scores_err else _Resp(scores or []))
        raise AssertionError(f"unexpected table: {name}")

    admin = MagicMock()
    admin.table.side_effect = table
    return admin


@pytest.mark.asyncio
async def test_epoch_signature_enqueues_per_participant_with_dominance():
    user_a, user_b = uuid4(), uuid4()
    sim_a, sim_b = uuid4(), uuid4()
    epoch_id = uuid4()
    admin = _fake_admin_for_epoch(
        participants=[
            {"simulation_id": str(sim_a), "simulations": {"created_by_id": str(user_a)}},
            {"simulation_id": str(sim_b), "simulations": {"created_by_id": str(user_b)}},
        ],
        scores=[
            {
                "simulation_id": str(sim_a),
                "stability_score": 80,
                "influence_score": 20,
                "sovereignty_score": 10,
                "diplomatic_score": 5,
                "military_score": 5,
            },
            {
                "simulation_id": str(sim_b),
                "stability_score": 10,
                "influence_score": 10,
                "sovereignty_score": 10,
                "diplomatic_score": 10,
                "military_score": 75,
            },
        ],
    )

    with patch(
        "backend.services.journal.hooks.FragmentService.enqueue_request",
        new=AsyncMock(),
    ) as enqueue:
        await enqueue_epoch_signature(admin, epoch_id, cycle_number=7)

        assert enqueue.call_count == 2
        by_user = {str(c.kwargs["user_id"]): c.kwargs for c in enqueue.call_args_list}
        assert by_user[str(user_a)]["context"]["dimension_dominance"] == "stability"
        assert by_user[str(user_b)]["context"]["dimension_dominance"] == "military"
        for kwargs in by_user.values():
            assert kwargs["source_type"] == "epoch"
            assert kwargs["fragment_type"] == "signature"
            assert kwargs["context"]["cycle_number"] == 7
            assert str(kwargs["source_id"]) == str(epoch_id)


@pytest.mark.asyncio
async def test_epoch_signature_noop_when_no_participants():
    admin = _fake_admin_for_epoch(participants=[])
    with patch(
        "backend.services.journal.hooks.FragmentService.enqueue_request",
        new=AsyncMock(),
    ) as enqueue:
        await enqueue_epoch_signature(admin, uuid4(), cycle_number=1)
        enqueue.assert_not_called()


@pytest.mark.asyncio
async def test_epoch_signature_skips_participant_without_user_id():
    """A participant row whose simulation is missing created_by_id
    (e.g. a migrated-owner edge case) must be skipped, not crashed on."""
    admin = _fake_admin_for_epoch(
        participants=[
            {"simulation_id": str(uuid4()), "simulations": {"created_by_id": None}},
        ],
    )
    with patch(
        "backend.services.journal.hooks.FragmentService.enqueue_request",
        new=AsyncMock(),
    ) as enqueue:
        await enqueue_epoch_signature(admin, uuid4(), cycle_number=1)
        enqueue.assert_not_called()


@pytest.mark.asyncio
async def test_epoch_signature_falls_back_when_scores_missing():
    """If the scoring step failed but participants loaded, each player
    still gets a fragment — dominance defaults to 'uncertain' rather
    than dropping the emission entirely."""
    sim = uuid4()
    user = uuid4()
    admin = _fake_admin_for_epoch(
        participants=[
            {"simulation_id": str(sim), "simulations": {"created_by_id": str(user)}},
        ],
        scores=[],  # no score row for this cycle
    )
    with patch(
        "backend.services.journal.hooks.FragmentService.enqueue_request",
        new=AsyncMock(),
    ) as enqueue:
        await enqueue_epoch_signature(admin, uuid4(), cycle_number=3)
        enqueue.assert_called_once()
        ctx = enqueue.call_args.kwargs["context"]
        assert ctx["dimension_dominance"] == "uncertain"


@pytest.mark.asyncio
async def test_epoch_signature_silent_on_participants_query_failure():
    """Participants-query failure must not propagate. Priority is the
    epoch cycle pipeline completing — journal is best-effort."""
    admin = _fake_admin_for_epoch(
        participants_err=RuntimeError("db down"),
    )
    with patch(
        "backend.services.journal.hooks.FragmentService.enqueue_request",
        new=AsyncMock(),
    ) as enqueue:
        # No raise.
        await enqueue_epoch_signature(admin, uuid4(), cycle_number=1)
        enqueue.assert_not_called()


# ── _echo_severity_label ───────────────────────────────────────────────


def test_echo_severity_maps_significance_to_three_tiers():
    assert _echo_severity_label(9) == "high"
    assert _echo_severity_label(8) == "high"
    assert _echo_severity_label(7) == "medium"
    assert _echo_severity_label(6) == "medium"
    assert _echo_severity_label(5) == "low"
    assert _echo_severity_label(0) == "low"


# ── Simulation → Echo ──────────────────────────────────────────────────


def _fake_admin_for_simulation_owner(owner_id_raw):
    """Admin-client double that answers the single simulation-owner
    lookup the simulation echo hook performs via maybe_single_data."""

    class _Chain:
        def select(self, *_a, **_kw):
            return self

        def eq(self, *_a, **_kw):
            return self

        def maybe_single(self):
            return self

        async def execute(self):
            # Mirror postgrest.maybe_single() on 0-rows: data=None.
            if owner_id_raw is None:
                resp = MagicMock()
                resp.data = None
                return resp
            resp = MagicMock()
            resp.data = {"created_by_id": owner_id_raw}
            return resp

    admin = MagicMock()
    admin.table.return_value = _Chain()
    return admin


@pytest.mark.asyncio
async def test_simulation_echo_below_threshold_no_lookup():
    """Below significance=7 we should skip without even hitting the DB."""
    admin = MagicMock()  # would error if .table() is called
    admin.table.side_effect = AssertionError("owner lookup must not fire below threshold")

    with patch(
        "backend.services.journal.hooks.FragmentService.enqueue_request",
        new=AsyncMock(),
    ) as enqueue:
        await enqueue_simulation_echo(
            admin,
            uuid4(),
            event_id=uuid4(),
            trigger_type="celebration",
            significance=4,
            event_summary="Happy people",
        )
        enqueue.assert_not_called()


@pytest.mark.asyncio
async def test_simulation_echo_enqueues_with_expected_context():
    sim_id = uuid4()
    event_id = uuid4()
    owner_id = uuid4()
    admin = _fake_admin_for_simulation_owner(str(owner_id))

    with patch(
        "backend.services.journal.hooks.FragmentService.enqueue_request",
        new=AsyncMock(),
    ) as enqueue:
        await enqueue_simulation_echo(
            admin,
            sim_id,
            event_id=event_id,
            trigger_type="stress_breakdown",
            significance=8,
            event_summary="Mira has reached a breaking point. Accumulated pressure crossed the threshold.",
            zone_name="Hafenviertel",
        )

        enqueue.assert_called_once()
        kwargs = enqueue.call_args.kwargs
        assert kwargs["source_type"] == "simulation"
        assert kwargs["fragment_type"] == "echo"
        assert str(kwargs["source_id"]) == str(event_id)
        assert str(kwargs["user_id"]) == str(owner_id)
        assert str(kwargs["simulation_id"]) == str(sim_id)
        ctx = kwargs["context"]
        assert ctx["event_type"] == "stress_breakdown"
        assert ctx["severity"] == "high"
        assert ctx["zone_name"] == "Hafenviertel"
        assert ctx["event_summary"].startswith("Mira has reached")


@pytest.mark.asyncio
async def test_simulation_echo_trims_long_summary():
    """Long event descriptions must be trimmed to 240 chars to keep the
    prompt token budget predictable — LLM input cost is the main lever
    on this path's operating cost."""
    admin = _fake_admin_for_simulation_owner(str(uuid4()))
    long_summary = "x" * 500

    with patch(
        "backend.services.journal.hooks.FragmentService.enqueue_request",
        new=AsyncMock(),
    ) as enqueue:
        await enqueue_simulation_echo(
            admin,
            uuid4(),
            event_id=uuid4(),
            trigger_type="zone_crisis_reaction",
            significance=7,
            event_summary=long_summary,
        )
        ctx = enqueue.call_args.kwargs["context"]
        assert len(ctx["event_summary"]) == 240


@pytest.mark.asyncio
async def test_simulation_echo_skips_when_owner_missing():
    """A sim with no created_by_id (migration-edge state) should not
    enqueue — the fragment has no recipient."""
    admin = _fake_admin_for_simulation_owner(None)
    with patch(
        "backend.services.journal.hooks.FragmentService.enqueue_request",
        new=AsyncMock(),
    ) as enqueue:
        await enqueue_simulation_echo(
            admin,
            uuid4(),
            event_id=uuid4(),
            trigger_type="stress_breakdown",
            significance=8,
            event_summary="…",
        )
        enqueue.assert_not_called()


@pytest.mark.asyncio
async def test_simulation_echo_silent_on_owner_lookup_failure():
    """Owner-lookup failure must not propagate — heartbeat tick is the
    caller's priority."""

    class _FailingChain:
        def select(self, *_a, **_kw):
            return self

        def eq(self, *_a, **_kw):
            return self

        def maybe_single(self):
            return self

        async def execute(self):
            raise RuntimeError("connection dropped")

    admin = MagicMock()
    admin.table.return_value = _FailingChain()

    with patch(
        "backend.services.journal.hooks.FragmentService.enqueue_request",
        new=AsyncMock(),
    ) as enqueue:
        # No raise.
        await enqueue_simulation_echo(
            admin,
            uuid4(),
            event_id=uuid4(),
            trigger_type="stress_breakdown",
            significance=8,
            event_summary="…",
        )
        enqueue.assert_not_called()


# ── Achievement → Mark ─────────────────────────────────────────────────


def _fake_admin_for_achievement_lookup(row: dict | None):
    """Admin-client double that answers only the achievement metadata
    lookup via maybe_single_data."""

    class _Chain:
        def select(self, *_a, **_kw):
            return self

        def eq(self, *_a, **_kw):
            return self

        def maybe_single(self):
            return self

        async def execute(self):
            resp = MagicMock()
            resp.data = row
            return resp

    admin = MagicMock()
    admin.table.return_value = _Chain()
    return admin


@pytest.mark.asyncio
async def test_achievement_mark_enqueues_with_lookup_metadata():
    user_id = uuid4()
    sim_id = uuid4()
    run_id = uuid4()
    admin = _fake_admin_for_achievement_lookup(
        {
            "slug": "the_remnant",
            "name_en": "The Remnant",
            "description_en": "Defeat the Shadow boss at visibility 0.",
        }
    )

    with patch(
        "backend.services.journal.hooks.FragmentService.enqueue_request",
        new=AsyncMock(),
    ) as enqueue:
        await enqueue_achievement_mark(
            admin,
            user_id=user_id,
            simulation_id=sim_id,
            source_id=run_id,
            achievement_slug="the_remnant",
            condition_notes="The Shadow at depth 4",
        )

        enqueue.assert_called_once()
        kwargs = enqueue.call_args.kwargs
        assert kwargs["source_type"] == "achievement"
        assert kwargs["fragment_type"] == "mark"
        assert str(kwargs["user_id"]) == str(user_id)
        assert str(kwargs["source_id"]) == str(run_id)
        ctx = kwargs["context"]
        assert ctx["achievement_slug"] == "the_remnant"
        assert ctx["achievement_name_en"] == "The Remnant"
        assert ctx["achievement_description_en"].startswith("Defeat the Shadow")
        assert ctx["condition_notes"] == "The Shadow at depth 4"


@pytest.mark.asyncio
async def test_achievement_mark_slug_fallback_when_lookup_returns_none():
    """Missing metadata (unknown slug, stale DB) must not block the Mark
    emission — the prompt tolerates a slug-only context."""
    admin = _fake_admin_for_achievement_lookup(None)

    with patch(
        "backend.services.journal.hooks.FragmentService.enqueue_request",
        new=AsyncMock(),
    ) as enqueue:
        await enqueue_achievement_mark(
            admin,
            user_id=uuid4(),
            simulation_id=uuid4(),
            source_id=uuid4(),
            achievement_slug="unknown_slug",
        )
        enqueue.assert_called_once()
        ctx = enqueue.call_args.kwargs["context"]
        assert ctx["achievement_slug"] == "unknown_slug"
        assert ctx["achievement_name_en"] == "unknown_slug"
        assert "achievement_description_en" not in ctx  # empty desc is pruned
        assert "condition_notes" not in ctx


@pytest.mark.asyncio
async def test_achievement_mark_preserves_name_but_prunes_empty_description():
    """Half-filled row: name present but description empty. Mark should
    include the name and silently drop the empty description."""
    admin = _fake_admin_for_achievement_lookup(
        {"slug": "pacifist", "name_en": "Pacifist", "description_en": ""}
    )
    with patch(
        "backend.services.journal.hooks.FragmentService.enqueue_request",
        new=AsyncMock(),
    ) as enqueue:
        await enqueue_achievement_mark(
            admin,
            user_id=uuid4(),
            simulation_id=uuid4(),
            source_id=uuid4(),
            achievement_slug="pacifist",
        )
        ctx = enqueue.call_args.kwargs["context"]
        assert ctx["achievement_name_en"] == "Pacifist"
        assert "achievement_description_en" not in ctx


# ── _tremor_significance_label ─────────────────────────────────────────


def test_tremor_significance_bands():
    # Above-threshold strengths map to medium or high only.
    assert _tremor_significance_label(0.41) == "medium"
    assert _tremor_significance_label(0.69) == "medium"
    assert _tremor_significance_label(0.70) == "high"
    assert _tremor_significance_label(1.00) == "high"


# ── Bleed → Tremor ─────────────────────────────────────────────────────


def _make_echo(
    *,
    echo_strength=0.5,
    target_sim=None,
    source_sim=None,
    echo_id=None,
    echo_vector="memory",
):
    return {
        "id": str(echo_id or uuid4()),
        "echo_strength": echo_strength,
        "target_simulation_id": str(target_sim or uuid4()),
        "source_simulation_id": str(source_sim or uuid4()),
        "echo_vector": echo_vector,
    }


@pytest.mark.asyncio
async def test_tremor_skips_below_threshold():
    """Faint echoes (strength < 0.4) stay out of the journal — the
    crossing wasn't palpable enough to register."""
    admin = MagicMock()
    admin.table.side_effect = AssertionError("owner lookup must not fire below threshold")
    echo = _make_echo(echo_strength=0.35)

    with patch(
        "backend.services.journal.hooks.FragmentService.enqueue_request",
        new=AsyncMock(),
    ) as enqueue:
        await enqueue_bleed_tremor(admin, echo)
        enqueue.assert_not_called()


@pytest.mark.asyncio
async def test_tremor_enqueues_incoming_for_target_owner():
    target_owner = uuid4()
    target_sim = uuid4()
    echo_id = uuid4()
    admin = _fake_admin_for_simulation_owner(str(target_owner))
    echo = _make_echo(
        echo_strength=0.82,
        target_sim=target_sim,
        echo_id=echo_id,
        echo_vector="resonance",
    )

    with patch(
        "backend.services.journal.hooks.FragmentService.enqueue_request",
        new=AsyncMock(),
    ) as enqueue:
        await enqueue_bleed_tremor(admin, echo)
        enqueue.assert_called_once()
        kwargs = enqueue.call_args.kwargs
        assert kwargs["source_type"] == "bleed"
        assert kwargs["fragment_type"] == "tremor"
        assert str(kwargs["user_id"]) == str(target_owner)
        assert str(kwargs["simulation_id"]) == str(target_sim)
        assert str(kwargs["source_id"]) == str(echo_id)
        ctx = kwargs["context"]
        assert ctx["direction"] == "incoming"
        assert ctx["significance_level"] == "high"
        # Source sim is NOT revealed — Tremor voice is anonymous recorder.
        assert ctx["source_sim_hint"] == "a distant simulation"
        assert ctx["signature_notes"] == "resonance"


@pytest.mark.asyncio
async def test_tremor_omits_vector_when_missing():
    admin = _fake_admin_for_simulation_owner(str(uuid4()))
    echo = _make_echo(echo_strength=0.5)
    echo["echo_vector"] = None

    with patch(
        "backend.services.journal.hooks.FragmentService.enqueue_request",
        new=AsyncMock(),
    ) as enqueue:
        await enqueue_bleed_tremor(admin, echo)
        enqueue.assert_called_once()
        ctx = enqueue.call_args.kwargs["context"]
        assert "signature_notes" not in ctx


@pytest.mark.asyncio
async def test_tremor_noop_when_target_owner_missing():
    admin = _fake_admin_for_simulation_owner(None)
    with patch(
        "backend.services.journal.hooks.FragmentService.enqueue_request",
        new=AsyncMock(),
    ) as enqueue:
        await enqueue_bleed_tremor(admin, _make_echo(echo_strength=0.5))
        enqueue.assert_not_called()


@pytest.mark.asyncio
async def test_tremor_noop_on_non_numeric_strength():
    """Defense in depth: a malformed echo row with non-numeric strength
    should not crash — just skip the emission."""
    admin = MagicMock()
    admin.table.side_effect = AssertionError("should not fire for malformed echo")
    echo = _make_echo()
    echo["echo_strength"] = "not a number"

    with patch(
        "backend.services.journal.hooks.FragmentService.enqueue_request",
        new=AsyncMock(),
    ) as enqueue:
        await enqueue_bleed_tremor(admin, echo)
        enqueue.assert_not_called()
