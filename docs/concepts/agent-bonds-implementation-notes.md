# Agent Bonds — Implementation Notes (Context Dump)

**Date**: 2026-04-16
**Purpose**: Codebase-specific details that a fresh context needs to implement Agent Bonds. Read this ALONGSIDE `resonance-journal-agent-bonds-concept.md`.

---

## 1. Existing Systems to Hook Into

### Agent Needs/Mood System (already running)
- **Needs service**: `backend/services/agent_needs_service.py` — 5 needs (social, purpose, safety, comfort, stimulation), personality-dependent decay
- **Mood service**: `backend/services/agent_mood_service.py` — mood_score (-100 to +100), dominant_emotion, stress_level (0-1000), resilience, volatility
- **Moodlets**: `backend/services/agent_moodlet_service.py` — temporary modifiers with stacking groups
- **Opinions**: `backend/services/agent_opinion_service.py` — directed relationships between agents (-100 to +100)
- **DB tables**: `agent_needs`, `agent_mood`, `agent_moodlets`, `agent_opinions`
- **Big Five traits**: Extracted from agent backstory via LLM, stored as personality fields on agent model

### Heartbeat System (trigger point for whispers)
- **Service**: `backend/services/heartbeat_service.py` — ticks every 4 hours (6x daily)
- **Phases per tick**: needs decay → activity selection → autonomous events → event aging → zone stability update
- **Where to hook**: Add a new phase AFTER autonomous events — "whisper generation" for bonded agents
- **The heartbeat already**: decays needs, triggers activities, generates moodlets, updates opinions, fires autonomous events. Whisper generation is a natural new phase.

### Autonomous Event Service
- **Service**: `backend/services/autonomous_event_service.py`
- **Relevance**: Event Whispers should fire when significant autonomous events occur near a bonded agent's zone
- **Significance threshold**: Already exists for event generation — reuse the same threshold for whisper triggers
- **Event types**: stress_breakdown, relationship_breakthrough, relationship_breakdown, celebration, zone_crisis_reaction, community_response

### Agent Model
- **Model**: `backend/models/agent.py`
- **Key fields**: id, simulation_id, name_de, name_en, backstory_de, backstory_en, personality traits (Big Five), profession, building_id (current assignment)
- **Active view**: `active_agents` — CRITICAL: if adding columns to `agents`, refresh the view in the same migration

### Supabase Client Pattern
- Use `get_effective_supabase` (auto-elevates for platform admins)
- RLS policies needed for new tables
- Wrap `(SELECT auth.uid())` and `(SELECT user_has_simulation_access(...))` in subqueries for initPlan optimization (migration 183 pattern)

### Response Patterns
- Return `SuccessResponse[T]` instances, never raw dicts
- No `response_model=` parameter on FastAPI decorators
- Return type annotation is the single source of truth
- Models live in `backend/models/<domain>.py`

---

## 2. Database Design Notes

### New Tables Needed

```sql
-- agent_bonds: core bond tracking
CREATE TABLE agent_bonds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  simulation_id UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
  depth INTEGER NOT NULL DEFAULT 1 CHECK (depth BETWEEN 1 AND 5),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('forming', 'active', 'strained', 'farewell')),
  attention_score INTEGER NOT NULL DEFAULT 0,  -- pre-bond tracking
  formed_at TIMESTAMPTZ,  -- null until bond is accepted
  depth_2_at TIMESTAMPTZ,
  depth_3_at TIMESTAMPTZ,
  depth_4_at TIMESTAMPTZ,
  depth_5_at TIMESTAMPTZ,
  farewell_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, agent_id)  -- one bond per user-agent pair
);

-- bond_whispers: generated messages
CREATE TABLE bond_whispers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bond_id UUID NOT NULL REFERENCES agent_bonds(id) ON DELETE CASCADE,
  whisper_type TEXT NOT NULL CHECK (whisper_type IN ('state', 'event', 'memory', 'question', 'reflection')),
  content_de TEXT NOT NULL,
  content_en TEXT NOT NULL,
  trigger_context JSONB NOT NULL DEFAULT '{}',  -- what caused this whisper
  read_at TIMESTAMPTZ,  -- tracks engagement
  acted_on BOOLEAN DEFAULT FALSE,
  action_acknowledged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- bond_memories: tracks what the agent remembers about the player
CREATE TABLE bond_memories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bond_id UUID NOT NULL REFERENCES agent_bonds(id) ON DELETE CASCADE,
  memory_type TEXT NOT NULL CHECK (memory_type IN ('action', 'neglect', 'milestone', 'farewell')),
  description TEXT NOT NULL,  -- internal, not shown to player
  context JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### RLS Policies
- `agent_bonds`: User can see/edit their own bonds. Public can see bond existence (not whisper content) for social features.
- `bond_whispers`: Only the bond owner can see whispers. Use `(SELECT auth.uid()) = (SELECT user_id FROM agent_bonds WHERE id = bond_id)`.
- `bond_memories`: Internal only — no direct user access. Backend reads via service_role for whisper generation context.

### Migration Number
- Check current highest migration number in `supabase/migrations/` before creating
- Pattern: `YYYYMMDDHHMMSS_NNN_description.sql`

---

## 3. Service Architecture

### New Services

```
backend/services/bond/
  bond_service.py              — CRUD, formation flow, depth progression, strain management
  whisper_service.py           — Whisper generation pipeline (LLM + salience filter + quality control)
  whisper_template_service.py  — Fallback hand-authored templates with slot-filling
  bond_memory_service.py       — Memory CRUD, pattern detection for Reflection Whispers
