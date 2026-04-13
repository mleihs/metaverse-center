# Dungeon E2E Playtest — The Overthrow (2026-04-13)

## Development Remediation Document

> **Purpose**: Self-contained implementation guide for all findings from the Overthrow E2E playtest.
> Designed for context-clear stepwise execution. Each issue has: root cause, exact code locations, architectural fix strategy, and verification.

---

## Run Data

- **Archetype**: The Overthrow (Velgarien)
- **Difficulty**: 3/5 (***··), **Depth**: 6
- **Party**: Lena Kray (SAB 9), General Aldric Wolf (ASS 9), Elena Voss (SPY 9)
- **Result**: VICTORY (Boss defeated Round 2)
- **Final Fracture**: 57/100
- **Path**: D0→D1(Combat)→D2(Encounter)→D3(Encounter)→D4(Encounter)→D5(Threshold)→D6(Boss)

---

## Priority Legend

| Priority | Meaning |
|----------|---------|
| **P0** | Game-breaking — mechanic entirely non-functional |
| **P1** | Critical — data leaks, backend errors, broken features |
| **P2** | High — significant UX/game design issues |
| **P3** | Medium — polish, consistency, quality-of-life |
| **P4** | Low — minor polish |

---

## P0 — GAME-BREAKING

### P0-01: RALLY / SEAL / GROUND min_aptitude on wrong scale (40 vs 3-9)

**Impact**: The Overthrow's RALLY, Deluge's SEAL BREACH, and Awakening's GROUND abilities are **impossible for ALL agents**. `rally_min_aptitude: 40` but aptitude scale is 3-9 (budget 36 total across 6 schools). These are the PRIMARY archetype mechanics for fracture reduction, flood sealing, and consciousness grounding respectively. Three archetypes have broken core mechanics.

**Root Cause**:
- `backend/services/dungeon/dungeon_archetypes.py:273` — `"rally_min_aptitude": 40` (Overthrow)
- `backend/services/dungeon/dungeon_archetypes.py:229` — `"seal_min_aptitude": 40` (Deluge)
- `backend/services/dungeon/dungeon_archetypes.py:425` — `"ground_min_aptitude": 40` (Awakening)

**Validation gates** (all fail because no agent reaches 40):
- `backend/services/dungeon_movement_service.py:732` — `if propagandist_level < mc.get("rally_min_aptitude", 40)`
- `backend/services/dungeon_movement_service.py:602` — `if guardian_level < mc.get("seal_min_aptitude", 40)`
- `backend/services/dungeon_movement_service.py:668` — `if spy_level < mc.get("ground_min_aptitude", 40)`

**Fix**: Change all three values from `40` to `4`. Verify against `backend/models/aptitude.py:17-19` (`APTITUDE_MIN = 3`, `APTITUDE_MAX = 9`). Value `4` means "needs at least moderate aptitude" — reasonable gate.

**Also update the SQL seed** in `supabase/migrations/` if these configs are seeded there.

**Verification**: Start a dungeon, select an agent with propagandist >= 4, type `rally` — should succeed instead of throwing "Agent needs Propagandist 40+".

---

## P1 — CRITICAL

### P1-01: Dev-note leaked in Inspire ability description

**Impact**: Players see internal balance commentary: `"Heal 120 stress (Review #11: increased from 75)"`

**Root Cause**:
- `backend/services/combat/ability_schools.py:203` — `description_en="Rally an ally. Heal 120 stress (Review #11: increased from 75)."`
- `backend/services/combat/ability_schools.py:204` — `description_de="Einen Verbundeten aufmuntern. Heilt 120 Stress (Review #11: erhoht von 75)."`
- Same text propagated to SQL seed: `supabase/migrations/20260401100000_171_dungeon_content_seed.sql:701`

**Fix**: Remove `(Review #11: increased from 75)` / `(Review #11: erhoht von 75)` from both strings. Final descriptions: `"Rally an ally. Heal 120 stress."` / `"Einen Verbündeten aufmuntern. Heilt 120 Stress."`

