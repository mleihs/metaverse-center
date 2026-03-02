# 22 - Epochs & Competitive Layer

**Version:** 1.4
**Date:** 2026-03-02
**Change v1.4:** Balance patch v2.2 — guardian penalty 0.08→0.06/unit (cap 0.15), guardian cost 3→4 RP, infiltrator rework (cost 6→5, embassy reduction 50%→65%, +3 influence/success, sovereignty −6→−8, score 5→6), assassin cost 8→7 + stability −4→−5 + sovereignty −10→−12, saboteur stability −5→−6, propagandist sovereignty −5→−6, detection penalty 2→3, RP economy 10→12/cycle + cap 30→40, counter-intel sweep 3→4 RP.
**Change v1.3:** Balance patch v2.1 — guardian penalty 0.20→0.08/unit (cap 0.20), spy intel reveal (zone security + guardian count to battle log), saboteur zone downgrade (security −1 tier), scoring rebalance (propagandist +3→+5, detection −3→−2, spy influence +1/+2, guardian sovereignty +4), betrayal −20%→−25%, alliance 10%→15%. Cartographer's Map: game instance visualization (phase rings, health arcs, sparklines, operative trails, battle feed, leaderboard panel, minimap, 30s refresh).
**Change v1.2:** EpochCommandCenter decomposed from monolithic 3364-line file into orchestrator (1934 lines) + 5 child components: EpochOpsBoard (ops board + COMMS sidebar), EpochOverviewTab, EpochOperationsTab, EpochAlliancesTab, EpochLobbyActions. Data flows via Lit properties, mutations via CustomEvent bubbling. ~60 hardcoded hex colors replaced with CSS custom property tokens across all epoch components.

---

## Overview

Epochs are time-limited competitive seasons where simulation owners become active players competing for multiverse dominance. During an Epoch, every worldbuilding decision — staffing buildings, maintaining embassies, managing events — has direct scoring consequences. Simulations deploy covert operatives through embassies to sabotage rivals, gather intelligence, and spread propaganda, while defending their own worlds from infiltration.

Outside of Epochs, the simulation economy (staffing, zone stability, diplomacy, bleed) runs as PvE infrastructure. Epochs activate the PvP competitive layer on top of this foundation.

### Lore Context

> "The Cartographers observed. They mapped. They recorded. But they never intervened — until the Convergence. When the walls between Shards thinned beyond safe limits, the Bureau declared an Epoch: a controlled collision of realities. The Shards would compete. The strongest narrative would persist. The weakest would fade. This was not cruelty. This was triage."

Epochs represent moments when the multiverse forces its simulations into direct competition. The Bleed intensifies, embassies become espionage channels, and the careful infrastructure each simulation owner has built is tested under fire.

---

## Feature Architecture

### Database Schema

**7 tables** (migrations 032 + 037):

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `game_epochs` | Epoch definitions + lifecycle | `name`, `status` (lobby→foundation→competition→reckoning→completed), `config` (JSONB), `current_cycle` |
| `epoch_participants` | Simulation enrollment per epoch | `epoch_id`, `simulation_id`, `team_id`, `current_rp`, `final_scores` |
| `epoch_teams` | Alliance definitions | `name`, `epoch_id`, `created_by_simulation_id`, `dissolved_at`, `dissolved_reason` |
| `operative_missions` | Deployed operatives + results | `agent_id`, `operative_type`, `source_simulation_id`, `target_simulation_id`, `embassy_id`, `status`, `success_probability`, `mission_result` |
| `epoch_scores` | Score snapshots per cycle | `cycle_number`, 5 dimension scores + composite, unique per (epoch, simulation, cycle) |
| `battle_log` | Narrative event feed | `event_type`, `narrative`, `is_public`, `metadata` |
| `epoch_chat_messages` | Realtime chat messages (epoch-wide + team) | `epoch_id`, `sender_id`, `sender_simulation_id`, `channel_type`, `team_id`, `content` |

