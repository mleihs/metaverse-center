/**
 * Die Bühne — der oberste Abschnitt des Operativen Terminals.
 *
 * Sie beantwortet die eine Frage, die der Entwurf ganz nach oben stellt: was ist
 * als Nächstes zu tun, und wie lange bleibt dafür Zeit.
 *
 * ⚠ DER COUNTDOWN HAT AUF PROD KEINEN GEGENSTAND — UND DAS WIRD GEZEIGT
 *
 * Der Entwurf setzt eine laufende Uhr voraus. Gemessen am 31.08.2026: NULL von
 * SIEBEN Epochen tragen eine `cycle_deadline_at`. Das ist kein fehlendes Feld —
 * die Spalte gibt es seit Migration 204, es gibt drei Schreiber, einen Leser,
 * und der Zeitgeber läuft in `app.py`. Es fehlt der Gegenstand: jede Epoche
 * steht still, seit BEVOR es die Spalte gab (jüngste Bewegung 20.03., Spalte
 * 13.04.), und der Übergang, der die Frist setzt, greift zusätzlich nur bei
 * `auto_resolve_mode != "manual"`.
 *
 * Ein Countdown, der in diesem Fall "00:00:00" zeigt, wäre eine Lüge in
 * Ziffern — er behauptete, die Zeit sei abgelaufen. Die Bühne zeigt stattdessen
 * die Zyklusposition und sagt, dass keine Uhr läuft. Sobald eine Epoche wieder
 * durch ihren Übergang geht, tickt derselbe Aufbau ohne Änderung.
 *
 * ⚠ "ORDERS PLACED 1/3" GIBT ES NICHT
 *
 * Der Entwurf zeigt einen Zähler mit Nenner. Messbar ist ausschließlich
 * `has_acted_this_cycle`, ein Ja/Nein aus `epoch_participants`. Genau das steht
 * hier. Ein erfundener Nenner wäre dieselbe Sorte Behauptung wie die "47 worlds"
 * des Frontseiten-Entwurfs, aus denen gemessen 16 wurden.
 *
 * DAS BÜHNENBILD IST DIE EIGENE WELT
 *
 * Dem Paket liegt ein Standbild bei. Gemessen tragen aber alle 20 Epochen-Klone
 * auf Prod ein `banner_url`. Die Bühne zeigt deshalb die Welt, in der wirklich
 * gespielt wird — das ist kein Mehraufwand, sondern weniger: ein Bild weniger im
 * Bündel und eine Aussage mehr im Bild.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { ActiveEpochParticipation } from '../../types/index.js';
import { navigate } from '../../utils/navigation.js';
import { buttonStyles } from '../shared/button-styles.js';
import { stageStyles } from '../shared/stage-styles.js';

/** Wie oft die Uhr nachrechnet. Eine Sekunde ist die feinste Angabe, die der
 *  Entwurf zeigt; feiner wäre Rechenarbeit ohne Aussage. */
const TICK_MS = 1000;

/** Mehr Segmente als das trägt keine Leiste mehr lesbar. Eine 14-Tage-Epoche mit
 *  Achtstundenzyklen hat 42 — die passen, weil die Segmente mitschrumpfen; bei
 *  einer sehr langen Epoche wird stattdessen nur die Zahl genannt. */
const MAX_SEGMENTS = 60;

