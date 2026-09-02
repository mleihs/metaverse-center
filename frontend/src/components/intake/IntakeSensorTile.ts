/**
 * Eine Sensor-Kachel der Schleuse.
 *
 * Zeigt eine Quelle: ob sie horcht, welcher Klasse sie angehört, wie viel sie
 * im letzten Zyklus geliefert hat und wann sie zuletzt gesprochen hat.
 *
 * WARUM DIE KLASSE EINE FARBE BEKOMMT: die zehn Adapter sind nicht
 * gleichwertig. Ein Erdbeben von der USGS kommt als Messwert und braucht kein
 * Modell; eine Zeitungsmeldung muss erst klassifiziert werden, und das kostet
 * einen Aufruf pro Zyklus. Wer die Leiste ansieht, soll auf einen Blick
 * erkennen, was ihn etwas kostet und was gratis ist — deshalb die Farbe am
 * Klassenwort, nicht am Namen.
 *
 * Die Farbe steht NICHT auf einer Kante: ein Farbbalken an der Seite ist im
 * Haus verboten (`lint-no-accent-edge-bar.sh`). Sie sitzt am Klassenwort und
 * am Statuspunkt, wo sie etwas aussagt.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { IntakeSourceKind } from '../../types/intake.js';

/** Wie viele Segmente der Trefferbalken hat. */
const HIT_SEGMENTS = 4;

@localized()
@customElement('velg-intake-sensor-tile')
export class VelgIntakeSensorTile extends LitElement {
  static styles = css`
    :host {
      display: block;
      /* Tier 3: die Klassenfarbe kommt als Attribut herein und wird hier
         einmal aufgelöst, damit Punkt, Wort und Balken garantiert dieselbe
         Farbe tragen. */
      --_class-color: var(--color-text-secondary);
      --_dim: color-mix(in srgb, var(--_class-color) 45%, transparent);
    }

    :host([kind='structured']) {
      --_class-color: var(--color-accent-green);
    }
    :host([kind='semi']) {
      --_class-color: var(--color-epoch-influence);
    }
    :host([kind='llm']) {
      --_class-color: var(--color-accent-amber);
    }
    :host([kind='internal']) {
      --_class-color: var(--color-info);
    }
    :host([kind='social']) {
      --_class-color: var(--color-text-secondary);
    }
    :host([kind='nokey']) {
      --_class-color: var(--color-danger);
    }

    .tile {
      display: flex;
      flex-direction: column;
      gap: var(--space-1-5);
      padding: var(--space-2) var(--space-2-5);
      border: var(--border-width-thin) solid var(--color-border-light);
      background: var(--color-surface-raised);
      min-height: 64px;
      transition: border-color var(--transition-fast);
    }

    /* Eine schaltbare Kachel sagt das auch. Für den Architekten ist sie ein
       Schild, für den Admin ein Schalter — der Unterschied gehört sichtbar
       gemacht, nicht nur ins Verhalten. */
    :host([interactive]) .tile {
      cursor: pointer;
    }
    :host([interactive]) .tile:hover,
    :host([interactive]) .tile:focus-visible {
      border-color: var(--_class-color);
    }
    .tile:focus-visible {
      outline: none;
      box-shadow: var(--ring-focus);
    }

    /* Eine abgeschaltete Quelle ist nicht kaputt, nur still. Sie wird
       zurückgenommen, nicht rot markiert — rot gehört dem fehlenden
       Schlüssel, und zwei Bedeutungen auf einer Farbe wären eine zu viel. */
    :host([off]) .tile {
      opacity: 0.45;
      border-style: dashed;
    }

    .head {
      display: flex;
      align-items: center;
      gap: var(--space-1-5);
      min-width: 0;
    }

    .dot {
      inline-size: 6px;
      block-size: 6px;
      flex: none;
      background: var(--_class-color);
    }
    :host([off]) .dot {
      background: var(--color-text-tertiary);
    }

    .name {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
      color: var(--color-text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .class {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      letter-spacing: var(--tracking-wider);
      text-transform: uppercase;
      color: var(--_class-color);
    }

    .bar {
      display: flex;
      align-items: center;
      gap: var(--space-1);
    }

    .segs {
      display: flex;
      gap: 2px;
      flex: 1;
    }

    .seg {
      block-size: 4px;
      flex: 1;
      background: var(--color-border-light);
    }
    .seg--on {
      background: var(--_class-color);
    }

    .count {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      font-variant-numeric: tabular-nums;
    }

    .when {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-tertiary);
    }

    @media (prefers-reduced-motion: reduce) {
      .tile {
        transition-duration: 0.01ms;
      }
    }
  `;

