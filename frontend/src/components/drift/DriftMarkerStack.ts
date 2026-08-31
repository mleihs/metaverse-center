/**
 * VelgDriftMarkerStack — the dig site, and the evidence lying on it.
 *
 * The whole of M2's push-your-luck lives in this strip. It shows the traveller exactly
 * three things, and deliberately never a fourth:
 *
 *   1. **The stack.** Every marker the node has turned up, laid open as octagonal seals.
 *      Two of a kind pulse a warning; the third tears the node.
 *   2. **The next yield.** What one more dig is WORTH. Stated, not hinted.
 *   3. **The Takt it costs.** Digging is travelling; it spends the same window.
 *
 * What it never shows is the odds (concept R4). The evidence is countable, the risk is
 * not numbered — a traveller who has seen two Statik-markers knows precisely as much as
 * the Bureau does, and has to decide anyway. That is the game.
 *
 * The Funkboje sits in the same strip, because the two decisions are the same decision
 * seen from both ends: dig for more, or send home what you have.
 *
 * Motion (plan §8): M-09 the marker punches in (scale 1.6 → 1, one bounce), the third of a
 * kind makes all three pulse; M-10 the dig commits into a sonar ring before the yield
 * lands; M-11 the Resonanzriss tears the strip open and the forfeited number falls apart.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import type { DriftMarkerClass, DriftSondierungReveal } from '../../types/drift.js';
import { icons } from '../../utils/icons.js';

/** Marker class → the token the seal is drawn in. Never a raw colour: a Statik marker in
 *  the cyberpunk theme has to be the theme's warning, not a hard-coded yellow. */
const MARKER_TONE: Record<DriftMarkerClass, string> = {
  resonanz: 'var(--color-info)',
  statik: 'var(--color-warning)',
  echo: 'var(--color-epoch-influence)',
};

/** A marker class as the traveller reads it. The chip used to carry the raw enum
 *  (`title="statik"`) and a bare initial, so the stack — the whole tell for how close the
 *  node is to tearing — could only be counted, never read. */
function markerLabel(marker: DriftMarkerClass): string {
  switch (marker) {
    case 'resonanz':
      return msg('Resonanz');
    case 'statik':
      return msg('Statik');
    case 'echo':
      return msg('Echo');
    default:
      return marker;
  }
}

/** The single glyph on the chip — taken from the TRANSLATED name, so it stays the initial
 *  of the word the player actually sees. */
function markerInitial(marker: DriftMarkerClass): string {
  return markerLabel(marker).charAt(0).toUpperCase();
}

