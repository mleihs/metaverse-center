/**
 * Das Weltenregister — was andere gebaut haben.
 *
 * Der Entwurf nennt es „Shard Registry / Community 44" und zeigt ein 2×3-Raster
 * mit einer Leiste darunter („+38 weitere Welten im Register").
 *
 * ⚠ ES SIND NICHT 44. Gemessen auf Prod am 31.08.2026: **16 lebende Vorlagen.**
 * Die Zahl im Entwurf ist eine Attrappe, wie die „47 worlds" auf der
 * Frontseite, aus denen gemessen 16 wurden. Sie steht deshalb nirgends fest im
 * Bauteil: die Überschrift zählt, was ankommt, und die Leiste darunter rechnet
 * den Rest aus, statt ihn zu behaupten. Bleibt kein Rest, erscheint sie nicht —
 * eine Leiste, die „+0 weitere" sagt, ist eine Zeile ohne Nachricht.
 *
 * Bei ≥1920 wird aus 2×3 ein 3×2, wie der Entwurf es vorsieht: die Karten
 * werden nicht grösser, es passen mehr nebeneinander.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { Simulation } from '../../types/index.js';
import { t } from '../../utils/locale-fields.js';
import { navigate } from '../../utils/navigation.js';
import { humanizeEnum } from '../../utils/text.js';
import { stageStyles } from '../shared/stage-styles.js';

/**
 * Wie viele Karten das Raster trägt.
 *
 * Der Entwurf sagt sechs — und sechs füllte sein ZWEISPALTIGES Raster exakt
 * (3 × 2, keine angebrochene Reihe). Seit das Raster mit auto-fill arbeitet,
 * sind je nach Platz zwei, drei oder vier Spalten im Spiel:
 *
 *     ~1585 px (Schiene eingeklappt)   4 Spalten
 *     ~1105 px (Schiene da)            3 Spalten
 *      unter 960 px                    2 Spalten
 *
 * Sechs ließe bei vier Spalten zwei Plätze in der letzten Reihe leer. Zwölf
 * geht in 2, 3 und 4 glatt auf — dieselbe Eigenschaft, die die Sechs im
 * Entwurf hatte, übertragen auf die Spaltenzahlen, die es jetzt gibt. Die
 * Ziffer ändert sich, die Absicht bleibt.
 *
 * Von 16 Welten stehen damit 12 da und 4 im Register dahinter, statt 6 und 10.
 */
const CARD_COUNT = 12;

