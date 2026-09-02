/**
 * Der Schmelztiegel — aus einem Signal wird ein Vorschlag für DIESE Welt.
 *
 * Schritt 3 aus `handoff/schleuse-event-intake.md`. Er ERSETZT
 * `social/TransformationModal.ts` und ist die erste bestehende Datei, die die
 * Schleuse anfasst.
 *
 * ── DER EINE UNTERSCHIED ZUM ALTEN MODAL ────────────────────────────────────
 *
 * Das alte Modal machte Transformieren UND Integrieren in einem Assistenten
 * (`preview → transform → integrate`). Der Schmelztiegel integriert NICHT. Er
 * endet in der Quarantäne:
 *
 *     in → q    Schmelztiegel        transformArticle
 *     q  → ev   „Nur hier" (Kammer ②) integrateArticle
 *
 * Zwischen „daraus könnte ein Ereignis werden" und „es IST eins" liegt eine
 * Entscheidung, und die gehört in die Quarantäne, nicht ans Ende eines
 * Assistenten. Wer beides in einem Zug macht, hat die Entscheidung nie
 * getroffen, sondern nur weitergeklickt.
 *
 * ── DREI ABWEICHUNGEN VOM BAUPLAN, JEDE GEMESSEN ────────────────────────────
 *
 * 1. FÜNF SCHRITTE, DIE NIEMAND GEHT. Der Bauplan (und der Prototyp) zeigen
 *    während der Erzeugung fünf Schritte mit Millisekunden: „Signal gelesen ·
 *    Ort verankert · Zeugen befragt · Tonlage gesetzt · Wirkung gerechnet".
 *    Der Dienst tut nichts davon in fünf Teilen — `POST /transform-article` ist
 *    EIN Aufruf, und die Zahlen im Prototyp sind gesetzt (380, 520, 660 …).
 *    Eine Fortschrittsanzeige, die Schritte erfindet, die es nicht gibt, ist
 *    keine Anzeige, sondern Bühne. Hier stehen deshalb DREI Schritte, die alle
 *    stimmen, und die Zeit wird gemessen statt behauptet. Sobald das Backend
 *    `steps[]` liefert (Lücke 4), treten dessen Schritte an ihre Stelle.
 *
 * 2. NICHT `GenerationProgress`. Das Modul ist eine Vollbild-Auflage
 *    (`position: fixed`, `--z-notification`) — es würde genau die Fläche
 *    verdecken, über die es berichtet. Der Schmelztiegel zeigt das Arbeiten IN
 *    der Terminal-Fläche, in der der Text danach steht. Der Typ `GenerationStep`
 *    wird trotzdem von dort geliehen: dasselbe Vokabular, andere Bühne.
 *
 * 3. `<textarea>` STATT `contenteditable`. Der Bauplan nennt `contenteditable`.
 *    Ein `contenteditable` innerhalb eines Lit-Templates wird beim nächsten
 *    Rendern überschrieben, hat keine Beschriftung und keine Tastaturbedienung,
 *    die ein Formularfeld mitbringt. Das Aussehen ist dasselbe, die Zusicherung
 *    nicht.
 *
 * ── WAS DIE LINSE HEUTE ERREICHT ────────────────────────────────────────────
 *
 * `transform-article` nimmt KEINE Linse entgegen (Lücke 4 im Plan). Die Linse
 * wird deshalb am Signal gespeichert und wirkt gestaffelt:
 *
 *     Typ · Wucht · Reaktionen   →  bei der Aufnahme (`integrateArticle`)
 *     Ort · Vektor               →  im Prompt UND auf der Quarantäne-Karte
 *     Tonlage · Anweisung        →  im Prompt
 *     Freiheit                   →  als TEMPERATUR des Aufrufs
 *
 * ⚠ SEIT DEM 02.09.2026 ERREICHT ALLES DAVON DAS MODELL (Lücke 4, Migration
 * 341). Der Ort geht als NAME hinein, nicht als Kennung. Die Freiheit steht
 * nicht im Text, sondern ist die Temperatur — `GenerationService._generate`
 * nimmt sie entgegen und überstimmt damit die Temperatur der Vorlage.
 *
 * Die letzte Zeile steht als Fussnote am Raster, nicht als Kommentar im Code:
 * ein Regler, der nichts bewegt und das nicht sagt, ist eine Lüge auf dem
 * Schirm. `LENS_REACHES_MODEL` ist der eine Schalter, der sie wieder entfernt.
 *
 * ZEUGEN fehlen bewusst: sie könnten heute nur den Text beeinflussen, und der
 * Text kennt die Linse nicht. Ein Steuerelement, dessen Zustand nirgends
 * eintreten kann, bauen wir nicht — siehe `handoff/schleuse-event-intake.md`,
 * Nachtrag zu Schritt 3.
 */

import { localized, msg, str } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { socialTrendsApi } from '../../services/api/index.js';
import { intakeState } from '../../services/IntakeStateManager.js';
import { captureError } from '../../services/SentryService.js';
import {
  CATEGORY_ARCHETYPE,
  INTAKE_FREEDOMS,
  INTAKE_TONES,
  type IntakeLens,
  type IntakeSignal,
  type IntakeTone,
  transformRequestOf,
} from '../../types/intake.js';
import { BLEED_VECTORS, bleedVectorLabel } from '../../utils/enum-labels.js';
import { icons } from '../../utils/icons.js';
import { taxonomyLabel } from '../../utils/taxonomy-label.js';
import type { GenerationStep } from '../shared/GenerationProgress.js';
import { VelgToast } from '../shared/Toast.js';
import '../shared/BaseModal.js';
import {
  archetypeLabel,
  freedomLabel,
  freedomNote,
  impactWord,
  toneLabel,
} from './intake-labels.js';
import { intakeControlStyles } from './intake-styles.js';

