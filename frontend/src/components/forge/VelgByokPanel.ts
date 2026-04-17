/**
 * VelgByokPanel — Bureau Clearance Protocol
 *
 * Standalone BYOK (Bring Your Own Key) management component.
 * Replaces duplicated key management in VelgForgeMint and AdminForgeTab.
 *
 * Two modes:
 * - 'user' (default): Bureau-themed key-card aesthetic inside the Mint
 * - 'admin': Settings-panel layout inside AdminForgeTab SEC-08
 *
 * Handles all BYOK states internally:
 * - Bypass active (CLEARANCE: UNLIMITED banner + benefit grid)
 * - Awareness (onboarding callout when allowed but no keys)
 * - Key management (input, reveal, validate, save, remove)
 */
import { localized, msg, str } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { forgeApi, type TestBYOKResult } from '../../services/api/ForgeApiService.js';
import { forgeStateManager } from '../../services/ForgeStateManager.js';
import { captureError } from '../../services/SentryService.js';
import { icons } from '../../utils/icons.js';
import { VelgConfirmDialog } from '../shared/ConfirmDialog.js';
import { VelgToast } from '../shared/Toast.js';
import '../shared/VelgHelpTip.js';

type KeyValidation = 'valid' | 'invalid' | 'empty';
type TestState = 'idle' | 'testing' | 'success' | 'error';

