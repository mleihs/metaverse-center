# Epoch Playtest Methodology

> Procedures, tooling, and findings from the first full epoch demo match.
> Use this as a repeatable playbook for future playtests and bug/UX hunts.

**Version:** 1.0
**Last playtest:** 2026-03-03
**Match:** "The Glimhaven Accord" — The Gaslit Reach vs Cit&eacute; des Dames (Strategist bot, medium)

---

## 1. Tooling

### WebMCP Browser Automation

The playtest uses **WebMCP** (MCP-based Playwright Chrome Beta) for browser interaction and **macOS `screencapture`** for saving screenshots to disk.

**Key tools:**
- `browser_navigate`, `browser_click`, `browser_fill`, `browser_type` — standard page interaction
- `browser_snapshot` — accessibility tree with `[ref=N]` markers for click targets
- `browser_screenshot` — live visual for verifying state
- `browser_evaluate` — JavaScript execution in page context (critical for shadow DOM)
- `screencapture -x /tmp/epoch-demo/NN-name.png` — lossless macOS capture to numbered files

### Shadow DOM Challenges

Lit 3.3 components use Shadow DOM extensively. Standard `browser_click` works for most elements, but some patterns require workarounds:

**Problem 1: Nested shadow roots.** Elements inside `<velg-deploy-operative-modal>` are 3-4 shadow roots deep. `browser_snapshot` sometimes can't resolve refs.

**Solution:** Use `browser_evaluate` with a recursive shadow DOM traversal helper:

```javascript
function findAllInShadow(root, selector) {
  let results = [];
  const search = (node) => {
    if (node.shadowRoot) {
      results.push(...node.shadowRoot.querySelectorAll(selector));
      node.shadowRoot.querySelectorAll('*').forEach(search);
    }
  };
  search(root);
  return results;
}
```

**Problem 2: Lit reactive property updates.** Mission type card clicks (`.mission-card`) don't reliably trigger `_selectedType` updates when clicked via Playwright. The click event fires but the Lit property doesn't update.

**Solution:** Directly set the Lit component's reactive property:

```javascript
const modal = document.querySelector('velg-deploy-operative-modal');
modal._selectedType = 'infiltrator';
modal.requestUpdate();
```

This is a WebMCP/Playwright limitation, not a user-facing bug — real mouse clicks work fine in-browser.

**Problem 3: Select elements in shadow DOM.** `<select>` dropdowns inside shadow roots need the element's shadow root context, not the document.

**Solution:** Use `browser_evaluate` to set `.value` and dispatch a `change` event:

```javascript
const modal = document.querySelector('velg-deploy-operative-modal');
const select = modal.shadowRoot.querySelector('select.step__select');
select.value = 'target-uuid';
select.dispatchEvent(new Event('change', { bubbles: true }));
```

### Database Verification

When UI state is ambiguous, verify directly via Docker:

```bash
docker exec supabase_db_velgarien-rebuild psql -U postgres -c "SELECT ..."
```

This was critical for confirming BUG-014 (chat messages exist in DB but RLS prevents reading).

### Auth Token Retrieval

Getting a Supabase JWT for direct API calls is tricky when `!` is in the password (shell escaping issues). The reliable approach:

```javascript
// In browser_evaluate
const { data } = await window.__supabase.auth.getSession();
window.__supabase_token = data.session.access_token;
```

Then retrieve with another `browser_evaluate` call. Alternatively, use the `sb_secret_` service role key for admin operations.

---

## 2. Pre-Flight Checklist

Before starting a playtest:

- [ ] Backend running on `:8000` (`curl -s http://localhost:8000/api/v1/health`)
- [ ] Frontend running on `:5173` (`curl -s http://localhost:5173`)
- [ ] Supabase running (`supabase status` — check all 10 services are `HEALTHY`)
- [ ] Screenshot directory exists (`mkdir -p /tmp/epoch-demo`)
- [ ] Browser launched (`browser_launch` with `channel: "chrome-beta"`)
- [ ] Logged in as test account (`admin@velgarien.dev` or player account)
- [ ] Clean epoch state (no stale epochs from previous tests)

### Epoch Cleanup (if needed)

Delete in reverse FK order:

