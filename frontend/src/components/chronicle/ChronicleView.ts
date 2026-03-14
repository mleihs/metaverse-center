import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { chronicleApi } from '../../services/api/index.js';
import { seoService } from '../../services/SeoService.js';
import type { Chronicle } from '../../types/index.js';
import { t } from '../../utils/locale-fields.js';
import { icons } from '../../utils/icons.js';
import { localeService } from '../../services/i18n/locale-service.js';

import '../shared/Pagination.js';
import '../shared/LoadingState.js';
import '../shared/ErrorState.js';
import '../shared/EmptyState.js';
import '../shared/VelgBadge.js';
import './VelgChronicleExport.js';

@localized()
@customElement('velg-chronicle-view')
export class VelgChronicleView extends LitElement {
  static styles = css`
    :host {
      display: block;
      --chron-rule-thick: 3px;
      --chron-rule-thin: 1px;
      --chron-max-width: 860px;
    }

    /* ── Broadsheet wrapper ──────────────────── */

    .broadsheet {
      max-width: var(--chron-max-width);
      margin: 0 auto;
      padding: var(--space-4);
      animation: broadsheet-enter 500ms cubic-bezier(0.22, 1, 0.36, 1) both;
    }

    @keyframes broadsheet-enter {
      from { opacity: 0; }
    }

    /* ── Masthead ────────────────────────────── */

    .masthead {
      text-align: center;
      padding: var(--space-5) 0 var(--space-3);
    }

    .masthead__rule--top {
      border: none;
      border-top: var(--chron-rule-thick) solid var(--color-primary);
      margin: 0 0 var(--space-1);
    }

    .masthead__rule--thin {
      border: none;
      border-top: var(--chron-rule-thin) solid var(--color-primary);
      margin: 0;
    }

    .masthead__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: clamp(2rem, 6vw, 3.5rem);
      text-transform: uppercase;
      letter-spacing: 0.22em;
      line-height: 1;
      margin: var(--space-2) 0;
      color: var(--color-text-primary);
    }

    .masthead__subtitle {
      font-family: var(--font-sans);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.35em;
      color: var(--color-text-muted);
      margin: var(--space-1) 0 var(--space-2);
    }

    .masthead__rule--bottom {
      border: none;
      border-top: var(--chron-rule-thin) solid var(--color-primary);
      margin: 0 0 2px;
    }

    .masthead__rule--bottom-thick {
      border: none;
      border-top: var(--chron-rule-thick) solid var(--color-primary);
      margin: 0;
    }

    /* ── Dateline bar ────────────────────────── */

    .dateline {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--space-2) 0;
      border-bottom: var(--chron-rule-thin) solid var(--color-border);
      font-family: var(--font-brutalist);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--color-text-muted);
    }

    .dateline__sim {
      font-weight: var(--font-black);
      color: var(--color-text-secondary);
    }

    /* ── Editorial desk (generate controls) ─── */

    .editorial {
      display: flex;
      align-items: flex-end;
      gap: var(--space-3);
      padding: var(--space-3) 0;
      border-bottom: var(--chron-rule-thin) solid var(--color-border);
      flex-wrap: wrap;
    }

    .editorial__field {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .editorial__label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-text-muted);
    }

    .editorial__input {
      padding: var(--space-1-5) var(--space-2);
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs);
      border: var(--chron-rule-thin) solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-text-primary);
    }

    .editorial__input:focus {
      outline: none;
      border-color: var(--color-border-focus);
      box-shadow: var(--ring-focus);
    }

    .editorial__btn {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1-5);
      padding: var(--space-1-5) var(--space-3);
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      background: var(--color-text-primary);
      color: var(--color-surface);
      border: none;
      cursor: pointer;
      transition: opacity var(--transition-fast);
      white-space: nowrap;
    }

    .editorial__btn:hover:not(:disabled) {
      opacity: 0.85;
    }

    .editorial__btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .editorial__btn:focus-visible {
      outline: 2px solid var(--color-border-focus);
      outline-offset: 2px;
    }

    /* ── Front page (featured edition) ───────── */

    .front-page {
      padding: var(--space-5) 0 var(--space-4);
      animation: front-enter 600ms cubic-bezier(0.22, 1, 0.36, 1) both;
      animation-delay: 100ms;
    }

    @keyframes front-enter {
      from { opacity: 0; transform: translateY(6px); }
    }

    .front-page__vol {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: var(--color-text-muted);
      margin-bottom: var(--space-2);
    }

    .front-page__headline {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: clamp(1.5rem, 4vw, 2.5rem);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      line-height: 1.1;
      margin: 0 0 var(--space-2);
      color: var(--color-text-primary);
    }

    .front-page__subhead {
      font-family: var(--font-sans);
      font-size: var(--text-base);
      font-style: italic;
      line-height: 1.5;
      color: var(--color-text-secondary);
      margin-bottom: var(--space-3);
      max-width: 60ch;
    }

    .front-page__rule {
      border: none;
      border-top: var(--chron-rule-thin) solid var(--color-border);
      margin: 0 0 var(--space-4);
    }

    /* ── Article body — multi-column broadsheet ─ */

    .article {
      column-count: 2;
      column-gap: var(--space-6);
      column-rule: var(--chron-rule-thin) solid var(--color-border-light);
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      line-height: 1.8;
      color: var(--color-text-primary);
      text-align: justify;
      hyphens: auto;
    }

    .article p {
      margin: 0 0 var(--space-3);
    }

    .article p:first-of-type::first-letter {
      float: left;
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: 3.2em;
      line-height: 0.8;
      padding-right: 0.08em;
      padding-top: 0.05em;
      color: var(--color-primary);
    }

    .article__footer {
      column-span: all;
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding-top: var(--space-3);
      margin-top: var(--space-2);
      border-top: var(--chron-rule-thin) solid var(--color-border-light);
      font-family: var(--font-brutalist);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-text-muted);
      flex-wrap: wrap;
    }

    /* ── Ornamental divider ──────────────────── */

    .ornament {
      text-align: center;
      padding: var(--space-4) 0 var(--space-2);
      font-size: var(--text-xs);
      color: var(--color-primary);
      letter-spacing: 0.5em;
      opacity: 0.6;
    }

    /* ── Archive index ───────────────────────── */

    .archive {
      border-top: var(--chron-rule-thick) solid var(--color-primary);
      padding-top: var(--space-3);
    }

    .archive__heading {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.18em;
      color: var(--color-text-secondary);
      margin: 0 0 var(--space-3);
    }

    .archive__list {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .archive__item {
      display: flex;
      align-items: baseline;
      gap: var(--space-3);
      padding: var(--space-2) 0;
      border-bottom: var(--chron-rule-thin) solid var(--color-border-light);
      cursor: pointer;
      transition: background var(--transition-fast);
      animation: archive-enter 300ms cubic-bezier(0.22, 1, 0.36, 1) both;
      animation-delay: var(--archive-delay, 0ms);
    }

    @keyframes archive-enter {
      from { opacity: 0; transform: translateX(-4px); }
    }

    .archive__item:hover {
      background: color-mix(in srgb, var(--color-primary) 4%, transparent);
    }

    .archive__item:focus-visible {
      outline: 2px solid var(--color-border-focus);
      outline-offset: -2px;
    }

    .archive__item--active {
      background: color-mix(in srgb, var(--color-primary) 6%, transparent);
    }

    .archive__num {
      flex-shrink: 0;
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: var(--text-sm);
      color: var(--color-primary);
      min-width: 2.5ch;
      text-align: right;
    }

    .archive__title {
      flex: 1;
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      line-height: 1.3;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .archive__date {
      flex-shrink: 0;
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--color-text-muted);
      letter-spacing: 0.04em;
    }

    .archive__dots {
      flex: 0 1 auto;
      border-bottom: 1px dotted var(--color-border-light);
      min-width: var(--space-4);
      height: 0;
      align-self: center;
    }

    /* ── Reduced motion ──────────────────────── */

    @media (prefers-reduced-motion: reduce) {
      .broadsheet,
      .front-page,
      .archive__item {
        animation: none;
      }
    }

    /* ── Mobile ──────────────────────────────── */

    @media (max-width: 600px) {
      .broadsheet {
        padding: var(--space-2);
      }

      .article {
        column-count: 1;
      }

      .editorial {
        flex-direction: column;
        align-items: stretch;
      }

      .editorial__btn {
        justify-content: center;
        padding: var(--space-2) var(--space-3);
        min-height: 44px;
      }

      .dateline {
        flex-direction: column;
        gap: var(--space-1);
        text-align: center;
      }

      .archive__item {
        flex-wrap: wrap;
      }

      .archive__dots {
        display: none;
      }
    }
  `;

