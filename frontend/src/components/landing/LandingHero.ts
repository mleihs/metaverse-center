/**
 * Navigation, Held und Laufband - der erste Bildschirm.
 *
 * VIER DAUERLAEUFER, ALLE ANHALTBAR
 * Der Entwurf traegt gleichzeitig einen Ken-Burns-Zoom (34 s), ein Laufband
 * (30 s), einen pulsierenden Punkt (2,2 s) und - weiter unten - ein Tippfeld.
 * Keiner davon steht im Handoff unter `prefers-reduced-motion`. Das ist nicht
 * Geschmack, sondern WCAG-AA-relevant: fuer Menschen mit vestibulaerer
 * Empfindlichkeit ist eine Seite mit vier gleichzeitigen Schleifen unbenutzbar.
 * Hier haelt die Vorliebe alle vier an; das Laufband steht dann still und zeigt
 * seinen Inhalt als ruhige Zeile.
 *
 * WO DIE FILTER SITZEN
 * Der Held will `brightness(.72)` und einen Ken-Burns-`scale()`. Beides liegt
 * auf dem `<img>`, niemals auf dem Abschnitt - ein `filter` oder `transform`
 * auf einem Layout-Behaelter erzeugt einen neuen Bezugsrahmen und bricht jedes
 * `position: fixed`-Fenster dieser Seite (CLAUDE.md, hart).
 *
 * DAS LAUFBAND DRUCKT KEINE NULL
 * Jede Kennzahl kommt aus dem Schnappschuss, und eine mit dem Wert 0 wird
 * ausgelassen statt gedruckt. "0 Epochen im Spiel" ist schlechter als gar
 * nichts - und es ist der heutige Stand. Dieselbe Regel wie beim Wochenbericht.
 */

import { localized, msg, str } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { LandingCounts, LandingWorld } from '../../types/index.js';
import { t } from '../../utils/locale-fields.js';
import { navigate } from '../../utils/navigation.js';
import {
  LANDING_HERO_STEM,
  LANDING_IMAGE_SIZES,
  landingFallbackUrl,
  landingSrcset,
} from './landing-images.js';

