/**
 * BLATT 04 — Von anderen vermessen. Das Weltenregister.
 *
 * Sechs Blaetter aus dem Bestand, darunter eine Zeile, die sagt, wie viele
 * noch da sind.
 *
 * DAS REGISTER ZAEHLT, WAS ANKOMMT
 *   Die Zahl in der Ueberschrift ist `worlds.length` — die Laenge dessen, was
 *   der Abruf geliefert hat, nicht eine Gesamtzahl aus einer anderen Quelle.
 *   Der Abruf holt bis zu hundert; kaeme spaeter eine Blaetterung dazu, waere
 *   diese Zahl still falsch. Deshalb steht sie neben genau den Karten, die sie
 *   zaehlt, und die Restzeile rechnet aus derselben Liste.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { Simulation } from '../../../types/index.js';
import { simulationThemeLabel } from '../../../utils/enum-labels.js';
import { t } from '../../../utils/locale-fields.js';
import { navigate } from '../../../utils/navigation.js';
import { atlasHoverStyles, atlasSheetHeadStyles } from '../../shared/atlas-sheet-styles.js';
import { stageStyles } from '../../shared/stage-styles.js';

/** Wie viele Blaetter gezeigt werden. Der Rest begruendet die Zeile darunter. */
const CARD_COUNT = 6;

@localized()
@customElement('velg-atlas-registry')
export class VelgAtlasRegistry extends LitElement {
  static styles = [
    stageStyles,
    atlasSheetHeadStyles,
    atlasHoverStyles,
    css`
      :host {
        display: block;
        container-type: inline-size;
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
        font-size: clamp(26px, 3vw, 34px);
        line-height: var(--leading-tight);
        letter-spacing: var(--heading-tracking);
        text-transform: var(--heading-transform);
        color: var(--color-text-primary);
        /* Aus dem Pruefbericht des Prototyps: die Zeile darf nicht umbrechen,
           sonst rutscht die Zahl in Klammern allein auf die zweite Zeile. */
        white-space: nowrap;
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
      .card:focus-visible {
        outline: none;
        box-shadow: var(--ring-focus);
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        border-top: var(--border-width-thin) solid var(--color-border);
        border-left: var(--border-width-thin) solid var(--color-border);
      }

      .card {
        display: block;
        text-align: left;
        padding: var(--space-5);
        background: none;
        border: none;
        border-right: var(--border-width-thin) solid var(--color-border);
        border-bottom: var(--border-width-thin) solid var(--color-border);
        cursor: pointer;
        color: inherit;
      }

      /* Eine kleine Platte, damit das Register wie der Rest der Mappe liest:
         ein Blatt zeigt eine Aufnahme, keinen Text allein. Fehlt das Bild,
         bleibt das Raster — ein Gebiet, das noch niemand fotografiert hat. */
      .card__plate {
        position: relative;
        aspect-ratio: 16 / 9;
        margin-bottom: var(--space-3);
        overflow: hidden;
        border: var(--border-width-thin) solid var(--color-border-light);
        background: var(--color-surface-sunken);
      }

      .card__plate img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .card__plate span {
        position: absolute;
        inset: 0;
        pointer-events: none;
        background-image:
          linear-gradient(var(--color-grid) 1px, transparent 1px),
          linear-gradient(90deg, var(--color-grid) 1px, transparent 1px);
        background-size: calc(var(--grid-size) / 4) calc(var(--grid-size) / 4);
        opacity: calc(var(--theme-polarity, 0) * 0.5);
      }

      .card__no {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        text-transform: var(--label-transform);
        letter-spacing: var(--label-tracking);
        color: var(--color-primary);
      }

      /* Aus dem Pruefbericht: die Meta-Zeile darf nicht umbrechen. */
      .card__meta {
        display: flex;
        justify-content: space-between;
        gap: var(--space-3);
        margin-top: var(--space-3);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        text-transform: var(--label-transform);
        letter-spacing: var(--label-tracking);
        color: var(--color-text-muted);
        white-space: nowrap;
      }

      h3 {
        margin: var(--space-2) 0 0;
        font-family: var(--heading-font);
        font-weight: var(--heading-weight);
        font-size: var(--text-md);
        line-height: var(--leading-tight);
        letter-spacing: var(--heading-tracking);
        text-transform: var(--heading-transform);
        color: var(--color-text-primary);
      }

      .rest {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--space-4);
        width: 100%;
        padding: var(--space-4) var(--space-5);
        background: none;
        border: none;
        border-bottom: var(--border-width-thin) solid var(--color-border);
        border-left: var(--border-width-thin) solid var(--color-border);
        border-right: var(--border-width-thin) solid var(--color-border);
        cursor: pointer;
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        text-transform: var(--label-transform);
        letter-spacing: var(--label-tracking);
        color: var(--color-text-muted);
      }

      @container (max-width: 1279px) {
        .grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      @container (max-width: 767px) {
        .grid {
          grid-template-columns: 1fr;
        }

        .head {
          flex-direction: column;
          align-items: flex-start;
          gap: var(--space-3);
        }

        h2 {
          white-space: normal;
        }
      }
    `,
  ];

  @property({ attribute: false }) worlds: Simulation[] = [];

  protected render() {
    if (!this.worlds.length) return nothing;
    const shown = this.worlds.slice(0, CARD_COUNT);
    const rest = this.worlds.length - shown.length;

    return html`
      <div class="sheet-head">
        <span class="sheet-head__no">${msg('Sheet 04')}</span>
        <span>${msg('Shard registry')}</span>
        <span class="sheet-head__rule"></span>
      </div>

      <div class="head">
        <h2>${msg('surveyed by others')} <span>(${this.worlds.length})</span></h2>
        <button class="link atlas-arrow" @click=${() => navigate('/worlds')}>
          ${msg(str`All ${this.worlds.length} sheets`)} <span aria-hidden="true">→</span>
        </button>
      </div>

      <div class="grid">${shown.map((w, i) => this._renderCard(w, i))}</div>

      ${
        rest > 0
          ? html`<button class="rest atlas-arrow" @click=${() => navigate('/worlds')}>
              <span>${msg(str`${rest} more sheets on file`)}</span>
              <span>${msg('Browse the registry')} <span aria-hidden="true">→</span></span>
            </button>`
          : nothing
      }
    `;
  }

  private _renderCard(world: Simulation, index: number) {
    const sheet = String(index + 1).padStart(2, '0');
    const theme = world.theme ? simulationThemeLabel(world.theme) : '';

    return html`
      <button class="card atlas-zoom" @click=${() => navigate(`/simulations/${world.slug}`)}>
        <span class="card__plate">
          ${
            world.banner_url
              ? html`<img src=${world.banner_url} alt="" loading="lazy" decoding="async" />`
              : nothing
          }
          <span aria-hidden="true"></span>
        </span>
        <span class="card__no">${msg(str`Sheet ${sheet}`)}</span>
        <p class="card__meta">
          <span>${theme}</span>
          <span>${msg(str`${world.agent_count ?? 0} citizens`)}</span>
        </p>
        <h3>${t(world, 'name')}</h3>
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-atlas-registry': VelgAtlasRegistry;
  }
}
