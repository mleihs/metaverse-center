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
import { customElement, query, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { simulationsApi } from '../../services/api/SimulationsApiService.js';
import { captureError } from '../../services/SentryService.js';
import { seoService } from '../../services/SeoService.js';
import type { Simulation } from '../../types/index.js';
import { t } from '../../utils/locale-fields.js';
import { navigate } from '../../utils/navigation.js';
import { getThemeColor } from '../../utils/theme-colors.js';
import '../shared/PlatformFooter.js';
import { setupScrollReveal } from '../../utils/scroll-reveal.js';
import { DEFAULT_TAB } from '../../utils/sim-view-imports.js';

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
      color: var(--color-text-quiet);
    }

    .search-input:focus {
      outline: none;
      border-color: var(--color-accent-amber);
    }

    .results-count {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: 11px;
      color: var(--color-text-quiet);
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
      color: var(--color-text-quiet);
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
      color: var(--color-text-quiet);
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
      color: var(--color-text-quiet);
      animation: pulse-text 1.5s ease-in-out infinite;
    }

    @keyframes pulse-text {
      0%, 100% { opacity: 0.4; }
      50%      { opacity: 1; }
    }

    /* ── Listenende ─────────────────────────── */

    /*
     * Kein Blaettern mehr, sondern ein Ende, das sich meldet.
     *
     * Die Hoehe ist Absicht und nicht Zierrat: das Element muss gross genug
     * sein, dass der Beobachter es sicher trifft, auch wenn der Leser schnell
     * scrollt. Ein 1-px-Anker wird bei schnellem Scrollen uebersprungen, und
     * dann laedt nichts nach, ohne dass irgendetwas kaputt aussieht.
     */
    .tail {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 72px;
      padding: 0 var(--space-6, 24px) var(--space-12, 48px);
    }

    .tail__note {
      font-family: var(--font-mono);
      font-size: var(--text-2xs);
      letter-spacing: var(--tracking-wider);
      text-transform: uppercase;
      color: var(--color-text-quiet);
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

  @state() private _loadingMore = false;

  private _limit = 12;
  private _observer?: IntersectionObserver;

  /**
   * Der zweite Beobachter — der fuer das Nachladen.
   *
   * Bewusst NICHT derselbe wie `_observer`: der wird in `updated()` bei jedem
   * Rendern neu aufgesetzt (Scroll-Reveal), und ein Nachlade-Beobachter, der
   * sich waehrend des Nachladens selbst abbaut, feuert entweder doppelt oder
   * gar nicht mehr. Zwei Aufgaben, zwei Beobachter.
   */
  private _tailObserver?: IntersectionObserver;

  /** Das Element am Listenende, dessen Sichtbarkeit die naechste Seite holt. */
  @query('.tail') private _tail?: HTMLElement;

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    await this._fetchSimulations();
  }

  protected firstUpdated(): void {
    this._setupScrollReveal();
  }

  protected updated(): void {
    this._setupScrollReveal();
    this._setupTailObserver();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._observer?.disconnect();
    this._tailObserver?.disconnect();
    seoService.removeStructuredData();
  }

  /**
   * Eine Seite holen — und ANHAENGEN, nicht ersetzen.
   *
   * Vorher ersetzte jede Seite die vorige, und zwei Knoepfe schoben den
   * Versatz hin und her. Fuer ein Register ist das die falsche Geste: wer
   * durch Welten blaettert, sucht nicht Seite 3, er sucht weiter. Jetzt
   * verlaengert sich die Liste, sobald ihr Ende in den Blick kommt.
   *
   * `anhaengen` unterscheidet die beiden Faelle sauber: der erste Abruf setzt
   * die Liste (und `_loading` zeichnet den Skelettzustand), jeder weitere
   * haengt an (und `_loadingMore` zeichnet nur die Fusszeile). Ohne diese
   * Trennung wuerde beim Nachladen die ganze Galerie kurz verschwinden.
   */
  private async _fetchSimulations(anhaengen = false): Promise<void> {
    if (anhaengen) this._loadingMore = true;
    else this._loading = true;
    try {
      const resp = await simulationsApi.listPublic({
        limit: String(this._limit),
        offset: String(this._offset),
      });
      if (resp.success && Array.isArray(resp.data)) {
        const seite = resp.data as Simulation[];
        this._simulations = anhaengen ? [...this._simulations, ...seite] : seite;
        this._total = resp.meta?.total ?? this._simulations.length;
        this._injectStructuredData();
      }
    } catch (err) {
      captureError(err, { source: 'VelgWorldsGallery._fetchSimulations' });
    } finally {
      this._loading = false;
      this._loadingMore = false;
    }
  }

  private get _hatMehr(): boolean {
    return this._simulations.length < this._total;
  }

  /**
   * Die naechste Seite, wenn das Listenende sichtbar wird.
   *
   * Drei Riegel, und jeder hat einen Grund: `_loadingMore` verhindert, dass
   * ein zweites Sichtbarwerden waehrend des Ladens eine dritte Seite holt;
   * `_hatMehr` verhindert einen Abruf, der nichts mehr bringt; `_loading`
   * verhindert, dass der erste Abruf und das Nachladen sich ueberholen.
   */
  private _ladeMehr(): void {
    if (this._loading || this._loadingMore || !this._hatMehr) return;
    this._offset += this._limit;
    void this._fetchSimulations(true);
  }

  private _setupTailObserver(): void {
    this._tailObserver?.disconnect();
    if (!this._tail || !this._hatMehr) return;
    this._tailObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) this._ladeMehr();
      },
      // Vorlauf: die naechste Seite steht bereit, bevor der Leser das Ende
      // erreicht. Ohne ihn sieht man bei jedem Nachladen eine Luecke.
      { rootMargin: '600px' },
    );
    this._tailObserver.observe(this._tail);
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
          url: `https://metaverse.center/simulations/${sim.slug || sim.id}/${DEFAULT_TAB}`,
          ...(sim.banner_url ? { image: sim.banner_url } : {}),
        })),
      },
    });
  }

  private _setupScrollReveal(): void {
    this._observer = setupScrollReveal(this.renderRoot, '.scroll-reveal', this._observer);
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
                      href="/simulations/${sim.slug || sim.id}/${DEFAULT_TAB}"
                      @click=${(e: Event) => {
                        e.preventDefault();
                        navigate(`/simulations/${sim.slug || sim.id}/${DEFAULT_TAB}`);
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

              <!--
                Das Listenende statt zweier Blaetter-Knoepfe. Der Beobachter
                haengt an .tail und holt die naechste Seite, bevor der Leser
                unten ankommt (600 px Vorlauf).

                Die Zeile bleibt auch dann stehen, wenn alles geladen ist —
                dann nennt sie die Zahl. Ein Register, das schweigend aufhoert,
                laesst offen, ob es zu Ende ist oder haengt.
              -->
              <div class="tail">
                ${
                  this._loadingMore
                    ? html`<span class="tail__note">${msg('Loading more worlds...')}</span>`
                    : this._hatMehr
                      ? nothing
                      : html`<span class="tail__note">
                          ${msg(str`All ${this._total} worlds on record.`)}
                        </span>`
                }
              </div>
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
                  navigate('/register');
                }}
              >
                ${msg('Forge Your World')}
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
