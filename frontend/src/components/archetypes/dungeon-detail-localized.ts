/**
 * Locale-aware accessor for archetype detail data.
 *
 * Flattens the bilingual ArchetypeDetail (en + de fields) into
 * monolingual LocalizedArchetypeDetail based on the active locale.
 *
 * The @localized() decorator on the consuming view triggers re-renders
 * on locale change, so calling this in render() guarantees fresh data.
 */

import { localeService } from '../../services/i18n/locale-service.js';
import {
  type ArchetypeDetail,
  type AuthorCard,
  type BanterLine,
  type EncounterChoice,
  type EncounterPreview,
  type EnemyPreview,
  type GaugeConfig,
  type GaugeThreshold,
  type LootPreview,
  type ObjektankerPhase,
  type ObjektankerPreview,
  getArchetypeDetail,
  getAvailableArchetypeIds,
  ARCHETYPES,
} from './dungeon-detail-data.js';

// ── Localized types (single-language, no De fields) ─────────────────────────

export interface LocalizedGaugeThreshold {
  readonly value: number;
  readonly label: string;
  readonly description: string;
}

export interface LocalizedGaugeConfig {
  readonly name: string;
  readonly start: number;
  readonly max: number;
  readonly thresholds: readonly LocalizedGaugeThreshold[];
  readonly direction: 'fill' | 'drain';
}

export interface LocalizedEnemyPreview {
  readonly name: string;
  /** Alternate-language name for subtitle display (DE in EN mode, EN in DE mode). */
  readonly nameAlt: string;
  readonly tier: 'minion' | 'standard' | 'elite' | 'boss';
  readonly power: number;
  readonly stress: number;
  readonly evasion: number;
  readonly ability: string;
  readonly description: string;
  readonly aptitude: string;
}

export interface LocalizedEncounterChoice {
  readonly text: string;
  readonly aptitude?: string;
  readonly difficulty?: string;
}

export interface LocalizedEncounterPreview {
  readonly name: string;
  readonly depth: string;
  readonly type: 'narrative' | 'combat' | 'elite';
  readonly description: string;
  readonly choices?: readonly LocalizedEncounterChoice[];
}

export interface LocalizedBanterLine {
  readonly text: string;
  readonly tier: number;
}

export interface LocalizedAuthorCard {
  readonly name: string;
  readonly works: string;
  readonly concept: string;
  readonly language: string;
  readonly quote?: string;
  readonly primary: boolean;
}

export interface LocalizedObjektankerPhase {
  readonly label: string;
  readonly text: string;
}

export interface LocalizedObjektankerPreview {
  readonly name: string;
  readonly phases: readonly LocalizedObjektankerPhase[];
}

export interface LocalizedLootPreview {
  readonly name: string;
  readonly tier: 1 | 2 | 3;
  readonly effect: string;
  readonly description: string;
}

export interface LocalizedProse {
  readonly mechanicGainTitle: string;
  readonly mechanicGainText: string;
  readonly mechanicReduceTitle: string;
  readonly mechanicReduceText: string;
  readonly mechanicReduceEmphasis: string;
  readonly encounterIntro: string;
  readonly bestiaryIntro: string;
  readonly banterHeader: string;
  readonly objektankerHeader: string;
  readonly objektankerIntro: string;
  readonly exitQuote: string;
  readonly exitCta: string;
  readonly exitCtaText: string;
}

export interface LocalizedArchetypeDetail {
  // Inherited from ArchetypeSlide
  readonly id: string;
  readonly name: string;
  readonly numeral: string;
  readonly subtitle: string;
  readonly tagline: string;
  readonly accent: string;
  readonly imageUrl: string;
  readonly quotes: readonly { readonly text: string; readonly author: string; readonly original?: string; readonly originalLang?: string }[];

  // Localized prose
  readonly loreIntro: readonly string[];
  readonly entranceTexts: readonly string[];
  readonly mechanicName: string;
  readonly mechanicDescription: string;
  readonly mechanicGauge: LocalizedGaugeConfig;
  readonly mechanicGaugePreviewValue: number;
  readonly aptitudeWeights: Record<string, number>;
  readonly roomDistribution: Record<string, number>;

  // Localized content collections
  readonly enemies: readonly LocalizedEnemyPreview[];
  readonly encounterPreviews: readonly LocalizedEncounterPreview[];
  readonly banterSamples: readonly LocalizedBanterLine[];
  readonly authors: readonly LocalizedAuthorCard[];
  readonly objektanker: readonly LocalizedObjektankerPreview[];
  readonly lootShowcase: readonly LocalizedLootPreview[];
  readonly prose: LocalizedProse;

  readonly prevArchetype: { readonly id: string; readonly name: string; readonly numeral: string };
  readonly nextArchetype: { readonly id: string; readonly name: string; readonly numeral: string };
}

// ── Localization helpers ────────────────────────────────────────────────────

function localizeThreshold(t: GaugeThreshold, de: boolean): LocalizedGaugeThreshold {
  return {
    value: t.value,
    label: de ? t.labelDe : t.label,
    description: de ? t.descriptionDe : t.description,
  };
}

function localizeGauge(g: GaugeConfig, de: boolean): LocalizedGaugeConfig {
  return {
    name: de ? g.nameDe : g.name,
    start: g.start,
    max: g.max,
    direction: g.direction,
    thresholds: g.thresholds.map((t) => localizeThreshold(t, de)),
  };
}

