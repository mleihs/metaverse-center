/**
 * Die Schleuse — Zustand und Zustandsmaschine.
 *
 * Schritt 1 aus `handoff/schleuse-event-intake.md`. Der Manager hält die
 * Signale beider Zuflüsse in EINER Menge und kennt die sieben Stufen, die ein
 * Signal durchlaufen kann. Die Oberfläche liest nur ab; jeder Übergang geht
 * durch genau eine Methode hier.
 *
 * WARUM EINE MENGE UND KEINE VIER LISTEN: die vier Kammern der Schleuse sind
 * keine vier Datenquellen, sondern vier Sichten auf dieselbe Menge, gefiltert
 * nach `stage`. Vier Listen zu führen hiesse, vier Gelegenheiten zu schaffen,
 * dass dasselbe Signal an zwei Orten steht — und genau das ist der Zustand, den
 * die Schleuse ablösen soll (heute liegt eine Nachricht je nach Herkunft in der
 * Kandidatenliste ODER im Browse-Ergebnis, mit zwei Statusbegriffen).
 *
 * Muster: `TerminalStateManager` — Signale als `readonly`, abgeleitete Werte als
 * `computed`, ein Singleton am Dateiende.
 */

import { computed, signal } from '@preact/signals-core';
import type { Zone } from '../types/index.js';
import {
  CATEGORY_RESONANCE,
  fromBrowseArticle,
  fromScanCandidate,
  type IntakeSignal,
  type IntakeStage,
} from '../types/intake.js';
import { appState } from './AppStateManager.js';
import type { IntakeSubscription } from './api/IntakeApiService.js';
import { intakeApi, locationsApi, scannerApi, socialTrendsApi } from './api/index.js';
import type { AdapterInfo, ScanCandidate, ScannerDashboard } from './api/ScannerApiService.js';
import { captureError } from './SentryService.js';

/** Wer die Schleuse bedient. Bestimmt, welche Übergänge erlaubt sind. */
export type IntakeRole = 'architect' | 'admin';

/**
 * Wie viele Ereignisse eine Welt pro Tag aufnehmen darf.
 *
 * Vorgabe aus dem Plan. Backend-Lücke 5: sobald `daily_event_quota` in den
 * Simulations-Einstellungen steht, kommt der Wert von dort und diese Konstante
 * wird der Rückfall. Resonanzen zählen NICHT auf die Quote — sie treffen
 * mehrere Welten und sind keine Aufnahme in diese eine.
 */
export const DEFAULT_DAILY_QUOTA = 5;

/**
 * Rückfall für die Empfehlungsschwelle, solange der Server keine geliefert hat.
 *
 * Derselbe Wert, den `compute_recommended_threshold` ohne Kandidaten zurückgibt
 * (`scanner_service.py`). Ein anderer wäre eine zweite Meinung über dieselbe
 * Sache.
 */
export const DEFAULT_RECOMMENDED_THRESHOLD = 0.6;

/**
 * Wie viele Kandidaten eine Ladung holt.
 *
 * Das Maximum des Endpunkts (`Query(ge=1, le=100)`). Die Vorgabe war 25, und
 * eine Sichtung, deren Aufgabe „die Menge bewältigen" ist, hätte damit von 83
 * Kandidaten auf Produktion 25 gezeigt — sortiert nach `created_at DESC`, also
 * die neuesten. Was darüber hinausgeht, sagt die Sichtung als Zahl an; still
 * abschneiden darf sie nicht.
 */
const CANDIDATE_PAGE_SIZE = 100;

class IntakeStateManager {
  // ── Rohzustand ────────────────────────────────────────────────────────────

  /** Alle Signale, nach ID. Die vier Kammern sind Sichten hierauf. */
  readonly signals = signal<Map<string, IntakeSignal>>(new Map());

