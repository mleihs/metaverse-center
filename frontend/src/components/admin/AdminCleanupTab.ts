import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { adminApi } from '../../services/api/index.js';
import type {
  CleanupPreviewItem,
  CleanupPreviewResult,
  CleanupStats,
  CleanupType,
} from '../../types/index.js';
import { VelgToast } from '../shared/Toast.js';

import '../shared/ConfirmDialog.js';

interface CleanupMeta {
  label: string;
  description: string;
  icon: string;
  statsKey: keyof CleanupStats;
}

function getCleanupMeta(): Record<CleanupType, CleanupMeta> {
  return {
    completed_epochs: {
      label: msg('Completed Epochs'),
      description: msg(
        'Finished epoch matches and all associated data: teams, participants, missions, scores, battle log, chat messages, invitations, bot decisions, and cloned game instances.',
      ),
      icon: '\u2714',
      statsKey: 'completed_epochs',
    },
    cancelled_epochs: {
      label: msg('Cancelled Epochs'),
      description: msg(
        'Aborted epoch matches and their cascade data. Game instances are normally deleted on cancellation, but orphans may remain.',
      ),
      icon: '\u2718',
      statsKey: 'cancelled_epochs',
    },
    stale_lobbies: {
      label: msg('Stale Lobbies'),
      description: msg(
        'Epoch lobbies that never started. Removes participants, invitations, and team assignments. No game instances exist for lobbies.',
      ),
      icon: '\u29D6',
      statsKey: 'stale_lobbies',
    },
    archived_instances: {
      label: msg('Archived Instances'),
      description: msg(
        'Simulation copies from completed epochs. These are frozen snapshots and can be safely removed after analysis.',
      ),
      icon: '\u2610',
      statsKey: 'archived_instances',
    },
    audit_log: {
      label: msg('Audit Log'),
      description: msg(
        'CRUD operation audit trail entries. Older entries are typically no longer needed for debugging.',
      ),
      icon: '\u2261',
      statsKey: 'audit_log_entries',
    },
    bot_decision_log: {
      label: msg('Bot Decision Log'),
      description: msg(
        'AI bot cycle-by-cycle decision records. Useful for tuning but grows quickly during playtesting.',
      ),
      icon: '\u2699',
      statsKey: 'bot_decision_entries',
    },
  };
}

const CLEANUP_TYPES: CleanupType[] = [
  'completed_epochs',
  'cancelled_epochs',
  'stale_lobbies',
  'archived_instances',
  'audit_log',
  'bot_decision_log',
];

const DEFAULT_THRESHOLD = 30;

