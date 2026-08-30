import { css } from 'lit';

/**
 * The graphical dungeon's own stylesheet.
 *
 * WHY IT IS ITS OWN FILE
 * `DungeonGraphicalView.ts` had grown to 3299 lines, of which about 1990 were
 * this CSS — sixty per cent of the file, in front of the 34 methods that
 * actually run the view. The repo already keeps 29 `*-styles.ts` modules and the
 * component's own directory shows the pattern (DungeonChronicle, DungeonCombatFx
 * are separate elements), so the CSS living inline was the odd one out.
 *
 * Nothing here is shared with another component, and that is on purpose: this is
 * an EXTRACTION, not a generalisation. Every rule is the graphical dungeon's
 * own, in the order it was in, byte for byte. If a rule later turns out to be
 * shared, it moves to `components/shared/` and stops being local — but that is a
 * second decision, made with the other consumer in hand.
 *
 * Composed after `terminalTokens` / `terminalComponentTokens` /
 * `terminalAnimations`, exactly as before, so the cascade is unchanged.
 */
export const dungeonGraphicalStyles = css`
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
      /* In a fight the combat bar claims the lower half of the screen and the
         side column is left with a couple of hundred pixels. The party card is
         the part to give up: every operative is already listed in the combat
         bar's own tabs, with their condition. The chronicle is not duplicated
         anywhere, and a fight is exactly when a player needs to read what just
         happened — who hit, who missed, what it cost. */
      .dungeon-hud--combat .dungeon-hud__party {
        display: none;
      }
      .dungeon-hud--combat .dungeon-hud__chronicle {
        border-top: none;
      }
      .dungeon-hud__chronicle velg-dungeon-chronicle {
        flex: 1 1 0;
        min-height: 0;
      }
      /* The controls belong to the STAGE, so they sit under it — not under the
         whole HUD. Spanning 1 / -1 put the three move buttons under the map
         rail at x=29 and the standing group under the chronicle at x=1426,
         with a thousand pixels of nothing under the stage between them
         (measured at a 1728px viewport: grid 320px | 1021px | 340px). Cause
         and effect now share a column: what you can do sits beneath the thing
         you are doing it to. */
      .dungeon-hud__actions {
        grid-column: 2 / 3;
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
         as "arriving" from the first paint.

         It sits BEHIND the picture rather than fading out on top of it, and is
         removed from the DOM once the picture has painted. An overlay that
         fades leaves a composited layer over the art for no gain; behind it,
         the picture simply arrives and covers it. Nothing above the backdrop
         image needs to animate, so nothing does. */
      .scene__skeleton {
        position: absolute;
        inset: 0;
        pointer-events: none;
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
      /* Label and figure share a baseline and the bar's width, so the number
         reads as the bar's value rather than as a second, unrelated label. */
      .scene__readout-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
        width: 120px;
      }
      .scene__readout-value {
        font-variant-numeric: tabular-nums;
        letter-spacing: 0.5px;
        color: color-mix(in srgb, var(--_phosphor) 78%, var(--color-text-primary));
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

      /* The expedition register sits under the archetype grid: the lobby is
         where a player decides what to do next, and what already happened is
         the best argument either way. */
      .lobby-register {
        margin-top: 20px;
        padding-top: 16px;
        border-top: 1px dashed var(--color-border);
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
      /* Eine Personalakte, kein Listeneintrag.
         Die Karte war eine Textzeile mit einem 32-px-Icon davor. Die Portraets
         dieser Simulation sind 772x1024 gross und liegen im Hochformat vor —
         sie wurden also auf ein Quadrat beschnitten UND auf ein Zehntel der
         Kartenflaeche gedraengt. Auf einem Bildschirm, dessen einzige Aufgabe
         das Auswaehlen von MENSCHEN ist, ist das die falsche Gewichtung:
         Gesichter sind das, woran man Leute erkennt und auseinanderhaelt.
         Jetzt fuehrt das Bild, Name und Werte stehen darunter — das Format
         einer Dossierkarte. Die Rasterbreite faellt von 220px auf 168px, weil
         die Karte ihre Information nun in der HOEHE traegt: mehr Kandidaten je
         Reihe, und trotzdem ein Portraet statt eines Daumennagels. */
      .picker-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
        gap: 10px;
        overflow-y: auto;
        align-content: start;
      }
      .picker-card {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 0;
        padding: 0;
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
        background: color-mix(in srgb, var(--_phosphor) 18%, var(--color-surface-raised));
      }
      /* Das Portraet fuehrt die Karte und stoesst an ihre Kanten. */
      .picker-card__avatar {
        display: block;
        --avatar-aspect: 3 / 4;
      }
      .picker-card--selected .picker-card__avatar {
        filter: none;
      }
      .picker-card:not(.picker-card--selected):not(:hover) .picker-card__avatar {
        filter: saturate(0.8) brightness(0.9);
        transition: filter var(--transition-normal, 200ms ease);
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
        padding: 8px 9px 9px;
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
      /* Die Auswahlmarke liegt auf dem Bild, nicht neben dem Text: dort sieht
         man sie beim Ueberfliegen der Gesichter, ohne die Zeile zu lesen. */
      .picker-card__check {
        position: absolute;
        top: 6px;
        right: 6px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        color: var(--color-surface);
        background: var(--_phosphor);
        box-shadow: var(--shadow-xs);
        pointer-events: none;
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
`;
