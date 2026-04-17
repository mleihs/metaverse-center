import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { resonanceApi } from '../../services/api/ResonanceApiService.js';
import { captureError } from '../../services/SentryService.js';
import type { Resonance, ResonanceImpact } from '../../types/index.js';
import { formatDate } from '../../utils/date-format.js';
import { icons } from '../../utils/icons.js';
import { SIGNATURE_KEYS, signatureLabel } from '../../utils/resonance-labels.js';
import { VelgConfirmDialog } from '../shared/ConfirmDialog.js';
import { infoBubbleStyles, renderInfoBubble } from '../shared/info-bubble-styles.js';
import { VelgToast } from '../shared/Toast.js';
import '../shared/ConfirmDialog.js';
import './AdminResonanceFormModal.js';

type ResView = 'active' | 'archived' | 'trash';
type StatusFilter = 'all' | 'detected' | 'impacting' | 'subsiding';

const STATUS_TRANSITIONS: Record<string, string> = {
  detected: 'impacting',
  impacting: 'subsiding',
  subsiding: 'archived',
};

@localized()
@customElement('velg-admin-resonances-tab')
export class VelgAdminResonancesTab extends LitElement {
  static styles = [
    infoBubbleStyles,
    css`
    :host {
      display: block;
      color: var(--color-text-primary);
      font-family: var(--font-mono, monospace);
    }

    /* ── Header ─────────────────────────────────────────── */

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--space-4);
    }

    .header__title {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-lg);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-text-primary);
    }

    .header__title svg {
      color: var(--color-info);
    }

    .header__create-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-4);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      background: color-mix(in srgb, var(--color-info) 12%, var(--color-surface));
      color: var(--color-info);
      border: 1px solid color-mix(in srgb, var(--color-info) 50%, transparent);
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .header__create-btn:hover {
      background: color-mix(in srgb, var(--color-info) 20%, var(--color-surface));
      border-color: var(--color-info);
      transform: translateY(-1px);
    }

    /* ── View Toggle ────────────────────────────────────── */

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
      transition: color 0.2s ease, background 0.2s ease, border-color 0.2s ease;
    }

    .view-toggle__btn + .view-toggle__btn {
      border-left: none;
    }

    .view-toggle__btn:hover {
      color: var(--color-text-primary);
      background: color-mix(in srgb, var(--color-surface) 80%, var(--color-text-primary));
    }

    .view-toggle__btn--active {
      color: var(--color-info);
      border-color: var(--color-info);
      background: color-mix(in srgb, var(--color-info) 8%, var(--color-surface));
    }

    .view-toggle__count {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      margin-left: var(--space-1);
      opacity: 0.7;
    }

    /* ── Filters ────────────────────────────────────────── */

    .filters {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-3);
      margin-bottom: var(--space-4);
    }

    .search-input {
      flex: 1;
      min-width: 200px;
      max-width: 360px;
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
      border-color: var(--color-info);
      box-shadow: 0 0 0 1px var(--color-info);
    }

    .search-input::placeholder {
      color: var(--color-text-muted);
    }

    .filter-chips {
      display: flex;
      gap: var(--space-1);
    }

    .filter-chip {
      padding: var(--space-1) var(--space-2-5);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      background: var(--color-surface);
      color: var(--color-text-muted);
      border: 1px solid var(--color-border);
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .filter-chip:hover {
      color: var(--color-text-primary);
      border-color: var(--color-text-muted);
    }

    .filter-chip--active {
      color: var(--color-info);
      border-color: var(--color-info);
      background: color-mix(in srgb, var(--color-info) 10%, var(--color-surface));
    }

    .sig-select {
      padding: var(--space-1) var(--space-2);
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      background: var(--color-surface);
      color: var(--color-text-primary);
      border: 1px solid var(--color-border);
    }

    .sig-select:focus {
      outline: none;
      border-color: var(--color-info);
    }

    .result-count {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-muted);
      margin-left: auto;
    }

    /* ── Resonance List ─────────────────────────────────── */

    .res-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .res-row {
      display: grid;
      grid-template-columns: 28px 1fr auto auto auto auto;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      transition: border-color 0.2s ease, transform 0.15s ease;
    }

    .res-row:hover {
      border-color: var(--color-text-muted);
      transform: translateX(2px);
    }

    .res-row--deleted {
      opacity: 0.7;
      border-style: dashed;
    }

    .res-row--expanded {
      border-color: color-mix(in srgb, var(--color-info) 50%, var(--color-border));
    }

    /* ── Row Cells ──────────────────────────────────────── */

    .res-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      color: var(--color-text-secondary);
    }

    .res-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .res-title {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      color: var(--color-text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .res-subtitle {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .res-signature {
      font-family: var(--font-brutalist);
      font-size: 9px;
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 0 var(--space-1);
      border: 1px solid color-mix(in srgb, var(--color-info) 30%, transparent);
      color: var(--color-info);
    }

    /* ── Magnitude Gauge ────────────────────────────────── */

    .magnitude {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      min-width: 80px;
    }

    .magnitude__bar {
      position: relative;
      width: 48px;
      height: 6px;
      background: color-mix(in srgb, var(--color-border) 50%, transparent);
      overflow: hidden;
    }

    .magnitude__fill {
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      transition: width 0.3s ease;
    }

    .magnitude__fill--low {
      background: var(--color-info);
    }

    .magnitude__fill--mid {
      background: var(--color-warning);
    }

    .magnitude__fill--high {
      background: var(--color-danger);
    }

    .magnitude__value {
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      font-weight: var(--font-semibold);
      min-width: 28px;
    }

    .magnitude__value--low { color: var(--color-info); }
    .magnitude__value--mid { color: var(--color-warning); }
    .magnitude__value--high { color: var(--color-danger); }

    /* ── Status Badge ───────────────────────────────────── */

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

    .badge--detected {
      color: var(--color-info);
      border-color: color-mix(in srgb, var(--color-info) 50%, transparent);
      background: color-mix(in srgb, var(--color-info) 8%, transparent);
    }

    .badge--impacting {
      color: var(--color-warning);
      border-color: color-mix(in srgb, var(--color-warning) 50%, transparent);
      background: color-mix(in srgb, var(--color-warning) 10%, transparent);
    }

    .badge--subsiding {
      color: var(--color-text-secondary);
      border-color: var(--color-text-muted);
      background: color-mix(in srgb, var(--color-text-secondary) 8%, transparent);
    }

    .badge--archived {
      color: var(--color-text-muted);
      border-color: color-mix(in srgb, var(--color-text-muted) 40%, transparent);
      background: color-mix(in srgb, var(--color-text-muted) 5%, transparent);
    }

    .badge--deleted {
      color: var(--color-danger);
      border-color: color-mix(in srgb, var(--color-danger) 50%, transparent);
      background: color-mix(in srgb, var(--color-danger) 10%, transparent);
    }

    /* ── Countdown / Meta ───────────────────────────────── */

    .res-meta {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      white-space: nowrap;
      text-align: right;
      min-width: 80px;
    }

    .res-meta__countdown {
      font-family: var(--font-mono, monospace);
      font-size: 11px;
    }

    .res-meta__countdown--past {
      color: var(--color-warning);
    }

    /* ── Actions ────────────────────────────────────────── */

    .res-actions {
      display: flex;
      gap: var(--space-1);
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
      transition: all 0.15s ease;
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

    .action-btn--transition {
      color: var(--color-warning);
      border-color: color-mix(in srgb, var(--color-warning) 40%, transparent);
    }

    .action-btn--transition:hover {
      background: color-mix(in srgb, var(--color-warning) 10%, var(--color-surface));
      border-color: var(--color-warning);
      color: var(--color-warning);
    }

    .action-btn--process {
      color: var(--color-info);
      border-color: color-mix(in srgb, var(--color-info) 40%, transparent);
    }

    .action-btn--process:hover {
      background: color-mix(in srgb, var(--color-info) 10%, var(--color-surface));
      border-color: var(--color-info);
      color: var(--color-info);
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

    /* ── Expanded Impact Panel ──────────────────────────── */

    .impact-panel {
      grid-column: 1 / -1;
      padding: var(--space-3) var(--space-4);
      margin-top: var(--space-2);
      background: color-mix(in srgb, var(--color-info) 4%, var(--color-surface));
      border-top: 1px solid color-mix(in srgb, var(--color-info) 20%, var(--color-border));
    }

    .impact-panel__header {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-info);
      margin-bottom: var(--space-2);
    }

    .impact-row {
      display: grid;
      grid-template-columns: 1fr auto auto auto;
      gap: var(--space-3);
      align-items: center;
      padding: var(--space-1) 0;
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      border-bottom: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
    }

    .impact-row:last-child {
      border-bottom: none;
    }

    .impact-sim {
      font-weight: var(--font-semibold);
      color: var(--color-text-primary);
    }

    .impact-mag {
      font-family: var(--font-mono, monospace);
    }

    .impact-events {
      color: var(--color-text-muted);
    }

    .impact-empty {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      padding: var(--space-2) 0;
    }

    /* ── States ─────────────────────────────────────────── */

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

    /* ── Responsive ─────────────────────────────────────── */

    @media (max-width: 900px) {
      .res-row {
        grid-template-columns: 28px 1fr auto;
        gap: var(--space-2);
      }

      .magnitude,
      .res-meta {
        display: none;
      }

      .res-actions {
        grid-column: 1 / -1;
        justify-content: flex-end;
      }
    }

    @media (max-width: 640px) {
      .filters {
        flex-direction: column;
        align-items: stretch;
      }

      .search-input {
        max-width: none;
      }

      .filter-chips {
        flex-wrap: wrap;
      }
    }
  `,
  ];

