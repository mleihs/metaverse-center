/**
 * Die sechs Systeme - Verzeichnis links, Vorschautafel rechts.
 *
 * DER ENTWURF KANNTE NUR `hover`
 * In der Vorlage schaltet allein `onMouseEnter` die Tafel um. Wer mit der
 * Tastatur navigiert, erreicht damit **ein Sechstel des Seiteninhalts nicht** -
 * die Beschreibung, das Zitat und der Verweis jedes Systems bleiben
 * unerreichbar. Hier ist die Liste deshalb ein echtes `tablist`: Pfeiltasten,
 * Pos1/Ende, `aria-selected`, sichtbarer Fokus. Der Zeiger schaltet weiterhin
 * beim Ueberfahren um, weil das die Bedienung ist, die der Entwurf meint - er
 * ist nur nicht mehr die einzige.
 *
 * ZWEI SYSTEME TRAGEN EINE MARKE
 * Entscheidung des Nutzers vom 31.08.2026: alle sechs werden gezeigt, aber
 * Epochen und Substrat sind gekennzeichnet. Gemessen: 0 laufende Epochen
 * (sieben existieren, alle seit 164 bis 185 Tagen unbewegt, sechs davon heissen
 * "Academy Training" oder "bob") und 1 aufgenommene Resonanz. Die Marke ist
 * keine Entschuldigung, sondern eine Angabe - und sie verschwindet von selbst,
 * sobald die Zahlen es hergeben, weil sie aus dem Schnappschuss kommt und nicht
 * aus einer Konstante.
 *
 * KEIN `filter` UND KEIN `transform` AUF DEM ABSCHNITT
 * Beides erzeugt einen neuen Bezugsrahmen und bricht jedes `position: fixed`
 * dieser Seite. Die Aufhellung der aktiven Miniatur und die Verschiebung des
 * aktiven Titels sitzen deshalb auf Blattelementen, nie auf dem Raster.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { LandingCounts } from '../../types/index.js';
import { navigate } from '../../utils/navigation.js';
import { stageStyles } from '../shared/stage-styles.js';
import { LANDING_IMAGE_SIZES, landingFallbackUrl, landingSrcset } from './landing-images.js';
import { SYSTEMS, type SystemEntry } from './landing-systems-data.js';

@localized()
@customElement('velg-landing-systems')
export class VelgLandingSystems extends LitElement {
  static styles = [
    stageStyles,
    css`
    :host {
      /* Tier 3 - alles abgeleitet, kein eigener Farbwert. */
      --_rule: var(--color-border-light);
      --_row-hover: color-mix(in srgb, var(--color-text-primary) 4%, var(--color-surface));
      --_panel-ground: var(--color-surface-sunken);
      --_veil: color-mix(in srgb, var(--color-surface-sunken) 94%, transparent);

      display: block;
      /* Nur senkrecht. Die seitliche Polsterung sitzt am Raster, nicht hier:
         sie gehoert INNERHALB des Seitenmasses. Laege sie an der Huelle, kaeme
         sie zum zentrierten Behaelter hinzu statt hinein, und der sichtbare
         Rand bei 2560 px waere 320 statt der vorgeschriebenen 384 px. */
      padding-block: var(--space-24);
    }

    .layout {
      /* Die Polsterung gehoert INNERHALB des Masses: ohne border-box zaehlt
         "max-width" nur den Inhalt, der Kasten waere 1920 + 2 x 64 = 2048 px
         breit und der sichtbare Rand bei 2560 px 320 statt 384. Gemessen im
         Browser, nicht geschlossen — tsc und alle 23 Tore waren gruen. */
      display: grid;
      grid-template-columns: 1fr 640px;
      gap: var(--space-14);
      align-items: stretch;
    }

    .kicker {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      letter-spacing: var(--tracking-widest);
      text-transform: var(--label-transform);
      color: var(--color-accent-amber);
      margin-bottom: var(--space-7);
    }

    .kicker::before {
      content: '';
      width: 24px;
      height: 1px;
      background: var(--color-accent-amber);
    }

    /* ── Verzeichnis ───────────────────────────────────────────────── */

    .index {
      display: block;
    }

    .row {
      display: grid;
      grid-template-columns: 72px 1fr auto;
      gap: var(--space-7);
      align-items: baseline;
      width: 100%;
      padding: var(--space-6) var(--space-2-5);
      border: 0;
      border-top: var(--border-width-thin) solid var(--_rule);
      background: transparent;
      color: inherit;
      text-align: left;
      cursor: pointer;
      font: inherit;
      transition: background var(--transition-normal);
    }

    .row:last-of-type {
      border-bottom: var(--border-width-thin) solid var(--_rule);
    }

    .row:hover,
    .row[aria-selected='true'] {
      background: var(--_row-hover);
    }

    .row:focus-visible {
      outline: var(--border-width-default) solid var(--color-accent-amber);
      outline-offset: -2px;
    }

    .row__num {
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      color: var(--color-text-quiet);
    }

    .row__title {
      display: flex;
      align-items: baseline;
      gap: var(--space-3);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: calc(clamp(var(--text-lg), 2.4vw, var(--text-2xl)) * var(--stage-type-scale, 1));
      letter-spacing: var(--tracking-brutalist);
      text-transform: var(--heading-transform);
      color: var(--color-text-primary);
      margin: 0;
      transition: color var(--transition-normal);
    }

    .row:hover .row__title,
    .row[aria-selected='true'] .row__title {
      color: var(--color-accent-amber);
    }

    /* Die Verschiebung sitzt auf dem Pfeil, nicht auf der Zeile: ein
       "transform" auf dem Rasterkind waere ein neuer Bezugsrahmen. */
    .row__arrow {
      opacity: 0;
      transform: translateX(-8px);
      transition: opacity var(--transition-normal), transform var(--transition-normal);
      color: var(--color-accent-amber);
    }

    .row:hover .row__arrow,
    .row[aria-selected='true'] .row__arrow {
      opacity: 1;
      transform: translateX(0);
    }

    .row__teaser {
      font-family: var(--font-prose);
      font-size: var(--text-sm);
      line-height: var(--leading-relaxed);
      color: var(--color-text-quiet);
      margin: var(--space-2) 0 0;
      max-width: 62ch;
    }

    .row__meta {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: var(--space-1-5);
    }

    .row__code {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      letter-spacing: var(--tracking-wider);
      color: var(--color-text-quiet);
      white-space: nowrap;
    }

    /* Die Marke steht in gedaempftem Bernstein: sichtbar, aber nicht als
       Warnung. Es ist eine Angabe, keine Stoerung. */
    .row__building {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      letter-spacing: var(--tracking-wide);
      text-transform: var(--label-transform);
      color: color-mix(in srgb, var(--color-accent-amber) 70%, var(--color-text-muted));
      white-space: nowrap;
    }

    /* ── Vorschauspalte ────────────────────────────────────────────── */

    .preview {
      display: flex;
      flex-direction: column;
      padding-top: var(--space-14);
      min-width: 0;
    }

    .panel {
      position: relative;
      aspect-ratio: 16 / 9;
      flex: 0 0 auto;
      border: var(--border-width-thin) solid var(--color-border);
      box-shadow: var(--shadow-lg);
      overflow: hidden;
      background: var(--_panel-ground);
    }

    .panel__img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      animation: panel-in var(--duration-slower) var(--ease-dramatic) both;
    }

    @keyframes panel-in {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    .panel__veil {
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, transparent 55%, var(--_veil));
      pointer-events: none;
    }

    .panel__foot {
      position: absolute;
      left: var(--space-6);
      right: var(--space-6);
      bottom: var(--space-5);
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: var(--space-6);
    }

    .panel__tag {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      letter-spacing: var(--tracking-widest);
      text-transform: var(--label-transform);
      color: var(--color-accent-amber);
      margin-bottom: var(--space-2);
    }

    .panel__name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xl);
      letter-spacing: var(--tracking-brutalist);
      text-transform: var(--heading-transform);
      color: var(--color-text-primary);
    }

    .panel__counter {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      letter-spacing: var(--tracking-wider);
      color: var(--color-text-quiet);
      flex: 0 0 auto;
    }

    .strip {
      display: flex;
      gap: var(--space-2-5);
      margin-top: var(--space-4);
    }

    .strip__btn {
      flex: 1;
      aspect-ratio: 16 / 9;
      padding: 0;
      border: var(--border-width-thin) solid var(--color-border-light);
      background: var(--_panel-ground);
      cursor: pointer;
      overflow: hidden;
      transition: border-color var(--transition-slow);
    }

    .strip__btn[aria-selected='true'] {
      border-color: var(--color-accent-amber);
    }

    .strip__btn:focus-visible {
      outline: var(--border-width-default) solid var(--color-accent-amber);
      outline-offset: 2px;
    }

    /* Die Abdunklung liegt auf dem Bild, nicht auf dem Knopf. */
    .strip__img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      filter: brightness(0.4) saturate(0.5);
      transition: filter var(--transition-slow);
    }

    .strip__btn[aria-selected='true'] .strip__img,
    .strip__btn:hover .strip__img {
      filter: none;
    }

    .lore {
      margin-top: var(--space-6);
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: var(--space-5);
      border: var(--border-width-thin) solid var(--_rule);
      background: var(--_panel-ground);
      padding: var(--space-7) var(--space-8);
    }

    .lore__text {
      font-family: var(--font-prose);
      font-size: var(--text-base);
      line-height: var(--leading-loose);
      color: var(--color-text-secondary);
      margin: 0;
    }

    /* Trennlinie oben, kein Balken an der Seite. */
    .lore__quote {
      border-top: var(--border-width-thin) solid var(--_rule);
      padding-top: var(--space-5);
    }

    .lore__quote p {
      font-family: var(--font-prose);
      font-style: italic;
      font-size: var(--text-sm);
      line-height: var(--leading-relaxed);
      color: var(--color-text-primary);
      margin: 0 0 var(--space-2-5);
    }

    .lore__by {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: var(--space-5);
      min-height: 30px;
    }

    .lore__who {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      letter-spacing: var(--tracking-wider);
      text-transform: var(--label-transform);
      line-height: var(--leading-relaxed);
      color: var(--color-text-quiet);
      margin: 0;
    }

    /* "nowrap" und "flex: 0 0 auto", damit der Verweis nicht springt, wenn
       die Zuschreibung daneben auf zwei Zeilen umbricht. */
    .lore__enter {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      letter-spacing: var(--tracking-widest);
      text-transform: var(--label-transform);
      white-space: nowrap;
      flex: 0 0 auto;
      color: var(--color-text-quiet);
      background: none;
      border: 0;
      padding: 0;
      cursor: pointer;
      transition: color var(--transition-normal);
    }

    .lore__enter:hover,
    .lore__enter:focus-visible {
      color: var(--color-accent-amber);
    }

    .lore__enter:focus-visible {
      outline: var(--border-width-thin) solid var(--color-accent-amber);
      outline-offset: 3px;
    }

    /* ── BREITBILD (Entwurf v2, ≥1920) ──────────────────────────────────
       Die Vorschauspalte waechst 640 → 760 px und bleibt 16:9; die Zeilen
       atmen (24 → 32 px), und der Loretext geht auf 18 px. Die Liste selbst
       bleibt eine Liste — sie bekommt keine zweite Spalte, weil sechs
       nummerierte Zeilen in zwei Spalten ihre Reihenfolge verlieren. */
    @media (min-width: 1920px) {
      .layout {
        grid-template-columns: 1fr 760px;
      }

      .row {
        padding-block: var(--space-8);
      }

      .lore__text {
        font-size: var(--text-md);
      }
    }

    @media (max-width: 1024px) {
      :host {
        padding: var(--space-16) var(--space-5);
      }

      .layout {
        grid-template-columns: 1fr;
        gap: var(--space-10);
      }

      .preview {
        padding-top: 0;
      }

      .row {
        grid-template-columns: 48px 1fr;
        gap: var(--space-4);
      }

      .row__meta {
        grid-column: 2;
        align-items: flex-start;
        flex-direction: row;
        gap: var(--space-3);
        margin-top: var(--space-2);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .panel__img {
        animation: none;
      }

      .row__arrow {
        transition: none;
      }
    }
  `,
  ];

  /** Die Zahlen aus dem Schnappschuss - sie entscheiden ueber die Marken. */
  @property({ type: Object, attribute: false }) counts: LandingCounts | null = null;

  @state() private _active = 0;

  private _select(index: number): void {
    this._active = ((index % SYSTEMS.length) + SYSTEMS.length) % SYSTEMS.length;
  }

  /**
   * Tastaturbedienung nach dem Muster fuer `tablist` mit manueller Aktivierung.
   *
   * Pfeiltasten bewegen UND schalten um (automatische Aktivierung), weil die
   * Tafel die einzige Anzeige ist - eine Auswahl, die man erst mit der
   * Eingabetaste bestaetigen muss, waere hier eine Bedienung mehr ohne Gewinn.
   */
  private _onKey(event: KeyboardEvent): void {
    const keys: Record<string, number> = {
      ArrowDown: this._active + 1,
      ArrowRight: this._active + 1,
      ArrowUp: this._active - 1,
      ArrowLeft: this._active - 1,
      Home: 0,
      End: SYSTEMS.length - 1,
    };
    const next = keys[event.key];
    if (next === undefined) return;
    event.preventDefault();
    this._select(next);
    this.updateComplete.then(() => {
      const rows = this.renderRoot.querySelectorAll<HTMLElement>('.row');
      rows[this._active]?.focus();
    });
  }

  private _enter(route: string): void {
    navigate(route);
  }

  private _renderRow(entry: SystemEntry, index: number) {
    const selected = index === this._active;
    const building = entry.underConstruction(this.counts);
    return html`
      <button
        class="row"
        role="tab"
        id="sys-tab-${index}"
        aria-selected=${selected}
        aria-controls="sys-panel"
        tabindex=${selected ? 0 : -1}
        @mouseenter=${() => this._select(index)}
        @focus=${() => this._select(index)}
        @click=${() => this._enter(entry.route)}
      >
        <span class="row__num">${String(index + 1).padStart(2, '0')}</span>
        <span>
          <span class="row__title">
            ${entry.title()}
            <span class="row__arrow" aria-hidden="true">&rarr;</span>
          </span>
          <span class="row__teaser">${entry.teaser()}</span>
        </span>
        <span class="row__meta">
          <span class="row__code">${entry.tag()}</span>
          ${building ? html`<span class="row__building">${msg('Building up')}</span>` : null}
        </span>
      </button>
    `;
  }

  private _renderPanel(entry: SystemEntry) {
    return html`
      <div class="panel">
        <picture>
          <source
            type="image/avif"
            srcset=${landingSrcset(entry.stem, 'panel', 'avif')}
            sizes=${LANDING_IMAGE_SIZES.panel}
          />
          <source
            type="image/webp"
            srcset=${landingSrcset(entry.stem, 'panel', 'webp')}
            sizes=${LANDING_IMAGE_SIZES.panel}
          />
          <img
            class="panel__img"
            src=${landingFallbackUrl(entry.stem, 'panel')}
            alt=""
            loading="lazy"
            decoding="async"
          />
        </picture>
        <div class="panel__veil"></div>
        <div class="panel__foot">
          <div>
            <div class="panel__tag">${entry.tag()}</div>
            <div class="panel__name">${entry.title()}</div>
          </div>
          <div class="panel__counter">
            ${String(this._active + 1).padStart(2, '0')} / ${String(SYSTEMS.length).padStart(2, '0')}
          </div>
        </div>
      </div>
    `;
  }

  protected render() {
    const entry = SYSTEMS[this._active];
    return html`
      <div class="layout stage-container">
        <div class="index">
          <div class="kicker">${msg('The six systems')}</div>
          <div role="tablist" aria-label=${msg('The six systems')} @keydown=${this._onKey}>
            ${SYSTEMS.map((system, index) => this._renderRow(system, index))}
          </div>
        </div>

        <div class="preview">
          ${this._renderPanel(entry)}

          <div class="strip">
            ${SYSTEMS.map(
              (system, index) => html`
                <button
                  class="strip__btn"
                  role="tab"
                  aria-selected=${index === this._active}
                  aria-label=${system.title()}
                  tabindex="-1"
                  @mouseenter=${() => this._select(index)}
                  @click=${() => this._select(index)}
                >
                  <img
                    class="strip__img"
                    src=${landingFallbackUrl(system.stem, 'thumb')}
                    srcset=${landingSrcset(system.stem, 'thumb', 'webp')}
                    sizes=${LANDING_IMAGE_SIZES.thumb}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                </button>
              `,
            )}
          </div>

          <div class="lore" id="sys-panel" role="tabpanel" aria-labelledby="sys-tab-${this._active}">
            <p class="lore__text">${entry.lore()}</p>
            <div class="lore__quote">
              <p>&ldquo;${entry.quote()}&rdquo;</p>
              <div class="lore__by">
                <p class="lore__who">&ndash; ${entry.attribution()}</p>
                <button class="lore__enter" @click=${() => this._enter(entry.route)}>
                  ${msg('Enter the system')} &rarr;
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-landing-systems': VelgLandingSystems;
  }
}
