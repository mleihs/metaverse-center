---
title: "Feature Catalog"
id: feature-catalog
version: "2.6"
date: 2026-03-13
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
| P3 | **Simulation-Auswahl** | ✅ IMPL | Zwischen Simulationen wechseln. Slug-basierte URLs (`/simulations/speranza/lore`). SimulationShell + SimulationHeader + SimulationNav mit Theme-Wechsel. |
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
| P13 | **Admin-Route** | ✅ IMPL | `/admin` mit Email-Allowlist-Auth (`matthias@leihs.at`). `require_platform_admin()`-Dependency. `isPlatformAdmin` Computed Signal. Dark tactical HUD-Ästhetik (gray-950 bg, Scanlines, "RESTRICTED ACCESS"-Badge). |
| P13a | **User Management** | ✅ IMPL | AdminUsersTab: Suche, expandierbare Zeilen, Rollen-Dropdowns, Mitgliedschafts-Verwaltung, Simulation-Zuweisung, Löschen mit Bestätigung. 3 SECURITY DEFINER RPC-Funktionen (`admin_list_users`, `admin_get_user`, `admin_delete_user`) — umgeht GoTrue Admin API HS256-Inkompatibilität. `admin_get_user` liefert Wallet-Daten (forge_tokens, is_architect) als flache Felder via LEFT JOIN (Migration 057) — kein separater Wallet-Query nötig. `admin_delete_user` (Migration 113): Ownership-Transfer an Platform-Admin, FK-Nullifizierung, user-owned Records Löschung. Dispatcht `user-deleted`-Event für DevAccountSwitcher-Cache-Invalidierung. |
| P13b | **Cache TTL Controls** | ✅ IMPL | AdminCachingTab: Card-basierte TTL-Inputs, Dirty-Tracking, Save/Reset. `platform_settings`-Tabelle (Key-Value Runtime-Config). `CacheConfigService`-Singleton für Map-Data, SEO-Metadata, HTTP Cache-Control. |
| P13c | **Data Cleanup** | ✅ IMPL | AdminCleanupTab: 6 Daten-Kategorien (completed_epochs, cancelled_epochs, stale_lobbies, archived_instances, audit_log, bot_decision_log). Preview-Before-Delete-Workflow (Stats → Scan → Preview → Execute). Cascade-aware Epoch-Deletion (Game Instances zuerst, dann Epoch-Zeilen mit 8 Kind-Tabellen). Monospace-Cascade-Tree-Anzeige. Item-Selektion: Scan liefert individuelle Epoch/Instanz-Einträge mit Checkboxen — Cascade-Counts aktualisieren sich live per debounced Re-Preview. `min_age_days` erlaubt 0 (sofort). Optional `epoch_ids` Parameter umgeht Altersfilter für gezielte Löschung. |

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
| P19 | **Tutorial-Seite** | ✅ IMPL | `/how-to-play`-Route. Dark military-console Ästhetik. Sticky Sidebar-TOC mit Scroll-Spy. 28 Sektionen in 4 Kategorien (The World: Intro, Lore, Forge, Agent Chat, Events, Social Trends, Multiverse Map, Simulation Health; Competitive: Epochs, Getting Started, Phases, RP, Operatives, Embassies, Scoring, Alliances, Bot Players, COMMS; Advanced: Bleed, Resonances, Zone Dynamics, Agent Memory, Chronicle; Reference: Tactics, Demo Run, Matches, Intelligence Report, Updates). 6 Operativ-Karten mit Details. 5 vollständig ausgearbeitete Match-Replays. Keyboard-Accessibility (aria-expanded, focus-visible). htp-styles.ts (~1100 Zeilen extrahiertes CSS). |

#### A11. ECharts Intelligence Report

