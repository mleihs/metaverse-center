/**
 * BLATT 03 — Legende der sechs Systeme.
 *
 * Sechs Zellen in einem durchgehenden Gitter, rechts eine Tafel, die zeigt,
 * was in der gewaehlten Zelle steht. Die Daten sind dieselben wie in der
 * redaktionellen Fassung (`landing-systems-data.ts`) — nur der Bau ist anders:
 * dort eine Liste mit Vorschau, hier ein Kartenblatt mit Legende.
 *
 * DAS GITTER WIRD EINMAL GEZEICHNET, NICHT ZWOELFMAL
 *   Jede Zelle traegt `border-right` und `border-bottom`, der Behaelter
 *   `border-top` und `border-left`. Zwoelf Zellen mit vollem Rahmen ergaeben
 *   doppelte Linien an jeder inneren Kante — auf Papier sieht man das sofort,
 *   weil eine 2-px-Linie neben einer 1-px-Linie steht.
 *
 * DIE AUSWAHL IST EIN TINT PLUS EINE KANTE UNTEN
 *   Ausdruecklich kein farbiger Streifen an der linken Kante: das ist in diesem
 *   Projekt verboten und wird von `lint-no-accent-edge-bar.sh` in beiden
 *   Bauarten zurueckgewiesen. Das Design-Paket nennt dieselbe Regel unter
 *   seinen eigenen Tabus. Beides steht als `.atlas-cell` im gemeinsamen
 *   Vokabular.
 *
 * TASTATUR UND FINGER
 *   Die Zellen sind eine echte `tablist`: Pfeiltasten wechseln, Pos1 und Ende
 *   springen, der Fokusring ist der der Plattform. Auf einem Geraet ohne
 *   Zeiger waehlt ein Tipp aus statt zu navigieren — ein zweiter Tipp auf die
 *   bereits gewaehlte Zelle geht dann ins System. So verlangt es die
 *   Responsive-Vorgabe, und der Grund ist handfest: mit `mouseenter` allein
 *   koennte man auf einem Telefon nie etwas anderes sehen als Zelle 1.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { LandingCounts } from '../../../types/index.js';
import { navigate } from '../../../utils/navigation.js';
import {
  atlasGridStyles,
  atlasHoverStyles,
  atlasSelectionStyles,
  atlasSheetHeadStyles,
} from '../../shared/atlas-sheet-styles.js';
import { stageStyles } from '../../shared/stage-styles.js';
import { LANDING_IMAGE_SIZES, landingFallbackUrl, landingSrcset } from '../landing-images.js';
import { SYSTEMS, type SystemEntry } from '../landing-systems-data.js';

@localized()
@customElement('velg-atlas-systems')
export class VelgAtlasSystems extends LitElement {
  static styles = [
    stageStyles,
    atlasSheetHeadStyles,
    atlasSelectionStyles,
    atlasHoverStyles,
    atlasGridStyles,
    css`
      :host {
        display: block;
        position: relative;
        background: var(--color-surface-raised);
        border-bottom: var(--border-width-thin) solid var(--color-border);
      }

      .sheet {
        position: relative;
        z-index: 1;
        container-type: inline-size;
        padding-block: var(--space-16);
      }

      .cols {
        display: grid;
        grid-template-columns: 7fr 5fr;
        gap: var(--space-10);
        align-items: start;
      }

      h2 {
        margin: 0 0 var(--space-8);
        font-family: var(--heading-font);
        font-weight: var(--heading-weight);
        font-size: calc(var(--text-2xl) * var(--stage-type-scale));
        line-height: var(--leading-tight);
        letter-spacing: var(--heading-tracking);
        text-transform: var(--heading-transform);
        color: var(--color-text-primary);
      }

      /* Zwei Spalten, drei Zeilen. Die Aussenlinien am Behaelter, die
         Innenlinien an den Zellen — siehe Kopfkommentar. */
      .cells {
        display: grid;
        grid-template-columns: 1fr 1fr;
        border-top: var(--border-width-thin) solid var(--color-border);
        border-left: var(--border-width-thin) solid var(--color-border);
      }

      .cell {
        display: block;
        width: 100%;
        text-align: left;
        padding: var(--space-6);
        border: none;
        border-right: var(--border-width-thin) solid var(--color-border);
        border-bottom: var(--border-width-thin) solid var(--color-border);
        cursor: pointer;
        color: inherit;
      }

      .cell__no {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        letter-spacing: var(--label-tracking);
        color: var(--color-text-muted);
      }

      .cell__title {
        display: block;
        margin: var(--space-2) 0 var(--space-2);
        font-family: var(--heading-font);
        font-weight: var(--heading-weight);
        font-size: var(--text-lg);
        line-height: var(--leading-tight);
        letter-spacing: var(--heading-tracking);
        text-transform: var(--heading-transform);
        color: var(--color-text-primary);
      }

      .cell__teaser {
        display: block;
        font-family: var(--font-body);
        font-size: var(--text-sm);
        line-height: var(--leading-snug);
        color: var(--color-text-secondary);
      }

      .cell__flag {
        display: inline-block;
        margin-top: var(--space-3);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        text-transform: var(--label-transform);
        letter-spacing: var(--label-tracking);
        color: var(--color-warning);
      }

      /* ---- Die Tafel ---- */

      .panel {
        position: sticky;
        top: var(--space-8);
      }

      .panel__frame {
        position: relative;
        aspect-ratio: 4 / 3;
        overflow: hidden;
        border: var(--border-width-thin) solid var(--color-border);
        box-shadow: var(--shadow-md);
      }

      .panel__frame img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .panel__fig {
        position: absolute;
        left: var(--space-3);
        bottom: var(--space-3);
        padding: var(--space-1) var(--space-2);
        background: var(--color-surface);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        text-transform: var(--label-transform);
        letter-spacing: var(--label-tracking);
        color: var(--color-text-primary);
      }

      .lore {
        margin: var(--space-5) 0 0;
        font-family: var(--font-prose);
        font-size: var(--text-base);
        line-height: var(--leading-relaxed);
        color: var(--color-text-secondary);
      }

      .quote {
        margin: var(--space-5) 0 0;
        padding-top: var(--space-4);
        border-top: var(--border-width-thin) solid var(--color-border-light);
        font-family: var(--font-prose);
        font-style: italic;
        font-size: var(--text-sm);
        line-height: var(--leading-relaxed);
        color: var(--color-text-secondary);
      }

      .by {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--space-4);
        margin-top: var(--space-3);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        text-transform: var(--label-transform);
        letter-spacing: var(--label-tracking);
        color: var(--color-text-muted);
      }

      .enter {
        background: none;
        border: 0;
        padding: 0;
        min-height: 44px;
        cursor: pointer;
        font: inherit;
        color: var(--color-text-muted);
      }

      .enter:focus-visible {
        outline: none;
        box-shadow: var(--ring-focus);
      }

      /* ---- Haltepunkte ---- */

      /* Ab hier steht die Tafel UNTER der Liste und klebt nicht mehr: eine
         klebende Tafel in einer einspaltigen Seite wandert an den Zellen
         vorbei, zu denen sie gehoert. */
      @container (max-width: 1023px) {
        .cols {
          grid-template-columns: 1fr;
        }

        .panel {
          position: static;
        }
      }

      @container (max-width: 767px) {
        .cells {
          grid-template-columns: 1fr;
        }

        .sheet {
          padding-block: var(--space-10);
        }

        /* Auf einem Telefon ist die Lore vier Zeilen lang oder gar nicht da. */
        .lore {
          display: -webkit-box;
          -webkit-line-clamp: 4;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      }
    `,
  ];

  @property({ type: Object, attribute: false }) counts: LandingCounts | null = null;

  @state() private _active = 0;

  private _select(index: number): void {
    this._active = ((index % SYSTEMS.length) + SYSTEMS.length) % SYSTEMS.length;
  }

  /**
   * Pfeiltasten wechseln, Pos1 und Ende springen an die Enden.
   *
   * Der Fokus bleibt auf der Zelle, die die Taste bekommen hat — die Auswahl
   * folgt der Taste, nicht der Fokus der Auswahl. Sonst risse jede Pfeiltaste
   * den Fokus aus der Liste heraus und legte ihn in die Tafel.
   */
  private _onKey(event: KeyboardEvent): void {
    const step: Record<string, number> = {
      ArrowRight: 1,
      ArrowDown: 1,
      ArrowLeft: -1,
      ArrowUp: -1,
    };
    if (event.key in step) {
      event.preventDefault();
      this._select(this._active + step[event.key]);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      this._select(0);
    }
    if (event.key === 'End') {
      event.preventDefault();
      this._select(SYSTEMS.length - 1);
    }
  }

  /**
   * Ein Tipp auf eine nicht gewaehlte Zelle waehlt sie; ein Tipp auf die
   * gewaehlte geht ins System. Auf einem Zeigergeraet waehlt schon das
   * Ueberfahren, also ist der erste Klick dort immer der zweite Fall.
   */
  private _activate(index: number, entry: SystemEntry): void {
    if (index === this._active) {
      navigate(entry.route);
      return;
    }
    this._select(index);
  }

  private _renderCell(entry: SystemEntry, index: number) {
    const selected = index === this._active;
    const marked = entry.underConstruction(this.counts);

    return html`
      <button
        class="cell atlas-cell"
        role="tab"
        aria-selected=${selected}
        tabindex=${selected ? 0 : -1}
        @mouseenter=${() => this._select(index)}
        @focus=${() => this._select(index)}
        @click=${() => this._activate(index, entry)}
      >
        <span class="cell__no">${entry.tag()}</span>
        <span class="cell__title">${entry.title()}</span>
        <span class="cell__teaser">${entry.teaser()}</span>
        ${marked ? html`<span class="cell__flag">${msg('Building up')}</span>` : ''}
      </button>
    `;
  }

  protected render() {
    const entry = SYSTEMS[this._active];

    return html`
      <div class="sheet-grid" aria-hidden="true"></div>
      <div class="sheet stage-container">
        <div class="sheet-head">
          <span class="sheet-head__no">${msg('Sheet 03')}</span>
          <span>${msg('Legend of the six systems')}</span>
          <span class="sheet-head__rule"></span>
        </div>
        <h2>${msg('how a world is played')}</h2>

        <div class="cols">
          <div class="cells" role="tablist" aria-label=${msg('The six systems')} @keydown=${this._onKey}>
            ${SYSTEMS.map((system, index) => this._renderCell(system, index))}
          </div>

          <div class="panel" role="tabpanel">
            <div class="panel__frame atlas-zoom">
              <img
                src=${landingFallbackUrl(entry.stem, 'panel')}
                srcset=${landingSrcset(entry.stem, 'panel', 'webp')}
                sizes=${LANDING_IMAGE_SIZES.panel}
                alt=""
                loading="lazy"
                decoding="async"
              />
              <span class="panel__fig">${entry.tag()}</span>
            </div>

            <p class="lore">${entry.lore()}</p>

            <blockquote class="quote">${entry.quote()}</blockquote>
            <div class="by">
              <span>${entry.attribution()}</span>
              <button class="enter atlas-arrow" @click=${() => navigate(entry.route)}>
                ${msg('Enter the system')} <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-atlas-systems': VelgAtlasSystems;
  }
}
