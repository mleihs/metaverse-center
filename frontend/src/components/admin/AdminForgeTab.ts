import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import {
  type AdminBundleEntry,
  type AdminPurchaseLedgerEntry,
  adminApi,
  type TokenEconomyStats,
} from '../../services/api/AdminApiService.js';
import { forgeApi } from '../../services/api/index.js';
import { captureError } from '../../services/SentryService.js';
import { formatDateTime } from '../../utils/date-format.js';
import {
  adminAnimationStyles,
  adminForgeSectionStyles,
  adminLoadingStyles,
} from '../shared/admin-shared-styles.js';
import { infoBubbleStyles, renderInfoBubble } from '../shared/info-bubble-styles.js';
import { settingsStyles } from '../shared/settings-styles.js';
import { VelgToast } from '../shared/Toast.js';
import '../forge/ClearanceQueue.js';
import '../forge/VelgByokPanel.js';
import '../shared/VelgMetricCard.js';

/**
 * AdminForgeTab – Global Simulation Forge settings, token economy admin tools,
 * and Clearance Requests.
 */
@localized()
@customElement('velg-admin-forge-tab')
export class VelgAdminForgeTab extends LitElement {
  static styles = [
    settingsStyles,
    adminAnimationStyles,
    adminForgeSectionStyles,
    adminLoadingStyles,
    infoBubbleStyles,
    css`
      /* (stat-card keyframes removed — using VelgMetricCard) */

      /* ── Layout ── */

      .forge-admin {
        display: flex;
        flex-direction: column;
        gap: var(--space-6);
      }

      .forge-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--space-6);
      }

      @media (max-width: 900px) {
        .forge-grid { grid-template-columns: 1fr; }
      }

      /* ── Stagger Delays (unique to ForgeTab) ── */

      .forge-section:nth-child(1) { animation-delay: 0s; }
      .forge-section:nth-child(2) { animation-delay: 0.05s; }
      .forge-section:nth-child(3) { animation-delay: 0.1s; }
      .forge-section:nth-child(4) { animation-delay: 0.15s; }
      .forge-section:nth-child(5) { animation-delay: 0.2s; }
      .forge-section:nth-child(6) { animation-delay: 0.25s; }
      .forge-section:nth-child(7) { animation-delay: 0.3s; }
      .forge-section:nth-child(8) { animation-delay: 0.35s; }

      /* ── Stat Cards ── */

      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: var(--space-3);
      }

      /* ── BYOK Form ── */

      .byok-form {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }

      .byok-input {
        max-width: 400px;
        font-family: var(--font-mono, 'SF Mono', monospace);
        font-size: var(--text-sm);
        padding: var(--space-2) var(--space-3);
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        color: var(--color-text-primary);
        transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
      }

      .byok-input:focus {
        outline: none;
        border-color: var(--color-accent-amber);
        box-shadow: 0 0 0 1px var(--color-accent-amber), 0 0 12px rgba(245, 158, 11, 0.1);
      }

      /* ── Tables (shared) ── */

      .forge-table {
        width: 100%;
        border-collapse: collapse;
        font-family: var(--font-mono, 'SF Mono', monospace);
        font-size: var(--text-sm);
      }

      .forge-table th {
        text-align: left;
        font-family: var(--font-brutalist, 'Courier New', monospace);
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 2px;
        color: var(--color-accent-amber);
        padding: var(--space-2) var(--space-3);
        border-bottom: 2px solid var(--color-accent-amber-dim, rgba(245, 158, 11, 0.3));
        opacity: 0.8;
      }

      .forge-table td {
        padding: var(--space-2-5) var(--space-3);
        border-bottom: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
        color: var(--color-text-primary);
        transition: background var(--transition-fast);
      }

      .forge-table tbody tr:hover td {
        background: rgba(245, 158, 11, 0.03);
      }

      .forge-table tbody tr:nth-child(even) td {
        background: rgba(255, 255, 255, 0.01);
      }

      .forge-table tbody tr:nth-child(even):hover td {
        background: rgba(245, 158, 11, 0.04);
      }

      .bundle-row--inactive td {
        opacity: 0.45;
      }

      .bundle-row--system td {
        opacity: 0.3;
      }

      /* ── Bundle Edit Form ── */

      .bundle-edit-form {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: var(--space-2) var(--space-3);
        align-items: center;
        padding: var(--space-4);
        background: var(--color-surface);
        border: 1px solid var(--color-accent-amber-dim, rgba(245, 158, 11, 0.2));
        margin: var(--space-2) 0;
      }

      .bundle-edit-form__label {
        font-family: var(--font-brutalist, 'Courier New', monospace);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: 1px;
        color: var(--color-text-muted);
      }

      .bundle-edit-form__input {
        padding: var(--space-1-5) var(--space-2);
        font-family: var(--font-mono, 'SF Mono', monospace);
        font-size: var(--text-sm);
        background: var(--color-surface-sunken);
        border: 1px solid var(--color-border);
        color: var(--color-text-primary);
        max-width: 200px;
        transition: border-color var(--transition-fast);
      }

      .bundle-edit-form__input:focus {
        outline: none;
        border-color: var(--color-accent-amber);
      }

      .bundle-edit-form__actions {
        grid-column: 1 / -1;
        display: flex;
        gap: var(--space-2);
        justify-content: flex-end;
        padding-top: var(--space-2);
        border-top: 1px solid var(--color-border);
      }

      /* ── Filter Chips ── */

      .ledger-filters {
        display: flex;
        gap: var(--space-2);
        margin-bottom: var(--space-4);
        flex-wrap: wrap;
        align-items: center;
      }

      .filter-chip {
        padding: var(--space-1) var(--space-3);
        font-family: var(--font-brutalist, 'Courier New', monospace);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        border: 1px solid var(--color-border);
        background: transparent;
        color: var(--color-text-muted);
        cursor: pointer;
        transition: all var(--transition-fast);
      }

      .filter-chip:hover {
        color: var(--color-accent-amber);
        border-color: var(--color-accent-amber);
        background: rgba(245, 158, 11, 0.05);
      }

      .filter-chip--active {
        background: var(--color-accent-amber);
        color: var(--color-surface-sunken);
        border-color: var(--color-accent-amber);
        box-shadow: 0 0 8px rgba(245, 158, 11, 0.3);
      }

      /* ── Pagination ── */

      .ledger-pagination {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: var(--space-4);
        padding-top: var(--space-3);
        border-top: 1px solid var(--color-border);
      }

      .ledger-pagination__info {
        font-family: var(--font-mono, 'SF Mono', monospace);
        font-size: var(--text-xs);
        color: var(--color-text-muted);
      }

      .ledger-pagination__buttons {
        display: flex;
        gap: var(--space-2);
      }

      .ledger-pagination__btn {
        padding: var(--space-1) var(--space-3);
        font-family: var(--font-brutalist, 'Courier New', monospace);
        font-size: var(--text-xs);
        text-transform: uppercase;
        background: var(--color-surface);
        color: var(--color-text-primary);
        border: 1px solid var(--color-border);
        cursor: pointer;
        transition: all var(--transition-fast);
      }

      .ledger-pagination__btn:hover:not(:disabled) {
        border-color: var(--color-accent-amber);
        color: var(--color-accent-amber);
      }

      .ledger-pagination__btn:disabled {
        opacity: 0.25;
        cursor: not-allowed;
      }

      /* ── Grant Form ── */

      .grant-form {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: var(--space-3);
        align-items: center;
        max-width: 500px;
      }

      .grant-form__label {
        font-family: var(--font-brutalist, 'Courier New', monospace);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: 1px;
        color: var(--color-text-muted);
      }

      .grant-form__input {
        padding: var(--space-2) var(--space-3);
        font-family: var(--font-mono, 'SF Mono', monospace);
        font-size: var(--text-sm);
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        color: var(--color-text-primary);
        width: 100%;
        box-sizing: border-box;
        transition: border-color var(--transition-fast);
      }

      .grant-form__input:focus {
        outline: none;
        border-color: var(--color-accent-amber);
        box-shadow: 0 0 0 1px var(--color-accent-amber);
      }

      .grant-form__actions {
        grid-column: 1 / -1;
        display: flex;
        justify-content: flex-end;
      }

      .overflow-x {
        overflow-x: auto;
      }

      /* ── Shared utility styles (used by grant form + purchase ledger) ── */

      .btn-approve {
        padding: var(--space-2) var(--space-4);
        font-family: var(--font-brutalist, 'Courier New', monospace);
        font-weight: 900;
        font-size: var(--text-sm);
        text-transform: uppercase;
        letter-spacing: var(--tracking-wide);
        background: var(--color-success);
        color: var(--color-surface-sunken);
        border: none;
        cursor: pointer;
        transition: all var(--transition-fast);
      }

      .btn-approve:hover {
        filter: brightness(1.15);
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(74, 222, 128, 0.3);
      }

      .btn-approve:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        pointer-events: none;
      }

      .empty-state {
        font-family: var(--font-mono, 'SF Mono', monospace);
        font-size: var(--text-sm);
        color: var(--color-text-muted);
        text-align: center;
        padding: var(--space-8) 0;
        letter-spacing: 1px;
        opacity: 0.6;
      }

      .empty-state::before {
        content: '//';
        margin-right: 6px;
        color: var(--color-accent-amber);
        opacity: 0.5;
      }

      .empty-state::after {
        content: '//';
        margin-left: 6px;
        color: var(--color-accent-amber);
        opacity: 0.5;
      }
    `,
  ];

