/**
 * Dungeon Graphical View — the graphical rendering of a Resonance Dungeon,
 * running in parallel to the terminal HUD (Phase 1 of the rollout).
 *
 * Core idea: "the archetype meter IS the environment". The single
 * server-authoritative resource meter is normalized by the pure resolver
 * (utils/dungeon-environment.ts) into one pressure signal that drives a
 * CSS scene backdrop — rising water, closing darkness, structural collapse,
 * decay, ember heat, fragmentation, deja-vu flicker, parasitic pulse.
 *
 * This view is a SECOND CONSUMER of dungeonState. Zero game logic lives here:
 *   - reads dungeonState signals (server-authoritative)
 *   - embeds the existing HUD components VERBATIM (header / party / map /
 *     quick-actions / combat-bar / enemy-panel) as overlays — they are
 *     self-contained SignalWatchers
 *   - routes their 'terminal-command' events through the same command
 *     pipeline as the terminal view (parseAndExecute)
 *
 * The combat juice (PixiJS) and generated enemy/backdrop imagery arrive in
 * Phases 2–3. The scene backdrop here is pure CSS (no canvas yet), so the
 * light-DOM/Pixi host is deferred to a dedicated child component in Phase 2.
 *
 * Lifecycle mirrors DungeonTerminalView: it must init terminal state + zones
 * and run recovery itself, because a persisted 'graphical' preference can mount
 * this view first without the terminal view ever mounting.
 *
 * Loaded via dynamic import() from <velg-dungeon-view> (code-split).
 *
 * Pattern: DungeonTerminalView.ts (SignalWatcher, forced-dark, command routing).
 */

import { localized, msg } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import { appState } from '../../../services/AppStateManager.js';
import { dungeonState } from '../../../services/DungeonStateManager.js';
import { captureError } from '../../../services/SentryService.js';
import { terminalState } from '../../../services/TerminalStateManager.js';
import type {
  AgentCombatStateClient,
  AvailableDungeonResponse,
  Condition,
  DungeonRunCreate,
} from '../../../types/dungeon.js';
import type { Agent, AptitudeSet } from '../../../types/index.js';
import { dungeonBackdropUrl } from '../../../utils/dungeon-backdrop-data.js';
import {
  autoPickPartyIds,
  checkPartyComposition,
  partyCompositionWarningText,
  startDungeonRun,
} from '../../../utils/dungeon-entry-flow.js';
import { type FxProfile, resolveDungeonEnvironment } from '../../../utils/dungeon-environment.js';
import { getArchetypeDisplayName, topAptitudes } from '../../../utils/dungeon-formatters.js';
import { icons } from '../../../utils/icons.js';
import { OPERATIVE_LABEL } from '../../../utils/operative-constants.js';
import { parseAndExecute } from '../../../utils/terminal-commands.js';
import { initializeTerminalZones } from '../../../utils/terminal-initialization.js';
import { getInitials } from '../../../utils/text.js';
import { VelgToast } from '../../shared/Toast.js';
import '../../shared/EmptyState.js';
import '../../shared/LoadingState.js';
import '../../shared/VelgAvatar.js';
import {
  terminalAnimations,
  terminalComponentTokens,
  terminalTokens,
} from '../../shared/terminal-theme-styles.js';
import '../DungeonCombatBar.js';
import '../DungeonEnemyPanel.js';
import '../DungeonHeader.js';
import '../DungeonMap.js';
import '../DungeonPartyPanel.js';
import '../DungeonQuickActions.js';
import './DungeonCombatFx.js';

/** localStorage key for the map-rail collapsed preference (client-only UI
 *  state, like the view-mode key — never reset by applyState()/clear()). */
const RAIL_COLLAPSED_STORAGE_KEY = 'dungeon_map_rail_collapsed';

/** Localized meter labels per fx profile (resolver returns no user strings). */
function meterLabelFor(fx: FxProfile): string {
  switch (fx) {
    case 'water':
      return msg('Water Level');
    case 'darkness':
      // The readout bar fills with PRESSURE (full = worst). For The Shadow,
      // pressure rises as visibility drains, so the rising bar is the encroaching
      // gloom, not visibility itself — labelling it "Visibility" would read backwards
      // (empty bar at full sight). Name the threat that rises.
      return msg('Gloom');
    case 'decay':
      return msg('Decay');
    case 'tilt':
      // Same inversion as darkness: The Tower's pressure rises as stability is lost,
      // so the rising bar is structural instability, not stability.
      return msg('Instability');
    case 'pulse':
      return msg('Attachment');
    case 'forge':
      return msg('Insight');
    case 'shards':
      return msg('Fracture');
    case 'flicker':
      return msg('Awareness');
    default:
      return msg('Resonance');
  }
}

