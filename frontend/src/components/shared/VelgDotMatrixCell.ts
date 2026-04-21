/**
 * VelgDotMatrixCell — 3x3 dot-matrix state indicator (P2.5 primitive).
 *
 * Compact circuit-state glyph used by CircuitMatrixPanel (Bureau Ops).
 * Encodes one of five states via dot pattern + status color so the eye
 * can scan dozens of cells without reading labels:
 *
 *     closed     half_open    open        killed      unknown
 *       ·          · ◉ ·       ◉ · ◉       ◉ ◉ ◉        · · ·
 *     · ◉ ·        ◉ ◉ ◉       · ◉ ·       ◉ ◉ ◉        · ◉ ·
 *       ·          · ◉ ·       ◉ · ◉       ◉ ◉ ◉        · · ·
 *      green       amber        red         red         muted
 *
 * The "dim" dots are still rendered at low opacity so the grid always
 * has 9 slots — this prevents layout shifts between states when a cell
 * transitions (e.g., closed → open). Inactive dots also give a visual
 * frame to a state like `closed` (which would otherwise be a single
 * tiny speck in empty space and read as "loading").
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

export type DotMatrixState = 'closed' | 'half_open' | 'open' | 'killed' | 'unknown';

// Dot patterns as 9-bit tuples (row-major: top-left, top-center, top-right, …).
// 1 = active (full color), 0 = dim (ghosted placeholder).
const PATTERNS: Record<DotMatrixState, readonly [number, number, number, number, number, number, number, number, number]> = {
  closed: [0, 0, 0, 0, 1, 0, 0, 0, 0],
  half_open: [0, 1, 0, 1, 1, 1, 0, 1, 0],
  open: [1, 0, 1, 0, 1, 0, 1, 0, 1],
  killed: [1, 1, 1, 1, 1, 1, 1, 1, 1],
  unknown: [0, 0, 0, 0, 0, 0, 0, 0, 0],
};

const STATE_LABELS: Record<DotMatrixState, () => string> = {
  closed: () => msg('Closed – healthy'),
  half_open: () => msg('Half-open – probing'),
  open: () => msg('Open – auto-tripped'),
  killed: () => msg('Killed – admin override'),
  unknown: () => msg('Unknown – no data'),
};

@localized()
@customElement('velg-dot-matrix-cell')
export class VelgDotMatrixCell extends LitElement {
  static styles = css`
    :host {
      /* Tier 3 — mapped to state color in _stateClass. */
      --_dot-size: 6px;
      --_dot-gap: 3px;
      --_dot-active: var(--color-success);
      --_dot-dim: color-mix(in srgb, var(--color-success) 16%, transparent);
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-1);
      font-family: var(--font-brutalist);
      color: var(--color-text-primary);
    }

    :host([state='half_open']) {
      --_dot-active: var(--color-warning);
      --_dot-dim: color-mix(in srgb, var(--color-warning) 16%, transparent);
    }

    :host([state='open']) {
      --_dot-active: var(--color-danger);
      --_dot-dim: color-mix(in srgb, var(--color-danger) 16%, transparent);
    }

    :host([state='killed']) {
      --_dot-active: var(--color-danger);
      --_dot-dim: color-mix(in srgb, var(--color-danger) 45%, transparent);
    }

    :host([state='unknown']) {
      --_dot-active: var(--color-text-muted);
      --_dot-dim: color-mix(in srgb, var(--color-text-muted) 16%, transparent);
    }

    .matrix {
      display: grid;
      grid-template-columns: repeat(3, var(--_dot-size));
      grid-template-rows: repeat(3, var(--_dot-size));
      gap: var(--_dot-gap);
      padding: var(--space-1);
      border: 1px solid var(--color-border);
      background: var(--color-surface-sunken);
    }

    .dot {
      width: var(--_dot-size);
      height: var(--_dot-size);
      background: var(--_dot-dim);
    }

    .dot--on {
      background: var(--_dot-active);
      box-shadow: 0 0 4px var(--_dot-active);
    }

    /* Probing state pulses so operators notice a flaky breaker.
       Other states are static — the color shift alone is loud enough. */
    :host([state='half_open']) .dot--on {
      animation: dot-pulse 1.2s ease-in-out infinite;
    }

    @keyframes dot-pulse {
      0%,
      100% {
        opacity: 1;
      }
      50% {
        opacity: 0.35;
      }
    }

    .label {
      font-size: 9px;
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
      color: var(--_dot-active);
      max-width: 7ch;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    @media (prefers-reduced-motion: reduce) {
      :host([state='half_open']) .dot--on {
        animation: none;
      }
    }
  `;

  /** Circuit state encoded by the pattern. Mirrored to a host attribute so CSS matches. */
  @property({ type: String, reflect: true }) state: DotMatrixState = 'unknown';

  /** Optional small label below the matrix (e.g., scope_key suffix). */
  @property({ type: String }) label = '';

  /** Optional ARIA override. Defaults to a localized state description. */
  @property({ type: String, attribute: 'aria-state-label' }) ariaStateLabel = '';

  protected render() {
    const pattern = PATTERNS[this.state];
    const describedLabel =
      this.ariaStateLabel ||
      (this.label
        ? msg(str`${STATE_LABELS[this.state]()} – ${this.label}`)
        : STATE_LABELS[this.state]());
    return html`
      <div class="matrix" role="img" aria-label=${describedLabel}>
        ${pattern.map(
          (on) => html`<span class="dot ${on ? 'dot--on' : ''}" aria-hidden="true"></span>`,
        )}
      </div>
      ${this.label ? html`<span class="label" aria-hidden="true">${this.label}</span>` : null}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-dot-matrix-cell': VelgDotMatrixCell;
  }
}
