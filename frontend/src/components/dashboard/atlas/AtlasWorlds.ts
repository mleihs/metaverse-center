/**
 * BLATT 03 — Meine Gebiete. Liste und Vorschau.
 *
 * Links eine Registerkante aus Zeilen, rechts die Tafel der gewaehlten Welt mit
 * ihrem Bild, ihrem Zitat und drei Zahlen. Die letzte Zeile der Liste ist kein
 * Eintrag, sondern der Weg zu einer neuen Welt.
 *
 * DAS ZITAT HAT KEINEN SPRECHER, SONDERN EINE HERKUNFT
 *   `lore_title` ist der Titel der Kammer, aus der die Zeile stammt. Eine
 *   Person, die es gesagt haette, gibt es nicht; die Kammer gibt es. Fehlt sie,
 *   steht die Herkunft nicht da — erfunden wird sie nicht.
 *
 * OHNE LORE KEINE LEERE TAFEL
 *   `lore_body` und `lore_epigraph` sind nullbar. Fehlen sie, zeigt die Tafel
 *   Bild und Zahlen und schweigt im Uebrigen. Ein Platzhaltertext waere eine
 *   Behauptung ueber eine Welt, die noch nichts ueber sich gesagt hat.
 *
 * TASTATUR UND FINGER
 *   Die Zeilen sind eine echte `tablist` mit Pfeiltasten. Auf einem Geraet ohne
 *   Zeiger waehlt ein Tipp aus; ein zweiter auf die gewaehlte Zeile geht in die
 *   Welt. Mit `mouseenter` allein saehe man auf einem Telefon nie etwas anderes
 *   als die erste Welt.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { DashboardWorld } from '../../../types/index.js';
import { memberRoleLabel, simulationThemeLabel } from '../../../utils/enum-labels.js';
import { t } from '../../../utils/locale-fields.js';
import { navigate } from '../../../utils/navigation.js';
import {
  atlasEntranceStyles,
  atlasGridStyles,
  atlasHoverStyles,
  atlasSelectionStyles,
  atlasSheetHeadStyles,
} from '../../shared/atlas-sheet-styles.js';
import { stageStyles } from '../../shared/stage-styles.js';

@localized()
@customElement('velg-atlas-worlds')
export class VelgAtlasWorlds extends LitElement {
  static styles = [
    atlasEntranceStyles,
    stageStyles,
    atlasSheetHeadStyles,
    atlasSelectionStyles,
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
        padding-block: var(--space-12);
        display: grid;
        grid-template-columns: 7fr 5fr;
        gap: var(--space-10);
        align-items: start;
      }

      .head {
        display: flex;
        justify-content: space-between;
        align-items: end;
        gap: var(--space-6);
        margin-bottom: var(--space-6);
      }

      h2 {
        margin: 0;
        font-family: var(--heading-font);
        font-weight: var(--heading-weight);
        font-size: calc(var(--text-xl) * var(--stage-type-scale));
        line-height: var(--leading-tight);
        letter-spacing: var(--heading-tracking);
        text-transform: var(--heading-transform);
        color: var(--color-text-primary);
      }

      h2 span {
        color: var(--color-text-muted);
      }

      .link {
        flex: 0 0 auto;
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

      .link:focus-visible,
      .row:focus-visible {
        outline: none;
        box-shadow: var(--ring-focus);
      }

      .rows {
        border-top: var(--border-width-thin) solid var(--color-border);
      }

      .row {
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: var(--space-5);
        align-items: center;
        width: 100%;
        text-align: left;
        padding: var(--space-4) var(--space-3);
        background: none;
        border: none;
        border-bottom: var(--border-width-thin) solid var(--color-border);
        cursor: pointer;
        color: inherit;
      }

      .row__no {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        letter-spacing: var(--label-tracking);
        color: var(--color-text-muted);
      }

      .row__name {
        display: block;
        font-family: var(--heading-font);
        font-weight: var(--heading-weight);
        font-size: var(--text-md);
        line-height: var(--leading-tight);
        letter-spacing: var(--heading-tracking);
        text-transform: var(--heading-transform);
        color: var(--color-text-primary);
        /* Ein Weltname ist erzeugter Text und im Deutschen oft ein einziges
           langes Wort. Ohne diese zwei Zeilen laeuft er aus der Zeile, ohne
           dass die Element-Box waechst -- also ohne dass eine Pruefung ueber
           getBoundingClientRect etwas meldet. Siehe AtlasRegistry h3. */
        hyphens: auto;
        overflow-wrap: break-word;
      }

      .row__desc {
        display: block;
        margin-top: var(--space-1);
        font-family: var(--font-body);
        font-size: var(--text-sm);
        line-height: var(--leading-snug);
        color: var(--color-text-secondary);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .row__meta {
        display: grid;
        justify-items: end;
        gap: var(--space-1);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        text-transform: var(--label-transform);
        letter-spacing: var(--label-tracking);
        color: var(--color-text-muted);
        white-space: nowrap;
      }

      .row--new .row__name {
        color: var(--color-primary);
      }

      /* ---- Die Tafel ---- */

      .panel {
        position: sticky;
        top: var(--space-8);
      }

      .plate {
        position: relative;
        aspect-ratio: 16 / 10;
        overflow: hidden;
        border: var(--border-width-thin) solid var(--color-border);
        box-shadow: var(--shadow-md);
        background: var(--color-surface-sunken);
      }

      .plate img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .plate__grid {
        position: absolute;
        inset: 0;
        pointer-events: none;
        background-image:
          linear-gradient(var(--color-grid) 1px, transparent 1px),
          linear-gradient(90deg, var(--color-grid) 1px, transparent 1px);
        background-size: calc(var(--grid-size) / 2) calc(var(--grid-size) / 2);
        opacity: calc(var(--theme-polarity, 0) * 0.5);
      }

      .plate__cap {
        position: absolute;
        left: var(--space-3);
        bottom: var(--space-3);
        /* Absolut gesetzt mit left und bottom, aber ohne rechte Schranke: die
           Box waechst mit dem Namen und laeuft aus der Platte heraus. KEIN
           right, denn dann waere der Kasten immer so breit wie die Platte und
           eine kurze Beschriftung saehe aus wie ein Balken -- eine Obergrenze
           laesst ihn mit dem Inhalt schrumpfen und haelt ihn trotzdem drin. */
        max-inline-size: calc(100% - var(--space-6));
        hyphens: auto;
        overflow-wrap: break-word;
        padding: var(--space-1) var(--space-2);
        background: var(--color-surface);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        text-transform: var(--label-transform);
        letter-spacing: var(--label-tracking);
        color: var(--color-text-primary);
      }

      .quote {
        margin: var(--space-5) 0 0;
        font-family: var(--font-prose);
        font-style: italic;
        font-size: var(--text-base);
        line-height: var(--leading-relaxed);
        color: var(--color-text-primary);
      }

      .source {
        margin: var(--space-2) 0 0;
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        text-transform: var(--label-transform);
        letter-spacing: var(--label-tracking);
        color: var(--color-text-muted);
      }

      .numbers {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        margin-top: var(--space-5);
        border-top: var(--border-width-thin) solid var(--color-border);
        border-left: var(--border-width-thin) solid var(--color-border);
      }

      .num {
        padding: var(--space-3);
        border-right: var(--border-width-thin) solid var(--color-border);
        border-bottom: var(--border-width-thin) solid var(--color-border);
      }

      .num__k {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        text-transform: var(--label-transform);
        letter-spacing: var(--label-tracking);
        color: var(--color-text-muted);
      }

      .num__v {
        margin-top: var(--space-1);
        font-family: var(--heading-font);
        font-weight: var(--heading-weight);
        font-size: var(--text-lg);
        font-variant-numeric: tabular-nums;
        color: var(--color-text-primary);
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-5);
        margin-top: var(--space-5);
      }

      .cta {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-3) var(--space-6);
        min-height: 44px;
        background: var(--color-primary);
        color: var(--color-text-inverse);
        border: var(--border-width-thin) solid var(--color-border);
        box-shadow: var(--shadow-sm);
        cursor: pointer;
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-xs);
        text-transform: var(--label-transform);
        letter-spacing: var(--label-tracking);
      }

      .cta:focus-visible {
        outline: none;
        box-shadow: var(--ring-focus);
      }

      @container (max-width: 1023px) {
        .sheet {
          grid-template-columns: 1fr;
          gap: var(--space-8);
        }

        /* Die Tafel UEBER die Liste und nicht klebend: eine klebende Tafel in
           einer einspaltigen Seite wandert an den Zeilen vorbei, zu denen sie
           gehoert. */
        .panel {
          position: static;
          order: -1;
        }

        .sheet > div:first-child {
          order: 1;
        }
      }

      @container (max-width: 767px) {
        .sheet {
          padding-block: var(--space-8);
        }

        .row {
          grid-template-columns: auto 1fr;
        }

        /* Rolle, Buerger und Thema unter den Namen statt daneben. */
        .row__meta {
          grid-column: 2;
          justify-items: start;
          grid-auto-flow: column;
          gap: var(--space-3);
          white-space: normal;
        }
      }
    `,
  ];

  @property({ attribute: false }) worlds: DashboardWorld[] = [];

  @state() private _selected = 0;

  private _select(index: number): void {
    const n = this.worlds.length;
    if (n === 0) return;
    this._selected = ((index % n) + n) % n;
  }

  private _onKey(event: KeyboardEvent): void {
    const step: Record<string, number> = {
      ArrowDown: 1,
      ArrowRight: 1,
      ArrowUp: -1,
      ArrowLeft: -1,
    };
    if (event.key in step) {
      event.preventDefault();
      this._select(this._selected + step[event.key]);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      this._select(0);
    }
    if (event.key === 'End') {
      event.preventDefault();
      this._select(this.worlds.length - 1);
    }
  }

  protected render() {
    if (!this.worlds.length) return nothing;
    const world = this.worlds[Math.min(this._selected, this.worlds.length - 1)];

    return html`
      <div class="sheet-grid" aria-hidden="true"></div>
      <div class="sheet stage-container atlas-enter" style="--i: 3">
        <div>
          <div class="sheet-head">
            <span class="sheet-head__no">${msg('Sheet 03')}</span>
            <span>${msg('My territories')}</span>
            <span class="sheet-head__rule"></span>
          </div>

          <div class="head">
            <h2>${msg('my worlds')} <span>(${this.worlds.length})</span></h2>
            <button class="link atlas-arrow" @click=${() => navigate('/forge')}>
              ${msg('Forge another')} <span aria-hidden="true">→</span>
            </button>
          </div>

          <div class="rows" role="tablist" aria-label=${msg('My worlds')} @keydown=${this._onKey}>
            ${this.worlds.map((w, i) => this._renderRow(w, i))}
          </div>
        </div>

        ${this._renderPanel(world)}
      </div>
    `;
  }

  private _renderRow(world: DashboardWorld, index: number) {
    const selected = index === this._selected;
    const sheet = String(index + 1).padStart(2, '0');
    const theme = world.theme ? simulationThemeLabel(world.theme) : '';

    return html`
      <button
        class="row atlas-cell atlas-enter-row"
        style="--j: ${index}"
        role="tab"
        aria-selected=${selected}
        tabindex=${selected ? 0 : -1}
        @mouseenter=${() => this._select(index)}
        @focus=${() => this._select(index)}
        @click=${() => (selected ? navigate(`/simulations/${world.slug}`) : this._select(index))}
      >
        <span class="row__no">${sheet}</span>
        <span>
          <span class="row__name">${t(world, 'name')}</span>
          <span class="row__desc">${t(world, 'description')}</span>
        </span>
        <span class="row__meta">
          <span>${msg(str`${memberRoleLabel(world.member_role)} · ${world.agent_count} citizens`)}</span>
          ${theme ? html`<span>${theme}</span>` : nothing}
        </span>
      </button>
    `;
  }

  private _renderPanel(world: DashboardWorld) {
    const quote = t(world, 'lore_epigraph');
    const source = t(world, 'lore_title');
    const sheet = String(Math.min(this._selected, this.worlds.length - 1) + 1).padStart(2, '0');

    return html`
      <div class="panel">
        <div class="plate atlas-zoom">
          ${
            world.banner_url
              ? html`<img src=${world.banner_url} alt="" loading="lazy" decoding="async" />`
              : nothing
          }
          <div class="plate__grid" aria-hidden="true"></div>
          <span class="plate__cap">${msg(str`Sheet ${sheet} · ${t(world, 'name')}`)}</span>
        </div>

        ${quote ? html`<blockquote class="quote">${quote}</blockquote>` : nothing}
        ${source ? html`<p class="source">${msg(str`From: ${source}`)}</p>` : nothing}

        <div class="numbers">
          <div class="num">
            <div class="num__k">${msg('Citizens')}</div>
            <div class="num__v">${world.agent_count}</div>
          </div>
          <div class="num">
            <div class="num__k">${msg('Buildings')}</div>
            <div class="num__v">${world.building_count}</div>
          </div>
          <div class="num">
            <div class="num__k">${msg('Role')}</div>
            <div class="num__v">${memberRoleLabel(world.member_role)}</div>
          </div>
        </div>

        <div class="actions">
          <button class="cta atlas-lift-sm" @click=${() => navigate(`/simulations/${world.slug}`)}>
            ${msg('Enter world')} <span aria-hidden="true">→</span>
          </button>
          <button
            class="link atlas-arrow"
            @click=${() => navigate(`/simulations/${world.slug}/terminal`)}
          >
            ${msg('Open terminal')}
          </button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-atlas-worlds': VelgAtlasWorlds;
  }
}
