"""DB table spec(s) the DRIFT content pack owns and reseeds.

Currently one table — `travel_quest_templates`. Its surrogate `id` (UUID
DEFAULT) and `created_at` / `updated_at` (DEFAULT now()) are omitted from the
INSERT column list; the pack reseeds by the business key `template_key`,
matching migration 252's `ON CONFLICT (template_key) DO UPDATE`.

The pack owns this table FULLY — every template lives in the YAML — so a
TRUNCATE + re-insert is safe and correct: a template deleted from YAML
vanishes from the DB. `travel_quest_instances` references templates by a soft
`template_key TEXT` (no FK, decision baked in migration 241), so the reseed
never cascades into live run state.
"""

from __future__ import annotations

from backend.services.content_packs.table_specs import TableSpec

TRAVEL_QUEST_TEMPLATES = TableSpec(
    name="travel_quest_templates",
    columns=("template_key", "family", "tier", "pack_slug", "definition"),
    conflict_on=("template_key",),
)

# FK-safe emission order the generator iterates (mirrors dungeon
# EMISSION_ORDER). Single table today; future families/cargo tables append.
DRIFT_EMISSION_ORDER: tuple[TableSpec, ...] = (TRAVEL_QUEST_TEMPLATES,)

__all__ = ["DRIFT_EMISSION_ORDER", "TRAVEL_QUEST_TEMPLATES"]