@localized()
@customElement('velg-dashboard-registry')
export class VelgDashboardRegistry extends LitElement {
  static styles = [
    stageStyles,
    css`
      :host {
        --_rule: var(--color-border-light);
        --_veil: color-mix(in srgb, var(--color-surface-sunken) 92%, transparent);

        display: block;
        padding-block: var(--space-12);
      }

      :host([hidden]) {
        display: none;
      }

      .head {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: var(--space-6);
        margin-bottom: var(--space-5);
      }

      .head__left {
        display: flex;
        align-items: baseline;
        gap: var(--space-3);
        min-width: 0;
      }

      .head__kicker {
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-xs);
        letter-spacing: var(--tracking-widest);
        text-transform: uppercase;
        color: var(--color-accent-amber);
      }

      .head__title {
        margin: 0;
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: calc(var(--text-xl) * var(--stage-type-scale, 1));
        letter-spacing: var(--tracking-brutalist);
        text-transform: uppercase;
        color: var(--color-text-primary);
      }

      .head__count {
        font-family: var(--font-mono);
        font-size: var(--text-sm);
        color: var(--color-text-quiet);
      }

      .head__all {
        flex: 0 0 auto;
        background: none;
        border: 0;
        padding: 0;
        cursor: pointer;
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-xs);
        letter-spacing: var(--tracking-wider);
        text-transform: uppercase;
        color: var(--color-text-quiet);
        transition: color var(--transition-fast);
      }

      .head__all:hover,
      .head__all:focus-visible {
        color: var(--color-accent-amber);
      }

      /*
       * Das Raster nimmt die Breite, die es bekommt, statt zwei feste Spalten.
       *
       * Vorher: repeat(2, 1fr) plus zwei Medienabfragen (3 Spalten ab 1920,
       * 1 Spalte unter 640). Drei Orte fuer eine Regel — und dazwischen, auf
       * 1600 gemessen, Karten von 497 px Breite fuer einen Titel und
       * „6 AG · 7 GEB". Das ist ein Plakat an der Stelle eines
       * Registereintrags.
       *
       * Mit auto-fill bestimmt der Platz die Spaltenzahl: 320 px ist die
       * Breite, unter der der laengste Weltname („Flatulenz als Logos: Die
       * pneumatische Sprache der Entrechteten") in mehr als zwei Zeilen faellt.
       * Ein Wert, drei Bildschirmgroessen, und die Mobil-Abfrage darunter wird
       * ueberfluessig, weil 1fr bei einer Spalte dasselbe ist.
       */
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        gap: var(--space-3-5);
      }

      .card {
        position: relative;
        display: block;
        width: 100%;
        height: 172px;
        padding: 0;
        border: var(--border-width-thin) solid var(--_rule);
        background: var(--color-surface-sunken);
        color: inherit;
        cursor: pointer;
        overflow: hidden;
        transition: border-color var(--transition-fast);
      }

      .card:hover,
      .card:focus-visible {
        border-color: var(--color-border);
      }

      .card__art {
        position: absolute;
        inset: 0;
        background-position: center;
        background-size: cover;
        opacity: 0.72;
        transition: transform var(--duration-slower) var(--ease-default);
      }

      .card:hover .card__art,
      .card:focus-visible .card__art {
        transform: scale(1.06);
      }

      .card__veil {
        position: absolute;
        inset: 0;
        background: linear-gradient(180deg, transparent 40%, var(--_veil));
      }

      .card__tag {
        position: absolute;
        top: var(--space-3);
        right: var(--space-3);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        letter-spacing: var(--tracking-wider);
        text-transform: uppercase;
        color: var(--color-text-secondary);
      }

      .card__foot {
        position: absolute;
        left: var(--space-4);
        right: var(--space-4);
        bottom: var(--space-3);
        text-align: left;
      }

      .card__name {
        display: block;
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-sm);
        letter-spacing: var(--tracking-brutalist);
        text-transform: uppercase;
        color: var(--color-text-primary);
      }

      .card__stats {
        display: block;
        margin-top: var(--space-1);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        letter-spacing: var(--tracking-wider);
        color: var(--color-text-quiet);
        white-space: nowrap;
      }

      .bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--space-5);
        width: 100%;
        margin-top: var(--space-3-5);
        padding: var(--space-4) var(--space-6);
        border: var(--border-width-thin) solid var(--_rule);
        background: transparent;
        color: var(--color-text-quiet);
        cursor: pointer;
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        letter-spacing: var(--tracking-wider);
        text-transform: uppercase;
        transition: color var(--transition-fast);
      }

      .bar:hover,
      .bar:focus-visible {
        color: var(--color-accent-amber);
      }

      /* Die Spaltenzahl regelt auto-fill; hier bleibt nur, was es NICHT
         regelt: auf sehr breiten Schirmen darf die Karte hoeher werden. */
      @media (min-width: 1920px) {
        .card {
          height: 190px;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .card__art {
          transition: none;
        }

        .card:hover .card__art {
          transform: none;
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
      <div class="stage-container">
        <div class="head">
          <div class="head__left">
            <span class="head__kicker">${msg('Shard Registry')}</span>
            <h2 class="head__title">${msg('Community')}</h2>
            <span class="head__count">${this.worlds.length}</span>
          </div>
          <button class="head__all" @click=${() => navigate('/worlds')}>
            ${msg(str`All ${this.worlds.length} worlds`)}
          </button>
        </div>
        <div class="grid">${shown.map((w) => this._renderCard(w))}</div>
        ${
          rest > 0
            ? html`<button class="bar" @click=${() => navigate('/worlds')}>
                <span>${msg(str`${rest} more worlds in the registry`)}</span>
                <span>${msg('Open index')}</span>
              </button>`
            : nothing
        }
      </div>
    `;
  }

  private _renderCard(world: Simulation) {
    return html`
      <button class="card" @click=${() => navigate(`/simulations/${world.slug}`)}>
        ${
          world.banner_url
            ? html`<span class="card__art" style="background-image: url('${world.banner_url}')"></span>`
            : nothing
        }
        <span class="card__veil"></span>
        <span class="card__tag">${humanizeEnum(world.theme)}</span>
        <span class="card__foot">
          <span class="card__name">${t(world, 'name')}</span>
          <span class="card__stats">
            ${msg(str`${world.agent_count ?? 0} AG · ${world.building_count ?? 0} BLDG`)}
          </span>
        </span>
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-dashboard-registry': VelgDashboardRegistry;
  }
}
