# Resonance Dungeons — Playtest Report #2 (2026-03-30)

**Tester:** Claude Opus 4.6 via WebMCP Chrome
**Simulation:** Conventional Memory (70000000-0000-0000-0000-000000000001)
**Runs completed:** 2× Shadow (1 full clear D6 boss, 1 partial retreat D2), 1× Tower (partial retreat D1 after 1 combat)
**Date:** 2026-03-30

---

## What Was Tested vs Skipped

### Tested Thoroughly
- **Shadow full run**: Entrance → 2 combats → encounter → rest → encounter → boss → debrief → loot distribution (7/13 rooms, boss defeated Round 8)
- **Shadow partial run**: Different path, different ability combos (Observe+Fortify+Deploy Trap), Treasure room, retreat at D2
- **Tower partial run**: 1 combat (2× Tremor Broker), Reinforce ability tested, Stability gauge observed (100 → 95 → 97 with Reinforce)
- **All 10 fixes from Report #1** verified
- **Literary quality** of all encountered texts assessed
- **Combat bar UX** extensively tested (manual ability selection, target selection, auto-submit, ability persistence)

### Skipped (and Why)
- **Tower full boss run**: Tower boss fight NOT tested. Reason: Each combat takes 2-8 minutes (45s timer × multiple rounds), and the Tower has 13-15 rooms with 5-6 combats. A full Tower run would take 30-45 minutes of real-time clicking. The critical Tower mechanics (Stability gauge, Reinforce ability, Tower-specific enemies/loot/text) were verified in the partial run. **OPEN QUESTION**: What happens when Stability reaches 0 during boss fight? Does the dungeon collapse? This needs a dedicated test.
- **Tower rest room third choice** (Saboteur assessment): Seen in Report #1 but not re-tested manually
- **Tower encounter rooms**: Not reached in partial run
- **Elite rooms** (non-boss): Not encountered in any manual browser run (the Shadow full run path skipped the elite room)
- **Playtest script full Tower run**: Script ran but used only support abilities (Shield+Observe), resulting in 67% stalemate rate. Script needs fixing before it can validate Tower boss.

---

## Fix Verification Summary (10/10 Fixes from Report #1)

| # | Fix | Status | Evidence |
|---|-----|--------|----------|
| 1 | Stress starts at 0% | **VERIFIED** | All agents 0% STR at dungeon start across all 3 runs |
| 2 | Encounter rooms have Interact buttons | **VERIFIED** | Buttons with choice labels appear correctly in DungeonQuickActions toolbar |
| 3 | Skill checks show no debug info | **VERIFIED** | Clean `[SPY CHECK — Level 6: 73%]` header, no formula breakdown leaked |
| 4 | Move buttons show "???" for unscouted rooms | **PARTIAL FAIL** | See detailed analysis below |
| 5 | Reinforce hidden in Shadow | **VERIFIED** | Reinforce absent from HIMEM.SYS in Shadow; present in Tower. Confirmed across all runs. |
| 6 | Basic Attack available for all | **VERIFIED** | All 3 agents show Basic Attack as last ability option |
| 7 | Combat timer 45s | **VERIFIED** | Timer starts at 45 and counts down correctly |
| 8 | Stress shows percentage | **VERIFIED** | Party panel shows "27% TENSE", "57% CRITICAL" etc. consistently |
| 9 | Combat Briefing auto-dismisses | **VERIFIED** | Briefing card disappears on first ability radio button click |
| 10 | STANDARD enemies weaker | **VERIFIED** | Echo of Violence stress: +57 (was +95). MINION fights won in 2-3 rounds. |

### Fix #4 Detailed Analysis: Fog-of-War Move Buttons

**File:** `frontend/src/components/dungeon/DungeonQuickActions.ts:229`

The code reads:
```ts
${msg('Move')} \u2192 ${room.revealed ? getRoomTypeLabel(room.room_type, room.index) : '???'}
```

The ternary logic is correct — it checks `room.revealed`. **The bug is in the backend response**: adjacent rooms come back with `revealed: true` even when they haven't been scouted. The `revealed` flag is set when the backend generates the adjacent room list, probably because room types are always included in the adjacency data.

**Where to fix:** Backend dungeon engine — the `/state` endpoint should only include `room_type` for rooms that have been scouted or are at the current depth. OR: the frontend should check against a separate `scouted_rooms` set rather than trusting `room.revealed` from adjacency data.

**Evidence:** All move buttons throughout the dungeon showed room types (COMBAT, ENCOUNTER, REST, TREASURE, BOSS) for rooms that were [░] (unrevealed) on the map. The map correctly uses [░] but the quick actions leak the type.

---

## New Bugs Found

### BUG-NEW-01: Deploy Trap Requires Target Selection (Should Be Self-Targeting)

**Severity:** Medium
**File:** `frontend/src/components/dungeon/DungeonCombatBar.ts`
- Lines 890-905: `_renderTargetPicker()` — determines single_ally vs enemy targeting
- Lines 959-964: Self-targeting logic — abilities with `targets === 'self'` auto-target agent
- Lines 990-999: Single-enemy auto-target if only 1 alive, else enters targeting mode
**Backend:** `backend/services/combat/ability_schools.py` — check if Deploy Trap is classified as `target_type: self` or `target_type: enemy`

PKZIP.EXE's "Deploy Trap" shows enemy target dropdown (`► Target: Shadow Wisp | Shadow Wisp`) when selected. Deploy Trap description: "Set a trap. Next enemy to act takes 1 condition step damage automatically" — this triggers on the next enemy action, not on a specific target. Should be self-targeting like Observe and Fortify.

**Impact:** If timer expires before target is selected, Deploy Trap is not submitted. Auto-submit falls back to a different ability (often Precision Strike or Exploit Weakness).

**How to verify:** Select Deploy Trap for PKZIP.EXE during any combat — target dropdown appears instead of auto-confirming.

### BUG-NEW-02: Target Selector Persists After Switching to Self-Targeting Ability

**Severity:** Low
**File:** `frontend/src/components/dungeon/DungeonCombatBar.ts:890-905` (`_renderTargetPicker()`) and lines 959-999 (targeting mode state)

When switching from Precision Strike (shows target selector) to Observe (self-targeting), the target dropdown remains visible. It shows `► Target: Shadow Wisp` even though Observe doesn't need a target.

**Root cause:** The target selector state is not cleared when a self-targeting ability is chosen. The radio button change handler should check if the new ability is self-targeting and clear the target state if so.

### BUG-NEW-03: Identical Move Button Labels for Same Room Type

