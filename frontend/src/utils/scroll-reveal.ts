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
