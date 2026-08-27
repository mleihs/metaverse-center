# Grafischer Dungeon-Modus — Parallel-View Rollout

**Status:** Geplant + approved (2026-06-15). Implementierung nicht begonnen.
**Resume-Einstieg:** Phase 0. Memory-Ledger: `graphical-dungeon-rollout`.

## Context

Velgarien hat bereits ein ~80% fertiges, server-autoritatives Dungeon-Frontend (Terminal/HUD: `DungeonTerminalView`, `DungeonMap`, `DungeonCombatBar`, `DungeonPartyPanel`, `DungeonEnemyPanel`, `DungeonQuickActions` + `dungeonState`/`dungeonApi`). Der P0-Prototyp (`spikes/dungeon-p0-prototype.html`) hat einen grafischen Modus konzeptionell bewiesen: „Meter als Umgebung", Scene-Backdrop, Combat-Juice.

**Ziel:** Einen ZWEITEN, grafischen Dungeon-Modus **parallel** aufbauen, der dieselbe Spielmechanik/API/State wiederverwendet. Die alte Terminal-View bleibt **byte-genau unangetastet**. Null Spiellogik im Client — alles bleibt server-autoritativ.

**User-Entscheidungen (verbindlich):** Voller Modus inkl. generierter **Enemy-Bilder**; Combat-FX via **PixiJS v8** (WebGL). North Star = Werk/Tiefe, Kosten nachrangig.

**Architektur-Prinzip:** Der grafische Modus ist ein zweiter *Consumer* von `dungeonState`. Bestehende HUD-Komponenten sind self-contained `SignalWatcher` → werden als Shadow-DOM-Overlays über dem Pixi-Canvas **verbatim eingebettet**. Neu gebaut wird nur: Scene-Host (Pixi, light-DOM), Backdrop/Environment-FX, Enemy-Layer, Banter-Overlay, Control-Deck-Hülle, View-Switch.

---

## Phase 0 — View-Switch-Fundament (klein, additiv, risikolos)

- **Signal:** `dungeonViewMode = signal<'terminal'|'graphical'>('terminal')` in `DungeonStateManager.ts` neben `mapExpanded` (:115); localStorage-Trio analog `runId`-Persistenz (:567-590). **NICHT** von `applyState()`/`clear()` berührt → Terminal-View unbeeinflusst. Plus `setViewMode()`.
- **Wrapper:** neue `<velg-dungeon-view>` (`display:contents`, `SignalWatcher`) rendert Terminal **oder** Graphical anhand des Signals.
- **app-shell-Edit (einzige Änderung dort):** `app-shell.ts:1188-1189` `<velg-dungeon-terminal-view>` → `<velg-dungeon-view>` (1 Zeile + 1 Import). Route `:609-611` unverändert. `simulationId` durchreichen.
- **Toggle:** `<velg-dungeon-view-toggle>` ruft `setViewMode()`. Platzierung: **Wrapper-Level-Overlay** (hält `DungeonTerminalView` byte-genau), nicht in den Header injiziert.
- **Default `terminal`** bis der grafische Modus fertig & verifiziert ist.
- **Lazy-load:** Der grafische Modus (inkl. PixiJS) wird per `import()` **dynamisch** geladen → Terminal-Nutzer zahlen keinen Bundle-Aufschlag.

## Phase 1 — Scene-Layer (Wortlaut nicht wiedergegeben) für alle 8)

- **Environment-Resolver:** neue **pure function** `utils/dungeon-environment.ts` (kein DOM): `(archetype, ArchetypeState) → { pressure01, tier, meterLabel, meterValue, direction, fxProfile }`. Nutzt die bestehenden Type-Guards (`isShadowState`/`isTowerState`/… `types/dungeon.ts:229-267`) + `max_*`-Felder. `pressure01` ist **immer „1 = schlimmster"** nach Inversion. Spiegelt die Extraktion in `DungeonHeader.ts:963-991`. **Unit-getestet** (`tests/dungeon-environment.test.ts`, Muster `tests/world-map-styles.test.ts`).
- **Scene-Host:** `components/dungeon/graphical/DungeonGraphicalView.ts` — light-DOM-Root (`createRenderRoot(){return this}`), `?inline`-CSS via `getRootNode()`+WeakSet. **Referenz 1:1: `components/drift/DriftChartHost.ts`** (existierender Three.js-light-DOM-WebGL-Host). Forced-dark `/* lint-color-ok */`-Block wie `DungeonTerminalView.ts:72-78`.
- **Backdrop-Layer:** liest `(archetype, currentRoom.depth)` → Backdrop-URL via Lookup (siehe Phase 3 Backdrops). Environment-FX (Wasser/Dunkelheit/Verfall/…) getrieben von `pressure01`.
- **Banter-Overlay:** rendert `MoveToRoomResponse.banter` / `barometer_text` (es gibt im grafischen Modus keinen Terminal-Buffer).
- **Embeds (verbatim):** `DungeonMap`, `DungeonPartyPanel`, `DungeonQuickActions`, `DungeonCombatBar`, `DungeonHeader` als Overlays. **Wichtig:** CombatBar/QuickActions dispatchen `terminal-command` (`bubbles:true,composed:true`, `DungeonCombatBar.ts:747`/`DungeonQuickActions.ts:96`) → der grafische Shell muss denselben `@terminal-command`-Handler bereitstellen wie `DungeonTerminalView.ts:557-578`.

