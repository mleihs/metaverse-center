/**
 * Content Page — data-driven reusable component for landing pages
 * and perspective articles.
 *
 * Single component, 8 data files. Content lives in separate TS files
 * exporting getter functions (not constants, because msg() must
 * evaluate at render time per i18n gotcha).
 *
 * Layout: grid-template-columns: 200px 1fr (same as HowToPlayView)
 * with sticky TOC sidebar and scroll-spy.
 */

import { localized, msg } from '@lit/localize';
import { html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { analyticsService } from '../../services/AnalyticsService.js';
import { seoService } from '../../services/SeoService.js';
import { loadContentPage } from './content-registry.js';
import { contentStyles } from './content-styles.js';
import type { ContentPageData } from './content-types.js';

@localized()
@customElement('velg-content-page')
export class VelgContentPage extends LitElement {
  static styles = [contentStyles];

  /* ── Properties ──────────────────────────────── */

  @property({ type: String }) slug = '';

  @state() private _data: ContentPageData | null = null;
  @state() private _activeSection = '';
  @state() private _loading = true;

  private _scrollSpyObserver: IntersectionObserver | null = null;
  private _revealObserver: IntersectionObserver | null = null;

  /* ── Lifecycle ──────────────────────────────── */

  connectedCallback(): void {
    super.connectedCallback();
    this._loadContent();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._scrollSpyObserver?.disconnect();
    this._revealObserver?.disconnect();
    seoService.removeStructuredData();
    seoService.removeBreadcrumbs();
  }

  willUpdate(changed: Map<string, unknown>): void {
    if (changed.has('slug') && changed.get('slug') !== undefined) {
      this._loadContent();
    }
  }

  private async _loadContent(): Promise<void> {
    if (!this.slug) return;
    this._loading = true;
    this._scrollSpyObserver?.disconnect();
    this._revealObserver?.disconnect();

    const data = await loadContentPage(this.slug);
    this._data = data;
    this._loading = false;

    if (data) {
      this._activeSection = data.sections[0]?.id ?? '';
      this._setSeo(data);
      this._injectStructuredData(data);
      this.updateComplete.then(() => {
        this._setupScrollSpy();
        this._setupScrollReveal();
      });
    }
  }

  /* ── SEO ────────────────────────────────────── */

  private _setSeo(data: ContentPageData): void {
    seoService.setTitle(data.seo.title);
    seoService.setDescription(data.seo.description);
    seoService.setCanonical(data.seo.canonical);
    if (data.seo.ogImage) {
      seoService.setOgImage(data.seo.ogImage);
    }
    seoService.setBreadcrumbs(data.breadcrumbs);
    analyticsService.trackPageView(data.seo.canonical, document.title);
  }

  private _injectStructuredData(data: ContentPageData): void {
    const graph: Record<string, unknown>[] = [];

    if (data.type === 'perspective' && data.structuredData.articleType) {
      graph.push({
        '@type': data.structuredData.articleType,
        headline: data.hero.title,
        description: data.seo.description,
        url: `https://metaverse.center${data.seo.canonical}`,
        ...(data.structuredData.datePublished
          ? { datePublished: data.structuredData.datePublished }
          : {}),
        ...(data.structuredData.dateModified
          ? { dateModified: data.structuredData.dateModified }
          : {}),
        ...(data.structuredData.wordCount
          ? { wordCount: data.structuredData.wordCount }
          : {}),
        author: {
          '@type': 'Organization',
          name: 'Bureau of Impossible Geography',
          url: 'https://metaverse.center',
        },
        publisher: {
          '@type': 'Organization',
          name: 'metaverse.center',
          url: 'https://metaverse.center',
          logo: {
            '@type': 'ImageObject',
            url: 'https://metaverse.center/icons/icon-512.png',
          },
        },
        ...(data.seo.ogImage ? { image: data.seo.ogImage } : {}),
      });
    } else {
      graph.push({
        '@type': 'WebPage',
        name: data.hero.title,
        description: data.seo.description,
        url: `https://metaverse.center${data.seo.canonical}`,
      });
    }

    if (data.faqs.length > 0) {
      graph.push({
        '@type': 'FAQPage',
        mainEntity: data.faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      });
    }

    seoService.setStructuredData({
      '@context': 'https://schema.org',
      '@graph': graph,
    });
  }

  /* ── Scroll-spy ─────────────────────────────── */

  private _setupScrollSpy(): void {
    const sections = this.renderRoot.querySelectorAll('.section[id]');
    if (!sections.length) return;

    this._scrollSpyObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this._activeSection = entry.target.id;
          }
        }
      },
      { rootMargin: '-20% 0px -70% 0px' },
    );

    for (const section of sections) {
      this._scrollSpyObserver.observe(section);
    }
  }

  /* ── Scroll reveal ──────────────────────────── */

  private _setupScrollReveal(): void {
    const sections = this.renderRoot.querySelectorAll('.section');
    if (!sections.length) return;

    this._revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
          }
        }
      },
      { threshold: 0.1 },
    );

    for (const section of sections) {
      this._revealObserver.observe(section);
    }
  }

  private _scrollToSection(id: string): void {
    const el = (this.renderRoot as ShadowRoot).getElementById(id);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ── Render ─────────────────────────────────── */

  protected render() {
    if (this._loading) {
      return html`
        <div style="display:flex;align-items:center;justify-content:center;min-height:50vh;">
          <span style="font-family:var(--font-brutalist);font-weight:var(--font-bold);font-size:var(--text-lg);text-transform:uppercase;letter-spacing:var(--tracking-brutalist);color:var(--color-text-secondary);">
            ${msg('Loading...')}
          </span>
        </div>
      `;
    }

    if (!this._data) {
      return html`
        <div style="display:flex;align-items:center;justify-content:center;min-height:50vh;">
          <span style="font-family:var(--font-brutalist);font-weight:var(--font-bold);font-size:var(--text-lg);text-transform:uppercase;letter-spacing:var(--tracking-brutalist);color:var(--color-text-secondary);">
            ${msg('Page not found.')}
          </span>
        </div>
      `;
    }

    const d = this._data;
    const isPerspective = d.type === 'perspective';

    return html`
      <a class="skip-link" href="#main-content">${msg('Skip to content')}</a>

      ${this._renderHero(d)}

      <div class="layout">
        ${this._renderToc(d)}

        <main class="content" id="main-content">
          <article>
            ${d.sections.map(
              (s) => html`
                <section class="section" id=${s.id}>
                  <div class="section__divider">
                    <span class="section__number">${s.number}</span>
                    <div class="section__rule"></div>
                  </div>
                  <h2 class="section__title">${s.title}</h2>
                  <div class="${isPerspective ? 'prose' : 'section__text'}">
                    ${s.content}
                  </div>
                </section>
              `,
            )}

            ${d.faqs.length > 0 ? this._renderFaqs(d) : nothing}
            ${d.ctas.length > 0 ? this._renderCtas(d) : nothing}
          </article>
        </main>
      </div>
    `;
  }

  /* ── Hero ────────────────────────────────────── */

  private _renderHero(d: ContentPageData) {
    return html`
      <div class="hero">
        <div class="hero__scanlines"></div>
        <div class="hero__inner">
          ${d.hero.classification
            ? html`<div class="hero__classification">${d.hero.classification}</div>`
            : nothing}
          <h1 class="hero__title">${d.hero.title}</h1>
          <p class="hero__sub">${d.hero.subtitle}</p>
          <div class="hero__line"></div>
          ${d.hero.byline || d.hero.datePublished || d.hero.readTime
            ? html`
              <div class="hero__byline">
                ${d.hero.byline ? html`<span>${d.hero.byline}</span>` : nothing}
                ${d.hero.byline && d.hero.datePublished
                  ? html`<span class="hero__byline-sep"></span>`
                  : nothing}
                ${d.hero.datePublished ? html`<span>${d.hero.datePublished}</span>` : nothing}
                ${d.hero.readTime
                  ? html`<span class="hero__byline-sep"></span><span>${d.hero.readTime}</span>`
                  : nothing}
              </div>
            `
            : nothing}
        </div>
      </div>
    `;
  }

  /* ── TOC ─────────────────────────────────────── */

  private _renderToc(d: ContentPageData) {
    return html`
      <nav class="toc" aria-label="${msg('Table of Contents')}">
        <div class="toc__label">${msg('Contents')}</div>
        <ul class="toc__list">
          ${d.sections.map(
            (s) => html`
              <li>
                <a
                  class="toc__link ${this._activeSection === s.id ? 'toc__link--active' : ''}"
                  @click=${() => this._scrollToSection(s.id)}
                >${s.tocLabel}</a>
              </li>
            `,
          )}
        </ul>
      </nav>
    `;
  }

  /* ── FAQs ────────────────────────────────────── */

  private _renderFaqs(d: ContentPageData) {
    return html`
      <div class="faq-section">
        <h3 class="faq-section__title">${msg('Frequently Asked Questions')}</h3>
        ${d.faqs.map(
          (faq) => html`
            <details class="faq-item">
              <summary>${faq.question}</summary>
              <div class="faq-item__answer">${faq.answer}</div>
            </details>
          `,
        )}
      </div>
    `;
  }

  /* ── CTAs ────────────────────────────────────── */

  private _renderCtas(d: ContentPageData) {
    return html`
      <div class="cta-section">
        ${d.ctas.map(
          (cta) => html`
            <a
              class="cta-btn cta-btn--${cta.variant}"
              href=${cta.href}
              @click=${(e: Event) => {
                e.preventDefault();
                this.dispatchEvent(
                  new CustomEvent('navigate', {
                    detail: cta.href,
                    bubbles: true,
                    composed: true,
                  }),
                );
              }}
            >${cta.label}</a>
          `,
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-content-page': VelgContentPage;
  }
}