**4 materialized views** (migration 031):

| View | Purpose |
|------|---------|
| `mv_building_readiness` | Staffing ratio x qualification match x condition factor per building |
| `mv_zone_stability` | Infrastructure score + security factor - event pressure per zone |
| `mv_embassy_effectiveness` | Building health x ambassador quality x vector alignment per embassy |
| `mv_simulation_health` | Aggregate zone stability + diplomatic reach per simulation |

### Backend

| Component | File | Purpose |
|-----------|------|---------|
| **Epoch Router** | `routers/epochs.py` (268 lines) | CRUD epochs, join/leave, team management, lifecycle transitions |
| **Operatives Router** | `routers/operatives.py` (145 lines) | Deploy, recall, list missions, counter-intelligence |
| **Scores Router** | `routers/scores.py` (79 lines) | Leaderboard, score history, final standings |
| **Game Mechanics Router** | `routers/game_mechanics.py` (171 lines) | Simulation health, building readiness, zone stability |
| **Epoch Service** | `services/epoch_service.py` (501 lines) | Lifecycle (create → start → advance → resolve → complete), RP allocation, cycle resolution |
| **Operative Service** | `services/operative_service.py` (559 lines) | Deploy/recall/resolve missions, success probability calculation |
| **Scoring Service** | `services/scoring_service.py` (389 lines) | 5-dimension scoring, normalization, composite weighting |
| **Battle Log Service** | `services/battle_log_service.py` (259 lines) | Record + query competitive event narratives |
| **Game Mechanics Service** | `services/game_mechanics_service.py` (310 lines) | Read materialized views, compute live simulation metrics |

### Frontend

| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| **EpochCommandCenter** | `components/epoch/EpochCommandCenter.ts` | 1934 | Orchestrator — fetches state, delegates to subcomponents, handles mutations |
| **EpochOpsBoard** | `components/epoch/EpochOpsBoard.ts` | 1065 | Operations board: dossier cards + COMMS sidebar (collapsible chat panel) |
| **EpochOverviewTab** | `components/epoch/EpochOverviewTab.ts` | 488 | Overview + mission cards, dispatches deploy/counter/recall events |
| **EpochOperationsTab** | `components/epoch/EpochOperationsTab.ts` | 355 | Operations tab, dispatches recall events |
| **EpochAlliancesTab** | `components/epoch/EpochAlliancesTab.ts` | 400 | Alliances tab, dispatches create/join/leave-team events |
| **EpochLobbyActions** | `components/epoch/EpochLobbyActions.ts` | 397 | Lobby actions + admin controls, dispatches epoch lifecycle events |
| **EpochCreationWizard** | `components/epoch/EpochCreationWizard.ts` | 1245 | 3-step epoch setup (Parameters/Economy/Doctrine) |
| **DeployOperativeModal** | `components/epoch/DeployOperativeModal.ts` | 1502 | 3-step operative deployment (Asset/Mission/Target) |
| **EpochLeaderboard** | `components/epoch/EpochLeaderboard.ts` | 411 | Sortable score table with per-dimension bars |
| **EpochBattleLog** | `components/epoch/EpochBattleLog.ts` | 262 | Narrative event feed with filtering |
| **EpochsApiService** | `services/api/EpochsApiService.ts` | 203 | 27 API methods for epochs + operatives + scores |

### API Endpoints

