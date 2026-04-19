/**
 * Admin Dungeon Content tab — master-detail content management interface.
 *
 * Sub-navigation for 8 content types, filterable table, sheet/drawer editor.
 * All content is bilingual (EN/DE) with live terminal preview.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { DungeonContentType } from '../../services/api/DungeonContentAdminApi.js';
import { dungeonContentApi } from '../../services/api/DungeonContentAdminApi.js';
import { icons } from '../../utils/icons.js';
import {
  adminAnimationStyles,
  adminLoadingStyles,
  adminSectionHeaderStyles,
  adminSubNavStyles,
} from '../shared/admin-shared-styles.js';
import { buttonStyles } from '../shared/button-styles.js';
import { VelgToast } from '../shared/Toast.js';

import './DungeonContentTable.js';
import './DungeonContentEditor.js';

interface ContentTypeConfig {
  key: DungeonContentType;
  label: string;
  icon: string;
}

// Authoring-source deep-link helpers. Since A1.5, content lives in YAML
// packs under `content/dungeon/`. These helpers produce GitHub blob URLs
// so admins can jump straight to the canonical source.

const PACKS_ROOT_URL = 'https://github.com/mleihs/velgarien-rebuild/blob/main/content/dungeon';

const ARCHETYPE_NAME_TO_SLUG: Record<string, string> = {
  'The Shadow': 'shadow',
  'The Tower': 'tower',
  'The Devouring Mother': 'mother',
  'The Entropy': 'entropy',
  'The Prometheus': 'prometheus',
  'The Deluge': 'deluge',
  'The Awakening': 'awakening',
  'The Overthrow': 'overthrow',
};

const CONTENT_TYPE_TO_FILE: Record<string, string> = {
  banter: 'banter.yaml',
  encounters: 'encounters.yaml',
  enemies: 'enemies.yaml',
  spawns: 'spawns.yaml',
  choices: 'encounters.yaml',
  loot: 'loot.yaml',
  anchors: 'anchors.yaml',
  entrance_texts: 'entrance_texts.yaml',
  barometer_texts: 'barometer_texts.yaml',
};

export function packsRootUrl(): string {
  return PACKS_ROOT_URL;
}

export function githubUrlForItem(
  contentType: DungeonContentType,
  item: Record<string, unknown>,
): string | null {
  if (contentType === 'abilities') {
    const school = typeof item.school === 'string' ? item.school : null;
    return school ? `${PACKS_ROOT_URL}/abilities/${school}.yaml` : null;
  }
  const archetype = typeof item.archetype === 'string' ? item.archetype : null;
  const slug = archetype ? ARCHETYPE_NAME_TO_SLUG[archetype] : null;
  const file = CONTENT_TYPE_TO_FILE[contentType];
  if (!slug || !file) return null;
  return `${PACKS_ROOT_URL}/archetypes/${slug}/${file}`;
}

@localized()
@customElement('velg-admin-dungeon-content-tab')
export class AdminDungeonContentTab extends LitElement {
  static styles = [
    adminAnimationStyles,
    adminSectionHeaderStyles,
    adminLoadingStyles,
    adminSubNavStyles,
    buttonStyles,
    css`
      :host {
        display: block;
        color: var(--color-text-primary);
        font-family: var(--font-mono);
        --_admin-accent: var(--color-accent-gold, var(--color-accent-amber));
      }

      .header-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: var(--space-2);
      }

      .reload-btn {
        padding: var(--space-1) var(--space-3);
        font-family: var(--font-brutalist);
        font-size: var(--text-xs);
        font-weight: var(--font-bold, 700);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        background: transparent;
        color: var(--color-text-muted);
        border: 1px solid var(--color-border);
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .reload-btn:hover:not(:disabled) {
        color: var(--_admin-accent);
        border-color: var(--_admin-accent);
      }

      .reload-btn:disabled {
        opacity: 0.4;
        cursor: default;
      }

      /* ── Authoring-source notice (A1.6) ──────────────────────────────
       * Context-specific layout for the top-of-tab banner; the action
       * button itself uses the shared .btn .btn--ghost .btn--sm pattern
       * from button-styles.ts (imported above). */

      .source-notice {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--space-4);
        padding: var(--space-3) var(--space-4);
        margin-bottom: var(--space-4);
        border: 1px dashed var(--color-border);
        background: color-mix(in srgb, var(--color-info) 4%, transparent);
      }

      .source-notice__body {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        max-width: 80ch;
      }

      .source-notice__title {
        font-family: var(--font-brutalist);
        font-size: var(--text-xs);
        font-weight: var(--font-bold);
        text-transform: uppercase;
        letter-spacing: var(--tracking-brutalist);
        color: var(--color-text-primary);
      }

      .source-notice__text {
        font-family: var(--font-mono);
        font-size: var(--text-sm);
        line-height: var(--leading-snug);
        color: var(--color-text-secondary);
      }

      @media (max-width: 768px) {
        .source-notice {
          flex-direction: column;
          align-items: flex-start;
        }
      }

      .content-area {
        animation: panel-enter 350ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1));
      }

      @media (prefers-reduced-motion: reduce) {
        .content-area {
          animation: none;
        }
      }
    `,
  ];

  private _contentTypes: ContentTypeConfig[] = [
    { key: 'banter', label: 'Banter', icon: '\u2756' },
    { key: 'encounters', label: 'Encounters', icon: '\u2694' },
    { key: 'enemies', label: 'Enemies', icon: '\u2620' },
    { key: 'loot', label: 'Loot', icon: '\u2726' },
    { key: 'abilities', label: 'Abilities', icon: '\u26A1' },
    { key: 'anchors', label: 'Objektanker', icon: '\u2693' },
    { key: 'entrance_texts', label: 'Entrance', icon: '\u25B7' },
    { key: 'barometer_texts', label: 'Barometer', icon: '\u25CE' },
  ];

  @state() private _activeType: DungeonContentType = 'banter';
  @state() private _items: Record<string, unknown>[] = [];
  @state() private _total = 0;
  @state() private _page = 1;
  @state() private _loading = true;
  @state() private _reloading = false;

  // Editor state
  @state() private _editorOpen = false;
  @state() private _editorItem: Record<string, unknown> | null = null;
  @state() private _editorSaving = false;
  @state() private _selectedId = '';

  // Filter state
  @state() private _archetype = '';
  @state() private _search = '';

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    await this._loadContent();
  }

  // ── Data loading ────────────────────────────────────────────────

  private async _loadContent(): Promise<void> {
    this._loading = true;
    const result = await dungeonContentApi.listContent(this._activeType, {
      archetype: this._archetype || undefined,
      search: this._search || undefined,
      page: this._page,
      per_page: 100,
    });

    if (result.success && result.data) {
      this._items = result.data;
      this._total = result.meta?.total ?? this._items.length;
    } else {
      this._items = [];
      this._total = 0;
    }
    this._loading = false;
  }

  // ── Event handlers ──────────────────────────────────────────────

  private async _handleSubNavChange(type: DungeonContentType): Promise<void> {
    this._activeType = type;
    this._page = 1;
    this._search = '';
    this._archetype = '';
    this._editorOpen = false;
    this._editorItem = null;
    this._selectedId = '';
    await this._loadContent();
  }

  private async _handleFilterChange(
    e: CustomEvent<{ search: string; archetype: string }>,
  ): Promise<void> {
    this._search = e.detail.search;
    this._archetype = e.detail.archetype;
    this._page = 1;
    await this._loadContent();
  }

  private async _handlePageChange(e: CustomEvent<{ page: number }>): Promise<void> {
    this._page = e.detail.page;
    await this._loadContent();
  }

  private _handleRowSelect(e: CustomEvent<{ item: Record<string, unknown> }>): void {
    this._editorItem = e.detail.item;
    this._editorOpen = true;
    this._selectedId = String(e.detail.item.id ?? e.detail.item.archetype ?? '');
  }

  private _handleEditorClose(): void {
    this._editorOpen = false;
    this._editorItem = null;
    this._selectedId = '';
  }

  private async _handleEditorSave(
    e: CustomEvent<{ item: Record<string, unknown>; contentType: string }>,
  ): Promise<void> {
    this._editorSaving = true;
    const { item } = e.detail;
    const itemId = String(item.id ?? '');

    const result = await dungeonContentApi.updateItem(this._activeType, itemId, item);
    if (result.success) {
      VelgToast.success(msg('Content saved successfully.'));
      this._editorOpen = false;
      this._editorItem = null;
      this._selectedId = '';
      await this._loadContent();
    } else {
      VelgToast.error(result.error?.message ?? msg('Failed to save content.'));
    }
    this._editorSaving = false;
  }

  private async _handleEditorDelete(e: CustomEvent<{ itemId: string }>): Promise<void> {
    const confirmed = window.confirm(msg('Delete this content item? This cannot be undone.'));
    if (!confirmed) return;

    const result = await dungeonContentApi.deleteItem(this._activeType, e.detail.itemId);
    if (result.success) {
      VelgToast.success(msg('Content deleted.'));
      this._editorOpen = false;
      this._editorItem = null;
      this._selectedId = '';
      await this._loadContent();
    } else {
      VelgToast.error(result.error?.message ?? msg('Failed to delete.'));
    }
  }

  private async _handleReloadCache(): Promise<void> {
    this._reloading = true;
    const result = await dungeonContentApi.reloadCache();
    if (result.success) {
      VelgToast.success(msg('Content cache reloaded.'));
    } else {
      VelgToast.error(result.error?.message ?? msg('Failed to reload cache.'));
    }
    this._reloading = false;
  }

  // ── Render ──────────────────────────────────────────────────────

  protected render() {
    return html`
      <!-- Header -->
      <div class="header-row">
        <div class="section-header">
          <div class="section-header__marker"></div>
          <h2 class="section-header__title">${msg('Dungeon Content')}</h2>
        </div>
        <button
          class="reload-btn"
          ?disabled=${this._reloading}
          @click=${this._handleReloadCache}
        >${this._reloading ? msg('Reloading...') : msg('Reload Cache')}</button>
      </div>

      <!-- Authoring-source notice -->
      <div class="source-notice" role="note">
        <div class="source-notice__body">
          <div class="source-notice__title">${msg('Authoring source')}</div>
          <div class="source-notice__text">
            ${msg(
              'Content is authored as versioned YAML packs under content/dungeon/. The rows below mirror the current main branch. Direct edits here mutate the database only and will be overwritten on the next pack-backed migration – open a pull request on the source YAML for permanent changes.',
            )}
          </div>
        </div>
        <a
          class="btn btn--info btn--sm"
          href=${packsRootUrl()}
          target="_blank"
          rel="noopener noreferrer"
          aria-label=${msg('View packs on GitHub (opens in new tab)')}
        >${msg('View packs on GitHub')} ${icons.externalLink()}</a>
      </div>

      <!-- Sub-navigation -->
      <div class="subnav" role="tablist" aria-label=${msg('Content type navigation')}>
        ${this._contentTypes.map(
          (ct) => html`
            <button
              class="subnav__btn ${this._activeType === ct.key ? 'subnav__btn--active' : ''}"
              role="tab"
              aria-selected=${this._activeType === ct.key ? 'true' : 'false'}
              @click=${() => this._handleSubNavChange(ct.key)}
            >${ct.icon} ${ct.label}</button>
          `,
        )}
      </div>

      <!-- Content area -->
      <div class="content-area subnav__content">
        ${
          this._loading
            ? html`<div class="loading">${msg('Loading content...')}</div>`
            : html`
            <velg-dungeon-content-table
              .items=${this._items}
              .contentType=${this._activeType}
              .selectedId=${this._selectedId}
              .total=${this._total}
              .page=${this._page}
              @row-select=${this._handleRowSelect}
              @filter-change=${this._handleFilterChange}
              @page-change=${this._handlePageChange}
            ></velg-dungeon-content-table>
          `
        }
      </div>

      <!-- Editor drawer -->
      <velg-dungeon-content-editor
        .item=${this._editorItem}
        .contentType=${this._activeType}
        .open=${this._editorOpen}
        .saving=${this._editorSaving}
        .githubUrl=${this._editorItem ? githubUrlForItem(this._activeType, this._editorItem) : null}
        @editor-close=${this._handleEditorClose}
        @editor-save=${this._handleEditorSave}
        @editor-delete=${this._handleEditorDelete}
      ></velg-dungeon-content-editor>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-admin-dungeon-content-tab': AdminDungeonContentTab;
  }
}
