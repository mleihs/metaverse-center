/**
 * Dungeon Combat Bar -- planning-phase weapon console for dungeon combat.
 *
 * The centerpiece of dungeon gameplay: 30-second countdown, per-agent ability
 * selection with enemy targeting, and the consequential EXECUTE button.
 * Submarine war room meets tabletop board game.
 *
 * Replaces DungeonQuickActions during combat phases:
 *   combat_planning  -> Timer + agent ability strips + target picker + submit
 *   combat_resolving -> "RESOLVING" status with blink
 *   combat_outcome   -> "ROUND COMPLETE" status
 *   boss             -> Same as combat_planning
 *
 * Reads: dungeonState signals (phase, party, selectedActions, allActionsSelected,
 *        combat, timerRemaining, combatSubmitting).
 * Writes: dungeonState.selectAction() for ability selection.
 * Dispatches: 'terminal-command' with 'submit' for combat submission.
 *
 * Pattern: DungeonQuickActions.ts (signal-reactive, terminal aesthetic, event dispatch).
 */

import { localized, msg } from '@lit/localize';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import { dungeonState } from '../../services/DungeonStateManager.js';
import type {
  AbilityOption,
  AgentCombatStateClient,
  CombatAction,
  EnemyCombatStateClient,
} from '../../types/dungeon.js';
import { orderAbilities } from '../../utils/ability-order.js';
import type { AbilityIntent } from '../../utils/ability-pictograms.js';
import { abilityIntent, abilityPictogramUrl } from '../../utils/ability-pictograms.js';
import { dungeonEnemyArtUrl } from '../../utils/dungeon-enemy-art.js';
import {
  buildEnemyDisplayNames,
  getConditionLabel,
  getEnemyConditionLabel,
} from '../../utils/dungeon-formatters.js';
import { icons } from '../../utils/icons.js';
import { localized as localizedValue } from '../../utils/locale-fields.js';
import { terminalComponentTokens, terminalTokens } from '../shared/terminal-theme-styles.js';
import '../shared/VelgAvatar.js';
import '../shared/VelgHoldButton.js';

/** Timer urgency thresholds (milliseconds). */
const TIMER_WARNING_MS = 10_000;
const TIMER_CRITICAL_MS = 5_000;

/** ①②③④ for the order strip, as the prototype draws them.
 *
 *  Decorative numbering, not a bearing glyph: replace the circle with a plain
 *  digit and nothing is lost, which is the test that lets it stay a character
 *  instead of an icon. Never inside `msg()` — a translation has no business
 *  carrying an ornament. Beyond twenty (a party never gets there, but a fallback
 *  that cannot be reached is still cheaper than one that crashes) it degrades to
 *  the bare number. */
function circledIndex(index: number): string {
  return index < 20 ? String.fromCodePoint(0x2460 + index) : String(index + 1);
}