**Also**: Run `grep -r "Review #" backend/services/combat/` to verify no other dev notes leaked. The agent confirmed all other `Review #` references are in code comments only.

---

### P1-02: Mirror Shard loot assignment — personality_modifier dimension error

**Impact**: 400 Bad Request when assigning Overthrow Tier 3 loot "Mirror Shard of the Spiegelpalast". Same issue affects any `personality_modifier` loot with a pre-baked trait.

**Root Cause (backend validation gap)**:
- `backend/services/dungeon_distribution_service.py:246-248`:
  ```python
  if loot_item.get("effect_type") == "personality_modifier":
      if not dimension or dimension not in BIG_FIVE_DIMENSIONS:
          raise bad_request(...)
  ```
- The Mirror Shard at `backend/services/dungeon/dungeon_loot.py:1895` has `effect_type: "personality_modifier"` with `effect_params: {"trait": "openness", "delta": 5}` — the dimension is **pre-baked in the item**.
- Frontend `dungeon-commands.ts:577-580` never sends a `dimension` field.
- The validation was designed for Awakening's "choose-your-trait" mechanic, not for fixed-trait items.

**Architectural Fix** (backend, not frontend):
The **cleanest** approach is: backend auto-extracts `dimension` from `effect_params.trait` when no explicit dimension is provided. This handles BOTH cases (Awakening choose-your-trait AND Overthrow fixed-trait) in one code path.

Change `dungeon_distribution_service.py:246-248` to:
```python
if loot_item.get("effect_type") == "personality_modifier":
    effective_dimension = dimension or loot_item.get("effect_params", {}).get("trait")
    if not effective_dimension or effective_dimension not in BIG_FIVE_DIMENSIONS:
        raise bad_request(...)
    dimension = effective_dimension  # use for downstream processing
```

**Why not frontend fix?** Adding dimension prompting to the frontend's `assign` command adds complexity to the player experience for items that already know their target. The backend should be smart enough to use the item's own data.

---

### P1-03: `threshold_choice` + `combat_stalemate` violate DB CHECK constraint

**Impact**: Threshold events and stalemate events silently fail to log. Event history is incomplete.

**Root Cause**:
- `supabase/migrations/20260327100000_163_resonance_dungeons.sql:129-136` — CHECK constraint lists 16 allowed event types. Missing: `threshold_choice`, `combat_stalemate`.
- `backend/services/dungeon_movement_service.py:1114` logs `"threshold_choice"`
- `backend/services/dungeon_combat_service.py:448` logs `"combat_stalemate"`

**Fix**: New migration:
```sql
ALTER TABLE resonance_dungeon_events DROP CONSTRAINT resonance_dungeon_events_event_type_check;
ALTER TABLE resonance_dungeon_events ADD CONSTRAINT resonance_dungeon_events_event_type_check
    CHECK (event_type IN (
        'room_entered', 'combat_started', 'combat_resolved',
        'skill_check', 'encounter_choice', 'loot_found',
        'agent_stressed', 'agent_afflicted', 'agent_virtue',
        'agent_wounded', 'party_wipe', 'boss_defeated',
        'dungeon_completed', 'dungeon_abandoned',
        'banter', 'discovery',
        'threshold_choice', 'combat_stalemate'
    ));
```

---

### P1-04: Achievement tables missing — `achievement_progress` + `user_achievements`

**Impact**: ALL achievement tracking silently fails. Badge awards, progress increments — all dead.

**Root Cause**:
- Migration 190 (`20260410400000_190_achievement_system.sql`) creates both tables but appears NOT applied to the running database.
- Even if applied, `achievement_progress` is missing a `context JSONB` column that `fn_increment_progress_unique` (migration 194/197) references.
- Python code: `backend/services/dungeon/dungeon_achievements.py:156` (`_award`) and `:221` (`_increment_unique`)

**Fix**:
1. Verify migration 190 is applied: `SELECT * FROM schema_migrations WHERE version = '20260410400000'`
2. If not applied: run `supabase db push` or apply manually
3. New migration to add missing column:
   ```sql
   ALTER TABLE achievement_progress ADD COLUMN IF NOT EXISTS context JSONB NOT NULL DEFAULT '{}';
   ```

