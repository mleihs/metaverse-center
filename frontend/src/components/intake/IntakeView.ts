/**
 * Die Schleuse — Shell, Sensor-Leiste und das Vier-Kammern-Board.
 *
 * Schritt 2 aus `handoff/schleuse-event-intake.md`. Eine View, zweimal
 * gemountet: im Simulations-Tab für den Architekten, im Admin-Panel für den
 * Admin. Der Unterschied kommt aus `intakeState.role`, nicht aus einem
 * Attribut — ein falsch gesetztes Prop zeigte einem Architekten sonst den
 * Resonanz-Knopf, und genau der ist der eine Unterschied, der zählt.
 *
 * Breiten, Breakpoints und Container-Queries stehen in
 * `handoff/schleuse-responsive.md` und sind hier umgesetzt: Basis 1280–1599,
 * dann 1600 (Referenz des Prototyps), 1920, 2560. Die ausführliche Begründung
 * zur Breite steht im Kopf des Stilblocks — kurz: die Schleuse ist eine
 * scrollende Arbeitsfläche, kein Cockpit, und die Shell deckelt sie bereits.
 *
 * ── DREI ZUSTÄNDE, ABER NICHT DIE ÜBLICHEN ─────────────────────────────────
 *
 * Ein leeres Board ist kein Fehler und kein „nichts gefunden": es ist die
 * Ruhelage zwischen zwei Scan-Zyklen. Deshalb bekommt jede Kammer ihren
 * eigenen, in ihrer Sprache formulierten Leertext statt eines gemeinsamen
 * `<velg-empty-state>` — „Die Quarantäne ist leer, der nächste Zyklus liefert
 * nach" sagt etwas anderes als „Keine Daten".
 */

import { localized, msg, str } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { intakeState } from '../../services/IntakeStateManager.js';
import { type IntakeSignal, sourceKindOf } from '../../types/intake.js';
import { icons } from '../../utils/icons.js';
import { batchIntegrateQuarantine, batchTransformEntrance } from './intake-batch.js';
import './IntakeCrucibleModal.js';
import './IntakeFlagModal.js';
import './IntakeQuarantineCard.js';
import './IntakeResonanceModal.js';
import './IntakeSensorTile.js';
import './IntakeAftermathChamber.js';
import './IntakeBrowseModal.js';
import './IntakeReadingRoomModal.js';
import './IntakeScanLogModal.js';
import './IntakeTriageModal.js';

/** Wie viele Minuten seit einem ISO-Zeitstempel vergangen sind. */
function minutesSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / 60000));
}

