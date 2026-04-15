# Social Media Pipeline -- Session Handoff

**Date**: 2026-04-15
**Previous session**: Full audit + implementation (2026-04-14 to 2026-04-15)
**Next task**: Design token refactoring + story card polish

---

## What was done this session

### Architecture
- **3-module decomposition**: `instagram_image_helpers.py` (720 LOC) | `instagram_story_composer.py` (1300 LOC) | `instagram_image_service.py` (600 LOC)
- **BaseSchedulerMixin** extracted for Instagram/Bluesky schedulers
- **Shared utilities**: `utils/settings.py` (parse_setting_bool, decrypt_setting, load_platform_settings)
- **Shared constants**: `social/constants.py` (hashtag pools, scheduler defaults, derived Bluesky tags)
- **101 unit tests** in `backend/tests/unit/test_instagram_image.py`

### API improvements
- Instagram: exponential backoff with retry, X-App-Usage header monitoring
- Bluesky: `langs: ["en", "de"]`, `aspectRatio`, bot self-label, resize >2000px, RGBA-safe recompress

### Visual effects
- **Bleach bypass**: desaturation 0.65, contrast 1.25, highlight rolloff 0.90, cold shadow tint
- **Chromatic aberration**: 2px RGB channel offset (surveillance camera aesthetic)
- Both in `instagram_image_helpers.py` as `bleach_bypass()` and `chromatic_aberration()`
- Applied in `instagram_image_service.py` `_compose_with_overlay()` for feed posts
- NOT applied to story templates (stories have their own atmospheric effects)

### Instagram Safe Zones
- `STORY_SAFE_TOP`: 160 → 230 (below Instagram username bar)
- `STORY_FOOTER_Y`: 1840 → 1720 (above Instagram "Send message" bar)
- `STORY_TITLE_Y`: 300 (new, derived from STORY_SAFE_TOP + 70)
- All 5 story templates updated to respect these zones

### Typography simplified
- From 10 font tokens to 7 (4 hierarchy levels + 3 special purpose)
- `FONT_H1=60, FONT_H2=44, FONT_BODY=32, FONT_CAPTION=24`
- `FONT_STAT=140, FONT_MAGNITUDE=72, FONT_CTA=52`
- Feed-specific: `FONT_FEED_TITLE=36, FONT_FEED_BADGE=28, FONT_FEED_FOOTER=16, FONT_FEED_SEAL=20`

### 59 design tokens defined
All in `instagram_image_helpers.py`. Currently FLAT (not derived from base values).

---

## ~~NEXT~~ DONE: Design Token System Refactoring (commit 8580128)

### Problem
59 tokens are 59 independent hardcoded values. No derivation hierarchy. Changing one value requires manually checking all related values.

### Solution
Refactor to derived system based on `BASE_UNIT` and `TYPE_SCALE`:

```python
BASE_UNIT = 12                                        # Grid unit
TYPE_SCALE = 1.375                                    # Major Third
BASE_FONT_SIZE = 32                                   # Body anchor

FONT_H1 = round(BASE_FONT_SIZE * TYPE_SCALE ** 2)    # 60
FONT_H2 = round(BASE_FONT_SIZE * TYPE_SCALE)          # 44
FONT_BODY = BASE_FONT_SIZE                             # 32
FONT_CAPTION = round(BASE_FONT_SIZE / TYPE_SCALE)     # 23 → 24

SPACING_XS = BASE_UNIT                                # 12
SPACING_SM = BASE_UNIT * 2                             # 24
SPACING_MD = BASE_UNIT * 4                             # 48
SPACING_LG = BASE_UNIT * 6                             # 72
```

