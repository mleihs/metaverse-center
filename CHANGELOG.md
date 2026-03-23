# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- **Async Supabase Client** — migrated entire backend from sync `create_client` to native `AsyncClient` (`create_async_client`). All ~1006 `.execute()` calls now properly awaited (verified by AST audit). Eliminates event-loop blocking under concurrent load. SEO middleware retains sync client (crawler-only, no concurrency concern)
- **ADR-009: admin_supabase Usage Policy** — documents when service_role client is legitimate vs forbidden, with docstring convention
- **Agent autonomy read methods** — `AgentMoodService.get_agent_mood`, `AgentNeedsService.get_agent_needs`, `AgentOpinionService.list_opinions/list_modifiers`, `AgentActivityService.list_activities` (proper service delegation)
- **Daily Substrate Dispatch** — once-per-day briefing modal on first simulation visit. Calls `GET /simulations/{id}/heartbeat/briefing` for 24h summary: health status hero bar with tier badge (critical/warning/good/excellent), critical/positive event counts, total entries, active narrative arcs with inline pressure bars. Classified dispatch aesthetic with forced platform-dark tokens (`:host` pin), scanline texture, corner brackets, watermark, classification stamp. 30s auto-dismiss with pausable progress bar. localStorage date-scoped dismiss key. Focus trap, Escape key, `role="dialog"`, `role="meter"`, `prefers-reduced-motion`, mobile responsive. Triggered from `SimulationShell.connectedCallback`, skipped when `entries_24h === 0`. `DailyBriefingModal.ts` component
- **Alliance Redesign** — proposal-based joining (unanimous vote), shared intelligence (RLS), upkeep (1 RP/member/cycle), tension system (auto-dissolution at 80). New tables: `epoch_alliance_proposals`, `epoch_alliance_votes`. 5 Postgres functions, 2 triggers, 5 RLS policies. 3 API endpoints. Bot voting strategies per archetype (migration 090)
- **Forge Token Economy** — admin unlimited forge tokens (migration 098), token store with bundles/purchases/atomic purchase RPC (migration 101), token admin tools with grant RPC + economy stats view (migration 102), BYOK free access system with 3 control levels (migration 103), feature purchase ledger for Darkroom Pass, Classified Dossier, Recruitment Office, Chronicle Printing Press (migration 104)
- **Platform Model Config** — AI model configuration in platform_settings, admin override via Models tab (migration 105). Development model config with cheap/free models for dev environment (migration 109)
- **Substrate Scanner** — news_scan_log + news_scan_candidates tables (migration 084), platform_settings defaults (migration 085), prompt templates for classification + bureau dispatch (migration 086)
- **Map & RPC Improvements** — `map_simulations` view consolidating 3-query pattern (migration 091), `get_bleed_status()` RPC replacing N+1 queries (migration 099), `get_map_overlay_data()` RPC for zone topology + events + bleed in one round-trip (migration 100), `fn_get_wallet_summary()` composite RPC (migration 108)
- **Dossier Evolution** — living dossier with `evolved_at` tracking on simulation_lore (migration 106)
- **Chronicle Full-Res Archive** — `POST /api/v1/forge/simulations/{id}/chronicle/hires` endpoint. `CodexExportService.generate_hires_archive()` downloads all `.full.avif` originals (agents, buildings, lore, banner), packages as organized ZIP (`{sim-name}-fullres/` with subfolders), uploads to Supabase Storage. Frontend `VelgChronicleExport` card renamed from "HI-RES ARCHIVE" to "FULL-RES ARCHIVE" with honest resolution description
- **Dossier Evolution Auto-Translation** — `DossierEvolutionService.evolve_section()` now translates each Bureau addendum to German via `TranslationService` (DeepL or Claude backend) with full `TranslationContext` (simulation name, theme, arcanum section, trigger type). Falls back to English on failure so `body_de` never falls behind
- **Lore Image Tracking** — `image_generated_at` on simulation_lore, extended `get_forge_progress()` (migration 107)
- **Threshold Actions Log** — tracks desperate/ascendant actions when simulation health crosses critical (<0.25) or ascendant (>0.85) thresholds (migration 097)
- **Forge Access Requests** — `account_tier` on user_wallets + `forge_access_requests` table for Bureau clearance upgrade flow (migration 093)
- **Event i18n Columns** — German translation columns on events table (migration 081)
- **Resonance Transformation Templates** — seed EN + DE prompt templates for resonance_transformation (migration 082)