@localized()
@customElement('velg-byok-panel')
export class VelgByokPanel extends SignalWatcher(LitElement) {
  static styles = css`
    /* ── Tier 3: Component-local tokens ──────────────── */

    :host {
      display: block;
      --_accent: var(--color-accent-amber);
      --_accent-dim: color-mix(in srgb, var(--color-accent-amber) 6%, transparent);
      --_accent-border: color-mix(in srgb, var(--color-accent-amber) 30%, transparent);
      --_success-dim: color-mix(in srgb, var(--color-success) 8%, transparent);
      --_danger-dim: color-mix(in srgb, var(--color-danger) 8%, transparent);
    }

    /* ── Container ───────────────────────────────────── */

    .byok {
      width: 100%;
      border: 2px solid var(--_accent-border);
      background: var(--color-surface-raised);
      padding: var(--space-6, 24px);
      animation: byok-enter var(--duration-entrance, 350ms) var(--ease-dramatic) both;
    }

    @keyframes byok-enter {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
    }

    /* ── Header ──────────────────────────────────────── */

    .byok__header {
      display: flex;
      align-items: center;
      gap: var(--space-2, 8px);
      margin-bottom: var(--space-1, 4px);
    }

    .byok__header-icon {
      color: var(--_accent);
      flex-shrink: 0;
    }

    .byok__title {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: var(--font-black, 900);
      font-size: var(--text-base, 16px);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist, 0.08em);
      color: var(--_accent);
      margin: 0;
    }

    .byok__subtitle {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs, 12px);
      color: var(--color-text-muted);
      margin: 0 0 var(--space-5, 20px);
    }

    /* ── Bypass Banner ───────────────────────────────── */

    .byok__bypass {
      border: 2px solid var(--_accent);
      background: var(--_accent-dim);
      padding: var(--space-5, 20px);
      text-align: center;
      margin-bottom: var(--space-5, 20px);
      animation: byok-enter var(--duration-entrance, 350ms) var(--ease-dramatic) both;
    }

    .byok__bypass-title {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: var(--font-black, 900);
      font-size: var(--text-lg, 18px);
      text-transform: uppercase;
      letter-spacing: 0.15em;
      color: var(--_accent);
      margin: 0 0 var(--space-1, 4px);
    }

    .byok__bypass-subtitle {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm, 14px);
      color: var(--color-text-secondary);
      margin: 0 0 var(--space-4, 16px);
    }

    .byok__bypass-keys {
      display: flex;
      justify-content: center;
      gap: var(--space-6, 24px);
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm, 14px);
      margin-bottom: var(--space-4, 16px);
    }

    .byok__bypass-key {
      display: flex;
      align-items: center;
      gap: var(--space-2, 8px);
    }

    .byok__bypass-key--active {
      color: var(--color-success);
    }

    .byok__bypass-key--missing {
      color: var(--color-text-muted);
    }

    .byok__benefits {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-2, 8px);
      text-align: left;
    }

    .byok__benefit {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs, 12px);
      color: var(--color-text-secondary);
      display: flex;
      align-items: center;
      gap: var(--space-1-5, 6px);
    }

    .byok__benefit-check {
      color: var(--color-success);
      flex-shrink: 0;
    }

    /* ── Awareness Banner ────────────────────────────── */

    .byok__awareness {
      border: 1px dashed var(--_accent-border);
      background: var(--_accent-dim);
      padding: var(--space-4, 16px);
      margin-bottom: var(--space-5, 20px);
      animation: byok-enter var(--duration-entrance, 350ms) var(--ease-dramatic) both;
      animation-delay: calc(1 * var(--duration-stagger, 40ms));
    }

    .byok__awareness-title {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: var(--font-black, 900);
      font-size: var(--text-sm, 14px);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide, 0.025em);
      color: var(--_accent);
      margin: 0 0 var(--space-1, 4px);
    }

    .byok__awareness-desc {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs, 12px);
      color: var(--color-text-muted);
      line-height: var(--leading-relaxed, 1.625);
      margin: 0;
    }

    /* ── Key Cards ────────────────────────────────────── */

    .byok__keys {
      display: flex;
      flex-direction: column;
      gap: var(--space-4, 16px);
      margin-bottom: var(--space-5, 20px);
    }

    .byok__key-card {
      border: 1px solid var(--color-border-light);
      border-left: 3px solid var(--color-text-muted);
      background: var(--color-surface);
      padding: var(--space-4, 16px);
      transition: border-color var(--transition-fast);
      animation: byok-enter var(--duration-entrance, 350ms) var(--ease-dramatic) both;
    }

    .byok__key-card[data-configured] {
      border-left-color: var(--color-success);
    }

    .byok__key-card:nth-child(1) {
      animation-delay: calc(2 * var(--duration-stagger, 40ms));
    }

    .byok__key-card:nth-child(2) {
      animation-delay: calc(3 * var(--duration-stagger, 40ms));
    }

    /* ── Key Card Header ─────────────────────────────── */

    .byok__key-header {
      display: flex;
      align-items: center;
      gap: var(--space-2, 8px);
      margin-bottom: var(--space-1, 4px);
    }

    .byok__key-icon {
      color: var(--_accent);
      flex-shrink: 0;
    }

    .byok__key-provider {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: var(--font-black, 900);
      font-size: var(--text-sm, 14px);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide, 0.025em);
      color: var(--color-text-primary);
    }

    .byok__key-codename {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs, 12px);
      color: var(--color-text-muted);
    }

    .byok__key-status {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1, 4px);
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      padding: var(--space-0-5, 2px) var(--space-2, 8px);
      margin-left: auto;
    }

    .byok__key-status--set {
      color: var(--color-success);
      background: var(--_success-dim);
    }

    .byok__key-status--unset {
      color: var(--color-text-muted);
    }

    /* ── Key Card Description ────────────────────────── */

    .byok__key-desc {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs, 12px);
      color: var(--color-text-muted);
      line-height: var(--leading-relaxed, 1.625);
      margin: 0 0 var(--space-3, 12px);
    }

    .byok__key-link {
      color: var(--_accent);
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    .byok__key-link:hover {
      color: var(--color-accent-amber-hover);
    }

    /* ── Input Row ────────────────────────────────────── */

    .byok__input-row {
      display: flex;
      align-items: center;
      gap: var(--space-2, 8px);
    }

    .byok__input-wrap {
      flex: 1;
      position: relative;
    }

    .byok__input {
      width: 100%;
      padding: var(--space-2-5, 10px) var(--space-10, 40px) var(--space-2-5, 10px) var(--space-3, 12px);
      background: var(--color-surface-sunken);
      border: 1px solid var(--color-border);
      color: var(--color-text-primary);
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm, 14px);
      box-sizing: border-box;
      transition: border-color var(--transition-fast);
    }

    @media (max-width: 768px) {
      .byok__input {
        font-size: 16px;
      }
    }

    .byok__input::placeholder {
      color: var(--color-text-muted);
    }

    .byok__input:focus {
      outline: none;
      border-color: var(--_accent);
    }

    .byok__input--invalid:not(:focus) {
      border-color: var(--color-danger);
    }

    .byok__reveal-btn {
      position: absolute;
      right: var(--space-0-5, 2px);
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      color: var(--color-text-muted);
      cursor: pointer;
      padding: var(--space-2, 8px);
      min-width: 44px;
      min-height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color var(--transition-fast);
    }

    .byok__reveal-btn:hover {
      color: var(--color-text-primary);
    }

    .byok__reveal-btn:focus-visible {
      outline: 2px solid var(--_accent);
      outline-offset: -2px;
    }

    .byok__remove-btn {
      background: none;
      border: 1px solid var(--color-border-light);
      color: var(--color-text-muted);
      cursor: pointer;
      padding: var(--space-1-5, 6px) var(--space-2-5, 10px);
      display: flex;
      align-items: center;
      gap: var(--space-1, 4px);
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: var(--font-black, 900);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide, 0.025em);
      transition: color var(--transition-fast), border-color var(--transition-fast), background var(--transition-fast);
      min-height: 36px;
      flex-shrink: 0;
    }

    .byok__remove-btn:hover {
      color: var(--color-danger);
      border-color: var(--color-danger);
      background: var(--_danger-dim);
    }

    .byok__remove-btn:focus-visible {
      outline: 2px solid var(--color-danger);
      outline-offset: 2px;
    }

    /* ── Validation Hint ─────────────────────────────── */

    .byok__validation {
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      color: var(--color-danger);
      margin-top: var(--space-1, 4px);
    }

    /* ── Test Key ─────────────────────────────────────── */

    .byok__test-row {
      display: flex;
      align-items: center;
      gap: var(--space-2, 8px);
      margin-top: var(--space-2, 8px);
    }

    .byok__test-btn {
      background: transparent;
      border: 1px solid var(--color-border);
      color: var(--color-text-secondary);
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: var(--font-black, 900);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide, 0.025em);
      padding: var(--space-1, 4px) var(--space-3, 12px);
      cursor: pointer;
      min-height: 44px;
      transition: border-color var(--transition-fast), color var(--transition-fast);
    }

    .byok__test-btn:hover:not(:disabled) {
      border-color: var(--_accent);
      color: var(--_accent);
    }

    .byok__test-btn:focus-visible {
      outline: 2px solid var(--_accent);
      outline-offset: 2px;
    }

    .byok__test-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .byok__test-badge {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1, 4px);
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      padding: var(--space-0-5, 2px) var(--space-2, 8px);
      animation: byok-enter var(--duration-normal, 200ms) var(--ease-dramatic) both;
    }

    .byok__test-badge--success {
      color: var(--color-success);
      background: var(--_success-dim);
    }

    .byok__test-badge--error {
      color: var(--color-danger);
      background: var(--_danger-dim);
    }

    .byok__test-badge--testing {
      color: var(--color-text-muted);
    }

    @keyframes byok-pulse {
      50% { opacity: 0.5; }
    }

    .byok__test-badge--testing {
      animation: byok-pulse 1s step-end infinite;
    }

    .byok__test-detail {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--color-text-muted);
    }

    /* ── Hide native browser password toggles ──────── */

    .byok__input::-ms-reveal,
    .byok__input::-ms-clear {
      display: none;
    }

    /* ── Visually hidden (a11y) ────────────────────── */

    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    /* ── Actions ──────────────────────────────────────── */

    .byok__actions {
      display: flex;
      align-items: center;
      gap: var(--space-3, 12px);
      animation: byok-enter var(--duration-entrance, 350ms) var(--ease-dramatic) both;
      animation-delay: calc(4 * var(--duration-stagger, 40ms));
    }

    .byok__save-btn {
      background: transparent;
      border: 2px solid var(--_accent);
      color: var(--_accent);
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: var(--font-black, 900);
      font-size: var(--text-sm, 14px);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      padding: var(--space-2-5, 10px) var(--space-6, 24px);
      cursor: pointer;
      min-height: 44px;
      transition: background var(--transition-fast), color var(--transition-fast);
    }

    .byok__save-btn:hover:not(:disabled) {
      background: var(--_accent);
      color: var(--color-surface-sunken);
    }

    .byok__save-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .byok__save-btn:focus-visible {
      outline: 2px solid var(--_accent);
      outline-offset: 2px;
    }

    .byok__hint {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs, 12px);
      color: var(--color-text-muted);
    }

    /* ── Admin Mode Overrides ────────────────────────── */

    :host([mode='admin']) .byok {
      border: none;
      background: transparent;
      padding: 0;
    }

    :host([mode='admin']) .byok__title {
      color: var(--color-text-primary);
    }

    :host([mode='admin']) .byok__key-card {
      border-left-width: 2px;
    }

    /* ── Responsive ───────────────────────────────────── */

    @media (max-width: 640px) {
      .byok {
        padding: var(--space-4, 16px);
      }

      .byok__bypass-keys {
        flex-direction: column;
        gap: var(--space-2, 8px);
      }

      .byok__benefits {
        grid-template-columns: 1fr;
      }

      .byok__input-row {
        flex-wrap: wrap;
      }

      .byok__remove-btn {
        width: 100%;
        min-height: 44px;
        justify-content: center;
      }

      .byok__actions {
        flex-direction: column;
        align-items: stretch;
      }

      .byok__hint {
        text-align: center;
      }
    }

    /* ── Reduced Motion ───────────────────────────────── */

    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
      }
    }
  `;

