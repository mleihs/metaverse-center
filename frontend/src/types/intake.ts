/**
 * Die Schleuse — vereinheitlichter Event-Intake.
 *
 * `IntakeSignal` ist die gemeinsame Sicht auf die beiden Zuflüsse, die heute
 * zwei Vokabulare an zwei Orten haben: `ScanCandidate` (Scanner, Admin-Panel)
 * und `BrowseArticle` (Social-Trends, Simulations-Tab). Der Plan dazu steht in
 * `handoff/schleuse-event-intake.md`.
 *
 * WARUM EIN ADAPTER UND KEINE ZWEITE PIPELINE: die beiden Quellen liefern
 * dieselbe Sache in verschiedener Verpackung. Ein Kandidat trägt bereits eine
 * Klassifikation (Kategorie, Magnitude, Begründung), ein gebrowster Artikel
 * trägt nur Rohtext — aber beide durchlaufen ab dem Eingang denselben Weg.
 * Die Unterschiede gehören deshalb an EINE Stelle (die beiden `from*`-Funktionen
 * unten) und nicht in jede Komponente, die ein Signal anzeigt.
 *
 * ⚠ ZWEI STELLEN, AN DENEN DER PLAN VOM CODE ABWEICHT (02.09.2026 gemessen):
 *   - Der Plan nennt das Kategorie-Feld „ResonanceSignature-Kategorie". Der
 *     richtige Typ ist `SourceCategory` — die acht Schlüssel seiner eigenen
 *     Mapping-Tabelle sind exakt dessen Union, und `ScanCandidate` trägt sie
 *     als `source_category`. `ResonanceSignature` ist eine ANDERE Union
 *     (`economic_tremor`, `conflict_wave`, …), die erst hinter der Resonanz steht.
 *   - Der Plan listet als Vektoren `[Handel | Traum | Architektur | Sprache |
 *     Krankheit]`. `EchoVector` hat SIEBEN Werte, und „Krankheit" ist keiner
 *     davon. Die Linse benutzt deshalb die echte Union.
 */

import type { AdapterInfo, ScanCandidate } from '../services/api/ScannerApiService.js';
import type { BrowseArticle } from '../services/api/SocialTrendsApiService.js';
import type { EchoVector, ResonanceSignature, SourceCategory } from './index.js';

/**
 * Die Stufe eines Signals. Jedes Signal hat genau eine — das ist der Punkt der
 * Schleuse: heute liegt dieselbe Nachricht je nach Herkunft in zwei
 * verschiedenen Listen mit zwei verschiedenen Statusbegriffen.
 *
 * `raw` Sichtung · `in` Eingang · `q` Quarantäne ·
 * `ev` als Ereignis freigegeben · `res` als Resonanz ausgelöst ·
 * `flag` dem Bureau gemeldet · `out` verworfen
 */
export type IntakeStage = 'raw' | 'in' | 'q' | 'ev' | 'res' | 'flag' | 'out';

/**
 * Klasse der Quelle. Bestimmt Farbe und Vertrauen in der Sensor-Leiste.
 *
 * `structured` liefert Messwerte (Erdbeben, Unwetter) und braucht kein Modell;
 * `semi` liefert halbstrukturiertes; `llm` braucht eine Klassifikation;
 * `internal` ist die Welt selbst (Echoes); `social` liefert NUR Tempo und
 * Reichweite zu einer bestehenden Geschichte, nie ein eigenes Signal;
 * `nokey` ist angeschlossen, aber ohne Schlüssel unbrauchbar.
 */
export type IntakeSourceKind = 'structured' | 'semi' | 'llm' | 'internal' | 'social' | 'nokey';

/** Eine Quelle, die zu derselben Geschichte beigetragen hat (Story-Bündelung). */
export interface IntakeSourceRef {
  name: string;
  count: number;
  /** Freitext wie „1.2k in 2 h", solange das Backend kein Tempo liefert. */
  velocity?: string;
}

/**
 * Die Tonlage, in der die Welt von dem Signal erfährt.
 *
 * Im Zustand steht die Kennung, nicht das Wort: „Amtlich" ist die deutsche
 * Beschriftung von `official`, und eine beim Schreiben aufgelöste Beschriftung
 * wäre in ihrer Sprache eingefroren — ein englischer Leser bekäme später das
 * deutsche Wort zurück. Die Wörter stehen in `components/intake/intake-labels.ts`.
 */
