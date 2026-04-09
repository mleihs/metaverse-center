import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { adminApi } from '../../services/api/index.js';
import type { PlatformSetting } from '../../types/index.js';
import {
  adminAnimationStyles,
  adminButtonStyles,
  adminForgeSectionStyles,
  adminLoadingStyles,
} from '../shared/admin-shared-styles.js';
import { infoBubbleStyles, renderInfoBubble } from '../shared/info-bubble-styles.js';
import { VelgToast } from '../shared/Toast.js';

interface ModelSettingMeta {
  label: string;
  description: string;
}

const PROD_KEYS = ['model_default', 'model_fallback', 'model_research', 'model_forge'] as const;

const DEV_KEYS = [
  'model_default_dev',
  'model_fallback_dev',
  'model_research_dev',
  'model_forge_dev',
] as const;

const ALL_MODEL_KEYS = [...PROD_KEYS, ...DEV_KEYS] as const;
type ModelSettingKey = (typeof ALL_MODEL_KEYS)[number];

/** Purpose labels shared between prod and dev columns. */
function getModelMeta(): Record<string, ModelSettingMeta> {
  return {
    model_default: {
      label: msg('Default Model'),
      description: msg(
        'Primary text model for simulation generation. Used when no purpose-specific or simulation-level override is set.',
      ),
    },
    model_fallback: {
      label: msg('Fallback Model'),
      description: msg(
        'Last-resort model when the default is unavailable. Choose a cheap or free model to ensure generation never fails.',
      ),
    },
    model_research: {
      label: msg('Research Model'),
      description: msg(
        'Cheaper model for research and analysis tasks (Astrolabe, anchor generation). Trades quality for cost savings.',
      ),
    },
    model_forge: {
      label: msg('Forge Model'),
      description: msg(
        'Text model for the Forge pipeline: lore generation, theme design, entity translation, and chunk drafting.',
      ),
    },
    // Dev keys share the same labels/descriptions — resolved via base key lookup
    model_default_dev: {
      label: msg('Default Model'),
      description: msg(
        'Primary text model for simulation generation. Used when no purpose-specific or simulation-level override is set.',
      ),
    },
    model_fallback_dev: {
      label: msg('Fallback Model'),
      description: msg(
        'Last-resort model when the default is unavailable. Choose a cheap or free model to ensure generation never fails.',
      ),
    },
    model_research_dev: {
      label: msg('Research Model'),
      description: msg(
        'Cheaper model for research and analysis tasks (Astrolabe, anchor generation). Trades quality for cost savings.',
      ),
    },
    model_forge_dev: {
      label: msg('Forge Model'),
      description: msg(
        'Text model for the Forge pipeline: lore generation, theme design, entity translation, and chunk drafting.',
      ),
    },
  };
}