@localized()
@customElement('velg-dungeon-graphical-view')
export class VelgDungeonGraphicalView extends SignalWatcher(LitElement) {
  static styles = [
    terminalTokens,
    terminalComponentTokens,
    terminalAnimations,
    css`
      :host {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: calc(100vh - var(--header-height, 64px) - var(--sim-nav-height, 48px));
        min-height: 400px;
        padding: 0 16px 16px;
        box-sizing: border-box;

        /* Force platform-dark tokens regardless of simulation theme — same
           rationale as DungeonTerminalView: sim themes (e.g. Velgarien
           brutalist) override --color-surface to white and break contrast. */
        --color-surface: #0a0a0a; /* lint-color-ok */
        --color-surface-raised: #111111; /* lint-color-ok */
        --color-text-primary: #e5e5e5; /* lint-color-ok */
        --color-text-secondary: #a0a0a0; /* lint-color-ok */
        --color-text-muted: #888888; /* lint-color-ok */
        --color-border: #333333; /* lint-color-ok */
        background: var(--color-surface);
        font-family: var(--_mono);
        color: var(--_phosphor-dim);
      }

      .gview-error,
      .gview-loading {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: var(--_mono);
        font-size: 12px;
        color: var(--_phosphor-dim);
        letter-spacing: 1px;
      }
      .gview-error {
        color: var(--color-danger);
      }

      /* ── HUD grid — [ map rail | scene | party ].
         The map is the primary navigation surface, so it lives in a persistent
         left rail at its native ~320px width (the same sidebar mode the terminal
         view uses) instead of a modal that over-scaled it 2× and hid the current
         room below the fold. ── */
      .dungeon-hud {
        display: grid;
        grid-template-rows: auto 1fr auto;
        grid-template-columns: 320px 1fr 280px;
        flex: 1;
        min-height: 0;
        gap: 0;
      }
      .dungeon-hud--rail-collapsed {
        grid-template-columns: 40px 1fr 280px;
      }
      .dungeon-hud__header {
        grid-column: 1 / -1;
        grid-row: 1;
      }
      .dungeon-hud__rail {
        grid-column: 1;
        grid-row: 2;
        display: flex;
        flex-direction: column;
        min-height: 0;
        overflow: hidden;
        border-right: 1px dashed color-mix(in srgb, var(--_border) 40%, transparent);
        background: var(--color-surface);
      }
      .dungeon-hud__main {
        grid-column: 2;
        grid-row: 2;
        display: flex;
        flex-direction: column;
        min-height: 0;
      }
      .dungeon-hud__party {
        grid-column: 3;
        grid-row: 2;
        overflow-y: auto;
        border-left: 1px dashed color-mix(in srgb, var(--_border) 40%, transparent);
        padding: 8px;
        font-family: var(--_mono);
        font-size: 10px;
        color: var(--_phosphor-dim);
        background: var(--color-surface);
      }
      .dungeon-hud__actions {
        grid-column: 1 / -1;
        grid-row: 3;
        position: relative;
        z-index: 21;
      }

      /* ── Map rail internals ── */
      /* Override the map component's own :host{flex-shrink:0} so it fills the
         rail and scrolls internally (its .map-content has overflow-y:auto). */
      .dungeon-hud__rail velg-dungeon-map {
        flex: 1 1 0;
        min-height: 0;
        overflow-y: auto;
        overflow-x: hidden;
        /* Keep rail scrolling self-contained — don't bubble to the page once the
           map reaches its scroll limit (the document is slightly scrollable). */
        overscroll-behavior: contain;
      }
      .rail-header {
        flex: none;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        padding: 5px 6px;
        border-bottom: 1px dashed color-mix(in srgb, var(--_border) 40%, transparent);
      }
      .rail-collapse-btn,
      .rail-expand-btn {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 3px 6px;
        border: 1px solid color-mix(in srgb, var(--_phosphor) 35%, transparent);
        background: color-mix(in srgb, var(--_screen-bg) 85%, transparent);
        color: var(--_phosphor-dim);
        font-family: var(--font-brutalist, var(--_mono));
        font-size: 9px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        cursor: pointer;
        transition:
          color var(--transition-fast, 100ms ease),
          border-color var(--transition-fast, 100ms ease);
      }
      .rail-collapse-btn:hover,
      .rail-expand-btn:hover {
        color: var(--_phosphor);
        border-color: var(--_phosphor);
      }
      .rail-collapse-btn:focus-visible,
      .rail-expand-btn:focus-visible {
        outline: 2px solid var(--_phosphor);
        outline-offset: 2px;
      }
      .rail-collapse-btn__icon {
        display: flex;
        /* chevronRight → left (collapse toward the edge). */
        transform: rotate(180deg);
      }

      /* Collapsed: a thin vertical strip with a single "open map" control. */
      .rail-strip {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 8px 0;
      }
      .rail-expand-btn--vertical {
        flex-direction: column;
        gap: 8px;
        padding: 8px 4px;
        writing-mode: vertical-rl;
      }
      .rail-expand-btn--vertical .rail-expand-btn__map {
        writing-mode: horizontal-tb;
      }

      @media (max-width: 1199px) {
        .dungeon-hud,
        .dungeon-hud--rail-collapsed {
          grid-template-columns: 1fr;
        }
        .dungeon-hud__header {
          grid-column: 1;
          grid-row: 1;
        }
        .dungeon-hud__main {
          grid-column: 1;
          grid-row: 2;
        }
        .dungeon-hud__party {
          grid-column: 1;
          grid-row: 3;
          max-height: 96px;
          border-left: none;
          border-top: 1px dashed color-mix(in srgb, var(--_border) 40%, transparent);
          overflow-x: auto;
          overflow-y: hidden;
        }
        .dungeon-hud__rail {
          grid-column: 1;
          grid-row: 4;
          border-right: none;
          border-top: 1px dashed color-mix(in srgb, var(--_border) 40%, transparent);
          height: clamp(200px, 38vh, 340px);
        }
        .dungeon-hud--rail-collapsed .dungeon-hud__rail {
          height: auto;
        }
        .dungeon-hud__actions {
          grid-column: 1;
          grid-row: 5;
        }
      }

      /* ── Scene (the stage). NO filter/transform here — that would create a
         containing block and break embedded position:fixed panels. All
         environment FX live on the .scene__backdrop LEAF and its children. ── */
      .scene {
        position: relative;
        flex: 1;
        min-height: 220px;
        overflow: hidden;
        border: 1px solid color-mix(in srgb, var(--_border) 50%, transparent);
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        --_p: var(--_pressure, 0);
      }

      /* Establishing-art layer: a full-bleed room image behind the FX, so the
         stage reads as a real chamber (the prototype's proven look). Dimmed +
         scrimmed so the environment FX, readout, banter and party still read.
         Filter on the <img> leaf only (no fixed descendants → no containing-block
         hazard for the embedded panels). Falls back to the CSS chamber on error. */
      .scene__art {
        position: absolute;
        inset: 0;
        z-index: 0;
        pointer-events: none;
        overflow: hidden;
      }
      .scene__art-img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
        /* Dim at rest, dimmer + desaturated as pressure rises (foreboding). */
        filter: brightness(calc(0.6 - var(--_p) * 0.24)) saturate(calc(0.9 - var(--_p) * 0.35))
          contrast(1.03);
        transition: filter 600ms var(--ease-out, ease);
      }
      /* Scrim: vignette enclosure + top/bottom darkening for text legibility. */
      .scene__art::after {
        content: '';
        position: absolute;
        inset: 0;
        background:
          radial-gradient(
            125% 95% at 50% 32%,
            transparent 38%,
            color-mix(in srgb, var(--color-surface) 78%, transparent) 100%
          ),
          linear-gradient(
            to bottom,
            color-mix(in srgb, var(--color-surface) 50%, transparent) 0%,
            transparent 26%,
            transparent 60%,
            color-mix(in srgb, var(--color-surface) 82%, transparent) 100%
          );
      }

      /* Backdrop leaf: safe place for filter/transform (no fixed children).
         This is the always-on CHAMBER: an overhead light pool, a faintly
         structured back wall lit near the top, settling to surface mid-height
         and warming toward the floor. It must read as a dim room at rest (no
         pressure) — the pressure treatment plane intensifies ON TOP of it. */
      .scene__backdrop {
        position: absolute;
        inset: 0;
        z-index: 0;
        pointer-events: none;
        background:
          radial-gradient(
            74% 58% at 50% -10%,
            color-mix(in srgb, var(--_fx-accent) calc(16% + var(--_p) * 22%), transparent),
            transparent 60%
          ),
          repeating-linear-gradient(
            to right,
            transparent 0 76px,
            color-mix(in srgb, var(--_fx-accent) 5%, transparent) 76px 77px
          ),
          linear-gradient(
            to bottom,
            color-mix(in srgb, var(--color-surface) 76%, var(--_fx-accent)) 0%,
            var(--color-surface) 52%,
            color-mix(in srgb, var(--color-surface) 86%, var(--_fx-accent)) 100%
          );
        transition: background 600ms var(--ease-out, ease);
      }

      /* Scanline texture (always on, faint). */
      .scene__backdrop::before {
        content: '';
        position: absolute;
        inset: 0;
        background: repeating-linear-gradient(
          to bottom,
          transparent 0,
          transparent 2px,
          color-mix(in srgb, var(--color-surface) 60%, transparent) 3px
        );
        opacity: 0.35;
        mix-blend-mode: multiply;
      }

      /* Pressure plane: a treatment layer parameterized by data-fx. */
      .scene__plane {
        position: absolute;
        inset: 0;
        z-index: 1;
        pointer-events: none;
      }

      /* WATER — rising tide from the bottom, height = pressure. */
      .scene__backdrop[data-fx='water'] .scene__plane {
        top: auto;
        height: calc(var(--_p) * 100%);
        background: linear-gradient(
          to bottom,
          color-mix(in srgb, var(--color-info) 22%, transparent),
          color-mix(in srgb, var(--color-info) 55%, transparent)
        );
        border-top: 1px solid color-mix(in srgb, var(--color-info) 60%, transparent);
        animation: tide 6s var(--ease-in-out, ease-in-out) infinite;
      }

      /* DARKNESS — closing inset vignette; radius shrinks with pressure. */
      .scene__backdrop[data-fx='darkness'] .scene__plane {
        background: radial-gradient(
          circle at 50% 45%,
          transparent calc((1 - var(--_p)) * 55%),
          color-mix(in srgb, var(--color-surface) 96%, black) calc((1 - var(--_p)) * 60% + 30%)
        );
      }

      /* DECAY — grain wash; opacity scales with pressure. */
      .scene__backdrop[data-fx='decay'] .scene__plane {
        opacity: calc(0.2 + var(--_p) * 0.6);
        background: repeating-conic-gradient(
          from 0deg,
          color-mix(in srgb, var(--color-success) 10%, transparent) 0deg 2deg,
          transparent 2deg 4deg
        );
        mix-blend-mode: overlay;
        animation: grain 1.4s steps(3) infinite;
      }

      /* TILT — structural lean + crack; intensity scales with pressure. */
      .scene__backdrop[data-fx='tilt'] .scene__plane {
        background: linear-gradient(
          calc(90deg + var(--_p) * 6deg),
          transparent 48%,
          color-mix(in srgb, var(--color-warning) 40%, transparent) 49.5%,
          color-mix(in srgb, var(--color-warning) 40%, transparent) 50.5%,
          transparent 52%
        );
        /* Fade the structural crack in quadratically: invisible at rest (a sound
           tower shows no fracture), ramping to full at collapse. Keeps the
           low-pressure scene clean instead of a lone crack on a void. */
        opacity: calc(var(--_p) * var(--_p));
      }

      /* PULSE — parasitic breathing radial; faster + stronger with pressure. */
      .scene__backdrop[data-fx='pulse'] .scene__plane {
        background: radial-gradient(
          circle at 50% 60%,
          color-mix(in srgb, var(--color-danger) calc(10% + var(--_p) * 30%), transparent),
          transparent 65%
        );
        animation: breathe calc(4s - var(--_p) * 2s) var(--ease-in-out, ease-in-out) infinite;
      }

      /* FORGE — ember heat from below; hotter with pressure. */
      .scene__backdrop[data-fx='forge'] .scene__plane {
        background: radial-gradient(
          120% 70% at 50% 100%,
          color-mix(in srgb, var(--color-warning) calc(20% + var(--_p) * 40%), transparent),
          transparent 60%
        );
        animation: shimmer 3s var(--ease-in-out, ease-in-out) infinite;
      }

      /* SHARDS — mirror-shard fragments; more with pressure. */
      .scene__backdrop[data-fx='shards'] .scene__plane {
        background: repeating-conic-gradient(
          from calc(var(--_p) * 45deg) at 50% 40%,
          color-mix(in srgb, var(--color-warning) 18%, transparent) 0deg 10deg,
          transparent 10deg 22deg
        );
        opacity: calc(0.25 + var(--_p) * 0.6);
      }

      /* FLICKER — deja-vu double exposure; flickers harder with pressure. */
      .scene__backdrop[data-fx='flicker'] .scene__plane {
        background: linear-gradient(
          0deg,
          color-mix(in srgb, var(--color-info) 18%, transparent),
          transparent 40%
        );
        opacity: calc(0.2 + var(--_p) * 0.5);
        animation: flicker calc(2.4s - var(--_p) * 1.4s) steps(2) infinite;
      }

      .scene__backdrop[data-fx='neutral'] .scene__plane {
        background: radial-gradient(
          circle at 50% 40%,
          color-mix(in srgb, var(--_fx-accent) 12%, transparent),
          transparent 70%
        );
      }

      /* ── Persistent ambient (pressure-independent) ──
         The stage must never read as an empty void. Floor + horizon + drifting
         motes are always present; the pressure treatments wash OVER them. */

      /* Floor: a chamber ground receding to a faintly lit horizon. */
      .scene__floor {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        height: 46%;
        z-index: 1;
        pointer-events: none;
        background: linear-gradient(
          to bottom,
          transparent 0%,
          color-mix(in srgb, var(--color-surface) 86%, var(--_fx-accent)) 55%,
          color-mix(in srgb, var(--color-surface) 70%, var(--_fx-accent)) 100%
        );
      }
      /* Horizon line: a thin accent rule with a soft glow, brighter under pressure. */
      .scene__floor::before {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        top: 0;
        height: 1px;
        background: color-mix(in srgb, var(--_fx-accent) 55%, transparent);
        box-shadow: 0 0 18px 2px color-mix(in srgb, var(--_fx-accent) 28%, transparent);
        opacity: calc(0.28 + var(--_p) * 0.5);
      }
      /* Receding floor banding — implies depth without a transform. */
      .scene__floor::after {
        content: '';
        position: absolute;
        inset: 0;
        background: repeating-linear-gradient(
          to bottom,
          transparent 0 17px,
          color-mix(in srgb, var(--_fx-accent) 9%, transparent) 17px 18px
        );
        -webkit-mask-image: linear-gradient(to bottom, transparent, black 80%);
        mask-image: linear-gradient(to bottom, transparent, black 80%);
        opacity: 0.55;
      }

      /* Drifting dust motes — a handful of soft points, slow vertical current. */
      .scene__motes {
        position: absolute;
        inset: 0;
        z-index: 1;
        pointer-events: none;
        opacity: 0.5;
        background-image:
          radial-gradient(
            2px 2px at 18% 32%,
            color-mix(in srgb, var(--_fx-accent) 45%, transparent),
            transparent
          ),
          radial-gradient(
            1.5px 1.5px at 64% 22%,
            color-mix(in srgb, var(--_fx-accent) 35%, transparent),
            transparent
          ),
          radial-gradient(
            1.5px 1.5px at 82% 58%,
            color-mix(in srgb, var(--_fx-accent) 40%, transparent),
            transparent
          ),
          radial-gradient(
            2px 2px at 42% 70%,
            color-mix(in srgb, var(--_fx-accent) 30%, transparent),
            transparent
          ),
          radial-gradient(
            1px 1px at 30% 52%,
            color-mix(in srgb, var(--_fx-accent) 35%, transparent),
            transparent
          );
        animation: motes-drift 22s linear infinite;
      }

      /* In-scene party presence — the operatives stand in the chamber as
         luminous standees: an identity disc (monogram or portrait) atop a
         tapering column of condition-tinted light (the silhouette), grounded by
         a floor light-pool + contact shadow. Reads as a figure standing in the
         room, not a UI chip pasted on the backdrop. */
      .scene__party {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 21%;
        z-index: 2;
        pointer-events: none;
        display: flex;
        justify-content: center;
        align-items: flex-end;
        gap: clamp(16px, 5vw, 52px);
        padding: 0 16px;
      }
      .op {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 9px;
        animation: token-rise var(--duration-entrance, 350ms) var(--ease-dramatic, ease) both;
        animation-delay: calc(var(--i, 0) * 90ms);
      }
      .op__figure {
        position: relative;
        display: flex;
        justify-content: center;
        width: clamp(44px, 5vw, 60px);
        animation: token-bob 4.6s var(--ease-in-out, ease-in-out) infinite;
        animation-delay: calc(var(--i, 0) * -800ms);
      }
      /* Tapering column of light beneath the disc — the operative's silhouette. */
      .op__beam {
        position: absolute;
        bottom: -3px;
        left: 50%;
        transform: translateX(-50%);
        width: 62%;
        height: clamp(52px, 7vw, 76px);
        background: linear-gradient(
          to top,
          color-mix(in srgb, var(--_cond) 34%, transparent),
          color-mix(in srgb, var(--_cond) 7%, transparent) 58%,
          transparent
        );
        clip-path: polygon(26% 100%, 74% 100%, 60% 0, 40% 0);
      }
      /* Identity disc — monogram or portrait, condition-haloed. */
      .op__disc {
        position: relative;
        z-index: 1;
        width: 100%;
        aspect-ratio: 1;
        border-radius: 50%;
        display: grid;
        place-items: center;
        overflow: hidden;
        background: radial-gradient(
          circle at 50% 36%,
          color-mix(in srgb, var(--_cond) 28%, var(--color-surface-raised)),
          color-mix(in srgb, var(--color-surface) 86%, var(--_cond))
        );
        box-shadow:
          0 0 15px color-mix(in srgb, var(--_cond) 42%, transparent),
          inset 0 0 0 1px color-mix(in srgb, var(--_cond) 60%, transparent);
      }
      .op__mono {
        font-family: var(--font-brutalist, var(--_mono));
        font-weight: 700;
        font-size: clamp(13px, 1.7vw, 18px);
        letter-spacing: 0.5px;
        color: color-mix(in srgb, var(--_cond) 50%, var(--color-text-primary));
      }
      .op__disc img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      /* Floor light-pool grounding the figure on the chamber floor. */
      .op__pool {
        position: absolute;
        left: 50%;
        bottom: -13px;
        width: 156%;
        height: 24px;
        transform: translateX(-50%);
        border-radius: 50%;
        background: radial-gradient(
          closest-side,
          color-mix(in srgb, var(--_cond) 26%, transparent),
          transparent 72%
        );
      }
      /* Hard contact shadow nested in the pool for a crisp ground anchor. */
      .op__pool::after {
        content: '';
        position: absolute;
        left: 50%;
        bottom: 7px;
        width: 58%;
        height: 9px;
        transform: translateX(-50%);
        border-radius: 50%;
        background: radial-gradient(
          closest-side,
          color-mix(in srgb, var(--color-surface) 92%, transparent),
          transparent 70%
        );
        filter: blur(2px);
      }
      .op__name {
        max-width: 92px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-family: var(--font-brutalist, var(--_mono));
        font-size: 8px;
        font-weight: 700;
        letter-spacing: 1px;
        text-transform: uppercase;
        color: var(--_phosphor-dim);
        text-shadow: 0 1px 2px var(--color-surface);
      }
      .op--down {
        opacity: 0.45;
      }
      .op--down .op__beam {
        opacity: 0.4;
      }

      /* Critical edge alarm — pulsing inset ring at high pressure. */
      .scene__alarm {
        position: absolute;
        inset: 0;
        z-index: 2;
        pointer-events: none;
        box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--color-danger) 60%, transparent);
        opacity: 0;
        animation: alarm 1.1s var(--ease-in-out, ease-in-out) infinite;
      }
      .scene[data-tier='critical'] .scene__alarm {
        opacity: 1;
      }

      /* Combat-FX layer (PixiJS, Phase 2): a light-DOM WebGL canvas overlaying
         the scene. Above the environment plane/alarm, below the readout/banter
         text so damage numbers never occlude the meter or narrative. Inert —
         pointer events fall through to the HUD beneath. */
      velg-dungeon-combat-fx {
        position: absolute;
        inset: 0;
        z-index: 3;
        pointer-events: none;
      }
      velg-dungeon-combat-fx canvas.fx-canvas {
        display: block;
        width: 100%;
        height: 100%;
      }

      /* ── Foreground content ── */
      .scene__readout {
        position: absolute;
        top: 10px;
        left: 12px;
        z-index: 4;
        display: flex;
        flex-direction: column;
        gap: 2px;
        font-family: var(--font-brutalist, var(--_mono));
        font-size: 9px;
        letter-spacing: 1.5px;
        text-transform: uppercase;
        color: var(--_phosphor);
        text-shadow: 0 1px 2px var(--color-surface);
      }
      .scene__readout-bar {
        width: 120px;
        height: 4px;
        border: 1px solid color-mix(in srgb, var(--_phosphor) 40%, transparent);
        background: color-mix(in srgb, var(--color-surface) 70%, transparent);
      }
      .scene__readout-fill {
        height: 100%;
        width: calc(var(--_p) * 100%);
        background: var(--_fx-accent);
        transition: width 500ms var(--ease-out, ease);
      }
      .scene[data-tier='critical'] .scene__readout-fill {
        background: var(--color-danger);
      }

      .scene__banter {
        position: relative;
        z-index: 4;
        margin: 0 12px 12px;
        padding: 12px 14px;
        max-width: 60ch;
        border-left: 3px solid var(--_fx-accent);
        background: color-mix(in srgb, var(--color-surface) 78%, transparent);
        font-family: var(--font-bureau, var(--font-prose, serif));
        font-size: 14px;
        line-height: 1.55;
        color: var(--color-text-primary);
        animation: banter-rise var(--duration-entrance, 350ms) var(--ease-dramatic, ease);
      }
      .scene__banter-barometer {
        display: block;
        margin-top: 8px;
        font-family: var(--_mono);
        font-size: 11px;
        letter-spacing: 0.5px;
        color: var(--_phosphor-dim);
      }
      .scene__banter-empty {
        position: relative;
        z-index: 4;
        margin: 0 12px 12px;
        padding: 12px 14px;
        font-family: var(--_mono);
        font-size: 12px;
        color: var(--_phosphor-dim);
        opacity: 0.7;
      }

      /* ── Enemy panel (combat) above the scene ── */
      .scene-enemies {
        flex: 0 0 auto;
      }

      /* ── Lobby ── */
      .dungeon-lobby {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
        gap: 12px;
      }
      .lobby-info__title {
        font-family: var(--font-brutalist, var(--_mono));
        font-weight: 700;
        font-size: 14px;
        text-transform: uppercase;
        letter-spacing: 1.5px;
        color: var(--_phosphor);
        margin-bottom: 8px;
      }
      .lobby-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 12px;
      }
      .lobby-card {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 14px;
        border: 1px solid color-mix(in srgb, var(--_border) 40%, transparent);
        background: color-mix(in srgb, var(--color-surface-raised) 70%, transparent);
        box-shadow: var(--shadow-sm);
      }
      .lobby-card--available {
        cursor: pointer;
        transition:
          border-color var(--transition-fast, 100ms ease),
          box-shadow var(--transition-fast, 100ms ease);
      }
      .lobby-card--available:hover {
        border-color: var(--_phosphor);
        box-shadow: var(--shadow-md);
      }
      .lobby-card--available:focus-visible {
        outline: 2px solid var(--_phosphor);
        outline-offset: 2px;
      }
      .lobby-card--unavailable {
        opacity: 0.45;
      }
      .lobby-card__name {
        font-family: var(--font-brutalist, var(--_mono));
        font-weight: 700;
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: var(--_phosphor);
      }
      .lobby-card__meta {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 12px;
        font-family: var(--_mono);
        font-size: 10px;
        color: var(--_phosphor-dim);
      }
      .lobby-hint {
        font-family: var(--_mono);
        font-size: 11px;
        color: var(--_phosphor-dim);
        opacity: 0.75;
      }

      /* ── Agent picker ── */
      .picker {
        display: flex;
        flex-direction: column;
        gap: 14px;
        flex: 1;
        min-height: 0;
      }
      .picker__head {
        display: flex;
        align-items: center;
        gap: 14px;
      }
      .picker__back {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 5px 10px;
        font-family: var(--_mono);
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: var(--_phosphor-dim);
        background: transparent;
        border: 1px solid color-mix(in srgb, var(--_border) 50%, transparent);
        cursor: pointer;
        transition:
          color var(--transition-fast, 100ms ease),
          border-color var(--transition-fast, 100ms ease);
      }
      .picker__back:hover:not(:disabled) {
        color: var(--_phosphor);
        border-color: var(--_phosphor);
      }
      .picker__back:disabled {
        opacity: 0.4;
        cursor: default;
      }
      .picker__back-icon {
        display: inline-flex;
        transform: scaleX(-1);
      }
      .picker__title {
        font-family: var(--font-brutalist, var(--_mono));
        font-weight: 700;
        font-size: 14px;
        text-transform: uppercase;
        letter-spacing: 1.5px;
        color: var(--_phosphor);
      }
      .picker__title span {
        color: var(--_phosphor-dim);
        font-weight: 400;
        letter-spacing: 1px;
      }
      .picker-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 10px;
        overflow-y: auto;
      }
      .picker-card {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        text-align: left;
        background: color-mix(in srgb, var(--color-surface-raised) 70%, transparent);
        border: 1px solid color-mix(in srgb, var(--_border) 40%, transparent);
        box-shadow: var(--shadow-sm);
        cursor: pointer;
        transition:
          border-color var(--transition-fast, 100ms ease),
          box-shadow var(--transition-fast, 100ms ease),
          background var(--transition-fast, 100ms ease);
      }
      .picker-card:hover:not(:disabled) {
        border-color: var(--_phosphor);
        box-shadow: var(--shadow-md);
      }
      .picker-card:focus-visible {
        outline: 2px solid var(--_phosphor);
        outline-offset: 2px;
      }
      .picker-card--selected {
        border-color: var(--_phosphor);
        background: color-mix(in srgb, var(--_phosphor) 12%, var(--color-surface-raised));
      }
      .picker-card:disabled {
        opacity: 0.4;
        cursor: default;
      }
      .picker-card__body {
        display: flex;
        flex-direction: column;
        gap: 4px;
        flex: 1;
        min-width: 0;
      }
      .picker-card__name {
        font-family: var(--_mono);
        font-size: 12px;
        font-weight: 600;
        color: var(--color-text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .picker-card__apts {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }
      .apt-chip {
        font-family: var(--_mono);
        font-size: 9px;
        letter-spacing: 0.5px;
        padding: 1px 5px;
        color: var(--_phosphor-dim);
        border: 1px solid color-mix(in srgb, var(--_border) 50%, transparent);
      }
      .picker-card__check {
        display: inline-flex;
        align-items: center;
        color: var(--_phosphor);
        flex-shrink: 0;
        width: 14px;
      }
      .picker__footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding-top: 10px;
        border-top: 1px dashed color-mix(in srgb, var(--_border) 40%, transparent);
      }
      .picker__count {
        font-family: var(--_mono);
        font-size: 11px;
        letter-spacing: 1px;
        color: var(--_phosphor-dim);
      }
      .picker__actions {
        display: flex;
        gap: 8px;
      }
      .picker__btn {
        padding: 7px 16px;
        font-family: var(--font-brutalist, var(--_mono));
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: var(--_phosphor-dim);
        background: transparent;
        border: 1px solid color-mix(in srgb, var(--_phosphor) 40%, transparent);
        cursor: pointer;
        transition:
          color var(--transition-fast, 100ms ease),
          border-color var(--transition-fast, 100ms ease),
          background var(--transition-fast, 100ms ease);
      }
      .picker__btn:hover:not(:disabled) {
        color: var(--_phosphor);
        border-color: var(--_phosphor);
      }
      .picker__btn--primary {
        color: var(--color-surface);
        background: var(--_phosphor);
        border-color: var(--_phosphor);
      }
      .picker__btn--primary:hover:not(:disabled) {
        color: var(--color-surface);
        background: color-mix(in srgb, var(--_phosphor) 85%, var(--color-text-primary));
      }
      .picker__btn:disabled {
        opacity: 0.4;
        cursor: default;
      }
      .picker__warn {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 10px;
        padding: 7px 10px;
        font-family: var(--_mono);
        font-size: 11px;
        line-height: 1.35;
        color: var(--color-warning);
        background: var(--color-warning-bg);
        border: 1px solid var(--color-warning-border);
      }
      .picker__warn-icon {
        flex-shrink: 0;
        display: inline-flex;
        color: var(--color-warning);
      }

      /* ── Keyframes ── */
      @keyframes tide {
        0%,
        100% {
          transform: translateY(0);
        }
        50% {
          transform: translateY(-3%);
        }
      }
      @keyframes breathe {
        0%,
        100% {
          opacity: 0.6;
        }
        50% {
          opacity: 1;
        }
      }
      @keyframes shimmer {
        0%,
        100% {
          opacity: 0.7;
        }
        50% {
          opacity: 1;
        }
      }
      @keyframes grain {
        0% {
          transform: translate(0, 0);
        }
        50% {
          transform: translate(-1%, 1%);
        }
        100% {
          transform: translate(1%, -1%);
        }
      }
      @keyframes flicker {
        0%,
        100% {
          opacity: 0.5;
        }
        50% {
          opacity: 0.15;
        }
      }
      @keyframes alarm {
        0%,
        100% {
          opacity: 0.25;
        }
        50% {
          opacity: 1;
        }
      }
      @keyframes banter-rise {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @keyframes motes-drift {
        from {
          background-position:
            0 0,
            0 0,
            0 0,
            0 0,
            0 0;
        }
        to {
          background-position:
            0 -60px,
            0 -90px,
            0 -50px,
            0 -75px,
            0 -110px;
        }
      }
      @keyframes token-rise {
        from {
          opacity: 0;
          transform: translateY(12px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @keyframes token-bob {
        0%,
        100% {
          transform: translateY(0);
        }
        50% {
          transform: translateY(-4px);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .scene__plane,
        .scene__alarm,
        .scene__banter,
        .scene__backdrop,
        .scene__motes,
        .scene__art-img,
        .op,
        .op__figure {
          animation: none !important;
          transition: none !important;
        }
      }
    `,
  ];

