import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { focusFirstElement, trapFocus } from './focus-trap.js';

/**
 * Full-viewport cinematic lightbox for entity detail views.
 *
 * Uses the same slot API as VelgSidePanel (media, content, footer)
 * so detail panels can swap containers without visible transitions.
 *
 * Features:
 * - Two-column desktop layout (hero image + content)
 * - Stacked mobile layout
 * - Arrow key / swipe navigation between entities
 * - Ken Burns idle animation on hero image
 * - Scanline sweep on entity transition
 * - Focus trap + ARIA dialog semantics
 * - prefers-reduced-motion support
 */
@localized()
@customElement('velg-entity-lightbox')
export class VelgEntityLightbox extends LitElement {
  static styles = css`
    /* ── Reset ── */
    :host {
      display: block;
    }

    /* ── Backdrop ── */
    .lightbox {
      position: fixed;
      inset: 0;
      z-index: var(--z-modal);
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      opacity: 0;
      visibility: hidden;
      transition:
        opacity 200ms ease-out,
        visibility 200ms ease-out;
    }

    :host([open]) .lightbox {
      opacity: 1;
      visibility: visible;
    }

    /* ── Container ── */
    .lightbox__container {
      position: relative;
      width: 92vw;
      max-width: 1200px;
      height: 92vh;
      display: grid;
      grid-template-columns: minmax(280px, 1fr) minmax(320px, 1.2fr);
      grid-template-rows: auto 1fr auto;
      gap: 0;
      background: var(--color-surface-raised);
      border: var(--border-medium);
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6);
      overflow: hidden;
      transform: scale(0.95);
      opacity: 0;
      transition:
        transform 350ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)),
        opacity 350ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1));
    }

    :host([open]) .lightbox__container {
      transform: scale(1);
      opacity: 1;
    }

    /* ── Header (spans full width) ── */
    .lightbox__header {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-3) var(--space-5);
      background: var(--color-surface-header);
      border-bottom: var(--border-medium);
      min-height: 48px;
    }

    .lightbox__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-lg);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-primary);
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
      min-width: 0;
    }

    .lightbox__counter {
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      flex-shrink: 0;
      padding: 0 var(--space-3);
    }

    .lightbox__close {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      padding: 0;
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-lg);
      line-height: 1;
      color: var(--color-text-primary);
      background: transparent;
      border: var(--border-medium);
      cursor: pointer;
      flex-shrink: 0;
      transition: all var(--transition-fast);
    }

    .lightbox__close:hover {
      background: var(--color-primary);
      color: var(--color-text-inverse);
      border-color: var(--color-primary);
    }

    /* ── Hero (left column) ── */
    .lightbox__hero {
      position: relative;
      overflow: hidden;
      background: var(--color-surface-sunken);
      border-right: var(--border-default);
    }

    .lightbox__hero ::slotted(*) {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      --avatar-aspect: auto;
      --avatar-height: 100%;
      --panel-image-height: 100%;
    }

    .lightbox__hero-ken-burns {
      width: 100%;
      height: 100%;
      animation: ken-burns 20s ease-in-out infinite;
    }

    @keyframes ken-burns {
      0%   { transform: scale(1.0) translate(0, 0); }
      50%  { transform: scale(1.08) translate(-2%, -1%); }
      100% { transform: scale(1.0) translate(0, 0); }
    }

    /* Scanline sweep effect */
    .lightbox__scanline {
      position: absolute;
      left: 0;
      right: 0;
      height: 2px;
      top: -2px;
      background: var(--color-primary);
      box-shadow:
        0 0 8px var(--color-primary),
        0 0 20px color-mix(in srgb, var(--color-primary) 40%, transparent);
      opacity: 0;
      pointer-events: none;
    }

    .lightbox__scanline--active {
      animation: scanline-sweep 300ms var(--ease-snap, ease-out) forwards;
    }

    @keyframes scanline-sweep {
      0%   { top: -2px; opacity: 1; }
      100% { top: 100%; opacity: 0; }
    }

    /* ── Content (right column) ── */
    .lightbox__body {
      overflow-y: auto;
      overscroll-behavior: contain;
      padding-bottom: var(--space-4);
      scrollbar-width: thin;
      scrollbar-color: var(--color-border) transparent;
    }

    /* Entity transition: crossfade on navigate */
    .lightbox__content-inner {
      transition: opacity 150ms ease-out;
    }

    .lightbox__content-inner--exiting {
      opacity: 0;
    }

    /* ── Footer (spans full width) ── */
    .lightbox__footer {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-3) var(--space-5);
      border-top: var(--border-medium);
      background: var(--color-surface-header);
      min-height: 48px;
    }

    .lightbox__nav {
      display: flex;
      gap: var(--space-2);
    }

    .lightbox__nav-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      padding: 0;
      background: transparent;
      border: var(--border-medium);
      color: var(--color-text-secondary);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .lightbox__nav-btn:hover:not(:disabled) {
      color: var(--color-primary);
      border-color: var(--color-primary);
      background: color-mix(in srgb, var(--color-primary) 8%, transparent);
    }

    .lightbox__nav-btn:disabled {
      opacity: 0.25;
      cursor: not-allowed;
    }

    .lightbox__nav-btn svg {
      width: 18px;
      height: 18px;
      fill: currentColor;
    }

    .lightbox__footer-actions {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    /* ── Mobile ── */
    @media (max-width: 768px) {
      .lightbox__container {
        width: 100vw;
        width: 100dvw;
        height: 100vh;
        height: 100dvh;
        max-width: none;
        max-height: none;
        grid-template-columns: 1fr;
        grid-template-rows: auto minmax(140px, 30vh) 1fr auto;
        grid-template-rows: auto minmax(140px, 30dvh) 1fr auto;
        border: none;
        border-radius: 0;
      }

      .lightbox__hero {
        border-right: none;
        border-bottom: var(--border-default);
      }

      .lightbox__close {
        width: 44px;
        height: 44px;
        min-width: 44px;
        min-height: 44px;
      }

      .lightbox__nav-btn {
        width: 44px;
        height: 44px;
        min-width: 44px;
        min-height: 44px;
      }
    }

    /* ── Reduced motion ── */
    @media (prefers-reduced-motion: reduce) {
      .lightbox__container {
        transition: none !important;
      }

      .lightbox {
        transition-duration: 0.01ms !important;
      }

      .lightbox__hero-ken-burns {
        animation: none !important;
      }

      .lightbox__scanline--active {
        animation: none !important;
      }

      .lightbox__content-inner {
        transition: none !important;
      }
    }
  `;

  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: String }) panelTitle = '';
  @property({ type: Number }) totalEntities = 0;
  @property({ type: Number }) currentIndex = 0;

  @state() private _scanlineActive = false;
  @state() private _contentExiting = false;

  private _boundKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private _touchStartX = 0;
  private _touchStartY = 0;

  connectedCallback(): void {
    super.connectedCallback();
    this._boundKeyDown = this._handleKeyDown.bind(this);
    document.addEventListener('keydown', this._boundKeyDown);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._boundKeyDown) {
      document.removeEventListener('keydown', this._boundKeyDown);
    }
    document.body.style.overflow = '';
  }

  protected updated(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('open')) {
      if (this.open) {
        document.body.style.overflow = 'hidden';
        focusFirstElement(this.shadowRoot);
      } else {
        document.body.style.overflow = '';
      }
    }
  }

  // ── Keyboard ──

  private _handleKeyDown(e: KeyboardEvent): void {
    if (!this.open) return;

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        this._emitClose();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        this._navigatePrev();
        break;
      case 'ArrowRight':
        e.preventDefault();
        this._navigateNext();
        break;
      case 'Tab':
        trapFocus(e, this.shadowRoot?.querySelector('.lightbox__container'), this);
        break;
    }
  }

  // ── Touch ──

  private _handleTouchStart(e: TouchEvent): void {
    this._touchStartX = e.touches[0].clientX;
    this._touchStartY = e.touches[0].clientY;
  }

  private _handleTouchEnd(e: TouchEvent): void {
    const dx = e.changedTouches[0].clientX - this._touchStartX;
    const dy = e.changedTouches[0].clientY - this._touchStartY;

    // Only trigger if horizontal swipe > 50px and more horizontal than vertical
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) {
        this._navigateNext();
      } else {
        this._navigatePrev();
      }
    }
  }

  // ── Navigation ──

  private _navigatePrev(): void {
    if (this.currentIndex <= 0) return;
    this._playTransition();
    this.dispatchEvent(new CustomEvent('lightbox-prev', { bubbles: true, composed: true }));
  }

  private _navigateNext(): void {
    if (this.currentIndex >= this.totalEntities - 1) return;
    this._playTransition();
    this.dispatchEvent(new CustomEvent('lightbox-next', { bubbles: true, composed: true }));
  }

  private _playTransition(): void {
    // Scanline sweep on hero
    this._scanlineActive = false;
    // Force reflow
    requestAnimationFrame(() => {
      this._scanlineActive = true;
      // Auto-clear after animation
      setTimeout(() => {
        this._scanlineActive = false;
      }, 320);
    });

    // Content crossfade
    this._contentExiting = true;
    setTimeout(() => {
      this._contentExiting = false;
    }, 160);
  }

  // ── Events ──

  private _emitClose(): void {
    this.dispatchEvent(new CustomEvent('panel-close', { bubbles: true, composed: true }));
  }

  private _handleBackdropClick(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('lightbox')) {
      this._emitClose();
    }
  }

  // ── Render ──

  protected render() {
    const hasPrev = this.currentIndex > 0;
    const hasNext = this.currentIndex < this.totalEntities - 1;
    const showNav = this.totalEntities > 1;

    return html`
      <div
        class="lightbox"
        @click=${this._handleBackdropClick}
        @touchstart=${this._handleTouchStart}
        @touchend=${this._handleTouchEnd}
      >
        <div
          class="lightbox__container"
          role="dialog"
          aria-modal="true"
          aria-roledescription=${msg('Entity viewer')}
          aria-label=${this.panelTitle}
        >
          <!-- Header -->
          <div class="lightbox__header">
            <h2 class="lightbox__title">${this.panelTitle}</h2>
            ${
              showNav
                ? html`<span class="lightbox__counter" aria-live="polite">
                  ${this.currentIndex + 1} / ${this.totalEntities}
                </span>`
                : nothing
            }
            <button
              class="lightbox__close"
              @click=${this._emitClose}
              aria-label=${msg('Close')}
            >X</button>
          </div>

          <!-- Hero image -->
          <div class="lightbox__hero">
            <div class="lightbox__hero-ken-burns">
              <slot name="media"></slot>
            </div>
            <div class="lightbox__scanline ${this._scanlineActive ? 'lightbox__scanline--active' : ''}"></div>
          </div>

          <!-- Content -->
          <div class="lightbox__body">
            <div class="lightbox__content-inner ${this._contentExiting ? 'lightbox__content-inner--exiting' : ''}">
              <slot name="content"></slot>
            </div>
          </div>

          <!-- Footer -->
          <div class="lightbox__footer">
            <div class="lightbox__nav" role="group" aria-label=${msg('Entity navigation')}>
              ${
                showNav
                  ? html`
                    <button
                      class="lightbox__nav-btn"
                      ?disabled=${!hasPrev}
                      @click=${this._navigatePrev}
                      aria-label=${msg('Previous entity')}
                    >
                      <svg viewBox="0 0 16 16"><path d="M10.3 2.3a1 1 0 0 1 0 1.4L6.4 8l3.9 4.3a1 1 0 1 1-1.5 1.4l-4.5-5a1 1 0 0 1 0-1.4l4.5-5a1 1 0 0 1 1.5 0z"/></svg>
                    </button>
                    <button
                      class="lightbox__nav-btn"
                      ?disabled=${!hasNext}
                      @click=${this._navigateNext}
                      aria-label=${msg('Next entity')}
                    >
                      <svg viewBox="0 0 16 16"><path d="M5.7 2.3a1 1 0 0 1 1.5 0l4.5 5a1 1 0 0 1 0 1.4l-4.5 5a1 1 0 1 1-1.5-1.4L9.6 8 5.7 3.7a1 1 0 0 1 0-1.4z"/></svg>
                    </button>
                  `
                  : nothing
              }
            </div>
            <div class="lightbox__footer-actions">
              <slot name="footer"></slot>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-entity-lightbox': VelgEntityLightbox;
  }
}
