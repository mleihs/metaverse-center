import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { LoreSection } from '../platform/LoreScroll.js';
import { markerSelectionStyles } from '../shared/marker-styles.js';
import '../shared/Lightbox.js';

/**
 * The dossier reader: a table of contents and one chapter at a time.
 *
 * WHY THIS IS NOT LoreScroll
 * `LoreScroll` is an accordion — every section stacked, each expanding in
 * place. That is right for the platform's own lore, which a reader browses.
 * A world's dossier is read, and the 2026-08-31 handoff asks for the reading
 * shape: a register on the left, one chapter in the panel, and a way to turn
 * the page. The two are different enough that bending one into the other would
 * leave a component that does neither well, so `LoreScroll` keeps the platform
 * lore page and this one takes the simulation dossier.
 *
 * REDACTION IS A STATE OF THE PANEL, NOT A MISSING SECTION
 * A classified chapter stays in the table of contents and stays selectable
 * while the case file is shut. What changes is the panel: bars instead of
 * paragraphs, and the figure withheld. A reader must be able to see THAT
 * something is being kept from them — a chapter silently absent from the list
 * would hide the withholding as well as the text.
 */
@localized()
@customElement('velg-lore-dossier')
export class VelgLoreDossier extends LitElement {
  static styles = [
    markerSelectionStyles,
    css`
    :host {
      display: block;

      /* ── Tier 3 ─────────────────────────────────────────────────────── */
      --_kicker-tracking: calc(var(--tracking-widest) * 3);
      --_rule: color-mix(in srgb, var(--color-border-light) 70%, var(--color-surface));
      --_dim: color-mix(in srgb, var(--color-text-muted) 90%, var(--color-surface-sunken));
      /* The reading measure. Everything else may grow; a line of prose may not. */
      --_measure: 740px;
    }

    /* ── Head ────────────────────────────────────────────────────────── */

    .head {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: var(--space-5);
      margin-block-end: var(--space-5);
      flex-wrap: wrap;
    }

    .kicker {
      font-family: var(--font-brutalist);
      font-size: calc(var(--text-xs) * 0.9);
      font-weight: var(--font-bold);
      letter-spacing: var(--_kicker-tracking);
      text-transform: uppercase;
      color: var(--color-accent-amber);
      margin-block-end: var(--space-1-5);
    }

    .head__title {
      margin: 0;
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xl);
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
      color: var(--color-text-primary);
    }

    .casefile {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2-5) var(--space-4-5, var(--space-4));
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      letter-spacing: calc(var(--tracking-widest) * 2);
      text-transform: uppercase;
      color: var(--color-accent-amber);
      background: transparent;
      border: var(--border-width-thin) solid var(--color-accent-amber);
      cursor: pointer;
      transition:
        background var(--transition-normal),
        color var(--transition-normal);
    }

    .casefile[aria-pressed='true'] {
      color: var(--color-text-inverse);
      background: var(--color-accent-amber);
      border-color: var(--color-accent-amber-dim);
      box-shadow: var(--shadow-sm);
    }

    /* ── Frame ───────────────────────────────────────────────────────── */

    .dossier {
      display: grid;
      grid-template-columns: 280px minmax(0, 1fr);
      border: var(--border-width-thin) solid var(--color-border-light);
      background: var(--color-surface);
    }

    @media (max-width: 860px) {
      .dossier {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    /* ── Table of contents ───────────────────────────────────────────── */

    .toc {
      display: flex;
      flex-direction: column;
      border-inline-end: var(--border-width-thin) solid var(--color-border-light);
    }

    @media (max-width: 860px) {
      .toc {
        border-inline-end: none;
        border-block-end: var(--border-width-thin) solid var(--color-border-light);
      }
    }

    .toc__row {
      display: grid;
      grid-template-columns: 26px minmax(0, 1fr);
      gap: var(--space-3);
      align-items: start;
      padding: var(--space-4) var(--space-4);
      text-align: start;
      background: none;
      border: none;
      cursor: pointer;
      transition: background var(--transition-normal);
    }

    .toc__row + .toc__row {
      border-block-start: var(--border-width-thin) solid var(--_rule);
    }

    .toc__row:hover {
      background: color-mix(in srgb, var(--color-text-primary) 4%, transparent);
    }

    .toc__row:hover .toc__title {
      color: var(--color-accent-amber);
      translate: 8px 0;
    }

    .toc__index {
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      color: var(--_dim);
      font-variant-numeric: tabular-nums;
    }

    .toc__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      letter-spacing: var(--tracking-wide);
      text-transform: uppercase;
      color: var(--color-text-primary);
      transition:
        color var(--transition-normal),
        translate var(--transition-normal);
    }

    .toc__row[aria-current='true'] .toc__title {
      color: var(--color-accent-amber);
    }

    .toc__tag {
      display: block;
      margin-block-start: var(--space-1);
      font-family: var(--font-mono);
      font-size: calc(var(--text-xs) * 0.85);
      letter-spacing: calc(var(--tracking-widest) * 2);
      text-transform: uppercase;
      color: var(--color-danger);
    }

    .toc__foot {
      margin-block-start: auto;
      border-block-start: var(--border-width-thin) solid var(--_rule);
      padding: var(--space-4);
      font-family: var(--font-mono);
      font-size: calc(var(--text-xs) * 0.9);
      letter-spacing: var(--tracking-wide);
      text-transform: uppercase;
      color: var(--_dim);
      line-height: var(--leading-loose);
    }

    /* ── Reading panel ───────────────────────────────────────────────── */

    .panel {
      padding: var(--space-9) var(--space-11, var(--space-10));
      min-height: 460px;
    }

    .panel__inner {
      max-width: var(--_measure);
      animation: chapter-in var(--duration-slower) var(--ease-out) both;
    }

    @keyframes chapter-in {
      from {
        opacity: 0;
        translate: 0 8px;
      }
      to {
        opacity: 1;
        translate: 0 0;
      }
    }

    .panel__title {
      margin: 0 0 var(--space-2-5);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xl);
      letter-spacing: var(--tracking-wide);
      text-transform: uppercase;
      color: var(--color-text-primary);
    }

    /*
     * Epigraph: the world's own voice, so Spectral — and the attribution in
     * mono, because the source is a filing reference, not part of the quote.
     * The pattern is LoreScroll's; it is repeated rather than shared because it
     * is four declarations, and a shared module for four declarations costs
     * more to find than to retype.
     */
    .panel__epigraph {
      font-family: var(--font-bureau, var(--font-prose));
      font-style: italic;
      font-size: var(--text-sm);
      line-height: var(--leading-relaxed);
      color: var(--color-text-muted);
      margin: 0 0 var(--space-6);
    }

    .panel__source {
      font-family: var(--font-mono);
      font-style: normal;
      font-size: calc(var(--text-xs) * 0.9);
      letter-spacing: var(--tracking-wider);
      text-transform: uppercase;
      color: var(--_dim);
    }

    .panel__figure {
      margin: 0 0 var(--space-6);
    }

    .panel__image {
      display: block;
      width: 100%;
      aspect-ratio: 16 / 7;
      object-fit: cover;
      border: var(--border-width-thin) solid var(--color-border-light);
      cursor: zoom-in;
    }

    .panel__caption {
      margin-block-start: var(--space-2);
      font-family: var(--font-mono);
      font-size: calc(var(--text-xs) * 0.9);
      letter-spacing: var(--tracking-wider);
      text-transform: uppercase;
      color: var(--_dim);
    }

    /*
     * The figure while the image is still being generated. A skeleton rather
     * than an empty box, because the reader is waiting for something specific
     * and a blank would read as "there is nothing here".
     */
    .panel__shimmer {
      width: 100%;
      aspect-ratio: 16 / 7;
      border: var(--border-width-thin) solid var(--color-border-light);
      background: linear-gradient(
          100deg,
          transparent 20%,
          color-mix(in srgb, var(--color-text-primary) 6%, transparent) 40%,
          transparent 60%
        ),
        var(--color-surface-raised);
      background-size: 220% 100%;
      animation: shimmer 1.6s linear infinite;
    }

    @keyframes shimmer {
      from {
        background-position: 120% 0;
      }
      to {
        background-position: -120% 0;
      }
    }

    .panel__para {
      font-family: var(--font-bureau, var(--font-prose));
      font-size: 16.5px;
      line-height: 1.85;
      color: var(--color-text-secondary);
      margin: 0 0 var(--space-4-5, var(--space-4));
      text-wrap: pretty;
    }

    /* ── Redaction ───────────────────────────────────────────────────── */

    .redaction {
      display: flex;
      flex-direction: column;
      gap: var(--space-2-5);
      margin-block-end: var(--space-5);
    }

    .redaction__bar {
      display: block;
      height: 13px;
      width: var(--_w, 90%);
      background: repeating-linear-gradient(
        90deg,
        color-mix(in srgb, var(--color-text-primary) 8%, var(--color-surface)) 0 16px,
        color-mix(in srgb, var(--color-text-primary) 4%, var(--color-surface)) 16px 22px
      );
    }

    .redaction__hint {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      letter-spacing: calc(var(--tracking-widest) * 2);
      text-transform: uppercase;
      color: var(--color-accent-amber);
      margin: 0;
    }

    /* ── Turning the page ────────────────────────────────────────────── */

    .turn {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--space-5);
      border-block-start: var(--border-width-thin) solid var(--_rule);
      margin-block-start: var(--space-7);
      padding-block-start: var(--space-4);
    }

    .turn__btn {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      max-width: 46%;
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      letter-spacing: calc(var(--tracking-widest) * 2);
      text-transform: uppercase;
      color: var(--color-text-muted);
      background: none;
      border: none;
      padding: 0;
      cursor: pointer;
      text-align: start;
      transition: color var(--transition-normal);
    }

    .turn__btn:last-child {
      color: var(--color-accent-amber);
      text-align: end;
    }

    .turn__btn:hover {
      color: var(--color-accent-amber-hover);
    }

    .turn__label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .turn__arrow {
      flex: none;
      transition: translate var(--transition-normal);
    }

    .turn__btn:hover .turn__arrow {
      translate: -5px 0;
    }

    .turn__btn:last-child:hover .turn__arrow {
      translate: 5px 0;
    }

    @media (prefers-reduced-motion: reduce) {
      .panel__inner,
      .panel__shimmer {
        animation: none;
      }

      .toc__row,
      .toc__title,
      .turn__btn,
      .turn__arrow {
        transition: none;
      }
    }
  `,
  ];

