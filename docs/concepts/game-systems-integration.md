---
title: "Game Systems Integration — Connecting the Living World"
version: "1.0"
date: "2026-03-25"
type: concept
status: active
lang: en
tags: [architecture, game-design, integration, autonomy, living-world]
---

# Game Systems Integration — Connecting the Living World

> **Priority: CRITICAL** — This is the single most important architectural issue in the project.
> Every other feature improvement builds on this foundation.

## The Problem

A comprehensive systems audit (2026-03-25) revealed that the platform's game mechanics are **architecturally complete but operationally disconnected**. Each system works individually, but they don't work together.

### Finding 1: Autonomy is OFF by default

The orchestration layer (heartbeat Phase 9) that ties everything together is gated on `agent_autonomy_enabled`, which defaults to `false`. This means:

- Agent needs don't decay
- Agent mood doesn't evolve
- Agent opinions don't change
- Activity selection doesn't run
- Social interactions don't happen
- Autonomous events don't generate

**Only Velgarien was manually enabled on 2026-03-25.** All other simulations are dormant.

**Location:** `backend/services/heartbeat_service.py` line 386: `overrides.get("agent_autonomy_enabled", "false")`

### Finding 2: Key metrics are vanity metrics

**Influence** (Relationships 40% + Professions 30% + Diplomatic 30%):
- Computed in `frontend/src/components/agents/AgentDetailsPanel.ts` lines 920-939
- Displayed prominently on every agent detail page
- Used NOWHERE in gameplay: not in building readiness, not in epoch scoring, not in activity selection, not in ANY backend code
- **100% cosmetic**

**Zone Stability**:
- Computed in `mv_zone_stability` materialized view (migration 072)
- Formula: `infrastructure×0.5 + security×0.3 - pressure×0.25`
- Used in only TWO places:
  1. Epoch scoring (`ScoringService._compute_stability()`)
  2. One cascade threshold check (stability < 0.3)
- Does NOT affect: event probability, agent needs, mood, activity selection, or any other mechanic
- **Mostly cosmetic**

### Finding 3: Systems don't feed each other

| System A | → Should affect → | System B | Actually connected? |
|----------|-------------------|----------|-------------------|
| Weather | Agent Mood | Moodlets | ✅ YES (implemented 2026-03-25) |
| Agent Mood | Activity Selection | Utility AI | ✅ YES (when autonomy is on) |
| Agent Location | Building Readiness | MV formula | ✅ YES (staffing ratio) |
| Influence | Building Readiness | MV formula | ❌ NO — influence unused |
| Zone Stability | Event Probability | Event generation | ❌ NO — stability doesn't drive events |
| Events | Agent Needs | Safety need | ❌ NO — events don't affect agents |
| Resonance | Agent Mood | Moodlets | ❌ NO — resonance is decorative |
| Relationships | Epoch Scoring | Score computation | ✅ YES (but indirect) |

### Finding 4: UX shows numbers without explanation

9 of 14 user-facing metrics are displayed WITHOUT:
- Info bubbles explaining what the number IS
- Causal context showing WHY it's at this value
- Action guidance telling the user WHAT TO DO

Metrics without explanation: Agent Influence %, Zone Stability %, Zone Pressure, Agent Mood Score, Agent Stress, Agent Needs Radar, Overall Health %, Building Readiness %, Heartbeat Entry Types.

---

## Proposed Fix: Two Phases

### Phase A: Make Systems Actually Connect (Backend)

**A1. Influence → Building Readiness**
Add `agent_influence_factor` to `mv_building_readiness` formula. Agents with high influence contribute more to readiness. This makes influence MECHANICALLY MEANINGFUL.

```sql
-- Current: readiness = staffing_ratio × qualification_match × condition_factor
-- Proposed: readiness = staffing_ratio × qualification_match × condition_factor × avg_influence_factor
-- avg_influence_factor = COALESCE(avg(agent_influence), 0.5) where agent_influence is computed from relationships + qualifications
```

**A2. Zone Stability → Event Probability**
Low stability increases negative event chance. Add stability as a modifier in `AutonomousEventService.check_and_generate()`.

