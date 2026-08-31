/**
 * Bureau Response Dispatch — the door to a mechanic that had none.
 *
 * `bureau_responses` has a service, three endpoints, a heartbeat phase that
 * resolves it, platform-configurable multipliers and an audit trail. It has had
 * all of that since March 2026, and no interface anywhere: nobody could ever
 * answer an event. The tick dutifully resolved an empty table every four hours.
 *
 * The screen is a Bureau dispatch order, not a form. Three protocols on
 * numbered plates, a roster to staff them from, a stamped carbon of the order
 * once it is filed, and a projection of what it will achieve before it is.
 *
 * That projection is the point of the design. Effectiveness is
 *
 *     min(1, agents / max(1, impact / 3)) x multiplier
 *
 * which means a single agent on a level-9 event scores 0.10 while three on the
 * same event score 0.60 — a sixfold difference the player had no way to see.
 * The meter recomputes as agents are ticked, and the formula is printed under
 * it in the same terms the server uses. A number a player cannot predict is not
 * a decision; it is a dice roll with extra steps.
 *
 * What each protocol actually does is stated as it actually is, not as it
 * sounds: containment buys one cycle of relief, remediation can push the event
 * into `resolving`, adaptation reduces the parent arc's scar tissue.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { heartbeatApi } from '../../services/api/HeartbeatApiService.js';
import { agentsApi } from '../../services/api/index.js';
import { captureError } from '../../services/SentryService.js';
import type {
  Agent,
  BureauResponse,
  BureauResponseType,
  EventStatus,
  HeartbeatOverview,
} from '../../types/index.js';
import { icons } from '../../utils/icons.js';
import { markerCornerStyles } from '../shared/marker-styles.js';
import { VelgToast } from '../shared/Toast.js';
import '../shared/LoadingState.js';
import '../shared/VelgAvatar.js';
import '../shared/VelgSectionHeader.js';

/** Mirrors RESPONSE_CONFIG in backend/services/bureau_response_service.py. */
interface ProtocolSpec {
  readonly type: BureauResponseType;
  readonly minAgents: number;
  readonly maxAgents: number;
  readonly durationTicks: number;
  readonly multiplier: number;
}

const PROTOCOLS: readonly ProtocolSpec[] = [
  { type: 'contain', minAgents: 1, maxAgents: 1, durationTicks: 1, multiplier: 0.3 },
  { type: 'remediate', minAgents: 2, maxAgents: 3, durationTicks: 2, multiplier: 0.6 },
  { type: 'adapt', minAgents: 0, maxAgents: 0, durationTicks: 1, multiplier: 0.5 },
];

/** Adapt is unlocked by public feeling, not by staffing (server-side rule). */
const ADAPT_MIN_REACTIONS = 5;

const CLOSED_EVENT_STATUSES: readonly EventStatus[] = ['resolved', 'archived'];

