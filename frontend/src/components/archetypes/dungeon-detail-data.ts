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
 * Only The Overthrow is fully populated for the initial implementation.
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
