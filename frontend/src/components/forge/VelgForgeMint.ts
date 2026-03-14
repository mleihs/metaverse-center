/**
 * The Mint — full-screen overlay for purchasing Forge token bundles.
 * Industrial-alchemical aesthetic: brass machinery meets minting press.
 */
import { localized, msg } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { analyticsService } from '../../services/AnalyticsService.js';
import { appState } from '../../services/AppStateManager.js';
import { forgeStateManager } from '../../services/ForgeStateManager.js';
import type { TokenBundle } from '../../services/api/ForgeApiService.js';
import { forgeApi } from '../../services/api/ForgeApiService.js';
import { forgeButtonStyles } from './forge-console-styles.js';

@localized()
@customElement('velg-forge-mint')
export class VelgForgeMint extends SignalWatcher(LitElement) {
  static styles = [
    forgeButtonStyles,
    css`
      :host {
        display: contents;
      }

      /* ── Overlay ──────────────────────────────────────── */

      .mint {
        position: fixed;
        inset: 0;
        z-index: var(--z-modal, 500);
        display: flex;
        flex-direction: column;
        background: var(--color-surface, #0a0a0a);
        overflow-y: auto;
      }

      /* ── Header ───────────────────────────────────────── */

      .mint__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--space-6, 24px) var(--space-8, 32px);
        border-bottom: 2px solid var(--color-mint-brass, #b8860b);
      }

      .mint__title {
        font-family: var(--font-brutalist, system-ui);
        font-weight: 900;
        font-size: var(--text-2xl, 24px);
        text-transform: uppercase;
        letter-spacing: 0.2em;
        color: var(--color-accent-amber, #f59e0b);
        margin: 0;
      }

      .mint__balance {
        display: flex;
        align-items: center;
        gap: var(--space-3, 12px);
        font-family: var(--font-brutalist, system-ui);
        font-weight: 900;
        font-size: var(--text-lg, 18px);
        color: var(--color-accent-amber, #f59e0b);
      }

      .mint__balance-icon {
        font-size: 20px;
      }

      .mint__close {
        background: transparent;
        border: 1px solid var(--color-gray-700, #374151);
        color: var(--color-gray-400, #9ca3af);
        width: 44px;
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: var(--text-lg, 18px);
        transition: color 0.2s, border-color 0.2s;
      }

      .mint__close:hover {
        color: var(--color-gray-100, #f3f4f6);
        border-color: var(--color-gray-500, #6b7280);
      }

      .mint__close:focus-visible {
        outline: 2px solid var(--color-accent-amber, #f59e0b);
        outline-offset: 2px;
      }

      /* ── Body ─────────────────────────────────────────── */

      .mint__body {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: var(--space-8, 32px) var(--space-6, 24px);
        max-width: 960px;
        margin: 0 auto;
        width: 100%;
      }

      /* ── Bundle grid ──────────────────────────────────── */

      .mint__grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: var(--space-6, 24px);
        width: 100%;
        margin-bottom: var(--space-8, 32px);
      }

      @media (max-width: 768px) {
        .mint__grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      @media (max-width: 480px) {
        .mint__grid {
          grid-template-columns: 1fr;
        }
        .mint__header {
          padding: var(--space-4, 16px);
          flex-wrap: wrap;
          gap: var(--space-3, 12px);
        }
      }

      /* ── Bundle card ──────────────────────────────────── */

      .bundle {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: var(--space-6, 24px) var(--space-4, 16px);
        border: 2px solid var(--color-mint-brass, #b8860b);
        background: var(--color-surface-raised, #111111);
        cursor: pointer;
        transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
        min-height: 200px;
      }

      .bundle:hover {
        transform: translateY(-4px);
        border-color: var(--color-accent-amber, #f59e0b);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      }

      .bundle:focus-visible {
        outline: 2px solid var(--color-accent-amber, #f59e0b);
        outline-offset: 2px;
      }

      .bundle--selected {
        border-color: var(--color-accent-amber, #f59e0b);
        box-shadow: 0 0 20px rgba(245, 158, 11, 0.2), inset 0 0 20px rgba(245, 158, 11, 0.05);
      }

      .bundle__tokens {
        font-family: var(--font-brutalist, system-ui);
        font-weight: 900;
        font-size: 48px;
        color: var(--color-accent-amber, #f59e0b);
        line-height: 1;
        margin-bottom: var(--space-2, 8px);
      }

      .bundle__token-label {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-xs, 12px);
        text-transform: uppercase;
        letter-spacing: 0.15em;
        color: var(--color-text-muted, #888888);
        margin-bottom: var(--space-4, 16px);
      }

      .bundle__name {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm, 14px);
        text-transform: uppercase;
        letter-spacing: 0.15em;
        color: var(--color-text-primary, #e5e5e5);
        margin-bottom: var(--space-3, 12px);
        text-align: center;
      }

      .bundle__price {
        font-family: var(--font-brutalist, system-ui);
        font-weight: 900;
        font-size: var(--text-xl, 20px);
        color: var(--color-accent-amber, #f59e0b);
        margin-bottom: var(--space-2, 8px);
      }

      .bundle__savings {
        display: inline-block;
        padding: var(--space-0-5, 2px) var(--space-2, 8px);
        background: rgba(34, 197, 94, 0.15);
        border: 1px solid rgba(34, 197, 94, 0.3);
        color: var(--color-success, #22c55e);
        font-family: var(--font-mono, monospace);
        font-size: var(--text-xs, 12px);
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      /* ── Purchase section ─────────────────────────────── */

      .mint__purchase {
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-3, 12px);
        margin-bottom: var(--space-8, 32px);
      }

      .mint__purchase-info {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm, 14px);
        color: var(--color-text-secondary, #a0a0a0);
        text-align: center;
      }

      .btn--purchase {
        background: var(--color-accent-amber, #f59e0b);
        border-color: var(--color-accent-amber, #f59e0b);
        color: #0a0a0a;
        font-weight: 900;
        letter-spacing: 0.15em;
        padding: var(--space-3, 12px) var(--space-8, 32px);
        font-size: var(--text-base, 16px);
        min-width: 280px;
        text-align: center;
      }

      .btn--purchase:hover:not(:disabled) {
        background: var(--color-accent-amber-hover, #fbbf24);
        box-shadow: 0 0 16px rgba(245, 158, 11, 0.3);
        transform: translateY(-1px);
      }

      .btn--purchase:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .btn--purchase:focus-visible {
        outline: 2px solid var(--color-accent-amber, #f59e0b);
        outline-offset: 2px;
      }

      /* ── History section ──────────────────────────────── */

      .mint__history {
        width: 100%;
        border-top: 1px solid var(--color-gray-800, #1f2937);
        padding-top: var(--space-6, 24px);
      }

      .mint__history-toggle {
        display: flex;
        align-items: center;
        gap: var(--space-2, 8px);
        background: none;
        border: none;
        color: var(--color-text-secondary, #a0a0a0);
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm, 14px);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        cursor: pointer;
        padding: var(--space-2, 8px) 0;
        width: 100%;
        min-height: 44px;
      }

      .mint__history-toggle:hover {
        color: var(--color-text-primary, #e5e5e5);
      }

      .mint__history-toggle:focus-visible {
        outline: 2px solid var(--color-accent-amber, #f59e0b);
        outline-offset: 2px;
      }

      .mint__history-arrow {
        transition: transform 0.2s;
      }

      .mint__history-arrow--open {
        transform: rotate(90deg);
      }

      .mint__history-list {
        list-style: none;
        padding: 0;
        margin: var(--space-3, 12px) 0 0;
      }

      .mint__history-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: var(--space-3, 12px) var(--space-4, 16px);
        border-bottom: 1px solid var(--color-gray-900, #111827);
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm, 14px);
      }

      .mint__history-tokens {
        color: var(--color-accent-amber, #f59e0b);
        font-weight: 700;
      }

      .mint__history-price {
        color: var(--color-text-muted, #888888);
      }

      .mint__history-date {
        color: var(--color-text-muted, #888888);
        font-size: var(--text-xs, 12px);
      }

      .mint__history-empty {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm, 14px);
        color: var(--color-text-muted, #888888);
        padding: var(--space-4, 16px);
        text-align: center;
      }

      /* ── BYOK Banner ─────────────────────────────────── */

      .mint__byok-banner {
        width: 100%;
        padding: var(--space-6, 24px);
        border: 2px solid var(--color-accent-amber, #f59e0b);
        background: rgba(245, 158, 11, 0.06);
        text-align: center;
        margin-bottom: var(--space-8, 32px);
      }

      .mint__byok-title {
        font-family: var(--font-brutalist, system-ui);
        font-weight: 900;
        font-size: var(--text-lg, 18px);
        text-transform: uppercase;
        letter-spacing: 0.15em;
        color: var(--color-accent-amber, #f59e0b);
        margin-bottom: var(--space-2, 8px);
      }

      .mint__byok-subtitle {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm, 14px);
        color: var(--color-text-secondary, #a0a0a0);
      }

      .mint__byok-keys {
        display: flex;
        justify-content: center;
        gap: var(--space-6, 24px);
        margin-top: var(--space-4, 16px);
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm, 14px);
      }

      .mint__byok-key {
        display: flex;
        align-items: center;
        gap: var(--space-2, 8px);
      }

      .mint__byok-key--active {
        color: var(--color-success, #22c55e);
      }

      .mint__byok-key--missing {
        color: var(--color-text-muted, #888888);
      }

      /* ── BYOK Key Management ─────────────────────────── */

      .mint__keys-section {
        width: 100%;
        border: 1px solid var(--color-gray-800, #1f2937);
        background: var(--color-surface-raised, #111111);
        padding: var(--space-6, 24px);
        margin-bottom: var(--space-6, 24px);
      }

      .mint__keys-header {
        font-family: var(--font-brutalist, system-ui);
        font-weight: 900;
        font-size: var(--text-base, 16px);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--color-text-primary, #e5e5e5);
        margin: 0 0 var(--space-1, 4px);
      }

      .mint__keys-desc {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-xs, 12px);
        color: var(--color-text-muted, #888888);
        margin: 0 0 var(--space-4, 16px);
      }

      .mint__key-field {
        margin-bottom: var(--space-4, 16px);
      }

      .mint__key-label {
        display: flex;
        align-items: center;
        gap: var(--space-2, 8px);
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm, 14px);
        color: var(--color-text-secondary, #a0a0a0);
        margin-bottom: var(--space-1-5, 6px);
      }

      .mint__key-status {
        font-size: 12px;
      }

      .mint__key-status--set {
        color: var(--color-success, #22c55e);
      }

      .mint__key-status--unset {
        color: var(--color-text-muted, #888888);
      }

      .mint__key-input {
        width: 100%;
        padding: var(--space-2-5, 10px) var(--space-3, 12px);
        background: var(--color-surface, #0a0a0a);
        border: 1px solid var(--color-gray-700, #374151);
        color: var(--color-text-primary, #e5e5e5);
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm, 14px);
        box-sizing: border-box;
        transition: border-color 0.2s;
      }

      .mint__key-input::placeholder {
        color: var(--color-text-muted, #888888);
      }

      .mint__key-input:focus {
        outline: none;
        border-color: var(--color-accent-amber, #f59e0b);
      }

      .mint__keys-actions {
        display: flex;
        align-items: center;
        gap: var(--space-3, 12px);
      }

      .btn--save-keys {
        background: transparent;
        border: 1px solid var(--color-accent-amber, #f59e0b);
        color: var(--color-accent-amber, #f59e0b);
        font-family: var(--font-brutalist, system-ui);
        font-weight: 900;
        font-size: var(--text-sm, 14px);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        padding: var(--space-2, 8px) var(--space-5, 20px);
        cursor: pointer;
        min-height: 44px;
        transition: background 0.2s, color 0.2s;
      }

      .btn--save-keys:hover:not(:disabled) {
        background: var(--color-accent-amber, #f59e0b);
        color: #0a0a0a;
      }

      .btn--save-keys:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .btn--save-keys:focus-visible {
        outline: 2px solid var(--color-accent-amber, #f59e0b);
        outline-offset: 2px;
      }

      .mint__keys-hint {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-xs, 12px);
        color: var(--color-text-muted, #888888);
      }

      /* ── First-shard callout ──────────────────────────── */

      .mint__callout {
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm, 14px);
        color: var(--color-text-muted, #888888);
        text-align: center;
        border: 1px dashed var(--color-mint-brass, #b8860b);
        padding: var(--space-4, 16px) var(--space-6, 24px);
        margin-top: var(--space-4, 16px);
      }

      /* ── Toast ────────────────────────────────────────── */

      .mint__toast {
        position: fixed;
        bottom: var(--space-6, 24px);
        left: 50%;
        transform: translateX(-50%);
        padding: var(--space-3, 12px) var(--space-6, 24px);
        font-family: var(--font-mono, monospace);
        font-size: var(--text-sm, 14px);
        font-weight: 700;
        z-index: calc(var(--z-modal, 500) + 1);
        animation: toast-enter 0.3s ease-out;
      }

      .mint__toast--success {
        background: rgba(34, 197, 94, 0.15);
        border: 1px solid var(--color-success, #22c55e);
        color: var(--color-success, #22c55e);
      }

      .mint__toast--error {
        background: rgba(239, 68, 68, 0.15);
        border: 1px solid var(--color-danger, #ef4444);
        color: var(--color-danger, #ef4444);
      }

      @keyframes toast-enter {
        from { opacity: 0; transform: translateX(-50%) translateY(12px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
      }

      @media (prefers-reduced-motion: reduce) {
        .bundle {
          transition: none;
        }
        .bundle:hover {
          transform: none;
        }
        .btn--purchase:hover:not(:disabled) {
          transform: none;
        }
        .mint__toast {
          animation: none;
        }
        .mint__history-arrow {
          transition: none;
        }
      }
    `,
  ];

