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

### 3a. Enemy-Bilder — GEBAUT (2026-08-28)

Die Kette steht. Die 42 Kreaturen stehen als freigestellte Bilder im
`.scene__enemies`-Band statt als clip-path-Silhouetten; die Silhouette ist
weiterhin der Fallback und wird nicht abgeschaltet.

**Drei Abweichungen vom ursprünglichen Entwurf, jeweils begründet:**

1. **`image_path` statt `image_url`.** Der Wert ist ein bucket-relativer
   Objektpfad (`dungeon-enemies/shadow_wisp-384.avif`), keine URL. Er reist in
   einer eingecheckten Seed-Migration, die gegen lokales Supabase
   (`127.0.0.1:54321`), gegen CI **und** gegen Prod läuft — eine
   vollqualifizierte URL würde die Prod-Projekt-Ref in alle drei backen. Die
   Storage-Basis setzt das Frontend, wie bei den Backdrops auch
   (`utils/dungeon-enemy-art.ts`, Muster `dungeon-backdrop-data.ts`).
2. **Kein Replicate-Generierungsskript.** Die Bilder entstanden in der
   Gemini-App (Consumer-Abo, kein API-Key) auf Magenta-Grund und wurden mit
   `scripts/key_dungeon_enemy_art.py` freigestellt. Prompts und Zuordnung:
   `dungeon-enemy-image-prompts.md`, `dungeon-enemy-asset-manifest.md`.
3. **Zwei Auflösungen statt einer.** Die 1024-px-Master liegen im Repo
   (`assets/dungeon-enemies/`, 3,5 MB) als Archiv. Publiziert wird eine
   384-px-Rendition: das Band zeichnet einen Gegner höchstens 112 CSS-px hoch
   (`FOE_GEOMETRY.boss`), bei DPR 3 also 336 Gerätepixel. 893 KB statt 3543 KB,
   ohne je sichtbar zu werden. Die Rechnung steht im Kopf des Ingest-Skripts.

**Was wo liegt:**
1. **Modell:** `EnemyTemplate.image_path` (`backend/models/resonance_dungeon.py`)
   — zugleich Pack-Schema und Runtime-Modell, ein Add deckt beides.
2. **Migration:** `272_dungeon_enemy_image_path.sql` (nullable, ohne Backfill;
   NULL = Silhouette). Muss **vor** der Seed-Migration laufen — die
   Zeitstempel-Benennung erzwingt das.
3. **Generator:** `table_specs.ENEMY_TEMPLATES.columns += "image_path"`,
   `row_builders._enemy_row` += `optional_text(tmpl.image_path)`.
4. **Validator:** `_check_enemy_art_paths` (harter Verstoß: Pfad muss
   bucket-relativ sein und die id der eigenen Kreatur tragen — ein
   Copy-Paste-Fehler gäbe zwei Kreaturen dasselbe Gesicht, und das falsche Bild
   lädt fehlerfrei) plus `_check_enemy_art_coverage` (Warnung: Kreatur ohne
   Bild). Beide in `scripts/validate_content_packs.py`, CI-Schritt `content-packs`.
5. **content_service:** unverändert (`select("*")` + `EnemyTemplate(**row)`).
6. **DTO-Kette:** `EnemyInstance.image_path` (im Spawn aus dem Template kopiert,
   `dungeon/dungeon_combat.py`) → `EnemyCombatStateClient.image_path`
   (`dungeon_checkpoint_service.py`) → `types/dungeon.ts`. Alte Checkpoints
   deserialisieren mit `None` und zeigen die Silhouette.
7. **Ingest:** `scripts/ingest_dungeon_enemy_art.py` — leitet die Rendition aus
   dem Master ab und lädt sie hoch. Die Arbeitsliste kommt aus dem **Pack**, nie
   aus einem Verzeichnis-Listing: das hochgeladene Objekt ist damit per
   Konstruktion das, auf das die DB zeigt. Schreibt nichts in die DB (A1.5).
8. **Seed:** `273_dungeon_content_from_packs.sql`, aus dem Pack generiert.
   Gegen den vorherigen Pack-Stand unterscheidet er sich in genau 42 Zeilen,
   dort ausschließlich `NULL` → Pfad (nachgemessen).
9. **Frontend:** `utils/dungeon-enemy-art.ts` (reiner Pfad→URL-Lookup) und
   `DungeonGraphicalView` (`.foe__art` statt `.foe__body`, Ladefehler fällt pro
   URL einmal auf die Silhouette zurück und wird über `captureError` beobachtet).

**Zwei Vorschäden dabei mitgefixt:** `FOE_CONDITION` kannte nur 4 der 6
Zustände, die `EnemyInstance.condition_display` liefert — `scratched` und
`wounded` fielen auf den Healthy-Ton zurück, ein angeschlagener Gegner sah aus
wie ein unversehrter. Und die Gegner-Animationen (`foe-sway`, `foe-glare`,
`foe-intent-pulse`, alle endlos) fehlten im `prefers-reduced-motion`-Block, der
aus der Zeit vor dem Gegner-Band stammt.

**Offen:** Der Storage-Upload selbst ist noch nicht gelaufen (lokal wie Prod) —
bis dahin greift überall die Silhouette. Nacharbeit an einzelnen Bildern siehe
`dungeon-enemy-asset-manifest.md`, nicht blockierend.

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
- **Enemy-Bilder:** `validate_content_packs.py` grün ✔; `image_path` erreicht Client-DTO ✔ (`test_dungeon_enemy_art.py`); `ruff` + `tsc` + Biome + alle Lint-Gates grün ✔. **Offen:** Migration applied + Storage-Upload + Bild rendert im Browser.
- Browser-Verifikation via MCP pro Phase.

## Compliance-Flags (geprüft)
- **A1.5:** Enemy-`image_path` nur via YAML→Migration, nie Direkt-DB. ✔ Das Ingest-Skript fasst die DB nicht an.
- **SECDEF/Grants:** kein neuer RPC, nur additive Spalte mit bestehender public-read-RLS → 257/258-Lockdown nicht berührt. ✔
- **Lint-Gates:** forced-dark-Pragma, icons.ts, kein transform/filter auf Layout-Containern, @localized()/msg(), captureError, prefers-reduced-motion. ✔

## Aufgelöste Mikro-Entscheidungen
1. Toggle = Wrapper-Overlay (nicht Header-Injektion) → Terminal byte-genau.
2. `publishRoundResult()` an den 2 Submit-Sites = additive client-only Publikation, minimal-invasiv. OK.
3. PixiJS v8, dynamisch importiert (code-split) → kein Bundle-Hit für Terminal.
4. Party-Panel Phase 1 verbatim eingebettet; grafische Sibling optional später.
