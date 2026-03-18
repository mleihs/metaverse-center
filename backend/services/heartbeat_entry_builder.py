"""Shared heartbeat entry builder — single source of truth for chronicle entry dicts.

Used by: HeartbeatService, NarrativeArcService, BureauResponseService,
AttunementService, AnchorService.
"""

from __future__ import annotations

from uuid import UUID, uuid4


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
