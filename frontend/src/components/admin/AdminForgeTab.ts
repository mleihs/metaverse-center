import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { forgeApi } from '../../services/api/index.js';
import { appState } from '../../services/AppStateManager.js';
import type { ForgeAccessRequestWithEmail } from '../../types/index.js';
import { settingsStyles } from '../shared/settings-styles.js';
import { VelgToast } from '../shared/Toast.js';

/**
 * AdminForgeTab — Global Simulation Forge settings + Clearance Requests.
 */
@localized()
@customElement('velg-admin-forge-tab')
export class VelgAdminForgeTab extends LitElement {
  static styles = [
    settingsStyles,
    css`
      .forge-admin {
        display: flex;
        flex-direction: column;
        gap: var(--space-8);
      }

      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: var(--space-4);
      }

      .stat-card {
        background: var(--color-surface-sunken);
        border: 1px solid var(--color-border);
        padding: var(--space-4);
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }

      .stat-card__value {
        font-family: var(--font-brutalist);
        font-size: var(--text-2xl);
        color: var(--color-primary);
      }

      .stat-card__label {
        font-size: var(--text-xs);
        text-transform: uppercase;
        color: var(--color-text-muted);
      }

      .byok-form {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }

      .byok-input {
        max-width: 300px;
        font-family: var(--font-mono);
        font-size: var(--text-sm);
        padding: var(--space-2) var(--space-3);
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        color: var(--color-text-primary);
      }

      /* ── Clearance Requests ── */

      .request-card {
        background: var(--color-surface-sunken);
        border: 1px solid var(--color-border);
        padding: var(--space-4);
        margin-bottom: var(--space-4);
      }

      .request-card__header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: var(--space-2);
      }

      .request-card__email {
        font-family: var(--font-mono);
        font-size: var(--text-sm);
        color: var(--color-text-primary);
        font-weight: 600;
      }

      .request-card__date {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--color-text-muted);
      }

      .request-card__message {
        font-family: var(--font-mono);
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
        font-style: italic;
        padding: var(--space-2) var(--space-3);
        background: var(--color-surface);
        border: 1px dashed var(--color-border);
        margin-bottom: var(--space-3);
        line-height: 1.6;
      }

      .request-card__notes-input {
        width: 100%;
        box-sizing: border-box;
        font-family: var(--font-mono);
        font-size: var(--text-sm);
        padding: var(--space-2) var(--space-3);
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        color: var(--color-text-primary);
        min-height: 60px;
        resize: vertical;
        margin-bottom: var(--space-3);
      }

      .request-card__notes-label {
        font-family: var(--font-brutalist);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        color: var(--color-text-muted);
        margin-bottom: var(--space-1);
      }

      .request-card__actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--space-3);
      }

      .btn-approve {
        padding: var(--space-2) var(--space-4);
        font-family: var(--font-brutalist);
        font-weight: var(--font-black);
        font-size: var(--text-sm);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        background: var(--color-success);
        color: var(--color-gray-950);
        border: none;
        cursor: pointer;
        transition: all var(--transition-fast);
      }

      .btn-approve:hover {
        filter: brightness(1.15);
        transform: translateY(-1px);
      }

      .btn-approve:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        pointer-events: none;
      }

      .btn-reject {
        padding: var(--space-2) var(--space-4);
        font-family: var(--font-brutalist);
        font-weight: var(--font-black);
        font-size: var(--text-sm);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        background: transparent;
        color: var(--color-danger);
        border: 1px solid var(--color-danger);
        cursor: pointer;
        transition: all var(--transition-fast);
      }

      .btn-reject:hover {
        background: var(--color-danger);
        color: var(--color-gray-950);
      }

      .btn-reject:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        pointer-events: none;
      }

      .empty-requests {
        font-family: var(--font-mono);
        font-size: var(--text-sm);
        color: var(--color-text-muted);
        text-align: center;
        padding: var(--space-6) 0;
        letter-spacing: 1px;
      }
    `,
  ];

  @state() private _draftCount = 0;
  @state() private _totalTokens = 0;
  @state() private _totalMaterialized = 0;

  @state() private _openrouterKey = '';
  @state() private _replicateKey = '';
  @state() private _savingBYOK = false;

  @state() private _pendingRequests: ForgeAccessRequestWithEmail[] = [];
  @state() private _requestNotes: Record<string, string> = {};
  @state() private _reviewingId: string | null = null;

  connectedCallback() {
    super.connectedCallback();
    this._loadStats();
    this._loadPendingRequests();
  }

