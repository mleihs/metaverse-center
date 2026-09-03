/**
 * ATLAS — das Vokabular der Blattflaeche.
 *
 * Der Atlas-Skin ist mehr als eine Palette. Landing und Dashboard bekommen
 * eigene Layout-Vorlagen, weil ein Skin dort laut Design-Paket "nur 70 % der
 * Wirkung" bringt: das Papier braucht ein Vermessungsraster, Blattkoepfe, ein
 * einheitliches Hover-Vokabular und zwei Lebenszeichen (Pulspunkt,
 * Scan-Streifen). Diese Dinge gehoeren KEINER der beiden Vorlagen allein --
 * deshalb stehen sie hier und nicht in landing/ oder dashboard/.
 *
 * WARUM SHARED UND NICHT LANDING
 *   Die Rasterlinien liegen hinter den Blaettern der Landing und hinter den
 *   Bannern des Dashboards. Der Pulspunkt sitzt in der Befehlsleiste des
 *   Dashboards und in der Meta-Zeile des Heros. Zweimal gebaut waeren sie beim
 *   ersten Nachschaerfen auseinandergelaufen, und der Unterschied waere
 *   unsichtbar geblieben -- beide haetten weiter gepulst.
 *
 * WARUM DAS ALLES POLARITAETSGEBUNDEN IST UND NICHT SKIN-GEBUNDEN
 *   Kein Selektor fragt hier nach dem Skin. Das Raster nimmt --color-grid, das
 *   von --color-text-primary abgeleitet ist; der Scan-Streifen haengt an
 *   --theme-polarity, das ThemeService aus der gemessenen Helligkeit des
 *   Grundes schreibt (0 dunkel, 1 hell). Ein Modul, das stattdessen
 *   [data-skin=atlas] abfragte, waere auf dem Dark-Skin einfach aus -- und in
 *   einer HELLEN Simulationswelt, die es auch gibt, faelschlich ebenfalls.
 *   Polaritaet ist die Frage, die diese Effekte wirklich stellen.
 *
 * ES GIBT KEINE BACKTICKS IN DIESEN KOMMENTAREN.
 *   Ein Backtick beendet das css-Template, und biome zerlegt danach den
 *   gesamten Block zu JavaScript, ohne zu klagen. Das Tor
 *   scripts/lint-backtick-in-css.mjs faengt es; in dieser Sitzung zweimal.
 */

import { css } from 'lit';

/**
 * Das Vermessungsraster als Hintergrund einer Blattflaeche.
 *
 * Auf .sheet-grid gelegt, nicht auf den Wirt: das Raster braucht einen eigenen
 * Knoten, weil es hinter dem Inhalt liegt und der Inhalt seinen eigenen Grund
 * behalten soll. Als ::before auf dem Wirt haette es einen Stapelkontext
 * verlangt, und die Regel dieses Projekts verbietet genau das auf
 * Layout-Behaeltern -- ein neuer Enthaltungskontext bricht position: fixed in
 * Modalen.
 */
export const atlasGridStyles = css`
  .sheet-grid {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    background-image:
      linear-gradient(var(--color-grid) 1px, transparent 1px),
      linear-gradient(90deg, var(--color-grid) 1px, transparent 1px);
    background-size: var(--grid-size) var(--grid-size);
  }

  /* Auf einem dunklen Grund ist das Raster ein Rauschen, kein Papier: die
     Linien leuchten, statt zu vertiefen. --theme-polarity ist 0 auf dunkel und
     1 auf hell, also blendet dieselbe Deklaration es dort aus, ohne dass ein
     Selektor den Skin kennen muss. */
  .sheet-grid {
    opacity: calc(var(--theme-polarity, 0) * 0.9);
  }

  @media (prefers-reduced-transparency: reduce) {
    .sheet-grid {
      display: none;
    }
  }
`;