  readonly dashboard = signal<ScannerDashboard | null>(null);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  /**
   * Die Zonen der Welt — die Orte, an denen ein Signal ankommen kann.
   *
   * WARUM HIER UND NICHT IM SCHMELZTIEGEL: die Linse hält eine Zonen-ID, nicht
   * den Zonennamen. Eine ID ist beständig, ein Name wird umbenannt — und wer
   * den Namen einfriert, zeigt später den alten. Damit braucht aber JEDE
   * Stelle, die eine Linse anzeigt (Schmelztiegel, Quarantäne-Karte, Lesesaal,
   * Protokoll), dieselbe Auflösung. Zwei Ladewege für dieselbe Liste wären zwei
   * Gelegenheiten, sie unterschiedlich zu haben.
   */
  readonly zones = signal<Zone[]>([]);

  /** Wie viele Ereignisse diese Welt heute schon aufgenommen hat. */
  readonly eventsToday = signal<number>(0);
  readonly dailyQuota = signal<number>(DEFAULT_DAILY_QUOTA);

  /**
   * Ab welcher Magnitude der Server ein Signal empfiehlt.
   *
   * GERECHNET, NICHT GESETZT: `compute_recommended_threshold` nimmt die
   * Magnitude an der Grenze der obersten 20 % der wartenden Kandidaten, mit
   * einem Boden von 0.40. Die Empfehlung bewegt sich also mit dem, was
   * tatsächlich hereinkam — an einem stillen Tag empfiehlt sie weniger streng
   * als an einem lauten.
   *
   * Der Bauplan nennt an dieser Stelle die feste Zahl 0.40. Das ist genau der
   * Boden dieser Rechnung und damit ihr schwächster Fall; wer sie fest
   * einträgt, empfiehlt an einem Tag mit 44 Unwetterwarnungen die halbe Liste.
   */
  readonly recommendedThreshold = signal<number>(DEFAULT_RECOMMENDED_THRESHOLD);

  /**
   * Die Passung dieser Welt je SIGNATUR, 0–100.
   *
   * Nicht je Kandidat: die Empfänglichkeit hängt an (Welt, Signatur), und zwei
   * Unwetterwarnungen haben dieselbe. Leer heisst „noch nicht geladen" — die
   * Oberfläche zeigt dann keine Passung, statt 0 zu behaupten.
   */
  readonly fitBySignature = signal<Map<string, number>>(new Map());

  /** Die Abonnements dieser Welt. Leer heisst „keine" ODER „nicht geladen". */
  readonly subscriptions = signal<IntakeSubscription[]>([]);

  /**
   * Wie viele Kandidaten der Server insgesamt hat — nicht, wie viele geladen
   * sind. Der Unterschied gehört auf den Schirm: eine Sichtung, die 100 von
   * 240 zeigt und das verschweigt, behauptet, man hätte alles gesehen.
   */
  readonly totalCandidates = signal<number>(0);

  // ── Abgeleitet ────────────────────────────────────────────────────────────

  readonly adapters = computed<AdapterInfo[]>(() => this.dashboard.value?.adapters ?? []);

  /**
   * Die Rolle. Nicht als Prop hereingereicht, sondern aus dem Anwendungszustand
   * abgeleitet — sonst könnte ein falsch gesetztes Attribut einem Architekten
   * den Resonanz-Knopf zeigen, und das ist der eine Unterschied, der in dieser
   * View wirklich zählt.
   */
  readonly role = computed<IntakeRole>(() =>
    appState.isPlatformAdmin.value ? 'admin' : 'architect',
  );

  /** Nur ein Admin darf eine Resonanz auslösen. Ein Architekt meldet. */
  readonly canRaiseResonance = computed<boolean>(() => this.role.value === 'admin');

  private readonly _all = computed<IntakeSignal[]>(() => [...this.signals.value.values()]);

  readonly inTriage = computed(() => this._byStage('raw'));
  readonly inEntrance = computed(() => this._byStage('in'));
  readonly inQuarantine = computed(() => this._byStage('q'));
  readonly released = computed(() =>
    this._all.value.filter((s) => s.stage === 'ev' || s.stage === 'res' || s.stage === 'flag'),
  );

