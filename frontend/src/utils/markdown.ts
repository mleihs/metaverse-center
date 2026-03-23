/**
 * Safe markdown rendering with DOMPurify sanitization.
 *
 * Replaces the regex-based _renderMarkdown() pattern that was structurally
 * fragile (audit finding, March 2026). Uses `marked` for parsing and
 * `DOMPurify` for XSS prevention.
 */

import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import type { DirectiveResult } from 'lit/directive.js';

// Configure marked for safe defaults
marked.setOptions({
  breaks: true,
  gfm: true,
});

// DOMPurify: allow only safe HTML elements
const PURIFY_CONFIG = {
  ALLOWED_TAGS: ['h2', 'h3', 'h4', 'p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'blockquote'],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
  RETURN_DOM_FRAGMENT: false,
  RETURN_DOM: false,
};

/**
 * Render a markdown string to a sanitized Lit template result.
 *
 * Safe for use with `unsafeHTML` because DOMPurify strips all
 * dangerous elements and attributes before rendering.
 */
export function renderSafeMarkdown(text: string): DirectiveResult {
  const rawHtml = marked.parse(text, { async: false }) as string;
  const cleanHtml = DOMPurify.sanitize(rawHtml, PURIFY_CONFIG) as string;
  return unsafeHTML(cleanHtml);
}
