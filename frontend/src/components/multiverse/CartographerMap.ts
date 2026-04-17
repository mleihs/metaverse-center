import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { analyticsService } from '../../services/AnalyticsService.js';
import { connectionsApi } from '../../services/api/index.js';
import { seoService } from '../../services/SeoService.js';
import type { MapData, Simulation } from '../../types/index.js';
import { t } from '../../utils/locale-fields.js';
import { navigate } from '../../utils/navigation.js';
import { getThemeColor } from './map-data.js';
import type { MapEdgeData, MapEmbassyEdge, MapNodeData } from './map-types.js';

import './MapGraph.js';
// MapGraph3D is lazy-loaded via dynamic import when '3d' view is selected
import './MapConnectionPanel.js';
import './MapBattleFeed.js';
import './BleedGazetteSidebar.js';
import './MapLeaderboardPanel.js';
import type { VelgMapMinimap } from './MapMinimap.js';
import './MapMinimap.js';
import '../shared/LoadingState.js';
import '../shared/ErrorState.js';

type MapView = 'svg' | '3d';

@localized()
@customElement('velg-cartographer-map')
export class VelgCartographerMap extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 100%;
      min-height: 100vh;

      /* Dark theme overrides — map is always dark regardless of platform theme */ // lint-color-ok
      --color-surface: #0a0a0a;
      --color-surface-raised: #161616;
      --color-surface-header: #0d0d0d;
      --color-surface-sunken: #050505;
      --color-surface-hover: #1f1f1f;
      --color-text-primary: #f0f0f0;
      --color-text-secondary: #aaaaaa;
      --color-text-muted: #777777;
      --color-text-inverse: #000000;
      --color-border: #2a2a2a;
      --color-border-light: #333333;

      background: var(--color-surface);
      color: var(--color-text-primary);
    }

    .map-with-gazette {
      display: flex;
      height: calc(100vh - var(--header-height, 56px));
    }

    .map {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
      height: 100%;
    }

    .gazette-sidebar {
      flex-shrink: 0;
      height: 100%;
    }

    .map__header {
      padding: var(--space-4, 16px) var(--space-6, 24px);
      border-bottom: 1px solid var(--color-border);
      background: var(--color-surface-raised);
      flex-shrink: 0;
    }

    .map__title {
      font-family: var(--font-brutalist, monospace);
      font-weight: var(--font-black, 900);
      font-size: var(--text-xl, 20px);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist, 0.08em);
      margin: 0;
      color: var(--color-text-primary);
    }

    .map__subtitle {
      font-size: var(--text-sm, 14px);
      color: var(--color-text-muted);
      margin: var(--space-1, 4px) 0 0;
    }

    .map__header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4, 16px);
    }

    .map__search {
      background: var(--color-surface-sunken);
      border: 1px solid var(--color-border);
      color: var(--color-text-primary);
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm, 14px);
      padding: var(--space-2, 8px) var(--space-3, 12px);
      width: 220px;
      outline: none;
    }

    .map__search::placeholder {
      color: var(--color-text-muted);
    }

    .map__search:focus {
      border-color: var(--color-text-secondary);
    }

    .map__graph {
      flex: 1;
      position: relative;
      min-height: 0;
    }

    /* Mobile fallback: vertical card list */
    .map__mobile-list {
      display: none;
      padding: var(--space-4, 16px);
      gap: var(--space-4, 16px);
      flex-direction: column;
    }

    .mobile-card {
      display: flex;
      align-items: center;
      gap: var(--space-4, 16px);
      padding: var(--space-4, 16px);
      border: 1px solid var(--color-border);
      background: var(--color-surface-raised);
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }

    .mobile-card:hover {
      transform: translate(-2px, -2px);
      box-shadow: var(--shadow-lg, 0 4px 12px rgba(0, 0, 0, 0.4));
    }

    .mobile-card__color {
      width: 8px;
      height: 48px;
      flex-shrink: 0;
    }

    .mobile-card__info {
      flex: 1;
    }

    .mobile-card__name {
      font-family: var(--font-brutalist, monospace);
      font-weight: var(--font-bold, 700);
      font-size: var(--text-sm, 14px);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .mobile-card__stats {
      font-size: var(--text-xs, 12px);
      color: var(--color-text-muted);
      margin-top: var(--space-1, 4px);
    }

    .mobile-connector {
      display: flex;
      justify-content: center;
      padding: var(--space-1, 4px) 0;
      color: var(--color-text-muted);
      font-size: var(--text-xs, 12px);
    }

    /* ── View Toggle ── */
    .map__controls {
      display: flex;
      align-items: center;
      gap: var(--space-3, 12px);
    }

    .view-toggle {
      display: flex;
      border: 1px solid var(--color-border);
      background: var(--color-surface-sunken);
      overflow: hidden;
    }

    .view-toggle__btn {
      background: none;
      border: none;
      color: var(--color-text-muted);
      font-family: var(--font-brutalist, monospace);
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding: 6px 12px;
      cursor: pointer;
      transition: background 0.15s ease, color 0.15s ease;
      border-right: 1px solid var(--color-border);
    }

    .view-toggle__btn:last-child {
      border-right: none;
    }

    .view-toggle__btn:hover {
      color: var(--color-text-secondary);
      background: var(--color-surface-hover);
    }

    .view-toggle__btn--active {
      color: var(--color-text-primary);
      background: var(--color-surface-raised);
    }

    @media (max-width: 768px) {
      .map-with-gazette {
        flex-direction: column;
        height: auto;
      }

      .gazette-sidebar {
        display: none;
      }

      .map__graph {
        display: none;
      }

      .map__mobile-list {
        display: flex;
      }

      .map {
        height: auto;
        min-height: 100vh;
      }

      .view-toggle {
        display: none;
      }
    }
  `;

  @state() private _loading = true;
  @state() private _error: string | null = null;
  @state() private _nodes: MapNodeData[] = [];
  @state() private _edges: MapEdgeData[] = [];
  @state() private _embassyEdges: MapEmbassyEdge[] = [];
  @state() private _selectedEdge: MapEdgeData | null = null;
  @state() private _panelOpen = false;
  @state() private _leaderboardEpochId: string | null = null;
  @state() private _leaderboardOpen = false;
  @state() private _searchQuery = '';
  @state() private _mapView: MapView = 'svg';
  private _3dLoaded = false;
  // Plain fields — NOT @state() to avoid Lit re-render on every pan/zoom.
  // Updated directly on the minimap DOM element instead.
  private _miniVbx = 0;
  private _miniVby = 0;
  private _miniVbw = 800;
  private _miniVbh = 600;
  private _pollTimer: ReturnType<typeof setInterval> | null = null;
  private _searchDebounce: ReturnType<typeof setTimeout> | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    seoService.setTitle([msg('Multiverse Map')]);
    analyticsService.trackPageView('/multiverse', 'Multiverse Map');
    this._loadData();
    // Auto-refresh every 30s to show live game instance changes
    this._pollTimer = setInterval(() => this._refreshData(), 30000);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
    if (this._searchDebounce) {
      clearTimeout(this._searchDebounce);
      this._searchDebounce = null;
    }
  }

  private async _loadData(): Promise<void> {
    this._loading = true;
    this._error = null;

    const resp = await connectionsApi.getMapData();
    if (!resp.success || !resp.data) {
      this._error = resp.error?.message ?? 'Failed to load map data.';
      this._loading = false;
      return;
    }

    const mapData = resp.data as MapData;
    this._transformMapData(mapData);
    this._loading = false;
  }

  /** Refresh data without showing loading state (preserves node positions).
   *  If the node set hasn't structurally changed (same IDs), update data in-place
   *  on existing node objects to avoid triggering a Lit re-render entirely. */
  private async _refreshData(): Promise<void> {
    const resp = await connectionsApi.getMapData();
    if (!resp.success || !resp.data) return;
    const mapData = resp.data as MapData;
    const sims = mapData.simulations.filter((s) => s.simulation_type !== 'archived');

    // Check if the node set has structurally changed (different IDs)
    const oldIds = new Set(this._nodes.map((n) => n.id));
    const newIds = new Set(sims.map((s) => s.id));
    const structuralChange =
      oldIds.size !== newIds.size || [...newIds].some((id) => !oldIds.has(id));

    if (!structuralChange) {
      // Same node set — update data properties in-place without replacing arrays.
      // This avoids triggering Lit reactivity entirely, so no re-render/flicker.
      const nodeMap = new Map(this._nodes.map((n) => [n.id, n]));
      for (const sim of sims) {
        const node = nodeMap.get(sim.id);
        if (node) {
          node.agentCount = sim.agent_count ?? 0;
          node.buildingCount = sim.building_count ?? 0;
          node.eventCount = sim.event_count ?? 0;
          node.echoCount = mapData.echo_counts[sim.id] ?? 0;
          node.activeInstanceCount = mapData.active_instance_counts?.[sim.id] ?? 0;
          node.scoreDimensions = mapData.score_dimensions?.[sim.id];
          node.sparklineScores = mapData.sparklines?.[sim.id];
          node.epochStatus = (sim as Simulation & { epoch_status?: string }).epoch_status;
        }
      }
      return;
    }

    // Structural change — preserve positions, build new arrays, assign in one shot
    const posMap = new Map<string, { x: number; y: number; vx: number; vy: number }>();
    for (const node of this._nodes) {
      posMap.set(node.id, { x: node.x, y: node.y, vx: node.vx, vy: node.vy });
    }

    this._transformMapData(mapData);

    // Restore positions BEFORE Lit processes the reactive update
    for (const node of this._nodes) {
      const pos = posMap.get(node.id);
      if (pos) {
        node.x = pos.x;
        node.y = pos.y;
        node.vx = pos.vx;
        node.vy = pos.vy;
      }
    }
  }

  private _transformMapData(mapData: MapData): void {
    // Transform to graph nodes — filter out archived instances
    const sims = mapData.simulations.filter((s) => s.simulation_type !== 'archived');

    this._nodes = sims.map((sim) => ({
      id: sim.id,
      name: t(sim, 'name'),
      slug: sim.slug,
      theme: sim.theme,
      description: t(sim, 'description'),
      bannerUrl: sim.banner_url,
      agentCount: sim.agent_count ?? 0,
      buildingCount: sim.building_count ?? 0,
      eventCount: sim.event_count ?? 0,
      echoCount: mapData.echo_counts[sim.id] ?? 0,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      color: getThemeColor(sim.theme),
      simulationType: sim.simulation_type,
      epochId: sim.epoch_id,
      sourceTemplateId: sim.source_template_id,
      // epoch_status is enriched by the map-data endpoint (not on Simulation type)
      epochStatus: (sim as Simulation & { epoch_status?: string }).epoch_status,
      activeInstanceCount: mapData.active_instance_counts?.[sim.id] ?? 0,
      scoreDimensions: mapData.score_dimensions?.[sim.id],
      sparklineScores: mapData.sparklines?.[sim.id],
    }));

    // Transform to graph edges, enriching with operative flow data
    const opFlow = mapData.operative_flow ?? {};
    this._edges = mapData.connections.map((conn) => {
      const keyAB = `${conn.simulation_a_id}|${conn.simulation_b_id}`;
      const keyBA = `${conn.simulation_b_id}|${conn.simulation_a_id}`;
      const flowAB = opFlow[keyAB];
      const flowBA = opFlow[keyBA];
      const heat = (flowAB?.count ?? 0) + (flowBA?.count ?? 0);
      const types = [...(flowAB?.types ?? []), ...(flowBA?.types ?? [])].filter(
        (t, i, a) => a.indexOf(t) === i,
      ); // deduplicate

      return {
        id: conn.id,
        sourceId: conn.simulation_a_id,
        targetId: conn.simulation_b_id,
        connectionType: conn.connection_type,
        bleedVectors: conn.bleed_vectors,
        strength: conn.strength,
        description: conn.description,
        operativeHeat: heat > 0 ? heat : undefined,
        operativeTypes: types.length > 0 ? types : undefined,
      };
    });

    // Add synthetic template-link edges for game instances
    const nodeIds = new Set(this._nodes.map((n) => n.id));
    for (const node of this._nodes) {
      if (
        node.simulationType === 'game_instance' &&
        node.sourceTemplateId &&
        nodeIds.has(node.sourceTemplateId)
      ) {
        this._edges.push({
          id: `tmpl-link-${node.id}`,
          sourceId: node.sourceTemplateId,
          targetId: node.id,
          connectionType: 'template_link',
          bleedVectors: [],
          strength: 0.3,
          description: 'Template instance link',
        });
      }
    }

    // Transform embassy data to embassy edges
    this._embassyEdges = (mapData.embassies ?? []).map((emb) => ({
      id: emb.id,
      sourceSimId: emb.simulation_a_id,
      targetSimId: emb.simulation_b_id,
      buildingAName: emb.building_a?.name ?? '???',
      buildingBName: emb.building_b?.name ?? '???',
    }));
  }

  private _handleNodeClick(e: CustomEvent<MapNodeData>): void {
    const node = e.detail;
    // Game instances open leaderboard panel; templates navigate to lore
    if (node.simulationType === 'game_instance' && node.epochId) {
      this._leaderboardEpochId = node.epochId;
      this._leaderboardOpen = true;
      return;
    }
    navigate(`/simulations/${node.slug}/lore`);
  }

  private _handleEdgeClick(e: CustomEvent<MapEdgeData>): void {
    this._selectedEdge = e.detail;
    this._panelOpen = true;
  }

  private _handlePanelClose(): void {
    this._panelOpen = false;
    this._selectedEdge = null;
  }

  private _handleLeaderboardClose(): void {
    this._leaderboardOpen = false;
    this._leaderboardEpochId = null;
  }

  private _handleViewboxChange(
    e: CustomEvent<{ vbx: number; vby: number; vbw: number; vbh: number }>,
  ): void {
    this._miniVbx = e.detail.vbx;
    this._miniVby = e.detail.vby;
    this._miniVbw = e.detail.vbw;
    this._miniVbh = e.detail.vbh;
    // Directly update minimap DOM properties — avoids triggering Lit re-render
    // of CartographerMap which would cascade into MapGraph and restart animations
    const minimap = this.renderRoot.querySelector<VelgMapMinimap>('velg-map-minimap');
    if (minimap) {
      minimap.vbx = this._miniVbx;
      minimap.vby = this._miniVby;
      minimap.vbw = this._miniVbw;
      minimap.vbh = this._miniVbh;
    }
  }

  private async _switchView(view: MapView): Promise<void> {
    if (view === this._mapView) return;
    // Lazy-load 3D component on first use
    if (view === '3d' && !this._3dLoaded) {
      await import('./MapGraph3D.js');
      this._3dLoaded = true;
    }
    this._mapView = view;
  }

  private _handleSearchInput(e: InputEvent): void {
    const value = (e.target as HTMLInputElement).value.trim().toLowerCase();
    if (this._searchDebounce) clearTimeout(this._searchDebounce);
    this._searchDebounce = setTimeout(() => {
      this._searchQuery = value;
    }, 150);
  }

  private _handleMobileCardClick(node: MapNodeData): void {
    navigate(`/simulations/${node.slug}/lore`);
  }

  private _renderGraphView() {
    switch (this._mapView) {
      case 'svg':
        return html`
          <velg-map-graph
            .nodes=${this._nodes}
            .edges=${this._edges}
            .embassyEdges=${this._embassyEdges}
            .searchQuery=${this._searchQuery}
            @node-click=${this._handleNodeClick}
            @edge-click=${this._handleEdgeClick}
            @viewbox-change=${this._handleViewboxChange}
          ></velg-map-graph>
        `;
      case '3d':
        return html`
          <velg-map-graph-3d
            .nodes=${this._nodes}
            .edges=${this._edges}
            .embassyEdges=${this._embassyEdges}
            .searchQuery=${this._searchQuery}
            @node-click=${this._handleNodeClick}
            @edge-click=${this._handleEdgeClick}
          ></velg-map-graph-3d>
        `;
    }
  }

  private _renderMobileList() {
    return html`
      <div class="map__mobile-list">
        ${this._nodes.map(
          (node, i) => html`
            <div
              class="mobile-card"
              @click=${() => this._handleMobileCardClick(node)}
            >
              <div
                class="mobile-card__color"
                style="background: ${node.color}"
              ></div>
              <div class="mobile-card__info">
                <div class="mobile-card__name">${node.name}</div>
                <div class="mobile-card__stats">
                  ${node.agentCount} ${msg('Agents')} /
                  ${node.buildingCount} ${msg('Buildings')} /
                  ${node.eventCount} ${msg('Events')}
                </div>
              </div>
            </div>
            ${
              i < this._nodes.length - 1
                ? html`<div class="mobile-connector">\u2502</div>`
                : nothing
            }
          `,
        )}
      </div>
    `;
  }

  protected render() {
    if (this._loading) {
      return html`<velg-loading-state .message=${msg('Loading multiverse...')}></velg-loading-state>`;
    }

    if (this._error) {
      return html`<velg-error-state .message=${this._error} @retry=${this._loadData}></velg-error-state>`;
    }

    return html`
      <div class="map-with-gazette">
      <div class="map">
        <div class="map__header">
          <div class="map__header-row">
            <div>
              <h1 class="map__title">${msg("The Cartographer's Map")}</h1>
              <p class="map__subtitle">${msg('A living diagram of the multiverse and its connections')}</p>
            </div>
            <div class="map__controls">
              <div class="view-toggle" role="group" aria-label="${msg('Map view mode')}">
                <button
                  class="view-toggle__btn ${this._mapView === 'svg' ? 'view-toggle__btn--active' : ''}"
                  @click=${() => this._switchView('svg')}
                  aria-pressed=${this._mapView === 'svg' ? 'true' : 'false'}
                >SVG</button>
                <button
                  class="view-toggle__btn ${this._mapView === '3d' ? 'view-toggle__btn--active' : ''}"
                  @click=${() => this._switchView('3d')}
                  aria-pressed=${this._mapView === '3d' ? 'true' : 'false'}
                >3D</button>
              </div>
              <input
                class="map__search"
                type="text"
                placeholder="${msg('Search simulations...')}"
                @input=${this._handleSearchInput}
              />
            </div>
          </div>
        </div>

        <div class="map__graph">
          ${this._renderGraphView()}
          ${
            this._mapView !== '3d'
              ? html`
            <velg-map-minimap
              .nodes=${this._nodes}
              .vbx=${this._miniVbx}
              .vby=${this._miniVby}
              .vbw=${this._miniVbw}
              .vbh=${this._miniVbh}
            ></velg-map-minimap>
          `
              : nothing
          }
          <velg-map-battle-feed></velg-map-battle-feed>
        </div>

        ${this._renderMobileList()}
      </div>
      <velg-bleed-gazette-sidebar class="gazette-sidebar"></velg-bleed-gazette-sidebar>
      </div>

      <velg-map-connection-panel
        .edge=${this._selectedEdge}
        .nodes=${this._nodes}
        .open=${this._panelOpen}
        @panel-close=${this._handlePanelClose}
      ></velg-map-connection-panel>

      <velg-map-leaderboard-panel
        .epochId=${this._leaderboardEpochId}
        .open=${this._leaderboardOpen}
        @panel-close=${this._handleLeaderboardClose}
      ></velg-map-leaderboard-panel>
    `;
  }
}