  @property({ type: String, reflect: true }) mode: 'user' | 'admin' = 'user';

  @state() private _orKey = '';
  @state() private _repKey = '';
  @state() private _isSaving = false;
  @state() private _isRemoving = false;
  @state() private _showOrKey = false;
  @state() private _showRepKey = false;
  @state() private _orTestState: TestState = 'idle';
  @state() private _repTestState: TestState = 'idle';
  @state() private _orTestResult: TestBYOKResult | null = null;
  @state() private _repTestResult: TestBYOKResult | null = null;

  // ── Render ─────────────────────────────────────────

  protected render() {
    const byok = forgeStateManager.byokStatus.value;

    return html`
      <div class="byok">
        ${this._renderHeader()}
        ${byok.effective_bypass ? this._renderBypassBanner() : nothing}
        ${
          byok.byok_allowed &&
          !byok.effective_bypass &&
          !byok.has_openrouter_key &&
          !byok.has_replicate_key
            ? this._renderAwarenessBanner()
            : nothing
        }
        <div class="byok__keys">
          ${this._renderKeyCard(
            'openrouter',
            'OpenRouter',
            msg('LANGUAGE RELAY'),
            byok.has_openrouter_key,
            this._orKey,
            this._showOrKey,
            'sk-or-v1-...',
            msg('Powers narrative generation, agent operations, and astrolabe research.'),
            'https://openrouter.ai/keys',
          )}
          ${this._renderKeyCard(
            'replicate',
            'Replicate',
            msg('VISUAL ARRAY'),
            byok.has_replicate_key,
            this._repKey,
            this._showRepKey,
            'r8_...',
            msg('Powers darkroom rendering, agent portraits, and building imagery.'),
            'https://replicate.com/account/api-tokens',
          )}
        </div>
        ${this._renderActions()}
      </div>
    `;
  }

