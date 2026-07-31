---
title: "Architecture Cleanliness — Verification & Remediation Plan"
id: architecture-cleanliness-2026-04-17
lang: de
type: analysis
status: active
date: 2026-04-17
tags: [architecture, verification, cleanliness, remediation, frontend, backend]
related:
  - full-architecture-code-design-audit-2026-04-16.md
---

# Architecture Cleanliness — Verification & Remediation Plan

**Datum**: 2026-04-17
**Scope**: 12 strukturelle Audit-Befunde (extern vorgelegt) plus 2 Eigenfunde.
**Verhältnis zum Audit vom 2026-04-16**: ergänzend, enger. Das 2026-04-16-Audit (549 Zeilen) ist breiter und deskriptiv. Dieses Dokument ist schmaler, verifiziert jede Behauptung am Code und leitet daraus einen priorisierten Umsetzungsplan ab.

---

## 1. Executive Summary

Alle 12 vorgelegten Befunde sind am Code **bestätigt**. Zusätzlich zwei nicht genannte Funde (5. externer `_generate`-Caller in `chronicle_service.py`; `_resolveSimulation` doppelter Slug-Resolve). Die Probleme clustern um drei tiefe Ursachen:

1. **Globaler impliziter Zustand** als Routing-Entscheidungsbasis (`appState.currentRole`, `appState.isAuthenticated`) statt expliziter Kontrakte.
2. **Side-effectful UI** — Datenladen, SEO, Analytics und Store-Writes im Render-Pfad.
3. **Erodierte Domänengrenzen** — `GenerationService._generate()` wird extern aufgerufen; Frontend-Monolithen mischen View/Fetching/Navigation.

Der vorgeschlagene Plan ist in 4 Wellen gegliedert. Welle 1 (P0) adressiert die Ursachen für ~70 % der schwer reproduzierbaren "manchmal leer"- und Timing-Bugs.

---

## 2. Verifikation — Befund-für-Befund

Jeder Befund wurde am aktuellen `main` gegengeprüft. Zitierte Zeilen sind am Code verifiziert. Status: ✅ bestätigt · ➕ erweitert · ❌ nicht bestätigt (keiner der Befunde).

### 2.1 Kritisch

#### F1 — Render-Pfad mit Nebenwirkungen ✅ ➕
**Ort**: `frontend/src/app-shell.ts:1054` (`_renderSimulationView`)

**Nachweis**:
- Z. 1067: `this._loadSimulationContext(resolvedId)` — fire-and-forget, mitten im Render.
- Z. 1080: `applySimulationViewSeo(sim, view)` — mutiert `<head>`.
- Z. 1084, 1088–1089: `seoService.setCanonical()` / `setTitle()`.
- Z. 1103: `seoService.setBreadcrumbs(...)`.
- Z. 1104: `analyticsService.trackPageView(...)`.

**Erweiterung (Eigenfund)**: `_loadSimulationContext` (Z. 1024) ruft intern erneut `_resolveSimulation()` auf (Z. 1025), das `simulationsApi.getBySlug()` triggert — obwohl `_enterSimulationRoute` den Slug bereits aufgelöst hat. Die Dedupe greift erst über `_lastLoadedSimulationId` **nach** dem Resolve. Ergebnis: jeder erste Render einer Sim-Route sendet den Slug-Request zweimal.

**Folge**: Render → API-Call → `appState.setTaxonomies/setSettings` → reaktive Signale feuern → potenzielle Re-Render-Loops; Race zwischen SEO-Write und Child-Component-Mount.

#### F2 — Drei konkurrierende Navigationspfade ✅
**Orte**:
- `frontend/src/app-shell.ts:778` — `_handleNavigate`: `pushState` + `_router.goto(normalized)` (kanonisch).
- `frontend/src/components/agents/AgentsView.ts:390` — `_pushEntityUrl`: nackter `window.history.pushState` ohne Router.
- `frontend/src/components/buildings/BuildingsView.ts:192` — identisches Muster.
- `frontend/src/components/landing/LandingPage.ts:1699` — `pushState` + synthetisches `dispatchEvent(new PopStateEvent('popstate'))`.

**Ausmaß**: `grep window.history.pushState` → **20 Dateien**, davon mehrere **außerhalb** von `app-shell`.

