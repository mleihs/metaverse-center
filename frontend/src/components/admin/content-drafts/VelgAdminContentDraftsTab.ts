/**
 * VelgAdminContentDraftsTab — wrapper composing the three A1.7 components
 * into a cohesive admin surface.
 *
 * Composition:
 *   <velg-content-drafts-list>    — always visible (main pane)
 *   <velg-side-panel>             — lazy-mounted editor for edit + create
 *     <velg-content-draft-editor>
 *   <velg-publish-batch-modal>    — lazy-shown on "Publish Selected"
 *
 * Orchestration summary:
 *   list → new-draft       → open side-panel in create mode
 *   list → edit-draft {id} → open side-panel with draft-id
 *   list → publish-batch   → open publish modal with summaries
 *   editor → draft-created → swap editor to edit mode on new row + refresh
 *   editor → draft-saved   → refresh list
 *   editor → editor-close  → close side panel
 *   modal  → publish-success → close modal, refresh list, clear selection
 *
 * No per-simulation routing — all endpoints are admin-scoped and gate on
 * require_platform_admin() server-side.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { ContentDraftSummary } from '../../../services/api/ContentDraftsApiService.js';
import { VelgConfirmDialog } from '../../shared/ConfirmDialog.js';
import '../../shared/VelgSidePanel.js';
import './VelgContentDraftsList.js';
import './VelgContentDraftEditor.js';
import './VelgPublishBatchModal.js';
import type { VelgContentDraftEditor } from './VelgContentDraftEditor.js';
import type { VelgContentDraftsList } from './VelgContentDraftsList.js';

@localized()
@customElement('velg-admin-content-drafts-tab')
export class VelgAdminContentDraftsTab extends LitElement {
  static styles = css`
    :host {
      display: block;
      color: var(--color-text-primary);
      font-family: var(--font-mono, monospace);
    }
  `;

  /** Editor visibility / mode. */
  @state() private _editorOpen = false;
  @state() private _editorDraftId: string | null = null;
  @state() private _editorCreateMode = false;

  /** Publish modal state. */
  @state() private _publishOpen = false;
  @state() private _publishDrafts: ContentDraftSummary[] = [];

  private _getList(): VelgContentDraftsList | null {
    return (
      this.renderRoot?.querySelector('velg-content-drafts-list') as
        | VelgContentDraftsList
        | null
    );
  }

  private _getEditor(): VelgContentDraftEditor | null {
    return (
      this.renderRoot?.querySelector('velg-content-draft-editor') as
        | VelgContentDraftEditor
        | null
    );
  }

  private _handleNewDraft(): void {
    this._editorDraftId = null;
    this._editorCreateMode = true;
    this._editorOpen = true;
  }

  private _handleEditDraft(e: CustomEvent<{ id: string }>): void {
    this._editorCreateMode = false;
    this._editorDraftId = e.detail.id;
    this._editorOpen = true;
  }

  private _handlePublishBatch(
    e: CustomEvent<{ ids: string[]; drafts: ContentDraftSummary[] }>,
  ): void {
    this._publishDrafts = e.detail.drafts;
    this._publishOpen = true;
  }

  /**
   * Single close path for BOTH the editor's Cancel button and the side-panel
   * backdrop/Esc. Runs the dirty-check here so neither path can bypass it.
   *
   * Clears draftId + createMode so a subsequent open of the SAME draft still
   * triggers willUpdate → _loadDraft — picks up edits another admin made
   * since we last opened the row.
   */
  private async _handleEditorClose(): Promise<void> {
    const editor = this._getEditor();
    if (editor?.hasUnsavedChanges()) {
      const confirmed = await VelgConfirmDialog.show({
        title: msg('Discard unsaved changes?'),
        message: msg(
          'This draft has unsaved edits. Closing now discards them. Save the draft first to keep your changes.',
        ),
        confirmLabel: msg('Discard'),
        cancelLabel: msg('Keep editing'),
        variant: 'danger',
      });
      if (!confirmed) return;
    }
    this._editorOpen = false;
    this._editorDraftId = null;
    this._editorCreateMode = false;
  }

  private _handleDraftCreated(e: CustomEvent<{ id: string }>): void {
    // Swap editor to edit-mode on the freshly-created draft.
    this._editorCreateMode = false;
    this._editorDraftId = e.detail.id;
    void this._getList()?.refresh();
  }

  private _handleDraftSaved(): void {
    void this._getList()?.refresh();
  }

  private _handlePublishSuccess(): void {
    this._publishOpen = false;
    this._publishDrafts = [];
    const list = this._getList();
    list?.clearSelection();
    void list?.refresh();
  }

  private _handlePublishClose(): void {
    this._publishOpen = false;
  }


  protected render(): TemplateResult {
    const sidePanelTitle = this._editorCreateMode
      ? msg('New Content Draft')
      : msg('Edit Content Draft');

    return html`
      <velg-content-drafts-list
        @new-draft=${this._handleNewDraft}
        @edit-draft=${this._handleEditDraft}
        @publish-batch=${this._handlePublishBatch}
      ></velg-content-drafts-list>

      <velg-side-panel
        ?open=${this._editorOpen}
        panelTitle=${sidePanelTitle}
        @panel-close=${this._handleEditorClose}
      >
        <velg-content-draft-editor
          draft-id=${this._editorDraftId ?? ''}
          ?create-mode=${this._editorCreateMode}
          @editor-close=${this._handleEditorClose}
          @draft-created=${this._handleDraftCreated}
          @draft-saved=${this._handleDraftSaved}
        ></velg-content-draft-editor>
      </velg-side-panel>

      <velg-publish-batch-modal
        ?open=${this._publishOpen}
        .drafts=${this._publishDrafts}
        @publish-success=${this._handlePublishSuccess}
        @modal-close=${this._handlePublishClose}
      ></velg-publish-batch-modal>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-admin-content-drafts-tab': VelgAdminContentDraftsTab;
  }
}