### Changed

- **Admin email** moved from GUC to platform_settings table; `is_platform_admin()` rewired (migration 087)
- **Spengbab** — lore image settings with cursed aesthetic + Flux Dev model (migration 083), image generation prompt templates (migration 092), slug fix after rename (migration 094)
- **Admin user listing** — `admin_list_users` RPC granted to anon + authenticated for DevAccountSwitcher (migration 096). **REVOKED in migration 147** — see Fixed section
- **DevAccountSwitcher** — now calls protected `/api/v1/admin/users` backend endpoint instead of direct Supabase RPC. Dev password moved to environment variable (`VITE_DEV_SWITCHER_PASSWORD`)
- **Image fetching** — `image_service.py` and `style_reference_service.py` now delegate URL validation to centralized `safe_fetch.py` SSRF utility

### Fixed

- **CRITICAL: User data leak via admin_list_users RPC** — migration 096 accidentally granted EXECUTE to anon/authenticated, allowing anyone to enumerate all users (emails, metadata, wallet balances, architect status) via PostgREST. Revoked in migration 147. DevAccountSwitcher rewired to backend admin API endpoint (`/api/v1/admin/users`)
- **Race conditions in game mechanics** — 8 fetch-compute-update race conditions in `operative_mission_service.py`, `cycle_resolution_service.py`, and `heartbeat_service.py` replaced with 6 atomic Postgres RPCs (migration 148): `fn_transition_mission_status`, `fn_degrade_building`, `fn_downgrade_zone_security`, `fn_weaken_relationships`, `fn_grant_rp_single`, `fn_expire_fortifications`. Feature flag `use_atomic_game_rpcs` allows safe rollout (default: false). Heartbeat idempotency upgraded from TOCTOU pre-check to INSERT-first pattern
- **SSRF vulnerability in image downloads** — `image_service._download_reference_image()` fetched user-controlled URLs without IP validation. Centralized `safe_fetch.py` utility with scheme checks, private/loopback/reserved/link-local IP rejection, and DNS-rebinding protection (resolves domain to IP before fetch). `style_reference_service.fetch_from_url()` also migrated
- **Chronicle export download buttons** — DOWNLOAD buttons in Printing Press rendered with no `@click` handler after purchase. Now extracts `download_url` from completed purchase result, restores state on page reload from history, wires both codex PDF and full-res archive download handlers
- **CI pipeline** — `sentry-sdk` and `deepl` added to `pyproject.toml` dependencies (were only in `requirements.txt`). Integration tests now check actual Supabase connectivity instead of just env var presence. Fixed stale mocks in echo service and wallet endpoint tests
- **i18n coverage** — translated all 80 missing German strings in XLIFF (chronicle export, bureau status, dossier preview, command palette, navigation labels). Wrapped export type labels and status strings in `msg()`. Replaced inline styles with CSS classes
- **Zone fortification RLS** — `fortify_zone` endpoint used user JWT for zone security upgrade and fortification insert, but `zones` RLS requires admin role for UPDATE. Now uses `admin_supabase` for game state mutations, matching the deploy operative pattern
- **Mobile deployment cards** — agent cards in the War Table hand were 120×192px on mobile with no shrink, making them enormous. Now uses xs size (80×128px) on screens ≤768px
- **Mobile language switcher** — language toggle and dev account switcher were only in the desktop SYS cluster dropdown, inaccessible from the mobile hamburger menu. Now included in mobile nav
- **Dev model defaults** — replaced discontinued `deepseek/deepseek-r1-0528:free` with `google/gemini-2.0-flash-001` in hardcoded dev fallbacks
- **CSP policy** — added `fonts.googleapis.com` to style-src, `fonts.gstatic.com` to font-src, `static.cloudflareinsights.com` to script-src (Google Fonts and Cloudflare Insights were blocked)
- **Admin panel hardening** — fixed ConfirmDialog `variant` attribute binding in cleanup tab (danger styling now applies), wrapped async methods in try/catch/finally across 5 admin tabs so loading states always reset and toasts show on API failure
- **Forge 422 on landing page** — VelgForgeMint called `/forge/bundles` and `/forge/wallet` without auth guard; added `isAuthenticated` check + lazy-load on mint open
- **Map dispatch log entity** — raw HTML entity `&#9650;` rendered as text instead of triangle symbol; switched to Unicode escapes
- **Forge anchor card overflow** — "Classified" footer text clipped by card overflow; added `min-height: 0` + `overflow: hidden` on body flex child
- **Hero preload mismatch** — `dashboard-hero.avif` preload replaced with `landing/hero.avif` (correct LCP target)
- **Aptitude RLS** — game instance simulations now have same read access as templates for epoch gameplay (migration 088)
- **Epoch audit** — guardian counting, scoring, game instance UUID fixes (migration 089)
- **Hard delete FK constraints** — battle_log SET NULL, event_echoes CASCADE to unblock simulation hard-delete (migration 095)

