import { localized, msg } from '@lit/localize';
import { effect } from '@preact/signals-core';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { ForgeLoreSection } from '../../services/api/ForgeApiService.js';
import { loreApi } from '../../services/api/LoreApiService.js';
import type { LoreSectionCreatePayload, LoreSectionUpdatePayload } from '../../services/api/LoreApiService.js';
import { appState } from '../../services/AppStateManager.js';
import { forgeStateManager } from '../../services/ForgeStateManager.js';
import { seoService } from '../../services/SeoService.js';
import { icons } from '../../utils/icons.js';
import { VelgConfirmDialog } from '../shared/ConfirmDialog.js';
import { VelgToast } from '../shared/Toast.js';
import { fetchRawLoreSections, getClassifiedSections, isClassifiedSection, mapLoreSectionsForLocale } from './lore-content.js';

import '../platform/LoreScroll.js';
import './LoreEditor.js';
import './VelgDossierPreview.js';
import './VelgDossierRequest.js';
import './VelgCaseFile.js';
import './VelgDossierReveal.js';

@localized()
@customElement('velg-simulation-lore-view')
export class VelgSimulationLoreView extends SignalWatcher(LitElement) {
  static styles = css`
    :host {
      display: block;
    }

    .lore-view {
      max-width: 860px;
      margin: 0 auto;
    }

    .lore-view__empty {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 40vh;
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-lg);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-secondary);
    }

    .lore-view__toolbar {
      display: flex;
      justify-content: flex-end;
      padding: var(--space-4) 0;
      gap: var(--space-2);
    }

    .lore-view__btn {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      padding: var(--space-1) var(--space-2);
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-secondary);
      background: transparent;
      border: 1px solid var(--color-border);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .lore-view__btn:hover {
      color: var(--color-primary);
      border-color: var(--color-primary);
    }

    .lore-view__btn--active {
      color: var(--color-primary);
      border-color: var(--color-primary);
      background: color-mix(in srgb, var(--color-primary) 10%, transparent);
    }

    .lore-view__btn svg {
      width: 16px;
      height: 16px;
      fill: currentColor;
    }
  `;

  @property({ type: String }) simulationId = '';

  @state() private _rawSections: ForgeLoreSection[] | null = null;
  @state() private _loading = false;
  @state() private _editMode = false;
  @state() private _showCeremony = false;
  @state() private _caseFileMode = false;

  private _disposeEffect?: () => void;
  private _disposeImageTracking?: () => void;
  private _fetchedForSimId = '';

  connectedCallback(): void {
    super.connectedCallback();
    window.scrollTo(0, 0);
    this._disposeEffect = effect(() => {
      const sim = appState.currentSimulation.value;
      if (sim) {
        this._injectProfileSchema(sim);
        this._loadLore(sim.id);
      }
      this.requestUpdate();
    });
    this._disposeImageTracking = effect(() => {
      const version = forgeStateManager.imageUpdateVersion.value;
      if (version > 0 && this._rawSections !== null) {
        this._refreshLore();
      }
    });
  }

  private async _loadLore(simId: string): Promise<void> {
    if (this._fetchedForSimId === simId) return;
    this._fetchedForSimId = simId;
    this._loading = true;
    try {
      this._rawSections = await fetchRawLoreSections(simId);
    } finally {
      this._loading = false;
    }
  }

  disconnectedCallback(): void {
    this._disposeEffect?.();
    this._disposeImageTracking?.();
    seoService.removeStructuredData();
    super.disconnectedCallback();
  }

  private _injectProfileSchema(sim: {
    name: string;
    description: string;
    slug: string;
    banner_url?: string;
  }): void {
    seoService.setCreativeWork({
      name: sim.name,
      description: sim.description,
      url: `https://metaverse.center/simulations/${sim.slug}/lore`,
      image: sim.banner_url,
    });
  }

  private _getSlug(): string {
    return appState.currentSimulation.value?.slug ?? '';
  }

  private _getSimId(): string {
    return appState.currentSimulation.value?.id ?? '';
  }

  private _toggleEditMode(): void {
    this._editMode = !this._editMode;
  }

