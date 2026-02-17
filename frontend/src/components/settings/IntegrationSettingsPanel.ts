import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { settingsApi } from '../../services/api/index.js';
import type { SimulationSetting } from '../../types/index.js';
import { VelgToast } from '../shared/Toast.js';
import '../shared/VelgSectionHeader.js';

interface IntegrationSection {
  id: string;
  title: string;
  fields: IntegrationField[];
}

interface IntegrationField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'toggle';
  placeholder?: string;
  sensitive?: boolean;
}

const SECTIONS: IntegrationSection[] = [
  {
    id: 'facebook',
    title: msg('Facebook Integration'),
    fields: [
      {
        key: 'facebook_page_id',
        label: msg('Page ID'),
        type: 'text',
        placeholder: msg('Enter Facebook Page ID...'),
      },
      {
        key: 'facebook_access_token',
        label: msg('Access Token'),
        type: 'password',
        placeholder: msg('Enter access token...'),
        sensitive: true,
      },
      {
        key: 'facebook_api_version',
        label: msg('API Version'),
        type: 'text',
        placeholder: 'v19.0',
      },
      { key: 'facebook_enabled', label: msg('Enabled'), type: 'toggle' },
    ],
  },
  {
    id: 'guardian',
    title: msg('The Guardian API'),
    fields: [
      {
        key: 'guardian_api_key',
        label: msg('API Key'),
        type: 'password',
        placeholder: msg('Enter Guardian API key...'),
        sensitive: true,
      },
      { key: 'guardian_enabled', label: msg('Enabled'), type: 'toggle' },
    ],
  },
  {
    id: 'newsapi',
    title: msg('NewsAPI'),
    fields: [
      {
        key: 'newsapi_api_key',
        label: msg('API Key'),
        type: 'password',
        placeholder: msg('Enter NewsAPI key...'),
        sensitive: true,
      },
      { key: 'newsapi_enabled', label: msg('Enabled'), type: 'toggle' },
    ],
  },
  {
    id: 'ai_providers',
    title: msg('AI Provider Overrides'),
    fields: [
      {
        key: 'openrouter_api_key',
        label: msg('OpenRouter API Key'),
        type: 'password',
        placeholder: msg('Enter OpenRouter key...'),
        sensitive: true,
      },
      {
        key: 'replicate_api_key',
        label: msg('Replicate API Key'),
        type: 'password',
        placeholder: msg('Enter Replicate key...'),
        sensitive: true,
      },
    ],
  },
];

