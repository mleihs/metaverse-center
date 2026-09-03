/**
 * Die Sichtung — wo aus einer Menge eine Auswahl wird.
 *
 * Schritt 5 aus `handoff/schleuse-event-intake.md`. Kammer ① zeigt, was
 * aufgenommen IST; hier liegt, was noch niemand angesehen hat. Der Scanner
 * liefert je Zyklus mehr, als ein Mensch lesen will (83 Kandidaten aus vier
 * Quellen am 02.09.), und ohne diese Kammer ist das Brett eine Anzeige ohne
 * Griff.
 *
 * ── WARUM KARTEN UND NICHT ZEILEN ───────────────────────────────────────────
 *
 * Der Bauplan beschreibt Zeilen (`28px 1fr 130px 80px 210px`). Gebaut ist ein
 * gleichförmiges Kartenraster, und der Grund ist gemessen, nicht ästhetisch:
 * vier der sechs aktiven Quellen tragen ein Vorschaubild
 * (Guardian · NewsAPI · GDELT · Bluesky, jeweils unter einem anderen Namen,
 * siehe `imageOf`), die vier Messdienste tragen nie eines. Eine Zeile mit
 * Bildfach ist für beide Fälle falsch: mit Bild wird sie zu hoch, ohne Bild
 * bleibt ein Loch. Eine Karte mit optionalem Bildfach sieht in beiden Fällen
 * aus wie sie selbst.
 *
 * ⚠ NICHT MASONRY, und das ist ausdrücklich entschieden
 * (`handoff/schleuse-sensorleiste-kaputt-2026-09-02.md`): die Sichtung ist eine
 * RANGLISTE. Sie sortiert, und die Reihenfolge IST die Auskunft. Ein Layout,
 * das visuell in Spalten umordnet, wirft die Sortierung weg und bricht dazu
 * WCAG 2.4.3, weil jede Karte fokussierbare Knöpfe trägt. Das Zeilen-Spannweiten-
 * Raster aus jenem Dokument gehört dem LESESAAL (Schritt 6) — einer Stöber-
 * fläche ohne Rang. Die Resume-Notiz führt es der Sichtung zu; sie irrt.
 *
 * ── EIN REGLER, DER NICHTS BEWEGT, UND ES SAGT ──────────────────────────────
 *
 * „Passung" und „Netz-Tempo" standen beide still, weil beide Zahlen fehlten.
 * Seit Migration 345 liefert die Story-Bündelung `social_volume` — **Netz-Tempo
 * arbeitet, Passung nicht.** Der gemeinsame Schalter musste dafür in zwei
 * zerfallen; einer für zwei Bedingungen wäre ab dem Tag falsch gewesen, an dem
 * die erste kippt.
 *
 * `fit` ist an jedem Signal weiterhin `undefined` (Lücke 3).
 *
 * Eine Heuristik wäre hier schlimmer als die Lücke: die einzigen Zahlen, aus
 * denen das Frontend etwas bauen könnte, sind Magnitude und Alter — beide
 * stehen schon als eigene Sortierung daneben. Eine „Passung", die heimlich die
 * Magnitude ist, trägt die Gestalt einer zweiten, unabhängigen Messung. Die
 * beiden Knöpfe sind deshalb DA, abgeschaltet und mit einer Fussnote versehen.
 * `BUREAU_RANKS_THE_SIGNALS` ist der eine Schalter, der beides wieder anmacht.
 *
 * ── EINE ZAHL, DIE NICHT IM CODE STEHT ──────────────────────────────────────
 *
 * „◆ empfohlen" hängt an `intakeState.recommendedThreshold` — der Server
 * rechnet sie aus der Verteilung der wartenden Kandidaten (oberste 20 %, Boden
 * 0.40). Der Bauplan nennt fest 0.40; das ist genau der Boden dieser Rechnung
 * und damit ihr schwächster Fall. An einem Tag mit 44 NOAA-Unwetterwarnungen
 * empfiehlt eine feste 0.40 die halbe Liste.
 */

