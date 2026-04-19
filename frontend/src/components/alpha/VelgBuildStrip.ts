/**
 * VelgBuildStrip -- Terminal-style footer strip that surfaces build metadata
 * while Velgarien is in alpha. Monospace, amber-on-near-black, Braille
 * spinner to signal the live "transmission".
 *
 * Reads VITE_GIT_SHA and VITE_BUILD_DATE injected by vite.config.ts.
 * Never rendered outside the alpha suite; mount lives in VelgAlphaSuite.
 *
 * @element velg-build-strip
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { alphaStatus } from '../../services/AlphaStatusService.js';

const BRAILLE_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const FRAME_INTERVAL_MS = 90;

@localized()
@customElement('velg-build-strip')
export class VelgBuildStrip extends LitElement {
  static styles = css`
    :host {
      --_ink: var(--color-accent-amber);
      --_bg: color-mix(in srgb, var(--color-accent-amber) 6%, var(--color-surface));
      --_border: color-mix(in srgb, var(--color-accent-amber) 28%, transparent);

      display: block;
      width: 100%;
      box-sizing: border-box;
      height: 24px;
      padding: 0 var(--space-4, 16px);
      background: var(--_bg);
      border-top: 1px solid var(--_border);
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 10px;
      font-weight: var(--font-medium, 500);
      letter-spacing: var(--tracking-wider, 0.05em);
      text-transform: uppercase;
      color: var(--_ink);
    }

    .strip {
      display: flex;
      align-items: center;
      gap: var(--space-4, 16px);
      height: 100%;
      overflow: hidden;
      white-space: nowrap;
    }

    .strip__dot {
      display: inline-block;
      width: 1ch;
      text-align: center;
      color: var(--_ink);
    }

    .strip__sep {
      opacity: 0.45;
      user-select: none;
    }

    .strip__meta {
      text-overflow: ellipsis;
      overflow: hidden;
    }

    .strip__dispatch {
      margin-left: auto;
      color: var(--_ink);
      text-decoration: none;
      border-bottom: 1px dashed color-mix(in srgb, var(--color-accent-amber) 50%, transparent);
      padding-bottom: 1px;
      transition: color var(--transition-fast), border-color var(--transition-fast);
    }

    .strip__dispatch:hover,
    .strip__dispatch:focus-visible {
      color: var(--color-accent-amber-hover, var(--_ink));
      border-color: var(--color-accent-amber);
    }

    .strip__dispatch:focus-visible {
      outline: 2px solid var(--color-accent-amber);
      outline-offset: 2px;
    }

    @media (max-width: 640px) {
      :host {
        font-size: 9px;
        padding: 0 var(--space-3, 12px);
      }
      .strip { gap: var(--space-2, 8px); }
      .strip__meta { display: none; }
    }
  `;

  @state() private _frame = 0;
  private _timer: number | undefined;

  connectedCallback(): void {
    super.connectedCallback();
    if (!this._prefersReducedMotion()) {
      this._timer = window.setInterval(() => {
        this._frame = (this._frame + 1) % BRAILLE_FRAMES.length;
      }, FRAME_INTERVAL_MS);
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._timer !== undefined) {
      window.clearInterval(this._timer);
      this._timer = undefined;
    }
  }

  private _prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  protected render() {
    const spinner = this._prefersReducedMotion() ? '⠿' : BRAILLE_FRAMES[this._frame];
    const sha = alphaStatus.gitSha;
    const date = alphaStatus.buildDate;

    return html`
      <div class="strip" role="status" aria-live="off">
        <span class="strip__dot" aria-hidden="true">${spinner}</span>
        <span class="strip__meta">VELG.ALPHA · ${sha}</span>
        <span class="strip__sep" aria-hidden="true">//</span>
        <span class="strip__meta">${date}</span>
        <span class="strip__sep" aria-hidden="true">//</span>
        <span class="strip__meta">${msg('transmission noise detected')}</span>
        <a class="strip__dispatch" href="/bureau/dispatch">${msg('dispatch')}</a>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-build-strip': VelgBuildStrip;
  }
}