  @property({ type: String }) simulationId = '';

  @state() private _initialized = false;
  @state() private _error: string | null = null;
  /** Whether the left map rail is collapsed to a thin strip (reclaiming scene
   *  width). Client-only UI preference, persisted to localStorage and never
   *  touched by applyState()/clear() — mirrors viewMode. */
  @state() private _railCollapsed = this._getPersistedRailCollapsed();
  /** Backdrop URL that failed to load (local storage missing the asset, 404,
   *  etc.) → fall back to the CSS-only chamber for that URL. Keyed by URL so a
   *  new archetype's backdrop is retried. */
  @state() private _failedBackdrop: string | null = null;
  /** Archetype whose party is being assembled in the graphical picker. Null =
   *  show the archetype grid; non-null = show the agent picker. This replaces
   *  the terminal-only agent picker so a run can start entirely from the
   *  graphical lobby (no terminal toggle required). */
  @state() private _pickerArchetype: string | null = null;
  /** Agent IDs selected for the descent party (2–4 required to begin). */
  @state() private _pickerSelection: string[] = [];
  /** True while the create-run request is in flight (disables the controls). */
  @state() private _startingRun = false;

  private _wakeLock: WakeLockReleasable | null = null;

  override async connectedCallback(): Promise<void> {
    super.connectedCallback();
    await this._initialize();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._releaseWakeLock();
    terminalState.clearDungeon();
    terminalState.dispose();
  }

