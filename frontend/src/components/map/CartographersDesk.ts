import { localized, msg } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { healthApi } from '../../services/api/HealthApiService.js';
import type { ZoneStability } from '../../types/index.js';
import { icons } from '../../utils/icons.js';
import type { ZoneTopology } from './CartographicMap.js';
import type { MapLayer } from './MapLayerToggle.js';

import './CartographicMap.js';
import './MapAnnotationTool.js';
import './MapLayerToggle.js';

/**
 * Intelligence Operations Light Table — Bureau of Impossible Geography.
 *
 * Atmospheric container for the cartographic map. Backlit drafting table
 * aesthetic with edge glow, tactical toolbar, status indicators,
 * classification markings, and compass rose.
 */
@localized()
@customElement('velg-cartographers-desk')
export class CartographersDesk extends SignalWatcher(LitElement) {
  static styles = css`
    :host {
      display: block;
      position: relative;
      width: 100%;
      min-height: 500px;
      color: var(--color-text-primary);
    }

    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    /* ── Desk container ──────────────────────── */

    .desk {
      display: flex;
      flex-direction: column;
      height: calc(100vh - var(--header-height, 56px) - 140px);
      min-height: 500px;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      overflow: hidden;
    }

    /* Light table edge glow */
    .desk::before {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 2;
      --_glow-subtle: color-mix(in srgb, var(--color-primary) 1.5%, transparent);
      --_glow-edge: color-mix(in srgb, var(--color-primary) 8%, transparent);
      box-shadow:
        inset 0 0 60px var(--_glow-subtle),
        inset 0 1px 0 var(--_glow-edge);
    }

    /* ── Toolbar ─────────────────────────────── */

    .desk__toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-2, 8px) var(--space-4, 16px);
      background: var(--color-surface-raised);
      border-bottom: 1px solid var(--color-border);
      z-index: 3;
    }

    .desk__title-group {
      display: flex;
      align-items: center;
      gap: var(--space-3, 12px);
    }

    .desk__title {
      font-family: var(--font-brutalist, monospace);
      font-weight: 900;
      font-size: var(--text-sm, 14px);
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    .desk__classification {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      font-weight: 700;
      color: var(--color-stamp-red);
      letter-spacing: 0.12em;
      text-transform: uppercase;
      border: 1px solid color-mix(in srgb, var(--color-stamp-red) 36%, transparent);
      padding: 1px 6px;
    }

    .desk__tools {
      display: flex;
      align-items: center;
      gap: var(--space-2, 8px);
    }

    .desk__tool-btn {
      display: flex;
      align-items: center;
      gap: var(--space-1, 4px);
      padding: var(--space-1, 4px) var(--space-2, 8px);
      background: none;
      border: 1px solid var(--color-border);
      color: var(--color-text-muted);
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      cursor: pointer;
      transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
    }

    .desk__tool-btn:hover {
      color: var(--color-text-primary);
      border-color: var(--color-text-muted);
      background: rgba(255, 255, 255, 0.03);
    }

    .desk__tool-btn--active {
      color: var(--color-primary);
      border-color: var(--color-primary);
      background: color-mix(in srgb, var(--color-primary) 6%, transparent);
    }

    .desk__zoom-group {
      display: flex;
      align-items: center;
      gap: 2px;
    }

    .desk__zoom-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      background: none;
      border: 1px solid var(--color-border);
      color: var(--color-text-muted);
      font-family: var(--font-mono, monospace);
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: color 0.15s ease, border-color 0.15s ease;
    }

    .desk__zoom-btn:hover {
      color: var(--color-text-primary);
      border-color: var(--color-text-muted);
    }

    .desk__zoom-label {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      color: var(--color-text-muted);
      min-width: 32px;
      text-align: center;
    }

    /* ── Map area ────────────────────────────── */

    .desk__map {
      flex: 1;
      position: relative;
      min-height: 0;
      overflow: hidden;
    }

    /* Subtle inner border for map area */
    .desk__map::after {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.03);
      z-index: 1;
    }

    /* ── Compass rose ────────────────────────── */

    .desk__compass {
      position: absolute;
      bottom: var(--space-4, 16px);
      right: var(--space-4, 16px);
      opacity: 0.08;
      color: var(--color-text-muted);
      pointer-events: none;
      z-index: 1;
      transition: opacity 0.3s ease;
    }

    .desk__map:hover .desk__compass {
      opacity: 0.14;
    }

    /* ── Coordinate readout ──────────────────── */

    .desk__coords {
      position: absolute;
      top: var(--space-2, 8px);
      right: var(--space-3, 12px);
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      color: var(--color-text-muted);
      opacity: 0.5;
      z-index: 1;
      pointer-events: none;
    }

    /* ── Status bar + footer ─────────────────── */

    .desk__footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-1, 4px) var(--space-4, 16px);
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      color: var(--color-text-muted);
      background: var(--color-surface-raised);
      border-top: 1px solid var(--color-border);
      z-index: 3;
    }

    .desk__status {
      display: flex;
      align-items: center;
      gap: var(--space-4, 16px);
    }

    .desk__stat {
      display: flex;
      align-items: center;
      gap: var(--space-1, 4px);
    }

    .desk__stat-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
    }

    .desk__scale-bar {
      display: flex;
      align-items: center;
      gap: var(--space-2, 8px);
    }

    .desk__scale-line {
      width: 50px;
      height: 1px;
      background: var(--color-text-muted);
      position: relative;
    }

    .desk__scale-line::before,
    .desk__scale-line::after {
      content: '';
      position: absolute;
      top: -2px;
      width: 1px;
      height: 5px;
      background: var(--color-text-muted);
    }

    .desk__scale-line::before {
      left: 0;
    }

    .desk__scale-line::after {
      right: 0;
    }

    .desk__signature {
      font-style: italic;
      opacity: 0.6;
    }

    /* ── Loading / Empty states ───────────────── */

    .desk__empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      min-height: 300px;
      gap: var(--space-3, 12px);
      color: var(--color-text-muted);
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm, 14px);
    }

    .desk__empty-icon {
      opacity: 0.2;
    }

    /* ── Responsive ──────────────────────────── */

    @media (max-width: 640px) {
      .desk {
        height: auto;
        min-height: 400px;
      }

      .desk__compass {
        display: none;
      }

      .desk__toolbar {
        flex-wrap: wrap;
        gap: var(--space-2, 8px);
      }

      .desk__classification {
        display: none;
      }

      .desk__status {
        gap: var(--space-2, 8px);
      }

      .desk__signature {
        display: none;
      }
    }
  `;