/**
 * Erreicht die Linse das Modell?
 *
 * ✅ SEIT DEM 02.09.2026 JA — Lücke 4 ist zu (Migration 341 + `TransformLens`
 * im Backend). Die Marke `°` und die Fussnote sind damit weg, und `_run()`
 * schickt die Linse mit.
 *
 * Die Konstante BLEIBT stehen, statt ausgebaut zu werden: sie ist die Stelle,
 * an der ein Leser die Frage beantwortet bekommt, ohne den Aufruf zu suchen —
 * und wer sie auf `false` dreht, sieht sofort, was daran hing. Ein Wert, der
 * einmal `false` war, erklärt seine Gegenwart besser als sein Fehlen.
 */
const LENS_REACHES_MODEL = true;

/** Wie viele Agenten auf ein Ereignis reagieren dürfen. */
const REACTION_COUNTS = [3, 5, 8] as const;

/** Vorgabe, solange die Linse keine eigene Zahl trägt. */
const DEFAULT_REACTION_COUNT = 5;

/** Wie schnell die Ausgabe geschrieben wird (Zeichen pro Takt, Takt in ms). */
const TYPE_CHARS = 3;
const TYPE_TICK = 18;

/** Eine erzeugte Fassung. Jede kostet einen Modellaufruf, also wird jede behalten. */
interface CrucibleVariant {
  title: string;
  body: string;
  tone: IntakeTone;
  creativity: number;
  /** Gemessen, nicht geschätzt: Wanduhr um den Aufruf herum. */
  ms: number;
  model: string;
}

type CruciblePhase = 'idle' | 'reading' | 'typing' | 'done' | 'error';

