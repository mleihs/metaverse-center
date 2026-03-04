/**
 * Epoch Lobby Actions — join/leave/start buttons, admin controls,
 * and deployment roster shown below the banner when an epoch is selected.
 *
 * Extracted from EpochCommandCenter.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { BotPersonality, Epoch, EpochParticipant, Simulation } from '../../types/index.js';
import { PERSONALITY_COLORS } from '../../utils/bot-colors.js';
import { icons } from '../../utils/icons.js';

/** Personality abbreviations for roster badges */
const PERSONALITY_ABBR: Record<BotPersonality, string> = {
  sentinel: 'SNTL',
  warlord: 'WLRD',
  diplomat: 'DIPL',
  strategist: 'STRT',
  chaos: 'KAOS',
};

/** Bot personality → icon function */
const PERSONALITY_ICONS: Record<BotPersonality, (size?: number) => unknown> = {
  sentinel: icons.botSentinel,
  warlord: icons.botWarlord,
  diplomat: icons.botDiplomat,
  strategist: icons.botStrategist,
  chaos: icons.botChaos,
};

@localized()
@customElement('velg-epoch-lobby-actions')
export class VelgEpochLobbyActions extends LitElement {
  static styles = css`
    :host {
      display: block;
      max-width: var(--container-2xl, 1400px);
      margin: 0 auto;
      padding: 0 var(--space-6);
    }

    /* ── Lobby Actions ─────────────────────── */

    .lobby-actions {
      display: flex;
      gap: var(--space-2);
      margin-top: var(--space-4);
      flex-wrap: wrap;
      align-items: flex-start;
    }

    .lobby-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-4);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      border: 2px solid;
      cursor: pointer;
      transition: all var(--transition-normal);
    }

    .lobby-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .lobby-btn--start {
      color: var(--color-gray-950);
      border-color: var(--color-gray-100);
      background: var(--color-gray-100);
    }

    .lobby-btn--start:hover:not(:disabled) {
      transform: translate(-2px, -2px);
      box-shadow: 4px 4px 0 var(--color-gray-600);
    }

    .lobby-btn--start:active:not(:disabled) {
      transform: translate(0);
      box-shadow: none;
    }

    .lobby-btn--bots {
      color: var(--color-warning);
      border-color: var(--color-warning);
      background: transparent;
    }

    .lobby-btn--bots:hover:not(:disabled) {
      background: color-mix(in srgb, var(--color-warning) 15%, transparent);
      box-shadow: 0 0 10px color-mix(in srgb, var(--color-warning) 20%, transparent);
    }

    .lobby-btn--invite {
      color: var(--color-success);
      border-color: var(--color-success);
      background: transparent;
    }

    .lobby-btn--invite:hover:not(:disabled) {
      background: color-mix(in srgb, var(--color-success) 15%, transparent);
    }

    .lobby-btn--delete {
      color: var(--color-danger);
      border-color: var(--color-danger);
      background: transparent;
    }

    .lobby-btn--delete:hover:not(:disabled) {
      background: color-mix(in srgb, var(--color-danger) 15%, transparent);
      box-shadow: 0 0 10px color-mix(in srgb, var(--color-danger) 20%, transparent);
    }

    .lobby-btn--draft {
      color: var(--color-epoch-accent, #f59e0b);
      border-color: var(--color-epoch-accent, #f59e0b);
      background: transparent;
    }

    .lobby-btn--draft:hover:not(:disabled) {
      background: color-mix(in srgb, var(--color-epoch-accent, #f59e0b) 15%, transparent);
      box-shadow: 0 0 10px color-mix(in srgb, var(--color-epoch-accent, #f59e0b) 20%, transparent);
    }

    .draft-status {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      padding: var(--space-2) var(--space-4);
      border: 2px solid var(--color-success);
      color: var(--color-success);
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
    }

    .draft-status--pending {
      border-color: var(--color-gray-600);
      color: var(--color-gray-400);
    }

    /* ── Simulation Picker ─────────────────── */

    .sim-picker {
      display: flex;
      gap: var(--space-2);
      flex-wrap: wrap;
      margin-bottom: var(--space-3);
    }

    .sim-picker__label {
      width: 100%;
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--color-gray-500);
      margin-bottom: var(--space-1);
    }

    .sim-picker__label::before { content: '[ '; color: var(--color-gray-600); }
    .sim-picker__label::after { content: ' ]'; color: var(--color-gray-600); }

    /* Individual faction card */
    .faction-card {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-4);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      border: 2px solid var(--color-gray-600);
      color: var(--color-gray-300);
      background: transparent;
      cursor: pointer;
      overflow: hidden;
      opacity: 0;
      animation: faction-enter var(--duration-entrance, 350ms) var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) forwards;
      animation-delay: calc(var(--i, 0) * var(--duration-stagger, 40ms));
      transition:
        border-color 200ms,
        color 200ms,
        background 200ms,
        box-shadow 200ms;
    }

    .faction-card::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, transparent 40%, currentColor);
      opacity: 0;
      transition: opacity 200ms;
      pointer-events: none;
    }

    .faction-card:hover:not(:disabled) {
      border-color: var(--color-success);
      color: var(--color-success);
    }

    .faction-card:hover:not(:disabled)::before {
      opacity: 0.06;
    }

    .faction-card:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }

    .faction-card__plus {
      font-size: 14px;
      line-height: 1;
      opacity: 0.5;
      transition: opacity 200ms;
    }

    .faction-card:hover:not(:disabled) .faction-card__plus {
      opacity: 1;
    }

    @keyframes faction-enter {
      from { opacity: 0; transform: translateY(6px) scale(0.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    /* ── Deployed / Locked-in state ────────── */

    .deployed {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      margin-bottom: var(--space-3);
      animation: deployed-enter var(--duration-entrance, 350ms) var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) both;
    }

    @keyframes deployed-enter {
      from { opacity: 0; transform: scale(0.96); }
      to { opacity: 1; transform: scale(1); }
    }

    .deployed__card {
      position: relative;
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2-5) var(--space-4) var(--space-2-5) var(--space-3);
      border: 2px solid var(--color-success);
      background: color-mix(in srgb, var(--color-success) 6%, transparent);
      box-shadow:
        0 0 12px color-mix(in srgb, var(--color-success) 15%, transparent),
        inset 0 0 20px color-mix(in srgb, var(--color-success) 4%, transparent);
      animation: deployed-glow 3s ease-in-out infinite;
    }

    @keyframes deployed-glow {
      0%, 100% { box-shadow: 0 0 12px color-mix(in srgb, var(--color-success) 15%, transparent), inset 0 0 20px color-mix(in srgb, var(--color-success) 4%, transparent); }
      50% { box-shadow: 0 0 20px color-mix(in srgb, var(--color-success) 25%, transparent), inset 0 0 30px color-mix(in srgb, var(--color-success) 8%, transparent); }
    }

    /* Corner brackets on deployed card */
    .deployed__card::before,
    .deployed__card::after {
      content: '';
      position: absolute;
      width: 8px;
      height: 8px;
      border-color: var(--color-success);
      border-style: solid;
      opacity: 0.6;
    }

    .deployed__card::before {
      top: -1px;
      left: -1px;
      border-width: 2px 0 0 2px;
    }

    .deployed__card::after {
      bottom: -1px;
      right: -1px;
      border-width: 0 2px 2px 0;
    }

    .deployed__status {
      font-family: var(--font-mono, monospace);
      font-size: 8px;
      letter-spacing: 2.5px;
      text-transform: uppercase;
      color: var(--color-success);
      padding: 2px 6px;
      border: 1px solid color-mix(in srgb, var(--color-success) 40%, transparent);
      white-space: nowrap;
    }

    .deployed__name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-gray-100);
    }

    .deployed__dismiss {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      margin-left: var(--space-3);
      border: 2px solid var(--color-gray-600);
      background: color-mix(in srgb, var(--color-gray-800) 60%, transparent);
      color: var(--color-gray-300);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: 14px;
      line-height: 1;
      cursor: pointer;
      transition: all 150ms;
    }

    .deployed__dismiss:hover {
      border-color: var(--color-danger);
      color: var(--color-danger);
      background: color-mix(in srgb, var(--color-danger) 15%, transparent);
      box-shadow: 0 0 8px color-mix(in srgb, var(--color-danger) 25%, transparent);
    }

    .deployed__dismiss:focus-visible {
      outline: 2px solid var(--color-danger);
      outline-offset: 2px;
    }

    /* Scan line on deployed card */
    .deployed__scan {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 2px;
      background: linear-gradient(90deg, transparent, var(--color-success), transparent);
      opacity: 0.4;
      animation: deployed-scan 2.5s linear infinite;
    }

    @keyframes deployed-scan {
      from { top: 0; }
      to { top: 100%; }
    }

    /* ── Deployment Roster ─────────────────── */

    .roster {
      margin-top: var(--space-5);
    }

    .roster__header {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin-bottom: var(--space-3);
    }

    .roster__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: 10px;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: var(--color-gray-400);
      margin: 0;
    }

    .roster__title::before {
      content: '┌─ ';
      color: var(--color-epoch-accent, #f59e0b);
      opacity: 0.5;
    }

    .roster__title::after {
      content: ' ─┐';
      color: var(--color-epoch-accent, #f59e0b);
      opacity: 0.5;
    }

    .roster__count {
      margin-left: auto;
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      letter-spacing: 1px;
      color: var(--color-gray-400);
      padding: 2px 8px;
      border: 1px solid var(--color-gray-800);
    }

    .roster__count-num {
      color: var(--color-epoch-accent, #f59e0b);
    }

    .roster__grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: var(--space-2);
    }

    @media (max-width: 600px) {
      .roster__grid {
        grid-template-columns: 1fr;
      }
    }

    /* ── Occupied slot ── */

    .slot {
      display: grid;
      grid-template-columns: 32px 1fr auto;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      background: var(--color-gray-900);
      border: 1px solid var(--color-gray-800);
      border-left: 3px solid var(--slot-accent, var(--color-success));
      opacity: 0;
      animation: slot-enter 300ms ease forwards;
      animation-delay: calc(var(--i, 0) * 60ms);
      transition: border-color var(--transition-normal), background var(--transition-normal);
    }

    .slot:hover {
      background: color-mix(in srgb, var(--slot-accent, var(--color-success)) 5%, var(--color-gray-900));
    }

    @keyframes slot-enter {
      from {
        opacity: 0;
        transform: translateX(-8px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    .slot__icon {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--slot-accent, var(--color-success));
      border: 1px solid var(--slot-accent, var(--color-success));
      background: color-mix(in srgb, var(--slot-accent, var(--color-success)) 8%, transparent);
    }

    .slot__info {
      display: flex;
      flex-direction: column;
      gap: 1px;
      min-width: 0;
    }

    .slot__name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      color: var(--color-gray-100);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .slot__tag {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: var(--slot-accent, var(--color-success));
    }

    .slot__status {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      letter-spacing: 1px;
      text-transform: uppercase;
      padding: 2px 6px;
      border: 1px solid;
      white-space: nowrap;
    }

    .slot__status--drafted {
      color: var(--color-success);
      border-color: var(--color-success);
    }

    .slot__status--pending {
      color: var(--color-gray-400);
      border-color: var(--color-gray-600);
    }

    /* ── Vacant slot ── */

    .slot--vacant {
      border: 1px dashed var(--color-gray-600);
      border-left: 3px dashed var(--color-gray-600);
      background: transparent;
      opacity: 0;
      animation: slot-enter 300ms ease forwards;
      animation-delay: calc(var(--i, 0) * 60ms);
    }

    .slot--vacant .slot__icon {
      color: var(--color-gray-400);
      border: 1px dashed var(--color-gray-500);
      background: transparent;
      animation: vacant-pulse 3s ease-in-out infinite;
    }

    @keyframes vacant-pulse {
      0%, 100% {
        border-color: var(--color-gray-500);
        color: var(--color-gray-400);
      }
      50% {
        border-color: color-mix(in srgb, var(--color-epoch-accent, #f59e0b) 50%, transparent);
        color: color-mix(in srgb, var(--color-epoch-accent, #f59e0b) 40%, transparent);
      }
    }

    .slot--vacant .slot__name {
      color: var(--color-gray-400);
      font-size: 10px;
      letter-spacing: 2px;
    }

    .slot--vacant .slot__tag {
      color: var(--color-gray-400);
    }

    /* ── Admin Controls ────────────────────── */

    .admin-panel {
      margin-top: var(--space-3);
      border: 1px solid var(--color-gray-800);
      overflow: hidden;
    }

    .admin-toggle {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      padding: var(--space-2) var(--space-3);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-warning);
      background: var(--color-gray-900);
      border: none;
      cursor: pointer;
      transition: background var(--transition-normal);
    }

    .admin-toggle:hover {
      background: var(--color-gray-800);
    }

    .admin-toggle__chevron {
      transition: transform var(--transition-normal);
      font-size: var(--text-xs);
    }

    .admin-toggle__chevron--open {
      transform: rotate(180deg);
    }

    .admin-body {
      display: flex;
      gap: var(--space-2);
      flex-wrap: wrap;
      padding: var(--space-3);
      border-top: 1px solid var(--color-gray-800);
      background: var(--color-gray-950);
    }

    .admin-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      padding: var(--space-1-5) var(--space-3);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      border: 1px solid;
      cursor: pointer;
      transition: all var(--transition-normal);
    }

    .admin-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .admin-btn--advance {
      color: var(--color-success);
      border-color: var(--color-success);
      background: transparent;
    }

    .admin-btn--advance:hover:not(:disabled) {
      background: color-mix(in srgb, var(--color-success) 15%, transparent);
    }

    .admin-btn--resolve {
      color: var(--color-warning);
      border-color: var(--color-warning);
      background: transparent;
    }

    .admin-btn--resolve:hover:not(:disabled) {
      background: color-mix(in srgb, var(--color-warning) 15%, transparent);
    }

    .admin-btn--cancel {
      color: var(--color-danger);
      border-color: var(--color-danger);
      background: transparent;
    }

    .admin-btn--cancel:hover:not(:disabled) {
      background: color-mix(in srgb, var(--color-danger) 15%, transparent);
    }

    /* ── Lobby hint ─────────────────────── */

    .lobby-hint {
      width: 100%;
      margin: var(--space-1) 0 0;
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: var(--color-epoch-accent, #f59e0b);
    }

    /* ── Reduced motion ── */
    @media (prefers-reduced-motion: reduce) {
      .slot,
      .slot--vacant,
      .faction-card,
      .deployed {
        animation: none;
        opacity: 1;
      }

      .slot--vacant .slot__icon,
      .deployed__card,
      .deployed__scan {
        animation: none;
      }
    }
  `;

