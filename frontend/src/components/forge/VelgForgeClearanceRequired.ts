/**
 * VelgForgeClearanceRequired — Rendered at /forge when the user lacks
 * Architect clearance.
 *
 * Replaces the previous silent `/forge` → `/dashboard` redirect. Shows what
 * the Forge is, how to request clearance, and the two alternate paths a fresh
 * user has: bringing their own AI key (bypasses the queue) or starting an
 * Academy training match (tutorial).
 *
 * Layout:
 *   - Brutalist "FORGE — CLEARANCE REQUIRED" heading (clip-reveal entrance)
 *   - Explainer paragraph
 *   - Embedded <velg-clearance-card> (existing component, handles Apply flow)
 *   - Alternative paths: BYOK guide link + Academy CTA
 *   - Staggered entry cascade, hover glow, reduced-motion guarded
 *
 * Route wiring: rendered by `app-shell.ts` when `!appState.canForge.value`.
 */

import { localized, msg } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { epochsApi } from '../../services/api/EpochsApiService.js';
import { captureError } from '../../services/SentryService.js';
import { icons } from '../../utils/icons.js';
import { navigate } from '../../utils/navigation.js';
import './ClearanceApplicationCard.js';

@localized()
@customElement('velg-forge-clearance-required')
export class VelgForgeClearanceRequired extends SignalWatcher(LitElement) {
  static styles = css`
    :host {
      --_accent: var(--color-accent-amber);
      --_accent-dim: color-mix(in srgb, var(--color-accent-amber) 30%, transparent);
      --_accent-glow: color-mix(in srgb, var(--color-accent-amber) 8%, transparent);

      display: block;
      min-height: calc(100vh - var(--header-height, 60px));
      padding: var(--space-12, 48px) var(--space-6, 24px);
      background: var(--color-surface);
    }

    .wrap {
      max-width: 640px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: var(--space-8, 32px);
    }

    /* ── Entry cascade ── */

    .wrap > * {
      animation: clearance-enter var(--duration-entrance, 350ms)
        var(--ease-dramatic, cubic-bezier(0.22, 1, 0.36, 1)) both;
      animation-delay: calc(var(--i, 0) * var(--duration-cascade, 60ms));
    }

    @keyframes clearance-enter {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ── Heading ── */

    .heading {
      position: relative;
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: var(--font-black, 900);
      font-size: var(--text-xl, 25px);
      letter-spacing: var(--tracking-brutalist, 0.08em);
      text-transform: uppercase;
      color: var(--color-text-primary);
      margin: 0;
      padding-bottom: var(--space-3, 12px);
      border-bottom: 1px solid var(--color-border);
      clip-path: inset(0 100% 0 0);
      animation: heading-scan 400ms var(--ease-snap, cubic-bezier(0.22, 1, 0.36, 1)) 120ms forwards;
    }

    @keyframes heading-scan {
      to { clip-path: inset(0 0 0 0); }
    }

    .heading__accent {
      color: var(--_accent);
    }

    .explainer {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: var(--text-sm, 13px);
      line-height: var(--leading-relaxed, 1.625);
      color: var(--color-text-secondary);
      margin: 0;
    }

    /* ── Alternative paths section ── */

    .alt-separator {
      display: flex;
      align-items: center;
      gap: var(--space-3, 12px);
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-size: var(--text-xs, 10px);
      letter-spacing: var(--tracking-brutalist, 0.08em);
      text-transform: uppercase;
      color: var(--color-text-muted);
    }

    .alt-separator::before,
    .alt-separator::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--color-border);
    }

    .alt-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-3, 12px);
    }

    .alt {
      appearance: none;
      font: inherit;
      text-align: start;
      display: flex;
      align-items: center;
      gap: var(--space-4, 16px);
      padding: var(--space-4, 16px);
      background: var(--color-surface-raised);
      border: 1px solid var(--color-border);
      cursor: pointer;
      text-decoration: none;
      color: inherit;
      transition:
        border-color var(--transition-fast, 100ms ease),
        box-shadow var(--transition-fast, 100ms ease),
        transform var(--transition-fast, 100ms ease);
    }

    .alt:hover {
      border-color: var(--_accent-dim);
      box-shadow: inset 0 0 0 1px var(--_accent-dim), 0 2px 8px var(--_accent-glow);
    }

    .alt:focus-visible {
      outline: var(--ring-focus, 3px solid);
      outline-offset: 2px;
    }

    .alt__icon {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border: 1px solid var(--color-border);
      color: var(--_accent);
    }

    .alt__text {
      flex: 1;
      min-width: 0;
    }

    .alt__title {
      font-family: var(--font-brutalist, 'Courier New', monospace);
      font-weight: var(--font-black, 900);
      font-size: var(--text-sm, 13px);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist, 0.08em);
      color: var(--color-text-primary);
      margin: 0 0 var(--space-1, 4px);
    }

    .alt__desc {
      font-family: var(--font-mono, 'SF Mono', monospace);
      font-size: var(--text-xs, 10px);
      line-height: var(--leading-normal, 1.5);
      color: var(--color-text-muted);
      margin: 0;
    }

    .alt__arrow {
      flex-shrink: 0;
      color: var(--color-border);
      transition:
        color var(--transition-fast, 100ms ease),
        transform var(--transition-fast, 100ms ease);
    }

    .alt:hover .alt__arrow {
      color: var(--_accent);
      transform: translateX(2px);
    }

    /* ── Responsive ── */

    @media (max-width: 480px) {
      :host { padding: var(--space-8, 32px) var(--space-4, 16px); }
      .heading { font-size: var(--text-lg, 20px); }
    }

    /* ── Reduced motion ── */

    @media (prefers-reduced-motion: reduce) {
      .wrap > *,
      .heading {
        animation: none;
      }
      .heading {
        clip-path: inset(0 0 0 0);
      }
      .alt,
      .alt__arrow {
        transition: none;
      }
    }
  `;

