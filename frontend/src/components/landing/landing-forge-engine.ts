/**
 * Die Schmiede-Vorschau — DATEN und MECHANIK, keine Darstellung.
 *
 * Beide Vorlagen der Frontseite zeigen dasselbe Tippfeld: ein Ausgangssatz
 * laeuft Zeichen fuer Zeichen ein, haelt, loescht sich, der naechste folgt,
 * und die Ankerliste springt mit. Nur der Rahmen darum ist verschieden.
 *
 * WARUM DAS HIER STEHT UND NICHT IN DER KOMPONENTE
 *   Es ist Verhalten, kein Aussehen. Zweimal gebaut waeren es zwei Zaehlwerke
 *   mit denselben drei Konstanten, und die eine Fassung waere irgendwann
 *   schneller getippt als die andere, ohne dass es jemandem auffiele.
 *
 *   Vor allem aber: die zwanzig Beispielsaetze sind Text, den die Plattform
 *   ueber sich selbst schreibt. Eine Korrektur an einem davon muss beide
 *   Vorlagen erreichen.
 *
 * WARUM FUNKTIONEN STATT MODULKONSTANTEN
 *   `msg()` auf Modulebene wird beim Sprachwechsel nicht neu ausgewertet — eine
 *   Falle, die dieses Werk schon einmal getroffen hat. Deshalb wird jede Liste
 *   bei jedem Aufruf gebaut.
 */

import { msg } from '@lit/localize';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { LandingPrompt } from '../../types/index.js';
import { t } from '../../utils/locale-fields.js';

/** Ein Satz und die Welt, die aus ihm wurde (null heisst: keine). */
export interface ForgeEntry {
  text: string;
  simulationId: string | null;
}

/** Millisekunden pro Zeichen. */
const TICK_MS = 34;
/** Wie lange ein fertiger Satz stehen bleibt, in Ticks. */
const HOLD_TICKS = 110;
/** Beim Loeschen mehrere Zeichen auf einmal — rueckwaerts liest niemand mit. */
const DELETE_CHARS = 5;

/**
 * Ein Eintrag traegt beides: den Satz und die Welt, die aus ihm wurde.
 *
 * Vorher lieferte diese Methode nur Zeichenketten, und `_index` zeigte in
 * die GEFILTERTE Liste. Eine zweite Liste mit den Welt-Kennungen daneben
 * haette denselben Index gebraucht und waere beim ersten leeren Satz
 * verrutscht — der Faecher darueber haette dann die Buerger der falschen
 * Welt gezeigt, und zwar plausibel genug, dass es niemandem auffaellt.
 * Eine Liste, ein Index, kein Abgleich.
 */
export function forgeEntries(prompts: LandingPrompt[]): ForgeEntry[] {
  if (prompts.length) {
    return prompts
      .map((p) => ({ text: t(p, 'text'), simulationId: p.simulation_id ?? null }))
      .filter((e) => Boolean(e.text));
  }
  // Die Beispielsaetze gehoeren zu keiner Welt — null, nicht geraten.
  return fallbackPrompts().map((text) => ({ text, simulationId: null }));
}

function fallbackPrompts(): string[] {
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

export function forgeAnchors(): string[] {
  return [
    msg('Stoic order'),
    msg('The absurd'),
    msg('Entropy and decay'),
    msg('Collective memory'),
    msg('Faustian ambition'),
    msg('Sacred bureaucracy'),
  ];
}

/**
 * Das Tippwerk als Reactive Controller.
 *
 * Der Wirt bekommt `typed` und `anchor` und ruft `host.requestUpdate()` ueber
 * den Controller-Vertrag — er muss selbst nichts takten und nichts aufraeumen.
 *
 * BEI prefers-reduced-motion WIRD NICHT GETIPPT
 *   Dann steht der erste Satz vollstaendig da. Ein angehaltenes Tippfeld, das
 *   eine halbe Zeile zeigt, waere schlechter als keine Bewegung: es sieht aus
 *   wie ein Fehler.
 *
 * DAS EREIGNIS GEHT VOM WIRT AUS
 *   `prompt-world` sagt dem Blatt mit den Gewaehrsleuten, welche Welt gerade
 *   getippt wird. Es wird auf dem WIRT ausgeloest, nicht hier — die Frontseite
 *   ist der Ort, an dem die beiden Abschnitte sich kennen, nicht die
 *   Abschnitte selbst.
 */
export class ForgeTypewriter implements ReactiveController {
  /** Was gerade im Feld steht. */
  typed = '';
  /** Welcher Anker leuchtet. */
  anchor = 0;

  private _timer?: ReturnType<typeof setInterval>;
  private _index = 0;
  private _chars = 0;
  private _deleting = false;
  private _hold = 0;

  constructor(
    private readonly host: ReactiveControllerHost & EventTarget,
    private readonly entries: () => ForgeEntry[],
  ) {
    host.addController(this);
  }

  hostConnected(): void {
    const entries = this.entries();

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      this.typed = entries[0]?.text ?? '';
      this.host.requestUpdate();
      return;
    }

    this._timer = setInterval(() => this._tick(), TICK_MS);
  }

  hostDisconnected(): void {
    if (this._timer) clearInterval(this._timer);
    this._timer = undefined;
  }

  private _tick(): void {
    const entries = this.entries();
    const prompt = entries[this._index]?.text ?? '';

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
        this._index = (this._index + 1) % Math.max(1, entries.length);
        this.anchor = this._index % forgeAnchors().length;
        this.host.dispatchEvent(
          new CustomEvent('prompt-world', {
            bubbles: true,
            composed: true,
            detail: { simulationId: entries[this._index]?.simulationId ?? null },
          }),
        );
      }
    }

    this.typed = prompt.slice(0, Math.max(0, this._chars));
    this.host.requestUpdate();
  }
}
