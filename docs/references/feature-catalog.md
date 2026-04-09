---
title: "Feature Catalog"
id: feature-catalog
version: "3.6"
date: 2026-04-09
lang: de
type: reference
status: active
tags: [features, catalog, platform, simulation]
---

# 06 - Feature Catalog: Plattform + Simulation Features

---

## Feature-Kategorien

### A. Plattform-Features

Features die auf Plattform-Ebene existieren, unabhängig von einzelnen Simulationen.

#### A1. Kern-Plattform

| # | Feature | Status | Beschreibung |
|---|---------|--------|-------------|
| P1 | **Simulation erstellen** | ✅ IMPL | Wizard mit Name, Beschreibung, Thema, Slug. CreateSimulationWizard Lit-Komponente. |
| P2 | **Simulations-Dashboard** | ✅ IMPL | Übersicht aller Simulationen mit Zähler-Badges (Agenten, Gebäude, Events), Bannerbilder, LoreScroll-Akkordeon (25 Sektionen, 6 Kapitel, Spectral-Schrift). Hero-Hintergrund. Dynamisch: zeigt alle vom Benutzer erstellten und beigetretenen Simulationen. Featured-Card mit Genre-Badge, Beschreibung, Theme-Akzent-Border, pluralisierten Stats. Agent-Spotlight mit echten API-Daten (Portrait, Name, Beruf). Responsive Layout-Balance (Shards im linken Bereich < 1440px). PlatformFooter (Copyright, Impressum, Privacy). |
| P3 | **Simulation-Auswahl** | ✅ IMPL | Zwischen Simulationen wechseln. Slug-basierte URLs (`/simulations/speranza/lore`). SimulationShell + SimulationHeader + SimulationNav mit Theme-Wechsel. SimulationSwitcher merged Member- und Public-Sims: authentifizierte User sehen eigene Shards unter "My Worlds" und alle anderen unter "Community Shards". Membership-basierte Aufteilung via `memberSimulationIds` Signal (nicht `owner_id`). |
| P4 | **Benutzer-Registrierung** | ✅ IMPL | Signup mit Email/Passwort via Supabase Auth. RegisterView Komponente. |
| P5 | **Benutzer-Login** | ✅ IMPL | Signin mit JWT (ES256 Production / HS256 Local). LoginPanel (Slide-from-right via VelgSidePanel). DevAccountSwitcher (5 Accounts, in Production verfügbar). |
| P6 | **Mitglieder einladen** | ✅ IMPL | Einladungs-Links mit Rollen-Zuweisung (owner/admin/editor/viewer). MemberService mit LastOwnerError-Schutz. |
| P7 | **Mitglieder verwalten** | ✅ IMPL | Rollen ändern, Mitglieder entfernen. Access-Settings-Panel. Letzter Owner kann nicht entfernt werden. |
| P8 | **Simulation archivieren** | ✅ IMPL | Archivierung via `simulation_type='archived'`. Game Instances werden nach Epoch-Ende automatisch archiviert. Restore (`archived→active`) via Admin-Panel. Hard-Delete (PURGE) mit Cascade auf alle Kind-Entitaeten. |
| P9 | **Simulation klonen** | ✅ IMPL | `clone_simulations_for_epoch()` PL/pgSQL-Funktion (~250 Zeilen). Atomisches Klonen mit Agent-Capping (max 6), Building-Capping (max 8), Normalisierung, Embassy-Remapping. |
| P10 | **Public-First-Architektur** | ✅ IMPL | Anonymer Lesezugriff ohne Login. 21 Anon-RLS-Policies. 58 Public-API-Endpoints (`/api/v1/public/*`). `BaseApiService.getSimulationData()` routet automatisch zwischen public/authenticated. Rate-Limiting 100/min. |

#### A2. Competitive Epochs (PvP-System)

| # | Feature | Status | Beschreibung |
|---|---------|--------|-------------|
| P11 | **Epoch-Lifecycle** | ✅ IMPL | Vollständiger Lebenszyklus: Lobby → Draft → Active (Zyklen) → Completed/Cancelled. EpochCommandCenter als Orchestrator-Komponente. EpochOpsBoard mit Dossier-Karten für aktive Epochs. |
| P11a | **Teams & Teilnehmer** | ✅ IMPL | 2-8 Spieler pro Epoch. Automatische Team-Erstellung bei Simulation-Auswahl. `epoch_participants` mit `source_template_id`-Fallback für Game-Instance-Matching. |
| P11b | **Operative Missions** | ✅ IMPL | 6 Operativ-Typen: Spy (Intel-Reveal + Zone Security), Guardian (Verteidigung 0.06/Einheit, Cap 0.15), Saboteur (Zone-Downgrade), Propagandist (Event-Erstellung in Ziel-Sim), Assassin (Ambassador-Blocking 3 Zyklen), Infiltrator (Embassy-Reduktion 65% für 3 Zyklen). RP-Economy: 12/Zyklus, Cap 40. Counter-Intel Sweep Kosten 4. |
| P11c | **Scoring-System** | ✅ IMPL | 5-Dimensionen: Stability, Influence, Sovereignty, Diplomatic, Military. Alliance-Bonus (+15%), Betrayal-Penalty (-25%), Spy-Bonuspunkte. `ScoringService` mit Materialized Views. |
| P11d | **Battle Log** | ✅ IMPL | Chronologischer Kampfbericht. Fog-of-War: Nur eigene und öffentliche Events sichtbar. Öffentlicher Battle-Feed (`/api/v1/public/battle-feed`). EpochBattleLog-Komponente mit Bot-Indikatoren und Persönlichkeits-Farben. |
| P11e | **Leaderboard** | ✅ IMPL | Echtzeit-Rangliste mit 5-Dimensionen-Scores, Rang-Gap-Indikator, TRAITOR-Badge bei Verrat. EpochLeaderboard + MapLeaderboardPanel. Batch-Fetch für N+1-Optimierung. |
| P11f | **Allianzen & Verrat** | ✅ IMPL | Allianz-Vorschläge mit einstimmiger Abstimmung während Competition-Phase. Shared Intelligence (RLS-basiertes Allied Intel Sharing). Upkeep: 1 RP/Mitglied/Zyklus. Tension-Mechanik: +10 pro überlappende Zielangriffe, -5 Decay/Zyklus, Auto-Auflösung bei 80. Verrats-Erkennung mit `betrayal_penalty`-Spalte, -25% Diplomatic Score. 2 neue Tabellen: `epoch_alliance_proposals`, `epoch_alliance_votes`. `tension`-Spalte auf `epoch_teams`. 3 API-Endpoints (GET/POST Proposals, POST Vote). EpochAlliancesTab. |

#### A3. Bot Players (KI-Gegner)

| # | Feature | Status | Beschreibung |
|---|---------|--------|-------------|
| P12 | **Bot-Presets** | ✅ IMPL | `bot_players`-Tabelle: Wiederverwendbare Bot-Konfigurationen. 5 Persönlichkeits-Archetypen (Sentinel, Warlord, Diplomat, Strategist, Chaos) mit persönlichkeitsspezifischen Akzentfarben. 3 Schwierigkeitsstufen (easy/medium/hard). |
| P12a | **Deterministic Decision Engine** | ✅ IMPL | `BotPersonality` (abstrakte Basis + 5 Implementierungen). Fog-of-War-konforme `BotGameState`-Erstellung. Bots nutzen dieselben `OperativeService.deploy()` + `spend_rp()`-Methoden wie Spieler — kein Code-Duplikat. Synchrone Ausführung während `resolve_cycle()` via DI-injiziertem Admin-Supabase. |
| P12b | **Dual-Mode Chat** | ✅ IMPL | Template-basiert (kostenlos, sofort) + LLM via OpenRouter (konfigurierbar pro Simulation). `BotChatService` mit `bot_chat_mode`-Toggle in AI-Settings. `sender_type`-Spalte auf `epoch_chat_messages`. |
| P12c | **BotConfigPanel** | ✅ IMPL | VelgSidePanel "Bot Deployment Console". Collectible-Card-Deck-Builder-Ästhetik: Persönlichkeitskarten-Grid mit SVG-Radar-Charts, Difficulty Segmented Toggle, Behavior-Matrix-Bars, Stagger-Reveal-Animationen. `bot_decision_log`-Tabelle für Zyklus-Audit-Trail. |
| P12d | **Auto-Draft** | ✅ IMPL | Persönlichkeitsgewichteter `auto_draft()`: Bots wählen Agenten basierend auf Archetyp-Präferenzen (z.B. Warlord bevorzugt hohe Assassin/Saboteur-Aptitudes). |

#### A4. Platform Admin Panel

| # | Feature | Status | Beschreibung |
|---|---------|--------|-------------|
| P13 | **Admin-Route** | ✅ IMPL | `/admin` mit Email-Allowlist-Auth (`matthias@leihs.at`). `require_platform_admin()`-Dependency. `isPlatformAdmin` Computed Signal. Dark tactical HUD-Ästhetik (gray-950 bg, Scanlines, "RESTRICTED ACCESS"-Badge). 10 Tabs (von 13 konsolidiert): Users, Simulations, Health, Heartbeat, Resonances, Scanner, Forge, Platform Config (API Keys + Models + Research + Caching), Social Media (Instagram + Bluesky), Data Cleanup. Shared CSS-Modul (`admin-shared-styles.ts`) mit Tier-3 Custom Properties. Info-Bubbles auf allen Config-Inputs. ARIA-Labels auf allen Formularfeldern. |
| P13a | **User Management** | ✅ IMPL | AdminUsersTab: Suche, expandierbare Zeilen, Rollen-Dropdowns, Mitgliedschafts-Verwaltung, Simulation-Zuweisung, Löschen mit Bestätigung. 3 SECURITY DEFINER RPC-Funktionen (`admin_list_users`, `admin_get_user`, `admin_delete_user`) — umgeht GoTrue Admin API HS256-Inkompatibilität. `admin_get_user` liefert Wallet-Daten (forge_tokens, is_architect) als flache Felder via LEFT JOIN (Migration 057) — kein separater Wallet-Query nötig. `admin_delete_user` (Migration 113): Ownership-Transfer an Platform-Admin, FK-Nullifizierung, user-owned Records Löschung. Dispatcht `user-deleted`-Event für DevAccountSwitcher-Cache-Invalidierung. |
| P13b | **Cache TTL Controls** | ✅ IMPL | AdminCachingTab: Card-basierte TTL-Inputs, Dirty-Tracking, Save/Reset. `platform_settings`-Tabelle (Key-Value Runtime-Config). `CacheConfigService`-Singleton für Map-Data, SEO-Metadata, HTTP Cache-Control. |
| P13c | **Data Cleanup** | ✅ IMPL | AdminCleanupTab: 6 Daten-Kategorien (completed_epochs, cancelled_epochs, stale_lobbies, archived_instances, audit_log, bot_decision_log). Preview-Before-Delete-Workflow (Stats → Scan → Preview → Execute). Cascade-aware Epoch-Deletion (Game Instances zuerst, dann Epoch-Zeilen mit 8 Kind-Tabellen). Monospace-Cascade-Tree-Anzeige. Item-Selektion: Scan liefert individuelle Epoch/Instanz-Einträge mit Checkboxen — Cascade-Counts aktualisieren sich live per debounced Re-Preview. `min_age_days` erlaubt 0 (sofort). Optional `epoch_ids` Parameter umgeht Altersfilter für gezielte Löschung. |
| P13d | **Health Effects Control** | ✅ IMPL | AdminHealthTab: Admin-Kill-Switch für kritische Health-Effekte (Entropy Overlay, Text Corruption, Card Distortion, Deceleration, Timer, Desperate Actions Panel). Globaler Master-Switch + Per-Simulation-Overrides. Single Gate in `AppStateManager.setBleedStatus()` — maskiert `thresholdState` zu `'normal'` wenn unterdrückt, null Änderungen an Effekt-Komponenten. `get_bleed_status()` RPC (SECURITY DEFINER) liest `platform_settings` + `simulation_settings`, gibt `effects_suppressed` zurück. Health-Bars mit Farbcodierung, Threshold-State-Badges, Toggle-Switches pro Simulation. Audit-Logging für alle Änderungen. **Default:** Neue Forge-Simulationen starten mit `critical_health_effects_enabled = false` (Migration 121) — Admin kann nachträglich aktivieren. |

#### A5. Agent Aptitudes & Draft Phase

| # | Feature | Status | Beschreibung |
|---|---------|--------|-------------|
| P14 | **Template-Set Aptitudes** | ✅ IMPL | `agent_aptitudes`-Tabelle (Migration 047). Jeder Agent: Aptitude-Scores 3-9 für 6 Operativ-Typen (spy/guardian/saboteur/propagandist/infiltrator/assassin), Budget 36 Punkte. Erfolgswahrscheinlichkeits-Formel: `aptitude × 0.03` (18pp Swing zwischen niedrigstem/höchstem). Seed-Daten für 35 Agenten (210 Aptitude-Zeilen). |
| P14a | **VelgAptitudeBars** | ✅ IMPL | Shared-Komponente: 3 Größen, editierbarer Modus mit Budget-Tracking, Highlight-Modus, Gradient-Fills, farbige Slider-Thumbs, Glow auf hervorgehobenen Bars. Verwendet in AgentDetailsPanel, AgentsView, DeployOperativeModal, DraftRosterPanel. |
| P14b | **Draft Phase** | ✅ IMPL | `max_agents_per_player` Epoch-Config (4-8, Standard 6). `drafted_agent_ids UUID[]` + `draft_completed_at` auf `epoch_participants`. DraftRosterPanel: Full-Screen-Overlay (Zwei-Spalten: verfügbarer Roster + Deployment-Slots), Counter-Bar mit Pip-Pulse-Animation, Team-Stats, Scanline-Textur, "DRAFTED"-Stempel, bernsteinfarbene pulsierende leere Slots, Spring-Slot-Fill-Animation. |
| P14c | **Operative-Aptitude-Integration** | ✅ IMPL | DeployOperativeModal: Aptitude-Bars + Fit-Indikator + sortiertes Dropdown. `AgentService` prüft Ambassador-Blocking. Clone-Funktion Draft-aware refaktoriert. |