```

### Bond Service Core Methods
- `track_attention(user_id, agent_id)` — increment attention score. Called from frontend when user views agent detail.
- `check_recognition(user_id, simulation_id)` — check if any agents crossed attention threshold. Returns list of agents ready for recognition whisper.
- `form_bond(user_id, agent_id)` — create the bond (after recognition whisper shown)
- `get_bonds(user_id, simulation_id)` — list active bonds
- `check_depth_progression(bond_id)` — evaluate if bond should advance. Called after whisper read / action-on-whisper.
- `enter_strain(bond_id, reason)` — triggered by harmful player actions
- `farewell(bond_id)` — triggered when agent is deleted. Generates farewell whisper.

### Whisper Service Pipeline
1. Called from heartbeat phase
2. For each bonded agent: evaluate salience (state changed? event nearby? need critical? time since last whisper?)
3. If salient: gather context (agent state, bond history, simulation context, previous whispers)
4. Generate via LLM (OpenRouter, Tier 3 — same as autonomous event narratives)
5. Validate: coherence filter (personality match), novelty filter (not too similar to recent)
6. If validation fails: regenerate once, then fall back to template
7. Store whisper in bond_whispers

### LLM Integration Pattern
- Use existing OpenRouter integration in `backend/services/ai/` 
- Look at how `autonomous_event_service.py` generates event narratives — same pattern
- Tier 3 processing = lowest priority, async-compatible
- Always bilingual (DE + EN) — use the existing pattern where both languages are generated in one call

---

## 4. Router Design

```python
# backend/routers/bond.py
# Prefix: /api/v1/bonds

GET  /                              — List my bonds in a simulation (?simulation_id=)
GET  /{bond_id}                     — Get bond detail (includes recent whispers)
POST /track-attention               — Track agent view (called from frontend)
GET  /recognition-candidates        — Check for agents ready for recognition whisper
POST /form                          — Accept bond with agent
GET  /{bond_id}/whispers            — Get whispers (paginated)
POST /{bond_id}/whispers/{id}/read  — Mark whisper as read
POST /{bond_id}/whispers/{id}/acted — Mark whisper as acted upon

# Public endpoint for bond existence (not whisper content)
GET  /api/v1/public/bonds           — List bonds for a simulation (public)
```

### Auth Pattern
- All endpoints require authentication + simulation membership
- Use `require_simulation_member()` dependency
- Bond operations scoped to the authenticated user's own bonds
- Platform admin bypass via `get_effective_supabase` (standard pattern)

---

## 5. Frontend Integration Points

### Where Attention Tracking Fires
- `VelgAgentDetailPanel.ts` (or equivalent agent detail view) — when user opens an agent's detail page, fire `track-attention` API call
- Debounce: max 1 call per agent per 5 minutes (don't spam on rapid navigation)

### Where Whisper Feed Lives
- New component in simulation view — a collapsible side panel or dedicated tab
- Should be visible from the simulation dashboard without navigating to individual agents
- Design: card-based feed, newest first, with agent avatar and name
- Read tracking: mark as read when scrolled into viewport (IntersectionObserver)

### Where Bond Panel Lives
- Simulation settings or overview page — shows 5 bond slots, current agents, mood indicators
- Quick-glance: agent name, avatar, mood color indicator, whisper count badge

### Component Naming Convention
- `VelgBondPanel.ts` — bond overview
- `VelgWhisperFeed.ts` — whisper stream
- `VelgWhisperCard.ts` — individual whisper
- `VelgBondFormation.ts` — recognition + acceptance flow
- `VelgBondFarewell.ts` — farewell ceremony

### Design Tokens
- Use existing tier 1/2 semantic tokens
- Whisper cards: `var(--color-surface-elevated)` background
- Mood indicators: existing `var(--color-success)` / `var(--color-warning)` / `var(--color-danger)` for happy/stressed/critical
- MUST run `velg-frontend-design` skill before writing component CSS (per CLAUDE.md)
- MUST use `msg()` for all user-facing strings (i18n mandatory)

---

## 6. Integration with Existing Heartbeat

The heartbeat in `heartbeat_service.py` runs phases sequentially. Add whisper generation as a new phase:

```python
# Existing phases (approximate):
# 1. decay_needs
# 2. select_activities
# 3. generate_autonomous_events
# 4. age_events
# 5. update_zone_stability
# NEW: 6. generate_bond_whispers

