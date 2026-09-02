/**
 * Die Anbieter-Registry — das Feld, aus dem der Schlüsselbund entsteht.
 *
 * Geprüft wird, was beim Hinzufügen eines dritten Anbieters leicht kaputtgeht
 * und nirgends auffällt: dass die Präfixe die Karten EINDEUTIG auseinander
 * halten (sonst landet ein eingefügter Schlüssel in der falschen), und dass
 * die Erkennung Leerzeichen verträgt — ein aus einer Mail kopierter Schlüssel
 * bringt sie regelmässig mit, und der Mensch sieht sie nicht.
 */
import { describe, expect, it } from 'vitest';
import {
  detectProvider,
  KEY_PROVIDERS,
  providerById,
  providerNames,
} from '../src/utils/key-providers.js';

describe('KEY_PROVIDERS', () => {
  it('hält für jeden Anbieter genau eine Zeile', () => {
    const ids = KEY_PROVIDERS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('trennt die Anbieter eindeutig am Präfix', () => {
    // Kein Präfix darf Anfang eines anderen sein — sonst entscheidet die
    // Reihenfolge im Feld darüber, in welcher Karte ein Schlüssel landet,
    // und die Reihenfolge ist kein Vertrag.
    for (const a of KEY_PROVIDERS) {
      for (const b of KEY_PROVIDERS) {
        if (a.id === b.id) continue;
        expect(a.prefix.startsWith(b.prefix)).toBe(false);
      }
    }
  });

  it('nennt für jeden Anbieter eine Anmeldeadresse und einen Platzhalter', () => {
    for (const p of KEY_PROVIDERS) {
      expect(p.signupUrl).toMatch(/^https:\/\//);
      expect(p.placeholder.startsWith(p.prefix)).toBe(true);
    }
  });
});

describe('detectProvider', () => {
  it('erkennt jeden Anbieter an seinem eigenen Platzhalter', () => {
    for (const p of KEY_PROVIDERS) {
      expect(detectProvider(p.placeholder)?.id).toBe(p.id);
    }
  });

  it('verträgt Leerzeichen und Zeilenumbrüche aus dem Zwischenspeicher', () => {
    expect(detectProvider('  sk-or-v1-abc  ')?.id).toBe('openrouter');
    expect(detectProvider('r8_\nabc')?.id).toBe('replicate');
  });

  it('gibt für Unbekanntes null zurück statt zu raten', () => {
    expect(detectProvider('sk-proj-openai-style')).toBeNull();
    expect(detectProvider('')).toBeNull();
  });
});

describe('providerById', () => {
  it('wirft laut, statt still einen Vorgabewert zu liefern', () => {
    // Unerreichbar, solange Typ und Feld beieinander bleiben — und genau
    // deshalb laut, falls sie es einmal nicht tun. Ein stiller Rückfall auf
    // den ersten Anbieter würde einen Schlüssel in die falsche Karte legen.
    // @ts-expect-error – absichtlich ein Wert ausserhalb des Typs
    expect(() => providerById('anthropic')).toThrow();
  });
});

describe('providerNames', () => {
  it('zählt alle auf, damit die Fehlermeldung vollständig bleibt', () => {
    const names = providerNames();
    for (const p of KEY_PROVIDERS) {
      expect(names).toContain(p.name);
    }
  });
});