---

## P2 — HIGH

### P2-01: Skill check display shows raw_roll, ignoring adjustment

**Impact**: Players see roll values that don't correlate with outcomes. "Roll 19 at 77% = PARTIAL" makes no sense without seeing the adjustment.

**Root Cause (frontend display, NOT logic bug)**:
The backend logic is **correct**: `effective_roll = raw_roll + (check_value - 55)`. Outcomes: ≤30=FAIL, 31-70=PARTIAL, ≥71=SUCCESS.
But `frontend/src/utils/dungeon-formatters.ts`:
- Line 1042: Rolling bar shows `check.chance` (the modifier), not the roll
- Line 1052: Result line shows `check.roll` (raw_roll) without the adjustment
- The `breakdown` field (containing `raw_roll`, `adjustment`, `final_check_value`) is available but **never read**

**Architectural Fix**:
The backend's `format_check_for_terminal()` (`backend/services/combat/skill_checks.py:227-286`) already produces correct formatted output like `"Rolling... 19 (19+22=41) — PARTIAL SUCCESS"`. The frontend's `formatSkillCheckResult()` reimplements this incorrectly.

The clean fix: Frontend should use the `breakdown` data. Change the display to show:
```
[GUARDIAN CHECK — Modifier: +22]
Rolling... 19 (+22) = 41
Result: PARTIAL SUCCESS (need 71+ for full success)
```
This makes the mechanic transparent. Key changes in `dungeon-formatters.ts:1035-1060`.

---

### P2-02: Encounter deduplication missing — same template can repeat

**Impact**: In our playtest, the "Havel's greengrocer" encounter appeared 3× consecutively. Breaks immersion.

**Root Cause**:
- `backend/services/dungeon/dungeon_encounters.py:7948-7969` — `select_encounter()` uses `random.choice(candidates)` with **no deduplication**.
- Banter system HAS deduplication: `dungeon_banter.py:2700` filters via `used_banter_ids`. Encounters don't.
- Overthrow has 5 narrative encounters but 45% encounter room weight — highest ratio of all archetypes.

**Architectural Fix** (follow existing banter pattern):
1. Add `used_encounter_ids: list[str] = []` to `DungeonInstance` in `backend/models/resonance_dungeon.py`
2. In `select_encounter()`, filter: `[e for e in candidates if e.id not in used_ids]`
3. After selection, append to `used_encounter_ids`
4. Include in checkpoint serialization/restore
5. If pool exhausted, reset (allow repeats as last resort)

---

### P2-03: Combat timer — onboarding doesn't pause, clock skew eats time

**Impact**: Timer shows 34-36s instead of 42s due to clock skew. Onboarding briefing runs DURING countdown. First-time players always time out.

**Root Cause**:
- Timer: `backend/services/dungeon_shared.py:32-34` — 45s server / 42s client (3s buffer)
- Timer uses `started_at=datetime.now(UTC)` (server clock). Client computes remaining via `Date.now()`. Clock skew + network latency eat ~6s.
- Onboarding: `frontend/src/components/dungeon/DungeonCombatBar.ts:1067-1090` — briefing shows but timer runs underneath
- Warning: Color change at 10s/5s (`DungeonCombatBar.ts:43-44`) but no audio/modal alert

**Architectural Fix** (NOT just "increase duration"):
1. **Backend sends `remaining_ms` instead of `started_at + duration_ms`**: Change `PhaseTimer` to include `remaining_ms = COMBAT_PLANNING_TIMEOUT_MS - CLIENT_TIMER_BUFFER_MS`. Frontend starts countdown from this value using its own clock. Eliminates clock skew entirely.
2. **Pause timer during onboarding**: In `DungeonStateManager._startTimer()`, check if `combatOnboarded` localStorage flag is unset. If so, don't start the timer tick until the briefing is acknowledged.
3. **Increase base to 60s**: Change `COMBAT_PLANNING_TIMEOUT_MS` from `45_000` to `63_000` (60s client after 3s buffer). Provides breathing room.
4. **Timer unit label**: Add `s` suffix in `DungeonCombatBar.ts:850`: `${seconds}s`