**Epoch CRUD & Lifecycle:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/epochs` | optional | List all epochs (paginated) |
| GET | `/epochs/active` | optional | Get active epoch |
| GET | `/epochs/{id}` | optional | Get epoch detail |
| POST | `/epochs` | owner | Create epoch |
| PATCH | `/epochs/{id}` | creator | Update epoch config |
| POST | `/epochs/{id}/start` | creator | Start epoch (lobby → foundation) |
| POST | `/epochs/{id}/advance` | creator | Advance phase |
| POST | `/epochs/{id}/cancel` | creator | Cancel epoch |
| POST | `/epochs/{id}/resolve-cycle` | creator | Trigger cycle resolution |

**Participants & Teams:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/epochs/{id}/participants` | optional | List participants |
| POST | `/epochs/{id}/participants` | owner | Join epoch with simulation |
| DELETE | `/epochs/{id}/participants/{sim}` | owner | Leave epoch |
| GET | `/epochs/{id}/teams` | optional | List teams |
| POST | `/epochs/{id}/teams` | owner | Create team |
| POST | `/epochs/{id}/teams/{tid}/join` | owner | Join team |
| POST | `/epochs/{id}/teams/leave` | owner | Leave team |

**Operatives:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/epochs/{id}/operatives` | owner | List your missions |
| GET | `/epochs/{id}/operatives/{mid}` | owner | Get mission detail |
| POST | `/epochs/{id}/operatives` | owner | Deploy operative |
| POST | `/epochs/{id}/operatives/{mid}/recall` | owner | Recall operative |
| GET | `/epochs/{id}/operatives/threats` | owner | List detected threats |
| POST | `/epochs/{id}/operatives/counter-intel` | owner | Counter-intelligence sweep (3 RP) |

**Scores & Battle Log:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/epochs/{id}/scores/leaderboard` | optional | Current leaderboard |
| GET | `/epochs/{id}/scores/standings` | optional | Final standings |
| GET | `/epochs/{id}/scores/simulations/{sid}` | owner | Score history |
| GET | `/epochs/{id}/battle-log` | optional | Battle log entries |

**Public (no auth):**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/public/epochs` | List epochs |
| GET | `/public/epochs/active` | Active epoch |
| GET | `/public/epochs/{id}` | Epoch detail |
| GET | `/public/epochs/{id}/participants` | Participants |
| GET | `/public/epochs/{id}/teams` | Teams |
| GET | `/public/epochs/{id}/leaderboard` | Public leaderboard |
| GET | `/public/epochs/{id}/standings` | Final standings |
| GET | `/public/epochs/{id}/battle-log` | Public battle log |

---

## How It Works

### Epoch Lifecycle

```
LOBBY ──→ FOUNDATION ──→ COMPETITION ──→ RECKONING ──→ COMPLETED
          (first ~20%)    (middle ~65%)    (final ~15%)
```

1. **Lobby** — Epoch created, simulations join, teams form. No game mechanics active.
2. **Foundation** — +50% RP income. Build infrastructure, staff buildings, establish embassies. No offensive operatives allowed (guardians OK).
3. **Competition** — Full mechanics. All 6 operative types available. Alliances locked. Scores snapshot each cycle.
4. **Reckoning** — Bleed permeability doubled, thresholds reduced by 2, cascade depth +1. Dramatic escalation.
5. **Completed** — Final scores computed, winner declared, operatives recalled.

### Resonance Points (RP)

RP is the action economy currency. Each simulation receives RP at the start of each cycle.

| Setting | Default | Description |
|---------|---------|-------------|
| RP per cycle | 12 | Base allocation (foundation: 18) |
| RP cap | 40 | Maximum stored RP — excess is lost |
| Cycle interval | 8 hours | Time between cycle resolutions |

**RP costs:**

| Action | Cost |
|--------|------|
| Deploy Spy | 3 RP |
| Deploy Guardian | 4 RP |
| Deploy Propagandist | 4 RP |
| Deploy Saboteur | 5 RP |
| Deploy Infiltrator | 5 RP |
| Deploy Assassin | 7 RP |
| Counter-intelligence sweep | 4 RP |

### Operative Types

| Type | Cost | Deploy Time | Duration | Effect |
|------|------|-------------|----------|--------|
| **Spy** | 3 RP | Instant | 3 cycles | Reveals target zone security levels and guardian count (intel report in battle log). +2 Influence, +1 Diplomatic, −2 Sovereignty. |
| **Saboteur** | 5 RP | 1 cycle | Single action | Downgrades random zone security −1 tier + building condition −1. −6 Stability, −8 Sovereignty. |
| **Propagandist** | 4 RP | 1 cycle | 2 cycles | Generates a destabilizing event (impact 6-8) in target zone |
| **Assassin** | 7 RP | 2 cycles | Single action | Wounds target agent — reduces relationships by 2, removes ambassador status for 3 cycles |
| **Guardian** | 4 RP | Instant | Permanent | −6% enemy success per guardian (max −15%). Deploys to OWN simulation only. |
| **Infiltrator** | 5 RP | 2 cycles | 3 cycles | Reduces target embassy effectiveness by 65%. +3 Influence per success. |

### Success Probability

```
base_probability = 0.55
+ operative_qualification × 0.05  (0-10 scale → +0 to +0.50)
- target_zone_security × 0.05    (mapped 0-10 → -0 to -0.50)
- min(0.15, guardian_presence × 0.06)  (−0.06 each, cap 0.15)
+ embassy_effectiveness × 0.15   (0-1 → +0 to +0.15)

