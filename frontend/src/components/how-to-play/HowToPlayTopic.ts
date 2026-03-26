/**
 * How to Play — Individual Topic Page (dynamic :topic param).
 * Stub: full implementation in Phase 3.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { analyticsService } from '../../services/AnalyticsService.js';
import { seoService } from '../../services/SeoService.js';

@localized()
@customElement('velg-how-to-play-topic')
export class VelgHowToPlayTopic extends LitElement {
  static styles = css`
    :host { display: block; color: var(--color-text-primary); padding: var(--space-12) var(--content-padding); }
    .stub { max-width: var(--container-md); margin: 0 auto; text-align: center; }
    h1 { font-family: var(--font-brutalist); font-size: var(--text-3xl); margin: 0 0 var(--space-4); }
    p { color: var(--color-text-secondary); }
    code { font-family: var(--font-brutalist); color: var(--color-primary); }
  `;

  @property() topic = '';

  connectedCallback(): void {
    super.connectedCallback();
    seoService.setTitle([this.topic, msg('Game Guide'), msg('How to Play')]);
    seoService.setCanonical(`/how-to-play/guide/${this.topic}`);
    seoService.setBreadcrumbs([
      { name: 'Home', url: 'https://metaverse.center/' },
      { name: msg('How to Play'), url: 'https://metaverse.center/how-to-play' },
      { name: msg('Game Guide'), url: 'https://metaverse.center/how-to-play/guide' },
      { name: this.topic, url: `https://metaverse.center/how-to-play/guide/${this.topic}` },
    ]);
    analyticsService.trackPageView(`/how-to-play/guide/${this.topic}`, document.title);
  }

  render() {
    return html`
      <div class="stub">
        <h1>${msg('Topic')}: <code>${this.topic}</code></h1>
        <p>${msg('Coming soon. Full topic page with TL;DR, explanation, tips, and related topics.')}</p>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-how-to-play-topic': VelgHowToPlayTopic;
  }
}
