/**
 * VelgContentDraftEditor — hybrid MVP editor for content drafts.
 *
 * Two modes, driven by the `draftId` / `createMode` properties:
 *
 *   edit:   parent sets `draftId` → fetches full draft → shows pack-aware
 *           entries list + per-entry JSON textarea. Save via PATCH with
 *           optimistic-concurrency version guard; 409 triggers refetch.
 *
 *   create: parent sets `createMode=true` → minimal form to pick pack_slug
 *           + resource_path + empty starting content. On submit, POST
 *           /admin/content-drafts and emit `draft-created` so the parent
 *           can swap to edit mode on the new row.
 *
 * The "pack-aware" part: `working_content` is assumed to be the full
 * resource object (e.g. `{schema_version: 1, banter: [...]}`). The editor
 * derives the collection-key from `resource_path` (e.g. "banter") and
 * renders each item in that array as a sidebar row; the selected row
 * renders as a JSON textarea on the right. Edits mutate an in-memory
 * working copy; "Save" PATCHes the whole working_content.
 *
 * Same-resource race warning: on open, calls listOpenForResource — if
 * OTHER open drafts exist on the same (pack_slug, resource_path), a
 * non-blocking banner with author_id abbreviations.
 *
 * Validation: piggybacks on PATCH 422 responses. Syntactic JSON errors
 * block save with an inline textarea marker.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type {
  ConflictPreview,
  ContentDraft,
  ContentDraftSummary,
} from '../../../services/api/ContentDraftsApiService.js';
import type { PackResourceManifest } from '../../../services/api/ContentPacksApiService.js';
import { contentDraftsApi, contentPacksApi } from '../../../services/api/index.js';
import { captureError } from '../../../services/SentryService.js';
import { icons } from '../../../utils/icons.js';
import '../../shared/LoadingState.js';
import '../../shared/ErrorState.js';
import '../../shared/VelgBadge.js';
import { VelgToast } from '../../shared/Toast.js';
import './VelgContentDraftConflictView.js';

/** Initial content for a blank-start draft (admin chose a resource that
 *  has no on-disk YAML yet OR explicitly opted for empty). Derives the
 *  collection-key from resource_path so the editor's _collection() lookup
 *  immediately finds an empty array to iterate. */