```sql
DELETE FROM bot_decision_log WHERE epoch_id = 'UUID';
DELETE FROM operative_missions WHERE epoch_id = 'UUID';
DELETE FROM epoch_scores WHERE epoch_id = 'UUID';
DELETE FROM battle_log WHERE epoch_id = 'UUID';
DELETE FROM epoch_chat_messages WHERE epoch_id = 'UUID';
DELETE FROM epoch_participants WHERE epoch_id = 'UUID';
DELETE FROM epoch_teams WHERE epoch_id = 'UUID';
DELETE FROM epoch_invitations WHERE epoch_id = 'UUID';
DELETE FROM game_epochs WHERE id = 'UUID';
DELETE FROM simulations WHERE simulation_type IN ('game_instance', 'archived')
  AND epoch_id = 'UUID';
```

**NEVER use `TRUNCATE CASCADE`** — it cascades through foreign keys and can wipe the entire database.

---

## 3. Match Execution Sequence

### Phase 1: Setup (Screenshots 01-10)

1. **Dashboard** — Verify all 5 simulation cards render correctly
2. **Enter simulation** — Click simulation card, navigate to Epoch tab
3. **Create Epoch** — Walk through 4-step wizard:
   - Step 1: Name, duration
   - Step 2: Economy (RP/cycle, RP cap, team size, betrayal toggle)
   - Step 3: Doctrine (scoring dimension weights)
   - Step 4: Review & launch
4. **Lobby** — Verify epoch card appears with "LOBBY" badge
5. **Add bot** — Open Bot Config Panel, select personality + difficulty
6. **Start epoch** — Click "Start Epoch" (requires 2+ participants)

### Phase 2: Foundation (Screenshots 11-18)

Foundation phase is low-intensity — build defenses, deploy guardians.

1. **Deploy guardian** — Open Deploy modal, select guardian type, assign agent, deploy
2. **Resolve cycle** — Admin clicks "Resolve Cycle" (chains 3 API calls automatically)
3. **Chat** — Send messages, check bot responses
4. **Repeat** — 2-4 foundation cycles, then advance phase

### Phase 3: Competition (Screenshots 19-40)

Competition is the main phase — deploy offensive operatives, engage in espionage.

Deploy each operative type at least once:
- **Spy** — Target simulation, reveal intel
- **Saboteur** — Target zone + building, damage infrastructure
- **Propagandist** — Target zone, create events
- **Assassin** — Target simulation + agent, block ambassador
- **Infiltrator** — Target embassy route, reduce effectiveness

### Phase 4: Reckoning (Screenshots 41-46)

Final phase — high-stakes operations, last-chance moves.

1. Deploy remaining operatives
2. Resolve final cycles
3. Advance to completed

### Phase 5: Post-Match (Screenshots 47-51)

1. **Overview tab** — Final state with COMPLETED badge
2. **Leaderboard** — 5-dimension score breakdown
3. **Battle log** — Full timeline with phase dividers
4. **Cartographer's Map** — Multiverse view

### Cycle Resolution (Admin)

Each cycle requires 3 sequential API calls:

1. `POST /epochs/{id}/resolve-cycle` — Grants RP, runs bot decisions
2. `POST /epochs/{id}/operatives/resolve` — Resolves pending missions
3. `POST /epochs/{id}/scores/compute` — Computes dimension scores

The UI "Resolve Cycle" button chains all 3 automatically. If doing manual testing, call them in order.

---

## 4. Screenshot Naming Convention

```
NN-descriptive-name.png
```

- `NN` = zero-padded sequential number (01, 02, ..., 51)
- `descriptive-name` = kebab-case description of what's shown
- All saved to `/tmp/epoch-demo/`
- Use `screencapture -x` (macOS) for lossless full-screen capture

Examples:
```
01-dashboard.png
07-lobby-epoch-created.png
14-guardian-deployed.png
24-spy-success-battlelog.png
45-chat-rls-bug.png
48-leaderboard-final.png
```

---

## 5. Bug Catalog — The Glimhaven Accord (2026-03-03)

### Severity Definitions

| Level | Meaning |
|-------|---------|
| CRITICAL | Blocks core gameplay, data corruption, security hole |
| HIGH | Feature broken or produces incorrect data |
| MEDIUM | Layout/UX problem, stale data, confusing interaction |
| LOW | Cosmetic, grammar, minor polish |

