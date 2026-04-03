# Pydantic Response Typing — Vollständige Inventur & Schrittplan

> Stand: 2026-04-03
> Erledigt: Phase 1 Dungeon (dda61c6) + Phase 2 MessageResponse/DeleteResponse (bf44107) + FAST002 Annotated (5e1557f) + connections.py PoC (5e1557f) + **Schritt 1 Quick-Win-Router (47 Endpoints, 9 Router)**
> Scope: **463 Endpoints** across 46 Router-Dateien — ALLE auf einmal

---

## Architektur-Entscheidungen

### A1: `response_model=` eliminieren — Return-Type als Single Source of Truth

```python
# VORHER (redundant)
@router.get("/wallet", response_model=SuccessResponse[UserWallet])
async def get_wallet(...) -> dict:
    return {"success": True, "data": data}

# NACHHER (single source of truth)
@router.get("/wallet")
async def get_wallet(...) -> SuccessResponse[UserWallet]:
    return SuccessResponse(data=data)
```

### A2: Ruff FAST-Regeln aktivieren

`pyproject.toml` → `select` um `"FAST"` erweitern.

### A3: Handgeschriebene Models, keine Magic

- Kein TypedDict, kein response_model_exclude, kein Middleware auto-wrapping
- Jedes Model explizit in `backend/models/<domain>.py`

### A4: Pro-Router-Regel

**Wenn wir einen Router anfassen, werden ALLE Endpoints in dem Router konvertiert:**
1. `response_model=` entfernen
2. Return-Type-Annotation setzen (`-> SuccessResponse[T]` / `-> PaginatedResponse[T]`)
3. Return-Statement: `SuccessResponse(data=...)` statt dict
4. Untyped `[dict]`/`[list]` → richtiges Model anwenden oder erstellen

### A5: Service-Layer Typing — TypeAdapter + model_validate

Services returnen Pydantic-Instanzen, nicht dicts. Volle Validierungskette:

```
DB (dict) → Service (TypeAdapter/model_validate → Model) → Router (SuccessResponse(data=model)) → Client
```

Für einzelne Objekte:
```python
async def get_item(self, supabase, item_id) -> ItemResponse:
    row = await self._fetch(supabase, item_id)
    return ItemResponse.model_validate(row)
```

Für Listen — `TypeAdapter` einmal auf Klassenebene erstellen:
```python
class SomeService:
    _items_adapter = TypeAdapter(list[ItemResponse])

    async def get_items(self, supabase) -> list[ItemResponse]:
        rows = await self._fetch(supabase)
        return self._items_adapter.validate_python(rows)
```

Pro Schritt werden Router UND zugehörige Service-Methoden gemeinsam refactored.

### A6: Konventionen

- Response-Models enden auf `Response` (z.B. `DarkroomRegenResponse`)
- Shared Models für identische Shapes (z.B. `PurchaseConfirmation`)
- ASSESS-Endpoints: AI-Output verifizieren, ggf. als `dict` belassen
- Lint-Pipeline (`ruff` + `tsc`) + Tests nach jedem Schritt

### A7: Praktische Gotchas (aus connections.py PoC)

1. **Audit-Logging**: Wenn Service Model returnt, ändert sich Router von `result.get("id")` → `result.id`
2. **Test-Mocks**: Service-Mocks müssen Model-Instanzen returnen, nicht dicts.
   - `MOCK_DATA = SomeResponse.model_validate({...})` statt `MOCK_DATA = {...}`
   - `{**MOCK, "field": new}` → `MOCK.model_copy(update={"field": new})`
3. **TypeAdapter + `from __future__ import annotations`**: TypeAdapter-Expression ist KEIN Annotation → evaluiert sofort. Kein Konflikt.
4. **BaseService-Pattern**: Viele Services erben von BaseService (CRUD). ConnectionService ist Standalone.
   BaseService-Subclasses haben `get()`, `list()`, `create()`, `update()` — diese returnen `dict`.
   Bei der Konvertierung prüfen ob BaseService selbst refactored werden muss oder ob override pro Service reicht.
