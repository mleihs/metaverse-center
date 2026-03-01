import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { adminApi } from '../../services/api/index.js';
import type { PlatformSetting } from '../../types/index.js';
import { VelgToast } from '../shared/Toast.js';

/** Human-readable labels and descriptions for each cache setting key. */
function getSettingMeta(): Record<string, { label: string; description: string; unit: string }> {
  return {
    cache_map_data_ttl: {
      label: msg('Map Data TTL'),
      description: msg(
        "In-process cache TTL for the Cartographer's Map aggregation endpoint. Controls how long map data is served from memory before re-querying the database.",
      ),
      unit: msg('seconds'),
    },
    cache_seo_metadata_ttl: {
      label: msg('SEO Metadata TTL'),
      description: msg(
        'Cache TTL for simulation metadata used by the SEO crawler enrichment middleware. Higher values reduce DB queries for crawlers.',
      ),
      unit: msg('seconds'),
    },
    cache_http_simulations_max_age: {
      label: msg('Simulations Cache-Control'),
      description: msg(
        'HTTP Cache-Control max-age for the public simulations list endpoint. Browsers and CDNs cache the response for this duration.',
      ),
      unit: msg('seconds'),
    },
    cache_http_map_data_max_age: {
      label: msg('Map Data Cache-Control'),
      description: msg('HTTP Cache-Control max-age for the public map-data endpoint.'),
      unit: msg('seconds'),
    },
    cache_http_battle_feed_max_age: {
      label: msg('Battle Feed Cache-Control'),
      description: msg(
        'HTTP Cache-Control max-age for the public battle feed endpoint. Lower values give fresher epoch battle data.',
      ),
      unit: msg('seconds'),
    },
    cache_http_connections_max_age: {
      label: msg('Connections Cache-Control'),
      description: msg('HTTP Cache-Control max-age for the public connections endpoint.'),
      unit: msg('seconds'),
    },
  };
}

/** Default values for reset. */
const DEFAULTS: Record<string, number> = {
  cache_map_data_ttl: 15,
  cache_seo_metadata_ttl: 300,
  cache_http_simulations_max_age: 60,
  cache_http_map_data_max_age: 15,
  cache_http_battle_feed_max_age: 10,
  cache_http_connections_max_age: 60,
};

@localized()
@customElement('velg-admin-caching-tab')
export class VelgAdminCachingTab extends LitElement {
  static styles = css`
    :host {
      display: block;
      color: var(--color-gray-200, #e2e2e8);
      font-family: var(--font-mono, monospace);
    }

    .cache-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: var(--space-4);
      margin-bottom: var(--space-6);
    }

    .cache-card {
      padding: var(--space-4);
      background: var(--color-gray-900, #111118);
      border: 1px solid var(--color-gray-800, #1e1e2a);
      transition:
        border-color 0.2s ease,
        box-shadow 0.2s ease;
    }

    .cache-card:hover {
      border-color: var(--color-gray-600, #4b5563);
    }

    .cache-card--dirty {
      border-color: #f59e0b;
      box-shadow: 0 0 0 1px #f59e0b80;
    }

    .cache-card__label {
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-gray-100, #f3f4f6);
      margin: 0 0 var(--space-2) 0;
    }

    .cache-card__description {
      font-size: var(--text-xs);
      color: var(--color-gray-400, #9ca3af);
      line-height: 1.5;
      margin: 0 0 var(--space-3) 0;
    }

    .cache-card__input-row {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .cache-card__input {
      width: 90px;
      padding: var(--space-2) var(--space-3);
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm);
      text-align: right;
      background: var(--color-gray-950, #0a0a0f);
      color: var(--color-gray-100, #f3f4f6);
      border: 1px solid var(--color-gray-700, #374151);
      border-radius: 0;
      transition: border-color 0.2s ease;
      -moz-appearance: textfield;
    }

    .cache-card__input::-webkit-outer-spin-button,
    .cache-card__input::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }

    .cache-card__input:focus {
      outline: none;
      border-color: var(--color-danger, #dc2626);
      box-shadow: 0 0 0 1px var(--color-danger, #dc2626);
    }

    .cache-card__unit {
      font-size: var(--text-xs);
      color: var(--color-gray-500, #6b7280);
      text-transform: uppercase;
    }

    .cache-card__default {
      font-size: var(--text-xs);
      color: var(--color-gray-500, #6b7280);
      margin-left: auto;
    }

    /* --- Actions --- */

    .actions {
      display: flex;
      gap: var(--space-3);
    }

    .btn {
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      padding: var(--space-2) var(--space-5);
      cursor: pointer;
      transition:
        background 0.2s ease,
        color 0.2s ease,
        transform 0.15s ease,
        box-shadow 0.2s ease;
    }

    .btn:hover {
      transform: translateY(-1px);
    }

    .btn:active {
      transform: translateY(0);
    }

    .btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      transform: none;
    }

    .btn--save {
      background: #dc2626;
      color: #ffffff;
      border: 1px solid #dc2626;
    }

    .btn--save:hover:not(:disabled) {
      background: #b91c1c;
      box-shadow: 0 0 12px rgba(220, 38, 38, 0.3);
    }

    .btn--reset {
      background: transparent;
      color: var(--color-gray-400, #9ca3af);
      border: 1px solid var(--color-gray-700, #374151);
    }

    .btn--reset:hover:not(:disabled) {
      color: #f87171;
      border-color: #f8717180;
    }

    .loading {
      text-align: center;
      padding: var(--space-8);
      color: var(--color-gray-500, #6b7280);
      font-family: var(--font-brutalist);
      text-transform: uppercase;
    }

    @media (max-width: 768px) {
      .cache-grid {
        grid-template-columns: 1fr;
      }
    }
  `;

