/**
 * Die Quarantäne-Karte — hier wird über ein Signal entschieden.
 *
 * Schritt 4 aus `handoff/schleuse-event-intake.md`, Kammer ②. Es ist die
 * einzige Karte der Schleuse, auf der etwas Unumkehrbares passieren kann, und
 * sie ist deshalb die einzige mit vollem Bernstein-Rahmen.
 *
 * ── DREI AUSGÄNGE, UND SIE SIND NICHT GLEICHWERTIG ──────────────────────────
 *
 *   ▣ nur hier   → ein Ereignis DIESER Welt (integrateArticle) · zählt auf die
 *                  Tagesquote · der gewöhnliche Weg
 *   ◈ Resonanz   → trifft ALLE Welten · nur Admin · Halte-Knopf · unumkehrbar
 *   ◈ Melden     → legt dem Bureau vor · nur Architekt · entscheidet nichts
 *
 * Ein Architekt sieht NIE den Resonanz-Knopf, ein Admin NIE den Melden-Knopf.
 * Das ist keine Bequemlichkeit, sondern die Rollentrennung selbst: wer eine
 * Resonanz auslösen kann, hat nichts zu melden, und wer meldet, entscheidet
 * nicht über andere Welten.
 *
 * ── WARUM DIE SUSZEPTIBILITÄTSTAFEL NICHT AUF DER KARTE STEHT ───────────────
 *
 * Der Bauplan setzt sie in die linke Hälfte der Admin-Karte. Nachgemessen
 * kostet sie einen RPC PRO WELT und PRO KARTE: bei sechs Welten und fünf
 * Karten sind das dreissig Datenbankaufrufe, nur damit ein Board zeichnet.
 * Sie steht deshalb im Resonanz-Modal — an der Stelle, an der die Zahl eine
 * Entscheidung trägt, statt an der, an der sie hübsch aussieht. Die linke
 * Hälfte sagt stattdessen, WAS der jeweiligen Rolle offensteht; das
 * unterscheidet die beiden Sichten genauso deutlich und kostet nichts.
 */

import { localized, msg, str } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { socialTrendsApi } from '../../services/api/index.js';
import { intakeState } from '../../services/IntakeStateManager.js';
import { captureError } from '../../services/SentryService.js';
import { CATEGORY_RESONANCE, type IntakeSignal, transformRequestOf } from '../../types/intake.js';
import { icons } from '../../utils/icons.js';
import { taxonomyLabel } from '../../utils/taxonomy-label.js';
import { VelgToast } from '../shared/Toast.js';
import { archetypeLabel, impactWord } from './intake-labels.js';
import { intakeControlStyles } from './intake-styles.js';

