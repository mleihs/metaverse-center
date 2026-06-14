# Drift (travel) content pack

Author-time source of truth for DRIFT game content. Mirrors the dungeon pack
pipeline (`content/dungeon/`) but for the travel domain: edit YAML here, run
the generator, apply the migration. **Do not hand-author drift content rows in
a SQL migration** — this pack is the single source of truth.

## Layout

```
content/drift/
  quests/
    deliver.yaml      # deliver Depesche templates (family = filename)
```

The quest **family** is the filename stem (`deliver.yaml` → family `deliver`);
the loader injects it, so it is never repeated per item. Future families
(`fetch`, `survey`, `investigate`, `escort`, `introduce`) join as their own
files when they ship.

## What this pack owns

Exactly one DB table: **`travel_quest_templates`**. The generator emits a
TRUNCATE + re-insert seed for it, so a template removed from YAML vanishes from
the DB. `travel_quest_instances` references templates by a soft
`template_key TEXT` (no FK — migration 241), so reseeding never touches live
run state.

World **lore** (`simulation_lore`) is **not** in this pack: that table is
shared across every world and owned by the forge, so a drift-pack reseed must
never touch it. `drift_tuning` (Kohärenz/Dissonanz balance numbers) is runtime
**config**, not content, and stays seeded in migration 246.

## Conventions

- `schema_version: 1` at the top of every file.
- Bilingual everywhere: `*_de` + `*_en` (German + English).
- En dashes only — no em dashes (U+2014).
- Prose tokens: only `{sim}` (target world name) and `{agent}` (target agent
  name) are substituted by the hospitality gate; any other `{placeholder}`
  fails validation.
- Cargo `family` ↔ `vector` is a fixed 1:1 pairing (concept §7.8); the schema
  rejects a mismatch.

## Workflow

```bash
# 1. Edit content/drift/quests/*.yaml

# 2. Validate (also runs in CI):
.venv/bin/python scripts/validate_content_packs.py --domain drift --strict

# 3. Regenerate the seed migration:
.venv/bin/python -m backend.services.content_packs.generate_drift_migration \
  --output supabase/migrations/<ts>_<n>_drift_content_seed.sql

# 4. Apply locally:
supabase migration up --local
```
