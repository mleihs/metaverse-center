# Epoch Gameplay Audit — Player Perspective (2026-03-09)

Tested as: Voss (Vel) — player-velgarien@velgarien.dev
Epoch: The Convergence Protocol (Tested across Competition → Completed phases)

---

## Critical Bugs

### 1. Academy Join 409 — Template vs Game Instance Check
- **Where**: `POST /api/v1/epochs/{id}/participants` (backend)
- **What**: Joining an Academy epoch fails with 409 "simulation already in epoch" because the check validates the template simulation instead of the game instance clone.
- **Impact**: Players with a simulation already in another epoch cannot join the Academy at all.
- **Expected**: The game_instance clone should be checked, not the template.

### 2. Academy No Auto-Join
- **Where**: `academy_service.py` / `AcademyEpochCard.ts`
- **What**: "Start Training" creates a LOBBY epoch but does NOT auto-join the player. Player must manually navigate to Epoch Command Center and click "+ Join as [Simulation]".
- **Impact**: Confusing multi-step flow for what should be a one-click action.
- **Expected**: Academy creation should auto-join the player's simulation and transition to Foundation phase.

### 3. Duplicate Academy Creation
- **Where**: Dashboard `AcademyEpochCard.ts`
- **What**: Player can click "Start Training" multiple times, creating duplicate LOBBY academies. No guard against existing unfinished academies.
- **Impact**: Clutters Epoch Command Center with empty lobbies.
- **Expected**: Check for existing academy epochs before creating; show "Resume Training" if one exists in LOBBY.

### 4. VelgGameCard Overflow — preserve-3d Breaks overflow:hidden
- **Where**: `VelgGameCard.ts:96` (`.card { overflow: hidden; transform-style: preserve-3d; }`)
- **What**: `transform-style: preserve-3d` on `.card` breaks `overflow: hidden` in most browsers. Aptitude dots, subtitle text, and other body content overflow past the card frame boundary.
- **Visible in**: Deploy Operative modal Asset zone — agent card shows aptitude circles and "male"/"female" text below the card border.
- **Fix**: Move `transform-style: preserve-3d` to only apply during `.card--interactive.card--tilting` state.

---

## UI/UX Issues

### 5. MissionCard Effect Text Truncated from Top
- **Where**: `MissionCard.ts` — `.card__effect` (position: absolute, bottom: 6px)
- **What**: Long effect text grows upward from bottom:6px without height constraint. On smaller cards (120x192 sm), text like "Reveals target health metrics, zone stability, and active operatives." gets cut off at the top — only "metrics, zone stability, and active operatives." is visible.
- **Fix**: Add `max-height` + `overflow: hidden` to `.card__effect`, or use `text-overflow: ellipsis` with line-clamp.

### 6. Mission Card Hover Z-Index Overlap
- **Where**: `DeployOperativeModal.ts:666-677`
- **What**: Hovered mission card scales 1.35x and gets z-index:10, but the `animation: mission-deal forwards` sets `transform` on ALL cards, creating stacking contexts. Later DOM elements (e.g. GUARDIAN) paint over the hovered card (e.g. SPY).
- **Fix**: Add `position: relative; z-index: 1;` to all `.mission-grid velg-mission-card` and `isolation: isolate` to `.mission-grid`.

### 7. GUARDIAN Operations Display — Leading Dot Without Value
- **Where**: `EpochOverviewTab.ts` / `EpochOperationsTab.ts`
- **What**: GUARDIAN operative shows "· 3 RP" with a leading dot but no success percentage. Other operative types show "65% success · 3 RP". The missing value makes it look like a rendering bug.
- **Fix**: Show "Permanent · 3 RP" or just "3 RP" without the leading dot for guardian type.

### 8. CRITICAL: Frontend/Backend Success Formula Mismatch
- **Where**: `DeployOperativeModal.ts:1997` vs `operative_mission_service.py:274`
- **What**: Frontend and backend use completely different formulas:
  - **Backend**: `aptitude × 0.03` (aptitude 9 → +27%, aptitude 5 → +15%)
  - **Frontend**: `(aptitude - 5) × 0.03` (aptitude 9 → +12%, aptitude 5 → +0%)
  - **Backend zone_security**: numeric values (1-10) × 0.05
  - **Frontend zone_security**: `{low:1, medium:2, high:3}` × 0.05
  - **Backend embassy**: `embassy_effectiveness × 0.15` (eff ~0.5-0.6, so +7.5-9%)
  - **Frontend embassy**: flat `0.15` (+15%)
- **Impact**: Player sees 77% in deploy modal but operations list shows 65%. All three formula components differ.
- **Examples observed**:
  - Propagandist (aptitude 9): Modal 77%, Operations 65%
  - Infiltrator (aptitude 9): Modal 82%, Operations 60%
  - Assassin (aptitude 5): Modal shows +0% aptitude bonus, backend would give +15%
