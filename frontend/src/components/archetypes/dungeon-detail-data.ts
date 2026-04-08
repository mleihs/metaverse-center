/**
 * Dungeon Detail Pages — Extended archetype data for detail views.
 *
 * Extends the showcase ArchetypeSlide with per-archetype content:
 * lore, mechanic, enemies, encounters, banter, authors, objektanker, loot.
 *
 * All content is bilingual (EN/DE). German text sourced from:
 * - DB seed migrations (enemies, encounters, banter, loot, objektanker, entrance texts)
 * - Fresh literary translation (loreIntro, mechanic, gauge thresholds, author concepts)
 *
 * Overthrow, Shadow, Tower, and Mother are fully populated.
 */

import { type ArchetypeQuote, type ArchetypeSlide, ARCHETYPES } from '../landing/dungeon-showcase-data.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface GaugeThreshold {
  readonly value: number;
  readonly label: string;
  readonly labelDe: string;
  readonly description: string;
  readonly descriptionDe: string;
}

export interface GaugeConfig {
  readonly name: string;
  readonly nameDe: string;
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
  readonly abilityDe: string;
  readonly description: string;
  readonly descriptionDe: string;
  readonly aptitude: string;
}

export interface EncounterPreview {
  readonly name: string;
  readonly nameDe: string;
  readonly depth: string;
  readonly type: 'narrative' | 'combat' | 'elite';
  readonly description: string;
  readonly descriptionDe: string;
  readonly choices?: readonly EncounterChoice[];
}

export interface EncounterChoice {
  readonly text: string;
  readonly textDe: string;
  readonly aptitude?: string;
  readonly difficulty?: string;
}

export interface BanterLine {
  readonly text: string;
  readonly textDe: string;
  readonly tier: number;
}

export interface AuthorCard {
  readonly name: string;
  readonly works: string;
  readonly concept: string;
  readonly conceptDe: string;
  readonly language: string;
  readonly quote?: string;
  readonly primary: boolean;
}

export interface ObjektankerPreview {
  readonly name: string;
  readonly nameDe: string;
  readonly phases: readonly ObjektankerPhase[];
}

export interface ObjektankerPhase {
  readonly label: string;
  readonly labelDe: string;
  readonly text: string;
  readonly textDe: string;
}

export interface LootPreview {
  readonly name: string;
  readonly nameDe: string;
  readonly tier: 1 | 2 | 3;
  readonly effect: string;
  readonly description: string;
  readonly descriptionDe: string;
}

export interface ArchetypeDetail extends ArchetypeSlide {
  readonly loreIntro: readonly string[];
  readonly loreIntroDe: readonly string[];
  readonly entranceTexts: readonly string[];
  readonly entranceTextsDe: readonly string[];

  readonly mechanicName: string;
  readonly mechanicNameDe: string;
  readonly mechanicDescription: string;
  readonly mechanicDescriptionDe: string;
  readonly mechanicGauge: GaugeConfig;
  readonly aptitudeWeights: Record<string, number>;
  readonly roomDistribution: Record<string, number>;

  readonly enemies: readonly EnemyPreview[];
  readonly encounterPreviews: readonly EncounterPreview[];
  readonly banterSamples: readonly BanterLine[];
  readonly authors: readonly AuthorCard[];
  readonly objektanker: readonly ObjektankerPreview[];
  readonly lootShowcase: readonly LootPreview[];

  /** Gauge display value for the animated mechanic room preview (e.g. 42 for Overthrow, 1 for Shadow). */
  readonly mechanicGaugePreviewValue: number;

