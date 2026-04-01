# Resonance Dungeons — Multiplayer Roadmap

> Analysiert 2026-03-31. Vollständige Bestandsaufnahme der Multiplayer-Readiness
> und Implementierungsphasen.

## Status-Übersicht

**Single-Player:** 100% funktional, getestet, stabil.
**Multiplayer:** Datenmodell vorhanden, Logik fehlt. Keine Realtime-Sync, keine
Concurrency-Guards, keine Agent-Ownership.

---

## Bestehendes Fundament

| Komponente | Wo | Status |
|---|---|---|
| `player_ids: list[UUID]` | `DungeonInstance` (Model) | Vorhanden, bei Create mit `[user_id]` befüllt |
| `party_player_ids UUID[]` | `resonance_dungeon_runs` (DB) | Schema existiert, RLS prüft Sim-Membership |
| `started_by_id: UUID` | DB + Model | Wer den Run gestartet hat |
| `require_player` Auth-Gate | `_get_instance()` (Engine) | Alle 15 Endpoints nutzen es |
| `submitted_actions: dict[str, list]` | `CombatState` (Model) | Keyed by `user_id`, nicht `agent_id` |
| `len(submitted_actions) >= len(player_ids)` | `submit_combat_actions()` | Wartet auf alle Spieler |
| Checkpoint nach jeder Transition | `_checkpoint()` | JSONB in DB, Recovery möglich |
| Server-authoritative State | Frontend `applyState()` | Kein Optimistic Update, sauberes Pattern |
| Unique-Index: 1 aktiver Run pro (Sim, Archetype) | DB | Verhindert parallele Runs |

---

## Kritische Lücken

### 1. Race Conditions (Showstopper)

Kein `asyncio.Lock` um State-Mutationen. Zwei gleichzeitige Requests auf denselben
Run können den State korrumpieren.

**Combat-Resolution Double-Execution:**
```
Player A: POST /combat/submit → len==2 → _resolve_combat() startet
Player B: POST /combat/submit → len==2 → _resolve_combat() startet
→ Beide lesen denselben Combat-State, beide mutieren, State korrupt
```

**Timer vs. User-Submission:**
```
Timer feuert bei T=45s, Spieler submitted bei T=44.999s
→ asyncio.sleep(45) kehrt zurück, pop() gelingt
→ Spieler-Request sieht len==2, ruft auch _resolve_combat()
→ Doppelte Resolution
```

**confirm_distribution() ohne Idempotency:**
```
Beide Spieler klicken "Bestätigen" gleichzeitig
→ Beide rufen fn_finalize_dungeon_run()
→ Doppelte Finalisierung
```

### 2. Agent-Ownership fehlt

Kein `agent_player_map` — jeder Spieler kann Actions für jeden Agenten submitten.
Keine Validierung "gehört dieser Agent dir?"

```python
# AKTUELL: Keine Prüfung
instance.combat.submitted_actions[str(user_id)] = actions  # Beliebige agent_ids

# NÖTIG:
for action in submission.actions:
    if instance.agent_player_map.get(action.agent_id) != user_id:
        raise HTTPException(403, "You don't control this agent")
```

### 3. Realtime-Sync nicht vorhanden

- Kein Supabase Broadcast
- Kein WebSocket
- Kein Polling für "Partner hat submitted"
- Zweiter Spieler sieht nichts, bis er selbst eine Action macht
- Spec vermerkt explizit: "deferred — single-player works fully"

### 4. Loot-Distribution: Last-Write-Wins

Beide Spieler können dasselbe Item verschiedenen Agenten zuweisen.
`loot_assignments` ist ein einfaches Dict auf `DungeonInstance` —
letzer Schreiber gewinnt, keine Unique-Constraint.

### 5. In-Memory State Store = Single-Worker-Only

`_active_instances` ist ein Python-Dict im Prozess-Speicher.
Gunicorn mit >1 Worker = jeder Worker hat eigene Kopie.
Kein Shared-State-Mechanismus (Redis o.Ä.).

---

## Implementierungsphasen

### Phase 0: Concurrency-Absicherung

> Pflicht auch für Solo-Play (Timer-Race existiert bereits).

**Scope:**
- `asyncio.Lock` pro Run-ID um alle State-Mutationen
- Idempotency-Guard auf `_resolve_combat()` (nur wenn Phase noch `combat_planning`)
- Idempotency-Guard auf `confirm_distribution()` (nur wenn Phase noch `distributing`)
- Phase-Check vor jeder Mutation (bereits teilweise vorhanden, aber nicht atomar)

**Implementierung:**
```python
# Neues Locking-System
_instance_locks: dict[str, asyncio.Lock] = {}

def _get_lock(run_id: str) -> asyncio.Lock:
    if run_id not in _instance_locks:
        _instance_locks[run_id] = asyncio.Lock()
    return _instance_locks[run_id]

# In submit_combat_actions:
async with _get_lock(str(run_id)):
    instance = await cls._get_instance(...)
    instance.combat.submitted_actions[str(user_id)] = actions
    if len(instance.combat.submitted_actions) >= len(instance.player_ids):
        # Atomar: nur ein Request kommt hierher
        await cls._resolve_combat(admin_supabase, instance)
```

