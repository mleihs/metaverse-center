/**
 * VelgDriftLedgerStrip — the traveller's Bureau account, in the HUD.
 *
 * P0 paid nothing and therefore showed nothing: a run ended and the traveller had no way
 * to answer "what did I earn?". The strip is the answer, and it is the first thing the
 * Fun-Kern makes visible (concept M4/M6).
 *
 * Two currencies, deliberately different in character:
 *   SIEGEL — spendable standing (and from W3, purchasing power). Volatile, it goes down.
 *   VP     — the rank score. It only ever rises; it is a RECORD, not a purse.
 * The rank bar therefore fills toward a promotion that can actually be sat: `exam_ready`
 * is resolved server-side as the FULL predicate (VP and fee and not already held), so the
 * stamp only ever appears on a click that will succeed.
 *
 * Motion (plan §8): M-01 the Siegel/VP odometer counts up over 240 ms with an amber delta
 * chip; M-02 the rank bar eases, and on the promotion threshold it morphs into the Bureau
 * stamp. Both collapse to their end state under prefers-reduced-motion — the information
 * is never in the movement.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { DriftProfile } from '../../types/drift.js';
import { icons } from '../../utils/icons.js';

/** Rank → the Bureau's own wording. Unknown ranks fall back to the raw slug rather than
 *  to a wrong label: an account screen that guesses at a rank is worse than one that is
 *  honestly terse. */
const RANK_LABELS: Record<string, () => string> = {
  aspirant: () => msg('Aspirant'),
  feldkartograph: () => msg('Feldkartograph'),
  vermesser: () => msg('Vermesser'),
  grenzgaenger: () => msg('Grenzgänger'),
  kartograph_1k: () => msg('Kartograph I. Klasse'),
};

export function rankLabel(rank: string): string {
  return RANK_LABELS[rank]?.() ?? rank;
}

@localized()
@customElement('velg-drift-ledger-strip')
export class VelgDriftLedgerStrip extends LitElement {
  static styles = css`
    :host {
      display: block;
      --_siegel: var(--color-primary);
      --_vp: var(--color-info);
      --_rule: color-mix(in srgb, var(--color-border) 70%, transparent);
    }

    .ledger {
      margin: 0 0 var(--space-3);
      padding: var(--space-2) var(--space-3);
      background: color-mix(in srgb, var(--color-surface-sunken) 80%, transparent);
      border: var(--border-width-thin) solid var(--_rule);
      border-left: var(--border-width-thick) solid var(--_siegel);
    }

    .ledger__row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-2);
    }

    .coin {
      display: flex;
      align-items: baseline;
      gap: var(--space-1-5);
    }

    .coin__label {
      font-family: var(--font-brutalist);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
    }

    .coin__value {
      font-family: var(--font-mono);
      font-size: var(--text-md);
      font-weight: var(--font-bold);
      font-variant-numeric: tabular-nums;
      color: var(--_siegel);
    }

    .coin--vp .coin__value {
      color: var(--_vp);
    }

    /* M-01: the delta chip — the only place the strip raises its voice. */
    .delta {
      margin-left: var(--space-1);
      padding: 0 var(--space-1);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-inverse);
      background: var(--_siegel);
      animation: delta-pulse 240ms var(--ease-dramatic) both,
        delta-fade var(--duration-slower) var(--ease-out) 1400ms both;
    }

    .coin--vp .delta {
      background: var(--_vp);
    }

    @keyframes delta-pulse {
      from {
        opacity: 0;
        transform: translateY(4px) scale(0.9);
      }
      to {
        opacity: 1;
        transform: none;
      }
    }

    @keyframes delta-fade {
      to {
        opacity: 0;
      }
    }

    .rank {
      margin-top: var(--space-2);
    }

    .rank__head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-2);
      margin-bottom: var(--space-1);
    }

    .rank__name {
      font-family: var(--font-brutalist);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      font-size: var(--text-xs);
      color: var(--color-text-primary);
    }

    .rank__goal {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      font-variant-numeric: tabular-nums;
      color: var(--color-text-muted);
    }

    .rank__bar {
      position: relative;
      height: 4px;
      background: var(--color-surface);
      border: var(--border-width-thin) solid var(--_rule);
      overflow: hidden;
    }

    /* M-02: the bar eases toward the threshold; the easing is on the leaf, never the panel. */
    .rank__fill {
      display: block;
      height: 100%;
      background: var(--_vp);
      transition: width 280ms cubic-bezier(0.22, 1, 0.36, 1);
    }

    .rank__fill--ready {
      background: var(--_siegel);
    }

    /* M-02 (threshold): the bar becomes a stamp — the exam is unlocked, and the Bureau
       says so in its own vocabulary. */
    .exam {
      display: flex;
      align-items: center;
      gap: var(--space-1-5);
      width: 100%;
      margin-top: var(--space-2);
      padding: var(--space-1-5) var(--space-2);
      font-family: var(--font-brutalist);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      font-size: var(--text-xs);
      color: var(--color-text-inverse);
      background: var(--_siegel);
      border: var(--border-width-thin) solid var(--_siegel);
      box-shadow: var(--shadow-xs);
      cursor: pointer;
      animation: stamp-in 480ms var(--ease-bounce) both;
    }

    .exam:hover:not(:disabled) {
      background: var(--color-primary-hover);
    }

    .exam:focus-visible {
      outline: none;
      box-shadow: var(--ring-focus);
    }

    .exam:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .exam svg {
      flex: none;
    }

    @keyframes stamp-in {
      0% {
        opacity: 0;
        transform: scale(2.2) rotate(-6deg);
      }
      60% {
        opacity: 1;
        transform: scale(0.94) rotate(1deg);
      }
      100% {
        opacity: 1;
        transform: none;
      }
    }

    .scars {
      margin: var(--space-2) 0 0;
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .scars__debt {
      color: var(--color-warning);
    }

    @media (prefers-reduced-motion: reduce) {
      .delta,
      .exam {
        animation: none;
      }
      .rank__fill {
        transition: none;
      }
    }
  `;

