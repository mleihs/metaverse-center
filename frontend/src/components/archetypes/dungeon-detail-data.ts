/**
 * Dungeon Detail Pages — Extended archetype data for detail views.
 *
 * Extends the showcase ArchetypeSlide with per-archetype content:
 * lore, mechanic, enemies, encounters, banter, authors, objektanker, loot.
 *
 * All content sourced from backend Python dicts and literary research docs.
 * Only The Overthrow is fully populated for the initial implementation.
 */

import { type ArchetypeQuote, type ArchetypeSlide, ARCHETYPES } from '../landing/dungeon-showcase-data.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface GaugeThreshold {
  readonly value: number;
  readonly label: string;
  readonly description: string;
}

export interface GaugeConfig {
  readonly name: string;
  readonly start: number;
  readonly max: number;
  readonly thresholds: readonly GaugeThreshold[];
  /** Whether the gauge fills (0->max) or drains (max->0). */
  readonly direction: 'fill' | 'drain';
}

export interface EnemyPreview {
  readonly name: string;
  readonly nameDe: string;
  readonly tier: 'minion' | 'standard' | 'elite' | 'boss';
  readonly power: number;
  readonly stress: number;
  readonly evasion: number;
  readonly ability: string;
  readonly description: string;
  readonly aptitude: string;
}

export interface EncounterPreview {
  readonly name: string;
  readonly depth: string;
  readonly type: 'narrative' | 'combat' | 'elite';
  readonly description: string;
  readonly choices?: readonly EncounterChoice[];
}

export interface EncounterChoice {
  readonly text: string;
  readonly aptitude?: string;
  readonly difficulty?: string;
}

export interface BanterLine {
  readonly text: string;
  readonly tier: number;
}

export interface AuthorCard {
  readonly name: string;
  readonly works: string;
  readonly concept: string;
  readonly language: string;
  readonly quote?: string;
  readonly primary: boolean;
}

export interface ObjektankerPreview {
  readonly name: string;
  readonly phases: readonly ObjektankerPhase[];
}

export interface ObjektankerPhase {
  readonly label: string;
  readonly text: string;
}

export interface LootPreview {
  readonly name: string;
  readonly tier: 1 | 2 | 3;
  readonly effect: string;
  readonly description: string;
}

export interface ArchetypeDetail extends ArchetypeSlide {
  readonly loreIntro: readonly string[];
  readonly entranceTexts: readonly string[];

  readonly mechanicName: string;
  readonly mechanicDescription: string;
  readonly mechanicGauge: GaugeConfig;
  readonly aptitudeWeights: Record<string, number>;
  readonly roomDistribution: Record<string, number>;

  readonly enemies: readonly EnemyPreview[];
  readonly encounterPreviews: readonly EncounterPreview[];
  readonly banterSamples: readonly BanterLine[];
  readonly authors: readonly AuthorCard[];
  readonly objektanker: readonly ObjektankerPreview[];
  readonly lootShowcase: readonly LootPreview[];

  readonly prevArchetype: { readonly id: string; readonly name: string; readonly numeral: string };
  readonly nextArchetype: { readonly id: string; readonly name: string; readonly numeral: string };
}

// ── Re-export for consumer convenience ───────────────────────────────────────

export type { ArchetypeQuote, ArchetypeSlide };

// ── Helper: find base slide by id ────────────────────────────────────────────

function getBaseSlide(id: string): ArchetypeSlide {
  const slide = ARCHETYPES.find((a) => a.id === id);
  if (!slide) throw new Error(`Unknown archetype: ${id}`);
  return slide;
}

function getNav(id: string): { id: string; name: string; numeral: string } {
  const slide = getBaseSlide(id);
  return { id: slide.id, name: slide.name, numeral: slide.numeral };
}

// ── The Overthrow — Full Content ─────────────────────────────────────────────

