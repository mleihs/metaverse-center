/**
 * VelgSimulationBroadsheet — Theme-adaptive newspaper view per simulation.
 *
 * Aggregates all four news sources (events, activities, resonances, gazette)
 * into a single "finishable" broadsheet edition with:
 *   - Zetland principle: max 7 articles per edition
 *   - de Volkskrant grid: hero + multi-column + sidebar layout
 *   - Frostpunk moral mirror: health-responsive editorial voice
 *   - Semafor structure: clear source attribution per article
 *
 * Route: /simulations/{slug}/broadsheet
 *
 * @element velg-simulation-broadsheet
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { broadsheetApi } from '../../services/api/index.js';
import { seoService } from '../../services/SeoService.js';
import type { ApiResponse, Broadsheet, BroadsheetArticle } from '../../types/index.js';
import { formatDateRange, formatShortDateRange, getDateLocale } from '../../utils/date-format.js';
import { icons } from '../../utils/icons.js';
import { t } from '../../utils/locale-fields.js';
import { getThemeColor } from '../../utils/theme-colors.js';
import { VelgConfirmDialog } from '../shared/ConfirmDialog.js';
import { dispatchStyles } from '../shared/dispatch-styles.js';
import { PaginatedLoaderMixin } from '../shared/PaginatedLoaderMixin.js';
import { VelgToast } from '../shared/Toast.js';
import { broadsheetStyles } from './broadsheet-styles.js';

import '../shared/Pagination.js';
import '../shared/VelgDispatchMasthead.js';
import '../shared/VelgDispatchTicker.js';
import '../shared/VelgDispatchStamp.js';
import './BroadsheetHealthHero.js';
import './BroadsheetHeroArticle.js';
import './BroadsheetArticle.js';
import './BroadsheetGazetteWire.js';

/** Theme-specific "end" symbols per the spec (Zetland "finishable" marker). */
const COMPLETE_MARKS: Record<string, string> = {
  brutalist: '///',
  'sunless-sea': '~',
  cyberpunk: '[EOF]',
  'illuminated-literary': 'Finis.',
  'deep-space-horror': '> END TRANSMISSION_',
  vbdos: 'C:\\> EXIT',
  solarpunk: '\u2736',
  'nordic-noir': '\u2014',
  'arc-raiders': '\u2736 \u2736 \u2736',
  'deep-fried-horror': '!!!',
};

@localized()
@customElement('velg-simulation-broadsheet')
export class VelgSimulationBroadsheet extends PaginatedLoaderMixin(LitElement) {
  static styles = [
    dispatchStyles,
    broadsheetStyles,
    css`
      :host {
        display: block;
        --_accent: var(--color-primary);
      }

      /* ── Masthead Wrapper ────────────────────── */

      .broadsheet__masthead {
        grid-column: 1 / -1;
      }

      .broadsheet__ticker {
        grid-column: 1 / -1;
        border-bottom: 1px solid var(--color-border-light);
        padding-bottom: var(--space-2);
      }

      /* Empty/loading/error states — span full grid width + center */
      velg-empty-state,
      velg-loading-state,
      velg-error-state,
      velg-pagination {
        grid-column: 1 / -1;
      }

      /* ── Editorial Controls ──────────────────── */

      .editorial {
        grid-column: 1 / -1;
        display: flex;
        align-items: flex-end;
        gap: var(--space-3);
        padding: var(--space-3) 0;
        border-bottom: 1px solid var(--color-border);
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
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        border: 1px solid var(--color-border);
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
        min-height: 36px;
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

      /* ── Press Status (during generation) ──── */

      .press-status {
        grid-column: 1 / -1;
        display: grid;
        grid-template-columns: auto 1fr auto;
        grid-template-rows: auto auto;
        gap: var(--space-1) var(--space-3);
        padding: var(--space-3) 0;
        border-bottom: 1px solid var(--color-border);
        animation: press-enter 400ms var(--ease-dramatic) both;
      }

      @keyframes press-enter {
        from { opacity: 0; transform: translateY(-4px); }
      }

      .press-status__icon {
        grid-row: 1 / 3;
        align-self: center;
        color: var(--color-primary);
        animation: press-pulse 1.5s ease-in-out infinite;
      }

      @keyframes press-pulse {
        0%, 100% { opacity: 0.5; }
        50% { opacity: 1; }
      }

      .press-status__body {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .press-status__headline {
        font-family: var(--font-brutalist);
        font-weight: var(--font-black);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--color-text-primary);
      }

      .press-status__phase {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--color-text-muted);
      }

      .press-status__elapsed {
        grid-row: 1 / 3;
        align-self: center;
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--color-text-muted);
        min-width: 3ch;
        text-align: right;
      }

      .press-status__bar {
        grid-column: 1 / -1;
        height: 2px;
        background: var(--color-border-light);
        overflow: hidden;
      }

      .press-status__bar-fill {
        height: 100%;
        width: 30%;
        background: var(--color-primary);
        animation: press-bar 2s ease-in-out infinite;
      }

      @keyframes press-bar {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(400%); }
      }

      /* ── Responsive ──────────────────────────── */

      @media (max-width: 640px) {
        .editorial {
          flex-direction: column;
          align-items: stretch;
        }
        .editorial__btn {
          justify-content: center;
          min-height: 44px;
        }
      }

      /* ── Reduced Motion ──────────────────────── */

      @media (prefers-reduced-motion: reduce) {
        .press-status {
          animation: none;
        }
        .press-status__icon {
          animation: none;
          opacity: 1;
        }
        .press-status__bar-fill {
          animation: none;
          width: 100%;
        }
      }
    `,
  ];