Final: clamped to [0.05, 0.95]
```

**Failure outcomes:**
- **Undetected failure** — Mission fails silently. Operative returns. No consequences.
- **Detected failure** (probability: 1 - success_probability) — Operative captured (removed for epoch). Diplomatic Incident event in both simulations (impact 7). Embassy effectiveness -0.3 for 3 cycles. Attacker identity revealed. −3 Sovereignty per detection.

### Scoring — 5 Dimensions

| Dimension | What it rewards | Default Weight | Title |
|-----------|----------------|----------------|-------|
| **Stability** | Keeping simulation healthy (avg zone stability) | 25% | "The Unshaken" |
| **Influence** | Shaping other worlds via bleed echoes | 20% | "The Resonant" |
| **Sovereignty** | Resisting foreign influence | 20% | "The Sovereign" |
| **Diplomatic** | Embassy network + alliances | 15% | "The Architect" |
| **Military** | Successful covert operations | 20% | "The Shadow" |

**Composite score** = weighted sum of normalized dimensions. Each dimension is rescaled 0–100 relative to the highest scorer in that dimension. Configurable weights via Epoch Creation Wizard presets: Balanced / Builder / Warmonger / Diplomat.

**Team scoring** = sum of member scores + 5% alliance bonus per active member.

### Alliances & Betrayal

- Teams form during lobby/foundation. Max team size configurable (default 3).
- Alliances lock when competition phase begins (no new teams).
- If `allow_betrayal = true`: allied simulations can covertly attack each other.
  - **Detected betrayal** → alliance immediately dissolves, betrayer gets -25% Diplomatic Score.
  - **Undetected betrayal** → normal operative effects, alliance intact.

### Embassy Requirement

Embassies are the **only channel** for deploying operatives. You cannot attack a simulation without an active embassy connection.

**Strategic implications:**
- Embassies enable both diplomacy (scoring) AND warfare (operatives)
- Dissolving an embassy immediately recalls all your operatives through that channel
- An enemy can dissolve their embassy to cut off your operative pipeline
- But dissolving also kills your own offensive capability and diplomatic score

---

## User Interface

### Epoch Command Center (`/epoch`)

Platform-level route accessible to all authenticated users. Five tabs:

1. **Overview** — Epoch status banner (name, phase, day counter, next cycle countdown, RP counter), quick actions panel
2. **Leaderboard** — Sortable table with rank, simulation name, composite score, per-dimension bars, team affiliation
3. **Operations** — Your active operatives (status, remaining cycles), detected threats, deploy button
4. **Battle Log** — Chronological narrative feed of competitive events (filterable by type)
5. **Alliances** — Your team, invite/leave controls

**Lobby view** (no active epoch): Past epochs list + Create Epoch button (owners only).

**Design:** Military command console aesthetic. Dark background (gray-950), green (#4ade80) accent for active elements, amber (#f59e0b) for RP/warnings. Monospace readouts for stats. Scan-line texture overlay.

### Epoch Creation Wizard

3-step modal wizard:

1. **Parameters** — Name, duration (3-60 days), cycle interval (2-24 hours), phase percentages (foundation/reckoning split with computed competition phase)
2. **Economy** — RP per cycle, RP cap, max team size, allow betrayal toggle
3. **Doctrine** — 5 score weight sliders (must sum to 100%) with presets: Balanced (25/20/20/15/20), Builder (40/15/15/10/20), Warmonger (15/15/15/15/40), Diplomat (15/20/20/30/15)

### Deploy Operative Modal

3-step tactical dossier wizard:

1. **Asset** — Select agent from your simulation. Shows dossier card (portrait, professions, character excerpt). Warning about leaving building post.
2. **Mission** — Choose operative type (6 cards with cost/duration/effect). Select embassy route. Guardian special case (deploys to own simulation, no embassy needed).
3. **Target** — Select target zone/building/agent based on mission type. SVG targeting ring shows success probability with factor breakdown. Confirmation summary with RP cost.

**Design:** Tactical dossier aesthetic. Amber (#f59e0b) accent, scan-line textures, CLASSIFIED watermark, targeting ring SVG for success probability visualization.

---

## TypeScript Interfaces

```typescript
type EpochStatus = 'lobby' | 'foundation' | 'competition' | 'reckoning' | 'completed' | 'cancelled';
type OperativeType = 'spy' | 'saboteur' | 'propagandist' | 'assassin' | 'guardian' | 'infiltrator';

