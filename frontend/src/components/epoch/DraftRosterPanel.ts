/**
 * DraftRosterPanel — "The Hand" TCG draft overlay.
 *
 * Full-screen overlay where players draft agents into their epoch lineup.
 * Features: card fan layout at bottom, deployment field slots above,
 * drag & drop with slam effects, team profile stats panel.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Agent, AptitudeSet, OperativeType } from '../../types/index.js';
import { icons } from '../../utils/icons.js';
import { OPERATIVE_COLORS as OP_COLORS } from '../../utils/operative-constants.js';
import '../shared/VelgGameCard.js';

const OP_TYPES: OperativeType[] = [
  'spy',
  'guardian',
  'saboteur',
  'propagandist',
  'infiltrator',
  'assassin',
];

const OP_SHORT: Record<OperativeType, string> = {
  spy: 'SPY',
  guardian: 'GRD',
  saboteur: 'SAB',
  propagandist: 'PRP',
  infiltrator: 'INF',
  assassin: 'ASN',
};

@localized()
@customElement('velg-draft-roster-panel')
export class VelgDraftRosterPanel extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    /* ══════════════════════════════════════════════════
       OVERLAY — full-screen container
       ══════════════════════════════════════════════════ */
    .overlay {
      position: fixed;
      inset: 0;
      z-index: var(--z-top, 9000);
      background: var(--color-gray-950, #0a0a0f);
      display: flex;
      flex-direction: column;
      opacity: 0;
      animation: overlay-in 350ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) forwards;
    }

    .overlay::after {
      content: '';
      position: fixed;
      inset: 0;
      pointer-events: none;
      background: repeating-linear-gradient(
        0deg, transparent, transparent 2px,
        rgba(255 255 255 / 0.012) 2px,
        rgba(255 255 255 / 0.012) 4px
      );
      z-index: 1;
    }

    @keyframes overlay-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    /* ── Header ── */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-3) var(--space-5);
      border-bottom: 2px solid var(--color-gray-800);
      background: var(--color-gray-900);
      flex-shrink: 0;
      z-index: 2;
    }

    .header__title {
      font-family: var(--font-brutalist);
      font-weight: 900;
      font-size: var(--text-lg);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-gray-100);
    }

    .header__close {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      padding: 0;
      border: 1px solid var(--color-gray-700);
      background: transparent;
      color: var(--color-gray-400);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .header__close:hover {
      border-color: var(--color-gray-400);
      color: var(--color-gray-100);
      background: var(--color-gray-800);
    }

    /* ══════════════════════════════════════════════════
       DEPLOYMENT FIELD — top section with card slots
       ══════════════════════════════════════════════════ */
    .field {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: var(--space-4) var(--space-5);
      overflow-y: auto;
      min-height: 0;
    }

    .field__slots {
      display: flex;
      gap: var(--space-4);
      justify-content: center;
      flex-wrap: wrap;
      margin-bottom: var(--space-4);
    }

    /* ── Deployment Slot ── */
    .slot {
      position: relative;
      width: 120px;
      height: 168px;
      border: 2px dashed var(--color-gray-700);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 150ms var(--ease-out);
      flex-shrink: 0;
    }

    .slot--empty {
      animation: slot-breathe 2s ease-in-out infinite alternate;
    }

    @keyframes slot-breathe {
      from { border-color: var(--color-gray-700); }
      to { border-color: color-mix(in srgb, var(--color-epoch-accent, #f59e0b) 30%, var(--color-gray-700)); }
    }

    .slot__label {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-gray-700);
      user-select: none;
    }

    /* Drag-over state */
    .slot--dragover {
      border-style: solid;
      border-color: var(--color-epoch-accent, #f59e0b);
      background: color-mix(in srgb, var(--color-epoch-accent, #f59e0b) 6%, var(--color-gray-900));
      box-shadow: 0 0 20px rgba(245,158,11,0.15);
      transform: scale(1.03);
    }

    /* Filled slot wraps a card */
    .slot--filled {
      border: none;
      animation: slot-slam 400ms var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
    }

    @keyframes slot-slam {
      0% { transform: scale(1.15); }
      20% { transform: scale(0.92); }
      60% { transform: scale(1.04); }
      100% { transform: scale(1); }
    }

    .slot--filled .slot__remove {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      border: 1px solid var(--color-gray-600);
      border-radius: 50%;
      background: var(--color-gray-900);
      color: var(--color-gray-400);
      cursor: pointer;
      opacity: 0;
      transition: all 150ms ease;
      z-index: 5;
    }

    .slot--filled:hover .slot__remove {
      opacity: 1;
    }

    .slot__remove:hover {
      border-color: var(--color-danger);
      color: var(--color-danger);
      background: var(--color-gray-800);
    }

    /* ── Shockwave particles on slam ── */
    .slam-ring {
      position: absolute;
      inset: 0;
      border: 2px solid var(--color-epoch-accent, #f59e0b);
      border-radius: 8px;
      pointer-events: none;
      opacity: 0;
    }

    .slam-ring--active {
      animation: shockwave 400ms ease-out forwards;
    }

    @keyframes shockwave {
      from {
        transform: scale(0.8);
        opacity: 0.8;
      }
      to {
        transform: scale(2);
        opacity: 0;
      }
    }

    /* ══════════════════════════════════════════════════
       TEAM PROFILE — aggregate stats
       ══════════════════════════════════════════════════ */
    .team-profile {
      background: var(--color-gray-900);
      border: 1px solid var(--color-gray-800);
      padding: var(--space-3) var(--space-4);
      margin-top: auto;
      opacity: 0;
      animation: profile-slide 300ms var(--ease-dramatic) forwards;
    }

    @keyframes profile-slide {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .team-profile__bars {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2) var(--space-4);
    }

    .team-bar {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      min-width: 140px;
    }

    .team-bar__label {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--card-text-dim, var(--color-gray-400));
      width: 24px;
      flex-shrink: 0;
    }

    .team-bar__track {
      flex: 1;
      height: 6px;
      background: var(--color-gray-800);
      border-radius: 3px;
      overflow: hidden;
    }

    .team-bar__fill {
      height: 100%;
      border-radius: 3px;
      transition: width 300ms var(--ease-out);
    }

    .team-bar__value {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      color: var(--color-gray-300);
      width: 20px;
      text-align: right;
    }

    .team-profile__meta {
      display: flex;
      gap: var(--space-4);
      margin-top: var(--space-2);
      padding-top: var(--space-2);
      border-top: 1px solid var(--color-gray-800);
    }

    .meta-stat {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }

    .meta-stat__label {
      font-family: var(--font-mono, monospace);
      font-size: 8px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-gray-500);
    }

    .meta-stat__value {
      font-family: var(--font-brutalist);
      font-weight: 700;
      font-size: var(--text-xs);
      text-transform: uppercase;
    }

    .meta-stat__value--strong { color: var(--color-success); }
    .meta-stat__value--weak { color: var(--color-danger); }
    .meta-stat__value--neutral { color: var(--color-gray-300); }

    /* ══════════════════════════════════════════════════
       DIVIDER — between field and hand
       ══════════════════════════════════════════════════ */
    .divider {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-3);
      padding: var(--space-2) var(--space-5);
      background: var(--color-gray-900);
      border-top: 2px solid var(--color-gray-800);
      border-bottom: 1px solid var(--color-gray-800);
      flex-shrink: 0;
      z-index: 2;
    }

    /* Card-shaped counter pips */
    .counter-pips {
      display: flex;
      gap: 4px;
    }

    .counter-pip {
      width: 16px;
      height: 22px;
      border: 1px solid var(--color-gray-700);
      border-radius: 2px;
      transition: all 300ms var(--ease-spring);
    }

    .counter-pip--filled {
      background: var(--color-epoch-accent, #f59e0b);
      border-color: var(--color-epoch-accent, #f59e0b);
      box-shadow: 0 0 6px rgba(245,158,11,0.3);
      animation: pip-flip 300ms var(--ease-spring);
    }

    @keyframes pip-flip {
      0% { transform: rotateY(0); }
      50% { transform: rotateY(90deg); }
      100% { transform: rotateY(0); }
    }

    .counter-text {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-gray-400);
    }

    .counter-text--ready {
      color: var(--color-success);
    }

    .counter-text--complete {
      animation: typewriter-flash 400ms ease-out;
    }

    @keyframes typewriter-flash {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }

    /* ══════════════════════════════════════════════════
       THE HAND — card fan at bottom
       ══════════════════════════════════════════════════ */
    .hand {
      position: relative;
      display: flex;
      justify-content: center;
      align-items: flex-end;
      padding: var(--space-3) var(--space-5) var(--space-4);
      min-height: 220px;
      flex-shrink: 0;
      overflow: visible;
      z-index: 2;
    }

    .hand__cards {
      display: flex;
      justify-content: center;
      position: relative;
    }

    .hand__card-wrapper {
      position: relative;
      transition: all 250ms cubic-bezier(0.22, 1, 0.36, 1);
      transform-origin: bottom center;
      z-index: 1;
      cursor: pointer;
      /* Fan offset: negative margin for overlap */
      margin-left: -12px;
    }

    .hand__card-wrapper:first-child {
      margin-left: 0;
    }

    /* Fan rotation + arc via CSS custom props set by JS */
    .hand__card-wrapper {
      transform: translateY(var(--fan-y, 0px)) rotateZ(var(--fan-rot, 0deg));
    }

    /* Hover: card pops up, straightens, scales */
    .hand__card-wrapper:hover {
      z-index: 10;
      transform: translateY(-40px) rotateZ(0deg) scale(1.25);
    }

    /* Adjacent cards spread on hover */
    .hand__card-wrapper:hover ~ .hand__card-wrapper {
      margin-left: 4px;
    }

    /* Non-hovered cards dim */
    .hand__cards:hover .hand__card-wrapper:not(:hover) {
      opacity: 0.7;
    }

    .hand__card-wrapper:hover {
      opacity: 1 !important;
    }

    /* Drafted card in hand */
    .hand__card-wrapper--drafted {
      pointer-events: none;
    }

    /* Deal animation */
    .hand__card-wrapper--dealing {
      opacity: 0;
      animation: card-deal var(--deal-duration, 350ms)
                 cubic-bezier(0.22, 1, 0.36, 1) forwards;
      animation-delay: var(--deal-delay, 0ms);
    }

    @keyframes card-deal {
      from {
        opacity: 0;
        transform: translateY(-200px) rotateZ(0deg) scale(0.5);
      }
      to {
        opacity: 1;
        transform: translateY(var(--fan-y, 0px)) rotateZ(var(--fan-rot, 0deg)) scale(1);
      }
    }

    /* ══════════════════════════════════════════════════
       FOOTER — action buttons
       ══════════════════════════════════════════════════ */
    .footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-5);
      border-top: 2px solid var(--color-gray-800);
      background: var(--color-gray-900);
      flex-shrink: 0;
      z-index: 2;
    }

    .footer__btn {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-5);
      font-family: var(--font-brutalist);
      font-weight: 700;
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      border: 2px solid;
      cursor: pointer;
      transition: all var(--transition-normal);
    }

    .footer__btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .footer__btn--cancel {
      color: var(--color-gray-400);
      border-color: var(--color-gray-700);
      background: transparent;
    }

    .footer__btn--cancel:hover:not(:disabled) {
      border-color: var(--color-gray-400);
      background: var(--color-gray-800);
    }

    .footer__btn--lock {
      color: var(--color-gray-950);
      border-color: var(--color-epoch-accent, #f59e0b);
      background: var(--color-epoch-accent, #f59e0b);
    }

    .footer__btn--lock:hover:not(:disabled) {
      transform: translate(-2px, -2px);
      box-shadow: 4px 4px 0 var(--color-gray-700),
        0 0 20px color-mix(in srgb, var(--color-epoch-accent, #f59e0b) 30%, transparent);
    }

    .footer__btn--lock:active:not(:disabled) {
      transform: translate(0);
      box-shadow: none;
    }

    /* ══════════════════════════════════════════════════
       MOBILE — stacked layout
       ══════════════════════════════════════════════════ */
    @media (max-width: 768px) {
      .hand {
        min-height: auto;
        padding: var(--space-2);
      }

      .hand__cards {
        display: flex;
        gap: var(--space-2);
        overflow-x: auto;
        padding-bottom: var(--space-2);
        scrollbar-width: thin;
        scrollbar-color: var(--color-gray-700) transparent;
      }

      .hand__card-wrapper {
        margin-left: 0;
        transform: none !important;
        flex-shrink: 0;
      }

      .hand__card-wrapper:hover {
        transform: translateY(-8px) scale(1.05) !important;
      }

      .hand__cards:hover .hand__card-wrapper:not(:hover) {
        opacity: 1;
      }

      .field__slots {
        gap: var(--space-2);
      }

      .slot {
        width: 80px;
        height: 112px;
      }
    }

    /* ══════════════════════════════════════════════════
       REDUCED MOTION
       ══════════════════════════════════════════════════ */
    @media (prefers-reduced-motion: reduce) {
      .overlay,
      .hand__card-wrapper--dealing,
      .slot--filled,
      .slot--empty,
      .counter-pip--filled,
      .team-profile,
      .slam-ring--active {
        animation: none !important;
        opacity: 1;
      }

      .overlay::after {
        display: none;
      }

      .hand__card-wrapper,
      .hand__card-wrapper:hover {
        transition: none;
      }
    }
  `;

  @property({ type: Boolean }) open = false;
  @property({ type: Array }) agents: Agent[] = [];
  @property({ type: Number }) maxSlots = 6;
  @property({ type: Object }) aptitudeMap: Map<string, AptitudeSet> = new Map();

  @state() private _draftedIds: string[] = [];
  @state() private _slamSlot: number | null = null;
  @state() private _dragOverSlot: number | null = null;
  @state() private _dealt = false;

  private _onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this._cancel();
  };

  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('keydown', this._onKeyDown);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this._onKeyDown);
  }

  protected willUpdate(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('open') && this.open) {
      this._draftedIds = [];
      this._slamSlot = null;
      this._dealt = false;
      // Trigger deal animation after render
      requestAnimationFrame(() => {
        this._dealt = true;
      });
    }
  }

  // ── Helpers ──

  private _getBestAptitude(apt: AptitudeSet): { type: OperativeType; level: number } {
    let best: OperativeType = 'spy';
    let bestLevel = 0;
    for (const t of OP_TYPES) {
      if (apt[t] > bestLevel) {
        bestLevel = apt[t];
        best = t;
      }
    }
    return { type: best, level: bestLevel };
  }

  private _getRarity(agent: Agent, apt: AptitudeSet | undefined): 'common' | 'rare' | 'legendary' {
    if (agent.is_ambassador) return 'legendary';
    if (apt) {
      for (const val of Object.values(apt)) {
        if (val >= 9) return 'legendary';
      }
    }
    if (agent.data_source === 'ai') return 'rare';
    return 'common';
  }

  private _fanGeometry(index: number, total: number): { rot: number; y: number } {
    if (total <= 1) return { rot: 0, y: 0 };
    const center = (total - 1) / 2;
    const maxRot = Math.min(30, total * 5);
    const rot = (index - center) * (maxRot / total);
    const y = Math.abs(index - center) * 8;
    return { rot, y };
  }

  // ── Draft actions ──

  private _addAgent(agentId: string): void {
    if (this._draftedIds.length >= this.maxSlots) return;
    if (this._draftedIds.includes(agentId)) return;
    const slotIndex = this._draftedIds.length;
    this._draftedIds = [...this._draftedIds, agentId];
    // Trigger slam
    this._slamSlot = slotIndex;
    setTimeout(() => {
      this._slamSlot = null;
    }, 500);
  }

  private _removeAgent(agentId: string): void {
    this._draftedIds = this._draftedIds.filter((id) => id !== agentId);
  }

  private _cancel(): void {
    this.dispatchEvent(new CustomEvent('draft-cancel', { bubbles: true, composed: true }));
  }

  private _lockIn(): void {
    this.dispatchEvent(
      new CustomEvent('draft-complete', {
        detail: { agentIds: this._draftedIds },
        bubbles: true,
        composed: true,
      }),
    );
  }

  // ── Drag & drop ──

  private _onDragOver(e: DragEvent, slotIndex: number): void {
    e.preventDefault();
    if (this._draftedIds[slotIndex]) return; // slot already filled
    this._dragOverSlot = slotIndex;
  }

  private _onDragLeave(): void {
    this._dragOverSlot = null;
  }

  private _onDrop(e: DragEvent, slotIndex: number): void {
    e.preventDefault();
    this._dragOverSlot = null;
    const agentId = e.dataTransfer?.getData('text/agent-id');
    if (agentId && !this._draftedIds.includes(agentId) && !this._draftedIds[slotIndex]) {
      this._addAgent(agentId);
    }
  }

  private _onCardDragStart(e: DragEvent, agentId: string): void {
    e.dataTransfer?.setData('text/agent-id', agentId);
  }

  // ── Compute team stats ──

  private _computeTeamStats() {
    if (this._draftedIds.length === 0) return null;

    const totals: Record<OperativeType, number> = {
      spy: 0,
      guardian: 0,
      saboteur: 0,
      propagandist: 0,
      infiltrator: 0,
      assassin: 0,
    };

    for (const id of this._draftedIds) {
      const apt = this.aptitudeMap.get(id);
      if (!apt) continue;
      for (const t of OP_TYPES) {
        totals[t] += apt[t];
      }
    }

    let strongest: OperativeType = 'spy';
    let weakest: OperativeType = 'spy';
    for (const t of OP_TYPES) {
      if (totals[t] > totals[strongest]) strongest = t;
      if (totals[t] < totals[weakest]) weakest = t;
    }

    const sum = Object.values(totals).reduce((a, b) => a + b, 0);
    const avgTotal = Math.round(sum / this._draftedIds.length);

    // Synergy: high variance = specialized team = high synergy
    const mean = sum / 6;
    const variance = OP_TYPES.reduce((acc, t) => acc + (totals[t] - mean) ** 2, 0) / 6;
    const synergy = Math.min(100, Math.round((Math.sqrt(variance) / mean) * 150));

    // Max possible for bar scaling
    const maxPossible = this._draftedIds.length * 9; // 9 is max aptitude

    return { totals, strongest, weakest, avgTotal, synergy, maxPossible };
  }

  // ── Render ──

  protected render() {
    if (!this.open) return nothing;

    const drafted = new Set(this._draftedIds);
    const isFull = this._draftedIds.length >= this.maxSlots;
    const stats = this._computeTeamStats();

    return html`
      <div class="overlay">
        ${this._renderHeader()}
        ${this._renderField(stats)}
        ${this._renderDivider(isFull)}
        ${this._renderHand(drafted, isFull)}
        ${this._renderFooter()}
      </div>
    `;
  }

  private _renderHeader() {
    return html`
      <div class="header">
        <span class="header__title">${msg('Draft Roster')}</span>
        <button class="header__close" @click=${this._cancel} aria-label=${msg('Close')}>
          ${icons.close()}
        </button>
      </div>
    `;
  }

  private _renderField(stats: ReturnType<typeof this._computeTeamStats>) {
    return html`
      <div class="field">
        <div class="field__slots">
          ${Array.from({ length: this.maxSlots }, (_, i) => this._renderSlot(i))}
        </div>
        ${stats ? this._renderTeamProfile(stats) : nothing}
      </div>
    `;
  }

  private _renderSlot(index: number) {
    const agentId = this._draftedIds[index];
    const agent = agentId ? this.agents.find((a) => a.id === agentId) : null;
    const apt = agentId ? this.aptitudeMap.get(agentId) : undefined;
    const isSlamming = this._slamSlot === index;
    const isDragOver = this._dragOverSlot === index;

    if (!agent) {
      return html`
        <div
          class="slot slot--empty ${isDragOver ? 'slot--dragover' : ''}"
          @dragover=${(e: DragEvent) => this._onDragOver(e, index)}
          @dragleave=${this._onDragLeave}
          @drop=${(e: DragEvent) => this._onDrop(e, index)}
        >
          <span class="slot__label">${index + 1}</span>
        </div>
      `;
    }

    const best = apt ? this._getBestAptitude(apt) : null;

    return html`
      <div class="slot slot--filled">
        ${isSlamming ? html`<div class="slam-ring slam-ring--active"></div>` : nothing}
        <velg-game-card
          type="agent"
          size="sm"
          .name=${agent.name}
          image-url=${agent.portrait_image_url ?? ''}
          .primaryStat=${36}
          .secondaryStat=${best?.level ?? null}
          .rarity=${this._getRarity(agent, apt)}
          .aptitudes=${apt ?? null}
          .interactive=${false}
          @card-click=${() => this._removeAgent(agent.id)}
        ></velg-game-card>
        <button
          class="slot__remove"
          @click=${() => this._removeAgent(agent.id)}
          aria-label=${msg(str`Remove ${agent.name}`)}
        >
          ${icons.close(10)}
        </button>
      </div>
    `;
  }

  private _renderTeamProfile(stats: NonNullable<ReturnType<typeof this._computeTeamStats>>) {
    return html`
      <div class="team-profile">
        <div class="team-profile__bars">
          ${OP_TYPES.map((type) => {
            const value = stats.totals[type];
            const pct = stats.maxPossible > 0 ? (value / stats.maxPossible) * 100 : 0;
            return html`
              <div class="team-bar">
                <span class="team-bar__label">${OP_SHORT[type]}</span>
                <div class="team-bar__track">
                  <div class="team-bar__fill" style="width: ${pct}%; background: ${OP_COLORS[type]}"></div>
                </div>
                <span class="team-bar__value">${value}</span>
              </div>
            `;
          })}
        </div>
        <div class="team-profile__meta">
          <div class="meta-stat">
            <span class="meta-stat__label">${msg('Strongest')}</span>
            <span class="meta-stat__value meta-stat__value--strong">${stats.strongest}</span>
          </div>
          <div class="meta-stat">
            <span class="meta-stat__label">${msg('Weakest')}</span>
            <span class="meta-stat__value meta-stat__value--weak">${stats.weakest}</span>
          </div>
          <div class="meta-stat">
            <span class="meta-stat__label">${msg('Avg Total')}</span>
            <span class="meta-stat__value meta-stat__value--neutral">${stats.avgTotal}</span>
          </div>
          <div class="meta-stat">
            <span class="meta-stat__label">${msg('Synergy')}</span>
            <span class="meta-stat__value meta-stat__value--neutral">${stats.synergy}%</span>
          </div>
        </div>
      </div>
    `;
  }

  private _renderDivider(isFull: boolean) {
    return html`
      <div class="divider">
        <div class="counter-pips">
          ${Array.from(
            { length: this.maxSlots },
            (_, i) => html`
            <div class="counter-pip ${i < this._draftedIds.length ? 'counter-pip--filled' : ''}"></div>
          `,
          )}
        </div>
        <span class="counter-text ${isFull ? 'counter-text--ready' : ''}">
          ${this._draftedIds.length}/${this.maxSlots} ${msg('Drafted')}
          ${isFull ? html` <span class="counter-text--complete">${msg('ROSTER COMPLETE')}</span>` : nothing}
        </span>
      </div>
    `;
  }

  private _renderHand(drafted: Set<string>, isFull: boolean) {
    const total = this.agents.length;

    return html`
      <div class="hand">
        <div class="hand__cards">
          ${this.agents.map((agent, i) => {
            const isDrafted = drafted.has(agent.id);
            const apt = this.aptitudeMap.get(agent.id);
            const best = apt ? this._getBestAptitude(apt) : null;
            const fan = this._fanGeometry(i, total);

            const subtitle = [agent.primary_profession, agent.gender]
              .filter(Boolean)
              .join(' \u00b7 ');

            return html`
              <div
                class="hand__card-wrapper
                  ${isDrafted ? 'hand__card-wrapper--drafted' : ''}
                  ${this._dealt ? 'hand__card-wrapper--dealing' : ''}"
                style="--fan-rot: ${fan.rot}deg; --fan-y: ${fan.y}px; --deal-delay: ${200 + i * 100}ms; --deal-duration: 350ms"
                draggable=${!isDrafted && !isFull ? 'true' : 'false'}
                @dragstart=${(e: DragEvent) => this._onCardDragStart(e, agent.id)}
              >
                <velg-game-card
                  type="agent"
                  size="sm"
                  .name=${agent.name}
                  image-url=${agent.portrait_image_url ?? ''}
                  .primaryStat=${36}
                  .secondaryStat=${best?.level ?? null}
                  .rarity=${this._getRarity(agent, apt)}
                  .aptitudes=${apt ?? null}
                  .subtitle=${subtitle}
                  ?dimmed=${isDrafted}
                  .interactive=${!isDrafted}
                  @card-click=${() => !isDrafted && !isFull && this._addAgent(agent.id)}
                ></velg-game-card>
              </div>
            `;
          })}
        </div>
      </div>
    `;
  }

  private _renderFooter() {
    return html`
      <div class="footer">
        <button class="footer__btn footer__btn--cancel" @click=${this._cancel}>
          ${msg('Cancel')}
        </button>
        <button
          class="footer__btn footer__btn--lock"
          ?disabled=${this._draftedIds.length === 0}
          @click=${this._lockIn}
        >
          ${msg('Lock In Roster')}
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-draft-roster-panel': VelgDraftRosterPanel;
  }
}