export type IntakeTone = 'official' | 'propaganda' | 'rumour' | 'record';

export const INTAKE_TONES: readonly IntakeTone[] = ['official', 'propaganda', 'rumour', 'record'];

/**
 * Die drei Freiheitsgrade der Erzeugung.
 *
 * Der Wert IST die Temperatur — es gibt keine zweite Tabelle, die „Ausgewogen"
 * auf 0.7 abbildet und irgendwann daneben liegt.
 */
export const INTAKE_FREEDOMS = [0.4, 0.7, 0.9] as const;
export type IntakeFreedom = (typeof INTAKE_FREEDOMS)[number];

/** Die Linse: wie aus dem Signal ein Ereignis DIESER Welt wird. */
export interface IntakeLens {
  zone: string;
  vector: EchoVector;
  tone: IntakeTone;
  type: string;
  /** Wucht 1–10. Ändert nur die Integration, nicht den erzeugten Text. */
  impact: number;
  react: boolean;
  /** Anzahl reagierender Agenten. */
  n: number;
  witnesses: string[];
  /** Temperatur der Erzeugung: 0.4 treu, 0.7 ausgewogen, 0.9 frei. */
  creativity?: number;
  instructions?: string;
}

/** Das Ergebnis des Schmelztiegels. */
export interface IntakeProposal {
  title: string;
  body: string;
}

/** Ein Signal auf seinem Weg durch die Schleuse. */
export interface IntakeSignal {
  id: string;
  stage: IntakeStage;

  source: string;
  sourceKind: IntakeSourceKind;

  headline: string;
  abstract?: string;
  url?: string;
  /** ISO-Zeitstempel der Beobachtung. */
  observedAt: string;

  category: SourceCategory | null;
  magnitude: number;
  /** Wie die Magnitude zustande kam — „deterministisch" oder „Modell: …". */
  classificationNote?: string;

  /** Story-Bündelung: dieselbe Nachricht aus mehreren Quellen. */
  sources: IntakeSourceRef[];
  socialVolume: number;
  /** Passung 0–100. Backend-Lücke; bis dahin nicht gesetzt. */
  fit?: number;

  /**
   * Vorschaubild, wenn die Quelle eines mitgeschickt hat.
   *
   * VIER Quellen tragen eines, unter VIER verschiedenen Namen — siehe
   * `imageOf`. Die drei Messdienste (USGS, NOAA, NASA, GDACS) tragen nie
   * eines, und das ist der Grund, warum die Sichtung ein GLEICHFÖRMIGES
   * Kartenraster hat und kein Masonry: die Karte ohne Bild ist der Normalfall,
   * nicht die Ausnahme.
   */
  imageUrl?: string;

  lens?: IntakeLens;
  proposal?: IntakeProposal;

  /** Die unveränderte Herkunft, für alles, was der Adapter nicht abbildet. */
  raw: ScanCandidate | BrowseArticle;
}

// ── Kategorie → Signatur und Archetyp ───────────────────────────────────────

/**
 * Die acht Kategorien des Scanners auf Signatur und Archetyp.
 *
 * Das ist die Frontend-Fassung von `CATEGORY_ARCHETYPE_MAP` in
 * `backend/models/resonance.py` — dieselbe Tabelle, zwei Spalten. Die Werte
 * sind die Bezeichner, die das Backend führt, NICHT die Anzeigenamen;
 * übersetzt wird in `components/intake/intake-labels.ts`, damit dieselbe
 * Zuordnung in beiden Sprachen gilt.
 *
 * WARUM BEIDE SPALTEN IN EINER TABELLE: der Archetyp ist das WORT (Der Turm),
 * die Signatur die KENNUNG, mit der die Resonanz rechnet (`economic_tremor`)
 * und unter der `icons.resonanceArchetype` ihr Zeichen führt. Zwei getrennte
 * Tabellen wären zwei Gelegenheiten, sie unterschiedlich zu haben.
 */
export const CATEGORY_RESONANCE: Record<
  SourceCategory,
  { signature: ResonanceSignature; archetype: string }
> = {
  economic_crisis: { signature: 'economic_tremor', archetype: 'The Tower' },
  military_conflict: { signature: 'conflict_wave', archetype: 'The Shadow' },
  pandemic: { signature: 'biological_tide', archetype: 'The Devouring Mother' },
  natural_disaster: { signature: 'elemental_surge', archetype: 'The Deluge' },
  political_upheaval: { signature: 'authority_fracture', archetype: 'The Overthrow' },
  tech_breakthrough: { signature: 'innovation_spark', archetype: 'The Prometheus' },
  cultural_shift: { signature: 'consciousness_drift', archetype: 'The Awakening' },
  environmental_disaster: { signature: 'decay_bloom', archetype: 'The Entropy' },
};