5. **FAST002 Auto-Fix Workflow**: `ruff --fix --unsafe-fixes --select FAST002` fixiert ~95%.
   Verbleibende: Depends-Params die nach optionalen Query-Params stehen → manuell reordern.
6. **Import-Sortierung**: Nach FAST002-Fix immer `ruff --fix` nochmal für isort.

---

## Legende

- `[x]` = erledigt
- `[ ]` = offen
- `EXISTS` = Model vorhanden, nur response_model + return anpassen
- `NEW` = neues Model muss erstellt werden
- `SKIP` = bewusst als dict belassen
- `TYPED` = bereits typisiert, nur response_model= droppen + return ändern
- Zahl in Klammer = Gesamtzahl Endpoints im Router (typed + untyped)

---

## Schritt 0: Infrastruktur ✅ (5e1557f)

- [x] Ruff FAST-Regeln in `pyproject.toml` aktivieren
- [x] FAST002: 1335 Depends → Annotated across 48 Router-Dateien
- [x] connections.py: Full-Stack Proof-of-Concept (Router + Service + Tests)

---

## Schritt 1: Quick-Win-Router — Nur `response_model=` droppen + existierende Models (10 Router) ✅

Diese Router haben KEINE untyped Endpoints (oder nur 1-2 triviale).
Rein mechanische Konvertierung: `response_model=` → Return-Type.

- [x] **game_mechanics.py** (8 total) — alle TYPED
- [x] **relationships.py** (5 total) — alle TYPED
- [x] **settings.py** (6 total) — alle TYPED
- [x] **bot_players.py** (5 total) — alle TYPED
- [x] **agent_professions.py** (4 total) — alle TYPED
- [x] **connections.py** (4 total) — alle TYPED (PoC in 5e1557f)
- [x] **members.py** (4 total) — alle TYPED
- [x] **style_references.py** (3 total) — alle TYPED
- [x] **invitations.py** (4 total) — alle TYPED
- [x] **epoch_invitations.py** (4 total) — alle TYPED

**Summe: 47 Endpoints, 0 neue Models**

---

## Schritt 2: Router mit 1-3 einfachen Lücken (14 Router)

Wenige untyped Endpoints + restliche typed konvertieren.

### buildings.py (11 total, 5 untyped)

- [ ] L147 `GET /{id}/agents` → `list[BuildingAgentResponse]` — NEW
- [ ] L160 `POST /{id}/assign-agent` → `BuildingAgentResponse` — shares NEW
- [ ] L189 `GET /{id}/profession-requirements` → `list[ProfessionRequirementResponse]` — NEW
- [ ] L202 `POST /{id}/profession-requirements` → `ProfessionRequirementResponse` — shares NEW
- [ ] L227 `GET /by-zone/{zone_id}` → `list[BuildingResponse]` — EXISTS
- [ ] 6 weitere TYPED Endpoints → response_model= droppen

### events.py (15 total, 5 untyped)

- [ ] L140 `GET /{id}/reactions` → `list[ReactionResponse]` — NEW
- [ ] L153 `POST /{id}/reactions` → `ReactionResponse` — shares NEW
- [ ] L181 `DELETE /{id}/reactions/{rid}` → `MessageResponse` — EXISTS
- [ ] L302 `GET /{id}/zone-links` → `list[EventZoneLinkResponse]` — NEW
- [ ] L196 `POST /{id}/generate-reactions` → ASSESS (AI output)
- [ ] 10 weitere TYPED Endpoints → response_model= droppen

### agents.py (7 total, 2 untyped)

- [ ] L149 `GET /{id}/reactions` → `list[ReactionResponse]` — shares from events
- [ ] L162 `DELETE /{id}/reactions/{rid}` → `MessageResponse` — EXISTS
- [ ] 5 weitere TYPED Endpoints → response_model= droppen

### campaigns.py (9 total, 2 untyped)

- [ ] L129 `GET /{id}/events` → `list[CampaignEventResponse]` — NEW
- [ ] L142 `POST /{id}/events` → `CampaignEventResponse` — shares NEW
- [ ] 7 weitere TYPED Endpoints → response_model= droppen