  /**
   * Die Tagesquote ist erschöpft.
   *
   * Blockiert NUR den Übergang zum Ereignis (`q → ev`). Eine Resonanz zählt
   * nicht mit, ein Melden auch nicht — beide verlassen diese Welt.
   */
  readonly quotaReached = computed<boolean>(() => this.eventsToday.value >= this.dailyQuota.value);

  private _byStage(stage: IntakeStage): IntakeSignal[] {
    return this._all.value.filter((s) => s.stage === stage);
  }

  // ── Laden ─────────────────────────────────────────────────────────────────

  /**
   * Kandidaten und Sensorlage des Scanners holen.
   *
   * Das Dashboard zuerst, weil `sourceKindOf` die Adapter-Angaben braucht, um
   * eine Quelle einzuordnen — ohne sie fiele jede auf `llm` zurück und die
   * Sensor-Leiste wäre einfarbig. Schlägt nur das Dashboard fehl, laden die
   * Kandidaten trotzdem: eine Liste ohne Farben ist besser als keine Liste.
   */
  async loadScanner(): Promise<void> {
    /*
     * NUR DER ADMIN. Der ganze `news_scanner`-Router haengt an
     * `require_platform_admin()` — Sensorlage UND Kandidatenliste. Ein
     * Architekt bekam hier bis zum 02.09. zwei 422/403 und sah statt seiner
     * Schleuse die rohe Fehlermeldung „Field required" (so heisst FastAPIs
     * fehlender Authorization-Header) ueber einem leeren Brett.
     *
     * Aufgefallen ist das nicht im Test und nicht im Typ, sondern erst beim
     * HINSEHEN: die View war vier Schritte lang nicht erreichbar, weil ihr der
     * Navigationseintrag fehlte, und was niemand oeffnen kann, meldet auch
     * niemand. Der Eingang eines Architekten fuellt sich ueber `loadBrowse`,
     * nicht ueber den Scanner.
     */
    if (this.role.value !== 'admin') return;
    this.loading.value = true;
    this.error.value = null;
    try {
      const dash = await scannerApi.getDashboard();
      if (dash.success && dash.data) {
        this.dashboard.value = dash.data;
      }

      const resp = await scannerApi.listCandidates({ limit: String(CANDIDATE_PAGE_SIZE) });
      if (!resp.success || !resp.data) {
        this.error.value = resp.error?.message ?? null;
        return;
      }
      const adapters = this.dashboard.value?.adapters;
      this.recommendedThreshold.value = resp.data.recommended_threshold;
      this.totalCandidates.value = resp.data.meta.total;
      this._merge(resp.data.items.map((c: ScanCandidate) => fromScanCandidate(c, adapters)));
    } catch (err) {
      captureError(err, { source: 'IntakeStateManager.loadScanner' });
      this.error.value = err instanceof Error ? err.message : null;
    } finally {
      this.loading.value = false;
    }
  }

  /**
   * Artikel einer externen Quelle in den Eingang holen.
   *
   * Gebrowste Artikel kommen ohne Klassifikation; sie landen deshalb direkt auf
   * `in` (ein Mensch hat sie bereits ausgewählt) und bekommen ihre Magnitude
   * erst im Schmelztiegel.
   */
  async loadBrowse(
    simulationId: string,
    params: { source?: string; query?: string; section?: string; limit?: number },
  ): Promise<void> {
    this.loading.value = true;
    this.error.value = null;
    try {
      const resp = await socialTrendsApi.browse(simulationId, params);
      if (!resp.success || !resp.data) {
        this.error.value = resp.error?.message ?? null;
        return;
      }
      this._merge(resp.data.map(fromBrowseArticle));
    } catch (err) {
      captureError(err, { source: 'IntakeStateManager.loadBrowse' });
      this.error.value = err instanceof Error ? err.message : null;
    } finally {
      this.loading.value = false;
    }
  }

