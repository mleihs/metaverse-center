/**
 * Kammer ④ — der Nachhall.
 *
 * Dritter Teil von Schritt 6. Die drei anderen Kammern zeigen, wo ein Signal
 * gerade STEHT; diese zeigt, was es ANGERICHTET hat, nachdem es die Schleuse
 * verlassen hat. Sie ist die einzige Kammer, in der nichts mehr zu entscheiden
 * ist — man liest nur nach.
 *
 * ── WAS SIE ZEIGT, UND WAS SIE NICHT ZEIGEN KANN ────────────────────────────
 *
 * Der Bauplan nennt drei Quellen. Auf Prod am 02.09.2026 gezählt:
 *
 *     resonance_impacts    14 Zeilen (aus EINER Resonanz)   ← gebaut
 *     event_echoes          0 Zeilen                        ← hat nie existiert
 *     Reaktions-Events      kein eigener Filter             ← nicht gebaut
 *
 * **`event_echoes` ist leer, und zwar nicht „gerade eben", sondern immer
 * gewesen.** Eine Zeile für „Echo · unterwegs nach X" zu bauen hiesse, eine
 * Anzeige zu schreiben, deren Zustand in dieser Datenbank noch nie entstanden
 * ist. Das ist die Prüffrage aus [[a-door-that-only-opens-for-those-inside]]:
 * nicht „gibt es eine UI", sondern „kann der Zustand, den sie anzeigt,
 * überhaupt entstehen". Die Kammer sagt es deshalb als Satz, statt einen
 * leeren Abschnitt zu zeigen.
 *
 * ── WARUM SIE HEUTE TROTZDEM LEER IST, UND DAS RICHTIG SO IST ───────────────
 *
 * Die 14 Impacts gehören zu einer Resonanz, die NICHT aus der Schleuse kam
 * (`news_scan_candidates` hat 0 Zeilen mit `status='approved'`). Die Kammer
 * zeigt den Nachhall DER SIGNALE, DIE HIER DURCHGEGANGEN SIND — sie greift
 * sich nicht fremde Resonanzen, nur weil deren Daten greifbar wären. Sobald
 * ein Admin die erste Resonanz aus der Quarantäne auslöst, füllt sie sich.
 *
 * 🔑 Eine leere Kammer, deren Leere stimmt, ist kein Mangel. Eine gefüllte,
 * die Fremdes einsammelt, damit sie nicht leer aussieht, wäre einer.
 */

import { localized, msg, str } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { resonanceApi } from '../../services/api/index.js';
import { intakeState } from '../../services/IntakeStateManager.js';
import { captureError } from '../../services/SentryService.js';
import type { ResonanceImpact } from '../../types/index.js';
import { isScanCandidate } from '../../types/intake.js';
import { intakeControlStyles } from './intake-styles.js';

/** Ein Nachhall-Eintrag: eine Wirkung mit ihrer Herkunft. */
interface AftermathEntry {
  id: string;
  kind: 'impact' | 'skipped';
  /** Der Weltname, in dem die Wirkung eintrat. */
  where: string;
  /** Der Titel des Signals, aus dem sie kam. */
  origin: string;
  effective: number;
  narrative?: string;
}

@localized()
@customElement('velg-intake-aftermath-chamber')
export class VelgIntakeAftermathChamber extends SignalWatcher(LitElement) {
  static styles = [
    intakeControlStyles,
    css`
      :host {
        display: contents;
      }

      .entry {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        padding: var(--space-2) var(--space-2-5);
        border: var(--border-width-thin) solid var(--color-border-light);
        animation: entry-in var(--duration-entrance) var(--ease-dramatic) backwards;
        animation-delay: calc(var(--i, 0) * var(--duration-stagger));
      }

      @keyframes entry-in {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      .entry__kind {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        letter-spacing: var(--tracking-wider);
        text-transform: uppercase;
      }

      .entry__kind--impact {
        color: var(--color-accent-amber-readable);
      }

      .entry__kind--skipped {
        color: var(--color-text-muted);
      }

      .entry__text {
        font-family: var(--font-prose);
        font-size: var(--text-sm);
        line-height: var(--leading-snug);
        color: var(--color-text-secondary);
        margin: 0;
        text-wrap: pretty;
      }

      .entry__origin {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--color-text-tertiary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .empty {
        font-family: var(--font-prose);
        font-style: italic;
        font-size: var(--text-sm);
        color: var(--color-text-tertiary);
        margin: 0;
        text-wrap: pretty;
      }

      @media (prefers-reduced-motion: reduce) {
        .entry {
          animation-duration: 0.01ms;
        }
      }
    `,
  ];

  @state() private _entries: AftermathEntry[] = [];
  /** Resonanzen, deren Impacts schon geholt sind — je Kennung genau einmal. */
  private _loaded = new Set<string>();

  protected override updated(): void {
    void this._loadMissing();
  }

  /**
   * Die Impacts jeder freigegebenen Resonanz holen, die noch fehlt.
   *
   * `updated()` statt `connectedCallback`, weil die freigegebenen Signale erst
   * nach dem Laden des Scanners dastehen — und `_loaded` sorgt dafür, dass
   * daraus keine Schleife wird: jede Kennung wird genau einmal geholt, auch
   * wenn der Aufruf nichts liefert.
   */
  private async _loadMissing(): Promise<void> {
    const mode = appState.isAuthenticated.value ? 'member' : 'public';

    for (const signal of intakeState.released.value) {
      if (signal.stage !== 'res') continue;
      if (!isScanCandidate(signal.raw)) continue;
      const resonanceId = signal.raw.resonance_id;
      if (!resonanceId || this._loaded.has(resonanceId)) continue;

      this._loaded.add(resonanceId);
      try {
        const resp = await resonanceApi.listImpacts(resonanceId, mode);
        if (!resp.success || !resp.data) continue;
        this._entries = [
          ...this._entries,
          ...resp.data.map((i) => this._toEntry(i, signal.headline)),
        ];
      } catch (err) {
        captureError(err, { source: 'VelgIntakeAftermathChamber._loadMissing' });
      }
    }
  }

  private _toEntry(impact: ResonanceImpact, origin: string): AftermathEntry {
    return {
      id: impact.id,
      kind: impact.status === 'skipped' ? 'skipped' : 'impact',
      where: impact.simulation_name ?? impact.simulation_id,
      origin,
      effective: impact.effective_magnitude,
      narrative: impact.narrative_context,
    };
  }

  protected render() {
    if (this._entries.length === 0) {
      return html`
        <p class="empty">
          ${msg(
            'No aftermath yet. It appears once a resonance from quarantine has reached the worlds.',
          )}
        </p>
        <p class="empty">
          ${msg(
            'Echoes are not listed here: the platform has never recorded one, so a line for them would show a state that has not existed yet.',
          )}
        </p>
      `;
    }

    return html`
      ${this._entries.map(
        (e, i) => html`
          <article class="entry" style="--i: ${i}">
            <span class="entry__kind entry__kind--${e.kind}">
              ${
                e.kind === 'skipped'
                  ? msg(str`Impact · ${e.where} · skipped`)
                  : msg(str`Impact · ${e.where} · ${e.effective.toFixed(2)}`)
              }
            </span>
            ${e.narrative ? html`<p class="entry__text">${e.narrative}</p>` : nothing}
            <span class="entry__origin">${msg(str`from: ${e.origin}`)}</span>
          </article>
        `,
      )}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-intake-aftermath-chamber': VelgIntakeAftermathChamber;
  }
}