| # | Feature | Status | Beschreibung |
|---|---------|--------|-------------|
| P20 | **Interaktive Analyse-Charts** | ✅ IMPL | Apache ECharts 6.0 Integration. `EchartsChart` Lit-Wrapper mit `tactical` Dark-Theme. 4 Charts: Radar (Simulations-Profile), Heatmap (Head-to-Head 2P-Duelle), Grouped Bar mit Wilson 95% CI-Whiskers (Strategie-Tiers), Multi-Line (Win-Rate nach Spieleranzahl). IntersectionObserver Scroll-Reveal mit "CLASSIFIED" / "INTEL GRADE" Eck-Bracket-Dekorativen Headers. 200-Game Epoch-Simulations-Datenbasis. |

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
| S57 | **Forge-Pipeline** | ✅ IMPL | 4-Phasen AI-Pipeline: Astrolabe (Themen-Recherche via Tavily + 3 Philosophical Anchors) → Drafting Table (Geography/Agents/Buildings via Pydantic AI) → Darkroom (Theme-Generierung + Test-Renders) → Ignition (Materialisierung via `fn_materialize_shard` + Batch-Bildgenerierung). `ForgeOrchestratorService` koordiniert alle Phasen. Semantische RPC-Fehlerklassifizierung (402 Token-Mangel, 400 Validierung, 409 Duplikat). `_FlushingStreamHandler` fuer zuverlaessiges Logging bei uvicorn-Reloads. |
| S58 | **Phase II: Drafting Table** | ✅ IMPL | Chunked Entity-Generierung mit typed Pydantic-Modellen als `output_type`. `ForgeAgentDraft` (character: 200-300 Wörter mit physischen Eindrücken für Portrait-Gen, background: 200-300 Wörter). `ForgeBuildingDraft` (description: 150-250 Wörter mit Materialien/Sensorik für Bild-Gen, variierte building_condition). `ForgeZoneDraft` (description + 2-4 characteristics-Tags). `ForgeStreetDraft` (optionale description). `_build_chunk_prompt()` assembliert chunk-spezifische Prompts mit Seed, Anchor-Kontext, geographischem Kontext, Wortlängen-Guidance und Diversitäts-Instruktionen. **Bilingual EN+DE:** Alle Draft-Modelle enthalten `_de`-Felder, die im selben LLM-Call generiert werden (spart separaten Translations-Call). Frontend rendert via `t()` locale-aware. `fn_materialize_shard` (Migration 112) inseriert `_de`-Spalten. |
| S59 | **Forge Mock-Service** | ✅ IMPL | `FORGE_MOCK_MODE=true`: Deterministisches Mock-System für alle 4 Phasen. Seed-aware via SHA-256. 8 Zonen (mit characteristics), 8 Straßen (mit descriptions), 8 Agenten (2-3 Satz character/background), 9 Gebäude (variierte conditions), 2 Theme-Presets, 5 Lore-Sektionen + DE-Übersetzungen. |
| S60 | **BYOK (Bring Your Own Key)** | ✅ IMPL | User können eigene OpenRouter/Replicate API-Keys hinterlegen (AES-256 verschlüsselt via `user_wallets`). Forge nutzt User-Keys wenn vorhanden, sonst Platform-Keys. |
| S61 | **Forge-Frontend** | ✅ IMPL | VelgForgeWizard (Multi-Step), VelgForgeTable (Draft-Management), VelgForgeAstrolabe (Pipeline-Visualisierung), VelgForgeDarkroom (Theme-Tuning), VelgForgeIgnition (Materialisierungs-Bestätigung mit Fehleranzeige + Retry), VelgForgeScanOverlay (Scan-Animation). Retro-Terminal CRT-Ästhetik (bernstein auf schwarz). `ForgeStateManager` mit sessionStorage-Persistenz fuer Draft-ID (ueberlebt Page-Refresh). |
| S62 | **Forge Ceremony — Card Dealer Spread** | ✅ IMPL | VelgForgeCeremony Post-Ignition-Screen redesigned: Zwei Kartenfächer (Agenten links, Gebäude rechts) mit Bogen-Rotation (3° pro Position, 5px Arc-Dip). `sm`-Kartengröße (120×192) statt `xs`. Dynamische Überlappung berechnet sich aus Viewport-Breite. Hover hebt Karte an und richtet sie gerade aus. Zonen-Badge als vertikaler Divider zwischen den Fächern. Responsive Shard-Name mit `clamp(1.2rem, 4vw, 2.5rem)`. Prominenter Enter-Button mit Breathing-Glow-Animation. Fan-Labels ("6 AGENTS" / "7 BUILDINGS") ersetzen separate Stats-Zeile. Alle Animationen respektieren `prefers-reduced-motion`. |
| S63 | **Forge Image Progress Polling** | ✅ IMPL | Live-Bildfortschritt während Ceremony: Polling alle 4s via `get_forge_progress` Postgres RPC (Migration 098). Fortschrittsbalken ("3/14 MATERIALIZING..."). Brightness-Flash-Microanimation bei neuen Bildern. Enter-Button gesperrt bis alle Bilder fertig ("MATERIALIZING ASSETS ..." → "ENTER NEW SHARD →"). Auto-Enter 8s nach Abschluss. 5-Minuten Safety-Timeout. Karten-`image-url`-Attribut wird live aktualisiert. |
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
| E9 | **Bleed Status RPC** | ✅ IMPL | `get_bleed_status(uuid)` Postgres-Funktion (Migration 099): Ersetzt N+1 Python-Queries (7 Queries pro Quell-Simulation) mit einer einzigen Abfrage. CTEs: `strongest_per_source` (DISTINCT ON), `source_enriched` (Joins: Sim-Name, Theme via `setting_value #>> '{}'`, Lore-Fragment). AppStateManager: `bleedStatus` + `thresholdState` Signals für globalen Zugriff. |

---

### F. SEO, Analytics & Plattform-Infrastruktur

