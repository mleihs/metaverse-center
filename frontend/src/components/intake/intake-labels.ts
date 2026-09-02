/**
 * Die Wörter der Schleuse.
 *
 * Getrennt von `types/intake.ts`, weil dort die IDENTITÄTEN stehen und hier die
 * BESCHRIFTUNGEN. Der Zustand führt `official`, der Schirm zeigt „Amtlich" —
 * wer beides in derselben Datei hält, schreibt irgendwann das eine ins andere,
 * und dann ist eine Linse in der Sprache eingefroren, in der sie gestellt wurde.
 *
 * Vorbild und Nachbar: `utils/enum-labels.ts`. Der Vektor wird von dort
 * geliehen (`bleedVectorLabel`) und hier NICHT zum zweiten Mal übersetzt — die
 * sieben Werte sind dieselbe Union, und zwei Übersetzungstabellen für eine
 * Union laufen auseinander, sobald jemand eine davon anfasst.
 */

import { msg } from '@lit/localize';
import type { IntakeTone } from '../../types/intake.js';

/**
 * Der Archetyp hinter einer Kategorie, in der Sprache des Lesers.
 *
 * Der Parameter ist der Bezeichner aus `CATEGORY_ARCHETYPE`, also das, was das
 * Backend führt. Ein unbekannter Wert kommt unverändert zurück: er stammt dann
 * aus einer neueren Kategorie, und ein englischer Archetypname ist immer noch
 * besser als ein Leerstring.
 */
export function archetypeLabel(archetype: string): string {
  switch (archetype) {
    case 'The Tower':
      return msg('The Tower');
    case 'The Shadow':
      return msg('The Shadow');
    case 'The Devouring Mother':
      return msg('The Devouring Mother');
    case 'The Deluge':
      return msg('The Deluge');
    case 'The Overthrow':
      return msg('The Overthrow');
    case 'The Prometheus':
      return msg('The Prometheus');
    case 'The Awakening':
      return msg('The Awakening');
    case 'The Entropy':
      return msg('The Entropy');
    default:
      return archetype;
  }
}

/** Die Tonlage, in der die Welt von dem Signal erfährt. */
export function toneLabel(tone: IntakeTone): string {
  switch (tone) {
    case 'official':
      return msg('Official');
    case 'propaganda':
      return msg('Propaganda');
    case 'rumour':
      return msg('Rumour');
    default:
      return msg('Protocol');
  }
}

/**
 * Das Wort für eine Wucht.
 *
 * Vier Stufen über zehn Zahlen: die Zahl geht als `impact_level` an die
 * Aufnahme, das Wort sagt dem Menschen, was er da einstellt. Die Schwellen
 * stammen aus dem Bauplan (`handoff/schleuse-event-intake.md`, § Schmelztiegel).
 */
export function impactWord(impact: number): string {
  if (impact <= 3) return msg('Rumour');
  if (impact <= 6) return msg('Unrest');
  if (impact <= 8) return msg('Shock');
  return msg('Overthrow');
}

/** Wie weit sich die Erzeugung vom Ursprung entfernen darf. */
export function freedomLabel(creativity: number): string {
  if (creativity <= 0.4) return msg('Faithful');
  if (creativity <= 0.7) return msg('Measured');
  return msg('Free');
}

/** Was der jeweilige Freiheitsgrad bedeutet, als Fussnote neben den Chips. */
export function freedomNote(creativity: number): string {
  if (creativity <= 0.4) return msg('Temperature 0.4 · names the source');
  if (creativity <= 0.7) return msg('Temperature 0.7 · the default');
  return msg('Temperature 0.9 · invents around it');
}