@localized()
@customElement('velg-intake-crucible-modal')
export class VelgIntakeCrucibleModal extends SignalWatcher(LitElement) {
  static styles = [
    intakeControlStyles,
    css`
    :host {
      display: block;

      /*
       * Breite und Polsterung.
       *
       * 1000 px ist die Referenz des Bauplans; darunter zieht die Modal-Basis
       * selbst nach (width: 100%), oberhalb von 2560 wird der Schmelztiegel
       * NICHT breiter — zwei Spalten Text werden von mehr Breite nicht besser.
       * Die Polsterung wandert vom Körper an die Zeilen, damit die Trennlinien
       * von Rahmen zu Rahmen laufen statt in der Luft zu enden.
       */
      --modal-max-width: min(1000px, calc(100vw - 2 * var(--stage-gutter)));
      --modal-body-padding: 0;

      /* Tier 3. Der Zeitungsausriss ist im Prototyp warmes Papier im Dunkeln
         (der Bauplan nennt den Wert in seiner Token-Tabelle). Das entsteht aus
         der gehobenen Fläche mit einem Hauch Bernstein und braucht deshalb
         kein eigenes globales Token — nur diese Welt hat ein Papier. */
      --_paper: color-mix(in srgb, var(--color-surface-raised) 90%, var(--color-accent-amber));
      --_scanline: color-mix(in srgb, var(--color-accent-green) 4%, transparent);
      --_hairline: color-mix(in srgb, var(--color-border-light) 70%, var(--color-surface));
    }

    .body {
      container-type: inline-size;
    }

    /* ── Zeilen ──────────────────────────────────────────────────────────── */

    .row {
      padding: var(--space-3) var(--space-6);
      border-block-end: var(--border-width-thin) solid var(--color-border-light);
    }

    .row:last-child {
      border-block-end: none;
    }

    /* ── Schrittleiste ───────────────────────────────────────────────────── */

    .steps {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      flex-wrap: wrap;
    }

    .steps__item {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      letter-spacing: var(--tracking-widest);
      text-transform: uppercase;
      color: var(--color-text-tertiary);
    }

    .steps__item--done {
      color: var(--color-text-primary);
    }

    .steps__item--lens {
      color: var(--color-accent-amber-readable);
    }

    .steps__item--live {
      color: var(--color-accent-green);
    }

    .steps__arrow {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-tertiary);
    }

    .steps__arrow--live {
      color: var(--color-accent-green);
      animation: crucible-pulse 1.5s var(--ease-in-out) infinite;
    }

    .steps__meta {
      margin-inline-start: auto;
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-tertiary);
    }

    .arch {
      color: var(--color-accent-amber-readable);
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
    }

    /* ── Körper: Wirklichkeit | Trennbalken | Welt ───────────────────────── */

    .split {
      display: grid;
      grid-template-columns: 1fr 4px 1fr;
      min-block-size: 260px;
      border-block-end: var(--border-width-thin) solid var(--color-border-light);
    }

    .half {
      padding: var(--space-4) var(--space-5);
      min-inline-size: 0;
    }

    .half__head {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin-block-end: var(--space-2-5);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
      color: var(--color-text-muted);
    }

    .half__head--world {
      color: var(--color-accent-green);
    }

    /* Der Zeitungsausriss. Die weisse Kopflinie ist eine OBERE Kante, kein
       Akzentbalken an der Seite: sie sagt „gedrucktes Papier", nicht „Karte
       der Sorte X". */
    .clipping {
      padding: var(--space-4);
      background: var(--_paper);
      border: var(--border-width-thin) solid var(--_hairline);
      border-block-start: var(--border-width-thick) solid var(--color-text-primary);
      box-shadow: var(--shadow-xs);
    }

    .clipping__headline {
      font-family: var(--font-prose);
      font-weight: var(--font-semibold);
      font-size: var(--text-md);
      line-height: var(--leading-tight);
      color: var(--color-text-primary);
      margin: 0 0 var(--space-2);
      text-wrap: pretty;
    }

    .clipping__abstract {
      font-family: var(--font-prose);
      font-size: var(--text-sm);
      line-height: var(--leading-relaxed);
      color: var(--color-text-secondary);
      margin: 0;
      text-wrap: pretty;
    }

    .clipping__by {
      display: flex;
      align-items: baseline;
      gap: var(--space-2);
      margin-block-start: var(--space-2-5);
      padding-block-start: var(--space-2);
      border-block-start: var(--border-width-thin) solid var(--_hairline);
    }

    .clipping__src {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      letter-spacing: var(--tracking-wider);
      text-transform: uppercase;
      color: var(--color-text-muted);
    }

    .clipping__link {
      margin-inline-start: auto;
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    .clipping__link:hover,
    .clipping__link:focus-visible {
      color: var(--color-accent-amber-readable);
    }

    /* Der Trennbalken. Während der Erzeugung läuft ein Streifen hindurch —
       eine BENANNTE Animation, also kein Akzentbalken im Sinne des Tores:
       er sagt „arbeitet", nicht „Karte der Sorte X". */
    .divider {
      position: relative;
      background: var(--color-border);
      overflow: hidden;
    }

    .divider--live {
      background: color-mix(in srgb, var(--color-accent-green) 25%, var(--color-surface));
    }

    .divider__sweep {
      position: absolute;
      inset-inline: 0;
      block-size: 56px;
      background: var(--color-accent-green);
      animation: crucible-sweep 1.6s var(--ease-in-out) infinite;
    }

    /* ── Terminal ────────────────────────────────────────────────────────── */

    .badge {
      margin-inline-start: auto;
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      letter-spacing: var(--tracking-wider);
      text-transform: uppercase;
      padding: var(--space-0-5) var(--space-1-5);
      border: var(--border-width-thin) solid var(--color-border);
      color: var(--color-text-muted);
    }

    .badge--live {
      border-color: var(--color-accent-green);
      color: var(--color-accent-green);
      animation: crucible-pulse 1.5s var(--ease-in-out) infinite;
    }

    .terminal {
      position: relative;
      padding: var(--space-3);
      min-block-size: 190px;
      background: var(--color-surface-sunken);
      border: var(--border-width-thin) solid
        color-mix(in srgb, var(--color-accent-green) 25%, var(--color-surface));
    }

    .terminal--live {
      border-color: var(--color-accent-green);
    }

    .terminal__scan {
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: repeating-linear-gradient(
        to bottom,
        transparent 0,
        transparent 3px,
        var(--_scanline) 3px,
        var(--_scanline) 4px
      );
    }

    .work {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: var(--space-1-5);
    }

    .work__step {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      color: var(--color-text-tertiary);
    }

    .work__step--done {
      color: var(--color-accent-green);
    }

    .work__step--active {
      color: var(--color-text-primary);
    }

    .work__mark {
      inline-size: 14px;
      flex: none;
    }

    .work__ms {
      margin-inline-start: auto;
      color: var(--color-accent-green);
      font-variant-numeric: tabular-nums;
    }

    .out {
      position: relative;
      margin: 0;
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      line-height: var(--leading-relaxed);
      color: var(--color-text-primary);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .out__cursor {
      display: inline-block;
      inline-size: 2px;
      block-size: 1em;
      vertical-align: text-bottom;
      background: var(--color-accent-green);
      animation: crucible-cursor 0.8s steps(1) infinite;
    }

    .field {
      position: relative;
      display: block;
      inline-size: 100%;
      box-sizing: border-box;
      background: transparent;
      border: none;
      border-block-end: var(--border-width-thin) solid var(--_hairline);
      color: var(--color-text-primary);
      padding: var(--space-1) 0;
    }

    .field:focus-visible {
      outline: none;
      border-block-end-color: var(--color-accent-amber);
    }

    .field--title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      letter-spacing: var(--tracking-brutalist);
      text-transform: uppercase;
      margin-block-end: var(--space-2);
    }

    .field--body {
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      line-height: var(--leading-relaxed);
      min-block-size: 150px;
      resize: vertical;
      border: none;
    }

    .fail {
      position: relative;
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      line-height: var(--leading-relaxed);
      color: var(--color-danger);
      margin: 0;
    }

    /* ── Linse ───────────────────────────────────────────────────────────── */

    .lens {
      display: grid;
      grid-template-columns: 80px 1fr;
      row-gap: var(--space-2-5);
      column-gap: var(--space-3-5);
      align-items: center;
    }

    .lens__row {
      display: flex;
      align-items: center;
      gap: var(--space-1-5);
      flex-wrap: wrap;
    }

    .lens__foot {
      grid-column: 1 / -1;
      font-family: var(--font-prose);
      font-style: italic;
      font-size: var(--text-sm);
      line-height: var(--leading-relaxed);
      color: var(--color-text-tertiary);
      margin: 0;
    }

    .impact {
      display: flex;
      align-items: flex-end;
      gap: 3px;
      block-size: 22px;
      padding: 0;
      background: transparent;
      border: none;
    }

    .impact__seg {
      inline-size: 6px;
      background: var(--color-border);
      cursor: pointer;
      padding: 0;
      border: none;
    }

    .impact__seg--on {
      background: var(--color-accent-amber);
    }

    .impact__seg:focus-visible {
      outline: none;
      box-shadow: var(--ring-focus);
    }

    .impact__value {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-sm);
      color: var(--color-accent-amber-readable);
      font-variant-numeric: tabular-nums;
    }

    .impact__of {
      color: var(--color-text-tertiary);
    }

    .sep {
      inline-size: var(--border-width-thin);
      block-size: 22px;
      background: var(--color-border);
      margin-inline: var(--space-1-5);
    }

    .instruction {
      inline-size: 100%;
      box-sizing: border-box;
      min-block-size: 34px;
      padding: var(--space-2) var(--space-2-5);
      font-family: var(--font-prose);
      font-size: var(--text-sm);
      line-height: var(--leading-normal);
      color: var(--color-text-secondary);
      background: var(--color-surface);
      border: var(--border-width-thin) solid var(--color-border);
      resize: vertical;
    }

    .instruction:focus-visible {
      outline: none;
      border-color: var(--color-accent-amber);
    }

    /* ── Varianten und Protokoll ─────────────────────────────────────────── */

    .variants {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      flex-wrap: wrap;
    }

    .variants__proto {
      margin-inline-start: auto;
    }

    .proto {
      background: var(--color-surface-sunken);
      display: grid;
      gap: var(--space-1);
    }

    .proto__line {
      display: grid;
      grid-template-columns: 120px 1fr;
      gap: var(--space-3-5);
      align-items: baseline;
    }

    .proto__value {
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      line-height: var(--leading-relaxed);
      color: var(--color-text-secondary);
      overflow-wrap: anywhere;
    }

    .proto__value--strong {
      color: var(--color-text-primary);
    }

    .proto__value--lens {
      color: var(--color-accent-amber-readable);
    }

    .proto__value--gap {
      color: var(--color-text-tertiary);
      font-style: italic;
    }

    /* ── Fusszeile ───────────────────────────────────────────────────────── */

    .act--last {
      margin-inline-start: auto;
    }

    .foot {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      flex-wrap: wrap;
    }

    /* ── Unter 860: gestapelt ────────────────────────────────────────────── */

    @container (max-width: 860px) {
      .split {
        grid-template-columns: 1fr;
      }
      .divider {
        block-size: 4px;
      }
      .divider__sweep {
        inset-inline: auto;
        inset-block: 0;
        inline-size: 56px;
        block-size: auto;
        animation-name: crucible-sweep-h;
      }
      .lens {
        grid-template-columns: 1fr;
        row-gap: var(--space-1-5);
      }
      .proto__line {
        grid-template-columns: 1fr;
        gap: var(--space-0-5);
      }
      .row {
        padding-inline: var(--space-4);
      }
      .half {
        padding-inline: var(--space-4);
      }
    }

    @keyframes crucible-sweep {
      from {
        transform: translateY(-60px);
      }
      to {
        transform: translateY(320px);
      }
    }

    @keyframes crucible-sweep-h {
      from {
        transform: translateX(-60px);
      }
      to {
        transform: translateX(900px);
      }
    }

    @keyframes crucible-pulse {
      50% {
        opacity: 0.45;
      }
    }

    @keyframes crucible-cursor {
      50% {
        opacity: 0;
      }
    }

    /*
     * Reduzierte Bewegung: der Laufstreifen verschwindet, statt still auf
     * seiner Startposition zu stehen — ein eingefrorener Balken mitten im
     * Trennbalken sähe aus wie ein Fehler. Der Zustand „arbeitet" steht
     * ohnehin im Wort daneben, nicht nur in der Bewegung.
     */
    @media (prefers-reduced-motion: reduce) {
      .divider__sweep {
        display: none;
      }
      .steps__arrow--live,
      .badge--live,
      .out__cursor {
        animation: none;
      }
    }
  `,
  ];

