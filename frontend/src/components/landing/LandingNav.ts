/**
 * Die Navigationszeile der Frontseite — Marke · Nav · Aktionen.
 *
 * WARUM SIE EIN EIGENER BAUSTEIN IST
 *   Sie ist der EINE Teil, den beide Vorlagen der Frontseite gleich tragen.
 *   Die redaktionelle Fassung und die Kartenmappe unterscheiden sich in
 *   Spaltenteilung, Raster, Blattkoepfen und Schlagzeile — aber die Zeile
 *   oben ist in beiden dieselbe: dreispaltig, Wortmarke links, drei Verweise
 *   in der Mitte, Sprache und die zwei Aktionen rechts.
 *
 *   Sie lag bis zum 03.09.2026 in `LandingHero`. Ein zweiter Hero haette sie
 *   mitkopieren muessen — 20 CSS-Regeln und fuenf Schaltflaechen —, und die
 *   zwei Kopien waeren beim ersten Nachschaerfen auseinandergelaufen. Der
 *   Unterschied waere unsichtbar geblieben: beide navigieren weiter.
 *
 * ECHTE ANKER GIBT ES HIER NICHT, UND ZWAR ABSICHTLICH
 *   Anders als in der SEO-Fussleiste sind das Schaltflaechen. Die Fussleiste
 *   existiert fuer Suchmaschinen-Kriecher und braucht `<a href>`; diese Zeile
 *   ist Bedienung fuer einen Menschen, der schon da ist, und die drei Ziele
 *   stehen in der Fussleiste ohnehin als kriechbare Verweise. Wer das aendert,
 *   muss beide Stellen ansehen.
 *
 * DIE REGELN SIND UNVERAENDERT UEBERNOMMEN
 *   Wortwoertlich aus `LandingHero`, damit die redaktionelle Fassung
 *   pixelgleich bleibt. Auch `--_rule`, das sie erwartet: es wird hier auf
 *   `:host` deklariert, weil eine Custom Property aus dem Eltern-Shadow-Root
 *   ueber die Grenze vererbt wird, aber nur, wenn das Elternteil sie setzt —
 *   und der Atlas-Hero setzt sie nicht.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { localeService } from '../../services/i18n/locale-service.js';
import { captureError } from '../../services/SentryService.js';
import { navigate } from '../../utils/navigation.js';
import { stageStyles } from '../shared/stage-styles.js';
import '../shared/VelgEditionSwitch.js';

@localized()
@customElement('velg-landing-nav')
export class VelgLandingNav extends LitElement {
  static styles = [
    stageStyles,
    css`
    :host {
      display: block;
      /* Die Trennlinie, die die Regeln unten erwarten. In LandingHero stand
         sie auf dessen :host; hier gehoert sie diesem Baustein. */
      --_rule: var(--color-border-light);
    }

    .nav {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--space-6);
      padding-block: var(--space-4);
      border-bottom: var(--border-width-thin) solid var(--_rule);
    }

    .wordmark {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      letter-spacing: var(--tracking-widest);
      text-transform: var(--label-transform);
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

    .locale {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      letter-spacing: var(--tracking-wider);
    }

    .locale button {
      background: none;
      border: 0;
      padding: var(--space-1) 0;
      cursor: pointer;
      font: inherit;
      letter-spacing: inherit;
      color: var(--color-text-quiet);
      transition: color var(--transition-normal);
    }

    .locale button:focus-visible {
      color: var(--color-accent-amber);
    }

    .locale__sep {
      color: var(--color-border);
    }

    /*
     * Der Ausgaben-Umschalter bringt Polster fuer ein Menue mit (padding auf
     * seinem :host). In einer Leiste ist das zu viel; alles andere an ihm
     * bleibt, wie es ist. Dieselbe Zaehmung wie im Fuss der Frontseite — die
     * INNEREN Masse liegen in seinem Schattenbaum und gehen uns nichts an.
     * (Kein Backtick in einem css-Kommentar: er beendet das Template.)
     */
    velg-edition-switch {
      padding: 0;
    }

    /*
     * Unter 900 px bricht die Leiste um und die Verweise rutschen in eine
     * eigene Zeile. Sprache und Ausgabe bleiben oben: es sind zwei Wahlen
     * DIESES Browsers, keine Ziele — sie gehoeren zusammen und nicht zwischen
     * die Navigation.
     *
     * flex-wrap auf der rechten Gruppe, und zwar aus Vorsicht statt aus
     * Messung: die Gruppe ist mit dem Umschalter 440 px breit (gemessen bei
     * 1728 px), und auf einem Telefon steht daneben noch die Wortmarke. Ich
     * konnte das nicht am schmalen Schirm nachmessen — die Fenstergroesse liess
     * sich in dieser Sitzung nicht aendern —, also steht hier die Regel, die
     * nicht ueberlaufen KANN: was nicht passt, faellt in die naechste Zeile,
     * statt die Seite seitlich zu schieben.
     */
    @media (max-width: 900px) {
      .nav__end {
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: var(--space-3) var(--space-4);
      }
    }

    .nav__link {
      font-family: var(--font-body);
      font-size: var(--text-xs);
      letter-spacing: var(--tracking-wider);
      text-transform: var(--label-transform);
      color: var(--color-text-quiet);
      background: none;
      border: 0;
      padding: var(--space-1) 0;
      cursor: pointer;
      transition: color var(--transition-normal);
    }

    .nav__link:focus-visible {
      color: var(--color-accent-amber);
    }

    .cta {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2-5);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-wider);
      text-transform: var(--label-transform);
      color: var(--color-on-accent-amber);
      background: var(--color-accent-amber);
      border: var(--border-width-thin) solid var(--color-accent-amber-dim);
      box-shadow: var(--shadow-sm);
      cursor: pointer;
      transition: transform var(--transition-normal), box-shadow var(--transition-normal),
        background var(--transition-normal);
    }

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

    .cta--lg:focus-visible {
      box-shadow: var(--shadow-xl);
    }

    .watch {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      letter-spacing: var(--tracking-wider);
      text-transform: var(--label-transform);
      color: var(--color-text-quiet);
      background: none;
      border: 0;
      padding: var(--space-1) 0;
      cursor: pointer;
      transition: color var(--transition-normal);
    }

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
    }
  `,
  ];

  private _setLocale(locale: 'de' | 'en'): void {
    void localeService.setLocale(locale).catch((err) => {
      captureError(err, { source: 'VelgLandingNav._setLocale' });
    });
  }

  /**
   * Oeffnet die Anmeldung.
   *
   * Die Plattform-Kopfleiste wird auf der Frontseite fuer Gaeste ausgeblendet
   * (app-shell), weil sonst zwei Navigationsleisten uebereinander stuenden.
   * Damit dabei kein Zugang verlorengeht, traegt diese Navigation den
   * Anmeldeknopf — ueber dasselbe Ereignis, das die Kopfleiste benutzt.
   *
   * KEIN navigate('/login'). Das war der erste Wurf beim Herausloesen aus
   * LandingHero, und es waere eine stille Verhaltensaenderung gewesen: statt
   * die Anmeldetafel zu oeffnen, haette der Knopf die Seite verlassen. Das
   * Ereignis traegt `composed: true` und kommt deshalb auch aus diesem
   * zusaetzlichen Shadow-Root heraus.
   */
  private _openLogin = (): void => {
    this.dispatchEvent(new CustomEvent('login-panel-open', { bubbles: true, composed: true }));
  };

  protected render() {
    return html`
      <div class="nav stage-bleed-row">
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
          <div class="locale" role="group" aria-label=${msg('Language')}>
            <button
              aria-current=${localeService.currentLocale !== 'en'}
              @click=${() => this._setLocale('de')}
            >DE</button>
            <span class="locale__sep" aria-hidden="true">/</span>
            <button
              aria-current=${localeService.currentLocale === 'en'}
              @click=${() => this._setLocale('en')}
            >EN</button>
          </div>
          <velg-edition-switch context="bar" no-label></velg-edition-switch>
          <button class="nav__link" @click=${this._openLogin}>${msg('Sign in')}</button>
          <button class="cta cta--sm" @click=${() => navigate('/forge')}>
            ${msg('Forge a World')}
          </button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-landing-nav': VelgLandingNav;
  }
}