  @property({ type: String }) simulationId: string | null = null;

  @state() private _activeLayer: MapLayer = 'infrastructure';
  @state() private _zones: ZoneTopology[] = [];
  @state() private _annotating = false;
  @state() private _loading = true;
  @state() private _zoom = 1;
  @state() private _panX = 0;
  @state() private _panY = 0;

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    await this._fetchZoneData();
  }

  protected async willUpdate(changed: Map<PropertyKey, unknown>): Promise<void> {
    if (changed.has('simulationId') && this.simulationId) {
      await this._fetchZoneData();
    }
  }

  private async _fetchZoneData(): Promise<void> {
    const simId = this.simulationId ?? appState.simulationId.value;
    if (!simId) return;

    this._loading = true;
    const result = await healthApi.listZoneStability(
      simId,
      appState.currentSimulationMode.value,
    );
    if (result.success && result.data) {
      this._zones = this._transformZones(result.data);
      this._centerOnZones();
    }
    this._loading = false;
  }

  private _transformZones(zones: ZoneStability[]): ZoneTopology[] {
    const cols = Math.ceil(Math.sqrt(zones.length));
    return zones.map((z, i) => ({
      zone_id: z.zone_id,
      zone_name: z.zone_name ?? `Zone ${i + 1}`,
      zone_type: z.zone_type ?? 'residential',
      stability: z.stability ?? 0.5,
      stability_label: z.stability_label ?? 'functional',
      building_count: z.building_count ?? 0,
      security_level: z.security_level ?? 'medium',
      x: (i % cols) * 150 + 200,
      y: Math.floor(i / cols) * 150 + 200,
    }));
  }

  /** Center the viewport on the zone cluster. */
  private _centerOnZones(): void {
    if (this._zones.length === 0) return;
    const cx = this._zones.reduce((s, z) => s + z.x, 0) / this._zones.length;
    const cy = this._zones.reduce((s, z) => s + z.y, 0) / this._zones.length;
    this._panX = cx;
    this._panY = cy;
  }

  private get _avgStability(): number {
    if (this._zones.length === 0) return 0;
    return this._zones.reduce((sum, z) => sum + z.stability, 0) / this._zones.length;
  }

  private _handleLayerChange(e: CustomEvent<MapLayer>) {
    this._activeLayer = e.detail;
  }

  private _toggleAnnotation() {
    this._annotating = !this._annotating;
  }

  private _zoomIn() {
    this._zoom = Math.min(5, this._zoom * 1.25);
  }

  private _zoomOut() {
    this._zoom = Math.max(0.3, this._zoom * 0.8);
  }

  private _resetView() {
    this._zoom = 1;
    this._panX = 0;
    this._panY = 0;
  }

  private _handleZoneSelect(e: CustomEvent) {
    this.dispatchEvent(
      new CustomEvent('zone-select', { detail: e.detail, bubbles: true, composed: true }),
    );
  }

  protected render() {
    if (this._loading) {
      return html`
        <div class="desk__empty">
          <span class="desk__empty-icon">${icons.compassRose(48)}</span>
          <span>${msg('Surveying zones...')}</span>
        </div>
      `;
    }

    if (this._zones.length === 0) {
      return html`
        <div class="desk__empty">
          <span class="desk__empty-icon">${icons.compassRose(48)}</span>
          <span>${msg('No zones to chart.')}</span>
        </div>
      `;
    }

    const simId = this.simulationId ?? appState.simulationId.value ?? '';
    const avg = Math.round(this._avgStability * 100);
    const stabColor =
      avg < 40 ? 'var(--color-danger)' : avg < 60 ? 'var(--color-warning)' : 'var(--color-success)';

    return html`
      <div class="desk">
        <div class="desk__toolbar">
          <div class="desk__title-group">
            <span class="desk__title">${msg("Cartographer's Desk")}</span>
            <span class="desk__classification">${msg('Bureau Survey')}</span>
          </div>

          <div class="desk__tools">
            <div class="desk__zoom-group">
              <button class="desk__zoom-btn" @click=${this._zoomOut}
                aria-label=${msg('Zoom out')}>−</button>
              <span class="desk__zoom-label">${Math.round(this._zoom * 100)}%</span>
              <button class="desk__zoom-btn" @click=${this._zoomIn}
                aria-label=${msg('Zoom in')}>+</button>
              <button class="desk__zoom-btn" @click=${this._resetView}
                aria-label=${msg('Reset view')}
                style="margin-left: 2px; font-size: 9px;">⌂</button>
            </div>

            <button
              class="desk__tool-btn ${this._annotating ? 'desk__tool-btn--active' : ''}"
              @click=${this._toggleAnnotation}
              aria-pressed=${this._annotating ? 'true' : 'false'}
            >
              ${icons.pencilAnnotate(12)}
              ${msg('Annotate')}
            </button>
          </div>
        </div>

        <div class="desk__map">
          <velg-cartographic-map
            .zones=${this._zones}
            .layer=${this._activeLayer}
            .zoom=${this._zoom}
            .panX=${this._panX}
            .panY=${this._panY}
            @zone-select=${this._handleZoneSelect}
          ></velg-cartographic-map>

          <velg-map-annotation-tool
            .mapId=${simId}
            ?active=${this._annotating}
          ></velg-map-annotation-tool>

          <div class="desk__compass" aria-hidden="true">
            ${icons.compassRose(56)}
          </div>

          <div class="desk__coords" aria-hidden="true">
            ${Math.round(this._panX)}, ${Math.round(this._panY)}
          </div>
        </div>

        <velg-map-layer-toggle
          .activeLayer=${this._activeLayer}
          @layer-change=${this._handleLayerChange}
        ></velg-map-layer-toggle>

        <div class="desk__footer">
          <div class="desk__status">
            <span class="desk__stat">
              <span class="desk__stat-dot" style="background: var(--color-text-muted)"></span>
              ${this._zones.length} ${msg('zones')}
            </span>
            <span class="desk__stat">
              <span class="desk__stat-dot" style="background: ${stabColor}"></span>
              ${msg('avg stability')}: ${avg}%
            </span>
          </div>

          <div class="desk__scale-bar">
            <div class="desk__scale-line"></div>
            <span>~1 km</span>
          </div>

          <span class="desk__signature">${msg('Bureau of Impossible Geography')}</span>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-cartographers-desk': CartographersDesk;
  }
}
