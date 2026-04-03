# Pydantic Response Typing — Vollständige Inventur & Schrittplan

> Stand: 2026-04-03
> Erledigt: Phase 1 Dungeon (dda61c6) + Phase 2 MessageResponse/DeleteResponse (bf44107) + FAST002 Annotated (5e1557f) + connections.py PoC (5e1557f) + **Schritt 1 Quick-Win-Router (47 Endpoints, 9 Router)** + **Schritt 2 (165 Endpoints, 14 Router, 9 neue Models)** + **Schritt 3 Forge (38 Endpoints, 10 neue Models)** + **Schritt 4 Admin (27 Endpoints, 16 neue Models)** + **Schritt 5 Social Suite (39 Endpoints, 4 Router, 8 neue Models)**
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

## Schritt 2: Router mit 1-3 einfachen Lücken (14 Router) ✅

Wenige untyped Endpoints + restliche typed konvertieren.

### buildings.py (11 total, 5 untyped) ✅

- [x] `GET /{id}/agents` → `list[BuildingAgentResponse]` — NEW
- [x] `POST /{id}/assign-agent` → `BuildingAgentResponse` — shares NEW
- [x] `GET /{id}/profession-requirements` → `list[ProfessionRequirementResponse]` — NEW
- [x] `POST /{id}/profession-requirements` → `ProfessionRequirementResponse` — shares NEW
- [x] `GET /by-zone/{zone_id}` → `list[BuildingResponse]` — EXISTS
- [x] 6 weitere TYPED Endpoints → response_model= droppen

### events.py (15 total, 5 untyped) ✅

- [x] `GET /{id}/reactions` → `list[ReactionResponse]` — NEW
- [x] `POST /{id}/reactions` → `ReactionResponse` — shares NEW
- [x] `DELETE /{id}/reactions/{rid}` → `MessageResponse` — EXISTS
- [x] `GET /{id}/zone-links` → `list[EventZoneLinkResponse]` — NEW
- [x] `POST /{id}/generate-reactions` → `list[dict]` (AI output — ASSESS)
- [x] 10 weitere TYPED Endpoints → response_model= droppen

### agents.py (7 total, 2 untyped) ✅

- [x] `GET /{id}/reactions` → `list[ReactionResponse]` — shares from events
- [x] `DELETE /{id}/reactions/{rid}` → `MessageResponse` — EXISTS
- [x] 5 weitere TYPED Endpoints → response_model= droppen

### campaigns.py (9 total, 2 untyped) ✅

- [x] `GET /{id}/events` → `list[CampaignEventResponse]` — NEW
- [x] `POST /{id}/events` → `CampaignEventResponse` — shares NEW
- [x] 7 weitere TYPED Endpoints → response_model= droppen

### prompt_templates.py (6 total, 1 untyped) ✅

- [x] `POST /test` → `PromptTestResponse` — NEW
- [x] 5 weitere TYPED Endpoints → response_model= droppen

### cipher.py (3 total, 1 untyped) ✅

- [x] `POST /{post_id}/cipher` → `CipherSetResponse` — NEW
- [x] 2 weitere TYPED Endpoints → response_model= droppen

### operatives.py (8 total, 1 untyped) ✅

- [x] `POST /fortify-zone` → `dict` (ASSESS — polymorphic RPC shape)
- [x] 7 weitere TYPED Endpoints → response_model= droppen

### forge_access.py (5 total, 1 untyped) ✅

- [x] `POST /{request_id}/review` → `ForgeAccessReviewResponse` — NEW
- [x] 4 weitere TYPED Endpoints → response_model= droppen

### social_media.py (6 total, 1 untyped) ✅

- [x] `POST /sync` → `SocialSyncResponse` — NEW
- [x] 5 weitere TYPED Endpoints → response_model= droppen

### public.py (67 total, 1 untyped) ✅

- [x] `GET /bleed-gazette` → `list[GazetteEntry]` — EXISTS
- [x] 66 weitere TYPED Endpoints → response_model= droppen

### Rein mechanische Router (4 weitere) ✅

- [x] **echoes.py** (5 total) — alle TYPED
- [x] **resonances.py** (9 total) — alle TYPED
- [x] **embassies.py** (8 total) — alle TYPED
- [x] **locations.py** (11 total) — alle TYPED

**Summe: ~165 Endpoints, 9 neue Models**

---

## Schritt 3: Forge — Größter Router (38 total, 26 untyped) ✅

### Draft CRUD (3 Endpoints)

- [x] `POST /drafts` → `ForgeDraft` — EXISTS
- [x] `GET /drafts/{id}` → `ForgeDraft` — EXISTS
- [x] `PATCH /drafts/{id}` → `ForgeDraft` — EXISTS

### Draft AI Generation (4 Endpoints)

- [x] `POST /drafts/{id}/research` → `dict` (ASSESS — polymorphic AI research output)
- [x] `POST /drafts/{id}/generate/{chunk}` → `dict` (ASSESS — polymorphic AI chunk)
- [x] `POST /drafts/{id}/generate-entity/{type}` → `dict` (ASSESS — polymorphic AI entity)
- [x] `POST /drafts/{id}/generate-theme` → `ForgeThemeOutput` — EXISTS