@localized()
@customElement('velg-landing-hero')
export class VelgLandingHero extends LitElement {
  static styles = css`
    :host {
      /* Tier 3 - die drei Grautoene des Entwurfs abgeleitet, nicht erfunden. */
      --_ground: var(--color-surface);
      --_sunken: var(--color-surface-sunken);
      --_rule: var(--color-border-light);
      --_veil-strong: color-mix(in srgb, var(--color-surface) 97%, transparent);
      --_veil-mid: color-mix(in srgb, var(--color-surface) 70%, transparent);
      --_veil-soft: color-mix(in srgb, var(--color-surface) 22%, transparent);
      --_veil-top: color-mix(in srgb, var(--color-surface) 70%, transparent);
      --_veil-bottom: color-mix(in srgb, var(--color-surface) 50%, transparent);
      --_scanline: color-mix(in srgb, var(--color-surface-inverse) 0%, transparent);

      display: block;
      background: var(--_ground);
    }

    /* ── Navigation ────────────────────────────────────────────────── */

    /* Der Unterstrich spannt ueber den ganzen Sichtbereich, der Inhalt sitzt im
       Mass der Seite. Deshalb kein zweites Element und keine Maximalbreite,
       sondern eine seitliche Polsterung, die den zentrierten Behaelter
       NACHRECHNET: ist der Sichtbereich schmaler als das Mass, bleibt es bei
       der blossen Polsterung, sonst kommt der halbe Ueberhang dazu. "100%" ist
       hier die Breite der Huelle, also exakt — "100vw" waere um die Breite des
       Rollbalkens zu gross. */
    .nav {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--space-6);
      padding-block: var(--space-4);
      padding-inline: max(
        var(--landing-gutter, var(--space-12)),
        calc(
          (100% - var(--landing-measure, var(--container-max))) / 2 +
            var(--landing-gutter, var(--space-12))
        )
      );
      border-bottom: var(--border-width-thin) solid var(--_rule);
    }

    .wordmark {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      letter-spacing: var(--tracking-widest);
      text-transform: uppercase;
      color: var(--color-text-primary);
      background: none;
      border: 0;
      padding: 0;
      cursor: pointer;
    }

    .wordmark span {
      color: var(--color-accent-amber);
    }

    .nav__links {
      display: flex;
      gap: var(--space-9);
    }

    .nav__end {
      display: flex;
      align-items: center;
      gap: var(--space-6);
    }

    .nav__link {
      font-family: var(--font-body);
      font-size: var(--text-xs);
      letter-spacing: var(--tracking-wider);
      text-transform: uppercase;
      color: var(--color-text-muted);
      background: none;
      border: 0;
      padding: var(--space-1) 0;
      cursor: pointer;
      transition: color var(--transition-normal);
    }

    .nav__link:hover,
    .nav__link:focus-visible {
      color: var(--color-accent-amber);
    }

    /* ── Bernsteinknopf, in drei Groessen ──────────────────────────── */

    .cta {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2-5);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-wider);
      text-transform: uppercase;
      color: var(--color-text-inverse);
      background: var(--color-accent-amber);
      border: var(--border-width-thin) solid var(--color-accent-amber-dim);
      box-shadow: var(--shadow-sm);
      cursor: pointer;
      transition: transform var(--transition-normal), box-shadow var(--transition-normal),
        background var(--transition-normal);
    }

    .cta:hover,
    .cta:focus-visible {
      background: var(--color-accent-amber-hover);
      transform: translate(-1px, -1px);
      box-shadow: var(--shadow-md);
    }

    .cta--sm {
      padding: var(--space-2-5) var(--space-6);
      font-size: var(--text-xs);
    }

    .cta--lg {
      padding: var(--space-4) var(--space-10);
      font-size: var(--text-sm);
      letter-spacing: var(--tracking-widest);
      box-shadow: var(--shadow-md);
    }

    .cta--lg:hover,
    .cta--lg:focus-visible {
      box-shadow: var(--shadow-xl);
    }

    /* ── Held ──────────────────────────────────────────────────────── */

    .hero {
      position: relative;
      overflow: hidden;
    }

    .hero__img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center 62%;
      /* Auf dem Bild, nicht auf dem Abschnitt. */
      filter: brightness(0.72) saturate(0.95);
      animation: ken-burns 34s ease-in-out infinite alternate;
    }

    @keyframes ken-burns {
      from {
        transform: scale(1);
      }
      to {
        transform: scale(1.08);
      }
    }

    .hero__veil,
    .hero__veil-v,
    .hero__scan {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }

    .hero__veil {
      background: linear-gradient(
        96deg,
        var(--_veil-strong) 24%,
        var(--_veil-mid) 55%,
        var(--_veil-soft) 100%
      );
    }

    .hero__veil-v {
      background: linear-gradient(
        180deg,
        var(--_veil-top),
        transparent 32%,
        transparent 58%,
        var(--_veil-bottom)
      );
    }

    .hero__scan {
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 3px,
        color-mix(in srgb, var(--color-surface) 13%, transparent) 3px,
        color-mix(in srgb, var(--color-surface) 13%, transparent) 6px
      );
    }

    .hero__body {
      /* Die Polsterung gehoert INNERHALB des Masses: ohne border-box zaehlt
         "max-width" nur den Inhalt, der Kasten waere 1920 + 2 x 64 = 2048 px
         breit und der sichtbare Rand bei 2560 px 320 statt 384. Gemessen im
         Browser, nicht geschlossen — tsc und alle 23 Tore waren gruen. */
      box-sizing: border-box;
      position: relative;
      padding: clamp(var(--space-16), 12vw, 130px) var(--landing-gutter, var(--space-12))
        var(--space-20);
      max-width: var(--landing-measure, var(--container-max));
      margin: 0 auto;
    }

    .kicker {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      letter-spacing: var(--tracking-widest);
      text-transform: uppercase;
      color: var(--color-accent-amber);
      margin: 0 0 var(--space-9);
      animation: rise var(--duration-slower) var(--ease-dramatic) both;
    }

    .kicker__dot {
      width: 7px;
      height: 7px;
      border-radius: var(--border-radius-full);
      background: var(--color-accent-green);
      box-shadow: 0 0 9px var(--color-accent-green);
      animation: pulse-dot 2.2s ease-in-out infinite;
      flex: none;
    }

    @keyframes pulse-dot {
      0%,
      100% {
        opacity: 1;
      }
      50% {
        opacity: 0.35;
      }
    }

    @keyframes rise {
      from {
        opacity: 0;
        transform: translateY(26px);
      }
      to {
        opacity: 1;
        transform: none;
      }
    }

    /* Der Entwurf setzt 158 px bei 1440 px Referenzbreite. "clamp()" traegt
       das nach unten, ohne dass die zwei Zeilen umbrechen. Ab 1920 px uebernimmt
       eine ZWEITE Spanne (weiter unten): 158 → 212 px. Zwei Spannen, weil eine
       einzelne nur EINE Steigung haben kann — hier sind es drei Abschnitte
       (11vw bis 1436 px, dann flach, dann 8,3vw bis 2554 px). */
    .headline {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: clamp(3rem, 11vw, 158px);
      line-height: 0.94;
      letter-spacing: var(--tracking-wide);
      text-transform: uppercase;
      margin: 0;
      color: var(--color-text-primary);
      text-shadow: 0 6px 50px color-mix(in srgb, var(--color-surface) 70%, transparent);
    }

    .headline span {
      display: block;
      animation: rise var(--duration-slower) var(--ease-dramatic) both;
    }

    .headline span:first-child {
      animation-delay: 80ms;
    }

    .headline span:last-child {
      animation-delay: 220ms;
    }

    .headline em {
      font-style: normal;
      color: var(--color-accent-amber);
    }

    .hero__bottom {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: var(--space-16);
      margin-top: var(--space-12);
      animation: rise var(--duration-slower) var(--ease-dramatic) 400ms both;
    }

    .subline {
      font-family: var(--font-prose);
      font-style: italic;
      font-weight: var(--font-medium);
      font-size: calc(clamp(var(--text-base), 2vw, 27px) * var(--landing-type-scale, 1));
      line-height: var(--leading-normal);
      color: var(--color-text-secondary);
      margin: 0;
      /* Die Breite waechst mit der Schrift, sonst wuerde die Zeile bei 2560 px
         laenger statt gleich lang. Gemessen bleibt sie so bei rund 60 Zeichen. */
      max-width: calc(600px * var(--landing-type-scale, 1));
      text-wrap: pretty;
    }

    .hero__actions {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: var(--space-3-5);
      flex: 0 0 auto;
    }

    .watch {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      letter-spacing: var(--tracking-wider);
      text-transform: uppercase;
      color: var(--color-text-muted);
      background: none;
      border: 0;
      padding: var(--space-1) 0;
      cursor: pointer;
      transition: color var(--transition-normal);
    }

    .watch:hover,
    .watch:focus-visible {
      color: var(--color-accent-amber);
    }

    .watch__arrow {
      display: inline-block;
      transition: transform var(--transition-normal);
    }

    .watch:hover .watch__arrow {
      transform: translateX(4px);
    }

    /* ── Laufband ──────────────────────────────────────────────────── */

    .ticker {
      position: relative;
      border-top: var(--border-width-thin) solid var(--_rule);
      background: color-mix(in srgb, var(--_sunken) 94%, transparent);
      overflow: hidden;
      padding: var(--space-3) 0;
    }

    .ticker__track {
      display: flex;
      gap: var(--space-14);
      width: max-content;
      animation: marquee 30s linear infinite;
      font-family: var(--font-body);
      font-size: var(--text-xs);
      letter-spacing: var(--tracking-widest);
      text-transform: uppercase;
      color: var(--color-text-muted);
      white-space: nowrap;
      padding-left: var(--space-14);
    }

    @keyframes marquee {
      from {
        transform: translateX(0);
      }
      to {
        transform: translateX(-50%);
      }
    }

    .ticker b {
      color: var(--color-accent-green);
      font-weight: var(--font-bold);
    }

    .ticker__sep {
      color: var(--color-accent-amber);
    }

    :host(:focus-within) .ticker__track,
    .ticker:hover .ticker__track {
      animation-play-state: paused;
    }

    /* ── BREITBILD (Entwurf v2, ≥1920) ──────────────────────────────────
       Die Seite waechst fluessig nach oben; 1440 px ist die kleinste
       Schreibtischfassung, keine Obergrenze. Bild, Laufband und die beiden
       Schleier bleiben randlos — sie haengen an ":host" und wurden nie
       eingefasst, hier ist also nichts zu tun. */
    @media (min-width: 1920px) {
      .headline {
        font-size: clamp(158px, 8.3vw, 212px);
      }
    }

    @media (max-width: 900px) {
      .nav {
        padding: var(--space-3) var(--space-5);
        flex-wrap: wrap;
        gap: var(--space-3);
      }

      .nav__links {
        order: 3;
        width: 100%;
        gap: var(--space-5);
        justify-content: flex-start;
      }

      .hero__body {
        padding: var(--space-12) var(--space-5) var(--space-10);
      }

      .hero__bottom {
        flex-direction: column;
        align-items: flex-start;
        gap: var(--space-7);
        margin-top: var(--space-8);
      }

      .hero__actions {
        align-items: flex-start;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .hero__img {
        animation: none;
      }

      .kicker__dot {
        animation: none;
      }

      .kicker,
      .headline span,
      .hero__bottom {
        animation: none;
        opacity: 1;
        transform: none;
      }

      /* Das Laufband steht still und zeigt seinen Inhalt als ruhige Zeile.
         "overflow-x: auto" haelt es erreichbar, statt es abzuschneiden. */
      .ticker__track {
        animation: none;
        width: auto;
      }

      .ticker {
        overflow-x: auto;
      }
    }
  `;

