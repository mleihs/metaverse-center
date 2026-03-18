/**
 * Academy Epoch Card — Dashboard CTA for solo training epochs.
 *
 * Military briefing aesthetic: classified training dossier with
 * bot opponent roster and difficulty selector. Shown on the
 * SimulationsDashboard for users with no or few epoch completions.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { icons } from '../../utils/icons.js';

@localized()
@customElement('velg-academy-epoch-card')
export class VelgAcademyEpochCard extends LitElement {
  static styles = css`
    :host {
      display: block;
      opacity: 0;
      animation: shard-enter 500ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) forwards;
      animation-delay: calc(var(--i, 0) * 80ms);
    }

    @keyframes shard-enter {
      from { opacity: 0; transform: translateY(16px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    @keyframes badge-pop {
      from { opacity: 0; transform: scale(0.7); }
      to   { opacity: 1; transform: scale(1); }
    }

    @keyframes btn-materialize {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    @keyframes scanline {
      from { transform: translateY(-100%); }
      to   { transform: translateY(100%); }
    }

    .card {
      position: relative;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-left: 3px solid var(--color-primary);
      padding: 24px;
      overflow: hidden;
    }

    /* Faint scanline overlay */
    .card::after {
      content: '';
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 3px,
        rgba(255, 255, 255, 0.01) 3px,
        rgba(255, 255, 255, 0.01) 4px
      );
      pointer-events: none;
    }

    /* ── Header ── */

    .header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 16px;
    }

    .header__classification {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--color-primary);
    }

    .header__divider {
      flex: 1;
      height: 1px;
      background: linear-gradient(90deg, var(--color-border) 0%, transparent 100%);
    }

    .header__status {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 10px;
      color: var(--color-text-muted);
      letter-spacing: 1px;
    }

    /* ── Description ── */

    .desc {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 12px;
      line-height: 1.6;
      color: var(--color-text-muted);
      margin-bottom: 20px;
    }

    /* ── Bot Roster ── */

    .roster {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
      padding: 12px;
      background: var(--color-surface-sunken);
      border: 1px solid var(--color-border-light);
    }

    .roster__label {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--color-border);
      writing-mode: vertical-lr;
      text-orientation: mixed;
      transform: rotate(180deg);
    }

    .roster__bots {
      display: flex;
      gap: 10px;
      flex: 1;
    }

    .roster__bot {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      opacity: 0;
      animation: badge-pop 200ms var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)) both;
      animation-delay: calc(var(--i, 0) * 60ms + 300ms);
    }

    .roster__bot-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-icon);
      transition: color 200ms, border-color 200ms;
    }

    .roster__bot:hover .roster__bot-icon {
      color: var(--color-primary);
      border-color: var(--color-warning-border);
    }

    .roster__bot-name {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 8px;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: var(--color-border);
    }

    /* ── Footer ── */

    .footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
    }

    .footer__meta {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .difficulty {
      display: flex;
      align-items: center;
      gap: 6px;
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 10px;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: var(--color-text-muted);
    }

    .difficulty__pips {
      display: flex;
      gap: 3px;
    }

    .difficulty__pip {
      width: 6px;
      height: 6px;
      border: 1px solid var(--color-border);
      transition: background 200ms;
    }

    .difficulty__pip--active {
      background: var(--color-primary);
      border-color: var(--color-primary);
    }

    .format-tag {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 9px;
      letter-spacing: 1px;
      text-transform: uppercase;
      padding: 2px 8px;
      border: 1px solid var(--color-border);
      color: var(--color-text-muted);
    }

    /* ── CTA Button ── */

    .btn-train {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 20px;
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: var(--color-surface-sunken);
      background: var(--color-primary);
      border: none;
      cursor: pointer;
      transition: background 150ms, transform 150ms, box-shadow 150ms;
      box-shadow: 3px 3px 0 var(--color-warning-glow);
      opacity: 0;
      animation: btn-materialize 400ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) both;
      animation-delay: 500ms;
    }

    .btn-train:hover {
      background: var(--color-primary-hover);
      transform: translate(-2px, -2px);
      box-shadow: 5px 5px 0 var(--color-warning-glow);
    }

    .btn-train:active {
      transform: translate(0);
      box-shadow: 2px 2px 0 var(--color-warning-glow);
    }

    .btn-train:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }

    .btn-train svg {
      width: 14px;
      height: 14px;
    }

    /* ── Responsive ── */

    @media (max-width: 560px) {
      .card { padding: 16px; }
      .footer { flex-direction: column; align-items: stretch; }
      .btn-train { justify-content: center; }
      .roster__label { display: none; }
    }
  `;

  @property({ type: Number }) academyEpochsPlayed = 0;
  @property({ type: Boolean }) hasActiveEpoch = false;

  private _handleStart(): void {
    this.dispatchEvent(new CustomEvent('start-academy', { bubbles: true, composed: true }));
  }

  protected render() {
    const bots = [
      { icon: icons.botSentinel(20), name: msg('Sentinel') },
      { icon: icons.botWarlord(20), name: msg('Warlord') },
      { icon: icons.botDiplomat(20), name: msg('Diplomat') },
    ];

    return html`
      <div class="card">
        <!-- Header -->
        <div class="header">
          <span class="header__classification">${msg('Academy // Training Protocol')}</span>
          <div class="header__divider"></div>
          ${
            this.academyEpochsPlayed > 0
              ? html`<span class="header__status">${this.academyEpochsPlayed} ${msg('completed')}</span>`
              : html`<span class="header__status">${msg('Uninitialized')}</span>`
          }
        </div>

        <!-- Description -->
        <p class="desc">
          ${
            this.academyEpochsPlayed === 0
              ? msg(
                  'Initialize your first training simulation. Solo training vs 3 AI opponents — learn operative deployment, score mechanics, and alliance tactics.',
                )
              : msg(
                  'Continue your training regimen. Solo training vs 3 AI opponents — refine your operative strategy and score optimization.',
                )
          }
        </p>

        <!-- Bot Roster -->
        <div class="roster" role="group" aria-label=${msg('AI Opponents')}>
          <span class="roster__label">${msg('Hostiles')}</span>
          <div class="roster__bots">
            ${bots.map(
              (bot, i) => html`
                <div class="roster__bot" style="--i: ${i}">
                  <div class="roster__bot-icon" aria-hidden="true">${bot.icon}</div>
                  <span class="roster__bot-name">${bot.name}</span>
                </div>
              `,
            )}
          </div>
        </div>

        <!-- Footer -->
        <div class="footer">
          <div class="footer__meta">
            <div class="difficulty" aria-label=${msg('Difficulty: Easy')}>
              <span>${msg('Difficulty')}</span>
              <div class="difficulty__pips" aria-hidden="true">
                <div class="difficulty__pip difficulty__pip--active"></div>
                <div class="difficulty__pip"></div>
                <div class="difficulty__pip"></div>
              </div>
            </div>
            <span class="format-tag">${msg('Quick Match')}</span>
          </div>

          <button
            class="btn-train"
            @click=${this._handleStart}
            aria-label=${this.hasActiveEpoch ? msg('Resume active training') : this.academyEpochsPlayed === 0 ? msg('Start your first training') : msg('Start new training')}
          >
            ${icons.crossedSwords(14)}
            ${this.hasActiveEpoch ? msg('Resume Training') : this.academyEpochsPlayed === 0 ? msg('Start Training') : msg('New Training')}
          </button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-academy-epoch-card': VelgAcademyEpochCard;
  }
}
