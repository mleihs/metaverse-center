/**
 * VelgFragmentCard — a single Resonance Journal fragment.
 *
 * Six fragment types are differentiated by TYPOGRAPHY ALONE, not by
 * icons or colors. Design-direction §4 and principle 6 (voices via
 * typography, not products):
 *
 *   imprint     (dungeon)     italic Spectral — interior speech
 *   signature   (epoch)       Courier small-caps — dispatch / historian
 *   echo        (simulation)  italic first-line Spectral — collective voice
 *   impression  (bond)        amber left-rule + indent — the agent speaks
 *   mark        (achievement) wide-tracked uppercase Courier — carved in
 *   tremor      (bleed)       muted Spectral, loosened tracking — passive voice
 *
 * Metadata footer uses the brutalist small-caps register for source-
 * system label + relative timestamp. A scanning player can tell WHO
 * is speaking from registers alone, before reading the text.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import type { Fragment, FragmentType } from '../../services/api/JournalApiService.js';
import { localeService } from '../../services/i18n/locale-service.js';
import { formatRelativeTime } from '../../utils/date-format.js';

const TYPE_LABELS: Record<FragmentType, () => string> = {
  imprint: () => msg('Imprint'),
  signature: () => msg('Signature'),
  echo: () => msg('Echo'),
  impression: () => msg('Impression'),
  mark: () => msg('Mark'),
  tremor: () => msg('Tremor'),
};

@localized()
@customElement('velg-fragment-card')
export class VelgFragmentCard extends LitElement {
  static styles = css`
    :host {
      /* Tier 3 component tokens, all derived from Tier 1/2. */
      --_aged-bg: color-mix(in srgb, var(--color-surface-raised) 92%, var(--color-accent-amber) 2%);
      --_ink: color-mix(in srgb, var(--color-text-primary) 92%, transparent);
      --_ink-faint: color-mix(in srgb, var(--color-text-primary) 70%, transparent);
      --_rule: var(--color-accent-amber);
      --_border-rest: var(--color-border);
      --_border-hover: color-mix(in srgb, var(--color-accent-amber) 40%, var(--color-border));
      display: block;
    }

    .fragment {
      background: var(--_aged-bg);
      border: 1px solid var(--_border-rest);
      padding: var(--space-5) var(--space-6);
      transition:
        border-color var(--transition-normal),
        box-shadow var(--transition-normal);
      opacity: 0;
      animation: fragment-in var(--duration-entrance) var(--ease-dramatic)
        calc(var(--i, 0) * var(--duration-stagger)) forwards;
    }

    .fragment:hover {
      border-color: var(--_border-hover);
      box-shadow: var(--shadow-xs);
    }

    .fragment:focus-visible {
      outline: var(--ring-focus);
      outline-offset: 2px;
    }

    /* ── Body: variant typography by fragment_type ──────────────── */

    .body {
      font-family: var(--font-prose);
      font-size: var(--text-base);
      line-height: var(--leading-relaxed);
      letter-spacing: 0.005em;
      color: var(--_ink);
      margin: 0;
    }

    .fragment--imprint .body {
      font-style: italic;
    }

    .fragment--signature .body {
      font-family: var(--font-brutalist);
      font-variant: all-small-caps;
      letter-spacing: var(--tracking-brutalist);
      line-height: var(--leading-normal);
    }

    .fragment--echo .body::first-line {
      font-style: italic;
    }

    .fragment--impression .body {
      border-left: 3px solid var(--_rule);
      padding-left: var(--space-4);
    }

    .fragment--mark .body {
      font-family: var(--font-brutalist);
      text-transform: uppercase;
      letter-spacing: var(--tracking-widest);
      font-size: var(--text-sm);
      line-height: var(--leading-normal);
      color: var(--_ink-faint);
    }

    .fragment--tremor .body {
      color: var(--color-text-muted);
      letter-spacing: 0.01em;
      font-size: var(--text-sm);
    }

    /* ── Singular rarity: torn + corner brackets ─────────────────── */

    .fragment--singular {
      background: color-mix(in srgb, var(--color-surface-raised) 80%, var(--color-accent-amber) 6%);
      border-color: color-mix(in srgb, var(--color-accent-amber) 50%, var(--color-border));
    }

    .fragment--singular::before,
    .fragment--singular::after {
      content: '';
      position: absolute;
      width: var(--space-3);
      height: var(--space-3);
      border-color: var(--_rule);
      border-style: solid;
      border-width: 0;
    }

    .fragment--singular {
      position: relative;
    }

    .fragment--singular::before {
      top: -1px;
      left: -1px;
      border-top-width: 2px;
      border-left-width: 2px;
    }

    .fragment--singular::after {
      bottom: -1px;
      right: -1px;
      border-bottom-width: 2px;
      border-right-width: 2px;
    }

    /* ── Metadata footer ────────────────────────────────────────── */

    .meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      margin-top: var(--space-4);
      padding-top: var(--space-3);
      border-top: 1px dashed var(--color-border-light);
    }

    .meta__label {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-muted);
    }

    .meta__rarity {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--_rule);
      opacity: 0.8;
    }

    .meta__time {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    @keyframes fragment-in {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .fragment {
        animation: none;
        opacity: 1;
      }
    }

    @media (max-width: 640px) {
      .fragment {
        padding: var(--space-4);
      }

      .meta {
        flex-wrap: wrap;
      }
    }
  `;

  @property({ type: Object }) fragment!: Fragment;

  private get _content(): string {
    return localeService.currentLocale === 'de'
      ? this.fragment.content_de
      : this.fragment.content_en;
  }

  private _typeLabel(): string {
    return TYPE_LABELS[this.fragment.fragment_type]?.() ?? this.fragment.fragment_type;
  }

  private _rarityLabel(): string {
    switch (this.fragment.rarity) {
      case 'uncommon':
        return msg('Uncommon');
      case 'rare':
        return msg('Rare');
      case 'singular':
        return msg('Singular');
      default:
        return '';
    }
  }

  protected render() {
    const f = this.fragment;
    const type = f.fragment_type;
    const rarity = f.rarity;
    const rarityLabel = this._rarityLabel();

    return html`
      <article
        class="fragment fragment--${type} ${rarity === 'singular' ? 'fragment--singular' : ''}"
        tabindex="0"
        role="article"
        aria-label=${`${this._typeLabel()} – ${formatRelativeTime(f.created_at)}`}
      >
        <p class="body">${this._content}</p>
        <div class="meta">
          <span class="meta__label">${this._typeLabel()}</span>
          ${rarityLabel ? html`<span class="meta__rarity">${rarityLabel}</span>` : ''}
          <time class="meta__time" datetime=${f.created_at}>
            ${formatRelativeTime(f.created_at)}
          </time>
        </div>
      </article>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-fragment-card': VelgFragmentCard;
  }
}
