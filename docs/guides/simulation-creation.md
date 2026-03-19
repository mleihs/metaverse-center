---
title: "Simulation Creation Guide"
version: "1.0"
type: guide
status: active
lang: en
---

# Simulation Creation Guide

Process documentation for creating new simulations on the metaverse.center platform.

## UUID Allocation Scheme

Each simulation uses a deterministic UUID pattern for easy identification:

| Entity | Pattern | Example (Sim 3) |
|--------|---------|------------------|
| Simulation | `N0000000-0000-0000-0000-000000000001` | `30000000-...` |
| City | `c000000N-0000-4000-a000-000000000001` | `c0000004-...` |
| Zones | `a000000X-0000-0000-0000-000000000001` | `a0000008-` through `a000000b-` |
| User (test) | `00000000-0000-0000-0000-000000000001` | Always same |

- Velgarien = sim 1 (`10000000-...`), Capybara = sim 2 (`20000000-...`), Station Null = sim 3 (`30000000-...`), Speranza = sim 4 (`40000000-...`), Cit&eacute; des Dames = sim 5 (`50000000-...`), Spengbab = sim 6 (`60000000-...`), Conventional Memory = sim 7 (`70000000-...`)
- City IDs: `c0000002-` (Velgarien), `c0000003-` (Capybara), `c0000004-` (Station Null), `c0000005-` (Speranza), `c0000006-` (Cit&eacute; des Dames), `c0000007-` (Spengbab), `c0000008-` (Conventional Memory)
- Zone IDs: sequential from `a0000001-` (Velgarien zones 1-3), `a0000004-` (Capybara zones 4-7), `a0000008-` (Station Null zones 8-b), `a000000c-` (Speranza zones c-f), `a0000010-` (Cit&eacute; des Dames zones 10-13), `a0000014-` (Spengbab zones 14-17), `a0000018-` (Conventional Memory zones 18-1b)
- Next simulation would use: sim `80000000-...`, city `c0000009-...`, zones `a000001c-` onwards

## Seed vs Migration Strategy

**CRITICAL:** New simulation data goes in BOTH a seed file AND a migration file, BUT the seed file must be renamed with `_` prefix to prevent double-insertion on fresh installs.

- **Migration file** (`supabase/migrations/TIMESTAMP_0XX_name.sql`) — runs during `supabase start` and `supabase db push`
- **Seed file** (`supabase/seed/_0XX_name.sql`) — archived with `_` prefix, NOT auto-discovered
- **Migration `20260220000000_ensure_dev_user.sql`** — creates test user before data migrations (MUST exist)
- **Seeds 001, 006, 007, 008, 010, 015, 016** — still active (data not in any migration, or production-applied separately)
- **Seeds 002-005** — v1→v2 migration only, `_` prefixed
- **Seeds 009, 011, 012, 013, 014** — data in migrations 017/021/024, `_` prefixed
- **Seed 015** — epoch demo data (for local dev)
- **Seed 016** — dev player accounts (4 per-sim players, applied to production as migration)

### Why seeds are duplicated with migrations

- Seeds exist for reference/documentation and `supabase db reset` recovery
- Migrations exist for `supabase db push` to production
- Only ONE should be auto-discovered; the other gets `_` prefix

## Seed File Structure

Two seed files per simulation:

### Main seed (`supabase/seed/_0XX_simulation_name.sql`)

Pattern: follow `009_capybara_kingdom.sql` exactly. **Prefix with `_` to exclude from glob.**

Required sections in order:
1. **Simulation** — INSERT into `simulations` with ON CONFLICT (slug) DO NOTHING
2. **Owner membership** — INSERT into `simulation_members`
3. **Taxonomies** (13 categories, ALL required):
   - `gender` — male, female, diverse (+ simulation-specific like 'artificial')
   - `profession` — simulation-specific roles
   - `system` — factions/departments
   - `building_type` — residential, commercial, etc.
   - `building_condition` — excellent, good, fair, poor, + simulation-specific
   - `zone_type` — simulation-specific zone categories
   - `security_level` — low, medium, high, restricted
   - `urgency_level` — low, medium, high, critical
   - `event_type` — simulation-specific event categories
   - `propaganda_type` — simulation-specific communication types
   - `target_demographic` — simulation-specific audience groups
   - `campaign_type` — mirrors propaganda_type values
   - `street_type` — simulation-specific passage types
