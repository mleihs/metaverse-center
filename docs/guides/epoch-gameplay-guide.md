---
title: "Epoch Gameplay Guide"
id: epoch-gameplay-guide
version: "1.0"
date: 2026-03-09
lang: en
type: guide
status: active
tags: [epoch, gameplay, competitive, fog-of-war, operatives, alliances, results]
---

# Epoch Gameplay Guide

> A player-facing guide to competitive Epochs: operative deployment, fog of war,
> alliances, scoring, the results screen, and academy training mode.

---

## Table of Contents

1. [Epoch Lifecycle](#1-epoch-lifecycle)
2. [Operative System](#2-operative-system)
3. [Fog of War](#3-fog-of-war)
4. [Alliance System](#4-alliance-system)
5. [Leaderboard & Scoring](#5-leaderboard--scoring)
6. [Results Screen](#6-results-screen)
7. [Academy Mode](#7-academy-mode)

---

## 1. Epoch Lifecycle

An epoch progresses through five phases:

```
LOBBY --> FOUNDATION --> COMPETITION --> RECKONING --> COMPLETED
```

| Phase | What Happens |
|:------|:-------------|
| **Lobby** | Open join (any user + any simulation). Draft agents into your roster. Form teams. Add bots. |
| **Foundation** | "Nebelkrieg" -- spy + guardian deployment only. Zone fortification (+1 security for 5 cycles). Early intel gathering. +50% RP bonus. |
| **Competition** | All six operative types unlocked. Full warfare. Cycles resolve on a configurable timer. |
| **Reckoning** | Final scoring round. Diminished RP. Last-chance operations. |
| **Completed** | Fog of war lifts. DECLASSIFIED results screen. Game instances archived. |

Each cycle, players receive Resource Points (RP) to spend on operative deployments. When all participants signal readiness (or the cycle timer expires), the cycle resolves: operations succeed or fail, scores update, and a new cycle begins.

---

## 2. Operative System

### Six Operative Types

| Type | RP Cost | Effect | Scoring Impact |
|:-----|:--------|:-------|:---------------|
| **Spy** | 3 | Reveals zone security, guardians, and hidden fortifications | +2 Influence, +1 Diplomatic per success |
| **Guardian** | 4 | Reduces enemy operative success by 6% per unit (cap 15%) | +4 Sovereignty |
| **Saboteur** | 5 | Downgrades random target zone security by 1 tier | -6 Stability to target |
| **Propagandist** | 4 | Creates narrative event in target simulation | +5 Influence, -6 Sovereignty to target |
| **Infiltrator** | 5 | Reduces target embassy effectiveness by 65% for 3 cycles | +3 Influence, -8 Sovereignty to target |
| **Assassin** | 7 | Blocks target ambassador for 3 cycles | -5 Stability to target, -12 Sovereignty to target |

### Aptitude System

Each agent has aptitude scores rated **3 to 9** for every operative type, with a fixed budget of **36 points** per agent. These aptitudes directly affect success probability:

- **Aptitude modifier**: `aptitude x 0.03` (an aptitude of 9 gives +27%, aptitude 3 gives +9%)
- The FIT badge on the deploy modal summarizes agent-mission compatibility: **GOOD** (7-9), **FAIR** (5-6), **POOR** (3-4)

### Success Probability

The deploy modal displays a transparent breakdown of the estimated success chance:

- **Base rate** -- depends on operative type
- **Aptitude bonus** -- `aptitude x 0.03`
- **Zone security penalty** -- higher security reduces success
- **Embassy effectiveness** -- bonus from diplomatic infrastructure

**Visible factors**: agent aptitude, zone security level, embassy effectiveness.

**Hidden factors (fog of war)**: guardian penalties from defenders, substrate resonance modifiers, attacker penalties. These are applied during cycle resolution but not shown in the pre-deploy estimate.

### Draft Phase

Before a match begins, players select agents from their simulation's roster into deployment slots. The draft UI presents available agents as a fanned hand of TCG cards. Aptitude pips on each card show per-operative-type scores at a glance. Once drafted, an agent receives a "DEPLOYED" stamp. The draft supports up to 6 agents per roster.

---

## 3. Fog of War

During an active epoch, information is restricted. You operate under partial intelligence -- what you know depends on what you have directly observed or been targeted by.

### What You CAN See

- **Your own operations** -- full details: agent name, operative type, target, success probability breakdown, outcome narrative
- **Incoming threats against you** -- operation type and target zone, but NOT the attacking agent's name or exact success probability
- **Public events** -- phase transitions, alliance formations and dissolutions, cycle completions
- **Your own leaderboard position** -- scores update after each cycle resolution
- **Spy intelligence** -- successful spy missions reveal target zone security levels, guardian placements, and hidden fortifications

### What You CANNOT See

- Other players' private operations (agent assignments, target selections)
- Guardian placements defending other players (unless revealed by a spy)
- Exact success probabilities of attacks directed at you
- Other players' RP expenditure or remaining budget
- Substrate resonance modifiers (applied silently during resolution)

### Declassification

When an epoch reaches COMPLETED status, **all information is declassified**. The results screen reveals the full picture: every operation, every agent assignment, every hidden modifier. The battle log becomes fully transparent, and the DECLASSIFIED watermark stamps the results view.

### Spy Intel & the Intel Dossier

Successful spy missions produce a **point-in-time snapshot** of the target's current state. Each snapshot captures:

- **Zone security levels** -- the security tier of each zone (e.g. "The Undertide Docks: low", "The Iron Bastion: high")
- **Zone names** -- displayed alongside security levels for precise tactical awareness
- **Guardian count** -- the number of guardian operatives currently stationed at the target
- **Active fortifications** -- hidden fortification bonuses with their expiry cycles

Intel is displayed in the **Intel Dossier** tab, grouped by opponent. Each dossier card shows:

- The opponent simulation name
- **"Last intel: Cycle X"** -- indicating when the snapshot was taken
- A **"Snapshot"** indicator in the card footer, reinforcing that this is captured-in-time data
- Zone security badges with zone names (e.g. "The Undertide Docks: low")
- Guardian count and active fortifications

**Intel staleness**: Intel older than **5 cycles** is marked with an **"Intel may be outdated"** warning tag. The dossier card is visually dimmed to indicate reduced reliability. Conditions at the target may have changed since the snapshot was taken -- guardians may have been redeployed, zones may have been sabotaged, and fortifications may have expired.

**Refreshing intelligence**: Deploy fresh spy operatives to update your intelligence. Each new successful spy mission replaces the previous snapshot for that target, giving you current zone security levels, guardian counts, and fortification status.

---

## 4. Alliance System

Alliances are teams of epoch participants who share intelligence and earn diplomatic bonuses -- but at a cost. The Alliances tab on the epoch detail page shows existing teams, unaligned participants, and pending proposals.

### Joining a Team

How you join a team depends on the current epoch phase:

| Phase | Join Mechanic |
|:------|:--------------|
| **Lobby / Foundation** | Instant join -- click a team and you are in immediately |
| **Competition / Reckoning** | Proposal required -- all current team members must unanimously approve. Proposals expire after **2 cycles** if not fully approved |

Proposals that expire are silently removed. You can re-propose after expiry.

### Shared Intelligence

Allies automatically share fog-of-war intel:

- Battle log entries from allied operatives appear in your log with an **"ALLIED INTEL"** badge
- You see your allies' operations and the threats targeting them -- extending your fog-of-war visibility without deploying your own spies
- Intel sharing is automatic and immediate; no action required

### Upkeep & Tension

Alliances are not free. Every cycle, each member pays an RP upkeep cost, and careless coordination can generate tension that tears the alliance apart.

| Mechanic | Rule |
|:---------|:-----|
| **RP upkeep** | 1 RP per member per cycle. A 3-member team costs each member **3 RP/cycle** |
| **Tension buildup** | +10 tension when 2+ allies attack the same target in the same cycle (per overlap) |
| **Natural decay** | -5 tension per cycle |
| **Auto-dissolve** | If tension reaches **80**, the alliance dissolves immediately |

Coordinate your targets to avoid tension spikes. The alliance panel displays the current tension level.

### Benefits

- **+15% diplomatic score bonus** per active ally
- Diplomatic dimension rewards cooperation and coalition-building
- Alliance membership is visible to all participants (public event)

### Betrayal

- Betrayal can be enabled or disabled in the epoch configuration
- If enabled, a player can leave an alliance mid-epoch
- **Betrayal penalty**: -25% diplomatic score multiplier for the betrayer
- Betrayal events are broadcast to all participants

---

## 5. Leaderboard & Scoring

### Five Scoring Dimensions

| Abbreviation | Dimension | What Drives It |
|:-------------|:----------|:---------------|
| **STAB** | Stability | Building readiness, zone security, resistance to sabotage |
| **INFL** | Influence | Propagandist successes, spy intel, cultural operations |
| **SOVR** | Sovereignty | Guardian deployments, defense against infiltrators/assassins |
| **DIPL** | Diplomacy | Embassy effectiveness, alliance bonuses, spy diplomatic leverage |
| **MILT** | Military | Offensive operation successes, attack damage dealt |

### Composite Score

The final ranking uses a **composite score** calculated from all five dimensions with configurable weights. The epoch creator can adjust dimension weights to emphasize different strategic priorities.

### Leaderboard Features

- **"YOU" badge** -- your own simulation row is highlighted with a subtle amber background accent, making it easy to locate your position in larger epochs
- **Column tooltips** -- hovering over abbreviated column headers (STAB, INFL, SOVR, DIPL, MILT) reveals the full dimension name
- **Score history** -- cycle-by-cycle score progression is tracked and available for review
- **Rank indicators** -- gold (#1), silver (#2), and bronze (#3) styling for the top three positions

---

## 6. Results Screen

When an epoch completes, the detail view transitions to a dedicated **DECLASSIFIED** results screen with cinematic presentation.

### Header: OPERATION CONCLUDED

The results open with a dramatic header: "OPERATION CONCLUDED" with the epoch name, participant count, and total cycles. A red "DECLASSIFIED" watermark stamps across the header with a slam animation.

### Top-3 Podium

The top three finishers are displayed in a podium layout:

- **Gold (#1)** -- center position, gold border and glow
- **Silver (#2)** -- left position, silver accents
- **Bronze (#3)** -- right position, bronze accents

Each podium entry shows the simulation name, composite score, team name (if applicable), and any dimension title earned.

### Your Operation Report

If you participated, a personal statistics section appears with animated stat cards:

| Stat | Description |
|:-----|:------------|
| **Total Operations** | Number of operative missions deployed |
| **Successful** | Operations that achieved their objective |
| **Detected / Captured** | Operations that were intercepted or agents captured |
| **Success Rate** | Percentage of successful operations |

Each stat card includes a progress bar that animates on reveal, with color coding: blue for operations, green for successes, red for detections, gold for success rate.

### MVP Commendations

Five commendation awards recognize dimension leaders:

| Award | Criterion | Description |
|:------|:----------|:------------|
| **Master Spy** | Highest military score | Supreme covert operations |
| **Iron Guardian** | Highest sovereignty score | Impenetrable defenses |
| **The Diplomat** | Highest diplomatic score | Master of alliances |
| **Most Lethal** | Highest success rate (min. operations threshold) | Surgical precision |
| **Cultural Domination** | Highest influence score | Reshaping the narrative |

Awards are presented as trophy cards with gold accents and hover effects. A single simulation can earn multiple commendations.

### Dimension Analysis

A 5-panel comparison grid shows how all participants scored in each dimension:

- **Stability** (green) -- **Influence** (purple) -- **Sovereignty** (blue) -- **Diplomacy** (gold) -- **Military** (red)

Each panel names the dimension winner and displays horizontal comparison bars for the top 5 participants, with animated fill transitions.

### Final Standings Table

A complete standings table lists all participants with:

- Rank (gold/silver/bronze styling for top 3)
- Simulation name and any earned dimension title
- Composite score
- Individual dimension scores (Stab, Infl, Sovr, Dipl, Milt)
- Your own row highlighted with a subtle amber background

### Animations & Accessibility

All results screen animations -- header reveal, podium rise, stat card entrance, bar fills, MVP card reveals -- respect the `prefers-reduced-motion` media query. With reduced motion enabled, all transitions complete instantly.

---

## 7. Academy Mode

Academy mode provides solo training against AI opponents, letting you learn epoch mechanics without waiting for other players.

### How It Works

1. Click **"Start Training"** on the Academy card in your dashboard
2. The system automatically creates an epoch, joins your simulation, adds AI bot opponents, and starts the match
3. Cycles auto-resolve -- no waiting for other players to signal readiness

### Configuration

| Setting | Value |
|:--------|:------|
| **Format** | Sprint |
| **Duration** | 3 days |
| **Cycle length** | 4 hours |
| **Bot opponents** | 2-4 (default 3) |
| **Bot difficulty** | Easy / Medium / Hard (default Easy) |
| **Bot personalities** | Rotated from: Sentinel, Warlord, Diplomat, Strategist |

### Constraints

- **One active academy epoch per player** -- you must complete or cancel your current academy epoch before starting a new one
- Academy epochs use the same operative deployment, scoring, and fog-of-war systems as regular competitive epochs
- Bot opponents make fog-of-war-compliant decisions using the same service pipeline as human players
- Results and commendations work identically to competitive epochs

Academy mode is the recommended starting point for new players before entering competitive epochs against human opponents.

---

## API Reference

The results summary is available via:

```
GET /api/v1/epochs/{epoch_id}/results-summary
```

Returns a `ResultsSummary` object containing:

- `standings` -- ranked `LeaderboardEntry[]` with per-dimension scores and composite
- `participant_stats` -- per-simulation `ParticipantStats[]` (operations, successes, failures, detections, captured, success_rate)
- `mvp_awards` -- `MVPAward[]` with title, description, simulation, and value
- `score_history` -- cycle-by-cycle `EpochScore[]` keyed by simulation ID

This endpoint is only available for completed epochs (fog of war must be lifted).