  /**
   * Oeffnet die Anmeldung.
   *
   * Die Plattform-Kopfleiste wird auf der Frontseite fuer Gaeste ausgeblendet
   * (app-shell), weil sonst zwei Navigationsleisten uebereinander stuenden.
   * Damit dabei kein Zugang verlorengeht, traegt diese Navigation den
   * Anmeldeknopf — ueber dasselbe Ereignis, das die Kopfleiste benutzt.
   */
  private _openLogin = (): void => {
    this.dispatchEvent(new CustomEvent('login-panel-open', { bubbles: true, composed: true }));
  };

  @property({ type: Object, attribute: false }) counts: LandingCounts | null = null;
  @property({ type: Array, attribute: false }) worlds: LandingWorld[] = [];

  /**
   * Die Kennzahlen des Laufbands, Nullen ausgelassen.
   *
   * Die Auswahl folgt der Entscheidung vom 31.08.2026 und ist bewusst auf
   * Groessen beschraenkt, die ueber LEBENDE Welten gezaehlt sind - eine Zahl
   * ueber den Gesamtbestand neben der 16 waere auch dann irrefuehrend, wenn
   * sie fuer sich stimmt.
   */
  private _tickerItems(): Array<{ value: number; label: string }> {
    const c = this.counts;
    if (!c) return [];
    const candidates = [
      { value: c.worlds_live, label: msg('living worlds') },
      { value: c.worlds_transmitting, label: msg('transmitting') },
      { value: c.citizens, label: msg('citizens') },
      { value: c.memories, label: msg('memories held') },
      { value: c.buildings, label: msg('buildings') },
      { value: c.zones, label: msg('zones mapped') },
    ];
    return candidates.filter((item) => item.value > 0);
  }