/** Nur die Archetypen — abgeleitet, damit es keine zweite Tabelle gibt. */
export const CATEGORY_ARCHETYPE: Record<SourceCategory, string> = Object.fromEntries(
  Object.entries(CATEGORY_RESONANCE).map(([category, entry]) => [category, entry.archetype]),
) as Record<SourceCategory, string>;

// ── Quellenklasse ───────────────────────────────────────────────────────────

/**
 * Adapter, die nur Tempo und Reichweite liefern, nie ein eigenes Signal.
 *
 * ⚠ DIE MENGE IST LEER, UND DAS IST EIN BEFUND, KEIN VERSEHEN.
 *
 * Am 02.09.2026 gemessen: „reddit" kommt im gesamten Backend null Mal vor.
 * „bluesky" gab es an dem Tag ebenfalls nicht als Quelle — und existiert seit
 * demselben Tag als eine, aber NICHT als Sozialquelle: der Adapter lässt einen
 * Beitrag nur durch, wenn er einen Artikel verlinkt, und meldet dann die
 * Überschrift des ARTIKELS. Damit ist er halbstrukturiert (siehe
 * `SEMI_ADAPTERS`), nicht sozial.
 *
 * Die Klasse `social` bleibt im Typ, weil die Regel dahinter gilt: eine Quelle,
 * die nur Tempo zu einer bestehenden Geschichte liefert, darf keine eigene
 * Zeile erzeugen. Sie hat heute nur kein Mitglied — und bekommt eines erst,
 * wenn es einen Ort gibt, an dem dieses Tempo gespeichert wird (Lücke 2,
 * Story-Bündelung).
 *
 * Messung: `docs/analysis/schleuse-zufluss-2026-09-02.md`.
 */
const SOCIAL_ADAPTERS = new Set<string>();
/** Adapter, deren Ausgabe halbstrukturiert ist. */
const SEMI_ADAPTERS = new Set(['who', 'who_outbreaks', 'hackernews', 'bluesky']);
/** Die Welt selbst. */
const INTERNAL_ADAPTERS = new Set(['echoes']);

/**
 * Klasse einer Quelle bestimmen.
 *
 * Reihenfolge ist bedeutungstragend: ein Adapter ohne Schlüssel ist unbrauchbar,
 * egal wie gut seine Daten wären — deshalb steht `nokey` vor allem anderen.
 * `info` fehlt, wenn das Dashboard den Adapter nicht kennt; dann bleibt nur der
 * Name, und der Rückfall ist `llm` (die teuerste Annahme, also die vorsichtige).
 */
export function sourceKindOf(name: string, info?: AdapterInfo): IntakeSourceKind {
  const key = name.toLowerCase();
  if (info?.requires_api_key && !info.available) return 'nokey';
  if (INTERNAL_ADAPTERS.has(key)) return 'internal';
  if (SOCIAL_ADAPTERS.has(key)) return 'social';
  if (info?.is_structured) return 'structured';
  if (SEMI_ADAPTERS.has(key)) return 'semi';
  return 'llm';
}

// ── Adapter ─────────────────────────────────────────────────────────────────

/**
 * Vier Quellen, vier Namen für dasselbe Bild.
 *
 * `thumbnail` Guardian (`fields.thumbnail`) · `image_url` NewsAPI
 * (`urlToImage`) und WHO (erstes `<img>` aus dem Overview) · `socialimage`
 * GDELT · `thumb` Bluesky (`external.thumb`). Gespeichert ist jeweils die URL,
 * kein Blob — sie lebt so lange wie der Kandidat.
 *
 * ⚠ Diese Liste ist am 02.09.2026 einmal falsch gewesen, und zwar durch ein zu
 * enges Messgerät: ein Grep nach `"(thumbnail|image_url|thumb|image)"` suchte
 * den Schlüssel als GANZES Wort und übersah `socialimage`, das `image`
 * ENTHÄLT, aber nicht so heisst. GDELT galt deshalb als bildlos. Wer hier einen
 * Namen ergänzt, sucht ihn im Adapter, nicht im Muster.
 */
