/**
 * Der Rollverwalter des Chats — was daran nicht verrutschen darf.
 *
 * Der gemeldete Fehler lautete: „ich muss jedes Mal mit dem Mausrad nach unten
 * scrollen". Die Ursache war nicht eine fehlende Zeile, sondern eine Sperre,
 * die sich einschaltete und nie wieder löste — und zwar durch den EIGENEN
 * Rollvorgang der Komponente:
 *
 *   1. Ein `scrollTo({behavior:'smooth'})` erzeugt DUTZENDE `scroll`-Ereignisse.
 *      Die alte Fassung überging genau EINES davon (`_ignoreNextScroll`); jedes
 *      weitere las sie als „der Nutzer rollt weg".
 *   2. Die Antwort auf „bin ich unten?" kam von einem IntersectionObserver,
 *      also einen Frame zu spät. Jeder gestreamte Token schob den Anker aus dem
 *      Bild, und die Sperre schnappte zu, obwohl niemand sich bewegt hatte.
 *
 * Beides sind ASYNCHRONE Antworten auf eine SYNCHRONE Frage. Die Prüfungen hier
 * halten die Ersetzung fest: gemessen wird am Element selbst, und ein Wegrollen
 * zählt nur, wenn die Ansicht sich auch wirklich nach OBEN bewegt hat.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScrollController } from '../src/services/chat/ScrollController.js';

// --- Ein Wirt, der nur zählt ---------------------------------------------

function host() {
  return {
    addController: vi.fn(),
    removeController: vi.fn(),
    requestUpdate: vi.fn(),
    updateComplete: Promise.resolve(true),
  };
}

/**
 * Ein ECHTES Element mit gestellten Messwerten. `scrollHeight` und
 * `clientHeight` sind Prototyp-Getter; auf der Instanz definiert verdecken sie
 * diese. So bleiben `addEventListener` und `dispatchEvent` die echten — die
 * Prüfung geht damit durch denselben Ereignispfad wie der Browser.
 */
function feed(scrollHeight: number, clientHeight: number, scrollTop = 0): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'scrollHeight', { value: scrollHeight, configurable: true });
  Object.defineProperty(el, 'clientHeight', { value: clientHeight, configurable: true });
  Object.defineProperty(el, 'scrollTop', { value: scrollTop, writable: true, configurable: true });
  return el;
}

function setzeHoehe(el: HTMLElement, scrollHeight: number): void {
  Object.defineProperty(el, 'scrollHeight', { value: scrollHeight, configurable: true });
}

function rolleAuf(el: HTMLElement, scrollTop: number): void {
  Object.defineProperty(el, 'scrollTop', { value: scrollTop, writable: true, configurable: true });
  el.dispatchEvent(new Event('scroll'));
}

const naechsterFrame = () => new Promise((r) => requestAnimationFrame(() => r(null)));

let h: ReturnType<typeof host>;

beforeEach(() => {
  h = host();
});