const MODEL_OPTIONS = [
  { id: 'anthropic/claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { id: 'anthropic/claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
  { id: 'deepseek/deepseek-v3.2', label: 'DeepSeek V3.2' },
  { id: 'deepseek/deepseek-r1-0528:free', label: 'DeepSeek R1 (Free)' },
  { id: 'google/gemini-2.0-flash-001', label: 'Gemini 2.0 Flash' },
  { id: 'google/gemini-2.5-pro-preview', label: 'Gemini 2.5 Pro' },
];

function getModelTip(key: string): string {
  const tips: Record<string, string> = {
    model_default: msg(
      'Primary model for all high-stakes generation: narrative events, agent dialogue, chronicle entries, and simulation descriptions. This model runs for every user-facing text output. Higher quality models produce richer, more coherent storytelling but cost more per request. Recommended: Claude Sonnet 4.6 or GPT-4o for the best quality-to-cost ratio.',
    ),
    model_fallback: msg(
      'Activated automatically when the default model returns an error, times out, or hits rate limits. Should be a reliable, always-available model. Free-tier models (e.g. Llama 3.1, Gemma) work well here since fallback quality matters less than availability. The system retries once with the fallback before reporting failure.',
    ),
    model_research: msg(
      'Used for high-volume, lower-stakes bulk operations: Astrolabe research queries, anchor point generation, trend analysis, and background enrichment tasks. Runs 10-50x more requests than the default model. Choose a cost-effective model since individual output quality is less critical. Haiku or Gemini Flash are good choices.',
    ),
    model_forge: msg(
      "Dedicated model for the Forge creative pipeline: lore generation, theme composition, entity translation, simulation seed content, and world-building prompts. Quality directly impacts Forge output richness. Architect users see this model's output during simulation creation. Recommended: a top-tier model (Opus, GPT-4o) for the best creative results.",
    ),
  };
  // Dev keys share the same tips as their prod counterparts
  const baseKey = key.replace(/_dev$/, '');
  return tips[baseKey] ?? '';
}

const DEFAULTS: Record<ModelSettingKey, string> = {
  model_default: 'anthropic/claude-sonnet-4-6',
  model_fallback: 'deepseek/deepseek-r1-0528:free',
  model_research: 'google/gemini-2.0-flash-001',
  model_forge: 'anthropic/claude-sonnet-4-6',
  model_default_dev: 'deepseek/deepseek-r1-0528:free',
  model_fallback_dev: 'deepseek/deepseek-r1-0528:free',
  model_research_dev: 'google/gemini-2.0-flash-001',
  model_forge_dev: 'deepseek/deepseek-r1-0528:free',
};

@localized()
@customElement('velg-admin-models-tab')
export class VelgAdminModelsTab extends LitElement {
  static styles = [
    adminAnimationStyles,
    adminForgeSectionStyles,
    adminButtonStyles,
    adminLoadingStyles,
    infoBubbleStyles,
    css`
      :host {
        display: block;
        color: var(--color-text-primary);
        font-family: var(--font-mono, monospace);
        --_admin-accent: var(--color-accent-amber);
        --_admin-accent-contrast: var(--color-surface-sunken);
      }

      @media (prefers-reduced-motion: reduce) {
        .model-card {
          animation: none !important;
        }
      }

      /* --- Two-Column Layout --- */

      .env-columns {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--space-5);
      }

      .env-column__header {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        margin-bottom: var(--space-4);
      }

      .env-column__label {
        font-family: var(--font-brutalist, 'Courier New', monospace);
        font-weight: 900;
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: 2px;
        color: var(--color-text-muted);
      }

      .env-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        font-family: var(--font-mono, 'SF Mono', monospace);
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 1px;
        text-transform: uppercase;
        border-radius: 2px;
        background: var(--color-accent-amber);
        color: var(--color-surface-sunken);
        animation: amber-pulse 2s ease infinite;
      }

      .env-badge::before {
        content: '';
        display: inline-block;
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: var(--color-surface-sunken);
      }

      /* --- Model Cards --- */

      .model-cards {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }

      .model-card {
        padding: var(--space-4);
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        transition:
          border-color 0.2s ease,
          box-shadow 0.2s ease;
        animation: panel-enter 0.4s ease both;
      }

      .model-card:nth-child(1) {
        animation-delay: 0s;
      }
      .model-card:nth-child(2) {
        animation-delay: 0.05s;
      }
      .model-card:nth-child(3) {
        animation-delay: 0.1s;
      }
      .model-card:nth-child(4) {
        animation-delay: 0.15s;
      }

      .model-card:hover {
        border-color: var(--color-text-muted);
      }

      .model-card--dirty {
        border-color: var(--color-accent-amber);
        box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-accent-amber) 40%, transparent);
      }

      .model-card__label {
        display: flex;
        align-items: center;
        font-family: var(--font-brutalist);
        font-size: var(--text-sm);
        font-weight: var(--font-bold);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        color: var(--color-text-primary);
        margin: 0 0 var(--space-2) 0;
      }

      .model-card__description {
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
        line-height: 1.5;
        margin: 0 0 var(--space-3) 0;
      }

      .model-card__select-row {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin-bottom: var(--space-2);
      }

      .model-card__select {
        flex: 1;
        min-width: 0;
        padding: var(--space-2) var(--space-3);
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm);
        background: var(--color-surface);
        color: var(--color-text-primary);
        border: 1px solid var(--color-border);
        border-radius: 0;
        cursor: pointer;
        transition: border-color 0.2s ease;
        -webkit-appearance: none;
        -moz-appearance: none;
        appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23f59e0b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 10px center;
        padding-right: var(--space-8);
      }

      .model-card__select:focus {
        outline: none;
        border-color: var(--color-accent-amber);
        box-shadow: 0 0 0 1px var(--color-accent-amber);
      }

      .model-card__select option {
        background: var(--color-surface);
        color: var(--color-text-primary);
      }

      .model-card__custom-toggle {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-xs);
        text-transform: uppercase;
        padding: var(--space-2);
        background: none;
        border: 1px solid var(--color-border);
        color: var(--color-text-muted);
        cursor: pointer;
        transition:
          color 0.2s ease,
          border-color 0.2s ease;
        white-space: nowrap;
      }

      .model-card__custom-toggle:hover {
        color: var(--color-text-primary);
        border-color: var(--color-text-muted);
      }

      .model-card__custom-toggle--active {
        color: var(--color-accent-amber);
        border-color: color-mix(in srgb, var(--color-accent-amber) 50%, transparent);
      }

      .model-card__custom-row {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin-top: var(--space-2);
      }

      .model-card__custom-input {
        flex: 1;
        min-width: 0;
        padding: var(--space-2) var(--space-3);
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm);
        background: var(--color-surface);
        color: var(--color-text-primary);
        border: 1px solid var(--color-border);
        border-radius: 0;
        transition: border-color 0.2s ease;
      }

      .model-card__custom-input:focus {
        outline: none;
        border-color: var(--color-accent-amber);
        box-shadow: 0 0 0 1px var(--color-accent-amber);
      }

      .model-card__custom-input::placeholder {
        color: var(--color-text-muted);
        opacity: 0.6;
      }

      .model-card__default {
        font-size: var(--text-xs);
        color: var(--color-text-muted);
        margin: var(--space-2) 0 0 0;
      }

      .actions {
        margin-top: var(--space-5);
      }

      @media (max-width: 768px) {
        .env-columns {
          grid-template-columns: 1fr;
        }
      }
    `,
  ];

  @state() private _settings: PlatformSetting[] = [];
  @state() private _editValues: Record<string, string> = {};
  @state() private _customMode: Set<string> = new Set();
  @state() private _loading = true;
  @state() private _saving = false;
  @state() private _activeEnvironment = 'development';

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    await this._loadData();
  }

  private async _loadData(): Promise<void> {
    this._loading = true;
    // Fetch settings and environment in parallel
    const [settingsResult, envResult] = await Promise.all([
      adminApi.listSettings(),
      adminApi.getEnvironment(),
    ]);

    if (settingsResult.success && settingsResult.data) {
      const allSettings = settingsResult.data as PlatformSetting[];
      this._settings = allSettings.filter((s) =>
        (ALL_MODEL_KEYS as readonly string[]).includes(s.setting_key),
      );
      this._editValues = {};
      this._customMode = new Set();
      // Seed all keys with defaults first, then overlay DB values
      for (const key of ALL_MODEL_KEYS) {
        this._editValues[key] = DEFAULTS[key];
      }
      for (const s of this._settings) {
        const val = String(s.setting_value).replace(/"/g, '');
        this._editValues[s.setting_key] = val;
        if (!MODEL_OPTIONS.some((o) => o.id === val)) {
          this._customMode.add(s.setting_key);
        }
      }
    }

    if (envResult.success && envResult.data) {
      this._activeEnvironment = (envResult.data as { environment: string }).environment;
    }

    this._loading = false;
  }

  private _isDirty(key: string): boolean {
    const original = this._settings.find((s) => s.setting_key === key);
    if (!original) {
      // Key not in DB yet — dirty if value differs from hardcoded default
      const defaultVal = DEFAULTS[key as ModelSettingKey];
      return defaultVal !== undefined && this._editValues[key] !== defaultVal;
    }
    const origVal = String(original.setting_value).replace(/"/g, '');
    return this._editValues[key] !== origVal;
  }

  private get _hasDirty(): boolean {
    return Object.keys(this._editValues).some((key) => this._isDirty(key));
  }

  private _toggleCustom(key: string): void {
    const next = new Set(this._customMode);
    if (next.has(key)) {
      next.delete(key);
      const currentVal = this._editValues[key];
      if (!MODEL_OPTIONS.some((o) => o.id === currentVal)) {
        this._editValues = {
          ...this._editValues,
          [key]: DEFAULTS[key as ModelSettingKey] ?? MODEL_OPTIONS[0].id,
        };
      }
    } else {
      next.add(key);
    }
    this._customMode = next;
  }

  private async _saveAll(): Promise<void> {
    this._saving = true;
    let successCount = 0;
    let errorCount = 0;

    for (const key of Object.keys(this._editValues)) {
      if (!this._isDirty(key)) continue;
      const newVal = this._editValues[key];
      if (!newVal) {
        VelgToast.error(msg(str`Empty value for ${key}.`));
        errorCount++;
        continue;
      }
      const result = await adminApi.updateSetting(key, newVal);
      if (result.success) {
        successCount++;
      } else {
        errorCount++;
        VelgToast.error(result.error?.message ?? msg('Save failed.'));
      }
    }

    if (successCount > 0) {
      VelgToast.success(msg(str`${successCount} model settings saved.`));
    }
    if (errorCount > 0) {
      VelgToast.error(msg(str`${errorCount} settings failed to save.`));
    }

    await this._loadData();
    this._saving = false;
  }

  private _resetToDefaults(): void {
    this._editValues = { ...this._editValues };
    this._customMode = new Set();
    for (const key of ALL_MODEL_KEYS) {
      this._editValues[key] = DEFAULTS[key];
    }
    this.requestUpdate();
  }

  private _renderModelCard(key: string) {
    const meta = getModelMeta();
    const m = meta[key];
    if (!m) return nothing;
    const isDirty = this._isDirty(key);
    const isCustom = this._customMode.has(key);
    const currentVal = this._editValues[key] ?? '';
    const defaultVal = DEFAULTS[key as ModelSettingKey];
    const tip = getModelTip(key);

    return html`
      <div class="model-card ${isDirty ? 'model-card--dirty' : ''}">
        <p class="model-card__label">${m.label}</p>
        <p class="model-card__description">${m.description}</p>
        ${tip ? renderInfoBubble(tip, `tip-${key}`) : nothing}
        <div class="model-card__select-row">
          ${
            isCustom
              ? nothing
              : html`
                <select
                  class="model-card__select"
                  aria-label=${m.label}
                  .value=${currentVal}
                  @change=${(e: Event) => {
                    this._editValues = {
                      ...this._editValues,
                      [key]: (e.target as HTMLSelectElement).value,
                    };
                  }}
                >
                  ${MODEL_OPTIONS.map(
                    (opt) => html`
                      <option value=${opt.id} ?selected=${opt.id === currentVal}>
                        ${opt.label}
                      </option>
                    `,
                  )}
                </select>
              `
          }
          <button
            class="model-card__custom-toggle ${isCustom ? 'model-card__custom-toggle--active' : ''}"
            @click=${() => this._toggleCustom(key)}
            title=${isCustom ? msg('Use preset') : msg('Custom model ID')}
          >
            ${isCustom ? msg('Preset') : msg('Custom')}
          </button>
        </div>
        ${
          isCustom
            ? html`
              <div class="model-card__custom-row">
                <input
                  type="text"
                  class="model-card__custom-input"
                  aria-label=${msg('Custom model ID')}
                  placeholder=${msg('e.g. vendor/model-name')}
                  .value=${currentVal}
                  @input=${(e: Event) => {
                    this._editValues = {
                      ...this._editValues,
                      [key]: (e.target as HTMLInputElement).value,
                    };
                  }}
                />
              </div>
            `
            : nothing
        }
        <p class="model-card__default">${msg(str`Default: ${defaultVal}`)}</p>
      </div>
    `;
  }

  protected render() {
    if (this._loading) {
      return html`<div class="loading">${msg('Loading model settings...')}</div>`;
    }

    const isProd = this._activeEnvironment === 'production';

    return html`
      <div class="forge-section">
        <div class="forge-section__header">
          <span class="forge-section__code">SEC-01</span>
          <h3 class="forge-section__title">${msg('Model Configuration')}</h3>
        </div>
        <div class="forge-section__divider"></div>

        <div class="env-columns">
          <!-- Production Column -->
          <div class="env-column">
            <div class="env-column__header">
              <span class="env-column__label">${msg('Production')}</span>
              ${isProd ? html`<span class="env-badge">${msg('Active')}</span>` : nothing}
            </div>
            <div class="model-cards">${PROD_KEYS.map((k) => this._renderModelCard(k))}</div>
          </div>

          <!-- Development Column -->
          <div class="env-column">
            <div class="env-column__header">
              <span class="env-column__label">${msg('Development')}</span>
              ${!isProd ? html`<span class="env-badge">${msg('Active')}</span>` : nothing}
            </div>
            <div class="model-cards">${DEV_KEYS.map((k) => this._renderModelCard(k))}</div>
          </div>
        </div>

        <div class="actions">
          <button
            class="btn btn--save"
            aria-label=${msg('Save model changes')}
            ?disabled=${!this._hasDirty || this._saving}
            @click=${this._saveAll}
          >
            ${this._saving ? msg('Saving...') : msg('Save Changes')}
          </button>
          <button
            class="btn btn--reset"
            aria-label=${msg('Reset models to defaults')}
            ?disabled=${this._saving}
            @click=${this._resetToDefaults}
          >
            ${msg('Reset to Defaults')}
          </button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-admin-models-tab': VelgAdminModelsTab;
  }
}
