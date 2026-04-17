/**
 * VelgAchievementSummaryCard — Dashboard commendation dossier.
 *
 * Compact card for the dashboard right column. Shows earned/total count
 * with up to 3 recent unlock previews as mini hexagonal badges. Links
 * to the full /commendations grid.
 *
 * Conceptual direction: Declassified commendation folder — accent bar,
 * corner brackets, dense monospace metadata. The recent badges use the
 * same hexagonal clip-path as VelgAchievementBadge but at 36px scale.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';

import { appState } from '../../services/AppStateManager.js';
import type {
  AchievementSummary,
  UserAchievement,
} from '../../services/api/AchievementsApiService.js';
import { achievementsApi } from '../../services/api/AchievementsApiService.js';
import { localeService } from '../../services/i18n/locale-service.js';
import { captureError } from '../../services/SentryService.js';
import { icons } from '../../utils/icons.js';
import { navigate } from '../../utils/navigation.js';

@localized()
@customElement('velg-achievement-summary-card')
export class VelgAchievementSummaryCard extends LitElement {
  static styles = css`
    :host {
      --_accent: var(--color-primary);
      --_accent-dim: color-mix(in srgb, var(--color-primary) 12%, transparent);
      display: block;
      opacity: 0;
      animation: card-enter 500ms var(--ease-dramatic) forwards;
      animation-delay: calc(var(--i, 0) * 80ms);
    }

    @keyframes card-enter {
      from { opacity: 0; transform: translateY(16px) scale(0.97); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    .card {
      position: relative;
      background: var(--color-surface-raised);
      border: 1px solid var(--color-border);
      padding: var(--space-4);
      cursor: pointer;
      transition: border-color var(--transition-fast);
    }

    .card:hover {
      border-color: var(--_accent);
    }

    .card:focus-visible {
      outline: var(--ring-focus);
      outline-offset: 2px;
    }

    /* ── Accent bar ── */
    .card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: var(--_accent);
      opacity: 0.6;
    }

    /* ── Corner brackets ── */
    .corner {
      position: absolute;
      width: 6px;
      height: 6px;
      border-style: solid;
      border-color: var(--_accent);
      opacity: 0.3;
    }
    .corner--tl { top: 3px; left: 3px; border-width: 1px 0 0 1px; }
    .corner--br { bottom: 3px; right: 3px; border-width: 0 1px 1px 0; }

    /* ── Header ── */
    .header {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin-bottom: var(--space-3);
    }

    .header__icon {
      color: var(--_accent);
      flex-shrink: 0;
    }

    .header__label {
      font-family: var(--font-brutalist);
      font-size: 9px;
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--color-text-muted);
    }

    /* ── Count ── */
    .count {
      display: flex;
      align-items: baseline;
      gap: var(--space-1);
      margin-bottom: var(--space-3);
    }

    .count__earned {
      font-family: var(--font-brutalist);
      font-size: var(--text-2xl);
      font-weight: var(--font-black);
      color: var(--_accent);
      line-height: var(--leading-none);
      font-variant-numeric: tabular-nums;
    }

    .count__separator {
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }

    .count__total {
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      font-variant-numeric: tabular-nums;
    }

    /* ── Recent unlocks ── */
    .recent {
      display: flex;
      gap: var(--space-2);
      align-items: center;
      padding-top: var(--space-3);
      border-top: 1px dashed var(--color-border-light);
    }

    .recent__label {
      font-family: var(--font-brutalist);
      font-size: 8px;
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--color-text-muted);
      margin-right: auto;
      white-space: nowrap;
    }

    /* ── Mini hex badge ── */
    .mini-hex {
      --_mini-size: 36px;
      width: var(--_mini-size);
      flex-shrink: 0;
    }

    .mini-hex__shape {
      width: var(--_mini-size);
      aspect-ratio: 1 / 1.1547;
      clip-path: polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%);
      background: var(--color-surface-sunken);
      border: 1px solid var(--color-border);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: border-color var(--transition-fast);
    }

    .mini-hex--common .mini-hex__shape { border-color: var(--color-border); }
    .mini-hex--uncommon .mini-hex__shape { border-color: var(--color-success); background: color-mix(in srgb, var(--color-success) 8%, var(--color-surface-sunken)); }
    .mini-hex--rare .mini-hex__shape { border-color: var(--color-info); background: color-mix(in srgb, var(--color-info) 8%, var(--color-surface-sunken)); }
    .mini-hex--epic .mini-hex__shape { border-color: var(--color-epoch-influence); background: color-mix(in srgb, var(--color-epoch-influence) 8%, var(--color-surface-sunken)); }
    .mini-hex--legendary .mini-hex__shape { border-color: var(--color-primary); background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface-sunken)); }

    .mini-hex__icon {
      color: var(--color-text-secondary);
    }

    .mini-hex--uncommon .mini-hex__icon { color: var(--color-success); }
    .mini-hex--rare .mini-hex__icon { color: var(--color-info); }
    .mini-hex--epic .mini-hex__icon { color: var(--color-epoch-influence); }
    .mini-hex--legendary .mini-hex__icon { color: var(--color-primary); }

    /* ── CTA ── */
    .cta {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-muted);
      margin-top: var(--space-3);
      transition: color var(--transition-fast);
    }

    .card:hover .cta {
      color: var(--_accent);
    }

    /* ── Empty state ── */
    .empty {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      padding: var(--space-2) 0;
    }

    /* ── Reduced motion ── */
    @media (prefers-reduced-motion: reduce) {
      :host { animation: none; opacity: 1; }
    }
  `;

  @state() private _summary: AchievementSummary | null = null;
  @state() private _loading = true;

  private _disposeUnlockWatch: (() => void) | null = null;

  connectedCallback() {
    super.connectedCallback();
    if (appState.isAuthenticated.value) {
      this._load();
    }
    // Refresh when a new badge is earned (set by VelgAchievementToast)
    this._disposeUnlockWatch = appState.recentUnlock.subscribe((unlock) => {
      if (unlock) this._refetchSummary();
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    try {
      this._disposeUnlockWatch?.();
    } catch (err) {
      // Best-effort teardown during element removal — proceed with
      // cleanup even if the signal subscriber already unsubscribed.
      captureError(err, { source: 'VelgAchievementSummaryCard.disconnectedCallback' });
    }
    this._disposeUnlockWatch = null;
  }

  private async _load() {
    try {
      // Use cached summary if available
      if (appState.achievementSummary.value) {
        this._summary = appState.achievementSummary.value;
        this._loading = false;
        return;
      }

      const res = await achievementsApi.getSummary();
      if (res.data) {
        this._summary = res.data;
        appState.setAchievementSummary(res.data);
      }
    } catch (err) {
      captureError(err, { source: 'VelgAchievementSummaryCard._load' });
    } finally {
      this._loading = false;
    }
  }

  private async _refetchSummary() {
    try {
      const res = await achievementsApi.getSummary();
      if (res.data) {
        this._summary = res.data;
        appState.setAchievementSummary(res.data);
      }
    } catch (err) {
      // Card keeps stale data — refetch is triggered by an unlock
      // broadcast, and the next one will retry.
      captureError(err, { source: 'VelgAchievementSummaryCard._refetchSummary' });
    }
  }

  private _renderMiniHex(achievement: UserAchievement) {
    const def = achievement.definition;
    if (!def) return nothing;

    const key = def.icon_key as string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const iconFn = (icons as any)[key];
    const icon = typeof iconFn === 'function' ? iconFn(16) : icons.trophy(16);
    const locale = localeService.currentLocale;
    const name = locale === 'de' ? def.name_de : def.name_en;

    return html`
      <div class="mini-hex mini-hex--${def.rarity}" title=${name}>
        <div class="mini-hex__shape">
          <span class="mini-hex__icon">${icon}</span>
        </div>
      </div>
    `;
  }

  protected render() {
    if (this._loading || !appState.isAuthenticated.value) return nothing;
    if (!this._summary) return nothing;

    const { total_earned, total_available, recent } = this._summary;

    return html`
      <div
        class="card"
        role="link"
        tabindex="0"
        @click=${() => navigate('/commendations')}
        @keydown=${(e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            navigate('/commendations');
          }
        }}
      >
        <span class="corner corner--tl"></span>
        <span class="corner corner--br"></span>

        <div class="header">
          <span class="header__icon">${icons.trophy(14)}</span>
          <span class="header__label">${msg('Commendations')}</span>
        </div>

        <div class="count">
          <span class="count__earned">${total_earned}</span>
          <span class="count__separator">/</span>
          <span class="count__total">${total_available} ${msg('earned')}</span>
        </div>

        ${
          recent.length > 0
            ? html`
            <div class="recent">
              <span class="recent__label">${msg('Recent')}</span>
              ${recent.map((a) => this._renderMiniHex(a))}
            </div>
          `
            : html`<div class="empty">${msg('No badges earned yet')}</div>`
        }

        <div class="cta">
          ${msg('View All')} ${icons.chevronRight(10)}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-achievement-summary-card': VelgAchievementSummaryCard;
  }
}
