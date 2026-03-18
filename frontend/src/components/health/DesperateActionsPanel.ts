import { localized, msg } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { healthApi } from '../../services/api/HealthApiService.js';
import type { SimulationHealthDashboard, ZoneStability } from '../../types/index.js';
import { icons } from '../../utils/icons.js';
import { trapFocus, focusFirstElement } from '../shared/focus-trap.js';

interface PanelAction {
  type: string;
  label: string;
  icon: ReturnType<typeof icons.scorchedEarth>;
  color: string;
  accentRgb: string;
  description: string;
  estimate: string;
  requiresTarget: boolean;
  /** Navigation target for diagnostic actions (non-epoch). */
  navigateTo?: string;
}

/**
 * Critical-state action panel — dual-mode based on simulation type.
 *
 * **Epoch game instances:** War-room threshold actions (scorched earth,
 * emergency draft, reality anchor) that execute backend mutations.
 *
 * **Regular simulations:** Diagnostic recovery protocols that guide the
 * player to fix underlying health metrics (staff buildings, recruit
 * agents, establish diplomacy) via tab navigation.
 *
 * Medical life-support aesthetic: ECG waveform border, slow-pulsing
 * alert lamp, monospace readouts.
 */
@localized()
@customElement('velg-desperate-actions-panel')
export class DesperateActionsPanel extends SignalWatcher(LitElement) {
  static styles = css`
    :host {
      display: block;
    }

    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    /* ── Panel container ─────────────────────── */

    .panel {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 20;
      background: var(--color-surface);
      transform: translateY(100%);
      animation: panel-enter 500ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) forwards;
    }

    @keyframes panel-enter {
      to {
        transform: translateY(0);
      }
    }

    /* Top border — color set via CSS variable */
    .panel::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: var(--panel-accent, var(--color-danger));
      opacity: 0.6;
    }

    /* ECG / diagnostic waveform decoration */
    .panel::after {
      content: '';
      position: absolute;
      top: -8px;
      left: 0;
      right: 0;
      height: 18px;
      background-image: var(--panel-waveform);
      background-repeat: repeat-x;
      background-position: center;
      opacity: 0;
      animation: ecg-fade 3s ease-in-out infinite;
    }

    @keyframes ecg-fade {
      0%,
      100% {
        opacity: 0.3;
      }
      50% {
        opacity: 0.6;
      }
    }

    .panel__inner {
      padding: var(--space-4, 16px) var(--space-6, 24px);
      padding-top: calc(var(--space-4, 16px) + 3px);
    }

    /* ── Header ──────────────────────────────── */

    .panel__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--space-3, 12px);
    }

    .panel__title-group {
      display: flex;
      align-items: center;
      gap: var(--space-3, 12px);
    }

    .panel__alert-lamp {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--panel-accent, var(--color-danger));
      box-shadow: 0 0 6px var(--panel-accent, var(--color-danger));
      animation: lamp-pulse 3s ease-in-out infinite;
    }

    @keyframes lamp-pulse {
      0%,
      100% {
        opacity: 1;
        box-shadow: 0 0 6px var(--panel-accent, var(--color-danger));
      }
      50% {
        opacity: 0.3;
        box-shadow: 0 0 2px var(--panel-accent, var(--color-danger));
      }
    }

    .panel__title {
      font-family: var(--font-brutalist, sans-serif);
      font-size: var(--text-xs, 12px);
      font-weight: 900;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--panel-accent, var(--color-danger));
    }

    .panel__dismiss {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      background: none;
      border: 1px solid color-mix(in srgb, var(--color-text-muted) 30%, transparent);
      color: var(--color-text-muted);
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .panel__dismiss:hover {
      color: var(--color-text-primary);
      border-color: var(--color-text-primary);
      background: rgba(255, 255, 255, 0.04);
    }

    /* ── Action cards grid ────────────────────── */

    .actions {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--space-3, 12px);
    }

    .action {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: var(--space-2, 8px);
      padding: var(--space-3, 12px) var(--space-4, 16px);
      background: var(--color-surface-raised);
      border: 1px solid color-mix(in srgb, var(--color-border) 60%, transparent);
      border-left: 3px solid color-mix(in srgb, var(--action-color) 70%, var(--color-text-muted));
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s ease;
      overflow: hidden;
    }

    .action:hover,
    .action:focus-visible {
      border-color: color-mix(in srgb, var(--action-color) 70%, var(--color-text-muted));
      border-left-color: var(--action-color);
      background: color-mix(in srgb, var(--action-color) 4%, var(--color-surface-raised));
      box-shadow: 0 0 12px color-mix(in srgb, var(--action-color) 8%, transparent);
    }

    .action:focus-visible {
      outline: 2px solid var(--action-color);
      outline-offset: -2px;
    }

    .action[aria-disabled='true'] {
      opacity: 0.4;
      pointer-events: none;
      filter: grayscale(0.5);
    }

    .action__header {
      display: flex;
      align-items: center;
      gap: var(--space-2, 8px);
    }

    .action__icon {
      display: flex;
      color: color-mix(in srgb, var(--action-color) 70%, var(--color-text-muted));
      filter: drop-shadow(0 0 3px color-mix(in srgb, var(--action-color) 15%, transparent));
    }

    .action__name {
      font-family: var(--font-brutalist, sans-serif);
      font-size: var(--text-sm, 14px);
      font-weight: 900;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--color-text-primary);
    }

    .action__desc {
      font-family: var(--font-body, sans-serif);
      font-size: var(--text-xs, 12px);
      color: var(--color-text-secondary);
      line-height: 1.5;
    }

    .action__estimate {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      font-weight: 700;
      color: color-mix(in srgb, var(--action-color) 60%, var(--color-text-muted));
      letter-spacing: 0.04em;
      text-transform: uppercase;
      padding-top: var(--space-1, 4px);
      border-top: 1px solid color-mix(in srgb, var(--color-border) 40%, transparent);
    }

    /* Navigate hint for diagnostic actions */
    .action__nav-hint {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      color: var(--color-text-muted);
      letter-spacing: 0.06em;
      text-transform: uppercase;
      opacity: 0;
      transition: opacity 0.15s ease;
    }

    .action:hover .action__nav-hint {
      opacity: 1;
    }

    /* Cooldown shimmer */
    .action--cooldown::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.04) 50%, transparent 100%);
      background-size: 200% 100%;
      animation: cooldown-sweep 1.5s ease;
    }

    @keyframes cooldown-sweep {
      0% {
        background-position: -200% 0;
      }
      100% {
        background-position: 200% 0;
      }
    }

    /* ── Error message ────────────────────────── */

    .panel__error {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs, 12px);
      color: var(--color-danger);
      text-align: center;
      padding: var(--space-2, 8px) 0 0;
      animation: error-flash 0.3s ease;
    }

    @keyframes error-flash {
      0% {
        opacity: 0;
        transform: translateY(4px);
      }
      100% {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* ── Responsive ──────────────────────────── */

    @media (max-width: 640px) {
      .actions {
        grid-template-columns: 1fr;
      }

      .panel__inner {
        padding: var(--space-3, 12px) var(--space-4, 16px);
      }
    }

    /* ── Reduced motion ──────────────────────── */

    @media (prefers-reduced-motion: reduce) {
      .panel {
        transform: translateY(0);
        animation: none;
      }

      .panel::after {
        animation: none;
        opacity: 0.4;
      }

      .panel__alert-lamp {
        animation: none;
      }

      .action--cooldown::after {
        animation: none;
        background: rgba(255, 255, 255, 0.02);
      }
    }
  `;

