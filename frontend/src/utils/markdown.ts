/**
 * Safe markdown rendering with DOMPurify sanitization.
 *
 * Two rendering modes:
 *   - `renderSafeMarkdown()` — basic GFM rendering (no syntax highlighting)
 *   - `renderChatMarkdown()` — extended chat rendering with highlight.js
 *     syntax highlighting, code block headers (language label + copy button),
 *     and `<span>` tags for hljs class tokens
 *
 * Replaces the regex-based _renderMarkdown() pattern that was structurally
 * fragile (audit finding, March 2026). Uses `marked` for parsing and
 * `DOMPurify` for XSS prevention.
 */

import { msg } from '@lit/localize';
import DOMPurify from 'dompurify';
import type { DirectiveResult } from 'lit/directive.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { Marked, type Tokens } from 'marked';
import { markedHighlight } from 'marked-highlight';

import { hljs } from './code-highlight.js';

// ── Shared marked options ───────────────────────────────────────────────────

const MARKED_OPTIONS = { breaks: true, gfm: true } as const;

// ── Basic marked instance (no syntax highlighting) ──────────────────────────

const basicMarked = new Marked(MARKED_OPTIONS);

// ── Chat marked instance (syntax highlighting + code block wrapper) ─────────

// Token type extension: _rawCode is set by walkTokens before highlight processing
interface CodeTokenExt extends Tokens.Code {
  _rawCode?: string;
}

const chatMarked = new Marked(
  MARKED_OPTIONS,

  // markedHighlight: walkTokens overwrites token.text with highlighted HTML
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code: string, lang: string) {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    },
  }),

  // Registered AFTER markedHighlight → executes BEFORE it (LIFO walkTokens).
  // Saves the original unprocessed code for the copy-to-clipboard button.
  {
    walkTokens(token) {
      if (token.type === 'code') {
        (token as CodeTokenExt)._rawCode = token.text;
      }
    },
  },
);

// Custom code renderer: wraps highlighted code in a block with lang label + copy button.
// The data-code attribute holds URI-encoded raw code for clipboard copy.
chatMarked.use({
  renderer: {
    code(token: Tokens.Code) {
      const ext = token as CodeTokenExt;
      const rawCode = ext._rawCode ?? token.text;
      const lang = token.lang ?? '';
      // Sanitize lang for safe HTML attribute embedding
      const safeLang = lang.replace(/[<>"&]/g, '');

      return (
        `<div class="code-block">` +
        `<div class="code-block__header">` +
        `<span class="code-block__lang">${safeLang}</span>` +
        `<button class="code-block__copy" data-code="${encodeURIComponent(rawCode)}" type="button">` +
        `${msg('Copy')}` +
        `</button>` +
        `</div>` +
        `<pre><code class="hljs">${token.text}</code></pre>` +
        `</div>`
      );
    },
  },
});

// ── DOMPurify configurations ────────────────────────────────────────────────

// Basic: no span tags needed (no hljs output)
const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'h2',
    'h3',
    'h4',
    'p',
    'br',
    'strong',
    'em',
    'del',
    'ul',
    'ol',
    'li',
    'a',
    'blockquote',
    'pre',
    'code',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'hr',
  ],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
  RETURN_DOM_FRAGMENT: false,
  RETURN_DOM: false,
};

// Chat: adds span (hljs tokens), div/button (code block wrapper), data-code attr
const CHAT_PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'h2',
    'h3',
    'h4',
    'p',
    'br',
    'strong',
    'em',
    'del',
    'ul',
    'ol',
    'li',
    'a',
    'blockquote',
    'pre',
    'code',
    'span',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'div',
    'button',
    'hr',
  ],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'data-code', 'type'],
  RETURN_DOM_FRAGMENT: false,
  RETURN_DOM: false,
};

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Render a markdown string to a sanitized Lit template result.
 *
 * Basic GFM rendering without syntax highlighting. Safe for use with
 * `unsafeHTML` because DOMPurify strips all dangerous elements.
 */
export function renderSafeMarkdown(text: string): DirectiveResult {
  const rawHtml = basicMarked.parse(text, { async: false }) as string;
  const cleanHtml = DOMPurify.sanitize(rawHtml, PURIFY_CONFIG) as string;
  return unsafeHTML(cleanHtml);
}

/**
 * Render a markdown string with syntax highlighting and code block UI.
 *
 * Chat-specific: highlight.js syntax coloring, code block header with
 * language label and copy-to-clipboard button. Used by ChatBubble for
 * assistant messages.
 */
export function renderChatMarkdown(text: string): DirectiveResult {
  const rawHtml = chatMarked.parse(text, { async: false }) as string;
  const cleanHtml = DOMPurify.sanitize(rawHtml, CHAT_PURIFY_CONFIG) as string;
  return unsafeHTML(cleanHtml);
}
