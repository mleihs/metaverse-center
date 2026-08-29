/**
 * What the two markdown renderers emit — pinned, because nothing else did.
 *
 * `src/utils/markdown.ts` renders every assistant chat message and every piece
 * of lore prose in the product, and it had no test at all. That gap stays quiet
 * until a dependency moves: `marked` went 17 -> 18 in this window, the
 * type-checker was happy, the production build succeeded, and all 1000 tests
 * stayed green — not one of them touched this file.
 *
 * Three things here are load-bearing and all three sit at a seam a major
 * version can move, silently:
 *
 *   1. The custom `code` renderer, registered against marked's renderer API.
 *      A changed signature does not throw — it just stops producing the
 *      code-block wrapper the chat CSS is written against.
 *   2. The walkTokens LIFO ordering. `_rawCode` is stashed by a hook registered
 *      AFTER markedHighlight precisely so it runs BEFORE it. That is the only
 *      reason the copy button holds source instead of highlighted markup.
 *   3. GFM output shape (tables, lists, `breaks: true`).
 *
 * ── Why DOMPurify is stubbed out here ──────────────────────────────────────
 *
 * DOMPurify does not work under happy-dom, which is this suite's environment.
 * Measured 2026-08-29 with dompurify 3.4.12, and identical under happy-dom
 * 20.8.9 and 20.12.0 — so it is not a regression, it is a standing property:
 *
 *     DOMPurify.isSupported                                   -> true
 *     sanitize('<h2>x</h2><script>alert(1)</script>')         -> 'x<script>alert(1)</script>'
 *
 * Exactly inverted: the ALLOWED tag is dropped, the forbidden one survives.
 * The consequence matters more than the cause — **an XSS assertion written in
 * this suite proves nothing**, in either direction. A green one is a false
 * green. So this file does not make any, and stubs the sanitiser to identity
 * so that what it does assert is honestly attributable to `marked`.
 *
 * The sanitiser boundary itself is static config (PURIFY_CONFIG /
 * CHAT_PURIFY_CONFIG) that does not move when marked moves; covering it needs
 * a real DOM (jsdom or the Playwright suite), which is a separate piece of work.
 */

import { render } from 'lit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('dompurify', () => ({
  default: { sanitize: (html: string) => html },
}));

const { renderChatMarkdown, renderSafeMarkdown } = await import('../src/utils/markdown.js');

let host: HTMLElement;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
});

function basic(md: string): string {
  render(renderSafeMarkdown(md), host);
  return host.innerHTML;
}

function chat(md: string): string {
  render(renderChatMarkdown(md), host);
  return host.innerHTML;
}

describe('renderSafeMarkdown', () => {
  it('renders the GFM constructs the prose actually uses', () => {
    const html = basic(
      '## Heading\n\nA **bold** and *italic* line with a [link](https://example.org).\n\n' +
        '- one\n- two\n\n> quoted\n\n| a | b |\n| - | - |\n| 1 | 2 |\n',
    );

    expect(html).toContain('<h2>Heading</h2>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
    expect(html).toContain('href="https://example.org"');
    expect(html).toContain('<li>one</li>');
    expect(html).toContain('<blockquote>');
    expect(html).toContain('<td>1</td>');
  });

  it('honours breaks: true — a single newline becomes a line break', () => {
    expect(basic('one\ntwo')).toContain('<br>');
  });

  it('renders an inline code span', () => {
    expect(basic('use `npm ci` first')).toContain('<code>npm ci</code>');
  });
});

describe('renderChatMarkdown', () => {
  it('wraps a fenced block in the code-block shell the chat CSS styles', () => {
    const html = chat('```ts\nconst a = 1;\n```');

    expect(html).toContain('<div class="code-block">');
    expect(html).toContain('class="code-block__header"');
    expect(html).toContain('class="code-block__lang"');
    expect(html).toContain('class="code-block__copy"');
    expect(html).toContain('<pre><code class="hljs">');
  });

  it('labels the block with its language', () => {
    expect(chat('```python\nx = 1\n```')).toContain('>python</span>');
  });

  it('syntax-highlights via hljs span tokens', () => {
    // The exact class set is hljs's business; that spans survive at all is ours.
    expect(chat('```ts\nconst a = 1;\n```')).toMatch(/<span class="hljs-[a-z-]+">/);
  });

  it('gives the copy button the RAW source, not the highlighted markup', () => {
    const html = chat('```ts\nconst a = 1;\n```');
    const match = html.match(/data-code="([^"]*)"/);

    expect(match).not.toBeNull();
    const decoded = decodeURIComponent(match?.[1] ?? '');
    expect(decoded.trim()).toBe('const a = 1;');
    expect(decoded).not.toContain('<span');
  });

  it('survives a fence with no language', () => {
    const html = chat('```\nplain text\n```');

    expect(html).toContain('<div class="code-block">');
    expect(html).toContain('<span class="code-block__lang"></span>');
    // No lang means hljs.highlightAuto, which may wrap parts of the text in
    // spans of its own — so assert on the copy button's raw payload, which is
    // the one place the source has to survive verbatim.
    expect(html).toContain('data-code="plain%20text"');
  });

  it('keeps a hostile language string out of the attribute value', () => {
    // safeLang strips < > " & — so the string can never close the attribute or
    // open a tag. It lands as inert text in the label. This is the renderer's
    // own guard and is testable without a working sanitiser.
    const html = chat('```ts"><img src=x onerror=alert(1)>\nx\n```');

    expect(html).not.toContain('<img');
    expect(html).toContain('data-code="x"');
    expect(html).toMatch(/<span class="code-block__lang">[^<>"]*<\/span>/);
  });

  it('still renders ordinary prose alongside code', () => {
    const html = chat('Some **prose**.\n\n```js\n1\n```\n\nMore prose.');

    expect(html).toContain('<strong>prose</strong>');
    expect(html).toContain('<div class="code-block">');
    expect(html).toContain('More prose.');
  });
});
