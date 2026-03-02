# Simulation Blueprint

Reusable reference for creating new simulations on metaverse.center. Every simulation follows the same file/data structure. This document captures the complete process, from world design through deployment, so future additions can reference it directly.

**Current simulations:** Velgarien (1), Capybara Kingdom (2), Station Null (3), Speranza (4), Cit&eacute; des Dames (5).

---

## 1. UUID Allocation Scheme

Deterministic UUIDs for easy identification. Auto-generated UUIDs (`gen_random_uuid()`) are used for agents, buildings, and streets — never hardcode those.

| Entity | Pattern | Sim 1 | Sim 2 | Sim 3 | Sim 4 | Sim 5 | Sim 6 (next) |
|--------|---------|-------|-------|-------|-------|-------|---------------|
| Simulation | `N0000000-0000-0000-0000-000000000001` | `10000000-` | `20000000-` | `30000000-` | `40000000-` | `50000000-` | `60000000-` |
| City | `c000000N-0000-4000-a000-000000000001` | `c0000002-` | `c0000003-` | `c0000004-` | `c0000005-` | `c0000006-` | `c0000007-` |
| Zones | `a000000X-0000-0000-0000-000000000001` | 1-3 | 4-7 | 8-b | c-f | 10-13 | 14-17 |
| Test user | `00000000-0000-0000-0000-000000000001` | (shared) | (shared) | (shared) | (shared) | (shared) | (shared) |

Zone hex numbering is sequential across all simulations. Sim 6 zones start at `a0000014-`.

---

## 2. Files to Create/Modify

### New files (3)

| File | Purpose |
|------|---------|
| `supabase/seed/_0XX_simname.sql` | Data seed (reference copy, `_` prefix to skip auto-discovery) |
| `supabase/seed/_0XX_simname_theme.sql` | Theme seed (reference copy, `_` prefix) |
| `supabase/migrations/TIMESTAMP_0XX_simname.sql` | Combined production migration (data + theme + embassies + connections) |
| `frontend/src/components/lore/content/simname-lore.ts` | Lore content (6-9 sections, ~3500-5000 words) |
| `scripts/generate_simname_images.py` | Image generation script (portraits + buildings) |

### Modified files (5)

| File | Change |
|------|--------|
| `docs/concept.md` | Add simulation entry (section 3x), update meta-lore, update built list |
| `frontend/src/services/theme-presets.ts` | Add preset type + values + name + `getPresetForTheme` mapping |
| `frontend/src/components/settings/DesignSettingsPanel.ts` | Add preset label in `getPresetLabels()` |
| `frontend/src/components/lore/lore-content.ts` | Import + register lore content function |
| `frontend/index.html` | Add Google Fonts `<link>` if custom font needed |

### i18n files (auto-updated)

| File | Action |
|------|--------|
| `frontend/src/locales/xliff/de.xlf` | `npx lit-localize extract` adds entries; translate manually |
| `frontend/src/locales/generated/de.ts` | `npx lit-localize build` regenerates; then `sed -i '' 's/&amp;/\&/g'` |

---

## 3. Seed File Structure

### Main seed (`supabase/seed/_0XX_simname.sql`)

Template: follow `_017_cite_des_dames.sql`. All sections in order:

```sql
-- 1. Simulation
INSERT INTO simulations (id, name, slug, description, theme, content_locale, owner_id)
VALUES ('N0000000-...', 'Name', 'slug', 'Description', 'theme_type', 'en', '00000000-...')
ON CONFLICT (slug) DO NOTHING;

-- 2. Membership
INSERT INTO simulation_members (simulation_id, user_id, member_role)
VALUES ('N0000000-...', '00000000-...', 'owner')
ON CONFLICT (simulation_id, user_id) DO NOTHING;

-- 3. Taxonomies (ALL 13 categories required)
INSERT INTO taxonomies (simulation_id, taxonomy_type, value, label) VALUES
  -- gender (3+)
  ('N0000000-...', 'gender', 'female', '{"en":"Female","de":"Weiblich"}'),
  -- profession (simulation-specific, 6+)
  -- system (factions, 4+)
  -- building_type (7 standard: residential, commercial, industrial, military, infrastructure, medical, social)
  -- building_condition (5+: excellent, good, fair, poor, + sim-specific)
  -- zone_type (simulation-specific)
  -- security_level (4: low, medium, high, restricted)
  -- urgency_level (4: low, medium, high, critical)
  -- event_type (simulation-specific, 6+)
  -- propaganda_type (simulation-specific, 6+)
  -- target_demographic (simulation-specific, 5+)
  -- campaign_type (mirrors propaganda_type values)
  -- street_type (simulation-specific, 4+)
ON CONFLICT (simulation_id, taxonomy_type, value) DO NOTHING;

-- 4. City
INSERT INTO cities (id, simulation_id, name, description) VALUES (...)
ON CONFLICT (id) DO NOTHING;

-- 5. Zones (typically 3-5)
INSERT INTO zones (id, simulation_id, city_id, name, ...) VALUES (...)
ON CONFLICT (id) DO NOTHING;

-- 6. Streets (typically 12-20, distributed across zones)
INSERT INTO city_streets (simulation_id, zone_id, name, ...) VALUES (...)
ON CONFLICT DO NOTHING;  -- no unique constraint on name

-- 7. Agents (6, with full character + background text)
INSERT INTO agents (simulation_id, name, gender, system, character, background, ...) VALUES (...)
ON CONFLICT DO NOTHING;

-- 8. Buildings (7, with zone_id references)
INSERT INTO buildings (simulation_id, zone_id, name, building_type, ...) VALUES (...)
ON CONFLICT DO NOTHING;

-- 9. AI settings (6 entries, category='ai')
INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value) VALUES
  ('N-...', 'ai', 'image_model_agent_portrait', '"black-forest-labs/flux-dev"'),
  ('N-...', 'ai', 'image_model_building_image', '"black-forest-labs/flux-dev"'),
  ('N-...', 'ai', 'image_guidance_scale', '"5.0"'),
  ('N-...', 'ai', 'image_num_inference_steps', '"28"'),
  ('N-...', 'ai', 'image_style_prompt_portrait', '"cinematic ..."'),
  ('N-...', 'ai', 'image_style_prompt_building', '"cinematic ..."')
ON CONFLICT (simulation_id, category, setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value;

-- 10. Prompt templates (2)
INSERT INTO prompt_templates (simulation_id, template_type, content_locale, ...) VALUES (...)
ON CONFLICT DO NOTHING;
```

### Theme seed (`supabase/seed/_0XX_simname_theme.sql`)

37 design settings. Template: follow `_018_cite_des_dames_theme.sql`.

---

## 4. Theme Preset (37 Tokens)

### Token list

**Colors (22):**
`color_primary`, `color_primary_hover`, `color_primary_active`, `color_secondary`, `color_accent`, `color_background`, `color_surface`, `color_surface_sunken`, `color_surface_header`, `color_text`, `color_text_secondary`, `color_text_muted`, `color_border`, `color_border_light`, `color_danger`, `color_success`, `color_primary_bg`, `color_info_bg`, `color_danger_bg`, `color_success_bg`, `color_warning_bg`, `text_inverse`

**Typography (5):**
`font_heading`, `font_body`, `heading_weight`, `heading_transform`, `heading_tracking`

**Character (7):**
`border_radius`, `border_width`, `shadow_style`, `shadow_color`, `hover_effect`

**Animation (2):**
`animation_speed`, `animation_easing`

### WCAG contrast requirements

| Category | Min ratio | Pairs to check |
|----------|-----------|----------------|
| Normal text | 4.5:1 | `color_text` + `color_text_secondary` on `color_surface` and `color_background` |
| Muted text | 3.0:1 | `color_text_muted` on `color_surface` and `color_background` |
| Button text | 3.0:1 | `text_inverse` on `color_primary` and `color_danger` |
| Badge text | 3.0:1 | `color_primary`/`color_primary_bg`, `color_secondary`/`color_info_bg`, `color_accent`/`color_warning_bg`, `color_danger`/`color_danger_bg`, `color_success`/`color_success_bg` |
| Gen-button hover | 3.0:1 | `color_background` on `color_secondary` |

