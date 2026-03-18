import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { adminApi } from '../../services/api/index.js';
import type { PlatformSetting } from '../../types/index.js';
import { icons } from '../../utils/icons.js';
import { VelgToast } from '../shared/Toast.js';

interface ApiKeyMeta {
  label: string;
  description: string;
  category: string;
}

const API_KEY_SETTINGS = [
  'openrouter_api_key',
  'replicate_api_key',
  'guardian_api_key',
  'newsapi_api_key',
  'tavily_api_key',
  'deepl_api_key',
] as const;

type ApiKeySettingKey = (typeof API_KEY_SETTINGS)[number];

function getApiKeyMeta(): Record<ApiKeySettingKey, ApiKeyMeta> {
  return {
    openrouter_api_key: {
      label: msg('OpenRouter API Key'),
      description: msg(
        'Platform default for AI text generation. Simulations can override with their own key.',
      ),
      category: 'ai',
    },
    replicate_api_key: {
      label: msg('Replicate API Key'),
      description: msg(
        'Platform default for AI image generation. Simulations can override with their own key.',
      ),
      category: 'ai',
    },
    guardian_api_key: {
      label: msg('Guardian API Key'),
      description: msg(
        'Platform default for The Guardian news integration. Required for social trend fetching from Guardian.',
      ),
      category: 'news',
    },
    newsapi_api_key: {
      label: msg('NewsAPI Key'),
      description: msg(
        'Platform default for NewsAPI news integration. Required for social trend fetching from NewsAPI.',
      ),
      category: 'news',
    },
    tavily_api_key: {
      label: msg('Tavily API Key'),
      description: msg('Platform default for Forge research and web search capabilities.'),
      category: 'other',
    },
    deepl_api_key: {
      label: msg('DeepL API Key'),
      description: msg('Platform default for automated translation services.'),
      category: 'other',
    },
  };
}

function getCategoryLabel(category: string): string {
  switch (category) {
    case 'ai':
      return msg('AI Providers');
    case 'news':
      return msg('News Integration');
    case 'other':
      return msg('Other Services');
    default:
      return category;
  }
}

@localized()
@customElement('velg-admin-api-keys-tab')
export class VelgAdminApiKeysTab extends LitElement {
  static styles = css`
    :host {
      display: block;
      color: var(--color-text-primary);
      font-family: var(--font-mono, monospace);
    }

    .category {
      margin-bottom: var(--space-8);
    }

    .category__label {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-widest);
      color: var(--color-text-muted);
      border-bottom: 1px solid var(--color-border);
      padding-bottom: var(--space-2);
      margin: 0 0 var(--space-4) 0;
    }

    .key-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: var(--space-4);
    }

    .key-card {
      padding: var(--space-4);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      transition:
        border-color 0.2s ease,
        box-shadow 0.2s ease;
    }

    .key-card:hover {
      border-color: var(--color-text-muted);
    }

    .key-card--dirty {
      border-color: var(--color-warning);
      box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-warning) 50%, transparent);
    }

    .key-card__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--space-2);
    }

    .key-card__label {
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-primary);
      margin: 0;
    }

    .key-card__status {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      padding: var(--space-0-5) var(--space-2);
    }

    .key-card__status--active {
      color: var(--color-success);
      border: 1px solid var(--color-success);
    }

    .key-card__status--empty {
      color: var(--color-text-muted);
      border: 1px solid var(--color-border);
    }

    .key-card__description {
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      line-height: 1.5;
      margin: 0 0 var(--space-3) 0;
    }

    .key-card__masked {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      margin: 0 0 var(--space-3) 0;
    }

    .key-card__input-row {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .key-card__input {
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

    .key-card__input:focus {
      outline: none;
      border-color: var(--color-danger);
      box-shadow: 0 0 0 1px var(--color-danger);
    }

    .key-card__input::placeholder {
      color: var(--color-text-muted);
      opacity: 0.6;
    }

    .key-card__toggle {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      text-transform: uppercase;
      padding: var(--space-2);
      background: none;
      border: 1px solid var(--color-border);
      color: var(--color-text-muted);
      cursor: pointer;
      transition: color 0.2s ease, border-color 0.2s ease;
      white-space: nowrap;
    }

    .key-card__toggle:hover {
      color: var(--color-text-primary);
      border-color: var(--color-text-muted);
    }

    .key-card__actions {
      display: flex;
      gap: var(--space-2);
      margin-top: var(--space-3);
    }

    .btn {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      padding: var(--space-1-5) var(--space-3);
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
      background: var(--color-danger);
      color: var(--color-text-inverse);
      border: 1px solid var(--color-danger);
    }

    .btn--save:hover:not(:disabled) {
      background: var(--color-danger-hover);
      box-shadow: 0 0 12px color-mix(in srgb, var(--color-danger) 30%, transparent);
    }

    .btn--clear {
      background: transparent;
      color: var(--color-text-secondary);
      border: 1px solid var(--color-border);
    }

    .btn--clear:hover:not(:disabled) {
      color: var(--color-danger);
      border-color: color-mix(in srgb, var(--color-danger) 50%, transparent);
    }

    .loading {
      text-align: center;
      padding: var(--space-8);
      color: var(--color-text-muted);
      font-family: var(--font-brutalist);
      text-transform: uppercase;
    }

    @media (max-width: 768px) {
      .key-grid {
        grid-template-columns: 1fr;
      }
    }
  `;

