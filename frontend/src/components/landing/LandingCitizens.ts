/**
 * "Sie erinnern sich" - drei echte Buerger als aufgefaecherte Dossierkarten.
 *
 * DIE KARTE IST NICHT NEU GEBAUT
 * Der Handoff beschreibt die TCG-Karte in vollem Umfang neu (Edelstein links,
 * Edelstein rechts, Pip-Reihe, Namensschild, Seltenheitsfuss). Die Karte gibt
 * es bereits als `<velg-game-card>`, gebaut nach `docs/explanations/
 * tcg-card-system.md`, mit Neigung bei Mausbewegung und Glanzlicht. Sie hier
 * nachzubauen hiesse, dieselbe Spezifikation ein zweites Mal zu pflegen - und
 * die zweite Fassung waere in einem halben Jahr die falsche.
 *
 * DIE FAECHERUNG SITZT AUF EINEM HUELLELEMENT
 * Die Drehung von -7/0/+7 Grad liegt auf einer Huelle um die Karte, nicht auf
 * der Karte selbst: `<velg-game-card>` benutzt `transform` fuer seine eigene
 * Neigung, und zwei Quellen fuer dieselbe Eigenschaft ergeben genau einen
 * Gewinner. Die Huelle dreht, die Karte neigt.
 *
 * WAS DIE KARTE ZEIGT, IST GEMESSEN
 * Der Endpunkt liefert nur Buerger MIT Portraet, Beruf und Kennung. Gemessen
 * ueber die 108 Agenten lebender Welten: 108 haben ein Portraet, aber nur 66
 * einen Beruf - ohne diese Bedingung waere die Zeile "Beruf · Zone" bei den
 * ersten drei leer geblieben.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { LandingCitizen } from '../../types/index.js';
import { t } from '../../utils/locale-fields.js';
import { navigate } from '../../utils/navigation.js';
import '../shared/VelgGameCard.js';

/** Die Faecherung des Entwurfs: drei Karten, leicht ueberlappend. */
const FAN_ANGLES = [-7, 0, 7];

@localized()
@customElement('velg-landing-citizens')
export class VelgLandingCitizens extends LitElement {
  static styles = css`
    /* Ein Abschnitt ohne Inhalt darf keinen Platz nehmen: mit den beiden
       --space-24 stand hier sonst ein 192 Pixel hohes Nichts. Lokal gibt es
       keine Agenten mit Portraet, und genau dort ist es aufgefallen. */
    :host([hidden]) {
      display: none;
    }

    :host {
      display: block;
      padding: var(--space-24) var(--space-12);
      background: var(--color-surface);
    }

    .layout {
      display: grid;
      grid-template-columns: 380px 1fr;
      gap: var(--space-16);
      align-items: center;
      max-width: var(--container-max);
      margin: 0 auto;
    }

    .kicker {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      letter-spacing: var(--tracking-widest);
      text-transform: uppercase;
      color: var(--color-accent-amber);
      margin-bottom: var(--space-4);
    }

    .kicker::before {
      content: '';
      width: 24px;
      height: 1px;
      background: var(--color-accent-amber);
    }

    .title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: clamp(var(--text-xl), 3.4vw, 40px);
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
      line-height: var(--leading-tight);
      color: var(--color-text-primary);
      margin: 0 0 var(--space-4);
    }

    .title em {
      font-style: normal;
      color: var(--color-accent-amber);
    }

    .lede {
      font-family: var(--font-prose);
      font-size: var(--text-base);
      line-height: var(--leading-relaxed);
      color: var(--color-text-secondary);
      margin: 0 0 var(--space-6);
    }

    .more {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      letter-spacing: var(--tracking-widest);
      text-transform: uppercase;
      color: var(--color-text-muted);
      background: none;
      border: 0;
      padding: var(--space-1) 0;
      cursor: pointer;
      transition: color var(--transition-normal);
    }

    .more:hover,
    .more:focus-visible {
      color: var(--color-accent-amber);
    }

    .more__arrow {
      display: inline-block;
      transition: transform var(--transition-normal);
    }

    .more:hover .more__arrow {
      transform: translateX(4px);
    }

    .fan {
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: var(--space-6) 0 var(--space-3);
      min-width: 0;
    }

    /* Die Drehung liegt hier, nicht auf der Karte: "velg-game-card" benutzt
       "transform" fuer seine eigene Neigung. */
    .fan__slot {
      transition: transform var(--duration-slow) var(--ease-out);
    }

    .fan__slot:not(:first-child) {
      margin-left: calc(var(--space-12) * -1);
    }

    .fan__slot:hover,
    .fan__slot:focus-within {
      z-index: var(--z-raised);
    }

    @media (max-width: 1024px) {
      :host {
        padding: var(--space-16) var(--space-5);
      }

      .layout {
        grid-template-columns: 1fr;
        gap: var(--space-10);
      }

      .fan {
        flex-wrap: wrap;
        gap: var(--space-4);
      }

      .fan__slot {
        transform: none !important;
      }

      .fan__slot:not(:first-child) {
        margin-left: 0;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .fan__slot,
      .more__arrow {
        transition: none;
      }
    }
  `;

  @property({ type: Array, attribute: false }) citizens: LandingCitizen[] = [];

  protected willUpdate(): void {
    this.hidden = this.citizens.length === 0;
  }

  protected render() {
    if (!this.citizens.length) return null;

    return html`
      <div class="layout">
        <div>
          <div class="kicker">${msg('The citizens')}</div>
          <h2 class="title">${msg('They remember')}<em>.</em></h2>
          <p class="lede">
            ${msg(
              'Every world is populated by AI characters with memory, opinion, and intent. They hold grudges, form bonds, and print their own morning broadsheet.',
            )}
          </p>
          <button class="more" @click=${() => navigate('/worlds')}>
            ${msg('Meet more characters')}
            <span class="more__arrow" aria-hidden="true">&rarr;</span>
          </button>
        </div>

        <div class="fan">
          ${this.citizens.slice(0, FAN_ANGLES.length).map(
            (citizen, index) => html`
              <div
                class="fan__slot"
                style="transform: rotate(${FAN_ANGLES[index]}deg); z-index: ${index === 1 ? 2 : 1}"
              >
                <velg-game-card
                  type="agent"
                  size="md"
                  .name=${citizen.name}
                  image-url=${citizen.portrait_image_url ?? ''}
                  .subtitle=${[t(citizen, 'profession'), citizen.zone_name]
                    .filter(Boolean)
                    .join(' · ')}
                  @click=${() =>
                    navigate(`/simulations/${citizen.simulation_slug}/agents/${citizen.slug}`)}
                ></velg-game-card>
              </div>
            `,
          )}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-landing-citizens': VelgLandingCitizens;
  }
}
