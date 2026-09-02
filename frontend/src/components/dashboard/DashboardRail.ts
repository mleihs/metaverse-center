/**
 * Die rechte Schiene — Dossier, Substrat, Auszeichnungen.
 *
 * Drei Blöcke, die der Entwurf nebeneinanderstellt, weil sie dieselbe Frage aus
 * drei Richtungen beantworten: wer bin ich hier.
 *
 * WAS HIER NICHT NEU GEBAUT WIRD
 *
 * Die Dossierkarte ist `<velg-game-card>` — die TCG-Spezifikation
 * (`docs/explanations/tcg-card-system.md`) ist bereits umgesetzt, mit Neigung
 * bei Mausbewegung und Glanzlicht. Sie hier nachzubauen hiesse, dieselbe
 * Spezifikation ein zweites Mal zu pflegen; die zweite Fassung wäre in einem
 * halben Jahr die falsche.
 *
 * Die Auszeichnungen sind `<velg-achievement-summary-card>`. Das Bauteil holt
 * seine Zahlen selbst und kennt seinen eigenen Ladezustand. ⚠ Der Entwurf zeigt
 * „12/48" — gemessen gibt es **34 Definitionen**, nicht 48. Die Zahl kommt aus
 * dem Endpunkt, nicht aus dem Entwurf, und deshalb steht sie nirgends hier.
 *
 * WAS DER SUBSTRAT-MONITOR ZEIGT UND WAS NICHT
 *
 * Drei Resonanzzeilen mit Balken. Der Balken ist die **Stärke** (`magnitude`,
 * 1 bis 10) — eine gemessene Grösse, keine erfundene Auslastung. Der Punkt
 * davor trägt die Farbe des Zustands: bernstein, solange etwas stört
 * (`detected`, `impacting`), grün beim Abklingen.
 *
 * ⚠ Das ist genau die Unterscheidung, an der die alte Befehlsleiste
 * gescheitert ist: sie zählte JEDES Beben im Bestand und meldete ANOMAL,
 * während der Bannertext darunter korrekt Entwarnung gab. Ein abklingendes
 * Beben gehört in die Liste und nicht in die Warnung.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { Agent, Resonance } from '../../types/index.js';
import { icons } from '../../utils/icons.js';
import { t } from '../../utils/locale-fields.js';
import { navigate } from '../../utils/navigation.js';
import { stageStyles } from '../shared/stage-styles.js';
import '../platform/VelgAchievementSummaryCard.js';
import '../shared/VelgGameCard.js';
import { professionLabel } from '../../utils/profession.js';

/** Die grösste Stärke, die eine Resonanz tragen kann — der Balken misst dagegen. */
const MAX_MAGNITUDE = 10;

/** Wie viele Zeilen der Monitor zeigt (Entwurf: drei). */
const MONITOR_ROWS = 3;

/** Zustände, die das Substrat GERADE stören. Deckungsgleich mit dem, was der
 *  Rücken als `substrate_status = 'anomalous'` rechnet — die Regel steht dort,
 *  hier steht nur die Farbe dazu. */
const DISTURBING = new Set(['detected', 'impacting']);

