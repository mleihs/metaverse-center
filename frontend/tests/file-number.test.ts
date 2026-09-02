/**
 * Die Aktennummer muss unterscheiden — das ist ihr einziger Zweck.
 *
 * Die erste Fassung nahm die ersten acht Zeichen der UUID und las sich auf
 * Produktion als `P-0000-0000`: das Konto des Plattform-Admins trägt eine von
 * Hand gesetzte Kennung (`00000000-…-0001`), und aus Migrationen stammende
 * Zeilen tun das ähnlich. Ein Wiedererkennungszeichen, das für mehrere
 * Menschen gleich aussieht, erkennt nichts wieder — und genau das fällt in
 * einem Test mit zufälligen UUIDs NICHT auf. Deshalb stehen hier die
 * gesetzten Kennungen ausdrücklich drin.
 */
import { describe, expect, it } from 'vitest';

/** Dieselbe Ableitung wie in `UserProfileView._fileNumber`. */
function fileNumber(id: string): string {
  let hash = 0x811c9dc5;
  for (const ch of id.replace(/-/g, '')) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  const mark = hash.toString(36).toUpperCase().padStart(7, '0').slice(-7);
  return `P-${mark.slice(0, 3)}-${mark.slice(3)}`;
}

const SEEDED = [
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003',
];

describe('Aktennummer', () => {
  it('unterscheidet auch Kennungen, die sich nur im letzten Zeichen unterscheiden', () => {
    const marks = SEEDED.map(fileNumber);
    expect(new Set(marks).size).toBe(SEEDED.length);
  });

  it('ist für dieselbe Person immer dieselbe', () => {
    expect(fileNumber(SEEDED[0])).toBe(fileNumber(SEEDED[0]));
  });

  it('hat die Form P-XXX-XXXX und ist nie leer', () => {
    for (const id of [...SEEDED, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890']) {
      expect(fileNumber(id)).toMatch(/^P-[0-9A-Z]{3}-[0-9A-Z]{4}$/);
    }
  });

  it('streut über zufällige Kennungen ohne Doppelung', () => {
    const ids = Array.from({ length: 500 }, () =>
      crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36),
    );
    const marks = new Set(ids.map(fileNumber));
    // Bei 500 Werten aus 36^7 Möglichkeiten ist eine Doppelung praktisch
    // ausgeschlossen; eine hier hiesse, die Mischung sieht nur einen Teil der
    // Kennung an.
    expect(marks.size).toBe(ids.length);
  });
});