#### A6. Game Instances

| # | Feature | Status | Beschreibung |
|---|---------|--------|-------------|
| P15 | **Template-Klonen** | ✅ IMPL | `clone_simulations_for_epoch()` PL/pgSQL (~250 Zeilen): Agent-Capping (max 6), Building-Capping (max 8), Condition-Normalisierung (alle → 'good'), Capacity-Normalisierung (alle → 30), Security-Level-Distribution (1×high, 2×medium, 1×low), Qualification-Normalisierung (alle → 5), Cross-Simulation Embassy-Remapping, simulation_connections-Remapping, Participant-Repointing. `simulation_type`-Spalte (template/game_instance/archived). |
| P15a | **Lifecycle** | ✅ IMPL | Start → `clone_simulations_for_epoch()`, Complete → `archive_epoch_instances()`, Cancel → `delete_epoch_instances()`. `GameInstanceService` (clone/archive/delete/list). SimulationNav: violettes "Game Instance"-Badge. Simulation-Listings filtern `simulation_type='template'`. |

#### A7. Epoch Invitations

| # | Feature | Status | Beschreibung |
|---|---------|--------|-------------|
| P16 | **Email-Einladungen** | ✅ IMPL | `epoch_invitations`-Tabelle mit Token-basierter Annahme. `EpochInvitationService` (CRUD + Lore-Generierung via OpenRouter, gecacht in `game_epochs.config.invitation_lore` + Email-Versand via SMTP). Dark tactical HTML-Email mit Inline-CSS, bilingual EN/DE, per-Simulation-Akzentfarben. |
| P16a | **Invite UI** | ✅ IMPL | EpochInvitePanel: VelgSidePanel Slide-out mit Email-Input, AI-Lore-Dossier-Preview, gesendete Einladungen mit Status-Badges. Nur für Epoch-Creator in Lobby-Phase sichtbar. Auto-Öffnung nach Epoch-Erstellung. |
| P16b | **Token-Annahme** | ✅ IMPL | EpochInviteAcceptView: Split-Screen Auth-Seite bei `/epoch/join?token=...` mit Lore-Panel + Login/Register-Terminal. Öffentliche Token-Validierung via `/api/v1/public/epoch-invitations/{token}`. |

#### A8. Epoch Realtime Chat

| # | Feature | Status | Beschreibung |
|---|---------|--------|-------------|
| P17 | **Dual-Channel Chat** | ✅ IMPL | `epoch_chat_messages`-Tabelle + 4 RLS-Policies + 2 Broadcast-Trigger. REST Catch-up + Supabase Realtime Live. ALL CHANNELS + TEAM FREQ. Cursor-basierte Pagination. `EpochChatService` (4 Endpoints: Nachricht senden, Epoch-Messages, Team-Messages, Cycle-Ready-Toggle). |
| P17a | **Presence & Ready** | ✅ IMPL | `RealtimeService`-Singleton (4 Supabase Realtime Channels: chat, presence, status, team). `EpochPresenceIndicator` (Online-Dot). `EpochReadyPanel` (Cycle-Ready-Toggle). `cycle_ready`-Spalte auf `epoch_participants`. |
| P17b | **COMMS Sidebar** | ✅ IMPL | Einklappbares "COMMS"-Panel auf dem Epoch Operations Board. Zwei-Spalten-Grid (links: Dossier-Karten, rechts: 360px COMMS-Sidebar). Signal-Strength-Indikator, bernsteinfarbener Glow-Toggle mit Unread-Badge. Realtime-Channel-Lifecycle: Join bei OpsBoard, Leave bei Epoch-Detail, Re-join bei Zurück. |

#### A9. Cycle Email Notifications

| # | Feature | Status | Beschreibung |
|---|---------|--------|-------------|
| P18 | **Taktische Briefing-Emails** | ✅ IMPL | `CycleNotificationService` (~740 Zeilen). Bilingual EN/DE via SMTP SSL (Port 465, `asyncio.to_thread()`). 3 Trigger: Cycle-Resolve, Phase-Change, Epoch-Start. Per-Player Fog-of-War-konforme Briefing-Daten: Rang-Gap, Missions-Tabelle, Spy-Intel (Zone Security + Guardian Deployment), Threat Assessment, Alliance-Status, Nächster-Zyklus-Preview. |
| P18a | **Notification Preferences** | ✅ IMPL | `notification_preferences`-Tabelle (Migration 044). Per-User Email Opt-in/Opt-out für cycle_resolved, phase_changed, epoch_completed. `email_locale`-Feld. `get_user_emails_batch()` SECURITY DEFINER RPC. NotificationsSettingsPanel (3 Toggle-Switches in Settings). |
| P18b | **Email-Templates** | ✅ IMPL | `EmailTemplates` (~1660 Zeilen, 4 bilinguale Templates). 85+ lokalisierte String-Keys via `_NOTIF_STRINGS`-Dict. Per-Simulation-Akzentfarben via `_SIM_EMAIL_COLORS`. Per-Simulation-Narrativ-Voice via `_SIM_HEADERS`. WCAG AA Kontrast. `CLASSIFIED //`-Betreffzeilen-Pattern. |

#### A10. How-to-Play Tutorial

| # | Feature | Status | Beschreibung |
|---|---------|--------|-------------|
| P19 | **How to Play — Three Doors** | ✅ IMPL | "Three Doors" Hub-and-Spoke-Architektur (Phase 1-3 fertig, Phase 4-5 ausstehend). 6 Routes: `/how-to-play` Landing (3 Persona-Karten: Quick Start, Game Guide, War Room), `/how-to-play/quickstart` (5-Schritt-Timeline "Orientation Briefing"), `/how-to-play/guide` (12-Topic Guide Hub mit Fuzzy-Suche), `/how-to-play/guide/:topic` (dynamisches Shared-Template pro Topic: TL;DR, How it Works, Tips, Related Topics, Prev/Next), `/how-to-play/competitive` (War Room: Tactics, Matches, Intel, Demo, Updates — Phase 4 stub), `/how-to-play/legacy` (alter Monolith). 15 Dateien in how-to-play/: 6 Komponenten + htp-shared-styles + htp-search + htp-topic-data + htp-styles + 4 Content/Type-Dateien. Glassmorphism-Karten, Staggered-Entrance-Animations, View Transitions API, Keyboard-Accessibility, `prefers-reduced-motion: reduce`. Brutalist Dark Theme mit --font-brutalist (Courier 700) + --font-prose (Spectral 500). |

#### A11. ECharts Intelligence Report

| # | Feature | Status | Beschreibung |
|---|---------|--------|-------------|
| P20 | **Interaktive Analyse-Charts** | ✅ IMPL | Apache ECharts 6.0 Integration (tree-shaken: BarChart, LineChart, HeatmapChart, RadarChart, CustomChart + CanvasRenderer). `EchartsChart` Lit-Wrapper mit `tactical` Dark-Theme. 4 Charts: Radar (Simulations-Profile), Heatmap (Head-to-Head 2P-Duelle), Grouped Bar mit Wilson 95% CI-Whiskers (Strategie-Tiers), Multi-Line (Win-Rate nach Spieleranzahl). IntersectionObserver Scroll-Reveal mit "CLASSIFIED" / "INTEL GRADE" Eck-Bracket-Dekorativen Headers. 200-Game Epoch-Simulations-Datenbasis. Lazy-loaded als separater Chunk (607 KB) nur auf /how-to-play. |

#### A12. Landing Page & Public Showcase

| # | Feature | Status | Beschreibung |
|---|---------|--------|-------------|
| P21 | **Landing Page** | ✅ IMPL | Full-screen immersive introduction. Military surveillance terminal aesthetic. 7 sections: Hero (signal decode animation), Features (3-column with Supabase Storage images), Worlds Preview (monitor-card grid), Agent Showcase, Live Telemetry (animated counters), How It Works (3-step flow), CTA Footer (terminal frame). Responsive: content scales with viewport — more worlds (3→5→7) and agents (6→8→12) at wider screens (1440p/4K). `prefers-reduced-motion` respected throughout. |
| P21a | **Agent Showcase** | ✅ IMPL | "Intercepted Dossiers" — real AI agents as marketing content. Reuses `VelgAgentCard` with auto rarity computation (ambassador → legendary, AI → rare). Data: fetches up to 8 simulations, scores agents by portrait (+3) / ambassador (+2) / character (+1), selects 1 per sim for diversity. Animations: scramble→decode section label, staggered spring card entrance, origin label slide-in, typewriter tagline, ambient scanner beam. Responsive grid: 3 cols (default) → 4 cols (1440px+) → 6 cols (2560px+). SEO: ItemList JSON-LD structured data. WCAG AA: `role="list"`, `aria-label`, `:focus-visible`, reduced motion. |
| P21b | **Worlds Gallery** | ✅ IMPL | `/worlds` — public simulation browser. Portal bleed effect on hover (theme-color glow). Search + pagination. Scroll reveal with staggered entrance. CTA for unauthenticated users. |
| P21c | **Chronicle Feed** | ✅ IMPL | `/chronicles` — cross-simulation public chronicle aggregation. Theme-colored source indicators. Pagination + search. |
| P21d | **Image Recovery** | ✅ IMPL | `scripts/recover_landing_images.py` — copies landing page images (hero, 3 feature images) from production Supabase to local Docker volume. Reuses `download_file`/`upload_file` from `sync_simulation.py`. |

#### A13. Heartbeat System (Simulation Pulse)

| # | Feature | Status | Beschreibung |
|---|---------|--------|-------------|
| P22 | **Heartbeat Core** | ✅ IMPL | Simulation tick system with configurable pulse rates. `heartbeat_ticks` table (Migration 129). 5 backend services: `HeartbeatService` (tick orchestration), `AnchorService` (philosophical anchor tracking), `AttunementService` (narrative sensitivity tuning), `BureauResponseService` (automated bureau reactions), `NarrativeArcService` (story arc progression). Public + authenticated API endpoints. |
| P22a | **Heartbeat Cascade** | ✅ IMPL | Cascade seed data for heartbeat tuning presets (Migration 130). Configurable tick rates and narrative thresholds per simulation. |
| P22b | **Heartbeat Tuning** | ✅ IMPL | Admin-configurable heartbeat settings (Migration 131). `AdminHeartbeatTab` in Admin Panel. Frontend: `SimulationPulse` (ambient heartbeat indicator in SimulationNav), `AnchorDashboard`, `AttunementSettings`, `BureauResponsePanel`. `HeartbeatApiService` for frontend integration. |
| P22c | **Daily Substrate Dispatch** | ✅ IMPL | Once-per-day modal on first simulation visit. Calls `GET /simulations/{id}/heartbeat/briefing` for 24h summary. Displays health status (bar + tier badge), critical/positive event counts, total entries, active arcs with pressure bars. "Classified dispatch" aesthetic: forced platform-dark tokens, scanline texture, corner brackets, watermark, classification stamp. 30s auto-dismiss with pausable progress bar. localStorage date-scoped key (`briefing_{simId}_{YYYY-MM-DD}`). Focus trap, Escape dismiss, `role="dialog"`, `role="meter"` on health bar, `prefers-reduced-motion`. "Acknowledge" (dismiss) + "View Chronicle" (navigate to Pulse tab). Skipped when `entries_24h === 0`. `DailyBriefingModal.ts` component, triggered from `SimulationShell.connectedCallback`. |

---

### B. Simulation-Features

Features die innerhalb einer Simulation existieren. Benutzer können beliebig viele Simulationen erstellen. Flaggschiff-Simulationen: Velgarien (dunkel, bürokratisch), The Gaslit Reach (Fantasy, viktorianisch), Station Null (Sci-Fi-Horror), Speranza (Post-Apokalyptisch), Cité des Dames (feministisch-literarisch, erstes helles Theme).

#### B1. Agenten-Management