  @property({ type: Object }) epoch: Epoch | null = null;
  @property({ type: Object }) myParticipant: EpochParticipant | null = null;
  @property({ type: Array }) participants: EpochParticipant[] = [];
  @property({ type: Array }) simulations: Simulation[] = [];
  @property({ type: String }) userId = '';
  @property({ type: Boolean }) actionLoading = false;

  @state() private _showAdminPanel = false;

  protected render() {
    if (!this.epoch) return nothing;

    const isLobby = this.epoch.status === 'lobby';
    const isCancelled = this.epoch.status === 'cancelled';
    const isActive = ['foundation', 'competition', 'reckoning'].includes(this.epoch.status);
    const isCreator = this.epoch.created_by_id === this.userId;
    const participantSimIds = this.participants.map((p) => p.simulation_id);
    // Only show template simulations for joining (not game instances or archived)
    const joinableSims = this.simulations.filter(
      (s) =>
        !participantSimIds.includes(s.id) &&
        (!s.simulation_type || s.simulation_type === 'template'),
    );
    // Creator must have joined with at least one simulation (human participant)
    const creatorHasJoined = isCreator
      ? this.participants.some((p) => !p.is_bot && p.user_id === this.userId)
      : true;

    return html`
      ${
        isLobby
          ? html`
        ${this._renderSimPicker(joinableSims)}
        <div class="lobby-actions">
          ${
            this.myParticipant
              ? html`
            ${
              this.myParticipant.draft_completed_at
                ? html`
                  <span class="draft-status">
                    ${msg(str`Roster Locked (${this.myParticipant.drafted_agent_ids?.length ?? 0}/${this.epoch?.config?.max_agents_per_player ?? 6})`)}
                  </span>
                `
                : html`
                  <button
                    class="lobby-btn lobby-btn--draft"
                    ?disabled=${this.actionLoading}
                    @click=${this._onDraftRoster}
                  >${msg('Draft Roster')}</button>
                `
            }
          `
              : nothing
          }
          ${
            isCreator
              ? html`
            <button
              class="lobby-btn lobby-btn--bots"
              @click=${this._onAddBots}
            >${msg('Add Bots')}</button>
            <button
              class="lobby-btn lobby-btn--invite"
              @click=${this._onInvitePlayers}
            >${msg('Invite Players')}</button>
            <button
              class="lobby-btn lobby-btn--start"
              ?disabled=${this.actionLoading || this.participants.length < 2 || !creatorHasJoined}
              @click=${this._onStartEpoch}
            >${msg('Start Epoch')}</button>
            <button
              class="lobby-btn lobby-btn--delete"
              ?disabled=${this.actionLoading}
              @click=${this._onDeleteEpoch}
            >${msg('Delete Epoch')}</button>
          `
              : nothing
          }
          ${isCreator && !creatorHasJoined ? html`<p class="lobby-hint">${msg('Join with a simulation before starting the epoch.')}</p>` : nothing}
        </div>
        ${this._renderRoster()}
      `
          : nothing
      }
      ${
        isCancelled && isCreator
          ? html`
        <div class="lobby-actions">
          <button
            class="lobby-btn lobby-btn--delete"
            ?disabled=${this.actionLoading}
            @click=${this._onDeleteEpoch}
          >${msg('Delete Epoch')}</button>
        </div>
      `
          : nothing
      }
      ${isActive && isCreator ? this._renderAdminControls() : nothing}
    `;
  }