@localized()
@customElement('velg-dashboard-stage')
export class VelgDashboardStage extends LitElement {
  static styles = [
    buttonStyles,
    stageStyles,
    css`
      :host {
        /* Tier 3 - alles aus Tier 1/2 abgeleitet, kein eigener Farbwert. */
        --_veil-left: color-mix(in srgb, var(--color-surface-sunken) 96%, transparent);
        --_veil-right: color-mix(in srgb, var(--color-surface-sunken) 20%, transparent);
        --_veil-top: color-mix(in srgb, var(--color-surface-sunken) 62%, transparent);
        --_veil-bottom: color-mix(in srgb, var(--color-surface-sunken) 55%, transparent);
        --_scanline: color-mix(in srgb, var(--color-surface) 12%, transparent);
        --_segment-todo: color-mix(in srgb, var(--color-text-primary) 8%, var(--color-surface));

        display: block;
        position: relative;
        overflow: hidden;
        background: var(--color-surface-sunken);
        border-bottom: var(--border-width-thin) solid var(--color-border-light);
      }

      /* ── Die Bildebenen. Alle randlos: sie haengen am Host, nicht am
         Behaelter, und spannen deshalb ueber den ganzen Sichtbereich. ── */
      .art,
      .veil,
      .scan {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }

      .art {
        background-position: center 42%;
        background-size: cover;
        filter: brightness(0.75);
        animation: kenburns 32s ease-in-out infinite alternate;
      }

      .veil--side {
        background: linear-gradient(94deg, var(--_veil-left) 24%, var(--_veil-right) 100%);
      }

      .veil--edge {
        background: linear-gradient(
          180deg,
          var(--_veil-top),
          transparent 32%,
          transparent 58%,
          var(--_veil-bottom)
        );
      }

      .scan {
        background: repeating-linear-gradient(
          0deg,
          transparent,
          transparent 3px,
          var(--_scanline) 3px,
          var(--_scanline) 6px
        );
      }

      @keyframes kenburns {
        from {
          transform: scale(1);
        }
        to {
          transform: scale(1.07);
        }
      }

      /* ── Inhalt ─────────────────────────────────────────────────────── */
      .body {
        position: relative;
        padding-block: var(--space-14) var(--space-12);
      }

      .rise {
        animation: rise var(--duration-slower) var(--ease-dramatic) both;
      }

      .rise--1 {
        animation-delay: 100ms;
      }

      .rise--2 {
        animation-delay: 250ms;
      }

      @keyframes rise {
        from {
          opacity: 0;
          transform: translateY(22px);
        }
        to {
          opacity: 1;
          transform: none;
        }
      }

      .kicker {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        margin: 0 0 var(--space-4);
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-xs);
        letter-spacing: var(--tracking-widest);
        text-transform: var(--label-transform);
        color: var(--color-accent-amber);
      }

      .kicker::before {
        content: '';
        width: 22px;
        height: 1px;
        background: var(--color-accent-amber);
        flex: 0 0 auto;
      }

      .clock {
        margin: 0;
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-display-sm);
        line-height: 1;
        letter-spacing: var(--tracking-tight);
        font-variant-numeric: tabular-nums;
        color: var(--color-text-primary);
      }

      /* Ohne laufende Uhr steht hier eine Aussage statt einer Zahl. Sie ist
         ruhiger gesetzt, damit die Bühne nicht so tut, als sei etwas dringend.

         Und weil es ein SATZ ist, folgt er --heading-transform, nicht
         --label-transform. Ein Etikett ist ein Wort über einem Wert; hier steht
         kein Wert, sondern die Auskunft, dass keiner läuft. Auf dem Phosphor-
         Skin ändert das nichts (beide Tokens stehen dort auf uppercase), auf
         Papier hätte dieser eine Satz sonst versal in einer Ansicht gestanden,
         in der jede Überschrift klein gesetzt ist — der einzige geschriene Satz
         der Seite, und ausgerechnet der ruhigste. */
      .clock--idle {
        color: var(--color-text-secondary);
        font-size: var(--text-2xl);
        letter-spacing: var(--tracking-brutalist);
        text-transform: var(--heading-transform);
      }

      .clock__note {
        margin: var(--space-2) 0 0;
        max-width: 62ch;
        font-family: var(--font-body);
        font-size: var(--text-sm);
        line-height: var(--leading-snug);
        color: var(--color-text-quiet);
      }

      .bottom {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        gap: var(--space-12);
        margin-top: var(--space-10);
      }

      /*
       * Im Leerzustand steht links nichts, also gibt es nichts auszugleichen.
       *
       * space-between verteilt zwei Dinge auf die Bandbreite. Im laufenden
       * Einsatz sind das zwei: „RP 18 / 36" links, „Befehle erteilen" rechts.
       * Ohne Einsatz stand links ein leeres <div>, das nur da war, um den Knopf
       * an die rechte Kante zu schieben — auf 1585 px allein am anderen Ende
       * eines Bandes, dessen Text bei 480 px endet.
       *
       * Ein Ausgleichsgewicht fuer nichts ist keine Ausrichtung. Der Knopf
       * gehoert unter den Satz, auf den er antwortet.
       */
      .bottom--idle {
        justify-content: flex-start;
      }

      .epoch__name {
        margin: 0;
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: calc(var(--text-xl) * var(--stage-type-scale, 1));
        letter-spacing: var(--tracking-brutalist);
        text-transform: var(--heading-transform);
        color: var(--color-text-primary);
      }

      .epoch__facts {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: var(--space-2) var(--space-3);
        margin: var(--space-2) 0 0;
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        letter-spacing: var(--tracking-wider);
        color: var(--color-text-secondary);
      }

      /* Zusammengehoerende Angaben duerfen nicht mitten im Wert umbrechen. */
      .fact {
        white-space: nowrap;
      }

      .fact--open {
        color: var(--color-accent-amber);
      }

      .fact--done {
        color: var(--color-accent-green);
      }

      .segments {
        display: grid;
        gap: 2px;
        margin-top: var(--space-4);
        max-width: 420px;
      }

      .segment {
        height: 8px;
        background: var(--_segment-todo);
      }

      .segment--done {
        background: var(--color-accent-amber);
      }

      .segment--now {
        background: transparent;
        border: var(--border-width-thin) solid var(--color-accent-amber);
        animation: segment-pulse 2.4s ease-in-out infinite;
      }

      @keyframes segment-pulse {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.4;
        }
      }

      .actions {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: var(--space-3);
        flex: 0 0 auto;
      }

      .link {
        background: none;
        border: 0;
        padding: 0;
        cursor: pointer;
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-xs);
        letter-spacing: var(--tracking-wider);
        text-transform: var(--label-transform);
        color: var(--color-text-quiet);
        transition: color var(--transition-fast);
      }

      .link:hover,
      .link:focus-visible {
        color: var(--color-accent-amber);
      }

      @media (max-width: 900px) {
        .bottom {
          flex-direction: column;
          align-items: flex-start;
          gap: var(--space-6);
        }

        .actions {
          align-items: flex-start;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .art,
        .rise,
        .segment--now {
          animation: none;
        }

        .rise {
          opacity: 1;
          transform: none;
        }
      }
    `,
  ];

