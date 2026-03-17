---
title: "Epochs & Competitive Layer"
id: epochs-competitive-layer
version: "2.2"
date: 2026-03-17
lang: de
type: spec
status: active
tags: [epochs, competitive, pvp, operatives, scoring]
---

# 22 - Epochs & Competitive Layer

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

**14 tables** (migrations 032 + 037 + 041 + 044 + 047 + 048 + 050):

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `game_epochs` | Epoch definitions + lifecycle | `name`, `status` (lobby→foundation→competition→reckoning→completed), `config` (JSONB), `current_cycle` |
| `epoch_participants` | Simulation enrollment per epoch | `epoch_id`, `simulation_id`, `user_id`, `team_id`, `current_rp`, `final_scores`, `is_bot`, `bot_player_id`, `drafted_agent_ids`, `draft_completed_at` |
| `zone_fortifications` | Hidden zone defensive fortifications (Foundation phase) | `epoch_id`, `zone_id`, `source_simulation_id`, `security_bonus`, `expires_at_cycle`, UNIQUE(epoch_id, zone_id) |
| `agent_aptitudes` | Per-agent operative-type skill scores | `agent_id`, `simulation_id`, `operative_type`, `aptitude_level` (3-9), UNIQUE(agent_id, operative_type) |
| `epoch_teams` | Alliance definitions | `name`, `epoch_id`, `created_by_simulation_id`, `dissolved_at`, `dissolved_reason`, `tension` |
| `epoch_alliance_proposals` | Allianz-Beitrittsanträge | `epoch_id`, `proposer_simulation_id`, `target_team_id`, `status` (pending/accepted/rejected/expired), `expires_at_cycle` |
| `epoch_alliance_votes` | Abstimmungen über Allianz-Anträge | `proposal_id`, `voter_simulation_id`, `vote` (accept/reject), `voted_at` |
| `operative_missions` | Deployed operatives + results | `agent_id`, `operative_type`, `source_simulation_id`, `target_simulation_id`, `embassy_id`, `status`, `success_probability`, `mission_result` |
| `epoch_scores` | Score snapshots per cycle | `cycle_number`, 5 dimension scores + composite, unique per (epoch, simulation, cycle) |
| `battle_log` | Narrative event feed | `event_type`, `narrative`, `is_public`, `metadata` |
| `epoch_chat_messages` | Realtime chat messages (epoch-wide + team) | `epoch_id`, `sender_id`, `sender_simulation_id`, `channel_type`, `team_id`, `content`, `sender_type` |
| `bot_players` | Reusable bot preset definitions | `name`, `personality`, `difficulty`, `config` (JSONB), `created_by_id` |
| `bot_decision_log` | Audit trail of bot decisions per cycle | `epoch_id`, `participant_id`, `cycle_number`, `phase`, `decision` (JSONB) |
| `notification_preferences` | Per-user email notification settings | `user_id` (UNIQUE), `cycle_resolved`, `phase_changed`, `epoch_completed`, `email_locale` |

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
| **Epoch Router** | `routers/epochs.py` (~280 lines) | CRUD epochs, join/leave (open — no membership required), team management, lifecycle transitions, draft agents, add/remove bots. Auth: `require_epoch_participant()` on team/draft endpoints |
| **Aptitudes Router** | `routers/aptitudes.py` (~70 lines) | Get/set agent aptitude scores (simulation-scoped, editor+ for writes) |
| **Operatives Router** | `routers/operatives.py` (~200 lines) | Deploy, recall, list missions, counter-intelligence, fortify-zone. Auth: `require_epoch_participant()` on all write endpoints |
| **Scores Router** | `routers/scores.py` (79 lines) | Leaderboard, score history, final standings |
| **Game Mechanics Router** | `routers/game_mechanics.py` (171 lines) | Simulation health, building readiness, zone stability |
| **Bot Players Router** | `routers/bot_players.py` (~120 lines) | CRUD bot presets (user-scoped) |
| **Epoch Service** | `services/epoch_service.py` (172 lines) | CRUD: list, get, create, update epochs |
| **Epoch Lifecycle Service** | `services/epoch_lifecycle_service.py` (243 lines) | Lifecycle transitions: start, advance_phase, cancel. Admin client via DI |
| **Epoch Participation Service** | `services/epoch_participation_service.py` (447 lines) | Join, leave, bots, drafting, teams, RP allocation |
| **Cycle Resolution Service** | `services/cycle_resolution_service.py` (389 lines) | Full cycle resolution: resolve_cycle(), bot execution, scoring |
| **Aptitude Service** | `services/aptitude_service.py` (~115 lines) | Get/set agent aptitudes, query single aptitude for operative deployment |
| **Operative Service** | `services/operative_service.py` (142 lines) | Operative CRUD: list, get, recall |
| **Operative Mission Service** | `services/operative_mission_service.py` (1089 lines) | Deploy, resolve missions, success probability, 6 operative effects, zone fortification |
| **Constants** | `services/constants.py` (111 lines) | Shared constants: RP costs, security levels, mission scores, operative metadata (colors, cycles, targets) |
| **Scoring Service** | `services/scoring_service.py` (389 lines) | 5-dimension scoring, normalization, composite weighting |
| **Battle Log Service** | `services/battle_log_service.py` (259 lines) | Record + query competitive event narratives |
| **Game Mechanics Service** | `services/game_mechanics_service.py` (310 lines) | Read materialized views, compute live simulation metrics |
| **Bot Service** | `services/bot_service.py` (~500 lines) | Bot cycle orchestrator — executes all bot decisions during resolve_cycle() |
| **Bot Game State** | `services/bot_game_state.py` (~200 lines) | Fog-of-war compliant game state builder for bot decision-making |
| **Bot Personality** | `services/bot_personality.py` (~600 lines) | Abstract base + 5 personality implementations (Sentinel/Warlord/Diplomat/Strategist/Chaos) |
| **Bot Chat Service** | `services/bot_chat_service.py` (~250 lines) | Dual-mode chat generation (template-based + LLM via OpenRouter) |
| **Cycle Notification Service** | `services/cycle_notification_service.py` (~740 lines) | Recipient resolution, fog-of-war player briefings (enriched: threats, spy intel from metadata, missions, alliance, rank gap, next cycle preview), email dispatch via SMTP |

### Frontend

| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| **EpochCommandCenter** | `components/epoch/EpochCommandCenter.ts` | ~1960 | Orchestrator — fetches state, delegates to subcomponents, handles mutations, wires BotConfigPanel |
| **EpochOpsBoard** | `components/epoch/EpochOpsBoard.ts` | 1065 | Operations board: dossier cards + COMMS sidebar (collapsible chat panel) |
| **EpochOverviewTab** | `components/epoch/EpochOverviewTab.ts` | ~550 | Overview + mission cards + fortify zone section + defensive fortifications manifest, passes participants to leaderboard/battle log |
| **EpochIntelDossierTab** | `components/epoch/EpochIntelDossierTab.ts` | ~350 | Per-opponent intel cards from spy battle log (zone security, guardians, fortifications, staleness indicator) |
| **MissionCard** | `components/epoch/MissionCard.ts` | ~120 | Reusable operative mission card with status badges and operative-type icons |
| **EpochOperationsTab** | `components/epoch/EpochOperationsTab.ts` | 355 | Operations tab, dispatches recall events |
| **EpochAlliancesTab** | `components/epoch/EpochAlliancesTab.ts` | 400 | Alliances tab, dispatches create/join/leave-team events |
| **EpochLobbyActions** | `components/epoch/EpochLobbyActions.ts` | ~520 | Lobby actions + admin controls + sim picker with faction cards + deployed state + dismiss button, dispatches epoch lifecycle events |
| **BotConfigPanel** | `components/epoch/BotConfigPanel.ts` | ~900 | VelgSidePanel slide-out: bot preset CRUD, personality card grid with radar charts, difficulty toggle, deploy to epoch |
| **DraftRosterPanel** | `components/epoch/DraftRosterPanel.ts` | ~738 | Full-screen agent draft overlay — two-column layout (available roster + deployment lineup), aptitude bars, team stats |
| **EpochCreationWizard** | `components/epoch/EpochCreationWizard.ts` | 1245 | 3-step epoch setup (Parameters/Economy/Doctrine) + max_agents_per_player slider |
| **DeployOperativeModal** | `components/epoch/DeployOperativeModal.ts` | 1502 | 3-step operative deployment with aptitude fit indicator + sorted agent dropdown |
| **EpochLeaderboard** | `components/epoch/EpochLeaderboard.ts` | ~520 | Sortable score table with per-dimension bars + bot personality indicators |
| **EpochBattleLog** | `components/epoch/EpochBattleLog.ts` | ~350 | Narrative event feed with filtering + bot [BOT] prefix tags |
| **VelgAptitudeBars** | `components/shared/VelgAptitudeBars.ts` | ~329 | Shared component: 6-bar operative aptitude display (3 sizes: sm/md/lg), editable mode with range sliders + budget tracking, highlight mode for operative type focus |
| **EpochsApiService** | `services/api/EpochsApiService.ts` | ~220 | 28 API methods for epochs + operatives + scores + draft + fortify |
| **AgentsApiService** | `services/api/AgentsApiService.ts` | ~63 | Extended with `getAptitudes()`, `setAptitudes()`, `getAllAptitudes()` methods |
| **BotApiService** | `services/api/BotApiService.ts` | ~60 | CRUD for bot presets + add/remove bot from epoch |

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