  // ── Sub-renders ────────────────────────────────────

  private _renderHeader() {
    return html`
      <div class="byok__header">
        <span class="byok__header-icon">${icons.key(18)}</span>
        <h3 class="byok__title">
          ${this.mode === 'admin' ? msg('Personal API Keys') : msg('Bureau Clearance Protocol')}
        </h3>
        <velg-help-tip
          topic="byok"
          label=${msg('What is BYOK?')}
        ></velg-help-tip>
      </div>
      <p class="byok__subtitle">
        ${
          this.mode === 'admin'
            ? msg('AES-256 encrypted at rest. Bypass platform quota with your own keys.')
            : msg('Operative key-card assignment. Keys are AES-256 encrypted at rest.')
        }
      </p>
    `;
  }

  private _renderBypassBanner() {
    const byok = forgeStateManager.byokStatus.value;
    return html`
      <div class="byok__bypass">
        <div class="byok__bypass-title">${msg('CLEARANCE: UNLIMITED')}</div>
        <div class="byok__bypass-subtitle">
          ${msg('Your Bureau-issued keys grant unrestricted materialization access.')}
        </div>
        <div class="byok__bypass-keys">
          <span class="byok__bypass-key ${byok.has_openrouter_key ? 'byok__bypass-key--active' : 'byok__bypass-key--missing'}">
            ${byok.has_openrouter_key ? '\u2713' : '\u2717'} OpenRouter
          </span>
          <span class="byok__bypass-key ${byok.has_replicate_key ? 'byok__bypass-key--active' : 'byok__bypass-key--missing'}">
            ${byok.has_replicate_key ? '\u2713' : '\u2717'} Replicate
          </span>
        </div>
        <div class="byok__benefits">
          <span class="byok__benefit">
            <span class="byok__benefit-check">${icons.checkCircle(12)}</span>
            ${msg('Unlimited narrative generation')}
          </span>
          <span class="byok__benefit">
            <span class="byok__benefit-check">${icons.checkCircle(12)}</span>
            ${msg('Unlimited image materialization')}
          </span>
          <span class="byok__benefit">
            <span class="byok__benefit-check">${icons.checkCircle(12)}</span>
            ${msg('Autonomous agent operations')}
          </span>
          <span class="byok__benefit">
            <span class="byok__benefit-check">${icons.checkCircle(12)}</span>
            ${msg('Zero forge token consumption')}
          </span>
        </div>
      </div>
    `;
  }