### prompt_templates.py (6 total, 1 untyped)

- [ ] L118 `POST /test` → `PromptTestResponse` — NEW
- [ ] 5 weitere TYPED Endpoints → response_model= droppen

### cipher.py (3 total, 1 untyped)

- [ ] L121 `POST /{post_id}/cipher` → `CipherResponse` — NEW
- [ ] 2 weitere TYPED Endpoints → response_model= droppen

### operatives.py (8 total, 1 untyped)

- [ ] L123 `POST /fortify-zone` → ASSESS shape → NEW or EXISTS
- [ ] 7 weitere TYPED Endpoints → response_model= droppen

### forge_access.py (5 total, 1 untyped)

- [ ] L80 `POST /{request_id}/review` → ASSESS shape → NEW
- [ ] 4 weitere TYPED Endpoints → response_model= droppen

### social_media.py (6 total, 1 untyped)

- [ ] L60 `POST /sync` → `SocialSyncResponse` — NEW
- [ ] 5 weitere TYPED Endpoints → response_model= droppen

### public.py (67 total, 1 untyped)

- [ ] L751 `GET /bleed-gazette` → `list[GazetteEntry]` — EXISTS
- [ ] 66 weitere TYPED Endpoints → response_model= droppen

### Rein mechanische Router (4 weitere)

- [ ] **echoes.py** (5 total) — alle TYPED
- [ ] **resonances.py** (9 total) — alle TYPED
- [ ] **embassies.py** (8 total) — alle TYPED
- [ ] **locations.py** (11 total) — alle TYPED

**Summe: ~165 Endpoints, ~8 neue Models**

---

## Schritt 3: Forge — Größter Router (38 total, 26 untyped)

### Draft CRUD (3 Endpoints)

- [ ] L82 `POST /drafts` → `ForgeDraft` — EXISTS
- [ ] L99 `GET /drafts/{id}` → `ForgeDraft` — EXISTS
- [ ] L110 `PATCH /drafts/{id}` → `ForgeDraft` — EXISTS

### Draft AI Generation (4 Endpoints)

- [ ] L160 `POST /drafts/{id}/research` → ASSESS (AI research output)
- [ ] L178 `POST /drafts/{id}/generate/{chunk}` → ASSESS (AI chunk)
- [ ] L198 `POST /drafts/{id}/generate-entity/{type}` → ASSESS (AI entity)
- [ ] L220 `POST /drafts/{id}/generate-theme` → `ForgeThemeOutput` — EXISTS

### Ignition (1 Endpoint)

- [ ] L238 `POST /drafts/{id}/ignite` → `IgnitionResponse` — NEW

### Wallet & BYOK (7 Endpoints)

- [ ] L284 `GET /wallet` → `UserWallet` — EXISTS
- [ ] L329 `PUT /wallet/keys` → `BYOKUpdateResponse` — NEW (verify shape)
- [ ] L778 `GET /admin/byok-setting` → `BYOKSystemSettings` — NEW
- [ ] L788 `PUT /admin/byok-setting` → shares `BYOKSystemSettings`
- [ ] L803 `PUT /admin/byok-access-policy` → shares `BYOKSystemSettings`
- [ ] L818 `PUT /admin/user-byok-bypass/{uid}` → `BYOKUserOverride` — NEW
- [ ] L834 `PUT /admin/user-byok-allowed/{uid}` → shares `BYOKUserOverride`

### Purchases — Feature Store (4 Endpoints, 1 shared Model)

- [ ] L478 `POST /{sim}/dossier` → `PurchaseConfirmation` — NEW
- [ ] L557 `POST /{sim}/recruit` → shares `PurchaseConfirmation`
- [ ] L595 `POST /{sim}/chronicle` → shares `PurchaseConfirmation`
- [ ] L626 `POST /{sim}/chronicle/hires` → shares `PurchaseConfirmation`

### Purchases — Darkroom (2 Endpoints)

