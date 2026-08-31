/**
 * Ein Übersetzungsziel kann DA sein und trotzdem falsch gebaut.
 *
 * WAS GEFUNDEN WURDE
 * Der Gebäude-Reiter zeigte auf Prod:
 *
 *     GEBÄUDE INSGESAMT7 GEBÄUDE INSGESAMT
 *
 * Die Ursache stand im Ziel, nicht im Code:
 *
 *     <source><x id="0"/> buildings total</source>
 *     <target>Gebäude insgesamt<x id="0"/> Gebäude insgesamt</target>
 *
 * Der deutsche Text steht ZWEIMAL, einmal vor und einmal nach dem Platzhalter.
 * Gemessen am 31.08.2026: **21 Ziele** dieser Form — „Nachrichten12 Nachrichten",
 * „Bearbeiten Gebäude bearbeiten", „Löschen Epoche X löschen".
 *
 * WARUM KEIN BESTEHENDES MESSGERÄT DAS SAH
 * Die i18n-Prüfungen des Tages suchten nach FEHLENDEN Zielen (kein `<target>`)
 * und nach IDENTISCHEN (Ziel = Quelle). Ein Ziel, das da ist, sich von der
 * Quelle unterscheidet und trotzdem falsch gebaut ist, fällt durch beide Netze
 * — es ist weder leer noch gleich. Drei blinde Flecken an einem Instrument, und
 * jeder wurde erst sichtbar, als jemand auf den Bildschirm sah.
 *
 * WAS DIESER TEST PRÜFT
 * Wiederholt ein Ziel denselben Text vor UND nach seinem Platzhalter, ist es
 * kaputt. Die Prüfung ist absichtlich eng (Kopf und Fuss müssen wörtlich gleich
 * sein, ab sechs Zeichen), damit sie keine legitime Wiederholung meldet — etwa
 * „von X bis X" oder eine Aufzählung.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/* Pfad ueber das Arbeitsverzeichnis, nicht ueber `import.meta.url`: vitest
 * liefert hier keine file:-URL, und `readFileSync` nimmt nur solche. Der
 * vitest-Root ist `frontend/`, also ist dieser Pfad stabil. */
const XLF = resolve(process.cwd(), 'src/locales/xliff/de.xlf');
const PLACEHOLDER = /<x [^>]*\/>/;

interface Unit {
  id: string;
  source: string;
  target: string | null;
}

function units(): Unit[] {
  const raw = readFileSync(XLF, 'utf8');
  const out: Unit[] = [];
  for (const block of raw.split(/(?=<trans-unit id=)/)) {
    if (!block.startsWith('<trans-unit id=')) continue;
    const id = /id="([^"]+)"/.exec(block)?.[1];
    const source = /<source>([\s\S]*?)<\/source>/.exec(block)?.[1];
    const target = /<target>([\s\S]*?)<\/target>/.exec(block)?.[1] ?? null;
    if (id && source !== undefined) out.push({ id, source, target });
  }
  return out;
}

describe('de.xlf targets are well formed', () => {
  const all = units();

  it('the file parses into a plausible number of units', () => {
    // Ein Test, der nichts liest, besteht sonst aus dem falschen Grund — das ist
    // an diesem Tag mehrfach passiert, auch an eigenen Messgeräten.
    expect(all.length).toBeGreaterThan(5000);
  });

  it('every unit carries a target', () => {
    const missing = all.filter((u) => u.target === null).map((u) => u.source.slice(0, 70));
    expect(
      missing,
      `unübersetzt:\n${missing.join('\n')}\n` +
        'lit-localize lässt <target> bei unübersetzten Einheiten GANZ WEG — ein Muster, ' +
        'das nach <target/> sucht, findet die fehlende Form nicht.',
    ).toEqual([]);
  });

  it('no target repeats its own text on both sides of a placeholder', () => {
    const broken: string[] = [];
    for (const u of all) {
      if (u.target === null || !PLACEHOLDER.test(u.target)) continue;
      const parts = u.target.split(/<x [^>]*\/>/);
      const head = parts[0].trim();
      const tail = parts[parts.length - 1].trim();
      if (head.length > 5 && head.toLowerCase() === tail.toLowerCase()) {
        broken.push(`${u.source.slice(0, 55)}\n      → ${u.target.slice(0, 80)}`);
      }
    }
    expect(
      broken,
      `Ziele, die ihren Text vor UND nach dem Platzhalter wiederholen:\n${broken.join('\n')}\n` +
        'Im Deutschen steht die richtige Hälfte HINTEN — das Verb am Ende ' +
        '("X bearbeiten"), die Einheit nach der Zahl ("7 Gebäude insgesamt"). ' +
        'Den Kopf verwerfen, Platzhalter und Schwanz behalten.',
    ).toEqual([]);
  });

  it('a target keeps every placeholder id its source declares', () => {
    /* Ein verlorener Platzhalter zeigt dem Leser eine Lücke, wo eine Zahl oder
     * ein Name stehen sollte — und lit-localize meldet das nicht, weil das Ziel
     * formal gültig bleibt. */
    const lost: string[] = [];
    for (const u of all) {
      if (u.target === null) continue;
      const ids = (s: string) => [...s.matchAll(/<x id="([^"]+)"/g)].map((m) => m[1]).sort();
      const a = ids(u.source);
      const b = ids(u.target);
      if (a.join(',') !== b.join(',')) {
        lost.push(`${u.source.slice(0, 55)}  [${a}] → [${b}]`);
      }
    }
    expect(lost, `Platzhalter gehen verloren oder kommen dazu:\n${lost.join('\n')}`).toEqual([]);
  });
});
