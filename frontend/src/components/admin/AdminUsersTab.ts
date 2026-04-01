import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { adminApi, simulationsApi } from '../../services/api/index.js';
import type { AdminMembership, AdminUser, AdminUserDetail, Simulation } from '../../types/index.js';
import { infoBubbleStyles, renderInfoBubble } from '../shared/info-bubble-styles.js';
import { VelgToast } from '../shared/Toast.js';

import '../shared/ConfirmDialog.js';

@localized()
@customElement('velg-admin-users-tab')
export class VelgAdminUsersTab extends LitElement {
  static styles = [
    infoBubbleStyles,
    css`
    :host {
      display: block;
      color: var(--color-text-primary);
      font-family: var(--font-mono, monospace);
    }

    /* --- Search + controls --- */

    .controls {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      margin-bottom: var(--space-4);
    }

    .search-input {
      flex: 1;
      max-width: 400px;
      padding: var(--space-2) var(--space-3);
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm);
      background: var(--color-surface);
      color: var(--color-text-primary);
      border: 1px solid var(--color-border);
      transition: border-color 0.2s ease;
    }

    .search-input:focus {
      outline: none;
      border-color: var(--color-danger);
      box-shadow: 0 0 0 1px var(--color-danger);
    }

    .search-input::placeholder {
      color: var(--color-text-muted);
    }

    .user-count {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-muted);
    }

    /* --- User list --- */

    .user-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .user-row {
      display: grid;
      grid-template-columns: 1fr auto auto;
      align-items: center;
      gap: var(--space-4);
      padding: var(--space-3) var(--space-4);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      cursor: pointer;
      transition:
        border-color 0.2s ease,
        box-shadow 0.2s ease,
        transform 0.15s ease;
    }

    .user-row:hover {
      border-color: var(--color-text-muted);
      transform: translateX(2px);
    }

    .user-row--expanded {
      border-color: var(--color-danger);
      box-shadow: 0 0 0 1px var(--color-danger);
    }

    .user-email {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      color: var(--color-text-primary);
      word-break: break-all;
    }

    .user-date {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      white-space: nowrap;
    }

    .user-badges {
      display: flex;
      gap: var(--space-1);
      flex-wrap: wrap;
    }

    .badge {
      font-family: var(--font-brutalist);
      font-size: 10px;
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      padding: 1px var(--space-2);
      border: 1px solid;
    }

    .badge--owner {
      color: var(--color-danger);
      border-color: color-mix(in srgb, var(--color-danger) 50%, transparent);
      background: color-mix(in srgb, var(--color-danger) 10%, transparent);
    }

    .badge--admin {
      color: var(--color-info);
      border-color: color-mix(in srgb, var(--color-info) 50%, transparent);
      background: color-mix(in srgb, var(--color-info) 10%, transparent);
    }

    .badge--editor {
      color: var(--color-success);
      border-color: color-mix(in srgb, var(--color-success) 50%, transparent);
      background: color-mix(in srgb, var(--color-success) 10%, transparent);
    }

    .badge--viewer {
      color: var(--color-text-secondary);
      border-color: var(--color-text-muted);
      background: color-mix(in srgb, var(--color-text-secondary) 8%, transparent);
    }

    /* --- Expanded detail --- */

    .user-detail {
      padding: var(--space-4);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-top: none;
      margin-top: calc(-1 * var(--space-2));
      animation: detail-slide 0.2s ease;
    }

    @keyframes detail-slide {
      from {
        opacity: 0;
        max-height: 0;
      }
      to {
        opacity: 1;
        max-height: 500px;
      }
    }

    .detail-section-title {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-muted);
      margin: 0 0 var(--space-3) 0;
    }

    .membership-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      margin-bottom: var(--space-4);
    }

    .membership-row {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2) var(--space-3);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
    }

    .membership-sim {
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      color: var(--color-text-primary);
      flex: 1;
    }

    .membership-role-select {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      padding: var(--space-1) var(--space-2);
      background: var(--color-surface);
      color: var(--color-text-primary);
      border: 1px solid var(--color-border);
    }

    .btn-sm {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      padding: var(--space-1) var(--space-3);
      border: 1px solid var(--color-border);
      background: transparent;
      color: var(--color-text-secondary);
      cursor: pointer;
      transition:
        background 0.2s ease,
        color 0.2s ease,
        transform 0.15s ease;
    }

    .btn-sm:hover {
      transform: translateY(-1px);
    }

    .btn-sm:active {
      transform: translateY(0);
    }

    .btn-sm--danger {
      color: var(--color-danger);
      border-color: color-mix(in srgb, var(--color-danger) 50%, transparent);
    }

    .btn-sm--danger:hover {
      background: var(--color-danger);
      color: var(--color-text-inverse);
      border-color: var(--color-danger);
    }

    .btn-sm--primary {
      color: var(--color-info);
      border-color: color-mix(in srgb, var(--color-info) 50%, transparent);
    }

    .btn-sm--primary:hover {
      background: var(--color-info-hover);
      color: var(--color-text-inverse);
      border-color: var(--color-info-hover);
    }

    /* --- Add membership form --- */

    .add-membership {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding-top: var(--space-3);
      border-top: 1px solid var(--color-border);
    }

    .add-membership select {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      padding: var(--space-1) var(--space-2);
      background: var(--color-surface);
      color: var(--color-text-primary);
      border: 1px solid var(--color-border);
    }

    .detail-actions {
      display: flex;
      gap: var(--space-2);
      margin-top: var(--space-4);
      padding-top: var(--space-3);
      border-top: 1px solid var(--color-border);
    }

    /* --- Forge Access --- */

    .forge-access {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      padding: var(--space-3);
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .forge-access__field {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .forge-access__label {
      font-size: var(--text-xs);
      text-transform: uppercase;
      font-weight: bold;
      color: var(--color-text-muted);
      min-width: 120px;
    }

    .forge-access__input {
      width: 80px;
    }

    /* --- Loading / empty --- */

    .loading,
    .empty {
      text-align: center;
      padding: var(--space-8);
      color: var(--color-text-muted);
      font-family: var(--font-brutalist);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
    }

    /* --- Pagination --- */

    .pagination {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: var(--space-3);
      margin-top: var(--space-4);
    }

    .pagination__btn {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      padding: var(--space-1) var(--space-3);
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-text-secondary);
      cursor: pointer;
    }

    .pagination__btn:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }

    .pagination__btn:hover:not(:disabled) {
      border-color: var(--color-text-muted);
    }

    .pagination__info {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    @media (max-width: 768px) {
      .user-row {
        grid-template-columns: 1fr;
        gap: var(--space-2);
      }

      .controls {
        flex-direction: column;
        align-items: stretch;
      }

      .search-input {
        max-width: none;
      }
    }
  `,
  ];

