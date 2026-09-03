/**
 * Das Einblenden beim Scrollen — ein Beobachter, eine Stelle.
 *
 * Die Chronik (`landing/ChronicleFeed.ts`) und die Weltengalerie
 * (`landing/WorldsGallery.ts`) trugen seit März 2026 dieselbe Methode; der
 * einzige Unterschied war der Selektor (`.dispatch-scroll-reveal` gegen
 * `.scroll-reveal`). Genau deshalb steht er hier als Parameter: die Mechanik
 * ist geteilt, der Name der Klasse gehört der Komponente.
 *
 * Der Schwellwert 0,1 ist Absicht und wird NICHT zum Parameter, solange ihn
 * niemand anders braucht: eine Stellschraube, die überall gleich steht, ist
 * keine Stellschraube, sondern eine Verabredung.
 *
 * Die Komponente behält den Besitz am Beobachter — sie muss ihn in
 * `disconnectedCallback()` weiterhin selbst trennen. Dieser Helfer nimmt ihr
 * nur das Wiederaufsetzen ab, das bei jedem `updated()` fällig wird.
 *
 * Das Gegenstück in CSS steht in der Hausregel: `.scroll-reveal` startet
 * durchsichtig und versetzt, `.in-view` setzt beides zurück — mitsamt der
 * `prefers-reduced-motion`-Ausnahme, die jede Bewegung im Haus braucht.
 */

/** Anteil des Elements, der sichtbar sein muss, bevor es sich zeigt. */
const REVEAL_THRESHOLD = 0.1;

/**
 * Setzt den Einblende-Beobachter neu auf und gibt ihn zurück.
 *
 * @param root     Der Wurzelknoten der Komponente (`this.renderRoot`).
 * @param selector Die Klasse der noch nicht eingeblendeten Elemente.
 * @param previous Der Beobachter des letzten Durchlaufs; wird getrennt.
 *
 * Jedes Element wird nach dem Einblenden abgemeldet: das Einblenden ist ein
 * Ereignis, kein Zustand, der gepflegt werden müsste.
 */
export function setupScrollReveal(
  root: ParentNode,
  selector: string,
  previous?: IntersectionObserver,
): IntersectionObserver {
  previous?.disconnect();

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: REVEAL_THRESHOLD },
  );

  for (const el of root.querySelectorAll(`${selector}:not(.in-view)`)) {
    observer.observe(el);
  }

  return observer;
}

/* ===========================================================================
 * DER KARTENSTAPEL — Blatt 09 der Atlas-Landing.
 * ========================================================================= */

/** Wie weit die naechste Karte unter der obersten hervorschaut. */
const STACK_OFFSET_PX = 18;
/** Wie viel kleiner jede Tiefe steht. Aus dem Design-Paket. */
const STACK_SCALE_STEP = 0.035;
/** Mehr als vier Karten sieht niemand; der Rest wartet auf seinen Zug. */
const STACK_VISIBLE_DEPTH = 4;

/**
 * `easeInOutSine`, wie im Design-Paket verlangt.
 *
 * Warum eine Kurve und nicht der rohe Fortschritt: der Wechsel von Karte zu
 * Karte soll an den Enden ruhen. Linear liest sich das Abziehen als Ruck genau
 * in dem Moment, in dem eine neue Karte oben liegt.
 */
function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

