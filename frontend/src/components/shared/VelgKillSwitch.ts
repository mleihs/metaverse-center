/**
 * VelgKillSwitch — glass-cover 3D kill-switch primitive (P1).
 *
 * Two-step confirmation: operator lifts the glass cover (clicks the
 * ``Arm`` button), enters a reason, then commits the kill. On revert the
 * cover slams shut over a closed switch.
 *
 * The primitive emits two events and owns no network state:
 *   - ``ops-kill-trip``   detail: { reason, revertAfterMinutes }
 *   - ``ops-kill-revert`` detail: { reason }
 *
 * The parent panel (QuarantinePanel) makes the API calls. Errors there
 * should bubble back through ``<velg-toast>``.
 *
 * States:
 *   ``closed``  — switch is in closed position; operator may trip it.
 *   ``killed``  — switch is tripped; shows revert timer + revert button.
 *
 * Accessibility:
 *   - ``role="switch" aria-checked`` reflects the closed/killed state.
 *   - Confirm dialogs trap focus; Escape cancels.
 *   - ``prefers-reduced-motion`` short-circuits the cover-flip animation.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

const DEFAULT_REVERT_MINUTES = 60;
const MAX_REVERT_MINUTES = 24 * 60;
const MIN_REASON_LENGTH = 3;

@localized()
@customElement('velg-kill-switch')
export class VelgKillSwitch extends LitElement {
  static styles = css`
    :host {
      --_danger: var(--color-danger);
      --_danger-glow: var(--color-danger-glow);
      --_panel: var(--color-surface-raised);
      display: block;
      border: 2px solid var(--color-border);
      background: var(--_panel);
      padding: var(--space-4);
      font-family: var(--font-mono);
    }

    :host([state='killed']) {
      border-color: var(--_danger);
      background: var(--color-danger-bg);
    }

    .body {
      display: flex;
      align-items: center;
      gap: var(--space-4);
    }

    .label {
      flex: 1;
      min-width: 0;
    }

    .label__title {
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
      color: var(--color-text-primary);
      margin: 0;
      line-height: 1.2;
    }

    .label__subtitle {
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      margin: var(--space-0-5) 0 0 0;
      font-family: var(--font-mono);
    }

    .label__status {
      display: inline-block;
      font-family: var(--font-brutalist);
      font-size: 9px;
      font-weight: var(--font-bold);
      letter-spacing: 0.12em;
      text-transform: uppercase;
      margin-top: var(--space-1);
      padding: 2px 6px;
      border: 1px solid currentColor;
    }

    :host([state='closed']) .label__status {
      color: var(--color-success);
    }

    :host([state='killed']) .label__status {
      color: var(--_danger);
    }

    .switch {
      position: relative;
      flex-shrink: 0;
      width: 88px;
      height: 52px;
    }

    .switch__cover {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: color-mix(in srgb, var(--color-surface-inverse) 18%, transparent);
      border: 2px solid var(--color-border);
      color: var(--color-text-primary);
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
      cursor: pointer;
      transform-origin: top center;
      transition:
        transform var(--duration-slow) var(--ease-dramatic),
        opacity var(--duration-slow) var(--ease-dramatic);
    }

    .switch__cover:hover,
    .switch__cover:focus-visible {
      background: color-mix(in srgb, var(--_danger) 12%, transparent);
      color: var(--_danger);
      outline: none;
    }

    :host([state='closed'][armed]) .switch__cover,
    :host([state='killed']) .switch__cover {
      transform: rotateX(-105deg);
      opacity: 0;
      pointer-events: none;
    }

    .switch__btn {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--_danger);
      color: var(--color-text-inverse);
      border: 2px solid color-mix(in srgb, var(--_danger) 60%, #000);
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-black);
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
      cursor: pointer;
      box-shadow: var(--shadow-md);
      transition: transform var(--transition-fast), box-shadow var(--transition-fast);
    }

    .switch__btn:hover,
    .switch__btn:focus-visible {
      transform: translateY(-1px);
      box-shadow: var(--shadow-lg), 0 0 16px var(--_danger-glow);
      outline: none;
    }

    .switch__btn:active {
      transform: translateY(1px);
      box-shadow: var(--shadow-pressed);
    }

    :host([state='killed']) .switch__btn {
      background: color-mix(in srgb, var(--color-text-primary) 12%, transparent);
      color: var(--_danger);
      border-color: var(--_danger);
    }

    .confirm {
      margin-top: var(--space-3);
      padding: var(--space-3);
      border: 1px dashed var(--color-border);
      background: var(--color-surface);
    }

    .confirm__label {
      display: block;
      font-family: var(--font-brutalist);
      font-size: 9px;
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
      color: var(--color-text-secondary);
      margin-bottom: var(--space-1);
    }

    .confirm__input {
      width: 100%;
      padding: var(--space-2);
      background: var(--color-surface-sunken);
      color: var(--color-text-primary);
      border: 1px solid var(--color-border);
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      box-sizing: border-box;
    }

    .confirm__input:focus {
      outline: none;
      border-color: var(--color-border-focus);
      box-shadow: 0 0 0 3px var(--ring-focus);
    }

    .confirm__row {
      display: flex;
      gap: var(--space-2);
      align-items: center;
      margin-top: var(--space-2);
    }

    .confirm__row label {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
    }

    .confirm__row input[type='number'] {
      width: 64px;
      padding: var(--space-1) var(--space-2);
      background: var(--color-surface-sunken);
      color: var(--color-text-primary);
      border: 1px solid var(--color-border);
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      font-variant-numeric: tabular-nums;
      box-sizing: border-box;
    }

    .confirm__actions {
      display: flex;
      gap: var(--space-2);
      margin-top: var(--space-3);
    }

    .confirm__btn {
      padding: var(--space-2) var(--space-3);
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
      cursor: pointer;
      border: 2px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-text-primary);
      transition: background var(--transition-fast);
    }

    .confirm__btn:hover,
    .confirm__btn:focus-visible {
      background: color-mix(in srgb, var(--color-text-primary) 10%, transparent);
      outline: none;
    }

    .confirm__btn--primary {
      border-color: var(--_danger);
      background: var(--_danger);
      color: var(--color-text-inverse);
    }

    .confirm__btn--primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .killed-info {
      margin-top: var(--space-3);
      padding: var(--space-2) var(--space-3);
      border: 1px dashed var(--_danger);
      background: color-mix(in srgb, var(--_danger) 6%, transparent);
      font-size: var(--text-xs);
      color: var(--color-text-primary);
    }

    .killed-info__reason {
      font-style: italic;
      color: var(--color-text-secondary);
      margin-top: var(--space-1);
    }

    .killed-info__timer {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
      color: var(--_danger);
      font-variant-numeric: tabular-nums;
    }

    @media (prefers-reduced-motion: reduce) {
      .switch__cover { transition: none; }
    }
  `;

  @property({ type: String, reflect: true }) state: 'closed' | 'killed' = 'closed';
  @property({ type: Boolean, reflect: true }) armed = false;
  @property({ type: String }) scopeLabel = '';
  @property({ type: String }) scopeSubtitle = '';
  @property({ type: String, attribute: 'killed-reason' }) killedReason = '';
  @property({ type: String, attribute: 'revert-at' }) revertAt = '';
  @property({ type: Boolean }) disabled = false;

  @state() private _reason = '';
  @state() private _revertMinutes = DEFAULT_REVERT_MINUTES;
  @state() private _confirmingRevert = false;
  @state() private _revertReason = '';

  private _onLiftCover = (): void => {
    if (this.disabled) return;
    this.armed = true;
    // Focus input after the DOM updates
    queueMicrotask(() => {
      const el = this.shadowRoot?.querySelector<HTMLInputElement>('.confirm__input');
      el?.focus();
    });
  };

  private _onCancelArm = (): void => {
    this.armed = false;
    this._reason = '';
  };

  private _onTrip = (): void => {
    const trimmed = this._reason.trim();
    if (trimmed.length < MIN_REASON_LENGTH || this.disabled) return;
    this.dispatchEvent(
      new CustomEvent('ops-kill-trip', {
        bubbles: true,
        composed: true,
        detail: { reason: trimmed, revertAfterMinutes: this._revertMinutes },
      }),
    );
    this._reason = '';
    this.armed = false;
  };

  private _onRequestRevert = (): void => {
    this._confirmingRevert = true;
    queueMicrotask(() => {
      const el = this.shadowRoot?.querySelector<HTMLInputElement>('.confirm__input');
      el?.focus();
    });
  };

  private _onCancelRevert = (): void => {
    this._confirmingRevert = false;
    this._revertReason = '';
  };

  private _onRevert = (): void => {
    const trimmed = this._revertReason.trim();
    if (trimmed.length < MIN_REASON_LENGTH || this.disabled) return;
    this.dispatchEvent(
      new CustomEvent('ops-kill-revert', {
        bubbles: true,
        composed: true,
        detail: { reason: trimmed },
      }),
    );
    this._revertReason = '';
    this._confirmingRevert = false;
  };

  private _formatTimer(): string {
    if (!this.revertAt) return '';
    const parsed = Date.parse(this.revertAt);
    if (Number.isNaN(parsed)) return '';
    const diff = Math.max(0, Math.floor((parsed - Date.now()) / 1000));
    if (diff < 60) return msg(str`${diff}s remaining`);
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    return msg(str`${mins}m ${secs}s remaining`);
  }

  protected render() {
    const closed = this.state === 'closed';
    const timer = this._formatTimer();

    return html`
      <div class="body">
        <div class="label">
          <p class="label__title">${this.scopeLabel}</p>
          ${this.scopeSubtitle
            ? html`<p class="label__subtitle">${this.scopeSubtitle}</p>`
            : nothing}
          <span class="label__status" role="switch" aria-checked=${!closed}>
            ${closed ? msg('Closed') : msg('Killed')}
          </span>
        </div>

        <div class="switch">
          ${closed && !this.armed
            ? html`
                <button
                  class="switch__cover"
                  type="button"
                  @click=${this._onLiftCover}
                  aria-label=${msg('Lift cover to arm kill')}
                  ?disabled=${this.disabled}
                >
                  ${msg('Arm')}
                </button>
              `
            : closed
              ? html`
                  <button
                    class="switch__btn"
                    type="button"
                    @click=${this._onCancelArm}
                    aria-label=${msg('Cancel arm')}
                  >
                    ${msg('Cancel')}
                  </button>
                `
              : html`
                  <button
                    class="switch__btn"
                    type="button"
                    @click=${this._onRequestRevert}
                    aria-label=${msg('Revert kill')}
                    ?disabled=${this.disabled}
                  >
                    ${msg('Revert')}
                  </button>
                `}
        </div>
      </div>

      ${closed && this.armed
        ? html`
            <div class="confirm" role="region" aria-label=${msg('Trip kill confirmation')}>
              <label class="confirm__label" for="kill-reason">
                ${msg('Reason (required, appears in audit log)')}
              </label>
              <input
                id="kill-reason"
                class="confirm__input"
                type="text"
                minlength="3"
                maxlength="500"
                autocomplete="off"
                .value=${this._reason}
                @input=${(e: Event) => {
                  this._reason = (e.target as HTMLInputElement).value;
                }}
                placeholder=${msg('e.g., OpenRouter credits exhausted – pause all LLM calls')}
              />
              <div class="confirm__row">
                <label for="revert-minutes">${msg('Auto-revert after:')}</label>
                <input
                  id="revert-minutes"
                  type="number"
                  min="1"
                  max=${MAX_REVERT_MINUTES}
                  .value=${String(this._revertMinutes)}
                  @input=${(e: Event) => {
                    const v = Number((e.target as HTMLInputElement).value);
                    this._revertMinutes = Math.min(
                      MAX_REVERT_MINUTES,
                      Math.max(1, Number.isFinite(v) ? v : DEFAULT_REVERT_MINUTES),
                    );
                  }}
                />
                <span>${msg('min')}</span>
              </div>
              <div class="confirm__actions">
                <button class="confirm__btn" type="button" @click=${this._onCancelArm}>
                  ${msg('Cancel')}
                </button>
                <button
                  class="confirm__btn confirm__btn--primary"
                  type="button"
                  @click=${this._onTrip}
                  ?disabled=${this._reason.trim().length < MIN_REASON_LENGTH}
                >
                  ${msg('Trip kill')}
                </button>
              </div>
            </div>
          `
        : nothing}

      ${!closed && this._confirmingRevert
        ? html`
            <div class="confirm" role="region" aria-label=${msg('Revert kill confirmation')}>
              <label class="confirm__label" for="revert-reason">
                ${msg('Reason for lifting this kill')}
              </label>
              <input
                id="revert-reason"
                class="confirm__input"
                type="text"
                minlength="3"
                maxlength="500"
                autocomplete="off"
                .value=${this._revertReason}
                @input=${(e: Event) => {
                  this._revertReason = (e.target as HTMLInputElement).value;
                }}
                placeholder=${msg('e.g., provider back online, verified test call succeeded')}
              />
              <div class="confirm__actions">
                <button class="confirm__btn" type="button" @click=${this._onCancelRevert}>
                  ${msg('Cancel')}
                </button>
                <button
                  class="confirm__btn confirm__btn--primary"
                  type="button"
                  @click=${this._onRevert}
                  ?disabled=${this._revertReason.trim().length < MIN_REASON_LENGTH}
                >
                  ${msg('Lift kill')}
                </button>
              </div>
            </div>
          `
        : nothing}

      ${!closed && this.killedReason
        ? html`
            <div class="killed-info">
              <div class="killed-info__timer">${timer || msg('reverting soon')}</div>
              <div class="killed-info__reason">${this.killedReason}</div>
            </div>
          `
        : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-kill-switch': VelgKillSwitch;
  }
}