@localized()
@customElement('velg-dashboard-rail')
export class VelgDashboardRail extends LitElement {
  static styles = [
    stageStyles,
    css`
      :host {
        --_rule: var(--color-border-light);

        display: flex;
        flex-direction: column;
        gap: var(--space-8);
        min-width: 0;
      }

      .block__head {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: var(--space-4);
        margin-bottom: var(--space-4);
      }

      .block__kicker {
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-xs);
        letter-spacing: var(--tracking-widest);
        text-transform: uppercase;
        color: var(--color-accent-amber);
      }

      .block__nav {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        flex: 0 0 auto;
      }

      .block__counter {
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-xs);
        letter-spacing: var(--tracking-wider);
        color: var(--color-text-quiet);
      }

      .nav-btn {
        width: 30px;
        height: 30px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: var(--border-width-thin) solid var(--_rule);
        background: transparent;
        color: var(--color-text-quiet);
        cursor: pointer;
        transition:
          color var(--transition-fast),
          border-color var(--transition-fast);
      }

      .nav-btn:hover,
      .nav-btn:focus-visible {
        color: var(--color-accent-amber);
        border-color: var(--color-accent-amber);
      }

      .dossier {
        display: flex;
        justify-content: center;
      }

      /* ── Substrat ───────────────────────────────────────────────────── */
      .monitor {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }

      .tremor {
        display: grid;
        grid-template-columns: 8px 1fr auto;
        align-items: center;
        gap: var(--space-3);
        min-width: 0;
      }

      .tremor__dot {
        width: 8px;
        height: 8px;
        border-radius: var(--border-radius-full);
        background: var(--color-accent-green);
      }

      .tremor__dot--live {
        background: var(--color-accent-amber);
      }

      .tremor__body {
        min-width: 0;
      }

      .tremor__name {
        display: block;
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        letter-spacing: var(--tracking-wide);
        color: var(--color-text-secondary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .tremor__track {
        margin-top: var(--space-1);
        height: 3px;
        background: color-mix(in srgb, var(--color-text-primary) 8%, var(--color-surface));
      }

      .tremor__fill {
        height: 100%;
        background: var(--color-accent-amber);
        transform-origin: left;
        animation: grow 900ms var(--ease-out) both;
        animation-delay: calc(var(--i, 0) * 150ms);
      }

      @keyframes grow {
        from {
          transform: scaleX(0);
        }
        to {
          transform: scaleX(1);
        }
      }

      .tremor__age {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--color-text-quiet);
        white-space: nowrap;
      }

      .empty {
        margin: 0;
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        letter-spacing: var(--tracking-wide);
        color: var(--color-text-quiet);
      }

      @media (prefers-reduced-motion: reduce) {
        .tremor__fill {
          animation: none;
        }
      }
    `,
  ];

  @property({ attribute: false }) agents: Agent[] = [];
  @property({ attribute: false }) resonances: Resonance[] = [];

  /** Welche Dossierkarte gezeigt wird. Läuft in beide Richtungen um. */
  @property({ type: Number }) selected = 0;

  private _step(delta: number): void {
    if (!this.agents.length) return;
    const n = this.agents.length;
    this.selected = (this.selected + delta + n) % n;
  }

  protected render() {
    return html`
      ${this._renderDossier()} ${this._renderMonitor()}
      <velg-achievement-summary-card></velg-achievement-summary-card>
    `;
  }

  private _renderDossier() {
    if (!this.agents.length) return nothing;
    const index = Math.min(this.selected, this.agents.length - 1);
    const agent = this.agents[index];
    const position = `${String(index + 1).padStart(2, '0')} / ${String(this.agents.length).padStart(2, '0')}`;

    return html`
      <section>
        <div class="block__head">
          <span class="block__kicker">${msg('Dossier // Operatives')}</span>
          <div class="block__nav">
            <span class="block__counter">${position}</span>
            <button class="nav-btn" @click=${() => this._step(-1)} aria-label=${msg('Previous operative')}>
              ${icons.chevronLeft(14)}
            </button>
            <button class="nav-btn" @click=${() => this._step(1)} aria-label=${msg('Next operative')}>
              ${icons.chevronRight(14)}
            </button>
          </div>
        </div>
        <div class="dossier">
          <velg-game-card
            type="agent"
            size="md"
            .name=${agent.name}
            image-url=${agent.portrait_image_url ?? ''}
            .subtitle=${professionLabel(t(agent, 'profession'))}
            @click=${() => navigate(`/simulations/${agent.simulation_id}/agents/${agent.slug}`)}
          ></velg-game-card>
        </div>
      </section>
    `;
  }

  private _renderMonitor() {
    const rows = this.resonances.slice(0, MONITOR_ROWS);
    return html`
      <section>
        <div class="block__head">
          <span class="block__kicker">${msg('Substrate Monitor')}</span>
        </div>
        ${
          rows.length
            ? html`<div class="monitor">${rows.map((r, i) => this._renderTremor(r, i))}</div>`
            : html`<p class="empty">${msg('No tremors on record')}</p>`
        }
      </section>
    `;
  }

  private _renderTremor(tremor: Resonance, index: number) {
    const live = DISTURBING.has(tremor.status);
    const share = Math.max(0, Math.min(1, (tremor.magnitude ?? 0) / MAX_MAGNITUDE));
    return html`
      <div class="tremor" style="--i: ${index}">
        <span class="tremor__dot ${live ? 'tremor__dot--live' : ''}" aria-hidden="true"></span>
        <span class="tremor__body">
          <span class="tremor__name">${tremor.title}</span>
          <span class="tremor__track">
            <span class="tremor__fill" style="width: ${(share * 100).toFixed(0)}%"></span>
          </span>
        </span>
        <span class="tremor__age">${msg(str`M${tremor.magnitude ?? 0}`)}</span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-dashboard-rail': VelgDashboardRail;
  }
}
