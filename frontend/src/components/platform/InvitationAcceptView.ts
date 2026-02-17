import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { invitationsApi } from '../../services/api/index.js';
import type { InvitationPublicInfo } from '../../types/index.js';
import { VelgToast } from '../shared/Toast.js';

@localized()
@customElement('velg-invitation-accept-view')
export class VelgInvitationAcceptView extends LitElement {
  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 80vh;
    }

    .invitation {
      width: 100%;
      max-width: 520px;
      background: var(--color-surface-raised);
      border: var(--border-default);
      box-shadow: var(--shadow-lg);
    }

    .invitation__header {
      padding: var(--space-4) var(--space-6);
      background: var(--color-surface-header);
      border-bottom: var(--border-default);
    }

    .invitation__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xl);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      margin: 0;
    }

    .invitation__body {
      padding: var(--space-6);
    }

    .invitation__message {
      font-size: var(--text-base);
      line-height: var(--leading-relaxed);
      color: var(--color-text-primary);
      margin-bottom: var(--space-4);
    }

    .invitation__highlight {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
    }

    .invitation__role-badge {
      display: inline-block;
      padding: var(--space-0-5) var(--space-2);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      background: var(--color-info-bg);
      border: var(--border-width-default) solid var(--color-info-border);
      color: var(--color-info);
    }

    .invitation__status {
      padding: var(--space-3);
      margin-bottom: var(--space-4);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
    }

    .invitation__status--expired {
      background: var(--color-warning-bg);
      border: var(--border-width-default) solid var(--color-warning-border);
      color: var(--color-warning);
    }

    .invitation__status--accepted {
      background: var(--color-info-bg);
      border: var(--border-width-default) solid var(--color-info-border);
      color: var(--color-info);
    }

    .invitation__status--auth {
      background: var(--color-danger-bg);
      border: var(--border-width-default) solid var(--color-danger-border);
      color: var(--color-text-danger);
    }

    .invitation__login-link {
      color: var(--color-text-link);
      text-decoration: underline;
      font-weight: var(--font-bold);
      cursor: pointer;
    }

    .invitation__login-link:hover {
      color: var(--color-info-hover);
    }

    .invitation__footer {
      padding: var(--space-4) var(--space-6);
      border-top: var(--border-light);
      display: flex;
      justify-content: flex-end;
    }

    .btn-accept {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-3) var(--space-6);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-base);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      background: var(--color-primary);
      color: var(--color-text-inverse);
      border: var(--border-default);
      border-radius: var(--border-radius);
      box-shadow: var(--shadow-md);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .btn-accept:hover {
      transform: translate(-2px, -2px);
      box-shadow: var(--shadow-lg);
    }

    .btn-accept:active {
      transform: translate(0);
      box-shadow: var(--shadow-pressed);
    }

    .btn-accept:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    }

    .loading-state {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 200px;
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-lg);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-secondary);
    }

    .error-state {
      padding: var(--space-4);
      background: var(--color-danger-bg);
      border: var(--border-width-default) solid var(--color-danger-border);
      color: var(--color-text-danger);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
    }
  `;

  @property() token = '';

  @state() private _invitation: InvitationPublicInfo | null = null;
  @state() private _loading = true;
  @state() private _accepting = false;
  @state() private _error: string | null = null;

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    if (this.token) {
      await this._loadInvitation();
    }
  }

  protected willUpdate(changedProperties: Map<PropertyKey, unknown>): void {
    if (
      changedProperties.has('token') &&
      this.token &&
      changedProperties.get('token') !== undefined
    ) {
      this._loadInvitation();
    }
  }

  private async _loadInvitation(): Promise<void> {
    this._loading = true;
    this._error = null;

    try {
      const response = await invitationsApi.validate(this.token);
      if (response.success && response.data) {
        this._invitation = response.data;
      } else {
        this._error = response.error?.message ?? msg('Failed to load invitation details.');
      }
    } catch {
      this._error = msg('An unexpected error occurred while loading the invitation.');
    } finally {
      this._loading = false;
    }
  }

  private async _handleAccept(): Promise<void> {
    this._accepting = true;
    this._error = null;

    try {
      const response = await invitationsApi.accept(this.token);
      if (response.success && response.data) {
        VelgToast.success(msg('Invitation accepted successfully.'));
        this.dispatchEvent(
          new CustomEvent('navigate', {
            detail: `/simulations/${response.data.simulation_id}/agents`,
            bubbles: true,
            composed: true,
          }),
        );
      } else {
        this._error = response.error?.message ?? msg('Failed to accept the invitation.');
        VelgToast.error(this._error);
      }
    } catch {
      this._error = msg('An unexpected error occurred while accepting the invitation.');
      VelgToast.error(this._error);
    } finally {
      this._accepting = false;
    }
  }

  private _handleLoginClick(e: Event): void {
    e.preventDefault();
    this.dispatchEvent(
      new CustomEvent('navigate', {
        detail: '/login',
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _renderStatus() {
    const inv = this._invitation;
    if (!inv) return nothing;

    if (inv.is_expired) {
      return html`
        <div class="invitation__status invitation__status--expired">
          ${msg('This invitation has expired.')}
        </div>
      `;
    }

    if (inv.is_accepted) {
      return html`
        <div class="invitation__status invitation__status--accepted">
          ${msg('This invitation was already accepted.')}
        </div>
      `;
    }

    if (!appState.isAuthenticated.value) {
      return html`
        <div class="invitation__status invitation__status--auth">
          ${msg('Please')}
          <a class="invitation__login-link" href="/login" @click=${this._handleLoginClick}>
            ${msg('log in')}
          </a>
          ${msg('first to accept this invitation.')}
        </div>
      `;
    }

    return nothing;
  }

  private get _canAccept(): boolean {
    const inv = this._invitation;
    if (!inv) return false;
    return !inv.is_expired && !inv.is_accepted && appState.isAuthenticated.value;
  }

  protected render() {
    if (this._loading) {
      return html`
        <div class="invitation">
          <div class="invitation__body">
            <div class="loading-state">${msg('Loading invitation...')}</div>
          </div>
        </div>
      `;
    }

    if (this._error && !this._invitation) {
      return html`
        <div class="invitation">
          <div class="invitation__header">
            <h1 class="invitation__title">${msg('Invitation')}</h1>
          </div>
          <div class="invitation__body">
            <div class="error-state">${this._error}</div>
          </div>
        </div>
      `;
    }

    const inv = this._invitation;
    if (!inv) return nothing;

    return html`
      <div class="invitation">
        <div class="invitation__header">
          <h1 class="invitation__title">${msg('Invitation')}</h1>
        </div>

        <div class="invitation__body">
          ${this._error ? html`<div class="error-state">${this._error}</div>` : nothing}

          ${this._renderStatus()}

          <div class="invitation__message">
            ${msg("You've been invited to join")}
            <span class="invitation__highlight">${inv.simulation_name}</span>
            ${msg('as')}
            <span class="invitation__role-badge">${inv.invited_role}</span>
          </div>
        </div>

        ${
          this._canAccept
            ? html`
            <div class="invitation__footer">
              <button
                class="btn-accept"
                @click=${this._handleAccept}
                ?disabled=${this._accepting}
              >
                ${this._accepting ? msg('Accepting...') : msg('Accept Invitation')}
              </button>
            </div>
          `
            : nothing
        }
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-invitation-accept-view': VelgInvitationAcceptView;
  }
}