@localized()
@customElement('velg-bureau-response-panel')
export class VelgBureauResponsePanel extends LitElement {
  static styles = [
    markerCornerStyles,
    css`
    :host {
      display: block;
      --_ink: var(--color-text-primary);
      --_rule: var(--color-border);
      --_stamp: var(--color-primary);
      --_stamp-dim: color-mix(in srgb, var(--color-primary) 45%, transparent);
      --_stamp-wash: color-mix(in srgb, var(--color-primary) 8%, transparent);
      --_plate: var(--color-surface-raised);
    }

    .dispatch {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }

    /* ── The order sheet header ────────────────────────────── */

    .sheet-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-3);
      padding-bottom: var(--space-2);
      border-bottom: 1px dashed var(--_rule);
    }

    .sheet-head__ref {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      letter-spacing: var(--tracking-wider);
      color: var(--color-text-quiet);
      white-space: nowrap;
    }

    /* ── Protocol plates ───────────────────────────────────── */

    .plates {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(168px, 1fr));
      gap: var(--space-2);
    }

    .plate {
      --marker-color: transparent;
      position: relative;
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      padding: var(--space-3);
      min-height: 44px;
      text-align: left;
      background: var(--_plate);
      border: 1px solid var(--_rule);
      border-radius: var(--border-radius-none);
      color: var(--_ink);
      cursor: pointer;
      transition:
        border-color var(--transition-fast),
        background-color var(--transition-fast),
        box-shadow var(--transition-fast);
    }

    .plate:hover:not([disabled]) {
      border-color: var(--_stamp-dim);
      background: var(--_stamp-wash);
    }

    .plate:focus-visible {
      outline: none;
      box-shadow: var(--ring-focus);
    }

    .plate[aria-checked='true'] {
      --marker-color: var(--_stamp);
      border-color: var(--_stamp);
      background: var(--_stamp-wash);
      box-shadow: var(--shadow-sm);
    }

    .plate[disabled] {
      cursor: not-allowed;
      opacity: 0.5;
    }

    .plate__code {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
    }

    .plate__spec {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
    }

    .plate__effect {
      font-size: var(--text-xs);
      line-height: var(--leading-snug);
      color: var(--color-text-quiet);
    }

    .plate__locked {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-warning);
    }

    /* ── Roster ────────────────────────────────────────────── */

    .roster {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .roster__head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-2);
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-secondary);
    }

    .roster__count {
      font-family: var(--font-mono);
      letter-spacing: var(--tracking-normal);
      color: var(--color-text-quiet);
    }

    .roster__count--met {
      color: var(--color-success);
    }

    .roster__list {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1-5);
      max-height: 210px;
      overflow-y: auto;
      padding: var(--space-0-5);
    }

    .officer {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-1) var(--space-2) var(--space-1) var(--space-1);
      min-height: 36px;
      background: var(--color-surface);
      border: 1px solid var(--_rule);
      color: var(--_ink);
      font-size: var(--text-xs);
      cursor: pointer;
      transition:
        border-color var(--transition-fast),
        background-color var(--transition-fast);
    }

    .officer:hover:not([disabled]) {
      border-color: var(--_stamp-dim);
    }

    .officer:focus-visible {
      outline: none;
      box-shadow: var(--ring-focus);
    }

    .officer[aria-pressed='true'] {
      border-color: var(--_stamp);
      background: var(--_stamp-wash);
    }

    .officer[disabled] {
      cursor: not-allowed;
      opacity: 0.45;
    }

    .officer__name {
      font-family: var(--font-mono);
      white-space: nowrap;
      max-width: 15ch;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* ── Projection ────────────────────────────────────────── */

    .projection {
      display: flex;
      flex-direction: column;
      gap: var(--space-1-5);
      padding: var(--space-3);
      background: var(--color-surface-sunken);
      border: 1px dashed var(--_rule);
    }

    .projection__row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-3);
    }

    .projection__label {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-secondary);
    }

    .projection__value {
      font-family: var(--font-mono);
      font-size: var(--text-lg);
      font-weight: var(--font-bold);
      color: var(--_stamp);
      font-variant-numeric: tabular-nums;
    }

    .projection__meter {
      position: relative;
      height: 6px;
      background: color-mix(in srgb, var(--color-border) 60%, transparent);
      overflow: hidden;
    }

    .projection__fill {
      position: absolute;
      inset: 0 auto 0 0;
      background: var(--_stamp);
      transition: width var(--duration-slow) var(--ease-dramatic);
    }

    .projection__formula {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      line-height: var(--leading-snug);
      color: var(--color-text-quiet);
    }

    /* ── Filed order (the carbon copy) ─────────────────────── */

    .order {
      --marker-color: var(--_stamp);
      position: relative;
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      padding: var(--space-3);
      background: var(--_plate);
      border: 1px solid var(--_stamp-dim);
      animation: order-file var(--duration-entrance) var(--ease-dramatic) both;
    }

    @keyframes order-file {
      from {
        opacity: 0;
        transform: translateY(-6px);
      }
      to {
        opacity: 1;
        transform: none;
      }
    }

    .order__head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-2);
      flex-wrap: wrap;
    }

    .order__code {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--_stamp);
    }

    .order__status {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      letter-spacing: var(--tracking-wider);
      text-transform: uppercase;
    }

    .order__status--pending { color: var(--color-warning); }
    .order__status--resolving { color: var(--color-info); }
    .order__status--resolved { color: var(--color-success); }
    .order__status--expired,
    .order__status--failed { color: var(--color-danger); }

    .order__line {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
    }

    .order__actions {
      display: flex;
      gap: var(--space-2);
    }

    /* ── Actions ───────────────────────────────────────────── */

    .actions {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      flex-wrap: wrap;
    }

    .dispatch-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2-5) var(--space-5);
      min-height: 44px;
      background: var(--color-surface);
      border: 2px solid var(--_stamp);
      color: var(--_stamp);
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      cursor: pointer;
      box-shadow: var(--shadow-xs);
      transition:
        transform var(--transition-fast),
        box-shadow var(--transition-fast),
        background-color var(--transition-fast);
    }

    .dispatch-btn:hover:not([disabled]) {
      background: var(--_stamp-wash);
      box-shadow: var(--shadow-sm);
    }

    .dispatch-btn:active:not([disabled]) {
      box-shadow: var(--shadow-pressed);
    }

    .dispatch-btn:focus-visible {
      outline: none;
      box-shadow: var(--ring-focus);
    }

    .dispatch-btn[disabled] {
      border-color: var(--_rule);
      color: var(--color-text-quiet);
      cursor: not-allowed;
      box-shadow: none;
    }

    .withdraw-btn {
      padding: var(--space-1-5) var(--space-3);
      min-height: 32px;
      background: transparent;
      border: 1px solid var(--color-border-danger);
      color: var(--color-text-danger);
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      cursor: pointer;
      transition: background-color var(--transition-fast);
    }

    .withdraw-btn:hover:not([disabled]) {
      background: var(--color-danger-bg);
    }

    .withdraw-btn:focus-visible {
      outline: none;
      box-shadow: var(--ring-danger);
    }

    .hint {
      font-size: var(--text-xs);
      line-height: var(--leading-snug);
      color: var(--color-text-quiet);
    }

    .hint--warning {
      color: var(--color-warning);
    }

    .archive {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      padding-top: var(--space-2);
      border-top: 1px dashed var(--_rule);
    }

    .archive__row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-2);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-quiet);
    }

    @media (max-width: 640px) {
      .plates { grid-template-columns: 1fr; }
      .officer__name { max-width: 22ch; }
    }

    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
      }
    }
  `,
  ];

