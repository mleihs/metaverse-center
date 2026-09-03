/**
 * "Sie erinnern sich" - drei echte Buerger als aufgefaecherte Dossierkarten.
 *
 * DIE KARTE IST NICHT NEU GEBAUT
 * Der Handoff beschreibt die TCG-Karte in vollem Umfang neu (Edelstein links,
 * Edelstein rechts, Pip-Reihe, Namensschild, Seltenheitsfuss). Die Karte gibt
 * es bereits als `<velg-game-card>`, gebaut nach `docs/explanations/
 * tcg-card-system.md`, mit Neigung bei Mausbewegung und Glanzlicht. Sie hier
 * nachzubauen hiesse, dieselbe Spezifikation ein zweites Mal zu pflegen - und
 * die zweite Fassung waere in einem halben Jahr die falsche.
 *
 * DIE FAECHERUNG SITZT AUF EINEM HUELLELEMENT
 * Die Drehung von -7/0/+7 Grad liegt auf einer Huelle um die Karte, nicht auf
 * der Karte selbst: `<velg-game-card>` benutzt `transform` fuer seine eigene
 * Neigung, und zwei Quellen fuer dieselbe Eigenschaft ergeben genau einen
 * Gewinner. Die Huelle dreht, die Karte neigt.
 *
 * DER FAECHER BLAETTERT
 * Der Endpunkt liefert ein DECK (12 Buerger), nicht drei. Jeder der drei
 * Plaetze blaettert unabhaengig durch seinen eigenen Viertel-Ausschnitt, damit
 * nicht alle drei gleichzeitig umschlagen - das saehe aus wie ein Neuladen,
 * nicht wie ein Blaettern.
 *
 * Vier Bedingungen, alle aus der Sache heraus und nicht aus Vorsicht:
 *   - prefers-reduced-motion: gar kein Wechsel. Nicht bloss ohne Ueberblendung
 *     - ein Bild, das ohne Zutun wechselt, IST die Bewegung, und wer sie
 *     abbestellt hat, hat auch den Wechsel abbestellt.
 *   - ausserhalb des Bildausschnitts: angehalten. Ein Faecher, der unten auf
 *     der Seite vor sich hin blaettert, kostet Rechenzeit fuer niemanden.
 *   - Zeiger oder Tastaturfokus im Faecher: angehalten. Wer eine Karte liest,
 *     soll sie nicht unter den Augen verlieren.
 *   - beim Abhaengen: Zeitgeber weg. Sonst laeuft der Wechsel auf einer Seite
 *     weiter, die es nicht mehr gibt.
 *
 * WAS DIE KARTE ZEIGT, IST GEMESSEN
 * Der Endpunkt liefert nur Buerger MIT Portraet, Beruf und Kennung. Gemessen
 * ueber die 108 Agenten lebender Welten: 108 haben ein Portraet, aber nur 66
 * einen Beruf - ohne diese Bedingung waere die Zeile "Beruf · Zone" bei den
 * ersten drei leer geblieben.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { LandingCitizen } from '../../types/index.js';
import { t } from '../../utils/locale-fields.js';
import { navigate } from '../../utils/navigation.js';
import '../shared/VelgGameCard.js';
import { citizenTeaser } from '../../utils/citizen-teaser.js';
import { professionLabel } from '../../utils/profession.js';
import { stageStyles } from '../shared/stage-styles.js';

/** Die Faecherung des Entwurfs: drei Karten, leicht ueberlappend. */
const FAN_ANGLES = [-7, 0, 7];

/**
 * Welche Karte die Folie traegt.
 *
 * `<velg-game-card>` rendert die holografische Schicht (`.card__holo`)
 * AUSSCHLIESSLICH bei `rarity="legendary"` — und am 03.09.2026 gemessen setzt
 * kein einziger Aufrufer der App `rarity`. Die Folie war damit nirgends je zu
 * sehen, obwohl das Kartenmodul sie seit dem TCG-Entwurf mitbringt und der
 * Vorgabe-Rahmen sie auf "holographic" stellt.
 *
 * Sie sitzt hier auf der VORDEREN Karte, nicht auf allen dreien. Das ist eine
 * Aussage ueber die Auslage, nicht ueber den Buerger: ein Schaufenster hat
 * einen Blickpunkt, und drei glaenzende Karten nebeneinander sind keiner.
 * Rang im Sinne des Spiels bedeutet das nicht — den fuehrt bislang nichts.
 */