@localized()
@customElement('velg-intake-quarantine-card')
export class VelgIntakeQuarantineCard extends SignalWatcher(LitElement) {
  static styles = [
    intakeControlStyles,
    css`
      /*
       * Der volle Rahmen in Bernstein, nicht ein Balken an einer Kante. Die
       * Karte ist klein genug, dass der ganze Rahmen sie trägt, und ein
       * Kantenbalken ist im Haus verboten (lint-no-accent-edge-bar.sh).
       */
      :host {
        display: block;
        border: var(--border-width-thin) solid var(--color-accent-amber);
        background: var(--color-surface-raised);
        box-shadow: var(--shadow-md);
        container-type: inline-size;
      }

      .head {
        display: flex;
        align-items: baseline;
        gap: var(--space-2);
        flex-wrap: wrap;
        padding: var(--space-2) var(--space-3);
        border-block-end: var(--border-width-thin) solid var(--color-border-light);
      }

      .head__spacer {
        margin-inline-start: auto;
      }

      .arch {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        letter-spacing: var(--tracking-wider);
        text-transform: var(--label-transform);
        color: var(--color-accent-amber-readable);
      }

      .original {
        font-family: var(--font-prose);
        font-size: var(--text-sm);
        line-height: var(--leading-snug);
        color: var(--color-text-secondary);
        margin: 0;
        padding: var(--space-2-5) var(--space-3);
        text-wrap: pretty;
      }

      .halves {
        display: grid;
        grid-template-columns: 1fr 1fr;
        border-block-start: var(--border-width-thin) solid var(--color-border-light);
      }

      .half {
        padding: var(--space-2-5) var(--space-3);
        min-inline-size: 0;
      }

      .half + .half {
        border-inline-start: var(--border-width-thin) solid var(--color-border-light);
      }

      .half__title {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        letter-spacing: var(--tracking-wider);
        text-transform: var(--label-transform);
        color: var(--color-text-muted);
        margin: 0 0 var(--space-1-5);
      }

      .half__title--event {
        color: var(--color-accent-green);
      }

      .proposal {
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-xs);
        letter-spacing: var(--tracking-brutalist);
        text-transform: var(--label-transform);
        color: var(--color-text-primary);
        line-height: var(--leading-snug);
        margin: 0 0 var(--space-1);
        text-wrap: pretty;
      }

      .acts {
        display: flex;
        align-items: stretch;
        gap: var(--space-1-5);
        padding: var(--space-2) var(--space-3);
        border-block-start: var(--border-width-thin) solid var(--color-border-light);
        flex-wrap: wrap;
      }

      .acts .act {
        padding: var(--space-2) var(--space-2-5);
      }

      .acts__grow {
        flex: 1 1 0;
        min-inline-size: 0;
      }

      /* Unter 360 wird die Karte zur Spalte: zwei Hälften nebeneinander sind
         auf einer schmalen Kammer zwei unlesbare Streifen. */
      @container (max-width: 360px) {
        .halves {
          grid-template-columns: 1fr;
        }
        .half + .half {
          border-inline-start: none;
          border-block-start: var(--border-width-thin) solid var(--color-border-light);
        }
        .acts__grow {
          flex-basis: 100%;
        }
      }
    `,
  ];

  /** Das Signal. Als Objekt hereingereicht — die Kammer hat es bereits. */
  @property({ type: Object }) signal: IntakeSignal | null = null;

  @property({ type: String }) simulationId = '';

  @state() private _busy = false;

  private _emit(name: string): void {
    if (!this.signal) return;
    this.dispatchEvent(
      new CustomEvent(name, {
        bubbles: true,
        composed: true,
        detail: { signalId: this.signal.id },
      }),
    );
  }

  /**
   * „Nur hier" — aus dem Vorschlag wird ein Ereignis DIESER Welt.
   *
   * Erst der Aufruf, dann die Stufe. Ein Signal, das lokal als Ereignis
   * dasteht, während `integrate-article` gescheitert ist, behauptet etwas über
   * die Welt, das dort niemand findet.
   */
  private async _admit(): Promise<void> {
    const signal = this.signal;
    if (!signal?.proposal || !signal.lens || this._busy) return;
    if (intakeState.quotaReached.value) return;

    this._busy = true;
    const { proposal, lens } = signal;
    const article = transformRequestOf(signal);

    try {
      const resp = await socialTrendsApi.integrateArticle(this.simulationId, {
        title: proposal.title,
        description: proposal.body,
        event_type: lens.type || undefined,
        impact_level: lens.impact,
        tags: [signal.source, 'intake'],
        generate_reactions: lens.react,
        max_reaction_agents: lens.n,
        source_article: {
          name: article.article_name,
          platform: article.article_platform,
          url: article.article_url,
          raw_data: article.article_raw_data,
        },
      });

      if (!resp.success || !resp.data) {
        const message = resp.error?.message ?? msg('The event was not created.');
        VelgToast.error(message);
        return;
      }

      intakeState.toEvent(signal.id);
      const count = resp.data.reactions_count;
      if (count > 0) {
        VelgToast.success(msg(str`"${proposal.title}" is in the world · ${count} agents answered`));
      } else {
        VelgToast.success(msg(str`"${proposal.title}" is in the world`));
      }
      this._emit('intake-admitted');
    } catch (err) {
      captureError(err, { source: 'VelgIntakeQuarantineCard._admit' });
      VelgToast.error(err instanceof Error ? err.message : msg('The event was not created.'));
    } finally {
      this._busy = false;
    }
  }

