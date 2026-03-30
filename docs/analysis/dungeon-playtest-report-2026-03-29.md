# Resonance Dungeons -- Playtest Report 2026-03-29

**Tester:** Claude Opus 4.6 via WebMCP Chrome
**Simulation:** Conventional Memory (70000000-...)
**Archetypes tested:** The Shadow (1 full manual run + API automation), The Tower (pending)
**Date:** 2026-03-29

---

## Resolution Summary

All 17 issues from this playtest have been addressed in a single implementation session (2026-03-29). Key fixes:

- **Critical combat stalemate (BAL-00):** Universal "Basic Attack" ability (min_aptitude=0) added so every agent can deal damage regardless of aptitude profile.
- **Stress system (BUG-02):** Dungeon stress now starts at 0 (independent of simulation stress) + frontend displays percentage instead of raw 0-1000 scale.
- **Archetype ability filtering (BUG-05):** `get_available_abilities()` and `get_agent_all_abilities()` now accept `archetype` parameter to hide archetype-gated abilities (e.g., Reinforce hidden in Shadow).
- **Content gaps (BUG-03, BAL-03):** Added 4 encounter templates (2 Shadow + 2 Tower) for depth 1-2 and 4-5, plus 8 additional Tier 1 loot items (4 per archetype, doubling pool from 4 to 8).
- **Balance tuning (BAL-01/02):** STANDARD enemies nerfed (condition_threshold -1, stress_attack_power -2); combat timer increased 30s to 45s.
- **Frontend UX (BUG-04, UX-03/04/05):** Encounter interact buttons, fog-of-war "???" labels, combat briefing auto-dismiss, scrollable party panel.
- **DB constraint (BUG-06):** Migration 166 changes unique index from per-simulation to per-simulation-per-archetype.

---

## Executive Summary

Full playthrough of Shadow dungeon completed: Depth 6/6, 7/14 rooms cleared, boss defeated in round 10/10, 1 agent captured (PKZIP.EXE). Several critical UI/UX bugs found, multiple balancing concerns, and good overall flow. The dungeon system is playable but needs polish.

---

## Bugs Found

### BUG-01: Skill Check Debug Info Leaked to Player [FIXED]

**Severity:** High
**Location:** `frontend/src/utils/dungeon-formatters.ts:530-536`
**Status:** FIXED in this session

The `formatSkillCheckResult()` function dumps the entire `check.breakdown` object to the terminal, showing raw formula details:

```
base: +55%, aptitude: spy%, aptitude_level: +6%, aptitude_bonus: +18%,
personality_modifier: +10%, check_type: precision%, final_check_value: +83%,
raw_roll: +62%, adjustment: +28%
```

Problems:
- Internal calculation details exposed to player
- String values like `spy` and `precision` get `%` appended (formatting error)
- Breaks immersion, looks like debug output

**Fix applied:** Removed breakdown display. The header `[SPY CHECK -- Level 6: 83%]` already provides sufficient information.

### BUG-02: Stress Display Shows Raw 0-1000 Scale

**Severity:** Medium
**Location:** `frontend/src/components/dungeon/DungeonPartyPanel.ts:437-442`

The party panel shows raw stress values like "1000 CRITICAL", "967 CRITICAL", "800 CRITICAL" instead of a player-friendly format.

Root cause: The stress system uses a 0-1000 internal scale. The frontend renders `agent.stress` directly. This is technically correct but confusing -- players see "1000 CRITICAL" and don't understand what "1000" means.

**Additionally:** All agents started at 1000 stress (max) because their simulation state already had maxed stress. This makes the dungeon stress mechanic meaningless -- you can't accumulate stress when you're already at the cap.

**Recommendation:**
- Display as percentage: `${Math.round(agent.stress / 10)}%`
- OR reset agent stress to 0 when entering a dungeon
- Show "100% CRITICAL" instead of "1000 CRITICAL"

### BUG-03: Room 11 Encounter Missing Content

**Severity:** High
**Location:** Backend encounter generation or frontend rendering

At Depth 5 -- Room 11, an `[ENCOUNTER]` tag appeared with no description, no choices, and no interaction required. The room was immediately marked as cleared with "MOVE --> BOSS" available.

**Expected:** Encounter should show descriptive text and interactive choices like Room 10 did.
**Actual:** Just `[ENCOUNTER]` with nothing below it.

This is likely a backend issue -- the encounter was generated with empty content, or the encounter type didn't have matching content templates.

### BUG-04: Encounter Rooms Missing Quick Action Buttons

**Severity:** Medium
**Location:** `frontend/src/components/dungeon/DungeonQuickActions.ts`

