/**
 * "Schmiede deine" - der Abschluss mit tippendem Eingabefeld und Ankerreihe.
 *
 * DAS TIPPFELD IST DER VIERTE DAUERLAEUFER
 * Zwanzig Weltbeschreibungen, ein Zeichen alle 34 ms, drei Sekunden Halten,
 * fuenf Zeichen je Schritt zurueck. Unter `prefers-reduced-motion` laeuft der
 * Zeitgeber gar nicht erst an: das Feld zeigt dann den vollen Text der ersten
 * Beschreibung, still. Ein angehaltenes Tippfeld, das eine halbe Zeile zeigt,
 * waere schlechter als keins.
 *
 * DIE HOEHE IST RESERVIERT, NICHT GEWACHSEN
 * `min-height` auf dem Textfeld haelt die hoechste der zwanzig Beschreibungen
 * frei. Ohne das springt der Knopf darunter bei jedem Wechsel um mehrere
 * Zeilen - und das ist keine Feinheit, sondern der Unterschied zwischen einer
 * Aufforderung, die man treffen kann, und einer, die wegrutscht.
 *
 * DIE ANKERREIHE IST KEINE ZIERDE
 * Der Schmiedelauf verlangt die Wahl eines philosophischen Ankers. Die Reihe
 * nimmt die sechs Anker des Entwurfs vorweg und wechselt mit jeder neuen
 * Beschreibung - so sieht ein Besucher vor dem Klick, dass diese Wahl Teil des
 * Ablaufs ist.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { LandingPrompt } from '../../types/index.js';
import { t } from '../../utils/locale-fields.js';
import { navigate } from '../../utils/navigation.js';
import { stageStyles } from '../shared/stage-styles.js';

/** Ein Zeichen je Schritt. Der Entwurf nennt 34 ms. */
const TICK_MS = 34;
/** Wie viele Schritte der volle Text stehen bleibt (110 x 34 ms rund 3,7 s). */
const HOLD_TICKS = 110;
/** Zeichen je Schritt beim Loeschen - schneller als das Tippen, wie im Entwurf. */
const DELETE_CHARS = 5;