**Aufwand:** ~1 Tag
**Risiko:** Niedrig — Lock ist per-Run, nicht global

---

### Phase 1: Agent-Ownership

> Minimaler Multiplayer: Zwei Spieler können kämpfen, ohne sich gegenseitig zu stören.

**Scope:**
- Neues Feld `agent_player_map: dict[str, str]` auf `DungeonInstance`
- Zuweisung bei `create_run()` (Round-Robin oder explizite Zuordnung)
- Validation in `submit_combat_actions()`: Agent gehört diesem Spieler
- Checkpoint-Erweiterung: `agent_player_map` persistieren
- Frontend: Visuelle Trennung "Deine Agenten" vs. "Partner-Agenten"

**Offene Design-Entscheidung:**

| Zuweisung | Beschreibung | Pro | Contra |
|---|---|---|---|
| Round-Robin | Agenten werden abwechselnd verteilt | Einfach, fair | Keine Wahl |
| Host wählt | Startender Spieler teilt zu | Flexibel | Asymmetrisch |
| Draft | Abwechselndes Wählen | Am fairsten | Braucht UI + State |
| Aptitude-Match | Jeder Spieler bekommt Agenten passend zu Präferenz | Strategisch | Komplex |

**Empfehlung:** Round-Robin als MVP, Draft als Phase 3-Feature.

**Aufwand:** ~1–2 Tage

---

### Phase 2: State-Broadcast (Spielbar zu zweit)

> Zweiter Spieler sieht, was passiert, ohne selbst zu handeln.

**Scope:**
- Supabase Realtime Channel pro `run_id`
- Backend sendet Broadcast-Events nach jeder State-Transition
- Frontend subscribt bei Run-Join

**Broadcast-Events:**

| Event | Payload | Trigger |
|---|---|---|
| `state_updated` | Voller `DungeonClientState` | Nach jedem Checkpoint |
| `player_submitted` | `{user_id, agent_count}` | Nach `submit_combat_actions()` |
| `combat_resolved` | `{round_result}` | Nach `_resolve_combat()` |
| `encounter_chosen` | `{choice_id, result}` | Nach `handle_encounter_choice()` |
| `room_entered` | `{room_index, banter}` | Nach `move_to_room()` |
| `player_joined` | `{user_id, agent_ids}` | Nach `join_run()` (neu) |
| `loot_assigned` | `{loot_id, agent_id, by}` | Nach `assign_loot()` |

**Frontend-Erweiterungen:**
- "Warte auf Spieler X..." Anzeige bei Combat-Planning
- Submission-Indicators (Häkchen pro Spieler)
- Banter/Narrative wird für beide Spieler synchron angezeigt
- Polling-Fallback: `getState()` alle 5s wenn Broadcast-Verbindung instabil

**Implementierung Backend:**
```python
# Nach jedem Checkpoint:
await admin_supabase.realtime.channel(f"dungeon:{run_id}").send(
    "broadcast",
    {"event": "state_updated", "payload": client_state.model_dump()},
)
```

**Implementierung Frontend:**
```typescript
// In DungeonStateManager
const channel = supabase.channel(`dungeon:${runId}`);
channel.on('broadcast', { event: 'state_updated' }, (payload) => {
    this.applyState(payload.data as DungeonClientState);
});
channel.subscribe();
```

**Aufwand:** ~3–4 Tage

---

### Phase 3: Entscheidungs-Koordination (Kooperatives Gameplay)

> Spieler treffen gemeinsam Entscheidungen, nicht nur parallel.

**Scope:**

#### Movement-Koordination
```
Spieler A wählt Raum 5
→ Broadcast: "Spieler A schlägt Raum 5 vor"
→ Spieler B sieht: [Zustimmen] [Ablehnen] [Gegenvorschlag]
→ Bei Zustimmung: move_to_room() ausgeführt
→ Bei Ablehnung: Vorschlag verfällt, A muss neu wählen
→ Timeout 15s: Vorschlag gilt als angenommen
```

#### Encounter-Voting
```
Encounter "The Prisoner" hat 4 Choices
→ Spieler A wählt "Free the prisoner" (Spy-Check)
→ Spieler B wählt "Interrogate" (Propagandist-Check)
→ Konflikt! Tiebreaker: Wessen Agent hat höhere Aptitude für den gewählten Check?
→ Bei Gleichstand: Spieler, der zuerst submitted hat, gewinnt
```

#### Retreat-Verhandlung
```
Spieler A initiiert Retreat
→ Spieler B bekommt 10s Einspruchsfrist
→ Bei Einspruch: Voting (Mehrheit gewinnt, bei 2 Spielern = Pattsituation)
→ Pattsituation: Retreat wird nicht durchgeführt (defensive Regel — bleiben ist sicherer als gehen)
```

