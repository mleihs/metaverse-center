/**
 * Epoch Intel Dossier Tab — accumulated spy intelligence per opponent.
 *
 * Groups intel_report battle log entries by target_simulation_id.
 * Each opponent card shows zone security, guardian count, fortifications,
 * last intel cycle, and staleness indicator.
 *
 * Aesthetic: declassified military intelligence dossier with scanline
 * overlay, redacted-document corner brackets, and tactical amber accents.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { epochsApi } from '../../services/api/EpochsApiService.js';
import type { Epoch, EpochParticipant, IntelDossier } from '../../types/index.js';
import { icons } from '../../utils/icons.js';

const SECURITY_COLORS: Record<string, string> = {
  fortress: 'var(--color-danger)',
  maximum: 'var(--color-danger)',
  high: 'var(--color-warning)',
  guarded: 'var(--color-warning)',
  moderate: 'var(--color-text-tertiary)',
  medium: 'var(--color-text-tertiary)',
  low: 'var(--color-success)',
  contested: 'var(--color-success)',
  lawless: 'var(--color-success)',
};

@localized()
@customElement('velg-epoch-intel-dossier-tab')
export class VelgEpochIntelDossierTab extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    /* ── Dossier Grid ────────────────────────── */

    .dossier-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: var(--space-4);
    }

    @media (max-width: 768px) {
      .dossier-grid {
        grid-template-columns: 1fr;
      }
    }

    /* ── Opponent Card ───────────────────────── */

    .card {
      position: relative;
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      opacity: 0;
      animation: card-reveal 0.45s ease-out forwards;
      overflow: hidden;
    }

    .card::before,
    .card::after {
      content: '';
      position: absolute;
      width: 10px;
      height: 10px;
      border-color: var(--color-info);
      border-style: solid;
      opacity: 0.4;
    }

    .card::before {
      top: 4px;
      left: 4px;
      border-width: 1px 0 0 1px;
    }

    .card::after {
      bottom: 4px;
      right: 4px;
      border-width: 0 1px 1px 0;
    }

    @keyframes card-reveal {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* Stale card — explicit dimmed colors instead of opacity (WCAG AA) */
    .card--stale {
      border-color: var(--color-border);
    }

    .card--stale .card__name {
      color: var(--color-text-muted);
    }

    .card--stale .intel-row__value,
    .card--stale .guardian-count {
      color: var(--color-text-muted);
    }

    .card--stale .fort-row {
      color: var(--color-text-muted);
      border-left-color: var(--color-icon);
      background: rgba(148 163 184 / 0.04);
    }

    .card--stale .card__header::after {
      content: '';
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      left: 0;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(148 163 184 / 0.03) 2px,
        rgba(148 163 184 / 0.03) 4px
      );
      pointer-events: none;
    }

    /* ── Card Header ─────────────────────────── */

    .card__header {
      position: relative;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--space-3) var(--space-4);
      border-bottom: 1px solid var(--color-border);
      background: rgba(56 189 248 / 0.03);
    }

    .card__name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-primary);
      margin: 0;
    }

    .card__cycle {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--color-text-muted);
      white-space: nowrap;
    }

    .card__stale-tag {
      display: inline-block;
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding: 2px 5px;
      color: var(--color-warning);
      border: 1px solid var(--color-warning);
      margin-left: var(--space-2);
    }

    /* ── Card Body ───────────────────────────── */

    .card__body {
      padding: var(--space-3) var(--space-4);
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    /* ── Intel Row ───────────────────────────── */

    .intel-row {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .intel-row__label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-muted);
      min-width: 80px;
      flex-shrink: 0;
    }

    .intel-row__value {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    /* ── Zone Badges ─────────────────────────── */

    .zone-badge {
      display: inline-flex;
      align-items: center;
      padding: 1px 6px;
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      text-transform: uppercase;
      border: 1px solid;
      letter-spacing: 0.04em;
    }

    /* ── Guardian Count ──────────────────────── */

    .guardian-count {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
    }

    .guardian-count__icon {
      color: var(--color-info);
    }

    /* ── Fortification Row ───────────────────── */

    .fort-row {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: 3px 8px;
      background: color-mix(in srgb, var(--color-primary) 6%, transparent);
      border-left: 2px solid var(--color-warning);
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      color: var(--color-warning);
    }

    .fort-row__zone {
      font-weight: bold;
    }

    .fort-row__expiry {
      color: var(--color-text-muted);
      font-size: 10px;
    }

    /* ── Report Count ────────────────────────── */

    .card__footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--space-2) var(--space-4);
      border-top: 1px solid var(--color-border);
      background: rgba(56 189 248 / 0.02);
    }

    .card__reports {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--color-text-muted);
    }

    /* ── Empty State ─────────────────────────── */

    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-6) var(--space-4);
      text-align: center;
    }

    .empty__icon {
      color: var(--color-icon);
      opacity: 0;
      animation: empty-icon-enter 0.6s ease-out 0.2s forwards;
    }

    @keyframes empty-icon-enter {
      from {
        opacity: 0;
        transform: scale(0.7) rotate(-8deg);
      }
      to {
        opacity: 0.6;
        transform: scale(1) rotate(0deg);
      }
    }

    .empty__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-muted);
      margin: 0;
    }

    .empty__hint {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      max-width: 340px;
      line-height: 1.6;
    }

    /* ── Compact Mode (inline in Overview) ─── */

    :host([compact]) {
      padding: 0;
    }

    .compact-header {
      appearance: none;
      font: inherit;
      text-align: start;
      background: none;
      border: none;
      color: inherit;
      width: 100%;
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-3) var(--space-4);
      cursor: pointer;
      user-select: none;
      transition: background 150ms ease;
    }

    .compact-header:hover {
      background: rgba(255 255 255 / 0.02);
    }

    .compact-header__icon {
      color: var(--color-info);
      flex-shrink: 0;
      transition: transform 200ms ease;
    }

    .compact-header__icon--expanded {
      transform: rotate(90deg);
    }

    .compact-header__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-tertiary);
      flex: 1;
    }

    .compact-header__badge {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--color-info);
      padding: 1px 6px;
      border: 1px solid color-mix(in srgb, var(--color-info) 30%, var(--color-surface-raised));
    }

    :host([compact]) .dossier-grid {
      padding: 0 var(--space-4) var(--space-3);
      gap: var(--space-3);
    }

    :host([compact]) .card {
      border: 1px solid var(--color-border);
    }

    :host([compact]) .empty {
      padding: var(--space-3) var(--space-4);
    }

    :host([compact]) .empty__icon {
      display: none;
    }

    :host([compact]) .empty__title {
      font-size: var(--text-xs);
    }

    :host([compact]) .empty__hint {
      font-size: 11px;
    }

    /* ── Reduced Motion ─────────────────────── */

    @media (prefers-reduced-motion: reduce) {
      .card {
        opacity: 1;
        animation: none;
      }

      .empty__icon {
        opacity: 0.6;
        animation: none;
      }

      .compact-header__icon {
        transition: none;
      }
    }
  `;

  @property({ type: Object }) epoch: Epoch | null = null;
  @property({ type: Object }) myParticipant: EpochParticipant | null = null;
  @property({ type: Array }) participants: EpochParticipant[] = [];
  @property({ type: Boolean, reflect: true }) compact = false;
  @state() private _expanded = true;
  @state() private _dossiers: IntelDossier[] = [];
  @state() private _loading = false;
  private _loadedKey = '';

  override willUpdate(changed: Map<string, unknown>) {
    super.willUpdate(changed);
    const key = `${this.epoch?.id}|${this.myParticipant?.simulation_id}`;
    if (key !== this._loadedKey && this.epoch?.id && this.myParticipant?.simulation_id) {
      this._loadedKey = key;
      this._loadDossiers();
    }
  }

  private async _loadDossiers() {
    if (!this.epoch?.id || !this.myParticipant?.simulation_id) return;
    this._loading = true;
    try {
      const resp = await epochsApi.getIntelDossiers(
        this.epoch.id,
        this.myParticipant.simulation_id,
      );
      this._dossiers = resp.data ?? [];
    } catch {
      this._dossiers = [];
    } finally {
      this._loading = false;
    }
  }

  protected render() {
    if (this._loading) return nothing;
    const dossiers = this._dossiers;

    if (this.compact) {
      return html`
        <button type="button"
          class="compact-header"
          aria-expanded=${this._expanded}
          @click=${() => {
            this._expanded = !this._expanded;
          }}
        >
          <span class="compact-header__icon ${this._expanded ? 'compact-header__icon--expanded' : ''}" aria-hidden="true">
            ${icons.chevronRight(12)}
          </span>
          <span class="compact-header__title">${msg('Intel Dossier')}</span>
          ${dossiers.length > 0 ? html`<span class="compact-header__badge">${dossiers.length}</span>` : nothing}
        </button>
        ${this._expanded ? this._renderContent(dossiers) : nothing}
      `;
    }

    return this._renderContent(dossiers);
  }

  private _renderContent(dossiers: IntelDossier[]) {
    if (dossiers.length === 0) {
      return html`
        <div class="empty" role="status">
          <div class="empty__icon" aria-hidden="true">${icons.operativeSpy(40)}</div>
          <h3 class="empty__title">${msg('No intelligence gathered yet.')}</h3>
          <p class="empty__hint">
            ${msg('Deploy spies to gather point-in-time intelligence snapshots on your opponents. Intel may become outdated as conditions change.')}
          </p>
          <p class="empty__hint">
            ${msg('To detect incoming threats against you, use Counter-Intel Sweep (4 RP) from the action panel.')}
          </p>
        </div>
      `;
    }

    return html`
      <div class="dossier-grid" role="list" aria-label="${msg('Opponent intelligence dossiers')}">
        ${dossiers.map((d, i) => this._renderCard(d, i))}
      </div>
    `;
  }

  private _renderCard(dossier: IntelDossier, index: number) {
    const isStale = dossier.is_stale;

    return html`
      <article
        class="card ${isStale ? 'card--stale' : ''}"
        role="listitem"
        style="animation-delay: ${index * 80}ms"
        aria-label="${dossier.simulation_name}"
      >
        <div class="card__header">
          <h4 class="card__name">${dossier.simulation_name}</h4>
          <span class="card__cycle">
            ${msg('Last intel')}: ${msg(str`Cycle ${dossier.last_intel_cycle}`)}
            ${isStale ? html`<span class="card__stale-tag">${msg('Intel may be outdated')}</span>` : nothing}
          </span>
        </div>

        <div class="card__body">
          <!-- Zone Security -->
          ${
            dossier.zone_details.length > 0 || dossier.zone_security_levels.length > 0
              ? html`
              <div class="intel-row">
                <span class="intel-row__label">${msg('Zone Security')}</span>
                <span class="intel-row__value">
                  ${
                    dossier.zone_details.length > 0
                      ? dossier.zone_details.map(
                          (z) => html`
                          <span
                            class="zone-badge"
                            style="color: ${SECURITY_COLORS[z.security_level] ?? 'var(--color-text-tertiary)'}; border-color: ${SECURITY_COLORS[z.security_level] ?? 'var(--color-text-muted)'}"
                          >${z.name}: ${z.security_level}</span>
                        `,
                        )
                      : dossier.zone_security_levels.map(
                          (level) => html`
                          <span
                            class="zone-badge"
                            style="color: ${SECURITY_COLORS[level] ?? 'var(--color-text-tertiary)'}; border-color: ${SECURITY_COLORS[level] ?? 'var(--color-text-muted)'}"
                          >${level}</span>
                        `,
                        )
                  }
                </span>
              </div>
            `
              : nothing
          }

          <!-- Guardian Count -->
          <div class="intel-row">
            <span class="intel-row__label">${msg('Guardians detected')}</span>
            <span class="guardian-count">
              <span class="guardian-count__icon" aria-hidden="true">${icons.operativeGuardian(14)}</span>
              ${dossier.guardian_count}
            </span>
          </div>

          <!-- Fortifications -->
          ${
            dossier.fortifications.length > 0
              ? html`
              <div class="intel-row">
                <span class="intel-row__label">${msg('Fortifications')}</span>
              </div>
              ${dossier.fortifications.map(
                (f) => html`
                  <div class="fort-row">
                    <span class="fort-row__zone">${f.zone_name}</span>
                    <span>+${f.security_bonus}</span>
                    <span class="fort-row__expiry">${msg(str`expires cycle ${f.expires_at_cycle}`)}</span>
                  </div>
                `,
              )}
            `
              : nothing
          }
        </div>

        <div class="card__footer">
          <span class="card__reports">
            ${msg('Snapshot')} &middot; ${dossier.report_count} ${dossier.report_count === 1 ? msg('report') : msg('reports')}
          </span>
        </div>
      </article>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-epoch-intel-dossier-tab': VelgEpochIntelDossierTab;
  }
}