  // ── Forge Overview state ──
  @state() private _draftCount = 0;
  @state() private _totalTokens = 0;
  @state() private _totalMaterialized = 0;

  // ── BYOK state ──
  @state() private _byokSystemEnabled = false;
  @state() private _byokAccessPolicy: 'none' | 'all' | 'per_user' = 'per_user';

  // ── Token Economy state ──
  @state() private _economyStats: TokenEconomyStats | null = null;
  @state() private _bundles: AdminBundleEntry[] = [];
  @state() private _editingBundleId: string | null = null;
  @state() private _bundleEditDraft: Partial<AdminBundleEntry> = {};

  // ── Grant state ──
  @state() private _grantUserId = '';
  @state() private _grantTokens = 5;
  @state() private _grantReason = '';
  @state() private _granting = false;

  // ── Purchase Ledger state ──
  @state() private _purchases: AdminPurchaseLedgerEntry[] = [];
  @state() private _purchaseTotal = 0;
  @state() private _purchaseOffset = 0;
  @state() private _purchaseFilter: string | null = null;

  private readonly _purchaseLimit = 50;

  connectedCallback() {
    super.connectedCallback();
    this._loadStats();
    this._loadEconomyStats();
    this._loadBundles();
    this._loadPurchases();
    this._loadBYOKSetting();
  }