### Bugs (14)

| ID | Sev | Component | Description | Status |
|----|-----|-----------|-------------|--------|
| BUG-001 | MED | SimulationsDashboard | Gaslit Reach card still shows old capybara description. Migration 045 didn't update `simulations.description`. | **FIXED** |
| BUG-002 | LOW | Router | Direct URL to `/simulations/the-gaslit-reach/epoch` stays on dashboard. Route doesn't resolve without prior sim context. | OPEN |
| BUG-003 | MED | EpochCreationWizard | RP defaults show 10/cycle + 30 cap instead of 12/cycle + 40 cap (v2.2 balance). | **FIXED** |
| BUG-004 | LOW | EpochCreationWizard | "Allow Betrayal" stays enabled when team size = 2 (1v1). Betrayal requires alliances. | OPEN |
| BUG-005 | MED | DeployOperativeModal | Guardian cost shows "3 RP" but actual charge is 4 RP (v2.2 balance). Display value stale. | **FIXED** |
| BUG-006 | HIGH | EpochLeaderboard | "No scores recorded yet" despite scores existing in `epoch_scores`. Query/RLS/re-fetch issue. | OPEN |
| BUG-007 | HIGH | EpochCommandCenter | "Resolve Cycle" only called 1 of 3 API steps. Mission timers used wall-clock. RLS required owner role for operative updates. | **FIXED** |
| BUG-008 | HIGH | Epochs Router | No authenticated battle-log endpoint. Players could only see public entries. | **FIXED** |
| BUG-009 | HIGH | EpochBattleLog | Spy `intel_report` not written to DB (CHECK constraint missing type) + not rendered in UI. | **FIXED** |
| BUG-010 | HIGH | DeployOperativeModal | Already-deployed agents shown in dropdown. Silent 409 at end of wizard. | **FIXED** |
| BUG-011 | LOW | DeployOperativeModal | Grammar: "A assassin" → "An assassin". | **FIXED** |
| BUG-012 | MED | DeployOperativeModal | Mission type cards not clickable via Playwright. May be shadow DOM event issue or WebMCP limitation. | OPEN |
| BUG-013 | LOW | DeployOperativeModal | Grammar: "A infiltrator" → "An infiltrator". | **FIXED** |
| BUG-014 | **CRIT** | Chat RLS | Chat messages send (201) but can't be read back. RLS policy joins `epoch_participants.simulation_id` (game instance UUID) with `simulation_members.simulation_id` (template UUID) — no match. | **FIXED** |

### UX Issues (16)

| ID | Sev | Component | Description | Status |
|----|-----|-----------|-------------|--------|
| UX-001 | LOW | DeployOperativeModal | "Target" step label misleading for guardians (they auto-deploy to own sim). | OPEN |
| UX-002 | LOW | EpochDetail | Guardian shows "63% success - 4 RP" — success metric meaningless for permanent guardian. | OPEN |
| UX-003 | HIGH | AdminControls | Resolve Cycle only did step 1. Needed 3 separate clicks. | **FIXED** (merged with BUG-007) |
| UX-004 | LOW | EpochDetail | "+ CREATE NEW EPOCH" button visible inside epoch detail. | OPEN |
| UX-005 | MED | DeployOperativeModal | "Deploy via Embassy" label confusing for offensive ops. Should say "Target Simulation". | OPEN |
| UX-006 | LOW | DeployOperativeModal | Embassy route shows "(dream)" connection type — internal metadata leaked. | OPEN |
| UX-007 | LOW | EpochDetail | No visual distinction between defensive (guardian) and offensive (spy) ops. | OPEN |
| UX-008 | MED | DeployOperativeModal | Mission Assessment donut doesn't reflect modifier breakdown visually. | OPEN |
| UX-009 | LOW | DeployOperativeModal | Propagandist target step has no explanation for missing building selector. | OPEN |
| UX-010 | LOW | DeployOperativeModal | CLASSIFIED briefing doesn't show selected zone. | OPEN |
| UX-011 | MED | EpochOperationsTab | Mission History shows "success" badge but no result narrative or intel. | OPEN |
| UX-012 | HIGH | DeployOperativeModal | Already-deployed agents not filtered. | **FIXED** (merged with BUG-010) |
| UX-013 | HIGH | EpochBattleLog | Spy intel completely invisible. (Same as BUG-009.) | **FIXED** |
| UX-014 | LOW | DeployOperativeModal | Assassin cost shows 8 RP, charged 7. | **FIXED** |
| UX-015 | LOW | DeployOperativeModal | RP cost discrepancy across operative types (display vs actual). | **FIXED** |
| UX-016 | MED | EpochOpsBoard | Completed epoch card shows "Players: 0". | **FIXED** |

