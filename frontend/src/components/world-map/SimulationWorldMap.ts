import { localized, msg, str } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { html, LitElement, nothing, render, type TemplateResult } from 'lit';
import type { SVGTemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type {
  Map as MapLibreMap,
  MapLayerMouseEvent,
  Marker as MapLibreMarker,
  Popup as MapLibrePopup,
} from 'maplibre-gl';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { appState } from '../../services/AppStateManager.js';
import { worldMapApi } from '../../services/api/WorldMapApiService.js';
import { captureError } from '../../services/SentryService.js';
import { supabase } from '../../services/supabase/client.js';
import type {
  WorldMapAgentMarker,
  WorldMapBuilding,
  WorldMapEvent,
  WorldMapResponse,
  WorldMapZone,
} from '../../types/world-map.js';
import { icons } from '../../utils/icons.js';
import { t } from '../../utils/locale-fields.js';
import {
  type AgentRoleArchetype,
  agentRoleColorVar,
  buildMapStyle,
  buildZonesData,
  categoriseAgentRole,
  categoriseZoneType,
  computeBounds,
  polygonCentroid,
  readMapColors,
  type ZoneCategory,
  zoneCategoryColor,
} from './world-map-styles.js';

import '../shared/EmptyState.js';
import '../shared/ErrorState.js';

// Component CSS is loaded as a string via Vite's `?inline` query and injected
// at runtime into the appropriate scope (Document or containing ShadowRoot) —
// see `ensureComponentStyles` below. Plain `import './world-map.css'` would
// inject into document.head, which is the WRONG scope for light-DOM-render-root
// components nested inside a Shadow-DOM hierarchy (see CLAUDE.md frontend
// rule on Shadow-DOM CSS scoping).
import COMPONENT_CSS from './world-map.css?inline';

type SelectedEntity =
  | { kind: 'zone'; zone: WorldMapZone }
  | { kind: 'building'; building: WorldMapBuilding }
  | { kind: 'agent'; agent: WorldMapAgentMarker; building: WorldMapBuilding | null }
  | { kind: 'event'; event: WorldMapEvent; zone: WorldMapZone | null };

/**
 * Building-type → icon dispatch. Each entry returns a callable that yields a
 * Lit SVGTemplateResult so we can render directly into the marker's div via
 * Lit's `render()`. Unknown types fall back to a generic building outline.
 */
function buildingIcon(buildingType: string | null): (size?: number) => SVGTemplateResult {
  switch (buildingType) {
    case 'government':
      return icons.archetypeTower;
    case 'religious':
      return icons.sparkle;
    case 'cultural':
      return icons.palette;
    case 'archive':
      return icons.book;
    case 'restricted_zone':
      return icons.lock;
    case 'commercial':
      return icons.columns;
    case 'residential':
      return icons.users;
    case 'industrial':
      return icons.gear;
    default:
      return icons.building;
  }
}

/**
 * Event-type → CSS-token-var dispatch (Phase 8). Returned as a `var(--color-…)`
 * reference (not a resolved hex) so the marker live-updates if the theme
 * tokens shift. Drives the per-marker `--_event-color` custom property; the
 * pulse CSS reads from there with a danger fallback.
 */
function eventColorVar(eventType: string | null): string {
  switch (eventType) {
    case 'crisis':
    case 'conflict_wave':
    case 'biological_tide':
      return 'var(--color-danger)';
    case 'social':
    case 'consciousness_drift':
      return 'var(--color-info)';
    case 'economic_tremor':
    case 'innovation_spark':
      return 'var(--color-warning)';
    case 'cultural':
    case 'authority_fracture':
      return 'var(--color-epoch-influence)';
    case 'decay_bloom':
    case 'elemental_surge':
      return 'var(--color-success)';
    default:
      return 'var(--color-danger)';
  }
}

/**
 * Building-type → CSS-token-var dispatch — same theme-reactive pattern as
 * eventColorVar. Drives the per-marker `--_marker-color` for the brutalist
 * icon frame (border + icon stroke).
 */
function buildingMarkerColorVar(buildingType: string | null): string {
  switch (buildingType) {
    case 'government':
    case 'religious':
      return 'var(--color-primary)';
    case 'restricted_zone':
      return 'var(--color-danger)';
    case 'industrial':
      return 'var(--color-warning)';
    case 'commercial':
      return 'var(--color-info)';
    case 'cultural':
    case 'archive':
      return 'var(--color-epoch-influence)';
    case 'residential':
      return 'var(--color-success)';
    default:
      return 'var(--color-text-secondary)';
  }
}

/**
 * Padding (px) applied when fitting the map to its bounds. Larger on the
 * horizontal axis because the city / zone labels are `anchor: 'center'` DOM
 * markers that extend ~half their width past their geo point — a tight
 * padding clips long names (e.g. "Hafenstadt Korrin") at the viewport edge
 * even before the detail sidebar narrows the canvas. ~90px comfortably fits
 * labels up to ~180px wide. Used by both the initial fit and the re-fit on
 * sidebar toggle so the two stay consistent.
 */
const FIT_PADDING = { top: 40, bottom: 40, left: 90, right: 90 } as const;

/**
 * Wire a click + Enter/Space keyboard activation handler onto a DOM marker.
 * Centralises the pattern used by building / agent / event markers — without
 * this, each marker site duplicates ~6 lines of `addEventListener` + keydown
 * branching. The activate callback receives the Event so it can call
 * stopPropagation when the marker stacks above other interactive elements.
 */
function attachActivation(el: HTMLElement, onActivate: (e: Event) => void): void {
  el.addEventListener('click', onActivate);
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      // Space normally scrolls — kill it so the marker behaves like any
      // other activatable control.
      e.preventDefault();
      onActivate(e);
    }
  });
}

// Both this component's CSS and MapLibre's bundled CSS must be injected into
// the SAME shadow scope as the host element. Document-level styles do not
// pierce shadow boundaries — so e.g. maplibregl's `.maplibregl-ctrl-top-right
// { position: absolute }` does not apply when the map lives inside another
// component's shadow root, and the navigation control ends up at the bottom.
const _componentStyledRoots = new WeakSet<Document | ShadowRoot>();
const _maplibreStyledRoots = new WeakSet<Document | ShadowRoot>();

function appendStyle(scope: Document | ShadowRoot, marker: string, css: string): void {
  const styleEl = document.createElement('style');
  styleEl.setAttribute(marker, '');
  styleEl.textContent = css;
  if (scope instanceof ShadowRoot) scope.appendChild(styleEl);
  else document.head.appendChild(styleEl);
}

function resolveScope(host: HTMLElement): Document | ShadowRoot {
  const root = host.getRootNode();
  return root instanceof ShadowRoot ? root : document;
}

function ensureComponentStyles(host: HTMLElement): void {
  const scope = resolveScope(host);
  if (_componentStyledRoots.has(scope)) return;
  appendStyle(scope, 'data-velg-world-map', COMPONENT_CSS);
  _componentStyledRoots.add(scope);
}