  @property({ type: Array }) sections: LoreSection[] = [];
  /** IDs of sections that are classified — they redact while the case file is shut. */
  @property({ type: Object }) classifiedSectionIds: Set<string> = new Set();
  /** Storage path prefix for figure images, e.g. `the-chitinous-mandate/lore`. */
  @property({ type: String }) basePath = '';
  /** True while the image pipeline is still producing figures. */
  @property({ type: Boolean }) generating = false;
  @property({ type: Object }) pendingImageSlugs: Set<string> = new Set();
  /** Whether the reader has the case file open (classified chapters legible). */
  @property({ type: Boolean }) caseFileOpen = false;
  /** Whether a case file exists to open at all. */
  @property({ type: Boolean }) hasCaseFile = false;
  /** The anchor line shown in the register's foot, if the world has one. */
  @property({ type: String }) anchorTitle = '';

  @state() private _index = 0;
  @state() private _lightboxSrc: string | null = null;
  @state() private _lightboxCaption = '';

  /**
   * Bar widths for a redacted chapter.
   *
   * Fixed, not random: a redaction that reshuffles on every render tells the
   * reader the bars are decoration. These are the handoff's six.
   */
  private static readonly REDACTION_WIDTHS = [92, 84, 96, 70, 88, 42];

  private get _current(): LoreSection | undefined {
    return this.sections[Math.min(this._index, this.sections.length - 1)];
  }

