/**
 * ScrollController — Lit Reactive Controller fuer die Rollposition eines Verlaufs.
 *
 * Haelt die Ansicht an der neuesten Nachricht, solange jemand unten liest, und
 * tritt beiseite, sobald er nach oben rollt, um Geschichte zu lesen.
 *
 * ── WARUM ES DREI ANLAEUFE GEBRAUCHT HAT ────────────────────────────────────
 *
 * (1) Der erste Regler beantwortete „ist der Nutzer weggerollt?" mit einem
 *     `IntersectionObserver` auf einem Sentinel plus einem Einweg-Flag
 *     `_ignoreNextScroll`. Beide Haelften waren auf dieselbe Art falsch: sie
 *     sind ASYNCHRONE Antworten auf eine synchrone Frage. Der Observer meldet
 *     einen Frame zu spaet, und ein einziges `scrollTo({behavior:'smooth'})`
 *     erzeugt Dutzende Ereignisse, von denen das Flag genau EINES schluckte.
 *     Zusammen rasteten sie `userScrolledUp = true` ein und liessen nie wieder
 *     los.
 *
 * (2) Der zweite fragte das Element direkt und ergaenzte eine Nachlauf-Schleife
 *     fuer den wandernden Boden. Richtig gedacht — aber `_performScroll` startete
 *     ein WEICHES Rollen und setzte im selben Frame `scrollTop` hart. Ein
 *     programmatischer Schreibzugriff bricht eine laufende Smooth-Animation ab;
 *     die weiche Bewegung kam also nie zustande. Der Nutzer sah, was er meldete:
 * (Wortlaut nicht wiedergegeben).
 *
 * (3) Dieser hier. Er folgt dem, was sich fuer Streaming-Verlaeufe durchgesetzt
 *     hat (`use-stick-to-bottom`, StackBlitz), und zwar in vier Punkten:
 *
 *     a) EINE Schleife statt Animation + Nachlauf. Das Ziel wird in JEDEM Frame
 *        neu gelesen. `scrollTo({behavior:'smooth'})` merkt sich sein Ziel beim
 *        Start — bei Inhalt, der waehrend der Bewegung waechst, endet es
 *        zwangslaeufig zu kurz. Deshalb hier eine Feder: Beschleunigung aus dem
 *        AKTUELLEN Abstand, Frame fuer Frame.
 *
 *     b) Der eigene Rollbefehl wird MARKIERT, nicht erraten. Wir merken uns den
 *        Wert, den wir gerade geschrieben haben; ein Scroll-Ereignis mit genau
 *        diesem Wert ist unseres. Die alte Heuristik („nur nach oben zaehlt als
 *        Absicht") bleibt als zweite Linie fuer alles, was wir nicht geschrieben
 *        haben.
 *
 *     c) Scroll-Anchoring machen wir SELBST. Der Browser darf es nicht: Safari
 *        kennt `overflow-anchor` gar nicht, und wo es existiert, haelt es
 *        irgendein sichtbares Element fest statt des Endes — genau der Sprung
 *        „ein paar Nachrichten nach oben". `.feed` traegt deshalb
 *        `overflow-anchor: none`.
 *
 *     d) Der `ResizeObserver` haengt am INHALT, nicht am Behaelter. Der
 *        Behaelter ist `flex: 1`, seine Hoehe kommt vom Elternelement und
 *        aendert sich nicht, wenn der Inhalt waechst — ein Observer auf ihm
 *        wartet auf ein Ereignis, das bauartbedingt nie eintritt.
 *
 * Verwendung:
 *   protected firstUpdated() {
 *     this._scroll.attach(
 *       this.renderRoot.querySelector('.feed'),
 *       this.renderRoot.querySelector('.feed__content'),
 *     );
 *   }
 */

import type { ReactiveController, ReactiveControllerHost } from 'lit';

/**
 * Wie weit ueber der letzten Zeile noch als „liest das Neueste" gilt, in Pixeln.
 * Nicht null: Subpixel-Layout, die Rundung einer Bildlaufleiste und das untere
 * Polster lassen ein paar Pixel uebrig, die kein Mausrad je erzeugt hat.
 */
const BOTTOM_SLACK = 64;

/**
 * Wie weit die Ansicht nach oben wandern muss, damit es als Absicht zaehlt.
 * Ein Pixel ist Rundung, das hier ist eine Bewegung.
 */
const UPWARD_INTENT = 8;

/**
 * Federkonstanten. `stiffness` zieht zum Ziel, `damping` bremst, `mass` traegt.
 * Bewusst weich: die Bewegung soll einer wachsenden Antwort folgen koennen,
 * ohne zu schwingen. Werte in der Groessenordnung von `use-stick-to-bottom`.
 */
const SPRING_STIFFNESS = 0.05;
const SPRING_DAMPING = 0.7;
const SPRING_MASS = 1.25;

/** Naeher als das gilt als angekommen (px). */
const ARRIVAL_EPSILON = 0.5;

/**
 * So viele Frames muss die Hoehe stehen, bevor die Schleife aufhoert. Ohne das
 * endet sie in der Luecke zwischen zwei nachgeladenen Bildern.
 */