@localized()
@customElement('velg-intake-view')
export class VelgIntakeView extends SignalWatcher(LitElement) {
  static styles = css`
    /*
     * ── BREITE: WARUM KEIN COCKPIT ──────────────────────────────────────
     *
     * Ich hatte die Schleuse zuerst als Cockpit gebaut (volle Breite, Kammern
     * wachsen bis 3840). Das war falsch, und schleuse-responsive.md sagt
     * warum: die Schleuse ist eine SCROLLENDE ARBEITSFLÄCHE mit Fusszeile,
     * kein Cockpit. Sie gehört deshalb NICHT in FULL_HEIGHT_VIEWS
     * (SimulationShell.ts:68 — dort stehen nur chat und dungeon).
     *
     * Damit erledigt die Shell die Begrenzung bereits: .shell__content trägt
     * max-width: var(--stage-measure) und zentriert (SimulationShell.ts:338).
     * Im Simulations-Mount ist die Regel unten also wirkungslos.
     *
     * Sie steht trotzdem da, weil der ADMIN-Mount keine Shell hat. Eine Regel,
     * die in einem Mount trägt und im anderen leerläuft, ist billiger als zwei
     * Mount-abhängige Zweige — und sie kann nicht vergessen werden.
     *
     * ⚠ box-sizing: border-box ist der Kern, nicht Beiwerk: im Schatten-DOM
     * gilt content-box, und dann misst max-width nur den Inhalt. Am
     * 31.08.2026 ist genau das passiert und erst beim Messen im Browser
     * aufgefallen (Kommentar in shared/stage-styles.ts).
     *
     * stage-styles.ts binde ich bewusst NICHT ein, obwohl der Dateiplan es
     * vorsieht: .stage-bleed-row würde seine Polsterung auf die des
     * Shell-Containers addieren (24 px + 48 px), und die Trennlinien laufen
     * ohnehin über die volle Breite dieser View. Zwei Wahrheiten über
     * denselben Rand wären genau das, wovor das Modul bewahren soll.
     */
    :host {
      display: block;
      box-sizing: border-box;
      inline-size: 100%;
      max-inline-size: var(--stage-measure);
      margin-inline: auto;
      background: var(--color-surface);
      color: var(--color-text-primary);
    }

    /*
     * Schriftmasse.
     *
     * --stage-type-scale ist 1 bis 2559 und 1.15 ab 2560 (_layout.css:56).
     * Die Mono-Etiketten tragen zusätzlich eine Untergrenze: 9 px sind bei 4K
     * und 100 % physisch zu klein, und ein reiner Faktor macht sie nicht
     * grösser, solange die Basis klein ist.
     */
    :host {
      --_label: max(9px, calc(var(--text-xs) * var(--stage-type-scale, 1)));
      --_body: calc(var(--text-sm) * var(--stage-type-scale, 1));
      --_title: calc(var(--text-xs) * var(--stage-type-scale, 1));
    }

    .rule {
      border-block-end: var(--border-width-thin) solid var(--color-border-light);
    }

    /* ── Topbar ──────────────────────────────────────────────────────────── */

    .top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      min-block-size: calc(42px * var(--stage-type-scale, 1));
      padding-inline: var(--space-4);
    }

    .crumb {
      font-family: var(--font-mono);
      font-size: var(--_label);
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-muted);
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .crumb strong {
      color: var(--color-text-secondary);
      font-weight: var(--font-normal);
    }

    .top__right {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      flex: none;
    }

    /* Der Rollen-Ausweis: voller Rahmen, keine Kante. */
    .role {
      font-family: var(--font-brutalist);
      font-size: var(--_label);
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
      padding: 2px var(--space-2);
      border: var(--border-width-thin) solid currentColor;
    }
    .role--admin {
      color: var(--color-accent-amber);
    }
    .role--architect {
      color: var(--color-accent-green);
    }

    .status {
      display: flex;
      align-items: center;
      gap: var(--space-1-5);
      font-family: var(--font-mono);
      font-size: var(--_label);
      color: var(--color-text-muted);
    }
    /* Unter 1440 bleibt nur der Punkt und die Zahl. */
    .status__text {
      display: none;
    }
    .status__dot {
      inline-size: 6px;
      block-size: 6px;
      background: var(--color-accent-green);
    }
    .status__dot--off {
      background: var(--color-text-tertiary);
    }

    /* ── Sensor-Leiste ───────────────────────────────────────────────────── */

    .sensors {
      display: grid;
      grid-template-columns: 150px 1fr 150px;
      gap: var(--space-3);
      align-items: start;
      padding: var(--space-3) var(--space-4);
    }

    .sensors__title,
    .quota__label,
    .subs__label {
      font-family: var(--font-brutalist);
      font-size: var(--_title);
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
      color: var(--color-text-primary);
      margin: 0 0 var(--space-1) 0;
    }
    .quota__label,
    .subs__label {
      color: var(--color-text-muted);
    }

    .sensors__note,
    .funnel {
      font-family: var(--font-mono);
      font-size: var(--_label);
      color: var(--color-text-muted);
      line-height: var(--leading-snug);
      margin: 0;
    }

    /*
     * Die einzige Stelle, an der die Anzahl der Quellen die Spaltenzahl setzt.
     * Bis 1599 bricht die Leiste um (schmale Kacheln, zwei Reihen), ab 1600
     * steht sie einreihig — --_n kommt aus der Adapterliste.
     */
    /*
     * Die Leiste UMBRICHT, sie quetscht nicht.
     *
     * Sie stand auf repeat(var(--_n), 1fr) — so viele Spalten wie Adapter.
     * Das hielt bei zehn Kacheln auf 1600 px. Im Admin-Panel ist die
     * Mittelspalte ~810 px breit, und seit dem elften Adapter (Bluesky) blieben
     * 73 px je Kachel: JEDER Name war abgeschnitten (BLUE… DISE… GDAC…), das
     * Klassenwort lief in den Nachbarn.
     *
     * auto-fill mit einer Mindestbreite dreht die Abhängigkeit um: die Zahl
     * der Spalten folgt dem Platz, nicht der Zahl der Adapter. Ein zwölfter
     * Adapter rutscht in die zweite Zeile, statt allen anderen die Namen zu
     * nehmen. 132 px ist gemessen, nicht geraten — der längste Klassenname
     * („strukturiert", 13 Zeichen Mono bei --text-xs) braucht 108 px plus
     * Polsterung.
     */
    .sensors__grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
      gap: var(--space-2);
      align-items: stretch;
    }

    .sensors__right {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: var(--space-2);
    }

    .act {
      font-family: var(--font-brutalist);
      font-size: var(--_label);
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
      min-block-size: 32px;
      padding: var(--space-1-5) var(--space-2);
      border: var(--border-width-thin) solid var(--color-accent-amber);
      background: var(--color-accent-amber);
      color: var(--color-text-inverse);
      cursor: pointer;
      transition: box-shadow var(--transition-fast);
    }
    .act:hover {
      box-shadow: var(--shadow-sm);
    }
    .act:focus-visible {
      outline: none;
      box-shadow: var(--ring-focus);
    }
    .act--ghost {
      background: none;
      color: var(--color-text-secondary);
      border-color: var(--color-border);
    }
    .act--ghost:hover {
      color: var(--color-text-primary);
      border-color: var(--color-text-muted);
    }

    /* Für den Architekten ist der nächste Scan eine Auskunft, kein Knopf. */
    .next {
      font-family: var(--font-mono);
      font-size: var(--_label);
      color: var(--color-text-muted);
      padding: var(--space-1-5) var(--space-2);
      border: var(--border-width-thin) dashed var(--color-border);
      text-align: center;
    }

    /* Grobzeiger (Touch) brauchen 44 px, nicht 32. */
    @media (pointer: coarse) {
      .act,
      .next {
        min-block-size: 44px;
      }
    }

    /* ── Quote und Abonnements ───────────────────────────────────────────── */

    .quota-row {
      display: grid;
      grid-template-columns: 300px 1fr;
      gap: var(--space-4);
      padding: var(--space-3) var(--space-4);
    }

    /* Eigene Steigung: die Quote-Zahl hat Display-Charakter, ein Faktor
       kann nur eine Steigung (_layout.css:45). */
    .quota__value {
      font-family: var(--font-brutalist);
      font-size: clamp(30px, 2.25vw, 44px);
      font-weight: var(--font-bold);
      color: var(--color-accent-amber);
      font-variant-numeric: tabular-nums;
      line-height: var(--leading-none);
    }

    .quota__segs {
      display: flex;
      gap: 3px;
      margin-block: var(--space-2) var(--space-1);
    }
    .quota__seg {
      block-size: 8px;
      flex: 1;
      background: var(--color-border-light);
    }
    .quota__seg--on {
      background: var(--color-accent-amber);
    }

    .quota__foot {
      font-family: var(--font-prose);
      font-style: italic;
      font-size: var(--_label);
      color: var(--color-text-tertiary);
      max-inline-size: 36ch;
      margin: 0;
    }

    /* ── Board ───────────────────────────────────────────────────────────── */

    /*
     * Basis 1280–1599: drei Spalten, der Nachhall wandert unter das Board.
     *
     * Die Quarantäne ist die einzige Kammer, die nicht schrumpfen darf — ihre
     * Karte hat zwei Hälften (Resonanz | Ereignis) und braucht ≥ 400 px
     * Innenbreite. Deshalb minmax statt reiner Bruchteile: bei Bruchteilen
     * schrumpfen alle gleichmässig, und die Hälften kippen als Erstes.
     *
     * Der Nachhall braucht die Höhe nicht, wohl aber die Breite seiner Texte;
     * unten quer ist er lesbar statt gequetscht.
     */
    .board {
      display: grid;
      grid-template-columns: minmax(300px, 1fr) minmax(420px, 1.3fr) minmax(280px, 1fr);
      min-block-size: clamp(560px, 62vh, 940px);
    }

    .chamber {
      /*
       * Container-Query-Anker.
       *
       * Der Admin-Mount hat eine Seitenleiste, der Simulations-Mount nicht —
       * dieselbe Viewport-Breite ergibt zwei verschiedene Kammerbreiten. Was
       * INNERHALB einer Kammer umbricht, darf deshalb nicht am Viewport
       * hängen. Eine Viewport-Abfrage wäre in einem der beiden Mounts immer
       * falsch, und zwar unbemerkt.
       */
      container-type: inline-size;
      display: flex;
      flex-direction: column;
      min-inline-size: 0;
      border-inline-end: var(--border-width-thin) solid var(--color-border-light);
    }
    .chamber:last-child {
      border-inline-end: none;
    }

    /* Der Nachhall liegt in der Basisbreite quer unter dem Board. */
    .chamber--after {
      grid-column: 1 / -1;
      border-inline-end: none;
      border-block-start: var(--border-width-thin) solid var(--color-border-light);
    }
    .chamber--after .chamber__body {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: var(--space-2);
    }

    .chamber__head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-2);
      padding: var(--space-2-5) var(--space-3);
      border-block-end: var(--border-width-thin) solid var(--color-border-light);
    }

    .chamber__title {
      font-family: var(--font-brutalist);
      font-size: var(--_title);
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
      margin: 0;
      color: var(--color-text-secondary);
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    /* Jede Kammer trägt die Farbe ihrer Bedeutung im Titel. */
    .chamber--q .chamber__title {
      color: var(--color-accent-amber);
    }
    .chamber--released .chamber__title {
      color: var(--color-accent-green);
    }
    .chamber--after .chamber__title {
      color: var(--color-info);
    }

    .chamber__count {
      font-family: var(--font-mono);
      font-size: var(--_label);
      color: var(--color-text-tertiary);
      font-variant-numeric: tabular-nums;
      flex: none;
    }

    .chamber__all {
      margin-inline-start: auto;
      font-family: var(--font-mono);
      font-size: var(--_label);
      letter-spacing: var(--tracking-wide);
      text-transform: uppercase;
      padding: var(--space-0-5) var(--space-1-5);
      background: transparent;
      border: var(--border-width-thin) solid var(--color-border-light);
      color: var(--color-text-tertiary);
      cursor: pointer;
      white-space: nowrap;
      transition: border-color var(--transition-fast), color var(--transition-fast);
    }

    .chamber__all:hover:not(:disabled),
    .chamber__all:focus-visible:not(:disabled) {
      border-color: var(--color-accent-amber);
      color: var(--color-text-primary);
    }

    .chamber__all--green:hover:not(:disabled),
    .chamber__all--green:focus-visible:not(:disabled) {
      border-color: var(--color-accent-green);
      color: var(--color-accent-green);
    }

    .chamber__all:focus-visible {
      outline: none;
      box-shadow: var(--ring-focus);
    }

    .chamber__all:disabled {
      opacity: 0.3;
      cursor: default;
    }

    /* Nach einem Stapel-Knopf rueckt der naechste Knopf nicht noch einmal. */
    .chamber__all + .expand--fetch {
      margin-inline-start: var(--space-1);
    }

    .expand {
      margin-inline-start: auto;
      padding: 0 var(--space-1);
      background: transparent;
      border: none;
      color: var(--color-text-muted);
      font-size: var(--text-sm);
      line-height: 1;
      cursor: pointer;
      transition: color var(--transition-fast);
    }

    .expand:hover:not(:disabled),
    .expand:focus-visible:not(:disabled) {
      color: var(--color-accent-amber);
    }

    .expand:focus-visible {
      outline: none;
      box-shadow: var(--ring-focus);
    }

    .expand:disabled {
      opacity: 0.3;
      cursor: default;
    }

    /* Der zweite Knopf schiebt nicht noch einmal — nur der erste rueckt nach rechts. */
    .expand--fetch {
      margin-inline-start: auto;
      display: inline-flex;
      align-items: center;
    }

    .expand--fetch + .expand {
      margin-inline-start: 0;
    }

    /* ── Die Zeile zur Sichtung ──────────────────────────────────────── */

    .triage-line {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      inline-size: 100%;
      padding: var(--space-2) var(--space-3);
      background: transparent;
      border: none;
      border-block-end: var(--border-width-thin) dashed var(--color-border-light);
      color: var(--color-text-tertiary);
      font-family: var(--font-mono);
      font-size: var(--_label);
      letter-spacing: var(--tracking-wide);
      text-transform: uppercase;
      text-align: start;
      cursor: pointer;
      transition: color var(--transition-fast), border-color var(--transition-fast);
    }

    .triage-line:hover,
    .triage-line:focus-visible {
      color: var(--color-text-primary);
      border-block-end-color: var(--color-accent-amber);
    }

    .triage-line:focus-visible {
      outline: none;
      box-shadow: var(--ring-focus);
    }

    .triage-line__dot {
      inline-size: 6px;
      block-size: 6px;
      flex: none;
      background: var(--color-border);
    }

    /*
     * Der Punkt blinkt NUR, wenn etwas wartet. Ein Signalgeber, der immer
     * leuchtet, ist eine Verzierung — und diese Zeile ist der einzige Weg zu
     * einem Bestand, den sonst keine Kammer zeigt.
     */
    .triage-line--live .triage-line__dot {
      background: var(--color-accent-amber);
      animation: triage-pulse 2s var(--ease-in-out) infinite;
    }

    .triage-line--live {
      color: var(--color-text-secondary);
    }

    @keyframes triage-pulse {
      0%,
      100% {
        opacity: 1;
      }
      50% {
        opacity: 0.25;
      }
    }

    .triage-line__text {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .triage-line__go {
      flex: none;
      color: var(--color-accent-amber-readable);
    }

    .chamber__body {
      flex: 1;
      min-block-size: 0;
      overflow-y: auto;
      padding: var(--space-3);
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .empty {
      font-family: var(--font-prose);
      font-style: italic;
      font-size: var(--_body);
      line-height: var(--leading-relaxed);
      color: var(--color-text-tertiary);
      max-inline-size: 48ch;
      margin: 0;
    }

    .placeholder {
      font-family: var(--font-mono);
      font-size: var(--_label);
      color: var(--color-text-secondary);
      padding: var(--space-2);
      border: var(--border-width-thin) dashed var(--color-border);
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      align-items: flex-start;
    }

    .error {
      font-family: var(--font-mono);
      font-size: var(--_body);
      color: var(--color-danger);
      padding: var(--space-3) var(--space-4);
    }

    /*
     * Was innerhalb einer Kammer umbricht, fragt die KAMMER, nicht den
     * Viewport. Die Schwellen stammen aus schleuse-responsive.md; die
     * Karten selbst kommen in den Schritten 3–6, die Anker stehen schon hier,
     * damit sie nicht nachträglich eingezogen werden müssen.
     */
    @container (max-width: 399px) {
      .placeholder {
        font-size: max(9px, calc(var(--text-xs) * 0.95));
      }
    }

    /* ── 1280 abwärts: Stapel ────────────────────────────────────────────── */

    @media (max-width: 1279px) {
      .board {
        grid-template-columns: 1fr;
        min-block-size: 0;
      }
      .chamber {
        border-inline-end: none;
        border-block-end: var(--border-width-thin) solid var(--color-border-light);
      }
      .chamber__body {
        overflow-y: visible;
      }
      .sensors,
      .quota-row {
        grid-template-columns: 1fr;
      }
    }

    /* ── 1600: die Referenz des Prototyps ────────────────────────────────── */

    @media (min-width: 1600px) {
      .board {
        grid-template-columns: 1fr 1.25fr 1fr 1fr;
      }
      .chamber--after {
        grid-column: auto;
        border-block-start: none;
      }
      .chamber--after .chamber__body {
        display: flex;
        flex-direction: column;
      }
      .sensors__grid {
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      }
      .quota-row {
        grid-template-columns: 360px 1fr;
      }
      .status__text {
        display: inline;
      }
    }

    /* ── 1920: weiter ────────────────────────────────────────────────────── */

    @media (min-width: 1920px) {
      .board {
        grid-template-columns: 1fr 1.25fr 1fr 1.1fr;
      }
      .chamber__body {
        padding: var(--space-4);
      }
      .top,
      .sensors,
      .quota-row {
        padding-inline: var(--space-6);
      }
    }

    /*
     * ── 2560: die Bühne ────────────────────────────────────────────────────
     *
     * Hier steht bewusst fast nichts. --stage-type-scale springt in
     * _layout.css von selbst auf 1.15, und die Schriftmasse oben hängen
     * daran — sie wachsen also ohne eine Regel an dieser Stelle. Die Breite
     * ist durch --stage-measure auf dem :host bereits gedeckelt.
     *
     * Kein fünftes Element, keine sechste Spalte: der Rand ist Absicht.
     */
    @media (min-width: 2560px) {
      .chamber__body {
        padding: var(--space-5);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .act,
      .triage-line {
        transition-duration: 0.01ms;
      }

      .triage-line--live .triage-line__dot {
        animation: none;
      }
    }
  `;