  // ── Data Loaders ──

  private async _loadStats() {
    try {
      const resp = await forgeApi.getAdminStats();
      if (resp.success && resp.data) {
        this._draftCount = resp.data.active_drafts;
        this._totalTokens = resp.data.total_tokens;
        this._totalMaterialized = resp.data.total_materialized;
      }
    } catch (err) {
      captureError(err, { source: 'AdminForgeTab._loadStats' });
      VelgToast.error(msg('Failed to load forge stats.'));
    }
  }

  private async _loadEconomyStats() {
    try {
      const resp = await adminApi.getTokenEconomyStats();
      if (resp.success && resp.data) {
        this._economyStats = resp.data;
      }
    } catch (err) {
      captureError(err, { source: 'AdminForgeTab._loadEconomyStats' });
    }
  }

  private async _loadBundles() {
    try {
      const resp = await adminApi.listAllBundles();
      if (resp.success && resp.data) {
        this._bundles = resp.data;
      }
    } catch (err) {
      captureError(err, { source: 'AdminForgeTab._loadBundles' });
    }
  }

  private async _loadPurchases() {
    try {
      const resp = await adminApi.listPurchases(
        this._purchaseLimit,
        this._purchaseOffset,
        this._purchaseFilter ?? undefined,
      );
      if (resp.success && resp.data) {
        this._purchases = resp.data;
        this._purchaseTotal = (resp.meta as { total?: number })?.total ?? resp.data.length;
      }
    } catch (err) {
      captureError(err, { source: 'AdminForgeTab._loadPurchases' });
    }
  }

  private async _loadBYOKSetting() {
    try {
      const resp = await adminApi.getBYOKSystemSetting();
      if (resp.success && resp.data) {
        this._byokSystemEnabled = resp.data.byok_bypass_enabled;
        this._byokAccessPolicy =
          (resp.data.byok_access_policy as 'none' | 'all' | 'per_user') ?? 'per_user';
      }
    } catch (err) {
      captureError(err, { source: 'AdminForgeTab._loadBYOKSetting' });
    }
  }

  // ── Actions ──

  private async _toggleBundleActive(bundle: AdminBundleEntry) {
    const newActive = !bundle.is_active;
    // Optimistic update
    this._bundles = this._bundles.map((b) =>
      b.id === bundle.id ? { ...b, is_active: newActive } : b,
    );
    try {
      const resp = await adminApi.updateBundle(bundle.id, {
        is_active: newActive,
      } as Partial<AdminBundleEntry>);
      if (resp.success) {
        VelgToast.success(msg('Bundle updated.'));
        this._loadEconomyStats();
      } else {
        // Revert
        this._bundles = this._bundles.map((b) =>
          b.id === bundle.id ? { ...b, is_active: !newActive } : b,
        );
        VelgToast.error(resp.error?.message ?? msg('Failed to update bundle.'));
      }
    } catch (err) {
      captureError(err, { source: 'AdminForgeTab._toggleBundleActive', bundleId: bundle.id });
      this._bundles = this._bundles.map((b) =>
        b.id === bundle.id ? { ...b, is_active: !newActive } : b,
      );
      VelgToast.error(msg('An unexpected error occurred.'));
    }
  }

