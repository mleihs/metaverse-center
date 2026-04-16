/**
 * Worlds Gallery – Public showcase of player-created simulations.
 *
 * Aesthetic: Classified surveillance wall – each world card is a declassified
 * intelligence file under Bureau observation. Theme colors bleed outward on
 * hover like a portal trying to break containment.
 *
 * Route: /worlds
 * Auth: None required (public page)
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { simulationsApi } from '../../services/api/SimulationsApiService.js';
import { seoService } from '../../services/SeoService.js';
import type { Simulation } from '../../types/index.js';
import { t } from '../../utils/locale-fields.js';
import { getThemeColor } from '../../utils/theme-colors.js';
import '../shared/PlatformFooter.js';

@localized()
@customElement('velg-worlds-gallery')
export class VelgWorldsGallery extends LitElement {
  static styles = css`
    :host {
      display: block;
      background: var(--color-surface);
      color: var(--color-text-primary);
      min-height: 100vh;
    }

    /* ── Header ────────────────────────────── */

    .gallery-header {
      padding: var(--space-16, 64px) var(--space-6, 24px) var(--space-10, 40px);
      text-align: center;
      position: relative;
      overflow: hidden;
    }

    .gallery-header::before {
      content: '';
      position: absolute;
      inset: 0;
      background:
        radial-gradient(ellipse at 50% 0%, color-mix(in srgb, var(--color-primary) 4%, transparent) 0%, transparent 60%);
      pointer-events: none;
    }

    .gallery-header__classification {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: 10px;
      letter-spacing: 5px;
      text-transform: uppercase;
      color: var(--color-accent-amber);
      margin: 0 0 var(--space-4, 16px);
    }

    .gallery-header__title {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: clamp(1.5rem, 4vw, 2.5rem);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist, 0.15em);
      color: var(--color-text-primary);
      margin: 0 0 var(--space-4, 16px);
      line-height: 1.1;
    }

    .gallery-header__subtitle {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: clamp(0.75rem, 1.2vw, 0.875rem);
      color: var(--color-text-secondary);
      max-width: 600px;
      margin: 0 auto;
      line-height: 1.6;
      letter-spacing: 0.5px;
    }

    /* ── Search ─────────────────────────────── */

    .gallery-controls {
      max-width: 1200px;
      margin: 0 auto var(--space-8, 32px);
      padding: 0 var(--space-6, 24px);
      display: flex;
      gap: var(--space-3, 12px);
      align-items: center;
      flex-wrap: wrap;
    }

    .search-input {
      flex: 1;
      min-width: 200px;
      padding: 10px 16px;
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 13px;
      color: var(--color-text-primary);
      background: var(--color-surface-raised);
      border: 1px solid var(--color-border);
      letter-spacing: 0.5px;
      transition: border-color 200ms;
    }

    .search-input::placeholder {
      color: var(--color-text-muted);
    }

    .search-input:focus {
      outline: none;
      border-color: var(--color-accent-amber);
    }

    .results-count {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 11px;
      color: var(--color-text-muted);
      letter-spacing: 1px;
      text-transform: uppercase;
    }

    /* ── Grid ───────────────────────────────── */

    .gallery-grid {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 var(--space-6, 24px) var(--space-12, 48px);
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 3px;
    }

    /* ── World Card ────────────────────────── */

    .world-card {
      position: relative;
      background: var(--color-surface-sunken);
      overflow: hidden;
      cursor: pointer;
      text-decoration: none;
      color: inherit;
      display: block;
      transition: transform 300ms cubic-bezier(0.22, 1, 0.36, 1);
    }

    .world-card:hover {
      transform: translateY(-2px);
      z-index: 1;
    }

    /* Portal bleed effect on hover */
    .world-card::before {
      content: '';
      position: absolute;
      inset: -1px;
      opacity: 0;
      transition: opacity 400ms;
      z-index: 1;
      pointer-events: none;
    }

    .world-card:hover::before {
      opacity: 1;
    }

    /* Theme color strip */
    .world-card__strip {
      height: 3px;
      width: 100%;
    }

    /* Banner area */
    .world-card__banner {
      position: relative;
      height: 160px;
      overflow: hidden;
      background: var(--color-surface-sunken);
    }

    .world-card__banner-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      opacity: 0.7;
      transition: opacity 400ms, transform 600ms cubic-bezier(0.22, 1, 0.36, 1);
    }

    .world-card:hover .world-card__banner-img {
      opacity: 0.9;
      transform: scale(1.03);
    }

    .world-card__banner-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(to top, var(--color-surface-sunken) 0%, transparent 60%);
    }

    .world-card__theme-tag {
      position: absolute;
      top: 12px;
      right: 12px;
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: 9px;
      letter-spacing: 2px;
      text-transform: uppercase;
      padding: 4px 8px;
      background: color-mix(in srgb, var(--color-surface) 70%, transparent);
      backdrop-filter: blur(4px);
      z-index: 2;
    }

    /* Signal indicator */
    .world-card__signal {
      position: absolute;
      top: 14px;
      left: 12px;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--color-success);
      z-index: 2;
    }

    .world-card__signal::after {
      content: '';
      position: absolute;
      inset: -3px;
      border-radius: 50%;
      border: 1px solid var(--color-success-glow);
      animation: signal-ping 2s ease-out infinite;
    }

    @keyframes signal-ping {
      0%   { transform: scale(1); opacity: 1; }
      100% { transform: scale(2.2); opacity: 0; }
    }

    /* Body */
    .world-card__body {
      padding: 20px 24px 24px;
    }

    .world-card__name {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: 13px;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: var(--color-text-primary);
      margin: 0 0 8px;
      line-height: 1.3;
    }

    .world-card__tagline {
      font-family: var(--font-bureau, 'Spectral', Georgia, serif);
      font-size: 14px;
      color: var(--color-text-secondary);
      margin: 0 0 16px;
      line-height: 1.5;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    /* Stats row */
    .world-card__stats {
      display: flex;
      gap: 16px;
      padding-top: 12px;
      border-top: 1px solid var(--color-separator);
    }

    .world-card__stat {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 10px;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: var(--color-text-muted);
    }

    .world-card__stat-value {
      color: var(--color-text-secondary);
      font-weight: 700;
    }

    /* ── Scroll Reveal ─────────────────────── */

    .scroll-reveal {
      opacity: 0;
      transform: translateY(20px);
      transition:
        opacity 500ms cubic-bezier(0.22, 1, 0.36, 1),
        transform 500ms cubic-bezier(0.22, 1, 0.36, 1);
      transition-delay: calc(var(--i, 0) * 60ms);
    }

    .scroll-reveal.in-view {
      opacity: 1;
      transform: translateY(0);
    }

    /* ── Empty State ───────────────────────── */

    .gallery-empty {
      text-align: center;
      padding: var(--space-16, 64px) var(--space-6, 24px);
    }

    .gallery-empty__title {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: 900;
      font-size: 14px;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: var(--color-text-secondary);
      margin: 0 0 var(--space-2, 8px);
    }

    .gallery-empty__text {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 13px;
      color: var(--color-text-muted);
    }

    /* ── Loading ────────────────────────────── */

    .gallery-loading {
      display: flex;
      justify-content: center;
      padding: var(--space-16, 64px);
    }

    .gallery-loading__text {
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

    /* ── Pagination ─────────────────────────── */

    .gallery-pagination {
      display: flex;
      justify-content: center;
      gap: var(--space-3, 12px);
      padding: 0 var(--space-6, 24px) var(--space-12, 48px);
    }

    .gallery-pagination__btn {
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

    .gallery-pagination__btn:hover:not(:disabled) {
      border-color: var(--color-accent-amber);
      color: var(--color-accent-amber);
    }

    .gallery-pagination__btn:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }

    /* ── CTA Banner ─────────────────────────── */

    .gallery-cta {
      max-width: 800px;
      margin: 0 auto var(--space-12, 48px);
      padding: var(--space-8, 32px);
      text-align: center;
      border: 1px dashed var(--color-primary-glow);
      position: relative;
    }

    .gallery-cta__text {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 13px;
      color: var(--color-text-secondary);
      margin: 0 0 var(--space-4, 16px);
      line-height: 1.6;
    }

    .gallery-cta__btn {
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

    .gallery-cta__btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 0 20px var(--color-primary-glow);
    }

    /* ── Responsive ─────────────────────────── */

    @media (max-width: 720px) {
      .gallery-grid {
        grid-template-columns: 1fr;
      }

      .gallery-header {
        padding: var(--space-10, 40px) var(--space-4, 16px) var(--space-6, 24px);
      }
    }

    @media (min-width: 1280px) {
      .gallery-grid {
        max-width: 1400px;
        grid-template-columns: repeat(3, 1fr);
        gap: 4px;
      }
    }

    @media (min-width: 1600px) {
      .gallery-grid {
        max-width: 1500px;
      }
    }

    @media (min-width: 2560px) {
      .gallery-grid {
        max-width: 2200px;
        grid-template-columns: repeat(4, 1fr);
      }
    }
  `;

  @state() private _simulations: Simulation[] = [];
  @state() private _loading = true;
  @state() private _total = 0;
  @state() private _offset = 0;
  @state() private _search = '';

  private _limit = 12;
  private _observer?: IntersectionObserver;

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    await this._fetchSimulations();
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

  private async _fetchSimulations(): Promise<void> {
    this._loading = true;
    const resp = await simulationsApi.listPublic({
      limit: String(this._limit),
      offset: String(this._offset),
    });
    if (resp.success && Array.isArray(resp.data)) {
      this._simulations = resp.data as Simulation[];
      this._total = resp.meta?.total ?? resp.data.length;
      this._injectStructuredData();
    }
    this._loading = false;
  }

  private _handleSearch(e: Event): void {
    this._search = (e.target as HTMLInputElement).value.toLowerCase();
  }

  private get _filtered(): Simulation[] {
    if (!this._search) return this._simulations;
    return this._simulations.filter(
      (s) =>
        t(s, 'name').toLowerCase().includes(this._search) ||
        t(s, 'description').toLowerCase().includes(this._search) ||
        (s.theme ?? '').toLowerCase().includes(this._search),
    );
  }

  private _injectStructuredData(): void {
    if (this._simulations.length === 0) return;
    seoService.setStructuredData({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Explore Living Worlds',
      description:
        'Browse player-created civilizations – each with AI-powered characters, evolving cities, and stories that write themselves.',
      url: 'https://metaverse.center/worlds',
      numberOfItems: this._total,
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: this._simulations.length,
        itemListElement: this._simulations.map((sim, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: t(sim, 'name'),
          description: t(sim, 'description'),
          url: `https://metaverse.center/simulations/${sim.slug || sim.id}/lore`,
          ...(sim.banner_url ? { image: sim.banner_url } : {}),
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
    this._fetchSimulations();
  }

  private _nextPage(): void {
    this._offset += this._limit;
    this._fetchSimulations();
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

  protected render() {
    const isGuest = !appState.isAuthenticated.value;

    return html`
      <div class="gallery-header">
        <p class="gallery-header__classification">${msg('Bureau Observation Index')}</p>
        <h1 class="gallery-header__title">${msg('Explore Living Worlds')}</h1>
        <p class="gallery-header__subtitle">
          ${msg('Every world started as a single sentence. Browse civilizations built by other creators – each with its own characters, cities, lore, and evolving stories.')}
        </p>
      </div>

      <div class="gallery-controls">
        <input
          class="search-input"
          type="search"
          placeholder=${msg('Search worlds...')}
          @input=${this._handleSearch}
          aria-label=${msg('Search worlds')}
        />
        <span class="results-count">
          ${this._loading ? msg('Loading...') : msg(str`${this._filtered.length} worlds`)}
        </span>
      </div>

      ${
        this._loading
          ? html`<div class="gallery-loading"><span class="gallery-loading__text">${msg('Scanning multiverse...')}</span></div>`
          : this._filtered.length === 0
            ? html`
              <div class="gallery-empty">
                <p class="gallery-empty__title">${msg('No Worlds Found')}</p>
                <p class="gallery-empty__text">${msg('No simulations match your search.')}</p>
              </div>
            `
            : html`
              <div class="gallery-grid">
                ${this._filtered.map(
                  (sim, i) => html`
                    <a
                      class="world-card scroll-reveal"
                      style="--i: ${i}"
                      href="/simulations/${sim.slug || sim.id}/lore"
                      @click=${(e: Event) => {
                        e.preventDefault();
                        this._navigate(`/simulations/${sim.slug || sim.id}/lore`);
                      }}
                    >
                      <div
                        class="world-card__strip"
                        style="background: ${getThemeColor(sim.theme ?? 'custom')}"
                      ></div>
                      <div
                        class="world-card__banner"
                      >
                        ${
                          sim.banner_url
                            ? html`<img
                              class="world-card__banner-img"
                              src=${sim.banner_url}
                              alt=${t(sim, 'name')}
                              loading="lazy"
                              decoding="async"
                            />`
                            : nothing
                        }
                        <div class="world-card__banner-overlay"></div>
                        <div class="world-card__signal"></div>
                        <span
                          class="world-card__theme-tag"
                          style="color: ${getThemeColor(sim.theme ?? 'custom')}"
                        >
                          ${(sim.theme ?? 'custom').toUpperCase()}
                        </span>
                      </div>
                      <div
                        class="world-card__body"
                        style="--portal-color: ${getThemeColor(sim.theme ?? 'custom')}"
                      >
                        <h2 class="world-card__name">${t(sim, 'name')}</h2>
                        ${
                          t(sim, 'description')
                            ? html`<p class="world-card__tagline">${t(sim, 'description')}</p>`
                            : nothing
                        }
                        <div class="world-card__stats">
                          <span class="world-card__stat">
                            <span class="world-card__stat-value">${sim.agent_count ?? '–'}</span> ${msg('agents')}
                          </span>
                          <span class="world-card__stat">
                            <span class="world-card__stat-value">${sim.building_count ?? '–'}</span> ${msg('buildings')}
                          </span>
                          <span class="world-card__stat">
                            <span class="world-card__stat-value">${sim.event_count ?? '–'}</span> ${msg('events')}
                          </span>
                        </div>
                      </div>
                    </a>
                  `,
                )}
              </div>

              ${
                this._total > this._limit
                  ? html`
                    <div class="gallery-pagination">
                      <button
                        class="gallery-pagination__btn"
                        ?disabled=${this._offset === 0}
                        @click=${this._prevPage}
                      >
                        ${msg('Previous')}
                      </button>
                      <button
                        class="gallery-pagination__btn"
                        ?disabled=${this._offset + this._limit >= this._total}
                        @click=${this._nextPage}
                      >
                        ${msg('Next')}
                      </button>
                    </div>
                  `
                  : nothing
              }
            `
      }

      ${
        isGuest
          ? html`
            <div class="gallery-cta">
              <p class="gallery-cta__text">
                ${msg('Every world here was forged from a single idea. Create yours.')}
              </p>
              <a
                class="gallery-cta__btn"
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
          : nothing
      }

      <velg-platform-footer></velg-platform-footer>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-worlds-gallery': VelgWorldsGallery;
  }
}