const STABLE_FRAMES = 3;

/**
 * Notbremse. Eine Antwort streamt laenger als das, aber dann wird die Schleife
 * ohnehin bei jedem neuen Inhalt frisch angestossen. Verhindert, dass ein
 * pathologischer Fall ewig einen Frame pro Bild verbraucht.
 */
const MAX_FRAMES = 600;

/** Die Bewegungseinstellung der Plattform gilt fuer jedes animierte Rollen. */
function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export class ScrollController implements ReactiveController {
  /** Ob die neueste Nachricht in Reichweite ist. */
  isAtBottom = true;

  /** Ob jemand nach oben gerollt hat, um zu lesen (sperrt das Nachfuehren). */
  userScrolledUp = false;

  private _host: ReactiveControllerHost;
  private _container: HTMLElement | null = null;
  private _content: HTMLElement | null = null;
  private _lastScrollTop = 0;
  private _resizeObserver: ResizeObserver | null = null;

  /** Laufender Frame der Feder-Schleife, oder null. */
  private _frame: number | null = null;

  /** Ob die laufende Schleife ohne Animation arbeitet (Streaming, Erstladung). */
  private _instant = false;

  /** Aktuelle Geschwindigkeit der Feder, in px/Frame. */
  private _velocity = 0;

  /**
   * Der zuletzt von UNS geschriebene `scrollTop`. Ein Scroll-Ereignis mit genau
   * diesem Wert stammt aus unserer Feder und ist keine Absicht eines Menschen.
   */
  private _ownScrollTop: number | null = null;

  /** Angefordertes Nachfuehren — gesetzt in requestAutoScroll, verbraucht in hostUpdated. */
  private _pendingBehavior: ScrollBehavior | null = null;

  constructor(host: ReactiveControllerHost) {
    this._host = host;
    host.addController(this);
  }

  // --- Lebenszyklus -----------------------------------------------------

  hostDisconnected(): void {
    this._teardown();
  }

  hostUpdated(): void {
    // Nur rollen, wenn es ausdruecklich angefordert wurde — ein Reaktions-Chip
    // darf die Ansicht nicht bewegen.
    if (this._pendingBehavior && !this.userScrolledUp && this._container) {
      const behavior = this._pendingBehavior;
      this._pendingBehavior = null;
      this._start(behavior === 'instant');
    }
  }

  // --- Oeffentliche Schnittstelle ---------------------------------------

  /**
   * Bindet den rollenden Behaelter und — wichtig — sein INHALTS-Element.
   *
   * Ohne das zweite Argument fehlt die Wachstumserkennung: der Behaelter ist
   * `flex: 1` und aendert seine Kastengroesse nie.
   */
  attach(el: Element | null | undefined, content?: Element | null): void {
    if (!el) return;
    if (el === this._container && (content ?? null) === this._content) return;

    this._detachContainer();
    this._container = el as HTMLElement;
    this._content = (content as HTMLElement | null) ?? null;
    this._lastScrollTop = this._container.scrollTop;
    this._container.addEventListener('scroll', this._onScroll, { passive: true });

    /*
     * Ein `<img>` ohne bekannte Groesse ist im Augenblick des Rollens 0 px hoch
     * und waechst erst mit seinen Bytes. `load` steigt nicht auf, wird also in
     * der ERFASSUNGS-Phase gehoert — und nur, solange die Ansicht angeheftet
     * ist: wer Geschichte liest, will nicht von einem Bild ans Ende gerissen
     * werden.
     */
    this._container.addEventListener('load', this._onContentGrew, { capture: true });

    if (typeof ResizeObserver === 'function') {
      this._resizeObserver = new ResizeObserver(this._onContentGrew);
      // Der Inhalt, weil nur er waechst. Der Behaelter zusaetzlich, weil eine
      // Fenster- oder Panelaenderung `clientHeight` verschiebt und damit, wo
      // „unten" ueberhaupt liegt.
      if (this._content) this._resizeObserver.observe(this._content);
      this._resizeObserver.observe(this._container);
    }
  }

  /** Rollt zur neuesten Nachricht und heftet die Ansicht wieder an. */
  scrollToBottom(behavior: ScrollBehavior = 'smooth'): void {
    this.userScrolledUp = false;
    this.isAtBottom = true;
    this._start(behavior === 'instant');
    this._host.requestUpdate();
  }

  /** Ohne Animation ans Ende. */
  snapToBottom(): void {
    this.scrollToBottom('instant');
  }

  /**
   * Fordert ein Nachfuehren fuer den naechsten `hostUpdated()`-Durchlauf an, damit
   * das DOM steht, bevor sich etwas bewegt.
   *
   * `'instant'` fuer Inhalt, der laufend waechst (ein streamender Text);
   * `'smooth'` fuer einzelne Ereignisse, etwa eine ankommende Nachricht.
   */
  requestAutoScroll(behavior: ScrollBehavior = 'smooth'): void {
    // Wer „sofort" verlangt, folgt lebendem Inhalt und darf nicht animiert
    // werden — das schlaegt ein wartendes „glatt".
    if (this._pendingBehavior === 'instant' && behavior !== 'instant') return;
    this._pendingBehavior = behavior;
  }

  /** Abstand in px zwischen der jetzigen Lage und dem Ende. */
  get distanceFromBottom(): number {
    const el = this._container;
    if (!el) return 0;
    return el.scrollHeight - el.scrollTop - el.clientHeight;
  }

  // --- Innenleben -------------------------------------------------------

  /** Wohin gerollt werden soll — in JEDEM Frame neu, denn der Boden wandert. */
  private get _target(): number {
    const el = this._container;
    if (!el) return 0;
    return Math.max(0, el.scrollHeight - el.clientHeight);
  }

  /** Schreibt eine Position und merkt sie sich als die eigene. */
  private _write(top: number): void {
    const el = this._container;
    if (!el) return;
    el.scrollTop = top;
    // Zurueckgelesen, nicht angenommen: der Browser begrenzt auf das Maximum,
    // und nur der begrenzte Wert taucht spaeter im Ereignis auf.
    this._ownScrollTop = el.scrollTop;
    this._lastScrollTop = el.scrollTop;
  }

  /**
   * Startet die Feder-Schleife. Laeuft schon eine, wird sie nur umgestellt —
   * zwei Schleifen wuerden sich gegenseitig ueberschreiben.
   */
  private _start(instant: boolean): void {
    if (!this._container) return;
    this._instant = instant || prefersReducedMotion();
    if (this._frame !== null) return;

    let quiet = 0;
    let total = 0;
    let lastHeight = -1;

    const step = (): void => {
      const el = this._container;
      if (!el || this.userScrolledUp || total++ >= MAX_FRAMES) {
        this._stop();
        return;
      }

      const height = el.scrollHeight;
      const target = this._target;
      const diff = target - el.scrollTop;

      if (this._instant) {
        if (diff !== 0) this._write(target);
      } else {
        // Feder: Beschleunigung aus dem AKTUELLEN Abstand. Genau das ist der
        // Unterschied zu `scrollTo({behavior:'smooth'})`, dessen Ziel beim
        // Start feststeht und einen wachsenden Boden nie einholt.
        this._velocity = (SPRING_DAMPING * this._velocity + SPRING_STIFFNESS * diff) / SPRING_MASS;
        if (Math.abs(diff) <= ARRIVAL_EPSILON) {
          this._write(target);
          this._velocity = 0;
        } else {
          this._write(el.scrollTop + this._velocity);
        }
      }

      const angekommen = Math.abs(this._target - el.scrollTop) <= ARRIVAL_EPSILON;
      if (height === lastHeight && angekommen) {
        if (++quiet >= STABLE_FRAMES) {
          this._stop();
          return;
        }
      } else {
        quiet = 0;
        lastHeight = height;
      }

      this._frame = requestAnimationFrame(step);
    };

    this._frame = requestAnimationFrame(step);
  }

  private _stop(): void {
    if (this._frame !== null) cancelAnimationFrame(this._frame);
    this._frame = null;
    this._velocity = 0;
  }

  private readonly _onScroll = (): void => {
    const el = this._container;
    if (!el) return;

    const current = el.scrollTop;
    const previous = this._lastScrollTop;
    this._lastScrollTop = current;

    const wasAtBottom = this.isAtBottom;
    const wasScrolledUp = this.userScrolledUp;

    const distance = el.scrollHeight - current - el.clientHeight;
    this.isAtBottom = distance <= BOTTOM_SLACK;

    // Unser eigener Schreibzugriff. Er darf die Heftung weder loesen noch
    // setzen — er ist keine Aussage ueber einen Menschen.
    const eigenes = this._ownScrollTop !== null && current === this._ownScrollTop;
    this._ownScrollTop = null;

    if (this.isAtBottom) {
      // Wieder in Reichweite — per Rad, per Knopf oder weil die Feder ankam.
      this.userScrolledUp = false;
    } else if (!eigenes && current < previous - UPWARD_INTENT) {
      // Weg vom Ende UND nach oben unterwegs, und nicht von uns geschrieben.
      // Wachsender Inhalt kann das nicht, ein Rollen zum Ende auch nicht.
      this.userScrolledUp = true;
      this._stop();
    }

    if (wasAtBottom !== this.isAtBottom || wasScrolledUp !== this.userScrolledUp) {
      this._host.requestUpdate();
    }
  };

  /**
   * Der Inhalt hat sich bewegt (ein Bild, eine Groesse, eine gerenderte
   * Kachel). Stand die Ansicht am Ende, muss sie dort BLEIBEN — ohne
   * Animation, denn hier wird nichts verfolgt, hier wird eine Position
   * gehalten.
   */
  private readonly _onContentGrew = (): void => {
    if (this.userScrolledUp || !this._container) return;
    this._start(true);
  };

  private _detachContainer(): void {
    this._stop();
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    this._container?.removeEventListener('scroll', this._onScroll);
    this._container?.removeEventListener('load', this._onContentGrew, { capture: true });
  }

  private _teardown(): void {
    this._detachContainer();
    this._container = null;
    this._content = null;
  }
}