  protected render() {
    return html`
      <section class="wrap" aria-labelledby="clearance-heading">
        <h1 id="clearance-heading" class="heading" style="--i: 0">
          ${msg('FORGE')} <span class="heading__accent">${msg('\u2013 CLEARANCE REQUIRED')}</span>
        </h1>

        <p class="explainer" style="--i: 1">
          ${msg('The Forge is where Architects shape new worlds. Architect clearance is required to create a simulation. Apply for a tier upgrade below, or use one of the alternate paths while you wait.')}
        </p>

        <velg-clearance-card style="--i: 2"></velg-clearance-card>

        <div class="alt-separator" style="--i: 3" aria-hidden="true">
          ${msg('Alternative paths')}
        </div>

        <div class="alt-list">
          <a
            class="alt"
            style="--i: 4"
            href="/how-to-play/guide/byok"
            @click=${this._handleByokLink}
            aria-label=${msg('Learn about Bring Your Own Key')}
          >
            <div class="alt__icon" aria-hidden="true">${icons.key(20)}</div>
            <div class="alt__text">
              <div class="alt__title">${msg('Bring Your Own Key')}</div>
              <div class="alt__desc">${msg('Use your own AI API key to bypass the clearance queue.')}</div>
            </div>
            <div class="alt__arrow" aria-hidden="true">${icons.chevronRight(14)}</div>
          </a>

          <button
            type="button"
            class="alt"
            style="--i: 5"
            @click=${this._handleAcademy}
            aria-label=${msg('Start Academy training match')}
          >
            <div class="alt__icon" aria-hidden="true">${icons.crossedSwords(20)}</div>
            <div class="alt__text">
              <div class="alt__title">${msg('Start Academy Training')}</div>
              <div class="alt__desc">${msg('Solo tutorial match vs 3 AI opponents. Quick, auto-resolve.')}</div>
            </div>
            <div class="alt__arrow" aria-hidden="true">${icons.chevronRight(14)}</div>
          </button>
        </div>
      </section>
    `;
  }

  private _handleByokLink(e: MouseEvent): void {
    e.preventDefault();
    navigate('/how-to-play/guide/byok');
  }

  private async _handleAcademy(): Promise<void> {
    try {
      const resp = await epochsApi.createQuickAcademy();
      if (resp.success && resp.data) {
        navigate(`/epochs/${resp.data.id}`);
      }
    } catch (err) {
      captureError(err, { source: 'VelgForgeClearanceRequired._handleAcademy' });
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-forge-clearance-required': VelgForgeClearanceRequired;
  }
}