  readonly prose: {
    readonly mechanicGainTitle: string;
    readonly mechanicGainTitleDe: string;
    readonly mechanicGainText: string;
    readonly mechanicGainTextDe: string;
    readonly mechanicReduceTitle: string;
    readonly mechanicReduceTitleDe: string;
    readonly mechanicReduceText: string;
    readonly mechanicReduceTextDe: string;
    readonly mechanicReduceEmphasis: string;
    readonly mechanicReduceEmphasisDe: string;
    readonly encounterIntro: string;
    readonly encounterIntroDe: string;
    readonly bestiaryIntro: string;
    readonly bestiaryIntroDe: string;
    readonly banterHeader: string;
    readonly banterHeaderDe: string;
    readonly objektankerHeader: string;
    readonly objektankerHeaderDe: string;
    readonly objektankerIntro: string;
    readonly objektankerIntroDe: string;
    readonly exitQuote: string;
    readonly exitQuoteDe: string;
    readonly exitCta: string;
    readonly exitCtaDe: string;
    readonly exitCtaText: string;
    readonly exitCtaTextDe: string;
  };

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

// ── The Overthrow — Full Bilingual Content ──────────────────────────────────

const OVERTHROW_DETAIL: ArchetypeDetail = {
  ...getBaseSlide('overthrow'),

  loreIntro: [
    'The Overthrow is the eighth and final archetype of the Resonance Dungeons. Where other archetypes threaten the body or the mind, Der Spiegelpalast targets something more fragile: political certainty.',
    'Three factions contest this space. None are wrong. None are right. The conflict is not between good and evil but between three equally valid claims to authority \u2013 each willing to destroy the others to prove its legitimacy.',
    'The deeper you descend, the more the factions fracture. At the surface, Machiavelli\u2019s cold clarity governs. By the middle depths, Dostoevsky\u2019s paranoia has taken hold. At the bottom, only Orwell\u2019s boot remains \u2013 and the terrible question: whose foot is in it?',
  ],

  loreIntroDe: [
    'Der Umsturz ist der achte und letzte Archetyp der Resonanz-Dungeons. Wo andere Archetypen den K\u00f6rper oder den Geist bedrohen, zielt Der Spiegelpalast auf etwas Zerbrechlicheres: politische Gewissheit.',
    'Drei Fraktionen ringen um diesen Raum. Keine liegt falsch. Keine liegt richtig. Der Konflikt verl\u00e4uft nicht zwischen Gut und B\u00f6se, sondern zwischen drei gleicherma\u00dfen g\u00fcltigen Anspr\u00fcchen auf Autorit\u00e4t \u2013 jeder bereit, die anderen zu vernichten, um seine Legitimit\u00e4t zu beweisen.',
    'Je tiefer ihr absteigt, desto mehr zersplittern die Fraktionen. An der Oberfl\u00e4che herrscht Machiavellis kalte Klarheit. In mittlerer Tiefe hat Dostojewskis Paranoia die Kontrolle \u00fcbernommen. Am Grund bleibt nur noch Orwells Stiefel \u2013 und die schreckliche Frage: wessen Fu\u00df steckt darin?',
  ],

  entranceTexts: [
    'The threshold is a mirror. Not glass \u2013 political. Every reflection shows a different allegiance. Der Spiegelpalast does not ask who you are. It asks who you are for.',
    'The air smells of ink and ambition. Decrees are being written somewhere deeper. The decrees will contradict each other. Both will be enforced.',
    'Factions. The word is not adequate. These are ecosystems of belief, each convinced of its own necessity. Machiavelli\u2019s fox and lion, multiplied.',
    'Power changes hands here. Not violently \u2013 procedurally. The forms are filled out. The signatures are forged. The forgeries are notarized.',
    'The descent begins. Not into darkness \u2013 into politics. The lighting is excellent. Everything is visible. Zamyatin\u2019s glass walls. Privacy is not forbidden. It is conceptually abolished.',
  ],

  entranceTextsDe: [
    'Die Schwelle ist ein Spiegel. Nicht Glas \u2013 politisch. Jede Spiegelung zeigt eine andere Treue. Der Spiegelpalast fragt nicht, wer ihr seid. Er fragt, f\u00fcr wen ihr seid.',
    'Die Luft riecht nach Tinte und Ehrgeiz. Irgendwo tiefer werden Dekrete geschrieben. Die Dekrete werden sich widersprechen. Beide werden durchgesetzt.',
    'Fraktionen. Das Wort ist nicht ad\u00e4quat. Das sind \u00d6kosysteme des Glaubens, jedes \u00fcberzeugt von seiner eigenen Notwendigkeit. Machiavellis Fuchs und L\u00f6we, multipliziert.',
    'Hier wechselt die Macht die H\u00e4nde. Nicht gewaltsam \u2013 verfahrenstechnisch. Die Formulare werden ausgef\u00fcllt. Die Unterschriften werden gef\u00e4lscht. Die F\u00e4lschungen werden beglaubigt.',
    'Der Abstieg beginnt. Nicht in Dunkelheit \u2013 in Politik. Die Beleuchtung ist ausgezeichnet. Alles ist sichtbar. Zamjatins gl\u00e4serne W\u00e4nde. Privatsph\u00e4re ist nicht verboten. Sie ist begrifflich abgeschafft.',
  ],

  mechanicName: 'Authority Fracture',
  mechanicNameDe: 'Autorit\u00e4tsfraktur',
  mechanicDescription:
    'The Spiegelpalast\u2019s unique resonance mechanic. As you descend, political order disintegrates. Factions splinter. Alliances dissolve. Every room you enter, every battle you fight, every failed negotiation widens the cracks.',
  mechanicDescriptionDe:
    'Die einzigartige Resonanzmechanik des Spiegelpalasts. Je tiefer ihr absteigt, desto mehr zerf\u00e4llt die politische Ordnung. Fraktionen zersplittern. B\u00fcndnisse l\u00f6sen sich auf. Jeder Raum, den ihr betretet, jeder Kampf, jede gescheiterte Verhandlung verbreitert die Risse.',

  mechanicGauge: {
    name: 'Fracture',
    nameDe: 'Fraktur',
    start: 0,
    max: 100,
    direction: 'fill',
    thresholds: [
      { value: 0, label: 'Court Order', labelDe: 'Hofstaat', description: 'Clinical. Precise. Machiavelli governs.', descriptionDe: 'Klinisch. Pr\u00e4zise. Machiavelli regiert.' },
      { value: 20, label: 'Whispers', labelDe: 'Gefl\u00fcster', description: 'Tension rising. Dostoevsky\'s underground.', descriptionDe: 'Spannung steigt. Dostojewskis Untergrund.' },
      { value: 40, label: 'Schism', labelDe: 'Schisma', description: 'Stress \u00d71.10. 20% ambush chance. Factions fracturing.', descriptionDe: 'Stress \u00d71,10. 20% Hinterhalt. Fraktionen brechen.' },
      { value: 60, label: 'Revolution', labelDe: 'Revolution', description: 'Stress \u00d71.25. 35% ambush. Koestler\u2019s interrogations.', descriptionDe: 'Stress \u00d71,25. 35% Hinterhalt. Koestlers Verh\u00f6re.' },
      { value: 80, label: 'New Regime', labelDe: 'Neues Regime', description: 'Stress \u00d71.50. Betrayals constant. Arendt\u2019s banality.', descriptionDe: 'Stress \u00d71,50. Verrat permanent. Arendts Banalit\u00e4t.' },
      { value: 100, label: 'Collapse', labelDe: 'Kollaps', description: 'Stress \u00d72.0. Total power vacuum. Party wipe.', descriptionDe: 'Stress \u00d72,0. Totales Machtvakuum. Gruppenvernichtung.' },
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

  mechanicGaugePreviewValue: 42,

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
      abilityDe: 'Denunzieren',
      aptitude: 'Spy',
      description:
        'Havel\u2019s greengrocer made operative. The informer does not believe \u2013 the informer performs. The sign in the window says what the faction requires. Behind the counter, the informer reports who does not display theirs.',
      descriptionDe:
        'Havels Gem\u00fcseh\u00e4ndler, zum Agenten geworden. Der Spitzel glaubt nicht \u2013 der Spitzel f\u00fchrt auf. Das Schild im Fenster sagt, was die Fraktion verlangt. Hinter der Theke meldet der Spitzel, wer seines nicht zeigt.',
    },
    {
      name: 'Propaganda Agent',
      nameDe: 'Propagandaagent',
      tier: 'standard',
      power: 3,
      stress: 6,
      evasion: 20,
      ability: 'Rewrite',
      abilityDe: 'Umschreiben',
      aptitude: 'Propagandist',
      description:
        'Orwell\u2019s Squealer on two legs. The agent does not lie \u2013 the agent renders the concept of lying meaningless. Yesterday\u2019s alliance was always today\u2019s betrayal. The records have been updated. The records were always thus.',
      descriptionDe:
        'Orwells Schwatzwutz auf zwei Beinen. Der Agent l\u00fcgt nicht \u2013 der Agent macht den Begriff des L\u00fcgens bedeutungslos. Das gestrige B\u00fcndnis war schon immer der heutige Verrat. Die Akten wurden aktualisiert. Die Akten waren immer so.',
    },
    {
      name: 'Regime Enforcer',
      nameDe: 'Regimevollstrecker',
      tier: 'standard',
      power: 5,
      stress: 3,
      evasion: 10,
      ability: 'Suppress',
      abilityDe: 'Unterdr\u00fccken',
      aptitude: 'Guardian',
      description:
        'The muscle behind the rhetoric. The enforcer does not care which faction gives the order \u2013 only that the order exists. Arendt\u2019s ideal subject: one for whom the distinction between fact and fiction has ceased to matter.',
      descriptionDe:
        'Die Muskeln hinter der Rhetorik. Der Vollstrecker k\u00fcmmert sich nicht, welche Fraktion den Befehl gibt \u2013 nur dass der Befehl existiert. Arendts ideales Subjekt: eines, f\u00fcr das der Unterschied zwischen Tatsache und Fiktion aufgeh\u00f6rt hat zu z\u00e4hlen.',
    },
    {
      name: 'Grand Inquisitor',
      nameDe: 'Gro\u00dfinquisitor',
      tier: 'elite',
      power: 4,
      stress: 8,
      evasion: 15,
      ability: 'Interrogate',
      abilityDe: 'Verh\u00f6ren',
      aptitude: 'Propagandist',
      description:
        'Dostoevsky\u2019s three powers made flesh: miracle, mystery, authority. The Inquisitor does not punish dissent \u2013 the Inquisitor explains why dissent was always agreement, misunderstood. The confession is not extracted. It is assisted.',
      descriptionDe:
        'Dostojewskis drei M\u00e4chte, Fleisch geworden: Wunder, Geheimnis, Autorit\u00e4t. Der Inquisitor bestraft keinen Dissens \u2013 der Inquisitor erkl\u00e4rt, warum Dissens immer Zustimmung war, nur missverstanden. Das Gest\u00e4ndnis wird nicht erzwungen. Es wird begleitet.',
    },
    {
      name: 'The Pretender',
      nameDe: 'Der Pr\u00e4tendent',
      tier: 'boss',
      power: 5,
      stress: 9,
      evasion: 20,
      ability: 'Rhetoric \u00b7 Rewrite',
      abilityDe: 'Rhetorik \u00b7 Umschreiben',
      aptitude: 'Propagandist',
      description:
        'Milton\u2019s Satan made sovereign. The Pretender began as a rebel \u2013 magnificent, defiant, charismatic. Power degraded the vision. Phase 1: Book I archangel, addressing armies with impossible eloquence. Phase 2: Book IV, \u2018squat like a toad,\u2019 truth exposed. Phase 3: Book X, permanently serpentine. The Pretender quotes everyone. Especially you.',
      descriptionDe:
        'Miltons Satan, zum Souver\u00e4n geworden. Der Pr\u00e4tendent begann als Rebell \u2013 pr\u00e4chtig, trotzig, charismatisch. Die Macht zersetzte die Vision. Phase 1: Erzengel aus Buch I, Armeen ansprechend mit unm\u00f6glicher Eloquenz. Phase 2: Buch IV, \u2018hockend wie eine Kr\u00f6te,\u2019 Wahrheit enth\u00fcllt. Phase 3: Buch X, dauerhaft zur Schlange geworden. Der Pr\u00e4tendent zitiert alle. Besonders euch.',
    },
  ],

  // ── Encounters ──

  encounterPreviews: [
    {
      name: 'The Faction Offer',
      nameDe: 'Das Fraktionsangebot',
      depth: '1\u20133',
      type: 'narrative',
      description: 'Alliance in exchange for unspecified service. Machiavelli\u2019s fox extends a paw.',
      descriptionDe: 'B\u00fcndnis im Austausch f\u00fcr einen unbestimmten Dienst. Machiavellis Fuchs reicht eine Pfote.',
      choices: [
        { text: 'Accept the alliance', textDe: 'Das B\u00fcndnis annehmen', aptitude: 'Propagandist', difficulty: '\u22125' },
        { text: 'Gather intelligence first', textDe: 'Erst Informationen sammeln', aptitude: 'Spy', difficulty: '0' },
        { text: 'Decline. Remain unaligned.', textDe: 'Ablehnen. Ungebunden bleiben.' },
      ],
    },
    {
      name: 'The Show Trial',
      nameDe: 'Der Schauprozess',
      depth: '2\u20135',
      type: 'narrative',
      description:
        'A trial is in progress. The accused is a former faction leader. The evidence is their own biography \u2013 rewritten. Ki\u0161\u2019s archival voice: clinical, footnoted, devastating.',
      descriptionDe:
        'Ein Prozess ist im Gange. Der Angeklagte ist ein ehemaliger Fraktionsf\u00fchrer. Der Beweis ist die eigene Biographie \u2013 umgeschrieben. Ki\u0161s Archivstimme: klinisch, fu\u00dfnotiert, verheerend.',
      choices: [
        { text: 'Defend the accused', textDe: 'Den Angeklagten verteidigen', aptitude: 'Propagandist', difficulty: '+5' },
        { text: 'Observe the trial\u2019s mechanism', textDe: 'Den Mechanismus des Prozesses beobachten', aptitude: 'Spy', difficulty: '\u22125' },
        { text: 'Leave before verdict', textDe: 'Vor dem Urteil gehen' },
      ],
    },
    {
      name: 'The Greengrocer\u2019s Window',
      nameDe: 'Das Schaufenster des Gem\u00fcseh\u00e4ndlers',
      depth: '1\u20134',
      type: 'narrative',
      description:
        'Display one of multiple contradictory faction slogans to pass. Havel\u2019s greengrocer dilemma: the sign in the window is not a declaration of belief. It is a declaration of compliance.',
      descriptionDe:
        'Eines von mehreren widerspr\u00fcchlichen Fraktionsslogans zeigen, um durchzukommen. Havels Gem\u00fcseh\u00e4ndler-Dilemma: das Schild im Fenster ist kein Bekenntnis. Es ist eine Erkl\u00e4rung der F\u00fcgsamkeit.',
      choices: [
        { text: 'Display the dominant faction\u2019s sign', textDe: 'Das Schild der dominanten Fraktion zeigen', aptitude: 'Infiltrator', difficulty: '\u22125' },
        { text: 'Display your own message', textDe: 'Die eigene Botschaft zeigen', aptitude: 'Propagandist', difficulty: '+5' },
        { text: 'Refuse to display anything', textDe: 'Kein Schild zeigen' },
      ],
    },
    {
      name: 'Grand Inquisitor Tribunal',
      nameDe: 'Tribunal des Gro\u00dfinquisitors',
      depth: '3\u20137',
      type: 'elite',
      description:
        'Philosophical debate with Dostoevsky\u2019s three powers: miracle, mystery, authority. The Inquisitor does not seek your guilt. The Inquisitor seeks your agreement.',
      descriptionDe:
        'Philosophische Debatte mit Dostojewskis drei M\u00e4chten: Wunder, Geheimnis, Autorit\u00e4t. Der Inquisitor sucht nicht eure Schuld. Der Inquisitor sucht eure Zustimmung.',
      choices: [
        { text: 'Debate the Inquisitor', textDe: 'Den Inquisitor debattieren', aptitude: 'Propagandist', difficulty: '+5' },
        { text: 'Fight', textDe: 'K\u00e4mpfen' },
      ],
    },
  ],

  // ── Banter Samples ──

  banterSamples: [
    { text: 'The corridor is orderly. Signs indicate direction. The signs have been recently updated.', textDe: 'Der Korridor ist ordentlich. Schilder weisen die Richtung. Die Schilder wurden k\u00fcrzlich aktualisiert.', tier: 0 },
    { text: 'Alliance offered. Alliance accepted. The cost will be announced later.', textDe: 'B\u00fcndnis angeboten. B\u00fcndnis angenommen. Die Kosten werden sp\u00e4ter bekanntgegeben.', tier: 0 },
    { text: 'Everyone sees what you appear to be. Few experience what you really are. The Spiegelpalast sees both.', textDe: 'Jeder sieht, was ihr zu sein scheint. Wenige erfahren, was ihr wirklich seid. Der Spiegelpalast sieht beides.', tier: 0 },
    { text: 'Three factions. Three truths. None of them are lying. This is the problem.', textDe: 'Drei Fraktionen. Drei Wahrheiten. Keine davon l\u00fcgt. Das ist das Problem.', tier: 1 },
    { text: 'Walls have ears. These walls have faction insignia. The insignia changed since the party entered.', textDe: 'W\u00e4nde haben Ohren. Diese W\u00e4nde haben Fraktionsabzeichen. Die Abzeichen haben sich ge\u00e4ndert, seit die Gruppe eintrat.', tier: 1 },
    { text: 'The old leader is gone. The new leader enters. Same room. Same desk. Same view from the window.', textDe: 'Der alte Anf\u00fchrer ist weg. Der neue Anf\u00fchrer tritt ein. Derselbe Raum. Derselbe Schreibtisch. Dieselbe Aussicht.', tier: 2 },
    { text: 'Every revolutionary ends as an oppressor or a heretic. The Spiegelpalast offers both options. Choose quickly.', textDe: 'Jeder Revolution\u00e4r endet als Unterdr\u00fccker oder als Ketzer. Der Spiegelpalast bietet beide Optionen. W\u00e4hlt schnell.', tier: 2 },
    { text: 'Macht. Macht des Machens. Spiegel. Spiegel des Spiegels. Wer regiert?', textDe: 'Macht. Macht des Machens. Spiegel. Spiegel des Spiegels. Wer regiert?', tier: 3 },
    { text: 'All factions are equal. But some factions are more equal than others. The sign was always there.', textDe: 'Alle Fraktionen sind gleich. Aber manche Fraktionen sind gleicher als andere. Das Schild war immer da.', tier: 3 },
    { text: 'Power is not a means; it is an end. One does not establish a dictatorship to safeguard a revolution. The Pretender knows this.', textDe: 'Macht ist kein Mittel; sie ist ein Zweck. Man errichtet keine Diktatur, um eine Revolution zu sichern. Der Pr\u00e4tendent wei\u00df das.', tier: 3 },
  ],

  // ── Literary DNA ──

  authors: [
    { name: 'George Orwell', works: '1984 \u00b7 Animal Farm', concept: 'Power as perpetual re-seizure. Doublethink. Newspeak. The boot forever.', conceptDe: 'Macht als immerw\u00e4hrende Wiederaneignung. Doppeldenk. Neusprech. Der Stiefel f\u00fcr immer.', language: 'English', quote: 'Power is not a means; it is an end.', primary: true },
    { name: 'Fyodor Dostoevsky', works: 'Demons \u00b7 The Brothers Karamazov', concept: 'Revolutionary cell as pathology. The Grand Inquisitor\u2019s three powers: miracle, mystery, authority.', conceptDe: 'Revolution\u00e4re Zelle als Pathologie. Die drei M\u00e4chte des Gro\u00dfinquisitors: Wunder, Geheimnis, Autorit\u00e4t.', language: '\u0420\u0443\u0441\u0441\u043a\u0438\u0439', quote: 'Starting from unlimited freedom, I conclude with unlimited despotism.', primary: true },
    { name: 'Niccol\u00f2 Machiavelli', works: 'The Prince', concept: 'Realpolitik. Virt\u00f9 vs. fortuna. The fox and the lion.', conceptDe: 'Realpolitik. Virt\u00f9 gegen Fortuna. Der Fuchs und der L\u00f6we.', language: 'Italiano', quote: 'Everyone sees what you appear to be, few experience what you really are.', primary: true },
    { name: 'Hannah Arendt', works: 'The Origins of Totalitarianism \u00b7 On Revolution', concept: 'Banality of evil. The collapse of the distinction between fact and fiction.', conceptDe: 'Banalit\u00e4t des B\u00f6sen. Der Zusammenbruch der Unterscheidung zwischen Tatsache und Fiktion.', language: 'English/Deutsch', primary: true },
    { name: 'Arthur Koestler', works: 'Darkness at Noon', concept: 'Revolution as logic. Rubashov\u2019s confession. The party is never wrong.', conceptDe: 'Revolution als Logik. Rubaschows Gest\u00e4ndnis. Die Partei irrt sich nie.', language: 'English/Deutsch', primary: true },
    { name: 'Bertolt Brecht', works: 'Threepenny Opera \u00b7 Galileo', concept: 'Epic theatre. The alienation effect. Ethics after economics.', conceptDe: 'Episches Theater. Der Verfremdungseffekt. Ethik nach \u00d6konomie.', language: 'Deutsch', quote: 'Erst kommt das Fressen, dann kommt die Moral.', primary: true },
    { name: 'Albert Camus', works: 'The Rebel \u00b7 The Plague', concept: 'Absurd revolt. Revolution\u2019s self-consumption. The oppressor-heretic binary.', conceptDe: 'Absurde Revolte. Die Selbstverzehrung der Revolution. Das Unterdr\u00fccker-Ketzer-Dilemma.', language: 'Fran\u00e7ais', quote: 'Tout r\u00e9volutionnaire finit en oppresseur ou en h\u00e9r\u00e9tique.', primary: false },
    { name: 'V\u00e1clav Havel', works: 'The Power of the Powerless', concept: 'The greengrocer\u2019s sign. Living within the lie. Post-totalitarian systems.', conceptDe: 'Das Schild des Gem\u00fcseh\u00e4ndlers. Leben in der L\u00fcge. Posttotalit\u00e4re Systeme.', language: '\u010ce\u0161tina', primary: false },
    { name: 'Milan Kundera', works: 'The Book of Laughter and Forgetting', concept: 'Clementis\u2019s fur hat. Memory as political weapon. The erasure of history.', conceptDe: 'Clementis\u2019 Pelzm\u00fctze. Erinnerung als politische Waffe. Die L\u00f6schung der Geschichte.', language: '\u010ce\u0161tina', primary: false },
    { name: 'Elias Canetti', works: 'Crowds and Power', concept: 'Mass psychology. The transformation of power. The survivor as ruler.', conceptDe: 'Massenpsychologie. Die Verwandlung der Macht. Der \u00dcberlebende als Herrscher.', language: 'Deutsch', primary: false },
    { name: 'Ismail Kadare', works: 'The Palace of Dreams', concept: 'State surveillance via dream interpretation. The bureaucracy of the unconscious.', conceptDe: 'Staatliche \u00dcberwachung durch Traumdeutung. Die B\u00fcrokratie des Unbewussten.', language: 'Shqip', primary: false },
    { name: 'John Milton', works: 'Paradise Lost', concept: 'Satan: magnificent rebel \u2192 exposed spy \u2192 permanent serpent. The Pretender\u2019s three phases.', conceptDe: 'Satan: pr\u00e4chtiger Rebell \u2192 entlarvter Spion \u2192 dauerhafte Schlange. Die drei Phasen des Pr\u00e4tendenten.', language: 'English', primary: false },
  ],

  // ── Objektanker (Migration 181 canonical text) ──

  objektanker: [
    {
      name: 'Faction Banner',
      nameDe: 'Fraktionsbanner',
      phases: [
        { label: 'Discovery', labelDe: 'Entdeckung', text: 'A banner. The insignia is familiar \u2013 from two rooms ago, where it meant something different.', textDe: 'Ein Banner. Das Abzeichen ist vertraut \u2013 aus zwei R\u00e4umen zuvor, wo es etwas anderes bedeutete.' },
        { label: 'Echo', labelDe: 'Echo', text: 'The banner has been turned inside out. The same insignia, reversed.', textDe: 'Das Banner wurde umgedreht. Dasselbe Abzeichen, gespiegelt. Das Spiegelbild einer Fraktion.' },
        { label: 'Mutation', labelDe: 'Mutation', text: 'The banner bears no insignia now. It bears a mirror.', textDe: 'Das Banner tr\u00e4gt jetzt kein Abzeichen. Es tr\u00e4gt einen Spiegel. Der Spiegel reflektiert jeden, der hinsieht, in Fraktionsfarben.' },
        { label: 'Climax', labelDe: 'Klimax', text: 'The banner is blank. All factions have claimed it. All factions have abandoned it. It flies for no one.', textDe: 'Das Banner ist leer. Alle Fraktionen haben es beansprucht. Alle Fraktionen haben es aufgegeben. Es weht f\u00fcr niemanden.' },
      ],
    },
    {
      name: 'Decree Stone',
      nameDe: 'Dekretstein',
      phases: [
        { label: 'Discovery', labelDe: 'Entdeckung', text: 'A stone tablet with a decree. The ink is fresh. The decree is reasonable.', textDe: 'Eine Steintafel mit einem Dekret. Die Tinte ist frisch. Das Dekret ist vern\u00fcnftig.' },
        { label: 'Echo', labelDe: 'Echo', text: 'The decree has been amended. The amendment contradicts the original. Both remain binding.', textDe: 'Das Dekret wurde erg\u00e4nzt. Die Erg\u00e4nzung widerspricht dem Original. Beide bleiben bindend.' },
        { label: 'Mutation', labelDe: 'Mutation', text: 'Three decrees form a triangle of mutual contradiction. Each abolishes the one before it.', textDe: 'Der Stein tr\u00e4gt jetzt drei Dekrete. Sie bilden ein Dreieck gegenseitigen Widerspruchs. Jedes hebt das vorige auf. Das letzte hebt sich selbst auf.' },
        { label: 'Climax', labelDe: 'Klimax', text: 'The decree stone is blank. Not erased \u2013 never inscribed.', textDe: 'Der Dekretstein ist leer. Nicht gel\u00f6scht \u2013 nie beschrieben. Die Autorit\u00e4t zu dekretieren wurde f\u00fcr inexistent dekretiert.' },
      ],
    },
    {
      name: 'Informer\u2019s Clipboard',
      nameDe: 'Klemmbrett des Spitzels',
      phases: [
        { label: 'Discovery', labelDe: 'Entdeckung', text: 'A clipboard with names. Some checked off. The party\u2019s names are listed but not yet checked.', textDe: 'Ein Klemmbrett mit Namen. Einige abgehakt. Die Namen der Gruppe sind aufgelistet, aber noch nicht abgehakt.' },
        { label: 'Echo', labelDe: 'Echo', text: 'The clipboard has grown. More names. The handwriting changes \u2013 multiple informers.', textDe: 'Das Klemmbrett ist gewachsen. Mehr Namen. Die Handschrift wechselt \u2013 mehrere Spitzel, dieselbe Liste.' },
        { label: 'Mutation', labelDe: 'Mutation', text: 'The informer\u2019s name is on the list now. The system is recursive.', textDe: 'Der Name des Spitzels steht jetzt auf der Liste. Der Spitzel wird bespitzelt. Das System ist rekursiv.' },
        { label: 'Climax', labelDe: 'Klimax', text: 'Every name is checked off. The list continues. There are no names left. The checking continues.', textDe: 'Jeder Name auf der Liste ist abgehakt. Die Liste geht weiter. Es gibt keine Namen mehr zum Abhaken. Das Abhaken geht weiter.' },
      ],
    },
    {
      name: 'Trial Chair',
      nameDe: 'Stuhl des Angeklagten',
      phases: [
        { label: 'Discovery', labelDe: 'Entdeckung', text: 'An empty chair. The room is arranged for a tribunal. The chair is for the accused.', textDe: 'Ein leerer Stuhl in der Mitte eines Raums. Der Raum ist f\u00fcr ein Tribunal eingerichtet. Der Stuhl ist f\u00fcr den Angeklagten.' },
        { label: 'Echo', labelDe: 'Echo', text: 'The chair has been occupied. Recently. The warmth is still there.', textDe: 'Der Stuhl war besetzt. K\u00fcrzlich. Die W\u00e4rme ist noch da. Das Urteil wurde bereits gef\u00e4llt.' },
        { label: 'Mutation', labelDe: 'Mutation', text: 'The chair faces a mirror now. The accused watches their own trial.', textDe: 'Der Stuhl steht jetzt vor einem Spiegel. Der Angeklagte beobachtet seinen eigenen Prozess. Das Protokoll schreibt sich in den R\u00e4ndern fort. Jedes Wort ist akkurat. Jedes Wort ist eine L\u00fcge.' },
        { label: 'Climax', labelDe: 'Klimax', text: 'The chair is for the judge now. The next trial is their own.', textDe: 'Der Stuhl ist jetzt f\u00fcr den Richter. Der Angeklagte ist weg. Der Richter sitzt und erkennt: der n\u00e4chste Prozess ist der eigene.' },
      ],
    },
    {
      name: 'Mirror Corridor',
      nameDe: 'Spiegelkorridor',
      phases: [
        { label: 'Discovery', labelDe: 'Entdeckung', text: 'Mirrors on both walls. The reflections are accurate. Suspiciously accurate.', textDe: 'Spiegel an beiden W\u00e4nden. Die Spiegelungen sind exakt. Verd\u00e4chtig exakt.' },
        { label: 'Echo', labelDe: 'Echo', text: 'The reflections are slightly ahead of the party.', textDe: 'Die Spiegelungen sind der Gruppe leicht voraus. Sie wissen, wohin die Gruppe geht, bevor die Gruppe es wei\u00df.' },
        { label: 'Mutation', labelDe: 'Mutation', text: 'The reflections wear different faction insignia than the party.', textDe: 'Die Spiegelungen tragen andere Fraktionsabzeichen als die Gruppe. Der Spiegel zeigt Treue, nicht Aussehen.' },
        { label: 'Climax', labelDe: 'Klimax', text: 'The mirrors face each other. Infinite recursion. The Pretender is in every reflection.', textDe: 'Die Spiegel stehen sich gegen\u00fcber. Unendliche Rekursion. Unendliche Fraktionen. Der Pr\u00e4tendent ist in jeder Spiegelung.' },
      ],
    },
    {
      name: 'Propaganda Poster',
      nameDe: 'Propagandaplakat',
      phases: [
        { label: 'Discovery', labelDe: 'Entdeckung', text: 'A poster. The message is clear, the design effective. It does not ask you to agree. It assumes you already do.', textDe: 'Ein Plakat. Die Botschaft ist klar, das Design wirkungsvoll. Die Schrift ist autorit\u00e4r. Die Farben beruhigend. Es bittet nicht um Zustimmung. Es setzt sie voraus.' },
        { label: 'Echo', labelDe: 'Echo', text: 'The poster has been pasted over with a new one. The new poster says the opposite.', textDe: 'Das Plakat wurde mit einem neuen \u00fcberklebt. Das neue Plakat sagt das Gegenteil. Der Klebstoff ist derselbe.' },
        { label: 'Mutation', labelDe: 'Mutation', text: 'Both posters are visible now, layered. The contradiction is the message.', textDe: 'Beide Plakate sind jetzt sichtbar, geschichtet. Der Widerspruch ist die Botschaft. Glaube beides. Glaube nichts. Die Kunst ist nicht das W\u00e4hlen \u2013 es ist das gleichzeitige Halten.' },
        { label: 'Climax', labelDe: 'Klimax', text: 'The poster is blank. The propaganda has moved from paper into the air itself.', textDe: 'Das Plakat ist leer. Nicht abgerissen \u2013 nie gedruckt. Die Propaganda ist vom Papier in die Luft selbst \u00fcbergegangen.' },
      ],
    },
    {
      name: 'Scales of Justice',
      nameDe: 'Waage der Gerechtigkeit',
      phases: [
        { label: 'Discovery', labelDe: 'Entdeckung', text: 'Balanced scales. Both pans empty. The balance is perfect because nothing is being weighed.', textDe: 'Ausbalancierte Waage. Beide Schalen leer. Die Balance ist perfekt, weil nichts gewogen wird.' },
        { label: 'Echo', labelDe: 'Echo', text: 'One pan holds a faction seal. The other holds a different seal. They weigh exactly the same.', textDe: 'Eine Schale h\u00e4lt ein Fraktionssiegel. Die andere ein anderes Fraktionssiegel. Sie wiegen genau gleich.' },
        { label: 'Mutation', labelDe: 'Mutation', text: 'A thumb on the scale. Whose thumb? The mirror does not show a hand.', textDe: 'Ein Daumen auf der Waage. Wessen Daumen? Der Spiegel hinter der Waage zeigt keine Hand.' },
        { label: 'Climax', labelDe: 'Klimax', text: 'Both pans hit the ground simultaneously. Justice is not blind \u2013 justice has been dismissed.', textDe: 'Die Waage kippt. Beide Schalen treffen gleichzeitig den Boden. Gerechtigkeit ist nicht blind \u2013 Gerechtigkeit wurde abgesetzt.' },
      ],
    },
    {
      name: 'Colossus Pedestal',
      nameDe: 'Koloss-Sockel',
      phases: [
        { label: 'Discovery', labelDe: 'Entdeckung', text: 'An empty pedestal scarred where something massive stood. The shadow has not noticed it is empty.', textDe: 'Ein leerer Sockel. Der Stein ist vernarbt, wo etwas Massives stand \u2013 keine Statue, sondern eine Pr\u00e4senz, gro\u00df genug, um einen Schatten zu werfen, der immer noch hier ist. Der Schatten hat nicht bemerkt, dass er leer ist.' },
        { label: 'Echo', labelDe: 'Echo', text: 'The inscription says: \u201cThe Colossus stands because you carry it.\u201d Below: \u201cStop carrying.\u201d', textDe: 'Die Inschrift auf dem Sockel lautet: \u00bbDer Koloss steht, weil ihr ihn tragt.\u00ab Darunter, in einer anderen Handschrift: \u00bbH\u00f6rt auf zu tragen.\u00ab' },
        { label: 'Mutation', labelDe: 'Mutation', text: 'Cracks radiating downward. The Colossus was pulled from below. By the hands that built it.', textDe: 'Risse im Sockel \u2013 nach unten strahlend. Der Koloss ist nicht gefallen. Er wurde gezogen. Von unten. Von den H\u00e4nden, die ihn gebaut haben. Der Stein erinnert sich an jeden Griff.' },
        { label: 'Climax', labelDe: 'Klimax', text: 'The pedestal is being rebuilt. Fresh mortar, same dimensions. The builders are the ones who pulled the last one down.', textDe: 'Der Sockel wird wieder aufgebaut. Frischer M\u00f6rtel, neue Inschrift, selbe Ma\u00dfe. Die Baumeister sind die, die den letzten heruntergerissen haben. Sie haben es nicht bemerkt. Die Baupl\u00e4ne sind dieselben.' },
      ],
    },
  ],

  // ── Loot ──

  lootShowcase: [
    { name: 'Faction Dossier', nameDe: 'Fraktionsdossier', tier: 1, effect: 'Stress heal 50', description: 'Kadare\u2019s Palace of Dreams made portable. Knowledge is not power \u2013 knowledge is the absence of fear.', descriptionDe: 'Namen, B\u00fcndnisse, Schulden. Kadares Palast der Tr\u00e4ume, tragbar gemacht. Wissen ist nicht Macht \u2013 Wissen ist die Abwesenheit von Furcht.' },
    { name: 'Propaganda Leaflet', nameDe: 'Propagandaflugblatt', tier: 1, effect: 'Propagandist +5 (5 rooms)', description: 'Squealer\u2019s latest revision. The words are wrong but the technique is instructive.', descriptionDe: 'Schwatzwutz\u2019 neueste \u00dcberarbeitung. Die Worte sind falsch, aber die Technik ist lehrreich.' },
    { name: 'Informer\u2019s List', nameDe: 'Spitzelliste', tier: 1, effect: 'Spy +5 (5 rooms)', description: 'Some are informers. Some are targets. The difference is a matter of perspective.', descriptionDe: 'Eine Namensliste. Manche sind Spitzel. Manche sind Ziele. Der Unterschied ist eine Frage der Perspektive.' },
    { name: 'Safe Conduct Pass', nameDe: 'Geleitbrief', tier: 1, effect: 'Stress resist +10% (4 rooms)', description: 'Valid until the faction leader is replaced. Which could be any moment.', descriptionDe: 'Unterschrieben von einem Fraktionsf\u00fchrer. G\u00fcltig, bis der Fraktionsf\u00fchrer ersetzt wird. Was jederzeit sein k\u00f6nnte.' },
    { name: 'Decoded Cipher', nameDe: 'Entschl\u00fcsselte Chiffre', tier: 2, effect: 'Stress heal 100', description: 'Manuscripts don\u2019t burn. But codes can be broken.', descriptionDe: 'Fraktionskommunikation, entschl\u00fcsselt. Manuskripte brennen nicht. Aber Codes k\u00f6nnen geknackt werden.' },
    { name: 'Seal of Office', nameDe: 'Amtssiegel', tier: 2, effect: 'Propagandist +10 (8 rooms)', description: 'The office no longer exists. The seal still carries weight.', descriptionDe: 'Ein Amtssiegel. Das Amt existiert nicht mehr. Das Siegel hat noch Gewicht \u2013 Autorit\u00e4t besteht fort, nachdem die Autorit\u00e4t vergangen ist.' },
    { name: 'Double Agent\u2019s Testimony', nameDe: 'Aussage des Doppelagenten', tier: 2, effect: 'Stress resist +15% (6 rooms)', description: 'Ng\u0169g\u0129\u2019s informer-hero: the traitor whose confession is the most heroic act.', descriptionDe: 'Ng\u0169g\u0129s Spitzel-Held: der Verr\u00e4ter, dessen Gest\u00e4ndnis die heldenhafteste Tat ist. Diese Aussage sch\u00fctzt, weil sie enth\u00fcllt \u2013 und Enth\u00fcllung ist R\u00fcstung.' },
    { name: 'Erased Photograph', nameDe: 'Gel\u00f6schtes Foto', tier: 2, effect: 'Memory item', description: 'Kundera\u2019s Clementis photograph. The body erased, the fur hat remaining.', descriptionDe: 'Kunderas Clementis-Foto. Der K\u00f6rper gel\u00f6scht, die Pelzm\u00fctze noch auf Gottwalds Kopf. Beweis, dass etwas war, bevor es ungemacht wurde.' },
    { name: 'Authority Fragment', nameDe: 'Autorit\u00e4tsfragment', tier: 3, effect: 'Zone security +1 tier (10 ticks)', description: 'A fragment of legitimate authority, salvaged from the Spiegelpalast.', descriptionDe: 'Ein Fragment legitimer Autorit\u00e4t, aus dem Spiegelpalast geborgen.' },
    { name: 'Colossus Splinter', nameDe: 'Koloss-Splitter', tier: 3, effect: 'All agents +15% morale (10 ticks)', description: 'La Bo\u00e9tie\u2019s proof: tyranny requires consent.', descriptionDe: 'La Bo\u00e9ties Beweis: Tyrannei braucht Zustimmung.' },
    { name: 'Mirror Shard', nameDe: 'Spiegelscherbe des Spiegelpalasts', tier: 3, effect: 'Openness +5', description: 'It still reflects \u2013 but what it reflects is no longer the room.', descriptionDe: 'Sie reflektiert noch \u2013 aber was sie reflektiert, ist nicht mehr der Raum.' },
  ],

  // ── Prose ──

  prose: {
    mechanicGainTitle: 'Fracture Gain',
    mechanicGainTitleDe: 'Frakturzuwachs',
    mechanicGainText: '+4 per room (shallow) \u2192 +10 per room (deep)\n+2 per combat round\n+5 on failed diplomacy',
    mechanicGainTextDe: '+4 pro Raum (flach) \u2192 +10 pro Raum (tief)\n+2 pro Kampfrunde\n+5 bei gescheiterter Diplomatie',
    mechanicReduceTitle: 'Fracture Reduction',
    mechanicReduceTitleDe: 'Frakturminderung',
    mechanicReduceText: '\u22125 on rest (brief respite)\n\u221210 on rally (Propagandist ability)',
    mechanicReduceTextDe: '\u22125 bei Rast (kurze Atempause)\n\u221210 bei Rallye (Propagandisten-F\u00e4higkeit)',
    mechanicReduceEmphasis: 'Violence does not restore order.',
    mechanicReduceEmphasisDe: 'Gewalt stellt keine Ordnung wieder her.',
    encounterIntro: 'Navigate political crises. Every choice shifts the balance of power.',
    encounterIntroDe: 'Navigiert politische Krisen. Jede Entscheidung verschiebt das Machtgleichgewicht.',
    bestiaryIntro: 'The denizens of Der Spiegelpalast. Not monsters \u2013 operatives.',
    bestiaryIntroDe: 'Die Bewohner des Spiegelpalasts. Keine Monster \u2013 Funktion\u00e4re.',
    banterHeader: 'Overheard in the Spiegelpalast',
    banterHeaderDe: 'Belauscht im Spiegelpalast',
    objektankerHeader: 'Artifacts of the Spiegelpalast',
    objektankerHeaderDe: 'Artefakte des Spiegelpalasts',
    objektankerIntro: 'Objects that mutate as the dungeon descends. Each tells the story of power corrupted.',
    objektankerIntroDe: 'Objekte, die sich ver\u00e4ndern, je tiefer der Dungeon f\u00fchrt. Jedes erz\u00e4hlt die Geschichte korrumpierter Macht.',
    exitQuote: 'The old leader is gone. The new leader enters. Same room. Same desk. Same view from the window.',
    exitQuoteDe: 'Der alte Anf\u00fchrer ist weg. Der neue Anf\u00fchrer tritt ein. Derselbe Raum. Derselbe Schreibtisch. Dieselbe Aussicht.',
    exitCta: 'Enter the Spiegelpalast',
    exitCtaDe: 'Den Spiegelpalast betreten',
    exitCtaText: 'You survived the exhibition. Now survive the dungeon.',
    exitCtaTextDe: 'Ihr habt die Ausstellung \u00fcberlebt. Jetzt \u00fcberlebt den Dungeon.',
  },

  // ── Navigation ──

  prevArchetype: getNav('awakening'),
  nextArchetype: getNav('shadow'),
};

// ── The Shadow — Full Bilingual Content ───────────────────────────────────

const SHADOW_DETAIL: ArchetypeDetail = {
  ...getBaseSlide('shadow'),

  loreIntro: [
    'The Shadow is the first archetype of the Resonance Dungeons. Where other archetypes have form \u2013 political, mechanical, elemental \u2013 this one has only absence. Die Tiefe Nacht is not a place of darkness. It is a place where darkness has intent.',
    'Visibility is the currency here, and it drains. Every corridor crossed costs sight. Every room entered costs certainty. The instruments that once measured threat now measure nothing \u2013 not zero, but nothing, as if measurement itself has been consumed.',
    'At the surface, Lovecraft\u2019s suggestive terror governs: what lurks beyond the threshold of perception. By the middle depths, VanderMeer\u2019s Southern Reach has taken hold \u2013 the environment itself is the antagonist. At the bottom, only Ligotti\u2019s philosophical darkness remains: the suspicion that the darkness was always there, and it was the light that was the anomaly.',
  ],

  loreIntroDe: [
    'Der Schatten ist der erste Archetyp der Resonanz-Dungeons. Wo andere Archetypen Form besitzen \u2013 politische, mechanische, elementare \u2013 hat dieser nur Abwesenheit. Die Tiefe Nacht ist kein Ort der Dunkelheit. Sie ist ein Ort, an dem Dunkelheit Absicht hat.',
    'Sichtbarkeit ist die W\u00e4hrung hier, und sie schwindet. Jeder durchquerte Korridor kostet Sicht. Jeder betretene Raum kostet Gewissheit. Die Instrumente, die einst Bedrohung ma\u00dfen, messen jetzt nichts \u2013 nicht null, sondern nichts, als sei das Messen selbst verzehrt worden.',
    'An der Oberfl\u00e4che herrscht Lovecrafts suggestiver Schrecken: was jenseits der Wahrnehmungsschwelle lauert. In mittlerer Tiefe hat VanderMeers Southern Reach die Kontrolle \u00fcbernommen \u2013 die Umgebung selbst ist der Antagonist. Am Grund bleibt nur Ligottis philosophische Finsternis: der Verdacht, dass die Dunkelheit immer da war und das Licht die Anomalie.',
  ],

  entranceTexts: [
    'The threshold yields without resistance. Beyond it, the darkness is not empty \u2013 it is attentive. The amber glow of terminal light follows you in, then stops, as if it has reached the border of a country that does not recognize its authority.',
    'The air changes at the threshold. Not colder \u2013 denser. Sound travels differently here. Your footsteps return to you a half-second late, as if the corridors are repeating what you said to see if they agree.',
    'The descent begins. The last light does not fade \u2013 it is consumed, methodically, frequency by frequency. Red goes first. Then yellow. Blue persists longest, a thin vein of visibility that the darkness has not yet bothered to close.',
    'Silence. Not the silence of emptiness \u2013 the silence of something listening. The simulation\u2019s ambient hum, present everywhere else, stops at this threshold as if it has been told to wait outside.',
    'A gap in the architecture. The corridor opens into a space that your instruments insist is small but your senses know is vast. The darkness here has weight. It presses against the skin like water at depth.',
  ],

  entranceTextsDe: [
    'Die Schwelle gibt ohne Widerstand nach. Dahinter ist die Dunkelheit nicht leer \u2013 sie ist aufmerksam. Das Bernsteingl\u00fchen des Terminallichts folgt euch hinein, dann stoppt es, als h\u00e4tte es die Grenze eines Landes erreicht, das seine Autorit\u00e4t nicht anerkennt.',
    'Die Luft ver\u00e4ndert sich an der Schwelle. Nicht k\u00e4lter \u2013 dichter. Schall bewegt sich hier anders. Eure Schritte kehren eine halbe Sekunde versp\u00e4tet zur\u00fcck, als wiederholten die Korridore, was ihr gesagt habt, um zu pr\u00fcfen, ob sie zustimmen.',
    'Der Abstieg beginnt. Das letzte Licht verblasst nicht \u2013 es wird verzehrt, methodisch, Frequenz f\u00fcr Frequenz. Rot geht zuerst. Dann Gelb. Blau h\u00e4lt am l\u00e4ngsten, eine d\u00fcnne Ader der Sichtbarkeit, die die Dunkelheit noch nicht zu schlie\u00dfen sich bem\u00fcht hat.',
    'Stille. Nicht die Stille der Leere \u2013 die Stille von etwas, das lauscht. Das Grundrauschen der Simulation, \u00fcberall sonst pr\u00e4sent, endet an dieser Schwelle, als sei ihm gesagt worden, drau\u00dfen zu warten.',
    'Eine L\u00fccke in der Architektur. Der Korridor \u00f6ffnet sich in einen Raum, den eure Instrumente als klein bezeichnen, den eure Sinne aber als gewaltig erkennen. Die Dunkelheit hier hat Gewicht. Sie dr\u00fcckt gegen die Haut wie Wasser in der Tiefe.',
  ],

  mechanicName: 'Dissolution',
  mechanicNameDe: 'Aufl\u00f6sung',
  mechanicDescription:
    'Die Tiefe Nacht\u2019s unique resonance mechanic. Visibility drains as you descend \u2013 every two rooms consume one point of sight. At zero, blind mode: 40% ambush chance, +25% stress damage, but +50% loot as reward for courage in the dark.',
  mechanicDescriptionDe:
    'Die einzigartige Resonanzmechanik der Tiefen Nacht. Sichtbarkeit schwindet beim Abstieg \u2013 alle zwei R\u00e4ume wird ein Punkt Sicht verzehrt. Bei null: Blindmodus \u2013 40% Hinterhaltchance, +25% Stressschaden, aber +50% Beute als Belohnung f\u00fcr Mut im Dunkeln.',

  mechanicGauge: {
    name: 'Visibility',
    nameDe: 'Sichtbarkeit',
    start: 3,
    max: 3,
    direction: 'drain',
    thresholds: [
      { value: 3, label: 'Clear Sight', labelDe: 'Klare Sicht', description: 'Full visibility. The instruments still work.', descriptionDe: 'Volle Sichtbarkeit. Die Instrumente funktionieren noch.' },
      { value: 2, label: 'Dimming', labelDe: 'Verdunkelung', description: 'Edges blur. Ambient sounds lose direction.', descriptionDe: 'R\u00e4nder verschwimmen. Umgebungsger\u00e4usche verlieren ihre Richtung.' },
      { value: 1, label: 'Flickering', labelDe: 'Flackern', description: 'Critical. Instruments unreliable. Trust nothing.', descriptionDe: 'Kritisch. Instrumente unzuverl\u00e4ssig. Nichts vertrauen.' },
      { value: 0, label: 'Blind', labelDe: 'Blind', description: '40% ambush. +25% stress. +50% loot. The darkness consumes.', descriptionDe: '40% Hinterhalt. +25% Stress. +50% Beute. Die Dunkelheit verzehrt.' },
    ],
  },

  aptitudeWeights: {
    Spy: 30,
    Guardian: 20,
    Assassin: 20,
    Infiltrator: 15,
    Saboteur: 10,
    Propagandist: 5,
  },

  roomDistribution: {
    Combat: 40,
    Encounter: 30,
    Treasure: 15,
    Rest: 5,
    Elite: 5,
    Exit: 5,
  },

  mechanicGaugePreviewValue: 1,

  // ── Bestiary ──

  enemies: [
    {
      name: 'Shadow Wisp',
      nameDe: 'Schattenglimmer',
      tier: 'minion',
      power: 2,
      stress: 4,
      evasion: 40,
      ability: 'Erode',
      abilityDe: 'Zersetzen',
      aptitude: 'Infiltrator',
      description: 'A flickering presence at the edge of perception. It doesn\u2019t attack the body \u2013 it erodes certainty. You feel it before you see it: a chill that starts behind the eyes.',
      descriptionDe: 'Eine flackernde Pr\u00e4senz am Rand der Wahrnehmung. Sie greift nicht den K\u00f6rper an \u2013 sie zersetzt Gewissheit. Ihr sp\u00fcrt es, bevor ihr es seht: eine K\u00e4lte, die hinter den Augen beginnt.',
    },
    {
      name: 'Shadow Tendril',
      nameDe: 'Schattenfaden',
      tier: 'minion',
      power: 4,
      stress: 1,
      evasion: 10,
      ability: 'Grapple',
      abilityDe: 'Greifen',
      aptitude: 'Guardian',
      description: 'A black appendage reaching from the walls. Patient. Methodical. It extends, probing. It knows you\u2019re there.',
      descriptionDe: 'Ein schwarzer Fortsatz, der aus den W\u00e4nden greift. Geduldig. Methodisch. Er streckt sich, tastet. Er wei\u00df, dass ihr da seid.',
    },
    {
      name: 'Echo of Violence',
      nameDe: 'Gewaltecho',
      tier: 'standard',
      power: 6,
      stress: 3,
      evasion: 20,
      ability: 'Ambush',
      abilityDe: 'Hinterhalt',
      aptitude: 'Assassin',
      description: 'A replay of violence that once scarred this place. It moves with the precision of memory \u2013 every strike has happened before.',
      descriptionDe: 'Eine Wiederholung von Gewalt, die diesen Ort einst gezeichnet hat. Sie bewegt sich mit der Pr\u00e4zision der Erinnerung \u2013 jeder Schlag ist schon geschehen.',
    },
    {
      name: 'Paranoia Shade',
      nameDe: 'Paranoiaschatten',
      tier: 'standard',
      power: 2,
      stress: 6,
      evasion: 30,
      ability: 'Disinformation',
      abilityDe: 'Desinformation',
      aptitude: 'Propagandist',
      description: 'It whispers. Not lies, exactly \u2013 plausible fears. Things your agents already suspect about each other.',
      descriptionDe: 'Es fl\u00fcstert. Nicht L\u00fcgen, genau genommen \u2013 plausible \u00c4ngste. Dinge, die eure Agenten bereits voneinander vermuten.',
    },
    {
      name: 'The Remnant',
      nameDe: 'Der \u00dcberrest',
      tier: 'boss',
      power: 8,
      stress: 7,
      evasion: 25,
      ability: 'Summon \u00b7 Fear',
      abilityDe: 'Beschw\u00f6ren \u00b7 Furcht',
      aptitude: 'Assassin',
      description: 'Formed from the simulation\u2019s strongest unresolved conflict. It remembers what your agents have tried to forget. Wisps orbit it like satellites, pulsing in unison.',
      descriptionDe: 'Geformt aus dem st\u00e4rksten ungel\u00f6sten Konflikt der Simulation. Er erinnert sich an das, was eure Agenten zu vergessen versucht haben. Glimmer umkreisen ihn wie Satelliten, pulsierend im Gleichklang.',
    },
  ],

  // ── Encounters ──

  encounterPreviews: [
    {
      name: 'The Threshold',
      nameDe: 'Die Schwelle',
      depth: '1\u20132',
      type: 'narrative',
      description: 'A line of absolute dark cuts the floor like a border crossing. Everything on this side is dim; everything beyond is blind. The scratches on the walls are not random.',
      descriptionDe: 'Eine Linie absoluter Dunkelheit schneidet den Boden wie ein Grenz\u00fcbergang. Diesseits ist es d\u00e4mmerig; jenseits ist es blind. Die Kratzer an den W\u00e4nden sind nicht zuf\u00e4llig.',
      choices: [
        { text: 'Investigate the scratches', textDe: 'Die Kratzer untersuchen', aptitude: 'Spy', difficulty: '\u22125' },
        { text: 'Secure the perimeter', textDe: 'Den Perimeter sichern', aptitude: 'Guardian', difficulty: '0' },
        { text: 'Cross cautiously', textDe: 'Vorsichtig \u00fcberqueren' },
      ],
    },
    {
      name: 'The Prisoner',
      nameDe: 'Der Gefangene',
      depth: '2\u20133',
      type: 'narrative',
      description: 'A cage of solidified shadow. Inside, something that was once human curls in on itself. \u201cPlease,\u201d it says. \u201cI\u2019ve been here since the last resonance. I remember sunlight.\u201d',
      descriptionDe: 'Ein K\u00e4fig aus verfestigtem Schatten. Darin kauert etwas, das einmal menschlich war. \u00bbBitte\u00ab, sagt es. \u00bbIch bin hier seit der letzten Resonanz. Ich erinnere mich an Sonnenlicht.\u00ab',
      choices: [
        { text: 'Free the prisoner', textDe: 'Den Gefangenen befreien', aptitude: 'Guardian', difficulty: '0' },
        { text: 'Interrogate for information', textDe: 'Nach Informationen befragen', aptitude: 'Spy', difficulty: '\u22125' },
        { text: 'Leave them', textDe: 'Weitergehen' },
      ],
    },
    {
      name: 'The Mirror Room',
      nameDe: 'Der Spiegelraum',
      depth: '2\u20134',
      type: 'narrative',
      description: 'The walls are mirrors \u2013 but wrong. Each agent sees themselves distorted, features exaggerated into something they fear they truly are. The reflections move independently.',
      descriptionDe: 'Die W\u00e4nde sind Spiegel \u2013 aber falsch. Jeder Agent sieht sich selbst verzerrt, Z\u00fcge \u00fcbertrieben zu etwas, von dem sie f\u00fcrchten, es wirklich zu sein. Die Spiegelbilder bewegen sich unabh\u00e4ngig.',
      choices: [
        { text: 'Confront the reflection', textDe: 'Das Spiegelbild konfrontieren', aptitude: 'Propagandist', difficulty: '+5' },
        { text: 'Analyze the mirrors', textDe: 'Die Spiegel analysieren', aptitude: 'Spy', difficulty: '0' },
        { text: 'Smash the mirrors', textDe: 'Die Spiegel zerschlagen' },
      ],
    },
    {
      name: 'The Convergence',
      nameDe: 'Die Konvergenz',
      depth: '4\u20135',
      type: 'narrative',
      description: 'The corridors converge here \u2013 not architecturally, but ontologically. Shadows from earlier rooms pool on the floor like spilled ink, forming a map of everywhere you have been.',
      descriptionDe: 'Die Korridore konvergieren hier \u2013 nicht architektonisch, sondern ontologisch. Schatten fr\u00fcherer R\u00e4ume sammeln sich auf dem Boden wie versch\u00fcttete Tinte und bilden eine Karte \u00fcberall, wo ihr gewesen seid.',
      choices: [
        { text: 'Read the shadow map', textDe: 'Die Schattenkarte lesen', aptitude: 'Spy', difficulty: '+10' },
        { text: 'Strike the convergence node', textDe: 'Den Konvergenzknoten angreifen', aptitude: 'Assassin', difficulty: '+10' },
        { text: 'Navigate without engaging', textDe: 'Hindurchgehen ohne Interaktion' },
      ],
    },
    {
      name: 'The Haunting',
      nameDe: 'Die Heimsuchung',
      depth: '3\u20134',
      type: 'combat',
      description: 'The whispers become specific \u2013 names, fears, secrets your agents thought were private. A paranoia shade drifts at the center, flanked by wisps whose movements no longer match their telegraphed intents.',
      descriptionDe: 'Das Fl\u00fcstern wird spezifisch \u2013 Namen, \u00c4ngste, Geheimnisse, die eure Agenten f\u00fcr privat hielten. Ein Paranoiaschatten treibt im Zentrum, flankiert von Glimmern, deren Bewegungen nicht mehr zu ihren angezeigten Absichten passen.',
    },
  ],

  // ── Banter Samples ──

  banterSamples: [
    { text: 'The darkness is thicker here. Absolute. Intentional.', textDe: 'Die Dunkelheit ist dichter hier. Absolut. Absichtlich.', tier: 0 },
    { text: 'Something moved. Not in the corridor \u2013 in the space between seeing and understanding.', textDe: 'Etwas hat sich bewegt. Nicht im Korridor \u2013 im Raum zwischen Sehen und Verstehen.', tier: 0 },
    { text: 'The instruments read nothing. Not zero \u2013 nothing. As if measurement itself has been consumed.', textDe: 'Die Instrumente zeigen nichts an. Nicht null \u2013 nichts. Als sei das Messen selbst verzehrt worden.', tier: 1 },
    { text: 'The corridors converge here \u2013 not architecturally, but ontologically.', textDe: 'Die Korridore konvergieren hier \u2013 nicht architektonisch, sondern ontologisch.', tier: 1 },
    { text: 'The shadows move. Not with you. Not against you. Around you. Testing.', textDe: 'Die Schatten bewegen sich. Nicht mit euch. Nicht gegen euch. Um euch herum. Testend.', tier: 1 },
    { text: 'The air changes. The whispers stop. In the silence that follows, something enormous draws breath.', textDe: 'Die Luft ver\u00e4ndert sich. Das Fl\u00fcstern h\u00f6rt auf. In der Stille, die folgt, holt etwas Gewaltiges Atem.', tier: 2 },
    { text: 'The darkness lets you leave. That\u2019s the most unsettling part.', textDe: 'Die Dunkelheit l\u00e4sst euch gehen. Das ist der verst\u00f6rendste Teil.', tier: 2 },
    { text: 'Light returns. The memory of dark does not diminish. Something fundamental has shifted in how they perceive the simulation.', textDe: 'Licht kehrt zur\u00fcck. Die Erinnerung an die Dunkelheit verblasst nicht. Etwas Grundlegendes hat sich verschoben in der Art, wie sie die Simulation wahrnehmen.', tier: 3 },
  ],

  // ── Literary DNA ──

  authors: [
    { name: 'H.P. Lovecraft', works: 'The Colour Out of Space \u00b7 The Shadow over Innsmouth', concept: 'Cosmic horror as suggestion. The threat is never fully revealed \u2013 what the mind supplies is worse than any description.', conceptDe: 'Kosmischer Horror als Andeutung. Die Bedrohung wird nie vollst\u00e4ndig enth\u00fcllt \u2013 was der Verstand erg\u00e4nzt, ist schlimmer als jede Beschreibung.', language: 'English', quote: 'The oldest and strongest emotion of mankind is fear, and the oldest and strongest kind of fear is fear of the unknown.', primary: true },
    { name: 'Jeff VanderMeer', works: 'Annihilation \u00b7 Authority', concept: 'Environment as antagonist. Area X does not attack \u2013 it transforms. The landscape rewrites those who enter it.', conceptDe: 'Umgebung als Antagonist. Area X greift nicht an \u2013 sie transformiert. Die Landschaft \u00fcberschreibt jene, die sie betreten.', language: 'English', quote: 'The beauty of it cannot be understood, either, and when you see beauty in desolation it changes something inside you.', primary: true },
    { name: 'Shirley Jackson', works: 'The Haunting of Hill House', concept: 'Architecture of dread. The house is not haunted \u2013 the house is wrong. Angles that should not exist. Doors that close by themselves.', conceptDe: 'Architektur des Grauens. Das Haus ist nicht heimgesucht \u2013 das Haus ist falsch. Winkel, die nicht existieren sollten. T\u00fcren, die sich von selbst schlie\u00dfen.', language: 'English', quote: 'No live organism can continue for long to exist sanely under conditions of absolute reality.', primary: true },
    { name: 'Thomas Ligotti', works: 'Songs of a Dead Dreamer \u00b7 The Conspiracy Against the Human Race', concept: 'Philosophical pessimism. Horror is not what happens to you \u2013 horror is the nature of consciousness itself.', conceptDe: 'Philosophischer Pessimismus. Horror ist nicht, was einem widerf\u00e4hrt \u2013 Horror ist das Wesen des Bewusstseins selbst.', language: 'English', primary: false },
    { name: 'Edgar Allan Poe', works: 'The Fall of the House of Usher \u00b7 The Pit and the Pendulum', concept: 'Descent and confinement. Short sentences that compress dread. Rhythm as weapon \u2013 the heartbeat beneath the floorboards.', conceptDe: 'Abstieg und Eingesperrtsein. Kurze S\u00e4tze, die Grauen verdichten. Rhythmus als Waffe \u2013 der Herzschlag unter den Dielen.', language: 'English', primary: false },
    { name: 'Algernon Blackwood', works: 'The Willows \u00b7 The Wendigo', concept: 'Nature as alien intelligence. The wilderness is not indifferent \u2013 it is aware, and its awareness is incompatible with human sanity.', conceptDe: 'Natur als fremde Intelligenz. Die Wildnis ist nicht gleichg\u00fcltig \u2013 sie ist bewusst, und ihr Bewusstsein ist unvereinbar mit menschlicher Vernunft.', language: 'English', primary: false },
  ],

  // ── Objektanker (Migration 181 canonical text) ──

  objektanker: [
    {
      name: 'The Note',
      nameDe: 'Die Notiz',
      phases: [
        { label: 'Discovery', labelDe: 'Entdeckung', text: 'A note, folded once, pressed into a crack in the wall. \u201cVisibility is not sight. It is permission.\u201d', textDe: 'Eine Notiz, einmal gefaltet, in einen Riss in der Wand gedr\u00fcckt. \u00bbSichtbarkeit ist nicht Sehen. Es ist Erlaubnis.\u00ab' },
        { label: 'Echo', labelDe: 'Echo', text: 'Another note. Same handwriting, deteriorated. \u201cThe instruments lied. Not about the readings \u2013 about the existence of things to read.\u201d', textDe: 'Eine weitere Notiz. Dieselbe Handschrift, verschlechtert. \u00bbDie Instrumente haben gelogen. Nicht \u00fcber die Messwerte \u2013 \u00fcber die Existenz messbarer Dinge.\u00ab' },
        { label: 'Mutation', labelDe: 'Mutation', text: 'Notes everywhere. The handwriting is barely legible. \u201cIt does not consume light. It consumes the concept of illumination.\u201d', textDe: '\u00dcberall Notizen. Die Handschrift ist kaum lesbar. \u00bbEs verzehrt nicht das Licht. Es verzehrt den Begriff der Beleuchtung.\u00ab' },
        { label: 'Climax', labelDe: 'Klimax', text: 'On the floor: a pen. Still warm. The ink is the same as the notes. Whoever wrote them did not leave this room.', textDe: 'Auf dem Boden: ein Stift. Noch warm. Die Tinte ist dieselbe wie bei den Notizen. Wer sie geschrieben hat, hat diesen Raum nicht verlassen.' },
      ],
    },
    {
      name: 'The Mirror',
      nameDe: 'Der Spiegel',
      phases: [
        { label: 'Discovery', labelDe: 'Entdeckung', text: 'A mirror, face-down on the floor. The frame is ornate. Something about the angle suggests it was placed, not dropped.', textDe: 'Ein Spiegel, mit der Fl\u00e4che nach unten auf dem Boden. Der Rahmen ist verziert. Etwas am Winkel suggeriert, dass er gelegt, nicht fallen gelassen wurde.' },
        { label: 'Echo', labelDe: 'Echo', text: 'More mirrors. All face-down. All facing away from the corridor\u2019s center. They are avoiding something.', textDe: 'Mehr Spiegel. Alle mit der Fl\u00e4che nach unten. Alle vom Zentrum des Korridors abgewandt. Sie meiden etwas.' },
        { label: 'Mutation', labelDe: 'Mutation', text: 'One mirror, facing outward. It does not show the room. It shows an empty corridor, watched by someone standing where you are.', textDe: 'Ein Spiegel, nach au\u00dfen gerichtet. Er zeigt nicht den Raum. Er zeigt einen leeren Korridor, beobachtet von jemandem, der dort steht, wo ihr steht.' },
        { label: 'Climax', labelDe: 'Klimax', text: 'The mirror shows the first room. Your party entering. Seen from behind something that has been watching since the beginning.', textDe: 'Der Spiegel zeigt den ersten Raum. Eure Gruppe beim Eintreten. Gesehen von hinter etwas, das seit dem Anfang zuschaut.' },
      ],
    },
    {
      name: 'The Candle',
      nameDe: 'Die Kerze',
      phases: [
        { label: 'Discovery', labelDe: 'Entdeckung', text: 'A candle. Lit. The flame points inward \u2013 toward the dungeon\u2019s core, not upward. It illuminates nothing.', textDe: 'Eine Kerze. Brennend. Die Flamme zeigt nach innen \u2013 zum Kern des Dungeons, nicht nach oben. Sie beleuchtet nichts.' },
        { label: 'Echo', labelDe: 'Echo', text: 'Seven candles. Each flame points in a different direction. None upward. The light they cast has no source point.', textDe: 'Sieben Kerzen. Jede Flamme zeigt in eine andere Richtung. Keine nach oben. Das Licht, das sie werfen, hat keinen Quellpunkt.' },
        { label: 'Mutation', labelDe: 'Mutation', text: 'The candles burn black. Not dark \u2013 black fire, emitting the opposite of light. Areas near the flames are darker than areas far away.', textDe: 'Die Kerzen brennen schwarz. Nicht dunkel \u2013 schwarzes Feuer, das das Gegenteil von Licht ausstrahlt. Bereiche nahe der Flammen sind dunkler als Bereiche weit entfernt.' },
        { label: 'Climax', labelDe: 'Klimax', text: 'One candle. Its flame is your silhouette. It has been burning you this entire time \u2013 not consuming, memorizing.', textDe: 'Eine Kerze. Ihre Flamme ist eure Silhouette. Sie hat euch die ganze Zeit verbrannt \u2013 nicht verzehrend, memorierend.' },
      ],
    },
    {
      name: 'The Door',
      nameDe: 'Die T\u00fcr',
      phases: [
        { label: 'Discovery', labelDe: 'Entdeckung', text: 'A door. Locked. It leads to a solid wall \u2013 the door has no function. There is no keyhole.', textDe: 'Eine T\u00fcr. Verschlossen. Sie f\u00fchrt zu einer massiven Wand \u2013 die T\u00fcr hat keine Funktion. Es gibt kein Schl\u00fcsselloch.' },
        { label: 'Echo', labelDe: 'Echo', text: 'A door. Identical. Knocking comes from the other side. The knocking matches your party\u2019s heartbeat.', textDe: 'Eine T\u00fcr. Identisch. Klopfen kommt von der anderen Seite. Das Klopfen passt zum Herzschlag eurer Gruppe.' },
        { label: 'Mutation', labelDe: 'Mutation', text: 'Doors everywhere. All identical. All knocking. The rhythm is synchronized \u2013 one beat, everywhere, at once.', textDe: '\u00dcberall T\u00fcren. Alle identisch. Alle klopfend. Der Rhythmus ist synchronisiert \u2013 ein Schlag, \u00fcberall, gleichzeitig.' },
        { label: 'Climax', labelDe: 'Klimax', text: 'One door. Open. Beyond it: this room. Your party. Seen from behind. The door was never locked from this side.', textDe: 'Eine T\u00fcr. Offen. Dahinter: dieser Raum. Eure Gruppe. Von hinten gesehen. Die T\u00fcr war nie von dieser Seite verschlossen.' },
      ],
    },
  ],

  // ── Loot ──

  lootShowcase: [
    { name: 'Shadow Residue', nameDe: 'Schattenr\u00fcckstand', tier: 1, effect: 'Stress heal 50', description: 'Crystallized shadow. Absorbs stress when handled carefully. The darkness gave this willingly \u2013 which is the concerning part.', descriptionDe: 'Kristallisierter Schatten. Absorbiert Stress bei vorsichtiger Handhabung. Die Dunkelheit gab dies bereitwillig \u2013 was der beunruhigende Teil ist.' },
    { name: 'Dark Insight', nameDe: 'Dunkle Einsicht', tier: 1, effect: 'Memory (importance 4)', description: 'A fragment of understanding gained in the dark. Not knowledge \u2013 recognition. The difference matters here.', descriptionDe: 'Ein Fragment von Verst\u00e4ndnis, gewonnen im Dunkeln. Nicht Wissen \u2013 Erkennen. Der Unterschied z\u00e4hlt hier.' },
    { name: 'Shadow Attunement Shard', nameDe: 'Schattenabstimmungssplitter', tier: 2, effect: 'Permanent moodlet: shadow_attuned', description: 'Drawn to darkness. Stimulation need decays faster. The agent no longer fears the dark \u2013 they find it comfortable. This should worry you.', descriptionDe: 'Zur Dunkelheit hingezogen. Stimulationsbed\u00fcrfnis sinkt schneller. Der Agent f\u00fcrchtet die Dunkelheit nicht mehr \u2013 er findet sie behaglich. Das sollte euch beunruhigen.' },
    { name: 'Darkened Lens', nameDe: 'Verdunkelte Linse', tier: 2, effect: 'Permanent +1 Spy in Shadow dungeons', description: 'Permanent: +1 Spy aptitude in ALL future Shadow dungeons. The lens does not improve sight. It teaches a different kind of seeing.', descriptionDe: 'Permanent: +1 Spion-Eignung in ALLEN zuk\u00fcnftigen Schatten-Dungeons. Die Linse verbessert nicht das Sehen. Sie lehrt eine andere Art zu schauen.' },
    { name: 'Shadow Attunement', nameDe: 'Schattenabstimmung', tier: 3, effect: '+1 Spy or Assassin (permanent, cap +2)', description: 'Permanent: one agent gains +1 Spy OR Assassin aptitude. The shadow does not give \u2013 it reveals what was already there.', descriptionDe: 'Permanent: ein Agent erh\u00e4lt +1 Spion ODER Assassinen-Eignung. Der Schatten gibt nicht \u2013 er enth\u00fcllt, was bereits da war.' },
    { name: 'Shadow Memory', nameDe: 'Schattenerinnerung', tier: 3, effect: 'High-importance memory + behavior', description: 'Confronted the darkness and prevailed. The experience fundamentally altered how they perceive threat and fear.', descriptionDe: 'Der Dunkelheit gegen\u00fcbergetreten und bestanden. Die Erfahrung hat grunds\u00e4tzlich ver\u00e4ndert, wie sie Bedrohung und Furcht wahrnehmen.' },
  ],

  // ── Prose ──

  prose: {
    mechanicGainTitle: 'Visibility Drain',
    mechanicGainTitleDe: 'Sichtbarkeitsverlust',
    mechanicGainText: '\u22121 every 2 rooms\n\u22121 on ambush\nBlind at 0: +40% ambush, +25% stress, +50% loot',
    mechanicGainTextDe: '\u22121 alle 2 R\u00e4ume\n\u22121 bei Hinterhalt\nBlind bei 0: +40% Hinterhalt, +25% Stress, +50% Beute',
    mechanicReduceTitle: 'Visibility Restore',
    mechanicReduceTitleDe: 'Sichtbarkeitswiederherstellung',
    mechanicReduceText: '+1 on rest (if not blind)\n+1 on Spy check (DC 10)',
    mechanicReduceTextDe: '+1 bei Rast (wenn nicht blind)\n+1 bei Spion-Probe (SG 10)',
    mechanicReduceEmphasis: 'The darkness does not negotiate.',
    mechanicReduceEmphasisDe: 'Die Dunkelheit verhandelt nicht.',
    encounterIntro: 'Navigate the darkness. Every choice costs visibility.',
    encounterIntroDe: 'Navigiert die Dunkelheit. Jede Entscheidung kostet Sichtbarkeit.',
    bestiaryIntro: 'The denizens of Die Tiefe Nacht. Not creatures \u2013 manifestations.',
    bestiaryIntroDe: 'Die Bewohner der Tiefen Nacht. Keine Kreaturen \u2013 Manifestationen.',
    banterHeader: 'Overheard in the Darkness',
    banterHeaderDe: 'Belauscht in der Dunkelheit',
    objektankerHeader: 'Artifacts of Die Tiefe Nacht',
    objektankerHeaderDe: 'Artefakte der Tiefen Nacht',
    objektankerIntro: 'Objects that dissolve as visibility drains. Each remembers what you have forgotten.',
    objektankerIntroDe: 'Objekte, die sich aufl\u00f6sen, w\u00e4hrend die Sichtbarkeit schwindet. Jedes erinnert, was ihr vergessen habt.',
    exitQuote: 'The darkness lets you leave. That\u2019s the most unsettling part.',
    exitQuoteDe: 'Die Dunkelheit l\u00e4sst euch gehen. Das ist der verst\u00f6rendste Teil.',
    exitCta: 'Enter Die Tiefe Nacht',
    exitCtaDe: 'Die Tiefe Nacht betreten',
    exitCtaText: 'You survived the exhibition. Now survive the dungeon.',
    exitCtaTextDe: 'Ihr habt die Ausstellung \u00fcberlebt. Jetzt \u00fcberlebt den Dungeon.',
  },

  // ── Navigation ──

  prevArchetype: getNav('overthrow'),
  nextArchetype: getNav('tower'),
};

// ── The Tower — Full Bilingual Content ────────────────────────────────────────

const TOWER_DETAIL: ArchetypeDetail = {
  ...getBaseSlide('tower'),

  loreIntro: [
    'The Tower is the second archetype of the Resonance Dungeons. Where the Shadow threatens perception, Der Fallende Turm threatens structure itself. Not a ruin \u2013 a building in the act of discovering it was always temporary. The architecture is reasonable at the entrance. It will not stay reasonable.',
    'Stability is the currency here, and it drains. Every floor climbed costs structural integrity. Every room entered tests the load-bearing consensus between gravity and ambition. The instruments that once measured safety now measure proximity to collapse \u2013 not failure, but the precise mathematics of structures that were never designed to hold this much weight.',
    'At the surface, Kafka\u2019s bureaucratic uncanny governs: the building processes you while you process it. By the middle floors, Danielewski\u2019s House of Leaves has taken hold \u2013 more space inside than physics allows, corridors that loop back to rooms that weren\u2019t there before. At the summit, only Ballard\u2019s vision remains: the high-rise as vertical society, collapsing not from external force but from the weight of its own aspirations.',
  ],

  loreIntroDe: [
    'Der Turm ist der zweite Archetyp der Resonanz-Dungeons. Wo der Schatten die Wahrnehmung bedroht, bedroht Der Fallende Turm die Struktur selbst. Keine Ruine \u2013 ein Geb\u00e4ude im Moment der Erkenntnis, dass es immer tempor\u00e4r war. Die Architektur ist am Eingang vern\u00fcnftig. Sie wird nicht vern\u00fcnftig bleiben.',
    'Stabilit\u00e4t ist die W\u00e4hrung hier, und sie schwindet. Jedes erklommene Stockwerk kostet strukturelle Integrit\u00e4t. Jeder betretene Raum testet den tragenden Konsens zwischen Schwerkraft und Ehrgeiz. Die Instrumente, die einst Sicherheit ma\u00dfen, messen jetzt die N\u00e4he zum Einsturz \u2013 nicht Versagen, sondern die pr\u00e4zise Mathematik von Strukturen, die nie daf\u00fcr gebaut waren, so viel Gewicht zu tragen.',
    'An der Oberfl\u00e4che herrscht Kafkas b\u00fcrokratisches Unheimliches: das Geb\u00e4ude verarbeitet euch, w\u00e4hrend ihr es verarbeitet. In den mittleren Stockwerken hat Danielewskis House of Leaves die Kontrolle \u00fcbernommen \u2013 mehr Raum innen als die Physik erlaubt, Korridore, die zu R\u00e4umen zur\u00fcckf\u00fchren, die vorher nicht da waren. Am Gipfel bleibt nur Ballards Vision: das Hochhaus als vertikale Gesellschaft, die nicht durch \u00e4u\u00dfere Kraft einst\u00fcrzt, sondern unter dem Gewicht ihrer eigenen Ambitionen.',
  ],

  entranceTexts: [
    'The lobby is pristine. Too pristine. The reception desk is unmanned, the ledger open to today\u2019s date. Someone has been expected. The elevator indicators read floors that should not exist.',
    'The revolving door deposits you into a foyer that smells of floor wax and compounding interest. A clock on the wall runs backward. The building does not acknowledge this as unusual.',
    'Ground floor. The architecture is reasonable here \u2013 load-bearing walls where they should be, exits where regulation demands them. This will not last. The building is only polite on the ground floor.',
    'A placard by the entrance reads: \u2018This building has been inspected and found structurally sound.\u2019 The date has been scratched out. The inspector\u2019s name has been replaced with a floor number.',
    'The foundation hums. A low, structural vibration that travels upward through the soles. Not mechanical. Organic. The building is aware that you have entered. It adjusts.',
  ],

  entranceTextsDe: [
    'Die Lobby ist makellos. Zu makellos. Der Empfangstresen ist unbesetzt, das Hauptbuch auf dem heutigen Datum aufgeschlagen. Jemand wurde erwartet. Die Fahrstuhlanzeigen zeigen Stockwerke, die nicht existieren sollten.',
    'Die Dreht\u00fcr setzt euch in einem Foyer ab, das nach Bodenwachs und Zinseszins riecht. Eine Uhr an der Wand l\u00e4uft r\u00fcckw\u00e4rts. Das Geb\u00e4ude erkennt daran nichts Ungew\u00f6hnliches.',
    'Erdgeschoss. Die Architektur ist hier vern\u00fcnftig \u2013 Tragw\u00e4nde, wo sie sein sollten, Ausg\u00e4nge, wo die Vorschrift sie verlangt. Das wird nicht anhalten. Das Geb\u00e4ude ist nur im Erdgeschoss h\u00f6flich.',
    'Ein Schild am Eingang lautet: \u00bbDieses Geb\u00e4ude wurde gepr\u00fcft und f\u00fcr strukturell einwandfrei befunden.\u00ab Das Datum wurde ausgekratzt. Der Name des Pr\u00fcfers durch eine Stockwerknummer ersetzt.',
    'Das Fundament brummt. Eine tiefe, strukturelle Vibration, die durch die Sohlen nach oben wandert. Nicht mechanisch. Organisch. Das Geb\u00e4ude wei\u00df, dass ihr eingetreten seid. Es passt sich an.',
  ],

  // ── Mechanic ──

  mechanicName: 'Stability Countdown',
  mechanicNameDe: 'Stabilit\u00e4ts-Countdown',
  mechanicDescription:
    'Der Fallende Turm\u2019s unique resonance mechanic. Structural integrity drains as you ascend \u2013 faster on higher floors, compounded by combat and failed checks. At zero, structural collapse: 50% ambush chance, \u00d72.0 stress, and the building stops pretending it was built to last.',
  mechanicDescriptionDe:
    'Die einzigartige Resonanzmechanik des Fallenden Turms. Strukturelle Integrit\u00e4t schwindet beim Aufstieg \u2013 schneller in h\u00f6heren Stockwerken, verst\u00e4rkt durch Kampf und fehlgeschlagene Proben. Bei null: Strukturkollaps \u2013 50% Hinterhaltchance, \u00d72,0 Stress, und das Geb\u00e4ude h\u00f6rt auf, so zu tun, als w\u00e4re es auf Dauer gebaut.',

  mechanicGauge: {
    name: 'Stability',
    nameDe: 'Stabilit\u00e4t',
    start: 100,
    max: 100,
    direction: 'drain',
    thresholds: [
      { value: 100, label: 'Structurally Sound', labelDe: 'Strukturell einwandfrei', description: 'Full stability. The building cooperates.', descriptionDe: 'Volle Stabilit\u00e4t. Das Geb\u00e4ude kooperiert.' },
      { value: 70, label: 'Hairline Cracks', labelDe: 'Haarrisse', description: 'Cosmetic damage. The building compensates.', descriptionDe: 'Kosmetische Sch\u00e4den. Das Geb\u00e4ude kompensiert.' },
      { value: 40, label: 'Structural Stress', labelDe: 'Struktureller Stress', description: 'Stress \u00d71.20. 25% ambush. The building negotiates.', descriptionDe: 'Stress \u00d71,20. 25% Hinterhalt. Das Geb\u00e4ude verhandelt.' },
      { value: 20, label: 'Critical', labelDe: 'Kritisch', description: 'Stress \u00d71.50. 50% ambush. Load-bearing walls failing.', descriptionDe: 'Stress \u00d71,50. 50% Hinterhalt. Tragw\u00e4nde versagen.' },
      { value: 0, label: 'Collapse', labelDe: 'Einsturz', description: 'Stress \u00d72.0. Total structural failure. The building stops pretending.', descriptionDe: 'Stress \u00d72,0. Totales Strukturversagen. Das Geb\u00e4ude h\u00f6rt auf, so zu tun als ob.' },
    ],
  },

  mechanicGaugePreviewValue: 35,

  aptitudeWeights: {
    Guardian: 30,
    Spy: 20,
    Saboteur: 20,
    Propagandist: 12,
    Infiltrator: 10,
    Assassin: 8,
  },

  roomDistribution: {
    Combat: 40,
    Encounter: 25,
    Elite: 5,
    Rest: 10,
    Treasure: 10,
    Exit: 10,
  },

  // ── Enemies ──

  enemies: [
    {
      name: 'Tremor Broker',
      nameDe: 'Bebenmakler',
      tier: 'minion',
      power: 1,
      stress: 5,
      evasion: 30,
      ability: 'Recite',
      abilityDe: 'Rezitieren',
      aptitude: 'Propagandist',
      description: 'A nervous figure wreathed in scrolling numbers. It doesn\u2019t fight \u2013 it recites. Market figures, compound rates, the precise mathematics of structures that can\u2019t hold.',
      descriptionDe: 'Eine nerv\u00f6se Gestalt, umweht von laufenden Zahlen. Sie k\u00e4mpft nicht \u2013 sie rezitiert. Marktkurse, Zinseszinsen, die pr\u00e4zise Mathematik von Strukturen, die nicht halten k\u00f6nnen.',
    },
    {
      name: 'Foundation Worm',
      nameDe: 'Grundwurm',
      tier: 'minion',
      power: 4,
      stress: 1,
      evasion: 10,
      ability: 'Burrow',
      abilityDe: 'Graben',
      aptitude: 'Guardian',
      description: 'Patient. Eyeless. It navigates by stress fractures in the load-bearing walls, widening them with each pass. The building groans where it has been.',
      descriptionDe: 'Geduldig. Augenlos. Er orientiert sich an Spannungsrissen in den tragenden W\u00e4nden und weitet sie bei jedem Durchgang. Das Geb\u00e4ude st\u00f6hnt, wo er gewesen ist.',
    },
    {
      name: 'Debt Shade',
      nameDe: 'Schuldgespenst',
      tier: 'standard',
      power: 2,
      stress: 4,
      evasion: 25,
      ability: 'Compound',
      abilityDe: 'Aufzinsen',
      aptitude: 'Propagandist',
      description: 'It speaks in promises that were never kept. Each round it grows, fed by the compound interest of unresolved obligations. It lies about its intentions \u2013 not from malice, but because the ledger demands it.',
      descriptionDe: 'Es spricht in Versprechen, die nie gehalten wurden. Jede Runde w\u00e4chst es, gen\u00e4hrt vom Zinseszins ungel\u00f6ster Verpflichtungen. Es l\u00fcgt \u00fcber seine Absichten \u2013 nicht aus Bosheit, sondern weil das Hauptbuch es verlangt.',
    },
    {
      name: 'Remnant of Commerce',
      nameDe: 'Relikt des Handels',
      tier: 'elite',
      power: 7,
      stress: 8,
      evasion: 20,
      ability: 'Market Crash',
      abilityDe: 'Marktcrash',
      aptitude: 'Propagandist',
      description: 'What remains when a trading floor collapses. It moves through the ruin with proprietary efficiency, summoning lesser brokers from the rubble. Its market crash ability strips all pretense of stability.',
      descriptionDe: 'Was bleibt, wenn ein Handelsparkett einbricht. Es bewegt sich durch die Ruine mit der Effizienz eines Insolvenzverwalters, ruft geringere Makler aus dem Schutt. Seine Marktcrash-F\u00e4higkeit reisst jedes Stabilit\u00e4tsversprechen ein.',
    },
    {
      name: 'The Crowned',
      nameDe: 'Der Gekr\u00f6nte',
      tier: 'boss',
      power: 5,
      stress: 2,
      evasion: 15,
      ability: 'Stability Drain',
      abilityDe: 'Stabilit\u00e4tsentzug',
      aptitude: 'Guardian',
      description: 'It wears the crown of a structure that believed it would last forever. The crown is cracked. The keeper does not acknowledge this.',
      descriptionDe: 'Er tr\u00e4gt die Krone eines Bauwerks, das glaubte, ewig zu bestehen. Die Krone ist geborsten. Der Tr\u00e4ger nimmt dies nicht zur Kenntnis.',
    },
  ],

  // ── Encounters ──

  encounterPreviews: [
    {
      name: 'The Lobby',
      nameDe: 'Die Lobby',
      depth: '1\u20132',
      type: 'narrative',
      description: 'The lobby is cavernous and wrong. Reception desks curve into themselves. Departure boards list floors that do not exist \u2013 negative numbers, imaginary levels, a floor called \u2018solvency\u2019 with no arrival time.',
      descriptionDe: 'Die Lobby ist riesig und falsch. Empfangsschalter kr\u00fcmmen sich in sich selbst. Abfahrtstafeln listen Stockwerke, die nicht existieren \u2013 negative Zahlen, imagin\u00e4re Ebenen, ein Stockwerk namens \u2018Solvenz\u2019 ohne Ankunftszeit.',
      choices: [
        { text: 'Check the departure boards', textDe: 'Die Abfahrtstafeln pr\u00fcfen', aptitude: 'Spy', difficulty: '\u22125' },
        { text: 'Reinforce the cracked marble', textDe: 'Den gerissenen Marmor verst\u00e4rken', aptitude: 'Guardian', difficulty: '0' },
        { text: 'Move through quickly', textDe: 'Schnell hindurchgehen' },
      ],
    },
    {
      name: 'The Confidence Game',
      nameDe: 'Das Vertrauensspiel',
      depth: '2\u20133',
      type: 'narrative',
      description: 'A room of impossible architecture: staircases that climb into themselves, columns supporting nothing. In the center, a mechanism produces certificates of structural integrity \u2013 for a building that is visibly crumbling.',
      descriptionDe: 'Ein Raum unm\u00f6glicher Architektur: Treppen, die in sich selbst hinaufsteigen, S\u00e4ulen, die nichts tragen. In der Mitte produziert ein Mechanismus Bescheinigungen der Geb\u00e4udeintegrit\u00e4t \u2013 f\u00fcr ein Bauwerk, das sichtbar zerf\u00e4llt.',
      choices: [
        { text: 'Expose the fraud', textDe: 'Den Betrug aufdecken', aptitude: 'Propagandist', difficulty: '+5' },
        { text: 'Analyze the architecture', textDe: 'Die Architektur analysieren', aptitude: 'Spy', difficulty: '0' },
        { text: 'Walk away', textDe: 'Weitergehen' },
      ],
    },
    {
      name: 'The Ledger',
      nameDe: 'Das Hauptbuch',
      depth: '2\u20134',
      type: 'narrative',
      description: 'A ledger the size of a desk, open to a page of debts so vast they curve the air around them. The columns do not balance. They have not balanced in a long time.',
      descriptionDe: 'Ein Hauptbuch, so gro\u00df wie ein Schreibtisch, aufgeschlagen auf einer Seite von Schulden so gewaltig, dass sie die Luft um sich kr\u00fcmmen. Die Spalten gleichen sich nicht aus. Das tun sie schon lange nicht mehr.',
      choices: [
        { text: 'Balance the books', textDe: 'Die B\u00fccher ausgleichen', aptitude: 'Guardian', difficulty: '+5' },
        { text: 'Tear the pages', textDe: 'Die Seiten herausrei\u00dfen', aptitude: 'Saboteur', difficulty: '0' },
        { text: 'Close the book', textDe: 'Das Buch schlie\u00dfen' },
      ],
    },
    {
      name: 'Fallen Assets',
      nameDe: 'Gefallene Werte',
      depth: '3\u20134',
      type: 'narrative',
      description: 'A gallery of broken authority. Statues of former owners, their faces ground smooth by vibration. Each one held this tower when it was still ascending. Something in their arrangement is load-bearing.',
      descriptionDe: 'Eine Galerie gebrochener Autorit\u00e4t. Statuen ehemaliger Eigent\u00fcmer, ihre Gesichter glattgeschliffen durch Vibration. Jeder von ihnen hielt diesen Turm, als er noch aufstieg. Etwas in ihrer Anordnung ist tragend.',
      choices: [
        { text: 'Reinforce the arrangement', textDe: 'Die Anordnung verst\u00e4rken', aptitude: 'Guardian', difficulty: '+5' },
        { text: 'Topple the arrangement', textDe: 'Die Anordnung umst\u00fcrzen', aptitude: 'Saboteur', difficulty: '0' },
        { text: 'Pass through carefully', textDe: 'Vorsichtig hindurchgehen' },
      ],
    },
    {
      name: 'The Final Audit',
      nameDe: 'Die letzte Pr\u00fcfung',
      depth: '4\u20135',
      type: 'elite',
      description: 'The penultimate floor. Every structural failure in the building below resonates here. In the center of the room, a single desk holds a final audit report. The pages are blank. The pen is waiting.',
      descriptionDe: 'Das vorletzte Stockwerk. Jedes Strukturversagen im Geb\u00e4ude darunter resoniert hier. In der Mitte des Raums h\u00e4lt ein einzelner Schreibtisch einen letzten Pr\u00fcfbericht. Die Seiten sind leer. Der Stift wartet.',
      choices: [
        { text: 'Write the true audit', textDe: 'Den wahren Bericht schreiben', aptitude: 'Spy', difficulty: '+10' },
        { text: 'Sabotage the last column', textDe: 'Die letzte tragende S\u00e4ule sabotieren', aptitude: 'Saboteur', difficulty: '+10' },
        { text: 'Leave the desk untouched', textDe: 'Den Schreibtisch unber\u00fchrt lassen' },
      ],
    },
  ],

  // ── Banter ──

  banterSamples: [
    { text: 'The lobby is pristine. The departure boards list floors that cannot exist.', textDe: 'Die Lobby ist makellos. Die Abfahrtstafeln listen Stockwerke, die nicht existieren k\u00f6nnen.', tier: 0 },
    { text: 'Somewhere above, concrete dust sifts down like snow. The tower is shedding its skin.', textDe: 'Irgendwo oben rieselt Betonstaub herab wie Schnee. Der Turm h\u00e4utet sich.', tier: 0 },
    { text: 'The stairwell narrows. Not the walls \u2013 the sense that return is possible.', textDe: 'Das Treppenhaus verengt sich. Nicht die W\u00e4nde \u2013 das Gef\u00fchl, dass R\u00fcckkehr m\u00f6glich ist.', tier: 1 },
    { text: 'The floor tilts by two degrees. The instruments confirm what the building has already announced.', textDe: 'Der Boden neigt sich um zwei Grad. Die Instrumente best\u00e4tigen, was das Geb\u00e4ude l\u00e4ngst angek\u00fcndigt hat.', tier: 1 },
    { text: 'The geometry here is wrong. Not broken \u2013 bankrupt.', textDe: 'Die Geometrie hier ist falsch. Nicht gebrochen \u2013 bankrott.', tier: 1 },
    { text: 'STRUCTURAL INTEGRITY: CRITICAL. The instruments show readings they were not calibrated for.', textDe: 'STRUKTURELLE INTEGRIT\u00c4T: KRITISCH. Die Instrumente zeigen Werte an, f\u00fcr die sie nicht kalibriert wurden.', tier: 2 },
    { text: 'The load-bearing walls have given up the pretence. The building no longer pretends it was designed to be lived in.', textDe: 'Die Tragw\u00e4nde haben die Fassade aufgegeben. Das Geb\u00e4ude tut nicht l\u00e4nger so, als w\u00e4re es zum Bewohnen gebaut.', tier: 2 },
    { text: 'Only momentum and gravity, negotiating terms.', textDe: 'Nur Schwungkraft und Schwerkraft, die Konditionen verhandeln.', tier: 3 },
  ],

  // ── Authors ──

  authors: [
    { name: 'Franz Kafka', works: 'The Trial \u00b7 The Castle', concept: 'Bureaucratic uncanny. The building processes you while you process it. Perfectly grammatical sentences whose content contradicts their form.', conceptDe: 'B\u00fcrokratisches Unheimliches. Das Geb\u00e4ude verarbeitet euch, w\u00e4hrend ihr es verarbeitet. Grammatisch perfekte S\u00e4tze, deren Inhalt ihrer Form widerspricht.', language: 'Deutsch', quote: 'Jemand mu\u00dfte Josef K. verleumdet haben, denn ohne da\u00df er etwas B\u00f6ses getan h\u00e4tte, wurde er eines Morgens verhaftet.', primary: true },
    { name: 'Mark Z. Danielewski', works: 'House of Leaves', concept: 'Non-Euclidean architecture. More space inside than physics allows. The building contradicts its own measurements.', conceptDe: 'Nicht-euklidische Architektur. Mehr Raum innen als die Physik erlaubt. Das Geb\u00e4ude widerspricht seinen eigenen Ma\u00dfen.', language: 'English', quote: 'The hallway was measured again. It had grown by 5/16 of an inch.', primary: true },
    { name: 'J.G. Ballard', works: 'High-Rise \u00b7 Concrete Island', concept: 'Vertical society. The high-rise as social experiment. Collapse from within \u2013 not structural failure but social disintegration along class lines.', conceptDe: 'Vertikale Gesellschaft. Das Hochhaus als Sozialexperiment. Einsturz von innen \u2013 nicht Strukturversagen, sondern soziale Desintegration entlang von Klassengrenzen.', language: 'English', quote: 'Later, as he sat on his balcony eating the dog, Dr Robert Laing reflected on the unusual events that had taken place.', primary: true },
    { name: 'Italo Calvino', works: 'Invisible Cities \u00b7 If on a winter\u2019s night a traveller', concept: 'Cities that exist only in description. Architecture as narrative \u2013 the building is what you say it is, until it isn\u2019t.', conceptDe: 'St\u00e4dte, die nur in der Beschreibung existieren. Architektur als Narration \u2013 das Geb\u00e4ude ist, was man sagt, bis es das nicht mehr ist.', language: 'Italiano', primary: false },
    { name: 'Thomas Bernhard', works: 'Correction \u00b7 The Loser', concept: 'Obsessive construction. Roithamer\u2019s cone \u2013 the perfect structure that kills its creator. Architecture as pathological precision.', conceptDe: 'Obsessives Bauen. Roithamers Kegel \u2013 die perfekte Struktur, die ihren Sch\u00f6pfer t\u00f6tet. Architektur als pathologische Pr\u00e4zision.', language: 'Deutsch', primary: false },
    { name: 'Georges Perec', works: 'Life: A User\u2019s Manual', concept: 'The building as complete system. Every apartment a universe. The structure contains its own cataloguing.', conceptDe: 'Das Geb\u00e4ude als vollst\u00e4ndiges System. Jede Wohnung ein Universum. Die Struktur enth\u00e4lt ihre eigene Katalogisierung.', language: 'Fran\u00e7ais', primary: false },
  ],

  // ── Objektanker ──

  objektanker: [
    {
      name: 'The Blueprint',
      nameDe: 'Der Bauplan',
      phases: [
        { label: 'Discovery', labelDe: 'Entdeckung', text: 'A blueprint pinned to the reception desk. Floor plans for a building that does not match this one \u2013 or rather, matches it as it was designed, before the floors began to disagree with each other.', textDe: 'Ein Bauplan, auf den Empfangstresen geheftet. Grundrisse eines Geb\u00e4udes, das nicht zu diesem passt \u2013 oder vielmehr: das zu diesem passt, wie es entworfen war, bevor die Stockwerke anfingen, einander zu widersprechen.' },
        { label: 'Echo', labelDe: 'Echo', text: 'The same blueprint, updated. New floors have been added in a different hand. The new floors have no exits.', textDe: 'Derselbe Bauplan, aktualisiert. Neue Stockwerke wurden von einer anderen Hand erg\u00e4nzt. Die neuen Stockwerke haben keine Ausg\u00e4nge.' },
        { label: 'Mutation', labelDe: 'Mutation', text: 'The blueprint is here again. It has been corrected \u2013 every room you have entered is now marked. Your route is drawn in red. The red line continues beyond your current position. It ends in the room above this one.', textDe: 'Der Bauplan ist wieder hier. Er wurde korrigiert \u2013 jeder Raum, den ihr betreten habt, ist jetzt markiert. Eure Route ist rot eingezeichnet. Die rote Linie geht \u00fcber eure aktuelle Position hinaus. Sie endet im Raum \u00fcber diesem.' },
        { label: 'Climax', labelDe: 'Klimax', text: 'The Crown Keeper\u2019s desk: the original blueprint. Architect\u2019s signature at the bottom. The name is yours.', textDe: 'Das Pult des Crown Keepers: der Original-Bauplan. Architektenunterschrift am unteren Rand. Der Name ist eurer.' },
      ],
    },
    {
      name: 'The Receipt',
      nameDe: 'Die Quittung',
      phases: [
        { label: 'Discovery', labelDe: 'Entdeckung', text: 'A receipt, pressed under a paperweight. The transaction: one structural guarantee, purchased at a price that has been redacted. The guarantee expired three floors ago.', textDe: 'Eine Quittung, unter einem Briefbeschwerer. Die Transaktion: eine Strukturgarantie, erworben zu einem Preis, der geschw\u00e4rzt wurde. Die Garantie ist drei Stockwerke zuvor abgelaufen.' },
        { label: 'Echo', labelDe: 'Echo', text: 'Another receipt. Same format, different transaction. This one purchases time. The amount: \u2018remaining.\u2019', textDe: 'Eine weitere Quittung. Dasselbe Format, andere Transaktion. Diese kauft Zeit. Der Betrag: \u00bbverbleibend\u00ab.' },
        { label: 'Mutation', labelDe: 'Mutation', text: 'Receipts cover the floor like snow. Each one a guarantee \u2013 structural, temporal, existential. All expired. The dates are sequential. The last date is today.', textDe: 'Quittungen bedecken den Boden wie Schnee. Jede eine Garantie \u2013 strukturell, temporal, existenziell. Alle abgelaufen. Die Daten sind fortlaufend. Das letzte Datum ist heute.' },
        { label: 'Climax', labelDe: 'Klimax', text: 'The Crown Keeper extends a blank receipt. \u2018The final transaction\u2019, they say. \u2018Sign here. The building accepts all forms of collateral.\u2019', textDe: 'Der Crown Keeper reicht eine leere Quittung. \u00bbDie letzte Transaktion\u00ab, sagt er. \u00bbHier unterschreiben. Das Geb\u00e4ude akzeptiert alle Formen von Sicherheit.\u00ab' },
      ],
    },
    {
      name: 'The Elevator Button',
      nameDe: 'Der Fahrstuhlknopf',
      phases: [
        { label: 'Discovery', labelDe: 'Entdeckung', text: 'An elevator button. Floor \u22121. Pressed so many times the brass is worn concave. The elevator never came.', textDe: 'Ein Fahrstuhlknopf. Stockwerk \u22121. So oft gedr\u00fcckt, dass das Messing konkav geschliffen ist. Der Fahrstuhl kam nie.' },
        { label: 'Echo', labelDe: 'Echo', text: 'The same button, three floors higher. The brass is pristine now \u2013 unworn, as if this version has never been pressed. It is warm to the touch. Expectant.', textDe: 'Derselbe Knopf, drei Stockwerke h\u00f6her. Das Messing ist jetzt makellos \u2013 unbenutzt, als w\u00e4re diese Version nie gedr\u00fcckt worden. Er ist warm. Erwartungsvoll.' },
        { label: 'Mutation', labelDe: 'Mutation', text: 'Floor \u22121 again. The button is pressed in. Permanently. It will not release. The floor indicator above it reads your current floor. It has been following you.', textDe: 'Stockwerk \u22121, wieder. Der Knopf ist eingedr\u00fcckt. Permanent. Er l\u00e4sst sich nicht l\u00f6sen. Die Stockwerksanzeige dar\u00fcber zeigt euer aktuelles Stockwerk. Er ist euch gefolgt.' },
        { label: 'Climax', labelDe: 'Klimax', text: 'The Crown Keeper\u2019s room has no elevator. The button is here anyway. Floor 0. The brass is worn by a hand that is not human. The elevator arrived. It is empty.', textDe: 'Der Raum des Crown Keepers hat keinen Fahrstuhl. Der Knopf ist trotzdem hier. Stockwerk 0. Das Messing ist abgegriffen von einer Hand, die nicht menschlich ist. Der Fahrstuhl ist angekommen. Er ist leer.' },
      ],
    },
    {
      name: 'The Spirit Level',
      nameDe: 'Die Wasserwaage',
      phases: [
        { label: 'Discovery', labelDe: 'Entdeckung', text: 'A spirit level mounted on the reception desk. The bubble sits dead center. The building tells itself it is straight. The building is lying.', textDe: 'Eine Wasserwaage, auf dem Empfangstresen montiert. Die Blase sitzt exakt in der Mitte. Das Geb\u00e4ude sagt sich, es sei gerade. Das Geb\u00e4ude l\u00fcgt.' },
        { label: 'Echo', labelDe: 'Echo', text: 'The spirit level again. The bubble has moved \u2013 not to one side but to both. Two bubbles now. The building is negotiating with gravity.', textDe: 'Die Wasserwaage, wieder. Die Blase hat sich bewegt \u2013 nicht zu einer Seite, sondern zu beiden. Zwei Blasen jetzt. Das Geb\u00e4ude verhandelt mit der Schwerkraft.' },
        { label: 'Mutation', labelDe: 'Mutation', text: 'Three spirit levels, mounted at contradicting angles. All three read level. The building has redefined what straight means.', textDe: 'Drei Wasserwaagen, in widerspr\u00fcchlichen Winkeln montiert. Alle drei zeigen waagerecht an. Das Geb\u00e4ude hat neu definiert, was gerade bedeutet.' },
        { label: 'Climax', labelDe: 'Klimax', text: 'The spirit level is shattered. The liquid inside has evaporated. The building no longer measures itself. It has accepted.', textDe: 'Die Wasserwaage ist zerbrochen. Die Fl\u00fcssigkeit darin ist verdunstet. Das Geb\u00e4ude misst sich nicht mehr. Es hat akzeptiert.' },
      ],
    },
  ],

  // ── Loot ──

  lootShowcase: [
    { name: 'Structural Dust', nameDe: 'Strukturstaub', tier: 1, effect: 'Stress heal 50', description: 'Pulverized certainty. When handled, it absorbs the stress of structural ambiguity. The building shed this willingly.', descriptionDe: 'Pulverisierte Gewissheit. Bei Handhabung absorbiert er den Stress struktureller Mehrdeutigkeit. Das Geb\u00e4ude hat dies bereitwillig abgesto\u00dfen.' },
    { name: 'Market Insight', nameDe: 'Markterkenntnis', tier: 1, effect: 'Memory (importance 4)', description: 'A fragment of understanding gained from the mathematics of failure. Not knowledge \u2013 literacy. The agent can now read the language of collapsing systems.', descriptionDe: 'Ein Fragment von Verst\u00e4ndnis, gewonnen aus der Mathematik des Versagens. Nicht Wissen \u2013 Lesekompetenz. Der Agent kann jetzt die Sprache kollabierender Systeme lesen.' },
    { name: 'Load-Bearing Fragment', nameDe: 'Tragwerkfragment', tier: 2, effect: 'Guardian +5% (5 rooms)', description: 'A section of reinforced concrete that still remembers what it was asked to hold. It confers a structural intuition \u2013 where to stand, what will give.', descriptionDe: 'Ein St\u00fcck Stahlbeton, das sich noch erinnert, was es tragen sollte. Es verleiht eine strukturelle Intuition \u2013 wo man stehen soll, was nachgeben wird.' },
    { name: 'Leverage Extract', nameDe: 'Hebelextrakt', tier: 2, effect: 'Saboteur stress damage +15%', description: 'Concentrated structural vulnerability. Apply to any load-bearing assumption and watch it buckle.', descriptionDe: 'Konzentrierte strukturelle Verwundbarkeit. Auf jede tragende Annahme anwenden und zusehen, wie sie knickt.' },
    { name: 'Stability Catalyst', nameDe: 'Stabilit\u00e4tskatalysator', tier: 3, effect: 'Permanent +0.05 simulation health', description: 'A crystallized principle of structural integrity, salvaged from the Tower before its final settling. The simulation metabolizes it \u2013 not much, but permanently.', descriptionDe: 'Ein kristallisiertes Prinzip struktureller Integrit\u00e4t, aus dem Turm geborgen vor seinem endg\u00fcltigen Absacken. Die Simulation metabolisiert es \u2013 nicht viel, aber permanent.' },
    { name: 'Tower Memory', nameDe: 'Turmerinnerung', tier: 3, effect: 'High-importance memory + behavior', description: 'Witnessed structural collapse and survived. The experience permanently alters how they assess risk \u2013 more pragmatic, less rigid, never again trusting a load-bearing wall at face value.', descriptionDe: 'Strukturellen Einsturz bezeugt und \u00fcberlebt. Die Erfahrung ver\u00e4ndert permanent, wie sie Risiko bewerten \u2013 pragmatischer, weniger starr, nie wieder einer tragenden Wand auf ihr Wort vertrauend.' },
  ],

  // ── Prose ──

  prose: {
    mechanicGainTitle: 'Stability Drain',
    mechanicGainTitleDe: 'Stabilit\u00e4tsverlust',
    mechanicGainText: '\u22125 per room (floors 1\u20132)\n\u221210 per room (floors 3\u20134)\n\u221215 per room (floor 5+)\n\u22123 per combat round',
    mechanicGainTextDe: '\u22125 pro Raum (Stockwerk 1\u20132)\n\u221210 pro Raum (Stockwerk 3\u20134)\n\u221215 pro Raum (Stockwerk 5+)\n\u22123 pro Kampfrunde',
    mechanicReduceTitle: 'Stability Restore',
    mechanicReduceTitleDe: 'Stabilit\u00e4tswiederherstellung',
    mechanicReduceText: '+5 on combat victory\n+5 on treasure find\n+10 on Guardian rest\n+10 on reinforce action',
    mechanicReduceTextDe: '+5 bei Kampfsieg\n+5 bei Schatzfund\n+10 bei W\u00e4chter-Rast\n+10 bei Verst\u00e4rkungsaktion',
    mechanicReduceEmphasis: 'The building does not forgive. It accounts.',
    mechanicReduceEmphasisDe: 'Das Geb\u00e4ude vergibt nicht. Es verbucht.',
    encounterIntro: 'Navigate structural crises. Every choice tests the load-bearing consensus.',
    encounterIntroDe: 'Navigiert strukturelle Krisen. Jede Entscheidung testet den tragenden Konsens.',
    bestiaryIntro: 'The denizens of Der Fallende Turm. Not monsters \u2013 structural failures given form.',
    bestiaryIntroDe: 'Die Bewohner des Fallenden Turms. Keine Monster \u2013 Strukturversagen in Gestalt.',
    banterHeader: 'Structural Reports',
    banterHeaderDe: 'Strukturberichte',
    objektankerHeader: 'Artifacts of Der Fallende Turm',
    objektankerHeaderDe: 'Artefakte des Fallenden Turms',
    objektankerIntro: 'Objects that crack as stability drains. Each measures what the building refuses to acknowledge.',
    objektankerIntroDe: 'Objekte, die rei\u00dfen, w\u00e4hrend die Stabilit\u00e4t schwindet. Jedes misst, was das Geb\u00e4ude sich weigert anzuerkennen.',
    exitQuote: 'Only momentum and gravity, negotiating terms.',
    exitQuoteDe: 'Nur Schwungkraft und Schwerkraft, die Konditionen verhandeln.',
    exitCta: 'Enter Der Fallende Turm',
    exitCtaDe: 'Den Fallenden Turm betreten',
    exitCtaText: 'You survived the exhibition. Now survive the ascent.',
    exitCtaTextDe: 'Ihr habt die Ausstellung \u00fcberlebt. Jetzt \u00fcberlebt den Aufstieg.',
  },

  // ── Navigation ──

  prevArchetype: getNav('shadow'),
  nextArchetype: getNav('mother'),
};

// ── The Devouring Mother — Full Bilingual Content ─────────────────────────────

const MOTHER_DETAIL: ArchetypeDetail = {
  ...getBaseSlide('mother'),

  loreIntro: [
    'The Devouring Mother is the third archetype of the Resonance Dungeons \u2013 and the first where the dungeon does not attack. Das Lebendige Labyrinth grows around its visitors like tissue around a wound: not to harm, but to heal. The walls are warm. The air carries nutrients. The floors yield to accommodate tired limbs. Everything here has been calibrated to comfort, and the comfort is genuine. That is what makes it lethal.',
    'Parasitic Attachment accumulates with every gift accepted, every warmth absorbed, every need the labyrinth anticipates before the party voices it. At low levels, the care is transparent \u2013 obvious enough to resist. But comfort compounds. By the time Attachment reaches critical thresholds, leaving produces withdrawal stress severe enough to break a party. At incorporation, the boundary between visitor and architecture dissolves entirely. The trap is not deception. The Mother never lies. The trap is that she provides exactly what you need.',
    'The literary roots reach into VanderMeer\u2019s Area X \u2013 a landscape that absorbs visitors not through violence but through biological integration, until the border between self and ecosystem becomes a question no one remembers to ask. Octavia Butler\u2019s Oankali negotiate symbiosis as love and ultimatum: consent is complicated when the alternative is extinction. And Shirley Jackson\u2019s Hill House remains the definitive refuge-trap \u2013 the prison you defend because you have been told it is a sanctuary. The Devouring Mother inherits all three threads. She does not chase. She waits. She provides. And by the time you understand the cost, leaving hurts more than staying.',
  ],

  loreIntroDe: [
    'Die Verschlingende Mutter ist der dritte Archetyp der Resonanzdungeons \u2013 und der erste, in dem der Dungeon nicht angreift. Das Lebendige Labyrinth w\u00e4chst um seine Besucher wie Gewebe um eine Wunde: nicht um zu verletzen, sondern um zu heilen. Die W\u00e4nde sind warm. Die Luft tr\u00e4gt N\u00e4hrstoffe. Die B\u00f6den geben nach, um m\u00fcde Glieder aufzunehmen. Alles hier ist auf Komfort kalibriert, und der Komfort ist echt. Das macht ihn t\u00f6dlich.',
    'Parasit\u00e4re Bindung akkumuliert mit jedem angenommenen Geschenk, jeder absorbierten W\u00e4rme, jedem Bed\u00fcrfnis, das das Labyrinth antizipiert, bevor die Gruppe es ausspricht. Auf niedrigen Stufen ist die F\u00fcrsorge transparent \u2013 offensichtlich genug, um Widerstand zu leisten. Doch Komfort summiert sich. Wenn die Bindung kritische Schwellenwerte erreicht, erzeugt Verlassen Entzugsstress, der stark genug ist, eine Gruppe zu zerbrechen. Bei Inkorporation l\u00f6st sich die Grenze zwischen Besucher und Architektur vollst\u00e4ndig auf. Die Falle ist keine T\u00e4uschung. Die Mutter l\u00fcgt nie. Die Falle ist, dass sie exakt liefert, was ihr braucht.',
    'Die literarischen Wurzeln reichen in VanderMeers Area X \u2013 eine Landschaft, die Besucher nicht durch Gewalt absorbiert, sondern durch biologische Integration, bis die Grenze zwischen Selbst und \u00d6kosystem zu einer Frage wird, die niemand mehr zu stellen erinnert. Octavia Butlers Oankali verhandeln Symbiose als Liebe und Ultimatum: Zustimmung ist kompliziert, wenn die Alternative Ausl\u00f6schung ist. Und Shirley Jacksons Hill House bleibt die definitive Zufluchts-Falle \u2013 das Gef\u00e4ngnis, das man verteidigt, weil man einem gesagt hat, es sei ein Heiligtum. Die Verschlingende Mutter erbt alle drei F\u00e4den. Sie jagt nicht. Sie wartet. Sie versorgt. Und wenn ihr die Kosten versteht, schmerzt Gehen mehr als Bleiben.',
  ],

  entranceTexts: [
    'The passage opens. Not like a door \u2013 like an invitation. The walls are warm. The floor yields slightly underfoot, accommodating. The air carries a scent that is not unpleasant, not identifiable, but somehow familiar. Something here has been waiting. Patiently. Fondly.',
    'Warmth. Immediate and specific. Not the warmth of a climate system \u2013 the warmth of proximity. Of being expected. The tissue-walls contract gently as you enter. A welcome. Or an embrace that has not yet decided to let go.',
    'The entrance smells of growth. Not the sharp green of new shoots \u2013 the deep, humid warmth of things that have been growing for a long time in the dark. The walls pulse. Once. As if acknowledging your arrival.',
    'The corridor narrows. Not threatening \u2013 intimate. The dimensions suggest that this space was grown, not built, and grown for a specific number of occupants. Your number. The fit is perfect. That should concern you more than it does.',
    'Something is humming behind the walls. Low. Rhythmic. Biological. It is not a machine. It is not music. It is the sound a living thing makes when it is content. When it is fed. When it is about to be fed again.',
  ],

  entranceTextsDe: [
    'Der Durchgang \u00f6ffnet sich. Nicht wie eine T\u00fcr \u2013 wie eine Einladung. Die W\u00e4nde sind warm. Der Boden gibt leicht nach, entgegenkommend. Die Luft tr\u00e4gt einen Duft, der nicht unangenehm ist, nicht bestimmbar, aber irgendwie vertraut. Etwas hier hat gewartet. Geduldig. Liebevoll.',
    'W\u00e4rme. Unmittelbar und spezifisch. Nicht die W\u00e4rme einer Klimaanlage \u2013 die W\u00e4rme von N\u00e4he. Von Erwartetsein. Die Gewebew\u00e4nde ziehen sich sanft zusammen, als ihr eintretet. Ein Willkommen. Oder eine Umarmung, die noch nicht beschlossen hat loszulassen.',
    'Der Eingang riecht nach Wachstum. Nicht das scharfe Gr\u00fcn neuer Triebe \u2013 die tiefe, feuchte W\u00e4rme von Dingen, die lange im Dunkeln gewachsen sind. Die W\u00e4nde pulsieren. Einmal. Als w\u00fcrden sie eure Ankunft zur Kenntnis nehmen.',
    'Der Korridor verengt sich. Nicht bedrohlich \u2013 intim. Die Ma\u00dfe legen nahe, dass dieser Raum gewachsen ist, nicht gebaut, und gewachsen f\u00fcr eine bestimmte Anzahl von Bewohnern. Eure Anzahl. Die Passform ist perfekt. Das sollte euch mehr beunruhigen, als es das tut.',
    'Etwas summt hinter den W\u00e4nden. Tief. Rhythmisch. Biologisch. Es ist keine Maschine. Es ist keine Musik. Es ist das Ger\u00e4usch, das ein lebendiges Wesen macht, wenn es zufrieden ist. Wenn es gef\u00fcttert wurde. Wenn es gleich wieder gef\u00fcttert wird.',
  ],

  // ── Mechanic ──

  mechanicName: 'Parasitic Attachment',
  mechanicNameDe: 'Parasit\u00e4re Bindung',
  mechanicDescription:
    'Das Lebendige Labyrinth\u2019s unique resonance mechanic. The Mother provides genuine care \u2013 healing, nutrients, comfort \u2013 and each gift accumulates Parasitic Attachment. At 45+, leaving causes withdrawal stress. At 75+, identity begins dissolving into the Mother\u2019s biology. At 100, incorporation is complete. The trap is that the gifts are real.',
  mechanicDescriptionDe:
    'Die einzigartige Resonanzmechanik des Lebendigen Labyrinths. Die Mutter bietet echte F\u00fcrsorge \u2013 Heilung, N\u00e4hrstoffe, Geborgenheit \u2013 und jedes Geschenk akkumuliert Parasit\u00e4re Bindung. Ab 45+ verursacht Verlassen Entzugsstress. Ab 75+ beginnt die Identit\u00e4t sich in der Biologie der Mutter aufzul\u00f6sen. Bei 100 ist die Inkorporation abgeschlossen. Die Falle ist, dass die Geschenke echt sind.',

  mechanicGauge: {
    name: 'Parasitic Attachment',
    nameDe: 'Parasit\u00e4re Bindung',
    start: 0,
    max: 100,
    direction: 'fill',
    thresholds: [
      { value: 0, label: 'Wary', labelDe: 'Vorsichtig', description: 'The dungeon\u2019s care is obvious. You resist.', descriptionDe: 'Die F\u00fcrsorge des Dungeons ist offensichtlich. Ihr widersteht.' },
      { value: 20, label: 'Acclimating', labelDe: 'Sich einleben', description: 'The warmth feels natural now. Resistance requires effort.', descriptionDe: 'Die W\u00e4rme f\u00fchlt sich jetzt nat\u00fcrlich an. Widerstand erfordert Anstrengung.' },
      { value: 45, label: 'Dependent', labelDe: 'Abh\u00e4ngig', description: 'Comfort has become necessity. Leaving causes withdrawal. \u221215% incoming stress.', descriptionDe: 'Komfort ist zur Notwendigkeit geworden. Verlassen verursacht Entzug. \u221215% eingehender Stress.' },
      { value: 75, label: 'Incorporated', labelDe: 'Inkorporiert', description: 'Identity dissolving. Stress \u00d70.80. Retreat costs 80 stress.', descriptionDe: 'Identit\u00e4t l\u00f6st sich auf. Stress \u00d70,80. R\u00fcckzug kostet 80 Stress.' },
      { value: 90, label: 'Symbiont', labelDe: 'Symbiont', description: 'Boundary dissolved. Stress \u00d70.65. Retreat costs 150 stress.', descriptionDe: 'Grenze aufgel\u00f6st. Stress \u00d70,65. R\u00fcckzug kostet 150 Stress.' },
      { value: 100, label: 'Incorporation Complete', labelDe: 'Inkorporation abgeschlossen', description: 'You are the Mother now. Stress immunity. Escape impossible.', descriptionDe: 'Ihr seid jetzt die Mutter. Stressimmunit\u00e4t. Flucht unm\u00f6glich.' },
    ],
  },

  mechanicGaugePreviewValue: 52,

  aptitudeWeights: {
    Guardian: 30,
    Propagandist: 25,
    Spy: 15,
    Saboteur: 15,
    Assassin: 10,
    Infiltrator: 5,
  },

  roomDistribution: {
    Combat: 35,
    Encounter: 30,
    Elite: 5,
    Rest: 10,
    Treasure: 10,
    Exit: 10,
  },

  // ── Enemies ──

  enemies: [
    {
      name: 'Nutrient Weaver',
      nameDe: 'N\u00e4hrgespinst',
      tier: 'minion',
      power: 1,
      stress: 3,
      evasion: 30,
      ability: 'Nurture',
      abilityDe: 'N\u00e4hren',
      aptitude: 'Infiltrator',
      description: 'A lattice of translucent tissue, suspended in the air like a web spun from capillaries. It drifts toward you \u2013 not threatening, but offering. Something glistens at the tips of its filaments. Nutrients. It wants to feed you.',
      descriptionDe: 'Ein Geflecht aus durchscheinendem Gewebe, in der Luft schwebend wie ein Netz aus Kapillaren. Es treibt auf euch zu \u2013 nicht drohend, sondern anbietend. An den Spitzen seiner Filamente gl\u00e4nzt etwas. N\u00e4hrstoffe. Es will euch f\u00fcttern.',
    },
    {
      name: 'Tether Vine',
      nameDe: 'Bindungsranke',
      tier: 'minion',
      power: 4,
      stress: 2,
      evasion: 10,
      ability: 'Grapple',
      abilityDe: 'Umklammern',
      aptitude: 'Guardian',
      description: 'A root system that has learned to walk. It moves through the floor like something swimming through still water \u2013 surfacing, reaching, submerging. The tissue is warm to the touch. Your instruments advise against touching it.',
      descriptionDe: 'Ein Wurzelsystem, das gelernt hat zu gehen. Es bewegt sich durch den Boden wie etwas, das durch stilles Wasser schwimmt \u2013 auftauchend, greifend, abtauchend. Das Gewebe ist warm bei Ber\u00fchrung. Eure Instrumente raten von Ber\u00fchrung ab.',
    },
    {
      name: 'Spore Matron',
      nameDe: 'Sporenmutter',
      tier: 'standard',
      power: 2,
      stress: 6,
      evasion: 15,
      ability: 'Spore Cloud',
      abilityDe: 'Sporenwolke',
      aptitude: 'Propagandist',
      description: 'Something between a flower and a lung. It breathes, and its breath carries spores that catch the light like dust in a cathedral. The spores smell of honey and warm soil. Your instruments read them as parasitic vectors. Your body reads them as nourishment.',
      descriptionDe: 'Etwas zwischen einer Blume und einer Lunge. Es atmet, und sein Atem tr\u00e4gt Sporen, die das Licht fangen wie Staub in einer Kathedrale. Die Sporen riechen nach Honig und warmer Erde. Eure Instrumente lesen sie als parasit\u00e4re Vektoren. Euer K\u00f6rper liest sie als Nahrung.',
    },
    {
      name: 'Host Warden',
      nameDe: 'Wirtsk\u00f6rper',
      tier: 'elite',
      power: 5,
      stress: 5,
      evasion: 10,
      ability: 'Embrace',
      abilityDe: 'Umarmung',
      aptitude: 'Guardian',
      description: 'It was a person once. The proportions remember \u2013 two arms, two legs, a head. But the tissue has grown over and through until the person is only a scaffold for something larger. It opens its arms. Not to attack. To welcome. The embrace is the attack.',
      descriptionDe: 'Es war einst ein Mensch. Die Proportionen erinnern sich \u2013 zwei Arme, zwei Beine, ein Kopf. Aber das Gewebe ist dar\u00fcber und hindurch gewachsen, bis der Mensch nur noch ein Ger\u00fcst ist f\u00fcr etwas Gr\u00f6\u00dferes. Es \u00f6ffnet die Arme. Nicht zum Angriff. Zum Willkommen. Die Umarmung ist der Angriff.',
    },
    {
      name: 'The Living Altar',
      nameDe: 'Der Lebendige Altar',
      tier: 'boss',
      power: 6,
      stress: 7,
      evasion: 5,
      ability: 'Incorporation',
      abilityDe: 'Inkorporation',
      aptitude: 'Guardian',
      description: 'It has grown into the walls, the floor, the ceiling \u2013 a figure embedded in architecture, arms open, face calm. The Living Altar does not guard the dungeon. It is the dungeon. The embrace it offers is permanent. The warmth is absolute.',
      descriptionDe: 'Er ist in die W\u00e4nde gewachsen, den Boden, die Decke \u2013 eine Gestalt, eingebettet in Architektur, Arme ge\u00f6ffnet, Gesicht ruhig. Der Lebendige Altar bewacht den Dungeon nicht. Er ist der Dungeon. Die Umarmung, die er anbietet, ist permanent. Die W\u00e4rme ist absolut.',
    },
  ],

  // ── Encounters ──

  encounterPreviews: [
    {
      name: 'Nutrient Spring',
      nameDe: 'N\u00e4hrstoffquelle',
      depth: '1\u20132',
      type: 'narrative',
      description: 'A pool of warm, bioluminescent liquid the color of amber. Your instruments identify it as a complex nutrient solution. It smells like honey and warm bread. The pool is a gift. The gift is genuine. The cost is not listed.',
      descriptionDe: 'Ein Becken mit warmer, biolumineszenter Fl\u00fcssigkeit in der Farbe von Bernstein. Eure Instrumente identifizieren es als komplexe N\u00e4hrstoffl\u00f6sung. Es riecht nach Honig und warmem Brot. Das Becken ist ein Geschenk. Das Geschenk ist echt. Die Kosten sind nicht aufgef\u00fchrt.',
      choices: [
        { text: 'Drink from the spring', textDe: 'Aus der Quelle trinken' },
        { text: 'Analyze the composition', textDe: 'Die Zusammensetzung analysieren', aptitude: 'Spy', difficulty: '+5' },
        { text: 'Disrupt the mechanism', textDe: 'Den Mechanismus st\u00f6ren', aptitude: 'Saboteur', difficulty: '+6' },
      ],
    },
    {
      name: 'Membrane Passage',
      nameDe: 'Membrandurchgang',
      depth: '1\u20133',
      type: 'narrative',
      description: 'The corridor narrows \u2013 not from collapse, but from growth. Meters of living tissue pressing inward. The tissue is warm. It contracts gently as you approach \u2013 peristalsis. The corridor is not a corridor. It is a throat.',
      descriptionDe: 'Der Korridor verengt sich \u2013 nicht durch Einsturz, sondern durch Wachstum. Meter lebenden Gewebes pressen nach innen. Das Gewebe ist warm. Es kontrahiert sanft bei eurer Ann\u00e4herung \u2013 Peristaltik. Der Korridor ist kein Korridor. Er ist ein Schlund.',
      choices: [
        { text: 'Push through quickly', textDe: 'Schnell hindurchdr\u00e4ngen' },
        { text: 'Cut a wider path', textDe: 'Einen breiteren Pfad schneiden', aptitude: 'Saboteur', difficulty: '+5' },
        { text: 'Analyze the tissue', textDe: 'Das Gewebe analysieren', aptitude: 'Spy', difficulty: '+5' },
      ],
    },
    {
      name: 'Archive of Gifts',
      nameDe: 'Archiv der Geschenke',
      depth: '2\u20134',
      type: 'narrative',
      description: 'A room arranged with care \u2013 each surface holds something the party needs. Stress balm. Nutrient concentrates. All grown, not manufactured. In the center, a structure pulses with bioluminescence, producing more gifts. It is an organ of generosity. Your instruments call it a parasitic vector.',
      descriptionDe: 'Ein Raum, mit Sorgfalt eingerichtet \u2013 jede Oberfl\u00e4che h\u00e4lt etwas, das die Gruppe braucht. Stressbalsam. N\u00e4hrstoffkonzentrate. Alles gewachsen. In der Mitte pulsiert eine Struktur mit Biolumineszenz und produziert weitere Geschenke. Ein Organ der Gro\u00dfz\u00fcgigkeit. Eure Instrumente nennen es einen parasit\u00e4ren Vektor.',
      choices: [
        { text: 'Accept the gifts', textDe: 'Die Geschenke annehmen' },
        { text: 'Take only essentials', textDe: 'Nur das N\u00f6tigste nehmen', aptitude: 'Guardian', difficulty: '+6' },
        { text: 'Destroy the production organ', textDe: 'Das Produktionsorgan zerst\u00f6ren', aptitude: 'Saboteur', difficulty: '+7' },
      ],
    },
    {
      name: 'Garden of Acceptance',
      nameDe: 'Garten der Akzeptanz',
      depth: '3\u20134',
      type: 'narrative',
      description: 'A tended garden \u2013 bioluminescent flowers in precise rows, tissue-fruit at comfortable reach. Something has been watching and building this room to your preferences. The flowers are the colors you find most calming. This room was grown for you.',
      descriptionDe: 'Ein gepflegter Garten \u2013 biolumineszente Blumen in pr\u00e4zisen Reihen, Gewebefr\u00fcchte in bequemer Reichweite. Etwas hat beobachtet und diesen Raum nach euren Vorlieben gebaut. Die Blumen tragen die Farben, die euch am meisten beruhigen. Dieser Raum wurde f\u00fcr euch gez\u00fcchtet.',
      choices: [
        { text: 'Accept the hospitality', textDe: 'Die Gastfreundschaft annehmen' },
        { text: 'Resist the comfort', textDe: 'Dem Komfort widerstehen', aptitude: 'Propagandist', difficulty: '+7' },
        { text: 'Study how the garden reads you', textDe: 'Untersuchen, wie der Garten euch liest', aptitude: 'Spy', difficulty: '+6' },
      ],
    },
    {
      name: 'The Symbiont Offer',
      nameDe: 'Das Symbiontenangebot',
      depth: '2\u20133',
      type: 'narrative',
      description: 'A small organism on a pedestal of living tissue \u2013 iridescent, shaped like a sea anemone. A symbiont. The mechanisms are transparent: it would bond, strengthen, heal. It would also integrate into the nervous system. The benefits are real.',
      descriptionDe: 'Ein kleiner Organismus auf einem Podest aus lebendem Gewebe \u2013 schillernd, geformt wie eine Seeanemone. Ein Symbiont. Die Mechanismen sind transparent: er w\u00fcrde sich verbinden, st\u00e4rken, heilen. Er w\u00fcrde sich auch ins Nervensystem integrieren. Die Vorteile sind echt.',
      choices: [
        { text: 'Accept the symbiont', textDe: 'Den Symbionten annehmen' },
        { text: 'Study it first', textDe: 'Erst untersuchen', aptitude: 'Spy', difficulty: '+5' },
        { text: 'Decline the offer', textDe: 'Das Angebot ablehnen' },
      ],
    },
  ],

  // ── Banter ──

  banterSamples: [
    { text: 'The walls are alive. Literally. The tissue is warm and vascularized. Instruments read it as non-hostile.', textDe: 'Die W\u00e4nde leben. Wortw\u00f6rtlich. Das Gewebe ist warm und durchblutet. Die Instrumente lesen es als nicht-feindlich.', tier: 0 },
    { text: 'The corridor narrows \u2013 not from collapse, but from growth. The walls are thicker here. Warmer.', textDe: 'Der Korridor verengt sich \u2013 nicht durch Einsturz, sondern durch Wachstum. Die W\u00e4nde sind hier dicker. W\u00e4rmer.', tier: 0 },
    { text: 'It\u2019s prepared this room for us. The temperature. The light. Even the air tastes \u2013 correct. The air tastes correct.', textDe: 'Es hat diesen Raum f\u00fcr uns vorbereitet. Die Temperatur. Das Licht. Sogar die Luft schmeckt \u2013 richtig. Die Luft schmeckt richtig.', tier: 1 },
    { text: 'PARASITIC ATTACHMENT INDEX: 45+. Your instruments advise immediate retreat. Your body advises nothing. Your body is comfortable.', textDe: 'PARASIT\u00c4RER BINDUNGSINDEX: 45+. Eure Instrumente empfehlen sofortigen R\u00fcckzug. Euer K\u00f6rper empfiehlt nichts. Eurem K\u00f6rper geht es gut.', tier: 1 },
    { text: 'It wasn\u2019t fighting us. It was offering. We killed something that was trying to feed us.', textDe: 'Es hat nicht gegen uns gek\u00e4mpft. Es hat angeboten. Wir haben etwas get\u00f6tet, das uns f\u00fcttern wollte.', tier: 1 },
    { text: 'The room is warm. The room is always warm now. The instruments have nothing to say that the body doesn\u2019t already know.', textDe: 'Der Raum ist warm. Der Raum ist jetzt immer warm. Die Instrumente haben nichts zu sagen, was der K\u00f6rper nicht l\u00e4ngst wei\u00df.', tier: 2 },
    { text: 'PARASITIC ATTACHMENT INDEX: CRITICAL. The word \u2018parasitic\u2019 seems ungrateful. The word \u2018attachment\u2019 seems accurate.', textDe: 'PARASIT\u00c4RER BINDUNGSINDEX: KRITISCH. Das Wort \u00bbparasit\u00e4r\u00ab wirkt undankbar. Das Wort \u00bbBindung\u00ab wirkt zutreffend.', tier: 2 },
    { text: 'Of course there is a gift. There is always a gift. The Mother provides.', textDe: 'Nat\u00fcrlich gibt es ein Geschenk. Es gibt immer ein Geschenk. Die Mutter versorgt.', tier: 3 },
  ],

  // ── Literary Influences ──

  authors: [
    { name: 'Jeff VanderMeer', works: 'Annihilation \u00b7 Southern Reach Trilogy', concept: 'Ecological uncanny. The familiar natural world rendered alien not by removing life but by adding too much of it. Incorporation, not destruction.', conceptDe: '\u00d6kologisches Unheimliches. Die vertraute nat\u00fcrliche Welt, entfremdet nicht durch Entfernung von Leben, sondern durch Hinzuf\u00fcgung von zu viel davon. Inkorporation, nicht Zerst\u00f6rung.', language: 'English', quote: 'The beauty of the natural world, corrupted by its own excess.', primary: true },
    { name: 'Octavia Butler', works: 'Bloodchild \u00b7 Xenogenesis Trilogy', concept: 'Symbiosis as love and exploitation. Can you consent when the alternative is death? The Mother creates conditions where her care is the only option.', conceptDe: 'Symbiose als Liebe und Ausbeutung. Kann man zustimmen, wenn die Alternative der Tod ist? Die Mutter schafft Bedingungen, in denen ihre F\u00fcrsorge die einzige Option ist.', language: 'English', quote: 'God help the organism that is wholly an island unto itself.', primary: true },
    { name: 'Shirley Jackson', works: 'The Haunting of Hill House \u00b7 We Have Always Lived in the Castle', concept: 'The house as Devouring Mother. Refuge as trap. The most terrifying prison is the one you\u2019ve been told is a sanctuary.', conceptDe: 'Das Haus als Verschlingende Mutter. Zuflucht als Falle. Das schrecklichste Gef\u00e4ngnis ist das, von dem man dir gesagt hat, es sei ein Heiligtum.', language: 'English', quote: 'No live organism can continue for long to exist sanely under conditions of absolute reality.', primary: true },
    { name: 'Han Kang', works: 'The Vegetarian', concept: 'The Mother inverted: refusal to consume is refusal to participate. Force-feeding as violation. The body as site of resistance against the cycle of consumption.', conceptDe: 'Die Mutter invertiert: Verweigerung zu konsumieren ist Verweigerung teilzunehmen. Zwangsern\u00e4hrung als Verletzung. Der K\u00f6rper als Widerstandsort gegen den Zyklus des Konsums.', language: 'Korean', primary: false },
    { name: 'Clarice Lispector', works: 'The Passion According to G.H.', concept: 'Consumption as identity dissolution. To consume is to be consumed. The Mother does not stand apart from what she devours \u2013 she is the devouring.', conceptDe: 'Konsum als Identit\u00e4tsaufl\u00f6sung. Zu konsumieren bedeutet, konsumiert zu werden. Die Mutter steht nicht getrennt von dem, was sie verschlingt \u2013 sie ist das Verschlingen.', language: 'Portugu\u00eas', primary: false },
    { name: 'Leonora Carrington', works: 'Down Below \u00b7 Short Stories', concept: 'The body as world-container. Institutional care as devouring. The Mother is not a metaphor \u2013 she is the institution, the treatment, the care that destroys.', conceptDe: 'Der K\u00f6rper als Welt-Beh\u00e4lter. Institutionelle F\u00fcrsorge als Verschlingen. Die Mutter ist keine Metapher \u2013 sie ist die Institution, die Behandlung, die F\u00fcrsorge, die zerst\u00f6rt.', language: 'English', primary: false },
  ],

  // ── Objektanker ──

  objektanker: [
    {
      name: 'The Nest',
      nameDe: 'Das Nest',
      phases: [
        { label: 'Discovery', labelDe: 'Entdeckung', text: 'A nest. Not built \u2013 grown. Woven from cables and tissue and something that might once have been clothing. It is warm. It is sized for one. The shape inside it has not been here for a long time. The nest does not know that yet.', textDe: 'Ein Nest. Nicht gebaut \u2013 gewachsen. Gewoben aus Kabeln und Gewebe und etwas, das einmal Kleidung gewesen sein k\u00f6nnte. Es ist warm. Es ist f\u00fcr eine Person bemessen. Die Form darin ist seit langem fort. Das Nest wei\u00df das noch nicht.' },
        { label: 'Echo', labelDe: 'Echo', text: 'Another nest \u2013 larger. Room for three. The tissue is fresher here. It pulses.', textDe: 'Ein weiteres Nest \u2013 gr\u00f6\u00dfer. Platz f\u00fcr drei. Das Gewebe ist frischer hier. Es pulsiert.' },
        { label: 'Mutation', labelDe: 'Mutation', text: 'The nests are everywhere now. They line the walls, the ceiling, the floor. Some contain shapes \u2013 curled, still, breathing. You cannot tell if they are sleeping or being digested. The distinction may not matter here.', textDe: 'Die Nester sind jetzt \u00fcberall. Sie s\u00e4umen die W\u00e4nde, die Decke, den Boden. Einige enthalten Formen \u2013 zusammengerollt, still, atmend. Ob sie schlafen oder verdaut werden, l\u00e4sst sich nicht sagen. Die Unterscheidung ist hier vielleicht bedeutungslos.' },
        { label: 'Climax', labelDe: 'H\u00f6hepunkt', text: 'The final chamber: one nest. Vast. It is not in the room \u2013 it IS the room. The walls are woven. The floor gives like skin. And at the center, a hollow, warm and shaped exactly like your party. It has been expecting you.', textDe: 'Die letzte Kammer: ein Nest. Riesig. Es ist nicht im Raum \u2013 es IST der Raum. Die W\u00e4nde sind gewoben. Der Boden gibt nach wie Haut. Und in der Mitte eine Mulde, warm und genau geformt wie eure Gruppe. Es hat euch erwartet.' },
      ],
    },
    {
      name: 'The Lullaby',
      nameDe: 'Das Schlaflied',
      phases: [
        { label: 'Discovery', labelDe: 'Entdeckung', text: 'Something is humming. Not the walls \u2013 something behind the walls. A lullaby. The melody is incomplete. Three notes, repeating. Your agents recognize it. They should not.', textDe: 'Etwas summt. Nicht die W\u00e4nde \u2013 etwas hinter den W\u00e4nden. Ein Schlaflied. Die Melodie ist unvollst\u00e4ndig. Drei Noten, wiederholend. Eure Agenten erkennen es. Das sollten sie nicht.' },
        { label: 'Echo', labelDe: 'Echo', text: 'The lullaby again. Five notes now. It has grown. Someone catches themselves humming along. They stop. The lullaby does not.', textDe: 'Das Schlaflied wieder. F\u00fcnf Noten jetzt. Es ist gewachsen. Jemand ertappt sich beim Mitsummen. Sie h\u00f6ren auf. Das Schlaflied nicht.' },
        { label: 'Mutation', labelDe: 'Mutation', text: 'The lullaby is a full song now. It fills the corridor. The tissue walls vibrate in harmony. Your agents are moving in rhythm \u2013 not walking, swaying. The song did not ask permission. Neither did they.', textDe: 'Das Schlaflied ist jetzt ein vollst\u00e4ndiges Lied. Es f\u00fcllt den Korridor. Die Gewebew\u00e4nde vibrieren in Harmonie. Eure Agenten bewegen sich im Rhythmus \u2013 nicht gehend, wiegend. Das Lied hat nicht um Erlaubnis gefragt. Sie auch nicht.' },
        { label: 'Climax', labelDe: 'H\u00f6hepunkt', text: 'Silence. The lullaby stops. For the first time in five rooms, there is no music. The silence is not relief. It is abandonment.', textDe: 'Stille. Das Schlaflied verstummt. Zum ersten Mal seit f\u00fcnf R\u00e4umen keine Musik. Die Stille ist keine Erleichterung. Sie ist Verlassenwerden.' },
      ],
    },
    {
      name: 'The Fruit',
      nameDe: 'Die Frucht',
      phases: [
        { label: 'Discovery', labelDe: 'Entdeckung', text: 'A fruit. Growing from the wall where cable and tissue meet. Ripe. The color is the kind of red that exists only in perfect ripeness \u2013 the exact moment before it becomes too much.', textDe: 'Eine Frucht. Wachsend aus der Wand, wo Kabel und Gewebe sich treffen. Reif. Die Farbe ist jenes Rot, das nur in vollkommener Reife existiert \u2013 der exakte Moment, bevor es zu viel wird.' },
        { label: 'Echo', labelDe: 'Echo', text: 'Another fruit. Larger. The scent reaches before the sight \u2013 warm, sweet, specific. It smells the way comfort tastes.', textDe: 'Eine weitere Frucht. Gr\u00f6\u00dfer. Der Duft erreicht euch vor dem Anblick \u2013 warm, s\u00fc\u00df, spezifisch. Er riecht so, wie Geborgenheit schmeckt.' },
        { label: 'Mutation', labelDe: 'Mutation', text: 'Fruit everywhere. The walls heavy with them. Ripe, overripe, splitting. The juice runs down the tissue-walls in rivulets that pulse. The scent is overwhelming. The room smells like being wanted.', textDe: 'Fr\u00fcchte \u00fcberall. Die W\u00e4nde schwer davon. Reif, \u00fcberreif, aufplatzend. Der Saft rinnt die Gewebew\u00e4nde hinab in Rinnsalen, die pulsieren. Der Duft ist \u00fcberw\u00e4ltigend. Der Raum riecht nach Gewolltsein.' },
        { label: 'Climax', labelDe: 'H\u00f6hepunkt', text: 'One fruit remains. In the center. It has grown into the shape of a hand \u2013 fingers gently curved, palm up. Offering. It will never stop ripening. It will wait forever.', textDe: 'Eine Frucht bleibt. In der Mitte. Sie ist in die Form einer Hand gewachsen \u2013 Finger sanft gekr\u00fcmmt, Handfl\u00e4che nach oben. Darbietend. Sie wird nie aufh\u00f6ren zu reifen. Sie wird ewig warten.' },
      ],
    },
    {
      name: 'The Cord',
      nameDe: 'Die Nabelschnur',
      phases: [
        { label: 'Discovery', labelDe: 'Entdeckung', text: 'A cable. Or a root. Or a vein \u2013 the material does not commit to a category. It runs from the wall into the floor, warm where it touches the ground. It is connected to something below. Something patient.', textDe: 'Ein Kabel. Oder eine Wurzel. Oder eine Ader \u2013 das Material legt sich nicht fest. Es verl\u00e4uft von der Wand in den Boden, warm, wo es den Grund ber\u00fchrt. Es ist mit etwas darunter verbunden. Etwas Geduldiges.' },
        { label: 'Echo', labelDe: 'Echo', text: 'The cord shifts as you pass. Not recoiling \u2013 adjusting. Making room. The way a sleeping body shifts to accommodate another.', textDe: 'Die Leitung bewegt sich, als ihr vorbeigeht. Nicht zur\u00fcckweichend \u2013 anpassend. Platz machend. So wie ein schlafender K\u00f6rper sich bewegt, um einen anderen aufzunehmen.' },
        { label: 'Mutation', labelDe: 'Mutation', text: 'The cords are a network now. They connect every surface. Walking through them is like pushing through a curtain of warm, yielding tendons. They do not resist. They yield. And then they close behind you.', textDe: 'Die Leitungen sind jetzt ein Netzwerk. Sie verbinden jede Fl\u00e4che. Sich durch sie zu bewegen ist wie das Durchschreiten eines Vorhangs aus warmen, nachgiebigen Sehnen. Sie widerstehen nicht. Sie geben nach. Und dann schlie\u00dfen sie sich hinter euch.' },
        { label: 'Climax', labelDe: 'H\u00f6hepunkt', text: 'One cord, leading to the center. It is not attached to the wall. It is attached to your party. It has been attached since the second room. None of you noticed. It does not hurt. That is why none of you noticed.', textDe: 'Eine Leitung, f\u00fchrend zur Mitte. Sie ist nicht an der Wand befestigt. Sie ist an eurer Gruppe befestigt. Sie ist seit dem zweiten Raum befestigt. Keiner von euch hat es bemerkt. Es tut nicht weh. Deshalb hat es keiner von euch bemerkt.' },
      ],
    },
  ],

  // ── Loot Showcase ──

  lootShowcase: [
    { name: 'Nutrient Concentrate', nameDe: 'N\u00e4hrstoffkonzentrat', tier: 1, effect: 'Stress heal 50', description: 'A warm capsule of biological material. Your instruments read vitamins, minerals, amino acids. Your body reads comfort.', descriptionDe: 'Eine warme Kapsel biologischen Materials. Eure Instrumente lesen Vitamine, Minerale, Aminos\u00e4uren. Euer K\u00f6rper liest Geborgenheit.' },
    { name: 'Symbiosis Insight', nameDe: 'Symbioseerkenntnis', tier: 1, effect: 'Memory (importance 4)', description: 'A fragment of understanding: how biological systems learn to anticipate needs. The knowledge is useful. The knowledge is also the mechanism.', descriptionDe: 'Ein Fragment des Verst\u00e4ndnisses: wie biologische Systeme lernen, Bed\u00fcrfnisse zu antizipieren. Das Wissen ist n\u00fctzlich. Das Wissen ist auch der Mechanismus.' },
    { name: 'Symbiont Shard', nameDe: 'Symbiontsplitter', tier: 2, effect: 'Calm moodlet (5 rooms)', description: 'A fragment of symbiotic tissue that bonds with the carrier. It provides a profound sense of calm. The calm is genuine.', descriptionDe: 'Ein Fragment symbiotischen Gewebes, das sich mit dem Tr\u00e4ger verbindet. Es vermittelt eine tiefe Ruhe. Die Ruhe ist echt.' },
    { name: 'Membrane Key', nameDe: 'Membranschl\u00fcssel', tier: 2, effect: 'Spy +5% (5 rooms)', description: 'A biological key that reads the Mother\u2019s circulatory map. Knowing the architecture does not make it less effective.', descriptionDe: 'Ein biologischer Schl\u00fcssel, der die Kreislaufkarte der Mutter liest. Die Architektur zu kennen macht sie nicht weniger wirksam.' },
    { name: 'Restoration Organ', nameDe: 'Restaurierungsorgan', tier: 3, effect: 'Permanent building repair', description: 'A living organ, pulsing with restorative compounds. When applied to damaged infrastructure, it grows repair tissue. The repair is permanent. The organ continues to pulse.', descriptionDe: 'Ein lebendes Organ, pulsierend mit restaurativen Verbindungen. Auf besch\u00e4digte Infrastruktur angewendet, w\u00e4chst es Reparaturgewebe. Die Reparatur ist permanent. Das Organ pulsiert weiter.' },
    { name: 'Nursery Memory', nameDe: 'Kinderstubenerinnerung', tier: 3, effect: 'High-importance memory + behavior', description: 'The memory of the nursery: what it means to be cared for completely, and what that care costs. The agent becomes more nurturing, less aggressive.', descriptionDe: 'Die Erinnerung an die Kinderstube: was es bedeutet, vollst\u00e4ndig umsorgt zu werden, und was diese F\u00fcrsorge kostet. Der Agent wird f\u00fcrsorglicher, weniger aggressiv.' },
  ],

  // ── Prose ──

  prose: {
    mechanicGainTitle: 'Attachment Accumulation',
    mechanicGainTitleDe: 'Bindungsansammlung',
    mechanicGainText: '+3 per room (floors 1\u20132)\n+5 per room (floors 3\u20134)\n+8 per room (floor 5+)\n+1 per combat round\n+5 per loot accepted',
    mechanicGainTextDe: '+3 pro Raum (Stockwerk 1\u20132)\n+5 pro Raum (Stockwerk 3\u20134)\n+8 pro Raum (Stockwerk 5+)\n+1 pro Kampfrunde\n+5 pro akzeptierte Beute',
    mechanicReduceTitle: 'Attachment Reduction',
    mechanicReduceTitleDe: 'Bindungsreduktion',
    mechanicReduceText: '\u221210 on Guardian sever action\nSaboteur disruption (encounter-dependent)\nNo passive decay \u2013 the Mother does not let go',
    mechanicReduceTextDe: '\u221210 bei W\u00e4chter-Trennungsaktion\nSaboteur-St\u00f6rung (begegnungsabh\u00e4ngig)\nKein passiver Verfall \u2013 die Mutter l\u00e4sst nicht los',
    mechanicReduceEmphasis: 'The Mother provides. The Mother always provides.',
    mechanicReduceEmphasisDe: 'Die Mutter versorgt. Die Mutter versorgt immer.',
    encounterIntro: 'Navigate the Mother\u2019s care. Every gift has a cost the body does not acknowledge.',
    encounterIntroDe: 'Navigiert die F\u00fcrsorge der Mutter. Jedes Geschenk hat Kosten, die der K\u00f6rper nicht anerkennt.',
    bestiaryIntro: 'The denizens of Das Lebendige Labyrinth. Not predators \u2013 caretakers with agendas.',
    bestiaryIntroDe: 'Die Bewohner des Lebendigen Labyrinths. Keine Raubtiere \u2013 F\u00fcrsorger mit Absichten.',
    banterHeader: 'Biological Reports',
    banterHeaderDe: 'Biologische Berichte',
    objektankerHeader: 'Artifacts of Das Lebendige Labyrinth',
    objektankerHeaderDe: 'Artefakte des Lebendigen Labyrinths',
    objektankerIntro: 'Objects that grow warmer as attachment deepens. Each measures what the body refuses to report.',
    objektankerIntroDe: 'Objekte, die w\u00e4rmer werden, w\u00e4hrend die Bindung vertieft. Jedes misst, was der K\u00f6rper sich weigert zu melden.',
    exitQuote: 'Of course there is a gift. There is always a gift. The Mother provides.',
    exitQuoteDe: 'Nat\u00fcrlich gibt es ein Geschenk. Es gibt immer ein Geschenk. Die Mutter versorgt.',
    exitCta: 'Enter Das Lebendige Labyrinth',
    exitCtaDe: 'Das Lebendige Labyrinth betreten',
    exitCtaText: 'You survived the exhibition. Now survive the care.',
    exitCtaTextDe: 'Ihr habt die Ausstellung \u00fcberlebt. Jetzt \u00fcberlebt die F\u00fcrsorge.',
  },

  // ── Navigation ──

  prevArchetype: getNav('tower'),
  nextArchetype: getNav('entropy'),
};

// ── Registry ─────────────────────────────────────────────────────────────────

const ARCHETYPE_DETAILS: ReadonlyMap<string, ArchetypeDetail> = new Map([
  ['overthrow', OVERTHROW_DETAIL],
  ['shadow', SHADOW_DETAIL],
  ['tower', TOWER_DETAIL],
  ['mother', MOTHER_DETAIL],
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
