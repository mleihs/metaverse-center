/**
 * VelgFirstContactModal -- "Erstkontakt"-Dialog that greets non-member
 * visitors once per bumped version. Literary, brutalist, Bureau-flavored.
 *
 * Visibility:
 *   live mode: driven by alphaStatus.shouldShowFirstContact. Ack writes
 *     localStorage so the modal stays closed until the admin bumps version.
 *   preview mode: driven by alphaStatus.firstContactPreviewing. Close does
 *     NOT write localStorage — lets admins inspect content without affecting
 *     the live-mode dismiss state.
 *
 * Microanimations:
 *   - Title scramble-to-final on mount (single run, skipped under
 *     prefers-reduced-motion).
 *   - Scanline sweep overlay (single pass, skipped under reduced motion).
 *   - Static RGB channel-shift on the title (pure text-shadow, no animation).
 *
 * @element velg-first-contact-modal
 */

import { localized, msg } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { alphaStatus } from '../../services/AlphaStatusService.js';
import { navigate } from '../../utils/navigation.js';
import '../shared/BaseModal.js';

const SCRAMBLE_CHARS = '0123456789ABCDEFXYZ↯✶▚';
const SCRAMBLE_STEPS = 12;
const SCRAMBLE_STEP_MS = 26;

@localized()
@customElement('velg-first-contact-modal')
export class VelgFirstContactModal extends SignalWatcher(LitElement) {
  static styles = css`
    :host {
      display: contents;
    }

    .title {
      position: relative;
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: var(--font-black, 900);
      font-size: var(--text-xl, 1.5rem);
      letter-spacing: var(--tracking-brutalist, 0.14em);
      text-transform: uppercase;
      color: var(--color-text-primary);
      text-shadow:
        -1px 0 color-mix(in srgb, var(--color-info) 60%, transparent),
        1px 0 color-mix(in srgb, var(--color-danger) 60%, transparent);
    }

    .kicker {
      display: block;
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: var(--font-black, 900);
      font-size: 10px;
      letter-spacing: 0.4em;
      color: var(--color-accent-amber);
      text-transform: uppercase;
      margin-bottom: var(--space-2, 8px);
    }

    .body {
      position: relative;
      overflow: hidden;
    }

    .prose {
      font-family: var(--font-bureau, var(--font-prose, serif));
      font-size: var(--text-base, 16px);
      line-height: var(--leading-relaxed, 1.625);
      color: var(--color-text-secondary);
      margin: 0 0 var(--space-5, 20px) 0;
    }

    .ledger {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 10px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--color-text-muted);
      border-top: 1px dashed var(--color-border);
      padding-top: var(--space-3, 12px);
      margin-top: var(--space-5, 20px);
      display: flex;
      gap: var(--space-4, 16px);
      flex-wrap: wrap;
    }

    .ledger__item { white-space: nowrap; }

    .footer {
      display: flex;
      gap: var(--space-3, 12px);
      justify-content: flex-end;
      flex-wrap: wrap;
    }

    .btn {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: var(--font-black, 900);
      font-size: 11px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      padding: var(--space-3, 12px) var(--space-5, 20px);
      background: transparent;
      border: 2px solid var(--color-border);
      color: var(--color-text-primary);
      cursor: pointer;
      transition: all var(--transition-fast, 100ms);
    }

    .btn:hover,
    .btn:focus-visible {
      background: var(--color-accent-amber);
      color: var(--color-text-inverse);
      border-color: var(--color-accent-amber);
      transform: translate(-2px, -2px);
      box-shadow: var(--shadow-md);
    }

    .btn:focus-visible {
      outline: 2px solid var(--color-accent-amber);
      outline-offset: 3px;
    }

    .btn--primary {
      background: var(--color-accent-amber);
      color: var(--color-text-inverse);
      border-color: var(--color-accent-amber);
    }

    .btn--primary:hover,
    .btn--primary:focus-visible {
      background: var(--color-accent-amber-hover, var(--color-accent-amber));
    }

    /* ── Scanline sweep (one-shot) ──────────────── */

    .sweep {
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: linear-gradient(
        180deg,
        transparent 0%,
        color-mix(in srgb, var(--color-accent-amber) 14%, transparent) 48%,
        color-mix(in srgb, var(--color-accent-amber) 28%, transparent) 50%,
        color-mix(in srgb, var(--color-accent-amber) 14%, transparent) 52%,
        transparent 100%
      );
      transform: translateY(-100%);
      animation: sweep 900ms ease-out 200ms forwards;
    }

    @keyframes sweep {
      to { transform: translateY(100%); }
    }

    @media (prefers-reduced-motion: reduce) {
      .sweep { display: none; }
      .title { text-shadow: none; }
    }

    @media (max-width: 640px) {
      .title { font-size: var(--text-lg, 1.25rem); }
      .ledger { font-size: 9px; gap: var(--space-3, 12px); }
    }
  `;

