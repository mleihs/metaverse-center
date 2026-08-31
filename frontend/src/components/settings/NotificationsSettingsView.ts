/**
 * Correspondence Register - the global notification settings page.
 *
 * Every email the platform sends carried a footer link to `/settings`, and no
 * such route has ever existed: the notification panel lived only under
 * `/simulations/:id/settings`, behind a world the recipient may not even be a
 * member of. A per-USER preference was reachable only through a per-WORLD door
 * (finding E4).
 *
 * The page is deliberately thin. It does not reimplement the panel - it frames
 * it, states which address the post goes to, and says plainly what cannot be
 * switched off. Reuse over reinvention: the panel is the same one the
 * simulation settings tab renders.
 */

import { localized, msg } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import { navigate } from '../../utils/navigation.js';
import './NotificationsSettingsPanel.js';

@localized()
@customElement('velg-notifications-settings-view')
export class VelgNotificationsSettingsView extends SignalWatcher(LitElement) {
  static styles = css`
    :host {
      display: block;
      padding: var(--content-padding, var(--space-6));
      max-width: 780px;
      margin: 0 auto;
      --_ink: var(--color-text-primary);
      --_rule: var(--color-border);
    }

    /* ── Register head ─────────────────────────────────────── */

    .head {
      padding-bottom: var(--space-3);
      margin-bottom: var(--space-6);
      border-bottom: var(--border-medium);
    }

    .head__kicker {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-widest);
      color: var(--color-text-quiet);
      margin: 0 0 var(--space-2);
    }

    .head__title {
      font-family: var(--font-brutalist);
      font-weight: var(--font-black);
      font-size: clamp(1.5rem, 4vw, var(--text-2xl));
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      margin: 0 0 var(--space-3);
      color: var(--_ink);
    }

    .head__addressee {
      display: flex;
      align-items: baseline;
      gap: var(--space-2);
      flex-wrap: wrap;
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
    }

    .head__addressee code {
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      color: var(--color-primary);
      word-break: break-all;
    }

    /* ── Panel frame ───────────────────────────────────────── */

    .panel-frame {
      border: var(--border-light);
      background: var(--color-surface-raised);
      margin-bottom: var(--space-6);
    }

    /* ── Standing note ─────────────────────────────────────── */

    .note {
      border-top: 1px dashed var(--_rule);
      padding-top: var(--space-4);
      font-size: var(--text-sm);
      line-height: var(--leading-relaxed);
      color: var(--color-text-quiet);
    }

    .note__heading {
      display: block;
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-widest);
      color: var(--color-text-secondary);
      margin-bottom: var(--space-2);
    }

    .note a {
      color: var(--color-text-link);
      text-decoration: underline;
    }

    .head,
    .panel-frame,
    .note {
      animation: settle var(--duration-entrance) var(--ease-settle) both;
      animation-delay: calc(var(--i, 0) * var(--duration-cascade));
    }

    @keyframes settle {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
      }
    }
  `;

  protected render() {
    const email = appState.user.value?.email;

    return html`
      <section class="head" style="--i: 0">
        <p class="head__kicker">${msg('Bureau of Multiverse Observation')}</p>
        <h1 class="head__title">${msg('Correspondence')}</h1>
        <p class="head__addressee">
          ${
            email
              ? html`${msg('Post is addressed to')} <code>${email}</code>`
              : msg('Choose which epoch emails the Bureau sends you.')
          }
        </p>
      </section>

      <div class="panel-frame" style="--i: 1">
        <velg-notifications-settings-panel></velg-notifications-settings-panel>
      </div>

      <aside class="note" style="--i: 2">
        <span class="note__heading">${msg('Not on this list')}</span>
        ${msg(
          'Account and security mail - address confirmation, password reset, sign-in links - is never optional and is not affected by anything above.',
        )}
        ${
          email
            ? html`
              <br /><br />
              ${msg('The language of Bureau correspondence is set on your')}
              <a
                href="/profile"
                @click=${(e: Event) => {
                  e.preventDefault();
                  navigate('/profile');
                }}
                >${msg('personnel file')}</a
              >.
            `
            : nothing
        }
      </aside>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-notifications-settings-view': VelgNotificationsSettingsView;
  }
}