  // ── Simulation Picker ────────────────────────────

  private _renderSimPicker(joinableSims: import('../../types/index.js').Simulation[]) {
    // State: user has joined → show locked-in deployment card
    if (this.myParticipant) {
      const simName = this.myParticipant.simulations?.name ?? msg('Unknown Simulation');
      return html`
        <div class="deployed">
          <div class="deployed__card">
            <div class="deployed__scan"></div>
            <span class="deployed__status">${msg('Deployed')}</span>
            <span class="deployed__name">${simName}</span>
            <button
              class="deployed__dismiss"
              aria-label=${msg('Leave Epoch')}
              ?disabled=${this.actionLoading}
              @click=${this._onLeaveEpoch}
              title=${msg('Leave Epoch')}
            >${icons.close(14)}</button>
          </div>
        </div>
      `;
    }

    // State: not joined → show faction picker
    if (joinableSims.length === 0) return nothing;

    return html`
      <div class="sim-picker" role="group" aria-label=${msg('Select Faction')}>
        <span class="sim-picker__label" aria-hidden="true">${msg('Select Faction')}</span>
        ${joinableSims.map(
          (sim, i) => html`
          <button
            class="faction-card"
            style="--i:${i}"
            ?disabled=${this.actionLoading}
            aria-label=${msg(str`Join as ${sim.name}`)}
            @click=${() => this._onJoinEpoch(sim.id)}
          ><span class="faction-card__plus" aria-hidden="true">+</span> ${sim.name}</button>
        `,
        )}
      </div>
    `;
  }

