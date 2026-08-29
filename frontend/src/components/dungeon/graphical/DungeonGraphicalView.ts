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
  DungeonPhase,
  DungeonRunCreate,
} from '../../../types/dungeon.js';
import type { Agent, AptitudeSet } from '../../../types/index.js';
import type { TerminalLine } from '../../../types/terminal.js';
import { dungeonBackdropUrl } from '../../../utils/dungeon-backdrop-data.js';
import { dungeonEnemyArtUrl } from '../../../utils/dungeon-enemy-art.js';
import {
  autoPickPartyIds,
  checkPartyComposition,
  partyCompositionWarningText,
  startDungeonRun,
} from '../../../utils/dungeon-entry-flow.js';
import { type FxProfile, resolveDungeonEnvironment } from '../../../utils/dungeon-environment.js';
import {
  adminUnlockedLabel,
  buildEnemyDisplayNames,
  describeEnemy,
  type EnemyFacts,
  getArchetypeBriefing,
  getArchetypeDisplayName,
  resonanceMagnitudeLabel,
  topAptitudes,
} from '../../../utils/dungeon-formatters.js';
import { icons } from '../../../utils/icons.js';
import { OPERATIVE_LABEL } from '../../../utils/operative-constants.js';
import { parseAndExecute } from '../../../utils/terminal-commands.js';
import { initializeTerminalZones } from '../../../utils/terminal-initialization.js';
import { getInitials } from '../../../utils/text.js';
import { VelgToast } from '../../shared/Toast.js';
import '../../shared/EmptyState.js';
import '../../shared/Lightbox.js';
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
import '../DungeonViewToggle.js';
import './DungeonChronicle.js';
import './DungeonCombatFx.js';
import type { RoomDescription } from '../../../utils/dungeon-room-text.js';

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
        /* Fill from the view's real top (below the global header + the
           simulation header/nav bars) down to the viewport bottom. The static
           100vh-minus-header-minus-nav calc undercounts the simulation header
           bar by ~106px, pushing the quick-actions row and rail floor below the
           fold; --_host-offset is measured from the host's actual top in
           _measureHostOffset() (resize-tracked). 108px fallback = the legacy
           calc until the first measurement lands. */
        height: calc(100dvh - var(--_host-offset, 108px));
        min-height: 400px;
        padding: 0 16px 16px;
        box-sizing: border-box;

        /* Force platform-dark tokens regardless of simulation theme — same
           rationale as DungeonTerminalView: sim themes (e.g. Velgarien
           brutalist) override --color-surface to white and break contrast. */
        --color-surface: #0a0a0a; /* lint-color-ok */
        --color-surface-raised: #111111; /* lint-color-ok */
        /* Was missing, and it showed: <velg-avatar> paints its initials
           placeholder on --color-surface-sunken. Under a simulation theme that
           lightens the surface scale (Velgarien brutalist sets it to white) the
           token stayed light while everything around it was forced dark, so an
           agent without a portrait became the single brightest rectangle on a
           near-black screen — pointing at nothing. Any token a CHILD component
           may read has to be in this block, not only the ones this file uses. */
        --color-surface-sunken: #060606; /* lint-color-ok */
        --color-surface-overlay: #111111; /* lint-color-ok */
        --color-text-primary: #e5e5e5; /* lint-color-ok */
        --color-text-secondary: #a0a0a0; /* lint-color-ok */
        --color-text-muted: #888888; /* lint-color-ok */
        --color-border: #333333; /* lint-color-ok */
        --color-border-light: #222222; /* lint-color-ok */
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

      /* ── HUD grid — [ map rail | scene | party + chronicle ].
         The map is the primary navigation surface, so it lives in a persistent
         left rail at its native ~320px width (the same sidebar mode the terminal
         view uses) instead of a modal that over-scaled it 2× and hid the current
         room below the fold.

         The right column carries the party AND the chronicle. It grew 280 → 340
         because the chronicle has to hold a line of prose without breaking every
         third word; below the party card there were ~300px standing empty, which
         is where the account of the descent now lives. ── */
      .dungeon-hud {
        display: grid;
        grid-template-rows: auto 1fr auto;
        grid-template-columns: 320px 1fr 340px;
        flex: 1;
        min-height: 0;
        gap: 0;
      }
      .dungeon-hud--rail-collapsed {
        grid-template-columns: 40px 1fr 340px;
      }
      /* The view toggle rides in the header row rather than floating over the
         HUD: as a fixed overlay it covered the first operative in the party
         column. Header content takes the width it needs, the toggle the rest. */
      .dungeon-hud__header {
        grid-column: 1 / -1;
        grid-row: 1;
        display: flex;
        align-items: flex-start;
        gap: 10px;
      }
      .dungeon-hud__header velg-dungeon-header {
        flex: 1 1 auto;
        min-width: 0;
      }
      .gview-toggle {
        flex: none;
        padding: 6px 4px 0 0;
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
      /* Right column: who is with you (top), and what has happened (below).
         Two independent scroll regions, never one — a party of four must stay
         readable while the chronicle runs on underneath it. */
      .dungeon-hud__side {
        grid-column: 3;
        grid-row: 2;
        display: flex;
        flex-direction: column;
        min-height: 0;
        overflow: hidden;
        border-left: 1px dashed color-mix(in srgb, var(--_border) 40%, transparent);
        font-family: var(--_mono);
        font-size: 10px;
        color: var(--_phosphor-dim);
        background: var(--color-surface);
      }
      .dungeon-hud__party {
        flex: 0 0 auto;
        max-height: 58%;
        overflow-y: auto;
        padding: 8px;
      }
      .dungeon-hud__chronicle {
        flex: 1 1 0;
        min-height: 0;
        display: flex;
        flex-direction: column;
        border-top: 1px dashed color-mix(in srgb, var(--_border) 55%, transparent);
      }
      .dungeon-hud__chronicle velg-dungeon-chronicle {
        flex: 1 1 0;
        min-height: 0;
      }
      .dungeon-hud__actions {
        grid-column: 1 / -1;
        grid-row: 3;
        position: relative;
        z-index: 21;
      }

      /* ── Map rail internals ── */
      /* Override the map component's own :host{flex-shrink:0} so it fills the
         rail. The rail does NOT scroll: the map component owns exactly one
         scroll container (.map-scroll, around the DAG) and its room panel sits
         in a second, non-scrolling row. Two nested scrollers used to stack here
         — the host and .map-content — and a wheel event over a map that
         happened to fit found neither, so it bubbled to the page and moved the
         document instead of the map (remediation plan C-4). */
      .dungeon-hud__rail velg-dungeon-map {
        flex: 1 1 0;
        min-height: 0;
        overflow: hidden;
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
        .dungeon-hud__side {
          grid-column: 1;
          grid-row: 3;
          display: contents;
          border-left: none;
        }
        .dungeon-hud__party {
          grid-column: 1;
          grid-row: 3;
          flex: none;
          max-height: 96px;
          border-top: 1px dashed color-mix(in srgb, var(--_border) 40%, transparent);
          overflow-x: auto;
          overflow-y: hidden;
          background: var(--color-surface);
        }
        .dungeon-hud__chronicle {
          grid-column: 1;
          grid-row: 4;
          height: clamp(140px, 24vh, 220px);
          border-top: 1px dashed color-mix(in srgb, var(--_border) 55%, transparent);
          background: var(--color-surface);
        }
        .dungeon-hud__rail {
          grid-column: 1;
          grid-row: 5;
          border-right: none;
          border-top: 1px dashed color-mix(in srgb, var(--_border) 40%, transparent);
          height: clamp(200px, 38vh, 340px);
        }
        .dungeon-hud--rail-collapsed .dungeon-hud__rail {
          height: auto;
        }
        .dungeon-hud__actions {
          grid-column: 1;
          grid-row: 6;
        }
      }

      /* ── Scene (the stage). NO filter/transform here — that would create a
         containing block and break embedded position:fixed panels. All
         environment FX live on the .scene__backdrop LEAF and its children. ── */
      /* Zones, declared once. The scene used to stack four absolutely
         positioned layers at percentage offsets and let a bottom-anchored
         narrative box grow upward into them: the text cut through the party's
         name labels, and no combination of offsets could avoid it because the
         box height depends on the prose. Rows cannot overlap, so the collision
         class is gone rather than each instance being nudged out of the way.

         The atmosphere planes (art, backdrop, floor, motes, alarm, FX canvas)
         stay position:absolute — they are full-bleed backgrounds and overlays,
         not content, and must span every row. */
      .scene {
        position: relative;
        flex: 1;
        min-height: 220px;
        overflow: hidden;
        border: 1px solid color-mix(in srgb, var(--_border) 50%, transparent);
        display: grid;
        /* The STAGE gets the guaranteed height, the TEXT gets the flexible one.
           The first version had it the other way round: foes took the 1fr track
           and the chamber text an auto row. Measured in a live fight, where the combat
           bar leaves the scene 255px, that gave the enemy band 2px — the
           creatures were clamped to their 44px floor and drew 33px ABOVE the
           scene, invisible. The text can scroll (it has overscroll containment);
           a creature cannot. So the band gets a floor and the prose yields. */
        grid-template-rows: auto minmax(132px, 1fr) auto minmax(0, auto);
        grid-template-areas:
          'readout'
          'foes'
          'party'
          'text';
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
      /* The wait, made honest. A 1920px backdrop takes seconds on a cold cache,
         and the scene used to show six seconds of flat green nothing — the
         player could not tell a slow load from a broken one. The skeleton is
         tinted with the archetype's own accent and breathes, so the frame reads
         as "arriving" from the first paint. */
      .scene__skeleton {
        position: absolute;
        inset: 0;
        background:
          radial-gradient(
            120% 80% at 50% 78%,
            color-mix(in srgb, var(--_fx-accent) 14%, transparent) 0%,
            transparent 62%
          ),
          linear-gradient(
            to bottom,
            color-mix(in srgb, var(--_fx-accent) 7%, var(--color-surface)) 0%,
            var(--color-surface) 70%
          );
      }
      @media (prefers-reduced-motion: no-preference) {
        .scene__skeleton {
          animation: scene-skeleton-breathe 2.4s var(--ease-in-out, ease-in-out) infinite;
        }
        @keyframes scene-skeleton-breathe {
          0%,
          100% {
            opacity: 0.75;
          }
          50% {
            opacity: 1;
          }
        }
      }
      .scene__art-img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
        opacity: 0;
        transition:
          opacity 520ms var(--ease-out, ease),
          filter 600ms var(--ease-out, ease);
        /* Dim at rest, dimmer + desaturated as pressure rises (foreboding). */
        filter: brightness(calc(0.6 - var(--_p) * 0.24)) saturate(calc(0.9 - var(--_p) * 0.35))
          contrast(1.03);
      }
      .scene__art--ready .scene__art-img {
        opacity: 1;
      }
      .scene__art--ready .scene__skeleton {
        opacity: 0;
        animation: none;
        transition: opacity 520ms var(--ease-out, ease);
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
        grid-area: party;
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

      /* In-scene hostiles — the mirror of the party band. They stand DEEPER in
         the chamber (upper band, smaller footprint = further from the eye), so
         the stage reads front-to-back instead of as one flat row. The party
         owns the lower band; the combat-FX layer already assumes exactly this
         split ("damage to enemies in the upper band").

         Two representations share one figure box (FOE_GEOMETRY sizes it by
         threat_level either way, so a boss reads as a boss before a single
         label is parsed): the published creature ART, and the clip-path
         SILHOUETTE as the fallback for a creature with no art or whose art
         failed to load. Both stand on the same floor pool and carry the same
         condition colour, so a band mixing the two still reads as one scene. */
      /* The band stretches across its whole grid row, which is a definite 1fr
         track. That definiteness is what lets the creatures size themselves as
         a FRACTION OF THE BAND (see FOE_GEOMETRY) instead of guessing from
         viewport width. */
      .scene__enemies {
        position: relative;
        grid-area: foes;
        align-self: stretch;
        min-height: 0;
        z-index: 2;
        pointer-events: none;
        display: flex;
        justify-content: center;
        align-items: flex-end;
        gap: clamp(14px, 4vw, 46px);
        padding: 0 16px;
      }
      .foe {
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-end;
        gap: 5px;
        min-width: 0;
        animation: foe-loom var(--duration-entrance, 350ms) var(--ease-dramatic, ease) both;
        animation-delay: calc(var(--i, 0) * 90ms);
      }
      /* Height from the band; width from the creature. The art is mass-cropped,
         so each cutout carries its own proportions and the box follows the
         image — no per-creature data in CSS. --_foe-chrome reserves the intent
         chip and the name below the figure so a boss cannot push them out of
         the band. */
      .foe__figure {
        --_foe-chrome: 34px;
        position: relative;
        display: flex;
        justify-content: center;
        align-items: flex-end;
        flex: 0 0 auto;
        height: clamp(
          44px,
          calc(var(--_foe-scale, 1) * (100% - var(--_foe-chrome))),
          320px
        );
        animation: foe-sway 5.4s var(--ease-in-out, ease-in-out) infinite;
        animation-delay: calc(var(--i, 0) * -700ms);
      }
      /* The silhouette fallback has no intrinsic size — its polygon needs a box,
         so the tier's aspect ratio supplies one. */
      .foe__figure--silhouette {
        aspect-ratio: var(--_foe-ratio, 0.62);
      }
      /* Published creature art. A leaf element, so the filter here never
         creates a containing block for the HUD's fixed-position overlays (same
         reasoning as .scene__art-img above).

         object-fit contain plus a bottom object-position stands the creature ON
         the floor whatever its aspect ratio — the cutouts are mass-cropped, so a
         wisp is narrow and a warden broad, and only the baseline is shared.

         Condition reads through WEAR rather than through colour: art cannot be
         recoloured the way a silhouette can without turning into a stain, so a
         hurt creature loses saturation and light instead. The condition tint
         survives in the drop-shadow, the floor pool and the name, which is
         where the eye picks it up in a band this small. */
      /* Cut-outs on a dark chamber wall need a RIM, not more glow. The creatures
         are dark by design and the backdrop is darker still, so a soft halo just
         raised the floor around them; the figures read as smudges. Four tight
         drop-shadows at the cardinal directions trace the alpha edge — the
         standard silhouette-separation trick — and only then does the wide
         condition halo sit behind it. The rim carries the condition tint too,
         so a hurt creature is outlined in the colour of its state. */
      .foe__art {
        display: block;
        height: 100%;
        width: auto;
        max-width: 22vw;
        --_rim: color-mix(in srgb, var(--_cond) 62%, var(--color-text-primary));
        filter: saturate(calc(1 - var(--_wear, 0) * 0.72))
          brightness(calc(1.08 - var(--_wear, 0) * 0.32))
          drop-shadow(1px 0 0 var(--_rim)) drop-shadow(-1px 0 0 var(--_rim))
          drop-shadow(0 1px 0 var(--_rim)) drop-shadow(0 -1px 0 var(--_rim))
          drop-shadow(0 0 calc(var(--_foe-glow, 0.8) * 16px) color-mix(in srgb, var(--_cond) 40%, transparent));
        transition: filter var(--duration-slow, 300ms) var(--ease-out, ease-out);
      }
      /* Elites and bosses earn a heavier rim: rank has to read at a glance, and
         at band scale a size difference does not. */
      .foe[data-tier='elite'] .foe__art,
      .foe[data-tier='boss'] .foe__art {
        --_rim: color-mix(in srgb, var(--_cond) 82%, var(--color-text-primary));
      }
      .foe[data-tier='boss'] .foe__art {
        filter: saturate(calc(1 - var(--_wear, 0) * 0.72))
          brightness(calc(1.14 - var(--_wear, 0) * 0.32))
          drop-shadow(2px 0 0 var(--_rim)) drop-shadow(-2px 0 0 var(--_rim))
          drop-shadow(0 2px 0 var(--_rim)) drop-shadow(0 -2px 0 var(--_rim))
          drop-shadow(0 0 26px color-mix(in srgb, var(--_cond) 55%, transparent));
      }
      /* The rank mark in front of the name — the only place tier is spelled out. */
      .foe__rank {
        margin-right: 3px;
        color: var(--_cond);
      }
      .foe[data-tier='boss'] .foe__name {
        letter-spacing: 1.6px;
        color: color-mix(in srgb, var(--_cond) 70%, var(--color-text-primary));
      }
      /* A darker pad under the band lifts every creature off the wall without
         touching the backdrop art itself. */
      .scene__enemies::before {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        top: 0;
        bottom: 0;
        pointer-events: none;
        background: radial-gradient(
          120% 78% at 50% 84%,
          color-mix(in srgb, var(--color-surface) 62%, transparent) 0%,
          transparent 72%
        );
      }

      /* The silhouette fallback — a leaf element, so the drop-shadow here never
         creates a containing block for the HUD's fixed-position overlays. */
      .foe__body {
        position: absolute;
        inset: 0;
        clip-path: var(--_foe-shape);
        background: linear-gradient(
          to top,
          color-mix(in srgb, var(--_cond) 66%, var(--color-surface)),
          color-mix(in srgb, var(--_cond) 26%, var(--color-surface)) 60%,
          color-mix(in srgb, var(--_cond) 48%, transparent)
        );
        filter: drop-shadow(0 0 calc(var(--_foe-glow, 0.8) * 22px) color-mix(in srgb, var(--_cond) 38%, transparent));
      }
      /* Paired eye-glow — the one warm signal on an otherwise unlit mass. */
      .foe__eyes {
        position: absolute;
        top: var(--_foe-eye-top, 16%);
        left: 50%;
        width: 56%;
        height: 12%;
        transform: translateX(-50%);
        background:
          radial-gradient(
            closest-side,
            color-mix(in srgb, var(--_cond) 92%, var(--color-text-primary)),
            transparent
          ),
          radial-gradient(
            closest-side,
            color-mix(in srgb, var(--_cond) 92%, var(--color-text-primary)),
            transparent
          );
        background-size: 34% 100%, 34% 100%;
        background-position: 12% 50%, 88% 50%;
        background-repeat: no-repeat;
        animation: foe-glare 3.2s var(--ease-in-out, ease-in-out) infinite;
      }
      /* The creature's hit area. The BAND stays pointer-events:none so the
         stage below keeps receiving events; only this button takes them back.
         It carries the creature's whole description as its accessible name —
         the band is the enemy list in graphical mode, so the semantics live
         here rather than in a second list beside it. */
      .foe__probe {
        position: absolute;
        inset: 0;
        pointer-events: auto;
        padding: 0;
        border: 1px solid transparent;
        background: none;
        cursor: zoom-in;
        transition: border-color var(--transition-fast, 100ms ease);
      }
      .foe__probe:disabled {
        cursor: default;
      }
      .foe__probe:hover:not(:disabled),
      .foe__probe:focus-visible {
        border-color: color-mix(in srgb, var(--_cond) 70%, transparent);
      }
      .foe__probe:focus-visible {
        outline: 2px solid var(--_phosphor);
        outline-offset: 2px;
      }
      /* Tier, condition and the telegraphed blow — the facts the side panel
         used to carry. Held back until the creature is hovered or focused so
         the band stays a stage rather than a table. */
      .foe__facts {
        max-width: 150px;
        font-family: var(--_mono);
        font-size: 8px;
        letter-spacing: 0.4px;
        text-align: center;
        color: var(--_phosphor-dim);
        opacity: 0;
        transition: opacity var(--transition-fast, 100ms ease);
      }
      .foe:hover .foe__facts,
      .foe:focus-within .foe__facts {
        opacity: 1;
      }

      /* Floor pool, mirroring the party's ground anchor. */
      /* Percentages of the figure box, so the pool grows with the creature
         instead of staying a fixed 18px smudge under a 300px boss. */
      .foe__pool {
        position: absolute;
        left: 50%;
        bottom: -6%;
        width: 150%;
        height: 14%;
        transform: translateX(-50%);
        border-radius: 50%;
        background: radial-gradient(
          closest-side,
          color-mix(in srgb, var(--_cond) 24%, transparent),
          transparent 72%
        );
      }
      /* Telegraphed intent — Into the Breach's core promise: you see the blow
         before it lands. Colour comes from the ACTION's own threat scale
         (low/medium/high/critical), never from the enemy's tier. */
      .foe__intent {
        display: flex;
        align-items: center;
        gap: 3px;
        max-width: 132px;
        padding: 1px 4px;
        border: 1px solid color-mix(in srgb, var(--_intent) 55%, transparent);
        background: color-mix(in srgb, var(--_intent) 14%, var(--color-surface));
        font-family: var(--font-brutalist, var(--_mono));
        font-size: 8px;
        font-weight: 700;
        letter-spacing: 0.6px;
        text-transform: uppercase;
        color: color-mix(in srgb, var(--_intent) 45%, var(--color-text-primary));
        animation: foe-intent-pulse 1.8s var(--ease-in-out, ease-in-out) infinite;
      }
      .foe__intent-text {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .foe__name {
        max-width: 124px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-family: var(--font-brutalist, var(--_mono));
        font-size: 8px;
        font-weight: 700;
        letter-spacing: 1px;
        text-transform: uppercase;
        color: color-mix(in srgb, var(--_cond) 40%, var(--color-text-secondary));
        text-shadow: 0 1px 2px var(--color-surface);
      }
      /* Defeated: the figure drops out of the fight and stops drawing the eye. */
      .foe--dead {
        opacity: 0.28;
      }
      .foe--dead .foe__figure {
        animation: foe-fall 520ms var(--ease-slam, ease-in) both;
      }
      .foe--dead .foe__eyes {
        animation: none;
        opacity: 0;
      }
      /* A downed creature stops being a target for the eye. The defeated wear
         value already drains it; grayscale takes the last of the colour so the
         living hostiles keep the band's attention. */
      .foe--dead .foe__art {
        filter: grayscale(1) brightness(0.62);
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
      /* Degradation notice: the FX renderer refused to start (no WebGL2, or a
         CSP that blocks Pixi's shader compilation). The round still resolves —
         but the player must be told the layer is missing rather than mistaking
         a dead renderer for a quiet round. */
      velg-dungeon-combat-fx .fx-degraded {
        position: absolute;
        right: 12px;
        bottom: 10px;
        margin: 0;
        max-width: min(280px, 60%);
        padding: 4px 8px;
        border: 1px solid color-mix(in srgb, var(--color-warning) 45%, transparent);
        background: color-mix(in srgb, var(--color-surface) 82%, transparent);
        color: var(--color-warning);
        font-family: var(--font-brutalist, var(--_mono));
        font-size: 9px;
        letter-spacing: 1px;
        text-transform: uppercase;
        line-height: 1.4;
      }

      /* ── Foreground content ── */
      .scene__readout {
        grid-area: readout;
        justify-self: start;
        margin: 10px 0 0 12px;
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

      /* ── Chamber text: the room's own row, so it can never grow into the
         party figures. Bounded height with its own scroll — a long encounter
         must not push the stage out of the frame.

         A LETTERBOX BAND, not a plate. The previous version was a box with a
         3px accent stripe down its left edge and a 68ch max-width on the BOX,
         which cut a hard vertical edge across the stage at about 62% width — a
         rectangle sitting on the picture. The band now spans the full stage and
         fades upward into it; 68ch moved inward to bound the TEXT MEASURE,
         which is what the number was ever about. The accent stripe is gone: a
         coloured bar down the left of a panel is the one gesture that marks an
         interface as machine-assembled, and it was doing no work here that the
         gradient does not do better. ── */
      .chamber {
        grid-area: text;
        z-index: 4;
        min-height: 0;
        padding: 16px 16px 14px;
        max-height: min(38vh, 260px);
        overflow-y: auto;
        overscroll-behavior: contain;
        background: linear-gradient(
          to top,
          color-mix(in srgb, var(--color-surface) 95%, transparent) 0%,
          color-mix(in srgb, var(--color-surface) 88%, transparent) 45%,
          color-mix(in srgb, var(--color-surface) 55%, transparent) 80%,
          transparent 100%
        );
        animation: banter-rise var(--duration-entrance, 350ms) var(--ease-dramatic, ease);
      }
      .chamber p {
        margin: 0;
      }
      /* The text measure. 68ch of prose, centred on the stage — the band is
         full width, the reading is not. */
      .chamber__measure {
        max-width: 68ch;
        margin: 0 auto;
      }
      .chamber__measure > * + * {
        margin-top: 9px;
      }
      /* ── Three roles, not five treatments ──
         VOICE   an operative reacting. Serif, italic, full strength.
         PLACE   where you are, what is in it, what is happening. Serif; the
                 situation is the emphatic member of the role.
         READING the archetype's pressure, in words. Tied to the meter above by
                 COLOUR, no longer by monospace: monospace means "system
                 output" in this design system, and this is prose.
         Before, five paragraphs carried five different treatments with no key a
         player could learn. ── */

      /* VOICE */
      .chamber__banter {
        font-family: var(--font-bureau, var(--font-prose, serif));
        font-size: 13.5px;
        font-style: italic;
        line-height: 1.5;
        color: var(--color-text-primary);
      }

      /* PLACE */
      /* The room's mark is the one brutalist element in the band — the
         terminal has always printed "REST SITE" / "BOSS CHAMBER" and the scene
         never did, so a graphical player could not tell a treasure room from an
         ordinary one without reading for clues. */
      .chamber__mark {
        font-family: var(--font-brutalist, var(--_mono));
        font-size: 9px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1.4px;
        color: color-mix(in srgb, var(--_fx-accent) 75%, var(--color-text-muted));
      }
      .chamber__ambient,
      .chamber__anchor {
        font-family: var(--font-bureau, var(--font-prose, serif));
        font-size: 13px;
        line-height: 1.55;
        color: var(--color-text-secondary);
      }
      /* Objects belong to the room: one indented group, without the hairline
         rule that used to repeat the accent-stripe gesture. */
      .chamber__anchor {
        padding-left: 1.4em;
        color: var(--color-text-muted);
      }
      /* The situation. It carries the choices in the action bar, so it is the
         one paragraph a player must actually read — and it is set to be found
         without counting paragraphs. */
      .chamber__encounter {
        font-family: var(--font-bureau, var(--font-prose, serif));
        font-size: 15.5px;
        line-height: 1.6;
        color: var(--color-text-primary);
        padding-top: 9px;
        border-top: 1px solid color-mix(in srgb, var(--_border) 45%, transparent);
      }
      .chamber__encounter p + p {
        margin-top: 8px;
      }
      /* A Threshold toll is written sparser in the terminal; the scene answers
         with air and a narrower measure, not with another coloured rule. */
      .chamber__encounter--threshold {
        max-width: 46ch;
        margin: 0 auto;
        padding: 12px 0 4px;
        border-top-color: color-mix(in srgb, var(--_fx-accent) 45%, transparent);
        font-style: italic;
        letter-spacing: 0.2px;
        text-align: center;
      }
      /* READING */
      .chamber__barometer {
        font-family: var(--font-bureau, var(--font-prose, serif));
        font-size: 12px;
        letter-spacing: 0.3px;
        color: color-mix(in srgb, var(--_fx-accent) 62%, var(--color-text-secondary));
      }
      .chamber--empty {
        background: none;
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
      /* The lobby has no HUD header, so the toggle sits on the title line. */
      .lobby-titlebar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 8px;
      }
      .lobby-info__title {
        font-family: var(--font-brutalist, var(--_mono));
        font-weight: 700;
        font-size: 14px;
        text-transform: uppercase;
        letter-spacing: 1.5px;
        color: var(--_phosphor);
      }
      .lobby-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 12px;
      }
      /* The card is a stage, not a row: the archetype's establishing shot fills
         it, a scrim from the bottom keeps the text legible over any image, and
         name + facts sit in front. Without the art the cards were five
         indistinguishable rectangles whose only difference was a name — and in
         override mode not even the numbers differed. */
      .lobby-card {
        position: relative;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        gap: 6px;
        min-height: 172px;
        padding: 14px;
        overflow: hidden;
        border: 1px solid color-mix(in srgb, var(--_border) 40%, transparent);
        background: color-mix(in srgb, var(--color-surface-raised) 70%, transparent);
        box-shadow: var(--shadow-sm);
      }
      /* A leaf <img>, so the filter never creates a containing block for the
         HUD's fixed-position overlays (same reasoning as .scene__art-img).

         FULL opacity plus a brightness filter — the same treatment
         .scene__art-img uses for these very images, and the showcase slides
         before it. The first version of this rule dimmed with opacity 0.42
         instead, which blends the picture toward the near-black card ground and
         collapses its own contrast: on production the cards read as empty
         rectangles although the images had loaded (1920px, complete). Filters
         scale the image's values and keep a picture legible as a picture. */
      .lobby-card__art {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center;
        filter: brightness(0.62) saturate(0.85) contrast(1.05);
        transition: filter var(--transition-normal, 200ms ease);
      }
      /* The scrim lives on the card, not on the image: it must also darken the
         plain background when a card has no art. Tight to the text band — the
         upper half stays picture. */
      .lobby-card::after {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: linear-gradient(
          to top,
          var(--color-surface) 0%,
          color-mix(in srgb, var(--color-surface) 84%, transparent) 34%,
          color-mix(in srgb, var(--color-surface) 32%, transparent) 62%,
          transparent 100%
        );
      }
      /* What this descent is actually about. The three numbers below were the
         same on every card; this line is the only thing that differs, so it is
         the only thing a player can choose on. */
      .lobby-card__brief {
        position: relative;
        z-index: 1;
        font-family: var(--font-bureau, var(--font-prose, serif));
        font-size: 12px;
        line-height: 1.5;
        color: color-mix(in srgb, var(--color-text-primary) 82%, transparent);
        display: -webkit-box;
        -webkit-line-clamp: 3;
        line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .lobby-card__name,
      .lobby-card__brief,
      .lobby-card__meta {
        position: relative;
        z-index: 1;
      }
      .lobby-card--available:hover .lobby-card__art,
      .lobby-card--available:focus-visible .lobby-card__art {
        filter: brightness(0.85) saturate(1) contrast(1.05);
      }
      /* Why this archetype is listed when no resonance put it there. Dashed and
         in the warning tone, like every other "this is not a measurement"
         marker in the dungeon UI. */
      .lobby-card__origin {
        padding: 0 5px;
        border: 1px dashed color-mix(in srgb, var(--color-warning) 40%, transparent);
        color: var(--color-warning);
        text-transform: uppercase;
        letter-spacing: 0.5px;
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
        text-shadow: 0 1px 3px var(--color-surface);
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

      /* ── Outcome: the account of a finished descent ──
         Two columns on desktop: the verdict on the left, the full chronicle on
         the right. The chronicle is the SAME component the HUD uses — the run's
         record does not get re-derived to be read once more. */
      .outcome {
        display: grid;
        grid-template-columns: minmax(240px, 340px) 1fr;
        gap: 20px;
        flex: 1;
        min-height: 0;
      }
      .outcome__verdict {
        display: flex;
        flex-direction: column;
        gap: 10px;
        align-self: start;
        padding: 16px;
        border: 1px solid color-mix(in srgb, var(--_border) 70%, transparent);
        border-top: 3px solid var(--_verdict, var(--_phosphor));
        background: color-mix(in srgb, var(--color-surface-raised) 92%, transparent);
      }
      .outcome__label {
        font-family: var(--font-brutalist, var(--_mono));
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1.5px;
        color: var(--_phosphor-dim);
      }
      .outcome__title {
        font-family: var(--font-brutalist, var(--_mono));
        font-size: 22px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 2px;
        line-height: 1.15;
        color: var(--_verdict, var(--_phosphor));
      }
      .outcome__archetype {
        font-family: var(--_mono);
        font-size: 12px;
        color: var(--_phosphor-dim);
      }
      .outcome__note {
        font-family: var(--_mono);
        font-size: 11px;
        line-height: 1.6;
        color: var(--color-text-secondary);
      }
      .outcome__btn {
        margin-top: 4px;
        padding: 9px 14px;
        border: 1px solid var(--_phosphor-dim);
        background: transparent;
        color: var(--_phosphor);
        font-family: var(--font-brutalist, var(--_mono));
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1.2px;
        cursor: pointer;
        transition:
          background var(--transition-fast, 100ms ease),
          border-color var(--transition-fast, 100ms ease);
      }
      .outcome__btn:hover {
        border-color: var(--_phosphor);
        background: color-mix(in srgb, var(--_phosphor) 12%, transparent);
      }
      .outcome__btn:focus-visible {
        outline: 2px solid var(--_phosphor);
        outline-offset: 2px;
      }
      .outcome__record {
        display: flex;
        flex-direction: column;
        min-height: 0;
        border: 1px solid color-mix(in srgb, var(--_border) 60%, transparent);
        background: var(--color-surface);
      }
      .outcome__record velg-dungeon-chronicle {
        flex: 1 1 0;
        min-height: 0;
      }
      @media (max-width: 899px) {
        .outcome {
          grid-template-columns: 1fr;
          overflow-y: auto;
        }
        .outcome__record {
          height: clamp(220px, 40vh, 420px);
        }
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
      /* Hover is a hint, selection is a commitment — they must not look alike.
         Both used to set border-color to the same phosphor, distinguished only
         by a 12% background tint that is invisible at a glance on a dark card.
         A player moving the mouse across the roster saw cards "light up"
         exactly as selection does. Hover now lifts; selection marks. */
      .picker-card:hover:not(:disabled) {
        border-color: color-mix(in srgb, var(--_phosphor) 55%, transparent);
        box-shadow: var(--shadow-md);
      }
      .picker-card:focus-visible {
        outline: 2px solid var(--_phosphor);
        outline-offset: 2px;
      }
      .picker-card--selected {
        border-color: var(--_phosphor);
        border-left-width: 3px;
        background: color-mix(in srgb, var(--_phosphor) 18%, var(--color-surface-raised));
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
      /* Two lines rather than an ellipsis: six of the eight agents in the test
         simulation were cut ("Chrysanthe the Res…", "Formicastra the Si…"), and
         a name one cannot read is not a choice one can make. The card grid has
         the vertical room; it never had the horizontal room. */
      .picker-card__name {
        font-family: var(--_mono);
        font-size: 12px;
        font-weight: 600;
        line-height: 1.3;
        color: var(--color-text-primary);
        overflow-wrap: anywhere;
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
      /* Baseline values: the numbers combat will use, but never assigned to this
         agent. Dashed and dimmed so they cannot be mistaken for a measurement. */
      .apt-chip--baseline {
        border-style: dashed;
        color: color-mix(in srgb, var(--_phosphor-dim) 70%, transparent);
      }
      .apt-chip--unknown {
        border-style: dashed;
        border-color: color-mix(in srgb, var(--color-warning) 40%, transparent);
        color: var(--color-warning);
        text-transform: uppercase;
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
      .picker__count-need {
        margin-left: 6px;
        color: var(--color-warning);
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
      @keyframes foe-loom {
        from {
          opacity: 0;
          transform: translateY(-10px) scale(0.94);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      @keyframes foe-sway {
        0%,
        100% {
          transform: translateY(0);
        }
        50% {
          transform: translateY(-3px);
        }
      }
      @keyframes foe-glare {
        0%,
        100% {
          opacity: 0.55;
        }
        50% {
          opacity: 1;
        }
      }
      @keyframes foe-intent-pulse {
        0%,
        100% {
          opacity: 0.72;
        }
        50% {
          opacity: 1;
        }
      }
      @keyframes foe-fall {
        from {
          transform: translateY(0) rotate(0deg);
        }
        to {
          transform: translateY(12px) rotate(-7deg);
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

      /* The enemy band arrived after this block was written and was never
         added to it: foe-sway, foe-glare and foe-intent-pulse all run without
         end, which is precisely the motion this query exists to stop. */
      @media (prefers-reduced-motion: reduce) {
        .scene__plane,
        .scene__alarm,
        .chamber,
        .scene__backdrop,
        .scene__motes,
        .scene__art-img,
        .foe,
        .foe__figure,
        .foe__eyes,
        .foe__intent,
        .foe__art,
        .foe__probe,
        .foe__facts,
        .op,
        .op__figure,
        .lobby-card,
        .lobby-card__art {
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

  /** Art URLs that failed to load, so the creature falls back to its silhouette
   *  instead of leaving a broken box in the band. A Set rather than the
   *  backdrop's single slot: a fight holds up to four distinct creatures, and
   *  one missing asset must not blank the others. Replaced, never mutated —
   *  Lit compares by reference. */
  @state() private _failedEnemyArt: ReadonlySet<string> = new Set();
  /** Creature currently enlarged from the band, or null. */
  @state() private _enemyArtLightbox: { url: string; facts: EnemyFacts } | null = null;
  /** Backdrop URLs that have painted at least once. Keyed by URL so moving
   *  between archetypes re-shows the skeleton for an image not yet seen, while
   *  a cached one appears without a flash of placeholder. */
  @state() private _decodedBackdrops: ReadonlySet<string> = new Set();
  /** Archetype whose party is being assembled in the graphical picker. Null =
   *  show the archetype grid; non-null = show the agent picker. This replaces
   *  the terminal-only agent picker so a run can start entirely from the
   *  graphical lobby (no terminal toggle required). */
  @state() private _pickerArchetype: string | null = null;
  /** Agent IDs selected for the descent party (2–4 required to begin). */
  @state() private _pickerSelection: string[] = [];
  /** True while the create-run request is in flight (disables the controls). */
  @state() private _startingRun = false;
  /**
   * The descent that just ended, held so its outcome can be read.
   *
   * `_exitDungeon()` (dungeon-commands.ts) tears the run down BEFORE the
   * handler's closing lines — the victory block, the loot list, the wipe — are
   * appended. The terminal does not mind: its scrollback is the outcome screen.
   * The graphical view had no scrollback, so `isInDungeon` flipped false and
   * render() swapped to the lobby in the same tick, and a player never saw how
   * their run ended. This holds the last known run so the view can show it.
   *
   * View-local on purpose: the shared state model is not wrong, and the
   * terminal must keep behaving exactly as it does (DungeonView's standing
   * contract). The panel is a SECOND RENDERER of the chronicle stream, which is
   * the same principle the chronicle itself is built on.
   */
  @state() private _endedRun: { archetype: string; phase: DungeonPhase } | null = null;

  /** Rolling copy of the run state, so the tick that nulls it still knows what
   *  ended. Not @state — it feeds `_endedRun`, which is what renders. */
  private _lastRunSnapshot: { archetype: string; phase: DungeonPhase } | null = null;

  private _wakeLock: WakeLockReleasable | null = null;
  private _resizeObserver: ResizeObserver | null = null;

  override async connectedCallback(): Promise<void> {
    super.connectedCallback();
    // Measure the host's real top offset (below the global header + simulation
    // header/nav) so the view fills exactly to the viewport bottom. Re-measure
    // on viewport resize — the chrome above can change height (responsive,
    // theme, alpha build-strip). rAF defers the first read past initial layout.
    requestAnimationFrame(() => this._measureHostOffset());
    this._resizeObserver = new ResizeObserver(() => this._measureHostOffset());
    this._resizeObserver.observe(document.documentElement);
    await this._initialize();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    this._releaseWakeLock();
    terminalState.clearDungeon();
    terminalState.dispose();
  }

  /**
   * Watch for the run ending under us.
   *
   * Reading the signals here keeps them tracked by SignalWatcher, so the flip
   * is observed in the same update that would otherwise have shown the lobby.
   */
  protected willUpdate(): void {
    const state = dungeonState.clientState.value;
    if (state) {
      this._lastRunSnapshot = { archetype: state.archetype, phase: state.phase };
      if (this._endedRun) this._endedRun = null;
      return;
    }
    // clientState went null while we were showing a scene: the run just ended.
    if (this._lastRunSnapshot && !this._endedRun) {
      this._endedRun = this._lastRunSnapshot;
      this._lastRunSnapshot = null;
    }
  }

  /** Dismiss the outcome and return to the archetype grid. */
  private _dismissOutcome(): void {
    this._endedRun = null;
  }

  /** A backdrop has painted: cross-fade it in over the skeleton. Replaced,
   *  never mutated — Lit compares by reference (same rule as _failedEnemyArt). */
  private _markBackdropReady(url: string): void {
    if (this._decodedBackdrops.has(url)) return;
    this._decodedBackdrops = new Set([...this._decodedBackdrops, url]);
  }

  /** Couple the host height to its real top offset (see the `:host` height
   *  rule). Measured only at rest — once the view fits, the page no longer
   *  scrolls, so a scrolled reading would be a transient we skip. */
  private _measureHostOffset(): void {
    if (window.scrollY > 4) return;
    const top = Math.round(this.getBoundingClientRect().top);
    if (top > 0) this.style.setProperty('--_host-offset', `${top}px`);
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
      const lines = await parseAndExecute(command);
      this._absorb(lines);
    } catch (err) {
      captureError(err, { source: 'VelgDungeonGraphicalView._runCommand', command });
      VelgToast.error(err instanceof Error ? err.message : msg('Command failed.'));
    } finally {
      terminalState.isLoading.value = false;
    }
  }

  /**
   * The single sink for command output in this view.
   *
   * `appendOutput` keeps the terminal buffer in sync (so toggling back to the
   * terminal shows a continuous session) and, in dungeon mode, mirrors the same
   * lines into the chronicle. Both call sites go through here so neither can
   * quietly grow a path that renders nowhere — which is exactly how the rolls
   * and results went missing in the first place.
   *
   * A refusal from the server ("Cannot move in phase: rest") also gets a toast.
   * The chronicle records it, but a player looking at the stage would otherwise
   * see a button do nothing at all. NOT captureError: a refused move is the
   * game answering, not a defect — the Sentry path stays reserved for the
   * thrown exceptions the callers already handle.
   */
  private _absorb(lines: TerminalLine[]): void {
    terminalState.appendOutput(lines);
    const refusal = lines.find((line) => line.type === 'error');
    if (refusal?.content) VelgToast.error(refusal.content);
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
      this._absorb(lines);
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
    if (dungeonState.isInDungeon.value) return this._renderScene();
    if (this._endedRun) return this._renderOutcome(this._endedRun);
    return this._renderLobby(sid);
  }

  private _renderScene() {
    const archetype = dungeonState.clientState.value?.archetype ?? '';
    const env = resolveDungeonEnvironment(archetype, dungeonState.archetypeState.value);
    const inCombat = dungeonState.isInCombat.value;
    const description = dungeonState.lastRoomDescription.value;
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
          <div class="gview-toggle">
            <velg-dungeon-view-toggle></velg-dungeon-view-toggle>
          </div>
        </div>

        ${this._renderRail()}

        <div class="dungeon-hud__main" role="main" aria-label=${msg('Dungeon scene')}>
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
                ? html`<div
                  class="scene__art ${
                    this._decodedBackdrops.has(backdropUrl) ? 'scene__art--ready' : ''
                  }"
                  aria-hidden="true"
                >
                  <div class="scene__skeleton"></div>
                  <img
                    class="scene__art-img"
                    src=${backdropUrl}
                    alt=""
                    decoding="async"
                    @load=${() => this._markBackdropReady(backdropUrl)}
                    @error=${() => {
                      this._failedBackdrop = backdropUrl;
                      captureError(new Error(`Dungeon backdrop failed to load: ${backdropUrl}`), {
                        source: 'VelgDungeonGraphicalView._renderScene',
                      });
                    }}
                  />
                </div>`
                : html`
                  <div class="scene__floor" aria-hidden="true"></div>
                  <div class="scene__motes" aria-hidden="true"></div>
                `
            }
            ${this._renderEnemies()}
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

            ${this._renderChamberText(description)}
          </div>
        </div>

        <velg-lightbox
          .src=${this._enemyArtLightbox?.url ?? null}
          .alt=${this._enemyArtLightbox?.facts.spoken ?? ''}
          .caption=${this._enemyArtLightbox?.facts.spoken ?? ''}
          @lightbox-close=${() => {
            this._enemyArtLightbox = null;
          }}
        ></velg-lightbox>

        <div class="dungeon-hud__side">
          <div class="dungeon-hud__party" role="complementary" aria-label=${msg('Party status')}>
            <velg-dungeon-party-panel></velg-dungeon-party-panel>
          </div>
          <div
            class="dungeon-hud__chronicle"
            role="complementary"
            aria-label=${msg('Chronicle of the descent')}
          >
            <velg-dungeon-chronicle></velg-dungeon-chronicle>
          </div>
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
      <div class="scene__party" data-fx-band="party" aria-hidden="true">
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

  /** Retire one creature's art after a failed load and fall back to its
   *  silhouette. Observed once per URL, not once per render: the Set already
   *  suppresses the repeat, and a declared-but-unreachable asset is a real
   *  content/storage mismatch (the pack claims a path the bucket does not
   *  serve) that should not disappear silently. */
  private _markEnemyArtFailed(url: string) {
    if (this._failedEnemyArt.has(url)) return;
    this._failedEnemyArt = new Set([...this._failedEnemyArt, url]);
    captureError(new Error(`Enemy scene art failed to load: ${url}`), {
      source: 'VelgDungeonGraphicalView._markEnemyArtFailed',
    });
  }

  /** In-scene hostile band. Enemy data exists ONLY inside dungeonState.combat
   *  (neither RoomNodeClient nor the state manager carries room occupants), so
   *  this band is necessarily combat-scoped — showing hostiles on room entry
   *  would need a backend DTO change first. Zero game logic: every value here
   *  is server-resolved. */
  private _renderEnemies() {
    const combat = dungeonState.combat.value;
    if (!combat || combat.enemies.length === 0) return nothing;

    // Reuse the panel's naming so a duplicate pair reads as "Wisp A" / "Wisp B"
    // in BOTH surfaces instead of drifting apart.
    const displayNames = buildEnemyDisplayNames(combat.enemies);

    return html`
      <div
        class="scene__enemies"
        data-fx-band="foes"
        role="list"
        aria-label=${msg('Hostiles')}
      >
        ${combat.enemies.map((enemy, i) => {
          const geom = FOE_GEOMETRY[enemy.threat_level] ?? FOE_GEOMETRY.standard;
          const cond = FOE_CONDITION[enemy.condition_display] ?? FOE_CONDITION_FALLBACK;
          const dead = !enemy.is_alive;
          const action = dead ? null : enemy.telegraphed_action;
          const intent = action
            ? (FOE_INTENT[action.threat_level] ?? 'var(--color-warning)')
            : 'var(--color-warning)';
          const artUrl = dungeonEnemyArtUrl(enemy.image_path);
          const showArt = artUrl !== null && !this._failedEnemyArt.has(artUrl);
          const displayName = displayNames.get(enemy.instance_id) ?? enemy.name_en;
          const facts = describeEnemy(enemy, displayName);
          return html`
            <div
              class="foe ${dead ? 'foe--dead' : ''}"
              role="listitem"
              data-tier=${enemy.threat_level}
              style="--i:${i};--_cond:${cond.tint};--_wear:${cond.wear};--_intent:${intent};--_foe-scale:${geom.scale};--_foe-glow:${geom.scale};--_foe-ratio:${geom.ratio};--_foe-shape:${geom.shape};--_foe-eye-top:${geom.eyeTop}"
            >
              ${
                action
                  ? html`<div class="foe__intent" aria-hidden="true">
                      ${icons.alertTriangle(8)}
                      <span class="foe__intent-text">${action.intent}</span>
                    </div>`
                  : nothing
              }
              <div class="foe__figure ${showArt ? '' : 'foe__figure--silhouette'}">
                ${
                  showArt
                    ? html`<img
                      class="foe__art"
                      src=${artUrl}
                      alt=""
                      decoding="async"
                      @error=${() => this._markEnemyArtFailed(artUrl)}
                    />`
                    : html`
                      <div class="foe__body"></div>
                      <div class="foe__eyes"></div>
                    `
                }
                <div class="foe__pool"></div>
                <button
                  class="foe__probe"
                  type="button"
                  ?disabled=${!showArt}
                  aria-label=${facts.spoken}
                  title=${facts.spoken}
                  @click=${() => showArt && artUrl && this._openEnemyArt(artUrl, facts)}
                ></button>
              </div>
              <span class="foe__name" aria-hidden="true">
                ${
                  FOE_RANK[enemy.threat_level]
                    ? html`<span class="foe__rank">${FOE_RANK[enemy.threat_level]}</span>`
                    : nothing
                }${displayName}
              </span>
              <span class="foe__facts" aria-hidden="true">${facts.line}</span>
            </div>
          `;
        })}
      </div>
    `;
  }

  /**
   * The account of a finished descent.
   *
   * Shown in place of the lobby for as long as the player wants it. The record
   * on the right is the same `<velg-dungeon-chronicle>` the HUD uses, reading
   * the same buffer — `terminalState.clearDungeon()` deliberately leaves the
   * chronicle standing so the closing lines, which are appended after the run
   * is torn down, are still in it.
   */
  private _renderOutcome(ended: { archetype: string; phase: DungeonPhase }) {
    const wiped = ended.phase === 'wiped';
    const completed = ended.phase === 'completed';
    const verdict = wiped
      ? msg('Party lost')
      : completed
        ? msg('Descent complete')
        : msg('Withdrawn');
    const note = wiped
      ? msg('No one came back up. What they carried stayed down there with them.')
      : completed
        ? msg('The resonance is spent. Everything the party carried out is theirs.')
        : msg('The party left early and kept what it had already taken.');
    // Colour carries the verdict; --_verdict feeds the panel's top rule and title.
    const verdictColor = wiped
      ? 'var(--color-danger)'
      : completed
        ? 'var(--color-success)'
        : 'var(--_phosphor)';

    return html`
      <div class="dungeon-lobby">
        <div class="outcome">
          <div class="outcome__verdict" style="--_verdict:${verdictColor}">
            <span class="outcome__label">${msg('Descent ended')}</span>
            <span class="outcome__title">${verdict}</span>
            <span class="outcome__archetype">${getArchetypeDisplayName(ended.archetype)}</span>
            <p class="outcome__note">${note}</p>
            <button class="outcome__btn" type="button" @click=${this._dismissOutcome}>
              ${msg('Return to the lobby')}
            </button>
          </div>
          <div
            class="outcome__record"
            role="region"
            aria-label=${msg('Chronicle of the descent')}
          >
            <velg-dungeon-chronicle></velg-dungeon-chronicle>
          </div>
        </div>
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
          <div class="lobby-titlebar">
            <div class="lobby-info__title">${msg('Resonance Dungeons')}</div>
            <velg-dungeon-view-toggle></velg-dungeon-view-toggle>
          </div>
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
        ${dungeons.map((d) => {
          const artUrl = dungeonBackdropUrl(d.archetype);
          const magnitude = resonanceMagnitudeLabel(d);
          return html`
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
              ${
                // The archetype's own establishing shot — the same image the
                // landing page and the detail view already use, and the one the
                // scene paints behind the run. Without it the five cards were
                // indistinguishable rectangles over 500 px of empty space,
                // differing in nothing but a name.
                artUrl
                  ? html`<img
                    class="lobby-card__art"
                    src=${artUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    aria-hidden="true"
                  />`
                  : nothing
              }
              <span class="lobby-card__name">${getArchetypeDisplayName(d.archetype)}</span>
              <span class="lobby-card__brief"
                >${getArchetypeBriefing(d.archetype).intro.join(' ')}</span
              >
              <span class="lobby-card__meta">
                ${
                  magnitude
                    ? html`<span>${magnitude}</span>`
                    : html`<span class="lobby-card__origin">${adminUnlockedLabel()}</span>`
                }
                <span>${msg('Difficulty')}: ${d.suggested_difficulty}</span>
                <span>${msg('Depth')}: ${d.suggested_depth + 1}</span>
              </span>
            </div>
          `;
        })}
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
                    ${
                      // "0/4" states the ceiling; the floor is 2, and a player
                      // who picks one agent and presses BEGIN gets no
                      // explanation for why nothing happens.
                      count < 2
                        ? html`<span class="picker__count-need">
                            ${msg('at least 2')}
                          </span>`
                        : nothing
                    }
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
    const aptitudes = dungeonState.pickerAptitudes.value;
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
                <span class="picker-card__apts">
                  ${this._renderAptChips(
                    aptitudes.levels.get(agent.id),
                    aptitudes.baselineAgentIds.has(agent.id),
                  )}
                </span>
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

  /** Enlarge one creature. The band is the enemy list in graphical mode, so
   *  "look closer" belongs to it — and the caption carries the same facts the
   *  figure announces, from the same description. */
  private _openEnemyArt(url: string, facts: EnemyFacts): void {
    this._enemyArtLightbox = { url, facts };
  }

  /**
   * The chamber's prose, in the scene.
   *
   * Renders the WHOLE room description the shared selector produced — the same
   * object, in the same reading order, that the terminal turns into lines.
   * Until now this box showed banter and a barometer line only, so 129
   * encounter templates, every anchor object and every room-type ambient line
   * were written for a surface that never displayed them.
   *
   * The parts are typographically distinct because they speak with different
   * voices: the room describes itself (ambient, anchors), the situation
   * confronts the party (encounter — the one whose choices appear as buttons in
   * the action bar below), an operative reacts (banter), and the meter reports
   * (barometer). Same content as the terminal, different register.
   */
  private _renderChamberText(description: RoomDescription | null) {
    const waiting = html`<div class="chamber chamber--empty">
      ${msg('The chamber waits. Choose your next move.')}
    </div>`;
    if (!description) return waiting;

    const { ambient, anchors, encounter, banter, barometer, isThreshold, typeLabel } = description;
    if (!ambient && anchors.length === 0 && !encounter && !banter && !barometer) return waiting;

    // NARRATIVE ORDER, not the order the data arrives in. Someone walking into
    // a room hears their companion react, registers what kind of place it is,
    // sees it, sees what is in it, and only then faces the situation. The
    // previous order opened with two grey paragraphs of scenery and put the
    // operative's remark — the only human voice in the frame — last, below the
    // very situation it was reacting to.
    return html`
      <div class="chamber" role="status" aria-live="polite">
        <div class="chamber__measure">
          ${banter ? html`<p class="chamber__banter">${banter}</p>` : nothing}
          ${typeLabel ? html`<p class="chamber__mark">${typeLabel}</p>` : nothing}
          ${ambient ? html`<p class="chamber__ambient">${ambient}</p>` : nothing}
          ${anchors.map((text) => html`<p class="chamber__anchor">${text}</p>`)}
          ${
            encounter
              ? html`<div
                class="chamber__encounter ${isThreshold ? 'chamber__encounter--threshold' : ''}"
              >
                ${encounter.split('\n').map((para) => html`<p>${para}</p>`)}
              </div>`
              : nothing
          }
          ${barometer ? html`<p class="chamber__barometer">${barometer}</p>` : nothing}
        </div>
      </div>
    `;
  }

  /**
   * Top-3 aptitudes as compact chips (shared computation with the terminal
   * picker formatter via topAptitudes).
   *
   * Three distinct states, none of them faked: assigned values, the server's
   * baseline marked as baseline, and genuinely absent data. The chips and the
   * composition warning below them read the same AptitudeIndex, so they can no
   * longer disagree.
   */
  private _renderAptChips(apts: AptitudeSet | undefined, isBaseline: boolean) {
    const top = topAptitudes(apts);
    if (top.length === 0) {
      return html`<span class="apt-chip apt-chip--unknown">${msg('No aptitude data')}</span>`;
    }
    return [
      ...top.map(
        ([k, v]) =>
          html`<span class="apt-chip ${isBaseline ? 'apt-chip--baseline' : ''}"
            >${OPERATIVE_LABEL[k] ?? k.toUpperCase()} ${v}</span
          >`,
      ),
      isBaseline
        ? html`<span class="apt-chip apt-chip--unknown" title=${msg('No aptitudes assigned – showing the baseline combat uses')}>${msg('baseline')}</span>`
        : nothing,
    ];
  }
}

/** Figure geometry per enemy threat tier (minion | standard | elite | boss —
 *  the EnemyInstance scale, NOT the TelegraphedAction low/medium/high/critical
 *  scale). `w`/`h` size the figure box for BOTH representations, so a boss
 *  looms over a minion whether it is drawn as art or as an outline.
 *
 *  `shape` and `eyeTop` belong to the SILHOUETTE path only — the fallback for a
 *  creature with no published art, or whose art failed to load. Creature art
 *  brings its own outline and its own face. */
/**
 * How large a creature stands in the band, by threat tier.
 *
 * `scale` is a FRACTION OF THE ENEMY BAND's height, not an absolute size. The
 * first version of this table was written for clip-path silhouettes, where an
 * abstract shape still reads at 30 px, and used viewport-width clamps
 * (`clamp(52px, 6vw, 76px)`). When the silhouettes were replaced by keyed
 * photographic art the sizes were carried over unchanged — so two minions stood
 * in the band at roughly 30 x 50 px, unreadable below 2x magnification, with a
 * condition halo as large as the creature and about 85 % of the band empty.
 *
 * Viewport width was the wrong reference to begin with: it says nothing about
 * how tall the stage actually is. Scaling against the band means a creature
 * keeps its proportion to the scene on any display, and the band fills.
 *
 * `ratio` (width / height) applies to the SILHOUETTE fallback only, which needs
 * an explicit box for its polygon. The published art carries its own aspect
 * ratio — the cutouts are mass-cropped, so a wisp is narrow and a warden broad
 * — and the figure box takes its width from the image.
 *
 * If these fractions grow, `SCENE_EDGE` in scripts/ingest_dungeon_enemy_art.py
 * must grow with them: the published rendition is sized for the largest a
 * creature is ever drawn. The size is part of the stored path, so the coupling
 * is visible rather than implied.
 */
/**
 * Rank marks. A creature's threat tier used to be expressed by SIZE alone — and
 * between a 44px minion and a 55px elite in a cramped band, nobody can see a
 * difference. Into the Breach's rule applies here: the player must know what is
 * dangerous BEFORE it acts, and size is not a readable channel at this scale.
 *
 * Empty for the two ordinary tiers on purpose: a mark on everything marks
 * nothing.
 */
const FOE_RANK: Record<string, string> = {
  minion: '',
  standard: '',
  elite: '\u25C6',
  boss: '\u2726',
};

const FOE_GEOMETRY: Record<
  string,
  { scale: number; ratio: number; shape: string; eyeTop: string }
> = {
  minion: {
    scale: 0.56,
    ratio: 0.6,
    shape: 'polygon(50% 0%, 72% 26%, 66% 100%, 34% 100%, 28% 26%)',
    eyeTop: '22%',
  },
  standard: {
    scale: 0.72,
    ratio: 0.62,
    shape: 'polygon(50% 0%, 74% 18%, 80% 52%, 70% 100%, 30% 100%, 20% 52%, 26% 18%)',
    eyeTop: '17%',
  },
  elite: {
    scale: 0.86,
    ratio: 0.6,
    shape:
      'polygon(50% 0%, 66% 10%, 88% 30%, 78% 56%, 72% 100%, 28% 100%, 22% 56%, 12% 30%, 34% 10%)',
    eyeTop: '14%',
  },
  boss: {
    scale: 1,
    ratio: 0.68,
    shape:
      'polygon(50% 4%, 62% 10%, 78% 0%, 74% 20%, 96% 34%, 84% 58%, 78% 100%, 22% 100%, 16% 58%, 4% 34%, 26% 20%, 22% 0%, 38% 10%)',
    eyeTop: '15%',
  },
};

/** Enemy condition -> how the creature reads in the band.
 *
 *  `tint` is remaining menace: a fresh hostile burns danger-red, a spent one
 *  greys out. It colours the silhouette, the floor pool and the name.
 *
 *  `wear` is the same scale as a 0..1 scalar, driving the desaturation and
 *  dimming of the ART variant — a photograph cannot be recoloured the way a
 *  silhouette can, so it loses blood instead. One table feeds both, so the two
 *  representations can never disagree about how hurt a creature looks.
 *
 *  All SIX states the backend emits are listed. `EnemyInstance.condition_display`
 *  (backend/models/combat.py) buckets the remaining/max ratio into healthy >0.8,
 *  scratched >0.6, damaged >0.4, wounded >0.2, critical, defeated — the previous
 *  four-entry map silently dropped `scratched` and `wounded` through its
 *  fallback, so a creature at 70 % and at 30 % both looked untouched. */
const FOE_CONDITION: Record<string, { tint: string; wear: number }> = {
  healthy: { tint: 'var(--color-danger)', wear: 0 },
  scratched: { tint: 'var(--color-danger)', wear: 0.14 },
  damaged: { tint: 'var(--color-warning)', wear: 0.34 },
  wounded: { tint: 'var(--color-warning)', wear: 0.54 },
  critical: { tint: 'var(--color-primary)', wear: 0.74 },
  defeated: { tint: 'var(--color-text-muted)', wear: 1 },
};

/** Unknown condition string: treat as unhurt rather than as debris, so a future
 *  backend state degrades into "menacing" instead of into "already dead". */
const FOE_CONDITION_FALLBACK = FOE_CONDITION.healthy;

/** TelegraphedAction threat scale -> intent-marker colour. */
const FOE_INTENT: Record<string, string> = {
  low: 'var(--color-info)',
  medium: 'var(--color-warning)',
  high: 'var(--color-danger)',
  critical: 'var(--color-danger)',
};

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
