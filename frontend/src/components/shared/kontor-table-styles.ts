import { css } from 'lit';

/**
 * KONTOR — die Tabellen-Primitive des Kostenpanels.
 *
 * Die Tabelle traegt vier der fuenf Ebenen des Panels; alles, was hier
 * schiefgeht, geht an jeder Zelle schief. Deshalb steht sie als Stilmodul und
 * nicht in einem Bauteil.
 *
 * ── DIE SECHS ENTSCHEIDUNGEN, DIE SIE AUSMACHEN ─────────────────────────────
 *
 * 1. **`min-height`, nie `height`.** Die Zeile ist 28 hoch und wird 42, wenn
 *    die Zaehlbasis (`n = 512 von 640`) darunter steht. Eine feste Hoehe
 *    schneidet sie ab — und die Zaehlbasis ist das Versprechen des Panels.
 *
 * 2. **Trenner als `box-shadow: inset 0 1px`, nicht als `border`.** Ein
 *    Rahmenstrich belegt Platz im Box-Modell: er ergibt Doppellinien an
 *    aneinanderstossenden Zeilen und laesst einen `position: sticky`-Kopf beim
 *    Scrollen um genau diesen einen Pixel springen. Stripes Weg.
 *
 * 3. **Kein Zebra.** Keines der sechs untersuchten Produkte (Linear, Stripe,
 *    Vercel, Grafana, Sentry, PostHog) hat welches. Ein Wechselgrund macht
 *    aus jedem Grund zwei und verdoppelt jede Kontrastfrage.
 *
 * 4. **Hover unter 1,15 : 1 und ohne Versatz.** `--color-row-hover` misst
 *    1,057–1,074. Eine Zeile, die sich hebt, verschiebt die Zahlenspalten
 *    unter dem Zeiger; Knoepfe duerfen weiter liften, Zeilen nicht.
 *
 * 5. **Feste Text- und Betragsspalten, genau EINE elastische.** Die Balken-
 *    spalte waechst, alle anderen stehen. Sonst wandert die Betragsspalte bei
 *    jedem Datenwechsel.
 *
 * 6. **Alle sechs Zellzustaende belegen dieselbe Breite.** Die Spalte springt
 *    nicht, wenn eine Zeile von „gemessen" auf „nicht erfasst" wechselt —
 *    getragen wird der Unterschied von Zeichen und Helligkeit, nicht von Platz.
 *
 * ── DIE TINTENLEITER DER ZUSTAENDE, UND EINE MESSUNG DAGEGEN ────────────────
 *
 * Der Entwurf staffelt die Zustaende ueber vier Tintenstufen:
 *
 *     gemessen · echte Null   volle Tinte      --color-text-primary
 *     geschaetzt              eine Stufe zurueck --color-text-secondary
 *     · und —                 Zeichentinte     --color-text-glyph
 *     ░                       Zeichentinte auf der Schraffur
 *
 * ⚠ **Die letzte Zeile haelt nicht.** Gemessen am 05.09.2026:
 *
 *     --color-text-glyph  auf --color-hatch-bg   2,55 (dunkel) · 2,74 (Papier)
 *     --color-text-muted  auf --color-hatch-bg   3,83 (dunkel) · 3,96 (Papier)
 *     --color-text-secondary                     5,19 (dunkel) · 5,98 (Papier)
 *
 * Die Zeichentinte faellt auf der Schraffur sogar unter die 3 : 1 fuer
 * bedeutungstragende Zeichen (SC 1.4.11) — sie ist gegen den SEITENgrund
 * getunt, und die Schraffur ist ein vierter Grund. `--color-text-muted`
 * faellt unter die 4,5 fuer Satz. **Auf der Schraffur steht Sekundaertinte.**
 *
 * Genau davor warnt `TODO-OPUS.md` §6.4 („legt man sie zusammen, wird
 * entweder der Sammelbalken unsichtbar oder der Satz auf der Schraffur
 * unlesbar") — hier in einer dritten Gestalt, die dort nicht benannt ist: das
 * ZEICHEN auf seiner eigenen Schraffur.
 *
 * Deshalb setzt `.kontor-cell--unrecorded` Schraffur UND Tinte in DERSELBEN
 * Regel. Die Paarung ist an der Verwendungsstelle nicht trennbar, und
 * `scripts/lint-series-palette-grounds.mjs` (Teil 3) misst sie aus dieser
 * Datei nach.
 */