  private _renderAwarenessBanner() {
    return html`
      <div class="byok__awareness">
        <div class="byok__awareness-title">${msg('Clearance Available')}</div>
        <p class="byok__awareness-desc">
          ${msg('Supply your operative credentials below to unlock unrestricted materialization access. No forge tokens required.')}
        </p>
      </div>
    `;
  }

  private _renderKeyCard(
    provider: 'openrouter' | 'replicate',
    providerName: string,
    codename: string,
    hasKey: boolean,
    keyValue: string,
    showKey: boolean,
    placeholder: string,
    description: string,
    signupUrl: string,
  ) {
    const validation = this._validateKeyFormat(keyValue, provider);
    const inputType = showKey ? 'text' : 'password';
    const maskedPlaceholder = hasKey ? '********' : placeholder;
    const inputId = `byok-input-${provider}`;
    const revealDisabled = !keyValue && !hasKey;
    const testState = provider === 'openrouter' ? this._orTestState : this._repTestState;
    const testResult = provider === 'openrouter' ? this._orTestResult : this._repTestResult;

    return html`
      <div class="byok__key-card" ?data-configured=${hasKey}>
        <div class="byok__key-header">
          <span class="byok__key-icon">${icons.key(14)}</span>
          <span class="byok__key-provider">${providerName}</span>
          <span class="byok__key-codename">${codename}</span>
          <span class="byok__key-status ${hasKey ? 'byok__key-status--set' : 'byok__key-status--unset'}">
            ${
              hasKey ? html`${icons.checkCircle(11)} ${msg('configured')}` : html`${msg('not set')}`
            }
          </span>
        </div>

        <p class="byok__key-desc">
          ${description}
          <a class="byok__key-link" href=${signupUrl} target="_blank" rel="noopener noreferrer">
            ${msg('Get your key')} &rarr;
          </a>
        </p>

        <div class="byok__input-row">
          <div class="byok__input-wrap">
            <input
              id=${inputId}
              type=${inputType}
              class="byok__input ${validation === 'invalid' ? 'byok__input--invalid' : ''}"
              placeholder=${maskedPlaceholder}
              .value=${keyValue}
              aria-label=${msg(str`${providerName} API key`)}
              @input=${(e: InputEvent) => this._handleInput(provider, e)}
            />
            <button
              class="byok__reveal-btn"
              type="button"
              aria-pressed=${showKey ? 'true' : 'false'}
              aria-controls=${inputId}
              ?disabled=${revealDisabled}
              @click=${() => this._toggleReveal(provider)}
            >
              ${showKey ? icons.eyeOff(16) : icons.eye(16)}
              <span class="visually-hidden">${showKey ? msg('Hide key') : msg('Show key')}</span>
            </button>
          </div>
          ${
            hasKey
              ? html`
              <button
                class="byok__remove-btn"
                type="button"
                ?disabled=${this._isRemoving}
                @click=${() => this._handleRemoveKey(provider, providerName)}
              >
                ${icons.trash(12)}
                ${msg('Revoke')}
              </button>
            `
              : nothing
          }
        </div>

        ${
          validation === 'invalid'
            ? html`<div class="byok__validation">
              ${
                provider === 'openrouter'
                  ? msg('Expected format: sk-or-...')
                  : msg('Expected format: r8_...')
              }
            </div>`
            : nothing
        }

        ${
          keyValue || testState !== 'idle'
            ? html`
            <div class="byok__test-row">
              <button
                class="byok__test-btn"
                type="button"
                ?disabled=${testState === 'testing' || !keyValue}
                @click=${() => this._handleTestKey(provider, keyValue)}
              >
                ${testState === 'testing' ? msg('Verifying...') : msg('Verify Clearance')}
              </button>
              ${this._renderTestBadge(testState, testResult)}
            </div>
          `
            : nothing
        }
      </div>
    `;
  }

