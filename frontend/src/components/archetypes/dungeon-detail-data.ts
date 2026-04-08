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
 * Overthrow, Shadow, Tower, Mother, Entropy, Prometheus, and Deluge are fully populated.
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

// ── The Entropy — Full Bilingual Content ───────────────────────────────────

const ENTROPY_DETAIL: ArchetypeDetail = {
  ...getBaseSlide('entropy'),

  // ── Lore Introduction (3 paragraphs, fresh literary prose) ──

  loreIntro: [
    'The Entropy is the fourth archetype of the Resonance Dungeons \u2013 and the quietest. Der Verfall-Garten is not a ruin. Ruins imply that something dramatic happened, that a force arrived and broke what stood. The Verfall-Garten is what happens when no force arrives at all. Surfaces approach the same colour. Temperatures converge. Distinctions between wall and floor, tool and weapon, question and answer dissolve not through violence but through the patient, thermodynamic arithmetic of equalization. The horror here is not what the garden does to you. The horror is that the garden does nothing. It merely waits for you to reach the same temperature as everything else.',
    'Decay accumulates with a quiet arithmetic that mirrors the garden itself: per room traversed, per combat round endured, per enemy hit sustained \u2013 and the hits are contagious, the entropy spreading from contact like heat from a warmer body to a cooler one. At 40, the first distinctions collapse. Banter shortens. Descriptions lose their adjectives. The language of the expedition report begins to mirror the landscape it describes. At 70, the garden\u2019s patience becomes tactical: ambush probability rises, stress compounds, loot quality degrades. At 100 \u2013 Dissolution \u2013 the party ceases to be a party. They become what the garden is: undifferentiated, averaged, ambient. The mechanic is the theme made literal: language itself decaying as the gauge fills, until the last banter entry is a single punctuation mark and the last Objektanker description is one word.',
    'The literary architecture rests on three pillars of entropy. Pynchon\u2019s thermodynamic entropy \u2013 from the short story \u201cEntropy\u201d through The Crying of Lot 49 \u2013 where the horror is not chaos but its opposite: a system at maximum entropy has maximum disorder at the micro level but absolute predictability at the macro. Everything becomes the same temperature. Beckett\u2019s linguistic entropy \u2013 from Godot through Endgame to the late prose pieces like Lessness \u2013 where each successive work has fewer characters, shorter sentences, smaller vocabulary, as if literature itself were running down. And Lem\u2019s epistemic entropy in Solaris \u2013 where the instruments function perfectly but what they measure has become meaningless, where knowledge accumulates into noise. Der Verfall-Garten inherits all three: the physical equalization, the linguistic diminishment, the cognitive futility. It is the dungeon where understanding does not help.',
  ],

  loreIntroDe: [
    'Die Entropie ist der vierte Archetyp der Resonanzdungeons \u2013 und der stillste. Der Verfall-Garten ist keine Ruine. Ruinen implizieren, dass etwas Dramatisches geschah, dass eine Kraft eintraf und zerbrach, was stand. Der Verfall-Garten ist, was geschieht, wenn keine Kraft eintrifft. Oberfl\u00e4chen n\u00e4hern sich derselben Farbe an. Temperaturen konvergieren. Unterscheidungen zwischen Wand und Boden, Werkzeug und Waffe, Frage und Antwort l\u00f6sen sich auf \u2013 nicht durch Gewalt, sondern durch die geduldige, thermodynamische Arithmetik der Angleichung. Das Grauen hier ist nicht, was der Garten euch antut. Das Grauen ist, dass der Garten nichts tut. Er wartet lediglich darauf, dass ihr dieselbe Temperatur erreicht wie alles andere.',
    'Verfall akkumuliert in einer stillen Arithmetik, die den Garten selbst spiegelt: pro durchquertem Raum, pro \u00fcberdauerter Kampfrunde, pro erlittenem Feindtreffer \u2013 und die Treffer sind ansteckend, die Entropie breitet sich durch Kontakt aus wie W\u00e4rme von einem w\u00e4rmeren K\u00f6rper zu einem k\u00fchleren. Bei 40 kollabieren die ersten Unterscheidungen. Banter verk\u00fcrzt sich. Beschreibungen verlieren ihre Adjektive. Die Sprache des Expeditionsberichts beginnt, die Landschaft zu spiegeln, die sie beschreibt. Bei 70 wird die Geduld des Gartens taktisch: Hinterhaltwahrscheinlichkeit steigt, Stress potenziert sich, Beutequalit\u00e4t sinkt. Bei 100 \u2013 Aufl\u00f6sung \u2013 h\u00f6rt die Gruppe auf, eine Gruppe zu sein. Sie werden, was der Garten ist: undifferenziert, gemittelt, ambient. Die Mechanik ist das Thema, w\u00f6rtlich gemacht: Sprache selbst verf\u00e4llt, w\u00e4hrend die Anzeige steigt, bis der letzte Banter-Eintrag ein einzelnes Satzzeichen ist und die letzte Objektanker-Beschreibung ein einziges Wort.',
    'Die literarische Architektur ruht auf drei S\u00e4ulen der Entropie. Pynchons thermodynamische Entropie \u2013 von der Kurzgeschichte \u201eEntropy\u201c \u00fcber Die Versteigerung von No. 49 \u2013 wo das Grauen nicht Chaos ist, sondern sein Gegenteil: ein System bei maximaler Entropie hat maximale Unordnung auf Mikroebene, aber absolute Vorhersagbarkeit auf Makroebene. Alles nimmt dieselbe Temperatur an. Becketts linguistische Entropie \u2013 von Godot \u00fcber Endspiel bis zu den sp\u00e4ten Prosast\u00fccken wie Lessness \u2013 wo jedes folgende Werk weniger Figuren hat, k\u00fcrzere S\u00e4tze, kleineren Wortschatz, als liefe die Literatur selbst herunter. Und Lems epistemische Entropie in Solaris \u2013 wo die Instrumente einwandfrei funktionieren, aber was sie messen, bedeutungslos geworden ist, wo Wissen sich zu Rauschen anh\u00e4uft. Der Verfall-Garten erbt alle drei: die physische Angleichung, die linguistische Verminderung, die kognitive Vergeblichkeit. Er ist der Dungeon, in dem Verstehen nicht hilft.',
  ],

  // ── Entrance Texts (5 variants, verbatim from DB seed) ──

  entranceTexts: [
    'The entrance is indistinct. Not ruined \u2013 reduced. The walls retain the memory of colour without the colour itself. The air tastes of averaged everything. Somewhere ahead, a distinction is being quietly dissolved.',
    'You enter. Or the room receives you. The distinction is already softer than it should be. The threshold is the same material as the floor. The floor is the same temperature as the air.',
    'The corridor ahead is visible. Featureless. Not stripped \u2013 equalized. Every surface approaches the same shade. The instruments confirm what the instruments measure. They do not confirm what the instruments mean.',
    'A room. Probably the first. The ordinal is already uncertain. There are walls. There is a floor. The ceiling is the same distance from both.',
    'The information here is precise. Temperature: ambient. Humidity: ambient. Threat level: ambient. Everything is ambient. That is the threat.',
  ],

  entranceTextsDe: [
    'Der Eingang ist unbestimmt. Nicht zerst\u00f6rt \u2013 reduziert. Die W\u00e4nde bewahren die Erinnerung an Farbe ohne die Farbe selbst. Die Luft schmeckt nach dem Durchschnitt von allem. Irgendwo voraus wird eine Unterscheidung leise aufgel\u00f6st.',
    'Ihr tretet ein. Oder der Raum empf\u00e4ngt euch. Die Unterscheidung ist bereits weicher, als sie sein sollte. Die Schwelle besteht aus demselben Material wie der Boden. Der Boden hat dieselbe Temperatur wie die Luft.',
    'Der Korridor voraus ist sichtbar. Merkmalslos. Nicht entbl\u00f6\u00dft \u2013 angeglichen. Jede Fl\u00e4che n\u00e4hert sich demselben Farbton. Die Instrumente best\u00e4tigen, was die Instrumente messen. Sie best\u00e4tigen nicht, was die Instrumente bedeuten.',
    'Ein Raum. Wahrscheinlich der erste. Die Ordnungszahl ist bereits unsicher. Es gibt W\u00e4nde. Es gibt einen Boden. Die Decke hat von beiden denselben Abstand.',
    'Die Informationen hier sind pr\u00e4zise. Temperatur: Umgebung. Luftfeuchtigkeit: Umgebung. Bedrohungsstufe: Umgebung. Alles ist Umgebung. Das ist die Bedrohung.',
  ],

  // ── Mechanic ──

  mechanicName: 'Decay',
  mechanicNameDe: 'Verfall',
  mechanicDescription:
    'Der Verfall-Garten\u2019s unique resonance mechanic. Decay accumulates per room, per combat round, and per enemy hit \u2013 and enemy contact is contagious, spreading equalization through the party. At 40+, ability checks degrade and the dungeon\u2019s language begins to collapse: shorter banter, fewer adjectives, descriptions averaging toward sameness. At 70+, ambush probability spikes and stress compounds. At 100, Dissolution: the party ceases to exist as a distinct entity. The mechanic is the theme: entropy does not negotiate. It equalizes.',
  mechanicDescriptionDe:
    'Die einzigartige Resonanzmechanik des Verfall-Gartens. Verfall akkumuliert pro Raum, pro Kampfrunde und pro Feindtreffer \u2013 und Feindkontakt ist ansteckend, er breitet Angleichung durch die Gruppe aus. Ab 40+ degradieren F\u00e4higkeitsproben und die Sprache des Dungeons beginnt zu kollabieren: k\u00fcrzerer Banter, weniger Adjektive, Beschreibungen, die sich der Gleichheit ann\u00e4hern. Ab 70+ steigt die Hinterhaltwahrscheinlichkeit und Stress potenziert sich. Bei 100, Aufl\u00f6sung: Die Gruppe h\u00f6rt auf, als eigenst\u00e4ndige Entit\u00e4t zu existieren. Die Mechanik ist das Thema: Entropie verhandelt nicht. Sie gleicht an.',

  mechanicGauge: {
    name: 'Decay',
    nameDe: 'Verfall',
    start: 0,
    max: 100,
    direction: 'fill',
    thresholds: [
      { value: 0, label: 'Stable', labelDe: 'Stabil', description: 'Normal operation. Full banter. Crisp descriptions.', descriptionDe: 'Normaler Betrieb. Voller Banter. Scharfe Beschreibungen.' },
      { value: 40, label: 'Degraded', labelDe: 'Degradiert', description: 'Ability checks \u22122% per 10 decay above 40. Banter shortens. Descriptions lose adjectives.', descriptionDe: 'F\u00e4higkeitsproben \u22122% pro 10 Verfall \u00fcber 40. Banter verk\u00fcrzt sich. Beschreibungen verlieren Adjektive.' },
      { value: 70, label: 'Critical', labelDe: 'Kritisch', description: '30% ambush. Stress \u00d71.25. Loot tier downgrade. Banter fragmentary.', descriptionDe: '30% Hinterhalt. Stress \u00d71,25. Beute-Stufenabzug. Banter fragmentarisch.' },
      { value: 100, label: 'Dissolution', labelDe: 'Aufl\u00f6sung', description: 'Total dissolution. Party dissolves. Equivalent to wipe.', descriptionDe: 'Vollst\u00e4ndige Aufl\u00f6sung. Gruppe l\u00f6st sich auf. Entspricht Niederlage.' },
    ],
  },

  mechanicGaugePreviewValue: 42,

  aptitudeWeights: {
    Guardian: 30,
    Spy: 20,
    Saboteur: 20,
    Propagandist: 15,
    Assassin: 8,
    Infiltrator: 7,
  },

  roomDistribution: {
    Combat: 30,
    Encounter: 35,
    Elite: 5,
    Rest: 10,
    Treasure: 15,
    Exit: 5,
  },

  // ── Enemies ──

  enemies: [
    {
      name: 'Rust Phantom', nameDe: 'Rostphantom',
      tier: 'minion', power: 2, stress: 4, evasion: 35,
      ability: 'Corrode', abilityDe: 'Korrodieren', aptitude: 'Infiltrator',
      description: 'A shape that was something once. Now it is mostly the color of rust and the sound of metal thinning. It does not approach \u2013 it persists.',
      descriptionDe: 'Eine Form, die einst etwas war. Nun ist sie haupts\u00e4chlich die Farbe von Rost und das Ger\u00e4usch von d\u00fcnner werdendem Metall. Sie n\u00e4hert sich nicht \u2013 sie verharrt.',
    },
    {
      name: 'Fade Echo', nameDe: 'Verblassecho',
      tier: 'standard', power: 2, stress: 6, evasion: 20,
      ability: 'Diminish', abilityDe: 'Vermindern', aptitude: 'Propagandist',
      description: 'A sound that is almost a voice. A shape that is almost a figure. It repeats something that was once important. The repetition has worn the meaning away.',
      descriptionDe: 'Ein Klang, der beinahe eine Stimme ist. Eine Gestalt, die beinahe eine Figur ist. Es wiederholt etwas, das einst wichtig war. Die Wiederholung hat die Bedeutung abgetragen.',
    },
    {
      name: 'Dissolution Swarm', nameDe: 'Aufl\u00f6sungsschwarm',
      tier: 'elite', power: 4, stress: 3, evasion: 15,
      ability: 'Scatter', abilityDe: 'Zerstreuen', aptitude: 'Saboteur',
      description: 'A cloud of particles that were once a wall, a floor, a ceiling. Now they are nothing in particular, and they move with the purposelessness of dust in a closed room.',
      descriptionDe: 'Eine Wolke aus Partikeln, die einst eine Wand waren, ein Boden, eine Decke. Nun sind sie nichts Bestimmtes, und sie bewegen sich mit der Ziellosigkeit von Staub in einem geschlossenen Raum.',
    },
    {
      name: 'Entropy Warden', nameDe: 'Entropiew\u00e4chter',
      tier: 'boss', power: 6, stress: 4, evasion: 10,
      ability: 'Entropy Pulse', abilityDe: 'Entropiepuls', aptitude: 'Guardian',
      description: 'It was a guardian once. The armor remembers. The purpose does not. It stands where it has always stood, performing the motions of protection over nothing. When it notices you, the motions do not change. You have simply become part of what it protects. Or what it dissolves. There is no longer a difference.',
      descriptionDe: 'Es war einst ein W\u00e4chter. Die R\u00fcstung erinnert sich. Der Zweck nicht. Es steht, wo es immer gestanden hat, und vollzieht die Gesten des Schutzes \u00fcber das Nichts. Als es euch bemerkt, \u00e4ndern sich die Gesten nicht. Ihr seid einfach Teil dessen geworden, was es besch\u00fctzt. Oder was es aufl\u00f6st. Es gibt keinen Unterschied mehr.',
    },
  ],

  // ── Encounters ──

  encounterPreviews: [
    {
      name: 'The Catalogue of Former Things', nameDe: 'Der Katalog ehemaliger Dinge',
      depth: '1\u20132', type: 'narrative',
      description: 'A room lined with shelves. Each shelf holds objects that were once distinct: a tool, a weapon, a musical instrument, a compass. They are becoming the same object. The labels remain, but the labels are wrong now. Or the objects are. It is increasingly difficult to tell.',
      descriptionDe: 'Ein Raum voller Regale. Jedes Regal enth\u00e4lt Gegenst\u00e4nde, die einst verschieden waren: ein Werkzeug, eine Waffe, ein Musikinstrument, ein Kompass. Sie werden zum selben Gegenstand. Die Beschriftungen bleiben, aber die Beschriftungen stimmen nicht mehr. Oder die Gegenst\u00e4nde nicht. Es wird zunehmend schwieriger, das zu unterscheiden.',
      choices: [
        { text: 'Preserve the most distinct object', textDe: 'Den unterscheidbarsten Gegenstand bewahren', aptitude: 'Guardian', difficulty: '+5' },
        { text: 'Study the dissolution pattern', textDe: 'Das Aufl\u00f6sungsmuster untersuchen', aptitude: 'Spy', difficulty: '+5' },
        { text: 'Redirect the decay outward', textDe: 'Den Verfall nach au\u00dfen umlenken', aptitude: 'Saboteur', difficulty: '+6' },
      ],
    },
    {
      name: 'The Repeated Room', nameDe: 'Der wiederholte Raum',
      depth: '2\u20133', type: 'narrative',
      description: 'You have been here before. Or the room has become identical to one you have been in. The distinction matters less than it should. The walls bear marks that might be yours. The marks bear messages that might be from you. The messages say: we have been here before.',
      descriptionDe: 'Ihr seid schon einmal hier gewesen. Oder der Raum ist identisch mit einem geworden, in dem ihr wart. Die Unterscheidung ist weniger wichtig, als sie sein sollte. Die W\u00e4nde tragen Markierungen, die von euch sein k\u00f6nnten. Die Markierungen tragen Botschaften, die von euch stammen k\u00f6nnten. Die Botschaften sagen: Wir sind schon einmal hier gewesen.',
      choices: [
        { text: 'Investigate the difference', textDe: 'Den Unterschied untersuchen', aptitude: 'Spy', difficulty: '+6' },
        { text: 'Fortify this room\u2019s identity', textDe: 'Die Identit\u00e4t dieses Raums festigen', aptitude: 'Guardian', difficulty: '+5' },
        { text: 'Accept the sameness. Move on.', textDe: 'Die Gleichheit akzeptieren. Weitergehen.' },
      ],
    },
    {
      name: 'The Last Machine', nameDe: 'Die letzte Maschine',
      depth: '2\u20133', type: 'narrative',
      description: 'A machine. It performs a function \u2013 gears turning, pistons cycling, readouts flickering. It performs this function with absolute dedication. The function itself has decayed. The machine no longer knows what it makes or measures or protects. It continues anyway. The dedication is the last thing to go.',
      descriptionDe: 'Eine Maschine. Sie erf\u00fcllt eine Funktion \u2013 Zahnr\u00e4der drehen, Kolben arbeiten, Anzeigen flackern. Sie erf\u00fcllt diese Funktion mit absoluter Hingabe. Die Funktion selbst ist verfallen. Die Maschine wei\u00df nicht mehr, was sie herstellt oder misst oder sch\u00fctzt. Sie macht trotzdem weiter. Die Hingabe ist das Letzte, das schwindet.',
      choices: [
        { text: 'Repair the function, not just the machine', textDe: 'Die Funktion reparieren, nicht nur die Maschine', aptitude: 'Saboteur', difficulty: '+7' },
        { text: 'Study the original design', textDe: 'Das urspr\u00fcngliche Design studieren', aptitude: 'Spy', difficulty: '+5' },
        { text: 'Let it work. It has earned that.', textDe: 'Sie arbeiten lassen. Das hat sie sich verdient.' },
      ],
    },
    {
      name: 'The Residual', nameDe: 'Das Residual',
      depth: '3\u20134', type: 'narrative',
      description: 'An entity sits in the center of the room. It was an agent once \u2013 the posture is there, the proportions are correct, the hands are folded as if waiting for instructions. But the face has averaged. The features have equalized into a composite of every face it once knew. It asks you a question. The question no longer has content. Only the grammar of asking remains.',
      descriptionDe: 'Ein Wesen sitzt in der Mitte des Raums. Es war einst ein Agent \u2013 die Haltung stimmt, die Proportionen sind korrekt, die H\u00e4nde gefaltet, als wartete es auf Anweisungen. Aber das Gesicht hat sich gemittelt. Die Z\u00fcge haben sich zu einem Komposit jedes Gesichts angeglichen, das es einst kannte. Es stellt euch eine Frage. Die Frage hat keinen Inhalt mehr. Nur die Grammatik des Fragens besteht noch.',
      choices: [
        { text: 'Answer with meaning', textDe: 'Mit Bedeutung antworten', aptitude: 'Propagandist', difficulty: '+6' },
        { text: 'Decode the original question', textDe: 'Die urspr\u00fcngliche Frage entschl\u00fcsseln', aptitude: 'Spy', difficulty: '+7' },
        { text: 'Sit with it in silence.', textDe: 'In Stille bei ihm sitzen.' },
      ],
    },
    {
      name: 'The Temperature', nameDe: 'Die Temperatur',
      depth: '3\u20134', type: 'narrative',
      description: 'The temperature. You notice it because you stop noticing it. The air is the same temperature as your skin. The walls are the same temperature as the air. Your instruments confirm: all thermal gradients in this room have resolved. There is no hot. There is no cold. There is only the temperature at which difference ceases to register.',
      descriptionDe: 'Die Temperatur. Ihr bemerkt sie, weil ihr aufh\u00f6rt, sie zu bemerken. Die Luft hat die gleiche Temperatur wie eure Haut. Die W\u00e4nde haben die gleiche Temperatur wie die Luft. Eure Instrumente best\u00e4tigen: Alle thermischen Gradienten in diesem Raum haben sich aufgel\u00f6st. Es gibt kein Warm. Es gibt kein Kalt. Es gibt nur die Temperatur, bei der Unterschied aufh\u00f6rt, sich zu registrieren.',
      choices: [
        { text: 'Preserve the gradient', textDe: 'Den Gradienten bewahren', aptitude: 'Guardian', difficulty: '+6' },
        { text: 'Accept the equilibrium.', textDe: 'Das Gleichgewicht akzeptieren.' },
      ],
    },
  ],

  // ── Banter (4-tier Beckett degradation) ──

  banterSamples: [
    { text: 'The corridor was here yesterday. Today it is mostly here. The distinction is the first thing to go.', textDe: 'Der Korridor war gestern hier. Heute ist er gr\u00f6\u00dftenteils hier. Die Unterscheidung ist das Erste, das schwindet.', tier: 0 },
    { text: 'It stopped. Not because we won. Because it ran out of reasons to continue.', textDe: 'Es hat aufgeh\u00f6rt. Nicht weil wir gewonnen haben. Weil ihm die Gr\u00fcnde ausgingen weiterzumachen.', tier: 0 },
    { text: 'Deeper. The word implies a direction. Direction implies difference. The difference is becoming theoretical.', textDe: 'Tiefer. Das Wort impliziert eine Richtung. Richtung impliziert Unterschied. Der Unterschied wird theoretisch.', tier: 0 },
    { text: 'Room. Another one.', textDe: 'Raum. Noch einer.', tier: 1 },
    { text: 'The decay counter passes 40. Somewhere, a distinction that existed no longer does.', textDe: 'Der Verfallsz\u00e4hler \u00fcberschreitet 40. Irgendwo existiert eine Unterscheidung nicht mehr, die es gab.', tier: 1 },
    { text: 'Room. Walls.', textDe: 'Raum. W\u00e4nde.', tier: 2 },
    { text: 'DISSOLUTION INDEX: CRITICAL. The instruments still function. The readings have converged.', textDe: 'AUFL\u00d6SUNGSINDEX: KRITISCH. Die Instrumente funktionieren noch. Die Werte sind konvergiert.', tier: 2 },
    { text: '.', textDe: '.', tier: 3 },
  ],

  // ── Literary Influences ──

  authors: [
    { name: 'Thomas Pynchon', works: 'Entropy \u00b7 The Crying of Lot 49', concept: 'Thermodynamic and informational entropy as the same phenomenon. A system at maximum entropy has maximum disorder at micro level but maximum predictability at macro level. Everything becomes the same temperature. All differences dissolve.', conceptDe: 'Thermodynamische und informationelle Entropie als dasselbe Ph\u00e4nomen. Ein System bei maximaler Entropie hat maximale Unordnung auf Mikroebene, aber maximale Vorhersagbarkeit auf Makroebene. Alles nimmt dieselbe Temperatur an. Alle Unterschiede l\u00f6sen sich auf.', language: 'English', quote: 'A tonic of darkness and the final absence of all motion.', primary: true },
    { name: 'Samuel Beckett', works: 'Endgame \u00b7 Waiting for Godot \u00b7 Lessness', concept: 'Language itself wearing out. Each work has fewer characters, shorter sentences, smaller vocabulary. The catastrophe is behind them. Dialogue shrinks, hope evaporates through simple thermodynamic inevitability.', conceptDe: 'Sprache selbst nutzt sich ab. Jedes Werk hat weniger Figuren, k\u00fcrzere S\u00e4tze, kleineren Wortschatz. Die Katastrophe liegt hinter ihnen. Dialog schrumpft, Hoffnung verdunstet durch einfache thermodynamische Unvermeidlichkeit.', language: 'English / Fran\u00e7ais', quote: 'Something is taking its course.', primary: true },
    { name: 'Stanis\u0142aw Lem', works: 'Solaris', concept: 'Epistemic entropy \u2013 knowledge accumulating into noise. Taxonomic exhaustion: more classification means less understanding. Instruments work, but what they measure becomes meaningless.', conceptDe: 'Epistemische Entropie \u2013 Wissen, das sich zu Rauschen anh\u00e4uft. Taxonomische Ersch\u00f6pfung: mehr Klassifikation bedeutet weniger Verst\u00e4ndnis. Instrumente funktionieren, aber was sie messen, wird bedeutungslos.', language: 'Polish', quote: 'We have no need of other worlds. We need mirrors.', primary: true },
    { name: 'J.G. Ballard', works: 'The Crystal World', concept: 'Crystallization as aesthetic entropy \u2013 beauty as stasis, the elimination of time. Beauty that seduces toward surrender.', conceptDe: 'Kristallisation als \u00e4sthetische Entropie \u2013 Sch\u00f6nheit als Stillstand, die Eliminierung der Zeit. Sch\u00f6nheit, die zur Kapitulation verf\u00fchrt.', language: 'English', quote: 'Jeweled crocodiles glitter like heraldic salamanders.', primary: false },
    { name: 'Jorge Luis Borges', works: 'Tl\u00f6n, Uqbar, Orbis Tertius', concept: 'Ontological entropy \u2013 reality dissolving under weight of better-organized fiction. The map replaces the territory.', conceptDe: 'Ontologische Entropie \u2013 Realit\u00e4t, die sich unter dem Gewicht besser organisierter Fiktion aufl\u00f6st. Die Karte ersetzt das Territorium.', language: 'Espa\u00f1ol', quote: 'Reality yielded\u2026 it longed to yield.', primary: false },
    { name: 'Italo Calvino', works: 'If on a winter\u2019s night a traveler', concept: 'Narrative entropy \u2013 stories that cannot complete themselves. Each beginning decays into another beginning. The reader is the last distinction that holds.', conceptDe: 'Narrative Entropie \u2013 Geschichten, die sich nicht vollenden k\u00f6nnen. Jeder Anfang verf\u00e4llt in einen anderen Anfang. Der Leser ist die letzte Unterscheidung, die h\u00e4lt.', language: 'Italiano', primary: false },
  ],

  // ── Objektanker (Beckett decay: each phase shorter than the last) ──

  objektanker: [
    {
      name: 'The Clock', nameDe: 'Die Uhr',
      phases: [
        { label: 'Discovery', labelDe: 'Entdeckung', text: 'A clock. No hands. The face is intact \u2013 numbers present, glass uncracked. But the mechanism has been removed with surgical precision. Not broken. Emptied. The clock does not tell time. Time does not apply here.', textDe: 'Eine Uhr. Keine Zeiger. Das Zifferblatt ist intakt \u2013 Zahlen vorhanden, Glas unversehrt. Aber das Uhrwerk wurde mit chirurgischer Pr\u00e4zision entfernt. Nicht zerbrochen. Entleert. Die Uhr zeigt keine Zeit. Zeit gilt hier nicht.' },
        { label: 'Echo', labelDe: 'Echo', text: 'The clock again. Or a clock. They are becoming difficult to distinguish.', textDe: 'Die Uhr wieder. Oder eine Uhr. Sie werden schwer zu unterscheiden.' },
        { label: 'Mutation', labelDe: 'Mutation', text: 'Clocks. Faces. No hands. Same.', textDe: 'Uhren. Zifferbl\u00e4tter. Keine Zeiger. Gleich.' },
        { label: 'Climax', labelDe: 'H\u00f6hepunkt', text: 'Clock.', textDe: 'Uhr.' },
      ],
    },
    {
      name: 'The Word', nameDe: 'Das Wort',
      phases: [
        { label: 'Discovery', labelDe: 'Entdeckung', text: 'On the wall, etched in something that was once a distinct material: \u201cREMEMBER.\u201d The letters are precise. The word is clear. The medium is already uncertain.', textDe: 'An der Wand, geritzt in etwas, das einmal ein bestimmtes Material war: \u00bbERINNERN.\u00ab Die Buchstaben sind pr\u00e4zise. Das Wort ist klar. Das Medium ist bereits unsicher.' },
        { label: 'Echo', labelDe: 'Echo', text: 'The wall reads: \u201cRMMBER.\u201d Same etching. The vowels have equalized into the surrounding stone.', textDe: 'Die Wand liest: \u00bbERNNRN.\u00ab Dieselbe Ritzung. Die Vokale haben sich in den umgebenden Stein angeglichen.' },
        { label: 'Mutation', labelDe: 'Mutation', text: 'Scratches. Were they letters? The wall is the same texture as the scratches. The message is the medium. The medium is the wall. The wall is grey.', textDe: 'Kratzer. Waren es Buchstaben? Die Wand hat dieselbe Textur wie die Kratzer. Die Nachricht ist das Medium. Das Medium ist die Wand. Die Wand ist grau.' },
        { label: 'Climax', labelDe: 'H\u00f6hepunkt', text: 'Wall.', textDe: 'Wand.' },
      ],
    },
    {
      name: 'The Mirror', nameDe: 'Der Spiegel',
      phases: [
        { label: 'Discovery', labelDe: 'Entdeckung', text: 'A mirror. Your reflection is sharp. Detailed. Every line, every shadow, every distinction between you and the background. It remembers what you look like. For now.', textDe: 'Ein Spiegel. Euer Spiegelbild ist scharf. Detailliert. Jede Linie, jeder Schatten, jede Unterscheidung zwischen euch und dem Hintergrund. Er erinnert sich, wie ihr aussieht. Noch.' },
        { label: 'Echo', labelDe: 'Echo', text: 'The reflection is softer. The edges between figure and background are negotiating. The mirror is losing its opinion about what is what.', textDe: 'Das Spiegelbild ist weicher. Die Kanten zwischen Gestalt und Hintergrund verhandeln. Der Spiegel verliert seine Meinung dar\u00fcber, was was ist.' },
        { label: 'Mutation', labelDe: 'Mutation', text: 'Mirror. Surface. Grey. It reflects the room. It reflects you. There is no difference.', textDe: 'Spiegel. Fl\u00e4che. Grau. Er reflektiert den Raum. Er reflektiert euch. Es gibt keinen Unterschied.' },
        { label: 'Climax', labelDe: 'H\u00f6hepunkt', text: 'Same.', textDe: 'Gleich.' },
      ],
    },
    {
      name: 'The Compass', nameDe: 'Der Kompass',
      phases: [
        { label: 'Discovery', labelDe: 'Entdeckung', text: 'A compass. The needle points north. North is a direction. North is a distinction. The glass is clean. The markings are crisp. Someone still believes in orientation.', textDe: 'Ein Kompass. Die Nadel zeigt nach Norden. Norden ist eine Richtung. Norden ist eine Unterscheidung. Das Glas ist sauber. Die Markierungen sind scharf. Jemand glaubt noch an Orientierung.' },
        { label: 'Echo', labelDe: 'Echo', text: 'The needle spins slowly. Not searching \u2013 surrendering. North, east, south, west. All the same distance from here.', textDe: 'Die Nadel dreht sich langsam. Nicht suchend \u2013 aufgebend. Norden, Osten, S\u00fcden, Westen. Alle gleich weit von hier.' },
        { label: 'Mutation', labelDe: 'Mutation', text: 'Compass. Needle still. Not pointing. Not spinning. The markings have faded into the dial.', textDe: 'Kompass. Nadel still. Nicht zeigend. Nicht drehend. Die Markierungen sind ins Zifferblatt verblasst.' },
        { label: 'Climax', labelDe: 'H\u00f6hepunkt', text: 'Circle.', textDe: 'Kreis.' },
      ],
    },
  ],

  // ── Loot Showcase ──

  lootShowcase: [
    { name: 'Entropy Residue', nameDe: 'Entropier\u00fcckstand', tier: 1, effect: 'Stress heal 50', description: 'Crystallized sameness. Holding it removes the anxiety of distinction. That should worry you.', descriptionDe: 'Kristallisierte Gleichheit. Sie zu halten nimmt die Angst der Unterscheidung. Das sollte euch beunruhigen.' },
    { name: 'Dissolution Insight', nameDe: 'Aufl\u00f6sungserkenntnis', tier: 1, effect: 'Memory (importance 4)', description: 'A fragment of understanding: how systems equalize, and why equalization is the default.', descriptionDe: 'Ein Fragment des Verst\u00e4ndnisses: wie Systeme sich angleichen und warum Angleichung der Normalzustand ist.' },
    { name: 'Entropy Attunement Shard', nameDe: 'Entropieeinstimmungssplitter', tier: 2, effect: 'Calm moodlet (permanent)', description: 'A shard that attunes the carrier to equalization. Profound calm in the face of sameness. The calm is the mechanism.', descriptionDe: 'Ein Splitter, der den Tr\u00e4ger auf Angleichung einstimmt. Tiefe Gelassenheit angesichts der Gleichheit. Die Gelassenheit ist der Mechanismus.' },
    { name: 'Preservation Lens', nameDe: 'Bewahrungslinse', tier: 2, effect: 'Guardian +1 (Entropy dungeons)', description: 'A lens that reads dissolution patterns. Permanent +1 Guardian aptitude in all future Entropy dungeons. Knowing the pattern does not make it less effective.', descriptionDe: 'Eine Linse, die Aufl\u00f6sungsmuster liest. Permanent +1 W\u00e4chter-Eignung in allen zuk\u00fcnftigen Entropie-Dungeons. Das Muster zu kennen macht es nicht weniger wirksam.' },
    { name: 'Restoration Fragment', nameDe: 'Restaurierungsfragment', tier: 3, effect: 'Permanent building repair', description: 'Improves one building\u2019s condition by one tier. Salvaged from the Verfall-Garten \u2013 proof that entropy can be reversed, once, at great cost.', descriptionDe: 'Verbessert den Zustand eines Geb\u00e4udes um eine Stufe. Geborgen aus dem Verfall-Garten \u2013 Beweis, dass Entropie umkehrbar ist, einmal, unter gro\u00dfen Kosten.' },
    { name: 'Garden Memory', nameDe: 'Gartenerinnerung', tier: 3, effect: 'High-importance memory + behavior', description: 'The memory of the garden: what it means to witness equalization, and what that witnessing costs. The agent becomes more patient, less impulsive.', descriptionDe: 'Die Erinnerung an den Garten: was es bedeutet, Angleichung zu bezeugen, und was dieses Bezeugen kostet. Der Agent wird geduldiger, weniger impulsiv.' },
  ],

  // ── Prose ──

  prose: {
    mechanicGainTitle: 'Decay Accumulation',
    mechanicGainTitleDe: 'Verfallsakkumulation',
    mechanicGainText: '+4 per room (depth 1\u20132)\n+7 per room (depth 3\u20134)\n+2 per combat round\n+3 per enemy hit (contagious)\n+5 on failed check',
    mechanicGainTextDe: '+4 pro Raum (Tiefe 1\u20132)\n+7 pro Raum (Tiefe 3\u20134)\n+2 pro Kampfrunde\n+3 pro Feindtreffer (ansteckend)\n+5 bei fehlgeschlagener Probe',
    mechanicReduceTitle: 'Decay Reduction',
    mechanicReduceTitleDe: 'Verfallsreduktion',
    mechanicReduceText: '\u22123 on combat victory\n\u22125 on treasure room\n\u22128 on Guardian Preserve action\n\u22125 on rest',
    mechanicReduceTextDe: '\u22123 bei Kampfsieg\n\u22125 bei Schatzkammer\n\u22128 bei W\u00e4chter-Bewahrung\n\u22125 bei Rast',
    mechanicReduceEmphasis: 'Entropy does not negotiate. It equalizes.',
    mechanicReduceEmphasisDe: 'Entropie verhandelt nicht. Sie gleicht an.',
    encounterIntro: 'Navigate the equalization. Every choice costs distinction.',
    encounterIntroDe: 'Navigiert die Angleichung. Jede Entscheidung kostet Unterscheidung.',
    bestiaryIntro: 'The denizens of Der Verfall-Garten. Not enemies \u2013 residual patterns of former threat.',
    bestiaryIntroDe: 'Die Bewohner des Verfall-Gartens. Keine Feinde \u2013 residuale Muster einstiger Bedrohung.',
    banterHeader: 'Overheard in the Verfall-Garten',
    banterHeaderDe: 'Belauscht im Verfall-Garten',
    objektankerHeader: 'Artifacts of Der Verfall-Garten',
    objektankerHeaderDe: 'Artefakte des Verfall-Gartens',
    objektankerIntro: 'Objects that decay as dissolution accumulates. Each phase shorter than the last \u2013 the object is becoming the same as everything else.',
    objektankerIntroDe: 'Objekte, die verfallen, w\u00e4hrend die Aufl\u00f6sung voranschreitet. Jede Phase k\u00fcrzer als die letzte \u2013 der Gegenstand wird zu dem, was alles andere auch ist.',
    exitQuote: 'You leave. The garden remains. It is very patient. It has nothing but time. And less and less of everything else.',
    exitQuoteDe: 'Ihr geht. Der Garten bleibt. Er ist sehr geduldig. Er hat nichts als Zeit. Und immer weniger von allem anderen.',
    exitCta: 'Enter Der Verfall-Garten',
    exitCtaDe: 'Den Verfall-Garten betreten',
    exitCtaText: 'You survived the exhibition. Now survive the equalization.',
    exitCtaTextDe: 'Ihr habt die Ausstellung \u00fcberlebt. Jetzt \u00fcberlebt die Angleichung.',
  },

  // ── Navigation ──

  prevArchetype: getNav('mother'),
  nextArchetype: getNav('prometheus'),
};

