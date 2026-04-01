/**
 * AutonomySettingsPanel — Agent autonomy configuration.
 *
 * Controls the Living World system: agent needs, mood, opinions,
 * activity selection, social interactions, and autonomous events.
 * All settings stored in `simulation_settings` with category='autonomy'.
 *
 * Every input has a detailed info bubble explaining the mechanic,
 * its range, and its gameplay impact.
 */

import { localized, msg } from '@lit/localize';
import { css, html, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { forgeStateManager } from '../../services/ForgeStateManager.js';
import { BaseSettingsPanel } from '../shared/BaseSettingsPanel.js';
import '../shared/VelgSectionHeader.js';
import '../shared/VelgToggle.js';
import { infoBubbleStyles, renderInfoBubble } from '../shared/info-bubble-styles.js';
import { settingsStyles } from '../shared/settings-styles.js';

@localized()
@customElement('velg-autonomy-settings-panel')
export class VelgAutonomySettingsPanel extends BaseSettingsPanel {
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

      .disabled-notice {
        padding: var(--space-3);
        background: var(--color-surface-sunken);
        border: var(--border-default);
        font-family: var(--font-body);
        font-size: var(--text-sm);
        color: var(--color-text-muted);
        line-height: 1.5;
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
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm);
        font-weight: 700;
        color: var(--color-text-primary);
        min-width: 36px;
        text-align: right;
      }

      .model-select {
        width: 100%;
        padding: var(--space-2) var(--space-3);
        background: var(--color-surface);
        border: var(--border-default);
        color: var(--color-text-primary);
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm);
      }

      .cost-estimate {
        font-family: var(--font-mono, monospace);
        font-size: 10px;
        color: var(--color-text-muted);
        padding: var(--space-2) var(--space-3);
        background: var(--color-surface-sunken);
        border: 1px solid var(--color-border-light);
        margin-top: var(--space-2);
      }

      @media (max-width: 640px) {
        :host {
          padding: var(--space-3);
        }

        .toggle-row {
          min-height: 44px;
        }

        .range-row__input {
          min-height: 44px;
        }

        .model-select {
          min-height: 44px;
          font-size: 16px; /* Prevent iOS zoom */
        }
      }
    `,
  ];

  private _byokLoaded = false;

  protected get category() {
    return 'autonomy' as const;
  }

  protected get successMessage(): string {
    return msg('Autonomy settings saved.');
  }

  private get _enabled(): boolean {
    return this._values.agent_autonomy_enabled === 'true';
  }

  /** Admin activated autonomy globally or for this specific simulation. */
  private get _adminActivated(): boolean {
    return this._values.autonomy_admin_override === 'true';
  }

  /** User has a personal OpenRouter BYOK key. */
  private get _hasKey(): boolean {
    return forgeStateManager.byokStatus.value.has_openrouter_key;
  }

  /** Can the user toggle autonomy on? */
  private get _canEnable(): boolean {
    // Either admin has activated it (platform key covers cost)
    // or user has their own BYOK key
    return this._adminActivated || this._hasKey;
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (!this._byokLoaded) {
      forgeStateManager.loadWallet().then(() => {
        this._byokLoaded = true;
        this.requestUpdate();
      });
    }
  }

  private _handleToggle(key: string, checked: boolean): void {
    this._values = { ...this._values, [key]: String(checked) };
  }

  private _handleRange(key: string, e: Event): void {
    const value = (e.target as HTMLInputElement).value;
    this._values = { ...this._values, [key]: value };
  }

  private _handleSelect(key: string, e: Event): void {
    const value = (e.target as HTMLSelectElement).value;
    this._values = { ...this._values, [key]: value };
  }

  protected render() {
    if (this._loading) {
      return html`<velg-loading-state message=${msg('Loading autonomy settings...')}></velg-loading-state>`;
    }

    return html`
      <div class="settings-panel">
        ${this._error ? html`<div class="settings-panel__error">${this._error}</div>` : nothing}

        <!-- Master Toggle -->
        <div class="settings-section">
          <velg-section-header variant="large">${msg('Agent Autonomy')}</velg-section-header>
          <p class="settings-section__help">
            ${msg('When enabled, agents act autonomously between player sessions: forming opinions, pursuing activities, reacting to events, and generating social dynamics. The world lives while you are away.')}
          </p>

          ${
            this._canEnable
              ? html`
            <div class="toggle-row">
              <velg-toggle
                .checked=${this._enabled}
                @toggle-change=${(e: CustomEvent) => this._handleToggle('agent_autonomy_enabled', e.detail.checked)}
              ></velg-toggle>
              <span class="toggle-row__label">
                ${msg('Enable Living World')}
                ${
                  this._adminActivated
                    ? renderInfoBubble(
                        msg(
                          'Autonomy has been activated by the platform admin. AI narrative costs are covered by the platform. You can toggle it on or off for this simulation.',
                        ),
                      )
                    : renderInfoBubble(
                        msg(
                          'You are using your personal OpenRouter API key to power agent autonomy. AI narrative generation (autonomous events, morning briefings) will use your key. Rule-based mechanics (needs, mood, opinions, activity selection) have zero AI cost.',
                        ),
                      )
                }
              </span>
            </div>

            ${
              this._adminActivated && !this._hasKey
                ? html`
              <p class="settings-section__help" style="color: var(--color-info)">
                ${msg('AI costs are covered by the platform admin. No personal API key required.')}
              </p>
            `
                : nothing
            }
          `
              : html`
            <div class="disabled-notice">
              ${msg('Agent autonomy requires an OpenRouter API key to power AI narrative generation (autonomous events, morning briefings). You can add your personal key in your profile settings under "API Keys". Rule-based mechanics have zero AI cost, but the feature needs a key to be activated.')}
              ${renderInfoBubble(msg('The platform admin can also activate autonomy globally, which covers AI costs with the platform key. Contact your admin to request activation for this simulation.'))}
            </div>
          `
          }
        </div>

        ${this._enabled && this._canEnable ? this._renderOptions() : nothing}

        ${
          !this._enabled && this._canEnable
            ? html`
          <div class="disabled-notice">
            ${msg('Agent autonomy is disabled for this simulation. Toggle the switch above to activate the Living World system.')}
          </div>
        `
            : nothing
        }

        <div class="settings-panel__footer">
          <button
            class="settings-btn settings-btn--primary"
            @click=${this._saveSettings}
            ?disabled=${!this._hasChanges || this._saving}
          >
            ${this._saving ? msg('Saving...') : msg('Save Autonomy Settings')}
          </button>
        </div>
      </div>
    `;
  }

  private _renderOptions() {
    const needsRate = Number(this._values.autonomy_needs_decay_rate) || 1.0;
    const socialRate = Number(this._values.autonomy_social_interaction_rate) || 1.0;
    const eventThreshold = Number(this._values.autonomy_event_threshold) || 0.5;
    const llmBudget = Number(this._values.autonomy_llm_budget_per_tick) || 5;
    const stressCascade = this._values.autonomy_stress_cascade_enabled !== 'false';
    const autoRelationships = this._values.autonomy_relationship_auto_create !== 'false';
    const briefingMode = this._values.autonomy_briefing_mode || 'narrative';

    return html`
      <!-- Simulation Speed -->
      <div class="settings-section">
        <velg-section-header variant="large">${msg('Simulation Speed')}</velg-section-header>

        <div class="settings-form__group">
          <label class="settings-form__label settings-form__label--xs">
            ${msg('Needs Decay Rate')}
            ${renderInfoBubble(msg('Multiplier for how quickly agent needs (social, purpose, safety, comfort, stimulation) decrease each tick. At 1.0: standard rate. At 2.0: agents get restless twice as fast, creating more activity. At 0.5: agents are more content, fewer urgent decisions. Range: 0.1 to 3.0.'))}
          </label>
          <div class="range-row">
            <input
              class="range-row__input"
              type="range"
              min="0.1"
              max="3.0"
              step="0.1"
              .value=${String(needsRate)}
              @input=${(e: Event) => this._handleRange('autonomy_needs_decay_rate', e)}
            />
            <span class="range-row__value">${needsRate.toFixed(1)}x</span>
          </div>
        </div>

        <div class="settings-form__group">
          <label class="settings-form__label settings-form__label--xs">
            ${msg('Social Interaction Rate')}
            ${renderInfoBubble(msg('Multiplier for how often co-located agents interact socially. At 1.0: ~15% chance per agent pair per tick. At 2.0: ~30% chance, very socially active. At 0.5: quieter simulation with fewer conflicts and friendships. Range: 0.1 to 3.0.'))}
          </label>
          <div class="range-row">
            <input
              class="range-row__input"
              type="range"
              min="0.1"
              max="3.0"
              step="0.1"
              .value=${String(socialRate)}
              @input=${(e: Event) => this._handleRange('autonomy_social_interaction_rate', e)}
            />
            <span class="range-row__value">${socialRate.toFixed(1)}x</span>
          </div>
        </div>
      </div>

      <!-- Events & Thresholds -->
      <div class="settings-section">
        <velg-section-header variant="large">${msg('Autonomous Events')}</velg-section-header>

        <div class="settings-form__group">
          <label class="settings-form__label settings-form__label--xs">
            ${msg('Event Trigger Sensitivity')}
            ${renderInfoBubble(msg('Controls how easily autonomous events fire. At 0.5 (default): standard sensitivity. At 1.0: events trigger at the slightest provocation, creating a dramatic, chaotic simulation. At 0.1: only extreme conditions generate events. Affects celebrations, crises, and conflict escalations. Range: 0.1 to 1.0.'))}
          </label>
          <div class="range-row">
            <input
              class="range-row__input"
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              .value=${String(eventThreshold)}
              @input=${(e: Event) => this._handleRange('autonomy_event_threshold', e)}
            />
            <span class="range-row__value">${eventThreshold.toFixed(2)}</span>
          </div>
        </div>

        <div class="toggle-row">
          <velg-toggle
            .checked=${stressCascade}
            @toggle-change=${(e: CustomEvent) => this._handleToggle('autonomy_stress_cascade_enabled', e.detail.checked)}
          ></velg-toggle>
          <span class="toggle-row__label">
            ${msg('Stress Cascades')}
            ${renderInfoBubble(msg('When an agent has a stress breakdown (stress > 800), all agents in the same zone receive a negative moodlet. This can trigger chain reactions where one breakdown destabilizes an entire zone. Inspired by Dwarf Fortress tantrum spirals. Disable for a calmer simulation.'))}
          </span>
        </div>
      </div>

      <!-- Relationships -->
      <div class="settings-section">
        <velg-section-header variant="large">${msg('Relationships')}</velg-section-header>

        <div class="toggle-row">
          <velg-toggle
            .checked=${autoRelationships}
            @toggle-change=${(e: CustomEvent) => this._handleToggle('autonomy_relationship_auto_create', e.detail.checked)}
          ></velg-toggle>
          <span class="toggle-row__label">
            ${msg('Auto-Create Relationships')}
            ${renderInfoBubble(msg("When an agent's opinion of another crosses +60, a positive relationship (ally/friend) is automatically created. When it crosses -60, a hostile relationship (rival) is created or an existing one is downgraded. Disable to keep manual control over all relationships."))}
          </span>
        </div>
      </div>

      <!-- AI & Costs -->
      <div class="settings-section">
        <velg-section-header variant="large">${msg('AI Budget')}</velg-section-header>

        <div class="settings-form__group">
          <label class="settings-form__label settings-form__label--xs">
            ${msg('LLM Calls per Tick')}
            ${renderInfoBubble(msg('Maximum number of AI text generation calls per heartbeat tick for this simulation. Used for autonomous event narratives and morning briefing prose. Higher values produce richer narratives but cost more. Activity selection and mood/opinion calculations use zero LLM calls. Range: 1 to 20.'))}
          </label>
          <div class="range-row">
            <input
              class="range-row__input"
              type="range"
              min="1"
              max="20"
              step="1"
              .value=${String(llmBudget)}
              @input=${(e: Event) => this._handleRange('autonomy_llm_budget_per_tick', e)}
            />
            <span class="range-row__value">${llmBudget}</span>
          </div>
          <div class="cost-estimate">
            ${msg('Estimated cost')}: ~$${(llmBudget * 6 * 30 * 2500 * 0.00000026 + llmBudget * 6 * 30 * 500 * 0.00000038).toFixed(2)}/${msg('month')}
          </div>
        </div>

        <div class="settings-form__group">
          <label class="settings-form__label settings-form__label--xs">
            ${msg('Briefing Mode')}
            ${renderInfoBubble(msg('How morning briefings are generated. "Narrative" mode uses AI to write a Bureau-style prose summary of overnight activity (costs 1 LLM call). "Data" mode shows only structured metrics without prose. Choose data mode to save on AI costs.'))}
          </label>
          <select
            class="model-select"
            .value=${briefingMode}
            @change=${(e: Event) => this._handleSelect('autonomy_briefing_mode', e)}
          >
            <option value="narrative">${msg('Narrative (AI prose)')}</option>
            <option value="data">${msg('Data only (no AI)')}</option>
          </select>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-autonomy-settings-panel': VelgAutonomySettingsPanel;
  }
}