---

### P2-04: Banter references "The Pretender" in non-boss rooms

**Impact**: Player sees "The Pretender speaks..." banter in an Elite room where "Grand Inquisitor" is the actual enemy. Perceived name mismatch.

**Root Cause**:
- `backend/services/dungeon/dungeon_banter.py:2506` — `"The Pretender speaks. {agent} has heard these words before..."` trigger: `room_entered`, no depth filter
- `backend/services/dungeon/dungeon_banter.py:2562` — `"Power is not a means; it is an end... The Pretender knows this."` trigger: `combat_start`, no depth filter

**Fix**: Add `min_depth: 6` (boss depth) to both banter entries so they only fire in the boss room. Or add a `boss_only: True` filter. The banter system already supports `min_depth` filtering at `dungeon_banter.py:2700`.

---

### P2-05: Scout/Boss/Rest/Treasure text uses generic "darkness" — not archetype-aware

**Impact**: Overthrow's intro says "The lighting is excellent. Everything is visible." but scout says "probes the surrounding darkness". Thematic whiplash.

**Root Cause**:
- `frontend/src/utils/dungeon-formatters.ts:1099-1103` — Only Tower gets custom scout text, 7 others → "darkness"
- `frontend/src/utils/dungeon-formatters.ts:629,634,638` — Rest/Treasure/Boss room headers all use darkness/shadow text

**Architectural Fix** (data-driven, not code-branching):
The `ARCHETYPE_CONFIGS` dict in `dungeon_archetypes.py` already has text fields (`tagline_en/de`, `prose_style`, `atmosphere_enter_en/de`). Add archetype-specific ambient text:
```python
"ambient_texts": {
    "scout_verb_en": "surveys the transparent corridors",
    "scout_verb_de": "überprüft die transparenten Korridore",
    "boss_intro_en": "The mirrors intensify. Every reflection is a verdict.",
    "boss_intro_de": "Die Spiegel intensivieren sich. Jede Spiegelung ist ein Urteil.",
    "rest_en": "A room where the cameras have been covered.",
    "rest_de": "Ein Raum, in dem die Kameras abgedeckt wurden.",
    "treasure_en": "Files left exposed. Someone wanted these found.",
    "treasure_de": "Akten, offen gelassen. Jemand wollte, dass sie gefunden werden.",
}
```

Backend sends these in the archetype config that's already part of client state. Frontend reads them instead of hardcoded strings. **No if/else branches**. Scales cleanly to new archetypes.

---

### P2-06: Threshold choice descriptions stripped during serialization

**Impact**: Player sees [1] Blood Toll, [2] Memory Toll, [3] Defiance — with NO description. Blind irreversible choice.

**Root Cause**:
- Descriptions **exist** in `backend/services/dungeon/dungeon_threshold.py:16-41`:
  - Blood Toll: "A wound, freely given. One operative takes one condition step. Known cost."
  - Memory Toll: "Something forgotten. You will not know what was taken. Unknown cost."
  - Defiance: "Pass without tribute. The passage remembers. Deferred cost."
- `backend/services/dungeon_checkpoint_service.py:392-412` — `format_encounter_choices()` explicitly maps only `id, label_en/de, requires_aptitude, check_aptitude, check_difficulty`. **Drops** `description_en/de`.
- `frontend/src/utils/dungeon-formatters.ts:1012` — `localized(choice, 'description')` correctly tries to render it, gets `undefined`.
- `frontend/src/types/dungeon.ts:536-543` — `EncounterChoiceClient` type has no description fields.

**Fix**:
1. `dungeon_checkpoint_service.py:402-412` — Add `"description_en"` and `"description_de"` to the output dict
2. `dungeon.ts:536-543` — Add `description_en?: string; description_de?: string` to `EncounterChoiceClient`
3. Frontend renderer already handles display — just needs the data.

