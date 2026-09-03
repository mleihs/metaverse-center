import { localized, msg } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { forgeStateManager } from '../../services/ForgeStateManager.js';
import { captureError } from '../../services/SentryService.js';
import { icons } from '../../utils/icons.js';
import { t } from '../../utils/locale-fields.js';
import { navigate } from '../../utils/navigation.js';
import type { ThreatLevel } from '../lore/lore-content.js';
import {
  extractThreatLevel,
  fetchRawLoreSections,
  isClassifiedSection,
} from '../lore/lore-content.js';

@localized()
@customElement('velg-simulation-header')
export class VelgSimulationHeader extends SignalWatcher(LitElement) {
  static styles = css`
    :host {
      display: block;
      position: relative;
      overflow: hidden;
      border-bottom: var(--border-width-thin) solid var(--color-border-light);
      background: var(--color-surface-sunken);

      /* ── Tier 3 ─────────────────────────────────────────────────────── */
      --_ground: var(--color-surface-sunken);
      --_measure: var(--stage-measure, 1920px);
      /*
       * The gutter is the tab register's gutter plus the tab's own inline
       * padding, so the world name starts on the same x as the first tab label
       * one row below. Two rows of chrome that do not line up read as two
       * unrelated bars.
       */
      --_gutter: max(var(--space-10), calc((100% - var(--_measure)) / 2));
      --_dim: var(--color-text-quiet);
    }

    /* ── Backdrop ────────────────────────────────────────────────────── */

    /*
     * The Ken Burns and the dimming live on THIS layer and never on :host.
     * A filter or a transform on the masthead itself would make it a containing
     * block, and every position: fixed modal in the app — lightbox, dispatch,
     * confirm dialog — would anchor to it instead of the viewport. The bug is
     * invisible until someone opens one. Same construction as LandingHero.
     */
    .masthead__art {
      position: absolute;
      inset: 0;
      background-size: cover;
      background-position: center 35%;
      /*
       * Die Behandlung des Banners haengt davon ab, worauf der Titel steht.
       *
       * Vorher stand hier fest brightness(0.62) saturate(0.85) — eine
       * Dunkel-Thema-Annahme: das Bild abdunkeln, damit HELLE Schrift darauf
       * traegt. Auf einer hellen Welt ist die Schrift dunkel, also schob
       * derselbe Filter Bild und Text aufeinander zu. Auf Prod gemessen war
       * das der graue Schleier hinter dem Weltnamen.
       *
       * --theme-polarity ist 0 auf dunklem und 1 auf hellem Grund (gesetzt in
       * ThemeService, wo die Farben ohnehin geparst werden). Interpoliert
       * statt verzweigt: EINE Deklaration deckt beide Welten, und der
       * Vorgabewert 0 laesst die Plattform-Flaechen unveraendert.
       */
      filter: brightness(calc(0.62 + var(--theme-polarity, 0) * 0.46))
        saturate(calc(0.85 + var(--theme-polarity, 0) * 0.25));
      animation: ken-burns 34s var(--ease-in-out, ease-in-out) infinite alternate;
    }

    @keyframes ken-burns {
      from {
        scale: 1;
      }
      to {
        scale: 1.06;
      }
    }

    /*
     * Two scrims, not one. The 94deg wash carries the text side; the vertical
     * one seats the masthead against the register below it. Together they are
     * what makes a 74px word legible over an arbitrary generated image.
     */
    /*
     * Die drei Stufen des Wasch-Scrims sind auf hellem Grund schwaecher.
     *
     * Auf Dunkel deckt die Textseite mit 97 % — dort ist der Grund fast
     * schwarz, das Bild verschwindet und die Schrift traegt. Auf Hell ist
     * derselbe Wert eine fast undurchsichtige helle Flaeche: das Banner war
     * praktisch weg, und uebrig blieb genau die graue Leere aus dem Befund.
     * Der Entwurf verlangt dort mindestens 35 % Bild — deshalb 65 statt 97.
     */
    :host {
      --_scrim-near: calc(97% - var(--theme-polarity, 0) * 32%);
      --_scrim-mid: calc(72% - var(--theme-polarity, 0) * 24%);
      --_scrim-far: calc(22% - var(--theme-polarity, 0) * 7%);
    }

    .masthead__scrim {
      position: absolute;
      inset: 0;
      background:
        linear-gradient(
          94deg,
          color-mix(in srgb, var(--_ground) var(--_scrim-near), transparent) 28%,
          color-mix(in srgb, var(--_ground) var(--_scrim-mid), transparent) 56%,
          color-mix(in srgb, var(--_ground) var(--_scrim-far), transparent) 100%
        ),
        linear-gradient(
          180deg,
          color-mix(in srgb, var(--_ground) 55%, transparent),
          transparent 32%,
          transparent 60%,
          color-mix(in srgb, var(--_ground) 85%, transparent)
        );
    }

    .masthead__scanlines {
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 3px,
        color-mix(in srgb, var(--color-text-inverse) 12%, transparent) 3px,
        color-mix(in srgb, var(--color-text-inverse) 12%, transparent) 6px
      );
      pointer-events: none;
    }

    /* ── Content ─────────────────────────────────────────────────────── */

    .masthead__body {
      position: relative;
      /*
       * Der Abstand haengt an der FENSTERHOEHE, nicht an einer festen Zahl.
       *
       * Gemessen: von 320 px Masthead waren 179 px Inhalt (Chips 20, Name 71,
       * Fuss 88) und 104 px Innenabstand — 44 % der Hoehe trugen nichts. Auf
       * einem hohen Schirm darf ein Banner grosszuegig sein, auf einem 927 px
       * hohen ist dasselbe Mass ein Drittel des Sichtbaren.
       *
       * clamp gegen vh statt fester --space-Stufen: die Skala beschreibt
       * Abstaende zwischen Dingen, nicht den Anteil eines Banners am Schirm.
       * Die Enden sind trotzdem Skalenwerte, damit es nicht beliebig wird.
       */
      padding: clamp(var(--space-6), 4.5vh, var(--space-14)) var(--_gutter)
        clamp(var(--space-5), 3.8vh, var(--space-12));
    }

    .rise {
      animation: rise 700ms var(--ease-out, ease-out) both;
      animation-delay: var(--_delay, 0ms);
    }

    @keyframes rise {
      from {
        opacity: 0;
        translate: 0 20px;
      }
      to {
        opacity: 1;
        translate: 0 0;
      }
    }

    /* ── Chips ───────────────────────────────────────────────────────── */

    .chips {
      display: flex;
      align-items: center;
      gap: var(--space-3-5);
      flex-wrap: wrap;
      margin-block-end: var(--space-4-5, var(--space-4));
    }

    .chip {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1-5);
      font-family: var(--font-mono);
      font-size: var(--text-2xs);
      letter-spacing: calc(var(--tracking-widest) * 2);
      text-transform: var(--label-transform);
      color: var(--_chip, var(--color-text-quiet));
      white-space: nowrap;
    }

    .chip--boxed {
      border: var(--border-width-thin) solid var(--_chip, var(--color-border));
      padding: var(--space-0-5) var(--space-2-5);
      background: color-mix(in srgb, var(--_ground) 60%, transparent);
    }

    .chip__pulse {
      width: 6px;
      height: 6px;
      border-radius: var(--border-radius-full);
      background: var(--_chip, var(--color-accent-green));
      box-shadow: 0 0 calc(8px * var(--glow-strength)) var(--_chip, var(--color-accent-green));
      animation: chip-blink 2.2s ease-in-out infinite;
    }

    @keyframes chip-blink {
      0%,
      100% {
        opacity: 1;
      }
      50% {
        opacity: 0.2;
      }
    }

    /* ── World name ──────────────────────────────────────────────────── */

    /*
     * clamp() rather than --stage-type-scale: a single factor can only carry one
     * slope, and this word has to go from a phone to a 4K wall. The token scales
     * section headings and body copy, which move much less.
     */
    .masthead__name {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      /*
       * 20 % kleiner als der Entwurf, auf Ansage des Nutzers.
       *
       * Der Handoff nennt „~74px @1440, clamp"; das war clamp(2.25rem, 5.2vw,
       * 4.625rem). Alle drei Werte mal 0,8. Gemessen war der Masthead 320 px
       * hoch bei 927 px Fensterhoehe — ein Drittel des Schirms fuer einen
       * Namen und eine Zeile.
       */
      font-size: clamp(1.8rem, 4.16vw, 3.7rem);
      line-height: 0.96;
      letter-spacing: 0.01em;
      text-transform: var(--heading-transform);
      color: var(--color-text-primary);
      text-shadow: 0 5px 40px color-mix(in srgb, var(--_ground) 75%, transparent);
      margin: 0 0 var(--space-5);
      text-wrap: balance;
    }

    .masthead__dot {
      color: var(--color-accent-amber-readable);
    }

    /* ── Foot: tagline and call to action ────────────────────────────── */

    .masthead__foot {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: var(--space-14);
    }

    /*
     * Three lines, and the reason is a measurement rather than a taste.
     *
     * The handoff calls this a tagline and bounds it at 620px, which bounds the
     * WIDTH. What feeds it is simulations.description, and on a real world
     * that is not a tagline: measured at 1440 on "State Pathography", 922
     * characters over 13 lines, which made the masthead 684px tall — 75% of the
     * viewport, on EVERY tab, pushing the roster, the dossier and the register
     * below the fold.
     *
     * A masthead introduces the page; it does not replace it. Three lines is
     * the most that still reads as an opening line, and the full text is one
     * click away in the dossier, where it belongs.
     */
    .masthead__tagline {
      font-family: var(--font-bureau, var(--font-prose));
      font-style: italic;
      font-size: var(--text-md);
      line-height: var(--leading-relaxed);
      color: var(--color-text-secondary);
      margin: 0;
      max-width: 620px;
      text-wrap: pretty;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .masthead__actions {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: var(--space-3);
      flex: 0 0 auto;
    }

    .cta {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2-5);
      padding: var(--space-4) var(--space-8);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      letter-spacing: calc(var(--tracking-widest) * 3);
      text-transform: var(--label-transform);
      /*
       * Nicht --color-text-inverse: das ist die Umkehrung der THEME-Textfarbe
       * und wird in einem hellen Theme hell — helle Schrift auf der
       * Amber-Fuellung ergibt gemessen 1,89 : 1. Die Fuellung ist nie gethemt,
       * also ist ihre Beschriftung es auch nicht.
       */
      color: var(--color-on-accent-amber);
      background: var(--color-accent-amber);
      border: var(--border-width-thin) solid var(--color-accent-amber-dim);
      box-shadow: var(--shadow-md);
      cursor: pointer;
      transition:
        background var(--transition-normal),
        translate var(--transition-normal),
        box-shadow var(--transition-normal);
    }

    .cta:hover {
      background: var(--color-accent-amber-hover);
      translate: 0 -2px;
      box-shadow: var(--shadow-md), 0 0 calc(20px * var(--glow-strength)) var(--color-accent-amber-glow);
    }

    .cta__arrow {
      display: inline-block;
      transition: translate var(--transition-normal);
    }

    .cta:hover .cta__arrow {
      translate: 5px 0;
    }

    .masthead__stats {
      font-family: var(--font-mono);
      font-size: var(--text-2xs);
      letter-spacing: calc(var(--tracking-widest) * 2);
      text-transform: var(--label-transform);
      color: var(--_dim);
      text-align: end;
    }

    /* ── Bureau dispatch ─────────────────────────────────────────────── */

    .bureau {
      position: absolute;
      top: var(--space-5);
      inset-inline-end: var(--_gutter);
      z-index: var(--z-raised);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 38px;
      height: 38px;
      padding: 0;
      color: var(--color-accent-amber-readable);
      background: color-mix(in srgb, var(--_ground) 70%, transparent);
      border: var(--border-width-thin) solid var(--color-accent-amber-dim);
      cursor: pointer;
      transition:
        background var(--transition-fast),
        color var(--transition-fast);
    }

    .bureau:hover {
      background: var(--color-accent-amber);
      color: var(--color-text-inverse);
    }

    .bureau--pulse {
      animation: bureau-pulse 2.4s ease-in-out infinite;
    }

    .bureau--intro {
      animation: bureau-pulse 1.2s ease-in-out infinite;
    }

    @keyframes bureau-pulse {
      0%,
      100% {
        box-shadow: 0 0 0 0 var(--color-accent-amber-glow);
      }
      50% {
        box-shadow: 0 0 0 8px transparent;
      }
    }

    /* ── Responsive ──────────────────────────────────────────────────── */

    @media (max-width: 900px) {
      .masthead__body {
        padding: var(--space-10) var(--space-6) var(--space-8);
      }

      .masthead__foot {
        flex-direction: column;
        align-items: flex-start;
        gap: var(--space-6);
      }

      .masthead__actions {
        align-items: flex-start;
      }

      .masthead__stats {
        text-align: start;
      }

      .bureau {
        inset-inline-end: var(--space-6);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .masthead__art,
      .chip__pulse,
      .bureau--pulse,
      .bureau--intro {
        animation: none;
      }

      .rise {
        animation: none;
        opacity: 1;
        translate: none;
      }

      .cta,
      .cta__arrow {
        transition: none;
      }
    }
  `;

