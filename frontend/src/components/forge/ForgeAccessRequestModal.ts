/**
 * ForgeAccessRequestModal — Bureau clearance upgrade application.
 *
 * Modal for submitting a clearance upgrade request from
 * Field Observer → Reality Architect.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { forgeApi } from '../../services/api/ForgeApiService.js';
import { formStyles } from '../shared/form-styles.js';
import { VelgToast } from '../shared/Toast.js';
import '../shared/BaseModal.js';

@localized()
@customElement('velg-forge-access-modal')
export class VelgForgeAccessModal extends LitElement {
  static styles = [
    formStyles,
    css`
      .classification {
        font-family: var(--font-mono, monospace);
        font-size: 10px;
        letter-spacing: 2px;
        text-transform: uppercase;
        color: var(--color-text-muted);
        text-align: center;
        margin-bottom: var(--space-4);
      }

      .tier-upgrade {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-4);
        background: var(--color-surface-sunken);
        border: 1px solid var(--color-border);
        margin-bottom: var(--space-4);
        font-family: var(--font-mono, monospace);
        font-size: 12px;
        letter-spacing: 2px;
        text-transform: uppercase;
      }

      .tier-upgrade__current {
        color: var(--color-text-muted);
      }

      .tier-upgrade__arrow {
        color: var(--color-warning);
      }

      .tier-upgrade__target {
        color: var(--color-warning);
        font-weight: 700;
      }

      .description {
        font-family: var(--font-mono, monospace);
        font-size: 13px;
        line-height: 1.7;
        color: var(--color-text-secondary);
        margin-bottom: var(--space-4);
      }

      .char-count {
        font-family: var(--font-mono, monospace);
        font-size: 10px;
        color: var(--color-text-muted);
        text-align: right;
        margin-top: var(--space-1);
      }
    `,
  ];

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
          ${msg('Architect clearance grants access to the Simulation Forge \u2014 create worlds with AI-driven agents, buildings, and events.')}
        </p>

        <div class="form__group">
          <label class="form__label">${msg('Operational Justification')} <span style="font-weight:normal;text-transform:none;letter-spacing:normal">(${msg('optional')})</span></label>
          <textarea
            class="form__textarea"
            maxlength="500"
            placeholder=${msg('Tell us why you want to create worlds...')}
            .value=${this._message}
            @input=${(e: Event) => { this._message = (e.target as HTMLTextAreaElement).value; }}
          ></textarea>
          <div class="char-count">${this._message.length}/500</div>
        </div>

        <div slot="footer" class="footer">
          <button class="footer__btn footer__btn--cancel" @click=${this._handleClose}>
            ${msg('Cancel')}
          </button>
          <button
            class="footer__btn footer__btn--save"
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