const FAN_RARITIES = ['common', 'legendary', 'common'] as const;

/**
 * Welche Karte ihre Zeile zeigt.
 *
 * Am 03.09.2026 auf Prod gemessen: die Faecherspalte ist 560 px breit, eine
 * Karte 200 px. Drei nebeneinander brauchten 600. Die Karten ueberlappen
 * darum um je 67 px — ein Drittel — und das ist kein Versehen, sondern was
 * ein Faecher IST.
 *
 * Ein Name und eine Zone ueberleben diesen Beschnitt; ein Satz nicht. Auf den
 * hinteren Karten brach er mitten im Wort ab und sah aus wie ein Fehler.
 * Die Zeile steht deshalb dort, wo sie ganz zu lesen ist: vorn, bei der
 * Karte, die auch die Folie traegt. Ein Schaufenster hat einen Blickpunkt.
 */
const FAN_TEASERS = [false, true, false] as const;

/**
 * Wie lange eine Karte steht, bevor der Platz weiterblaettert.
 *
 * Neun Sekunden, weil die Karte gelesen werden soll: Name, Beruf und Zone sind
 * drei Angaben, und ein Faecher, der schneller umschlaegt als man sie aufnimmt,
 * ist Unruhe und keine Auffrischung.
 */
const HOLD_MS = 9000;

/** Versatz zwischen den Plaetzen, damit sie nicht gemeinsam umschlagen. */
const STAGGER_MS = 3000;

/** Muss zur Dauer von .fan__slot--swapping im CSS passen. */
const FADE_MS = 420;

@localized()
@customElement('velg-landing-citizens')
export class VelgLandingCitizens extends LitElement {
  static styles = [
    stageStyles,
    css`
    /* Ein Abschnitt ohne Inhalt darf keinen Platz nehmen: mit den beiden
       --space-24 stand hier sonst ein 192 Pixel hohes Nichts. Lokal gibt es
       keine Agenten mit Portraet, und genau dort ist es aufgefallen. */
    :host([hidden]) {
      display: none;
    }

    :host {
      display: block;
      /* Nur senkrecht — die seitliche Polsterung gehoert INNERHALB des
         Seitenmasses und sitzt deshalb am Behaelter, nicht an der Huelle. */
      padding-block: var(--space-24);
      background: var(--color-surface);
    }

    .layout {
      /* Die Polsterung gehoert INNERHALB des Masses: ohne border-box zaehlt
         "max-width" nur den Inhalt, der Kasten waere 1920 + 2 x 64 = 2048 px
         breit und der sichtbare Rand bei 2560 px 320 statt 384. Gemessen im
         Browser, nicht geschlossen — tsc und alle 23 Tore waren gruen. */
      display: grid;
      grid-template-columns: 380px 1fr;
      gap: var(--space-16);
      align-items: center;
    }

    .kicker {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      letter-spacing: var(--tracking-widest);
      text-transform: var(--label-transform);
      color: var(--color-accent-amber);
      margin-bottom: var(--space-4);
    }

    .kicker::before {
      content: '';
      width: 24px;
      height: 1px;
      background: var(--color-accent-amber);
    }

    .title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: calc(clamp(var(--text-xl), 3.4vw, 40px) * var(--stage-type-scale, 1));
      letter-spacing: var(--tracking-brutalist);
      text-transform: var(--heading-transform);
      line-height: var(--leading-tight);
      color: var(--color-text-primary);
      margin: 0 0 var(--space-4);
    }

    .title em {
      font-style: normal;
      color: var(--color-accent-amber);
    }

    .lede {
      font-family: var(--font-prose);
      font-size: var(--text-base);
      line-height: var(--leading-relaxed);
      color: var(--color-text-secondary);
      margin: 0 0 var(--space-6);
    }

    .more {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      letter-spacing: var(--tracking-widest);
      text-transform: var(--label-transform);
      color: var(--color-text-quiet);
      background: none;
      border: 0;
      padding: var(--space-1) 0;
      cursor: pointer;
      transition: color var(--transition-normal);
    }

    .more:hover,
    .more:focus-visible {
      color: var(--color-accent-amber);
    }

    .more__arrow {
      display: inline-block;
      transition: transform var(--transition-normal);
    }

    .more:hover .more__arrow {
      transform: translateX(4px);
    }

    .fan {
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: var(--space-6) 0 var(--space-3);
      min-width: 0;
    }

    /* Die Drehung liegt hier, nicht auf der Karte: "velg-game-card" benutzt
       "transform" fuer seine eigene Neigung. */
    .fan__slot {
      transition:
        transform var(--duration-slow) var(--ease-out),
        opacity 420ms var(--ease-out);
    }

    /*
     * Der Platz, der gerade weiterblaettert. Die Dauer muss zu FADE_MS im
     * Bauteil passen — deshalb steht sie hier als Zahl und nicht als Token:
     * ein Token, das jemand spaeter aendert, wuerde die Karte tauschen, bevor
     * sie verschwunden ist, und niemand saehe, warum.
     */
    .fan__slot--swapping {
      opacity: 0;
    }

    .fan__slot:not(:first-child) {
      margin-left: calc(var(--space-12) * -1);
    }

    .fan__slot:hover,
    .fan__slot:focus-within {
      z-index: var(--z-raised);
    }

    @media (max-width: 1024px) {
      :host {
        padding: var(--space-16) var(--space-5);
      }

      .layout {
        grid-template-columns: 1fr;
        gap: var(--space-10);
      }

      .fan {
        flex-wrap: wrap;
        gap: var(--space-4);
      }

      .fan__slot,
      .fan__slot--swapping {
        opacity: 1;
      }

      .fan__slot {
        transform: none !important;
      }

      .fan__slot:not(:first-child) {
        margin-left: 0;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .fan__slot,
      .more__arrow {
        transition: none;
      }
    }
  `,
  ];

