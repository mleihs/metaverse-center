/**
 * Wie viele Karten in eine Reihe des Übersichtsstreifens passen.
 *
 * Der Streifen zeigte acht Karten in fester Größe `sm` (120 px). In dieser
 * Größe blendet `<velg-game-card>` selbst aus, was ihr übergeben wird: der
 * Untertitel steht auf 8 px, das Abzeichen auf 6 px, die Beschriftung der
 * Eignungs-Pips auf `display: none`. Am Bildschirm gemessen war das der Grund,
 * warum die Karten „klein und ohne Text" wirkten — nicht ein fehlender Wert,
 * sondern eine Größe, in der die Karte ihre eigenen Angaben verwirft.
 *
 * `md` (200 px) zeigt alles, passt aber nicht achtmal nebeneinander. Statt
 * eine Anzahl zu wählen, die nur auf einem Bildschirm stimmt, misst der
 * Streifen seine Spalte. Eine angebrochene zweite Reihe mit einer einzelnen
 * Karte ist kein Streifen, sondern ein Rest — es erscheint deshalb genau eine
 * volle Reihe, und der Verweis daneben führt zur vollständigen Liste.
 *
 * Reine Funktion, damit die Rechnung prüfbar ist, ohne ein Bauteil zu bauen.
 */

/** Die Größenleiter von `<velg-game-card>` in Pixeln — sie ist fest. */
export const CARD_WIDTH: Record<StripSize, number> = { sm: 120, md: 200 };

/** `--space-3-5`, die Lücke in `.strip__grid`. */
export const STRIP_GAP = 14;

/**
 * Unterhalb dieser Breite bleiben von `md` zwei Karten übrig, und zwei Karten
 * sind kein Streifen. Dort ist `sm` die ehrlichere Wahl: lieber vier lesbare
 * kleine als zwei große, die nichts über die Welt erzählen.
 */
export const MD_MIN_WIDTH = 900;

/** Die Obergrenze beider Streifen, bevor sie den Leser weiterschicken. */
export const STRIP_LIMIT = 8;

export type StripSize = 'sm' | 'md';

export interface StripLayout {
  size: StripSize;
  shown: number;
}

/**
 * @param width Gemessene Breite der Spalte. `0` heißt „noch nicht gemessen".
 * @param total Wie viele Karten überhaupt zur Verfügung stehen.
 */
export function stripLayout(width: number, total: number): StripLayout {
  // Vor der ersten Messung: der bisherige Zustand, nicht eine einzelne Karte.
  // Ein Streifen, der im ersten Bild leer aussieht und im zweiten voll, ist
  // schlimmer als einer, der zu klein anfängt.
  if (width <= 0) return { size: 'sm', shown: Math.min(total, STRIP_LIMIT) };

  const size: StripSize = width >= MD_MIN_WIDTH ? 'md' : 'sm';
  const perRow = Math.max(2, Math.floor((width + STRIP_GAP) / (CARD_WIDTH[size] + STRIP_GAP)));
  return { size, shown: Math.min(total, STRIP_LIMIT, perRow) };
}
