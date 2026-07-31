# Dungeon E2E Verification Playtest — The Awakening (2026-04-13)

## Purpose

Verify all 30 fixes from commit `006a616` (Overthrow playtest remediation) using The Awakening archetype. The Awakening exercises the most fix surface area because it uses Ground (P0-01 min_aptitude fix), skill checks, encounters, threshold room, combat, and personality modifier loot.

**Pre-requisite**: Migration 203 must be applied (`supabase db push`). Dev servers must be running.

---

## Run Configuration

- **Archetype**: The Awakening (Velgarien)
- **Difficulty**: 3/5 (***), Depth: 6
- **Test URL**: `http://localhost:5173`
- **Simulation**: Use any simulation with agents — navigate to Terminal tab

---

## Verification Checklist

Use WebMCP to navigate the browser. Check each item during the playtest run.

### Phase 0: Entry Flow

- [ ] **P3-06 (legend)**: Type `dungeon`. After archetype list appears, select The Awakening. Agent picker should show legend line: `SPY=Spy GRD=Guardian SAB=Saboteur PRP=Propagandist INF=Infiltrator ASN=Assassin`
- [ ] **P4-03 (generalist stats)**: If any agents are generalists (no specific aptitudes), they should show `SPY 6 | GRD 6 | SAB 6` instead of just "generalist"
- [ ] **P3-03 (party warning)**: Select agents where NO agent has Spy >= 4. Should see warning: `No agent has SPY 4+. GROUND will be unavailable.`
- [ ] **P3-03 (no warning)**: Select agents where at least one has Spy >= 4. Should see NO warning
- [ ] **P4-01 (stale hint)**: After selecting archetype, the lobby hint "Click an archetype or type 'dungeon' in the terminal" should DISAPPEAR

### Phase 1: Entrance Room (D0)

- [ ] **P3-05 (entrance room)**: Type `look`. Should show `[ENTRANCE]` badge and hint about map/move commands
- [ ] **P2-05 (ambient text)**: Entrance room should NOT show "probes the surrounding darkness" — it's the entrance
- [ ] **Bare navigation**: Type just `1` (bare number). Should move to room 1 without error

### Phase 2: Exploration (D1-D5)

- [ ] **P3-01 (bare numbers)**: When in encounter phase, type just the choice number (e.g., `1`). Should work without typing `interact 1`
- [ ] **P2-02 (encounter dedup)**: Across 3+ encounter rooms, verify different encounter templates appear (not the same one repeating)
- [ ] **P2-05 (Awakening scout text)**: Type `scout <agent>`. Should say "extends awareness through the layers" NOT "probes the surrounding darkness"
- [ ] **P2-05 (Awakening rest text)**: In a rest room, should say "A lucid interval. The boundaries hold, temporarily." NOT "A fragile pocket of stillness in the darkness."
- [ ] **P2-05 (Awakening treasure text)**: In a treasure room, should say "A fragment of clarity, solid enough to hold." NOT "Something glints in the shadow."
- [ ] **P2-07 (move buttons)**: If two adjacent rooms have same type and depth, the quick action buttons should show path labels (alpha/beta) to disambiguate
- [ ] **P3-06 (stat tooltips)**: Hover over aptitude abbreviations in the party panel. Should show tooltip with full name (e.g., "Spy" for S, "Guardian" for G)

### Phase 3: Skill Checks

- [ ] **P2-01 (breakdown display)**: On any encounter choice with a skill check, the terminal should show:
  - `[SPY CHECK -- Modifier: +22]`
  - `Rolling... 19 (+22) = 41`
  - `Result: 41 -- PARTIAL SUCCESS`
  - NOT the old format `Result: 19 -- PARTIAL`
- [ ] **P2-06 (threshold descriptions)**: At the Threshold room (D5), choices should show descriptions:
  - Blood Toll: "A wound, freely given..."
  - Memory Toll: "Something forgotten..."
  - Defiance: "Pass without tribute..."
  - NOT just bare labels

### Phase 4: Ground Action (THE P0-01 FIX)

- [ ] **P0-01 (ground works)**: Type `ground` or `ground <agent_name>`. If agent has Spy >= 4, the command should SUCCEED and show awareness reduction. This was completely broken before (required Spy 40+)
- [ ] **P0-01 (ground error message)**: If agent has Spy < 4, error should say "Agent needs Spy 4+" NOT "Agent needs Spy 40+"
- [ ] **Ground auto-selects best spy**: Type just `ground` without agent name. Should auto-select the agent with highest Spy aptitude

### Phase 5: Combat

- [ ] **P2-03 (timer 60s)**: Combat planning timer should show ~60s (not 42s or 45s)
- [ ] **P2-03 (timer suffix)**: Timer should display "58s" not "58" (has "s" suffix)
- [ ] **P2-03 (timer countdown)**: Timer should count down smoothly without jumps (clock skew eliminated)
- [ ] **P3-04 (compact planning)**: Terminal should show compact planning message ("SELECT ACTIONS: Agent1, Agent2, Agent3") NOT a full ability dump per agent
- [ ] **P3-04 (combat bar scroll)**: If party has 3-4 agents, combat bar should scroll vertically instead of overflowing the viewport
- [ ] **P3-01 (bare numbers in combat)**: Type `1` during encounter phase should work as `interact 1`

### Phase 6: Boss Room (D6)

- [ ] **P2-05 (Awakening boss text)**: Boss room should say "Every layer of consciousness converges. The dreamer stirs." NOT "The darkness is thicker here."
- [ ] **P1-01 (dev note)**: If Inspire ability is used, description should say "Rally an ally. Heal 120 stress." with NO "(Review #11: increased from 75)"

### Phase 7: Loot Distribution

- [ ] **P3-02 (smart suggestions)**: Loot items should NOT all be suggested to the same agent. personality_modifier items should suggest the agent with the lowest trait value. simulation_modifier items should round-robin
- [ ] **P1-02 (personality_modifier loot)**: If a fixed-trait personality_modifier item appears (like "Mirror Shard" type), assigning it should NOT produce a 400 error. The dimension should auto-extract from effect_params.trait

### Phase 8: Cross-Cutting

- [ ] **P1-03 (event logging)**: If a threshold choice was made, events should be logged (no silent CHECK constraint failure). Verify in DB: `SELECT * FROM resonance_dungeon_events WHERE event_type = 'threshold_choice' ORDER BY created_at DESC LIMIT 1`
- [ ] **P1-04 (achievements)**: Achievement progress should work (no "column context does not exist" errors in backend logs). Check: `SELECT * FROM achievement_progress LIMIT 5`

---

## How to Start the Playtest

1. Navigate to `http://localhost:5173` using WebMCP browser
2. Log in, pick a simulation with agents
3. Navigate to Terminal tab
4. Type `dungeon`
5. Select "The Awakening"
6. Follow the checklist above room by room

## Expected Outcome

All 30 checkboxes should pass. Any failures indicate a regression or incomplete fix. Document failures with screenshots and exact terminal output.

---

## Related Fix Commit

`006a616` — fix(dungeon): deep E2E playtest — 19 issues + 5 self-audit findings + 6 type gaps resolved
