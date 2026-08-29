import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { forgeBackButtonStyles, forgeButtonStyles } from '../shared/forge-console-styles.js';

/** One readiness readout in the bar, e.g. "4/6 operatives". */
export interface ForgeReadiness {
  label: string;
  done: number;
  total: number;
}

/**
 * The Forge's action bar: back, readiness, and the primary action, pinned to
 * the bottom of the viewport for phases I to III.
 *
 * A Forge run takes ten to fifteen minutes and each phase is up to two thousand
 * pixels tall. With the advance button living at the very end of that column,
 * the one control the phase exists to reach was the one control never on
 * screen — the drafting table had answered this by rendering the same button
 * twice, top and bottom, which put a disabled primary action above content the
 * user had not filled in yet.
 *
 * Sticky rather than fixed: the bar belongs to the phase it advances, scrolls
 * with the page above its resting place, and cannot outlive its own content.
 */
@localized()
@customElement('velg-forge-action-bar')
export class VelgForgeActionBar extends LitElement {
  static styles = [
    forgeButtonStyles,
    forgeBackButtonStyles,
    css`
      :host {
        position: sticky;
        bottom: 0;
        z-index: var(--z-sticky);
        display: block;
        margin-top: var(--space-8);
      }

      .bar {
        display: flex;
        align-items: center;
        gap: var(--space-4);
        padding: var(--space-3) var(--space-4);
        background: var(--color-surface);
        border-top: 2px solid var(--color-border);
        box-shadow: var(--shadow-lg);
      }

      .bar__readiness {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2) var(--space-4);
        flex: 1;
        min-width: 0;
      }

      .readout {
        display: inline-flex;
        align-items: baseline;
        gap: var(--space-1-5);
        font-family: var(--font-mono, monospace);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wider, 0.05em);
        color: var(--color-text-tertiary);
        white-space: nowrap;
      }

      .readout--complete {
        color: var(--color-success);
      }

      .readout__count {
        font-weight: var(--font-bold, 700);
        color: var(--color-text-secondary);
      }

      .readout--complete .readout__count {
        color: var(--color-success);
      }

      .bar__hint {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-xs);
        color: var(--color-text-tertiary);
        text-align: right;
      }

      .bar__actions {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        flex-shrink: 0;
      }

      @media (max-width: 768px) {
        .bar {
          flex-wrap: wrap;
          gap: var(--space-2);
        }

        .bar__actions {
          width: 100%;
        }

        .bar__actions .btn--next {
          flex: 1;
        }
      }
    `,
  ];

  @property({ attribute: 'back-label' }) backLabel = '';
  @property({ attribute: 'next-label' }) nextLabel = '';
  /** Blocks the primary action and explains itself through `hint`. */
  @property({ type: Boolean, attribute: 'next-disabled' }) nextDisabled = false;
  /** Shown only while the primary action is blocked. */
  @property() hint = '';
  @property({ type: Array }) readiness: ForgeReadiness[] = [];

  private _emit(name: 'forge-back' | 'forge-next') {
    this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true }));
  }

  protected render() {
    return html`
      <div class="bar">
        ${
          this.backLabel
            ? html`
          <button class="btn btn--back" @click=${() => this._emit('forge-back')}>
            &larr; ${this.backLabel}
          </button>
        `
            : nothing
        }

        <div class="bar__readiness" role="status" aria-label=${msg('Phase readiness')}>
          ${this.readiness.map((r) => {
            const complete = r.total > 0 && r.done >= r.total;
            return html`
              <span class="readout ${complete ? 'readout--complete' : ''}">
                <span class="readout__count">${r.done}/${r.total}</span>
                <span>${r.label}</span>
              </span>
            `;
          })}
        </div>

        ${
          this.nextDisabled && this.hint
            ? html`<span class="bar__hint">${this.hint}</span>`
            : nothing
        }

        <div class="bar__actions">
          <button
            class="btn btn--next"
            ?disabled=${this.nextDisabled}
            @click=${() => this._emit('forge-next')}
          >
            ${this.nextLabel} &ensp;&rarr;
          </button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-forge-action-bar': VelgForgeActionBar;
  }
}