| # | Feature | Status | Beschreibung |
|---|---------|--------|-------------|
| S1 | Agent erstellen | ✅ IMPL | Manuell mit Name, System, Charakter, Hintergrund. Soft-Delete via `active_agents`-View. |
| S2 | Agent bearbeiten | ✅ IMPL | Alle Felder editierbar. Optimistic Locking. Audit-Logging. |
| S3 | Agent löschen | ✅ IMPL | Soft-Delete mit Cascade auf Relationen. |
| S4 | Agenten-Liste | ✅ IMPL | Paginiert, filterbar, sortierbar. Card-Grid mit Stagger-Animation (`--i` CSS-Variable). `gridLayoutStyles` shared CSS. |
| S5 | Agent-Details | ✅ IMPL | VelgSidePanel mit Panel-Cascade-Animation. Professionen, Reaktionen, Beziehungen, Aptitude-Editor, Ambassador-Status. |
| S6 | Beschreibung generieren (AI) | ✅ IMPL | Charakter + Hintergrund per AI (OpenRouter). Modell-Fallback. Rate-Limit 30/hr. |
| S7 | Portrait generieren (AI) | ✅ IMPL | Bild per Replicate (Flux). AVIF-Format (Quality 85). Pro-Simulation Prompt-Templates. |
| S8 | Profession zuweisen | ✅ IMPL | Aus Simulation-Taxonomie. `agent_professions`-Tabelle. Min-Qualifikation pro Profession. |
| S9 | Agent-Filter | ✅ IMPL | Nach System, Gender, Profession. SharedFilterBar-Komponente. |
| S10 | Agent-Suche | ✅ IMPL | Volltextsuche über Name. `apply_search_filter()` Utility. |
| S10a | Agenten-Beziehungen | ✅ IMPL | `agent_relationships`-Tabelle. Intra-Sim gerichteter Graph mit Taxonomie-getriebenen Typen. RelationshipCard + RelationshipEditModal in AgentDetailsPanel. |
| S10b | AI-Beziehungsgenerierung | ✅ IMPL | Inline Review-Flow: "Generate Relationships" → AI-Vorschläge mit Checkboxen (alle vorausgewählt). Typ-Badge, Ziel-Agent, Beschreibung, Intensitäts-Bar. "Save Selected" / "Dismiss". |
| S10c | Agent-Aptitudes | ✅ IMPL | VelgAptitudeBars im AgentDetailsPanel (editierbarer Modus). Debounced Save. Budget-Tracking (36 Punkte). AgentsView: Lineup-Overview-Strip. |
| S10d | Ambassador-Flag | ✅ IMPL | `is_ambassador` als berechnetes Flag via `AgentService._enrich_ambassador_flag()`. BLOCKED-Badge bei `ambassador_blocked_until`. |

#### B2. Gebäude-Management

| # | Feature | Status | Beschreibung |
|---|---------|--------|-------------|
| S11 | Gebäude erstellen | ✅ IMPL | Name, Typ, Beschreibung, Stil. Soft-Delete. Audit-Logging. |
| S12 | Gebäude bearbeiten | ✅ IMPL | Alle Felder editierbar. Optimistic Locking. |
| S13 | Gebäude löschen | ✅ IMPL | Soft-Delete mit Cascade auf Relationen. |
| S14 | Gebäude-Liste | ✅ IMPL | Paginiert, filterbar. Card-Grid mit Embassy-Pulsing-Ring (`.card--embassy`). |
| S15 | Gebäude-Bild generieren (AI) | ✅ IMPL | Per Replicate (Flux). Kurze funktionale Prompt-Beschreibungen (max 30 Wörter, Migration 027). AVIF-Format. |
| S16 | Agent zuweisen | ✅ IMPL | Agent-Building Relation. Drag-Drop Zuordnung. |
| S17 | Profession-Anforderungen | ✅ IMPL | Min-Qualifikation pro Profession. Info-Bubble im Edit-Modal. |
| S18 | Spezialgebäude | ✅ IMPL | Embassy-Gebäude (`special_type = 'embassy'`). COMPROMISED-Badge bei `infiltration_penalty`. |

#### B3. Embassies & Ambassadors

| # | Feature | Status | Beschreibung |
|---|---------|--------|-------------|
| S18a | **Embassy-Gebäude** | ✅ IMPL | Cross-Sim diplomatische Gebäude. `embassies`-Tabelle (Migrationen 028-030). Auto-Aktivierung bei Erstellung. 12 Embassy-Gebäude (3 pro Simulation) + 15 Bilder generiert. |
| S18b | **EmbassyCreateModal** | ✅ IMPL | 4-Schritt-Wizard: Partner-Simulation → Protokoll → Ambassador-Ausweisung → Bestätigung. EmbassyLink-Komponente für Cross-Sim Navigation. |
| S18c | **Visuelle Effekte** | ✅ IMPL | `.card--embassy` in `card-styles.ts`: Pulsierender Ring via `box-shadow` (1px→5px), Gradient-Fill-Overlay via `::after` bei Hover, Gradient-Border via `background: padding-box/border-box`. Per-Simulation-Theme-Farben. |
| S18d | **Ambassador-Metadata** | ✅ IMPL | Ambassador-Swap bei Building-Reorder (Migration 030). `infiltration_penalty` + `ambassador_blocked_until` für Operativ-Effekte. |

#### B4. Events-System

| # | Feature | Status | Beschreibung |
|---|---------|--------|-------------|
| S19 | Event erstellen | ✅ IMPL | Manuell mit Titel, Beschreibung, Typ. Soft-Delete. Audit-Logging. |
| S20 | Event bearbeiten | ✅ IMPL | Alle Felder editierbar. Optimistic Locking. |
| S21 | Event löschen | ✅ IMPL | Soft-Delete mit Cascade auf Reaktionen. |
| S22 | Event-Liste | ✅ IMPL | Paginiert, sortiert. Bleed-Filter (Cross-Sim Events). PROPAGANDA-Badge für Propagandist-generierte Events. Impact-Bar-Segment-Grows-Animation. |
| S23 | Event generieren (AI) | ✅ IMPL | Komplettes Event per AI (OpenRouter). Prompt-Templates pro Simulation und Sprache. |
| S24 | Agenten-Reaktion generieren (AI) | ✅ IMPL | Charakter-basierte Reaktion. `list_for_reaction()` für leichtgewichtige AI-Queries. |
| S25 | Reaktionen anzeigen | ✅ IMPL | Expandierbare Reaktionsliste. Panel-Cascade-Animationen. |

#### B5. Event Echoes (Bleed-Mechanik)

| # | Feature | Status | Beschreibung |
|---|---------|--------|-------------|
| S25a | **Cross-Sim Bleed** | ✅ IMPL | `event_echoes`-Tabelle (Migration 026). Probabilistischer Bleed-Threshold basierend auf Connection-Strength. Strength-Decay über Zeit. Vector-Tag-Resonanz. |
| S25b | **Echo-Transformation-Pipeline** | ✅ IMPL | Approve → AI Generate → Create Target Event. EchoCard + EchoTriggerModal in EventDetailsPanel. Cross-Simulation Writes via Admin-Client. Cascade-Prevention. |
| S25c | **BleedSettingsPanel** | ✅ IMPL | Konfigurierbare Bleed-Parameter in Settings-UI. Extends BaseSettingsPanel. |
| S25d | **Bleed Palimpsest Overlay** | ✅ IMPL | Ganzseitige Palimpsest-Überlagerung bei aktiven Bleeds: `BleedPalimpsestOverlay` rendert pro Bleed-Quelle `BleedMarginalia` (Fremd-Theme-gefärbte Marginalia-Einträge mit Zitat-Fragmenten) + `BleedRedaction` (zensierte Textstreifen im redacted-Stil). Aktiviert sich automatisch wenn `bleedStatus.active_bleeds.length > 0`. Foreign-Theme-Integration (Primärfarbe + Heading-Font aus Quell-Simulation). |
| S25e | **Entropy Text Corruption & Card Distortion** | ✅ IMPL | SimulationShell-Effekte bei `threshold_state === 'critical'`: Text-Scramble ersetzt zufällige Buchstaben mit Glitch-Zeichen (▓░▒█╪╫╬┼╳⌧∅), Karten werden zufällig rotiert (-2.5° bis +2.5°) mit periodischem Shake-Flicker. Deceleration Hero Moment: 3s Ease-out Transition von 1x→3x Animationsgeschwindigkeit via dynamische CSS Custom Properties (`--duration-*`). Shadow-DOM-traversal für Text-Nodes und Card-Elements. |

#### B6. Chat-System

| # | Feature | Status | Beschreibung |
|---|---------|--------|-------------|
| S26 | Konversation starten | ✅ IMPL | User-Agent → Welt-Agent. ConversationList + MessageList + MessageInput. |
| S27 | Nachricht senden | ✅ IMPL | Mit AI-Antwort-Generierung via OpenRouter. Rate-Limit 10/min. Direktionale Chat-Message-Animationen. |
| S28 | Konversations-Historie | ✅ IMPL | Kontextuelles Memory (50 Nachrichten). Cursor-basierte Pagination. |
| S29 | Agenten-Auswahl | ✅ IMPL | Chat-Partner wählen. AgentSelector-Komponente. |

#### B7. Social Trends & Kampagnen

| # | Feature | Status | Beschreibung |
|---|---------|--------|-------------|
| S31 | Trends abrufen | ✅ IMPL | Von Guardian, NewsAPI. Rate-Limit 5/min. Anon-Guard (Sign-in Message für unauthentifizierte User). |
| S32 | Trend transformieren (AI) | ✅ IMPL | In Simulations-Kontext per AI. TransformationModal. |
| S33 | Als Kampagne integrieren | ✅ IMPL | Mit Event-Erstellung. CampaignService extends BaseService. |
| S34 | Kampagnen-Dashboard | ✅ IMPL | Übersicht, Metriken. CampaignCard mit gridLayoutStyles. campaign_performance Materialized View. |
| S35 | Workflow (Fetch→Transform→Integrate) | ✅ IMPL | Einschritt-Prozess. PostTransformModal. |

#### B8. Social Media Integration

| # | Feature | Status | Beschreibung |
|---|---------|--------|-------------|
| S36 | Posts importieren | ✅ IMPL | Von Facebook. Integration-Settings-Panel für API-Keys. |
| S37 | Posts transformieren (AI) | ✅ IMPL | Dystopisch/Propaganda/Surveillance Transformation per AI. |
| S38 | Sentiment-Analyse (AI) | ✅ IMPL | Detailliert + Schnell. SentimentBadge (entfernt — direkt in Komponenten). |
| S39 | Agenten-Reaktionen (AI) | ✅ IMPL | Charakter-basierte Reaktionen auf Social Media Posts. |
| S40 | Thread-Analyse (AI) | ✅ IMPL | Kommentar-Threads analysieren. |

#### B9. Standorte

| # | Feature | Status | Beschreibung |
|---|---------|--------|-------------|
| S41 | Städte verwalten | ✅ IMPL | CRUD. LocationService-Fassade delegiert an CityService. |
| S42 | Zonen verwalten | ✅ IMPL | CRUD pro Stadt. ZoneService extends BaseService. Zone-Stability Materialized View. Security-Level-Tiers. |
| S43 | Straßen verwalten | ✅ IMPL | CRUD pro Zone. StreetService extends BaseService. Location-Level-Crossfade-Animationen. |

#### B10. Per-Simulation Lore

| # | Feature | Status | Beschreibung |
|---|---------|--------|-------------|
| S44 | **Lore-Seiten** | ✅ IMPL | Dedizierter Lore-Tab (erste Position in SimulationNav). ~3500-5000 Wörter In-World-Narrativ in 6 Kapiteln pro Simulation. Default-Landing geändert von `/agents` zu `/lore`. |
| S45 | **SimulationLoreView** | ✅ IMPL | Mappt Theme-Tokens → Lore-CSS-Variablen mit `effect()` Signal-Subscription für Reload-Resilienz. 12 CSS Custom Properties (Defaults bewahren Dashboard-Appearance). Content-Dateien in `components/lore/content/` (5 Dateien, eine pro Sim). |
| S46 | **Lore-Bilder** | ✅ IMPL | 16 Lore-Bilder (3 pro Sim + 4 Plattform) in AVIF-Format. VelgLightbox für Bild-Vergrößerung. `lightbox-open` CustomEvent für GA4-Tracking. |
| S47 | **Schema.org Markup** | ✅ IMPL | JSON-LD `Thing` Structured Data via `SeoService.setStructuredData()`. Entfernung via `removeStructuredData()`. |

#### B11. The Chronicle (Per-Simulation AI-Zeitung)

| # | Feature | Status | Beschreibung |
|---|---------|--------|-------------|
| S48 | **Chronicle-Generierung** | ✅ IMPL | AI-generierte Zeitungsausgaben pro Simulation. `ChronicleService` aggregiert Events, Echoes, Battle-Log-Einträge und Agenten-Reaktionen via `get_chronicle_source_data()` RPC. `GenerationService._generate()` mit `chronicle_generation`-Template. Edition-Nummerierung, Mock-Mode-Fallback. Auto-Translation DE. |
| S49 | **Broadsheet-Layout** | ✅ IMPL | `ChronicleView` LitElement: Viktorianisches Broadsheet-Zeitungslayout. CSS Multi-Column-Text (2 Spalten Desktop, 1 Mobil), Drop Cap auf erstem Absatz, ornamentale Linien (dick/dünn-Kombination), Theme-responsiver Masthead ("The {SimName} Chronicle"). Archiv-Index mit Leaderpoints. `--color-primary`-Akzente passen sich pro Simulation an. |
| S50 | **Chronicle-API** | ✅ IMPL | `POST /api/v1/simulations/{id}/chronicles` (editor+, admin_supabase). `GET /api/v1/simulations/{id}/chronicles` (paginiert). `GET /api/v1/public/simulations/{id}/chronicles` (anon). `simulation_chronicles`-Tabelle mit RLS (public read, service_role write). |
| S51 | **Chronicle Printing Press** | ✅ IMPL | `VelgChronicleExport` LitElement: 3 export cards (Codex PDF, Full-Res Archive, Public Prospectus). `POST .../chronicle` triggers `CodexExportService.generate_codex_pdf()` (WeasyPrint). `POST .../chronicle/hires` triggers `generate_hires_archive()` (ZIP of all `.full.avif` originals). Download URLs stored in `feature_purchases.result`. State restored from purchase history on page reload. Auto-polling during generation. Full DE translation. |

#### B12. Agent Memory & Reflection

