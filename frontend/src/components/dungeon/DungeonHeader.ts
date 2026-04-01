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
import {
  ARCHETYPE_ENTROPY,
  ARCHETYPE_MOTHER,
  ARCHETYPE_PROMETHEUS,
  ARCHETYPE_DELUGE,
  ARCHETYPE_TOWER,
  isDelugeState,
  isEntropyState,
  isMotherState,
  isPrometheusState,
  isShadowState,
  isTowerState,
} from '../../types/dungeon.js';
import { getArchetypeDisplayName } from '../../utils/dungeon-formatters.js';
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
        color: var(--_archetype-color, var(--_phosphor));
        padding: 3px 10px;
        border: 1px solid color-mix(in srgb, var(--_archetype-color, var(--_phosphor)) 40%, transparent);
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
        width: 12px;
        height: 12px;
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

      .stability__label--collapse {
        color: var(--color-danger);
        font-weight: 700;
        letter-spacing: 0.1em;
      }

      @media (prefers-reduced-motion: no-preference) {
        .stability__label--collapse {
          animation: collapse-blink 1.5s steps(2, jump-none) infinite;
        }
      }

      @keyframes collapse-blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
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

      /* ── Decay Gauge (archetype-specific: Entropy) ── */
      .decay {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
      }

      .decay__icon {
        display: inline-flex;
        color: var(--_phosphor-dim);
      }

      .decay__label {
        font-size: 10px;
        letter-spacing: 0.05em;
        color: var(--_phosphor-dim);
      }

      .decay__track {
        position: relative;
        width: 60px;
        height: 8px;
        background: color-mix(in srgb, var(--_phosphor) 10%, transparent);
        border: 1px solid color-mix(in srgb, var(--_border) 50%, transparent);
      }

      .decay__fill {
        height: 100%;
        transform-origin: left;
        transition: transform 0.3s ease-out;
      }

      /* Green: 0-39 (normal) */
      .decay__fill--normal {
        background: var(--color-success, #4ade80);
      }

      /* Amber: 40-69 (degraded) */
      .decay__fill--degraded {
        background: var(--color-warning, #fb923c);
      }

      /* Red: 70-84 (critical) */
      .decay__fill--critical {
        background: var(--color-danger, #f87171);
      }

      /* Pulsing red: 85-99 (near-dissolution) */
      .decay__fill--dissolution {
        background: var(--color-danger, #f87171);
      }

      .decay__label--dissolution {
        color: var(--color-danger);
        font-weight: 700;
        letter-spacing: 0.1em;
      }

      @media (prefers-reduced-motion: no-preference) {
        .decay__fill--dissolution {
          animation: stability-pulse 2s ease-in-out infinite;
        }

        .decay__label--dissolution {
          animation: collapse-blink 1.5s steps(2, jump-none) infinite;
        }
      }

      /* ── Attachment Gauge (archetype-specific: Devouring Mother) ── */
      .attachment {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
      }

      .attachment__icon {
        display: inline-flex;
        color: var(--color-warning, #fb923c);
      }

      .attachment__label {
        font-size: 10px;
        letter-spacing: 0.05em;
        color: var(--_phosphor-dim);
      }

      .attachment__track {
        position: relative;
        width: 60px;
        height: 8px;
        background: color-mix(in srgb, var(--color-warning, #fb923c) 10%, transparent);
        border: 1px solid color-mix(in srgb, var(--_border) 50%, transparent);
      }

      .attachment__fill {
        height: 100%;
        transform-origin: left;
        transition: transform 0.3s ease-out;
      }

      /* Dim phosphor: 0-44 (normal — clinical observation) */
      .attachment__fill--normal {
        background: var(--_phosphor-dim);
      }

      /* Warm amber: 45-74 (dependent — comfort sets in) */
      .attachment__fill--dependent {
        background: var(--color-warning, #fb923c);
      }

      .attachment__label--dependent {
        color: var(--color-warning);
      }

      /* Rose-warm: 75-99 (critical — the dungeon breathes for you) */
      .attachment__fill--critical {
        background: color-mix(in srgb, var(--color-danger, #f87171) 70%, var(--color-warning, #fb923c));
      }

      .attachment__label--critical {
        color: color-mix(in srgb, var(--color-danger, #f87171) 70%, var(--color-warning, #fb923c));
        font-weight: 700;
      }

      /* Solid warm glow: 100 (incorporation — you are home) */
      .attachment__fill--incorporation {
        background: var(--color-danger, #f87171);
      }

      .attachment__label--incorporation {
        color: var(--color-danger, #f87171);
        font-weight: 700;
        letter-spacing: 0.1em;
      }

      @media (prefers-reduced-motion: no-preference) {
        /* Slow breathing pulse at critical — calming, not alarming */
        .attachment__fill--critical {
          animation: attachment-breathe 3s ease-in-out infinite;
        }

        .attachment__label--incorporation {
          animation: collapse-blink 1.5s steps(2, jump-none) infinite;
        }
      }

      @keyframes attachment-breathe {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.7;
        }
      }

      /* ── Insight Gauge (archetype-specific: Prometheus) ── */
      .insight {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
      }

      .insight__icon {
        display: inline-flex;
        color: var(--_phosphor-dim);
      }

      .insight__label {
        font-size: 10px;
        letter-spacing: 0.05em;
        color: var(--_phosphor-dim);
        min-width: 22px;
        text-align: right;
      }

      .insight__track {
        position: relative;
        width: 60px;
        height: 8px;
        background: color-mix(in srgb, var(--_phosphor) 10%, transparent);
        border: 1px solid color-mix(in srgb, var(--_border) 50%, transparent);
      }

      .insight__fill {
        height: 100%;
        transform-origin: left;
        transition: transform 0.3s ease-out, background 0.5s ease;
      }

      /* Cold Forge: 0-19 — dormant, blue-grey dim */
      .insight__fill--cold {
        background: color-mix(in srgb, var(--_phosphor-dim) 60%, var(--color-info, #60a5fa));
      }

      /* Warming: 20-44 — standard amber phosphor */
      .insight__fill--warming {
        background: var(--_phosphor);
      }

      /* Inspired: 45-74 — warm orange-gold */
      .insight__fill--inspired {
        background: var(--color-warning, #fb923c);
      }

      /* Feverish: 75-99 — hot orange-red with glow */
      .insight__fill--feverish {
        background: color-mix(in srgb, var(--color-danger, #f87171) 50%, var(--color-warning, #fb923c));
      }

      .insight__label--feverish {
        color: color-mix(in srgb, var(--color-danger) 50%, var(--color-warning));
        font-weight: 700;
      }

      /* Breakthrough: 100 — white-hot, dramatic */
      .insight__fill--breakthrough {
        background: color-mix(in srgb, var(--color-danger, #f87171) 30%, var(--color-warning, #fbbf24));
      }

      .insight__label--breakthrough {
        color: var(--color-danger);
        font-weight: 700;
        letter-spacing: 0.1em;
      }

      /* Component and crafted item badges */
      .insight__badge {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        font-size: 10px;
        letter-spacing: 0.05em;
        color: var(--_phosphor-dim);
        padding: 1px 5px;
        border: 1px solid color-mix(in srgb, var(--_border) 40%, transparent);
      }

      .insight__badge--crafted {
        color: var(--color-warning, #fb923c);
        border-color: color-mix(in srgb, var(--color-warning) 30%, transparent);
      }

      @media (prefers-reduced-motion: no-preference) {
        .insight__fill--feverish {
          animation: forge-pulse 2s ease-in-out infinite;
        }

        .insight__fill--breakthrough {
          animation: forge-blaze 1.2s ease-in-out infinite;
        }

        .insight__label--breakthrough {
          animation: collapse-blink 1.5s steps(2, jump-none) infinite;
        }
      }

      @keyframes forge-pulse {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.7;
        }
      }

      @keyframes forge-blaze {
        0%,
        100% {
          opacity: 1;
          filter: brightness(1);
        }
        50% {
          opacity: 0.85;
          filter: brightness(1.3);
        }
      }

      /* ── Water Level Gauge (archetype-specific: Deluge) ── */
      .water {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
      }

      .water__icon {
        display: inline-flex;
        color: var(--color-info, #60a5fa);
      }

      .water__label {
        font-size: 10px;
        letter-spacing: 0.05em;
        color: var(--color-info, #60a5fa);
        min-width: 22px;
        text-align: right;
      }

      .water__track {
        position: relative;
        width: 60px;
        height: 8px;
        background: color-mix(in srgb, var(--color-info, #60a5fa) 10%, transparent);
        border: 1px solid color-mix(in srgb, var(--_border) 50%, transparent);
      }

      .water__fill {
        height: 100%;
        transform-origin: left;
        transition: transform 0.3s ease-out, background 0.5s ease;
      }

      /* Dry: 0-24 — dim blue, the water is a fact, not yet a threat */
      .water__fill--dry {
        background: color-mix(in srgb, var(--color-info, #60a5fa) 40%, var(--_phosphor-dim));
      }

      /* Shallow: 25-49 — blue, the water speaks */
      .water__fill--shallow {
        background: var(--color-info, #60a5fa);
      }

      /* Rising: 50-74 — blue-amber, the water insists */
      .water__fill--rising {
        background: color-mix(in srgb, var(--color-info, #60a5fa) 50%, var(--color-warning, #fb923c));
      }

      /* Critical: 75-99 — blue-red, the water is correct */
      .water__fill--critical {
        background: color-mix(in srgb, var(--color-info, #60a5fa) 30%, var(--color-danger, #f87171));
      }

      .water__label--critical {
        color: color-mix(in srgb, var(--color-info) 30%, var(--color-danger));
        font-weight: 700;
      }

      /* Submerged: 100 — danger red, pulsing */
      .water__fill--submerged {
        background: var(--color-danger, #f87171);
      }

      .water__label--submerged {
        color: var(--color-danger);
        font-weight: 700;
        letter-spacing: 0.1em;
      }

      /* Tidal recession badge */
      .water__tide {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        font-size: 10px;
        letter-spacing: 0.05em;
        color: var(--_phosphor-dim);
        padding: 1px 5px;
        border: 1px solid color-mix(in srgb, var(--_border) 40%, transparent);
      }

      @media (prefers-reduced-motion: no-preference) {
        .water__fill--critical {
          animation: water-surge 2s ease-in-out infinite;
        }

        .water__fill--submerged {
          animation: water-drown 1.2s ease-in-out infinite;
        }

        .water__label--submerged {
          animation: collapse-blink 1.5s steps(2, jump-none) infinite;
        }
      }

      @keyframes water-surge {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.65;
        }
      }

      @keyframes water-drown {
        0%,
        100% {
          opacity: 1;
          filter: brightness(1);
        }
        50% {
          opacity: 0.8;
          filter: brightness(1.3);
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

    const isTower = state.archetype === ARCHETYPE_TOWER;
    const isEntropy = state.archetype === ARCHETYPE_ENTROPY;
    const isMother = state.archetype === ARCHETYPE_MOTHER;
    const isPrometheus = state.archetype === ARCHETYPE_PROMETHEUS;
    const isDeluge = state.archetype === ARCHETYPE_DELUGE;
    const archetypeColor = isTower
      ? 'var(--color-warning, #fb923c)'
      : isEntropy
        ? 'var(--color-success, #4ade80)'
        : isMother
          ? 'color-mix(in srgb, var(--color-warning, #fb923c) 80%, var(--color-danger, #f87171))'
          : isPrometheus
            ? 'color-mix(in srgb, var(--color-warning, #fb923c) 60%, var(--color-danger, #f87171))'
            : isDeluge
              ? 'var(--color-info, #60a5fa)'
              : 'var(--color-info, #a78bfa)';

    const rooms = dungeonState.rooms.value;
    const clearedCount = rooms.filter((r) => r.cleared).length;
    const depthProgress = dungeonState.depthProgress.value;
    const maxDepth = Math.max(...rooms.map((r) => r.depth), 1);

    // Archetype-specific readouts
    const archState = dungeonState.archetypeState.value;
    const shadowState = isShadowState(archState) ? archState : null;
    const towerState = isTowerState(archState) ? archState : null;
    const entropyState = isEntropyState(archState) ? archState : null;
    const motherState = isMotherState(archState) ? archState : null;
    const prometheusState = isPrometheusState(archState) ? archState : null;
    const delugeState = isDelugeState(archState) ? archState : null;
    const visibility = shadowState?.visibility ?? null;
    const maxVisibility = shadowState?.max_visibility ?? null;
    const stability = towerState?.stability ?? null;
    const maxStability = towerState?.max_stability ?? null;
    const decay = entropyState?.decay ?? null;
    const maxDecay = entropyState?.max_decay ?? null;
    const attachment = motherState?.attachment ?? null;
    const maxAttachment = motherState?.max_attachment ?? null;
    const insight = prometheusState?.insight ?? null;
    const maxInsight = prometheusState?.max_insight ?? null;
    const componentCount = prometheusState?.components?.length ?? 0;
    const craftedCount = prometheusState?.crafted_items?.length ?? 0;
    const waterLevel = delugeState?.water_level ?? null;
    const maxWater = delugeState?.max_water_level ?? null;
    const roomsEntered = delugeState?.rooms_entered ?? 0;
    const recessionIn = roomsEntered > 0 ? 3 - (roomsEntered % 3) : 3;

    return html`
      <div class="header" role="banner" aria-label=${msg('Dungeon status')}>
        <span class="archetype" style="--_archetype-color: ${archetypeColor}">${getArchetypeDisplayName(state.archetype)}</span>
        <span class="sep"></span>

        <div class="depth">
          <span class="depth__label">D${state.depth}/${maxDepth}</span>
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
          <span>${clearedCount} ${msg('visited')}</span>
        </div>

        ${
          visibility !== null && maxVisibility !== null
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
                      class="visibility__pip ${i < visibility ? 'visibility__pip--filled' : ''}"
                    >
                      ${i < visibility ? icons.diamond(10) : icons.diamondEmpty(10)}
                    </span>
                  `,
                )}
              </div>
            `
            : nothing
        }
        ${
          stability !== null && maxStability !== null
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
                    class="stability__fill ${
                      stability <= 20
                        ? 'stability__fill--critical'
                        : stability <= 40
                          ? 'stability__fill--warning'
                          : ''
                    }"
                    style="transform: scaleX(${maxStability > 0 ? stability / maxStability : 0})"
                  ></div>
                </div>
                <span class="stability__label ${stability <= 0 ? 'stability__label--collapse' : ''}">${stability <= 0 ? msg('FAILURE') : stability}</span>
              </div>
            `
            : nothing
        }
        ${
          decay !== null && maxDecay !== null
            ? html`
              <span class="sep"></span>
              <div class="decay" aria-label=${msg('Decay') + ` ${decay}/${maxDecay}`}>
                <span class="decay__icon">${icons.alertTriangle(12)}</span>
                <div
                  class="decay__track"
                  role="progressbar"
                  aria-valuenow=${decay}
                  aria-valuemin=${0}
                  aria-valuemax=${maxDecay}
                  aria-label=${msg('Dissolution index')}
                >
                  <div
                    class="decay__fill ${
                      decay >= 85
                        ? 'decay__fill--dissolution'
                        : decay >= 70
                          ? 'decay__fill--critical'
                          : decay >= 40
                            ? 'decay__fill--degraded'
                            : 'decay__fill--normal'
                    }"
                    style="transform: scaleX(${maxDecay > 0 ? decay / maxDecay : 0})"
                  ></div>
                </div>
                <span class="decay__label ${decay >= 100 ? 'decay__label--dissolution' : ''}">${decay >= 100 ? msg('DISSOLUTION') : decay}</span>
              </div>
            `
            : nothing
        }
        ${
          attachment !== null && maxAttachment !== null
            ? html`
              <span class="sep"></span>
              <div class="attachment" aria-label=${msg('Attachment') + ` ${attachment}/${maxAttachment}`}>
                <span class="attachment__icon">${icons.heartbeat(12)}</span>
                <div
                  class="attachment__track"
                  role="progressbar"
                  aria-valuenow=${attachment}
                  aria-valuemin=${0}
                  aria-valuemax=${maxAttachment}
                  aria-label=${msg('Parasitic attachment')}
                >
                  <div
                    class="attachment__fill ${
                      attachment >= 100
                        ? 'attachment__fill--incorporation'
                        : attachment >= 75
                          ? 'attachment__fill--critical'
                          : attachment >= 45
                            ? 'attachment__fill--dependent'
                            : 'attachment__fill--normal'
                    }"
                    style="transform: scaleX(${maxAttachment > 0 ? attachment / maxAttachment : 0})"
                  ></div>
                </div>
                <span class="attachment__label ${
                  attachment >= 100
                    ? 'attachment__label--incorporation'
                    : attachment >= 75
                      ? 'attachment__label--critical'
                      : attachment >= 45
                        ? 'attachment__label--dependent'
                        : ''
                }">${attachment >= 100 ? msg('HOME') : attachment}</span>
              </div>
            `
            : nothing
        }
        ${
          insight !== null && maxInsight !== null
            ? html`
              <span class="sep"></span>
              <div class="insight" aria-label=${msg('Insight') + ` ${insight}/${maxInsight}`}>
                <span class="insight__icon">${icons.bolt(12)}</span>
                <div
                  class="insight__track"
                  role="progressbar"
                  aria-valuenow=${insight}
                  aria-valuemin=${0}
                  aria-valuemax=${maxInsight}
                  aria-label=${msg('Creative insight')}
                >
                  <div
                    class="insight__fill ${
                      insight >= 100
                        ? 'insight__fill--breakthrough'
                        : insight >= 75
                          ? 'insight__fill--feverish'
                          : insight >= 45
                            ? 'insight__fill--inspired'
                            : insight >= 20
                              ? 'insight__fill--warming'
                              : 'insight__fill--cold'
                    }"
                    style="transform: scaleX(${maxInsight > 0 ? insight / maxInsight : 0})"
                  ></div>
                </div>
                <span class="insight__label ${
                  insight >= 100
                    ? 'insight__label--breakthrough'
                    : insight >= 75
                      ? 'insight__label--feverish'
                      : ''
                }">${insight >= 100 ? msg('FIRE') : insight}</span>
              </div>
              ${
                componentCount > 0
                  ? html`
                    <span class="insight__badge" aria-label=${msg('Components') + ` ${componentCount}`}>
                      ${icons.sparkle(10)}${componentCount}
                    </span>
                  `
                  : nothing
              }
              ${
                craftedCount > 0
                  ? html`
                    <span class="insight__badge insight__badge--crafted" aria-label=${msg('Crafted items') + ` ${craftedCount}`}>
                      ${icons.archetypePrometheus(10)}${craftedCount}
                    </span>
                  `
                  : nothing
              }
            `
            : nothing
        }
        ${
          waterLevel !== null && maxWater !== null
            ? html`
              <span class="sep"></span>
              <div class="water" aria-label=${msg('Water level') + ` ${waterLevel}/${maxWater}`}>
                <span class="water__icon">${icons.droplet(12)}</span>
                <div
                  class="water__track"
                  role="progressbar"
                  aria-valuenow=${waterLevel}
                  aria-valuemin=${0}
                  aria-valuemax=${maxWater}
                  aria-label=${msg('Rising water')}
                >
                  <div
                    class="water__fill ${
                      waterLevel >= 100
                        ? 'water__fill--submerged'
                        : waterLevel >= 75
                          ? 'water__fill--critical'
                          : waterLevel >= 50
                            ? 'water__fill--rising'
                            : waterLevel >= 25
                              ? 'water__fill--shallow'
                              : 'water__fill--dry'
                    }"
                    style="transform: scaleX(${maxWater > 0 ? waterLevel / maxWater : 0})"
                  ></div>
                </div>
                <span class="water__label ${
                  waterLevel >= 100
                    ? 'water__label--submerged'
                    : waterLevel >= 75
                      ? 'water__label--critical'
                      : ''
                }">${waterLevel >= 100 ? msg('FLOOD') : waterLevel}</span>
              </div>
              <span class="water__tide" aria-label=${msg('Tidal recession') + ` ${recessionIn}`}>
                ${recessionIn === 3 ? msg('Tide') : `${recessionIn}`}
              </span>
            `
            : nothing
        }
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-dungeon-header': VelgDungeonHeader;
  }
}