- **Fix**: Align frontend `_estimateSuccess()` to match backend `_calculate_success_probability()`.

### 9. Inappropriate Seed Data Name
- **Where**: `supabase/seed/` — simulation name "Spengbab's Whore House"
- **What**: Offensive/inappropriate simulation name visible in Academy epoch cards and Join buttons.
- **Fix**: Rename to something thematic and appropriate.

### 10. "Sprint 3D" Label Unclear
- **Where**: Dashboard `AcademyEpochCard.ts`
- **What**: "SPRINT 3D" badge meaning "3 days" is not immediately obvious to new players.
- **Fix**: Use "3 Days" or "3-Day Sprint" instead.

### 11. War Room Stat Card Color Ambiguity
- **Where**: `WarRoomPanel.ts`
- **What**: "DEPLOYED" and "DETECTIONS" stat cards both use amber accent color. Could be confused at a glance.
- **Fix**: Use yellow/warning color for DETECTIONS to differentiate from DEPLOYED amber.

### 12. Leaderboard — No Highlight for Own Row
- **Where**: `EpochLeaderboard.ts`
- **What**: Player's own simulation (Velgarien, #1) has no visual differentiation from other rows. No background highlight, no "YOU" badge, no border accent.
- **Impact**: In larger epochs, player can't quickly find their own position.
- **Fix**: Add subtle row highlight (e.g. amber left border or slightly different background) for the player's own simulation.

### 13. Leaderboard Column Abbreviations — No Tooltips
- **Where**: `EpochLeaderboard.ts`
- **What**: Column headers use abbreviations (STAB, INFL, SOVR, DIPL, MILT) with no tooltip or hover explanation.
- **Impact**: New players won't know what these metrics represent.
- **Fix**: Add `title` attribute or hover tooltip with full names (Stability, Influence, Sovereignty, Diplomacy, Military).

### 14. Alliances — No "Propose Alliance" CTA
- **Where**: `EpochAlliancesTab.ts`
- **What**: No visible button to propose a new alliance to unaligned participants. Only existing alliance with "Leave" button shown.
- **Impact**: Player cannot initiate alliances from this tab.
- **Check**: Is alliance creation available elsewhere? If not, add "Propose Alliance" button.

