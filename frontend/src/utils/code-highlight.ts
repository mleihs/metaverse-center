/**
 * highlight.js integration for the unified chat system.
 *
 * Imports hljs core (no auto-detection bundle) + 7 pre-registered languages
 * covering the platform's primary use cases (game logic, API, config, ops).
 *
 * Theme CSS is loaded via Vite's `?raw` suffix and exposed as a shared
 * `CSSStyleSheet` for `adoptedStyleSheets` injection into Shadow DOM roots.
 * This avoids <style> duplication across ChatBubble instances.
 *
 * Usage in a LitElement:
 *   connectedCallback() {
 *     super.connectedCallback();
 *     this.shadowRoot!.adoptedStyleSheets = [
 *       ...this.shadowRoot!.adoptedStyleSheets,
 *       hljsStyleSheet,
 *     ];
 *   }
 */

import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import python from 'highlight.js/lib/languages/python';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';

import hljsThemeCSS from './hljs-dark-theme.css?raw';

// ── Language registration (alphabetical) ────────────────────────────────────

hljs.registerLanguage('bash', bash);
hljs.registerLanguage('css', css);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript); // alias
hljs.registerLanguage('json', json);
hljs.registerLanguage('python', python);
hljs.registerLanguage('py', python); // alias
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript); // alias

// ── Shared CSSStyleSheet for Shadow DOM adoption ────────────────────────────

export const hljsStyleSheet = new CSSStyleSheet();
hljsStyleSheet.replaceSync(hljsThemeCSS);

export { hljs };