---

- **Graduated Event Pressure** — `POWER(impact_level/10, 1.5)` pressure formula with status multipliers (escalating 1.3x, resolving 0.5x) and emotion-weighted reaction modifiers (migrations 068, 070-071)
- **Event Lifecycle** — status workflow (active/escalating/resolving/resolved/archived) with event chains (escalation, follow_up, resolution, cascade, resonance) (migration 069)
- **Zone Gravity Matrix** — event-type to zone-type affinity matrix with auto-assignment trigger `assign_event_zones()` and `_global` flag for crisis events (migration 072)
- **Zone Vulnerability Matrix** — zone-type x event-type multipliers (0.5x-1.5x), per-simulation configurable via simulation_settings (migration 072)
- **Zone Actions** — player interventions: fortify (+0.3 stability, 7d/14d), quarantine (-0.1 + cascade-block, 14d/21d), deploy_resources (+0.5, 3d/30d) with cooldown validation (migration 072)
- **Cascade Events** — automatic follow-up event generation when zone pressure exceeds 0.7, rate-limited, quarantine-immune, zone-type-specific templates (migration 073)
- **Substrate Resonances** — platform-level event propagation through 8 archetypes (The Tower, The Shadow, The Devouring Mother, The Deluge, The Overthrow, The Prometheus, The Awakening, The Entropy) with susceptibility profiles, impact processing pipeline, and AI event generation (migrations 074-077)
- **Resonance Gameplay Integration** — archetype-operative affinities (+0.03 aligned, -0.02 opposed), zone pressure bonus, bot awareness for resonance pressure (migrations 078-079)
- **Attacker Pressure Penalty** — `fn_attacker_pressure_penalty()`: destabilized attackers lose up to -0.04 mission effectiveness (migration 080)
- **Event Seismograph** — SVG seismograph visualization (30/90/180/365 days) with spike colors by impact, pressure overlay, brush selection, resonance/cascade markers
- **Resonance Monitor** — platform-level dashboard for viewing active resonances with status/signature filters and auto-refresh
- **Admin Resonances Panel** — full CRUD + status transitions + impact processing + soft-delete/restore for substrate resonances
- **Admin API Keys** — admin panel for managing 6 platform API keys (OpenRouter, Replicate, Guardian, NewsAPI, Tavily, DeepL) with masked display and cache invalidation
- **Font Picker** — shared component with 13 curated fonts for theme customization in the Forge Darkroom

### Changed

- **Success probability formula** expanded from 5 terms to 8 terms: added `resonance_zone_pressure` (+0.00 to +0.04), `resonance_operative_modifier` (-0.04 to +0.04), `attacker_pressure_penalty` (-0.04 to 0.00)
- **mv_zone_stability formula** — event_pressure weight increased from 0.20 to 0.25
- **Resonance caps reduced** — operative modifier and zone pressure caps both reduced from 0.06 to 0.04 for tighter balance
- **Subsiding resonance decay** — subsiding resonances now contribute at 0.5x strength instead of full strength
- **Infiltrator balance** — now has 4 archetype alignments and 2 oppositions (The Entropy, The Devouring Mother)
- **Saboteur effect** — now generates crisis event (impact 3, diminishing: 3 to 2 to 1, skip at 3+)

### Fixed

- **Pydantic AI max_tokens exhausting OpenRouter credits** — all 13 `Agent.run()` calls now pass purpose-specific `max_tokens` (1024–16384) instead of the default 65536, preventing 402 errors; centralized token budget table and `ai_error_to_http` helper in `ai_utils.py`
- **Deprecated Pydantic AI API** — `result_type` → `output_type`, `result.data` → `result.output` in forge orchestrator recruit flow
- **Storage upload collisions** — added `upsert: true` to image uploads in `ImageService`
- **fn_target_zone_pressure NULL bug** — returned cap value instead of 0.0 when zone_id not found in mv_zone_stability
- **active_resonances view** — now excludes archived resonances (`AND status != 'archived'`)