### 15. Completed Epoch Shows "SPECTATING: You are not participating"
- **Where**: `EpochOverviewTab.ts` — completed epoch detail view
- **What**: When viewing a completed epoch, the Quick Actions area shows "SPECTATING — You are not participating in this epoch." even for the winner (Velgarien, #1 rank).
- **Impact**: The player who just won sees a message that denies their participation.
- **Fix**: Detect participant status independently of epoch active state. Show final standings/celebration instead.

### 16. No Results/Victory Screen — Underwhelming Epoch Completion
- **Where**: Epoch detail view for completed epochs
- **What**: The completed epoch view is nearly identical to the active game view. No victory celebration, no score animations, no MVP awards, no summary statistics, no per-metric breakdown.
- **Missing elements**:
  - No "Results" phase on phase stepper (stops at Reckoning)
  - No congratulations message or victory banner for the winner
  - No score reveal animation
  - No final statistics summary (total operations, successes, failures, agents captured)
  - No comparison chart or per-metric (STAB/INFL/SOVR/DIPL/MILT) breakdown
- **Impact**: Anti-climactic ending to a 14-day competitive epoch. No sense of achievement.
- **Expected**: Dedicated results tab/view with animated score reveal, podium display, and game summary.

### 17. Operations Still "Active"/"Deploying" in Completed Epoch
- **Where**: `EpochOverviewTab.ts` — Your Operations section
- **What**: Operations show "deploying" and "active" status with functional "RECALL" buttons even after epoch completion. All missions should be resolved (succeeded/failed/captured) when the epoch ends.
- **Impact**: Player confusion — are these missions still running? Can I still recall?
- **Fix**: Resolve all pending missions on epoch completion. Disable RECALL buttons in completed epochs.

### 18. Deploy Toast Lacks Detail
- **Where**: Deploy confirmation toast notification
- **What**: Toast shows generic "SIGNAL CONFIRMED — Operative deployed. Mission [type] initiated." with no specifics.
- **Missing**: Agent name, target zone/simulation/agent, success probability
- **Example**: Should be "Pater Cornelius deployed as Propagandist → The Gaslit Reach (The Undertide Docks) — 77% success"
- **Impact**: When deploying multiple agents rapidly, player can't tell which confirmation corresponds to which deployment.

### 19. Recent Events Lack Agent Names and Target Details
- **Where**: `EpochOverviewTab.ts` — Recent Events section
- **What**: Events show "A propagandist has been deployed. → The Gaslit Reach Cycle 33" without naming the agent or specific target zone.
- **Expected**: "Pater Cornelius deployed as Propagandist → The Undertide Docks, The Gaslit Reach — Cycle 33"

### 20. Deploy Modal Header Doesn't Update After Mission Selection
- **Where**: `DeployOperativeModal.ts` header subtitle
- **What**: After selecting a mission type that requires embassy routing, the subtitle still says "CHOOSE A MISSION TYPE" instead of guiding the player to select an embassy route. The embassy dropdown is present but not highlighted or called out.
- **Impact**: Players may not realize they need to select an embassy before seeing target options, causing confusion about why the TARGET zone remains empty.
- **Fix**: Update subtitle to "SELECT EMBASSY ROUTE" after mission selection (when embassy is required).

### 21. Seed Data: Most Velgarien Agents Missing Aptitudes
- **Where**: `supabase/seed/015_epoch_demo_data.sql`
- **What**: Only Inspektor Mueller had aptitude values seeded. All other Velgarien agents (Elena Voss, Lena Kray, Viktor Harken, etc.) had NULL aptitudes, meaning the aptitude system was untestable with default seed data.
- **Fix**: Seed aptitude values for all agents in demo data.

### 22. Epoch Demo Data Uses Templates Instead of Game Instances
- **Where**: `epoch_participants` table / seed data
- **What**: The Convergence Protocol epoch uses template simulations directly as participants (`simulation_type='template'`) instead of game instance clones. This violates the game instance architecture where templates are immutable and gameplay runs on clones.
- **Impact**: Template data could be mutated during gameplay; doesn't match production flow.
- **Fix**: Seed data should create proper game_instance clones for epoch participants.

---

## Positive Highlights

- **Deploy Operative Modal** ("War Table"): Visually impressive 3-zone card placement flow with animations, slam effects, and clear step progression.
- **Success Probability Breakdown**: Transparent formula display (base + aptitude + zone security + embassy effectiveness) helps informed decision-making. ⚠️ But frontend formula doesn't match backend (Bug #8).
- **Battle Log**: Immersive AI-generated narrative text with phase transition banners. Excellent storytelling.
- **Cycle Readiness System**: "Signal Ready" button with player status list is intuitive.
- **War Room**: Cycle navigation (◄ ►), stat cards, and SITREP generation are premium features.
- **FIT Badge**: GOOD/FAIR/POOR badge for agent-mission compatibility is helpful.
- **Mission History**: "captured"/"failed" outcomes with narrative explanation — great for learning.
- **Phase Stepper**: Clear visual progression (Foundation → Competition → Reckoning). Missing Results phase.
- **FIT Badge Thresholds**: GOOD (7-9), FAIR (5-6), POOR (3-4) — clear and consistent across all deploys.
- **Aptitude Dot Display**: Correct per-operative-type dots on agent cards, with the relevant aptitude highlighted during mission selection.
- **Assassin Target Selection**: Unique target picker showing individual enemy agents — great UX for targeted operations.
- **Infiltrator Auto-Target**: Embassy IS the target for infiltrators, auto-fills correctly — reduces unnecessary clicks.
- **Zone Security Badges**: RESTRICTED/HIGH/MEDIUM/LOW labels with color coding help informed target selection.
- **HOSTILE TERRITORY Banner**: Clear identification of whose territory you're targeting.

---

## Tested This Session

- [x] Game completion / Results phase screen → **Underwhelming** (Bug #16)
- [x] All 6 operative types deployed (spy, guardian, saboteur, propagandist, infiltrator, assassin)
- [x] Aptitude values verified correct in display vs database
- [x] Success probability formula comparison (frontend vs backend) → **Major mismatch** (Bug #8)
- [x] FIT badge (GOOD/FAIR/POOR) behavior verified across aptitude ranges
- [x] Deploy flow for zone-target (propagandist), embassy-target (infiltrator), and agent-target (assassin)

## Still Untested

- [ ] Counter-Intel Sweep action
- [ ] Recall operative flow (button exists but untested)
- [ ] Chat tab functionality
- [ ] Leaderboard full view (detailed tab)
- [ ] Mobile responsiveness
- [ ] Actual cycle resolution (we skipped cycles via DB — no organic resolve_cycle() ran)
- [ ] Agent action feedback from cycle resolution (narrative outcomes)
- [ ] Score change animations between cycles

---

## Post-Audit Fixes

The following issues were addressed after the audit session:

- **Deploy enrichment refactored to clean architecture** — removed admin bypass; deploy flow now uses proper service-layer enrichment without elevated privileges
- **Spy intel now shows zone names** — intel report narratives and the Intel Dossier display zone names alongside security levels (e.g. "The Undertide Docks: low") instead of bare security tiers
- **Mission duration display added** — active missions now show cycles remaining until completion
- **"3-Day Sprint" renamed to "Quick Match"** — academy mode label clarified for new player comprehension
- **Intel Dossier enhanced** — snapshot indicator added to card footer; zone name display in security badges; updated empty state hint explaining point-in-time snapshot nature of spy intelligence