  /** Die Welt, deren Schleuse gezeigt wird. */
  @property({ type: String }) simulationId = '';

  /** Anzeigename der Welt für die Brotkrume. */
  @property({ type: String }) simulationName = '';

  /**
   * Das Signal, das gerade im Schmelztiegel liegt.
   *
   * Leer heisst: der Schmelztiegel ist zu. Die ID und nicht das Signal selbst,
   * damit das Modal beim nächsten Rendern die AKTUELLE Fassung aus dem Manager
   * liest statt einer Kopie, die beim Öffnen richtig war.
   */
  @state() private _crucibleSignalId = '';

  /** Ob der Schmelztiegel eine Linse ÄNDERT statt eine zu setzen. */
  @state() private _crucibleEditLens = false;

  /** Das Signal im Resonanz-Modal. Leer heisst: zu. */
  @state() private _resonanceSignalId = '';

  /** Das Signal im Melden-Modal. Leer heisst: zu. */
  @state() private _flagSignalId = '';

  /** Ob die Sichtung offen ist. */
  @state() private _triageOpen = false;

  /** Ob der Lesesaal offen ist. */
  @state() private _readingRoomOpen = false;

  /** Ob der Zufluss von Hand offen ist. */
  @state() private _browseOpen = false;

  /** Läuft gerade ein Stapel? Sperrt beide Stapel-Knöpfe. */
  @state() private _batchBusy = false;

