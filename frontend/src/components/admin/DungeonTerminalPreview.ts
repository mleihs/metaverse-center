/**
 * Terminal preview — renders dungeon text as it appears in the game terminal.
 *
 * Amber monospace on dark surface, scanline overlay, left accent bar.
 * Supports {agent} template placeholder highlighting.
 */

import { msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('velg-terminal-preview')
export class VelgTerminalPreview extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .preview {
      position: relative;
      padding: var(--space-4);
      background: var(--color-surface-sunken, #0a0a0a);
      border-left: 2px solid var(--color-accent-amber, #f59e0b);
      overflow: hidden;
    }

    .preview__scanlines {
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(255 255 255 / 0.012) 2px,
        rgba(255 255 255 / 0.012) 4px
      );
      pointer-events: none;
    }

    .preview__label {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-family: var(--font-brutalist);
      font-size: 9px;
      font-weight: var(--font-bold, 700);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: color-mix(in srgb, var(--color-accent-amber, #f59e0b) 60%, transparent);
      margin-bottom: var(--space-2);
    }

    .preview__label-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--color-accent-amber, #f59e0b);
      animation: preview-pulse 2s ease-in-out infinite;
    }

    .preview__text {
      position: relative;
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: var(--text-sm, 13px);
      line-height: 1.7;
      color: var(--color-accent-amber, #f59e0b);
      white-space: pre-wrap;
      word-break: break-word;
    }

    .preview__empty {
      font-family: var(--font-mono, monospace);
      font-size: var(--text-xs, 11px);
      color: var(--color-text-muted, #666);
      font-style: italic;
    }

    /* Template variable highlighting */
    .tpl-var {
      color: var(--color-info, #60a5fa);
      font-weight: var(--font-bold, 700);
    }

    @keyframes preview-pulse {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 1; }
    }

    @media (prefers-reduced-motion: reduce) {
      .preview__label-dot {
        animation: none;
        opacity: 0.7;
      }
    }
  `;

  @property() text = '';
  @property() label = 'TERMINAL PREVIEW';

  protected render() {
    return html`
      <div class="preview">
        <div class="preview__scanlines"></div>
        <div class="preview__label">
          <span class="preview__label-dot"></span>
          ${this.label}
        </div>
        ${
          this.text
            ? html`<div class="preview__text">${this._renderHighlighted()}</div>`
            : html`<div class="preview__empty">${msg('No text to preview')}</div>`
        }
      </div>
    `;
  }

  private _renderHighlighted() {
    // Highlight {agent} and other template variables
    const parts = this.text.split(/(\{[^}]+\})/g);
    return parts.map((part) =>
      part.startsWith('{') && part.endsWith('}')
        ? html`<span class="tpl-var">${part}</span>`
        : part,
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-terminal-preview': VelgTerminalPreview;
  }
}