**Agent Aptitudes:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/simulations/{sim_id}/aptitudes` | viewer | Get all aptitude scores for all agents in a simulation |
| GET | `/simulations/{sim_id}/agents/{agent_id}/aptitudes` | viewer | Get aptitude scores for a specific agent |
| PUT | `/simulations/{sim_id}/agents/{agent_id}/aptitudes` | editor | Set all 6 aptitude scores (budget must equal 36) |

**Draft:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/epochs/{id}/participants/{sim_id}/draft` | owner | Lock in a draft roster (lobby phase only) |

**Participants & Teams:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/epochs/{id}/participants` | optional | List participants |
| POST | `/epochs/{id}/participants` | authenticated | Join epoch with any template simulation (no membership required) |
| DELETE | `/epochs/{id}/participants/{sim}` | participant | Leave epoch |
| GET | `/epochs/{id}/teams` | optional | List teams |
| POST | `/epochs/{id}/teams` | owner | Create team |
| POST | `/epochs/{id}/teams/{tid}/join` | owner | Join team |
| POST | `/epochs/{id}/teams/leave` | owner | Leave team |
| GET | `/epochs/{id}/proposals` | participant | Allianz-Proposals auflisten |
| POST | `/epochs/{id}/proposals` | participant | Allianz-Proposal erstellen (body: `{team_id}`) |
| POST | `/epochs/{id}/proposals/{pid}/vote` | participant | Über Proposal abstimmen (body: `{vote: "accept"\|"reject"}`) |

**Operatives:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/epochs/{id}/operatives` | participant | List your missions |
| GET | `/epochs/{id}/operatives/{mid}` | participant | Get mission detail |
| POST | `/epochs/{id}/operatives` | participant | Deploy operative |
| POST | `/epochs/{id}/operatives/{mid}/recall` | participant | Recall operative |
| GET | `/epochs/{id}/operatives/threats` | participant | List detected threats |
| POST | `/epochs/{id}/operatives/fortify-zone` | participant | Fortify own zone (2 RP, Foundation only) |
| POST | `/epochs/{id}/operatives/counter-intel` | participant | Counter-intelligence sweep (4 RP) |

**Scores & Battle Log:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/epochs/{id}/scores/leaderboard` | optional | Current leaderboard |
| GET | `/epochs/{id}/scores/standings` | optional | Final standings |
| GET | `/epochs/{id}/scores/simulations/{sid}` | owner | Score history |
| GET | `/epochs/{id}/battle-log` | optional | Battle log entries |

**Bot Players:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/bot-players` | authenticated | List user's bot presets |
| POST | `/bot-players` | authenticated | Create bot preset |
| PATCH | `/bot-players/{id}` | owner | Update bot preset |
| DELETE | `/bot-players/{id}` | owner | Delete bot preset |
| POST | `/epochs/{id}/add-bot` | creator | Add bot participant to epoch (lobby phase only) |
| DELETE | `/epochs/{id}/remove-bot/{pid}` | creator | Remove bot participant from epoch |

**Public (no auth):**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/public/simulations/{sim_id}/aptitudes` | All aptitude scores for a simulation |
| GET | `/public/simulations/{sim_id}/agents/{agent_id}/aptitudes` | Agent aptitude scores |
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

1. **Lobby** — Epoch created, simulations join, teams form, players draft their agent roster. No game mechanics active.
2. **Foundation ("Nebelkrieg")** — +50% RP income. Build infrastructure, staff buildings, establish embassies. Spies and guardians allowed (Migration 048: was guardian-only). Zone fortification available (2 RP, +1 security tier, lasts 5 competition cycles). No offensive operatives (saboteur, propagandist, assassin, infiltrator).
3. **Competition** — Full mechanics. All 6 operative types available. Allianz-Beitritt nur via Proposal (einstimmige Abstimmung). Scores snapshot each cycle.
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
| Fortify Zone | 2 RP |
| Counter-intelligence sweep | 4 RP |

### Operative Types

| Type | Cost | Deploy Time | Duration | Effect |
|------|------|-------------|----------|--------|
| **Spy** | 3 RP | Instant | 3 cycles | Reveals target zone security levels and guardian count (intel report in battle log). +2 Influence, +1 Diplomatic, −2 Sovereignty. |
| **Saboteur** | 5 RP | 1 cycle | Single action | Downgrades random zone security −1 tier + building condition −1. Generates crisis event (impact 3, diminishing: 3→2→1, skip at 3+). −6 Stability, −8 Sovereignty. |
| **Propagandist** | 4 RP | 1 cycle | 2 cycles | Generates a destabilizing event (impact 6-8) in target zone |
| **Assassin** | 7 RP | 2 cycles | Single action | Wounds target agent — reduces relationships by 2, removes ambassador status for 3 cycles |
| **Guardian** | 4 RP | Instant | Permanent | −6% enemy success per guardian (max −15%). Deploys to OWN simulation only. |
| **Infiltrator** | 5 RP | 2 cycles | 3 cycles | Reduces target embassy effectiveness by 65%. +3 Influence per success. |

### Success Probability

```
base_probability = 0.55
+ agent_aptitude × 0.03                    (3-9 scale → +0.09 to +0.27)
- target_zone_security × 0.05             (mapped 0-10 → -0 to -0.50)
- min(0.15, guardian_presence × 0.06)     (−0.06 each, cap 0.15)
+ embassy_effectiveness × 0.15            (0-1 → +0 to +0.15)
+ resonance_zone_pressure                 (+0.00 to +0.04)
+ resonance_operative_modifier            (-0.04 to +0.04)
+ attacker_pressure_penalty               (-0.04 to 0.00)