  /** Runtime-scrambled title text. */
  @state() private _titleText = '';

  private _titleFinal = '';
  private _prefersReducedMotion = false;
  private _scrambleTimer: number | undefined;
  private _wasOpen = false;

  connectedCallback(): void {
    super.connectedCallback();
    this._prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this._titleFinal = msg('Bureau · Dispatch · Alpha');
    this._titleText = this._prefersReducedMotion ? this._titleFinal : '';
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._stopScramble();
  }

  /**
   * Kick off the scramble exactly when the modal transitions from hidden to
   * visible. Fires once per open cycle; re-starts if the admin closes and
   * re-opens the preview.
   */
  protected updated(): void {
    const open = this._isLive || this._isPreview;
    if (open && !this._wasOpen) {
      this._titleText = this._prefersReducedMotion ? this._titleFinal : '';
      if (!this._prefersReducedMotion) {
        this._startScramble();
      }
    } else if (!open && this._wasOpen) {
      this._stopScramble();
    }
    this._wasOpen = open;
  }

  private _startScramble(): void {
    let step = 0;
    const final = this._titleFinal;
    const tick = () => {
      if (step >= SCRAMBLE_STEPS) {
        this._titleText = final;
        return;
      }
      const revealedChars = Math.floor((step / SCRAMBLE_STEPS) * final.length);
      let out = '';
      for (let i = 0; i < final.length; i++) {
        if (i < revealedChars || final[i] === ' ' || final[i] === '·') {
          out += final[i];
        } else {
          out += SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
        }
      }
      this._titleText = out;
      step++;
      this._scrambleTimer = window.setTimeout(tick, SCRAMBLE_STEP_MS);
    };
    this._scrambleTimer = window.setTimeout(tick, SCRAMBLE_STEP_MS);
  }

  private _stopScramble(): void {
    if (this._scrambleTimer !== undefined) {
      window.clearTimeout(this._scrambleTimer);
      this._scrambleTimer = undefined;
    }
  }

  private get _isPreview(): boolean {
    return alphaStatus.firstContactPreviewing.value;
  }

  private get _isLive(): boolean {
    return alphaStatus.shouldShowFirstContact.value;
  }

  private _handleAck(): void {
    if (this._isPreview) {
      alphaStatus.closePreview();
      return;
    }
    alphaStatus.acknowledge();
  }

  private _handleClose(): void {
    if (this._isPreview) {
      alphaStatus.closePreview();
      return;
    }
    alphaStatus.acknowledge();
  }

  private _handleDispatch(e: Event): void {
    e.preventDefault();
    if (this._isPreview) {
      alphaStatus.closePreview();
    } else {
      alphaStatus.acknowledge();
    }
    navigate('/bureau/dispatch');
  }

  protected render() {
    const open = this._isLive || this._isPreview;
    if (!open) return nothing;

    return html`
      <velg-base-modal
        ?open=${open}
        modal-name="first-contact"
        @modal-close=${this._handleClose}
      >
        <div slot="header">
          <span class="kicker">${msg('Erstkontakt')}</span>
          <span class="title" aria-label=${this._titleFinal}>${this._titleText}</span>
        </div>

        <div class="body">
          <div class="sweep" aria-hidden="true"></div>
          <p class="prose">
            ${msg(
              'Velgarien ist eine Vorausschau. Welten, Agenten, Epochen – manches ist endgültig, vieles wird sich verschieben. Spielstände können zurückgesetzt werden, Routen brechen, Signaturen wandern.',
            )}
          </p>
          <p class="prose">
            ${msg(
              'Wenn du das trägst: willkommen im Vorlauf. Wenn nicht: komm später wieder, wenn die Übertragung stabiler ist.',
            )}
          </p>
          <div class="ledger" aria-hidden="true">
            <span class="ledger__item">VELG.ALPHA</span>
            <span class="ledger__item">${alphaStatus.gitSha}</span>
            <span class="ledger__item">${alphaStatus.buildDate}</span>
            <span class="ledger__item">v${alphaStatus.firstContactVersion.value}</span>
          </div>
        </div>

        <div slot="footer" class="footer">
          <button class="btn" @click=${this._handleDispatch}>
            ${msg('Dispatch öffnen')}
          </button>
          <button class="btn btn--primary" @click=${this._handleAck}>
            ${msg('Verstanden – weiter zur Übertragung')}
          </button>
        </div>
      </velg-base-modal>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-first-contact-modal': VelgFirstContactModal;
  }
}