  @property({ type: Array, attribute: false }) citizens: LandingCitizen[] = [];

  /**
   * Die Welt des Satzes, der im Schmiede-Abschnitt darunter gerade anlaeuft.
   *
   * Ist sie gesetzt und hat sie Buerger im Deck, zeigt der Faecher DIESE — der
   * Satz und die Gesichter darueber gehoeren dann zusammen, was sie bis
   * Migration 328 nie taten. Ist sie null (Beispielsatz, oder eine Welt, deren
   * Herkunft sich nicht rekonstruieren liess), blaettert der Faecher wie
   * bisher weiter, statt stehenzubleiben.
   */
  @property({ type: String, attribute: false }) highlightSimulationId: string | null = null;

  /** Welche Karte jeder der drei Plaetze gerade zeigt (Index ins Deck). */
  @state() private _shown: number[] = FAN_ANGLES.map((_, i) => i);

  /** Der Platz, der gerade ausblendet - waehrend der Ueberblendung gesetzt. */
  @state() private _swapping: number | null = null;

  private _timers: number[] = [];
  private _observer: IntersectionObserver | null = null;
  private _inView = false;
  private _held = false;

  /**
   * Der Ausschnitt des Decks, durch den EIN Platz blaettert.
   *
   * Platz 0 bekommt 0,3,6,9 - nicht 0,1,2,3. Bei fortlaufenden Bloecken
   * zeigte der Faecher anfangs die Buerger 0,4,8, also nie die Nachbarn im
   * Deck; mit dem Schrittmuster steht am Anfang 0,1,2 da, und das ist die
   * Auswahl, die der Server als erste drei gezogen hat.
   */
  private _deckFor(slot: number): number[] {
    const out: number[] = [];
    for (let i = slot; i < this.citizens.length; i += FAN_ANGLES.length) out.push(i);
    return out.length ? out : [slot];
  }