  @property({ attribute: false }) profile: DriftProfile | null = null;
  @property({ type: Boolean }) busy = false;

  /** The last-seen values, so a change can be shown as a DELTA and not just a new number.
   *  Held as plain fields (not reactive state) — they are the memory of the animation, not
   *  an input to it. */
  private _prevSiegel: number | null = null;
  private _prevVp: number | null = null;

  @state() private _dSiegel = 0;
  @state() private _dVp = 0;

  protected willUpdate(changed: PropertyValues): void {
    if (!changed.has('profile') || !this.profile) return;
    const { siegel, vp } = this.profile;
    // First sight of an account is not an earning — only a CHANGE is.
    this._dSiegel = this._prevSiegel === null ? 0 : siegel - this._prevSiegel;
    this._dVp = this._prevVp === null ? 0 : vp - this._prevVp;
    this._prevSiegel = siegel;
    this._prevVp = vp;
  }

  private _sitExam(): void {
    const rank = this.profile?.next_rank;
    if (!rank) return;
    this.dispatchEvent(
      new CustomEvent('drift-exam', {
        bubbles: true,
        composed: true,
        detail: { rank },
      }),
    );
  }

  protected render() {
    const p = this.profile;
    if (!p) return html``;

    const goal = p.next_rank_vp;
    const pct = Math.round(Math.min(1, Math.max(0, p.next_rank_progress)) * 100);

    return html`
      <div class="ledger" aria-live="polite">
        <div class="ledger__row">
          <span class="coin">
            <span class="coin__label">${msg('Siegel')}</span>
            <span class="coin__value">${p.siegel}</span>
            ${this._dSiegel > 0 ? html`<span class="delta">+${this._dSiegel}</span>` : ''}
          </span>
          <span class="coin coin--vp">
            <span class="coin__label">${msg('VP')}</span>
            <span class="coin__value">${p.vp}</span>
            ${this._dVp > 0 ? html`<span class="delta">+${this._dVp}</span>` : ''}
          </span>
        </div>

        <div class="rank">
          <div class="rank__head">
            <span class="rank__name">${rankLabel(p.clearance_rank)}</span>
            ${
              p.next_rank && goal
                ? html`<span class="rank__goal">${p.vp}/${goal} ${msg('VP')}</span>`
                : ''
            }
          </div>
          ${
            p.next_rank
              ? html`<div
                  class="rank__bar"
                  role="progressbar"
                  aria-valuenow=${pct}
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-label=${msg(str`Fortschritt zur Prüfung: ${rankLabel(p.next_rank)}`)}
                >
                  <span
                    class="rank__fill ${p.exam_ready ? 'rank__fill--ready' : ''}"
                    style="width:${pct}%"
                  ></span>
                </div>`
              : ''
          }
          ${
            p.exam_ready && p.next_rank
              ? html`<button
                  class="exam"
                  ?disabled=${this.busy}
                  @click=${this._sitExam}
                  aria-label=${msg(
                    str`Prüfung ablegen: ${rankLabel(p.next_rank)} – Gebühr ${p.next_rank_fee ?? 0} Siegel`,
                  )}
                >
                  ${icons.stampClassified(14)}
                  <span
                    >${msg('Prüfung ablegen')} · ${p.next_rank_fee ?? 0} ${msg('Siegel')}</span
                  >
                </button>`
              : ''
          }
        </div>

        ${
          p.zerfaserung_count > 0 || p.vermessung_lodged > 0
            ? html`<p class="scars">
                ${msg('Vermessung gesamt')}: ${p.vermessung_lodged}
                ${
                  p.zerfaserung_count > 0
                    ? html` · <span class="scars__debt"
                        >${msg('Zerfaserungen')}: ${p.zerfaserung_count}</span
                      >`
                    : ''
                }
              </p>`
            : ''
        }
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-drift-ledger-strip': VelgDriftLedgerStrip;
  }
}
