/**
 * WeatherSettingsPanel -- ambient weather configuration.
 *
 * Controls real-world weather seeding: geographic anchor coordinates,
 * theme override for narrative tone, and enable/disable toggle.
 * All settings stored in `simulation_settings` with category='heartbeat'.
 *
 * Every input has a detailed info bubble explaining the mechanic.
 * Pattern: extends BaseSettingsPanel (same as AutonomySettingsPanel).
 */

import { localized, msg } from '@lit/localize';
import { css, html, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { BaseSettingsPanel } from '../shared/BaseSettingsPanel.js';
import '../shared/VelgSectionHeader.js';
import '../shared/VelgToggle.js';
import { infoBubbleStyles, renderInfoBubble } from '../shared/info-bubble-styles.js';
import { settingsStyles } from '../shared/settings-styles.js';

@localized()
@customElement('velg-weather-settings-panel')
export class VelgWeatherSettingsPanel extends BaseSettingsPanel {
  static styles = [
    settingsStyles,
    infoBubbleStyles,
    css`
      .toggle-row {
        display: flex;
        align-items: center;
        gap: var(--space-3);
      }

      .toggle-row__label {
        font-family: var(--font-brutalist);
        font-weight: var(--font-black);
        font-size: var(--text-sm);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        color: var(--color-text-primary);
      }

      .coord-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--space-3);
      }

      .coord-input {
        width: 100%;
        padding: var(--space-2) var(--space-3);
        background: var(--color-surface);
        border: var(--border-default);
        color: var(--color-text-primary);
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm);
      }

      .coord-input:focus {
        outline: 2px solid var(--color-border-focus);
        outline-offset: -2px;
      }

      .theme-select {
        width: 100%;
        padding: var(--space-2) var(--space-3);
        background: var(--color-surface);
        border: var(--border-default);
        color: var(--color-text-primary);
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm);
      }

      .theme-select:focus {
        outline: 2px solid var(--color-border-focus);
        outline-offset: -2px;
      }

      .coord-hint {
        font-family: var(--font-mono, monospace);
        font-size: 10px;
        color: var(--color-text-muted);
        margin-top: var(--space-1);
      }

      .visually-hidden {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }

      .disabled-notice {
        padding: var(--space-3);
        background: var(--color-surface-sunken);
        border: var(--border-default);
        font-family: var(--font-body);
        font-size: var(--text-sm);
        color: var(--color-text-muted);
        line-height: 1.5;
      }

      @media (max-width: 640px) {
        .coord-grid {
          grid-template-columns: 1fr;
        }

        .coord-input,
        .theme-select {
          min-height: 44px;
          font-size: 16px; /* Prevent iOS zoom */
        }
      }
    `,
  ];

  protected get category() {
    return 'heartbeat' as const;
  }

  protected get successMessage(): string {
    return msg('Weather settings saved.');
  }

  private get _enabled(): boolean {
    return this._values.weather_enabled === 'true';
  }

  private _handleToggle(key: string, checked: boolean): void {
    this._values = { ...this._values, [key]: String(checked) };
  }

  private _handleCoordInput(key: string, e: Event): void {
    const value = (e.target as HTMLInputElement).value;
    this._values = { ...this._values, [key]: value };
  }

  private _handleSelect(key: string, e: Event): void {
    const value = (e.target as HTMLSelectElement).value;
    this._values = { ...this._values, [key]: value };
  }

  protected render() {
    if (this._loading) {
      return html`<velg-loading-state message=${msg('Loading weather settings...')}></velg-loading-state>`;
    }

    return html`
      <div class="settings-panel">
        ${this._error ? html`<div class="settings-panel__error">${this._error}</div>` : nothing}

        <!-- Master Toggle -->
        <div class="settings-section">
          <velg-section-header variant="large">${msg('Ambient Weather')}</velg-section-header>
          <p class="settings-section__help">
            ${msg('Real-world weather conditions influence zone atmosphere and agent mood. Each simulation is anchored to a geographic location matching its theme. Weather data is fetched every heartbeat tick (4 hours) from the Open-Meteo API.')}
          </p>

          <div class="toggle-row">
            <velg-toggle
              .checked=${this._enabled}
              @toggle-change=${(e: CustomEvent) => this._handleToggle('weather_enabled', e.detail.checked)}
            ></velg-toggle>
            <span class="toggle-row__label">
              ${msg('Enable Weather Seeding')}
              ${renderInfoBubble(msg('When enabled, real-world weather at the simulation\'s geographic anchor generates ambient zone events and applies mood effects to agents. Zero AI cost -- all narratives are template-based. One API call per tick.'))}
            </span>
          </div>
        </div>

        ${this._enabled ? this._renderOptions() : html`
          <div class="disabled-notice">
            ${msg('Weather seeding is disabled. Enable it to let real-world conditions influence your simulation\'s atmosphere.')}
          </div>
        `}

        <div class="settings-panel__footer">
          <button
            class="settings-btn settings-btn--primary"
            @click=${this._saveSettings}
            ?disabled=${!this._hasChanges || this._saving}
          >
            ${this._saving ? msg('Saving...') : msg('Save Weather Settings')}
          </button>
        </div>
      </div>
    `;
  }

  private _renderOptions() {
    const lat = this._values.weather_lat || '';
    const lon = this._values.weather_lon || '';
    const themeOverride = this._values.weather_theme_override || '';

    return html`
      <!-- Geographic Anchor -->
      <div class="settings-section">
        <velg-section-header variant="large">${msg('Geographic Anchor')}</velg-section-header>
        <p class="settings-section__help">
          ${msg('The real-world location used for weather data. Leave empty to use the default for your simulation\'s theme.')}
        </p>

        <div class="settings-form__group">
          <label class="settings-form__label settings-form__label--xs">
            ${msg('Coordinates')}
            ${renderInfoBubble(msg('Latitude and longitude of the real-world location. Examples: Prague (50.08, 14.44), Svalbard (78.22, 15.63), Amalfi (40.63, 14.60), Carcassonne (43.21, 2.35). Leave blank to use the theme default.'))}
          </label>
          <div class="coord-grid">
            <div>
              <label class="visually-hidden" for="weather-lat">${msg('Latitude')}</label>
              <input
                class="coord-input"
                id="weather-lat"
                type="number"
                step="0.01"
                min="-90"
                max="90"
                placeholder=${msg('Latitude (e.g. 50.08)')}
                .value=${lat}
                @input=${(e: Event) => this._handleCoordInput('weather_lat', e)}
              />
              <div class="coord-hint">${msg('Latitude: -90 (South Pole) to 90 (North Pole)')}</div>
            </div>
            <div>
              <label class="visually-hidden" for="weather-lon">${msg('Longitude')}</label>
              <input
                class="coord-input"
                id="weather-lon"
                type="number"
                step="0.01"
                min="-180"
                max="180"
                placeholder=${msg('Longitude (e.g. 14.44)')}
                .value=${lon}
                @input=${(e: Event) => this._handleCoordInput('weather_lon', e)}
              />
              <div class="coord-hint">${msg('Longitude: -180 (West) to 180 (East)')}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Narrative Theme -->
      <div class="settings-section">
        <velg-section-header variant="large">${msg('Narrative Theme')}</velg-section-header>

        <div class="settings-form__group">
          <label class="settings-form__label settings-form__label--xs" for="weather-theme-override">
            ${msg('Weather Description Style')}
            ${renderInfoBubble(msg('Override the narrative tone of weather descriptions. By default, your simulation\'s theme determines the style (spy-thriller gets surveillance metaphors, sci-fi gets system alerts, etc.). Override only if you want a different atmosphere.'))}
          </label>
          <select
            class="theme-select"
            id="weather-theme-override"
            .value=${themeOverride}
            @change=${(e: Event) => this._handleSelect('weather_theme_override', e)}
          >
            <option value="">${msg('Auto (from simulation theme)')}</option>
            <option value="spy-thriller">${msg('Spy Thriller -- surveillance, curfews, dead drops')}</option>
            <option value="scifi">${msg('Sci-Fi -- system alerts, hull sensors, protocols')}</option>
            <option value="biopunk">${msg('Biopunk -- spore clouds, bioluminescence, colonies')}</option>
            <option value="post-apocalyptic">${msg('Post-Apocalyptic -- salvage, cisterns, survival')}</option>
            <option value="medieval">${msg('Medieval -- bells, scholars, cloisters, seasons')}</option>
          </select>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-weather-settings-panel': VelgWeatherSettingsPanel;
  }
}
