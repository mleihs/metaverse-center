import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { seoService } from '../../services/SeoService.js';
import { healthApi, heartbeatApi, locationsApi } from '../../services/api/index.js';
import type { City, CityStreet, Zone, ZoneStability } from '../../types/index.js';
import { t } from '../../utils/locale-fields.js';
import { viewHeaderStyles } from '../shared/view-header-styles.js';
import '../shared/VelgHelpTip.js';
import type { ZoneWeather } from './ZoneList.js';
import '../shared/LoadingState.js';
import '../shared/ErrorState.js';
import '../shared/EmptyState.js';
import './CityList.js';
import './ZoneList.js';
import './StreetList.js';
import './LocationEditModal.js';
import '../map/CartographersDesk.js';

type LocationLevel = 'cities' | 'zones' | 'streets';
type ViewMode = 'list' | 'map';

@localized()
@customElement('velg-locations-view')
export class VelgLocationsView extends LitElement {
  static styles = [
    viewHeaderStyles,
    css`
    :host {
      display: block;
    }

    .view__breadcrumb {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
    }

    .view__crumb {
      cursor: pointer;
      color: var(--color-primary);
      transition: color var(--transition-fast);
    }

    .view__crumb:hover {
      text-decoration: underline;
    }

    .view__crumb--current {
      color: var(--color-text-primary);
      cursor: default;
    }

    .view__crumb--current:hover {
      text-decoration: none;
    }

    .view__separator {
      color: var(--color-text-muted);
    }

    /* Crossfade when drilling between city/zone/street levels */
    velg-city-list,
    velg-zone-list,
    velg-street-list,
    velg-cartographers-desk {
      animation: content-fade 250ms var(--ease-out, ease-out) both;
    }

    @keyframes content-fade {
      from { opacity: 0; transform: translateY(4px); }
    }

    /* ── View mode toggle ── */

    .view__mode-toggle {
      display: flex;
      gap: 0;
      border: 1px solid var(--color-border);
    }

    .view__mode-btn {
      padding: var(--space-1, 4px) var(--space-3, 12px);
      background: none;
      border: none;
      color: var(--color-text-muted);
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs, 12px);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      cursor: pointer;
      transition: color 0.15s ease, background 0.15s ease;
    }

    .view__mode-btn:first-child {
      border-right: 1px solid var(--color-border);
    }

    .view__mode-btn:hover {
      color: var(--color-text-primary);
      background: rgba(255, 255, 255, 0.03);
    }

    .view__mode-btn--active {
      color: var(--color-primary);
      background: rgba(245, 158, 11, 0.08);
    }
  `,
  ];

  @property({ type: String }) simulationId = '';

  @state() private _level: LocationLevel = 'cities';
  @state() private _cities: City[] = [];
  @state() private _zones: Zone[] = [];
  @state() private _streets: CityStreet[] = [];
  @state() private _selectedCity: City | null = null;
  @state() private _selectedZone: Zone | null = null;
  @state() private _loading = false;
  @state() private _error: string | null = null;
  @state() private _stabilityMap: Map<string, ZoneStability> = new Map();
  @state() private _weatherMap: Map<string, ZoneWeather> = new Map();
  @state() private _viewMode: ViewMode = 'list';
  @state() private _showEditModal = false;
  @state() private _editType: 'city' | 'zone' | 'street' = 'city';
  @state() private _editItem: City | Zone | CityStreet | null = null;

  private get _canEdit(): boolean {
    return appState.canEdit.value;
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (this.simulationId) {
      this._loadCities();
    }
  }

  disconnectedCallback(): void {
    seoService.removeStructuredData();
    super.disconnectedCallback();
  }