  // ── Initialization (mirrors DungeonTerminalView) ─────────────────────────

  private async _initialize(): Promise<void> {
    const sid = this.simulationId || appState.simulationId.value;
    if (!sid) {
      this._error = msg('No simulation context.');
      return;
    }
    try {
      terminalState.initialize(sid);
      await initializeTerminalZones(sid);

      const recovered = await dungeonState.tryRecover();
      if (recovered) {
        const runId = dungeonState.runId.value;
        if (runId) {
          terminalState.initializeDungeon(
            runId,
            getArchetypeDisplayName(dungeonState.clientState.value?.archetype ?? ''),
          );
          await this._acquireWakeLock();
        }
      } else {
        await dungeonState.loadAvailable(sid);
      }
      this._initialized = true;

      // Deep-link: auto-select archetype from detail page bridge.
      const pendingArchetype = appState.pendingDungeonArchetype.value;
      if (pendingArchetype && !dungeonState.isInDungeon.value) {
        appState.pendingDungeonArchetype.value = null;
        await this.updateComplete;
        await this._runCommand(`dungeon ${pendingArchetype}`);
      }
    } catch (err) {
      this._error = err instanceof Error ? err.message : msg('Initialization failed.');
      captureError(err, { source: 'VelgDungeonGraphicalView._initialize' });
    }
  }