function seedContentFor(resourcePath: string): Record<string, unknown> {
  const key = resourcePath.split(/[.[]/)[0];
  if (!key) return { schema_version: 1 };
  return { schema_version: 1, [key]: [] };
}

@localized()
@customElement('velg-content-draft-editor')
export class VelgContentDraftEditor extends LitElement {
  static styles = css`
    :host {
      --_accent: var(--color-accent-amber);
      --_accent-dim: color-mix(in srgb, var(--color-accent-amber) 40%, transparent);
      --_accent-bg: color-mix(in srgb, var(--color-accent-amber) 10%, transparent);
      --_danger-bg: color-mix(in srgb, var(--color-danger) 10%, transparent);
      display: block;
      color: var(--color-text-primary);
      font-family: var(--font-mono, monospace);
      padding: var(--space-4) var(--space-5);
      background: var(--color-surface);
    }

    .head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--space-4);
      padding-bottom: var(--space-3);
      border-bottom: 1px dashed var(--color-border);
      margin-bottom: var(--space-4);
    }

    .head__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-md);
      text-transform: uppercase;
      letter-spacing: var(--tracking-widest);
      margin: 0 0 var(--space-1);
    }

    .head__sub {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      word-break: break-all;
    }

    .head__meta {
      display: flex;
      gap: var(--space-3);
      align-items: center;
    }

    .banner {
      padding: var(--space-3) var(--space-4);
      margin-bottom: var(--space-4);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      line-height: 1.55;
      border-left: 3px solid;
    }

    .banner--warn {
      background: color-mix(in srgb, var(--color-warning) 8%, transparent);
      border-left-color: var(--color-warning);
      color: var(--color-text-primary);
    }

    .banner--error {
      background: var(--_danger-bg);
      border-left-color: var(--color-danger);
      color: var(--color-text-primary);
    }

    .banner__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-widest);
      margin: 0 0 var(--space-1);
    }

    .banner__action {
      display: inline-block;
      margin-top: var(--space-1-5);
      font-family: var(--font-brutalist);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      padding: 4px 10px;
      background: transparent;
      color: var(--color-text-primary);
      border: 1px solid var(--color-border);
      cursor: pointer;
      transition: all var(--transition-fast);
    }
    .banner__action:hover { border-color: var(--_accent); color: var(--_accent); }

    /* Layout: sidebar + editor */
    .split {
      display: grid;
      grid-template-columns: minmax(200px, 280px) 1fr;
      gap: var(--space-4);
      min-height: 400px;
    }

    .sidebar {
      border: 1px solid var(--color-border-light);
      background: var(--color-surface-sunken);
      overflow-y: auto;
      max-height: 560px;
    }

    .sidebar__header {
      padding: var(--space-2) var(--space-3);
      border-bottom: 1px solid var(--color-border);
      font-family: var(--font-brutalist);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-widest);
      color: var(--color-text-muted);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
    }

    .add-btn {
      font-family: var(--font-brutalist);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      padding: 2px 6px;
      background: transparent;
      color: var(--_accent);
      border: 1px solid var(--_accent-dim);
      cursor: pointer;
      transition: all var(--transition-fast);
    }
    .add-btn:hover { background: var(--_accent-bg); }

    .entry-list { list-style: none; margin: 0; padding: 0; }
    .entry-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      border-bottom: 1px solid var(--color-border-light);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      cursor: pointer;
      transition: background var(--transition-fast);
    }
    .entry-row:hover { background: color-mix(in srgb, var(--_accent) 4%, transparent); }
    .entry-row--active {
      background: var(--_accent-bg);
      color: var(--_accent);
      border-left: 3px solid var(--_accent);
      padding-left: calc(var(--space-3) - 3px);
    }
    .entry-row__label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
    }
    .entry-row__remove {
      background: transparent;
      border: none;
      color: var(--color-text-muted);
      cursor: pointer;
      padding: 0;
      width: 18px;
      height: 18px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .entry-row__remove:hover { color: var(--color-danger); }

    .editor {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .editor__label {
      font-family: var(--font-brutalist);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-widest);
      color: var(--color-text-muted);
    }

    .editor__textarea {
      flex: 1;
      width: 100%;
      min-height: 320px;
      padding: var(--space-3);
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      line-height: 1.5;
      background: var(--color-surface-sunken);
      color: var(--color-text-primary);
      border: 1px solid var(--color-border);
      resize: vertical;
      box-sizing: border-box;
      tab-size: 2;
    }
    .editor__textarea:focus {
      outline: none;
      border-color: var(--_accent);
      box-shadow: 0 0 0 2px var(--_accent-dim);
    }
    .editor__textarea[data-invalid='true'] {
      border-color: var(--color-danger);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-danger) 30%, transparent);
    }
    .editor__textarea[readonly] {
      background: color-mix(in srgb, var(--color-surface-sunken) 70%, transparent);
      color: var(--color-text-secondary);
      cursor: default;
    }

    .editor__parse-error {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-danger);
      padding: var(--space-1) var(--space-2);
      background: var(--_danger-bg);
      border-left: 2px solid var(--color-danger);
    }

    .editor__empty {
      text-align: center;
      padding: var(--space-8) var(--space-4);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      border: 1px dashed var(--color-border-light);
    }

    /* Footer — save / cancel */
    .footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      margin-top: var(--space-5);
      padding-top: var(--space-4);
      border-top: 1px dashed var(--color-border);
    }
    .footer__hint {
      font-family: var(--font-mono);
      font-size: 10px;
      color: var(--color-text-muted);
    }
    .footer__actions { display: flex; gap: var(--space-2); }

    .btn {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      padding: var(--space-2) var(--space-4);
      background: transparent;
      color: var(--color-text-primary);
      border: 1px solid var(--color-border);
      cursor: pointer;
      transition: all var(--transition-fast);
    }
    .btn:hover:not(:disabled) { border-color: var(--_accent); color: var(--_accent); }
    .btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn--primary {
      background: var(--_accent);
      color: var(--color-surface);
      border-color: var(--_accent);
    }
    .btn--primary:hover:not(:disabled) {
      background: var(--color-accent-amber-hover, var(--_accent));
      color: var(--color-surface);
    }

    /* Create form */
    .create-form {
      display: grid;
      gap: var(--space-4);
      max-width: 600px;
    }
    .field { display: grid; gap: var(--space-1-5); }
    .field__label {
      font-family: var(--font-brutalist);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-widest);
      color: var(--color-text-muted);
    }
    .field__control,
    .field select,
    .field input[type='text'] {
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      padding: var(--space-2) var(--space-3);
      background: var(--color-surface-sunken);
      color: var(--color-text-primary);
      border: 1px solid var(--color-border);
    }
    .field__control:focus,
    .field select:focus,
    .field input:focus {
      outline: none;
      border-color: var(--_accent);
      box-shadow: 0 0 0 2px var(--_accent-dim);
    }
    .field__hint {
      font-family: var(--font-mono);
      font-size: 10px;
      color: var(--color-text-muted);
    }

    @media (max-width: 768px) {
      .split { grid-template-columns: 1fr; }
      .sidebar { max-height: 220px; }
    }

    @media (prefers-reduced-motion: reduce) {
      .btn, .entry-row { transition: none; }
    }
  `;

  /** When set, the editor fetches and edits that draft. */
  @property({ type: String, attribute: 'draft-id' })
  draftId: string | null = null;

  /** When true, the editor shows the create form instead of fetching. */
  @property({ type: Boolean, attribute: 'create-mode' })
  createMode = false;

  @state() private _loading = false;
  @state() private _error: string | null = null;
  @state() private _draft: ContentDraft | null = null;
  @state() private _working: Record<string, unknown> | null = null;
  @state() private _selectedEntryKey: string | number | null = null;
  @state() private _textareaValue = '';
  @state() private _parseError: string | null = null;
  @state() private _saving = false;
  @state() private _staleVersion = false;
  @state() private _sameResourceOthers: ContentDraftSummary[] = [];

  // Conflict-resolution state (Phase 5). When the loaded draft is in
  // 'conflict' status, we fetch a server-computed 3-way merge preview and
  // render <velg-content-draft-conflict-view> instead of the hybrid editor.
  @state() private _conflictPreview: ConflictPreview | null = null;
  @state() private _conflictLoading = false;
  @state() private _conflictError: string | null = null;
  @state() private _resolvingConflict = false;

  // Create-form state
  @state() private _manifest: PackResourceManifest[] | null = null;
  @state() private _manifestLoading = false;
  @state() private _manifestError: string | null = null;
  @state() private _newPackSlug = '';
  @state() private _newResourcePath = '';
  @state() private _newPreloadFromDisk = true;
  @state() private _creating = false;

  /**
   * Terminal statuses (abandoned / published / merged) lock the editor
   * into view-only mode. Admins can still open these rows for audit but
   * cannot mutate working_content — publishing is a no-op (state machine
   * would reject transition) and edits would be wasted effort.
   *
   * Active statuses (draft / conflict) remain fully editable — conflict
   * still accepts working edits because the next publish attempt surfaces
   * whichever resolution the admin saves.
   */
  private get _readOnly(): boolean {
    if (!this._draft) return false;
    const s = this._draft.status;
    return s === 'abandoned' || s === 'published' || s === 'merged';
  }

  willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('draftId') && this.draftId && !this.createMode) {
      void this._loadDraft(this.draftId);
    }
    if (changed.has('createMode') && this.createMode) {
      this._resetForCreate();
      void this._loadManifest();
    }
  }

  private _resetForCreate(): void {
    this._draft = null;
    this._working = null;
    this._selectedEntryKey = null;
    this._textareaValue = '';
    this._parseError = null;
    this._staleVersion = false;
    this._sameResourceOthers = [];
    this._error = null;
    this._newPackSlug = '';
    this._newResourcePath = '';
    this._newPreloadFromDisk = true;
  }

  /** Fetch the pack-resource manifest for the cascading create-form selector. */
  private async _loadManifest(): Promise<void> {
    if (this._manifest || this._manifestLoading) return;
    this._manifestLoading = true;
    this._manifestError = null;
    try {
      const response = await contentPacksApi.listManifest();
      if (response.success) {
        this._manifest = response.data;
      } else {
        this._manifestError =
          response.error?.message ?? msg('Failed to load content-pack catalog.');
      }
    } catch (err) {
      captureError(err, { source: 'VelgContentDraftEditor._loadManifest' });
      this._manifestError =
        err instanceof Error ? err.message : msg('Failed to load content-pack catalog.');
    } finally {
      this._manifestLoading = false;
    }
  }

  /** Ordered unique pack slugs from the manifest. */
  private _manifestPackSlugs(): string[] {
    if (!this._manifest) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const row of this._manifest) {
      if (!seen.has(row.pack_slug)) {
        seen.add(row.pack_slug);
        out.push(row.pack_slug);
      }
    }
    return out;
  }

  /** Resources for the selected pack (empty when no pack picked). */
  private _manifestResourcesForPack(packSlug: string): PackResourceManifest[] {
    if (!this._manifest || !packSlug) return [];
    return this._manifest.filter((r) => r.pack_slug === packSlug);
  }

  /** Manifest entry for the currently-selected (pack, resource) tuple, or undefined. */
  private _selectedResourceRow(): PackResourceManifest | undefined {
    if (!this._manifest || !this._newPackSlug || !this._newResourcePath) return undefined;
    return this._manifest.find(
      (r) => r.pack_slug === this._newPackSlug && r.resource_path === this._newResourcePath,
    );
  }

  private async _loadDraft(id: string): Promise<void> {
    this._loading = true;
    this._error = null;
    this._parseError = null;
    this._staleVersion = false;
    this._conflictPreview = null;
    this._conflictError = null;
    try {
      const response = await contentDraftsApi.getDraft(id);
      if (!response.success) {
        this._error = response.error?.message ?? msg('Failed to load draft.');
        this._loading = false;
        return;
      }
      this._draft = response.data;
      this._working = structuredClone(response.data.working_content);
      // Pick a default entry — first key in the pack-collection.
      this._selectedEntryKey = this._firstEntryKey();
      this._textareaValue = this._serializeSelected();
      // Fire the race check in parallel — non-blocking.
      void this._loadSameResourceWarning(
        response.data.pack_slug,
        response.data.resource_path,
        response.data.id,
      );
      // Phase 5: conflict drafts need a server-computed merge preview.
      // Fetched sequentially after the draft itself so render() can branch
      // cleanly on (draft.status === 'conflict' && _conflictPreview) — the
      // brief window where status is 'conflict' but preview is still
      // loading shows the dedicated _conflictLoading indicator.
      if (response.data.status === 'conflict') {
        await this._loadConflictPreview(id);
      }
    } catch (err) {
      captureError(err, { source: 'VelgContentDraftEditor._loadDraft' });
      this._error = err instanceof Error ? err.message : msg('Failed to load draft.');
    } finally {
      this._loading = false;
    }
  }

  private async _loadConflictPreview(id: string): Promise<void> {
    this._conflictLoading = true;
    this._conflictError = null;
    try {
      const response = await contentDraftsApi.getConflictPreview(id);
      if (!response.success) {
        this._conflictError = response.error?.message ?? msg('Failed to load conflict preview.');
        return;
      }
      this._conflictPreview = response.data;
    } catch (err) {
      captureError(err, {
        source: 'VelgContentDraftEditor._loadConflictPreview',
      });
      this._conflictError =
        err instanceof Error ? err.message : msg('Failed to load conflict preview.');
    } finally {
      this._conflictLoading = false;
    }
  }

  private async _handleResolveSubmit(
    event: CustomEvent<{
      merged_working_content: Record<string, unknown>;
      acknowledged_conflict_paths: string[];
      version: number;
    }>,
  ): Promise<void> {
    if (!this._draft) return;
    this._resolvingConflict = true;
    try {
      const response = await contentDraftsApi.resolveConflict(this._draft.id, {
        merged_working_content: event.detail.merged_working_content,
        version: event.detail.version,
        acknowledged_conflict_paths: event.detail.acknowledged_conflict_paths,
      });
      if (!response.success) {
        VelgToast.error(response.error?.message ?? msg('Failed to resolve conflict.'));
        return;
      }
      VelgToast.success(msg('Conflict resolved; draft returned to edit mode.'));
      // Reload: draft is now status='draft', working_content is the merged
      // tree, and the hybrid editor takes over.
      await this._loadDraft(this._draft.id);
      // `draft-saved` is the existing contract for "a draft row mutated,
      // refresh the list". The wrapper's `_handleDraftSaved` already wires
      // this to `list.refresh()` (see VelgAdminContentDraftsTab).
      if (this._draft) {
        this.dispatchEvent(
          new CustomEvent('draft-saved', {
            bubbles: true,
            composed: true,
            detail: { draft: this._draft },
          }),
        );
      }
    } catch (err) {
      captureError(err, {
        source: 'VelgContentDraftEditor._handleResolveSubmit',
      });
      VelgToast.error(err instanceof Error ? err.message : msg('Failed to resolve conflict.'));
    } finally {
      this._resolvingConflict = false;
    }
  }

  /**
   * Bubble the resolve-cancel as `editor-close` so the wrapper's existing
   * dirty-check prompt (or direct close, since conflict view has no unsaved
   * working edits — see `hasUnsavedChanges()`) handles panel dismissal
   * uniformly.
   */
  private _handleResolveCancel(): void {
    this.dispatchEvent(new CustomEvent('editor-close', { bubbles: true, composed: true }));
  }

  private async _loadSameResourceWarning(
    packSlug: string,
    resourcePath: string,
    selfId: string,
  ): Promise<void> {
    try {
      const response = await contentDraftsApi.listOpenForResource(packSlug, resourcePath);
      if (response.success) {
        this._sameResourceOthers = response.data.filter((d) => d.id !== selfId);
      }
    } catch (err) {
      captureError(err, {
        source: 'VelgContentDraftEditor._loadSameResourceWarning',
      });
    }
  }

  /**
   * Collection key derived from resource_path. For `banter` → "banter".
   * Returns null when working_content has no matching array/object.
   */
  private _collectionKey(): string | null {
    if (!this._draft) return null;
    const key = this._draft.resource_path.split(/[.[]/)[0];
    if (!key) return null;
    const content = this._working;
    if (content && key in content) return key;
    return null;
  }

  private _collection(): unknown[] | Record<string, unknown> | null {
    const key = this._collectionKey();
    if (!key || !this._working) return null;
    const value = this._working[key];
    if (Array.isArray(value)) return value as unknown[];
    if (value && typeof value === 'object') return value as Record<string, unknown>;
    return null;
  }

  private _entryKeys(): Array<string | number> {
    const c = this._collection();
    if (c === null) return [];
    if (Array.isArray(c)) return c.map((_, i) => i);
    return Object.keys(c);
  }

  private _firstEntryKey(): string | number | null {
    const keys = this._entryKeys();
    return keys.length > 0 ? keys[0] : null;
  }

  private _entryAt(key: string | number): unknown {
    const c = this._collection();
    if (c === null) return null;
    if (Array.isArray(c)) return c[key as number];
    return c[key as string];
  }

  private _serializeSelected(): string {
    if (this._selectedEntryKey === null) return '';
    const v = this._entryAt(this._selectedEntryKey);
    return JSON.stringify(v ?? null, null, 2);
  }

  private _labelFor(key: string | number): string {
    if (typeof key === 'number') {
      const v = this._entryAt(key);
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        const id = (v as Record<string, unknown>).id;
        if (typeof id === 'string') return id;
      }
      return `[${key}]`;
    }
    return key;
  }

  private _selectEntry(key: string | number): void {
    if (this._selectedEntryKey === key) return;
    // Persist any staged edits back to _working before switching.
    this._commitTextareaIfValid();
    this._selectedEntryKey = key;
    this._textareaValue = this._serializeSelected();
    this._parseError = null;
  }

  private _handleTextareaInput(e: Event): void {
    this._textareaValue = (e.target as HTMLTextAreaElement).value;
    this._parseError = null;
  }

  /** Commit the textarea JSON into _working at the selected entry. No save. */
  private _commitTextareaIfValid(): boolean {
    if (this._selectedEntryKey === null) return true;
    if (!this._working) return false;
    let parsed: unknown;
    try {
      parsed = JSON.parse(this._textareaValue);
    } catch (err) {
      this._parseError = err instanceof Error ? err.message : msg('Invalid JSON.');
      return false;
    }
    const key = this._collectionKey();
    if (!key) return false;
    const collection = this._working[key];
    if (Array.isArray(collection)) {
      collection[this._selectedEntryKey as number] = parsed;
    } else if (collection && typeof collection === 'object') {
      (collection as Record<string, unknown>)[this._selectedEntryKey as string] = parsed;
    }
    this._parseError = null;
    return true;
  }

  private _handleAddEntry(): void {
    if (!this._working) return;
    const key = this._collectionKey();
    if (!key) return;
    const collection = this._working[key];
    if (Array.isArray(collection)) {
      const nextIndex = collection.length;
      collection.push({});
      this._working = { ...this._working };
      this._selectedEntryKey = nextIndex;
      this._textareaValue = JSON.stringify({}, null, 2);
      this._parseError = null;
    } else if (collection && typeof collection === 'object') {
      const newKey = `new_entry_${Object.keys(collection).length + 1}`;
      (collection as Record<string, unknown>)[newKey] = {};
      this._working = { ...this._working };
      this._selectedEntryKey = newKey;
      this._textareaValue = JSON.stringify({}, null, 2);
      this._parseError = null;
    }
  }

  private _handleRemoveEntry(key: string | number, e: Event): void {
    e.stopPropagation();
    if (!this._working) return;
    const ck = this._collectionKey();
    if (!ck) return;
    const collection = this._working[ck];
    if (Array.isArray(collection)) {
      collection.splice(key as number, 1);
      // Re-index selection for the array case: if we removed the selected
      // entry, or an index BEFORE it, the current _selectedEntryKey is
      // either out of bounds or points to the wrong logical entry.
      const removedIndex = key as number;
      const selected = this._selectedEntryKey;
      if (typeof selected === 'number') {
        if (selected === removedIndex) {
          this._selectedEntryKey = this._firstEntryKey();
          this._textareaValue = this._serializeSelected();
          this._parseError = null;
        } else if (selected > removedIndex) {
          // Shift the selection index down by 1 so it still points at the
          // same logical entry as before the splice.
          this._selectedEntryKey = selected - 1;
          this._textareaValue = this._serializeSelected();
          this._parseError = null;
        }
      }
    } else if (collection && typeof collection === 'object') {
      delete (collection as Record<string, unknown>)[key as string];
      if (this._selectedEntryKey === key) {
        this._selectedEntryKey = this._firstEntryKey();
        this._textareaValue = this._serializeSelected();
        this._parseError = null;
      }
    }
    this._working = { ...this._working };
  }

  private async _handleSave(): Promise<void> {
    if (!this._draft || !this._working) return;
    // Defensive: read-only state should have hidden the Save button
    // already, but guard against programmatic triggers (Realtime-driven
    // status flip during editing, devtools console, etc.).
    if (this._readOnly) return;
    if (!this._commitTextareaIfValid()) {
      VelgToast.error(msg('Fix JSON parse error before saving.'));
      return;
    }
    this._saving = true;
    try {
      const response = await contentDraftsApi.updateWorking(this._draft.id, {
        working_content: this._working,
        version: this._draft.version,
      });
      if (response.success) {
        this._draft = response.data;
        this._working = structuredClone(response.data.working_content);
        this._textareaValue = this._serializeSelected();
        this._staleVersion = false;
        VelgToast.success(msg('Draft saved.'));
        this.dispatchEvent(
          new CustomEvent('draft-saved', {
            detail: { draft: response.data },
            bubbles: true,
            composed: true,
          }),
        );
      } else if (response.error?.code === 'HTTP_409') {
        this._staleVersion = true;
        VelgToast.warning(msg('Another admin saved this draft. Reload to see the latest version.'));
      } else {
        VelgToast.error(response.error?.message ?? msg('Save failed.'));
      }
    } catch (err) {
      captureError(err, { source: 'VelgContentDraftEditor._handleSave' });
      VelgToast.error(err instanceof Error ? err.message : msg('Save failed.'));
    } finally {
      this._saving = false;
    }
  }

  private async _handleReload(): Promise<void> {
    if (!this._draft) return;
    await this._loadDraft(this._draft.id);
  }

  /**
   * Compare the in-memory working copy (with staged textarea content folded
   * in when it parses) against the last-known server state.
   *
   * Public so the wrapper can gate BOTH close paths — the editor's own
   * Cancel button AND the side-panel backdrop/Esc close — through the same
   * dirty-check prompt.
   */
  hasUnsavedChanges(): boolean {
    if (!this._draft || !this._working) return false;
    // Conflict view has no in-progress textarea edits — per-entry choices
    // are committed on click, and the server-computed merged tree is the
    // source of truth until the admin submits. No prompt needed on close.
    if (this._draft.status === 'conflict') return false;
    // Build a hypothetical "working if textarea committed" snapshot so the
    // dirty check reflects what the user sees, not just what's been committed
    // on entry-switch.
    let snapshot = this._working;
    if (this._selectedEntryKey !== null) {
      try {
        const parsed = JSON.parse(this._textareaValue);
        const key = this._collectionKey();
        if (key) {
          const cloned = structuredClone(this._working);
          const coll = cloned[key];
          if (Array.isArray(coll)) {
            coll[this._selectedEntryKey as number] = parsed;
          } else if (coll && typeof coll === 'object') {
            (coll as Record<string, unknown>)[this._selectedEntryKey as string] = parsed;
          }
          snapshot = cloned;
        }
      } catch (err) {
        captureError(err, {
          source: 'VelgContentDraftEditor._hasUnsavedChanges',
        });
        // Parse failure means dirty (or the textarea is garbage, but either
        // way the user has an active unsaved edit).
        return true;
      }
    }
    return JSON.stringify(snapshot) !== JSON.stringify(this._draft.working_content);
  }

  /**
   * Emit editor-close; the parent wrapper is responsible for running the
   * dirty-check prompt (see `hasUnsavedChanges()`). Keeping the prompt at
   * the wrapper layer unifies the Cancel-button path with the side-panel
   * backdrop/Esc path — both now flow through a single confirmation.
   */
  private _handleClose(): void {
    this.dispatchEvent(new CustomEvent('editor-close', { bubbles: true, composed: true }));
  }

  /* ── Create-mode handlers ───────────────────── */

  private async _handleCreate(): Promise<void> {
    const packSlug = this._newPackSlug;
    const resourcePath = this._newResourcePath;
    if (!packSlug || !resourcePath) {
      VelgToast.error(msg('Select a pack and resource first.'));
      return;
    }
    this._creating = true;
    try {
      // Seed preference: current on-disk YAML when the resource exists and
      // preload is checked; otherwise fall back to an empty collection
      // scaffold so the editor can still open with a usable shape.
      let baseContent: Record<string, unknown>;
      if (this._newPreloadFromDisk && this._selectedResourceRow()) {
        const readResp = await contentPacksApi.getResource(packSlug, resourcePath);
        if (!readResp.success) {
          VelgToast.error(readResp.error?.message ?? msg('Failed to read existing pack content.'));
          this._creating = false;
          return;
        }
        baseContent = readResp.data.content;
      } else {
        baseContent = seedContentFor(resourcePath);
      }

      const response = await contentDraftsApi.createDraft({
        pack_slug: packSlug,
        resource_path: resourcePath,
        base_content: baseContent,
        // Start working_content as an identical deep-copy so the first
        // render has the same structure; edits diverge from there.
        working_content: structuredClone(baseContent),
      });
      if (response.success) {
        VelgToast.success(msg('Draft created.'));
        this.dispatchEvent(
          new CustomEvent('draft-created', {
            detail: { id: response.data.id },
            bubbles: true,
            composed: true,
          }),
        );
      } else {
        VelgToast.error(response.error?.message ?? msg('Create failed.'));
      }
    } catch (err) {
      captureError(err, { source: 'VelgContentDraftEditor._handleCreate' });
      VelgToast.error(err instanceof Error ? err.message : msg('Create failed.'));
    } finally {
      this._creating = false;
    }
  }

  /* ── Render ─────────────────────────────────── */

  protected render(): TemplateResult {
    if (this.createMode) return this._renderCreateForm();
    if (this._loading) {
      return html`<velg-loading-state message=${msg('Loading draft...')}></velg-loading-state>`;
    }
    if (this._error) {
      return html`
        <velg-error-state
          message=${this._error}
          show-retry
          @retry=${() => this.draftId && this._loadDraft(this.draftId)}
        ></velg-error-state>
      `;
    }
    if (!this._draft) {
      return html`
        <div class="editor__empty">${msg('Select a draft to edit.')}</div>
      `;
    }
    // Phase 5: conflict drafts route to the 3-column resolution view
    // instead of the hybrid editor. The server's 3-way merge preview is
    // the source of truth for the admin's decisions.
    if (this._draft.status === 'conflict') {
      return this._renderConflictBranch();
    }
    return this._renderEditor();
  }

  private _renderConflictBranch(): TemplateResult {
    if (this._conflictLoading) {
      return html`<velg-loading-state
        message=${msg('Computing merge preview...')}
      ></velg-loading-state>`;
    }
    if (this._conflictError) {
      return html`
        <velg-error-state
          message=${this._conflictError}
          show-retry
          @retry=${() => this._draft && this._loadConflictPreview(this._draft.id)}
        ></velg-error-state>
      `;
    }
    if (!this._conflictPreview) {
      return html`<velg-loading-state
        message=${msg('Computing merge preview...')}
      ></velg-loading-state>`;
    }
    return html`
      <velg-content-draft-conflict-view
        .preview=${this._conflictPreview}
        ?submitting=${this._resolvingConflict}
        @resolve-submit=${this._handleResolveSubmit}
        @resolve-cancel=${this._handleResolveCancel}
      ></velg-content-draft-conflict-view>
    `;
  }

  private _renderEditor(): TemplateResult {
    const draft = this._draft;
    if (!draft) return html``;
    // No close button in the head — the side-panel provides the canonical
    // close affordance (X top-right), and the footer carries an explicit
    // Cancel. Two redundant close buttons only cluttered the head row
    // (see playtest bug #5).
    return html`
      <div class="head">
        <div>
          <h2 class="head__title">${draft.pack_slug} / ${draft.resource_path}</h2>
          <div class="head__sub">
            ${msg(str`v${draft.version} · opened ${this._fmt(draft.created_at)}`)}
          </div>
        </div>
        <div class="head__meta">
          <velg-badge variant=${this._badgeVariant(draft.status)}>
            ${draft.status}
          </velg-badge>
        </div>
      </div>

      ${
        this._readOnly
          ? html`
            <div class="banner banner--warn">
              <p class="banner__title">${msg('View-only draft')}</p>
              ${this._readOnlyReason(draft.status)}
            </div>
          `
          : nothing
      }
      ${
        this._staleVersion
          ? html`
            <div class="banner banner--error">
              <p class="banner__title">${msg('Stale version')}</p>
              ${msg('Another admin saved this draft. Reload to see the latest.')}
              <button class="banner__action" @click=${this._handleReload}>
                ${msg('Reload')}
              </button>
            </div>
          `
          : nothing
      }
      ${
        this._sameResourceOthers.length > 0
          ? html`
            <div class="banner banner--warn">
              <p class="banner__title">${msg('Concurrent edit')}</p>
              ${msg(
                str`${this._sameResourceOthers.length} other open draft(s) target this resource. Check with the other authors before saving.`,
              )}
            </div>
          `
          : nothing
      }

      <div class="split">
        <aside class="sidebar" aria-label=${msg('Entries')}>
          <div class="sidebar__header">
            <span>${this._collectionKey() ?? msg('Entries')}</span>
            ${
              this._collectionKey() && !this._readOnly
                ? html`
                  <button
                    class="add-btn"
                    @click=${this._handleAddEntry}
                    aria-label=${msg('Add new entry')}
                  >
                    + ${msg('Add')}
                  </button>
                `
                : nothing
            }
          </div>
          <ul class="entry-list">
            ${this._entryKeys().map(
              (k) => html`
                <li
                  class="entry-row ${this._selectedEntryKey === k ? 'entry-row--active' : ''}"
                  @click=${() => this._selectEntry(k)}
                  @keydown=${(e: KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      this._selectEntry(k);
                    }
                  }}
                  tabindex="0"
                  role="button"
                  aria-label=${msg(str`Edit entry ${this._labelFor(k)}`)}
                >
                  <span class="entry-row__label">${this._labelFor(k)}</span>
                  ${
                    this._readOnly
                      ? nothing
                      : html`
                        <button
                          class="entry-row__remove"
                          @click=${(e: Event) => this._handleRemoveEntry(k, e)}
                          aria-label=${msg(str`Remove entry ${this._labelFor(k)}`)}
                        >
                          ${icons.close(12)}
                        </button>
                      `
                  }
                </li>
              `,
            )}
          </ul>
        </aside>

        <div class="editor">
          ${
            this._selectedEntryKey === null
              ? html`<div class="editor__empty">${msg('No entries yet. Click "Add" to start.')}</div>`
              : html`
                <label class="editor__label">
                  ${msg(str`JSON for ${this._labelFor(this._selectedEntryKey)}`)}
                </label>
                <textarea
                  class="editor__textarea"
                  data-invalid=${this._parseError !== null ? 'true' : 'false'}
                  .value=${this._textareaValue}
                  spellcheck="false"
                  ?readonly=${this._readOnly}
                  aria-label=${msg('Entry JSON editor')}
                  aria-invalid=${this._parseError !== null ? 'true' : 'false'}
                  aria-readonly=${this._readOnly ? 'true' : 'false'}
                  aria-describedby=${this._parseError !== null ? 'entry-parse-error' : nothing}
                  @input=${this._handleTextareaInput}
                ></textarea>
                ${
                  this._parseError
                    ? html`<div id="entry-parse-error" class="editor__parse-error" role="alert">${this._parseError}</div>`
                    : nothing
                }
              `
          }
        </div>
      </div>

      <div class="footer">
        <span class="footer__hint">
          ${
            this._readOnly
              ? msg('Read-only. This draft cannot be mutated from its current status.')
              : msg('Saves working copy only. Publish a batch to open a PR.')
          }
        </span>
        <div class="footer__actions">
          <button class="btn" @click=${this._handleClose} ?disabled=${this._saving}>
            ${this._readOnly ? msg('Close') : msg('Cancel')}
          </button>
          ${
            this._readOnly
              ? nothing
              : html`
                <button
                  class="btn btn--primary"
                  @click=${this._handleSave}
                  ?disabled=${this._saving || this._staleVersion}
                >
                  ${this._saving ? msg('Saving...') : msg('Save draft')}
                </button>
              `
          }
        </div>
      </div>
    `;
  }

  /** Localized reason banner for the read-only lock. */
  private _readOnlyReason(status: string) {
    switch (status) {
      case 'abandoned':
        return msg(
          'This draft was abandoned. View-only for audit – create a fresh draft to continue work.',
        );
      case 'published':
        return msg(
          'This draft is attached to an open PR. Edits must happen either via closing the PR (reverts to draft) or through a new draft.',
        );
      case 'merged':
        return msg('This draft has been merged into main. Edit the resource through a new draft.');
      default:
        return msg('This draft is not currently editable.');
    }
  }

  private _renderCreateForm(): TemplateResult {
    const packSlugs = this._manifestPackSlugs();
    const resourceRows = this._manifestResourcesForPack(this._newPackSlug);
    const selectedRow = this._selectedResourceRow();
    const createDisabled = this._creating || !this._newPackSlug || !this._newResourcePath;

    // Drop the H2 title — the side-panel header already reads "New
    // Content Draft", duplicating it here was playtest bug #2. Keep the
    // sub text as a lead-in instruction. Close button also removed: the
    // side-panel X + footer Cancel both close already (bug #5).
    return html`
      <div class="head">
        <div class="head__sub">
          ${msg('Pick a pack and resource to start editing.')}
        </div>
      </div>

      ${
        this._manifestLoading
          ? html`<velg-loading-state
            message=${msg('Loading content-pack catalog...')}
          ></velg-loading-state>`
          : this._manifestError
            ? html`
              <velg-error-state
                message=${this._manifestError}
                show-retry
                @retry=${this._loadManifest}
              ></velg-error-state>
            `
            : html`
              <div class="create-form">
                <div class="field">
                  <label class="field__label" for="pack-slug-select">
                    ${msg('Pack')}
                  </label>
                  <select
                    id="pack-slug-select"
                    class="field__control"
                    .value=${this._newPackSlug}
                    @change=${(e: Event) => {
                      this._newPackSlug = (e.target as HTMLSelectElement).value;
                      this._newResourcePath = '';
                    }}
                  >
                    <option value="" disabled>
                      ${msg('Select a pack...')}
                    </option>
                    ${packSlugs.map((slug) => html`<option value=${slug}>${slug}</option>`)}
                  </select>
                  <div class="field__hint">
                    ${msg('Content pack directory under content/dungeon/archetypes/.')}
                  </div>
                </div>

                <div class="field">
                  <label class="field__label" for="resource-path-select">
                    ${msg('Resource')}
                  </label>
                  <select
                    id="resource-path-select"
                    class="field__control"
                    .value=${this._newResourcePath}
                    ?disabled=${!this._newPackSlug}
                    @change=${(e: Event) => {
                      this._newResourcePath = (e.target as HTMLSelectElement).value;
                    }}
                  >
                    <option value="" disabled>
                      ${this._newPackSlug ? msg('Select a resource...') : msg('Pick a pack first')}
                    </option>
                    ${resourceRows.map(
                      (row) => html`
                        <option value=${row.resource_path}>
                          ${row.resource_path}
                          ${row.entry_count >= 0 ? ` (${row.entry_count})` : ''}
                        </option>
                      `,
                    )}
                  </select>
                  <div class="field__hint">
                    ${msg('YAML file under the selected pack. Count shows current entry total.')}
                  </div>
                </div>

                ${
                  selectedRow
                    ? html`
                      <div class="banner banner--warn">
                        <p class="banner__title">${msg('Selected')}</p>
                        ${msg(
                          str`${selectedRow.file_path} — ${selectedRow.entry_count >= 0 ? selectedRow.entry_count : '?'} entries on disk.`,
                        )}
                      </div>
                      <div class="field">
                        <label
                          class="field__label"
                          style="display:flex;align-items:center;gap:var(--space-2);cursor:pointer;"
                          for="preload-checkbox"
                        >
                          <input
                            id="preload-checkbox"
                            type="checkbox"
                            .checked=${this._newPreloadFromDisk}
                            @change=${(e: Event) => {
                              this._newPreloadFromDisk = (e.target as HTMLInputElement).checked;
                            }}
                          />
                          ${msg('Load current disk content into the draft')}
                        </label>
                        <div class="field__hint">
                          ${msg(
                            'Recommended. Unchecked means the draft starts empty — use only when adding a brand-new resource.',
                          )}
                        </div>
                      </div>
                    `
                    : nothing
                }

                <div class="footer" style="margin-top:0;padding-top:var(--space-3);">
                  <span class="footer__hint">
                    ${
                      this._newPreloadFromDisk && selectedRow
                        ? msg('Draft seeded with current on-disk content; edit away.')
                        : msg('Draft starts empty; populate JSON in the editor.')
                    }
                  </span>
                  <div class="footer__actions">
                    <button
                      class="btn"
                      @click=${this._handleClose}
                      ?disabled=${this._creating}
                    >
                      ${msg('Cancel')}
                    </button>
                    <button
                      class="btn btn--primary"
                      @click=${this._handleCreate}
                      ?disabled=${createDisabled}
                    >
                      ${
                        this._creating
                          ? msg('Creating...')
                          : this._newPreloadFromDisk && selectedRow
                            ? msg('Load & Edit')
                            : msg('Create empty draft')
                      }
                    </button>
                  </div>
                </div>
              </div>
            `
      }
    `;
  }

  private _badgeVariant(status: string) {
    switch (status) {
      case 'draft':
        return 'info';
      case 'conflict':
        return 'warning';
      case 'published':
        return 'primary';
      case 'merged':
        return 'success';
      case 'abandoned':
        return 'danger';
      default:
        return 'default';
    }
  }

  private _fmt(iso: string): string {
    try {
      return new Date(iso).toLocaleString(undefined, {
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (err) {
      captureError(err, { source: 'VelgContentDraftEditor._fmt' });
      return iso.slice(0, 16);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-content-draft-editor': VelgContentDraftEditor;
  }
}