**Folge**: URL, Router-State und Component-State können divergieren. Back-Button-Verhalten nicht deterministisch.

### 2.2 Hoch

#### F3 — API-Routing an globalem UI-State ✅
**Ort**: `frontend/src/services/api/BaseApiService.ts:121–129` (`getSimulationData`)

**Nachweis**:
```ts
if (!appState.isAuthenticated.value || !appState.currentRole.value) {
  return this.getPublic(path, params);
}
return this.get(path, params);
```

`currentRole` wird aber erst in `_checkMembership()` gesetzt (`app-shell.ts:849`). Die Route-Entscheidung hängt also an einem Seiteneffekt vorheriger Routing-Phasen.

**Folge**: ein Service-Aufruf kann "zu früh" kommen (bevor Membership resolved ist) und silent auf `/public` umleiten — oder umgekehrt. Die Kopplung ist nicht am Methodennamen erkennbar.

#### F4 — Auth-Bootstrap doppelt ✅
**Orte**:
- `frontend/src/services/supabase/SupabaseAuthService.ts:125` (`_syncAppState`): setzt User, Access-Token, Architect-Status, Forge-Request-Status, GA4-Properties (Z. 186–196), Pending-Forge-Requests (Z. 198–213), Toast-Anzeige.
- `frontend/src/app-shell.ts:914` (`_fetchOnboardingState`): ruft `usersApi.getMe()`, setzt `onboarding_completed`, **setzt `setPlatformAdmin` erneut** (Z. 921), GA4-Properties **erneut** (Z. 931–935), Pending-Forge-Requests **erneut** (Z. 937–938).

**Folge**: Race-Fenster zwischen `/me`- und `forgeApi.getWallet()`-Response. Das GA4-`user_type` kann innerhalb weniger ms wechseln. Doppelte Logikpflege: jede neue Property muss an **zwei** Stellen gepflegt werden.

#### F5 — Still geschluckte Fehler ✅ ➕
**Orte**:
- `frontend/src/services/ForgeStateManager.ts:583` (`catch { return null; }`) — Wallet.
- `frontend/src/services/ForgeStateManager.ts:597, 631` (`catch {}`) — Bundles, Purchase-History.
- `frontend/src/components/platform/SimulationsDashboard.ts:1518, 1536, 1549, 1561, 1580` — fünf stille Fehler in einer Datei.

**Erweiterung (Gesamt-Frontend)**: `grep -c "catch\s*\{"` → **243 Vorkommen in 91 Dateien**. Nicht alle sind leer; der systemische Umfang ist aber signifikant. Symptom-Beschreibung "non-critical" / "Best-effort" ist kodifizierter Verzicht auf Diagnostik.

**Folge**: "manchmal leer"-Bilder in Produktion (Widgets ohne Daten, ohne Retry, ohne Telemetrie).

#### F6 — Erodierte Service-Kapselung (`GenerationService._generate`) ✅ ➕
**Ort intern**: `backend/services/generation_service.py:767` (`_generate`, Unterstrich-Präfix markiert als intern).

**Externe Aufrufer bestätigt**:
- `backend/services/agent_memory_service.py:126`
- `backend/services/agent_memory_service.py:251`
- `backend/services/sitrep_service.py:109`
- `backend/services/instagram_content_service.py:754`

**Erweiterung (Eigenfund)**: zusätzlich `backend/services/chronicle_service.py:117` — **fünfter** externer Aufrufer, nicht im Original-Audit.

**Folge**: `_generate`-Refactor ist repo-weit riskant. LLM-Orchestrierung leckt in fachfremde Services (Instagram, Sitrep, Chronicle, Memory).

### 2.3 Mittel-Hoch

#### F7 — Weiche Typgrenzen ✅
**Orte bestätigt**:
- `frontend/src/services/api/ForgeApiService.ts:86, 90, 93` — `Record<string, unknown>` für `taxonomies`, `geography`, `ai_settings`, `theme_config`.
- `frontend/src/components/admin/AdminDungeonContentTab.ts:136` — `as unknown as { data: Record<string, unknown>[]; meta?: { total: number } }`.
- `frontend/src/components/multiverse/MapGraph3D.ts:551–554` — `as unknown as { numDimensions, d3ReheatSimulation }`.
- `frontend/src/components/platform/VelgAchievementSummaryCard.ts:298, 300` — `def.icon_key as string` + `(icons as any)[key]` + `eslint-disable`.

