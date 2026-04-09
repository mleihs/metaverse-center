/**
 * VelgBroadsheetGazetteWire — Sidebar wire feed of cross-simulation echoes.
 *
 * Displays the latest gazette entries (intercepted transmissions from
 * neighbouring realities) in a compact sidebar format. Each entry shows
 * the echo type, narrative, and source/target simulation.
 *
 * @element velg-broadsheet-gazette-wire
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { getDateLocale } from '../../utils/date-format.js';
import { dispatchStyles } from '../shared/dispatch-styles.js';

interface GazetteWireEntry {
  entry_type: string;
  narrative: string;
  source_simulation?: { name?: string; slug?: string } | null;
  target_simulation?: { name?: string; slug?: string } | null;
  echo_vector?: string;
  strength?: number;
  created_at: string;
}

@localized()
@customElement('velg-broadsheet-gazette-wire')
export class VelgBroadsheetGazetteWire extends LitElement {
  static styles = [
    dispatchStyles,
    css`
      :host {
        display: block;
      }

      .wire {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }

      .wire__heading {
        font-family: var(--font-brutalist);
        font-weight: var(--font-black);
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        color: var(--color-text-muted);
        padding-bottom: var(--space-1);
        border-bottom: 1px dashed var(--color-border-light);
        margin: 0;
      }

      .wire__entry {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        padding-bottom: var(--space-2);
        border-bottom: 1px solid var(--color-border-light);
        opacity: 0;
        animation: wire-enter var(--duration-entrance) var(--ease-dramatic) forwards;
        animation-delay: calc(var(--i, 0) * var(--duration-stagger));
      }

      @keyframes wire-enter {
        from {
          opacity: 0;
          transform: translateX(4px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }

      .wire__entry:last-child {
        border-bottom: none;
      }

      .wire__type {
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        display: flex;
        align-items: center;
        gap: var(--space-1);
      }

      .wire__type--echo { color: var(--color-epoch-influence); }
      .wire__type--embassy { color: var(--color-info); }
      .wire__type--phase { color: var(--color-warning); }

      .wire__narrative {
        font-family: var(--font-mono);
        font-size: 11px;
        line-height: 1.5;
        color: var(--color-text-secondary);
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .wire__timestamp {
        font-family: var(--font-mono);
        font-size: 9px;
        color: var(--color-text-muted);
        letter-spacing: 0.06em;
      }

      .wire__empty {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--color-text-muted);
        font-style: italic;
      }

      /* ── Reduced Motion ────────────────────── */

      @media (prefers-reduced-motion: reduce) {
        .wire__entry {
          animation: none;
          opacity: 1;
        }
      }
    `,
  ];

  @property({ type: Array }) entries: GazetteWireEntry[] = [];

  protected render() {
    return html`
      <div class="wire">
        <h3 class="wire__heading">${msg('Gazette Wire')}</h3>
        ${this.entries.length > 0
          ? this.entries.map(
              (entry, i) => html`
                <div class="wire__entry" style="--i: ${i}">
                  <span class="wire__type wire__type--${this._getTypeClass(entry.entry_type)}">
                    ${this._getTypeLabel(entry.entry_type)}
                  </span>
                  <span class="wire__narrative">${entry.narrative}</span>
                  <span class="wire__timestamp">
                    ${new Date(entry.created_at).toLocaleDateString(getDateLocale(), {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              `,
            )
          : html`<span class="wire__empty">${msg('No cross-simulation activity.')}</span>`}
      </div>
    `;
  }

  private _getTypeClass(entryType: string): string {
    if (entryType.includes('echo')) return 'echo';
    if (entryType.includes('embassy')) return 'embassy';
    if (entryType.includes('phase')) return 'phase';
    return 'echo';
  }

  private _getTypeLabel(entryType: string): string {
    if (entryType.includes('echo')) return msg('Echo');
    if (entryType.includes('embassy')) return msg('Embassy');
    if (entryType.includes('phase')) return msg('Phase');
    return msg('Signal');
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-broadsheet-gazette-wire': VelgBroadsheetGazetteWire;
  }
}
