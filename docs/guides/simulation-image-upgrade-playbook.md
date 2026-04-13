# Simulation Image Upgrade Playbook

**Purpose:** Step-by-step guide to upgrade a simulation's images from generic/outdated quality to deluxe Flux 2 Max with hand-crafted prompts. Tested on Spengbab's Grease Pit and Velgarien (April 2026).

**Cost:** ~$0.073/image (flux-2-max) or ~$0.031/image (flux-2-pro). Typical simulation: 20-25 images = $1.50-1.80.

**Time:** ~30-45 minutes total (15 min prep + 15-20 min generation).

---

## Prerequisites

- Backend running locally OR production access via Railway
- `REPLICATE_API_TOKEN` and `OPENROUTER_API_KEY` in `.env`
- Supabase MCP server authenticated (for production SQL)
- Railway CLI linked (for production service role key)

---

## Phase 0: Audit Current State

### 0.1 Check AI settings

```sql
SELECT setting_key, left(setting_value::text, 80) AS val
FROM simulation_settings
WHERE simulation_id = '<SIM_ID>' AND category = 'ai'
ORDER BY setting_key;
```

**Red flags:**
- `image_model_*` pointing to `flux-dev` (non-commercial, outdated)
- `image_guidance_scale` > 5.0 (SD-era, not Flux-optimized)
- `image_num_inference_steps` != 28 (Flux optimal)
- Missing `image_style_prompt_lore` or `image_style_prompt_banner`

### 0.2 Check entity descriptions

```sql
-- Agents with thin descriptions
SELECT name, length(character) AS char_len, length(background) AS bg_len
FROM agents WHERE simulation_id = '<SIM_ID>' AND deleted_at IS NULL
ORDER BY char_len;

-- Buildings with thin descriptions
SELECT name, length(description) AS desc_len
FROM buildings WHERE simulation_id = '<SIM_ID>' AND deleted_at IS NULL
ORDER BY desc_len;
```

**Red flags:**
- `char_len < 100` or `bg_len < 100` — description too thin for quality image generation
- Descriptions in wrong language (English for a German simulation or vice versa)
- Generic descriptions without world-specific detail

### 0.3 Check prompt templates

```sql
SELECT template_type, updated_at::date
FROM prompt_templates
WHERE simulation_id = '<SIM_ID>'
ORDER BY template_type;
```

**Red flags:**
- Templates older than the last lore update
- Missing `portrait_description` or `building_image_description`
- Generic templates not specific to the world

### 0.4 Count entities

```sql
SELECT 'agents' AS type, count(*) FROM agents WHERE simulation_id = '<SIM_ID>' AND deleted_at IS NULL
UNION ALL SELECT 'buildings', count(*) FROM buildings WHERE simulation_id = '<SIM_ID>' AND deleted_at IS NULL
UNION ALL SELECT 'lore_images', count(*) FROM simulation_lore WHERE simulation_id = '<SIM_ID>' AND image_slug IS NOT NULL AND image_slug != '';
```

Calculate cost: `(agents + buildings + lore + 1 banner) × $0.073`.

---

## Phase 1: Fix Settings

### 1.1 Remove stale model overrides

```sql
DELETE FROM simulation_settings
WHERE simulation_id = '<SIM_ID>'
AND setting_key IN (
    'image_model_agent_portrait',
    'image_model_building_image',
    'image_model_lore_image',
    'image_model_banner'
);
```

### 1.2 Set correct Flux parameters

```sql
INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value)
VALUES
  ('<SIM_ID>', 'ai', 'image_guidance_scale', '"3.5"'),
  ('<SIM_ID>', 'ai', 'image_num_inference_steps', '"28"')
ON CONFLICT (simulation_id, category, setting_key)
DO UPDATE SET setting_value = EXCLUDED.setting_value;
```

### 1.3 Set target model (flux-2-max or flux-2-pro)

```sql
INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value)
VALUES
  ('<SIM_ID>', 'ai', 'image_model_agent_portrait', '"black-forest-labs/flux-2-max"'),
  ('<SIM_ID>', 'ai', 'image_model_building_image', '"black-forest-labs/flux-2-max"'),
  ('<SIM_ID>', 'ai', 'image_model_lore_image', '"black-forest-labs/flux-2-max"'),
  ('<SIM_ID>', 'ai', 'image_model_banner', '"black-forest-labs/flux-2-max"')
ON CONFLICT (simulation_id, category, setting_key)
DO UPDATE SET setting_value = EXCLUDED.setting_value;
```

**Note:** flux-2-max has a stricter safety filter than flux-2-pro. For edgy content (body horror, gore, extreme aesthetics like Spengbab), use flux-2-pro instead.

---

## Phase 2: Write Style Prompts

### 2.1 Research the simulation's visual identity