### Frontend registration (4 files)

1. `theme-presets.ts` — add to `ThemePresetName` type, `THEME_PRESETS` object, `PRESET_NAMES` array, and `getPresetForTheme()` mapping
2. `DesignSettingsPanel.ts` — add label in `getPresetLabels()` using `msg()`
3. `index.html` — add Google Fonts `<link>` if using a non-system font (combine with existing families)
4. Run: `npx vitest run tests/theme-contrast.test.ts`

### Font embedding

If `font_heading` references a non-system font (anything not Georgia, Arial, Courier New, Inter, system-ui), embed it via Google Fonts in `frontend/index.html`. Combine families in a single `<link>` tag:

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=FontA:wght@400;700&family=FontB:ital,wght@0,400;0,700;1,400&display=swap" />
```

Current embedded fonts: Barlow (Speranza), Libre Baskerville (Cit&eacute; des Dames).

---

## 5. Lore Content

### File structure

Create `frontend/src/components/lore/content/simname-lore.ts`:

```typescript
import { msg, str } from '@lit/localize';
import type { LoreSection } from '../../platform/LoreScroll.js';

export function getSimnameLoreSections(): LoreSection[] {
  return [
    {
      id: 'section-id',
      chapter: msg('Chapter Name'),
      arcanum: 'III',           // Tarot major arcana (I-XXI)
      title: msg('Section Title'),
      epigraph: msg('Opening quote — Attribution'),
      body: msg(`Full section text...`),
      imageSlug: 'optional-image-name',         // maps to simulation.assets/{sim_id}/lore/
      imageCaption: msg('Optional image caption'),
    },
    // ... 6-9 sections
  ];
}
```

### Registration

In `frontend/src/components/lore/lore-content.ts`:
```typescript
import { getSimnameLoreSections } from './content/simname-lore.js';
// Add to registry:
'sim-slug': getSimnameLoreSections,
```

### Writing guidelines

- Voice should be distinctive per simulation (Bureau field reports, recovered logs, etc.)
- All text wrapped in `msg()` for i18n
- Functions not constants (msg() must evaluate at render time)
- 6-9 sections, grouped into 2-3 chapters
- ~500-800 words per section
- 3-4 sections should have `imageSlug` + `imageCaption`

---

## 6. Migration File (Combined)

Combines data seed + theme seed + embassies + simulation connections into one `DO $$ ... END $$;` block.

### Embassy buildings (3 per simulation)

Each simulation gets 3 embassy buildings representing diplomatic connections to other simulations. Additionally, create `embassies` table records linking each embassy building to a building in the partner simulation.

```sql
-- Embassy buildings
INSERT INTO buildings (simulation_id, zone_id, name, building_type, special_type, ...)
VALUES ('N-...', 'zone-id', 'Embassy Name', 'infrastructure', 'embassy', ...);

-- Embassy records (use LEAST/GREATEST for consistent UUID ordering)
INSERT INTO embassies (building_id, partner_building_id, simulation_a_id, simulation_b_id, protocol, ...)
SELECT
  (SELECT id FROM buildings WHERE name = 'Embassy Name' AND simulation_id = 'N-...'),
  (SELECT id FROM buildings WHERE name = 'Partner Building' AND simulation_id = 'M-...'),
  LEAST('N-...', 'M-...'),
  GREATEST('N-...', 'M-...'),
  'Protocol description', ...;
```

### Simulation connections (one per other simulation)

```sql
INSERT INTO simulation_connections (simulation_a_id, simulation_b_id, connection_type, bleed_strength, ...) VALUES
  (LEAST('N-...','M-...'), GREATEST('N-...','M-...'), 'bleed', 0.XX, ...);
