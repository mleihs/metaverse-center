/**
 * VelgDriftEffectCards — what the delivery actually DID to the world.
 *
 * P0 collapsed the hospitality gate's verdict into a number ("3 Wirkungen ausgelöst",
 * DriftView.ts:477). The one thing the traveller crossed the Bleed for — evidence that a
 * foreign world changed because they arrived — was a digit in a toast.
 *
 * Each card is one effect: what kind, WHICH world or Träger, and a link to the receipt
 * (the event the gate wrote, resolvable because it carries the quest instance id). A
 * FILTERED effect gets a card too, on a redacted face, carrying the gate's own reason:
 * a world that only admits echoes has ANSWERED. Hiding that would make the Bureau's
 * hospitality system invisible — and it is the most interesting rule in the game.
 *
 * Motion (plan §8 M-03/M-04): the cards flip out of the dossier stack (rotateY 90→0) with
 * a 120 ms stagger; the filtered card flips onto its redaction face with a 2-frame glitch.
 * Under prefers-reduced-motion they simply appear in order — the sequence is the meaning,
 * the rotation is only the flourish.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { DriftEarnings, DriftEffectCard } from '../../types/drift.js';
import { icons } from '../../utils/icons.js';
import '../shared/VelgRedacted.js';
import { buttonStyles } from '../shared/button-styles.js';

/** Effect kind → the Bureau's word for it. */
function kindLabel(kind: string): string {
  switch (kind) {
    case 'emit_fragment':
      return msg('Journalnotiz');
    case 'emit_echo':
      return msg('Echo');
    case 'inject_agent_memory':
      return msg('Erinnerung');
    case 'spawn_event':
      return msg('Ereignis');
    default:
      return msg('Wirkung');
  }
}

/** The gate's skip reason → plain speech. The raw reason is kept as the redaction label,
 *  so the machine's word is always one hover away from the human one. */
function reasonLabel(reason: string | null): string {
  if (!reason) return msg('Von der Welt gefiltert.');
  if (reason.startsWith('hospitality_nur_echos'))
    return msg('Gastfreundschaft: nur Echos. Die Welt hört dich, aber sie lässt dich nicht ein.');
  if (reason.startsWith('hospitality_geschlossen'))
    return msg('Gastfreundschaft: geschlossen. Diese Welt nimmt nichts an.');
  if (reason.startsWith('hospitality_'))
    return msg('Die Gastfreundschaft der Welt hat die Wirkung zurückgewiesen.');
  if (reason === 'no_target_agent') return msg('Kein Empfänger vor Ort. Die Wirkung verfiel.');
  if (reason === 'no_target_sim') return msg('Kein Ziel verzeichnet. Die Wirkung verfiel.');
  if (reason === 'unsupported_p0c') return msg('Diese Wirkungsart ist noch nicht freigegeben.');
  return msg('Von der Welt gefiltert.');
}

