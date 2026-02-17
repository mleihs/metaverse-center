import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { usersApi } from '../../services/api/index.js';
import type { MembershipInfo } from '../../types/index.js';
import { VelgToast } from '../shared/Toast.js';

@localized()
@customElement('velg-user-profile-view')
export class VelgUserProfileView extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: var(--content-padding, var(--space-6));
      max-width: 720px;
      margin: 0 auto;
    }

    .profile__header {
      margin-bottom: var(--space-6);
    }

    .profile__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-2xl);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      margin: 0;
    }

    .profile__section {
      background: var(--color-surface-raised);
      border: var(--border-default);
      box-shadow: var(--shadow-md);
      margin-bottom: var(--space-6);
    }

    .profile__section-header {
      padding: var(--space-3) var(--space-6);
      background: var(--color-surface-header);
      border-bottom: var(--border-default);
    }

    .profile__section-title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-base);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      margin: 0;
    }

    .profile__section-body {
      padding: var(--space-6);
    }

    .profile__form {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }

    .profile__field {
      display: flex;
      flex-direction: column;
      gap: var(--space-1-5);
    }

    .profile__label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-primary);
    }

    .profile__input {
      font-family: var(--font-sans);
      font-size: var(--text-base);
      padding: var(--space-2-5) var(--space-3);
      border: var(--border-medium);
      background: var(--color-surface);
      color: var(--color-text-primary);
      transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
      width: 100%;
      box-sizing: border-box;
    }

    .profile__input:focus {
      outline: none;
      border-color: var(--color-border-focus);
      box-shadow: var(--ring-focus);
    }

    .profile__input::placeholder {
      color: var(--color-text-muted);
    }

    .profile__input--readonly {
      background: var(--color-surface-sunken);
      color: var(--color-text-secondary);
      cursor: not-allowed;
    }

    .profile__actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-3);
      margin-top: var(--space-2);
    }

    .profile__btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-2) var(--space-4);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      border: var(--border-default);
      box-shadow: var(--shadow-md);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .profile__btn:hover {
      transform: translate(-2px, -2px);
      box-shadow: var(--shadow-lg);
    }

    .profile__btn:active {
      transform: translate(0);
      box-shadow: var(--shadow-pressed);
    }

    .profile__btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    }

    .profile__btn--save {
      background: var(--color-primary);
      color: var(--color-text-inverse);
    }

    .profile__info-text {
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      line-height: var(--leading-relaxed);
    }

    .profile__memberships-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .profile__membership {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-3) var(--space-4);
      border: var(--border-medium);
      transition: background var(--transition-fast);
      cursor: pointer;
    }

    .profile__membership:hover {
      background: var(--color-surface-sunken);
    }

    .profile__membership-name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-base);
    }

    .profile__membership-meta {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .profile__membership-role {
      display: inline-block;
      padding: var(--space-0-5) var(--space-2);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      background: var(--color-info-bg);
      border: var(--border-width-default) solid var(--color-info-border);
      color: var(--color-info);
    }

    .profile__membership-date {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .profile__api-error {
      padding: var(--space-3);
      background: var(--color-danger-bg);
      border: var(--border-width-default) solid var(--color-danger);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      color: var(--color-danger);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      margin-bottom: var(--space-4);
    }

    .loading-state {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-6);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-secondary);
    }

    .empty-state {
      padding: var(--space-4);
      text-align: center;
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
    }
  `;

  @state() private _displayName = '';
  @state() private _saving = false;
  @state() private _apiError: string | null = null;
  @state() private _memberships: MembershipInfo[] = [];
  @state() private _loadingMemberships = true;
  @state() private _membershipsError: string | null = null;

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    this._initForm();
    await this._loadMemberships();
  }

  private _initForm(): void {
    const user = appState.user.value;
    if (user) {
      this._displayName = (user.user_metadata?.display_name as string) ?? user.email ?? '';
    }
  }

  private async _loadMemberships(): Promise<void> {
    this._loadingMemberships = true;
    this._membershipsError = null;

    try {
      const response = await usersApi.getMemberships();
      if (response.success && response.data) {
        this._memberships = response.data;
      } else {
        this._membershipsError = response.error?.message ?? msg('Failed to load memberships.');
      }
    } catch {
      this._membershipsError = msg('An unexpected error occurred while loading memberships.');
    } finally {
      this._loadingMemberships = false;
    }
  }

  private _handleDisplayNameInput(e: Event): void {
    this._displayName = (e.target as HTMLInputElement).value;
  }

  private async _handleSave(): Promise<void> {
    this._saving = true;
    this._apiError = null;

    try {
      const response = await usersApi.updateMe({
        display_name: this._displayName.trim(),
      });

      if (response.success) {
        VelgToast.success(msg('Profile updated successfully.'));
      } else {
        this._apiError = response.error?.message ?? msg('Failed to update profile.');
        VelgToast.error(this._apiError);
      }
    } catch {
      this._apiError = msg('An unexpected error occurred.');
      VelgToast.error(this._apiError);
    } finally {
      this._saving = false;
    }
  }

  private _handleMembershipClick(membership: MembershipInfo): void {
    this.dispatchEvent(
      new CustomEvent('navigate', {
        detail: `/simulations/${membership.simulation_id}/agents`,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _formatDate(dateStr: string): string {
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  }

  private _renderProfileForm() {
    const user = appState.user.value;
    const email = user?.email ?? '';

    return html`
      <div class="profile__section">
        <div class="profile__section-header">
          <h2 class="profile__section-title">${msg('Profile Information')}</h2>
        </div>
        <div class="profile__section-body">
          ${
            this._apiError ? html`<div class="profile__api-error">${this._apiError}</div>` : nothing
          }

          <div class="profile__form">
            <div class="profile__field">
              <label class="profile__label" for="profile-email">${msg('Email')}</label>
              <input
                class="profile__input profile__input--readonly"
                id="profile-email"
                type="email"
                .value=${email}
                readonly
              />
            </div>

            <div class="profile__field">
              <label class="profile__label" for="profile-display-name">
                ${msg('Display Name')}
              </label>
              <input
                class="profile__input"
                id="profile-display-name"
                type="text"
                placeholder=${msg('Your display name...')}
                .value=${this._displayName}
                @input=${this._handleDisplayNameInput}
              />
            </div>

            <div class="profile__actions">
              <button
                class="profile__btn profile__btn--save"
                @click=${this._handleSave}
                ?disabled=${this._saving}
              >
                ${this._saving ? msg('Saving...') : msg('Save Changes')}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private _renderPasswordSection() {
    return html`
      <div class="profile__section">
        <div class="profile__section-header">
          <h2 class="profile__section-title">${msg('Password')}</h2>
        </div>
        <div class="profile__section-body">
          <p class="profile__info-text">
            ${msg('Use the reset password flow to change your password. A password reset email will be sent to your registered email address.')}
          </p>
        </div>
      </div>
    `;
  }

  private _renderMemberships() {
    return html`
      <div class="profile__section">
        <div class="profile__section-header">
          <h2 class="profile__section-title">${msg('Simulation Memberships')}</h2>
        </div>
        <div class="profile__section-body">
          ${
            this._loadingMemberships
              ? html`<div class="loading-state">${msg('Loading memberships...')}</div>`
              : this._membershipsError
                ? html`<div class="profile__api-error">${this._membershipsError}</div>`
                : this._memberships.length === 0
                  ? html`<div class="empty-state">
                    ${msg('You are not a member of any simulations yet.')}
                  </div>`
                  : html`
                  <div class="profile__memberships-list">
                    ${this._memberships.map(
                      (m) => html`
                        <div
                          class="profile__membership"
                          @click=${() => this._handleMembershipClick(m)}
                        >
                          <span class="profile__membership-name">
                            ${m.simulation_name}
                          </span>
                          <div class="profile__membership-meta">
                            <span class="profile__membership-role">
                              ${m.member_role}
                            </span>
                            <span class="profile__membership-date">
                              ${msg(str`Joined ${this._formatDate(m.joined_at)}`)}
                            </span>
                          </div>
                        </div>
                      `,
                    )}
                  </div>
                `
          }
        </div>
      </div>
    `;
  }

  protected render() {
    return html`
      <div class="profile__header">
        <h1 class="profile__title">${msg('Profile')}</h1>
      </div>

      ${this._renderProfileForm()}
      ${this._renderPasswordSection()}
      ${this._renderMemberships()}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-user-profile-view': VelgUserProfileView;
  }
}