  // ── Wake Lock ────────────────────────────────────────────────────────────

  private async _acquireWakeLock(): Promise<void> {
    try {
      if ('wakeLock' in navigator) {
        this._wakeLock = await (
          navigator as Navigator & {
            wakeLock: { request(type: string): Promise<WakeLockReleasable> };
          }
        ).wakeLock.request('screen');
      }
    } catch (err) {
      captureError(err, { source: 'VelgDungeonGraphicalView._acquireWakeLock' });
    }
  }

  private _releaseWakeLock(): void {
    if (this._wakeLock) {
      this._wakeLock
        .release()
        .catch((err) => captureError(err, { source: 'VelgDungeonGraphicalView._releaseWakeLock' }));
      this._wakeLock = null;
    }
  }

  // ── Map rail ─────────────────────────────────────────────────────────────
  // The dungeon map (room DAG) is the primary navigation surface — it lives in
  // a persistent left rail at its native ~320px width. Clicking a room node
  // dispatches a `terminal-command` move that the .dungeon-hud @terminal-command
  // handler routes through the same pipeline. The rail can be collapsed to a
  // thin strip to reclaim scene width; the preference persists in localStorage.

  private _toggleRail(): void {
    this._railCollapsed = !this._railCollapsed;
    this._persistRailCollapsed(this._railCollapsed);
  }