import { localized, msg, str } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { scannerApi } from '../../services/api/index.js';
import { intakeState } from '../../services/IntakeStateManager.js';
import { captureError } from '../../services/SentryService.js';
import {
  CATEGORY_RESONANCE,
  type IntakeSignal,
  type IntakeSourceKind,
  isScanCandidate,
} from '../../types/intake.js';
import { formatRelativeTime } from '../../utils/date-format.js';
import { icons } from '../../utils/icons.js';
import { VelgToast } from '../shared/Toast.js';
import '../shared/BaseModal.js';
import '../shared/EmptyState.js';
import '../shared/LoadingState.js';
import { archetypeLabel } from './intake-labels.js';
import {
  intakeControlStyles,
  intakeKindColorStyles,
  intakeToolbarStyles,
} from './intake-styles.js';

/**
 * Liefert das Bureau eine PASSUNG je Kandidat und Welt? (Lücke 3)
 *
 * ⚠ EIN SCHALTER FÜR ZWEI DINGE WAR EINER ZU WENIG. Bis zum 02.09.2026 stand
 * hier `BUREAU_RANKS_THE_SIGNALS` und schaltete „Passung" UND „Netz-Tempo"
 * gemeinsam ab, weil beide Zahlen fehlten. Mit Migration 345 kam
 * `social_volume` — und ein gemeinsamer Schalter hätte entweder eine
 * arbeitende Sortierung weiter gesperrt oder eine tote freigegeben.
 *
 * 🔑 Zwei Bedingungen, die zufällig denselben Wert haben, sind nicht eine.
 * Sobald eine von beiden kippt, wird der gemeinsame Schalter für die andere
 * falsch — und zwar lautlos.
 *
 * ✅ SEIT DEM 02.09.2026 JA — und zwar OHNE eine erfundene Formel.
 *
 * Der Bauplan schlug „Kategorie↔Zone-Match, Agenten-Rollen-Match,
 * Vektor-Verfügbarkeit" vor. Alle drei wären Erfindungen mit einer Gewichtung,
 * die niemand belegen kann, und das Ergebnis sähe hinterher wie ein Messwert
 * aus. Genommen wird stattdessen die Zahl, die das Spiel SCHON HAT: die
 * Suszeptibilität dieser Welt für diese Signatur — derselbe Wert, mit dem der
 * Resonanzlauf entscheidet, wie hart etwas einschlägt.
 *
 * 🔑 Wo eine Zahl erfunden werden müsste, lohnt zuerst die Frage, ob das Spiel
 * sie nicht schon führt.
 *
 * ⚠ Sie hängt an (Welt, SIGNATUR), nicht am einzelnen Signal: zwei
 * Unwetterwarnungen haben dieselbe Passung. Das ist die Aussage, nicht ihre
 * Vereinfachung — Passung sagt „wie sehr geht diese ART von Sache diese Welt
 * an", die Magnitude sagt „wie gross ist DIESE hier". Zwei Achsen, zwei
 * Sortierungen.
 */
const BUREAU_SCORES_THE_FIT = true;

/**
 * Liefert der Zufluss eine Netz-Reichweite? (Lücke 2 — seit 02.09.2026 ja)
 *
 * `social_volume` kommt aus der Story-Bündelung: Likes und Reposts der
 * Sozialquellen, die zu DERSELBEN Geschichte beigetragen haben (Migration 345).
 *
 * ⚠ `0` heisst „keine gemessen", nicht „niemand hat reagiert" — heute liefert
 * nur Bluesky solche Zahlen, und nur zu Geschichten, die eine
 * Nachrichtenquelle schon gemeldet hat. Eine Sortierung nach Netz-Tempo zeigt
 * deshalb oben, was im Netz besprochen WURDE, und darunter alles, worüber
 * nichts bekannt ist — nicht alles, worüber geschwiegen wurde.
 */
const NET_REACH_IS_MEASURED = true;

/** Wie viele „die stärksten" aufnimmt. */
const TOP_PICK_COUNT = 5;

/** Die Magnitude-Stufen des Filters. `null` heisst „die empfohlene". */
const MAGNITUDE_STEPS: readonly (number | null)[] = [0, 0.2, 0.4, null];

type TriageSort = 'magnitude' | 'new' | 'fit' | 'velocity';