export function imageOf(raw: Record<string, unknown> | null | undefined): string | undefined {
  if (!raw) return undefined;
  for (const key of ['thumbnail', 'image_url', 'socialimage', 'thumb']) {
    const value = raw[key];
    if (typeof value === 'string' && value.startsWith('http')) return value;
  }
  return undefined;
}

/** Status des Scanners auf die Stufe der Schleuse. */
function stageOfCandidate(status: string): IntakeStage {
  switch (status) {
    case 'approved':
      return 'res';
    case 'rejected':
      return 'out';
    case 'flagged':
      return 'flag';
    default:
      return 'raw';
  }
}

/**
 * Ein Scanner-Kandidat als Signal.
 *
 * Der Kandidat ist die reichere der beiden Quellen: er trägt Kategorie,
 * Magnitude und Begründung schon mit. `sources` bleibt einelementig, bis das
 * Backend die Story-Bündelung liefert (Lücke 2 im Plan) — ein leeres Array
 * wäre die Unwahrheit, denn eine Quelle gibt es ja.
 */
export function fromScanCandidate(c: ScanCandidate, adapters?: AdapterInfo[]): IntakeSignal {
  const info = adapters?.find((a) => a.name === c.source_adapter);
  return {
    id: c.id,
    stage: stageOfCandidate(c.status),
    source: c.source_adapter,
    sourceKind: sourceKindOf(c.source_adapter, info),
    headline: c.title,
    abstract: c.description ?? undefined,
    url: c.article_url ?? undefined,
    observedAt: c.created_at,
    category: (c.source_category as SourceCategory) || null,
    magnitude: c.magnitude,
    classificationNote: c.classification_reason ?? undefined,
    /*
     * Seit Migration 345 buendelt der Scanner: dieselbe Geschichte aus drei
     * Quellen ist EINE Zeile mit drei Chips. Der Rueckfall auf den eigenen
     * Adapter deckt die Zeilen von vor der Buendelung — ein leeres Array waere
     * die Unwahrheit, denn eine Quelle gibt es ja.
     */
    sources: c.sources?.length ? c.sources : [{ name: c.source_adapter, count: 1 }],
    socialVolume: c.social_volume ?? 0,
    imageUrl: imageOf(c.article_raw_data),
    raw: c,
  };
}

/**
 * Ein gebrowster Artikel als Signal.
 *
 * Der Artikel ist die ärmere Quelle: keine Kategorie, keine Magnitude, keine
 * Begründung — die entstehen erst im Schmelztiegel. `magnitude: 0` ist deshalb
 * kein Messwert, sondern „noch nicht gemessen", und die Oberfläche muss das
 * unterscheiden können.
 *
 * ⚠ ER BEGINNT IN DER SICHTUNG, NICHT IM EINGANG (geändert 02.09.2026).
 *
 * Bis Schritt 7 stand hier `stage: 'in'` mit der Begründung „ein Mensch hat ihn
 * bereits ausgewählt". Das stimmte, solange `loadBrowse` keinen Aufrufer hatte
 * und man sich den Ablauf dachte wie in der alten `SocialTrendsView`: suchen,
 * einen Artikel anklicken, verwandeln.
 *
 * Der Zufluss von Hand holt aber FÜNFZEHN Artikel auf einmal. Von denen hat ein
 * Mensch keinen ausgewählt — er hat eine Quelle befragt. Sie alle in den
 * Eingang zu legen hiesse, die Kammer zu fluten, in der steht, was jemand
 * bewusst aufgenommen hat.
 *
 * Der Bauplan sagt es selbst, in seiner eigenen Zustandstabelle: der Übergang
 * `raw → in` trägt als Auslöser „Sichtung … | **browse**". Ein Übergang AUS
 * `raw` heraus setzt voraus, dass etwas dort ankommt.
 *
 * Die ID kommt aus der URL, ersatzweise aus dem Titel: `BrowseArticle` hat
 * keine, und ohne stabilen Schlüssel kann die Zustandsmaschine ein Signal nicht
 * wiederfinden, sobald die Liste neu geladen wird.
 */
export function fromBrowseArticle(a: BrowseArticle): IntakeSignal {
  const raw = a.raw_data ?? {};
  const abstract =
    (raw.trail_text as string | undefined) ?? (raw.description as string | undefined) ?? undefined;
  return {
    id: `browse:${a.url || a.name}`,
    stage: 'raw',
    source: a.platform,
    sourceKind: sourceKindOf(a.platform),
    headline: a.name,
    abstract,
    url: a.url,
    observedAt: (raw.published_at as string | undefined) ?? new Date().toISOString(),
    category: null,
    magnitude: 0,
    sources: [{ name: a.platform, count: 1 }],
    socialVolume: 0,
    imageUrl: imageOf(raw),
    raw: a,
  };
}