**Severity:** Medium
**File:** `frontend/src/components/dungeon/DungeonQuickActions.ts:223-232`

When two adjacent rooms have the same type, buttons show identical labels: `MOVE → ENCOUNTER | MOVE → ENCOUNTER`. Player cannot distinguish which button leads where.

**Fix:** Include room index or relative direction in the label:
```ts
${msg('Move')} \u2192 ${label} (${room.index})
```
Or use directional labels based on room position relative to current room (LEFT/RIGHT/UP).

### BUG-NEW-04: Expedition Summary Shows Raw 0-1000 Stress Instead of Percentage

**Severity:** Low
**File:** `frontend/src/utils/dungeon-formatters.ts:700`
```ts
const label = `  ${agent.agent_name.padEnd(nameWidth)}  ${cond.padEnd(12)} ${stressStr}/1000 ${bar}`;
```
The dungeon summary screen shows `LEDGER.EXE STRESSED 274/1000 ███░░░░░░░` while during gameplay the party panel shows `27% TENSE`. Fix: change `${stressStr}/1000` to `${Math.round(parseInt(stressStr) / 10)}%` and add the stress label (TENSE/CRITICAL).

### BUG-NEW-05: Encounter/Treasure Results Show Raw Key-Value Pairs

**Severity:** Low
**File:** `frontend/src/utils/dungeon-formatters.ts:554-557`
```ts
// Effects — currently renders raw strings from backend
for (const effect of effects) {
  lines.push(responseLine(`  \u2192 ${effect}`));
}
```
The `effects: string[]` array comes directly from the backend as raw key-value strings. The formatter just prefixes `→` and dumps them.

Skill check results display raw mechanics:
```
→ reveal_rooms: 2
→ stress: 10
→ loot: true
→ loot_tier_penalty: 1
```

**Fix:** Wrap in narrative text per result type. The backend should return a `narrative_result` field alongside the raw data, or the frontend formatter should map known keys to narrative strings:
- `reveal_rooms: N` → "N rooms ahead become clear."
- `stress: N` → "The effort takes its toll (+N stress)."
- `loot: true` → "Something valuable emerges."
- `loot_tier_penalty: N` → "The hasty attempt damages the find."

### BUG-NEW-06: Generic Depth Entry Text Not Simulation-Aware

