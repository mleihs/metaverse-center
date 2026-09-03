/**
 * Der Rollverwalter des Chats — was daran nicht verrutschen darf.
 *
 * Der Fehler wurde in drei Fassungen gemeldet, und jede Fassung hatte eine
 * andere Ursache. Die Pruefungen hier halten alle drei fest, damit keine davon
 * zurueckkommt:
 *
 *   1. „Ich muss jedes Mal mit dem Mausrad nach unten scrollen."
 *      Eine Sperre, die sich durch den EIGENEN Rollvorgang einschaltete: ein
 *      `scrollTo({behavior:'smooth'})` erzeugt Dutzende `scroll`-Ereignisse,
 *      die alte Fassung uebersprang genau eines. Dazu ein
 *      IntersectionObserver, der einen Frame zu spaet antwortete.
 *
 *   2. „Nach dem Oeffnen steht die Ansicht ein paar Nachrichten ueber dem Ende."
 *      Der Rollbefehl war richtig, sein ZIEL wanderte danach noch: Kacheln mit
 *      `content-visibility: auto` zaehlen ungerendert 80 px statt ihrer echten
 *      Hoehe. Der ResizeObserver sah es nicht — er beobachtete den BEHAELTER,
 *      dessen Kasten sich nicht aendert, wenn der INHALT waechst.
 *
 *   3. „Scrollt nicht fluessig, sondern zappt."
 *      Die Reparatur von (2) startete ein weiches Rollen und setzte im selben
 *      Frame `scrollTop` hart. Ein programmatischer Schreibzugriff bricht eine
 *      laufende Smooth-Animation ab — die weiche Bewegung kam nie zustande.
 *
 * Die jetzige Fassung hat deshalb EINE Schleife, die ihr Ziel in jedem Frame
 * neu liest (Feder statt Animation mit festem Ziel), markiert ihre eigenen
 * Schreibzugriffe, statt sie zu erraten, und beobachtet den Inhalt.
 *
 * happy-dom rechnet kein Layout: Hoehen werden gestellt, und `scrollTop` wird
 * NICHT auf das Maximum geklemmt. Deshalb steht in den Erwartungen der echte
 * Maximalwert `scrollHeight - clientHeight` — genau den rechnet der Regler
 * jetzt selbst aus, statt sich wie frueher auf die Begrenzung des Browsers zu
 * verlassen.
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

async function frames(n: number): Promise<void> {
  for (let i = 0; i < n; i++) await naechsterFrame();
}

/** Das echte Rollmaximum — happy-dom klemmt nicht, also rechnen wir es hier. */
const ende = (el: HTMLElement) => el.scrollHeight - el.clientHeight;

let h: ReturnType<typeof host>;

beforeEach(() => {
  h = host();
});

// ---------------------------------------------------------------------------

describe('die Heftung', () => {
  it('bleibt bestehen, wenn nur der Inhalt wächst', () => {
    const el = feed(1000, 400, 600);
    const c = new ScrollController(h);
    c.attach(el);

    // Wachsender Inhalt bewegt scrollTop nicht — nur scrollHeight.
    setzeHoehe(el, 1400);
    el.dispatchEvent(new Event('scroll'));

    expect(c.userScrolledUp).toBe(false);
  });

  it('löst sich, wenn der Mensch nach oben rollt', () => {
    const el = feed(2000, 400, 1600);
    const c = new ScrollController(h);
    c.attach(el);

    rolleAuf(el, 900);

    expect(c.userScrolledUp).toBe(true);
    expect(c.isAtBottom).toBe(false);
  });

  it('greift wieder, sobald das Ende in Reichweite ist', () => {
    const el = feed(2000, 400, 1600);
    const c = new ScrollController(h);
    c.attach(el);

    rolleAuf(el, 900);
    expect(c.userScrolledUp).toBe(true);

    rolleAuf(el, 1590); // Abstand 10 px, innerhalb der Toleranz
    expect(c.userScrolledUp).toBe(false);
    expect(c.isAtBottom).toBe(true);
  });

  it('überhört ein Zittern von wenigen Pixeln', () => {
    const el = feed(2000, 400, 1000);
    const c = new ScrollController(h);
    c.attach(el);

    rolleAuf(el, 996); // 4 px nach oben — unter UPWARD_INTENT
    expect(c.userScrolledUp).toBe(false);
  });
});

describe('der eigene Rollbefehl', () => {
  it('sperrt den Regler nicht aus — er ist markiert, nicht erraten', async () => {
    const el = feed(4000, 400, 3600);
    const c = new ScrollController(h);
    c.attach(el);

    // Aus der Ferne zurueckholen: die Feder laeuft ueber viele Frames und
    // erzeugt dabei Dutzende Ereignisse. Keines davon darf als „der Mensch
    // rollt weg" gelesen werden.
    rolleAuf(el, 400);
    expect(c.userScrolledUp).toBe(true);

    c.scrollToBottom('smooth');
    await frames(40);

    expect(c.userScrolledUp).toBe(false);
    expect(el.scrollTop).toBeGreaterThan(3000);
  });
});