### Specific issues to fix
1. `WATERMARK_SYMBOL_Y = 480` should derive from `STORY_TITLE_Y`
2. `GAUGE_MIN_Y = 940` should derive from canvas center
3. `STATS_LABEL_OFFSET = 145` should be `FONT_STAT + 5`
4. `MARGIN_INDENT = 72` duplicates `SPACING_LG = 72` -- consolidate
5. `FONT_FEED_*` tokens should reference base tokens, not be independent
6. Group tokens by abstraction layer: Base → Typography → Spacing → Layout → Component

### Files to modify
- `backend/services/instagram_image_helpers.py` -- token definitions
- `backend/services/instagram_story_composer.py` -- imports only (values stay identical)
- `backend/services/instagram_image_service.py` -- imports only

### Constraint
Pure refactoring. The computed VALUES must stay identical. Only the derivation changes.

---

## ~~NEXT~~ DONE: Story Card Polish (commits 8580128, c3c07e9, 0c31c28)

### Remaining visual issues in story templates

**Detection** (`compose_story_detection` in `instagram_story_composer.py`):
- "Fire stolen from the gods. Every gift is also a weapon." -- Lore text from `ARCHETYPE_DESCRIPTIONS` in `backend/models/resonance.py`. User called it "Glückskeks-Qualität". Needs literary review.
- Archetype name matching: L4 fix added case-insensitive fallback, but the A/B test script passes "Shadow" instead of "The Shadow" -- descriptions don't render. Test script at `scripts/generate_ab_80_gallery.py` line ~170.
- Lower third (below THREAT ASSESSMENT) still has ~300px empty. Acceptable for Instagram (phone scroll) but could use more content.

**Classification** (`compose_story_classification`):
- "(0.9× baseline)" bottom padding was fixed (L2) but verify it's not clipping
- Corner brackets may look dated -- consider replacing with accent sidebar

**Impact** (`compose_story_impact`):
- Event list items: `FONT_BODY` (32px), dimmer than meta line -- fixed. But indent `88px` = `MARGIN_PAGE + FONT_CAPTION + 4` could be token-derived
- Closing text ellipsis truncation working
- With banner background: looks great. Without: filler helps but still sparse

**Advisory** (`compose_story_advisory`):
- Operative symbols (Unicode chess pieces ♜♞♝♛♚) render generically on some fonts
- 0v0 empty case still shows blank panel -- maybe skip panel entirely when both empty

**Subsiding** (`compose_story_subsiding`):
- Stats panel spacing: JUST fixed (panel_pad = SPACING_MD, stat_y inside panel)
- Stats label offset `STATS_LABEL_OFFSET = 145` is magic -- should be `FONT_STAT + 5`

### Test infrastructure
- `scripts/generate_ab_80_gallery.py` -- 80-image A/B comparison (5 sims × feed posts + story templates)
- `scripts/generate_stress_test_graphics.py` -- 52 edge-case stress tests
- `scripts/generate_real_instagram_gallery.py` -- real production images
- Images synced from production: Velgarien, Cité des Dames, Spengbab's Grease Pit, Time Bank of Momo, Metamorphosis of Memory
- A/B comparison HTML at `_test_output/ab_80_comparison.html`

### Production image sync
Images already synced from `https://bffjoupddfjaljqrwqck.supabase.co` to local `http://127.0.0.1:54321` for all 5 simulations. Sync script at `scripts/sync_prod_images_to_local.py`.

---

## Key file locations

| File | Purpose |
|------|---------|
| `backend/services/instagram_image_helpers.py` | Design tokens + Pillow primitives |
| `backend/services/instagram_story_composer.py` | 5 story templates (StoryComposer class) |
| `backend/services/instagram_image_service.py` | Feed post overlay + orchestration |
| `backend/tests/unit/test_instagram_image.py` | 101 unit tests |
| `backend/models/resonance.py` | ARCHETYPE_DESCRIPTIONS (lore text for detection cards) |
| `docs/analysis/social-media-full-audit-2026-04-14.md` | Original audit report |
| `scripts/_velgarien_image_prompts.py` | FLUX prompt library |