// ── Aufruf ──────────────────────────────────────────────────────────────────

/** Was `transformArticle` von einem Signal braucht. */
export interface IntakeTransformRequest {
  article_name: string;
  article_platform: string;
  article_url?: string;
  article_raw_data?: Record<string, unknown>;
}

/**
 * Stammt dieses Signal aus dem Scanner (und nicht aus dem Browse-Weg)?
 *
 * Der Unterschied ist nicht kosmetisch: ein Scanner-Kandidat hat eine ZEILE in
 * `news_scan_candidates`, ein gebrowster Artikel gar nichts. „Verwerfen" heisst
 * deshalb beim einen ein `POST …/reject` und beim anderen nur eine Stufe im
 * Zustand — wer das gleich behandelt, verliert entweder eine Entscheidung beim
 * nächsten Laden oder ruft ins Leere.
 *
 * Das Prädikat sitzt auf `raw` und nicht auf dem Signal, damit BEIDE Zweige
 * verengt sind: im Ja-Zweig `ScanCandidate`, im Nein-Zweig `BrowseArticle`.
 * Ein Prädikat über das ganze Signal hätte den Nein-Zweig offen gelassen und
 * dort einen Cast erzwungen — für eine Unterscheidung, die der Compiler
 * treffen kann.
 */
export function isScanCandidate(raw: ScanCandidate | BrowseArticle): raw is ScanCandidate {
  return 'source_adapter' in raw;
}

/**
 * Den Aufruf-Körper für den Schmelztiegel bauen.
 *
 * WARUM HIER UND NICHT IM MODAL: dass ein Kandidat seine Herkunft in
 * `article_platform` trägt und ein gebrowster Artikel in `platform`, ist der
 * letzte Rest der beiden Vokabulare, die die Schleuse zusammenführt. Er gehört
 * an dieselbe Stelle wie die beiden `from*`-Funktionen darüber und nicht in
 * eine Komponente — sonst steht der Unterschied wieder an zwei Orten.
 *
 * Fällt `article_platform` aus, tritt der Adapter an seine Stelle: er IST die
 * Stelle, die die Meldung geliefert hat. Ein Leerstring wäre die Unwahrheit.
 */
export function transformRequestOf(signal: IntakeSignal): IntakeTransformRequest {
  const raw = signal.raw;
  if (isScanCandidate(raw)) {
    return {
      article_name: raw.title,
      article_platform: raw.article_platform || raw.source_adapter,
      article_url: raw.article_url ?? undefined,
      article_raw_data: raw.article_raw_data ?? undefined,
    };
  }
  return {
    article_name: raw.name,
    article_platform: raw.platform,
    article_url: raw.url,
    article_raw_data: raw.raw_data,
  };
}

/** Effektive Magnitude für eine Welt: `eff = min(mag × sus, 1)`. */
export function effectiveMagnitude(magnitude: number, susceptibility: number): number {
  return Math.min(magnitude * susceptibility, 1);
}

/**
 * Unter diesem Wert überspringt eine Resonanz die Welt.
 *
 * ⚠ GEMESSEN, NICHT ÜBERNOMMEN. Der Bauplan nennt 0.2 — an zwei Stellen sogar,
 * als Schwelle UND als Farbgrenze. Der Lauf springt bei **0.05**
 * (`ResonanceService.SKIP_THRESHOLD`, §5 von `_process_simulation_impact`).
 * Mit 0.2 hätte die Suszeptibilitätstafel einem Admin „diese Welt wird
 * übersprungen" für Welten gemeldet, die getroffen werden — und zwar auf dem
 * Schirm, auf dem er einen unumkehrbaren Knopf hält.
 *
 * Der Wert steht hier als RÜCKFALL. Die Wahrheit kommt mit jeder Zeile der
 * Vorschau mit (`will_skip`), weil nur der Server die Ableitung kennt.
 */
export const EFFECT_SKIP_THRESHOLD = 0.05;

/** Die Stufen, die als „im Umlauf" gelten (Kammer ① bis ③). */
export const ACTIVE_STAGES: readonly IntakeStage[] = ['raw', 'in', 'q', 'ev', 'res', 'flag'];
