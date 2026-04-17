/**
 * VelgHelpTip — Contextual help link to How-to-Play guide topics.
 *
 * Renders a small question-mark icon that links to the relevant
 * guide topic page. Shows a tooltip with the label on hover/focus.
 *
 * Usage:
 *   <velg-help-tip topic="operatives" label="What are operatives?"></velg-help-tip>
 *   <velg-help-tip topic="epochs" label="How do epochs work?"></velg-help-tip>
 *
 * Design: Brutalist minimal. Amber accent on hover. WCAG AA focus ring.
 * 20x20 touch target on mobile (nested in parent's 44px zone).
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { icons } from '../../utils/icons.js';
import { navigate } from '../../utils/navigation.js';
import type { TopicSlug } from '../how-to-play/htp-topic-data.js';
import './VelgTooltip.js';

@localized()
@customElement('velg-help-tip')
export class VelgHelpTip extends LitElement {
  static styles = css`
    :host {
      --_icon-color: var(--color-text-muted);
      --_icon-hover: var(--color-primary);
      display: inline-flex;
      align-items: center;
      vertical-align: middle;
    }

    a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--_icon-color);
      text-decoration: none;
      padding: var(--space-0-5);
      border: 1px solid transparent;
      transition: color var(--transition-fast), border-color var(--transition-fast);
    }

    a:hover,
    a:focus-visible {
      color: var(--_icon-hover);
      border-color: var(--color-border);
    }

    a:focus-visible {
      outline: var(--ring-focus);
      outline-offset: 2px;
    }

    @media (prefers-reduced-motion: reduce) {
      a { transition-duration: 0.01ms; }
    }
  `;

  /**
   * Topic slug matching htp-topic-data.ts. Typed against the TopicSlug union so
   * typos fail at compile time instead of producing a broken /guide/<typo> link.
   * Empty string renders nothing — use when the topic is bound dynamically and
   * may be absent.
   */
  @property() topic: TopicSlug | '' = '';

  /** Accessible label shown as tooltip and aria-label (e.g. "What are operatives?"). */
  @property() label = '';

  protected render() {
    // Guard: render nothing if topic is unset. Prevents a link to /guide/ with
    // no slug — which would silently redirect to the hub page and erode trust
    // that every help-tip leads somewhere specific.
    if (!this.topic) return nothing;

    const href = `/how-to-play/guide/${this.topic}`;
    const ariaLabel = this.label || msg('Learn more');

    return html`
      <velg-tooltip content=${ariaLabel} position="above">
        <a
          href=${href}
          aria-label=${ariaLabel}
          title=${ariaLabel}
          @click=${this._navigate}
        >${icons.questionCircle(14)}</a>
      </velg-tooltip>
    `;
  }

  private _navigate(e: Event) {
    e.preventDefault();
    if (!this.topic) return;
    navigate(`/how-to-play/guide/${this.topic}`);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-help-tip': VelgHelpTip;
  }
}
