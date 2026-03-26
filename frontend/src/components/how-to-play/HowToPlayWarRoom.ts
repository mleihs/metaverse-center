/**
 * How to Play — War Room (competitive tactics, matches, analytics).
 * Stub: full implementation in Phase 4.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { analyticsService } from '../../services/AnalyticsService.js';
import { seoService } from '../../services/SeoService.js';

@localized()
@customElement('velg-how-to-play-war-room')
export class VelgHowToPlayWarRoom extends LitElement {
  static styles = css`
    :host { display: block; color: var(--color-text-primary); padding: var(--space-12) var(--content-padding); }
    .stub { max-width: var(--container-md); margin: 0 auto; text-align: center; }
    h1 { font-family: var(--font-brutalist); font-size: var(--text-3xl); margin: 0 0 var(--space-4); color: var(--color-primary); }
    p { color: var(--color-text-secondary); }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    seoService.setTitle([msg('War Room'), msg('How to Play')]);
    seoService.setDescription(msg('Competitive tactics, worked-out match replays, and 200-game balance analytics for metaverse.center epochs.'));
    seoService.setCanonical('/how-to-play/competitive');
    seoService.setBreadcrumbs([
      { name: 'Home', url: 'https://metaverse.center/' },
      { name: msg('How to Play'), url: 'https://metaverse.center/how-to-play' },
      { name: msg('War Room'), url: 'https://metaverse.center/how-to-play/competitive' },
    ]);
    analyticsService.trackPageView('/how-to-play/competitive', document.title);
  }

  render() {
    return html`
      <div class="stub">
        <h1>${msg('War Room')}</h1>
        <p>${msg('Coming soon. Tactics, match replays, intelligence report, demo run, and changelog.')}</p>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-how-to-play-war-room': VelgHowToPlayWarRoom;
  }
}