@localized()
@customElement('velg-intake-triage-modal')
export class VelgIntakeTriageModal extends SignalWatcher(LitElement) {
  static styles = [
    intakeControlStyles,
    intakeKindColorStyles,
    intakeToolbarStyles,
    css`
      :host {
        display: block;
        --modal-max-width: min(1500px, calc(100vw - 2 * var(--stage-gutter)));
        /*
         * Die Sichtung ist randlos: das Raster stellt seinen eigenen Abstand,
         * und die Werkzeugleiste soll bis an die Kante laufen.
         */
        --modal-body-padding: 0;

        --_rail: 230px;
        --_card-min: 280px;
        --_sel: var(--color-accent-amber);
        --_sel-fill: color-mix(in srgb, var(--color-accent-amber) 10%, transparent);
      }

      /* ── Werkzeugleiste ─────────────────────────────────────────────── */

      .search {
        flex: 1 1 220px;
        min-inline-size: 160px;
        padding: var(--space-2) var(--space-2-5);
        font-family: var(--font-mono);
        font-size: var(--text-sm);
        color: var(--color-text-primary);
        background: var(--color-surface);
        border: var(--border-width-thin) solid var(--color-border);
      }

      .search:focus-visible {
        outline: none;
        border-color: var(--color-accent-amber);
      }

      .group {
        display: flex;
        align-items: center;
        gap: var(--space-1-5);
      }

      .keys {
        margin-inline-start: auto;
        display: flex;
        align-items: center;
        gap: var(--space-2);
      }

      kbd {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        padding: 1px var(--space-1);
        border: var(--border-width-thin) solid var(--color-border);
        color: var(--color-text-secondary);
      }

      /* ── Rumpf: Schiene + Raster ────────────────────────────────────── */

      .split {
        display: grid;
        grid-template-columns: var(--_rail) minmax(0, 1fr);
        align-items: start;
      }

      .rail {
        padding: var(--space-4) var(--space-4) var(--space-6);
        border-inline-end: var(--border-width-thin) solid var(--color-border-light);
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        position: sticky;
        inset-block-start: 0;
      }

      .rail__item {
        display: flex;
        align-items: baseline;
        gap: var(--space-2);
        inline-size: 100%;
        padding: var(--space-1-5) var(--space-2);
        background: transparent;
        border: var(--border-width-thin) solid transparent;
        color: var(--color-text-secondary);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        letter-spacing: var(--tracking-wide);
        text-transform: var(--label-transform);
        text-align: start;
        cursor: pointer;
        transition: border-color var(--transition-fast), opacity var(--transition-fast);
      }

      .rail__item:hover,
      .rail__item:focus-visible {
        border-color: var(--color-border);
      }

      .rail__item:focus-visible {
        outline: none;
        box-shadow: var(--ring-focus);
      }

      .rail__item--off {
        opacity: 0.45;
      }

      .rail__dot {
        inline-size: 7px;
        block-size: 7px;
        flex: none;
        align-self: center;
        background: var(--_kind);
      }

      .rail__name {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .rail__n {
        font-variant-numeric: tabular-nums;
        color: var(--color-text-muted);
      }

      /* ── Das Raster ─────────────────────────────────────────────────── */

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(var(--_card-min), 1fr));
        gap: var(--space-3);
        padding: var(--space-4) var(--space-5) var(--space-6);
        list-style: none;
        margin: 0;
      }

      .card {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        padding: var(--space-3);
        background: var(--color-surface-raised);
        border: var(--border-width-thin) solid var(--color-border-light);
        transition: border-color var(--transition-fast), background var(--transition-fast);
        animation: card-in var(--duration-entrance) var(--ease-dramatic) backwards;
        animation-delay: calc(var(--i, 0) * var(--duration-stagger));
      }

      @keyframes card-in {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      .card:hover {
        border-color: var(--color-border);
      }

      /*
       * Die Auswahl ist der GANZE Rahmen plus Füllung. Ein Balken an einer
       * Kante ist im Haus verboten (lint-no-accent-edge-bar.sh) — und wäre hier
       * auch falsch, weil eine Karte mehrere Ränder hat, an denen er stünde.
       */
      .card--on {
        border-color: var(--_sel);
        background: var(--_sel-fill);
      }

      .card--busy {
        opacity: 0.5;
      }

      /* Das Bildfach FÄLLT WEG, wenn es kein Bild gibt — kein leerer Platz. */
      .shot {
        aspect-ratio: 16 / 9;
        inline-size: 100%;
        object-fit: cover;
        background: var(--color-surface-sunken);
        border: var(--border-width-thin) solid var(--color-border-light);
      }

      .meta {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        flex-wrap: wrap;
      }

      .arch {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        letter-spacing: var(--tracking-wider);
        text-transform: var(--label-transform);
        color: var(--color-accent-amber-readable);
      }

      .kind {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        letter-spacing: var(--tracking-wide);
        text-transform: var(--label-transform);
        color: var(--_kind);
      }

      .fit {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        letter-spacing: var(--tracking-wide);
        text-transform: var(--label-transform);
        color: var(--color-text-muted);
        font-variant-numeric: tabular-nums;
      }

      .fit--mid {
        color: var(--color-accent-amber-readable);
      }

      .fit--high {
        color: var(--color-accent-green);
      }

      .pick {
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-xs);
        letter-spacing: var(--tracking-wider);
        text-transform: var(--label-transform);
        color: var(--color-accent-green);
      }

      .headline {
        font-family: var(--font-prose);
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        line-height: var(--leading-snug);
        color: var(--color-text-primary);
        margin: 0;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
        text-wrap: pretty;
      }

      .mag {
        display: flex;
        align-items: center;
        gap: var(--space-2);
      }

      .mag__bar {
        flex: 1;
        block-size: 4px;
        background: var(--color-border-light);
      }

      .mag__fill {
        block-size: 100%;
        background: var(--color-accent-amber);
      }

      .mag__value {
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-xs);
        color: var(--color-accent-amber-readable);
        font-variant-numeric: tabular-nums;
      }

      .mag__value--unmeasured {
        color: var(--color-text-muted);
      }

      .srcs {
        display: flex;
        gap: var(--space-1);
        flex-wrap: wrap;
      }

      .src {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        letter-spacing: var(--tracking-wide);
        text-transform: var(--label-transform);
        padding: 1px var(--space-1);
        border: var(--border-width-thin) solid var(--color-border-light);
        color: var(--color-text-muted);
      }

      .row {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin-block-start: auto;
        padding-block-start: var(--space-2);
        border-block-start: var(--border-width-thin) solid var(--color-border-light);
      }

      .box {
        inline-size: 22px;
        block-size: 22px;
        flex: none;
        display: grid;
        place-items: center;
        font-family: var(--font-mono);
        font-size: var(--text-sm);
        background: transparent;
        border: var(--border-width-thin) solid var(--color-border);
        color: var(--color-text-secondary);
        cursor: pointer;
      }

      .box[aria-checked='true'] {
        border-color: var(--_sel);
        color: var(--_sel);
      }

      .box:focus-visible {
        outline: none;
        box-shadow: var(--ring-focus);
      }

      .row .act {
        padding: var(--space-1-5) var(--space-2);
      }

      .row__grow {
        flex: 1;
      }

      /* ── Fuss ───────────────────────────────────────────────────────── */

      .foot {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        flex-wrap: wrap;
      }

      .foot__spacer {
        margin-inline-start: auto;
      }

      .count {
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: var(--text-sm);
        color: var(--color-accent-amber-readable);
        font-variant-numeric: tabular-nums;
      }

      .foot__note {
        flex-basis: 100%;
      }

      @media (max-width: 900px) {
        .split {
          grid-template-columns: minmax(0, 1fr);
        }

        .rail {
          position: static;
          flex-direction: row;
          flex-wrap: wrap;
          border-inline-end: none;
          border-block-end: var(--border-width-thin) solid var(--color-border-light);
        }

        .rail__item {
          inline-size: auto;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .card {
          animation-duration: 0.01ms;
          transition-duration: 0.01ms;
        }
      }
    `,
  ];