Final: clamped to [0.05, 0.95]
```

**Resonance terms (3 new):** When substrate resonances are active, three additional modifiers apply. `resonance_zone_pressure` adds up to +0.04 based on event pressure in the target zone (via `fn_target_zone_pressure`). `resonance_operative_modifier` adjusts -0.04 to +0.04 based on archetype-operative affinities — aligned operatives gain effectiveness while opposed operatives lose it, with subsiding resonances contributing at 0.5x strength (via `fn_resonance_operative_modifier`). `attacker_pressure_penalty` subtracts up to -0.04 based on the attacker's own average zone instability, compensating the defender bonus (via `fn_attacker_pressure_penalty`). See [Substrate Resonances](substrate-resonances.md) for archetype-operative affinity tables and full function documentation.

**Aptitude impact examples:**
- Aptitude 3 (minimum): +0.09
- Aptitude 6 (default): +0.18
- Aptitude 9 (maximum): +0.27

This gives an 18 percentage-point swing range between the weakest and strongest agent for any given operative type, compared to the previous 50pp range from qualification (0-10 x 0.05). The narrower range means agent selection matters but doesn't dominate — zone security and guardian presence remain significant factors.

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

**Postgres Push-Down (Migration 127):** Die gesamte Scoring-Berechnung wurde in `fn_compute_cycle_scores(p_epoch_id, p_cycle_number, p_score_weights)` verlagert — ein einziger SECURITY DEFINER SQL-Call mit CTE-Kette (zone_stab → propaganda → missions → echoes → embassies → teams → guardians → raw_scores → normalization → composite). Ersetzt 12 per-Simulation Python-Queries.

**Team scoring** = sum of member scores + 5% alliance bonus per active member.

**Leaderboard Enrichment:** LeaderboardEntry enthaelt zusaetzlich `ally_count` (Anzahl aktiver Alliierter), `ally_bonus_pct` (Allianz-Bonus in %), `betrayal_penalty` (aktive Verrats-Strafe auf Diplomatic Score).

**Intel Dossier Endpoint:** `GET /api/v1/epochs/{epoch_id}/scores/intel-dossiers?simulation_id={sim_id}` — vorab-aggregierte Intel Dossiers mit `is_stale` Flag (true wenn letzter Intel aelter als 2 Zyklen). Ersetzt client-seitige Berechnung aus Battle-Log-Rohdaten.

### Alliances & Betrayal

- Teams form during lobby/foundation. Max team size configurable (default 3).
- If `allow_betrayal = true`: allied simulations can covertly attack each other.
  - **Detected betrayal** → alliance immediately dissolves, betrayer gets -25% Diplomatic Score.
  - **Undetected betrayal** → normal operative effects, alliance intact.

#### Allianz-Beitritt: Proposal-Workflow

Der Beitritt zu einer Allianz folgt einem phasenabhängigen Workflow:

**Phase Guard:**

| Phase | Beitrittsmodus | Beschreibung |
|-------|---------------|-------------|
| **Lobby / Foundation** | Sofortiger Beitritt | Spieler tritt direkt bei, keine Abstimmung erforderlich |
| **Competition / Reckoning** | Proposal-basiert | Einstimmige Abstimmung aller bestehenden Mitglieder erforderlich |

**Proposal-Ablauf (Competition / Reckoning):**

```
Antragsteller erstellt Proposal → bestehende Mitglieder stimmen ab → Ergebnis
```

1. **Proposal erstellen** — Spieler stellt Antrag auf Beitritt zu einem Team. Ein Proposal-Eintrag wird in `epoch_alliance_proposals` erstellt (Status: `pending`). Verfallsfrist: aktueller Zyklus + 2.
2. **Abstimmung** — Jedes bestehende Teammitglied gibt eine Stimme ab (`accept` oder `reject`). Stimmen werden in `epoch_alliance_votes` gespeichert.
3. **Ergebnis:**
   - **Einstimmig angenommen** — Alle Mitglieder stimmen `accept` → Antragsteller tritt dem Team bei, Status wird `accepted`. Battle-Log-Event: `alliance_proposal_accepted`.
   - **Abgelehnt** — Ein einziges `reject` genügt → Proposal sofort abgelehnt, Status wird `rejected`. Battle-Log-Event: `alliance_proposal_rejected`.
   - **Verfallen** — Keine vollständige Abstimmung innerhalb von 2 Zyklen → Status wird `expired`.

**Solo-Team Auto-Accept:** Wenn das Zielteam nur 1 Mitglied hat, wird die Abstimmung übersprungen — der Antrag wird automatisch angenommen (das einzige Mitglied gilt als implizit einverstanden).

#### Shared Intelligence (RLS-basiert)

Alliierte teilen Aufklärungsdaten über eine erweiterte RLS SELECT-Policy auf `battle_log`:

- Alliierte Simulationen sehen gegenseitig ihre `battle_log`-Einträge, die normalerweise nur für den Eigentümer sichtbar wären (z.B. Spion-Intel, Operative-Ergebnisse).
- Die erweiterte SELECT-Policy prüft: `source_simulation_id` gehört demselben Team (JOIN über `epoch_participants.team_id`).
- **Kennzeichnung zur Lesezeit:** Alliierter Intel wird bei Abfrage mit `allied_intel: true` im Metadata-Feld getaggt. Dies geschieht auf Leseebene — die gespeicherten `battle_log`-Einträge bleiben unverändert.
- Bei Allianz-Auflösung entfällt der Intel-Zugriff sofort (RLS prüft aktiven Team-Status).

#### Upkeep & Tension

**Upkeep (Unterhaltskosten):**

- Pro Zyklus werden jedem Team **1 RP pro Mitglied** von den RP aller Mitglieder abgezogen.
- Berechnung: `current_rp = MAX(0, current_rp - 1)` pro Teilnehmer im Team.
- Floor bei 0 — ein Teilnehmer kann nicht in negative RP fallen.
- Battle-Log-Event: `alliance_upkeep` (pro Team, mit Gesamtkosten im Metadata).

**Tension (Spannung):**

Allianzen akkumulieren Spannung bei koordinierten Angriffen:

| Ereignis | Tension-Änderung |
|----------|-----------------|
| Einzigartiges Ziel, angegriffen von 2+ Alliierten im selben Zyklus | +10 pro Ziel |
| Natürlicher Abbau pro Zyklus | −5 |
| Clamping | 0–100 |

- **Auto-Auflösung:** Bei `tension >= 80` wird die Allianz automatisch aufgelöst (`dissolved_reason = 'tension'`). Battle-Log-Event: `alliance_dissolved_tension`.
- **Tension-Anstieg:** Battle-Log-Event: `alliance_tension_increase` (mit aktuellem Tension-Wert und auslösenden Zielen im Metadata).

### Embassy Requirement

Embassies are the **only channel** for deploying operatives. You cannot attack a simulation without an active embassy connection.

**Strategic implications:**
- Embassies enable both diplomacy (scoring) AND warfare (operatives)
- Dissolving an embassy immediately recalls all your operatives through that channel
- An enemy can dissolve their embassy to cut off your operative pipeline
- But dissolving also kills your own offensive capability and diplomatic score

### Battle Log Event-Typen (Allianz)

Die folgenden Event-Typen wurden für das Allianz-System hinzugefügt:

| Event-Typ | Beschreibung | Sichtbarkeit |
|-----------|-------------|-------------|
| `alliance_proposal` | Allianz-Beitrittsantrag erstellt | Team-intern |
| `alliance_proposal_accepted` | Proposal einstimmig angenommen, Spieler tritt bei | Team-intern + öffentlich |
| `alliance_proposal_rejected` | Proposal abgelehnt (mindestens eine Reject-Stimme) | Team-intern |
| `alliance_tension_increase` | Tension-Anstieg durch koordinierte Angriffe | Team-intern |
| `alliance_dissolved_tension` | Allianz automatisch aufgelöst bei Tension ≥ 80 | Öffentlich |
| `alliance_upkeep` | RP-Abzug für Allianz-Unterhaltskosten | Team-intern |

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

1. **Asset** — Select agent from your simulation. Agent dropdown sorted by aptitude for the selected operative type (descending). Dossier card shows portrait, professions, character excerpt, aptitude bars (sm, highlighted for selected type), and fit indicator badge (Good/Fair/Poor). Warning about leaving building post.
2. **Mission** — Choose operative type (6 cards with cost/duration/effect). Select embassy route. Guardian special case (deploys to own simulation, no embassy needed).
3. **Target** — Select target zone/building/agent based on mission type. SVG targeting ring shows success probability with factor breakdown (aptitude replaces qualification). Confirmation summary with RP cost.

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
  max_agents_per_player: number;  // 4-8, default 6
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
  // Dimension titles (awarded when highest in a dimension)
  stability_title?: string;
  influence_title?: string;
  sovereignty_title?: string;
  diplomatic_title?: string;
  military_title?: string;
  betrayal_penalty?: number;
}

type BotPersonality = 'sentinel' | 'warlord' | 'diplomat' | 'strategist' | 'chaos';
type BotDifficulty = 'easy' | 'medium' | 'hard';

interface BotPlayer {
  id: UUID;
  name: string;
  personality: BotPersonality;
  difficulty: BotDifficulty;
  config: Record<string, unknown>;
  created_by_id: UUID;
  created_at: string;
  updated_at: string;
}

interface AgentAptitude {
  id: UUID;
  agent_id: UUID;
  simulation_id: UUID;
  operative_type: OperativeType;
  aptitude_level: number;     // 3-9
  created_at: string;
  updated_at: string;
}

type AptitudeSet = Record<OperativeType, number>;  // { spy: 6, guardian: 6, ... }

interface EpochParticipant {
  id: UUID;
  epoch_id: UUID;
  simulation_id: UUID;
  user_id?: UUID;              // Direct user reference (Migration 049). NULL for bots.
  team_id?: UUID;
  joined_at: string;
  current_rp: number;
  drafted_agent_ids?: UUID[];
  draft_completed_at?: string;
  is_bot: boolean;
  bot_player_id?: UUID;
  bot_players?: BotPlayer;  // Joined via PostgREST select
  cycle_ready: boolean;
}

interface ZoneFortification {
  id: UUID;
  epoch_id: UUID;
  zone_id: UUID;
  source_simulation_id: UUID;
  security_bonus: number;      // Default 1 (one security tier)
  expires_at_cycle: number;    // Cycle number when fortification expires
  created_at: string;
}
```

---

## Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| Database tables (migration 032) | Applied locally | NOT pushed to production |
| Materialized views (migration 031) | Applied locally | NOT pushed to production |
| Epoch chat table (migration 037) | Applied locally | NOT pushed to production |
| Bot players tables (migration 041) | Applied locally | NOT pushed to production |
| Agent aptitudes + draft (migration 047) | Applied locally | `agent_aptitudes` table + `drafted_agent_ids`/`draft_completed_at` on epoch_participants + clone function update + 35 agent seed profiles |
| Foundation redesign (migration 048) | Applied locally | `zone_fortifications` table, `zone_fortified` battle log event type, spy in foundation phase |
| Open epoch participation (migration 049) | Applied locally | `user_id` on epoch_participants, RLS rewritten to user_id checks, `user_has_simulation_access()` extended, `require_epoch_participant()` dependency |
| Backend routers (6) | Complete | epochs, **aptitudes**, operatives, scores, epoch_chat, bot_players. Auth: `require_epoch_participant()` on competitive write endpoints |
| Backend services (12) | Complete | epoch, **aptitude**, operative (incl. fortify_zone), scoring, battle_log, game_mechanics, epoch_chat, bot_service, bot_game_state, bot_personality, bot_chat_service, cycle_notification |
| Frontend components (14) | Complete | Command center, wizard, deploy modal, leaderboard, battle log, chat panel, presence indicator, ready panel, invite panel, bot config panel, **draft roster panel**, **aptitude bars**, **intel dossier tab**, **mission card** |
| Frontend API services (3) | Complete | EpochsApiService (28 methods), EpochChatApiService (4 methods), BotApiService (6 methods). AgentsApiService extended with 3 aptitude methods |
| RealtimeService | Complete | Singleton managing 4 channel types with Preact Signals |
| TypeScript types | Complete | 21 interfaces + 6 union types (incl. AgentAptitude, AptitudeSet, BotPlayer, ZoneFortification) |
| i18n (EN + DE) | Complete | ~2300 total strings |
| Public API endpoints (10) | Complete | Spectator access to leaderboard, battle log, epoch info, **aptitudes** |
| AI Settings integration | Complete | `bot_chat_mode` toggle + `model_bot_chat` model selector |
| Production deployment | Pending | Migrations not pushed, code not deployed |