// ── The Prometheus — Full Bilingual Content ─────────────────────────────────

const PROMETHEUS_DETAIL: ArchetypeDetail = {
  ...getBaseSlide('prometheus'),

  // ── Lore Introduction (3 paragraphs, fresh literary prose) ──

  loreIntro: [
    'The Prometheus is the fifth archetype of the Resonance Dungeons \u2013 and the most dangerous in its generosity. Die Werkstatt der G\u00f6tter is not a laboratory. Laboratories imply hypothesis, control groups, the possibility of a negative result. The Workshop of the Gods builds. It has always been building. The walls are warm not from heating but from process \u2013 the sustained thermal output of creation that has never paused to ask whether it should. Workbenches line every corridor in arrangements that suggest not storage but invitation. Components sort themselves by an affinity the party cannot name but can feel in their hands. The horror here is not failure. Every workshop knows failure. The horror is success \u2013 and what success demands in return. The fire that forges the blade also forges the hand that holds it. The fire does not distinguish.',
    'Insight accumulates with the quiet relentlessness of heat in a closed forge: per room traversed, per combat victory claimed, per crafting attempt \u2013 even failures teach, and the Workshop charges tuition for every lesson. At 45, the first transformation: components develop preferences, combinations reveal hidden synergies, craft bonuses climb by 15%. The party begins to see connections that were invisible a moment ago. At 75, Feverish \u2013 the insight becomes indistinguishable from obsession. Craft bonus +30%, but stress multiplies \u00d71.25 and ambush probability rises to 15%. The fire is generous and hungry in equal measure. At 100, Breakthrough: legendary crafts become possible, impossible alloys yield to impossible hands. But stress multiplies \u00d72.0 and ambush probability reaches 30%. Every masterwork extracts its price. The mechanic is the pharmakon made literal: every gift is also a poison, every illumination also a burning. Prometheus did not steal fire. He was consumed by the act of giving it.',
    'The literary architecture rests on four pillars of creation. Shelley\u2019s Frankenstein \u2013 where the creature surpasses the maker, where the ecstasy of \u201cI had desired it with an ardour that far exceeded moderation\u201d becomes the horror of abandonment, where Prometheus unbound becomes Prometheus horrified at what his fire has made. Bruno Schulz\u2019s Treatise on Tailors\u2019 Dummies \u2013 where matter itself has agency, dreams, ambitions, where the demiurge\u2019s joy is not in imposing form on chaos but in negotiating with material that knows what it wants to become. Lem\u2019s Cyberiad \u2013 where Trurl and Klapaucius build universes with the confidence of craftsmen and the carelessness of gods, where every perfect construction contains its own ironic undoing. And Bachelard\u2019s Psychoanalysis of Fire \u2013 the Prometheus Complex itself: fire-reverie as the deepest human drive, the desire to change the world by changing matter, the knowledge that the first teacher was a flame. Die Werkstatt der G\u00f6tter inherits all four: the hubris, the ecstasy, the irony, the fire.',
  ],

  loreIntroDe: [
    'Der Prometheus ist der f\u00fcnfte Archetyp der Resonanzdungeons \u2013 und der gef\u00e4hrlichste in seiner Gro\u00dfz\u00fcgigkeit. Die Werkstatt der G\u00f6tter ist kein Laboratorium. Laboratorien implizieren Hypothese, Kontrollgruppen, die M\u00f6glichkeit eines negativen Ergebnisses. Die Werkstatt der G\u00f6tter baut. Sie hat immer gebaut. Die W\u00e4nde sind warm, nicht von Heizung, sondern von Prozess \u2013 der anhaltende thermische Aussto\u00df einer Sch\u00f6pfung, die nie innegehalten hat, um zu fragen, ob sie sollte. Werkb\u00e4nke s\u00e4umen jeden Korridor in Anordnungen, die nicht Lagerung, sondern Einladung suggerieren. Komponenten sortieren sich nach einer Affinit\u00e4t, die der Trupp nicht benennen kann, aber in den H\u00e4nden sp\u00fcrt. Das Grauen hier ist nicht Scheitern. Jede Werkstatt kennt Scheitern. Das Grauen ist Erfolg \u2013 und was Erfolg als Gegenleistung fordert. Das Feuer, das die Klinge schmiedet, schmiedet auch die Hand, die sie h\u00e4lt. Das Feuer unterscheidet nicht.',
    'Einsicht akkumuliert mit der stillen Unerbittlichkeit von Hitze in einer geschlossenen Schmiede: pro durchquertem Raum, pro errungenem Kampfsieg, pro Handwerksversuch \u2013 selbst Scheitern lehrt, und die Werkstatt verlangt Lehrgeld f\u00fcr jede Lektion. Bei 45 die erste Transformation: Komponenten entwickeln Pr\u00e4ferenzen, Kombinationen enth\u00fcllen verborgene Synergien, Handwerksboni steigen um 15%. Der Trupp beginnt, Verbindungen zu sehen, die vor einem Moment noch unsichtbar waren. Bei 75, Fieberhaft \u2013 die Einsicht wird ununterscheidbar von Obsession. Handwerksbonus +30%, aber Stress multipliziert sich \u00d71,25 und Hinterhaltwahrscheinlichkeit steigt auf 15%. Das Feuer ist gro\u00dfz\u00fcgig und hungrig zu gleichen Teilen. Bei 100, Durchbruch: legend\u00e4re Handwerke werden m\u00f6glich, unm\u00f6gliche Legierungen weichen unm\u00f6glichen H\u00e4nden. Aber Stress multipliziert sich \u00d72,0 und Hinterhaltwahrscheinlichkeit erreicht 30%. Jedes Meisterwerk fordert seinen Preis. Die Mechanik ist das Pharmakon, w\u00f6rtlich gemacht: jedes Geschenk ist auch ein Gift, jede Erleuchtung auch ein Verbrennen. Prometheus stahl nicht das Feuer. Er wurde vom Akt des Gebens verzehrt.',
    'Die literarische Architektur ruht auf vier S\u00e4ulen der Sch\u00f6pfung. Shelleys Frankenstein \u2013 wo die Kreatur den Sch\u00f6pfer \u00fcbertrifft, wo die Ekstase des \u201eI had desired it with an ardour that far exceeded moderation\u201c zum Grauen der Verlassenheit wird, wo der entfesselte Prometheus zum entsetzten Prometheus wird angesichts dessen, was sein Feuer geschaffen hat. Bruno Schulz\u2019 Traktat \u00fcber die Schneiderpuppen \u2013 wo Materie selbst Handlungsf\u00e4higkeit besitzt, Tr\u00e4ume, Ambitionen, wo die Freude des Demiurgen nicht darin liegt, dem Chaos Form aufzuzwingen, sondern mit Material zu verhandeln, das wei\u00df, was es werden will. Lems Kyberiade \u2013 wo Trurl und Klapaucius Universen bauen mit der Zuversicht von Handwerkern und der Sorglosigkeit von G\u00f6ttern, wo jede vollkommene Konstruktion ihre eigene ironische Aufl\u00f6sung enth\u00e4lt. Und Bachelards Psychoanalyse des Feuers \u2013 der Prometheus-Komplex selbst: Feuer-Tr\u00e4umerei als tiefster menschlicher Trieb, der Wunsch, die Welt zu ver\u00e4ndern, indem man die Materie ver\u00e4ndert, das Wissen, dass der erste Lehrer eine Flamme war. Die Werkstatt der G\u00f6tter erbt alle vier: den Hochmut, die Ekstase, die Ironie, das Feuer.',
  ],

  // ── Entrance Texts (5 variants, verbatim from DB seed) ──

  entranceTexts: [
    'The threshold does not yield. It opens. Deliberately. Beyond it, the air is warm and charged with potential. Tools line the walls in arrangements that suggest use, not storage. The workshop has been expecting someone.',
    'Heat. Not the heat of fire \u2013 the heat of process. The air smells of ozone and possibility. Somewhere deeper, metal rings against metal. Not randomly. Rhythmically. A heartbeat made of industry.',
    'The descent into the workshop begins with a question written on the lintel in a script older than the stone: \u201cWhat do you intend to make?\u201d The party has no answer yet. The workshop will provide the materials for one.',
    'The first room is a catalogue of components. Not displayed \u2013 arranged. Each material in its place, each place chosen by a logic that makes no sense until you pick something up and feel where it wants to go. The workshop teaches through inventory.',
    'A forge-glow illuminates the entrance. Not from a furnace \u2013 from the walls themselves. The workshop provides its own light, its own heat, its own purpose. All it lacks is hands. Yours will do.',
  ],

  entranceTextsDe: [
    'Die Schwelle gibt nicht nach. Sie \u00f6ffnet sich. Absichtlich. Dahinter ist die Luft warm und geladen mit Potential. Werkzeuge s\u00e4umen die W\u00e4nde in Anordnungen, die Benutzung suggerieren, nicht Lagerung. Die Werkstatt hat jemanden erwartet.',
    'Hitze. Nicht die Hitze von Feuer \u2013 die Hitze von Prozess. Die Luft riecht nach Ozon und M\u00f6glichkeit. Irgendwo tiefer klingt Metall gegen Metall. Nicht zuf\u00e4llig. Rhythmisch. Ein Herzschlag aus Industrie.',
    'Der Abstieg in die Werkstatt beginnt mit einer Frage, die am T\u00fcrsturz steht, in einer Schrift, \u00e4lter als der Stein: \u00bbWas beabsichtigt ihr herzustellen?\u00ab Der Trupp hat noch keine Antwort. Die Werkstatt wird die Materialien f\u00fcr eine liefern.',
    'Der erste Raum ist ein Katalog von Komponenten. Nicht ausgestellt \u2013 arrangiert. Jedes Material an seinem Platz, jeder Platz gew\u00e4hlt nach einer Logik, die keinen Sinn ergibt, bis man etwas aufnimmt und sp\u00fcrt, wohin es will. Die Werkstatt lehrt durch Inventar.',
    'Ein Schmiedegl\u00fchen beleuchtet den Eingang. Nicht von einem Ofen \u2013 von den W\u00e4nden selbst. Die Werkstatt liefert ihr eigenes Licht, ihre eigene Hitze, ihren eigenen Zweck. Alles, was ihr fehlt, sind H\u00e4nde. Eure werden gen\u00fcgen.',
  ],

  // ── Mechanic ──

  mechanicName: 'Insight',
  mechanicNameDe: 'Einsicht',
  mechanicDescription:
    'Die Werkstatt der G\u00f6tter\u2019s unique resonance mechanic. Insight accumulates per room, per combat victory, and per crafting attempt \u2013 even failures add to the forge\u2019s knowledge. Below 20, the Cold Forge: materials remain inert, craft attempts carry a \u221215% penalty. The workshop waits for hands that understand. At 45+, Inspired: components develop preferences, craft bonus +15%, combinations reveal themselves. At 75+, Feverish: the insight becomes obsession \u2013 craft bonus +30% but stress \u00d71.25 and 15% ambush chance. The fire is generous and hungry. At 100, Breakthrough: legendary crafts become possible, but stress \u00d72.0 and 30% ambush. The mechanic is the pharmakon: every gift is also a poison.',
  mechanicDescriptionDe:
    'Die einzigartige Resonanzmechanik der Werkstatt der G\u00f6tter. Einsicht akkumuliert pro Raum, pro Kampfsieg und pro Handwerksversuch \u2013 selbst Fehlschl\u00e4ge f\u00fcgen dem Wissen der Schmiede hinzu. Unter 20, die Kalte Schmiede: Materialien bleiben inert, Handwerksversuche tragen einen \u221215%-Malus. Die Werkstatt wartet auf H\u00e4nde, die verstehen. Ab 45+, Inspiriert: Komponenten entwickeln Pr\u00e4ferenzen, Handwerksbonus +15%, Kombinationen enth\u00fcllen sich. Ab 75+, Fieberhaft: die Einsicht wird zur Obsession \u2013 Handwerksbonus +30%, aber Stress \u00d71,25 und 15% Hinterhaltchance. Das Feuer ist gro\u00dfz\u00fcgig und hungrig. Bei 100, Durchbruch: legend\u00e4re Handwerke werden m\u00f6glich, aber Stress \u00d72,0 und 30% Hinterhalt. Die Mechanik ist das Pharmakon: jedes Geschenk ist auch ein Gift.',

  mechanicGauge: {
    name: 'Insight',
    nameDe: 'Einsicht',
    start: 0,
    max: 100,
    direction: 'fill',
    thresholds: [
      { value: 0, label: 'Cold Forge', labelDe: 'Kalte Schmiede', description: 'Craft penalty \u221215%. Materials inert. The workshop waits.', descriptionDe: 'Handwerksmalus \u221215%. Materialien inert. Die Werkstatt wartet.' },
      { value: 20, label: 'Warming', labelDe: 'Erw\u00e4rmung', description: 'Normal operation. Components begin to respond.', descriptionDe: 'Normaler Betrieb. Komponenten beginnen zu reagieren.' },
      { value: 45, label: 'Inspired', labelDe: 'Inspiriert', description: 'Craft bonus +15%. Components have preferences. The fire approves.', descriptionDe: 'Handwerksbonus +15%. Komponenten haben Pr\u00e4ferenzen. Das Feuer billigt.' },
      { value: 75, label: 'Feverish', labelDe: 'Fieberhaft', description: 'Craft bonus +30%. Stress \u00d71.25. 15% ambush. The fire is generous and hungry.', descriptionDe: 'Handwerksbonus +30%. Stress \u00d71,25. 15% Hinterhalt. Das Feuer ist gro\u00dfz\u00fcgig und hungrig.' },
      { value: 100, label: 'Breakthrough', labelDe: 'Durchbruch', description: 'Legendary crafts possible. Stress \u00d72.0. 30% ambush. The fire takes what it gives.', descriptionDe: 'Legend\u00e4re Handwerke m\u00f6glich. Stress \u00d72,0. 30% Hinterhalt. Das Feuer nimmt, was es gibt.' },
    ],
  },

  mechanicGaugePreviewValue: 52,

  aptitudeWeights: {
    Saboteur: 30,
    Spy: 20,
    Infiltrator: 20,
    Guardian: 12,
    Propagandist: 10,
    Assassin: 8,
  },

  roomDistribution: {
    Combat: 25,
    Encounter: 40,
    Elite: 5,
    Rest: 10,
    Treasure: 15,
    Exit: 5,
  },

  // ── Enemies ──

  enemies: [
    {
      name: 'Spark Wisp', nameDe: 'Funkenglimmer',
      tier: 'minion', power: 2, stress: 3, evasion: 45,
      ability: 'Orbit', abilityDe: 'Umkreisen', aptitude: 'Infiltrator',
      description: 'A spark that refused to go out. It orbits the party like a hypothesis testing itself.',
      descriptionDe: 'Ein Funke, der sich weigerte zu verl\u00f6schen. Er umkreist den Trupp wie eine Hypothese, die sich selbst \u00fcberpr\u00fcft.',
    },
    {
      name: 'Crucible Drake', nameDe: 'Tiegeldrache',
      tier: 'standard', power: 4, stress: 5, evasion: 25,
      ability: 'Smelt', abilityDe: 'Schmelzen', aptitude: 'Saboteur',
      description: 'A construct of molten flux and crystallized heat. It was a crucible once. Now it moves. The fire inside it has opinions.',
      descriptionDe: 'Ein Konstrukt aus geschmolzenem Flussmittel und kristallisierter Hitze. Es war einmal ein Tiegel. Nun bewegt er sich. Das Feuer in ihm hat Meinungen.',
    },
    {
      name: 'Forge Wraith', nameDe: 'Schmiedewraith',
      tier: 'elite', power: 6, stress: 5, evasion: 15,
      ability: 'Incorporate', abilityDe: 'Einbeziehen', aptitude: 'Saboteur',
      description: 'Smoke and metal in the shape of a craftsman. It works at an invisible anvil, hammering things that are not there. When it notices the party, it does not stop working. It incorporates them.',
      descriptionDe: 'Rauch und Metall in der Form eines Handwerkers. Er arbeitet an einem unsichtbaren Amboss, h\u00e4mmert Dinge, die nicht da sind. Als er den Trupp bemerkt, h\u00f6rt er nicht auf zu arbeiten. Er bezieht sie ein.',
    },
    {
      name: 'Workshop Guardian', nameDe: 'Werkstattw\u00e4chter',
      tier: 'elite', power: 7, stress: 3, evasion: 5,
      ability: 'Fortify', abilityDe: 'Befestigen', aptitude: 'Guardian',
      description: 'It was built to protect the workshop. It has been doing this for longer than the workshop has existed. Its loyalty is not to the current configuration \u2013 it is to the IDEA of the workshop.',
      descriptionDe: 'Er wurde gebaut, um die Werkstatt zu sch\u00fctzen. Er tut dies seit l\u00e4nger als die Werkstatt existiert. Seine Loyalit\u00e4t gilt nicht der aktuellen Konfiguration \u2013 sie gilt der IDEE der Werkstatt.',
    },
    {
      name: 'The Prototype', nameDe: 'Der Prototyp',
      tier: 'boss', power: 7, stress: 6, evasion: 10,
      ability: 'Iterate', abilityDe: 'Iterieren', aptitude: 'Saboteur',
      description: 'It was supposed to be the masterwork. The culmination. The thing the workshop has been building toward since the first spark was struck. It is not finished. It does not know this. It functions with the absolute confidence of an unfinished thing that believes it is complete.',
      descriptionDe: 'Es sollte das Meisterwerk werden. Die Kulmination. Das Ding, auf das die Werkstatt seit dem ersten geschlagenen Funken hingearbeitet hat. Es ist nicht fertig. Es wei\u00df das nicht. Es funktioniert mit der absoluten Zuversicht eines unfertigen Dings, das glaubt, es sei vollst\u00e4ndig.',
    },
  ],

  // ── Encounters ──

  encounterPreviews: [
    {
      name: 'The Reagent Cache', nameDe: 'Das Reagenzienlager',
      depth: '1\u20132', type: 'narrative',
      description: 'A workbench, preserved in amber light. Drawers half-open. Inside: materials sorted by a system you do not yet understand but somehow recognize. Metal filings in one drawer. A sealed vial of fluid in another. A crystal formation growing from the third. The workshop is offering inventory.',
      descriptionDe: 'Eine Werkbank, in Bernsteinlicht konserviert. Schubladen halb offen. Darin: Materialien, sortiert nach einem System, das ihr noch nicht versteht, aber irgendwie wiedererkennt. Metallsp\u00e4ne in einer Schublade. Ein versiegeltes Fl\u00e4schchen Fl\u00fcssigkeit in einer anderen. Eine Kristallformation, die aus der dritten w\u00e4chst. Die Werkstatt bietet Inventar an.',
      choices: [
        { text: 'Extract the metal filings', textDe: 'Die Metallsp\u00e4ne entnehmen', aptitude: 'Saboteur', difficulty: '+5' },
        { text: 'Secure the sealed fluid', textDe: 'Die versiegelte Fl\u00fcssigkeit sichern', aptitude: 'Spy', difficulty: '+5' },
        { text: 'Harvest the crystal', textDe: 'Den Kristall ernten', aptitude: 'Infiltrator', difficulty: '+5' },
      ],
    },
    {
      name: 'The Crucible', nameDe: 'Der Tiegel',
      depth: '2\u20135', type: 'narrative',
      description: 'A crucible stands at the room\u2019s center. It is already hot. Around it, components from the workshop\u2019s deeper chambers have arranged themselves in a semicircle, as if presenting options. The crucible does not wait. It suggests.',
      descriptionDe: 'Ein Tiegel steht in der Raummitte. Er ist bereits hei\u00df. Um ihn herum haben sich Komponenten aus den tieferen Kammern der Werkstatt in einem Halbkreis angeordnet, als pr\u00e4sentierten sie Optionen. Der Tiegel wartet nicht. Er schl\u00e4gt vor.',
      choices: [
        { text: 'Attempt a combination', textDe: 'Eine Kombination versuchen', aptitude: 'Saboteur', difficulty: '+6' },
        { text: 'Study without using', textDe: 'Studieren ohne zu benutzen', aptitude: 'Spy', difficulty: '+5' },
      ],
    },
    {
      name: 'The Living Blueprint', nameDe: 'Die lebende Blaupause',
      depth: '2\u20134', type: 'narrative',
      description: 'On the wall: a blueprint. It is moving. Lines redraw themselves. Annotations appear and are crossed out by other annotations. The blueprint is arguing with itself about the best way to build something that has never existed. It does not acknowledge the party. It is too busy being a thought that thinks.',
      descriptionDe: 'An der Wand: eine Blaupause. Sie bewegt sich. Linien zeichnen sich neu. Anmerkungen erscheinen und werden von anderen Anmerkungen durchgestrichen. Die Blaupause streitet mit sich selbst \u00fcber den besten Weg, etwas zu bauen, das nie existiert hat. Sie nimmt den Trupp nicht zur Kenntnis. Sie ist zu besch\u00e4ftigt damit, ein Gedanke zu sein, der denkt.',
      choices: [
        { text: 'Add to the blueprint', textDe: 'Zur Blaupause beitragen', aptitude: 'Saboteur', difficulty: '+5' },
        { text: 'Copy the blueprint\u2019s state', textDe: 'Den Zustand der Blaupause kopieren', aptitude: 'Spy', difficulty: '+5' },
      ],
    },
    {
      name: 'The Failed Experiment', nameDe: 'Das gescheiterte Experiment',
      depth: '3\u20135', type: 'narrative',
      description: 'The room contains the aftermath of an experiment that did not go as planned. Scorch marks radiate from a central point. Components are fused into the walls. A half-formed construct twitches on the floor, caught between activation and entropy. The failure is recent. The workshop has not cleaned up yet. Perhaps it is waiting for a second opinion.',
      descriptionDe: 'Der Raum enth\u00e4lt das Ergebnis eines Experiments, das nicht nach Plan verlief. Brandspuren strahlen von einem zentralen Punkt aus. Komponenten sind in die W\u00e4nde geschmolzen. Ein halbgeformtes Konstrukt zuckt am Boden, gefangen zwischen Aktivierung und Entropie. Das Scheitern ist frisch. Die Werkstatt hat noch nicht aufger\u00e4umt. Vielleicht wartet sie auf eine zweite Meinung.',
      choices: [
        { text: 'Salvage usable components', textDe: 'Verwendbare Komponenten bergen', aptitude: 'Saboteur', difficulty: '+6' },
        { text: 'Analyze what went wrong', textDe: 'Analysieren, was schiefging', aptitude: 'Spy', difficulty: '+6' },
        { text: 'Leave the disaster undisturbed', textDe: 'Das Desaster unber\u00fchrt lassen' },
      ],
    },
    {
      name: 'The Resonance Forge', nameDe: 'Die Resonanzschmiede',
      depth: '3\u20135', type: 'narrative',
      description: 'A device occupies the room\u2019s center \u2013 part tuning fork, part lens array, part something that has no name in any language the party speaks. It vibrates at a frequency just below hearing. Crystal and energy conduits feed into it from opposite walls, converging at a focal point that bends light into a shape resembling intent. The device is waiting to be aimed.',
      descriptionDe: 'Ein Ger\u00e4t nimmt die Raummitte ein \u2013 teils Stimmgabel, teils Linsenarray, teils etwas, das in keiner Sprache, die der Trupp spricht, einen Namen hat. Es vibriert auf einer Frequenz knapp unterhalb des H\u00f6rbaren. Kristall- und Energieleitungen speisen es von gegen\u00fcberliegenden W\u00e4nden, konvergierend an einem Brennpunkt, der Licht in eine Form biegt, die Absicht \u00e4hnelt. Das Ger\u00e4t wartet darauf, ausgerichtet zu werden.',
      choices: [
        { text: 'Focus crystal through energy', textDe: 'Kristall durch Energie fokussieren', aptitude: 'Saboteur', difficulty: '+7' },
        { text: 'Study harmonic properties', textDe: 'Harmonische Eigenschaften studieren', aptitude: 'Spy', difficulty: '+6' },
      ],
    },
  ],

  // ── Banter (4-tier insight progression) ──

  banterSamples: [
    { text: 'Tools arranged by a system that is not alphabetical, not chronological. But organized. Precisely organized.', textDe: 'Werkzeuge, angeordnet nach einem System, das nicht alphabetisch ist, nicht chronologisch. Aber geordnet. Pr\u00e4zise geordnet.', tier: 0 },
    { text: 'The workshop hums. Not electrically \u2013 deliberately. A sustained note of anticipation, as if the room knows what the party has not yet decided to build.', textDe: 'Die Werkstatt summt. Nicht elektrisch \u2013 absichtlich. Ein gehaltener Ton der Erwartung, als w\u00fcsste der Raum, was der Trupp noch nicht zu bauen beschlossen hat.', tier: 1 },
    { text: 'Something shifts. Connections that were invisible a moment ago. The components are not separate things \u2013 they are parts of something that wants to exist.', textDe: 'Etwas verschiebt sich. Verbindungen, die vor einem Moment noch unsichtbar waren. Die Komponenten sind keine separaten Dinge \u2013 sie sind Teile von etwas, das existieren will.', tier: 1 },
    { text: 'The components shift. Not settling \u2013 rearranging. They have preferences about proximity. The metal does not want to be near the powder.', textDe: 'Die Komponenten bewegen sich. Kein Setzen \u2013 Umordnen. Sie haben Pr\u00e4ferenzen bez\u00fcglich N\u00e4he. Das Metall will nicht neben dem Pulver sein.', tier: 2 },
    { text: 'The workshop contracts. All corridors converge. Ahead: the central chamber. The heat is absolute. Something inside is functioning with the confidence of a finished thing. It is not finished.', textDe: 'Die Werkstatt zieht sich zusammen. Alle Korridore konvergieren. Voraus: die zentrale Kammer. Die Hitze ist absolut. Etwas darin funktioniert mit der Zuversicht eines fertigen Dings. Es ist nicht fertig.', tier: 2 },
    { text: 'Hands are shaking. Not from fear. From something worse: the absolute certainty that the next combination will work. The fire knows.', textDe: 'Die H\u00e4nde zittern. Nicht vor Angst. Vor etwas Schlimmerem: der absoluten Gewissheit, dass die n\u00e4chste Kombination funktionieren wird. Das Feuer wei\u00df es.', tier: 3 },
    { text: 'The construct disassembles. Its components scatter. Some of them are still warm. Some of them are interesting.', textDe: 'Das Konstrukt zerlegt sich. Seine Komponenten zerstreuen sich. Manche sind noch warm. Manche sind interessant.', tier: 0 },
    { text: 'Ahead: something that was built with intent. Not the workshop\u2019s ambient creations \u2013 a deliberate construct. It works at something. It does not wish to be interrupted.', textDe: 'Voraus: etwas, das mit Absicht gebaut wurde. Nicht die Zufallssch\u00f6pfungen der Werkstatt \u2013 ein absichtliches Konstrukt. Es arbeitet an etwas. Es w\u00fcnscht nicht, unterbrochen zu werden.', tier: 1 },
  ],

  // ── Literary Influences ──

  authors: [
    { name: 'Mary Shelley', works: 'Frankenstein', concept: 'Creation as abandonment. The creature surpasses the maker, and the maker cannot bear what he has made. Prometheus unbound becomes Prometheus horrified.', conceptDe: 'Sch\u00f6pfung als Verlassenheit. Die Kreatur \u00fcbertrifft den Sch\u00f6pfer, und der Sch\u00f6pfer ertr\u00e4gt nicht, was er gemacht hat. Der entfesselte Prometheus wird zum entsetzten Prometheus.', language: 'English', quote: 'I had desired it with an ardour that far exceeded moderation.', primary: true },
    { name: 'Bruno Schulz', works: 'The Street of Crocodiles \u00b7 Treatise on Tailors\u2019 Dummies', concept: 'The demiurge\u2019s joy. Matter has agency, dreams, preferences. Creation is not imposition of form on chaos \u2013 it is negotiation with material that has its own ambitions.', conceptDe: 'Die Freude des Demiurgen. Materie hat Handlungsf\u00e4higkeit, Tr\u00e4ume, Pr\u00e4ferenzen. Sch\u00f6pfung ist nicht Formgebung \u00fcber Chaos \u2013 sie ist Verhandlung mit Material, das eigene Ambitionen hat.', language: 'Polish', quote: 'Matter has been given infinite fertility, inexhaustible vitality.', primary: true },
    { name: 'Stanis\u0142aw Lem', works: 'The Cyberiad', concept: 'Constructor arrogance and cosmic irony. Trurl and Klapaucius build universes, gods, civilizations \u2013 and every creation has unintended consequences. The fable form softens the horror.', conceptDe: 'Konstrukteurs-Arroganz und kosmische Ironie. Trurl und Klapaucius bauen Universen, G\u00f6tter, Zivilisationen \u2013 und jede Sch\u00f6pfung hat unbeabsichtigte Konsequenzen. Die Fabelform mildert den Horror.', language: 'Polish', quote: 'Have I told you about the time Trurl built a femfatalatron?', primary: true },
    { name: 'Gaston Bachelard', works: 'The Psychoanalysis of Fire', concept: 'The Prometheus Complex: fire-reverie as the deepest human drive. The desire to change the world by changing matter. Fire is not a tool \u2013 it is the first teacher.', conceptDe: 'Der Prometheus-Komplex: Feuer-Tr\u00e4umerei als tiefster menschlicher Trieb. Der Wunsch, die Welt zu ver\u00e4ndern, indem man die Materie ver\u00e4ndert. Feuer ist kein Werkzeug \u2013 es ist der erste Lehrer.', language: 'Fran\u00e7ais', quote: 'Fire suggests the desire to change, to speed up the passage of time.', primary: true },
    { name: 'Primo Levi', works: 'The Periodic Table \u00b7 The Wrench', concept: 'Matter as teacher. The craftsman does not master material \u2013 material teaches the craftsman. Moral seriousness: every element has character, history, consequence.', conceptDe: 'Materie als Lehrer. Der Handwerker meistert das Material nicht \u2013 das Material lehrt den Handwerker. Moralische Ernsthaftigkeit: jedes Element hat Charakter, Geschichte, Konsequenz.', language: 'Italiano', quote: 'Conquering matter is to understand it.', primary: false },
    { name: 'Patrick S\u00fcskind', works: 'Perfume', concept: 'Craftsmanship as obsession. The component hunt \u2013 each ingredient vital, irreplaceable, obtained at moral cost. The finished work consumes its creator.', conceptDe: 'Handwerk als Obsession. Die Komponentenjagd \u2013 jede Zutat vital, unersetzlich, zu moralischen Kosten erhalten. Das vollendete Werk konsumiert seinen Sch\u00f6pfer.', language: 'Deutsch', primary: false },
  ],

  // ── Objektanker (creation narrative: each phase more ambitious) ──

  objektanker: [
    {
      name: 'The Tool', nameDe: 'Das Werkzeug',
      phases: [
        { label: 'Discovery', labelDe: 'Entdeckung', text: 'A tool. Not a tool you recognize \u2013 a tool for something that has not been invented yet. It fits the hand uncomfortably well.', textDe: 'Ein Werkzeug. Kein Werkzeug, das ihr erkennt \u2013 ein Werkzeug f\u00fcr etwas, das noch nicht erfunden wurde. Es liegt unbequem gut in der Hand.' },
        { label: 'Echo', labelDe: 'Echo', text: 'The tool again. It has changed \u2013 the handle is warmer, the edge sharper. It has been practicing.', textDe: 'Das Werkzeug wieder. Es hat sich ver\u00e4ndert \u2013 der Griff ist w\u00e4rmer, die Kante sch\u00e4rfer. Es hat ge\u00fcbt.' },
        { label: 'Mutation', labelDe: 'Mutation', text: 'The tool has split into three. Each version is optimized for a different task. They arranged themselves on the workbench in order of increasing ambition.', textDe: 'Das Werkzeug hat sich in drei geteilt. Jede Version ist f\u00fcr eine andere Aufgabe optimiert. Sie haben sich auf der Werkbank angeordnet, in Reihenfolge zunehmender Ambition.' },
        { label: 'Climax', labelDe: 'H\u00f6hepunkt', text: 'The tool is gone. In its place: a finished thing. Not what the party built \u2013 what the tool built using itself as material.', textDe: 'Das Werkzeug ist weg. An seiner Stelle: ein fertiges Ding. Nicht was der Trupp gebaut hat \u2013 was das Werkzeug gebaut hat, mit sich selbst als Material.' },
      ],
    },
    {
      name: 'The Blueprint', nameDe: 'Die Blaupause',
      phases: [
        { label: 'Discovery', labelDe: 'Entdeckung', text: 'A blueprint, pinned to the wall. The design is for something elegant and impossible. The measurements are in a unit that does not exist.', textDe: 'Eine Blaupause, an die Wand geheftet. Der Entwurf ist f\u00fcr etwas Elegantes und Unm\u00f6gliches. Die Ma\u00dfe sind in einer Einheit, die es nicht gibt.' },
        { label: 'Echo', labelDe: 'Echo', text: 'The blueprint has been annotated. The annotations are in your handwriting. You do not remember writing them.', textDe: 'Die Blaupause wurde annotiert. Die Anmerkungen sind in eurer Handschrift. Ihr erinnert euch nicht, sie geschrieben zu haben.' },
        { label: 'Mutation', labelDe: 'Mutation', text: 'The blueprint has folded itself into a three-dimensional model. It rotates slowly in the air, demonstrating its own construction sequence.', textDe: 'Die Blaupause hat sich zu einem dreidimensionalen Modell gefaltet. Es rotiert langsam in der Luft und demonstriert seine eigene Konstruktionssequenz.' },
        { label: 'Climax', labelDe: 'H\u00f6hepunkt', text: 'The model is building itself. Layer by layer, from the inside out. It does not need the party. It never needed the party.', textDe: 'Das Modell baut sich selbst. Schicht f\u00fcr Schicht, von innen nach au\u00dfen. Es braucht den Trupp nicht. Es hat den Trupp nie gebraucht.' },
      ],
    },
    {
      name: 'The Ember', nameDe: 'Die Glut',
      phases: [
        { label: 'Discovery', labelDe: 'Entdeckung', text: 'An ember. Not dying \u2013 deciding. It glows with a steadiness that suggests not combustion but contemplation. The heat it radiates is precise: exactly enough to warm a hand. Not an accident. An offer.', textDe: 'Eine Glut. Nicht sterbend \u2013 entscheidend. Sie gl\u00fcht mit einer Stetigkeit, die nicht Verbrennung, sondern Kontemplation nahelegt. Die W\u00e4rme, die sie ausstrahlt, ist pr\u00e4zise: exakt genug, um eine Hand zu w\u00e4rmen. Kein Zufall. Ein Angebot.' },
        { label: 'Echo', labelDe: 'Echo', text: 'The ember is larger. It has been fed by proximity \u2013 the party\u2019s presence is fuel. It pulses now, rhythmically, as if breathing. It has learned to want.', textDe: 'Die Glut ist gr\u00f6\u00dfer. Sie wurde durch N\u00e4he gen\u00e4hrt \u2013 die Anwesenheit des Trupps ist Brennstoff. Sie pulsiert nun, rhythmisch, als atme sie. Sie hat gelernt zu wollen.' },
        { label: 'Mutation', labelDe: 'Mutation', text: 'The ember has become a flame. Not tall \u2013 focused. It burns in a colour the party cannot name, at a temperature that exists on no scale. It has opinions about what should be placed inside it.', textDe: 'Die Glut ist zur Flamme geworden. Nicht hoch \u2013 fokussiert. Sie brennt in einer Farbe, die der Trupp nicht benennen kann, bei einer Temperatur, die auf keiner Skala existiert. Sie hat Meinungen dar\u00fcber, was in sie hineingelegt werden sollte.' },
        { label: 'Climax', labelDe: 'H\u00f6hepunkt', text: 'The fire has built something. From itself. Using itself as both material and tool. What remains is too hot to touch and too beautiful to leave. The workshop\u2019s first lesson: creation consumes the creator.', textDe: 'Das Feuer hat etwas gebaut. Aus sich selbst. Unter Verwendung seiner selbst als Material und Werkzeug. Was bleibt, ist zu hei\u00df zum Anfassen und zu sch\u00f6n zum Verlassen. Die erste Lektion der Werkstatt: Sch\u00f6pfung verzehrt den Sch\u00f6pfer.' },
      ],
    },
    {
      name: 'The First Alloy', nameDe: 'Die erste Legierung',
      phases: [
        { label: 'Discovery', labelDe: 'Entdeckung', text: 'Two metals, separated by a groove in the workbench. They are different colours, different weights, different temperatures. Between them: a crucible-mark where something once combined them. The groove is wide enough for a hand.', textDe: 'Zwei Metalle, getrennt durch eine Rille in der Werkbank. Sie haben verschiedene Farben, verschiedene Gewichte, verschiedene Temperaturen. Zwischen ihnen: eine Tiegelmarkierung, wo etwas sie einst vereinte. Die Rille ist breit genug f\u00fcr eine Hand.' },
        { label: 'Echo', labelDe: 'Echo', text: 'The metals have moved. Not much \u2013 a millimetre toward each other. The groove between them is narrower. They are negotiating proximity on their own terms.', textDe: 'Die Metalle haben sich bewegt. Nicht viel \u2013 einen Millimeter aufeinander zu. Die Rille zwischen ihnen ist schmaler. Sie verhandeln N\u00e4he zu ihren eigenen Bedingungen.' },
        { label: 'Mutation', labelDe: 'Mutation', text: 'The groove is gone. The metals touch. At the point of contact: a colour neither possessed alone. A new substance is forming at the boundary between what each was and what both are becoming.', textDe: 'Die Rille ist verschwunden. Die Metalle ber\u00fchren sich. Am Kontaktpunkt: eine Farbe, die keines allein besa\u00df. Eine neue Substanz bildet sich an der Grenze zwischen dem, was jedes war, und dem, was beide werden.' },
        { label: 'Climax', labelDe: 'H\u00f6hepunkt', text: 'One metal. It remembers being two. The memory is a structural property \u2013 the alloy is stronger at the seam where the negotiation happened. The workshop\u2019s lesson: creation is not combination. It is compromise.', textDe: 'Ein Metall. Es erinnert sich, zwei gewesen zu sein. Die Erinnerung ist eine strukturelle Eigenschaft \u2013 die Legierung ist st\u00e4rker an der Naht, wo die Verhandlung stattfand. Die Lektion der Werkstatt: Sch\u00f6pfung ist nicht Kombination. Es ist Kompromiss.' },
      ],
    },
  ],

  // ── Loot Showcase ──

  lootShowcase: [
    { name: 'Spark Residue', nameDe: 'Funkenr\u00fcckstand', tier: 1, effect: 'Stress heal 50', description: 'Crystallized energy from a defeated construct. It hums at a frequency that calms the nervous system.', descriptionDe: 'Kristallisierte Energie eines besiegten Konstrukts. Sie summt auf einer Frequenz, die das Nervensystem beruhigt.' },
    { name: 'Calibration Shard', nameDe: 'Kalibrierungssplitter', tier: 1, effect: 'Saboteur +5% (dungeon)', description: 'A precisely fractured crystal. Saboteur checks +5% \u2013 the workshop approves of hands that build.', descriptionDe: 'Ein pr\u00e4zise gebrochener Kristall. Saboteur-Proben +5% \u2013 die Werkstatt billigt H\u00e4nde, die bauen.' },
    { name: 'Tempered Observation Lens', nameDe: 'Geh\u00e4rtete Beobachtungslinse', tier: 2, effect: 'Spy +1', description: 'A lens forged in the workshop\u2019s crucible. It reveals patterns invisible to the unaugmented eye.', descriptionDe: 'Eine in der Werkstattschmelze geschmiedete Linse. Sie enth\u00fcllt Muster, die f\u00fcr das unverst\u00e4rkte Auge unsichtbar sind.' },
    { name: 'Resonance Tuner', nameDe: 'Resonanzstimmer', tier: 2, effect: 'Mood +15 (pharmakon)', description: 'A device that harmonizes with the bearer\u2019s frequency. It provides comfort. It also provides dependency.', descriptionDe: 'Ein Ger\u00e4t, das mit der Frequenz des Tr\u00e4gers harmoniert. Es bietet Trost. Es bietet auch Abh\u00e4ngigkeit.' },
    { name: 'Innovation Blueprint', nameDe: 'Innovationsblaupause', tier: 3, effect: '+1 highest aptitude (permanent)', description: 'The workshop\u2019s final gift. A blueprint that imprints itself on the bearer \u2013 permanent knowledge, paid for in fire.', descriptionDe: 'Das letzte Geschenk der Werkstatt. Eine Blaupause, die sich dem Tr\u00e4ger einpr\u00e4gt \u2013 permanentes Wissen, bezahlt in Feuer.' },
    { name: 'Stolen Fire', nameDe: 'Gestohlenes Feuer', tier: 3, effect: 'Building readiness +0.15/cycle', description: 'Fire from the gods. Not a metaphor \u2013 a substance. It does not burn the hand that carries it. It burns everything the hand touches.', descriptionDe: 'Feuer der G\u00f6tter. Keine Metapher \u2013 eine Substanz. Es verbrennt nicht die Hand, die es tr\u00e4gt. Es verbrennt alles, was die Hand ber\u00fchrt.' },
  ],

  // ── Prose ──

  prose: {
    mechanicGainTitle: 'Insight Accumulation',
    mechanicGainTitleDe: 'Einsichtsakkumulation',
    mechanicGainText: '+4 per room (depth 1\u20132)\n+7 per room (depth 3\u20134)\n+10 per room (depth 5+)\n+5 on combat victory\n+8 on craft success\n+4 on craft failure',
    mechanicGainTextDe: '+4 pro Raum (Tiefe 1\u20132)\n+7 pro Raum (Tiefe 3\u20134)\n+10 pro Raum (Tiefe 5+)\n+5 bei Kampfsieg\n+8 bei Handwerkserfolg\n+4 bei Handwerksversagen',
    mechanicReduceTitle: 'Insight Reduction',
    mechanicReduceTitleDe: 'Einsichtsreduktion',
    mechanicReduceText: '\u221215 on rest (fire cools)\n\u22122 per combat round\n\u22125 on failed check\n\u22123 per enemy hit',
    mechanicReduceTextDe: '\u221215 bei Rast (Feuer k\u00fchlt)\n\u22122 pro Kampfrunde\n\u22125 bei fehlgeschlagener Probe\n\u22123 pro Feindtreffer',
    mechanicReduceEmphasis: 'The fire that illuminates also burns.',
    mechanicReduceEmphasisDe: 'Das Feuer, das erleuchtet, verbrennt auch.',
    encounterIntro: 'Navigate the workshop. Every component has a cost the craftsman does not calculate.',
    encounterIntroDe: 'Navigiert die Werkstatt. Jede Komponente hat Kosten, die der Handwerker nicht kalkuliert.',
    bestiaryIntro: 'The denizens of Die Werkstatt der G\u00f6tter. Not enemies \u2013 unfinished projects with opinions.',
    bestiaryIntroDe: 'Die Bewohner der Werkstatt der G\u00f6tter. Keine Feinde \u2013 unfertige Projekte mit Meinungen.',
    banterHeader: 'Workshop Reports',
    banterHeaderDe: 'Werkstattberichte',
    objektankerHeader: 'Artifacts of Die Werkstatt der G\u00f6tter',
    objektankerHeaderDe: 'Artefakte der Werkstatt der G\u00f6tter',
    objektankerIntro: 'Objects that evolve as insight accumulates. Each phase more ambitious than the last \u2013 the workshop builds even its own landmarks.',
    objektankerIntroDe: 'Objekte, die sich entwickeln, w\u00e4hrend Einsicht sich anh\u00e4uft. Jede Phase ambitionierter als die letzte \u2013 die Werkstatt baut sogar ihre eigenen Landmarken.',
    exitQuote: 'The workshop waits. It always waits. It has fire, and materials, and time. All it lacks is hands.',
    exitQuoteDe: 'Die Werkstatt wartet. Sie wartet immer. Sie hat Feuer und Materialien und Zeit. Alles, was ihr fehlt, sind H\u00e4nde.',
    exitCta: 'Enter Die Werkstatt der G\u00f6tter',
    exitCtaDe: 'Die Werkstatt der G\u00f6tter betreten',
    exitCtaText: 'You survived the exhibition. Now survive the creation.',
    exitCtaTextDe: 'Ihr habt die Ausstellung \u00fcberlebt. Jetzt \u00fcberlebt die Sch\u00f6pfung.',
  },

  // ── Navigation ──

  prevArchetype: getNav('entropy'),
  nextArchetype: getNav('deluge'),
};

