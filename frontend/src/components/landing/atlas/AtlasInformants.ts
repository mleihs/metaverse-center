/**
 * BLATT 05 — Gewaehrsleute, aktenkundig.
 *
 * Drei Buerger als Karteikarten: Aktenzeichen, Name, Beruf, ein Satz ueber
 * sie. Links steht, was sie sind — die einzige Stelle der Frontseite, die
 * ausspricht, dass diese Figuren ein Gedaechtnis, eine Meinung und eine eigene
 * Absicht haben.
 *
 * WARUM DIE KARTEN KEINE PORTRAITS ZEIGEN
 *   Die redaktionelle Fassung faechert Portraitbilder auf. Hier steht keines.
 *   Eine Kartenmappe fuehrt Personen als EINTRAEGE, nicht als Gesichter; das
 *   Aktenzeichen und die Zone sagen mehr ueber die Welt als ein erzeugtes
 *   Portrait, und drei erzeugte Gesichter nebeneinander sehen einander
 *   unvermeidlich aehnlich.
 *
 * DIE HERVORHEBUNG IST GEERBT, NICHT ERFUNDEN
 *   `highlightSimulationId` kommt vom Schmiede-Blatt: tippt es dort gerade
 *   einen Ausgangssatz, gehoert dieser einer Welt, und die Buerger dieser Welt
 *   werden hier markiert. Dieselbe Eigenschaft und dieselbe Bedeutung wie in
 *   der redaktionellen Fassung — nur die Markierung sieht anders aus.
 *
 * UNTER 768 PX EIN SCHNAPPBAND
 *   Drei Karten untereinander sind drei Bildschirme; gewischt sind sie eine
 *   Geste. So verlangt es die Responsive-Vorgabe.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { LandingCitizen } from '../../../types/index.js';
import { t } from '../../../utils/locale-fields.js';
import { navigate } from '../../../utils/navigation.js';
import { professionLabel } from '../../../utils/profession.js';
import {
  atlasGridStyles,
  atlasHoverStyles,
  atlasSheetHeadStyles,
} from '../../shared/atlas-sheet-styles.js';
import { stageStyles } from '../../shared/stage-styles.js';

@localized()
@customElement('velg-atlas-informants')
export class VelgAtlasInformants extends LitElement {
  static styles = [
    stageStyles,
    atlasSheetHeadStyles,
    atlasHoverStyles,
    atlasGridStyles,
    css`
      :host {
        display: block;
        /*
         * DER CONTAINER SITZT AUF DEM WIRT, NICHT AUF .sheet.
         *
         * Eine Container-Abfrage kann nicht auf das Element passen, das den
         * Container AUFSPANNT — sie fragt immer den naechsten Vorfahren. Stand
         * container-type auf .sheet und eine @container-Regel richtete sich
         * ebenfalls an .sheet, traf sie nie.
         *
         * Gemessen am 03.09.2026: das Blatt stand bei 390 px Breite weiter
         * zweispaltig (113 px und 133 px nebeneinander), obwohl die Regel
         * ausdruecklich eine Spalte verlangte. Kein Fehler, keine Warnung — die
         * Regel war syntaktisch tadellos und ohne Wirkung. Neun Bausteine
         * trugen denselben Bau.
         */
        container-type: inline-size;
        position: relative;
        background: var(--color-surface-raised);
        border-bottom: var(--border-width-thin) solid var(--color-border);
      }

      .sheet {
        position: relative;
        z-index: 1;
        padding-block: var(--space-16);
        display: grid;
        grid-template-columns: 4fr 8fr;
        gap: var(--space-12);
        align-items: start;
      }

      h2 {
        margin: 0 0 var(--space-4);
        font-family: var(--heading-font);
        font-weight: var(--heading-weight);
        font-size: calc(var(--text-2xl) * var(--stage-type-scale));
        line-height: var(--leading-tight);
        letter-spacing: var(--heading-tracking);
        text-transform: var(--heading-transform);
        color: var(--color-text-primary);
      }

      h2 em {
        font-style: normal;
        color: var(--color-primary);
      }

      .lede {
        margin: 0 0 var(--space-6);
        max-width: 44ch;
        font-family: var(--font-body);
        font-size: var(--text-sm);
        line-height: var(--leading-relaxed);
        color: var(--color-text-secondary);
      }

      .more {
        background: none;
        border: 0;
        padding: 0;
        min-height: 44px;
        cursor: pointer;
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        text-transform: var(--label-transform);
        letter-spacing: var(--label-tracking);
        color: var(--color-text-muted);
      }

      .more:focus-visible {
        outline: none;
        box-shadow: var(--ring-focus);
      }

      .cards {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: var(--space-5);
      }

      .card {
        display: block;
        text-align: left;
        padding: var(--space-6);
        background: var(--color-surface);
        border: var(--border-width-thin) solid var(--color-border);
        box-shadow: var(--shadow-sm);
        cursor: pointer;
        color: inherit;
      }

      .card:focus-visible {
        outline: none;
        box-shadow: var(--ring-focus);
      }

      /* Die Welt, deren Ausgangssatz gerade getippt wird. Ein Tint plus eine
         Kante unten — nicht ein farbiger Streifen an der Seite, den das Projekt
         verbietet. */
      .card[data-linked='true'] {
        background: var(--color-surface-raised);
        box-shadow: inset 0 -3px 0 var(--color-primary), var(--shadow-sm);
      }

      .ref {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        text-transform: var(--label-transform);
        letter-spacing: var(--label-tracking);
        color: var(--color-text-muted);
      }

      .ref__dot {
        width: 6px;
        height: 6px;
        flex: none;
        border-radius: var(--border-radius-full);
        background: var(--color-primary);
      }

      h3 {
        margin: var(--space-4) 0 var(--space-1);
        font-family: var(--heading-font);
        font-weight: var(--heading-weight);
        font-size: var(--text-lg);
        line-height: var(--leading-tight);
        letter-spacing: var(--heading-tracking);
        text-transform: var(--heading-transform);
        color: var(--color-text-primary);
      }

      .role {
        margin: 0 0 var(--space-3);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        text-transform: var(--label-transform);
        letter-spacing: var(--label-tracking);
        color: var(--color-primary);
      }

      .teaser {
        margin: 0;
        font-family: var(--font-prose);
        font-size: var(--text-sm);
        line-height: var(--leading-relaxed);
        color: var(--color-text-secondary);
        display: -webkit-box;
        -webkit-line-clamp: 5;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      @container (max-width: 1023px) {
        .sheet {
          grid-template-columns: 1fr;
          gap: var(--space-8);
        }
      }

      @container (max-width: 767px) {
        .sheet {
          padding-block: var(--space-10);
        }

        .cards {
          display: flex;
          gap: var(--space-4);
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          /* Der Rand gehoert INS Band, sonst klebt die erste Karte an der
             Kante des Bildschirms. */
          padding-inline: var(--stage-gutter);
          margin-inline: calc(var(--stage-gutter) * -1);
        }

        .card {
          flex: 0 0 72cqw;
          scroll-snap-align: center;
        }
      }
    `,
  ];

  @property({ type: Array, attribute: false }) citizens: LandingCitizen[] = [];

  /** Die Welt, deren Ausgangssatz das Schmiede-Blatt gerade tippt. */
  @property({ type: String, attribute: false }) highlightSimulationId: string | null = null;

  protected render() {
    return html`
      <div class="sheet-grid" aria-hidden="true"></div>
      <div class="sheet stage-container">
        <div>
          <div class="sheet-head">
            <span class="sheet-head__no">${msg('Sheet 05')}</span>
            <span>${msg('Informants on record')}</span>
            <span class="sheet-head__rule"></span>
          </div>

          <h2>${msg('they remember')}<em>.</em></h2>
          <p class="lede">
            ${msg(
              'Every world is populated by AI characters who carry a memory, an opinion, and an intent of their own. They keep accounts, form attachments, fall out over nothing, and print the whole affair in the morning broadsheet.',
            )}
          </p>
          <button class="more atlas-arrow" @click=${() => navigate('/ai-characters')}>
            ${msg('Meet more characters')} <span aria-hidden="true">→</span>
          </button>
        </div>

        <div class="cards">
          ${this.citizens.map((citizen, index) => this._renderCitizen(citizen, index))}
        </div>
      </div>
    `;
  }

  /**
   * Beruf und Zone als eine Zeile — der Beruf IMMER ueber professionLabel().
   *
   * Die Anzeige von Berufen steht auf der Plattform unter einem Schalter
   * (`utils/profession.ts`); steht er aus, liefert der Helfer eine leere
   * Zeichenkette. Ein direktes `t(citizen, 'profession')` haette ihn hier
   * wieder angezeigt, ohne dass der Schalter etwas davon weiss — genau das hat
   * `tests/profession-parked.test.ts` an dieser Datei gefunden, bevor sie
   * jemand zu sehen bekam.
   *
   * Deshalb auch der Zusammenbau als Liste mit `filter`: bleibt der Beruf leer,
   * darf kein einsamer Mittelpunkt vor der Zone stehen.
   */
  private _role(citizen: LandingCitizen): string {
    return [professionLabel(t(citizen, 'profession')), citizen.zone_name]
      .filter(Boolean)
      .join(' · ');
  }

  private _renderCitizen(citizen: LandingCitizen, index: number) {
    const linked =
      this.highlightSimulationId !== null && citizen.simulation_id === this.highlightSimulationId;
    const ref = String(index + 1).padStart(3, '0');

    return html`
      <button
        class="card atlas-lift"
        data-linked=${String(linked)}
        @click=${() => navigate(`/simulations/${citizen.simulation_slug}`)}
      >
        <p class="ref">
          ${linked ? html`<span class="ref__dot" aria-hidden="true"></span>` : ''}
          <span>${msg(str`File ${ref} · ${citizen.simulation_name}`)}</span>
        </p>
        <h3>${citizen.name}</h3>
        <p class="role">${this._role(citizen)}</p>
        <p class="teaser">${t(citizen, 'character')}</p>
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-atlas-informants': VelgAtlasInformants;
  }
}