| # | Feature | Status | Beschreibung |
|---|---------|--------|-------------|
| S51 | **Memory-Speicherung** | ✅ IMPL | `agent_memories`-Tabelle mit `vector(1536)` Embedding-Spalte (pgvector ivfflat-Index). `memory_type` ENUM (observation/reflection). `memory_source_type` ENUM (chat/event_reaction/system/reflection). `EmbeddingService` ruft OpenRouter text-embedding-3-small auf (Zero-Vector-Fallback bei Mock/Fehler). |
| S52 | **Stanford-Retrieval** | ✅ IMPL | `retrieve_agent_memories()` PL/pgSQL-Funktion: `score = 0.4 × cosine_similarity + 0.4 × (importance/10) + 0.2 × recency_decay`. Top-K-Retrieval. `last_accessed_at`-Tracking. |
| S53 | **Chat-Integration** | ✅ IMPL | `ChatAIService.generate_response()`: Vor Prompt-Erstellung werden Memories via `AgentMemoryService.retrieve()` geladen und als `{agent_memories}`-Variable in System-Prompt injiziert. Nach Response: Fire-and-forget `asyncio.create_task(AgentMemoryService.extract_from_chat())` extrahiert bemerkenswerte Beobachtungen. Admin-Client für RLS-kompatible Writes. |
| S54 | **Reflection** | ✅ IMPL | `AgentMemoryService.reflect()`: Sammelt letzte 20 Beobachtungen, synthetisiert 1-3 höherwertige Reflexionen via `memory_reflection`-Prompt-Template. Mindestens 5 Beobachtungen erforderlich. Editor+-Trigger über API. |
| S55 | **Memory-Timeline-UI** | ✅ IMPL | `AgentMemorySection` LitElement: Timeline mit Typ-differenzierten Einträgen. Beobachtungen: Monospace, faktisch. Reflexionen: kursiv, erhoben, `--color-primary`-Akzent. Importance-Pips (1-10, gefüllt/leer). Collapsible per Typ. Vertikale Timeline-Linie. "Trigger Reflection"-Button (editor+-gated). Integriert in AgentDetailsPanel nach Relationships. |
| S56 | **Memory-API** | ✅ IMPL | `GET /api/v1/simulations/{id}/agents/{id}/memories` (paginiert, filterbar nach memory_type). `POST .../memories/reflect` (editor+, admin_supabase). `GET /api/v1/public/simulations/{id}/agents/{id}/memories` (anon). `prompt_templates` für memory_extraction + memory_reflection. |

#### B13. Simulation Forge (AI-gestützte Weltenschöpfung)

| # | Feature | Status | Beschreibung |
|---|---------|--------|-------------|
| S57 | **Forge-Pipeline** | ✅ IMPL | 4-Phasen AI-Pipeline: Astrolabe (Dual-Achsen-Recherche via `TavilySearchService` — Conceptual + Intellectual, parallel, domain-targeted + 3 Philosophical Anchors) → Drafting Table (Geography/Agents/Buildings via Pydantic AI) → Darkroom (Theme-Generierung + Test-Renders) → Ignition (Materialisierung via `fn_materialize_shard` + Tri-Achsen-Lore-Recherche — Literary/Philosophical/Architectural, parallel, 20s timeout, 1 retry + Batch-Bildgenerierung). `ForgeOrchestratorService` koordiniert alle Phasen. `TavilySearchService` (`external/tavily_search.py`): AsyncTavilyClient, lazy init, `parallel_search()` via `asyncio.gather`, Domain-Targeting (Stanford Encyclopedia, Paris Review, ArchDaily etc.), 500-char Snippets. Sentry Scope Context auf allen Exception-Handlern (`forge_phase` Tag + `forge` Context mit simulation_id/draft_id/seed). Semantische RPC-Fehlerklassifizierung (402 Token-Mangel, 400 Validierung, 409 Duplikat). `_FlushingStreamHandler` fuer zuverlaessiges Logging bei uvicorn-Reloads. |
| S58 | **Phase II: Drafting Table** | ✅ IMPL | Chunked Entity-Generierung mit typed Pydantic-Modellen als `output_type`. `ForgeAgentDraft` (character: 200-300 Wörter mit physischen Eindrücken für Portrait-Gen, background: 200-300 Wörter). `ForgeBuildingDraft` (description: 150-250 Wörter mit Materialien/Sensorik für Bild-Gen, variierte building_condition). `ForgeZoneDraft` (description + 2-4 characteristics-Tags). `ForgeStreetDraft` (optionale description). `_build_chunk_prompt()` assembliert chunk-spezifische Prompts mit Seed, Anchor-Kontext, geographischem Kontext, Wortlängen-Guidance und Diversitäts-Instruktionen. **Bilingual EN+DE:** Alle Draft-Modelle enthalten `_de`-Felder, die im selben LLM-Call generiert werden (spart separaten Translations-Call). Frontend rendert via `t()` locale-aware. `fn_materialize_shard` (Migration 112) inseriert `_de`-Spalten. Migration 121: setzt `critical_health_effects_enabled = false` als Game-Setting. **Field-Length Discipline:** `ForgeAgentDraft` und `ForgeBuildingDraft` Pydantic-Modelle erzwingen `max_length` auf kurzen Feldern (name: 100, gender: 30, system: 80, primary_profession: 100, building_type: 100, building_condition: 100). Orchestrator truncated/sanitisiert kurze Felder vor DB-Write. |
| S59 | **Forge Mock-Service** | ✅ IMPL | `FORGE_MOCK_MODE=true`: Deterministisches Mock-System für alle 4 Phasen. Seed-aware via SHA-256. 8 Zonen (mit characteristics), 8 Straßen (mit descriptions), 8 Agenten (2-3 Satz character/background), 9 Gebäude (variierte conditions), 2 Theme-Presets, 5 Lore-Sektionen + DE-Übersetzungen. |
| S60 | **BYOK (Bring Your Own Key)** | ✅ IMPL | User können eigene OpenRouter/Replicate API-Keys hinterlegen (AES-256 verschlüsselt via `user_wallets`). Forge nutzt User-Keys wenn vorhanden, sonst Platform-Keys. |
| S61 | **Forge-Frontend** | ✅ IMPL | VelgForgeWizard (Multi-Step), VelgForgeTable (Draft-Management), VelgForgeAstrolabe (Pipeline-Visualisierung + Research-Source-Hint: gruener Dot + Label bei Tavily-Grounding, grauer Dot bei Emulator-Fallback), VelgForgeDarkroom (Theme-Tuning), VelgForgeIgnition (Materialisierungs-Bestätigung mit Fehleranzeige + Retry), VelgForgeScanOverlay (Scan-Animation mit Lore-Phasen-Looping, Mission Clock, ETA-Countdown, asymptotischem Fortschrittsbalken). Retro-Terminal CRT-Ästhetik (gruen auf schwarz). `ForgeStateManager` mit sessionStorage-Persistenz fuer Draft-ID (ueberlebt Page-Refresh) + localStorage-Timing-Records fuer ETA-Schaetzung. `ForgeDraft`-Interface erweitert um `research_context: { raw_data, source }`. |
| S65 | **Forge Generation Loading UX** | ✅ IMPL | Lore-thematische Lade-Erfahrung fuer alle Forge-Generierungsphasen (200+ Sekunden). 51 thematische Statusmeldungen pro Generierungstyp (Research/Geography/Agents/Buildings), vollstaendig DE-uebersetzt, als Getter-Methoden (behebt latenten i18n-Bug bei statischen `msg()`-Arrays). `VelgForgeScanOverlay` erhaelt `estimatedDurationMs`-Prop: aktiviert zeitbasiertes Phasen-Looping (Modulo statt Stopp), Mission Clock (1s-Intervall), ETA-Countdown (wechselt zu amber pulsierendem "RECALIBRATING..." bei Ueberschreitung), asymptotischer Fortschrittsbalken (linear bis 90% der Schaetzung, dann Exponential-Decay `90 + 8*(1-e^(-overshoot*2))` gegen 98% — stagniert nie, erreicht nie 100%). `ForgeStateManager.getEstimatedDuration(type)` berechnet Rolling-Average aus localStorage (letzte 5 pro Typ), Fallback auf Hardcoded-Defaults (research: 30s, geo: 120s, agents: 180s, buildings: 150s). `_recordTiming()` speichert nach jeder Generierung (max 20 Eintraege). `lastGenerationRecovered`-Signal fuer differenzierte Recovery-Toasts. Backward-kompatibel: `estimatedDurationMs=0` (Default) erhaelt unveraendertes Verhalten. `prefers-reduced-motion` respektiert. |
| S66 | **Replicate Billing Error Abort** | ✅ IMPL | `ReplicateBillingError` Subklasse in `replicate.py`: erkennt Billing/Credit/402-Fehler anhand Keywords in Replicate API-Responses. `run_batch_generation` umschliesst Phase B (Banner → Portraits → Buildings → Lore) mit aeusserem `try/except ReplicateBillingError` — bei Billing-Fehler sofortiger Batch-Abbruch statt stilles Einzelbild-Scheitern (verhindert 0/14-Ceremony-Haenger). Einzelbild-Fehler (nicht Billing) werden weiterhin geloggt und der Batch faehrt fort. |
| S62 | **Forge Ceremony — Card Dealer Spread** | ✅ IMPL | VelgForgeCeremony Post-Ignition-Screen redesigned: Zwei Kartenfächer (Agenten links, Gebäude rechts) mit Bogen-Rotation (3° pro Position, 5px Arc-Dip). `sm`-Kartengröße (120×192) statt `xs`. Dynamische Überlappung berechnet sich aus Viewport-Breite. Hover hebt Karte an und richtet sie gerade aus. Zonen-Badge als vertikaler Divider zwischen den Fächern. Responsive Shard-Name mit `clamp(1.2rem, 4vw, 2.5rem)`. Prominenter Enter-Button mit Breathing-Glow-Animation. Fan-Labels ("6 AGENTS" / "7 BUILDINGS") ersetzen separate Stats-Zeile. Alle Animationen respektieren `prefers-reduced-motion`. |
| S63 | **Forge Image Progress Polling** | ✅ IMPL | Live-Bildfortschritt während Ceremony: Polling alle 4s via `get_forge_progress` Postgres RPC (Migration 098). Fortschrittsbalken ("3/14 MATERIALIZING..."). Brightness-Flash-Microanimation bei neuen Bildern. Enter-Button gesperrt bis alle Bilder fertig ("MATERIALIZING ASSETS ..." → "ENTER NEW SHARD →"). Auto-Enter 8s nach Abschluss. 5-Minuten Safety-Timeout. Karten-`image-url`-Attribut wird live aktualisiert. **Lore Generation Progress (Migration 123):** `simulations.lore_progress` jsonb-Spalte trackt per-section Fortschritt (phase, section_index, sections_total, current_section). `get_forge_progress()` liefert `lore_progress` im Response. Frontend zeigt Echtzeit-Status der Lore-Generierung waehrend der Forge-Zeremonie an. |
| S67 | **AI Timeout Protection + Observability** | ✅ IMPL | `run_ai()` Wrapper in `ai_utils.py`: Injiziert `PYDANTIC_AI_TIMEOUTS` (60-300s je Purpose) in `model_settings` via `setdefault`. pydantic-ai reicht Timeout an httpx weiter — bei Hang wird `APITimeoutError` geworfen statt unendlich zu blockieren. Alle 17 `agent.run()`-Callsites auf `run_ai()` umgestellt. Vollstaendige Observability: Start/Complete/Fail-Logs mit Purpose + elapsed_s. `safe_background()` loggt Dauer. `run_batch_generation`: Phase A/B-Timing, `batch_id`-Korrelation, Per-Image Progress (`{n}/{total}`), Summary-Log mit `images_succeeded/failed`. Sub-Step-Boundary-Logs in `_generate_lore_and_translations` (deep research, lore generation, lore translation, entity translation). **Sentry Scope Context:** Alle Exception-Handler in `ForgeOrchestratorService` + `ResearchService` nutzen `sentry_sdk.push_scope()` mit `forge_phase` Tag und `forge` Context (simulation_id, draft_id, seed, entity_type, chunk_type, agent_count, purchase_id). 13 Sentry-Capture-Points im Orchestrator, 3 in ResearchService. |
| S68 | **Admin Batch Retrigger** | ✅ IMPL | `POST /admin/retrigger-batch/{simulation_id}`: Re-runs Phase A (Lore + Translations) + Phase B (Images) fuer bestehende Simulationen. `reconstruct_draft_data()` baut `draft_data` aus materialisierten Tabellen (agents, buildings, zones, streets, simulation_settings). Loescht bestehende Lore vor Re-Generation (Duplikat-Vermeidung). Admin-only, rate-limited, audit-logged. |
| S64 | **Post-Ceremony Image Loading States** | ✅ IMPL | Nach Ceremony-Enter zeigen Entity-Views Shimmer-Animationen auf Karten/Lore-Bildern während Hintergrund-Bildgenerierung läuft. `ForgeStateManager.startImageTracking(slug)` pollt `get_forge_progress` alle 5s (erweitert um `lore`-Array + `banner_url`, Migration 107). `imageUpdateVersion`-Signal triggert View-Re-Fetches bei neuen Bildern. `VelgGameCard.generating`-Property: diagonaler Shimmer-Gradient (`color-mix` mit `--card-frame-primary`), Placeholder-Pulse, Brightness-Flash-Reveal (2.5→1 + scale 1.05→1) bei Bild-Ankunft. `LoreScroll`: `pendingImageSlugs`-Set verhindert URL-Konstruktion für unfertige Bilder, Shimmer-Placeholder mit 3:2 Aspect Ratio, `_seenImageSlugs`-Set für Reveal nur bei neuen Bildern. `simulation_lore.image_generated_at` trackt Lore-Bild-Completion. Slug-matched Generating-Check verhindert Cross-Simulation Shimmer-Leak. `prefers-reduced-motion` respektiert. `aria-busy` auf generierenden Karten. |

