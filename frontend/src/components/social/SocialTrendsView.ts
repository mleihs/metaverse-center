import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { socialTrendsApi } from '../../services/api/index.js';
import type { BrowseArticle } from '../../services/api/SocialTrendsApiService.js';

import '../shared/VelgBadge.js';
import '../shared/Lightbox.js';
import '../shared/LoadingState.js';
import '../shared/ErrorState.js';
import '../shared/EmptyState.js';
import './TransformationModal.js';

const GUARDIAN_SECTIONS = [
  'world',
  'politics',
  'business',
  'technology',
  'science',
  'environment',
  'sport',
  'culture',
  'lifeandstyle',
  'education',
];

@localized()
@customElement('velg-social-trends-view')
export class VelgSocialTrendsView extends LitElement {
  static styles = css`
    :host { display: block; }

    .trends { display: flex; flex-direction: column; gap: var(--space-4); }

    .trends__header {
      display: flex; align-items: center; justify-content: space-between; gap: var(--space-4);
      flex-wrap: wrap;
    }

    .trends__title {
      font-family: var(--font-brutalist); font-weight: var(--font-black);
      font-size: var(--text-2xl); text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist); margin: 0;
    }

    /* Controls bar */
    .controls {
      display: flex; align-items: flex-end; gap: var(--space-3); flex-wrap: wrap;
      padding: var(--space-3) var(--space-4);
      background: var(--color-surface-raised); border: var(--border-default);
      box-shadow: var(--shadow-md);
    }

    .controls__group {
      display: flex; flex-direction: column; gap: var(--space-1);
    }

    .controls__label {
      font-family: var(--font-brutalist); font-weight: var(--font-bold);
      font-size: var(--text-xs); text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist); color: var(--color-text-secondary);
    }

    .controls__input,
    .controls__select {
      font-family: var(--font-sans); font-size: var(--text-sm);
      padding: var(--space-1-5) var(--space-2-5);
      border: var(--border-medium); background: var(--color-surface);
      color: var(--color-text-primary);
    }

    .controls__input { min-width: 220px; }

    .controls__input:focus,
    .controls__select:focus {
      outline: none; border-color: var(--color-border-focus);
      box-shadow: var(--ring-focus);
    }

    .controls__btn {
      display: inline-flex; align-items: center; justify-content: center;
      gap: var(--space-2); padding: var(--space-1-5) var(--space-4);
      font-family: var(--font-brutalist); font-weight: var(--font-black);
      font-size: var(--text-sm); text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist); background: var(--color-primary);
      color: var(--color-text-inverse); border: var(--border-default);
      box-shadow: var(--shadow-md); cursor: pointer; transition: all var(--transition-fast);
      white-space: nowrap;
    }

    .controls__btn:hover {
      transform: translate(-2px, -2px); box-shadow: var(--shadow-lg);
      background: var(--color-primary-hover);
    }

    .controls__btn:active { transform: translate(0); box-shadow: var(--shadow-pressed); }

    .controls__btn:disabled {
      opacity: 0.5; cursor: not-allowed; pointer-events: none;
    }

    /* Selected article panel */
    .selected {
      padding: var(--space-4);
      background: var(--color-primary-bg);
      border: var(--border-width-default) solid var(--color-primary);
      display: flex; align-items: flex-start; gap: var(--space-4);
    }

    .selected__image {
      width: 180px; height: 120px; object-fit: cover; flex-shrink: 0;
      border: var(--border-width-default) solid var(--color-primary);
      cursor: pointer; transition: opacity var(--transition-fast);
    }

    .selected__image:hover { opacity: 0.8; }

    .selected__info { flex: 1; min-width: 0; }

    .selected__label {
      font-family: var(--font-brutalist); font-weight: var(--font-black);
      font-size: var(--text-xs); text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist); color: var(--color-primary);
      margin-bottom: var(--space-1);
    }

    .selected__title {
      font-family: var(--font-brutalist); font-weight: var(--font-black);
      font-size: var(--text-lg); text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist); margin: 0;
    }

    .selected__meta {
      display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-1-5);
      font-size: var(--text-xs); color: var(--color-text-muted);
      margin-top: var(--space-2);
    }

    .selected__meta > span:not(:last-child)::after {
      content: '·'; margin-left: var(--space-1-5);
    }

    .selected__platform {
      font-family: var(--font-brutalist); font-weight: var(--font-bold);
      text-transform: uppercase; letter-spacing: var(--tracking-wide);
      color: var(--color-primary);
    }

    .selected__section {
      font-family: var(--font-brutalist); font-weight: var(--font-bold);
      text-transform: uppercase; letter-spacing: var(--tracking-wide);
    }

    .selected__abstract {
      font-size: var(--text-sm); color: var(--color-text-secondary);
      margin-top: var(--space-2); line-height: 1.6;
    }

    .selected__actions {
      display: flex; flex-direction: column; gap: var(--space-2);
      flex-shrink: 0;
    }

    .selected__btn {
      display: inline-flex; align-items: center; justify-content: center;
      padding: var(--space-1-5) var(--space-3);
      font-family: var(--font-brutalist); font-weight: var(--font-black);
      font-size: var(--text-xs); text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      border: var(--border-default); box-shadow: var(--shadow-md);
      cursor: pointer; transition: all var(--transition-fast);
      white-space: nowrap;
    }

    .selected__btn:hover {
      transform: translate(-2px, -2px); box-shadow: var(--shadow-lg);
    }

    .selected__btn--transform {
      background: var(--color-primary); color: var(--color-text-inverse);
    }

    .selected__btn--deselect {
      background: var(--color-surface-raised); color: var(--color-text-primary);
    }

    .selected__btn--link {
      background: var(--color-surface-raised); color: var(--color-text-primary);
      text-decoration: none; text-align: center;
    }

    /* Article grid */
    .articles__grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: var(--space-4);
    }

    /* Article card */
    .article-card {
      background: var(--color-surface-raised); border: var(--border-default);
      box-shadow: var(--shadow-md); display: flex; flex-direction: column;
      transition: transform var(--duration-normal) var(--ease-out),
        box-shadow var(--duration-normal) var(--ease-out);
      cursor: pointer;
      opacity: 0;
      animation: card-enter 350ms var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) forwards;
      animation-delay: calc(var(--i, 0) * 40ms);
    }

    @keyframes card-enter {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .article-card:hover {
      transform: translate(-2px, -2px); box-shadow: var(--shadow-lg);
    }

    .article-card--selected {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 2px var(--color-primary);
    }

    .article-card__header {
      padding: var(--space-3) var(--space-4);
      background: var(--color-surface-header); border-bottom: var(--border-medium);
    }

    .article-card__title {
      font-family: var(--font-brutalist); font-weight: var(--font-black);
      font-size: var(--text-md); text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist); margin: 0;
      overflow: hidden; text-overflow: ellipsis;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    }

    .article-card__body {
      padding: var(--space-3) var(--space-4);
      display: flex; flex-direction: column; gap: var(--space-2); flex: 1;
    }

    .article-card__badges { display: flex; flex-wrap: wrap; gap: var(--space-1-5); }

    .article-card__abstract {
      font-size: var(--text-sm); color: var(--color-text-secondary);
      line-height: 1.5; display: -webkit-box;
      -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
    }

    .article-card__meta {
      font-size: var(--text-xs); color: var(--color-text-muted);
      margin-top: auto;
    }

    .trends__auth-notice {
      display: flex; flex-direction: column; align-items: center; gap: var(--space-3);
      padding: var(--space-8) var(--space-4); text-align: center;
      border: var(--border-default); background: var(--color-surface-raised);
    }

    .trends__auth-notice-text {
      font-family: var(--font-brutalist); font-weight: var(--font-bold);
      font-size: var(--text-md); text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist); color: var(--color-text-secondary);
    }
  `;