let _maplibreCssText: string | null = null;
async function ensureMapLibreCss(host: HTMLElement): Promise<void> {
  const scope = resolveScope(host);
  if (_maplibreStyledRoots.has(scope)) return;
  if (_maplibreCssText === null) {
    const mod = await import('maplibre-gl/dist/maplibre-gl.css?inline');
    _maplibreCssText = mod.default;
  }
  appendStyle(scope, 'data-velg-world-map-maplibre', _maplibreCssText);
  _maplibreStyledRoots.add(scope);
}

@localized()
@customElement('velg-simulation-world-map')
export class VelgSimulationWorldMap extends SignalWatcher(LitElement) {
  protected createRenderRoot(): HTMLElement {
    return this;
  }

  @property({ type: String }) simulationId = '';

  @state() private _loading = true;
  @state() private _error: string | null = null;
  @state() private _data: WorldMapResponse | null = null;
  @state() private _selected: SelectedEntity | null = null;

  private _map: MapLibreMap | null = null;
  private _appliedSimulationId = '';
  private _hoveredZoneId: string | null = null;
  private _resizeObserver: ResizeObserver | null = null;
  /**
   * The geographic bounds the map was fitted to on init — cached so the map
   * can be re-fitted when the layout changes (the detail sidebar opening /
   * closing resizes the canvas; without a re-fit, edge labels get clipped by
   * the now-narrower viewport).
   */
  private _fittedBounds: [[number, number], [number, number]] | null = null;
  /**
   * Element that had focus when the sidebar was opened — the close button and
   * the Escape key restore focus here so keyboard users aren't dumped at the
   * top of the document. Cleared once consumed.
   */
  private _focusReturnEl: HTMLElement | null = null;
  private _keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  /** Which `world-map--zoom-{far,mid,near}` class is currently on the host —
   *  null when no map is mounted. Tracked so _applyZoomTier only writes the
   *  DOM when the threshold is actually crossed. */
  private _appliedZoomTier: 'far' | 'mid' | 'near' | null = null;
  private _loadGeneration = 0;
  private _buildingsById: Map<string, WorldMapBuilding> = new Map();
  private _zonesById: Map<string, WorldMapZone> = new Map();
  private _agentsById: Map<string, WorldMapAgentMarker> = new Map();
  private _markers: MapLibreMarker[] = [];
  private _hoverPopup: MapLibrePopup | null = null;
  private _stabilityTimer: ReturnType<typeof setInterval> | null = null;
  private _visibilityChangeHandler: (() => void) | null = null;
  private _eventsChannel: RealtimeChannel | null = null;
  private _eventMarkers: Map<
    string,
    {
      marker: MapLibreMarker;
      timeout: ReturnType<typeof setTimeout>;
      event: WorldMapEvent;
      zoneId: string | null;
    }
  > = new Map();

  /**
   * Impact threshold for event-marker rendering. Events below this are skipped
   * — the marker is meant for "noteworthy spikes the user wants to see right
   * away", not the steady stream of low-impact background events.
   */
  private static readonly _EVENT_MARKER_MIN_IMPACT = 7;

  /**
   * How long an event marker stays on the map before fading + removal (ms).
   * Picked so multiple events firing in the same heartbeat overlap visually
   * (forms a cluster), but stale markers don't accumulate indefinitely.
   */
  private static readonly _EVENT_MARKER_TTL_MS = 12_000;
  private static readonly _EVENT_MARKER_FADE_MS = 1_000;

  /**
   * Cap on concurrent event markers. A burst of high-impact events (e.g. a
   * chronicle batch) would otherwise blanket the map with pulse rings; past
   * this many, the oldest marker is evicted so the cluster stays readable.
   */
  private static readonly _EVENT_MARKER_MAX = 8;

  /**
   * Polling interval for the live stability overlay (Phase 6.1).
   * Matched to the public-map endpoint's `Cache-Control: max-age=60` so the
   * browser HTTP cache absorbs polls that fire within the same cache window
   * (304 + cached body), making refresh effectively free between heartbeats.
   * Phase 6.2 will replace polling with a Supabase Realtime broadcast.
   */
  private static readonly _STABILITY_REFRESH_MS = 60_000;

  /**
   * Zoom-tier thresholds (the map runs minZoom 10 → maxZoom 20). Below MID
   * only city labels + zone fills show; from MID up, zone name labels and
   * building icons appear; from NEAR up, agent dots appear too. A zoomed-out
   * view of a multi-city sim would otherwise be a sea of overlapping 22 px
   * icons — this keeps the overview legible and reveals detail on zoom-in,
   * the same way an OSM-style slippy map does. Tier classes
   * (`world-map--zoom-{far,mid,near}`) live on the host; the visibility rules
   * are in world-map.css.
   */
  private static readonly _ZOOM_TIER_MID = 12;
  private static readonly _ZOOM_TIER_NEAR = 14;