  @state() private _settings: PlatformSetting[] = [];
  @state() private _editValues: Record<string, string> = {};
  @state() private _loading = true;
  @state() private _saving = false;

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    await this._loadSettings();
  }

  private async _loadSettings(): Promise<void> {
    this._loading = true;
    const result = await adminApi.listSettings();
    if (result.success && result.data) {
      this._settings = result.data as PlatformSetting[];
      this._editValues = {};
      for (const s of this._settings) {
        this._editValues[s.setting_key] = String(s.setting_value).replace(/"/g, '');
      }
    }
    this._loading = false;
  }

  private _isDirty(key: string): boolean {
    const original = this._settings.find((s) => s.setting_key === key);
    if (!original) return false;
    const origVal = String(original.setting_value).replace(/"/g, '');
    return this._editValues[key] !== origVal;
  }

  private get _hasDirty(): boolean {
    return this._settings.some((s) => this._isDirty(s.setting_key));
  }

  private async _saveAll(): Promise<void> {
    this._saving = true;
    let successCount = 0;
    let errorCount = 0;

    for (const s of this._settings) {
      if (!this._isDirty(s.setting_key)) continue;
      const newVal = this._editValues[s.setting_key];
      const numVal = Number(newVal);
      if (Number.isNaN(numVal) || numVal < 0) {
        VelgToast.error(msg(str`Invalid value for ${s.setting_key}.`));
        errorCount++;
        continue;
      }
      const result = await adminApi.updateSetting(s.setting_key, numVal);
      if (result.success) {
        successCount++;
      } else {
        errorCount++;
        VelgToast.error(result.error?.message ?? msg('Save failed.'));
      }
    }

    if (successCount > 0) {
      VelgToast.success(msg(str`${successCount} settings saved.`));
    }
    if (errorCount > 0) {
      VelgToast.error(msg(str`${errorCount} settings failed to save.`));
    }

    await this._loadSettings();
    this._saving = false;
  }

  private _resetToDefaults(): void {
    this._editValues = { ...this._editValues };
    for (const key of Object.keys(DEFAULTS)) {
      this._editValues[key] = String(DEFAULTS[key]);
    }
    this.requestUpdate();
  }

  protected render() {
    if (this._loading) {
      return html`<div class="loading">${msg('Loading settings...')}</div>`;
    }

    const meta = getSettingMeta();

    return html`
      <div class="cache-grid">
        ${this._settings.map((setting) => {
          const m = meta[setting.setting_key];
          if (!m) return null;
          const isDirty = this._isDirty(setting.setting_key);
          const defaultVal = DEFAULTS[setting.setting_key];

          return html`
            <div class="cache-card ${isDirty ? 'cache-card--dirty' : ''}">
              <p class="cache-card__label">${m.label}</p>
              <p class="cache-card__description">${m.description}</p>
              <div class="cache-card__input-row">
                <input
                  type="number"
                  class="cache-card__input"
                  min="1"
                  .value=${this._editValues[setting.setting_key] ?? ''}
                  @input=${(e: Event) => {
                    this._editValues = {
                      ...this._editValues,
                      [setting.setting_key]: (e.target as HTMLInputElement).value,
                    };
                  }}
                />
                <span class="cache-card__unit">${m.unit}</span>
                ${
                  defaultVal != null
                    ? html`<span class="cache-card__default">${msg(str`Default: ${defaultVal}`)}</span>`
                    : null
                }
              </div>
            </div>
          `;
        })}
      </div>

      <div class="actions">
        <button
          class="btn btn--save"
          ?disabled=${!this._hasDirty || this._saving}
          @click=${this._saveAll}
        >${this._saving ? msg('Saving...') : msg('Save Changes')}</button>
        <button
          class="btn btn--reset"
          ?disabled=${this._saving}
          @click=${this._resetToDefaults}
        >${msg('Reset to Defaults')}</button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-admin-caching-tab': VelgAdminCachingTab;
  }
}