  @property({ type: String }) simulationId = '';
  @property({ type: String }) eventId = '';
  @property({ type: Number }) impactLevel = 5;
  @property({ type: String }) eventStatus: EventStatus | '' = '';
  @property({ type: Number }) reactionCount = 0;

  @state() private _responses: BureauResponse[] = [];
  @state() private _agents: Agent[] = [];
  @state() private _overview: HeartbeatOverview | null = null;
  @state() private _loading = true;
  @state() private _submitting = false;
  @state() private _selectedProtocol: BureauResponseType | null = null;
  @state() private _selectedAgentIds: string[] = [];

  protected updated(changed: Map<string, unknown>): void {
    if (
      (changed.has('eventId') || changed.has('simulationId')) &&
      this.eventId &&
      this.simulationId
    ) {
      this._selectedProtocol = null;
      this._selectedAgentIds = [];
      void this._load();
    }
  }

  private async _load(): Promise<void> {
    this._loading = true;
    const mode = appState.currentSimulationMode.value;
    const [responsesRes, agentsRes, overviewRes] = await Promise.all([
      heartbeatApi.listResponses(this.simulationId, this.eventId),
      agentsApi.list(this.simulationId, mode, { limit: '200' }),
      heartbeatApi.getOverview(this.simulationId, mode),
    ]);

    if (responsesRes.success && responsesRes.data) this._responses = responsesRes.data;
    if (agentsRes.success && agentsRes.data) this._agents = agentsRes.data;
    if (overviewRes.success && overviewRes.data) this._overview = overviewRes.data;
    this._loading = false;
  }

  // ── Derived state ─────────────────────────────────────────

  private get _pending(): BureauResponse | null {
    return this._responses.find((r) => r.status === 'pending' || r.status === 'resolving') ?? null;
  }

  private get _archive(): BureauResponse[] {
    return this._responses.filter((r) => r.status !== 'pending' && r.status !== 'resolving');
  }

  private get _eventClosed(): boolean {
    return CLOSED_EVENT_STATUSES.includes(this.eventStatus as EventStatus);
  }

