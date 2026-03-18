/**
 * VelgOnboardingBrief — Declassified dossier briefing panel.
 *
 * Aesthetic: A redacted classified document being declassified for the
 * first time. Scanline texture, corner brackets, diagonal "DECLASSIFIED"
 * watermark, typewriter reveal on expand. Feels like being handed a
 * folder stamped "FOR YOUR EYES ONLY" by the Bureau.
 *
 * Appears once per simulation per system. Dismissed via localStorage.
 *
 * Usage:
 *   <velg-onboarding-brief
 *     briefKey="pulse"
 *     .simulationId=${this.simulationId}
 *   >
 *     <span slot="title">Substrate Pulse Briefing</span>
 *     <p>The Pulse monitors all heartbeat activity...</p>
 *   </velg-onboarding-brief>
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import { icons } from '../../utils/icons.js';

@localized()
@customElement('velg-onboarding-brief')
export class VelgOnboardingBrief extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    :host([hidden]) {
      display: none;
    }

    /* ── Dossier container ── */

    .dossier {
      position: relative;
      border: 1px solid var(--color-border);
      padding: var(--space-5) var(--space-5) var(--space-4);
      margin-bottom: var(--space-5);
      background: var(--color-surface-sunken);
      overflow: hidden;
      animation: dossier-materialize 0.6s var(--ease-out, ease-out) forwards;
    }

    /* Corner brackets — classified document framing */
    .dossier::before,
    .dossier::after {
      content: '';
      position: absolute;
      width: 12px;
      height: 12px;
      border-color: var(--color-primary);
      border-style: solid;
      opacity: 0.5;
      pointer-events: none;
      z-index: 2;
    }

    .dossier::before {
      top: -1px;
      left: -1px;
      border-width: 2px 0 0 2px;
    }

    .dossier::after {
      bottom: -1px;
      right: -1px;
      border-width: 0 2px 2px 0;
    }

    /* Scanline texture overlay */
    .dossier__scanlines {
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 3px,
        rgba(255, 255, 255, 0.008) 3px,
        rgba(255, 255, 255, 0.008) 6px
      );
      pointer-events: none;
      z-index: 1;
    }

    /* Diagonal "DECLASSIFIED" watermark */
    .dossier__watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-25deg);
      font-family: var(--font-brutalist);
      font-size: 36px;
      font-weight: var(--font-black);
      letter-spacing: 0.3em;
      text-transform: uppercase;
      color: var(--color-primary);
      opacity: 0.04;
      pointer-events: none;
      z-index: 0;
      white-space: nowrap;
      user-select: none;
    }

    /* ── Classification stamp ── */

    .dossier__stamp {
      position: absolute;
      top: var(--space-2);
      right: var(--space-3);
      font-family: var(--font-brutalist);
      font-size: 8px;
      font-weight: var(--font-black);
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--color-primary);
      opacity: 0.6;
      border: 1px solid var(--color-primary);
      padding: 1px 6px;
      z-index: 3;
    }

    /* ── Header ── */

    .dossier__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      cursor: pointer;
      user-select: none;
      position: relative;
      z-index: 3;
    }

    .dossier__title {
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-primary);
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .dossier__title-icon {
      color: var(--color-primary);
      flex-shrink: 0;
    }

    /* ── Controls ── */

    .dossier__controls {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      flex-shrink: 0;
    }

    .dossier__btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      padding: 0;
      background: transparent;
      border: 1px solid var(--color-border);
      color: var(--color-text-muted);
      cursor: pointer;
      transition:
        color var(--duration-fast, 150ms) ease,
        border-color var(--duration-fast, 150ms) ease;
    }

    .dossier__btn:hover {
      color: var(--color-text-primary);
      border-color: var(--color-primary);
    }

    .dossier__btn:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }

    .dossier__btn--toggle svg {
      transition: transform 0.25s var(--ease-out, ease-out);
    }

    .dossier__btn--expanded svg {
      transform: rotate(180deg);
    }

    /* ── Body (collapsible) ── */

    .dossier__body {
      margin-top: var(--space-3);
      padding-top: var(--space-3);
      border-top: 1px dashed color-mix(in srgb, var(--color-border) 60%, transparent);
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      line-height: 1.7;
      color: var(--color-text-secondary);
      position: relative;
      z-index: 3;
      animation: body-reveal 0.35s var(--ease-out, ease-out) forwards;
    }

    .dossier__body ::slotted(p) {
      margin: 0 0 var(--space-2);
    }

    .dossier__body ::slotted(strong) {
      color: var(--color-text-primary);
      font-weight: var(--font-semibold);
    }

    /* ── Animations ── */

    @keyframes dossier-materialize {
      0% {
        opacity: 0;
        transform: translateY(-6px) scaleY(0.97);
        clip-path: inset(0 100% 0 0);
      }
      50% {
        opacity: 1;
        transform: translateY(0) scaleY(1);
      }
      100% {
        clip-path: inset(0 0 0 0);
      }
    }

    @keyframes body-reveal {
      from {
        opacity: 0;
        transform: translateY(-4px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .dossier {
        animation: none;
        opacity: 1;
      }
      .dossier__body {
        animation: none;
      }
      .dossier__btn--toggle svg {
        transition: none;
      }
    }
  `;

  @property({ type: String }) briefKey = '';
  @property({ type: String }) simulationId = '';

  @state() private _dismissed = false;
  @state() private _collapsed = false;

  private get _storageKey(): string {
    return `onboarding_${this.simulationId}_${this.briefKey}`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._dismissed = !!localStorage.getItem(this._storageKey);
  }

  private _toggle(): void {
    this._collapsed = !this._collapsed;
  }

  private _dismiss(): void {
    this._dismissed = true;
    localStorage.setItem(this._storageKey, '1');
  }

  protected render() {
    if (this._dismissed) return nothing;

    return html`
      <div class="dossier" role="region" aria-label=${msg('System briefing')}>
        <div class="dossier__scanlines" aria-hidden="true"></div>
        <span class="dossier__watermark" aria-hidden="true">DECLASSIFIED</span>
        <span class="dossier__stamp">${msg('NEW OPERATIVE')}</span>

        <div
          class="dossier__header"
          role="button"
          tabindex="0"
          @click=${this._toggle}
          @keydown=${(e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              this._toggle();
            }
          }}
        >
          <span class="dossier__title">
            <span class="dossier__title-icon">${icons.clipboard(14)}</span>
            <slot name="title">${msg('Briefing')}</slot>
          </span>
          <span class="dossier__controls">
            <button
              class="dossier__btn dossier__btn--toggle ${this._collapsed ? '' : 'dossier__btn--expanded'}"
              aria-label=${this._collapsed ? msg('Expand briefing') : msg('Collapse briefing')}
              aria-expanded=${!this._collapsed}
              @click=${(e: Event) => {
                e.stopPropagation();
                this._toggle();
              }}
            >
              ${icons.chevronDown(10)}
            </button>
            <button
              class="dossier__btn"
              aria-label=${msg('Dismiss briefing permanently')}
              @click=${(e: Event) => {
                e.stopPropagation();
                this._dismiss();
              }}
            >
              ${icons.close(10)}
            </button>
          </span>
        </div>

        ${this._collapsed
          ? nothing
          : html`
            <div class="dossier__body">
              <slot></slot>
            </div>
          `}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-onboarding-brief': VelgOnboardingBrief;
  }
}