/**
 * Tier 3 — die Masse der Tabelle, einmal benannt.
 *
 * Als eigener Export, damit ein Bauteil sie ueberschreiben kann, ohne die
 * Regeln zu kopieren (die Aufschluesselungen stehen enger als die Haupttabelle).
 */
export const kontorTableTokens = css`
  :host {
    /* Zeilenhoehe als Mindestmass. Siehe Entscheidung 1. */
    --_kontor-row-min: 28px;
    /* Polsterung: 6 vertikal, 10 horizontal — ergibt mit 16px Zeilenhoehe
       genau die 28. Ein kleinerer Wert laesst min-height greifen und die
       Zeilen sehen dann verschieden gepolstert aus, obwohl sie gleich hoch
       sind. */
    --_kontor-pad-y: var(--space-1-5);
    --_kontor-pad-x: var(--space-2-5);
    /* Die Betragsspalte. Am laengsten Wert reserviert, nicht am laufenden
       Inhalt — sonst springt sie beim Sortieren. */
    --_kontor-amount-w: 140px;
    /* Die Textspalte links. Fest, damit die Balkenspalte die einzige
       elastische bleibt. */
    --_kontor-label-w: 240px;
    /*
     * Die Untergrenze der Datenregion.
     *
     * ⚠ NICHT --text-xs. Das steht auf 0.64rem = 10,24 px, und die
     * kleinste in Daten branchenweit eingesetzte Groesse ist 11 px (Linear,
     * Stripe, Vercel, Grafana, Sentry, PostHog — alle sechs bei 11 oder
     * darueber). Der Plattform-Token liegt darunter, und die Zaehlbasis
     * n = 512 von 640 ist keine Randnotiz, sondern die Aussage, an der das
     * ganze Panel haengt.
     *
     * Als Tier-3-Token und nicht als Rohwert an drei Stellen: der Wert ist
     * eine gemessene Untergrenze, kein Abstandsschritt, und es gibt im
     * Bestand keinen Token, der ihn trifft. Wer ihn senkt, senkt ihn hier
     * einmal und sieht dabei, warum er dasteht.
     */
    --_kontor-micro: 11px;
  }
`;

