import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { socialMediaApi } from '../../services/api/index.js';
import type { SocialMediaPost } from '../../types/index.js';
import type { FilterChangeDetail } from '../shared/SharedFilterBar.js';
import { VelgToast } from '../shared/Toast.js';

import '../shared/SharedFilterBar.js';
import '../shared/Pagination.js';
import '../shared/LoadingState.js';
import '../shared/ErrorState.js';
import '../shared/EmptyState.js';
import './PostCard.js';
import './PostTransformModal.js';

@localized()
@customElement('velg-social-media-view')
export class VelgSocialMediaView extends LitElement {
  static styles = css`
    :host { display: block; }
    .social { display: flex; flex-direction: column; gap: var(--space-4); }
    .social__header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); }
    .social__title { font-family: var(--font-brutalist); font-weight: var(--font-black); font-size: var(--text-2xl); text-transform: uppercase; letter-spacing: var(--tracking-brutalist); margin: 0; }
    .social__btn {
      display: inline-flex; align-items: center; gap: var(--space-2);
      padding: var(--space-2-5) var(--space-5); font-family: var(--font-brutalist);
      font-weight: var(--font-black); font-size: var(--text-sm); text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist); background: var(--color-primary);
      color: var(--color-text-inverse); border: var(--border-default);
      box-shadow: var(--shadow-md); cursor: pointer; transition: all var(--transition-fast);
    }
    .social__btn:hover { transform: translate(-2px, -2px); box-shadow: var(--shadow-lg); }
    .social__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: var(--space-4); }
  `;

  @property({ type: String }) simulationId = '';
  @state() private _posts: SocialMediaPost[] = [];
  @state() private _loading = false;
  @state() private _error: string | null = null;
  @state() private _total = 0;
  @state() private _page = 1;
  @state() private _pageSize = 25;
  @state() private _filters: Record<string, string> = {};
  @state() private _showTransformModal = false;
  @state() private _selectedPost: SocialMediaPost | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this._loadPosts();
  }

  private async _loadPosts(): Promise<void> {
    this._loading = true;
    this._error = null;
    const params: Record<string, string> = {
      limit: String(this._pageSize),
      offset: String((this._page - 1) * this._pageSize),
      ...this._filters,
    };
    const response = await socialMediaApi.listPosts(this.simulationId, params);
    if (response.success && response.data) {
      this._posts = Array.isArray(response.data) ? response.data : [];
      this._total = response.meta?.total ?? this._posts.length;
    } else {
      this._error = response.error?.message || msg('Failed to load posts');
    }
    this._loading = false;
  }

  private async _handleSync(): Promise<void> {
    this._loading = true;
    const response = await socialMediaApi.syncPosts(this.simulationId);
    if (response.success) {
      VelgToast.success(msg('Posts synced successfully'));
      await this._loadPosts();
    } else {
      VelgToast.error(response.error?.message || msg('Sync failed'));
      this._loading = false;
    }
  }

  private _handleFilterChange(e: CustomEvent<FilterChangeDetail>): void {
    this._filters = { ...e.detail.filters };
    this._page = 1;
    this._loadPosts();
  }

  private _handlePageChange(e: CustomEvent<{ page: number }>): void {
    this._page = e.detail.page;
    this._loadPosts();
  }

  private _handleTransform(e: CustomEvent<SocialMediaPost>): void {
    this._selectedPost = e.detail;
    this._showTransformModal = true;
  }

  private _handleTransformComplete(): void {
    this._showTransformModal = false;
    this._selectedPost = null;
    this._loadPosts();
  }

  protected render() {
    return html`
      <div class="social">
        <div class="social__header">
          <h1 class="social__title">${msg('Social Media')}</h1>
          <button class="social__btn" @click=${this._handleSync}>${msg('Sync Posts')}</button>
        </div>

        <velg-filter-bar
          .filters=${[
            {
              key: 'platform',
              label: msg('Platform'),
              type: 'select' as const,
              options: [{ value: 'facebook', label: msg('Facebook') }],
            },
            {
              key: 'transformed',
              label: msg('Transformed'),
              type: 'select' as const,
              options: [
                { value: 'true', label: msg('Yes') },
                { value: 'false', label: msg('No') },
              ],
            },
          ]}
          @filter-change=${this._handleFilterChange}
        ></velg-filter-bar>

        ${this._loading ? html`<velg-loading-state message=${msg('Loading posts...')}></velg-loading-state>` : ''}
        ${this._error ? html`<velg-error-state message=${this._error} @retry=${this._loadPosts}></velg-error-state>` : ''}

        ${
          !this._loading && !this._error && this._posts.length === 0
            ? html`<velg-empty-state message=${msg('No posts found')} actionLabel=${msg('Sync Posts')} @action=${this._handleSync}></velg-empty-state>`
            : ''
        }

        ${
          !this._loading && this._posts.length > 0
            ? html`
          <div class="social__grid">
            ${this._posts.map(
              (p) => html`
              <velg-post-card .post=${p} @post-transform=${this._handleTransform}></velg-post-card>
            `,
            )}
          </div>
          <velg-pagination .currentPage=${this._page} .totalItems=${this._total} .pageSize=${this._pageSize} @page-change=${this._handlePageChange}></velg-pagination>
        `
            : ''
        }

        ${
          this._showTransformModal && this._selectedPost
            ? html`
          <velg-post-transform-modal
            .post=${this._selectedPost}
            .simulationId=${this.simulationId}
            ?open=${true}
            @modal-close=${() => {
              this._showTransformModal = false;
            }}
            @transform-complete=${this._handleTransformComplete}
          ></velg-post-transform-modal>
        `
            : ''
        }
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-social-media-view': VelgSocialMediaView;
  }
}
