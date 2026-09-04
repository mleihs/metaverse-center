/**
 * Die fünf Stufen, in denen ein Gespräch ohne Zuhörer weitergeht.
 *
 * Sie stehen hier und nicht im Fenster, weil sie an DREI Stellen dieselben
 * sein müssen und eine Zahl, die dreimal getippt wird, dreimal falsch getippt
 * werden kann:
 *
 *   1. die CHECK-Beschränkung in Migration 357
 *   2. das `Literal[4, 6, 12, 24, 48]` in `ConversationContinuationRequest`
 *   3. der Regler in `ChatWindow`
 *
 * Steht hier eine sechste Zahl, weist Postgres sie mit 23514 ab – aus der
 * Tiefe, ohne einen Hinweis darauf, wo sie herkam. `test_conversation_
 * continuation.py` bindet 1 an 2, `continuation-steps.test.ts` bindet 3 an
 * dieselbe Menge.
 *
 * ⚠ **Das geschützte Leerzeichen in `hint` ist kein Zierrat.** Ohne es bricht
 * die Zeile im schmalen Einstellungsfeld zwischen der Zahl und dem Wort um,
 * und die Zahl steht allein am Zeilenende – die eine Stelle, an der sie
 * niemand sucht. `nowrap` auf der ganzen Zeile wäre der falsche Griff: es
 * verböte den Umbruch auch dort, wo er erwünscht ist.
 *
 * ⚠ **Die Reihenfolge ist absteigend nach Stunden**, also aufsteigend nach
 * Häufigkeit: links selten, rechts lebhaft. Ein Regler, dessen Bahn nach
 * rechts hin WENIGER bedeutet, wird falsch bedient, und niemand merkt es,
 * weil beide Enden plausibel aussehen.
 */

import { msg } from '@lit/localize';
import type { ConversationContinueHours } from '../../types/index.js';
import type { SliderMark } from '../shared/VelgForecastSlider.js';

/**
 * Der Mindestabstand jeder Stufe, nach Rastenposition.
 *
 * Der Regler trägt den INDEX (0–4); die Stunden stehen nur hier. Ein Regler,
 * der seinen eigenen Wert übersetzte, wäre an der nächsten Stelle im Weg.
 */
export const CONTINUE_HOURS: readonly ConversationContinueHours[] = [48, 24, 12, 6, 4] as const;

/** Die Vorgabe – dieselbe wie der Spalten-Vorgabewert in Migration 357. */
export const CONTINUE_DEFAULT_HOURS: ConversationContinueHours = 12;

/** Die Rastenposition der Vorgabe, für die Kerbe am Regler. */
export const CONTINUE_DEFAULT_INDEX = CONTINUE_HOURS.indexOf(CONTINUE_DEFAULT_HOURS);

/**
 * Stunden zurück auf die Rastenposition.
 *
 * Ein unbekannter Wert fällt auf die Vorgabe zurück und nicht auf -1: der
 * Regler stünde sonst links neben seiner ersten Raste, und die Anzeige nennte
 * keinen Namen. Das kann passieren, wenn die Datenbank eine Stufe kennt, die
 * dieser Build noch nicht kennt – ein Zustand während eines Ausrollens.
 */
export function continueIndexOf(hours: number | undefined): number {
  const idx = CONTINUE_HOURS.indexOf(hours as ConversationContinueHours);
  return idx >= 0 ? idx : CONTINUE_DEFAULT_INDEX;
}

/**
 * Beschriftung UND Stundenangabe für den Regler.
 *
 * Der Name steht groß über der Bahn, die Stundenzahl als Kerbenbeschriftung
 * darunter, und beide zusammen gehen in `aria-valuetext`. Wer den Regler nicht
 * sieht, hört also dasselbe wie jemand, der ihn sieht.
 *
 * Eine Funktion und keine Konstante: `msg()` löst gegen die AKTUELLE Sprache
 * auf, und eine beim Laden des Moduls berechnete Liste bliebe für immer in der
 * Sprache, die beim ersten Import galt.
 */
export function continueMarks(): SliderMark[] {
  return [
    { value: 0, label: msg('rarely'), hint: msg('every 48 hours'), tick: '48' },
    { value: 1, label: msg('occasionally'), hint: msg('every 24 hours'), tick: '24' },
    { value: 2, label: msg('regularly'), hint: msg('every 12 hours'), tick: '12' },
    { value: 3, label: msg('often'), hint: msg('every 6 hours'), tick: '6' },
    { value: 4, label: msg('lively'), hint: msg('every 4 hours'), tick: '4' },
  ];
}
