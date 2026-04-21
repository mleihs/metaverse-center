"""Integration hooks that deposit journal fragments from other subsystems.

Each helper wraps ``FragmentService.enqueue_request`` with the source-specific
context-building logic required by the matching prompt template in
``fragment_prompts.py``. Hooks are fire-and-forget: they catch their own
failures via ``FragmentService.enqueue_request`` (Sentry + log) and never
propagate exceptions. Source systems (dungeon completion, epoch resolve,
simulation heartbeat, achievement unlock, bleed echo transform) live in hot
paths that MUST NOT be blocked by journal infrastructure.

The bond → impression hook deliberately lives on ``WhisperService`` rather
than here — it fires from a single call site, and colocation with whisper
storage avoids a round trip through this module. The hooks below serve the
inverse case: fan-in from multiple call sites (dungeon has 4 terminal
outcomes; achievement is currently dungeon-only but will expand).
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, Literal
from uuid import UUID

import sentry_sdk

from backend.services.journal.fragment_service import FragmentService
from backend.utils.db import maybe_single_data
from backend.utils.responses import extract_list
from supabase import AsyncClient as Client

if TYPE_CHECKING:
    from backend.models.resonance_dungeon import DungeonInstance

logger = logging.getLogger(__name__)

DungeonOutcome = Literal["victory", "defeat", "retreat"]

# Dimension columns on ``epoch_scores`` mapped to the label the LLM sees.
# Label is the raw English dimension (matches the scoring table names);
# the prompt template accepts any short string, so we do not force the
# narrow 'economy | espionage | diplomacy | military | culture' set
# documented in the prompt's example — that list is illustrative only.
_EPOCH_DIMENSION_COLUMNS = (
    ("stability_score", "stability"),
    ("influence_score", "influence"),
    ("sovereignty_score", "sovereignty"),
    ("diplomatic_score", "diplomacy"),
    ("military_score", "military"),
)


# ── Dungeon → Imprint ──────────────────────────────────────────────────────


def _archetype_to_slug(archetype_name: str) -> str:
    """Turn ``"The Devouring Mother"`` → ``"devouring_mother"`` for tags."""
    return archetype_name.lower().removeprefix("the ").strip().replace(" ", "_")


async def enqueue_dungeon_imprint(
    admin: Client,
    instance: DungeonInstance,
    outcome: DungeonOutcome,
) -> None:
    """Enqueue one Imprint fragment per player on a terminal dungeon run.

    Called from all four dungeon terminal sites:
      - ``DungeonCombatService._handle_combat_victory`` (no-distribution path)
      - ``DungeonDistributionService._confirm_distribution_impl`` (boss+loot)
      - ``DungeonCombatService._handle_party_wipe`` (TPK)
      - ``DungeonEngineService._retreat_locked`` (player abort)

    Multi-player runs deposit one fragment per player. The prompt template
    (``build_imprint_user_prompt``) tolerates missing optional keys, so we
    only build what's cheap from the instance. Derived state like
    ``combat_style`` and ``notable_moments`` is deferred to P5 salience.
    """
    if not instance.player_ids:
        return

    # Instance-level UUID parse happens once. If either is malformed the
    # whole enqueue fan-out is skipped — a missing sim_id/run_id would
    # produce fragments without narrative grounding, so we'd rather emit
    # nothing than emit placeholders.
    try:
        simulation_id = UUID(str(instance.simulation_id))
        run_id = UUID(str(instance.run_id))
    except (ValueError, TypeError) as err:
        logger.warning(
            "Dungeon imprint skipped: instance UUID parse failed",
            extra={
                "run_id": str(instance.run_id),
                "simulation_id": str(instance.simulation_id),
            },
        )
        sentry_sdk.capture_exception(err)
        return

    stress_final: int | None = None
    if instance.party:
        stress_final = max(agent.stress for agent in instance.party)

    context: dict[str, Any] = {
        "archetype_slug": _archetype_to_slug(instance.archetype),
        "archetype_name_en": instance.archetype,
        "outcome": outcome,
        "depth_reached": instance.depth,
    }
    if stress_final is not None:
        context["stress_final"] = stress_final

    for player_id in instance.player_ids:
        try:
            user_id = UUID(str(player_id))
        except (ValueError, TypeError) as err:
            logger.warning(
                "Dungeon imprint skipped: player UUID parse failed",
                extra={
                    "run_id": str(instance.run_id),
                    "player_id": str(player_id),
                },
            )
            sentry_sdk.capture_exception(err)
            continue

        await FragmentService.enqueue_request(
            admin,
            user_id=user_id,
            source_type="dungeon",
            source_id=run_id,
            fragment_type="imprint",
            context=context,
            simulation_id=simulation_id,
        )


# ── Epoch → Signature ──────────────────────────────────────────────────


def _pick_epoch_dimension_dominance(score_row: dict) -> str:
    """Return the label of the highest-valued dimension for this participant.

    Ties break on column order (stability > influence > sovereignty >
    diplomacy > military) — deterministic and cheap. Missing columns are
    treated as 0. Returns ``"uncertain"`` if no dimension has a positive
    value (typical for brand-new participants with no scored cycles yet).
    """
    best_label = "uncertain"
    best_value = 0.0
    for column, label in _EPOCH_DIMENSION_COLUMNS:
        raw = score_row.get(column)
        try:
            value = float(raw) if raw is not None else 0.0
        except (TypeError, ValueError):
            value = 0.0
        if value > best_value:
            best_value = value
            best_label = label
    return best_label


async def enqueue_epoch_signature(
    admin: Client,
    epoch_id: UUID,
    cycle_number: int,
) -> None:
    """Enqueue one Signature fragment per epoch participant.

    Called at the end of ``CycleResolutionService.resolve_cycle_full`` so
    scoring for this cycle is already committed. Fans out: each
    participating player's journal receives a historian's-dispatch
    fragment tagged with their dominant scoring dimension.

    Non-blocking. All DB errors degrade to "skip without enqueue" rather
    than raising — the epoch cycle pipeline is the caller's priority.
    """
    try:
        participants_resp = await (
            admin.table("epoch_participants")
            .select("simulation_id, simulations(created_by_id)")
            .eq("epoch_id", str(epoch_id))
            .execute()
        )
        participants = extract_list(participants_resp)
    except Exception as err:  # noqa: BLE001 -- fire-and-forget: journal must never block cycle resolve
        logger.warning(
            "Epoch signature skipped: failed to load participants",
            extra={"epoch_id": str(epoch_id), "cycle_number": cycle_number},
            exc_info=True,
        )
        sentry_sdk.capture_exception(err)
        return

    if not participants:
        return

    # Load per-simulation scores for this cycle in one shot.
    scores_by_sim: dict[str, dict] = {}
    try:
        score_columns = ",".join(col for col, _ in _EPOCH_DIMENSION_COLUMNS)
        scores_resp = await (
            admin.table("epoch_scores")
            .select(f"simulation_id,{score_columns}")
            .eq("epoch_id", str(epoch_id))
            .eq("cycle_number", cycle_number)
            .execute()
        )
        for row in extract_list(scores_resp):
            sim_id = row.get("simulation_id")
            if sim_id:
                scores_by_sim[str(sim_id)] = row
    except Exception:  # noqa: BLE001 -- fire-and-forget: journal must never block cycle resolve
        # Scoring load is best-effort. If it fails we fall back to the
        # "uncertain" dominance label so every participant still gets a
        # fragment — the LLM can still craft a dispatch.
        logger.debug("Epoch signature: score load failed, falling back", exc_info=True)

    for row in participants:
        sim_id_raw = row.get("simulation_id")
        sim_row = row.get("simulations") or {}
        user_id_raw = sim_row.get("created_by_id")
        if not sim_id_raw or not user_id_raw:
            continue

        try:
            user_id = UUID(str(user_id_raw))
            simulation_id = UUID(str(sim_id_raw))
        except (ValueError, TypeError) as err:
            logger.warning(
                "Epoch signature skipped: UUID parse failed",
                extra={"epoch_id": str(epoch_id), "sim_id": sim_id_raw},
            )
            sentry_sdk.capture_exception(err)
            continue

        score_row = scores_by_sim.get(str(sim_id_raw), {})
        dominance = _pick_epoch_dimension_dominance(score_row) if score_row else "uncertain"

        context: dict[str, Any] = {
            "cycle_number": cycle_number,
            "dimension_dominance": dominance,
            "competitive_position": "holding",
        }

        await FragmentService.enqueue_request(
            admin,
            user_id=user_id,
            source_type="epoch",
            source_id=epoch_id,
            fragment_type="signature",
            context=context,
            simulation_id=simulation_id,
        )


# ── Simulation → Echo ──────────────────────────────────────────────────


# Only heartbeat events at or above this significance tier emit an Echo
# fragment into the journal. Below the threshold the event is still
# recorded in ``events`` but does not cross into the journal's collective
# voice — matches concept §2.3 "when something significant has passed".
# Reference values (TRIGGERS map in autonomous_event_service):
#   stress_breakdown=8, relationship_breakdown=7, zone_crisis_reaction=7,
#   conflict_escalation=6, relationship_breakthrough=5, celebration=4,
#   community_response=4.
_ECHO_SIGNIFICANCE_THRESHOLD = 7


def _echo_severity_label(significance: int) -> str:
    """Map numeric significance to the prompt's severity vocabulary."""
    if significance >= 8:
        return "high"
    if significance >= 6:
        return "medium"
    return "low"