---

## Bot Players (Migration 041)

Bot players are AI-controlled opponents that allow solo or low-player-count epoch gameplay. Users create reusable "bot presets" — configurable AI personalities that can be shuffled into any epoch. Bots execute synchronously during cycle resolution with full game mechanic compliance (same RP economy, operative constraints, success probability calculations as human players).

### Design Principles

1. **No LLM for tactical decisions** — Deterministic/probabilistic engine with personality-based heuristics. Fast (~50ms per bot per cycle), predictable, auditable, zero API costs for decisions.
2. **LLM for optional chat flavor** — Dual-mode: template-based (free, instant, default) or LLM-generated (rich personality-flavored messages via OpenRouter). Configurable per-simulation in AI Settings.
3. **Fog-of-war compliance** — `BotGameState` builds state from the same queries a human player would see. Spy intel only available if the bot actually deployed successful spies.
4. **Zero code duplication** — Bots call `OperativeService.deploy()` and `OperativeService.spend_rp()` directly. Same validation, same constraints, same success probability.
5. **Admin supabase for writes** — Bots are system-level actors. Using admin client bypasses RLS (no fake JWT sessions per bot).
6. **Reusable presets** — Users create bot presets once, deploy them to any epoch. Like building a "deck of opponents."

### Database Schema

**`bot_players` table:**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, default gen_random_uuid() | Bot preset identifier |
| `name` | TEXT | NOT NULL | Display name / callsign |
| `personality` | TEXT | NOT NULL, CHECK IN ('sentinel','warlord','diplomat','strategist','chaos') | AI archetype |
| `difficulty` | TEXT | NOT NULL DEFAULT 'medium', CHECK IN ('easy','medium','hard') | Difficulty level |
| `config` | JSONB | NOT NULL DEFAULT '{}' | Per-personality tuning overrides |
| `created_by_id` | UUID | FK auth.users, NOT NULL | Owner |
| `created_at` | TIMESTAMPTZ | default now() | Created timestamp |
| `updated_at` | TIMESTAMPTZ | default now() | Updated timestamp |

**`bot_decision_log` table:**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, default gen_random_uuid() | Log entry identifier |
| `epoch_id` | UUID | FK game_epochs ON DELETE CASCADE | Parent epoch |
| `participant_id` | UUID | FK epoch_participants ON DELETE CASCADE | Bot participant |
| `cycle_number` | INTEGER | NOT NULL | Cycle when decision was made |
| `phase` | TEXT | NOT NULL | Decision phase ('analysis','allocation','deployment','alliance') |
| `decision` | JSONB | NOT NULL | Full decision payload for audit |
| `created_at` | TIMESTAMPTZ | default now() | Timestamp |

**Columns added to `epoch_participants`:**

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `is_bot` | BOOLEAN | false | Whether this participant is AI-controlled |
| `bot_player_id` | UUID | NULL, FK bot_players | Reference to bot preset |

**Column added to `epoch_chat_messages`:**

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `sender_type` | TEXT | 'human' | Message origin ('human' or 'bot') |

### Personality Archetypes

| Personality | Strategy | RP Allocation | Alliance Behavior | Proposal-Voting | Risk | Accent Color |
|-------------|----------|---------------|-------------------|-----------------|------|-------------|
| **Sentinel** | Defensive | 50% DEF, 25% INT, 25% situational | Seeks early, loyal, never betrays first | Accept all | Low | `#4ade80` (green) |
| **Warlord** | Aggressive | 60% OFF, 20% INT, 20% DEF | Reluctant, betrays when ally threatens | Reject Top-2, 50% weak; leave bei Tension ≥ 50 | High | `#ef4444` (red) |
| **Diplomat** | Diplomatic | 30% DIP, 30% INF, 20% INT, 20% DEF | Active alliance seeker, maintains bonds | Accept all | Medium | `#a78bfa` (purple) |
| **Strategist** | Adaptive | Dynamic — counter-builds opponent strategy | Strategic alliances against leader | Accept weak, reject leader | Medium-High | `#38bdf8` (blue) |
| **Chaos** | Unpredictable | Random weighted each cycle | Forms/breaks randomly (30% betray/cycle) | 60% accept, 40% reject | Variable | `#fbbf24` (amber) |

### Difficulty Scaling

| Parameter | Easy | Medium | Hard |
|-----------|------|--------|------|
| RP waste % | 30% randomly unspent | 10% | 0% |
| Intel usage | Ignores spy reports | Uses detected ops | Full optimal analysis |
| Target quality | Random target | Decent selection | Optimal (vulnerability scoring) |
| Alliance timing | Random | Foundation phase | Optimal based on standings |
| Threat adaptation | None | Reacts to attacks | Proactive counter-strategy |
| Success threshold | Deploys at any % | Skips < 20% | Skips < 35% (cost-effective only) |

### Bot Execution Flow

During `resolve_cycle()`, nach RP-Grant + Mission-Resolution, vor Scoring. Erweiterte Pipeline mit Allianz-Schritten:

```
── RP Grant ──
── Alliance Upkeep (1 RP pro Mitglied abziehen, Floor 0) ──
── Expire stale Proposals (Status → 'expired' wenn current_cycle >= expires_at_cycle) ──
── Mission Resolution ──
── Bot Execution (siehe unten) ──
── Scoring ──
── Tension Computation (+10 pro shared target, −5 Decay, Clamp 0-100, Auto-Dissolve bei ≥80) ──
```

Bot-Execution im Detail:

```
1. Get all bot participants for the epoch
2. For each bot:
   a. Build BotGameState (fog-of-war compliant — same data as human)
   b. Create personality instance (factory pattern)
   c. Execute decision pipeline:
      - allocate_rp(state) → RP distribution per operative type
      - apply_difficulty_waste() → Easy: 30% random waste
      - select_targets(state, allocation) → deployment plans
      - filter_by_success_threshold() → skip low-probability missions
      - manage_alliances(state) → form/maintain/betray decisions
   d. Execute decisions via OperativeService (same as human)
   e. Log decisions to bot_decision_log (audit trail)
   f. Generate 0-2 chat messages (template or LLM)
   g. Set cycle_ready = TRUE
```

### Bot Personality Decision Trees

Each personality implements `_plan_deployments()` and `manage_alliances()` with distinct strategies. Difficulty scaling affects all personalities via `DIFFICULTY_PARAMS`:

| Difficulty | RP Waste | Success Threshold | Uses Intel | Optimal Targeting | Proactive Counter |
|------------|----------|-------------------|------------|-------------------|-------------------|
| Easy | 30% | 0% | No | No | No |
| Medium | 10% | 20% | Yes | No | No |
| Hard | 0% | 35% | Yes | Yes | Yes |

#### Sentinel (Defense-Focused)

