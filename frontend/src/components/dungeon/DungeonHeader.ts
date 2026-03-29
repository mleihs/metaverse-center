/**
 * Dungeon Header — submarine depth gauge instrument bar.
 *
 * Thin bar across the top of the dungeon view showing run-level telemetry:
 * archetype badge, depth progress gauge with danger zone, rooms cleared counter,
 * and archetype-specific readouts (Shadow: visibility pips, Tower: stability gauge).
 *
 * Pure signal consumer — no internal state, no API calls.
 * Aesthetic: 1970s analog instrument panel with CRT amber phosphor.
 *
 * Pattern: EpochCommandCenter banner (thin top bar, signal-reactive).
 */

import { localized, msg } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';

import { dungeonState } from '../../services/DungeonStateManager.js';
import { isShadowState, isTowerState } from '../../types/dungeon.js';
import { icons } from '../../utils/icons.js';
import { terminalComponentTokens, terminalTokens } from '../shared/terminal-theme-styles.js';

@localized()
@customElement('velg-dungeon-header')
export class VelgDungeonHeader extends SignalWatcher(LitElement) {
  static styles = [
    terminalTokens,
    terminalComponentTokens,
    css`
      :host {
        display: block;
        --_text-dim: var(--hud-text-dim);
        --_danger: var(--color-danger);
      }

      .header {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 6px 12px;
        background: color-mix(in srgb, var(--_screen-bg) 85%, transparent);
        border: 1px solid color-mix(in srgb, var(--_border) 60%, transparent);
        border-bottom: 1px dashed color-mix(in srgb, var(--_border) 40%, transparent);
        font-family: var(--_mono);
        font-size: 11px;
        color: var(--_phosphor-dim);
        letter-spacing: 0.5px;
      }

      /* ── Archetype Badge ── */
      .archetype {
        font-family: var(--font-brutalist, var(--_mono));
        font-weight: 700;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 1.5px;
        color: var(--_phosphor);
        padding: 3px 10px;
        border: 1px solid color-mix(in srgb, var(--_phosphor) 40%, transparent);
        white-space: nowrap;
        flex-shrink: 0;
      }

      /* ── Depth Gauge (submarine depth meter) ── */
      .depth {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
        min-width: 0;
      }

      .depth__label {
        white-space: nowrap;
        flex-shrink: 0;
      }

      .depth__track {
        flex: 1;
        height: 6px;
        background: color-mix(in srgb, var(--_border) 40%, transparent);
        position: relative;
        overflow: hidden;
        min-width: 60px;
      }

      .depth__fill {
        position: absolute;
        inset: 0;
        background: var(--_phosphor-dim);
        transform-origin: left;
      }

      /* Danger zone — last 20% of the bar in red (boss depth) */
      .depth__danger {
        position: absolute;
        right: 0;
        top: 0;
        bottom: 0;
        width: 20%;
        background: color-mix(in srgb, var(--_danger) 15%, transparent);
        border-left: 1px dashed color-mix(in srgb, var(--_danger) 30%, transparent);
      }

      /* Tick marks at each depth level */
      .depth__ticks {
        position: absolute;
        inset: 0;
        display: flex;
        pointer-events: none;
      }

      .depth__tick {
        flex: 1;
        border-right: 1px solid color-mix(in srgb, var(--_phosphor-dim) 50%, transparent);
      }

      .depth__tick:last-child {
        border-right: none;
      }

      @media (prefers-reduced-motion: no-preference) {
        .depth__fill {
          transition: transform 400ms ease-out;
        }
      }

      /* ── Rooms Counter ── */
      .rooms {
        display: flex;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
        flex-shrink: 0;
      }

      .rooms__icon {
        display: inline-flex;
        color: var(--_phosphor-dim);
      }

      /* ── Visibility Pips (archetype-specific: Shadow) ── */
      .visibility {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-shrink: 0;
      }

      .visibility__icon {
        display: inline-flex;
        margin-right: 2px;
      }

      .visibility__pip {
        display: inline-flex;
        width: 10px;
        height: 10px;
        color: var(--_phosphor-dim);
        opacity: 0.25;
      }

      .visibility__pip--filled {
        opacity: 1;
        color: var(--_phosphor);
      }

      @media (prefers-reduced-motion: no-preference) {
        .visibility__pip--filled {
          filter: drop-shadow(0 0 3px var(--_phosphor-glow));
        }
      }

      /* ── Stability Gauge (archetype-specific: Tower) ── */
      .stability {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
      }

      .stability__icon {
        display: inline-flex;
        color: var(--_phosphor-dim);
      }

      .stability__label {
        font-size: 10px;
        letter-spacing: 0.05em;
        color: var(--_phosphor-dim);
      }

      .stability__track {
        position: relative;
        width: 60px;
        height: 8px;
        background: color-mix(in srgb, var(--_phosphor) 10%, transparent);
        border: 1px solid color-mix(in srgb, var(--_border) 50%, transparent);
      }

      .stability__fill {
        height: 100%;
        background: var(--_phosphor);
        transform-origin: left;
        transition: transform 0.3s ease-out;
      }

      .stability__fill--warning {
        background: var(--color-warning);
      }

      .stability__fill--critical {
        background: var(--color-danger);
      }

      @media (prefers-reduced-motion: no-preference) {
        .stability__fill--critical {
          animation: stability-pulse 2s ease-in-out infinite;
        }
      }

      @keyframes stability-pulse {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.6;
        }
      }

      /* ── Separator — vertical divider between sections ── */
      .sep {
        width: 1px;
        height: 16px;
        background: color-mix(in srgb, var(--_border) 40%, transparent);
        flex-shrink: 0;
      }

      /* ── Mobile ── */
      @media (max-width: 640px) {
        .header {
          padding: 4px 8px;
          gap: 8px;
          font-size: 10px;
        }

        .archetype {
          font-size: 9px;
          padding: 2px 6px;
          letter-spacing: 1px;
        }

        .depth__track {
          min-width: 40px;
        }

        .visibility__icon {
          display: none;
        }
      }
    `,
  ];