  protected willUpdate(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('simulationId') && this.simulationId) {
      this._level = 'cities';
      this._selectedCity = null;
      this._selectedZone = null;
      this._loadCities();
    }
  }

  private async _loadCities(): Promise<void> {
    this._loading = true;
    this._error = null;

    try {
      const response = await locationsApi.listCities(this.simulationId);

      if (response.success && response.data) {
        this._cities = response.data ?? [];
        const sim = appState.currentSimulation.value;
        if (sim) {
          seoService.setCollectionPage({
            name: `${t(sim, 'name')} \u2013 Locations`,
            description: `Cities, zones, and streets in the ${t(sim, 'name')} simulation.`,
            url: `https://metaverse.center/simulations/${sim.slug}/locations`,
            numberOfItems: this._cities.length,
          });
        }
      } else {
        this._error = response.error?.message ?? msg('Failed to load cities');
      }
    } catch {
      this._error = msg('An unexpected error occurred while loading cities');
    } finally {
      this._loading = false;
    }
  }

  private async _loadZones(cityId: string): Promise<void> {
    this._loading = true;
    this._error = null;

    try {
      const response = await locationsApi.listZones(this.simulationId, { city_id: cityId });

      if (response.success && response.data) {
        this._zones = response.data ?? [];
        this._loadZoneStability();
        this._loadWeatherData();
      } else {
        this._error = response.error?.message ?? msg('Failed to load zones');
      }
    } catch {
      this._error = msg('An unexpected error occurred while loading zones');
    } finally {
      this._loading = false;
    }
  }

  private async _loadStreets(zoneId: string): Promise<void> {
    this._loading = true;
    this._error = null;

    try {
      const response = await locationsApi.listStreets(this.simulationId, { zone_id: zoneId });

      if (response.success && response.data) {
        this._streets = response.data ?? [];
      } else {
        this._error = response.error?.message ?? msg('Failed to load streets');
      }
    } catch {
      this._error = msg('An unexpected error occurred while loading streets');
    } finally {
      this._loading = false;
    }
  }

  private async _loadZoneStability(): Promise<void> {
    try {
      const response = await healthApi.listZoneStability(this.simulationId);
      if (response.success && response.data) {
        const zones = response.data as ZoneStability[];
        const map = new Map<string, ZoneStability>();
        for (const z of zones) {
          map.set(z.zone_id, z);
        }
        this._stabilityMap = map;
      }
    } catch {
      // Stability data not critical
    }
  }

  private async _loadWeatherData(): Promise<void> {
    try {
      const response = await heartbeatApi.listEntries(this.simulationId, {
        entry_type: 'ambient_weather',
        limit: '20',
        order: 'created_at.desc',
      });
      if (response.success && response.data) {
        const map = new Map<string, ZoneWeather>();
        for (const entry of response.data) {
          const zoneId = entry.metadata?.zone_id as string | undefined;
          // Keep only the most recent entry per zone (already sorted desc)
          if (zoneId && !map.has(zoneId)) {
            map.set(zoneId, {
              narrative: entry.narrative_en,
              narrative_de: entry.narrative_de ?? '',
              categories: (entry.metadata?.categories as string[]) ?? [],
              temperature: (entry.metadata?.temperature as number) ?? 0,
              weather_code: (entry.metadata?.weather_code as number) ?? 0,
            });
          }
        }
        this._weatherMap = map;
      }
    } catch {
      // Weather data not critical — graceful degradation
    }
  }

  private _handleCitySelect(e: CustomEvent<City>): void {
    this._selectedCity = e.detail;
    this._level = 'zones';
    this._loadZones(e.detail.id);
  }

  private _handleZoneSelect(e: CustomEvent<Zone>): void {
    this._selectedZone = e.detail;
    this._level = 'streets';
    this._loadStreets(e.detail.id);
  }

  private _navigateTo(level: LocationLevel): void {
    this._level = level;
    this._error = null;

    if (level === 'cities') {
      this._selectedCity = null;
      this._selectedZone = null;
      this._loadCities();
    } else if (level === 'zones' && this._selectedCity) {
      this._selectedZone = null;
      this._loadZones(this._selectedCity.id);
    }
  }

  private _handleCreateClick(): void {
    if (this._level === 'cities') {
      this._editType = 'city';
    } else if (this._level === 'zones') {
      this._editType = 'zone';
    } else {
      this._editType = 'street';
    }
    this._editItem = null;
    this._showEditModal = true;
  }

  private _handleEditModalClose(): void {
    this._showEditModal = false;
    this._editItem = null;
  }

  private _handleSaveComplete(): void {
    this._showEditModal = false;
    this._editItem = null;

    if (this._level === 'cities') {
      this._loadCities();
    } else if (this._level === 'zones' && this._selectedCity) {
      this._loadZones(this._selectedCity.id);
    } else if (this._level === 'streets' && this._selectedZone) {
      this._loadStreets(this._selectedZone.id);
    }
  }

  private _handleMapZoneSelect(e: CustomEvent): void {
    const zone = e.detail;
    if (zone?.zone_id) {
      this._selectedZone = { id: zone.zone_id, name: zone.zone_name } as Zone;
      this._level = 'streets';
      this._viewMode = 'list';
      this._loadStreets(zone.zone_id);
    }
  }

  private _handleRetry(): void {
    if (this._level === 'cities') {
      this._loadCities();
    } else if (this._level === 'zones' && this._selectedCity) {
      this._loadZones(this._selectedCity.id);
    } else if (this._level === 'streets' && this._selectedZone) {
      this._loadStreets(this._selectedZone.id);
    }
  }

  private _renderBreadcrumb() {
    return html`
      <nav class="view__breadcrumb" aria-label=${msg('Location breadcrumb')}>
        <span
          class="view__crumb ${this._level === 'cities' ? 'view__crumb--current' : ''}"
          @click=${() => this._navigateTo('cities')}
        >
          ${msg('Cities')}
        </span>
        ${
          this._selectedCity
            ? html`
              <span class="view__separator">/</span>
              <span
                class="view__crumb ${this._level === 'zones' ? 'view__crumb--current' : ''}"
                @click=${() => this._navigateTo('zones')}
              >
                ${this._selectedCity.name}
              </span>
            `
            : nothing
        }
        ${
          this._selectedZone
            ? html`
              <span class="view__separator">/</span>
              <span class="view__crumb view__crumb--current">
                ${this._selectedZone.name}
              </span>
            `
            : nothing
        }
      </nav>
    `;
  }

  private _renderContent() {
    if (this._loading) {
      return html`<velg-loading-state message=${msg('Loading locations...')}></velg-loading-state>`;
    }

    if (this._error) {
      return html`
        <velg-error-state
          message=${this._error}
          show-retry
          @retry=${this._handleRetry}
        ></velg-error-state>
      `;
    }

    if (this._level === 'cities') {
      if (this._cities.length === 0) {
        return html`
          <velg-empty-state
            message=${msg('No cities found. Create one to get started.')}
            cta-label=${this._canEdit ? msg('Create City') : ''}
            @cta-click=${this._handleCreateClick}
          ></velg-empty-state>
        `;
      }
      return html`
        <velg-city-list
          .cities=${this._cities}
          @city-select=${this._handleCitySelect}
        ></velg-city-list>
      `;
    }

    if (this._level === 'zones') {
      if (this._zones.length === 0) {
        return html`
          <velg-empty-state
            message=${msg('No zones in this city.')}
            cta-label=${this._canEdit ? msg('Create Zone') : ''}
            @cta-click=${this._handleCreateClick}
          ></velg-empty-state>
        `;
      }
      return html`
        <velg-zone-list
          .zones=${this._zones}
          .stabilityMap=${this._stabilityMap}
          .weatherMap=${this._weatherMap}
          @zone-select=${this._handleZoneSelect}
        ></velg-zone-list>
      `;
    }

    if (this._streets.length === 0) {
      return html`
        <velg-empty-state
          message=${msg('No streets in this zone.')}
          cta-label=${this._canEdit ? msg('Create Street') : ''}
          @cta-click=${this._handleCreateClick}
        ></velg-empty-state>
      `;
    }
    return html`
      <velg-street-list .streets=${this._streets}></velg-street-list>
    `;
  }

  private _renderViewToggle() {
    return html`
      <div class="view__mode-toggle">
        <button
          class="view__mode-btn ${this._viewMode === 'list' ? 'view__mode-btn--active' : ''}"
          @click=${() => {
            this._viewMode = 'list';
          }}
          aria-pressed=${this._viewMode === 'list' ? 'true' : 'false'}
        >${msg('List')}</button>
        <button
          class="view__mode-btn ${this._viewMode === 'map' ? 'view__mode-btn--active' : ''}"
          @click=${() => {
            this._viewMode = 'map';
          }}
          aria-pressed=${this._viewMode === 'map' ? 'true' : 'false'}
        >${msg('Map')}</button>
      </div>
    `;
  }

  protected render() {
    const levelLabels: Record<LocationLevel, string> = {
      cities: msg('City'),
      zones: msg('Zone'),
      streets: msg('Street'),
    };

    return html`
      <section class="view" aria-label=${msg('Locations')}>
        <header class="view__header">
          <div class="view__title-group">
            <h1 class="view__title">${msg('Locations')}</h1>
            <velg-help-tip
              topic="world"
              label=${msg('What are locations?')}
            ></velg-help-tip>
          </div>
          <div style="display: flex; align-items: center; gap: var(--space-3, 12px);">
            ${this._renderViewToggle()}
            ${
              this._canEdit && this._viewMode === 'list'
                ? html`
                  <button class="view__create-btn" @click=${this._handleCreateClick}>
                    ${msg(str`+ Create ${levelLabels[this._level]}`)}
                  </button>
                `
                : nothing
            }
          </div>
        </header>

        ${
          this._viewMode === 'list'
            ? html`
              ${this._renderBreadcrumb()}
              ${this._renderContent()}
            `
            : html`
              <velg-cartographers-desk
                .simulationId=${this.simulationId}
                @zone-select=${this._handleMapZoneSelect}
              ></velg-cartographers-desk>
            `
        }

        <velg-location-edit-modal
          .type=${this._editType}
          .item=${this._editItem}
          .simulationId=${this.simulationId}
          .cityId=${this._selectedCity?.id ?? ''}
          .zoneId=${this._selectedZone?.id ?? ''}
          ?open=${this._showEditModal}
          @modal-close=${this._handleEditModalClose}
          @location-saved=${this._handleSaveComplete}
        ></velg-location-edit-modal>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-locations-view': VelgLocationsView;
  }
}