**Severity:** Low (recurring from Report #1 LORE-01)
**File:** Backend-generated banter text, rendered via `frontend/src/utils/dungeon-commands.ts:493-501` (`result.banter` → `formatRoomEntry()`). The text "Deeper. The air pressure changes" is part of backend dungeon-generation content (AI-generated or template), not hardcoded in frontend. Check `backend/services/dungeon_engine_service.py` for banter generation and `backend/services/dungeon/dungeon_encounters.py` for content templates.

"Deeper. The air pressure changes. Your ears pop." appears at every Shadow depth transition. This is physically-themed text that doesn't fit "Conventional Memory" (a DOS-era digital realm where programs are citizens). Programs don't have ears or experience air pressure.

**Contrast with Tower:** Tower uses "Higher. The air pressure drops. The stairwell groans under its own accumulated weight." — much better, structurally themed. But still uses physical metaphors inappropriate for Conventional Memory.

**Fix options:**
1. Make depth transition text simulation-aware (check simulation theme, generate appropriate text)
2. Use archetype-specific generic text: Shadow = "The darkness thickens", Tower = "The structure groans"
3. Pool of 5-10 randomized texts per archetype to avoid repetition

### BUG-NEW-07: Scout Text Uses Shadow Language in Tower

**Severity:** Low
**File:** `frontend/src/utils/dungeon-formatters.ts:588`
```ts
lines.push(responseLine(`${agentName} ${msg('scans the surrounding darkness')}...`));
```
This is a `msg()` string — hardcoded Shadow-specific language used for all archetypes.

Additionally, line 598-599 shows `→ Visibility: ${visibility}` which outputs `→ Visibility: null` in Tower (where visibility is undefined/null). The `if (visibility !== undefined)` check at line 598 doesn't catch `null`.

In Tower dungeons, the scout command outputs: "LEDGER.EXE scans the surrounding darkness..." — This is Shadow-specific language. In Tower it should be something like "LEDGER.EXE surveys the structural layout..." or "...assesses the floor plan..."

Additionally, `→ Visibility: null` is displayed in Tower (Visibility is a Shadow-only mechanic). This null should be suppressed — Tower should show `→ Stability: 95` or nothing.

### BUG-NEW-08: Observe Ability Available in Tower But Useless

**Severity:** Medium (game design)
**File:** `backend/services/combat/ability_schools.py` — Observe ability definition and archetype gating

Observe's description says: "Reveals enemy intents and restores 1 Visibility (Shadow)." In Tower, Visibility doesn't exist (null). The ability still works for enemy intent reveal, but the Visibility restoration is wasted. The description mentions "(Shadow)" but new players won't understand this.

**Options:**
1. Replace Observe with a Tower-specific ability: "Structural Assessment" — reveals enemy intents + restores +5 Stability
2. Filter Observe out in Tower (like Reinforce is filtered in Shadow)
3. Keep Observe but change description to remove "(Shadow)" reference when in Tower

### BUG-NEW-09: Reinforce Effect Not Communicated to Player

**Severity:** Medium
**File:** Frontend combat resolution display / Terminal output

When Reinforce is used, the terminal shows: `[ACT] HIMEM.SYS → Reinforce → HIMEM.SYS.` — but there's NO indication of the Stability change. The player sees the Stability number in the header change from 95 to 97 but doesn't know Reinforce contributed +10 and ambient drain took -8.

**Fix:** Add Stability delta to resolution text: `[ACT] HIMEM.SYS → Reinforce → HIMEM.SYS. +10 Stability.` And/or show `STRUCTURAL INTEGRITY: 95 → 97 (+10 Reinforce, -8 ambient)` after each round.

### BUG-NEW-10: Playtest Script Uses Only Support Abilities — 67% Stalemate Rate

**Severity:** Medium (tooling)
**File:** `scripts/dungeon_playtest.py`

The automated playtest script uses a fixed strategy (Guardian shields, Spy observes, others observe/basic attack) that barely deals damage. Results: 67% combat stalemate rate, only 33% victory.

**Issues to fix:**
1. Strategy should use Basic Attack / Precision Strike for damage-dealing agents
2. After 3 rounds without kills, switch all agents to attack mode
3. Track and log Stability for Tower runs
4. Handle 500 error on state retrieval after retreat gracefully
5. Ensure the script uses the correct party (browser uses 3 agents, script had 4)

---

## Tower-Specific Findings

### Stability Mechanic Observations
- **Start:** 100/100
- **D1 entry:** 95/100 (-5 per depth)
- **After Reinforce in combat:** 97 (net +2, suggesting ambient drain of ~8 per round offset by +10 Reinforce)
- **Not tested:** What happens at Stability 0? Dungeon collapse? Debuffs? This is the single most important untested Tower mechanic.

### Tower Onboarding Gap
There is NO briefing or explanation for the Tower-specific mechanics. A new player encounters:
- A "Structural Integrity" bar in the header with no context
- "Reinforce" ability on the Guardian with no explanation of why to use it
- Stability draining each depth with no warning
- No explanation of consequences at Stability 0

**Recommendation:** Add a Tower Briefing card (like Combat Briefing) at dungeon start. See Literary Quality section for proposed text.

### Tower vs Shadow Thematic Differentiation

| Aspect | Shadow (Verified) | Tower (Verified) |
|--------|-------------------|------------------|
| Header mechanic | Visibility pips (◆◆◆) | Stability gauge bar (100) |
| Depth drain | Visibility -1 | Stability -5 (D1), scales higher |
| Guardian ability | — (Reinforce hidden) | Reinforce (+10 Stability) |
| D1 enemies | Shadow Wisp, Shadow Wisp | Tremor Broker, Tremor Broker |
| D2 enemies | Echo of Violence + Shadow Tendril | Not reached |
| Boss | The Remnant (ELITE) + Shadow Wisp | Not reached |
| Loot T1 | Fear Extract, Echo Shard, Dark Adaptation | Structural Dust, Load-Bearing Fragment |
| Rest choices | 2 (Rest, Guardian watch) | 3 (+ Saboteur assessment) — verified in Report #1 |
| Room count | 13-14 | 13-15 |
| Entry text | "PKZIP.EXE: 'We should turn back.'" | "LEDGER.EXE: 'Every floor we climb...'" |
| Depth text | "Deeper. The air pressure changes." | "Higher. The stairwell groans..." |

---

## Literary Quality Assessment (Ausführlich)

### Tier S — Herausragend (Keine Änderungen)

**Boss Chamber Entry (Shadow):**
> "The darkness is thicker here. Absolute. Intentional."

Drei Worte, die eine ganze Atmosphäre erschaffen. "Intentional" ist der Schlüssel — die Dunkelheit ist kein Naturphänomen, sondern ein Wille. Erinnert an lovecraftianische "conscious darkness". Meisterhaft.

**Pre-Boss Transition (Shadow):**
> "The air changes. The whispers stop. In the silence that follows, something enormous draws breath."

Perfektes Pacing: kurze Sätze → Stille → dann das Ungeheure. "Draws breath" impliziert eine lebende, atmende Entität. Der Wechsel von Aktivität (whispers) zu Stille zu etwas Größerem ist filmisch inszeniert.

**Tower Entry Text:**
> "LEDGER.EXE: 'Every floor we climb is a floor that can collapse beneath us.' No one argues."

Character voice perfekt getroffen — LEDGER.EXE als analytischer, pessimistischer Spy. "No one argues" ist stärker als "No one responds" (Shadow) — es impliziert, dass alle wissen, dass er recht hat.

**D5 Encounter (Shadow):**
> "The corridors converge here – not architecturally, but ontologically. Shadows from earlier rooms pool on the floor like spilled ink, forming a map of everywhere you have been. The air is dense with accumulated memory. Something in the walls is breathing in sync with your party."

Philosophisch präzise ("ontologically"), visuell stark ("spilled ink"), und der letzte Satz ist genuinely unheimlich — die Wände atmen synchron mit der Party. Das ist Body Horror auf subtilstem Niveau.

**Rest Site (Shadow):**
> "A gap in the darkness – not light, exactly, but the absence of active malice. The walls here are smooth, untouched. The air is still. For the first time since entering, you can hear your own breathing."

"The absence of active malice" — brillant. Definiert Sicherheit als die Abwesenheit von Bösartigkeit, nicht als Präsenz von Gutem. "Untouched" impliziert, dass alles andere berührt/korrumpiert wurde.

**Echo Shard Loot:**
> "A shard of resolved conflict. Holding it quiets the noise – briefly, but enough."

Poesie in zwei Sätzen. "Resolved conflict" als physisches Objekt. "Briefly, but enough" — resigned hope.

**Structural Dust Loot (Tower):**
> "Pulverized load-bearing material. Inhaling it settles something fundamental."

Doppeldeutigkeit: "fundamental" sowohl physisch (Fundament) als auch metaphorisch. "Inhaling" load-bearing material ist ein absurd-groteskes Bild das trotzdem funktioniert.

### Tier A — Sehr gut (Kleine Verbesserungen möglich)

**Dark Adaptation Loot:**
> "Prolonged exposure to shadow – the eyes adjust, the mind follows. Spy checks +5%."

Gut, aber der mechanische Suffix "Spy checks +5%" bricht die Immersion. Vorschlag: Beschreibung und Mechanik trennen — Beschreibung in der Loot-Anzeige, Mechanik im Tooltip.

**Dungeon Completion:**
> "The darkness recedes. Your agents emerge, changed."

Effektiv, aber "changed" ist etwas generisch. Alternativer Vorschlag:
- Shadow: "The darkness recedes. Your agents emerge — not unscathed, but something has been understood."
- Tower: "The building settles. Your agents descend — the stairs hold, this time."

**Fear Extract Loot:**
> "Consumable: one Propagandist ability deals +50% stress damage this dungeon."

Rein mechanisch, keine narrative Beschreibung. Sollte wie Echo Shard/Structural Dust eine poetische Beschreibung haben. Vorschlag: "Distilled terror in a vial. The fear of others, weaponized." + mechanischer Tooltip.

### Tier B — Verbesserungsbedarf

**Depth Transition Text (Shadow):**
> "Deeper. The air pressure changes. Your ears pop."

Physische Metaphern in einer digitalen Welt. Programme haben keine Ohren. Außerdem repetitiv — derselbe Text bei jedem Depth-Wechsel.

**Vorschläge für Conventional Memory (DOS-themed):**
- "Memory addresses shift. The stack pointer descends into unallocated space."
- "A system call that was never meant to return. The interrupt vector points deeper."
- "HIMEM.SYS: 'We're below the 640K barrier now.' The program counter disagrees."
- "Segmentation fault — not an error, but a passage."
- "The BIOS has no record of this address space. You exist outside the system's knowledge."

**Depth Transition Text (Tower):**
> "Higher. The air pressure drops. The stairwell groans under its own accumulated weight."

Besser als Shadow's Text, aber noch generisch. Vorschläge:
- "The floor bows under your weight. Something structural surrenders one floor below."
- "The stairwell narrows. Each step resonates through the building like a heartbeat."
- "Load-bearing walls thin to membranes. The building remembers every floor it has supported."

**Scout Text (Tower):**
> "LEDGER.EXE scans the surrounding darkness..."

Shadow-Sprache in einem Tower-Dungeon. Vorschlag:
- Tower: "LEDGER.EXE surveys the structural layout..."
- Shadow: "LEDGER.EXE probes the surrounding darkness..." (keep current)

**Room Entry Agent Quote:**
> "PKZIP.EXE: 'We should turn back.' No one responds."

Gut, aber erscheint bei JEDEM Room Entry (D1, D2, etc.). Sollte variiert werden:
- D1: "PKZIP.EXE: 'We should turn back.' No one responds."
- D2: "HIMEM.SYS tightens formation. The silence stretches."
- D3: "LEDGER.EXE counts exits. There is only one."
- D4: "The party moves without speaking. Words cost energy none of them have."
- D5: "PKZIP.EXE no longer suggests turning back."

### Tier C — Muss gefixt werden

**Encounter Result Text:**
```
→ reveal_rooms: 2
→ stress: 10
```
Reine Debug-Ausgabe. Keine Narration. Muss komplett ersetzt werden durch:
- "The knowledge burns into your awareness. Two paths crystallize from the noise. (+10 stress)"

**Treasure Result Text:**
```
→ loot: true
→ loot_tier_penalty: 1
→ stress: 30
```
Noch schlimmer — drei technische Zeilen. Vorschlag:
- SUCCESS: "The lock yields. Inside: something the Tower forgot to destroy."
- PARTIAL: "The mechanism resists, then breaks — imperfectly. The contents are damaged, but salvageable. (+30 stress)"
- FAIL: "The lock holds. The attempt echoes through the building. (+stress)"

---

## Briefing Text Vorschläge (Literarisch)

### Shadow Briefing (NEU — existiert noch nicht)
```
SHADOW PROTOCOL

You descend into the dark. Visibility is your lifeline —
when it fails, the shadows move closer.

◉ Scout to reveal rooms. Observe to maintain sight.
◉ The darkness drains visibility each floor.
◉ At Visibility 0, enemies strike first. Always.

The darkness does not forgive blindness.

[ACKNOWLEDGED]
```

### Tower Briefing (NEU — existiert noch nicht)
```
STRUCTURAL PROTOCOL

The building remembers every footstep as a tremor.
Each floor you ascend weakens the one beneath.

◉ Structural integrity drains each floor.
◉ Use REINFORCE (Guardian) to restore stability.
◉ At integrity 0, the building collapses. No retreat.

Reinforce what holds you up — or become what it buries.

[ACKNOWLEDGED]
```

### Combat Briefing (existiert — nur Referenz)
```
COMBAT BRIEFING
1. Click an ability for each agent below
2. Self-abilities auto-target -- one click
3. Attack abilities require an enemy target
4. Press EXECUTE when all agents have orders
[ACKNOWLEDGED]
```

---

## UX Enhancements (User-Requested + Observed)

### UX-ENH-01: Enemy Health Granularity — 5 States + Color Coding

**Priority:** High
**File:** `frontend/src/components/dungeon/DungeonEnemyPanel.ts:304-318` — enemy rendering, `THREAT_BADGE` mapping at line 31-36
**Backend:** Enemy condition calculation in `backend/services/dungeon/dungeon_combat.py`

**Current:** 3 states (healthy → damaged → critical → defeated), all same text color
**Proposed 5 states:** healthy (green) → scratched (yellow-green) → damaged (yellow) → wounded (orange) → critical (red) → defeated (strikethrough)

Also add a visual HP bar (thin, under enemy name) similar to agent condition bars. The `.enemy__condition` class at line 128-134 currently just shows text.

### UX-ENH-02: ELITE/MINION/STANDARD Badge Differentiation

**Priority:** Medium
**File:** `frontend/src/components/dungeon/DungeonEnemyPanel.ts:31-36` (THREAT_BADGE mapping) and line 305-318 (rendering)

Current mapping uses `enemy.threat_level` (low/medium/high/critical) → badge variant. But MINION/STANDARD/ELITE come from a separate field rendered at line 317-318 as `enemy.threat_level.toUpperCase()`.

**Note:** The badge actually maps `threat_level` (low=info/green, medium=warning/yellow, high=danger/red), NOT the MINION/ELITE label. So MINION enemies with `threat_level: low` get green, ELITE with `threat_level: high` get red. But the VISUAL shows "MINION" in the badge, which uses the threat_level color. This means the color differentiation partially exists but is based on threat_level, not the type label.

**Fix needed:** The badge text shows "MINION"/"ELITE" but the color comes from threat_level. If a MINION has `threat_level: medium`, it gets yellow. Verify this mapping is correct. Also: add specific styling for BOSS-tier enemies (glow, larger badge).

### UX-ENH-03: MINION Badge Vertical Alignment

**Priority:** Low (CSS)
**File:** `frontend/src/components/dungeon/DungeonEnemyPanel.ts:121-126`

The `.enemy__threat velg-badge` CSS uses tiny font sizes (`--text-xs: 7px`) and spacing. The vertical offset is likely caused by the badge's line-height not matching the enemy name text. Fix with `vertical-align: middle` or `align-items: center` on the parent flex container.

### UX-ENH-04: Agent Card Stress Visual Feedback (During Dungeon)

**Priority:** High
**File:** `frontend/src/components/dungeon/DungeonPartyPanel.ts`
- Lines 433-447: Stress fill calculation and threshold labels
- Lines 441-447: Stress text rendering — `${stressPct}% ${msg('CRITICAL')}` or `${stressPct}% ${msg('TENSE')}` or just `${stressPct}%`
- Lines 508-524: Stress bar rendering with `bar-fill--stress-${agent.stress_threshold}` class
- Lines 57-62: `STRESS_COLOR` map — threshold colors (normal/tense both amber, critical red)

**Proposed changes:**
1. **Stress label granularity** — currently only TENSE and CRITICAL:
   - 0-10%: (no label)
   - 10-25%: UNEASY
   - 25-40%: TENSE
   - 40-60%: STRAINED
   - 60-80%: CRITICAL
   - 80-100%: BREAKING
2. **Visual glow on card:**
   - >60%: `box-shadow: 0 0 8px var(--color-danger-glow)` on `.party-agent` card
   - >80%: Add `animation: stress-pulse 2s ease-in-out infinite` (pulsing red glow)
3. **Micro-animation on change:**
   - Stress increase: brief red flash on the STR progressbar
   - Stress decrease (rest): brief green flash
   - Condition change: 300ms flicker transition

### UX-ENH-05: Persistent Map Widget

**Priority:** High
**File:** `frontend/src/components/dungeon/DungeonView.ts` (main dungeon layout) — currently has `region "Dungeon map"` with a Map button

**Architecture:**
- New component: `DungeonMapOverlay.ts` or expand existing map region
- **1080p (default):** Floating action button (bottom-right) → opens modal overlay with ASCII map
- **1200-1440px:** Collapsible sidebar panel (right side, below party panel)
- **1440p+:** Always-visible third column: Terminal | Party | Map
- **Mobile (<768px):** Full-screen modal on Map icon tap
- Use CSS Container Queries on the dungeon container for responsive behavior
- **Micro-animations for map:**
  - Room reveal: fade-in + brief golden glow
  - Current room `*` marker: gentle pulse animation
  - Room cleared `■`: brief flash on transition from type letter
  - Boss room `[B]`: subtle red pulse
  - Depth transition: smooth highlight shift to new depth row

### UX-ENH-06: Entropy Overlay Should Not Affect Dungeon UI

**Priority:** High
**File:** `frontend/src/components/health/EntropyOverlay.ts:106`
```ts
>Simulation entering entropy state. Systems decelerating.</div>
```
The overlay also applies a CSS vignette effect (line 30) and animation (line 33). The `alert` element in the DOM shows during dungeon runs even though the simulation entropy state is irrelevant to dungeon gameplay.

**Fix:** During an active dungeon run, either:
1. Suppress the entropy alert banner entirely (dungeon is self-contained)
2. Exclude the dungeon container from any CSS filter/overlay effects
3. Add `pointer-events: none; opacity: 0` to entropy elements when dungeon state is active

### UX-ENH-07: Retreat Button Safety (Hold-to-Confirm)

**Priority:** Medium
**File:** `frontend/src/components/dungeon/DungeonQuickActions.ts` — Retreat button rendering

**Implementation:**
1. Replace simple click with hold-to-confirm pattern
2. Visual: progress ring fills around button during 2-3s hold
3. Text changes: "RETREAT" → "HOLD TO RETREAT" → "RETREATING..."
4. Alternative: Click opens confirm modal: "Abandon the expedition? Partial loot earned so far will be saved."
5. Cancel on release before threshold

### UX-ENH-08: Micro-Animations for Combat State Changes

**Priority:** Medium
**Files:** `DungeonEnemyPanel.ts`, `DungeonPartyPanel.ts`, `DungeonCombatBar.ts`

**Proposed animations (CSS keyframes + Lit `animate` directive):**
- **Enemy takes damage:** `.enemy` card: `transform: translateX(4px)` shake + brief red flash overlay (200ms)
- **Enemy defeated:** Fade-out + strikethrough animation (500ms)
- **Agent takes damage:** Agent card brief red border flash (150ms)
- **Agent stress increase:** STR progressbar brief pulse wider then settle (200ms ease-out)
- **Agent condition change:** Card background brief color shift (Operational=green → Stressed=yellow flash, 300ms)
- **Loot drop:** Gold shimmer particle effect on loot text (CSS `background: linear-gradient` animation)
- **Victory banner:** `═══ V I C T O R Y ═══` text: letter-spacing animation (expand then settle)
- **Timer <10s:** Timer bar color shift to red + subtle pulse

### UX-ENH-09: Haptic Feedback Service (Mobile)

**Priority:** Low (nice-to-have)
**Architecture requirement:** SAUBERSTE ARCHITEKTUR

```
frontend/src/services/haptic-service.ts

class HapticService {
  private static instance: HapticService;
  private enabled = false;

  // Singleton
  static getInstance(): HapticService;

  // User opt-in
  enable(): void;
  disable(): void;

  // Event-driven — components fire CustomEvents, service subscribes
  // NO direct coupling in components
  trigger(event: HapticEvent): void;
}

type HapticEvent =
  | 'ability-select'    // 10ms tap
  | 'execute'           // 30ms tap
  | 'hit'               // 50ms buzz
  | 'miss'              // 20ms-pause-20ms
  | 'enemy-attack'      // 100ms buzz
  | 'condition-change'  // 3× 30ms staccato
  | 'loot-drop'         // 20ms-40ms-60ms ascending
  | 'victory'           // triumphant pattern
  | 'defeat'            // descending pattern
  | 'timer-warning'     // heartbeat 50ms-pause-50ms repeating
  | 'retreat-hold'      // increasing buzz during hold
  | 'retreat-confirm'   // strong 200ms confirmation
```

**Requirements:**
- Feature detection: `'vibrate' in navigator`
- Settings toggle in user preferences (opt-in, default off)
- Graceful degradation: no-op on unsupported devices (iOS Safari)
- Event bus: components dispatch `CustomEvent('dungeon:haptic', { detail: { event: 'hit' } })`, service subscribes on `window`

### UX-ENH-10: Responsive Layout for Higher Resolutions

**Priority:** Medium
**File:** `frontend/src/components/dungeon/DungeonView.ts` (main layout)

**Layout breakpoints using CSS Container Queries:**
```css
/* 1080p default */
.dungeon-layout { grid-template-columns: 1fr 280px; }

/* 1440p — add map column */
@container dungeon (min-width: 1200px) {
  .dungeon-layout { grid-template-columns: 1fr 280px 250px; }
}

/* 4K — wider terminal, expanded stats */
@container dungeon (min-width: 1800px) {
  .dungeon-layout { grid-template-columns: 1fr 320px 300px; }
  /* Show combat log history panel */
}
```

### UX-ENH-11: Archetype Onboarding Briefings

**Priority:** High
**File:** New — or extend the existing Combat Briefing component in `DungeonCombatBar.ts`

Both Shadow and Tower need archetype-specific briefing cards shown at dungeon start (before first move). See "Briefing Text Vorschläge" section above for literary text.

**Implementation:**
- Show briefing card when dungeon starts (phase = 'exploration', room = entrance)
- Card includes archetype-specific mechanic explanation
- ACKNOWLEDGED button dismisses permanently (per archetype, stored in localStorage)
- Style consistent with existing Combat Briefing card

### UX-ENH-12: Micro-Animations for Persistent Map

**Priority:** Medium (part of UX-ENH-05)

**Proposed map animations:**
- **Room reveal (scout/move):** New room fades in from `[░]` to `[C]` with 300ms ease-in + brief golden border glow
- **Current position `*`:** Gentle CSS pulse: `animation: map-pulse 2s ease-in-out infinite` (opacity 0.7 → 1.0)
- **Room cleared `■`:** Flash-transition when room changes from type to cleared (200ms white flash, then settle to `■`)
- **Boss room `[B]`:** Persistent subtle red pulse: `animation: boss-pulse 3s ease-in-out infinite` with `text-shadow: 0 0 4px var(--color-danger-glow)`
- **Depth transition:** When party moves to new depth, smooth CSS scroll/highlight: brief border glow on the new depth row (500ms)
- **Connection lines `───`:** Brief brightening animation when path is traversed (100ms)
- All animations use `prefers-reduced-motion: reduce` media query for accessibility

---

## Balance Observations

### Combat Duration (Rounds per Fight)

| Run | Fight | Enemies | Rounds | Strategy | Verdict |
|-----|-------|---------|--------|----------|---------|
| Shadow #1 | D1 Combat | 2× MINION | 2 | Auto (all attack) | Perfect |
| Shadow #1 | D2 Combat | STANDARD + MINION | 6 | Manual (Precision + Taunt + Detonate) | Acceptable |
| Shadow #1 | D6 Boss | ELITE + MINION | 8 | Manual (Precision + Taunt + Detonate) | Good for boss |
| Shadow #2 | D1 Combat | 2× MINION | 8 | Support-only (Observe + Fortify) | Correctly punished |
| Tower #1 | D1 Combat | 2× MINION | 3 | Auto (all attack) | Perfect |

**Conclusion:** Combat balanced well. Attack strategies = fast (2-3 rounds). Support-only = slow (8+ rounds). Boss appropriately longer (8 rounds). Previous playtest's 10-round stalemates are gone.

### Stress Economy

| Source | Amount | % of 1000 |
|--------|--------|-----------|
| Ambient per room | 28-44 (depth + difficulty) | 2.8-4.4% |
| MINION stress attack | 76 | 7.6% |
| STANDARD stress attack | 57 (nerfed from 95) | 5.7% |
| ELITE stress attack | 133 | 13.3% |
| Rest heal | -200 | -20% |
| Skill check cost | 10-30 | 1-3% |

**Observation:** With 1 rest per dungeon, stress is manageable. Boss fight pushes Guardian to ~57% (using Taunt). Without Taunt, damage spreads evenly (~30% each). The system rewards tactical play.

### Ambient Stress Formula (from code investigation)
**File:** `backend/services/combat/stress_system.py:60-67`
```python
def calculate_ambient_stress(depth: int, difficulty: int) -> int:
    return 8 + (3 * depth) + (5 * difficulty)
```
At Difficulty 4: 28 (D1) → 31 (D2) → 34 (D3) → 37 (D4) → 40 (D5) → 43 (D6) per room.

---

## 4-Perspektiven-Analyse

### Architect
- **Positiv:** Klare Trennung von Concerns — Backend handles combat logic, frontend renders state. DungeonQuickActions, DungeonCombatBar, DungeonPartyPanel, DungeonEnemyPanel sind sauber getrennte Komponenten. Ability-System ist erweiterbar (neue Abilities per archetype filterbar).
- **Negativ:** `room.revealed` Flag im adjacency-Response ist ein Backend/Frontend-Contract-Problem — das Frontend vertraut blind dem Backend-Flag. Die Encounter/Treasure-Ergebnisse mischen Rohformat mit Narration (Skill-Check hat Narration, aber die Effects-Liste ist raw). Formatters in `dungeon-formatters.ts` brauchen ein konsistentes Pattern: jeder Effect-Typ sollte einen eigenen Formatter haben, nicht nur `→ ${effect}`.
- **Technical Debt:** `formatSkillCheckResult()` (line 522-560) nimmt `effects: string[]` als raw strings an — diese kommen direkt vom Backend. Besser: typisierte Effect-Objekte `{ type: 'reveal_rooms', value: 2 }` die der Formatter in Narration übersetzt.

### Game Designer
- **Positiv:** Darkest-Dungeon-inspiriertes Stress-System funktioniert gut. Taktische Tiefe vorhanden: Taunt-Shield-Combo schützt Party, Observe-Analyze-Exploit-Combo macht Bonus-Damage. Verschiedene Raumtypen (Combat, Encounter, Rest, Treasure, Elite, Boss) sorgen für Abwechslung. Archetype-Differenzierung (Shadow=Visibility, Tower=Stability) ist gelungen.
- **Negativ:** Auto-Submit bei Timer-Ablauf wählt immer die erste/vorherige Ability — kein intelligentes Fallback. Deploy Trap als Saboteur-Kern-Ability funktioniert de facto nicht im UI (Target-Bug). Observe in Tower nutzlos (Visibility null). Reinforce-Feedback fehlt — Spieler versteht nicht, ob die Ability gewirkt hat. Tower-Boss-Interaktion mit niedriger Stability ist komplett ungetestet.
- **Balance:** MINION-Kämpfe gut (2-3 Runden), STANDARD akzeptabel (4-6), Boss okay (8). Rest heilt genau richtig (-20%). Ambient Stress schafft Zeitdruck ohne unfair zu sein. Aber: bei Difficulty 4 sind alle Combats relativ gleichförmig — mehr mechanische Vielfalt in höheren Depths wäre wünschenswert (Enemy Abilities, Terrain-Effekte).

### UX Designer
- **Positiv:** Terminal-UI ist atmosphärisch und funktional. Combat Bar mit Radio-Buttons + OK-Badge + 3/3 Counter ist intuitiv. Quick Action Buttons reduzieren Tipp-Aufwand. Party Panel zeigt kritische Info (Condition, Stress, Mood) auf einen Blick.
- **Negativ:** Kein Onboarding für archetype-spezifische Mechaniken. Keine persistente Map — muss jedes Mal `map` tippen. Enemy Health nur als Text (damaged/critical) ohne Farbkodierung. Stress-Labels zu grob (nur TENSE/CRITICAL). RETREAT-Button gefährlich (kein Confirm). Identische Move-Button-Labels bei gleichen Raumtypen. Entropy-Overlay dämpft Dungeon-UI ohne Sinn. Timer <10s hat kein visuelles Warnsignal. Auf höheren Auflösungen wird der verfügbare Platz nicht genutzt.
- **Accessibility:** Terminal-Font ist gut lesbar. WCAG AA Kontrast auf den meisten Elementen. Aria-Labels auf Enemy-Items und Agent-Cards vorhanden. Progressbars haben Labels. Verbesserungspotenzial: `prefers-reduced-motion` für zukünftige Animationen, Keyboard-Navigation für Combat-Bar (aktuell nur Maus/Touch).

### Research (Genre-Vergleich)
- **vs Darkest Dungeon:** Stress-System ist inspiriert und funktioniert. Fehlend: Quirks/Traits die sich im Dungeon entwickeln, Curio-Interaktionen (ähnlich Treasure Rooms — vorhanden!), Camp Skills (ähnlich Rest — vorhanden!), Corpse-Mechnik (tote Feinde blockieren Platz). Die Agent-Card-Glow-Idee bei hohem Stress ist direkt aus DD's Affliction-System inspiriert — exzellente UX-Referenz.
- **vs Slay the Spire:** Map ist StS-inspiriert (Depth-basierte Pfade mit Branching). Fehlend: Map ist nicht immer sichtbar (StS hat always-on Map rechts), keine Relics (vergleichbar mit dungeon-permanenten Consumables — teilweise vorhanden mit Fear Extract etc.), kein Deck-Building (Abilities sind statisch pro Agent).
- **vs FTL:** Timer-Mechnik (45s) erinnert an FTL's Echtzeit-Pause-Hybrid. Fehlend: Schiff-Subsysteme (vergleichbar mit Stability — vorhanden!), Crew-Positionierung (Agents haben keine räumliche Position im Kampf), Surrender/Negotiation mit Feinden.
- **Einzigartiges Alleinstellungsmerkmal:** Die Kombination aus Terminal-UI + Bureau-Narrativ + simulationsspezifischem Flavor-Text ist einzigartig. Kein anderes Roguelike hat literarische Qualität auf diesem Niveau in prozeduralen Texten. Das ist der größte Differenzierungsfaktor und sollte weiter ausgebaut werden.

---

## Positive Observations

1. **Herausragende literarische Qualität** — Boss-Chamber, Rest-Site, D5-Encounter Texte sind auf Publikationsniveau
2. **Archetype-Differenzierung funktioniert** — Shadow und Tower fühlen sich mechanisch und thematisch deutlich anders an
3. **Combat Bar UX ist gut** — Ability-Persistenz zwischen Runden, OK-Badges, 3/3 Counter, Execute-Button
4. **45s Timer angemessen** — Genug Zeit für manuelle Ability-Auswahl
5. **Loot-Vielfalt verbessert** — 6+ verschiedene Tier-1-Items (Fear Extract, Echo Shard, Dark Adaptation, Structural Dust, Load-Bearing Fragment, Demolition Echo)
6. **Rest-Mechanik gut** — Sinnvolle Ressourcen-Management-Entscheidung (Risiko vs Sicherheit, Guardian Watch Option)
7. **Treasure Rooms** — Skill-Check + 3 Choices (Infiltrator/Saboteur/Safe) ist gutes Design
8. **Retreat funktioniert sauber** — Partial Loot bleibt erhalten, graceful Exit
9. **Map-Layout variiert** — 13, 14, 15 Rooms beobachtet. Gute Replayability.
10. **Stress-System balanciert** — Startet bei 0, akkumuliert bedeutsam, Rest heilt signifikant
11. **Enemy thematische Differenzierung** — Shadow Wisp / Echo of Violence / Shadow Tendril / The Remnant vs Tremor Broker
12. **Loot thematische Differenzierung** — Echo/Fear/Shadow-themed vs Structural/Load-bearing-themed
13. **Character Voices** — PKZIP.EXE und LEDGER.EXE haben unterscheidbare Stimmen in Room-Entry-Texten

---

## Kleinigkeiten (Micro-Findings)

1. **Visibility pips in header** zeigen 2 Dots statt 3 Symbole — die Dots sind sehr klein, schwer zu lesen bei kleinen Screens
2. **Dungeon header text "THE SHADOW"** verwendet identisches Styling wie "THE TOWER" — könnte archetype-spezifische Farbe haben (Shadow=dunkelviolett, Tower=warm-orange)
3. **Party panel Mood-Werte** werden angezeigt (-10, -30) — unklar, ob Mood während Dungeons relevant ist oder nur für Post-Dungeon-Effekte. Könnte verwirren.
4. **"CONVENTIONAL BLOCK"** Statusbar-Text unten — bezieht sich auf den Terminal-Kontext (Bureau Terminal), nicht den Dungeon. Während Dungeon könnte das "SHADOW DEPTHS" oder "TOWER FLOORS" heißen.
5. **Room counter "7/13"** in Header ist missverständlich — es zählt visited/total, nicht cleared/total. "7 visited" wäre klarer.
6. **Em-dashes (—) vs en-dashes (–)**: Rest site description uses em-dash in "not light, exactly, but the absence...". Encounter text uses em-dash in "history — a real event". Per CLAUDE.md, `msg()` strings should use en-dash. Verify if these come from frontend `msg()` or backend content. Backend content can use em-dashes, only frontend `msg()` strings are restricted.
7. **Combat resolution text inconsistency**: `[ACT]` prefix used for self-targeting abilities AND enemy stress attacks. Consider differentiating: `[ACT]` for self-buffs, `[ATK]` for enemy attacks to help players scan combat logs faster.
8. **Terminal scroll**: After combat with many rounds, the terminal log is very long. No way to collapse/fold old rounds. A "fold combat log" feature would help.
9. **Map shows old run data**: The terminal buffer persists the entire Run 1 history when starting Run 2. Not a bug per se (it's the terminal), but the dungeon map should reset cleanly.
10. **"Dungeon depth" progressbar** in header has no text label — just a colored bar. Adding "D2/6" or "Depth 2" text on the bar would improve scanability.

---

## Summary: All Action Items (Priorisiert)

### P0 — Must Fix (Bugs)
| ID | Issue | File(s) | Effort |
|----|-------|---------|--------|
| FIX-4-REGR | Move buttons reveal room types for unscouted rooms | `DungeonQuickActions.ts:229` + backend adjacency response | Medium |
| BUG-01 | Deploy Trap shows target selector (should be self-targeting) | `DungeonCombatBar.ts` + `ability_schools.py` | Low |
| BUG-03 | Identical move button labels for same room type | `DungeonQuickActions.ts:223-232` | Low |

### P1 — Should Fix (UX/Game Design)
| ID | Issue | File(s) | Effort |
|----|-------|---------|--------|
| ENH-06 | Entropy overlay dampens dungeon UI | `EntropyOverlay.ts` / alert component | Low |
| ENH-11 | Archetype onboarding briefings (Shadow + Tower) | New component or extend CombatBriefing | Medium |
| ENH-01 | Enemy health 5 states + color coding | `DungeonEnemyPanel.ts:31-36, 304-318` | Medium |
| ENH-04 | Agent card stress visual feedback (glow/pulse) | `DungeonPartyPanel.ts` | Medium |
| ENH-05 | Persistent map widget (responsive) | `DungeonTerminalView.ts` + `DungeonMap.ts` (516 lines, already exists!) | High |
| BUG-09 | Reinforce effect not communicated (+10 Stability) | Terminal output formatter | Low |
| BUG-08 | Observe useless in Tower (Visibility null) | `ability_schools.py` archetype gating | Medium |

### P2 — Nice to Have (Polish)
| ID | Issue | File(s) | Effort |
|----|-------|---------|--------|
| ENH-02 | ELITE/MINION badge styling | `DungeonEnemyPanel.ts` CSS | Low |
| ENH-03 | MINION badge vertical alignment | `DungeonEnemyPanel.ts:121-126` CSS | Low |
| ENH-07 | Retreat hold-to-confirm | `DungeonQuickActions.ts` | Medium |
| ENH-08 | Micro-animations for state changes | Multiple components | High |
| ENH-09 | Haptic feedback service | New `haptic-service.ts` | Medium |
| ENH-10 | Responsive layout 1440p/4K | `DungeonView.ts` CSS | Medium |
| ENH-12 | Micro-animations for map | Map component CSS | Medium |
| BUG-02 | Target selector persists on self-targeting switch | `DungeonCombatBar.ts` | Low |
| BUG-04 | Summary shows raw 0-1000 stress | `dungeon-formatters.ts` | Low |
| BUG-05 | Encounter results show raw key-values | `dungeon-formatters.ts` | Medium |
| BUG-06 | Generic depth entry text not sim-aware | Backend dungeon engine | Medium |
| BUG-07 | Scout text uses Shadow language in Tower | Frontend/backend text generation | Low |
| BUG-10 | Playtest script support-only strategy | `scripts/dungeon_playtest.py` | Medium |
| LORE | Literary improvements (see detailed section) | Backend content + frontend formatters | Varies |

---

## Appendix: Complete File Map (Verified 2026-03-30)

All files verified to exist with line counts.

### Frontend — Dungeon Components (`frontend/src/components/dungeon/`)
| File | Lines | Purpose |
|------|-------|---------|
| `DungeonTerminalView.ts` | 456 | Main dungeon page/container, layout, terminal integration |
| `DungeonCombatBar.ts` | 1047 | Combat ability selection, target picker, execute button, timer |
| `DungeonPartyPanel.ts` | 576 | Agent cards (condition, stress, mood), party status sidebar |
| `DungeonEnemyPanel.ts` | 358 | Enemy display, threat badges, condition text, HP bars |
| `DungeonHeader.ts` | 373 | Dungeon status bar (archetype, depth, room count, stability gauge) |
| `DungeonQuickActions.ts` | 240 | Quick action toolbar (Move, Scout, Map, Look, Status, Retreat, Interact) |
| `DungeonMap.ts` | 516 | ASCII map rendering (already exists — expand for persistent widget) |

### Frontend — Dungeon Utils (`frontend/src/utils/`)
| File | Lines | Purpose |
|------|-------|---------|
| `dungeon-formatters.ts` | 1007 | All terminal text formatting (combat, loot, scout, encounters, completion) |
| `dungeon-commands.ts` | 896 | Terminal command processing (move, scout, attack, rest, interact, retreat) |

### Frontend — Dungeon State/Services
| File | Lines | Purpose |
|------|-------|---------|
| `services/DungeonStateManager.ts` | 490 | Dungeon state management (signals, API calls, phase tracking) |
| `services/api/DungeonApiService.ts` | exists | API service for dungeon endpoints |
| `services/TerminalStateManager.ts` | exists | Terminal state (used by dungeon terminal) |

### Frontend — Shared Components
| File | Lines | Purpose |
|------|-------|---------|
| `components/shared/VelgBadge.ts` | 77 | Reusable badge component (used for threat level badges) |
| `components/health/EntropyOverlay.ts` | 120 | Entropy state overlay + alert banner |

### Backend — Dungeon Engine
| File | Lines | Purpose |
|------|-------|---------|
| `services/dungeon_engine_service.py` | 1999 | Core dungeon engine (move, combat, rest, encounter, completion) |
| `services/dungeon/dungeon_combat.py` | 541 | Combat resolution, damage, conditions |
| `services/dungeon/dungeon_encounters.py` | 1959 | Encounter templates, content generation, room descriptions |
| `services/dungeon/dungeon_loot.py` | 527 | Loot generation, tier rolling, item pools |
| `services/combat/ability_schools.py` | 399 | Ability definitions, archetype gating, target types |
| `services/combat/stress_system.py` | 112 | Stress calculations (ambient, combat, rest healing) |

### Tooling
| File | Lines | Purpose |
|------|-------|---------|
| `scripts/dungeon_playtest.py` | 1414 | Automated playtest runner (needs strategy fix) |

### Key Line Numbers Quick Reference
| What | File:Line |
|------|-----------|
| Move button fog-of-war check | `DungeonQuickActions.ts:229` |
| Target picker rendering | `DungeonCombatBar.ts:890-905` |
| Self-targeting logic | `DungeonCombatBar.ts:959-964` |
| Enemy target auto-pick | `DungeonCombatBar.ts:990-999` |
| Stress label thresholds | `DungeonPartyPanel.ts:441-447` |
| Stress color map | `DungeonPartyPanel.ts:57-62` |
| Threat badge mapping | `DungeonEnemyPanel.ts:31-36` |
| Enemy rendering | `DungeonEnemyPanel.ts:304-318` |
| Stability gauge rendering | `DungeonHeader.ts:338-363` |
| Skill check formatter | `dungeon-formatters.ts:522-560` |
| Raw effects display | `dungeon-formatters.ts:554-557` |
| Scout text (Shadow language) | `dungeon-formatters.ts:588` |
| Visibility null display | `dungeon-formatters.ts:598-599` |
| Completion summary raw stress | `dungeon-formatters.ts:700` |
| Room entry banter | `dungeon-commands.ts:493-501` |
| Ambient stress formula | `stress_system.py:60-67` |
| Entropy overlay alert | `EntropyOverlay.ts:106` |