## Phase 2 — Combat-Juice (PixiJS v8)

- **Prerequisite:** `npm install pixi.js` (v8). Aktuell NICHT installiert (nur `three@0.184` + `maplibre-gl`).
- **FX-Quelle:** `CombatRoundResult.events[]` (`types/dungeon.ts:587-607`: actor/action/target/hit/damage/stress/narrative). **KRITISCH:** `events[]` ist nur auf der `combat/submit`-Response und wird von `applyState()` verworfen → neues client-only Signal `lastRoundResult` + `publishRoundResult()` im State-Manager, aufgerufen an den 2 Submit-Resolution-Sites (`DungeonStateManager.ts:498-520` + Command-Pfad).
- **FX-Driver (Pixi):** spielt die Events gestaffelt ab — Schadenszahlen, Partikel, Screen-Shake, Telegraph-Betonung, Victory/Defeat-Flourish (aus echten `victory`/`wipe`/`stalemate`-Flags). **Achtung:** Gegner liefern nur `condition_display` (healthy/damaged/critical/defeated), **keine HP-Zahlen** → FX arbeiten mit Events + Condition, nicht mit Prozent-Balken.
- **Lifecycle:** Pixi-App init in `firstUpdated`, teardown in `disconnectedCallback` (+ reconnect-Re-mount-Guard, async-init-abort-guard). Canvas-Host nutzt **`effect()`-Subscription** (nicht `SignalWatcher`) → Deltas imperativ in Pixi pushen (wie `DriftView.ts:360`).
- **a11y:** `prefers-reduced-motion` friert Ambient-Motion ein, behält instant Schadenszahlen. WebGL-offline → HUD bleibt voll spielbar. Bounded height (23000px-MapLibre-Falle vermeiden: explizite `height` + `min-height:0`).
- **Cooldown-Ringe** in der eingebetteten/grafischen CombatBar.

## Phase 3 — Generierte Bilder (Backend-Asset-Kette + Frontend-Lookup)

Kann als **unabhängiger Backend-Strang parallel früh** starten (Bildgenerierung braucht Zeit).

### 3a. Enemy-Bilder (A1.5-konforme Kette — Reihenfolge zwingend)
1. **Modell-Feld zuerst** (StrictModel-Gate): `EnemyTemplate` (`backend/models/resonance_dungeon.py:801-823`) += `image_url: str|None=None` (+ optional `visual_description: str|None=None` als Prompt-Seed in YAML). `EnemyTemplate` ist **zugleich** Pack-Schema UND Runtime-Modell (`content_packs/schemas.py:186`) → ein Add deckt beides.
2. **Migration (neu, nicht 170 editieren):** `supabase/migrations/{date}_259_dungeon_enemy_image_url.sql` → `ALTER TABLE dungeon_enemy_templates ADD COLUMN IF NOT EXISTS image_url TEXT;`. Bestehende `_public_read`-RLS deckt die Spalte; **kein** Grant/RPC/SECDEF-Change.
3. **Generator:** `content_packs/table_specs.py:76-102` `ENEMY_TEMPLATES.columns += "image_url"`; `content_packs/row_builders.py:88-111` `_enemy_row` += `"image_url": optional_text(tmpl.image_url)`.
4. **Validator:** `scripts/validate_content_packs.py` neue **Warn-Level**-Coverage-Prüfung (alle Enemies haben `image_url`), wie die partial-narrative-Prüfung.
5. **content_service: KEINE Änderung** (`select("*")` + `EnemyTemplate(**row)`, `dungeon_content_service.py:101-106`).
6. **DTO-Kette (2 Hops):** `EnemyInstance` (`backend/models/combat.py:62-95`) += `image_url`, gesetzt im Spawn (`dungeon/dungeon_combat.py:83-95`); Client-DTO-Bau in `dungeon_checkpoint_service.py:308-318` += `image_url=e.image_url`; `EnemyCombatStateClient` (`resonance_dungeon.py:474-483`) += `image_url`; Frontend-Typ `types/dungeon.ts:391-400` += `image_url: string|null`.
7. **Generierungs-Script:** `scripts/generate_dungeon_enemy_images.py` (Muster `generate_dungeon_detail_images.py`). Iteriert YAML-Roster via `content_packs.loader.load_packs()`; Prompt aus `visual_description`+`description_en`+Archetyp-Palette; **Modell `flux-2-pro`** ($0.031, ~19 Enemies ≈ $0.59 einmalig, archetyp-global). Output `simulation.assets/dungeon-enemies/{slug}/{enemy_id}.avif` (AVIF q80 ≤1024px). **Write-back NUR via YAML → validate → generate_migration → migrate** — NIEMALS direkt DB (A1.5; TRUNCATE+re-insert würde Direkt-Edit löschen).