### Ignition (1 Endpoint)

- [x] `POST /drafts/{id}/ignite` → `IgnitionResponse` — NEW

### Wallet & BYOK (7 Endpoints)

- [x] `GET /wallet` → `WalletSummary` — NEW (UserWallet was wrong — service returns RPC shape)
- [x] `PUT /wallet/keys` → `MessageResponse` — EXISTS (service always returns {message: str})
- [x] `GET /admin/byok-setting` → `BYOKSystemSettings` — NEW
- [x] `PUT /admin/byok-setting` → shares `BYOKSystemSettings`
- [x] `PUT /admin/byok-access-policy` → shares `BYOKSystemSettings`
- [x] `PUT /admin/user-byok-bypass/{uid}` → `BYOKUserOverride` — NEW
- [x] `PUT /admin/user-byok-allowed/{uid}` → shares `BYOKUserOverride`

### Purchases — Feature Store (5 Endpoints, 2 shared Models)

- [x] `POST /{sim}/dossier` → `PurchaseConfirmation` — NEW
- [x] `POST /{sim}/dossier/evolve` → `DossierEvolveResponse` — NEW
- [x] `POST /{sim}/recruit` → shares `PurchaseConfirmation`
- [x] `POST /{sim}/chronicle` → shares `PurchaseConfirmation`
- [x] `POST /{sim}/chronicle/hires` → shares `PurchaseConfirmation`

### Purchases — Darkroom (2 Endpoints)

- [x] `POST /{sim}/darkroom` → `DarkroomPassResponse` — NEW
- [x] `POST /{sim}/darkroom/regenerate/{t}/{id}` → `DarkroomRegenResponse` — NEW

### Admin Operations (4 Endpoints)

- [x] `GET /admin/stats` → `ForgeAdminStats` — NEW
- [x] `DELETE /admin/purge` → `PurgeResult` — NEW
- [x] `PUT /admin/bundles/{id}` → `TokenBundle` — EXISTS
- [x] `POST /admin/grant` → `PurchaseReceipt` — EXISTS

### Bereits TYPED (9 Endpoints + 2 already done)

- [x] 9 weitere TYPED Endpoints → response_model= droppen + return type + SuccessResponse()
- [x] 2 Endpoints already had return type annotations (DELETE /drafts, POST /admin/regenerate-images)

**Summe: 38 Endpoints, 10 neue Models (WalletSummary, IgnitionResponse, PurchaseConfirmation, DarkroomPassResponse, DarkroomRegenResponse, DossierEvolveResponse, ForgeAdminStats, PurgeResult, BYOKSystemSettings, BYOKUserOverride)**

### ASSESS-Entscheidungen (Schritt 3)

- `POST /drafts/{id}/research` → `dict` (AI research output, polymorphic shape per seed prompt)
- `POST /drafts/{id}/generate/{chunk}` → `dict` (AI chunk, varies by geography/agents/buildings)
- `POST /drafts/{id}/generate-entity/{type}` → `dict` (AI entity, varies by agents/buildings)

---

## Schritt 4: Admin — Zweitgrößter Router (27 total, 23 untyped) ✅

### Environment & Settings (3 Endpoints) ✅

- [x] `GET /environment` → `EnvironmentResponse` — NEW
- [x] `GET /settings` → `list[PlatformSettingResponse]` — NEW
- [x] `PUT /settings/{key}` → `PlatformSettingResponse` — shares NEW

### User Management (6 Endpoints) ✅

- [x] `GET /users` → `AdminUserListResponse` — NEW
- [x] `GET /users/{uid}` → `AdminUserDetailResponse` — NEW (extra="allow" for RPC passthrough)
- [x] `POST /users/{uid}/memberships` → `AdminMembershipResponse` — NEW
- [x] `PUT /users/{uid}/memberships/{sim}` → shares `AdminMembershipResponse`
- [x] `DELETE /users/{uid}/memberships/{sim}` → shares `AdminMembershipResponse`
- [x] `PUT /users/{uid}/wallet` → `AdminWalletResponse` — NEW

### Cleanup (3 Endpoints) ✅

- [x] `GET /cleanup/stats` → `CleanupStats` — EXISTS (removed .model_dump())
- [x] `POST /cleanup/preview` → `CleanupPreviewResult` — EXISTS (removed .model_dump())
- [x] `POST /cleanup/execute` → `CleanupExecuteResult` — EXISTS (removed .model_dump())

### Simulation Management (4 Endpoints) ✅

- [x] `GET /simulations` → `PaginatedResponse[AdminSimulationListItem]` — NEW (not in original plan)
- [x] `GET /simulations/deleted` → `PaginatedResponse[AdminSimulationListItem]` — shares NEW
- [x] `POST /simulations/{sim}/restore` → `SimulationResponse` — EXISTS (ASSESSED: full row returned)
- [x] `DELETE /simulations/{sim}` → `dict` — SKIP (polymorphe hard/soft-delete)