```python
event_probability *= (1.5 - stability)
# stability 0.3 → 1.2x event chance (unstable = more events)
# stability 0.8 → 0.7x event chance (stable = fewer events)
```

**A3. Resonance → Agent Mood**
Active resonances apply moodlets based on susceptibility profile. New Phase 9.6 in heartbeat.

```python
# "The Shadow" (conflict_wave) → anxiety moodlet
# "The Prometheus" (innovation_spark) → inspiration moodlet
# Strength = resonance.magnitude × simulation.susceptibility[signature]
```

**A4. Events → Agent Needs Feedback**
High-impact events (level ≥ 6) reduce safety need for agents in the event's zone.

```python
safety_need -= event.impact_level * 2
# Level 8 event → safety drops by 16 points
# This makes agents in dangerous zones seek safety activities
```

**A5. Default Autonomy ON**
Change default from `"false"` to `"true"`. Guard rail: LLM features still require BYOK key.

```python
# heartbeat_service.py line 386
overrides.get("agent_autonomy_enabled", "true")  # was "false"
# Also weather default:
overrides.get("weather_enabled", "true")  # was "false"
```

### Phase B: Make Connections Visible to User (Frontend)

**B1. Info bubbles on all 9 unexplained metrics**
Using existing `renderInfoBubble()` shared component. Each bubble explains: what this number IS, what it's measured against, and what the user can do to change it.

**B2. Causal connection indicators**
Show WHERE numbers come from:
- Zone card weather indicator: "Agent mood effect: -3 distress"
- Agent mood panel moodlet source: "Weather: Rain at 10°C → -3"
- Building readiness breakdown: "3 agents × avg influence 47%"
- Zone stability cause: "↓ because: 2 active events, 0 fortifications"

**B3. Action guidance on empty/critical states**
- 0% Professions: "No profession set. Edit agent to assign one."
- Empty building: "Assign agents to improve readiness → zone stability."
- Critical stability: "Fortify this zone or resolve active events."
- High stress agent: "Nearing breakdown. Move to a stable zone or trigger a ceremony."

---

## Implementation Order

1. **A5** (change defaults) — smallest code change, biggest impact
2. **A1** (influence → readiness) — makes the most visible vanity metric real
3. **A2** (stability → events) — makes zone stability consequential
4. **A4** (events → needs) — closes the agent feedback loop
5. **A3** (resonance → mood) — integrates the last isolated system
6. **B1-B3** (UX layer) — only after mechanics are real

---

## Files Involved

### Phase A (Backend)
| File | Change |
|------|--------|
| `backend/services/heartbeat_service.py` | A5: default ON; A3: Phase 9.6 resonance moodlets |
| New migration | A1: mv_building_readiness includes influence |
| `backend/services/autonomous_event_service.py` | A2: stability modifier |
| `backend/services/agent_needs_service.py` | A4: event impact method |

### Phase B (Frontend)
| File | Change |
|------|--------|
| `AgentDetailsPanel.ts` | B1: info bubbles, location, empty state |
| `AgentMoodPanel.ts` | B1: info bubbles, axis labels, moodlet sources |
| `ZoneList.ts` | B1-B2: info bubbles, stability label, weather effect |
| `DailyBriefingModal.ts` | B1-B2: info bubbles, arc formatting |
| `BuildingDetailsPanel.ts` | B1-B3: info bubbles, empty state guidance |
| `SimulationPulse.ts` | B1: entry type field guide |

---

## Why This Matters

Without Phase A, every info bubble describes a metric that doesn't do anything. "Influence measures your agent's effectiveness" is a lie if influence doesn't affect anything. Mechanics must be real BEFORE communication is honest.

The platform has deep mechanics that are architecturally complete but operationally dormant. Activation + connection + communication — in that order — transforms it from a beautiful dashboard into a living game.

---

## Related Documents

- [10 Proposals zur Tamagotchisierung](tamagotchi-proposals.md) — engagement features building on this foundation
- [Sentry CI/CD Integration](../guides/sentry-cicd-integration.md) — observability for monitoring system health
- [ADR-007: Database Logic in Database](../adr/007-database-logic-in-database.md) — pattern for influence calculation in mv_building_readiness