@localized()
@customElement('velg-drift-effect-cards')
export class VelgDriftEffectCards extends LitElement {
  static styles = [
    buttonStyles,
    css`
      :host {
        display: block;
        --_applied: var(--color-primary);
        --_filtered: var(--color-text-muted);
      }

      .sheet {
        padding: var(--space-4);
        background: var(--color-surface-raised);
        border: var(--border-medium);
        border-top: var(--border-width-heavy) solid var(--_applied);
        box-shadow: var(--shadow-lg);
      }

      .sheet__eyebrow {
        margin: 0;
        font-family: var(--font-brutalist);
        text-transform: uppercase;
        letter-spacing: var(--tracking-brutalist);
        font-size: var(--text-xs);
        color: var(--color-text-muted);
      }

      .sheet__title {
        margin: var(--space-1) 0 var(--space-3);
        font-family: var(--font-brutalist);
        text-transform: uppercase;
        letter-spacing: var(--tracking-brutalist);
        font-size: var(--text-md);
        color: var(--color-text-primary);
      }

      .earnings {
        display: flex;
        gap: var(--space-3);
        margin-bottom: var(--space-3);
        padding: var(--space-2) var(--space-3);
        /* Doppelung zum getoenten Hintergrund. */
        background: var(--color-primary-bg);
      }

      .earnings__item {
        font-family: var(--font-mono);
        font-size: var(--text-sm);
        font-variant-numeric: tabular-nums;
        color: var(--color-primary);
      }

      .earnings__label {
        font-family: var(--font-brutalist);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
      }

      .cards {
        display: grid;
        gap: var(--space-2);
        margin-bottom: var(--space-4);
      }

      /* M-03: each card flips out of the stack. The transform lives on the CARD (a leaf),
         never on the sheet — a transformed container would break fixed-position modals. */
      .card {
        display: flex;
        align-items: flex-start;
        gap: var(--space-2);
        padding: var(--space-2) var(--space-3);
        background: var(--color-surface);
        /* Der Zustand der Karte (angewandt / gefiltert) faerbt den ganzen
           Rahmen; die Filterregel darunter zieht nach. */
        border: var(--border-width-thin) solid var(--_applied);
        animation: card-flip 640ms var(--ease-dramatic) both;
        animation-delay: calc(var(--i, 0) * 120ms);
      }

      .card--filtered {
        border-color: var(--_filtered);
        background: var(--color-surface-sunken);
        animation: card-flip 640ms var(--ease-dramatic) both,
          card-glitch 90ms steps(2, end) calc(var(--i, 0) * 120ms + 520ms) 1;
      }

      @keyframes card-flip {
        from {
          opacity: 0;
          transform: perspective(600px) rotateY(90deg);
        }
        to {
          opacity: 1;
          transform: perspective(600px) rotateY(0);
        }
      }

      @keyframes card-glitch {
        50% {
          transform: perspective(600px) translateX(2px);
        }
      }

      .card__icon {
        flex: none;
        margin-top: 2px;
        color: var(--_applied);
      }

      .card--filtered .card__icon {
        color: var(--_filtered);
      }

      .card__body {
        flex: 1;
        min-width: 0;
      }

      .card__kind {
        font-family: var(--font-brutalist);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
      }

      .card__target {
        margin: var(--space-0-5) 0 0;
        font-family: var(--font-bureau);
        font-size: var(--text-sm);
        line-height: var(--leading-snug);
        color: var(--color-text-primary);
      }

      .card__reason {
        margin: var(--space-1) 0 0;
        font-size: var(--text-xs);
        line-height: var(--leading-snug);
        color: var(--color-text-muted);
      }

      .card__link {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        margin-top: var(--space-1);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--color-text-link);
        text-decoration: none;
      }

      .card__link:hover,
      .card__link:focus-visible {
        text-decoration: underline;
      }

      .empty {
        margin: 0 0 var(--space-4);
        font-family: var(--font-bureau);
        font-size: var(--text-sm);
        color: var(--color-text-muted);
      }

      @media (prefers-reduced-motion: reduce) {
        .card,
        .card--filtered {
          animation: card-appear 1ms linear both;
          animation-delay: calc(var(--i, 0) * 1ms);
        }
        @keyframes card-appear {
          from {
            opacity: 1;
          }
          to {
            opacity: 1;
          }
        }
      }
    `,
  ];

  @property({ attribute: false }) cards: DriftEffectCard[] = [];
  @property({ attribute: false }) earnings: DriftEarnings | null = null;

  private _close(): void {
    this.dispatchEvent(new CustomEvent('cards-close', { bubbles: true, composed: true }));
  }