Read the simulation's:
- Lore (world description, atmosphere, materials, lighting)
- Theme preset (brutalist, solarpunk, deep-space-horror, etc.)
- Existing buildings (what materials, what era)
- Geographic setting

### 2.2 Research real-world visual references

For each simulation type, identify:
- **Photographer references** that Flux understands:
  - Brutalist/institutional: Gregory Crewdson, Candida Höfer, Frederic Chaubin, Andreas Gursky
  - Industrial: Edward Burtynsky, Bernd & Hilla Becher
  - Dystopian cinematic: Roger Deakins (Blade Runner 2049), Emmanuel Lubezki (Children of Men)
  - Horror: Gregory Crewdson, Joel-Peter Witkin
  - Solarpunk: Olafur Eliasson, Thomas Heatherwick
- **Architectural references** (Atlas of Brutalist Architecture, specific buildings)
- **Film/color grading references** (bleach bypass, cross-processed, specific film stocks)

### 2.3 Write 4 style prompts

Each style prompt is appended to every image description for that entity type. Structure:

```
[Photography style reference], [camera/lens], [lighting], [color grading],
[material textures], [atmospheric mood], [what makes this world unique]
```

**Example (brutalist dystopia):**
```
In the style of Gregory Crewdson, cold institutional lighting, 85mm lens at f/2.8
shallow depth of field. Raw concrete and brushed steel background, harsh overhead
fluorescent casting cold blue-white light. Bleach bypass color grading, desaturated
cold palette, slight film grain. Dystopian bureaucratic authority.
```

Store via SQL:
```sql
INSERT INTO simulation_settings (simulation_id, category, setting_key, setting_value)
VALUES ('<SIM_ID>', 'ai', 'image_style_prompt_portrait', '"<prompt>"')
ON CONFLICT ... DO UPDATE ...;
```

Repeat for `image_style_prompt_building`, `image_style_prompt_lore`, `image_style_prompt_banner`.

---

## Phase 3: Enrich Entity Descriptions

### 3.1 Rewrite thin agent descriptions

For each agent with `character` < 200 chars:
- Write rich German character description (personality, motivation, relationship to regime)
- Write rich German background (origin, key events, current role)
- Include visual details (appearance, clothing, mannerisms) that inform portrait generation

### 3.2 Rewrite thin building descriptions

For each building with `description` < 200 chars:
- Research real-world brutalist buildings as visual references
- Write rich German description including:
  - Materials (beton brut, board-marked concrete, steel, glass)
  - Lighting (fluorescent, mercury vapor, sodium, neon)
  - Scale (dimensions, number of floors, spatial relationships)
  - Atmosphere (sounds, smells, temperature)
  - Narrative detail (what happens here, who uses it)

### 3.3 Create a SQL migration

Put all description updates in a migration file for sustainability:
```
supabase/migrations/TIMESTAMP_NNN_<sim_slug>_description_enrichment.sql
```

This ensures the enrichments persist in the codebase and apply to both local and production.

---

## Phase 4: Write Hand-Crafted Image Prompts (Optional, Maximum Quality)

For the highest quality, bypass OpenRouter's auto-generated descriptions and write English image prompts directly. Create a Python file:

```
scripts/_<sim_slug>_image_prompts.py
```

### 4.1 Flux 2 Max prompt architecture

```
1. SUBJECT   — Lead with primary focus (person, building)
2. CONTEXT   — Environment, spatial relationships
3. TECHNICAL — Camera model, lens, f-stop, depth of field
4. STYLE     — Photographer reference, color grading, mood
```

### 4.2 Key techniques

