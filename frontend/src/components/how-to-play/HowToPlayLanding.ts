/**
 * How to Play — Landing Page ("Three Doors").
 *
 * Three entry points based on player intent:
 * 1. Quick Start — new players, 5-minute orientation
 * 2. Game Guide — active players, topic-based reference (Civilopedia-style)
 * 3. War Room — competitive players, tactics + data + match replays
 *
 * Design: Brutalist dark theme with amber accents. Cards stagger in on load.
 * Below cards: fuzzy search bar for cross-topic lookup.
 *
 * Research basis: Stripe Docs (clean, scannable), Linear (purposeful motion),
 * EVE Online ("never overwhelm"), Dwarf Fortress (three-tier docs),
 * Cognitive Load Theory (max 2 disclosure levels, essential first).
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, query } from 'lit/decorators.js';
import { analyticsService } from '../../services/AnalyticsService.js';
import { seoService } from '../../services/SeoService.js';
import { icons } from '../../utils/icons.js';
import { htpHeroStyles } from './htp-shared-styles.js';

// ── Types ────────────────────────────────────────────────────────────────────

interface DoorCard {
  key: string;
  icon: ReturnType<typeof icons.bolt>;
  title: string;
  subtitle: string;
  description: string;
  detail: string;
  href: string;
  accentVar: string;
}

// ── Component ────────────────────────────────────────────────────────────────

@localized()
@customElement('velg-how-to-play-landing')
export class VelgHowToPlayLanding extends LitElement {
  // ── Styles ───────────────────────────────────────────────────────────────

  static styles = [
    htpHeroStyles,
    css`
    /* ═══ HOST ═══════════════════════════════════════════════════════════ */

    :host {
      display: block;
      color: var(--color-text-primary);
      background: var(--color-surface);
      min-height: 100vh;
      --_accent-quickstart: var(--color-success);
      --_accent-guide: var(--color-info);
      --_accent-warroom: var(--color-primary);
    }

    /* ═══ LAYOUT ════════════════════════════════════════════════════════ */

    .landing {
      max-width: var(--container-lg);
      margin: 0 auto;
      padding: var(--space-12) var(--content-padding) var(--space-16);
    }

    /* ═══ HERO OVERRIDES ═══════════════════════════════════════════════ */

    .hero {
      text-align: center;
    }

    .hero__subtitle {
      max-width: 48ch;
      margin-inline: auto;
    }

    /* ═══ CARD GRID ═════════════════════════════════════════════════════ */

    .doors {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--space-6);
      margin-bottom: var(--space-12);
    }

    @media (max-width: 767px) {
      .doors {
        grid-template-columns: 1fr;
        gap: var(--space-4);
      }
    }

    /* ═══ DOOR CARD ═════════════════════════════════════════════════════ */

    .door {
      --_card-accent: var(--color-primary);
      position: relative;
      display: flex;
      flex-direction: column;
      background: var(--color-surface-raised);
      border: var(--border-width-thick) solid var(--color-border);
      padding: var(--space-8) var(--space-6) var(--space-6);
      cursor: pointer;
      text-decoration: none;
      color: inherit;
      transition:
        transform var(--duration-normal) var(--ease-dramatic),
        box-shadow var(--duration-normal) var(--ease-dramatic),
        border-color var(--duration-normal) var(--ease-default);

      /* Stagger entrance */
      opacity: 0;
      transform: translateY(24px);
      animation: door-enter var(--duration-entrance) var(--ease-dramatic) forwards;
    }

    .door:nth-child(1) { animation-delay: 0ms; --_card-accent: var(--_accent-quickstart); }
    .door:nth-child(2) { animation-delay: 120ms; --_card-accent: var(--_accent-guide); }
    .door:nth-child(3) { animation-delay: 240ms; --_card-accent: var(--_accent-warroom); }

    @keyframes door-enter {
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .door:hover,
    .door:focus-visible {
      transform: translateY(-4px);
      border-color: var(--_card-accent);
      box-shadow:
        4px 4px 0 color-mix(in srgb, var(--_card-accent) 40%, transparent),
        0 0 20px color-mix(in srgb, var(--_card-accent) 8%, transparent);
    }

    .door:focus-visible {
      outline: none;
      box-shadow:
        4px 4px 0 color-mix(in srgb, var(--_card-accent) 40%, transparent),
        0 0 0 3px color-mix(in srgb, var(--_card-accent) 40%, transparent);
    }

    .door:active {
      transform: translateY(-2px);
      box-shadow: 2px 2px 0 color-mix(in srgb, var(--_card-accent) 40%, transparent);
    }

    /* Accent stripe at top of card */
    .door::before {
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

    .door:hover::before,
    .door:focus-visible::before {
      opacity: 1;
    }

    .door__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      border: var(--border-width-thick) solid var(--_card-accent);
      color: var(--_card-accent);
      margin-bottom: var(--space-5);
      flex-shrink: 0;
    }

    .door__title {
      font-family: var(--font-brutalist);
      font-size: var(--text-xl);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-text-primary);
      margin: 0 0 var(--space-2);
    }

    .door__subtitle {
      font-family: var(--font-prose);
      font-size: var(--text-sm);
      font-style: italic;
      color: var(--_card-accent);
      margin: 0 0 var(--space-4);
    }

    .door__description {
      font-size: var(--text-sm);
      line-height: var(--leading-relaxed);
      color: var(--color-text-secondary);
      margin: 0 0 var(--space-4);
      flex: 1;
    }

    .door__footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: var(--space-3);
      border-top: 1px solid var(--color-border);
    }

    .door__detail {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--color-text-muted);
    }

    .door__arrow {
      font-size: var(--text-lg);
      color: var(--_card-accent);
      transition: transform var(--duration-fast) var(--ease-default);
    }

    .door:hover .door__arrow {
      transform: translateX(4px);
    }

    /* ═══ SEARCH ════════════════════════════════════════════════════════ */

    .search {
      max-width: 640px;
      margin: 0 auto var(--space-6);
      opacity: 0;
      animation: door-enter var(--duration-entrance) var(--ease-dramatic) forwards;
      animation-delay: 360ms;
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

    /* ═══ POPULAR TOPICS ═══════════════════════════════════════════════ */

    .popular {
      text-align: center;
      opacity: 0;
      animation: door-enter var(--duration-entrance) var(--ease-dramatic) forwards;
      animation-delay: 440ms;
    }

    .popular__label {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--color-text-muted);
      margin-right: var(--space-2);
    }

    .popular__link {
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      text-decoration: none;
      padding: var(--space-1) var(--space-2);
      border: 1px solid transparent;
      transition:
        color var(--duration-fast) var(--ease-default),
        border-color var(--duration-fast) var(--ease-default);
      cursor: pointer;
    }

    .popular__link:hover,
    .popular__link:focus-visible {
      color: var(--color-primary);
      border-color: var(--color-border);
    }

    .popular__sep {
      color: var(--color-border);
      margin: 0 var(--space-1);
      user-select: none;
    }

    /* ═══ REDUCED MOTION ═══════════════════════════════════════════════ */

    @media (prefers-reduced-motion: reduce) {
      .door,
      .search,
      .popular {
        animation: none;
        opacity: 1;
        transform: none;
      }

      .door:hover,
      .door:focus-visible {
        transform: none;
      }

      .door:hover .door__arrow {
        transform: none;
      }
    }

    /* ═══ RESPONSIVE: MOBILE (<768px) ═════════════════════════════════ */

    @media (max-width: 767px) {
      .landing {
        padding: var(--space-8) var(--space-4) var(--space-12);
      }

      .door {
        padding: var(--space-6) var(--space-4) var(--space-4);
      }
    }
  `];

  // ── State ──────────────────────────────────────────────────────────────

  @query('.search__input') private _searchInput!: HTMLInputElement;

  // ── Lifecycle ──────────────────────────────────────────────────────────

  connectedCallback(): void {
    super.connectedCallback();
    seoService.setTitle([msg('How to Play')]);
    seoService.setDescription(
      msg('Learn how to play metaverse.center: quick start guide, game mechanics reference, and competitive strategy resources.'),
    );
    seoService.setCanonical('/how-to-play');
    seoService.setBreadcrumbs([
      { name: 'Home', url: 'https://metaverse.center/' },
      { name: msg('How to Play'), url: 'https://metaverse.center/how-to-play' },
    ]);
    analyticsService.trackPageView('/how-to-play', document.title);
  }

  // ── Data ───────────────────────────────────────────────────────────────

  private get _doors(): DoorCard[] {
    return [
      {
        key: 'quickstart',
        icon: icons.bolt(24),
        title: msg('Quick Start'),
        subtitle: msg('"I\'m new here"'),
        description: msg('Everything you need to know in 5 minutes. What is this place, how to explore, and what to do first.'),
        detail: msg('5 min read'),
        href: '/how-to-play/quickstart',
        accentVar: '--_accent-quickstart',
      },
      {
        key: 'guide',
        icon: icons.book(24),
        title: msg('Game Guide'),
        subtitle: msg('"How does X work?"'),
        description: msg('12 topic pages covering every system: agents, events, epochs, operatives, scoring, alliances, and more.'),
        detail: msg('12 topics'),
        href: '/how-to-play/guide',
        accentVar: '--_accent-guide',
      },
      {
        key: 'warroom',
        icon: icons.target(24),
        title: msg('War Room'),
        subtitle: msg('"I want to win"'),
        description: msg('Competitive tactics, worked-out match replays, 200-game balance analytics, and the meta-strategy tier list.'),
        detail: msg('Tactics & data'),
        href: '/how-to-play/competitive',
        accentVar: '--_accent-warroom',
      },
    ];
  }

  private get _popularTopics(): { label: string; slug: string }[] {
    return [
      { label: msg('Operatives'), slug: 'operatives' },
      { label: msg('Scoring'), slug: 'scoring' },
      { label: msg('Epochs'), slug: 'epochs' },
      { label: msg('Bureau Terminal'), slug: 'terminal' },
      { label: msg('Alliances'), slug: 'diplomacy' },
    ];
  }

  // ── Navigation ─────────────────────────────────────────────────────────

  private _navigate(path: string) {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: path,
      bubbles: true,
      composed: true,
    }));
  }

  private _handleDoorClick(e: Event, href: string) {
    e.preventDefault();
    this._navigate(href);
  }

  private _handleDoorKeydown(e: KeyboardEvent, href: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this._navigate(href);
    }
  }

  private _handleSearchKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      const q = this._searchInput?.value?.trim();
      if (q) {
        this._navigate(`/how-to-play/guide?q=${encodeURIComponent(q)}`);
      }
    }
  }

  private _handleTopicClick(e: Event, slug: string) {
    e.preventDefault();
    this._navigate(`/how-to-play/guide/${slug}`);
  }

  // ── Render ─────────────────────────────────────────────────────────────

  protected render() {
    return html`
      <div class="landing">
        ${this._renderHero()}
        ${this._renderDoors()}
        ${this._renderSearch()}
        ${this._renderPopular()}
      </div>
    `;
  }

  private _renderHero() {
    return html`
      <header class="hero">
        <span class="hero__eyebrow">${msg('Field Manual')}</span>
        <h1 class="hero__title">${msg('How to Play')}</h1>
        <p class="hero__subtitle">
          ${msg('Three paths into the simulation. Choose what fits your needs.')}
        </p>
      </header>
    `;
  }

  private _renderDoors() {
    return html`
      <nav class="doors" aria-label=${msg('Guide sections')}>
        ${this._doors.map((door) => html`
          <a
            class="door"
            href=${door.href}
            role="link"
            tabindex="0"
            aria-label=${door.title}
            @click=${(e: Event) => this._handleDoorClick(e, door.href)}
            @keydown=${(e: KeyboardEvent) => this._handleDoorKeydown(e, door.href)}
          >
            <div class="door__icon">${door.icon}</div>
            <h2 class="door__title">${door.title}</h2>
            <p class="door__subtitle">${door.subtitle}</p>
            <p class="door__description">${door.description}</p>
            <div class="door__footer">
              <span class="door__detail">${door.detail}</span>
              <span class="door__arrow" aria-hidden="true">\u25B8</span>
            </div>
          </a>
        `)}
      </nav>
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
            placeholder=${msg('Search all topics...')}
            aria-label=${msg('Search game guide')}
            autocomplete="off"
            spellcheck="false"
            @keydown=${this._handleSearchKeydown}
          />
        </div>
      </div>
    `;
  }

  private _renderPopular() {
    const topics = this._popularTopics;
    return html`
      <div class="popular">
        <span class="popular__label">${msg('Popular')}:</span>
        ${topics.map((t, i) => html`${
          i > 0 ? html`<span class="popular__sep" aria-hidden="true">\u00b7</span>` : nothing
        }<a
            class="popular__link"
            href=${`/how-to-play/guide/${t.slug}`}
            @click=${(e: Event) => this._handleTopicClick(e, t.slug)}
          >${t.label}</a>`)}
      </div>
    `;
  }
}

// ── Global Registration ──────────────────────────────────────────────────────

declare global {
  interface HTMLElementTagNameMap {
    'velg-how-to-play-landing': VelgHowToPlayLanding;
  }
}
