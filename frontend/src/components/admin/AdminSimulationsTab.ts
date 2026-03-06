import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { type AdminSimulation, adminApi } from '../../services/api/AdminApiService.js';
import { VelgConfirmDialog } from '../shared/ConfirmDialog.js';
import { VelgToast } from '../shared/Toast.js';

import '../shared/ConfirmDialog.js';

type SimView = 'active' | 'trash';

@localized()
@customElement('velg-admin-simulations-tab')
export class VelgAdminSimulationsTab extends LitElement {
  static styles = css`
    :host {
      display: block;
      color: var(--color-text-primary);
      font-family: var(--font-mono, monospace);
    }

    /* --- Controls --- */

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

    .sim-count {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-muted);
    }

    /* --- View Toggle --- */

    .view-toggle {
      display: flex;
      gap: 0;
      margin-bottom: var(--space-4);
    }

    .view-toggle__btn {
      padding: var(--space-2) var(--space-4);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      background: var(--color-surface);
      color: var(--color-text-muted);
      border: 1px solid var(--color-border);
      cursor: pointer;
      transition:
        color 0.2s ease,
        background 0.2s ease,
        border-color 0.2s ease;
    }

    .view-toggle__btn:first-child {
      border-right: none;
    }

    .view-toggle__btn:hover {
      color: var(--color-text-primary);
      background: color-mix(in srgb, var(--color-surface) 80%, var(--color-text-primary));
    }

    .view-toggle__btn--active {
      color: var(--color-danger);
      border-color: var(--color-danger);
      background: color-mix(in srgb, var(--color-danger) 8%, var(--color-surface));
    }

    .view-toggle__count {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      margin-left: var(--space-1);
      opacity: 0.7;
    }

    /* --- Simulation List --- */

    .sim-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .sim-row {
      display: grid;
      grid-template-columns: 1fr auto auto auto;
      align-items: center;
      gap: var(--space-4);
      padding: var(--space-3) var(--space-4);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      transition:
        border-color 0.2s ease,
        transform 0.15s ease;
    }

    .sim-row:hover {
      border-color: var(--color-text-muted);
      transform: translateX(2px);
    }

    .sim-row--deleted {
      opacity: 0.7;
      border-style: dashed;
    }

    .sim-info {
      display: flex;
      flex-direction: column;
      gap: var(--space-0-5);
      min-width: 0;
    }

    .sim-name {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      color: var(--color-text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .sim-slug {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .sim-date {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      white-space: nowrap;
    }

    /* --- Badges --- */

    .badge {
      font-family: var(--font-brutalist);
      font-size: 10px;
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      padding: 1px var(--space-2);
      border: 1px solid;
      white-space: nowrap;
    }

    .badge--active {
      color: var(--color-success);
      border-color: color-mix(in srgb, var(--color-success) 50%, transparent);
      background: color-mix(in srgb, var(--color-success) 10%, transparent);
    }

    .badge--archived {
      color: var(--color-text-secondary);
      border-color: var(--color-text-muted);
      background: color-mix(in srgb, var(--color-text-secondary) 8%, transparent);
    }

    .badge--deleted {
      color: var(--color-danger);
      border-color: color-mix(in srgb, var(--color-danger) 50%, transparent);
      background: color-mix(in srgb, var(--color-danger) 10%, transparent);
    }

    .badge--custom {
      color: var(--color-info);
      border-color: color-mix(in srgb, var(--color-info) 50%, transparent);
      background: color-mix(in srgb, var(--color-info) 10%, transparent);
    }

    /* --- Actions --- */

    .sim-actions {
      display: flex;
      gap: var(--space-2);
    }

    .action-btn {
      padding: var(--space-1) var(--space-2-5);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-text-secondary);
      cursor: pointer;
      transition:
        all 0.15s ease;
    }

    .action-btn:hover {
      border-color: var(--color-text-muted);
      color: var(--color-text-primary);
      transform: translateY(-1px);
    }

    .action-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      pointer-events: none;
    }

    .action-btn--danger {
      color: var(--color-danger);
      border-color: color-mix(in srgb, var(--color-danger) 40%, transparent);
    }

    .action-btn--danger:hover {
      background: color-mix(in srgb, var(--color-danger) 10%, var(--color-surface));
      border-color: var(--color-danger);
      color: var(--color-danger);
    }

    .action-btn--restore {
      color: var(--color-success);
      border-color: color-mix(in srgb, var(--color-success) 40%, transparent);
    }

    .action-btn--restore:hover {
      background: color-mix(in srgb, var(--color-success) 10%, var(--color-surface));
      border-color: var(--color-success);
      color: var(--color-success);
    }

    /* --- States --- */

    .empty-state {
      padding: var(--space-8);
      text-align: center;
      color: var(--color-text-muted);
      font-size: var(--text-sm);
    }

    .loading-state {
      padding: var(--space-6);
      text-align: center;
      color: var(--color-text-muted);
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
    }

    .error-banner {
      padding: var(--space-3);
      background: color-mix(in srgb, var(--color-danger) 10%, var(--color-surface));
      border: 1px solid var(--color-danger);
      color: var(--color-danger);
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      margin-bottom: var(--space-4);
    }

    @media (max-width: 768px) {
      .sim-row {
        grid-template-columns: 1fr;
        gap: var(--space-2);
      }

      .sim-actions {
        justify-content: flex-end;
      }
    }
  `;

