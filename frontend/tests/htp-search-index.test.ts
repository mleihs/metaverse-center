/**
 * Der Suchindex der Hilfe muss den Fließtext enthalten, nicht nur die Überschriften (H5).
 *
 * BEFUND
 * ------
 * `getSearchIndex()` sammelte je Thema: den Titel, die Beschreibung, die
 * TL;DR-Punkte und die TITEL der Abschnitte. Nicht gesammelt wurde alles, was
 * in den Abschnitten steht — und dort steht die Hilfe:
 *
 *   - `text`-Abschnitte: der ganze Absatz
 *   - `callouts`: Etikett und Text jeder Karte
 *   - `readout`: Etikett und Wert jeder Zeile
 *   - `steps`: Titel, Erzähltext, Detail, Tipp, Warnung und Messwerte
 *     JEDES Schritts — indiziert war nur der Titel des Abschnitts, der sie
 *     zusammenfasst
 *
 * Wer „Abklingzeit" oder „Herzschlag" suchte, fand also nur dann etwas, wenn
 * das Wort zufällig in einer Überschrift stand. Die Suche behauptete durch ihr
 * bloßes Vorhandensein, das Handbuch sei durchsuchbar.
 *
 * Diese Datei MISST die Abdeckung, statt eine Zahl zu behaupten: sie summiert
 * die Zeichen aller erreichbaren Textfelder und vergleicht sie mit der Summe
 * der indizierten. Die Untergrenze unten ist bewusst großzügig — sie soll
 * einen Rückfall fangen, nicht eine bestimmte Zahl festnageln (J7).
 *
 * Was NICHT indizierbar ist und es auch nicht wird: `custom`-Abschnitte
 * rendern eine `TemplateResult` und haben keinen Text, den man ohne Rendern
 * lesen könnte. Sie werden gezählt und ausgewiesen, damit die Lücke eine Zahl
 * hat statt eines Schweigens.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { getSearchIndex, clearSearchIndex, searchTopics } from '../src/components/how-to-play/htp-search.js';
import { TOPICS } from '../src/components/how-to-play/htp-topic-data.js';

/** Jeder Text, den ein Leser auf einer Themenseite zu sehen bekommt. */
function reachableText(): { total: number; customSections: number } {
  let total = 0;
  let customSections = 0;
  for (const topic of TOPICS) {
    total += topic.title.length + topic.description.length;
    for (const bullet of topic.tldr()) total += bullet.length;
    for (const section of topic.sections()) {
      if (section.kind === 'text') {
        total += section.content.length;
      } else if (section.kind === 'callouts') {
        for (const item of section.items) total += item.label.length + item.text.length;
      } else if (section.kind === 'readout') {
        total += (section.title ?? '').length;
        for (const row of section.data()) total += row.label.length + row.value.length;
      } else if (section.kind === 'steps') {
        total += section.title.length;
        for (const step of section.steps()) {
          total += step.title.length + step.narration.length;
          total += (step.detail ?? '').length + (step.tip ?? '').length + (step.warning ?? '').length;
          for (const row of step.readout ?? []) total += row.label.length + row.value.length;
        }
      } else {
        customSections += 1;
        total += (section.title ?? '').length;
      }
    }
  }
  return { total, customSections };
}

describe('Suchindex der Hilfe', () => {
  beforeAll(() => {
    clearSearchIndex();
  });

  it('indiziert den ganz überwiegenden Teil des erreichbaren Textes', () => {
    const { total, customSections } = reachableText();
    const indexed = getSearchIndex().reduce((sum, entry) => sum + entry.original.length, 0);
    const share = indexed / total;

    // Zur Nachvollziehbarkeit im Fehlerfall — die Zahl gehört in den Bericht,
    // nicht in eine Gleichheitszusicherung.
    expect(total).toBeGreaterThan(20_000);
    expect(
      share,
      `indiziert ${indexed} von ${total} Zeichen (${(share * 100).toFixed(1)} %), ` +
        `${customSections} custom-Abschnitte sind bauartbedingt nicht indizierbar`,
    ).toBeGreaterThan(0.8);
  });

  it('sammelt aus jeder Abschnittsart, die Text trägt', () => {
    const fields = new Set(getSearchIndex().map((entry) => entry.field));
    for (const field of ['title', 'description', 'tldr', 'section', 'body', 'callout', 'readout', 'step'] as const) {
      expect(fields, `keine Einträge der Art ${field}`).toContain(field);
    }
  });

  it('findet ein Wort, das nur im Fließtext steht', () => {
    // Vor H5 fand die Suche nur Überschriften. Ein Wort, das ausschließlich in
    // einem `narration`- oder `text`-Feld vorkommt, war unauffindbar.
    const bodyOnly = getSearchIndex().filter((entry) => entry.field === 'step' || entry.field === 'body');
    expect(bodyOnly.length).toBeGreaterThan(50);

    const sample = bodyOnly.find((entry) => entry.original.split(/\s+/).length > 12);
    expect(sample, 'kein Fließtext-Eintrag mit genug Wörtern gefunden').toBeDefined();
    const word = sample?.original.split(/\s+/).find((w) => w.replace(/\W/g, '').length > 7)?.replace(/\W/g, '');
    expect(word, 'kein langes Wort im Fließtext gefunden').toBeTruthy();

    const hits = searchTopics(word as string);
    expect(hits.length, `„${word}" wurde nicht gefunden`).toBeGreaterThan(0);
  });

  it('führt kein Thema doppelt in einem Treffer', () => {
    // Der Index hat jetzt viele Einträge je Thema; die Ergebnisliste darf
    // trotzdem jedes Thema höchstens einmal zeigen.
    const hits = searchTopics('e');
    const slugs = hits.map((hit) => hit.topic.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('bleibt bei einer leeren Eingabe leer', () => {
    expect(searchTopics('')).toEqual([]);
    expect(searchTopics('   ')).toEqual([]);
  });
});
