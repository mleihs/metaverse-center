/**
 * Chronicle Feed — Public multiverse news wire.
 *
 * Aesthetic: Reuters meets interdimensional surveillance. A decoded-transmission
 * wire service aggregating AI-generated broadsheets across all simulations.
 * Each entry is stamped with simulation theme color and arrives like a decoded dispatch.
 *
 * Route: /chronicles
 * Auth: None required (public page)
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { chronicleApi } from '../../services/api/ChronicleApiService.js';
import { seoService } from '../../services/SeoService.js';
import type { Chronicle } from '../../types/index.js';
import { formatDate } from '../../utils/date-format.js';
import { t } from '../../utils/locale-fields.js';
import { navigate } from '../../utils/navigation.js';
import { getThemeColor } from '../../utils/theme-colors.js';
import '../shared/PlatformFooter.js';
import '../shared/VelgDispatchMasthead.js';
import '../shared/VelgDispatchStamp.js';
import '../shared/VelgDispatchTicker.js';
import { dispatchStyles } from '../shared/dispatch-styles.js';
import type { TickerItem } from '../shared/VelgDispatchTicker.js';

/** Extended chronicle with simulation metadata from the cross-sim endpoint. */
interface FeedChronicle extends Chronicle {
  simulation?: {
    id: string;
    name: string;
    slug: string;
    theme: string;
    banner_url?: string;
  };
}

@localized()
@customElement('velg-chronicle-feed')
export class VelgChronicleFeed extends LitElement {
  static styles = [
    dispatchStyles,
    css`
      :host {
        display: block;
        background: var(--color-surface);
        color: var(--color-text-primary);
        min-height: 100vh;
      }

      /* ── Ticker spacing ──────────────────── */

      velg-dispatch-ticker {
        margin-bottom: var(--space-10, 40px);
      }

      /* ── Feed Container ──────────────────── */

      .feed {
        max-width: 760px;
        margin: 0 auto;
        padding: 0 var(--space-6, 24px) var(--space-12, 48px);
      }

      /* ── Article dispatch: source row ────── */

      .dispatch__source {
        margin-bottom: var(--space-3, 12px);
      }

      /* ── Headline spacing ────────────────── */

      .dispatch__headline {
        margin-bottom: var(--space-3, 12px);
      }

      /* ── Excerpt spacing ─────────────────── */

      .dispatch__excerpt {
        margin-bottom: var(--space-4, 16px);
      }

      /* ── Decoded stamp ───────────────────── */

      .dispatch__decoded {
        margin-top: var(--space-3, 12px);
      }

      /* ── Loading / Empty ─────────────────── */

      .feed-loading {
        display: flex;
        justify-content: center;
        padding: var(--space-16, 64px);
      }

      .feed-loading__text {
        font-family: var(--font-brutalist, 'Courier New', monospace);
        font-weight: 900;
        font-size: 12px;
        letter-spacing: 3px;
        text-transform: uppercase;
        color: var(--color-text-muted);
        animation: pulse-text 1.5s ease-in-out infinite;
      }

      @keyframes pulse-text {
        0%, 100% { opacity: 0.4; }
        50%      { opacity: 1; }
      }

      .feed-empty {
        text-align: center;
        padding: var(--space-16, 64px) var(--space-6, 24px);
      }

      .feed-empty__title {
        font-family: var(--font-brutalist, 'Courier New', monospace);
        font-weight: 900;
        font-size: 14px;
        letter-spacing: 3px;
        text-transform: uppercase;
        color: var(--color-text-secondary);
        margin: 0 0 var(--space-2, 8px);
      }

      .feed-empty__text {
        font-family: var(--font-mono, 'SF Mono', monospace);
        font-size: 13px;
        color: var(--color-text-muted);
      }

      /* ── Pagination ──────────────────────── */

      .feed-pagination {
        display: flex;
        justify-content: center;
        gap: var(--space-3, 12px);
        padding: var(--space-6, 24px) 0 var(--space-12, 48px);
      }

      .feed-pagination__btn {
        padding: 10px 20px;
        font-family: var(--font-brutalist, 'Courier New', monospace);
        font-weight: 900;
        font-size: 11px;
        letter-spacing: 2px;
        text-transform: uppercase;
        color: var(--color-text-secondary);
        background: transparent;
        border: 1px solid var(--color-border);
        cursor: pointer;
        transition: all 200ms;
      }

      .feed-pagination__btn:hover:not(:disabled) {
        border-color: var(--color-accent-amber);
        color: var(--color-accent-amber);
      }

      .feed-pagination__btn:disabled {
        opacity: 0.3;
        cursor: not-allowed;
      }

      /* ── CTA ─────────────────────────────── */

      .feed-cta {
        max-width: 600px;
        margin: 0 auto var(--space-12, 48px);
        padding: var(--space-6, 24px);
        text-align: center;
        border: 1px dashed var(--color-primary-glow);
      }

      .feed-cta__text {
        font-family: var(--font-mono, 'SF Mono', monospace);
        font-size: 13px;
        color: var(--color-text-secondary);
        margin: 0 0 var(--space-3, 12px);
        line-height: 1.6;
      }

      .feed-cta__btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 12px 28px;
        font-family: var(--font-brutalist, 'Courier New', monospace);
        font-weight: 900;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 3px;
        color: var(--color-surface);
        background: var(--color-accent-amber);
        border: none;
        cursor: pointer;
        text-decoration: none;
        transition: all 200ms;
      }

      .feed-cta__btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 0 20px var(--color-primary-glow);
      }

      /* ── Responsive ──────────────────────── */

      @media (max-width: 640px) {
        .feed {
          padding-left: var(--space-4, 16px);
          padding-right: var(--space-4, 16px);
        }
      }
    `,
  ];