### Health Effects (2 Endpoints) ✅

- [x] `GET /health-effects` → `HealthEffectsDashboard` — NEW (nested HealthEffectsSimEntry)
- [x] `PUT /health-effects/simulations/{sim}` → `HealthEffectsToggleResponse` — NEW

### Dungeon Config (5 Endpoints) ✅

- [x] `GET /dungeon-config/global` → `DungeonGlobalConfigResponse` — NEW (Pydantic mirror of TypedDict)
- [x] `PUT /dungeon-config/global` → shares `DungeonGlobalConfigResponse`
- [x] `GET /dungeon-override` → `list[DungeonOverrideListEntry]` — NEW
- [x] `GET /dungeon-override/simulations/{sim}` → `DungeonOverrideResponse` — NEW
- [x] `PUT /dungeon-override/simulations/{sim}` → shares `DungeonOverrideResponse`

### Special Ops (3 Endpoints) ✅

- [x] `POST /impersonate` → `ImpersonateResponse` — NEW
- [x] `GET /ai-usage/stats` → `AIUsageStatsResponse` — NEW (explicit fields from RPC migration 169)
- [x] `POST /dungeon-showcase/generate-image` → `ShowcaseImageResponse` — NEW

### Bereits TYPED (1 Endpoint) ✅

- [x] `DELETE /users/{uid}` → already had return type, no response_model= to drop

**Summe: 27 Endpoints, 16 neue Models (EnvironmentResponse, PlatformSettingResponse, AdminUserListResponse, AdminUserDetailResponse, AdminMembershipResponse, AdminWalletResponse, AdminSimulationListItem, HealthEffectsSimEntry, HealthEffectsDashboard, HealthEffectsToggleResponse, DungeonGlobalConfigResponse, DungeonOverrideListEntry, DungeonOverrideResponse, ImpersonateResponse, AIUsageStatsResponse, ShowcaseImageResponse)**

---

## Schritt 5: Social Suite (4 Router) ✅

### social_trends.py (10 total, 7 untyped) ✅

- [x] `POST /fetch` → `SuccessResponse[list[SocialTrendResponse]]` — VERIFIED, SocialTrendResponse matches DB shape
- [x] `POST /transform` → `TrendTransformResponse` — NEW (trend_id, original_title, transformation: dict)
- [x] `POST /integrate` → `SuccessResponse[dict]` — ASSESSED: raw event dict from EventService.create
- [x] `POST /workflow` → `TrendWorkflowResponse` — NEW (fetched, stored, trends: list[SocialTrendResponse])
- [x] `POST /transform-article` → `ArticleTransformResponse` — NEW (original_title, transformation: dict)
- [x] `POST /integrate-article` → `ArticleIntegrateResponse` — NEW (event: dict, reactions_count, reactions)
- [x] `POST /batch-integrate` → `BatchIntegrateResponse` — NEW (events, errors, reactions_generated_for, reactions_count)
- [x] `POST /browse` + `POST /batch-transform` → `SuccessResponse[list[dict]]` — ASSESSED: ephemeral external API / AI output
- [x] `GET ""` → `PaginatedResponse[SocialTrendResponse]` — response_model= dropped

### social_stories.py (9 total, 1 untyped) ✅

- [x] `GET /settings` → `SuccessResponse[dict[str, str]]` — flat key→value map from get_pipeline_settings()
- [x] 8 weitere TYPED → response_model= dropped, return SuccessResponse()/PaginatedResponse()

### bluesky.py (8 total, 2 untyped) ✅

- [x] `GET /settings` → `SuccessResponse[dict[str, PipelineSettingValue]]` — NEW PipelineSettingValue(value, description)
- [x] `GET /status` → `BlueskyStatusResponse` — NEW (configured, authenticated, handle, pds_url)
- [x] 6 weitere TYPED → response_model= dropped

### instagram.py (12 total, 2 untyped) ✅

- [x] `GET /settings` → `SuccessResponse[dict[str, PipelineSettingValue]]` — shares PipelineSettingValue
- [x] `GET /status` → `InstagramStatusResponse` — NEW (configured, authenticated, ig_user_id)
- [x] 10 weitere TYPED → response_model= dropped

### ASSESS-Entscheidungen (Schritt 5)

- `POST /integrate` → `dict` (raw event from EventService.create — full table row, not yet Pydantic-validated in service layer)
- `POST /browse` → `list[dict]` (ephemeral articles from Guardian/NewsAPI — shape varies per source)
- `POST /batch-transform` → `list[dict]` (each item contains AI transformation output — polymorphic)

**Summe: 39 Endpoints, 8 neue Models (TrendTransformResponse, TrendWorkflowResponse, ArticleTransformResponse, ArticleIntegrateResponse, BatchIntegrateResponse, PipelineSettingValue, BlueskyStatusResponse, InstagramStatusResponse)**

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