function localizeEnemy(e: EnemyPreview, de: boolean): LocalizedEnemyPreview {
  return {
    name: de ? e.nameDe : e.name,
    nameAlt: de ? e.name : e.nameDe,
    tier: e.tier,
    power: e.power,
    stress: e.stress,
    evasion: e.evasion,
    ability: de ? e.abilityDe : e.ability,
    description: de ? e.descriptionDe : e.description,
    aptitude: e.aptitude,
  };
}

function localizeChoice(c: EncounterChoice, de: boolean): LocalizedEncounterChoice {
  return {
    text: de ? c.textDe : c.text,
    aptitude: c.aptitude,
    difficulty: c.difficulty,
  };
}

function localizeEncounter(e: EncounterPreview, de: boolean): LocalizedEncounterPreview {
  return {
    name: de ? e.nameDe : e.name,
    depth: e.depth,
    type: e.type,
    description: de ? e.descriptionDe : e.description,
    choices: e.choices?.map((c) => localizeChoice(c, de)),
  };
}

function localizeBanter(b: BanterLine, de: boolean): LocalizedBanterLine {
  return { text: de ? b.textDe : b.text, tier: b.tier };
}

function localizeAuthor(a: AuthorCard, de: boolean): LocalizedAuthorCard {
  return {
    name: a.name,
    works: a.works,
    concept: de ? a.conceptDe : a.concept,
    language: a.language,
    quote: a.quote,
    primary: a.primary,
  };
}

function localizePhase(p: ObjektankerPhase, de: boolean): LocalizedObjektankerPhase {
  return {
    label: de ? p.labelDe : p.label,
    text: de ? p.textDe : p.text,
  };
}

function localizeObjektanker(o: ObjektankerPreview, de: boolean): LocalizedObjektankerPreview {
  return {
    name: de ? o.nameDe : o.name,
    phases: o.phases.map((p) => localizePhase(p, de)),
  };
}

function localizeProse(p: ArchetypeDetail['prose'], de: boolean): LocalizedProse {
  return {
    mechanicGainTitle: de ? p.mechanicGainTitleDe : p.mechanicGainTitle,
    mechanicGainText: de ? p.mechanicGainTextDe : p.mechanicGainText,
    mechanicReduceTitle: de ? p.mechanicReduceTitleDe : p.mechanicReduceTitle,
    mechanicReduceText: de ? p.mechanicReduceTextDe : p.mechanicReduceText,
    mechanicReduceEmphasis: de ? p.mechanicReduceEmphasisDe : p.mechanicReduceEmphasis,
    encounterIntro: de ? p.encounterIntroDe : p.encounterIntro,
    bestiaryIntro: de ? p.bestiaryIntroDe : p.bestiaryIntro,
    banterHeader: de ? p.banterHeaderDe : p.banterHeader,
    objektankerHeader: de ? p.objektankerHeaderDe : p.objektankerHeader,
    objektankerIntro: de ? p.objektankerIntroDe : p.objektankerIntro,
    exitQuote: de ? p.exitQuoteDe : p.exitQuote,
    exitCta: de ? p.exitCtaDe : p.exitCta,
    exitCtaText: de ? p.exitCtaTextDe : p.exitCtaText,
  };
}

function localizeLoot(l: LootPreview, de: boolean): LocalizedLootPreview {
  return {
    name: de ? l.nameDe : l.name,
    tier: l.tier,
    effect: l.effect,
    description: de ? l.descriptionDe : l.description,
  };
}

function localizeDetail(d: ArchetypeDetail, de: boolean): LocalizedArchetypeDetail {
  return {
    id: d.id,
    name: d.name,
    numeral: d.numeral,
    subtitle: d.subtitle,
    tagline: d.tagline,
    accent: d.accent,
    imageUrl: d.imageUrl,
    quotes: d.quotes,

    loreIntro: de ? d.loreIntroDe : d.loreIntro,
    entranceTexts: de ? d.entranceTextsDe : d.entranceTexts,
    mechanicName: de ? d.mechanicNameDe : d.mechanicName,
    mechanicDescription: de ? d.mechanicDescriptionDe : d.mechanicDescription,
    mechanicGauge: localizeGauge(d.mechanicGauge, de),
    mechanicGaugePreviewValue: d.mechanicGaugePreviewValue,
    aptitudeWeights: d.aptitudeWeights,
    roomDistribution: d.roomDistribution,

    enemies: d.enemies.map((e) => localizeEnemy(e, de)),
    encounterPreviews: d.encounterPreviews.map((e) => localizeEncounter(e, de)),
    banterSamples: d.banterSamples.map((b) => localizeBanter(b, de)),
    authors: d.authors.map((a) => localizeAuthor(a, de)),
    objektanker: d.objektanker.map((o) => localizeObjektanker(o, de)),
    lootShowcase: d.lootShowcase.map((l) => localizeLoot(l, de)),
    prose: localizeProse(d.prose, de),

    prevArchetype: d.prevArchetype,
    nextArchetype: d.nextArchetype,
  };
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Get localized detail data for an archetype by slug.
 * Reads the current locale from LocaleService.
 * Call in render() so @localized() re-render picks up locale changes.
 */
export function getLocalizedArchetypeDetail(id: string): LocalizedArchetypeDetail | undefined {
  const raw = getArchetypeDetail(id);
  if (!raw) return undefined;
  const de = localeService.currentLocale === 'de';
  return localizeDetail(raw, de);
}

/** Re-exports for consumer convenience. */
export { getAvailableArchetypeIds, ARCHETYPES };
