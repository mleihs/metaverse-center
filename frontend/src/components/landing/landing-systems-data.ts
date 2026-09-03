/**
 * Die sechs Systeme — DATEN, keine Darstellung.
 *
 * Sie lagen bis zum 03.09.2026 in `LandingSystems.ts`. Seit die Frontseite zwei
 * Vorlagen hat (redaktionell und Kartenmappe), brauchen beide dieselben sechs
 * Eintraege: Tag, Titel, Anreisser, Lore, Zitat, Zuschreibung, Ziel.
 *
 * WARUM EIN EIGENES MODUL UND KEIN EXPORT AUS DER KOMPONENTE
 *   Weil sonst die zweite Vorlage aus der ersten importieren muesste, und damit
 *   deren gesamte CSS und ihren Lebenszyklus mitzoege — fuer sechs Datensaetze.
 *   Und weil das hier keine Darstellung ist: es sind die Texte, mit denen die
 *   Plattform ihre eigenen Systeme beschreibt. Sie zweimal zu halten hiesse,
 *   dass eine Korrektur an einer Stelle die andere nicht erreicht.
 *
 * WARUM FUNKTIONEN STATT ZEICHENKETTEN
 *   `msg()` bindet zur AUFRUFZEIT an die aktive Sprache. Ein Modul-Konstante
 *   mit fertigen Zeichenketten waere in der Sprache eingefroren, die beim
 *   ersten Import galt — und der Sprachumschalter aendert danach nichts mehr.
 */

import { msg } from '@lit/localize';
import type { LandingCounts } from '../../types/index.js';
import { LANDING_SYSTEM_STEMS, type LandingSystemStem } from './landing-images.js';

/** Woran sich entscheidet, ob ein System eine Marke traegt. */
export type Readiness = (counts: LandingCounts | null) => boolean;

export interface SystemEntry {
  stem: LandingSystemStem;
  tag: () => string;
  title: () => string;
  teaser: () => string;
  lore: () => string;
  quote: () => string;
  attribution: () => string;
  route: string;
  /** Wahr, solange das System zwar gebaut, aber ohne Bestand ist. */
  underConstruction: Readiness;
}

/** Nie eine Marke: das System steht Besuchern offen. */
const ALWAYS_READY: Readiness = () => false;