@localized()
@customElement('velg-dungeon-combat-bar')
export class VelgDungeonCombatBar extends SignalWatcher(LitElement) {
  static styles = [
    terminalTokens,
    terminalComponentTokens,
    css`
      :host {
        display: block;
      }

      /* -- Bar Container -- */
      .combat-bar {
        background: var(--_screen-bg);
        border: 1px solid color-mix(in srgb, var(--_border) 50%, transparent);
        border-top: 2px solid var(--_phosphor-dim);
      }

      /* -- Timer Section -- */
      .timer {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        border-bottom: 1px solid color-mix(in srgb, var(--_border) 30%, transparent);
      }

      .timer__label {
        font-family: var(--_mono);
        font-size: 8px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: var(--_phosphor-dim);
        flex-shrink: 0;
      }

      .timer__track {
        flex: 1;
        height: 12px;
        background: color-mix(in srgb, var(--_screen-bg) 60%, var(--_border));
        border: 1px solid color-mix(in srgb, var(--_border) 30%, transparent);
        overflow: hidden;
      }

      .timer__fill {
        height: 100%;
        background: var(--_phosphor);
        transform-origin: left;
      }

      .timer--warning .timer__fill {
        background: var(--color-warning);
      }

      .timer--critical .timer__fill {
        background: var(--color-danger);
      }

      .timer__seconds {
        font-family: var(--_mono);
        font-size: 24px;
        font-weight: 700;
        letter-spacing: 1px;
        color: var(--_phosphor);
        text-shadow: 0 0 8px var(--_phosphor-glow);
        min-width: 32px;
        text-align: right;
        font-variant-numeric: tabular-nums;
      }

      .timer--warning .timer__seconds {
        color: var(--color-warning);
      }

      .timer--critical {
        background: color-mix(in srgb, var(--color-danger) 6%, transparent);
        border-bottom-color: color-mix(in srgb, var(--color-danger) 40%, transparent);
        animation: critical-container 0.6s ease-in-out infinite;
      }

      @keyframes critical-container {
        0%, 100% {
          box-shadow: inset 0 0 12px color-mix(in srgb, var(--color-danger) 8%, transparent);
        }
        50% {
          box-shadow:
            inset 0 0 20px color-mix(in srgb, var(--color-danger) 15%, transparent),
            0 0 8px color-mix(in srgb, var(--color-danger) 12%, transparent);
        }
      }

      .timer--critical .timer__track {
        border-color: color-mix(in srgb, var(--color-danger) 50%, transparent);
        box-shadow: 0 0 6px color-mix(in srgb, var(--color-danger) 20%, transparent);
      }

      @media (prefers-reduced-motion: reduce) {
        .timer--critical { animation: none; }
      }

      .timer--critical .timer__seconds {
        color: var(--color-danger);
        text-shadow:
          0 0 8px var(--color-danger),
          0 0 16px color-mix(in srgb, var(--color-danger) 30%, transparent);
      }

      /* -- Agent Strips -- */
      .agents {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 6px 8px;
        overflow-y: auto;
        min-height: 0;
      }

      .agent {
        display: flex;
        flex-direction: column;
        gap: 3px;
        padding: 5px 8px;
        border: 1px solid color-mix(in srgb, var(--_border) 20%, transparent);
        background: color-mix(in srgb, var(--_screen-bg) 50%, transparent);
      }

      .agent--selected {
        border-color: color-mix(in srgb, var(--_phosphor) 35%, transparent);
      }

      .agent--targeting {
        border-color: color-mix(in srgb, var(--color-warning) 50%, transparent);
      }

      .agent__row {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .agent__name {
        font-family: var(--_mono);
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--_phosphor);
        flex-shrink: 0;
        min-width: 48px;
      }

      .agent__condition {
        font-family: var(--_mono);
        font-size: 8px;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        color: var(--_phosphor-dim);
        opacity: 0.6;
        flex-shrink: 0;
      }

      .agent__abilities {
        display: flex;
        flex-wrap: wrap;
        gap: 3px;
        flex: 1;
      }

      /* -- Ability Buttons -- */
      .ability {
        font-family: var(--_mono);
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.3px;
        /* WCAG 2.2 SC 2.5.8 floor for pointer targets. The old 3px padding on
           10px type gave a 17px tall control, which missed it outright. */
        min-height: 24px;
        padding: 3px 8px;
        background: transparent;
        color: var(--_phosphor-dim);
        border: 1px solid color-mix(in srgb, var(--_border) 55%, transparent);
        cursor: pointer;
        white-space: nowrap;
      }

      .ability:hover:not(:disabled) {
        color: var(--_phosphor);
        border-color: var(--_phosphor-dim);
        background: color-mix(in srgb, var(--_phosphor) 5%, transparent);
      }

      .ability:focus-visible {
        outline: 2px solid var(--_phosphor);
        outline-offset: 1px;
      }

      .ability--selected {
        color: var(--_phosphor);
        border-color: var(--_phosphor);
        background: color-mix(in srgb, var(--_phosphor) 10%, transparent);
      }

      .ability--cooldown {
        opacity: 0.3;
        cursor: not-allowed;
        text-decoration: line-through;
      }

      .ability--ultimate {
        border-style: dashed;
      }

      .ability__check {
        font-size: 8px;
        opacity: 0.65;
        margin-left: 3px;
      }

      .ability__cd {
        font-size: 8px;
        opacity: 0.5;
      }

      /* -- Pictogram tiles (graphical view) --
         A wycinanki silhouette carried as a CSS mask, so the SHAPE comes from
         the asset and the COLOUR from the tokens. One file per ability serves
         all ten theme presets and all three intent colours.

         The name stays VISIBLE under the glyph rather than hiding in a tooltip:
         icon-only controls are only safe for a handful of universal symbols,
         and a hover-only label is unreachable on touch. The glyph buys scanning
         speed, the label buys certainty; the pair costs one line of text.

         --_intent carries the cluster colour. It is redundant reinforcement,
         never the sole carrier: the cluster already has a text label, every
         silhouette is distinct, and the name sits under each glyph. Colour
         speeds up scanning; it decides nothing on its own (WCAG 1.4.1). */
      .ability--tile {
        --_intent: var(--_phosphor);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
        width: 88px;
        /* Feste Hoehe fuer gleiche Unterkanten, Inhalt MITTIG darin.
           Zwei Anlaeufe, und der erste war falsch: ich hatte die Namenszeile auf
           zwei Zeilen und die Trefferquote als leere Zeile RESERVIERT, damit die
           Unterkanten nicht ausfransen. Das machte alle Kacheln gleich hoch —
           und erzeugte bei einzeiligen Namen (SHIELD, RALLY, EVADE) rund 25px
           Leere unter dem Wort, sodass das Piktogramm sichtbar an der Oberkante
           klebte. Ausgefranste Unterkanten gegen kopflastige Kacheln getauscht.
           Die feste Hoehe allein haelt die Unterkanten schon buendig; der Rest
           gehoert gleichmaessig ueber UND unter den Inhalt. */
        min-height: 86px;
        justify-content: center;
        padding: 4px;
        white-space: normal;
        position: relative;
        border-color: color-mix(in srgb, var(--_intent) 26%, transparent);
        transition:
          border-color var(--duration-normal, 200ms) var(--ease-out, ease),
          background var(--duration-normal, 200ms) var(--ease-out, ease);
        animation: tile-in var(--duration-entrance, 350ms) var(--ease-dramatic, ease-out) backwards;
        animation-delay: calc(var(--i, 0) * var(--duration-stagger, 40ms));
      }

      /* Compound selectors on purpose: a single-class intent rule ties with the
         --_intent default above and would lose on source order, which silently
         kills the colour. The extra class makes the cascade explicit. */
      .ability--tile.ability--strike {
        --_intent: var(--color-danger);
      }
      .ability--tile.ability--aid {
        --_intent: var(--color-success);
      }
      .ability--tile.ability--guard {
        --_intent: var(--color-info);
      }

      /* Das Piktogramm bekommt einen eigenen, gleichmaessig beluefteten Platz.
         Vorher sass es 5px unter der Oberkante, mit 41px Text darunter: der
         Block als Ganzes war mittig, das BILD aber im oberen Viertel und
         sichtbar an die Kante gedrueckt. Jetzt traegt eine Zone fester Hoehe
         das Glyph mittig, und es ist von 28 auf 34px gewachsen — auf einer
         88px breiten Kachel ist es das Motiv, nicht ein Aufzaehlungszeichen. */
      .ability__glyph-zone {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 42px;
        flex: none;
      }

      .ability__glyph {
        width: 34px;
        height: 34px;
        flex-shrink: 0;
        background-color: color-mix(in srgb, var(--_intent) 62%, var(--_phosphor-dim));
        -webkit-mask-image: var(--_mask);
        mask-image: var(--_mask);
        -webkit-mask-repeat: no-repeat;
        mask-repeat: no-repeat;
        -webkit-mask-position: center;
        mask-position: center;
        -webkit-mask-size: contain;
        mask-size: contain;
        transition:
          background-color var(--duration-normal, 200ms) var(--ease-out, ease),
          transform var(--duration-normal, 200ms) var(--ease-spring, ease-out);
      }

      .ability__name {
        font-size: 9px;
        line-height: 1.15;
        letter-spacing: 0.2px;
        text-align: center;
        text-transform: uppercase;
        /* German ability names are single long compounds. Without an explicit
           break opportunity they do not wrap at all: the word runs straight out
           of the tile and over its neighbours, and line-clamp never engages
           because there is only ever one line. */
        max-width: 100%;
        overflow-wrap: anywhere;
        hyphens: auto;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      /* Same datum as in the text variant, hence the same class: the success
         odds decide the move, so they stay on the face of the tile. Rendered
         only when there IS a quote — the tile centres its content, so an absent
         footer costs no layout and leaves no hole. */
      .ability--tile .ability__check {
        display: block;
        margin-left: 0;
        font-size: 8px;
        line-height: 1.1;
        max-width: 100%;
        overflow-wrap: anywhere;
      }

      .ability--tile:hover:not(:disabled) {
        border-color: color-mix(in srgb, var(--_intent) 70%, transparent);
        background: color-mix(in srgb, var(--_intent) 7%, transparent);
      }

      .ability--tile:hover:not(:disabled) .ability__glyph {
        background-color: var(--_intent);
        transform: translateY(-1px) scale(1.07);
      }

      .ability--tile.ability--selected {
        border-color: var(--_intent);
        background: color-mix(in srgb, var(--_intent) 14%, transparent);
        color: var(--_phosphor);
        box-shadow: 2px 2px 0 color-mix(in srgb, var(--_intent) 45%, transparent);
      }

      .ability--tile.ability--selected .ability__glyph {
        background-color: var(--_intent);
        animation: glyph-commit 260ms var(--ease-slam, cubic-bezier(0.2, 0, 0, 1));
      }

      @keyframes glyph-commit {
        0% {
          transform: scale(0.82);
        }
        55% {
          transform: scale(1.12);
        }
        100% {
          transform: scale(1);
        }
      }

      @keyframes tile-in {
        from {
          opacity: 0;
          transform: translateY(5px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      /* Cooldown reads as a corner counter plus a drained tile, never as colour
         alone — the state has to survive a monochrome or colour-blind view. */
      .ability--tile.ability--cooldown {
        text-decoration: none;
        opacity: 0.42;
      }

      .ability__cd-badge {
        position: absolute;
        top: 2px;
        right: 3px;
        font-size: 9px;
        font-weight: 700;
        line-height: 1;
        padding: 1px 3px;
        color: var(--_phosphor);
        background: color-mix(in srgb, var(--_screen-bg) 82%, transparent);
        border: 1px solid color-mix(in srgb, var(--_phosphor-dim) 60%, transparent);
      }

      /* Once-per-dungeon: dashed frame plus a struck corner, so the
         irreversibility is legible without relying on the border style alone. */
      .ability--tile.ability--ultimate {
        border-style: dashed;
      }

      .ability--tile.ability--ultimate::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        border-top: 9px solid var(--_intent);
        border-right: 9px solid transparent;
      }

      @media (prefers-reduced-motion: reduce) {
        .ability--tile,
        .ability--tile .ability__glyph,
        .ability--tile.ability--selected .ability__glyph {
          animation: none;
          transition: none;
        }
        .ability--tile:hover:not(:disabled) .ability__glyph {
          transform: none;
        }
      }

      /* -- Compact intent-grouped layout (opt-in, graphical view) --
         Turns the flat ability wall into Strike / Aid / Guard clusters with
         small colour-coded labels so each agent's options read at a glance.

         DREI SPALTEN, NICHT DREI ZEILEN. Als gestapelte Zeilen kostete das
         Raster die SUMME der drei Gruppenhoehen (rund 300px), und weil eine
         Gruppe selten die Breite fuellt, standen bei AID gut 65% der Zeile
         leer. Die Leiste konkurriert mit der Buehne um Hoehe — genug, dass die
         Party-Spalte im Kampf ausgeblendet werden musste, um Platz zu schaffen.
         Nebeneinander kostet das Raster nur die Hoehe der HOECHSTEN Gruppe.

         Die Spaltenbreiten stehen proportional zur Anzahl der Kacheln
         (inline gesetzt, weil nur die Komponente die Zahlen kennt). Gleich
         breite Drittel waeren schlechter: STRIKE mit acht Faehigkeiten braucht
         dann drei Zeilen, waehrend AID mit dreien zwei Drittel Luft behaelt.
         Proportional bricht jede Gruppe auf die GLEICHE Zeilenzahl um —
         8:3:5 wird zu 4|2|3 Kacheln je Zeile, also zwei Zeilen ueberall. */
      :host([compact]) .agent__abilities {
        align-items: flex-start;
        gap: 6px 18px;
      }
      .agroup {
        display: flex;
        align-items: flex-start;
        gap: 7px;
        min-width: 0;
      }
      .agroup__label {
        font-family: var(--font-brutalist, var(--_mono));
        /* Steht jetzt neben einer mehrzeiligen Spalte, nicht neben einer
           einzelnen Reihe: oben ausgerichtet, damit es die Gruppe anschreibt
           statt in ihrer Mitte zu schweben. */
        margin-top: 6px;
        font-size: 8px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        flex-shrink: 0;
        color: var(--_phosphor-dim);
      }
      .agroup--strike .agroup__label {
        color: color-mix(in srgb, var(--color-danger) 72%, var(--_phosphor-dim));
      }
      .agroup--aid .agroup__label {
        color: color-mix(in srgb, var(--color-success) 72%, var(--_phosphor-dim));
      }
      .agroup--guard .agroup__label {
        color: color-mix(in srgb, var(--color-info) 72%, var(--_phosphor-dim));
      }
      .agroup__items {
        display: flex;
        flex-wrap: wrap;
        gap: 3px;
        min-width: 0;
      }

      /* -- Target Picker -- */
      .targets {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        padding: 4px 0 2px;
        border-top: 1px dashed color-mix(in srgb, var(--_border) 25%, transparent);
        margin-top: 2px;
      }

      .targets__label {
        font-family: var(--_mono);
        font-size: 8px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--_phosphor-dim);
        align-self: center;
        margin-right: 2px;
      }

      .target {
        font-family: var(--_mono);
        font-size: 9px;
        font-weight: 600;
        padding: 2px 8px;
        background: transparent;
        color: var(--color-danger);
        border: 1px solid color-mix(in srgb, var(--color-danger) 40%, transparent);
        cursor: pointer;
      }

      .target:hover {
        background: color-mix(in srgb, var(--color-danger) 8%, transparent);
        border-color: var(--color-danger);
      }

      .target:focus-visible {
        outline: 2px solid var(--color-danger);
        outline-offset: 1px;
      }

      .target--ally {
        color: var(--_phosphor);
        border-color: color-mix(in srgb, var(--_phosphor) 40%, transparent);
      }

      .target--ally:hover {
        background: color-mix(in srgb, var(--_phosphor) 8%, transparent);
        border-color: var(--_phosphor);
      }

      .target--ally:focus-visible {
        outline-color: var(--_phosphor);
      }

      /* -- Order strip: the round in words (README §4.6, third anchor) --
         A row of slots, one per operative, sitting between the ability desk and
         the commit button — the last thing crossed on the way to Execute, which
         is where a summary belongs. Grid rather than flex so four slots take
         four equal shares: a long ability name must not squeeze its neighbour
         into an ellipsis, because the point of the strip is that all four
         orders are readable at once. */
      /* One row with the commit button, as the prototype draws it: the strip is
         the last thing crossed on the way to Execute, and putting it on its own
         line pushed the button a row further from the abilities for no gain.
         The list grows, each slot takes an equal share of it — four shares
         that shrink together, so a long ability name never squeezes a
         neighbour out of legibility. */
      .orders {
        flex: 1;
        display: flex;
        gap: 1px;
        margin: 0;
        padding: 0;
        list-style: none;
        min-width: 0;
        background: color-mix(in srgb, var(--_border) 22%, transparent);
      }
      .orders__slot {
        flex: 1 1 0;
        display: flex;
        min-width: 0;
      }
      .order {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 5px;
        min-width: 0;
        padding: 4px 7px;
        border: 0;
        background: var(--_screen-bg);
        color: var(--_phosphor-dim);
        font-family: var(--_mono);
        font-size: 10px;
        text-align: left;
        cursor: pointer;
        transition:
          color var(--transition-fast, 100ms ease),
          background var(--transition-fast, 100ms ease);
      }
      .order:hover {
        color: var(--_phosphor);
      }
      .order:focus-visible {
        outline: 2px solid var(--_phosphor);
        outline-offset: -2px;
      }
      /* The circled digit itself, unboxed — a border around it made four little
         chips competing with the ability tiles above. */
      .order__index {
        flex: none;
        font-size: 10px;
        line-height: 1;
        opacity: 0.75;
      }
      .order__line {
        display: flex;
        align-items: baseline;
        gap: 4px;
        min-width: 0;
        white-space: nowrap;
      }
      .order__who {
        flex: none;
        font-weight: 700;
        letter-spacing: 0.4px;
        text-transform: uppercase;
      }
      .order__sep {
        flex: none;
        opacity: 0.5;
      }
      /* The name survives, the order is what truncates — a slot whose operative
         cannot be identified tells the player nothing at all. */
      .order__what {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        opacity: 0.85;
      }
      /* Set: the amber of a placed order, the same accent the command card and
         the sights tag carry, so the eye ties the three together. */
      .order--set {
        color: var(--color-accent-amber);
      }
      .order--set .order__index {
        opacity: 1;
      }
      .order__drop {
        flex: none;
        margin-left: auto;
        opacity: 0.5;
      }
      .order--set:hover .order__drop {
        opacity: 1;
      }
      /* Aiming: this slot is the one the stage is waiting on. */
      .order--aiming {
        color: var(--color-accent-amber);
        background: color-mix(in srgb, var(--color-accent-amber) 8%, var(--_screen-bg));
      }
      @media (prefers-reduced-motion: no-preference) {
        .order--aiming .order__index {
          animation: order-aim-pulse 1.4s var(--ease-in-out, ease-in-out) infinite;
        }
        @keyframes order-aim-pulse {
          0%,
          100% {
            opacity: 0.4;
          }
          50% {
            opacity: 1;
          }
        }
      }

      .execute-hold {
        flex: 1;
        --hold-btn-color: var(--color-accent-amber);
        --hold-btn-fill: color-mix(in srgb, var(--color-accent-amber) 26%, transparent);
        --hold-btn-border: 2px solid color-mix(in srgb, var(--color-accent-amber) 55%, transparent);
        font-family: var(--font-brutalist, var(--_mono));
        font-weight: 900;
        font-size: 12px;
        letter-spacing: 3px;
      }

      /* -- Footer: Counter + Submit -- */
      .footer {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        border-top: 1px solid color-mix(in srgb, var(--_border) 30%, transparent);
      }

      .counter {
        font-family: var(--_mono);
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--_phosphor-dim);
        flex-shrink: 0;
      }

      .execute {
        flex: 1;
        font-family: var(--font-brutalist, var(--_mono));
        font-weight: 900;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 3px;
        padding: 8px 16px;
        background: transparent;
        color: var(--_phosphor-dim);
        border: 1px solid color-mix(in srgb, var(--_border) 60%, transparent);
        cursor: not-allowed;
        opacity: 0.5; /* WCAG AA: ≥3:1 non-text contrast for disabled UI */
      }

      .execute--ready {
        opacity: 1;
        cursor: pointer;
        color: var(--_phosphor);
        border: 2px solid var(--_phosphor);
        background: color-mix(in srgb, var(--_phosphor) 8%, transparent);
        box-shadow: 0 0 12px var(--_phosphor-glow);
        animation: execute-pulse 2s ease-in-out infinite;
      }

      @keyframes execute-pulse {
        0%, 100% { box-shadow: 0 0 8px var(--_phosphor-glow); }
        50% { box-shadow: 0 0 16px var(--_phosphor-glow), 0 0 24px color-mix(in srgb, var(--_phosphor-glow) 30%, transparent); }
      }

      @media (prefers-reduced-motion: reduce) {
        .execute--ready { animation: none; }
      }

      .execute--ready:hover {
        background: color-mix(in srgb, var(--_phosphor) 15%, transparent);
      }

      .execute--ready:active {
        transform: scale(0.98);
      }

      .execute--ready:focus-visible {
        outline: 2px solid var(--_phosphor);
        outline-offset: 2px;
      }

      .execute:disabled {
        cursor: not-allowed;
        opacity: 0.25;
      }

      /* -- Phase Status (non-planning phases) -- */
      .status {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 14px 12px;
        font-family: var(--_mono);
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 2px;
        color: var(--_phosphor-dim);
      }

      .status--resolving {
        color: var(--_phosphor);
      }

      /* -- Animations (opt-in: prefers-reduced-motion: no-preference) -- */
      @media (prefers-reduced-motion: no-preference) {
        .timer__fill {
          transition: width 100ms linear;
        }

        .timer--warning .timer__fill {
          transition: width 100ms linear, background 300ms;
        }

        .timer--critical .timer__seconds {
          animation: critical-pulse 0.6s ease-in-out infinite;
        }

        .timer--critical .timer__fill {
          animation: critical-bar-pulse 0.6s ease-in-out infinite;
        }

        .timer--critical .timer__label {
          animation: critical-label-flash 0.6s step-end infinite;
          color: var(--color-danger);
        }

        .ability {
          transition: color 150ms, border-color 150ms, background 150ms;
        }

        .ability--selected {
          box-shadow: 0 0 8px color-mix(in srgb, var(--_phosphor-glow) 40%, transparent);
        }

        .agent {
          transition: border-color 200ms;
        }

        .execute {
          transition: all 200ms;
        }

        .execute--ready {
          box-shadow: 0 0 12px color-mix(in srgb, var(--_phosphor-glow) 25%, transparent);
          animation: execute-breathe 2s ease-in-out infinite;
        }

        .status--resolving {
          animation: resolving-blink 1.5s step-end infinite;
        }
      }

      @keyframes critical-pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.3; transform: scale(1.06); }
      }

      @keyframes critical-bar-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.35; }
      }

      @keyframes critical-label-flash {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }

      @keyframes execute-breathe {
        0%, 100% { box-shadow: 0 0 12px color-mix(in srgb, var(--_phosphor-glow) 25%, transparent); }
        50% { box-shadow: 0 0 20px color-mix(in srgb, var(--_phosphor-glow) 50%, transparent); }
      }

      @keyframes resolving-blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
      }

      /* -- Mobile (<=767px) -- */
      @media (max-width: 767px) {
        .agents {
          gap: 4px;
          padding: 6px;
        }

        .agent {
          padding: 4px 6px;
        }

        .agent__row {
          flex-wrap: wrap;
        }

        .ability {
          font-size: 11px;
          padding: 8px 12px;
          min-height: 44px;
          display: flex;
          align-items: center;
        }

        .target {
          font-size: 11px;
          padding: 8px 10px;
          min-height: 44px;
          display: flex;
          align-items: center;
        }

        .execute {
          min-height: 44px;
          font-size: 13px;
        }

        .footer {
          flex-direction: column;
          gap: 4px;
        }
      }

      /* -- Extra-small (<=640px) -- */
      @media (max-width: 640px) {
        .agent__condition {
          display: none;
        }

        .ability__check {
          display: none;
        }

        .timer__label {
          display: none;
        }
      }

      /* -- Large screens (1440px+) -- */
      @media (min-width: 1440px) {
        .timer__track {
          height: 10px;
        }

        .timer__seconds {
          font-size: 18px;
          min-width: 28px;
        }

        .ability {
          font-size: 11px;
          padding: 4px 10px;
        }

        .execute {
          font-size: 13px;
          padding: 10px 20px;
        }
      }

      /* -- Agent Done Badge -- */
      .agent__done {
        font-family: var(--_mono);
        font-size: 8px;
        font-weight: 700;
        color: var(--_phosphor);
        letter-spacing: 1px;
        padding: 1px 4px;
        border: 1px solid color-mix(in srgb, var(--_phosphor) 50%, transparent);
        flex-shrink: 0;
      }

      /* -- Compact console: portrait roster + one open action desk -------- */
      .console {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 0;
      }
      .roster {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      /* One chip per agent: face, short name, and what they are doing. The face
         is the same portrait the scene and the party panel already show, so the
         figure on stage, the card on the right and the chip here are visibly
         one person. */
      .chip {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        padding: 5px 10px 5px 5px;
        border: 1px solid color-mix(in srgb, var(--_border) 55%, transparent);
        background: color-mix(in srgb, var(--_screen-bg) 82%, transparent);
        cursor: pointer;
        text-align: left;
        transition:
          border-color var(--transition-fast, 100ms ease),
          background var(--transition-fast, 100ms ease);
      }
      .chip:hover {
        border-color: color-mix(in srgb, var(--_phosphor) 60%, transparent);
      }
      .chip--active {
        border-color: var(--_phosphor);
        background: color-mix(in srgb, var(--_phosphor) 12%, var(--_screen-bg));
      }
      .chip--done {
        border-style: dashed;
      }
      .chip:focus-visible {
        outline: 2px solid var(--_phosphor);
        outline-offset: 2px;
      }
      .chip__face {
        flex: none;
      }
      .chip__text {
        display: flex;
        flex-direction: column;
        gap: 1px;
        min-width: 0;
      }
      .chip__name {
        font-family: var(--font-brutalist, var(--_mono));
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 1px;
        text-transform: uppercase;
        color: var(--_phosphor);
      }
      /* What this agent is doing — the chosen ability once picked, the condition
         before that. The roster answers "who still needs me" at a glance. */
      .chip__state {
        max-width: 130px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-family: var(--_mono);
        font-size: 9px;
        color: var(--_phosphor-dim);
      }
      .chip__done {
        flex: none;
        font-size: 12px;
        color: var(--color-success);
      }

      .desk {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 8px 10px;
        border: 1px solid color-mix(in srgb, var(--_phosphor) 30%, transparent);
        background: color-mix(in srgb, var(--_screen-bg) 60%, transparent);
      }
      .desk__head {
        display: flex;
        align-items: baseline;
        gap: 10px;
      }
      .desk__name {
        font-family: var(--font-brutalist, var(--_mono));
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 1.2px;
        text-transform: uppercase;
        color: var(--_phosphor);
      }
      .desk__condition {
        font-family: var(--_mono);
        font-size: 9px;
        color: var(--_phosphor-dim);
      }
      /* DREI SPALTEN, NICHT DREI ZEILEN.
         Als gestapelte Zeilen kostete die Konsole die SUMME der drei
         Gruppenhoehen (gemessen: 3 x 91px = 273px), und weil eine Gruppe selten
         die Breite fuellt, standen bei Aid mit drei Faehigkeiten gut zwei
         Drittel der 884px leer. Die Leiste konkurriert mit der Buehne um Hoehe —
         genug, dass die Party-Spalte im Kampf ausgeblendet werden musste, um
         Platz zu schaffen. Nebeneinander kostet das Raster nur die Hoehe der
         HOECHSTEN Gruppe.
         Die Spaltenbreiten stehen proportional zur Zahl der Kacheln, inline
         gesetzt, weil nur die Komponente die Zahlen kennt. Gleich breite Drittel
         waeren schlechter als die alten Zeilen: Strike mit acht Faehigkeiten
         braeuchte dann drei Zeilen, waehrend Aid mit dreien zwei Drittel Luft
         behielte. Proportional bricht jede Gruppe auf die GLEICHE Zeilenzahl um. */
      .desk__abilities {
        display: grid;
        align-items: start;
        gap: 5px 14px;
      }
      /* Faces on the target row too: the cutout here is the same one standing in
         the enemy band above. */
      .target__art {
        height: 22px;
        width: auto;
        max-width: 30px;
        object-fit: contain;
        vertical-align: middle;
        margin-right: 5px;
      }
      .target__face {
        margin-right: 5px;
        vertical-align: middle;
      }

      /* -- Onboarding Briefing (compact) -- */
      .briefing {
        padding: 5px 12px;
        border-bottom: 1px solid color-mix(in srgb, var(--_border) 40%, transparent);
        background: color-mix(in srgb, var(--_phosphor) 3%, var(--_screen-bg));
      }

      .briefing__header {
        font-family: var(--_mono);
        font-size: 8px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 2px;
        color: var(--_phosphor);
        margin-bottom: 4px;
      }

      .briefing__steps {
        list-style: none;
        padding: 0;
        margin: 0 0 4px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1px 12px;
      }

      .briefing__step {
        font-family: var(--_mono);
        font-size: 9px;
        line-height: 1.3;
        /* The briefing sits on a slightly lifted ground, which costs the dim
           amber the last tenth it needs. Nudged up its own ramp rather than
           swapped for the bright token. */
        color: color-mix(in srgb, var(--_phosphor) 18%, var(--_phosphor-dim));
        padding-left: 16px;
        position: relative;
      }

      .briefing__step::before {
        content: attr(data-num);
        position: absolute;
        left: 0;
        color: var(--_phosphor);
        font-weight: 700;
      }

      .briefing__footer {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .briefing__alt {
        font-family: var(--_mono);
        font-size: 8px;
        /* Toward the screen ground, not toward the transparent keyword.
           Halving a colour against transparency does not dim it, it makes it
           translucent: measured 1.25 to 1, effectively invisible. An opaque
           mix reads the same and can be measured. */
        color: color-mix(in srgb, var(--_phosphor-dim) 82%, var(--_screen-bg));
        font-style: italic;
        flex: 1;
      }

      .briefing__ack {
        font-family: var(--_mono);
        font-size: 9px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 2px;
        padding: 2px 10px;
        background: transparent;
        color: var(--_phosphor);
        border: 1px solid var(--_phosphor-dim);
        cursor: pointer;
        flex-shrink: 0;
      }

      .briefing__ack:hover {
        background: color-mix(in srgb, var(--_phosphor) 8%, transparent);
        border-color: var(--_phosphor);
      }

      .briefing__ack:focus-visible {
        outline: 2px solid var(--_phosphor);
        outline-offset: 1px;
      }

      @media (prefers-reduced-motion: no-preference) {
        .briefing__ack::after {
          content: '\u2588';
          animation: cursor-blink 1s step-end infinite;
          margin-left: 4px;
        }
      }

      @keyframes cursor-blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0; }
      }

      @media (max-width: 767px) {
        .briefing__steps {
          grid-template-columns: 1fr;
        }
        .briefing__footer {
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
        }
      }

      /* -- Footer Hint -- */
      .footer__hint {
        font-family: var(--_mono);
        font-size: 8px;
        /* Toward the screen ground, not toward the transparent keyword.
           Halving a colour against transparency does not dim it, it makes it
           translucent: measured 1.25 to 1, effectively invisible. An opaque
           mix reads the same and can be measured. */
        color: color-mix(in srgb, var(--_phosphor-dim) 82%, var(--_screen-bg));
        letter-spacing: 0.3px;
      }

      /* -- 4K / Ultra-wide (2560px+) -- */
      @media (min-width: 2560px) {
        .timer {
          padding: 8px 16px;
          gap: 12px;
        }

        .timer__track {
          height: 12px;
        }

        .timer__seconds {
          font-size: 20px;
          min-width: 32px;
        }

        .agents {
          gap: 4px;
          padding: 8px 12px;
        }

        .agent {
          padding: 6px 10px;
        }

        .agent__name {
          font-size: 11px;
        }

        .ability {
          font-size: 12px;
          padding: 5px 12px;
        }

        .execute {
          font-size: 14px;
          padding: 12px 24px;
          letter-spacing: 4px;
        }

        .counter {
          font-size: 10px;
        }
      }
    `,
  ];