  private async _handleSave(e: CustomEvent<{ sectionId: string; data: LoreSectionUpdatePayload }>): Promise<void> {
    const { sectionId, data } = e.detail;
    const simId = this._getSimId();
    const resp = await loreApi.updateSection(simId, sectionId, data);
    if (resp.success) {
      VelgToast.success(msg('Section saved. Translation will be regenerated.'));
      await this._refreshLore();
    } else {
      VelgToast.error(resp.error?.message ?? msg('Failed to save section.'));
    }
  }

  private async _handleCreate(e: CustomEvent<{ data: LoreSectionCreatePayload }>): Promise<void> {
    const { data } = e.detail;
    const simId = this._getSimId();
    const resp = await loreApi.createSection(simId, data);
    if (resp.success) {
      VelgToast.success(msg('Section created.'));
      await this._refreshLore();
    } else {
      VelgToast.error(resp.error?.message ?? msg('Failed to create section.'));
    }
  }

  private async _handleDelete(e: CustomEvent<{ sectionId: string }>): Promise<void> {
    const { sectionId } = e.detail;
    const confirmed = await VelgConfirmDialog.show({
      message: msg('Delete this lore section? This cannot be undone.'),
      confirmLabel: msg('Delete'),
      variant: 'danger',
    });
    if (!confirmed) return;

    const simId = this._getSimId();
    const resp = await loreApi.deleteSection(simId, sectionId);
    if (resp.success) {
      VelgToast.success(msg('Section deleted.'));
      await this._refreshLore();
    } else {
      VelgToast.error(resp.error?.message ?? msg('Failed to delete section.'));
    }
  }

  private async _handleReorder(e: CustomEvent<{ sectionId: string; direction: -1 | 1 }>): Promise<void> {
    const { sectionId, direction } = e.detail;
    if (!this._rawSections) return;

    const ids = this._rawSections.map((s) => s.id);
    const idx = ids.indexOf(sectionId);
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= ids.length) return;

    // Swap
    [ids[idx], ids[targetIdx]] = [ids[targetIdx], ids[idx]];

