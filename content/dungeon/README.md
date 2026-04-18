# Dungeon Content Packs

Versioned, bilingual (en/de) authoring source for dungeon content. Files here
are the **canonical authoring source**; the runtime database is seeded from
them via `backend.services.content_packs.generate_migration`.

## Layout

```
content/dungeon/
├── archetypes/
│   ├── shadow/              # The Shadow
│   │   ├── encounters.yaml
│   │   ├── banter.yaml
│   │   ├── loot.yaml
│   │   ├── enemies.yaml
│   │   ├── spawns.yaml
│   │   ├── anchors.yaml
│   │   ├── entrance_texts.yaml
│   │   └── barometer_texts.yaml
│   ├── tower/               # The Tower
│   ├── mother/              # The Devouring Mother
│   ├── entropy/             # The Entropy
│   ├── prometheus/          # The Prometheus
│   ├── deluge/              # The Deluge
│   ├── awakening/           # The Awakening
│   └── overthrow/           # The Overthrow
└── abilities/
    ├── spy.yaml
    ├── guardian.yaml
    └── {school}.yaml
```

The archetype slug → canonical name mapping lives in
`backend/services/content_packs/schemas.py::ARCHETYPE_SLUG_TO_NAME`.

## Pipeline

```
YAML pack → Pydantic validate (loader.py)
         → ContentCache (matches runtime cache shape)
         → generate_migration.py → SQL seed → DB migration
                                            → dungeon_content_service reads at runtime
```

## Authoring rules

- **Bilingual everywhere.** Every user-facing string has a matching `text_en` /
  `text_de` pair (or `description_en` / `description_de`, etc.). A change to
  one without the other is a validation error.
- **No em dashes (—, U+2014).** Use en dashes (–, U+2013). An em-dash lint
  gate enforces this in CI.
- **S-tier prose standard.** The literary bar is set by the Shadow/Tower/Mother
  archetypes. Cross-reference `docs/concepts/dungeon-literary-influences.md` and
  the per-archetype research docs in `docs/research/` before authoring.
- **IDs are globally unique per content type.** Banter, encounter, enemy, loot,
  and ability IDs must not collide across archetypes. The validator fails loud
  on duplicates.
- **`schema_version: 1`** must be the first key of every pack file. Increment
  when the pack schema changes incompatibly; ship a one-shot upgrade script
  alongside.
- **`archetype` is implicit** via directory path. Do NOT repeat `archetype:
  "The Shadow"` inside `archetypes/shadow/*.yaml` — the loader injects it.

## IDE support

Each pack file begins with a `yaml-language-server` directive pointing at a
JSON Schema generated from the Pydantic models (`content/schema/`). Install
the "YAML" extension in VSCode for autocomplete + inline validation.

```yaml
# yaml-language-server: $schema=../../schema/encounter_pack.schema.json
schema_version: 1
encounters:
  - id: shadow_whispers_in_dark
    room_type: combat
    min_depth: 1
    max_depth: 2
    min_difficulty: 1
    description_en: |
      The air thickens. Two points of cold light drift at the edges of
      your vision, circling like predators testing prey.
    description_de: |
      Die Luft wird dicker. Zwei Punkte kalten Lichts treiben am Rand
      eures Blickfelds, kreisen wie Raubtiere, die Beute testen.
    combat_encounter_id: shadow_whispers_spawn
```

## Validation

Run locally before committing:

```bash
.venv/bin/python scripts/validate_content_packs.py
```

CI runs the same script on every PR touching `content/**/*.yaml`.

## Regenerating the DB seed

After editing content, regenerate the SQL seed:

```bash
.venv/bin/python -m backend.services.content_packs.generate_migration \
    --output supabase/migrations/{N}_dungeon_content_from_packs.sql
```

The `{N}` is the next sequential migration number (see the existing files
under `supabase/migrations/` for the format).

## Invariants enforced by the validator

1. Globally unique IDs per content type.
2. `combat_encounter_id` FK integrity: every encounter's
   `combat_encounter_id` exists in the same archetype's `spawns.yaml`.
3. Archetype completeness: exactly 1 `boss`, 1 `rest`, and 1 `treasure`
   encounter per archetype.
4. Choices with `check_aptitude` must provide a `partial_narrative_en` —
   a skill check can resolve to partial, and the player must see prose.

## Migration notes

- Phase A1.1 (this): scaffolding, Python dicts still authoritative.
- Phase A1.2: Shadow archetype extracted to pack. Python dict remains as
  diff-test anchor.
- Phase A1.3: remaining 7 archetypes extracted (one commit per archetype).
- Phase A1.4: test harness switches to pack-backed seeding.
- Phase A1.5: Python dicts deleted, CI lint gate enforces pack-only
  authoring, CLAUDE.md NEVER rule added.
- Phase A1.6: admin UI becomes a read-only pack browser with GitHub
  deep-links.
- Phase A1.7: admin UI gains draft-to-PR roundtrip (edits write a
  `dungeon_content_drafts` row, a "Publish" button writes back to YAML
  and opens a PR).