  @state() private _chronicles: FeedChronicle[] = [];
  @state() private _loading = true;
  @state() private _total = 0;
  @state() private _offset = 0;

  private _limit = 15;
  private _observer?: IntersectionObserver;

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    await this._fetchChronicles();
  }

  protected firstUpdated(): void {
    this._setupScrollReveal();
  }

  protected updated(): void {
    this._setupScrollReveal();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._observer?.disconnect();
    seoService.removeStructuredData();
  }

  private async _fetchChronicles(): Promise<void> {
    this._loading = true;
    const resp = await chronicleApi.listGlobal({
      limit: this._limit,
      offset: this._offset,
    });
    if (resp.success && Array.isArray(resp.data)) {
      this._chronicles = resp.data as FeedChronicle[];
      this._total = resp.meta?.total ?? resp.data.length;
      this._injectStructuredData();
    }
    this._loading = false;
  }

  private _injectStructuredData(): void {
    if (this._chronicles.length === 0) return;
    seoService.setStructuredData({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'The Chronicle Feed',
      description:
        'Every world writes its own newspaper. Read AI-generated broadsheets from active simulations.',
      url: 'https://metaverse.center/chronicles',
      numberOfItems: this._total,
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: this._chronicles.length,
        itemListElement: this._chronicles.map((c, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'Article',
            headline: c.title ?? `Edition #${c.edition_number}`,
            datePublished: c.created_at,
            ...(c.simulation
              ? { author: { '@type': 'Organization', name: t(c.simulation, 'name') } }
              : {}),
          },
        })),
      },
    });
  }

  private _prevPage(): void {
    this._offset = Math.max(0, this._offset - this._limit);
    this._fetchChronicles();
  }

  private _nextPage(): void {
    this._offset += this._limit;
    this._fetchChronicles();
  }

  private _setupScrollReveal(): void {
    this._observer?.disconnect();
    this._observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            this._observer?.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.1 },
    );
    const els = this.renderRoot.querySelectorAll('.dispatch-scroll-reveal:not(.in-view)');
    for (const el of els) this._observer.observe(el);
  }

  /** Extract first paragraph or first N characters as excerpt. */
  private _excerpt(content: string, maxLen = 300): string {
    let text = content;
    // Strip JSON wrapper if the AI returned raw JSON in the content field.
    // After outer JSON parse, inner escapes are resolved so we can't re-parse.
    // Instead, find the "content" key and extract text after it.
    if (text.startsWith('```json') || text.startsWith('```\n{')) {
      const idx = text.indexOf('"content"');
      if (idx !== -1) {
        // Skip past "content": " to get to the actual text
        const start = text.indexOf('"', text.indexOf(':', idx) + 1);
        if (start !== -1) {
          text = text.slice(start + 1);
          // Remove trailing JSON close: "}\n```
          const endQuote = text.lastIndexOf('"');
          if (endQuote > 0) text = text.slice(0, endQuote);
        }
      }
    }
    // Normalize escaped newlines to real newlines
    text = text.replace(/\\n/g, '\n');
    // Take first paragraph
    const firstPara = text.split(/\n\n+/)[0]?.trim() ?? text;
    if (firstPara.length <= maxLen) return firstPara;
    return `${firstPara.slice(0, maxLen).replace(/\s+\S*$/, '')}...`;
  }

  private _buildTickerItems(): TickerItem[] {
    return this._chronicles.slice(0, 8).map((c) => {
      const sim = (c as FeedChronicle).simulation;
      return {
        text: c.headline || c.title || `Edition #${c.edition_number}`,
        color: sim ? getThemeColor(sim.theme) : undefined,
      };
    });
  }

  private _renderDispatch(chronicle: FeedChronicle, index: number) {
    const sim = chronicle.simulation;
    const themeColor = sim ? getThemeColor(sim.theme) : 'var(--color-text-muted)';
    const simSlug = sim?.slug ?? '';
    const simName = sim?.name ?? msg('Unknown World');
    const readMoreHref = sim ? `/simulations/${simSlug}/chronicle` : '#';

    return html`
      <article class="dispatch dispatch--article dispatch-scroll-reveal" style="--i: ${index}; --dispatch-accent: ${themeColor}">
        <div class="dispatch__accent"></div>

        <div class="dispatch__source">
          <span class="dispatch__source-dot"></span>
          <a
            class="dispatch__source-link"
            href="/simulations/${simSlug}/lore"
            @click=${(e: Event) => {
              e.preventDefault();
              if (simSlug) navigate(`/simulations/${simSlug}/lore`);
            }}
          >
            <span class="dispatch__source-name">${simName}</span>
          </a>
          <span class="dispatch__meta">
            ${msg('Edition')} #${chronicle.edition_number}
            &middot;
            ${formatDate(chronicle.created_at, { locale: 'en-US' })}
          </span>
        </div>

        <p class="dispatch__masthead">${chronicle.title}</p>

        ${
          chronicle.headline
            ? html`<h2 class="dispatch__headline">${chronicle.headline}</h2>`
            : nothing
        }

        <p class="dispatch__excerpt">${this._excerpt(chronicle.content)}</p>

        <a
          class="dispatch__read-more"
          href=${readMoreHref}
          @click=${(e: Event) => {
            e.preventDefault();
            if (simSlug) navigate(`/simulations/${simSlug}/chronicle`);
          }}
        >
          ${msg('Read Full Edition')}
          <span class="dispatch__read-more-arrow">\u2192</span>
        </a>

        <velg-dispatch-stamp
          class="dispatch__decoded"
          text="${msg('Decoded')} // ${formatDate(chronicle.created_at, { locale: 'en-US' })}"
          tone="success"
        ></velg-dispatch-stamp>
      </article>
    `;
  }

  protected render() {
    const isGuest = !appState.isAuthenticated.value;
    const tickerItems = this._buildTickerItems();

    return html`
      <velg-dispatch-masthead
        classification=${msg('Multiverse Intelligence Wire')}
        title=${msg('The Chronicle Feed')}
        subtitle=${msg('Every world writes its own newspaper. This is the wire service \u2013 AI-generated broadsheets from every active simulation, decoded and delivered in real time.')}
      ></velg-dispatch-masthead>

      ${
        tickerItems.length > 0
          ? html`<velg-dispatch-ticker .items=${tickerItems}></velg-dispatch-ticker>`
          : nothing
      }

      ${
        this._loading
          ? html`<div class="feed-loading"><span class="feed-loading__text">${msg('Decoding transmissions...')}</span></div>`
          : this._chronicles.length === 0
            ? html`
              <div class="feed-empty">
                <p class="feed-empty__title">${msg('No Dispatches')}</p>
                <p class="feed-empty__text">${msg('No chronicles have been published yet. Worlds are still writing their stories.')}</p>
              </div>
            `
            : html`
              <div class="feed">
                ${this._chronicles.map((c, i) => this._renderDispatch(c, i))}

                ${
                  this._total > this._limit
                    ? html`
                      <div class="feed-pagination">
                        <button
                          class="feed-pagination__btn"
                          ?disabled=${this._offset === 0}
                          @click=${this._prevPage}
                        >
                          ${msg('Previous')}
                        </button>
                        <button
                          class="feed-pagination__btn"
                          ?disabled=${this._offset + this._limit >= this._total}
                          @click=${this._nextPage}
                        >
                          ${msg('Next')}
                        </button>
                      </div>
                    `
                    : nothing
                }
              </div>
            `
      }

      ${
        isGuest
          ? html`
            <div class="feed-cta">
              <p class="feed-cta__text">
                ${msg('These stories write themselves. Build a world and watch it generate its own newspaper.')}
              </p>
              <a
                class="feed-cta__btn"
                href="/register"
                @click=${(e: Event) => {
                  e.preventDefault();
                  navigate('/register');
                }}
              >
                ${msg('Build Your World')}
              </a>
            </div>
          `
          : nothing
      }

      <velg-platform-footer></velg-platform-footer>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-chronicle-feed': VelgChronicleFeed;
  }
}
