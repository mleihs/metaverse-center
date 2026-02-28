import { localized, msg } from '@lit/localize';
import { css, html, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { BaseSettingsPanel } from '../shared/BaseSettingsPanel.js';
import '../shared/VelgSectionHeader.js';
import { infoBubbleStyles, renderInfoBubble } from '../shared/info-bubble-styles.js';
import { settingsStyles } from '../shared/settings-styles.js';

/**
 * Bleed mechanics settings panel — controls cross-simulation event propagation.
 *
 * Settings stored in `simulation_settings` with category='world':
 * - bleed_enabled (bool) — Master toggle
 * - bleed_min_impact (int 1-10) — Minimum event impact for bleed
 * - bleed_max_depth (int 1-3) — Maximum echo cascade depth
 * - bleed_strength_decay (float 0-1) — Strength decay per cascade level
 * - bleed_auto_approve (bool) — Auto-approve incoming echoes
 */

@localized()
@customElement('velg-bleed-settings-panel')
export class VelgBleedSettingsPanel extends BaseSettingsPanel {
  static styles = [
    settingsStyles,
    infoBubbleStyles,
    css`
      .bleed-toggle-row {
        display: flex;
        align-items: center;
        gap: var(--space-3);
      }

      .bleed-toggle-row__label {
        font-family: var(--font-brutalist);
        font-weight: var(--font-black);
        font-size: var(--text-sm);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        color: var(--color-text-primary);
      }

      .bleed-disabled-notice {
        padding: var(--space-3);
        background: var(--color-surface-sunken);
        border: var(--border-default);
        font-family: var(--font-sans);
        font-size: var(--text-sm);
        color: var(--color-text-muted);
        line-height: 1.5;
      }

      .bleed-range {
        display: flex;
        align-items: center;
        gap: var(--space-3);
      }

      .bleed-range__input {
        flex: 1;
        accent-color: var(--color-primary);
      }

      .bleed-range__value {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm);
        font-weight: 700;
        color: var(--color-text-primary);
        min-width: 32px;
        text-align: right;
      }
    `,
  ];

  protected get category() {
    return 'world' as const;
  }

  protected get successMessage(): string {
    return msg('Bleed settings saved successfully.');
  }

  private get _bleedEnabled(): boolean {
    return this._values.bleed_enabled !== 'false';
  }

  private _handleToggle(key: string, e: Event): void {
    const checked = (e.target as HTMLInputElement).checked;
    this._values = { ...this._values, [key]: String(checked) };
  }

  private _handleRange(key: string, e: Event): void {
    const value = (e.target as HTMLInputElement).value;
    this._values = { ...this._values, [key]: value };
  }

  protected render() {
    if (this._loading) {
      return html`<velg-loading-state message=${msg('Loading bleed settings...')}></velg-loading-state>`;
    }

    return html`
      <div class="settings-panel">
        ${this._error ? html`<div class="settings-panel__error">${this._error}</div>` : nothing}

        <!-- Master Toggle -->
        <div class="settings-section">
          <velg-section-header variant="large">${msg('Bleed Mechanics')}</velg-section-header>
          <p class="settings-section__help">
            ${msg('Control how events propagate between connected simulations through the multiverse.')}
          </p>

          <div class="bleed-toggle-row">
            <label class="settings-toggle">
              <input
                class="settings-toggle__input"
                type="checkbox"
                .checked=${this._bleedEnabled}
                @change=${(e: Event) => this._handleToggle('bleed_enabled', e)}
              />
              <span class="settings-toggle__slider"></span>
            </label>
            <span class="bleed-toggle-row__label">
              ${msg('Enable Bleed')}
              ${renderInfoBubble(msg('Master switch for cross-simulation event propagation. When disabled, no events from this simulation will echo to other worlds, and no incoming echoes will be accepted.'))}
            </span>
          </div>
        </div>

        ${
          this._bleedEnabled
            ? this._renderBleedOptions()
            : html`
          <div class="bleed-disabled-notice">
            ${msg('Bleed is disabled. Events will not propagate to or from connected simulations. Enable bleed to configure echo thresholds, cascade depth, and strength decay.')}
          </div>
        `
        }

        <div class="settings-panel__footer">
          <button
            class="settings-btn settings-btn--primary"
            @click=${this._saveSettings}
            ?disabled=${!this._hasChanges || this._saving}
          >
            ${this._saving ? msg('Saving...') : msg('Save Bleed Settings')}
          </button>
        </div>
      </div>
    `;
  }

  private _renderBleedOptions() {
    const minImpact = Number(this._values.bleed_min_impact) || 8;
    const maxDepth = Number(this._values.bleed_max_depth) || 2;
    const decay = Number(this._values.bleed_strength_decay) || 0.6;
    const autoApprove = this._values.bleed_auto_approve === 'true';

    return html`
      <!-- Threshold -->
      <div class="settings-section">
        <velg-section-header variant="large">${msg('Echo Threshold')}</velg-section-header>

        <div class="settings-form__group">
          <label class="settings-form__label settings-form__label--xs">
            ${msg('Minimum Impact for Bleed')}
            ${renderInfoBubble(msg('Minimum event impact level (1-10) required to trigger an echo. Can be effectively lowered by: unstable zones (-1), effective embassies (-1). Floor: 5.'))}
          </label>
          <div class="bleed-range">
            <input
              class="bleed-range__input"
              type="range"
              min="1"
              max="10"
              step="1"
              .value=${String(minImpact)}
              @input=${(e: Event) => this._handleRange('bleed_min_impact', e)}
            />
            <span class="bleed-range__value">${minImpact}</span>
          </div>
          <span class="settings-form__hint">
            ${msg('Events with impact below this threshold may still bleed probabilistically if zone stability is low or embassy effectiveness is high.')}
          </span>
        </div>
      </div>

      <!-- Cascade -->
      <div class="settings-section">
        <velg-section-header variant="large">${msg('Cascade Behavior')}</velg-section-header>

        <div class="settings-form__group">
          <label class="settings-form__label settings-form__label--xs">
            ${msg('Maximum Cascade Depth')}
            ${renderInfoBubble(msg('How many times an echo can re-echo (1-3). Depth 1: direct echo only. Depth 2: echoes of echoes. Depth 3: maximum — reality fractures deeply. Each depth level applies strength decay.'))}
          </label>
          <div class="bleed-range">
            <input
              class="bleed-range__input"
              type="range"
              min="1"
              max="3"
              step="1"
              .value=${String(maxDepth)}
              @input=${(e: Event) => this._handleRange('bleed_max_depth', e)}
            />
            <span class="bleed-range__value">${maxDepth}</span>
          </div>
        </div>

        <div class="settings-form__group">
          <label class="settings-form__label settings-form__label--xs">
            ${msg('Strength Decay per Depth')}
            ${renderInfoBubble(msg('Multiplier applied per cascade depth (0-1). At 0.6: depth 1 = 60% strength, depth 2 = 36%, depth 3 = 22%. Lower values = echoes fade faster across hops.'))}
          </label>
          <div class="bleed-range">
            <input
              class="bleed-range__input"
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              .value=${String(decay)}
              @input=${(e: Event) => this._handleRange('bleed_strength_decay', e)}
            />
            <span class="bleed-range__value">${decay.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <!-- Approval -->
      <div class="settings-section">
        <velg-section-header variant="large">${msg('Echo Approval')}</velg-section-header>

        <div class="bleed-toggle-row">
          <label class="settings-toggle">
            <input
              class="settings-toggle__input"
              type="checkbox"
              .checked=${autoApprove}
              @change=${(e: Event) => this._handleToggle('bleed_auto_approve', e)}
            />
            <span class="settings-toggle__slider"></span>
          </label>
          <span class="bleed-toggle-row__label">
            ${msg('Auto-Approve Incoming Echoes')}
            ${renderInfoBubble(msg('When enabled, incoming echoes skip pending status and immediately begin AI generation. When disabled, an admin must approve each echo before it manifests.'))}
          </span>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-bleed-settings-panel': VelgBleedSettingsPanel;
  }
}