@localized()
@customElement('velg-drift-marker-stack')
export class VelgDriftMarkerStack extends LitElement {
  static styles = css`
    :host {
      display: block;
      --_seal: 22px;
    }

    .site {
      padding: var(--space-3);
      background: var(--color-surface-sunken);
      /* Der gestrichelte Rahmen bleibt die Form, der Akzent faerbt ihn. */
      border: var(--border-width-thin) dashed color-mix(in srgb, var(--color-primary) 50%, var(--color-border));
    }

    .site--rissig {
      border-color: color-mix(in srgb, var(--color-danger) 55%, var(--color-border));
      background: var(--color-danger-bg);
    }

    .site__label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
      margin: 0 0 var(--space-2);
      font-family: var(--font-brutalist);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      font-size: var(--text-xs);
      color: var(--color-text-quiet);
    }

    .site__digs {
      font-family: var(--font-mono);
      color: var(--color-text-secondary);
    }

    .stack {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1-5);
      min-height: var(--_seal);
      margin-bottom: var(--space-2-5);
    }

    .stack__empty {
      font-family: var(--font-bureau);
      font-size: var(--text-sm);
      color: var(--color-text-quiet);
    }

    /* M-09: the seal-shaped marker punches in. Octagon = the Bureau's stamp language. */
    .marker {
      display: grid;
      place-items: center;
      width: var(--_seal);
      height: var(--_seal);
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      color: var(--_tone);
      background: color-mix(in srgb, var(--_tone) 12%, transparent);
      border: var(--border-width-thin) solid var(--_tone);
      clip-path: polygon(
        30% 0%,
        70% 0%,
        100% 30%,
        100% 70%,
        70% 100%,
        30% 100%,
        0% 70%,
        0% 30%
      );
      animation: stamp 220ms var(--ease-bounce) both;
      animation-delay: calc(var(--i, 0) * 60ms);
    }

    /* Two of a kind: the node is one dig from tearing, and it says so before you commit. */
    .marker--warn {
      animation:
        stamp 220ms var(--ease-bounce) both,
        warn 900ms var(--ease-in-out) 260ms 2;
    }

    @keyframes stamp {
      from {
        opacity: 0;
        transform: scale(1.6);
      }
      60% {
        transform: scale(0.94);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    @keyframes warn {
      0%,
      100% {
        box-shadow: none;
      }
      50% {
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--_tone) 45%, transparent);
      }
    }

    .yield {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-2);
      margin: 0 0 var(--space-2-5);
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
    }

    .yield__value {
      font-size: var(--text-md);
      font-weight: var(--font-bold);
      color: var(--color-primary);
    }

    .actions {
      display: grid;
      gap: var(--space-2);
    }

    .act {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-1-5);
      min-height: 36px;
      padding: var(--space-2) var(--space-3);
      font-family: var(--font-brutalist);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      font-size: var(--text-xs);
      color: var(--color-text-primary);
      background: var(--color-surface);
      /* Knopf: Akzent auf dem ganzen Rahmen. */
      border: var(--border-width-thin) solid color-mix(in srgb, var(--color-primary) 55%, var(--color-border));
      cursor: pointer;
      transition:
        background var(--transition-fast),
        border-color var(--transition-fast);
    }

    .act:hover:not(:disabled) {
      background: var(--color-primary-bg);
      border-color: var(--color-primary);
    }

    .act:focus-visible {
      outline: none;
      box-shadow: var(--ring-focus);
    }

    .act:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    .act--bank {
      border-color: var(--color-success);
    }

    .act--bank:hover:not(:disabled) {
      background: var(--color-success-bg);
      border-color: var(--color-success);
    }

    /* M-10: the commit sends a sonar ring out of the button BEFORE the yield lands —
       the decision precedes the reveal, and the reveal is the spectacle. */
    .act--digging::after {
      content: '';
      position: absolute;
      inset: 0;
      border: var(--border-width-thin) solid var(--color-primary);
      animation: sonar 720ms var(--ease-out) both;
    }

    .act {
      position: relative;
      overflow: hidden;
    }

    @keyframes sonar {
      from {
        opacity: 0.9;
        clip-path: circle(0% at 50% 50%);
      }
      to {
        opacity: 0;
        clip-path: circle(120% at 50% 50%);
      }
    }

    .hint {
      margin: var(--space-2) 0 0;
      font-family: var(--font-bureau);
      font-size: var(--text-xs);
      line-height: var(--leading-snug);
      color: var(--color-text-quiet);
    }

    .riss {
      margin: var(--space-2) 0 0;
      font-family: var(--font-bureau);
      font-size: var(--text-sm);
      line-height: var(--leading-snug);
      color: var(--color-text-danger);
    }

    @media (max-width: 640px) {
      .act {
        min-height: 44px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .marker,
      .marker--warn,
      .act--digging::after {
        animation: none;
      }
      .act {
        transition: none;
      }
    }
  `;

  /** The open marker stack at the node the run is standing on. */
  @property({ attribute: false }) markers: DriftMarkerClass[] = [];
  /** How often this node has been dug on this run. */
  @property({ type: Number }) digs = 0;
  /** What the NEXT dig is worth (drift_tuning.sondierung_yields — never a client constant). */
  @property({ type: Number }) nextYield = 0;
  /** The node has already torn: the Drift comes through it now. */
  @property({ type: Boolean }) rissig = false;
  /** Loose (unbanked) haul — what a Funkboje would transmit, and a Riss could take. */
  @property({ type: Number }) loose = 0;
  /** Already transmitted: safe from everything that follows. */
  @property({ type: Number }) safe = 0;
  /** The Funkboje's rate, from the server's tuning. */
  @property({ type: Number }) bankRate = 0.7;
  /** Is there a transmitter here (a foreign broadcast edge / relay)? */
  @property({ type: Boolean }) canBank = false;
  /** The reveal of the last dig — drives the Riss line. */
  @property({ attribute: false }) reveal: DriftSondierungReveal | null = null;
  @property({ type: Boolean }) busy = false;
  @property({ type: Boolean }) digging = false;
  /** Takte left: a dig costs one, and a dig with none left is refused server-side. */
  @property({ type: Number }) window = 0;