  private get _canRotate(): boolean {
    return (
      this.citizens.length > FAN_ANGLES.length &&
      !matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  connectedCallback(): void {
    super.connectedCallback();
    // Ein Faecher unterhalb des Bildausschnitts blaettert fuer niemanden.
    this._observer = new IntersectionObserver((entries) => {
      this._inView = entries.some((e) => e.isIntersecting);
      this._sync();
    });
    this._observer.observe(this);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._observer?.disconnect();
    this._observer = null;
    this._stop();
  }

  protected willUpdate(changed: Map<string, unknown>): void {
    this.hidden = this.citizens.length === 0;
    if (changed.has('highlightSimulationId')) this._followWorld();
  }

  /**
   * Den Faecher auf die Welt des laufenden Satzes stellen.
   *
   * Nur wenn die Welt genug Buerger im Deck hat, um den Faecher ZU FUELLEN.
   * Ein Fächer, der bei einer Welt mit einem Buerger zwei Plaetze leert, waere
   * schlechter als einer, der nicht folgt: die Verbindung soll etwas
   * hinzufuegen und nichts wegnehmen.
   */
  private _followWorld(): void {
    const id = this.highlightSimulationId;
    if (!id) return;
    const treffer: number[] = [];
    this.citizens.forEach((c, i) => {
      if (c.simulation_id === id) treffer.push(i);
    });
    if (treffer.length < FAN_ANGLES.length) return;
    const neu = FAN_ANGLES.map((_, slot) => treffer[slot]);
    if (neu.every((v, i) => v === this._shown[i])) return;
    this._shown = neu;
  }

  protected updated(): void {
    this._sync();
  }

  /** Laeuft der Wechsel gerade, und soll er? Eine Stelle entscheidet das. */
  private _sync(): void {
    const soll = this._canRotate && this._inView && !this._held && !this.hidden;
    if (soll && this._timers.length === 0) this._start();
    else if (!soll && this._timers.length > 0) this._stop();
  }

  private _start(): void {
    this._timers = FAN_ANGLES.map((_, slot) =>
      window.setTimeout(
        () => {
          const tick = window.setInterval(() => this._advance(slot), HOLD_MS);
          this._timers.push(tick);
          this._advance(slot);
        },
        STAGGER_MS * (slot + 1),
      ),
    );
  }

  private _stop(): void {
    for (const t of this._timers) {
      clearTimeout(t);
      clearInterval(t);
    }
    this._timers = [];
    this._swapping = null;
  }

  /**
   * Ein Platz blaettert weiter: ausblenden, tauschen, einblenden.
   *
   * Zwei Karten uebereinander waeren eine echte Ueberblendung, kosteten aber
   * die doppelte Zahl an <velg-game-card> samt ihrer Neigungs-Zuhoerer. Eine
   * Dossierkarte, die kurz verschwindet und als andere zurueckkommt, ist
   * ausserdem die ehrlichere Bewegung fuer das, was hier passiert: es wird
   * eine Karte AUSGETAUSCHT, nicht eine in die andere ueberblendet.
   */
  private _advance(slot: number): void {
    const deck = this._deckFor(slot);
    if (deck.length < 2) return;
    this._swapping = slot;
    window.setTimeout(() => {
      const pos = deck.indexOf(this._shown[slot]);
      const next = deck[(pos + 1) % deck.length];
      this._shown = this._shown.map((v, i) => (i === slot ? next : v));
      this._swapping = null;
    }, FADE_MS);
  }

  private _hold = (): void => {
    this._held = true;
    this._sync();
  };

  private _release = (): void => {
    this._held = false;
    this._sync();
  };

  protected render() {
    if (!this.citizens.length) return null;

    return html`
      <div class="layout stage-container">
        <div>
          <div class="kicker">${msg('The citizens')}</div>
          <h2 class="title">${msg('They remember')}<em>.</em></h2>
          <p class="lede">
            ${msg(
              'Every world is populated by AI characters who carry a memory, an opinion, and an intent of their own. They keep accounts, form attachments, fall out over nothing, and print the whole affair in the morning broadsheet.',
            )}
          </p>
          <button class="more" @click=${() => navigate('/worlds')}>
            ${msg('Meet more characters')}
            <span class="more__arrow" aria-hidden="true">&rarr;</span>
          </button>
        </div>

        <div
          class="fan"
          @pointerenter=${this._hold}
          @pointerleave=${this._release}
          @focusin=${this._hold}
          @focusout=${this._release}
        >
          ${FAN_ANGLES.map((angle, index) => {
            const citizen = this.citizens[this._shown[index] ?? index];
            if (!citizen) return nothing;
            return html`
              <div
                class="fan__slot ${this._swapping === index ? 'fan__slot--swapping' : ''}"
                style="transform: rotate(${angle}deg); z-index: ${index === 1 ? 2 : 1}"
              >
                <velg-game-card
                  type="agent"
                  size="md"
                  rarity=${FAN_RARITIES[index]}
                  .name=${citizen.name}
                  image-url=${citizen.portrait_image_url ?? ''}
                  .subtitle=${[professionLabel(t(citizen, 'profession')), citizen.zone_name]
                    .filter(Boolean)
                    .join(' · ')}
                  .description=${FAN_TEASERS[index] ? citizenTeaser(t(citizen, 'character'), citizen.name) : ''}
                  @click=${() =>
                    navigate(`/simulations/${citizen.simulation_slug}/agents/${citizen.slug}`)}
                ></velg-game-card>
              </div>
            `;
          })}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-landing-citizens': VelgLandingCitizens;
  }
}
