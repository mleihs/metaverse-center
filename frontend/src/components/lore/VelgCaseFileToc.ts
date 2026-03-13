import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { LoreSection } from '../platform/LoreScroll.js';

/**
 * Table of contents sidebar for the Bureau Case File.
 * Lists classified section titles with approximate word counts.
 */
@localized()
@customElement('velg-case-file-toc')
export class VelgCaseFileToc extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .toc__header {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--color-text-muted);
      padding-bottom: var(--space-2);
      border-bottom: 1px solid var(--color-border);
      margin-bottom: var(--space-2);
    }

    .toc__list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .toc__item {
      display: block;
    }

    .toc__btn {
      display: flex;
      flex-direction: column;
      gap: 2px;
      width: 100%;
      padding: var(--space-1) var(--space-2);
      text-align: left;
      background: transparent;
      border: none;
      border-left: 2px solid transparent;
      cursor: pointer;
      transition: all 0.15s;
    }

    .toc__btn:hover {
      background: color-mix(in srgb, var(--color-accent-amber) 8%, transparent);
      border-left-color: color-mix(in srgb, var(--color-accent-amber) 30%, transparent);
    }

    .toc__btn--active {
      background: color-mix(in srgb, var(--color-accent-amber) 12%, transparent);
      border-left-color: var(--color-accent-amber);
    }

    .toc__btn:focus-visible {
      outline: 2px solid var(--color-accent-amber);
      outline-offset: -2px;
    }

    .toc__arcanum {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--color-accent-amber);
      opacity: 0.7;
    }

    .toc__btn--active .toc__arcanum {
      opacity: 1;
    }

    .toc__title {
      font-family: var(--font-sans);
      font-size: 11px;
      color: var(--color-text-muted);
      line-height: 1.3;
    }

    .toc__btn--active .toc__title {
      color: var(--color-text-primary);
    }

    .toc__words {
      font-family: var(--font-mono, monospace);
      font-size: 9px;
      color: var(--color-text-muted);
      opacity: 0.5;
    }
  `;

  @property({ type: Array }) sections: LoreSection[] = [];
  @property({ type: Number }) activeIndex = 0;

  private _handleSelect(index: number): void {
    this.dispatchEvent(
      new CustomEvent('toc-select', {
        bubbles: true,
        composed: true,
        detail: { index },
      }),
    );
  }

  private _wordCount(text: string): number {
    return text.split(/\s+/).filter(Boolean).length;
  }

  protected render() {
    return html`
      <div class="toc__header">${msg('TABLE OF CONTENTS')}</div>
      <ol class="toc__list">
        ${this.sections.map(
          (section, i) => html`
            <li class="toc__item">
              <button
                class="toc__btn ${i === this.activeIndex ? 'toc__btn--active' : ''}"
                @click=${() => this._handleSelect(i)}
                aria-current=${i === this.activeIndex ? 'true' : 'false'}
              >
                <span class="toc__arcanum">${section.arcanum}</span>
                <span class="toc__title">${section.title}</span>
                <span class="toc__words">~${this._wordCount(section.body)} ${msg('words')}</span>
              </button>
            </li>
          `,
        )}
      </ol>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-case-file-toc': VelgCaseFileToc;
  }
}
