/**
 * How to Play — Game Guide Hub (Civilopedia-style topic grid).
 * Stub: full implementation in Phase 3.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { analyticsService } from '../../services/AnalyticsService.js';
import { seoService } from '../../services/SeoService.js';

@localized()
@customElement('velg-how-to-play-guide-hub')
export class VelgHowToPlayGuideHub extends LitElement {
  static styles = css`
    :host { display: block; color: var(--color-text-primary); padding: var(--space-12) var(--content-padding); }
    .stub { max-width: var(--container-md); margin: 0 auto; text-align: center; }
    h1 { font-family: var(--font-brutalist); font-size: var(--text-3xl); margin: 0 0 var(--space-4); }
    p { color: var(--color-text-secondary); }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    seoService.setTitle([msg('Game Guide'), msg('How to Play')]);
    seoService.setDescription(msg('Browse 12 topics covering every game system in metaverse.center.'));
    seoService.setCanonical('/how-to-play/guide');
    seoService.setBreadcrumbs([
      { name: 'Home', url: 'https://metaverse.center/' },
      { name: msg('How to Play'), url: 'https://metaverse.center/how-to-play' },
      { name: msg('Game Guide'), url: 'https://metaverse.center/how-to-play/guide' },
    ]);
    analyticsService.trackPageView('/how-to-play/guide', document.title);
  }

  render() {
    return html`
      <div class="stub">
        <h1>${msg('Game Guide')}</h1>
        <p>${msg('Coming soon. 12 topic pages covering every system.')}</p>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-how-to-play-guide-hub': VelgHowToPlayGuideHub;
  }
}