#### Loot-Distribution (Refactor)
```sql
-- Neue Tabelle statt Dict auf DungeonInstance
CREATE TABLE dungeon_loot_assignments (
    run_id   UUID NOT NULL REFERENCES resonance_dungeon_runs(id),
    loot_id  TEXT NOT NULL,
    agent_id UUID NOT NULL,
    assigned_by UUID NOT NULL REFERENCES auth.users(id),
    PRIMARY KEY (run_id, loot_id)  -- Ein Item = ein Agent
);
```

**Aufwand:** ~3–5 Tage

---

### Phase 4: Skalierung (Production-Grade)

> Multi-Worker, Disconnect-Handling, Robustheit.

**Scope:**

#### Redis als State Store
```python
# Statt _active_instances Dict:
async def _get_instance(cls, run_id, ...):
    # 1. Check in-memory cache (hot path)
    instance = _local_cache.get(str(run_id))
    if instance and not _is_stale(instance):
        return instance
    # 2. Fallback: Redis
    raw = await redis.get(f"dungeon:{run_id}")
    if raw:
        instance = DungeonInstance.model_validate_json(raw)
        _local_cache[str(run_id)] = instance
        return instance
    # 3. Fallback: DB checkpoint recovery
    return await cls.recover_from_checkpoint(admin_supabase, run_id)
```

#### Disconnect-Handling
| Szenario | Verhalten |
|---|---|
| Spieler schließt Tab | Timer läuft weiter, Auto-Submit bei Ablauf |
| Spieler reconnected | `getState()` liefert aktuellen State |
| Spieler disconnected >5min | Agenten werden AI-gesteuert (Auto-Actions) |
| Beide disconnected | Run pausiert nach nächstem Timer-Ablauf |

#### Rate Limiting
- Max 1 `submit_combat_actions` pro Spieler pro Runde
- Max 1 `move_to_room` pro 2 Sekunden
- Max 1 `assign_loot` pro Sekunde pro Spieler

#### Concurrency Tests
```python
# Parallele HTTP-Tests simulieren 2 Spieler
async def test_concurrent_combat_submission():
    """Both players submit simultaneously — only one resolve executes."""
    results = await asyncio.gather(
        submit_actions(player_a_token, run_id, agent_a_actions),
        submit_actions(player_b_token, run_id, agent_b_actions),
    )
    # Verify: exactly 1 resolve, no corruption
    assert combat_resolved_count == 1
```

**Aufwand:** ~3–5 Tage

---

## Offene Design-Entscheidungen

| Frage | Optionen | Spec-Vorschlag | Empfehlung |
|---|---|---|---|
| Agent-Zuweisung | Round-Robin / Host-Wahl / Draft | Nicht spezifiziert | Round-Robin für MVP |
| Movement-Authority | Consensus / Host entscheidet | Consensus (Confirm/Reject) | Consensus mit 15s Timeout |
| Encounter-Tiebreaker | Aptitude-höchster / Erster / Voting | Aptitude-basiert | Aptitude (strategisch sinnvoll) |
| Retreat-Patt | Retreat gewinnt / Bleiben gewinnt | Voting (Mehrheit) | Bleiben gewinnt (defensiv) |
| Disconnect >5min | Pause / AI übernimmt / Kick | Nicht spezifiziert | AI-Auto-Actions |
| Per-Player-Fog | Alle sehen alles / Scouting per Spieler | Alle sehen alles | Alle sehen alles (MVP) |
| Join mid-run | Erlaubt / Nur bei Start | Nicht spezifiziert | Nur bei Start (MVP) |
| Max Spieler | 2 / 3 / 4 | 2 (implizit, 4 Agenten / 2 Spieler) | 2 für MVP, 4 als Fernziel |

---

## Dependency-Graph

```
Phase 0: Concurrency (PFLICHT)
    └─ asyncio.Lock pro Run
    └─ Idempotency-Guards
    └─ Atomar: check-then-resolve

Phase 1: Ownership (braucht Phase 0)
    └─ agent_player_map
    └─ Validation in submit
    └─ Frontend: "Deine Agenten"

Phase 2: Broadcast (braucht Phase 1)
    └─ Supabase Realtime Channel
    └─ state_updated Events
    └─ "Warte auf..." UI

Phase 3: Koordination (braucht Phase 2)
    └─ Movement Consensus
    └─ Encounter Voting
    └─ Loot-Tabelle Refactor

Phase 4: Skalierung (braucht Phase 2)
    └─ Redis State Store
    └─ Disconnect Handling
    └─ Rate Limiting
    └─ Concurrency Tests
```

---

## Bestehende Patterns zum Wiederverwenden

| Pattern | Wo | Anwendbar für |
|---|---|---|
| `pg_advisory_xact_lock` | `fn_apply_dungeon_loot` (Mig. 164) | Loot-Assignment-Schutz |
| Checkpoint + Recovery | `_checkpoint()` / `recover_from_checkpoint()` | Redis-Fallback-Chain |
| `require_player` Gate | `_get_instance()` | Agent-Ownership-Validation erweitern |
| Timer + Auto-Submit | `_start_combat_timer()` | Disconnect-Handling |
| `SuccessResponse` / `PaginatedResponse` | Alle Router | Broadcast-Payload-Format |
