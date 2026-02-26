import { localized, msg, str } from '@lit/localize';
import { css, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { settingsApi } from '../../services/api/index.js';
import { BaseSettingsPanel } from '../shared/BaseSettingsPanel.js';
import { VelgToast } from '../shared/Toast.js';
import '../shared/VelgSectionHeader.js';
import { settingsStyles } from '../shared/settings-styles.js';

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

function getSections(): IntegrationSection[] {
  return [
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
}

@localized()
@customElement('velg-integration-settings-panel')
export class VelgIntegrationSettingsPanel extends BaseSettingsPanel {
  static styles = [
    settingsStyles,
    css`
      .int-section {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
        padding: var(--space-4);
        border: var(--border-default);
        background: var(--color-surface);
      }

      .int-section__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
      }
    `,
  ];

  protected get category() {
    return 'integration' as const;
  }

  @state() private _savingSections: Set<string> = new Set();

  /** Track which fields came back with encrypted/masked values from the server. */
  @state() private _maskedFields: Set<string> = new Set();

  protected override async _loadSettings(): Promise<void> {
    if (!this.simulationId) return;

    this._loading = true;
    this._error = null;

    try {
      const response = await settingsApi.list(this.simulationId, 'integration');

      if (response.success && response.data) {
        const settings = response.data as import('../../types/index.js').SimulationSetting[];
        const vals: Record<string, string> = {};
        const masked = new Set<string>();

        for (const setting of settings) {
          const val = String(setting.setting_value ?? '');
          vals[setting.setting_key] = val;

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

  protected override _handleInput(key: string, e: Event): void {
    const target = e.target as HTMLInputElement;
    const newValue = target.value;
    this._values = { ...this._values, [key]: newValue };

    // Once user types a real value into a masked field, unmark it
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

  private _hasSectionChanges(section: IntegrationSection): boolean {
    return section.fields.some(
      (f) => (this._values[f.key] ?? '') !== (this._originalValues[f.key] ?? ''),
    );
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
        <div class="settings-form__group settings-form__group--row">
          <label class="settings-toggle">
            <input
              class="settings-toggle__input"
              type="checkbox"
              ?checked=${checked}
              @change=${(e: Event) => this._handleToggle(field.key, e)}
            />
            <span class="settings-toggle__slider"></span>
          </label>
          <span class="settings-form__label settings-form__label--xs">${field.label}</span>
        </div>
      `;
    }

    const isMasked = this._maskedFields.has(field.key);
    const displayValue = this._values[field.key] ?? '';

    return html`
      <div class="settings-form__group">
        <label class="settings-form__label settings-form__label--xs" for="int-${field.key}">${field.label}</label>
        <input
          class="settings-form__input settings-form__input--sm ${isMasked ? 'settings-form__input--masked' : ''}"
          id="int-${field.key}"
          type=${field.type}
          placeholder=${field.placeholder ?? ''}
          .value=${displayValue}
          @input=${(e: Event) => this._handleInput(field.key, e)}
        />
        ${field.sensitive ? html`<span class="settings-sensitive-hint">${msg('Values are encrypted at rest')}</span>` : nothing}
      </div>
    `;
  }

  protected render() {
    if (this._loading) {
      return html`<velg-loading-state message=${msg('Loading integration settings...')}></velg-loading-state>`;
    }

    return html`
      <div class="settings-panel settings-panel--wide">
        ${this._error ? html`<div class="settings-panel__error">${this._error}</div>` : nothing}

        ${getSections().map(
          (section) => html`
            <div class="int-section">
              <div class="int-section__header">
                <velg-section-header variant="large">${section.title}</velg-section-header>
                <button
                  class="settings-btn settings-btn--primary settings-btn--sm"
                  @click=${() => this._handleSaveSection(section)}
                  ?disabled=${!this._hasSectionChanges(section) || this._savingSections.has(section.id)}
                >
                  ${this._savingSections.has(section.id) ? msg('Saving...') : msg('Save')}
                </button>
              </div>
              <div class="settings-form">
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