---

### C. Settings-Features

| # | Feature | Status | Beschreibung |
|---|---------|--------|-------------|
| C1 | **General Settings** | ✅ IMPL | Name, Beschreibung, Thema, Sprache. Liest direkt von `simulations`-Tabelle (nicht BaseSettingsPanel). |
| C2 | **World Settings** | ✅ IMPL | Taxonomien verwalten (Systeme, Professionen, etc.). Taxonomy-Editor UI. |
| C3 | **AI Settings** | ✅ IMPL | Modelle pro Zweck (chat, generation, bot_chat), Prompt-Templates, Parameter. `bot_chat_mode`-Toggle + `model_bot_chat`-Selector. Extends BaseSettingsPanel. |
| C4 | **Integration Settings** | ✅ IMPL | Social Media Accounts, News-Quellen, API-Keys (AES-256 verschlüsselt). Extends BaseSettingsPanel. |
| C5 | **Design Settings** | ✅ IMPL | Per-Simulation Theming: 37 Token-Overrides (Farben, Typographie, Charakter, Animation), 6 Theme-Presets (dark-brutalist, deep-space-horror, arc-raiders, gaslit-reach, illuminated-literary + custom). Live-Preview, Custom CSS. WCAG 2.1 AA validiert. Extends BaseSettingsPanel. |
| C6 | **Access Settings** | ✅ IMPL | Öffentlich/Privat, Einladungen, Rollen. Extends BaseSettingsPanel. |
| C7 | **Taxonomy Editor** | ✅ IMPL | UI zum Hinzufügen/Bearbeiten/Deaktivieren von Taxonomie-Werten. Locale-aware Labels. |
| C8 | **Prompt Template Editor** | ✅ IMPL | UI zum Bearbeiten von AI-Prompts pro Sprache (EN/DE). PromptTemplateService. |
| C9 | **Model Selector** | ✅ IMPL | AI-Modell pro Generierungs-Zweck wählen. Fallback-Ketten. |
| C10 | **View Settings** | ✅ IMPL | Ansichts-Einstellungen für Simulation. ViewSettingsPanel. |
| C11 | **Notifications Settings** | ✅ IMPL | NotificationsSettingsPanel: 3 Toggle-Switches (cycle_resolved, phase_changed, epoch_completed). Per-User Email Opt-in/Opt-out. email_locale-Feld. |
| C12 | **Bleed Settings** | ✅ IMPL | BleedSettingsPanel: Konfigurierbare Bleed-Parameter (Threshold, Decay, Resonanz). Extends BaseSettingsPanel. |

---

### D. Cartographer's Map (Multiverse-Visualisierung)

| # | Feature | Status | Beschreibung |
|---|---------|--------|-------------|
| D1 | **Force-Directed Graph** | ✅ IMPL | Custom Physics-Simulation in `map-force.ts` (~130 Zeilen). SVG-Rendering in Lit Shadow DOM mit Pan/Zoom. Mobile Fallback zu Card-Liste bei ≤768px. Template/Instance-Orbit-Physik, Instance-Clustering. |
| D2 | **Starfield & Ambient** | ✅ IMPL | 200 zufällige SVG-Kreise, 25% Twinkle-Animation. Energy-Pulses (animateMotion entlang Edge-Pfaden). Node-Glow-Drift (JS requestAnimationFrame, Kreise driften Richtung verbundener Nachbarn). `transform-box: fill-box` Fix. |
| D3 | **Game Instance Visualization** | ✅ IMPL | Gestrichelte rotierende Border-Ringe, Phase-Ring-Pulse (Farbe pro Epoch-Phase), Phase-Labels, 5-Dimensionen Health-Arcs, Sparkline Composite Scores auf Template-Nodes, Operative-Type-Trails auf Kanten, Operative-Heat auf Edge-Breite/Opacity, Search mit Node-Fade, Zoom-to-Cluster bei Doppelklick, Reset-Zoom-Button. |
| D4 | **MapBattleFeed** | ✅ IMPL | Scrollender öffentlicher Battle-Log-Ticker am Karten-Unterrand. `GET /api/v1/public/battle-feed`. |
| D5 | **MapLeaderboardPanel** | ✅ IMPL | VelgSidePanel für Epoch-Scores bei Instance-Klick. 5-Dimensionen-Scores. |
| D6 | **MapMinimap** | ✅ IMPL | 150×100px Viewport-Übersicht unten rechts. |
| D7 | **MapConnectionPanel** | ✅ IMPL | Connection-Details bei Edge-Klick. MapTooltip für Game-Instance-Tooltips mit Score-Dimensionen-Bars. |
| D8 | **Auto-Refresh** | ✅ IMPL | 30s automatischer Refresh während aktiver Epochs. `ConnectionService.get_map_data()` angereichert mit active_instance_counts, operative_flow, score_dimensions, sparklines. `_fetch_map_simulations` liest die `map_simulations` Postgres-View (migration 091) — filtert completed/cancelled Game-Instances serverseitig heraus. |
| D9 | **Cartographer's Desk** | ✅ IMPL | Intelligence Operations Light Table — Bureau of Impossible Geography. Atmosphärische Container-Komponente für die Kartografie-Ansicht: Backlit-Drafting-Table-Ästhetik mit Edge-Glow, taktischer Toolbar, Status-Indikatoren, "BUREAU SURVEY"-Klassifizierungsstempel (rot, `--color-stamp-red`), Kompassrose. Responsive: Toolbar wrap, Compass hidden auf Mobil. |
| D10 | **Map Layers** | ✅ IMPL | `MapLayerToggle`-Komponente: 4 umschaltbare Layer (Infrastructure, Bleed Activity, Military Operations, Historical Events) mit dedizierten Icons. Aktiver Layer hat bernsteinfarbene Akzente. Keyboard-navigierbar. Layer-Typ steuert Datenvisualisierung auf der CartographicMap. |
| D11 | **Cartographic Map (SVG)** | ✅ IMPL | `CartographicMap`: Zone-basierte SVG-Karte mit Pan/Zoom (Mausrad + Drag). Zone-Hexagone farbkodiert nach Stabilität (rot < 0.3, gelb < 0.6, grün ≥ 0.6). Zone-Labels, Building-Counts, Security-Badges. Hover-Vergrösserung. Click → `zone-select` CustomEvent. Grid-Layout berechnet aus `Math.ceil(√n)`. |
| D12 | **Map Annotations** | ✅ IMPL | `MapAnnotationTool`: Toggle-basiertes Annotations-System. Aktiv-State mit bernsteinfarbener Highlight-Taste "Annotate". Integrations-Punkt für zukünftige User-Notizen auf der Karte. |
| D13 | **Map Overlay Data RPC** | ✅ IMPL | `get_map_overlay_data(uuid[])` Postgres-Funktion (Migration 100): Zone-Topologie, historische Events (Top 20 pro Sim), aktive Bleed-Details in einem einzigen Round-Trip. Ersetzt drei separate Python-Methoden (`_fetch_zone_topology`, `_fetch_historical_events`, `_fetch_active_bleed_details`). |

---

### E. Game Systems (Mechanisch bedeutsame Attribute)

| # | Feature | Status | Beschreibung |
|---|---------|--------|-------------|
| E1 | **Materialized Views** | ✅ IMPL | Migration 031: `mv_building_readiness`, `mv_zone_stability`, `mv_embassy_effectiveness`, `mv_simulation_health`. `agent_statistics` + `campaign_performance`. |
| E2 | **GameMechanicsService** | ✅ IMPL | 4 API-Endpoints für berechnete Attribute. Computed Metrics für AI-Prompt-Integration. |
| E3 | **Info Bubbles** | ✅ IMPL | `renderInfoBubble(title, text)` Shared-Render-Funktion in allen Edit-Modals + SimulationHealthView Dashboard. |
| E4 | **Bleed-Pipeline** | ✅ IMPL | Probabilistischer Bleed-Threshold, Strength-Decay, Vector-Tag-Resonanz, Echo-Transformation-Pipeline (approve → AI generate → create target event). |
| E5 | **Threshold System** | ✅ IMPL | 3 Schwellenwert-Zustände: `normal` (health 0.25–0.85), `critical` (< 0.25), `ascendant` (> 0.85). `get_bleed_status` Postgres RPC (Migration 099): Aggregiert Health, Echoes, Foreign Themes, Lore in einem Round-Trip. Frontend: `SimulationShell` setzt CSS-Klassen (`.shell--critical`, `.shell--ascendant`), überschreibt `--color-surface-raised` via CSS-Tokens. |
| E6 | **Entropy UI (Critical State)** | ✅ IMPL | 4 Overlay-Komponenten bei `threshold_state === 'critical'`: `EntropyOverlay` (Vignette + roter Pulse + Grain-Noise), `EntropyTimer` (digitale Countdown-Anzeige, Fixed Bottom-Left), `DesperateActionsPanel` (3 Notfall-Aktionen: Scorched Earth, Emergency Draft, Reality Anchor — Fixed Bottom-Center mit expandierbarem Fan-Layout), Text-Corruption + Card-Shake in SimulationShell. `--color-entropy-*` Design-Tokens. 12s Entropy-Drift Filter-Animation (Entsättigung + Sepia + Hue-Shift). |
| E7 | **Ascendancy UI (Ascendant State)** | ✅ IMPL | `AscendancyAura`: Goldener Glow-Overlay bei `threshold_state === 'ascendant'`. `--color-ascendant-gold` + `--color-ascendant-border` Tokens. `--color-surface-raised-ascendant` für warme Oberflächen. Subtile Radial-Gradient-Aura. |
| E8 | **Threshold Actions** | ✅ IMPL | 3 Notfall-Aktionen bei kritischem Zustand: `scorched_earth` (Zone zerstören, reduziert Druck), `emergency_draft` (Notfall-Rekrutierung, füllt offene Stellen), `reality_anchor` (Realitätsanker, stabilisiert Bleed-Permeabilität). `ThresholdService` (274 Zeilen). `threshold_actions`-Tabelle (Migration 097). POST `/api/v1/simulations/{id}/threshold-actions/{type}`. Entropy-Countdown: 10 Zyklen minus Aktionen-Count → 0 = Zusammenbruch. |
| E9 | **Bleed Status RPC** | ✅ IMPL | `get_bleed_status(uuid)` Postgres-Funktion (Migration 099, SECURITY DEFINER seit Migration 120): Ersetzt N+1 Python-Queries (7 Queries pro Quell-Simulation) mit einer einzigen Abfrage. CTEs: `strongest_per_source` (DISTINCT ON), `source_enriched` (Joins: Sim-Name, Theme via `setting_value #>> '{}'`, Lore-Fragment). Gibt `effects_suppressed` zurück (liest `platform_settings` + `simulation_settings` für Admin-Toggle). AppStateManager: `bleedStatus` + `thresholdState` Signals für globalen Zugriff. |

---

### F. SEO, Analytics & Plattform-Infrastruktur

| # | Feature | Status | Beschreibung |
|---|---------|--------|-------------|
| F1 | **Slug-basierte URLs** | ✅ IMPL | `/simulations/speranza/lore` statt UUIDs. Backend: `/api/v1/public/simulations/by-slug/{slug}`. Frontend: `_resolveSimulation()` in app-shell `enter()` Callback. 301-Redirects von UUID→Slug für Crawler. |
| F2 | **SEO Structured Data** | ✅ IMPL | JSON-LD Schema.org Markup (`SeoService`). Epoch → `Event`, Lore → `Thing`. robots.txt + dynamischer sitemap.xml aus DB. Server-side Crawler Meta-Injection (Middleware). Build-time Prerender (`scripts/prerender.py`): generiert statische HTML-Snapshots fuer alle Simulationen + Platform-Pages in Docker-Build-Stage (Supabase REST API). |
| F3 | **GA4 Analytics** | ✅ IMPL | 37 GA4-Events via deklarative EVENT_MAP (29 DOM-Events, 8 Service-Level). Production-Only Guard. Consent Mode v2. Measurement ID `G-G10NQ7LNYY`. |
| F4 | **Cookie Consent** | ✅ IMPL | Fixed Bottom Banner. Accept/Decline Analytics. Privacy-Policy-Link. localStorage-Persistenz. GDPR-konform. |
| F5 | **Crawler-Erkennung** | ✅ IMPL | SEO Middleware: Googlebot, Bingbot, AI-Bots (GPTBot, ChatGPT, Claude, Anthropic, PerplexityBot, etc.). HTML-Enrichment für Crawler. |
| F6 | **IndexNow** | ✅ IMPL | Bing/Yandex/Seznam/Naver Benachrichtigung bei Seitenänderungen. API-Key auf Server hinterlegt. |
| F7 | **Sentry Error Tracking** | ✅ IMPL | Frontend: `@sentry/browser` Integration (`SentryService`), API-Fehler-Capture in `BaseApiService`. Backend: `sentry_sdk.capture_exception()` in cycle_resolution, email, bot, Forge-Orchestrator (13 Capture-Points), ResearchService (3 Capture-Points). Scope Context mit `forge_phase`-Tags. 42 Logger-Instanzen ueber alle Routers/Services. **CI/CD:** Release-Tagging (Git-SHA), Source-Map-Upload via `@sentry/vite-plugin` im Docker-Build, Commit-Association via `getsentry/action-release@v3`, Post-Deploy Health Check mit automatischer Sentry-Regressionsabfrage. Siehe `docs/guides/sentry-cicd-integration.md`. |
| F7b | **Ambient Weather System** | ✅ IMPL | Real-world weather seeding via Open-Meteo API (free, no key). Each simulation anchored to geographic location matching its theme (Velgarien → Prague, Station Null → Svalbard, Speranza → Amalfi, Gaslit Reach → Lofoten, Cite des Dames → Carcassonne). Composable 4-layer template system: 1.025 bilinguale Fragmentpaare generieren tausende einzigartiger Narrative (Opener × Core Weather × Consequence × Agent Reaction). SHA-256 seeded selection mit Tetris 7-bag Anti-Repetition. Zone-ambient Moodlets beeinflussen Agent-Stimmung. WMO-Code-Klassifikation (17 Kategorien), Mondphasen-Berechnung (pure math), Plan A/B/C Fallback-Kette (API → cached → climate table). WeatherSettingsPanel (Admin UI): Toggle, Koordinaten, Theme-Override. Zone-Cards zeigen Wetter-Indikator. Daily Briefing enthält Weather-Section. Zero LLM calls. Siehe `docs/concepts/tamagotchi-proposals.md` Proposal 3. |
| F8 | **Accessibility Improvements** | ✅ IMPL | ECharts Chart-Wrapper: `role="img"` + `aria-label` fuer Screen-Reader-Zugaenglichkeit. Agent-Edit-Modal: Alt-Text fuer Portrait-Bilder. Dynamic SEO-Descriptions fuer Simulationen. VideoGame Schema auf Homepage. hreflang-Cleanup. SharedFilterBar Mobile-Fix. |