---

### P2-07: Two identical "Move → Encounter D2" buttons

**Root Cause**: `frontend/src/components/dungeon/DungeonQuickActions.ts:315-319` — `pathLabel` (alpha/beta) only appended to unrevealed rooms. Revealed rooms with same type+depth get identical labels.

**Fix**: Line 318 — append `pathLabel` in the revealed branch too:
```typescript
// Before:
const label = isRevealed
  ? `${getRoomTypeLabel(room.room_type, room.index)} D${room.depth}${clearedTag}`
  : `D${room.depth}${pathLabel}`;
// After:
const label = isRevealed
  ? `${getRoomTypeLabel(room.room_type, room.index)} D${room.depth}${pathLabel}${clearedTag}`
  : `D${room.depth}${pathLabel}`;
```

---

## P3 — MEDIUM

### P3-01: Bare numbers rejected for encounter choices

**Root Cause**: `frontend/src/utils/dungeon-commands.ts:130-182` — `dispatchDungeonCommand()` has no bare-number detection. When "3" is typed, it falls through all checks, hits fuzzy matcher, suggests "look".

**Fix**: Add phase-aware number shortcut in `dispatchDungeonCommand()` (between line 154 and 157):
```typescript
if (/^\d+$/.test(verb) && terminalState.isDungeonMode.value) {
    const phase = dungeonState.phase.value;
    if (phase === 'encounter' || phase === 'rest' || phase === 'threshold') {
        return handleDungeonInteract({ ...ctx, args: [verb] });
    } else if (phase === 'exploring' || phase === 'room_clear') {
        return handleDungeonMove({ ...ctx, args: [verb] });
    }
}
```

**Also fix UX-10**: When in dungeon encounter phase, the fuzzy match (`terminal-commands.ts:1656-1674`) should contextually suggest `interact <number>` instead of "look". Pass phase context to the fuzzy-match block.

---

### P3-02: All 3 loot items suggested to same agent

**Root Cause**: `backend/services/dungeon_checkpoint_service.py:447-448` — the `else` branch in `_compute_loot_suggestions()` always returns `operational[0]`. No differentiation for `simulation_modifier`/`personality_modifier` items.

**Fix** — effect-type-aware suggestion logic (personality data IS available on `AgentCombatState.personality: dict[str, float]` at `backend/models/combat.py:57`):

```python
elif effect_type == "personality_modifier":
    # Agent with lowest value in the target trait benefits most
    trait = item.get("effect_params", {}).get("trait")
    if trait and operational:
        best = min(operational, key=lambda a: a.personality.get(trait, 50.0))
        suggestions[item["id"]] = str(best.agent_id)
    else:
        suggestions[item["id"]] = str(operational[robin_idx % len(operational)].agent_id)
        robin_idx += 1
elif effect_type == "simulation_modifier":
    # Simulation-wide effect — agent mechanically irrelevant, distribute fairly
    suggestions[item["id"]] = str(operational[robin_idx % len(operational)].agent_id)
    robin_idx += 1
else:
    # Unknown types: round-robin as safe default
    suggestions[item["id"]] = str(operational[robin_idx % len(operational)].agent_id)
    robin_idx += 1
```

This is optimal because: (1) `personality_modifier` uses stat-aware best-fit, (2) `simulation_modifier` distributes fairly, (3) unknown types get round-robin as safe fallback, (4) no additional DB query needed — personality data already on `AgentCombatState`.

---

### P3-03: No warning when party lacks critical aptitude for archetype

**Root Cause**: `frontend/src/utils/dungeon-entry-flow.ts:174-193` — agent selection has ZERO aptitude validation. Auto-pick (lines 158-171) sums ALL aptitudes without considering archetype weights.

**Fix**: After party selection (line 190), before `startDungeonRun()`:
1. Derive the archetype's critical aptitude from `ARCHETYPE_CONFIGS.aptitude_weights` (highest weight)
2. Check if any selected agent has that aptitude above the min threshold
3. If not, append a `warningLine()` to the output: `"⚠ No agent has Propagandist 4+. RALLY will be unavailable."`
4. Don't BLOCK the run — just WARN. Player may want the challenge.

