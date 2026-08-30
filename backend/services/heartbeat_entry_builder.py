"""Shared heartbeat entry builder — single source of truth for chronicle entry dicts.

Used by: HeartbeatService, NarrativeArcService, BureauResponseService,
AttunementService, AnchorService.
"""

from __future__ import annotations

from typing import Final
from uuid import UUID, uuid4

# ── The entry-type vocabulary ────────────────────────────────────────────────
#
# `heartbeat_entries.entry_type` carries a CHECK constraint. A value the CHECK
# does not know does not fail one row — it fails the whole tick, because every
# entry of a tick goes in ONE batch insert. The tick is marked failed,
# `last_heartbeat_tick` does not advance, and the next attempt fails identically
# on the same input. A world in that state is frozen, not degraded.
#
# THIS HAS HAPPENED BEFORE. Migration 186 exists because `resonance_mood` was
# added to the code after the CHECK was written: Sentry METAVERSE_CENTER-27, ten
# events, all on tick #52. Nothing was put in place afterwards to stop the next
# one, and the next one was `bond_whisper` (migration 219 created the
# `bond_whispers` TABLE and never touched the CHECK). Measured on production
# 2026-08-30: the live constraint held 20 values, the code emitted 21.
#
# So the vocabulary is declared here, in the one module every entry is built by,
# and the migration's CHECK list is generated from it.
# `backend/tests/unit/test_heartbeat_entry_types.py` binds all three by AST and
# by text: every literal type passed to `make_heartbeat_entry` must be declared,
# and the CHECK in the migration must equal the declaration exactly.
HEARTBEAT_ENTRY_TYPES: Final[tuple[str, ...]] = (
    "zone_shift",
    "event_aging",
    "event_escalation",
    "event_resolution",
    "scar_tissue",
    "resonance_pressure",
    "resonance_mood",
    "cascade_spawn",
    "bureau_response",
    "attunement_deepen",
    "anchor_strengthen",
    "convergence",
    "positive_event",
    "narrative_arc",
    "system_note",
    "agent_crisis",
    "relationship_shift",
    "social_event",
    "autonomous_event",
    "ambient_weather",
    # Added 2026-08-30 (migration 285). Emitted by `HeartbeatService` phase 10
    # since the Agent Bonds work; the CHECK never learned it.
    "bond_whisper",
)


def make_heartbeat_entry(
    heartbeat_id: UUID,
    sim_id: UUID,
    tick_number: int,
    entry_type: str,
    narrative_en: str,
    narrative_de: str,
    severity: str = "info",
    metadata: dict | None = None,
) -> dict:
    """Build a heartbeat_entries row dict.

    Args:
        heartbeat_id: Parent heartbeat record.
        sim_id: Simulation this entry belongs to.
        tick_number: Current tick number.
        entry_type: One of the heartbeat entry type enum values.
        narrative_en: English narrative text.
        narrative_de: German narrative text.
        severity: info | warning | critical | positive.
        metadata: Optional JSON metadata dict.
    """
    return {
        "id": str(uuid4()),
        "heartbeat_id": str(heartbeat_id),
        "simulation_id": str(sim_id),
        "tick_number": tick_number,
        "entry_type": entry_type,
        "narrative_en": narrative_en,
        "narrative_de": narrative_de,
        "metadata": metadata or {},
        "severity": severity,
    }