    const simId = this._getSimId();
    const resp = await loreApi.reorderSections(simId, ids);
    if (resp.success) {
      this._rawSections = resp.data ?? null;
    } else {
      VelgToast.error(resp.error?.message ?? msg('Failed to reorder sections.'));
    }
  }

  private _handleDossierComplete(): void {
    const sim = appState.currentSimulation.value;
    if (sim) {
      this._showCeremony = true;
    }
  }

  private async _handleCeremonyComplete(): Promise<void> {
    this._showCeremony = false;
    await this._refreshLore();
  }

  private async _refreshLore(): Promise<void> {
    const simId = this._getSimId();
    if (!simId) return;
    this._fetchedForSimId = '';
    await this._loadLore(simId);
  }

  protected render() {
    const slug = this._getSlug();
    const canEdit = appState.canEdit.value;
    const sections = this._rawSections ? mapLoreSectionsForLocale(this._rawSections) : null;

    if (this._loading) {
      return html`<div class="lore-view__empty">${msg('Loading lore...')}</div>`;
    }

    if (!sections && !this._editMode) {
      return html`
        <article class="lore-view">
          ${canEdit ? this._renderToolbar() : nothing}
          <div class="lore-view__empty">${msg('No lore available for this simulation.')}</div>
        </article>
      `;
    }

    if (this._editMode && canEdit) {
      return html`
        <article class="lore-view">
          ${this._renderToolbar()}
          <velg-lore-editor
            .sections=${this._rawSections ?? []}
            @lore-save=${this._handleSave}
            @lore-create=${this._handleCreate}
            @lore-delete=${this._handleDelete}
            @lore-reorder=${this._handleReorder}
          ></velg-lore-editor>
        </article>
      `;
    }

    // Build classified section IDs set
    const classifiedIds = new Set<string>();
    if (this._rawSections) {
      for (const s of this._rawSections) {
        if (isClassifiedSection(s)) classifiedIds.add(s.id);
      }
    }

    const simId = this._getSimId();
    const hasDossier = forgeStateManager.hasCompletedPurchase(simId, 'classified_dossier');
    const classifiedSections = hasDossier && this._rawSections
      ? getClassifiedSections(this._rawSections)
      : [];

    return html`
      ${this._showCeremony
        ? html`<velg-dossier-reveal
            .simulationName=${appState.currentSimulation.value?.name ?? ''}
            @dossier-ceremony-complete=${this._handleCeremonyComplete}
          ></velg-dossier-reveal>`
        : nothing}
      <article class="lore-view">
        ${canEdit ? this._renderToolbar(hasDossier) : nothing}

        ${this._caseFileMode && classifiedSections.length > 0
          ? html`<velg-case-file
              .sections=${classifiedSections}
              .simulationName=${appState.currentSimulation.value?.name ?? ''}
              .basePath=${slug}
            ></velg-case-file>`
          : nothing}

        ${!this._caseFileMode
          ? html`<velg-lore-scroll
              .sections=${sections!}
              .basePath=${`${slug}/lore`}
              .classifiedSectionIds=${classifiedIds}
              ?generating=${forgeStateManager.imageTrackingSlug.value === slug}
              .pendingImageSlugs=${this._computePendingImageSlugs()}
              style="
                --lore-text: var(--color-text-primary);
                --lore-heading: var(--color-text-primary);
                --lore-muted: var(--color-text-secondary);
                --lore-faint: var(--color-text-muted);
                --lore-accent: var(--color-primary);
                --lore-accent-strong: var(--color-primary-hover, var(--color-primary));
                --lore-surface: var(--color-surface-sunken);
                --lore-surface-hover: var(--color-surface);
                --lore-divider: var(--color-border-light);
                --lore-image-border: var(--color-border-light);
                --lore-btn-border: var(--color-border);
                --lore-btn-text: var(--color-text-secondary);
              "
            ></velg-lore-scroll>`
          : nothing}

        ${canEdit && !hasDossier
          ? html`
            <velg-dossier-preview
              .simulationId=${simId}
            ></velg-dossier-preview>
            <velg-dossier-request
              .simulationId=${simId}
              .walletBalance=${forgeStateManager.walletBalance.value}
              .hasBypass=${forgeStateManager.byokStatus.value.effective_bypass}
              @dossier-complete=${this._handleDossierComplete}
            ></velg-dossier-request>
          `
          : nothing}
      </article>
    `;
  }

  private _computePendingImageSlugs(): Set<string> {
    const progress = forgeStateManager.imageProgress.value;
    if (!progress?.lore || !this._rawSections) return new Set();

    // Progress lore entries have image_url = image_slug (when done) or null (pending)
    const doneSlugs = new Set<string>();
    for (const entry of progress.lore) {
      if (entry.image_url) doneSlugs.add(entry.image_url);
    }

    const pending = new Set<string>();
    for (const s of this._rawSections) {
      if (s.image_slug && !doneSlugs.has(s.image_slug)) {
        pending.add(s.image_slug);
      }
    }
    return pending;
  }

  private _toggleCaseFile(): void {
    this._caseFileMode = !this._caseFileMode;
  }

  private _renderToolbar(hasDossier = false) {
    return html`
      <div class="lore-view__toolbar">
        ${hasDossier
          ? html`<button
              class="lore-view__btn ${this._caseFileMode ? 'lore-view__btn--active' : ''}"
              @click=${this._toggleCaseFile}
              title=${this._caseFileMode ? msg('View Inline') : msg('View as Case File')}
            >
              ${icons.stampClassified(16)}
              ${this._caseFileMode ? msg('View Inline') : msg('View as Case File')}
            </button>`
          : nothing}
        <button
          class="lore-view__btn ${this._editMode ? 'lore-view__btn--active' : ''}"
          @click=${this._toggleEditMode}
          title=${this._editMode ? msg('Exit edit mode') : msg('Edit lore')}
        >
          ${icons.edit(16)} ${this._editMode ? msg('Done') : msg('Edit')}
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-simulation-lore-view': VelgSimulationLoreView;
  }
}
