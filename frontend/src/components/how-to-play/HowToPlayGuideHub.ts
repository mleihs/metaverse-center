/**
 * How to Play — Game Guide Hub (Civilopedia-style topic grid).
 *
 * Visual grid of 12 topic cards with integrated fuzzy search.
 * Glassmorphism cards with backdrop-filter blur, hover lift + shadow + accent
 * border glow, staggered entrance animation, icon per topic, one-line
 * description, estimated read time badge.
 *
 * Search bar with animated dropdown results, keyboard navigation
 * (arrow keys + Enter), highlighted matches in --color-primary.
 *
 * Design: "CLASSIFIED ARCHIVE" — declassified dossier energy, file-number
 * stamps, frosted glass over dark surface, surveillance-monitor feel.
 *
 * Responsive: 1-col (<768px) → 2-col (768–1023px) → 3-col (1024–2559px)
 *           → 4-col (2560px+ / 4K)
 *
 * Research basis: Civilization VI Civilopedia (topic grid with categories),
 * Stripe Docs (search UX), Linear (purposeful motion), Cognitive Load Theory
 * (max 2 disclosure levels).
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { analyticsService } from '../../services/AnalyticsService.js';
import { seoService } from '../../services/SeoService.js';
import { icons } from '../../utils/icons.js';
import { TOPICS, type TopicDefinition } from './htp-topic-data.js';
import type { IconKey } from '../../utils/icons.js';
import { clearSearchIndex, debounce, highlightMatch, searchTopics, type SearchResult } from './htp-search.js';
import {
  htpBackStyles,
  htpFooterNavStyles,
  htpHeroStyles,
  htpReducedMotionBase,
} from './htp-shared-styles.js';

// ── Component ────────────────────────────────────────────────────────────────

@localized()
@customElement('velg-how-to-play-guide-hub')
export class VelgHowToPlayGuideHub extends LitElement {
  // ── Styles ───────────────────────────────────────────────────────────────

  static styles = [
    htpHeroStyles,
    htpBackStyles,
    htpFooterNavStyles,
    htpReducedMotionBase,
    css`
    /* ═══ HOST ═══════════════════════════════════════════════════════════ */

    :host {
      display: block;
      color: var(--color-text-primary);
      background: var(--color-surface);
      min-height: 100vh;
    }

    /* ═══ LAYOUT ════════════════════════════════════════════════════════ */

    .guide-hub {
      max-width: var(--container-lg);
      margin: 0 auto;
      padding: var(--space-12) var(--content-padding) var(--space-16);
    }

    /* ═══ HERO OVERRIDES ═══════════════════════════════════════════════ */

    .hero {
      text-align: center;
      --_hero-margin-bottom: var(--space-10);
      --_hero-title-margin: var(--space-3);
    }

    .hero__subtitle {
      max-width: 52ch;
      margin-inline: auto;
    }

    /* ═══ SEARCH ════════════════════════════════════════════════════════ */

    .search {
      position: relative;
      z-index: 10;
      max-width: 640px;
      margin: 0 auto var(--space-10);
      opacity: 0;
      animation: hub-enter var(--duration-entrance) var(--ease-dramatic) forwards;
      animation-delay: 80ms;
    }

    .search__wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }

    .search__icon {
      position: absolute;
      left: var(--space-4);
      color: var(--color-text-muted);
      pointer-events: none;
      z-index: 1;
    }

    .search__input {
      width: 100%;
      font-family: var(--font-body);
      font-size: var(--text-base);
      color: var(--color-text-primary);
      background: var(--color-surface-raised);
      border: var(--border-width-thick) solid var(--color-border);
      padding: var(--space-3) var(--space-4) var(--space-3) calc(var(--space-4) + 24px + var(--space-2));
      outline: none;
      transition:
        border-color var(--duration-normal) var(--ease-default),
        box-shadow var(--duration-normal) var(--ease-default);
    }

    .search__input::placeholder {
      color: var(--color-text-muted);
      font-style: italic;
    }

    .search__input:focus {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 20%, transparent);
    }

    /* ── Search Dropdown ── */

    .search__dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      z-index: 100;
      background: var(--color-surface-raised);
      border: var(--border-width-thick) solid var(--color-border);
      border-top: none;
      max-height: 360px;
      overflow-y: auto;
      box-shadow: 0 8px 24px color-mix(in srgb, var(--color-surface) 60%, transparent);

      /* Entrance animation */
      opacity: 0;
      transform: translateY(-4px);
      animation: dropdown-enter var(--duration-normal) var(--ease-dramatic) forwards;
    }

    @keyframes dropdown-enter {
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .search__result {
      display: flex;
      align-items: flex-start;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      cursor: pointer;
      border-bottom: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
      transition: background var(--duration-fast) var(--ease-default);
    }

    .search__result:last-child {
      border-bottom: none;
    }

    .search__result:hover,
    .search__result--active {
      background: color-mix(in srgb, var(--color-primary) 8%, transparent);
    }

    .search__result-icon {
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-text-muted);
      margin-top: 2px;
    }

    .search__result-body {
      flex: 1;
      min-width: 0;
    }

    .search__result-title {
      font-family: var(--font-brutalist);
      font-size: var(--text-sm);
      font-weight: var(--font-bold);
      letter-spacing: 0.03em;
      text-transform: uppercase;
      color: var(--color-text-primary);
      margin: 0 0 var(--space-1);
    }

    .search__result-match {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      line-height: var(--leading-normal);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .search__highlight {
      color: var(--color-primary);
      font-weight: var(--font-semibold);
    }

    .search__no-results {
      padding: var(--space-4);
      text-align: center;
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      font-style: italic;
    }

    /* ═══ CARD GRID ═════════════════════════════════════════════════════ */

    .grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--space-5);
    }

    /* ═══ TOPIC CARD ═══════════════════════════════════════════════════ */

    .card {
      --_card-accent: var(--color-primary);
      position: relative;
      display: flex;
      flex-direction: column;
      background: color-mix(in srgb, var(--color-surface-raised) 85%, transparent);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: var(--border-width-thick) solid color-mix(in srgb, var(--color-border) 70%, transparent);
      padding: var(--space-6) var(--space-5) var(--space-5);
      cursor: pointer;
      text-decoration: none;
      color: inherit;
      transition:
        transform var(--duration-normal) var(--ease-dramatic),
        box-shadow var(--duration-normal) var(--ease-dramatic),
        border-color var(--duration-normal) var(--ease-default);

      /* Staggered entrance */
      opacity: 0;
      transform: translateY(20px);
      animation: hub-enter var(--duration-entrance) var(--ease-dramatic) forwards;
    }

    @keyframes hub-enter {
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* Stagger delays for 12 cards (60ms each) */
    .card:nth-child(1)  { animation-delay: 0ms; }
    .card:nth-child(2)  { animation-delay: 60ms; }
    .card:nth-child(3)  { animation-delay: 120ms; }
    .card:nth-child(4)  { animation-delay: 180ms; }
    .card:nth-child(5)  { animation-delay: 240ms; }
    .card:nth-child(6)  { animation-delay: 300ms; }
    .card:nth-child(7)  { animation-delay: 360ms; }
    .card:nth-child(8)  { animation-delay: 420ms; }
    .card:nth-child(9)  { animation-delay: 480ms; }
    .card:nth-child(10) { animation-delay: 540ms; }
    .card:nth-child(11) { animation-delay: 600ms; }
    .card:nth-child(12) { animation-delay: 660ms; }

    /* Accent stripe at top */
    .card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: var(--_card-accent);
      opacity: 0;
      transition: opacity var(--duration-normal) var(--ease-default);
    }

    .card:hover,
    .card:focus-visible {
      transform: translateY(-4px);
      border-color: color-mix(in srgb, var(--_card-accent) 50%, transparent);
      box-shadow:
        3px 3px 0 color-mix(in srgb, var(--_card-accent) 30%, transparent),
        0 0 24px color-mix(in srgb, var(--_card-accent) 6%, transparent);
    }

    .card:hover::before,
    .card:focus-visible::before {
      opacity: 1;
    }

    .card:focus-visible {
      outline: none;
      box-shadow:
        3px 3px 0 color-mix(in srgb, var(--_card-accent) 30%, transparent),
        0 0 0 3px color-mix(in srgb, var(--_card-accent) 35%, transparent);
    }

    .card:active {
      transform: translateY(-2px);
      box-shadow: 2px 2px 0 color-mix(in srgb, var(--_card-accent) 30%, transparent);
    }

    /* ── Card Header ── */

    .card__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: var(--space-4);
    }

    .card__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border: 2px solid var(--_card-accent);
      color: var(--_card-accent);
      flex-shrink: 0;
    }

    .card__number {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      letter-spacing: 0.1em;
      color: color-mix(in srgb, var(--color-text-muted) 50%, transparent);
    }

    /* ── Card Content ── */

    .card__title {
      font-family: var(--font-brutalist);
      font-size: var(--text-base);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--color-text-primary);
      margin: 0 0 var(--space-2);
      line-height: var(--leading-tight);
    }

    .card__description {
      font-family: var(--font-prose);
      font-size: var(--text-sm);
      line-height: var(--leading-relaxed);
      color: var(--color-text-secondary);
      margin: 0;
      flex: 1;
    }

    /* ── Card Footer ── */

    .card__footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: var(--space-3);
      margin-top: var(--space-4);
      border-top: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
    }

    .card__read-time {
      font-family: var(--font-brutalist);
      font-size: 10px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--color-text-muted);
    }

    .card__arrow {
      font-size: var(--text-base);
      color: var(--_card-accent);
      opacity: 0.5;
      transition:
        opacity var(--duration-fast) var(--ease-default),
        transform var(--duration-fast) var(--ease-default);
    }

    .card:hover .card__arrow {
      opacity: 1;
      transform: translateX(3px);
    }

    /* ═══ FOOTER NAV OVERRIDES ═════════════════════════════════════════ */

    .footer-nav {
      --_footer-padding-top: var(--space-10);
      --_footer-margin-top: var(--space-6);
      opacity: 0;
      animation: hub-enter var(--duration-entrance) var(--ease-dramatic) forwards;
      animation-delay: 750ms;
    }

    /* ═══ REDUCED MOTION (component-specific) ═════════════════════════ */
    /* Back/footer-nav transforms handled by htpReducedMotionBase */

    @media (prefers-reduced-motion: reduce) {
      .card,
      .search,
      .footer-nav,
      .search__dropdown {
        animation: none;
        opacity: 1;
        transform: none;
      }

      .card:hover,
      .card:focus-visible {
        transform: none;
      }

      .card:hover .card__arrow {
        transform: none;
      }
    }

    /* ═══ RESPONSIVE: MOBILE (<768px) ═════════════════════════════════ */

    @media (max-width: 767px) {
      .guide-hub {
        padding: var(--space-6) var(--space-4) var(--space-12);
      }

      .grid {
        grid-template-columns: 1fr;
        gap: var(--space-3);
      }

      .card {
        padding: var(--space-4) var(--space-4) var(--space-3);
      }
    }

    /* ═══ RESPONSIVE: TABLET (768–1023px) ═════════════════════════════ */

    @media (min-width: 768px) and (max-width: 1023px) {
      .grid {
        grid-template-columns: repeat(2, 1fr);
        gap: var(--space-4);
      }
    }

    /* ═══ RESPONSIVE: DESKTOP (1024–2559px) ═══════════════════════════ */
    /* Default: 3-col grid — no override needed */

    /* ═══ RESPONSIVE: 1440p+ ══════════════════════════════════════════ */

    @media (min-width: 1440px) {
      .guide-hub {
        max-width: 1280px;
        padding-top: var(--space-16);
        padding-bottom: var(--space-20);
      }

      .hero {
        --_hero-margin-bottom: var(--space-12);
      }

      .grid {
        gap: var(--space-6);
      }

      .card {
        padding: var(--space-8) var(--space-6) var(--space-6);
      }
    }

    /* ═══ RESPONSIVE: 4K (2560px+) ═══════════════════════════════════ */

    @media (min-width: 2560px) {
      .guide-hub {
        max-width: 1600px;
      }

      .grid {
        grid-template-columns: repeat(4, 1fr);
        gap: var(--space-8);
      }

      .card {
        padding: var(--space-10) var(--space-8) var(--space-8);
      }

      .card__icon {
        width: 48px;
        height: 48px;
      }

      .card__title {
        font-size: var(--text-lg);
      }

      .card__description {
        font-size: var(--text-base);
      }

      .search {
        max-width: 800px;
      }
    }
  `];

  // ── State ──────────────────────────────────────────────────────────────

  @property({ type: String }) searchQuery = '';
  @state() private _searchResults: SearchResult[] = [];
  @state() private _showDropdown = false;
  @state() private _activeResultIdx = -1;

  @query('.search__input') private _searchInput!: HTMLInputElement;

  // ── Lifecycle ──────────────────────────────────────────────────────────

  connectedCallback(): void {
    super.connectedCallback();
    seoService.setTitle([msg('Game Guide'), msg('How to Play')]);
    seoService.setDescription(msg('Browse 12 topics covering every game system in metaverse.center.'));
    seoService.setCanonical('/how-to-play/guide');
    seoService.setBreadcrumbs([
      { name: msg('Home'), url: 'https://metaverse.center/' },
      { name: msg('How to Play'), url: 'https://metaverse.center/how-to-play' },
      { name: msg('Game Guide'), url: 'https://metaverse.center/how-to-play/guide' },
    ]);
    analyticsService.trackPageView('/how-to-play/guide', document.title);

    // Check for ?q= search param (from landing page search)
    const url = new URL(window.location.href);
    const q = url.searchParams.get('q');
    if (q) {
      this.searchQuery = q;
      this._runSearch(q);
    }

    // Invalidate search index when locale changes
    window.addEventListener('lit-localize-status', this._handleLocaleChange);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._debouncedSearch.cancel();
    window.removeEventListener('lit-localize-status', this._handleLocaleChange);
  }

  private _handleLocaleChange = () => {
    clearSearchIndex();
    if (this.searchQuery) this._runSearch(this.searchQuery);
  };

  // ── Search Logic ───────────────────────────────────────────────────────

  private _debouncedSearch = debounce((q: string) => this._runSearch(q), 150);

  private _runSearch(q: string) {
    if (q.length < 2) {
      this._searchResults = [];
      this._showDropdown = false;
      return;
    }
    this._searchResults = searchTopics(q);
    this._showDropdown = this._searchResults.length > 0 || q.length >= 2;
    this._activeResultIdx = -1;
  }

  private _handleSearchInput(e: Event) {
    const q = (e.target as HTMLInputElement).value;
    this.searchQuery = q;
    this._debouncedSearch(q);
  }

  private _handleSearchKeydown(e: KeyboardEvent) {
    if (!this._showDropdown) {
      if (e.key === 'Enter') {
        const q = this._searchInput?.value?.trim();
        if (q) this._runSearch(q);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this._activeResultIdx = Math.min(this._activeResultIdx + 1, this._searchResults.length - 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this._activeResultIdx = Math.max(this._activeResultIdx - 1, -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (this._activeResultIdx >= 0 && this._activeResultIdx < this._searchResults.length) {
          this._navigateToTopic(this._searchResults[this._activeResultIdx].topic.slug);
        }
        break;
      case 'Escape':
        this._showDropdown = false;
        this._activeResultIdx = -1;
        break;
    }
  }

  private _handleSearchFocus() {
    if (this._searchResults.length > 0) {
      this._showDropdown = true;
    }
  }

  private _handleSearchBlur() {
    // Delay to allow click on result
    setTimeout(() => {
      this._showDropdown = false;
    }, 200);
  }

  // ── Navigation ─────────────────────────────────────────────────────────

  private _navigate(path: string) {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: path,
      bubbles: true,
      composed: true,
    }));
  }

  private _navigateToTopic(slug: string) {
    this._showDropdown = false;
    this._navigate(`/how-to-play/guide/${slug}`);
  }

  private _handleCardClick(e: Event, slug: string) {
    e.preventDefault();
    this._navigateToTopic(slug);
  }

  private _handleCardKeydown(e: KeyboardEvent, slug: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this._navigateToTopic(slug);
    }
  }

  private _handleLinkClick(e: Event, href: string) {
    e.preventDefault();
    this._navigate(href);
  }

  // ── Icon Resolver ──────────────────────────────────────────────────────

  /** Resolve an icon key to its SVG template. Single targeted cast because
   *  resonanceArchetype has a different signature than standard icons. */
  private _getIcon(key: IconKey, size = 20) {
    return (icons[key] as (s?: number) => ReturnType<typeof icons.book>)(size);
  }

  // ── Render ─────────────────────────────────────────────────────────────

  protected render() {
    return html`
      <div class="guide-hub">
        ${this._renderBack()}
        ${this._renderHero()}
        ${this._renderSearch()}
        ${this._renderGrid()}
        ${this._renderFooterNav()}
      </div>
    `;
  }

  private _renderBack() {
    return html`
      <a
        class="back"
        href="/how-to-play"
        @click=${(e: Event) => this._handleLinkClick(e, '/how-to-play')}
      >
        <span class="back__arrow" aria-hidden="true">\u25C2</span>
        ${msg('How to Play')}
      </a>
    `;
  }

  private _renderHero() {
    return html`
      <header class="hero">
        <span class="hero__eyebrow">${msg('Classified Archive')}</span>
        <h1 class="hero__title">${msg('Game Guide')}</h1>
        <p class="hero__subtitle">
          ${msg('12 topics covering every system. Pick a dossier.')}
        </p>
      </header>
    `;
  }

  private _renderSearch() {
    return html`
      <div class="search">
        <div class="search__wrapper">
          <span class="search__icon" aria-hidden="true">${icons.search(18)}</span>
          <input
            class="search__input"
            type="search"
            role="combobox"
            aria-expanded=${this._showDropdown}
            aria-controls="search-listbox"
            aria-activedescendant=${this._activeResultIdx >= 0 ? `search-result-${this._activeResultIdx}` : ''}
            .value=${this.searchQuery}
            placeholder=${msg('Search topics, mechanics, systems...')}
            aria-label=${msg('Search game guide')}
            autocomplete="off"
            spellcheck="false"
            @input=${this._handleSearchInput}
            @keydown=${this._handleSearchKeydown}
            @focus=${this._handleSearchFocus}
            @blur=${this._handleSearchBlur}
          />
        </div>
        ${this._showDropdown ? this._renderDropdown() : nothing}
      </div>
    `;
  }

  private _renderDropdown() {
    if (this._searchResults.length === 0) {
      return html`
        <div class="search__dropdown" id="search-listbox" role="listbox">
          <div class="search__no-results">${msg('No matching topics found')}</div>
        </div>
      `;
    }

    return html`
      <div class="search__dropdown" id="search-listbox" role="listbox">
        ${this._searchResults.map((result, i) => {
          const [before, match, after] = highlightMatch(result.matchText, this.searchQuery);
          return html`
            <div
              id="search-result-${i}"
              class="search__result ${i === this._activeResultIdx ? 'search__result--active' : ''}"
              role="option"
              aria-selected=${i === this._activeResultIdx}
              @click=${() => this._navigateToTopic(result.topic.slug)}
              @mouseenter=${() => { this._activeResultIdx = i; }}
            >
              <span class="search__result-icon">${this._getIcon(result.topic.icon, 16)}</span>
              <div class="search__result-body">
                <div class="search__result-title">${result.topic.title}</div>
                <div class="search__result-match">
                  ${before}<span class="search__highlight">${match}</span>${after}
                </div>
              </div>
            </div>
          `;
        })}
      </div>
    `;
  }

  private _renderGrid() {
    return html`
      <div class="grid" role="list" aria-label=${msg('Game guide topics')}>
        ${TOPICS.map((topic, i) => this._renderCard(topic, i))}
      </div>
    `;
  }

  private _renderCard(topic: TopicDefinition, index: number) {
    const num = String(index + 1).padStart(2, '0');
    return html`
      <a
        class="card"
        href=${`/how-to-play/guide/${topic.slug}`}
        role="listitem"
        tabindex="0"
        style="--_card-accent: var(${topic.accent})"
        aria-label=${topic.title}
        @click=${(e: Event) => this._handleCardClick(e, topic.slug)}
        @keydown=${(e: KeyboardEvent) => this._handleCardKeydown(e, topic.slug)}
      >
        <div class="card__header">
          <div class="card__icon">${this._getIcon(topic.icon)}</div>
          <span class="card__number">${num}</span>
        </div>
        <h2 class="card__title">${topic.title}</h2>
        <p class="card__description">${topic.description}</p>
        <div class="card__footer">
          <span class="card__read-time">${topic.readTime}</span>
          <span class="card__arrow" aria-hidden="true">\u25B8</span>
        </div>
      </a>
    `;
  }

  private _renderFooterNav() {
    return html`
      <nav class="footer-nav" aria-label=${msg('Navigation')}>
        <a
          class="footer-nav__link"
          href="/how-to-play/competitive"
          @click=${(e: Event) => this._handleLinkClick(e, '/how-to-play/competitive')}
        >
          ${msg('War Room: Tactics & Data')}
          <span aria-hidden="true">\u25B8</span>
        </a>
      </nav>
    `;
  }
}

// ── Global Registration ──────────────────────────────────────────────────────

declare global {
  interface HTMLElementTagNameMap {
    'velg-how-to-play-guide-hub': VelgHowToPlayGuideHub;
  }
}