  /** Ob das Scan-Log offen ist. */
  @state() private _scanLogOpen = false;

  override connectedCallback(): void {
    super.connectedCallback();
    void intakeState.loadScanner();
    // Die Passung gehoert der WELT, nicht dem Scanner: sie laedt auch fuer
    // einen Architekten, der die Kandidatenliste gar nicht sehen darf.
    void intakeState.loadFit(this.simulationId);
  }

  protected override willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('simulationId') && this.simulationId) {
      void intakeState.loadFit(this.simulationId);
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    intakeState.clear();
  }

  // ── Topbar ────────────────────────────────────────────────────────────────

  private _renderTop() {
    const admin = intakeState.role.value === 'admin';
    const cfg = intakeState.dashboard.value?.config;
    const hours = cfg ? Math.round(cfg.interval / 3600) : null;

    return html`
      <div class="top rule">
        <span class="crumb">
          ${
            admin
              ? html`${msg('Bureau')} // <strong>${msg('Substrate monitoring')}</strong> //
                ${msg('Airlock')}`
              : html`${msg('Simulations')} // <strong>${this.simulationName}</strong> //
                ${msg('Airlock')}`
          }
        </span>
        <span class="top__right">
          <span class="status">
            <span
              class="status__dot ${cfg?.enabled ? '' : 'status__dot--off'}"
              aria-hidden="true"
            ></span>
            <span class="status__text">
              ${
                cfg?.enabled
                  ? hours !== null
                    ? msg(str`Scanner active · every ${hours} h`)
                    : msg('Scanner active')
                  : msg('Scanner idle')
              }
            </span>
          </span>
          <span class="role ${admin ? 'role--admin' : 'role--architect'}">
            ${admin ? msg('Admin') : msg('Architect')}
          </span>
        </span>
      </div>
    `;
  }

  // ── Sensor-Leiste ─────────────────────────────────────────────────────────

  private async _triggerScan(): Promise<void> {
    this.dispatchEvent(new CustomEvent('intake-scan', { bubbles: true, composed: true }));
    await intakeState.loadScanner();
  }

  private _renderSensors() {
    const adapters = intakeState.adapters.value;
    const metrics = intakeState.dashboard.value?.metrics;
    const admin = intakeState.role.value === 'admin';
    const online = adapters.filter((a) => a.enabled && a.available).length;
    const lastScan = minutesSince(metrics?.last_scan ?? null);

    /*
     * Die Sensorlage gehört dem Bureau, nicht der Welt.
     *
     * /admin/news-scanner/dashboard hängt am Plattform-Admin — ein Architekt
     * bekommt sie nicht, und „0/0 online" wäre die falsche Auskunft: es sind
     * nicht null Quellen, er sieht sie nur nicht. Der Unterschied zwischen
     * „nichts da" und „nicht für dich" gehört auf den Schirm.
     */
    if (!admin) {
      return html`
        <section class="sensors rule" aria-label=${msg('Sensors')}>
          <div>
            <h2 class="sensors__title">${msg('Sensors')}</h2>
          </div>
          <p class="sensors__note">
            ${msg('The sensor picture belongs to the Bureau. What comes through reaches you at the entrance.')}
          </p>
          <div></div>
        </section>
      `;
    }

    return html`
      <section class="sensors rule" aria-label=${msg('Sensors')}>
        <div>
          <h2 class="sensors__title">${msg('Sensors')}</h2>
          <p class="sensors__note">
            ${msg(str`${online}/${adapters.length} online`)}
          </p>
        </div>

        <div class="sensors__grid" role="list" aria-label=${msg('Sources')}>
          ${
            adapters.length === 0
              ? html`<p class="sensors__note">${msg('No sources reported.')}</p>`
              : adapters.map(
                  (a) => html`
                    <velg-intake-sensor-tile
                      .name=${a.display_name || a.name}
                      .kind=${sourceKindOf(a.name, a)}
                      ?off=${!a.enabled}
                      ?interactive=${admin}
                      .hits=${0}
                      .minutesAgo=${lastScan}
                    ></velg-intake-sensor-tile>
                  `,
                )
          }
        </div>

        <div class="sensors__right">
          ${
            admin
              ? html`<button class="act" type="button" @click=${this._triggerScan}>
                  ${icons.radar(12)} ${msg('Scan now')}
                </button>`
              : html`<span class="next">
                  ${lastScan === null ? msg('No scan yet') : msg(str`Last scan ${lastScan} min ago`)}
                </span>`
          }
          <button class="act act--ghost" type="button" @click=${this._openScanLog}>
            ${msg('Scan log')}
          </button>
          <p class="funnel">
            ${
              metrics
                ? msg(
                    str`${metrics.scanned_today} scanned · ${metrics.classified_today} classified · ${metrics.pending_candidates} waiting · ${metrics.resonances_today} resonances today`,
                  )
                : msg('No figures yet.')
            }
          </p>
        </div>
      </section>
    `;
  }

  /**
   * Das Scan-Log öffnen.
   *
   * Dieser Knopf stand seit Schritt 2 da und feuerte ein Ereignis, das niemand
   * abhörte — ein Griff ohne Tür. Seit Schritt 6 hat er eine.
   */
  private _openScanLog(): void {
    this._scanLogOpen = true;
  }

  // ── Quote ─────────────────────────────────────────────────────────────────

  private _renderQuota() {
    const used = intakeState.eventsToday.value;
    const total = intakeState.dailyQuota.value;

    return html`
      <section class="quota-row rule" aria-label=${msg('Daily quota')}>
        <div>
          <h2 class="quota__label">${msg('Daily quota · admitted to this world')}</h2>
          <span class="quota__value">${used} / ${total}</span>
          <div
            class="quota__segs"
            role="img"
            aria-label=${msg(str`${used} of ${total} events admitted today`)}
          >
            ${Array.from(
              { length: total },
              (_, i) => html`<span class="quota__seg ${i < used ? 'quota__seg--on' : ''}"></span>`,
            )}
          </div>
          <p class="quota__foot">${msg('Resonances do not count towards the quota.')}</p>
        </div>
        <div>
          <h2 class="subs__label">${msg('Subscriptions')}</h2>
          <p class="sensors__note">${msg('Not wired yet – the backend has no subscriptions.')}</p>
        </div>
      </section>
    `;
  }

  // ── Board ─────────────────────────────────────────────────────────────────

  private _renderChamber(
    modifier: string,
    title: string,
    items: IntakeSignal[],
    emptyText: string,
    action?: (s: IntakeSignal) => unknown,
  ) {
    return html`
      <section class="chamber chamber--${modifier}" aria-label=${title}>
        <header class="chamber__head">
          <h2 class="chamber__title">${title}</h2>
          <span class="chamber__count">${items.length}</span>
        </header>
        <div class="chamber__body">
          ${
            items.length === 0
              ? html`<p class="empty">${emptyText}</p>`
              : items.map(
                  (s) => html`<div class="placeholder">
                    <span>${s.headline}</span>
                    ${action ? action(s) : nothing}
                  </div>`,
                )
          }
        </div>
      </section>
    `;
  }

  /**
   * Der Weg in den Schmelztiegel.
   *
   * Die Karten der Kammern kommen erst in den Schritten 4–6; bis dahin trägt
   * der Platzhalter den einen Knopf, ohne den Schritt 3 unerreichbar wäre.
   * Eine Komponente, die niemand öffnen kann, ist nicht gebaut, sondern
   * abgelegt.
   */
  private _renderTransformAction(s: IntakeSignal) {
    return html`
      <button
        class="act"
        type="button"
        @click=${() => {
          this._crucibleSignalId = s.id;
        }}
      >
        ${msg('Transform')}
      </button>
    `;
  }

  /**
   * „Alle → ②" — für alles im Eingang einen Vorschlag schreiben lassen.
   *
   * Setzt KEINE Linse; der Ort bleibt eine Entscheidung je Stück. Die
   * Begründung steht in `intake-batch.ts`.
   */
  private async _batchTransform(): Promise<void> {
    this._batchBusy = true;
    try {
      await batchTransformEntrance(this.simulationId);
    } finally {
      this._batchBusy = false;
    }
  }

  /** „Alle ▣ nur hier" — aufnehmen, was eine Linse hat, gedeckelt an der Quote. */
  private async _batchIntegrate(): Promise<void> {
    this._batchBusy = true;
    try {
      await batchIntegrateQuarantine(this.simulationId);
    } finally {
      this._batchBusy = false;
    }
  }

  /**
   * Kammer ① — und die Zeile, die zur Sichtung führt.
   *
   * Die Sichtung ist kein eigener Ort auf dem Brett: sie ist der Vorraum, aus
   * dem der Eingang gefüllt wird. Ohne diese Zeile wären die wartenden Signale
   * NIRGENDS sichtbar — Stufe `raw` hat keine Kammer, und vier Schritte lang
   * hat das niemand gemerkt, weil die View selbst keinen Navigationseintrag
   * hatte. Ein Bestand, den keine Oberfläche zeigt, ist kein Bestand.
   *
   * Der Punkt blinkt nur, wenn wirklich etwas wartet. Ein Signalgeber, der
   * immer leuchtet, ist eine Verzierung.
   */
  private _renderEntrance() {
    const items = intakeState.inEntrance.value;
    const waiting = intakeState.inTriage.value.length;
    const title = msg('1 Entrance · admitted');

    return html`
      <section class="chamber chamber--entrance" aria-label=${title}>
        <header class="chamber__head">
          <h2 class="chamber__title">${title}</h2>
          <button
            type="button"
            class="chamber__all"
            ?disabled=${items.length === 0 || this._batchBusy}
            title=${msg('Write a proposal for everything at the entrance')}
            @click=${this._batchTransform}
          >
            ${msg('All → 2')}
          </button>
          <button
            type="button"
            class="expand expand--fetch"
            aria-label=${msg('Fetch by hand')}
            title=${msg('Fetch by hand')}
            @click=${() => {
              this._browseOpen = true;
            }}
          >
            ${icons.download(14)}
          </button>
          <button
            type="button"
            class="expand"
            aria-label=${msg('Open reading room')}
            title=${msg('Open reading room')}
            ?disabled=${items.length === 0}
            @click=${() => {
              this._readingRoomOpen = true;
            }}
          >
            ⤢
          </button>
          <span class="chamber__count">${items.length}</span>
        </header>

        <button
          type="button"
          class="triage-line ${waiting > 0 ? 'triage-line--live' : ''}"
          @click=${() => {
            this._triageOpen = true;
          }}
        >
          <span class="triage-line__dot" aria-hidden="true"></span>
          <span class="triage-line__text">
            ${waiting > 0 ? msg(str`Triage · ${waiting} waiting`) : msg('Triage · nothing waiting')}
          </span>
          <span class="triage-line__go">${msg('Open triage')}</span>
        </button>

        <div class="chamber__body">
          ${
            items.length === 0
              ? html`<p class="empty">
                  ${msg('Nothing admitted yet. Pick from triage, or let a subscription fill it.')}
                </p>`
              : items.map(
                  (s) => html`<div class="placeholder">
                    <span>${s.headline}</span>
                    ${this._renderTransformAction(s)}
                  </div>`,
                )
          }
        </div>
      </section>
    `;
  }

  /**
   * Kammer ② — die einzige mit echten Karten.
   *
   * Die drei anderen tragen bis zu den Schritten 5 und 6 Platzhalter. Diese
   * hier ist zuerst dran, weil sie die einzige ist, auf der etwas
   * Unumkehrbares passieren kann.
   */
  private _renderQuarantine() {
    const items = intakeState.inQuarantine.value;
    const title = msg('2 Quarantine · decide its fate');

    const withLens = items.filter((s) => s.lens && s.proposal).length;

    return html`
      <section class="chamber chamber--q" aria-label=${title}>
        <header class="chamber__head">
          <h2 class="chamber__title">${title}</h2>
          <button
            type="button"
            class="chamber__all chamber__all--green"
            ?disabled=${withLens === 0 || this._batchBusy || intakeState.quotaReached.value}
            title=${
              intakeState.quotaReached.value
                ? msg('Daily quota reached')
                : msg('Admit everything that has a lens')
            }
            @click=${this._batchIntegrate}
          >
            ${msg('All here only')}
          </button>
          <span class="chamber__count">${items.length}</span>
        </header>
        <div class="chamber__body">
          ${
            items.length === 0
              ? html`<p class="empty">
                  ${msg('Quarantine is empty. The next scan cycle will bring more.')}
                </p>`
              : items.map(
                  (s) => html`
                    <velg-intake-quarantine-card
                      .signal=${s}
                      .simulationId=${this.simulationId}
                      @intake-raise-resonance=${(e: CustomEvent<{ signalId: string }>) => {
                        this._resonanceSignalId = e.detail.signalId;
                      }}
                      @intake-flag=${(e: CustomEvent<{ signalId: string }>) => {
                        this._flagSignalId = e.detail.signalId;
                      }}
                      @intake-edit-lens=${(e: CustomEvent<{ signalId: string }>) => {
                        this._crucibleEditLens = true;
                        this._crucibleSignalId = e.detail.signalId;
                      }}
                    ></velg-intake-quarantine-card>
                  `,
                )
          }
        </div>
      </section>
    `;
  }

  /**
   * Kammer ④ — der Nachhall.
   *
   * Der Inhalt liegt in einer eigenen Komponente, weil er als einziger auf dem
   * Brett NACHLÄDT (die Impacts je ausgelöster Resonanz). Die Kammer selbst
   * bleibt damit das, was die drei anderen auch sind: eine Sicht, kein Lader.
   */
  private _renderAftermath() {
    const title = msg('4 Aftermath · what it set off');

    return html`
      <section class="chamber chamber--after" aria-label=${title}>
        <header class="chamber__head">
          <h2 class="chamber__title">${title}</h2>
        </header>
        <div class="chamber__body">
          <velg-intake-aftermath-chamber></velg-intake-aftermath-chamber>
        </div>
      </section>
    `;
  }

  protected render() {
    const err = intakeState.error.value;

    return html`
      ${this._renderTop()} ${this._renderSensors()} ${this._renderQuota()}
      ${err ? html`<p class="error" role="alert">${err}</p>` : nothing}
      <div class="board">
        ${this._renderEntrance()}
        ${this._renderQuarantine()}
        ${this._renderChamber(
          'released',
          msg('3 Released · resonances and events'),
          intakeState.released.value,
          msg('Nothing released yet.'),
        )}
        ${this._renderAftermath()}
      </div>
      <velg-intake-browse-modal
        ?open=${this._browseOpen}
        .simulationId=${this.simulationId}
        @modal-close=${() => {
          this._browseOpen = false;
        }}
      ></velg-intake-browse-modal>
      <velg-intake-reading-room-modal
        ?open=${this._readingRoomOpen}
        @intake-transform=${(e: CustomEvent<{ signalId: string }>) => {
          this._crucibleSignalId = e.detail.signalId;
        }}
        @modal-close=${() => {
          this._readingRoomOpen = false;
        }}
      ></velg-intake-reading-room-modal>
      <velg-intake-scan-log-modal
        ?open=${this._scanLogOpen}
        @modal-close=${() => {
          this._scanLogOpen = false;
        }}
      ></velg-intake-scan-log-modal>
      <velg-intake-triage-modal
        ?open=${this._triageOpen}
        @modal-close=${() => {
          this._triageOpen = false;
        }}
      ></velg-intake-triage-modal>
      <velg-intake-crucible-modal
        ?open=${this._crucibleSignalId !== ''}
        .simulationId=${this.simulationId}
        signal-id=${this._crucibleSignalId}
        ?edit-lens=${this._crucibleEditLens}
        @modal-close=${() => {
          this._crucibleSignalId = '';
          this._crucibleEditLens = false;
        }}
      ></velg-intake-crucible-modal>
      <velg-intake-resonance-modal
        ?open=${this._resonanceSignalId !== ''}
        signal-id=${this._resonanceSignalId}
        @modal-close=${() => {
          this._resonanceSignalId = '';
        }}
      ></velg-intake-resonance-modal>
      <velg-intake-flag-modal
        ?open=${this._flagSignalId !== ''}
        .simulationId=${this.simulationId}
        signal-id=${this._flagSignalId}
        @modal-close=${() => {
          this._flagSignalId = '';
        }}
      ></velg-intake-flag-modal>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-intake-view': VelgIntakeView;
  }
}