```

Use LEAST/GREATEST to ensure consistent ordering. Include `description` and `lore_text` for each connection.

---

## 7. Image Generation Script

### Template

Create `scripts/generate_simname_images.py`. Pattern: follow `generate_cite_des_dames_images.py`.

Key features:
- Authenticates via Supabase Auth (`admin@velgarien.dev`)
- Queries DB for entity IDs via `docker exec ... psql` with `json_agg()` (handles multi-line text safely)
- Calls `POST /api/v1/simulations/{sim_id}/generate/image` for each entity
- Passes `character` + `background` data as `extra` payload for agents
- Passes `building_type` + `building_condition` + `description` + `zone_name` as `extra` for buildings
- 2s delay between calls (rate limit: 30/hr)
- Supports `--portraits-only` and `--buildings-only` flags

### Flux Dev prompt guidelines

- Never use negative prompts ("not X") — Flux ignores them
- Never use "concept art" — triggers anime/digital art bias
- Use specific film/art references for aesthetic grounding
- Set `image_guidance_scale` to 5.0+ for stylized outputs
- Give each agent **visually distinct** traits (body type, age, hair, accessories)
- Use `max_tokens=300` minimum for portrait/building descriptions

---

## 8. i18n Workflow

```bash
cd frontend

# 1. Extract new strings
npx lit-localize extract

# 2. Translate new <trans-unit> entries in de.xlf (those without <target>)
# Use Claude to translate with game/UI context

# 3. Build generated locale
npx lit-localize build

# 4. Fix ampersand bug (lit-localize double-escapes & in generated de.ts)
sed -i '' 's/&amp;/\&/g' src/locales/generated/de.ts
```

---

## 9. Verification Checklist

```bash
# Theme contrast (WCAG AA)
cd frontend && npx vitest run tests/theme-contrast.test.ts

# TypeScript
cd frontend && npx tsc --noEmit

# Frontend tests
cd frontend && npx vitest run

# Backend tests
cd /project && source backend/.venv/bin/activate && python3.13 -m pytest backend/tests/ -v

# Lint
cd frontend && npx biome check src/
python3.13 -m ruff check backend/

# Visual verification (after DB migration applied)
# - /simulations/sim-slug/lore — theme renders correctly
# - /multiverse — new node with correct color
# - /simulations/sim-slug/agents — 6 agents visible
# - /simulations/sim-slug/buildings — 7+ buildings visible
```

---

## 10. Production Deployment

```bash
# 1. Push migration to production Supabase
SUPABASE_ACCESS_TOKEN=sbp_... supabase db push

# 2. Deploy code (Railway auto-builds from main)
git push origin main

# 3. Verify
curl -s https://metaverse.center/api/v1/health

# 4. Generate images (requires backend running locally with REPLICATE_API_TOKEN)
python3.13 scripts/generate_simname_images.py

# 5. Transfer images to production (see deployment-procedures.md)

# 6. Generate dashboard banner
python3.13 scripts/generate_dashboard_images.py "sim name"

# 7. Notify search engines
# (IndexNow command from CLAUDE.md)
```

---

## 11. Common Pitfalls

| Pitfall | Solution |
|---------|----------|
| Hardcoded agent/building UUIDs in migrations | Use name-based `JOIN` subqueries — UUIDs differ local vs production |
| Table name `streets` | Correct name is `city_streets` |
| Column name `locale` | Correct name is `content_locale` |
| Taxonomy labels format | JSON: `'{"en":"Label","de":"Bezeichnung"}'` |
| Single quotes in SQL text | Escape: `it''s` |
| Settings values format | JSON-quoted: `'"value"'` not `'value'` |
| Seed + migration double-insert | Always `_` prefix the seed file |
| Test user FK violations | Migration `ensure_dev_user` must exist and run first |
| MCP tools for production | MCP is LOCAL only — use REST API or `supabase db push` |
| Font not loading | Embed via Google Fonts in `index.html` if non-system font |
| `npx lit-localize build` ampersand bug | Run `sed -i '' 's/&amp;/\&/g' src/locales/generated/de.ts` after every build |
| `msg()` in module-level arrays | Convert to functions — `msg()` must evaluate at render time |
