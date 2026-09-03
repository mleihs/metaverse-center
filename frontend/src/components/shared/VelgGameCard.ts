/**
 * VelgGameCard — Unified TCG card component.
 *
 * Used for agents and buildings across the entire platform.
 * 5:8 aspect ratio, 4 sizes, 3 rarity tiers, per-simulation themed frames,
 * 3D tilt on hover, holographic foil for legendary cards, stat gems, aptitude pips.
 */

import { localized, msg } from '@lit/localize';
import { effect } from '@preact/signals-core';
import { css, html, LitElement, nothing, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';
import type { CardFrame } from '../../services/card-frame.js';
import { activeCardFrame, DEFAULT_CARD_FRAME } from '../../services/card-frame.js';
import type { AptitudeSet, OperativeType } from '../../types/index.js';
import { OPERATIVE_COLORS as OP_COLORS } from '../../utils/operative-constants.js';

const OP_LABELS: OperativeType[] = [
  'spy',
  'guardian',
  'saboteur',
  'propagandist',
  'infiltrator',
  'assassin',
];

const OP_SHORT: Record<OperativeType, string> = {
  spy: 'SPY',
  guardian: 'GRD',
  saboteur: 'SAB',
  propagandist: 'PRP',
  infiltrator: 'INF',
  assassin: 'ASN',
};

export type CardType = 'agent' | 'building' | 'loot';
/** Was die RUECKSEITE ueber die Stufe verraet, bevor sie sich dreht. */
export type CardRarityTell = 'none' | 'rare' | 'legendary';
export type CardSize = 'xs' | 'sm' | 'md' | 'lg';
export type CardRarity = 'common' | 'rare' | 'legendary';

export interface CardBadge {
  label: string;
  variant?: string;
}

export interface CapacityBar {
  current: number;
  max: number;
}

@localized()
@customElement('velg-game-card')
export class VelgGameCard extends LitElement {
  static styles = css`
    /* ═══════════════════════════════════════════════════
       CARD CONTAINER — perspective wrapper
       ═══════════════════════════════════════════════════ */
    :host {
      display: block;
      --card-w: 200px;
      --card-h: 320px;
      /* Theme-inherited card tokens (defaults for non-themed contexts) */
      --card-frame-primary: var(--color-primary);
      --card-frame-secondary: var(--color-secondary);
      --card-bg: var(--color-surface);
      --card-bg-deep: var(--color-surface-sunken);
      --card-text: var(--color-text-primary);
      --card-text-dim: var(--color-text-secondary);
      --card-border-color: var(--color-border);
      --card-radius: var(--border-radius, 0px);
      --card-font-heading: var(--font-brutalist, 'Oswald', sans-serif);
      --card-font-body: var(--font-body, system-ui, sans-serif);
      --card-font-mono: var(--font-mono, monospace);
    }

    :host([size="xs"]) { --card-w: 80px;  --card-h: 128px; }
    :host([size="sm"]) { --card-w: 120px; --card-h: 192px; }
    :host([size="md"]) { --card-w: 200px; --card-h: 320px; }
    :host([size="lg"]) { --card-w: 280px; --card-h: 448px; }

    .card-perspective {
      width: var(--card-w);
      height: var(--card-h);
      perspective: 800px;
    }

    /* ═══════════════════════════════════════════════════
       FLIPPER — nur type="loot"
       Zwei Flaechen auf einer Achse. agent/building rendern diesen Block
       nie, deshalb aendert er an keiner bestehenden Karte etwas.
       ═══════════════════════════════════════════════════ */
    .card-flipper {
      position: relative;
      width: 100%;
      height: 100%;
      transform-style: preserve-3d;
      transition: transform 850ms cubic-bezier(0.3, 0.1, 0.25, 1);
      transform: rotateY(0deg);
    }
    .card-flipper--down {
      transform: rotateY(180deg);
    }
    .card-flipper__face {
      position: absolute;
      inset: 0;
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
    }
    .card-flipper__face--back {
      transform: rotateY(180deg);
    }

    /* ── Die Rueckseite ────────────────────────────────── */
    .card-back {
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-4);
      border: var(--border-width-thin) solid var(--color-border);
      border-radius: calc(var(--card-radius) + 6px);
      box-shadow: var(--shadow-md);
      overflow: hidden;
      background-color: var(--color-surface-sunken);
      background-image: repeating-linear-gradient(
        45deg,
        color-mix(in srgb, var(--color-accent-amber) 4%, transparent) 0 2px,
        transparent 2px 10px
      );
    }
    .card-back__corners {
      position: absolute;
      inset: var(--space-2);
      border: var(--border-width-thin) dashed
        color-mix(in srgb, var(--color-accent-amber) 22%, transparent);
      pointer-events: none;
    }
    .card-back__lozenge {
      width: 46%;
      aspect-ratio: 1;
      display: grid;
      place-items: center;
      transform: rotate(45deg);
      border: var(--border-width-thin) solid
        color-mix(in srgb, var(--color-accent-amber) 45%, transparent);
      background: color-mix(in srgb, var(--color-accent-amber) 5%, transparent);
    }
    .card-back__lozenge span {
      transform: rotate(-45deg);
      font-family: var(--font-brutalist);
      font-weight: var(--font-bold);
      letter-spacing: var(--tracking-brutalist);
      font-size: var(--text-lg);
      color: color-mix(in srgb, var(--color-accent-amber) 78%, var(--color-text-primary));
    }
    .card-back__label {
      font-family: var(--font-brutalist);
      font-size: var(--text-xs);
      text-transform: var(--label-transform);
      letter-spacing: var(--tracking-widest);
      color: var(--color-text-muted);
    }

    /*
     * Der Verrat. Eine EIGENE Schicht pulst, nicht der Flipper selbst:
     * ein box-shadow-Keyframe auf einem preserve-3d-Element flackert in
     * Chrome. Ein Takt, nicht mehr — sonst strobt es.
     */
    .card-back__aura {
      position: absolute;
      inset: -2px;
      border-radius: inherit;
      pointer-events: none;
      opacity: 0;
      animation: card-back-tell 1.6s var(--ease-dramatic, ease-in-out) infinite;
    }
    .card-back--tell-rare .card-back__aura {
      box-shadow: 0 0 0 1px var(--color-info),
        0 0 calc(18px * var(--glow-strength)) color-mix(in srgb, var(--color-info) 55%, transparent);
    }
    .card-back--tell-legendary .card-back__aura {
      box-shadow: 0 0 0 1px var(--color-accent-amber),
        0 0 calc(26px * var(--glow-strength)) color-mix(in srgb, var(--color-accent-amber) 65%, transparent);
      animation-duration: 1.8s;
    }
    .card-back--tell-rare {
      border-color: color-mix(in srgb, var(--color-info) 60%, var(--color-border));
    }
    .card-back--tell-legendary {
      border-color: color-mix(in srgb, var(--color-accent-amber) 70%, var(--color-border));
    }
    @keyframes card-back-tell {
      0%, 100% { opacity: 0.15; }
      50%      { opacity: 0.85; }
    }

    @media (prefers-reduced-motion: reduce) {
      .card-flipper { transition-duration: 0.01ms; }
      .card-back__aura { animation: none; opacity: 0.5; }
    }

    /* ═══════════════════════════════════════════════════
       CARD FRAME — the physical card
       ═══════════════════════════════════════════════════ */
    .card {
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      border-radius: calc(var(--card-radius) + 6px);
      overflow: hidden;
      cursor: pointer;
      will-change: transform;
      transition: transform 200ms var(--ease-out, ease-out),
                  box-shadow 200ms var(--ease-out, ease-out);

      /* Default border */
      border: 2px solid var(--card-border-color);
      background: var(--card-bg-deep);
      box-shadow: 0 2px 8px color-mix(in srgb, var(--color-shadow) 30%, transparent);

      /* Entrance animation */
      opacity: 0;
      animation: card-deal var(--duration-entrance, 400ms)
                 var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)) forwards;
      animation-delay: calc(var(--i, 0) * var(--duration-stagger, 50ms));
    }

    @keyframes card-deal {
      from {
        opacity: 0;
        transform: translateY(60px) scale(0.8) rotateZ(8deg);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1) rotateZ(0deg);
      }
    }

    /* Tilt on hover (JS sets --mx, --my 0..1) */
    .card--interactive:hover {
      box-shadow: 0 8px 30px color-mix(in srgb, var(--color-shadow) 50%, transparent);
    }

    .card--interactive.card--tilting {
      transform-style: preserve-3d;
      transition: box-shadow 200ms var(--ease-out, ease-out);
      transform: scale(1.05) translateY(-8px)
                 rotateX(calc((0.5 - var(--my, 0.5)) * 24deg))
                 rotateY(calc((var(--mx, 0.5) - 0.5) * 24deg));
    }

    /* Spring-back on leave */
    .card--interactive.card--settling {
      transition: transform 600ms cubic-bezier(0.34, 1.56, 0.64, 1),
                  box-shadow 400ms var(--ease-out, ease-out);
      transform: scale(1) translateY(0) rotateX(0) rotateY(0);
    }

    /* Dimmed state (drafted) */
    .card--dimmed {
      filter: grayscale(0.8) brightness(0.6);
      opacity: 0.35;
      pointer-events: none;
    }

    .card--highlighted {
      box-shadow: 0 0 0 3px var(--card-frame-primary),
                  0 0 calc(20px * var(--glow-strength)) color-mix(in srgb, var(--card-frame-primary) 40%, transparent);
    }

    /* ── Light reflection overlay (follows mouse) ── */
    .card__reflection {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 5;
      opacity: 0;
      transition: opacity 300ms ease;
      /* lint-color-ok — mouse-follow light reflection, deliberately light */
      background: radial-gradient(
        circle at calc(var(--mx, 0.5) * 100%) calc(var(--my, 0.5) * 100%),
        rgba(255,255,255,0.15),
        transparent 60%
      );
      mix-blend-mode: overlay;
    }

    .card--tilting .card__reflection {
      opacity: 1;
    }

    /* ── Holographic foil (legendary only) ── */
    .card__holo {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 6;
      opacity: 0;
      transition: opacity 300ms ease;
      background: linear-gradient(
        115deg,
        transparent 20%,
        rgba(255,100,100,0.1) 30%,
        rgba(100,255,100,0.1) 40%,
        rgba(100,100,255,0.1) 50%,
        transparent 60%
      );
      background-size: 300% 300%;
      background-position: calc(var(--mx, 0.5) * 100%) calc(var(--my, 0.5) * 100%);
      mix-blend-mode: color-dodge;
      filter: brightness(0.8) contrast(2);
    }

    .card--tilting .card__holo {
      opacity: 1;
    }

    /* ── Rarity borders ── */
    .card--common {
      border-color: var(--card-border-color);
    }

    .card--rare {
      border-color: transparent;
      background-clip: padding-box;
      border-image: linear-gradient(
        180deg,
        var(--card-frame-primary),
        var(--card-border-color)
      ) 1;
    }

    .card--rare.card--rounded-border {
      /* For sims with border-radius > 0, use box-shadow instead of border-image */
      border-image: none;
      border-color: var(--card-frame-primary);
      box-shadow: 0 2px 8px color-mix(in srgb, var(--color-shadow) 30%, transparent),
                  0 0 0 1px var(--card-frame-primary);
    }

    .card--legendary {
      border-color: var(--card-frame-primary);
      animation: card-deal var(--duration-entrance, 400ms)
                 var(--ease-spring) forwards,
                 legendary-glow 3s ease-in-out infinite;
      animation-delay: calc(var(--i, 0) * var(--duration-stagger, 50ms)), 0s;
    }

    @keyframes legendary-glow {
      0%, 100% {
        box-shadow: 0 2px 8px color-mix(in srgb, var(--color-shadow) 30%, transparent),
                    0 0 calc(4px * var(--glow-strength)) color-mix(in srgb, var(--card-frame-primary) 40%, transparent);
      }
      50% {
        box-shadow: 0 2px 8px color-mix(in srgb, var(--color-shadow) 30%, transparent),
                    0 0 calc(12px * var(--glow-strength)) color-mix(in srgb, var(--card-frame-primary) 60%, transparent);
      }
    }

    /* ── Idle micro-sway ── */
    .card--idle {
      animation: card-deal var(--duration-entrance, 400ms) var(--ease-spring) forwards,
                 card-sway 4s ease-in-out infinite;
      animation-delay: calc(var(--i, 0) * var(--duration-stagger, 50ms)),
                       calc(var(--i, 0) * 200ms);
    }

    @keyframes card-sway {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-1px); }
    }

    /* Legendary gets sway + glow combined */
    .card--legendary.card--idle {
      animation: card-deal var(--duration-entrance, 400ms) var(--ease-spring) forwards,
                 card-sway 4s ease-in-out infinite,
                 legendary-glow 3s ease-in-out infinite;
      animation-delay: calc(var(--i, 0) * var(--duration-stagger, 50ms)),
                       calc(var(--i, 0) * 200ms),
                       0s;
    }

    /* ═══════════════════════════════════════════════════
       STAT GEMS — top corners
       ═══════════════════════════════════════════════════ */
    .card__gems {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      display: flex;
      justify-content: space-between;
      padding: 6px 8px;
      z-index: 3;
      pointer-events: none;
    }

    .gem {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 24px;
      min-height: 24px;
      width: 24px;
      height: 24px;
      font-family: var(--card-font-mono);
      font-weight: 700;
      font-size: 11px;
      color: var(--card-text);
      border: 1px solid var(--card-border-color);
      background: var(--card-bg-deep);
      transform: rotate(45deg);
      border-radius: 4px;
    }

    /* Scale up diamond for wide numbers (4+ chars) */
    .gem--wide {
      width: 30px;
      height: 30px;
      font-size: 9px;
    }

    .gem__inner {
      transform: rotate(-45deg);
      line-height: 1;
      white-space: nowrap;
    }

    .gem--glow {
      border-color: var(--gem-color, var(--card-frame-primary));
      box-shadow: 0 0 calc(6px * var(--glow-strength)) color-mix(in srgb, var(--gem-color, var(--card-frame-primary)) 50%, transparent);
    }

    /* Size scaling for gems */
    :host([size="xs"]) .card__gems { padding: 3px 4px; }
    :host([size="xs"]) .gem { width: 14px; height: 14px; font-size: 7px; }
    :host([size="sm"]) .card__gems { padding: 4px 6px; }
    :host([size="sm"]) .gem { width: 18px; height: 18px; font-size: 9px; }
    :host([size="lg"]) .gem { width: 30px; height: 30px; font-size: 14px; }

    /* Condition dots for buildings (right gem replacement) */
    .gem--condition {
      background: transparent;
      border: none;
      box-shadow: none;
      transform: none;
      gap: 2px;
      width: auto;
    }

    .gem--condition .gem__inner {
      transform: none;
      display: flex;
      gap: 2px;
    }

    .condition-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      border: 1px solid var(--dot-color, #555);
    }

    .condition-dot--filled {
      background: var(--dot-color, #555);
    }

    :host([size="xs"]) .condition-dot { width: 3px; height: 3px; }
    :host([size="sm"]) .condition-dot { width: 4px; height: 4px; }
    :host([size="lg"]) .condition-dot { width: 8px; height: 8px; }

    /* ═══════════════════════════════════════════════════
       ART FRAME — portrait / building image
       ═══════════════════════════════════════════════════ */
    .card__art {
      position: relative;
      flex: 0 0 60%;
      overflow: hidden;
      background: var(--card-bg-deep);
      border-bottom: 1px solid color-mix(in srgb, var(--card-frame-primary) 30%, transparent);
    }

    .card__art img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: top;
      display: block;
    }

    .card__art-placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      color: var(--card-text-dim);
      opacity: 0.55;
    }

    /*
      Crest placeholder.

      A card whose portrait has not arrived yet used to show the same person
      or house glyph as every other card of its kind — twelve identical
      pictograms in a fan, telling the reader nothing about which card is
      which. The crest carries the initial inside the 45-degree lozenge the
      rest of the deck already uses (card back, anchor dossier, deploy slot),
      so a face-down fan stays readable as a list of names.
    */
    .card__art-placeholder--crest {
      opacity: 1;
    }

    .card__crest {
      /* Defaults to the simulation frame; a call site that groups cards by
         faction (the Forge ignition fan) points it at its own colour without
         touching the frame the world chose for everything else. */
      --_crest: var(--card-crest-color, var(--card-frame-primary));
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 46%;
      aspect-ratio: 1;
      transform: rotate(45deg);
      border: 1px solid color-mix(in srgb, var(--_crest) 55%, transparent);
      background: color-mix(in srgb, var(--card-bg-deep) 82%, var(--_crest));
      box-shadow:
        inset 0 0 calc(12px * var(--glow-strength)) color-mix(in srgb, var(--_crest) 22%, transparent),
        0 0 calc(10px * var(--glow-strength)) color-mix(in srgb, var(--_crest) 14%, transparent);
    }

    .card__crest::before {
      content: '';
      position: absolute;
      inset: 14%;
      border: 1px solid color-mix(in srgb, var(--_crest) 28%, transparent);
    }

    .card__crest-letter {
      transform: rotate(-45deg);
      font-family: var(--card-font-heading, var(--font-brutalist, 'Courier New', monospace));
      font-weight: 900;
      font-size: calc(var(--card-w) * 0.16);
      letter-spacing: 0;
      line-height: 1;
      color: color-mix(in srgb, var(--_crest) 78%, var(--card-text, #e5e5e5));
    }

    /* Inner glow on art frame */
    .card__art::after {
      content: '';
      position: absolute;
      inset: 0;
      box-shadow: inset 0 0 calc(12px * var(--glow-strength)) color-mix(in srgb, var(--color-shadow) 25%, transparent);
      pointer-events: none;
    }

    /* ═══════════════════════════════════════════════════
       NAME PLATE
       ═══════════════════════════════════════════════════ */
    .card__nameplate {
      padding: 6px 10px 4px;
      background: color-mix(in srgb, var(--card-bg-deep) 90%, var(--card-frame-primary));
      border-bottom: 1px solid var(--card-border-color);
    }

    .card__name {
      font-family: var(--card-font-heading);
      font-weight: 700;
      font-size: 12px;
      text-transform: var(--label-transform);
      letter-spacing: 0.06em;
      color: var(--card-text);
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      line-height: 1.3;
    }

    .card__name-divider {
      width: 60%;
      height: 1px;
      margin: 3px auto 0;
      background: linear-gradient(90deg,
        transparent,
        var(--card-frame-primary),
        transparent
      );
    }

    :host([size="xs"]) .card__nameplate { padding: 2px 4px 1px; }
    :host([size="xs"]) .card__name { font-size: 7px; letter-spacing: 0.04em; }
    :host([size="sm"]) .card__nameplate { padding: 4px 6px 2px; }
    :host([size="sm"]) .card__name { font-size: 10px; }
    :host([size="lg"]) .card__nameplate { padding: 8px 14px 6px; }
    :host([size="lg"]) .card__name { font-size: 16px; }

    /* ═══════════════════════════════════════════════════
       CARD BODY — aptitude pips, badges, subtitle
       ═══════════════════════════════════════════════════ */
    .card__body {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 3px;
      padding: 5px 10px 6px;
      min-height: 0;
      overflow: hidden;
    }

    :host([size="xs"]) .card__body { padding: 2px 4px 3px; gap: 1px; }
    :host([size="sm"]) .card__body { padding: 3px 6px 4px; gap: 2px; }
    :host([size="lg"]) .card__body { padding: 8px 14px 10px; gap: 5px; }

    /* ── Aptitude Pips ── */
    .card__pips {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }

    .pip {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1px;
    }

    .pip__dot {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: var(--card-font-mono);
      font-weight: 700;
      font-size: 9px;
      color: var(--card-bg-deep);
      background: var(--pip-color);
      border: 1px solid color-mix(in srgb, var(--pip-color) 60%, transparent);
      transition: all 150ms ease;
    }

    .pip__dot--dim {
      opacity: 0.4;
      filter: saturate(0.5);
    }

    .pip__dot--bright {
      box-shadow: 0 0 calc(6px * var(--glow-strength)) color-mix(in srgb, var(--pip-color) 50%, transparent);
    }

    .pip__label {
      font-family: var(--card-font-mono);
      font-size: 6px;
      text-transform: var(--label-transform);
      letter-spacing: 0.08em;
      color: var(--card-text-dim);
      line-height: 1;
    }

    :host([size="xs"]) .card__pips { display: none; }
    :host([size="sm"]) .pip__dot { width: 14px; height: 14px; font-size: 7px; }
    :host([size="sm"]) .pip__label { display: none; }
    :host([size="lg"]) .pip__dot { width: 22px; height: 22px; font-size: 11px; }
    :host([size="lg"]) .pip__label { font-size: 7px; }

    /* ── Subtitle & Badges ── */
    /*
      Der Untertitel traegt den Beruf, und Berufe sind laenger als eine Zeile.

      Auf Prod gemessen (02.09.2026): 111 Agenten mit Beruf, 104 VERSCHIEDENE
      Werte, Mittel 36 Zeichen, 15 davon laenger als 34. In eine 200-px-Karte
      passen bei 9 px rund 34 Zeichen — jeder siebte Beruf der Plattform wurde
      also abgeschnitten, nicht nur der eine, der auffiel.

      Ein "white-space: nowrap" galt bis dahin in JEDER Groesse. Das ist richtig,
      wo kein Platz ist (xs blendet den Untertitel ohnehin aus, sm hat 120 px),
      und falsch, wo welcher da ist. Ab md darf er auf zwei Zeilen umbrechen;
      die Ellipse bleibt als letzte Grenze, damit ein 380-Zeichen-Wert (der
      laengste auf dem Bestand, aus einer Welt von vor der Laengendisziplin)
      die Karte nicht sprengt.

      Bewusst NICHT der Weg, den einzelnen zu langen Beruf zu kuerzen: das
      haette einen von fuenfzehn behoben und den Grund stehen gelassen.
    */
    .card__subtitle {
      font-family: var(--card-font-body);
      font-size: 9px;
      color: var(--card-text-dim);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      line-height: 1.3;
    }

    :host([size="xs"]) .card__subtitle { display: none; }
    :host([size="sm"]) .card__subtitle { font-size: 8px; }
    :host([size="lg"]) .card__subtitle { font-size: 12px; }

    :host([size="md"]) .card__subtitle,
    :host([size="lg"]) .card__subtitle {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      white-space: normal;
      overflow-wrap: anywhere;
    }

    .card__description {
      font-family: var(--card-font-body);
      font-size: 8px;
      color: var(--card-text-dim);
      line-height: 1.4;
      display: -webkit-box;
      flex-shrink: 1;
      min-height: 0;
      -webkit-line-clamp: 4;
      -webkit-box-orient: vertical;
      overflow: hidden;
      opacity: 0.8;
    }

    :host([size="xs"]) .card__description { display: none; }
    :host([size="sm"]) .card__description { -webkit-line-clamp: 1; font-size: 7px; }
    :host([size="lg"]) .card__description { -webkit-line-clamp: 5; font-size: 10px; }

    /*
     * Placed after the size rules on purpose: it must win over all of them,
     * including the size-lg clamp of 5. A building's description is prose and
     * is not a caption of any length.
     */
    /*
     * Freigegeben heisst nicht unbegrenzt.
     *
     * Diese Regel hob die Klammer der schmalen Karte auf — richtig, denn dort
     * standen zwei Zeilen fuer einen Absatz. Sie hob sie aber GANZ auf, und
     * damit bestimmt die laengste Beschreibung im Raster die Hoehe aller
     * Karten daneben. Auf Prod gemessen: 200 Zeichen ohne Klammer, und in
     * anderen Welten geht das deutlich weiter.
     *
     * Sechs Zeilen: genug fuer den Absatz, den der Entwurf hier sehen will
     * („Bild-Karten 3x mit vollem Beschreibungstext"), und wenig genug, dass
     * die Karten einer Reihe dieselbe Gestalt behalten. Wer alles lesen will,
     * oeffnet die Karte — dafuer gibt es die Detailtafel.
     *
     * Dieselbe Ueberlegung wie im Register des Dashboards: ungleiche Hoehen
     * sind kein Rhythmus, sondern die Abwesenheit von einem.
     */
    :host([full-description]) .card__description {
      -webkit-line-clamp: 6;
      line-clamp: 6;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    /*
     * full-description ist die BREITE Fassung der Karte, nicht nur eine
     * längere Bildunterschrift.
     *
     * Ohne diesen Block gab die Regel darüber den Text frei und liess die BOX
     * bei ihren festen 200 × 320 px stehen. Auf Produktion gemessen
     * (2560 px, Gebäude-Reiter): die Rasterzelle war 611 px breit, die Karte
     * 200 — **411 px jeder Zelle blieben leer**, und die entfesselte Prosa
     * quetschte sich in ein Fünftel der Breite. Der Nutzer las das als
     * (Wortlaut nicht wiedergegeben).
     *
     * Der Entwurf verlangt für diesen Reiter (Wortlaut nicht wiedergegeben) — also eine Karte, die ihre Spalte ausfüllt. Die
     * Grössenleiter xs/sm/md/lg endet bei 280 px; für 611 gibt es dort keine
     * Sprosse, und es soll auch keine geben: die Breite gehört hier dem
     * Raster, nicht der Karte.
     *
     * Drei Kopplungen mussten dafür gelöst werden, und die zweite ist die,
     * die man übersieht:
     *   1. --card-w/--card-h — Breite an die Zelle, Höhe an den Inhalt.
     *   2. .card__art steht auf flex: 0 0 60% — ein Prozentsatz der
     *      KARTENHÖHE. Sobald die Höhe auto ist, hat er keinen Bezug mehr
     *      und fällt auf null. Deshalb hier eine feste Bildhöhe.
     *   3. .card__body hat overflow: hidden, was den freigegebenen Text
     *      wieder abgeschnitten hätte.
     */
    :host([full-description]) {
      --card-w: 100%;
      --card-h: auto;
    }

    :host([full-description]) .card-perspective,
    :host([full-description]) .card {
      height: auto;
    }

    /*
     * Das ganze Gebaeude, nicht seine oberen 54 %.
     *
     * Hier stand height: clamp(160px, 14vw, 220px) — eine feste Hoehe, die
     * den Flex-Kollaps loeste (siehe Kopplung 2 oben) und dabei einen
     * Ausschnitt erzwang. Auf Prod gemessen (Der Gaslicht-Sund, 1389 px):
     *
     *     Bild natuerlich   1024 x 772   Verhaeltnis 1,33
     *     Rahmen             542 x 220   Verhaeltnis 2,46
     *     sichtbar          100 % Breite ·  54 % HOEHE   (object-position: top)
     *
     * Also 46 % abgeschnitten, und zwar unten — bei einem Gebaeude Sockel und
     * Erdgeschoss. Fuer eine Sammelkarte im Hochformat ist ein Bildfenster
     * richtig; dieser Reiter zeigt aber Bild-Karten, deren Zweck das Bild ist.
     *
     * WARUM 4/3 UND contain, NICHT cover
     *   Die Bildform ist NICHT festgelegt: generate_building_image setzt
     *   kein aspect_ratio, die 1024x772 sind die Vorgabe des Modells. Ein
     *   Rahmen mit cover waere also so lange richtig, wie niemand das Modell
     *   wechselt — und danach still falsch. 4/3 trifft die heutige Form auf
     *   0,5 % genau (1,333 gegen 1,327, kein sichtbarer Rand), und contain
     *   zeigt jede andere Form vollstaendig statt sie zu beschneiden.
     *
     *   Der Grund dahinter bekommt eine Flaeche, damit ein Rand als Absicht
     *   liest und nicht als Loch.
     */
    :host([full-description]) .card__art {
      flex: 0 0 auto;
      height: auto;
      aspect-ratio: 4 / 3;
      background-color: var(--color-surface-sunken);
    }

    :host([full-description]) .card__art img {
      object-fit: contain;
      object-position: center;
    }

    :host([full-description]) .card__body {
      overflow: visible;
      gap: var(--space-2);
      padding: var(--space-4) var(--space-4) var(--space-4-5, var(--space-4));
    }

    /*
     * Der Satz muss mitwachsen, sonst ist die breite Karte nur ein breiter
     * Fehler. Gemessen bei 2560 px, nachdem die Box ihre Zelle ausfuellte:
     * Name 12 px, Beschreibung 8 px -- auf einer Zeile von 591 px. Das sind
     * die Groessen einer 200-px-Sammelkarte, und auf einer Zeile dieser Laenge
     * ist 8 px kein kleiner Text, sondern keiner.
     *
     * Die Zeilenlaenge ist der Grund, nicht der Geschmack: eine Beschreibung
     * ueber 591 px braucht ein Lesemass, sonst wandert das Auge beim
     * Zeilenwechsel ins Leere. Deshalb zusaetzlich max-width auf dem Absatz --
     * die KARTE fuellt die Spalte, der SATZ nicht.
     */
    :host([full-description]) .card__name {
      font-size: var(--text-md);
      line-height: var(--leading-snug);
    }

    :host([full-description]) .card__description {
      font-size: var(--text-sm);
      line-height: var(--leading-relaxed);
      max-width: 62ch;
    }

    .card__badges {
      display: flex;
      flex-wrap: wrap;
      gap: 3px;
      flex-shrink: 0;
      margin-top: auto;
    }

    .card__badge {
      font-family: var(--card-font-mono);
      font-size: 7px;
      text-transform: var(--label-transform);
      letter-spacing: 0.06em;
      padding: 1px 4px;
      border: 1px solid var(--card-border-color);
      color: var(--card-text-dim);
      line-height: 1.3;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    :host([size="xs"]) .card__badges { display: none; }
    :host([size="sm"]) .card__badge { font-size: 6px; padding: 0 2px; }
    :host([size="lg"]) .card__badge { font-size: 9px; padding: 2px 6px; }

    /* ── Capacity Bar (buildings) ── */
    .card__capacity {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: auto;
    }

    .capacity__bar {
      flex: 1;
      height: 4px;
      background: var(--card-border-color);
      border-radius: 2px;
      overflow: hidden;
    }

    .capacity__fill {
      height: 100%;
      background: var(--card-frame-primary);
      border-radius: 2px;
      transition: width 300ms var(--ease-out, ease-out);
    }

    .capacity__text {
      font-family: var(--card-font-mono);
      font-size: 8px;
      color: var(--card-text-dim);
      white-space: nowrap;
    }

    :host([size="xs"]) .card__capacity { display: none; }
    :host([size="sm"]) .capacity__text { font-size: 6px; }
    :host([size="lg"]) .capacity__bar { height: 6px; }
    :host([size="lg"]) .capacity__text { font-size: 10px; }

    /* ── Connections indicator ── */
    .card__connections {
      font-family: var(--card-font-mono);
      font-size: 8px;
      color: var(--card-text-dim);
      margin-top: auto;
    }

    :host([size="xs"]) .card__connections { display: none; }
    :host([size="sm"]) .card__connections { font-size: 6px; }
    :host([size="lg"]) .card__connections { font-size: 10px; }

    /* ── Edit/Delete action buttons (grid view) ── */
    .card__actions {
      position: absolute;
      bottom: 6px;
      right: 6px;
      display: flex;
      gap: 4px;
      z-index: 4;
      opacity: 0;
      transition: opacity 150ms ease;
    }

    .card:hover .card__actions {
      opacity: 1;
    }

    .card__action-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      padding: 0;
      border: none;
      border-radius: 50%;
      background: color-mix(in srgb, var(--card-bg-deep) 85%, transparent);
      backdrop-filter: blur(4px);
      color: var(--card-text);
      cursor: pointer;
      transform: scale(0);
      transition: transform 150ms var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)),
                  background 100ms ease;
    }

    .card:hover .card__action-btn {
      transform: scale(1);
    }

    .card:hover .card__action-btn:nth-child(2) {
      transition-delay: 50ms;
    }

    .card__action-btn:hover {
      background: var(--card-bg-deep);
    }

    .card__action-btn--danger:hover {
      background: var(--color-danger);
    }

    /* Touch devices: always show action buttons (no hover) */
    @media (hover: none) {
      .card__actions { opacity: 1; }
      .card__action-btn { transform: scale(1); }
    }

    .card__description-edit {
      width: 100%;
      height: 80px;
      margin-top: 4px;
      background: var(--card-bg-deep);
      color: var(--card-text);
      border: 1px solid var(--card-border-color);
      font-family: var(--card-font-body);
      font-size: 9px;
      resize: none;
      padding: 2px 4px;
    }

    :host([size="lg"]) .card__description-edit {
      height: 100px;
      font-size: 11px;
    }

    /* ── DRAFTED stamp overlay ── */
    /* A straight, line-flanked band rather than a rubber stamp tilted across
       the art. Rotated pseudo-stamps are out of the design vocabulary; the
       45-degree lozenges used for the stat gems are the documented exception. */
    .card__stamp {
      position: absolute;
      top: 50%;
      left: 0;
      right: 0;
      transform: translateY(-50%);
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 10px;
      font-family: var(--card-font-heading);
      font-weight: 900;
      font-size: 18px;
      text-transform: var(--label-transform);
      letter-spacing: 0.15em;
      color: var(--color-epoch-accent);
      opacity: 0.6;
      z-index: 10;
      pointer-events: none;
    }

    .card__stamp::before,
    .card__stamp::after {
      content: '';
      flex: 1;
      height: 1px;
      background: currentColor;
    }

    :host([size="xs"]) .card__stamp { font-size: 8px; }
    :host([size="sm"]) .card__stamp { font-size: 12px; }
    :host([size="lg"]) .card__stamp { font-size: 24px; }

    /* ═══════════════════════════════════════════════════
       GENERATING — shimmer + reveal animations
       ═══════════════════════════════════════════════════ */
    .card__art--generating {
      overflow: hidden;
    }

    .card__art--generating::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(
        110deg,
        transparent 25%,
        color-mix(in srgb, var(--card-frame-primary) 8%, transparent) 37%,
        color-mix(in srgb, var(--card-frame-primary) 12%, transparent) 50%,
        color-mix(in srgb, var(--card-frame-primary) 8%, transparent) 63%,
        transparent 75%
      );
      background-size: 200% 100%;
      animation: card-shimmer 2s ease-in-out infinite;
      z-index: 1;
    }

    @keyframes card-shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    .card__art--generating .card__art-placeholder {
      animation: placeholder-pulse 2s ease-in-out infinite;
    }

    @keyframes placeholder-pulse {
      0%, 100% { opacity: 0.3; }
      50%      { opacity: 0.6; }
    }

    .card__art--revealed img {
      animation: card-image-reveal 0.6s var(--ease-dramatic, cubic-bezier(0.34, 1.56, 0.64, 1)) forwards;
    }

    @keyframes card-image-reveal {
      0%   { opacity: 0; filter: brightness(2.5); transform: scale(1.05); }
      100% { opacity: 1; filter: brightness(1); transform: scale(1); }
    }

    /* ═══════════════════════════════════════════════════
       MOBILE — fill single-column grid cell
       Cards scale from fixed 200px to full-width on small screens.
       3:4 aspect ratio (shorter than desktop 5:8) to reduce empty
       space and give more room to card body content.
       ═══════════════════════════════════════════════════ */
    @media (max-width: 480px) {
      /* xs/sm are small enough for mobile — only fluid-ify md+ cards.
         :not() selectors give specificity 0,3,0, beating :host([size="md"]) at 0,2,0. */
      :host(:not([size="xs"]):not([size="sm"])) {
        --card-w: 100%;
        --card-h: auto;
      }
      .card-perspective {
        width: 100%;
        height: auto;
        aspect-ratio: 3 / 4;
      }
    }

    /* ═══════════════════════════════════════════════════
       REDUCED MOTION
       ═══════════════════════════════════════════════════ */
    /* ═══════════════════════════════════════════════════
       PER-SIMULATION FRAME TREATMENTS

       Four orthogonal dimensions, set by the simulation's theme and edited in
       the Forge Darkroom: texture, nameplate, corners, foil. Every preset in
       theme-presets.ts has carried these since the card system was specified
       and the Darkroom has offered all 22 options, but until now nothing read
       them: THEME_TOKEN_MAP had no entry, so applyConfig skipped them and the
       card never saw a value.

       They are dimensions rather than five fixed faction skins on purpose: the
       Darkroom lets any world combine any four, so circuits plus cartouche has
       to hold up as readily as the presets do.

       Every colour derives from the card frame custom properties, so a
       treatment carries the world's palette rather than a hardcoded faction
       hue.
       ═══════════════════════════════════════════════════ */

    /* ── Texture: layered onto the card's own background ── */

    .card--tex-scanlines {
      background-image: repeating-linear-gradient(
        0deg,
        transparent 0 2px,
        color-mix(in srgb, var(--card-frame-primary) 14%, transparent) 2px 4px
      );
      animation: card-deal var(--duration-entrance, 400ms)
                   var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)) forwards,
                 tex-drift 2s linear infinite;
      animation-delay: calc(var(--i, 0) * var(--duration-stagger, 50ms)), 0s;
    }

    /* Both the legendary glow and the scanline drift live on .card and set the
       whole animation shorthand, so a legendary card in a scanline world needs
       the union declared explicitly — otherwise the later rule silently drops
       the glow. */
    .card--legendary.card--tex-scanlines {
      animation: card-deal var(--duration-entrance, 400ms)
                   var(--ease-spring) forwards,
                 legendary-glow 3s ease-in-out infinite,
                 tex-drift 2s linear infinite;
      animation-delay: calc(var(--i, 0) * var(--duration-stagger, 50ms)), 0s, 0s;
    }

    @keyframes tex-drift {
      to { background-position-y: 4px; }
    }

    .card--tex-circuits {
      background-image:
        radial-gradient(circle, color-mix(in srgb, var(--card-frame-primary) 26%, transparent) 1px, transparent 1.5px),
        linear-gradient(90deg, color-mix(in srgb, var(--card-frame-primary) 10%, transparent) 1px, transparent 1px),
        linear-gradient(0deg, color-mix(in srgb, var(--card-frame-primary) 7%, transparent) 1px, transparent 1px);
      background-size: 18px 18px, 18px 18px, 18px 18px;
    }

    /* Asymmetric on purpose — the growth this evokes is not tiled. */
    .card--tex-filigree {
      background-image:
        radial-gradient(ellipse 55% 28% at 0% 32%, color-mix(in srgb, var(--card-frame-secondary) 12%, transparent), transparent 70%),
        radial-gradient(ellipse 45% 34% at 100% 68%, color-mix(in srgb, var(--card-frame-secondary) 10%, transparent), transparent 70%),
        radial-gradient(ellipse 70% 20% at 50% 100%, color-mix(in srgb, var(--card-frame-secondary) 8%, transparent), transparent 75%);
    }

    .card--tex-rivets {
      background-image: radial-gradient(
        circle at center,
        color-mix(in srgb, var(--card-text) 16%, transparent) 1.5px,
        transparent 2px
      );
      background-size: 22px 22px;
      background-position: 7px 7px;
    }

    /* Buettenpapier: Rippen, Kettlinien, Wolkigkeit.
     *
     * Der Grund fuer den Atlas-Skin, und die zurueckhaltendste der Texturen —
     * sie ist ein PAPIER, kein Motiv. Wer sie bemerkt, bemerkt sie erst beim
     * zweiten Hinsehen, und genau dann soll sie da sein.
     *
     * Drei Lagen, wie echtes geschoepftes Papier sie hat:
     *   1. Rippen  — die feinen Draehte des Schoepfsiebs, 3 px, quer
     *   2. Kettlinien — die groben Stege, 64 px, laengs
     *   3. Wolkigkeit — zwei weiche Verlaeufe gegen die Regelmaessigkeit.
     *      Ohne sie liest das Gitter als Gitter statt als Faserung; ein
     *      geschoepfter Bogen ist nirgends gleichmaessig dick.
     *
     * Gemischt aus der Kartentinte (--card-text), nicht aus dem Akzent:
     * Papierstruktur ist Schatten im Blatt, keine Farbe darauf. Die
     * Nieten-Textur nimmt aus demselben Grund dieselbe Quelle.
     *
     * KEINE ANIMATION. Die Scanline-Textur driftet, weil eine Bildroehre
     * driftet; ein Bogen Papier tut das nicht. Diese Regel setzt deshalb
     * animation NICHT und laesst die Einzugsbewegung von .card unangetastet —
     * haette sie die Kurzschreibweise gesetzt, waere card-deal still
     * verlorengegangen, genau wie es der Kommentar zur legendaeren
     * Scanline-Karte oben beschreibt.
     *
     * DIE ABSTAENDE KOMMEN AUS EINEM ERSTEN VERSUCH, DER FALSCH AUSSAH.
     * Zuerst standen die Stege bei 25 px und 6 %. Im Browser gesehen, auf
     * einer 204 px breiten Karte: acht Linien quer ueber das Blatt, und das
     * liest als Millimeterpapier — genau das, was Lage 3 verhindern soll.
     * Bei einem geschoepften Bogen liegen die Rippen etwa 1 mm, die Stege
     * etwa 25 mm auseinander; das Verhaeltnis ist rund 1:25, nicht 1:8.
     * Jetzt 3 px zu 64 px, und die Stege stehen bei 3 % statt 6 %: auf der
     * Karte sind es zwei, nicht acht. */
    .card--tex-paper {
      background-image:
        radial-gradient(ellipse 80% 50% at 20% 15%, color-mix(in srgb, var(--card-text) 4%, transparent), transparent 70%),
        radial-gradient(ellipse 70% 55% at 85% 80%, color-mix(in srgb, var(--card-text) 3%, transparent), transparent 72%),
        repeating-linear-gradient(90deg, transparent 0 63px, color-mix(in srgb, var(--card-text) 3%, transparent) 63px 64px),
        repeating-linear-gradient(0deg, transparent 0 2px, color-mix(in srgb, var(--card-text) 3%, transparent) 2px 3px);
    }

    .card--tex-illumination {
      background-image: repeating-linear-gradient(45deg, transparent 0 7px, color-mix(in srgb, var(--card-frame-primary) 8%, transparent) 7px 8px),
        radial-gradient(ellipse 90% 40% at 50% 0%, color-mix(in srgb, var(--card-frame-primary) 14%, transparent), transparent 65%);
    }

    /* ── Nameplate ── */

    .card--plate-terminal .card__name::before {
      content: '> ';
      color: var(--card-frame-primary);
    }

    .card--plate-banner .card__nameplate {
      text-align: center;
      border-top: 1px solid color-mix(in srgb, var(--card-frame-secondary) 55%, transparent);
    }

    .card--plate-banner .card__name {
      font-family: var(--card-font-body);
      text-transform: none;
      font-weight: 600;
    }

    .card--plate-banner .card__name::before { content: '✧ '; }
    .card--plate-banner .card__name::after  { content: ' ✧'; }

    .card--plate-banner .card__name-divider {
      background: none;
      height: auto;
      line-height: 1;
    }

    .card--plate-banner .card__name-divider::before {
      content: '─── ✦ ───';
      display: block;
      text-align: center;
      font-size: 7px;
      color: color-mix(in srgb, var(--card-frame-secondary) 70%, transparent);
    }

    .card--plate-readout .card__nameplate {
      background: var(--card-bg-deep);
    }

    .card--plate-readout .card__name {
      font-family: var(--card-font-mono);
      letter-spacing: 0.14em;
    }

    .card--plate-readout .card__name::before { content: '['; opacity: 0.5; }
    .card--plate-readout .card__name::after  { content: ']'; opacity: 0.5; }

    .card--plate-readout .card__name-divider {
      width: 100%;
      background: none;
      border-top: 1px dashed color-mix(in srgb, var(--card-frame-primary) 55%, transparent);
    }

    .card--plate-plate .card__nameplate {
      background: color-mix(in srgb, var(--card-bg-deep) 70%, var(--card-frame-primary));
      border-top: 1px solid color-mix(in srgb, var(--card-text) 22%, transparent);
      box-shadow: inset 0 1px 0 color-mix(in srgb, var(--card-text) 14%, transparent);
    }

    .card--plate-plate .card__name {
      font-weight: 900;
      letter-spacing: 0.12em;
    }

    .card--plate-plate .card__name-divider {
      width: 100%;
      background: color-mix(in srgb, var(--card-text) 28%, transparent);
    }

    .card--plate-cartouche .card__nameplate {
      text-align: center;
      margin: 0 6px;
      padding: 5px 8px 3px;
      border: 1px solid color-mix(in srgb, var(--card-frame-primary) 45%, transparent);
      border-radius: 999px;
      background: color-mix(in srgb, var(--card-bg-deep) 85%, var(--card-frame-primary));
    }

    .card--plate-cartouche .card__name {
      font-family: var(--card-font-body);
      text-transform: none;
      font-style: italic;
    }

    .card--plate-cartouche .card__name-divider { display: none; }

    /* ── Corner motifs ──
       Two diagonally opposite corners rather than four: at card scale a mark in
       every corner competes with the stat gems, which already occupy the top
       two. This is the treatment the spec itself describes for the terminal
       frame. */

    .card__corners {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 5;
    }

    .card__corners::before,
    .card__corners::after {
      content: '';
      position: absolute;
      width: 10px;
      height: 10px;
      opacity: 0.45;
    }

    .card__corners::before { top: 3px; left: 3px; }
    .card__corners::after  { bottom: 3px; right: 3px; }

    .card--corner-brackets .card__corners::before {
      border-top: 1px solid var(--card-frame-primary);
      border-left: 1px solid var(--card-frame-primary);
    }

    .card--corner-brackets .card__corners::after {
      border-bottom: 1px solid var(--card-frame-primary);
      border-right: 1px solid var(--card-frame-primary);
    }

    .card--corner-tentacles .card__corners::before {
      border-top: 1px solid var(--card-frame-secondary);
      border-left: 1px solid var(--card-frame-secondary);
      border-top-left-radius: 10px;
    }

    .card--corner-tentacles .card__corners::after {
      border-bottom: 1px solid var(--card-frame-secondary);
      border-right: 1px solid var(--card-frame-secondary);
      border-bottom-right-radius: 10px;
    }

    .card--corner-crosshairs .card__corners::before,
    .card--corner-crosshairs .card__corners::after {
      background:
        linear-gradient(var(--card-frame-primary), var(--card-frame-primary)) center / 100% 1px no-repeat,
        linear-gradient(var(--card-frame-primary), var(--card-frame-primary)) center / 1px 100% no-repeat;
    }

    .card--corner-bolts .card__corners::before,
    .card--corner-bolts .card__corners::after {
      width: 5px;
      height: 5px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--card-text) 55%, transparent);
      box-shadow: inset 0 -1px 0 color-mix(in srgb, var(--card-bg-deep) 70%, transparent);
      opacity: 0.6;
    }

    .card--corner-floral .card__corners::before,
    .card--corner-floral .card__corners::after {
      background: radial-gradient(
        circle at center,
        var(--card-frame-primary) 0 1.5px,
        transparent 2px
      ) 0 0 / 5px 5px;
    }

    /* ── Foil (legendary only) ──
       Each variant differs in hue source, blend mode and motion: the
       holographic sheet tracks the pointer, the others move on their own. */

    .card--foil-aquatic .card__holo {
      background: linear-gradient(
        100deg,
        transparent 20%,
        color-mix(in srgb, var(--card-frame-secondary) 45%, transparent) 40%,
        color-mix(in srgb, var(--card-frame-primary) 30%, transparent) 55%,
        transparent 75%
      );
      background-size: 250% 250%;
      background-position: 0% 50%;
      mix-blend-mode: overlay;
      filter: none;
      animation: foil-drift 8s linear infinite;
    }

    .card--foil-phosphor .card__holo {
      background: linear-gradient(
        180deg,
        transparent 35%,
        color-mix(in srgb, var(--card-frame-primary) 40%, transparent) 50%,
        transparent 65%
      );
      background-size: 100% 220%;
      mix-blend-mode: screen;
      filter: none;
      animation: foil-scan 3s linear infinite;
    }

    .card--foil-patina .card__holo {
      background:
        radial-gradient(ellipse 40% 30% at 25% 30%, color-mix(in srgb, var(--card-frame-secondary) 40%, transparent), transparent 70%),
        radial-gradient(ellipse 35% 40% at 75% 70%, color-mix(in srgb, var(--card-frame-primary) 30%, transparent), transparent 70%);
      background-size: 160% 160%;
      mix-blend-mode: soft-light;
      filter: none;
      animation: foil-drift 14s linear infinite;
    }

    .card--foil-gilded .card__holo {
      background: linear-gradient(
        115deg,
        transparent 30%,
        color-mix(in srgb, var(--card-frame-primary) 55%, transparent) 48%,
        color-mix(in srgb, var(--card-text) 35%, transparent) 52%,
        transparent 70%
      );
      background-size: 300% 300%;
      mix-blend-mode: overlay;
      filter: none;
      animation: foil-sweep 5s ease-in-out infinite;
    }

    @keyframes foil-drift {
      from { background-position: 0% 50%; }
      to   { background-position: 200% 50%; }
    }

    @keyframes foil-scan {
      from { background-position-y: -110%; }
      to   { background-position-y: 110%; }
    }

    @keyframes foil-sweep {
      0%, 100% { background-position: 0% 50%; }
      50%      { background-position: 100% 50%; }
    }

    /* The self-animating foils are their own light source, so they show at rest
       rather than only under the pointer the way the holographic sheet does. */
    .card--foil-aquatic.card--legendary .card__holo,
    .card--foil-phosphor.card--legendary .card__holo,
    .card--foil-patina.card--legendary .card__holo,
    .card--foil-gilded.card--legendary .card__holo {
      opacity: 0.75;
    }

    @media (prefers-reduced-motion: reduce) {
      .card {
        animation: none !important;
        opacity: 1;
        transition: none;
      }
      /* The scanline texture keeps its pattern, loses only the drift. */
      .card--tex-scanlines {
        animation: none !important;
      }
      .card__corners {
        display: block;
      }
      .card__reflection,
      .card__holo {
        display: none;
      }
      .card__action-btn {
        transform: scale(1);
        transition: none;
      }
      .card__art--generating::before { animation: none; }
      .card__art--generating .card__art-placeholder { animation: none; opacity: 0.5; }
      .card__art--revealed img { animation: none; opacity: 1; filter: none; }
    }
  `;

  // ── Properties ──

  /**
   * Frame treatment override.
   *
   * Left null, the card wears the frame of the simulation currently themed
   * (`activeCardFrame`). The Darkroom sets it explicitly so its preview follows
   * the chips while they are still being edited, before anything is saved.
   */
  @property({ type: Object, attribute: false }) frame: CardFrame | null = null;

  @property({ reflect: true }) size: CardSize = 'md';
  @property() type: CardType = 'agent';
  @property() rarity: CardRarity = 'common';
  @property() name = '';
  @property({ attribute: 'image-url' }) imageUrl = '';
  @property({ type: Number, attribute: 'primary-stat' }) primaryStat: number | null = null;
  @property({ type: Number, attribute: 'secondary-stat' }) secondaryStat: number | null = null;
  @property({ type: Number, attribute: 'condition-dots' }) conditionDots: number | null = null;
  @property({ type: Object }) aptitudes: AptitudeSet | null = null;
  @property({ type: Array }) badges: CardBadge[] = [];
  @property() subtitle = '';
  /**
   * Single character shown inside the crest while no portrait exists.
   *
   * Empty keeps the generic type glyph — every existing call site keeps the
   * look it had. The Forge ignition fan sets it to the entity's initial.
   */
  @property() sigil = '';
  @property({ type: Object }) capacityBar: CapacityBar | null = null;
  @property({ type: Number, attribute: 'connection-count' }) connectionCount = 0;
  @property({ type: Boolean }) interactive = true;
  @property({ type: Boolean }) draggable = false;
  @property({ type: Boolean }) dimmed = false;
  @property({ type: Boolean }) highlighted = false;
  /**
   * Let the description run to its full length instead of clamping it.
   *
   * The clamp is right for an operative, whose blurb is a caption. It is
   * wrong for a building, whose description is prose the world wrote about
   * itself — the 2026-08-31 handoff asks for the full text there and two
   * clamped lines on the agent card, in the same breath, which is what makes
   * this a property rather than a change to the default.
   */
  @property({ type: Boolean, attribute: 'full-description', reflect: true })
  fullDescription = false;
  @property({ type: Boolean, attribute: 'show-actions' }) showActions = false;

  /**
   * Verdeckt — rendert die Rueckseite statt der Vorderseite.
   *
   * Nur fuer `type="loot"`: agent- und building-Karten behalten ihren DOM
   * unveraendert, damit keine bestehende Aufrufstelle einen Flipper bekommt,
   * den sie nie bestellt hat.
   */
  @property({ type: Boolean, reflect: true, attribute: 'face-down' }) faceDown = false;

  /**
   * Der Verrat: die Rueckseite kuendigt die Stufe an, BEVOR sie sich dreht.
   * Das ist der Kern der Zeremonie — ein Aufleuchten, das etwas verspricht,
   * traegt mehr als das Aufdecken selbst.
   */
  @property({ attribute: 'rarity-tell' }) rarityTell: CardRarityTell = 'none';
  @property({ type: Boolean }) editable = false;
  @property({ type: Boolean }) generating = false;
  @property() description = '';

  @state() private _tilting = false;
  @state() private _settling = false;
  @state() private _mx = 0.5;
  @state() private _my = 0.5;
  @state() private _justRevealed = false;
  /** Frame of the simulation currently themed; overridden by `frame`. */
  @state() private _themeFrame: CardFrame = { ...DEFAULT_CARD_FRAME };

  private _settleTimer = 0;
  private _revealTimer = 0;
  private _disposeFrameEffect: (() => void) | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this._disposeFrameEffect = effect(() => {
      this._themeFrame = activeCardFrame.value;
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._disposeFrameEffect?.();
    this._disposeFrameEffect = null;
    window.clearTimeout(this._settleTimer);
    window.clearTimeout(this._revealTimer);
  }

  /** The frame this card wears right now. */
  private get _frame(): CardFrame {
    return this.frame ?? this._themeFrame;
  }

  protected willUpdate(changedProperties: Map<PropertyKey, unknown>): void {
    // Detect image arriving while in generating state → play reveal
    if (changedProperties.has('imageUrl') && this.imageUrl && this.generating) {
      this._justRevealed = true;
      window.clearTimeout(this._revealTimer);
      this._revealTimer = window.setTimeout(() => {
        this._justRevealed = false;
      }, 700);
    }
  }

  // ── Mouse tracking for 3D tilt ──

  private _onMouseMove = (e: MouseEvent) => {
    if (!this.interactive || this.size === 'xs') return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    this._mx = (e.clientX - rect.left) / rect.width;
    this._my = (e.clientY - rect.top) / rect.height;
    if (!this._tilting) {
      this._tilting = true;
      this._settling = false;
      window.clearTimeout(this._settleTimer);
    }
  };

  private _onMouseLeave = () => {
    if (!this.interactive) return;
    this._tilting = false;
    this._settling = true;
    this._mx = 0.5;
    this._my = 0.5;
    window.clearTimeout(this._settleTimer);
    this._settleTimer = window.setTimeout(() => {
      this._settling = false;
    }, 600);
  };

  private _onClick = () => {
    this.dispatchEvent(new CustomEvent('card-click', { bubbles: true, composed: true }));
  };

  private _onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this._onClick();
    }
  };

  private _onEditClick = (e: Event) => {
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent('card-edit', { bubbles: true, composed: true }));
  };

  private _onDeleteClick = (e: Event) => {
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent('card-delete', { bubbles: true, composed: true }));
  };

  // ── Drag support ──

  private _onDragStart = (e: DragEvent) => {
    if (!this.draggable) return;
    e.dataTransfer?.setData('text/plain', '');
    this.dispatchEvent(new CustomEvent('card-drag-start', { bubbles: true, composed: true }));
  };

  // ── Helpers ──

  private _getBestAptitude(): { type: OperativeType; level: number } | null {
    if (!this.aptitudes) return null;
    let best: OperativeType = 'spy';
    let bestLevel = 0;
    for (const t of OP_LABELS) {
      if (this.aptitudes[t] > bestLevel) {
        bestLevel = this.aptitudes[t];
        best = t;
      }
    }
    return { type: best, level: bestLevel };
  }

  // ── Render ──

  /**
   * Deckt die Karte auf. Idempotent — ein zweiter Aufruf tut nichts.
   *
   * Meldet `velg-card-revealed`, damit die Zeremonie den naechsten Schlag
   * ansetzen kann, ohne die Flip-Dauer doppelt zu kennen.
   */
  reveal(): void {
    if (!this.faceDown) return;
    this.faceDown = false;
    this.dispatchEvent(
      new CustomEvent('velg-card-revealed', {
        detail: { name: this.name, rarity: this.rarity },
        bubbles: true,
        composed: true,
      }),
    );
  }

  /**
   * Die Rueckseite. Bureau-Raute auf 45-Grad-Streifen, Eckklammern, und der
   * Verrat als eigene Schicht: ein Opacity-Puls, KEIN `box-shadow`-Keyframe.
   * Ein animierter Schatten auf einem `preserve-3d`-Element flackert in
   * Chrome — die Aussenschicht hat das Problem nicht.
   */
  private _renderBack() {
    const verrat = this.rarityTell;
    return html`
      <div class="card-back card-back--tell-${verrat}" aria-hidden="true">
        ${verrat === 'none' ? nothing : html`<div class="card-back__aura"></div>`}
        <div class="card-back__corners"></div>
        <div class="card-back__lozenge"><span>BIG</span></div>
        <span class="card-back__label">
          ${
            verrat === 'legendary'
              ? msg('legendary')
              : verrat === 'rare'
                ? msg('rare')
                : msg('reveal')
          }
        </span>
      </div>
    `;
  }

  protected render() {
    const best = this._getBestAptitude();
    const isLegendary = this.rarity === 'legendary';
    const hasRoundBorder =
      getComputedStyle(this).getPropertyValue('--card-radius').trim() !== '0px' &&
      getComputedStyle(this).getPropertyValue('--card-radius').trim() !== '0';

    const frame = this._frame;
    const cardClasses = {
      card: true,
      [`card--tex-${frame.texture}`]: true,
      [`card--plate-${frame.nameplate}`]: true,
      [`card--corner-${frame.corners}`]: true,
      [`card--foil-${frame.foil}`]: true,
      'card--interactive': this.interactive,
      'card--tilting': this._tilting,
      'card--settling': this._settling && !this._tilting,
      'card--dimmed': this.dimmed,
      'card--highlighted': this.highlighted,
      'card--idle': !this._tilting && !this._settling && !this.dimmed,
      'card--common': this.rarity === 'common',
      'card--rare': this.rarity === 'rare',
      'card--rounded-border': this.rarity === 'rare' && hasRoundBorder,
      'card--legendary': isLegendary,
    };

    const tiltVars = styleMap({
      '--mx': String(this._mx),
      '--my': String(this._my),
    });

    const vorderseite = html`
        <div
          class=${classMap(cardClasses)}
          style=${tiltVars}
          role="button"
          tabindex="0"
          .draggable=${this.draggable}
          aria-label=${this._accessibleName}
          aria-busy=${this.generating && !this.imageUrl ? 'true' : 'false'}
          @mousemove=${this._onMouseMove}
          @mouseleave=${this._onMouseLeave}
          @click=${this._onClick}
          @keydown=${this._onKeyDown}
          @dragstart=${this._onDragStart}
        >
          <!-- Light reflection -->
          <div class="card__reflection"></div>

          <!-- Corner motifs. The texture needs no element: it layers onto the
               card's own background, behind every child, with no stacking. -->
          ${
            frame.corners === 'none'
              ? nothing
              : html`<div class="card__corners" aria-hidden="true"></div>`
          }

          <!-- Holographic foil (legendary only) -->
          ${isLegendary ? html`<div class="card__holo"></div>` : nothing}

          <!-- Stat gems -->
          ${this._renderGems(best)}

          <!-- Artwork -->
          <div class="card__art ${classMap({
            'card__art--generating': this.generating && !this.imageUrl,
            'card__art--revealed': this._justRevealed,
          })}">
            ${
              this.imageUrl
                ? html`<img src=${this.imageUrl} alt=${this.name} loading="lazy" />`
                : this.sigil
                  ? html`<div class="card__art-placeholder card__art-placeholder--crest">
                      <div class="card__crest" aria-hidden="true">
                        <span class="card__crest-letter">${this.sigil}</span>
                      </div>
                    </div>`
                  : html`<div class="card__art-placeholder">${this._renderPlaceholderIcon()}</div>`
            }
          </div>

          <!-- Name plate -->
          <div class="card__nameplate">
            <h3 class="card__name" title=${this.name}>${this.name}</h3>
            <div class="card__name-divider"></div>
          </div>

          <!-- Body -->
          <div class="card__body">
            ${this.type === 'building' ? this._renderBuildingBody() : this._renderAgentBody()}
          </div>

          <!-- Action buttons (edit/delete) -->
          ${
            this.showActions
              ? html`
            <div class="card__actions">
              <button class="card__action-btn" @click=${this._onEditClick} aria-label=${msg('Edit')}>
                ${_editIcon()}
              </button>
              <button class="card__action-btn card__action-btn--danger" @click=${this._onDeleteClick} aria-label=${msg('Delete')}>
                ${_trashIcon()}
              </button>
            </div>
          `
              : nothing
          }

          <!-- DRAFTED stamp -->
          ${this.dimmed ? html`<span class="card__stamp">${msg('Deployed')}</span>` : nothing}
        </div>
    `;

    // agent/building behalten ihren DOM auf den Zeichen genau — kein Flipper,
    // keine zusaetzliche Schicht, kein geaenderter Stapelkontext.
    if (this.type !== 'loot') {
      return html`<div class="card-perspective">${vorderseite}</div>`;
    }

    return html`
      <div class="card-perspective">
        <div
          class="card-flipper ${this.faceDown ? 'card-flipper--down' : ''}"
          style=${tiltVars}
        >
          <div class="card-flipper__face card-flipper__face--front">${vorderseite}</div>
          <div class="card-flipper__face card-flipper__face--back">${this._renderBack()}</div>
        </div>
      </div>
    `;
  }

  /** Format stat for diamond gem: abbreviate 4+ digit numbers */
  private _formatGemStat(n: number): string {
    if (n >= 10000) return `${Math.round(n / 1000)}K`;
    if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
    return String(n);
  }

  private _renderGems(best: { type: OperativeType; level: number } | null) {
    if (this.size === 'xs') return nothing;

    const bestColor = best ? OP_COLORS[best.type] : undefined;

    return html`
      <div class="card__gems">
        <!-- Left gem: primary stat -->
        ${
          this.primaryStat != null
            ? html`
          <div class="gem ${String(this.primaryStat).length >= 4 ? 'gem--wide' : ''}" style=${bestColor ? `--gem-color: ${bestColor}` : ''}>
            <span class="gem__inner">${this._formatGemStat(this.primaryStat)}</span>
          </div>
        `
            : html`<span></span>`
        }

        <!-- Right gem: secondary stat or condition dots -->
        ${
          this.conditionDots != null
            ? this._renderConditionDots()
            : this.secondaryStat != null
              ? html`
              <div class="gem gem--glow" style=${bestColor ? `--gem-color: ${bestColor}` : ''}>
                <span class="gem__inner">${this.secondaryStat}</span>
              </div>
            `
              : html`<span></span>`
        }
      </div>
    `;
  }

  private _renderConditionDots() {
    const dots = this.conditionDots ?? 0;
    const colors = ['var(--color-success)', 'var(--color-warning)', 'var(--color-danger)']; // good=green, fair=amber, poor=red
    const dotColor = dots >= 3 ? colors[0] : dots >= 2 ? colors[1] : colors[2];

    return html`
      <div class="gem gem--condition">
        <span class="gem__inner">
          ${[0, 1, 2].map(
            (i) => html`
            <span
              class="condition-dot ${i < dots ? 'condition-dot--filled' : ''}"
              style="--dot-color: ${dotColor}"
            ></span>
          `,
          )}
        </span>
      </div>
    `;
  }

  private _renderAgentBody() {
    return html`
      ${this.aptitudes ? this._renderAptitudePips() : nothing}
      ${this.subtitle ? html`<span class="card__subtitle">${this.subtitle}</span>` : nothing}
      ${this.description && !this.editable ? html`<span class="card__description">${this.description}</span>` : nothing}
      ${
        this.editable
          ? html`
          <textarea
            class="card__description-edit"
            .value=${this.description}
            @input=${(e: Event) => {
              this.description = (e.target as HTMLTextAreaElement).value;
              this.dispatchEvent(
                new CustomEvent('description-change', {
                  detail: { value: this.description },
                  bubbles: true,
                  composed: true,
                }),
              );
            }}
            @click=${(e: Event) => e.stopPropagation()}
          ></textarea>
        `
          : nothing
      }
      ${
        this.badges.length > 0
          ? html`
        <div class="card__badges">
          ${this.badges.map((b) => html`<span class="card__badge">${b.label}</span>`)}
        </div>
      `
          : nothing
      }
      ${
        this.connectionCount > 0
          ? html`
        <span class="card__connections">${this.connectionCount} connections</span>
      `
          : nothing
      }
    `;
  }

  private _renderBuildingBody() {
    return html`
      ${
        this.badges.length > 0
          ? html`
        <div class="card__badges">
          ${this.badges.map((b) => html`<span class="card__badge">${b.label}</span>`)}
        </div>
      `
          : nothing
      }
      ${this.subtitle ? html`<span class="card__subtitle">${this.subtitle}</span>` : nothing}
      ${this.description && !this.editable ? html`<span class="card__description">${this.description}</span>` : nothing}
      ${
        this.editable
          ? html`
          <textarea
            class="card__description-edit"
            .value=${this.description}
            @input=${(e: Event) => {
              this.description = (e.target as HTMLTextAreaElement).value;
              this.dispatchEvent(
                new CustomEvent('description-change', {
                  detail: { value: this.description },
                  bubbles: true,
                  composed: true,
                }),
              );
            }}
            @click=${(e: Event) => e.stopPropagation()}
          ></textarea>
        `
          : nothing
      }
      ${
        this.capacityBar
          ? html`
        <div class="card__capacity">
          <div class="capacity__bar">
            <div class="capacity__fill" style="width: ${Math.min(100, (this.capacityBar.current / Math.max(1, this.capacityBar.max)) * 100)}%"></div>
          </div>
          <span class="capacity__text">${this.capacityBar.current}/${this.capacityBar.max}</span>
        </div>
      `
          : nothing
      }
    `;
  }

  private _renderAptitudePips() {
    if (!this.aptitudes) return nothing;
    const apt = this.aptitudes;

    return html`
      <div class="card__pips">
        ${OP_LABELS.map((type) => {
          const level = apt[type];
          const color = OP_COLORS[type];
          const isDim = level <= 5;
          const isBright = level >= 8;

          return html`
            <div class="pip">
              <span
                class="pip__dot ${isDim ? 'pip__dot--dim' : ''} ${isBright ? 'pip__dot--bright' : ''}"
                style="--pip-color: ${color}"
              >${level}</span>
              <span class="pip__label">${OP_SHORT[type]}</span>
            </div>
          `;
        })}
      </div>
    `;
  }

  /**
   * The card's accessible name.
   *
   * `aria-label` on the `role="button"` REPLACES the card's contents for a
   * screen reader, so a bare name dropped the subtitle — which is what tells an
   * agent card from a building card of the same name. The separator is a comma
   * rather than the dash used in the visible layout: a comma is the one
   * character every screen reader turns into a pause.
   */
  private get _accessibleName(): string {
    return this.subtitle ? `${this.name}, ${this.subtitle}` : this.name;
  }

  private _renderPlaceholderIcon() {
    if (this.type === 'agent') {
      return svg`<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <circle cx="12" cy="8" r="4"/><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
      </svg>`;
    }
    return svg`<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <path d="M3 21h18"/><path d="M5 21v-14l7-4 7 4v14"/><path d="M9 21v-6h6v6"/>
    </svg>`;
  }
}

// ── Inline icons (avoids circular dependency on icons.ts) ──

function _editIcon() {
  return svg`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1"/>
    <path d="M20.385 6.585a2.1 2.1 0 0 0 -2.97 -2.97l-8.415 8.385v3h3l8.385 -8.415z"/>
    <path d="M16 5l3 3"/>
  </svg>`;
}

function _trashIcon() {
  return svg`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M4 7l16 0"/><path d="M10 11l0 6"/><path d="M14 11l0 6"/>
    <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12"/>
    <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3"/>
  </svg>`;
}

declare global {
  interface HTMLElementTagNameMap {
    'velg-game-card': VelgGameCard;
  }
}