  private _isRedacted(section: LoreSection): boolean {
    return this.classifiedSectionIds.has(section.id) && !this.caseFileOpen;
  }

  private _imageUrl(slug: string): string | null {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl || !this.basePath) return null;
    return `${supabaseUrl}/storage/v1/object/public/simulation.assets/${this.basePath}/${slug}.avif`;
  }

  private _select(index: number): void {
    this._index = index;
  }

  private _turn(delta: number): void {
    const n = this.sections.length;
    if (!n) return;
    this._index = (this._index + delta + n) % n;
  }

  private _toggleCaseFile(): void {
    this.dispatchEvent(
      new CustomEvent('case-file-toggle', { bubbles: true, composed: true }),
    );
  }

  private _openLightbox(src: string, caption: string): void {
    this._lightboxSrc = src;
    this._lightboxCaption = caption;
  }

  private _closeLightbox(): void {
    this._lightboxSrc = null;
  }

  protected render() {
    if (!this.sections.length) return nothing;
    const section = this._current;
    if (!section) return nothing;

    const classifiedCount = this.sections.filter((s) =>
      this.classifiedSectionIds.has(s.id),
    ).length;

    return html`
      <div class="head">
        <div>
          <div class="kicker">${msg('Public record')}</div>
          <h2 class="head__title">${msg('World dossier')}</h2>
        </div>
        ${
          this.hasCaseFile
            ? html`<button
                class="casefile"
                aria-pressed=${this.caseFileOpen}
                @click=${this._toggleCaseFile}
              >
                ${this.caseFileOpen ? msg('Case file open') : msg('Open case file')}
              </button>`
            : nothing
        }
      </div>

      <div class="dossier">
        <nav class="toc" aria-label=${msg('Chapters')}>
          ${this.sections.map(
            (s, i) => html`
              <button
                class="toc__row ${i === this._index ? 'is-selected' : ''}"
                aria-current=${i === this._index ? 'true' : 'false'}
                @click=${() => this._select(i)}
              >
                <span class="toc__index">${String(i + 1).padStart(2, '0')}</span>
                <span style="min-width: 0">
                  <span class="toc__title">${s.title}</span>
                  ${
                    this.classifiedSectionIds.has(s.id)
                      ? html`<span class="toc__tag">${msg('Classified')}</span>`
                      : nothing
                  }
                </span>
              </button>
            `,
          )}
          <div class="toc__foot">
            ${this.sections.length} ${msg('sections')}
            ${classifiedCount ? html` · ${classifiedCount} ${msg('classified')}` : nothing}
            ${this.anchorTitle ? html`<br />${msg('Anchor')}: ${this.anchorTitle}` : nothing}
          </div>
        </nav>

        <article class="panel">
          <div class="panel__inner" .key=${section.id}>
            <h3 class="panel__title">${section.title}</h3>
            ${
              section.epigraph
                ? html`<p class="panel__epigraph">“${section.epigraph}”</p>`
                : nothing
            }
            ${this._renderBody(section)}
            ${this._renderTurn()}
          </div>
        </article>
      </div>

      ${
        this._lightboxSrc
          ? html`<velg-lightbox
              .src=${this._lightboxSrc}
              .caption=${this._lightboxCaption}
              @lightbox-close=${this._closeLightbox}
            ></velg-lightbox>`
          : nothing
      }
    `;
  }

  private _renderBody(section: LoreSection) {
    if (this._isRedacted(section)) {
      return html`
        <div class="redaction" role="img" aria-label=${msg('Redacted text')}>
          ${VelgLoreDossier.REDACTION_WIDTHS.map(
            (w) => html`<span class="redaction__bar" style="--_w: ${w}%"></span>`,
          )}
        </div>
        <p class="redaction__hint">
          ${msg('This chapter is sealed. Open the case file to read it.')}
        </p>
      `;
    }

    const pending =
      this.generating && !!section.imageSlug && this.pendingImageSlugs.has(section.imageSlug);
    const url = section.imageSlug && !pending ? this._imageUrl(section.imageSlug) : null;
    const caption = section.imageCaption ?? '';
    const figNumber = String(this._index + 1).padStart(2, '0');

    return html`
      ${
        pending
          ? html`<figure class="panel__figure">
              <div class="panel__shimmer" aria-label=${msg('Figure is being drawn')}></div>
            </figure>`
          : url
            ? html`<figure class="panel__figure">
                <img
                  class="panel__image"
                  src=${url}
                  alt=${section.title}
                  loading="lazy"
                  @click=${() => this._openLightbox(url, caption)}
                />
                <figcaption class="panel__caption">
                  ${msg('Fig.')} ${figNumber}${caption ? ` – ${caption}` : ''}
                </figcaption>
              </figure>`
            : nothing
      }
      ${section.body
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => html`<p class="panel__para">${p}</p>`)}
    `;
  }

  private _renderTurn() {
    const n = this.sections.length;
    if (n < 2) return nothing;
    const prev = this.sections[(this._index - 1 + n) % n];
    const next = this.sections[(this._index + 1) % n];

    return html`
      <div class="turn">
        <button class="turn__btn" @click=${() => this._turn(-1)}>
          <span class="turn__arrow" aria-hidden="true">←</span>
          <span class="turn__label">${prev.title}</span>
        </button>
        <button class="turn__btn" @click=${() => this._turn(1)}>
          <span class="turn__label">${next.title}</span>
          <span class="turn__arrow" aria-hidden="true">→</span>
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-lore-dossier': VelgLoreDossier;
  }
}