interface EpochConfig {
  duration_days: number;     // 3-60
  cycle_hours: number;       // 2-24
  rp_per_cycle: number;      // 5-25
  rp_cap: number;            // 15-75
  foundation_pct: number;    // 10-30
  reckoning_pct: number;     // 10-25
  max_team_size: number;     // 2-8
  allow_betrayal: boolean;
  score_weights: EpochScoreWeights;
  referee_mode: boolean;
}

interface Epoch {
  id: UUID;
  name: string;
  description?: string;
  created_by_id: UUID;
  starts_at?: string;
  ends_at?: string;
  current_cycle: number;
  status: EpochStatus;
  config: EpochConfig;
}

interface OperativeMission {
  id: UUID;
  epoch_id: UUID;
  agent_id: UUID;
  operative_type: OperativeType;
  source_simulation_id: UUID;
  target_simulation_id?: UUID;   // null for guardians
  embassy_id?: UUID;             // null for guardians
  target_entity_id?: UUID;       // building/agent/embassy
  target_entity_type?: string;
  target_zone_id?: UUID;
  status: string;                // deploying/active/success/failed/detected/captured
  cost_rp: number;
  success_probability?: number;
  deployed_at: string;
  resolves_at: string;
  mission_result?: Record<string, unknown>;
}