  @property({ type: String }) simulationId = '';

  @state() private _chronicles: Chronicle[] = [];
  @state() private _total = 0;
  @state() private _loading = true;
  @state() private _error: string | null = null;
  @state() private _limit = 25;
  @state() private _offset = 0;
  @state() private _expandedId: string | null = null;
  @state() private _generating = false;
  @state() private _periodStart = '';
  @state() private _periodEnd = '';

  private get _canEdit(): boolean {
    return appState.canEdit.value;
  }

  /** The currently featured (expanded) edition, defaults to latest. */
  private get _featured(): Chronicle | null {
    if (this._chronicles.length === 0) return null;
    if (this._expandedId) {
      return this._chronicles.find((c) => c.id === this._expandedId) ?? this._chronicles[0];
    }
    return this._chronicles[0];
  }

  /** All editions except the featured one, for the archive index. */
  private get _archiveEditions(): Chronicle[] {
    const featured = this._featured;
    if (!featured) return [];
    return this._chronicles.filter((c) => c.id !== featured.id);
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._initDates();
    this._load();
  }

  disconnectedCallback(): void {
    seoService.removeStructuredData();
    super.disconnectedCallback();
  }

  protected willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('simulationId') && this.simulationId) {
      this._offset = 0;
      this._load();
    }
  }

  private _initDates(): void {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    this._periodEnd = now.toISOString().slice(0, 10);
    this._periodStart = weekAgo.toISOString().slice(0, 10);
  }

  private async _load(): Promise<void> {
    if (!this.simulationId) return;
    this._loading = true;
    this._error = null;
    try {
      const resp = await chronicleApi.list(this.simulationId, {
        limit: this._limit,
        offset: this._offset,
      });
      if (resp.success && resp.data) {
        this._chronicles = resp.data;
        this._total = resp.meta?.total ?? resp.data.length;
        if (resp.data.length > 0) {
          const featured = resp.data[0];
          const sim = appState.currentSimulation.value;
          if (sim) {
            seoService.setArticle({
              headline: featured.title ?? sim.name,
              articleBody: (featured.content ?? '').slice(0, 500),
              url: `https://metaverse.center/simulations/${sim.slug}/chronicle`,
              datePublished: featured.published_at ?? undefined,
            });
          }
        }
      } else if (!resp.success) {
        this._error = resp.error?.message ?? msg('Failed to load chronicles.');
      }
    } catch {
      this._error = msg('Failed to load chronicles.');
    } finally {
      this._loading = false;
    }
  }

  private async _generate(): Promise<void> {
    if (!this._periodStart || !this._periodEnd || this._generating) return;
    this._generating = true;
    this._error = null;
    try {
      const resp = await chronicleApi.generate(this.simulationId, {
        period_start: new Date(this._periodStart).toISOString(),
        period_end: new Date(this._periodEnd).toISOString(),
      });
      if (resp.success && resp.data) {
        this._offset = 0;
        await this._load();
        this._expandedId = resp.data.id;
      } else if (!resp.success) {
        this._error = resp.error?.message ?? msg('Failed to generate chronicle.');
      }
    } catch (err) {
      this._error = err instanceof Error ? err.message : msg('Failed to generate chronicle.');
    } finally {
      this._generating = false;
    }
  }

  private _selectEdition(id: string): void {
    this._expandedId = id;
  }

  private _handlePageChange(e: CustomEvent): void {
    this._limit = e.detail.limit;
    this._offset = e.detail.offset;
    this._load();
  }

  private get _dateLocale(): string {
    return localeService.currentLocale === 'de' ? 'de-DE' : 'en-GB';
  }

  private _formatDateRange(start: string, end: string): string {
    const s = new Date(start);
    const e = new Date(end);
    const locale = this._dateLocale;
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    return `${s.toLocaleDateString(locale, opts)} \u2013 ${e.toLocaleDateString(locale, opts)}`;
  }

  private _formatShortDate(start: string, end: string): string {
    const s = new Date(start);
    const e = new Date(end);
    const locale = this._dateLocale;
    const o: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${s.toLocaleDateString(locale, o)} \u2013 ${e.toLocaleDateString(locale, o)}`;
  }

  private _renderArticle(content: string) {
    // Replace literal \n sequences (backslash + n) with actual newlines
    const cleaned = content.replace(/\\n/g, '\n');
    const paragraphs = cleaned.split(/\n\n+/).filter(Boolean);
    return paragraphs.map((p) => html`<p>${p.trim()}</p>`);
  }

  protected render() {
    return html`
      <div class="broadsheet">
        ${this._renderMasthead()}
        ${this._canEdit ? this._renderEditorial() : nothing}

        ${this._canEdit
          ? html`<velg-chronicle-export .simulationId=${this.simulationId}></velg-chronicle-export>`
          : nothing}

        ${this._loading
          ? html`<velg-loading-state message=${msg('Loading chronicles...')}></velg-loading-state>`
          : this._error
            ? html`<velg-error-state message=${this._error} show-retry @retry=${this._load}></velg-error-state>`
            : this._chronicles.length === 0
              ? html`<velg-empty-state message=${msg('No chronicle editions yet.')}></velg-empty-state>`
              : this._renderBroadsheet()}
      </div>
    `;
  }

  private get _publicationName(): string {
    const sim = appState.currentSimulation.value;
    if (!sim) return msg('The Chronicle');
    return `${msg('The')} ${sim.name} ${msg('Chronicle')}`;
  }

  private _renderMasthead() {
    const simName = appState.currentSimulation.value?.name ?? '';
    const today = new Date().toLocaleDateString(this._dateLocale, {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    return html`
      <header class="masthead">
        <hr class="masthead__rule--top" />
        <hr class="masthead__rule--thin" />
        <h1 class="masthead__title">${this._publicationName}</h1>
        <div class="masthead__subtitle">${msg('Official Record of Events')}</div>
        <hr class="masthead__rule--bottom" />
        <hr class="masthead__rule--bottom-thick" />
      </header>
      <div class="dateline">
        <span class="dateline__sim">${simName}</span>
        <span>${today}</span>
      </div>
    `;
  }

  private _renderEditorial() {
    return html`
      <div class="editorial">
        <div class="editorial__field">
          <label class="editorial__label">${msg('Period start')}</label>
          <input
            class="editorial__input"
            type="date"
            .value=${this._periodStart}
            @change=${(e: Event) => { this._periodStart = (e.target as HTMLInputElement).value; }}
          />
        </div>
        <div class="editorial__field">
          <label class="editorial__label">${msg('Period end')}</label>
          <input
            class="editorial__input"
            type="date"
            .value=${this._periodEnd}
            @change=${(e: Event) => { this._periodEnd = (e.target as HTMLInputElement).value; }}
          />
        </div>
        <button
          class="editorial__btn"
          ?disabled=${this._generating || !this._periodStart || !this._periodEnd}
          @click=${this._generate}
        >
          ${icons.sparkle(12)}
          ${this._generating ? msg('Generating...') : msg('Generate edition')}
        </button>
      </div>
    `;
  }

  private _renderBroadsheet() {
    const featured = this._featured;
    if (!featured) return nothing;

    return html`
      ${this._renderFrontPage(featured)}

      ${this._archiveEditions.length > 0
        ? html`
          <div class="ornament" aria-hidden="true">\u2736 \u2736 \u2736</div>
          ${this._renderArchive()}
        `
        : nothing}

      <velg-pagination
        .total=${this._total}
        .limit=${this._limit}
        .offset=${this._offset}
        @page-change=${this._handlePageChange}
      ></velg-pagination>
    `;
  }

  private _renderFrontPage(c: Chronicle) {
    return html`
      <article class="front-page">
        <div class="front-page__vol">
          ${msg('Vol.')} ${c.edition_number} \u2014 ${this._formatDateRange(c.period_start, c.period_end)}
        </div>
        <h2 class="front-page__headline">${t(c, 'title')}</h2>
        ${c.headline
          ? html`<div class="front-page__subhead">${t(c, 'headline')}</div>`
          : nothing}
        <hr class="front-page__rule" />
        <div class="article">
          ${this._renderArticle(t(c, 'content'))}
          <footer class="article__footer">
            ${c.model_used
              ? html`<span>${msg('Model:')} ${c.model_used}</span>`
              : nothing}
            ${c.published_at
              ? html`<span>${new Date(c.published_at).toLocaleDateString(this._dateLocale)}</span>`
              : nothing}
          </footer>
        </div>
      </article>
    `;
  }

  private _renderArchive() {
    return html`
      <nav class="archive" aria-label=${msg('Previous Editions')}>
        <h3 class="archive__heading">${msg('Previous Editions')}</h3>
        <ul class="archive__list">
          ${this._archiveEditions.map(
            (c, i) => html`
              <li
                class="archive__item ${this._expandedId === c.id ? 'archive__item--active' : ''}"
                style="--archive-delay: ${i * 40}ms"
                tabindex="0"
                role="button"
                aria-label="${msg('Vol.')} ${c.edition_number}: ${t(c, 'title')}"
                @click=${() => this._selectEdition(c.id)}
                @keydown=${(e: KeyboardEvent) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this._selectEdition(c.id);
                  }
                }}
              >
                <span class="archive__num">${c.edition_number}</span>
                <span class="archive__title">${t(c, 'title')}</span>
                <span class="archive__dots"></span>
                <span class="archive__date">${this._formatShortDate(c.period_start, c.period_end)}</span>
              </li>
            `,
          )}
        </ul>
      </nav>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-chronicle-view': VelgChronicleView;
  }
}