4. **City** — INSERT into `cities`
5. **Zones** — INSERT into `zones` (typically 3-5)
6. **Streets** — INSERT into `city_streets` (typically 12-20, distributed across zones)
7. **Agents** — INSERT into `agents` with full `character` and `background` text
8. **Buildings** — INSERT into `buildings` with zone_id references
9. **AI settings** — 6 INSERT into `simulation_settings` (category='ai'):
   - `image_model_agent_portrait` — `"black-forest-labs/flux-dev"`
   - `image_model_building_image` — `"black-forest-labs/flux-dev"`
   - `image_guidance_scale` — `3.5`
   - `image_num_inference_steps` — `28`
   - `image_style_prompt_portrait` — aesthetic description for agent portraits
   - `image_style_prompt_building` — aesthetic description for building images
10. **Prompt templates** — 2 INSERT into `prompt_templates`:
    - `portrait_description` (template_type) with agent variables
    - `building_image_description` (template_type) with building variables

### Theme seed (`supabase/seed/0XX_simulation_theme.sql`)

Pattern: follow `010_simulation_themes.sql` exactly.

- 36 design settings INSERT into `simulation_settings` (category='design')
- Use ON CONFLICT ... DO UPDATE SET for idempotency
- All 36 tokens must be provided (colors, typography, character, animation)

## Theme Creation Process

### 36 Required Token Keys

**Colors (21):** color_primary, color_primary_hover, color_primary_active, color_secondary, color_accent, color_background, color_surface, color_surface_sunken, color_surface_header, color_text, color_text_secondary, color_text_muted, color_border, color_border_light, color_danger, color_success, color_primary_bg, color_info_bg, color_danger_bg, color_success_bg, color_warning_bg

**Typography (6):** font_heading, font_body, heading_weight, heading_transform, heading_tracking, font_base_size

**Character (6):** border_radius, border_width, border_width_default, shadow_style, shadow_color, hover_effect, text_inverse

**Animation (2):** animation_speed, animation_easing

### Frontend Preset Registration

1. Add to `ThemePresetName` union type in `theme-presets.ts`
2. Add values to `THEME_PRESETS` object
3. Add to `PRESET_NAMES` array
4. Add label in `getPresetLabels()` in `DesignSettingsPanel.ts` using `msg()`
5. Run: `cd frontend && npx vitest run tests/theme-contrast.test.ts`

### WCAG Contrast Validation

The test auto-discovers presets from THEME_PRESETS and checks 14 pairs per preset:
- 4.5:1 minimum for text on surfaces
- 3.0:1 minimum for muted text, badge text, button text

Common fixes when contrast fails:
- Dark themes: ensure `-bg` tokens are dark enough
- `text_inverse` must work on both `color_primary` AND `color_danger`
- `color_secondary` and `color_accent` are used as badge text — don't use pale values

## LoreScroll Integration

Add sections to `getLoreSections()` in `LoreScroll.ts`:
- Each section: `{ id, chapter, arcanum, title, epigraph, body, imageSlug?, imageCaption? }`
- All text fields wrapped in `msg()` for i18n
- Arcanum = Tarot major arcana number (0-XXI)
- Body can be multi-paragraph (use template literals with `\n\n`)
- Position matters: sections appear in array order, grouped by chapter

## i18n — German Translations

After adding any `msg()` strings:
```bash
cd frontend
npx lit-localize extract    # Updates de.xlf with new <trans-unit> entries
# Add <target>German translation</target> to each new entry
npx lit-localize build      # Regenerates de.ts
```

## Production Migration

Combine both seed files into a single migration file:
- Filename: `supabase/migrations/TIMESTAMP_0XX_simulation_name.sql`
- Format: `DO $$ ... END $$;` (NO explicit BEGIN/COMMIT — Supabase wraps in transaction)
- All INSERT ... ON CONFLICT for idempotency
- Include both data and theme settings

## Production Deployment

1. `supabase db reset` — verify locally
2. `SUPABASE_ACCESS_TOKEN=sbp_... supabase db push` — push migration to production
3. `git push origin main` — deploy code (Railway auto-builds)
4. Verify at https://metaverse.center