**Gesamt-Umfang**: `grep "as unknown as|as any"` → **23 Vorkommen in 18 Dateien**. Muster, nicht Rand.

#### F8 — Singleton-Kopplung ✅
**Nachweis**: `grep "from.*AppStateManager"` → **80 Frontend-Dateien** importieren `appState` direkt. Weitere globale Singletons: `AnalyticsService`, `SeoService`, `localeService`, `RealtimeService`, `ThemeService`.

**Folge**: Ownership, Testbarkeit und Sequenzierung unscharf. Unit-Tests müssen Singletons stubben — oder sie tun es nicht (siehe Test-Coverage-Lücke im 2026-04-16-Audit).

### 2.4 Mittel

#### F9 — Monolithische Dateien ✅
**Verifiziert per `wc -l`**:
| Datei | Zeilen |
|---|---|
| `frontend/src/components/epoch/EpochCommandCenter.ts` | 2728 |
| `frontend/src/components/platform/SimulationsDashboard.ts` | 2312 |
| `frontend/src/components/social/SocialTrendsView.ts` | 1969 |
| `backend/services/heartbeat_service.py` | 1596 |
| `frontend/src/app-shell.ts` | 1241 |
| `backend/services/generation_service.py` | 982 |

#### F10 — `select("*")` Overfetch auf Listen-Pfaden ✅
**Bestätigt**:
- `backend/services/agent_service.py:43` — `.select("*", count="exact")` auf Liste.
- `backend/services/building_service.py:41` — dito.
- `backend/services/social_story_service.py:71` — dito.

**Kontrast**: `backend/services/agent_service.py:73` (`list_for_reaction`) hat einen **schmalen** expliziten Select (`"id, name, character, system"`). Die bessere Praxis existiert im Repo — ist nur nicht konsistent angewandt.

#### F11 — Breite Util-Fallbacks ✅
- `backend/utils/settings.py:38–44` (`decrypt_setting`): `except Exception: … return ""` — jede Entschlüsselungsstörung (Corrupt-Token, Missing-Key, IO) wird zu leerem String.
- `backend/utils/search.py:22–28` (`apply_search_filter`): `except Exception:` → Fallback auf `ilike`. Maskiert u. a. echte Schema-Fehler.

### 2.5 Niedriger, wiederkehrend

#### F12 — Nicht-deterministische UI-Logik ✅ ➕
**Orte**:
- `frontend/src/components/platform/SimulationsDashboard.ts:1529` — `items.sort(() => Math.random() - 0.5)`.
- `Z. 1571, 1578` — `Math.random()` für Spotlight-Auswahl (Simulation, Agent).

**Erweiterung (technisch)**: `Array.sort(() => Math.random() - 0.5)` ist nicht nur nicht-deterministisch, sondern liefert eine **biased Permutation** (V8/TimSort durchläuft den Comparator asymmetrisch). Korrekt wäre **Fisher-Yates**.

**Gesamt-Umfang**: `Math.random()` in 10 Dateien (Maps, Audio, Landing, Layout). Meist dekorativ, aber inkonsistent.

---

## 3. Drei tiefe Ursachen

### U1 — Globaler impliziter Zustand statt expliziter Kontrakte
`appState.currentRole`, `appState.isAuthenticated`, `appState.currentSimulation` wirken als Singletons, sind aber in Wahrheit **verkappte Methodenargumente**. Jeder Service, der über sie entscheidet (F3, F8), macht sein Verhalten von einer Sequenzierung abhängig, die nicht am Aufrufort steht.

### U2 — Side-effectful UI
Lit-Render muss pur sein. Sobald Render lädt (F1), Navigation ausführt (F2), SEO setzt (F1) und Telemetrie schreibt (F1), gibt es keine verlässliche "der Zustand nach Render X ist Y"-Invariante mehr. Race-Bilder und schwer debuggbare Regressionen sind zwangsläufig.