  private _getPersistedRailCollapsed(): boolean {
    try {
      return globalThis.localStorage?.getItem(RAIL_COLLAPSED_STORAGE_KEY) === 'true';
    } catch (err) {
      captureError(err, { source: 'VelgDungeonGraphicalView._getPersistedRailCollapsed' });
      return false;
    }
  }

  private _persistRailCollapsed(collapsed: boolean): void {
    try {
      globalThis.localStorage?.setItem(RAIL_COLLAPSED_STORAGE_KEY, collapsed ? 'true' : 'false');
    } catch (err) {
      captureError(err, { source: 'VelgDungeonGraphicalView._persistRailCollapsed' });
    }
  }

  // ── Command routing (same pipeline as the terminal view) ─────────────────

  private _handleTerminalCommand(e: CustomEvent<string>): void {
    e.stopPropagation();
    void this._runCommand(e.detail);
  }

  private async _runCommand(command: string): Promise<void> {
    if (!command) return;
    terminalState.isLoading.value = true;
    try {
      // Output still flows to the terminal buffer (kept for continuity if the
      // player toggles back to terminal view); the scene reacts to applyState.
      const lines = await parseAndExecute(command);
      terminalState.appendOutput(lines);
    } catch (err) {
      captureError(err, { source: 'VelgDungeonGraphicalView._runCommand', command });
      VelgToast.error(err instanceof Error ? err.message : msg('Command failed.'));
    } finally {
      terminalState.isLoading.value = false;
    }
  }

  // ── Agent picker (graphical lobby → party assembly → run start) ────────────

  /** Open the party picker for an archetype. Loads the roster lazily (cached
   *  in dungeonState until clear()). */
  private async _openPicker(archetype: string): Promise<void> {
    this._pickerArchetype = archetype;
    this._pickerSelection = [];
    const sid = this.simulationId || appState.simulationId.value || '';
    if (!sid) return;
    try {
      await dungeonState.loadPickerAgents(sid);
    } catch (err) {
      captureError(err, { source: 'VelgDungeonGraphicalView._openPicker', command: archetype });
      VelgToast.error(msg('Failed to load agents.'));
    }
  }

  private _closePicker(): void {
    this._pickerArchetype = null;
    this._pickerSelection = [];
  }

  /** Toggle an agent in/out of the party. Caps the party at 4. */
  private _toggleAgent(agentId: string): void {
    const sel = this._pickerSelection;
    if (sel.includes(agentId)) {
      this._pickerSelection = sel.filter((id) => id !== agentId);
    } else if (sel.length < 4) {
      this._pickerSelection = [...sel, agentId];
    }
  }

  /** Auto-pick the top 3 agents by aggregate aptitude — same heuristic as the
   *  terminal `dungeon <archetype> auto` path (shared autoPickPartyIds). */
  private _autoSelect(): void {
    this._pickerSelection = autoPickPartyIds(
      dungeonState.pickerAgents.value,
      dungeonState.pickerAptitudes.value,
    );
  }