  /** Die Epoche, die als Nächstes etwas verlangt. `null` heisst: keine. */
  @property({ attribute: false }) participation: ActiveEpochParticipation | null = null;

  @state() private _remainingMs = 0;

  private _timer: number | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this._startClock();
  }

  disconnectedCallback(): void {
    this._stopClock();
    super.disconnectedCallback();
  }

  protected updated(changed: Map<string, unknown>): void {
    if (changed.has('participation')) this._startClock();
  }

  /** Die Uhr laeuft nur, wenn es etwas zu zaehlen gibt. Ein Intervall fuer eine
   *  Epoche ohne Frist waere Arbeit ohne Gegenstand — und auf Prod der Regelfall. */
  private _startClock(): void {
    this._stopClock();
    const deadline = this.participation?.cycle_deadline_at;
    if (!deadline) {
      this._remainingMs = 0;
      return;
    }
    const tick = () => {
      this._remainingMs = Math.max(0, new Date(deadline).getTime() - Date.now());
      if (this._remainingMs === 0) this._stopClock();
    };
    tick();
    this._timer = window.setInterval(tick, TICK_MS);
  }

  private _stopClock(): void {
    if (this._timer !== null) {
      window.clearInterval(this._timer);
      this._timer = null;
    }
  }

  private _formatted(): string {
    const total = Math.floor(this._remainingMs / 1000);
    const h = String(Math.floor(total / 3600)).padStart(2, '0');
    const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
    const s = String(total % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  protected render() {
    const p = this.participation;
    if (!p) return this._renderIdle();

    const running = Boolean(p.cycle_deadline_at) && this._remainingMs > 0;
    const art = p.simulation_banner_url;

    return html`
      ${art ? html`<div class="art" style="background-image: url('${art}')"></div>` : nothing}
      <div class="veil veil--side"></div>
      <div class="veil veil--edge"></div>
      <div class="scan"></div>

      <div class="body stage-container">
        <p class="kicker rise">
          ${
            running
              ? msg(str`Priority // Cycle ${p.current_cycle} resolves in`)
              : msg(str`Priority // Cycle ${p.current_cycle} of ${p.total_cycles}`)
          }
        </p>
        ${
          running
            ? html`<p
                class="clock rise rise--1"
                role="timer"
                aria-live="off"
                aria-label=${msg(str`${Math.floor(this._remainingMs / 3600000)} hours left in this cycle`)}
              >
                ${this._formatted()}
              </p>`
            : html`
                <p class="clock clock--idle rise rise--1">${msg('No cycle clock running')}</p>
                <p class="clock__note rise rise--1">
                  ${msg('This epoch has no cycle deadline set, so nothing is counting down. The cycle advances when the epoch is resolved.')}
                </p>
              `
        }

        <div class="bottom rise rise--2">
          <div>
            <h2 class="epoch__name">${p.epoch_name}</h2>
            <p class="epoch__facts">
              <span class="fact">${p.simulation_name}</span>
              <span class="fact">${msg(str`RP ${p.current_rp} / ${p.rp_cap}`)}</span>
              ${
                p.has_acted_this_cycle
                  ? html`<span class="fact fact--done">${msg('Acted this cycle')}</span>`
                  : html`<span class="fact fact--open">${msg('Not acted this cycle')}</span>`
              }
            </p>
            ${this._renderSegments(p)}
          </div>
          <div class="actions">
            <button class="btn btn--primary" @click=${() => navigate('/epoch')}>
              ${msg('Enter War Room')}
            </button>
            <button class="link" @click=${() => navigate('/epoch')}>
              ${msg('Review standing orders')}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /** Die Zyklusleiste. Sie zeigt, WO man steht — auch ohne laufende Uhr, denn
   *  die Position ist bekannt, nur die Restzeit nicht. */
  private _renderSegments(p: ActiveEpochParticipation) {
    const total = p.total_cycles;
    if (total <= 0 || total > MAX_SEGMENTS) return nothing;
    const cells = [];
    for (let i = 1; i <= total; i++) {
      const cls =
        i < p.current_cycle ? 'segment--done' : i === p.current_cycle ? 'segment--now' : '';
      cells.push(html`<span class="segment ${cls}"></span>`);
    }
    return html`<div
      class="segments"
      style="grid-template-columns: repeat(${total}, 1fr)"
      role="img"
      aria-label=${msg(str`Cycle ${p.current_cycle} of ${total}`)}
    >
      ${cells}
    </div>`;
  }

  /** Kein laufender Einsatz. Kein Bild, keine Uhr, keine erfundene Dringlichkeit. */
  private _renderIdle() {
    return html`
      <div class="body stage-container">
        <p class="kicker">${msg('Priority // No active operation')}</p>
        <p class="clock clock--idle">${msg('Nothing requires you')}</p>
        <p class="clock__note">
          ${msg('You are not taking part in any running epoch. Join one, or keep building your worlds.')}
        </p>
        <div class="bottom bottom--idle">
          <div class="actions">
            <button class="btn btn--primary" @click=${() => navigate('/epoch')}>
              ${msg('Browse epochs')}
            </button>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-dashboard-stage': VelgDashboardStage;
  }
}