- **Camera specs matter:** `"85mm at f/2.8"` (portraits), `"17mm tilt-shift at f/11"` (buildings)
- **Film stock references:** `"Fuji Neopan Acros 100"`, `"bleach bypass color grading"`
- **Material specificity:** `"board-marked beton brut with visible wooden formwork imprints"` not just `"concrete"`
- **Light sources:** `"flickering fluorescent tube"`, `"mercury vapor lamp"`, `"sodium vapor orange glow"`
- **No negative prompts** (Flux 2 doesn't support them — describe what you WANT)
- **No quality boosters** (`"8K, masterpiece"` waste token budget — Flux 2 Max is high quality by default)
- **Optimal length:** 60-90 words per prompt

### 4.3 Pass as description_override

In the generation script, use `description_override=` to bypass OpenRouter:

```python
url = await image_service.generate_agent_portrait(
    UUID(agent["id"]),
    name,
    description_override=AGENT_PROMPTS[name],  # handcrafted English
)
```

---

## Phase 5: Run A.6 (Prompt Templates)

A.6 generates simulation-specific prompt templates from lore context. Even if you use hand-crafted overrides for the current generation, A.6 templates improve future auto-generations.

```python
from backend.services.forge_theme_service import ForgeThemeService
await ForgeThemeService.generate_simulation_templates(supabase, SIM_ID)
```

Or use the script: `python scripts/_run_spengbab_a5_a6.py` (adapt SIM_ID).

---

## Phase 6: Generate Images

### 6.1 Use the deluxe generation script pattern

See `scripts/_velgarien_deluxe_regen.py` for the template. Key features:
- Connects directly to production Supabase
- Uses `description_override` for hand-crafted prompts
- Generates banner → agents → buildings → lore sequentially
- 2-second delay between images (rate limiting)
- Logs success/failure with URLs

### 6.2 Handle safety filter failures

flux-2-max has a stricter content filter than flux-2-pro. If an image fails with E005:
1. The `ReplicateService` auto-retries twice with progressively softened prompts
2. If still failing, retry with a manually sanitized `description_override`
3. For persistently blocked content: switch to flux-2-pro for that entity

### 6.3 Sync to production (if generated locally)

If images were generated locally (local Supabase storage), sync to production:
1. Match entities by **name** (local/production may have different UUIDs)
2. Download from local storage → upload to production storage under production entity IDs
3. Patch production DB URLs

See `scripts/_fix_spengbab_prod_ids.py` for the name-based ID mapping pattern.

---

## Phase 7: Push & Commit

1. Apply migration on production: `mcp__supabase-prod__apply_migration` or `supabase db push`
2. Commit scripts + migration:
   ```
   git add scripts/_<sim>_*.py supabase/migrations/*_<sim>_*.sql
   git commit -m "ops(forge): <sim> deluxe image regeneration — A.5/A.6 + flux-2-max"
   git push origin main
   ```

---

## Simulation-Specific Notes

### Spengbab's Grease Pit (deep-fried-horror)
- **Model:** flux-2-pro (flux-2-max safety filter too strict for body horror)
- **Style refs:** Beksiński, Ren & Stimpy, Robert Crumb, MS Paint, corrupted JPEG
- **Safety hardening:** Portrait style prompt must avoid explicit body descriptors

### Velgarien (brutalist dystopia)
- **Model:** flux-2-max (no content safety issues with institutional architecture)
- **Style refs:** Gregory Crewdson, Frederic Chaubin CCCP, Candida Höfer, Andreas Gursky
- **Architecture refs:** Barbican Centre, Neviges Mariendom, Stasi HQ, Teufelsberg, Robin Hood Gardens
- **Key technique:** Bleach bypass color grading, 17mm tilt-shift for buildings

### Other Simulations (TODO)
- **Gaslit Reach** — Victorian gothic: Roger Deakins (Skyfall), Bill Brandt, Julia Margaret Cameron
- **Station Null** — Deep-space horror: Ridley Scott (Alien), H.R. Giger, Zdzisław Beksiński
- **Speranza** — Mediterranean hope: Martin Parr, Alex Webb, Luigi Ghirri
- **Conventional Memory** — Suburban uncanny: William Eggleston, Stephen Shore, Gregory Crewdson

---

## Appendix: Flux 2 Max Prompt Cheat Sheet

### Camera References That Work

| Use Case | Camera + Lens | Effect |
|---|---|---|
| Monumental exteriors | `Canon EOS R5, 17mm tilt-shift lens` | Corrected verticals |
| Institutional interiors | `Hasselblad X2D, 24mm at f/8` | Medium format, deep focus |
| Portraits | `85mm lens at f/2.8` | Subject isolation |
| Surveillance | `CCTV camera, wide angle` | Oppressive |
| Documents | `macro lens, 100mm, f/4` | Texture detail |

### Color Grading Keywords

- `bleach bypass color grading` — desaturated, hopeless-world (Children of Men)
- `cross-processed Ektachrome` — cold institutional color shift
- `Fuji Neopan Acros 100` — razor-sharp B&W, concrete textures
- `slight film grain` — prevents "too clean" digital look

### Material Keywords for Photorealism

- `board-marked beton brut with visible wooden formwork imprints`
- `exposed aggregate concrete, weathered, hairline cracks`
- `institutional green paint peeling to reveal plaster beneath`
- `brushed stainless steel, scratched and dulled from decades of use`
- `cracked linoleum floor over concrete slab`

### Photographer References

| Photographer | Best For | Prompt Phrase |
|---|---|---|
| Gregory Crewdson | Portraits, social alienation | `in the style of Gregory Crewdson, staged photography` |
| Candida Höfer | Empty institutional interiors | `in the style of Candida Höfer, frontal composition` |
| Frederic Chaubin | Soviet brutalist exteriors | `in the style of Frederic Chaubin CCCP` |
| Andreas Gursky | Large-scale anonymous spaces | `in the style of Andreas Gursky, large-scale` |
| Simon Phipps | British brutalist textures | `in the style of Simon Phipps, concrete detail` |
| Roger Deakins | Dystopian cinematography | `cinematography by Roger Deakins, cold blue palette` |