- [ ] L385 `POST /{sim}/darkroom` → `DarkroomPassResponse` — NEW
- [ ] L417 `POST /{sim}/darkroom/regenerate/{t}/{id}` → `DarkroomRegenResponse` — NEW

### Admin Operations (7 Endpoints)

- [ ] L676 `GET /admin/stats` → `ForgeAdminStats` — NEW (verify shape)
- [ ] L686 `DELETE /admin/purge` → `PurgeResult` — NEW
- [ ] L723 `PUT /admin/bundles/{id}` → `TokenBundle` — EXISTS
- [ ] L761 `POST /admin/grant` → `PurchaseReceipt` — EXISTS

### Bereits TYPED (12 Endpoints)

- [ ] 12 weitere TYPED Endpoints → response_model= droppen

**Summe: 38 Endpoints, ~10 neue Models**

---

## Schritt 4: Admin — Zweitgrößter Router (27 total, 23 untyped)

### Environment & Settings (3 Endpoints)

- [ ] L107 `GET /environment` → `EnvironmentResponse` — NEW
- [ ] L118 `GET /settings` → `list[PlatformSettingResponse]` — NEW
- [ ] L128 `PUT /settings/{key}` → `PlatformSettingResponse` — shares NEW

### User Management (6 Endpoints)

- [ ] L169 `GET /users` → `AdminUserListResponse` — NEW
- [ ] L181 `GET /users/{uid}` → `AdminUserDetailResponse` — NEW
- [ ] L208 `POST /users/{uid}/memberships` → `AdminMembershipResponse` — NEW
- [ ] L226 `PUT /users/{uid}/memberships/{sim}` → shares `AdminMembershipResponse`
- [ ] L245 `DELETE /users/{uid}/memberships/{sim}` → shares `AdminMembershipResponse`
- [ ] L260 `PUT /users/{uid}/wallet` → `AdminWalletResponse` — NEW

### Cleanup (3 Endpoints)

- [ ] L283 `GET /cleanup/stats` → `CleanupStats` — EXISTS
- [ ] L293 `POST /cleanup/preview` → `CleanupPreviewResult` — EXISTS
- [ ] L306 `POST /cleanup/execute` → `CleanupExecuteResult` — EXISTS

### Simulation Ops (2 Endpoints)

- [ ] L368 `POST /simulations/{sim}/restore` → ASSESS: SimulationResponse?
- [ ] L382 `DELETE /simulations/{sim}` → SKIP (polymorphe hard/soft-delete)

### Health Effects (2 Endpoints)

- [ ] L407 `GET /health-effects` → `HealthEffectsDashboard` — NEW
- [ ] L417 `PUT /health-effects/simulations/{sim}` → `HealthEffectsToggleResponse` — NEW

### Dungeon Config (5 Endpoints)

- [ ] L446 `GET /dungeon-config/global` → `DungeonGlobalConfig` — NEW
- [ ] L456 `PUT /dungeon-config/global` → shares `DungeonGlobalConfig`
- [ ] L482 `GET /dungeon-override` → `list[DungeonOverrideListEntry]` — NEW
- [ ] L530 `GET /dungeon-override/simulations/{sim}` → `DungeonOverride` — NEW
- [ ] L556 `PUT /dungeon-override/simulations/{sim}` → shares `DungeonOverride`

### Special Ops (2 Endpoints)

- [ ] L591 `POST /impersonate` → `ImpersonateResponse` — NEW
- [ ] L636 `GET /ai-usage/stats` → `AIUsageStatsResponse` — NEW
- [ ] L661 `POST /dungeon-showcase/generate-image` → `ShowcaseImageResponse` — NEW

### Bereits TYPED (1 Endpoint)

- [ ] 1 weiterer TYPED Endpoint → response_model= droppen

**Summe: 27 Endpoints, ~14 neue Models**

---

## Schritt 5: Social Suite (4 Router)

### social_trends.py (10 total, 7 untyped)

