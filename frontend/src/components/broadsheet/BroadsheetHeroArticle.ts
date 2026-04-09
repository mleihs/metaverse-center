/**
 * VelgBroadsheetHeroArticle — Full-width lead article with drop cap.
 *
 * The hero article spans all columns, features a drop-cap lede paragraph,
 * and optionally displays a danger stamp when the editorial voice is alarmed.
 * Follows the de Volkskrant headline hierarchy pattern.
 *
 * @element velg-broadsheet-hero-article
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { BroadsheetArticle } from '../../types/index.js';
import { t } from '../../utils/locale-fields.js';
import { dispatchStyles } from '../shared/dispatch-styles.js';

import '../shared/VelgDispatchStamp.js';

@localized()
@customElement('velg-broadsheet-hero-article')
export class VelgBroadsheetHeroArticle extends LitElement {
  static styles = [
    dispatchStyles,
    css`
      :host {
        display: block;
        --_accent: var(--color-primary);
      }

      .hero {
        position: relative;
        animation: hero-enter var(--duration-entrance) var(--ease-dramatic) both;
        animation-delay: 100ms;
      }

      @keyframes hero-enter {
        from {
          opacity: 0;
          transform: translateY(6px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .hero__source {
        font-family: var(--font-brutalist);
        font-weight: var(--font-bold);
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        color: var(--color-text-muted);
        margin: 0 0 var(--space-2);
      }

      .hero__headline {
        font-family: var(--font-brutalist);
        font-weight: var(--font-black);
        font-size: clamp(1.5rem, 4vw, 2.5rem);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        line-height: 1.1;
        margin: 0 0 var(--space-3);
        color: var(--color-text-primary);
      }

      :host([voice='alarmed']) .hero__headline {
        color: var(--color-danger);
      }

      .hero__lede {
        font-family: var(--font-bureau, var(--font-prose));
        font-size: var(--text-md);
        line-height: 1.7;
        color: var(--color-text-secondary);
        max-width: 70ch;
        margin: 0;
      }

      /* Drop cap on first paragraph */
      .hero__lede::first-letter {
        initial-letter: 3;
        font-family: var(--heading-font);
        font-weight: var(--heading-weight);
        color: var(--_accent);
        margin-right: var(--space-2);
      }

      @supports not (initial-letter: 3) {
        .hero__lede::first-letter {
          float: left;
          font-size: 3.5em;
          line-height: 0.8;
          padding-right: var(--space-2);
          padding-top: 4px;
        }
      }

      .hero__stamp {
        position: absolute;
        top: 0;
        right: 0;
      }

      .hero__meta {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        margin-top: var(--space-4);
        padding-top: var(--space-3);
        border-top: 1px solid var(--color-border-light);
        font-family: var(--font-brutalist);
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--color-text-muted);
      }

      /* ── Responsive ────────────────────────── */

      @media (max-width: 640px) {
        .hero__lede {
          font-size: var(--text-base);
        }
      }

      /* ── Reduced Motion ────────────────────── */

      @media (prefers-reduced-motion: reduce) {
        .hero {
          animation: none;
        }
      }
    `,
  ];

  @property({ type: Object }) article: BroadsheetArticle | null = null;
  @property({ type: String, reflect: true }) voice = 'neutral';

  protected render() {
    const a = this.article;
    if (!a) return nothing;

    const sourceLabel = this._getSourceLabel(a.source_type);
    const showDangerStamp = this.voice === 'alarmed';
    const headline = t(a, 'headline');
    const content = t(a, 'content') || '';

    return html`
      <article class="hero">
        ${
          showDangerStamp
            ? html`<div class="hero__stamp">
              <velg-dispatch-stamp
                text=${msg('Breaking')}
                variant="badge"
                tone="danger"
              ></velg-dispatch-stamp>
            </div>`
            : nothing
        }

        <div class="hero__source">${sourceLabel}</div>
        <h2 class="hero__headline">${headline}</h2>

        ${content ? html`<p class="hero__lede">${content}</p>` : nothing}

        <div class="hero__meta">
          ${a.agent_name ? html`<span>${a.agent_name}</span>` : nothing}
          ${a.tags?.length ? html`<span>${a.tags.join(' / ')}</span>` : nothing}
        </div>
      </article>
    `;
  }

  private _getSourceLabel(type: string): string {
    switch (type) {
      case 'event':
        return msg('Event Report');
      case 'resonance':
        return msg('Resonance Impact');
      case 'activity':
        return msg('Agent Activity');
      default:
        return msg('Dispatch');
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-broadsheet-hero-article': VelgBroadsheetHeroArticle;
  }
}