async def enqueue_simulation_echo(
    admin: Client,
    simulation_id: UUID,
    *,
    event_id: UUID,
    trigger_type: str,
    significance: int,
    event_summary: str,
    zone_name: str = "",
) -> None:
    """Enqueue an Echo fragment for the simulation's owner.

    Called from the autonomous-event pipeline after an event has been
    inserted + side-effects applied. Silent no-op when significance is
    below the Echo threshold — keeps the journal focused on what the
    concept calls "quiet weight, not noise".

    One Echo per significant event. The owner receives the fragment,
    even when the event was triggered by bots or scheduler state, since
    the journal is always owned by the human running the simulation.
    """
    if significance < _ECHO_SIGNIFICANCE_THRESHOLD:
        return

    # Resolve the sim owner. One query per significant event; negligible
    # cost at heartbeat rate (typically 1-2 qualifying events per tick).
    # Uses maybe_single_data wrapper per CLAUDE.md — a .single() on a
    # legitimately-deleted simulation would raise instead of returning
    # None, which is the wrong failure mode for a fire-and-forget hook.
    try:
        owner_row = await maybe_single_data(
            admin.table("simulations")
            .select("created_by_id")
            .eq("id", str(simulation_id))
            .maybe_single()
        )
    except Exception as err:  # noqa: BLE001 -- fire-and-forget
        logger.warning(
            "Simulation echo skipped: owner lookup failed",
            extra={"simulation_id": str(simulation_id), "event_id": str(event_id)},
            exc_info=True,
        )
        sentry_sdk.capture_exception(err)
        return

    owner_id_raw = (owner_row or {}).get("created_by_id")
    if not owner_id_raw:
        return

    try:
        user_id = UUID(str(owner_id_raw))
    except (ValueError, TypeError) as err:
        logger.warning(
            "Simulation echo skipped: owner UUID invalid",
            extra={"simulation_id": str(simulation_id), "owner": str(owner_id_raw)},
        )
        sentry_sdk.capture_exception(err)
        return

    # Trim summary to keep prompt token budget predictable.
    trimmed_summary = (event_summary or "").strip()[:240]

    context: dict[str, Any] = {
        "event_type": trigger_type,
        "event_summary": trimmed_summary,
        "zone_name": zone_name or "",
        "severity": _echo_severity_label(significance),
    }

    await FragmentService.enqueue_request(
        admin,
        user_id=user_id,
        source_type="simulation",
        source_id=event_id,
        fragment_type="echo",
        context=context,
        simulation_id=simulation_id,
    )


