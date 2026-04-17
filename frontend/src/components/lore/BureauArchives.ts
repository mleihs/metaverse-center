import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { navigate } from '../../utils/navigation.js';
import {
  getPlatformLoreSections,
  getPlatformPullQuotes,
  type LoreSection,
  type PullQuote,
} from '../platform/LoreScroll.js';
import '../shared/Lightbox.js';

/**
 * Bureau Archives — Declassified dossiers presenting the full platform mythology.
 *
 * Renders lore sections as classified intelligence files with chapter navigation,
 * pull quotes as intercepted transmissions, and evidence photographs.
 */
@localized()
@customElement('velg-bureau-archives')
export class VelgBureauArchives extends LitElement {
  static styles = css`
    :host {
      display: block;
      background: var(--color-surface-sunken);
      color: var(--color-text-primary);
      min-height: calc(100vh - var(--header-height));
    }

    /* ── Classification Header ── */

    .archives__header {
      height: 60px;
      background: var(--color-surface);
      border-bottom: 2px solid var(--color-border);
      display: flex;
      align-items: center;
      padding: 0 var(--space-6);
      font-family: var(--font-mono);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-widest);
      color: var(--color-text-muted);
      gap: var(--space-4);
      overflow: hidden;
    }

    .archives__header-title {
      font-weight: var(--font-bold);
      color: var(--color-text-tertiary);
      white-space: nowrap;
    }

    .archives__header-classification {
      color: var(--color-primary);
      font-weight: var(--font-bold);
      border: 1px solid var(--color-warning-glow);
      padding: 2px 8px;
      flex-shrink: 0;
    }

    .archives__header-sep {
      color: var(--color-border);
    }

    .archives__header-count {
      color: var(--color-text-muted);
    }

    @media (max-width: 640px) {
      .archives__header {
        height: auto;
        min-height: 44px;
        padding: var(--space-2) var(--space-3);
        flex-wrap: wrap;
        gap: var(--space-2);
      }
    }

    /* ── Chapter Navigation ── */

    .chapter-nav {
      position: sticky;
      top: var(--header-height, 56px);
      z-index: 10;
      background: rgba(10, 10, 14, 0.95);
      backdrop-filter: blur(8px);
      border-bottom: 1px solid var(--color-border-light);
      padding: var(--space-3) var(--space-6);
      display: flex;
      gap: var(--space-4);
      overflow-x: auto;
      scrollbar-width: none;
    }

    .chapter-nav::-webkit-scrollbar {
      display: none;
    }

    .chapter-nav__item {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-muted);
      cursor: pointer;
      white-space: nowrap;
      padding: var(--space-1) var(--space-3);
      border: 1px solid transparent;
      transition: all var(--transition-fast);
      background: none;
    }

    .chapter-nav__item--active,
    .chapter-nav__item:hover {
      color: var(--color-primary);
      border-color: var(--color-warning-glow);
    }

    .chapter-nav__item:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }

    /* ── Content Area ── */

    .archives__content {
      padding: var(--space-6) var(--space-4);
      max-width: 900px;
      margin: 0 auto;
    }

    /* ── Chapter Divider ── */

    .chapter-divider {
      max-width: 800px;
      margin: var(--space-12) auto var(--space-8);
      padding: var(--space-6) 0;
      border-top: 2px solid var(--color-border);
      display: flex;
      align-items: baseline;
      gap: var(--space-4);
    }

    .chapter-divider:first-of-type {
      margin-top: var(--space-6);
    }

    .chapter-divider__name {
      font-family: var(--font-brutalist);
      font-size: var(--text-lg);
      font-weight: var(--font-black);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-primary);
    }

    .chapter-divider__count {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    /* ── Dossier Card ── */

    .dossier {
      max-width: 800px;
      margin: var(--space-8) auto;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      padding: var(--space-8);
      position: relative;
      opacity: 0;
      transform: translateY(20px);
      transition: opacity 0.5s var(--ease-dramatic), transform 0.5s var(--ease-dramatic);
    }

    .dossier--visible {
      opacity: 1;
      transform: translateY(0);
    }

    .dossier__arcanum {
      position: absolute;
      top: var(--space-4);
      right: var(--space-6);
      font-family: var(--font-brutalist);
      font-size: 64px;
      font-weight: var(--font-black);
      color: color-mix(in srgb, var(--color-text-primary) 4%, transparent);
      line-height: 1;
      user-select: none;
    }

    .dossier__stamp {
      display: inline-block;
      font-family: var(--font-mono);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-widest);
      color: var(--color-primary);
      border: 1px solid var(--color-warning-glow);
      padding: 1px 6px;
      transform: rotate(-2deg);
    }

    .dossier__title {
      font-family: var(--font-prose);
      font-size: var(--text-2xl);
      font-weight: var(--font-bold);
      color: var(--color-text-primary);
      margin: var(--space-4) 0 var(--space-3);
      letter-spacing: 1px;
    }

    .dossier__epigraph {
      font-family: var(--font-prose);
      font-style: italic;
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      border-left: 2px solid var(--color-warning-glow);
      padding-left: var(--space-4);
      margin: 0 0 var(--space-6);
    }

    .dossier__body {
      font-family: var(--font-prose);
      font-size: var(--text-base);
      line-height: var(--leading-relaxed);
      color: var(--color-text-tertiary);
      max-width: 72ch;
      white-space: pre-line;
    }

    .dossier__evidence {
      margin: var(--space-6) 0;
      position: relative;
      max-width: 480px;
    }

    .dossier__evidence img {
      width: 100%;
      aspect-ratio: 16 / 9;
      object-fit: cover;
      border: 1px solid var(--color-border);
      transform: rotate(-0.5deg);
      cursor: pointer;
    }

    .dossier__evidence img:hover {
      filter: brightness(1.1);
    }

    .dossier__evidence-meta {
      font-family: var(--font-mono);
      font-size: 9px;
      text-transform: uppercase;
      color: var(--color-text-muted);
      margin-top: var(--space-2);
      letter-spacing: var(--tracking-wider);
    }

    .dossier__footer {
      margin-top: var(--space-6);
      padding-top: var(--space-3);
      border-top: 1px solid var(--color-border-light);
      font-family: var(--font-mono);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-wider);
      color: var(--color-text-muted);
      display: flex;
      justify-content: space-between;
    }

    /* ── Pull Quotes / Transmissions ── */

    .transmission {
      max-width: 800px;
      margin: var(--space-10) auto;
      padding: var(--space-6);
      border-left: 3px solid var(--color-warning-glow);
      background: color-mix(in srgb, var(--color-primary) 2%, transparent);
      opacity: 0;
      transform: scale(0.98);
      transition: opacity 0.5s ease, transform 0.5s ease;
    }

    .transmission--visible {
      opacity: 1;
      transform: scale(1);
    }

    .transmission--cosmic {
      border-left: none;
      background: none;
      text-align: center;
      position: relative;
    }

    .transmission--cosmic::before {
      content: '';
      position: absolute;
      inset: 0;
      background: radial-gradient(ellipse at center, color-mix(in srgb, var(--color-primary) 4%, transparent) 0%, transparent 70%);
      pointer-events: none;
    }

    .transmission--character {
      text-align: right;
      border-left: none;
      border-right: 3px solid var(--color-warning-glow);
    }

    .transmission__label {
      font-family: var(--font-mono);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-widest);
      color: var(--color-primary);
      margin-bottom: var(--space-3);
    }

    .transmission__text {
      font-family: var(--font-prose);
      font-size: var(--text-lg);
      font-style: italic;
      color: var(--color-text-tertiary);
      line-height: var(--leading-relaxed);
    }

    .transmission__attribution {
      font-family: var(--font-mono);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-wider);
      color: var(--color-text-muted);
      margin-top: var(--space-3);
    }

    /* ── Substrate Ticker ── */

    .substrate-ticker {
      height: 28px;
      background: rgba(0, 0, 0, 0.6);
      border-top: 1px solid var(--color-border-light);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      cursor: pointer;
    }

    .substrate-ticker__text {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: color-mix(in srgb, var(--color-text-primary) 25%, transparent);
      letter-spacing: var(--tracking-wider);
      text-transform: uppercase;
    }

    .substrate-ticker:hover .substrate-ticker__text {
      color: var(--color-warning-glow);
    }

    /* ── Responsive ── */

    @media (max-width: 640px) {
      .archives__content {
        padding: var(--space-4) var(--space-3);
      }

      .dossier {
        padding: var(--space-4);
      }

      .dossier__arcanum {
        display: none;
      }

      .dossier__evidence {
        max-width: 100%;
      }

      .dossier__evidence img {
        transform: none;
      }

      .chapter-nav {
        padding: var(--space-2) var(--space-3);
        gap: var(--space-2);
      }

      .transmission__text {
        font-size: var(--text-base);
      }
    }

    /* ── Reduced motion ── */

    @media (prefers-reduced-motion: reduce) {
      .dossier {
        opacity: 1;
        transform: none;
        transition: none;
      }

      .transmission {
        opacity: 1;
        transform: none;
        transition: none;
      }

      .dossier__evidence img {
        transform: none;
      }

      .dossier__stamp {
        transform: none;
      }
    }
  `;