  /** The receipt: a deep link to the event this effect wrote, or to the Träger who now
   *  remembers you. No link for a self-fragment (it is in your own journal) or a filtered
   *  effect (nothing was written — and a link to nothing is a lie). */
  private _receipt(card: DriftEffectCard) {
    if (card.status !== 'applied') return '';
    const slug = card.simulation_slug;
    if (!slug) return '';
    // The agent route resolves by SLUG (AgentService.get_by_slug) — an id in that position
    // silently lands on the agents list, which is why the card now carries agent_slug.
    if (card.target_kind === 'agent' && card.agent_slug) {
      return html`<a class="card__link" href="/simulations/${slug}/agents/${card.agent_slug}">
        ${icons.externalLink(12)} <span>${msg('Beleg ansehen')}</span>
      </a>`;
    }
    if (card.event_id) {
      return html`<a class="card__link" href="/simulations/${slug}/events/${card.event_id}">
        ${icons.externalLink(12)} <span>${msg('Beleg ansehen')}</span>
      </a>`;
    }
    return '';
  }

  private _cardIcon(card: DriftEffectCard) {
    if (card.status === 'filtered') return icons.lock(14);
    switch (card.kind) {
      case 'emit_echo':
        return icons.antenna(14);
      case 'inject_agent_memory':
        return icons.brain(14);
      case 'spawn_event':
        return icons.bolt(14);
      default:
        return icons.bookmark(14);
    }
  }

  /** Called by the view when the report opens. The sheet is a report, not a decision, so the
   *  first thing the traveller should land on is the way out (Escape works too) — reading
   *  order stays natural because the close control is the sheet's last element. */
  focusFirst(): void {
    const target =
      this.renderRoot.querySelector<HTMLElement>('button:not([disabled])') ??
      this.renderRoot.querySelector<HTMLElement>('.sheet');
    target?.focus();
  }

  protected render() {
    const applied = this.cards.filter((c) => c.status === 'applied').length;
    const e = this.earnings;

    return html`
      <div class="sheet" role="dialog" aria-label=${msg('Wirkungsbericht')} tabindex="-1">
        <p class="sheet__eyebrow">${msg('Bureau für Zwischenraumfragen')}</p>
        <h2 class="sheet__title">${msg('Wirkungsbericht')}</h2>

        ${
          e
            ? html`<div class="earnings">
                <span class="earnings__item">
                  <span class="earnings__label">${msg('Siegel')}</span> +${e.siegel_earned}
                </span>
                <span class="earnings__item">
                  <span class="earnings__label">${msg('VP')}</span> +${e.vp_earned}
                </span>
              </div>`
            : ''
        }

        ${
          this.cards.length
            ? html`<div class="cards">
                ${this.cards.map(
                  (card, i) => html`
                    <div
                      class="card ${card.status === 'filtered' ? 'card--filtered' : ''}"
                      style="--i:${i}"
                    >
                      <span class="card__icon" aria-hidden="true">${this._cardIcon(card)}</span>
                      <div class="card__body">
                        <span class="card__kind">${kindLabel(card.kind)}</span>
                        ${
                          card.status === 'applied'
                            ? html`<p class="card__target">
                                ${
                                  card.target_kind === 'self'
                                    ? msg('In deinem Journal verzeichnet.')
                                    : msg(str`${card.target_label} hat es aufgenommen.`)
                                }
                              </p>`
                            : html`<p class="card__target">
                                  <velg-redacted label=${card.reason ?? msg('gefiltert')}
                                    >${card.target_label}</velg-redacted
                                  >
                                </p>
                                <p class="card__reason">${reasonLabel(card.reason)}</p>`
                        }
                        ${this._receipt(card)}
                      </div>
                    </div>
                  `,
                )}
              </div>`
            : html`<p class="empty">
                ${msg('Keine Wirkung verzeichnet. Die Welt blieb, wie sie war.')}
              </p>`
        }

        <button class="btn btn--primary btn--sm" @click=${this._close}>
          ${applied > 0 ? msg(str`Akte schließen (${applied} verzeichnet)`) : msg('Akte schließen')}
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-drift-effect-cards': VelgDriftEffectCards;
  }
}
