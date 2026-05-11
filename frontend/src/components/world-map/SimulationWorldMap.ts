import { localized, msg } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { html, LitElement, nothing, type TemplateResult } from 'lit';
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
import {
  buildMapStyle,
  buildZonesData,
  categoriseZoneType,
  computeBounds,
  polygonCentroid,
  readMapColors,
  type ZoneCategory,
  zoneCategoryColor,
} from './world-map-styles.js';

import '../shared/EmptyState.js';
import '../shared/ErrorState.js';
import '../shared/LoadingState.js';

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
   * Polling interval for the live stability overlay (Phase 6.1).
   * Matched to the public-map endpoint's `Cache-Control: max-age=60` so the
   * browser HTTP cache absorbs polls that fire within the same cache window
   * (304 + cached body), making refresh effectively free between heartbeats.
   * Phase 6.2 will replace polling with a Supabase Realtime broadcast.
   */
  private static readonly _STABILITY_REFRESH_MS = 60_000;

  connectedCallback(): void {
    super.connectedCallback();
    ensureComponentStyles(this);
    if (this.simulationId) {
      void this._loadData();
    }
  }

  disconnectedCallback(): void {
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
      const animate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      const map = new MapLibreCtor({
        container: containerEl,
        style,
        bounds,
        fitBoundsOptions: { padding: 36, animate, duration: animate ? 600 : 0 },
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

      map.on('load', () => {
        try {
          map.resize();
          this._renderLabels(map, Marker);
          this._startStabilityRefresh();
          this._subscribeToEvents(map, Marker);
        } catch (err) {
          captureError(err, { source: 'SimulationWorldMap._initMap.onLoad' });
        }
      });

      this._wireBuildingPopup(map, Popup);

      map.on('mousemove', 'zones-fill', (e: MapLayerMouseEvent) => this._handleZoneHover(map, e));
      map.on('mouseleave', 'zones-fill', () => this._clearZoneHover(map));
      map.on('click', 'zones-fill', (e: MapLayerMouseEvent) => this._handleZoneClick(e));
      map.on('click', 'buildings', (e: MapLayerMouseEvent) => this._handleBuildingClick(e));
      map.on('click', 'agents', (e: MapLayerMouseEvent) => this._handleAgentClick(e));

      const cursorLayers = ['zones-fill', 'buildings', 'agents'];
      for (const layerId of cursorLayers) {
        map.on('mouseenter', layerId, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', layerId, () => {
          map.getCanvas().style.cursor = '';
        });
      }

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
    for (const { marker, timeout } of this._eventMarkers.values()) {
      clearTimeout(timeout);
      try {
        marker.remove();
      } catch (err) {
        captureError(err, { source: 'SimulationWorldMap._unsubscribeFromEvents.marker' });
      }
    }
    this._eventMarkers.clear();
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
    const existing = this._eventMarkers.get(event.id);
    if (existing) {
      clearTimeout(existing.timeout);
      existing.marker.remove();
    }

    const el = document.createElement('div');
    el.className = 'velg-map-event-marker';
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', event.title || msg('Event'));
    const ripple1 = document.createElement('div');
    ripple1.className = 'velg-map-event-marker__ripple';
    el.appendChild(ripple1);
    const ripple2 = document.createElement('div');
    ripple2.className = 'velg-map-event-marker__ripple velg-map-event-marker__ripple--delayed';
    el.appendChild(ripple2);

    const onActivate = (e: Event): void => {
      e.stopPropagation();
      this._selectEvent(event.id);
    };
    el.addEventListener('click', onActivate);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        // Space normally scrolls the page — kill it so the marker behaves
        // like any other activatable control.
        e.preventDefault();
        onActivate(e);
      }
    });

    const marker = new MarkerCtor({ element: el, anchor: 'center' })
      .setLngLat(centroid)
      .addTo(map);

    const timeout = setTimeout(() => {
      el.classList.add('velg-map-event-marker--fading');
      setTimeout(() => {
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
    }, VelgSimulationWorldMap._EVENT_MARKER_TTL_MS);

    this._eventMarkers.set(event.id, {
      marker,
      timeout,
      event,
      zoneId: matchedZone.id,
    });
  }

  private _selectEvent(id: string): void {
    const entry = this._eventMarkers.get(id);
    if (!entry) return;
    const zone = entry.zoneId !== null ? (this._zonesById.get(entry.zoneId) ?? null) : null;
    this._selected = { kind: 'event', event: entry.event, zone };
  }

  private _wireBuildingPopup(
    map: MapLibreMap,
    PopupCtor: new (opts: {
      closeButton: boolean;
      closeOnClick: boolean;
      offset: number;
      className: string;
    }) => MapLibrePopup,
  ): void {
    const popup = new PopupCtor({
      closeButton: false,
      closeOnClick: false,
      offset: 10,
      className: 'velg-map-popup',
    });
    this._hoverPopup = popup;
    // Track which building the popup is currently showing, so mousemove
    // (which fires every frame inside the hovered feature) only rebuilds
    // the DOM when the user actually crosses to a different building.
    let popupBuildingId: string | null = null;

    const setPopup = (e: MapLayerMouseEvent): void => {
      const feature = e.features?.[0];
      const id = feature?.properties?.id;
      if (typeof id !== 'string') return;
      if (id === popupBuildingId) return;
      const building = this._buildingsById.get(id);
      if (!building || !building.geojson) return;
      popupBuildingId = id;
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
      popup.setLngLat([lng, lat]).setDOMContent(el).addTo(map);
    };

    map.on('mouseenter', 'buildings', setPopup);
    map.on('mousemove', 'buildings', setPopup);
    map.on('mouseleave', 'buildings', () => {
      popupBuildingId = null;
      popup.remove();
    });
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
    if (zone) this._selected = { kind: 'zone', zone };
  }

  private _handleBuildingClick(e: MapLayerMouseEvent): void {
    const feature = e.features?.[0];
    const id = feature?.properties?.id;
    if (typeof id !== 'string') return;
    const building = this._buildingsById.get(id);
    if (building) this._selected = { kind: 'building', building };
  }

  private _handleAgentClick(e: MapLayerMouseEvent): void {
    const feature = e.features?.[0];
    const id = feature?.properties?.id;
    if (typeof id !== 'string') return;
    const agent = this._agentsById.get(id);
    if (!agent) return;
    const building = agent.home_building_id ? (this._buildingsById.get(agent.home_building_id) ?? null) : null;
    this._selected = { kind: 'agent', agent, building };
  }

  private _closeSidebar(): void {
    this._selected = null;
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
    if (this._data) {
      const seen = new Set<ZoneCategory>();
      for (const zone of this._data.zones) {
        const cat = categoriseZoneType(zone.zone_type);
        if (!seen.has(cat)) {
          seen.add(cat);
          presentCategories.push(cat);
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
        </div>
        <span class="world-map__attribution">
          ${msg('Synthetic geometry – Bureau Cartographic Section')}
        </span>
      </footer>
    `;
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
            z.stability_label != null
              ? this._renderRow(msg('Stability'), z.stability_label)
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
        return {
          kindLabel: msg('Agent'),
          name: sel.agent.name,
          rows: [
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

  private _renderStateContent(): TemplateResult {
    if (this._loading) {
      return html`
        <velg-loading-state
          message=${msg('Decoding cartographic archive...')}
        ></velg-loading-state>
      `;
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
    return html`
      <velg-empty-state
        message=${msg('No cartographic data has been generated for this simulation yet.')}
      ></velg-empty-state>
    `;
  }

  private _renderContent(): TemplateResult {
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