- **Strategy:** Protect own world first, attack only when leading
- **Guardian budget:** 50% of RP (60% under resonance pressure)
- **Offensive types:** Spy (primary), then balanced
- **Targeting:** Leader (only when own rank is #1)
- **Fortification:** Fortifies all 4 zones in Foundation phase
- **Alliances:** Seeks alliances early, never betrays unless betrayed first
- **Proposal-Abstimmung:** Akzeptiert alle Proposals (kooperativer Archetypus)
- **Draft priorities:** guardian (3x), spy (2x), saboteur (1x)

#### Warlord (Aggressive)

- **Strategy:** Focus fire on the leader, maximum offensive pressure
- **Guardian budget:** Minimal (1-2 guardians max)
- **Offensive types:** Assassin + saboteur heavy
- **Targeting:** Leader, or weakest if tied for lead
- **Fortification:** None outside Foundation phase
- **Alliances:** Reluctant to ally, betrays threat-level allies
- **Proposal-Abstimmung:** Lehnt Top-2-Platzierte ab, 50% Chance auf Accept bei schwächeren Spielern. Verlässt Allianz bei Tension ≥ 50
- **Draft priorities:** assassin (3x), saboteur (2x), guardian (1x)

#### Diplomat (Alliance Builder)

- **Strategy:** Spread influence, avoid direct confrontation, build coalitions
- **Guardian budget:** 20% of RP
- **Offensive types:** Propagandist + infiltrator (avoids assassins)
- **Targeting:** Spreads operatives across all targets
- **Fortification:** 2 zones in Foundation phase
- **Alliances:** Actively seeks alliances, never betrays
- **Proposal-Abstimmung:** Akzeptiert alle Proposals (maximale Koalitionsbildung)
- **Draft priorities:** propagandist (3x), infiltrator (2x), spy (1x)

#### Strategist (Counter-Strategy)

- **Strategy:** Detect dominant strategy among opponents and counter it
- **Guardian budget:** Variable (responds to threat level)
- **Offensive types:** Heavy spy investment, then reactive
- **Targeting:** Counter-targets based on detected dominant strategy
- **Fortification:** Weakest zones (lowest security), 1-2 randomly
- **Alliances:** Forms strategic alliances with weak players against leader
- **Proposal-Abstimmung:** Akzeptiert schwächere Spieler, lehnt den Führenden ab
- **Resonance integration:** Applies resonance-preferred operative type to selection
- **Draft priorities:** spy (3x), infiltrator (2x), assassin (1x)

#### Chaos (Unpredictable Wildcard)

- **Strategy:** Random weighted decisions, impossible to predict
- **Guardian budget:** Random 0-3 guardians in Foundation
- **Offensive types:** Random 1-4 operatives per cycle
- **Targeting:** Random opponent selection
- **Fortification:** Random 0-2 zones
- **Alliances:** 30% chance to betray, 40% chance to form/join
- **Proposal-Abstimmung:** 60% Accept, 40% Reject (zufällig)
- **Draft priorities:** saboteur (3x), propagandist (2x), assassin (1x)

### Bot Resonance Awareness

When `resonance_bot_awareness_enabled` is true (default), the `BotGameState` tracks active resonances and derives aligned/opposed operative types:

- `is_under_resonance_pressure()`: Returns true when `own_avg_pressure > 0.3`
- `get_resonance_preferred_operative(candidates)`: Returns the most aligned operative type from candidates
- Sentinel increases guardian deployment under resonance pressure (50% → 60%)
- Strategist applies resonance preference to operative selection

### Bot Chat (Dual Mode)

**Template Mode (Default):** Personality-specific template pools with contextual variable substitution. ~150 templates (5 personalities × 8 contexts × 3-5 variants). Zero API cost, ~0ms latency.

Contexts: idle, attacked, winning, losing, ally_joined, ally_betrayed, deployed, phase_change.

**LLM Mode (Optional):** When `bot_chat_mode = 'llm'` in AI Settings, messages generated via OpenRouter using `model_bot_chat` model. Each personality has a ~200-word system prompt defining tone, vocabulary, and worldview. Max 100 tokens per message. Falls back to templates on API failure.

### Frontend: BotConfigPanel

VelgSidePanel slide-out with "Bot Deployment Console meets Collectible Card Deck" aesthetic. Three sections:

1. **YOUR DECK** — Saved presets as compact horizontal cards (personality icon + name + difficulty badge + quick-add/delete buttons). Stagger entrance on panel open.
2. **FORGE NEW UNIT** — Creation form: callsign input, 2×2+1 personality card grid (SVG radar charts showing 5-axis stats, personality accent color borders, stagger reveal), 3-segment difficulty toggle (LOW/MED/HGH with morph transition), expandable tactical profile + behavior matrix (CSS horizontal bar chart).
3. **DEPLOY TO EPOCH** — Simulation dropdown (filtered to available templates) + deploy button.

### Frontend: Bot Indicators in Epoch UI

- **EpochLeaderboard:** Bot entries show personality SVG icon + "BOT" badge + difficulty label next to simulation name, color-coded per personality type.
- **EpochBattleLog:** Bot-originated events prefixed with `[BOT]` tag in personality-specific color.
- **EpochChatPanel:** Bot messages styled with amber-tinted background, italic text, "BOT" badge next to sender name.
- **EpochReadyPanel:** Bot participants show amber "BOT" tag next to name.
- **EpochLobbyActions:** "Add Bots" button (creator-only, lobby phase) opens BotConfigPanel.

### AI Settings Integration

Two new settings in the AI Settings panel (`category: 'ai'`):

| Setting | Key | Type | Default | Description |
|---------|-----|------|---------|-------------|
| Bot Chat Mode | `bot_chat_mode` | dropdown | `template` | Template (free, instant) vs LLM (rich, API cost) |
| Bot Chat Model | `model_bot_chat` | model selector | `deepseek/deepseek-v3.2` | Only visible when mode = LLM |

---

## Agent Aptitude System (Migration 047)

Agent aptitudes define per-agent skill scores for each of the 6 operative types. They replace the generic `qualification_level` (0-10, from `agent_professions`) in the success probability formula, providing fine-grained tactical differentiation between agents. Aptitudes are separate from professions — professions define lore identity, aptitudes define game-mechanical competence.

### Design Principles

1. **Budget-constrained distribution** — Each agent has a fixed budget of 36 points across 6 operative types. Default is 6/6/6/6/6/6 (uniform). Players redistribute to create specialists (e.g., 9/3/7/5/3/9) or generalists. Minimum 3, maximum 9 per type.
2. **Aptitudes ARE the balance lever** — During epoch clone, aptitudes are copied AS-IS (no normalization). This is intentional: a well-configured roster of specialists is a legitimate competitive advantage that rewards preparation.
3. **Separate from professions** — Professions (lore identity) are normalized to qualification_level=5 in game instances. Aptitudes (game mechanics) persist through cloning unchanged.
4. **Backward compatible** — `AptitudeService.get_aptitude_for_operative()` returns default 6 if no aptitude row exists. Agents without configured aptitudes perform identically to the old system.

### Database Schema

**`agent_aptitudes` table:**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, default gen_random_uuid() | Aptitude row identifier |
| `agent_id` | UUID | FK agents ON DELETE CASCADE, NOT NULL | Parent agent |
| `simulation_id` | UUID | FK simulations ON DELETE CASCADE, NOT NULL | Parent simulation (denormalized for RLS) |
| `operative_type` | TEXT | NOT NULL, CHECK IN (spy, guardian, saboteur, propagandist, infiltrator, assassin) | Which operative type this score applies to |
| `aptitude_level` | INT | NOT NULL DEFAULT 6, CHECK >= 3 AND <= 9 | Skill score for this type |
| `created_at` | TIMESTAMPTZ | default now() | Created timestamp |
| `updated_at` | TIMESTAMPTZ | default now() | Updated timestamp (trigger) |

**Constraints:** `UNIQUE (agent_id, operative_type)` — one score per agent per type.

**Indexes:**
- `idx_agent_aptitudes_agent` on (agent_id)
- `idx_agent_aptitudes_simulation` on (simulation_id)

**RLS Policies (5):**

| Policy | Operation | Rule |
|--------|-----------|------|
| `agent_aptitudes_select` | SELECT | Simulation members OR template simulations (public browse) |
| `agent_aptitudes_anon_select` | SELECT (anon) | Template simulations only |
| `agent_aptitudes_insert` | INSERT | Editors+ in the simulation |
| `agent_aptitudes_update` | UPDATE | Editors+ in the simulation |
| `agent_aptitudes_delete` | DELETE | Editors+ in the simulation |

### Backend

**AptitudeService** (`services/aptitude_service.py`, ~115 lines):

| Method | Purpose |
|--------|---------|
| `get_for_agent(supabase, simulation_id, agent_id)` | Get all 6 aptitude rows for one agent |
| `get_all_for_simulation(supabase, simulation_id)` | Get all aptitude rows for all agents in a simulation |
| `set_aptitudes(supabase, simulation_id, agent_id, aptitudes)` | Batch upsert all 6 rows (budget validated by Pydantic model) |
| `get_aptitude_for_operative(supabase, agent_id, operative_type)` | Get single aptitude level (returns 6 if no row exists) |

**Pydantic Models** (`models/aptitude.py`):

| Model | Purpose |
|-------|---------|
| `AptitudeSet` | 6 fields (spy/guardian/saboteur/propagandist/infiltrator/assassin), each 3-9, `@model_validator` enforces sum=36 |
| `AptitudeResponse` | Single aptitude row response (id, agent_id, simulation_id, operative_type, aptitude_level, timestamps) |
| `DraftRequest` | `agent_ids: list[UUID]` with min_length=1, max_length=8 |

**Aptitudes Router** (`routers/aptitudes.py`, ~70 lines):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/simulations/{sim_id}/aptitudes` | viewer | All agents' aptitudes in simulation |
| GET | `/simulations/{sim_id}/agents/{agent_id}/aptitudes` | viewer | One agent's aptitudes |
| PUT | `/simulations/{sim_id}/agents/{agent_id}/aptitudes` | editor | Set all 6 (budget=36 enforced) |

**OperativeService formula update** — `_calculate_success_probability()` now fetches `aptitude_level` via `AptitudeService.get_aptitude_for_operative()` instead of using `qualification_level`. Coefficient changed from 0.05 to 0.03.

### Frontend: VelgAptitudeBars

Shared component (`components/shared/VelgAptitudeBars.ts`, ~329 lines) rendering 6 horizontal bars for operative-type aptitude scores.

**Properties:**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `aptitudes` | `AptitudeSet` | `{spy:6, guardian:6, ...}` | Score object |
| `editable` | `boolean` | `false` | Show range sliders instead of static bars |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Display size variant |
| `highlight` | `OperativeType \| null` | `null` | Dims non-matching bars (used in deploy modal) |
| `budget` | `number` | `36` | Budget for display in editable mode |

**Events:** `aptitude-change` — dispatched on slider input with `{ type, level, aptitudes }` detail.

**Size variants:**

| Size | Bar Height | Label | Value Width | Use Case |
|------|-----------|-------|-------------|----------|
| `sm` | 8px | Hidden | 18px, 8px font | Card thumbnails, draft cards, lineup strip |
| `md` | 14px | 90px | 28px | Default display |
| `lg` | 20px | 110px | 32px | AgentDetailsPanel editor |

**Editable mode:** Range sliders (3-9) with budget clamping — prevents exceeding 36 total. Budget indicator footer shows spent/total with color coding (green=exact, red=over). Slider thumb uses `cursor: grab`/`grabbing`.

**Used in:** AgentDetailsPanel (lg, editable), AgentsView lineup strip (sm, readonly), DraftRosterPanel (sm, readonly), DeployOperativeModal (sm, with highlight).

### Frontend: AgentDetailsPanel Aptitude Section

New collapsible section in `AgentDetailsPanel.ts` showing the `VelgAptitudeBars` in `lg` editable mode.

**Behavior:**
- Loads aptitudes on panel open via `agentsApi.getAptitudes()`
- Converts flat array of `AgentAptitude[]` to `AptitudeSet` object
- Editable for users with `canEdit` permission
- Debounced auto-save (800ms after last slider change) via `_aptitudeSaveTimer`
- Saving state indicator ("Saving..." text below bars)
- Toast notification on save success/failure

### Frontend: AgentsView Lineup Overview Strip

Horizontal scrollable strip at the top of the agents list showing all agents with their aptitude bars in `sm` size. Provides an at-a-glance overview of the roster's aptitude distribution.

**Layout:** Full-width panel with `.lineup__header` title ("Lineup Overview") and `.lineup__scroll` horizontal scroll container. Each `.lineup__card` shows avatar + name + `VelgAptitudeBars` (sm). Staggered entrance animation with `--i` CSS variable. Cards are clickable to open the agent detail panel.

**Data:** Fetches all simulation aptitudes via `agentsApi.getAllAptitudes()` and builds an `_aptitudeMap: Map<string, AptitudeSet>`. Only renders when aptitude data is available (`_aptitudeMap.size > 0`).

---

## Draft Phase (Migration 047)

The draft phase occurs during lobby, after a player joins an epoch. Players select which agents from their template simulation to bring into the match. This introduces roster strategy — players must choose their lineup based on the epoch's scoring weights and their opponents' likely strategies.

### Database Schema

**Columns added to `epoch_participants`:**

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `drafted_agent_ids` | UUID[] | NULL | Ordered list of selected agent IDs from template simulation |
| `draft_completed_at` | TIMESTAMPTZ | NULL | When the draft was locked in (NULL = not yet drafted) |

**`max_agents_per_player` in `EpochConfig` (JSONB):**

| Key | Type | Range | Default | Description |
|-----|------|-------|---------|-------------|
| `max_agents_per_player` | integer | 4-8 | 6 | Maximum agents each player can bring into the match |

### Backend

**`EpochService.draft_agents()`** — Validates epoch is in lobby phase, participant belongs to the epoch, agent IDs belong to the participant's template simulation (active, not deleted), count does not exceed `max_agents_per_player`. Updates the participant row with `drafted_agent_ids` and `draft_completed_at`.

**Auto-complete on epoch start** — When `start_epoch()` is called, any participant without `drafted_agent_ids` gets auto-filled with the first N agents (by `created_at`) from their template simulation. This ensures backward compatibility and prevents blocking the epoch if a player forgets to draft.

**Bot auto-draft** — When a bot participant is added to an epoch, `auto_draft()` from `bot_personality.py` selects agents based on personality archetype priorities:

| Personality | Priority Types (3x, 2x, 1x weight) |
|-------------|--------------------------------------|
| Sentinel | guardian, spy, saboteur |
| Warlord | assassin, saboteur, infiltrator |
| Diplomat | propagandist, infiltrator, spy |
| Strategist | spy, infiltrator, guardian |
| Chaos | spy, guardian, saboteur (same as sentinel) |

Each agent is scored by `sum(aptitude[priority_type] * weight)` and the top N are selected. Bot participants have `drafted_agent_ids` set immediately on add.

**Clone function integration** — The `clone_simulations_for_epoch()` PL/pgSQL function reads `drafted_agent_ids` from each participant:
- If draft IDs exist: clones ONLY those agents, preserving draft order via `array_position()`
- If draft IDs are NULL: falls back to `ORDER BY created_at LIMIT max_agents`
- Cloned agents get their aptitudes copied AS-IS (no normalization)
- Missing aptitudes get uniform defaults (6 each) inserted
- Synthetic agents are padded to fill the configured max if needed

### Frontend: DraftRosterPanel

Full-screen overlay component (`components/epoch/DraftRosterPanel.ts`, ~738 lines) with two-column layout for agent draft selection.

**Properties:**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `open` | `boolean` | `false` | Whether overlay is visible |
| `agents` | `Agent[]` | `[]` | Available agents from template simulation |
| `maxSlots` | `number` | `6` | Maximum agents to draft (from epoch config) |
| `aptitudeMap` | `Map<string, AptitudeSet>` | `new Map()` | Pre-loaded aptitude data per agent ID |

**Events:**
- `draft-cancel` — User clicked Cancel or pressed Escape
- `draft-complete` — User clicked "Lock In Roster" with `{ agentIds: string[] }` detail

**Layout:**

1. **Header** — Title ("Draft Roster") + close button. Escape key handler.
2. **Counter bar** — Visual pip indicators (filled/empty) showing `N/max` agents drafted. Text turns green when full.
3. **Body (two-column grid):**
   - **Left: Available Roster** — Scrollable list of all agents. Each card shows avatar, name, character snippet, `VelgAptitudeBars` (sm), and best aptitude type/level. Drafted agents are dimmed (`opacity: 0.35`, `pointer-events: none`). Click to add. Staggered entrance animation.
   - **Right: Deployment Lineup** — Fixed slots (N = maxSlots). Empty slots show "Slot 1", "Slot 2", etc. Filled slots show avatar, name, best aptitude. Click or remove button to unslot. Spring scale animation on fill.
4. **Team Stats** — Below deployment column when agents are drafted. Shows strongest/weakest operative type across the team and average total aptitude.
5. **Footer** — Cancel button + "Lock In Roster" button (disabled when 0 agents selected).

**Design:** Military command console aesthetic consistent with epoch UI. Dark gray-950 background, amber accent for filled pips and lock button. Brutalist typography, monospace stat readouts.

### Frontend: EpochCreationWizard Enhancement

New slider in Step 2 (Economy) for `max_agents_per_player`:

| Setting | Range | Default | Description |
|---------|-------|---------|-------------|
| Agents Per Player | 4-8 | 6 | How many agents each participant can bring |

### Frontend: EpochLobbyActions Enhancement

Two states for joined participants:

1. **Draft not complete** — "Draft Roster" button (amber outline style, `.lobby-btn--draft`). Dispatches `draft-roster` CustomEvent to EpochCommandCenter which opens DraftRosterPanel.
2. **Draft complete** — Status text: "Roster Locked (N/max)" showing drafted count vs configured max. No further action available.

### Frontend: DeployOperativeModal Enhancement

Updated Step 1 (Asset selection) with aptitude integration:

1. **Sorted agent dropdown** — When an operative type is selected, agent dropdown is re-sorted by descending aptitude for that type. Aptitude value shown in brackets: `"Elena Voss [9]"`.
2. **Fit indicator** — After selecting an agent, a badge shows aptitude fitness for the chosen operative type:
   - **Good** (aptitude >= 7): green badge
   - **Fair** (aptitude >= 5): amber badge
   - **Poor** (aptitude < 5): red badge
3. **Aptitude bars with highlight** — `VelgAptitudeBars` rendered in `sm` size with the `highlight` property set to the selected operative type. Non-matching bars are dimmed to 30% opacity.
4. **Aptitude data loading** — All simulation aptitudes fetched on modal open via `agentsApi.getAllAptitudes()`, stored in `_aptitudeMap: Map<string, AptitudeSet>`.

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

## Epoch Cycle Email Notifications (Migration 044)

Players receive email notifications at key epoch lifecycle moments: cycle resolution, phase transitions, epoch completion, and epoch start. All emails respect per-user preferences (opt-in/opt-out per type, single-language EN/DE or bilingual). Dark tactical HUD aesthetic with per-simulation accent colors and narrative voice headers. SMTP delivery via `smtplib.SMTP_SSL` (port 465).

### Notification Types

| Type | Trigger | Content |
|------|---------|---------|
| **Cycle Briefing** | `resolve_cycle()` completes | Per-player fog-of-war compliant briefing: standing (rank + composite + RP + rank gap), 5-dimension analysis with score bars, per-mission deployment log (type/target/outcome), threat assessment (detected/captured inbound ops), spy intel digest (localized zone security + guardian counts from structured metadata), alliance status, next cycle preview (pending missions + RP projection), signal intercepts |
| **Phase Change** | `advance_phase()` transitions epoch | Phase transition box (old → new, translated), cycle count, per-player standing data, operational changes bullets. Phase-scaled subject urgency (DRINGEND // LETZTE PHASE for reckoning) |
| **Epoch Completed** | Epoch reaches `completed` status | Winner announcement, full leaderboard with player highlight, per-player result, campaign statistics (ops deployed, success rate, type breakdown), dimension title race results (translated titles, player position), total cycles |
| **Epoch Start** | `start_epoch()` (G1) | Phase change notification: lobby → foundation transition |

### Recipient Resolution

`CycleNotificationService._resolve_recipients()` follows this chain:

1. Fetch all `epoch_participants` for the epoch (excluding bots: `is_bot = false`)
2. Resolve `source_template_id` → `simulation_members` to find owning `user_id` per participant
3. Batch-resolve emails via `get_user_emails_batch()` SECURITY DEFINER RPC (queries `auth.users`)
4. Load `notification_preferences` and filter by the relevant preference flag (`cycle_resolved`, `phase_changed`, or `epoch_completed`)
5. Users without a `notification_preferences` row receive defaults (all enabled, locale `'en'`)
6. Each recipient includes: `user_id`, `email`, `simulation_id`, `simulation_name`, `simulation_slug`, `email_locale`

### Player Briefing (Fog-of-War Compliant)

Cycle briefing emails use `_build_player_briefing()` which only includes data the player should know:

- **Own scores** — all 5 dimensions + composite for current cycle, with deltas from previous cycle
- **Rank gap** — localized "X Punkte hinter #N" / "Leading by X points" (bilingual dict)
- **Own missions** — per-mission breakdown: operative type, target simulation name, outcome (B7). Defensive ops (guardian, counter_intel) excluded from mission log, shown as aggregate counts
- **Detected threats** — only threats that were detected/captured via counter-intelligence (B1)
- **Spy intel digest** — structured metadata (zone_security levels, guardian_count) with localized rendering instead of raw English narrative (B2)
- **Alliance status** — team name, ally names, +15% diplomatic bonus indicator (B6)
- **Next cycle preview** — pending missions count, RP projection (B4)
- **Signal intercepts** — public battle log events (English, thematically "intercepted transmissions")

### Database

```sql
CREATE TABLE notification_preferences (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    cycle_resolved  BOOLEAN NOT NULL DEFAULT true,
    phase_changed   BOOLEAN NOT NULL DEFAULT true,
    epoch_completed BOOLEAN NOT NULL DEFAULT true,
    email_locale    TEXT NOT NULL DEFAULT 'en' CHECK (email_locale IN ('en', 'de')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id)
);
```

RLS: authenticated users can SELECT/INSERT/UPDATE their own row only (`user_id = auth.uid()`).

### Backend

| Component | File | Purpose |
|-----------|------|---------|
| **CycleNotificationService** | `services/cycle_notification_service.py` (~740 lines) | Recipient resolution (6-step chain), enriched player briefing assembly (threats, spy intel from metadata, missions, alliance, rank gap, next cycle preview), standing snapshot, campaign stats, email dispatch via SMTP |
| **Email Templates** | `services/email_templates.py` (~1660 lines) | 4 render functions (`render_epoch_invitation`, `render_cycle_briefing`, `render_phase_change`, `render_epoch_completed`). 85+ bilingual string keys in `_NOTIF_STRINGS`. Per-simulation accent colors (`_SIM_EMAIL_COLORS`), narrative voice headers (`_SIM_HEADERS`). Localized operative type labels, threat statuses, zone security levels, phase names. Dark tactical HUD aesthetic with WCAG AA contrast (`_TEXT_DIM` #888, `_TEXT_DARK` #666). Single-language or bilingual rendering via `email_locale` parameter |
| **Email Service** | `services/email_service.py` | SMTP SSL delivery (port 465) via `smtplib.SMTP_SSL`, wrapped in `asyncio.to_thread()` |

Integration points in `routers/epochs.py`:
- `resolve_cycle` endpoint calls `send_cycle_notifications()` after cycle resolution
- `advance_phase` endpoint calls `send_phase_change_notifications()` on phase transition, and `send_epoch_completed_notifications()` when advancing to `completed`
- `start_epoch` endpoint calls `send_phase_change_notifications()` for lobby → foundation (G1)

All email sends are best-effort (non-blocking `try/except`) — email failures do not block epoch lifecycle.

### Frontend

`NotificationsSettingsPanel` in the Settings view provides 3 toggle switches (Cycle Briefings, Phase Changes, Epoch Completed) and a language selector (English/Deutsch). Uses `NotificationPreferencesApiService` (2 methods: `getPreferences`, `updatePreferences`).

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/users/me/notification-preferences` | Get preferences (returns defaults if no row) |
| POST | `/api/v1/users/me/notification-preferences` | Upsert preferences |

---

## Foundation Phase Redesign — "Nebelkrieg" (Migration 048)

The Foundation phase was a boring single-decision round where players could only deploy guardians. The "Nebelkrieg" redesign transforms it into a meaningful Cold War phase with intel-gathering, defensive posturing, and hidden fortifications.

### Changes to Foundation Phase

1. **Spies now allowed** — Previously only guardians could be deployed during Foundation. Now spies are also permitted, enabling early intelligence gathering about opponent zone security and guardian deployments.
2. **Guardian deployments are public** — Guardian operative missions deployed during Foundation have `is_public = true` in the battle log, making them visible to all participants. This creates strategic tension: fortify visibly or save RP for the Competition phase.
3. **Zone fortification** — New Foundation-only defensive action (see below).

### Zone Fortifications

Hidden defensive action available only during Foundation phase. Players can spend 2 RP to fortify one of their own zones, increasing its security tier by 1 for 5 competition cycles.

| Property | Value |
|----------|-------|
| **Cost** | 2 RP |
| **Phase restriction** | Foundation only |
| **Duration** | 5 competition cycles |
| **Max per zone** | 1 (UNIQUE constraint on epoch_id + zone_id) |
| **Visibility** | Hidden from opponents — only revealed by enemy spy intel |
| **Security bonus** | +1 tier (e.g., low → medium) |

**Expiry:** During `resolve_cycle()`, expired fortifications (current_cycle >= expires_at_cycle) are cleaned up. The security bonus is removed when the fortification expires.

**Spy interaction:** When a spy successfully gathers intel on a zone, the intel report in the battle log metadata includes fortification data (if any exist). This is the only way opponents can discover fortifications.

### Bot Fortification Strategies

Each bot personality archetype has a distinct approach to zone fortification during Foundation:

| Personality | Strategy |
|-------------|----------|
| **Sentinel** | Fortifies ALL own zones (maximum defensive posture) |
| **Strategist** | Fortifies 1-2 weakest zones (targeted strengthening) |
| **Diplomat** | Fortifies 2 zones (moderate defense) |
| **Chaos** | Random number of fortifications (0-all) |
| **Warlord** | No fortifications (saves RP for offensive operations) |

### Frontend: Intel Dossier Tab

New tab in EpochCommandCenter (`EpochIntelDossierTab`) showing per-opponent intelligence gathered from spy missions. Each opponent card displays:
- Zone security level distribution (badges showing low/medium/high counts)
- Guardian deployment count
- Fortification indicators (if revealed by spy intel)
- Staleness indicator (cycles since last intel report)

Cards are only populated when the player has successful spy intel reports in the battle log. Empty state when no intel has been gathered.

### Frontend: EpochOverviewTab Fortify Section

During Foundation phase, the overview tab shows:
- "FORTIFY ZONE" action button with zone selector dropdown (own zones only)
- "Defensive Fortifications" manifest section with corner bracket decorative frame
- Active fortifications: green pulsing status dot, zone name, security bonus, expiry cycle
- Expired fortifications: dimmed styling

---

## Open Epoch Participation (Migration 049)

Previously, epoch participation required simulation membership -- you could only join an epoch with a simulation where you were an editor/admin/owner. Migration 049 removes this restriction: any authenticated user can join any template simulation in an epoch.

### Motivation

The membership requirement was a barrier to competitive play. New players had to be invited to a simulation, granted editor access, and understand the simulation's content before they could participate. Open participation lets anyone pick a faction and compete immediately.

### Database Changes

**New column on `epoch_participants`:**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `user_id` | UUID | FK auth.users, CHECK (is_bot OR user_id IS NOT NULL), UNIQUE(epoch_id, user_id) WHERE user_id IS NOT NULL | Direct user reference. NULL for bots. |

**Updated `user_has_simulation_access()`:** Extended with a second `EXISTS` clause -- checks `epoch_participants` in addition to `simulation_members`. This grants epoch participants read access to their simulation's data (agents, buildings, zones, etc.) via the existing RLS infrastructure.

**RLS rewrite:** All competitive-layer RLS policies rewritten to use direct `user_id` checks on `epoch_participants` instead of `simulation_members` JOINs with `resolve_template_id()`. Affected tables: `epoch_participants` (INSERT/DELETE), `epoch_chat_messages` (3 policies), `operative_missions` (3 policies), `battle_log` (SELECT).

**New DELETE policy on `epoch_participants`:** Allows participants to leave an epoch (`user_id = auth.uid()`). This policy was previously missing.

### Backend Changes

**`require_epoch_participant()`** -- New FastAPI dependency in `dependencies.py`. Validates that the current user is an active participant in the specified epoch (via `user_id` match on `epoch_participants`). Replaces `require_simulation_member("editor")` on all competitive-layer endpoints in `operatives.py` and `epochs.py`.

**Participant join flow:** `POST /epochs/{id}/participants` no longer validates simulation membership. It only checks:
1. Simulation is `simulation_type = 'template'`
2. User is not already in the epoch (UNIQUE constraint)
3. Epoch is in lobby phase

### Frontend Changes

**EpochLobbyActions -- Sim Picker:** When joining an epoch, players see a simulation picker with faction cards showing simulation name, banner image, agent count, and theme accent color. Cards have 3 states:
- **Available:** Clickable, full opacity
- **Deployed:** Dimmed with "DEPLOYED" badge (already used in another active epoch)
- **Selected:** Highlighted border, ready to join

Includes a dismiss button to cancel the selection.

**`_myParticipant` matching:** Changed from simulation membership lookup to direct `user_id` match on `epoch_participants`. This is simpler and more reliable -- works regardless of whether the user is a simulation member.

---

## Related Documents

| Document | Relationship |
|----------|-------------|
| `game-systems.md` | Full game design spec — all 8 systems with formulas, cross-system interactions |
| `relationships-echoes-map.md` | Agent relationships + event echoes (Bleed mechanic) — feeds into scoring |
| `embassies.md` | Embassy architecture — required channel for operative deployment |
| `../explanations/concept-lore.md` | Multiverse lore — Cartographers, the Bleed, the Convergence |
| `../explanations/game-design-document.md` | Comprehensive game design document for external game designers |

---

## Changelog

**Change v2.2:** Audit Phase 2 — Scoring via `fn_compute_cycle_scores()` RPC (Migration 127, ersetzt 12 Python-Queries), `fn_auto_draft_participants()` RPC (Migration 128, ersetzt N per-Participant Loop). LeaderboardEntry erweitert: `ally_count`, `ally_bonus_pct`, `betrayal_penalty`. Neuer Endpoint: `GET /epochs/{epoch_id}/scores/intel-dossiers` (vorab-aggregierte Intel Dossiers mit `is_stale` Flag). Results-Summary N+1 Fix (Batch-Queries statt per-Participant Loops).
**Change v2.1:** Alliance Redesign — Proposal-basiertes Beitreten (einstimmige Abstimmung), Shared Intelligence (RLS), Upkeep (1 RP/Mitglied/Zyklus), Tension (Auto-Auflösung bei 80). Neue Tabellen: `epoch_alliance_proposals`, `epoch_alliance_votes`. Neue Spalte: `epoch_teams.tension`. 5 Postgres-Funktionen, 2 Trigger, 5 RLS-Policies. 3 neue API-Endpunkte. 6 neue `battle_log`-Event-Typen. Bot-Abstimmungsstrategien pro Persönlichkeitsarchetyp.
**Change v1.9:** Foundation Phase Redesign ("Nebelkrieg") + Open Epoch Participation — Migration 048: `zone_fortifications` table, Foundation phase now allows spies + guardians (was guardian-only), spy intel includes fortifications metadata, bot personalities with per-archetype fortification strategies, `/operatives/fortify-zone` endpoint, `zone_fortified` battle log event type. Migration 049: `user_id` column on `epoch_participants`, any authenticated user can join any template simulation (no membership required), `require_epoch_participant()` dependency replaces `require_simulation_member("editor")` on competitive endpoints, RLS rewritten to direct `user_id` checks, `user_has_simulation_access()` extended for epoch participants, DELETE policy added for `epoch_participants`. Frontend: EpochIntelDossierTab (new), MissionCard (new), operative-icons.ts (new), EpochOverviewTab fortify zone section, EpochLobbyActions sim picker with faction cards, `_myParticipant` matching via `user_id`.
**Change v1.8:** Email Notification i18n & Template Enhancement — Full German translation coverage across all 4 email templates. 85+ bilingual string keys in `_NOTIF_STRINGS` dict (was ~40). Cycle briefing enriched: threat assessment (localized status ERKANNT/GEFASST), spy intel from structured metadata (zone security NIEDRIG/MITTEL/HOCH + Wächtereinsatz), per-mission log with translated headers (TYP/ZIEL/ERGEBNIS), phase name translation (WETTBEWERB/GRUNDSTEINLEGUNG/ABRECHNUNG), alliance status, rank gap, next cycle preview. Phase change: localized subject prefixes (DRINGEND // LETZTE PHASE, GEHEIM // OPERATIONEN BEGINNEN). Epoch completed: localized leaderboard columns, dimension title race "Du:" label. Invitation: DE block shows "Siehe Geheimdienstbericht oben" instead of duplicating English AI lore. All templates: footer ÜBERTRAGUNGSURSPRUNG localized. Contrast fix: `_TEXT_DIM` #666→#888, `_TEXT_DARK` #444→#666 (WCAG AA compliant). Per-simulation accent colors + narrative voice headers. SMTP delivery (replaced Resend API). Epoch start notification (G1: lobby→foundation fires phase change email). `cycle_notification_service.py` enriched: spy intel includes structured `metadata` + resolved `target_name`.
**Change v1.7:** Agent Aptitude System + Draft Phase — Migration 047: `agent_aptitudes` table (6 operative types x score 3-9, budget=36 per agent, UNIQUE(agent_id, operative_type)), `drafted_agent_ids UUID[]` + `draft_completed_at` on epoch_participants. Success probability formula updated from `qualification x 0.05` to `aptitude x 0.03`. Backend: AptitudeService (get/set/query), aptitudes router (3 endpoints + 2 public), EpochService.draft_agents(), bot auto_draft() per personality archetype. Frontend: VelgAptitudeBars shared component (3 sizes, editable/readonly, budget tracking), DraftRosterPanel (full-screen overlay, two-column draft UI), AgentDetailsPanel aptitude editor (debounced 800ms auto-save), AgentsView lineup overview strip, DeployOperativeModal fit indicator (Good/Fair/Poor) + sorted agent dropdown, EpochCreationWizard `max_agents_per_player` slider (4-8), EpochLobbyActions draft button + locked status. Clone function reads `drafted_agent_ids` + clones aptitudes AS-IS (no normalization). 35 template agents seeded with lore-appropriate aptitude distributions.
**Change v1.6:** Epoch Cycle Email Notifications — Migration 044: `notification_preferences` table + `get_user_emails_batch()` SECURITY DEFINER RPC. CycleNotificationService (recipient resolution, fog-of-war player briefings, SMTP delivery). 3 email types: cycle briefing, phase change, epoch completed (bilingual EN/DE with single-language opt-in). 2 new API endpoints (GET/POST `/users/me/notification-preferences`). Frontend: NotificationsSettingsPanel in settings view.
**Change v1.5:** Bot Players — AI-controlled opponents for solo/low-player epochs. Migration 041: `bot_players` + `bot_decision_log` tables, `is_bot`/`bot_player_id` on `epoch_participants`. 5 personality archetypes (Sentinel/Warlord/Diplomat/Strategist/Chaos) × 3 difficulty levels. Backend: BotService (cycle orchestrator), BotGameState (fog-of-war compliant), BotPersonality (5 implementations), BotChatService (dual-mode: template + LLM). Frontend: BotConfigPanel (collectible card deck builder UI), bot indicators in leaderboard/battle log/chat/ready panel, AI Settings bot chat controls.
**Change v1.4:** Balance patch v2.2 — guardian penalty 0.08→0.06/unit (cap 0.15), guardian cost 3→4 RP, infiltrator rework (cost 6→5, embassy reduction 50%→65%, +3 influence/success, sovereignty −6→−8, score 5→6), assassin cost 8→7 + stability −4→−5 + sovereignty −10→−12, saboteur stability −5→−6, propagandist sovereignty −5→−6, detection penalty 2→3, RP economy 10→12/cycle + cap 30→40, counter-intel sweep 3→4 RP.
**Change v1.3:** Balance patch v2.1 — guardian penalty 0.20→0.08/unit (cap 0.20), spy intel reveal (zone security + guardian count to battle log), saboteur zone downgrade (security −1 tier), scoring rebalance (propagandist +3→+5, detection −3→−2, spy influence +1/+2, guardian sovereignty +4), betrayal −20%→−25%, alliance 10%→15%. Cartographer's Map: game instance visualization (phase rings, health arcs, sparklines, operative trails, battle feed, leaderboard panel, minimap, 30s refresh).
**Change v1.2:** EpochCommandCenter decomposed from monolithic 3364-line file into orchestrator (1934 lines) + 5 child components: EpochOpsBoard (ops board + COMMS sidebar), EpochOverviewTab, EpochOperationsTab, EpochAlliancesTab, EpochLobbyActions. Data flows via Lit properties, mutations via CustomEvent bubbling. ~60 hardcoded hex colors replaced with CSS custom property tokens across all epoch components.
