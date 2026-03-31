---
title: "The Devouring Mother — Implementation Plan"
version: "1.0"
date: "2026-03-31"
type: research
status: ready
lang: en
tags: [dungeon, archetype, devouring-mother, implementation-plan]
---

# The Devouring Mother — Implementation Plan

## Overview

7 phases, matching the Entropy implementation structure. Each phase is independently committable and testable. Total estimated additions: ~2000 lines across 8 files.

Reference: `docs/research/devouring-mother-full-design.md` (the full design spec).

---

## Phase A: Backend Config + Strategy (~200 lines, 2 files)

### Files Modified

1. **`backend/services/dungeon/dungeon_archetypes.py`**
   - Replace the stub `"The Devouring Mother"` config (lines 120-128) with full mechanic_config
   - Add `prose_style`, `aptitude_weights`, `atmosphere_enter_en/de`
   - Mechanic config: `start_attachment`, `max_attachment`, `gain_depth_*`, `heal_*`, thresholds
   - Room distribution already exists (line 242) — no change needed

2. **`backend/services/dungeon/archetype_strategies.py`**
   - Add `DevouringMotherStrategy(ArchetypeStrategy)` class (~80 lines)
   - Methods: `init_state`, `apply_drain`, `apply_restore` (INVERTED), `apply_encounter_effects`, `get_ambient_stress_multiplier` (INVERTED — <1.0), `on_combat_round`, `on_failed_check`, `on_enemy_hit`
   - Private: `_apply_room_entry_gain`, `_apply_passive_heal`
   - Register in `_ARCHETYPE_STRATEGIES` dict (line 328-332)

### Integration Points (0 engine changes needed)

- `get_archetype_strategy()` → auto-resolves via registry dict
- `on_enemy_hit()` → hook already exists from Entropy
- All strategy methods called via ABC interface — zero engine conditionals

### Verification

- `ruff check backend/services/dungeon/archetype_strategies.py`
- `ruff check backend/services/dungeon/dungeon_archetypes.py`
- Existing tests pass (strategy not instantiated unless dungeon uses this archetype)

---

## Phase B: Enemy Templates + Spawn Configs (~180 lines, 1 file)

### File Modified

1. **`backend/services/dungeon/dungeon_combat.py`**
   - Add `MOTHER_ENEMIES: dict[str, EnemyTemplate]` after Entropy section (line 578)
     - `mother_nutrient_weaver` (minion, nurture ability)
     - `mother_tether_vine` (standard, grapple + root)
     - `mother_spore_matron` (standard, spore_cloud + nurture)
     - `mother_host_warden` (elite, embrace + summon_weavers + spore_cloud)
   - Add `MOTHER_SPAWN_CONFIGS: dict[str, list[dict]]` (6 configs)
   - Register in `_ENEMY_REGISTRIES` (line 610-614): add `"The Devouring Mother": MOTHER_ENEMIES`
   - Register in `_SPAWN_REGISTRIES` (line 616-620): add `"The Devouring Mother": MOTHER_SPAWN_CONFIGS`
   - Add Mother ambush logic in `check_ambush()` (line 700-722):
     ```python
     elif archetype == "The Devouring Mother":
         mother_config = ARCHETYPE_CONFIGS["The Devouring Mother"]["mechanic_config"]
         attachment = archetype_state.get("attachment", 0)
         if attachment >= 90:
             return random.random() < mother_config.get("high_attachment_ambush_90", 0.25)
         if attachment >= 75:
             return random.random() < mother_config.get("high_attachment_ambush_75", 0.15)
     ```

### Verification

- `ruff check backend/services/dungeon/dungeon_combat.py`
- Existing tests pass

---

## Phase C: Encounter Templates (~350 lines, 1 file)

### File Modified