  @state() private _users: AdminUser[] = [];
  @state() private _loading = true;
  @state() private _search = '';
  @state() private _page = 1;
  @state() private _expandedUserId: string | null = null;
  @state() private _expandedDetail: AdminUserDetail | null = null;
  @state() private _simulations: Simulation[] = [];
  @state() private _addSimId = '';
  @state() private _addRole = 'viewer';
  @state() private _confirmDeleteUserId: string | null = null;

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    await Promise.all([this._loadUsers(), this._loadSimulations()]);
  }

  private async _loadSimulations(): Promise<void> {
    try {
      const result = await simulationsApi.list();
      if (result.success && result.data) {
        this._simulations = result.data as Simulation[];
      } else {
        VelgToast.error(result.error?.message ?? msg('Failed to load simulations.'));
      }
    } catch {
      VelgToast.error(msg('Failed to load simulations.'));
    }
  }

  private async _loadUsers(): Promise<void> {
    this._loading = true;
    try {
      const result = await adminApi.listUsers(this._page, 50);
      if (result.success && result.data) {
        this._users = (result.data as { users: AdminUser[]; total: number }).users;
      } else {
        VelgToast.error(result.error?.message ?? msg('Failed to load users.'));
      }
    } catch {
      VelgToast.error(msg('Failed to load users.'));
    } finally {
      this._loading = false;
    }
  }

  private async _toggleExpand(userId: string): Promise<void> {
    if (this._expandedUserId === userId) {
      this._expandedUserId = null;
      this._expandedDetail = null;
      return;
    }
    this._expandedUserId = userId;
    const result = await adminApi.getUser(userId);
    if (result.success && result.data) {
      this._expandedDetail = result.data as AdminUserDetail;
    }
  }

  private async _changeRole(userId: string, simId: string, e: Event): Promise<void> {
    const role = (e.target as HTMLSelectElement).value;
    const result = await adminApi.changeMembershipRole(userId, simId, role);
    if (result.success) {
      VelgToast.success(msg('Role updated.'));
      await this._toggleExpand(userId);
      await this._toggleExpand(userId);
    } else {
      VelgToast.error(result.error?.message ?? msg('Failed to update role.'));
    }
  }

  private async _removeMembership(userId: string, simId: string): Promise<void> {
    const result = await adminApi.removeMembership(userId, simId);
    if (result.success) {
      VelgToast.success(msg('Membership removed.'));
      await this._toggleExpand(userId);
      await this._toggleExpand(userId);
    } else {
      VelgToast.error(result.error?.message ?? msg('Failed to remove membership.'));
    }
  }

  private async _addMembership(userId: string): Promise<void> {
    if (!this._addSimId) return;
    const result = await adminApi.addMembership(userId, this._addSimId, this._addRole);
    if (result.success) {
      VelgToast.success(msg('Membership added.'));
      this._addSimId = '';
      this._addRole = 'viewer';
      await this._toggleExpand(userId);
      await this._toggleExpand(userId);
    } else {
      VelgToast.error(result.error?.message ?? msg('Failed to add membership.'));
    }
  }

  private async _deleteUser(userId: string): Promise<void> {
    const result = await adminApi.deleteUser(userId);
    if (result.success) {
      VelgToast.success(msg('User deleted.'));
      this._expandedUserId = null;
      this._expandedDetail = null;
      this.dispatchEvent(
        new CustomEvent('user-deleted', { bubbles: true, composed: true, detail: { userId } }),
      );
      await this._loadUsers();
    } else {
      VelgToast.error(result.error?.message ?? msg('Failed to delete user.'));
    }
    this._confirmDeleteUserId = null;
  }

  private async _updateWallet(userId: string): Promise<void> {
    if (!this._expandedDetail?.wallet) return;
    const result = await adminApi.updateUserWallet(userId, {
      is_architect: this._expandedDetail.wallet.is_architect,
      forge_tokens: this._expandedDetail.wallet.forge_tokens,
    });
    if (result.success) {
      VelgToast.success(msg('Wallet updated.'));
    } else {
      VelgToast.error(result.error?.message ?? msg('Failed to update wallet.'));
    }
  }

  private get _filteredUsers(): AdminUser[] {
    if (!this._search.trim()) return this._users;
    const term = this._search.toLowerCase();
    return this._users.filter((u) => u.email.toLowerCase().includes(term));
  }

  protected render() {
    if (this._loading) {
      return html`<div class="loading">${msg('Loading users...')}</div>`;
    }

    const users = this._filteredUsers;

    return html`
      <div class="controls">
        <input
          type="text"
          class="search-input"
          placeholder=${msg('Search users by email...')}
          aria-label=${msg('Search users by email')}
          .value=${this._search}
          @input=${(e: Event) => {
            this._search = (e.target as HTMLInputElement).value;
          }}
        />
        <span class="user-count">${msg(str`${users.length} users`)}</span>
      </div>

      ${
        users.length === 0
          ? html`<div class="empty">${msg('No users found.')}</div>`
          : html`
          <div class="user-list">
            ${users.map((user) => this._renderUserRow(user))}
          </div>
        `
      }

      <nav class="pagination" aria-label=${msg('User list pagination')}>
        <button
          class="pagination__btn"
          ?disabled=${this._page <= 1}
          aria-label=${msg('Previous page')}
          @click=${() => {
            this._page--;
            this._loadUsers();
          }}
        >${msg('Previous')}</button>
        <span class="pagination__info">${msg(str`Page ${this._page}`)}</span>
        <button
          class="pagination__btn"
          ?disabled=${users.length < 50}
          aria-label=${msg('Next page')}
          @click=${() => {
            this._page++;
            this._loadUsers();
          }}
        >${msg('Next')}</button>
      </nav>

      ${
        this._confirmDeleteUserId
          ? html`
          <velg-confirm-dialog
            .open=${true}
            .title=${msg('Delete User')}
            .message=${msg('This will permanently delete this user and all their data. This cannot be undone.')}
            .confirmLabel=${msg('Delete')}
            .variant=${'danger'}
            @confirm=${() => {
              if (this._confirmDeleteUserId) this._deleteUser(this._confirmDeleteUserId);
            }}
            @cancel=${() => {
              this._confirmDeleteUserId = null;
            }}
          ></velg-confirm-dialog>
        `
          : nothing
      }
    `;
  }

  private _renderUserRow(user: AdminUser) {
    const isExpanded = this._expandedUserId === user.id;
    const created = user.created_at ? new Date(user.created_at).toLocaleDateString() : '—';

    return html`
      <div
        class="user-row ${isExpanded ? 'user-row--expanded' : ''}"
        @click=${() => this._toggleExpand(user.id)}
      >
        <span class="user-email">${user.email}</span>
        <span class="user-date">${created}</span>
        <div class="user-badges">
          ${
            this._expandedDetail && isExpanded
              ? this._expandedDetail.memberships.map(
                  (m) =>
                    html`<span class="badge badge--${m.member_role}">${m.simulations?.name ?? m.simulation_id} (${m.member_role})</span>`,
                )
              : nothing
          }
        </div>
      </div>
      ${isExpanded && this._expandedDetail ? this._renderUserDetail(this._expandedDetail) : nothing}
    `;
  }

  private _renderUserDetail(detail: AdminUserDetail) {
    const lastSign = detail.last_sign_in_at
      ? new Date(detail.last_sign_in_at).toLocaleString()
      : msg('Never');

    return html`
      <div class="user-detail" @click=${(e: Event) => e.stopPropagation()}>
        <p style="margin:0 0 var(--space-3);font-size:var(--text-xs);color:var(--color-text-muted)">
          ${msg(str`Last sign in: ${lastSign}`)}
        </p>

        <p class="detail-section-title">${msg('Simulation Memberships')}</p>

        ${
          detail.memberships.length === 0
            ? html`<p style="font-size:var(--text-sm);color:var(--color-text-muted)">${msg('No memberships.')}</p>`
            : html`
            <div class="membership-list">
              ${detail.memberships.map((m) => this._renderMembershipRow(detail.id, m))}
            </div>
          `
        }

        <div class="add-membership">
          <select
            aria-label=${msg('Select simulation to add')}
            .value=${this._addSimId}
            @change=${(e: Event) => {
              this._addSimId = (e.target as HTMLSelectElement).value;
            }}
          >
            <option value="">${msg('-- Add to simulation --')}</option>
            ${this._simulations.map((sim) => html`<option value=${sim.id}>${sim.name}</option>`)}
          </select>
          <select
            aria-label=${msg('Select role for new membership')}
            .value=${this._addRole}
            @change=${(e: Event) => {
              this._addRole = (e.target as HTMLSelectElement).value;
            }}
          >
            <option value="viewer">${msg('Viewer')}</option>
            <option value="editor">${msg('Editor')}</option>
            <option value="admin">${msg('Admin')}</option>
            <option value="owner">${msg('Owner')}</option>
          </select>
          <button class="btn-sm btn-sm--primary" aria-label=${msg('Add membership')} @click=${() => this._addMembership(detail.id)}>
            ${msg('Add')}
          </button>
        </div>

        <p class="detail-section-title" style="margin-top:var(--space-6)">${msg('Simulation Forge Access')}</p>
        <div class="forge-access">
          <div class="forge-access__field">
            <label class="forge-access__label">${msg('Is Architect')} ${renderInfoBubble(msg('Architect role grants access to the Forge creation pipeline. Only architects can propose new simulations.'), 'tip-user-architect')}</label>
            <input
              type="checkbox"
              aria-label=${msg('Toggle architect role')}
              aria-describedby="tip-user-architect"
              ?checked=${detail.wallet?.is_architect}
              @change=${(e: Event) => {
                const checked = (e.target as HTMLInputElement).checked;
                if (this._expandedDetail) {
                  this._expandedDetail = {
                    ...this._expandedDetail,
                    wallet: {
                      ...(this._expandedDetail.wallet || {
                        user_id: detail.id,
                        forge_tokens: 0,
                        is_architect: false,
                        created_at: '',
                        updated_at: '',
                      }),
                      is_architect: checked,
                    },
                  };
                }
              }}
            />
          </div>
          <div class="forge-access__field">
            <label class="forge-access__label">${msg('Forge Tokens')} ${renderInfoBubble(msg('Forge tokens are consumed when architects create simulations or generate content. Grant additional tokens to power users.'), 'tip-user-tokens')}</label>
            <input
              type="number"
              class="membership-role-select forge-access__input"
              aria-label=${msg('Forge token balance')}
              aria-describedby="tip-user-tokens"
              .value=${String(detail.wallet?.forge_tokens ?? 0)}
              @input=${(e: Event) => {
                const val = parseInt((e.target as HTMLInputElement).value, 10) || 0;
                if (this._expandedDetail) {
                  this._expandedDetail = {
                    ...this._expandedDetail,
                    wallet: {
                      ...(this._expandedDetail.wallet || {
                        user_id: detail.id,
                        forge_tokens: 0,
                        is_architect: false,
                        created_at: '',
                        updated_at: '',
                      }),
                      forge_tokens: val,
                    },
                  };
                }
              }}
            />
          </div>
          <button class="btn-sm btn-sm--primary" @click=${() => this._updateWallet(detail.id)} aria-label=${msg('Save wallet changes')}>
            ${msg('Save Wallet')}
          </button>
        </div>

        <div class="detail-actions">
          <button
            class="btn-sm btn-sm--danger"
            aria-label=${msg('Delete this user permanently')}
            @click=${() => {
              this._confirmDeleteUserId = detail.id;
            }}
          >${msg('Delete User')}</button>
        </div>
      </div>
    `;
  }

  private _renderMembershipRow(userId: string, m: AdminMembership) {
    return html`
      <div class="membership-row">
        <span class="membership-sim">${m.simulations?.name ?? m.simulation_id}</span>
        <select
          class="membership-role-select"
          aria-label=${msg('Change membership role')}
          .value=${m.member_role}
          @change=${(e: Event) => this._changeRole(userId, m.simulation_id, e)}
          @click=${(e: Event) => e.stopPropagation()}
        >
          <option value="viewer" ?selected=${m.member_role === 'viewer'}>${msg('Viewer')}</option>
          <option value="editor" ?selected=${m.member_role === 'editor'}>${msg('Editor')}</option>
          <option value="admin" ?selected=${m.member_role === 'admin'}>${msg('Admin')}</option>
          <option value="owner" ?selected=${m.member_role === 'owner'}>${msg('Owner')}</option>
        </select>
        <button
          class="btn-sm btn-sm--danger"
          aria-label=${msg('Remove membership')}
          @click=${(e: Event) => {
            e.stopPropagation();
            this._removeMembership(userId, m.simulation_id);
          }}
        >${msg('Remove')}</button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-admin-users-tab': VelgAdminUsersTab;
  }
}