async def generate_bond_whispers(simulation_id: UUID, supabase):
    """Generate whispers for all bonded agents in this simulation."""
    # 1. Get all active bonds for this simulation
    # 2. For each bond, evaluate salience
    # 3. Generate whispers for salient bonds
    # 4. Store whispers
```

---

## 7. Key Codebase Patterns to Follow

### Service Pattern
- Extend `BaseService` unless justified
- All services in `backend/services/`
- Business logic ONLY in services, never in routers
- Use `maybe_single_data()` from `backend/utils/db.py` for single-row queries
- Use `get_effective_supabase` for DB access

### Pydantic Models
- Request models: `BondFormRequest`, `AttentionTrackRequest`
- Response models: `BondResponse`, `WhisperResponse`, `BondDetailResponse`
- All in `backend/models/bond.py`
- `SuccessResponse[BondResponse]`, `PaginatedResponse[WhisperResponse]`

### Testing Pattern
- Tests in `backend/tests/test_bond_service.py`, `backend/tests/test_bond_router.py`
- Use existing test fixtures (test users, test simulations, test agents)
- 391 tests currently passing — don't break them
- Run `ruff` + `tsc` after every change

### Audit Logging
- All mutations need audit logging (per CLAUDE.md)
- Use existing audit pattern from other services

---

## 8. What NOT to Do

- Do NOT add a visible friendship meter/number — bond depth is inferred from whisper intimacy
- Do NOT create decay mechanics for absence — ethical design commitment
- Do NOT use push notifications that guilt-trip — agents wait patiently
- Do NOT add `response_model=` to FastAPI decorators — return type annotations only
- Do NOT add columns to `agents` table without refreshing `active_agents` view
- Do NOT bypass RLS — use `get_effective_supabase`
- Do NOT use `get_supabase` directly in routers
- Do NOT use bare function calls in RLS policies — wrap in `(SELECT ...)`
- Do NOT use `maybe_single().execute()` directly — use `maybe_single_data()`
- Do NOT hardcode colors — use design tokens
- Do NOT skip `msg()` for user-facing strings

---

## 9. Existing System Deep Dive References

If you need to understand how existing systems work before integrating:

- **Agent needs**: Read `backend/services/agent_needs_service.py` + migration that creates `agent_needs`
- **Mood/moodlets**: Read `backend/services/agent_mood_service.py` + `agent_moodlet_service.py`
- **Heartbeat**: Read `backend/services/heartbeat_service.py` — understand the phase pipeline
- **Autonomous events**: Read `backend/services/autonomous_event_service.py` — especially the LLM generation pattern
- **Existing AI generation**: Read `backend/services/ai/` directory for OpenRouter integration patterns
- **Achievement system**: Read `backend/services/achievement_service.py` for an example of a system that tracks player actions across multiple game systems
- **Frontend components**: Read `frontend/src/components/simulation/` for existing simulation UI patterns

---

## 10. Suggested Implementation Order (Detailed)

### Step 1: Database Migration
- Create `agent_bonds`, `bond_whispers`, `bond_memories` tables
- RLS policies
- Indexes on bond_id, user_id, simulation_id, created_at

### Step 2: Pydantic Models
- `backend/models/bond.py` — all request/response models

### Step 3: Bond Service (CRUD)
- Formation flow: attention tracking → recognition → bond creation
- Depth progression logic
- Strain detection
- Farewell handling

### Step 4: Whisper Template Service
- Hand-authored fallback templates for each whisper type
- Slot-filling: agent_name, zone_name, mood_descriptor, relationship_name
- At least 5 templates per whisper type = 25 templates minimum

### Step 5: Whisper Generation Service
- LLM pipeline (OpenRouter, Tier 3)
- Salience filter
- Quality control (coherence + novelty)
- Bilingual generation (DE + EN)

### Step 6: Router
- All endpoints from section 4
- Auth + membership validation
- Pagination for whispers

### Step 7: Heartbeat Integration
- Add whisper generation phase to heartbeat pipeline
- Only generate for simulations with active bonds

### Step 8: Frontend — Bond Panel + Whisper Feed
- Invoke `velg-frontend-design` skill first
- VelgBondPanel, VelgWhisperFeed, VelgWhisperCard
- Attention tracking from agent detail views

### Step 9: Frontend — Bond Formation
- Recognition whisper display
- Bond offer acceptance UI

### Step 10: Bond Memory System
- Track player actions relevant to bonded agents
- Pattern detection for Reflection Whispers
- Depth 4+ reflection generation

### Step 11: Testing
- Unit tests for bond service, whisper service
- Integration tests for heartbeat → whisper pipeline
- Frontend component tests
