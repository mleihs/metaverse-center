/**
 * BLATT 05 — Dossier, Substratmonitor, Auszeichnungen. Die Schiene.
 *
 * Drei Bloecke in der rechten Spalte: eine durchblaetterbare Operativenkarte,
 * die Beben mit ihrer Staerke, und der Stand der Auszeichnungen.
 *
 * DIE SCHIENE ENTFAELLT ALS GANZES, WENN SIE LEER WAERE
 *   Das entscheidet `DashboardPage`, nicht dieser Baustein: ohne Agenten UND
 *   ohne Beben wird er gar nicht erst gerendert, und das Register bekommt die
 *   volle Breite. Eine Spalte freizuhalten fuer eine Ueberschrift mit der
 *   Zeile "keine Beben verzeichnet" waere Platz fuer nichts.
 *
 *   Einzeln koennen die Bloecke trotzdem leer sein — dann sagt der eine, dass
 *   nichts verzeichnet ist, und der andere steht. Das ist der Unterschied
 *   zwischen "es gibt hier nichts" und "es gibt hier gerade nichts".
 *
 * DIE KARTE IST DIE ECHTE TCG-KARTE
 *   `<velg-game-card>` mit `type="agent"`, nicht ein nachgebautes Rechteck. Die
 *   Karte traegt den Rahmen der Welt (Textur, Namensschild, Ecken, Folie), und
 *   ein Nachbau haette diese vier Achsen ein zweites Mal implementiert — und
 *   auf dem Papier-Skin ohne die Buettenpapier-Textur dagestanden.
 *
 * DER BERUF LAEUFT UEBER professionLabel()
 *   Die Berufsanzeige steht plattformweit unter einem Schalter. Ein direktes
 *   `t(agent, 'profession')` haette ihn wieder angezeigt, ohne dass der
 *   Schalter etwas davon weiss; `tests/profession-parked.test.ts` prueft das.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Agent, Resonance } from '../../../types/index.js';
import { icons } from '../../../utils/icons.js';
import { t } from '../../../utils/locale-fields.js';
import { navigate } from '../../../utils/navigation.js';
import { professionLabel } from '../../../utils/profession.js';
import {
  atlasEntranceStyles,
  atlasHoverStyles,
  atlasSheetHeadStyles,
} from '../../shared/atlas-sheet-styles.js';
import '../../shared/VelgGameCard.js';
import '../../platform/VelgAchievementSummaryCard.js';

/** Die Skala des Substratmonitors. Zehn ist das Maximum der Datenquelle. */
const MAX_MAGNITUDE = 10;
/** Drei Beben; mehr waere eine Liste, keine Anzeige. */
const MONITOR_ROWS = 3;
/** Welche Zustaende das Substrat GERADE stoeren. */
const DISTURBING = new Set(['detected', 'impacting']);

@localized()
@customElement('velg-atlas-rail')
export class VelgAtlasRail extends LitElement {
  static styles = [
    atlasEntranceStyles,
    atlasSheetHeadStyles,
    atlasHoverStyles,
    css`
      :host {
        display: grid;
        gap: var(--space-8);
        align-content: start;
      }

      .block {
        border: var(--border-width-thin) solid var(--color-border);
        background: var(--color-surface);
      }

      .block__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-4);
        border-bottom: var(--border-width-thin) solid var(--color-border);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        text-transform: var(--label-transform);
        letter-spacing: var(--label-tracking);
        color: var(--color-text-muted);
      }

      .block__no {
        color: var(--color-primary);
      }

      .block__body {
        padding: var(--space-4);
      }

      .nav {
        display: flex;
        gap: var(--space-1);
      }

      .nav__btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        background: none;
        border: var(--border-width-thin) solid var(--color-border-light);
        cursor: pointer;
        color: var(--color-text-muted);
      }

      .nav__btn:focus-visible {
        outline: none;
        box-shadow: var(--ring-focus);
      }

      .dossier {
        display: grid;
        justify-items: center;
        gap: var(--space-4);
      }

      .dossier__meta {
        width: 100%;
      }

      .dossier__ref {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        text-transform: var(--label-transform);
        letter-spacing: var(--label-tracking);
        color: var(--color-text-muted);
      }

      .dossier__name {
        margin: var(--space-1) 0 0;
        font-family: var(--heading-font);
        font-weight: var(--heading-weight);
        font-size: var(--text-md);
        line-height: var(--leading-tight);
        letter-spacing: var(--heading-tracking);
        text-transform: var(--heading-transform);
        color: var(--color-text-primary);
      }

      /* ---- Substratmonitor ---- */

      .tremor {
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: var(--space-3);
        align-items: center;
        padding-block: var(--space-3);
        border-bottom: var(--border-width-thin) solid var(--color-border-light);
      }

      .tremor:last-child {
        border-bottom: none;
      }

      .tremor__dot {
        width: 6px;
        height: 6px;
        flex: none;
        border-radius: var(--border-radius-full);
        background: var(--color-border);
      }

      .tremor__dot--live {
        background: var(--color-danger);
      }

      .tremor__name {
        display: block;
        font-family: var(--font-body);
        font-size: var(--text-sm);
        line-height: var(--leading-snug);
        color: var(--color-text-primary);
      }

      .tremor__track {
        display: block;
        margin-top: var(--space-1);
        height: 4px;
        background: var(--color-border-light);
      }

      /*
       * Der Balken wird GEZOGEN, nicht gesetzt.
       *
       * Das dunkle Rail macht das seit jeher (grow, 900 ms, je Zeile 150 ms
       * versetzt); im Atlas stand nur die Breite. Eine Messung, die sich
       * aufbaut, liest sich als Messung -- eine, die fertig dasteht, als Bild.
       *
       * Die Breite bleibt inline und die Animation skaliert dagegen: so
       * bleibt der Endwert die gemessene Groesse und nicht eine, die die
       * Animation behauptet. transform-origin: left, weil eine Skala von
       * links waechst; der Endzustand ist transform: none, damit kein
       * Enthaltungskontext stehen bleibt.
       */
      .tremor__fill {
        display: block;
        height: 100%;
        background: var(--color-primary);
        transform-origin: left;
        animation: atlas-tremor-grow var(--duration-slower) var(--ease-default) both;
        animation-delay: calc(var(--i, 0) * var(--duration-cascade) + var(--j, 0) * 90ms);
      }

      @keyframes atlas-tremor-grow {
        from {
          transform: scaleX(0);
        }
        to {
          transform: none;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .tremor__fill {
          animation: none;
        }
      }

      .tremor__mag {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        font-variant-numeric: tabular-nums;
        color: var(--color-text-muted);
      }

      .empty {
        margin: 0;
        font-family: var(--font-body);
        font-size: var(--text-sm);
        color: var(--color-text-muted);
      }
    `,
  ];

