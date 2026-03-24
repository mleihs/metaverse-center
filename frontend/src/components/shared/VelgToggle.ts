/**
 * VelgToggle -- Shared toggle switch component.
 *
 * Replaces three duplicated toggle implementations:
 * - adminToggleStyles (rounded, smooth)
 * - adminToggleSCIFStyles (square, brutalist)
 * - settings-styles .settings-toggle (square, settings variant)
 *
 * Two variants:
 * - 'standard' — Rounded track, smooth thumb, green glow when active.
 *   Feels like a modern control surface element.
 * - 'scif' — Hard-edged, no border-radius, amber accent.
 *   Military-spec power toggle aesthetic.
 *
 * @fires toggle-change - Fires when toggled. detail: { checked: boolean }
 *
 * @example
 * <velg-toggle
 *   .checked=${this._enabled}
 *   label="Enable heartbeat"
 *   @toggle-change=${(e) => this._onToggle(e.detail.checked)}
 * ></velg-toggle>
 *
 * <velg-toggle variant="scif" size="sm" .checked=${flag}></velg-toggle>
 */

import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('velg-toggle')
export class VelgToggle extends LitElement {
  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      flex-shrink: 0;
      gap: var(--space-2, 8px);
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }

    :host([disabled]) {
      opacity: 0.4;
      cursor: not-allowed;
      pointer-events: none;
    }

    /* ── Track (outer shell) ─────────────────────────── */

    .track {
      position: relative;
      flex-shrink: 0;
      background: color-mix(in srgb, var(--color-text-muted, #666) 15%, var(--color-surface, #1a1a1a));
      border: 1px solid var(--color-border, #333);
      transition:
        background 0.25s cubic-bezier(0.4, 0, 0.2, 1),
        border-color 0.25s cubic-bezier(0.4, 0, 0.2, 1),
        box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* Size: md (default) */
    .track { width: 44px; height: 24px; }
    .track::after { width: 18px; height: 18px; top: 2px; left: 2px; }

    /* Size: sm */
    :host([size='sm']) .track { width: 36px; height: 20px; }
    :host([size='sm']) .track::after { width: 14px; height: 14px; top: 2px; left: 2px; }

    /* Standard variant: rounded */
    :host(:not([variant='scif'])) .track { border-radius: 12px; }
    :host(:not([variant='scif'])) .track::after { border-radius: 50%; }

    /* SCIF variant: hard edges, no radius */
    :host([variant='scif']) .track { border-radius: 0; }
    :host([variant='scif']) .track::after { border-radius: 0; }

    /* ── Thumb (sliding indicator) ───────────────────── */

    .track::after {
      content: '';
      position: absolute;
      background: var(--color-text-muted, #888);
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* ── Checked state ───────────────────────────────── */

    :host([checked]:not([variant='scif'])) .track {
      background: var(--color-success, #22c55e);
      border-color: var(--color-success, #22c55e);
      box-shadow: 0 0 10px color-mix(in srgb, var(--color-success, #22c55e) 30%, transparent);
    }

    :host([checked][variant='scif']) .track {
      background: color-mix(in srgb, var(--color-accent, #d4a24e) 20%, var(--color-surface, #1a1a1a));
      border-color: var(--color-accent, #d4a24e);
    }

    /* Thumb position: checked */
    :host([checked]) .track::after { left: calc(100% - 20px); }
    :host([checked][size='sm']) .track::after { left: calc(100% - 16px); }

    /* Thumb color: checked */
    :host([checked]:not([variant='scif'])) .track::after {
      background: var(--color-text-inverse, #fff);
    }
    :host([checked][variant='scif']) .track::after {
      background: var(--color-accent, #d4a24e);
      box-shadow: 0 0 8px color-mix(in srgb, var(--color-accent, #d4a24e) 40%, transparent);
    }

    /* ── Hover ───────────────────────────────────────── */

    :host(:hover:not([disabled])) .track {
      border-color: var(--color-text-muted, #888);
    }

    /* ── Switch label (wraps input + track) ──────────── */

    label {
      display: inline-flex;
      align-items: center;
    }

    /* ── Focus-visible ───────────────────────────────── */

    .input {
      position: absolute;
      opacity: 0;
      width: 0;
      height: 0;
      pointer-events: none;
    }

    .input:focus-visible ~ .track {
      outline: 2px solid var(--color-accent, #d4a24e);
      outline-offset: 2px;
    }

    /* ── Label ───────────────────────────────────────── */

    .label {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs, 11px);
      color: var(--color-text-secondary, #999);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      user-select: none;
    }

    /* ── Reduced motion ──────────────────────────────── */

    @media (prefers-reduced-motion: reduce) {
      .track,
      .track::after {
        transition: none !important;
      }
    }
  `;

  @property({ type: Boolean, reflect: true }) checked = false;
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property({ type: String }) label = '';
  @property({ type: String, reflect: true }) variant: 'standard' | 'scif' = 'standard';
  @property({ type: String, reflect: true }) size: 'sm' | 'md' = 'md';

  private _toggle() {
    if (this.disabled) return;
    this.checked = !this.checked;
    this.dispatchEvent(new CustomEvent('toggle-change', {
      detail: { checked: this.checked },
      bubbles: true,
      composed: true,
    }));
  }

  private _onKeydown(e: KeyboardEvent) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      this._toggle();
    }
  }

  protected render() {
    return html`
      <label
        role="switch"
        aria-checked=${this.checked}
        aria-disabled=${this.disabled}
        @click=${this._toggle}
        @keydown=${this._onKeydown}
      >
        <input
          class="input"
          type="checkbox"
          .checked=${this.checked}
          ?disabled=${this.disabled}
          tabindex="-1"
          aria-hidden="true"
        />
        <span class="track"></span>
      </label>
      ${this.label ? html`<span class="label">${this.label}</span>` : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-toggle': VelgToggle;
  }
}
