import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { invitationsApi, membersApi, settingsApi } from '../../services/api/index.js';
import type {
  Invitation,
  SimulationMember,
  SimulationRole,
  SimulationSetting,
} from '../../types/index.js';
import { VelgConfirmDialog } from '../shared/ConfirmDialog.js';
import { VelgToast } from '../shared/Toast.js';
import '../shared/VelgSectionHeader.js';

interface AccessFormData {
  visibility: 'public' | 'private';
  allow_registration: boolean;
  default_role: 'viewer' | 'editor';
  invitation_expiry_hours: number;
  max_members: number;
}

const DEFAULT_FORM: AccessFormData = {
  visibility: 'private',
  allow_registration: false,
  default_role: 'viewer',
  invitation_expiry_hours: 48,
  max_members: 50,
};

@localized()
@customElement('velg-access-settings-panel')
export class VelgAccessSettingsPanel extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .panel {
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
    }

    .panel__owner-notice {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-3);
      background: var(--color-info-bg, rgba(59, 130, 246, 0.1));
      border: var(--border-width-default) solid var(--color-info, #3b82f6);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      color: var(--color-info, #3b82f6);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
    }

    .panel__denied {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-3);
      padding: var(--space-8);
      text-align: center;
    }

    .panel__denied-title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xl);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-primary);
      margin: 0;
    }

    .panel__denied-text {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }

    .form {
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
    }

    .form__group {
      display: flex;
      flex-direction: column;
      gap: var(--space-1-5);
    }

    .form__group--row {
      flex-direction: row;
      align-items: center;
      gap: var(--space-3);
    }

    .form__label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-primary);
    }

    .form__hint {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      font-family: var(--font-sans);
      text-transform: none;
      letter-spacing: normal;
    }

    .form__input,
    .form__select {
      font-family: var(--font-sans);
      font-size: var(--text-base);
      padding: var(--space-2-5) var(--space-3);
      border: var(--border-medium);
      background: var(--color-surface);
      color: var(--color-text-primary);
      width: 100%;
      max-width: 300px;
      box-sizing: border-box;
      transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
    }

    .form__input:focus,
    .form__select:focus {
      outline: none;
      border-color: var(--color-border-focus);
      box-shadow: var(--ring-focus);
    }

    .form__select {
      cursor: pointer;
    }

    .radio-group {
      display: flex;
      gap: var(--space-4);
    }

    .radio {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      cursor: pointer;
    }

    .radio__input {
      appearance: none;
      -webkit-appearance: none;
      width: 18px;
      height: 18px;
      border: var(--border-medium);
      background: var(--color-surface);
      cursor: pointer;
      position: relative;
      flex-shrink: 0;
    }

    .radio__input:checked {
      border-color: var(--color-primary);
      background: var(--color-primary);
    }

    .radio__input:checked::after {
      content: '';
      position: absolute;
      width: 8px;
      height: 8px;
      background: var(--color-text-inverse);
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    }

    .radio__input:focus {
      box-shadow: var(--ring-focus);
    }

    .radio__label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-primary);
    }

    .toggle {
      position: relative;
      display: inline-block;
      width: 44px;
      height: 24px;
      flex-shrink: 0;
    }

    .toggle__input {
      opacity: 0;
      width: 0;
      height: 0;
      position: absolute;
    }

    .toggle__slider {
      position: absolute;
      cursor: pointer;
      inset: 0;
      background: var(--color-surface-sunken);
      border: var(--border-width-default) solid var(--color-border);
      transition: all var(--transition-fast);
    }

    .toggle__slider::before {
      content: '';
      position: absolute;
      height: 16px;
      width: 16px;
      left: 3px;
      bottom: 3px;
      background: var(--color-text-muted);
      transition: all var(--transition-fast);
    }

    .toggle__input:checked + .toggle__slider {
      background: var(--color-primary);
      border-color: var(--color-primary);
    }

    .toggle__input:checked + .toggle__slider::before {
      transform: translateX(20px);
      background: var(--color-text-inverse);
    }

    .toggle__input:focus + .toggle__slider {
      box-shadow: var(--ring-focus);
    }

    .panel__footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: var(--space-3);
      padding-top: var(--space-4);
      border-top: var(--border-default);
    }

    .btn {
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

    .btn:hover {
      transform: translate(-2px, -2px);
      box-shadow: var(--shadow-lg);
    }

    .btn:active {
      transform: translate(0);
      box-shadow: var(--shadow-pressed);
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    }

    .btn--primary {
      background: var(--color-primary);
      color: var(--color-text-inverse);
    }

    .panel__error {
      padding: var(--space-3);
      background: var(--color-danger-bg);
      border: var(--border-width-default) solid var(--color-danger);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      color: var(--color-danger);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
    }

    .members {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }

    .members__list {
      display: flex;
      flex-direction: column;
      gap: 0;
      border: var(--border-default);
    }

    .members__row {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      border-bottom: var(--border-default);
    }

    .members__row:last-child {
      border-bottom: none;
    }

    .members__name {
      flex: 1;
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      color: var(--color-text-primary);
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .members__role-badge {
      display: inline-flex;
      align-items: center;
      padding: var(--space-0-5) var(--space-2);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      border: var(--border-width-default) solid var(--color-border);
      background: var(--color-surface-header);
    }

    .members__role-badge--owner {
      background: var(--color-primary-bg);
      border-color: var(--color-primary);
      color: var(--color-primary);
    }

    .members__role-badge--admin {
      background: var(--color-info-bg, rgba(59, 130, 246, 0.1));
      border-color: var(--color-info, #3b82f6);
      color: var(--color-info, #3b82f6);
    }

    .members__role-select {
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      padding: var(--space-1) var(--space-2);
      border: var(--border-default);
      background: var(--color-surface);
      cursor: pointer;
    }

    .members__remove-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-1) var(--space-2);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      background: transparent;
      color: var(--color-danger);
      border: var(--border-width-thin) solid var(--color-danger);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .members__remove-btn:hover {
      background: var(--color-danger);
      color: var(--color-text-inverse);
    }

    .members__empty {
      padding: var(--space-4);
      text-align: center;
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }

    .invite-form {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      padding: var(--space-4);
      border: var(--border-default);
      background: var(--color-surface-sunken);
    }

    .invite-form__row {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .invite-form__input {
      flex: 1;
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      padding: var(--space-2) var(--space-3);
      border: var(--border-default);
      background: var(--color-surface);
      color: var(--color-text-primary);
    }

    .invite-form__input:focus {
      outline: none;
      border-color: var(--color-border-focus);
      box-shadow: var(--ring-focus);
    }

    .invite-form__select {
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      padding: var(--space-2) var(--space-3);
      border: var(--border-default);
      background: var(--color-surface);
      cursor: pointer;
    }

    .invite-form__actions {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .invite-link {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-3);
      background: var(--color-success-bg, #e6f9e6);
      border: var(--border-width-default) solid var(--color-success);
      word-break: break-all;
    }

    .invite-link__url {
      flex: 1;
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-primary);
    }

    .invite-link__copy-btn {
      flex-shrink: 0;
      padding: var(--space-1) var(--space-2);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      background: var(--color-surface);
      border: var(--border-default);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .invite-link__copy-btn:hover {
      background: var(--color-surface-sunken);
    }

    .invitations__list {
      display: flex;
      flex-direction: column;
      gap: 0;
      border: var(--border-default);
    }

    .invitations__row {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2-5) var(--space-4);
      border-bottom: var(--border-default);
      font-size: var(--text-sm);
    }

    .invitations__row:last-child {
      border-bottom: none;
    }

    .invitations__email {
      flex: 1;
      font-family: var(--font-sans);
      color: var(--color-text-primary);
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .invitations__status {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-warning);
    }

    .invitations__status--expired {
      color: var(--color-text-muted);
    }

    .invitations__status--accepted {
      color: var(--color-success);
    }
  `;

  @property({ type: String }) simulationId = '';

  @state() private _formData: AccessFormData = { ...DEFAULT_FORM };
  @state() private _originalData: AccessFormData = { ...DEFAULT_FORM };
  @state() private _loading = true;
  @state() private _saving = false;
  @state() private _error: string | null = null;

  @state() private _members: SimulationMember[] = [];
  @state() private _invitations: Invitation[] = [];
  @state() private _loadingMembers = false;
  @state() private _showInviteForm = false;
  @state() private _inviteEmail = '';
  @state() private _inviteRole: SimulationRole = 'viewer';
  @state() private _createdInviteLink: string | null = null;

  private get _isOwner(): boolean {
    return appState.isOwner.value;
  }

  private get _hasChanges(): boolean {
    return (
      this._formData.visibility !== this._originalData.visibility ||
      this._formData.allow_registration !== this._originalData.allow_registration ||
      this._formData.default_role !== this._originalData.default_role ||
      this._formData.invitation_expiry_hours !== this._originalData.invitation_expiry_hours ||
      this._formData.max_members !== this._originalData.max_members
    );
  }

  protected willUpdate(changedProperties: Map<PropertyKey, unknown>): void {
    if (changedProperties.has('simulationId') && this.simulationId && this._isOwner) {
      this._loadSettings();
      this._loadMembers();
      this._loadInvitations();
    }
  }

  protected updated(changedProperties: Map<PropertyKey, unknown>): void {
    super.updated(changedProperties);
    const prevForm = changedProperties.get('_formData') as AccessFormData | undefined;
    const prevOriginal = changedProperties.get('_originalData') as AccessFormData | undefined;
    if (prevForm !== undefined || prevOriginal !== undefined) {
      this.dispatchEvent(
        new CustomEvent('unsaved-change', {
          detail: this._hasChanges,
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  private async _loadSettings(): Promise<void> {
    if (!this.simulationId) return;

    this._loading = true;
    this._error = null;

    try {
      const response = await settingsApi.list(this.simulationId, 'access');

      if (response.success && response.data) {
        const settings = response.data as SimulationSetting[];
        const formData: AccessFormData = { ...DEFAULT_FORM };

        for (const setting of settings) {
          const val = setting.setting_value;
          switch (setting.setting_key) {
            case 'visibility':
              formData.visibility = (val as 'public' | 'private') ?? 'private';
              break;
            case 'allow_registration':
              formData.allow_registration = val === true || val === 'true';
              break;
            case 'default_role':
              formData.default_role = (val as 'viewer' | 'editor') ?? 'viewer';
              break;
            case 'invitation_expiry_hours':
              formData.invitation_expiry_hours = Number(val) || 48;
              break;
            case 'max_members':
              formData.max_members = Number(val) || 50;
              break;
          }
        }

        this._formData = { ...formData };
        this._originalData = { ...formData };
      } else {
        this._error = response.error?.message ?? msg('Failed to load access settings');
      }
    } catch (err) {
      this._error = err instanceof Error ? err.message : msg('An unknown error occurred');
    } finally {
      this._loading = false;
    }
  }

  private _handleVisibilityChange(e: Event): void {
    const target = e.target as HTMLInputElement;
    this._formData = {
      ...this._formData,
      visibility: target.value as 'public' | 'private',
    };
  }

  private _handleRegistrationToggle(e: Event): void {
    const target = e.target as HTMLInputElement;
    this._formData = {
      ...this._formData,
      allow_registration: target.checked,
    };
  }

  private _handleDefaultRoleChange(e: Event): void {
    const target = e.target as HTMLSelectElement;
    this._formData = {
      ...this._formData,
      default_role: target.value as 'viewer' | 'editor',
    };
  }

  private _handleNumberInput(field: 'invitation_expiry_hours' | 'max_members', e: Event): void {
    const target = e.target as HTMLInputElement;
    this._formData = {
      ...this._formData,
      [field]: Number.parseInt(target.value, 10) || 0,
    };
  }

  private async _handleSave(): Promise<void> {
    if (!this._hasChanges || this._saving) return;

    this._saving = true;
    this._error = null;

    try {
      const fieldsToSave: Array<{ key: string; value: unknown }> = [];

      if (this._formData.visibility !== this._originalData.visibility) {
        fieldsToSave.push({ key: 'visibility', value: this._formData.visibility });
      }
      if (this._formData.allow_registration !== this._originalData.allow_registration) {
        fieldsToSave.push({ key: 'allow_registration', value: this._formData.allow_registration });
      }
      if (this._formData.default_role !== this._originalData.default_role) {
        fieldsToSave.push({ key: 'default_role', value: this._formData.default_role });
      }
      if (this._formData.invitation_expiry_hours !== this._originalData.invitation_expiry_hours) {
        fieldsToSave.push({
          key: 'invitation_expiry_hours',
          value: this._formData.invitation_expiry_hours,
        });
      }
      if (this._formData.max_members !== this._originalData.max_members) {
        fieldsToSave.push({ key: 'max_members', value: this._formData.max_members });
      }

      for (const field of fieldsToSave) {
        const response = await settingsApi.upsert(this.simulationId, {
          category: 'access',
          setting_key: field.key,
          setting_value: field.value,
        });

        if (!response.success) {
          this._error = response.error?.message ?? msg(str`Failed to save ${field.key}`);
          VelgToast.error(msg(str`Failed to save ${field.key}`));
          return;
        }
      }

      this._originalData = { ...this._formData };
      VelgToast.success(msg('Access settings saved successfully.'));
      this.dispatchEvent(new CustomEvent('settings-saved', { bubbles: true, composed: true }));
    } catch (err) {
      this._error = err instanceof Error ? err.message : msg('An unknown error occurred');
      VelgToast.error(this._error);
    } finally {
      this._saving = false;
    }
  }

  private async _loadMembers(): Promise<void> {
    if (!this.simulationId) return;
    this._loadingMembers = true;
    try {
      const response = await membersApi.list(this.simulationId);
      if (response.success && response.data) {
        this._members = response.data as SimulationMember[];
      }
    } catch {
      // Silently fail — members section is supplementary
    } finally {
      this._loadingMembers = false;
    }
  }

  private async _loadInvitations(): Promise<void> {
    if (!this.simulationId) return;
    try {
      const response = await invitationsApi.list(this.simulationId);
      if (response.success && response.data) {
        this._invitations = response.data as Invitation[];
      }
    } catch {
      // Silently fail
    }
  }

  private async _handleRoleChange(member: SimulationMember, e: Event): Promise<void> {
    const target = e.target as HTMLSelectElement;
    const newRole = target.value as SimulationRole;
    try {
      const response = await membersApi.changeRole(this.simulationId, member.id, {
        member_role: newRole,
      });
      if (response.success) {
        VelgToast.success(msg(str`Role updated to ${newRole}.`));
        this._loadMembers();
      } else {
        VelgToast.error(response.error?.message ?? msg('Failed to change role.'));
      }
    } catch {
      VelgToast.error(msg('An unexpected error occurred.'));
    }
  }

  private async _handleRemoveMember(member: SimulationMember): Promise<void> {
    const displayName = member.user?.display_name ?? member.user?.email ?? msg('this member');

    const confirmed = await VelgConfirmDialog.show({
      title: msg('Remove Member'),
      message: msg(str`Are you sure you want to remove ${displayName} from this simulation?`),
      confirmLabel: msg('Remove'),
      variant: 'danger',
    });

    if (!confirmed) return;

    try {
      const response = await membersApi.remove(this.simulationId, member.id);
      if (response.success) {
        VelgToast.success(msg(str`${displayName} has been removed.`));
        this._loadMembers();
      } else {
        VelgToast.error(response.error?.message ?? msg('Failed to remove member.'));
      }
    } catch {
      VelgToast.error(msg('An unexpected error occurred.'));
    }
  }

  private _handleToggleInviteForm(): void {
    this._showInviteForm = !this._showInviteForm;
    this._createdInviteLink = null;
    this._inviteEmail = '';
    this._inviteRole = 'viewer';
  }

  private async _handleCreateInvitation(): Promise<void> {
    try {
      const response = await invitationsApi.create(this.simulationId, {
        invited_email: this._inviteEmail || undefined,
        invited_role: this._inviteRole,
      });
      if (response.success && response.data) {
        const invitation = response.data as Invitation;
        this._createdInviteLink = `${window.location.origin}/invitations/${invitation.invite_token}`;
        VelgToast.success(msg('Invitation created.'));
        this._loadInvitations();
      } else {
        VelgToast.error(response.error?.message ?? msg('Failed to create invitation.'));
      }
    } catch {
      VelgToast.error(msg('An unexpected error occurred.'));
    }
  }

  private async _handleCopyInviteLink(): Promise<void> {
    if (!this._createdInviteLink) return;
    try {
      await navigator.clipboard.writeText(this._createdInviteLink);
      VelgToast.success(msg('Link copied to clipboard.'));
    } catch {
      VelgToast.error(msg('Failed to copy link.'));
    }
  }

  private _getInvitationStatus(inv: Invitation): { label: string; cssClass: string } {
    if (inv.accepted_at) {
      return { label: msg('Accepted'), cssClass: 'invitations__status--accepted' };
    }
    const expired = new Date(inv.expires_at) < new Date();
    if (expired) {
      return { label: msg('Expired'), cssClass: 'invitations__status--expired' };
    }
    return { label: msg('Pending'), cssClass: '' };
  }

  private _renderMembersSection() {
    if (!this._isOwner) return nothing;

    return html`
      <velg-section-header variant="large">${msg('Members')}</velg-section-header>

      ${
        this._loadingMembers
          ? html`<velg-loading-state message=${msg('Loading members...')}></velg-loading-state>`
          : html`
            <div class="members">
              ${
                this._members.length > 0
                  ? html`
                    <div class="members__list">
                      ${this._members.map((member) => this._renderMemberRow(member))}
                    </div>
                  `
                  : html`<div class="members__empty">${msg('No members found.')}</div>`
              }

              <div>
                <button
                  class="btn btn--primary"
                  @click=${this._handleToggleInviteForm}
                >
                  ${this._showInviteForm ? msg('Cancel') : msg('Create Invitation')}
                </button>
              </div>

              ${this._showInviteForm ? this._renderInviteForm() : nothing}

              ${this._renderPendingInvitations()}
            </div>
          `
      }
    `;
  }

  private _renderMemberRow(member: SimulationMember) {
    const displayName = member.user?.display_name ?? member.user?.email ?? msg('Unknown');
    const isOwnerMember = member.member_role === 'owner';
    const roleBadgeClass =
      member.member_role === 'owner'
        ? 'members__role-badge members__role-badge--owner'
        : member.member_role === 'admin'
          ? 'members__role-badge members__role-badge--admin'
          : 'members__role-badge';

    return html`
      <div class="members__row">
        <span class="members__name">${displayName}</span>

        ${
          isOwnerMember
            ? html`<span class=${roleBadgeClass}>${member.member_role}</span>`
            : html`
              <select
                class="members__role-select"
                .value=${member.member_role}
                @change=${(e: Event) => this._handleRoleChange(member, e)}
              >
                <option value="admin" ?selected=${member.member_role === 'admin'}>${msg('Admin')}</option>
                <option value="editor" ?selected=${member.member_role === 'editor'}>${msg('Editor')}</option>
                <option value="viewer" ?selected=${member.member_role === 'viewer'}>${msg('Viewer')}</option>
              </select>
            `
        }

        ${
          isOwnerMember
            ? nothing
            : html`
              <button
                class="members__remove-btn"
                @click=${() => this._handleRemoveMember(member)}
              >
                ${msg('Remove')}
              </button>
            `
        }
      </div>
    `;
  }

  private _renderInviteForm() {
    return html`
      <div class="invite-form">
        <div class="invite-form__row">
          <input
            class="invite-form__input"
            type="email"
            placeholder=${msg('Email (optional)')}
            .value=${this._inviteEmail}
            @input=${(e: Event) => {
              this._inviteEmail = (e.target as HTMLInputElement).value;
            }}
          />
          <select
            class="invite-form__select"
            .value=${this._inviteRole}
            @change=${(e: Event) => {
              this._inviteRole = (e.target as HTMLSelectElement).value as SimulationRole;
            }}
          >
            <option value="admin">${msg('Admin')}</option>
            <option value="editor">${msg('Editor')}</option>
            <option value="viewer" selected>${msg('Viewer')}</option>
          </select>
        </div>

        <div class="invite-form__actions">
          <button class="btn btn--primary" @click=${this._handleCreateInvitation}>
            ${msg('Create')}
          </button>
        </div>

        ${
          this._createdInviteLink
            ? html`
              <div class="invite-link">
                <span class="invite-link__url">${this._createdInviteLink}</span>
                <button class="invite-link__copy-btn" @click=${this._handleCopyInviteLink}>
                  ${msg('Copy')}
                </button>
              </div>
            `
            : nothing
        }
      </div>
    `;
  }

  private _renderPendingInvitations() {
    const pending = this._invitations.filter((inv) => !inv.accepted_at);
    if (pending.length === 0) return nothing;

    return html`
      <div>
        <h3 class="form__label" style="margin-bottom: var(--space-2)">${msg('Pending Invitations')}</h3>
        <div class="invitations__list">
          ${pending.map((inv) => {
            const status = this._getInvitationStatus(inv);
            return html`
              <div class="invitations__row">
                <span class="invitations__email">${inv.invited_email ?? msg('Open link')}</span>
                <span class="members__role-badge">${inv.invited_role}</span>
                <span class="invitations__status ${status.cssClass}">${status.label}</span>
              </div>
            `;
          })}
        </div>
      </div>
    `;
  }

  protected render() {
    if (!this._isOwner) {
      return html`
        <div class="panel__denied">
          <h2 class="panel__denied-title">${msg('Access Denied')}</h2>
          <p class="panel__denied-text">
            ${msg('Only the simulation owner can manage access settings.')}
          </p>
        </div>
      `;
    }

    if (this._loading) {
      return html`<velg-loading-state message=${msg('Loading access settings...')}></velg-loading-state>`;
    }

    return html`
      <div class="panel">
        <velg-section-header variant="large">${msg('Access Control')}</velg-section-header>

        <div class="panel__owner-notice">
          ${msg('Only the simulation owner can modify these settings.')}
        </div>

        ${this._error ? html`<div class="panel__error">${this._error}</div>` : nothing}

        <div class="form">
          <div class="form__group">
            <span class="form__label">${msg('Visibility')}</span>
            <div class="radio-group">
              <label class="radio">
                <input
                  class="radio__input"
                  type="radio"
                  name="visibility"
                  value="public"
                  ?checked=${this._formData.visibility === 'public'}
                  @change=${this._handleVisibilityChange}
                />
                <span class="radio__label">${msg('Public')}</span>
              </label>
              <label class="radio">
                <input
                  class="radio__input"
                  type="radio"
                  name="visibility"
                  value="private"
                  ?checked=${this._formData.visibility === 'private'}
                  @change=${this._handleVisibilityChange}
                />
                <span class="radio__label">${msg('Private')}</span>
              </label>
            </div>
            <span class="form__hint">
              ${msg('Public simulations are discoverable by all users. Private simulations require an invitation.')}
            </span>
          </div>

          <div class="form__group form__group--row">
            <label class="toggle">
              <input
                class="toggle__input"
                type="checkbox"
                ?checked=${this._formData.allow_registration}
                @change=${this._handleRegistrationToggle}
              />
              <span class="toggle__slider"></span>
            </label>
            <div>
              <span class="form__label">${msg('Allow Registration')}</span>
              <span class="form__hint"> -- ${msg('Users can request to join without an invitation')}</span>
            </div>
          </div>

          <div class="form__group">
            <label class="form__label" for="access-default-role">${msg('Default Role for New Members')}</label>
            <select
              class="form__select"
              id="access-default-role"
              .value=${this._formData.default_role}
              @change=${this._handleDefaultRoleChange}
            >
              <option value="viewer" ?selected=${this._formData.default_role === 'viewer'}>
                ${msg('Viewer')}
              </option>
              <option value="editor" ?selected=${this._formData.default_role === 'editor'}>
                ${msg('Editor')}
              </option>
            </select>
            <span class="form__hint">
              ${msg('Role assigned to new members when they join.')}
            </span>
          </div>

          <div class="form__group">
            <label class="form__label" for="access-invitation-expiry">
              ${msg('Invitation Expiry (hours)')}
            </label>
            <input
              class="form__input"
              id="access-invitation-expiry"
              type="number"
              min="1"
              max="8760"
              .value=${String(this._formData.invitation_expiry_hours)}
              @input=${(e: Event) => this._handleNumberInput('invitation_expiry_hours', e)}
            />
            <span class="form__hint">
              ${msg('How long invitation links remain valid. Max 8760 (1 year).')}
            </span>
          </div>

          <div class="form__group">
            <label class="form__label" for="access-max-members">${msg('Max Members')}</label>
            <input
              class="form__input"
              id="access-max-members"
              type="number"
              min="1"
              max="10000"
              .value=${String(this._formData.max_members)}
              @input=${(e: Event) => this._handleNumberInput('max_members', e)}
            />
            <span class="form__hint">
              ${msg('Maximum number of members allowed in this simulation.')}
            </span>
          </div>
        </div>

        <div class="panel__footer">
          <button
            class="btn btn--primary"
            @click=${this._handleSave}
            ?disabled=${!this._hasChanges || this._saving}
          >
            ${this._saving ? msg('Saving...') : msg('Save Access Settings')}
          </button>
        </div>

        ${this._renderMembersSection()}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-access-settings-panel': VelgAccessSettingsPanel;
  }
}