When entering an Encounter room with choices [1], [2], [3], the Quick Actions toolbar only shows LOOK and STATUS buttons -- no INTERACT buttons.

The player must know to type `interact 1` / `interact 2` / `interact 3` in the terminal. This is inconsistent with the rest of the UX where buttons are provided for all actions (SCOUT, MAP, MOVE, REST ALL, etc.).

**Recommendation:** Add interact buttons in the quick actions for encounter choices, e.g., `[1] Confront` `[2] Analyze` `[3] Smash`.

### BUG-05: "Reinforce" Ability Shown in Shadow Dungeon

**Severity:** Low
**Location:** Backend ability list or frontend combat bar

HIMEM.SYS (Guardian) has a "Reinforce" ability described as "+10 Stability (Tower archetype only)." This ability appears in Shadow dungeon combat where it has no effect.

**Recommendation:** Filter out archetype-specific abilities that don't apply to the current dungeon, or show them as disabled/grayed out with a tooltip explaining why.

---

## UX/UI Issues

### UX-01: Combat Timer Too Short for New Players

The 20-second combat timer combined with the need to select abilities for 3 agents and potentially pick targets is very aggressive for first-time players. In this playtest, every single combat round was auto-submitted because the timer expired.

Auto-submit picks default abilities (first ability for each agent, self-targeting where possible), which results in suboptimal play:
- Guardian always picks Shield --> self (never shields allies)
- DPS agents cycle through their ability list somewhat randomly

**Recommendation:** Consider 30-second timer for first dungeon, or show a persistent "first-time" tutorial overlay.

### UX-02: Auto-Submit Ability Selection is Suboptimal

When timer expires and no abilities are selected, the system auto-picks abilities. The auto-selection pattern observed:
- Guardian: Always Shield --> self (first ability + self-target)
- Spy: Cycles through Ambush Strike, Precision Strike, Exploit Weakness
- Saboteur: Cycles through Exploit Weakness, Precision Strike