  @property({ type: String }) simulationId = '';
  @property({ type: Boolean }) introHexagon = false;

  @state() private _threatLevel: ThreatLevel | null = null;
  private _threatLoadedForSim = '';
  private _threatLoadedWithPurchases = 0;

  updated(changed: Map<PropertyKey, unknown>): void {
    if (
      changed.has('simulationId') &&
      this.simulationId &&
      this.simulationId !== this._threatLoadedForSim
    ) {
      this._threatLoadedForSim = this.simulationId;
      this._threatLoadedWithPurchases = 0;
      void this._loadThreatLevel();
    }
  }

  /** Re-check threat level when feature purchases signal changes. */
  private _checkThreatOnPurchaseChange(): void {
    const purchaseVersion = forgeStateManager.featurePurchases.value.size;
    if (purchaseVersion !== this._threatLoadedWithPurchases && this.simulationId) {
      this._threatLoadedWithPurchases = purchaseVersion;
      void this._loadThreatLevel();
    }
  }

  private async _loadThreatLevel(): Promise<void> {
    if (!this.simulationId) return;

    const hasDossier = forgeStateManager.hasCompletedPurchase(
      this.simulationId,
      'classified_dossier',
    );
    if (!hasDossier) {
      this._threatLevel = null;
      return;
    }

    try {
      const raw = await fetchRawLoreSections(this.simulationId);
      if (!raw) return;

      const zeta = raw.find((s) => isClassifiedSection(s) && s.arcanum === 'ZETA');
      if (!zeta) return;

      this._threatLevel = extractThreatLevel(zeta.body);
      forgeStateManager.threatLevel.value = this._threatLevel;
    } catch (err) {
      captureError(err, { source: 'VelgSimulationHeader._loadThreatLevel' });
    }
  }

