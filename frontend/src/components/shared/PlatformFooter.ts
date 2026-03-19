import { localized, msg } from '@lit/localize';
import { css, html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';

@localized()
@customElement('velg-platform-footer')
export class VelgPlatformFooter extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    footer {
      border-top: 1px solid var(--color-border-light);
      padding: var(--space-6) var(--space-4);
      text-align: center;
    }

    .footer__rule {
      width: 40px;
      height: 1px;
      background: var(--color-accent-amber);
      margin: 0 auto var(--space-4);
      border: none;
    }

    .footer__row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-4);
      font-family: var(--font-mono);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-widest);
      color: var(--color-text-muted);
      flex-wrap: wrap;
    }

    nav {
      display: flex;
      gap: var(--space-3);
    }

    a {
      color: var(--color-text-muted);
      text-decoration: none;
      transition: color var(--transition-fast);
    }

    a:hover {
      color: var(--color-text-tertiary);
    }

    a:focus-visible {
      outline: 2px solid var(--color-accent-amber);
      outline-offset: 2px;
    }

    .footer__links {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: var(--space-2) var(--space-3);
      margin-bottom: var(--space-4);
      font-family: var(--font-mono);
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: var(--tracking-widest);
    }

    .footer__links-label {
      color: var(--color-accent-amber);
      font-weight: var(--font-bold);
    }

    .footer__bureau {
      font-family: var(--font-mono);
      font-size: 8px;
      text-transform: uppercase;
      letter-spacing: 0.4em;
      color: var(--color-text-muted);
      margin-top: var(--space-3);
    }
  `;

  protected render() {
    return html`
      <footer role="contentinfo">
        <hr class="footer__rule" />
        <nav class="footer__links" aria-label=${msg('Discover')}>
          <span class="footer__links-label">${msg('Discover')}</span>
          <a href="/worldbuilding">${msg('Worldbuilding')}</a>
          <span aria-hidden="true">\u00B7</span>
          <a href="/ai-characters">${msg('AI Characters')}</a>
          <span aria-hidden="true">\u00B7</span>
          <a href="/strategy-game">${msg('Strategy Game')}</a>
          <span aria-hidden="true">\u00B7</span>
          <a href="/perspectives/what-is-the-metaverse">${msg('What Is the Metaverse?')}</a>
          <span aria-hidden="true">\u00B7</span>
          <a href="/perspectives/ai-powered-worldbuilding">${msg('AI Worldbuilding')}</a>
          <span aria-hidden="true">\u00B7</span>
          <a href="/perspectives/digital-sovereignty">${msg('Digital Sovereignty')}</a>
          <span aria-hidden="true">\u00B7</span>
          <a href="/perspectives/virtual-civilizations">${msg('Virtual Civilizations')}</a>
          <span aria-hidden="true">\u00B7</span>
          <a href="/perspectives/competitive-strategy">${msg('Competitive Strategy')}</a>
        </nav>
        <div class="footer__row">
          <span>\u00A9 ${new Date().getFullYear()} metaverse.center</span>
          <nav aria-label=${msg('Legal')}>
            <a href="/privacy">${msg('Privacy')}</a>
            <span aria-hidden="true">\u00B7</span>
            <a href="/terms">${msg('Terms')}</a>
            <span aria-hidden="true">\u00B7</span>
            <a href="https://www.instagram.com/bureau.of.impossible.geography/" target="_blank" rel="noopener noreferrer">${msg('Instagram')}</a>
            <span aria-hidden="true">\u00B7</span>
            <a href="https://github.com/mleihs/velgarien-rebuild" target="_blank" rel="noopener noreferrer">${msg('GitHub')}</a>
          </nav>
        </div>
        <div class="footer__bureau">${msg('Bureau of Multiverse Observation')}</div>
      </footer>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-platform-footer': VelgPlatformFooter;
  }
}