---

### P3-04: Combat bar overflows viewport + ability descriptions shown twice

**Root Cause (UX-06)**: `DungeonCombatBar.ts:58-62` — no `max-height`/`overflow-y`. Grid row `auto` in `DungeonTerminalView.ts:84` grows unbounded.

**Root Cause (UX-07)**: `dungeon-formatters.ts:710-753` — `formatCombatPlanning()` dumps ALL abilities with full descriptions to terminal. Combat bar shows same abilities as buttons.

**Architectural Fix**:
1. `DungeonTerminalView.ts:84` — Change grid row 4 from `auto` to `minmax(auto, 40vh)`:
   ```css
   grid-template-rows: auto 1fr auto minmax(auto, 40vh);
   ```
2. `DungeonCombatBar.ts:155` — Add `overflow-y: auto` to `.agents` container
3. `dungeon-formatters.ts:710-753` — Replace full ability dump with compact summary:
   ```
   ═══ COMBAT — Round 1/10 ═══
   ENEMIES: Faction Informer [MINION] × 2
   Select abilities in the combat bar below. Type "help combat" for commands.
   ```
   Remove per-agent ability listings (lines 720-745). The combat bar IS the UI.

---

### P3-05: Entrance room "look" shows no room text

**Root Cause**: `frontend/src/utils/dungeon-formatters.ts:617-651` — switch has no `case 'entrance':`. Falls through to default which just prints `[ENTRANCE]`. Also: entrance text (the rich intro) is ephemeral — consumed once, never cached.

**Fix**:
1. Add `case 'entrance':` to `formatRoomEntry` with the entrance badge
2. Cache `entrance_text` in `DungeonStateManager` (new signal `lastEntranceText`) so `look` can re-display it
3. Cache per-room narrative data (banter, anchors, barometer) in a `lastRoomNarrative` signal for the general `look` command

---

### P3-06: Stat abbreviations have no tooltips/legend

**Root Cause (UX-01)**: `dungeon-formatters.ts:1545-1589` — `formatAgentPicker()` shows `SPY 9 | INF 8` with no legend.
**Root Cause (UX-03)**: `DungeonPartyPanel.ts:507` — bare `<span>` without `title` or `<velg-tooltip>`.

**Fix**:
1. `formatAgentPicker()` — Add legend line after header: `hintLine("SPY=Spy GRD=Guardian SAB=Saboteur PRP=Propagandist INF=Infiltrator ASN=Assassin")`
2. `DungeonPartyPanel.ts:507` — Wrap each stat span with `<velg-tooltip>`:
   ```typescript
   html`<velg-tooltip content="${OPERATIVE_FULL[k]}">
     <span class="apt">${OPERATIVE_SHORT[k]}${v}</span>
   </velg-tooltip>`
   ```
   Where `OPERATIVE_FULL` maps `spy→"Spy"`, `saboteur→"Saboteur"`, etc. (add to `operative-constants.ts`)

---

## P4 — LOW POLISH

### P4-01: Stale hint after archetype selection

`DungeonTerminalView.ts:717` — Hide when `pendingArchetypeForPicker.value` is set. Conditional render with `nothing`.

### P4-02: Timer missing "s" unit suffix

`DungeonCombatBar.ts:850` — Change `${seconds}` to `${seconds}s`. Also ensure i18n: `msg(str\`${seconds}s\`)`.

### P4-03: Generalist agents show no stats in picker

`dungeon-formatters.ts:1578` — When `aptitudeMap.get(agent.id)` returns undefined, synthesize default `{spy:6, guardian:6, ...}` instead of showing bare "generalist".

### P4-04: UX-13 Defiance — no mechanical feedback

**BY DESIGN.** The spec (`docs/concepts/dungeon-threshold-room.md:83-99`) explicitly documents: "The player is NOT told what changed." Defiance silently increases boss difficulty by +1. This is intentional game design — deferred hidden cost, Kahneman insight. **No fix needed.**

