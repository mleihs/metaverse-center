/**
 * ClearanceApplicationCard — Dashboard CTA for requesting forge access.
 *
 * Military briefing aesthetic matching AcademyEpochCard:
 * classified dossier with clearance tier indicator.
 * Shows IDLE (can apply) or PENDING (awaiting review) state.
 * Hidden when user already has forge access or was rejected.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import './ForgeAccessRequestModal.js';

@localized()
@customElement('velg-clearance-card')
export class VelgClearanceCard extends LitElement {
  static styles = css`
    :host {
      display: block;
      opacity: 0;
      animation: shard-enter 500ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) forwards;
      animation-delay: calc(var(--i, 0) * 80ms);
    }

    @keyframes shard-enter {
      from { opacity: 0; transform: translateY(16px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    @keyframes btn-materialize {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    @keyframes dot-pulse {
      0%, 100% { box-shadow: 0 0 4px var(--color-accent-amber); opacity: 1; }
      50% { box-shadow: 0 0 10px var(--color-accent-amber); opacity: 0.6; }
    }

    .card {
      position: relative;
      background: var(--color-surface-raised);
      border: 1px solid var(--color-border);
      border-left: 3px solid var(--color-accent-amber);
      padding: 24px;
      overflow: hidden;
    }

    .card::after {
      content: '';
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 3px,
        rgba(255, 255, 255, 0.01) 3px,
        rgba(255, 255, 255, 0.01) 4px
      );
      pointer-events: none;
    }

    /* ── Header ── */
    .header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 16px;
    }

    .header__classification {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--color-accent-amber);
    }

    .header__divider {
      flex: 1;
      height: 1px;
      background: linear-gradient(90deg, var(--color-border) 0%, transparent 100%);
    }

    /* ── Tier box ── */
    .tier-box {
      padding: 12px;
      background: var(--color-surface);
      border: 1px solid var(--color-border-light);
      margin-bottom: 16px;
    }

    .tier-box__label {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--color-text-muted);
      margin-bottom: 4px;
    }

    .tier-box__value {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 12px;
      letter-spacing: 1px;
      color: var(--color-text-primary);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .tier-box__pip {
      width: 8px;
      height: 8px;
      border: 1px solid var(--color-text-muted);
    }

    .tier-box__pip--filled {
      background: var(--color-accent-amber);
      border-color: var(--color-accent-amber);
    }

    /* ── Description ── */
    .desc {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 12px;
      line-height: 1.6;
      color: var(--color-text-secondary);
      margin-bottom: 20px;
    }

    /* ── CTA Button ── */
    .btn-apply {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 20px;
      width: 100%;
      justify-content: center;
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: var(--color-text-inverse);
      background: var(--color-accent-amber);
      border: none;
      cursor: pointer;
      transition: background 150ms, transform 150ms, box-shadow 150ms;
      box-shadow: 3px 3px 0 var(--color-accent-amber-glow);
      opacity: 0;
      animation: btn-materialize 400ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) both;
      animation-delay: 500ms;
    }

    .btn-apply:hover {
      background: var(--color-accent-amber-hover);
      transform: translate(-2px, -2px);
      box-shadow: 5px 5px 0 var(--color-accent-amber-glow);
    }

    .btn-apply:active {
      transform: translate(0);
      box-shadow: 2px 2px 0 var(--color-accent-amber-glow);
    }

    .btn-apply:focus-visible {
      outline: 2px solid var(--color-accent-amber);
      outline-offset: 2px;
    }

    /* ── Footer note ── */
    .note {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 9px;
      color: var(--color-text-muted);
      text-align: center;
      margin-top: 12px;
      letter-spacing: 1px;
    }

    /* ── Pending state ── */
    .pending-box {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 12px;
      background: var(--color-surface);
      border: 1px solid var(--color-border-light);
    }

    .pending-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--color-accent-amber);
      flex-shrink: 0;
      margin-top: 3px;
      animation: dot-pulse 2s ease-in-out infinite;
    }

    .pending-text {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 11px;
      color: var(--color-text-secondary);
      line-height: 1.5;
    }

    .pending-text strong {
      display: block;
      font-size: 10px;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--color-accent-amber);
      margin-bottom: 2px;
    }

    .pending-date {
      font-size: 10px;
      color: var(--color-text-muted);
    }

    .pending-note {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 9px;
      color: var(--color-text-muted);
      text-align: center;
      margin-top: 12px;
      letter-spacing: 1px;
    }

    @media (prefers-reduced-motion: reduce) {
      :host {
        animation: none;
        opacity: 1;
      }

      .btn-apply {
        animation: none;
        opacity: 1;
      }

      .btn-apply:hover {
        transform: none;
      }

      .pending-dot {
        animation: none;
      }
    }

    @media (max-width: 560px) {
      .card { padding: 16px; }
    }
  `;

  @state() private _modalOpen = false;

  private _handleApply(): void {
    this._modalOpen = true;
  }

  private _handleModalClose(): void {
    this._modalOpen = false;
  }

  protected render() {
    const status = appState.forgeRequestStatus.value;
    const canForge = appState.canForge.value;
    const isAuth = appState.isAuthenticated.value;

    // Hide if already architect, not authenticated, or rejected
    if (canForge || !isAuth || status === 'approved' || status === 'rejected') {
      return nothing;
    }

    if (status === 'pending') {
      return this._renderPending();
    }

    return this._renderIdle();
  }

  private _renderIdle() {
    return html`
      <div class="card">
        <div class="header">
          <span class="header__classification">${msg('Clearance Application')}</span>
          <div class="header__divider"></div>
        </div>

        <div class="tier-box">
          <div class="tier-box__label">${msg('Current Clearance')}</div>
          <div class="tier-box__value">
            <span class="tier-box__pip tier-box__pip--filled"></span>
            ${msg('Field Observer')}
          </div>
          <div class="tier-box__label" style="margin-top:8px">${msg('Requested Clearance')}</div>
          <div class="tier-box__value">
            <span class="tier-box__pip"></span>
            ${msg('Reality Architect')}
          </div>
        </div>

        <p class="desc">
          ${msg('Creating worlds requires Architect clearance. Submit an application to the Bureau for review.')}
        </p>

        <button
          class="btn-apply"
          @click=${this._handleApply}
          aria-label=${msg('Apply for Architect clearance')}
        >
          ${msg('Apply for Clearance')}
        </button>

        <div class="note">// ${msg('Processing time: 24\u201348h')} //</div>
      </div>

      <velg-forge-access-modal
        ?open=${this._modalOpen}
        @modal-close=${this._handleModalClose}
      ></velg-forge-access-modal>
    `;
  }

  private _renderPending() {
    return html`
      <div class="card">
        <div class="header">
          <span class="header__classification">${msg('Clearance Application')}</span>
          <div class="header__divider"></div>
        </div>

        <div class="pending-box">
          <span class="pending-dot"></span>
          <div class="pending-text">
            <strong>${msg('Application Submitted')}</strong>
            ${msg('Awaiting Bureau review')}
          </div>
        </div>

        <div class="pending-note">// ${msg('Review in Progress')} //</div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-clearance-card': VelgClearanceCard;
  }
}