### U3 — Erodierte Domänengrenzen
`_generate` ist per Konvention intern (F6). Wenn die Konvention nicht mechanisch durchgesetzt wird, wird sie innerhalb von Wochen gebrochen. Dasselbe gilt für "Navigation nur via Router" (F2) und "Fehler nicht schlucken" (F5). Ohne Lint-Gate keine Grenze.

---

## 4. Remediation — 4 Wellen

### Welle 1 (P0, 1–2 Tage) — Blutungen stoppen

**W1.1 — Render reinigen**
- `_renderSimulationView` zur reinen Funktion machen.
- `_loadSimulationContext`, `applySimulationViewSeo`, `seoService.setCanonical/setBreadcrumbs/setTitle`, `analyticsService.trackPageView` → in `_enterSimulationRoute` verschieben (ist `async`, läuft vor Render).
- Doppel-`_resolveSimulation` entfernen: `_loadSimulationContext` nimmt bereits aufgelöste `simulationId: string` als Parameter.
- Render nur noch: `switch (view) { case 'lore': return html\`<velg-simulation-lore-view .../>\`; ... }`.

**W1.2 — Navigation konsolidieren**
- `navigate(path: string)`-Helper in `utils/navigation.ts`, dispatcht das `navigate`-Custom-Event.
- Alle 20 Dateien mit direktem `window.history.pushState` auf `navigate()` umstellen (inkl. `AgentsView._pushEntityUrl`, `BuildingsView._pushEntityUrl`, `LandingPage._navigate`).
- `LandingPage._navigate` entfernen — das synthetische `PopStateEvent` war ein Workaround für das Fehlen des Helpers.
- **Lint-Gate**: `frontend/scripts/lint-no-pushstate.sh` — direkter `window.history.pushState` nur in `app-shell.ts` erlaubt.

**W1.3 — GenerationService-Façade**
- 5 öffentliche Methoden auf `GenerationService`: `extract_memory_observations`, `reflect_on_memories`, `generate_chronicle_entry`, `generate_cycle_sitrep`, `generate_instagram_caption`.
- Jede Façade-Methode nimmt typisierte Parameter (nicht `variables: dict[str, str]`) und gibt ein typisiertes DTO (Pydantic-Model) zurück.
- 5 externe Caller umstellen (`agent_memory_service.py:126,251`, `chronicle_service.py:117`, `sitrep_service.py:109`, `instagram_content_service.py:754`).
- **Lint-Gate**: `scripts/lint-no-private-generate.sh` — `_generate(` nur in `generation_service.py`.

### Welle 2 (P1, 3–5 Tage) — Kopplungen auflösen

**W2.1 — API-Routing explizit**
- `BaseApiService.getSimulationData(path, { mode: 'public' | 'member' }, params?)`.
- `CrudApiService`-Subklassen nehmen `mode` via Konstruktor oder Methoden-Parameter.
- Routes setzen `mode` explizit in `enter()`-Callback.
- Kein Lesen von `appState.currentRole` in der API-Schicht mehr.

**W2.2 — Auth-Bootstrap entdoppeln**
- Eine einzige `authService.bootstrapSession()`-Methode, die `getMe()` intern holt und **alles** setzt: User, AccessToken, isPlatformAdmin, Architect, Wallet, Forge-Request-Status, GA4-Properties, Onboarding-Flag, Pending-Forge-Requests.
- `_syncAppState` und `_fetchOnboardingState` zusammenführen.
- Ein einziges GA4-Update pro Session.

**W2.3 — `catch {}` verbieten**
- Shared Helper `handleAsyncError(err, { source, userMessage? })` — ruft `captureError`, zeigt optional Toast.
- Alle 91 Dateien mit leeren Catches durchsehen: entweder `handleAsyncError` oder echte Propagierung.
- **Lint-Gate**: `frontend/scripts/lint-no-empty-catch.sh` — Regex `catch\s*(\([^)]*\))?\s*\{\s*(\/\/[^\n]*\s*)*\}` verboten.

### Welle 3 (P2, ~1 Woche) — Monolithen & Typen