- [ ] L99 `POST /fetch` → verify SocialTrendResponse
- [ ] L134 `POST /transform` → `TrendTransformResponse` — NEW
- [ ] L187 `POST /integrate` → `TrendIntegrateResponse` — NEW
- [ ] L245 `POST /workflow` → `TrendWorkflowResponse` — NEW
- [ ] L330 `POST /transform-article` → `ArticleTransformResponse` — NEW
- [ ] L377 `POST /integrate-article` → `ArticleIntegrateResponse` — NEW
- [ ] L514 `POST /batch-integrate` → `BatchIntegrateResponse` — NEW
- [ ] 3 weitere TYPED → response_model= droppen

### social_stories.py (9 total, 1 untyped)

- [ ] L277 `GET /settings` → `StorySettingsResponse` — NEW
- [ ] 8 weitere TYPED → response_model= droppen

### bluesky.py (8 total, 2 untyped)

- [ ] L222 `GET /settings` → `BlueskySettingsResponse` — NEW
- [ ] L235 `GET /status` → `BlueskyStatusResponse` — NEW
- [ ] 6 weitere TYPED → response_model= droppen

### instagram.py (12 total, 2 untyped)

- [ ] L332 `GET /settings` → `InstagramSettingsResponse` — NEW
- [ ] L369 `GET /status` → `InstagramStatusResponse` — NEW
- [ ] 10 weitere TYPED → response_model= droppen

**Summe: 39 Endpoints, ~10 neue Models**

---

## Schritt 6: Chat & Generation (2 Router)

### chat.py (11 total, 3 untyped)

- [ ] L36 `GET /conversations` → verify ConversationResponse
- [ ] L67 `GET /conversations/{id}/messages` → verify ChatMessageResponse
- [ ] L82 `POST /conversations/{id}/messages` → Union type handling
- [ ] 8 weitere TYPED → response_model= droppen

### generation.py (7 total, 7 untyped)

- [ ] L132 `POST /agent` → ASSESS (AI output)
- [ ] L169 `POST /building` → ASSESS (AI output)
- [ ] L207 `POST /portrait-description` → `PortraitDescriptionResponse` — NEW
- [ ] L243 `POST /event` → ASSESS (AI output)
- [ ] L282 `POST /relationships` → ASSESS (AI output)
- [ ] L330 `POST /lore-image` → `ImageGenerationResponse` — NEW
- [ ] L368 `POST /image` → shares `ImageGenerationResponse`

**Summe: 18 Endpoints, ~2 neue Models + ASSESS**

---

## Schritt 7: Verbleibende mechanische Router (12 Router)

Keine untyped Endpoints, nur response_model= droppen.

- [ ] **epochs.py** (31 total)
- [ ] **resonance_dungeons.py** (19 total)
- [ ] **heartbeat.py** (18 total)
- [ ] **simulations.py** (10 total)
- [ ] **news_scanner.py** (9 total)
- [ ] **agent_autonomy.py** (8 total)
- [ ] **users.py** (5 total)
- [ ] **scores.py** (5 total)
- [ ] **taxonomies.py** (5 total)
- [ ] **epoch_chat.py** (3 total)
- [ ] **zone_actions.py** (3 total)
- [ ] **chronicles.py** (3 total)
- [ ] **aptitudes.py** (3 total)
- [ ] **agent_memories.py** (2 total)

**Summe: ~134 Endpoints, 0 neue Models**

---

## Gesamtübersicht

| Schritt | Router | Endpoints | Neue Models | Schwierigkeit |
|---------|--------|-----------|-------------|---------------|
| 0. Infra | — | — | — | Trivial |
| 1. Quick-Win-Router | 10 | 47 | 0 | Mechanisch |
| 2. Kleine Lücken | 14 | 165 | ~8 | Einfach |
| 3. Forge | 1 | 38 | ~10 | Mittel |
| 4. Admin | 1 | 27 | ~14 | Mittel |
| 5. Social Suite | 4 | 39 | ~10 | Mittel |
| 6. Chat & Generation | 2 | 18 | ~2+ASSESS | Komplex |
| 7. Restliche Router | 14 | 134 | 0 | Mechanisch |
| **Gesamt** | **46** | **~468** | **~44** | — |