---

### G. i18n & Theming

| # | Feature | Status | Beschreibung |
|---|---------|--------|-------------|
| G1 | **Lit Localize (Runtime)** | ✅ IMPL | 2279 lokalisierte UI-Strings (EN/DE). `msg()` + `str` Template Literals. XLIFF-Workflow (extract → translate → build). Claude 4.6 für Übersetzungen. `&amp;`-Bug-Fix via sed. |
| G2 | **Per-Simulation Theming** | ✅ IMPL | 6 Theme-Presets mit 37 Token-Overrides. `ThemeService` mit `animation_speed`-Multiplikator (7 Duration-Tokens). `hover_effect`-Bridge schreibt `--hover-transform` CSS Property. WCAG 2.1 AA validiert (4.5:1 Text, 3.0:1 Muted/Buttons/Badges). |
| G3 | **Spectral Bureau Font** | ✅ IMPL | `--font-bureau` CSS Property (Spectral Serif). 19th-Century French Academic für Bureau-Level Plattform-Content (LoreScroll narrative text, Dashboard). Google Fonts Integration (+ Libre Baskerville, Barlow). LoreScroll `.section__title` verwendet `--font-brutalist` (+ `--heading-weight`, `--heading-transform`, `--heading-tracking` Tokens) um Simulations-Theme-Fonts zu respektieren. |

---

### H. Dramatische Mikroanimationen

| # | Feature | Status | Beschreibung |
|---|---------|--------|-------------|
| H1 | **Stagger-Pattern** | ✅ IMPL | `--i` CSS Custom Property aus `.map()` Index. Neue Tokens: `--duration-entrance` (350ms), `--duration-stagger` (40ms), `--duration-cascade` (60ms), `--ease-dramatic`, `--ease-spring`, `--ease-snap`. |
| H2 | **Animationstypen** | ✅ IMPL | Card-Grid-Stagger (Agent/Building/Event/Campaign/Social), Detail-Panel-Cascades (nth-child), Badge-Pop (VelgBadge), Impact-Bar-Segment-Grows, Direktionale Chat-Messages, Settings-Tab-Stagger + Content-Crossfade, Dashboard-Shard-Entrance, Header-Letter-Spacing-Collapse, Empty-State 3-Step-Cascade + Icon-Idle-Rotation, Toast-Slide-Out-Fix, Create-Button-Materialize, Filter-Chip-Pop, Location-Level-Crossfade. |
| H3 | **Motion Preferences** | ✅ IMPL | `prefers-reduced-motion` Kill-Switch auf allen Animationen. Theme-aware Duration-Scaling via ThemeService. |

---

### I. Event Pressure & Zone Dynamics

| # | Feature | Status | Beschreibung |
|---|---------|--------|-------------|
| I1 | **Graduated Event Pressure** | ✅ IMPL | `POWER(impact_level/10, 1.5)` Druckformel mit Status-Multiplikatoren (escalating=1.3x, resolving=0.5x). Emotions-gewichteter Reaction-Modifier. |
| I2 | **Event Lifecycle** | ✅ IMPL | Event-Status-Workflow: active → escalating → resolving → resolved → archived. Event Chains (escalation, follow_up, resolution, cascade, resonance). |
| I3 | **Zone Gravity Matrix** | ✅ IMPL | Event-Typ → Zone-Typ Affinitaets-Matrix. Auto-Zuordnung via `assign_event_zones()` Trigger. `_global` Flag fuer krisenbezogene Events. |
| I4 | **Zone Vulnerability Matrix** | ✅ IMPL | Zone-Typ × Event-Typ Multiplikatoren (0.5x-1.5x). Per-Simulation konfigurierbar via simulation_settings. |
| I5 | **Cascade Events** | ✅ IMPL | Automatische Folgeereignis-Erzeugung wenn Zone-Druck > 0.7. Rate-limitiert, quarantaene-immun. Zone-Typ-spezifische Templates. |
| I6 | **Zone Actions** | ✅ IMPL | Spieler-Interventionen: fortify (+0.3, 7d/14d), quarantine (-0.1 + cascade-block, 14d/21d), deploy_resources (+0.5, 3d/30d). Cooldown-Validierung. |
| I7 | **Event Seismograph** | ✅ IMPL | SVG Seismograph-Visualisierung (30/90/180/365 Tage). Spike-Farben nach Impact, Druckueberlagerung, Brush-Selektion, Resonanz/Kaskade-Marker. |

---

### J. Substrate Resonances

| # | Feature | Status | Beschreibung |
|---|---------|--------|-------------|
| J1 | **Resonance Detection** | ✅ IMPL | 8 Source-Kategorien (economic_crisis, military_conflict, pandemic, etc.) → 8 Resonanz-Signaturen → 8 Archetypen. Auto-Derivation via Postgres Trigger. |
| J2 | **Susceptibility Profiles** | ✅ IMPL | Per-Simulation Empfindlichkeits-Profile (0.4-1.8 Multiplikator). 5 benannte Simulationen mit individuellen Profilen. Effective Magnitude = magnitude × susceptibility. |
| J3 | **Impact Processing** | ✅ IMPL | Platform-Admin triggered Impact-Pipeline: 2-3 AI-generierte Events pro Simulation. Status-Workflow: pending → generating → completed. Auto-Transition zu 'subsiding'. |
| J4 | **Operative Integration** | ✅ IMPL | Archetyp-Operative Affinitaeten (+0.03 aligned, -0.02 opposed). Netto-Modifier [-0.04, +0.04]. Zone-Pressure-Bonus (max 0.04). Attacker-Pressure-Penalty (max -0.04). Subsiding-Resonanzen 0.5x Decay. Bot-Awareness fuer Resonanz-Druck. |
| J5 | **Resonance Monitor** | ✅ IMPL | Platform-Level Dashboard (`<resonance-monitor>`). Status-Filter, Signatur-Filter, Auto-Refresh 60s. Magnitude-Farbkodierung (cyan/amber/rot). |
| J6 | **Admin Resonances Panel** | ✅ IMPL | Vollstaendiges Admin-Panel (`<velg-admin-resonances-tab>`). CRUD + Status-Transition + Impact-Verarbeitung + Soft-Delete/Restore. Formular-Modal mit Derivation-Preview. |
| J7 | **Balance Fixes v2** | ✅ IMPL | Infiltrator-Oppositionen (The Entropy + The Devouring Mother). Subsiding-Resonanzen 0.5x Decay. Caps reduziert (0.06→0.04 fuer Pressure + Modifier). Attacker-Pressure-Penalty (`fn_attacker_pressure_penalty`, max -0.04). `active_resonances`-View schliesst archivierte aus. `fn_target_zone_pressure` NULL-Bug Fix. |
| J8 | **Auto-Processing Scheduler** | ✅ IMPL | `ResonanceScheduler` asyncio Background-Task (Lifespan-managed). Periodisch auf faellige Resonanzen pruefen (`status='detected'` + `impacts_at <= now()`). Auto-Process via `ResonanceService.process_impact()`. System-Actor-Pattern (Admin-Client, Zero-UUID). Konfigurierbar via `platform_settings` (`resonance_auto_process_enabled`, `resonance_auto_process_interval_seconds`). Fehlertoleranz: loggt Fehler pro Resonanz, setzt Loop fort. |

### J+. Resonance Dungeons