@localized()
@customElement('velg-landing-forge')
export class VelgLandingForge extends LitElement {
  static styles = [
    stageStyles,
    css`
    :host {
      --_rule: var(--color-border-light);
      display: block;
      border-top: var(--border-width-thin) solid var(--_rule);
      background: var(--color-surface);
    }

    .layout {
      /* Die Polsterung gehoert INNERHALB des Masses: ohne border-box zaehlt
         "max-width" nur den Inhalt, der Kasten waere 1920 + 2 x 64 = 2048 px
         breit und der sichtbare Rand bei 2560 px 320 statt 384. Gemessen im
         Browser, nicht geschlossen — tsc und alle 23 Tore waren gruen. */
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: var(--space-16);
      padding-block: var(--space-24) var(--space-20);
    }

    .kicker {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      letter-spacing: var(--tracking-widest);
      text-transform: uppercase;
      color: var(--color-accent-amber);
      margin: 0 0 var(--space-6);
    }

    .title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-display-md);
      line-height: 0.96;
      letter-spacing: var(--tracking-wide);
      text-transform: uppercase;
      color: var(--color-text-primary);
      margin: 0;
    }

    .title em {
      font-style: normal;
      color: var(--color-accent-amber);
    }

    .right {
      flex: 1;
      max-width: 720px;
      min-width: 0;
    }

    .prompt {
      border: var(--border-width-thin) solid var(--color-border);
      background: var(--color-surface-sunken);
      box-shadow: var(--shadow-lg);
      padding: var(--space-6) var(--space-7);
      display: flex;
      align-items: baseline;
      gap: var(--space-4);
      margin-bottom: var(--space-7);
    }

    .prompt__caret {
      font-family: var(--font-mono);
      font-size: var(--text-md);
      color: var(--color-accent-amber);
      flex: 0 0 auto;
    }

    /* "min-height" haelt die hoechste der zwanzig Beschreibungen frei. */
    .prompt__text {
      font-family: var(--font-prose);
      font-style: italic;
      font-size: var(--text-md);
      line-height: var(--leading-normal);
      color: var(--color-text-primary);
      margin: 0;
      min-height: 158px;
    }

    .prompt__cursor {
      display: inline-block;
      width: 10px;
      height: 20px;
      background: var(--color-accent-amber);
      margin-left: var(--space-1-5);
      vertical-align: -2px;
      animation: blink 1.1s steps(1) infinite;
    }

    @keyframes blink {
      0%,
      50% {
        opacity: 1;
      }
      51%,
      100% {
        opacity: 0;
      }
    }

    .anchors {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--space-2-5);
      margin-bottom: var(--space-6);
    }

    .anchors__label {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      letter-spacing: var(--tracking-widest);
      text-transform: uppercase;
      color: var(--color-accent-amber);
      flex: 0 0 auto;
    }

    .chip {
      display: inline-flex;
      padding: var(--space-1-5) var(--space-3-5);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      letter-spacing: var(--tracking-wider);
      text-transform: uppercase;
      color: var(--color-text-muted);
      border: var(--border-width-thin) solid var(--color-border-light);
      background: transparent;
      transition: color var(--transition-slow), border-color var(--transition-slow),
        background var(--transition-slow);
    }

    .chip--on {
      color: var(--color-accent-amber);
      border-color: var(--color-accent-amber);
      background: color-mix(in srgb, var(--color-accent-amber) 8%, transparent);
      box-shadow: var(--shadow-xs);
    }

    .anchors__note {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-muted);
      width: 100%;
      margin-top: var(--space-1);
    }

    .actions {
      display: flex;
      align-items: center;
      gap: var(--space-6);
      flex-wrap: wrap;
    }

    .cta {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2-5);
      padding: var(--space-4) var(--space-9);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      letter-spacing: var(--tracking-widest);
      text-transform: uppercase;
      color: var(--color-text-inverse);
      background: var(--color-accent-amber);
      border: var(--border-width-thin) solid var(--color-accent-amber-dim);
      box-shadow: var(--shadow-md);
      cursor: pointer;
      transition: transform var(--transition-normal), box-shadow var(--transition-normal),
        background var(--transition-normal);
    }

    .cta:hover,
    .cta:focus-visible {
      background: var(--color-accent-amber-hover);
      transform: translate(-1px, -1px);
      box-shadow: var(--shadow-xl);
    }

    .caption {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      letter-spacing: var(--tracking-wider);
      text-transform: uppercase;
      color: var(--color-text-muted);
    }

    /* ── BREITBILD (Entwurf v2, ≥1920) ──────────────────────────────────
       Die grosse Aufforderung bekommt eine eigene Spanne (96 → 128 px) statt
       des Faktors, den Abschnittsueberschriften tragen: sie waechst um ein
       Drittel, nicht um ein Siebtel. Der Eingabekasten geht 720 → 860 px mit,
       sonst stuende ein schmaler Kasten neben einer sehr grossen Zeile. */
    @media (min-width: 1920px) {
      .right {
        max-width: 860px;
      }
    }

    @media (max-width: 1024px) {
      .layout {
        flex-direction: column;
        gap: var(--space-10);
        padding: var(--space-16) var(--space-5);
      }

      .prompt__text {
        min-height: 200px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .prompt__cursor {
        animation: none;
      }

      .chip {
        transition: none;
      }
    }
  `,
  ];

  /** Echte Ausgangssätze aus dem Bestand. Leer heisst: es gibt (noch) keine
   *  freigegebenen, dann tippt der Abschnitt seine Beispiele. */
  @property({ attribute: false }) prompts: LandingPrompt[] = [];

  @state() private _typed = '';
  @state() private _anchor = 0;

  private _timer?: ReturnType<typeof setInterval>;
  private _index = 0;
  private _chars = 0;
  private _deleting = false;
  private _hold = 0;