  private _handleThreatClick(): void {
    this._goTab('lore');
  }

  private _getStatusLabel(status: string): string {
    switch (status) {
      case 'active':
        return msg('active');
      case 'draft':
        return msg('draft');
      case 'configuring':
        return msg('configuring');
      case 'archived':
        return msg('archived');
      default:
        return status;
    }
  }

  private _openDispatch(): void {
    this.dispatchEvent(new CustomEvent('open-bureau-dispatch', { bubbles: true, composed: true }));
  }

  /**
   * Classification, from the record rather than from flavour.
   *
   * The prototype prints a fixed "Restricted" chip. Here it says which of two
   * things is true: a world whose classified dossier has been generated carries
   * sections a visitor cannot read, and one that has not is public in full. The
   * threat reading arrives through the same gate, so the two chips can never
   * disagree.
   */
  private get _isClassified(): boolean {
    return forgeStateManager.hasCompletedPurchase(this.simulationId, 'classified_dossier');
  }

  private _threatChipColor(level: number): string {
    if (level <= 3) return 'var(--color-success)';
    if (level <= 7) return 'var(--color-accent-amber)';
    return 'var(--color-danger)';
  }

  private _threatChipLabel(level: number): string {
    if (level <= 3) return msg('Calm');
    if (level <= 7) return msg('Elevated');
    return msg('Critical');
  }