  private get _spec(): ProtocolSpec | null {
    return PROTOCOLS.find((p) => p.type === this._selectedProtocol) ?? null;
  }

  /** The server's formula, recomputed here so the player can see it before filing. */
  private _projectedEffectiveness(spec: ProtocolSpec, agentCount: number): number {
    if (spec.type === 'adapt') return spec.multiplier;
    const required = Math.max(1, this.impactLevel / 3);
    return Math.min(1, agentCount / required) * spec.multiplier;
  }

  private get _staffingMet(): boolean {
    const spec = this._spec;
    if (!spec) return false;
    if (spec.type === 'adapt') return this.reactionCount >= ADAPT_MIN_REACTIONS;
    const n = this._selectedAgentIds.length;
    return n >= spec.minAgents && n <= spec.maxAgents;
  }

  private _protocolLabel(type: BureauResponseType): string {
    switch (type) {
      case 'contain':
        return msg('Containment');
      case 'remediate':
        return msg('Remediation');
      case 'adapt':
        return msg('Adaptation');
    }
  }

  /** What the protocol does when the tick resolves it - stated as it is. */
  private _protocolEffect(type: BureauResponseType): string {
    switch (type) {
      case 'contain':
        return msg("Lowers the event's pressure for this cycle.");
      case 'remediate':
        return msg(
          'Lowers pressure and can move the event into "resolving" above 0.50 effectiveness.',
        );
      case 'adapt':
        return msg("Reduces the scar tissue of the event's narrative arc.");
    }
  }

  private _statusLabel(status: BureauResponse['status']): string {
    switch (status) {
      case 'pending':
        return msg('Filed');
      case 'resolving':
        return msg('In progress');
      case 'resolved':
        return msg('Closed');
      case 'expired':
        return msg('Expired');
      case 'failed':
        return msg('Failed');
    }
  }

  // ── Interaction ───────────────────────────────────────────

  private _selectProtocol(type: BureauResponseType): void {
    this._selectedProtocol = this._selectedProtocol === type ? null : type;
    this._selectedAgentIds = [];
  }

  private _toggleAgent(agentId: string): void {
    const spec = this._spec;
    if (!spec) return;
    if (this._selectedAgentIds.includes(agentId)) {
      this._selectedAgentIds = this._selectedAgentIds.filter((id) => id !== agentId);
      return;
    }
    if (this._selectedAgentIds.length >= spec.maxAgents) {
      // At the ceiling the newest choice replaces the oldest, so a single-agent
      // protocol behaves like a radio group instead of refusing the click.
      this._selectedAgentIds = [...this._selectedAgentIds.slice(1), agentId];
      return;
    }
    this._selectedAgentIds = [...this._selectedAgentIds, agentId];
  }

  private async _dispatch(): Promise<void> {
    const spec = this._spec;
    if (!spec || this._submitting || !this._staffingMet) return;

    this._submitting = true;
    try {
      const res = await heartbeatApi.createResponse(this.simulationId, this.eventId, {
        response_type: spec.type,
        assigned_agent_ids: spec.type === 'adapt' ? [] : this._selectedAgentIds,
      });
      if (res.success && res.data) {
        this._responses = [res.data, ...this._responses];
        this._selectedProtocol = null;
        this._selectedAgentIds = [];
        VelgToast.success(msg('Dispatch order filed. It resolves at the next pulse.'));
        this.dispatchEvent(new CustomEvent('response-filed', { bubbles: true, composed: true }));
      } else {
        VelgToast.error(res.error?.message ?? msg('The Bureau refused the order.'));
      }
    } catch (err) {
      captureError(err, { source: 'VelgBureauResponsePanel._dispatch' });
      VelgToast.error(msg('The Bureau refused the order.'));
    } finally {
      this._submitting = false;
    }
  }

  private async _withdraw(responseId: string): Promise<void> {
    if (this._submitting) return;
    this._submitting = true;
    try {
      const res = await heartbeatApi.cancelResponse(this.simulationId, this.eventId, responseId);
      if (res.success) {
        await this._load();
        VelgToast.success(msg('Order withdrawn.'));
        this.dispatchEvent(new CustomEvent('response-filed', { bubbles: true, composed: true }));
      } else {
        VelgToast.error(res.error?.message ?? msg('The order could not be withdrawn.'));
      }
    } catch (err) {
      captureError(err, { source: 'VelgBureauResponsePanel._withdraw' });
      VelgToast.error(msg('The order could not be withdrawn.'));
    } finally {
      this._submitting = false;
    }
  }