  @property({ type: String }) simulationId = '';
  @state() private _articles: BrowseArticle[] = [];
  @state() private _loading = false;
  @state() private _error: string | null = null;
  @state() private _source = 'guardian';
  @state() private _query = '';
  @state() private _section = '';
  @state() private _limit = 15;
  @state() private _selectedArticle: BrowseArticle | null = null;
  @state() private _showTransformModal = false;
  @state() private _lightboxSrc: string | null = null;
  @state() private _lightboxAlt = '';

  connectedCallback(): void {
    super.connectedCallback();
    if (this.simulationId && appState.isAuthenticated.value) {
      this._loadArticles();
    }
  }

  protected willUpdate(changedProperties: Map<PropertyKey, unknown>): void {
    if (
      changedProperties.has('simulationId') &&
      this.simulationId &&
      appState.isAuthenticated.value
    ) {
      this._loadArticles();
    }
  }

  private async _loadArticles(): Promise<void> {
    this._loading = true;
    this._error = null;
    this._selectedArticle = null;

    const data: Record<string, unknown> = {
      source: this._source,
      limit: this._limit,
    };
    if (this._query.trim()) {
      data.query = this._query.trim();
    }
    if (this._section && this._source === 'guardian') {
      data.section = this._section;
    }

    const response = await socialTrendsApi.browse(
      this.simulationId,
      data as { source?: string; query?: string; section?: string; limit?: number },
    );

    if (response.success && response.data) {
      this._articles = Array.isArray(response.data) ? response.data : [];
    } else {
      this._error = response.error?.message || msg('Failed to load articles');
    }
    this._loading = false;
  }

