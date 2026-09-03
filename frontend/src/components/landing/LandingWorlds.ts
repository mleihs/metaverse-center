/**
 * "Laeuft bereits" - vier echte Welten aus dem Schnappschuss.
 *
 * Der Entwurf nannte hier vier Namen fest im Quelltext, und zwei davon
 * existieren nicht: **Saltmeridian** und **The Gilded Hollow**. Beide standen
 * zusaetzlich in der SEO-Fussleiste, deren ganzer Zweck kriechbare `<a href>`
 * sind - der denkbar schlechteste Ort fuer einen toten Verweis.
 *
 * Deshalb kommt hier nichts aus einer Liste. Die vier Welten waehlt der
 * Endpunkt aus dem Bestand (Buergerzahl, bei Gleichstand juengerer
 * Herzschlag), und eine Welt ohne Kennung erreicht das Raster gar nicht erst.
 * Eine Auswahl aus dem Bestand kann nicht auf 404 zeigen.
 *
 * Der Betriebspunkt neben der Buergerzahl ist gemessen, nicht dekorativ: er
 * zeigt `transmitting` aus dem Schnappschuss, also ob der letzte Herzschlag
 * frisch ist. Velgarien stand ab dem 25.03. monatelang still, ohne dass es
 * irgendwo sichtbar war.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { LandingCounts, LandingWorld } from '../../types/index.js';
import { t } from '../../utils/locale-fields.js';
import { navigate } from '../../utils/navigation.js';
import { stageStyles } from '../shared/stage-styles.js';

@localized()
@customElement('velg-landing-worlds')
export class VelgLandingWorlds extends LitElement {
  static styles = [
    stageStyles,
    css`
    /* Ein Abschnitt ohne Inhalt darf keinen Platz nehmen: mit den beiden
       --space-24 stand hier sonst ein 192 Pixel hohes Nichts. */
    :host([hidden]) {
      display: none;
    }

    :host {
      --_rule: var(--color-border-light);
      display: block;
      /* Nur senkrecht — die seitliche Polsterung gehoert INNERHALB des
         Seitenmasses und sitzt deshalb am Behaelter, nicht an der Huelle. */
      padding-block: var(--space-24);
      background: var(--color-surface-sunken);
      border-top: var(--border-width-thin) solid var(--_rule);
      border-bottom: var(--border-width-thin) solid var(--_rule);
    }

    .inner {
      /* Die Polsterung gehoert INNERHALB des Masses: ohne border-box zaehlt
         "max-width" nur den Inhalt, der Kasten waere 1920 + 2 x 64 = 2048 px
         breit und der sichtbare Rand bei 2560 px 320 statt 384. Gemessen im
         Browser, nicht geschlossen — tsc und alle 23 Tore waren gruen. */
    }

    .head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: var(--space-6);
      margin-bottom: var(--space-10);
      flex-wrap: wrap;
    }

    .head__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: calc(clamp(var(--text-2xl), 4vw, 44px) * var(--stage-type-scale, 1));
      letter-spacing: var(--tracking-brutalist);
      text-transform: var(--heading-transform);
      color: var(--color-text-primary);
      margin: 0;
    }

    .head__title em {
      font-style: normal;
      color: var(--color-accent-amber);
    }

    .head__all {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      letter-spacing: var(--tracking-widest);
      text-transform: var(--label-transform);
      color: var(--color-text-quiet);
      background: none;
      border: 0;
      padding: var(--space-1) 0;
      cursor: pointer;
      transition: color var(--transition-normal);
    }

    .head__all:hover,
    .head__all:focus-visible {
      color: var(--color-accent-amber);
    }

    .head__arrow {
      display: inline-block;
      transition: transform var(--transition-normal);
    }

    .head__all:hover .head__arrow {
      transform: translateX(4px);
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--space-7);
    }

    .card {
      display: block;
      text-align: left;
      background: none;
      border: 0;
      padding: 0;
      cursor: pointer;
      color: inherit;
      font: inherit;
    }

    .card:focus-visible {
      outline: var(--border-width-default) solid var(--color-accent-amber);
      outline-offset: 4px;
    }

    .card__frame {
      /* Ein <span> ist per Vorgabe "inline", und auf einem Inline-Kasten
         wirkt aspect-ratio NICHT. Ohne diese Zeile war der Rahmen im Bild
         2 x 21 Pixel gross statt 4:3 (gemessen am 31.08.2026). */
      display: block;
      position: relative;
      aspect-ratio: 4 / 3;
      overflow: hidden;
      border: var(--border-width-thin) solid var(--_rule);
    }

    /* Der Zoom sitzt auf dem Bild, nie auf der Karte. */
    .card__img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      opacity: 0.72;
      filter: saturate(0.8);
      transition: transform var(--duration-slower) var(--ease-out),
        opacity var(--duration-slower) var(--ease-out);
    }

    .card:hover .card__img,
    .card:focus-visible .card__img {
      transform: scale(1.06);
      opacity: 0.92;
    }

    .card__veil {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        to top,
        color-mix(in srgb, var(--color-surface-sunken) 85%, transparent),
        transparent 45%
      );
      pointer-events: none;
    }

    .card__meta {
      position: absolute;
      bottom: var(--space-2-5);
      left: var(--space-3);
      right: var(--space-3);
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      letter-spacing: var(--tracking-wider);
      color: var(--color-text-quiet);
    }

    .card__beacon {
      width: 6px;
      height: 6px;
      border-radius: var(--border-radius-full);
      background: var(--color-accent-green);
      box-shadow: 0 0 calc(7px * var(--glow-strength)) var(--color-accent-green);
      flex: none;
    }

    .card__beacon--quiet {
      background: var(--color-text-muted);
      box-shadow: none;
    }

    .card__body {
      display: block;
      padding: var(--space-4) var(--space-0-5) 0;
    }

    .card__name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      letter-spacing: var(--tracking-wide);
      text-transform: var(--label-transform);
      color: var(--color-text-primary);
      margin: 0 0 var(--space-1-5);
      transition: color var(--transition-normal);
    }

    .card:hover .card__name {
      color: var(--color-accent-amber);
    }

    .card__desc {
      font-family: var(--font-prose);
      font-size: var(--text-sm);
      line-height: var(--leading-snug);
      color: var(--color-text-quiet);
      margin: 0;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    /* ── BREITBILD (Entwurf v2) ─────────────────────────────────────────
       Das Raster bleibt vierspaltig; die Karten wachsen einfach mit. Eine
       fuenfte Spalte bei 2560 px waere technisch moeglich und inhaltlich
       falsch — die Frontseite zeigt VIER Welten, nicht so viele, wie
       hineinpassen. Der Hintergrund und die beiden Trennlinien bleiben
       randlos, weil sie an der Huelle haengen. */
    @media (max-width: 1024px) {
      :host {
        padding: var(--space-16) var(--space-5);
      }

      .grid {
        grid-template-columns: repeat(2, 1fr);
        gap: var(--space-5);
      }
    }

    @media (max-width: 560px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .card__img,
      .head__arrow {
        transition: none;
      }

      .card:hover .card__img,
      .card:focus-visible .card__img {
        transform: none;
      }
    }
  `,
  ];

  @property({ type: Array, attribute: false }) worlds: LandingWorld[] = [];
  @property({ type: Object, attribute: false }) counts: LandingCounts | null = null;

  protected willUpdate(): void {
    this.hidden = this.worlds.length === 0;
  }

  protected render() {
    if (!this.worlds.length) return null;
    const total = this.counts?.worlds_live ?? this.worlds.length;

    return html`
      <div class="inner stage-container">
        <div class="head">
          <h2 class="head__title">${msg('Already running')}<em>.</em></h2>
          <button class="head__all" @click=${() => navigate('/worlds')}>
            ${msg(str`All ${total} worlds`)}
            <span class="head__arrow" aria-hidden="true">&rarr;</span>
          </button>
        </div>

        <div class="grid">
          ${this.worlds.map(
            (world) => html`
              <button class="card" @click=${() => navigate(`/simulations/${world.slug}`)}>
                <span class="card__frame">
                  ${
                    world.banner_url
                      ? html`<img
                        class="card__img"
                        src=${world.banner_url}
                        alt=""
                        loading="lazy"
                        decoding="async"
                      />`
                      : null
                  }
                  <span class="card__veil"></span>
                  <span class="card__meta">
                    <span
                      class="card__beacon ${world.transmitting ? '' : 'card__beacon--quiet'}"
                      aria-hidden="true"
                    ></span>
                    ${world.transmitting ? msg('Transmitting') : msg('Quiet')} &middot;
                    ${msg(str`${world.agent_count} citizens`)}
                  </span>
                </span>
                <span class="card__body">
                  <h3 class="card__name">${t(world, 'name')}</h3>
                  <p class="card__desc">${t(world, 'description')}</p>
                </span>
              </button>
            `,
          )}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-landing-worlds': VelgLandingWorlds;
  }
}
