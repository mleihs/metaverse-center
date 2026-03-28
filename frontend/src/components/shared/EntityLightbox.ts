import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { icons } from '../../utils/icons.js';

/**
 * Full-viewport cinematic lightbox for entity detail views.
 *
 * Uses native <dialog> with showModal() for top-layer rendering,
 * permanently immune to CSS containing block issues (filter/transform
 * on ancestors can no longer break this modal).
 *
 * Animation strategy:
 * - Entry: @starting-style for CSS-only open animation (Baseline 2024)
 * - Exit: JS-managed .closing class + transitionend → close()
 *   (cross-browser — avoids Chromium-only `overlay` property)
 * - Backdrop: native ::backdrop with animated blur + opacity
 *
 * Features:
 * - Two-column desktop layout (hero image + content)
 * - Stacked mobile layout
 * - Arrow key / swipe navigation between entities
 * - Ken Burns idle animation on hero image
 * - Scanline sweep on entity transition
 * - Native focus containment via showModal()
 * - prefers-reduced-motion support
 * - WCAG AA accessible (aria-labelledby, focus management, contrast)
 */
@localized()
@customElement('velg-entity-lightbox')
export class VelgEntityLightbox extends LitElement {
  static styles = css`
    /* ── Host ── */
    :host {
      display: contents;
    }

    /* ── Dialog (viewport-filling transparent shell) ── */
    dialog {
      box-sizing: border-box;
      padding: 0;
      border: none;
      outline: none;
      background: transparent;
      color: var(--color-text-primary);
      width: 100vw;
      width: 100dvw;
      max-width: 100vw;
      max-width: 100dvw;
      height: 100vh;
      height: 100dvh;
      max-height: 100vh;
      max-height: 100dvh;
      margin: 0;
      overflow: hidden;
    }

    dialog[open] {
      display: flex;
      align-items: center;
      justify-content: center;
      transition: display 350ms allow-discrete;
    }

    /* ── Backdrop (native ::backdrop with animated blur) ── */
    dialog::backdrop {
      background: rgba(0, 0, 0, 0);
      backdrop-filter: blur(0px);
      -webkit-backdrop-filter: blur(0px);
      transition:
        background 350ms cubic-bezier(0.22, 1, 0.36, 1),
        backdrop-filter 350ms cubic-bezier(0.22, 1, 0.36, 1),
        -webkit-backdrop-filter 350ms cubic-bezier(0.22, 1, 0.36, 1);
    }

    dialog[open]::backdrop {
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }

    /* Backdrop entry — MUST be standalone block for ::backdrop */
    @starting-style {
      dialog[open]::backdrop {
        background: rgba(0, 0, 0, 0);
        backdrop-filter: blur(0px);
        -webkit-backdrop-filter: blur(0px);
      }
    }

    /* Backdrop exit (JS-managed via .closing class) */
    dialog[open].closing::backdrop {
      background: rgba(0, 0, 0, 0);
      backdrop-filter: blur(0px);
      -webkit-backdrop-filter: blur(0px);
    }

    /* ── Container (visible content with grid layout) ── */
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

      /* At-rest (open) state */
      opacity: 1;
      scale: 1;
      translate: 0 0;
      transition:
        opacity 350ms cubic-bezier(0.22, 1, 0.36, 1),
        scale 350ms cubic-bezier(0.22, 1, 0.36, 1),
        translate 350ms cubic-bezier(0.22, 1, 0.36, 1);
    }

    /* Container entry — slides up from below, scales in */
    @starting-style {
      dialog[open] .lightbox__container {
        opacity: 0;
        scale: 0.95;
        translate: 0 12px;
      }
    }

    /* Container exit — drifts upward, scales down slightly */
    dialog[open].closing .lightbox__container {
      opacity: 0;
      scale: 0.97;
      translate: 0 -8px;
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

    .lightbox__close:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
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
      padding-bottom: var(--space-6);
      scrollbar-width: thin;
      scrollbar-color: var(--color-border) transparent;
      scrollbar-gutter: stable;
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
      position: relative;
    }

    /* Gradient fade above footer — scroll affordance */
    .lightbox__footer::before {
      content: '';
      position: absolute;
      bottom: 100%;
      left: 0;
      right: 0;
      height: var(--space-6);
      background: linear-gradient(to bottom, transparent, var(--color-surface-raised));
      pointer-events: none;
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

    .lightbox__nav-btn:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }

    .lightbox__nav-btn svg {
      width: 18px;
      height: 18px;
    }

    .lightbox__nav-btn--prev svg {
      transform: scaleX(-1);
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
      dialog::backdrop,
      .lightbox__container {
        transition-duration: 0.01ms !important;
      }

      dialog[open] {
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

  // ── Public API (zero changes from previous implementation) ──

  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: String }) panelTitle = '';
  @property({ type: Number }) totalEntities = 0;
  @property({ type: Number }) currentIndex = 0;

  // ── Internal state ──

  @state() private _scanlineActive = false;
  @state() private _contentExiting = false;

  @query('dialog') private _dialog!: HTMLDialogElement;
  @query('.lightbox__container') private _container!: HTMLDivElement;

  private _isClosing = false;
  private _touchStartX = 0;
  private _touchStartY = 0;

  // ── Lifecycle ──

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.body.style.overflow = '';
  }

  protected updated(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('open') && this._dialog) {
      if (this.open) {
        // Cancel any in-flight close animation
        if (this._isClosing) {
          this._isClosing = false;
          this._dialog.classList.remove('closing');
        }
        if (!this._dialog.open) {
          document.body.style.overflow = 'hidden';
          this._dialog.showModal();
        }
      } else {
        this._performClose();
      }
    }
  }

  // ── Close animation (JS-managed for cross-browser exit) ──

  private async _performClose(): Promise<void> {
    const dialog = this._dialog;
    if (this._isClosing || !dialog?.open) {
      document.body.style.overflow = '';
      return;
    }

    this._isClosing = true;
    dialog.classList.add('closing');

    // Wait for container exit transition, with safety timeout
    await Promise.race([
      new Promise<void>(resolve => {
        this._container?.addEventListener('transitionend', () => resolve(), { once: true });
      }),
      new Promise<void>(resolve => setTimeout(resolve, 380)),
    ]);

    // If re-opened during animation, abort close
    if (!this._isClosing) return;

    dialog.classList.remove('closing');
    dialog.close();
    document.body.style.overflow = '';
    this._isClosing = false;
  }

  // ── Keyboard (arrow nav only — Escape handled by native cancel event) ──

  private _handleKeyDown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        this._navigatePrev();
        break;
      case 'ArrowRight':
        e.preventDefault();
        this._navigateNext();
        break;
    }
  }

  private _onCancel(e: Event): void {
    e.preventDefault(); // Block instant browser close
    this._emitClose(); // Let consumer handle close flow
  }

  // ── Touch (swipe navigation) ──

  private _handleTouchStart(e: TouchEvent): void {
    this._touchStartX = e.touches[0].clientX;
    this._touchStartY = e.touches[0].clientY;
  }

  private _handleTouchEnd(e: TouchEvent): void {
    const dx = e.changedTouches[0].clientX - this._touchStartX;
    const dy = e.changedTouches[0].clientY - this._touchStartY;

    // Horizontal swipe > 50px and more horizontal than vertical
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
    requestAnimationFrame(() => {
      this._scanlineActive = true;
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

  private _handleBackdropClick(): void {
    this._emitClose();
  }

  private _stopPropagation(e: Event): void {
    e.stopPropagation();
  }

  // ── Render ──

  protected render() {
    const hasPrev = this.currentIndex > 0;
    const hasNext = this.currentIndex < this.totalEntities - 1;
    const showNav = this.totalEntities > 1;

    return html`
      <dialog
        @click=${this._handleBackdropClick}
        @cancel=${this._onCancel}
        @keydown=${this._handleKeyDown}
        @touchstart=${this._handleTouchStart}
        @touchend=${this._handleTouchEnd}
        aria-labelledby="lightbox-title"
      >
        <div
          class="lightbox__container"
          @click=${this._stopPropagation}
        >
          <!-- Header -->
          <div class="lightbox__header">
            <h2 id="lightbox-title" class="lightbox__title">${this.panelTitle}</h2>
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
              autofocus
            >${icons.close(18)}</button>
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
                      class="lightbox__nav-btn lightbox__nav-btn--prev"
                      ?disabled=${!hasPrev}
                      @click=${this._navigatePrev}
                      aria-label=${msg('Previous entity')}
                    >${icons.chevronRight(18)}</button>
                    <button
                      class="lightbox__nav-btn"
                      ?disabled=${!hasNext}
                      @click=${this._navigateNext}
                      aria-label=${msg('Next entity')}
                    >${icons.chevronRight(18)}</button>
                  `
                  : nothing
              }
            </div>
            <div class="lightbox__footer-actions">
              <slot name="footer"></slot>
            </div>
          </div>
        </div>
      </dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-entity-lightbox': VelgEntityLightbox;
  }
}