| # | Feature | Status | Beschreibung |
|---|---------|--------|-------------|
| RD1 | **Dungeon Engine** | ✅ IMPL | `DungeonEngineService` In-Memory-Orchestrator mit Checkpoint-to-DB nach jeder Transition. 13-Phasen-State-Machine (exploring→combat_planning→combat_resolving→...). Auto-Recovery aus Checkpoint bei Server-Neustart. Migration 163+164+165. |
| RD2 | **Combat System** | ✅ IMPL | Shared `backend/services/combat/` Modul (6 Dateien). Phase-basierter Kampf: Planning (45s Timer) → Resolution → Outcome. 18 Fähigkeiten in 6 Schulen (Spy/Guardian/Assassin/Propagandist/Saboteur/Infiltrator). Stalemate-Mechanik bei Runde 10. |
| RD3 | **The Shadow (Phase 0)** | ✅ IMPL | Erster Archetyp: Sichtbarkeits-Mechanik (3 VP, Drain alle 2 Räume). 5 Feinde, 11 Encounters, 41 Banter, 11 Loot-Items. Boss: "The Remnant". VP0-Bonus: +50% Loot-Upgrade-Chance. 2 Playtests, 755+ Tests. |
| RD4 | **The Tower (Phase 1)** | ✅ IMPL | Zweiter Archetyp: Stabilitäts-Countdown (100→0, tiefenbasierter Drain). Structural Failure Mode bei Stabilität 0. 5 Feinde (Bebenmakler, Grundwurm, Der Gekrönte, Schuldgespenst, Relikt des Handels), 11 Encounters, 45 Banter, 12 Loot-Items. Boss: "The Collapse". Guardian "Reinforce" (+10 Stabilität). Stabilitäts-Loot-Bonus (≥80 → Tier-Upgrade). 119 neue Tests. |
| RD5 | **Multi-Archetype Dispatch** | ✅ IMPL | Strategy Pattern (`ArchetypeStrategy` ABC) in `archetype_strategies.py`. 4 abstrakte Core-Methoden (init_state, apply_drain, apply_restore, apply_encounter_effects) + 3 optionale Hooks (ambient_stress_multiplier, on_combat_round, on_failed_check). `ShadowStrategy` + `TowerStrategy` implementiert. Dict-Registry, O(1) Lookup. Archetype N = 1 neue Strategy-Klasse + 1 Registry-Eintrag, 0 Engine-Änderungen. |
| RD6 | **Dungeon Frontend** | ✅ IMPL | DungeonTerminalView (CRT/Submarine-Ästhetik), DungeonHeader (Depth Gauge + Visibility Pips + Stability Gauge), DungeonMap (SVG mit reveal-blip/depth-ping Micro-Animationen), DungeonCombatBar (45s Timer mit 3-Stufen-Urgency: amber→warning→critical, multi-layer Danger-Animation bei ≤5s, kompaktes 2-Spalten Onboarding-Briefing), DungeonPartyPanel, DungeonEnemyPanel. 5 semantische Combat-Log-Farben. Terminal-Command-Event-Forwarding. BureauTerminal-Statusbar mit `LOC:`/`RUN:` Kontext-Prefix. Instance-TTL-Cleanup (60s Loop, evict + DB-RPC `fn_expire_abandoned_dungeon_runs`). |
| RD7 | **Loot Distribution** | ✅ IMPL | `distributing` Phase zwischen Boss-Sieg und Abschluss. Auto-Apply (Sim-weite Effekte) vs. Distributable (Spieler wählt Empfänger). Smart Suggestions. Migration 165 (CHECK constraint, RPCs). |
| RD8 | **Persistent Responsive Dungeon Map** | ✅ IMPL | 3-Spalten-Layout ab 1440px+ (Map dauerhaft sichtbar), FAB+Dialog unter 1200px. Responsive Breakpoints mit SimulationShell-Integration. |
| RD9 | **VelgHoldButton Shared Component** | ✅ IMPL | `<velg-hold-button>` Shared Component fuer Press-and-Hold-Interaktionen. Verwendet in Dungeon-Aktionen. |
| RD10 | **The Entropy (3. Archetyp)** | ✅ IMPL | Dritter Archetyp: Decay-Mechanik (0→100, Dissolution). 5 Feinde, 11 Encounters, 45 Banter, 12 Loot-Items. Guardian "Preserve" (-Decay). Decay-Loot-Bonus (≤20 → Tier-Upgrade) + Decay-Penalty (≥60 → Tier-Downgrade). |
| RD11 | **The Devouring Mother (4. Archetyp)** | ✅ IMPL | Vierter Archetyp: Parasitäre Bindung (0→100, invertierte Mechanik). 4 Feinde, 15 Encounters, 45 Banter, 12 Loot-Items. Guardian "Sever" (-Attachment). Attachment-Gauge (4 Farbstufen: phosphor→warning→danger-blend→danger). |
| RD12 | **The Prometheus (5. Archetyp)** | ✅ IMPL | Fünfter Archetyp: Insight-Crafting (0→100, Pharmakon-Akkumulation). 8 Feinde, 13 Encounters, 34 Banter, 13 Loot-Items. Crafting-System mit 4 craftbaren Items, dynamische Boss-Deployment-Choices. |
| RD13 | **The Deluge (6. Archetyp)** | ✅ IMPL | Sechster Archetyp: Steigende Flut (0→100, Tidal Pulse, invertiertes Dungeon). 5 Feinde, 17 Encounters, 26 Banter, 11 Loot-Items. Guardian "Seal Breach" (-Water Level, Cooldown 3 Rooms). Wasser-Gauge (4 Stufen), tiefenbasierte Ambush-Modifikation. Migration 173 (Content Seed). |
| RD14 | **Deluge: Inverted Loot Gradient** | ✅ IMPL | `roll_loot()` Deluge-Branch: Low-Water-Bonus (water ≤ 25 → 50% T1→T2 Upgrade) + Depth-Bonus (depth ≤ 2 → garantiertes T2). Verwendet Config-Keys aus `ARCHETYPE_CONFIGS`. |
| RD15 | **Deluge: Salvage Mechanic** | ✅ IMPL | Full-Stack: POST `/runs/{id}/salvage`, `SalvageRequest` Model, tiefenbasierte Submersion-Formel (water ≥75 = alle, ≥50 = depth ≥2, ≥25 = depth ≥4), Guardian Skill-Check, Double-Dive-Prevention, +5 Water bei Failure. Frontend: `salvage`/`dive` Commands. |
| RD16 | **Deluge: The Current Carries (Debris)** | ✅ IMPL | 6 literarische Debris-Items (Tier 0, auto-apply: 3x stress_heal, 3x dungeon_buff). Generierung alle 2 Räume via transientem `_last_debris` Signal. Auto-Apply: stress_heal sofort, dungeon_buff akkumuliert in `_debris_check_bonuses` (integriert in Encounter + Salvage Skill-Checks). |
| RD17 | **Deluge: Protocol Briefing + Water Bar** | ✅ IMPL | `formatArchetypeBriefing()` Deluge-Branch: Mythologisches Register (Carson/Stifter-Ton). `formatRoomEntry()` Water-Level-Bar (20 Blöcke). `isDelugeState` Type Guard Integration. |
| RD18 | **Deluge: Elemental Warding** | ✅ IMPL | Migration 174: `simulation_modifier` in CHECK Constraint + `fn_apply_dungeon_loot` RPC. Event Service: aktive Warding-Effekte schützen Buildings vor Degradation (zeitbasierte Expiration: `created_at + duration_ticks * heartbeat_interval`). Expired → consumed. |
| RD19 | **Objektanker-System** | ✅ IMPL | 32 Anchor Objects + 4 Barometers + 3-Module Architektur (`dungeon_objektanker.py`). Umgebungsnarrative pro Raum. |
| RD20 | **Admin Dungeon Override** | ✅ IMPL | Per-Simulation Archetype Unlock via `simulation_settings` KV-Tabelle. Bulk Admin Endpoint (2 DB Queries). |
| RD21 | **Global Dungeon Configuration** | ✅ IMPL | `PlatformSettingsService`: 4 Keys (dungeon_global_mode, dungeon_global_archetypes, dungeon_clearance_mode, dungeon_clearance_threshold). Cascade: Per-Sim Override > Global Config > Resonance. Terminal Clearance Control (off/standard/custom). |
| RD22 | **Dungeon Audio (Phase 1)** | ✅ IMPL | `DungeonAudioService` Singleton: Howler.js SFX sprite (14 CC0 Kenney.nl samples) + Web Audio API mixer bus (3 Kanäle: SFX/Ambient/UI). OGG Opus 67KB + MP3 Fallback 80KB in Supabase `dungeon.audio` Bucket (Migration 175). `DungeonAudioSettings` VU-Meter-Panel (Enable-Toggle, 3 Fader, Mute-Buttons). Preact Signals State, localStorage Persistence. 14 SFX-Trigger in `dungeon-commands.ts`. Phase 2-4 (Archetype Ambient, Synth Engine, Reverb) ausstehend. |
| RD23 | **Map Layout Fixes** | ✅ IMPL | Anti-Clipping (`edgePad = max(padding, nodeRadius+25)`), sequentielle Tiefenkompression (Layer-Indizes statt roher Tiefenwerte), dynamisches vGap (Skalierung bei >3:1 Höhen-Breiten-Verhältnis, Floor bei `nodeRadius*2+10`). Cleared-Badge nun auch auf aktuellem Raum sichtbar. Config: vGap=100, hGap=76, padding=36. |
| RD24 | **Generator: No-Consecutive-Rest** | ✅ IMPL | Ruheräume mit Ruheraum-Eltern werden durch Kampfräume ersetzt. Mid-Depth-Rest-Garantie läuft NACH dem Constraint, bevorzugt Räume ohne Ruheraum-Eltern. |
| RD25 | **Terminal UX Fixes** | ✅ IMPL | Auto-Focus bei Tab-Navigation (connectedCallback mit hasUpdated Guard). Encounter-Hint-Fix: alle Encounter-Typen zeigen einheitlich "interact <number>". |
| RD26 | **Threshold Room Type** | ✅ IMPL | Liminaler Toll-Raum vor jedem Boss. 3 unwiderrufliche Choices: Blood Toll (Condition-Schaden), Memory Toll (stille Modifier-Entfernung), Defiance (Boss-Schwierigkeitserhöhung). 8 archetypspezifische Entry-Texte. Dedizierter Handler (`dungeon_threshold.py`), kein Encounter-Pipeline-Durchlauf. Frontend: `mapThreshold` Icon (doorway, lorc, game-icons.net), Amber-Farbe, `formatThresholdEntry` Formatter. `DungeonPhase` um "threshold" erweitert. |
| RD27 | **The Awakening (7. Archetyp)** | ✅ IMPL | Awareness-Gauge 0-100 (Bewusstseinsdrift). 5 Feinde (Echo Fragment, Deja-vu Phantom, Consciousness Leech, Repressed Sentinel, The Repressed Boss). 17 Encounters (6C+5N+1E+1B+2R+2T). 28 Banter (awareness_tier 0-3, literarisches Register: Kafka-Proust-Lem-Stapledon). 11 Loot (T3: Awakening Insight = Big Five ±0.1). 8 Objektanker (Spiegelscherbe, Philemons Feder, Madeleine, Zwei Uhren, Hohlenschatten, Empathiebox, Einhornschadel, Turhuter). Ground-Action (Spy, -10 awareness, 3-Room CD). Deja-vu Room Morphing (cleared rooms reconstruct at awareness ≥50). Lucid Dreaming Bonus (+10% aptitude in combat/skill checks at awareness ≥70). Boss Deployment (3 introspection choices). Frontend: Awareness Gauge (violet-cyan-white), Awakening Protocol Briefing, Barometer. Migration 176 (84 Content Items) + Migration 177 (personality_modifier RPC). |

---

### K. Platform Admin Extensions

| # | Feature | Status | Beschreibung |
|---|---------|--------|-------------|
| K1 | **API Key Management** | ✅ IMPL | Admin-Panel (`<velg-admin-api-keys-tab>`) fuer 6 Platform-API-Keys (OpenRouter, Replicate, Guardian, NewsAPI, Tavily, DeepL). Maskierte Anzeige, Save/Clear pro Key. 5-Min Cache-TTL mit Invalidierung. |
| K2 | **Font Picker** | ✅ IMPL | Shared Component (`<velg-font-picker>`) mit 13 kuratierten Schriften (Oswald, Barlow, Cormorant Garamond, Spectral, Space Mono, etc.). Verwendet in VelgForgeDarkroom fuer Theme-Anpassung. |
| K3 | **Research Domain Admin** | ✅ IMPL | AdminResearchTab (`<velg-admin-research-tab>`): Per-Axis Tavily-Domain-Konfiguration (encyclopedic, literary, philosophical, architectural). 4 editierbare Domain-Listen aus `platform_settings` (Migration 124). Zuvor hartcodiert in `tavily_search.py`. Save/Reset pro Achse mit Dirty-Tracking. |
| K5 | **Admin Info Bubbles** | ✅ IMPL | ~57 Info-Bubbles mit `renderInfoBubble()` auf allen Admin-Config-Inputs. Shared `infoBubbleStyles` mit `role="tooltip"`, `aria-describedby`-Verknüpfung, Amber-Hover-Glow, Pfeil-Dekoration. i18n via `msg()`. |
| K6 | **Platform Config Tab** | ✅ IMPL | AdminPlatformConfigTab: Wrapper-Komponente mit Sub-Navigation (API Keys, Models, Research, Caching). Konsolidiert 4 Einzeltabs in 1. Gleiches Pattern wie AdminSocialTab (Instagram + Bluesky). |
| K7 | **Content Lint** | ✅ IMPL | `lint-llm-content.sh`: Prüft Em-Dashes (U+2014) und LLM-Wörter (tapestry, delve, unleash, etc.) in `msg()`-Strings und XLIFF. CI-ready (Exit 1 bei Violations). |

---

### L. Forge Access & Bureau Clearance

| # | Feature | Status | Beschreibung |
|---|---------|--------|-------------|
| L1 | **Forge Access Control / Bureau Clearance System** | ✅ IMPL | Account-Tier-System (observer → architect → director) mit Request/Approve/Reject-Workflow. DB: `forge_access_requests`-Tabelle, SECURITY DEFINER RPC-Funktionen, `v_pending_forge_requests`-View (Migration 093). Frontend: ClearanceApplicationCard (Dashboard — primaer in leerem "My Shards", sekundaer in Sidebar), ForgeAccessRequestModal (Classified-Dossier-Aesthetic mit Scan-Line-Overlay, gestaffelten Einblendungen, Brutalist-Buttons), AdminForgeTab Clearance-Management. Admin-Benachrichtigungs-Email bei neuen Antraegen. Bilinguale Email-Benachrichtigungen bei Genehmigung/Ablehnung. 5 API-Endpoints (`/api/v1/forge/access-requests/`). |
| L2 | **Breadcrumb Simulation Switcher** | ✅ IMPL | Dropdown in SimulationShell-Breadcrumb fuer schnelles Wechseln zwischen Simulationen. Keyboard-navigierbar, `position: fixed` um Overflow zu umgehen. View-Property vom Router uebergeben (behebt veraltete Breadcrumb bei Tab-Wechsel). |
| L3 | **Anchor Settings Persistence** | ✅ IMPL | `fn_materialize_shard()` (Migration 122) persistiert philosophische Anchor-Felder (title, core_question, literary_influence, description, bleed_signature_suggestion, seed_prompt + alle `_de`-Varianten) zu `simulation_settings` mit `category='anchor'`. Neuer Public-Endpoint `GET /api/v1/public/simulations/:simId/anchor`. Anon-RLS-Policy erweitert um `category='anchor'`. Zuvor gingen Anchor-Daten nach Draft-Loeschung verloren. |

---

### M. Living World & Bureau Terminal (MUD)

#### M1. Agent Autonomy & Living World

| # | Feature | Status | Beschreibung |
|---|---------|--------|-------------|
| M1 | **Agent Autonomy Bootstrap** | ✅ IMPL | `agent_autonomy_enabled` ON by default (Migration 157). Agent zone/building assignment bootstrap. Division-by-zero fix for sims with 0 zones. |
| M2 | **Influence → Building Readiness** | ✅ IMPL | `fn_compute_agent_influence` (Migration 158) + `fn_bootstrap_building_relations` (Migration 160). Influence = Relationships(40%) + Professions(30%) + Diplomatic(30%). Cross-simulation data leak fix (simulation_id filter on agent_professions). |
| M3 | **Stability → Event Probability** | ✅ IMPL | Stability multiplier in autonomous_event_service: 0.9→0.5x, 0.5→1.0x, 0.1→1.5x (capped). Catharsis mechanic: 20% community response events. |
| M4 | **Resonance → Agent Mood** | ✅ IMPL | `fn_apply_resonance_moodlets` (Migration 161). 8 Jungian archetypes → moodlet types (−2 to +2 strength). Atomic PG delete-and-replace per tick. Heartbeat Phase 3b. Self-gating via agent_mood join. Stacking cap 1. Subsiding resonances at 0.5× strength. 5h timed decay. |
| M5 | **Info Bubbles & UX (B1-B3)** | ✅ IMPL | B1: Agent influence panel (natural language breakdown, profession names + levels, WEAK/AVG/STRONG tier). B2: Building readiness 4-gauge Victoria 3 pattern (bottleneck detection). B3: Zone event risk display (threshold markers, CRITICAL/HIGH/MEDIUM/LOW badges, multiplier). Diamond badge overflow fix (4+ digit "1K" format). |

#### M2. Bureau Terminal (MUD Interface)

