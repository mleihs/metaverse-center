/**
 * VelgMetricExplainer — die drei Fragen, die eine Kennzahl beantworten muss.
 *
 * Neun Kennzahlen tragen im Werk eine Zahl und eine Farbe, und keine einzige
 * beantwortete alle drei Fragen, die ein Mensch vor einer Zahl hat:
 *
 *   WAS      ist das überhaupt?
 *   WARUM    steht sie so? (die Regel, nicht der heutige Wert)
 *   WAS TUN  kann ich dagegen tun?
 *
 * Drei von neun hatten eine Blase, alle drei in denselben Einstellungspanels;
 * die restlichen sechs hatten gar nichts. Beide Ansätze — Blase und
 * Aufschlüsselung — lagen halbfertig nebeneinander.
 *
 * Die Trennung, die dieses Bauteil festhält: die **Aufschlüsselung** neben der
 * Zahl beantwortet „warum HEUTE" mit Live-Werten, diese Blase beantwortet
 * „warum ÜBERHAUPT" mit der Regel. Zwei verschiedene Fragen, deshalb zwei
 * Darstellungen und keine Wahl zwischen ihnen.
 *
 * Warum ein Bauteil und keine Hilfsfunktion wie `renderInfoBubble`:
 *  - Die drei Schlüsselwörter sind Oberflächentext. Eine Hilfsfunktion müsste
 *    `msg()` auf Modulebene aufrufen, das genau einmal beim Import auswertet
 *    und einen Sprachwechsel nie mitbekommt. `@localized()` gibt es nur für
 *    Bauteile.
 *  - Der Blaseninhalt wird aus DIESEM Schattenbaum in `<velg-tooltip>`
 *    hineingereicht und deshalb auch hier gestaltet. Als Hilfsfunktion müsste
 *    jeder Aufrufer ein Stilmodul mit importieren und könnte es vergessen.
 *
 * Kein Link nach innen: `<velg-tooltip>` setzt `pointer-events: none` auf die
 * Blase, ein Anker darin wäre nicht anklickbar. Vertiefungen gehören daneben
 * als `<velg-help-tip>`.
 *
 * Verwendung:
 *   <velg-metric-explainer
 *     .metric=${msg('Zone stability')}
 *     .what=${msg('…')}
 *     .why=${msg('…')}
 *     .action=${msg('…')}
 *   ></velg-metric-explainer>
 *
 * Alle drei Teile sind Pflicht. `frontend/scripts/lint-metric-explainer-complete.sh`
 * weist eine Verwendung zurück, der einer fehlt — eine halbe Erklärung ist
 * genau der Zustand, den H7 beseitigt.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import './VelgTooltip.js';

@localized()
@customElement('velg-metric-explainer')
export class VelgMetricExplainer extends LitElement {
  static styles = css`
    :host {
      --_key: var(--color-text-muted);
      --_key-do: var(--color-primary);
      display: inline-flex;
      align-items: center;
      vertical-align: middle;
    }

    /* ── Auslöser ───────────────────────────────────────────── */

    .trigger {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      margin-left: var(--space-1);
      border: var(--border-width-thin) solid var(--color-border);
      background: transparent;
      color: var(--color-text-muted);
      font-family: var(--font-brutalist);
      font-size: 10px;
      font-weight: var(--font-bold);
      line-height: 1;
      cursor: help;
      user-select: none;
      transition:
        color var(--transition-fast),
        border-color var(--transition-fast),
        box-shadow var(--transition-fast);
    }

    :host(:hover) .trigger,
    .trigger:focus-visible {
      color: var(--color-primary);
      border-color: var(--color-primary);
      box-shadow: var(--shadow-xs);
    }

    .trigger:focus-visible {
      outline: var(--ring-focus);
      outline-offset: 2px;
    }

    /* Auf Zeigegeräten ohne Hover (Touch) ist das Kästchen die einzige
       Bedienfläche, deshalb dort größer. */
    @media (hover: none) {
      .trigger {
        width: 22px;
        height: 22px;
        font-size: var(--text-xs);
      }
    }

    /* ── Blaseninhalt ───────────────────────────────────────── */

    /* Geschlitzter Inhalt erbt vererbbare Eigenschaften von seinem Platz im
       LICHT-DOM, nicht vom Schlitz, in den er gereicht wird. Die Blase hängt an
       Überschriften und Etiketten, die Versalien, Sperrung und die
       Schreibmaschinenschrift setzen — ohne diese
       Zurücksetzung erscheint der ganze Fließtext gesperrt und in Versalien.
       Erst im Bild gesehen, nicht im Kopf. */
    .mx__row {
      margin: 0 0 var(--space-2);
      font-family: var(--font-body);
      font-weight: var(--font-normal);
      text-transform: none;
      letter-spacing: normal;
      text-align: left;
    }

    .mx__row:last-child {
      margin-bottom: 0;
    }

    .mx__row--do {
      margin-top: var(--space-2);
      padding-top: var(--space-2);
      border-top: var(--border-width-thin) dashed var(--color-border);
    }

    .mx__key {
      display: block;
      margin-bottom: var(--space-0-5);
      color: var(--_key);
      font-family: var(--font-brutalist);
      font-size: 9px;
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
    }

    .mx__row--do .mx__key {
      color: var(--_key-do);
    }

    .mx__val {
      display: block;
      color: var(--color-text-primary);
    }

    @media (prefers-reduced-motion: reduce) {
      .trigger 
        transition-duration: 0.01ms;
    }
  `;

  /** Name der Kennzahl. Nur für die Vorlesehilfe des Auslösers. */
  @property() metric = '';

  /** Was ist das? */
  @property() what = '';

  /** Warum steht die Zahl so? Die Regel, nicht der heutige Wert. */
  @property() why = '';

  /** Was kann ich tun? */
  @property() action = '';

  protected render() {
    // Eine Erklärung ohne alle drei Teile ist der Zustand, den dieses Bauteil
    // abschafft. Sie wird trotzdem gezeigt, statt still zu verschwinden — das
    // CI-Tor ist der Ort, an dem sie auffällt, nicht die laufende Oberfläche.
    if (!this.what && !this.why && !this.action) return nothing;

    return html`
      <velg-tooltip position="below" variant="explainer">
        <span
          class="trigger"
          tabindex="0"
          role="note"
          aria-label=${this.metric ? msg('Explanation for this metric') : msg('Explanation')}
          >?</span
        >
        <div slot="tip">
          ${
            this.what
              ? html`<p class="mx__row">
                  <span class="mx__key">${msg('What')}</span>
                  <span class="mx__val">${this.what}</span>
                </p>`
              : nothing
          }
          ${
            this.why
              ? html`<p class="mx__row">
                  <span class="mx__key">${msg('Why')}</span>
                  <span class="mx__val">${this.why}</span>
                </p>`
              : nothing
          }
          ${
            this.action
              ? html`<p class="mx__row mx__row--do">
                  <span class="mx__key">${msg('What to do')}</span>
                  <span class="mx__val">${this.action}</span>
                </p>`
              : nothing
          }
        </div>
      </velg-tooltip>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-metric-explainer': VelgMetricExplainer;
  }
}