**W3.1 — Monolithen zerlegen** (Pattern aus `dungeon-god-class-decomposition.md`)
- `SimulationsDashboard.ts` → `dashboard/{DashboardShell, DashboardDataSource, HeroSection, SpotlightAgent, ResonanceTicker, CommunityGallery, DashboardFooter}.ts`.
- `EpochCommandCenter.ts` → `epoch/command-center/{...}` analog.
- `SocialTrendsView.ts` → Teilbarkeit noch prüfen.
- `heartbeat_service.py` → `heartbeat/{scheduler, event_generator, ambient_effects, reporting}.py`.

**W3.2 — Typgrenzen härten**
- Echte DTOs für `ForgeDraft`: `PhilosophicalAnchor[]`, `Taxonomies`, `Geography`, `AiSettings`, `ThemeConfig`.
- `as unknown as` von 23 auf 0 reduzieren (schrittweise pro Sprint).
- **Lint-Gate**: `lint-no-as-unknown.sh` mit Schwellwert, abnehmend.

**W3.3 — Backend-Selects schmal**
- `agent_service.list`, `building_service.list`, `social_story_service.list` auf explizite Spalten umstellen (Pattern aus `agent_service.list_for_reaction`).
- Overfetch-Differenz dokumentieren in `docs/guides/service-patterns.md`.

### Welle 4 (Polish)

**W4.1 — Deterministische UI**
- `utils/random.ts`: `fisherYatesShuffle<T>(array: T[], seed: string): T[]`, `deterministicPick<T>(array: T[], seed: string): T`.
- Spotlight-Auswahl: Seed aus `simulation_id + UTC-Datum`. Gleicher Effekt, debuggbar, 1 Tag lang stabil.
- 10 Dateien mit `Math.random()` migrieren.

**W4.2 — Schmalere Exception-Handler**
- `decrypt_setting`: nur `InvalidToken`, `cryptography.exceptions.InvalidKey` fangen.
- `apply_search_filter`: nur `postgrest.exceptions.APIError` oder entsprechende spezifische Klasse.
- Alles andere propagieren lassen.

---

## 5. Lint-Gates als Strukturhärtung

Jede Welle fügt ein mechanisches Gate hinzu. Ohne Gate keine Grenze.

| Gate | Nach Welle | Verbietet |
|---|---|---|
| `lint-no-pushstate.sh` | W1 | `window.history.pushState` außer in `app-shell.ts` |
| `lint-no-private-generate.sh` | W1 | `_generate(` außerhalb `generation_service.py` |
| `lint-no-empty-catch.sh` | W2 | `catch {}` / `catch (_) {}` |
| `lint-no-as-unknown.sh` | W3 | `as unknown as` / `as any` (Schwellwert, abnehmend) |
| `lint-no-select-star.sh` | W3 | `select("*"` in `backend/services/*_service.py` |

Alle Gates laufen in CI parallel zu `ruff`, `tsc`, `lint-color-tokens.sh`, `lint-llm-content.sh`.

---

## 6. Erwartete Wirkung

- **Welle 1 allein** adressiert die Ursachen für die schwer reproduzierbaren "manchmal leer"- und Timing-Bugs: F1 (Render-Race), F2 (Navigation-Divergenz), F6 (Service-Leak).
- **Welle 1 + 2** macht `appState` zum reinen Store statt zum versteckten Routing-Argument.
- **Welle 3** reduziert Code-Oberfläche und macht Refactors billig.
- **Welle 4** ist kosmetisch im Wert aber kulturell wichtig — deterministische UI ist debugbare UI.

---

## 7. Cross-References

- Breiterer Audit (Kontext, Metriken, Content-Externalisierung, SQL-Fragmentierung): [full-architecture-code-design-audit-2026-04-16.md](full-architecture-code-design-audit-2026-04-16.md)
- Decomposition-Pattern-Vorlage: `memory/dungeon-god-class-decomposition.md`
- Response-Typing-Präzedenz: `memory/pydantic-refactor-plan.md`
- CLAUDE.md Regeln (Backend, Frontend, NEVER-Liste): `/CLAUDE.md`

---

## 8. Status

- [x] Verifikation abgeschlossen (2026-04-17).
- [ ] Welle 1 gestartet.
- [ ] Welle 2.
- [ ] Welle 3.
- [ ] Welle 4.

Nächster Schritt: Welle 1 als konkretes Implementation-Plan-Dokument, nach Approval Umsetzung in kleinen Commits pro Unterschritt (W1.1, W1.2, W1.3).
