import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { adminApi } from '../../services/api/index.js';
import type { HealthEffectsSimulation } from '../../services/api/AdminApiService.js';
import { VelgToast } from '../shared/Toast.js';

@localized()
@customElement('velg-admin-health-tab')
export class VelgAdminHealthTab extends LitElement {
  static styles = css`
    :host {
      display: block;
      color: var(--color-text-primary);
      font-family: var(--font-mono, monospace);
    }

    /* --- Section Headers --- */

    .section-header {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      margin-bottom: var(--space-4);
    }

    .section-header__marker {
      width: 3px;
      height: 20px;
      background: var(--color-danger);
      flex-shrink: 0;
    }

    .section-header__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-widest);
      color: var(--color-text-primary);
      margin: 0;
    }

    /* --- Global Control Card --- */

    .global-card {
      position: relative;
      padding: var(--space-5);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      margin-bottom: var(--space-8);
      overflow: hidden;
      transition:
        border-color 0.3s ease,
        box-shadow 0.3s ease;
    }

    .global-card--active {
      border-color: color-mix(in srgb, var(--color-danger) 40%, transparent);
      box-shadow: inset 0 0 40px -20px color-mix(in srgb, var(--color-danger) 8%, transparent);
    }

    .global-card--suppressed {
      border-color: var(--color-border);
    }

    .global-card__corner {
      position: absolute;
      width: 8px;
      height: 8px;
      border-color: var(--color-danger);
      border-style: solid;
      opacity: 0.4;
      transition: opacity 0.3s ease;
    }

    .global-card--active .global-card__corner {
      opacity: 0.7;
    }

    .global-card__corner--tl {
      top: 4px;
      left: 4px;
      border-width: 1px 0 0 1px;
    }

    .global-card__corner--tr {
      top: 4px;
      right: 4px;
      border-width: 1px 1px 0 0;
    }

    .global-card__corner--bl {
      bottom: 4px;
      left: 4px;
      border-width: 0 0 1px 1px;
    }

    .global-card__corner--br {
      bottom: 4px;
      right: 4px;
      border-width: 0 1px 1px 0;
    }

    .global-card__row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
    }

    .global-card__info {
      flex: 1;
      min-width: 0;
    }

    .global-card__label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-primary);
      margin: 0 0 var(--space-1) 0;
    }

    .global-card__description {
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      line-height: 1.6;
      margin: 0;
    }

    .global-card__status {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1-5);
      font-family: var(--font-brutalist);
      font-size: 10px;
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-widest);
      padding: var(--space-1) var(--space-2);
      margin-top: var(--space-2);
    }

    .global-card__status--active {
      color: var(--color-danger);
      background: color-mix(in srgb, var(--color-danger) 10%, transparent);
      border: 1px solid color-mix(in srgb, var(--color-danger) 25%, transparent);
    }

    .global-card__status--suppressed {
      color: var(--color-text-muted);
      background: color-mix(in srgb, var(--color-text-muted) 8%, transparent);
      border: 1px solid color-mix(in srgb, var(--color-text-muted) 20%, transparent);
    }

    .global-card__status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
    }

    .global-card__status--active .global-card__status-dot {
      animation: status-pulse 2s ease-in-out infinite;
    }

    @keyframes status-pulse {
      0%,
      100% {
        opacity: 1;
      }
      50% {
        opacity: 0.3;
      }
    }

    /* --- Toggle Switch --- */

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

    .toggle__track {
      position: absolute;
      inset: 0;
      border-radius: 12px;
      background: var(--color-border);
      cursor: pointer;
      transition:
        background 0.25s ease,
        box-shadow 0.25s ease;
    }

    .toggle__input:checked + .toggle__track {
      background: var(--color-danger);
      box-shadow: 0 0 10px color-mix(in srgb, var(--color-danger) 30%, transparent);
    }

    .toggle__track::after {
      content: '';
      position: absolute;
      top: 3px;
      left: 3px;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: var(--color-text-primary);
      transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .toggle__input:checked + .toggle__track::after {
      transform: translateX(20px);
    }

    .toggle--disabled .toggle__track {
      opacity: 0.35;
      cursor: not-allowed;
    }

    .toggle__input:focus-visible + .toggle__track {
      outline: 2px solid var(--color-danger);
      outline-offset: 2px;
    }

    /* --- Filter --- */

    .filter-bar {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      margin-bottom: var(--space-4);
    }

    .filter-bar__input {
      flex: 1;
      max-width: 320px;
      padding: var(--space-2) var(--space-3);
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm);
      background: var(--color-background);
      color: var(--color-text-primary);
      border: 1px solid var(--color-border);
      border-radius: 0;
      transition: border-color 0.2s ease;
    }

    .filter-bar__input::placeholder {
      color: var(--color-text-muted);
    }

    .filter-bar__input:focus {
      outline: none;
      border-color: var(--color-danger);
      box-shadow: 0 0 0 1px var(--color-danger);
    }

    .filter-bar__count {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    /* --- Simulation Grid --- */

    .sim-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: var(--space-4);
    }

    .sim-card {
      padding: var(--space-4);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      transition:
        border-color 0.2s ease,
        box-shadow 0.2s ease;
    }

    .sim-card:hover {
      border-color: var(--color-text-muted);
    }

    .sim-card--critical {
      border-left: 3px solid var(--color-danger);
    }

    .sim-card--ascendant {
      border-left: 3px solid var(--color-accent-gold, #d4a017);
    }

    .sim-card__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--space-3);
      margin-bottom: var(--space-3);
    }

    .sim-card__name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-primary);
      margin: 0;
    }

    .sim-card__slug {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      margin: var(--space-0-5) 0 0 0;
    }

    /* --- Health Bar --- */

    .health-bar {
      margin-bottom: var(--space-3);
    }

    .health-bar__label-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--space-1);
    }

    .health-bar__label {
      font-size: 10px;
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-muted);
    }

    .health-bar__value {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
    }

    .health-bar__value--critical {
      color: var(--color-danger);
    }

    .health-bar__value--normal {
      color: var(--color-warning);
    }

    .health-bar__value--ascendant {
      color: var(--color-success, #22c55e);
    }

    .health-bar__track {
      height: 4px;
      background: color-mix(in srgb, var(--color-border) 50%, transparent);
      overflow: hidden;
    }

    .health-bar__fill {
      height: 100%;
      transition: width 0.6s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .health-bar__fill--critical {
      background: var(--color-danger);
      box-shadow: 0 0 6px color-mix(in srgb, var(--color-danger) 40%, transparent);
    }

    .health-bar__fill--normal {
      background: var(--color-warning);
    }

    .health-bar__fill--ascendant {
      background: var(--color-success, #22c55e);
    }

    /* --- Badges --- */

    .sim-card__footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      font-family: var(--font-brutalist);
      font-size: 10px;
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      padding: 2px var(--space-2);
    }

    .badge--normal {
      color: var(--color-text-muted);
      background: color-mix(in srgb, var(--color-text-muted) 8%, transparent);
      border: 1px solid color-mix(in srgb, var(--color-text-muted) 15%, transparent);
    }

    .badge--critical {
      color: var(--color-danger);
      background: color-mix(in srgb, var(--color-danger) 10%, transparent);
      border: 1px solid color-mix(in srgb, var(--color-danger) 25%, transparent);
    }

    .badge--ascendant {
      color: var(--color-accent-gold, #d4a017);
      background: color-mix(in srgb, var(--color-accent-gold, #d4a017) 10%, transparent);
      border: 1px solid color-mix(in srgb, var(--color-accent-gold, #d4a017) 25%, transparent);
    }

    .sim-card__toggle-area {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .sim-card__disabled-hint {
      font-size: 10px;
      color: var(--color-text-muted);
      font-style: italic;
    }

    /* --- Empty / Loading --- */

    .loading {
      text-align: center;
      padding: var(--space-8);
      color: var(--color-text-muted);
      font-family: var(--font-brutalist);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
    }

    .empty {
      text-align: center;
      padding: var(--space-8);
      color: var(--color-text-muted);
      font-size: var(--text-sm);
    }

    @media (max-width: 768px) {
      .sim-grid {
        grid-template-columns: 1fr;
      }

      .global-card__row {
        flex-direction: column;
        align-items: flex-start;
      }
    }
  `;