  @property({ type: String }) simulationId = '';

  @state() private _expandedId: string | null = null;
  @state() private _generating = false;
  @state() private _generatingElapsed = 0;
  @state() private _periodStart = '';
  @state() private _periodEnd = '';

  private _elapsedTimer: ReturnType<typeof setInterval> | null = null;

  /* ── PaginatedLoaderMixin contract ─────────── */

  protected get _broadsheets(): Broadsheet[] {
    return (this._data as Broadsheet[]) ?? [];
  }

  protected async _fetchData(): Promise<ApiResponse<Broadsheet[]>> {
    return broadsheetApi.list(
      this.simulationId,
      appState.currentSimulationMode.value,
      this._buildParams(),
    );
  }

  protected _getLoadingMessage(): string {
    return msg('Loading broadsheet...');
  }

  protected _getEmptyMessage(): string {
    return msg('No broadsheet editions yet.');
  }

  protected _getErrorFallback(): string {
    return msg('Failed to load broadsheet.');
  }

  protected _onDataLoaded(): void {
    const editions = this._broadsheets;
    if (editions.length === 0) return;
    const latest = editions[0];
    const sim = appState.currentSimulation.value;
    if (!sim) return;

    seoService.setOgType('article');
    seoService.setArticleMeta({
      publishedTime: latest.published_at ?? undefined,
      author: t(sim, 'name'),
      section: 'Broadsheet',
    });
    seoService.setArticle({
      headline: latest.title ?? t(sim, 'name'),
      articleBody: (latest.articles?.[0]?.content ?? '').slice(0, 500),
      url: `https://metaverse.center/simulations/${sim.slug}/broadsheet`,
      datePublished: latest.published_at ?? undefined,
    });
  }

  /* ── Computed ─────────────────────────────────── */

  private get _canEdit(): boolean {
    return appState.canEdit.value;
  }

  private get _featured(): Broadsheet | null {
    if (this._broadsheets.length === 0) return null;
    if (this._expandedId) {
      return this._broadsheets.find((b) => b.id === this._expandedId) ?? this._broadsheets[0];
    }
    return this._broadsheets[0];
  }

  private get _archiveEditions(): Broadsheet[] {
    const featured = this._featured;
    if (!featured) return [];
    return this._broadsheets.filter((b) => b.id !== featured.id);
  }

  private get _themePreset(): string {
    return appState.currentSimulation.value?.theme ?? 'brutalist';
  }

  private get _themeColor(): string {
    const sim = appState.currentSimulation.value;
    return sim ? getThemeColor(sim.theme) : '';
  }

  private get _atmosphereClass(): string {
    const preset = this._themePreset;
    switch (preset) {
      case 'cyberpunk':
      case 'deep-space-horror':
      case 'vbdos':
        return 'broadsheet--scanlines';
      case 'sunless-sea':
      case 'illuminated-literary':
      case 'arc-raiders':
        return 'broadsheet--textured';
      default:
        return '';
    }
  }

  /* ── Lifecycle ───────────────────────────────── */

  connectedCallback(): void {
    this._initDates();
    super.connectedCallback();
  }

  disconnectedCallback(): void {
    if (this._elapsedTimer) {
      clearInterval(this._elapsedTimer);
      this._elapsedTimer = null;
    }
    seoService.removeStructuredData();
    super.disconnectedCallback();
  }