### Summary

| Severity | Total | Fixed | Open |
|----------|-------|-------|------|
| CRITICAL | 1 | 1 | 0 |
| HIGH | 8 | 8 | 0 |
| MEDIUM | 10 | 4 | 6 |
| LOW | 11 | 5 | 6 |
| **Total** | **30** | **18** | **12** |

---

## 6. Key Gotchas

### Game Instance Architecture

When an epoch starts, `clone_simulations_for_epoch()` creates **game instance** simulations with new UUIDs. These are NOT the same as template UUIDs. Any RLS policy or query that joins on `simulation_id` must account for this:

- `epoch_participants.simulation_id` = **game instance UUID**
- `simulation_members.simulation_id` = **template UUID**
- Game instances have `source_template_id` pointing back to the template

**BUG-014 is a direct consequence of this.** The chat RLS policy assumes `simulation_members.simulation_id = epoch_participants.simulation_id`, but they refer to different entity types.

### Cycle Resolution is 3 Separate Steps

The epoch lifecycle requires 3 sequential API calls per cycle:
1. Resolve cycle (RP + bot decisions)
2. Resolve operatives (mission outcomes)
3. Compute scores (dimension scoring)

Initially only step 1 was wired to the UI button. All 3 must chain automatically for a smooth admin experience.

### Operative Timers Use Game Cycles, Not Wall-Clock

Operative `resolves_at` and `deployed_at` must advance with game cycles, not real-time. The resolve logic needs to compare against cycle count, not `datetime.utcnow()`.

### Bot Decisions Execute During resolve_cycle

Bot players make decisions synchronously during `resolve_cycle()` (step 1). They use `admin_supabase` (service role) to bypass RLS — bots are system actors, not authenticated users.

### RP Cost Display vs Actual

The Deploy Operative modal shows RP costs from the operative type definitions, but the actual charge may differ due to difficulty scaling or balance patches. The frontend display doesn't dynamically read the backend's `OPERATIVE_COSTS` dict.

### Admin Operations Need service_role

Several epoch admin operations (resolve operatives, archive instances) require `admin_supabase` (service_role key) because:
- They modify data across multiple simulations (game instances)
- RLS policies check `simulation_members` which doesn't cover admin cross-sim access
- Audit logging with `simulation_id=None` is rejected by standard RLS

### Embassy Route Labels Leak Internal Data

Embassy connections have a `connection_type` field (e.g., "dream", "trade", "signal") that shows in the deploy modal dropdown. This is internal metadata — players shouldn't see it.

### Battle Log Privacy Model

- `is_public = true`: Visible to all epoch participants (and spectators)
- `is_public = false`: Visible only to the acting player's simulation
- The public endpoint (`/api/v1/public/battle-feed`) only returns `is_public = true` entries
- The authenticated endpoint returns all entries visible to the authenticated user (requires RLS to filter)

---

## 7. Priority Fix Order

For the next development session, fix bugs in this order:

### Tier 1 — Gameplay Blockers

1. **BUG-014** — Chat RLS policy rewrite for game instances
2. **BUG-009 / UX-013** — Spy intel write + render pipeline

### Tier 2 — Data Correctness

3. **BUG-006** — Leaderboard score display
4. **BUG-003 + BUG-005** — Stale RP defaults and cost display (v2.2 balance)
5. **BUG-001** — Gaslit Reach description update
6. **UX-014 / UX-015** — RP cost discrepancy (display vs actual)

### Tier 3 — UX Polish