  /** Compact layout: group each agent's abilities into labelled intent clusters
   *  (Strike / Aid / Guard) instead of one flat wall of buttons. Opt-in — set by
   *  the graphical view; the terminal view leaves it off and is unchanged. */
  @property({ type: Boolean, reflect: true }) compact = false;

  /**
   * The agent whose action console is open, in compact mode.
   *
   * One actor at a time. Showing every party member's full ability list at once
   * produced 57 buttons over 40% of the window in a live fight, and left the
   * scene 255px — too little for the enemy band, which collapsed to 2px and drew
   * its creatures above the frame. No shipped game does it that way: Darkest
   * Dungeon shows the ACTIVE hero's skills and pages through the party,
   * Baldur's Gate 3 swaps one hotbar per character. Into the Breach's rule for
   * its own UI was to sacrifice ideas for clarity every time.
   *
   * Null means "the first agent still without an action" — resolved at render
   * so the console follows the player forward without needing to be told.
   */
  @state() private _activeAgentId: string | null = null;

  /** The aim in progress is read from `dungeonState.pendingOrder`, not held
   *  here. It used to be two local fields, which meant the stage could not see
   *  it: the spotlight, the command card and the creature's sights tag would
   *  each have needed their own copy. See DungeonStateManager.pendingOrder. */

