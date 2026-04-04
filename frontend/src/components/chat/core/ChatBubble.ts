/**
 * ChatBubble — Message content rendering for the unified chat system.
 *
 * Innermost visual element — handles ONLY the content surface:
 *   - User messages: plain text (white-space: pre-wrap) on primary bg
 *   - Assistant messages: renderChatMarkdown() with highlight.js syntax coloring
 *   - Agent accent color as 3px left border (oklch via CSS custom prop)
 *   - Streaming: re-rendered content + blinking cursor pseudo-element
 *   - Code blocks: language header + copy-to-clipboard + syntax highlighting
 *   - Blockquotes, tables, lists, strikethrough — full GFM support
 *
 * highlight.js theme injected via adoptedStyleSheets (shared CSSStyleSheet,
 * zero duplication across instances). Copy button uses delegated click handler.
 *
 * Zero border-radius (brutalist). No avatar, timestamp, or sender label
 * (those live in the ChatMessage parent).
 */

import { msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';

import { hljsStyleSheet } from '../../../utils/code-highlight.js';
import { renderChatMarkdown } from '../../../utils/markdown.js';

@customElement('velg-chat-bubble')
export class ChatBubble extends LitElement {
  static styles = css`
    :host {
      display: block;
      max-width: 100%;
      --_bubble-user-bg: var(--color-primary);
      --_bubble-agent-bg: var(--color-surface-raised);
      --_bubble-system-bg: transparent;
      --_bubble-border-width: 3px;
    }

    /* --- Base bubble surface --- */
    .bubble {
      padding: var(--space-3) var(--space-4);
      font-family: var(--font-body);
      font-size: var(--text-sm);
      line-height: var(--leading-normal);
      word-break: break-word;
      overflow-wrap: break-word;
      min-width: 0;
      position: relative;
    }

    /* --- User bubble --- */
    .bubble--user {
      background: var(--_bubble-user-bg);
      color: var(--color-text-inverse);
      border: var(--border-default);
      border-right: var(--_bubble-border-width) solid var(--color-primary);
      border-radius: 2px;
      white-space: pre-wrap;
    }

    /* --- Assistant bubble --- */
    .bubble--assistant {
      background: var(--_bubble-agent-bg);
      color: var(--color-text-primary);
      border: var(--border-medium);
      border-left: var(--_bubble-border-width) solid var(--_accent, var(--color-border));
      box-shadow: var(--shadow-xs);
    }

    /* Plain text in assistant bubble (epoch player messages) */
    .bubble--assistant.bubble--plain {
      white-space: pre-wrap;
    }

    /* --- System bubble (centered, muted) --- */
    .bubble--system {
      background: transparent;
      color: var(--color-text-muted);
      border: none;
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      text-align: center;
      padding: var(--space-2) var(--space-4);
    }

    /* --- Streaming cursor --- */
    .bubble--streaming::after {
      content: '';
      display: inline-block;
      width: 2px;
      height: 1.1em;
      background: currentColor;
      vertical-align: text-bottom;
      margin-left: 2px;
      animation: cursor-blink 800ms steps(1) infinite;
    }

    @keyframes cursor-blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }

    @media (prefers-reduced-motion: reduce) {
      .bubble--streaming::after {
        animation: none;
        opacity: 0.7;
      }
    }

    /* ─────────────────────────────────────────────────────────────────
     * Markdown content styles (assistant messages)
     * ────────────────────────────────────────────────────────────── */

    .bubble--assistant p {
      margin: 0 0 0.5em;
    }

    .bubble--assistant p:last-child {
      margin-bottom: 0;
    }

    .bubble--assistant strong {
      font-weight: var(--font-bold);
    }

    .bubble--assistant em {
      font-style: italic;
      display: inline-block;
      padding: var(--space-0-5) var(--space-2);
      margin: var(--space-1) 0;
      background: color-mix(in srgb, var(--_accent, var(--color-border)) 8%, transparent);
      border-left: 2px solid color-mix(in srgb, var(--_accent, var(--color-border)) 40%, transparent);
      font-size: 0.92em;
      color: var(--color-text-secondary);
    }

    .bubble--assistant del {
      text-decoration: line-through;
      opacity: 0.7;
    }

    /* Blockquote — accent bar */
    .bubble--assistant blockquote {
      border-left: 3px solid var(--_accent, var(--color-primary));
      padding-left: var(--space-3);
      margin: var(--space-2) 0;
      color: var(--color-text-secondary);
      font-style: italic;
    }

    /* Inline code */
    .bubble--assistant code {
      background: var(--color-surface-sunken);
      padding: 0.15em 0.4em;
      font-family: var(--font-mono);
      font-size: 0.88em;
      color: var(--color-text-primary);
    }

    /* Code blocks (pre > code) */
    .bubble--assistant pre {
      background: var(--color-surface-sunken);
      padding: var(--space-3);
      margin: var(--space-2) 0;
      overflow-x: auto;
      border: var(--border-default);
    }

    .bubble--assistant pre code {
      background: none;
      padding: 0;
      font-size: 0.85em;
      line-height: 1.5;
    }

    /* Lists */
    .bubble--assistant ul,
    .bubble--assistant ol {
      margin: var(--space-2) 0;
      padding-left: var(--space-5);
    }

    .bubble--assistant li {
      margin-bottom: var(--space-1);
    }

    .bubble--assistant li:last-child {
      margin-bottom: 0;
    }

    /* Links */
    .bubble--assistant a {
      color: var(--color-primary);
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    .bubble--assistant a:hover {
      color: var(--color-primary-hover, var(--color-primary));
    }

    /* Headings inside messages (rare but possible) */
    .bubble--assistant h2,
    .bubble--assistant h3,
    .bubble--assistant h4 {
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      margin: var(--space-3) 0 var(--space-2);
    }

    .bubble--assistant h2 { font-size: var(--text-base); }
    .bubble--assistant h3 { font-size: var(--text-sm); }
    .bubble--assistant h4 { font-size: var(--text-xs); }

    /* Horizontal rule */
    .bubble--assistant hr {
      border: none;
      border-top: var(--border-width-thin) solid var(--color-border-light);
      margin: var(--space-3) 0;
    }

    /* ─────────────────────────────────────────────────────────────────
     * Code block wrapper (language header + copy button + highlighted code)
     * .code-block is generated by renderChatMarkdown() — only inside
     * .bubble--assistant. These rules share specificity (0,1,1) with
     * .bubble--assistant pre above but win via cascade order.
     * ────────────────────────────────────────────────────────────── */

    .code-block {
      margin: var(--space-2) 0;
      border: var(--border-light);
      overflow: hidden;
    }

    .code-block__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--space-1) var(--space-3);
      background: var(--color-surface-sunken);
      border-bottom: var(--border-light);
    }

    .code-block__lang {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .code-block__copy {
      all: unset;
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      cursor: pointer;
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      padding: var(--space-1) var(--space-2);
      transition: color var(--transition-fast);
    }

    .code-block__copy:hover {
      color: var(--color-primary);
    }

    .code-block__copy:focus-visible {
      outline: none;
      box-shadow: var(--ring-focus);
    }

    .code-block pre {
      margin: 0;
      padding: var(--space-3);
      overflow-x: auto;
      background: var(--color-surface-sunken);
      border: none;
    }

    .code-block pre code {
      background: none;
      padding: 0;
      font-family: var(--font-mono);
      font-size: 0.85em;
      line-height: 1.5;
    }

    /* ─────────────────────────────────────────────────────────────────
     * Tables (GFM)
     * ────────────────────────────────────────────────────────────── */

    .bubble--assistant table {
      border-collapse: collapse;
      width: 100%;
      margin: var(--space-2) 0;
    }

    .bubble--assistant th,
    .bubble--assistant td {
      padding: var(--space-1) var(--space-2);
      border: var(--border-light);
      text-align: left;
    }

    .bubble--assistant th {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      background: var(--color-surface-sunken);
    }

    /* --- Responsive --- */
    @media (max-width: 640px) {
      .bubble {
        padding: var(--space-2-5) var(--space-3);
        font-size: var(--text-base);
      }
    }
  `;

  // --- Properties ---

  @property({ type: String }) content = '';
  @property({ type: String }) senderRole: 'user' | 'assistant' | 'system' = 'user';
  @property({ type: String }) accentColor = '';
  @property({ type: Boolean }) streaming = false;
  /** Render content as plain text regardless of senderRole (e.g. epoch player messages). */
  @property({ type: Boolean }) plainText = false;

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  override connectedCallback(): void {
    super.connectedCallback();
    // Adopt the shared highlight.js stylesheet into this shadow root.
    // Using adoptedStyleSheets avoids <style> duplication across instances.
    const root = this.shadowRoot!;
    if (!root.adoptedStyleSheets.includes(hljsStyleSheet)) {
      root.adoptedStyleSheets = [...root.adoptedStyleSheets, hljsStyleSheet];
    }
  }

  override firstUpdated(): void {
    // Delegated click handler for code block copy-to-clipboard buttons.
    // A single listener on the shadow root handles all copy buttons — no
    // per-button binding needed, works with dynamically rendered content.
    this.shadowRoot!.addEventListener('click', (e: Event) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.code-block__copy');
      if (!btn) return;
      const code = decodeURIComponent(btn.getAttribute('data-code') ?? '');
      if (!code) return;

      // Clear any pending timeout from a previous click (prevents the
      // double-click bug where "Copied!" would stick permanently).
      type CopyBtn = HTMLButtonElement & { __copyTimer?: ReturnType<typeof setTimeout> };
      const copyBtn = btn as CopyBtn;
      if (copyBtn.__copyTimer) clearTimeout(copyBtn.__copyTimer);

      navigator.clipboard.writeText(code).then(() => {
        copyBtn.textContent = msg('Copied!');
        copyBtn.__copyTimer = setTimeout(() => {
          copyBtn.textContent = msg('Copy');
        }, 2000);
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  protected render() {
    const classes = {
      bubble: true,
      [`bubble--${this.senderRole}`]: true,
      'bubble--streaming': this.streaming,
      'bubble--plain': this.plainText,
    };

    const styles = this.accentColor
      ? { '--_accent': this.accentColor } as Record<string, string>
      : {};

    // No whitespace between div tags and content — white-space: pre-wrap
    // on .bubble--user renders template newlines as visible vertical space.
    return html`<div class=${classMap(classes)} style=${styleMap(styles)}>${this._renderContent()}</div>`;
  }

  /** Strip leaked [AgentName]: prefixes from group chat responses. */
  private _stripAgentTags(text: string): string {
    return text.replace(/\[[\w\s.äöüÄÖÜß]+\]:\s*/g, '');
  }

  private _renderContent() {
    if (!this.content) return '';

    // Plain text override (e.g. epoch player messages mapped as 'assistant')
    if (this.plainText) return this.content;

    // User messages: plain text, no markdown processing
    if (this.senderRole === 'user') {
      return this.content;
    }

    // System messages: plain text, mono font (handled via CSS)
    if (this.senderRole === 'system') {
      return this.content;
    }

    // Assistant messages: strip agent name tags, then full markdown rendering
    const cleaned = this._stripAgentTags(this.content);
    return renderChatMarkdown(cleaned);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-chat-bubble': ChatBubble;
  }
}