@localized()
@customElement('velg-admin-cleanup-tab')
export class VelgAdminCleanupTab extends LitElement {
  static styles = css`
    :host {
      display: block;
      color: var(--color-text-primary);
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm);
    }

    /* ── Section headers ─────────────────────────── */

    .section-header {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: 0.18em;
      color: var(--color-text-muted);
      margin: 0 0 var(--space-4) 0;
      padding-bottom: var(--space-2);
      border-bottom: 1px solid var(--color-border);
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .section-header__marker {
      color: var(--color-danger);
    }

    /* ── Overview telemetry grid ─────────────────── */

    .overview-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: var(--space-3);
      margin-bottom: var(--space-8);
    }

    .stat-card {
      padding: var(--space-3) var(--space-4);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-left: 3px solid var(--color-border);
      transition: border-color 0.2s ease;
    }

    .stat-card--active {
      border-left-color: var(--color-warning);
    }

    .stat-card__label {
      font-family: var(--font-brutalist);
      font-size: 10px;
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: var(--color-text-muted);
      margin: 0 0 var(--space-1) 0;
    }

    .stat-card__row {
      display: flex;
      align-items: baseline;
      gap: var(--space-2);
    }

    .stat-card__count {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-lg, 1.125rem);
      font-weight: var(--font-bold);
      color: var(--color-text-primary);
    }

    .stat-card__count--zero {
      color: var(--color-text-muted);
    }

    .stat-card__age {
      font-size: 10px;
      color: var(--color-text-muted);
      margin-left: auto;
    }

    /* ── Operations grid ─────────────────────────── */

    .ops-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: var(--space-4);
    }

    .op-card {
      padding: var(--space-4);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }

    .op-card:hover {
      border-color: var(--color-text-muted);
    }

    .op-card--scanned {
      border-color: color-mix(in srgb, var(--color-warning) 60%, transparent);
    }

    .op-card__header {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin-bottom: var(--space-2);
    }

    .op-card__icon {
      font-size: var(--text-base, 1rem);
      width: 24px;
      text-align: center;
      color: var(--color-text-secondary);
    }

    .op-card__title {
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-primary);
      margin: 0;
    }

    .op-card__desc {
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      line-height: 1.5;
      margin: 0 0 var(--space-3) 0;
    }

    /* ── Controls row ────────────────────────────── */

    .controls-row {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin-bottom: var(--space-3);
    }

    .controls-row__label {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      white-space: nowrap;
    }

    .controls-row__input {
      width: 70px;
      padding: var(--space-1) var(--space-2);
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm);
      text-align: right;
      background: var(--color-background);
      color: var(--color-text-primary);
      border: 1px solid var(--color-border);
      border-radius: 0;
      -moz-appearance: textfield;
    }

    .controls-row__input::-webkit-outer-spin-button,
    .controls-row__input::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }

    .controls-row__input:focus {
      outline: none;
      border-color: var(--color-danger);
      box-shadow: 0 0 0 1px var(--color-danger);
    }

    .controls-row__unit {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    /* ── Buttons ──────────────────────────────────── */

    .btn {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      padding: var(--space-1) var(--space-3);
      cursor: pointer;
      border: 1px solid var(--color-border);
      transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
    }

    .btn:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }

    .btn--scan {
      background: transparent;
      color: var(--color-text-secondary);
      margin-left: auto;
    }

    .btn--scan:hover:not(:disabled) {
      color: var(--color-text-primary);
      border-color: var(--color-text-muted);
      background: color-mix(in srgb, var(--color-text-primary) 6%, transparent);
    }

    .btn--purge {
      display: block;
      width: 100%;
      padding: var(--space-2) var(--space-4);
      background: transparent;
      color: var(--color-danger);
      border: 1px solid var(--color-danger);
      font-size: var(--text-sm);
      position: relative;
      overflow: hidden;
    }

    .btn--purge:hover:not(:disabled) {
      background: var(--color-danger);
      color: var(--color-text-inverse);
      box-shadow: 0 0 16px color-mix(in srgb, var(--color-danger) 35%, transparent);
    }

    .btn--purge:active:not(:disabled) {
      transform: scale(0.98);
    }

    /* ── Preview readout ─────────────────────────── */

    .preview {
      background: var(--color-background);
      border: 1px solid var(--color-border);
      padding: var(--space-3);
      margin-bottom: var(--space-3);
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      line-height: 1.7;
      position: relative;
    }

    .preview__corner {
      position: absolute;
      color: var(--color-text-muted);
      font-size: 10px;
      opacity: 0.5;
    }

    .preview__corner--tl { top: 2px; left: 4px; }
    .preview__corner--br { bottom: 2px; right: 4px; }

    .preview__headline {
      color: var(--color-warning);
      font-weight: var(--font-bold);
      margin-bottom: var(--space-1);
    }

    .preview__zero {
      color: var(--color-text-muted);
    }

    .preview__tree-line {
      color: var(--color-text-secondary);
      white-space: pre;
    }

    .preview__tree-branch {
      color: var(--color-text-muted);
    }

    .preview__tree-count {
      color: var(--color-text-primary);
    }

    .preview__total {
      border-top: 1px solid var(--color-border);
      padding-top: var(--space-1);
      margin-top: var(--space-1);
      color: var(--color-text-muted);
      font-weight: var(--font-bold);
    }

    /* ── Item selection list ────────────────────────── */

    .item-list {
      margin: var(--space-2) 0;
      display: flex;
      flex-direction: column;
      gap: 1px;
    }

    .item-row {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-1) var(--space-2);
      background: color-mix(in srgb, var(--color-surface) 50%, transparent);
      cursor: pointer;
      transition: background 0.15s ease;
    }

    .item-row:hover {
      background: color-mix(in srgb, var(--color-text-primary) 6%, transparent);
    }

    .item-row__check {
      accent-color: var(--color-warning);
      cursor: pointer;
    }

    .item-row__name {
      flex: 1;
      color: var(--color-text-primary);
      font-size: var(--text-xs);
    }

    .item-row__age {
      color: var(--color-text-muted);
      font-size: 10px;
      white-space: nowrap;
    }

    /* ── Loading / empty ─────────────────────────── */

    .loading {
      text-align: center;
      padding: var(--space-8);
      color: var(--color-text-muted);
      font-family: var(--font-brutalist);
      text-transform: uppercase;
    }

    @media (max-width: 768px) {
      .overview-grid {
        grid-template-columns: repeat(2, 1fr);
      }
      .ops-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 480px) {
      .overview-grid {
        grid-template-columns: 1fr;
      }
    }
  `;

