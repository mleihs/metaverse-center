/**
 * Die SEO-Fussleiste - echte `<a href>`, keine erfundenen Ziele.
 *
 * DER ENTWURF ZEIGTE HIER ZWEI WELTEN, DIE ES NICHT GIBT
 * "Saltmeridian" und "The Gilded Hollow" standen als kriechbare Verweise in
 * genau der Spalte, deren ganzer Zweck kriechbare Verweise sind. Die
 * Weltenspalte kommt deshalb aus dem Schnappschuss und kann nicht veralten.
 *
 * NICHTS AUS DER BESTEHENDEN FUSSLEISTE GEHT VERLOREN
 * `<velg-platform-footer>` trug fuenfzehn gepruefte Verweise: neun unter
 * "Discover" (die Marketing- und Perspektivenseiten, die fuer die Auffindbarkeit
 * gebaut wurden) und sechs unter "Legal" samt Instagram und GitHub. Diese
 * Leiste ERSETZT sie auf der Frontseite - also traegt sie alle fuenfzehn
 * weiter. Eine neue Gestaltung, die neun kriechbare Verweise abraeumt, waere
 * ein Rueckschritt, den man erst Monate spaeter an der Auffindbarkeit merkt.
 * Deshalb fuenf Spalten statt der vier des Entwurfs.
 *
 * ECHTE ANKER, NICHT NUR KNOEPFE
 * Ueberall sonst auf dieser Seite steht ein `<button>` mit `navigate()`. Hier
 * nicht: ein Suchmaschinen-Kriecher folgt keinem Klickhandler. Die Verweise
 * sind `<a href>` und fangen den Klick zusaetzlich ab, damit die Anwendung
 * nicht neu laedt - beides zusammen, nicht eines davon.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { localeService } from '../../services/i18n/locale-service.js';
import { captureError } from '../../services/SentryService.js';
import type { LandingWorld } from '../../types/index.js';
import { t } from '../../utils/locale-fields.js';
import { navigate } from '../../utils/navigation.js';
import { stageStyles } from '../shared/stage-styles.js';

@localized()
@customElement('velg-landing-seo-footer')
export class VelgLandingSeoFooter extends LitElement {
  static styles = [
    stageStyles,
    css`
    :host {
      --_rule: var(--color-border-light);
      display: block;
      background: var(--color-surface-sunken);
    }

    .columns {
      /* Die Polsterung gehoert INNERHALB des Masses: ohne border-box zaehlt
         "max-width" nur den Inhalt, der Kasten waere 1920 + 2 x 64 = 2048 px
         breit und der sichtbare Rand bei 2560 px 320 statt 384. Gemessen im
         Browser, nicht geschlossen — tsc und alle 23 Tore waren gruen. */
      border-top: var(--border-width-thin) solid var(--_rule);
      padding-block: var(--space-16) var(--space-14);
      display: grid;
      grid-template-columns: 1.3fr 1fr 1fr 1fr 1fr;
      gap: var(--space-12);
    }

    .brand__mark {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      letter-spacing: var(--tracking-widest);
      text-transform: uppercase;
      color: var(--color-text-primary);
      margin-bottom: var(--space-3-5);
    }

    .brand__mark em {
      font-style: normal;
      color: var(--color-accent-amber);
    }

    .brand__blurb {
      font-family: var(--font-prose);
      font-size: var(--text-sm);
      line-height: var(--leading-relaxed);
      color: var(--color-text-muted);
      margin: 0 0 var(--space-5);
      max-width: 300px;
    }

    .locale {
      display: flex;
      gap: var(--space-2-5);
      align-items: center;
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      letter-spacing: var(--tracking-wider);
      text-transform: uppercase;
    }

    .locale button {
      background: none;
      border: 0;
      padding: 0;
      cursor: pointer;
      font: inherit;
      letter-spacing: inherit;
      color: var(--color-text-muted);
      transition: color var(--transition-normal);
    }

    .locale button[aria-current='true'] {
      color: var(--color-accent-amber);
    }

    .locale button:hover,
    .locale button:focus-visible {
      color: var(--color-accent-amber);
    }

    .locale__sep {
      color: var(--color-border);
    }

    .col {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      min-width: 0;
    }

    .col__head {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      letter-spacing: var(--tracking-widest);
      text-transform: uppercase;
      color: var(--color-accent-amber);
      margin-bottom: var(--space-1);
    }

    .col a {
      font-family: var(--font-body);
      font-size: var(--text-sm);
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-secondary);
      text-decoration: none;
      transition: color var(--transition-normal);
    }

    .col a:hover,
    .col a:focus-visible {
      color: var(--color-accent-amber);
    }

    .legal {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--space-5);
      flex-wrap: wrap;
      /* Wie die Navigation im Kopf: die Trennlinie spannt ueber den ganzen
         Sichtbereich, der Inhalt steht buendig unter den Spalten darueber.
         In der 2560er Referenz traegt auch diese Zeile die 384 px. */
      padding-block: var(--space-4);
      border-top: var(--border-width-thin) solid var(--color-border-light);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      letter-spacing: var(--tracking-wider);
      text-transform: uppercase;
      color: var(--color-text-muted);
    }

    .legal b {
      color: var(--color-accent-green);
      font-weight: var(--font-bold);
    }

    /* Die abgeschnittene Wortmarke ist reine Zierde und traegt deshalb
       "aria-hidden": eine Vorleseanwendung soll den Namen nicht ein zweites
       Mal buchstabieren. */
    .ghost {
      /* Der Ausschnitt waechst mit der Schrift: 140 px bei 1440, 248 px bei
         2560 — dieselbe Steigung, sonst schnitte der Rahmen bei 4K mitten
         durch die Buchstaben statt sie unten anzuschneiden. */
      height: clamp(140px, 9.65vw, 248px);
      overflow: hidden;
      border-top: var(--border-width-thin) solid var(--_rule);
      padding-top: var(--space-2);
    }

    .ghost span {
      display: block;
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: clamp(80px, 15vw, 225px);
      line-height: 0.86;
      letter-spacing: var(--tracking-wide);
      text-transform: uppercase;
      color: color-mix(in srgb, var(--color-text-primary) 8%, var(--color-surface-sunken));
      white-space: nowrap;
      user-select: none;
    }

    /* ── BREITBILD (Entwurf v2, ≥1920) ──────────────────────────────────
       Der Schriftzug ist die einzige randlose Ebene der Fussleiste und wird
       bei 4K zum Bild: 225 → 400 px. Er haengt an der Huelle, nicht an den
       Spalten — deshalb spannt er ueber den ganzen Sichtbereich, wie der
       Hintergrund.

       ⚠ WARUM DAS HIER STEHT UND NICHT ALS --text-display-*: der Schriftzug
       ist kein Lesetext, sondern ein angeschnittenes Zierelement. Er kommt
       genau einmal im Werk vor, seine Groesse haengt an der Hoehe seines
       Ausschnitts, und niemand sonst wuerde die Stufe je benutzen. Eine
       Merkmalsstufe fuer einen einzigen Verwender waere eine Zahl mit einem
       Namen davor, kein System. Die drei echten Buehnenstufen stehen in
       styles/tokens/_typography.css. */
    @media (min-width: 1920px) {
      .ghost span {
        font-size: clamp(225px, 15.6vw, 400px);
      }
    }

    @media (max-width: 1200px) {
      .columns {
        grid-template-columns: repeat(3, 1fr);
        gap: var(--space-8);
        padding: var(--space-12) var(--space-5) var(--space-10);
      }
    }

    @media (max-width: 700px) {
      .columns {
        grid-template-columns: repeat(2, 1fr);
      }

      .legal {
        padding: var(--space-4) var(--space-5);
      }
    }
  `,
  ];

  @property({ type: Array, attribute: false }) worlds: LandingWorld[] = [];

  /** Innerhalb der Anwendung navigieren, ohne den Anker zu entwerten. */
  private _go(event: Event, path: string): void {
    event.preventDefault();
    navigate(path);
  }

  private async _setLocale(locale: string): Promise<void> {
    try {
      await localeService.setLocale(locale);
    } catch (err) {
      captureError(err, { source: 'LandingSeoFooter._setLocale' });
    }
  }

  private _link(path: string, label: string) {
    return html`<a href=${path} @click=${(e: Event) => this._go(e, path)}>${label}</a>`;
  }

  protected render() {
    const locale = localeService.currentLocale;

    return html`
      <footer role="contentinfo">
        <div class="columns stage-container">
          <div>
            <div class="brand__mark">Metaverse<em>.Center</em></div>
            <p class="brand__blurb">
              ${msg(
                'The Bureau of Impossible Geography. AI-simulated living worlds, forged from a sentence, populated by citizens who remember, playing while you sleep.',
              )}
            </p>
            <div class="locale">
              <button
                aria-current=${locale !== 'en'}
                @click=${() => this._setLocale('de')}
              >DE</button>
              <span class="locale__sep" aria-hidden="true">/</span>
              <button
                aria-current=${locale === 'en'}
                @click=${() => this._setLocale('en')}
              >EN</button>
            </div>
          </div>

          <nav class="col" aria-label=${msg('Systems')}>
            <div class="col__head">${msg('Systems')}</div>
            ${this._link('/forge', msg('World Forge'))}
            ${this._link('/epoch', msg('Epochs and seasons'))}
            ${this._link('/how-to-play/guide/dungeons', msg('Resonance dungeons'))}
            ${this._link('/how-to-play/guide/drift', msg('The Drift'))}
            ${this._link('/how-to-play/guide/terminal', msg('Bureau Terminal'))}
          </nav>

          <nav class="col" aria-label=${msg('Worlds')}>
            <div class="col__head">${msg('Worlds')}</div>
            ${this.worlds
              .slice(0, 3)
              .map((world) => this._link(`/simulations/${world.slug}`, t(world, 'name')))}
            ${this._link('/worlds', msg('All living worlds'))}
            ${this._link('/chronicles', msg('Chronicle archive'))}
          </nav>

          <nav class="col" aria-label=${msg('Discover')}>
            <div class="col__head">${msg('Discover')}</div>
            ${this._link('/worldbuilding', msg('Worldbuilding'))}
            ${this._link('/ai-characters', msg('AI Characters'))}
            ${this._link('/strategy-game', msg('Strategy Game'))}
            ${this._link('/perspectives/what-is-the-metaverse', msg('What Is the Metaverse?'))}
            ${this._link('/perspectives/ai-powered-worldbuilding', msg('AI Worldbuilding'))}
            ${this._link('/perspectives/digital-sovereignty', msg('Digital Sovereignty'))}
            ${this._link('/perspectives/virtual-civilizations', msg('Virtual Civilizations'))}
            ${this._link('/perspectives/competitive-strategy', msg('Competitive Strategy'))}
          </nav>

          <nav class="col" aria-label=${msg('Bureau')}>
            <div class="col__head">${msg('Bureau')}</div>
            ${this._link('/welcome', msg('About the Bureau'))}
            ${this._link('/how-to-play', msg('Field manual'))}
            ${this._link('/privacy', msg('Privacy'))}
            ${this._link('/terms', msg('Terms of transmission'))}
            ${this._link('/data-deletion', msg('Delete data'))}
            <a
              href="https://www.instagram.com/bureau.of.impossible.geography/"
              target="_blank"
              rel="noopener noreferrer"
            >${msg('Instagram')}</a>
            <a
              href="https://github.com/mleihs/velgarien-rebuild"
              target="_blank"
              rel="noopener noreferrer"
            >${msg('GitHub')}</a>
          </nav>
        </div>

        <div class="legal stage-bleed-row">
          <span>&copy; ${new Date().getFullYear()} metaverse.center</span>
          <span>${msg('Bureau of Multiverse Observation')}</span>
          <span>${msg('Signal status:')} <b>${msg('transmitting')}</b></span>
        </div>

        <div class="ghost" aria-hidden="true">
          <span>Metaverse.Center</span>
        </div>
      </footer>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-landing-seo-footer': VelgLandingSeoFooter;
  }
}