  // ── Deployment Roster ─────────────────────────────

  private _renderRoster() {
    const maxSlots = 8;
    const occupied = this.participants.length;
    const vacantCount = Math.min(2, Math.max(0, maxSlots - occupied));

    return html`
      <div class="roster" role="region" aria-label=${msg('Deployment Roster')}>
        <div class="roster__header">
          <h3 class="roster__title">${msg('Deployment Roster')}</h3>
          <span class="roster__count">
            <span class="roster__count-num">${occupied}</span>/${maxSlots} ${msg('ACTIVE')}
          </span>
        </div>
        <div class="roster__grid" role="list" aria-label=${msg('Lobby participants')}>
          ${this.participants.map((p, i) => this._renderOccupiedSlot(p, i))}
          ${Array.from({ length: vacantCount }, (_, i) => this._renderVacantSlot(occupied + i))}
        </div>
      </div>
    `;
  }

  private _renderOccupiedSlot(p: EpochParticipant, index: number) {
    const simName = p.simulations?.name ?? msg('Unknown');
    const isBot = p.is_bot;
    const personality = (p.bot_players?.personality ?? 'sentinel') as BotPersonality;
    const accentColor = isBot
      ? (PERSONALITY_COLORS[personality] ?? PERSONALITY_COLORS.sentinel)
      : 'var(--color-success)';
    const abbr = isBot ? (PERSONALITY_ABBR[personality] ?? 'BOT') : '';
    const iconFn = isBot ? PERSONALITY_ICONS[personality] : null;
    const hasDrafted = !!p.draft_completed_at;

    return html`
      <div
        class="slot"
        style="--i:${index}; --slot-accent:${accentColor}"
        role="listitem"
        aria-label=${isBot ? msg(str`Bot: ${simName}`) : msg(str`Player: ${simName}`)}
      >
        <div class="slot__icon">
          ${isBot && iconFn ? iconFn(18) : icons.users(18)}
        </div>
        <div class="slot__info">
          <span class="slot__name">${simName}</span>
          <span class="slot__tag">
            ${isBot ? html`BOT &middot; ${abbr}` : msg('Operator')}
          </span>
        </div>
        ${
          hasDrafted
            ? html`<span class="slot__status slot__status--drafted">${msg('Ready')}</span>`
            : html`<span class="slot__status slot__status--pending">${msg('Pending')}</span>`
        }
      </div>
    `;
  }