  private _initDates(): void {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    this._periodEnd = now.toISOString().slice(0, 10);
    this._periodStart = weekAgo.toISOString().slice(0, 10);
  }

  /* ── Generation ──────────────────────────────── */

  private _hasDuplicatePeriod(): boolean {
    return this._broadsheets.some(
      (b) =>
        b.period_start?.slice(0, 10) === this._periodStart &&
        b.period_end?.slice(0, 10) === this._periodEnd,
    );
  }

  private async _generate(): Promise<void> {
    if (!this._periodStart || !this._periodEnd || this._generating) return;

    if (this._hasDuplicatePeriod()) {
      const proceed = await VelgConfirmDialog.show({
        title: msg('Duplicate period'),
        message: msg('An edition for this exact period already exists. Generate another?'),
        confirmLabel: msg('Generate'),
      });
      if (!proceed) return;
    }

    this._generating = true;
    this._generatingElapsed = 0;
    this._error = null;

    this._elapsedTimer = setInterval(() => {
      this._generatingElapsed++;
    }, 1000);

    try {
      const resp = await broadsheetApi.generate(this.simulationId, {
        period_start: new Date(this._periodStart).toISOString(),
        period_end: new Date(this._periodEnd).toISOString(),
      });
      if (resp.success && resp.data) {
        this._offset = 0;
        await this._load();
        this._expandedId = resp.data.id;
        VelgToast.success(msg('Broadsheet edition compiled.'));
        await this.updateComplete;
        this.renderRoot.querySelector('.broadsheet__hero')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      } else if (!resp.success) {
        const detail = resp.error?.message ?? msg('Failed to compile broadsheet.');
        this._error = detail;
        VelgToast.error(detail);
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : msg('Failed to compile broadsheet.');
      this._error = detail;
      VelgToast.error(detail);
    } finally {
      this._generating = false;
      this._generatingElapsed = 0;
      if (this._elapsedTimer) {
        clearInterval(this._elapsedTimer);
        this._elapsedTimer = null;
      }
    }
  }

  private _selectEdition(id: string): void {
    this._expandedId = id;
  }

  /* ── Render ──────────────────────────────────── */

  protected render() {
    const sim = appState.currentSimulation.value;
    const simName = sim?.name ?? '';
    const atmosphere = this._atmosphereClass;

    return html`
      <div class="broadsheet ${atmosphere}">
        <div class="broadsheet__progress" aria-hidden="true"></div>

        <div class="broadsheet__masthead">
          <velg-dispatch-masthead
            classification=${msg('Bureau Gazette')}
            title="${msg('The')} ${simName} ${msg('Broadsheet')}"
            subtitle=${
              this._featured
                ? `${msg('Edition')} #${this._featured.edition_number}`
                : msg('Awaiting first edition')
            }
            themeColor=${this._themeColor}
          ></velg-dispatch-masthead>
        </div>

        ${this._canEdit ? this._renderEditorial() : nothing}

        ${this._renderDataGuard(() => this._renderBroadsheet())}
      </div>
    `;
  }

  private _renderEditorial() {
    if (this._generating) return this._renderPressStatus();

    return html`
      <div class="editorial">
        <label class="editorial__field">
          <span class="editorial__label">${msg('Period start')}</span>
          <input
            class="editorial__input"
            type="date"
            .value=${this._periodStart}
            @change=${(e: Event) => {
              this._periodStart = (e.target as HTMLInputElement).value;
            }}
          />
        </label>
        <label class="editorial__field">
          <span class="editorial__label">${msg('Period end')}</span>
          <input
            class="editorial__input"
            type="date"
            .value=${this._periodEnd}
            @change=${(e: Event) => {
              this._periodEnd = (e.target as HTMLInputElement).value;
            }}
          />
        </label>
        <button
          class="editorial__btn"
          ?disabled=${!this._periodStart || !this._periodEnd}
          @click=${this._generate}
        >
          ${icons.sparkle(12)}
          ${msg('Compile edition')}
        </button>
      </div>
    `;
  }

  private _renderPressStatus() {
    const elapsed = this._generatingElapsed;
    let phase: string;
    if (elapsed < 5) {
      phase = msg('Aggregating intelligence sources...');
    } else if (elapsed < 12) {
      phase = msg('Ranking articles by significance...');
    } else if (elapsed < 25) {
      phase = msg('Compiling broadsheet layout...');
    } else {
      phase = msg('Finalising print run...');
    }

    return html`
      <div class="press-status" role="status">
        <div class="press-status__icon">${icons.sparkle(16)}</div>
        <div class="press-status__body">
          <div class="press-status__headline">${msg('Press room active')}</div>
          <div class="press-status__phase" aria-live="polite">${phase}</div>
        </div>
        <div class="press-status__elapsed" aria-hidden="true">${elapsed}s</div>
        <div class="press-status__bar" aria-hidden="true">
          <div class="press-status__bar-fill"></div>
        </div>
      </div>
    `;
  }

  private _renderBroadsheet() {
    const featured = this._featured;
    if (!featured) return nothing;

    const articles = (featured.articles ?? []) as BroadsheetArticle[];
    const heroArticle = articles.find((a) => a.layout_hint === 'hero') ?? articles[0];
    const columnArticles = articles.filter((a) => a !== heroArticle && a.layout_hint !== 'ticker');
    const tickerItems = articles
      .filter((a) => a !== heroArticle)
      .slice(0, 6)
      .map((a) => ({ text: a.headline }));

    const voice = featured.editorial_voice ?? 'neutral';

    return html`
      ${
        voice === 'alarmed'
          ? html`<div class="broadsheet__breaking">${msg('Breaking News')} \u2013 ${msg('Situation Critical')}</div>`
          : nothing
      }

      ${
        tickerItems.length > 0
          ? html`
            <div class="broadsheet__ticker">
              <velg-dispatch-ticker .items=${tickerItems}></velg-dispatch-ticker>
            </div>
          `
          : nothing
      }

      ${
        heroArticle
          ? html`
            <div class="broadsheet__hero">
              <velg-broadsheet-hero-article
                .article=${heroArticle}
                voice=${voice}
              ></velg-broadsheet-hero-article>
            </div>
          `
          : nothing
      }

      <div class="broadsheet__columns">
        ${columnArticles.map(
          (article) => html`
            <velg-broadsheet-article .article=${article}></velg-broadsheet-article>
          `,
        )}
      </div>

      <div class="broadsheet__health">
        <velg-broadsheet-health-hero
          .health=${featured.health_snapshot}
          .mood=${featured.mood_snapshot}
          .statistics=${featured.statistics}
          voice=${voice}
        ></velg-broadsheet-health-hero>
      </div>

      <div class="broadsheet__wire">
        <velg-broadsheet-gazette-wire
          .entries=${featured.gazette_wire ?? []}
        ></velg-broadsheet-gazette-wire>
      </div>

      <div class="broadsheet__fold" data-label=${msg('Below the fold')}></div>

      ${this._renderFooter(featured)}
      ${this._archiveEditions.length > 0 ? this._renderArchive() : nothing}

      <velg-pagination
        .total=${this._total}
        .limit=${this._limit}
        .offset=${this._offset}
        @page-change=${this._handlePageChange}
      ></velg-pagination>
    `;
  }

  private _renderFooter(edition: Broadsheet) {
    const preset = this._themePreset;
    const mark = COMPLETE_MARKS[preset] ?? '\u2736 \u2736 \u2736';

    return html`
      <div class="broadsheet__footer">
        <div class="broadsheet__complete-mark">${mark}</div>
        <div class="broadsheet__complete-text">
          ${msg('You have read everything')} \u2013
          ${msg('Edition')} #${edition.edition_number} \u2013
          ${formatDateRange(edition.period_start, edition.period_end, { locale: getDateLocale() })}
        </div>
      </div>
    `;
  }

  private _renderArchive() {
    return html`
      <nav class="broadsheet__archive" aria-label=${msg('Previous Editions')}>
        <h3 class="broadsheet__archive-heading">${msg('Previous Editions')}</h3>
        <ul class="broadsheet__archive-list">
          ${this._archiveEditions.map(
            (b, i) => html`
              <li class="broadsheet__archive-item" style="--i: ${i}">
                <button
                  type="button"
                  class="broadsheet__archive-btn"
                  aria-label="${msg('Edition')} ${b.edition_number}: ${b.title}"
                  @click=${() => this._selectEdition(b.id)}
                >
                  <span class="broadsheet__archive-num">${b.edition_number}</span>
                  <span class="broadsheet__archive-title">${b.title}</span>
                  <span class="broadsheet__archive-date">
                    ${formatShortDateRange(b.period_start, b.period_end, { locale: getDateLocale() })}
                  </span>
                </button>
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
    'velg-simulation-broadsheet': VelgSimulationBroadsheet;
  }
}