  /**
   * Zwanzig Weltbeschreibungen aus dem Entwurf.
   *
   * Als Methode und nicht als Modulkonstante, weil `msg()` auf Modulebene
   * beim Sprachwechsel nicht neu ausgewertet wird - eine Falle, die dieses
   * Werk schon einmal getroffen hat (siehe `i18n-gotchas`).
   */
  /** Die Sätze, die getippt werden.
   *
   *  ZWEI QUELLEN, EINE RANGFOLGE — und das ist keine Doppelung, sondern eine
   *  Aussage: liegen echte Ausgangssätze vor, gewinnen sie IMMER. Die
   *  Beispiele unten sind erfunden, sie sagen das auch (die Überschrift des
   *  Abschnitts nennt sie Beispiele), und sie existieren nur, damit die Seite
   *  nicht leer ist, solange keine echten freigegeben sind.
   *
   *  Auf Prod liegen 26 echte Sätze in `forge_drafts.seed_prompt`, 16 davon
   *  aus abgeschlossenen Läufen. Sie sind noch nicht freigegeben, weil sie von
   *  Menschen geschrieben sind und die Frontseite öffentlich ist — siehe
   *  `LandingPrompt` im Rücken. */
  private _prompts(): string[] {
    if (this.prompts.length) return this.prompts.map((p) => t(p, 'text')).filter(Boolean);
    return [
      msg(
        'A drowned republic where the tide is legal tender and every clerk owes the moon a debt. High water is payday, low water is austerity, and the Brine Chancellery keeps two sets of books: one for the living, one for the sea.',
      ),
      msg(
        'A bureaucracy of chitinous insects governing a city of wax and paper. Promotion is by molting, demotion is by candle, and the archive eats one form per night. Nobody files a complaint, because the complaint form is the first thing it ate.',
      ),
      msg(
        'A mining aristocracy that dug too deep and now pays rent to whatever lives below. The lease is renegotiated every winter solstice, in the dark, by a delegation that returns one member short and never discusses it.',
      ),
      msg(
        'A baroque city-state that prints its grudges every morning in a broadsheet of record. Duels are fought over typos, retractions cost more than funerals, and the editor has outlived four governments by misquoting all of them.',
      ),
      msg(
        'An alpine empire run entirely by lighthouse keepers, though there is no sea, only fog with opinions. The lights must never align, for on the one recorded night they did, something in the fog aligned back.',
      ),
      msg(
        'A desert caliphate where cartographers are priests and an inaccurate map is heresy. The border moves when nobody is drawing it, so the frontier monasteries sketch in shifts, around the clock, and still lose a village every decade.',
      ),
      msg(
        'A glacier city that migrates two meters per year, dragging its cathedral by law. Streets are renamed as they drift, marriages are annulled if the couple ends up on opposite moraines, and the founding quarter is now three valleys behind.',
      ),
      msg(
        'A merchant archipelago where every contract must be sung before witnesses. Breach of contract is off-key, insurance fraud is falsetto, and the supreme court is a choir that has not agreed on a verdict, or a key signature, since the drowning of the second fleet.',
      ),
      msg(
        'A velvet dictatorship of retired opera singers who outlawed silence in 1911. Informants hum. The secret police travel as a touring company, and the last man who whispered was given three encores and never seen again.',
      ),
      msg(
        'A river delta ruled by three rival post offices that read everything and forgive nothing. Love letters arrive annotated, ransom notes come back corrected, and once a generation the three postmasters exchange a single unstamped envelope no one has ever opened.',
      ),
      msg(
        'A walled garden-state whose census counts the dead, because they still vote. The graveyard districts lean conservative, the crematorium ward is a swing seat, and every election night the returning officer reads the results aloud twice: once facing the city, once facing the wall.',
      ),
      msg(
        'A smog-choked industrial duchy where the chimney sweeps union secretly owns the sky. Sunlight is leased by the hour, stars are a black-market luxury, and when the duke stopped paying his invoice, his palace stood in private night for eleven years.',
      ),
      msg(
        'A salt-flat theocracy that worships reflections and executes mirror-breakers at dawn. After the rains, when the whole flat becomes one perfect mirror, the priesthood walks out onto the sky and takes confession from the clouds.',
      ),
      msg(
        'A canal republic where the gondoliers are the intelligence service and every song is a report. The melody carries the facts, the harmony carries the doubts, and the state anthem is legally classified.',
      ),
      msg(
        'A mountain kingdom that elects its king by avalanche. Candidates stand on the slope at first thaw; the mountain abstains some years, and the throne stays empty, which the constitution counts as its wisest reign.',
      ),
      msg(
        'A paper federation of libraries at war over a single misfiled book since 1834. Ceasefires are signed in pencil. The book itself has been read by no one still living, and both sides privately fear it is a ledger of what the war has cost.',
      ),
      msg(
        'A coastal margravate where storms are put on trial in absentia and always found guilty. Sentences are carved into the cliff face. The great hurricane of 88 was condemned to four hundred years of community service, and the harbor wall it must rebuild is almost finished.',
      ),
      msg(
        'A subterranean stock exchange that trades in memories, dream futures, and grudge derivatives. Childhood summers are blue-chip, first kisses are volatile, and the crash of the nostalgia bubble left an entire generation unable to remember why it was angry.',
      ),
      msg(
        'A frostbitten port where every departing ship must carry one passenger who never existed. The shipping registry lists them in white ink. Sailors say the invented passengers keep the sea from noticing the real ones.',
      ),
      msg(
        'A vineyard oligarchy whose wars are fought exclusively by sommeliers, to the last drop. Vintages are classified as armaments, decanting is a declaration, and the treaty of the great frost was ratified by everyone spitting at the same time.',
      ),
    ];
  }

