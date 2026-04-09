/**
 * FeaturesSettingsPanel — Toggle optional simulation features on/off.
 *
 * Uses the `simulation_settings` key-value store with category='features'.
 * Each toggle controls a boolean setting that other components (e.g. SimulationNav)
 * read from `appState.settings` to show/hide functionality.
 *
 * @element velg-features-settings-panel
 */

import { localized, msg } from '@lit/localize';
import { html, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { SettingCategory } from '../../types/index.js';
import { BaseSettingsPanel } from '../shared/BaseSettingsPanel.js';
import '../shared/VelgSectionHeader.js';
import '../shared/VelgToggle.js';
import { settingsStyles } from '../shared/settings-styles.js';

@localized()
@customElement('velg-features-settings-panel')
export class VelgFeaturesSettingsPanel extends BaseSettingsPanel {
  static styles = [settingsStyles];

  protected get category(): SettingCategory {
    return 'features';
  }

  protected get successMessage(): string {
    return msg('Feature settings saved.');
  }

  private _handleToggle(key: string, checked: boolean): void {
    this._values = { ...this._values, [key]: String(checked) };
  }

  private _isEnabled(key: string): boolean {
    return this._values[key] === 'true';
  }

  protected render() {
    if (this._loading) {
      return html`<velg-loading-state message=${msg('Loading feature settings...')}></velg-loading-state>`;
    }

    return html`
      <div class="settings-panel">
        <velg-section-header variant="large">${msg('Features')}</velg-section-header>

        ${this._error ? html`<div class="settings-panel__error">${this._error}</div>` : nothing}

        <div class="settings-form">
          <div class="settings-form__group settings-form__group--row">
            <velg-toggle
              .checked=${this._isEnabled('show_chronicle')}
              @toggle-change=${(e: CustomEvent) => this._handleToggle('show_chronicle', e.detail.checked)}
            ></velg-toggle>
            <div>
              <span class="settings-form__label">${msg('Show Chronicle')}</span>
              <span class="settings-form__hint">
                ${msg('Enable the AI-generated long-form Chronicle view alongside the Broadsheet.')}
              </span>
            </div>
          </div>
        </div>

        <div class="settings-panel__footer">
          <button
            class="settings-btn settings-btn--primary"
            @click=${this._saveSettings}
            ?disabled=${!this._hasChanges || this._saving}
          >
            ${this._saving ? msg('Saving...') : msg('Save Changes')}
          </button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-features-settings-panel': VelgFeaturesSettingsPanel;
  }
}