export const SYSTEMS: readonly SystemEntry[] = [
  {
    stem: LANDING_SYSTEM_STEMS[0],
    tag: () => msg('System 01 // The Forge'),
    title: () => msg('Forge a World'),
    teaser: () =>
      msg(
        'One sentence becomes a civilization: coastlines, a census, a founding grudge. You write the seed. The world writes everything after it.',
      ),
    lore: () =>
      msg(
        'The intake desk of the Bureau. You file a single sentence; the Forge answers with coastlines, a census, a founding grudge and a working economy. It names the rivers, seats the parliament, invents the folk songs, and decides – before you can object – which of your words was the important one.',
      ),
    quote: () =>
      msg(
        'I wrote "a city that fears the rain" and by evening it had umbrella cartels, a drought cult, and a poet under house arrest. I have never felt so read.',
      ),
    attribution: () => msg('Intake form 7-C, marginal note'),
    route: '/forge',
    underConstruction: ALWAYS_READY,
  },
  {
    stem: LANDING_SYSTEM_STEMS[1],
    tag: () => msg('System 02 // Epochs'),
    title: () => msg('Compete in Seasons'),
    teaser: () =>
      msg(
        'Timed epochs where civilizations clash: deploy operatives, forge alliances, betray on time.',
      ),
    lore: () =>
      msg(
        'Epochs are timed seasons in which rival civilizations share one map and one deadline. Operatives are deployed under false names, alliances are notarized in triplicate, betrayals are scheduled weeks in advance and executed to the minute. When the clock runs out, the standings wall prints one civilization’s name slightly larger than the rest.',
      ),
    quote: () =>
      msg(
        'We lost the epoch on points but won the peace: their spymaster defected to us for the food. Wars end; kitchens are forever.',
      ),
    attribution: () => msg('After-action report, Epoch of the Hollow Crown'),
    route: '/epoch',
    // Der Bestand entscheidet, nicht ein Schalter: laeuft keine Partie, traegt
    // das System die Marke.
    underConstruction: (counts) => (counts?.epochs_in_play ?? 0) === 0,
  },
  {
    stem: LANDING_SYSTEM_STEMS[2],
    tag: () => msg('System 03 // Resonance Dungeons'),
    title: () => msg('Send Agents Below'),
    teaser: () =>
      msg('Eight literary descents where stress is real. Agents return changed – or not at all.'),
    lore: () =>
      msg(
        'Below every world lie resonance dungeons – eight literary descents where the water rises one bureaucratic percentage point at a time and the odds are printed honestly on every door. Stress is bookkeeping here, kept in amber ink: agents return changed, decorated, or as a single line in the ledger of the deep.',
      ),
    quote: () =>
      msg(
        'Storey by storey the Deluge taught us subtraction. Four went down. The ledger shows three signatures and one water stain.',
      ),
    attribution: () => msg('Debrief fragment, descent authorization #88'),
    route: '/how-to-play/guide/dungeons',
    underConstruction: ALWAYS_READY,
  },
  {
    stem: LANDING_SYSTEM_STEMS[3],
    tag: () => msg('System 04 // Drift'),
    title: () => msg('Travel the In-Between'),
    teaser: () =>
      msg(
        'The node-sea between worlds is playable. Dock at a foreign broadcast edge, haul home cargo.',
      ),
    lore: () =>
      msg(
        'Between worlds stretches the node-sea: black, patient, crossed by amber signal-lines that hum like held breath. Charter a barge, follow a line to a foreign broadcast edge, and dock where your passport is a rumor. What you haul home has no field on any customs form, which is precisely why it is valuable.',
      ),
    quote: () =>
      msg(
        'Halfway between two worlds the radio picks up both of their lullabies at once. That is the whole reason I run this route.',
      ),
    attribution: () => msg('Logbook of the barge Second Postscript'),
    route: '/how-to-play/guide/drift',
    underConstruction: ALWAYS_READY,
  },
  {
    stem: LANDING_SYSTEM_STEMS[4],
    tag: () => msg('System 05 // The Substrate'),
    title: () => msg('Reality Bleeds In'),
    teaser: () =>
      msg(
        'Real events echo through every simulation as resonances. The boundary is thinner than you think.',
      ),
    lore: () =>
      msg(
        'The Substrate listens to your reality. Headlines, weather fronts, the general mood of a Tuesday – all of it arrives in every simulation as resonances, bent through each world’s own philosophy until your election is their comet and your heatwave is their angry god. The boundary was never sealed; it was only ever filed as sealed.',
      ),
    quote: () =>
      msg(
        'Your world sneezed and three of mine wrote prophecies about it. Kindly sneeze less, or at least on schedule.',
      ),
    attribution: () => msg('Complaint lodged by the Chitinous Mandate, unanswered'),
    route: '/how-to-play/guide/advanced',
    // Eine einzige aufgenommene Resonanz ist kein Bestand. Die Schwelle ist
    // bewusst niedrig: sobald ein zweistelliger Bestand da ist, faellt die
    // Marke weg, ohne dass jemand Code anfasst.
    underConstruction: (counts) => (counts?.resonances ?? 0) < 10,
  },
  {
    stem: LANDING_SYSTEM_STEMS[5],
    tag: () => msg('System 06 // Bureau Terminal'),
    title: () => msg('Play It as Text'),
    teaser: () =>
      msg('A command-line window into your world. Local perspective, narrative prose, no mercy.'),
    lore: () =>
      msg(
        'The Bureau Terminal is a keyhole into your world: one phosphor screen, one cursor, no mercy and no minimap. You see what a citizen at street level sees, told in narrative prose that does not care about your feelings. Type "look" and the world describes itself. Type something braver and it describes you back.',
      ),
    quote: () =>
      msg(
        'I asked the terminal where my agent was. It wrote: "Grieving. Third bench from the fountain. Bring bread." I brought bread.',
      ),
    attribution: () => msg('Operator transcript, 03:41, unfiled'),
    route: '/how-to-play/guide/terminal',
    underConstruction: ALWAYS_READY,
  },
] as const;