# ── Achievement → Mark ─────────────────────────────────────────────────


async def _lookup_achievement_metadata(admin: Client, slug: str) -> dict:
    """Best-effort achievement metadata lookup (name + description).

    Falls back to a synthetic dict when the lookup fails or returns
    nothing — the Mark prompt tolerates a slug-only context. Keeps the
    hook fire-and-forget.
    """
    try:
        row = await maybe_single_data(
            admin.table("achievements")
            .select("slug, name_en, description_en")
            .eq("slug", slug)
            .maybe_single()
        )
    except Exception:  # noqa: BLE001 -- fire-and-forget: journal must never block
        row = None
    if not row:
        return {"slug": slug, "name_en": slug, "description_en": ""}
    return {
        "slug": row.get("slug", slug),
        "name_en": row.get("name_en") or slug,
        "description_en": row.get("description_en") or "",
    }


async def enqueue_achievement_mark(
    admin: Client,
    *,
    user_id: UUID,
    simulation_id: UUID,
    source_id: UUID,
    achievement_slug: str,
    condition_notes: str = "",
) -> None:
    """Enqueue one Mark fragment for a freshly-awarded achievement.

    Callers MUST only invoke this when ``fn_award_achievement`` returned
    true (new award). Invoking on a duplicate award would produce a
    duplicate Mark fragment — the concept frames each Mark as a one-time
    carving, not a repeatable stamp.

    ``source_id`` identifies the event that triggered the mark. For the
    dungeon path that's the run_id. Using the run (rather than the slug)
    gives the journal UI a stable reference that links back to narrative
    context the player can revisit.
    """
    meta = await _lookup_achievement_metadata(admin, achievement_slug)

    context: dict[str, Any] = {
        "achievement_slug": meta["slug"],
        "achievement_name_en": meta["name_en"],
    }
    if meta["description_en"]:
        context["achievement_description_en"] = meta["description_en"]
    if condition_notes:
        context["condition_notes"] = condition_notes

    await FragmentService.enqueue_request(
        admin,
        user_id=user_id,
        source_type="achievement",
        source_id=source_id,
        fragment_type="mark",
        context=context,
        simulation_id=simulation_id,
    )