  private async _loadStats() {
    try {
      const resp = await forgeApi.getAdminStats();
      if (resp.success && resp.data) {
        this._draftCount = resp.data.active_drafts;
        this._totalTokens = resp.data.total_tokens;
        this._totalMaterialized = resp.data.total_materialized;
      }
    } catch {
      // Stats are non-critical; silently fail
    }
  }

  private async _loadPendingRequests() {
    try {
      const resp = await forgeApi.listPendingRequests();
      if (resp.success && resp.data) {
        this._pendingRequests = resp.data;
      }
    } catch {
      // Non-critical
    }
  }

  private async _reviewRequest(id: string, action: 'approve' | 'reject') {
    const { VelgConfirmDialog } = await import('../shared/ConfirmDialog.js');
    const actionLabel = action === 'approve' ? msg('Approve') : msg('Reject');
    const confirmed = await VelgConfirmDialog.show({
      title: `${actionLabel} ${msg('Clearance Request')}`,
      message: action === 'approve'
        ? msg('This will grant the user Architect clearance and send a notification email.')
        : msg('This will deny the clearance request and notify the user.'),
      confirmLabel: actionLabel,
      variant: action === 'reject' ? 'danger' : 'default',
    });
    if (!confirmed) return;

    this._reviewingId = id;
    try {
      const notes = this._requestNotes[id] || undefined;
      const resp = await forgeApi.reviewRequest(id, action, notes);
      if (resp.success) {
        VelgToast.success(
          action === 'approve'
            ? msg('Clearance granted successfully.')
            : msg('Clearance request rejected.'),
        );
        this._pendingRequests = this._pendingRequests.filter((r) => r.id !== id);
        appState.setPendingForgeRequestCount(this._pendingRequests.length);
      } else {
        VelgToast.error(msg('Review failed.'));
      }
    } catch {
      VelgToast.error(msg('An unexpected error occurred.'));
    } finally {
      this._reviewingId = null;
    }
  }

  private async _saveBYOK() {
    this._savingBYOK = true;
    try {
      const resp = await forgeApi.updateBYOK({
        openrouter_key: this._openrouterKey || undefined,
        replicate_key: this._replicateKey || undefined,
      });
      if (resp.success) {
        VelgToast.success(msg('Personal API keys updated securely.'));
        this._openrouterKey = '';
        this._replicateKey = '';
      } else {
        VelgToast.error(resp.error?.message ?? msg('Failed to save keys.'));
      }
    } catch (_err) {
      VelgToast.error(msg('An unexpected error occurred.'));
    } finally {
      this._savingBYOK = false;
    }
  }