  @state() private _settings: PlatformSetting[] = [];
  @state() private _editValues: Record<string, string> = {};
  @state() private _visibleKeys: Set<string> = new Set();
  @state() private _loading = true;
  @state() private _savingKey: string | null = null;

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    await this._loadSettings();
  }

  private async _loadSettings(): Promise<void> {
    this._loading = true;
    const result = await adminApi.listSettings();
    const existingByKey = new Map<string, PlatformSetting>();
    if (result.success && result.data) {
      for (const s of result.data as PlatformSetting[]) {
        if ((API_KEY_SETTINGS as readonly string[]).includes(s.setting_key)) {
          existingByKey.set(s.setting_key, s);
        }
      }
    }
    // Build entries for ALL defined keys, even if not yet in the database
    this._settings = API_KEY_SETTINGS.map((key) => {
      const existing = existingByKey.get(key);
      return existing ?? ({ setting_key: key, setting_value: '' } as PlatformSetting);
    });
    this._editValues = {};
    for (const s of this._settings) {
      this._editValues[s.setting_key] = '';
    }
    this._loading = false;
  }

  private _getMaskedValue(key: string): string {
    const setting = this._settings.find((s) => s.setting_key === key);
    if (!setting) return '';
    const val = String(setting.setting_value).replace(/"/g, '');
    return val;
  }

  private _isConfigured(key: string): boolean {
    const masked = this._getMaskedValue(key);
    return !!masked && masked.startsWith('***');
  }

  private _isDirty(key: string): boolean {
    return this._editValues[key] !== '';
  }

  private _toggleVisibility(key: string): void {
    const next = new Set(this._visibleKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    this._visibleKeys = next;
  }

  private async _saveKey(key: string): Promise<void> {
    const value = this._editValues[key];
    if (!value) return;

    this._savingKey = key;
    const result = await adminApi.updateSetting(key, value);
    if (result.success) {
      VelgToast.success(msg(str`${key} saved.`));
    } else {
      VelgToast.error(result.error?.message ?? msg('Save failed.'));
    }
    this._savingKey = null;
    await this._loadSettings();
  }

  private async _clearKey(key: string): Promise<void> {
    this._savingKey = key;
    const result = await adminApi.updateSetting(key, '');
    if (result.success) {
      VelgToast.success(msg(str`${key} cleared.`));
    } else {
      VelgToast.error(result.error?.message ?? msg('Clear failed.'));
    }
    this._savingKey = null;
    await this._loadSettings();
  }

  protected render() {
    if (this._loading) {
      return html`<div class="loading">${msg('Loading API keys...')}</div>`;
    }

    const meta = getApiKeyMeta();
    const categories = ['ai', 'news', 'other'] as const;

    return html`
      ${categories.map((cat) => {
        const keys = this._settings.filter((s) => {
          const m = meta[s.setting_key as ApiKeySettingKey];
          return m?.category === cat;
        });
        if (keys.length === 0) return nothing;

        return html`
          <div class="category">
            <p class="category__label">${getCategoryLabel(cat)}</p>
            <div class="key-grid">
              ${keys.map((setting) => this._renderKeyCard(setting, meta[setting.setting_key as ApiKeySettingKey]))}
            </div>
          </div>
        `;
      })}
    `;
  }

  private _renderKeyCard(setting: PlatformSetting, meta: ApiKeyMeta) {
    const key = setting.setting_key;
    const configured = this._isConfigured(key);
    const dirty = this._isDirty(key);
    const saving = this._savingKey === key;
    const visible = this._visibleKeys.has(key);
    const maskedValue = this._getMaskedValue(key);

    return html`
      <div class="key-card ${dirty ? 'key-card--dirty' : ''}">
        <div class="key-card__header">
          <p class="key-card__label">${meta.label}</p>
          <span class="key-card__status ${configured ? 'key-card__status--active' : 'key-card__status--empty'}">
            ${configured ? msg('Active') : msg('Not configured')}
          </span>
        </div>
        <p class="key-card__description">${meta.description}</p>
        ${configured ? html`<p class="key-card__masked">${maskedValue}</p>` : nothing}
        <div class="key-card__input-row">
          <input
            type=${visible ? 'text' : 'password'}
            class="key-card__input"
            placeholder=${configured ? msg('Enter new key to replace') : msg('Enter API key')}
            .value=${this._editValues[key] ?? ''}
            @input=${(e: Event) => {
              this._editValues = {
                ...this._editValues,
                [key]: (e.target as HTMLInputElement).value,
              };
            }}
          />
          <button
            class="key-card__toggle"
            @click=${() => this._toggleVisibility(key)}
            title=${visible ? msg('Hide') : msg('Show')}
          >${visible ? icons.eyeOff(14) : icons.eye(14)}</button>
        </div>
        <div class="key-card__actions">
          ${
            dirty
              ? html`
                <button
                  class="btn btn--save"
                  ?disabled=${saving}
                  @click=${() => this._saveKey(key)}
                >${saving ? msg('Saving...') : msg('Save')}</button>
              `
              : nothing
          }
          ${
            configured
              ? html`
                <button
                  class="btn btn--clear"
                  ?disabled=${saving}
                  @click=${() => this._clearKey(key)}
                >${msg('Clear')}</button>
              `
              : nothing
          }
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-admin-api-keys-tab': VelgAdminApiKeysTab;
  }
}
