import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { adminApi, simulationsApi } from '../../services/api/index.js';
import type { AdminMembership, AdminUser, AdminUserDetail, Simulation } from '../../types/index.js';
import { VelgToast } from '../shared/Toast.js';

import '../shared/ConfirmDialog.js';

@localized()
@customElement('velg-admin-users-tab')
export class VelgAdminUsersTab extends LitElement {
  static styles = css`
    :host {
      display: block;
      color: var(--color-gray-200, #e2e2e8);
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
      background: var(--color-gray-900, #111118);
      color: var(--color-gray-200, #e2e2e8);
      border: 1px solid var(--color-gray-700, #374151);
      transition: border-color 0.2s ease;
    }

    .search-input:focus {
      outline: none;
      border-color: var(--color-danger, #dc2626);
      box-shadow: 0 0 0 1px var(--color-danger, #dc2626);
    }

    .search-input::placeholder {
      color: var(--color-gray-500, #6b7280);
    }

    .user-count {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-gray-500, #6b7280);
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
      background: var(--color-gray-900, #111118);
      border: 1px solid var(--color-gray-800, #1e1e2a);
      cursor: pointer;
      transition:
        border-color 0.2s ease,
        box-shadow 0.2s ease,
        transform 0.15s ease;
    }

    .user-row:hover {
      border-color: var(--color-gray-600, #4b5563);
      transform: translateX(2px);
    }

    .user-row--expanded {
      border-color: var(--color-danger, #dc2626);
      box-shadow: 0 0 0 1px var(--color-danger, #dc2626);
    }

    .user-email {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      color: var(--color-gray-100, #f3f4f6);
      word-break: break-all;
    }

    .user-date {
      font-size: var(--text-xs);
      color: var(--color-gray-500, #6b7280);
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
      color: #f87171;
      border-color: #f8717180;
      background: rgba(248, 113, 113, 0.1);
    }

    .badge--admin {
      color: #60a5fa;
      border-color: #60a5fa80;
      background: rgba(96, 165, 250, 0.1);
    }

    .badge--editor {
      color: #34d399;
      border-color: #34d39980;
      background: rgba(52, 211, 153, 0.1);
    }

    .badge--viewer {
      color: var(--color-gray-400, #9ca3af);
      border-color: var(--color-gray-600, #4b5563);
      background: rgba(156, 163, 175, 0.08);
    }

    /* --- Expanded detail --- */

    .user-detail {
      padding: var(--space-4);
      background: var(--color-gray-900, #111118);
      border: 1px solid var(--color-gray-800, #1e1e2a);
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
      color: var(--color-gray-500, #6b7280);
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
      background: var(--color-gray-850, #161622);
      border: 1px solid var(--color-gray-800, #1e1e2a);
    }

    .membership-sim {
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      color: var(--color-gray-200, #e2e2e8);
      flex: 1;
    }

    .membership-role-select {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      padding: var(--space-1) var(--space-2);
      background: var(--color-gray-900, #111118);
      color: var(--color-gray-200, #e2e2e8);
      border: 1px solid var(--color-gray-700, #374151);
    }

    .btn-sm {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      padding: var(--space-1) var(--space-3);
      border: 1px solid var(--color-gray-700, #374151);
      background: transparent;
      color: var(--color-gray-300, #d1d5db);
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
      color: #f87171;
      border-color: #f8717180;
    }

    .btn-sm--danger:hover {
      background: #dc2626;
      color: #ffffff;
      border-color: #dc2626;
    }

    .btn-sm--primary {
      color: #60a5fa;
      border-color: #60a5fa80;
    }

    .btn-sm--primary:hover {
      background: #2563eb;
      color: #ffffff;
      border-color: #2563eb;
    }

    /* --- Add membership form --- */

    .add-membership {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding-top: var(--space-3);
      border-top: 1px solid var(--color-gray-800, #1e1e2a);
    }

    .add-membership select {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      padding: var(--space-1) var(--space-2);
      background: var(--color-gray-900, #111118);
      color: var(--color-gray-200, #e2e2e8);
      border: 1px solid var(--color-gray-700, #374151);
    }

    .detail-actions {
      display: flex;
      gap: var(--space-2);
      margin-top: var(--space-4);
      padding-top: var(--space-3);
      border-top: 1px solid var(--color-gray-800, #1e1e2a);
    }

    /* --- Loading / empty --- */

    .loading,
    .empty {
      text-align: center;
      padding: var(--space-8);
      color: var(--color-gray-500, #6b7280);
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
      border: 1px solid var(--color-gray-700, #374151);
      background: var(--color-gray-900, #111118);
      color: var(--color-gray-300, #d1d5db);
      cursor: pointer;
    }

    .pagination__btn:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }

    .pagination__btn:hover:not(:disabled) {
      border-color: var(--color-gray-500, #6b7280);
    }

    .pagination__info {
      font-size: var(--text-xs);
      color: var(--color-gray-500, #6b7280);
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
  `;

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
    const result = await simulationsApi.list();
    if (result.success && result.data) {
      this._simulations = result.data as Simulation[];
    }
  }

  private async _loadUsers(): Promise<void> {
    this._loading = true;
    const result = await adminApi.listUsers(this._page, 50);
    if (result.success && result.data) {
      this._users = (result.data as { users: AdminUser[]; total: number }).users;
    }
    this._loading = false;
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
      await this._loadUsers();
    } else {
      VelgToast.error(result.error?.message ?? msg('Failed to delete user.'));
    }
    this._confirmDeleteUserId = null;
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

      <div class="pagination">
        <button
          class="pagination__btn"
          ?disabled=${this._page <= 1}
          @click=${() => {
            this._page--;
            this._loadUsers();
          }}
        >${msg('Previous')}</button>
        <span class="pagination__info">${msg(str`Page ${this._page}`)}</span>
        <button
          class="pagination__btn"
          ?disabled=${users.length < 50}
          @click=${() => {
            this._page++;
            this._loadUsers();
          }}
        >${msg('Next')}</button>
      </div>

      ${
        this._confirmDeleteUserId
          ? html`
          <velg-confirm-dialog
            .open=${true}
            .title=${msg('Delete User')}
            .message=${msg('This will permanently delete this user and all their data. This cannot be undone.')}
            .confirmLabel=${msg('Delete')}
            .confirmVariant=${'danger'}
            @confirm=${() => this._deleteUser(this._confirmDeleteUserId!)}
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
            .value=${this._addSimId}
            @change=${(e: Event) => {
              this._addSimId = (e.target as HTMLSelectElement).value;
            }}
          >
            <option value="">${msg('-- Add to simulation --')}</option>
            ${this._simulations.map((sim) => html`<option value=${sim.id}>${sim.name}</option>`)}
          </select>
          <select
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
          <button class="btn-sm btn-sm--primary" @click=${() => this._addMembership(detail.id)}>
            ${msg('Add')}
          </button>
        </div>

        <div class="detail-actions">
          <button
            class="btn-sm btn-sm--danger"
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
