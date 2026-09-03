/**
 * A nested host must be able to take a skin BACK.
 *
 * THE FAILURE THIS GUARDS
 *   DriftView and DungeonView re-assert `PLATFORM_DARK_CONFIG` on their own
 *   host to escape whatever theme sits above them. That works only for tokens
 *   the dark config actually WRITES. A token it leaves unspecified is not the
 *   platform default — it is whatever the enclosing skin last said, arriving by
 *   inheritance.
 *
 *   Before the Atlas skin the gap could not show: `:root` was the only thing
 *   above a host, so "unwritten" and "platform default" were the same value.
 *   With a second global skin on `document.body` they are not. If Atlas writes
 *   `--glow-strength: 0` and the dark config does not write it at all, the
 *   Zwischenraum keeps a glow strength of zero and every CRT bloom in it goes
 *   flat — with no error, no failing test, and no lint gate: the page renders,
 *   it is simply wrong.
 *
 * THE INVARIANT, STATED ONCE
 *   Both skins must write the SAME SET of inline property names. Not the same
 *   values — the values are the whole point — but the same names, because a
 *   name one skin writes and the other omits is exactly a token that cannot be
 *   taken back. Stated this way the test covers keys nobody has added yet: the
 *   day a skin gains a token the other lacks, this turns red naming it.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Same reason as theme-service.test.ts: ThemeService pulls in the Supabase
// client chain through settingsApi, which throws without VITE_SUPABASE_* env.
vi.mock('../src/services/api/index.js', () => ({
  settingsApi: {},
}));

import { PLATFORM_ATLAS_CONFIG, PLATFORM_DARK_CONFIG } from '../src/services/theme-presets.js';
import { themeService } from '../src/services/ThemeService.js';

/** The custom-property names a host carries as inline style. */
function inlineTokens(el: HTMLElement): string[] {
  const names: string[] = [];
  for (let i = 0; i < el.style.length; i++) {
    const name = el.style.item(i);
    if (name.startsWith('--')) names.push(name);
  }
  return names.sort();
}

function themedHost(config: Record<string, string>): HTMLElement {
  const host = document.createElement('div');
  document.body.appendChild(host);
  themeService.applyConfig(config, host);
  return host;
}

describe('the two platform skins are mutually reversible', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    /*
     * applyConfig appends a Google Fonts <link> per family, and happy-dom
     * honours it with a real network request — four of them per skin, to a host
     * that may not be reachable from CI. Swallow the insertion: this test is
     * about tokens, and the font loader has its own coverage.
     */
    vi.spyOn(document.head, 'appendChild').mockImplementation((node) => node);
  });

  it('writes the same set of tokens for both skins', () => {
    const dark = inlineTokens(themedHost(PLATFORM_DARK_CONFIG));
    const atlas = inlineTokens(themedHost(PLATFORM_ATLAS_CONFIG));

    const onlyAtlas = atlas.filter((t) => !dark.includes(t));
    const onlyDark = dark.filter((t) => !atlas.includes(t));

    expect(
      onlyAtlas,
      `Atlas writes these and the dark config does not, so a host re-asserting dark inside an Atlas shell inherits them: ${onlyAtlas.join(', ')}`,
    ).toEqual([]);
    expect(
      onlyDark,
      `the dark config writes these and Atlas does not: ${onlyDark.join(', ')}`,
    ).toEqual([]);
  });

  /*
   * The named cases, spelled out so a failure reads as a symptom and not just
   * as a set difference. Each of these is a value the Atlas skin changes and
   * the Zwischenraum has to be able to change back.
   */
  it.each([
    ['--glow-strength', '1', '0'],
    ['--color-shadow', '#000000', '#17201d'],
    ['--label-transform', 'uppercase', 'uppercase'],
    ['--color-surface-contrast', '#111111', '#24332d'],
    ['--color-text-on-contrast', '#e5e5e5', '#e9ede9'],
  ])('%s is written by both skins (dark %s, atlas %s)', (token, darkValue, atlasValue) => {
    expect(themedHost(PLATFORM_DARK_CONFIG).style.getPropertyValue(token)).toBe(darkValue);
    expect(themedHost(PLATFORM_ATLAS_CONFIG).style.getPropertyValue(token)).toBe(atlasValue);
  });

  it('recasts the whole shadow scale in the dark skin, not only when the ink differs', () => {
    // The pre-Atlas code skipped computeShadows entirely for offset/#000000,
    // which is the default the dark config uses — so the one host that most
    // needs to override an inherited ink was the one that wrote nothing.
    const host = themedHost(PLATFORM_DARK_CONFIG);
    expect(host.style.getPropertyValue('--shadow-md')).toBe('4px 4px 0 #000000');
    expect(host.style.getPropertyValue('--shadow-pressed')).toBe('2px 2px 0 #000000');
  });

  it('casts the Atlas shadow scale in ink', () => {
    const host = themedHost(PLATFORM_ATLAS_CONFIG);
    expect(host.style.getPropertyValue('--shadow-md')).toBe('4px 4px 0 #17201d');
  });

  it('re-asserting dark on a nested host takes back the Atlas values', () => {
    const shell = themedHost(PLATFORM_ATLAS_CONFIG);
    const inner = document.createElement('div');
    shell.appendChild(inner);
    themeService.applyConfig(PLATFORM_DARK_CONFIG, inner);

    expect(inner.style.getPropertyValue('--glow-strength')).toBe('1');
    expect(inner.style.getPropertyValue('--color-shadow')).toBe('#000000');
    expect(inner.style.getPropertyValue('--shadow-md')).toBe('4px 4px 0 #000000');
  });
});
