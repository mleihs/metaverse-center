/**
 * ForgeAccessRequestModal — Bureau clearance upgrade application.
 *
 * Modal for submitting a clearance upgrade request from
 * Field Observer → Reality Architect.
 *
 * Classified intelligence dossier aesthetic matching ClearanceApplicationCard:
 * amber monospace typography, scan-line overlay, brutalist button treatment.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { forgeApi } from '../../services/api/ForgeApiService.js';
import { VelgToast } from '../shared/Toast.js';
import '../shared/BaseModal.js';

@localized()
@customElement('velg-forge-access-modal')
export class VelgForgeAccessModal extends LitElement {
  static styles = css`
    /* ── Modal width override ── */
    velg-base-modal {
      --modal-max-width: 480px;
    }

    /* ── Staggered entry animations ── */
    @keyframes fade-in {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .classification,
    .tier-upgrade,
    .description,
    .field-group,
    .actions {
      opacity: 0;
      animation: fade-in 400ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }

    .classification {
      animation-delay: 80ms;
    }
    .tier-upgrade {
      animation-delay: 160ms;
    }
    .description {
      animation-delay: 240ms;
    }
    .field-group {
      animation-delay: 320ms;
    }
    .actions {
      animation-delay: 400ms;
    }

    /* ── Classification header with scan-line overlay ── */
    .classification {
      position: relative;
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #f59e0b;
      text-align: center;
      margin-bottom: 20px;
      padding: 12px;
      line-height: 1.8;
    }

    .classification::after {
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

    /* ── Tier upgrade box ── */
    .tier-upgrade {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 12px 16px;
      background: var(--color-gray-950, #0a0a0a);
      border: 1px solid var(--color-gray-800, #1f1f1f);
      border-left: 3px solid #f59e0b;
      margin-bottom: 20px;
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 12px;
      letter-spacing: 2px;
      text-transform: uppercase;
    }

    .tier-upgrade__current {
      color: var(--color-gray-400, #9ca3af);
    }

    .tier-upgrade__arrow {
      color: #f59e0b;
      font-weight: 700;
    }

    .tier-upgrade__target {
      color: #f59e0b;
      font-weight: 700;
    }

    /* ── Description ── */
    .description {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 13px;
      line-height: 1.7;
      color: var(--color-gray-400, #9ca3af);
      margin: 0 0 20px;
    }

    /* ── Form field ── */
    .field-group {
      margin-bottom: 4px;
    }

    .field-label {
      display: block;
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--color-gray-400, #9ca3af);
      margin-bottom: 8px;
    }

    .field-label__optional {
      font-weight: 400;
      text-transform: none;
      letter-spacing: normal;
      color: var(--color-gray-600, #555);
    }

    .field-textarea {
      display: block;
      width: 100%;
      min-height: 100px;
      padding: 12px;
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 13px;
      line-height: 1.6;
      color: var(--color-gray-300, #d4d4d4);
      background: var(--color-gray-950, #0a0a0a);
      border: 1px solid var(--color-gray-700, #333);
      resize: vertical;
      transition: border-color 150ms, box-shadow 150ms;
      box-sizing: border-box;
    }

    .field-textarea::placeholder {
      color: var(--color-gray-600, #555);
    }

    .field-textarea:focus {
      outline: none;
      border-color: #f59e0b;
      box-shadow: 0 0 0 1px #f59e0b;
    }

    .field-textarea:focus-visible {
      outline: 2px solid #f59e0b;
      outline-offset: 2px;
    }

    .char-count {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 10px;
      color: #f59e0b;
      text-align: right;
      margin-top: 6px;
    }

    /* ── Footer actions ── */
    .actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 12px;
    }

    .btn {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 2px;
      cursor: pointer;
      transition: background 150ms, transform 150ms, box-shadow 150ms,
        border-color 150ms, color 150ms;
    }

    .btn:focus-visible {
      outline: 2px solid #f59e0b;
      outline-offset: 2px;
    }

    /* Cancel — ghost */
    .btn--cancel {
      padding: 8px 16px;
      color: var(--color-gray-400, #9ca3af);
      background: transparent;
      border: 1px solid var(--color-gray-600, #555);
    }

    .btn--cancel:hover {
      color: #f59e0b;
      border-color: #f59e0b;
    }

    .btn--cancel:active {
      color: #fbbf24;
      border-color: #fbbf24;
    }

    /* Submit — amber brutalist */
    .btn--submit {
      padding: 8px 20px;
      color: #0a0a0a;
      background: #f59e0b;
      border: none;
      box-shadow: 3px 3px 0 rgba(245, 158, 11, 0.2);
    }

    .btn--submit:hover {
      background: #fbbf24;
      transform: translate(-2px, -2px);
      box-shadow: 5px 5px 0 rgba(245, 158, 11, 0.25);
    }

    .btn--submit:active {
      transform: translate(0);
      box-shadow: 2px 2px 0 rgba(245, 158, 11, 0.15);
    }

    .btn--submit:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
      box-shadow: 3px 3px 0 rgba(245, 158, 11, 0.1);
    }

    .btn--submit:disabled:hover {
      background: #f59e0b;
      transform: none;
      box-shadow: 3px 3px 0 rgba(245, 158, 11, 0.1);
    }
  `;

  @property({ type: Boolean, reflect: true }) open = false;

  @state() private _message = '';
  @state() private _submitting = false;

  private _handleClose(): void {
    this.open = false;
    this.dispatchEvent(new CustomEvent('modal-close', { bubbles: true, composed: true }));
  }

  private async _handleSubmit(): Promise<void> {
    this._submitting = true;
    try {
      const resp = await forgeApi.requestAccess(this._message || undefined);
      if (resp.success) {
        appState.setForgeRequestStatus('pending');
        VelgToast.success(msg('Clearance application submitted'));
        this._message = '';
        this._handleClose();
      } else {
        const errMsg = (resp as { error?: { message?: string } }).error?.message;
        VelgToast.error(errMsg ?? msg('Failed to submit application'));
      }
    } catch {
      VelgToast.error(msg('An unexpected error occurred'));
    } finally {
      this._submitting = false;
    }
  }

  protected render() {
    return html`
      <velg-base-modal ?open=${this.open} @modal-close=${this._handleClose}>
        <span slot="header">${msg('Clearance Application')}</span>

        <div class="classification">
          // ${msg('Bureau of Multiverse Observation')} //
          <br />
          // ${msg('Clearance Upgrade Request')} //
        </div>

        <div class="tier-upgrade">
          <span class="tier-upgrade__current">${msg('Field Observer')}</span>
          <span class="tier-upgrade__arrow">&rarr;</span>
          <span class="tier-upgrade__target">${msg('Reality Architect')}</span>
        </div>

        <p class="description">
          ${msg('Architect clearance grants access to the Simulation Forge — create worlds with AI-driven agents, buildings, and events.')}
        </p>

        <div class="field-group">
          <label class="field-label">${msg('Operational Justification')} <span class="field-label__optional">(${msg('optional')})</span></label>
          <textarea
            class="field-textarea"
            maxlength="500"
            placeholder=${msg('Tell us why you want to create worlds...')}
            .value=${this._message}
            @input=${(e: Event) => { this._message = (e.target as HTMLTextAreaElement).value; }}
          ></textarea>
          <div class="char-count">${this._message.length}/500</div>
        </div>

        <div slot="footer" class="actions">
          <button class="btn btn--cancel" @click=${this._handleClose}>
            ${msg('Cancel')}
          </button>
          <button
            class="btn btn--submit"
            ?disabled=${this._submitting}
            @click=${this._handleSubmit}
          >
            ${this._submitting ? msg('Submitting...') : msg('Submit')} &#9656;
          </button>
        </div>
      </velg-base-modal>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-forge-access-modal': VelgForgeAccessModal;
  }
}
