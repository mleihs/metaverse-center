/**
 * VelgBondPanel — the listening post.
 *
 * Shows the player's active bonds as dossier tabs, each opening a
 * whisper feed. Unread counts pulse as amber badges. The empty state
 * explains how bonds form through accumulated attention.
 *
 * Aesthetic: cold war listening station. Dashed borders, brutalist
 * headings, prose-font whispers, amber accent on near-black.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import type { Bond, BondDetail, Whisper } from '../../services/api/BondsApiService.js';
import { bondsApi } from '../../services/api/BondsApiService.js';
import { localeService } from '../../services/i18n/locale-service.js';
import { VelgToast } from '../shared/Toast.js';

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
      --_accent-dim: color-mix(
        in srgb,
        var(--color-primary) 12%,
        transparent
      );
      --_mood-good: var(--color-success);
      --_mood-mid: var(--color-warning);
      --_mood-bad: var(--color-danger);
      display: block;
    }

    .panel {
      display: flex;
      flex-direction: column;
      gap: var(--space-6);
    }

    .panel__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .panel__title {
      font-family: var(--font-brutalist);
      font-size: var(--text-lg);
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

    /* ── Bond slots ────────────────────────────────── */

    .bonds {
      display: flex;
      gap: var(--space-2);
      flex-wrap: wrap;
    }

    .bond-slot {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      background: var(--color-surface);
      border: 1px dashed var(--color-border);
      cursor: pointer;
      transition: border-color var(--transition-fast),
        background var(--transition-fast);
      min-height: 44px;
      position: relative;
    }

    .bond-slot:hover {
      border-color: var(--_accent);
      background: var(--_accent-dim);
    }

    .bond-slot:focus-visible {
      outline: var(--ring-focus);
    }

    .bond-slot--active {
      border-color: var(--_accent);
      border-style: solid;
      background: var(--_accent-dim);
    }

    .bond-slot--empty {
      border-color: var(--color-border-light);
      cursor: default;
      opacity: 0.4;
    }

    .bond-slot--empty:hover {
      border-color: var(--color-border-light);
      background: var(--color-surface);
    }

    .bond-slot__name {
      font-family: var(--font-body);
      font-size: var(--text-sm);
      color: var(--color-text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 120px;
    }

    .bond-slot__mood {
      width: 8px;
      height: 8px;
      flex-shrink: 0;
    }

    .bond-slot__badge {
      position: absolute;
      top: -4px;
      right: -4px;
      min-width: 16px;
      height: 16px;
      padding: 0 var(--space-1);
      font-family: var(--font-mono);
      font-size: 9px;
      line-height: 16px;
      text-align: center;
      color: var(--color-text-inverse);
      background: var(--_accent);
      animation: badge-pulse 2s var(--ease-in-out) infinite;
    }

    /* ── Whisper feed ──────────────────────────────── */

    .feed {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .feed__header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      padding-bottom: var(--space-2);
      border-bottom: 1px dashed var(--color-border);
    }

    .feed__agent {
      font-family: var(--font-brutalist);
      font-size: var(--text-base);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-primary);
    }

    .feed__depth {
      font-family: var(--font-prose);
      font-size: var(--text-sm);
      font-style: italic;
      color: var(--color-text-muted);
    }

    .feed__empty {
      font-family: var(--font-prose);
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      font-style: italic;
      padding: var(--space-8) 0;
      text-align: center;
    }

    /* ── Empty state ──────────────────────────────── */

    .empty {
      text-align: center;
      padding: var(--space-12) var(--space-6);
    }

    .empty__title {
      font-family: var(--font-brutalist);
      font-size: var(--text-base);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-secondary);
      margin-bottom: var(--space-3);
    }

    .empty__body {
      font-family: var(--font-prose);
      font-size: var(--text-sm);
      line-height: var(--leading-relaxed);
      color: var(--color-text-muted);
      max-width: 400px;
      margin: 0 auto;
    }

    /* ── Animations ───────────────────────────────── */

    @keyframes badge-pulse {
      0%,
      100% {
        opacity: 1;
      }
      50% {
        opacity: 0.6;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
      }
    }

    @media (max-width: 640px) {
      .bonds {
        flex-direction: column;
      }
      .bond-slot__name {
        max-width: none;
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
      this._bonds = resp.data.filter(
        (b: Bond) => b.status !== 'forming',
      );
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
    const unread = this._detail.recent_whispers.filter(
      (w: Whisper) => !w.read_at,
    );
    if (!unread.length) return;

    const now = new Date().toISOString();
    await Promise.all(
      unread.map((w) => bondsApi.markWhisperRead(this._detail!.id, w.id)),
    );
    // Update local state after all reads confirmed
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

  private _moodColor(bondId: string): string {
    // Mood data only available for the selected bond (from detail endpoint).
    // Non-selected bonds show neutral indicator.
    if (bondId !== this._selectedBondId || !this._detail) {
      return 'var(--color-text-muted)';
    }
    const mood = this._detail.agent_mood_score;
    if (mood == null) return 'var(--color-text-muted)';
    if (mood > 20) return 'var(--_mood-good)';
    if (mood > -20) return 'var(--_mood-mid)';
    return 'var(--_mood-bad)';
  }

  protected render() {
    if (this._loading) {
      return html`<velg-loading-state
        message=${msg('Loading bonds...')}
      ></velg-loading-state>`;
    }
    if (this._error) {
      return html`<velg-error-state
        message=${this._error}
        show-retry
        @retry=${this._loadBonds}
      ></velg-error-state>`;
    }
    if (!this._bonds.length) {
      return this._renderEmpty();
    }
    return this._renderPanel();
  }

  private _renderEmpty() {
    return html`
      <div class="empty">
        <div class="empty__title">${msg('No bonds yet')}</div>
        <p class="empty__body">
          ${msg(
            'Bonds form through attention. Visit agent detail pages regularly, and over time, agents will notice your presence.',
          )}
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
          ${activeBonds.map((b) => this._renderBondSlot(b))}
          ${Array.from({ length: emptySlots }, () =>
            this._renderEmptySlot(),
          )}
        </div>

        ${this._selectedBondId ? this._renderFeed() : nothing}
      </div>
    `;
  }

  private _renderBondSlot(bond: Bond) {
    const isSelected = bond.id === this._selectedBondId;
    const detail = isSelected ? this._detail : null;
    const unread = detail?.unread_count ?? 0;

    return html`
      <button
        class="bond-slot ${isSelected ? 'bond-slot--active' : ''}"
        role="tab"
        aria-selected=${isSelected}
        aria-label="${bond.agent_name ?? msg('Unknown agent')}"
        @click=${() => this._selectBond(bond.id)}
      >
        <span
          class="bond-slot__mood"
          style="background: ${this._moodColor(bond.id)}"
        ></span>
        <span class="bond-slot__name">
          ${bond.agent_name ?? msg('Unknown')}
        </span>
        ${unread > 0
          ? html`<span class="bond-slot__badge">${unread}</span>`
          : nothing}
      </button>
    `;
  }

  private _renderEmptySlot() {
    return html`
      <div class="bond-slot bond-slot--empty" aria-hidden="true">
        <span class="bond-slot__name" style="opacity: 0.5"
          >- - -</span
        >
      </div>
    `;
  }

  private _renderFeed() {
    if (this._detailLoading) {
      return html`<velg-loading-state
        message=${msg('Loading whispers...')}
      ></velg-loading-state>`;
    }
    if (!this._detail) return nothing;

    const d = this._detail;
    const whispers = d.recent_whispers ?? [];
    const depthLabel = this._depthName(d.depth);

    return html`
      <div class="feed" role="tabpanel">
        <div class="feed__header">
          <span class="feed__agent">${d.agent_name}</span>
          <span class="feed__depth">${depthLabel}</span>
        </div>

        ${whispers.length
          ? whispers.map(
              (w: Whisper, i: number) => html`
                <velg-whisper-card
                  .whisper=${w}
                  style="--i: ${i}"
                ></velg-whisper-card>
              `,
            )
          : html`<p class="feed__empty">
              ${msg('No whispers yet. They will come with time.')}
            </p>`}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-bond-panel': VelgBondPanel;
  }
}