  /**
   * Ein Ereignis ohne Zuhoerer ist kein Weg.
   *
   * Beide Knoepfe dieses Bauteils — „Bureau Terminal" und die Bedrohungsmarke
   * — schickten ein `navigate-to-tab` los. Gesucht: **null** Zuhoerer im
   * ganzen Werk. Der Nutzer hat es auf Prod bemerkt („beim Klick tut sich
   * nichts"), und er hatte recht: geklickt wurde, gefeuert wurde, gehoert hat
   * es niemand.
   *
   * Dieselbe Form wie ein POST ohne Aufrufer: es gibt eine Oberflaeche, und
   * der Zustand, den sie verspricht, kann nicht eintreten. Ein Ereignis, das
   * eine Absicht nur ANMELDET, braucht eine Gegenstelle; die Reiterleiste
   * einen Ordner weiter navigiert direkt, und das ist hier der richtige Weg —
   * eine Kopfzeile weiss, in welcher Welt sie steht.
   */
  private _goTab(tab: string): void {
    const slug = appState.currentSimulation.value?.slug;
    if (!slug) return;
    navigate(`/simulations/${slug}/${tab}`);
  }

  private _goTerminal(): void {
    this._goTab('terminal');
  }

  protected render() {
    const sim = appState.currentSimulation.value;
    if (!sim) return html``;

    // Reading featurePurchases signal ensures SignalWatcher re-renders on change
    this._checkThreatOnPurchaseChange();

    const canEdit = appState.canEdit.value;
    const hasPulse = canEdit && forgeStateManager.hasAnyUnpurchasedFeature(this.simulationId);
    const bureauClass = this.introHexagon ? 'bureau--intro' : hasPulse ? 'bureau--pulse' : '';

    const name = t(sim, 'name');
    const tagline = t(sim, 'description');
    const threat = this._threatLevel;
    const stats = [
      sim.agent_count ? `${sim.agent_count} ${msg('agents')}` : null,
      sim.building_count ? `${sim.building_count} ${msg('buildings')}` : null,
      typeof sim.last_heartbeat_tick === 'number'
        ? `${msg('Cycle')} ${sim.last_heartbeat_tick}`
        : null,
    ].filter(Boolean);

    return html`
      ${
        /*
         * The artwork is a computed background and never <img src=…>: a hole in
         * a src attribute makes the browser fetch the page's own URL as an image
         * before the value lands. A world without a banner simply gets the
         * ground, which the scrims are built to sit on anyway.
         */
        sim.banner_url
          ? html`<div
              class="masthead__art"
              style="background-image: url('${sim.banner_url}')"
              aria-hidden="true"
            ></div>`
          : nothing
      }
      <div class="masthead__scrim" aria-hidden="true"></div>
      <div class="masthead__scanlines" aria-hidden="true"></div>

      ${
        canEdit
          ? html`<button
              class="bureau ${bureauClass}"
              @click=${this._openDispatch}
              aria-label=${msg('Bureau Services')}
            >${icons.hexagon(16)}</button>`
          : nothing
      }

      <div class="masthead__body">
        <div class="chips rise" style="--_delay: 0ms">
          <span
            class="chip"
            style="--_chip: color-mix(in srgb, var(--color-accent-green) 45%, var(--color-text-primary))"
          >
            <span class="chip__pulse" aria-hidden="true"></span>
            ${this._getStatusLabel(sim.status)}
          </span>
          <span class="chip chip--boxed">
            ${this._isClassified ? msg('Classified') : msg('Public record')}
          </span>
          ${
            threat
              ? html`<button
                  class="chip chip--boxed"
                  style="--_chip: ${this._threatChipColor(threat.level)}; cursor: pointer"
                  @click=${this._handleThreatClick}
                >
                  ${msg('Threat level')}: ${this._threatChipLabel(threat.level)}
                </button>`
              : nothing
          }
        </div>

        <h1 class="masthead__name rise" style="--_delay: 100ms">
          ${name}<span class="masthead__dot" aria-hidden="true">.</span>
        </h1>

        <div class="masthead__foot rise" style="--_delay: 250ms">
          ${tagline ? html`<p class="masthead__tagline">${tagline}</p>` : html`<span></span>`}
          <div class="masthead__actions">
            <button class="cta" @click=${this._goTerminal}>
              ${msg('Bureau Terminal')} <span class="cta__arrow" aria-hidden="true">→</span>
            </button>
            ${stats.length ? html`<span class="masthead__stats">${stats.join(' · ')}</span>` : nothing}
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-simulation-header': VelgSimulationHeader;
  }
}