  private _renderVacantSlot(index: number) {
    return html`
      <div
        class="slot slot--vacant"
        style="--i:${index}"
        role="listitem"
        aria-label=${msg('Vacant slot')}
      >
        <div class="slot__icon">${icons.target(16)}</div>
        <div class="slot__info">
          <span class="slot__name">${msg('Awaiting Signal')}</span>
          <span class="slot__tag">SLOT-${String(index + 1).padStart(2, '0')}</span>
        </div>
      </div>
    `;
  }

  // ── Admin Controls ─────────────────────────────

  private _renderAdminControls() {
    if (!this.epoch) return nothing;

    const nextPhaseMap: Record<string, string> = {
      foundation: 'Competition',
      competition: 'Reckoning',
      reckoning: 'Completed',
    };
    const nextPhase = nextPhaseMap[this.epoch.status] ?? '?';

    return html`
      <div class="admin-panel">
        <button
          class="admin-toggle"
          aria-expanded=${this._showAdminPanel}
          @click=${() => {
            this._showAdminPanel = !this._showAdminPanel;
          }}
        >
          <span>${msg('Admin Controls')}</span>
          <span class="admin-toggle__chevron ${this._showAdminPanel ? 'admin-toggle__chevron--open' : ''}">&#9660;</span>
        </button>
        ${
          this._showAdminPanel
            ? html`
          <div class="admin-body">
            <button
              class="admin-btn admin-btn--advance"
              ?disabled=${this.actionLoading}
              @click=${this._onAdvancePhase}
            >${msg(str`Advance to ${nextPhase}`)}</button>
            <button
              class="admin-btn admin-btn--resolve"
              ?disabled=${this.actionLoading}
              @click=${this._onResolveCycle}
            >${msg('Resolve Cycle')}</button>
            <button
              class="admin-btn admin-btn--cancel"
              ?disabled=${this.actionLoading}
              @click=${this._onCancelEpoch}
            >${msg('Cancel Epoch')}</button>
          </div>
        `
            : nothing
        }
      </div>
    `;
  }

  // ── Event Dispatchers ───────────────────────────

  private _onJoinEpoch(simulationId: string) {
    this.dispatchEvent(
      new CustomEvent('join-epoch', {
        detail: { simulationId },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _onLeaveEpoch() {
    this.dispatchEvent(
      new CustomEvent('leave-epoch', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _onStartEpoch() {
    this.dispatchEvent(
      new CustomEvent('start-epoch', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _onInvitePlayers() {
    this.dispatchEvent(
      new CustomEvent('invite-players', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _onDraftRoster() {
    this.dispatchEvent(
      new CustomEvent('draft-roster', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _onDeleteEpoch() {
    this.dispatchEvent(
      new CustomEvent('delete-epoch', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _onAddBots() {
    this.dispatchEvent(
      new CustomEvent('add-bots', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _onAdvancePhase() {
    this.dispatchEvent(
      new CustomEvent('advance-phase', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _onResolveCycle() {
    this.dispatchEvent(
      new CustomEvent('resolve-cycle', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _onCancelEpoch() {
    this.dispatchEvent(
      new CustomEvent('cancel-epoch', {
        bubbles: true,
        composed: true,
      }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-epoch-lobby-actions': VelgEpochLobbyActions;
  }
}