## Image Generation

After seed/migration is applied and DB is running:

### Script Pattern

Each simulation has its own generation script: `scripts/generate_SIMNAME_images.py`

- `generate_velgarien_images.py` — 8 portraits + 6 buildings
- `generate_capybara_images.py` — 5 portraits + 5 buildings
- `generate_station_null_images.py` — 6 portraits + 7 buildings
- `generate_speranza_images.py` — 6 portraits + 7 buildings
- `generate_cite_des_dames_images.py` — 6 portraits + 7 buildings
- `generate_dashboard_images.py` — 1 hero + 5 simulation banners (also sets `banner_url` on simulations table)

### How to Run

```bash
# 1. Start backend (needs REPLICATE_API_TOKEN in .env)
source backend/.venv/bin/activate
uvicorn backend.app:app --reload --host 0.0.0.0 --port 8000

# 2. Run generation script
python3.13 scripts/generate_station_null_images.py
```

### Key Details

- Scripts authenticate via Supabase Auth (test user `matthias@leihs.at`)
- Use `/api/v1/simulations/{sim_id}/generate/image` endpoint
- Station Null script auto-queries DB for IDs (they change on each fresh start)
- Older scripts (Velgarien, Capybara) have hardcoded IDs — will break if DB is reset
- Rate limit: 30/hr for AI generation, 2s delay between calls
- Images saved to Supabase Storage and URL updated in DB automatically
- Transfer to production via REST API (see `deployment-procedures.md`)

## Dashboard Banner

Each simulation needs a banner image for the dashboard card. Add to `scripts/generate_dashboard_images.py`:
```python
{
    "name": "SimName Banner",
    "storage_path": f"{SIM_ID}/banner.webp",
    "simulation_id": SIM_ID,
    "prompt": "...",
    "width": 1024,
    "height": 683,
},
```
Run: `python3.13 scripts/generate_dashboard_images.py "sim name"` (filter by name)

The script uploads to `simulation.assets/{sim_id}/banner.webp` and updates `banner_url` on the simulations table.

## Prompt Diversity — Avoiding Similar Portraits/Buildings

**Problem:** When multiple agents share the same simulation-wide style prompt and prompt template, the unique character traits get drowned out. Results look nearly identical.

**Root causes:**
1. Style prompt (`image_style_prompt_portrait`) repeats the same aesthetic in EVERY generation
2. Prompt template body repeats the SAME aesthetic directives that are already in the style prompt
3. `max_tokens=200` for the LLM description truncates differentiating details
4. Agent character descriptions that are thematically similar (e.g., "small intense woman" × 2) converge further
5. **CRITICAL: Flux Dev has NO negative prompt support** — "not anime, not cartoon" in the prompt does NOTHING
6. **"concept art quality"** triggers Flux's digital art/anime training bias — avoid this phrase entirely
7. **Generation script bug** — `generate_station_null_images.py` was not passing `character`/`background` data to the API, so LLM had no context

**Fixes applied (migration 022 + 023):**
- `max_tokens` increased to 300 on all prompt templates
- All prompt templates rewritten to avoid duplicating style prompt aesthetic
- Style prompts rewritten: "concept art quality" → "cinematic film still from 1979 sci-fi horror movie, Ridley Scott Alien aesthetic"
- All "not X" negatives removed (useless for Flux)
- `image_guidance_scale` increased from 3.5 → 5.0 (forces Flux to follow prompt more strictly)
- System prompts now explicitly enforce gritty/weathered/rough texture descriptions
- Generation script fixed to use JSON psql output and pass `character`/`background` fields

**Checklist for future simulations:**
- Give each agent **visually distinct** physical traits (body type, hair color, age, visible accessories)
- Avoid generic descriptors like "intense eyes" or "dark hair" for multiple characters
- Use `max_tokens=300` minimum for portrait/building descriptions
- Never use "concept art" in Flux Dev style prompts — use film references instead
- Never rely on negative prompts ("not X") with Flux — only positive descriptors work
- Set `image_guidance_scale` to 5.0+ for stylized outputs (default 3.5 is too loose)
- In style prompts, reference specific films/directors for aesthetic grounding (e.g., "Ridley Scott Alien", "Tarkovsky Stalker")
- In system prompts, enforce TEXTURE requirements (pores, grime, sweat, weathering)
- Test generation script passes entity data (character, background) to API — check for "Missing variable" warnings in backend logs

