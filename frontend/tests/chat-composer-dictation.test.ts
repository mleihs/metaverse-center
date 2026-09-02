/**
 * Die Spracheingabe im Chat-Eingabefeld — was daran nicht verrutschen darf.
 *
 * Vier Zusicherungen, und keine davon ist Geschmack:
 *
 * 1. OHNE ERKENNER KEIN KNOPF. Firefox hat `SpeechRecognition` nicht. Ein
 *    Knopf, der dort erscheint, verspricht etwas, das der Browser niemals
 *    einlösen kann — und die einzige Rückmeldung wäre eine Fehlermeldung für
 *    ein Versäumnis, das nicht beim Nutzer liegt. Die Prüfung muss BEIDE
 *    Schreibweisen kennen: Safari hat nur die mit `webkit`-Präfix.
 * 2. NUR ENDGÜLTIGE SÄTZE ERREICHEN DAS TEXTFELD. Ein Zwischenergebnis wird
 *    mehrmals je Satz zurückgezogen und neu geschrieben. Landete es im
 *    Textfeld, kämpfte es mit jedem, der während des Diktats tippt, und der
 *    nächste endgültige Treffer verdoppelte es.
 * 3. EINE VERWEIGERTE ERLAUBNIS SAGT ETWAS UND WIRD BEOBACHTET. Sie ist kein
 *    Fehler im Code, aber wie oft Leute an diese Wand laufen, will man lesen
 *    können.
 * 4. UNSER EIGENER ABBRUCH BLEIBT STILL. `abort()` löst dasselbe Ereignis aus
 *    wie ein echter Fehler. Würde es gemeldet, erzeugte jedes Absenden einer
 *    diktierten Nachricht einen Fehlereintrag.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Der Beobachtungspfad ist Gegenstand der Prüfung (Punkt 3 und 4), also muss er
// ersetzbar sein. `importOriginal` lässt den Rest des Moduls unangetastet —
// `locale-service.ts` zieht es beim Laden mit herein und ruft daraus.
vi.mock('../src/services/SentryService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/SentryService.js')>();
  return { ...actual, captureError: vi.fn() };
});

// ⚠ Nebenwirkungs-Import: käme die Klasse nur in Typ-Positionen vor, entfernte
// esbuild ihn restlos und `@customElement` liefe nie.
await import('../src/components/chat/core/ChatComposer.js');
type ChatComposer = import('../src/components/chat/core/ChatComposer.js').ChatComposer;
const { captureError } = await import('../src/services/SentryService.js');
const { VelgToast } = await import('../src/components/shared/Toast.js');

// --- Ein Erkenner, der nichts hört, aber alles meldet ---------------------

class FakeRecognition extends EventTarget implements SpeechRecognition {
  static last: FakeRecognition | null = null;

  lang = '';
  continuous = false;
  interimResults = false;
  maxAlternatives = 0;

  starts = 0;
  stops = 0;
  aborts = 0;

  onstart: SpeechRecognition['onstart'] = null;
  onresult: SpeechRecognition['onresult'] = null;
  onerror: SpeechRecognition['onerror'] = null;
  onend: SpeechRecognition['onend'] = null;

  constructor() {
    super();
    FakeRecognition.last = this;
  }

  start(): void {
    this.starts += 1;
  }

  stop(): void {
    this.stops += 1;
    this.onend?.call(this, new Event('end'));
  }

  abort(): void {
    this.aborts += 1;
  }
}

function alternative(transcript: string): SpeechRecognitionAlternative {
  return { transcript, confidence: 0.9 };
}

function speechResult(transcript: string, isFinal: boolean): SpeechRecognitionResult {
  const alternatives = [alternative(transcript)];
  return {
    isFinal,
    length: alternatives.length,
    0: alternatives[0],
    item: (index: number) => alternatives[index],
    [Symbol.iterator]: () => alternatives[Symbol.iterator](),
  };
}

function speechResultList(results: SpeechRecognitionResult[]): SpeechRecognitionResultList {
  const list: SpeechRecognitionResultList = {
    length: results.length,
    item: (index: number) => results[index],
    [Symbol.iterator]: () => results[Symbol.iterator](),
  };
  for (let i = 0; i < results.length; i += 1) {
    list[i] = results[i];
  }
  return list;
}

/**
 * `Object.assign` statt einer Umdeutung: die gelieferten Felder sind schreibbar,
 * das Ziel liest sie nur — das genügt TypeScript, und die Attrappe bleibt damit
 * an denselben Vertrag gebunden wie der echte Erkenner.
 */
function resultEvent(
  results: SpeechRecognitionResult[],
  resultIndex = 0,
): SpeechRecognitionEvent {
  return Object.assign(new Event('result'), {
    resultIndex,
    results: speechResultList(results),
  });
}

