/**
 * Dungeon Entry CTA — bridges archetype detail pages to dungeon gameplay.
 *
 * Handles the complete entry flow:
 *   1. Auth check (dispatches login-panel-open if needed)
 *   2. Simulation resolution (0/1/N sims)
 *   3. Deep-link signal (pendingDungeonArchetype) + SPA navigation
 *
 * Variants:
 *   - "hero": full-width CTA for detail page exit sections (archetype accent, glow)
 *   - "compact": inline button for showcase cards (shared .btn styles)
 *
 * Pattern: GuestBanner.ts (auth-aware CTA), BuildingDetailsPanel.ts (deep-link signal).
 */

import { localized, msg } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import { appState } from '../../services/AppStateManager.js';
import { simulationsApi } from '../../services/api/index.js';
import { icons } from '../../utils/icons.js';
import { navigate } from '../../utils/navigation.js';
import { buttonStyles } from '../shared/button-styles.js';
import { VelgToast } from '../shared/Toast.js';
import './DungeonSimPicker.js';

@localized()
@customElement('velg-dungeon-entry-cta')
export class VelgDungeonEntryCta extends SignalWatcher(LitElement) {
  static styles = [
    buttonStyles,
    css`
      :host {
        display: inline-block;
      }

      /* ── Hero variant (detail page exit section) ─────────────────────── */

      .cta--hero {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        padding: 14px 40px;
        font-family: var(--_font-display, var(--font-brutalist));
        font-size: var(--text-sm);
        font-weight: var(--font-bold);
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--color-text-primary);
        background: color-mix(in oklch, var(--_accent, var(--color-primary)) 20%, transparent);
        border: 1px solid var(--_accent, var(--color-primary));
        border-radius: var(--border-radius-md);
        cursor: pointer;
        transition: background var(--transition-slow), box-shadow var(--transition-slow);
        line-height: var(--leading-tight);
      }

      .cta--hero:hover {
        background: color-mix(in oklch, var(--_accent, var(--color-primary)) 35%, transparent);
        box-shadow: 0 0 24px color-mix(in srgb, var(--_accent, var(--color-primary)) 30%, transparent);
      }

      .cta--hero:focus-visible {
        outline: 2px solid var(--_accent, var(--color-primary));
        outline-offset: 4px;
      }

      .cta--hero:active {
        transform: scale(0.98);
      }

      @media (prefers-reduced-motion: no-preference) {
        .cta--hero {
          animation: cta-pulse 2s ease-in-out infinite;
        }
      }

      @keyframes cta-pulse {
        0%, 100% {
          box-shadow: 0 0 8px color-mix(in srgb, var(--_accent, var(--color-primary)) 15%, transparent);
        }
        50% {
          box-shadow: 0 0 24px color-mix(in srgb, var(--_accent, var(--color-primary)) 30%, transparent);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .cta--hero {
          animation: none;
        }
      }

      /* ── Compact variant (showcase cards) ────────────────────────────── */

      .cta--compact {
        /* Uses .btn .btn--primary .btn--sm classes from buttonStyles */
      }

      /* ── Mobile ──────────────────────────────────────────────────────── */

      @media (max-width: 640px) {
        .cta--hero {
          padding: 12px 28px;
          font-size: var(--text-xs);
        }
      }
    `,
  ];

  /** Detail-page slug: "overthrow", "shadow", etc. */
  @property({ type: String }) archetype = '';

  /** Optional narrative label (bilingual, data-driven). Falls back to generic msg(). */
  @property({ type: String }) label = '';

  /** "hero" for detail page exit sections, "compact" for inline/card usage. */
  @property({ type: String, reflect: true }) variant: 'hero' | 'compact' = 'hero';

  @state() private _pickerOpen = false;

  // ── Click Handler ────────────────────────────────────────────────────────

  private async _handleClick(): Promise<void> {
    // 1. Auth check
    if (!appState.isAuthenticated.value) {
      this.dispatchEvent(new CustomEvent('login-panel-open', { bubbles: true, composed: true }));
      return;
    }

    // 2. Ensure simulations are loaded
    let sims = appState.simulations.value;
    if (sims.length === 0) {
      const res = await simulationsApi.list();
      if (res.success && res.data) {
        appState.setSimulations(res.data);
        sims = res.data;
      }
    }

    // 3. Resolve simulation context
    if (sims.length === 0) {
      VelgToast.info(msg('Join or create a simulation to play dungeons.'));
      return;
    }

    if (sims.length === 1) {
      this._navigateToDungeon(sims[0].slug ?? sims[0].id);
      return;
    }

    // N simulations → open picker
    this._pickerOpen = true;
  }

  // ── Navigation ───────────────────────────────────────────────────────────

  private _navigateToDungeon(slugOrId: string): void {
    // Set deep-link signal (consumed by DungeonTerminalView on init)
    appState.pendingDungeonArchetype.value = this.archetype;
    navigate(`/simulations/${slugOrId}/dungeon`);
  }

  // ── Picker Events ────────────────────────────────────────────────────────

  private _handleSimSelected(e: CustomEvent<{ simulationSlug: string }>): void {
    this._pickerOpen = false;
    this._navigateToDungeon(e.detail.simulationSlug);
  }

  private _handlePickerClose(): void {
    this._pickerOpen = false;
  }

  // ── Render ───────────────────────────────────────────────────────────────

  protected render() {
    const isAuth = appState.isAuthenticated.value;
    const label = this._resolveLabel(isAuth);

    return html`
      ${this._renderButton(label)}
      ${
        this._pickerOpen
          ? html`
            <velg-dungeon-sim-picker
              ?open=${this._pickerOpen}
              archetype=${this.archetype}
              @sim-selected=${this._handleSimSelected}
              @modal-close=${this._handlePickerClose}
            ></velg-dungeon-sim-picker>
          `
          : nothing
      }
    `;
  }

  private _renderButton(label: string) {
    if (this.variant === 'compact') {
      return html`
        <button
          class="btn btn--primary btn--sm cta--compact"
          @click=${this._handleClick}
          aria-label=${this._ariaLabel()}
        >
          ${icons.dungeonDepth(14)} ${label}
        </button>
      `;
    }

    // Hero variant
    return html`
      <button
        class="cta--hero"
        @click=${this._handleClick}
        aria-label=${this._ariaLabel()}
      >
        ${label}
      </button>
    `;
  }

  private _resolveLabel(isAuth: boolean): string {
    if (!isAuth) return msg('Sign in to enter');
    if (this.label) return this.label;
    return msg('Enter Dungeon');
  }

  private _ariaLabel(): string {
    return msg('Enter dungeon');
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-dungeon-entry-cta': VelgDungeonEntryCta;
  }
}
