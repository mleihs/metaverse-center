/**
 * Die Anbieter, für die eine Person einen eigenen Schlüssel hinterlegen kann.
 *
 * Vorher stand jeder Anbieter an fünf Stellen ausgeschrieben: zwei Karten im
 * Panel mit eigenem Text, zwei Spalten in `user_wallets`, zwei Parameter in
 * der RPC, zwei Felder in `BYOKStatus`, zwei Zweige in jedem `if provider ===`.
 * Ein dritter Anbieter war deshalb keine Zeile, sondern eine Operation.
 *
 * Seit Migration 333 ist die Speicherung eine Zeile je (Nutzer, Anbieter);
 * hier ist das Gegenstück in der Oberfläche. **Ein neuer Anbieter ist ein
 * Eintrag in diesem Feld** — die Karte, die Einfüge-Erkennung, die Kette und
 * die Admin-Kennzahlen lesen alle daraus.
 *
 * Beschriftungen sind FUNKTIONEN, keine Zeichenketten: ein `msg()` in einem
 * Modul-Array wird beim Laden ausgewertet und ändert sich beim Sprachwechsel
 * nicht mehr mit (siehe `i18n-gotchas`).
 */
import { msg } from '@lit/localize';

export type KeyProviderId = 'openrouter' | 'replicate';

export interface KeyProvider {
  /** Muss dem `provider`-Wert in `user_api_keys` entsprechen. */
  id: KeyProviderId;
  /** Eigenname des Anbieters — wird NICHT übersetzt. */
  name: string;
  /** Wofür er im Haus zuständig ist, als Kicker rechts auf der Karte. */
  service: () => string;
  /** Woran die Einfüge-Karte ihn erkennt. */
  prefix: string;
  placeholder: string;
  /** Was er antreibt — ein Satz, kein Katalog. */
  purpose: () => string;
  signupUrl: string;
  /**
   * Ob der Anbieter ein Ausgabenlimit über seine API herausgibt. Bei
   * Replicate gibt es kein Gegenstück; die Karte lässt den Block dann weg,
   * statt eine leere Zeile zu zeigen.
   */
  supportsLimit: boolean;
}

export const KEY_PROVIDERS: readonly KeyProvider[] = [
  {
    id: 'openrouter',
    name: 'OpenRouter',
    service: () => msg('Language'),
    prefix: 'sk-or-',
    placeholder: 'sk-or-v1-...',
    purpose: () =>
      msg('Drives the text side of the Forge: research, anchors, agents and buildings, lore and its translations.'),
    signupUrl: 'https://openrouter.ai/keys',
    supportsLimit: true,
  },
  {
    id: 'replicate',
    name: 'Replicate',
    service: () => msg('Imagery'),
    prefix: 'r8_',
    placeholder: 'r8_...',
    purpose: () =>
      msg('Drives the Darkroom: agent portraits, building imagery and the visuals of a world’s lore.'),
    signupUrl: 'https://replicate.com/account/api-tokens',
    supportsLimit: false,
  },
] as const;

export function providerById(id: KeyProviderId): KeyProvider {
  const found = KEY_PROVIDERS.find((p) => p.id === id);
  if (!found) {
    // Unerreichbar, solange `KeyProviderId` und das Feld beieinander bleiben —
    // und genau deshalb laut, falls sie es einmal nicht tun.
    throw new Error(`Unknown key provider: ${id}`);
  }
  return found;
}

/**
 * Welcher Anbieter zu einem eingefügten Schlüssel gehört — oder keiner.
 *
 * Leerzeichen fallen weg, weil ein aus einer Mail kopierter Schlüssel sie
 * regelmäßig mitbringt und der Mensch sie nicht sieht.
 */
export function detectProvider(raw: string): KeyProvider | null {
  const value = raw.replace(/\s+/g, '');
  return KEY_PROVIDERS.find((p) => value.startsWith(p.prefix)) ?? null;
}

/** Die Anbieternamen für eine Aufzählung im Text. */
export function providerNames(): string {
  return KEY_PROVIDERS.map((p) => p.name).join(', ');
}
