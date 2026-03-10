/**
 * ForgeAccessRequestModal — Bureau clearance upgrade application.
 *
 * Modal for submitting a clearance upgrade request from
 * Field Observer → Reality Architect.
 *
 * Classified intelligence dossier aesthetic matching ClearanceApplicationCard:
 * amber monospace typography, scan-line overlay, brutalist button treatment.
 * Overrides BaseModal surface tokens to enforce dark dossier appearance.
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
    /* ── Override BaseModal tokens to force dark dossier appearance ── */
    velg-base-modal {
      --modal-max-width: 480px;

      /* Surface overrides — dark dossier paper */
      --color-surface-raised: #0c0c0c;
      --color-surface-header: #080808;
      --color-text-primary: #e5e5e5;
      --color-text-inverse: #080808;

      /* Border overrides — amber-accented */
      --border-default: 1px solid #292524;
      --border-medium: 1px solid #f59e0b;
      --border-light: 1px solid #1c1917;

      /* Shadow — deep classified drop */
      --shadow-xl: 0 0 0 1px rgba(245, 158, 11, 0.08),
        0 25px 60px -12px rgba(0, 0, 0, 0.9);

      /* Button token overrides */
      --color-primary: #f59e0b;

      /* Typography */
      --font-brutalist: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
    }

    /* ── Staggered entry animations ── */
    @keyframes declassify {
      from {
        opacity: 0;
        transform: translateY(8px);
        filter: blur(2px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
        filter: blur(0);
      }
    }

    .classification,
    .tier-upgrade,
    .description,
    .field-group,
    .actions {
      opacity: 0;
      animation: declassify 500ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }

    .classification {
      animation-delay: 60ms;
    }
    .tier-upgrade {
      animation-delay: 140ms;
    }
    .description {
      animation-delay: 220ms;
    }
    .field-group {
      animation-delay: 300ms;
    }
    .actions {
      animation-delay: 380ms;
    }

    /* ── Classification header with scan-line overlay ── */
    .classification {
      position: relative;
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: #f59e0b;
      text-align: center;
      margin-bottom: 24px;
      padding: 16px 12px;
      line-height: 1.8;
      border: 1px dashed #292524;
      background: rgba(245, 158, 11, 0.02);
    }

    .classification::before {
      content: '';
      position: absolute;
      top: -1px;
      left: 24px;
      right: 24px;
      height: 1px;
      background: linear-gradient(
        90deg,
        transparent,
        #f59e0b 30%,
        #f59e0b 70%,
        transparent
      );
    }

    .classification::after {
      content: '';
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 3px,
        rgba(245, 158, 11, 0.015) 3px,
        rgba(245, 158, 11, 0.015) 4px
      );
      pointer-events: none;
    }

    /* ── Tier upgrade box ── */
    .tier-upgrade {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      padding: 14px 16px;
      background: #0a0a0a;
      border: 1px solid #1c1917;
      border-left: 3px solid #f59e0b;
      margin-bottom: 24px;
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 12px;
      letter-spacing: 2px;
      text-transform: uppercase;
    }

    .tier-upgrade__current {
      color: #78716c;
    }

    .tier-upgrade__arrow {
      color: #f59e0b;
      font-weight: 700;
      font-size: 14px;
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
      color: #a8a29e;
      margin: 0 0 24px;
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
      color: #a8a29e;
      margin-bottom: 8px;
    }

    .field-label__optional {
      font-weight: 400;
      text-transform: none;
      letter-spacing: normal;
      color: #57534e;
    }

    .field-textarea {
      display: block;
      width: 100%;
      min-height: 100px;
      padding: 12px;
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 13px;
      line-height: 1.6;
      color: #d6d3d1;
      background: #0a0a0a;
      border: 1px solid #292524;
      resize: vertical;
      transition: border-color 200ms, box-shadow 200ms;
      box-sizing: border-box;
    }

    .field-textarea::placeholder {
      color: #44403c;
    }

    .field-textarea:focus {
      outline: none;
      border-color: #f59e0b;
      box-shadow: 0 0 0 1px rgba(245, 158, 11, 0.3);
    }

    .field-textarea:focus-visible {
      outline: 2px solid #f59e0b;
      outline-offset: 2px;
    }

    .char-count {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 10px;
      color: #78716c;
      text-align: right;
      margin-top: 6px;
      letter-spacing: 1px;
      transition: color 200ms;
    }

    .char-count--active {
      color: #f59e0b;
    }

    /* ── Footer actions ── */
    .actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 12px;
    }

    .btn {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-weight: 700;
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
      color: #78716c;
      background: transparent;
      border: 1px solid #292524;
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
      box-shadow: 3px 3px 0 rgba(245, 158, 11, 0.15);
    }

    .btn--submit:hover {
      background: #fbbf24;
      transform: translate(-2px, -2px);
      box-shadow: 5px 5px 0 rgba(245, 158, 11, 0.2);
    }

    .btn--submit:active {
      transform: translate(0);
      box-shadow: 2px 2px 0 rgba(245, 158, 11, 0.1);
    }

    .btn--submit:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    .btn--submit:disabled:hover {
      background: #f59e0b;
      transform: none;
      box-shadow: none;
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
          <div class="char-count ${this._message.length > 0 ? 'char-count--active' : ''}">${this._message.length}/500</div>
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