  private _discard(): void {
    if (!this.signal) return;
    intakeState.discard(this.signal.id);
    this._emit('intake-discarded');
  }

  /** Die linke Hälfte: was der Rolle offensteht, nicht was sie sieht. */
  private _renderFate() {
    const admin = intakeState.role.value === 'admin';
    if (admin) {
      return html`
        <div class="half">
          <h4 class="half__title">${msg('Resonance · every world')}</h4>
          <p class="prose">
            ${msg(
              'A resonance leaves this world and weighs itself against each of the others. The table of what it would do to them is in the dispatch, behind the button.',
            )}
          </p>
        </div>
      `;
    }
    return html`
      <div class="half">
        <h4 class="half__title">${msg('Report · the Bureau decides')}</h4>
        <p class="prose">
          ${msg(
            'Whether every world feels this is not yours to decide. You can put it in front of the Bureau, and take it as an event of your own world either way.',
          )}
        </p>
      </div>
    `;
  }

  /** Die rechte Hälfte: was aus dem Signal in DIESER Welt würde. */
  private _renderEvent(signal: IntakeSignal) {
    const lens = signal.lens;
    const proposal = signal.proposal;
    if (!lens || !proposal) {
      return html`
        <div class="half">
          <h4 class="half__title half__title--event">${msg('As an event · only here')}</h4>
          <p class="prose prose--quiet">
            ${msg('No lens has been set. Open the crucible to give it one.')}
          </p>
        </div>
      `;
    }

    const zone = intakeState.zoneName(lens.zone);
    const kind = taxonomyLabel('event_type', lens.type);
    const parts = [zone, kind, msg(str`impact ${lens.impact}`), impactWord(lens.impact)];
    if (lens.react) parts.push(msg(str`${lens.n} reactions`));

    return html`
      <div class="half">
        <h4 class="half__title half__title--event">${msg('As an event · only here')}</h4>
        <p class="proposal">${proposal.title}</p>
        <span class="note">${parts.filter(Boolean).join(' · ')}</span>
      </div>
    `;
  }

  protected render() {
    const signal = this.signal;
    if (!signal) return nothing;

    const admin = intakeState.role.value === 'admin';
    const entry = signal.category ? CATEGORY_RESONANCE[signal.category] : null;
    const quotaReached = intakeState.quotaReached.value;
    const ready = Boolean(signal.proposal && signal.lens);

    let admitTitle = msg('Take it as an event of this world');
    if (quotaReached) admitTitle = msg('Daily quota reached');
    else if (!ready) admitTitle = msg('Needs a lens first');

    return html`
      <article>
        <header class="head">
          <span class="note">${msg('Original')} · ${signal.source}</span>
          <span class="head__spacer"></span>
          ${
            entry
              ? html`<span class="arch">
                  ${icons.resonanceArchetype(entry.signature, 11)}
                  ${archetypeLabel(entry.archetype)}
                </span>`
              : nothing
          }
          <span class="note">${signal.magnitude.toFixed(2)}</span>
        </header>

        <p class="original">${signal.headline}</p>

        <div class="halves">${this._renderFate()} ${this._renderEvent(signal)}</div>

        <div class="acts">
          ${
            admin
              ? html`<button
                  type="button"
                  class="act act--primary acts__grow"
                  @click=${() => this._emit('intake-raise-resonance')}
                >
                  ${msg('Resonance')}
                </button>`
              : html`<button
                  type="button"
                  class="act acts__grow"
                  @click=${() => this._emit('intake-flag')}
                >
                  ${msg('Report signal')}
                </button>`
          }
          <button
            type="button"
            class="act act--green acts__grow"
            title=${admitTitle}
            ?disabled=${!ready || quotaReached || this._busy}
            @click=${this._admit}
          >
            ${msg('Only here')}
          </button>
          <button type="button" class="act" @click=${() => this._emit('intake-edit-lens')}>
            ${msg('Lens')}
          </button>
          <button type="button" class="act" aria-label=${msg('Discard')} @click=${this._discard}>
            ${icons.close(11)}
          </button>
        </div>
      </article>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-intake-quarantine-card': VelgIntakeQuarantineCard;
  }
}