  /**
   * Die Zonen der Welt holen, einmal je Welt.
   *
   * Ein Fehlschlag ist kein Grund, die Schleuse anzuhalten: ohne Zonen fehlt
   * der Linse ihre Ortsauswahl, alles andere arbeitet weiter. Deshalb landet
   * er in `captureError` und nicht in `error` — `error` deckelt das ganze
   * Board, und ein leeres Board wegen einer fehlenden Ortsliste wäre die
   * falsche Auskunft.
   */
  async loadZones(simulationId: string): Promise<void> {
    if (this.zones.value.length > 0 && this.zones.value[0].simulation_id === simulationId) return;
    try {
      const resp = await locationsApi.listZones(
        simulationId,
        appState.currentSimulationMode.value,
        {
          limit: '200',
        },
      );
      if (resp.success && resp.data) this.zones.value = resp.data;
    } catch (err) {
      captureError(err, { source: 'IntakeStateManager.loadZones' });
    }
  }

  /**
   * Die Passung dieser Welt holen.
   *
   * Ein Fehlschlag deckelt nicht das Board: ohne Passung sortiert die Sichtung
   * nach Magnitude weiter, und die Spalte bleibt leer statt eine 0 zu
   * behaupten.
   */
  async loadFit(simulationId: string): Promise<void> {
    if (!simulationId) return;
    try {
      const resp = await intakeApi.signatureFit(simulationId);
      if (!resp.success || !resp.data) return;
      this.fitBySignature.value = new Map(resp.data.map((r) => [r.signature, r.fit]));
    } catch (err) {
      captureError(err, { source: 'IntakeStateManager.loadFit' });
    }
  }

  /**
   * Die Passung EINES Signals, oder `undefined`.
   *
   * `undefined` heisst „unbekannt" und ist von 0 zu unterscheiden: ein Signal
   * ohne Kategorie hat keine Signatur, und eine Welt, deren Passung nicht
   * geladen ist, hat keine Zahl — beides ist nicht „passt nicht".
   */
  fitOf(signal: IntakeSignal): number | undefined {
    if (!signal.category) return undefined;
    const signature = CATEGORY_RESONANCE[signal.category]?.signature;
    if (!signature) return undefined;
    return this.fitBySignature.value.get(signature);
  }

  /** Die Abonnements holen. Ohne sie fällt nur das automatische Aufnehmen aus. */
  async loadSubscriptions(simulationId: string): Promise<void> {
    if (!simulationId) return;
    try {
      const resp = await intakeApi.listSubscriptions(simulationId);
      if (resp.success && resp.data) this.subscriptions.value = resp.data;
    } catch (err) {
      captureError(err, { source: 'IntakeStateManager.loadSubscriptions' });
    }
  }

  /**
   * Das erste aktive Abo, auf das ein Signal passt — oder `undefined`.
   *
   * „Das erste" und nicht „das beste": Abos sind eine Liste, die ein Mensch
   * angelegt hat, und die Reihenfolge darin ist seine. Eine Rangfolge zu
   * erfinden hiesse, ihm eine Entscheidung abzunehmen, die er nie getroffen
   * hat.
   */
  private _matchingSubscription(signal: IntakeSignal): IntakeSubscription | undefined {
    return this.subscriptions.value.find(
      (sub) =>
        sub.is_active &&
        (!sub.source_category || sub.source_category === signal.category) &&
        signal.magnitude >= sub.min_magnitude,
    );
  }

  /** Der Name einer Zone, oder Leerstring, wenn die Liste sie nicht kennt. */
  zoneName(zoneId: string): string {
    return this.zones.value.find((z) => z.id === zoneId)?.name ?? '';
  }

