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

import type { EchoVector, SourceCategory } from './index.js';
import type { BrowseArticle } from '../services/api/SocialTrendsApiService.js';
import type { AdapterInfo, ScanCandidate } from '../services/api/ScannerApiService.js';

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

/** Die Linse: wie aus dem Signal ein Ereignis DIESER Welt wird. */
export interface IntakeLens {
  zone: string;
  vector: EchoVector;
  tone: string;
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

  lens?: IntakeLens;
  proposal?: IntakeProposal;

  /** Die unveränderte Herkunft, für alles, was der Adapter nicht abbildet. */
  raw: ScanCandidate | BrowseArticle;
}

// ── Kategorie → Archetyp ────────────────────────────────────────────────────

/**
 * Die acht Kategorien des Scanners auf die acht Archetypen.
 *
 * Die Werte sind die `ResonanceArchetype`-Union, also die Bezeichner, die das
 * Backend führt — NICHT die Anzeigenamen. Übersetzt wird in der Komponente,
 * damit dieselbe Zuordnung in beiden Sprachen gilt.
 */
export const CATEGORY_ARCHETYPE: Record<SourceCategory, string> = {
  economic_crisis: 'The Tower',
  military_conflict: 'The Shadow',
  pandemic: 'The Devouring Mother',
  natural_disaster: 'The Deluge',
  political_upheaval: 'The Overthrow',
  tech_breakthrough: 'The Prometheus',
  cultural_shift: 'The Awakening',
  environmental_disaster: 'The Entropy',
};

// ── Quellenklasse ───────────────────────────────────────────────────────────

/** Adapter, die nur Tempo und Reichweite liefern, nie ein eigenes Signal. */
const SOCIAL_ADAPTERS = new Set(['reddit', 'bluesky']);
/** Adapter, deren Ausgabe halbstrukturiert ist. */
const SEMI_ADAPTERS = new Set(['who', 'who_outbreaks', 'hackernews']);
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
    sources: [{ name: c.source_adapter, count: 1 }],
    socialVolume: 0,
    raw: c,
  };
}

/**
 * Ein gebrowster Artikel als Signal.
 *
 * Der Artikel ist die ärmere Quelle: keine Kategorie, keine Magnitude, keine
 * Begründung — die entstehen erst im Schmelztiegel. `magnitude: 0` ist deshalb
 * kein Messwert, sondern „noch nicht gemessen", und die Oberfläche muss das
 * unterscheiden können. Er landet direkt im Eingang, weil ihn ein Mensch
 * bereits ausgewählt hat.
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
    stage: 'in',
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
    raw: a,
  };
}

/** Effektive Magnitude für eine Welt: `eff = min(mag × sus, 1)`. */
export function effectiveMagnitude(magnitude: number, susceptibility: number): number {
  return Math.min(magnitude * susceptibility, 1);
}

/** Unter diesem Wert überspringt eine Resonanz die Welt. */
export const EFFECT_SKIP_THRESHOLD = 0.2;

/** Die Stufen, die als „im Umlauf" gelten (Kammer ① bis ③). */
export const ACTIVE_STAGES: readonly IntakeStage[] = ['raw', 'in', 'q', 'ev', 'res', 'flag'];