  @state() private _activeChapter = '';
  @state() private _lightboxUrl: string | null = null;
  @state() private _lightboxAlt = '';
  @state() private _lightboxCaption = '';

  private _observer: IntersectionObserver | null = null;
  private _scrollObserver: IntersectionObserver | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    // Deep link support
    if (window.location.hash) {
      requestAnimationFrame(() => {
        const target = this.shadowRoot?.querySelector(window.location.hash);
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }

  firstUpdated(): void {
    this._setupIntersectionObservers();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._observer?.disconnect();
    this._scrollObserver?.disconnect();
  }

  private _setupIntersectionObservers(): void {
    // Chapter scrollspy
    this._observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this._activeChapter = (entry.target as HTMLElement).dataset.chapter ?? '';
          }
        }
      },
      { rootMargin: '-20% 0px -70% 0px' },
    );

    const chapterHeadings = this.shadowRoot?.querySelectorAll('.chapter-divider');
    chapterHeadings?.forEach((el) => {
      this._observer?.observe(el);
    });

    // Scroll-in animations for dossiers and transmissions
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reducedMotion) {
      this._scrollObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.classList.add(
                entry.target.classList.contains('transmission')
                  ? 'transmission--visible'
                  : 'dossier--visible',
              );
              this._scrollObserver?.unobserve(entry.target);
            }
          }
        },
        { threshold: 0.1 },
      );

      const animatedElements = this.shadowRoot?.querySelectorAll('.dossier, .transmission');
      animatedElements?.forEach((el) => {
        this._scrollObserver?.observe(el);
      });
    }
  }

  private _getImageUrl(slug: string): string | null {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) return null;
    return `${supabaseUrl}/storage/v1/object/public/simulation.assets/platform/lore/${slug}.avif`;
  }

  private _scrollToChapter(chapter: string): void {
    const el = this.shadowRoot?.querySelector(`[data-chapter="${chapter}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private _openLightbox(url: string, alt: string, caption: string): void {
    this._lightboxUrl = url;
    this._lightboxAlt = alt;
    this._lightboxCaption = caption;
  }

  private _closeLightbox(): void {
    this._lightboxUrl = null;
    this._lightboxAlt = '';
    this._lightboxCaption = '';
  }

  protected render() {
    const sections = getPlatformLoreSections();
    const pullQuotes = getPlatformPullQuotes();
    const quoteMap = new Map<string, PullQuote>();
    for (const q of pullQuotes) {
      quoteMap.set(q.afterSectionId, q);
    }

    // Group sections by chapter
    const chapters: { name: string; sections: LoreSection[] }[] = [];
    let currentChapter = '';
    for (const section of sections) {
      if (section.chapter !== currentChapter) {
        currentChapter = section.chapter;
        chapters.push({ name: currentChapter, sections: [section] });
      } else {
        chapters[chapters.length - 1].sections.push(section);
      }
    }

    const today = new Date();
    const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;

    return html`
      ${this._renderHeader(sections.length)}
      ${this._renderChapterNav(chapters)}

      <div class="archives__content">
        ${chapters.map(
          (ch, ci) => html`
          <h2
            class="chapter-divider"
            id="chapter-${ci}"
            data-chapter="${ch.name}"
          >
            <span class="chapter-divider__name">${ch.name}</span>
            <span class="chapter-divider__count">${ch.sections.length} ${msg('files')}</span>
          </h2>

          ${ch.sections.map((section) => {
            const quote = quoteMap.get(section.id);
            return html`
            ${this._renderDossier(section, dateStr)}
            ${quote ? this._renderTransmission(quote) : nothing}
          `;
          })}
        `,
        )}
      </div>

      <div
        class="substrate-ticker"
        aria-hidden="true"
        @click=${() => {
          navigate('/dashboard');
        }}
      >
        <span class="substrate-ticker__text">
          // ${msg('Return to Operative Terminal')} //
        </span>
      </div>

      <velg-lightbox
        .src=${this._lightboxUrl}
        .alt=${this._lightboxAlt}
        .caption=${this._lightboxCaption}
        @lightbox-close=${this._closeLightbox}
      ></velg-lightbox>
    `;
  }

  private _renderHeader(fileCount: number) {
    return html`
      <div class="archives__header">
        <span class="archives__header-title">${msg('Bureau of Impossible Geography')}</span>
        <span class="archives__header-sep">//</span>
        <span class="archives__header-classification" aria-hidden="true">${msg('DECLASSIFIED')}</span>
        <span class="archives__header-sep">//</span>
        <span class="archives__header-count">${fileCount} ${msg('files')}</span>
      </div>
    `;
  }

  private _renderChapterNav(chapters: { name: string; sections: LoreSection[] }[]) {
    return html`
      <nav class="chapter-nav" role="navigation" aria-label="${msg('Chapter navigation')}">
        ${chapters.map(
          (ch) => html`
          <button
            class="chapter-nav__item ${this._activeChapter === ch.name ? 'chapter-nav__item--active' : ''}"
            @click=${() => this._scrollToChapter(ch.name)}
            tabindex="0"
          >
            ${ch.name}
          </button>
        `,
        )}
      </nav>
    `;
  }

  private _renderDossier(section: LoreSection, dateStr: string) {
    const imageUrl = section.imageSlug ? this._getImageUrl(section.imageSlug) : null;

    return html`
      <article class="dossier" id="section-${section.id}">
        <span class="dossier__arcanum" aria-hidden="true">${section.arcanum}</span>
        <span class="dossier__stamp" aria-hidden="true">${msg('DECLASSIFIED')}</span>
        <h3 class="dossier__title">${section.title}</h3>
        <p class="dossier__epigraph">${section.epigraph}</p>
        <div class="dossier__body">${section.body}</div>

        ${
          imageUrl
            ? html`
            <div class="dossier__evidence">
              <img
                src=${imageUrl}
                alt=${section.imageCaption ?? section.title}
                loading="lazy"
                @click=${() => this._openLightbox(imageUrl, section.title, section.imageCaption ?? '')}
                tabindex="0"
                @keydown=${(e: KeyboardEvent) => {
                  if (e.key === 'Enter')
                    this._openLightbox(imageUrl, section.title, section.imageCaption ?? '');
                }}
              />
              <div class="dossier__evidence-meta">
                ${msg('ARTIFACT REF')}: #IMG-${section.arcanum}
                ${section.imageCaption ? html` // ${section.imageCaption}` : nothing}
              </div>
            </div>
          `
            : nothing
        }

        <div class="dossier__footer">
          <span>${msg('FILE')}: BIG-${section.arcanum.padStart(3, '0')}</span>
          <span>${msg('ACCESSED')}: ${dateStr}</span>
        </div>
      </article>
    `;
  }

  private _renderTransmission(quote: PullQuote) {
    const labelMap = {
      cosmic: '',
      signal: msg('INTERCEPTED TRANSMISSION'),
      character: msg('FIELD REPORT'),
    };

    return html`
      <div class="transmission transmission--${quote.variant}">
        ${
          labelMap[quote.variant]
            ? html`<div class="transmission__label">${labelMap[quote.variant]}</div>`
            : nothing
        }
        <div class="transmission__text">${quote.text}</div>
        ${
          quote.attribution
            ? html`<div class="transmission__attribution">${quote.attribution}</div>`
            : nothing
        }
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-bureau-archives': VelgBureauArchives;
  }
}