  /**
   * Neue Signale einmischen, ohne bestehende Stufen zu überschreiben.
   *
   * Ein erneutes Laden darf ein Signal nicht zurückwerfen: wer gerade etwas in
   * die Quarantäne geschoben hat und dann die Liste aktualisiert, fände es sonst
   * wieder in der Sichtung. Die Stufe gehört ab dem ersten Sehen dem Manager,
   * die Inhalte weiterhin dem Server.
   */
  private _merge(incoming: IntakeSignal[]): void {
    const next = new Map(this.signals.value);
    for (const s of incoming) {
      const known = next.get(s.id);
      if (known) {
        next.set(s.id, {
          ...s,
          stage: known.stage,
          lens: known.lens ?? s.lens,
          viaSubscription: known.viaSubscription,
        });
        continue;
      }

      /*
       * NUR NEUE Signale. Ein Abo darf nichts zurueckholen, was ein Mensch
       * schon weitergeschoben oder verworfen hat — sonst kaeme Verworfenes bei
       * jedem Laden wieder in den Eingang.
       */
      const sub = this._matchingSubscription(s);
      next.set(
        s.id,
        sub
          ? {
              ...s,
              stage: 'in',
              viaSubscription: {
                label: sub.label,
                zone: sub.zone_id ?? undefined,
                vector: sub.vector ?? undefined,
              },
            }
          : s,
      );
    }
    this.signals.value = next;
  }

  // ── Zustandsmaschine ──────────────────────────────────────────────────────

  /** Ein Signal lesen. */
  get(id: string): IntakeSignal | undefined {
    return this.signals.value.get(id);
  }

  /**
   * Ein Signal ändern. Einziger Schreibweg — alle Übergänge gehen hier durch,
   * damit es keine zweite Stelle gibt, die eine Stufe setzt.
   */
  patch(id: string, patch: Partial<IntakeSignal>): void {
    const cur = this.signals.value.get(id);
    if (!cur) return;
    const next = new Map(this.signals.value);
    next.set(id, { ...cur, ...patch });
    this.signals.value = next;
  }

  /** Sichtung → Eingang. Rein lokal; der Server kennt den Eingang nicht. */
  toEntrance(id: string): void {
    this.patch(id, { stage: 'in' });
  }

  /** Eingang → Sichtung (Rückweg aus dem Lesesaal). */
  toTriage(id: string): void {
    this.patch(id, { stage: 'raw' });
  }

  /**
   * Eingang → Quarantäne. Der Schmelztiegel hat gearbeitet; Linse und Vorschlag
   * hängen jetzt am Signal, integriert wird noch nicht.
   */
  toQuarantine(id: string, patch: Pick<IntakeSignal, 'lens' | 'proposal'>): void {
    this.patch(id, { stage: 'q', ...patch });
  }

  /**
   * Quarantäne → Ereignis dieser Welt.
   *
   * Zählt auf die Tagesquote. Der Aufrufer prüft `quotaReached` vorher — hier
   * steht die Zählung, nicht die Sperre, damit ein Admin-Weg (Auto-Einlass)
   * später dieselbe Buchführung benutzen kann.
   */
  toEvent(id: string): void {
    this.patch(id, { stage: 'ev' });
    this.eventsToday.value += 1;
  }

  /** Quarantäne → Resonanz. Nur Admin; trifft mehrere Welten, zählt nicht. */
  toResonance(id: string): void {
    this.patch(id, { stage: 'res' });
  }

  /** Quarantäne → dem Bureau gemeldet. Nur Architekt. */
  toFlagged(id: string): void {
    this.patch(id, { stage: 'flag' });
  }

  /** Verwerfen, aus jeder Stufe. */
  discard(id: string): void {
    this.patch(id, { stage: 'out' });
  }

  /** Ein verworfenes Signal zurückholen. */
  restore(id: string): void {
    this.patch(id, { stage: 'raw' });
  }

  /** Beim Verlassen der View oder beim Weltwechsel. */
  clear(): void {
    this.signals.value = new Map();
    this.dashboard.value = null;
    this.zones.value = [];
    this.error.value = null;
    this.loading.value = false;
    this.eventsToday.value = 0;
    this.recommendedThreshold.value = DEFAULT_RECOMMENDED_THRESHOLD;
    this.totalCandidates.value = 0;
    this.fitBySignature.value = new Map();
    this.subscriptions.value = [];
  }
}

export const intakeState = new IntakeStateManager();