  private async _purgeStaleDrafts() {
    const { VelgConfirmDialog } = await import('../shared/ConfirmDialog.js');
    const confirmed = await VelgConfirmDialog.show({
      title: msg('Purge Stale Drafts'),
      message: msg('Are you sure you want to purge all drafts older than 30 days?'),
      confirmLabel: msg('Purge'),
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      const resp = await forgeApi.purgeStale(30);
      if (resp.success) {
        VelgToast.success(msg('Stale drafts purged.'));
        this._loadStats();
      } else {
        VelgToast.error(resp.error?.message ?? msg('Purge failed.'));
      }
    } catch {
      VelgToast.error(msg('Purge failed.'));
    }
  }

  private _formatDate(isoDate: string): string {
    try {
      return new Date(isoDate).toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return isoDate;
    }
  }

  protected render() {
    return html`
      <div class="forge-admin">
        ${this._renderClearanceRequests()}

        <div class="settings-panel">
          <h3 class="settings-panel__title">${msg('Personal API Keys (BYOK)')}</h3>
          <p class="settings-panel__description">${msg('Bypass the platform quota by providing your own API keys for the Simulation Forge. These are AES-256 encrypted at rest.')}</p>
          <div class="byok-form">
            <div class="settings-item">
              <div class="settings-item__info">
                <div class="settings-item__label">${msg('OpenRouter API Key')}</div>
                <div class="settings-item__description">${msg('Used for the Astrolabe and Drafting Table phases.')}</div>
              </div>
              <input
                type="password"
                class="form-control byok-input"
                placeholder="sk-or-v1-..."
                .value=${this._openrouterKey}
                @input=${(e: Event) => (this._openrouterKey = (e.target as HTMLInputElement).value)}
              />
            </div>
            <div class="settings-item">
              <div class="settings-item__info">
                <div class="settings-item__label">${msg('Replicate API Token')}</div>
                <div class="settings-item__description">${msg('Used for the Darkroom and final image materialization.')}</div>
              </div>
              <input
                type="password"
                class="form-control byok-input"
                placeholder="r8_..."
                .value=${this._replicateKey}
                @input=${(e: Event) => (this._replicateKey = (e.target as HTMLInputElement).value)}
              />
            </div>
            <button
              class="btn-primary"
              style="align-self: flex-start"
              ?disabled=${this._savingBYOK}
              @click=${this._saveBYOK}
            >
              ${this._savingBYOK ? msg('Saving...') : msg('Save Keys')}
            </button>
          </div>
        </div>

        <div class="settings-panel">
          <h3 class="settings-panel__title">${msg('Forge Overview')}</h3>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-card__value">${this._draftCount}</div>
              <div class="stat-card__label">${msg('Active Drafts')}</div>
            </div>
            <div class="stat-card">
              <div class="stat-card__value">${this._totalTokens}</div>
              <div class="stat-card__label">${msg('Total Tokens Circulating')}</div>
            </div>
            <div class="stat-card">
              <div class="stat-card__value">${this._totalMaterialized}</div>
              <div class="stat-card__label">${msg('Total Materialized')}</div>
            </div>
          </div>
        </div>

        <div class="settings-panel">
          <h3 class="settings-panel__title">${msg('Global Economic Controls')}</h3>
          <div class="settings-group">
            <div class="settings-item">
              <div class="settings-item__info">
                <div class="settings-item__label">${msg('Default Architect Grant')}</div>
                <div class="settings-item__description">${msg('Number of forge tokens given to new architects.')}</div>
              </div>
              <input type="number" class="membership-role-select" style="width: 80px" value="1" />
            </div>

            <div class="settings-item">
              <div class="settings-item__info">
                <div class="settings-item__label">${msg('Darkroom Test Limit')}</div>
                <div class="settings-item__description">${msg('Max test renders allowed per simulation draft.')}</div>
              </div>
              <input type="number" class="membership-role-select" style="width: 80px" value="5" />
            </div>
          </div>
        </div>

        <div class="settings-panel">
          <h3 class="settings-panel__title">${msg('Maintenance')}</h3>
          <p class="settings-panel__description">${msg('Clean up unused assets and database records.')}</p>
          <button class="btn-primary" @click=${this._purgeStaleDrafts}>
            ${msg('Purge Stale Drafts')}
          </button>
        </div>
      </div>
    `;
  }

  private _renderClearanceRequests() {
    return html`
      <div class="settings-panel">
        <h3 class="settings-panel__title">${msg('Clearance Requests')}</h3>
        <p class="settings-panel__description">${msg('Pending clearance upgrade requests from Field Observers.')}</p>

        ${this._pendingRequests.length === 0
          ? html`<div class="empty-requests">// ${msg('No Pending Clearance Requests')} //</div>`
          : this._pendingRequests.map((req) => this._renderRequestCard(req))
        }
      </div>
    `;
  }

  private _renderRequestCard(req: ForgeAccessRequestWithEmail) {
    const isReviewing = this._reviewingId === req.id;
    return html`
      <div class="request-card">
        <div class="request-card__header">
          <span class="request-card__email">${req.user_email}</span>
          <span class="request-card__date">${this._formatDate(req.created_at)}</span>
        </div>

        ${req.message
          ? html`<div class="request-card__message">&ldquo;${req.message}&rdquo;</div>`
          : nothing
        }

        <div class="request-card__notes-label">${msg('Admin notes:')}</div>
        <textarea
          class="request-card__notes-input"
          placeholder=${msg('Optional notes for the user...')}
          .value=${this._requestNotes[req.id] ?? ''}
          @input=${(e: Event) => {
            this._requestNotes = {
              ...this._requestNotes,
              [req.id]: (e.target as HTMLTextAreaElement).value,
            };
          }}
        ></textarea>

        <div class="request-card__actions">
          <button
            class="btn-reject"
            ?disabled=${isReviewing}
            @click=${() => this._reviewRequest(req.id, 'reject')}
          >
            ${msg('Reject')}
          </button>
          <button
            class="btn-approve"
            ?disabled=${isReviewing}
            @click=${() => this._reviewRequest(req.id, 'approve')}
          >
            ${isReviewing ? msg('Processing...') : msg('Approve')} &#10003;
          </button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-admin-forge-tab': VelgAdminForgeTab;
  }
}
