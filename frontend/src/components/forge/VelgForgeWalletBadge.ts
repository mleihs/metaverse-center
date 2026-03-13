/**
 * Persistent wallet balance indicator for the platform header.
 * Displays current Forge token count; clicking opens The Mint overlay.
 */
import { localized, msg } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { forgeStateManager } from '../../services/ForgeStateManager.js';

@localized()
@customElement('velg-forge-wallet-badge')
export class VelgForgeWalletBadge extends SignalWatcher(LitElement) {
  static styles = css`
    :host {
      display: inline-flex;
    }

    .wallet-badge {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1-5, 6px);
      padding: var(--space-1, 4px) var(--space-2-5, 10px);
      background: rgba(245, 158, 11, 0.08);
      border: 1px solid rgba(245, 158, 11, 0.3);
      color: var(--color-accent-amber, #f59e0b);
      font-family: var(--font-brutalist, system-ui);
      font-weight: 900;
      font-size: var(--text-sm, 14px);
      letter-spacing: 0.05em;
      cursor: pointer;
      min-width: 44px;
      min-height: 44px;
      justify-content: center;
      transition: background 0.2s, border-color 0.2s, box-shadow 0.2s;
    }

    .wallet-badge:hover {
      background: rgba(245, 158, 11, 0.14);
      border-color: var(--color-accent-amber, #f59e0b);
      box-shadow: 0 0 12px rgba(245, 158, 11, 0.15);
    }

    .wallet-badge:focus-visible {
      outline: 2px solid var(--color-accent-amber, #f59e0b);
      outline-offset: 2px;
    }

    .wallet-badge__icon {
      font-size: 14px;
      line-height: 1;
    }

    .wallet-badge__count {
      font-variant-numeric: tabular-nums;
    }

    .wallet-badge--updated .wallet-badge__count {
      animation: balance-pulse 0.4s ease-out;
    }

    @keyframes balance-pulse {
      0% { transform: scale(1); }
      40% { transform: scale(1.3); color: #fbbf24; }
      100% { transform: scale(1); }
    }

    @media (prefers-reduced-motion: reduce) {
      .wallet-badge--updated .wallet-badge__count {
        animation: none;
      }
    }
  `;

  @state() private _animating = false;
  private _prevBalance = -1;

  connectedCallback(): void {
    super.connectedCallback();
    void forgeStateManager.loadWallet();
  }

  protected willUpdate(): void {
    const current = forgeStateManager.walletBalance.value;
    if (this._prevBalance >= 0 && current !== this._prevBalance) {
      this._animating = true;
      setTimeout(() => { this._animating = false; }, 500);
    }
    this._prevBalance = current;
  }

  private _handleClick(): void {
    this.dispatchEvent(
      new CustomEvent('open-mint', { bubbles: true, composed: true }),
    );
  }

  private _handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this._handleClick();
    }
  }

  protected render() {
    const balance = forgeStateManager.walletBalance.value;
    const bypass = forgeStateManager.byokStatus.value.effective_bypass;
    const label = bypass
      ? msg('BYOK Active — Unlimited Access')
      : msg('Forge Tokens') + `: ${balance}`;

    return html`
      <div
        class="wallet-badge ${this._animating ? 'wallet-badge--updated' : ''}"
        role="status"
        aria-live="polite"
        aria-label=${label}
        tabindex="0"
        title=${bypass ? msg('Using your own API keys — no token cost') : ''}
        @click=${this._handleClick}
        @keydown=${this._handleKeyDown}
      >
        ${bypass
          ? html`
              <span class="wallet-badge__icon" aria-hidden="true">&#x1F511;</span>
              <span class="wallet-badge__count">BYOK</span>
            `
          : html`
              <span class="wallet-badge__icon" aria-hidden="true">&#x2B23;</span>
              <span class="wallet-badge__count">${balance}</span>
            `
        }
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-forge-wallet-badge': VelgForgeWalletBadge;
  }
}