  connectedCallback(): void {
    super.connectedCallback();
    ensureComponentStyles(this);
    // Escape closes the detail sidebar from anywhere inside the atlas (the
    // sidebar is non-modal, so this is a convenience dismiss, not a focus
    // trap). Not stopped — MapLibre still gets the event for box-zoom cancel.
    this._keydownHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this._selected !== null) {
        this._closeSidebar();
      }
    };
    this.addEventListener('keydown', this._keydownHandler);
    if (this.simulationId) {
      void this._loadData();
    }
  }

  disconnectedCallback(): void {
    if (this._keydownHandler) {
      this.removeEventListener('keydown', this._keydownHandler);
      this._keydownHandler = null;
    }
    this._focusReturnEl = null;
    this._destroyMap();
    super.disconnectedCallback();
  }

  protected willUpdate(changedProperties: Map<PropertyKey, unknown>): void {
    if (
      changedProperties.has('simulationId') &&
      this.simulationId &&
      this.simulationId !== this._appliedSimulationId
    ) {
      void this._loadData();
    }
  }

  private async _loadData(): Promise<void> {
    if (!this.simulationId) return;
    this._appliedSimulationId = this.simulationId;
    const generation = ++this._loadGeneration;

    this._loading = true;
    this._error = null;
    this._selected = null;
    this._destroyMap();

    try {
      const result = await worldMapApi.getMap(this.simulationId);
      if (generation !== this._loadGeneration) return;

      if (result.success && result.data) {
        this._data = result.data;
        this._zonesById = new Map(result.data.zones.map((z) => [z.id, z]));
        this._buildingsById = new Map(result.data.buildings.map((b) => [b.id, b]));
        this._agentsById = new Map(result.data.agent_markers.map((m) => [m.agent_id, m]));
        this._loading = false;
        await this.updateComplete;
        if (generation !== this._loadGeneration) return;
        if (computeBounds(result.data) !== null) {
          await this._initMap(generation);
        }
      } else {
        this._error = result.error?.message ?? msg('Could not load cartographic data.');
        this._loading = false;
      }
    } catch (err) {
      captureError(err, {
        source: 'SimulationWorldMap._loadData',
        simulationId: this.simulationId,
      });
      if (generation === this._loadGeneration) {
        this._error = msg('Could not load cartographic data.');
        this._loading = false;
      }
    }
  }

  private async _initMap(generation: number): Promise<void> {
    if (!this._data) return;
    const containerEl = this.querySelector<HTMLDivElement>('.world-map__canvas');
    if (!containerEl) return;

    try {
      const [{ Map: MapLibreCtor, NavigationControl, Marker, Popup }] = await Promise.all([
        import('maplibre-gl'),
        ensureMapLibreCss(this),
      ]);
      // Dynamic imports can race with sim-switches: a stale _initMap invocation
      // could otherwise attach a second map to the canvas. Abort if we're no
      // longer the active load.
      if (generation !== this._loadGeneration) return;

      const colors = readMapColors(this, this._data.theme_hints);
      const style = buildMapStyle(this._data, colors);

      const bounds = computeBounds(this._data);
      if (bounds === null) {
        return;
      }
      this._fittedBounds = bounds;
      const animate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      const map = new MapLibreCtor({
        container: containerEl,
        style,
        bounds,
        fitBoundsOptions: { padding: FIT_PADDING, animate, duration: animate ? 600 : 0 },
        attributionControl: false,
        renderWorldCopies: false,
        dragRotate: false,
        pitchWithRotate: false,
        cooperativeGestures: false,
        maxZoom: 20,
        minZoom: 10,
      });
      // Track the instance immediately so partial-init failures still get
      // cleaned up by _destroyMap (avoids WebGL-context leaks).
      this._map = map;
      map.touchZoomRotate.disableRotation();

      map.addControl(new NavigationControl({ showCompass: false, visualizePitch: false }), 'top-right');

      this._createBuildingPopup(map, Popup);

      map.on('load', () => {
        try {
          map.resize();
          this._renderLabels(map, Marker);
          this._renderBuildingMarkers(map, Marker);
          this._renderAgentMarkers(map, Marker);
          this._applyZoomTier();
          this._startStabilityRefresh();
          this._subscribeToEvents(map, Marker);
        } catch (err) {
          captureError(err, { source: 'SimulationWorldMap._initMap.onLoad' });
        }
      });

      // Zoom-tier marker visibility — fires continuously during a zoom gesture,
      // but _applyZoomTier only touches the DOM when a threshold is crossed.
      map.on('zoom', () => this._applyZoomTier());

      // Zones stay as MapLibre fill layers (clickable via layer hit-testing);
      // buildings + agents are DOM markers (their click/hover are wired in
      // the renderMarkers methods directly).
      map.on('mousemove', 'zones-fill', (e: MapLayerMouseEvent) => this._handleZoneHover(map, e));
      map.on('mouseleave', 'zones-fill', () => this._clearZoneHover(map));
      map.on('click', 'zones-fill', (e: MapLayerMouseEvent) => this._handleZoneClick(e));
      map.on('mouseenter', 'zones-fill', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'zones-fill', () => {
        map.getCanvas().style.cursor = '';
      });

      if (typeof ResizeObserver !== 'undefined') {
        this._resizeObserver = new ResizeObserver(() => {
          try {
            map.resize();
          } catch (err) {
            captureError(err, { source: 'SimulationWorldMap.resize' });
          }
        });
        this._resizeObserver.observe(containerEl);
      }
    } catch (err) {
      captureError(err, { source: 'SimulationWorldMap._initMap' });
      this._error = msg('Could not initialize map renderer.');
    }
  }

  private _destroyMap(): void {
    this._stopStabilityRefresh();
    this._unsubscribeFromEvents();
    try {
      this._resizeObserver?.disconnect();
      for (const marker of this._markers) marker.remove();
      this._hoverPopup?.remove();
      this._map?.remove();
    } catch (err) {
      captureError(err, { source: 'SimulationWorldMap._destroyMap' });
    }
    this._resizeObserver = null;
    this._markers = [];
    this._hoverPopup = null;
    this._map = null;
    this._hoveredZoneId = null;
    this._fittedBounds = null;
    if (this._appliedZoomTier) {
      this.classList.remove(`world-map--zoom-${this._appliedZoomTier}`);
      this._appliedZoomTier = null;
    }
  }

  /**
   * Toggle the host's zoom-tier class so CSS can hide/show marker layers by
   * zoom level (see `_ZOOM_TIER_*` and the rules in world-map.css). Called on
   * every `zoom` event, but only writes the DOM when the tier actually
   * changes — the per-frame cost during a zoom gesture is a getZoom() read
   * plus a comparison.
   */
  private _applyZoomTier(): void {
    const map = this._map;
    if (!map) return;
    const z = map.getZoom();
    const tier: 'far' | 'mid' | 'near' =
      z >= VelgSimulationWorldMap._ZOOM_TIER_NEAR
        ? 'near'
        : z >= VelgSimulationWorldMap._ZOOM_TIER_MID
          ? 'mid'
          : 'far';
    if (tier === this._appliedZoomTier) return;
    if (this._appliedZoomTier) this.classList.remove(`world-map--zoom-${this._appliedZoomTier}`);
    this.classList.add(`world-map--zoom-${tier}`);
    this._appliedZoomTier = tier;
  }

  /**
   * Re-fit the map to its cached bounds after a layout change. The detail
   * sidebar opening/closing changes the canvas dimensions (narrower on
   * desktop, shorter on mobile); a plain `resize()` keeps the geographic
   * centre fixed, which pushes edge labels (e.g. "Hafenstadt Korrin") past
   * the new viewport edge where `overflow: hidden` clips them. `fitBounds`
   * re-derives zoom + centre for whatever the canvas size now is, so all
   * content stays inside. Runs after `updateComplete` so the sidebar is in
   * the DOM and the canvas has its final size; `resize()` first in case the
   * ResizeObserver hasn't fired yet (idempotent).
   */
  private _refitForLayout(): void {
    const map = this._map;
    const bounds = this._fittedBounds;
    if (!map || !bounds) return;
    const animate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    void this.updateComplete.then(() => {
      if (this._map !== map) return; // sim switched out from under us
      try {
        map.resize();
        map.fitBounds(bounds, { padding: FIT_PADDING, duration: animate ? 280 : 0, maxZoom: 20 });
      } catch (err) {
        captureError(err, { source: 'SimulationWorldMap._refitForLayout' });
      }
    });
  }

  private _startStabilityRefresh(): void {
    this._stopStabilityRefresh();
    // Visibility-aware tick: the setInterval keeps firing on its 60s cadence
    // (kept-alive by the browser even when the tab is hidden, throttled to a
    // 1s minimum anyway), but the work is gated on document visibility.
    // The cost of a no-op tick is negligible vs. the lifecycle complexity of
    // start/stop cycling.
    this._stabilityTimer = setInterval(() => {
      if (document.hidden) return;
      void this._refreshStability();
    }, VelgSimulationWorldMap._STABILITY_REFRESH_MS);
    // Catch-up refresh when the user returns to a previously-hidden tab — we
    // may have missed several heartbeats while away.
    this._visibilityChangeHandler = () => {
      if (!document.hidden && this._map) {
        void this._refreshStability();
      }
    };
    document.addEventListener('visibilitychange', this._visibilityChangeHandler);
  }

  private _stopStabilityRefresh(): void {
    if (this._stabilityTimer !== null) {
      clearInterval(this._stabilityTimer);
      this._stabilityTimer = null;
    }
    if (this._visibilityChangeHandler !== null) {
      document.removeEventListener('visibilitychange', this._visibilityChangeHandler);
      this._visibilityChangeHandler = null;
    }
  }

  /**
   * Poll the public-map endpoint and update the zones source if any
   * stability_label changed. setData on a source with stable promoteId
   * preserves feature-state (hover), so the user's current interaction
   * isn't disrupted by the refresh.
   *
   * The endpoint's Cache-Control: max-age=60 means polls within the same
   * cache window get 304 + browser-cached body — effectively free.
   */
  private async _refreshStability(): Promise<void> {
    if (!this._map || !this._data) return;
    try {
      const result = await worldMapApi.getMap(this.simulationId);
      if (!result.success || !result.data) return;
      const next = result.data;

      // Short-circuit if no stability values changed.
      let changed = false;
      for (const z of next.zones) {
        const prev = this._zonesById.get(z.id);
        if (!prev || prev.stability_label !== z.stability_label || prev.stability !== z.stability) {
          changed = true;
          break;
        }
      }
      if (!changed) return;

      this._data = next;
      this._zonesById = new Map(next.zones.map((z) => [z.id, z]));
      this._buildingsById = new Map(next.buildings.map((b) => [b.id, b]));
      this._agentsById = new Map(next.agent_markers.map((m) => [m.agent_id, m]));

      const src = this._map.getSource('zones');
      if (src && 'setData' in src && typeof src.setData === 'function') {
        src.setData(buildZonesData(next.zones));
      }
    } catch (err) {
      captureError(err, {
        source: 'SimulationWorldMap._refreshStability',
        simulationId: this.simulationId,
      });
    }
  }

  /**
   * Subscribe to high-impact event INSERTs for the current simulation and
   * render transient pulse markers at the matched zone's centroid (Phase 6.2).
   *
   * Backed by Supabase Realtime `postgres_changes` — see migration 237 which
   * adds the `events` table to the `supabase_realtime` publication. The
   * subscription is scoped per simulation_id and tears down on sim-switch
   * via `_unsubscribeFromEvents`.
   */
  private _subscribeToEvents(
    map: MapLibreMap,
    MarkerCtor: new (opts: { element: HTMLElement; anchor?: 'center' }) => MapLibreMarker,
  ): void {
    if (!this.simulationId) return;
    this._unsubscribeFromEvents();
    this._eventsChannel = supabase
      .channel(`world-map:events:${this.simulationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'events',
          filter: `simulation_id=eq.${this.simulationId}`,
        },
        (payload) => {
          try {
            const row = payload.new as {
              id?: unknown;
              location?: unknown;
              impact_level?: unknown;
              title?: unknown;
              event_type?: unknown;
              occurred_at?: unknown;
            };
            const id = typeof row.id === 'string' ? row.id : null;
            const location = typeof row.location === 'string' ? row.location : null;
            const impact = typeof row.impact_level === 'number' ? row.impact_level : 0;
            if (!id || !location) return;
            if (impact < VelgSimulationWorldMap._EVENT_MARKER_MIN_IMPACT) return;
            const event: WorldMapEvent = {
              id,
              title: typeof row.title === 'string' ? row.title : '',
              location,
              impact_level: impact,
              event_type: typeof row.event_type === 'string' ? row.event_type : null,
              occurred_at: typeof row.occurred_at === 'string' ? row.occurred_at : null,
            };
            this._dropEventMarker(map, MarkerCtor, event);
          } catch (err) {
            captureError(err, { source: 'SimulationWorldMap._subscribeToEvents.onInsert' });
          }
        },
      )
      .subscribe();
  }

  private _unsubscribeFromEvents(): void {
    if (this._eventsChannel !== null) {
      try {
        supabase.removeChannel(this._eventsChannel);
      } catch (err) {
        captureError(err, { source: 'SimulationWorldMap._unsubscribeFromEvents' });
      }
      this._eventsChannel = null;
    }
    // Snapshot keys before disposing — _disposeEventMarker mutates the map.
    for (const id of [...this._eventMarkers.keys()]) this._disposeEventMarker(id);
  }

  /**
   * Tear down one event-marker entry: stop its TTL timer, remove the MapLibre
   * marker, drop it from the registry. Safe to call for an unknown id (no-op).
   */
  private _disposeEventMarker(id: string): void {
    const entry = this._eventMarkers.get(id);
    if (!entry) return;
    clearTimeout(entry.timeout);
    try {
      entry.marker.remove();
    } catch (err) {
      captureError(err, { source: 'SimulationWorldMap._disposeEventMarker' });
    }
    this._eventMarkers.delete(id);
  }

  private _dropEventMarker(
    map: MapLibreMap,
    MarkerCtor: new (opts: { element: HTMLElement; anchor?: 'center' }) => MapLibreMarker,
    event: WorldMapEvent,
  ): void {
    // Find the zone whose name matches the event's location. Linear scan over
    // ≤ dozens of zones — no Map needed.
    let matchedZone: WorldMapZone | null = null;
    for (const zone of this._zonesById.values()) {
      if (zone.name === event.location && zone.geojson) {
        matchedZone = zone;
        break;
      }
    }
    if (matchedZone === null || matchedZone.geojson === null) return;
    const centroid = polygonCentroid(matchedZone.geojson);
    if (centroid === null) return;

    // Replace any existing marker for the same event id (re-fired INSERTs).
    // Dispose fully so the re-inserted entry lands at the END of the Map's
    // insertion order — keeps "oldest" eviction (below) honest.
    this._disposeEventMarker(event.id);

    const el = document.createElement('div');
    el.className = 'velg-map-event-marker';
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', event.title || msg('Event'));
    // Per-marker color from event-type dispatch; CSS reads via --_event-color
    // with danger as the fallback for unknown / null types.
    el.style.setProperty('--_event-color', eventColorVar(event.event_type));
    const ripple1 = document.createElement('div');
    ripple1.className = 'velg-map-event-marker__ripple';
    el.appendChild(ripple1);
    const ripple2 = document.createElement('div');
    ripple2.className = 'velg-map-event-marker__ripple velg-map-event-marker__ripple--delayed';
    el.appendChild(ripple2);

    attachActivation(el, (e) => {
      e.stopPropagation();
      this._selectEvent(event.id);
    });

    const marker = new MarkerCtor({ element: el, anchor: 'center' })
      .setLngLat(centroid)
      .addTo(map);

    const timeout = setTimeout(() => {
      el.classList.add('velg-map-event-marker--fading');
      const fadeTimer = setTimeout(() => {
        try {
          marker.remove();
        } catch (err) {
          captureError(err, { source: 'SimulationWorldMap._dropEventMarker.cleanup' });
        }
        this._eventMarkers.delete(event.id);
        // Sidebar is intentionally LEFT OPEN after marker fade — the event
        // data is still valid, and auto-closing a panel the user opened to
        // read is jarring. They close manually when done.
      }, VelgSimulationWorldMap._EVENT_MARKER_FADE_MS);
      // Hand the active timer to the registry entry so _disposeEventMarker can
      // cancel whichever phase (TTL or fade) the marker is currently in — the
      // TTL timer above has already fired by the time this runs.
      const entry = this._eventMarkers.get(event.id);
      if (entry) entry.timeout = fadeTimer;
    }, VelgSimulationWorldMap._EVENT_MARKER_TTL_MS);

    this._eventMarkers.set(event.id, {
      marker,
      timeout,
      event,
      zoneId: matchedZone.id,
    });

    // Evict the oldest while over the cap. The just-added entry is at the end
    // of the insertion order (we disposed any same-id entry above), so
    // `keys().next()` always yields a strictly-older marker.
    while (this._eventMarkers.size > VelgSimulationWorldMap._EVENT_MARKER_MAX) {
      const oldest = this._eventMarkers.keys().next().value;
      if (oldest === undefined) break;
      this._disposeEventMarker(oldest);
    }
  }

  private _selectEvent(id: string): void {
    const entry = this._eventMarkers.get(id);
    if (!entry) return;
    const zone = entry.zoneId !== null ? (this._zonesById.get(entry.zoneId) ?? null) : null;
    this._setSelection({ kind: 'event', event: entry.event, zone });
  }

  /**
   * Create the singleton building popup instance — Phase 8 refactor: the
   * trigger is now DOM mouseenter/leave on building-marker elements (since
   * buildings render as DOM markers, not MapLibre circle features). The
   * popup itself is still a MapLibre Popup so it leverages the map's
   * projection on pan/zoom.
   */
  private _createBuildingPopup(
    _map: MapLibreMap,
    PopupCtor: new (opts: {
      closeButton: boolean;
      closeOnClick: boolean;
      offset: number;
      className: string;
    }) => MapLibrePopup,
  ): void {
    this._hoverPopup = new PopupCtor({
      closeButton: false,
      closeOnClick: false,
      offset: 10,
      className: 'velg-map-popup',
    });
  }

  private _showBuildingPopup(map: MapLibreMap, building: WorldMapBuilding): void {
    if (!this._hoverPopup || !building.geojson) return;
    const [lng, lat] = building.geojson.coordinates;
    const el = document.createElement('div');
    el.className = 'velg-map-popup__body';
    const name = document.createElement('div');
    name.className = 'velg-map-popup__name';
    name.textContent = building.name;
    el.appendChild(name);
    if (building.building_type) {
      const type = document.createElement('div');
      type.className = 'velg-map-popup__meta';
      type.textContent = building.building_type;
      el.appendChild(type);
    }
    this._hoverPopup.setLngLat([lng, lat]).setDOMContent(el).addTo(map);
  }

  private _hideBuildingPopup(): void {
    this._hoverPopup?.remove();
  }

  private _renderLabels(
    map: MapLibreMap,
    MarkerCtor: new (opts: { element: HTMLElement; anchor?: 'center' }) => MapLibreMarker,
  ): void {
    if (!this._data) return;

    for (const city of this._data.cities) {
      if (city.map_center_lat == null || city.map_center_lng == null) continue;
      const el = document.createElement('div');
      el.className = 'velg-map-label velg-map-label--city';
      el.textContent = city.name;
      const marker = new MarkerCtor({ element: el, anchor: 'center' })
        .setLngLat([city.map_center_lng, city.map_center_lat])
        .addTo(map);
      this._markers.push(marker);
    }

    const colors = readMapColors(this, this._data.theme_hints);
    for (const zone of this._data.zones) {
      if (!zone.geojson) continue;
      const centroid = polygonCentroid(zone.geojson);
      if (!centroid) continue;
      const category = categoriseZoneType(zone.zone_type);
      const tint = zoneCategoryColor(category, colors);
      const el = document.createElement('div');
      el.className = 'velg-map-label velg-map-label--zone';
      el.style.setProperty('--_zone-tint', tint);
      const name = document.createElement('div');
      name.className = 'velg-map-label__name';
      name.textContent = zone.name;
      el.appendChild(name);
      if (zone.zone_type) {
        const kind = document.createElement('div');
        kind.className = 'velg-map-label__kind';
        kind.textContent = zone.zone_type;
        el.appendChild(kind);
      }
      const marker = new MarkerCtor({ element: el, anchor: 'center' })
        .setLngLat(centroid)
        .addTo(map);
      this._markers.push(marker);
    }
  }

  /**
   * Render building markers as DOM elements (Phase 8). Each marker is a
   * brutalist icon-in-a-frame whose icon + frame color is dispatched from the
   * building's type — government tower, sacred sparkle, archive book, etc.
   * Click activates the sidebar; mouseenter shows the floating popup.
   *
   * DOM markers (not MapLibre circle layers) so we can render SVG icons via
   * Lit's `render()` and keep the layer count low. MapLibre re-projects the
   * marker's screen position on every pan/zoom — no manual sync needed.
   */
  private _renderBuildingMarkers(
    map: MapLibreMap,
    MarkerCtor: new (opts: { element: HTMLElement; anchor?: 'center' }) => MapLibreMarker,
  ): void {
    if (!this._data) return;
    for (const building of this._data.buildings) {
      if (!building.geojson) continue;
      const [lng, lat] = building.geojson.coordinates;
      const el = document.createElement('div');
      el.className = 'velg-map-building-marker';
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.setAttribute('aria-label', building.name);
      el.style.setProperty('--_marker-color', buildingMarkerColorVar(building.building_type));
      // The icon lives in an inner __frame span, not in `el` directly:
      // MapLibre overwrites `transform` on `el` for positioning, so the
      // frame's hover-scale + transition only work on a child it doesn't
      // touch. The frame inherits --_marker-color from `el`. See world-map.css.
      const frame = document.createElement('span');
      frame.className = 'velg-map-building-marker__frame';
      render(buildingIcon(building.building_type)(12), frame);
      el.appendChild(frame);

      el.addEventListener('mouseenter', () => this._showBuildingPopup(map, building));
      el.addEventListener('mouseleave', () => this._hideBuildingPopup());
      el.addEventListener('focus', () => this._showBuildingPopup(map, building));
      el.addEventListener('blur', () => this._hideBuildingPopup());
      attachActivation(el, (e) => {
        e.stopPropagation();
        this._selectBuilding(building.id);
      });

      const marker = new MarkerCtor({ element: el, anchor: 'center' })
        .setLngLat([lng, lat])
        .addTo(map);
      this._markers.push(marker);
    }
  }

  /**
   * Render agent markers grouped by home_building_id. When N agents share a
   * home, one marker shows the count badge (clicking selects the first agent
   * in the group). Marker is anchored slightly NE of the building icon so
   * the two don't visually stack.
   */
  private _renderAgentMarkers(
    map: MapLibreMap,
    MarkerCtor: new (opts: { element: HTMLElement; anchor?: 'center' }) => MapLibreMarker,
  ): void {
    if (!this._data) return;
    const groups = new Map<string, WorldMapAgentMarker[]>();
    for (const agent of this._data.agent_markers) {
      if (!agent.home_building_id) continue;
      const existing = groups.get(agent.home_building_id);
      if (existing) existing.push(agent);
      else groups.set(agent.home_building_id, [agent]);
    }
    for (const [buildingId, agents] of groups) {
      const building = this._buildingsById.get(buildingId);
      if (!building?.geojson) continue;
      const [lng, lat] = building.geojson.coordinates;
      const first = agents[0];
      const count = agents.length;

      const el = document.createElement('div');
      el.className = 'velg-map-agent-marker';
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      // Tint the dot by the click-target agent's role archetype (the one the
      // marker selects), so the colour matches the panel that opens. Falls
      // back to phosphor-green for unrecognised / missing professions.
      el.style.setProperty('--_agent-color', agentRoleColorVar(categoriseAgentRole(first.profession)));
      // str-template keeps the full sentence translatable as one unit —
      // German translators can reorder to "${count} Agenten wohnen in ${name}"
      // rather than being stuck with the English word order.
      el.setAttribute(
        'aria-label',
        count === 1
          ? first.name
          : msg(str`${count} agents living at ${building.name}`),
      );
      const dot = document.createElement('span');
      dot.className = 'velg-map-agent-marker__dot';
      el.appendChild(dot);
      if (count > 1) {
        const badge = document.createElement('span');
        badge.className = 'velg-map-agent-marker__count';
        badge.textContent = String(count);
        el.appendChild(badge);
      }

      attachActivation(el, (e) => {
        e.stopPropagation();
        this._selectAgent(first.agent_id);
      });

      const marker = new MarkerCtor({ element: el, anchor: 'center' })
        .setLngLat([lng, lat])
        .addTo(map);
      // Offset NE so the agent dot rides on the shoulder of the building icon.
      marker.setOffset([14, -14]);
      this._markers.push(marker);
    }
  }

  private _handleZoneHover(map: MapLibreMap, e: MapLayerMouseEvent): void {
    // Hover state uses MapLibre's auto-assigned numeric feature.id (not our
    // UUID from properties.id) because setFeatureState is keyed on the same
    // internal IDs that the paint-time `feature-state` expression resolves.
    const feature = e.features?.[0];
    if (!feature || feature.id == null) return;
    const id = String(feature.id);
    if (this._hoveredZoneId === id) return;
    if (this._hoveredZoneId) {
      map.setFeatureState({ source: 'zones', id: this._hoveredZoneId }, { hover: false });
    }
    map.setFeatureState({ source: 'zones', id }, { hover: true });
    this._hoveredZoneId = id;
  }

  private _clearZoneHover(map: MapLibreMap): void {
    if (this._hoveredZoneId) {
      map.setFeatureState({ source: 'zones', id: this._hoveredZoneId }, { hover: false });
      this._hoveredZoneId = null;
    }
  }

  private _handleZoneClick(e: MapLayerMouseEvent): void {
    // MapLibre's GeoJSONSource auto-assigns numeric feature.id values (0,1,2,…)
    // when the input features have non-numeric IDs. Our UUID lives in
    // properties.id and is the only stable handle into _zonesById.
    const feature = e.features?.[0];
    const id = feature?.properties?.id;
    if (typeof id !== 'string') return;
    const zone = this._zonesById.get(id);
    if (zone) this._setSelection({ kind: 'zone', zone });
  }

  private _selectBuilding(id: string): void {
    const building = this._buildingsById.get(id);
    if (building) this._setSelection({ kind: 'building', building });
  }

  private _selectAgent(id: string): void {
    const agent = this._agentsById.get(id);
    if (!agent) return;
    const building = agent.home_building_id
      ? (this._buildingsById.get(agent.home_building_id) ?? null)
      : null;
    this._setSelection({ kind: 'agent', agent, building });
  }

  private _closeSidebar(): void {
    this._setSelection(null);
  }

  /**
   * Single entry point for changing the sidebar selection. Responsibilities:
   *  - hide the hover popup (a clicked marker's mouseenter popup must not
   *    visually duplicate the sidebar content)
   *  - on open: remember the focus origin, then move focus to the sidebar's
   *    close button after the re-render (keyboard users land in the panel)
   *  - on close: restore focus to the origin (or the canvas as a fallback if
   *    the origin element is gone — e.g. an event marker that faded out)
   * Setting `_selected` on a `@state` field auto-triggers the re-render.
   */
  private _setSelection(entity: SelectedEntity | null): void {
    this._hideBuildingPopup();
    const wasOpen = this._selected !== null;
    const willOpen = entity !== null;
    if (willOpen && !wasOpen) {
      const root = this.getRootNode();
      const active =
        root instanceof ShadowRoot || root instanceof Document ? root.activeElement : null;
      this._focusReturnEl =
        active instanceof HTMLElement && this.contains(active) ? active : null;
    }
    this._selected = entity;
    // Open ⇄ closed transitions resize the canvas — re-fit so edge labels
    // don't get clipped. Switching between entities (open → open) leaves the
    // canvas size unchanged, so skip the (wasteful) re-fit then.
    if (wasOpen !== willOpen) this._refitForLayout();
    if (willOpen) {
      void this.updateComplete.then(() => {
        this.querySelector<HTMLButtonElement>('.world-map__sidebar-close')?.focus();
      });
    } else if (wasOpen) {
      const target = this._focusReturnEl;
      this._focusReturnEl = null;
      void this.updateComplete.then(() => {
        if (target && target.isConnected) target.focus();
        // MapLibre's <canvas> carries tabindex=0; fall back there so focus
        // lands somewhere meaningful rather than the document body.
        else this.querySelector<HTMLElement>('.maplibregl-canvas')?.focus();
      });
    }
  }

  private _renderHeader(): TemplateResult {
    const data = this._data;
    const slug = data?.simulation_slug ?? appState.currentSimulation.value?.slug ?? '';
    const isInstance = data?.is_game_instance ?? false;
    const version = data?.geometry_version ?? 0;

    return html`
      <header class="world-map__header">
        <span class="world-map__stamp">${msg('Cartographic Archive')}</span>
        <span class="world-map__sim">${slug || msg('Simulation')}</span>
        <span class="world-map__sep">//</span>
        <span class="world-map__kind ${isInstance ? 'world-map__kind--instance' : ''}">
          ${isInstance ? msg('Game Instance') : msg('Template Geometry')}
        </span>
        <span class="world-map__version">${msg('Geometry')} v.${version}</span>
      </header>
    `;
  }

  private _renderFooter(): TemplateResult {
    const presentCategories: ZoneCategory[] = [];
    // Recognised agent-role archetypes present in the data. `other` is
    // intentionally excluded — the generic "Agent home" swatch already
    // covers it (its colour IS the `other` tint), so listing it again would
    // just be a redundant chip with a different label than the zone "Other".
    const presentAgentRoles: AgentRoleArchetype[] = [];
    if (this._data) {
      const seenCats = new Set<ZoneCategory>();
      for (const zone of this._data.zones) {
        const cat = categoriseZoneType(zone.zone_type);
        if (!seenCats.has(cat)) {
          seenCats.add(cat);
          presentCategories.push(cat);
        }
      }
      const seenRoles = new Set<AgentRoleArchetype>();
      for (const m of this._data.agent_markers) {
        const arch = categoriseAgentRole(m.profession);
        if (arch === 'other') continue;
        if (!seenRoles.has(arch)) {
          seenRoles.add(arch);
          presentAgentRoles.push(arch);
        }
      }
    }
    const colors = readMapColors(this, this._data?.theme_hints);

    return html`
      <footer class="world-map__footer">
        <div class="world-map__legend" aria-label=${msg('Map legend')}>
          ${presentCategories.map(
            (cat) => html`
              <span class="world-map__legend-item">
                <span
                  class="world-map__legend-swatch world-map__legend-swatch--zone"
                  style="background:${zoneCategoryColor(cat, colors)}; border-color:${zoneCategoryColor(cat, colors)};"
                ></span>
                ${this._localizeCategory(cat)}
              </span>
            `,
          )}
          <span class="world-map__legend-item">
            <span class="world-map__legend-swatch world-map__legend-swatch--street"></span>
            ${msg('Street')}
          </span>
          <span class="world-map__legend-item">
            <span class="world-map__legend-swatch world-map__legend-swatch--building"></span>
            ${msg('Building')}
          </span>
          <span class="world-map__legend-item">
            <span class="world-map__legend-swatch world-map__legend-swatch--agent"></span>
            ${msg('Agent home')}
          </span>
          ${presentAgentRoles.map(
            (arch) => html`
              <span class="world-map__legend-item">
                <span
                  class="world-map__legend-swatch world-map__legend-swatch--agent-role"
                  style="background:${agentRoleColorVar(arch)}; border-color:${agentRoleColorVar(arch)};"
                ></span>
                ${this._localizeAgentRole(arch)}
              </span>
            `,
          )}
        </div>
        <span class="world-map__attribution">
          ${msg('Synthetic geometry – Bureau Cartographic Section')}
        </span>
      </footer>
    `;
  }

  private _localizeAgentRole(arch: AgentRoleArchetype): string {
    switch (arch) {
      case 'civic':
        return msg('Civic');
      case 'craft':
        return msg('Craft');
      case 'lore':
        return msg('Lore');
      case 'trade':
        return msg('Trade');
      case 'other':
        return msg('Other');
    }
  }

  private _localizeCategory(cat: ZoneCategory): string {
    switch (cat) {
      case 'authority':
        return msg('Authority');
      case 'sacred':
        return msg('Sacred');
      case 'industrial':
        return msg('Industrial');
      case 'commercial':
        return msg('Commercial');
      case 'residential':
        return msg('Residential');
      case 'marginal':
        return msg('Marginal');
      case 'liminal':
        return msg('Liminal');
      case 'other':
        return msg('Other');
    }
  }

  /**
   * Build the per-kind sidebar data — exhaustive switch over SelectedEntity
   * union. Pure: returns label/name/rows; the render template below stays
   * structural-only.
   */
  private _sidebarFields(
    sel: SelectedEntity,
  ): { kindLabel: string; name: string; rows: TemplateResult[] } {
    switch (sel.kind) {
      case 'zone': {
        const z = sel.zone;
        return {
          kindLabel: msg('Zone'),
          name: z.name,
          rows: [
            this._renderRow(msg('Zone type'), z.zone_type ?? msg('Unspecified')),
            z.stability != null || z.stability_label != null
              ? this._renderStabilityGauge(z)
              : html``,
          ],
        };
      }
      case 'building': {
        const b = sel.building;
        return {
          kindLabel: msg('Building'),
          name: b.name,
          rows: [
            this._renderRow(msg('Building type'), b.building_type ?? msg('Unspecified')),
            b.zone_id
              ? this._renderRow(msg('Zone'), this._zonesById.get(b.zone_id)?.name ?? '–')
              : html``,
          ],
        };
      }
      case 'agent': {
        const profession = t(sel.agent, 'profession');
        return {
          kindLabel: msg('Agent'),
          name: sel.agent.name,
          rows: [
            profession ? this._renderRow(msg('Profession'), profession) : html``,
            sel.building
              ? this._renderRow(msg('Lives at'), sel.building.name)
              : this._renderRow(msg('Home'), msg('Unassigned')),
          ],
        };
      }
      case 'event': {
        const ev = sel.event;
        const occurredDate = ev.occurred_at ? new Date(ev.occurred_at) : null;
        const occurredText =
          occurredDate && !Number.isNaN(occurredDate.getTime())
            ? occurredDate.toLocaleString()
            : msg('Unknown');
        return {
          kindLabel: msg('Event'),
          name: ev.title || msg('Event'),
          rows: [
            ev.event_type ? this._renderRow(msg('Event type'), ev.event_type) : html``,
            this._renderRow(msg('Impact'), String(ev.impact_level)),
            this._renderRow(msg('Location'), sel.zone?.name ?? ev.location),
            this._renderRow(msg('Occurred at'), occurredText),
          ],
        };
      }
    }
  }

  private _renderSidebar(): TemplateResult | typeof nothing {
    if (!this._selected) return nothing;
    const { kindLabel, name, rows } = this._sidebarFields(this._selected);
    const headingId = 'velg-world-map-detail-name';
    return html`
      <aside class="world-map__sidebar" role="region" aria-labelledby=${headingId}>
        <div class="world-map__sidebar-head">
          <div>
            <div class="world-map__sidebar-kind">${kindLabel}</div>
            <h3 id=${headingId} class="world-map__sidebar-name">${name}</h3>
          </div>
          <button
            class="world-map__sidebar-close"
            type="button"
            aria-label=${msg('Close detail panel')}
            @click=${this._closeSidebar}
          >
            ${icons.close(14)}
          </button>
        </div>
        ${rows}
      </aside>
    `;
  }

  private _renderRow(label: string, value: string): TemplateResult {
    return html`
      <div class="world-map__sidebar-row">
        <span class="world-map__sidebar-label">${label}</span>
        <span class="world-map__sidebar-value">${value}</span>
      </div>
    `;
  }

  /**
   * Render a horizontal gauge bar for zone stability. The bar width tracks
   * the 0..1 stability number; the color tier comes from the discrete
   * stability_label (critical / unstable / functional / stable / exemplary)
   * so the bar maps 1:1 to the categorical state shown in the label below.
   */
  private _renderStabilityGauge(zone: WorldMapZone): TemplateResult {
    const pct = typeof zone.stability === 'number' ? Math.max(0, Math.min(1, zone.stability)) * 100 : null;
    const tier = zone.stability_label ?? 'unknown';
    const localized = this._localizeStabilityTier(tier);
    const value = pct !== null ? `${Math.round(pct)}%` : '–';
    return html`
      <div class="world-map__sidebar-row">
        <span class="world-map__sidebar-label">${msg('Stability')}</span>
        <div class="world-map__sidebar-gauge" data-tier=${tier}>
          <div class="world-map__sidebar-gauge-track">
            <div
              class="world-map__sidebar-gauge-fill"
              style=${pct !== null ? `width:${pct}%` : 'width:0'}
            ></div>
          </div>
          <div class="world-map__sidebar-gauge-row">
            <span class="world-map__sidebar-gauge-tier">${localized}</span>
            <span class="world-map__sidebar-gauge-value">${value}</span>
          </div>
        </div>
      </div>
    `;
  }

  private _localizeStabilityTier(tier: string): string {
    switch (tier) {
      case 'critical':
        return msg('Critical');
      case 'unstable':
        return msg('Unstable');
      case 'functional':
        return msg('Functional');
      case 'stable':
        return msg('Stable');
      case 'exemplary':
        return msg('Exemplary');
      default:
        return msg('Unknown');
    }
  }

  /**
   * Trigger map regeneration. Reachable only when the empty-state CTA is
   * shown to a platform admin or owner; the backend enforces the same
   * permission check, so this is a UX accelerator, not a security gate.
   */
  private async _handleRegenerate(): Promise<void> {
    if (!this.simulationId) return;
    const generation = this._loadGeneration;
    // Switch to loading state immediately so the empty-state CTA disappears
    // and the user sees feedback. Regenerate can take several seconds — a
    // silent click would feel broken.
    this._loading = true;
    this._error = null;
    try {
      const result = await worldMapApi.regenerate(this.simulationId);
      // A sim-switch during the (multi-second) regenerate kicks off a fresh
      // _loadData with a new generation — don't stomp its state with this
      // now-stale result.
      if (generation !== this._loadGeneration) return;
      if (result.success) {
        await this._loadData();
      } else {
        this._error = result.error?.message ?? msg('Could not regenerate map geometry.');
        this._loading = false;
      }
    } catch (err) {
      captureError(err, {
        source: 'SimulationWorldMap._handleRegenerate',
        simulationId: this.simulationId,
      });
      if (generation === this._loadGeneration) {
        this._error = msg('Could not regenerate map geometry.');
        this._loading = false;
      }
    }
  }

  /**
   * Render-state predicate. Content is shown only when a load has completed
   * (`_data` populated) AND the geometry has at least one ingestable point
   * (`computeBounds` returns non-null). Loading/error/empty states all share
   * the same outer `<section>` shell so Lit reuses the DOM across transitions
   * — only the inner content and aria attributes swap.
   */
  private _isContentReady(): boolean {
    return (
      !this._loading &&
      !this._error &&
      this._data !== null &&
      computeBounds(this._data) !== null
    );
  }

  private _renderStateWrap(): TemplateResult {
    return html`<div class="world-map__state-wrap">${this._renderStateContent()}</div>`;
  }

  /**
   * Bespoke loading panel for the atlas — a brutalist "decoding terminal"
   * with a CSS typewriter that's i18n-robust: the `--_chars` custom property
   * is the rendered string's code-unit count, so the `steps()` / `ch`-width
   * animation lands on whole characters regardless of the translation's
   * length (monospace `--font-brutalist` makes 1 code unit ≈ 1 cell). The
   * indeterminate scan bar signals "still working" once the prompt finishes
   * typing. `role="status"` + `aria-live="polite"` announces it to AT; the
   * caret and bar are `aria-hidden` decoration.
   */
  private _renderDecodingState(): TemplateResult {
    const decodeMsg = msg('Decoding cartographic archive');
    // No wrapper div — the parent `.world-map__state-wrap` already centers its
    // single child, so the frame is the status region directly.
    return html`
      <div class="world-map__decoding-frame" role="status" aria-live="polite">
        <div class="world-map__decoding-head">
          <span class="world-map__decoding-prompt" aria-hidden="true">&gt;</span>
          <span class="world-map__decoding-msg" style="--_chars:${decodeMsg.length}">${decodeMsg}</span>
          <span class="world-map__decoding-caret" aria-hidden="true"></span>
        </div>
        <div class="world-map__decoding-bar" aria-hidden="true">
          <span class="world-map__decoding-bar-fill"></span>
        </div>
        <span class="world-map__decoding-sub">${msg('Bureau Cartographic Section · stand by')}</span>
      </div>
    `;
  }

  private _renderStateContent(): TemplateResult {
    if (this._loading) {
      return this._renderDecodingState();
    }
    if (this._error) {
      return html`
        <velg-error-state
          message=${this._error}
          show-retry
          @retry=${() => this._loadData()}
        ></velg-error-state>
      `;
    }
    // Owners and platform admins can trigger a regenerate from the empty
    // state — backend enforces the same role check via require_owner_or_platform_admin.
    const canRegenerate = appState.isOwner.value || appState.isPlatformAdmin.value;
    return html`
      <velg-empty-state
        message=${msg('No cartographic data has been generated for this simulation yet.')}
        cta-label=${canRegenerate ? msg('Generate cartographic data') : ''}
        @cta-click=${() => this._handleRegenerate()}
      ></velg-empty-state>
    `;
  }

  private _renderContent(): TemplateResult {
    const slug = this._data?.simulation_slug ?? appState.currentSimulation.value?.slug ?? '';
    return html`
      <div class="world-map__body">
        <div class="world-map__canvas-wrap">
          <div
            class="world-map__canvas"
            role="application"
            aria-label=${msg('Cartographic canvas – pan and zoom enabled')}
          ></div>
          <span class="world-map__corner world-map__corner--tl" aria-hidden="true"></span>
          <span class="world-map__corner world-map__corner--tr" aria-hidden="true"></span>
          <span class="world-map__corner world-map__corner--bl" aria-hidden="true"></span>
          <span class="world-map__corner world-map__corner--br" aria-hidden="true"></span>
          <div class="world-map__scanlines" aria-hidden="true"></div>
          <div class="world-map__watermark" aria-hidden="true">
            <span class="world-map__watermark-text">
              ${msg('Classified')} <span class="world-map__watermark-sep">//</span>
              <span class="world-map__watermark-slug">${slug || msg('Bureau')}</span>
            </span>
          </div>
        </div>
        ${this._renderSidebar()}
      </div>
      ${this._renderFooter()}
    `;
  }

  protected render(): TemplateResult {
    const contentReady = this._isContentReady();
    return html`
      <section
        class="world-map"
        aria-busy=${this._loading ? 'true' : nothing}
        aria-label=${contentReady ? msg('Simulation world map') : nothing}
      >
        ${this._renderHeader()}
        ${contentReady ? this._renderContent() : this._renderStateWrap()}
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-simulation-world-map': VelgSimulationWorldMap;
  }
}