  @state() private _view: ResView = 'active';
  @state() private _statusFilter: StatusFilter = 'all';
  @state() private _signatureFilter = '';
  @state() private _search = '';
  @state() private _resonances: Resonance[] = [];
  @state() private _loading = true;
  @state() private _error: string | null = null;
  @state() private _actionInProgress: string | null = null;
  @state() private _expandedId: string | null = null;
  @state() private _impacts: Map<string, ResonanceImpact[]> = new Map();
  @state() private _showFormModal = false;
  @state() private _editTarget: Resonance | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this._loadResonances();
  }

  // ── Data Loading ──────────────────────────────────────

  private _switchView(view: ResView): void {
    const needsReload = (this._view === 'trash') !== (view === 'trash');
    this._view = view;
    if (needsReload) {
      this._loadResonances();
    }
  }

  private async _loadResonances(): Promise<void> {
    this._loading = true;
    this._error = null;

    try {
      const params: Record<string, string> = { limit: '100' };

      if (this._view === 'trash') {
        params.include_deleted = 'true';
      }

      const resp = await resonanceApi.list(
        appState.isAuthenticated.value ? 'member' : 'public',
        params,
      );
      if (resp.success && resp.data) {
        this._resonances = resp.data;
      } else {
        this._error = resp.error?.message ?? msg('Failed to load resonances');
      }
    } catch (err) {
      this._error = err instanceof Error ? err.message : msg('Failed to load resonances');
    } finally {
      this._loading = false;
    }
  }

  private async _loadImpacts(resonanceId: string): Promise<void> {
    try {
      const resp = await resonanceApi.listImpacts(
        resonanceId,
        appState.isAuthenticated.value ? 'member' : 'public',
      );
      if (resp.success && resp.data) {
        this._impacts = new Map(this._impacts);
        this._impacts.set(resonanceId, resp.data);
      }
    } catch (err) {
      // Silent fallback — impacts panel renders empty. Panel is secondary
      // UI; not showing impacts shouldn't block resonance admin work.
      captureError(err, { source: 'AdminResonancesTab._loadImpacts', resonanceId });
    }
  }

  // ── Computed Filters ──────────────────────────────────

  private get _activeResonances(): Resonance[] {
    return this._resonances.filter((r) => !r.deleted_at && r.status !== 'archived');
  }

  private get _archivedResonances(): Resonance[] {
    return this._resonances.filter((r) => !r.deleted_at && r.status === 'archived');
  }

  private get _deletedResonances(): Resonance[] {
    return this._resonances.filter((r) => r.deleted_at);
  }

  private get _filteredResonances(): Resonance[] {
    let list: Resonance[];
    switch (this._view) {
      case 'active':
        list = this._activeResonances;
        break;
      case 'archived':
        list = this._archivedResonances;
        break;
      case 'trash':
        list = this._deletedResonances;
        break;
    }

    if (this._statusFilter !== 'all' && this._view === 'active') {
      list = list.filter((r) => r.status === this._statusFilter);
    }

    if (this._signatureFilter) {
      list = list.filter((r) => r.resonance_signature === this._signatureFilter);
    }

    if (this._search) {
      const q = this._search.toLowerCase();
      list = list.filter((r) => r.title.toLowerCase().includes(q));
    }

    return list;
  }

  // ── Actions ───────────────────────────────────────────

  private async _handleTransition(res: Resonance): Promise<void> {
    const next = STATUS_TRANSITIONS[res.status];
    if (!next) return;

    this._actionInProgress = res.id;
    try {
      const resp = await resonanceApi.updateStatus(res.id, next);
      if (resp.success) {
        VelgToast.success(msg(str`Status → ${next}`));
        await this._loadResonances();
      } else {
        VelgToast.error(resp.error?.message ?? msg('Transition failed'));
      }
    } catch (err) {
      captureError(err, { source: 'AdminResonancesTab._handleTransition', resonanceId: res.id });
      VelgToast.error(msg('An error occurred'));
    } finally {
      this._actionInProgress = null;
    }
  }

  private async _handleProcessImpact(res: Resonance): Promise<void> {
    const confirmed = await VelgConfirmDialog.show({
      title: msg('Process Impact'),
      message: msg(
        str`Process resonance "${res.title}" across all active simulations? This will spawn events.`,
      ),
      confirmLabel: msg('Process'),
    });
    if (!confirmed) return;

    this._actionInProgress = res.id;
    try {
      const resp = await resonanceApi.processImpact(res.id);
      if (resp.success) {
        const count = resp.data?.length ?? 0;
        VelgToast.success(msg(str`Impact processed: ${count} simulations affected`));
        await this._loadResonances();
        // Refresh impacts if expanded
        if (this._expandedId === res.id) {
          await this._loadImpacts(res.id);
        }
      } else {
        VelgToast.error(resp.error?.message ?? msg('Impact processing failed'));
      }
    } catch (err) {
      captureError(err, { source: 'AdminResonancesTab._handleProcessImpact', resonanceId: res.id });
      VelgToast.error(msg('An error occurred'));
    } finally {
      this._actionInProgress = null;
    }
  }

  private async _handleDelete(res: Resonance): Promise<void> {
    const confirmed = await VelgConfirmDialog.show({
      title: msg('Delete Resonance'),
      message: msg(str`Delete "${res.title}"? It can be restored from the trash.`),
      confirmLabel: msg('Delete'),
      variant: 'danger',
    });
    if (!confirmed) return;

    this._actionInProgress = res.id;
    try {
      const resp = await resonanceApi.remove(res.id);
      if (resp.success) {
        VelgToast.success(msg('Resonance deleted.'));
        await this._loadResonances();
      } else {
        VelgToast.error(resp.error?.message ?? msg('Failed to delete'));
      }
    } catch (err) {
      captureError(err, { source: 'AdminResonancesTab._handleDelete', resonanceId: res.id });
      VelgToast.error(msg('An error occurred'));
    } finally {
      this._actionInProgress = null;
    }
  }

  private async _handleRestore(res: Resonance): Promise<void> {
    this._actionInProgress = res.id;
    try {
      const resp = await resonanceApi.restore(res.id);
      if (resp.success) {
        VelgToast.success(msg('Resonance restored.'));
        await this._loadResonances();
      } else {
        VelgToast.error(resp.error?.message ?? msg('Failed to restore'));
      }
    } catch (err) {
      captureError(err, { source: 'AdminResonancesTab._handleRestore', resonanceId: res.id });
      VelgToast.error(msg('An error occurred'));
    } finally {
      this._actionInProgress = null;
    }
  }

  private _handleEdit(res: Resonance): void {
    this._editTarget = res;
    this._showFormModal = true;
  }

  private _handleCreate(): void {
    this._editTarget = null;
    this._showFormModal = true;
  }

  private async _handleFormSave(e: CustomEvent): Promise<void> {
    const detail = e.detail as { data: Record<string, unknown>; resonanceId?: string };
    try {
      const resp = detail.resonanceId
        ? await resonanceApi.update(detail.resonanceId, detail.data)
        : await resonanceApi.create(detail.data as never);
      if (resp.success) {
        VelgToast.success(
          detail.resonanceId ? msg('Resonance updated.') : msg('Resonance created.'),
        );
        this._showFormModal = false;
        this._editTarget = null;
        await this._loadResonances();
      } else {
        VelgToast.error(resp.error?.message ?? msg('Save failed'));
      }
    } catch (err) {
      captureError(err, {
        source: 'AdminResonancesTab._handleFormSave',
        resonanceId: detail.resonanceId ?? 'new',
      });
      VelgToast.error(msg('An error occurred'));
    }
  }

  private _handleFormClose(): void {
    this._showFormModal = false;
    this._editTarget = null;
  }

  private _toggleExpand(id: string): void {
    if (this._expandedId === id) {
      this._expandedId = null;
    } else {
      this._expandedId = id;
      if (!this._impacts.has(id)) {
        this._loadImpacts(id);
      }
    }
  }

  // ── Helpers ───────────────────────────────────────────

  private _magClass(mag: number): string {
    if (mag >= 0.7) return 'high';
    if (mag >= 0.4) return 'mid';
    return 'low';
  }

  private _countdown(isoStr: string): string {
    const diff = new Date(isoStr).getTime() - Date.now();
    if (diff <= 0) return msg('overdue');
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (hours > 48) return `${Math.floor(hours / 24)}d`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  }

  private _isPast(isoStr: string): boolean {
    return new Date(isoStr).getTime() <= Date.now();
  }

  // ── Render ────────────────────────────────────────────

  protected render() {
    return html`
      ${this._error ? html`<div class="error-banner">${this._error}</div>` : nothing}

      <div class="header">
        <div class="header__title">
          ${icons.substrateTremor(18)}
          ${msg('Substrate Resonances')}
          ${renderInfoBubble(msg('Substrate resonances are cross-simulation disturbances triggered by real-world events or manual creation. Each resonance follows a lifecycle: Detected (identified, not yet active) → Impacting (actively affecting simulations, spawning events) → Subsiding (fading, reduced effect) → Archived. Magnitude (0.0-1.0) determines the severity of impact across all affected simulations.'), 'tip-resonances-overview')}
        </div>
        <button class="header__create-btn" @click=${this._handleCreate}>
          + ${msg('Create Resonance')}
        </button>
      </div>

      <div class="view-toggle">
        <button
          class="view-toggle__btn ${this._view === 'active' ? 'view-toggle__btn--active' : ''}"
          @click=${() => this._switchView('active')}
        >
          ${msg('Active')}
          <span class="view-toggle__count">(${this._activeResonances.length})</span>
        </button>
        <button
          class="view-toggle__btn ${this._view === 'archived' ? 'view-toggle__btn--active' : ''}"
          @click=${() => this._switchView('archived')}
        >
          ${msg('Archived')}
          <span class="view-toggle__count">(${this._archivedResonances.length})</span>
        </button>
        <button
          class="view-toggle__btn ${this._view === 'trash' ? 'view-toggle__btn--active' : ''}"
          @click=${() => this._switchView('trash')}
        >
          ${msg('Trash')}
          <span class="view-toggle__count">(${this._deletedResonances.length})</span>
        </button>
      </div>

      <div class="filters">
        <input
          class="search-input"
          type="text"
          placeholder=${msg('Search resonances...')}
          .value=${this._search}
          @input=${(e: Event) => {
            this._search = (e.target as HTMLInputElement).value;
          }}
        />
        ${renderInfoBubble(msg('Filter by resonance title, description, or signature type. The search matches across all visible fields. Combine with status chips and signature dropdown for precise filtering.'), 'tip-resonance-search')}

        ${
          this._view === 'active'
            ? html`
          <div class="filter-chips">
            ${(['all', 'detected', 'impacting', 'subsiding'] as StatusFilter[]).map(
              (s) => html`
                <button
                  class="filter-chip ${this._statusFilter === s ? 'filter-chip--active' : ''}"
                  @click=${() => {
                    this._statusFilter = s;
                  }}
                >${s === 'all' ? msg('All') : s}</button>
              `,
            )}
          </div>
        `
            : nothing
        }

        <select
          class="sig-select"
          .value=${this._signatureFilter}
          @change=${(e: Event) => {
            this._signatureFilter = (e.target as HTMLSelectElement).value;
          }}
        >
          <option value="">${msg('All signatures')}</option>
          ${SIGNATURE_KEYS.map((key) => html`<option value=${key}>${signatureLabel(key)}</option>`)}
        </select>

        <span class="result-count">
          ${msg(str`${this._filteredResonances.length} results`)}
        </span>
      </div>

      ${
        this._loading
          ? html`<div class="loading-state">${msg('Scanning substrate...')}</div>`
          : this._renderList()
      }

      ${
        this._showFormModal
          ? html`
        <velg-admin-resonance-form-modal
          .resonance=${this._editTarget}
          @resonance-save=${this._handleFormSave}
          @modal-close=${this._handleFormClose}
        ></velg-admin-resonance-form-modal>
      `
          : nothing
      }
    `;
  }

  private _renderList() {
    const resonances = this._filteredResonances;
    if (resonances.length === 0) {
      return html`<div class="empty-state">${msg('No resonances found.')}</div>`;
    }

    return html`
      <div class="res-list">
        ${resonances.map((r) => this._renderRow(r))}
      </div>
    `;
  }

  private _renderRow(r: Resonance) {
    const magClass = this._magClass(r.magnitude);
    const isExpanded = this._expandedId === r.id;
    const isDeleted = !!r.deleted_at;

    return html`
      <div class="res-row ${isDeleted ? 'res-row--deleted' : ''} ${isExpanded ? 'res-row--expanded' : ''}">
        <div class="res-icon">
          ${icons.resonanceArchetype(r.resonance_signature, 20)}
        </div>

        <div class="res-info">
          <span class="res-title">${r.title}</span>
          <div class="res-subtitle">
            <span class="res-signature">${signatureLabel(r.resonance_signature)}</span>
            <span>${r.archetype}</span>
          </div>
        </div>

        <div class="magnitude">
          <div class="magnitude__bar">
            <div
              class="magnitude__fill magnitude__fill--${magClass}"
              style="width: ${r.magnitude * 100}%"
            ></div>
          </div>
          <span class="magnitude__value magnitude__value--${magClass}">
            ${r.magnitude.toFixed(2)}
          </span>
        </div>

        <span class="badge badge--${r.status}">${r.status}</span>

        <div class="res-meta">
          ${
            r.status === 'detected' || r.status === 'impacting'
              ? html`
            <div class="res-meta__countdown ${this._isPast(r.impacts_at) ? 'res-meta__countdown--past' : ''}">
              ${this._isPast(r.impacts_at) ? msg('overdue') : this._countdown(r.impacts_at)}
            </div>
          `
              : html`
            <div>${formatDate(r.updated_at, { fallback: '\u2014' })}</div>
          `
          }
        </div>

        <div class="res-actions">
          ${isDeleted ? this._renderTrashActions(r) : this._renderActiveActions(r)}
        </div>

        ${isExpanded ? this._renderImpactPanel(r.id) : nothing}
      </div>
    `;
  }

  private _renderActiveActions(r: Resonance) {
    const nextStatus = STATUS_TRANSITIONS[r.status];
    const disabled = this._actionInProgress === r.id;

    return html`
      ${
        nextStatus
          ? html`
        <button
          class="action-btn action-btn--transition"
          ?disabled=${disabled}
          @click=${() => this._handleTransition(r)}
          title=${msg(str`Transition to ${nextStatus}`)}
        >${nextStatus === 'impacting' ? msg('Impact') : nextStatus === 'subsiding' ? msg('Subside') : msg('Archive')}</button>
      `
          : nothing
      }

      ${
        r.status === 'detected' || r.status === 'impacting'
          ? html`
        <button
          class="action-btn action-btn--process"
          ?disabled=${disabled}
          @click=${() => this._handleProcessImpact(r)}
        >${msg('Process')}</button>
      `
          : nothing
      }

      <button
        class="action-btn"
        ?disabled=${disabled}
        @click=${() => this._toggleExpand(r.id)}
      >${this._expandedId === r.id ? msg('Close') : msg('Impacts')}</button>

      <button
        class="action-btn"
        ?disabled=${disabled}
        @click=${() => this._handleEdit(r)}
      >${msg('Edit')}</button>

      <button
        class="action-btn action-btn--danger"
        ?disabled=${disabled}
        @click=${() => this._handleDelete(r)}
      >${msg('Delete')}</button>
    `;
  }

  private _renderTrashActions(r: Resonance) {
    const disabled = this._actionInProgress === r.id;
    return html`
      <button
        class="action-btn action-btn--restore"
        ?disabled=${disabled}
        @click=${() => this._handleRestore(r)}
      >${msg('Restore')}</button>
    `;
  }

  private _renderImpactPanel(resonanceId: string) {
    const impacts = this._impacts.get(resonanceId);

    return html`
      <div class="impact-panel">
        <div class="impact-panel__header">${msg('Impact Records')}</div>
        ${
          !impacts
            ? html`<div class="impact-empty">${msg('Loading...')}</div>`
            : impacts.length === 0
              ? html`<div class="impact-empty">${msg('No impacts recorded yet.')}</div>`
              : impacts.map(
                  (imp) => html`
                <div class="impact-row">
                  <span class="impact-sim">${imp.simulation_name ?? `${imp.simulation_id.substring(0, 8)}...`}</span>
                  <span class="impact-mag">${imp.effective_magnitude.toFixed(2)}</span>
                  <span class="badge badge--${imp.status}">${imp.status}</span>
                  <span class="impact-events">${imp.spawned_event_ids?.length ?? 0} ${msg('events')}</span>
                </div>
              `,
                )
        }
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-admin-resonances-tab': VelgAdminResonancesTab;
  }
}