  /** Combat onboarding briefing (shown once, persisted via localStorage). */
  @state() private _showOnboarding = !globalThis.localStorage?.getItem('dungeon_combat_onboarded');

  /** Escape abandons an aim in progress.
   *
   *  Bound on the document rather than on this element because the target is
   *  clicked on the STAGE, which is a sibling: by the time a player wants out,
   *  focus is rarely inside the bar. The listener does nothing at all unless an
   *  aim is pending, so it never competes with a dialog's own Escape — and it
   *  does not stop propagation, since an aim and an open dialog closing
   *  together is the behaviour a player expects, not a conflict. */
  private readonly _onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    if (!dungeonState.pendingOrder.value) return;
    dungeonState.cancelTargeting();
  };

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('keydown', this._onKeyDown);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this._onKeyDown);
    // An aim cannot survive the bar that owns it — leaving it set would light
    // the stage's spotlight with no way left to place or cancel the order.
    dungeonState.cancelTargeting();
  }

  // -- Event Dispatch -------------------------------------------------------

  private _dispatchCommand(command: string): void {
    this.dispatchEvent(
      new CustomEvent('terminal-command', {
        detail: command,
        bubbles: true,
        composed: true,
      }),
    );
  }

  // -- Render ---------------------------------------------------------------

  protected render() {
    const phase = dungeonState.phase.value;
    if (!phase) return nothing;

    switch (phase) {
      case 'combat_planning':
      case 'boss':
        return this._renderPlanning();

      case 'combat_resolving':
        return html`
          <div class="combat-bar">
            <div class="status status--resolving" role="status" aria-live="polite">
              ${msg('Resolving...')}
            </div>
          </div>
        `;

      case 'combat_outcome':
        return html`
          <div class="combat-bar">
            <div class="status" role="status" aria-live="polite">
              ${msg('Round complete')}
            </div>
          </div>
        `;

      default:
        return nothing;
    }
  }

  private _renderPlanning() {
    const party = dungeonState.party.value;
    const combat = dungeonState.combat.value;
    const remaining = dungeonState.timerRemaining.value;
    const selected = dungeonState.selectedActions.value;
    const allSelected = dungeonState.allActionsSelected.value;
    const submitting = dungeonState.combatSubmitting.value;
    const enemies = combat?.enemies.filter((e) => e.is_alive) ?? [];

    const actionable = party.filter(
      (a) => a.condition !== 'captured' && a.available_abilities.length > 0,
    );

    return html`
      <div class="combat-bar" role="region" aria-label=${msg('Combat planning')}>
        ${this._showOnboarding ? this._renderOnboarding() : nothing}
        ${this._renderTimer(remaining, combat?.timer?.duration_ms ?? 30_000)}

        ${
          this.compact
            ? this._renderConsole(actionable, selected, enemies)
            : html`<div class="agents" role="list" aria-label=${msg('Agent actions')}>
                ${actionable.map((agent) => this._renderAgent(agent, selected, enemies))}
              </div>`
        }

        <div class="footer">
          ${
            // On the stage the order strip IS the counter: four slots that each
            // name what will happen carry more than "2/4 ACTIONS", and the hold
            // button repeats the tally anyway. The terminal path keeps the
            // counter, where there is no strip to read it from.
            this.compact
              ? this._renderOrderStrip(actionable, selected, enemies)
              : html`<span class="counter" aria-live="polite">
                    ${actionable.filter((a) => selected.has(a.agent_id)).length}/${actionable.length} ${msg('ACTIONS')}
                  </span>
                  <span class="footer__hint">${msg('or type "submit" in terminal')}</span>`
          }
          ${
            // A held button, not a click, and only on the stage. Committing the
            // round is the one irreversible act in the phase — the prototype's
            // Dungeon Stage makes it a hold for that reason, and a mis-click
            // next to the ability grid costs a whole round. The terminal path
            // keeps its plain button: there the same commit is one typed word,
            // already deliberate.
            this.compact
              ? html`<velg-hold-button
                  class="execute-hold"
                  .duration=${600}
                  .label=${`${msg('Execute')} \u00b7 ${actionable.filter((a) => selected.has(a.agent_id)).length}/${actionable.length}`}
                  .holdingLabel=${msg('Hold to commit the round')}
                  .executingLabel=${msg('Submitting...')}
                  ?disabled=${!allSelected || submitting}
                  ?executing=${submitting}
                  @hold-confirmed=${this._handleSubmit}
                ></velg-hold-button>`
              : html`<button
                  class="execute ${allSelected && !submitting ? 'execute--ready' : ''}"
                  ?disabled=${!allSelected || submitting}
                  @click=${this._handleSubmit}
                  aria-label=${msg('Execute combat actions')}
                >
                  ${submitting ? msg('Submitting...') : msg('Execute')}
                </button>`
          }
        </div>
      </div>
    `;
  }

  /**
   * The order strip: one numbered slot per operative, reading out in plain
   * words what each of them is about to do.
   *
   * This is the third anchor of §4.6, and the only one that is legible without
   * looking at the stage. The other two — the command card over the operative,
   * the sights tag on the creature — say the same thing spatially; a player
   * checking "have I actually given four orders" should not have to read a
   * picture. All three are projections of `selectedActions`, so a withdrawal
   * here is the same withdrawal as a click on the card's cross.
   *
   * An empty slot is not blank. It names what will happen if the round is
   * committed anyway: the operative defends. That is the state a player most
   * needs to see and the one a bare gap hides.
   */
  private _renderOrderStrip(
    actionable: AgentCombatStateClient[],
    selected: Map<string, CombatAction>,
    enemies: EnemyCombatStateClient[],
  ) {
    if (actionable.length === 0) return nothing;
    const enemyNames = buildEnemyDisplayNames(enemies);
    const pending = dungeonState.pendingOrder.value;

    return html`
      <ol class="orders" aria-label=${msg('Orders this round')}>
        ${actionable.map((agent, index) => {
          const action = selected.get(agent.agent_id);
          const ability = action
            ? (agent.available_abilities.find((ab) => ab.id === action.ability_id) ?? null)
            : null;
          const abilityName = ability ? localizedValue(ability, 'name') : null;
          const targetName = action?.target_id
            ? (enemyNames.get(action.target_id) ??
              dungeonState.party.value.find((a) => a.agent_id === action.target_id)?.agent_name ??
              null)
            : null;
          const aiming = pending?.agent_id === agent.agent_id;
          const firstName = agent.agent_name.split(' ')[0];

          // Plain words, assembled here rather than in the template, so the
          // three shapes an order can take stay visible side by side.
          const text = abilityName
            ? targetName
              ? `${abilityName} \u2192 ${targetName}`
              : abilityName
            : aiming
              ? msg('Choosing a target…')
              : msg('Auto-defence');

          return html`
            <li class="orders__slot">
              <button
                class="order ${action ? 'order--set' : ''} ${aiming ? 'order--aiming' : ''}"
                type="button"
                @click=${() => this._handleOrderSlotClick(agent.agent_id, !!action)}
                aria-label=${
                  action
                    ? `${firstName}: ${text}. ${msg('Withdraw this order')}`
                    : `${firstName}: ${text}. ${msg('Give this operative an order')}`
                }
                title=${`${agent.agent_name} \u2013 ${text}`}
              >
                <span class="order__index" aria-hidden="true">${circledIndex(index)}</span>
                <span class="order__line">
                  <span class="order__who">${firstName}</span>
                  <span class="order__sep" aria-hidden="true">\u2013</span>
                  <span class="order__what">${text}</span>
                </span>
                ${
                  action
                    ? html`<span class="order__drop" aria-hidden="true">${icons.close(9)}</span>`
                    : nothing
                }
              </button>
            </li>
          `;
        })}
      </ol>
    `;
  }

  /** A set slot withdraws its order; an empty one opens that operative's desk.
   *  One click, two meanings, decided by the slot's own state — the same rule
   *  the command card over the operative follows. */
  private _handleOrderSlotClick(agentId: string, hasOrder: boolean): void {
    if (hasOrder) {
      dungeonState.deselectAction(agentId);
      dungeonState.cancelTargeting();
    }
    this._activeAgentId = agentId;
  }

  private _renderTimer(remainingMs: number | null, totalMs: number) {
    if (remainingMs === null) return nothing;

    const seconds = Math.ceil(remainingMs / 1000);
    const pct = Math.max(0, (remainingMs / totalMs) * 100);
    const urgency =
      remainingMs <= TIMER_CRITICAL_MS
        ? 'critical'
        : remainingMs <= TIMER_WARNING_MS
          ? 'warning'
          : '';

    return html`
      <div
        class="timer ${urgency ? `timer--${urgency}` : ''}"
        role="timer"
        aria-label=${msg('Planning time remaining')}
      >
        <span class="timer__label">${msg('Time')}</span>
        <div class="timer__track">
          <div class="timer__fill" style="width: ${pct}%"></div>
        </div>
        <span class="timer__seconds">${seconds}s</span>
      </div>
    `;
  }

  /**
   * Compact console: a portrait roster plus ONE open action desk.
   *
   * The roster answers "who acts, and who is already done"; the desk below
   * carries the abilities of exactly one of them. Selecting an action advances
   * to the next agent still waiting, so the common path is portrait -> action ->
   * (target) -> next, without the player ever choosing which panel to look at.
   */
  private _renderConsole(
    actionable: AgentCombatStateClient[],
    selected: Map<string, CombatAction>,
    enemies: EnemyCombatStateClient[],
  ) {
    const active = this._resolveActiveAgent(actionable, selected);
    if (!active) return nothing;

    return html`
      <div class="console">
        <div class="roster" role="tablist" aria-label=${msg('Agent actions')}>
          ${actionable.map((agent) => this._renderRosterChip(agent, selected, agent === active))}
        </div>
        ${this._renderDesk(active, selected, enemies)}
      </div>
    `;
  }

  /** The open agent: an explicit pick that is still waiting, else the first
   *  agent without an action, else the last one (everyone is done). */
  private _resolveActiveAgent(
    actionable: AgentCombatStateClient[],
    selected: Map<string, CombatAction>,
  ): AgentCombatStateClient | null {
    if (actionable.length === 0) return null;
    const picked = actionable.find((a) => a.agent_id === this._activeAgentId);
    if (picked) return picked;
    return actionable.find((a) => !selected.has(a.agent_id)) ?? actionable[actionable.length - 1];
  }

  private _renderRosterChip(
    agent: AgentCombatStateClient,
    selected: Map<string, CombatAction>,
    isActive: boolean,
  ) {
    const action = selected.get(agent.agent_id);
    const chosen = action
      ? (agent.available_abilities.find((ab) => ab.id === action.ability_id) ?? null)
      : null;
    const chosenName = chosen ? localizedValue(chosen, 'name') : null;
    const state = chosenName ?? getConditionLabel(agent.condition);

    return html`
      <button
        class="chip ${isActive ? 'chip--active' : ''} ${action ? 'chip--done' : ''}"
        type="button"
        role="tab"
        aria-selected=${isActive ? 'true' : 'false'}
        aria-label=${`${agent.agent_name} \u2013 ${state}`}
        title=${`${agent.agent_name} \u2013 ${state}`}
        @click=${() => {
          this._activeAgentId = agent.agent_id;
          dungeonState.cancelTargeting();
        }}
      >
        <velg-avatar
          class="chip__face"
          size="sm"
          .src=${agent.portrait_url ?? ''}
          .name=${agent.agent_name}
        ></velg-avatar>
        <span class="chip__text">
          <span class="chip__name">${agent.agent_name.split(' ')[0]}</span>
          <span class="chip__state">${state}</span>
        </span>
        ${action ? html`<span class="chip__done" aria-hidden="true">\u2713</span>` : nothing}
      </button>
    `;
  }

  /** The open agent's abilities and, when one needs a target, the target row. */
  private _renderDesk(
    agent: AgentCombatStateClient,
    selected: Map<string, CombatAction>,
    enemies: EnemyCombatStateClient[],
  ) {
    const selection = selected.get(agent.agent_id);
    const pending = dungeonState.pendingOrder.value;
    // An aim only opens THIS desk's target row when it belongs to this agent.
    // The scope was decided once, when the aim was taken, so no second reading
    // of `targets` can disagree with the one the stage is spotlighting.
    const isTargeting = pending?.agent_id === agent.agent_id;

    return html`
      <div class="desk" role="tabpanel" aria-label=${`${agent.agent_name} ${msg('actions')}`}>
        <div class="desk__head">
          <span class="desk__name">${agent.agent_name}</span>
          <span class="desk__condition">${getConditionLabel(agent.condition)}</span>
        </div>
        <div
          class="desk__abilities"
          role="radiogroup"
          aria-label=${msg('Abilities')}
          style="grid-template-columns: ${this._abilityColumns(agent)}"
        >
          ${this._renderAbilityGroups(agent, selection?.ability_id ?? null, enemies)}
        </div>
        ${isTargeting ? this._renderTargetPicker(agent, enemies) : nothing}
      </div>
    `;
  }

  private _renderAgent(
    agent: AgentCombatStateClient,
    selected: Map<string, CombatAction>,
    enemies: EnemyCombatStateClient[],
  ) {
    const selection = selected.get(agent.agent_id);
    // One reading of the aim, from the store. The stale-picker guard the old
    // code needed here is gone with the cause: an aim is only ever created for
    // an ability that actually wants a target, so there is no combination of
    // flags left that could describe a picker for a self-cast.
    const isTargeting = dungeonState.pendingOrder.value?.agent_id === agent.agent_id;
    const hasSelection = !!selection;

    const stripClass = [
      'agent',
      hasSelection ? 'agent--selected' : '',
      isTargeting ? 'agent--targeting' : '',
    ]
      .filter(Boolean)
      .join(' ');

    return html`
      <div
        class=${stripClass}
        role="listitem"
        aria-label=${`${agent.agent_name} ${msg('actions')}`}
      >
        <div class="agent__row">
          <span class="agent__name">${agent.agent_name}</span>
          ${
            hasSelection
              ? html`<span class="agent__done" aria-label=${msg('Action selected')}>${msg('OK')}</span>`
              : nothing
          }
          <span class="agent__condition">${getConditionLabel(agent.condition)}</span>
          <div class="agent__abilities" role="radiogroup" aria-label=${msg('Abilities')}>
            ${
              this.compact
                ? this._renderAbilityGroups(agent, selection?.ability_id ?? null, enemies)
                : orderAbilities(agent.available_abilities, agent.aptitudes).map((ability, i) =>
                    this._renderAbility(agent, ability, selection?.ability_id ?? null, enemies, i),
                  )
            }
          </div>
        </div>
        ${isTargeting ? this._renderTargetPicker(agent, enemies) : nothing}
      </div>
    `;
  }

  private _renderAbility(
    agent: AgentCombatStateClient,
    ability: AbilityOption,
    selectedId: string | null,
    enemies: EnemyCombatStateClient[],
    index = 0,
  ) {
    const isSelected = ability.id === selectedId;
    const onCooldown = ability.cooldown_remaining > 0;
    const name = localizedValue(ability, 'name');
    const description = localizedValue(ability, 'description');
    // Pictogram tiles are the graphical view only. The terminal view stays a
    // phosphor text list \u2014 that is its whole aesthetic, and a silhouette on a
    // scanline readout would read as an artefact.
    const mask = this.compact ? abilityPictogramUrl(ability.id) : null;
    const intent = abilityIntent(ability.targets);

    const classes = [
      'ability',
      mask ? `ability--tile ability--${intent}` : '',
      isSelected ? 'ability--selected' : '',
      onCooldown ? 'ability--cooldown' : '',
      ability.is_ultimate ? 'ability--ultimate' : '',
    ]
      .filter(Boolean)
      .join(' ');

    // The tooltip repeats the name because the visible label is clamped to two
    // lines; it is never the only place the name appears.
    const tooltip = ability.check_info
      ? `${name} \u2013 ${description} (${ability.check_info})`
      : `${name} \u2013 ${description}`;

    const body = mask
      ? html`
          <span class="ability__glyph-zone" aria-hidden="true">
            <span class="ability__glyph" style="--_mask: url('${mask}')"></span>
          </span>
          <span class="ability__name">${name}</span>
          ${
            ability.check_info
              ? html`<span class="ability__check">${ability.check_info}</span>`
              : nothing
          }
          ${
            onCooldown
              ? html`<span class="ability__cd-badge" aria-hidden="true"
                >${ability.cooldown_remaining}</span
              >`
              : nothing
          }
        `
      : html`
          ${ability.is_ultimate ? '\u2605 ' : ''}${name}${
            onCooldown
              ? html`<span class="ability__cd"> [${ability.cooldown_remaining}]</span>`
              : nothing
          }${
            ability.check_info
              ? html`<span class="ability__check"> ${ability.check_info}</span>`
              : nothing
          }
        `;

    return html`
      <button
        class=${classes}
        style="--i: ${index}"
        ?disabled=${onCooldown}
        role="radio"
        aria-checked=${isSelected ? 'true' : 'false'}
        aria-label=${
          onCooldown ? `${name} – ${msg('on cooldown')}: ${ability.cooldown_remaining}` : name
        }
        title=${tooltip}
        @click=${() => this._handleAbilityClick(agent, ability, enemies)}
      >
        ${body}
      </button>
    `;
  }

  /**
   * Compact layout: split an agent's abilities into intent clusters by target
   * type (Strike = enemy-targeting, Aid = ally-targeting, Guard = self) and
   * render each as a small labelled group. Turns one flat wall of ~16 buttons
   * into three scannable clusters. Data-driven off `ability.targets` — no
   * hardcoded ability lists.
   */
  /**
   * Die Faehigkeiten eines Agenten, geordnet und nach Absicht gebuendelt.
   *
   * Eine Ableitung, zwei Verbraucher: das Raster braucht die ANZAHLEN, um
   * seine Spalten proportional zu setzen, die Darstellung braucht die LISTEN.
   * Beides zweimal zu berechnen hiesse, zwei Wahrheiten zu pflegen.
   */
  private _abilityGroups(agent: AgentCombatStateClient) {
    // Die Reihenfolge, in der der Server die Faehigkeiten schickt, ist die
    // Iterationsreihenfolge eines Dictionaries — fuer den Spieler ohne Aussage.
    // `orderAbilities` gibt ihr eine: einsatzbereit vor abklingend, dann was
    // dieser Operative am besten kann, universelle zuletzt.
    const buckets: Record<AbilityIntent, AbilityOption[]> = { strike: [], aid: [], guard: [] };
    for (const ability of orderAbilities(agent.available_abilities, agent.aptitudes)) {
      buckets[abilityIntent(ability.targets)].push(ability);
    }
    return [
      { key: 'strike', label: msg('Strike'), items: buckets.strike },
      { key: 'aid', label: msg('Aid'), items: buckets.aid },
      { key: 'guard', label: msg('Guard'), items: buckets.guard },
    ].filter((g) => g.items.length > 0);
  }

  /**
   * Spaltenbreiten des Faehigkeitsrasters.
   *
   * Nicht proportional zur ZAHL der Kacheln, sondern zur Zahl der KACHEL-
   * SPALTEN, die eine Gruppe braucht, um in TARGET_TILE_ROWS Zeilen zu passen.
   *
   * Der Unterschied ist der ganze Punkt, und der erste Anlauf hatte ihn falsch:
   * proportional zur Anzahl bekommt jede Gruppe dieselbe FLAECHE, aber die Zahl
   * der Zeilen haengt an `floor(Breite / Kachelbreite)`. Gemessen bei 884px und
   * einer Aufteilung 8:3:5 ergab das 421 | 158 | 263 px — und die 158px der
   * Aid-Gruppe fassen genau EINE Kachel je Zeile, also drei Zeilen. Das Raster
   * war 264px hoch statt der 273px der alten Zeilen: praktisch nichts gewonnen.
   *
   * Mit ceil(n / 2) wird aus 8:3:5 die Aufteilung 4:2:3. Bei denselben 884px
   * sind das 393 | 196 | 295 px, also 4 | 2 | 3 Kacheln je Zeile und damit
   * ueberall ZWEI Zeilen — rund 177px statt 273px.
   *
   * `fr` statt fester Pixel, damit das Raster mitschrumpft: wird es schmaler,
   * brechen alle Gruppen gemeinsam auf drei Zeilen um, statt dass eine
   * ueberlaeuft. Zwei Zeilen sind deshalb ein ZIEL, keine Zusicherung.
   */
  private _abilityColumns(agent: AgentCombatStateClient): string {
    const TARGET_TILE_ROWS = 2;
    const groups = this._abilityGroups(agent);
    if (groups.length === 0) return 'none';
    return groups
      .map((g) => `${Math.max(1, Math.ceil(g.items.length / TARGET_TILE_ROWS))}fr`)
      .join(' ');
  }

  private _renderAbilityGroups(
    agent: AgentCombatStateClient,
    selectedId: string | null,
    enemies: EnemyCombatStateClient[],
  ) {
    const groups = this._abilityGroups(agent);

    let staggerIndex = 0;
    return groups.map(
      (g) => html`
        <div class="agroup agroup--${g.key}">
          <span class="agroup__label" aria-hidden="true">${g.label}</span>
          <div class="agroup__items">
            ${g.items.map((ability) =>
              this._renderAbility(agent, ability, selectedId, enemies, staggerIndex++),
            )}
          </div>
        </div>
      `,
    );
  }

  private _renderTargetPicker(agent: AgentCombatStateClient, enemies: EnemyCombatStateClient[]) {
    if (dungeonState.pendingOrder.value?.scope === 'ally') {
      const allies = dungeonState.party.value.filter(
        (a) => a.agent_id !== agent.agent_id && a.condition !== 'captured',
      );
      return this._renderAllyTargets(allies);
    }
    return this._renderTargets(enemies);
  }

  private _renderAllyTargets(allies: AgentCombatStateClient[]) {
    return html`
      <div class="targets" role="listbox" aria-label=${msg('Select ally')}>
        <span class="targets__label">\u25BA ${msg('Ally')}:</span>
        ${allies.map(
          (ally) => html`
            <button
              class="target target--ally"
              role="option"
              @click=${() => this._handleTargetClick(ally.agent_id)}
            >
              ${
                this.compact
                  ? html`<velg-avatar
                      class="target__face"
                      size="xs"
                      .src=${ally.portrait_url ?? ''}
                      .name=${ally.agent_name}
                    ></velg-avatar>`
                  : nothing
              }
              ${ally.agent_name}
            </button>
          `,
        )}
      </div>
    `;
  }

  private _renderTargets(enemies: EnemyCombatStateClient[]) {
    const displayNames = buildEnemyDisplayNames(enemies);

    return html`
      <div class="targets" role="listbox" aria-label=${msg('Select target')}>
        <span class="targets__label">\u25BA ${msg('Target')}:</span>
        ${enemies.map((enemy) => {
          const baseName = displayNames.get(enemy.instance_id) ?? enemy.name_en;
          const cond =
            enemy.condition_display !== 'healthy'
              ? ` (${getEnemyConditionLabel(enemy.condition_display)})`
              : '';
          // The creature, not just its name: the band above shows the same
          // cutout, so the target row and the stage speak about the same thing.
          const art = this.compact ? dungeonEnemyArtUrl(enemy.image_path) : null;
          return html`
            <button
              class="target"
              role="option"
              @click=${() => this._handleTargetClick(enemy.instance_id)}
            >
              ${
                art
                  ? html`<img
                      class="target__art"
                      src=${art}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      aria-hidden="true"
                    />`
                  : nothing
              }
              ${baseName}${cond}
            </button>
          `;
        })}
      </div>
    `;
  }

  // -- Handlers -------------------------------------------------------------

  private _handleAbilityClick(
    agent: AgentCombatStateClient,
    ability: AbilityOption,
    enemies: EnemyCombatStateClient[],
  ): void {
    if (ability.cooldown_remaining > 0) return;

    // Clicking the ability you are already aiming with puts it down again. The
    // alternative — re-arming the same aim — leaves a player who clicked by
    // mistake hunting for the way out; Escape is the other way, but only one of
    // the two is discoverable by clicking.
    const aimed = dungeonState.pendingOrder.value;
    if (aimed?.agent_id === agent.agent_id && aimed.ability_id === ability.id) {
      dungeonState.cancelTargeting();
      return;
    }

    // Auto-dismiss onboarding briefing on first ability selection (UX-04)
    if (this._showOnboarding) this._dismissOnboarding();

    const alive = enemies.filter((e) => e.is_alive);

    // Self-targeting (Observe, Taunt, Fortify, Evade): 1 click, auto-target self
    if (ability.targets === 'self') {
      dungeonState.selectAction(agent.agent_id, ability.id, agent.agent_id);
      this._clearTargeting();
      this._advance();
      return;
    }

    // All-target (Rally, Detonate): 1 click, no target needed
    if (ability.targets === 'all_enemies' || ability.targets === 'all_allies') {
      dungeonState.selectAction(agent.agent_id, ability.id);
      this._clearTargeting();
      this._advance();
      return;
    }

    // Single ally target (Shield, Inspire): auto-pick if only 1 other ally
    if (ability.targets === 'single_ally') {
      const allies = dungeonState.party.value.filter(
        (a) => a.agent_id !== agent.agent_id && a.condition !== 'captured',
      );
      if (allies.length <= 1) {
        dungeonState.selectAction(agent.agent_id, ability.id, allies[0]?.agent_id);
        this._clearTargeting();
        this._advance();
        return;
      }
      // Several allies: aim, and place nothing yet.
      dungeonState.beginTargeting(agent.agent_id, ability.id, 'ally');
      return;
    }

    // Single enemy: auto-target directly
    if (alive.length <= 1) {
      dungeonState.selectAction(agent.agent_id, ability.id, alive[0]?.instance_id);
      this._clearTargeting();
      this._advance();
      return;
    }

    // Several creatures: aim, and place nothing yet.
    //
    // This used to place the order on the FIRST creature and let a later click
    // move it. That was a defence against a real failure — an action submitted
    // with target_id: null is dropped by the backend in silence, no damage and
    // no miss — but it defended by guessing: a player who clicked an ability
    // and then Execute struck whatever happened to be leftmost, and nothing on
    // screen had ever claimed otherwise. The aim is the honest form of the same
    // guarantee: while it is pending NOTHING is placed, so nothing can be
    // submitted half-formed, and the operative simply counts as not ready yet
    // (allActionsSelected sees no entry, Execute stays shut). The three anchors
    // of §4.6 then have something true to show — a spotlight for "choosing",
    // a command card for "chosen" — where before both states looked alike.
    dungeonState.beginTargeting(agent.agent_id, ability.id, 'enemy');
  }

  private _clearTargeting(): void {
    dungeonState.cancelTargeting();
  }

  private _renderOnboarding() {
    return html`
      <div class="briefing" role="note" aria-label=${msg('Combat briefing')}>
        <div class="briefing__header">${msg('Combat briefing')}</div>
        <ol class="briefing__steps">
          <li class="briefing__step" data-num="1.">${msg('Click an ability for each agent below')}</li>
          <li class="briefing__step" data-num="2.">${msg('Self-abilities auto-target -- one click')}</li>
          <li class="briefing__step" data-num="3.">${msg('Attack abilities require an enemy target')}</li>
          <li class="briefing__step" data-num="4.">${msg('Press EXECUTE when all agents have orders')}</li>
        </ol>
        <div class="briefing__footer">
          <span class="briefing__alt">${msg('Or type commands in terminal')}</span>
          <button class="briefing__ack" @click=${this._dismissOnboarding}>
            ${msg('Acknowledged')}
          </button>
        </div>
      </div>
    `;
  }

  private _dismissOnboarding(): void {
    this._showOnboarding = false;
    globalThis.localStorage?.setItem('dungeon_combat_onboarded', '1');
  }

  private _handleTargetClick(targetId: string): void {
    const pending = dungeonState.pendingOrder.value;
    if (!pending) return;
    // selectAction clears the aim itself, at the one seam every placement
    // passes through — so there is nothing to reset here.
    dungeonState.selectAction(pending.agent_id, pending.ability_id, targetId);
    this._advance();
  }

  /**
   * Hand the console to the next agent still without an action.
   *
   * Clearing the explicit pick is enough: _resolveActiveAgent falls back to the
   * first agent without a selection, so the console moves forward on its own
   * and stops on the last one when everybody is ready. A player who wants to
   * revise an earlier choice clicks that portrait; the next completed selection
   * carries them forward again.
   */
  private _advance(): void {
    if (!this.compact) return;
    this._activeAgentId = null;
  }

  private _handleSubmit(): void {
    if (!dungeonState.allActionsSelected.value || dungeonState.combatSubmitting.value) return;
    this._dispatchCommand('submit');
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-dungeon-combat-bar': VelgDungeonCombatBar;
  }
}
