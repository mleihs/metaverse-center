import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import type { CipherRedemptionResult } from '../../services/api/BureauApiService.js';
import { bureauApi } from '../../services/api/BureauApiService.js';
import { icons } from '../../utils/icons.js';

type ViewState = 'idle' | 'decoding' | 'success' | 'error' | 'rate_limited';

@localized()
@customElement('velg-bureau-dispatch-terminal')
export class VelgBureauDispatch extends LitElement {
  // ── State ──────────────────────────────────────────────────────────

  @state() private _state: ViewState = 'idle';
  @state() private _code = '';
  @state() private _errorMessage = '';
  @state() private _attemptsRemaining: number | null = null;
  @state() private _countdownSeconds = 0;
  @state() private _rewardType = '';
  @state() private _rewardData: Record<string, unknown> = {};

  @query('#cipher-input') private _input!: HTMLInputElement;

  private _countdownTimer: ReturnType<typeof setInterval> | null = null;

  // ── Lifecycle ──────────────────────────────────────────────────────

  connectedCallback(): void {
    super.connectedCallback();
    // noindex — don't index the unlock page
    let meta = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'robots';
      document.head.appendChild(meta);
    }
    meta.content = 'noindex';
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._countdownTimer) {
      clearInterval(this._countdownTimer);
      this._countdownTimer = null;
    }
  }

  // ── Actions ────────────────────────────────────────────────────────

  private async _handleSubmit(e: Event): Promise<void> {
    e.preventDefault();
    const code = this._code.trim();
    if (!code) return;

    this._state = 'decoding';
    this._errorMessage = '';

    // Dramatic pause for the decoding animation
    await new Promise((r) => setTimeout(r, 1800));

    const response = await bureauApi.redeemCipher(code);

    if (!response.success) {
      this._state = 'error';
      this._errorMessage = response.error?.message ?? msg('Connection lost. Try again.');
      return;
    }

    const result = response.data as CipherRedemptionResult;

    if (result?.success) {
      this._state = 'success';
      this._rewardType = result.reward_type ?? '';
      this._rewardData = (result.reward_data as Record<string, unknown>) ?? {};
      return;
    }

    // Handle specific cipher errors
    if (result?.error_code === 'rate_limited') {
      this._state = 'rate_limited';
      this._startCountdown(result.retry_after_seconds ?? 3600);
      return;
    }

    if (result?.error_code === 'already_redeemed') {
      this._state = 'error';
      this._errorMessage = msg('Cipher already redeemed from this terminal.');
      return;
    }

    this._state = 'error';
    this._errorMessage = result?.user_message ?? msg('Invalid cipher code.');
    this._attemptsRemaining = result?.attempts_remaining ?? null;
  }

  private _startCountdown(seconds: number): void {
    this._countdownSeconds = seconds;
    if (this._countdownTimer) clearInterval(this._countdownTimer);
    this._countdownTimer = setInterval(() => {
      this._countdownSeconds--;
      if (this._countdownSeconds <= 0) {
        clearInterval(this._countdownTimer!);
        this._countdownTimer = null;
        this._state = 'idle';
      }
    }, 1000);
  }

  private _handleReset(): void {
    this._state = 'idle';
    this._code = '';
    this._errorMessage = '';
    this._attemptsRemaining = null;
    this.updateComplete.then(() => this._input?.focus());
  }

  private _formatCountdown(s: number): string {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  // ── Styles ─────────────────────────────────────────────────────────

  static styles = css`
    /* ── Tier 3: component-local tokens ────────────────────────────── */
    :host {
      display: block;
      min-height: 100dvh;
      color: var(--color-text-primary);

      --_amber: var(--color-primary);
      --_amber-dim: color-mix(in srgb, var(--color-primary) 40%, transparent);
      --_amber-glow: color-mix(in srgb, var(--color-primary) 10%, transparent);
      --_amber-text: color-mix(in srgb, var(--color-primary) 85%, var(--color-text-primary));
      --_scanline: color-mix(in srgb, var(--color-primary) 4%, transparent);
      --_terminal-bg: color-mix(in srgb, var(--color-primary) 2%, var(--color-surface));
      --_bezel: color-mix(in srgb, var(--color-primary) 8%, var(--color-surface-raised));
      --_error-flash: color-mix(in srgb, var(--color-danger) 10%, var(--color-surface));
      --_success-glow: color-mix(in srgb, var(--color-success) 6%, var(--color-surface));
      --_border-amber: color-mix(in srgb, var(--color-primary) 25%, var(--color-border));
      --_classified-red: color-mix(in srgb, var(--color-danger) 70%, var(--color-text-primary));
    }

    /* ── Layout ────────────────────────────────────────────────────── */
    .dispatch {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100dvh;
      padding: var(--space-6);
      background: var(--color-surface);
    }

    /* ── Terminal frame ────────────────────────────────────────────── */
    .terminal {
      position: relative;
      width: 100%;
      max-width: 640px;
      border: 1px solid var(--_border-amber);
      border-radius: var(--space-2);
      background: var(--_terminal-bg);
      overflow: hidden;
      box-shadow:
        0 0 40px var(--_amber-glow),
        inset 0 0 60px color-mix(in srgb, var(--color-primary) 3%, transparent);
    }

    /* CRT scanline overlay */
    .terminal::after {
      content: '';
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        0deg,
        var(--_scanline) 0px,
        var(--_scanline) 1px,
        transparent 1px,
        transparent 3px
      );
      pointer-events: none;
      z-index: 1;
    }

    /* ── Terminal header ───────────────────────────────────────────── */
    .terminal__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-3) var(--space-4);
      border-bottom: 1px solid var(--_border-amber);
      background: var(--_bezel);
    }

    .terminal__title {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-widest);
      text-transform: uppercase;
      color: var(--_amber-text);
    }

    .terminal__status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--_amber);
      box-shadow: 0 0 6px var(--_amber);
      animation: pulse-dot 2s ease-in-out infinite;
    }

    .terminal__status-dot--error {
      background: var(--color-danger);
      box-shadow: 0 0 6px var(--color-danger);
    }

    .terminal__status-dot--success {
      background: var(--color-success);
      box-shadow: 0 0 6px var(--color-success);
    }

    /* ── Terminal body ─────────────────────────────────────────────── */
    .terminal__body {
      position: relative;
      padding: var(--space-8) var(--space-6);
      z-index: 0;
    }

    /* ── Bureau heading ───────────────────────────────────────────── */
    .bureau-heading {
      text-align: center;
      margin-bottom: var(--space-8);
    }

    .bureau-heading__org {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-widest);
      text-transform: uppercase;
      color: var(--color-text-muted);
      margin: 0 0 var(--space-2);
    }

    .bureau-heading__title {
      font-family: var(--font-brutalist);
      font-size: var(--text-xl);
      font-weight: var(--font-black);
      letter-spacing: var(--tracking-wide);
      text-transform: uppercase;
      color: var(--_amber-text);
      margin: 0 0 var(--space-2);
    }

    .bureau-heading__sub {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      margin: 0;
    }

    /* ── Decoder form ─────────────────────────────────────────────── */
    .decoder {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }

    .decoder__label {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-widest);
      text-transform: uppercase;
      color: var(--_amber-dim);
    }

    .decoder__input-wrap {
      position: relative;
    }

    .decoder__input {
      width: 100%;
      padding: var(--space-3) var(--space-4);
      font-family: var(--font-mono);
      font-size: var(--text-lg);
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-widest);
      text-transform: uppercase;
      color: var(--_amber-text);
      background: var(--color-surface);
      border: 1px solid var(--_border-amber);
      border-radius: var(--space-1);
      outline: none;
      box-sizing: border-box;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .decoder__input:focus {
      border-color: var(--_amber);
      box-shadow: 0 0 12px var(--_amber-glow), inset 0 0 8px var(--_amber-glow);
    }

    .decoder__input::placeholder {
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
    }

    .decoder__input:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .decoder__submit {
      padding: var(--space-3) var(--space-6);
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      font-weight: var(--font-black);
      letter-spacing: var(--tracking-widest);
      text-transform: uppercase;
      color: var(--color-surface);
      background: var(--_amber);
      border: none;
      border-radius: var(--space-1);
      cursor: pointer;
      transition: background 0.15s, box-shadow 0.15s, transform 0.1s;
    }

    .decoder__submit:hover:not(:disabled) {
      background: var(--color-primary-hover);
      box-shadow: 0 0 20px var(--_amber-glow);
    }

    .decoder__submit:active:not(:disabled) {
      transform: scale(0.98);
    }

    .decoder__submit:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .decoder__submit:focus-visible {
      outline: 2px solid var(--_amber);
      outline-offset: 2px;
    }

    /* ── Decoding state ───────────────────────────────────────────── */
    .decoding {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-4);
      padding: var(--space-8) 0;
    }

    .decoding__text {
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-widest);
      text-transform: uppercase;
      color: var(--_amber-text);
      animation: blink-text 0.8s step-end infinite;
    }

    .decoding__bar {
      width: 100%;
      height: 2px;
      background: var(--color-surface-raised);
      border-radius: 1px;
      overflow: hidden;
    }

    .decoding__bar-fill {
      height: 100%;
      background: var(--_amber);
      box-shadow: 0 0 8px var(--_amber);
      animation: scan-sweep 1.8s ease-in-out;
    }

    /* ── Error state ──────────────────────────────────────────────── */
    .error-msg {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      padding: var(--space-3) var(--space-4);
      border: 1px solid var(--color-danger-border);
      border-radius: var(--space-1);
      background: var(--_error-flash);
      animation: flash-error 0.4s ease-out;
    }

    .error-msg[role='alert'] {
      /* accessibility: ensure visible focus for screen readers */
    }

    .error-msg__text {
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-wide);
      text-transform: uppercase;
      color: var(--color-danger);
    }

    .error-msg__attempts {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    /* ── Rate limited state ───────────────────────────────────────── */
    .rate-limited {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-4);
      padding: var(--space-8) 0;
      text-align: center;
    }

    .rate-limited__icon {
      color: var(--color-danger);
    }

    .rate-limited__title {
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      font-weight: var(--font-black);
      letter-spacing: var(--tracking-widest);
      text-transform: uppercase;
      color: var(--color-danger);
    }

    .rate-limited__countdown {
      font-family: var(--font-mono);
      font-size: var(--text-3xl);
      font-weight: var(--font-bold);
      color: var(--_amber-text);
      letter-spacing: var(--tracking-widest);
    }

    .rate-limited__sub {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    /* ── Success / Reward ─────────────────────────────────────────── */
    .reward {
      animation: reveal-in 0.8s ease-out;
    }

    .reward__stamp {
      text-align: center;
      margin-bottom: var(--space-6);
      animation: stamp-drop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .reward__stamp-text {
      display: inline-block;
      padding: var(--space-2) var(--space-6);
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-black);
      letter-spacing: var(--tracking-widest);
      text-transform: uppercase;
      color: var(--color-success);
      border: 2px solid var(--color-success);
      border-radius: var(--space-1);
      transform: rotate(-3deg);
      box-shadow: 0 0 12px var(--color-success-glow);
    }

    .reward__content {
      padding: var(--space-6);
      border: 1px solid var(--_border-amber);
      border-radius: var(--space-1);
      background: var(--_success-glow);
      animation: fade-up 0.6s ease-out 0.3s both;
    }

    .reward__type-label {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-widest);
      text-transform: uppercase;
      color: var(--_amber-dim);
      margin: 0 0 var(--space-1);
    }

    .reward__title {
      font-family: var(--font-bureau);
      font-size: var(--text-xl);
      font-weight: var(--font-bold);
      color: var(--_amber-text);
      margin: 0 0 var(--space-4);
      line-height: var(--leading-snug);
    }

    .reward__body {
      font-family: var(--font-bureau);
      font-size: var(--text-base);
      color: var(--color-text-secondary);
      line-height: var(--leading-relaxed);
      margin: 0 0 var(--space-4);
      white-space: pre-wrap;
    }

    .reward__classification {
      display: inline-block;
      padding: var(--space-1) var(--space-3);
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-widest);
      text-transform: uppercase;
      color: var(--_classified-red);
      border: 1px solid var(--_classified-red);
      border-radius: var(--space-0-5);
    }

    .reward__agent-name {
      font-family: var(--font-brutalist);
      font-size: var(--text-lg);
      font-weight: var(--font-black);
      letter-spacing: var(--tracking-wide);
      text-transform: uppercase;
      color: var(--_amber-text);
      margin: 0 0 var(--space-3);
    }

    .reward__rank {
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-widest);
      text-transform: uppercase;
      color: var(--color-success);
      margin: 0 0 var(--space-3);
    }

    .reward__reset {
      margin-top: var(--space-6);
      text-align: center;
    }

    .reward__reset-btn {
      padding: var(--space-2) var(--space-4);
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-widest);
      text-transform: uppercase;
      color: var(--color-text-muted);
      background: transparent;
      border: 1px solid var(--color-border);
      border-radius: var(--space-1);
      cursor: pointer;
      transition: color 0.15s, border-color 0.15s;
    }

    .reward__reset-btn:hover {
      color: var(--_amber-text);
      border-color: var(--_border-amber);
    }

    .reward__reset-btn:focus-visible {
      outline: 2px solid var(--_amber);
      outline-offset: 2px;
    }

    /* ── Terminal footer ──────────────────────────────────────────── */
    .terminal__footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-2) var(--space-4);
      border-top: 1px solid var(--_border-amber);
      background: var(--_bezel);
      font-family: var(--font-mono);
      font-size: 10px;
      color: var(--color-text-muted);
      letter-spacing: var(--tracking-wide);
    }

    /* ── Skip link ────────────────────────────────────────────────── */
    .skip-link {
      position: absolute;
      left: -9999px;
      top: var(--space-2);
      padding: var(--space-2) var(--space-4);
      background: var(--_amber);
      color: var(--color-surface);
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      z-index: 10;
      border-radius: var(--space-1);
    }

    .skip-link:focus {
      left: var(--space-4);
    }

    /* ── Animations ───────────────────────────────────────────────── */
    @keyframes pulse-dot {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    @keyframes blink-text {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }

    @keyframes scan-sweep {
      0% { width: 0%; }
      100% { width: 100%; }
    }

    @keyframes flash-error {
      0% { background: color-mix(in srgb, var(--color-danger) 25%, var(--color-surface)); }
      100% { background: var(--_error-flash); }
    }

    @keyframes reveal-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes stamp-drop {
      0% { transform: scale(2.5) rotate(-8deg); opacity: 0; }
      60% { transform: scale(0.95) rotate(-2deg); opacity: 1; }
      100% { transform: scale(1) rotate(-3deg); opacity: 1; }
    }

    @keyframes fade-up {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* ── Reduced motion ───────────────────────────────────────────── */
    @media (prefers-reduced-motion: reduce) {
      .terminal::after {
        display: none;
      }

      .terminal__status-dot,
      .decoding__text,
      .decoding__bar-fill,
      .error-msg,
      .reward,
      .reward__stamp,
      .reward__content {
        animation: none !important;
      }

      .decoding__bar-fill {
        width: 100%;
      }
    }

    /* ── Responsive ───────────────────────────────────────────────── */
    @media (max-width: 640px) {
      .dispatch {
        padding: var(--space-4);
      }

      .terminal__body {
        padding: var(--space-6) var(--space-4);
      }

      .bureau-heading__title {
        font-size: var(--text-lg);
      }

      .decoder__input {
        font-size: var(--text-base);
      }
    }
  `;

  // ── Render ─────────────────────────────────────────────────────────

  protected render() {
    const dotClass = classMap({
      terminal__status_dot: false,
      'terminal__status-dot': true,
      'terminal__status-dot--error': this._state === 'error' || this._state === 'rate_limited',
      'terminal__status-dot--success': this._state === 'success',
    });

    return html`
      <div class="dispatch">
        <a class="skip-link" href="#cipher-input">${msg('Skip to decoder')}</a>

        <div class="terminal" role="main" aria-label=${msg('Bureau Dispatch Terminal')}>
          <!-- Header -->
          <div class="terminal__header">
            <span class="terminal__title">${msg('Dispatch Terminal')}</span>
            <span class=${dotClass}></span>
          </div>

          <!-- Body -->
          <div class="terminal__body">
            <div class="bureau-heading">
              <p class="bureau-heading__org">${msg('Bureau of Impossible Geography')}</p>
              <h1 class="bureau-heading__title">${msg('Transmission Decoder')}</h1>
              <p class="bureau-heading__sub">${msg('Enter intercepted cipher to decode classified dispatch')}</p>
            </div>

            ${this._renderBody()}
          </div>

          <!-- Footer -->
          <div class="terminal__footer">
            <span>SYS.BUREAU.DECODE</span>
            <span>${msg('CHANNEL OPEN')}</span>
          </div>
        </div>
      </div>

      <!-- Live region for accessibility announcements -->
      <div aria-live="polite" class="sr-only" style="position:absolute;left:-9999px">
        ${this._state === 'decoding' ? msg('Decoding transmission...') : nothing}
        ${this._state === 'success' ? msg('Cipher decoded successfully. Reward unlocked.') : nothing}
        ${this._state === 'error' ? this._errorMessage : nothing}
        ${this._state === 'rate_limited' ? msg('Transmission channel locked.') : nothing}
      </div>
    `;
  }

  private _renderBody() {
    switch (this._state) {
      case 'idle':
      case 'error':
        return this._renderDecoder();
      case 'decoding':
        return this._renderDecoding();
      case 'success':
        return this._renderReward();
      case 'rate_limited':
        return this._renderRateLimited();
    }
  }

  private _renderDecoder() {
    return html`
      <form class="decoder" @submit=${this._handleSubmit}>
        <label class="decoder__label" for="cipher-input">
          ${msg('Cipher Code')}
        </label>
        <div class="decoder__input-wrap">
          <input
            id="cipher-input"
            class="decoder__input"
            type="text"
            .value=${this._code}
            @input=${(e: InputEvent) => {
              this._code = (e.target as HTMLInputElement).value;
            }}
            placeholder=${msg('BUREAU-XXXXXX')}
            autocomplete="off"
            spellcheck="false"
            autofocus
            ?disabled=${this._state === 'decoding'}
            aria-describedby=${this._state === 'error' ? 'cipher-error' : ''}
          />
        </div>

        <button
          class="decoder__submit"
          type="submit"
          ?disabled=${!this._code.trim() || this._state === 'decoding'}
        >
          ${icons.key?.(16) ?? nothing}
          ${msg('Decode Transmission')}
        </button>
      </form>

      ${this._state === 'error' ? this._renderError() : nothing}
    `;
  }

  private _renderError() {
    return html`
      <div class="error-msg" role="alert" id="cipher-error">
        <span class="error-msg__text">${this._errorMessage}</span>
        ${
          this._attemptsRemaining !== null
            ? html`<span class="error-msg__attempts">
              ${msg('Attempts remaining')}: ${this._attemptsRemaining}
            </span>`
            : nothing
        }
      </div>
    `;
  }

  private _renderDecoding() {
    return html`
      <div class="decoding" role="status">
        <span class="decoding__text">${msg('Decoding transmission...')}</span>
        <div class="decoding__bar">
          <div class="decoding__bar-fill"></div>
        </div>
      </div>
    `;
  }

  private _renderRateLimited() {
    return html`
      <div class="rate-limited">
        <div class="rate-limited__icon">${icons.lock?.(32) ?? nothing}</div>
        <span class="rate-limited__title">${msg('Transmission Channel Locked')}</span>
        <span class="rate-limited__countdown">
          ${this._formatCountdown(this._countdownSeconds)}
        </span>
        <span class="rate-limited__sub">${msg('Too many attempts. Channel will reopen shortly.')}</span>
      </div>
    `;
  }

  private _renderReward() {
    const snapshot = (this._rewardData?.snapshot as Record<string, unknown>) ?? {};

    return html`
      <div class="reward">
        <div class="reward__stamp">
          <span class="reward__stamp-text">${msg('Declassified')}</span>
        </div>

        <div class="reward__content">
          ${
            this._rewardType === 'agent_dossier'
              ? this._renderAgentDossier(snapshot)
              : this._rewardType === 'bureau_commendation'
                ? this._renderCommendation(snapshot)
                : this._renderLoreFragment(snapshot)
          }
        </div>

        <div class="reward__reset">
          <button class="reward__reset-btn" @click=${this._handleReset}>
            ${msg('Decode Another')}
          </button>
        </div>
      </div>
    `;
  }

  private _renderLoreFragment(snapshot: Record<string, unknown>) {
    const title =
      (snapshot.name as string) ?? (snapshot.title as string) ?? msg('Classified Document');
    const body =
      (snapshot.body as string) ??
      (snapshot.epigraph as string) ??
      (snapshot.character as string) ??
      (snapshot.description as string) ??
      '';
    const classification = (snapshot.classification as string) ?? 'RESTRICTED';

    return html`
      <p class="reward__type-label">${msg('Declassified Lore Fragment')}</p>
      <h2 class="reward__title">${title}</h2>
      ${body ? html`<p class="reward__body">${body}</p>` : nothing}
      <span class="reward__classification">${classification}</span>
    `;
  }

  private _renderAgentDossier(snapshot: Record<string, unknown>) {
    const name = (snapshot.name as string) ?? msg('Unknown Operative');
    const intel =
      (snapshot.character as string) ??
      (snapshot.background as string) ??
      (snapshot.description as string) ??
      '';

    return html`
      <p class="reward__type-label">${msg('Personnel Dossier')}</p>
      <h2 class="reward__agent-name">${name}</h2>
      ${intel ? html`<p class="reward__body">${intel}</p>` : nothing}
      <span class="reward__classification">${msg('EYES ONLY')}</span>
    `;
  }

  private _renderCommendation(snapshot: Record<string, unknown>) {
    const rank = (snapshot.system as string) ?? msg('Field Operative');
    const text =
      (snapshot.character as string) ??
      (snapshot.description as string) ??
      msg('For distinguished service to the Bureau.');

    return html`
      <p class="reward__type-label">${msg('Bureau Commendation')}</p>
      <p class="reward__rank">${rank}</p>
      <p class="reward__body">${text}</p>
      <span class="reward__classification">${msg('COMMENDED')}</span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-bureau-dispatch-terminal': VelgBureauDispatch;
  }
}