  @property({ attribute: false }) agents: Agent[] = [];
  @property({ attribute: false }) resonances: Resonance[] = [];

  @state() private _selected = 0;

  private _step(delta: number): void {
    const n = this.agents.length;
    if (n === 0) return;
    this._selected = (((this._selected + delta) % n) + n) % n;
  }

  protected render() {
    return html`
      ${this._renderDossier()} ${this._renderMonitor()}
      <velg-achievement-summary-card></velg-achievement-summary-card>
    `;
  }

  private _renderDossier() {
    if (!this.agents.length) return nothing;
    const index = Math.min(this._selected, this.agents.length - 1);
    const agent = this.agents[index];
    const position = `${String(index + 1).padStart(2, '0')} / ${String(this.agents.length).padStart(2, '0')}`;

    return html`
      <section class="block atlas-enter" style="--i: 5">
        <div class="block__head">
          <span><span class="block__no">${msg('Sheet 05')}</span> ${msg('· Dossier')}</span>
          <span class="nav">
            <button
              class="nav__btn"
              @click=${() => this._step(-1)}
              aria-label=${msg('Previous operative')}
            >${icons.chevronLeft(14)}</button>
            <button
              class="nav__btn"
              @click=${() => this._step(1)}
              aria-label=${msg('Next operative')}
            >${icons.chevronRight(14)}</button>
          </span>
        </div>
        <div class="block__body dossier">
          <velg-game-card
            type="agent"
            size="md"
            .name=${agent.name}
            image-url=${agent.portrait_image_url ?? ''}
            .subtitle=${professionLabel(t(agent, 'profession'))}
            @click=${() => navigate(`/simulations/${agent.simulation_id}/agents/${agent.slug}`)}
          ></velg-game-card>
          <div class="dossier__meta">
            <span class="dossier__ref">${position}</span>
            <p class="dossier__name">${agent.name}</p>
          </div>
        </div>
      </section>
    `;
  }

  private _renderMonitor() {
    const rows = this.resonances.slice(0, MONITOR_ROWS);

    return html`
      <section class="block atlas-enter" style="--i: 6">
        <div class="block__head">
          <span>${msg('Substrate monitor')}</span>
          <span>${msg('magnitude 1–10')}</span>
        </div>
        <div class="block__body">
          ${
            rows.length
              ? rows.map((r, i) => this._renderTremor(r, i))
              : html`<p class="empty">${msg('No tremors on record')}</p>`
          }
        </div>
      </section>
    `;
  }

  private _renderTremor(tremor: Resonance, index: number) {
    const live = DISTURBING.has(tremor.status);
    const share = Math.max(0, Math.min(1, (tremor.magnitude ?? 0) / MAX_MAGNITUDE));

    return html`
      <div class="tremor atlas-enter-row" style="--j: ${index}">
        <span class="tremor__dot ${live ? 'tremor__dot--live' : ''}" aria-hidden="true"></span>
        <span>
          <span class="tremor__name">${tremor.title}</span>
          <span class="tremor__track">
            <span class="tremor__fill" style="width: ${(share * 100).toFixed(0)}%"></span>
          </span>
        </span>
        <span class="tremor__mag">${msg(str`M${tremor.magnitude ?? 0}`)}</span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-atlas-rail': VelgAtlasRail;
  }
}
