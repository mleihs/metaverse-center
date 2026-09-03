/**
 * EIN FESTGESETZTER TEILBAUM MUSS DER SEITE IHREN KARTENRAHMEN ZURÜCKGEBEN.
 *
 * DIE LAGE
 *   `activeCardFrame` ist EIN globales Signal, aber eine Seite hat mehr als
 *   einen Theme-Wirt. Die Hülle setzt den Plattform-Skin auf `document.body`;
 *   `DriftView` und `DungeonView` setzen `PLATFORM_DARK_CONFIG` auf SICH
 *   SELBST, damit ihr Teilbaum phosphor bleibt, wie die Welt ringsum auch
 *   aussieht.
 *
 *   Beide begründen in ihrem Code, ein Abräumen sei nicht nötig: das Element
 *   werde beim Routenwechsel zerstört und nehme seine Inline-Tokens mit. Das
 *   stimmt für die Tokens und ist für dieses Signal falsch — es ist global,
 *   also überlebt der Rahmen der verschachtelten Ansicht die Ansicht.
 *
 * WARUM ALS TEST
 *   Am 03.09.2026 im Browser gemessen, Atlas-Skin: Rahmen `paper` vor einem
 *   verschachtelten dunklen Wirt, danach `none` + `terminal` + `holographic` —
 *   und so blieb er. Jede Karte auf dem Papier-Skin verlor ihr Papier und trug
 *   ein Terminal-Schild, bis irgendwann ein Skin-Wechsel das Signal neu
 *   schrieb.
 *
 *   Sichtbar wurde das erst, als der Atlas-Skin eine Textur nannte. Vorher
 *   waren beide Rahmen die Plattform-Vorgabe, und ein Leck ohne Unterschied
 *   zeigt nichts. Der Fehler war die ganze Zeit da.
 *
 *   Die Paarung „Wirt setzt / Wirt gibt zurück" ist von Hand gepflegt. Deshalb
 *   steht sie hier: ein dritter verschachtelter Wirt kann sie nicht mehr
 *   stillschweigend überspringen, ohne dass etwas rot wird.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Wie in platform-skin-switch.test.ts: ThemeService zieht über settingsApi die
// Supabase-Kette herein, die ohne VITE_SUPABASE_* wirft.
vi.mock('../src/services/api/index.js', () => ({
  settingsApi: {},
}));

import {
  activeCardFrame,
  restorePlatformCardFrame,
  setPlatformCardFrame,
} from '../src/services/card-frame.js';
import { PLATFORM_ATLAS_CONFIG, PLATFORM_DARK_CONFIG } from '../src/services/theme-presets.js';
import { themeService } from '../src/services/ThemeService.js';

describe('der Kartenrahmen eines festgesetzten Teilbaums leckt nicht', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    // applyConfig hängt pro Schriftfamilie ein <link> an; happy-dom holt es
    // wirklich. Das Einfügen verschlucken, hier geht es um den Rahmen.
    vi.spyOn(document.head, 'appendChild').mockImplementation((node) => node);
  });

  /*
   * Die beiden Skins müssen im Rahmen ÜBERHAUPT auseinandergehen, sonst prüft
   * der Rest dieser Datei nichts — genau der Zustand, in dem das Leck jahrelang
   * unsichtbar war.
   */
  it('die zwei Plattform-Skins nennen verschiedene Kartenrahmen', () => {
    expect(PLATFORM_ATLAS_CONFIG.card_frame_texture).not.toBe(
      PLATFORM_DARK_CONFIG.card_frame_texture ?? 'none',
    );
  });

  it('merkt sich den Rahmen des äußersten Wirts (document.body)', () => {
    themeService.applyConfig(PLATFORM_ATLAS_CONFIG, document.body);
    expect(activeCardFrame.value.texture).toBe('paper');

    // Etwas anderes überschreibt das Signal …
    setPlatformCardFrame(activeCardFrame.value);
    activeCardFrame.value = { texture: 'circuits', nameplate: 'terminal', corners: 'x', foil: 'y' };
    // … und die Rückgabe holt genau den Wirt-Rahmen zurück, nicht die Vorgabe.
    restorePlatformCardFrame();
    expect(activeCardFrame.value.texture).toBe('paper');
  });

  it('ein verschachtelter dunkler Wirt setzt den Rahmen und gibt ihn zurück', () => {
    themeService.applyConfig(PLATFORM_ATLAS_CONFIG, document.body);
    const before = { ...activeCardFrame.value };

    const nested = document.createElement('div');
    document.body.appendChild(nested);
    themeService.applyConfig(PLATFORM_DARK_CONFIG, nested);
    expect(activeCardFrame.value.texture, 'der Teilbaum setzt seinen Rahmen').not.toBe(
      before.texture,
    );

    // Was DriftView / DungeonView in disconnectedCallback tun.
    nested.remove();
    restorePlatformCardFrame();

    expect(activeCardFrame.value).toEqual(before);
  });

  /*
   * Der verschachtelte Wirt darf die Erinnerung NICHT überschreiben — sonst
   * gäbe die Rückgabe den dunklen Rahmen zurück und hieße nur anders.
   */
  it('ein verschachtelter Wirt überschreibt die Erinnerung nicht', () => {
    themeService.applyConfig(PLATFORM_ATLAS_CONFIG, document.body);

    const nested = document.createElement('div');
    document.body.appendChild(nested);
    themeService.applyConfig(PLATFORM_DARK_CONFIG, nested);

    restorePlatformCardFrame();
    expect(activeCardFrame.value.texture).toBe('paper');
  });

  /*
   * Und der Weg zurück muss genauso gehen: wer im Papier-Skin einen Dungeon
   * betritt, darf nach dem Umschalten auf Phosphor nicht dessen Papier erben.
   */
  it('gilt in beide Richtungen', () => {
    themeService.applyConfig(PLATFORM_DARK_CONFIG, document.body);
    const dark = { ...activeCardFrame.value };

    const nested = document.createElement('div');
    document.body.appendChild(nested);
    themeService.applyConfig(PLATFORM_ATLAS_CONFIG, nested);
    nested.remove();
    restorePlatformCardFrame();

    expect(activeCardFrame.value).toEqual(dark);
  });
});
