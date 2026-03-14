/**
 * HeaderCluster — Reusable hover-to-open navigation cluster.
 *
 * Renders a trigger button (beacon + label + chevron) that opens a
 * dropdown panel on hover/click. Used for OPS, INTEL, SYS groupings.
 *
 * @slot - Panel content (links, widgets, etc.)
 * @fires navigate - Bubbles route change requests from child links
 */
import { msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { TemplateResult } from 'lit';
import { icons } from '../../utils/icons.js';

@customElement('velg-header-cluster')
export class VelgHeaderCluster extends LitElement {
  static styles = css`
    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    :host {
      display: inline-flex;
      position: relative;
      z-index: var(--z-dropdown, 100);
    }

    /* ── Trigger ── */

    .trigger {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: var(--space-2, 8px);
      padding: var(--space-1-5, 6px) var(--space-3, 12px);
      padding-left: var(--space-6, 24px);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black, 900);
      font-size: var(--text-xs, 12px);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist, 0.08em);
      color: var(--cluster-color, #ccc);
      background: transparent;
      border: 1px solid var(--cluster-border, #333);
      cursor: pointer;
      white-space: nowrap;
      transition:
        color 200ms cubic-bezier(0.23, 1, 0.32, 1),
        border-color 200ms cubic-bezier(0.23, 1, 0.32, 1),
        background 200ms cubic-bezier(0.23, 1, 0.32, 1),
        box-shadow 200ms cubic-bezier(0.23, 1, 0.32, 1);
    }

    /* Beacon dot */
    .trigger::before {
      content: '';
      position: absolute;
      left: var(--space-2-5, 10px);
      top: 50%;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--cluster-accent, #f59e0b);
      transform: translateY(-50%);
      box-shadow: 0 0 4px var(--cluster-accent, #f59e0b);
      animation: beacon-pulse 2s ease-in-out infinite;
    }

    .trigger:hover,
    .trigger[aria-expanded='true'] {
      color: var(--cluster-accent, #f59e0b);
      border-color: var(--cluster-accent, #f59e0b);
      background: var(--cluster-glow-bg, rgba(245, 158, 11, 0.06));
      box-shadow: 0 0 12px var(--cluster-glow, rgba(245, 158, 11, 0.15));
    }

    .trigger[aria-expanded='true']::before {
      animation: beacon-pulse-fast 0.8s ease-in-out infinite;
    }

    .trigger__chevron {
      display: flex;
      transition: transform 200ms cubic-bezier(0.23, 1, 0.32, 1);
    }

    .trigger[aria-expanded='true'] .trigger__chevron {
      transform: rotate(180deg);
    }

    /* ── Danger variant ── */

    :host([variant='danger']) {
      --cluster-accent: #ef4444;
      --cluster-border: #333;
      --cluster-color: #ef4444;
      --cluster-glow-bg: rgba(239, 68, 68, 0.06);
      --cluster-glow: rgba(239, 68, 68, 0.15);
    }

    /* ── Active state (child page is current) ── */

    :host([active]) .trigger {
      color: var(--cluster-accent, #f59e0b);
      border-color: var(--cluster-accent, #f59e0b);
      background: var(--cluster-glow-bg, rgba(245, 158, 11, 0.06));
    }

    /* ── Panel ── */

    .panel-wrapper {
      position: absolute;
      top: 100%;
      left: 0;
      padding-top: 4px; /* hover bridge gap */
    }

    .panel {
      min-width: 220px;
      background: #0d0d0d;
      border: 1px solid #2a2a2a;
      border-top: 2px solid var(--cluster-accent, #f59e0b);
      box-shadow:
        0 12px 40px rgba(0, 0, 0, 0.7),
        0 0 1px var(--cluster-glow, rgba(245, 158, 11, 0.3));
      padding: var(--space-3, 12px);
      animation: panel-enter 200ms cubic-bezier(0.23, 1, 0.32, 1) both;
    }

    /* Corner brackets */
    .panel::before,
    .panel::after {
      content: '';
      position: absolute;
      width: 12px;
      height: 12px;
      border-color: var(--cluster-accent, #f59e0b);
      border-style: solid;
      pointer-events: none;
      opacity: 0.4;
    }

    .panel::before {
      top: var(--space-1, 4px);
      left: var(--space-1, 4px);
      border-width: 1px 0 0 1px;
    }

    .panel::after {
      bottom: var(--space-1, 4px);
      right: var(--space-1, 4px);
      border-width: 0 1px 1px 0;
    }

    @keyframes panel-enter {
      from {
        opacity: 0;
        transform: translateY(-4px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* ── Backdrop (click-away) ── */

    .backdrop {
      position: fixed;
      inset: 0;
      z-index: -1;
    }

    /* ── Keyframes ── */

    @keyframes beacon-pulse {
      0%, 100% {
        opacity: 1;
        box-shadow: 0 0 4px var(--cluster-accent, #f59e0b);
      }
      50% {
        opacity: 0.4;
        box-shadow: 0 0 8px var(--cluster-accent, #f59e0b),
          0 0 16px color-mix(in srgb, var(--cluster-accent, #f59e0b) 40%, transparent);
      }
    }

    @keyframes beacon-pulse-fast {
      0%, 100% {
        opacity: 1;
        transform: translateY(-50%) scale(1);
        box-shadow: 0 0 6px var(--cluster-accent, #f59e0b);
      }
      50% {
        opacity: 0.6;
        transform: translateY(-50%) scale(1.5);
        box-shadow: 0 0 10px var(--cluster-accent, #f59e0b),
          0 0 20px color-mix(in srgb, var(--cluster-accent, #f59e0b) 50%, transparent);
      }
    }

    /* ── Reduced motion ── */

    @media (prefers-reduced-motion: reduce) {
      .trigger::before,
      .panel {
        animation: none !important;
      }
      .trigger,
      .trigger__chevron {
        transition: none !important;
      }
    }

    /* ── Mobile: hide on small screens (mobile menu handles nav) ── */

    @media (max-width: 640px) {
      :host {
        display: none;
      }
    }
  `;

  /** Display label on the trigger button. */
  @property() label = '';

  /** Optional icon template rendered before the label. */
  @property({ attribute: false }) icon?: TemplateResult;

  /** Visual variant — 'danger' uses red accent. */
  @property({ reflect: true }) variant: 'default' | 'danger' = 'default';

  /** Set true when a child route is the current page (amber glow on trigger). */
  @property({ type: Boolean, reflect: true }) active = false;

  @state() private _open = false;

  private _hoverEnterTimer = 0;
  private _hoverLeaveTimer = 0;

  // ── Hover logic ──

  private _onMouseEnter = (): void => {
    clearTimeout(this._hoverLeaveTimer);
    this._hoverEnterTimer = window.setTimeout(() => {
      this._open = true;
    }, 200);
  };

  private _onMouseLeave = (): void => {
    clearTimeout(this._hoverEnterTimer);
    this._hoverLeaveTimer = window.setTimeout(() => {
      this._open = false;
    }, 150);
  };

  // ── Click toggle (touch / accessibility) ──

  private _onTriggerClick = (): void => {
    clearTimeout(this._hoverEnterTimer);
    clearTimeout(this._hoverLeaveTimer);
    this._open = !this._open;
  };

  // ── Keyboard ──

  private _onTriggerKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this._open = !this._open;
    } else if (e.key === 'Escape' && this._open) {
      e.preventDefault();
      this._open = false;
    }
  };

  private _onBackdropClick = (): void => {
    this._open = false;
  };

  disconnectedCallback(): void {
    clearTimeout(this._hoverEnterTimer);
    clearTimeout(this._hoverLeaveTimer);
    super.disconnectedCallback();
  }

  protected render() {
    return html`
      <div
        @mouseenter=${this._onMouseEnter}
        @mouseleave=${this._onMouseLeave}
      >
        <button
          class="trigger"
          @click=${this._onTriggerClick}
          @keydown=${this._onTriggerKeydown}
          aria-expanded=${this._open}
          aria-haspopup="true"
          aria-label=${this.label}
        >
          ${this.icon ?? nothing}
          ${this.label}
          <span class="trigger__chevron">${icons.chevronDown(10)}</span>
        </button>

        ${this._open
          ? html`
              <div class="backdrop" @click=${this._onBackdropClick}></div>
              <nav
                class="panel-wrapper"
                role="navigation"
                aria-label=${msg('${this.label} navigation')}
              >
                <div class="panel">
                  <slot></slot>
                </div>
              </nav>
            `
          : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-header-cluster': VelgHeaderCluster;
  }
}
