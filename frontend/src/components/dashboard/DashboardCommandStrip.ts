/**
 * Die Befehlsleiste — die schmale Zeile über allem.
 *
 * `// OPERATIVE TERMINAL // kennung | SHARDS: n | ACTIVE OPS: n | SUBSTRATE: …`
 * links, der Zeitstempel rechts. Darunter, nur wenn das Substrat wirklich
 * gestört wird, eine Warnzeile.
 *
 * ⚠ „SUBSTRATE" KOMMT AUS DEM RÜCKEN, NICHT AUS EINER LISTENLÄNGE
 *
 * Die alte Leiste rechnete `_activeResonances.length > 0` und meldete daraufhin
 * ANOMAL. Der Bestand, den sie zählte, enthält aber auch ABKLINGENDE Beben — und
 * auf Prod steht genau eines, sonst keines. Die Zeile behauptete eine Störung,
 * während der Bannertext direkt darunter korrekt „residual substrate
 * displacement" sagte: zwei Herleitungen derselben Frage im selben Bild, von
 * denen eine falsch war.
 *
 * `substrate_status` kommt jetzt fertig gerechnet aus `UserDashboardService`
 * (`detected|impacting`). `active_resonance_count` bleibt die andere, weiter
 * gefasste Frage — wie viele Beben überhaupt im Spiel sind. Beide stehen in der
 * Leiste, und sie sagen verschiedene Dinge.
 *
 * DIE ZEILE IST RANDLOS, IHR INHALT NICHT
 * `.stage-bleed-row`: die Trennlinie läuft über den ganzen Sichtbereich, der
 * Text steht bündig unter den Abschnitten darunter.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { icons } from '../../utils/icons.js';
import { stageStyles } from '../shared/stage-styles.js';

@localized()
@customElement('velg-dashboard-command-strip')
export class VelgDashboardCommandStrip extends LitElement {
  static styles = [
    stageStyles,
    css`
      :host {
        display: block;
        background: var(--color-surface-sunken);
      }

      .strip {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--space-6);
        min-height: 44px;
        padding-block: var(--space-2);
        border-bottom: var(--border-width-thin) solid var(--color-border-light);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        letter-spacing: var(--tracking-wider);
        text-transform: uppercase;
        color: var(--color-text-quiet);
      }

      .strip__left {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2) var(--space-3);
        min-width: 0;
      }

      .strip__value {
        color: var(--color-text-primary);
      }

      .strip__value--anomalous {
        color: var(--color-danger);
      }

      .strip__value--stable {
        color: var(--color-accent-green);
      }

      .strip__sep {
        color: var(--color-border);
      }

      .strip__clock {
        flex: 0 0 auto;
        white-space: nowrap;
      }

      /* Nur wenn wirklich gestört wird. Ein Banner, das immer da ist, wird
         nicht gelesen. */
      .alert {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding-block: var(--space-2-5);
        border-bottom: var(--border-width-thin) solid var(--color-border-light);
        background: var(--color-danger-bg);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        letter-spacing: var(--tracking-wide);
        color: var(--color-text-secondary);
      }

      .alert__dot {
        width: 6px;
        height: 6px;
        border-radius: var(--border-radius-full);
        background: var(--color-danger);
        flex: 0 0 auto;
        animation: blink 1.6s ease-in-out infinite;
      }

      .alert__icon {
        display: inline-flex;
        color: var(--color-danger);
        flex: 0 0 auto;
      }

      @keyframes blink {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.2;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .alert__dot {
          animation: none;
        }
      }
    `,
  ];

  @property({ type: String }) identity = '';
  @property({ type: Number }) shards = 0;
  @property({ type: Number }) activeOps = 0;
  /** `'anomalous'` oder `'stable'` — gerechnet im Rücken, nicht hier. */
  @property({ type: String }) substrate: 'anomalous' | 'stable' = 'stable';
  /** Wie viele Beben im Spiel sind, einschliesslich der abklingenden. */
  @property({ type: Number }) tremors = 0;
  @property({ type: String }) clock = '';

  protected render() {
    const anomalous = this.substrate === 'anomalous';
    return html`
      <div class="strip stage-bleed-row" aria-label=${msg('Operative status bar')}>
        <div class="strip__left">
          <span>// ${msg('Operative Terminal')} //</span>
          <span class="strip__value">${this.identity}</span>
          <span class="strip__sep">|</span>
          <span>${msg('Shards:')} <span class="strip__value">${this.shards}</span></span>
          <span class="strip__sep">|</span>
          <span>${msg('Active ops:')} <span class="strip__value">${this.activeOps}</span></span>
          <span class="strip__sep">|</span>
          <span>
            ${msg('Substrate:')}
            <span class="strip__value ${anomalous ? 'strip__value--anomalous' : 'strip__value--stable'}">
              ${anomalous ? msg('Anomalous') : msg('Stable')}
            </span>
          </span>
        </div>
        <span class="strip__clock">${this.clock}</span>
      </div>
      ${
        anomalous
          ? html`<div class="alert stage-bleed-row" role="alert">
              <span class="alert__dot" aria-hidden="true"></span>
              <span class="alert__icon" aria-hidden="true">${icons.substrateTremor(14)}</span>
              <span>${msg(str`${this.tremors} tremor(s) on record, at least one still disturbing the substrate`)}</span>
            </div>`
          : nothing
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-dashboard-command-strip': VelgDashboardCommandStrip;
  }
}