/**
 * Der Blattkopf: eine Mono-Zeile aus Nummer und Titel ueber dem Inhalt.
 *
 * Bis 900 px stapelt sie ueber den Inhalt statt daneben zu stehen (Vorgabe des
 * Pakets). Der Haltepunkt ist eine Container-Abfrage, keine Medienabfrage: das
 * Blatt kann in einer engen Spalte stehen, und dann zaehlt seine eigene Breite,
 * nicht die des Fensters.
 */
export const atlasSheetHeadStyles = css`
  .sheet-head {
    container-type: inline-size;
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    margin-bottom: var(--space-6);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    text-transform: var(--label-transform);
    letter-spacing: var(--label-tracking);
    color: var(--color-text-muted);
  }

  .sheet-head__no {
    flex: 0 0 auto;
    color: var(--color-primary);
  }

  /* Ein Strich, der den Rest der Zeile ausfuellt -- die Nummerierung einer
     Kartenmappe, nicht eine Ueberschrift. */
  .sheet-head__rule {
    flex: 1 1 auto;
    height: 1px;
    background: var(--color-border-light);
  }

  @container (max-width: 900px) {
    .sheet-head {
      flex-wrap: wrap;
      row-gap: var(--space-1);
    }

    .sheet-head__rule {
      flex-basis: 100%;
    }
  }
`;

/**
 * Das Hover-Vokabular, einmal fuer alles.
 *
 * Vier Bewegungen, laut Paket ueberall dieselben: Pfeil-Links oeffnen ihre
 * Luecke, Knoepfe heben sich 2 px, Karten heben sich 4 px und werfen einen
 * harten Schatten, Bilder zoomen 5 %.
 *
 * TOUCH SCHALTET SIE AUS, NICHT AB.
 *   Auf einem Geraet ohne Zeiger bleibt ein Hover-Zustand haengen, nachdem man
 *   getippt hat -- die Karte bleibt gehoben, bis man woanders tippt. Deshalb
 *   sitzt das ganze Vokabular in einer (hover: hover)-Abfrage und Touch
 *   bekommt stattdessen :active mit scale(.98): eine Rueckmeldung, die mit dem
 *   Finger endet.
 */
export const atlasHoverStyles = css`
  @media (hover: hover) {
    .atlas-arrow {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: gap var(--transition-normal), color var(--transition-fast);
    }

    .atlas-arrow:hover,
    .atlas-arrow:focus-visible {
      gap: 12px;
      color: var(--color-text-primary);
    }

    .atlas-lift-sm {
      transition: transform var(--transition-fast), box-shadow var(--transition-fast);
    }

    .atlas-lift-sm:hover,
    .atlas-lift-sm:focus-visible {
      transform: translateY(-2px);
      box-shadow: var(--shadow-sm);
    }

    .atlas-lift {
      transition: transform var(--transition-normal), box-shadow var(--transition-normal);
    }

    .atlas-lift:hover,
    .atlas-lift:focus-visible {
      transform: translateY(-4px);
      box-shadow: 6px 6px 0 var(--color-shadow);
    }

    /* Der Zoom sitzt auf dem BILD, der Beschnitt auf dem Rahmen darum. Auf dem
       Rahmen selbst waere transform ein neuer Enthaltungskontext -- verboten
       auf Layout-Behaeltern, und hier auch unnoetig. */
    .atlas-zoom {
      overflow: hidden;
    }

    .atlas-zoom img {
      transition: transform 600ms var(--ease-dramatic);
    }

    .atlas-zoom:hover img,
    .atlas-zoom:focus-visible img {
      transform: scale(1.05);
    }
  }

  @media (hover: none) {
    .atlas-lift:active,
    .atlas-lift-sm:active,
    .atlas-arrow:active {
      transform: scale(0.98);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .atlas-arrow,
    .atlas-lift,
    .atlas-lift-sm,
    .atlas-zoom img {
      transition-duration: 0.01ms !important;
    }

    .atlas-lift:hover,
    .atlas-lift-sm:hover,
    .atlas-zoom:hover img {
      transform: none;
    }
  }
`;