  @state() private _globalEnabled = true;
  @state() private _simulations: HealthEffectsSimulation[] = [];
  @state() private _loading = true;
  @state() private _saving = false;
  @state() private _filter = '';

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    await this._loadData();
  }

  private async _loadData(): Promise<void> {
    this._loading = true;
    const result = await adminApi.getHealthEffects();
    if (result.success && result.data) {
      this._globalEnabled = result.data.global_enabled;
      this._simulations = result.data.simulations;
    }
    this._loading = false;
  }

  private async _toggleGlobal(): Promise<void> {
    if (this._saving) return;
    this._saving = true;
    const newVal = !this._globalEnabled;
    const result = await adminApi.updateSetting(
      'critical_health_effects_enabled',
      newVal ? 'true' : 'false',
    );
    if (result.success) {
      VelgToast.success(
        newVal
          ? msg('Critical health effects enabled globally.')
          : msg('Critical health effects suppressed globally.'),
      );
      await this._loadData();
    } else {
      VelgToast.error(result.error?.message ?? msg('Failed to update setting.'));
    }
    this._saving = false;
  }

  private async _toggleSimulation(simId: string, currentEnabled: boolean): Promise<void> {
    if (this._saving || !this._globalEnabled) return;
    this._saving = true;
    const newVal = !currentEnabled;
    const result = await adminApi.updateSimulationHealthEffects(simId, newVal);
    if (result.success) {
      VelgToast.success(
        newVal
          ? msg('Effects enabled for simulation.')
          : msg('Effects suppressed for simulation.'),
      );
      await this._loadData();
    } else {
      VelgToast.error(result.error?.message ?? msg('Failed to update setting.'));
    }
    this._saving = false;
  }

  private get _filteredSimulations(): HealthEffectsSimulation[] {
    if (!this._filter) return this._simulations;
    const q = this._filter.toLowerCase();
    return this._simulations.filter(
      (s) => s.name.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q),
    );
  }

  protected render() {
    if (this._loading) {
      return html`<div class="loading">${msg('Loading health effects data...')}</div>`;
    }

    const filtered = this._filteredSimulations;

    return html`
      <!-- Global Control -->
      <div class="section-header">
        <div class="section-header__marker"></div>
        <h2 class="section-header__title">${msg('Master Switch')}</h2>
      </div>

      <div class="global-card ${this._globalEnabled ? 'global-card--active' : 'global-card--suppressed'}">
        <div class="global-card__corner global-card__corner--tl"></div>
        <div class="global-card__corner global-card__corner--tr"></div>
        <div class="global-card__corner global-card__corner--bl"></div>
        <div class="global-card__corner global-card__corner--br"></div>

        <div class="global-card__row">
          <div class="global-card__info">
            <p class="global-card__label">${msg('Critical Health Effects')}</p>
            <p class="global-card__description">
              ${msg('Controls entropy overlay, text corruption, card distortion, deceleration hero moment, entropy timer, and desperate actions panel. When disabled, all critical-state visual effects are suppressed across every simulation.')}
            </p>
            <div class="global-card__status ${this._globalEnabled ? 'global-card__status--active' : 'global-card__status--suppressed'}">
              <span class="global-card__status-dot"></span>
              ${this._globalEnabled ? msg('Effects Active') : msg('Effects Suppressed')}
            </div>
          </div>
          <label class="toggle">
            <input
              class="toggle__input"
              type="checkbox"
              .checked=${this._globalEnabled}
              ?disabled=${this._saving}
              @change=${this._toggleGlobal}
            />
            <span class="toggle__track"></span>
          </label>
        </div>
      </div>

      <!-- Per-Simulation Controls -->
      <div class="section-header">
        <div class="section-header__marker"></div>
        <h2 class="section-header__title">${msg('Per-Simulation Overrides')}</h2>
      </div>

      ${this._simulations.length > 0
        ? html`
            <div class="filter-bar">
              <input
                class="filter-bar__input"
                type="text"
                placeholder=${msg('Filter simulations...')}
                .value=${this._filter}
                @input=${(e: Event) => {
                  this._filter = (e.target as HTMLInputElement).value;
                }}
              />
              <span class="filter-bar__count">
                ${filtered.length} / ${this._simulations.length}
              </span>
            </div>
          `
        : nothing}

      ${filtered.length === 0
        ? html`<div class="empty">${
            this._simulations.length === 0
              ? msg('No active simulations found.')
              : msg('No simulations match the filter.')
          }</div>`
        : html`
            <div class="sim-grid">
              ${filtered.map((sim) => this._renderSimCard(sim))}
            </div>
          `}
    `;
  }

  private _renderSimCard(sim: HealthEffectsSimulation) {
    const healthPct = Math.round(sim.overall_health * 100);
    const ts = sim.threshold_state;
    const isDisabledGlobally = !this._globalEnabled;

    return html`
      <div class="sim-card ${ts === 'critical' ? 'sim-card--critical' : ts === 'ascendant' ? 'sim-card--ascendant' : ''}">
        <div class="sim-card__header">
          <div>
            <p class="sim-card__name">${sim.name}</p>
            <p class="sim-card__slug">/${sim.slug}</p>
          </div>
        </div>

        <div class="health-bar">
          <div class="health-bar__label-row">
            <span class="health-bar__label">${msg('Health')}</span>
            <span class="health-bar__value health-bar__value--${ts}">
              ${healthPct}%
            </span>
          </div>
          <div class="health-bar__track">
            <div
              class="health-bar__fill health-bar__fill--${ts}"
              style="width: ${healthPct}%"
            ></div>
          </div>
        </div>

        <div class="sim-card__footer">
          <span class="badge badge--${ts}">
            ${ts === 'critical'
              ? msg('Critical')
              : ts === 'ascendant'
                ? msg('Ascendant')
                : msg('Normal')}
          </span>

          <div class="sim-card__toggle-area">
            ${isDisabledGlobally
              ? html`<span class="sim-card__disabled-hint">${msg('Globally Disabled')}</span>`
              : nothing}
            <label class="toggle ${isDisabledGlobally ? 'toggle--disabled' : ''}">
              <input
                class="toggle__input"
                type="checkbox"
                .checked=${sim.effects_enabled}
                ?disabled=${isDisabledGlobally || this._saving}
                @change=${() => this._toggleSimulation(sim.id, sim.effects_enabled)}
              />
              <span class="toggle__track"></span>
            </label>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-admin-health-tab': VelgAdminHealthTab;
  }
}