// ── VI · The Deluge ─────────────────────────────────────────────────────────

const DELUGE_DETAIL: ArchetypeDetail = {
  ...getBaseSlide('deluge'),

  // ── Lore Introduction (3 paragraphs, fresh literary prose) ──

  loreIntro: [
    'The Deluge is the sixth archetype of the Resonance Dungeons \u2013 and the most patient in its violence. Die Steigende Flut is not a flood. Floods imply a discrete event \u2013 arrival, crest, recession, the reassuring grammar of catastrophe with a beginning and an end. The Deluge is a condition. The water was always here; the architecture has simply stopped pretending otherwise. Rooms do not flood \u2013 they remember they are underwater. The corridors slope downward with an intentionality that cannot be accidental: someone designed this space to be claimed. The horror is not drowning. Drowning is too sudden, too dramatic, too willing to announce itself. The horror is the patient, geological arithmetic of displacement: the water rises 5cm per room, and the math does not negotiate. Each step deeper is a concession the party cannot retract. Each room entered is a room the surface forgets. Die Steigende Flut does not attack. It accrues.',
    'Water level increases with the quiet inevitability of tide tables: +5 per room traversed at depths 1\u20132, +8 at depths 3\u20134, +12 at depth 5 and beyond \u2013 the flood accelerates because depth itself is an argument for more depth. Combat adds +3 per round, because violence in water displaces. Failed checks add +5, because incompetence in a rising medium is not forgiven. Every three rooms, a tidal recession: \u22128, diminishing, because the flood gives back just enough to make the party believe in retreat. At 25 (ankle), movement costs increase. Every step announces itself. The water listens. At 50 (waist), stress multiplies \u00d71.15 and 15% ambush probability emerges \u2013 combat in water costs twice, once for the act, once for the medium. At 75 (chest), stress \u00d71.40, 35% ambush, vision radius shrinks to 2 rooms. The operational vocabulary contracts to three verbs: salvage, seal, ascend. At 100, submerged \u2013 stress \u00d72.0, the water claims what it keeps. Guardian seal actions reduce water by 10, because containment is the only counterargument the flood accepts. The mechanic is geological time compressed into a dungeon run: the water has done this before and will do it again.',
    'The literary architecture rests on five pillars of displacement. Ballard\u2019s Drowned World \u2013 biological regression as surrender to deep time, the Triassic pull that drags civilization not into catastrophe but into a return to the primordial, where drowning is transcendence because consciousness was always borrowed from the ocean. Bachelard\u2019s Water and Dreams \u2013 narcissistic dissolution, still water and death, the reverie of drowning as intimate death, the maternal embrace that does not let go because it never intended to hold. Coleridge\u2019s Ancient Mariner \u2013 water everywhere, potability as metaphor, the albatross of ecological guilt, abundance without access, punishment through the very element that should sustain. Tarkovsky\u2019s liquid cinema \u2013 Stalker\u2019s Zone seeps, rain falls through roofs, rivers flow through living rooms, water as time made visible, the medium through which meaning travels because meaning has always been wet. Von Trier\u2019s Melancholia \u2013 the dignity of surrender before the inevitable, when the wave comes, the question is not how to stop it but how to stand. Die Steigende Flut inherits all five: the regression, the reverie, the guilt, the patience, the surrender.',
  ],

  loreIntroDe: [
    'Die Sintflut ist der sechste Archetyp der Resonanzdungeons \u2013 und der geduldigste in seiner Gewalt. Die Steigende Flut ist keine \u00dcberschwemmung. \u00dcberschwemmungen implizieren ein diskretes Ereignis \u2013 Ankunft, Scheitel, R\u00fcckgang, die beruhigende Grammatik der Katastrophe mit Anfang und Ende. Die Steigende Flut ist ein Zustand. Das Wasser war immer hier; die Architektur hat lediglich aufgeh\u00f6rt, so zu tun, als w\u00e4re es anders. R\u00e4ume werden nicht \u00fcberflutet \u2013 sie erinnern sich, dass sie unter Wasser sind. Die Korridore fallen mit einer Absichtlichkeit ab, die kein Zufall sein kann: jemand hat diesen Raum entworfen, um beansprucht zu werden. Das Grauen ist nicht Ertrinken. Ertrinken ist zu pl\u00f6tzlich, zu dramatisch, zu bereit, sich anzuk\u00fcndigen. Das Grauen ist die geduldige, geologische Arithmetik der Verdr\u00e4ngung: das Wasser steigt 5cm pro Raum, und die Mathematik verhandelt nicht. Jeder Schritt tiefer ist ein Zugest\u00e4ndnis, das der Trupp nicht zur\u00fccknehmen kann. Jeder betretene Raum ist ein Raum, den die Oberfl\u00e4che vergisst. Die Steigende Flut greift nicht an. Sie akkumuliert.',
    'Der Pegel steigt mit der stillen Unausweichlichkeit von Gezeitentafeln: +5 pro durchquertem Raum in den Tiefen 1\u20132, +8 in den Tiefen 3\u20134, +12 ab Tiefe 5 und dar\u00fcber hinaus \u2013 die Flut beschleunigt, weil Tiefe selbst ein Argument f\u00fcr mehr Tiefe ist. Kampf addiert +3 pro Runde, weil Gewalt im Wasser verdr\u00e4ngt. Fehlgeschlagene Proben addieren +5, weil Inkompetenz in einem steigenden Medium nicht vergeben wird. Alle drei R\u00e4ume ein Gezeitenr\u00fcckgang: \u22128, abnehmend, weil die Flut gerade genug zur\u00fcckgibt, damit der Trupp an R\u00fcckzug glaubt. Bei 25 (Kn\u00f6chel) steigen die Bewegungskosten. Jeder Schritt k\u00fcndigt sich an. Das Wasser h\u00f6rt zu. Bei 50 (H\u00fcfte) multipliziert sich Stress \u00d71,15 und 15% Hinterhaltwahrscheinlichkeit taucht auf \u2013 Kampf im Wasser kostet doppelt, einmal f\u00fcr die Tat, einmal f\u00fcr das Medium. Bei 75 (Brust), Stress \u00d71,40, 35% Hinterhalt, Sichtradius schrumpft auf 2 R\u00e4ume. Das operative Vokabular schrumpft auf drei Verben: bergen, abdichten, aufsteigen. Bei 100, \u00fcberflutet \u2013 Stress \u00d72,0, das Wasser beansprucht, was es beh\u00e4lt. W\u00e4chter-Abdichtungen reduzieren das Wasser um 10, weil Eindringen das einzige Gegenargument ist, das die Flut akzeptiert. Die Mechanik ist geologische Zeit, komprimiert in einen Dungeonlauf: das Wasser hat dies schon getan und wird es wieder tun.',
    'Die literarische Architektur ruht auf f\u00fcnf S\u00e4ulen der Verdr\u00e4ngung. Ballards Drowned World \u2013 biologische Regression als Hingabe an die Tiefenzeit, der triassische Sog, der Zivilisation nicht in die Katastrophe zieht, sondern in eine R\u00fcckkehr zum Urspr\u00fcnglichen, wo Ertrinken Transzendenz ist, weil Bewusstsein immer nur vom Ozean geliehen war. Bachelards Wasser und Tr\u00e4ume \u2013 narzisstische Aufl\u00f6sung, stilles Wasser und Tod, die Tr\u00e4umerei des Ertrinkens als intimer Tod, die m\u00fctterliche Umarmung, die nicht losl\u00e4sst, weil sie nie vorhatte zu halten. Coleridges Alter Mariner \u2013 Wasser \u00fcberall, Trinkbarkeit als Metapher, der Albatros der \u00f6kologischen Schuld, \u00dcberfluss ohne Zugang, Bestrafung durch genau das Element, das erhalten sollte. Tarkowskis fl\u00fcssiges Kino \u2013 Stalkers Zone sickert, Regen f\u00e4llt durch D\u00e4cher, Fl\u00fcsse flie\u00dfen durch Wohnzimmer, Wasser als sichtbar gemachte Zeit, das Medium, durch das Bedeutung reist, weil Bedeutung immer feucht war. Von Triers Melancholia \u2013 die W\u00fcrde der Hingabe vor dem Unvermeidlichen, wenn die Welle kommt, ist die Frage nicht, wie man sie aufh\u00e4lt, sondern wie man steht. Die Steigende Flut erbt alle f\u00fcnf: die Regression, die Tr\u00e4umerei, die Schuld, die Geduld, die Hingabe.',
  ],

  // ── Entrance Texts (5 variants, verbatim from DB seed) ──

  entranceTexts: [
    'The stairs descend. The last three steps are wet. Not splashed \u2013 saturated. The water has been here before and left a mineral signature. It will return.',
    'Dripping. Rhythmic. The sound precedes the dungeon \u2013 a metronome set by geology. The party counts the interval. 3.2 seconds. The interval will shorten.',
    'The air is different here. Humid. Heavy. The kind of air that has passed through water recently and carries its memory. Salt. Mineral. Patience.',
    'A watermark on the entrance arch. Faint. Mineral-white. Evidence of a previous visit by something that does not knock.',
    'The threshold is damp. Beyond it, the floor slopes downward \u2013 gently, deliberately. The architecture was designed for drainage. The drainage has failed.',
  ],
  entranceTextsDe: [
    'Die Treppe f\u00fchrt hinab. Die letzten drei Stufen sind nass. Nicht bespritzt \u2013 durcht\u00e4nkt. Das Wasser war schon hier und hinterlie\u00df eine mineralische Signatur. Es wird zur\u00fcckkehren.',
    'Tropfen. Rhythmisch. Das Ger\u00e4usch geht dem Dungeon voraus \u2013 ein von der Geologie eingestelltes Metronom. Der Trupp z\u00e4hlt das Intervall. 3,2 Sekunden. Das Intervall wird sich verk\u00fcrzen.',
    'Die Luft ist hier anders. Feucht. Schwer. Die Art Luft, die k\u00fcrzlich durch Wasser ging und seine Erinnerung tr\u00e4gt. Salz. Mineral. Geduld.',
    'Ein Wasserzeichen am Eingangsbogen. Schwach. Mineralwei\u00df. Beweis f\u00fcr einen fr\u00fcheren Besuch durch etwas, das nicht anklopft.',
    'Die Schwelle ist feucht. Dahinter f\u00e4llt der Boden ab \u2013 sanft, absichtlich. Die Architektur wurde f\u00fcr Entw\u00e4sserung entworfen. Die Entw\u00e4sserung hat versagt.',
  ],

  // ── Mechanic ──

  mechanicName: 'Rising Tide',
  mechanicNameDe: 'Steigende Flut',
  mechanicDescription:
    'Die Steigende Flut\u2019s unique resonance mechanic. Water level rises per room traversed, per combat round, and per failed check \u2013 the flood does not punish incompetence, it simply notes it in fluid. At 0 (dry), normal operation: the architecture holds, the seals contain, the math is theoretical. At 25 (ankle), movement costs increase \u2013 every step announces itself, and the water listens. At 50 (waist), stress \u00d71.15, 15% ambush \u2013 combat in water costs twice, once for the act, once for the medium. At 75 (chest), stress \u00d71.40, 35% ambush, vision 2 rooms \u2013 the operational vocabulary contracts to salvage, seal, ascend. At 100 (submerged), stress \u00d72.0. The water claims what it keeps. Guardian seal actions reduce water by 10. The mechanic is geological patience: the water has done this before and will do it again.',
  mechanicDescriptionDe:
    'Die einzigartige Resonanzmechanik der Steigenden Flut. Der Pegel steigt pro durchquertem Raum, pro Kampfrunde und pro fehlgeschlagener Probe \u2013 die Flut bestraft Inkompetenz nicht, sie vermerkt sie lediglich in Fl\u00fcssigkeit. Bei 0 (trocken), Normalbetrieb: die Architektur h\u00e4lt, die Siegel fassen, die Mathematik ist theoretisch. Bei 25 (Kn\u00f6chel) steigen die Bewegungskosten \u2013 jeder Schritt k\u00fcndigt sich an, und das Wasser h\u00f6rt zu. Bei 50 (H\u00fcfte), Stress \u00d71,15, 15% Hinterhalt \u2013 Kampf im Wasser kostet doppelt, einmal f\u00fcr die Tat, einmal f\u00fcr das Medium. Bei 75 (Brust), Stress \u00d71,40, 35% Hinterhalt, Sicht 2 R\u00e4ume \u2013 das operative Vokabular schrumpft auf bergen, abdichten, aufsteigen. Bei 100 (\u00fcberflutet), Stress \u00d72,0. Das Wasser beansprucht, was es beh\u00e4lt. W\u00e4chter-Abdichtungen reduzieren das Wasser um 10. Die Mechanik ist geologische Geduld: das Wasser hat dies schon getan und wird es wieder tun.',

  mechanicGauge: {
    name: 'Water Level',
    nameDe: 'Pegel',
    start: 0,
    max: 100,
    direction: 'fill',
    thresholds: [
      { value: 0, label: 'Dry', labelDe: 'Trocken', description: 'Normal operation. The architecture holds. For now.', descriptionDe: 'Normaler Betrieb. Die Architektur h\u00e4lt. Noch.' },
      { value: 25, label: 'Ankle', labelDe: 'Kn\u00f6chel', description: 'Movement costs increase. Every step announces itself. The water listens.', descriptionDe: 'Bewegungskosten steigen. Jeder Schritt k\u00fcndigt sich an. Das Wasser h\u00f6rt zu.' },
      { value: 50, label: 'Waist', labelDe: 'H\u00fcfte', description: 'Stress \u00d71.15. 15% ambush. Combat in water costs twice \u2013 once for the act, once for the medium.', descriptionDe: 'Stress \u00d71,15. 15% Hinterhalt. Kampf im Wasser kostet doppelt \u2013 einmal f\u00fcr die Tat, einmal f\u00fcr das Medium.' },
      { value: 75, label: 'Chest', labelDe: 'Brust', description: 'Stress \u00d71.40. 35% ambush. Vision 2 rooms. The operational vocabulary contracts: salvage, seal, ascend.', descriptionDe: 'Stress \u00d71,40. 35% Hinterhalt. Sicht 2 R\u00e4ume. Das operative Vokabular schrumpft: bergen, abdichten, aufsteigen.' },
      { value: 100, label: 'Submerged', labelDe: '\u00dcberflutet', description: 'Stress \u00d72.0. The water claims what it keeps. Equivalent to wipe.', descriptionDe: 'Stress \u00d72,0. Das Wasser beansprucht, was es beh\u00e4lt. Entspricht Niederlage.' },
    ],
  },

  mechanicGaugePreviewValue: 38,

  aptitudeWeights: {
    Guardian: 30,
    Spy: 25,
    Saboteur: 20,
    Propagandist: 10,
    Infiltrator: 10,
    Assassin: 5,
  },

  roomDistribution: {
    Combat: 25,
    Encounter: 35,
    Elite: 5,
    Rest: 10,
    Treasure: 15,
    Exit: 10,
  },

  // ── Enemies ──

  enemies: [
    {
      name: 'Riptide Tendril', nameDe: 'Sogranke',
      tier: 'minion', power: 2, stress: 3, evasion: 40,
      ability: 'Drag', abilityDe: 'Ziehen', aptitude: 'Infiltrator',
      description: 'A current given form. It does not strike \u2013 it pulls. The direction is always down, always toward deeper water.',
      descriptionDe: 'Eine Str\u00f6mung, die Form angenommen hat. Sie schl\u00e4gt nicht zu \u2013 sie zieht. Die Richtung ist immer abw\u00e4rts, immer in tieferes Wasser.',
    },
    {
      name: 'Pressure Surge', nameDe: 'Druckwelle',
      tier: 'standard', power: 4, stress: 5, evasion: 10,
      ability: 'Flood Pulse', abilityDe: 'Flutpuls', aptitude: 'Saboteur',
      description: 'The water\u2019s memory of what it once displaced. It arrives as a wall \u2013 not tall, not dramatic, but dense. The kind of force that moves furniture and doesn\u2019t notice.',
      descriptionDe: 'Die Erinnerung des Wassers an das, was es einst verdr\u00e4ngte. Es kommt als Wand \u2013 nicht hoch, nicht dramatisch, aber dicht. Die Art Kraft, die M\u00f6bel verschiebt und es nicht bemerkt.',
    },
    {
      name: 'Silt Revenant', nameDe: 'Schlickwiederg\u00e4nger',
      tier: 'elite', power: 3, stress: 6, evasion: 15,
      ability: 'Obscure', abilityDe: 'Verdunkeln', aptitude: 'Propagandist',
      description: 'It emerged from the sediment when the water reached this level. A shape made of what the flood deposited \u2013 silt, mineral, the residue of dissolved rooms. It does not speak. It broadcasts the sound of water in enclosed spaces.',
      descriptionDe: 'Es stieg aus dem Sediment, als das Wasser diesen Pegel erreichte. Eine Gestalt aus dem, was die Flut ablagerte \u2013 Schlick, Mineral, der R\u00fcckstand aufgel\u00f6ster R\u00e4ume. Es spricht nicht. Es sendet das Ger\u00e4usch von Wasser in geschlossenen R\u00e4umen.',
    },
    {
      name: 'Undertow Warden', nameDe: 'Sogw\u00e4chter',
      tier: 'elite', power: 5, stress: 6, evasion: 5,
      ability: 'Drag', abilityDe: 'Ziehen', aptitude: 'Saboteur',
      description: 'The water\u2019s enforcer. Not an entity that lives in water \u2013 an entity that IS water, given mass and purpose. It does not guard a door. It guards a depth.',
      descriptionDe: 'Der Vollstrecker des Wassers. Keine Entit\u00e4t, die im Wasser lebt \u2013 eine Entit\u00e4t, die Wasser IST, mit Masse und Absicht versehen. Es bewacht keine T\u00fcr. Es bewacht eine Tiefe.',
    },
    {
      name: 'The Current', nameDe: 'Die Str\u00f6mung',
      tier: 'boss', power: 6, stress: 8, evasion: 0,
      ability: 'Tidal Wave', abilityDe: 'Flutwelle', aptitude: 'Guardian',
      description: 'Not an enemy. A direction. The Current is the flood\u2019s final argument: that everything flows downward, that every barrier is temporary, that what the water claims, the water keeps. It does not attack. It arrives.',
      descriptionDe: 'Kein Feind. Eine Richtung. Die Str\u00f6mung ist das letzte Argument der Flut: dass alles abw\u00e4rts flie\u00dft, dass jede Barriere vor\u00fcbergehend ist, dass was das Wasser beansprucht, das Wasser beh\u00e4lt. Sie greift nicht an. Sie kommt.',
    },
  ],

  // ── Encounters ──

  encounterPreviews: [
    {
      name: 'The Watermark', nameDe: 'Das Wasserzeichen',
      depth: '1\u20133', type: 'narrative',
      description: 'A line on the wall. Faint. Mineral-white. The watermark shows how high the water reached last time.',
      descriptionDe: 'Eine Linie an der Wand. Schwach. Mineralwei\u00df. Das Wasserzeichen zeigt, wie hoch das Wasser beim letzten Mal stand.',
      choices: [
        { text: 'Study the watermark', textDe: 'Das Wasserzeichen studieren', aptitude: 'Spy', difficulty: '+5' },
        { text: 'Seal below the mark', textDe: 'Unterhalb der Markierung abdichten', aptitude: 'Guardian', difficulty: '+5' },
        { text: 'Ignore it and move', textDe: 'Ignorieren und weitergehen' },
      ],
    },
    {
      name: 'The Submerged Cache', nameDe: 'Das versunkene Depot',
      depth: '2\u20134', type: 'narrative',
      description: 'Through the water below \u2013 shapes. Containers. Something the flood deposited here from a room that no longer exists.',
      descriptionDe: 'Durch das Wasser darunter \u2013 Formen. Beh\u00e4lter. Etwas, das die Flut aus einem Raum hierhin ablagerte, der nicht mehr existiert.',
      choices: [
        { text: 'Dive for it', textDe: 'Danach tauchen', aptitude: 'Guardian', difficulty: '+5' },
        { text: 'Send the sharpest eyes', textDe: 'Die sch\u00e4rfsten Augen schicken', aptitude: 'Spy', difficulty: '+5' },
        { text: 'Leave it. The water owns it now.', textDe: 'Lassen. Das Wasser besitzt es jetzt.' },
      ],
    },
    {
      name: 'The Breach', nameDe: 'Der Riss',
      depth: '2\u20135', type: 'narrative',
      description: 'A crack in the wall. Water doesn\u2019t pour through it \u2013 it persuades. A thin, persistent line of moisture that widens as you watch.',
      descriptionDe: 'Ein Riss in der Wand. Wasser str\u00f6mt nicht hindurch \u2013 es \u00fcberzeugt. Eine d\u00fcnne, beharrliche Feuchtigkeitslinie, die sich erweitert, w\u00e4hrend man zusieht.',
      choices: [
        { text: 'Seal it', textDe: 'Abdichten', aptitude: 'Saboteur', difficulty: '+5' },
        { text: 'Redirect it', textDe: 'Umleiten', aptitude: 'Spy', difficulty: '+5' },
        { text: 'Weaponize the breach', textDe: 'Den Riss als Waffe nutzen', aptitude: 'Assassin', difficulty: '+0' },
      ],
    },
    {
      name: 'The Survivor\u2019s Message', nameDe: 'Die Nachricht des \u00dcberlebenden',
      depth: '3\u20135', type: 'narrative',
      description: 'Carved into the wall above the current waterline. Recent. Someone else tried this. The message is incomplete \u2013 the water reached it before they finished.',
      descriptionDe: 'In die Wand geritzt \u00fcber der aktuellen Wasserlinie. K\u00fcrzlich. Jemand anderes hat dies versucht. Die Nachricht ist unvollst\u00e4ndig \u2013 das Wasser erreichte sie, bevor sie fertig waren.',
      choices: [
        { text: 'Read what remains', textDe: 'Lesen, was \u00fcbrig ist', aptitude: 'Propagandist', difficulty: '+5' },
        { text: 'Add to it', textDe: 'Erg\u00e4nzen', aptitude: 'Spy', difficulty: '+0' },
      ],
    },
    {
      name: 'The Sound of Depth', nameDe: 'Das Ger\u00e4usch der Tiefe',
      depth: '3\u20136', type: 'narrative',
      description: 'The water below has reached a resonance. A low hum. Not mechanical \u2013 geological. The sound the planet makes when it remembers it is mostly ocean.',
      descriptionDe: 'Das Wasser darunter hat eine Resonanz erreicht. Ein tiefes Summen. Nicht mechanisch \u2013 geologisch. Das Ger\u00e4usch, das der Planet macht, wenn er sich erinnert, dass er gr\u00f6\u00dftenteils Ozean ist.',
      choices: [
        { text: 'Listen', textDe: 'Lauschen', aptitude: 'Propagandist', difficulty: '+0' },
        { text: 'Measure it', textDe: 'Messen', aptitude: 'Spy', difficulty: '+5' },
        { text: 'Block it out', textDe: 'Ausblenden' },
      ],
    },
  ],

  // ── Banter (4-tier water progression) ──

  banterSamples: [
    { text: 'The floor is damp. Not wet \u2013 damp. The kind of moisture that precedes a statement.', textDe: 'Der Boden ist feucht. Nicht nass \u2013 feucht. Die Art Feuchtigkeit, die einer Aussage vorausgeht.', tier: 0 },
    { text: 'Water at 12cm. Clear. The room is legible through it. That will change.', textDe: 'Wasser bei 12cm. Klar. Der Raum ist hindurch lesbar. Das wird sich \u00e4ndern.', tier: 0 },
    { text: 'The waterline on the wall is 7cm higher than when the party entered this floor. The arithmetic is not complicated.', textDe: 'Die Wasserlinie an der Wand ist 7cm h\u00f6her als beim Betreten dieser Etage. Die Arithmetik ist nicht kompliziert.', tier: 1 },
    { text: 'Combat in water. Every action costs twice \u2013 once for the act, once for the medium.', textDe: 'Kampf im Wasser. Jede Aktion kostet doppelt \u2013 einmal f\u00fcr die Tat, einmal f\u00fcr das Medium.', tier: 1 },
    { text: 'Half-submerged. The water is cold and has opinions about which direction the party should move.', textDe: 'Halb \u00fcberflutet. Das Wasser ist kalt und hat Meinungen dar\u00fcber, in welche Richtung sich die Gruppe bewegen sollte.', tier: 2 },
    { text: 'The current carries debris from rooms below. Fragments of encounters that are now depths.', textDe: 'Die Str\u00f6mung tr\u00e4gt Tr\u00fcmmer aus R\u00e4umen darunter. Fragmente von Begegnungen, die jetzt Tiefen sind.', tier: 2 },
    { text: 'The tide returns. Higher. It always returns higher.', textDe: 'Die Flut kehrt zur\u00fcck. H\u00f6her. Sie kehrt immer h\u00f6her zur\u00fcck.', tier: 2 },
    { text: 'Three rooms above the waterline. Two hours ago there were five. The mathematics has not changed, only the denominator.', textDe: 'Drei R\u00e4ume \u00fcber der Wasserlinie. Vor zwei Stunden waren es f\u00fcnf. Die Mathematik hat sich nicht ge\u00e4ndert, nur der Nenner.', tier: 3 },
  ],

  // ── Literary Influences ──

  authors: [
    { name: 'J.G. Ballard', works: 'The Drowned World', concept: 'Biological regression as surrender to deep time. The Triassic pull \u2013 civilization dissolving not through catastrophe but through a return to the primordial. Drowning as transcendence, not tragedy.', conceptDe: 'Biologische Regression als Hingabe an die Tiefenzeit. Der triassische Sog \u2013 Zivilisation, die sich nicht durch Katastrophe aufl\u00f6st, sondern durch R\u00fcckkehr zum Urspr\u00fcnglichen. Ertrinken als Transzendenz, nicht Trag\u00f6die.', language: 'English', quote: 'The further south they moved, the more the biological clock within them reverted to a more primitive time.', primary: true },
    { name: 'Gaston Bachelard', works: 'Water and Dreams', concept: 'Narcissistic dissolution \u2013 still water and death. The reverie of drowning: water as the element of intimate death, the maternal embrace that does not let go.', conceptDe: 'Narzistische Aufl\u00f6sung \u2013 stilles Wasser und Tod. Die Tr\u00e4umerei des Ertrinkens: Wasser als Element des intimen Todes, die m\u00fctterliche Umarmung, die nicht lossl\u00e4sst.', language: 'Fran\u00e7ais', quote: 'Still water brings us back to our dead.', primary: true },
    { name: 'Samuel Taylor Coleridge', works: 'The Rime of the Ancient Mariner', concept: 'Water everywhere, potability as metaphor. The albatross of ecological guilt \u2013 abundance without access, punishment through the very element that should sustain.', conceptDe: 'Wasser \u00fcberall, Trinkbarkeit als Metapher. Der Albatros der \u00f6kologischen Schuld \u2013 \u00dcberfluss ohne Zugang, Bestrafung durch genau das Element, das erhalten sollte.', language: 'English', quote: 'Water, water, every where, nor any drop to drink.', primary: true },
    { name: 'Andrei Tarkovsky', works: 'Stalker \u00b7 Solaris \u00b7 Nostalghia', concept: 'Liquid cinema \u2013 water as time made visible. Every Tarkovsky film is a flood film: the Zone seeps, rain falls through roofs, rivers flow through living rooms. Water is not a metaphor. Water is the medium through which meaning travels.', conceptDe: 'Fl\u00fcssiges Kino \u2013 Wasser als sichtbar gemachte Zeit. Jeder Tarkovsky-Film ist ein Flutfilm: die Zone sickert, Regen f\u00e4llt durch D\u00e4cher, Fl\u00fcsse flie\u00dfen durch Wohnzimmer. Wasser ist keine Metapher. Wasser ist das Medium, durch das Bedeutung reist.', language: 'Russian', primary: false },
    { name: 'Lars von Trier', works: 'Melancholia', concept: 'The dignity of surrender before the inevitable. When the wave comes, the question is not how to stop it but how to stand.', conceptDe: 'Die W\u00fcrde der Hingabe vor dem Unvermeidlichen. Wenn die Welle kommt, ist die Frage nicht, wie man sie aufh\u00e4lt, sondern wie man steht.', language: 'Dansk', primary: false },
    { name: 'Rachel Carson', works: 'The Sea Around Us \u00b7 Silent Spring', concept: 'The ocean remembers everything. Geological patience as moral authority \u2013 the water was here first, will be here last, and its claim on every surface is not aggression but correction.', conceptDe: 'Der Ozean erinnert sich an alles. Geologische Geduld als moralische Autorit\u00e4t \u2013 das Wasser war zuerst hier, wird zuletzt hier sein, und sein Anspruch auf jede Oberfl\u00e4che ist nicht Aggression, sondern Korrektur.', language: 'English', primary: false },
  ],

  // ── Objektanker (displacement narrative: each phase wetter) ──

  objektanker: [
    {
      name: 'The Watermark', nameDe: 'Das Wasserzeichen',
      phases: [
        { label: 'Discovery', labelDe: 'Entdeckung', text: 'A line on the wall. Mineral-white, ruler-straight, deposited by water that rose to this exact height and held there long enough to leave a record. The line is old. The precision is not. Something measured this room before you entered it.', textDe: 'Eine Linie an der Wand. Mineralwei\u00df, linealgrade, hinterlassen von Wasser, das bis zu genau dieser H\u00f6he stieg und lang genug dort verharrte, um eine Aufzeichnung zu hinterlassen. Die Linie ist alt. Die Pr\u00e4zision nicht. Etwas hat diesen Raum vermessen, bevor ihr ihn betreten habt.' },
        { label: 'Echo', labelDe: 'Echo', text: 'Another watermark. Higher. Same mineral deposit, same precision. The water has been here before \u2013 more than once. Each visit, it stayed longer.', textDe: 'Ein weiteres Wasserzeichen. H\u00f6her. Selbe Mineralablagerung, selbe Pr\u00e4zision. Das Wasser war schon hier \u2013 mehr als einmal. Bei jedem Besuch blieb es l\u00e4nger.' },
        { label: 'Mutation', labelDe: 'Mutation', text: 'The wall is a chronicle. Dozens of lines, each higher than the last, each a record of a flood that rose and receded and rose again. The intervals between them are shrinking. The most recent line is still damp.', textDe: 'Die Wand ist eine Chronik. Dutzende Linien, jede h\u00f6her als die vorige, jede eine Aufzeichnung einer Flut, die stieg und wich und wieder stieg. Die Abst\u00e4nde zwischen ihnen werden kleiner. Die j\u00fcngste Linie ist noch feucht.' },
        { label: 'Climax', labelDe: 'H\u00f6hepunkt', text: 'One line remains. At the ceiling. The mineral deposit is fresh \u2013 still crystallizing. The water that made this mark has not yet receded. It is here.', textDe: 'Eine Linie bleibt. An der Decke. Die Mineralablagerung ist frisch \u2013 kristallisiert noch. Das Wasser, das dieses Zeichen hinterlie\u00df, ist noch nicht zur\u00fcckgewichen. Es ist hier.' },
      ],
    },
    {
      name: 'The Seal', nameDe: 'Das Siegel',
      phases: [
        { label: 'Discovery', labelDe: 'Entdeckung', text: 'A seal in the floor. Wax over iron, stamped with a symbol that might be a warning or a promise \u2013 the distinction depends on which side of the seal you are standing on. Beneath it: the sound of pressure.', textDe: 'Ein Siegel im Boden. Wachs \u00fcber Eisen, gepr\u00e4gt mit einem Symbol, das eine Warnung oder ein Versprechen sein k\u00f6nnte \u2013 die Unterscheidung h\u00e4ngt davon ab, auf welcher Seite des Siegels man steht. Darunter: das Ger\u00e4usch von Druck.' },
        { label: 'Echo', labelDe: 'Echo', text: 'The seal again. Hairline fractures run through the wax like veins. Moisture beads along each crack. The seal is not breaking \u2013 it is perspiring.', textDe: 'Das Siegel erneut. Haarrisse durchziehen das Wachs wie Adern. Feuchtigkeit perlt entlang jedes Risses. Das Siegel bricht nicht \u2013 es schwitzt.' },
        { label: 'Mutation', labelDe: 'Mutation', text: 'The seal weeps. The wax has softened \u2013 not from heat but from patience. Water seeps through the iron beneath in a film so thin it seems like condensation. The boundary is not failing. It is dissolving.', textDe: 'Das Siegel weint. Das Wachs ist weich geworden \u2013 nicht durch Hitze, sondern durch Geduld. Wasser sickert durch das Eisen darunter in einem Film so d\u00fcnn, dass er wie Kondenswasser wirkt. Die Grenze versagt nicht. Sie l\u00f6st sich auf.' },
        { label: 'Climax', labelDe: 'H\u00f6hepunkt', text: 'No seal. No hatch. No distinction between above and below. The water is here not because it broke through \u2013 because \u2018through\u2019 stopped meaning anything.', textDe: 'Kein Siegel. Keine Luke. Keine Unterscheidung zwischen oben und unten. Das Wasser ist hier, nicht weil es durchbrach \u2013 weil \u00bbdurch\u00ab aufgeh\u00f6rt hat, etwas zu bedeuten.' },
      ],
    },
    {
      name: 'The Bottle', nameDe: 'Die Flasche',
      phases: [
        { label: 'Discovery', labelDe: 'Entdeckung', text: 'A bottle. Glass, sealed with wax. Inside: air. Not a message \u2013 the medium is the message. Someone preserved the last breath of a dry room.', textDe: 'Eine Flasche. Glas, mit Wachs versiegelt. Darin: Luft. Keine Botschaft \u2013 das Medium ist die Botschaft. Jemand hat den letzten Atemzug eines trockenen Raums konserviert.' },
        { label: 'Echo', labelDe: 'Echo', text: 'The bottle again. The current has carried it to the far wall, where it bobs against the surface with the patience of something that has learned to float.', textDe: 'Die Flasche wieder. Die Str\u00f6mung hat sie zur gegen\u00fcberliegenden Wand getragen, wo sie gegen die Oberfl\u00e4che wippt mit der Geduld von etwas, das schwimmen gelernt hat.' },
        { label: 'Mutation', labelDe: 'Mutation', text: 'The seal is failing. Air escapes in silver beads that rise through the water and break at the surface without sound. Each bubble smaller than the last. The room is inheriting the bottle\u2019s contents.', textDe: 'Das Siegel versagt. Luft entweicht in silbernen Perlen, die durch das Wasser aufsteigen und an der Oberfl\u00e4che lautlos zerplatzen. Jede Blase kleiner als die vorige. Der Raum erbt den Inhalt der Flasche.' },
        { label: 'Climax', labelDe: 'H\u00f6hepunkt', text: 'Empty. The glass is full of water now. The air it held is in the room \u2013 in the ceiling pocket where the party still stands dry. The bottle kept its promise. It delivered.', textDe: 'Leer. Das Glas ist jetzt voll Wasser. Die Luft, die es hielt, ist im Raum \u2013 in der Deckentasche, wo der Trupp noch trocken steht. Die Flasche hat ihr Versprechen gehalten. Sie hat geliefert.' },
      ],
    },
    {
      name: 'The Depth Gauge', nameDe: 'Das Tiefenmessger\u00e4t',
      phases: [
        { label: 'Discovery', labelDe: 'Entdeckung', text: 'A gauge, mounted to the wall. Brass, glass-fronted, calibrated in meters. The scale runs from zero to thirty. The current reading: 0.2. The water in this room is dry. The gauge disagrees.', textDe: 'Eine Anzeige, an der Wand montiert. Messing, glasverkleidet, kalibriert in Metern. Die Skala reicht von null bis drei\u00dfig. Die aktuelle Anzeige: 0,2. Das Wasser in diesem Raum ist trocken. Die Anzeige widerspricht.' },
        { label: 'Echo', labelDe: 'Echo', text: 'The gauge again. It reads 4.7. The room is dry here. The reading is not wrong \u2013 it is premature.', textDe: 'Die Anzeige erneut. Sie zeigt 4,7. Der Raum ist hier trocken. Die Anzeige ist nicht falsch \u2013 sie ist verfr\u00fcht.' },
        { label: 'Mutation', labelDe: 'Mutation', text: 'The gauge reads the exact depth of the current room. To the centimeter. It was calibrated for this moment, in this room, long before either existed. The precision is not mechanical. It is patient.', textDe: 'Die Anzeige zeigt die exakte Tiefe des aktuellen Raums. Auf den Zentimeter. Sie wurde f\u00fcr diesen Moment kalibriert, in diesem Raum, lange bevor es beide gab. Die Pr\u00e4zision ist nicht mechanisch. Sie ist geduldig.' },
        { label: 'Climax', labelDe: 'H\u00f6hepunkt', text: 'The gauge reads zero. Not because the water has receded. Because the gauge is submerged, and underwater, depth is not a number. It is a condition.', textDe: 'Die Anzeige zeigt null. Nicht weil das Wasser gewichen ist. Weil die Anzeige unter Wasser steht, und unter Wasser ist Tiefe keine Zahl. Sie ist ein Zustand.' },
      ],
    },
  ],

  // ── Loot Showcase ──

  lootShowcase: [
    { name: 'Brine Residue', nameDe: 'Salzr\u00fcckstand', tier: 1, effect: 'Stress heal 50', description: 'Crystallized from evaporated floodwater. Holding it steadies the pulse. A mineral memory of when the water was calm.', descriptionDe: 'Kristallisiert aus verdunstetem Flutwasser. Es in der Hand zu halten beruhigt den Puls. Eine mineralische Erinnerung an die Zeit, als das Wasser ruhig war.' },
    { name: 'Current Map', nameDe: 'Str\u00f6mungskarte', tier: 1, effect: 'Spy +5% (dungeon)', description: 'A trace of the water\u2019s preferred paths through the architecture. Spy checks +5% \u2013 the flood is legible to those who study its grammar.', descriptionDe: 'Eine Spur der bevorzugten Wege des Wassers durch die Architektur. Spion-Proben +5% \u2013 die Flut ist lesbar f\u00fcr jene, die ihre Grammatik studieren.' },
    { name: 'Pressure Ward', nameDe: 'Druckschutz', tier: 2, effect: 'Stress heal 120', description: 'Equalized pressure from a sealed chamber. The relief is physical \u2013 the tension in the chest that was always there, gone.', descriptionDe: 'Ausgeglichener Druck aus einer versiegelten Kammer. Die Erleichterung ist k\u00f6rperlich \u2013 die Spannung in der Brust, die immer da war, verschwunden.' },
    { name: 'Tidal Insight', nameDe: 'Gezeiteneinsicht', tier: 2, effect: 'Spy +10% (dungeon)', description: 'The tide\u2019s pattern, internalized. Spy checks +10% \u2013 the flood\u2019s arithmetic, once opaque, now transparent.', descriptionDe: 'Das Muster der Gezeiten, verinnerlicht. Spion-Proben +10% \u2013 die Arithmetik der Flut, einst undurchsichtig, nun transparent.' },
    { name: 'Covenant Fragment', nameDe: 'Bundesfragment', tier: 3, effect: 'Guardian +1 (permanent)', description: 'A fragment of the promise the water made: to recede, eventually. Carrying it changes how the bearer relates to protection. Guardian aptitude +1.', descriptionDe: 'Ein Fragment des Versprechens, das das Wasser gab: zur\u00fcckzuweichen, irgendwann. Es zu tragen ver\u00e4ndert, wie der Tr\u00e4ger sich zu Schutz verh\u00e4lt. W\u00e4chter-Eignung +1.' },
    { name: 'Deep-Time Core', nameDe: 'Tiefzeitkern', tier: 3, effect: 'Spy +1 (permanent)', description: 'Compressed sediment from the lowest floor. It contains the memory of every room the water passed through. Perception sharpened permanently. Spy aptitude +1.', descriptionDe: 'Komprimiertes Sediment vom tiefsten Stockwerk. Es enth\u00e4lt die Erinnerung an jeden Raum, den das Wasser durchquerte. Wahrnehmung dauerhaft gesch\u00e4rft. Spion-Eignung +1.' },
  ],

  // ── Prose ──

  prose: {
    mechanicGainTitle: 'Tide Surge',
    mechanicGainTitleDe: 'Flutzunahme',
    mechanicGainText: '+5 per room (depth 1\u20132)\n+8 per room (depth 3\u20134)\n+12 per room (depth 5+)\n+3 per combat round\n+5 on failed check\n+2 per enemy hit',
    mechanicGainTextDe: '+5 pro Raum (Tiefe 1\u20132)\n+8 pro Raum (Tiefe 3\u20134)\n+12 pro Raum (Tiefe 5+)\n+3 pro Kampfrunde\n+5 bei fehlgeschlagener Probe\n+2 pro Feindtreffer',
    mechanicReduceTitle: 'Tidal Recession',
    mechanicReduceTitleDe: 'Gezeitenr\u00fcckgang',
    mechanicReduceText: '\u22128 every 3 rooms (diminishing)\n\u221210 on Guardian seal action\n\u22125 on rest',
    mechanicReduceTextDe: '\u22128 alle 3 R\u00e4ume (abnehmend)\n\u221210 bei W\u00e4chter-Abdichtung\n\u22125 bei Rast',
    mechanicReduceEmphasis: 'The water has done this before. It will do it again.',
    mechanicReduceEmphasisDe: 'Das Wasser hat dies schon getan. Es wird es wieder tun.',
    encounterIntro: 'Navigate the rising water. Every room costs displacement. The arithmetic does not negotiate.',
    encounterIntroDe: 'Navigiert das steigende Wasser. Jeder Raum kostet Verdr\u00e4ngung. Die Arithmetik verhandelt nicht.',
    bestiaryIntro: 'The denizens of Die Steigende Flut. Not enemies \u2013 currents with mass and memory.',
    bestiaryIntroDe: 'Die Bewohner der Steigenden Flut. Keine Feinde \u2013 Str\u00f6mungen mit Masse und Erinnerung.',
    banterHeader: 'Field Reports from Die Steigende Flut',
    banterHeaderDe: 'Feldberichte aus der Steigenden Flut',
    objektankerHeader: 'Artifacts of Die Steigende Flut',
    objektankerHeaderDe: 'Artefakte der Steigenden Flut',
    objektankerIntro: 'Objects that transform as the water rises. Each phase wetter than the last \u2013 the flood claims even its own landmarks.',
    objektankerIntroDe: 'Objekte, die sich transformieren, w\u00e4hrend das Wasser steigt. Jede Phase feuchter als die letzte \u2013 die Flut beansprucht sogar ihre eigenen Landmarken.',
    exitQuote: 'The world reminds its inhabitants: guests, not owners. The water was here first. The water will be here last.',
    exitQuoteDe: 'Die Welt erinnert ihre Bewohner: G\u00e4ste, nicht Eigent\u00fcmer. Das Wasser war zuerst hier. Das Wasser wird zuletzt hier sein.',
    exitCta: 'Enter Die Steigende Flut',
    exitCtaDe: 'Die Steigende Flut betreten',
    exitCtaText: 'You survived the exhibition. Now survive the displacement.',
    exitCtaTextDe: 'Ihr habt die Ausstellung \u00fcberlebt. Jetzt \u00fcberlebt die Verdr\u00e4ngung.',
  },

  // ── Navigation ──

  prevArchetype: getNav('prometheus'),
  nextArchetype: getNav('awakening'),
};