  private _startEditBundle(bundle: AdminBundleEntry) {
    this._editingBundleId = bundle.id;
    this._bundleEditDraft = {
      display_name: bundle.display_name,
      tokens: bundle.tokens,
      price_cents: bundle.price_cents,
      savings_pct: bundle.savings_pct,
      sort_order: bundle.sort_order,
    };
  }

  private _cancelEditBundle() {
    this._editingBundleId = null;
    this._bundleEditDraft = {};
  }

  private async _saveEditBundle() {
    if (!this._editingBundleId) return;
    try {
      const resp = await adminApi.updateBundle(
        this._editingBundleId,
        this._bundleEditDraft as Partial<AdminBundleEntry>,
      );
      if (resp.success) {
        VelgToast.success(msg('Bundle updated.'));
        this._editingBundleId = null;
        this._bundleEditDraft = {};
        this._loadBundles();
        this._loadEconomyStats();
      } else {
        VelgToast.error(resp.error?.message ?? msg('Failed to update bundle.'));
      }
    } catch (err) {
      captureError(err, {
        source: 'AdminForgeTab._saveEditBundle',
        bundleId: this._editingBundleId ?? '',
      });
      VelgToast.error(msg('An unexpected error occurred.'));
    }
  }

  private async _submitGrant() {
    if (!this._grantUserId.trim() || this._grantTokens < 1) return;

    const { VelgConfirmDialog } = await import('../shared/ConfirmDialog.js');
    const confirmed = await VelgConfirmDialog.show({
      title: msg('Grant Tokens'),
      message: msg(str`Grant ${this._grantTokens} tokens to ${this._grantUserId.slice(0, 8)}...?`),
      confirmLabel: msg('Grant'),
      variant: 'default',
    });
    if (!confirmed) return;

    this._granting = true;
    try {
      const resp = await adminApi.grantTokens(
        this._grantUserId.trim(),
        this._grantTokens,
        this._grantReason.trim() || undefined,
      );
      if (resp.success) {
        const data = resp.data as { tokens_granted?: number; balance_after?: number };
        VelgToast.success(
          msg(
            str`Granted ${data.tokens_granted ?? this._grantTokens} tokens. New balance: ${data.balance_after ?? '?'}`,
          ),
        );
        this._grantUserId = '';
        this._grantTokens = 5;
        this._grantReason = '';
        this._loadEconomyStats();
        this._loadPurchases();
      } else {
        VelgToast.error(resp.error?.message ?? msg('Grant failed.'));
      }
    } catch (err) {
      captureError(err, { source: 'AdminForgeTab._submitGrant' });
      VelgToast.error(msg('An unexpected error occurred.'));
    } finally {
      this._granting = false;
    }
  }

  private _setLedgerFilter(filter: string | null) {
    this._purchaseFilter = filter;
    this._purchaseOffset = 0;
    this._loadPurchases();
  }

  private _ledgerPrev() {
    if (this._purchaseOffset <= 0) return;
    this._purchaseOffset = Math.max(0, this._purchaseOffset - this._purchaseLimit);
    this._loadPurchases();
  }

  private _ledgerNext() {
    if (this._purchaseOffset + this._purchaseLimit >= this._purchaseTotal) return;
    this._purchaseOffset += this._purchaseLimit;
    this._loadPurchases();
  }

  private async _toggleBYOKSystem() {
    const newValue = !this._byokSystemEnabled;
    try {
      const resp = await adminApi.updateBYOKSystemSetting(newValue);
      if (resp.success) {
        this._byokSystemEnabled = newValue;
        VelgToast.success(
          newValue
            ? msg('BYOK bypass enabled system-wide.')
            : msg('BYOK bypass disabled system-wide.'),
        );
      } else {
        VelgToast.error(resp.error?.message ?? msg('Failed to update BYOK setting.'));
      }
    } catch (err) {
      captureError(err, { source: 'AdminForgeTab._toggleBYOKSystem' });
      VelgToast.error(msg('An unexpected error occurred.'));
    }
  }