function errorEvent(error: SpeechRecognitionErrorCode): SpeechRecognitionErrorEvent {
  return Object.assign(new Event('error'), { error, message: '' });
}

// --- Aufbau ---------------------------------------------------------------

async function mount(): Promise<ChatComposer> {
  const element = document.createElement('velg-chat-composer');
  document.body.appendChild(element);
  await element.updateComplete;
  return element;
}

function micButton(element: ChatComposer): HTMLButtonElement | null {
  return element.shadowRoot?.querySelector<HTMLButtonElement>('.composer__mic') ?? null;
}

function textareaValue(element: ChatComposer): string {
  return element.shadowRoot?.querySelector<HTMLTextAreaElement>('.composer__textarea')?.value ?? '';
}

beforeEach(() => {
  document.body.innerHTML = '';
  FakeRecognition.last = null;
  delete window.SpeechRecognition;
  delete window.webkitSpeechRecognition;
  vi.mocked(captureError).mockClear();
  // `spyOn` auf eine bereits ersetzte Methode gibt DIESELBE Attrappe zurück —
  // ohne das `mockClear` zählte jede Prüfung die Meldungen der vorigen mit, und
  // „bleibt still" wäre rot geworden, weil eine andere Prüfung geredet hat.
  vi.spyOn(VelgToast, 'error')
    .mockImplementation(() => {})
    .mockClear();
});

describe('ChatComposer — Spracheingabe', () => {
  it('zeigt keinen Mikrofonknopf, wenn der Browser keinen Erkenner hat', async () => {
    const element = await mount();
    expect(micButton(element)).toBeNull();
  });

  it('erkennt auch die Schreibweise mit webkit-Präfix', async () => {
    window.webkitSpeechRecognition = FakeRecognition;
    const element = await mount();
    expect(micButton(element)).not.toBeNull();
  });

  it('öffnet auf Klick ein offenes Mikrofon mit Zwischenergebnissen', async () => {
    window.SpeechRecognition = FakeRecognition;
    const element = await mount();

    micButton(element)?.click();
    await element.updateComplete;

    const recognition = FakeRecognition.last;
    expect(recognition?.starts).toBe(1);
    expect(recognition?.continuous).toBe(true);
    expect(recognition?.interimResults).toBe(true);
    // Ohne Sprachmarke fiele der Erkenner auf die Browsersprache zurück, die
    // mit der Sprache der Oberfläche nichts zu tun haben muss.
    expect(recognition?.lang).not.toBe('');

    expect(micButton(element)?.getAttribute('aria-pressed')).toBe('true');
    expect(micButton(element)?.classList.contains('composer__mic--live')).toBe(true);
  });

  it('hängt nur endgültige Sätze ans Textfeld an — das Zwischenergebnis bleibt in der Fußzeile', async () => {
    window.SpeechRecognition = FakeRecognition;
    const element = await mount();
    element.setContent('Guten Tag');
    await element.updateComplete;

    micButton(element)?.click();
    await element.updateComplete;
    const recognition = FakeRecognition.last;

    recognition?.onresult?.call(
      recognition,
      resultEvent([speechResult('hier ist der', false)]),
    );
    await element.updateComplete;

    expect(textareaValue(element)).toBe('Guten Tag');
    expect(
      element.shadowRoot?.querySelector('.composer__hearing-text')?.textContent,
    ).toBe('hier ist der');

    recognition?.onresult?.call(
      recognition,
      resultEvent([speechResult('Hier ist der Bericht.', true)]),
    );
    await element.updateComplete;

    // Ein Leerzeichen dazwischen, keines am Anfang: der Satz landet am ENDE der
    // Nachricht, nicht an der Schreibmarke.
    expect(textareaValue(element)).toBe('Guten Tag Hier ist der Bericht.');
  });

  it('meldet eine verweigerte Mikrofon-Erlaubnis und beobachtet sie', async () => {
    window.SpeechRecognition = FakeRecognition;
    const element = await mount();
    micButton(element)?.click();
    await element.updateComplete;

    const recognition = FakeRecognition.last;
    recognition?.onerror?.call(recognition, errorEvent('not-allowed'));
    await element.updateComplete;

    expect(VelgToast.error).toHaveBeenCalledTimes(1);
    expect(vi.mocked(captureError)).toHaveBeenCalledTimes(1);
    expect(micButton(element)?.getAttribute('aria-pressed')).toBe('false');
  });

  it('bleibt still, wenn der Abbruch von uns selbst kam', async () => {
    window.SpeechRecognition = FakeRecognition;
    const element = await mount();
    micButton(element)?.click();
    await element.updateComplete;

    const recognition = FakeRecognition.last;
    recognition?.onerror?.call(recognition, errorEvent('aborted'));
    await element.updateComplete;

    expect(VelgToast.error).not.toHaveBeenCalled();
    expect(vi.mocked(captureError)).not.toHaveBeenCalled();
  });
});