  private _renderTickerRun() {
    const items = this._tickerItems();
    const names = this.worlds.map((world) => t(world, 'name')).filter(Boolean);
    return html`
      ${items.map(
        (item) => html`
          <span><b>${item.value}</b> ${item.label}</span>
          <span class="ticker__sep" aria-hidden="true">&#10022;</span>
        `,
      )}
      ${names.map(
        (name) => html`
          <span>${name}</span>
          <span class="ticker__sep" aria-hidden="true">&#10022;</span>
        `,
      )}
    `;
  }

  protected render() {
    const online = this.counts?.worlds_transmitting ?? 0;

    return html`
      <div class="nav">
        <button class="wordmark" @click=${() => navigate('/')}>
          Metaverse<span>.Center</span>
        </button>
        <nav class="nav__links" aria-label=${msg('Primary')}>
          <button class="nav__link" @click=${() => navigate('/worlds')}>
            ${msg('Worlds')}
          </button>
          <button class="nav__link" @click=${() => navigate('/how-to-play')}>
            ${msg('Systems')}
          </button>
          <button class="nav__link" @click=${() => navigate('/chronicles')}>
            ${msg('Chronicle')}
          </button>
        </nav>
        <div class="nav__end">
          <button class="nav__link" @click=${this._openLogin}>${msg('Sign in')}</button>
          <button class="cta cta--sm" @click=${() => navigate('/forge')}>
            ${msg('Forge a World')}
          </button>
        </div>
      </div>

      <div class="hero">
        <picture>
          <source
            type="image/avif"
            srcset=${landingSrcset(LANDING_HERO_STEM, 'hero', 'avif')}
            sizes=${LANDING_IMAGE_SIZES.hero}
          />
          <source
            type="image/webp"
            srcset=${landingSrcset(LANDING_HERO_STEM, 'hero', 'webp')}
            sizes=${LANDING_IMAGE_SIZES.hero}
          />
          <img
            class="hero__img"
            src=${landingFallbackUrl(LANDING_HERO_STEM, 'hero')}
            alt=""
            fetchpriority="high"
            decoding="async"
          />
        </picture>
        <div class="hero__veil"></div>
        <div class="hero__veil-v"></div>
        <div class="hero__scan"></div>

        <div class="hero__body">
          <p class="kicker">
            <span class="kicker__dot" aria-hidden="true"></span>
            ${
              online > 0
                ? msg(str`Signal locked // ${online} worlds transmitting`)
                : msg('Signal locked')
            }
          </p>

          <h1 class="headline">
            <span>${msg('Living')}</span>
            <span>${msg('Worlds')}<em>.</em></span>
          </h1>

          <div class="hero__bottom">
            <p class="subline">
              ${msg(
                'Forged from a single sentence. Playing while you sleep. Populated by citizens who remember what you did.',
              )}
            </p>
            <div class="hero__actions">
              <button class="cta cta--lg" @click=${() => navigate('/forge')}>
                ${msg('Build your world')} <span aria-hidden="true">&rarr;</span>
              </button>
              <button class="watch" @click=${() => navigate('/worlds')}>
                ${msg('Or just watch one')}
                <span class="watch__arrow" aria-hidden="true">&rarr;</span>
              </button>
            </div>
          </div>
        </div>

        <div class="ticker">
          <div class="ticker__track">
            ${this._renderTickerRun()}${this._renderTickerRun()}
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-landing-hero': VelgLandingHero;
  }
}
