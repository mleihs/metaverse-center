/**
 * Dungeon Showcase — Archetype data (pure data, no DOM / style dependencies).
 *
 * All quotes are from verified sources:
 *   - S-tier banter lines from backend/services/dungeon/dungeon_banter.py
 *   - Design documents in docs/research/
 *   - Canonical literary works documented in the research
 *
 * Quotes with non-English originals include the source text and language.
 * The component shows the user-language version first, then reveals the
 * original with a transition effect.
 */

export interface ArchetypeQuote {
  readonly text: string;
  readonly author: string;
  /** Original-language text — omit if the quote was written in English. */
  readonly original?: string;
  /** Display label for the original language (e.g. 'Deutsch', 'Fran\u00e7ais'). */
  readonly originalLang?: string;
}

export interface ArchetypeSlide {
  readonly id: string;
  readonly name: string;
  readonly subtitle: string;
  readonly numeral: string;
  /** Primary accent hex — set as --_accent on the slide container. */
  readonly accent: string;
  readonly quotes: readonly ArchetypeQuote[];
  readonly tagline: string;
  /** CSS class applied to the slide for atmosphere + transition targeting. */
  readonly cssClass: string;
  /** Supabase Storage URL for the AI-generated background image. */
  readonly imageUrl: string;
  /** Frosted-glass scrim tuning — calibrated per image brightness.
   *  [blur_px, brightness_0to1, saturate_0to1] */
  readonly scrim: readonly [number, number, number];
}

const STORAGE_BASE = 'https://bffjoupddfjaljqrwqck.supabase.co/storage/v1/object/public/simulation.assets/showcase';