@localized()
@customElement('velg-integration-settings-panel')
export class VelgIntegrationSettingsPanel extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .panel {
      display: flex;
      flex-direction: column;
      gap: var(--space-6);
    }

    .section {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      padding: var(--space-4);
      border: var(--border-default);
      background: var(--color-surface);
    }

    .section__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
    }

    .section__save-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-1-5) var(--space-3);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      border: var(--border-default);
      box-shadow: var(--shadow-sm);
      cursor: pointer;
      transition: all var(--transition-fast);
      background: var(--color-primary);
      color: var(--color-text-inverse);
    }

    .section__save-btn:hover {
      transform: translate(-1px, -1px);
      box-shadow: var(--shadow-md);
    }

    .section__save-btn:active {
      transform: translate(0);
      box-shadow: var(--shadow-pressed);
    }

    .section__save-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    }

    .form {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .form__group {
      display: flex;
      flex-direction: column;
      gap: var(--space-1-5);
    }

    .form__group--toggle {
      flex-direction: row;
      align-items: center;
      gap: var(--space-3);
    }

    .form__label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-primary);
    }

    .form__input {
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      padding: var(--space-2) var(--space-3);
      border: var(--border-medium);
      background: var(--color-surface);
      color: var(--color-text-primary);
      width: 100%;
      box-sizing: border-box;
      transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
    }

    .form__input:focus {
      outline: none;
      border-color: var(--color-border-focus);
      box-shadow: var(--ring-focus);
    }

    .form__input::placeholder {
      color: var(--color-text-muted);
    }

    .form__input--masked {
      font-family: monospace;
      letter-spacing: 2px;
    }

    .toggle {
      position: relative;
      display: inline-block;
      width: 44px;
      height: 24px;
      flex-shrink: 0;
    }

    .toggle__input {
      opacity: 0;
      width: 0;
      height: 0;
      position: absolute;
    }

    .toggle__slider {
      position: absolute;
      cursor: pointer;
      inset: 0;
      background: var(--color-surface-sunken);
      border: var(--border-width-default) solid var(--color-border);
      transition: all var(--transition-fast);
    }

    .toggle__slider::before {
      content: '';
      position: absolute;
      height: 16px;
      width: 16px;
      left: 3px;
      bottom: 3px;
      background: var(--color-text-muted);
      transition: all var(--transition-fast);
    }

    .toggle__input:checked + .toggle__slider {
      background: var(--color-primary);
      border-color: var(--color-primary);
    }

    .toggle__input:checked + .toggle__slider::before {
      transform: translateX(20px);
      background: var(--color-text-inverse);
    }

    .toggle__input:focus + .toggle__slider {
      box-shadow: var(--ring-focus);
    }

    .sensitive-hint {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      font-family: var(--font-sans);
    }

    .panel__error {
      padding: var(--space-3);
      background: var(--color-danger-bg);
      border: var(--border-width-default) solid var(--color-danger);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      color: var(--color-danger);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
    }
  `;

  @property({ type: String }) simulationId = '';

  @state() private _values: Record<string, string> = {};
  @state() private _originalValues: Record<string, string> = {};
  @state() private _loading = true;
  @state() private _savingSections: Set<string> = new Set();
  @state() private _error: string | null = null;

  /** Track which fields came back with encrypted/masked values from the server. */
  @state() private _maskedFields: Set<string> = new Set();

  protected willUpdate(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('simulationId') && this.simulationId) {
      this._loadSettings();
    }
  }

  protected updated(changedProperties: Map<PropertyKey, unknown>): void {
    super.updated(changedProperties);
    const prevValues = changedProperties.get('_values') as Record<string, string> | undefined;
    if (prevValues !== undefined) {
      const hasChanges = this._hasAnyChanges();
      this.dispatchEvent(
        new CustomEvent('unsaved-change', {
          detail: hasChanges,
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  private _hasAnyChanges(): boolean {
    const keys = new Set([...Object.keys(this._values), ...Object.keys(this._originalValues)]);
    for (const key of keys) {
      if ((this._values[key] ?? '') !== (this._originalValues[key] ?? '')) {
        return true;
      }
    }
    return false;
  }

  private _hasSectionChanges(section: IntegrationSection): boolean {
    return section.fields.some(
      (f) => (this._values[f.key] ?? '') !== (this._originalValues[f.key] ?? ''),
    );
  }

  private async _loadSettings(): Promise<void> {
    if (!this.simulationId) return;

    this._loading = true;
    this._error = null;

    try {
      const response = await settingsApi.list(this.simulationId, 'integration');

      if (response.success && response.data) {
        const settings = response.data as SimulationSetting[];
        const vals: Record<string, string> = {};
        const masked = new Set<string>();

        for (const setting of settings) {
          const val = String(setting.setting_value ?? '');
          vals[setting.setting_key] = val;

          // Detect encrypted/masked values from server
          if (val.startsWith('***')) {
            masked.add(setting.setting_key);
          }
        }

        this._values = { ...vals };
        this._originalValues = { ...vals };
        this._maskedFields = masked;
      } else {
        this._error = response.error?.message ?? msg('Failed to load integration settings');
      }
    } catch (err) {
      this._error = err instanceof Error ? err.message : msg('An unknown error occurred');
    } finally {
      this._loading = false;
    }
  }

  private _handleInput(key: string, e: Event): void {
    const target = e.target as HTMLInputElement;
    const newValue = target.value;
    this._values = { ...this._values, [key]: newValue };

    // Once user types a real (non-empty) value into a masked field, unmark it
    if (this._maskedFields.has(key) && newValue && !newValue.startsWith('***')) {
      const updated = new Set(this._maskedFields);
      updated.delete(key);
      this._maskedFields = updated;
    }
  }

  private _handleToggle(key: string, e: Event): void {
    const target = e.target as HTMLInputElement;
    this._values = { ...this._values, [key]: target.checked ? 'true' : 'false' };
  }

  private async _handleSaveSection(section: IntegrationSection): Promise<void> {
    if (this._savingSections.has(section.id)) return;

    const updated = new Set(this._savingSections);
    updated.add(section.id);
    this._savingSections = updated;
    this._error = null;

    try {
      for (const field of section.fields) {
        const currentVal = this._values[field.key] ?? '';
        const origVal = this._originalValues[field.key] ?? '';

        // Skip unchanged fields and skip masked fields that user has not edited
        if (currentVal === origVal) continue;
        if (this._maskedFields.has(field.key)) continue;

        const response = await settingsApi.upsert(this.simulationId, {
          category: 'integration',
          setting_key: field.key,
          setting_value: currentVal,
        });

        if (!response.success) {
          this._error = response.error?.message ?? msg(str`Failed to save ${field.label}`);
          VelgToast.error(msg(str`Failed to save ${field.label}`));
          return;
        }
      }

      // Update originals for this section
      const newOriginals = { ...this._originalValues };
      for (const field of section.fields) {
        newOriginals[field.key] = this._values[field.key] ?? '';
      }
      this._originalValues = newOriginals;

      VelgToast.success(msg(str`${section.title} settings saved.`));
      this.dispatchEvent(new CustomEvent('settings-saved', { bubbles: true, composed: true }));
    } catch (err) {
      this._error = err instanceof Error ? err.message : msg('An unknown error occurred');
      VelgToast.error(this._error);
    } finally {
      const removed = new Set(this._savingSections);
      removed.delete(section.id);
      this._savingSections = removed;
    }
  }

  private _renderField(field: IntegrationField) {
    if (field.type === 'toggle') {
      const checked = this._values[field.key] === 'true';
      return html`
        <div class="form__group form__group--toggle">
          <label class="toggle">
            <input
              class="toggle__input"
              type="checkbox"
              ?checked=${checked}
              @change=${(e: Event) => this._handleToggle(field.key, e)}
            />
            <span class="toggle__slider"></span>
          </label>
          <span class="form__label">${field.label}</span>
        </div>
      `;
    }

    const isMasked = this._maskedFields.has(field.key);
    const displayValue = this._values[field.key] ?? '';

    return html`
      <div class="form__group">
        <label class="form__label" for="int-${field.key}">${field.label}</label>
        <input
          class="form__input ${isMasked ? 'form__input--masked' : ''}"
          id="int-${field.key}"
          type=${field.type}
          placeholder=${field.placeholder ?? ''}
          .value=${displayValue}
          @input=${(e: Event) => this._handleInput(field.key, e)}
        />
        ${field.sensitive ? html`<span class="sensitive-hint">${msg('Values are encrypted at rest')}</span>` : nothing}
      </div>
    `;
  }

  protected render() {
    if (this._loading) {
      return html`<velg-loading-state message=${msg('Loading integration settings...')}></velg-loading-state>`;
    }

    return html`
      <div class="panel">
        ${this._error ? html`<div class="panel__error">${this._error}</div>` : nothing}

        ${SECTIONS.map(
          (section) => html`
            <div class="section">
              <div class="section__header">
                <velg-section-header variant="large">${section.title}</velg-section-header>
                <button
                  class="section__save-btn"
                  @click=${() => this._handleSaveSection(section)}
                  ?disabled=${!this._hasSectionChanges(section) || this._savingSections.has(section.id)}
                >
                  ${this._savingSections.has(section.id) ? msg('Saving...') : msg('Save')}
                </button>
              </div>
              <div class="form">
                ${section.fields.map((field) => this._renderField(field))}
              </div>
            </div>
          `,
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-integration-settings-panel': VelgIntegrationSettingsPanel;
  }
}