  @state() private _selectedSlug: string | null = null;
  @state() private _isPurchasing = false;
  @state() private _historyOpen = false;
  @state() private _toast: { message: string; type: 'success' | 'error' } | null = null;
  @state() private _orKey = '';
  @state() private _repKey = '';
  @state() private _isSavingKeys = false;
  private _toastTimer: ReturnType<typeof setTimeout> | null = null;

  private _firstFocusable: HTMLElement | null = null;
  private _lastFocusable: HTMLElement | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    if (appState.isAuthenticated.value) {
      void forgeStateManager.loadBundles();
      void forgeStateManager.loadWallet();
    }
    document.addEventListener('keydown', this._handleEscKey);
  }

  disconnectedCallback(): void {
    document.removeEventListener('keydown', this._handleEscKey);
    if (this._toastTimer) clearTimeout(this._toastTimer);
    super.disconnectedCallback();
  }

  protected willUpdate(): void {
    // Lazy-load data when mint opens (handles login after DOM attach)
    if (forgeStateManager.mintOpen.value && forgeStateManager.bundles.value.length === 0) {
      void forgeStateManager.loadBundles();
      void forgeStateManager.loadWallet();
    }
  }

  protected updated(): void {
    // Set up focus trap
    const focusables = this.shadowRoot?.querySelectorAll<HTMLElement>(
      'button, [tabindex]:not([tabindex="-1"])',
    );
    if (focusables && focusables.length > 0) {
      this._firstFocusable = focusables[0];
      this._lastFocusable = focusables[focusables.length - 1];
    }
  }

  private _handleEscKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      this._close();
    }
  };

  private _handleFocusTrap = (e: KeyboardEvent): void => {
    if (e.key !== 'Tab') return;
    if (e.shiftKey) {
      if (this.shadowRoot?.activeElement === this._firstFocusable) {
        e.preventDefault();
        this._lastFocusable?.focus();
      }
    } else {
      if (this.shadowRoot?.activeElement === this._lastFocusable) {
        e.preventDefault();
        this._firstFocusable?.focus();
      }
    }
  };

  private _close(): void {
    forgeStateManager.mintOpen.value = false;
    this._selectedSlug = null;
  }

  private _selectBundle(slug: string): void {
    if (this._selectedSlug !== slug) {
      const bundle = forgeStateManager.bundles.value.find((b) => b.slug === slug);
      if (bundle) {
        analyticsService.trackEvent('view_item', { item_name: bundle.display_name });
      }
    }
    this._selectedSlug = this._selectedSlug === slug ? null : slug;
  }

  private _handleBundleKeyDown(e: KeyboardEvent, slug: string): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this._selectBundle(slug);
    }
  }

  private async _purchase(): Promise<void> {
    if (!this._selectedSlug || this._isPurchasing) return;

    this._isPurchasing = true;
    const receipt = await forgeStateManager.purchaseBundle(this._selectedSlug);
    this._isPurchasing = false;

    if (receipt) {
      analyticsService.trackEvent('purchase', {
        transaction_id: receipt.purchase_id,
        value: receipt.tokens_granted,
        currency: 'VLG',
        items: receipt.bundle_slug,
      });
      this._showToast(
        `+${receipt.tokens_granted} ${msg('Forge Tokens')}`,
        'success',
      );
      this._selectedSlug = null;
      void forgeStateManager.loadPurchaseHistory();
    } else {
      this._showToast(
        forgeStateManager.error.value ?? msg('Purchase failed'),
        'error',
      );
    }
  }

  private _showToast(message: string, type: 'success' | 'error'): void {
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toast = { message, type };
    this._toastTimer = setTimeout(() => { this._toast = null; }, 3000);
  }

  private _toggleHistory(): void {
    this._historyOpen = !this._historyOpen;
    if (this._historyOpen && forgeStateManager.purchaseHistory.value.length === 0) {
      void forgeStateManager.loadPurchaseHistory();
    }
  }

  private async _saveKeys(): Promise<void> {
    if (this._isSavingKeys) return;
    if (!this._orKey && !this._repKey) return;

    this._isSavingKeys = true;
    try {
      const payload: { openrouter_key?: string; replicate_key?: string } = {};
      if (this._orKey) payload.openrouter_key = this._orKey;
      if (this._repKey) payload.replicate_key = this._repKey;

      const resp = await forgeApi.updateBYOK(payload);
      if (resp.success) {
        this._orKey = '';
        this._repKey = '';
        await forgeStateManager.loadWallet();
        this._showToast(msg('API keys saved and encrypted.'), 'success');
      } else {
        this._showToast(
          (resp.error as { message?: string } | undefined)?.message ?? msg('Failed to save keys'),
          'error',
        );
      }
    } catch {
      this._showToast(msg('Failed to save keys'), 'error');
    } finally {
      this._isSavingKeys = false;
    }
  }

  private _formatPrice(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }

  private _formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  private _renderBundle(bundle: TokenBundle) {
    const selected = this._selectedSlug === bundle.slug;
    const priceLabel = `${bundle.display_name}: ${bundle.tokens} ${bundle.tokens === 1 ? 'token' : 'tokens'} ${msg('for')} ${this._formatPrice(bundle.price_cents)}`;

    return html`
      <div
        class="bundle ${selected ? 'bundle--selected' : ''}"
        role="radio"
        aria-checked=${selected}
        aria-label=${priceLabel}
        tabindex="0"
        @click=${() => this._selectBundle(bundle.slug)}
        @keydown=${(e: KeyboardEvent) => this._handleBundleKeyDown(e, bundle.slug)}
      >
        <span class="bundle__tokens">${bundle.tokens}</span>
        <span class="bundle__token-label">${bundle.tokens === 1 ? msg('Token') : msg('Tokens')}</span>
        <span class="bundle__name">${bundle.display_name}</span>
        <span class="bundle__price">${this._formatPrice(bundle.price_cents)}</span>
        ${bundle.savings_pct > 0
          ? html`<span class="bundle__savings">${msg('Save')} ${bundle.savings_pct}%</span>`
          : nothing}
      </div>
    `;
  }

  private _renderHistory() {
    const history = forgeStateManager.purchaseHistory.value;

    return html`
      <div class="mint__history">
        <button
          class="mint__history-toggle"
          @click=${this._toggleHistory}
          aria-expanded=${this._historyOpen}
        >
          <span class="mint__history-arrow ${this._historyOpen ? 'mint__history-arrow--open' : ''}">&#x25B6;</span>
          ${msg('Purchase History')}
        </button>

        ${this._historyOpen
          ? html`
            ${history.length === 0
              ? html`<p class="mint__history-empty">${msg('No purchases yet')}</p>`
              : html`
                <ul class="mint__history-list">
                  ${history.map(
                    (p) => html`
                      <li class="mint__history-item">
                        <span class="mint__history-tokens">+${p.tokens_granted}</span>
                        <span class="mint__history-price">${this._formatPrice(p.price_cents)}</span>
                        <span class="mint__history-date">${this._formatDate(p.created_at)}</span>
                      </li>
                    `,
                  )}
                </ul>
              `}
          `
          : nothing}
      </div>
    `;
  }

  private _renderKeyManagement() {
    const byok = forgeStateManager.byokStatus.value;

    return html`
      <div class="mint__keys-section">
        <h3 class="mint__keys-header">${msg('Your API Keys')}</h3>
        <p class="mint__keys-desc">
          ${msg('Bring your own keys to bypass token costs. Keys are AES-256 encrypted at rest.')}
        </p>

        <div class="mint__key-field">
          <label class="mint__key-label">
            OpenRouter
            <span class="mint__key-status ${byok.has_openrouter_key ? 'mint__key-status--set' : 'mint__key-status--unset'}">
              ${byok.has_openrouter_key ? '\u2713 ' + msg('configured') : '\u2717 ' + msg('not set')}
            </span>
          </label>
          <input
            type="password"
            class="mint__key-input"
            placeholder="sk-or-v1-..."
            .value=${this._orKey}
            @input=${(e: InputEvent) => { this._orKey = (e.target as HTMLInputElement).value; }}
          />
        </div>

        <div class="mint__key-field">
          <label class="mint__key-label">
            Replicate
            <span class="mint__key-status ${byok.has_replicate_key ? 'mint__key-status--set' : 'mint__key-status--unset'}">
              ${byok.has_replicate_key ? '\u2713 ' + msg('configured') : '\u2717 ' + msg('not set')}
            </span>
          </label>
          <input
            type="password"
            class="mint__key-input"
            placeholder="r8_..."
            .value=${this._repKey}
            @input=${(e: InputEvent) => { this._repKey = (e.target as HTMLInputElement).value; }}
          />
        </div>

        <div class="mint__keys-actions">
          <button
            class="btn--save-keys"
            ?disabled=${this._isSavingKeys || (!this._orKey && !this._repKey)}
            @click=${this._saveKeys}
          >
            ${this._isSavingKeys ? msg('Saving...') : msg('Save Keys')}
          </button>
          <span class="mint__keys-hint">
            ${byok.has_openrouter_key && byok.has_replicate_key
              ? msg('Both keys configured — enter new values to update.')
              : msg('Set both keys to enable BYOK access.')}
          </span>
        </div>
      </div>
    `;
  }

  protected render() {
    if (!forgeStateManager.mintOpen.value) return nothing;

    const bundles = forgeStateManager.bundles.value;
    const balance = forgeStateManager.walletBalance.value;
    const byok = forgeStateManager.byokStatus.value;
    const selectedBundle = bundles.find((b) => b.slug === this._selectedSlug);
    const history = forgeStateManager.purchaseHistory.value;
    const showCallout = balance === 0 && history.length === 0 && !byok.effective_bypass;

    return html`
      <div
        class="mint"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mint-title"
        @keydown=${this._handleFocusTrap}
      >
        <div class="mint__header">
          <h2 class="mint__title" id="mint-title">${msg('The Mint')}</h2>
          <div class="mint__balance">
            ${byok.effective_bypass
              ? html`<span>&#x1F511; BYOK</span>`
              : html`
                  <span class="mint__balance-icon" aria-hidden="true">&#x2B23;</span>
                  <span role="status" aria-live="polite">${balance}</span>
                `
            }
          </div>
          <button
            class="mint__close"
            @click=${this._close}
            aria-label=${msg('Close')}
          >&times;</button>
        </div>

        <div class="mint__body">
          ${byok.effective_bypass
            ? html`
              <div class="mint__byok-banner">
                <div class="mint__byok-title">${msg('CLEARANCE: UNLIMITED')}</div>
                <div class="mint__byok-subtitle">${msg('Your Bureau-issued keys grant unrestricted materialization access.')}</div>
                <div class="mint__byok-keys">
                  <span class="mint__byok-key ${byok.has_openrouter_key ? 'mint__byok-key--active' : 'mint__byok-key--missing'}">
                    ${byok.has_openrouter_key ? '\u2713' : '\u2717'} OpenRouter
                  </span>
                  <span class="mint__byok-key ${byok.has_replicate_key ? 'mint__byok-key--active' : 'mint__byok-key--missing'}">
                    ${byok.has_replicate_key ? '\u2713' : '\u2717'} Replicate
                  </span>
                </div>
              </div>
            `
            : html`
              <div class="mint__grid" role="radiogroup" aria-label=${msg('Token bundles')}>
                ${bundles.map((b) => this._renderBundle(b))}
              </div>
            `
          }

          ${!byok.effective_bypass && (byok.has_openrouter_key || byok.has_replicate_key)
            ? html`
              <div class="mint__callout" style="margin-bottom: var(--space-4, 16px)">
                ${msg('Configure both API keys to enable unlimited access.')}
                <div class="mint__byok-keys" style="margin-top: var(--space-2, 8px)">
                  <span class="mint__byok-key ${byok.has_openrouter_key ? 'mint__byok-key--active' : 'mint__byok-key--missing'}">
                    ${byok.has_openrouter_key ? '\u2713' : '\u2717'} OpenRouter
                  </span>
                  <span class="mint__byok-key ${byok.has_replicate_key ? 'mint__byok-key--active' : 'mint__byok-key--missing'}">
                    ${byok.has_replicate_key ? '\u2713' : '\u2717'} Replicate
                  </span>
                </div>
              </div>
            `
            : nothing
          }

          ${selectedBundle
            ? html`
              <div class="mint__purchase">
                <p class="mint__purchase-info">
                  ${msg('Add')} ${selectedBundle.tokens} ${msg('Forge Tokens')} ${msg('for')} ${this._formatPrice(selectedBundle.price_cents)}
                </p>
                <button
                  class="btn btn--purchase"
                  ?disabled=${this._isPurchasing}
                  aria-busy=${this._isPurchasing}
                  @click=${this._purchase}
                >
                  ${this._isPurchasing ? msg('Processing...') : msg('Purchase')}
                </button>
              </div>
            `
            : nothing}

          ${showCallout
            ? html`<p class="mint__callout">${msg('Your first shard is free with Architect access')}</p>`
            : nothing}

          ${byok.byok_allowed ? this._renderKeyManagement() : nothing}

          ${this._renderHistory()}
        </div>

        ${this._toast
          ? html`
            <div class="mint__toast mint__toast--${this._toast.type}" role="alert">
              ${this._toast.message}
            </div>
          `
          : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-forge-mint': VelgForgeMint;
  }
}