  /** Start the run with the selected party. startDungeonRun applies the new
   *  state, so isInDungeon flips true and render() swaps to the scene. */
  private async _beginRun(): Promise<void> {
    const archetype = this._pickerArchetype;
    const party = this._pickerSelection;
    if (!archetype || party.length < 2 || this._startingRun) return;
    const sid = this.simulationId || appState.simulationId.value || '';
    if (!sid) return;
    const dungeon = dungeonState.availableDungeons.value.find((d) => d.archetype === archetype);
    if (!dungeon) return;

    this._startingRun = true;
    terminalState.isLoading.value = true;
    try {
      const lines = await startDungeonRun(sid, {
        archetype: archetype as DungeonRunCreate['archetype'],
        party_agent_ids: party,
        difficulty: dungeon.suggested_difficulty,
      });
      // Keep the terminal buffer in sync for players who toggle back.
      terminalState.appendOutput(lines);
      this._closePicker();
    } catch (err) {
      captureError(err, { source: 'VelgDungeonGraphicalView._beginRun', command: archetype });
      VelgToast.error(err instanceof Error ? err.message : msg('Failed to begin the descent.'));
    } finally {
      this._startingRun = false;
      terminalState.isLoading.value = false;
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  protected render() {
    if (this._error) {
      return html`<div class="gview-error">[ERROR] ${this._error}</div>`;
    }
    if (!this._initialized) {
      return html`<div class="gview-loading">${msg('Rendering descent...')}</div>`;
    }
    const sid = this.simulationId || appState.simulationId.value || '';
    return dungeonState.isInDungeon.value ? this._renderScene() : this._renderLobby(sid);
  }

  private _renderScene() {
    const archetype = dungeonState.clientState.value?.archetype ?? '';
    const env = resolveDungeonEnvironment(archetype, dungeonState.archetypeState.value);
    const inCombat = dungeonState.isInCombat.value;
    const narrative = dungeonState.lastRoomNarrative.value;
    const meterLabel = meterLabelFor(env.fxProfile);
    const accent = ACCENT_BY_FX[env.fxProfile];
    const backdropUrl = dungeonBackdropUrl(archetype);
    const showArt = backdropUrl !== null && backdropUrl !== this._failedBackdrop;

    return html`
      <div
        class="dungeon-hud ${this._railCollapsed ? 'dungeon-hud--rail-collapsed' : ''}"
        @terminal-command=${this._handleTerminalCommand}
      >
        <div class="dungeon-hud__header" role="banner" aria-label=${msg('Dungeon status')}>
          <velg-dungeon-header></velg-dungeon-header>
        </div>

        ${this._renderRail()}

        <div class="dungeon-hud__main" role="main" aria-label=${msg('Dungeon scene')}>
          ${
            inCombat
              ? html`<div class="scene-enemies"><velg-dungeon-enemy-panel></velg-dungeon-enemy-panel></div>`
              : nothing
          }
          <div
            class="scene"
            data-tier=${env.tier}
            style="--_pressure:${env.pressure01};--_fx-accent:${accent}"
          >
            <div class="scene__backdrop" data-fx=${env.fxProfile} aria-hidden="true">
              <div class="scene__plane"></div>
            </div>
            ${
              showArt
                ? html`<div class="scene__art" aria-hidden="true">
                  <img
                    class="scene__art-img"
                    src=${backdropUrl}
                    alt=""
                    decoding="async"
                    @error=${() => {
                      this._failedBackdrop = backdropUrl;
                    }}
                  />
                </div>`
                : html`
                  <div class="scene__floor" aria-hidden="true"></div>
                  <div class="scene__motes" aria-hidden="true"></div>
                `
            }
            ${this._renderParty()}
            <div class="scene__alarm" aria-hidden="true"></div>

            <velg-dungeon-combat-fx></velg-dungeon-combat-fx>

            <div
              class="scene__readout"
              aria-label=${`${meterLabel} ${Math.round(env.pressure01 * 100)}%`}
            >
              <span>${meterLabel}</span>
              <div class="scene__readout-bar">
                <div class="scene__readout-fill"></div>
              </div>
            </div>

            ${
              narrative?.banter
                ? html`<div class="scene__banter" role="status" aria-live="polite">
                  ${narrative.banter}
                  ${
                    narrative.barometer
                      ? html`<span class="scene__banter-barometer">${narrative.barometer}</span>`
                      : nothing
                  }
                </div>`
                : html`<div class="scene__banter-empty">
                  ${msg('The chamber waits. Choose your next move.')}
                </div>`
            }
          </div>
        </div>

        <div class="dungeon-hud__party" role="complementary" aria-label=${msg('Party status')}>
          <velg-dungeon-party-panel></velg-dungeon-party-panel>
        </div>

        <div class="dungeon-hud__actions" role="toolbar" aria-label=${msg('Actions')}>
          ${
            inCombat
              ? html`<velg-dungeon-combat-bar compact></velg-dungeon-combat-bar>`
              : html`<velg-dungeon-quick-actions></velg-dungeon-quick-actions>`
          }
        </div>
      </div>
    `;
  }

  /** Persistent left navigation rail hosting the room DAG at its native sidebar
   *  width. Collapses to a thin strip to reclaim scene width. The map dispatches
   *  `terminal-command` move events that bubble to the .dungeon-hud handler. */
  private _renderRail() {
    if (this._railCollapsed) {
      return html`
        <div class="dungeon-hud__rail" role="region" aria-label=${msg('Dungeon map')}>
          <div class="rail-strip">
            <button
              class="rail-expand-btn rail-expand-btn--vertical"
              @click=${this._toggleRail}
              aria-label=${msg('Show dungeon map')}
              aria-expanded="false"
            >
              <span class="rail-expand-btn__map">${icons.dungeonMap(16)}</span>
              <span>${msg('Map')}</span>
            </button>
          </div>
        </div>
      `;
    }
    return html`
      <div class="dungeon-hud__rail" role="region" aria-label=${msg('Dungeon map')}>
        <div class="rail-header">
          <button
            class="rail-collapse-btn"
            @click=${this._toggleRail}
            aria-label=${msg('Hide dungeon map')}
            aria-expanded="true"
          >
            <span class="rail-collapse-btn__icon">${icons.chevronRight(12)}</span>
            <span>${msg('Hide')}</span>
          </button>
        </div>
        <velg-dungeon-map persistent></velg-dungeon-map>
      </div>
    `;
  }

  /** In-scene party presence: the operatives standing in the chamber. Reads the
   *  same server-authoritative party signal the side panel uses; condition tints
   *  each figure's halo so health reads from the stage alone. */
  private _renderParty() {
    const party = dungeonState.party.value;
    if (party.length === 0) return nothing;
    return html`
      <div class="scene__party" aria-hidden="true">
        ${party.map((agent: AgentCombatStateClient, i: number) => {
          const portrait = agent.portrait_url;
          return html`
            <div
              class="op ${agent.condition === 'captured' ? 'op--down' : ''}"
              style="--i:${i};--_cond:${CONDITION_RING[agent.condition]}"
            >
              <div class="op__figure">
                <div class="op__beam"></div>
                <div class="op__disc">
                  ${
                    portrait
                      ? html`<img src=${portrait} alt="" />`
                      : html`<span class="op__mono">${getInitials(agent.agent_name)}</span>`
                  }
                </div>
                <div class="op__pool"></div>
              </div>
              <span class="op__name">${agent.agent_name}</span>
            </div>
          `;
        })}
      </div>
    `;
  }

  private _renderLobby(_simulationId: string) {
    const available = dungeonState.availableDungeons.value;
    const loading = dungeonState.loading.value;

    // Archetype chosen → assemble the party in-view (no terminal needed).
    if (this._pickerArchetype) {
      return html`<div class="dungeon-lobby">${this._renderPicker()}</div>`;
    }

    return html`
      <div class="dungeon-lobby">
        <div>
          <div class="lobby-info__title">${msg('Resonance Dungeons')}</div>
          ${
            loading
              ? html`<velg-loading-state message=${msg('Scanning resonance frequencies...')}></velg-loading-state>`
              : available.length > 0
                ? this._renderAvailableGrid(available)
                : html`<velg-empty-state
                  message=${msg('No dungeon archetypes detected in this simulation.')}
                ></velg-empty-state>`
          }
        </div>
        ${
          !loading && available.length > 0
            ? html`<div class="lobby-hint">${msg('Select an archetype to begin the descent.')}</div>`
            : nothing
        }
      </div>
    `;
  }

  private _renderAvailableGrid(dungeons: AvailableDungeonResponse[]) {
    return html`
      <div class="lobby-grid" role="list" aria-label=${msg('Available dungeons')}>
        ${dungeons.map(
          (d) => html`
            <div
              class="lobby-card ${
                d.available ? 'lobby-card--available' : 'lobby-card--unavailable'
              }"
              role=${d.available ? 'button' : 'listitem'}
              tabindex=${d.available ? '0' : '-1'}
              aria-label=${
                d.available
                  ? `${msg('Enter')} ${getArchetypeDisplayName(d.archetype)}`
                  : getArchetypeDisplayName(d.archetype)
              }
              @click=${() => d.available && this._openPicker(d.archetype)}
              @keydown=${(e: KeyboardEvent) => {
                if (d.available && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  void this._openPicker(d.archetype);
                }
              }}
            >
              <span class="lobby-card__name">${getArchetypeDisplayName(d.archetype)}</span>
              <span class="lobby-card__meta">
                <span>${msg('Magnitude')}: ${d.effective_magnitude.toFixed(1)}</span>
                <span>${msg('Difficulty')}: ${d.suggested_difficulty}</span>
                <span>${msg('Depth')}: ${d.suggested_depth + 1}</span>
              </span>
            </div>
          `,
        )}
      </div>
    `;
  }

  // ── Agent picker render ───────────────────────────────────────────────────

  private _renderPicker() {
    const archetype = this._pickerArchetype ?? '';
    const loading = dungeonState.loading.value;
    const agents = dungeonState.pickerAgents.value;
    const count = this._pickerSelection.length;
    const canBegin = count >= 2 && count <= 4 && !this._startingRun;
    // Non-blocking composition warning (shared with the terminal entry flow):
    // surfaces once a viable party is selected but misses the archetype's
    // critical aptitude — informational, never gates BEGIN DESCENT.
    const warning =
      count >= 2
        ? checkPartyComposition(
            archetype,
            this._pickerSelection,
            dungeonState.pickerAptitudes.value,
          )
        : null;

    return html`
      <div class="picker">
        <div class="picker__head">
          <button
            class="picker__back"
            type="button"
            aria-label=${msg('Back to archetypes')}
            ?disabled=${this._startingRun}
            @click=${this._closePicker}
          >
            <span class="picker__back-icon">${icons.chevronRight(14)}</span> ${msg('Back')}
          </button>
          <div class="picker__title">
            ${getArchetypeDisplayName(archetype)} <span>// ${msg('Assemble party')}</span>
          </div>
        </div>

        ${
          loading && agents.length === 0
            ? html`<velg-loading-state message=${msg('Mustering operatives...')}></velg-loading-state>`
            : agents.length < 2
              ? html`<velg-empty-state
                  message=${msg('Need at least 2 agents for a dungeon party. Recruit more agents first.')}
                ></velg-empty-state>`
              : this._renderPickerRoster(agents)
        }

        ${
          warning
            ? html`
                <div class="picker__warn" role="status">
                  <span class="picker__warn-icon" aria-hidden="true"
                    >${icons.alertTriangle(13)}</span
                  >
                  <span>${partyCompositionWarningText(warning)}</span>
                </div>
              `
            : nothing
        }

        ${
          agents.length >= 2
            ? html`
                <div class="picker__footer">
                  <span class="picker__count" aria-live="polite">
                    ${msg('Party')}: ${count}/4
                  </span>
                  <div class="picker__actions">
                    <button
                      class="picker__btn"
                      type="button"
                      ?disabled=${this._startingRun}
                      @click=${this._autoSelect}
                    >
                      ${msg('Auto-select')}
                    </button>
                    <button
                      class="picker__btn picker__btn--primary"
                      type="button"
                      ?disabled=${!canBegin}
                      @click=${this._beginRun}
                    >
                      ${this._startingRun ? msg('Descending...') : msg('Begin descent')}
                    </button>
                  </div>
                </div>
              `
            : nothing
        }
      </div>
    `;
  }

  private _renderPickerRoster(agents: Agent[]) {
    const aptMap = dungeonState.pickerAptitudes.value;
    return html`
      <div class="picker-grid" role="group" aria-label=${msg('Select party members')}>
        ${agents.map((agent) => {
          const selected = this._pickerSelection.includes(agent.id);
          const atCap = this._pickerSelection.length >= 4 && !selected;
          return html`
            <button
              class="picker-card ${selected ? 'picker-card--selected' : ''}"
              type="button"
              role="checkbox"
              aria-checked=${selected ? 'true' : 'false'}
              ?disabled=${atCap || this._startingRun}
              @click=${() => this._toggleAgent(agent.id)}
            >
              <velg-avatar
                class="picker-card__avatar"
                size="sm"
                .src=${agent.portrait_image_url ?? ''}
                .name=${agent.name}
              ></velg-avatar>
              <span class="picker-card__body">
                <span class="picker-card__name">${agent.name}</span>
                <span class="picker-card__apts">${this._renderAptChips(aptMap.get(agent.id))}</span>
              </span>
              <span class="picker-card__check" aria-hidden="true">
                ${selected ? icons.checkCircle(14) : nothing}
              </span>
            </button>
          `;
        })}
      </div>
    `;
  }

  /** Top-3 aptitudes as compact chips (shared computation with the terminal
   *  picker formatter via topAptitudes — generalists fall back to a baseline). */
  private _renderAptChips(apts: AptitudeSet | undefined) {
    return topAptitudes(apts).map(
      ([k, v]) => html`<span class="apt-chip">${OPERATIVE_LABEL[k] ?? k.toUpperCase()} ${v}</span>`,
    );
  }
}

/** Condition → halo color for in-scene party figures (mirrors the side-panel
 *  CONDITION_COLOR map in DungeonPartyPanel). */
const CONDITION_RING: Record<Condition, string> = {
  operational: 'var(--color-success)',
  stressed: 'var(--color-warning)',
  wounded: 'var(--color-danger)',
  afflicted: 'var(--color-danger)',
  captured: 'var(--color-text-muted)',
};

/** Per-fx accent color (token-based; drives backdrop tint + readout fill). */
const ACCENT_BY_FX: Record<FxProfile, string> = {
  water: 'var(--color-info)',
  darkness: 'var(--color-text-muted)',
  decay: 'var(--color-success)',
  tilt: 'var(--color-warning)',
  pulse: 'var(--color-danger)',
  forge: 'var(--color-warning)',
  shards: 'var(--color-warning)',
  flicker: 'var(--color-info)',
  neutral: 'var(--color-primary)',
};

interface WakeLockReleasable {
  release(): Promise<void>;
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-dungeon-graphical-view': VelgDungeonGraphicalView;
  }
}