**However**: The spec mentions the boss should gain "one extra ability from the archetype pool" — this is NOT implemented. The current code only increases `effective_difficulty`. This is a **spec gap** to track separately.

---

## Investigation Items

### INV-01: LVL display in dungeon statusbar

The `LVL 1` → `LVL 2` change observed during the run is likely the **terminal clearance level** (a general terminal feature), not a party level-up. The dungeon has no party level mechanic. Verify: check `BureauTerminal.ts` or `DungeonTerminalView.ts` for `LVL` rendering logic and what signal it reads.

### INV-02: Overthrow encounter pool size

The Overthrow has 5 narrative encounter templates but the highest encounter room weight (45%). With deduplication fix (P2-02), a Depth-6 dungeon with ~3 encounter rooms will consume 3/5 templates per run. Consider adding 3-5 more narrative encounters to prevent "last template" repeats. This is a content task, not a code task.

---

## Implementation Status: ALL PHASES COMPLETE (2026-04-13)

> All 19 issues resolved in a single session. Self-audit found 5 additional issues (i18n module-scope msg(), stale remaining_ms on restore, missing error SFX on bare numbers, DRY violation in banter tier filter, missing rally/ground frontend commands). Type audit found 6 missing fields across 4 response types. All fixed.

## Implementation Order (Recommended)

**Phase 1 — Data fixes (no architecture changes)**:
1. P0-01: Fix min_aptitude 40→4 (3 lines in `dungeon_archetypes.py`)
2. P1-01: Remove dev note (2 lines in `ability_schools.py`)
3. P1-03: Expand CHECK constraint (new migration)
4. P1-04: Verify migration 190 + add context column (new migration)
5. P2-04: Add min_depth to banter entries (2 entries in `dungeon_banter.py`)

**Phase 2 — Backend logic fixes**:
6. P1-02: Auto-extract dimension from effect_params.trait (`dungeon_distribution_service.py`)
7. P2-02: Encounter deduplication (`dungeon_encounters.py` + `resonance_dungeon.py`)
8. P2-06: Pass descriptions through serializer (`dungeon_checkpoint_service.py`)
9. P3-02: Round-robin loot suggestions (`dungeon_checkpoint_service.py`)

**Phase 3 — Frontend UX fixes**:
10. P2-01: Skill check display uses breakdown field (`dungeon-formatters.ts`)
11. P2-03: Timer architecture (remaining_ms, onboarding pause, 60s base, unit label)
12. P2-07: Move button pathLabel for revealed rooms (`DungeonQuickActions.ts`)
13. P3-01: Bare number command shortcut (`dungeon-commands.ts`)
14. P3-04: Combat bar overflow + compact terminal output
15. P3-05: Entrance room look + narrative caching
16. P3-06: Stat tooltips + legend
17. P4-01/02/03: Polish items

**Phase 4 — Data-driven architecture**:
18. P2-05: Archetype ambient texts in ARCHETYPE_CONFIGS (data + frontend)
19. P3-03: Party composition warning with archetype weights

---

## Files Touched (Complete Index)

| File | Issues |
|------|--------|
| `backend/services/dungeon/dungeon_archetypes.py` | P0-01, P2-05, P3-03 |
| `backend/services/combat/ability_schools.py` | P1-01 |
| `backend/services/dungeon_distribution_service.py` | P1-02 |
| `backend/services/dungeon_checkpoint_service.py` | P2-06, P3-02 |
| `backend/services/dungeon/dungeon_encounters.py` | P2-02 |
| `backend/services/dungeon/dungeon_banter.py` | P2-04 |
| `backend/services/dungeon_shared.py` | P2-03 |
| `backend/services/dungeon_combat_service.py` | P2-03 |
| `backend/models/resonance_dungeon.py` | P2-02 |
| `frontend/src/utils/dungeon-formatters.ts` | P2-01, P2-05, P3-04(UX-07), P3-05, P3-06(legend) |
| `frontend/src/utils/dungeon-commands.ts` | P3-01 |
| `frontend/src/components/dungeon/DungeonQuickActions.ts` | P2-07 |
| `frontend/src/components/dungeon/DungeonCombatBar.ts` | P2-03, P3-04(UX-06), P4-02 |
| `frontend/src/components/dungeon/DungeonTerminalView.ts` | P3-04, P4-01 |
| `frontend/src/components/dungeon/DungeonPartyPanel.ts` | P3-06 |
| `frontend/src/types/dungeon.ts` | P2-06 |
| `frontend/src/services/DungeonStateManager.ts` | P2-03, P3-05 |
| `frontend/src/utils/operative-constants.ts` | P3-06 |
| `supabase/migrations/` (new) | P1-03, P1-04 |

