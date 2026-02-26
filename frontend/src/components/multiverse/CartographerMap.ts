import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { analyticsService } from '../../services/AnalyticsService.js';
import { connectionsApi } from '../../services/api/index.js';
import { seoService } from '../../services/SeoService.js';
import type { MapData } from '../../types/index.js';
import { getThemeColor } from './map-data.js';
import type { MapEdgeData, MapNodeData } from './map-types.js';

import './MapGraph.js';
import './MapConnectionPanel.js';
import '../shared/LoadingState.js';
import '../shared/ErrorState.js';

@localized()
@customElement('velg-cartographer-map')
export class VelgCartographerMap extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 100%;
      min-height: 100vh;

      /* Dark theme overrides — map is always dark regardless of platform theme */
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
      --color-text: #f0f0f0;
      --color-background: #0a0a0a;

      background: var(--color-surface);
      color: var(--color-text-primary);
    }

    .map {
      display: flex;
      flex-direction: column;
      height: 100vh;
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
      color: var(--color-text-muted, #888);
      margin-top: var(--space-1, 4px);
    }

    .mobile-connector {
      display: flex;
      justify-content: center;
      padding: var(--space-1, 4px) 0;
      color: var(--color-text-muted, #888);
      font-size: var(--text-xs, 12px);
    }

    @media (max-width: 768px) {
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
    }
  `;

  @state() private _loading = true;
  @state() private _error: string | null = null;
  @state() private _nodes: MapNodeData[] = [];
  @state() private _edges: MapEdgeData[] = [];
  @state() private _selectedEdge: MapEdgeData | null = null;
  @state() private _panelOpen = false;

  connectedCallback(): void {
    super.connectedCallback();
    seoService.setTitle([msg('Multiverse Map')]);
    analyticsService.trackPageView('/multiverse', 'Multiverse Map');
    this._loadData();
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

    // Transform to graph nodes
    this._nodes = mapData.simulations.map((sim) => ({
      id: sim.id,
      name: sim.name,
      slug: sim.slug,
      theme: sim.theme,
      description: sim.description,
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
    }));

    // Transform to graph edges
    this._edges = mapData.connections.map((conn) => ({
      id: conn.id,
      sourceId: conn.simulation_a_id,
      targetId: conn.simulation_b_id,
      connectionType: conn.connection_type,
      bleedVectors: conn.bleed_vectors,
      strength: conn.strength,
      description: conn.description,
    }));

    this._loading = false;
  }

  private _handleNodeClick(e: CustomEvent<MapNodeData>): void {
    const node = e.detail;
    const path = `/simulations/${node.id}/lore`;
    window.history.pushState({}, '', path);
    this.dispatchEvent(
      new CustomEvent('navigate', { detail: path, bubbles: true, composed: true }),
    );
  }

  private _handleEdgeClick(e: CustomEvent<MapEdgeData>): void {
    this._selectedEdge = e.detail;
    this._panelOpen = true;
  }

  private _handlePanelClose(): void {
    this._panelOpen = false;
    this._selectedEdge = null;
  }

  private _handleMobileCardClick(node: MapNodeData): void {
    const path = `/simulations/${node.id}/lore`;
    window.history.pushState({}, '', path);
    this.dispatchEvent(
      new CustomEvent('navigate', { detail: path, bubbles: true, composed: true }),
    );
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
      <div class="map">
        <div class="map__header">
          <h1 class="map__title">${msg("The Cartographer's Map")}</h1>
          <p class="map__subtitle">${msg('A living diagram of the multiverse and its connections')}</p>
        </div>

        <div class="map__graph">
          <velg-map-graph
            .nodes=${this._nodes}
            .edges=${this._edges}
            @node-click=${this._handleNodeClick}
            @edge-click=${this._handleEdgeClick}
          ></velg-map-graph>
        </div>

        ${this._renderMobileList()}
      </div>

      <velg-map-connection-panel
        .edge=${this._selectedEdge}
        .nodes=${this._nodes}
        .open=${this._panelOpen}
        @panel-close=${this._handlePanelClose}
      ></velg-map-connection-panel>
    `;
  }
}