### 3b. Raum-Backdrops (KEIN Backend-Change)
- `RoomNode` hat keine x/y-Identität → **Granularität: archetype × depth-band (3–4 Bänder)**. ~8×4 = 32 Bilder, `flux-2-pro`, `simulation.assets/dungeon-backdrops/{slug}-{band}.avif`.
- **Pure Frontend-Lookup:** neues `dungeon-backdrop-data.ts` (Muster `landing/dungeon-showcase-data.ts:41`): `(archetypeSlug, depthBand(depth)) → URL`. Liest `clientState.archetype` + `currentRoom.depth`. Kein Pydantic/Migration/DTO/Validator-Change.

---

## Die 8 Environment-Treatments (Resolver `fxProfile`)

| Archetyp | Meter-Key (max) | Richtung | Treatment |
|---|---|---|---|
| Deluge | `water_level` (100) | hoch = schlimmer | steigendes Wasser + Blasen + Blur |
| Shadow | `visibility` (3) | **invertiert** (3→0) | sich schließende Dunkelheit/Vignette |
| Entropy | `decay` (100) | hoch = schlimmer | Entsättigung + Rausch + Auflösung |
| Tower | `stability` (100) | **invertiert** (hoch=besser) | struktureller Tilt/Riss, Debris |
| Mother | `attachment` (100) | **invertiert** (hoch=schlimmer) | atmender Puls, UI-Verengung |
| Prometheus | `insight` (100) | hoch = heißer | Schmiede-Glut-Temperatur, Funken |
| Overthrow | `fracture` (100) | hoch = schlimmer | Spiegelscherben-Fragmentierung |
| Awakening | `awareness` (100) | hoch = schlimmer | Déjà-vu-Flicker, Doppelbelichtung |

3 Inversionen (Shadow/Tower/Mother) im Resolver explizit + getestet.

---

## Kritische Dateien

**Frontend (neu):** `components/dungeon/graphical/DungeonGraphicalView.ts` (+ Scene-Module backdrop/enemies/fx), `components/dungeon/DungeonView.ts` (Wrapper), `components/dungeon/DungeonViewToggle.ts`, `utils/dungeon-environment.ts`, `utils/dungeon-backdrop-data.ts`, `tests/dungeon-environment.test.ts`.
**Frontend (edit, minimal):** `services/DungeonStateManager.ts` (viewMode-Signal + `lastRoundResult`/`publishRoundResult`), `app-shell.ts:1188` (1 Zeile), `types/dungeon.ts:391` (enemy `image_url`).
**Frontend (Referenzen, unverändert):** `components/drift/DriftChartHost.ts` (PixiJS-Host-Muster), `components/world-map/SimulationWorldMap.ts` (`?inline`-CSS-Scope).
**Backend (edit):** `models/resonance_dungeon.py` (EnemyTemplate + EnemyCombatStateClient), `models/combat.py` (EnemyInstance), `services/dungeon/dungeon_combat.py` (spawn-hop), `services/dungeon_checkpoint_service.py` (DTO-bau), `content_packs/table_specs.py` + `row_builders.py`, `scripts/validate_content_packs.py`.
**Backend (neu):** Migration `_259_dungeon_enemy_image_url.sql`, `scripts/generate_dungeon_enemy_images.py`, generierte Content-Migration.

---

## Verifikation

- **Resolver:** Unit-Tests für alle 8 Archetypen inkl. der 3 Inversionen (pressure01-Grenzen 0/1).
- **Switch:** Browser — Toggle terminal↔graphical, Terminal-View unverändert funktional, Recovery (`tryRecover`) in beiden.
- **Scene:** pro Archetyp grafisch betreten, Environment-FX skaliert mit echtem Meter (gegen `DungeonHeader`-Werte gegenprüfen).
- **Juice:** echte Combat-Runde → Schadenszahlen/Partikel/Flourish aus `round_result.events`; reduced-motion-Pfad; WebGL-offline → HUD spielbar.
- **Enemy-Bilder:** `validate_content_packs.py` grün; Migration applied; `image_url` erreicht Client-DTO; Bild rendert. `ruff` + `tsc` + alle lint-Gates (color-tokens, no-empty-catch, no-cast-unknown, llm-content) grün.
- Browser-Verifikation via MCP pro Phase.

## Compliance-Flags (geprüft)
- **A1.5:** Enemy-`image_url` nur via YAML→Migration, nie Direkt-DB. ✔
- **SECDEF/Grants:** kein neuer RPC, nur additive Spalte mit bestehender public-read-RLS → 257/258-Lockdown nicht berührt. ✔
- **Lint-Gates:** forced-dark-Pragma, icons.ts, kein transform/filter auf Layout-Containern, @localized()/msg(), captureError, prefers-reduced-motion. ✔

## Aufgelöste Mikro-Entscheidungen
1. Toggle = Wrapper-Overlay (nicht Header-Injektion) → Terminal byte-genau.
2. `publishRoundResult()` an den 2 Submit-Sites = additive client-only Publikation, minimal-invasiv. OK.
3. PixiJS v8, dynamisch importiert (code-split) → kein Bundle-Hit für Terminal.
4. Party-Panel Phase 1 verbatim eingebettet; grafische Sibling optional später.
