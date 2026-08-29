/**
 * The shape of a map node, pinned where CSS cannot be.
 *
 * The bug this file exists for is invisible to every gate the repo has, because
 * nothing about it is a type error, a lint violation or a failing assertion —
 * it is a cascade rule:
 *
 *   An SVG presentation attribute is the LOWEST-priority style for its
 *   property. A `transform` in a keyframe therefore does not compose with
 *   `transform="translate(x, y)"`; it replaces it.
 *
 * `@keyframes map-node-reveal` animated `transform` on the group that carries
 * the node's translate, so every newly revealed room was drawn at the SVG
 * origin instead of at its own position — measured in an isolated probe: a
 * group authored at x=250 drew at x=1, CTM e=0 f=0 against a control's
 * e=100 f=100. It survived because the rule sits inside a
 * prefers-reduced-motion query, so it never ran for anyone testing with motion
 * reduced.
 *
 * The repair splits the two jobs: the outer group owns POSITION and SEMANTICS,
 * the inner `.node__body` owns anything CSS may transform. That split is the
 * invariant these tests defend — the next person to add a transform animation
 * here will break a test rather than a map.
 */

import { render } from 'lit';
import { describe, expect, it } from 'vitest';

import { renderMapNode } from '../src/components/dungeon/DungeonMapNode.js';
import type { RoomNodeClient } from '../src/types/dungeon.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function room(overrides: Partial<RoomNodeClient> = {}): RoomNodeClient {
  return {
    index: 4,
    depth: 2,
    room_type: 'treasure',
    connections: [3, 5],
    cleared: false,
    current: false,
    revealed: true,
    ...overrides,
  };
}

/** Render one node into a real SVG element and hand back its root group. */
function mount(overrides: Partial<Parameters<typeof renderMapNode>[0]> = {}): SVGGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  document.body.appendChild(svg);
  render(
    renderMapNode({
      room: room(),
      x: 250,
      y: 80,
      current: false,
      adjacent: true,
      justRevealed: false,
      depthHighlight: false,
      selected: false,
      onClick: () => {},
      onDeselect: () => {},
      ...overrides,
    }),
    svg,
  );
  const node = svg.querySelector('g.node');
  if (!node) throw new Error('node group did not render');
  return node as SVGGElement;
}

describe('map node structure', () => {
  it('keeps the position on the outer group', () => {
    const node = mount({ x: 250, y: 80 });
    expect(node.getAttribute('transform')).toBe('translate(250, 80)');
  });

  it('leaves the inner body free of a transform attribute', () => {
    // THE invariant. The reveal animation transforms .node__body; if this
    // element ever gains a transform attribute, the animation will replace it
    // and the node will jump — exactly the bug, one level down.
    const body = mount().querySelector('g.node__body');
    expect(body).not.toBeNull();
    expect(body?.hasAttribute('transform')).toBe(false);
  });

  it('draws every visual through the body, never beside it', () => {
    const node = mount({ current: true, selected: true, room: room({ cleared: true }) });
    const body = node.querySelector('g.node__body');
    for (const selector of ['.node__ring', '.node__fill', '.node__icon', '.node__beacon']) {
      const el = node.querySelector(selector);
      expect(el, `${selector} missing`).not.toBeNull();
      expect(body?.contains(el as Node), `${selector} outside .node__body`).toBe(true);
    }
  });

  it('keeps the title a direct child of the group that carries the role', () => {
    // The accessible name and the native SVG tooltip both read the FIRST
    // <title> child of the element they describe. Moving it into the body
    // would silently detach it from the role="button"/"img" element.
    const node = mount();
    const title = node.querySelector('title');
    expect(title?.parentElement).toBe(node);
    expect(node.getAttribute('role')).toBe('button');
  });
});

describe('map node selection', () => {
  it('draws four corner brackets only when selected', () => {
    expect(mount({ selected: false }).querySelectorAll('.node__reticle path')).toHaveLength(0);
    expect(mount({ selected: true }).querySelectorAll('.node__reticle path')).toHaveLength(4);
  });

  it('staggers the brackets so they draw in sequence', () => {
    const paths = [...mount({ selected: true }).querySelectorAll('.node__reticle path')];
    expect(paths.map((p) => p.getAttribute('style'))).toEqual([
      '--_bracket: 0',
      '--_bracket: 1',
      '--_bracket: 2',
      '--_bracket: 3',
    ]);
  });

  it('announces selection as well as drawing it', () => {
    // A cue that exists only as geometry reaches nobody using a screen reader,
    // and the reticle is the only thing tying the detail panel to this node.
    expect(mount({ selected: true }).getAttribute('aria-label')).toContain('(selected)');
    expect(mount({ selected: false }).getAttribute('aria-label')).not.toContain('(selected)');
  });

  it('names an unscouted room instead of showing the raw placeholder', () => {
    const node = mount({ room: room({ room_type: '?' }) });
    expect(node.getAttribute('aria-label')).toContain('Unscouted');
    expect(node.querySelector('title')?.textContent).toBe('Unscouted');
  });
});