  @property({ type: String }) simulationId = '';
  @property({ type: Array }) zones: ZoneStability[] = [];

  @state() private _dismissed = false;
  @state() private _healthData: SimulationHealthDashboard | null = null;

  private get _dismissKey(): string {
    return `diagnostics_dismissed_${this.simulationId}`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (sessionStorage.getItem(this._dismissKey)) {
      this._dismissed = true;
    }
    if (this.simulationId) {
      this._loadHealthData();
    }
    this._handleKeydown = this._handleKeydown.bind(this);
    this.addEventListener('keydown', this._handleKeydown);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener('keydown', this._handleKeydown);
  }

  protected updated(changed: Map<string, unknown>): void {
    // Focus first element when panel becomes visible
    if (changed.has('_dismissed') && !this._dismissed) {
      focusFirstElement(this.shadowRoot);
    }
  }

  private _handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this._dismiss();
      return;
    }
    // Trap focus inside the panel
    const container = this.shadowRoot?.querySelector('.panel__inner');
    trapFocus(e, container, this);
  }

  private async _loadHealthData(): Promise<void> {
    const result = await healthApi.getDashboard(this.simulationId);
    if (result.success && result.data) {
      this._healthData = result.data;
    }
  }

  private _dismiss(): void {
    this._dismissed = true;
    sessionStorage.setItem(this._dismissKey, '1');
  }
  @state() private _cooldowns = new Set<string>();
  @state() private _executing = '';
  @state() private _errorMsg = '';

  private get _isEpoch(): boolean {
    const sim = appState.currentSimulation.value;
    return sim?.simulation_type === 'game_instance' && !!sim.epoch_id;
  }

  /* ── Epoch threshold actions (competitive game mechanics) ── */

  private get _epochActions(): PanelAction[] {
    return [
      {
        type: 'scorched_earth',
        label: msg('Scorched Earth'),
        icon: icons.scorchedEarth(28),
        color: 'var(--color-danger)',
        accentRgb: '239, 68, 68',
        description: msg('Permanently destroy a building to stabilize zone'),
        estimate: msg('+0.15 STAB · 1 BLDG'),
        requiresTarget: true,
      },
      {
        type: 'emergency_draft',
        label: msg('Emergency Draft'),
        icon: icons.emergencyDraft(28),
        color: 'var(--color-warning)',
        accentRgb: '245, 158, 11',
        description: msg('Draft emergency personnel from reserves'),
        estimate: msg('+1 AGENT · 15 RP'),
        requiresTarget: false,
      },
      {
        type: 'reality_anchor',
        label: msg('Reality Anchor'),
        icon: icons.anchor(28),
        color: 'var(--color-info)',
        accentRgb: '59, 130, 246',
        description: msg('Temporary stability boost, all zones, 3 cycles'),
        estimate: msg('+0.10 STAB · ALL · 3 CYC'),
        requiresTarget: false,
      },
    ];
  }

  /* ── Diagnostic recovery actions (regular simulations) ── */

  private get _diagnosticActions(): PanelAction[] {
    const sim = appState.currentSimulation.value;
    const h = this._healthData;
    const agentCount = sim?.agent_count ?? 0;
    const buildingCount = sim?.building_count ?? 0;
    const readinessPct = h?.health ? Math.round((h.health.avg_readiness ?? 0) * 100) : 0;
    const embassyCount = h?.health?.active_embassy_count ?? 0;
    const reach = h?.health?.diplomatic_reach ?? 0;

    return [
      {
        type: 'staff_buildings',
        label: msg('Staff Buildings'),
        icon: icons.building(28),
        color: 'var(--color-info)',
        accentRgb: '59, 130, 246',
        description: msg('Assign agents to understaffed buildings'),
        estimate: `${buildingCount} ${msg('BLDG')} · ${readinessPct}% ${msg('READY')}`,
        requiresTarget: false,
        navigateTo: 'buildings',
      },
      {
        type: 'create_agents',
        label: msg('Create Agents'),
        icon: icons.emergencyDraft(28),
        color: 'var(--color-success)',
        accentRgb: '34, 197, 94',
        description: msg('Add new agents and assign them to buildings'),
        estimate: `${agentCount} ${msg('AGENTS')}`,
        requiresTarget: false,
        navigateTo: 'agents',
      },
      {
        type: 'establish_diplomacy',
        label: msg('Establish Diplomacy'),
        icon: icons.handshake(28),
        color: 'var(--color-epoch-influence)',
        accentRgb: '167, 139, 250',
        description: msg('Open building details to establish embassies'),
        estimate: `${embassyCount} ${msg('EMBASSIES')} · ${reach.toFixed(2)} ${msg('REACH')}`,
        requiresTarget: false,
        navigateTo: 'buildings',
      },
    ];
  }

  private _showError(message: string) {
    this._errorMsg = message;
    setTimeout(() => {
      this._errorMsg = '';
    }, 3000);
  }

  private _handleAction(action: PanelAction) {
    if (action.navigateTo) {
      // Diagnostic action → navigate to the relevant tab
      const slug = appState.currentSimulation.value?.slug ?? this.simulationId;
      this.dispatchEvent(
        new CustomEvent('navigate', {
          detail: `/simulations/${slug}/${action.navigateTo}`,
          bubbles: true,
          composed: true,
        }),
      );
      this._dismiss();
    } else {
      // Epoch action → execute threshold API call
      this._executeThresholdAction(action);
    }
  }

  private async _executeThresholdAction(action: PanelAction) {
    if (this._cooldowns.has(action.type) || this._executing) return;

    if (!appState.isAuthenticated.value) {
      this._showError(msg('Sign in to execute emergency actions'));
      return;
    }

    this._executing = action.type;

    const params: Record<string, string> = {};
    if (action.requiresTarget && this.zones.length > 0) {
      const worstZone = this.zones[0];
      if (worstZone?.zone_id) {
        params.target_zone_id = worstZone.zone_id;
      }
    }

    const result = await healthApi.executeThresholdAction(
      this.simulationId,
      action.type,
      Object.keys(params).length > 0 ? params : undefined,
    );

    this._executing = '';

    if (result.success) {
      this._cooldowns = new Set([...this._cooldowns, action.type]);
      setTimeout(() => {
        this._cooldowns = new Set([...this._cooldowns].filter((t) => t !== action.type));
      }, 2000);
    } else {
      this._showError(result.error?.message ?? msg('Action failed'));
    }
  }

  protected render() {
    if (this._dismissed) return nothing;

    const isEpoch = this._isEpoch;
    const actions = isEpoch ? this._epochActions : this._diagnosticActions;

    // Panel accent: red for epoch war-room, primary for diagnostic
    const accentColor = isEpoch ? 'var(--color-danger)' : 'var(--color-primary)';
    const ecgColor = isEpoch ? '%23ef4444' : '%23999999';

    const title = isEpoch
      ? html`// ${msg('LIFE SUPPORT PROTOCOLS')} // ${msg('ENTROPY COUNTERMEASURES')} //`
      : html`// ${msg('SYSTEM DIAGNOSTICS')} // ${msg('RECOVERY PROTOCOLS')} //`;

    const ariaLabel = isEpoch
      ? msg('Emergency threshold actions')
      : msg('System recovery diagnostics');

    // Waveform SVG — red ECG spikes for epoch, flatter teal for diagnostic
    const waveform = isEpoch
      ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='18' viewBox='0 0 200 18'%3E%3Cpath d='M0 9h40l4-6 4 12 4-6h8l3-4 3 8 3-4h8l2-3 4 10 2-7h118' fill='none' stroke='${ecgColor}' stroke-width='1' opacity='0.3'/%3E%3C/svg%3E")`
      : `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='18' viewBox='0 0 200 18'%3E%3Cpath d='M0 9h60l2-2 2 4 2-2h10l1-1 2 3 1-2h120' fill='none' stroke='${ecgColor}' stroke-width='1' opacity='0.3'/%3E%3C/svg%3E")`;

    return html`
      <div
        class="panel"
        role=${isEpoch ? 'toolbar' : 'complementary'}
        aria-label=${ariaLabel}
        style="--panel-accent: ${accentColor}; --panel-waveform: ${waveform}"
      >
        <div class="panel__inner">
          <div class="panel__header">
            <div class="panel__title-group">
              <span class="panel__alert-lamp" aria-hidden="true"></span>
              <span class="panel__title">${title}</span>
            </div>
            <button
              class="panel__dismiss"
              @click=${() => this._dismiss()}
              aria-label=${msg('Dismiss')}
            >
              ${icons.close(14)}
            </button>
          </div>
          <div class="actions">
            ${actions.map((action) => this._renderAction(action))}
          </div>
          ${
            this._errorMsg
              ? html`<div class="panel__error" role="alert">${this._errorMsg}</div>`
              : nothing
          }
        </div>
      </div>
    `;
  }

  private _renderAction(action: PanelAction) {
    const onCooldown = this._cooldowns.has(action.type);
    const executing = this._executing === action.type;

    return html`
      <button
        class="action ${onCooldown ? 'action--cooldown' : ''}"
        style="--action-color: ${action.color}"
        ?disabled=${executing || onCooldown}
        @click=${() => this._handleAction(action)}
      >
        <div class="action__header">
          <span class="action__icon">${action.icon}</span>
          <span class="action__name">${action.label}</span>
        </div>
        <span class="action__desc">${action.description}</span>
        <span class="action__estimate">${action.estimate}</span>
        ${
          action.navigateTo
            ? html`<span class="action__nav-hint">${msg('GO TO TAB')} →</span>`
            : nothing
        }
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-desperate-actions-panel': DesperateActionsPanel;
  }
}
