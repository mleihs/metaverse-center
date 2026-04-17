/**
 * BondSettingsPanel — Agent Bonds configuration.
 *
 * Controls the bond system: enable/disable, whisper generation budget,
 * recognition threshold, max bonds per simulation.
 * Settings stored in `simulation_settings` with category='bonds'.
 *
 * Follows AutonomySettingsPanel pattern: BaseSettingsPanel, toggles,
 * range inputs, info bubbles.
 */

import { localized, msg } from '@lit/localize';
import { css, html, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';

import { forgeStateManager } from '../../services/ForgeStateManager.js';
import { BaseSettingsPanel } from '../shared/BaseSettingsPanel.js';
import { infoBubbleStyles, renderInfoBubble } from '../shared/info-bubble-styles.js';
import { settingsStyles } from '../shared/settings-styles.js';
import '../shared/VelgSectionHeader.js';
import '../shared/VelgToggle.js';

@localized()
@customElement('velg-bond-settings-panel')
export class VelgBondSettingsPanel extends BaseSettingsPanel {
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

      .range-row {
        display: flex;
        align-items: center;
        gap: var(--space-3);
      }

      .range-row__input {
        flex: 1;
        accent-color: var(--color-primary);
      }

      .range-row__value {
        font-family: var(--font-mono);
        font-size: var(--text-sm);
        font-weight: 700;
        color: var(--color-text-primary);
        min-width: 36px;
        text-align: right;
      }

      .cost-note {
        font-family: var(--font-mono);
        font-size: 10px;
        color: var(--color-text-muted);
        padding: var(--space-2) var(--space-3);
        background: var(--color-surface-sunken);
        border: 1px solid var(--color-border-light);
        margin-top: var(--space-2);
      }

      @media (max-width: 640px) {
        .toggle-row { min-height: 44px; }
        .range-row__input { min-height: 44px; }
      }
    `,
  ];

  protected get category() {
    return 'bonds' as const;
  }

  protected get successMessage(): string {
    return msg('Bond settings saved.');
  }

  private get _enabled(): boolean {
    return this._values.bonds_enabled !== 'false';
  }

  private get _hasKey(): boolean {
    return forgeStateManager.byokStatus.value.has_openrouter_key;
  }

  private _handleToggle(key: string, checked: boolean): void {
    this._values = { ...this._values, [key]: String(checked) };
  }

  private _handleRange(key: string, e: Event): void {
    const value = (e.target as HTMLInputElement).value;
    this._values = { ...this._values, [key]: value };
  }

  protected render() {
    if (this._loading) {
      return html`<velg-loading-state
        message=${msg('Loading bond settings...')}
      ></velg-loading-state>`;
    }

    return html`
      <div class="settings-panel">
        ${this._error
          ? html`<div class="settings-panel__error">${this._error}</div>`
          : nothing}

        <!-- Master Toggle -->
        <div class="settings-section">
          <velg-section-header variant="large">
            ${msg('Agent Bonds')}
          </velg-section-header>
          <p class="settings-section__help">
            ${msg(
              'Agent Bonds let players form emotional connections with specific agents. Bonded agents generate whispers \u2013 short, mood-dependent messages reflecting their inner lives. This creates a gentle daily check-in loop without loss aversion.',
            )}
          </p>

          <div class="toggle-row">
            <velg-toggle
              .checked=${this._enabled}
              @toggle-change=${(e: CustomEvent) =>
                this._handleToggle('bonds_enabled', e.detail.checked)}
            ></velg-toggle>
            <span class="toggle-row__label">
              ${msg('Enable Agent Bonds')}
              ${renderInfoBubble(
                msg(
                  'When enabled, players can form bonds with agents by visiting their detail pages repeatedly. After enough attention, the agent offers a bond. Bonded agents then generate whispers during each heartbeat tick.',
                ),
              )}
            </span>
          </div>
        </div>

        ${this._enabled ? this._renderOptions() : nothing}

        <div class="settings-panel__footer">
          <button
            class="settings-btn settings-btn--primary"
            @click=${this._saveSettings}
            ?disabled=${!this._hasChanges || this._saving}
          >
            ${this._saving ? msg('Saving...') : msg('Save Bond Settings')}
          </button>
        </div>
      </div>
    `;
  }

  private _renderOptions() {
    const whisperBudget =
      Number(this._values.bond_whisper_budget) || 3;
    const maxBonds =
      Number(this._values.bond_max_per_simulation) || 5;
    const recognitionThreshold =
      Number(this._values.bond_recognition_threshold) || 10;

    return html`
      <!-- Whisper Generation -->
      <div class="settings-section">
        <velg-section-header variant="large">
          ${msg('Whisper Generation')}
        </velg-section-header>

        <div class="settings-form__group">
          <label class="settings-form__label settings-form__label--xs">
            ${msg('LLM Budget per Tick')}
            ${renderInfoBubble(
              msg(
                'Maximum LLM calls for whisper generation per heartbeat tick (6 ticks/day). Higher values mean more personalized whispers but higher API cost. When budget is exhausted, the system falls back to hand-authored templates. Range: 0 (templates only) to 10.',
              ),
            )}
          </label>
          <div class="range-row">
            <input
              class="range-row__input"
              type="range"
              min="0"
              max="10"
              step="1"
              .value=${String(whisperBudget)}
              @input=${(e: Event) =>
                this._handleRange('bond_whisper_budget', e)}
            />
            <span class="range-row__value">${whisperBudget}</span>
          </div>
          <div class="cost-note">
            ${whisperBudget === 0
              ? msg('Templates only \u2013 zero AI cost')
              : msg(
                  `Up to ${whisperBudget * 6} LLM whispers/day across all bonds`,
                )}
          </div>
        </div>

        ${!this._hasKey
          ? html`
              <div class="cost-note" style="color: var(--color-warning)">
                ${msg(
                  'No OpenRouter key configured. Whispers will use hand-authored templates only. Add a key in The Mint to enable AI-generated whispers.',
                )}
              </div>
            `
          : nothing}
      </div>

      <!-- Bond Mechanics -->
      <div class="settings-section">
        <velg-section-header variant="large">
          ${msg('Bond Mechanics')}
        </velg-section-header>

        <div class="settings-form__group">
          <label class="settings-form__label settings-form__label--xs">
            ${msg('Max Bonds per Simulation')}
            ${renderInfoBubble(
              msg(
                'Maximum number of active bonds a player can maintain in this simulation. Lower values force meaningful choice about which agents to bond with. Range: 1 to 10. Default: 5.',
              ),
            )}
          </label>
          <div class="range-row">
            <input
              class="range-row__input"
              type="range"
              min="1"
              max="10"
              step="1"
              .value=${String(maxBonds)}
              @input=${(e: Event) =>
                this._handleRange('bond_max_per_simulation', e)}
            />
            <span class="range-row__value">${maxBonds}</span>
          </div>
        </div>

        <div class="settings-form__group">
          <label class="settings-form__label settings-form__label--xs">
            ${msg('Recognition Threshold')}
            ${renderInfoBubble(
              msg(
                'Number of agent detail page visits required before an agent recognizes the player and offers a bond. Lower values make bonds easier to form. The observation period (14 days) still applies. Range: 3 to 30. Default: 10.',
              ),
            )}
          </label>
          <div class="range-row">
            <input
              class="range-row__input"
              type="range"
              min="3"
              max="30"
              step="1"
              .value=${String(recognitionThreshold)}
              @input=${(e: Event) =>
                this._handleRange('bond_recognition_threshold', e)}
            />
            <span class="range-row__value">${recognitionThreshold}</span>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-bond-settings-panel': VelgBondSettingsPanel;
  }
}