  private async _changeBYOKAccessPolicy(e: Event) {
    const policy = (e.target as HTMLSelectElement).value as 'none' | 'all' | 'per_user';
    try {
      const resp = await adminApi.updateBYOKAccessPolicy(policy);
      if (resp.success) {
        this._byokAccessPolicy = policy;
        const labels: Record<string, string> = {
          none: msg('Nobody can use BYOK.'),
          all: msg('All architects can use BYOK.'),
          per_user: msg('BYOK granted per user.'),
        };
        VelgToast.success(labels[policy]);
      } else {
        VelgToast.error(resp.error?.message ?? msg('Failed to update access policy.'));
      }
    } catch (err) {
      captureError(err, { source: 'AdminForgeTab._changeBYOKAccessPolicy' });
      VelgToast.error(msg('An unexpected error occurred.'));
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
    } catch (err) {
      captureError(err, { source: 'AdminForgeTab._purgeStaleDrafts' });
      VelgToast.error(msg('Purge failed.'));
    }
  }

  // ── Helpers ──

  private _formatCents(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }

  // ── Render ──

  protected render() {
    return html`
      <div class="forge-admin">

        <!-- SEC-01: Forge Overview -->
        <div class="forge-section">
          <div class="forge-section__header">
            <span class="forge-section__code">SEC-01</span>
            <h3 class="forge-section__title">${msg('Forge Overview')}</h3>
          </div>
          <div class="forge-section__divider"></div>
          <div class="stats-grid">
            <velg-metric-card
              label=${msg('Active Drafts')}
              value=${String(this._draftCount)}
            ></velg-metric-card>
            <velg-metric-card
              label=${msg('Tokens Circulating')}
              value=${String(this._totalTokens)}
            ></velg-metric-card>
            <velg-metric-card
              label=${msg('Materialized')}
              value=${String(this._totalMaterialized)}
            ></velg-metric-card>
          </div>
        </div>

        <!-- SEC-02: Token Economy -->
        ${this._renderTokenEconomy()}

        <!-- SEC-03: Clearance Requests -->
        <div class="forge-section">
          <div class="forge-section__header">
            <span class="forge-section__code">SEC-03</span>
            <h3 class="forge-section__title">${msg('Clearance Queue')}</h3>
            ${renderInfoBubble(msg('Pending Forge creation requests from simulation architects. Approve to generate, reject to decline. Tokens are refunded on rejection.'), 'tip-clearance-queue')}
          </div>
          <div class="forge-section__divider"></div>
          <velg-clearance-queue variant="full"></velg-clearance-queue>
        </div>

        <!-- SEC-04 / SEC-05: Bundles + Grant (side by side on wide) -->
        ${this._renderBundleManagement()}

        <div class="forge-grid">
          ${this._renderGrantForm()}
          ${this._renderPurchaseLedger()}
        </div>

        <!-- SEC-07: Global Controls -->
        <div class="forge-section">
          <div class="forge-section__header">
            <span class="forge-section__code">SEC-07</span>
            <h3 class="forge-section__title">${msg('Global Economic Controls')}</h3>
          </div>
          <div class="forge-section__divider"></div>
          <div class="settings-group">
            <div class="settings-item">
              <div class="settings-item__info">
                <div class="settings-item__label">${msg('BYOK Free Access')}</div>
                <div class="settings-item__description">${msg('When enabled, users with both BYOK keys bypass token costs entirely.')}</div>
              </div>
              <label class="settings-toggle" aria-label=${msg('BYOK Free Access')}>
                <input
                  class="settings-toggle__input"
                  type="checkbox"
                  role="switch"
                  .checked=${this._byokSystemEnabled}
                  @change=${this._toggleBYOKSystem}
                />
                <span class="settings-toggle__slider"></span>
              </label>
            </div>

            <div class="settings-item">
              <div class="settings-item__info">
                <div class="settings-item__label">${msg('BYOK Access Policy')}</div>
                <div class="settings-item__description">${msg('Controls which users can bring their own API keys.')}</div>
              </div>
              <select
                class="membership-role-select"
                aria-label=${msg('BYOK Access Policy')}
                .value=${this._byokAccessPolicy}
                @change=${this._changeBYOKAccessPolicy}
              >
                <option value="none">${msg('Nobody')}</option>
                <option value="per_user">${msg('Per User (admin grants)')}</option>
                <option value="all">${msg('All Architects')}</option>
              </select>
            </div>

            <div class="settings-item">
              <div class="settings-item__info">
                <div class="settings-item__label">${msg('Default Architect Grant')}</div>
                <div class="settings-item__description">${msg('Number of forge tokens given to new architects.')}</div>
              </div>
              <input type="number" class="membership-role-select" style="width: 80px" value="1"
                aria-label=${msg('Default Architect Grant')}
                disabled title=${msg('Not yet configurable')} />
            </div>

            <div class="settings-item">
              <div class="settings-item__info">
                <div class="settings-item__label">${msg('Darkroom Test Limit')}</div>
                <div class="settings-item__description">${msg('Max test renders allowed per simulation draft.')}</div>
              </div>
              <input type="number" class="membership-role-select" style="width: 80px" value="5"
                aria-label=${msg('Darkroom Test Limit')}
                disabled title=${msg('Not yet configurable')} />
            </div>
          </div>
        </div>

        <!-- SEC-08: Personal BYOK Keys -->
        <div class="forge-section">
          <div class="forge-section__header">
            <span class="forge-section__code">SEC-08</span>
            <h3 class="forge-section__title">${msg('Personal API Keys (BYOK)')}</h3>
            ${renderInfoBubble(msg('Personal API key override. Your account uses these keys instead of consuming forge tokens.'), 'tip-byok')}
          </div>
          <div class="forge-section__divider"></div>
          <velg-byok-panel mode="admin"></velg-byok-panel>
        </div>

        <!-- SEC-09: Maintenance -->
        <div class="forge-section">
          <div class="forge-section__header">
            <span class="forge-section__code">SEC-09</span>
            <h3 class="forge-section__title">${msg('Maintenance')}</h3>
          </div>
          <div class="forge-section__desc">${msg('Clean up unused assets and database records.')}</div>
          <div class="forge-section__divider"></div>
          <button class="btn-primary" aria-label=${msg('Purge stale forge drafts')} @click=${this._purgeStaleDrafts}>
            ${msg('Purge Stale Drafts')}
          </button>
        </div>

      </div>
    `;
  }