export const ARCHETYPES: readonly ArchetypeSlide[] = [
  {
    id: 'shadow',
    name: 'The Shadow',
    subtitle: 'Die Tiefe Nacht',
    numeral: 'I',
    accent: '#7c5ce7',
    quotes: [
      { text: 'The instruments read nothing. Not zero\u2009\u2014\u2009nothing. As if measurement itself has been consumed.', author: 'Reconnaissance Banter' },
      { text: 'The darkness lets you leave. That\u2019s the most unsettling part.', author: 'Reconnaissance Banter' },
      { text: 'The corridors converge here\u2009\u2014\u2009not architecturally, but ontologically.', author: 'Reconnaissance Banter' },
      { text: 'The shadows move. Not with you. Not against you. Around you. Testing.', author: 'Reconnaissance Banter' },
      { text: 'The air changes. The whispers stop. In the silence that follows, something enormous draws breath.', author: 'Reconnaissance Banter' },
      { text: 'A gap in the darkness\u2009\u2014\u2009not light, exactly, but the absence of active malice.', author: 'Reconnaissance Banter' },
    ],
    tagline: 'Darkness is not absence. It is presence.',
    cssClass: 'slide--shadow',
    imageUrl: `${STORAGE_BASE}/dungeon-shadow.avif`,
    scrim: [10, 0.55, 0.55],
  },
  {
    id: 'tower',
    name: 'The Tower',
    subtitle: 'Der Fallende Turm',
    numeral: 'II',
    accent: '#4a8ab5',
    quotes: [
      {
        text: 'Someone must have slandered Josef K., for one morning, without having done anything truly wrong, he was arrested.',
        author: 'Franz Kafka, The Trial',
        original: 'Jemand mu\u00dfte Josef K. verleumdet haben, denn ohne da\u00df er etwas B\u00f6ses getan h\u00e4tte, wurde er eines Morgens verhaftet.',
        originalLang: 'Deutsch',
      },
      { text: 'The stairwell narrows. Not the walls\u2009\u2014\u2009the sense that return is possible.', author: 'Structural Banter' },
      { text: 'The tower has crossed from architecture into archaeology. Every step forward is a step through what this building used to be.', author: 'Structural Banter' },
      { text: 'The load-bearing walls have given up the pretence. The building no longer pretends it was designed to be lived in.', author: 'Structural Banter' },
      { text: 'Only momentum and gravity, negotiating terms.', author: 'Structural Banter' },
      { text: 'The geometry here is wrong. Not broken\u2009\u2014\u2009bankrupt.', author: 'Structural Banter' },
    ],
    tagline: 'The building is alive. You are its nervous system.',
    cssClass: 'slide--tower',
    imageUrl: `${STORAGE_BASE}/dungeon-tower.avif`,
    scrim: [24, 0.22, 0.4],
  },
  {
    id: 'mother',
    name: 'The Devouring Mother',
    subtitle: 'Das Lebendige Labyrinth',
    numeral: 'III',
    accent: '#2dd4a0',
    quotes: [
      { text: 'Your instruments read \u201cbiological hazard.\u201d Your body reads \u201chome.\u201d', author: 'Expedition Banter' },
      { text: 'The walls pulse. Gently. Like something breathing for you so you don\u2019t have to.', author: 'Expedition Banter' },
      { text: 'Something has prepared this room for you. The temperature is exact. The light is the color of afternoon through curtains.', author: 'Expedition Banter' },
      { text: 'You could stay. The thought arrives like warmth. Like something the air itself is suggesting.', author: 'Expedition Banter' },
      { text: 'The tissue on the walls reaches toward you. Not aggressively. The way a plant reaches toward light.', author: 'Expedition Banter' },
      { text: 'God help the organism that is wholly an island unto itself.', author: 'Octavia Butler, Lilith\u2019s Brood' },
    ],
    tagline: 'That which sustains you consumes you.',
    cssClass: 'slide--mother',
    imageUrl: `${STORAGE_BASE}/dungeon-mother.avif`,
    scrim: [16, 0.32, 0.5],
  },
  {
    id: 'entropy',
    name: 'The Entropy',
    subtitle: 'Der Verfall\u2011Garten',
    numeral: 'IV',
    accent: '#d4920a',
    quotes: [
      {
        text: 'Something is taking its course.',
        author: 'Samuel Beckett, Endgame',
        original: 'Quelque chose suit son cours.',
        originalLang: 'Fran\u00e7ais',
      },
      { text: 'The corridor was here yesterday. Today it is mostly here.', author: 'Entropy Banter' },
      { text: 'The walls are not crumbling. They are agreeing with the floor.', author: 'Entropy Banter' },
      {
        text: 'Nothing happens. Nobody comes, nobody goes. It\u2019s awful.',
        author: 'Samuel Beckett, Waiting for Godot',
        original: 'Rien ne se passe, personne ne vient, personne ne s\u2019en va, c\u2019est terrible.',
        originalLang: 'Fran\u00e7ais',
      },
      { text: 'The instruments read accurately. The accuracy no longer means anything.', author: 'Entropy Banter' },
      { text: '.', author: 'Final Transmission' },
    ],
    tagline: 'Decay is not destruction\u2009\u2014\u2009it is equalization.',
    cssClass: 'slide--entropy',
    imageUrl: `${STORAGE_BASE}/dungeon-entropy.avif`,
    scrim: [28, 0.18, 0.35],
  },
  {
    id: 'prometheus',
    name: 'The Prometheus',
    subtitle: 'Die Werkstatt der G\u00f6tter',
    numeral: 'V',
    accent: '#e85d26',
    quotes: [
      { text: 'I had desired it with an ardour that far exceeded moderation; but now that I had finished, the beauty of the dream vanished, and breathless horror and disgust filled my heart.', author: 'Mary Shelley, Frankenstein' },
      {
        text: 'Matter has been given infinite fertility, inexhaustible vitality, and a seductive power of temptation which invites us to create as well.',
        author: 'Bruno Schulz, Treatise on Tailors\u2019 Dummies',
        original: 'Materia otrzyma\u0142a nieko\u0144czon\u0105 p\u0142odno\u015b\u0107, niewyczerpan\u0105 moc \u017cyciow\u0105 i zarazem uw\u00f3dczy si\u0142\u0119 pokusy, kt\u00f3ra nas nap\u0105 do formotworzenia.',
        originalLang: 'Polski',
      },
      {
        text: 'Fire suggests the desire to change, to speed up the passage of time, to bring all of life to its conclusion, to its hereafter.',
        author: 'Gaston Bachelard, The Psychoanalysis of Fire',
        original: 'Le feu sugg\u00e8re le d\u00e9sir de changer, de brusquer le temps, de porter toute la vie \u00e0 son terme, \u00e0 son au-del\u00e0.',
        originalLang: 'Fran\u00e7ais',
      },
      { text: 'Something in the crucible. Not what was intended. Better.', author: 'Workshop Banter' },
      {
        text: 'In the depth of matter, indistinct smiles are shaped, tensions build up, attempts at form appear.',
        author: 'Bruno Schulz, The Street of Crocodiles',
        original: 'W g\u0142\u0119bi materii kszta\u0142tuj\u0105 si\u0119 nie\u015bmia\u0142e u\u015bmiechy, napr\u0119\u017caj\u0105 si\u0119 napi\u0119cia, zbieraj\u0105 si\u0119 pr\u00f3by formy.',
        originalLang: 'Polski',
      },
      {
        text: 'Conquering matter is to understand it, and understanding matter is necessary to understanding the universe and ourselves.',
        author: 'Primo Levi, The Periodic Table',
        original: 'Vincere la materia \u00e8 comprenderla, e comprendere la materia \u00e8 necessario per comprendere l\u2019universo e noi stessi.',
        originalLang: 'Italiano',
      },
    ],
    tagline: 'Innovation demands perpetual suffering. The gift cannot be ungiven.',
    cssClass: 'slide--prometheus',
    imageUrl: `${STORAGE_BASE}/dungeon-prometheus.avif`,
    scrim: [20, 0.25, 0.45],
  },
  {
    id: 'deluge',
    name: 'The Deluge',
    subtitle: 'Die Steigende Flut',
    numeral: 'VI',
    accent: '#1ab5c8',
    quotes: [
      { text: 'The further south they moved, the more the biological clock within them reverted to a more primitive time.', author: 'J.G. Ballard, The Drowned World' },
      {
        text: 'Still water brings us back to our dead.',
        author: 'Gaston Bachelard, Water and Dreams',
        original: 'L\u2019eau dormante nous ram\u00e8ne \u00e0 nos morts.',
        originalLang: 'Fran\u00e7ais',
      },
      { text: 'Water, water, every where, nor any drop to drink.', author: 'Samuel Taylor Coleridge, The Rime of the Ancient Mariner' },
      { text: 'The sombre green-black fronds of the gymnosperms, intruders from the Triassic past, and the half-submerged white-faced buildings of the 20th century still reflected together in the dark mirror of the water.', author: 'J.G. Ballard, The Drowned World' },
      { text: 'Water is a mysterious element, a single molecule of which is very photogenic. It can convey movement and a sense of change and flux.', author: 'Andrei Tarkovsky' },
      { text: 'The earth is evil. We don\u2019t need to grieve for it.', author: 'Lars von Trier, Melancholia' },
    ],
    tagline: 'The world reminds its inhabitants: guests, not owners.',
    cssClass: 'slide--deluge',
    imageUrl: `${STORAGE_BASE}/dungeon-deluge.avif`,
    scrim: [22, 0.22, 0.4],
  },
  {
    id: 'awakening',
    name: 'The Awakening',
    subtitle: 'Das Kollektive Unbewusste',
    numeral: 'VII',
    accent: '#b48aef',
    quotes: [
      {
        text: 'He said I treated thoughts as if I generated them myself, but in his view thoughts were like animals in the forest, or people in a room, or birds in the air.',
        author: 'Carl Jung, Memories, Dreams, Reflections',
        original: 'Er sagte, ich behandle Gedanken, als ob ich sie selber erzeuge, aber seiner Ansicht nach seien Gedanken wie Tiere im Wald, oder Menschen in einem Zimmer, oder V\u00f6gel in der Luft.',
        originalLang: 'Deutsch',
      },
      {
        text: 'To think is to forget differences, generalize, make abstractions. In the overly replete world of Funes there were nothing but details, almost contiguous details.',
        author: 'Jorge Luis Borges, Funes the Memorious',
        original: 'Pensar es olvidar diferencias, es generalizar, abstraer. En el abarrotado mundo de Funes no hab\u00eda sino detalles, casi inmediatos.',
        originalLang: 'Espa\u00f1ol',
      },
      {
        text: 'Taste and smell alone, more fragile but more enduring, more persistent, more faithful, remain poised a long time, like souls, remembering, waiting, hoping, amid the ruins of all the rest.',
        author: 'Marcel Proust, Swann\u2019s Way',
        original: 'L\u2019odeur et la saveur restent encore longtemps, comme des \u00e2mes, \u00e0 se rappeler, \u00e0 attendre, \u00e0 esp\u00e9rer, sur la ruine de tout le reste.',
        originalLang: 'Fran\u00e7ais',
      },
      {
        text: 'The clocks are not in unison; the inner one runs crazily on at a devilish pace, the outer one limps along at its usual speed. What else can happen but that the two worlds split apart.',
        author: 'Franz Kafka, Diaries',
        original: 'Die Uhren stimmen nicht \u00fcberein, die innere jagt in einer teuflischen oder d\u00e4monischen oder jedenfalls unmenschlichen Art, die \u00e4u\u00dfere geht stockend ihren gew\u00f6hnlichen Gang. Was kann anderes geschehen, als da\u00df sich die zwei verschiedenen Welten trennen.',
        originalLang: 'Deutsch',
      },
      {
        text: 'Shadows of reality emerge out of nothing on the exposed paper, as memories do in the middle of the night, darkening again if you try to cling to them.',
        author: 'W.G. Sebald, Austerlitz',
        original: 'Schatten der Wirklichkeit sozusagen aus dem Nichts auf dem belichteten Papier hervortreten, gerade wie die Erinnerungen, die ja auch mitten in der Nacht in uns auftauchen und sich wieder verdunkeln, wenn man sie festzuhalten versucht.',
        originalLang: 'Deutsch',
      },
      { text: 'I am Ubik. Before the universe was, I am. I made the suns. I made the worlds. I am. I shall always be.', author: 'Philip K. Dick, Ubik' },
    ],
    tagline: 'The dungeon is not a container for memories\u2009\u2014\u2009it IS memory.',
    cssClass: 'slide--awakening',
    imageUrl: `${STORAGE_BASE}/dungeon-awakening.avif`,
    scrim: [10, 0.50, 0.55],
  },
  {
    id: 'overthrow',
    name: 'The Overthrow',
    subtitle: 'Der Spiegelpalast',
    numeral: 'VIII',
    accent: '#d4364b',
    quotes: [
      {
        text: 'Starting from unlimited freedom, I arrive at unlimited despotism.',
        author: 'Fyodor Dostoevsky, Demons',
        original: '\u0412\u044b\u0445\u043e\u0434\u044f \u0438\u0437 \u0431\u0435\u0437\u0433\u0440\u0430\u043d\u0438\u0447\u043d\u043e\u0439 \u0441\u0432\u043e\u0431\u043e\u0434\u044b, \u044f \u0437\u0430\u043a\u043b\u044e\u0447\u0430\u044e \u0431\u0435\u0437\u0433\u0440\u0430\u043d\u0438\u0447\u043d\u044b\u043c \u0434\u0435\u0441\u043f\u043e\u0442\u0438\u0437\u043c\u043e\u043c.',
        originalLang: '\u0420\u0443\u0441\u0441\u043a\u0438\u0439',
      },
      {
        text: 'Everyone sees what you appear to be, few experience what you really are.',
        author: 'Niccol\u00f2 Machiavelli, The Prince',
        original: 'Ognuno vede quel che tu pari, pochi sentono quel che tu sei.',
        originalLang: 'Italiano',
      },
      {
        text: 'First comes a full stomach, then comes ethics.',
        author: 'Bertolt Brecht, The Threepenny Opera',
        original: 'Erst kommt das Fressen, dann kommt die Moral.',
        originalLang: 'Deutsch',
      },
      {
        text: 'Every revolutionary ends as an oppressor or a heretic.',
        author: 'Albert Camus, The Rebel',
        original: 'Tout r\u00e9volutionnaire finit en oppresseur ou en h\u00e9r\u00e9tique.',
        originalLang: 'Fran\u00e7ais',
      },
      { text: 'Power is not a means; it is an end. One does not establish a dictatorship in order to safeguard a revolution; one makes the revolution in order to establish the dictatorship. The object of power is power.', author: 'George Orwell, 1984' },
      { text: 'The old leader is gone. The new leader enters. Same room. Same desk. Same view from the window.', author: 'Regime Banter' },
    ],
    tagline: 'Power changes hands. The old order does not die\u2009\u2014\u2009it metamorphoses.',
    cssClass: 'slide--overthrow',
    imageUrl: `${STORAGE_BASE}/dungeon-overthrow.avif`,
    scrim: [22, 0.22, 0.4],
  },
];
