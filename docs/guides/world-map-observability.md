---
title: "World Map — Observability"
id: doc-world-map-observability
lang: en
type: guide
status: active
date: 2026-05-11
tags: [world-map, sentry, observability, alerts]
---

# World Map — Observability

Observability conventions for the per-simulation world-map feature
(`ForgeMapService` generation pipeline + `WorldMapService` read assembly).
See `docs/plans/per-simulation-world-map-plan.md` for the full feature spec.

## Sentry: forge map generation failures

When the orchestrator's Phase A.7 step fails, `ForgeMapService.generate_map`
captures the exception with these Sentry tags (see the `push_scope` block in
`backend/services/forge_map_service.py`):

| Tag | Value | Notes |
|-----|-------|-------|
| `service` | `ForgeMapService` | Stable identifier for alert grouping |
| `simulation_id` | UUID string | Lets you correlate to a specific world |
| `preset` | e.g. `medieval_walled` | Helps narrow generator-specific regressions |
| `seed` | string | Reproduction handle for the failed run |

### Recommended alert rule

**Trigger**: 3 or more events in 10 minutes with `tag.service:ForgeMapService`.

**Action**: notify `#ops` channel + create issue.

This catches generator regressions that would otherwise leave simulations
without a map. The Forge ignition completes either way (the orchestrator
catches and writes `forge_drafts.map_status='failed'`), so users see a
simulation come online without a map and no UI-level error — Sentry is
the only signal.

### Recovery path

Admin regeneration: `POST /api/v1/admin/simulations/{id}/map/regenerate`.
Optional body: `{ "seed": "...", "preset": "..." }` to override.

## Structured logs

`ForgeMapService` emits two events (`structlog`):

- `forge_map.generate.start` — fields: `simulation_id`, `preset`, `cities`,
  `zones`, `buildings`. Logged at the top of `generate_map()`.
- `forge_map.generate.complete` — fields: `simulation_id`, `preset`,
  `geometry_version`, `cities_updated`, `zones_updated`, `streets_inserted`,
  `buildings_updated`, `lives_at_inserted`, `duration_seconds`. Logged
  after the SQL function returns.

A spike in `.start` events without matching `.complete` within 30 seconds
indicates `fn_apply_map_geometry` is blocked — check `pg_stat_activity` for
queries waiting on row-level locks against `zones`, `city_streets`,
`buildings`, or `building_agent_relations`.

## Live stability overlay — polling cadence

The frontend re-fetches the `/map` payload every 60 seconds and updates the
zones source via `setData` only if any `stability_label` has changed. Match
expressions on the `zones-stability` layer paint the per-band tint
(`critical` / `unstable` / `functional` / `stable` / `exemplary`) on top of
the static category fill.

The polling interval is matched to the endpoint's `Cache-Control:
public, max-age=60`, so repeated polls land in the browser HTTP cache
between heartbeats — the network sees a 304 + cached body, the work cost
is bounded to a delta-compare on the typed zone array.

Polling is **visibility-aware**: when `document.hidden` is true the tick
short-circuits (no fetch, no setData), and the listener on
`visibilitychange` triggers an immediate catch-up refresh when the tab
returns to focus. A user who returns after hours of hidden tab sees the
overlay update within ~1 second.

Future Phase 6.2 will replace this polling with a Supabase Realtime
broadcast (`simulation:{id}:stability` channel) once a backend
DB-trigger or service-level emit exists. The frontend lifecycle hooks
already isolate the refresh path (`_refreshStability`), so the swap is
local to that method.

## Event markers via Realtime (Phase 6.2)

High-impact events (`events.impact_level >= 7`) fire a transient pulse
marker at the matched zone's centroid. Real-time delivery via Supabase
postgres_changes — the frontend subscribes to:

```
channel = realtime:world-map:events:{simulation_id}
filter  = simulation_id=eq.{simulation_id}
event   = INSERT on public.events
```

Backed by `supabase/migrations/20260511120000_237_events_realtime_publication.sql`
which adds the `events` table to the `supabase_realtime` publication.

Marker lifecycle:
- 14×14px circle in `--color-danger` at the zone-centroid pixel
- Two ripple rings (2s loop, 1s offset between them) expanding outward
- After 12s (`_EVENT_MARKER_TTL_MS`) a fade-out class triggers, then the
  Marker DOM is removed
- Replacing the same event id (re-fired INSERT) cancels and re-renders

Bandwidth caveat: every events INSERT now generates a WAL-replicated
Realtime broadcast (not just high-impact ones — filter happens client-side
after delivery). At metaverse.center's current scale this is negligible;
if event volume crosses ~1k inserts/min/simulation, consider switching to
the chat-broadcast pattern (DB trigger emits to a narrowed channel) — see
migration 179 for the precedent.

## Frontend cache + ETag

`WorldMapResponse.geometry_source_id` + `geometry_version` form a stable
cache key (see the `_etag_for` helper in `backend/routers/world_map.py`).
The endpoint returns:

```
ETag: "<hex(simulation_id:geometry_version)>"
Cache-Control: public, max-age=60, stale-while-revalidate=300
```

For Game-Instances, `geometry_source_id` resolves to the Template's id —
the ETag therefore changes when the Template is regenerated, not when the
Instance is mutated. Live overlays (zone stability) are deliberately NOT
in the cache key; they are refetched via Supabase Realtime (Phase 6,
planned).

## Frontend error surface

`SimulationWorldMap` wraps all failure paths in `captureError(err, { source:
'SimulationWorldMap.<method>' })` from `services/SentryService.ts`. The
component falls back to `<velg-error-state>` with a retry button on any
fetch or MapLibre-init failure — users always have a recovery action.

Specific failure points worth filtering Sentry on:

- `SimulationWorldMap._loadData` — API fetch or response-shape failure
- `SimulationWorldMap._initMap` — MapLibre constructor or dynamic-import failure
- `SimulationWorldMap.resize` — ResizeObserver callback failure
- `SimulationWorldMap._destroyMap` — cleanup failure (rare; would indicate
  a leaked WebGL context)