interface LeaderboardEntry {
  rank: number;
  simulation_id: UUID;
  simulation_name: string;
  team_name?: string;
  stability: number;
  influence: number;
  sovereignty: number;
  diplomatic: number;
  military: number;
  composite: number;
}
```

---

## Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| Database tables (migration 032) | Applied locally | NOT pushed to production |
| Materialized views (migration 031) | Applied locally | NOT pushed to production |
| Epoch chat table (migration 037) | Applied locally | NOT pushed to production |
| Backend routers (4) | Complete | epochs, operatives, scores, epoch_chat |
| Backend services (6) | Complete | epoch, operative, scoring, battle_log, game_mechanics, epoch_chat |
| Frontend components (8) | Complete | Command center, wizard, deploy modal, leaderboard, battle log, chat panel, presence indicator, ready panel |
| Frontend API services (2) | Complete | EpochsApiService (27 methods), EpochChatApiService (4 methods) |
| RealtimeService | Complete | Singleton managing 4 channel types with Preact Signals |
| TypeScript types | Complete | 14 interfaces + 4 union types |
| i18n (EN + DE) | Complete | 1666 total strings |
| Public API endpoints (8) | Complete | Spectator access to leaderboard, battle log, epoch info |
| Production deployment | Pending | Migrations not pushed, code not deployed |

---

## Epoch Realtime Chat & Coordination (Migration 037)

Epoch participants need real-time communication channels for diplomacy, coordination, and tactical planning. Migration 037 adds an in-game chat system built on Supabase Realtime Broadcast, with separate channels for public epoch-wide diplomacy and private team-only encrypted communications.

### Database Schema

**`epoch_chat_messages` table:**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, default gen_random_uuid() | Message identifier |
| `epoch_id` | UUID | FK game_epochs, NOT NULL | Parent epoch |
| `sender_id` | UUID | FK auth.users, NOT NULL | Message author |
| `sender_simulation_id` | UUID | FK simulations, NOT NULL | Sender's simulation (for display context) |
| `channel_type` | TEXT | NOT NULL, CHECK ('epoch' or 'team') | Channel scope |
| `team_id` | UUID | FK epoch_teams, NULLABLE | Team channel target (NULL for epoch-wide) |
| `content` | TEXT | NOT NULL, 1-2000 chars | Message body |
| `created_at` | TIMESTAMPTZ | default now() | Timestamp |

**Column addition to `epoch_participants`:**

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `cycle_ready` | BOOLEAN | false | Whether participant has signaled ready for next cycle |

**Indexes:**

| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_epoch_chat_epoch_created` | (epoch_id, created_at) | Cursor-based pagination for epoch-wide messages |
| `idx_epoch_chat_team_created` | (team_id, created_at) | Cursor-based pagination for team messages |

### RLS Policies (4)

| Policy | Operation | Rule |
|--------|-----------|------|
| `epoch_chat_select` | SELECT | Authenticated users can read all epoch-wide messages (`channel_type = 'epoch'`) |
| `epoch_chat_team_select` | SELECT | Team members can read their own team messages (matched via `epoch_participants.team_id`) |
| `epoch_chat_insert` | INSERT | Authenticated users can insert with `sender_id = auth.uid()` |
| `epoch_chat_anon_select` | SELECT | Anon users can read epoch-wide messages (spectator access) |

### Broadcast Triggers (2)

**`broadcast_epoch_chat`** — On INSERT to `epoch_chat_messages`:
- Sends via Supabase Realtime Broadcast to topic `epoch:{epoch_id}:chat` for epoch-wide messages
- Sends to `epoch:{epoch_id}:team:{team_id}:chat` for team messages
- Payload includes sender_id, sender_simulation_id, channel_type, content, created_at

**`broadcast_ready_signal`** — On UPDATE of `cycle_ready` in `epoch_participants`:
- Broadcasts to `epoch:{epoch_id}:status` topic
- Payload includes simulation_id, cycle_ready state
- Enables live ready-state tracking without polling

### Realtime Architecture (4 Channel Types)

All channels use Supabase Realtime with `config: { private: true }` for authenticated access.

| Channel Pattern | Type | Purpose |
|----------------|------|---------|
| `epoch:{id}:chat` | Broadcast | Epoch-wide messages — public diplomacy, announcements, taunts |
| `epoch:{id}:presence` | Presence | Online user tracking via Supabase Presence API — who's watching |
| `epoch:{id}:status` | Broadcast | Ready signals, cycle advancement events, phase transitions |
| `epoch:{id}:team:{tid}:chat` | Broadcast | Team-only messages — alliance coordination, secret planning |

### API Endpoints (4)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/epochs/{epoch_id}/chat` | authenticated | Send message (epoch-wide or team channel) |
| GET | `/api/v1/epochs/{epoch_id}/chat` | optional | List epoch-wide messages (cursor-based pagination) |
| GET | `/api/v1/epochs/{epoch_id}/chat/team/{team_id}` | team member | List team messages (cursor-based pagination) |
| PATCH | `/api/v1/epochs/{epoch_id}/participants/{simulation_id}/ready` | participant | Toggle cycle_ready state |