| # | Feature | Status | Beschreibung |
|---|---------|--------|-------------|
| M10 | **MUD Stage 1: Observation Terminal** | ✅ IMPL | 9 commands: look, go, examine, talk, weather, status, help, map, where + history, filter. BureauTerminal CRT component, TerminalStateManager, command parser (synonym map, Levenshtein fuzzy match), terminal-formatters (20+ format functions), TerminalQuickActions, TerminalView. Full CRT aesthetic (scanlines, phosphor glow, chromatic aberration), boot sequence, onboarding hints. Route: `/simulations/:slug/terminal`. |
| M11 | **MUD Stage 2: Field Operations** | ✅ IMPL | 5 commands: fortify, quarantine, assign, unassign, ceremony. Operations Points budget. Progressive disclosure (Tier 2 at 10 commands). Realtime feed polling. Conversation mode for talk. |
| M12 | **MUD Stage 3: Intelligence Network** | ✅ IMPL | 5 commands: scan (all-zone radar, 1 intel), investigate (event deep dive, 1 intel), report (session doc, free), debrief (AI structured 3-section report, 1 intel), ask (AI targeted query, free). Tier 3 clearance at 25 commands. Shared conversation + prompt helpers (ensureAgentConversation, sendAgentPrompt). ~1,300 LOC. 31 German translations. |
| M13 | **Bureau CRT Palette** | ✅ IMPL | Hard amber CRT palette forced regardless of simulation theme. WCAG AA contrast fix. Dark CRT palette override. Empty screen on re-entry after navigation fix. |
| M14 | **MUD Epoch Intelligence Station** | ✅ IMPL | Complementary design: terminal = intelligence gathering, GUI = command-and-control (no GUI duplication). 4 Tier 4 commands: sitrep (AI briefing), dossier (player intel file), threats (incoming operatives), intercept (counter-intel sweep, 4 RP). Enhanced Stage 1-3: look (threat detection), status (RP/cycle/rank/missions). EpochTerminalView wrapper. Terminal tab in EpochCommandCenter. `effectiveClearance` computed (epoch tier 4 is context-derived, not persisted). `simId()` + `resolveSimulationName()` epoch-aware. Zone ID validation for game_instance UUIDs. 58 German translations (5906 total). |

---

### N. Achievement & Badge System (Commendations)

35 Badges in 7 Kategorien, 5 Seltenheitsstufen. Alle Auszeichnungen werden automatisch durch PostgreSQL-Trigger oder Backend-Hooks vergeben – kein manuelles Einlösen. Bilingual (EN/DE). Route: `/commendations`.

#### N1. Datenbank & Kern-Architektur

| # | Feature | Status | Beschreibung |
|---|---------|--------|-------------|
| N1 | **Achievement Tables** | ✅ IMPL | 3 Tabellen (Migration 190): `achievement_definitions` (Katalog, 35 Einträge), `user_achievements` (verdiente Badges, immutable), `achievement_progress` (inkrementeller Fortschritt für Schwellenwert-Badges). RLS: Definitionen + verdiente Badges public-read für authenticated, Fortschritt nur eigener User. |
| N2 | **Core RPCs** | ✅ IMPL | `fn_award_achievement(user_id, achievement_id, context)` — idempotent (UNIQUE constraint). `fn_increment_progress(user_id, achievement_id, target, context)` — atomarer Fortschritt + Auto-Award bei Schwellenwert. `fn_increment_progress_unique(user_id, achievement_id, item_key, target, context)` — deduplizierter Fortschritt (z.B. 50 _einzigartige_ Banter-Texte). Alle RPCs nur für `service_role` (Migration 195: REVOKE von authenticated). |
| N3 | **DB-Trigger (13)** | ✅ IMPL | Migration 190 (9 Trigger): Onboarding, First Operative, Dungeon Complete (8-Archetypen-CASE), Epoch Score (Strategist/Undefeated), Alliance (Diplomat), Forge, Loot, Cipher. Migration 194 (4 Trigger): Embassy Builder (beide Seiten), Echo Sender, Epoch Score erweitert. Alle `SECURITY DEFINER`. |

#### N2. Badge-Kategorien

| # | Feature | Status | Beschreibung |
|---|---------|--------|-------------|
| N4 | **Initiation (4 Badges)** | ✅ IMPL | First Steps (Onboarding), Field Agent (erster Operativer), Into the Depths (erster Dungeon), Forgemaster (Forge-Simulation). Common/Uncommon. |
| N5 | **Dungeon Mastery (11 Badges)** | ✅ IMPL | 8 Archetypen-Abschluss-Badges (Shadow Walker, Tower Sentinel, Entropy Witness, Mother's Bond, Flame Bearer, Flood Navigator, Awakening Seer, The Insurgent) + Archetype Explorer (4 verschiedene), Master of Archetypes (alle 8), Depth Master (Schwierigkeit 5). Common→Epic. Migration 192: fehlende 5 Archetypen + Icon-Key-Fixes. |
| N6 | **Epoch Warfare (5 Badges)** | ✅ IMPL | Iron Guardian (10 Guardians), Shadow Operative (5 Spionage-Missionen), The Diplomat (3 Allianzen), Master Strategist (3 Epochen gewonnen), Undefeated (Epoche ohne Aufdeckung). Uncommon→Legendary. |
| N7 | **Collection (4 Badges)** | ✅ IMPL | Loot Collector (10 Items), Literary Collector (5 Legendary-Items), Objektanker Finder (16 Objekte, `fn_increment_progress_unique`), Banter Connoisseur (50 einzigartige Geplänkel). Common→Rare. |
| N8 | **Social & Bleed (4 Badges)** | ✅ IMPL | Embassy Builder (3 aktive Botschaften), Echo Sender (5 Bleed-Echos), Cipher Decoder (Instagram-Code eingelöst), Ward Master (3 Echos abgewehrt, Python-driven in `echo_service.py`). Uncommon→Rare. |
| N9 | **Challenge (3 Badges)** | ✅ IMPL | Flawless Run (kein Agent >200 Stress), Speed Runner (≤8 Räume), Pacifist (nur Encounters). Rare→Epic. |
| N10 | **Secret (3 Badges)** | ✅ IMPL | The Remnant (Shadow-Boss bei VP=0), Mother's Embrace (Attachment 100), Political Vertigo (totale Fraktur im Overthrow). `is_secret=TRUE`, Hints NULL, Name/Beschreibung erst nach Unlock sichtbar. Rare/Epic. |

#### N3. Backend-Hooks

| # | Feature | Status | Beschreibung |
|---|---------|--------|-------------|
| N11 | **DungeonAchievementService** | ✅ IMPL | Zentrales Domain-Logik-Modul (`backend/services/dungeon/dungeon_achievements.py`). Hook-Methoden: `on_boss_victory()` (5 Badges: the_remnant, mothers_embrace, flawless_run, speed_runner, pacifist), `on_drain_trigger()` (political_vertigo), `on_banter_witnessed()` (banter_connoisseur), `on_anchor_encountered()` (objektanker_finder), `track_peak_stress()` (7 Checkpoints). |
| N12 | **Ward Master Hook** | ✅ IMPL | Python-driven in `echo_service.py:_award_ward_badge`. Feuert bei `ward_reduction > 0` während Echo-Transmission — VOR Schwellenwert-Prüfung (vollständig geblockte Echos zählen). Schreibt Ziel-Sim-Owner gut. |

#### N4. Frontend & API

| # | Feature | Status | Beschreibung |
|---|---------|--------|-------------|
| N13 | **VelgAchievementBadge** | ✅ IMPL | Hexagonale Badge-Komponente, 5 Seltenheitsstufen (Common→Legendary), 17 game-icons.net SVGs (CC BY 3.0), Kontrast/Glow pro Tier. Secret-Badges zeigen `???` wenn nicht verdient. |
| N14 | **VelgAchievementGrid** | ✅ IMPL | Route `/commendations`. Kategorie-Gruppierung, Seltenheits-Filter, verdient/offen-Filter. Badge-Katalog aus `appState.achievementDefinitions`. |
| N15 | **VelgAchievementToast** | ✅ IMPL | Headless Supabase-Realtime-Listener auf `user_achievements` INSERT. Cached `achievement_definitions` lokal, zeigt `VelgToast.success()` mit Badge-Name. Setzt `appState.recentUnlock` für Dashboard-Reaktivität. Auth-Resubscription bei Login/Logout. |
| N16 | **VelgAchievementSummaryCard** | ✅ IMPL | Dashboard-Rechte-Spalte. Earned/Total-Zähler, bis zu 3 Mini-Hex-Badges der letzten Unlocks. Link zu `/commendations`. Subscribes auf `appState.recentUnlock` für Live-Aktualisierung bei Badge-Earn. |
| N17 | **API (4 Endpoints)** | ✅ IMPL | Read-only, kein Write (system-awarded). `GET /achievements/definitions` (Katalog), `GET /users/me/achievements` (verdiente Badges), `GET /users/me/achievements/progress` (Fortschritt), `GET /users/me/achievements/summary` (Dashboard-Aggregat: earned/total/by-rarity/recent-3). `AchievementService` Backend-Service. |

---

## Technische Infrastruktur-Übersicht

| Kennzahl | Wert |
|----------|------|
| **Simulationen** | 5 (Velgarien, The Gaslit Reach, Station Null, Speranza, Cité des Dames) |
| **Datenbanktabellen** | 90+ |
| **SQL-Migrationen** | 195 |
| **RLS-Policies** | 270+ |
| **Trigger** | 62+ (27 Trigger Functions) |
| **Achievement-Badges** | 35 (7 Kategorien, 5 Seltenheitsstufen, 13 DB-Trigger) |
| **Views** | 8 Standard + 6 Materialized |
| **API-Endpoints** | ~295 (über 37 Router) |
| **Backend-Tests** | 917 (pytest: unit + integration + security + performance) |
| **Frontend-Tests** | 667 (vitest: validation + API + theme contrast + SEO + terminal-formatters + fuzzy-search + date-format) |
| **E2E-Tests** | 81 (Playwright: 12 Dateien) |
| **i18n-Strings** | 5848 (EN/DE, 100% coverage) |
| **Background-Tasks** | 1 (ResonanceScheduler) |
| **Storage Buckets** | 4 (agent.portraits, building.images, user.agent.portraits, simulation.assets) |
| **Theme-Presets** | 6 (dark-brutalist, deep-space-horror, arc-raiders, gaslit-reach, illuminated-literary, custom) |
| **Shared Components** | 17 + 10 Shared CSS Modules + BaseSettingsPanel |
| **Backend Services** | 29 Entity + Audit + Simulation + External + Email + Admin + Bot + Notification + Cleanup |
| **Postgres-Docstring-Convention** | Alle 16 Services mit Postgres-RPC/View-Aufrufen dokumentieren Migration-Nummern im Docstring (siehe ADR-007) |

---

## Phasen-Übersicht (historisch)

Alle 6 Phasen + Post-Phase Living World abgeschlossen. 170+ Tasks implementiert.

### Phase 1: MVP (Plattform-Grundgerüst)
- P1-P5 (Simulations-Management + Auth)
- C1-C2 (Basis-Settings + Taxonomien)
- S1-S10 (Agenten CRUD + AI-Generierung)
- S19-S22 (Events CRUD)
- S11-S14 (Gebäude CRUD)

### Phase 2: Kernfunktionen
- S23-S25 (Event-Generierung + Reaktionen)
- S26-S29 (Chat-System)
- S15-S18 (Gebäude-Bilder + Zuweisungen)
- C3, C6 (AI + Access Settings)
- C7-C9 (Taxonomy/Prompt/Model Editoren)

### Phase 3: Erweiterte Features
- P6-P7 (Einladungen + Mitgliederverwaltung)
- S31-S35 (Social Trends + Kampagnen)
- C4-C5 (Integration + Design Settings)
- S41-S43 (Standorte)

### Phase 4: Social Media + Erweitert
- S36-S40 (Social Media Integration)
- P8-P10 (Archivierung, Klonen, Public-First)

### Phase 5: Multiverse & Game Systems
- S10a-S10b (Agent Relationships + AI Generation)
- S25a-S25c (Event Echoes + Bleed Pipeline)
- S18a-S18d (Embassies & Ambassadors)
- S44-S47 (Per-Simulation Lore)
- D1-D8 (Cartographer's Map)
- E1-E4 (Game Systems + Materialized Views)
- F1-F6 (SEO, GA4, Slug-URLs)
- G1-G3 (i18n, Theming, Fonts)
- H1-H3 (Dramatic Microanimations)

### Phase 6: Competitive Layer + Platform Admin
- P11-P11f (Competitive Epochs + Scoring + Battle Log)
- P12-P12d (Bot Players + Decision Engine + Chat)
- P13-P13d (Platform Admin Panel + Cleanup + Health Effects Control)
- P14-P14c (Agent Aptitudes + Draft Phase)
- P15-P15a (Game Instances + Lifecycle)
- P16-P16b (Epoch Invitations)
- P17-P17b (Epoch Realtime Chat + COMMS)
- P18-P18b (Cycle Email Notifications)
- P19 (How-to-Play Tutorial)
- P20 (ECharts Intelligence Report)
- C10-C12 (View + Notifications + Bleed Settings)

### Phase 7: Event Pressure & Resonance Gameplay
- I1-I7 (Graduated Event Pressure, Event Lifecycle, Zone Gravity/Vulnerability, Cascade Events, Zone Actions, Event Seismograph)
- J1-J8 (Substrate Resonances: Detection, Susceptibility, Impact Processing, Operative Integration, Monitor, Admin Panel, Balance Fixes, Auto-Processing Scheduler)
- K1-K2 (API Key Management, Font Picker)

### Phase 8: Health Threshold, Bleed Overlay & Map Redesign
- S25d-S25e (Bleed Palimpsest Overlay, Text Corruption)
- S62-S64 (Forge Ceremony Card Dealer Spread, Image Progress Polling, Post-Ceremony Loading States)
- D9-D13 (Cartographer's Desk, Map Layers, Cartographic Map, Annotations, Map Overlay RPC)
- E5-E9 (Threshold System, Entropy UI, Ascendancy UI, Threshold Actions, Bleed Status RPC)

### Post-Phase: Living World & Bureau Terminal
- M1-M5 (Agent Autonomy Bootstrap, Influence → Readiness, Stability → Events, Resonance → Mood, Info Bubbles B1-B3)
- M10-M13 (Bureau Terminal MUD Stages 1-3: Observation, Field Ops, Intelligence Network, CRT Palette)
- i18n: 452 new German translations (100% coverage, 5789 total strings)