const OVERTHROW_DETAIL: ArchetypeDetail = {
  ...getBaseSlide('overthrow'),

  loreIntro: [
    'The Overthrow is the eighth and final archetype of the Resonance Dungeons. Where other archetypes threaten the body or the mind, Der Spiegelpalast targets something more fragile: political certainty.',
    'Three factions contest this space. None are wrong. None are right. The conflict is not between good and evil but between three equally valid claims to authority \u2013 each willing to destroy the others to prove its legitimacy.',
    'The deeper you descend, the more the factions fracture. At the surface, Machiavelli\u2019s cold clarity governs. By the middle depths, Dostoevsky\u2019s paranoia has taken hold. At the bottom, only Orwell\u2019s boot remains \u2013 and the terrible question: whose foot is in it?',
  ],

  entranceTexts: [
    'The threshold is a mirror. Not glass \u2013 political. Every reflection shows a different allegiance. Der Spiegelpalast does not ask who you are. It asks who you are for.',
    'The air smells of ink and ambition. Decrees are being written somewhere deeper. The decrees will contradict each other. Both will be enforced.',
    'Factions. The word is not adequate. These are ecosystems of belief, each convinced of its own necessity. Machiavelli\u2019s fox and lion, multiplied.',
    'Power changes hands here. Not violently \u2013 procedurally. The forms are filled out. The signatures are forged. The forgeries are notarized.',
    'The descent begins. Not into darkness \u2013 into politics. The lighting is excellent. Everything is visible. Zamyatin\u2019s glass walls. Privacy is not forbidden. It is conceptually abolished.',
  ],

  mechanicName: 'Authority Fracture',
  mechanicDescription:
    'The Spiegelpalast\u2019s unique resonance mechanic. As you descend, political order disintegrates. Factions splinter. Alliances dissolve. Every room you enter, every battle you fight, every failed negotiation widens the cracks.',

  mechanicGauge: {
    name: 'Fracture',
    start: 0,
    max: 100,
    direction: 'fill',
    thresholds: [
      { value: 0, label: 'Court Order', description: 'Clinical. Precise. Machiavelli governs.' },
      { value: 20, label: 'Whispers', description: 'Tension rising. Dostoevsky\'s underground.' },
      { value: 40, label: 'Schism', description: 'Stress \u00d71.10. 20% ambush chance. Factions fracturing.' },
      { value: 60, label: 'Revolution', description: 'Stress \u00d71.25. 35% ambush. Koestler\u2019s interrogations.' },
      { value: 80, label: 'New Regime', description: 'Stress \u00d71.50. Betrayals constant. Arendt\u2019s banality.' },
      { value: 100, label: 'Collapse', description: 'Stress \u00d72.0. Total power vacuum. Party wipe.' },
    ],
  },

  aptitudeWeights: {
    Propagandist: 30,
    Spy: 25,
    Infiltrator: 15,
    Saboteur: 12,
    Guardian: 10,
    Assassin: 8,
  },

  roomDistribution: {
    Combat: 20,
    Encounter: 45,
    Elite: 5,
    Rest: 10,
    Treasure: 10,
    Exit: 10,
  },

  // ── Bestiary ──

  enemies: [
    {
      name: 'Faction Informer',
      nameDe: 'Fraktionsspitzel',
      tier: 'minion',
      power: 2,
      stress: 4,
      evasion: 45,
      ability: 'Denounce',
      aptitude: 'Spy',
      description:
        'Havel\u2019s greengrocer made operative. The informer does not believe \u2013 the informer performs. The sign in the window says what the faction requires. Behind the counter, the informer reports who does not display theirs.',
    },
    {
      name: 'Propaganda Agent',
      nameDe: 'Propagandaagent',
      tier: 'standard',
      power: 3,
      stress: 6,
      evasion: 20,
      ability: 'Rewrite',
      aptitude: 'Propagandist',
      description:
        'Orwell\u2019s Squealer on two legs. The agent does not lie \u2013 the agent renders the concept of lying meaningless. Yesterday\u2019s alliance was always today\u2019s betrayal. The records have been updated. The records were always thus.',
    },
    {
      name: 'Regime Enforcer',
      nameDe: 'Regimevollstrecker',
      tier: 'standard',
      power: 5,
      stress: 3,
      evasion: 10,
      ability: 'Suppress',
      aptitude: 'Guardian',
      description:
        'The muscle behind the rhetoric. The enforcer does not care which faction gives the order \u2013 only that the order exists. Arendt\u2019s ideal subject: one for whom the distinction between fact and fiction has ceased to matter.',
    },
    {
      name: 'Grand Inquisitor',
      nameDe: 'Gro\u00dfinquisitor',
      tier: 'elite',
      power: 4,
      stress: 8,
      evasion: 15,
      ability: 'Interrogate',
      aptitude: 'Propagandist',
      description:
        'Dostoevsky\u2019s three powers made flesh: miracle, mystery, authority. The Inquisitor does not punish dissent \u2013 the Inquisitor explains why dissent was always agreement, misunderstood. The confession is not extracted. It is assisted.',
    },
    {
      name: 'The Pretender',
      nameDe: 'Der Pr\u00e4tendent',
      tier: 'boss',
      power: 5,
      stress: 9,
      evasion: 20,
      ability: 'Rhetoric \u00b7 Rewrite',
      aptitude: 'Propagandist',
      description:
        'Milton\u2019s Satan made sovereign. The Pretender began as a rebel \u2013 magnificent, defiant, charismatic. Power degraded the vision. Phase 1: Book I archangel, addressing armies with impossible eloquence. Phase 2: Book IV, \u2018squat like a toad,\u2019 truth exposed. Phase 3: Book X, permanently serpentine. The Pretender quotes everyone. Especially you.',
    },
  ],

  // ── Encounters ──

  encounterPreviews: [
    {
      name: 'The Faction Offer',
      depth: '1\u20133',
      type: 'narrative',
      description: 'Alliance in exchange for unspecified service. Machiavelli\u2019s fox extends a paw.',
      choices: [
        { text: 'Accept the alliance', aptitude: 'Propagandist', difficulty: '\u22125' },
        { text: 'Gather intelligence first', aptitude: 'Spy', difficulty: '0' },
        { text: 'Decline. Remain unaligned.' },
      ],
    },
    {
      name: 'The Show Trial',
      depth: '2\u20135',
      type: 'narrative',
      description:
        'A trial is in progress. The accused is a former faction leader. The evidence is their own biography \u2013 rewritten. Ki\u0161\u2019s archival voice: clinical, footnoted, devastating.',
      choices: [
        { text: 'Defend the accused', aptitude: 'Propagandist', difficulty: '+5' },
        { text: 'Observe the trial\u2019s mechanism', aptitude: 'Spy', difficulty: '\u22125' },
        { text: 'Leave before verdict' },
      ],
    },
    {
      name: 'The Greengrocer\u2019s Window',
      depth: '1\u20134',
      type: 'narrative',
      description:
        'Display one of multiple contradictory faction slogans to pass. Havel\u2019s greengrocer dilemma: the sign in the window is not a declaration of belief. It is a declaration of compliance.',
      choices: [
        { text: 'Display the dominant faction\u2019s sign', aptitude: 'Infiltrator', difficulty: '\u22125' },
        { text: 'Display your own message', aptitude: 'Propagandist', difficulty: '+5' },
        { text: 'Refuse to display anything' },
      ],
    },
    {
      name: 'Grand Inquisitor Tribunal',
      depth: '3\u20137',
      type: 'elite',
      description:
        'Philosophical debate with Dostoevsky\u2019s three powers: miracle, mystery, authority. The Inquisitor does not seek your guilt. The Inquisitor seeks your agreement.',
      choices: [
        { text: 'Debate the Inquisitor', aptitude: 'Propagandist', difficulty: '+5' },
        { text: 'Fight' },
      ],
    },
  ],

  // ── Banter Samples ──

  banterSamples: [
    { text: 'The corridor is orderly. Signs indicate direction. The signs have been recently updated.', tier: 0 },
    { text: 'Alliance offered. Alliance accepted. The cost will be announced later.', tier: 0 },
    { text: 'Everyone sees what you appear to be. Few experience what you really are. The Spiegelpalast sees both.', tier: 0 },
    { text: 'Three factions. Three truths. None of them are lying. This is the problem.', tier: 1 },
    { text: 'Walls have ears. These walls have faction insignia. The insignia changed since the party entered.', tier: 1 },
    { text: 'The old leader is gone. The new leader enters. Same room. Same desk. Same view from the window.', tier: 2 },
    { text: 'Every revolutionary ends as an oppressor or a heretic. The Spiegelpalast offers both options. Choose quickly.', tier: 2 },
    { text: 'Macht. Macht des Machens. Spiegel. Spiegel des Spiegels. Wer regiert?', tier: 3 },
    { text: 'All factions are equal. But some factions are more equal than others. The sign was always there.', tier: 3 },
    { text: 'Power is not a means; it is an end. One does not establish a dictatorship to safeguard a revolution. The Pretender knows this.', tier: 3 },
  ],

  // ── Literary DNA ──

  authors: [
    { name: 'George Orwell', works: '1984 \u00b7 Animal Farm', concept: 'Power as perpetual re-seizure. Doublethink. Newspeak. The boot forever.', language: 'English', quote: 'Power is not a means; it is an end.', primary: true },
    { name: 'Fyodor Dostoevsky', works: 'Demons \u00b7 The Brothers Karamazov', concept: 'Revolutionary cell as pathology. The Grand Inquisitor\u2019s three powers: miracle, mystery, authority.', language: '\u0420\u0443\u0441\u0441\u043a\u0438\u0439', quote: 'Starting from unlimited freedom, I conclude with unlimited despotism.', primary: true },
    { name: 'Niccol\u00f2 Machiavelli', works: 'The Prince', concept: 'Realpolitik. Virt\u00f9 vs. fortuna. The fox and the lion.', language: 'Italiano', quote: 'Everyone sees what you appear to be, few experience what you really are.', primary: true },
    { name: 'Hannah Arendt', works: 'The Origins of Totalitarianism \u00b7 On Revolution', concept: 'Banality of evil. The collapse of the distinction between fact and fiction.', language: 'English/Deutsch', primary: true },
    { name: 'Arthur Koestler', works: 'Darkness at Noon', concept: 'Revolution as logic. Rubashov\u2019s confession. The party is never wrong.', language: 'English/Deutsch', primary: true },
    { name: 'Bertolt Brecht', works: 'Threepenny Opera \u00b7 Galileo', concept: 'Epic theatre. The alienation effect. Ethics after economics.', language: 'Deutsch', quote: 'Erst kommt das Fressen, dann kommt die Moral.', primary: true },
    { name: 'Albert Camus', works: 'The Rebel \u00b7 The Plague', concept: 'Absurd revolt. Revolution\u2019s self-consumption. The oppressor-heretic binary.', language: 'Fran\u00e7ais', quote: 'Tout r\u00e9volutionnaire finit en oppresseur ou en h\u00e9r\u00e9tique.', primary: false },
    { name: 'V\u00e1clav Havel', works: 'The Power of the Powerless', concept: 'The greengrocer\u2019s sign. Living within the lie. Post-totalitarian systems.', language: '\u010ce\u0161tina', primary: false },
    { name: 'Milan Kundera', works: 'The Book of Laughter and Forgetting', concept: 'Clementis\u2019s fur hat. Memory as political weapon. The erasure of history.', language: '\u010ce\u0161tina', primary: false },
    { name: 'Elias Canetti', works: 'Crowds and Power', concept: 'Mass psychology. The transformation of power. The survivor as ruler.', language: 'Deutsch', primary: false },
    { name: 'Ismail Kadare', works: 'The Palace of Dreams', concept: 'State surveillance via dream interpretation. The bureaucracy of the unconscious.', language: 'Shqip', primary: false },
    { name: 'John Milton', works: 'Paradise Lost', concept: 'Satan: magnificent rebel \u2192 exposed spy \u2192 permanent serpent. The Pretender\u2019s three phases.', language: 'English', primary: false },
  ],

  // ── Objektanker ──

  objektanker: [
    {
      name: 'Faction Banner',
      phases: [
        { label: 'Discovery', text: 'A banner. The insignia is familiar \u2013 from two rooms ago, where it meant something different.' },
        { label: 'Echo', text: 'The banner has been turned inside out. The same insignia, reversed.' },
        { label: 'Mutation', text: 'The banner bears no insignia now. It bears a mirror.' },
        { label: 'Climax', text: 'The banner is blank. All factions have claimed it. All factions have abandoned it. It flies for no one.' },
      ],
    },
    {
      name: 'Decree Stone',
      phases: [
        { label: 'Discovery', text: 'A stone tablet with a decree. The ink is fresh. The decree is reasonable.' },
        { label: 'Echo', text: 'The decree has been amended. The amendment contradicts the original. Both remain binding.' },
        { label: 'Mutation', text: 'Three decrees form a triangle of mutual contradiction. Each abolishes the one before it.' },
        { label: 'Climax', text: 'The decree stone is blank. Not erased \u2013 never inscribed.' },
      ],
    },
    {
      name: 'Informer\u2019s Clipboard',
      phases: [
        { label: 'Discovery', text: 'A clipboard with names. Some checked off. The party\u2019s names are listed but not yet checked.' },
        { label: 'Echo', text: 'The clipboard has grown. More names. The handwriting changes \u2013 multiple informers.' },
        { label: 'Mutation', text: 'The informer\u2019s name is on the list now. The system is recursive.' },
        { label: 'Climax', text: 'Every name is checked off. The list continues. There are no names left. The checking continues.' },
      ],
    },
    {
      name: 'Trial Chair',
      phases: [
        { label: 'Discovery', text: 'An empty chair. The room is arranged for a tribunal. The chair is for the accused.' },
        { label: 'Echo', text: 'The chair has been occupied. Recently. The warmth is still there.' },
        { label: 'Mutation', text: 'The chair faces a mirror now. The accused watches their own trial.' },
        { label: 'Climax', text: 'The chair is for the judge now. The next trial is their own.' },
      ],
    },
    {
      name: 'Mirror Corridor',
      phases: [
        { label: 'Discovery', text: 'Mirrors on both walls. The reflections are accurate. Suspiciously accurate.' },
        { label: 'Echo', text: 'The reflections are slightly ahead of the party.' },
        { label: 'Mutation', text: 'The reflections wear different faction insignia than the party.' },
        { label: 'Climax', text: 'The mirrors face each other. Infinite recursion. The Pretender is in every reflection.' },
      ],
    },
    {
      name: 'Propaganda Poster',
      phases: [
        { label: 'Discovery', text: 'A poster. The message is clear, the design effective. It does not ask you to agree. It assumes you already do.' },
        { label: 'Echo', text: 'The poster has been pasted over with a new one. The new poster says the opposite.' },
        { label: 'Mutation', text: 'Both posters are visible now, layered. The contradiction is the message.' },
        { label: 'Climax', text: 'The poster is blank. The propaganda has moved from paper into the air itself.' },
      ],
    },
    {
      name: 'Scales of Justice',
      phases: [
        { label: 'Discovery', text: 'Balanced scales. Both pans empty. The balance is perfect because nothing is being weighed.' },
        { label: 'Echo', text: 'One pan holds a faction seal. The other holds a different seal. They weigh exactly the same.' },
        { label: 'Mutation', text: 'A thumb on the scale. Whose thumb? The mirror does not show a hand.' },
        { label: 'Climax', text: 'Both pans hit the ground simultaneously. Justice is not blind \u2013 justice has been dismissed.' },
      ],
    },
    {
      name: 'Colossus Pedestal',
      phases: [
        { label: 'Discovery', text: 'An empty pedestal scarred where something massive stood. The shadow has not noticed it is empty.' },
        { label: 'Echo', text: 'The inscription says: \u201cThe Colossus stands because you carry it.\u201d Below: \u201cStop carrying.\u201d' },
        { label: 'Mutation', text: 'Cracks radiating downward. The Colossus was pulled from below. By the hands that built it.' },
        { label: 'Climax', text: 'The pedestal is being rebuilt. Fresh mortar, same dimensions. The builders are the ones who pulled the last one down.' },
      ],
    },
  ],

  // ── Loot ──

  lootShowcase: [
    { name: 'Faction Dossier', tier: 1, effect: 'Stress heal 50', description: 'Kadare\u2019s Palace of Dreams made portable. Knowledge is not power \u2013 knowledge is the absence of fear.' },
    { name: 'Propaganda Leaflet', tier: 1, effect: 'Propagandist +5 (5 rooms)', description: 'Squealer\u2019s latest revision. The words are wrong but the technique is instructive.' },
    { name: 'Informer\u2019s List', tier: 1, effect: 'Spy +5 (5 rooms)', description: 'Some are informers. Some are targets. The difference is a matter of perspective.' },
    { name: 'Safe Conduct Pass', tier: 1, effect: 'Stress resist +10% (4 rooms)', description: 'Valid until the faction leader is replaced. Which could be any moment.' },
    { name: 'Decoded Cipher', tier: 2, effect: 'Stress heal 100', description: 'Manuscripts don\u2019t burn. But codes can be broken.' },
    { name: 'Seal of Office', tier: 2, effect: 'Propagandist +10 (8 rooms)', description: 'The office no longer exists. The seal still carries weight.' },
    { name: 'Double Agent\u2019s Testimony', tier: 2, effect: 'Stress resist +15% (6 rooms)', description: 'Ng\u0169g\u0129\u2019s informer-hero: the traitor whose confession is the most heroic act.' },
    { name: 'Erased Photograph', tier: 2, effect: 'Memory item', description: 'Kundera\u2019s Clementis photograph. The body erased, the fur hat remaining.' },
    { name: 'Authority Fragment', tier: 3, effect: 'Zone security +1 tier (10 ticks)', description: 'A fragment of legitimate authority, salvaged from the Spiegelpalast.' },
    { name: 'Colossus Splinter', tier: 3, effect: 'All agents +15% morale (10 ticks)', description: 'La Bo\u00e9tie\u2019s proof: tyranny requires consent.' },
    { name: 'Mirror Shard', tier: 3, effect: 'Openness +5', description: 'It still reflects \u2013 but what it reflects is no longer the room.' },
  ],

  // ── Navigation ──

  prevArchetype: getNav('awakening'),
  nextArchetype: getNav('shadow'),
};

// ── Registry ─────────────────────────────────────────────────────────────────

const ARCHETYPE_DETAILS: ReadonlyMap<string, ArchetypeDetail> = new Map([
  ['overthrow', OVERTHROW_DETAIL],
]);

/**
 * Get the full detail data for an archetype by slug.
 * Returns undefined if the archetype has no detail page yet.
 */
export function getArchetypeDetail(id: string): ArchetypeDetail | undefined {
  return ARCHETYPE_DETAILS.get(id);
}

/** All archetype slugs that have detail pages. */
export function getAvailableArchetypeIds(): string[] {
  return [...ARCHETYPE_DETAILS.keys()];
}

/** Ordered archetype list for navigation (uses showcase order). */
export { ARCHETYPES };