  @state() private _view: SimView = 'active';
  @state() private _simulations: AdminSimulation[] = [];
  @state() private _deletedSimulations: AdminSimulation[] = [];
  @state() private _loading = true;
  @state() private _error: string | null = null;
  @state() private _search = '';
  @state() private _actionInProgress: string | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this._loadSimulations();
  }

  private async _loadSimulations(): Promise<void> {
    this._loading = true;
    this._error = null;

    try {
      const [activeResp, deletedResp] = await Promise.all([
        adminApi.listSimulations(1, 100),
        adminApi.listDeletedSimulations(1, 100),
      ]);

      if (activeResp.success && activeResp.data) {
        this._simulations = activeResp.data as AdminSimulation[];
      }
      if (deletedResp.success && deletedResp.data) {
        this._deletedSimulations = deletedResp.data as AdminSimulation[];
      }
    } catch (err) {
      this._error = err instanceof Error ? err.message : msg('Failed to load simulations');
    } finally {
      this._loading = false;
    }
  }

  private get _filteredActive(): AdminSimulation[] {
    if (!this._search) return this._simulations;
    const q = this._search.toLowerCase();
    return this._simulations.filter(
      (s) => s.name?.toLowerCase().includes(q) || s.slug?.toLowerCase().includes(q),
    );
  }

  private get _filteredDeleted(): AdminSimulation[] {
    if (!this._search) return this._deletedSimulations;
    const q = this._search.toLowerCase();
    return this._deletedSimulations.filter(
      (s) => s.name?.toLowerCase().includes(q) || s.slug?.toLowerCase().includes(q),
    );
  }

  private async _handleSoftDelete(sim: AdminSimulation): Promise<void> {
    const confirmed = await VelgConfirmDialog.show({
      title: msg('Soft Delete Simulation'),
      message: msg(
        str`Archive "${sim.name}"? It will be hidden from users but can be restored later.`,
      ),
      confirmLabel: msg('Archive'),
      variant: 'danger',
    });
    if (!confirmed) return;

    this._actionInProgress = sim.id;
    try {
      const resp = await adminApi.softDeleteSimulation(sim.id);
      if (resp.success) {
        VelgToast.success(msg('Simulation archived.'));
        await this._loadSimulations();
      } else {
        VelgToast.error(resp.error?.message ?? msg('Failed to archive simulation'));
      }
    } catch {
      VelgToast.error(msg('An error occurred'));
    } finally {
      this._actionInProgress = null;
    }
  }

  private async _handleHardDelete(sim: AdminSimulation): Promise<void> {
    const confirmed = await VelgConfirmDialog.show({
      title: msg('Permanently Delete Simulation'),
      message: msg(
        str`This will permanently destroy "${sim.name}" and ALL related data (agents, buildings, epochs, lore, images). This cannot be undone.`,
      ),
      confirmLabel: msg('Destroy Permanently'),
      variant: 'danger',
    });
    if (!confirmed) return;

    this._actionInProgress = sim.id;
    try {
      const resp = await adminApi.hardDeleteSimulation(sim.id);
      if (resp.success) {
        VelgToast.success(msg('Simulation permanently deleted.'));
        await this._loadSimulations();
      } else {
        VelgToast.error(resp.error?.message ?? msg('Failed to delete simulation'));
      }
    } catch {
      VelgToast.error(msg('An error occurred'));
    } finally {
      this._actionInProgress = null;
    }
  }

  private async _handleRestore(sim: AdminSimulation): Promise<void> {
    this._actionInProgress = sim.id;
    try {
      const resp = await adminApi.restoreSimulation(sim.id);
      if (resp.success) {
        VelgToast.success(msg('Simulation restored.'));
        await this._loadSimulations();
      } else {
        VelgToast.error(resp.error?.message ?? msg('Failed to restore simulation'));
      }
    } catch {
      VelgToast.error(msg('An error occurred'));
    } finally {
      this._actionInProgress = null;
    }
  }

  private _formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  private _getStatusBadgeClass(sim: AdminSimulation): string {
    if (sim.deleted_at) return 'badge badge--deleted';
    if (sim.status === 'archived') return 'badge badge--archived';
    if (sim.status === 'active') return 'badge badge--active';
    return 'badge badge--custom';
  }

  private _getStatusLabel(sim: AdminSimulation): string {
    if (sim.deleted_at) return msg('Deleted');
    return sim.status ?? msg('Unknown');
  }

  protected render() {
    return html`
      ${this._error ? html`<div class="error-banner">${this._error}</div>` : nothing}

      <div class="view-toggle">
        <button
          class="view-toggle__btn ${this._view === 'active' ? 'view-toggle__btn--active' : ''}"
          @click=${() => {
            this._view = 'active';
          }}
        >
          ${msg('Active')}
          <span class="view-toggle__count">(${this._simulations.length})</span>
        </button>
        <button
          class="view-toggle__btn ${this._view === 'trash' ? 'view-toggle__btn--active' : ''}"
          @click=${() => {
            this._view = 'trash';
          }}
        >
          ${msg('Trash')}
          <span class="view-toggle__count">(${this._deletedSimulations.length})</span>
        </button>
      </div>

      <div class="controls">
        <input
          class="search-input"
          type="text"
          placeholder=${msg('Search simulations...')}
          .value=${this._search}
          @input=${(e: Event) => {
            this._search = (e.target as HTMLInputElement).value;
          }}
        />
        <span class="sim-count">
          ${
            this._view === 'active'
              ? msg(str`${this._filteredActive.length} simulations`)
              : msg(str`${this._filteredDeleted.length} in trash`)
          }
        </span>
      </div>

      ${
        this._loading
          ? html`<div class="loading-state">${msg('Loading simulations...')}</div>`
          : this._view === 'active'
            ? this._renderActiveList()
            : this._renderTrashList()
      }
    `;
  }

  private _renderActiveList() {
    const sims = this._filteredActive;
    if (sims.length === 0) {
      return html`<div class="empty-state">${msg('No simulations found.')}</div>`;
    }

    return html`
      <div class="sim-list">
        ${sims.map(
          (sim) => html`
            <div class="sim-row">
              <div class="sim-info">
                <span class="sim-name">${sim.name}</span>
                <span class="sim-slug">/${sim.slug}</span>
              </div>
              <span class=${this._getStatusBadgeClass(sim)}>${this._getStatusLabel(sim)}</span>
              <span class="sim-date">${this._formatDate(sim.created_at)}</span>
              <div class="sim-actions">
                <button
                  class="action-btn"
                  ?disabled=${this._actionInProgress === sim.id}
                  @click=${() => this._handleSoftDelete(sim)}
                >
                  ${msg('Archive')}
                </button>
                <button
                  class="action-btn action-btn--danger"
                  ?disabled=${this._actionInProgress === sim.id}
                  @click=${() => this._handleHardDelete(sim)}
                >
                  ${msg('Destroy')}
                </button>
              </div>
            </div>
          `,
        )}
      </div>
    `;
  }

  private _renderTrashList() {
    const sims = this._filteredDeleted;
    if (sims.length === 0) {
      return html`<div class="empty-state">${msg('Trash is empty.')}</div>`;
    }

    return html`
      <div class="sim-list">
        ${sims.map(
          (sim) => html`
            <div class="sim-row sim-row--deleted">
              <div class="sim-info">
                <span class="sim-name">${sim.name}</span>
                <span class="sim-slug">/${sim.slug}</span>
              </div>
              <span class="badge badge--deleted">${msg('Deleted')}</span>
              <span class="sim-date">${msg('Deleted')} ${this._formatDate(sim.deleted_at)}</span>
              <div class="sim-actions">
                <button
                  class="action-btn action-btn--restore"
                  ?disabled=${this._actionInProgress === sim.id}
                  @click=${() => this._handleRestore(sim)}
                >
                  ${msg('Restore')}
                </button>
                <button
                  class="action-btn action-btn--danger"
                  ?disabled=${this._actionInProgress === sim.id}
                  @click=${() => this._handleHardDelete(sim)}
                >
                  ${msg('Purge')}
                </button>
              </div>
            </div>
          `,
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-admin-simulations-tab': VelgAdminSimulationsTab;
  }
}