describe('ScrollController', () => {
  it('bleibt angeheftet, wenn nur der Inhalt wächst', () => {
    // 1000 hoch, 400 sichtbar, ganz unten bei 600.
    const el = feed(1000, 400, 600);
    const c = new ScrollController(h);
    c.attach(el);

    // Eine gestreamte Antwort wächst um 300 px. Die Ansicht bleibt stehen, es
    // wird also NICHT gerollt — der Abstand nach unten wächst von selbst.
    setzeHoehe(el, 1300);
    el.dispatchEvent(new Event('scroll'));

    // Genau hier schnappte die alte Sperre zu.
    expect(c.userScrolledUp).toBe(false);
  });

  it('löst die Heftung, wenn der Nutzer nach oben rollt', () => {
    const el = feed(2000, 400, 1600);
    const c = new ScrollController(h);
    c.attach(el);

    rolleAuf(el, 800); // deutlich nach oben

    expect(c.userScrolledUp).toBe(true);
    expect(c.isAtBottom).toBe(false);
  });

  it('heftet wieder an, sobald das Ende in Reichweite ist', () => {
    const el = feed(2000, 400, 1600);
    const c = new ScrollController(h);
    c.attach(el);

    rolleAuf(el, 800);
    expect(c.userScrolledUp).toBe(true);

    rolleAuf(el, 1580); // Abstand 20 px, innerhalb der Toleranz
    expect(c.userScrolledUp).toBe(false);
    expect(c.isAtBottom).toBe(true);
  });

  it('lässt sich vom EIGENEN glatten Rollvorgang nicht aussperren', () => {
    // Der Rückfall-Test. Ein `behavior: 'smooth'` läuft über viele
    // Zwischenpositionen, und in fast allen ist der Abstand nach unten grösser
    // als die Toleranz. Die alte Fassung überging genau ein Ereignis davon.
    const el = feed(2000, 400, 200);
    const c = new ScrollController(h);
    c.attach(el);
    rolleAuf(el, 200);

    // Eine neue Nachricht kommt, die Komponente rollt glatt ans Ende.
    for (const position of [400, 700, 1000, 1250, 1450, 1560, 1600]) {
      rolleAuf(el, position);
    }

    expect(c.userScrolledUp).toBe(false);
    expect(c.isAtBottom).toBe(true);
  });

  it('überhört ein Zittern von wenigen Pixeln', () => {
    const el = feed(2000, 400, 1000);
    const c = new ScrollController(h);
    c.attach(el);
    rolleAuf(el, 1000);
    expect(c.userScrolledUp).toBe(false);

    rolleAuf(el, 997); // 3 px, unterhalb der Absichtsschwelle
    expect(c.userScrolledUp).toBe(false);
  });

  it('lässt „sofort" ein wartendes „glatt" nicht überschreiben', async () => {
    const el = feed(1000, 400, 600);
    const gerollt = vi.fn();
    Object.defineProperty(el, 'scrollTo', { value: gerollt, configurable: true });

    const c = new ScrollController(h);
    c.attach(el);

    // Ein gestreamter Token verlangt „sofort", eine gleichzeitige Änderung der
    // Nachrichtenliste „glatt". Wer live folgt, darf nicht animiert werden.
    c.requestAutoScroll('instant');
    c.requestAutoScroll('smooth');
    c.hostUpdated();
    await naechsterFrame();

    expect(gerollt).toHaveBeenCalledTimes(1);
    expect(gerollt.mock.calls[0][0]).toMatchObject({ top: 1000, behavior: 'instant' });
  });

  it('rollt gar nicht, solange der Nutzer oben liest', async () => {
    const el = feed(2000, 400, 1600);
    const gerollt = vi.fn();
    Object.defineProperty(el, 'scrollTo', { value: gerollt, configurable: true });

    const c = new ScrollController(h);
    c.attach(el);
    rolleAuf(el, 300); // liest Geschichte

    c.requestAutoScroll('smooth');
    c.hostUpdated();
    await naechsterFrame();

    expect(gerollt).not.toHaveBeenCalled();
  });

  it('rollt glatt, wenn eine Nachricht ankommt und unten gelesen wird', async () => {
    const el = feed(1000, 400, 600);
    const gerollt = vi.fn();
    Object.defineProperty(el, 'scrollTo', { value: gerollt, configurable: true });

    const c = new ScrollController(h);
    c.attach(el);

    c.requestAutoScroll('smooth');
    c.hostUpdated();
    await naechsterFrame();

    expect(gerollt).toHaveBeenCalledWith({ top: 1000, behavior: 'smooth' });
  });
});

describe('das Ende halten, waehrend der Boden noch wandert', () => {
  /*
   * Der Nutzer, mehrfach: nach dem Oeffnen eines Gespraechs landet die Ansicht
   * ein paar Nachrichten UEBER dem Ende.
   *
   * Ursache ist nicht der Rollbefehl, sondern sein Ziel. `.message-item` traegt
   * "content-visibility: auto" mit "contain-intrinsic-size: auto 80px": jede
   * noch nicht gerenderte Nachricht ist 80 px hoch, die echten sind 150 bis
   * 300. Beim Oeffnen ist nichts gerendert, also ist "scrollHeight" um die
   * Summe aller Differenzen zu klein. Auf Prod blieben so 1712 px stehen.
   *
   * Der ResizeObserver des Reglers sieht das nicht: er beobachtet den
   * BEHAELTER, und dessen Kasten aendert sich nicht, wenn der INHALT waechst.
   *
   * happy-dom rechnet kein Layout — die wachsende Hoehe wird hier gestellt,
   * geprueft wird, ob der Regler ihr folgt.
   */
  it('folgt dem Boden, der nach dem Rollbefehl noch waechst', async () => {
    const el = feed(1000, 400, 0);
    const c = new ScrollController(h);
    c.attach(el);

    c.snapToBottom();
    await naechsterFrame();

    // Die Kacheln klappen auf: 1000 -> 1800 -> 2600, je ein Bild spaeter.
    setzeHoehe(el, 1800);
    await naechsterFrame();
    expect(el.scrollTop).toBe(1800);

    setzeHoehe(el, 2600);
    await naechsterFrame();
    expect(el.scrollTop).toBe(2600);
  });

  it('gibt auf, sobald ein Mensch nach oben rollt', async () => {
    const el = feed(1000, 400, 600);
    const c = new ScrollController(h);
    c.attach(el);

    c.snapToBottom();
    await naechsterFrame();

    // Nach oben — deutlich mehr als die Zitterschwelle.
    rolleAuf(el, 100);
    expect(c.userScrolledUp).toBe(true);

    setzeHoehe(el, 3000);
    await naechsterFrame();
    await naechsterFrame();

    // Wer Geschichte liest, wird nicht ans Ende gerissen.
    expect(el.scrollTop).toBe(100);
  });

  it('hoert auf, wenn die Hoehe steht — die Schleife laeuft nicht ewig', async () => {
    const el = feed(1000, 400, 0);
    const c = new ScrollController(h);
    c.attach(el);

    c.snapToBottom();
    for (let i = 0; i < 8; i++) await naechsterFrame();

    // Haende weg: nach dem Ruhigwerden fasst der Regler nichts mehr an.
    Object.defineProperty(el, 'scrollTop', { value: 42, writable: true, configurable: true });
    for (let i = 0; i < 6; i++) await naechsterFrame();
    expect(el.scrollTop).toBe(42);
  });
});