/**
 * Fuehrt einen Kartenstapel am Scrollfortschritt seines Wirts.
 *
 * WAS ES TUT
 *   Der Wirt ist N x 100vh hoch und der Stapel klebt darin. Aus dem
 *   Scrollfortschritt wird ein Bruch 0..1, daraus die Nummer der obersten
 *   Karte und ihr Anteil am Abziehen. Die oberste Karte zieht nach oben ab, die
 *   darunterliegenden wachsen um eine Stufe nach.
 *
 * WARUM CUSTOM PROPERTIES UND KEINE style.transform-ZUWEISUNG
 *   Geschrieben wird pro Karte nur `--stack-depth` und `--stack-shift`; die
 *   Bewegung selbst steht in der CSS der Komponente. Damit bleibt die
 *   Gestaltung dort, wo sie hingehoert, und `prefers-reduced-motion` kann sie
 *   in einer Medienabfrage abschalten, ohne dass dieses Modul davon weiss.
 *
 * WARUM rAF-GEDROSSELT
 *   `scroll` feuert auf einem Trackpad weit oefter als der Bildschirm neu
 *   zeichnet. Ohne die Drosselung rechnet die Funktion mehrmals pro Bild
 *   dasselbe Ergebnis, und auf einem Telefon kostet das sichtbar Bilder.
 *
 * @returns Eine Funktion, die den Beobachter wieder abmeldet. Die Komponente
 *          behaelt den Besitz und muss sie in `disconnectedCallback()` rufen —
 *          dieselbe Verabredung wie bei `setupScrollReveal` darueber.
 */
export function stackReveal(host: HTMLElement, cards: HTMLElement[]): () => void {
  if (cards.length === 0) return () => {};

  let frame = 0;

  const apply = (): void => {
    frame = 0;
    const box = host.getBoundingClientRect();
    /*
     * Der Fortschritt zaehlt, wie weit der Wirt durch das Fenster gewandert
     * ist. `box.height - innerHeight` ist die Strecke, auf der der Stapel
     * klebt — nicht `box.height`: die letzte Fensterhoehe ist bereits das
     * Ende, nicht noch ein Schritt.
     */
    const travel = box.height - window.innerHeight;
    if (travel <= 0) return;

    const raw = Math.min(1, Math.max(0, -box.top / travel));
    const advanced = easeInOutSine(raw) * (cards.length - 1);
    const top = Math.floor(advanced);
    const shift = advanced - top;

    for (const [i, card] of cards.entries()) {
      const depth = i - top;
      /*
       * DIE TIEFE WIRD NICHT AUF 0 GEKLEMMT.
       *
       * Die erste Fassung schrieb `Math.max(0, depth)`. Damit sah eine bereits
       * ABGEZOGENE Karte (depth -1) aus wie die oberste: kein Versatz, keine
       * Verschiebung, Skalierung 1 — sie sass genau auf der neuen obersten
       * Karte. Im Browser fiel es nur nicht auf, weil beide dieselbe z-Stufe
       * bekamen und die DOM-Reihenfolge die neue zufaellig zuletzt zeichnete.
       * Ein Fehler, der durch Glueck unsichtbar war.
       *
       * Sichtbar war er an der Strichreihe: sie sucht die Karte mit Tiefe 0
       * und fand fuer immer die erste.
       */
      card.style.setProperty('--stack-depth', String(depth));
      /*
       * Nur die oberste Karte kennt einen Teilfortschritt. Die anderen wuerden
       * sonst alle gleichzeitig ruckeln, statt eine nach der anderen
       * nachzuwachsen. Eine abgezogene Karte steht auf 1 — voll weggezogen,
       * also ausserhalb des Bildes, und beim Zurueckscrollen kommt sie von
       * dort wieder herein.
       */
      const shiftFor = depth === 0 ? shift.toFixed(4) : depth < 0 ? '1' : '0';
      card.style.setProperty('--stack-shift', shiftFor);
      card.style.setProperty('--stack-offset', `${STACK_OFFSET_PX}px`);
      card.style.setProperty('--stack-scale-step', String(STACK_SCALE_STEP));
      /*
       * `hidden` statt einer Klasse: eine Karte, die zehn Tiefen unten liegt,
       * ist nicht durchsichtig, sie ist nicht da — und ein Screenreader soll
       * sie auch nicht vorlesen. Eine ABGEZOGENE Karte (depth < 0) bleibt
       * dagegen im Baum, damit das Zurueckscrollen sie wieder einblenden kann.
       */
      card.hidden = depth > STACK_VISIBLE_DEPTH;
    }
  };

  const onScroll = (): void => {
    if (frame) return;
    frame = requestAnimationFrame(apply);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  apply();

  return () => {
    if (frame) cancelAnimationFrame(frame);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
  };
}