export const kontorTableStyles = css`
  .kontor-table {
    width: 100%;
    /*
     * Feste Aufteilung, nicht inhaltsgetrieben.
     *
     * ⚠ Ohne sie summieren sich die festen Spaltenbreiten ueber die Breite der
     * Tabelle hinaus, und die letzte Spalte wird abgeschnitten -- im Browser
     * am 05.09.2026 gemessen: 200 + 3 x 110 = 530 px in einem Abschnitt von
     * 470 px, die Spalte „ohne Betrag" stand halb ausserhalb.
     *
     * Und sie ist ohnehin die richtige Wahl: bei auto bestimmt der INHALT
     * die Spaltenbreite, also springen die Spalten bei jedem Datenwechsel --
     * genau das, was die Zellzustaende gleicher Breite verhindern sollen.
     * Mit fixed bekommen die Betragsspalten ihre Breite und die Textspalte
     * den Rest.
     */
    table-layout: fixed;
    /* separate + 0: Voraussetzung dafuer, dass box-shadow als Trenner
       ueberhaupt sichtbar ist. Mit collapse zeichnet der Browser die
       Zellraender zusammen und verschluckt den Schatten. */
    border-collapse: separate;
    border-spacing: 0;
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    /* Auf die ganze Tabelle, nicht nur auf die Zahlenspalten: auch Datum und
       Uhrzeit driften ohne sie. Sieben Ziffern wandern bei 13 px sonst um
       25,4 px. */
    font-variant-numeric: tabular-nums;
    color: var(--color-text-primary);
  }

  .kontor-table__head th {
    padding: var(--_kontor-pad-y) var(--_kontor-pad-x);
    font-family: var(--font-brutalist);
    font-size: var(--_kontor-micro);
    font-weight: var(--font-bold);
    text-transform: var(--label-transform);
    letter-spacing: var(--label-tracking);
    color: var(--color-text-secondary);
    text-align: left;
    white-space: nowrap;
    background: var(--color-surface-raised);
    /* Der Kopf steht beim Scrollen. -1px, damit der Strich UNTER dem Kopf
       liegt und nicht unter der ersten Zeile — sonst stehen dort zwei. */
    position: sticky;
    top: 0;
    z-index: var(--z-raised);
    box-shadow: inset 0 -1px var(--color-border);
  }

  .kontor-table__head th[aria-sort] {
    cursor: pointer;
    user-select: none;
  }

  .kontor-table__head th[aria-sort]:focus-visible {
    outline: var(--ring-focus);
    outline-offset: -2px;
  }

  /* Die Sortiermarke. Eine Spalte zur Zeit, zwei Zustaende — kein dritter
     „unsortiert". Als Zeichen und nicht als Icon, weil sie dieselbe
     Zeichenbreite braucht wie die Zahlen darunter. */
  .kontor-table__sort {
    color: var(--color-primary);
    padding-left: var(--space-1);
  }

  .kontor-table__body tr {
    min-height: var(--_kontor-row-min);
    /* Entscheidung 2: der Trenner belegt keinen Platz. */
    box-shadow: inset 0 1px var(--color-border-light);
    transition: background var(--transition-fast);
  }

  /* Entscheidung 4: Farbe, kein Versatz. Kein transform, kein translate. */
  .kontor-table__body tr:hover {
    background: var(--color-row-hover);
  }

  .kontor-table__body td {
    padding: var(--_kontor-pad-y) var(--_kontor-pad-x);
    min-height: var(--_kontor-row-min);
    vertical-align: baseline;
  }

  /* ── Die Spaltenrollen ──────────────────────────────────────────────────
     Genau eine waechst. Siehe Entscheidung 5. */

  /*
   * Die Textspalte ist die einzige mit auto: unter table-layout: fixed
   * bekommt sie damit den Rest, den die Betragsspalten uebriglassen. Ein
   * fester Wert hier war der Grund fuer die abgeschnittene letzte Spalte.
   * --_kontor-label-w bleibt als MINDESTmass.
   */
  .kontor-col--label {
    width: auto;
    min-width: var(--_kontor-label-w);
    text-align: left;
    /* Ein Modell-Slug ist laenger als die Spalte und darf sie nicht dehnen. */
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .kontor-col--amount {
    width: var(--_kontor-amount-w);
    min-width: var(--_kontor-amount-w);
    text-align: right;
    /* Die Dezimalpunkte stehen dadurch NICHT untereinander. Absicht: die
       Alternative laesst die Spalte rechts ausfransen, und rechts steht die
       Groessenordnung, auf die es ankommt. */
    white-space: nowrap;
  }

  /* Die einzige elastische Spalte. */
  .kontor-col--bar {
    width: auto;
  }

  /* ── Die sechs Zellzustaende ────────────────────────────────────────────
     Alle auf derselben Breite (die der Betragsspalte), damit die Spalte beim
     Datenwechsel nicht springt. */

  .kontor-cell {
    display: block;
    min-width: var(--_kontor-amount-w);
    text-align: right;
  }

  .kontor-cell--measured,
  .kontor-cell--zero {
    color: var(--color-text-primary);
  }

  .kontor-cell--estimated {
    color: var(--color-text-secondary);
  }

  .kontor-cell--below,
  .kontor-cell--na {
    color: var(--color-text-glyph);
  }

  /*
   * ⚠ SCHRAFFUR UND TINTE STEHEN IN EINER REGEL. Getrennt gesetzt faellt die
   * Tinte auf der Schraffur durch — die Zeichentinte misst dort 2,55 : 1.
   * Sekundaertinte misst 5,19 und traegt.
   *
   * Die Schraffur laeuft ueber die ganze Zelle, nicht nur hinter dem Zeichen:
   * der Zustand gehoert der ZEILE, und ein Kaestchen um ein Zeichen sieht aus
   * wie eine Auszeichnung.
   */
  .kontor-cell--unrecorded {
    color: var(--color-text-secondary);
    background-image: repeating-linear-gradient(
      135deg,
      var(--color-hatch-bg) 0 1px,
      transparent 1px 6px
    );
  }

  /*
   * Die Zellzustaende in der LEGENDE.
   *
   * Dort ist eine Zelle ein Zeichen, keine Spalte: die Mindestbreite der
   * Betragsspalte macht aus der Schraffur sonst einen breiten Balken, und das
   * Zeichen sitzt verloren an dessen rechtem Rand. Im Browser gesehen -- es
   * las sich als Diagrammelement, nicht als Notation.
   */
  .kontor-legend__probe .kontor-cell {
    display: inline-block;
    min-width: 0;
    padding: 0 var(--space-1);
  }

  /* ── Die Zaehlbasis ─────────────────────────────────────────────────────
     Sie ist der Grund, warum die Zeile 42 hoch werden darf. */

  .kontor-basis {
    display: block;
    font-size: var(--_kontor-micro);
    color: var(--color-text-muted);
    /* Umbruch ist der stille Hoehenfresser: zwei Zeilen Zaehlbasis statt
       einer haben den Entwurf dreimal ueber die Artboard-Hoehe geschoben. */
    white-space: nowrap;
  }

  /* ── Sammelzeilen ───────────────────────────────────────────────────────
     „Sonstige" und „ohne Angabe" sind keine Gruppen, sondern Restbestaende.
     Sie stehen in BEIDEN Sortierrichtungen am Ende und klappen nicht auf. */

  .kontor-row--collector td {
    color: var(--color-text-secondary);
  }

  .kontor-row--collector .kontor-col--label {
    font-style: italic;
  }

  /* ── Aufgeklappte Zeile ─────────────────────────────────────────────────
     Genau EINE Ebene. Mehr ist in keinem der sechs untersuchten Produkte
     dokumentiert, und die zweite Ebene hat keine Spaltenkoepfe mehr. */

  .kontor-row--expanded {
    background: var(--color-surface-sunken);
  }

  .kontor-detail td {
    padding: 0;
    background: var(--color-surface-sunken);
  }

  .kontor-detail__inner {
    padding: var(--space-2) var(--_kontor-pad-x) var(--space-3);
    /* Die Einzelaufrufe haben ihre EIGENE, feste Ordnung (Zeit absteigend)
       und erben die Sortierung der Gruppenebene nicht. */
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  /* ── Der Balken in der Zelle ────────────────────────────────────────────
     Er kodiert — anders als ein Icon neben dem Modellnamen. Deshalb bleibt er,
     obwohl das Panel sonst schmucklos ist. */

  .kontor-bar {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    justify-content: flex-end;
  }

  .kontor-bar__track {
    flex: 1;
    min-width: 0;
    height: 8px;
    background: var(--color-surface-sunken);
  }

  .kontor-bar__fill {
    height: 100%;
    background: var(--color-series-text);
  }

  .kontor-bar__fill--image {
    background: var(--color-series-image);
  }

  /* Der Sammelbalken „ohne Angabe": eine Fuellung, die gesehen werden muss
     (3 : 1) — ausdruecklich NICHT --color-hatch-bg, das ist die Textur
     hinter Satz und misst 1,4. */
  .kontor-bar__fill--unrecorded {
    background: var(--color-hatch);
  }

  @media (prefers-reduced-motion: reduce) {
    .kontor-table__body tr {
      transition-duration: 0.01ms;
    }
  }
`;