  @property({ type: Boolean, reflect: true }) open = false;

  /** Die Welt, in deren Sprache das Signal übersetzt wird. */
  @property({ type: String }) simulationId = '';

  /** Das Signal aus `intakeState`. Leer heisst: nichts zu tun. */
  @property({ type: String, attribute: 'signal-id' }) signalId = '';

  /**
   * Linse ändern statt in die Quarantäne schieben.
   *
   * Aus Kammer ② heraus: das Signal steht schon dort, es soll nur eine andere
   * Linse bekommen. Der Unterschied betrifft genau zwei Dinge — die
   * Überschrift und ob `toQuarantine` läuft.
   */
  @property({ type: Boolean, attribute: 'edit-lens' }) editLens = false;

  @state() private _lens: IntakeLens | null = null;
  @state() private _phase: CruciblePhase = 'idle';
  @state() private _stepIndex = 0;
  @state() private _elapsed = 0;
  @state() private _typed = '';
  @state() private _title = '';
  @state() private _body = '';
  @state() private _variants: CrucibleVariant[] = [];
  @state() private _variantIndex = 0;
  @state() private _protocolOpen = false;
  @state() private _error: string | null = null;

  private _typeTimer: ReturnType<typeof setInterval> | null = null;
  private _clockTimer: ReturnType<typeof setInterval> | null = null;

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._stopTimers();
  }

  protected override willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (!changed.has('open')) return;
    if (this.open) {
      this._begin();
      return;
    }
    this._stopTimers();
  }

  // ── Signal und Linse ──────────────────────────────────────────────────────

  private _signal(): IntakeSignal | undefined {
    if (!this.signalId) return undefined;
    return intakeState.get(this.signalId);
  }

  /**
   * Die Vorgabe-Linse.
   *
   * Der Vektor bekommt bewusst KEINE Ableitung aus der Kategorie: welchen Kanal
   * eine Welt für eine Nachricht öffnet, ist die Entscheidung, um die es im
   * Schmelztiegel geht. Eine Tabelle, die sie vorwegnimmt, würde in neun von
   * zehn Fällen durchgewinkt. `resonance` ist der neutrale der sieben Werte.
   */
  private _defaultLens(signal: IntakeSignal): IntakeLens {
    const zones = intakeState.zones.value;
    const types = appState.getTaxonomiesByType('event_type');
    const defaultType = types.find((t) => t.is_default) ?? types[0];
    return {
      zone: zones[0]?.id ?? '',
      vector: 'resonance',
      tone: 'official',
      type: defaultType?.value ?? '',
      impact: Math.min(10, Math.max(1, Math.round(signal.magnitude * 10))),
      react: true,
      n: DEFAULT_REACTION_COUNT,
      witnesses: [],
      creativity: 0.7,
      instructions: '',
    };
  }

  private _begin(): void {
    const signal = this._signal();
    if (!signal) return;

    this._lens = signal.lens ?? this._defaultLens(signal);
    this._variants = [];
    this._variantIndex = 0;
    this._protocolOpen = false;
    this._error = null;
    this._typed = '';
    this._title = signal.proposal?.title ?? '';
    this._body = signal.proposal?.body ?? '';

    void intakeState.loadZones(this.simulationId).then(() => {
      if (this._lens && !this._lens.zone) {
        this._lens = { ...this._lens, zone: intakeState.zones.value[0]?.id ?? '' };
      }
    });

    /*
     * Eine bereits erzeugte Fassung wird NICHT neu erzeugt. „Linse ändern"
     * öffnet den Schmelztiegel über einem Vorschlag, der schon einen Aufruf
     * gekostet hat; ihn ungefragt zu wiederholen wäre teuer und würde eine
     * Fassung wegwerfen, die jemand gelesen und behalten hat.
     */
    if (signal.proposal) {
      this._phase = 'done';
      return;
    }
    void this._run();
  }

  private _patchLens(patch: Partial<IntakeLens>): void {
    if (!this._lens) return;
    this._lens = { ...this._lens, ...patch };
  }

  // ── Erzeugung ─────────────────────────────────────────────────────────────

  /**
   * Die drei Schritte, die wirklich stattfinden.
   *
   * `GenerationStep` kommt aus `shared/GenerationProgress.ts` — dasselbe
   * Vokabular wie überall sonst im Haus, nur ohne dessen Vollbild-Auflage.
   */
  private _steps(): GenerationStep[] {
    return [
      { id: 'handover', label: msg('Signal handed over') },
      { id: 'model', label: msg('Model answering') },
      { id: 'settle', label: msg('Answer set') },
    ];
  }

  private _stopTimers(): void {
    if (this._typeTimer) clearInterval(this._typeTimer);
    if (this._clockTimer) clearInterval(this._clockTimer);
    this._typeTimer = null;
    this._clockTimer = null;
  }

  private async _run(): Promise<void> {
    const signal = this._signal();
    if (!signal || !this.simulationId) return;

    this._stopTimers();
    this._phase = 'reading';
    this._stepIndex = 0;
    this._elapsed = 0;
    this._typed = '';
    this._error = null;

    const started = Date.now();
    this._clockTimer = setInterval(() => {
      this._elapsed = Date.now() - started;
    }, 100);

    try {
      this._stepIndex = 1;
      const resp = await socialTrendsApi.transformArticle(this.simulationId, {
        ...transformRequestOf(signal),
        /*
         * Die Linse geht MIT (Lücke 4, Migration 341). Der Ort als NAME, nicht
         * als Kennung: im Zustand steht die ID, weil ein Name umbenannt wird —
         * das Modell aber schreibt Prosa und kann mit einer UUID nichts
         * anfangen. `zoneName` löst hier auf, an der einen Stelle, an der die
         * Auflösung hingehört.
         */
        lens: this._lens
          ? {
              zone_name: intakeState.zoneName(this._lens.zone) || undefined,
              vector: this._lens.vector,
              tone: this._lens.tone,
              instructions: this._lens.instructions?.trim() || undefined,
              creativity: this._lens.creativity,
            }
          : undefined,
      });
      const ms = Date.now() - started;
      if (this._clockTimer) clearInterval(this._clockTimer);
      this._clockTimer = null;
      this._elapsed = ms;

      if (!resp.success || !resp.data) {
        this._phase = 'error';
        this._error = resp.error?.message ?? msg('The crucible stayed cold. No answer arrived.');
        return;
      }

      const t = resp.data.transformation;
      const body = (t.narrative || t.content || '').trim();
      const title = (t.title || signal.headline).trim();

      /*
       * Der Vorschlag des Modells zu Typ und Wucht wird ÜBERNOMMEN, nicht
       * verworfen: er ist die einzige Stelle, an der das Modell etwas über die
       * Einordnung sagt. Der Mensch kann ihn danach mit einem Klick ändern —
       * das ist der Unterschied zwischen einem Vorschlag und einer Vorgabe.
       */
      if (t.event_type) this._patchLens({ type: t.event_type });
      if (t.impact_level) this._patchLens({ impact: t.impact_level });

      this._variants = [
        ...this._variants,
        {
          title,
          body,
          tone: this._lens?.tone ?? 'official',
          creativity: this._lens?.creativity ?? 0.7,
          ms,
          model: t.model_used ?? '',
        },
      ];
      this._variantIndex = this._variants.length - 1;
      this._title = title;
      this._stepIndex = 2;
      this._startTyping(body);
    } catch (err) {
      captureError(err, { source: 'VelgIntakeCrucibleModal._run' });
      this._stopTimers();
      this._phase = 'error';
      this._error = err instanceof Error ? err.message : msg('The crucible stayed cold.');
    }
  }

  /**
   * Die Antwort schreiben lassen.
   *
   * Der Text IST schon da — das Schreiben zeigt keinen Fortschritt, sondern
   * gibt dem Lesen einen Anfang. Wer Bewegung abbestellt hat, bekommt ihn
   * sofort ganz; ein Text, der bei reduzierter Bewegung tröpfelt, wäre der
   * Fall, gegen den die Einstellung existiert.
   */
  private _startTyping(full: string): void {
    this._body = full;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this._typed = full;
      this._phase = 'done';
      return;
    }
    this._phase = 'typing';
    this._typed = '';
    let i = 0;
    this._typeTimer = setInterval(() => {
      i += TYPE_CHARS;
      this._typed = full.slice(0, i);
      if (i < full.length) return;
      this._stopTimers();
      this._phase = 'done';
    }, TYPE_TICK);
  }

  /** Eine weitere Fassung holen. Kostet einen Aufruf, also ein eigener Knopf. */
  private _reroll(): void {
    this._stashEdits();
    void this._run();
  }

  /** Die offenen Änderungen in die gewählte Fassung zurückschreiben. */
  private _stashEdits(): void {
    const current = this._variants[this._variantIndex];
    if (!current) return;
    if (current.title === this._title && current.body === this._body) return;
    const next = [...this._variants];
    next[this._variantIndex] = { ...current, title: this._title, body: this._body };
    this._variants = next;
  }

  private _selectVariant(index: number): void {
    const variant = this._variants[index];
    if (!variant) return;
    this._stashEdits();
    this._stopTimers();
    this._variantIndex = index;
    this._title = variant.title;
    this._body = variant.body;
    this._typed = variant.body;
    this._phase = 'done';
  }

  // ── Abschluss ─────────────────────────────────────────────────────────────

  private _close(): void {
    this._stopTimers();
    this.dispatchEvent(new CustomEvent('modal-close', { bubbles: true, composed: true }));
  }

  private _confirm(): void {
    const signal = this._signal();
    if (!signal || !this._lens) return;

    const proposal = { title: this._title.trim(), body: this._body.trim() };
    if (this.editLens) {
      intakeState.patch(signal.id, { lens: this._lens, proposal });
    } else {
      intakeState.toQuarantine(signal.id, { lens: this._lens, proposal });
    }

    VelgToast.success(this._confirmationLine(proposal.title));
    this.dispatchEvent(
      new CustomEvent('intake-staged', {
        bubbles: true,
        composed: true,
        detail: { signalId: signal.id, editLens: this.editLens },
      }),
    );
    this._close();
  }

  /**
   * Der Satz, der nach dem Klick dasteht.
   *
   * Er nennt die Folge in Klartext, nicht die Aktion: „steht in der Quarantäne"
   * sagt, wo die Sache jetzt liegt, „gespeichert" sagt nur, dass etwas geschah.
   */
  private _confirmationLine(title: string): string {
    const lens = this._lens;
    if (!lens) return msg('Saved.');
    // Kein Typ gewählt heisst kein Typ – nicht ersatzweise das Wucht-Wort.
    // Ein Rückfall, der eine andere Grösse einsetzt, liest sich wie eine
    // Angabe und ist keine.
    const type = taxonomyLabel('event_type', lens.type) || msg('no kind chosen');
    if (this.editLens) {
      return msg(str`Lens for "${title}" changed · ${type} · impact ${lens.impact}`);
    }
    let reactions = msg('without reactions');
    if (lens.react) reactions = msg(str`${lens.n} reactions`);
    return msg(str`"${title}" is in quarantine · ${type} · impact ${lens.impact} · ${reactions}`);
  }

  // ── Teile ─────────────────────────────────────────────────────────────────

  private _renderStepBar(signal: IntakeSignal) {
    const live = this._phase === 'reading' || this._phase === 'typing';
    const archetype = signal.category ? CATEGORY_ARCHETYPE[signal.category] : '';
    let thirdClass = 'steps__item';
    if (live) thirdClass = 'steps__item steps__item--live';
    else if (this._phase === 'done') thirdClass = 'steps__item steps__item--done';

    return html`
      <div class="row steps">
        <span class="steps__item steps__item--done">${msg('1 Signal')}</span>
        <span class="steps__arrow" aria-hidden="true">&gt;&gt;&gt;</span>
        <span class="steps__item steps__item--lens">${msg('2 Lens')}</span>
        <span
          class="steps__arrow ${live ? 'steps__arrow--live' : ''}"
          aria-hidden="true"
        >&gt;&gt;&gt;</span>
        <span class=${thirdClass}>${msg('3 World')}</span>
        <span class="steps__meta">
          ${signal.source}
          ${
            archetype
              ? html` ·
                <span class="arch">${icons.diamond(10)} ${archetypeLabel(archetype)}</span> ·
                ${signal.magnitude.toFixed(2)}`
              : nothing
          }
        </span>
      </div>
    `;
  }

  private _renderClipping(signal: IntakeSignal) {
    const observed = new Date(signal.observedAt);
    let byline = signal.source;
    if (!Number.isNaN(observed.getTime())) byline = observed.toLocaleDateString();

    return html`
      <div class="half">
        <h3 class="half__head">${msg('Reality')}</h3>
        <article class="clipping">
          <h4 class="clipping__headline">${signal.headline}</h4>
          ${
            signal.abstract
              ? html`<p class="clipping__abstract">${signal.abstract}</p>`
              : html`<p class="clipping__abstract">
                  ${msg('The source sent a headline and nothing else.')}
                </p>`
          }
          <div class="clipping__by">
            <span class="clipping__src">${byline}</span>
            <span class="clipping__src">${signal.source}</span>
            ${
              signal.url
                ? html`<a
                    class="clipping__link"
                    href=${signal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    >${msg('Open the source')} ${icons.externalLink(11)}</a
                  >`
                : nothing
            }
          </div>
        </article>
      </div>
    `;
  }

  private _renderWork() {
    const steps = this._steps();
    return html`
      <div class="work">
        ${steps.map((step, i) => {
          let cls = 'work__step';
          let mark = '·';
          if (i < this._stepIndex) {
            cls = 'work__step work__step--done';
            mark = '+';
          } else if (i === this._stepIndex) {
            cls = 'work__step work__step--active';
            mark = '>';
          }
          return html`
            <div class=${cls}>
              <span class="work__mark" aria-hidden="true">${mark}</span>
              <span>${step.label}</span>
              ${
                i === this._stepIndex
                  ? html`<span class="work__ms">${Math.round(this._elapsed / 100) / 10} s</span>`
                  : nothing
              }
            </div>
          `;
        })}
      </div>
    `;
  }

  private _renderTerminal() {
    const live = this._phase === 'reading' || this._phase === 'typing';
    let badge = msg('Done');
    if (this._phase === 'reading') badge = msg('Working');
    else if (this._phase === 'typing') badge = msg('Writing');
    else if (this._phase === 'error') badge = msg('Failed');

    const zoneName = intakeState.zoneName(this._lens?.zone ?? '');
    let heading = msg('World');
    if (zoneName) heading = msg(str`World · ${zoneName}`);

    return html`
      <div class="half">
        <h3 class="half__head half__head--world">
          <span>${heading}</span>
          <span class="badge ${live ? 'badge--live' : ''}">${badge}</span>
        </h3>
        <div class="terminal ${live ? 'terminal--live' : ''}">
          <span class="terminal__scan" aria-hidden="true"></span>
          ${this._renderTerminalContent()}
        </div>
      </div>
    `;
  }

  private _renderTerminalContent() {
    if (this._phase === 'error') {
      return html`<p class="fail" role="alert">${this._error}</p>`;
    }
    if (this._phase === 'reading') return this._renderWork();
    if (this._phase === 'typing') {
      return html`<p class="out">${this._typed}<span class="out__cursor"></span></p>`;
    }
    if (this._phase === 'idle') {
      return html`<p class="out">${msg('Nothing has been forged yet.')}</p>`;
    }
    return html`
      <div class="out">
        <input
          class="field field--title"
          .value=${this._title}
          aria-label=${msg('Title of the event')}
          @input=${(e: Event) => {
            this._title = (e.target as HTMLInputElement).value;
          }}
        />
        <textarea
          class="field field--body"
          .value=${this._body}
          aria-label=${msg('Text of the event')}
          @input=${(e: Event) => {
            this._body = (e.target as HTMLTextAreaElement).value;
          }}
        ></textarea>
      </div>
    `;
  }

  private _renderChips<T>(
    values: readonly T[],
    label: (v: T) => string,
    active: (v: T) => boolean,
    pick: (v: T) => void,
    green = false,
  ) {
    return values.map(
      (v) => html`
        <button
          type="button"
          class="chip ${green ? 'chip--green' : ''} ${active(v) ? 'chip--on' : ''}"
          aria-pressed=${String(active(v))}
          @click=${() => pick(v)}
        >
          ${label(v)}
        </button>
      `,
    );
  }

  private _renderLens() {
    const lens = this._lens;
    if (!lens) return nothing;
    const zones = intakeState.zones.value;
    const types = appState.getTaxonomiesByType('event_type');
    const creativity = lens.creativity ?? 0.7;
    const mark = LENS_REACHES_MODEL ? '' : ' °';

    return html`
      <div class="row lens">
        <span class="label">${msg('Place')}${mark}</span>
        <div class="lens__row">
          ${
            zones.length === 0
              ? html`<span class="note">${msg('This world has no zones yet.')}</span>`
              : this._renderChips(
                  zones,
                  (z) => z.name,
                  (z) => z.id === lens.zone,
                  (z) => this._patchLens({ zone: z.id }),
                )
          }
        </div>

        <span class="label">${msg('Vector')}${mark}</span>
        <div class="lens__row">
          ${this._renderChips(
            BLEED_VECTORS,
            (v) => bleedVectorLabel(v),
            (v) => v === lens.vector,
            (v) => this._patchLens({ vector: v }),
          )}
        </div>

        <span class="label">${msg('Tone')}${mark}</span>
        <div class="lens__row">
          ${this._renderChips(
            INTAKE_TONES,
            (t) => toneLabel(t),
            (t) => t === lens.tone,
            (t) => this._patchLens({ tone: t }),
          )}
        </div>

        <span class="label">${msg('Kind · impact')}</span>
        <div class="lens__row">
          ${
            types.length === 0
              ? html`<span class="note">${msg('This world has no event kinds yet.')}</span>`
              : this._renderChips(
                  types,
                  (t) => taxonomyLabel('event_type', t.value),
                  (t) => t.value === lens.type,
                  (t) => this._patchLens({ type: t.value }),
                )
          }
          <span class="sep" aria-hidden="true"></span>
          <span
            class="impact"
            role="group"
            aria-label=${msg('Impact from 1 to 10')}
          >
            ${Array.from({ length: 10 }, (_, i) => {
              const value = i + 1;
              return html`<button
                type="button"
                class="impact__seg ${value <= lens.impact ? 'impact__seg--on' : ''}"
                style="block-size:${8 + i * 1.4}px"
                aria-label=${msg(str`Impact ${value}`)}
                aria-pressed=${String(value === lens.impact)}
                @click=${() => this._patchLens({ impact: value })}
              ></button>`;
            })}
          </span>
          <span class="impact__value"
            >${lens.impact}<span class="impact__of">/10</span></span
          >
          <span class="note">${impactWord(lens.impact)}</span>
          <span class="note">${msg('changes the admission, not the text')}</span>
        </div>

        <span class="label">${msg('Reactions')}</span>
        <div class="lens__row">
          <button
            type="button"
            class="chip chip--green ${lens.react ? 'chip--on' : ''}"
            aria-pressed=${String(lens.react)}
            @click=${() => this._patchLens({ react: !lens.react })}
          >
            ${msg('Generate')}
          </button>
          ${this._renderChips(
            REACTION_COUNTS,
            (n) => String(n),
            (n) => n === lens.n && lens.react,
            (n) => this._patchLens({ n, react: true }),
          )}
          <span class="note">${msg('agents answering in the world')}</span>
        </div>

        <span class="label">${msg('Freedom')}${mark}</span>
        <div class="lens__row">
          ${this._renderChips(
            INTAKE_FREEDOMS,
            (c) => freedomLabel(c),
            (c) => c === creativity,
            (c) => this._patchLens({ creativity: c }),
          )}
          <span class="note">${freedomNote(creativity)}</span>
        </div>

        <span class="label">${msg('Instruction')}${mark}</span>
        <textarea
          class="instruction"
          .value=${lens.instructions ?? ''}
          placeholder=${msg('One sentence to the writer, if you have one.')}
          aria-label=${msg('Instruction to the writer')}
          @input=${(e: Event) => {
            this._patchLens({ instructions: (e.target as HTMLTextAreaElement).value });
          }}
        ></textarea>

        ${
          LENS_REACHES_MODEL
            ? nothing
            : html`<p class="lens__foot">
                ${msg(
                  '° Place, vector, tone, freedom and instruction do not reach the model yet – the call takes no lens. They are kept with the signal and take effect once it does. Kind, impact and reactions are already in force: they travel with the admission.',
                )}
              </p>`
        }
      </div>
    `;
  }

  private _renderVariants() {
    const busy = this._phase === 'reading' || this._phase === 'typing';
    return html`
      <div class="row variants">
        <span class="label">${msg('Versions')}</span>
        ${this._variants.map(
          (v, i) => html`
            <button
              type="button"
              class="chip ${i === this._variantIndex ? 'chip--on' : ''}"
              aria-pressed=${String(i === this._variantIndex)}
              @click=${() => this._selectVariant(i)}
            >
              ${msg(str`V${i + 1} · ${toneLabel(v.tone)} · ${freedomLabel(v.creativity)}`)}
            </button>
          `,
        )}
        <button type="button" class="chip" ?disabled=${busy} @click=${this._reroll}>
          ${icons.refresh(11)} ${msg('Forge again')}
        </button>
        <button
          type="button"
          class="chip variants__proto ${this._protocolOpen ? 'chip--on' : ''}"
          aria-expanded=${String(this._protocolOpen)}
          @click=${() => {
            this._protocolOpen = !this._protocolOpen;
          }}
        >
          ${msg('Call record')}
        </button>
      </div>
      ${this._protocolOpen ? this._renderProtocol() : nothing}
    `;
  }

  /**
   * Das Aufruf-Protokoll.
   *
   * Nur Gemessenes. Der Prototyp führte hier Vorlagenname, Seed und Tokenzahl —
   * keines davon liefert `transform-article`, und eine erfundene Tokenzahl in
   * einem Protokoll ist schlimmer als gar keine: ein Protokoll wird gelesen,
   * WEIL man den Zahlen glaubt.
   */
  private _renderProtocol() {
    const signal = this._signal();
    const lens = this._lens;
    if (!signal || !lens) return nothing;
    const variant = this._variants[this._variantIndex];

    const zoneName = intakeState.zoneName(lens.zone) || msg('none chosen');
    const archetype = signal.category ? archetypeLabel(CATEGORY_ARCHETYPE[signal.category]) : '';
    const model = variant?.model || msg('not reported');
    let call = msg('running');
    if (variant) call = msg(str`${model} · ${variant.ms} ms measured`);

    let admission = msg('without reactions');
    if (lens.react) admission = msg(str`${lens.n} agent reactions`);
    const kind = taxonomyLabel('event_type', lens.type) || msg('no kind chosen');

    const lines: Array<{ key: string; value: string; cls: string }> = [
      { key: msg('Call'), value: call, cls: 'proto__value proto__value--strong' },
      {
        key: msg('Signal'),
        value: msg(
          str`${signal.source} · "${signal.headline}" · ${archetype} · magnitude ${signal.magnitude.toFixed(2)}`,
        ),
        cls: 'proto__value',
      },
      {
        key: msg('Sent along'),
        value: msg('title, platform, URL and the raw record of the source'),
        cls: 'proto__value',
      },
      {
        /*
         * Hiess bis zum 02.09.2026 „Nur behalten" — die Linse wurde am Signal
         * gespeichert und ging NICHT mit. Seit Migration 341 geht sie mit, und
         * das Protokoll muss das sagen: es ist der Schirm, auf dem jemand
         * nachliest, was das Modell wirklich bekommen hat.
         */
        key: msg('Lens sent'),
        value: msg(
          str`place ${zoneName} · vector ${bleedVectorLabel(lens.vector)} · tone ${toneLabel(lens.tone)}`,
        ),
        cls: 'proto__value proto__value--lens',
      },
      {
        key: msg('Freedom'),
        value: msg(
          str`${freedomLabel(lens.creativity ?? 0.7)} · temperature ${(lens.creativity ?? 0.7).toFixed(1)}, overriding the template`,
        ),
        cls: 'proto__value proto__value--lens',
      },
      {
        key: msg('Admission'),
        value: msg(str`${kind} · impact ${lens.impact}/10 · ${admission}`),
        cls: 'proto__value',
      },
      {
        key: msg('Output'),
        value: msg(
          str`${this._variants.length} versions · V${this._variantIndex + 1} chosen · editable before it moves on`,
        ),
        cls: 'proto__value',
      },
    ];

    /*
     * Was von der alten Lücken-Zeile ÜBRIG BLEIBT.
     *
     * Sie sagte zweierlei: der Aufruf nehme keine Linse, und er melde weder
     * Schritte noch Token. Die erste Hälfte ist seit Migration 341 falsch, die
     * zweite stimmt weiter — `transform-article` antwortet mit der
     * Verwandlung und sonst nichts. Eine Zeile, deren eine Hälfte falsch
     * geworden ist, wird nicht gelöscht, sondern auf ihre wahre Hälfte
     * gekürzt.
     */
    lines.splice(5, 0, {
      key: msg('Gap'),
      value: msg('The call reports no steps and no token count.'),
      cls: 'proto__value proto__value--gap',
    });

    return html`
      <div class="row proto">
        ${lines.map(
          (l) => html`
            <div class="proto__line">
              <span class="label">${l.key}</span>
              <span class=${l.cls}>${l.value}</span>
            </div>
          `,
        )}
      </div>
    `;
  }

  private _renderFooter() {
    const busy = this._phase === 'reading' || this._phase === 'typing';
    let status = msg('Done · the text can be edited');
    if (this._phase === 'reading') status = msg('Waiting for the model');
    else if (this._phase === 'typing') status = msg('Setting the answer');
    else if (this._phase === 'error') status = msg('Nothing came back');
    else if (this._phase === 'idle') status = msg('Nothing loaded');

    let confirmLabel = msg('To quarantine');
    if (this.editLens) confirmLabel = msg('Keep this lens');

    return html`
      <div class="foot">
        <span class="note">${status}</span>
        <button type="button" class="act act--last" @click=${this._close}>
          ${msg('Discard')}
        </button>
        <button
          type="button"
          class="act act--primary"
          ?disabled=${busy || !this._body.trim()}
          @click=${this._confirm}
        >
          ${confirmLabel}
        </button>
      </div>
    `;
  }

  protected render() {
    const signal = this._signal();
    let heading = msg('Crucible · signal into world');
    if (this.editLens) heading = msg('Change the lens');

    return html`
      <velg-base-modal
        ?open=${this.open}
        modal-name="intake-crucible"
        @modal-close=${this._close}
      >
        <span slot="header">${heading}</span>
        ${
          signal
            ? html`
                <div class="body">
                  ${this._renderStepBar(signal)}
                  <div class="split">
                    ${this._renderClipping(signal)}
                    <div
                      class="divider ${this._phase === 'reading' ? 'divider--live' : ''}"
                      aria-hidden="true"
                    >
                      ${
                        this._phase === 'reading'
                          ? html`<span class="divider__sweep"></span>`
                          : nothing
                      }
                    </div>
                    ${this._renderTerminal()}
                  </div>
                  ${this._renderLens()} ${this._renderVariants()}
                </div>
              `
            : html`<p class="row note">${msg('This signal is no longer in the airlock.')}</p>`
        }
        <div slot="footer">${this._renderFooter()}</div>
      </velg-base-modal>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-intake-crucible-modal': VelgIntakeCrucibleModal;
  }
}
