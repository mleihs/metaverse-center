/**
 * ChatBubble — Message content rendering for the unified chat system.
 *
 * Innermost visual element — handles ONLY the content surface:
 *   - User messages: plain text (white-space: pre-wrap) on primary bg
 *   - Assistant messages: rendered via renderSafeMarkdown() on surface-raised bg
 *   - Agent accent color as 3px left border (oklch via CSS custom prop)
 *   - Streaming: re-rendered content + blinking cursor pseudo-element
 *   - Code blocks: monospace, surface-sunken bg (copy button in Phase 2)
 *   - Blockquotes, tables, lists, strikethrough — full GFM support
 *
 * Zero border-radius (brutalist). No avatar, timestamp, or sender label
 * (those live in the ChatMessage parent).
 */

import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';

import { renderSafeMarkdown } from '../../../utils/markdown.js';

@customElement('velg-chat-bubble')
export class ChatBubble extends LitElement {
  static styles = css`
    :host {
      display: block;
      max-width: 100%;
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
      background: var(--color-primary);
      color: var(--color-text-inverse);
      border: var(--border-default);
      border-right: 3px solid var(--color-primary);
      white-space: pre-wrap;
    }

    /* --- Assistant bubble --- */
    .bubble--assistant {
      background: var(--color-surface-raised);
      color: var(--color-text-primary);
      border: var(--border-medium);
      border-left: 3px solid var(--_accent, var(--color-border));
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

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  protected render() {
    const classes = {
      bubble: true,
      [`bubble--${this.senderRole}`]: true,
      'bubble--streaming': this.streaming,
    };

    const styles = this.accentColor
      ? { '--_accent': this.accentColor } as Record<string, string>
      : {};

    return html`
      <div class=${classMap(classes)} style=${styleMap(styles)}>
        ${this._renderContent()}
      </div>
    `;
  }

  private _renderContent() {
    if (!this.content) return '';

    // User messages: plain text, no markdown processing
    if (this.senderRole === 'user') {
      return this.content;
    }

    // System messages: plain text, mono font (handled via CSS)
    if (this.senderRole === 'system') {
      return this.content;
    }

    // Assistant messages: full markdown rendering
    return renderSafeMarkdown(this.content);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-chat-bubble': ChatBubble;
  }
}