| # | Feature | Status | Beschreibung |
|---|---------|--------|-------------|
| F1 | **Slug-basierte URLs** | ✅ IMPL | `/simulations/speranza/lore` statt UUIDs. Backend: `/api/v1/public/simulations/by-slug/{slug}`. Frontend: `_resolveSimulation()` in app-shell `enter()` Callback. 301-Redirects von UUID→Slug für Crawler. |
| F2 | **SEO Structured Data** | ✅ IMPL | JSON-LD Schema.org Markup (`SeoService`). Epoch → `Event`, Lore → `Thing`. robots.txt + dynamischer sitemap.xml aus DB. Server-side Crawler Meta-Injection (Middleware). Build-time Prerender (`scripts/prerender.py`): generiert statische HTML-Snapshots fuer alle Simulationen + Platform-Pages in Docker-Build-Stage (Supabase REST API). |
| F3 | **GA4 Analytics** | ✅ IMPL | 37 GA4-Events via deklarative EVENT_MAP (29 DOM-Events, 8 Service-Level). Production-Only Guard. Consent Mode v2. Measurement ID `G-GP0Y16L51G`. |
| F4 | **Cookie Consent** | ✅ IMPL | Fixed Bottom Banner. Accept/Decline Analytics. Privacy-Policy-Link. localStorage-Persistenz. GDPR-konform. |
| F5 | **Crawler-Erkennung** | ✅ IMPL | SEO Middleware: Googlebot, Bingbot, AI-Bots (GPTBot, ChatGPT, Claude, Anthropic, PerplexityBot, etc.). HTML-Enrichment für Crawler. |
| F6 | **IndexNow** | ✅ IMPL | Bing/Yandex/Seznam/Naver Benachrichtigung bei Seitenänderungen. API-Key auf Server hinterlegt. |

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

---

### K. Platform Admin Extensions

| # | Feature | Status | Beschreibung |
|---|---------|--------|-------------|
| K1 | **API Key Management** | ✅ IMPL | Admin-Panel (`<velg-admin-api-keys-tab>`) fuer 6 Platform-API-Keys (OpenRouter, Replicate, Guardian, NewsAPI, Tavily, DeepL). Maskierte Anzeige, Save/Clear pro Key. 5-Min Cache-TTL mit Invalidierung. |
| K2 | **Font Picker** | ✅ IMPL | Shared Component (`<velg-font-picker>`) mit 13 kuratierten Schriften (Oswald, Barlow, Cormorant Garamond, Spectral, Space Mono, etc.). Verwendet in VelgForgeDarkroom fuer Theme-Anpassung. |

---

### L. Forge Access & Bureau Clearance

| # | Feature | Status | Beschreibung |
|---|---------|--------|-------------|
| L1 | **Forge Access Control / Bureau Clearance System** | ✅ IMPL | Account-Tier-System (observer → architect → director) mit Request/Approve/Reject-Workflow. DB: `forge_access_requests`-Tabelle, SECURITY DEFINER RPC-Funktionen, `v_pending_forge_requests`-View (Migration 093). Frontend: ClearanceApplicationCard (Dashboard — primaer in leerem "My Shards", sekundaer in Sidebar), ForgeAccessRequestModal (Classified-Dossier-Aesthetic mit Scan-Line-Overlay, gestaffelten Einblendungen, Brutalist-Buttons), AdminForgeTab Clearance-Management. Admin-Benachrichtigungs-Email bei neuen Antraegen. Bilinguale Email-Benachrichtigungen bei Genehmigung/Ablehnung. 5 API-Endpoints (`/api/v1/forge/access-requests/`). |
| L2 | **Breadcrumb Simulation Switcher** | ✅ IMPL | Dropdown in SimulationShell-Breadcrumb fuer schnelles Wechseln zwischen Simulationen. Keyboard-navigierbar, `position: fixed` um Overflow zu umgehen. View-Property vom Router uebergeben (behebt veraltete Breadcrumb bei Tab-Wechsel). |

---

## Technische Infrastruktur-Übersicht

| Kennzahl | Wert |
|----------|------|
| **Simulationen** | 5 (Velgarien, The Gaslit Reach, Station Null, Speranza, Cité des Dames) |
| **Datenbanktabellen** | 58 |
| **SQL-Migrationen** | 100 |
| **RLS-Policies** | 150+ |
| **Trigger** | 41+ |
| **Views** | 8 Standard + 6 Materialized |
| **API-Endpoints** | ~310 (über 38 Router) |
| **Backend-Tests** | 912 (pytest: unit + integration + security + performance) |
| **Frontend-Tests** | 453 (vitest: validation + API + theme contrast + SEO) |
| **E2E-Tests** | 81 (Playwright: 12 Dateien) |
| **i18n-Strings** | 3220+ (EN/DE) |
| **Background-Tasks** | 1 (ResonanceScheduler) |
| **Storage Buckets** | 4 (agent.portraits, building.images, user.agent.portraits, simulation.assets) |
| **Theme-Presets** | 6 (dark-brutalist, deep-space-horror, arc-raiders, gaslit-reach, illuminated-literary, custom) |
| **Shared Components** | 16 + 10 Shared CSS Modules + BaseSettingsPanel |
| **Backend Services** | 29 Entity + Audit + Simulation + External + Email + Admin + Bot + Notification + Cleanup |
| **Postgres-Docstring-Convention** | Alle 16 Services mit Postgres-RPC/View-Aufrufen dokumentieren Migration-Nummern im Docstring (siehe ADR-007) |

---

## Phasen-Übersicht (historisch)

Alle 6 Phasen abgeschlossen. 160 Tasks implementiert.

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
- P13-P13c (Platform Admin Panel + Cleanup)
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