### Frontend Components

**3 new components + 1 modified:**

| Component | File | Purpose |
|-----------|------|---------|
| **EpochChatPanel** | `components/epoch/EpochChatPanel.ts` | Dual-channel chat interface with ALL CHANNELS / TEAM FREQ tabs. REST-based message catch-up on mount + Supabase Realtime Broadcast for live incoming messages. Directional message styling (own messages right-aligned, others left-aligned). Simulation name + theme color per sender. |
| **EpochPresenceIndicator** | `components/epoch/EpochPresenceIndicator.ts` | Online user dot indicator per simulation. Subscribes to Presence channel. Green dot = online, dim = offline. Shown in leaderboard and chat sender labels. |
| **EpochReadyPanel** | `components/epoch/EpochReadyPanel.ts` | Cycle ready toggle with live broadcast status display. Shows all participants' ready states in real time. Visual progress bar toward full readiness. |
| **EpochOpsBoard** | `components/epoch/EpochOpsBoard.ts` | Extracted from EpochCommandCenter: dossier cards + collapsible COMMS sidebar. Shows EpochChatPanel for user's active epoch participation. |

### RealtimeService (Platform Service)

Singleton service at `services/realtime/RealtimeService.ts` managing all Supabase Realtime channel subscriptions.

**Preact Signals:**

| Signal | Type | Purpose |
|--------|------|---------|
| `onlineUsers` | `Signal<Map<string, PresenceState>>` | Online presence per epoch |
| `epochMessages` | `Signal<ChatMessage[]>` | Epoch-wide message buffer |
| `teamMessages` | `Signal<ChatMessage[]>` | Team message buffer |
| `readyStates` | `Signal<Map<string, boolean>>` | Cycle ready state per simulation |
| `unreadEpochCount` | `Signal<number>` | Unread epoch message count |
| `unreadTeamCount` | `Signal<number>` | Unread team message count |

**Channel Lifecycle:**

| Method | Action |
|--------|--------|
| `joinEpoch(epochId)` | Subscribe to chat, presence, and status channels |
| `leaveEpoch()` | Unsubscribe all epoch channels, clear signals |
| `joinTeam(epochId, teamId)` | Subscribe to team chat channel |
| `leaveTeam()` | Unsubscribe team channel, clear team signals |

Unread badge counting uses focus tracking — messages received while the chat panel is not visible increment the unread counter. Focusing the panel resets it to zero.

### Operations Board COMMS Panel

The EpochOpsBoard (extracted from EpochCommandCenter) provides a collapsible COMMS sidebar for in-context communication during tactical operations.

**Layout:**
- Desktop: two-column grid — operative cards on the left, chat panel (360px fixed width) on the right
- Mobile: stacked layout — chat panel below operative cards
- Collapsible via amber glow toggle button with signal strength indicator icon

**Behavior:**
- Auto-discovers user's active epoch participation on mount
- If user is a participant in an active epoch, COMMS panel is available
- Empty state message when user has no active epoch participation
- Signal strength indicator reflects WebSocket connection health (connected / reconnecting / disconnected)

---

## Related Documents

| Document | Relationship |
|----------|-------------|
| `22_GAME_SYSTEMS.md` | Full game design spec — all 8 systems with formulas, cross-system interactions |
| `20_RELATIONSHIPS_ECHOES_MAP.md` | Agent relationships + event echoes (Bleed mechanic) — feeds into scoring |
| `21_EMBASSIES.md` | Embassy architecture — required channel for operative deployment |
| `concept.md` | Multiverse lore — Cartographers, the Bleed, the Convergence |
| `GAME_DESIGN_DOCUMENT.md` | Comprehensive game design document for external game designers |