  // ── Render ────────────────────────────────────────────────

  protected render() {
    if (!this.eventId) return nothing;
    if (this._loading)
      return html`<velg-loading-state message=${msg('Consulting the register')}></velg-loading-state>`;

    const pending = this._pending;

    return html`
      <div class="dispatch">
        <div class="sheet-head">
          <velg-section-header>${msg('Bureau Dispatch')}</velg-section-header>
          <span class="sheet-head__ref">
            ${msg(str`PULSE #${this._overview?.last_tick ?? 0}`)}
          </span>
        </div>

        ${pending ? this._renderFiledOrder(pending) : this._renderOrderForm()}
        ${this._archive.length > 0 ? this._renderArchive() : nothing}
      </div>
    `;
  }

  private _renderOrderForm() {
    if (this._eventClosed) {
      return html`
        <p class="hint">
          ${msg('This event is closed. The Bureau files no further orders against it.')}
        </p>
      `;
    }
    if (!appState.canEdit.value) {
      return html`
        <p class="hint">
          ${msg('No order stands against this event. Filing one requires editor rights in this world.')}
        </p>
      `;
    }

    const spec = this._spec;
    return html`
      <div class="plates" role="radiogroup" aria-label=${msg('Response protocol')}>
        ${PROTOCOLS.map((p) => this._renderPlate(p))}
      </div>

      ${spec && spec.maxAgents > 0 ? this._renderRoster(spec) : nothing}
      ${spec ? this._renderProjection(spec) : nothing}

      <div class="actions">
        <button
          class="dispatch-btn"
          ?disabled=${!spec || !this._staffingMet || this._submitting}
          @click=${this._dispatch}
        >
          ${icons.stampClassified(16)}
          ${this._submitting ? msg('Filing...') : msg('File dispatch order')}
        </button>
        ${
          spec
            ? html`<span class="hint">
              ${msg(str`Resolves at pulse #${(this._overview?.last_tick ?? 0) + spec.durationTicks}.`)}
            </span>`
            : html`<span class="hint">${msg('Choose a protocol.')}</span>`
        }
      </div>
    `;
  }

  private _renderPlate(p: ProtocolSpec) {
    const selected = this._selectedProtocol === p.type;
    const adaptLocked = p.type === 'adapt' && this.reactionCount < ADAPT_MIN_REACTIONS;

    return html`
      <button
        class="plate marker-corners"
        role="radio"
        aria-checked=${selected}
        ?disabled=${adaptLocked}
        @click=${() => this._selectProtocol(p.type)}
      >
        <span class="plate__code">${this._protocolLabel(p.type)}</span>
        <span class="plate__spec">
          ${
            p.maxAgents === 0
              ? msg('no agents')
              : p.minAgents === p.maxAgents
                ? msg(str`${p.minAgents} agent`)
                : msg(str`${p.minAgents}-${p.maxAgents} agents`)
          }
          ·
          ${p.durationTicks === 1 ? msg('1 pulse') : msg(str`${p.durationTicks} pulses`)}
          ·
          ${msg(str`×${p.multiplier.toFixed(2)}`)}
        </span>
        <span class="plate__effect">${this._protocolEffect(p.type)}</span>
        ${
          adaptLocked
            ? html`<span class="plate__locked">
              ${msg(str`Needs ${ADAPT_MIN_REACTIONS} reactions – ${this.reactionCount} on file.`)}
            </span>`
            : nothing
        }
      </button>
    `;
  }

  private _renderRoster(spec: ProtocolSpec) {
    const n = this._selectedAgentIds.length;
    const met = this._staffingMet;

    return html`
      <div class="roster">
        <div class="roster__head">
          <span>${msg('Assign officers')}</span>
          <span class="roster__count ${met ? 'roster__count--met' : ''}">
            ${msg(str`${n} of ${spec.maxAgents} assigned`)}
          </span>
        </div>
        ${
          this._agents.length === 0
            ? html`<p class="hint">${msg('This world has no agents to assign.')}</p>`
            : html`
              <div class="roster__list">
                ${this._agents.map((a) => this._renderOfficer(a, spec))}
              </div>
            `
        }
      </div>
    `;
  }

  private _renderOfficer(agent: Agent, spec: ProtocolSpec) {
    const picked = this._selectedAgentIds.includes(agent.id);
    const full = !picked && this._selectedAgentIds.length >= spec.maxAgents && spec.maxAgents > 1;

    return html`
      <button
        class="officer"
        aria-pressed=${picked}
        ?disabled=${full}
        title=${agent.primary_profession ?? agent.name}
        @click=${() => this._toggleAgent(agent.id)}
      >
        <velg-avatar
          size="xs"
          .src=${agent.portrait_image_url ?? ''}
          .name=${agent.name}
        ></velg-avatar>
        <span class="officer__name">${agent.name}</span>
      </button>
    `;
  }

  private _renderProjection(spec: ProtocolSpec) {
    const agentCount = spec.type === 'adapt' ? 0 : this._selectedAgentIds.length;
    const value = this._projectedEffectiveness(spec, agentCount);
    const required = Math.max(1, this.impactLevel / 3);

    return html`
      <div class="projection">
        <div class="projection__row">
          <span class="projection__label">${msg('Projected effectiveness')}</span>
          <span class="projection__value">${value.toFixed(2)}</span>
        </div>
        <div
          class="projection__meter"
          role="meter"
          aria-valuenow=${Math.round(value * 100)}
          aria-valuemin="0"
          aria-valuemax="100"
          aria-label=${msg('Projected effectiveness')}
        >
          <div class="projection__fill" style="width: ${Math.round(value * 100)}%"></div>
        </div>
        <p class="projection__formula">
          ${
            spec.type === 'adapt'
              ? msg(
                  str`Adaptation is a flat ×${spec.multiplier.toFixed(2)} – staffing does not change it.`,
                )
              : msg(
                  str`min(1, ${agentCount} agents / ${required.toFixed(1)} needed at impact ${this.impactLevel}) × ${spec.multiplier.toFixed(2)}`,
                )
          }
        </p>
        ${
          spec.type !== 'adapt' && agentCount > 0 && agentCount < required
            ? html`<p class="hint hint--warning">
              ${msg(str`Understaffed: this event needs ${Math.ceil(required)} agents for full effect.`)}
            </p>`
            : nothing
        }
      </div>
    `;
  }

  private _renderFiledOrder(order: BureauResponse) {
    const names = this._agents
      .filter((a) => order.assigned_agent_ids.includes(a.id))
      .map((a) => a.name);

    return html`
      <div class="order marker-corners">
        <div class="order__head">
          <span class="order__code">${this._protocolLabel(order.response_type)}</span>
          <span class="order__status order__status--${order.status}">
            ${this._statusLabel(order.status)}
          </span>
        </div>
        <div class="order__line">
          ${msg(str`Filed before pulse #${order.submitted_before_tick}`)}
        </div>
        ${
          names.length > 0
            ? html`<div class="order__line">${msg(str`Assigned: ${names.join(', ')}`)}</div>`
            : html`<div class="order__line">${msg('No officers assigned – this protocol needs none.')}</div>`
        }
        ${
          order.status === 'pending' && appState.canEdit.value
            ? html`
              <div class="order__actions">
                <button
                  class="withdraw-btn"
                  ?disabled=${this._submitting}
                  @click=${() => this._withdraw(order.id)}
                >
                  ${msg('Withdraw order')}
                </button>
              </div>
            `
            : nothing
        }
      </div>
    `;
  }

  private _renderArchive() {
    return html`
      <div class="archive">
        ${this._archive.map(
          (r) => html`
            <div class="archive__row">
              <span>
                ${this._protocolLabel(r.response_type)}
                ·
                ${this._statusLabel(r.status)}
                ${r.resolved_at_tick ? msg(str`· pulse #${r.resolved_at_tick}`) : nothing}
              </span>
              <span>${msg(str`effectiveness ${r.effectiveness.toFixed(2)}`)}</span>
            </div>
          `,
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-bureau-response-panel': VelgBureauResponsePanel;
  }
}
