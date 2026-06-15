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
import { customElement, property, query, state } from 'lit/decorators.js';

import { appState } from '../../../services/AppStateManager.js';
import { dungeonState } from '../../../services/DungeonStateManager.js';
import { captureError } from '../../../services/SentryService.js';
import { terminalState } from '../../../services/TerminalStateManager.js';
import type {
  AgentCombatStateClient,
  AvailableDungeonResponse,
  Condition,
} from '../../../types/dungeon.js';
import { dungeonBackdropUrl } from '../../../utils/dungeon-backdrop-data.js';
import { type FxProfile, resolveDungeonEnvironment } from '../../../utils/dungeon-environment.js';
import { getArchetypeDisplayName } from '../../../utils/dungeon-formatters.js';
import { icons } from '../../../utils/icons.js';
import { parseAndExecute } from '../../../utils/terminal-commands.js';
import { initializeTerminalZones } from '../../../utils/terminal-initialization.js';
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

      /* ── HUD grid (mirrors DungeonTerminalView layout) ── */
      .dungeon-hud {
        display: grid;
        grid-template-rows: auto 1fr auto;
        grid-template-columns: 1fr 280px;
        flex: 1;
        min-height: 0;
        gap: 0;
      }
      .dungeon-hud__header {
        grid-column: 1 / -1;
        grid-row: 1;
      }
      .dungeon-hud__main {
        grid-column: 1;
        grid-row: 2;
        display: flex;
        flex-direction: column;
        min-height: 0;
      }
      .dungeon-hud__party {
        grid-column: 2;
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

      @media (max-width: 1199px) {
        .dungeon-hud {
          grid-template-columns: 1fr;
        }
        .dungeon-hud__party {
          grid-column: 1;
          grid-row: unset;
          max-height: 96px;
          border-left: none;
          border-top: 1px dashed color-mix(in srgb, var(--_border) 40%, transparent);
          overflow-x: auto;
          overflow-y: hidden;
        }
        .dungeon-hud__actions {
          grid-column: 1;
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

      /* In-scene party presence — the operatives stand in the chamber, not just
         in the side panel. Lower band (party zone), centered, on the floor. */
      .scene__party {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 23%;
        z-index: 2;
        pointer-events: none;
        display: flex;
        justify-content: center;
        align-items: flex-end;
        gap: clamp(12px, 4vw, 40px);
        padding: 0 16px;
      }
      .party-token {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 5px;
        animation: token-rise var(--duration-entrance, 350ms) var(--ease-dramatic, ease) both;
        animation-delay: calc(var(--i, 0) * 80ms);
      }
      .party-token__figure {
        position: relative;
        width: clamp(42px, 5.5vw, 60px);
        animation: token-bob 4.2s var(--ease-in-out, ease-in-out) infinite;
        animation-delay: calc(var(--i, 0) * -700ms);
      }
      .party-token__figure velg-avatar {
        display: block;
        width: 100%;
        /* Condition-tinted halo so health reads from the figure alone. */
        filter: drop-shadow(0 0 6px color-mix(in srgb, var(--_cond) 45%, transparent));
        border: 1px solid color-mix(in srgb, var(--_cond) 55%, transparent);
      }
      /* Ground shadow grounding the figure on the floor. Sits over a wider,
         softer light pool so the operative reads as standing IN the chamber,
         not as a chip pasted on the backdrop. */
      .party-token__shadow {
        position: absolute;
        left: 50%;
        bottom: -11px;
        width: 132%;
        height: 16px;
        margin-left: -66%;
        border-radius: 50%;
        background: radial-gradient(
          closest-side,
          color-mix(in srgb, var(--color-surface) 92%, transparent),
          color-mix(in srgb, var(--color-surface) 45%, transparent) 60%,
          transparent
        );
        filter: blur(2px);
      }
      /* Soft standing-light pool: a warm floor halo that anchors the figure to
         the ground plane and lifts it off the busy backdrop. */
      .party-token__shadow::before {
        content: '';
        position: absolute;
        left: 50%;
        bottom: -3px;
        width: 168%;
        height: 30px;
        margin-left: -84%;
        border-radius: 50%;
        background: radial-gradient(
          closest-side,
          color-mix(in srgb, var(--_cond) 22%, transparent),
          transparent 70%
        );
      }
      .party-token__name {
        max-width: 88px;
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
      .party-token--down {
        opacity: 0.5;
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

      /* ── Map FAB + dialog ── navigation surface for the graphical view.
         The FAB floats over the immersive scene; the dialog hosts the room DAG
         at full size so the select→move interaction (room detail panel) has room
         to breathe instead of being crammed into the sidebar. */
      .map-fab {
        position: fixed;
        bottom: 88px;
        right: 28px;
        z-index: var(--z-overlay, 400);
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        border: 1px solid color-mix(in srgb, var(--_phosphor) 50%, transparent);
        background: color-mix(in srgb, var(--_screen-bg) 92%, black); /* lint-color-ok */
        color: var(--_phosphor);
        font-family: var(--font-brutalist, var(--_mono));
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        cursor: pointer;
        backdrop-filter: blur(4px);
        transition:
          border-color var(--transition-fast, 100ms ease),
          color var(--transition-fast, 100ms ease);
      }
      .map-fab:hover {
        border-color: var(--_phosphor);
        color: var(--_phosphor);
      }
      .map-fab:focus-visible {
        outline: 2px solid var(--_phosphor);
        outline-offset: 2px;
      }

      .map-dialog {
        border: 1px solid color-mix(in srgb, var(--_phosphor) 40%, transparent);
        background: color-mix(in srgb, var(--_screen-bg) 98%, black); /* lint-color-ok */
        color: var(--_phosphor);
        padding: 0;
        max-width: min(92vw, 620px);
        max-height: 84vh;
        width: 100%;
      }
      .map-dialog::backdrop {
        background: color-mix(in srgb, var(--color-surface) 70%, transparent);
        backdrop-filter: blur(2px);
      }
      .map-dialog__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        border-bottom: 1px dashed color-mix(in srgb, var(--_border) 40%, transparent);
        font-family: var(--font-brutalist, var(--_mono));
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1.5px;
      }
      .map-dialog__close {
        border: none;
        background: none;
        color: var(--_phosphor-dim);
        font-size: 20px;
        line-height: 1;
        cursor: pointer;
        padding: 0 4px;
      }
      .map-dialog__close:hover {
        color: var(--_phosphor);
      }

      @media (max-width: 640px) {
        .map-fab {
          bottom: 72px;
          right: 12px;
          padding: 6px 10px;
          font-size: 9px;
        }
        .map-dialog {
          max-width: 100vw;
          max-height: 100vh;
          width: 100vw;
          height: 100vh;
          margin: 0;
          border: none;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .scene__plane,
        .scene__alarm,
        .scene__banter,
        .scene__backdrop,
        .scene__motes,
        .scene__art-img,
        .party-token,
        .party-token__figure {
          animation: none !important;
          transition: none !important;
        }
      }
    `,
  ];

  @property({ type: String }) simulationId = '';

  @state() private _initialized = false;
  @state() private _error: string | null = null;
  @state() private _mapDialogOpen = false;
  /** Backdrop URL that failed to load (local storage missing the asset, 404,
   *  etc.) → fall back to the CSS-only chamber for that URL. Keyed by URL so a
   *  new archetype's backdrop is retried. */
  @state() private _failedBackdrop: string | null = null;

  @query('.map-dialog') private _mapDialog?: HTMLDialogElement;

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

  // ── Command routing (same pipeline as the terminal view) ─────────────────

  // ── Map dialog ───────────────────────────────────────────────────────────
  // The dungeon map (room DAG) is the navigation surface — clicking a room node
  // dispatches a `terminal-command` move that the .dungeon-hud @terminal-command
  // handler routes through the same pipeline. The map opens as a modal so the
  // immersive scene stays unobstructed and the room-detail/move panel has room.

  private _openMapDialog(): void {
    this._mapDialogOpen = true;
    this._mapDialog?.showModal();
  }

  private _onMapDialogClose(): void {
    this._mapDialogOpen = false;
  }

  private _onMapDialogBackdropClick(e: MouseEvent): void {
    if (e.target === this._mapDialog) {
      this._mapDialog?.close();
    }
  }

  private _handleTerminalCommand(e: CustomEvent<string>): void {
    e.stopPropagation();
    // A command issued from the open map dialog (a room move) closes it so the
    // updated scene is revealed; hud-issued commands fire while it is closed.
    if (this._mapDialog?.open) {
      this._mapDialog.close();
    }
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
        class="dungeon-hud"
        @terminal-command=${this._handleTerminalCommand}
      >
        <div class="dungeon-hud__header" role="banner" aria-label=${msg('Dungeon status')}>
          <velg-dungeon-header></velg-dungeon-header>
        </div>

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
              ? html`<velg-dungeon-combat-bar></velg-dungeon-combat-bar>`
              : html`<velg-dungeon-quick-actions></velg-dungeon-quick-actions>`
          }
        </div>
      </div>

      <button
        class="map-fab"
        @click=${this._openMapDialog}
        aria-label=${msg('Open dungeon map')}
      >
        ${icons.dungeonMap(16)}
        <span>${msg('Map')}</span>
      </button>

      <dialog
        class="map-dialog"
        @terminal-command=${this._handleTerminalCommand}
        @close=${this._onMapDialogClose}
        @click=${this._onMapDialogBackdropClick}
      >
        <div class="map-dialog__header">
          <span>${msg('Dungeon Map')}</span>
          <button
            class="map-dialog__close"
            @click=${() => this._mapDialog?.close()}
            aria-label=${msg('Close map')}
          >
            &times;
          </button>
        </div>
        ${this._mapDialogOpen ? html`<velg-dungeon-map persistent></velg-dungeon-map>` : nothing}
      </dialog>
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
        ${party.map(
          (agent: AgentCombatStateClient, i: number) => html`
            <div
              class="party-token ${agent.condition === 'captured' ? 'party-token--down' : ''}"
              style="--i:${i};--_cond:${CONDITION_RING[agent.condition]}"
            >
              <div class="party-token__figure">
                <velg-avatar
                  size="full"
                  .src=${agent.portrait_url ?? ''}
                  .name=${agent.agent_name}
                ></velg-avatar>
                <div class="party-token__shadow"></div>
              </div>
              <span class="party-token__name">${agent.agent_name}</span>
            </div>
          `,
        )}
      </div>
    `;
  }

  private _renderLobby(_simulationId: string) {
    const available = dungeonState.availableDungeons.value;
    const loading = dungeonState.loading.value;

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
              @click=${() => d.available && this._runCommand(`dungeon ${d.archetype}`)}
              @keydown=${(e: KeyboardEvent) => {
                if (d.available && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  void this._runCommand(`dungeon ${d.archetype}`);
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