  private _renderTestBadge(testState: TestState, result: TestBYOKResult | null) {
    if (testState === 'idle') return nothing;
    if (testState === 'testing') {
      return html`<span class="byok__test-badge byok__test-badge--testing">${msg('Testing...')}</span>`;
    }
    if (testState === 'success' && result) {
      return html`
        <span class="byok__test-badge byok__test-badge--success">
          ${icons.checkCircle(11)} ${msg('Verified')}
        </span>
        <span class="byok__test-detail">${result.response_ms}ms</span>
      `;
    }
    if (testState === 'error' && result) {
      return html`
        <span class="byok__test-badge byok__test-badge--error">
          ${icons.xCircle(11)} ${msg('Failed')}
        </span>
        <span class="byok__test-detail">${result.detail}</span>
      `;
    }
    return nothing;
  }

  private _renderActions() {
    const byok = forgeStateManager.byokStatus.value;
    const hasInput = Boolean(this._orKey || this._repKey);
    const bothConfigured = byok.has_openrouter_key && byok.has_replicate_key;

    return html`
      <div class="byok__actions">
        <button
          class="byok__save-btn"
          ?disabled=${this._isSaving || !hasInput}
          @click=${this._handleSave}
        >
          ${
            this._isSaving
              ? msg('Registering...')
              : this.mode === 'admin'
                ? msg('Save Keys')
                : msg('Register Keys')
          }
        </button>
        <span class="byok__hint">
          ${
            bothConfigured
              ? msg('Both keys configured. Enter new values to update.')
              : msg('Configure both keys to enable unlimited access.')
          }
        </span>
      </div>
    `;
  }

  // ── Logic ──────────────────────────────────────────

  private _handleInput(provider: 'openrouter' | 'replicate', e: InputEvent): void {
    const value = (e.target as HTMLInputElement).value;
    if (provider === 'openrouter') {
      this._orKey = value;
      this._orTestState = 'idle';
      this._orTestResult = null;
    } else {
      this._repKey = value;
      this._repTestState = 'idle';
      this._repTestResult = null;
    }
  }

  private _toggleReveal(provider: 'openrouter' | 'replicate'): void {
    if (provider === 'openrouter') {
      this._showOrKey = !this._showOrKey;
    } else {
      this._showRepKey = !this._showRepKey;
    }
  }

