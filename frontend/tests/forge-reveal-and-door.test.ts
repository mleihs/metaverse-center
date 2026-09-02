/**
 * Three defects the Forge reveal work closed, bound to their fix.
 *
 * 1. The door. `.ceremony__enter` sits at `opacity: 0`, and for the whole life
 *    of the component the ONLY rule that lifted it was `--ready` — a class set
 *    in exactly one place, `_pollProgress`, on `progress.done && _stage >= 5`.
 *    The comment on the markup claimed the opposite ("the Shard exists the
 *    moment it ignites, so the button opens it"), and nothing measured the
 *    claim. In practice the button was invisible-but-clickable for the three
 *    to five minutes the portraits take, and invisible for good whenever the
 *    poll never returned a done payload (an empty slug, a failing endpoint).
 *    A stage rule has to open it; `--ready` may only decorate.
 *
 * 2. The turn. The anchor fan is dealt face down and turned over one card at a
 *    time. A flip that is only a rotation is a card whose front and back are
 *    printed on top of each other: both faces need `backface-visibility`, the
 *    back needs its own 180-degree rotation, and `preserve-3d` has to sit on
 *    the fan card as well as on the flipper, because the card already carries
 *    the fan's own transform and a transformed element flattens its children.
 *
 * 3. A back is not a choice. While a card is face down its title cannot be
 *    read, so neither the pointer nor the keyboard may select it.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf-8');

const CEREMONY = read('src/components/forge/VelgForgeCeremony.ts');
const ASTROLABE = read('src/components/forge/VelgForgeAstrolabe.ts');
const GAME_CARD = read('src/components/shared/VelgGameCard.ts');

describe('the door opens when the Shard exists, not when the last image lands', () => {
  it('a stage rule carries the entrance animation', () => {
    expect(CEREMONY).toMatch(
      /\.ceremony--stage-5 \.ceremony__enter \{\s*animation: btn-entrance/,
    );
  });

  it('--ready no longer gates visibility', () => {
    // It may still decorate the button (beacon, shimmer, ring) — it may not be
    // the only thing that makes the block visible.
    const gatesVisibility = /\.ceremony__enter--ready \{[^}]*animation: btn-entrance/.test(
      CEREMONY,
    );
    expect(gatesVisibility).toBe(false);
  });

  it('the reduced-motion override follows the same selector', () => {
    expect(CEREMONY).toMatch(
      /\.ceremony--stage-5 \.ceremony__enter \{\s*animation: none;\s*opacity: 1;/,
    );
  });
});

describe('the anchor fan is turned over, not cross-faded', () => {
  it('both faces hide their back side', () => {
    expect(ASTROLABE).toMatch(
      /\.anchor-fan__flipper > \.dossier \{[^}]*backface-visibility: hidden/,
    );
    expect(ASTROLABE).toMatch(/\.anchor-back \{[^}]*backface-visibility: hidden/);
  });

  it('the back carries its own half-turn', () => {
    expect(ASTROLABE).toMatch(/\.anchor-back \{[^}]*transform: rotateY\(180deg\)/);
  });

  it('preserve-3d sits on the card as well as on the flipper', () => {
    expect(ASTROLABE).toMatch(/\.anchor-fan__card \{\s*transform-style: preserve-3d;/);
    expect(ASTROLABE).toMatch(/\.anchor-fan__flipper \{[^}]*transform-style: preserve-3d/);
  });

  it('reduced motion gets the fan face up without a rotation', () => {
    const block = ASTROLABE.slice(ASTROLABE.lastIndexOf('@media (prefers-reduced-motion'));
    expect(block).toContain('.anchor-fan__flipper');
    expect(block).toMatch(/\.anchor-back \{\s*display: none;/);
    expect(
      ASTROLABE.includes(
        "if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {\n      this._revealedCount = count;",
      ),
    ).toBe(true);
  });
});

describe('a face-down reading cannot be chosen', () => {
  it('the click handler is gated on the card being face up', () => {
    expect(ASTROLABE).toMatch(/@click=\$\{\(\) => \{\s*if \(faceUp\) this\._selectAnchor\(i\);/);
  });

  it('the keyboard handler returns before Enter and Space are read', () => {
    expect(ASTROLABE).toMatch(/@keydown=\$\{\(e: KeyboardEvent\) => \{\s*if \(!faceUp\) return;/);
  });

  it('a face-down card is out of the tab order and out of hit testing', () => {
    expect(ASTROLABE).toMatch(/tabindex=\$\{faceUp \? '0' : '-1'\}/);
    expect(ASTROLABE).toMatch(/\.anchor-fan__card--facedown \{\s*pointer-events: none;/);
  });
});

describe('the ignition fan reads as two groups before a nameplate is read', () => {
  it('each fan card carries its faction', () => {
    expect(CEREMONY).toMatch(/\.ceremony__card--agent\s+\{ --_faction: var\(--color-success\); \}/);
    expect(CEREMONY).toMatch(
      /\.ceremony__card--building \{ --_faction: var\(--color-accent-amber\); \}/,
    );
    expect(CEREMONY).toContain('ceremony__card ceremony__card--${c.kind}');
  });

  it('the crest inside the card follows the faction, the frame does not', () => {
    // The world's own frame stays the world's. Only the crest is repainted.
    expect(CEREMONY).toMatch(/--card-crest-color: var\(--_faction\)/);
    expect(CEREMONY).not.toContain('--card-frame-primary: var(--_faction)');
    expect(GAME_CARD).toMatch(
      /--_crest: var\(--card-crest-color, var\(--card-frame-primary\)\)/,
    );
  });

  it('the crest is opt-in, so every existing call site keeps its glyph', () => {
    expect(GAME_CARD).toMatch(/@property\(\) sigil = '';/);
    expect(GAME_CARD).toMatch(/: this\.sigil\s*\?\s*html`<div class="card__art-placeholder card__art-placeholder--crest"/);
  });

  it('the file number is per fan, so it matches the count printed under it', () => {
    expect(CEREMONY).toContain(
      "const fileNo = `${c.kind === 'agent' ? 'OP' : 'BLD'}-${String(i + 1).padStart(2, '0')}`;",
    );
  });
});

describe('the materialization bar counts images, not seconds', () => {
  it('its width comes from the progress payload', () => {
    expect(CEREMONY).toMatch(
      /width: \$\{this\._progress\.total > 0 \? \(this\._progress\.completed \/ this\._progress\.total\) \* 100 : 0\}%/,
    );
  });

  it('it stays gated on the phase it measures', () => {
    expect(CEREMONY).toContain('this._progress && this._imagePhaseStarted()');
  });
});
