/**
 * EDITION — which printing the reader is holding.
 *
 * Two plates, phosphor and paper, switching `appState.platformSkin` at runtime.
 * A pair of plates rather than a switch: a switch implies one true position and
 * a deviation from it, and neither skin is the deviation.
 *
 * WHY THIS IS ITS OWN ELEMENT
 *   It lives in two places, and for a reason that is not symmetry. The copy in
 *   the user menu is where someone looks for their own settings; the copy in
 *   the header's SYS cluster is the only one an anonymous visitor can reach,
 *   and it sits next to the language toggle because it is the same kind of
 *   choice — a property of this browser, not of an account. Built twice, the
 *   two would have drifted the first time either was touched, and the drift
 *   would have been invisible: both would still switch the skin.
 *
 *   It also gives the later move a single seam. When the skin follows the
 *   account (`user_profiles.platform_skin`, `PATCH /users/me/skin`), the write
 *   changes here and in `AppStateManager`, not at every entrance.
 *
 * WHY TWO ARIA SHAPES
 *   The two hosts are different kinds of container, so the same markup would be
 *   wrong in one of them. The user-menu dropdown is a `role="menu"`, where the
 *   correct child is `menuitemradio` inside a `group`. The SYS cluster is a
 *   `role="navigation"`, where `menuitemradio` has no meaning at all — there
 *   the pair is two toggle buttons carrying `aria-pressed`, which is complete
 *   as it stands: Tab moves between them, and no arrow-key handling is implied.
 *   (A `radiogroup` would have been the other correct answer, and would have
 *   owed the reader arrow keys. Toggle buttons owe nothing.)
 *
 *   The unused half of the pair is bound to Lit's `nothing`, not to an empty
 *   string: `aria-checked=""` is not "no value", it is an invalid value, and a
 *   button carrying both `aria-checked` and `aria-pressed` at once has no
 *   defined state at all. `nothing` removes the attribute.
 *
 *   Shadow DOM does not break either shape: the accessibility tree is computed
 *   on the flattened tree, so `menu > group > menuitemradio` still holds with
 *   the group sitting on this element's host and the items in its shadow root.
 */

import { localized, msg } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { appState } from '../../services/AppStateManager.js';
import type { PlatformSkin } from '../../services/theme-presets.js';

/**
 * `menu` — the switch sits inside a `role="menu"`; items become
 * `menuitemradio`. `standalone` — anywhere else; items become toggle buttons.
 */
export type EditionSwitchContext = 'menu' | 'standalone';

@localized()
@customElement('velg-edition-switch')
export class VelgEditionSwitch extends SignalWatcher(LitElement) {
  static styles = css`
    :host {
      display: block;
      padding: var(--space-2) var(--space-4) var(--space-3);
    }

    .edition__label {
      display: block;
      margin-bottom: var(--space-1-5);
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      text-transform: var(--label-transform);
      letter-spacing: var(--label-tracking);
      color: var(--color-text-muted);
    }

    .edition__options {
      display: grid;
      grid-template-columns: 1fr 1fr;
      border: 1px solid var(--color-border);
    }

    .edition__opt {
      padding: var(--space-1-5) var(--space-2);
      min-height: 32px;
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      text-transform: var(--label-transform);
      letter-spacing: var(--label-tracking);
      text-align: center;
      background: transparent;
      border: none;
      color: var(--color-text-tertiary);
      cursor: pointer;
      transition: background var(--transition-fast),
                  color var(--transition-fast);
    }

    /* The seam between the two plates, drawn once so it cannot double up. */
    .edition__opt + .edition__opt {
      border-left: 1px solid var(--color-border);
    }

    /* Both selected-state attributes are named in every rule below, because
     * which one is in play depends on the context this element was given. */
    .edition__opt:hover:not([aria-checked='true']):not([aria-pressed='true']),
    .edition__opt:focus-visible {
      background: color-mix(in srgb, var(--color-primary) 8%, transparent);
      color: var(--color-primary);
      outline: none;
    }

    .edition__opt:focus-visible {
      box-shadow: var(--ring-focus);
    }

    /* The chosen plate is inked. --color-text-inverse on a --color-primary
     * fill is the platform's pairing for exactly this, measured on both
     * skins: 9.22 : 1 on phosphor, 4.85 : 1 on paper. */
    .edition__opt[aria-checked='true'],
    .edition__opt[aria-pressed='true'] {
      background: var(--color-primary);
      color: var(--color-text-inverse);
    }

    @media (max-width: 640px) {
      .edition__opt {
        min-height: 44px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
      }
    }
  `;

  @property({ type: String }) context: EditionSwitchContext = 'standalone';

  /** Hide the caption where the surrounding panel already writes one. */
  @property({ type: Boolean, attribute: 'no-label' }) noLabel = false;

  connectedCallback(): void {
    super.connectedCallback();
    // The grouping role belongs on the host: inside a menu the item role
    // `menuitemradio` is only valid under `menu` or `group`, and this element
    // is the element in between.
    this.setAttribute('role', 'group');
    this.setAttribute('aria-label', msg('Edition'));
  }

  /**
   * Switch the printing. Whatever opened this stays open: the whole point of
   * the choice is to see it, and a reader comparing the two would otherwise
   * have to reopen the panel for every look.
   */
  private _handleSkin(skin: PlatformSkin): void {
    appState.setPlatformSkin(skin);
  }

  protected render() {
    const current = appState.platformSkin.value;
    const inMenu = this.context === 'menu';
    const editions: [PlatformSkin, string][] = [
      ['dark', msg('Phosphor')],
      ['atlas', msg('Paper')],
    ];

    return html`
      ${this.noLabel ? nothing : html`<span class="edition__label">${msg('Edition')}</span>`}
      <div class="edition__options">
        ${editions.map(
          ([value, label]) => html`
            <button
              class="edition__opt"
              role=${inMenu ? 'menuitemradio' : nothing}
              aria-checked=${inMenu ? String(current === value) : nothing}
              aria-pressed=${inMenu ? nothing : String(current === value)}
              @click=${() => this._handleSkin(value)}
            >
              ${label}
            </button>
          `,
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-edition-switch': VelgEditionSwitch;
  }
}
