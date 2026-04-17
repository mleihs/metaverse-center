/**
 * VelgBondPanel — the listening post. Redesigned.
 *
 * Bond slots as dossier tabs with agent avatars and mood rings.
 * Whisper feed with agent portrait header, prose-font whispers,
 * corner brackets on the dossier frame.
 *
 * Reuses: VelgAvatar (mood ring), formatRelativeTime (shared date util),
 * moodRingColor (agent-colors util), panelCascadeStyles (staggered entrance).
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import type { Bond, BondDetail, Whisper } from '../../services/api/BondsApiService.js';
import { bondsApi } from '../../services/api/BondsApiService.js';
import { localeService } from '../../services/i18n/locale-service.js';
import { moodRingColor } from '../../utils/agent-colors.js';
import { VelgToast } from '../shared/Toast.js';

import '../shared/VelgAvatar.js';
import './VelgWhisperCard.js';

const DEPTH_NAMES_DE: Record<number, string> = {
  1: 'Bekanntschaft',
  2: 'Vertrauen',
  3: 'Zuneigung',
  4: 'Tiefe',
  5: 'Resonanz',
};

const DEPTH_NAMES_EN: Record<number, string> = {
  1: 'Acquaintance',
  2: 'Trust',
  3: 'Affection',
  4: 'Depth',
  5: 'Resonance',
};

@localized()
@customElement('velg-bond-panel')
export class VelgBondPanel extends LitElement {
  static styles = css`
    :host {
      --_accent: var(--color-primary);
      --_accent-dim: color-mix(in srgb, var(--color-primary) 8%, transparent);
      --_accent-glow: color-mix(in srgb, var(--color-primary) 20%, transparent);
      --_surface-card: var(--color-surface-raised);
      display: block;
    }

    .panel {
      display: flex;
      flex-direction: column;
      gap: var(--space-8);
    }

    /* ── Header ─────────────────────────────────────── */

    .panel__header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      padding-bottom: var(--space-3);
      border-bottom: 1px dashed var(--color-border);
    }

    .panel__title {
      font-family: var(--font-brutalist);
      font-size: var(--text-xl);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-primary);
      margin: 0;
    }

    .panel__count {
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }

    /* ── Bond slots ─────────────────────────────────── */

    .bonds {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: var(--space-3);
    }

    @media (max-width: 768px) {
      .bonds {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    @media (max-width: 480px) {
      .bonds {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    .slot {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-4) var(--space-2);
      background: var(--color-surface);
      border: 1px dashed var(--color-border);
      cursor: pointer;
      transition:
        border-color var(--transition-fast),
        background var(--transition-fast),
        box-shadow var(--transition-fast);
      min-height: 100px;
      position: relative;
    }

    .slot:hover {
      border-color: var(--_accent);
      background: var(--_accent-dim);
    }

    .slot:focus-visible {
      outline: var(--ring-focus);
    }

    .slot--active {
      border-color: var(--_accent);
      border-style: solid;
      background: var(--_accent-dim);
      box-shadow: 0 0 12px -4px var(--_accent-glow);
    }

    .slot--empty {
      border-color: var(--color-border-light);
      cursor: default;
      opacity: 0.3;
    }

    .slot--empty:hover {
      border-color: var(--color-border-light);
      background: var(--color-surface);
      box-shadow: none;
    }

    .slot__name {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-secondary);
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }

    .slot__depth {
      font-family: var(--font-mono);
      font-size: 9px;
      color: var(--color-text-muted);
      text-transform: uppercase;
    }

    .slot__badge {
      position: absolute;
      top: var(--space-1);
      right: var(--space-1);
      min-width: 18px;
      height: 18px;
      padding: 0 var(--space-1);
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: var(--font-bold);
      line-height: 18px;
      text-align: center;
      color: var(--color-text-inverse);
      background: var(--_accent);
      animation: badge-pulse 2s var(--ease-in-out) infinite;
    }

    .slot__empty-label {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      opacity: 0.5;
    }

    /* ── Dossier feed ───────────────────────────────── */

    .dossier {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      border: 1px solid var(--color-border);
      background: var(--_surface-card);
      position: relative;
      padding: var(--space-6);
    }

    /* Corner brackets */
    .dossier::before,
    .dossier::after {
      content: '';
      position: absolute;
      width: 14px;
      height: 14px;
      border-color: var(--_accent);
      border-style: solid;
      pointer-events: none;
    }

    .dossier::before {
      top: -1px;
      left: -1px;
      border-width: 2px 0 0 2px;
    }

    .dossier::after {
      top: -1px;
      right: -1px;
      border-width: 2px 2px 0 0;
    }

    .dossier__bottom-corners::before,
    .dossier__bottom-corners::after {
      content: '';
      position: absolute;
      width: 14px;
      height: 14px;
      border-color: var(--_accent);
      border-style: solid;
      pointer-events: none;
    }

    .dossier__bottom-corners::before {
      bottom: -1px;
      left: -1px;
      border-width: 0 0 2px 2px;
    }

    .dossier__bottom-corners::after {
      bottom: -1px;
      right: -1px;
      border-width: 0 2px 2px 0;
    }

    .dossier__header {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      padding-bottom: var(--space-4);
      border-bottom: 1px dashed var(--color-border);
    }

    .dossier__info {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      min-width: 0;
    }

    .dossier__agent-name {
      font-family: var(--font-brutalist);
      font-size: var(--text-lg);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-primary);
    }

    .dossier__meta {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .dossier__depth {
      font-family: var(--font-prose);
      font-size: var(--text-sm);
      font-style: italic;
      color: var(--color-text-secondary);
    }

    .dossier__status {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      text-transform: uppercase;
      padding: var(--space-0-5) var(--space-2);
      border: 1px solid var(--color-border);
    }

    .dossier__status--active {
      color: var(--color-success);
      border-color: var(--color-success-border);
    }

    .dossier__status--strained {
      color: var(--color-warning);
      border-color: var(--color-warning-border);
    }

    .dossier__whispers {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .dossier__empty {
      font-family: var(--font-prose);
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      font-style: italic;
      padding: var(--space-10) 0;
      text-align: center;
    }

    /* ── Empty state ────────────────────────────────── */

    .empty {
      text-align: center;
      padding: var(--space-16) var(--space-6);
      border: 1px dashed var(--color-border-light);
    }

    .empty__title {
      font-family: var(--font-brutalist);
      font-size: var(--text-base);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-secondary);
      margin-bottom: var(--space-4);
    }

    .empty__body {
      font-family: var(--font-prose);
      font-size: var(--text-base);
      line-height: var(--leading-relaxed);
      color: var(--color-text-muted);
      max-width: 440px;
      margin: 0 auto;
    }

    /* ── Animations ──────────────────────────────────── */

    @keyframes badge-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
      }
    }
  `;

  @property({ type: String }) simulationId = '';
  @state() private _bonds: Bond[] = [];
  @state() private _selectedBondId: string | null = null;
  @state() private _detail: BondDetail | null = null;
  @state() private _loading = true;
  @state() private _detailLoading = false;
  @state() private _error: string | null = null;

  connectedCallback() {
    super.connectedCallback();
    this._loadBonds();
  }

  private async _loadBonds() {
    this._loading = true;
    this._error = null;
    const resp = await bondsApi.listBonds(this.simulationId);
    if (resp.success && resp.data) {
      this._bonds = resp.data.filter((b: Bond) => b.status !== 'forming');
      if (this._bonds.length && !this._selectedBondId) {
        this._selectBond(this._bonds[0].id);
      }
    } else {
      this._error = resp.error?.message ?? msg('Failed to load bonds');
    }
    this._loading = false;
  }

  private async _selectBond(bondId: string) {
    this._selectedBondId = bondId;
    this._detailLoading = true;
    const resp = await bondsApi.getBondDetail(bondId);
    if (resp.success && resp.data) {
      this._detail = resp.data;
      this._markVisibleWhispersRead();
    }
    this._detailLoading = false;
  }

  private async _markVisibleWhispersRead() {
    if (!this._detail) return;
    const unread = this._detail.recent_whispers.filter((w: Whisper) => !w.read_at);
    if (!unread.length) return;

    const now = new Date().toISOString();
    await Promise.all(
      unread.map((w) => bondsApi.markWhisperRead(this._detail!.id, w.id)),
    );
    this._detail = {
      ...this._detail,
      recent_whispers: this._detail.recent_whispers.map((w) =>
        w.read_at ? w : { ...w, read_at: now },
      ),
      unread_count: 0,
    };
    this._loadBonds();
  }

  private async _handleWhisperActed(e: CustomEvent) {
    const { whisperId, bondId } = e.detail;
    const resp = await bondsApi.markWhisperActed(bondId, whisperId);
    if (resp.success) {
      VelgToast.success(msg('Action acknowledged'));
      this._selectBond(bondId);
    }
  }

  private get _locale(): string {
    return localeService.currentLocale;
  }

  private _depthName(depth: number): string {
    return this._locale === 'de'
      ? DEPTH_NAMES_DE[depth] ?? ''
      : DEPTH_NAMES_EN[depth] ?? '';
  }

  private _getMoodColor(): string {
    if (!this._detail) return '';
    const mood = this._detail.agent_mood_score;
    if (mood == null) return '';
    return moodRingColor(mood);
  }

  protected render() {
    if (this._loading) {
      return html`<velg-loading-state message=${msg('Loading bonds...')}></velg-loading-state>`;
    }
    if (this._error) {
      return html`<velg-error-state message=${this._error} show-retry @retry=${this._loadBonds}></velg-error-state>`;
    }
    if (!this._bonds.length) return this._renderEmpty();
    return this._renderPanel();
  }

  private _renderEmpty() {
    return html`
      <div class="empty">
        <div class="empty__title">${msg('No bonds yet')}</div>
        <p class="empty__body">
          ${msg('Bonds form through attention. Visit agent detail pages regularly, and over time, agents will notice your presence. When an agent recognizes you, a bond can be formed.')}
        </p>
      </div>
    `;
  }

  private _renderPanel() {
    const activeBonds = this._bonds.filter(
      (b) => b.status === 'active' || b.status === 'strained',
    );
    const emptySlots = Math.max(0, 5 - activeBonds.length);

    return html`
      <div class="panel" @whisper-acted=${this._handleWhisperActed}>
        <div class="panel__header">
          <h3 class="panel__title">${msg('Bonds')}</h3>
          <span class="panel__count">${activeBonds.length} / 5</span>
        </div>

        <div class="bonds" role="tablist" aria-label=${msg('Bond slots')}>
          ${activeBonds.map((b) => this._renderSlot(b))}
          ${Array.from({ length: emptySlots }, () => this._renderEmptySlot())}
        </div>

        ${this._selectedBondId ? this._renderDossier() : nothing}
      </div>
    `;
  }

  private _renderSlot(bond: Bond) {
    const selected = bond.id === this._selectedBondId;
    const detail = selected ? this._detail : null;
    const unread = detail?.unread_count ?? 0;
    const moodColor = selected ? this._getMoodColor() : '';

    return html`
      <button
        class="slot ${selected ? 'slot--active' : ''}"
        role="tab"
        aria-selected=${selected}
        aria-label="${bond.agent_name ?? msg('Unknown agent')}"
        @click=${() => this._selectBond(bond.id)}
      >
        <velg-avatar
          .src=${bond.agent_portrait_url ?? ''}
          .name=${bond.agent_name ?? '?'}
          .moodColor=${moodColor}
          size="sm"
        ></velg-avatar>
        <span class="slot__name">${bond.agent_name ?? msg('Unknown')}</span>
        <span class="slot__depth">${this._depthName(bond.depth)}</span>
        ${unread > 0
          ? html`<span class="slot__badge">${unread}</span>`
          : nothing}
      </button>
    `;
  }

  private _renderEmptySlot() {
    return html`
      <div class="slot slot--empty" aria-hidden="true">
        <div style="width: 32px; height: 32px; opacity: 0.3; border: 1px dashed var(--color-border); display: flex; align-items: center; justify-content: center;">
          <span style="color: var(--color-text-muted); font-size: var(--text-xs);">?</span>
        </div>
        <span class="slot__empty-label">- - -</span>
      </div>
    `;
  }

  private _renderDossier() {
    if (this._detailLoading) {
      return html`<velg-loading-state message=${msg('Loading whispers...')}></velg-loading-state>`;
    }
    if (!this._detail) return nothing;

    const d = this._detail;
    const whispers = d.recent_whispers ?? [];
    const depthLabel = this._depthName(d.depth);
    const moodColor = this._getMoodColor();

    return html`
      <div class="dossier" role="tabpanel">
        <div class="dossier__bottom-corners"></div>

        <div class="dossier__header">
          <velg-avatar
            .src=${d.agent_portrait_url ?? ''}
            .name=${d.agent_name ?? '?'}
            .moodColor=${moodColor}
            size="sm"
          ></velg-avatar>

          <div class="dossier__info">
            <span class="dossier__agent-name">${d.agent_name}</span>
            <div class="dossier__meta">
              <span class="dossier__depth">${depthLabel}</span>
              <span class="dossier__status dossier__status--${d.status}">
                ${d.status}
              </span>
            </div>
          </div>
        </div>

        <div class="dossier__whispers">
          ${whispers.length
            ? whispers.map(
                (w: Whisper, i: number) => html`
                  <velg-whisper-card
                    .whisper=${w}
                    style="--i: ${i}"
                  ></velg-whisper-card>
                `,
              )
            : html`<p class="dossier__empty">
                ${msg('No whispers yet. They will come with time.')}
              </p>`}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-bond-panel': VelgBondPanel;
  }
}