## Entity Slugs (Migration 137)

Agent and building slugs are **auto-generated** from their `name` via a `BEFORE INSERT` SQL trigger. No manual slug specification needed in seed files or migrations.

- Slugs follow the pattern `^[a-z0-9-]+$` (lowercase, hyphens, max 80 chars)
- Collision handling appends `-2`, `-3` etc. within the same simulation
- Slugs are **immutable** after creation (URL stability for SEO)
- Used in SEO-friendly URLs: `/simulations/{sim-slug}/agents/{agent-slug}`
- Example: agent "Chaplain Isadora Mora" gets slug `chaplain-isadora-mora`

## Common Pitfalls

- **NEVER hardcode agent/building UUIDs in migrations** — agents and buildings get auto-generated UUIDs (`gen_random_uuid()`), which differ between local and production. Use name-based `JOIN` subqueries instead (see `deployment-procedures.md` for pattern). Simulation, city, and zone UUIDs use deterministic patterns and ARE safe to hardcode.
- **`city_streets` not `streets`** — the table is named `city_streets`
- **`content_locale` not `locale`** — the simulations table column is `content_locale`
- **Taxonomy labels are JSON** — `'{"en":"Label","de":"Bezeichnung"}'`
- **Single quotes in SQL** — escape with `''` (double single-quote)
- **ON CONFLICT DO NOTHING for streets** — no unique constraint on name, use bare `ON CONFLICT DO NOTHING`
- **Settings values are JSON-quoted** — `'"value"'` not `'value'`
- **font_body uses sans-serif** — only headings use themed fonts for readability
- **MCP tools are LOCAL only** — never use for production
- **Seed/migration duplication** — if both seed AND migration insert agents/buildings without explicit UUIDs → double records. Always `_` prefix the seed file.
- **Test user must exist before data migrations** — migration `20260220000000_ensure_dev_user.sql` creates it. Without this, FK violations crash `supabase start`.
- **`supabase stop --no-backup` destroys storage** — all images in storage buckets are wiped. See `local-db-reset-guide.md`.
- **Local Supabase uses `sb_secret_` keys** — not JWT service_role keys. Get from `supabase status`.
- **Generation script must pass character/background** — psql pipe-delimited output breaks on multi-line text. Use `json_agg()` wrapper for safe parsing. Always pass `character` + `background` as `extra` to the generate endpoint.
- **Flux Dev ignores negative prompts** — never use "not anime", "not cartoon" etc. Only positive descriptors work. Use film references + texture requirements instead.
- **"concept art" triggers anime in Flux** — this phrase pushes Flux toward clean digital illustration. Use "cinematic film still" + director references instead.
- **`theme_preset` setting is REQUIRED** — Without a `theme_preset` row in `simulation_settings` (category='design'), the ThemeService defaults to `'brutalist'` and the simulation's theme won't apply. Always include: `INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value) VALUES (sim_id, 'design', 'theme_preset', '"preset_name"')`.
- **REST API double-encodes JSONB values** — When inserting design tokens via the PostgREST REST API, do NOT `json.dumps()` the value before putting it in the payload. Use `{"setting_value": "#AA00AA"}` not `{"setting_value": "\"#AA00AA\""}`. Double-encoding causes CSS values to include literal quotes, breaking the theme.
- **Simulation lore is in `simulation_lore` table** — NOT in `LoreScroll.ts` (that's platform-wide lore). Each simulation has its own lore sections stored in the database, managed via the `/api/v1/simulations/{id}/lore` API. The lore page shows "No lore available" until rows are inserted into this table.
- **Check UUID availability before assigning** — UUID patterns like `60000000-...` may already be taken by other simulations (e.g., Spengbab). Always query production first: `curl "$PROD_URL/rest/v1/simulations?select=id,name,slug" -H "Authorization: Bearer $KEY" -H "apikey: $KEY"`.
- **Image generation script needs correct SIM_ID** — If the simulation UUID changes (e.g., from 60000000 to 70000000), update the generation script's `SIM_ID` constant before running. The script queries agents/buildings by simulation_id and will generate images for the wrong simulation otherwise.
