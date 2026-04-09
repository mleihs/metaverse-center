/**
 * VelgBroadsheetArticle — Column article card.
 *
 * Renders a single article within the multi-column flow: headline, excerpt,
 * source badge, and category indicator. Uses `break-inside: avoid` to prevent
 * awkward column breaks. Reuses dispatchStyles for consistent article treatment.
 *
 * @element velg-broadsheet-article
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { dispatchStyles } from '../shared/dispatch-styles.js';
import type { BroadsheetArticle } from '../../types/index.js';
import { t } from '../../utils/locale-fields.js';

@localized()
@customElement('velg-broadsheet-article')
export class VelgBroadsheetArticleEl extends LitElement {
  static styles = [
    dispatchStyles,
    css`
      :host {
        display: block;
        break-inside: avoid;
        margin-bottom: var(--space-6);
      }

      .article {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        padding-bottom: var(--space-5);
        border-bottom: 1px solid var(--color-separator);
      }

      .article__source-tag {
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        color: var(--color-text-muted);
        display: flex;
        align-items: center;
        gap: var(--space-1-5);
      }

      .article__source-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .article__source-dot--event { background: var(--color-danger); }
      .article__source-dot--resonance { background: var(--color-epoch-influence); }
      .article__source-dot--activity { background: var(--color-info); }
      .article__source-dot--gazette { background: var(--color-success); }

      .article__headline {
        font-family: var(--font-bureau, var(--font-prose));
        font-size: clamp(1rem, 2vw, 1.3rem);
        font-weight: var(--font-bold);
        line-height: 1.35;
        color: var(--color-text-primary);
        text-wrap: balance;
        margin: 0;
      }

      .article__excerpt {
        font-family: var(--font-bureau, var(--font-prose));
        font-size: var(--text-sm);
        line-height: 1.7;
        color: var(--color-text-secondary);
        display: -webkit-box;
        -webkit-line-clamp: 4;
        -webkit-box-orient: vertical;
        overflow: hidden;
        margin: 0;
      }

      .article__agent {
        font-family: var(--font-mono);
        font-size: 10px;
        color: var(--color-text-muted);
        letter-spacing: 0.04em;
      }
    `,
  ];

  @property({ type: Object }) article: BroadsheetArticle | null = null;

  protected render() {
    const a = this.article;
    if (!a) return nothing;

    const sourceType = a.source_type || 'event';
    const sourceLabel = this._getSourceLabel(sourceType);

    const headline = t(a, 'headline');
    const content = t(a, 'content');

    return html`
      <article class="article">
        <div class="article__source-tag">
          <span class="article__source-dot article__source-dot--${sourceType}"></span>
          ${sourceLabel}
        </div>
        <h3 class="article__headline">${headline}</h3>
        ${content
          ? html`<p class="article__excerpt">${content}</p>`
          : nothing}
        ${a.agent_name
          ? html`<span class="article__agent">${a.agent_name}</span>`
          : nothing}
      </article>
    `;
  }

  private _getSourceLabel(type: string): string {
    switch (type) {
      case 'event':
        return msg('Event');
      case 'resonance':
        return msg('Resonance');
      case 'activity':
        return msg('Activity');
      case 'gazette':
        return msg('Gazette');
      default:
        return msg('Report');
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-broadsheet-article': VelgBroadsheetArticleEl;
  }
}
