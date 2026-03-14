# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

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
