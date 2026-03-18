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
import { chronicleApi } from '../../services/api/ChronicleApiService.js';
import { seoService } from '../../services/SeoService.js';
import { appState } from '../../services/AppStateManager.js';
import { getThemeColor } from '../../utils/theme-colors.js';
import type { Chronicle } from '../../types/index.js';
import '../shared/PlatformFooter.js';

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
  static styles = css`
    :host {
      display: block;
      background: var(--color-surface);
      color: var(--color-text-primary);
      min-height: 100vh;
    }

    /* ── Wire Header ───────────────────────── */

    .wire-header {
      padding: var(--space-16, 64px) var(--space-6, 24px) var(--space-6, 24px);
      text-align: center;
      position: relative;
      overflow: hidden;
    }

    .wire-header::before {
      content: '';
      position: absolute;
      inset: 0;
      background:
        radial-gradient(ellipse at 50% 0%, color-mix(in srgb, var(--color-primary) 4%, transparent) 0%, transparent 60%);
      pointer-events: none;
    }

    .wire-header__classification {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: 10px;
      letter-spacing: 5px;
      text-transform: uppercase;
      color: var(--color-accent-amber);
      margin: 0 0 var(--space-4, 16px);
    }

    .wire-header__title {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: clamp(1.5rem, 4vw, 2.5rem);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist, 0.15em);
      color: var(--color-text-primary);
      margin: 0 0 var(--space-3, 12px);
      line-height: 1.1;
    }

    .wire-header__subtitle {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: clamp(0.75rem, 1.2vw, 0.875rem);
      color: var(--color-text-secondary);
      max-width: 640px;
      margin: 0 auto;
      line-height: 1.6;
      letter-spacing: 0.5px;
    }

    /* ── Ticker ─────────────────────────────── */

    .wire-ticker {
      border-top: 1px solid var(--color-border);
      border-bottom: 1px solid var(--color-border);
      padding: 10px 0;
      overflow: hidden;
      position: relative;
      margin-bottom: var(--space-10, 40px);
    }

    .wire-ticker__track {
      display: flex;
      gap: 48px;
      animation: ticker-scroll 40s linear infinite;
      width: max-content;
    }

    .wire-ticker__item {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 11px;
      letter-spacing: 1px;
      color: var(--color-text-muted);
      white-space: nowrap;
      flex-shrink: 0;
    }

    .wire-ticker__dot {
      display: inline-block;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      margin-right: 8px;
      vertical-align: middle;
    }

    @keyframes ticker-scroll {
      from { transform: translateX(0); }
      to   { transform: translateX(-50%); }
    }

    @media (prefers-reduced-motion: reduce) {
      .wire-ticker__track {
        animation: none;
        flex-wrap: wrap;
        justify-content: center;
      }
    }

    /* ── Feed Container ─────────────────────── */

    .feed {
      max-width: 760px;
      margin: 0 auto;
      padding: 0 var(--space-6, 24px) var(--space-12, 48px);
    }

    /* ── Dispatch Entry ─────────────────────── */

    .dispatch {
      position: relative;
      padding: var(--space-6, 24px) 0 var(--space-8, 32px);
      border-bottom: 1px solid var(--color-separator);
    }

    .dispatch:last-child {
      border-bottom: none;
    }

    /* Color accent bar */
    .dispatch__accent {
      position: absolute;
      left: -20px;
      top: var(--space-6, 24px);
      bottom: var(--space-8, 32px);
      width: 3px;
    }

    /* Simulation attribution */
    .dispatch__source {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: var(--space-3, 12px);
    }

    .dispatch__source-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .dispatch__source-name {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: 10px;
      letter-spacing: 2px;
      text-transform: uppercase;
    }

    .dispatch__source-link {
      color: inherit;
      text-decoration: none;
      transition: color 200ms;
    }

    .dispatch__source-link:hover {
      color: var(--color-accent-amber);
    }

    .dispatch__meta {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 10px;
      color: var(--color-text-muted);
      letter-spacing: 1px;
    }

    /* Masthead */
    .dispatch__masthead {
      font-family: var(--font-bureau, 'Spectral', Georgia, serif);
      font-size: 13px;
      color: var(--color-text-muted);
      font-style: italic;
      margin-bottom: var(--space-2, 8px);
    }

    /* Headline */
    .dispatch__headline {
      font-family: var(--font-bureau, 'Spectral', Georgia, serif);
      font-size: clamp(1.1rem, 2vw, 1.4rem);
      font-weight: 700;
      line-height: 1.35;
      color: var(--color-text-primary);
      margin: 0 0 var(--space-3, 12px);
    }

    /* Content preview */
    .dispatch__excerpt {
      font-family: var(--font-bureau, 'Spectral', Georgia, serif);
      font-size: 15px;
      line-height: 1.7;
      color: var(--color-text-secondary);
      display: -webkit-box;
      -webkit-line-clamp: 4;
      -webkit-box-orient: vertical;
      overflow: hidden;
      margin: 0 0 var(--space-4, 16px);
    }

    /* Read more link */
    .dispatch__read-more {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: 10px;
      letter-spacing: 2px;
      text-transform: uppercase;
      text-decoration: none;
      transition: color 200ms;
    }

    .dispatch__read-more:hover {
      color: var(--color-accent-amber);
    }

    .dispatch__read-more-arrow {
      transition: transform 200ms;
    }

    .dispatch__read-more:hover .dispatch__read-more-arrow {
      transform: translateX(4px);
    }

    /* Decoded stamp */
    .dispatch__stamp {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: 9px;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--color-success-glow);
      margin-top: var(--space-3, 12px);
    }

    /* ── Scroll Reveal ─────────────────────── */

    .scroll-reveal {
      opacity: 0;
      transform: translateY(16px);
      transition:
        opacity 500ms cubic-bezier(0.22, 1, 0.36, 1),
        transform 500ms cubic-bezier(0.22, 1, 0.36, 1);
      transition-delay: calc(var(--i, 0) * 80ms);
    }

    .scroll-reveal.in-view {
      opacity: 1;
      transform: translateY(0);
    }

    /* ── Loading / Empty ───────────────────── */

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

    /* ── Pagination ─────────────────────────── */

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

    /* ── CTA ─────────────────────────────────── */

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

    /* ── Responsive ─────────────────────────── */

    @media (max-width: 640px) {
      .wire-header {
        padding: var(--space-10, 40px) var(--space-4, 16px) var(--space-4, 16px);
      }

      .dispatch__accent {
        left: -12px;
      }

      .feed {
        padding-left: var(--space-4, 16px);
        padding-right: var(--space-4, 16px);
      }
    }
  `;

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
            ...(c.simulation ? { author: { '@type': 'Organization', name: c.simulation.name } } : {}),
          },
        })),
      },
    });
  }

  private _navigate(path: string): void {
    this.dispatchEvent(
      new CustomEvent('navigate', { bubbles: true, composed: true, detail: path }),
    );
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
    const els = this.renderRoot.querySelectorAll('.scroll-reveal:not(.in-view)');
    for (const el of els) this._observer.observe(el);
  }

  private _formatDate(dateStr: string): string {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
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
    return firstPara.slice(0, maxLen).replace(/\s+\S*$/, '') + '...';
  }

  private _renderTicker() {
    // Build ticker items from loaded chronicles (duplicate for seamless scroll)
    const items = this._chronicles.slice(0, 8);
    if (items.length === 0) return nothing;

    const tickerItems = [...items, ...items].map((c) => {
      const sim = (c as FeedChronicle).simulation;
      const color = sim ? getThemeColor(sim.theme) : 'var(--color-text-muted)';
      const headline = c.headline || c.title;
      return html`
        <span class="wire-ticker__item">
          <span class="wire-ticker__dot" style="background: ${color}"></span>
          ${headline}
        </span>
      `;
    });

    return html`
      <div class="wire-ticker">
        <div class="wire-ticker__track">${tickerItems}</div>
      </div>
    `;
  }

  private _renderDispatch(chronicle: FeedChronicle, index: number) {
    const sim = chronicle.simulation;
    const themeColor = sim ? getThemeColor(sim.theme) : 'var(--color-text-muted)';
    const simSlug = sim?.slug ?? '';
    const simName = sim?.name ?? msg('Unknown World');
    const readMoreHref = sim
      ? `/simulations/${simSlug}/chronicle`
      : '#';

    return html`
      <article class="dispatch scroll-reveal" style="--i: ${index}">
        <div class="dispatch__accent" style="background: ${themeColor}"></div>

        <div class="dispatch__source">
          <span class="dispatch__source-dot" style="background: ${themeColor}"></span>
          <a
            class="dispatch__source-link"
            href="/simulations/${simSlug}/lore"
            @click=${(e: Event) => {
              e.preventDefault();
              if (simSlug) this._navigate(`/simulations/${simSlug}/lore`);
            }}
          >
            <span class="dispatch__source-name">${simName}</span>
          </a>
          <span class="dispatch__meta">
            ${msg('Edition')} #${chronicle.edition_number}
            &middot;
            ${this._formatDate(chronicle.created_at)}
          </span>
        </div>

        <p class="dispatch__masthead">${chronicle.title}</p>

        ${chronicle.headline
          ? html`<h2 class="dispatch__headline">${chronicle.headline}</h2>`
          : nothing}

        <p class="dispatch__excerpt">${this._excerpt(chronicle.content)}</p>

        <a
          class="dispatch__read-more"
          href=${readMoreHref}
          style="color: ${themeColor}"
          @click=${(e: Event) => {
            e.preventDefault();
            if (simSlug) this._navigate(`/simulations/${simSlug}/chronicle`);
          }}
        >
          ${msg('Read Full Edition')}
          <span class="dispatch__read-more-arrow">\u2192</span>
        </a>

        <div class="dispatch__stamp">${msg('Decoded')} // ${this._formatDate(chronicle.created_at)}</div>
      </article>
    `;
  }

  protected render() {
    const isGuest = !appState.isAuthenticated.value;

    return html`
      <div class="wire-header">
        <p class="wire-header__classification">${msg('Multiverse Intelligence Wire')}</p>
        <h1 class="wire-header__title">${msg('The Chronicle Feed')}</h1>
        <p class="wire-header__subtitle">
          ${msg('Every world writes its own newspaper. This is the wire service — AI-generated broadsheets from every active simulation, decoded and delivered in real time.')}
        </p>
      </div>

      ${this._renderTicker()}

      ${this._loading
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

                ${this._total > this._limit
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
                  : nothing}
              </div>
            `}

      ${isGuest
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
                  this._navigate('/register');
                }}
              >
                ${msg('Build Your World')}
              </a>
            </div>
          `
        : nothing}

      <velg-platform-footer></velg-platform-footer>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-chronicle-feed': VelgChronicleFeed;
  }
}
