"""DB table specs the DRIFT content pack owns and reseeds.

Two tables — `travel_quest_templates` (Depeschen) and
`travel_signal_templates` (M1 signals). Their surrogate `id` (UUID DEFAULT)
and `created_at` / `updated_at` (DEFAULT now()) are omitted from the INSERT
column list; the pack reseeds by the business key `template_key`, matching
migration 252's / 266's `ON CONFLICT (template_key) DO UPDATE`.

The pack owns both tables FULLY — every template lives in the YAML — so a
TRUNCATE + re-insert is safe and correct: a template deleted from YAML
vanishes from the DB. Live run state references content by a soft
`template_key TEXT` (no FK, decision baked in migration 241 and repeated for
signals in 266), so the reseed never cascades into a player's run.
"""

from __future__ import annotations

from backend.services.content_packs.table_specs import TableSpec

TRAVEL_QUEST_TEMPLATES = TableSpec(
    name="travel_quest_templates",
    columns=("template_key", "family", "tier", "pack_slug", "definition"),
    conflict_on=("template_key",),
)

TRAVEL_SIGNAL_TEMPLATES = TableSpec(
    name="travel_signal_templates",
    columns=(
        "template_key",
        "signal_class",
        "pack_slug",
        "band_weights",
        "requires",
        "definition",
    ),
    conflict_on=("template_key",),
)

# FK-safe emission order the generator iterates (mirrors dungeon
# EMISSION_ORDER). The two drift content tables are independent — neither
# references the other — so the order is merely stable, not constrained.
DRIFT_EMISSION_ORDER: tuple[TableSpec, ...] = (
    TRAVEL_QUEST_TEMPLATES,
    TRAVEL_SIGNAL_TEMPLATES,
)

__all__ = [
    "DRIFT_EMISSION_ORDER",
    "TRAVEL_QUEST_TEMPLATES",
    "TRAVEL_SIGNAL_TEMPLATES",
]