  // ── Section: Token Economy Dashboard ──

  private _renderTokenEconomy() {
    const s = this._economyStats;
    if (!s) return nothing;

    return html`
      <div class="forge-section">
        <div class="forge-section__header">
          <span class="forge-section__code">SEC-02</span>
          <h3 class="forge-section__title">${msg('Token Economy')}</h3>
          ${renderInfoBubble(msg('Overview of platform token allocation and consumption. Tokens gate Forge usage to prevent runaway generation costs.'), 'tip-token-economy')}
        </div>
        <div class="forge-section__desc">${msg('Aggregated metrics for the forge token economy.')}</div>
        <div class="forge-section__divider"></div>
        <div class="stats-grid">
          <velg-metric-card
            label=${msg('Total Revenue')}
            value=${this._formatCents(Number(s.total_revenue_cents))}
            sublabel=${msg(str`${s.total_purchases - s.admin_grants} purchases`)}
          ></velg-metric-card>
          <velg-metric-card
            label=${msg('Tokens Granted')}
            value=${String(s.total_tokens_granted)}
            sublabel=${msg(str`${s.admin_grants} admin grants`)}
          ></velg-metric-card>
          <velg-metric-card
            label=${msg('In Circulation')}
            value=${String(s.tokens_in_circulation)}
            sublabel=${msg(str`${s.active_bundles} active bundles`)}
          ></velg-metric-card>
          <velg-metric-card
            label=${msg('Unique Buyers')}
            value=${String(s.unique_buyers)}
          ></velg-metric-card>
        </div>
      </div>
    `;
  }

  // ── Section: Bundle Management ──