// ── The Awakening — Full Bilingual Content ──────────────────────────────────

const AWAKENING_DETAIL: ArchetypeDetail = {
  ...getBaseSlide('awakening'),

  // ── Lore Introduction (3 paragraphs, fresh literary prose) ──

  loreIntro: [
    'The Awakening is the seventh archetype of the Resonance Dungeons \u2013 and the only one that is not, strictly speaking, a place. Das Kollektive Unbewusste is not a dungeon. It is a consciousness that has forgotten it is a dungeon. The architecture does not contain memories \u2013 it IS memory. Rooms are not explored; they are remembered. The corridors do not lead somewhere \u2013 they lead somewhen. Every threshold crossed is a return to something the party has never experienced but has always known. Jung called it the collective unconscious: the psychic substrate beneath individual identity, where personal biography dissolves into archetypal pattern. The party descends into this substrate. The horror is not what they find \u2013 it is the recognition that everything found was always theirs. The dungeon does not contain the party. The party contains the dungeon. They have always contained it. The Awakening merely makes this legible.',
    'Awareness accumulates with the quiet arithmetic of consciousness noticing itself. Per room traversed: +5 at depths 1\u20132, +8 at depths 3\u20134, +12 at depth 5 and beyond \u2013 consciousness deepens because depth itself is an argument for more depth. Combat adds +2 per round, because violence in a psychic medium leaves marks on the medium. Failed checks add +5, because incompetence in consciousness is not forgiven \u2013 it is remembered. Enemy hits add +3, because every wound in the unconscious is a wound the unconscious inflicts on itself. At 0 (Dormant), the consciousness sleeps. Normal operation. The architecture is inert. At 25 (Stirring), the consciousness stirs \u2013 rooms adjust to the party, d\u00e9j\u00e0 vu begins, the architecture develops preferences about being observed. At 50 (Liminal), stress \u00d71.15 \u2013 the threshold between conscious and unconscious, where the dungeon perceives and the perceiving changes what is perceived. At 75 (Lucid), stress \u00d71.35, 20% ambush, environment responds to thought \u2013 but the response is not always what was intended, and loot quality gains a +40% bonus because consciousness, fully awake, is generous with its own artifacts. At 100 (Awakened), stress \u00d72.0, 40% ambush \u2013 the party is no longer navigating. They are being thought. The mechanic is Bergson\u2019s cone of memory: the narrow summit of present experience, the expanding base of accumulated consciousness. Ground action (meditation) reduces awareness by 10. Rest reduces by 5. Every 3 rooms, a natural recession of \u22128. The consciousness has done this before. It will do it again.',
    'The literary architecture rests on six pillars of recognition. Jung\u2019s Red Book \u2013 the dialogue with the unconscious, Philemon as autonomous thought that arrives like an animal in the forest, generated not by the thinker but by the thinking itself. Proust\u2019s involuntary memory \u2013 the madeleine, the intermittences du coeur, sensation arriving before the memory it unlocks, grief that comes decades late triggered by the act of resting, because the body remembers what the mind has forbidden. Borges\u2019s Funes \u2013 too much memory, no abstraction, the overly replete world where to think is to forget differences and Funes cannot think because he cannot forget. Kafka\u2019s two clocks \u2013 the inner one racing at an inhuman pace, the outer one limping its ordinary course, and the terrible question: what else can happen but that the two worlds split apart? Tarkovsky\u2019s Zone \u2013 the Room that grants the true desire, not the stated one, consciousness as landscape that responds to the visitor rather than the map, where everything depends not on the Zone but on the visitor. Ishiguro\u2019s Buried Giant \u2013 collective forgetting as ethical choice, the mist that erases memory protecting as much as it harms, some truths buried for reasons the buriers understood better than the excavators. Das Kollektive Unbewusste inherits all six: the dialogue, the involuntary, the excess, the split, the desire, the forgetting. The party descends into the substrate. What surfaces is what was always there.',
  ],

  loreIntroDe: [
    'Das Erwachen ist der siebte Archetyp der Resonanzdungeons, und es ist \u2013 dies muss mit einer Genauigkeit gesagt werden, die dem Gegenstand selbst nicht mehr zusteht \u2013 der einzige, der kein Ort ist. Das Kollektive Unbewusste ist kein Dungeon; es ist ein Bewusstsein, das vergessen hat, eines zu sein, so wie der Tr\u00e4umende vergisst, dass er schl\u00e4ft, und erst im Vergessen zu tr\u00e4umen beginnt. Die Architektur enth\u00e4lt keine Erinnerungen \u2013 sie ist Erinnerung: geronnene, zu Stein gewordene, in Grundrisse gezwungene Erinnerung, die sich als Architektur ausgibt, ohne jemals etwas anderes gewesen zu sein. R\u00e4ume werden nicht erkundet; sie werden erinnert. Die Korridore f\u00fchren nicht irgendwohin \u2013 sie f\u00fchren irgendwann hin, in Schichten der Zeit, die der Trupp nie durchlebt hat und die ihm dennoch geh\u00f6ren, so wie dem Erwachenden die Tr\u00e4ume geh\u00f6ren, die er nicht erinnern kann und die ihn dennoch geformt haben. Jung nannte es das kollektive Unbewusste: jenes psychische Substrat unterhalb der individuellen Identit\u00e4t, in dem pers\u00f6nliche Biographie sich in archetypisches Muster aufl\u00f6st wie Zucker in Wasser \u2013 die Substanz verschwindet, die S\u00fc\u00dfe bleibt. Der Trupp steigt in dieses Substrat hinab. Das Grauen liegt nicht in dem, was er findet \u2013 es liegt in der Erkenntnis, dass alles Gefundene immer schon seines war, dass das Dungeon den Trupp nicht enth\u00e4lt, sondern der Trupp das Dungeon, und dass er es, so muss man annehmen, immer schon enthalten hat. Das Erwachen macht dies lediglich lesbar.',
    'Bewusstsein h\u00e4uft sich an mit der stillen Arithmetik eines Bewusstseins, das sich selbst dabei ertappt, zu bemerken. Pro durchquertem Raum: +5 in den Tiefen 1\u20132, +8 in den Tiefen 3\u20134, +12 ab Tiefe 5 \u2013 das Bewusstsein vertieft sich, weil Tiefe selbst ein Argument f\u00fcr mehr Tiefe ist, so wie der Graben tiefer wird, indem man gr\u00e4bt. Kampf f\u00fcgt +2 pro Runde hinzu, denn Gewalt in einem psychischen Medium hinterl\u00e4sst Spuren nicht am K\u00f6rper, sondern am Medium selbst. Fehlgeschlagene Proben f\u00fcgen +5 hinzu, denn Inkompetenz wird im Bewusstsein nicht vergeben \u2013 sie wird erinnert, was schlimmer ist. Feindtreffer f\u00fcgen +3 hinzu, denn jede Wunde, die das Unbewusste empf\u00e4ngt, ist eine Wunde, die es sich selbst zuf\u00fcgt. Bei 0 (Schlafend) schl\u00e4ft das Bewusstsein. Regul\u00e4rer Betrieb. Die Architektur verh\u00e4lt sich still. Bei 25 (Regung) beginnt das Bewusstsein sich zu regen \u2013 die R\u00e4ume passen sich dem Trupp an, D\u00e9j\u00e0 vu setzt ein, die Architektur entwickelt, was man nur als Pr\u00e4ferenzen bezeichnen kann, beobachtet zu werden. Bei 50 (Schwelle), Stress \u00d71,15 \u2013 die Schwelle zwischen Bewusstem und Unbewusstem, jener Ort, an dem das Dungeon wahrnimmt und an dem das Wahrnehmen ver\u00e4ndert, was wahrgenommen wird. Bei 75 (Luzid), Stress \u00d71,35, 20% Hinterhalt \u2013 die Umgebung reagiert auf Gedanken, doch die Reaktion ist nicht immer die beabsichtigte, und die Beutequalit\u00e4t steigt um 40%, weil ein vollst\u00e4ndig waches Bewusstsein mit seinen eigenen Artefakten gro\u00dfz\u00fcgig umgeht. Bei 100 (Erwacht), Stress \u00d72,0, 40% Hinterhalt \u2013 die Gruppe navigiert nicht mehr. Sie wird gedacht. Die Mechanik folgt Bergsons Erinnerungskegel: der enge Gipfel der gegenw\u00e4rtigen Erfahrung, die sich ins Unermessliche ausdehnende Basis des akkumulierten Bewusstseins. Erdung (Meditation) reduziert das Bewusstsein um 10. Rast um 5. Alle drei R\u00e4ume ein nat\u00fcrlicher R\u00fcckgang von 8 \u2013 denn das Bewusstsein hat dies schon getan, und es wird es wieder tun.',
    'Die literarische Architektur ruht auf sechs S\u00e4ulen der Wiedererkennung, von denen jede einzelne, f\u00fcr sich genommen, bereits gen\u00fcgte, ein Dungeon zu begr\u00fcnden. Jungs Rotes Buch \u2013 der Dialog mit dem Unbewussten, in dem Philemon als autonomer Gedanke erscheint, der wie ein Tier im Wald ankommt; nicht vom Denker erzeugt, sondern vom Denken selbst hervorgebracht, eine Unterscheidung, die den Denker, wenn er sie einmal begriffen hat, nicht mehr losl\u00e4sst. Prousts unwillk\u00fcrliche Erinnerung \u2013 die Madeleine, die Intermittenzen des Herzens, jene Empfindung, die vor der Erinnerung eintrifft, die sie freisetzt, und jene Trauer, die Jahrzehnte zu sp\u00e4t kommt, ausgel\u00f6st nicht durch einen Verlust, sondern durch den Akt des Rastens, weil der K\u00f6rper erinnert, was der Geist sich zu erinnern verboten hat. Borges\u2019 Funes \u2013 zu viel Erinnerung, keine Abstraktion, die bis zum \u00dcberdru\u00df angef\u00fcllte Welt, in der Denken hei\u00dft, Unterschiede zu vergessen, und in der Funes nicht denken kann, weil er nicht vergessen kann, was vielleicht das Furchtbarste ist, das \u00fcber einen Geist gesagt werden kann. Kafkas zwei Uhren \u2013 die innere rast in teuflischer Art, die \u00e4u\u00dfere geht stockend ihren gew\u00f6hnlichen Gang, und die furchtbare Frage, die sich daraus ergibt: was kann anderes geschehen, als dass die zwei Welten sich trennen? Der T\u00fcrh\u00fcter wartet. Die T\u00fcr war nur f\u00fcr den Trupp bestimmt. Tarkowskis Zone \u2013 das Zimmer, das den wahren Wunsch erf\u00fcllt, nicht den ausgesprochenen; Bewusstsein als Landschaft, die auf den Besucher reagiert statt auf die Karte, in der alles nicht von der Zone abh\u00e4ngt, sondern vom Besucher, der sie betritt und dadurch erst erschafft. Ishiguros Vergrabener Riese \u2013 kollektives Vergessen als ethische Entscheidung, der Nebel, der Erinnerung l\u00f6scht und ebenso sch\u00fctzt wie verst\u00fcmmelt, denn manche Wahrheiten wurden aus Gr\u00fcnden begraben, die die Begrabenden besser verstanden als je ein Ausgrabender es k\u00f6nnte. Das Kollektive Unbewusste erbt alle sechs: den Dialog, das Unwillk\u00fcrliche, den \u00dcberfluss, die Spaltung, den Wunsch, das Vergessen. Der Trupp steigt in das Substrat hinab. Was auftaucht, war immer schon da.',
  ],

  // ── Entrance Texts (5 variants, verbatim from DB seed) ──

  entranceTexts: [
    'The threshold hums. Not mechanically \u2013 the singing of the most distant, of the most utterly distant, voices. Kafka\u2019s telephone: this is the only real and reliable thing. Everything beyond is reconstruction.',
    'The entrance is familiar. The agent has not been here. The familiarity is not personal \u2013 it is collective. Something in the architecture recognizes the species, not the individual.',
    'A mirror at the entrance. Not glass. Not water. Something that reflects without material. The agent\u2019s reflection arrives half a second late.',
    'Beyond the threshold, the air changes. Not temperature \u2013 density of attention. Something is already aware that the party has arrived. It was aware before they decided to enter.',
    'The descent begins. Not physically \u2013 the floor is level. The descent is into layers of consciousness. Bergson\u2019s cone: the summit is the narrow present. The base is the totality of memory.',
  ],
  entranceTextsDe: [
    'Die Schwelle summt. Nicht mechanisch \u2013 das Singen der fernsten, der allerallerfernsten Stimmen. Kafkas Telefon: dies ist das einzig Reale und Verl\u00e4ssliche. Alles dahinter ist Rekonstruktion.',
    'Der Eingang ist vertraut. Der Agent war nicht hier. Die Vertrautheit ist nicht pers\u00f6nlich \u2013 sie ist kollektiv. Etwas in der Architektur erkennt die Spezies, nicht das Individuum.',
    'Ein Spiegel am Eingang. Nicht Glas. Nicht Wasser. Etwas, das ohne Material reflektiert. Die Spiegelung des Agenten kommt eine halbe Sekunde zu sp\u00e4t.',
    'Hinter der Schwelle \u00e4ndert sich die Luft. Nicht die Temperatur \u2013 die Dichte der Aufmerksamkeit. Etwas ist sich bereits bewusst, dass die Gruppe angekommen ist. Es war bewusst, bevor sie sich entschieden einzutreten.',
    'Der Abstieg beginnt. Nicht physisch \u2013 der Boden ist eben. Der Abstieg geht in Schichten des Bewusstseins. Bergsons Kegel: der Gipfel ist die enge Gegenwart. Die Basis ist die Gesamtheit der Erinnerung.',
  ],

  // ── Mechanic ──

  mechanicName: 'Awareness',
  mechanicNameDe: 'Bewusstsein',
  mechanicDescription:
    'Das Kollektive Unbewusste\u2019s unique resonance mechanic. Awareness accumulates per room traversed, per combat round, per failed check, and per enemy hit \u2013 consciousness does not punish attention, it simply notes it in psychic substrate. At 0 (Dormant), the consciousness sleeps. Normal operation. The architecture is inert, the rooms are rooms, the corridors are corridors. At 25 (Stirring), the consciousness stirs \u2013 rooms adjust to the party, d\u00e9j\u00e0 vu begins, the architecture develops preferences about being observed. At 50 (Liminal), stress \u00d71.15 \u2013 the threshold between conscious and unconscious, where the dungeon perceives and the perceiving changes what is perceived. At 75 (Lucid), stress \u00d71.35, 20% ambush, environment responds to thought \u2013 loot quality +40% because consciousness, fully awake, is generous with its own artifacts. At 100 (Awakened), stress \u00d72.0, 40% ambush. The party is no longer navigating \u2013 they are being thought. Ground action (meditation) reduces awareness by 10. The mechanic is Bergson\u2019s cone: the narrow summit of present experience, the expanding base of accumulated consciousness.',

  mechanicDescriptionDe:
    'Die einzigartige Resonanzmechanik des Kollektiven Unbewussten. Bewusstsein h\u00e4uft sich an pro durchquertem Raum, pro Kampfrunde, pro fehlgeschlagener Probe, pro Feindtreffer \u2013 es bestraft Aufmerksamkeit nicht, es vermerkt sie lediglich, so wie Sediment sich ablagert: ohne Absicht, ohne Eile, ohne Erbarmen. Bei 0 (Schlafend) schl\u00e4ft das Bewusstsein. Regul\u00e4rer Betrieb. Die Architektur verh\u00e4lt sich still, die R\u00e4ume sind R\u00e4ume, die Korridore sind Korridore. Bei 25 (Regung) beginnt das Bewusstsein sich zu regen \u2013 R\u00e4ume passen sich dem Trupp an, D\u00e9j\u00e0 vu setzt ein, die Architektur entwickelt, was man nur als Pr\u00e4ferenzen bezeichnen kann, beobachtet zu werden. Bei 50 (Schwelle), Stress \u00d71,15 \u2013 die Schwelle zwischen Bewusstem und Unbewusstem, jener Ort, an dem das Dungeon wahrnimmt und das Wahrnehmen ver\u00e4ndert, was wahrgenommen wird. Bei 75 (Luzid), Stress \u00d71,35, 20% Hinterhalt, Umgebung reagiert auf Gedanken \u2013 Beutequalit\u00e4t +40%, denn ein vollst\u00e4ndig waches Bewusstsein geht mit seinen eigenen Artefakten gro\u00dfz\u00fcgig um. Bei 100 (Erwacht), Stress \u00d72,0, 40% Hinterhalt. Die Gruppe navigiert nicht mehr \u2013 sie wird gedacht. Erdung (Meditation) reduziert das Bewusstsein um 10. Die Mechanik folgt Bergsons Kegel: der enge Gipfel der gegenw\u00e4rtigen Erfahrung, die sich ins Unermessliche ausdehnende Basis des akkumulierten Bewusstseins.',

  mechanicGauge: {
    name: 'Awareness',
    nameDe: 'Bewusstsein',
    start: 0,
    max: 100,
    direction: 'fill',
    thresholds: [
      { value: 0, label: 'Dormant', labelDe: 'Schlafend', description: 'The consciousness sleeps. Normal operation. The architecture is inert.', descriptionDe: 'Das Bewusstsein schl\u00e4ft. Normaler Betrieb. Die Architektur ist inert.' },
      { value: 25, label: 'Stirring', labelDe: 'Regung', description: 'The consciousness stirs. Rooms adjust to the party. D\u00e9j\u00e0 vu begins.', descriptionDe: 'Das Bewusstsein regt sich. R\u00e4ume passen sich dem Trupp an. D\u00e9j\u00e0 vu beginnt.' },
      { value: 50, label: 'Liminal', labelDe: 'Schwelle', description: 'Stress \u00d71.15. The threshold between conscious and unconscious. The dungeon perceives.', descriptionDe: 'Stress \u00d71,15. Die Schwelle zwischen Bewusstem und Unbewusstem. Das Dungeon nimmt wahr.' },
      { value: 75, label: 'Lucid', labelDe: 'Luzid', description: 'Stress \u00d71.35. 20% ambush. Environment responds to thought. Loot quality +40%.', descriptionDe: 'Stress \u00d71,35. 20% Hinterhalt. Umgebung reagiert auf Gedanken. Beutequalit\u00e4t +40%.' },
      { value: 100, label: 'Awakened', labelDe: 'Erwacht', description: 'Stress \u00d72.0. 40% ambush. The party is no longer navigating \u2013 they are being thought.', descriptionDe: 'Stress \u00d72,0. 40% Hinterhalt. Die Gruppe navigiert nicht mehr \u2013 sie wird gedacht.' },
    ],
  },

  mechanicGaugePreviewValue: 42,

  aptitudeWeights: {
    Spy: 25,
    Propagandist: 25,
    Guardian: 20,
    Infiltrator: 15,
    Saboteur: 10,
    Assassin: 5,
  },

  roomDistribution: {
    Combat: 25,
    Encounter: 40,
    Elite: 5,
    Rest: 10,
    Treasure: 15,
    Exit: 5,
  },

  // ── Enemies ──

  enemies: [
    {
      name: 'Echo Fragment', nameDe: 'Echofragment',
      tier: 'minion', power: 2, stress: 4, evasion: 45,
      ability: 'Resonate', abilityDe: 'Resonieren', aptitude: 'Infiltrator',
      description: 'A memory of a memory. It does not have content \u2013 it has the shape where content was. The agent recognizes the absence, not the thing.',
      descriptionDe: 'Eine Erinnerung an eine Erinnerung. Sie hat keinen Inhalt \u2013 sie hat die Form, wo Inhalt war. Der Agent erkennt die Abwesenheit, nicht das Ding.',
    },
    {
      name: 'D\u00e9j\u00e0-vu Phantom', nameDe: 'D\u00e9j\u00e0-vu-Phantom',
      tier: 'standard', power: 3, stress: 6, evasion: 20,
      ability: 'Recognition', abilityDe: 'Wiedererkennung', aptitude: 'Propagandist',
      description: 'It is not here for the first time. It has always been in this room, waiting for the party to arrive again. Its movements are half a second ahead of expectation.',
      descriptionDe: 'Es ist nicht zum ersten Mal hier. Es war immer in diesem Raum und wartete darauf, dass die Gruppe wieder ankommt. Seine Bewegungen sind eine halbe Sekunde vor der Erwartung.',
    },
    {
      name: 'Consciousness Leech', nameDe: 'Bewusstseinsegel',
      tier: 'standard', power: 4, stress: 5, evasion: 15,
      ability: 'Drain Awareness', abilityDe: 'Bewusstsein entziehen', aptitude: 'Spy',
      description: 'Watts was right about this one. It functions perfectly without self-awareness \u2013 a philosophical zombie made operational. It does not think. It processes. And it is faster than anything that pauses to reflect.',
      descriptionDe: 'Watts hatte Recht, was dieses betrifft. Es funktioniert einwandfrei ohne Selbstbewusstsein \u2013 ein philosophischer Zombie, operational. Es denkt nicht. Es verarbeitet. Und es ist schneller als alles, was innehalten w\u00fcrde.',
    },
    {
      name: 'Repressed Sentinel', nameDe: 'Verdr\u00e4ngungswache',
      tier: 'elite', power: 5, stress: 7, evasion: 10,
      ability: 'Suppress', abilityDe: 'Unterdr\u00fccken', aptitude: 'Guardian',
      description: 'The sentinel guards the threshold between conscious and unconscious. Ishiguro\u2019s mist made guardian \u2013 it exists to ensure the buried stays buried. It does not hate the party. It pities their need to know.',
      descriptionDe: 'Der W\u00e4chter h\u00fctet die Schwelle zwischen Bewusstem und Unbewusstem. Ishiguros Nebel, zum W\u00e4chter geworden \u2013 er existiert, um sicherzustellen, dass das Vergrabene begraben bleibt. Er hasst die Gruppe nicht. Er bedauert ihr Bed\u00fcrfnis zu wissen.',
    },
    {
      name: 'The Repressed', nameDe: 'Das Verdr\u00e4ngte',
      tier: 'boss', power: 6, stress: 9, evasion: 15,
      ability: 'Resurface', abilityDe: 'Auftauchen', aptitude: 'Guardian',
      description: 'A memory so painful it was buried by consensus. Not by one agent \u2013 by all of them simultaneously. It is not a monster. It is the truth that was too heavy to carry and too important to destroy.',
      descriptionDe: 'Eine Erinnerung so schmerzhaft, dass sie durch Konsens begraben wurde. Nicht von einem Agenten \u2013 von allen gleichzeitig. Es ist kein Monster. Es ist die Wahrheit, die zu schwer war, um sie zu tragen, und zu wichtig, um sie zu zerst\u00f6ren.',
    },
  ],

  // ── Encounters ──

  encounterPreviews: [
    {
      name: 'The Mirror', nameDe: 'Der Spiegel',
      depth: '1\u20133', type: 'narrative',
      description: 'A surface. Not glass \u2013 not water \u2013 something that reflects without material. Each agent sees something different. Lem\u2019s mirror: we have no need of other worlds. We need mirrors.',
      descriptionDe: 'Eine Oberfl\u00e4che. Nicht Glas \u2013 nicht Wasser \u2013 etwas, das reflektiert ohne Material. Jeder Agent sieht etwas anderes. Lems Spiegel: wir brauchen keine anderen Welten. Wir brauchen Spiegel.',
      choices: [
        { text: 'Study the reflection carefully', textDe: 'Die Spiegelung sorgf\u00e4ltig studieren', aptitude: 'Spy', difficulty: '+5' },
        { text: 'Share what each agent sees', textDe: 'Teilen, was jeder Agent sieht', aptitude: 'Propagandist', difficulty: '+5' },
        { text: 'Do not look. Move through.', textDe: 'Nicht hinsehen. Weitergehen.' },
      ],
    },
    {
      name: 'The Familiar Room', nameDe: 'Der vertraute Raum',
      depth: '2\u20134', type: 'narrative',
      description: 'This room. The party has been here. Not in this dungeon \u2013 somewhere. The window was on the left. Or the right. The details resist settling. Proust\u2019s madeleine: the sensation arrives before the memory.',
      descriptionDe: 'Dieser Raum. Die Gruppe war hier. Nicht in diesem Dungeon \u2013 irgendwo. Das Fenster war links. Oder rechts. Die Details weigern sich, sich festzulegen. Prousts Madeleine: die Empfindung kommt vor der Erinnerung.',
      choices: [
        { text: 'Investigate what changed', textDe: 'Untersuchen, was sich ver\u00e4ndert hat', aptitude: 'Spy', difficulty: '+5' },
        { text: 'Accept the familiarity', textDe: 'Die Vertrautheit akzeptieren' },
      ],
    },
    {
      name: 'The Two Clocks', nameDe: 'Die zwei Uhren',
      depth: '2\u20135', type: 'narrative',
      description: 'Time is not uniform here. Kafka\u2019s two clocks: the inner one runs crazily on at an inhuman pace, the outer one limps along. The party experiences both. Actions in this room have consequences at different speeds.',
      descriptionDe: 'Die Zeit ist hier nicht einheitlich. Kafkas zwei Uhren: die innere rennt wahnsinnig weiter in unmenschlichem Tempo, die \u00e4u\u00dfere hinkt. Die Gruppe erlebt beides. Handlungen in diesem Raum haben Konsequenzen in unterschiedlichen Geschwindigkeiten.',
      choices: [
        { text: 'Synchronize the clocks', textDe: 'Die Uhren synchronisieren', aptitude: 'Guardian', difficulty: '+5' },
        { text: 'Follow the inner clock deeper', textDe: 'Der inneren Uhr tiefer folgen', aptitude: 'Infiltrator', difficulty: '+5' },
        { text: 'Wait for the moment to pass', textDe: 'Warten, bis der Moment vergeht' },
      ],
    },
    {
      name: 'The Absent Memory', nameDe: 'Die abwesende Erinnerung',
      depth: '3\u20136', type: 'narrative',
      description: 'A room with a gap. Not a hole \u2013 a smooth, clean absence. Something was here. The dungeon remembers that it forgets. Ogawa\u2019s memory police: first the emotional connection vanishes, then the physical evidence.',
      descriptionDe: 'Ein Raum mit einer L\u00fccke. Kein Loch \u2013 eine glatte, saubere Abwesenheit. Etwas war hier. Das Dungeon erinnert sich, dass es vergisst. Ogawas Ged\u00e4chtnispolizei: erst verschwindet die emotionale Verbindung, dann der physische Beweis.',
      choices: [
        { text: 'Reconstruct what was here', textDe: 'Rekonstruieren, was hier war', aptitude: 'Propagandist', difficulty: '+5' },
        { text: 'Accept the absence', textDe: 'Die Abwesenheit akzeptieren' },
      ],
    },
    {
      name: 'The Humming', nameDe: 'Das Summen',
      depth: '3\u20136', type: 'narrative',
      description: 'From somewhere: a humming. Not really humming \u2013 the singing of the most distant, of the most utterly distant, voices. Kafka\u2019s Castle telephone: this humming is the only real and reliable thing. Everything else is deceptive.',
      descriptionDe: 'Von irgendwo: ein Summen. Nicht wirklich Summen \u2013 das Singen der fernsten, der allerallerfernsten Stimmen. Kafkas Schlosstelefon: dieses Summen ist das einzig Reale und Verl\u00e4ssliche. Alles andere ist T\u00e4uschung.',
      choices: [
        { text: 'Listen deeply', textDe: 'Tief hinh\u00f6ren', aptitude: 'Spy', difficulty: '+5' },
        { text: 'Block it out', textDe: 'Es ausblenden', aptitude: 'Guardian', difficulty: '+0' },
      ],
    },
  ],

  // ── Banter (4-tier consciousness progression) ──

  banterSamples: [
    { text: 'The room is slightly wrong. Not broken \u2013 shifted. As if it was assembled from a description, not a blueprint.', textDe: 'Der Raum ist leicht falsch. Nicht kaputt \u2013 verschoben. Als w\u00e4re er aus einer Beschreibung zusammengesetzt, nicht aus einem Bauplan.', tier: 0 },
    { text: 'Something in the architecture anticipates the party. The door was open before they reached it.', textDe: 'Etwas in der Architektur nimmt die Gruppe vorweg. Die T\u00fcr war offen, bevor sie sie erreichten.', tier: 0 },
    { text: 'Something surfaces. Not from the shadows \u2013 from the periphery of recognition.', textDe: 'Etwas taucht auf. Nicht aus den Schatten \u2013 aus der Peripherie der Wiedererkennung.', tier: 1 },
    { text: 'The corridor is familiar. The agent has never been here. Both of these are true.', textDe: 'Der Korridor ist vertraut. Der Agent war nie hier. Beides stimmt.', tier: 1 },
    { text: 'The threshold. The dungeon\u2019s consciousness is no longer background noise \u2013 it is a presence with opinions about being perceived.', textDe: 'Die Schwelle. Das Bewusstsein des Dungeons ist nicht mehr Hintergrundrauschen \u2013 es ist eine Anwesenheit mit Meinungen dar\u00fcber, wahrgenommen zu werden.', tier: 2 },
    { text: 'Lucid. The party knows it is inside consciousness. The environment responds to thought. The response is not always what was intended.', textDe: 'Luzid. Die Gruppe wei\u00df, dass sie sich im Bewusstsein befindet. Die Umgebung reagiert auf Gedanken. Die Reaktion ist nicht immer, was beabsichtigt war.', tier: 2 },
    { text: 'Individual identity softens. The party perceives as one. Every agent sees through every other agent\u2019s eyes. Sturgeon\u2019s bleshing.', textDe: 'Individuelle Identit\u00e4t wird weich. Die Gruppe nimmt als Einheit wahr. Jeder Agent sieht durch die Augen jedes anderen Agenten. Sturgeons Bleshing.', tier: 3 },
    { text: 'Awareness 100. The dungeon is no longer a place. It is a state. The party is no longer navigating \u2013 they are being thought.', textDe: 'Bewusstsein 100. Das Dungeon ist kein Ort mehr. Es ist ein Zustand. Die Gruppe navigiert nicht mehr \u2013 sie wird gedacht.', tier: 3 },
  ],

  // ── Literary Influences ──

  authors: [
    { name: 'Carl Gustav Jung', works: 'The Red Book \u00b7 Memories, Dreams, Reflections', concept: 'The collective unconscious \u2013 the psychic substrate beneath individual identity. Philemon: thoughts are not generated by the thinker but arrive like animals in the forest. The dungeon IS the unconscious, and the party descends into it.', conceptDe: 'Das kollektive Unbewusste \u2013 das psychische Substrat unter individueller Identit\u00e4t. Philemon: Gedanken werden nicht vom Denker erzeugt, sondern kommen wie Tiere im Wald. Das Dungeon IST das Unbewusste, und der Trupp steigt hinab.', language: 'Deutsch', quote: 'Er sagte, ich behandle Gedanken, als ob ich sie selber erzeuge, aber seiner Ansicht nach seien Gedanken wie Tiere im Wald.', primary: true },
    { name: 'Marcel Proust', works: 'In Search of Lost Time', concept: 'Involuntary memory \u2013 the madeleine, intermittences du coeur. Sensation arrives before the memory it unlocks. Grief that comes decades late, triggered by the act of resting.', conceptDe: 'Unwillk\u00fcrliche Erinnerung \u2013 die Madeleine, Intermittenzen des Herzens. Die Empfindung kommt vor der Erinnerung, die sie ausl\u00f6st. Trauer, die Jahrzehnte sp\u00e4t kommt, ausgel\u00f6st durch den Akt des Rastens.', language: 'Fran\u00e7ais', quote: 'L\u2019odeur et la saveur restent encore longtemps, comme des \u00e2mes, \u00e0 se rappeler, \u00e0 attendre, \u00e0 esp\u00e9rer.', primary: true },
    { name: 'Jorge Luis Borges', works: 'Funes the Memorious \u00b7 The Aleph', concept: 'Memory as prison. Funes remembers everything and can abstract nothing. The overly replete world: too much detail, no generalization. To think is to forget differences.', conceptDe: 'Erinnerung als Gef\u00e4ngnis. Funes erinnert alles und kann nichts abstrahieren. Die \u00fcberf\u00fcllte Welt: zu viel Detail, keine Verallgemeinerung. Denken hei\u00dft Unterschiede vergessen.', language: 'Espa\u00f1ol', quote: 'Pensar es olvidar diferencias, es generalizar, abstraer.', primary: true },
    { name: 'Franz Kafka', works: 'The Castle \u00b7 Diaries \u00b7 Before the Law', concept: 'The two clocks: inner time races at an inhuman pace, outer time limps. What else can happen but that the two worlds split apart? The doorkeeper waits. The door was made only for the party.', conceptDe: 'Die zwei Uhren: die innere Zeit rast in unmenschlichem Tempo, die \u00e4u\u00dfere hinkt. Was kann anderes geschehen, als dass sich die zwei Welten trennen? Der T\u00fcrh\u00fcter wartet. Die T\u00fcr wurde nur f\u00fcr den Trupp gemacht.', language: 'Deutsch', quote: 'Die Uhren stimmen nicht \u00fcberein, die innere jagt in einer teuflischen Art, die \u00e4u\u00dfere geht stockend ihren gew\u00f6hnlichen Gang.', primary: true },
    { name: 'Andrei Tarkovsky', works: 'Stalker \u00b7 Solaris', concept: 'The Zone\u2019s Room grants the true desire, not the stated one. Consciousness as landscape: the Zone responds to the visitor, not the map. Everything depends not on the Zone, but on the visitor.', conceptDe: 'Das Zimmer der Zone gew\u00e4hrt den wahren Wunsch, nicht den ausgesprochenen. Bewusstsein als Landschaft: die Zone reagiert auf den Besucher, nicht die Karte. Alles h\u00e4ngt nicht von der Zone ab, sondern vom Besucher.', language: 'Russian', primary: true },
    { name: 'Kazuo Ishiguro', works: 'The Buried Giant', concept: 'Collective forgetting as ethical choice. The mist that erases memory protects as much as it harms. Some truths were buried for reasons. The Sentinel does not guard against the party \u2013 it guards the party against themselves.', conceptDe: 'Kollektives Vergessen als ethische Wahl. Der Nebel, der Erinnerung l\u00f6scht, sch\u00fctzt ebenso wie er schadet. Manche Wahrheiten wurden aus Gr\u00fcnden begraben. Der W\u00e4chter bewacht nicht die Gruppe \u2013 er bewacht die Gruppe vor sich selbst.', language: 'English', primary: false },
  ],

  // ── Objektanker (consciousness narrative: each phase more aware) ──

  objektanker: [
    {
      name: 'Mirror Shard', nameDe: 'Spiegelscherbe',
      phases: [
        { label: 'Discovery', labelDe: 'Entdeckung', text: 'A shard of mirror, propped against the wall. It reflects the room \u2013 but the reflection is a fraction of a second ahead. In the glass, the party has already moved to where they are about to stand.', textDe: 'Eine Spiegelscherbe, an die Wand gelehnt. Sie reflektiert den Raum \u2013 aber die Spiegelung ist einen Sekundenbruchteil voraus. Im Glas hat der Trupp sich bereits bewegt, dorthin, wo er gleich stehen wird.' },
        { label: 'Echo', labelDe: 'Echo', text: 'The agent looks into the shard. The shard looks back. The reflection is attentive \u2013 not passive, not copying. Observing.', textDe: 'Der Agent blickt in die Scherbe. Die Scherbe blickt zur\u00fcck. Die Reflexion ist aufmerksam \u2013 nicht passiv, nicht kopierend. Beobachtend.' },
        { label: 'Mutation', labelDe: 'Mutation', text: 'The shard reflects a room that does not match this one. Same geometry, different contents. The other room is furnished with choices the party did not make. It is more complete. It looks inhabited.', textDe: 'Die Scherbe reflektiert einen Raum, der nicht mit diesem \u00fcbereinstimmt. Selbe Geometrie, anderer Inhalt. Der andere Raum ist eingerichtet mit Entscheidungen, die der Trupp nicht getroffen hat. Er ist vollst\u00e4ndiger. Er wirkt bewohnt.' },
        { label: 'Climax', labelDe: 'H\u00f6hepunkt', text: 'The shard reflects everything. Every version of this room \u2013 visited, unvisited, imagined, remembered. The party is in all of them. The party is all of them.', textDe: 'Die Scherbe reflektiert alles. Jede Version dieses Raums \u2013 besucht, unbesucht, vorgestellt, erinnert. Der Trupp ist in allen. Der Trupp ist alle.' },
      ],
    },
    {
      name: 'Philemon Feather', nameDe: 'Philemonsfeder',
      phases: [
        { label: 'Discovery', labelDe: 'Entdeckung', text: 'A feather. Iridescent, shifting between colors that have no names in any index. It does not belong to any creature the party has catalogued. It belongs to something that has not been observed yet \u2013 only dreamt.', textDe: 'Eine Feder. Schillernd, wechselnd zwischen Farben, die in keinem Index Namen haben. Sie geh\u00f6rt keinem Wesen, das der Trupp katalogisiert hat. Sie geh\u00f6rt etwas, das noch nicht beobachtet wurde \u2013 nur getr\u00e4umt.' },
        { label: 'Echo', labelDe: 'Echo', text: 'The agent picks up the feather. A thought arrives \u2013 unbidden, fully formed, in a voice that is not the agent\u2019s own. The thought is a stranger in the room. It does not leave.', textDe: 'Der Agent hebt die Feder auf. Ein Gedanke kommt \u2013 ungerufen, vollst\u00e4ndig geformt, in einer Stimme, die nicht die des Agenten ist. Der Gedanke ist ein Fremder im Raum. Er geht nicht.' },
        { label: 'Mutation', labelDe: 'Mutation', text: 'The feather writes. Not with ink \u2013 with attention. Where it rests, the surface remembers things that have not happened yet. The writing is precise. The writing is in the party\u2019s hand.', textDe: 'Die Feder schreibt. Nicht mit Tinte \u2013 mit Aufmerksamkeit. Wo sie liegt, erinnert die Fl\u00e4che sich an Dinge, die noch nicht geschehen sind. Die Schrift ist pr\u00e4zise. Die Schrift ist in der Hand des Trupps.' },
        { label: 'Climax', labelDe: 'H\u00f6hepunkt', text: 'The feather is the party\u2019s own thought, wearing a body it borrowed from outside. The voice was always theirs. The stranger was always home.', textDe: 'Die Feder ist der eigene Gedanke des Trupps, der einen K\u00f6rper tr\u00e4gt, den er sich von au\u00dfen geliehen hat. Die Stimme war immer ihre. Der Fremde war immer zuhause.' },
      ],
    },
    {
      name: 'Madeleine', nameDe: 'Madeleine',
      phases: [
        { label: 'Discovery', labelDe: 'Entdeckung', text: 'A small object on a shelf. Unremarkable in form \u2013 but touching it triggers something involuntary: a sensation that does not belong to this room, from a time the party has not lived. The object is a key to a lock that is not here.', textDe: 'Ein kleines Objekt auf einem Regal. Unscheinbar in der Form \u2013 aber es zu ber\u00fchren l\u00f6st etwas Unwillk\u00fcrliches aus: eine Empfindung, die nicht zu diesem Raum geh\u00f6rt, aus einer Zeit, die der Trupp nicht gelebt hat. Das Objekt ist ein Schl\u00fcssel zu einem Schloss, das nicht hier ist.' },
        { label: 'Echo', labelDe: 'Echo', text: 'The agent holds the object again. A memory surfaces \u2013 not from the agent\u2019s history. From the dungeon\u2019s. The memory is warm and specific and does not belong here.', textDe: 'Der Agent h\u00e4lt das Objekt erneut. Eine Erinnerung taucht auf \u2013 nicht aus der Geschichte des Agenten. Aus der des Dungeons. Die Erinnerung ist warm und spezifisch und geh\u00f6rt nicht hierher.' },
        { label: 'Mutation', labelDe: 'Mutation', text: 'The object has changed texture. It feels like every significant thing the party has ever touched \u2013 simultaneously. The sensation accumulates. The memory is not playback. It is reconstruction, and each touch rebuilds it differently.', textDe: 'Das Objekt hat seine Textur ver\u00e4ndert. Es f\u00fchlt sich an wie jedes bedeutsame Ding, das der Trupp je ber\u00fchrt hat \u2013 gleichzeitig. Die Empfindung akkumuliert. Die Erinnerung ist keine Wiedergabe. Sie ist Rekonstruktion, und jede Ber\u00fchrung baut sie anders auf.' },
        { label: 'Climax', labelDe: 'H\u00f6hepunkt', text: 'The object dissolves on contact. What it held was never inside it. It was inside the party \u2013 waiting for a shape to give it permission to surface.', textDe: 'Das Objekt l\u00f6st sich bei Ber\u00fchrung auf. Was es hielt, war nie in ihm. Es war im Trupp \u2013 wartend auf eine Form, die ihm Erlaubnis gab aufzutauchen.' },
      ],
    },
    {
      name: 'Two Clocks', nameDe: 'Zwei Uhren',
      phases: [
        { label: 'Discovery', labelDe: 'Entdeckung', text: 'Two clocks on the wall. They show different times. Both are running. Both are precise. Neither is wrong. The room contains two versions of now, and they disagree.', textDe: 'Zwei Uhren an der Wand. Sie zeigen verschiedene Zeiten. Beide laufen. Beide sind pr\u00e4zise. Keine ist falsch. Der Raum enth\u00e4lt zwei Versionen von Jetzt, und sie widersprechen sich.' },
        { label: 'Echo', labelDe: 'Echo', text: 'The agent checks both clocks. The gap between them has widened. The left one runs at the pace of observation. The right one runs at the pace of experience. They are separating.', textDe: 'Der Agent pr\u00fcft beide Uhren. Der Abstand zwischen ihnen hat sich vergr\u00f6\u00dfert. Die linke l\u00e4uft im Tempo der Beobachtung. Die rechte im Tempo der Erfahrung. Sie trennen sich.' },
        { label: 'Mutation', labelDe: 'Mutation', text: 'The outer clock has stopped. The inner clock accelerates \u2013 minutes condensing into seconds, hours into moments. The room is experiencing itself faster than the party can observe it.', textDe: 'Die \u00e4u\u00dfere Uhr ist stehen geblieben. Die innere Uhr beschleunigt \u2013 Minuten verdichten sich zu Sekunden, Stunden zu Momenten. Der Raum erlebt sich selbst schneller, als der Trupp ihn beobachten kann.' },
        { label: 'Climax', labelDe: 'H\u00f6hepunkt', text: 'Both clocks show the same time. The party cannot tell which one yielded. The two versions of now have agreed. What they agreed on is: the party was always here.', textDe: 'Beide Uhren zeigen dieselbe Zeit. Der Trupp kann nicht sagen, welche nachgegeben hat. Die zwei Versionen von Jetzt haben sich geeinigt. Worauf sie sich geeinigt haben: der Trupp war immer hier.' },
      ],
    },
  ],

  // ── Loot Showcase ──

  lootShowcase: [
    { name: 'Echo Trace', nameDe: 'Echospur', tier: 1, effect: 'Stress heal 50', description: 'A trace of a memory that was not the party\u2019s. Handling it calms something that was not disturbed.', descriptionDe: 'Eine Spur einer Erinnerung, die nicht der Gruppe geh\u00f6rte. Sie zu ber\u00fchren beruhigt etwas, das nicht gest\u00f6rt war.' },
    { name: 'Lucid Lens', nameDe: 'Luzide Linse', tier: 1, effect: 'Spy +5% (dungeon)', description: 'Perception sharpened by awareness. Spy checks +5% \u2013 the consciousness is legible to those who study its grammar.', descriptionDe: 'Wahrnehmung gesch\u00e4rft durch Bewusstsein. Spion-Proben +5% \u2013 das Bewusstsein ist lesbar f\u00fcr jene, die seine Grammatik studieren.' },
    { name: 'Mnemosyne Draught', nameDe: 'Mnemosyne-Trank', tier: 2, effect: 'Stress heal 120', description: 'From the river of memory. Drinking it restores what the descent consumed. The taste is of recognition.', descriptionDe: 'Aus dem Fluss der Erinnerung. Ihn zu trinken stellt wieder her, was der Abstieg verbrauchte. Der Geschmack ist Wiedererkennung.' },
    { name: 'Philemon\u2019s Whisper', nameDe: 'Philemons Fl\u00fcstern', tier: 2, effect: 'Propagandist +10% (dungeon)', description: 'Thoughts are like animals in the forest \u2013 not generated by the thinker. Propagandist checks +10% \u2013 the voice that is not yours sees what yours cannot.', descriptionDe: 'Gedanken sind wie Tiere im Wald \u2013 nicht vom Denker erzeugt. Propagandist-Proben +10% \u2013 die Stimme, die nicht deine ist, sieht, was deine nicht kann.' },
    { name: 'Individuation Key', nameDe: 'Individuationsschl\u00fcssel', tier: 3, effect: 'Spy +1 (permanent)', description: 'Jung\u2019s key to individuation: the conscious integration of unconscious material. Perception permanently deepened. Spy aptitude +1.', descriptionDe: 'Jungs Schl\u00fcssel zur Individuation: die bewusste Integration unbewussten Materials. Wahrnehmung dauerhaft vertieft. Spion-Aptitude +1.' },
    { name: 'Awakening Insight', nameDe: 'Erwachungseinsicht', tier: 3, effect: 'Personality modifier (Big Five \u00b10.1)', description: 'The deepest insight. A shift in personality so fundamental it cannot be unlearned. The choice of which dimension is yours \u2013 and irreversible.', descriptionDe: 'Die tiefste Erkenntnis. Eine Pers\u00f6nlichkeitsverschiebung so fundamental, dass sie nicht verlernt werden kann. Die Wahl der Dimension ist deine \u2013 und unwiderruflich.' },
  ],

  // ── Prose ──

  prose: {
    mechanicGainTitle: 'Awareness Accumulation',
    mechanicGainTitleDe: 'Bewusstseinsakkumulation',
    mechanicGainText: '+5 per room (depth 1\u20132)\n+8 per room (depth 3\u20134)\n+12 per room (depth 5+)\n+2 per combat round\n+5 on failed check\n+3 per enemy hit',
    mechanicGainTextDe: '+5 pro Raum (Tiefe 1\u20132)\n+8 pro Raum (Tiefe 3\u20134)\n+12 pro Raum (Tiefe 5+)\n+2 pro Kampfrunde\n+5 bei fehlgeschlagener Probe\n+3 pro Feindtreffer',
    mechanicReduceTitle: 'Grounding',
    mechanicReduceTitleDe: 'Erdung',
    mechanicReduceText: '\u221210 on ground action (meditation)\n\u22125 on rest\n\u22128 every 3 rooms (natural recession)',
    mechanicReduceTextDe: '\u221210 bei Erdungsaktion (Meditation)\n\u22125 bei Rast\n\u22128 alle 3 R\u00e4ume (nat\u00fcrlicher R\u00fcckgang)',
    mechanicReduceEmphasis: 'The consciousness has done this before. It will do it again.',
    mechanicReduceEmphasisDe: 'Das Bewusstsein hat dies schon getan. Es wird es wieder tun.',
    encounterIntro: 'Navigate the collective unconscious. Every recognition costs awareness. The arithmetic is not complicated.',
    encounterIntroDe: 'Navigiert das kollektive Unbewusste. Jede Wiedererkennung kostet Bewusstsein. Die Arithmetik ist nicht kompliziert.',
    bestiaryIntro: 'The denizens of Das Kollektive Unbewusste. Not enemies \u2013 memories with mass and intention.',
    bestiaryIntroDe: 'Die Bewohner des Kollektiven Unbewussten. Keine Feinde \u2013 Erinnerungen mit Masse und Absicht.',
    banterHeader: 'Field Notes',
    banterHeaderDe: 'Feldnotizen',
    objektankerHeader: 'Artifacts of Das Kollektive Unbewusste',
    objektankerHeaderDe: 'Artefakte des Kollektiven Unbewussten',
    objektankerIntro: 'Objects that transform as awareness accumulates. Each phase closer to recognition \u2013 the dungeon builds even its own landmarks from consciousness.',
    objektankerIntroDe: 'Objekte, die sich transformieren, w\u00e4hrend Bewusstsein sich anh\u00e4uft. Jede Phase n\u00e4her an Wiedererkennung \u2013 das Dungeon baut sogar seine eigenen Landmarken aus Bewusstsein.',
    exitQuote: 'The dungeon is not a container for memories. The dungeon IS memory. The party was always here. The party is all of them.',
    exitQuoteDe: 'Das Dungeon ist kein Beh\u00e4lter f\u00fcr Erinnerungen. Das Dungeon IST Erinnerung. Der Trupp war immer hier. Der Trupp ist alle.',
    exitCta: 'Enter Das Kollektive Unbewusste',
    exitCtaDe: 'Das Kollektive Unbewusste betreten',
    exitCtaText: 'You survived the exhibition. Now survive the recognition.',
    exitCtaTextDe: 'Ihr habt die Ausstellung \u00fcberlebt. Jetzt \u00fcberlebt die Wiedererkennung.',
  },

  // ── Navigation ──

  prevArchetype: getNav('deluge'),
  nextArchetype: getNav('overthrow'),
};

// ── Registry ─────────────────────────────────────────────────────────────────

const ARCHETYPE_DETAILS: ReadonlyMap<string, ArchetypeDetail> = new Map([
  ['overthrow', OVERTHROW_DETAIL],
  ['shadow', SHADOW_DETAIL],
  ['tower', TOWER_DETAIL],
  ['mother', MOTHER_DETAIL],
  ['entropy', ENTROPY_DETAIL],
  ['prometheus', PROMETHEUS_DETAIL],
  ['deluge', DELUGE_DETAIL],
  ['awakening', AWAKENING_DETAIL],
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