/**
 * Zwei Lebenszeichen: der Pulspunkt und der Scan-Streifen.
 *
 * DER PUNKT pulst als Ring von 0 auf 6 px in 2,4 s. Er sagt "das Substrat
 * antwortet" und steht in der Befehlsleiste des Dashboards und in der
 * Meta-Zeile des Heros.
 *
 * DER STREIFEN laeuft ueber Bilder, Zinnober bei 18 %, 96 px Periode, 3,2 s.
 * Er ist ATLAS-spezifisch und haengt deshalb an --theme-polarity, nicht an
 * --glow-strength: ein Glimmen ist er nicht, und eine dunkle Welt mit
 * abgeschaltetem Glow soll ihn auch nicht bekommen.
 *
 * Die Periode nimmt --grid-size, nicht 96 px hart: der Streifen laeuft dann im
 * Takt des Rasters hinter ihm, auch wenn das Raster auf einem Telefon enger
 * steht.
 */
export const atlasSignalStyles = css`
  .atlas-pulse {
    position: relative;
    display: inline-block;
    width: 8px;
    height: 8px;
    flex: 0 0 auto;
    border-radius: var(--border-radius-full);
    background: var(--color-success);
  }

  .atlas-pulse::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: var(--border-radius-full);
    border: 1px solid var(--color-success);
    animation: atlas-pulse-ring 2400ms var(--ease-out) infinite;
  }

  @keyframes atlas-pulse-ring {
    from {
      transform: scale(1);
      opacity: 0.8;
    }
    to {
      transform: scale(2.5);
      opacity: 0;
    }
  }

  .atlas-scan {
    position: relative;
  }

  .atlas-scan::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: var(--theme-polarity, 0);
    background-image: repeating-linear-gradient(
      115deg,
      transparent 0,
      transparent calc(var(--grid-size) - 2px),
      color-mix(in srgb, var(--color-primary) 18%, transparent) calc(var(--grid-size) - 2px),
      color-mix(in srgb, var(--color-primary) 18%, transparent) var(--grid-size)
    );
    background-size: 200% 100%;
    animation: atlas-scan-drift 3200ms linear infinite;
  }

  @keyframes atlas-scan-drift {
    to {
      background-position-x: var(--grid-size);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .atlas-pulse::after {
      animation: none;
      opacity: 0;
    }

    .atlas-scan::after {
      animation: none;
      display: none;
    }
  }
`;

/**
 * Auswahl auf einer Blattflaeche: Tint plus eine Kante UNTEN.
 *
 * Ausdruecklich kein border-left: farbige Kantenstreifen sind in diesem
 * Projekt verboten und werden von scripts/lint-no-accent-edge-bar.sh
 * zurueckgewiesen, in beiden Bauarten. Das Design-Paket nennt dieselbe Regel
 * unter seinen eigenen Tabus.
 */
export const atlasSelectionStyles = css`
  .atlas-cell {
    background: transparent;
    transition: background var(--transition-fast);
  }

  .atlas-cell[aria-selected='true'],
  .atlas-cell[data-active='true'] {
    background: var(--color-surface);
    box-shadow: inset 0 -3px 0 var(--color-primary);
  }

  .atlas-cell:focus-visible {
    outline: none;
    box-shadow: var(--ring-focus);
  }

  .atlas-cell[aria-selected='true']:focus-visible,
  .atlas-cell[data-active='true']:focus-visible {
    box-shadow: inset 0 -3px 0 var(--color-primary), var(--ring-focus);
  }
`;

/** Alle fuenf zusammen, fuer eine Flaeche, die das ganze Vokabular braucht. */
export const atlasSheetStyles = [
  atlasGridStyles,
  atlasSheetHeadStyles,
  atlasHoverStyles,
  atlasSignalStyles,
  atlasSelectionStyles,
];