  @state() private _stats: CleanupStats | null = null;
  @state() private _loading = true;
  @state() private _thresholds: Record<CleanupType, number> = {
    completed_epochs: DEFAULT_THRESHOLD,
    cancelled_epochs: DEFAULT_THRESHOLD,
    stale_lobbies: DEFAULT_THRESHOLD,
    archived_instances: DEFAULT_THRESHOLD,
    audit_log: 90,
    bot_decision_log: DEFAULT_THRESHOLD,
  };
  @state() private _previews: Partial<Record<CleanupType, CleanupPreviewResult>> = {};
  @state() private _selectedIds: Partial<Record<CleanupType, Set<string>>> = {};
  @state() private _scanning: CleanupType | null = null;
  @state() private _executing: CleanupType | null = null;
  @state() private _confirmPurge: CleanupType | null = null;

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    await this._loadStats();
  }

  private async _loadStats(): Promise<void> {
    this._loading = true;
    const result = await adminApi.getCleanupStats();
    if (result.success && result.data) {
      this._stats = result.data as CleanupStats;
    }
    this._loading = false;
  }

  private async _scan(type: CleanupType): Promise<void> {
    this._scanning = type;
    try {
      const result = await adminApi.previewCleanup(type, this._thresholds[type]);
      if (result.success && result.data) {
        const preview = result.data as CleanupPreviewResult;
        this._previews = { ...this._previews, [type]: preview };
        // Select all items by default
        if (preview.items?.length) {
          this._selectedIds = {
            ...this._selectedIds,
            [type]: new Set(preview.items.map((it: CleanupPreviewItem) => it.id)),
          };
        }
      } else {
        VelgToast.error(result.error?.message ?? msg('Scan failed.'));
      }
    } catch {
      VelgToast.error(msg('Scan failed.'));
    } finally {
      this._scanning = null;
    }
  }

  private async _executePurge(type: CleanupType): Promise<void> {
    this._confirmPurge = null;
    this._executing = type;
    try {
      const selected = this._selectedIds[type];
      const epochIds = selected?.size ? [...selected] : undefined;
      const result = await adminApi.executeCleanup(type, this._thresholds[type], epochIds);
      if (result.success && result.data) {
        const count = (result.data as { deleted_count: number }).deleted_count;
        VelgToast.success(msg(str`Purge complete: ${count} records deleted.`));
        // Clear preview, selection, and refresh stats
        const newPreviews = { ...this._previews };
        delete newPreviews[type];
        this._previews = newPreviews;
        const newSelected = { ...this._selectedIds };
        delete newSelected[type];
        this._selectedIds = newSelected;
        await this._loadStats();
      } else {
        VelgToast.error(result.error?.message ?? msg('Purge failed.'));
      }
    } catch {
      VelgToast.error(msg('Purge failed.'));
    } finally {
      this._executing = null;
    }
  }

  private _formatAge(dateStr: string | null): string {
    if (!dateStr) return '\u2014';
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86_400_000);
    if (days < 1) return msg('< 1d');
    if (days < 30) return msg(str`${days}d`);
    const months = Math.floor(days / 30);
    return msg(str`${months}mo`);
  }

  private _renderOverview() {
    if (!this._stats) return nothing;
    const stats = this._stats;

    const meta = getCleanupMeta();

    return html`
      <h3 class="section-header">
        <span class="section-header__marker">\u25A0</span>
        ${msg('Data Overview')}
      </h3>
      <div class="overview-grid">
        ${CLEANUP_TYPES.map((type) => {
          const m = meta[type];
          const cat = stats[m.statsKey];
          const hasRecords = cat.count > 0;

          return html`
            <div class="stat-card ${hasRecords ? 'stat-card--active' : ''}">
              <p class="stat-card__label">${m.label}</p>
              <div class="stat-card__row">
                <span class="stat-card__count ${hasRecords ? '' : 'stat-card__count--zero'}">
                  ${cat.count}
                </span>
                <span class="stat-card__age">
                  ${hasRecords ? msg(str`oldest: ${this._formatAge(cat.oldest_at)}`) : '\u2014'}
                </span>
              </div>
            </div>
          `;
        })}
      </div>
    `;
  }

  private _renderCascadeTree(preview: CleanupPreviewResult): unknown {
    const entries = Object.entries(preview.cascade_counts);
    if (entries.length === 0) return nothing;

    const total = entries.reduce((sum, [, v]) => sum + v, 0) + preview.primary_count;

    return html`
      ${entries.map(([table, count], i) => {
        const isLast = i === entries.length - 1;
        const branch = isLast ? '\u2514\u2500\u2500' : '\u251C\u2500\u2500';
        const name = table.replace(/_/g, '_');
        const dots = '.'.repeat(Math.max(1, 28 - name.length));
        return html`
          <div class="preview__tree-line"><span class="preview__tree-branch">${branch} </span>${name} <span class="preview__tree-branch">${dots}</span> <span class="preview__tree-count">${count}</span></div>
        `;
      })}
      <div class="preview__total">${msg('TOTAL')}: ${total} ${msg('records')}</div>
    `;
  }

  private _refreshTimer: ReturnType<typeof setTimeout> | null = null;

  private _toggleItem(type: CleanupType, id: string): void {
    const current = this._selectedIds[type] ?? new Set<string>();
    const next = new Set(current);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this._selectedIds = { ...this._selectedIds, [type]: next };

    // Debounce re-preview to update cascade counts
    if (this._refreshTimer) clearTimeout(this._refreshTimer);
    this._refreshTimer = setTimeout(() => this._refreshPreview(type), 300);
  }

  private async _refreshPreview(type: CleanupType): Promise<void> {
    const selected = this._selectedIds[type];
    if (!selected?.size) return;
    const result = await adminApi.previewCleanup(
      type,
      this._thresholds[type],
      [...selected],
    );
    if (result.success && result.data) {
      this._previews = { ...this._previews, [type]: result.data as CleanupPreviewResult };
    }
  }

  private _renderItemList(type: CleanupType, items: CleanupPreviewItem[]): TemplateResult | typeof nothing {
    if (!items.length) return nothing;
    const selected = this._selectedIds[type] ?? new Set<string>();
    return html`
      <div class="item-list">
        ${items.map(
          (item) => html`
          <label class="item-row">
            <input
              type="checkbox"
              class="item-row__check"
              .checked=${selected.has(item.id)}
              @change=${() => this._toggleItem(type, item.id)}
            />
            <span class="item-row__name">${item.name}</span>
            <span class="item-row__age">${this._formatAge(item.updated_at)}</span>
          </label>
        `,
        )}
      </div>
    `;
  }

  private _renderPreview(type: CleanupType): TemplateResult | typeof nothing {
    const preview = this._previews[type];
    if (!preview) return nothing;

    if (preview.primary_count === 0) {
      return html`
        <div class="preview">
          <div class="preview__zero">${msg('No records match the criteria.')}</div>
        </div>
      `;
    }

    const meta = getCleanupMeta();
    const label = meta[type].label.toUpperCase();
    const selected = this._selectedIds[type];
    const selectedCount = selected?.size ?? preview.primary_count;

    return html`
      <div class="preview">
        <span class="preview__corner preview__corner--tl">\u250C</span>
        <span class="preview__corner preview__corner--br">\u2518</span>
        <div class="preview__headline">${selectedCount} / ${preview.primary_count} ${label} ${msg('selected')}</div>
        ${this._renderItemList(type, preview.items ?? [])}
        ${this._renderCascadeTree(preview)}
      </div>
    `;
  }

  private _renderOperations() {
    const meta = getCleanupMeta();

    return html`
      <h3 class="section-header">
        <span class="section-header__marker">\u25A0</span>
        ${msg('Cleanup Operations')}
      </h3>
      <div class="ops-grid">
        ${CLEANUP_TYPES.map((type) => {
          const m = meta[type];
          const preview = this._previews[type];
          const isScanning = this._scanning === type;
          const isExecuting = this._executing === type;
          const selected = this._selectedIds[type];
          const hasSelection = preview?.items?.length
            ? (selected?.size ?? 0) > 0
            : preview && preview.primary_count > 0;
          const canPurge = hasSelection && !isExecuting;
          const hasScanned = !!preview;

          return html`
            <div class="op-card ${hasScanned ? 'op-card--scanned' : ''}">
              <div class="op-card__header">
                <span class="op-card__icon">${m.icon}</span>
                <h4 class="op-card__title">${m.label}</h4>
              </div>
              <p class="op-card__desc">${m.description}</p>

              <div class="controls-row">
                <span class="controls-row__label">${msg('Min age')}</span>
                <input
                  type="number"
                  class="controls-row__input"
                  min="0"
                  max="3650"
                  .value=${String(this._thresholds[type])}
                  @input=${(e: Event) => {
                    const val = Number.parseInt((e.target as HTMLInputElement).value, 10);
                    if (!Number.isNaN(val) && val >= 0) {
                      this._thresholds = { ...this._thresholds, [type]: val };
                      // Clear stale preview + selection when threshold changes
                      if (this._previews[type]) {
                        const newPreviews = { ...this._previews };
                        delete newPreviews[type];
                        this._previews = newPreviews;
                        const newSelected = { ...this._selectedIds };
                        delete newSelected[type];
                        this._selectedIds = newSelected;
                      }
                    }
                  }}
                />
                <span class="controls-row__unit">${msg('days')}</span>
                <button
                  class="btn btn--scan"
                  ?disabled=${isScanning || isExecuting}
                  @click=${() => this._scan(type)}
                >${isScanning ? msg('Scanning...') : msg('Scan')}</button>
              </div>

              ${this._renderPreview(type)}

              ${
                canPurge
                  ? html`
                <button
                  class="btn btn--purge"
                  ?disabled=${isExecuting}
                  @click=${() => {
                    this._confirmPurge = type;
                  }}
                >${isExecuting ? msg('Executing...') : msg('Execute Purge')}</button>
              `
                  : nothing
              }
            </div>
          `;
        })}
      </div>
    `;
  }

  protected render() {
    if (this._loading) {
      return html`<div class="loading">${msg('Loading cleanup data...')}</div>`;
    }

    const purgeType = this._confirmPurge;
    const purgePreview = purgeType ? this._previews[purgeType] : null;
    const meta = purgeType ? getCleanupMeta()[purgeType] : null;
    const purgeSelected = purgeType ? this._selectedIds[purgeType] : null;
    const purgeCount = purgePreview?.items?.length
      ? (purgeSelected?.size ?? 0)
      : (purgePreview?.primary_count ?? 0);

    return html`
      ${this._renderOverview()}
      ${this._renderOperations()}

      ${
        purgeType && purgePreview && meta && purgeCount > 0
          ? html`
        <velg-confirm-dialog
          .open=${true}
          .title=${msg('Confirm Purge')}
          .message=${msg(str`Permanently delete ${purgeCount} ${meta.label.toLowerCase()}? This cannot be undone.`)}
          .confirmLabel=${msg('Execute Purge')}
          .variant=${'danger'}
          @confirm=${() => this._executePurge(purgeType)}
          @cancel=${() => {
            this._confirmPurge = null;
          }}
        ></velg-confirm-dialog>
      `
          : nothing
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-admin-cleanup-tab': VelgAdminCleanupTab;
  }
}