  private _handleSelectArticle(article: BrowseArticle): void {
    if (this._selectedArticle === article) {
      this._selectedArticle = null;
    } else {
      this._selectedArticle = article;
    }
  }

  private _handleTransformSelected(): void {
    if (this._selectedArticle) {
      this._showTransformModal = true;
    }
  }

  private _handleTransformComplete(): void {
    this._showTransformModal = false;
    this._selectedArticle = null;
  }

  private _stripHtml(text: string): string {
    return text.replace(/<[^>]*>/g, '');
  }

  private _getAbstract(article: BrowseArticle, full = false): string {
    const raw = article.raw_data as Record<string, string> | undefined;
    const text = full
      ? raw?.standfirst || raw?.trail_text || raw?.description || ''
      : raw?.trail_text || raw?.description || '';
    return this._stripHtml(text);
  }

  private _getAuthor(article: BrowseArticle): string {
    const raw = article.raw_data as Record<string, string> | undefined;
    return raw?.byline || raw?.author || '';
  }

  private _getDate(article: BrowseArticle): string {
    const raw = article.raw_data as Record<string, string> | undefined;
    const dateStr = raw?.publication_date || raw?.published_at;
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return '';
    }
  }

  private _getImage(article: BrowseArticle): string {
    const raw = article.raw_data as Record<string, string> | undefined;
    return raw?.thumbnail || raw?.image_url || '';
  }

  private _getSection(article: BrowseArticle): string {
    const raw = article.raw_data as Record<string, string> | undefined;
    return raw?.section || raw?.source || '';
  }

  private _renderControls() {
    return html`
      <div class="controls">
        <div class="controls__group">
          <label class="controls__label">${msg('Source')}</label>
          <select
            class="controls__select"
            .value=${this._source}
            @change=${(e: Event) => {
              this._source = (e.target as HTMLSelectElement).value;
            }}
          >
            <option value="guardian">${msg('The Guardian')}</option>
            <option value="newsapi">${msg('NewsAPI')}</option>
          </select>
        </div>

        ${
          this._source === 'guardian'
            ? html`
            <div class="controls__group">
              <label class="controls__label">${msg('Section')}</label>
              <select
                class="controls__select"
                .value=${this._section}
                @change=${(e: Event) => {
                  this._section = (e.target as HTMLSelectElement).value;
                }}
              >
                <option value="">${msg('All Sections')}</option>
                ${GUARDIAN_SECTIONS.map((s) => html`<option value=${s}>${s}</option>`)}
              </select>
            </div>
          `
            : nothing
        }

        <div class="controls__group">
          <label class="controls__label">${msg('Search query (optional)')}</label>
          <input
            class="controls__input"
            type="text"
            .value=${this._query}
            @input=${(e: InputEvent) => {
              this._query = (e.target as HTMLInputElement).value;
            }}
            @keydown=${(e: KeyboardEvent) => {
              if (e.key === 'Enter') this._loadArticles();
            }}
            placeholder=${msg('e.g. climate, technology...')}
          />
        </div>

        <div class="controls__group">
          <label class="controls__label">${msg('Limit')}</label>
          <select
            class="controls__select"
            .value=${String(this._limit)}
            @change=${(e: Event) => {
              this._limit = Number((e.target as HTMLSelectElement).value);
            }}
          >
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="15">15</option>
            <option value="25">25</option>
            <option value="50">50</option>
          </select>
        </div>

        <button
          class="controls__btn"
          @click=${this._loadArticles}
          ?disabled=${this._loading}
        >
          ${this._loading ? msg('Loading...') : msg('Load Articles')}
        </button>
      </div>
    `;
  }

  private _renderSelectedPanel() {
    const article = this._selectedArticle;
    if (!article) return nothing;

    const abstract = this._getAbstract(article, true);
    const author = this._getAuthor(article);
    const date = this._getDate(article);
    const image = this._getImage(article);
    const section = this._getSection(article);

    return html`
      <div class="selected">
        ${
          image
            ? html`<img
                class="selected__image"
                src=${image}
                alt=${article.name}
                loading="lazy"
                @click=${(e: Event) => {
                  e.stopPropagation();
                  this._lightboxSrc = image;
                  this._lightboxAlt = article.name;
                }}
              />`
            : nothing
        }
        <div class="selected__info">
          <div class="selected__label">${msg('Selected Article')}</div>
          <h3 class="selected__title">${article.name}</h3>
          <div class="selected__meta">
            <span class="selected__platform">${article.platform}</span>
            ${section ? html`<span class="selected__section">${section}</span>` : nothing}
            ${author ? html`<span>${author}</span>` : nothing}
            ${date ? html`<span>${date}</span>` : nothing}
          </div>
          ${abstract ? html`<div class="selected__abstract">${abstract}</div>` : nothing}
        </div>
        <div class="selected__actions">
          <button class="selected__btn selected__btn--transform" @click=${this._handleTransformSelected}>
            ${msg('Transform')}
          </button>
          ${
            article.url
              ? html`<a class="selected__btn selected__btn--link" href=${article.url} target="_blank" rel="noopener">
                ${msg('Read Article')}
              </a>`
              : nothing
          }
          <button class="selected__btn selected__btn--deselect" @click=${() => {
            this._selectedArticle = null;
          }}>
            ${msg('Deselect')}
          </button>
        </div>
      </div>
    `;
  }

  private _renderArticleCard(article: BrowseArticle, index = 0) {
    const abstract = this._getAbstract(article);
    const author = this._getAuthor(article);
    const date = this._getDate(article);
    const section = this._getSection(article);
    const isSelected = this._selectedArticle === article;

    return html`
      <div
        class="article-card ${isSelected ? 'article-card--selected' : ''}"
        style="--i: ${index}"
        @click=${() => this._handleSelectArticle(article)}
      >
        <div class="article-card__header">
          <h3 class="article-card__title">${article.name}</h3>
        </div>
        <div class="article-card__body">
          <div class="article-card__badges">
            <velg-badge variant="primary">${article.platform}</velg-badge>
            ${section ? html`<velg-badge>${section}</velg-badge>` : nothing}
          </div>
          ${abstract ? html`<p class="article-card__abstract">${abstract}</p>` : nothing}
          <div class="article-card__meta">
            ${author ? html`${author}` : nothing}
            ${author && date ? html` &mdash; ` : nothing}
            ${date ? html`${date}` : nothing}
          </div>
        </div>
      </div>
    `;
  }

  protected render() {
    if (!appState.isAuthenticated.value) {
      return html`
        <div class="trends">
          <div class="trends__header">
            <h1 class="trends__title">${msg('Browse News')}</h1>
          </div>
          <div class="trends__auth-notice">
            <span class="trends__auth-notice-text">${msg('Sign in to browse and transform news articles')}</span>
          </div>
        </div>
      `;
    }

    return html`
      <div class="trends">
        <div class="trends__header">
          <h1 class="trends__title">${msg('Browse News')}</h1>
        </div>

        ${this._renderControls()}
        ${this._renderSelectedPanel()}

        ${this._loading ? html`<velg-loading-state message=${msg('Loading articles...')}></velg-loading-state>` : nothing}
        ${this._error ? html`<velg-error-state message=${this._error} @retry=${this._loadArticles}></velg-error-state>` : nothing}

        ${
          !this._loading && !this._error && this._articles.length === 0
            ? html`<velg-empty-state
              message=${msg('No articles found')}
              actionLabel=${msg('Load Articles')}
              @action=${this._loadArticles}
            ></velg-empty-state>`
            : nothing
        }

        ${
          !this._loading && this._articles.length > 0
            ? html`
            <div class="articles__grid">
              ${this._articles.map((a, i) => this._renderArticleCard(a, i))}
            </div>
          `
            : nothing
        }

        ${
          this._showTransformModal && this._selectedArticle
            ? html`
            <velg-transformation-modal
              .article=${this._selectedArticle}
              .simulationId=${this.simulationId}
              ?open=${true}
              @modal-close=${() => {
                this._showTransformModal = false;
              }}
              @transform-complete=${this._handleTransformComplete}
            ></velg-transformation-modal>
          `
            : nothing
        }

        <velg-lightbox
          .src=${this._lightboxSrc}
          .alt=${this._lightboxAlt}
          @lightbox-close=${() => {
            this._lightboxSrc = null;
          }}
        ></velg-lightbox>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-social-trends-view': VelgSocialTrendsView;
  }
}