  /** The class that is one marker away from tearing the node — the warning the stack owes
   *  the traveller BEFORE they commit, not after. */
  private _atRisk(): DriftMarkerClass | null {
    const counts = new Map<DriftMarkerClass, number>();
    for (const marker of this.markers) counts.set(marker, (counts.get(marker) ?? 0) + 1);
    for (const [marker, n] of counts) if (n >= 2) return marker;
    return null;
  }

  private _dig(): void {
    this.dispatchEvent(new CustomEvent('drift-sondieren', { bubbles: true, composed: true }));
  }

  private _bank(): void {
    this.dispatchEvent(new CustomEvent('drift-bank', { bubbles: true, composed: true }));
  }

  protected render() {
    const atRisk = this._atRisk();
    const bustReveal = this.reveal?.bust ? this.reveal : null;
    const bankable = this.canBank && this.loose > 0;

    return html`
      <div class="site ${this.rissig ? 'site--rissig' : ''}">
        <p class="site__label">
          <span>${this.rissig ? msg('Grabung · rissig') : msg('Grabung')}</span>
          <span class="site__digs"
            >${this.digs === 1 ? msg('1 Stich') : msg(str`${this.digs} Stiche`)}</span
          >
        </p>

        <div class="stack" aria-live="polite">
          ${
            this.markers.length
              ? this.markers.map((marker, i) =>
                  // keyed() on (dig-count, index): Lit recycles an element at the same
                  // template position, and a recycled element does NOT restart its CSS
                  // animation — so when the third marker lands, the two already on the node
                  // would keep their old class list and simply never pulse. The warning
                  // would fire for exactly one seal instead of the three that matter. Keying
                  // on the dig count forces a fresh element per dig, which is also the only
                  // way the punch-in (M-09) plays for a marker a Störung dropped here.
                  keyed(
                    `${this.digs}:${i}`,
                    html`<span
                      class="marker ${atRisk === marker ? 'marker--warn' : ''}"
                      style="--_tone:${MARKER_TONE[marker]}; --i:${i}"
                      title=${markerLabel(marker)}
                      role="img"
                      aria-label=${markerLabel(marker)}
                      >${markerInitial(marker)}</span
                    >`,
                  ),
                )
              : html`<span class="stack__empty">${msg('Der Knoten ist unberührt.')}</span>`
          }
        </div>

        <p class="yield">
          <span>${msg('Nächster Stich')}</span>
          <span class="yield__value">+${this.nextYield}</span>
        </p>

        <div class="actions">
          <button
            class="act ${this.digging ? 'act--digging' : ''}"
            ?disabled=${this.busy || this.window < 1}
            @click=${this._dig}
          >
            ${icons.search(14)}
            <span>${msg('Sondieren')} · ${msg('1 Takt')}</span>
          </button>
          ${
            this.canBank
              ? html`<button
                  class="act act--bank"
                  ?disabled=${this.busy || !bankable}
                  @click=${this._bank}
                >
                  ${icons.upload(14)}
                  <span>
                    ${
                      // With nothing loose the button is disabled anyway — and "0 von 0" is
                      // noise dressed up as a number. Say what it IS, not what it would pay.
                      bankable
                        ? msg(
                            str`Funkboje · ${Math.floor(this.loose * this.bankRate)} von ${this.loose}`,
                          )
                        : msg('Funkboje · nichts Loses an Bord')
                    }
                  </span>
                </button>`
              : ''
          }
        </div>

        ${
          atRisk && !this.rissig
            ? html`<p class="hint">
                ${msg('Zwei Marker derselben Sorte liegen offen. Ein dritter reißt den Knoten auf.')}
              </p>`
            : html`<p class="hint">
                ${
                  this.safe > 0
                    ? msg(str`${this.loose} lose, ${this.safe} gesendet und sicher.`)
                    : msg('Was du trägst, kannst du verlieren. Was du sendest, kommt an.')
                }
              </p>`
        }
        ${
          bustReveal
            ? html`<p class="riss" role="status">
                ${msg(str`Resonanzriss. ${bustReveal.forfeited} Punkte Vermessung sind im Knoten geblieben.`)}
              </p>`
            : ''
        }
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-drift-marker-stack': VelgDriftMarkerStack;
  }
}