1. **`backend/services/dungeon/dungeon_encounters.py`**
   - Add after Entropy sections (before Registry, line ~1827):
     - `MOTHER_COMBAT_ENCOUNTERS` (4 templates: weaver drift, vine patrol, spore nursery, garden ambush)
     - `MOTHER_NARRATIVE_ENCOUNTERS` (5 templates: nutrient spring, membrane passage, archive of gifts, garden of acceptance, symbiont offer)
     - `MOTHER_ELITE_ENCOUNTERS` (1 template: the Host Warden encounter)
     - `MOTHER_BOSS_ENCOUNTERS` (1 template: the Living Altar)
     - `MOTHER_REST_ENCOUNTERS` (1 template: the Cradle)
     - `MOTHER_TREASURE_ENCOUNTERS` (1 template: the Mother's Gifts)
   - Add `ALL_MOTHER_ENCOUNTERS` aggregate list
   - Register in `_ENCOUNTER_REGISTRIES` (line 1841-1844): add `"The Devouring Mother": ALL_MOTHER_ENCOUNTERS`

### Key Encounter Details (from design spec §5)

- **The Nutrient Spring** (narrative, depth 1-2): drink/analyze/disrupt/refuse — each choice trades stress heal for attachment
- **The Nursery** (combat, depth 2-3): pods of incorporated beings, Spore Matron + Weaver
- **The Archive of Gifts** (narrative/treasure, depth 2-4): accept all/selective/destroy — gift quality vs attachment cost
- **The Living Altar** (boss, depth 4+): Host Warden with +3 attachment/round AND -5 stress/round
- **The Cradle** (rest): enhanced rest/Guardian sever/Propagandist resist — 3 options per rest site

### Verification

- `ruff check backend/services/dungeon/dungeon_encounters.py`

---

## Phase D: Banter Templates (~400 lines, 1 file)

### File Modified

1. **`backend/services/dungeon/dungeon_encounters.py`** (same file, banter section)
   - Add `MOTHER_BANTER: list[dict]` after Entropy banter (line ~2993)
   - ~45 entries with `attachment_tier` field (0, 1, 2) — parallel to Entropy's `decay_tier`
   - Triggers: `room_entered` (9), `combat_won` (4), `attachment_dependent` (3), `attachment_critical` (3), `agent_stressed` (3), `depth_change` (4), `rest_start` (3), `loot_found` (3), `boss_approach` (2), `retreat` (3), `dungeon_completed` (2), `ambush` (2), `elite_approach` (2), `agent_downed` (2)
   - Register in `_BANTER_REGISTRIES` (line 2998-3001): add `"The Devouring Mother": MOTHER_BANTER`
   - Add `_mother_attachment_tier()` function (parallel to `_entropy_decay_tier()`, line 3005-3014):
     ```python
     def _mother_attachment_tier(archetype_state: dict) -> int:
         attachment = archetype_state.get("attachment", 0)
         if attachment >= 75:
             return 2
         if attachment >= 45:
             return 1
         return 0
     ```
   - Extend `select_banter()` function (line 3042-3048) with Mother tier filtering:
     ```python
     elif archetype == "The Devouring Mother" and archetype_state:
         tier = _mother_attachment_tier(archetype_state)
         tier_candidates = [b for b in candidates if b.get("attachment_tier", 0) <= tier]
         if tier_candidates:
             max_tier = max(b.get("attachment_tier", 0) for b in tier_candidates)
             candidates = [b for b in tier_candidates if b.get("attachment_tier", 0) == max_tier]
     ```

### Literary Standard

Every banter entry must meet VanderMeer/Butler/Jackson quality bar. See design spec §4.2 for reference sentences. The warmth gradient is the signature feature — text gets WARMER, not shorter. German translations must use Jelinek/Haushofer register.

### Verification

- `ruff check backend/services/dungeon/dungeon_encounters.py`

---

## Phase E: Loot Tables (~200 lines, 1 file)

### File Modified

1. **`backend/services/dungeon/dungeon_loot.py`**
   - Add after Entropy loot (line ~694):
     - `MOTHER_LOOT_TIER_1` (4 items: nutrient_concentrate, binding_insight, warmth_fragment, tissue_sample)
     - `MOTHER_LOOT_TIER_2` (5 items: symbiont_shard, membrane_key, guardian_graft, spore_catalyst, cradle_map)
     - `MOTHER_LOOT_TIER_3` (3 items: restoration_organ, nursery_memory, symbiont_attunement)
     - `MOTHER_LOOT_TABLES` dict
   - Register in `_LOOT_REGISTRIES` (line 699-703): add `"The Devouring Mother": MOTHER_LOOT_TABLES`
   - Add Mother-specific loot logic in `roll_loot()` (line ~758, after Entropy block):
     ```python
     elif archetype == "The Devouring Mother":
         attachment = (archetype_state or {}).get("attachment", 0)
         # High-attachment bonus: attachment >= 60 → 30% Tier 1→Tier 2
         if attachment >= 60 and tier == 1 and random.random() < 0.3:
             tier2_table = loot_tables.get(2, [])
             if tier2_table:
                 tier2_weights = [item.drop_weight for item in tier2_table]
                 selected = random.choices(tier2_table, weights=tier2_weights, k=1)
         # Low-attachment penalty: attachment <= 15 → 30% Tier 2→Tier 1
         elif attachment <= 15 and tier == 2 and random.random() < 0.3:
             tier1_table = loot_tables.get(1, [])
             if tier1_table:
                 tier1_weights = [item.drop_weight for item in tier1_table]
                 selected = random.choices(tier1_table, weights=tier1_weights, k=1)
     ```

### Verification

- `ruff check backend/services/dungeon/dungeon_loot.py`

---

## Phase F: Frontend (~150 lines, 3 files)

### MUST: Invoke `frontend-design` skill BEFORE writing any component code.

### Files Modified

1. **`frontend/src/types/dungeon.ts`** (~20 lines)
   - Add `export const ARCHETYPE_MOTHER = 'The Devouring Mother';` (after line 20)
   - Add `MotherArchetypeState` interface: `{ attachment: number; max_attachment: number; }`
   - Add to `ArchetypeState` union type
   - Add `isMotherState()` type guard
   - Add export to import line in `dungeon-formatters.ts`

2. **`frontend/src/utils/dungeon-formatters.ts`** (~50 lines)
   - Import `ARCHETYPE_MOTHER`, `isMotherState` from types
   - Add `formatArchetypeBriefing` case for Mother (before the `else` Shadow default, line ~221)
   - Add `isMotherState` rendering in `formatRoomEntry` (after Entropy block, line ~319):
     ```typescript
     } else if (isMotherState(archetypeState)) {
       const { attachment, max_attachment } = archetypeState;
       const filled = Math.round(attachment / 5);
       const empty = Math.round((max_attachment - attachment) / 5);
       const bar = '\u2591'.repeat(empty) + '\u2588'.repeat(filled);
       lines.push(systemLine(`PARASITIC ATTACHMENT: ${bar} [${attachment}/${max_attachment}]`));
     }
     ```

3. **`frontend/src/components/dungeon/DungeonHeader.ts`** (~80 lines)
   - Import `isMotherState`, `ARCHETYPE_MOTHER`
   - Add Mother archetype color (warm organic tone, e.g. `var(--color-danger, #f87171)` or amber)
   - Add `motherState` extraction in render method
   - Add attachment gauge HTML (after Entropy decay block, line ~493):
     - CSS classes: `.attachment`, `.attachment__icon`, `.attachment__track`, `.attachment__fill`, `.attachment__label`
     - Threshold classes: `--normal` (0-44), `--dependent` (45-74), `--critical` (75-99), `--incorporation` (100)
     - Color: warm amber/orange progression, NOT red/danger. The gauge should feel warm, not alarming.

### Verification

- `npx tsc --noEmit` (full TypeScript check)
- Visual inspection in browser

---

## Phase G: Integration Tests + Lint (~100 lines)

### Verification Steps

1. `cd backend && ruff check .` — full backend lint
2. `cd frontend && npx tsc --noEmit` — full TypeScript check
3. `cd frontend && bash scripts/lint-color-tokens.sh` — color token compliance
4. `cd frontend && bash scripts/lint-llm-content.sh` — content quality
5. Manual smoke test: start dev servers, enter a Devouring Mother dungeon, verify:
   - Attachment counter visible and rising
   - Banter warmth gradient working
   - Enemy `nurture` action healing party
   - Rest site increasing attachment
   - Protocol briefing displaying correctly

### Test Scenarios

1. **Basic flow:** Enter dungeon → 3 rooms → rest → combat → retreat. Verify attachment accumulates, stress heals passively.
2. **Guardian Sever:** Enter dungeon → accumulate 30+ attachment → use Sever → verify -10.
3. **Warmth gradient:** Reach 45+ attachment → verify stress multiplier < 1.0 (reduced stress).
4. **Boss fight:** Reach boss → verify +3 attachment/round, embrace ability works.
5. **Exit cost:** Reach 75+ attachment → retreat → verify stress spike.

---

## File Change Summary

| File | Phase | Est. Lines | Description |
|------|-------|-----------|-------------|
| `dungeon_archetypes.py` | A | +60 | Full mechanic_config replacing stub |
| `archetype_strategies.py` | A | +100 | DevouringMotherStrategy class + registry |
| `dungeon_combat.py` | B | +180 | 4 enemies, 6 spawn configs, ambush logic |
| `dungeon_encounters.py` | C+D | +750 | 13 encounters + 45 banter templates |
| `dungeon_loot.py` | E | +200 | 12 loot items + Mother-specific loot logic |
| `dungeon.ts` | F | +20 | Types, constant, type guard |
| `dungeon-formatters.ts` | F | +50 | Protocol briefing + room entry display |
| `DungeonHeader.ts` | F | +80 | Attachment gauge CSS + HTML |
| **Total** | | **~1440** | |

---

## Dependency Order

```
Phase A (Strategy + Config) → independent, no dependencies
Phase B (Enemies) → depends on A (needs archetype in registry)
Phase C (Encounters) → depends on B (combat_encounter_id references spawns)
Phase D (Banter) → depends on A (attachment_tier filtering)
Phase E (Loot) → depends on A (attachment-based loot logic)
Phase F (Frontend) → depends on A (needs archetype state shape)
Phase G (Tests) → depends on all

Optimal order: A → B → C → D → E → F → G
```

Each phase is independently committable after A is done. B/C/D/E/F can theoretically be done in any order after A, but C depends on B for combat_encounter_id references.