  private _anchors(): string[] {
    return [
      msg('Stoic order'),
      msg('The absurd'),
      msg('Entropy and decay'),
      msg('Collective memory'),
      msg('Faustian ambition'),
      msg('Sacred bureaucracy'),
    ];
  }

  connectedCallback(): void {
    super.connectedCallback();
    const prompts = this._prompts();

    // Ein angehaltenes Tippfeld zeigt den vollen Text, nicht eine halbe Zeile.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      this._typed = prompts[0];
      return;
    }

    this._timer = setInterval(() => {
      const prompt = prompts[this._index];
      if (!this._deleting) {
        this._chars += 1;
        if (this._chars >= prompt.length) {
          this._chars = prompt.length;
          this._deleting = true;
          this._hold = HOLD_TICKS;
        }
      } else if (this._hold > 0) {
        this._hold -= 1;
      } else {
        this._chars -= DELETE_CHARS;
        if (this._chars <= 0) {
          this._chars = 0;
          this._deleting = false;
          this._index = (this._index + 1) % prompts.length;
          this._anchor = this._index % this._anchors().length;
        }
      }
      this._typed = prompt.slice(0, Math.max(0, this._chars));
    }, TICK_MS);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._timer) clearInterval(this._timer);
  }

  protected render() {
    const anchors = this._anchors();

    return html`
      <div class="layout stage-container">
        <div>
          <p class="kicker">${msg('Transmission open')}</p>
          <h2 class="title">${msg('Forge')}<br />${msg('yours')}<em>.</em></h2>
        </div>

        <div class="right">
          <div class="prompt">
            <span class="prompt__caret" aria-hidden="true">&gt;</span>
            <p class="prompt__text" aria-live="off">
              ${this._typed}<span class="prompt__cursor" aria-hidden="true"></span>
            </p>
          </div>

          <div class="anchors">
            <span class="anchors__label">${msg('Anchor it in a philosophy')}</span>
            ${anchors.map(
              (anchor, index) => html`
                <span class="chip ${index === this._anchor ? 'chip--on' : ''}">${anchor}</span>
              `,
            )}
            <span class="anchors__note">
              ${msg('Required · shapes every citizen’s soul')}
            </span>
          </div>

          <div class="actions">
            <button class="cta" @click=${() => navigate('/forge')}>
              ${msg('Forge this world')} <span aria-hidden="true">&rarr;</span>
            </button>
            <span class="caption">${msg('Free · alive in minutes')}</span>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-landing-forge': VelgLandingForge;
  }
}