  private _validateKeyFormat(value: string, provider: string): KeyValidation {
    if (!value || value.length < 4) return 'empty';
    if (provider === 'openrouter' && !value.startsWith('sk-or-')) return 'invalid';
    if (provider === 'replicate' && !value.startsWith('r8_')) return 'invalid';
    return 'valid';
  }

  private async _handleTestKey(provider: 'openrouter' | 'replicate', key: string): Promise<void> {
    if (!key) return;

    if (provider === 'openrouter') {
      this._orTestState = 'testing';
    } else {
      this._repTestState = 'testing';
    }

    try {
      const resp = await forgeApi.testBYOK(provider, key);
      const result = resp.success && resp.data ? (resp.data as TestBYOKResult) : null;
      if (provider === 'openrouter') {
        this._orTestResult = result;
        this._orTestState = result?.valid ? 'success' : 'error';
      } else {
        this._repTestResult = result;
        this._repTestState = result?.valid ? 'success' : 'error';
      }
    } catch (err) {
      captureError(err, { source: 'VelgByokPanel._handleTestKey', provider });
      const fallback: TestBYOKResult = { valid: false, detail: 'Network error', response_ms: 0 };
      if (provider === 'openrouter') {
        this._orTestResult = fallback;
        this._orTestState = 'error';
      } else {
        this._repTestResult = fallback;
        this._repTestState = 'error';
      }
    }
  }

  private async _handleSave(): Promise<void> {
    if (this._isSaving) return;
    if (!this._orKey && !this._repKey) return;

    // Warn on invalid format (non-blocking)
    const orValid = this._validateKeyFormat(this._orKey, 'openrouter');
    const repValid = this._validateKeyFormat(this._repKey, 'replicate');
    if (orValid === 'invalid' || repValid === 'invalid') {
      const proceed = await VelgConfirmDialog.show({
        title: msg('Format Warning'),
        message: msg('One or more keys do not match the expected format. Save anyway?'),
        confirmLabel: msg('Save'),
        variant: 'default',
      });
      if (!proceed) return;
    }

    this._isSaving = true;
    try {
      const payload: { openrouter_key?: string; replicate_key?: string } = {};
      if (this._orKey) payload.openrouter_key = this._orKey;
      if (this._repKey) payload.replicate_key = this._repKey;

      const resp = await forgeApi.updateBYOK(payload);
      if (resp.success) {
        this._orKey = '';
        this._repKey = '';
        this._showOrKey = false;
        this._showRepKey = false;
        await forgeStateManager.loadWallet();
        VelgToast.success(msg('API keys registered and encrypted.'));
        this.dispatchEvent(new CustomEvent('byok-saved', { bubbles: true, composed: true }));
      } else {
        VelgToast.error(
          (resp.error as { message?: string } | undefined)?.message ?? msg('Failed to save keys'),
        );
      }
    } catch (err) {
      captureError(err, { source: 'VelgByokPanel._handleSave' });
      VelgToast.error(msg('Failed to save keys'));
    } finally {
      this._isSaving = false;
    }
  }

  private async _handleRemoveKey(
    provider: 'openrouter' | 'replicate',
    displayName: string,
  ): Promise<void> {
    const confirmed = await VelgConfirmDialog.show({
      title: msg('Revoke API Key'),
      message: msg(str`Remove your ${displayName} key? This cannot be undone.`),
      confirmLabel: msg('Revoke Key'),
      variant: 'danger',
    });
    if (!confirmed) return;

    this._isRemoving = true;
    try {
      const resp = await forgeApi.deleteBYOK(provider);
      if (resp.success) {
        await forgeStateManager.loadWallet();
        VelgToast.success(msg(str`${displayName} key revoked.`));
        this.dispatchEvent(
          new CustomEvent('byok-removed', {
            bubbles: true,
            composed: true,
            detail: { provider },
          }),
        );
      } else {
        VelgToast.error(
          (resp.error as { message?: string } | undefined)?.message ?? msg('Failed to remove key'),
        );
      }
    } catch (err) {
      captureError(err, { source: 'VelgByokPanel._handleRemoveKey' });
      VelgToast.error(msg('Failed to remove key'));
    } finally {
      this._isRemoving = false;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-byok-panel': VelgByokPanel;
  }
}