  protected render() {
    const state = dungeonState.clientState.value;
    if (!state) return nothing;

    const rooms = dungeonState.rooms.value;
    const clearedCount = rooms.filter((r) => r.cleared).length;
    const totalRooms = rooms.length;
    const depthProgress = dungeonState.depthProgress.value;
    const maxDepth = Math.max(...rooms.map((r) => r.depth), 1);

    // Archetype-specific readouts
    const archState = dungeonState.archetypeState.value;
    const shadowState = isShadowState(archState) ? archState : null;
    const towerState = isTowerState(archState) ? archState : null;
    const visibility = shadowState?.visibility ?? null;
    const maxVisibility = shadowState?.max_visibility ?? null;
    const stability = towerState?.stability ?? null;
    const maxStability = towerState?.max_stability ?? null;

    return html`
      <div class="header" role="banner" aria-label=${msg('Dungeon status')}>
        <span class="archetype">${state.archetype}</span>
        <span class="sep"></span>

        <div class="depth">
          <span class="depth__label">${msg('Depth')} ${state.depth}/${maxDepth}</span>
          <div
            class="depth__track"
            role="progressbar"
            aria-valuenow=${state.depth}
            aria-valuemin=${0}
            aria-valuemax=${maxDepth}
            aria-label=${msg('Dungeon depth')}
          >
            <div class="depth__ticks">
              ${Array.from({ length: maxDepth }, () => html`<span class="depth__tick"></span>`)}
            </div>
            <div class="depth__danger"></div>
            <div class="depth__fill" style="transform: scaleX(${depthProgress})"></div>
          </div>
        </div>

        <span class="sep"></span>

        <div class="rooms">
          <span class="rooms__icon">${icons.doorOpen(12)}</span>
          <span>${clearedCount}/${totalRooms}</span>
        </div>

        ${visibility !== null && maxVisibility !== null
          ? html`
              <span class="sep"></span>
              <div
                class="visibility"
                aria-label=${msg('Visibility') + ` ${visibility}/${maxVisibility}`}
              >
                <span class="visibility__icon">${icons.eye(12)}</span>
                ${Array.from(
                  { length: maxVisibility },
                  (_, i) => html`
                    <span
                      class="visibility__pip ${i < visibility
                        ? 'visibility__pip--filled'
                        : ''}"
                    >
                      ${i < visibility ? icons.diamond(10) : icons.diamondEmpty(10)}
                    </span>
                  `,
                )}
              </div>
            `
          : nothing}
        ${stability !== null && maxStability !== null
          ? html`
              <span class="sep"></span>
              <div class="stability" aria-label=${msg('Stability') + ` ${stability}/${maxStability}`}>
                <span class="stability__icon">${icons.shield(12)}</span>
                <div
                  class="stability__track"
                  role="progressbar"
                  aria-valuenow=${stability}
                  aria-valuemin=${0}
                  aria-valuemax=${maxStability}
                  aria-label=${msg('Structural integrity')}
                >
                  <div
                    class="stability__fill ${stability <= 20
                      ? 'stability__fill--critical'
                      : stability <= 40
                        ? 'stability__fill--warning'
                        : ''}"
                    style="transform: scaleX(${maxStability > 0 ? stability / maxStability : 0})"
                  ></div>
                </div>
                <span class="stability__label">${stability}</span>
              </div>
            `
          : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-dungeon-header': VelgDungeonHeader;
  }
}