---

## Handover — Critical Gotchas

### MUSS VOR JEDEM FIX GELESEN WERDEN

1. **Zeilennummern sind Orientierungspunkte, nicht Garantien.** Die Agents haben am 2026-04-13 recherchiert. Jede Zeile VOR dem Fix nochmals im aktuellen Code verifizieren. `grep` ist dein Freund.

2. **Agent-Ergebnisse wurden NICHT alle persönlich verifiziert.** Die P0/P1-Bugs wurden manuell gegengeprüft (`rally_min_aptitude: 40` bestätigt in `dungeon_archetypes.py`). P2-P4-Bugs basieren auf Agent-Reports mit hoher Konfidenz aber ohne manuelle Verifikation jeder einzelnen Zeilennummer.

3. **SQL Seed Sync**: Wenn Python-Dicts geändert werden (`ability_schools.py`, `dungeon_banter.py`, `dungeon_archetypes.py`), müssen die zugehörigen SQL-Seeds in `supabase/migrations/` ebenfalls aktualisiert werden. Pattern laut CLAUDE.md: "define in Python dict → seed via INSERT ... ON CONFLICT DO UPDATE migration → runtime reads from DB."

4. **P2-03 (Timer)**: Die Umstellung von `started_at + duration_ms` auf `remaining_ms` ist ein Breaking Change im `PhaseTimer`-Model. Frontend UND Backend müssen synchron geändert werden. Die `PhaseTimer`-Definition ist in `backend/models/resonance_dungeon.py` — Feld `remaining_ms` hinzufügen, `started_at` kann bleiben (für Logging), Frontend in `DungeonStateManager.ts:337-368` muss die neue Berechnung verwenden.

5. **P2-05 (Ambient Texts)**: Die `ARCHETYPE_CONFIGS` werden NICHT in die DB gespiegelt — sie leben nur im Python-Dict. Das Frontend braucht Zugang zu den neuen `ambient_texts`. Entweder: (a) Backend sendet sie als Teil des `DungeonClientState`, oder (b) Frontend hat eine eigene Kopie der archetype-spezifischen Texte. Option (a) ist architektonisch sauberer — eine Quelle der Wahrheit.

6. **P0-01 betrifft DREI Archetypes**: Overthrow (`rally`), Deluge (`seal`), Awakening (`ground`). Alle drei `min_aptitude`-Werte auf 4 setzen. Nicht nur den Overthrow fixen!

7. **P4-04 Spec-Gap**: Der Threshold-Defiance-Effekt soll laut Spec auch "one extra ability from the archetype pool" dem Boss geben — das ist NICHT implementiert. Das ist ein separates Feature, kein Bug-Fix. Nicht in diese Remediation aufnehmen.

8. **Lint-Pipeline**: Nach JEDEM Change `ruff check backend/ && cd frontend && npx tsc --noEmit` laufen lassen. CLAUDE.md-Pflicht.

### Empfehlung

**Context Clear, dann Phase 1 starten.** Das Dokument ist self-contained. Phase 1 (5 Data-Fixes) ist in ~20 Minuten machbar und hat den höchsten Impact (P0 game-breaking + P1 criticals). Danach Phase 2 (Backend-Logic), Phase 3 (Frontend-UX), Phase 4 (Data-Driven Architecture) in separaten Sessions.
| `supabase/migrations/` (new) | P1-03, P1-04 |
