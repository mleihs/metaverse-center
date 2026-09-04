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
    # Added 2026-09-02 (Migration 343). Phase 9.7: ein Agent verdichtet, was er
    # gesehen hat, zu einer Einsicht. Vorher lief die Verdichtung an keinem
    # Tick — fuenf Verdichtungen gegen 300 Beobachtungen auf Prod.
    "memory_reflection",
    # Added 2026-09-04 (Migration 362). Phase 9.8: Agenten haben in einem Faden
    # ohne den Menschen weitergeredet. Die Zeile ist die einzige Spur davon im
    # Herzschlag — der Wortwechsel selbst steht im Gespraech.
    "agent_continuation",
)


# ── Das Zustandsvokabular der Chronik ────────────────────────────────────────
#
# Der deutsche Chroniktext ist keine Übersetzung des englischen, sondern ein
# zweiter, gleichrangiger Text — beide werden an derselben Stelle von Hand
# geschrieben. Genau deshalb ist die Fehlerart hier eine besondere: es fällt
# nichts aus, wenn im deutschen Satz ein englischer Statusname stehen bleibt.
# Der Satz ist grammatisch heil, er liest sich nur halb.
#
# Gemessen am 31.08.2026 per AST über alle 17 `make_heartbeat_entry`-Aufrufe
# der `HeartbeatService`: VIER deutsche Erzähltexte interpolierten einen
# englischen Bezeichner — `{direction}` („deepening"/„healing"),
# `{new_status}`, `{old_status}` und `{evt_type}`. Der Prüfbericht führte
# eine davon. Die anderen drei standen unmittelbar neben Stellen, an denen
# derselbe Autor das Paar `pressure_msg`/`druck_msg` bereits von Hand gebildet
# hatte — die Form war also bekannt, sie wurde nur nicht durchgehalten. Und das
# ist der Grund, warum das hier eine TABELLE wird und keine fünfte Ternärzeile:
# ein Paar, das man von Hand bildet, bildet man irgendwo nicht.
#
# Wer einen neuen Status einführt, ergänzt ihn hier; `_de` fällt auf den
# englischen Wert zurück, damit ein fehlender Eintrag einen sichtbaren Rest
# hinterlässt und keine leere Lücke im Satz.
_STATE_WORDS_DE: Final[dict[str, str]] = {
    # Ereignis-Lebenslauf (events.status)
    "active": "aktiv",
    "escalating": "eskalierend",
    "resolving": "in Auflösung",
    "resolved": "aufgelöst",
    "archived": "archiviert",
    # Narbengewebe-Richtung
    "deepening": "vertieft sich",
    "healing": "heilt",
    # Beziehungsschwellen (agent_opinion_service)
    "relationship_breakthrough": "Durchbruch",
    "relationship_breakdown": "Bruch",
}


def state_word_de(value: str) -> str:
    """Deutsches Wort für einen Zustandsbezeichner der Chronik.

    Rückfall auf den Bezeichner selbst: ein unbekannter Status soll im
    deutschen Satz sichtbar bleiben (und damit auffindbar), nicht verschwinden.
    """
    return _STATE_WORDS_DE.get(value, value)


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
