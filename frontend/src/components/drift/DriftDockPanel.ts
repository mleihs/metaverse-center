/**
 * VelgDriftDockPanel — the dock experience (plan §3.6, concept "Broadcast-Rand").
 *
 * When a Träger docks at a FOREIGN world's broadcast edge, this surfaces that
 * world's identity instead of a bare "+5": its name, blurb, a lore epigraph (the
 * world speaking), and a few of its Träger (active_agents). A first-contact dossier
 * sliding in at the board's edge — turning an abstract node into "I arrived in
 * the Gaslit Reach, and here is what it is."
 *
 * Data is all public sim content (DriftService.get_dock_info → /drift/dock/:id).
 * Theme-adaptive (tokens only): under the anchor world's per-sim theme it takes
 * that world's surfaces/accents. DriftView mounts it only while docked; Escape or
 * the close control emits `dock-close`.
 */

import { localized, msg } from '@lit/localize';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import type { DriftDock } from '../../types/drift.js';
import { icons } from '../../utils/icons.js';
import '../shared/VelgAvatar.js';

@localized()
@customElement('velg-drift-dock-panel')
export class VelgDriftDockPanel extends LitElement {
  @property({ attribute: false }) dock: DriftDock | null = null;

  static styles = css`
    :host {
      position: absolute;
      top: var(--space-4);
      right: var(--space-4);
      bottom: var(--space-4);
      width: min(360px, calc(100% - var(--space-8)));
      z-index: var(--z-raised);
      pointer-events: none;
      --_accent: var(--color-primary);
    }
    .dock {
      pointer-events: auto;
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      max-height: 100%;
      overflow-y: auto;
      padding: var(--space-5) var(--space-4) var(--space-4);
      background: color-mix(in srgb, var(--color-surface) 92%, transparent);
      border: var(--border-medium);
      border-left: var(--border-width-heavy) solid var(--_accent);
      box-shadow: var(--shadow-xl);
      backdrop-filter: blur(3px);
      animation: dock-in var(--duration-entrance) var(--ease-dramatic) both;
    }
    .dock__close {
      position: absolute;
      top: var(--space-2);
      right: var(--space-2);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      padding: 0;
      color: var(--color-text-secondary);
      background: transparent;
      border: var(--border-width-thin) solid var(--color-border);
      cursor: pointer;
      transition: color var(--transition-fast), border-color var(--transition-fast);
    }
    .dock__close:hover {
      color: var(--color-text-primary);
      border-color: var(--_accent);
    }
    .dock__close:focus-visible {
      outline: none;
      box-shadow: var(--ring-focus);
    }
    .dock__eyebrow {
      display: flex;
      align-items: center;
      gap: var(--space-1-5);
      margin: 0;
      padding-right: var(--space-8);
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-widest);
      color: var(--_accent);
    }
    .dock__title {
      margin: 0;
      font-family: var(--font-brutalist);
      font-size: var(--text-2xl);
      font-weight: var(--font-black);
      line-height: var(--leading-tight);
      text-transform: uppercase;
      letter-spacing: var(--tracking-brutalist);
      color: var(--color-text-primary);
    }
    .dock__desc {
      margin: 0;
      font-family: var(--font-body);
      font-size: var(--text-sm);
      line-height: var(--leading-relaxed);
      color: var(--color-text-secondary);
    }
    .dock__lore {
      margin: 0;
      padding: var(--space-2) 0 var(--space-2) var(--space-3);
      border-left: var(--border-width-thick) solid
        color-mix(in srgb, var(--_accent) 50%, transparent);
    }
    .dock__epigraph {
      margin: 0 0 var(--space-1);
      font-family: var(--font-prose, var(--font-body));
      font-style: italic;
      font-size: var(--text-sm);
      line-height: var(--leading-relaxed);
      color: var(--color-text-primary);
    }
    .dock__lore-title {
      display: block;
      font-family: var(--font-brutalist);
      font-style: normal;
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wide);
      color: var(--color-text-muted);
    }
    .dock__cast-label {
      display: flex;
      align-items: center;
      gap: var(--space-1-5);
      margin: 0 0 var(--space-2);
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      text-transform: uppercase;
      letter-spacing: var(--tracking-wider);
      color: var(--color-text-muted);
    }
    .dock__agents {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }
    .dock__agent {
      display: flex;
      align-items: center;
      gap: var(--space-2-5);
      animation: dock-agent-in var(--duration-entrance) var(--ease-out) both;
      animation-delay: calc(var(--i, 0) * var(--duration-stagger));
    }
    .dock__agent-meta {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .dock__agent-name {
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      color: var(--color-text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .dock__agent-role {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }
    @keyframes dock-in {
      from {
        opacity: 0;
        transform: translateX(24px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
    @keyframes dock-agent-in {
      from {
        opacity: 0;
        transform: translateX(10px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .dock,
      .dock__agent {
        animation-duration: 0.01ms;
      }
    }
    @media (max-width: 640px) {
      :host {
        width: calc(100% - var(--space-6));
      }
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('keydown', this._onKey);
  }

  disconnectedCallback(): void {
    window.removeEventListener('keydown', this._onKey);
    super.disconnectedCallback();
  }

  private _onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this._close();
  };

  private _close(): void {
    this.dispatchEvent(new CustomEvent('dock-close', { bubbles: true, composed: true }));
  }

  protected render() {
    const d = this.dock;
    if (!d) return nothing;
    const lore = d.lore[0];
    return html`
      <aside class="dock" role="dialog" aria-label=${msg('World dossier')}>
        <button class="dock__close" @click=${this._close} aria-label=${msg('Close')}>
          ${icons.close(18)}
        </button>
        <p class="dock__eyebrow">${icons.compassRose(14)} ${msg('Erstkontakt · Broadcast-Rand')}</p>
        <h2 class="dock__title">${d.name}</h2>
        ${d.description ? html`<p class="dock__desc">${d.description}</p>` : nothing}
        ${
          lore && (lore.epigraph || lore.title)
            ? html`
              <blockquote class="dock__lore">
                ${lore.epigraph ? html`<p class="dock__epigraph">${lore.epigraph}</p>` : nothing}
                ${lore.title ? html`<cite class="dock__lore-title">${lore.title}</cite>` : nothing}
              </blockquote>
            `
            : nothing
        }
        ${
          d.agents.length
            ? html`
              <div class="dock__cast">
                <p class="dock__cast-label">${icons.users(14)} ${msg('Träger')}</p>
                <ul class="dock__agents">
                  ${d.agents.map(
                    (a, i) => html`
                      <li class="dock__agent" style="--i: ${i}">
                        <velg-avatar
                          size="sm"
                          name=${a.name}
                          src=${a.portrait_image_url ?? ''}
                        ></velg-avatar>
                        <span class="dock__agent-meta">
                          <span class="dock__agent-name">${a.name}</span>
                          ${
                            a.primary_profession
                              ? html`<span class="dock__agent-role">${a.primary_profession}</span>`
                              : nothing
                          }
                        </span>
                      </li>
                    `,
                  )}
                </ul>
              </div>
            `
            : nothing
        }
      </aside>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-drift-dock-panel': VelgDriftDockPanel;
  }
}