describe('die Anforderung', () => {
  it('lässt „sofort" ein wartendes „glatt" nicht überschreiben', async () => {
    const el = feed(1000, 400, 600);
    const c = new ScrollController(h);
    c.attach(el);

    c.requestAutoScroll('instant');
    c.requestAutoScroll('smooth');
    c.hostUpdated();
    await naechsterFrame();

    // Sofort: in EINEM Frame am Ende, nicht federnd unterwegs.
    expect(el.scrollTop).toBe(ende(el));
  });

  it('rollt gar nicht, solange der Mensch oben liest', async () => {
    const el = feed(2000, 400, 200);
    const c = new ScrollController(h);
    c.attach(el);

    rolleAuf(el, 100);
    expect(c.userScrolledUp).toBe(true);

    const stand = el.scrollTop;
    c.requestAutoScroll('smooth');
    c.hostUpdated();
    await frames(10);

    expect(el.scrollTop).toBe(stand);
  });
});

describe('fluessig statt zappen', () => {
  /*
   * Punkt 3 der Fehlermeldung. Ein weiches Rollen darf nicht in einem einzigen
   * Sprung am Ziel sein — sonst ist es keines. Die Feder naehert sich an.
   */
  it('nähert sich an, statt in einem Satz anzukommen', async () => {
    const el = feed(4000, 400, 0);
    const c = new ScrollController(h);
    c.attach(el);

    c.scrollToBottom('smooth');
    await naechsterFrame();

    const nachEinemFrame = el.scrollTop;
    expect(nachEinemFrame).toBeGreaterThan(0);
    expect(nachEinemFrame).toBeLessThan(ende(el));

    // Die Feder naehert sich geometrisch an: rund 9 % des Restwegs pro Frame.
    // Fuer 3 600 px sind das ~95 Frames (~1,5 s). Eine ankommende Nachricht ist
    // ein Zehntel davon; die lange Strecke gibt es nur ueber den Knopf.
    await frames(150);
    expect(el.scrollTop).toBeCloseTo(ende(el), 0);
  });

  /*
   * Punkt 2, und der eigentliche Grund fuer die Feder: das Ziel wird in JEDEM
   * Frame neu gelesen. `scrollTo({behavior:'smooth'})` merkt sich seines beim
   * Start und endet deshalb zwangslaeufig zu kurz, wenn der Boden waehrend der
   * Bewegung weiterwandert.
   */
  it('folgt einem Boden, der während der Bewegung weiterwächst', async () => {
    const el = feed(2000, 400, 0);
    const c = new ScrollController(h);
    c.attach(el);

    c.scrollToBottom('smooth');
    await frames(5);

    // Mitten in der Bewegung klappen Kacheln auf.
    setzeHoehe(el, 3000);
    await frames(5);
    setzeHoehe(el, 4200);
    await frames(80);

    expect(el.scrollTop).toBeCloseTo(ende(el), 0);
  });

  it('holt den Boden ein, der NACH dem Rollbefehl noch wächst', async () => {
    const el = feed(1000, 400, 0);
    const c = new ScrollController(h);
    c.attach(el);

    c.snapToBottom();
    await naechsterFrame();
    expect(el.scrollTop).toBe(ende(el));

    setzeHoehe(el, 1800);
    await naechsterFrame();
    expect(el.scrollTop).toBe(ende(el));

    setzeHoehe(el, 2600);
    await naechsterFrame();
    expect(el.scrollTop).toBe(ende(el));
  });

  it('gibt auf, sobald ein Mensch nach oben rollt', async () => {
    const el = feed(4000, 400, 0);
    const c = new ScrollController(h);
    c.attach(el);

    c.scrollToBottom('smooth');
    await frames(3);

    rolleAuf(el, 100);
    const stand = el.scrollTop;
    await frames(20);

    expect(c.userScrolledUp).toBe(true);
    expect(el.scrollTop).toBe(stand);
  });

  it('hört auf, wenn die Höhe steht — die Schleife läuft nicht ewig', async () => {
    const el = feed(1000, 400, 0);
    const c = new ScrollController(h);
    c.attach(el);

    c.snapToBottom();
    await frames(12);

    const geschrieben = el.scrollTop;
    await frames(10);
    expect(el.scrollTop).toBe(geschrieben);

    /*
     * Der eigentliche Nachweis, dass die Schleife ENDET und nicht nur still
     * ist: die Hoehe waechst, ohne dass jemand ein Ereignis ausloest. Liefe
     * noch ein Frame, wuerde er das sehen und nachziehen. Er tut es nicht.
     */
    setzeHoehe(el, 5000);
    await frames(10);
    expect(el.scrollTop).toBe(geschrieben);
  });
});

describe('was beobachtet wird', () => {
  /*
   * Der Kern von Punkt 2: der Behaelter ist `flex: 1`, seine Kastengroesse
   * kommt vom Elternelement und aendert sich NIE, wenn Nachrichten dazukommen.
   * Ein Observer auf ihm allein wartet auf ein Ereignis, das es nicht gibt.
   */
  it('beobachtet den Inhalt, nicht nur den Behälter', () => {
    const beobachtet: Element[] = [];
    const echterRO = globalThis.ResizeObserver;
    class RO {
      observe(el: Element) {
        beobachtet.push(el);
      }
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', RO);

    const behaelter = feed(1000, 400, 0);
    const inhalt = document.createElement('div');
    const c = new ScrollController(h);
    c.attach(behaelter, inhalt);

    expect(beobachtet).toContain(inhalt);
    expect(beobachtet).toContain(behaelter);

    vi.stubGlobal('ResizeObserver', echterRO);
  });
});