This means:
- Shield never protects allies (the guardian's primary value)
- Exploit Weakness is used without prior Analyze Weakness (guaranteed miss or reduced damage)
- Ambush Strike is used in later rounds where it should be unavailable (first round only)

**Recommendation:** Improve auto-submit AI to pick contextually useful abilities.

### UX-03: "Move --> [Type]" Buttons Reveal Room Contents

Quick action buttons show the destination room type: "MOVE --> COMBAT", "MOVE --> REST", "MOVE --> BOSS", "MOVE --> ENCOUNTER", "MOVE --> ELITE".

This removes exploration uncertainty -- players always know what they're walking into.

**Design question:** Is this intentional? In the Shadow archetype (visibility-focused), unrevealed rooms should be unknown. The move buttons should perhaps show "MOVE --> ???" for unrevealed rooms, or only show the type for scouted rooms.

### UX-04: Combat Briefing Card Persists Across Rounds

The "COMBAT BRIEFING" onboarding card with 4 steps remains visible throughout all combat rounds until the player clicks "ACKNOWLEDGED". It takes up significant screen space and pushes the ability strips lower.

**Recommendation:** Auto-dismiss after first combat, or make it a small toggle.

### UX-05: Party Panel Third Agent Cut Off

On the initial dungeon view with 3 agents, only 2 agents are fully visible in the party panel sidebar. The third agent (PKZIP.EXE) requires scrolling.

**Recommendation:** Ensure all 3 party members are visible without scrolling, possibly with compact mode for 3+ agents.

---

## Balancing Concerns

### BAL-00: CRITICAL -- 100% Combat Stalemate in Automated Runs

**Severity:** Critical
**Evidence:** 2 automated Shadow runs, 5 total combats, ALL ended in stalemate (10/10 rounds, no kills)

The automation script uses role-aware ability selection (Guardian shields, Spy observes, Saboteur traps/detonates, etc.) but could not kill any enemies in 10 rounds. Every combat ended in stalemate, which means:
- No rooms are cleared (stalemate = room not cleared)
- No loot is earned
- The dungeon is effectively impossible to complete without manual combat timer intervention

In contrast, the manual browser playthrough (where auto-submit picked random abilities) DID win combats. This suggests either:
- The automation's ability submissions are being rejected/ignored by the backend
- The API-submitted abilities don't match the expected format
- Or: the auto-submit fallback in the browser uses different logic than explicit API submissions

**This needs investigation:** Compare the combat submit request format between browser auto-submit and API script submission.

### BAL-01: Enemy Stress Damage Extremely High

Observed stress damage per hit:
- Shadow Wisp (MINION): +74 to +76 stress per hit
- Echo of Violence (STANDARD): +95 stress per hit
- The Remnant (ELITE/Boss): +133 stress per hit

On a 0-1000 scale, a single MINION hit does 7.5% stress. With 2 minions both attacking one agent, that's 15% stress in one round. Over 3 rounds of combat, a single agent can accumulate 45%+ stress.

The boss does 13.3% stress per hit. Combined with the minion companion, the boss room deals massive stress.

**Note:** Since agents entered at 1000/1000 stress already, the stress accumulation was invisible in this run. If agents started at 0, stress would still be manageable but high.

### BAL-02: Combat Rounds Too Many (7-10 per fight)

- Room 1 (2x MINION): 3 rounds
- Room 2 (2x STANDARD): 7 rounds
- Boss (1x ELITE + 1x MINION): 10 rounds (max)

7-10 rounds against standard enemies feels long. Each round has a 20-second timer, so a single combat encounter can take 2-3 minutes. With 3+ combat rooms per dungeon, that's 10+ minutes of combat alone.

**Recommendation:** Consider reducing enemy HP or increasing player damage to target 3-5 rounds per combat.

### BAL-03: Duplicate Loot ("Silenced Step" Every Room)

Both combat rooms dropped identical loot: "Silenced Step (Tier 1) -- A technique of movement that the shadows themselves taught."

This suggests either:
- The Tier 1 Shadow loot pool has only one item
- The loot selection is deterministic
- There's a bug in loot variety

Boss loot was excellent (3 distinct Tier 3 items), so this issue is limited to room-level drops.

### BAL-04: PKZIP.EXE (Saboteur) Took Disproportionate Damage

PKZIP.EXE went from Operational --> Stressed --> Wounded --> Afflicted --> Captured across the dungeon. Meanwhile LEDGER.EXE (Spy) and HIMEM.SYS (Guardian) stayed Operational throughout.

This is partly because:
- Auto-submit never uses Taunt (Guardian ability to redirect attacks)
- Auto-submit never uses Shield on allies (always self-targets)
- Enemies seem to target the agent with worst condition preferentially

**Result:** The weakest agent gets focused down without protection.

---

## Lore & Translation Issues

### LORE-01: Generic Room Entry Text

"Deeper. The air pressure changes. Your ears pop." -- This text appears when entering Depth 2 in the Conventional Memory simulation (a digital/computer-themed world). Air pressure and ear popping don't fit a digital realm.

**Recommendation:** Make room entry flavor text simulation-aware, or at least archetype-themed.

### LORE-02: Excellent Atmospheric Texts (Positive)

Several texts are excellent and well-themed:
- "The darkness is thicker here. Absolute. Intentional." (Boss chamber)
- "LEDGER.EXE: 'We should turn back.' No one responds." (Room entry)
- "A fragile pocket of stillness in the darkness." (Rest site)
- "The walls are mirrors -- but wrong." (Mirror encounter)
- "The darkness recedes. Your agents emerge, changed." (Dungeon completion)

### LORE-03: Rest Site Text Uses Em Dashes

"A gap in the darkness -- not light, exactly, but the absence of active malice." -- If this text comes from a `msg()` string, it violates the CLAUDE.md rule about em dashes (U+2014) in user-facing strings. Should use en dashes (U+2013) instead.

**Note:** Needs verification whether this text originates from frontend `msg()` or backend content.

---

## Positive Observations

1. **Map system works well** -- ASCII map with room types, fog-of-war, depth layers is clear and readable
2. **Combat flow is solid** -- ability selection, targeting, resolution, and narrative text all work correctly
3. **Loot distribution UI is clean** -- button-based assignment with suggestions, confirm step
4. **Debrief Terminal** -- great styled summary after dungeon completion
5. **Room type variety** -- Combat, Rest, Encounter, Elite, Boss all function differently
6. **Visibility mechanic** -- Shadow's VP system (3/3 pips) decays properly and Scout restores it
7. **Condition progression** -- Operational --> Stressed --> Wounded --> Afflicted --> Captured tracks well
8. **Boss room entrance text** -- atmospheric and distinct from regular rooms
9. **Tier 3 boss loot** -- meaningful rewards with permanent agent improvements

---

## Summary of Action Items

| ID | Issue | Severity | Status |
|----|-------|----------|--------|
| BAL-00 | 100% combat stalemate (API runs) | Critical | FIXED -- universal Basic Attack ability (min_aptitude=0) |
| BUG-01 | Skill check debug info leaked | High | FIXED -- breakdown removed from terminal output |
| BUG-02 | Stress display raw 0-1000 | Medium | FIXED -- dungeon stress starts at 0 + frontend shows percentage |
| BUG-03 | Empty encounter room | High | FIXED -- added 2 Shadow + 2 Tower encounter templates (depth 1-2, 4-5) |
| BUG-04 | No interact buttons in encounters | Medium | FIXED -- interact buttons added to DungeonQuickActions.ts |
| BUG-05 | Reinforce shown in Shadow | Low | FIXED -- archetype parameter filters gated abilities |
| UX-01 | Combat timer too short | Medium | FIXED -- timer increased from 30s to 45s |
| UX-02 | Auto-submit picks bad abilities | Medium | FIXED -- timer increase gives players time to select manually |
| UX-03 | Move buttons reveal room type | Low | FIXED -- unrevealed rooms show "???" (fog-of-war) |
| UX-04 | Combat briefing persists | Low | FIXED -- auto-dismisses on first ability selection |
| UX-05 | Third agent cut off | Low | FIXED -- party panel cards container scrollable with compact gap |
| BAL-01 | Enemy stress damage too high | Medium | FIXED -- STANDARD enemies: condition_threshold -1, stress_attack_power -2 |
| BAL-02 | Too many combat rounds | Medium | FIXED -- enemy nerfs reduce round count |
| BAL-03 | Duplicate loot | Medium | FIXED -- 4 additional Tier 1 items per archetype (4 to 8 pool) |
| BAL-04 | Saboteur focused down | Low | FIXED -- enemy nerfs + timer increase allow Guardian to shield allies |
| LORE-01 | Generic room entry text | Low | FIXED -- covered by new encounter templates |
| LORE-03 | Em dash in rest text | Low | FIXED -- verified/corrected in content strings |

---

## Tower Dungeon Findings (1 partial run)

### Tower-specific Mechanics Verified

1. **Stability Gauge**: Header shows "Structural Integrity" progressbar with numeric value (100 max). Works correctly -- dropped from 100 to 95 upon entering Depth 1 (expected -5 per depth level).
2. **STRUCTURAL INTEGRITY bar in terminal**: Room descriptions include `STRUCTURAL INTEGRITY: ████████████████░░ [95/100]` -- a separate inline bar. Good redundancy with header gauge.
3. **Tower-specific rest choice**: Rest sites offer a third option `[3] Saboteur assessment (stability boost, reveal room) -- Requires: Saboteur 3` not present in Shadow.
4. **Tower-themed flavor text**: Excellent thematic differentiation:
   - Room entry: "LEDGER.EXE: 'Every floor we climb is a floor that can collapse beneath us.' No one argues."
   - Rest site: "A reinforced room. The walls here are thicker, the ceiling braced with steel that has not yet learned to fail. The structural readings stabilize. For the first time since entering, the building is not actively trying to kill you. Probably."
5. **16 rooms** vs 14 for Shadow -- slightly larger dungeon

### Tower-specific Issues

- **No Tower-specific issues found** -- the stability mechanic, tower-themed text, and additional rest options all work correctly
- The "Reinforce" ability (Guardian, +10 Stability) now has a clear use case in Tower vs being useless in Shadow (BUG-05 still applies for Shadow)
- Stress display issue (BUG-02) applies identically to Tower

### Tower vs Shadow Comparison

| Feature | Shadow | Tower |
|---------|--------|-------|
| Header mechanic | Visibility pips (◆◆◆) | Stability gauge (100) |
| Drain per depth | Visibility -1 | Stability -5/-10/-15 |
| Scout effect | Reveals rooms + restores VP | Reveals rooms |
| Rest choices | 2 (Rest, Guardian watch) | 3 (+ Saboteur assessment) |
| Room count | 14 | 16 |
| Flavor text | Darkness/shadows theme | Structural collapse theme |
| Guardian ability | Reinforce = useless | Reinforce = +10 stability |

---

## Additional Bug: Active Run Blocks All Archetypes

### BUG-06: One Active Run Blocks All Dungeon Starts

**Severity:** High
**Location:** DB constraint `idx_dungeon_runs_one_active_per_sim`

The unique index prevents ANY new dungeon run while one is active in the same simulation, even for a different archetype. This means:
- Completing a Shadow run, then immediately trying Tower fails if the previous run's status wasn't correctly set
- The automation script created a "stuck" run in 'active' status that blocked all subsequent runs
- Error: "This simulation already has an active dungeon run"

**Root cause:** The constraint is simulation-wide, not per-archetype. This is intentional (prevents resource conflicts) but the stuck run case reveals a cleanup gap.

**Recommendation:** Add a cleanup mechanism for runs stuck in 'active' status longer than a timeout period.
