/**
 * Guard for the dungeon HUD's platform-dark pin.
 *
 * WHAT IS BEING PROTECTED
 * The dungeon HUD is platform chrome, not content. The design package says so in
 * its first list of principles ("Simulation-Themes: Inhalte theme-fähig,
 * Plattform-Chrome bleibt immer dunkel/amber") and again in §4.2 and §4.5, where
 * it names the HUD's ground literally. So `DungeonView` re-asserts the platform
 * defaults on its own host with `themeService.applyConfig(PLATFORM_DARK_CONFIG, this)`,
 * neutralising the per-sim theme the shell put on an ancestor. Same mechanism
 * DriftView uses for the Zwischenraum.
 *
 * WHY A TEST AND NOT JUST THE CODE — three ways this breaks silently:
 *
 * 1. A NEW THEMEABLE COLOUR. `THEME_TOKEN_MAP` decides what a world may repaint.
 *    Add an entry there without adding it to `PLATFORM_DARK_CONFIG` and the
 *    world's colour leaks back into the HUD — and into DRIFT — with nothing to
 *    catch it. `drift-platform-theme.test.ts` checks the other direction (every
 *    config value equals its `:root` token) and says "keep in sync if a new
 *    themeable color token is added", which is an instruction to a human, not a
 *    gate. This is that gate.
 *
 * 2. THE PIN COMING BACK AS CSS. It lived in CSS twice before — two
 *    byte-identical `:host` blocks, in DungeonTerminalView and
 *    dungeon-graphical-styles, eleven tokens and eleven `lint-color-ok` pragmas
 *    each. Both were incomplete in the same way: they pinned surfaces, text and
 *    borders but not the five status colours the child components read 245
 *    times. Measured on the pinned ground across the ten presets, the worst was
 *    `--color-primary` at 1.06:1 in `brutalist` — invisible. A hand-written pin
 *    is a copy that will be incomplete again, so the test refuses one.
 *
 * 3. THE CALL DISAPPEARING in a refactor of DungeonView, which no other test
 *    would notice: nothing about the dungeon's behaviour depends on it, only its
 *    legibility.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PLATFORM_DARK_CONFIG } from '../src/services/theme-presets.js';

/** Read a source file next to this test. */
function read(relPath: string): string {
  return readFileSync(new URL(relPath, import.meta.url), 'utf8');
}

/**
 * The colour subset of `THEME_TOKEN_MAP`, read from ThemeService as TEXT.
 *
 * Not imported: ThemeService pulls in the Supabase client chain, which is why
 * `drift-platform-theme.test.ts` transcribes the map by hand instead. A
 * transcription is a second copy and drifts exactly like the one this test
 * exists to prevent, so this reads the real declaration.
 */
function themeableColorKeys(): string[] {
  const src = read('../src/services/ThemeService.ts');
  const block = /THEME_TOKEN_MAP[^=]*=\s*\{(.*?)^\};/ms.exec(src);
  expect(block, 'THEME_TOKEN_MAP not found in ThemeService.ts — has it been renamed?').toBeTruthy();
  const keys: string[] = [];
  const entry = /([a-z0-9_]+):\s*'(--[a-z0-9-]+)'/g;
  let m: RegExpExecArray | null = entry.exec(block![1]);
  while (m !== null) {
    if (m[2].startsWith('--color-')) keys.push(m[1]);
    m = entry.exec(block![1]);
  }
  return keys;
}

describe('the dungeon HUD stays platform-dark under every simulation theme', () => {
  it('PLATFORM_DARK_CONFIG neutralises EVERY themeable colour token', () => {
    const keys = themeableColorKeys();
    // Sanity: if the regex stops matching, an empty list would pass vacuously.
    expect(keys.length, 'no colour keys parsed out of THEME_TOKEN_MAP').toBeGreaterThan(10);

    const leaking = keys.filter((k) => !(k in PLATFORM_DARK_CONFIG));
    expect(
      leaking,
      `themeable colour keys with no platform-dark value: ${leaking.join(', ')} — ` +
        'a world can repaint these, and the dungeon HUD and DRIFT would inherit them. ' +
        'Add each to PLATFORM_DARK_CONFIG with its :root value.',
    ).toEqual([]);
  });

  it('DungeonView applies it to its own host', () => {
    const src = read('../src/components/dungeon/DungeonView.ts');
    expect(src).toMatch(/themeService\.applyConfig\(\s*PLATFORM_DARK_CONFIG\s*,\s*this\s*\)/);
    // On connect, not on render: the children read the tokens as they mount.
    expect(src).toMatch(/connectedCallback\(\)[\s\S]{0,4000}?applyConfig\(\s*PLATFORM_DARK_CONFIG/);
  });

  it('no dungeon component re-pins a platform colour token by hand', () => {
    const files = import.meta.glob('../src/components/dungeon/**/*.ts', {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>;

    // Sanity: an empty glob would pass vacuously.
    expect(Object.keys(files).length, 'glob matched no dungeon files').toBeGreaterThan(10);

    const offenders: string[] = [];
    for (const [path, src] of Object.entries(files)) {
      if (path.endsWith('DungeonView.ts')) continue; // the one place, and it is TS, not CSS
      for (const line of src.split('\n')) {
        // A declaration of a platform colour token with a literal colour value.
        if (/^\s*--color-[a-z0-9-]+\s*:\s*(#|rgb|hsl)/.test(line)) {
          offenders.push(`${path}: ${line.trim()}`);
        }
      }
    }
    expect(
      offenders,
      `hand-written platform-colour pins found:\n${offenders.join('\n')}\n` +
        'The pin belongs in DungeonView.connectedCallback via PLATFORM_DARK_CONFIG — ' +
        'a second copy has twice been an INCOMPLETE copy.',
    ).toEqual([]);
  });
});