# ── Bleed → Tremor ─────────────────────────────────────────────────────


# Echoes below this strength are too faint to surface as journal
# tremors. Strength is in [0, 1] from EchoService.compute_echo_strength;
# 0.4 corresponds to a meaningful crossing (moderate connection +
# at least some vector alignment or embassy channel).
_TREMOR_STRENGTH_THRESHOLD = 0.4


def _tremor_significance_label(echo_strength: float) -> str:
    if echo_strength >= 0.7:
        return "high"
    return "medium"  # caller gates below-threshold via _TREMOR_STRENGTH_THRESHOLD


async def enqueue_bleed_tremor(
    admin: Client,
    echo: dict,
) -> None:
    """Enqueue a Tremor fragment for the target simulation's owner.

    Called at the end of ``EchoService.transform_and_complete_echo`` when
    an incoming bleed has successfully produced a target event — the
    moment the concept describes as "something crossed between worlds".

    The fragment writes to the RECIPIENT's journal (incoming direction).
    We deliberately do not name the source sim in the context: the
    Tremor voice is "anonymous recorder", and passing a name would push
    the LLM toward on-the-nose output.
    """
    try:
        echo_strength = float(echo.get("echo_strength") or 0.0)
    except (TypeError, ValueError):
        return

    if echo_strength < _TREMOR_STRENGTH_THRESHOLD:
        return

    target_sim_raw = echo.get("target_simulation_id")
    echo_id_raw = echo.get("id")
    if not target_sim_raw or not echo_id_raw:
        return

    try:
        target_simulation_id = UUID(str(target_sim_raw))
        echo_id = UUID(str(echo_id_raw))
    except (ValueError, TypeError) as err:
        logger.warning(
            "Bleed tremor skipped: UUID parse failed",
            extra={"echo_id": str(echo_id_raw), "target_sim": str(target_sim_raw)},
        )
        sentry_sdk.capture_exception(err)
        return

    # Resolve target sim owner. Same maybe_single_data pattern as the
    # simulation-echo hook so a deleted target simulation returns None
    # rather than raising.
    try:
        owner_row = await maybe_single_data(
            admin.table("simulations")
            .select("created_by_id")
            .eq("id", str(target_simulation_id))
            .maybe_single()
        )
    except Exception as err:  # noqa: BLE001 -- fire-and-forget
        logger.warning(
            "Bleed tremor skipped: target owner lookup failed",
            extra={"echo_id": str(echo_id), "target_sim": str(target_simulation_id)},
            exc_info=True,
        )
        sentry_sdk.capture_exception(err)
        return

    owner_id_raw = (owner_row or {}).get("created_by_id")
    if not owner_id_raw:
        return

    try:
        user_id = UUID(str(owner_id_raw))
    except (ValueError, TypeError) as err:
        sentry_sdk.capture_exception(err)
        return

    context: dict[str, Any] = {
        "direction": "incoming",
        "source_sim_hint": "a distant simulation",
        "significance_level": _tremor_significance_label(echo_strength),
    }
    vector = echo.get("echo_vector")
    if isinstance(vector, str) and vector:
        context["signature_notes"] = vector

    await FragmentService.enqueue_request(
        admin,
        user_id=user_id,
        source_type="bleed",
        source_id=echo_id,
        fragment_type="tremor",
        context=context,
        simulation_id=target_simulation_id,
    )