  @property({ type: Boolean, reflect: true }) open = false;

  @state() private _query = '';
  @state() private _sort: TriageSort = 'magnitude';
  /** Index in `MAGNITUDE_STEPS`. */
  @state() private _magStep = 0;
  @state() private _hidden = new Set<string>();
  @state() private _selected = new Set<string>();
  @state() private _cursor = 0;
  /** IDs, deren Verwerfen gerade beim Server liegt. */
  @state() private _busy = new Set<string>();
  /** Bilder, deren URL nicht geladen hat — das Fach fällt dann weg. */
  @state() private _brokenShots = new Set<string>();

  protected override willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (!changed.has('open') || !this.open) return;
    this._query = '';
    this._selected = new Set();
    this._cursor = 0;
  }

  // ── Ableitungen ───────────────────────────────────────────────────────────

  /** Die Untergrenze, die der Filter gerade setzt. */
  private _minMagnitude(): number {
    const step = MAGNITUDE_STEPS[this._magStep];
    return step === null ? intakeState.recommendedThreshold.value : step;
  }

  /** Die Quellen, die gerade in der Sichtung liegen, mit ihrer Anzahl. */
  private _railSources(): { name: string; kind: IntakeSourceKind; count: number }[] {
    const by = new Map<string, { name: string; kind: IntakeSourceKind; count: number }>();
    for (const s of intakeState.inTriage.value) {
      const entry = by.get(s.source);
      if (entry) entry.count += 1;
      else by.set(s.source, { name: s.source, kind: s.sourceKind, count: 1 });
    }
    return [...by.values()].sort((a, b) => b.count - a.count);
  }

  /**
   * Was das Raster zeigt: gefiltert, dann sortiert.
   *
   * Die Reihenfolge dieser beiden Schritte ist nicht beliebig — eine Sortierung
   * über die ungefilterte Menge würde eine Rangfolge zeigen, die sich beim
   * Filtern ändert, obwohl sie es nicht sollte.
   */
  private _visible(): IntakeSignal[] {
    const min = this._minMagnitude();
    const needle = this._query.trim().toLowerCase();

    const kept = intakeState.inTriage.value.filter((s) => {
      if (this._hidden.has(s.source)) return false;
      if (s.magnitude < min) return false;
      if (!needle) return true;
      return (
        s.headline.toLowerCase().includes(needle) ||
        (s.abstract ?? '').toLowerCase().includes(needle) ||
        s.source.toLowerCase().includes(needle)
      );
    });

    const sorted = [...kept];
    switch (this._sort) {
      case 'new':
        sorted.sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt));
        break;
      case 'fit':
        /*
         * `undefined` heisst „unbekannt", nicht „passt nicht": ein Signal ohne
         * Kategorie hat keine Signatur. Es sortiert deshalb ans ENDE (-1),
         * nicht an den Anfang und nicht gleichauf mit einer gemessenen 0.
         */
        sorted.sort((a, b) => (intakeState.fitOf(b) ?? -1) - (intakeState.fitOf(a) ?? -1));
        break;
      case 'velocity':
        sorted.sort((a, b) => b.socialVolume - a.socialVolume);
        break;
      default:
        sorted.sort((a, b) => b.magnitude - a.magnitude);
    }
    return sorted;
  }

  // ── Übergänge ─────────────────────────────────────────────────────────────

  private _close(): void {
    this.dispatchEvent(new CustomEvent('modal-close', { bubbles: true, composed: true }));
  }

  private _admit(signal: IntakeSignal): void {
    intakeState.toEntrance(signal.id);
    this._selected = new Set([...this._selected].filter((id) => id !== signal.id));
  }

  /**
   * Verwerfen — und zwar dort, wo das Signal wohnt.
   *
   * Ein Scanner-Kandidat hat eine Zeile in `news_scan_candidates`; wer ihn nur
   * lokal verwirft, findet ihn beim nächsten Laden wieder, weil `_merge` die
   * Stufe zwar behält, ein Neuladen der Seite aber nicht. Ein gebrowster
   * Artikel hat keine Zeile — für ihn gibt es nichts zu rufen.
   *
   * Die Stufe wird ERST NACH der Antwort gesetzt. Eine Karte, die verschwindet,
   * während der Aufruf scheitert, ist eine Quittung für etwas, das nicht
   * passiert ist.
   */
  private async _discard(signal: IntakeSignal): Promise<void> {
    const server = isScanCandidate(signal.raw) && intakeState.role.value === 'admin';
    if (!server) {
      intakeState.discard(signal.id);
      return;
    }

    this._busy = new Set([...this._busy, signal.id]);
    try {
      const resp = await scannerApi.rejectCandidate(signal.id);
      if (!resp.success) {
        VelgToast.error(resp.error?.message ?? msg('Discarding did not reach the scanner.'));
        return;
      }
      intakeState.discard(signal.id);
      this._selected = new Set([...this._selected].filter((id) => id !== signal.id));
    } catch (err) {
      captureError(err, { source: 'VelgIntakeTriageModal._discard' });
      VelgToast.error(msg('Discarding did not reach the scanner.'));
    } finally {
      this._busy = new Set([...this._busy].filter((id) => id !== signal.id));
    }
  }

  private _toggle(id: string): void {
    const next = new Set(this._selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this._selected = next;
  }

  private _admitSelected(): void {
    for (const id of this._selected) {
      const signal = intakeState.get(id);
      if (signal) intakeState.toEntrance(signal.id);
    }
    const n = this._selected.size;
    this._selected = new Set();
    VelgToast.success(msg(str`${n} signals are at the entrance.`));
  }

  private async _discardSelected(): Promise<void> {
    const ids = [...this._selected];
    for (const id of ids) {
      const signal = intakeState.get(id);
      if (signal) await this._discard(signal);
    }
    this._selected = new Set();
  }

  /**
   * Die stärksten aufnehmen.
   *
   * Der Bauplan nennt diesen Knopf „Top 5 nach Passung". Es gibt keine Passung
   * (Lücke 3), und ein Knopf, der etwas anderes tut, als sein Name sagt, ist
   * schlimmer als einer, der fehlt. Er nimmt die stärksten nach MAGNITUDE und
   * heisst auch so.
   */
  private _admitStrongest(): void {
    const strongest = [...this._visible()]
      .sort((a, b) => b.magnitude - a.magnitude)
      .slice(0, TOP_PICK_COUNT);
    for (const s of strongest) intakeState.toEntrance(s.id);
    VelgToast.success(msg(str`${strongest.length} signals are at the entrance.`));
  }

  // ── Tastatur ──────────────────────────────────────────────────────────────

  /**
   * Die vier Tasten aus dem Bauplan, wirklich verdrahtet.
   *
   * Der Bauplan zeigt den Hinweis `↑↓ · Leertaste wählen · ⏎ aufnehmen ·
   * x verwerfen` in der Werkzeugleiste an. Ein angezeigter Tastenhinweis, der
   * nichts auslöst, ist dieselbe Sorte Lüge wie ein Regler, der nichts bewegt.
   *
   * Im Suchfeld greift NICHTS davon: dort ist „x" ein Buchstabe.
   */
  private _onKeydown(e: KeyboardEvent): void {
    const target = e.composedPath()[0];
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;

    const items = this._visible();
    if (items.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        e.preventDefault();
        this._moveCursor(Math.min(this._cursor + 1, items.length - 1));
        return;
      case 'ArrowUp':
      case 'ArrowLeft':
        e.preventDefault();
        this._moveCursor(Math.max(this._cursor - 1, 0));
        return;
      case ' ':
        e.preventDefault();
        this._toggle(items[Math.min(this._cursor, items.length - 1)].id);
        return;
      case 'Enter':
        e.preventDefault();
        this._admit(items[Math.min(this._cursor, items.length - 1)]);
        return;
      case 'x':
      case 'X':
        e.preventDefault();
        void this._discard(items[Math.min(this._cursor, items.length - 1)]);
        return;
      default:
    }
  }

  /**
   * Den Cursor bewegen UND den Fokus mitnehmen.
   *
   * Ohne den Fokus wäre die Markierung eine Farbe, die eine Tastaturbedienung
   * behauptet: ein Screenreader liest weiter dort, wo er stand, und die nächste
   * Tabulator-Taste springt an eine ganz andere Stelle.
   */
  private _moveCursor(next: number): void {
    this._cursor = next;
    void this.updateComplete.then(() => {
      const box = this.renderRoot.querySelector<HTMLElement>('.box[tabindex="0"]');
      box?.focus();
      box?.scrollIntoView({ block: 'nearest' });
    });
  }

  // ── Teile ─────────────────────────────────────────────────────────────────

  private _renderSortChip(key: TriageSort, label: string, available: boolean) {
    return html`
      <button
        type="button"
        class="chip ${this._sort === key ? 'chip--on' : ''}"
        ?disabled=${!available}
        aria-pressed=${String(this._sort === key)}
        @click=${() => {
          this._sort = key;
        }}
      >
        ${label}${available ? nothing : html` °`}
      </button>
    `;
  }

  private _renderTools() {
    const recommended = intakeState.recommendedThreshold.value;

    return html`
      <div class="tools">
        <input
          class="search"
          type="search"
          .value=${this._query}
          placeholder=${msg('Search headline, abstract, source')}
          aria-label=${msg('Search the triage')}
          @input=${(e: Event) => {
            this._query = (e.target as HTMLInputElement).value;
            this._cursor = 0;
          }}
        />

        <div class="group" role="group" aria-label=${msg('Sort')}>
          <span class="label">${msg('Sort')}</span>
          ${this._renderSortChip('magnitude', msg('Magnitude'), true)}
          ${this._renderSortChip('new', msg('Newest'), true)}
          ${this._renderSortChip('fit', msg('Fit for this world'), BUREAU_SCORES_THE_FIT)}
          ${this._renderSortChip('velocity', msg('Net speed'), NET_REACH_IS_MEASURED)}
        </div>

        <div class="group" role="group" aria-label=${msg('Minimum magnitude')}>
          <span class="label">${msg('From')}</span>
          ${MAGNITUDE_STEPS.map(
            (step, i) => html`
              <button
                type="button"
                class="chip ${this._magStep === i ? 'chip--on' : ''}"
                aria-pressed=${String(this._magStep === i)}
                @click=${() => {
                  this._magStep = i;
                  this._cursor = 0;
                }}
              >
                ${
                  step === null
                    ? msg(str`recommended ${recommended.toFixed(2)}`)
                    : step === 0
                      ? msg('all')
                      : step.toFixed(2)
                }
              </button>
            `,
          )}
        </div>

        <button type="button" class="act" @click=${this._admitStrongest}>
          ${msg(str`Admit the ${TOP_PICK_COUNT} strongest`)}
        </button>

        <span class="keys">
          <kbd>↑↓</kbd><span class="note">${msg('move')}</span>
          <kbd>${msg('Space')}</kbd><span class="note">${msg('select')}</span>
          <kbd>⏎</kbd><span class="note">${msg('admit')}</span>
          <kbd>x</kbd><span class="note">${msg('discard')}</span>
        </span>
      </div>
    `;
  }

  private _renderRail() {
    const sources = this._railSources();

    return html`
      <aside class="rail" aria-label=${msg('Sources')}>
        <span class="label">${msg('Sources')}</span>
        ${sources.map(
          (s) => html`
            <button
              type="button"
              class="rail__item ${this._hidden.has(s.name) ? 'rail__item--off' : ''}"
              data-kind=${s.kind}
              aria-pressed=${String(!this._hidden.has(s.name))}
              @click=${() => {
                const next = new Set(this._hidden);
                if (next.has(s.name)) next.delete(s.name);
                else next.add(s.name);
                this._hidden = next;
                this._cursor = 0;
              }}
            >
              <span class="rail__dot" aria-hidden="true"></span>
              <span class="rail__name">${s.name}</span>
              <span class="rail__n">${s.count}</span>
            </button>
          `,
        )}

        <p class="prose prose--quiet">
          ${msg(
            'A social source never becomes a line of its own. It only lends speed and reach to a story that is already here. None is connected today.',
          )}
        </p>
      </aside>
    `;
  }

  private _renderCard(signal: IntakeSignal, index: number) {
    const selected = this._selected.has(signal.id);
    const resonance = signal.category ? CATEGORY_RESONANCE[signal.category] : null;
    const recommended =
      signal.magnitude > 0 && signal.magnitude >= intakeState.recommendedThreshold.value;
    const shot = this._brokenShots.has(signal.id) ? undefined : signal.imageUrl;
    const fit = intakeState.fitOf(signal);

    return html`
      <li
        class="card ${selected ? 'card--on' : ''} ${this._busy.has(signal.id) ? 'card--busy' : ''}"
        style="--i: ${index}"
      >
        ${
          shot
            ? html`<img
                class="shot"
                src=${shot}
                alt=""
                loading="lazy"
                @error=${() => {
                  this._brokenShots = new Set([...this._brokenShots, signal.id]);
                }}
              />`
            : nothing
        }

        <div class="meta">
          <span class="note">${formatRelativeTime(signal.observedAt)}</span>
          ${
            resonance
              ? html`<span class="arch">
                  ${icons.resonanceArchetype(resonance.signature, 12)}
                  ${archetypeLabel(resonance.archetype)}
                </span>`
              : nothing
          }
          <span class="kind" data-kind=${signal.sourceKind}>${signal.sourceKind}</span>
          ${recommended ? html`<span class="pick">${msg('recommended')}</span>` : nothing}
          ${
            fit !== undefined
              ? html`<span class="fit ${fit >= 85 ? 'fit--high' : fit >= 70 ? 'fit--mid' : ''}"
                  >${msg(str`fit ${fit}`)}</span
                >`
              : nothing
          }
        </div>

        <h3 class="headline">${signal.headline}</h3>

        ${
          signal.classificationNote
            ? html`<p class="note">${signal.classificationNote}</p>`
            : nothing
        }

        <div class="mag">
          <span class="mag__bar" aria-hidden="true">
            <span class="mag__fill" style="inline-size: ${Math.round(signal.magnitude * 100)}%"
            ></span>
          </span>
          ${
            signal.magnitude > 0
              ? html`<span class="mag__value">${signal.magnitude.toFixed(2)}</span>`
              : html`<span class="mag__value mag__value--unmeasured" title=${msg(
                  'Not yet classified – the crucible measures it.',
                )}>${msg('unmeasured')}</span>`
          }
        </div>

        <div class="srcs">
          ${signal.sources.map(
            (src) => html`<span class="src"
              >${src.name}${src.count > 1 ? html` ×${src.count}` : nothing}</span
            >`,
          )}
        </div>

        <div class="row">
          <button
            type="button"
            class="box"
            role="checkbox"
            aria-checked=${String(selected)}
            tabindex=${index === this._cursor ? '0' : '-1'}
            aria-label=${msg(str`Select "${signal.headline}"`)}
            @focus=${() => {
              this._cursor = index;
            }}
            @click=${() => this._toggle(signal.id)}
          >
            ${selected ? '■' : '□'}
          </button>
          <button
            type="button"
            class="act row__grow"
            ?disabled=${this._busy.has(signal.id)}
            @click=${() => this._admit(signal)}
          >
            ${msg('To the entrance')}
          </button>
          <button
            type="button"
            class="act"
            ?disabled=${this._busy.has(signal.id)}
            aria-label=${msg(str`Discard "${signal.headline}"`)}
            @click=${() => this._discard(signal)}
          >
            ✕
          </button>
        </div>
      </li>
    `;
  }

  private _renderBody() {
    if (intakeState.loading.value && intakeState.inTriage.value.length === 0) {
      return html`<velg-loading-state
        message=${msg('Reading the scanner')}
      ></velg-loading-state>`;
    }

    const items = this._visible();

    return html`
      ${this._renderTools()}
      <div class="split" @keydown=${this._onKeydown}>
        ${this._renderRail()}
        ${
          items.length === 0
            ? html`<velg-empty-state
                message=${
                  intakeState.inTriage.value.length === 0
                    ? msg('Nothing is waiting. The next scan cycle brings more.')
                    : msg('No signal matches these filters.')
                }
              ></velg-empty-state>`
            : html`<ul class="grid" role="list">
                ${items.map((s, i) => this._renderCard(s, i))}
              </ul>`
        }
      </div>
    `;
  }

  protected render() {
    const waiting = intakeState.inTriage.value.length;
    const total = intakeState.totalCandidates.value;
    const loaded = intakeState.signals.value.size;
    const selected = this._selected.size;

    return html`
      <velg-base-modal ?open=${this.open} modal-name="intake-triage" @modal-close=${this._close}>
        <span slot="header">${msg(str`Triage · ${waiting} waiting`)}</span>
        ${this._renderBody()}
        <div slot="footer">
          <div class="foot">
            <span class="count">${selected}</span>
            <span class="note">${msg('selected')}</span>
            <button
              type="button"
              class="act act--primary"
              ?disabled=${selected === 0}
              @click=${this._admitSelected}
            >
              ${msg('Selection to the entrance')}
            </button>
            <button
              type="button"
              class="act"
              ?disabled=${selected === 0}
              @click=${this._discardSelected}
            >
              ${msg('Discard selection')}
            </button>
            <button type="button" class="act foot__spacer" @click=${this._close}>
              ${msg('Close')}
            </button>

            <p class="prose prose--quiet foot__note">
              ${msg(
                'Fit is how susceptible this world is to that kind of signature – the same number the resonance run uses. It belongs to the world and the kind, not to the single signal: two storm warnings share it.',
              )}<br />
              ${msg(
                'Nothing here expires. A signal you neither admit nor discard stays in triage until someone decides.',
              )}
              ${
                total > loaded
                  ? html`<br />${msg(
                      str`${loaded} of ${total} candidates loaded – the newest first.`,
                    )}`
                  : nothing
              }
            </p>
          </div>
        </div>
      </velg-base-modal>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-intake-triage-modal': VelgIntakeTriageModal;
  }
}