  /** Anzeigename der Quelle. */
  @property({ type: String }) name = '';

  /** Klasse der Quelle. Spiegelt als Attribut, damit CSS sie greifen kann. */
  @property({ type: String, reflect: true }) kind: IntakeSourceKind = 'llm';

  /** Horcht die Quelle? Ein abgeschalteter Adapter ist still, nicht kaputt. */
  @property({ type: Boolean, reflect: true }) off = false;

  /** Nur der Admin darf schalten; beim Architekten bleibt die Kachel ein Schild. */
  @property({ type: Boolean, reflect: true }) interactive = false;

  /** Treffer im letzten Zyklus. */
  @property({ type: Number }) hits = 0;

  /** Wie lange her, in Minuten. `null` heisst: noch nie gehört. */
  @property({ type: Number }) minutesAgo: number | null = null;

  private _classLabel(): string {
    switch (this.kind) {
      case 'structured':
        return msg('structured');
      case 'semi':
        return msg('semi');
      case 'internal':
        return msg('internal');
      case 'social':
        return msg('social');
      case 'nokey':
        return msg('no key');
      default:
        return msg('model');
    }
  }

  /**
   * Wie voll der Balken steht.
   *
   * Vier Segmente über einer offenen Zahl: die Skala ist logarithmisch gedacht
   * (1, 5, 20, 50), weil ein Erdbebendienst zwei Treffer liefert und GDELT
   * vierhundert. Linear wäre die Leiste entweder immer leer oder immer voll.
   */
  private _filled(): number {
    const h = this.hits;
    if (h <= 0) return 0;
    if (h < 5) return 1;
    if (h < 20) return 2;
    if (h < 50) return 3;
    return HIT_SEGMENTS;
  }

  private _whenLabel(): string {
    if (this.minutesAgo === null) return msg('never');
    if (this.minutesAgo < 1) return msg('just now');
    if (this.minutesAgo < 60) return msg(str`${this.minutesAgo} min ago`);
    return msg(str`${Math.floor(this.minutesAgo / 60)} h ago`);
  }

  private _onActivate(): void {
    if (!this.interactive) return;
    this.dispatchEvent(
      new CustomEvent('sensor-toggle', {
        bubbles: true,
        composed: true,
        detail: { name: this.name, enabled: this.off },
      }),
    );
  }

  private _onKey(e: KeyboardEvent): void {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    this._onActivate();
  }

  protected render() {
    const filled = this._filled();
    const label = this.off
      ? msg(str`${this.name}, off`)
      : msg(str`${this.name}, ${this._classLabel()}, ${this.hits} hits`);

    return html`
      <div
        class="tile"
        role=${this.interactive ? 'button' : 'listitem'}
        tabindex=${this.interactive ? '0' : '-1'}
        aria-label=${label}
        aria-pressed=${this.interactive ? String(!this.off) : nothing}
        @click=${this._onActivate}
        @keydown=${this._onKey}
      >
        <div class="head">
          <span class="dot" aria-hidden="true"></span>
          <span class="name">${this.name}</span>
        </div>
        <span class="class">${this._classLabel()}</span>
        <div class="bar">
          <span class="segs" aria-hidden="true">
            ${Array.from(
              { length: HIT_SEGMENTS },
              (_, i) => html`<span class="seg ${i < filled ? 'seg--on' : ''}"></span>`,
            )}
          </span>
          <span class="count">${this.hits}</span>
        </div>
        <span class="when">${this._whenLabel()}</span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-intake-sensor-tile': VelgIntakeSensorTile;
  }
}
