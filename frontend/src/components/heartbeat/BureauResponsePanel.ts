/**
 * Bureau Response Panel — "Bureau Field Response Terminal"
 *
 * Classified intelligence dispatch aesthetic. Rendered within event detail
 * views. Allows players to assign agents to contain, remediate, or adapt
 * to events. Shows staffing impact preview and resolution history.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import { heartbeatApi } from '../../services/api/HeartbeatApiService.js';
import type { Agent, BureauResponse, BureauResponseType } from '../../types/index.js';
import { icons } from '../../utils/icons.js';
import { renderInfoBubble, infoBubbleStyles } from '../shared/info-bubble-styles.js';
import { VelgToast } from '../shared/Toast.js';

const RESPONSE_DESCRIPTIONS: Record<BureauResponseType, { label: string; desc: string; cost: string }> = {
  contain: {
    label: 'Contain',
    desc: 'Dispatch containment team to stabilize the situation.',
    cost: '1 agent, 1 tick',
  },
  remediate: {
    label: 'Remediate',
    desc: 'Full remediation protocol — higher effectiveness, can resolve event.',
    cost: '2-3 agents, 2 ticks',
  },
  adapt: {
    label: 'Adapt',
    desc: 'Learn from crisis to reduce scar tissue. Requires 5+ reactions.',
    cost: 'No agents, 1 tick',
  },
};

@localized()
@customElement('velg-bureau-response-panel')
export class VelgBureauResponsePanel extends LitElement {
  static styles = [infoBubbleStyles, css`
    /* ═══════════════════════════════════════
       KEYFRAMES
       ═══════════════════════════════════════ */

    @keyframes stamp-slam {
      0% {
        opacity: 0;
        transform: rotate(-12deg) scale(2.5);
      }
      50% {
        opacity: 0.95;
        transform: rotate(-12deg) scale(0.92);
      }
      70% {
        transform: rotate(-12deg) scale(1.04);
      }
      100% {
        opacity: 0.85;
        transform: rotate(-12deg) scale(1);
      }
    }

    @keyframes pulse-amber {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    @keyframes scanline-drift {
      0% { background-position: 0 0; }
      100% { background-position: 0 4px; }
    }

    @keyframes stamp-press {
      0% { transform: scale(1); box-shadow: 0 4px 12px rgba(0,0,0,0.4); }
      50% { transform: scale(0.93); box-shadow: inset 0 2px 6px rgba(0,0,0,0.5); }
      100% { transform: scale(1); box-shadow: 0 4px 12px rgba(0,0,0,0.4); }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }

    /* ═══════════════════════════════════════
       HOST & PANEL SHELL
       ═══════════════════════════════════════ */

    :host {
      display: block;
    }

    .panel {
      position: relative;
      border: 1px solid color-mix(in srgb, var(--color-warning) 35%, transparent);
      background: color-mix(in srgb, var(--color-surface-sunken) 70%, transparent);
      overflow: hidden;
    }

    /* Parchment grain texture */
    .panel::before {
      content: '';
      position: absolute;
      inset: 0;
      background:
        repeating-linear-gradient(
          0deg,
          transparent,
          transparent 2px,
          rgba(245, 158, 11, 0.018) 2px,
          rgba(245, 158, 11, 0.018) 4px
        );
      animation: scanline-drift 8s linear infinite;
      pointer-events: none;
      z-index: 0;
    }

    /* Corner brackets — top-left */
    .panel::after {
      content: '';
      position: absolute;
      top: 4px;
      left: 4px;
      width: 16px;
      height: 16px;
      border-top: 2px solid color-mix(in srgb, var(--color-warning) 50%, transparent);
      border-left: 2px solid color-mix(in srgb, var(--color-warning) 50%, transparent);
      pointer-events: none;
      z-index: 1;
    }

    .panel__corners {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 1;
    }

    /* Top-right corner */
    .panel__corners::before {
      content: '';
      position: absolute;
      top: 4px;
      right: 4px;
      width: 16px;
      height: 16px;
      border-top: 2px solid color-mix(in srgb, var(--color-warning) 50%, transparent);
      border-right: 2px solid color-mix(in srgb, var(--color-warning) 50%, transparent);
    }

    /* Bottom-left corner */
    .panel__corners::after {
      content: '';
      position: absolute;
      bottom: 4px;
      left: 4px;
      width: 16px;
      height: 16px;
      border-bottom: 2px solid color-mix(in srgb, var(--color-warning) 50%, transparent);
      border-left: 2px solid color-mix(in srgb, var(--color-warning) 50%, transparent);
    }

    /* Bottom-right corner — uses panel body pseudo */
    .panel__corner-br {
      position: absolute;
      bottom: 4px;
      right: 4px;
      width: 16px;
      height: 16px;
      border-bottom: 2px solid color-mix(in srgb, var(--color-warning) 50%, transparent);
      border-right: 2px solid color-mix(in srgb, var(--color-warning) 50%, transparent);
      pointer-events: none;
      z-index: 1;
    }

    /* ═══════════════════════════════════════
       HEADER — CLASSIFIED STAMP BAR
       ═══════════════════════════════════════ */

    .panel__header {
      position: relative;
      z-index: 2;
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-3) var(--space-5);
      border-bottom: 1px solid color-mix(in srgb, var(--color-warning) 30%, transparent);
      background: color-mix(in srgb, var(--color-surface) 30%, transparent);
    }

    .panel__icon {
      color: var(--color-warning);
      flex-shrink: 0;
    }

    .panel__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black, 900);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: 0.15em;
      color: var(--color-warning);
      margin: 0;
    }

    .panel__classification {
      margin-left: auto;
      font-family: var(--font-mono, monospace);
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--color-text-secondary);
      border: 1px solid color-mix(in srgb, var(--color-warning) 30%, transparent);
      padding: 2px var(--space-2);
    }

    .panel__body {
      position: relative;
      z-index: 2;
      padding: var(--space-5);
    }

    /* ═══════════════════════════════════════
       RESPONSE TYPE SELECTOR — ORDER CARDS
       ═══════════════════════════════════════ */

    .types {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      margin-bottom: var(--space-4);
    }

    .type-card {
      position: relative;
      display: flex;
      align-items: flex-start;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      border: 1px solid var(--color-border);
      background: color-mix(in srgb, var(--color-surface-sunken) 50%, transparent);
      cursor: pointer;
      text-align: left;
      color: var(--color-text-primary);
      transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
      min-height: 44px;
      width: 100%;
      overflow: hidden;
    }

    .type-card:hover {
      background: color-mix(in srgb, var(--color-surface-raised) 50%, transparent);
      box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-border) 60%, transparent);
    }

    .type-card:focus-visible {
      outline: 2px solid var(--color-warning);
      outline-offset: 2px;
    }

    /* Accent accents per type */
    .type-card--contain {
      border-left: 3px solid color-mix(in srgb, var(--color-warning) 40%, transparent);
    }
    .type-card--contain:hover,
    .type-card--contain.type-card--selected {
      border-left-color: var(--color-warning);
    }

    .type-card--remediate {
      border-left: 3px solid color-mix(in srgb, var(--color-info) 40%, transparent);
    }
    .type-card--remediate:hover,
    .type-card--remediate.type-card--selected {
      border-left-color: var(--color-info);
    }

    .type-card--adapt {
      border-left: 3px solid color-mix(in srgb, var(--color-success) 40%, transparent);
    }
    .type-card--adapt:hover,
    .type-card--adapt.type-card--selected {
      border-left-color: var(--color-success);
    }

    .type-card--selected {
      background: color-mix(in srgb, var(--color-surface-raised) 60%, transparent);
      border-color: color-mix(in srgb, var(--color-warning) 40%, transparent);
    }

    .type-card__content {
      flex: 1;
      min-width: 0;
    }

    .type-card__label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black, 900);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }

    .type-card--contain .type-card__label { color: var(--color-warning); }
    .type-card--remediate .type-card__label { color: var(--color-info); }
    .type-card--adapt .type-card__label { color: var(--color-success); }

    .type-card__desc {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      line-height: 1.5;
      margin-top: 2px;
    }

    .type-card__cost {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--color-text-secondary);
      margin-top: var(--space-1);
      letter-spacing: 0.04em;
    }

    .type-card__icon {
      flex-shrink: 0;
      margin-top: 2px;
      opacity: 0.85;
    }

    .type-card--contain .type-card__icon { color: var(--color-warning); }
    .type-card--remediate .type-card__icon { color: var(--color-info); }
    .type-card--adapt .type-card__icon { color: var(--color-success); }

    /* ── APPROVED stamp overlay ── */

    .type-card__stamp {
      position: absolute;
      top: 50%;
      right: var(--space-4);
      transform: rotate(-12deg) scale(1);
      transform-origin: center center;
      font-family: var(--font-brutalist);
      font-weight: var(--font-black, 900);
      font-size: 14px;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      padding: 2px var(--space-2);
      border: 2px solid;
      pointer-events: none;
      opacity: 0;
      margin-top: -12px;
    }

    .type-card--selected .type-card__stamp {
      animation: stamp-slam 0.35s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }

    .type-card--contain .type-card__stamp {
      color: var(--color-warning);
      border-color: var(--color-warning);
    }
    .type-card--remediate .type-card__stamp {
      color: var(--color-info);
      border-color: var(--color-info);
    }
    .type-card--adapt .type-card__stamp {
      color: var(--color-success);
      border-color: var(--color-success);
    }

    /* ═══════════════════════════════════════
       AGENT DOSSIER CARDS
       ═══════════════════════════════════════ */

    .agents-section {
      margin-bottom: var(--space-4);
    }

    .agents-section__label {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--color-text-secondary);
      margin-bottom: var(--space-2);
    }

    .agents-grid {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }

    .dossier-card {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      border: 1px solid color-mix(in srgb, var(--color-border) 60%, transparent);
      background: color-mix(in srgb, var(--color-surface) 30%, transparent);
      min-width: 0;
    }

    .dossier-card__portrait {
      width: 28px;
      height: 28px;
      border: 1px solid color-mix(in srgb, var(--color-warning) 30%, transparent);
      flex-shrink: 0;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      background: color-mix(in srgb, var(--color-surface-sunken) 50%, transparent);
    }

    .dossier-card__portrait img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .dossier-card__portrait-placeholder {
      color: var(--color-text-muted);
      opacity: 0.6;
    }

    .dossier-card__name {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      font-weight: 600;
      color: var(--color-text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 120px;
    }

    .dossier-card__role {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      color: var(--color-text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .dossier-card__info {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    /* ═══════════════════════════════════════
       DEPLOY BUTTON
       ═══════════════════════════════════════ */

    .submit-row {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      margin-top: var(--space-4);
    }

    .submit-btn {
      position: relative;
      font-family: var(--font-brutalist);
      font-weight: var(--font-black, 900);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: 0.15em;
      padding: var(--space-3) var(--space-6);
      background: var(--color-warning);
      border: 2px solid var(--color-warning);
      color: var(--color-surface-sunken, #0a0a0f);
      cursor: pointer;
      transition: transform 0.15s, box-shadow 0.15s, background 0.15s;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      min-height: 44px;
    }

    .submit-btn:hover:not(:disabled) {
      background: color-mix(in srgb, var(--color-warning) 90%, white);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.5);
    }

    .submit-btn:active:not(:disabled) {
      animation: stamp-press 0.25s ease-out;
    }

    .submit-btn:focus-visible {
      outline: 2px solid var(--color-warning);
      outline-offset: 3px;
    }

    .submit-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      box-shadow: none;
    }

    .submit-btn__icon {
      display: inline-flex;
      vertical-align: middle;
      margin-right: var(--space-1);
    }

    .cancel-btn {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--color-text-secondary);
      background: transparent;
      border: 1px solid var(--color-border);
      padding: var(--space-2) var(--space-4);
      cursor: pointer;
      transition: color 0.15s, border-color 0.15s;
      min-height: 44px;
    }

    .cancel-btn:hover {
      color: var(--color-text-secondary);
      border-color: var(--color-text-muted);
    }

    .cancel-btn:focus-visible {
      outline: 2px solid var(--color-warning);
      outline-offset: 2px;
    }

    /* ═══════════════════════════════════════
       PENDING STATUS — DISPATCH IN PROGRESS
       ═══════════════════════════════════════ */

    .pending-dispatch {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      border: 1px solid color-mix(in srgb, var(--color-warning) 30%, transparent);
      background: color-mix(in srgb, var(--color-warning) 5%, transparent);
    }

    .pending-dispatch__indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--color-warning);
      animation: pulse-amber 1.5s ease-in-out infinite;
      flex-shrink: 0;
    }

    .pending-dispatch__label {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--color-warning);
    }

    .pending-dispatch__detail {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
    }

    /* ═══════════════════════════════════════
       RESPONSE HISTORY — FILED CASE DOCUMENTS
       ═══════════════════════════════════════ */

    .history {
      margin-top: var(--space-5);
      border-top: 1px solid color-mix(in srgb, var(--color-warning) 20%, transparent);
      padding-top: var(--space-4);
    }

    .history__header {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin-bottom: var(--space-3);
    }

    .history__icon {
      color: var(--color-text-muted);
    }

    .history__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      color: var(--color-text-secondary);
    }

    .history-entry {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-3);
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      border: 1px solid color-mix(in srgb, var(--color-border) 40%, transparent);
      background: color-mix(in srgb, var(--color-surface) 20%, transparent);
      margin-bottom: var(--space-2);
      position: relative;
    }

    /* Left border accent by status */
    .history-entry--resolved {
      border-left: 3px solid var(--color-success);
    }
    .history-entry--pending {
      border-left: 3px solid var(--color-warning);
    }
    .history-entry--failed {
      border-left: 3px solid var(--color-danger);
    }
    .history-entry--expired {
      border-left: 3px solid var(--color-text-muted);
    }
    .history-entry--resolving {
      border-left: 3px solid var(--color-info);
    }

    .history-entry__status {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      padding: 1px 6px;
      border: 1px solid;
      flex-shrink: 0;
    }

    .history-entry__status--resolved {
      color: var(--color-success);
      border-color: color-mix(in srgb, var(--color-success) 40%, transparent);
    }

    .history-entry__status--pending {
      color: var(--color-warning);
      border-color: color-mix(in srgb, var(--color-warning) 40%, transparent);
      animation: pulse-amber 1.5s ease-in-out infinite;
    }

    .history-entry__status--failed {
      color: var(--color-danger);
      border-color: color-mix(in srgb, var(--color-danger) 40%, transparent);
    }

    .history-entry__status--expired {
      color: var(--color-text-secondary);
      border-color: color-mix(in srgb, var(--color-text-secondary) 40%, transparent);
    }

    .history-entry__status--resolving {
      color: var(--color-info);
      border-color: color-mix(in srgb, var(--color-info) 40%, transparent);
    }

    .history-entry__type {
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .history-entry__agents {
      color: var(--color-text-secondary);
    }

    .history-entry__eff {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: var(--space-2);
      flex-shrink: 0;
    }

    /* Effectiveness meter */
    .eff-meter {
      display: flex;
      align-items: center;
      gap: var(--space-1);
    }

    .eff-meter__bar {
      width: 48px;
      height: 4px;
      background: color-mix(in srgb, var(--color-border) 40%, transparent);
      position: relative;
      overflow: hidden;
    }

    .eff-meter__fill {
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      background: var(--color-success);
      transition: width 0.4s ease-out;
    }

    .eff-meter__value {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      font-weight: 700;
      color: var(--color-success);
      min-width: 28px;
      text-align: right;
    }

    /* ═══════════════════════════════════════
       ERROR
       ═══════════════════════════════════════ */

    .error-msg {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      color: var(--color-danger);
      margin-top: var(--space-3);
      padding: var(--space-2) var(--space-3);
      border: 1px solid color-mix(in srgb, var(--color-danger) 30%, transparent);
      background: color-mix(in srgb, var(--color-danger) 5%, transparent);
    }

    .error-msg__icon {
      flex-shrink: 0;
      color: var(--color-danger);
    }

    /* ═══════════════════════════════════════
       RESPONSIVE
       ═══════════════════════════════════════ */

    @media (max-width: 480px) {
      .panel__header {
        padding: var(--space-3);
      }

      .panel__body {
        padding: var(--space-3);
      }

      .panel__classification {
        display: none;
      }

      .type-card {
        padding: var(--space-3);
      }

      .type-card__stamp {
        font-size: 11px;
        right: var(--space-2);
      }

      .history-entry {
        flex-wrap: wrap;
        gap: var(--space-2);
      }

      .history-entry__eff {
        margin-left: 0;
        width: 100%;
      }

      .submit-btn {
        padding: var(--space-3) var(--space-4);
        font-size: var(--text-xs);
        width: 100%;
      }

      .cancel-btn {
        width: 100%;
      }

      .submit-row {
        flex-direction: column;
      }

      .dossier-card__name {
        max-width: 80px;
      }
    }
  `];

  @property({ type: String }) simulationId = '';
  @property({ type: String }) eventId = '';
  @property({ type: Array }) agents: Agent[] = [];

  @state() private _selectedType: BureauResponseType | null = null;
  @state() private _responses: BureauResponse[] = [];
  @state() private _loading = false;
  @state() private _error = '';

  connectedCallback(): void {
    super.connectedCallback();
    if (this.simulationId && this.eventId) {
      this._loadResponses();
    }
  }

  private async _loadResponses(): Promise<void> {
    const res = await heartbeatApi.listResponses(this.simulationId, this.eventId);
    if (res.success && res.data) {
      this._responses = res.data as BureauResponse[];
    }
  }

  private get _hasPending(): boolean {
    return this._responses.some((r) => r.status === 'pending');
  }

  private _getAssignedAgents(): Agent[] {
    if (!this._selectedType || this._selectedType === 'adapt') return [];
    const count = this._selectedType === 'remediate' ? 2 : 1;
    return this.agents.slice(0, count);
  }

  private async _submitResponse(): Promise<void> {
    if (!this._selectedType || this._hasPending) return;
    this._loading = true;
    this._error = '';

    const agentIds =
      this._selectedType === 'adapt'
        ? []
        : this.agents.slice(0, this._selectedType === 'remediate' ? 2 : 1).map((a) => a.id);

    if (this._selectedType !== 'adapt' && agentIds.length === 0) {
      this._error = msg('No agents available in this zone.');
      this._loading = false;
      return;
    }

    const res = await heartbeatApi.createResponse(this.simulationId, this.eventId, {
      response_type: this._selectedType,
      assigned_agent_ids: agentIds,
    });

    if (res.success) {
      await this._loadResponses();
      VelgToast.success(msg('Bureau response deployed. Will resolve at next tick.'));
      this._selectedType = null;
    } else {
      this._error = res.error?.message ?? msg('Failed to create response.');
      VelgToast.error(this._error);
    }
    this._loading = false;
  }

  private _cancelSelection(): void {
    this._selectedType = null;
    this._error = '';
  }

  protected render() {
    return html`
      <div class="panel">
        <div class="panel__corners"></div>
        <div class="panel__corner-br"></div>

        <div class="panel__header">
          <span class="panel__icon">${icons.stampClassified(16)}</span>
          <h3 class="panel__title">
            ${msg('Bureau Field Response')}
            ${renderInfoBubble(msg('Assign agents to contain, remediate, or adapt to active events. Responses resolve at the next heartbeat tick. Contain reduces pressure, remediate can resolve events, adapt reduces accumulated scar tissue.'))}
          </h3>
          <span class="panel__classification">${msg('Classified')}</span>
        </div>

        <div class="panel__body">
          ${this._hasPending ? this._renderPendingDispatch() : this._renderTypeSelector()}
          ${this._error
            ? html`<div class="error-msg" role="alert">
                <span class="error-msg__icon">${icons.alertTriangle(14)}</span>
                ${this._error}
              </div>`
            : nothing}
          ${this._responses.length > 0 ? this._renderHistory() : nothing}
        </div>
      </div>
    `;
  }

  private _renderPendingDispatch() {
    return html`
      <div class="pending-dispatch">
        <div class="pending-dispatch__indicator" aria-hidden="true"></div>
        <span class="pending-dispatch__label">${msg('Dispatch Active')}</span>
        <span class="pending-dispatch__detail">${msg('Response resolves at next tick.')}</span>
      </div>
    `;
  }

  private _renderTypeSelector() {
    const typeIcons: Record<BureauResponseType, ReturnType<typeof icons.target>> = {
      contain: icons.fortify(16),
      remediate: icons.target(16),
      adapt: icons.compassRose(16),
    };

    return html`
      <div class="types" role="radiogroup" aria-label=${msg('Response type')}>
        ${(Object.keys(RESPONSE_DESCRIPTIONS) as BureauResponseType[]).map((type) => {
          const info = RESPONSE_DESCRIPTIONS[type];
          const selected = this._selectedType === type;
          return html`
            <button
              class="type-card type-card--${type} ${selected ? 'type-card--selected' : ''}"
              role="radio"
              aria-checked=${selected}
              @click=${() => { this._selectedType = type; }}
            >
              <span class="type-card__icon">${typeIcons[type]}</span>
              <div class="type-card__content">
                <div class="type-card__label">${msg(info.label)}</div>
                <div class="type-card__desc">${msg(info.desc)}</div>
                <div class="type-card__cost">${msg(info.cost)}</div>
              </div>
              <span class="type-card__stamp" aria-hidden="true">${msg('Approved')}</span>
            </button>
          `;
        })}
      </div>

      ${this._selectedType ? this._renderAgentAssignment() : nothing}

      <div class="submit-row">
        <button
          class="submit-btn"
          ?disabled=${!this._selectedType || this._loading}
          @click=${this._submitResponse}
          aria-label=${msg('Deploy Response')}
        >
          <span class="submit-btn__icon">${icons.deploy(14)}</span>
          ${this._loading ? msg('Dispatching...') : msg('Deploy Response')}
        </button>
        ${this._selectedType
          ? html`<button
              class="cancel-btn"
              @click=${this._cancelSelection}
              aria-label=${msg('Cancel selection')}
            >${msg('Cancel')}</button>`
          : nothing}
      </div>
    `;
  }

  private _renderAgentAssignment() {
    const assigned = this._getAssignedAgents();
    if (assigned.length === 0) return nothing;

    return html`
      <div class="agents-section">
        <div class="agents-section__label">${msg('Assigned Operatives')}</div>
        <div class="agents-grid">
          ${assigned.map(
            (agent) => html`
              <div class="dossier-card">
                <div class="dossier-card__portrait">
                  ${agent.portrait_image_url
                    ? html`<img
                        src=${agent.portrait_image_url}
                        alt=${agent.name}
                        loading="lazy"
                      />`
                    : html`<span class="dossier-card__portrait-placeholder">${icons.users(16)}</span>`}
                </div>
                <div class="dossier-card__info">
                  <span class="dossier-card__name">${agent.name}</span>
                  ${agent.primary_profession
                    ? html`<span class="dossier-card__role">${agent.primary_profession}</span>`
                    : nothing}
                </div>
              </div>
            `,
          )}
        </div>
      </div>
    `;
  }

  private _renderHistory() {
    return html`
      <div class="history">
        <div class="history__header">
          <span class="history__icon">${icons.clipboard(14)}</span>
          <div class="history__title">${msg('Response Archive')}</div>
        </div>
        ${this._responses.map(
          (r) => html`
            <div class="history-entry history-entry--${r.status}">
              <span class="history-entry__status history-entry__status--${r.status}">
                ${r.status}
              </span>
              <span class="history-entry__type">${r.response_type}</span>
              <span class="history-entry__agents">
                ${r.agent_count} ${msg('agent(s)')}
              </span>
              <span class="history-entry__eff">
                ${r.status === 'resolved'
                  ? html`
                      <span class="eff-meter">
                        <span class="eff-meter__bar">
                          <span
                            class="eff-meter__fill"
                            style="width: ${(r.effectiveness * 100).toFixed(0)}%"
                          ></span>
                        </span>
                        <span class="eff-meter__value">
                          ${(r.effectiveness * 100).toFixed(0)}%
                        </span>
                      </span>
                    `
                  : nothing}
              </span>
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
