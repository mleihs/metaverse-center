import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { forgeApi } from '../../services/api/index.js';
import { settingsStyles } from '../shared/settings-styles.js';
import { VelgToast } from '../shared/Toast.js';

/**
 * AdminForgeTab — Global Simulation Forge settings.
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
    `,
  ];

  @state() private _draftCount = 0;
  @state() private _totalTokens = 0;
  @state() private _totalMaterialized = 0;

  @state() private _openrouterKey = '';
  @state() private _replicateKey = '';
  @state() private _savingBYOK = false;

  connectedCallback() {
    super.connectedCallback();
    this._loadStats();
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

  protected render() {
    return html`
      <div class="forge-admin">
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
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-admin-forge-tab': VelgAdminForgeTab;
  }
}