7. **UX-005** — Embassy route label clarity
8. **UX-011** — Mission History result narrative
9. **UX-016** — Completed epoch player count
10. **UX-008** — Assessment donut vs modifiers
11. **BUG-011 / BUG-013** — Article grammar (a/an)
12. Remaining LOW-severity UX items

---

## 8. Reproduction Notes

### Match Configuration Used

| Parameter | Value |
|-----------|-------|
| Epoch name | The Glimhaven Accord |
| Duration | 7 days |
| Cycle length | 8 hours (3/day) |
| RP per cycle | 12 |
| RP cap | 40 |
| Max team size | 2 |
| Allow betrayal | No |
| Scoring preset | Balanced (25/20/20/15/20) |
| Player | The Gaslit Reach (admin@velgarien.dev) |
| Bot | Cit&eacute; des Dames (Strategist, medium) |
| Phases played | Foundation (4) + Competition (9) + Reckoning (2) = 15 cycles |
| Final score | Gaslit Reach 100.0 — Cit&eacute; des Dames 38.4 |

### Operatives Deployed (Player)

| Cycle | Type | Agent | Target | Outcome |
|-------|------|-------|--------|---------|
| 2 | Guardian | Archivist Quill | (self) | Permanent |
| 3 | Spy | Commodore Harrowgate | Cit&eacute; des Dames | Success — intel revealed |
| 5 | Saboteur | Obediah Crook | Cit&eacute; des Dames / Quarter of Reason / unknown | Success — zone downgraded |
| 7 | Propagandist | Mother Cinder | Cit&eacute; des Dames / Quarter of Valor | Success — event created |
| 9 | Assassin | Obediah Crook | Cit&eacute; des Dames / Christine de Pizan | Failed |
| 10 | Infiltrator | Madam Lacewing | Cit&eacute; des Dames (embassy) | Active at completion |

### Screenshots

51 screenshots saved to `/tmp/epoch-demo/` (01-51):
- 01-06: Dashboard + wizard
- 07-10: Lobby + bot + start
- 11-18: Foundation phase
- 19-40: Competition phase (all 6 operative types)
- 41-46: Reckoning phase + chat RLS bug
- 47-51: Post-match (overview, leaderboard, battle log, map)

---

## 9. Running Future Playtests

### Quick Start

```bash
# 1. Ensure services are running
curl -s http://localhost:8000/api/v1/health
curl -s http://localhost:5173 | head -1

# 2. Clean up previous epoch data (if needed)
docker exec supabase_db_velgarien-rebuild psql -U postgres -c \
  "DELETE FROM game_epochs WHERE status = 'completed';"
docker exec supabase_db_velgarien-rebuild psql -U postgres -c \
  "DELETE FROM simulations WHERE simulation_type IN ('game_instance', 'archived');"

# 3. Create screenshot directory
mkdir -p /tmp/epoch-demo-$(date +%Y%m%d)

# 4. Launch browser via WebMCP
# browser_launch with channel "chrome-beta", url "http://localhost:5173"
```

### Suggested Variations

| Variation | Config | Tests |
|-----------|--------|-------|
| **1v1 no betrayal** | 2 players, betrayal off | Core mechanics, scoring |
| **1v1 with betrayal** | 2 players, betrayal on | Alliance/betrayal flow |
| **3-player FFA** | 3 players (1 human, 2 bots) | Multi-target operatives, alliances |
| **4-player teams** | 4 players, team size 2 | Team chat, team scoring |
| **Speed run** | 1h cycles, 5 total | Quick iteration for UI bugs |
| **Bot-only spectator** | 2 bots, human observes | Bot decision quality, auto-play |
| **Different personalities** | Warlord, Diplomat, Chaos bots | Personality behavior validation |

### What to Look For

- **Scoring accuracy** — Do dimension scores match expectations from operative outcomes?
- **Bot behavior** — Does the bot make reasonable decisions? Does it chat coherently?
- **RLS gaps** — Can players see data they shouldn't? Can they modify others' data?
- **UI state consistency** — Does the UI reflect DB state after each resolution?
- **Mobile layout** — Do epoch components work at narrow viewports?
- **Phase transitions** — Does advancing phase correctly update all UI indicators?
- **Edge cases** — What happens if all agents are deployed? If RP runs out? If all embassies are infiltrated?