  private _renderBundleManagement() {
    if (!this._bundles.length) return nothing;

    return html`
      <div class="forge-section">
        <div class="forge-section__header">
          <span class="forge-section__code">SEC-04</span>
          <h3 class="forge-section__title">${msg('Bundle Management')}</h3>
        </div>
        <div class="forge-section__desc">${msg('Manage token bundle catalog. Toggle availability or edit pricing.')}</div>
        <div class="forge-section__divider"></div>
        <div class="overflow-x">
          <table class="forge-table">
            <thead>
              <tr>
                <th scope="col">${msg('Slug')}</th>
                <th scope="col">${msg('Tokens')}</th>
                <th scope="col">${msg('Price')}</th>
                <th scope="col">${msg('Savings')}</th>
                <th scope="col">${msg('Order')}</th>
                <th scope="col">${msg('Active')}</th>
                <th scope="col">${msg('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              ${this._bundles.map((b) => this._renderBundleRow(b))}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  private _renderBundleRow(bundle: AdminBundleEntry) {
    const isSystem = bundle.slug === 'admin-grant';
    const rowClass = isSystem
      ? 'bundle-row--system'
      : !bundle.is_active
        ? 'bundle-row--inactive'
        : '';

    return html`
      <tr class=${rowClass}>
        <td>${bundle.slug}</td>
        <td>${bundle.tokens}</td>
        <td>${this._formatCents(bundle.price_cents)}</td>
        <td>${bundle.savings_pct}%</td>
        <td>${bundle.sort_order}</td>
        <td>
          ${
            isSystem
              ? html`<span style="color: var(--color-text-muted)">${msg('System')}</span>`
              : html`
              <label class="settings-toggle" aria-label=${msg('Active')}>
                <input
                  class="settings-toggle__input"
                  type="checkbox"
                  role="switch"
                  .checked=${bundle.is_active}
                  @change=${() => this._toggleBundleActive(bundle)}
                />
                <span class="settings-toggle__slider"></span>
              </label>
            `
          }
        </td>
        <td>
          ${
            isSystem
              ? nothing
              : html`
              <button
                class="settings-btn settings-btn--secondary settings-btn--sm"
                @click=${() => this._startEditBundle(bundle)}
              >
                ${msg('Edit')}
              </button>
            `
          }
        </td>
      </tr>
      ${
        this._editingBundleId === bundle.id
          ? html`
        <tr>
          <td colspan="7">
            ${this._renderBundleEditForm()}
          </td>
        </tr>
      `
          : nothing
      }
    `;
  }

  private _renderBundleEditForm() {
    const d = this._bundleEditDraft;
    return html`
      <div class="bundle-edit-form">
        <span class="bundle-edit-form__label">${msg('Display Name')}</span>
        <input
          class="bundle-edit-form__input"
          type="text"
          .value=${d.display_name ?? ''}
          aria-label=${msg('Display Name')}
          @input=${(e: Event) => {
            this._bundleEditDraft = {
              ...this._bundleEditDraft,
              display_name: (e.target as HTMLInputElement).value,
            };
          }}
        />
        <span class="bundle-edit-form__label">${msg('Tokens')}</span>
        <input
          class="bundle-edit-form__input"
          type="number"
          min="1"
          .value=${String(d.tokens ?? '')}
          aria-label=${msg('Tokens')}
          @input=${(e: Event) => {
            this._bundleEditDraft = {
              ...this._bundleEditDraft,
              tokens: Number((e.target as HTMLInputElement).value),
            };
          }}
        />
        <span class="bundle-edit-form__label">${msg('Price (cents)')}</span>
        <input
          class="bundle-edit-form__input"
          type="number"
          min="0"
          .value=${String(d.price_cents ?? '')}
          aria-label=${msg('Price (cents)')}
          @input=${(e: Event) => {
            this._bundleEditDraft = {
              ...this._bundleEditDraft,
              price_cents: Number((e.target as HTMLInputElement).value),
            };
          }}
        />
        <span class="bundle-edit-form__label">${msg('Savings %')}</span>
        <input
          class="bundle-edit-form__input"
          type="number"
          min="0"
          max="100"
          .value=${String(d.savings_pct ?? '')}
          aria-label=${msg('Savings %')}
          @input=${(e: Event) => {
            this._bundleEditDraft = {
              ...this._bundleEditDraft,
              savings_pct: Number((e.target as HTMLInputElement).value),
            };
          }}
        />
        <span class="bundle-edit-form__label">${msg('Sort Order')}</span>
        <input
          class="bundle-edit-form__input"
          type="number"
          min="0"
          .value=${String(d.sort_order ?? '')}
          aria-label=${msg('Sort Order')}
          @input=${(e: Event) => {
            this._bundleEditDraft = {
              ...this._bundleEditDraft,
              sort_order: Number((e.target as HTMLInputElement).value),
            };
          }}
        />
        <div class="bundle-edit-form__actions">
          <button
            class="settings-btn settings-btn--secondary settings-btn--sm"
            @click=${this._cancelEditBundle}
          >
            ${msg('Cancel')}
          </button>
          <button
            class="settings-btn settings-btn--primary settings-btn--sm"
            @click=${this._saveEditBundle}
          >
            ${msg('Save')}
          </button>
        </div>
      </div>
    `;
  }

  // ── Section: Grant Tokens ──

  private _renderGrantForm() {
    return html`
      <div class="forge-section">
        <div class="forge-section__header">
          <span class="forge-section__code">SEC-05</span>
          <h3 class="forge-section__title">${msg('Grant Tokens')}</h3>
        </div>
        <div class="forge-section__desc">${msg('Manually grant tokens to a user. Creates an auditable ledger entry.')}</div>
        <div class="forge-section__divider"></div>
        <div class="grant-form">
          <span class="grant-form__label">${msg('User ID')}</span>
          <input
            class="grant-form__input"
            type="text"
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            .value=${this._grantUserId}
            aria-label=${msg('User ID')}
            @input=${(e: Event) => (this._grantUserId = (e.target as HTMLInputElement).value)}
          />
          <span class="grant-form__label">${msg('Tokens')}</span>
          <input
            class="grant-form__input"
            type="number"
            min="1"
            max="1000"
            .value=${String(this._grantTokens)}
            aria-label=${msg('Tokens')}
            @input=${(e: Event) => (this._grantTokens = Number((e.target as HTMLInputElement).value))}
          />
          <span class="grant-form__label">${msg('Reason')}</span>
          <input
            class="grant-form__input"
            type="text"
            placeholder=${msg('Optional reason for audit trail')}
            .value=${this._grantReason}
            aria-label=${msg('Reason')}
            @input=${(e: Event) => (this._grantReason = (e.target as HTMLInputElement).value)}
          />
          <div class="grant-form__actions">
            <button
              class="btn-approve"
              ?disabled=${this._granting || !this._grantUserId.trim()}
              @click=${this._submitGrant}
            >
              ${this._granting ? msg('Granting...') : msg('Grant Tokens')}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // ── Section: Purchase Ledger ──

  private _renderPurchaseLedger() {
    return html`
      <div class="forge-section">
        <div class="forge-section__header">
          <span class="forge-section__code">SEC-06</span>
          <h3 class="forge-section__title">${msg('Purchase Ledger')}</h3>
        </div>
        <div class="forge-section__desc">${msg('Global purchase transaction log with filter and pagination.')}</div>
        <div class="forge-section__divider"></div>

        <div class="ledger-filters">
          ${this._renderFilterChip(null, msg('All'))}
          ${this._renderFilterChip('mock', msg('Mock'))}
          ${this._renderFilterChip('admin_grant', msg('Admin Grant'))}
          ${this._renderFilterChip('stripe', msg('Stripe'))}
        </div>

        ${
          this._purchases.length === 0
            ? html`<div class="empty-state">// ${msg('No purchases found')} //</div>`
            : html`
            <div class="overflow-x">
              <table class="forge-table">
                <thead>
                  <tr>
                    <th scope="col">${msg('Date')}</th>
                    <th scope="col">${msg('User')}</th>
                    <th scope="col">${msg('Bundle')}</th>
                    <th scope="col">${msg('Tokens')}</th>
                    <th scope="col">${msg('Method')}</th>
                    <th scope="col">${msg('Balance')}</th>
                  </tr>
                </thead>
                <tbody>
                  ${this._purchases.map((p) => this._renderLedgerRow(p))}
                </tbody>
              </table>
            </div>

            <div class="ledger-pagination">
              <span class="ledger-pagination__info">
                ${this._purchaseOffset + 1}&ndash;${Math.min(this._purchaseOffset + this._purchaseLimit, this._purchaseTotal)}
                / ${this._purchaseTotal}
              </span>
              <div class="ledger-pagination__buttons">
                <button
                  class="ledger-pagination__btn"
                  ?disabled=${this._purchaseOffset <= 0}
                  aria-label=${msg('Previous page')}
                  @click=${this._ledgerPrev}
                >
                  &larr; ${msg('Prev')}
                </button>
                <button
                  class="ledger-pagination__btn"
                  ?disabled=${this._purchaseOffset + this._purchaseLimit >= this._purchaseTotal}
                  aria-label=${msg('Next page')}
                  @click=${this._ledgerNext}
                >
                  ${msg('Next')} &rarr;
                </button>
              </div>
            </div>
          `
        }
      </div>
    `;
  }

  private _renderFilterChip(value: string | null, label: string) {
    const active = this._purchaseFilter === value;
    return html`
      <button
        class="filter-chip ${active ? 'filter-chip--active' : ''}"
        aria-pressed=${String(active)}
        @click=${() => this._setLedgerFilter(value)}
      >
        ${label}
      </button>
    `;
  }

  private _renderLedgerRow(p: AdminPurchaseLedgerEntry) {
    const bundleSlug =
      p.token_bundles?.slug ??
      (p.payment_method === 'admin_grant' ? `(${msg('admin grant')})` : '–');
    const userId = `${p.user_id.slice(0, 8)}...`;

    return html`
      <tr>
        <td>${formatDateTime(p.created_at)}</td>
        <td title=${p.user_id}>${userId}</td>
        <td>${bundleSlug}</td>
        <td>${p.tokens_granted}</td>
        <td>${p.payment_method}</td>
        <td>${p.balance_before} &rarr; ${p.balance_after}</td>
      </tr>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-admin-forge-tab': VelgAdminForgeTab;
  }
}
